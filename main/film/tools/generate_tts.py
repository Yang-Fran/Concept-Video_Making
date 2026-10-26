# Generate Yunyang TTS for every subtitle and measure timing.
# Run: python main/film/tools/generate_tts.py (optional; requires network)
import asyncio
import os
import json
import re
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'film' / 'src' / 'data.js'
OUT = ROOT / 'film' / 'assets' / 'voice'
OUT.mkdir(parents=True, exist_ok=True)
FFMPEG = os.environ.get("FFMPEG_PATH", "ffmpeg")
VOICE = 'zh-CN-YunyangNeural'
RATES = [0]


def parse_subs():
    text = DATA.read_text(encoding='utf-8')
    result = []
    for m in re.finditer(r'^  (s\d): \[(.*?)^  \],', text, re.S | re.M):
        section, block = m.group(1), m.group(2)
        for i, e in enumerate(re.finditer(r"\{ start: (\d+), end: (\d+), text: '([^']*)' \}", block), 1):
            start, end, t = int(e.group(1)), int(e.group(2)), e.group(3)
            result.append({
                'section': section,
                'index': i,
                'id': f'{section.upper()}-{i:02d}',
                'start': start,
                'end': end,
                'text': t,
                'chars': len(t),
            })
    return result


def media_duration(path):
    p = subprocess.run(
        [FFMPEG, '-hide_banner', '-i', str(path)],
        capture_output=True, text=True, encoding='utf-8', errors='replace'
    )
    m = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', p.stderr)
    if not m:
        raise RuntimeError(f'no duration: {path}')
    h, mnt, sec = m.groups()
    return int(h) * 3600 + int(mnt) * 60 + float(sec)


async def one(entry, rate, sem):
    tag = '0' if rate == 0 else f'm{abs(rate)}'
    path = OUT / f"{entry['section']}_{entry['index']:02d}_{tag}.mp3"
    if path.exists() and path.stat().st_size > 1000:
        return path
    async with sem:
        for attempt in range(3):
            try:
                c = edge_tts.Communicate(entry['text'], VOICE, rate=f'{rate:+d}%')
                await asyncio.wait_for(c.save(str(path)), timeout=45)
                if path.exists() and path.stat().st_size > 1000:
                    return path
            except Exception as exc:
                if attempt == 2:
                    print('FAIL', entry['id'], rate, exc, flush=True)
                    return None
                await asyncio.sleep(1.5)
    return None


async def main():
    entries = parse_subs()
    print(f'entries: {len(entries)}', flush=True)
    sem = asyncio.Semaphore(4)
    tasks = []
    for e in entries:
        for r in RATES:
            tasks.append(one(e, r, sem))
    paths = await asyncio.gather(*tasks)
    path_iter = iter(paths)
    for e in entries:
        e['files'] = {}
        e['durations'] = {}
        for r in RATES:
            tag = '0' if r == 0 else f'm{abs(r)}'
            p = next(path_iter)
            if p:
                d = media_duration(p)
                e['files'][str(r)] = str(p.relative_to(ROOT))
                e['durations'][str(r)] = round(d, 3)
            else:
                e['files'][str(r)] = None
                e['durations'][str(r)] = None
        window = (e['end'] - e['start']) / 30
        e['window'] = round(window, 3)
        for r in RATES:
            d = e['durations'].get(str(r))
            if d:
                e[f'gap_{r}'] = round(window - d, 3)
                e[f'fill_{r}'] = round(d / window, 3)
                e[f'need_slow_{r}'] = round((window / d - 1) * 100, 1)
                e[f'cps_{r}'] = round(e['chars'] / d, 2)
    # remove absolute file paths from committed/shared json
    for e in entries:
        e.pop('files', None)
    out = {
        'voice': VOICE,
        'rates': RATES,
        'note': 'durations include leading/trailing silence; window=(end-start)/30; need_slow>0 means TTS must slow to fill window; fill<1 leaves a gap, fill>1 overlaps next subtitle.',
        'entries': entries,
    }
    (OUT / 'generated_tts_timing.json').write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
    print('wrote', OUT / 'generated_tts_timing.json', flush=True)
    print('Existing clips are reused. New durations are in generated_tts_timing.json; review timing before replacing main/tts_timing.json.', flush=True)


if __name__ == '__main__':
    asyncio.run(main())
