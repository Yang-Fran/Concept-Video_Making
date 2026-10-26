"""Synthesis primitives for the v3 score.

No external samples: felt / glass / bow / bloom / air are all additive or
filtered-noise voices. Everything is deterministic per note (phases drawn from
a seeded RNG) so repeated renders are identical.

Usage: imported by soundctl.py; not a CLI.
"""
import re

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
A4 = 440.0
NOTE_RE = re.compile(r"^([A-Ga-g])([#b]?)(-?\d+)$")
_SEMI = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def note_freq(name):
    m = NOTE_RE.match(str(name).strip())
    if not m:
        raise ValueError(f"bad note name: {name!r}")
    letter, acc, octv = m.group(1), m.group(2), m.group(3)
    semi = _SEMI[letter.upper()]
    if acc == "#":
        semi += 1
    elif acc == "b":
        semi -= 1
    midi = 12 * (int(octv) + 1) + semi
    return A4 * 2.0 ** ((midi - 69) / 12.0)


def db_to_lin(db):
    return 10.0 ** (np.asarray(db, dtype=np.float64) / 20.0)


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def pan_gains(pan):
    theta = (float(pan) + 1.0) * np.pi / 4.0
    return float(np.cos(theta)), float(np.sin(theta))


def lowpass(x, hz, order=2):
    hz = min(float(hz), SR * 0.45)
    sos = butter(order, hz, btype="low", fs=SR, output="sos")
    return sosfilt(sos, x)


def bandpass(x, lo, hi, order=2):
    hi = min(float(hi), SR * 0.45)
    sos = butter(order, [float(lo), hi], btype="bandpass", fs=SR, output="sos")
    return sosfilt(sos, x)


# ---------------------------------------------------------------- notes
# (partial ratio, amplitude, decay seconds) for the plucked voices.
_PARTIALS = {
    "felt": [(1.00, 1.00, 2.60), (2.00, 0.34, 1.55), (3.00, 0.14, 0.95), (4.02, 0.06, 0.65)],
    "glass": [(1.00, 1.00, 2.40), (2.76, 0.55, 1.35), (5.40, 0.30, 0.85), (8.93, 0.14, 0.50)],
}
_BOW_PARTIALS = [(1.00, 1.00), (2.00, 0.50), (3.00, 0.28), (4.00, 0.16), (5.00, 0.09)]


def _tail_fade(x, seconds=0.04):
    n = min(len(x), int(seconds * SR))
    if n > 1:
        x[-n:] *= np.linspace(1.0, 0.0, n) ** 2
    return x


def render_pluck(voice, freq, dur, vel, rng, lp=None):
    n = max(int(dur * SR), 64)
    t = np.arange(n, dtype=np.float64) / SR
    out = np.zeros(n, dtype=np.float64)
    for ratio, amp, tau in _PARTIALS[voice]:
        f = freq * ratio * (1.0 + 0.00025 * (ratio * ratio - 1.0))
        ph = rng.uniform(0.0, 2.0 * np.pi)
        out += amp * np.sin(2.0 * np.pi * f * t + ph) * np.exp(-t / tau)
    out /= sum(a for _, a, _ in _PARTIALS[voice])

    attack = 0.012 if voice == "felt" else 0.003
    a = max(int(attack * SR), 4)
    out[:a] *= smoothstep(np.arange(a) / a)

    if voice == "felt":
        thump = bandpass(rng.normal(size=n), 180, 900)
        out += 0.030 * thump * np.exp(-t / 0.050)
    else:
        strike = bandpass(rng.normal(size=n), 2000, 7000)
        out += 0.018 * strike * np.exp(-t / 0.012)

    if lp:
        out = lowpass(out, lp)
    out = _tail_fade(out, 0.05)
    peak = float(np.max(np.abs(out)))
    if peak > 1e-9:
        out /= peak
    return (out * vel).astype(np.float32)


def render_bow(freq, end, release, vel, rng, lp=2200, fade_db=0.0):
    total = max(float(end) + float(release), 0.2)
    n = int(total * SR)
    t = np.arange(n, dtype=np.float64) / SR
    vib = 1.0 + 0.0035 * np.sin(2.0 * np.pi * 4.7 * t + rng.uniform(0, 2 * np.pi))
    drift = 1.0 + 0.05 * np.sin(2.0 * np.pi * 0.11 * t + rng.uniform(0, 2 * np.pi))
    out = np.zeros(n, dtype=np.float64)
    for ratio, amp in _BOW_PARTIALS:
        f = freq * ratio * (1.0 + rng.uniform(-0.0015, 0.0015))
        ph = rng.uniform(0.0, 2.0 * np.pi)
        out += amp * np.sin(2.0 * np.pi * f * np.cumsum(vib) / SR + ph)
    out /= sum(a for _, a in _BOW_PARTIALS)
    out *= drift
    if abs(fade_db) > 1e-6:
        # constant-dB-per-second fade across the held part, then release
        fade = 10.0 ** (fade_db / 20.0 * np.clip(t / max(float(end), 1e-3), 0.0, 1.0))
        out *= fade

    a = int(0.45 * SR)
    out[:a] *= smoothstep(np.arange(a) / a)
    if end < total:
        idx = int(end * SR)
        rel = t[idx:] - float(end)
        tau = max(float(release) / 3.0, 0.05)
        out[idx:] *= np.exp(-rel / tau)
    out = lowpass(out, lp)
    out = _tail_fade(out, 0.12)
    peak = float(np.max(np.abs(out)))
    if peak > 1e-9:
        out /= peak
    return (out * vel).astype(np.float32)


def render_bloom(f0, f1, dur, rng):
    n = max(int(dur * SR), 256)
    t = np.arange(n, dtype=np.float64) / SR
    f = f0 * np.exp(np.log(max(f1, 1.0) / f0) * (t / max(dur, 1e-3)))
    phase = 2.0 * np.pi * np.cumsum(f) / SR
    out = np.sin(phase) + 0.12 * np.sin(2.0 * phase + rng.uniform(0, 2 * np.pi))
    env = smoothstep(t / 0.18) * np.exp(-np.maximum(0.0, t - 0.30 * dur) / (0.45 * dur))
    out *= env
    out = _tail_fade(out, 0.06)
    peak = float(np.max(np.abs(out)))
    if peak > 1e-9:
        out /= peak
    return out.astype(np.float32)


def make_air(n, hp, lp, lfo_hz, depth, rng):
    x = rng.normal(size=n).astype(np.float32)
    x = bandpass(x, hp, lp, order=2)
    t = np.arange(n, dtype=np.float64) / SR
    lfo = 1.0 + depth * np.sin(2.0 * np.pi * lfo_hz * t + rng.uniform(0, 2 * np.pi))
    x = x * lfo.astype(np.float32)
    rms = float(np.sqrt(np.mean(x.astype(np.float64) ** 2)))
    if rms > 1e-9:
        x /= rms
    return x.astype(np.float32)


def make_ir(seconds, hp, lp, predelay_ms, rng):
    n = max(int(seconds * SR), 256)
    t = np.arange(n, dtype=np.float64) / SR
    ir = rng.normal(size=n) * np.exp(-t / max(seconds / 6.9, 1e-3))
    fade = max(int(0.02 * SR), 8)
    ir[:fade] *= np.linspace(0.0, 1.0, fade)
    ir = bandpass(ir, hp, lp, order=2)
    pre = np.zeros(max(int(predelay_ms / 1000.0 * SR), 0))
    ir = np.concatenate([pre, ir])
    ir /= max(np.sqrt(np.sum(ir * ir)), 1e-9)
    return ir.astype(np.float32)


def convolve(x, ir):
    if len(x) == 0:
        return x
    y = fftconvolve(x, ir.astype(np.float64))[: len(x)]
    return y.astype(np.float32)
