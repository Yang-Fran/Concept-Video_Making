#!/usr/bin/env node
/**
 * filmctl — one stable entry point for review stills, beat clips,
 * chapter review cuts and the final film.
 *
 *   node tools/filmctl.mjs list
 *   node tools/filmctl.mjs check
 *   node tools/filmctl.mjs qa --beat S1/C1B2 --frames 0,120,240 [--burn-in]
 *   node tools/filmctl.mjs clip --beat S1/C1B2 [--burn-in] [--scale 720]
 *   node tools/filmctl.mjs review --all [--burn-in] [--scale 720]
 *   node tools/filmctl.mjs render
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

import {
  TIMELINE,
  TOTAL_FRAMES,
  beatAt,
  beatById,
  fmtTime,
  sectionAt,
  sectionById,
  transitionAt,
} from '../src/manifest.js';
import { ALL_SUBS } from '../src/data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const QA = path.join(ROOT, 'qa');
const CHROME = process.env.CHROME_PATH || (
  process.platform === 'win32'
    ? path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe')
    : process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : 'google-chrome'
);
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FPS = 30;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hasFlag(name) {
  return process.argv.includes(name);
}

function argValue(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function safeName(id) {
  return id.replace(/[^A-Za-z0-9._-]+/g, '_');
}

function pad4(n) {
  return String(Math.max(0, n | 0)).padStart(4, '0');
}

function formatEta(seconds) {
  if (seconds < 90) return `${Math.ceil(seconds)} s`;
  return `${Math.ceil(seconds / 60)} min`;
}

function estimateSeconds(frames, fps = 8) {
  return frames / fps;
}

/* ---------- local HTTP ---------- */

function startServer() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = (url === '/' ? '/index.html' : url).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const ext = path.extname(file).toLowerCase();
      const type =
        {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.png': 'image/png',
        }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return server;
}

/* ---------- CDP ---------- */

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.method && this.onEvent) this.onEvent(msg);
      if (!msg.id) return;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
      else p.resolve(msg.result);
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

async function launchPage({ width = 1920, height = 1080 } = {}) {
  const server = startServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/index.html`;
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'rank-filmctl-'));
  let chrome = null;
  let cdp = null;

  try {
    chrome = spawn(
      CHROME,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-color-profile=srgb',
        '--disable-lcd-text',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-sandbox',
        '--remote-debugging-port=0',
        `--user-data-dir=${userData}`,
        '--window-size=1920,1080',
        'about:blank',
      ],
      { stdio: 'ignore' }
    );

    const portFile = path.join(userData, 'DevToolsActivePort');
    let debugPort = null;
    for (let i = 0; i < 150; i++) {
      if (fs.existsSync(portFile)) {
        const lines = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
        if (lines[0]) {
          debugPort = lines[0].trim();
          break;
        }
      }
      await sleep(100);
    }
    if (!debugPort) throw new Error('Chrome did not expose a debugging port');

    const version = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();
    cdp = new CDP(version.webSocketDebuggerUrl);
    await cdp.connect();

    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (method, params = {}) => cdp.send(method, params, sessionId);
    const evalJS = async (expression, awaitPromise = false) => {
      const r = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise,
      });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
      return r.result ? r.result.value : undefined;
    };

    await send('Page.enable');
    await send('Runtime.enable');
    cdp.onEvent = (msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        console.error('page exception:', d.text, d.url || '', `${d.lineNumber}:${d.columnNumber}`);
      }
    };
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send('Page.navigate', { url });

    let ready = false;
    for (let i = 0; i < 200; i++) {
      try {
        if (await evalJS('window.__ready === true')) {
          ready = true;
          break;
        }
      } catch {
        /* page still loading */
      }
      await sleep(100);
    }
    if (!ready) throw new Error('Page did not become ready');

    return {
      send,
      evalJS,
      async close() {
        try {
          await cdp.send('Browser.close');
        } catch {
          /* ignore */
        }
        cdp.close();
        if (chrome && chrome.pid) {
          if (process.platform === 'win32') {
            spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
          } else {
            chrome.kill();
          }
        }
        server.close();
        await sleep(400);
        try {
          fs.rmSync(userData, { recursive: true, force: true, maxRetries: 3 });
        } catch {
          /* ignore */
        }
      },
    };
  } catch (err) {
    if (cdp) cdp.close();
    if (chrome && chrome.pid) {
      if (process.platform === 'win32') {
            spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
          } else {
            chrome.kill();
          }
    }
    server.close();
    throw err;
  }
}

/* ---------- ffmpeg ---------- */

function startFfmpeg(outFile, { scale = 1080, crf = 18, preset = 'veryfast' } = {}) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'image2pipe',
    '-framerate',
    String(FPS),
    '-i',
    '-',
  ];
  if (scale && scale < 1080) {
    args.push('-vf', `scale=${Math.round((scale * 16) / 9)}:${scale}:flags=lanczos`);
  }
  args.push(
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-crf',
    String(crf),
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outFile
  );
  const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  ff.stderr.on('data', (d) => {
    err += d.toString();
    if (err.length > 12000) err = err.slice(-12000);
  });
  return {
    ff,
    getError: () => err,
    async write(buf) {
      if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
    },
    async finish() {
      ff.stdin.end();
      const [code] = await once(ff, 'close');
      if (code !== 0) throw new Error(`ffmpeg exited ${code}\n${err}`);
    },
  };
}

/* ---------- render primitives ---------- */

async function renderRanges(ranges, opts = {}) {
  const {
    burnIn = false,
    scale = 1080,
    crf = 18,
    label = 'render',
  } = opts;
  const totalFrames = ranges.reduce((n, r) => n + (r.end - r.start), 0);
  console.log(
    `${label}: ${ranges.length} clip(s), ${totalFrames} frames, ` +
      `ETA ~${formatEta(estimateSeconds(totalFrames))}`
  );

  const page = await launchPage();
  try {
    await page.evalJS(`window.setReviewOverlay(${burnIn ? 'true' : 'false'})`);

    for (const r of ranges) {
      const frames = r.end - r.start;
      console.log(`  clip ${r.name}: f${r.start}–f${r.end - 1} (${frames}f)`);
      const ff = startFfmpeg(r.out, { scale, crf });
      const t0 = Date.now();
      for (let f = r.start; f < r.end; f++) {
        await page.evalJS(`window.renderFrame(${f})`);
        await page.evalJS('new Promise(r => requestAnimationFrame(() => r(true)))', true);
        const shot = await page.send('Page.captureScreenshot', {
          format: 'png',
          fromSurface: true,
          captureBeyondViewport: false,
        });
        await ff.write(Buffer.from(shot.data, 'base64'));
        if ((f - r.start + 1) % 150 === 0 || f === r.end - 1) {
          const done = f - r.start + 1;
          const elapsed = (Date.now() - t0) / 1000;
          const rate = done / Math.max(0.001, elapsed);
          const eta = (frames - done) / Math.max(0.001, rate);
          console.log(
            `    ${done}/${frames}  ${rate.toFixed(1)} fps  eta ${formatEta(eta)}`
          );
        }
      }
      await ff.finish();
      const size = fs.statSync(r.out).size;
      console.log(`    wrote ${path.relative(ROOT, r.out)} (${(size / 1048576).toFixed(1)} MB)`);
    }
  } finally {
    await page.close();
  }
}

async function renderStills(stills, opts = {}) {
  const { burnIn = false } = opts;
  const page = await launchPage();
  try {
    await page.evalJS(`window.setReviewOverlay(${burnIn ? 'true' : 'false'})`);
    const written = [];
    for (const s of stills) {
      await page.evalJS(`window.renderFrame(${s.frame})`);
      await page.evalJS('new Promise(r => requestAnimationFrame(() => r(true)))', true);
      const shot = await page.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });
      fs.mkdirSync(path.dirname(s.out), { recursive: true });
      fs.writeFileSync(s.out, Buffer.from(shot.data, 'base64'));
      written.push(path.relative(ROOT, s.out));
    }
    console.log(JSON.stringify({ frames: stills.length, files: written }, null, 2));
  } finally {
    await page.close();
  }
}

/* ---------- commands ---------- */

function cmdHelp() {
  console.log(`filmctl — review and render entry point

usage:
  node main\\film\\tools\\filmctl.mjs <command> [options]

commands:
  list
      打印 6 节、15 个故事拍及章节卡、片尾条目，含 start / end / dur / layout。

  check
      校验总长、beat 连续性、字幕速度与两行槽位；不渲图。

  qa --beat <id> --frames <local,...> [--burn-in] [--out <dir>]
      渲 beat 内指定 local 帧的静帧。默认 qa/beats/。

  clip --beat <id> [--no-burn-in] [--scale 1080|720] [--out <file>]
      渲单个 beat 的视频。默认带 burn-in，out/clips/。

  review --all
  review --sections S0,S1,... [--no-burn-in] [--scale 1080|720] [--outdir <dir>]
      渲章节审阅片段。默认 out/review/，带 burn-in。

  render [--out <file>]
      渲全片 1920×1080 / 30fps，无 burn-in。默认 out/rank_and_nullity_1080p.mp4。

  help
      这张说明。

examples:
  node main\\film\\tools\\filmctl.mjs review --sections S0
  node main\\film\\tools\\filmctl.mjs clip --beat S0/H2
  node main\\film\\tools\\filmctl.mjs qa --beat S1/C1B2 --frames 0,120,240 --burn-in

notes:
  - beat id / duration 的唯一入口是 src/manifest.js。
  - 长任务开头会打印 ETA；每 150 帧打印进度。
  - burn-in 在左下角：S1/C1B2 local 0120/0660 f1374 · 0:45.8。
`);
}

function cmdList() {
  console.log(
    `${'id'.padEnd(12)} ${'section'.padEnd(7)} ${'start'.padStart(5)} ${'end'.padStart(5)} ${'dur'.padStart(4)}  layout  label`
  );
  for (const b of TIMELINE.beats) {
    console.log(
      `${b.id.padEnd(12)} ${b.section.padEnd(7)} ${String(b.start).padStart(5)} ${String(b.end - 1).padStart(5)} ${String(b.dur).padStart(4)}  ${String(b.layout).padEnd(6)}  ${b.label}`
    );
  }
  console.log(
    `total: ${TOTAL_FRAMES} frames / ${(TOTAL_FRAMES / FPS).toFixed(1)} s / ${TIMELINE.sections.length} sections`
  );
}

function subtitleChars(text) {
  return text
    .replace(/[\s，。！？、；：""''（）《》〈〉·—…,.!?;:'"()\[\]{}]/g, '')
    .length;
}

function cmdCheck() {
  let ok = true;
  const warnings = [];

  if (TOTAL_FRAMES !== 5400) {
    ok = false;
    warnings.push(`total is ${TOTAL_FRAMES}, expected 5400`);
  }

  const ids = new Set();
  for (const b of TIMELINE.beats) {
    if (ids.has(b.id)) warnings.push(`duplicate beat id ${b.id}`);
    ids.add(b.id);
    if (b.dur <= 0) warnings.push(`${b.id} has non-positive duration`);
  }

  for (const t of TIMELINE.transitions) {
    if (t.at < 0 || t.at + t.dur > TOTAL_FRAMES) {
      ok = false;
      warnings.push(`transition at f${t.at} out of range`);
    }
  }

  const speeds = [];
  for (const s of ALL_SUBS) {
    const chars = subtitleChars(s.text);
    const seconds = (s.end - s.start) / FPS;
    const cps = chars / Math.max(0.001, seconds);
    speeds.push({ ...s, chars, cps });
    if (s.start < 0 || s.end > TOTAL_FRAMES || s.end <= s.start) {
      ok = false;
      warnings.push(`bad subtitle range ${s.start}–${s.end}: ${s.text}`);
    }
    if (cps > 3.6) warnings.push(`fast subtitle ${cps.toFixed(2)} c/s: ${s.text}`);
    if (cps < 2.0) warnings.push(`slow subtitle ${cps.toFixed(2)} c/s: ${s.text}`);
  }

  let maxActive = 0;
  const events = [];
  for (const s of ALL_SUBS) {
    events.push([s.start, 1]);
    events.push([s.end, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let active = 0;
  for (const [, d] of events) {
    active += d;
    maxActive = Math.max(maxActive, active);
  }
  if (maxActive > 2) warnings.push(`subtitle active lines peak at ${maxActive}`);
  const totalChars = speeds.reduce((n, s) => n + s.chars, 0);

  const storyBeats = TIMELINE.beats.filter(b => !b.id.includes('CARD') && !b.id.endsWith('/RESERVE')).length;
  console.log(`story beats: ${storyBeats}; timeline entries: ${TIMELINE.beats.length} (including cards and credits)`);
  console.log(`sections: ${TIMELINE.sections.length}`);
  console.log(`total: ${TOTAL_FRAMES} frames / ${(TOTAL_FRAMES / FPS).toFixed(1)} s`);
  console.log(`subtitles: ${ALL_SUBS.length} entries / ${totalChars} chars / peak ${maxActive} lines`);

  const worst = [...speeds].sort((a, b) => b.cps - a.cps).slice(0, 6);
  console.log('fastest subtitles:');
  for (const s of worst) {
    console.log(
      `  ${fmtTime(s.start)}–${fmtTime(s.end)}  ${s.cps.toFixed(2)} c/s  ${s.text}`
    );
  }

  if (warnings.length) {
    console.log(`warnings (${warnings.length}):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  console.log(ok && warnings.length === 0 ? 'OK' : ok ? 'OK with warnings' : 'FAILED');
  if (!ok) process.exitCode = 1;
}

function parseBeatId(raw) {
  if (!raw) return null;
  const b = beatById(raw) || TIMELINE.beats.find((x) => x.id.toLowerCase() === raw.toLowerCase());
  if (!b) throw new Error(`unknown beat: ${raw}`);
  return b;
}

async function cmdQa() {
  const beat = parseBeatId(argValue('--beat'));
  if (!beat) throw new Error('qa needs --beat <id>');
  const rawFrames = argValue('--frames', '0');
  const frames = rawFrames
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  if (!frames.length) throw new Error('qa needs --frames 0,120,...');
  const outDir = path.resolve(ROOT, argValue('--out', 'qa/beats'));
  const burnIn = hasFlag('--burn-in');

  const stills = frames.map((local) => {
    const lf = Math.max(0, Math.min(beat.dur - 1, local | 0));
    const global = beat.start + lf;
    return {
      frame: global,
      out: path.join(outDir, `${safeName(beat.id)}_${pad4(lf)}.png`),
      local: lf,
      global,
    };
  });

  console.log(
    `qa: ${stills.length} still(s) from ${beat.id} (${beat.start}–${beat.end - 1})` +
      (burnIn ? ' · burn-in' : '')
  );
  await renderStills(stills, { burnIn });
}

async function cmdClip() {
  const beat = parseBeatId(argValue('--beat'));
  if (!beat) throw new Error('clip needs --beat <id>');
  const scale = Number(argValue('--scale', '1080'));
  const burnIn = !hasFlag('--no-burn-in');
  const out = path.resolve(
    ROOT,
    argValue('--out', `out/clips/${safeName(beat.id)}.mp4`)
  );
  await renderRanges([{ name: beat.id, start: beat.start, end: beat.end, out }], {
    burnIn,
    scale,
    crf: 18,
    label: `clip ${beat.id}`,
  });
}

async function cmdReview() {
  const all = hasFlag('--all') || !argValue('--sections');
  const raw = argValue('--sections', '');
  const ids = all ? TIMELINE.sections.map((s) => s.id) : raw.split(',').map((s) => s.trim());
  const scale = Number(argValue('--scale', '1080'));
  const burnIn = !hasFlag('--no-burn-in');
  const outDir = path.resolve(ROOT, argValue('--outdir', 'out/review'));

  const ranges = [];
  for (const id of ids) {
    const s = sectionById(id);
    if (!s) throw new Error(`unknown section: ${id}`);
    ranges.push({
      name: s.id,
      start: s.start,
      end: s.end,
      out: path.join(outDir, `${s.id}_${s.slug || safeName(s.title)}.mp4`),
    });
  }

  await renderRanges(ranges, {
    burnIn,
    scale,
    crf: 18,
    label: `review ${ids.join(',')}`,
  });
}

async function cmdRender() {
  const out = path.resolve(ROOT, argValue('--out', 'out/rank_and_nullity_1080p.mp4'));
  await renderRanges([{ name: 'film', start: 0, end: TOTAL_FRAMES, out }], {
    burnIn: false,
    scale: 1080,
    crf: 17,
    label: 'final film',
  });
}

/* ---------- main ---------- */

const rawCmd = process.argv[2] || 'list';
const cmd = rawCmd === '--help' || rawCmd === '-h' ? 'help' : rawCmd;
const commands = {
  help: cmdHelp,
  list: cmdList,
  check: cmdCheck,
  qa: cmdQa,
  clip: cmdClip,
  review: cmdReview,
  render: cmdRender,
};

const fn = commands[cmd];
if (!fn) {
  console.error(`unknown command: ${cmd}`);
  console.error('commands: help, list, check, qa, clip, review, render');
  process.exit(1);
}
Promise.resolve(fn()).catch((err) => {
  console.error(err);
  process.exit(1);
});
