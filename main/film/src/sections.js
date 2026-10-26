'use strict';

/* ============================================================
   sections — S0..S5 scene states, driven by absolute frame f.
   Everything is a pure function of f.
   ============================================================ */

import {
  COLORS,
  FONT_CN,
  FONT_MONO,
  clamp,
  clear,
  dimBracket,
  drawText,
  drawTextLines,
  easeInOut,
  fadeOverlay,
  label3,
  lerp,
  lerp3,
  line2,
  line3,
  makeCamera,
  mix,
  point3,
  progress,
  smoothstep,
  windowAlpha,
  withClip,
} from './core.js';

import {
  drawAxes,
  drawBasis,
  drawCollapsedStage,
  drawColumns,
  drawCodaStageV2,
  drawCube,
  drawFullCube,
  drawGap,
  drawGhostDomain,
  drawImageSheet,
  drawKernelCube,
  drawKernelLine,
  drawKernelPlane,
  drawParallelogram,
  drawPlane,
  drawPointArrow,
  drawQGrid,
} from './stage.js';

import {
  drawChapterCard,
  drawExtraCard,
  drawMatrixCard,
  drawMiniMatrix,
  drawPromiseCard,
  drawQuestionCard,
  drawStamp,
  drawSubtitles,
  drawTable,
  drawTheoremCard,
  drawTitleCard,
  drawTracker,
} from './ui.js';

import { CREDITS, QUESTIONS, SUBS, TABLE_COLUMNS } from './data.js';

import {
  A,
  B_IN,
  B_OUT,
  B_PREIMAGE,
  B_TARGET,
  J,
  KERNEL_DIR,
  applyA,
  applyB,
  applyJ,
  applyJPow,
  invB,
} from './math.js';

/* ---------- cameras ---------- */

export const CAM = {
  // S0/S1/S2 share yaw 78; the coda still uses its own 65.
  L1: () => makeCamera({ cx: 648, cy: 474, scale: 145, yaw: 78, pitch: 30 }),
  L2: () => makeCamera({ cx: 960, cy: 500, scale: 120, yaw: 78, pitch: 30 }),
  L3: () => makeCamera({ cx: 960, cy: 500, scale: 120, yaw: 78, pitch: 30 }),
  L5L: () => makeCamera({ cx: 492, cy: 478, scale: 150, yaw: 65, pitch: 30 }),
  L5R: () => makeCamera({ cx: 1428, cy: 478, scale: 150, yaw: 65, pitch: 30 }),
};

const subs = (ctx, f, key) => drawSubtitles(ctx, f, SUBS[key]);

function stageBase(ctx, cam, { alpha = 1, kernelAlpha = 0 } = {}) {
  drawGhostDomain(ctx, cam, { alpha: 0.12 * alpha });
  drawPlane(ctx, cam, { alpha: 0.145 * alpha, size: 3.0 });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: 0.24 * alpha,
    pointAlpha: 0.05 * alpha,
    transform: applyA,
    tint: 0.88,
    lineWidth: 1,
  });
  drawAxes(ctx, cam, { alpha: 0.58 * alpha, length: 2.5, labels: true, width: 1.7 });
  if (kernelAlpha > 0.001) {
    drawKernelLine(ctx, cam, { alpha: kernelAlpha * alpha, width: 1.6 });
  }
}

/* ============================================================
   S0 — Hook
   ============================================================ */

function s0H1(ctx, f) {
  const cam = CAM.L1();
  const grow = smoothstep(clamp(f / 55));
  const u = smoothstep(clamp((f - 120) / 90));
  const planeA = 0.145 * smoothstep((f - 195) / 20);

  if (u > 0.001) drawGhostDomain(ctx, cam, { alpha: 0.13 * u });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: 0.44 * (0.35 + 0.65 * grow),
    pointAlpha: 0.92 * grow,
    pointRadius: 1.75,
    transform: (p) => lerp3(p, applyA(p), u),
    tint: 0.9 * u,
    kernelTint: u,
    lineWidth: 1.15,
  });
  drawAxes(ctx, cam, { alpha: 0.74 * grow, length: 2.5, labels: true, width: 2.2 });
  drawPlane(ctx, cam, { alpha: planeA, size: 3.0 });
  drawKernelLine(ctx, cam, {
    alpha: 0.72 * smoothstep((f - 120) / 10),
    length: 3.0,
    width: 1.6,
  });
  const kernelDotsA = smoothstep((f - 120) / 10) * (1 - smoothstep((f - 195) / 25));
  if (kernelDotsA > 0.001) {
    const ts = [-1.6, -1.05, -0.55, 0, 0.55, 1.05, 1.6];
    ts.forEach((t, i) => {
      const p = [
        KERNEL_DIR[0] * t * (1 - u),
        KERNEL_DIR[1] * t * (1 - u),
        KERNEL_DIR[2] * t * (1 - u),
      ];
      const a = kernelDotsA * (i === 3 ? 0.95 : 0.82);
      point3(ctx, p, cam, 3.6, COLORS.cyan, a);
      point3(ctx, p, cam, 10, COLORS.cyan, a * 0.15);
    });
  }
  if (u > 0.55) {
    point3(ctx, [0, 0, 0], cam, 3.2, COLORS.cyan, 0.75 * u);
    point3(ctx, [0, 0, 0], cam, 10, COLORS.cyan, 0.1 * u);
  }
  drawMatrixCard(ctx, {
    kind: 'A',
    alpha: 0.94,
    equation: 'Ax = b',
    bLabel: 'b',
    bColor: COLORS.amber,
    showEquation: false,
  });
  subs(ctx, f, 's0');
}

/* H1→H2: move the collapsed left stage to the center while fading its
   brightness to the H2 stage level. No dip, no double exposure. */
function s0Shift(ctx, f) {
  const t = smoothstep(clamp((f - 270) / 30));
  const cam = makeCamera({
    cx: lerp(648, 960, t),
    cy: lerp(474, 500, t),
    scale: lerp(145, 120, t),
    yaw: 78,
    pitch: 30,
  });
  drawGhostDomain(ctx, cam, { alpha: lerp(0.13, 0.0858, t) });
  drawPlane(ctx, cam, { alpha: lerp(0.145, 0.078, t), size: 3.0 });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: lerp(0.44, 0.156, t),
    pointAlpha: lerp(0.92, 0.03, t),
    pointRadius: lerp(1.75, 1.55, t),
    transform: applyA,
    tint: 0.9,
    kernelTint: 1,
    lineWidth: lerp(1.15, 1, t),
  });
  drawAxes(ctx, cam, {
    alpha: lerp(0.74, 0.42, t),
    length: 2.5,
    labels: true,
    width: lerp(2.2, 1.4, t),
  });
  drawKernelLine(ctx, cam, {
    alpha: lerp(0.72, 0.3276, t),
    length: 3.0,
    width: lerp(1.6, 1.4, t),
  });
  drawColumns(ctx, cam, {
    alpha: lerp(0, 0.117, t),
    labels: false,
    width: 1.6,
  });
  point3(ctx, [0, 0, 0], cam, 3.2, COLORS.cyan, 0.75 * (1 - t));
  drawMatrixCard(ctx, {
    kind: 'A',
    alpha: 0.94 * (1 - t),
    equation: 'Ax = b',
    bLabel: 'b',
    bColor: COLORS.amber,
    showEquation: false,
  });
  if (f >= 294) {
    const qa = smoothstep((f - 294) / 6);
    drawQuestionCard(ctx, QUESTIONS[0], 96, 96, 420, 150, qa, 1, false);
  }
  subs(ctx, f, 's0');
}

function s0H2(ctx, f) {
  const cam = CAM.L2();
  const stageA = 0.78;
  drawGhostDomain(ctx, cam, { alpha: 0.11 * stageA });
  drawPlane(ctx, cam, { alpha: 0.1 * stageA, size: 3.0 });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: 0.2 * stageA,
    pointAlpha: 0.03,
    transform: applyA,
    tint: 0.88,
  });
  drawAxes(ctx, cam, { alpha: 0.42, length: 2.4, labels: true, width: 1.4 });
  drawKernelLine(ctx, cam, { alpha: 0.42 * stageA, width: 1.4 });
  drawColumns(ctx, cam, { alpha: 0.15 * stageA, labels: false, width: 1.6 });

  const mx = 1 - smoothstep((f - 270) / 30);
  drawMatrixCard(ctx, {
    kind: 'A',
    alpha: mx,
    equation: 'Ax = b',
    bLabel: 'b',
    bColor: COLORS.amber,
  });

  const qpos = [
    [96, 96],
    [1404, 96],
    [96, 620],
    [1404, 620],
  ];
  QUESTIONS.forEach((q, i) => {
    const start = 300 + i * 30;
    const a = i === 0 ? 1 : windowAlpha(f, start, 540, 10, 0);
    drawQuestionCard(ctx, q, qpos[i][0], qpos[i][1], 420, 150, a, 1, false);
  });
  subs(ctx, f, 's0');
}

function s0H3(ctx, f) {
  const promiseA = windowAlpha(f, 540, 648, 24, 24);
  const cam = CAM.L2();
  const a = 0.78;
  drawGhostDomain(ctx, cam, { alpha: 0.11 * a });
  drawPlane(ctx, cam, { alpha: 0.1 * a, size: 3.0 });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: 0.2 * a,
    pointAlpha: 0.03,
    transform: applyA,
    tint: 0.88,
  });
  drawAxes(ctx, cam, { alpha: 0.42, length: 2.4, labels: true, width: 1.4 });
  drawKernelLine(ctx, cam, { alpha: 0.42 * a, width: 1.4 });
  drawColumns(ctx, cam, { alpha: 0.15 * a, labels: false, width: 1.6 });
  const qpos = [
    [96, 96],
    [1404, 96],
    [96, 620],
    [1404, 620],
  ];
  QUESTIONS.forEach((q, i) => {
    drawQuestionCard(ctx, q, qpos[i][0], qpos[i][1], 420, 150, 1, 1, false);
  });
  drawPromiseCard(ctx, promiseA);
  subs(ctx, f, 's0');
}

function s0H4(ctx, f) {
  const cam = CAM.L3();
  drawGhostDomain(ctx, cam, { alpha: 0.075 });
  drawAxes(ctx, cam, { alpha: 0.08, labels: false });
  drawPlane(ctx, cam, { alpha: 0.075, size: 3.0 });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: 0.09,
    pointAlpha: 0.02,
    transform: applyA,
    tint: 0.88,
  });
  drawKernelLine(ctx, cam, { alpha: 0.17, width: 1.3 });
  const g = ctx.createRadialGradient(960, 500, 90, 960, 500, 560);
  g.addColorStop(0, 'rgba(7,10,15,0.86)');
  g.addColorStop(0.6, 'rgba(7,10,15,0.58)');
  g.addColorStop(1, 'rgba(7,10,15,0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(300, 120, 1320, 760);
  ctx.restore();
  drawTitleCard(ctx, windowAlpha(f, 744, 840, 20, 6));
}

export function drawS0(ctx, f) {
  if (f < 270) s0H1(ctx, f);
  else if (f < 540) s0H2(ctx, f);
  else if (f < 720) s0H3(ctx, f);
  else if (f < 840) s0H4(ctx, f);
  else drawChapterCard(ctx, 0, windowAlpha(f, 840, 894, 12, 6));
}

/* ============================================================
   S1 — two halves
   ============================================================ */

function s1Base(
  ctx,
  f,
  {
    imageGridAlpha = 0.24,
    pointAlpha = 0.05,
    ghostAlpha = 0.12,
    planeAlpha = 0.145,
    planeStrokeAlpha = null,
    planeStrokeWidth = 1,
    kernelAlpha = null,
    kernelWidth = 1.6,
    kernelLength = 3.0,
    origin = false,
  } = {}
) {
  const cam = CAM.L1();
  drawGhostDomain(ctx, cam, { alpha: ghostAlpha });
  drawPlane(ctx, cam, {
    alpha: planeAlpha,
    size: 3.0,
    strokeAlpha: planeStrokeAlpha,
    strokeWidth: planeStrokeWidth,
  });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: imageGridAlpha,
    pointAlpha,
    transform: applyA,
    tint: 0.88,
  });
  drawAxes(ctx, cam, { alpha: 0.72, length: 2.5, labels: true, width: 1.9 });
  const kA = kernelAlpha === null ? 0.72 * smoothstep((f - 990) / 55) : kernelAlpha;
  drawKernelLine(ctx, cam, { alpha: kA, width: kernelWidth, length: kernelLength });
  if (origin) {
    point3(ctx, [0, 0, 0], cam, 3.4, COLORS.cyan, 0.9);
    point3(ctx, [0, 0, 0], cam, 10, COLORS.cyan, 0.14);
  }
  return cam;
}

function s1C1B1(ctx, f) {
  const imgA = smoothstep((f - 965) / 30);
  const kerA = smoothstep((f - 1060) / 30);
  const labelA = smoothstep((f - 965) / 12);
  const labelK = smoothstep((f - 1060) / 12);
  const cam = s1Base(ctx, f, {
    imageGridAlpha: 0.44,
    pointAlpha: 0.9,
    planeAlpha: 0.145 + 0.255 * imgA,
    planeStrokeAlpha: 0.12 + 0.6 * imgA,
    planeStrokeWidth: 1 + 0.8 * imgA,
    kernelAlpha: 0.72 + 0.23 * kerA,
    kernelWidth: 1.6 + 1.4 * kerA,
    kernelLength: 3.0 + 1.0 * kerA,
    origin: true,
  });

  if (labelA > 0.001) {
    label3(ctx, '像', [3.15, 2.9, 0], cam, {
      dx: -18,
      dy: 42,
      size: 30,
      color: COLORS.amber,
      alpha: labelA,
    });
  }
  if (labelK > 0.001) {
    label3(ctx, '零空间', [-1.35, -1.35, 1.35], cam, {
      dx: -56,
      dy: -14,
      size: 28,
      color: COLORS.cyan,
      alpha: labelK,
      align: 'right',
    });
  }

  const lx = 1320;
  if (labelA > 0.001) {
    drawText(ctx, '像', lx, 448, {
      size: 34,
      color: COLORS.amber,
      alpha: labelA,
      align: 'left',
    });
    drawText(ctx, 'Im A', lx + 46, 448, {
      size: 34,
      family: FONT_MONO,
      color: COLORS.amber,
      alpha: labelA * 0.9,
      align: 'left',
    });
  }
  if (labelK > 0.001) {
    drawText(ctx, '零空间', lx, 522, {
      size: 34,
      color: COLORS.cyan,
      alpha: labelK,
      align: 'left',
    });
    drawText(ctx, 'Ker A', lx + 118, 522, {
      size: 34,
      family: FONT_MONO,
      color: COLORS.cyan,
      alpha: labelK * 0.9,
      align: 'left',
    });
  }

  drawTracker(ctx, {
    state: 'docked',
    answers: [false, false, false, false],
    alpha: 1,
  });
  subs(ctx, f, 's1');
}

function s1C1B2(ctx, f) {
  const cam = s1Base(ctx, f);
  const a = smoothstep((f - 1218) / 45);
  const labelA = 1;

  label3(ctx, '像', [1.55, 1.25, 0], cam, {
    dx: 28,
    dy: -12,
    size: 34,
    color: COLORS.amber,
    alpha: labelA,
  });
  label3(ctx, 'dim 2', [1.55, 1.25, 0], cam, {
    dx: 28,
    dy: 24,
    size: 24,
    family: FONT_MONO,
    color: COLORS.amber,
    alpha: a * 0.9,
  });
  label3(ctx, '零空间（零空间）', [-1.05, -1.05, 1.05], cam, {
    dx: -24,
    dy: -10,
    size: 30,
    color: COLORS.cyan,
    alpha: labelA,
    align: 'right',
  });
  label3(ctx, 'dim 1', [-1.05, -1.05, 1.05], cam, {
    dx: -24,
    dy: 24,
    size: 24,
    family: FONT_MONO,
    color: COLORS.cyan,
    alpha: a * 0.9,
    align: 'right',
  });

  drawStamp(ctx, '秩 = 2', 96, 112, { color: COLORS.amber, alpha: a, size: 40 });
  drawStamp(ctx, '零度 = 1', 96, 176, { color: COLORS.cyan, alpha: a, size: 40 });
  drawTracker(ctx, {
    state: 'docked',
    answers: [true, false, false, false],
    alpha: 1,
  });
  subs(ctx, f, 's1');
}

function s1C1B3(ctx, f) {
  const colA = smoothstep((f - 1518) / 55);
  const cam = s1Base(ctx, f, {
    imageGridAlpha: 0.24 * (1 - 0.58 * colA),
    ghostAlpha: 0.12 * (1 - 0.35 * colA),
  });
  const paraA = smoothstep((f - 1578) / 45);
  const basisA = 0.32 * (1 - 0.55 * colA);

  drawBasis(ctx, cam, {
    alpha: basisA,
    labels: false,
    width: 1.4,
    color: COLORS.ink,
  });
  drawColumns(ctx, cam, {
    alpha: colA,
    labels: true,
    width: 2.8,
    color: COLORS.amber,
  });
  if (paraA > 0.001) {
    drawParallelogram(ctx, cam, {
      alpha: 0.17 * paraA,
      strokeAlpha: 0.85 * paraA,
      diagonalAlpha: 0.85 * paraA,
      label: false,
    });
  }

  if (f >= 1578) {
    const eqA = smoothstep((f - 1578) / 35);
    drawText(ctx, 'a₁ + a₂ − a₃ = 0', 96, 112, {
      size: 36,
      family: FONT_MONO,
      style: 'normal',
      color: COLORS.amber,
      alpha: eqA,
      align: 'left',
    });
    drawText(ctx, '线性相关', 96, 166, {
      size: 26,
      color: COLORS.dim,
      alpha: eqA,
      align: 'left',
    });
  }

  if (f >= 1722) {
    const kA = smoothstep((f - 1722) / 35);
    label3(ctx, '(1, 1, −1)', [0.95, 0.95, -0.95], cam, {
      dx: 22,
      dy: 22,
      size: 24,
      family: FONT_MONO,
      color: COLORS.cyan,
      alpha: kA,
    });
    label3(ctx, '零空间方向', [0.95, 0.95, -0.95], cam, {
      dx: 22,
      dy: -8,
      size: 26,
      color: COLORS.cyan,
      alpha: kA,
    });
  }

  if (f >= 1806) {
    const bA = smoothstep((f - 1806) / 35);
    drawPointArrow(ctx, cam, {
      p: B_OUT,
      color: COLORS.red,
      alpha: 0.42 * bA,
      width: 1.7,
      label: 'b′',
      labelSize: 30,
      labelDx: 18,
      labelDy: -16,
      dotRadius: 3.4,
    });
  }

  drawTracker(ctx, {
    state: 'docked',
    answers: [true, f >= 1878, false, false],
    alpha: 1,
  });
  subs(ctx, f, 's1');
}

function rightLabel(ctx, xRight, y, parts, alpha, gap = 10) {
  const widths = parts.map((p) => {
    ctx.save();
    ctx.font = `400 ${p.size || 34}px ${p.family || FONT_CN}`;
    const w = ctx.measureText(p.t).width;
    ctx.restore();
    return w;
  });
  const total = widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
  let cx = xRight - total;
  parts.forEach((p, i) => {
    drawText(ctx, p.t, cx, y, {
      size: p.size || 34,
      family: p.family || FONT_CN,
      color: p.c,
      alpha,
      align: 'left',
    });
    cx += widths[i] + gap;
  });
}

function formulaPieces(ctx, x, y, pieces, alpha, size = 24) {
  let cx = x;
  for (const p of pieces) {
    drawText(ctx, p.t, cx, y, {
      size,
      family: FONT_MONO,
      style: 'normal',
      color: p.c,
      alpha,
      align: 'left',
    });
    ctx.save();
    ctx.font = `400 ${size}px ${FONT_MONO}`;
    cx += ctx.measureText(p.t).width;
    ctx.restore();
  }
}

function tokenFlyRoute(
  ctx,
  text,
  points,
  t,
  color,
  alpha = 1,
  family = FONT_MONO,
  size0 = 34
) {
  const e = smoothstep(clamp(t));
  const segs = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1][0] - points[i][0];
    const dy = points[i + 1][1] - points[i][1];
    const len = Math.hypot(dx, dy);
    segs.push({ a: points[i], b: points[i + 1], len });
    total += len;
  }
  let dist = total * e;
  let x = points[0][0];
  let y = points[0][1];
  for (const s of segs) {
    if (dist <= s.len) {
      const k = s.len > 0 ? dist / s.len : 0;
      x = lerp(s.a[0], s.b[0], k);
      y = lerp(s.a[1], s.b[1], k);
      break;
    }
    dist -= s.len;
    x = s.b[0];
    y = s.b[1];
  }
  const size = lerp(size0, 20, e);
  if (alpha <= 0.001) return;
  drawText(ctx, text, x, y, {
    size,
    family,
    color,
    alpha,
    align: 'left',
  });
}

/* New S1 v2: C1B1 merges naming + dims; C1B2 is the vector beat. */
function s1C1B1v2(ctx, f) {
  const focusOut = 1 - smoothstep((f - 1195) / 25);
  const faceFocus = smoothstep((f - 955) / 30) * (1 - smoothstep((f - 1045) / 30));
  const kerA = smoothstep((f - 1045) / 30) * focusOut;
  const labelA = smoothstep((f - 955) / 12) * focusOut;
  const labelK = smoothstep((f - 1045) / 12) * focusOut;
  const cam = s1Base(ctx, f, {
    imageGridAlpha: 0.44,
    pointAlpha: 0.9,
    planeAlpha: 0.145 + 0.255 * faceFocus,
    planeStrokeAlpha: 0.12 + 0.6 * faceFocus,
    planeStrokeWidth: 1 + 0.8 * faceFocus,
    kernelAlpha: 0.72 + 0.23 * kerA,
    kernelWidth: 1.6 + 1.4 * kerA,
    kernelLength: 3.0 + 1.0 * kerA,
    origin: true,
  });

  if (labelA > 0.001) {
    label3(ctx, '像', [3.15, 2.9, 0], cam, {
      dx: -18,
      dy: 42,
      size: 30,
      color: COLORS.amber,
      alpha: labelA,
    });
  }
  if (labelK > 0.001) {
    label3(ctx, '零空间', [-1.35, -1.35, 1.35], cam, {
      dx: -56,
      dy: -14,
      size: 28,
      color: COLORS.cyan,
      alpha: labelK,
      align: 'right',
    });
  }

  if (labelA > 0.001) {
    rightLabel(
      ctx,
      1680,
      448,
      [
        { t: '像', c: COLORS.amber },
        { t: 'Im A', c: COLORS.amber, family: FONT_MONO },
      ],
      labelA
    );
    drawText(ctx, '秩 2', 1700, 448, {
      size: 34,
      color: COLORS.amber,
      alpha: labelA * 0.9,
      align: 'left',
    });
  }
  if (labelK > 0.001) {
    rightLabel(
      ctx,
      1680,
      522,
      [
        { t: '零空间', c: COLORS.cyan },
        { t: 'Ker A', c: COLORS.cyan, family: FONT_MONO },
      ],
      labelK
    );
    drawText(ctx, '零度 1', 1700, 522, {
      size: 34,
      color: COLORS.cyan,
      alpha: labelK * 0.9,
      align: 'left',
    });
  }

  drawTracker(ctx, {
    state: 'docked',
    answers: [f >= 1240, false, false, false],
    alpha: 1,
  });

  if (f >= 1195 && f < 1205) {
    drawText(ctx, '2+1', 1855, 560, {
      size: 34,
      family: FONT_MONO,
      color: COLORS.amber,
      alpha: smoothstep((f - 1195) / 10),
      align: 'left',
    });
  } else if (f >= 1205 && f < 1241) {
    tokenFlyRoute(
      ctx,
      '2+1',
      [
        [1855, 560],
        [1200, 560],
        [1200, 118],
        [1366, 118],
      ],
      (f - 1205) / 35,
      COLORS.amber
    );
  }

  subs(ctx, f, 's1');
}

function s1C1B2v2(ctx, f) {
  const resetA = smoothstep((f - 1254) / 30);
  const b1Out = 1 - smoothstep((f - 1254) / 20);
  const u = smoothstep((f - 1284) / 60);
  const relationA = smoothstep((f - 1429) / 30) * (1 - smoothstep((f - 1804) / 20));
  const formulaA = smoothstep((f - 1609) / 20) * (1 - smoothstep((f - 1804) / 20));
  const cam = CAM.L1();

  drawGhostDomain(ctx, cam, { alpha: 0.13 });
  drawPlane(ctx, cam, { alpha: 0.145, size: 3.0 });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: 0.44 * b1Out,
    pointAlpha: 0.9 * b1Out,
    transform: applyA,
    tint: 0.9,
    lineWidth: 1.15,
  });
  drawKernelLine(ctx, cam, { alpha: 0.72 * b1Out, length: 3.0, width: 1.6 });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: 0.44 * resetA * (1 - 0.55 * u),
    pointAlpha: 0.9 * resetA * (1 - 0.65 * u),
    transform: (p) => lerp3(p, applyA(p), u),
    tint: 0.9,
    lineWidth: 1.15,
  });
  drawAxes(ctx, cam, { alpha: 0.74, length: 2.5, labels: true, width: 2.1 });
  const basisVecs = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const eLabelsA = resetA * (1 - smoothstep((u - 0.35) / 0.2));
  const aLabelsA = smoothstep((u - 0.55) / 0.2);
  basisVecs.forEach((e0, i) => {
    const p = lerp3(e0, applyA(e0), u);
    const color = mix(COLORS.ink, COLORS.amber, smoothstep(u));
    drawPointArrow(ctx, cam, {
      p,
      color,
      alpha: resetA,
      width: 2.2 + 0.7 * u,
      dotRadius: 3.4,
    });
    if (eLabelsA > 0.001) {
      label3(ctx, `e${i + 1}`, p, cam, {
        dx: 0,
        dy: -22,
        size: 24,
        family: FONT_MONO,
        color: COLORS.ink,
        alpha: eLabelsA,
      });
    }
    if (aLabelsA > 0.001) {
      label3(ctx, `a${i + 1}`, p, cam, {
        dx: i === 2 ? 20 : 0,
        dy: -20,
        size: 26,
        family: FONT_MONO,
        color: COLORS.amber,
        alpha: aLabelsA,
      });
    }
  });

  if (relationA > 0.001) {
    drawParallelogram(ctx, cam, {
      alpha: 0.17 * relationA,
      strokeAlpha: 0.85 * relationA,
      diagonalAlpha: 0.85 * relationA,
      label: false,
    });
    drawText(ctx, 'a₃ = a₁ + a₂', 1320, 430, {
      size: 28,
      family: FONT_MONO,
      style: 'normal',
      color: COLORS.amber,
      alpha: relationA,
      align: 'left',
    });
  }
  if (formulaA > 0.001) {
    formulaPieces(
      ctx,
      1320,
      500,
      [
        { t: '(', c: COLORS.dim },
        { t: 'a₁', c: COLORS.amber },
        { t: ',', c: COLORS.dim },
        { t: 'a₂', c: COLORS.amber },
        { t: ',', c: COLORS.dim },
        { t: 'a₃', c: COLORS.amber },
        { t: ')=(', c: COLORS.dim },
        { t: 'A', c: COLORS.dim },
        { t: 'e₁', c: COLORS.ink },
        { t: ',', c: COLORS.dim },
        { t: 'A', c: COLORS.dim },
        { t: 'e₂', c: COLORS.ink },
        { t: ',', c: COLORS.dim },
        { t: 'A', c: COLORS.dim },
        { t: 'e₃', c: COLORS.ink },
        { t: ')', c: COLORS.dim },
      ],
      formulaA,
      28
    );
  }

  drawTracker(ctx, {
    state: 'docked',
    answers: [true, f >= 1858, false, false],
    alpha: 1,
  });

  if (f >= 1804 && f < 1815) {
    drawText(ctx, '共面', 1320, 570, {
      size: 28,
      color: COLORS.amber,
      alpha: smoothstep((f - 1804) / 10),
      align: 'left',
    });
  } else if (f >= 1815 && f < 1859) {
    tokenFlyRoute(
      ctx,
      '共面',
      [
        [1320, 570],
        [1575, 570],
        [1575, 118],
        [1678, 118],
      ],
      (f - 1815) / 43,
      COLORS.amber,
      1,
      FONT_CN,
      28
    );
  }

  subs(ctx, f, 's1');
}

export function drawS1(ctx, f) {
  if (f < 1254) s1C1B1v2(ctx, f);
  else s1C1B2v2(ctx, f);
}

/* ============================================================
   S2 — equations
   ============================================================ */

function s2Base(ctx, f, { kernelAlpha = 0.62 } = {}) {
  const cam = CAM.L1();
  drawGhostDomain(ctx, cam, { alpha: 0.12 });
  drawPlane(ctx, cam, { alpha: 0.145, size: 3.0 });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: 0.24,
    pointAlpha: 0.05,
    pointRadius: 1.75,
    transform: applyA,
    tint: 0.88,
    kernelTint: 1,
    lineWidth: 1.15,
  });
  drawAxes(ctx, cam, { alpha: 0.74, length: 2.5, labels: true, width: 2.1 });
  drawKernelLine(ctx, cam, { alpha: kernelAlpha, width: 1.5, dash: [6, 7] });
  return cam;
}

const PREIMAGE_HALF = 2.0;
const PREIMAGE_LEN = 3.0;
const PREIMAGE_SHIFT = 0.5;
const preimagePoint = (t) => [
  B_IN[0] + KERNEL_DIR[0] * t,
  B_IN[1] + KERNEL_DIR[1] * t,
  B_IN[2] + KERNEL_DIR[2] * t,
];
const B_OUT_PREIMAGE = invB(B_OUT);

function s2C1B4(ctx, f) {
  const cam = CAM.L1();

  const bA = 0.35 + 0.65 * smoothstep((f - 1914) / 35);
  const lf = f - 1914;

  // F30–F90: b visits two other points on the image plane and comes home.
  let bP = B_IN;
  if (lf >= 30 && lf < 50) {
    bP = lerp3(B_IN, [2, -1, 0], smoothstep((lf - 30) / 20));
  } else if (lf >= 50 && lf < 70) {
    bP = lerp3([2, -1, 0], [-1, 2, 0], smoothstep((lf - 50) / 20));
  } else if (lf >= 70 && lf < 90) {
    bP = lerp3([-1, 2, 0], B_IN, smoothstep((lf - 70) / 20));
  }

  // Stage: u=1 is the collapsed image; u=0 is the full 3D q-grid.
  let u = 1;
  if (f >= 2004 && f < 2094) u = 1 - smoothstep((f - 2004) / 90);
  else if (f >= 2094 && f < 2198) u = 0;
  else if (f >= 2198) u = smoothstep((f - 2198) / 65);

  // Preimage line: x leaves b during the reverse; during the hold both ends
  // grow outward until the line matches the kernel's length.
  const rev = smoothstep((f - 2004) / 90);
  const grow = smoothstep((f - 2114) / 50);
  const fwd = smoothstep((f - 2198) / 65);
  const xUp = preimagePoint(-PREIMAGE_HALF * rev);
  const upperEnd = preimagePoint(-(PREIMAGE_HALF + (PREIMAGE_LEN - PREIMAGE_HALF) * grow) - PREIMAGE_SHIFT * grow);
  const lowerEnd = preimagePoint((PREIMAGE_LEN - PREIMAGE_SHIFT) * grow);
  let xPoint = xUp;
  if (f >= 2094 && f < 2198) xPoint = preimagePoint(-PREIMAGE_HALF);
  else if (f >= 2198) xPoint = lerp3(preimagePoint(-PREIMAGE_HALF), B_IN, fwd);

  // Parallel pulse while the full line and the kernel are both on screen.
  const pulse = f >= 2164 && f <= 2183 ? Math.sin(Math.PI * (f - 2164) / 20) : 0;

  drawGhostDomain(ctx, cam, { alpha: 0.12 });
  drawPlane(ctx, cam, { alpha: 0.02 + 0.125 * u, size: 3.0 });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: 0.24 + 0.20 * (1 - u),
    pointAlpha: 0.05 + 0.87 * (1 - u),
    pointRadius: 1.75,
    transform: (p) => lerp3(p, applyA(p), u),
    tint: 0.88 * u,
    kernelTint: u,
    lineWidth: 1.15,
  });
  drawAxes(ctx, cam, { alpha: 0.74, length: 2.5, labels: true, width: 2.1 });
  drawKernelLine(ctx, cam, {
    alpha: 0.58 + 0.28 * pulse,
    width: 1.5,
    length: 3.0,
    dash: [6, 7],
  });

  // The solution line: half during the reverse, full during the hold,
  // then collapsing to b with the forward apply.
  let lineA = 0;
  let lp = null;
  let lq = null;
  if (f >= 2004 && f < 2114) {
    lineA = 0.9;
    lp = B_IN;
    lq = xUp;
  } else if (f >= 2114 && f < 2198) {
    lineA = 0.9 + 0.1 * pulse;
    lp = upperEnd;
    lq = lowerEnd;
  } else if (f >= 2198) {
    lineA = 0.9 * (1 - smoothstep((f - 2250) / 13));
    lp = lerp3(preimagePoint(-PREIMAGE_LEN - PREIMAGE_SHIFT), B_IN, fwd);
    lq = lerp3(preimagePoint(PREIMAGE_LEN - PREIMAGE_SHIFT), B_IN, fwd);
  }
  // Ghost of the full line while the solid line and its points collapse.
  // It stays through the conclusion at f2363.
  if (f >= 2198) {
    const ghostA = smoothstep((f - 2198) / 12);
    if (ghostA > 0.001) {
      line3(
        ctx,
        preimagePoint(-PREIMAGE_LEN - PREIMAGE_SHIFT),
        preimagePoint(PREIMAGE_LEN - PREIMAGE_SHIFT),
        cam,
        COLORS.cyan,
        0.58 * ghostA,
        1.5,
        [6, 7]
      );
    }
  }
  if (lineA > 0.001 && lp && lq) {
    line3(ctx, lp, lq, cam, COLORS.cyan, lineA, 2);
  }

  // Sample preimages on the line; they ride the forward collapse into b.
  if (f >= 2184) {
    [-3.0, -1.8, -0.6, 0.6, 1.4, 2.2].forEach((t, i) => {
      const a = smoothstep((f - (2184 + i * 2)) / 8) * (1 - smoothstep((f - 2254) / 9));
      if (a <= 0.001) return;
      point3(ctx, lerp3(preimagePoint(t), B_IN, fwd), cam, 4.0, COLORS.cyan, a);
    });
  }

  // b becomes a ghost while the domain is lifted, then solid again.
  let bGhost = 1;
  if (f >= 2004) {
    bGhost = f < 2010 ? lerp(1, 0.35, (f - 2004) / 6) : 0.35;
    if (f >= 2198) bGhost = lerp(0.35, 1, smoothstep((f - 2198) / 65));
  }

  drawPointArrow(ctx, cam, {
    p: f < 2004 ? bP : B_IN,
    color: COLORS.amber,
    alpha: bA * bGhost,
    width: 2.4,
    label: 'b',
    labelSize: 34,
    labelDx: 20,
    labelDy: -18,
    dotRadius: 4.2,
  });

  // The moving preimage x.
  const xA = smoothstep((f - 2004) / 10) * (1 - smoothstep((f - 2254) / 9));
  if (xA > 0.001) {
    point3(ctx, xPoint, cam, 4.2, COLORS.cyan, xA);
    point3(ctx, xPoint, cam, 11, COLORS.cyan, 0.15 * xA);
  }
  const xLabelA = smoothstep((f - 2084) / 15) * (1 - smoothstep((f - 2230) / 12));
  if (xLabelA > 0.001) {
    label3(ctx, 'x', xPoint, cam, {
      dx: 18,
      dy: 24,
      size: 26,
      family: FONT_MONO,
      color: COLORS.cyan,
      alpha: xLabelA,
    });
  }

  drawMatrixCard(ctx, {
    kind: 'A',
    alpha: 0.94,
    equation: 'Ax = b',
    bLabel: 'b',
    bColor: COLORS.amber,
  });
  drawTracker(ctx, {
    state: 'docked',
    answers: [true, true, false, false],
    alpha: 1,
  });
  subs(ctx, f, 's2');
}

function s2C1B5(ctx, f) {
  const cam = s2Base(ctx, f, { kernelAlpha: 0.58 });
  const bA = 1 - smoothstep((f - 2364) / 30);
  const bOutA = smoothstep((f - 2364) / 45);
  const solA = 1 - smoothstep((f - 2388) / 55);

  // First frame inherits C1B4's last frame: the dashed preimage ghost at
  // kernel alpha, with b still solid. It fades as b′ comes in.
  if (solA > 0.001) {
    line3(
      ctx,
      preimagePoint(-PREIMAGE_LEN - PREIMAGE_SHIFT),
      preimagePoint(PREIMAGE_LEN - PREIMAGE_SHIFT),
      cam,
      COLORS.cyan,
      0.58 * solA,
      1.5,
      [6, 7]
    );
  }

  if (bA > 0.001) {
    drawPointArrow(ctx, cam, {
      p: B_IN,
      color: COLORS.amber,
      alpha: bA,
      width: 2.4,
      label: 'b',
      labelSize: 34,
      labelDx: 20,
      labelDy: -18,
      dotRadius: 4.2,
    });
  }

  drawPointArrow(ctx, cam, {
    p: B_OUT,
    color: COLORS.red,
    alpha: bOutA,
    width: 2.5,
    label: 'b′',
    labelSize: 34,
    labelDx: 18,
    labelDy: -18,
    dotRadius: 4.2,
  });
  drawGap(ctx, cam, { p: B_OUT, alpha: 0.85 * bOutA, label: '不在像上' });
  drawStamp(ctx, '无解', 96, 112, { color: COLORS.red, alpha: bOutA, size: 50 });

  // Keep Ax=b until b′ is fully in; then switch to the no-solution card.
  if (f < 2409) {
    drawMatrixCard(ctx, {
      kind: 'A',
      alpha: 0.94,
      equation: 'Ax = b',
      bLabel: 'b',
      bColor: COLORS.amber,
    });
  } else {
    drawMatrixCard(ctx, {
      kind: 'A',
      alpha: 0.94,
      equation: 'Ax = b′',
      bLabel: 'b′',
      bColor: COLORS.red,
      noSolution: true,
    });
  }
  drawTracker(ctx, {
    state: 'docked',
    answers: [true, true, f >= 2538, false],
    alpha: 1,
  });
  subs(ctx, f, 's2');
}

function s2C1B6(ctx, f) {
  const cam = makeCamera({ cx: 648, cy: 474, scale: 120, yaw: 65, pitch: 30 });
  const u = smoothstep((f - 2688) / 70);
  drawGhostDomain(ctx, cam, { alpha: 0.06 });
  drawCube(ctx, cam, {
    size: 1.5,
    edgeColor: COLORS.ink,
    edgeAlpha: 0.22,
    backEdgeAlpha: 0.09,
    dashedBack: true,
    width: 1,
  });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: 0.4,
    pointAlpha: 0.82,
    pointRadius: 1.8,
    transform: (p) => lerp3(p, applyB(p), u),
    tint: 0,
    lineWidth: 1.2,
  });
  drawAxes(ctx, cam, { alpha: 0.5, length: 2.4, labels: true, width: 1.6 });

  const bA = smoothstep((f - 2758) / 40);
  const xA = smoothstep((f - 2838) / 40);
  if (bA > 0.001) {
    drawPointArrow(ctx, cam, {
      p: B_TARGET,
      color: COLORS.amber,
      alpha: bA,
      width: 2.8,
      label: 'b',
      labelSize: 36,
      labelDx: 18,
      labelDy: -18,
    });
  }
  if (xA > 0.001) {
    drawPointArrow(ctx, cam, {
      p: B_PREIMAGE,
      color: COLORS.cyan,
      alpha: xA,
      width: 2.4,
      label: 'x',
      labelSize: 32,
      labelDx: 16,
      labelDy: 20,
    });
    label3(ctx, '唯一原像', B_PREIMAGE, cam, {
      dx: 18,
      dy: 48,
      size: 24,
      color: COLORS.cyan,
      alpha: xA,
    });
  }
  if (f >= 2838) {
    const sA = smoothstep((f - 2838) / 35);
    drawStamp(ctx, '唯一解', 96, 112, { color: COLORS.amber, alpha: sA, size: 46 });
  }

  drawMatrixCard(ctx, {
    kind: 'B',
    alpha: 0.94,
    equation: 'Bx = b',
    bLabel: 'b',
    bColor: COLORS.amber,
  });
  drawTracker(ctx, {
    state: 'docked',
    answers: [true, true, true, f >= 2838],
    alpha: 1,
  });
  subs(ctx, f, 's2');
}

function s2C1B5B6(ctx, f) {
  const lf = f - 2364;
  const camT = smoothstep((f - 2394) / 60);
  const cam = makeCamera({
    cx: 648,
    cy: 474,
    scale: lerp(145, 140, camT),
    yaw: 78,
    pitch: lerp(30, 12, camT),
  });

  // A phase: uA=1 is the collapsed image, uA=0 is the full q-grid.
  let uA = 1;
  if (f >= 2394 && f < 2454) uA = 1 - smoothstep((f - 2394) / 60);
  else if (f >= 2454 && f < 2484) uA = 0;
  else if (f >= 2484 && f < 2559) uA = smoothstep((f - 2484) / 75);
  else if (f >= 2559 && f < 2679) uA = 1;
  else if (f >= 2679 && f < 2709) uA = 1 - smoothstep((f - 2679) / 30);
  else if (f >= 2709) uA = 0;

  // B phase: forward, then reverse.
  let uB = 0;
  if (f >= 2709 && f < 2784) uB = smoothstep((f - 2709) / 75);
  else if (f >= 2784 && f < 2874) uB = 1 - smoothstep((f - 2784) / 90);

  const isB = f >= 2709;
  const bSwitch = smoothstep((f - 2679) / 30);

  drawGhostDomain(ctx, cam, { alpha: 0.12 - 0.04 * bSwitch });
  drawPlane(ctx, cam, {
    alpha: isB ? 0 : (0.08 + 0.065 * uA) * (1 - bSwitch),
    size: 3.0,
  });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: isB ? 0.4 : 0.24 + 0.2 * (1 - uA),
    pointAlpha: isB ? 0.82 : 0.05 + 0.87 * (1 - uA),
    pointRadius: isB ? 1.8 : 1.75,
    transform: (p) => (isB ? lerp3(p, applyB(p), uB) : lerp3(p, applyA(p), uA)),
    tint: isB ? 0 : 0.88 * uA,
    kernelTint: isB ? 0 : uA,
    lineWidth: isB ? 1.2 : 1.15,
  });
  drawAxes(ctx, cam, { alpha: 0.74, length: 2.5, labels: true, width: 2.1 });

  const kernelA = 0.58 * (1 - bSwitch);
  if (kernelA > 0.001) {
    drawKernelLine(ctx, cam, { alpha: kernelA, width: 1.5, length: 3.0, dash: [6, 7] });
  }

  // C1B4's dashed preimage line is inherited, then fades as b′ lifts.
  const ghostLineA = 0.58 * (1 - smoothstep((f - 2388) / 66));
  if (ghostLineA > 0.001) {
    line3(
      ctx,
      preimagePoint(-PREIMAGE_LEN - PREIMAGE_SHIFT),
      preimagePoint(PREIMAGE_LEN - PREIMAGE_SHIFT),
      cam,
      COLORS.cyan,
      ghostLineA,
      1.5,
      [6, 7]
    );
  }

  // Foot of b′ = b on the image plane.
  const footBase = f < 2388 ? lerp(1, 0.35, smoothstep((f - 2364) / 24)) : 0.35;
  const footA = footBase * (1 - bSwitch);
  if (footA > 0.001) {
    drawPointArrow(ctx, cam, {
      p: B_IN,
      color: COLORS.amber,
      alpha: footA,
      width: 2.4,
      label: 'b',
      labelSize: 34,
      labelDx: 20,
      labelDy: -18,
      dotRadius: 4.2,
    });
  }

  const bOutA = smoothstep((f - 2364) / 24);
  const lift = smoothstep((f - 2388) / 66);
  const pOut = [B_OUT[0], B_OUT[1], lift];
  const outColor = mix(COLORS.red, COLORS.amber, bSwitch);
  const bGhostA = f < 2784 ? 1 : lerp(1, 0.35, smoothstep((f - 2784) / 30));
  drawPointArrow(ctx, cam, {
    p: pOut,
    color: outColor,
    alpha: bOutA * bGhostA,
    width: 2.7,
    label: 'b′',
    labelSize: 34,
    labelDx: 18,
    labelDy: -18,
    dotRadius: 4.2,
  });

  const gapA = smoothstep((f - 2388) / 30) * (1 - bSwitch);
  if (gapA > 0.001) {
    drawGap(ctx, cam, { p: pOut, alpha: 0.85 * gapA, label: null });
  }

  if (f >= 2784) {
    const pMove = lerp3(B_OUT_PREIMAGE, B_OUT, uB);
    drawPointArrow(ctx, cam, {
      p: pMove,
      color: COLORS.cyan,
      alpha: 1,
      width: 2.4,
      dotRadius: 4.0,
    });
    const xLabelA = smoothstep((f - 2804) / 10);
    if (xLabelA > 0.001) {
      label3(ctx, 'x', pMove, cam, {
        dx: 16,
        dy: 20,
        size: 32,
        family: FONT_MONO,
        color: COLORS.cyan,
        alpha: xLabelA,
      });
    }
  }

  if (f < 2388) {
    drawMatrixCard(ctx, {
      kind: 'A',
      alpha: 0.94,
      equation: 'Ax = b',
      bLabel: 'b',
      bColor: COLORS.amber,
    });
  } else if (f < 2544) {
    drawMatrixCard(ctx, {
      kind: 'A',
      alpha: 0.94,
      equation: 'Ax = b′',
      bLabel: 'b′',
      bColor: COLORS.red,
    });
  } else if (f < 2709) {
    drawMatrixCard(ctx, {
      kind: 'A',
      alpha: 0.94,
      equation: 'Ax = b′',
      bLabel: 'b′',
      bColor: COLORS.red,
      noSolution: true,
      showNoSolution: false,
    });
  } else {
    drawMatrixCard(ctx, {
      kind: 'B',
      alpha: 0.94,
      equation: 'Bx = b′',
      bLabel: 'b′',
      bColor: COLORS.amber,
    });
  }

  drawTracker(ctx, {
    state: 'docked',
    answers: [true, true, lf >= 245, lf >= 575],
    alpha: 1,
  });

  // S1-style token flights: source text on the stage's lower right, then
  // fly up around the matrix card and into the Q3 / Q4 slots.
  if (lf >= 200 && lf <= 210) {
    drawText(ctx, QUESTIONS[2].token, 1080, 780, {
      size: 34,
      family: FONT_CN,
      color: COLORS.amber,
      alpha: 1,
      align: 'left',
    });
  } else if (lf > 210 && lf < 245) {
    tokenFlyRoute(
      ctx,
      QUESTIONS[2].token,
      [
        [1080, 780],
        [1080, 290],
        [1366, 290],
      ],
      (lf - 210) / 35,
      COLORS.amber,
      1,
      FONT_CN,
      34
    );
  }
  if (lf >= 530 && lf <= 540) {
    drawText(ctx, QUESTIONS[3].token, 1080, 780, {
      size: 34,
      family: FONT_CN,
      color: COLORS.amber,
      alpha: 1,
      align: 'left',
    });
  } else if (lf > 540 && lf < 575) {
    tokenFlyRoute(
      ctx,
      QUESTIONS[3].token,
      [
        [1080, 780],
        [1080, 290],
        [1678, 290],
      ],
      (lf - 540) / 35,
      COLORS.amber,
      1,
      FONT_CN,
      34
    );
  }
  subs(ctx, f, 's2');
}

export function drawS2(ctx, f) {
  if (f < 2364) s2C1B4(ctx, f);
  else if (f < 3024) s2C1B5B6(ctx, f);
  else drawChapterCard(ctx, 1, windowAlpha(f, 3024, 3078, 12, 6));
}

/* ============================================================
   S3 — table
   ============================================================ */

function columnAlpha(f, start) {
  if (f < start) return 0;
  return smoothstep((f - start) / 45);
}

export function drawS3(ctx, f) {
  const starts = [3118, 3348, 3588, 3858];
  const columns = starts.map((s) => columnAlpha(f, s));
  const active = f >= 3858 ? 3 : f >= 3588 ? 2 : f >= 3348 ? 1 : 0;
  const col = TABLE_COLUMNS[active];
  drawTable(ctx, {
    alpha: 1,
    columns,
    exprAlpha: columns,
    readout: {
      image: col.image,
      kernel: col.kernel,
      alpha: columnAlpha(f, starts[active] + 20),
      headerAlpha: 0.45 + 0.45 * smoothstep((f - 3078) / 40),
    },
    sumAlpha: 0,
  });
  drawTracker(ctx, {
    state: 'compact',
    answers: [true, true, true, true],
    alpha: 0.95,
  });
  subs(ctx, f, 's3');
}

/* ============================================================
   S4 — sum + theorem
   ============================================================ */

export function drawS4(ctx, f) {
  if (f < 4428) {
    const sumStarts = [4158, 4198, 4238, 4278];
    const sumAlphas = sumStarts.map((s) => smoothstep((f - s) / 30));
    const readoutFade = 1 - smoothstep((f - 4128) / 60);
    drawTable(ctx, {
      alpha: 1,
      columns: [1, 1, 1, 1],
      exprAlpha: [1, 1, 1, 1],
      sumAlphas,
      readout: {
        image: 0,
        kernel: 3,
        alpha: readoutFade,
        headerAlpha: 0.9 * readoutFade,
      },
    });
    drawTracker(ctx, {
      state: 'done',
      answers: [true, true, true, true],
      alpha: 0.9,
    });
  } else {
    drawTable(ctx, {
      alpha: 0.12,
      columns: [1, 1, 1, 1],
      exprAlpha: [1, 1, 1, 1],
      sumAlphas: [1, 1, 1, 1],
      highlightSum: true,
    });
    drawTracker(ctx, {
      state: 'done',
      answers: [true, true, true, true],
      alpha: 0.28,
    });
    const g = ctx.createRadialGradient(960, 475, 110, 960, 500, 720);
    g.addColorStop(0, 'rgba(7,10,15,0.88)');
    g.addColorStop(0.58, 'rgba(7,10,15,0.58)');
    g.addColorStop(1, 'rgba(7,10,15,0)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(300, 120, 1320, 760);
    ctx.restore();
    const formulaT = smoothstep((f - 4478) / 80);
    const formulaA = smoothstep((f - 4478) / 40);
    const cardA = smoothstep((f - 4558) / 40);
    drawTheoremCard(ctx, formulaA, cardA, lerp(820, 438, formulaT));
  }
  subs(ctx, f, 's4');
}

/* ============================================================
   S5 — coda
   ============================================================ */

export function drawS5(ctx, f) {
  const S5_START = 4890;
  if (f < S5_START) {
    drawExtraCard(ctx, windowAlpha(f, 4818, S5_START, 12, 12));
    return;
  }
  const t = f - S5_START;
  const a = smoothstep(t / 30);
  const camL = CAM.L5L();
  const camR = CAM.L5R();

  const T1 = 60;
  const T2 = 150;
  const T3 = 250;
  const T4 = 350;

  let left = { kind: 'A', from: 0, to: 0, u: 0, ghost: null, ripple: 0 };
  let right = { kind: 'M', from: 0, to: 0, u: 0, ghost: null, ripple: 0 };

  if (t >= T1 && t < T2) {
    const u = smoothstep((t - T1) / 60);
    left = { ...left, from: 0, to: 1, u };
    right = { ...right, from: 0, to: 1, u };
  } else if (t >= T2 && t < T3) {
    const u = smoothstep((t - (T2 + 10)) / 60);
    const gIn = smoothstep((t - T2) / 12);
    const gU = smoothstep((t - (T2 + 10)) / 60);
    const gOut = 1 - smoothstep((t - (T2 + 82)) / 18);
    const ghost = { alpha: gIn * gOut, u: gU, plane: smoothstep((gU - 0.55) / 0.45) };
    const ripple = t >= T2 + 70 ? smoothstep((t - (T2 + 70)) / 32) : 0;
    left = { ...left, from: 1, to: 2, u, ghost, ripple };
    right = { ...right, from: 1, to: 2, u, ghost, ripple: 0 };
  } else if (t >= T3 && t < T4) {
    const u = smoothstep((t - (T3 + 10)) / 60);
    const gIn = smoothstep((t - T3) / 12);
    const gU = smoothstep((t - (T3 + 10)) / 60);
    const gOut = 1 - smoothstep((t - (T3 + 82)) / 18);
    const ghost = { alpha: gIn * gOut, u: gU, plane: smoothstep((gU - 0.55) / 0.45) };
    const ripple = t >= T3 + 70 ? smoothstep((t - (T3 + 70)) / 32) : 0;
    left = { ...left, from: 2, to: 3, u, ghost, ripple };
    right = { ...right, from: 2, to: 3, u, ghost, ripple: 0 };
  } else if (t >= T4) {
    left = { ...left, from: 2, to: 3, u: 1, ghost: null, ripple: 0 };
    right = { ...right, from: 2, to: 3, u: 1, ghost: null, ripple: 0 };
  }

  // divider
  line2(ctx, 960, 96, 960, 860, COLORS.faint, 0.06 * a, 1);

  withClip(ctx, 48, 96, 888, 764, () => {
    drawCodaStageV2(ctx, camL, { ...left, alpha: a });
  });
  withClip(ctx, 984, 96, 888, 764, () => {
    drawCodaStageV2(ctx, camR, { ...right, alpha: a });
  });

  // Concrete matrix values, tucked into the outer bottom corners.
  drawMiniMatrix(ctx, {
    x: 90,
    y: 734,
    matrix: A,
    label: 'A',
    alpha: a * 0.9,
  });
  drawMiniMatrix(ctx, {
    x: 1740,
    y: 734,
    matrix: J,
    label: 'M',
    alpha: a * 0.9,
  });

  subs(ctx, f, 's5');
  // f5268–f5327: reserved 2 s black credits slot (no text yet).
  // f5328–f5399: final black / safety.
  if (t >= 410) {
    fadeOverlay(ctx, smoothstep((t - 410) / 40));
  }

  // f5268–f5327: 2 s credits card. Copy lives in data.js.
  if (t >= 450) {
    const ca = smoothstep((t - 450) / 12) * (1 - smoothstep((t - 500) / 10));
    if (CREDITS.title && CREDITS.names.length && ca > 0.001) {
      drawText(ctx, CREDITS.title, 960, 496, {
        size: 46,
        color: COLORS.ink,
        alpha: ca * 0.94,
      });
      line2(ctx, 780, 540, 1140, 540, COLORS.ink, 0.22 * ca, 1);
      drawText(ctx, CREDITS.names.join('      '), 960, 584, {
        size: 36,
        color: COLORS.ink,
        alpha: ca,
      });
    }
  }
}

/* ============================================================
   dispatcher
   ============================================================ */

export function drawSection(ctx, f) {
  if (f >= 270 && f < 300) s0Shift(ctx, f);
  else if (f < 894) drawS0(ctx, f);
  else if (f < 1914) drawS1(ctx, f);
  else if (f < 3078) drawS2(ctx, f);
  else if (f < 4128) drawS3(ctx, f);
  else if (f < 4818) drawS4(ctx, f);
  else drawS5(ctx, f);
}

export function drawFrame(ctx, f) {
  clear(ctx);
  drawSection(ctx, f);
}
