#!/usr/bin/env python
"""soundctl — score-driven audio renderer (v3).

Two steps: edit `score_v3.json` (data), then run this tool (engine).
No synthesis code needs to change when the score changes.

  python main/film/tools/soundctl.py list
  python main/film/tools/soundctl.py check
  python main/film/tools/soundctl.py window --at 24.8,103.9,147.6 --len 8 --tag ab
  python main/film/tools/soundctl.py window --at 147.6 --len 8 --no-voice --tag bed
  python main/film/tools/soundctl.py render --stems --master
  python main/film/tools/soundctl.py mux --video OUT.mp4 --audio PATH.wav

Outputs go to film/out/audio/v3/.
"""
import argparse
import os
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import uniform_filter1d

import audiosynth as syn

ROOT = Path(__file__).resolve().parents[2]      # main/
FILM = ROOT / "film"
DEFAULT_SCORE = Path(__file__).with_name("score_v3.json")
OUT_DIR = FILM / "out" / "audio" / "v3"
FFMPEG = os.environ.get("FFMPEG_PATH", "ffmpeg")

VOICES = {"felt", "glass", "bow"}
KINDS = {"notes", "bloom"}


# ---------------------------------------------------------------- helpers
def load_score(path):
    score = json.loads(Path(path).read_text(encoding="utf-8"))
    return score


def score_errors(score):
    errs = []
    meta = score.get("meta", {})
    for key in ("fps", "duration", "sample_rate"):
        if key not in meta:
            errs.append(f"meta.{key} missing")
    if errs:
        return errs
    fps, dur = meta["fps"], meta["duration"]
    last = dur * fps
    seen = set()
    for ev in score.get("events", []):
        eid = ev.get("id", "?")
        if eid in seen:
            errs.append(f"{eid}: duplicate id")
        seen.add(eid)
        if not (0 <= ev.get("frame", -1) < last):
            errs.append(f"{eid}: frame {ev.get('frame')} outside 0..{last}")
        kind = ev.get("kind", "notes")
        if kind not in KINDS:
            errs.append(f"{eid}: unknown kind {kind!r}")
            continue
        if kind == "bloom":
            for k in ("f0", "f1", "dur"):
                if k not in ev:
                    errs.append(f"{eid}: bloom missing {k}")
            continue
        voice = ev.get("voice")
        if voice not in VOICES:
            errs.append(f"{eid}: unknown voice {voice!r}")
            continue
        notes = ev.get("notes")
        if not notes:
            errs.append(f"{eid}: no notes")
            continue
        for i, note in enumerate(notes):
            try:
                syn.note_freq(note.get("n"))
            except Exception:
                errs.append(f"{eid}.{i}: bad note {note.get('n')!r}")
            if "vel" not in note:
                errs.append(f"{eid}.{i}: missing vel")
            if voice == "bow":
                if "end" not in note:
                    errs.append(f"{eid}.{i}: bow note missing end")
            elif "dur" not in note:
                errs.append(f"{eid}.{i}: pluck note missing dur")
    keys = score.get("dynamics", {}).get("keys", [])
    if keys:
        frames = [k[0] for k in keys]
        if frames != sorted(frames):
            errs.append("dynamics.keys not sorted")
    return errs


def decode_mp3(path, sr):
    raw = subprocess.run(
        [FFMPEG, "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", str(sr), "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0


def fade_edges(x, ms=25, sr=syn.SR):
    n = min(len(x), int(ms / 1000 * sr))
    if n > 1:
        x[:n] *= np.linspace(0, 1, n, dtype=np.float32)
        x[-n:] *= np.linspace(1, 0, n, dtype=np.float32)
    return x


def load_voice(score, n):
    meta = score["meta"]
    sr = meta["sample_rate"]
    timing = json.loads((ROOT / meta["timing"]).read_text(encoding="utf-8"))
    entries = sorted(timing["entries"], key=lambda e: e["start"])
    voice = np.zeros(n, dtype=np.float32)
    for i, e in enumerate(entries):
        path = ROOT / meta["tts_dir"] / f"{e['section']}_{e['index']:02d}_0.mp3"
        if not path.exists():
            raise SystemExit(f"missing voice clip: {path}")
        x = decode_mp3(path, sr)
        if i + 1 < len(entries):
            max_dur = (entries[i + 1]["start"] - e["start"]) / meta["fps"] - 0.02
            if max_dur > 0.1 and len(x) > max_dur * sr:
                x = x[: int(max_dur * sr)].copy()
        active = np.abs(x) > 0.005
        if active.any():
            rms = float(np.sqrt(np.mean(x[active] ** 2)))
            if rms > 1e-5:
                x *= 0.1259 / rms
        x = fade_edges(x, 25, sr)
        start = int(round(e["start"] / meta["fps"] * sr))
        end = min(n, start + len(x))
        if end > start:
            voice[start:end] += x[: end - start]
    peak = float(np.max(np.abs(voice))) if len(voice) else 0.0
    if peak > 0.70:
        # Soft-knee peak limiter: only the loud transients are touched.
        thr, top = 0.70, 0.85
        over = np.abs(voice) > thr
        voice[over] = np.sign(voice[over]) * (
            thr + (top - thr) * np.tanh((np.abs(voice[over]) - thr) / (top - thr))
        )
    return voice.astype(np.float32)


def add_stereo(bus, sig, start, gl, gr):
    n = bus.shape[1]
    if start >= n:
        return
    end = min(n, start + len(sig))
    if end <= start:
        return
    seg = sig[: end - start]
    bus[0, start:end] += seg * gl
    bus[1, start:end] += seg * gr


def voice_envelope(voice, sr):
    env = uniform_filter1d(np.abs(voice), size=int(0.06 * sr), mode="nearest")
    env = uniform_filter1d(env, size=int(0.25 * sr), mode="nearest")
    return np.clip(env * 18.0, 0.0, 1.0).astype(np.float32)


def duck_factor(env, depth_db):
    if depth_db <= 0:
        return np.ones_like(env)
    depth = 1.0 - 10.0 ** (-float(depth_db) / 20.0)
    return (1.0 - depth * env).astype(np.float32)


def auto_level(bus, keys, events, fps, sr, n, verbose=True):
    """Return (scaled bus, gain curve).

    Measurement points are note-event attacks: RMS over the first 2.5 s of each
    event (the musical body), compared with the target interpolated from
    dynamics.keys; the gain curve is interpolated and smoothed.
    """
    mono = bus.mean(axis=0)
    key_frames = np.array([k[0] for k in keys], dtype=float)
    key_targets = np.array([k[1] for k in keys], dtype=float)
    frames = sorted({int(ev["frame"]) for ev in events if ev.get("kind", "notes") == "notes"})
    pts = []
    span = int(2.5 * sr)
    for fr in frames:
        c = int(round(fr / fps * sr))
        seg = mono[c:c + span]
        if seg.size < int(0.2 * sr):
            continue
        rms = float(np.sqrt(np.mean(seg.astype(np.float64) ** 2)))
        if rms > 1e-3:
            target = float(np.interp(fr, key_frames, key_targets))
            pts.append((fr, target, target - 20.0 * np.log10(rms)))
    if not pts:
        return bus, np.zeros(n, dtype=np.float32)
    frames = np.array([p[0] for p in pts], dtype=float)
    gains = np.clip(np.array([p[2] for p in pts], dtype=float), -18.0, 18.0)
    # Hold each event's gain until the next event, with a short ramp just before
    # it. Linear interpolation across long gaps would fight long fades.
    curve = np.full(n, gains[0], dtype=np.float64)
    for i in range(len(frames) - 1):
        a = max(int(round(frames[i] / fps * sr)), 0)
        b = min(int(round(frames[i + 1] / fps * sr)), n)
        if b <= a:
            continue
        curve[a:b] = gains[i]
        ramp = min(int(0.45 * sr), b - a)
        if ramp > 1:
            curve[b - ramp:b] = np.linspace(gains[i], gains[i + 1], ramp)
    last = max(int(round(frames[-1] / fps * sr)), 0)
    curve[last:] = gains[-1]
    curve = uniform_filter1d(curve, size=int(0.2 * sr), mode="nearest").astype(np.float32)
    if verbose:
        for fr, target, g in pts:
            print(f"  level f{fr:04d}  target {target:6.1f}  gain {g:+5.1f} dB")
    return bus * syn.db_to_lin(curve).astype(np.float32), curve


def make_air(score, n):
    cfg = score["air"]
    sr = score["meta"]["sample_rate"]
    rng = np.random.default_rng(20261028)
    air = syn.make_air(n, cfg["hp_hz"], cfg["lp_hz"], cfg["lfo_hz"], cfg["lfo_depth"], rng)
    t = np.arange(n, dtype=np.float64) / sr
    keys = np.array(cfg["level_db"], dtype=float)
    level = np.interp(t, keys[:, 0], keys[:, 1])
    pan = np.interp(t, np.array(cfg["pan"], dtype=float)[:, 0], np.array(cfg["pan"], dtype=float)[:, 1])
    theta = (pan + 1.0) * np.pi / 4.0
    gl = (np.cos(theta) * syn.db_to_lin(level)).astype(np.float32)
    gr = (np.sin(theta) * syn.db_to_lin(level)).astype(np.float32)
    bus = np.zeros((2, n), dtype=np.float32)
    bus[0] = air * gl
    bus[1] = air * gr
    return bus


def render_buses(score, with_voice=True, verbose=True):
    meta = score["meta"]
    sr, dur, fps = meta["sample_rate"], meta["duration"], meta["fps"]
    n = int(sr * dur)
    rng = np.random.default_rng(20261027)

    thread = np.zeros((2, n), dtype=np.float32)
    bloom = np.zeros((2, n), dtype=np.float32)
    for ev in sorted(score["events"], key=lambda e: e["frame"]):
        start = int(round(ev["frame"] / fps * sr))
        pan = float(ev.get("pan", 0.0))
        gl, gr = syn.pan_gains(pan)
        if ev.get("kind") == "bloom":
            sig = syn.render_bloom(ev["f0"], ev["f1"], ev["dur"], rng)
            sig = sig * syn.db_to_lin(ev.get("gain_db", 0.0))
            add_stereo(bloom, sig, start, gl, gr)
            continue
        voice = ev["voice"]
        lp = ev.get("lp")
        for note in ev["notes"]:
            f = syn.note_freq(note["n"])
            at = int(round(float(note.get("at", 0.0)) * sr))
            if voice == "bow":
                sig = syn.render_bow(f, note["end"], note.get("release", 1.0), note["vel"], rng,
                                     lp=lp or 2200, fade_db=float(note.get("fade_db", 0.0)))
            else:
                sig = syn.render_pluck(voice, f, note["dur"], note["vel"], rng, lp=lp)
            add_stereo(thread, sig, start + at, gl, gr)

    rv = score.get("reverb", {})
    wet = float(rv.get("wet", 0.0))
    if wet > 0:
        ir_l = syn.make_ir(rv["seconds"], rv["hp_hz"], rv["lp_hz"], rv["predelay_ms"], rng)
        ir_r = syn.make_ir(rv["seconds"], rv["hp_hz"], rv["lp_hz"], rv["predelay_ms"], rng)
        wet_l = syn.convolve(thread[0], ir_l)
        wet_r = syn.convolve(thread[1], ir_r)
        thread[0] = thread[0] * (1.0 - wet) + wet_l * wet
        thread[1] = thread[1] * (1.0 - wet) + wet_r * wet

    buses = score["buses"]
    thread *= syn.db_to_lin(buses["thread"]["gain_db"])
    bloom *= syn.db_to_lin(buses["bloom"]["gain_db"])
    music = thread + bloom

    # Normalize the relative mix, then let the dynamics keys set the absolute level.
    mono = music.mean(axis=0)
    active = np.abs(mono) > 1e-4
    if active.any():
        rms = float(np.sqrt(np.mean(mono[active].astype(np.float64) ** 2)))
        scale = syn.db_to_lin(-20.0) / max(rms, 1e-9)
        thread *= scale
        bloom *= scale
        music = thread + bloom
    dyn = score.get("dynamics", {})
    if dyn.get("auto", True) and dyn.get("keys"):
        _, curve = auto_level(music, dyn["keys"], score["events"], fps, sr, n, verbose=verbose)
        g = syn.db_to_lin(curve).astype(np.float32)
        thread *= g
        bloom *= g

    voice = load_voice(score, n) if with_voice else np.zeros(n, dtype=np.float32)
    env = voice_envelope(voice, sr)
    thread *= duck_factor(env, float(buses["thread"]["duck_db"]))[None, :]
    bloom *= duck_factor(env, float(buses["bloom"]["duck_db"]))[None, :]
    music = thread + bloom

    air = make_air(score, n) if score.get("air", {}).get("enabled", True) else np.zeros((2, n), dtype=np.float32)
    air *= duck_factor(env, float(buses["air"]["duck_db"]))[None, :]

    mix = np.zeros((2, n), dtype=np.float32)
    if with_voice:
        mix += voice[None, :]
    mix += music + air
    # Keep full scale as headroom ceiling; soft-limit only if it is exceeded.
    peak = float(np.max(np.abs(mix)))
    if peak > 0.98:
        mix = (np.tanh(mix / 0.98) * 0.98).astype(np.float32)
    return {"mix": mix, "thread": thread, "bloom": bloom, "air": air, "voice": voice}


# ---------------------------------------------------------------- ffmpeg
def loudness_gain(wav_path, target=-17.0):
    proc = subprocess.run(
        [FFMPEG, "-hide_banner", "-nostats", "-i", str(wav_path),
         "-af", "loudnorm=print_format=json", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", proc.stderr, re.S)
    if not m:
        return 0.0
    try:
        info = json.loads(m.group(0))
        input_i = float(info.get("input_i", "-inf"))
    except Exception:
        return 0.0
    if not np.isfinite(input_i):
        return 0.0
    return float(target - input_i)


def write_wav(path, data, sr, bits=32):
    path.parent.mkdir(parents=True, exist_ok=True)
    if bits == 32:
        wavfile.write(path, sr, data.T.astype(np.float32))
    else:
        pcm = (np.clip(data.T, -1.0, 1.0) * 32767.0).astype("<i2")
        wavfile.write(path, sr, pcm)


def mp3_from(wav_path, mp3_path, bitrate="192k"):
    subprocess.run([FFMPEG, "-y", "-v", "error", "-i", str(wav_path), "-c:a", "libmp3lame", "-b:a", bitrate, str(mp3_path)], check=True)


# ---------------------------------------------------------------- commands
def cmd_list(args):
    score = load_score(args.score)
    fps = score["meta"]["fps"]
    print(f"{'id':5s} {'frame':>6s} {'time':>7s}  {'voice':6s} {'notes'}")
    for ev in sorted(score["events"], key=lambda e: e["frame"]):
        fr = ev["frame"]
        if ev.get("kind") == "bloom":
            desc = f"bloom {ev['f0']}->{ev['f1']}Hz {ev['dur']}s"
            voice = "bloom"
        else:
            voice = ev["voice"]
            parts = []
            for note in ev["notes"]:
                at = float(note.get("at", 0.0))
                tail = f"end{note['end']:g}s" if voice == "bow" else f"{note['dur']:g}s"
                parts.append(f"{note['n']}@{at:g}+{tail}")
            desc = " ".join(parts)
        print(f"{ev['id']:5s} {fr:6d} {fr / fps:6.2f}s  {voice:6s} {desc}")
    print(f"\n{len(score['events'])} events, {sum(len(e.get('notes', [])) for e in score['events'])} notes")


def cmd_check(args):
    score = load_score(args.score)
    errs = score_errors(score)
    meta = score["meta"]
    print(f"score: {meta.get('name')}  {meta['duration']}s @ {meta['fps']}fps / {meta['sample_rate']}Hz")
    print(f"events: {len(score['events'])}  notes: {sum(len(e.get('notes', [])) for e in score['events'])}")
    print(f"dynamics keys: {len(score['dynamics']['keys'])}  air keys: {len(score['air']['level_db'])}")
    if errs:
        print("\nERRORS:")
        for e in errs:
            print("  -", e)
        sys.exit(1)
    print("\nOK")


def _render(args, with_voice=True, tag="v3"):
    score = load_score(args.score)
    errs = score_errors(score)
    if errs:
        for e in errs:
            print("score error:", e)
        sys.exit(1)
    sr = score["meta"]["sample_rate"]
    print(f"rendering {tag} ({'voice+music' if with_voice else 'music only'}) ...")
    buses = render_buses(score, with_voice=with_voice)
    return score, buses


def cmd_window(args):
    score, buses = _render(args, with_voice=not args.no_voice, tag="window")
    sr = score["meta"]["sample_rate"]
    mix = buses["mix"]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp = OUT_DIR / "_window_source.wav"
    write_wav(tmp, mix, sr)
    gain_db = loudness_gain(tmp, target=-17.0)
    gain = syn.db_to_lin(gain_db)
    print(f"master gain {gain_db:+.2f} dB")
    starts = [float(s) for s in args.at.split(",") if s.strip()]
    for i, start in enumerate(starts):
        a = int(start * sr)
        b = min(int((start + args.len) * sr), mix.shape[1])
        seg = mix[:, a:b] * gain
        if args.match is not None:
            tmp2 = OUT_DIR / "_w_match.wav"
            write_wav(tmp2, seg, sr)
            seg = seg * syn.db_to_lin(loudness_gain(tmp2, target=args.match))
            tmp2.unlink(missing_ok=True)
        if args.rms is not None:
            cur = float(np.sqrt(np.mean(seg.astype(np.float64) ** 2)))
            if cur > 1e-9:
                seg = seg * (syn.db_to_lin(args.rms) / cur)
        peak = float(np.max(np.abs(seg)))
        if peak > 0.95:
            print(f"  warning: window peak {20 * np.log10(peak):+.1f} dBFS, scaling down")
            seg *= 0.95 / peak
            peak = 0.95
        name = f"{args.tag}_{i + 1:02d}_{start:05.1f}s"
        wav = OUT_DIR / f"{name}.wav"
        mp3 = OUT_DIR / f"{name}.mp3"
        write_wav(wav, seg, sr, bits=16)
        mp3_from(wav, mp3)
        print(f"  {name}  {start:.1f}-{start + args.len:.1f}s  peak {20 * np.log10(max(peak, 1e-9)):.1f} dBFS")
    tmp.unlink(missing_ok=True)


def cmd_render(args):
    score, buses = _render(args, with_voice=True, tag="full")
    sr = score["meta"]["sample_rate"]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    full = OUT_DIR / "v3_full.wav"
    write_wav(full, buses["mix"], sr)
    gain_db = loudness_gain(full, target=-17.0)
    print(f"master gain {gain_db:+.2f} dB")
    master = OUT_DIR / "v3_full_master.wav"
    subprocess.run(
        [FFMPEG, "-y", "-v", "error", "-i", str(full),
         "-af", f"volume={gain_db:.2f}dB,alimiter=limit=0.841:level=false",
         "-c:a", "pcm_s16le", str(master)],
        check=True,
    )
    mp3_from(master, OUT_DIR / "v3_full_master.mp3")
    if args.stems:
        stem_dir = OUT_DIR / "stems"
        write_wav(stem_dir / "thread.wav", buses["thread"], sr, bits=16)
        write_wav(stem_dir / "bloom.wav", buses["bloom"], sr, bits=16)
        write_wav(stem_dir / "air.wav", buses["air"], sr, bits=16)
        write_wav(stem_dir / "voice.wav", np.stack([buses["voice"], buses["voice"]]), sr, bits=16)
        print(f"stems -> {stem_dir}")
    print(f"wrote {full}")
    print(f"wrote {master}")


def cmd_mux(args):
    subprocess.run(
        [FFMPEG, "-y", "-v", "error", "-i", str(args.video), "-i", str(args.audio),
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(args.out)],
        check=True,
    )
    print(f"wrote {args.out}")


def main():
    ap = argparse.ArgumentParser(description="score-driven audio renderer")
    ap.add_argument("--score", default=str(DEFAULT_SCORE))
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("list", help="list score events")
    p.set_defaults(func=cmd_list)

    p = sub.add_parser("check", help="validate the score")
    p.set_defaults(func=cmd_check)

    p = sub.add_parser("window", help="render an A/B window")
    p.add_argument("--at", required=True, help="comma-separated start seconds")
    p.add_argument("--len", type=float, default=8.0, help="window length in seconds")
    p.add_argument("--tag", default="ab")
    p.add_argument("--no-voice", action="store_true")
    p.add_argument("--match", type=float, default=None, help="loudness-match each window to this LUFS")
    p.add_argument("--rms", type=float, default=None, help="RMS-match each window to this dBFS")
    p.set_defaults(func=cmd_window)

    p = sub.add_parser("render", help="render the full 180 s mix")
    p.add_argument("--stems", action="store_true")
    p.add_argument("--master", action="store_true", help="(kept for compatibility; master is always written)")
    p.set_defaults(func=cmd_render)

    p = sub.add_parser("mux", help="mux audio into an existing mp4")
    p.add_argument("--video", required=True)
    p.add_argument("--audio", required=True)
    p.add_argument("--out", required=True)
    p.set_defaults(func=cmd_mux)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
