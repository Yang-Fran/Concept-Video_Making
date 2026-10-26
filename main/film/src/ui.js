'use strict';

/* ============================================================
   ui — 2D layer: tracker, matrix card, question cards, table,
   chapter / title / theorem cards, subtitles.
   ============================================================ */

import {
  BG,
  COLORS,
  FONT_CN,
  FONT_MONO,
  W,
  H,
  arrow2,
  cardSurface,
  clamp,
  dot2,
  drawText,
  drawTextLines,
  line2,
  makeCamera,
  mix,
  poly3,
  progress,
  rgba,
  roundRect,
  screenGrid,
  smoothstep,
  textWidth,
  windowAlpha,
} from './core.js';

import { QUESTIONS, CHAPTERS, TABLE_COLUMNS } from './data.js';
import { A, B, J } from './math.js';
import { vcross } from './core.js';
import { drawCube, drawKernelCube } from './stage.js';

/* ============================================================
   1. symbols + tracker
   ============================================================ */

function symbolDims(ctx, x, y, s, color, alpha) {
  // a parallelogram with a down arrow: something is kept, something is crushed
  const pts = [
    [x + 0.1 * s, y + 0.24 * s],
    [x + 0.64 * s, y + 0.14 * s],
    [x + 0.88 * s, y + 0.42 * s],
    [x + 0.34 * s, y + 0.54 * s],
  ];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = rgba(color, alpha * 0.1);
  ctx.fill();
  ctx.restore();
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    line2(ctx, a[0], a[1], b[0], b[1], color, alpha, 1.5);
  }
  arrow2(
    ctx,
    x + 0.48 * s,
    y + 0.42 * s,
    x + 0.48 * s,
    y + 0.88 * s,
    color,
    alpha,
    1.7,
    0.13 * s
  );
}

function symbolPlane(ctx, x, y, s, color, alpha) {
  // a trident: three columns from one origin, plus a faint spanning triangle
  const o = [x + 0.18 * s, y + 0.78 * s];
  const tips = [
    [x + 0.18 * s, y + 0.16 * s],
    [x + 0.82 * s, y + 0.28 * s],
    [x + 0.7 * s, y + 0.8 * s],
  ];
  for (let i = 0; i < 3; i++) {
    arrow2(ctx, o[0], o[1], tips[i][0], tips[i][1], color, alpha, 1.5, 0.11 * s);
  }
  dot2(ctx, o[0], o[1], 0.04 * s, color, alpha);
}

function symbolSolve(ctx, x, y, s, color, alpha) {
  // same-height brackets: a wide matrix on the left, a thin vector on the right
  const top = y + 0.14 * s;
  const bottom = y + 0.8 * s;
  const tick = 0.075 * s;
  const mx0 = x + 0.08 * s;
  const mx1 = x + 0.5 * s;
  line2(ctx, mx0, top, mx0, bottom, color, alpha, 1.5);
  line2(ctx, mx0, top, mx0 + tick, top, color, alpha, 1.5);
  line2(ctx, mx0, bottom, mx0 + tick, bottom, color, alpha, 1.5);
  line2(ctx, mx1, top, mx1, bottom, color, alpha, 1.5);
  line2(ctx, mx1 - tick, top, mx1, top, color, alpha, 1.5);
  line2(ctx, mx1 - tick, bottom, mx1, bottom, color, alpha, 1.5);
  for (const u of [0.2, 0.38]) {
    for (const v of [0.32, 0.6]) {
      dot2(ctx, x + u * s, y + v * s, 0.045 * s, color, alpha * 0.9);
    }
  }

  const vx0 = x + 0.6 * s;
  const vx1 = x + 0.76 * s;
  line2(ctx, vx0, top, vx0, bottom, color, alpha, 1.3);
  line2(ctx, vx0, top, vx0 + tick * 0.7, top, color, alpha, 1.3);
  line2(ctx, vx0, bottom, vx0 + tick * 0.7, bottom, color, alpha, 1.3);
  line2(ctx, vx1, top, vx1, bottom, color, alpha, 1.3);
  line2(ctx, vx1 - tick * 0.7, top, vx1, top, color, alpha, 1.3);
  line2(ctx, vx1 - tick * 0.7, bottom, vx1, bottom, color, alpha, 1.3);
  for (const v of [0.32, 0.6]) {
    dot2(ctx, x + 0.68 * s, y + v * s, 0.045 * s, color, alpha * 0.9);
  }
}

function symbolInvert(ctx, x, y, s, color, alpha) {
  // a cube with two separated arrows: a one-to-one correspondence
  const fx0 = x + 0.1 * s;
  const fy0 = y + 0.3 * s;
  const fw = s * 0.46;
  const fh = s * 0.44;
  const d = s * 0.12;
  line2(ctx, fx0, fy0 + fh, fx0 + fw, fy0 + fh, color, alpha, 1.3);
  line2(ctx, fx0 + fw, fy0 + fh, fx0 + fw, fy0, color, alpha, 1.3);
  line2(ctx, fx0, fy0 + fh, fx0, fy0, color, alpha, 1.3);
  line2(ctx, fx0, fy0, fx0 + fw, fy0, color, alpha, 1.3);
  line2(ctx, fx0, fy0, fx0 + d, fy0 - d, color, alpha * 0.8, 1);
  line2(ctx, fx0 + fw, fy0, fx0 + fw + d, fy0 - d, color, alpha * 0.8, 1);
  line2(ctx, fx0 + fw, fy0 + fh, fx0 + fw + d, fy0 + fh - d, color, alpha * 0.8, 1);
  line2(ctx, fx0 + d, fy0 - d, fx0 + fw + d, fy0 - d, color, alpha * 0.8, 1);
  line2(ctx, fx0 + fw + d, fy0 - d, fx0 + fw + d, fy0 + fh - d, color, alpha * 0.8, 1);

  arrow2(
    ctx,
    fx0 + 0.06 * s,
    y + 0.4 * s,
    fx0 + fw - 0.04 * s,
    y + 0.4 * s,
    color,
    alpha * 0.95,
    1.5,
    0.08 * s
  );
  arrow2(
    ctx,
    fx0 + fw - 0.04 * s,
    y + 0.62 * s,
    fx0 + 0.06 * s,
    y + 0.62 * s,
    color,
    alpha * 0.95,
    1.5,
    0.08 * s
  );
}

export function drawQuestionSymbol(ctx, kind, x, y, s, color, alpha = 1) {
  if (alpha <= 0.001) return;
  if (kind === 'dims') symbolDims(ctx, x, y, s, color, alpha);
  else if (kind === 'plane') symbolPlane(ctx, x, y, s, color, alpha);
  else if (kind === 'solve') symbolSolve(ctx, x, y, s, color, alpha);
  else symbolInvert(ctx, x, y, s, color, alpha);
}

const TRACKER_FULL = [
  [96, 96],
  [1404, 96],
  [96, 620],
  [1404, 620],
];
const TRACKER_DOCK = [
  [1280, 48],
  [1592, 48],
  [1280, 220],
  [1592, 220],
];
const TRACKER_COMPACT = [
  [1624, 80],
  [1748, 80],
  [1624, 172],
  [1748, 172],
];

function statusDot(ctx, x, y, on, alpha = 1) {
  dot2(ctx, x, y, 3, on ? COLORS.amber : COLORS.dim, (on ? 1 : 0.6) * alpha);
}

export function drawQuestionCard(
  ctx,
  q,
  x,
  y,
  w,
  h,
  alpha = 1,
  dim = 1,
  answered = false
) {
  if (alpha <= 0.001) return;
  cardSurface(ctx, x, y, w, h, {
    alpha: alpha,
    fill: [10, 14, 20],
    fillAlpha: 0.72,
    border: COLORS.faint,
    borderAlpha: 0.30,
    radius: 10,
  });
  const color = answered ? COLORS.amber : COLORS.dim;
  drawQuestionSymbol(ctx, q.symbol, x + 18, y + 20, 76, color, alpha * dim);
  if (q.id === 2) {
    drawText(ctx, '方程', x + 108, y + 48, {
      size: 30,
      color: COLORS.ink,
      alpha: alpha * dim,
      align: 'left',
    });
    drawText(ctx, 'Ax = b', x + 176, y + 48, {
      size: 30,
      family: FONT_MONO,
      style: 'normal',
      color: COLORS.ink,
      alpha: alpha * dim,
      align: 'left',
    });
    drawText(ctx, '有解吗？', x + 108, y + 96, {
      size: 30,
      color: COLORS.ink,
      alpha: alpha * dim,
      align: 'left',
    });
  } else {
    const lines =
      q.id === 0
        ? ['矩阵变换，', '留下几维，压掉几维？']
        : q.id === 1
          ? ['三个列向量', '线性相关吗？']
          : ['矩阵 A 可逆吗？'];
    drawTextLines(ctx, lines, x + 108, y + h / 2, {
      size: q.id === 0 ? 28 : 30,
      lineHeight: 1.22,
      color: COLORS.ink,
      alpha: alpha * dim,
      align: 'left',
      shadow: true,
    });
  }
}

export function drawTracker(
  ctx,
  { state = 'off', answers = [false, false, false, false], alpha = 1 } = {}
) {
  if (state === 'off' || alpha <= 0.001) return;

  if (state === 'full') {
    QUESTIONS.forEach((q, i) => {
      const [x, y] = TRACKER_FULL[i];
      drawQuestionCard(ctx, q, x, y, 420, 150, alpha, 1, answers[i]);
      if (answers[i]) statusDot(ctx, x + 420 - 18, y + 18, true, alpha);
    });
    return;
  }

  if (state === 'docked') {
    QUESTIONS.forEach((q, i) => {
      const [x, y] = TRACKER_DOCK[i];
      const on = !!answers[i];
      cardSurface(ctx, x, y, 280, 140, {
        alpha,
        fill: [10, 14, 20],
        fillAlpha: 0.7,
        border: on ? COLORS.amber : COLORS.faint,
        borderAlpha: on ? 0.55 : 0.26,
        radius: 9,
      });
      drawQuestionSymbol(ctx, q.symbol, x + 14, y + 18, 48, on ? COLORS.amber : COLORS.dim, alpha);
      drawText(ctx, q.docked, x + 70, y + 34, {
        size: 22,
        color: on ? COLORS.ink : COLORS.dim,
        alpha,
        align: 'left',
      });
      statusDot(ctx, x + 74, y + 70, on, alpha);
      drawText(ctx, on ? q.token : '—', x + 86, y + 70, {
        size: 20,
        family: on && q.token.includes('+') ? FONT_MONO : FONT_CN,
        color: on ? COLORS.amber : COLORS.dim,
        alpha: on ? alpha : alpha * 0.55,
        align: 'left',
      });
    });
    return;
  }

  // compact / done
  QUESTIONS.forEach((q, i) => {
    const [x, y] = TRACKER_COMPACT[i];
    const on = state === 'done' ? true : !!answers[i];
    cardSurface(ctx, x, y, 112, 80, {
      alpha: alpha * (state === 'done' ? 0.85 : 1),
      fill: [10, 14, 20],
      fillAlpha: 0.64,
      border: on ? COLORS.amber : COLORS.faint,
      borderAlpha: on ? 0.45 : 0.20,
      radius: 7,
    });
    drawQuestionSymbol(ctx, q.symbol, x + 7, y + 8, 29, on ? COLORS.amber : COLORS.dim, alpha);
    drawText(ctx, q.compact, x + 39, y + 22, {
      size: 18,
      color: on ? COLORS.ink : COLORS.dim,
      alpha,
      align: 'left',
    });
    statusDot(ctx, x + 41, y + 50, on, alpha);
    drawText(ctx, on ? q.compactToken || q.token : '—', x + 52, y + 50, {
      size: 16,
      family: on && (q.compactToken || q.token).includes('+') ? FONT_MONO : FONT_CN,
      color: on ? COLORS.amber : COLORS.dim,
      alpha: on ? alpha : alpha * 0.5,
      align: 'left',
    });
  });
}

/* ============================================================
   2. promise / matrix card
   ============================================================ */

export function drawPromiseCard(ctx, alpha = 1) {
  if (alpha <= 0.001) return;
  const x = 580;
  const y = 430;
  const w = 760;
  const h = 220;
  cardSurface(ctx, x, y, w, h, {
    alpha,
    fill: [12, 17, 24],
    fillAlpha: 0.9,
    border: COLORS.amber,
    borderAlpha: 0.5,
    radius: 12,
    accent: COLORS.amber,
  });
  drawText(ctx, '四个问题，同一件事', W / 2, y + 88, {
    size: 48,
    weight: 500,
    color: COLORS.ink,
    alpha,
  });
  drawText(ctx, '什么留下，什么被压掉', W / 2, y + 148, {
    size: 30,
    color: COLORS.dim,
    alpha: alpha * 0.95,
  });
}

const MATRIX_CARD = { x: 1280, y: 392, w: 592, h: 308 };

export function drawMatrixCard(
  ctx,
  {
    kind = 'A',
    equation = 'Ax = b',
    bLabel = 'b',
    bColor = COLORS.amber,
    alpha = 1,
    noSolution = false,
    showNoSolution = true,
    showEquation = true,
  } = {}
) {
  if (alpha <= 0.001) return;
  const { x, y, w } = MATRIX_CARD;
  const h = showEquation ? MATRIX_CARD.h : 228;
  cardSurface(ctx, x, y, w, h, {
    alpha,
    fill: [9, 13, 19],
    fillAlpha: 0.78,
    border: noSolution ? COLORS.red : COLORS.faint,
    borderAlpha: noSolution ? 0.55 : 0.28,
    radius: 10,
  });

  const M = kind === 'B' ? B : A;
  drawText(ctx, kind, x + 28, y + 34, {
    size: 26,
    family: FONT_MONO,
    color: COLORS.dim,
    alpha,
    align: 'left',
  });
  drawText(ctx, '矩阵', x + 56, y + 35, {
    size: 20,
    color: COLORS.faint,
    alpha: alpha * 0.9,
    align: 'left',
  });

  const mx = x + 190;
  const my = y + (showEquation ? 82 : 70);
  const gapX = 76;
  const gapY = 52;
  // brackets
  line2(ctx, mx - 34, my - 32, mx - 34, my + gapY * 2 + 32, COLORS.ink, alpha * 0.38, 1.4);
  line2(ctx, mx - 34, my - 32, mx - 26, my - 32, COLORS.ink, alpha * 0.38, 1.4);
  line2(ctx, mx - 34, my + gapY * 2 + 32, mx - 26, my + gapY * 2 + 32, COLORS.ink, alpha * 0.38, 1.4);
  const right = mx + gapX * 2 + 34;
  line2(ctx, right, my - 32, right, my + gapY * 2 + 32, COLORS.ink, alpha * 0.38, 1.4);
  line2(ctx, right, my - 32, right - 8, my - 32, COLORS.ink, alpha * 0.38, 1.4);
  line2(ctx, right, my + gapY * 2 + 32, right - 8, my + gapY * 2 + 32, COLORS.ink, alpha * 0.38, 1.4);

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const v = M[r][c];
      let str;
      if (kind === 'B') {
        str = Number.isInteger(v) ? String(v) : v.toFixed(1).replace('-', '−');
      } else {
        str = String(v);
      }
      drawText(ctx, str, mx + c * gapX, my + r * gapY, {
        size: 30,
        family: FONT_MONO,
        color: COLORS.ink,
        alpha,
      });
    }
  }

  if (showEquation) {
    const eqPrefix = equation.replace(/\s*b[′']?\s*$/, '').trimEnd();
    drawText(ctx, eqPrefix, x + 40, y + h - 48, {
      size: 30,
      family: FONT_MONO,
      style: 'normal',
      color: COLORS.ink,
      alpha,
      align: 'left',
    });
    ctx.save();
    ctx.font = `400 30px ${FONT_MONO}`;
    const pw = ctx.measureText(eqPrefix).width;
    ctx.restore();
    drawText(ctx, bLabel, x + 40 + pw + 10, y + h - 48, {
      size: 30,
      family: FONT_MONO,
      style: 'normal',
      color: bColor,
      alpha,
      align: 'left',
    });
  }

  if (noSolution && showNoSolution) {
    drawText(ctx, '无解', x + w - 36, y + 34, {
      size: 26,
      color: COLORS.red,
      alpha,
      align: 'right',
    });
  }
}

/** A compact 3×3 matrix for the coda's bottom-right corner. */
export function drawMiniMatrix(ctx, { x, y, matrix, label = '', alpha = 1 } = {}) {
  if (alpha <= 0.001) return;
  const w = 106;
  const h = 82;
  ctx.save();
  ctx.fillStyle = rgba([7, 10, 15], 0.62 * alpha);
  ctx.fillRect(x - 12, y - 38, w + 24, h + 52);
  ctx.restore();

  drawText(ctx, label, x + 2, y - 18, {
    size: 18,
    family: FONT_MONO,
    color: COLORS.dim,
    alpha,
    align: 'left',
  });

  const top = y;
  const bottom = y + 80;
  const tick = 8;
  line2(ctx, x + 2, top, x + 2, bottom, COLORS.ink, alpha * 0.55, 1.3);
  line2(ctx, x + 2, top, x + 2 + tick, top, COLORS.ink, alpha * 0.55, 1.3);
  line2(ctx, x + 2, bottom, x + 2 + tick, bottom, COLORS.ink, alpha * 0.55, 1.3);
  line2(ctx, x + 104, top, x + 104, bottom, COLORS.ink, alpha * 0.55, 1.3);
  line2(ctx, x + 104 - tick, top, x + 104, top, COLORS.ink, alpha * 0.55, 1.3);
  line2(ctx, x + 104 - tick, bottom, x + 104, bottom, COLORS.ink, alpha * 0.55, 1.3);

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const v = matrix[r][c];
      drawText(ctx, Number.isInteger(v) ? String(v) : v.toFixed(1).replace('-', '−'), x + 26 + c * 28, y + 18 + r * 26, {
        size: 20,
        family: FONT_MONO,
        color: COLORS.ink,
        alpha,
      });
    }
  }
}

/* ============================================================
   3. chapter / title / theorem
   ============================================================ */

export function drawChapterCard(ctx, index, alpha = 1) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgba(BG, 1);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  screenGrid(ctx, 0.03 * alpha, 80, COLORS.faint);

  const c = CHAPTERS[index];
  const x = 360;
  const y = 410;
  const titleX = x + 200;

  drawText(ctx, `Chapter ${c.num}`, x, y, {
    size: 28,
    family: FONT_MONO,
    color: COLORS.dim,
    alpha: alpha * 0.9,
    align: 'left',
    letterSpacing: 2,
  });
  drawText(ctx, c.title, titleX, y - 8, {
    size: 78,
    weight: 500,
    color: COLORS.ink,
    alpha,
    align: 'left',
    letterSpacing: 8,
  });
  line2(ctx, x, y + 55, x + 1000, y + 55, COLORS.ink, alpha * 0.26, 1);
  drawText(ctx, c.subtitle, titleX, y + 105, {
    size: 30,
    color: COLORS.dim,
    alpha: alpha * 0.95,
    align: 'left',
    letterSpacing: 3,
  });
}

/** Full-screen interstitial before the Coda: Extra / 请思考. */
export function drawExtraCard(ctx, alpha = 1) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgba(BG, 1);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  screenGrid(ctx, 0.03 * alpha, 80, COLORS.faint);

  const x = 360;
  const y = 550;
  const titleX = x + 200;
  drawText(ctx, 'Extra', x, y, {
    size: 28,
    family: FONT_MONO,
    color: COLORS.dim,
    alpha: alpha * 0.9,
    align: 'left',
    letterSpacing: 2,
  });
  drawText(ctx, '请思考', titleX, y - 8, {
    size: 78,
    weight: 500,
    color: COLORS.ink,
    alpha,
    align: 'left',
    letterSpacing: 8,
  });
  line2(ctx, x, y + 55, x + 1000, y + 55, COLORS.ink, alpha * 0.26, 1);
}

export function drawTitleCard(ctx, alpha = 1) {
  if (alpha <= 0.001) return;
  const chars = [
    { ch: '秩', color: COLORS.amber },
    { ch: '与', color: COLORS.ink },
    { ch: '零', color: COLORS.cyan },
  ];
  ctx.save();
  ctx.font = `500 96px ${FONT_CN}`;
  const widths = chars.map((o) => ctx.measureText(o.ch).width);
  ctx.restore();
  const total = widths.reduce((a, b) => a + b, 0);
  let x = W / 2 - total / 2;
  const y = 500;
  chars.forEach((o, i) => {
    drawText(ctx, o.ch, x, y, {
      size: 96,
      weight: 500,
      color: o.color,
      alpha,
      align: 'left',
      shadow: true,
    });
    x += widths[i];
  });
  line2(ctx, W / 2 - 54, 558, W / 2 + 54, 558, COLORS.ink, alpha * 0.28, 1);
  drawText(ctx, '秩-零度定理', W / 2, 610, {
    size: 30,
    color: COLORS.dim,
    alpha: alpha * 0.95,
    letterSpacing: 4,
  });
}

export function drawTheoremCard(ctx, formulaAlpha = 1, cardAlpha = 1, formulaY = 438) {
  if (formulaAlpha <= 0.001 && cardAlpha <= 0.001) return;
  // formula, colored by role
  const segs = [
    { s: 'rank(A)', c: COLORS.amber },
    { s: ' + ', c: COLORS.ink },
    { s: 'nullity(A)', c: COLORS.cyan },
    { s: ' = n', c: COLORS.ink },
  ];
  const size = 56;
  ctx.save();
  ctx.font = `400 ${size}px ${FONT_MONO}`;
  const widths = segs.map((g) => ctx.measureText(g.s).width);
  ctx.restore();
  const total = widths.reduce((a, b) => a + b, 0);
  let x = W / 2 - total / 2;
  segs.forEach((g, i) => {
    drawText(ctx, g.s, x, formulaY, {
      size,
      family: FONT_MONO,
      style: 'normal',
      weight: 400,
      color: g.c,
      alpha: formulaAlpha,
      align: 'left',
      shadow: true,
    });
    x += widths[i];
  });

  if (cardAlpha > 0.001) {
    drawText(ctx, '秩 + 零度 = 原来的维数', W / 2, 530, {
      size: 40,
      color: COLORS.ink,
      alpha: cardAlpha * 0.96,
      letterSpacing: 2,
    });
    line2(ctx, W / 2 - 110, 570, W / 2 + 110, 570, COLORS.amber, cardAlpha * 0.5, 1);
    drawText(ctx, 'RANK–NULLITY THEOREM', W / 2, 612, {
      size: 18,
      family: FONT_MONO,
      color: COLORS.dim,
      alpha: cardAlpha * 0.8,
      letterSpacing: 4,
    });
  }
}

/* ============================================================
   4. table + icons
   ============================================================ */

const TABLE = {
  x: 48,
  y: 56,
  col: 388,
  matrixH: 250,
  iconH: 480,
  sumH: 92,
  width: 1552,
};

function iconCubeEdges(ctx, cam, phase, alpha) {
  const size = 1.5;
  const pts = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ].map((p) => p.map((v) => v * size));
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  for (const [i, j] of edges) {
    const a = pts[i];
    const b = pts[j];
    const d =
      (a[0] * cam.dir[0] + a[1] * cam.dir[1] + a[2] * cam.dir[2] +
        b[0] * cam.dir[0] + b[1] * cam.dir[1] + b[2] * cam.dir[2]) /
      2;
    const back = d < 0;
    if (phase === 'back' && !back) continue;
    if (phase === 'front' && back) continue;
    const pa = [
      cam.cx + cam.scale * (a[0] * cam.right[0] + a[1] * cam.right[1] + a[2] * cam.right[2]),
      cam.cy - cam.scale * (a[0] * cam.up[0] + a[1] * cam.up[1] + a[2] * cam.up[2]),
    ];
    const pb = [
      cam.cx + cam.scale * (b[0] * cam.right[0] + b[1] * cam.right[1] + b[2] * cam.right[2]),
      cam.cy - cam.scale * (b[0] * cam.up[0] + b[1] * cam.up[1] + b[2] * cam.up[2]),
    ];
    line2(
      ctx,
      pa[0],
      pa[1],
      pb[0],
      pb[1],
      COLORS.ink,
      back ? alpha * 0.7 : alpha,
      1,
      null
    );
  }
}

function iconPlaneAmber(ctx, cam, alpha) {
  const s = 1.18;
  const corners = [
    [-s, -s, 0],
    [s, -s, 0],
    [s, s, 0],
    [-s, s, 0],
  ];
  poly3(ctx, corners, cam, {
    fill: COLORS.amber,
    fillAlpha: 0.16 * alpha,
    stroke: COLORS.amber,
    strokeAlpha: 0.9 * alpha,
    width: 1.6,
  });
}

function iconLineAmber(ctx, cam, alpha) {
  const dir = [Math.SQRT1_2, Math.SQRT1_2, 0];
  const l = 1.48;
  const a = [-dir[0] * l, -dir[1] * l, 0];
  const b = [dir[0] * l, dir[1] * l, 0];
  const pa = projectIcon(a, cam);
  const pb = projectIcon(b, cam);
  line2(ctx, pa[0], pa[1], pb[0], pb[1], COLORS.amber, 0.95 * alpha, 3);
  dot2(ctx, pa[0], pa[1], 2.6, COLORS.amber, alpha);
  dot2(ctx, pb[0], pb[1], 2.6, COLORS.amber, alpha);
}

function projectIcon(p, cam) {
  return [
    cam.cx + cam.scale * (p[0] * cam.right[0] + p[1] * cam.right[1] + p[2] * cam.right[2]),
    cam.cy - cam.scale * (p[0] * cam.up[0] + p[1] * cam.up[1] + p[2] * cam.up[2]),
  ];
}

function iconPlaneCyan(ctx, cam, alpha) {
  const n = [1, 2, 3];
  const nl = Math.hypot(...n);
  const nn = n.map((v) => v / nl);
  const u = vcross(nn, [0, 0, 1]);
  const ul = Math.hypot(...u) || 1;
  const uu = u.map((v) => v / ul);
  const vv = vcross(nn, uu);
  const s = 1.26;
  const corners = [
    [-s, -s],
    [s, -s],
    [s, s],
    [-s, s],
  ].map(([a, b]) => [
    uu[0] * a + vv[0] * b,
    uu[1] * a + vv[1] * b,
    uu[2] * a + vv[2] * b,
  ]);
  poly3(ctx, corners, cam, {
    fill: COLORS.cyan,
    fillAlpha: 0.11 * alpha,
    stroke: COLORS.cyan,
    strokeAlpha: 0.75 * alpha,
    width: 1.5,
  });
}

function iconLineCyan(ctx, cam, alpha) {
  const dir = [1 / Math.sqrt(3), 1 / Math.sqrt(3), -1 / Math.sqrt(3)];
  const l = 1.55;
  const a = [-dir[0] * l, -dir[1] * l, -dir[2] * l];
  const b = [dir[0] * l, dir[1] * l, dir[2] * l];
  const pa = projectIcon(a, cam);
  const pb = projectIcon(b, cam);
  line2(ctx, pa[0], pa[1], pb[0], pb[1], COLORS.cyan, 0.95 * alpha, 2.4);
  dot2(ctx, pa[0], pa[1], 2.4, COLORS.cyan, alpha);
  dot2(ctx, pb[0], pb[1], 2.4, COLORS.cyan, alpha);
}

function iconFullAmber(ctx, cam, alpha) {
  // translucent amber cube, sorted faces
  const size = 1.45;
  const faces = [
    [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]],
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
    [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
    [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]],
    [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]],
    [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]],
  ].map((f) => f.map((p) => p.map((v) => v * size)));
  faces
    .map((f) => ({ f, d: f.reduce((s, p) => s + p[0] * cam.dir[0] + p[1] * cam.dir[1] + p[2] * cam.dir[2], 0) / 4 }))
    .sort((a, b) => a.d - b.d)
    .forEach(({ f }) => {
      poly3(ctx, f, cam, {
        fill: COLORS.amber,
        fillAlpha: 0.075 * alpha,
        stroke: null,
      });
    });
}

export function drawIcon(ctx, cx, cy, kind, alpha = 1) {
  if (alpha <= 0.001) return;
  const cam = makeCamera({ cx, cy, scale: 86, yaw: 65, pitch: 18 });
  // back edges
  iconCubeEdges(ctx, cam, 'back', 0.2 * alpha);

  if (kind === 'full') {
    iconFullAmber(ctx, cam, alpha);
    drawCube(ctx, cam, {
      size: 1.45,
      edgeColor: COLORS.amber,
      edgeAlpha: 0.62 * alpha,
      backEdgeAlpha: 0.28 * alpha,
      dashedBack: false,
      width: 1.4,
    });
    dot2(ctx, cx, cy, 4.4, COLORS.cyan, 0.95 * alpha);
    // subtle glow
    dot2(ctx, cx, cy, 9, COLORS.cyan, 0.1 * alpha);
  } else if (kind === 'plane') {
    iconPlaneAmber(ctx, cam, alpha);
    iconCubeEdges(ctx, cam, 'front', 0.24 * alpha);
    iconLineCyan(ctx, cam, alpha);
  } else if (kind === 'line') {
    iconLineAmber(ctx, cam, alpha);
    iconCubeEdges(ctx, cam, 'front', 0.24 * alpha);
    iconPlaneCyan(ctx, cam, alpha);
  } else if (kind === 'point') {
    iconCubeEdges(ctx, cam, 'front', 0.18 * alpha);
    drawKernelCube(ctx, cam, { alpha: 0.48 * alpha, size: 1.48, fillAlpha: 0.04 * alpha });
    dot2(ctx, cx, cy, 5.2, COLORS.amber, 0.98 * alpha);
    dot2(ctx, cx, cy, 10, COLORS.amber, 0.10 * alpha);
  }
}

function drawTableMatrix(ctx, cx, cy, matrix, alpha = 1) {
  if (alpha <= 0.001) return;
  const cellW = 48;
  const cellH = 34;
  const w = cellW * 3;
  const h = cellH * 3;
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const tick = 8;
  const bracket = 0.55 * alpha;

  line2(ctx, x0 - 12, y0 - 7, x0 - 12, y0 + h + 7, COLORS.ink, bracket, 1.2);
  line2(ctx, x0 - 12, y0 - 7, x0 - 12 + tick, y0 - 7, COLORS.ink, bracket, 1.2);
  line2(ctx, x0 - 12, y0 + h + 7, x0 - 12 + tick, y0 + h + 7, COLORS.ink, bracket, 1.2);
  line2(ctx, x0 + w + 12, y0 - 7, x0 + w + 12, y0 + h + 7, COLORS.ink, bracket, 1.2);
  line2(ctx, x0 + w + 12 - tick, y0 - 7, x0 + w + 12, y0 - 7, COLORS.ink, bracket, 1.2);
  line2(ctx, x0 + w + 12 - tick, y0 + h + 7, x0 + w + 12, y0 + h + 7, COLORS.ink, bracket, 1.2);

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const v = matrix[r][c];
      drawText(ctx, Number.isInteger(v) ? String(v) : v.toFixed(1).replace('-', '−'), x0 + c * cellW + cellW / 2, y0 + r * cellH + 24, {
        size: 20,
        family: FONT_MONO,
        color: COLORS.ink,
        alpha: alpha * 0.92,
        align: 'center',
      });
    }
  }
}

function drawReadout(ctx, { image, kernel, alpha = 1, headerAlpha = null }) {
  const x = TABLE.x + TABLE.width + 24;
  const y = 300;
  const w = 224;
  const colW = w / 2;
  const ha = headerAlpha == null ? 0.42 + 0.5 * alpha : headerAlpha;
  drawText(ctx, '秩', x + colW / 2, y + 26, {
    size: 22,
    color: COLORS.amber,
    alpha: ha,
    align: 'center',
  });
  drawText(ctx, '零度', x + colW + colW / 2, y + 26, {
    size: 22,
    color: COLORS.cyan,
    alpha: ha,
    align: 'center',
  });
  line2(ctx, x + 10, y + 46, x + w - 10, y + 46, COLORS.faint, 0.28 * ha, 1);
  line2(ctx, x + colW, y + 10, x + colW, y + 150, COLORS.faint, 0.2 * ha, 1);
  if (alpha > 0.001) {
    drawText(ctx, String(image), x + colW / 2, y + 116, {
      size: 58,
      family: FONT_MONO,
      color: COLORS.amber,
      alpha,
      align: 'center',
    });
    drawText(ctx, String(kernel), x + colW + colW / 2, y + 116, {
      size: 58,
      family: FONT_MONO,
      color: COLORS.cyan,
      alpha,
      align: 'center',
    });
  }
}

function drawTableExpr(ctx, cx, y, image, kernel, alpha, resultAlpha = 0, sum = image + kernel) {
  if (alpha <= 0.001 && resultAlpha <= 0.001) return;
  const size = 28;
  const gap = 10;
  const a = String(image);
  const b = String(kernel);
  const wa = textWidth(ctx, a, size, FONT_MONO, 400);
  const wp = textWidth(ctx, '+', size, FONT_MONO, 400);
  const wb = textWidth(ctx, b, size, FONT_MONO, 400);
  const total = wa + gap + wp + gap + wb;
  const x = cx - total / 2;
  if (alpha > 0.001) {
    drawText(ctx, a, x, y, {
      size,
      family: FONT_MONO,
      color: COLORS.amber,
      alpha,
      align: 'left',
    });
    drawText(ctx, '+', x + wa + gap, y, {
      size,
      family: FONT_MONO,
      color: COLORS.dim,
      alpha: alpha * 0.9,
      align: 'left',
    });
    drawText(ctx, b, x + wa + gap + wp + gap, y, {
      size,
      family: FONT_MONO,
      color: COLORS.cyan,
      alpha,
      align: 'left',
    });
  }
  if (resultAlpha > 0.001) {
    const eqX = x + total + gap;
    const eq = '=';
    const res = String(sum);
    const weq = textWidth(ctx, eq, size, FONT_MONO, 400);
    drawText(ctx, eq, eqX, y, {
      size,
      family: FONT_MONO,
      color: COLORS.dim,
      alpha: resultAlpha * 0.85,
      align: 'left',
    });
    drawText(ctx, res, eqX + weq + 8, y, {
      size,
      family: FONT_MONO,
      color: COLORS.ink,
      alpha: resultAlpha,
      align: 'left',
    });
  }
}

export function drawTable(
  ctx,
  {
    alpha = 1,
    columns = [1, 1, 1, 1],
    dims = [1, 1, 1, 1],
    exprAlpha = null,
    sumAlpha = 0,
    sumAlphas = null,
    highlightSum = false,
    readout = null,
  } = {}
) {
  if (alpha <= 0.001) return;
  const x0 = TABLE.x;
  const y0 = TABLE.y;
  const totalW = TABLE.width;
  const matrixBottom = y0 + TABLE.matrixH;
  const iconBottom = matrixBottom + TABLE.iconH;
  const bottom = iconBottom + TABLE.sumH;
  const sumLine = sumAlphas ? Math.max(...sumAlphas) : sumAlpha;
  const rowAlpha = highlightSum ? Math.max(alpha, 0.62) : alpha;

  // a faint panel gives the table a body even before all cells are filled
  ctx.save();
  ctx.fillStyle = rgba([12, 17, 24], 0.55 * alpha);
  ctx.fillRect(x0, y0, totalW, bottom - y0);
  ctx.restore();

  const ga = 0.18 * (0.45 + 0.55 * alpha);
  const borderGa = 0.26 * (0.45 + 0.55 * alpha);
  // vertical lines
  for (let i = 0; i <= 4; i++) {
    const x = x0 + i * TABLE.col + 0.5;
    line2(ctx, x, y0 + 0.5, x, bottom + 0.5, COLORS.faint, i === 0 || i === 4 ? borderGa : ga, 1);
  }
  // horizontal lines
  const ys = [y0, matrixBottom, iconBottom, bottom];
  for (const y of ys) {
    line2(ctx, x0 + 0.5, y + 0.5, x0 + totalW + 0.5, y + 0.5, COLORS.faint, y === y0 || y === bottom ? borderGa : ga, 1);
  }
  // sum row separator
  line2(
    ctx,
    x0 + 0.5,
    iconBottom + 0.5,
    x0 + totalW + 0.5,
    iconBottom + 0.5,
    sumLine > 0 ? COLORS.amber : COLORS.faint,
    sumLine > 0 ? 0.62 * sumLine * rowAlpha : ga,
    1.3
  );

  const matrixCy = y0 + TABLE.matrixH / 2;
  const iconCy = matrixBottom + TABLE.iconH / 2;
  for (let i = 0; i < 4; i++) {
    const cx = x0 + TABLE.col * (i + 0.5);
    const col = TABLE_COLUMNS[i];
    const ca = alpha * columns[i];
    if (ca > 0.001) {
      drawTableMatrix(ctx, cx, matrixCy, col.matrix, ca);
      drawIcon(ctx, cx, iconCy, col.kind, ca);
    }
    const ra = sumAlphas ? sumAlphas[i] : sumAlpha;
    if (exprAlpha && exprAlpha[i] > 0.001) {
      drawTableExpr(ctx, cx, iconBottom + 58, col.image, col.kernel, rowAlpha * exprAlpha[i], rowAlpha * ra, col.image + col.kernel);
    } else if (ra > 0.001) {
      drawText(ctx, '3', cx, iconBottom + 54, {
        size: 42,
        family: FONT_MONO,
        color: COLORS.ink,
        alpha: ra * rowAlpha,
      });
    }
  }
  if (sumLine > 0.001) {
    drawText(ctx, '和', x0 + 12, iconBottom + 20, {
      size: 18,
      color: COLORS.dim,
      alpha: sumLine * rowAlpha * 0.9,
      align: 'left',
    });
  }
  if (readout) {
    drawReadout(ctx, readout);
  }
}

/* ============================================================
   5. subtitles + stamps
   ============================================================ */

export function drawSubtitles(ctx, f, entries) {
  const active = entries
    .filter((e) => f >= e.start && f < e.end)
    .sort((a, b) => a.start - b.start);
  if (!active.length) return;
  const picked = active.slice(-2);
  if (picked.length === 1) {
    const e = picked[0];
    const a = windowAlpha(f, e.start, e.end, 3, 3);
    drawText(ctx, e.text, W / 2, 1005, {
      size: 40,
      color: COLORS.ink,
      alpha: a,
      weight: 400,
    });
  } else {
    const top = picked[0];
    const bottom = picked[1];
    drawText(ctx, top.text, W / 2, 951, {
      size: 40,
      color: COLORS.ink,
      alpha: windowAlpha(f, top.start, top.end, 3, 3),
      weight: 400,
    });
    drawText(ctx, bottom.text, W / 2, 1005, {
      size: 40,
      color: COLORS.ink,
      alpha: windowAlpha(f, bottom.start, bottom.end, 3, 3),
      weight: 400,
    });
  }
}

export function drawStamp(
  ctx,
  text,
  x,
  y,
  { color = COLORS.amber, alpha = 1, size = 48, align = 'left' } = {}
) {
  if (alpha <= 0.001) return;
  drawText(ctx, text, x, y, {
    size,
    weight: 500,
    color,
    alpha,
    align,
    letterSpacing: 4,
  });
  const w = textWidth(ctx, text, size, FONT_CN, 500) + 28;
  const left = align === 'left' ? x - 12 : x - w + 12;
  line2(ctx, left, y - size * 0.66, left + w, y - size * 0.66, color, alpha * 0.45, 1);
}
