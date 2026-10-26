'use strict';

import {
  COLORS,
  FONT_CN,
  FONT_MONO,
  H,
  TOTAL,
  W,
  clear,
  fadeOverlay,
  roundRect,
  smoothstep,
} from './core.js';
import { drawFrame, drawSection } from './sections.js';
import { beatAt, fmtTime, sectionAt, transitionAt } from './manifest.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });

/* Two offscreen canvases are used only at beat boundaries, to turn the
   remaining hard cuts into a short crossfade. */
const bufA = document.createElement('canvas');
const bufB = document.createElement('canvas');
bufA.width = W;
bufA.height = H;
bufB.width = W;
bufB.height = H;
const actxA = bufA.getContext('2d', { alpha: false });
const actxB = bufB.getContext('2d', { alpha: false });

let reviewOverlay = false;
window.setReviewOverlay = (on) => {
  reviewOverlay = !!on;
};

window.addEventListener('error', (e) => {
  window.__pageError = e.message || String(e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  window.__pageError = String(e.reason);
});

function pad4(n) {
  return String(Math.max(0, n | 0)).padStart(4, '0');
}

function drawBurnIn(ctx, f) {
  if (!reviewOverlay) return;
  const b = beatAt(f);
  if (!b) return;
  const tr = transitionAt(f);
  const local = f - b.start;
  const x = 48;
  const y = 858;
  const w = 650;
  const h = 34;

  ctx.save();
  roundRect(ctx, x, y, w, h, 6);
  ctx.fillStyle = 'rgba(7,10,15,0.8)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(95,214,242,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let tx = x + 14;
  const ty = y + 17;

  ctx.font = `600 19px ${FONT_MONO}`;
  ctx.fillStyle = 'rgba(255,180,84,0.96)';
  const idText = `${b.section}/${b.id.split('/')[1]}`;
  ctx.fillText(idText, tx, ty);
  tx += ctx.measureText(idText).width + 14;

  ctx.font = `500 16px ${FONT_MONO}`;
  ctx.fillStyle = 'rgba(238,242,247,0.92)';
  const localText = `local ${pad4(local)}/${pad4(b.dur)}`;
  ctx.fillText(localText, tx, ty);
  tx += ctx.measureText(localText).width + 14;

  ctx.font = `400 14px ${FONT_MONO}`;
  ctx.fillStyle = 'rgba(147,164,184,0.9)';
  const globalText = `f${pad4(f)} · ${fmtTime(f)}`;
  ctx.fillText(globalText, tx, ty);
  tx += ctx.measureText(globalText).width + 14;

  if (tr) {
    ctx.font = `500 14px ${FONT_MONO}`;
    ctx.fillStyle = 'rgba(255,180,84,0.95)';
    ctx.fillText(`T ${tr.type}`, tx, ty);
  }
  ctx.restore();
}

window.renderFrame = (frame) => {
  const f = Math.max(0, Math.min(TOTAL - 1, frame | 0));
  const tr = transitionAt(f);

  if (tr && tr.type === 'dip') {
    const half = tr.dur / 2;
    if (f < tr.at + half) {
      drawFrame(ctx, tr.at - 1);
      fadeOverlay(ctx, smoothstep((f - tr.at) / half));
    } else {
      drawFrame(ctx, f);
      fadeOverlay(ctx, 1 - smoothstep((f - tr.at - half) / half));
    }
    drawBurnIn(ctx, f);
    return;
  }

  if (tr && tr.type === 'crossfade') {
    const t = smoothstep((f - tr.at) / tr.dur);
    clear(actxA);
    drawSection(actxA, tr.at - 1);
    clear(actxB);
    drawSection(actxB, f);
    clear(ctx);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.drawImage(bufA, 0, 0);
    ctx.globalAlpha = t;
    ctx.drawImage(bufB, 0, 0);
    ctx.restore();
    drawBurnIn(ctx, f);
    return;
  }

  drawFrame(ctx, f);
  drawBurnIn(ctx, f);
};

(async () => {
  try {
    await document.fonts.load('400 40px "Microsoft YaHei UI"');
    await document.fonts.load('500 48px "Microsoft YaHei UI"');
    await document.fonts.load('400 30px "Cambria Math"');
    await document.fonts.load('italic 400 56px "Cambria Math"');
    await document.fonts.load('400 22px "Cascadia Mono"');
  } catch {
    /* system fonts are fine */
  }
  await document.fonts.ready;
  window.renderFrame(0);
  requestAnimationFrame(() => {
    window.__ready = true;
  });
})();
