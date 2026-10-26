'use strict';

/* ============================================================
   stage — the shared 3D vocabulary:
   q-grid, ghost domain, image plane, kernel, basis, columns,
   parallelogram, solution line, b / b', cube, axes.
   ============================================================ */

import {
  COLORS,
  FONT_CN,
  FONT_MONO,
  clamp,
  depthOf,
  drawText,
  label3,
  lerp,
  lerp3,
  line3,
  mix,
  smoothstep,
  point3,
  poly3,
  project,
  rgba,
  vadd,
  vcross,
  vlen,
  vmul,
  vnorm,
  arrow3,
} from './core.js';

import {
  applyA,
  applyB,
  applyJ,
  applyJPow,
  KERNEL_DIR,
} from './math.js';

const GRID = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5];

export const Q_POINTS = [];
for (const x of GRID) {
  for (const y of GRID) {
    for (const z of GRID) {
      const kernel = Math.abs(x - y) < 1e-9 && Math.abs(x + z) < 1e-9;
      Q_POINTS.push({ p: [x, y, z], idx: Q_POINTS.length, kernel });
    }
  }
}

export const Q_LINES = [];
for (let axis = 0; axis < 3; axis++) {
  const i1 = (axis + 1) % 3;
  const i2 = (axis + 2) % 3;
  for (const u of GRID) {
    for (const v of GRID) {
      const p = [0, 0, 0];
      const q = [0, 0, 0];
      p[axis] = -1.5;
      q[axis] = 1.5;
      p[i1] = u;
      q[i1] = u;
      p[i2] = v;
      q[i2] = v;
      Q_LINES.push([p, q]);
    }
  }
}

const Q_MIN = -4.5;
const Q_MAX = 4.5;

export function qColor(p) {
  const q = p[0] + p[1] + p[2];
  const t = clamp((q - Q_MIN) / (Q_MAX - Q_MIN));
  return mix(COLORS.mint, COLORS.pink, t);
}

/**
 * Draw the 343-point / 147-line lattice.
 * transform maps each point (collapse / B / J^k).
 */
export function drawQGrid(
  ctx,
  cam,
  {
    alpha = 0.26,
    pointAlpha = 0.72,
    lineAlpha = null,
    transform = null,
    tint = 0,
    kernelTint = 0,
    lineWidth = 1,
    pointRadius = 1.55,
    kernelAlphaBoost = 1,
  } = {}
) {
  const la = lineAlpha === null ? alpha : lineAlpha;
  if (la <= 0.001 && pointAlpha <= 0.001) return;
  const tf = transform || ((p) => p);

  // ---- lines: far to near ----
  if (la > 0.001) {
    const lines = Q_LINES.map(([p, q]) => {
      const pp = tf(p);
      const qq = tf(q);
      return {
        pp,
        qq,
        c1: mix(qColor(p), COLORS.amber, tint),
        c2: mix(qColor(q), COLORS.amber, tint),
        d: (depthOf(pp, cam) + depthOf(qq, cam)) * 0.5,
      };
    }).sort((a, b) => a.d - b.d);

    for (const { pp, qq, c1, c2 } of lines) {
      const a = project(pp, cam);
      const b = project(qq, cam);
      const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
      g.addColorStop(0, rgba(c1, la));
      g.addColorStop(1, rgba(c2, la));
      ctx.save();
      ctx.strokeStyle = g;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---- points: far to near ----
  if (pointAlpha > 0.001) {
    const pts = Q_POINTS.map((o) => {
      const pp = tf(o.p);
      return { o, pp, d: depthOf(pp, cam) };
    }).sort((a, b) => a.d - b.d);

    for (const { o, pp } of pts) {
      let c = mix(qColor(o.p), COLORS.amber, tint);
      let a = pointAlpha;
      if (kernelTint > 0 && o.kernel) {
        c = mix(c, COLORS.cyan, kernelTint);
        a = Math.min(1, a * kernelAlphaBoost);
      }
      const s = project(pp, cam);
      ctx.save();
      ctx.fillStyle = rgba(c, a);
      ctx.beginPath();
      ctx.arc(s[0], s[1], pointRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/** Faint original domain: points + a few long lines, no dense lattice. */
export function drawGhostDomain(ctx, cam, { alpha = 0.13 } = {}) {
  if (alpha <= 0.001) return;
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: alpha * 0.10,
    pointAlpha: alpha,
    pointRadius: 1.35,
  });
}

export function drawAxes(
  ctx,
  cam,
  { alpha = 0.28, length = 2.1, labels = true, width = 1.4 } = {}
) {
  if (alpha <= 0.001) return;
  const axes = [
    { v: [length, 0, 0], label: 'x', color: COLORS.dim },
    { v: [0, length, 0], label: 'y', color: COLORS.dim },
    { v: [0, 0, length], label: 'z', color: COLORS.dim },
  ];
  for (const { v, color } of axes) {
    line3(ctx, vmul(v, -1), v, cam, color, alpha, width);
  }
  if (labels) {
    for (const { v, label, color } of axes) {
      label3(ctx, label, v, cam, {
        dx: 0,
        dy: -14,
        size: 22,
        family: FONT_MONO,
        color,
        alpha: Math.min(1, alpha * 1.15),
      });
    }
  }
}

export function drawPlane(
  ctx,
  cam,
  {
    alpha = 0.14,
    size = 2.25,
    strokeAlpha = null,
    strokeWidth = 1,
    color = COLORS.amber,
  } = {}
) {
  if (alpha <= 0.001) return;
  const corners = [
    [-size, -size, 0],
    [size, -size, 0],
    [size, size, 0],
    [-size, size, 0],
  ];
  poly3(ctx, corners, cam, {
    fill: color,
    fillAlpha: alpha,
    stroke: color,
    strokeAlpha: strokeAlpha === null ? alpha * 0.62 : strokeAlpha,
    width: strokeWidth,
  });
}

/** A soft amber sheet with a brighter rim; used when the image plane is the subject. */
export function drawImageSheet(
  ctx,
  cam,
  { alpha = 0.14, size = 2.25, gridAlpha = 0.24 } = {}
) {
  drawPlane(ctx, cam, { alpha, size });
  if (gridAlpha > 0.001) {
    drawQGrid(ctx, cam, {
      alpha: 0,
      lineAlpha: gridAlpha,
      pointAlpha: 0,
      transform: applyA,
      tint: 0.88,
      lineWidth: 1,
    });
  }
}

export function drawKernelLine(
  ctx,
  cam,
  {
    alpha = 0.8,
    dir = KERNEL_DIR,
    length = 3.0,
    color = COLORS.cyan,
    width = 1.6,
    dash = null,
  } = {}
) {
  if (alpha <= 0.001) return;
  const a = vmul(dir, -length);
  const b = vmul(dir, length);
  line3(ctx, a, b, cam, color, alpha, width, dash);
}

export function drawKernelPlane(
  ctx,
  cam,
  { alpha = 0.14, size = 1.9, gridAlpha = 0.22 } = {}
) {
  if (alpha <= 0.001) return;
  const corners = [
    [-size, -size, 0],
    [size, -size, 0],
    [size, size, 0],
    [-size, size, 0],
  ];
  poly3(ctx, corners, cam, {
    fill: COLORS.cyan,
    fillAlpha: alpha,
    stroke: COLORS.cyan,
    strokeAlpha: alpha * 2.2,
    width: 1,
  });
  if (gridAlpha > 0.001) {
    for (let i = -3; i <= 3; i++) {
      const x = i * 0.5;
      line3(ctx, [x, -size, 0], [x, size, 0], cam, COLORS.cyan, gridAlpha, 1);
      line3(ctx, [-size, x, 0], [size, x, 0], cam, COLORS.cyan, gridAlpha, 1);
    }
  }
}

export function drawBasis(
  ctx,
  cam,
  {
    alpha = 0.9,
    vectors = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    color = COLORS.ink,
    width = 2,
    labels = false,
    labelSize = 26,
    scale = 1,
  } = {}
) {
  if (alpha <= 0.001) return;
  vectors.forEach((v0, i) => {
    const v = vmul(v0, scale);
    arrow3(ctx, [0, 0, 0], v, cam, color, alpha, width, 9);
    if (labels) {
      label3(ctx, `e${i + 1}`, v, cam, {
        dx: 0,
        dy: -18,
        size: labelSize,
        family: FONT_MONO,
        color,
        alpha,
      });
    }
  });
}

export function drawColumns(
  ctx,
  cam,
  {
    alpha = 0.9,
    vectors = [
      [1, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    color = COLORS.amber,
    width = 2.2,
    labels = true,
    labelSize = 26,
  } = {}
) {
  if (alpha <= 0.001) return;
  vectors.forEach((v, i) => {
    arrow3(ctx, [0, 0, 0], v, cam, color, alpha, width, 10);
    if (labels) {
      label3(ctx, `a${i + 1}`, v, cam, {
        dx: i === 2 ? 22 : 0,
        dy: -18,
        size: labelSize,
        family: FONT_MONO,
        color,
        alpha,
      });
    }
  });
}

export function drawParallelogram(
  ctx,
  cam,
  {
    u = [1, 0, 0],
    v = [0, 1, 0],
    alpha = 0.12,
    strokeAlpha = 0.55,
    diagonalAlpha = 0.55,
    color = COLORS.amber,
    label = false,
  } = {}
) {
  if (alpha <= 0.001 && strokeAlpha <= 0.001) return;
  const corners = [[0, 0, 0], u, vadd(u, v), v];
  poly3(ctx, corners, cam, {
    fill: color,
    fillAlpha: alpha,
    stroke: color,
    strokeAlpha,
    width: 1.5,
  });
  if (diagonalAlpha > 0.001) {
    line3(ctx, [0, 0, 0], vadd(u, v), cam, color, diagonalAlpha, 1.2, [6, 6]);
  }
  if (label) {
    label3(ctx, '列空间 = 像', vadd(u, v), cam, {
      dx: 20,
      dy: 22,
      size: 28,
      color: COLORS.amber,
      alpha: strokeAlpha,
    });
  }
}

export function drawSolutionLine(
  ctx,
  cam,
  {
    alpha = 0.85,
    origin = [1, 1, 0],
    dir = KERNEL_DIR,
    length = 1.55,
    lengthPos = null,
    color = COLORS.cyan,
    width = 2,
    dash = null,
  } = {}
) {
  if (alpha <= 0.001) return;
  const lp = lengthPos === null ? length : lengthPos;
  line3(
    ctx,
    vadd(origin, vmul(dir, -length)),
    vadd(origin, vmul(dir, lp)),
    cam,
    color,
    alpha,
    width,
    dash
  );
}

export function drawPointArrow(
  ctx,
  cam,
  {
    p,
    color = COLORS.amber,
    alpha = 1,
    width = 2.2,
    label = null,
    labelSize = 34,
    labelDx = 0,
    labelDy = -24,
    dotRadius = 4,
  } = {}
) {
  if (!p || alpha <= 0.001) return;
  arrow3(ctx, [0, 0, 0], p, cam, color, alpha, width, 10);
  point3(ctx, p, cam, dotRadius, color, alpha);
  if (label) {
    label3(ctx, label, p, cam, {
      dx: labelDx,
      dy: labelDy,
      size: labelSize,
      color,
      alpha,
    });
  }
}

export function drawGap(
  ctx,
  cam,
  {
    p = [1, 1, 1],
    alpha = 0.7,
    color = COLORS.red,
    label = '不在像上',
  } = {}
) {
  if (alpha <= 0.001) return;
  const foot = [p[0], p[1], 0];
  line3(ctx, p, foot, cam, color, alpha, 1.3, [5, 6]);
  // little broken bracket at the plane
  const a = project(foot, cam);
  const b = project(p, cam);
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 10;
  const ny = (dx / len) * 10;
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mx - nx - dx * 0.06, my - ny - dy * 0.06);
  ctx.lineTo(mx - nx + dx * 0.06, my - ny + dy * 0.06);
  ctx.moveTo(mx + nx - dx * 0.06, my + ny - dy * 0.06);
  ctx.lineTo(mx + nx + dx * 0.06, my + ny + dy * 0.06);
  ctx.stroke();
  ctx.restore();
  if (label) {
    drawText(ctx, label, mx + nx * 2.4 + 18, my + ny * 2.4, {
      size: 24,
      color,
      alpha,
      align: 'left',
    });
  }
}

/* ---------- cubes ---------- */

const CUBE_EDGES = [
  [[-1, -1, -1], [1, -1, -1]],
  [[1, -1, -1], [1, 1, -1]],
  [[1, 1, -1], [-1, 1, -1]],
  [[-1, 1, -1], [-1, -1, -1]],
  [[-1, -1, 1], [1, -1, 1]],
  [[1, -1, 1], [1, 1, 1]],
  [[1, 1, 1], [-1, 1, 1]],
  [[-1, 1, 1], [-1, -1, 1]],
  [[-1, -1, -1], [-1, -1, 1]],
  [[1, -1, -1], [1, -1, 1]],
  [[1, 1, -1], [1, 1, 1]],
  [[-1, 1, -1], [-1, 1, 1]],
];

const CUBE_FACES = [
  [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]],
  [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
  [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]],
  [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]],
  [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]],
];

export function drawCube(
  ctx,
  cam,
  {
    size = 1.5,
    edgeAlpha = 0.18,
    backEdgeAlpha = 0.12,
    edgeColor = COLORS.ink,
    fill = null,
    fillAlpha = 0,
    dashedBack = true,
    width = 1,
  } = {}
) {
  const vs = CUBE_EDGES.map(([a, b]) => [
    vmul(a, size),
    vmul(b, size),
  ]);

  if (fill && fillAlpha > 0.001) {
    const faces = CUBE_FACES.map((face) => ({
      face: face.map((p) => vmul(p, size)),
      d:
        face.reduce((s, p) => s + depthOf(vmul(p, size), cam), 0) /
        face.length,
    })).sort((a, b) => a.d - b.d);
    for (const { face } of faces) {
      poly3(ctx, face, cam, {
        fill,
        fillAlpha,
        stroke: null,
      });
    }
  }

  for (const [a, b] of vs) {
    const d = (depthOf(a, cam) + depthOf(b, cam)) * 0.5;
    const back = d < 0;
    line3(
      ctx,
      a,
      b,
      cam,
      edgeColor,
      back ? backEdgeAlpha : edgeAlpha,
      width,
      dashedBack && back ? [4, 5] : null
    );
  }
}

export function drawKernelCube(
  ctx,
  cam,
  { alpha = 0.55, size = 1.5, fillAlpha = 0.045 } = {}
) {
  drawCube(ctx, cam, {
    size,
    edgeColor: COLORS.cyan,
    edgeAlpha: alpha,
    backEdgeAlpha: alpha * 0.6,
    fill: COLORS.cyan,
    fillAlpha,
    dashedBack: false,
    width: 1.2,
  });
}

export function drawFullCube(
  ctx,
  cam,
  { color = COLORS.amber, alpha = 0.7, size = 1.5, fillAlpha = 0.09 } = {}
) {
  drawCube(ctx, cam, {
    size,
    edgeColor: color,
    edgeAlpha: alpha,
    backEdgeAlpha: alpha * 0.5,
    fill: color,
    fillAlpha,
    dashedBack: true,
    width: 1.3,
  });
}

/* ---------- composed stage states ---------- */

/** The standard L1 collapsed stage used by S1 / S2. */
export function drawCollapsedStage(
  ctx,
  cam,
  {
    ghostAlpha = 0.12,
    planeAlpha = 0.14,
    imageGridAlpha = 0.24,
    kernelAlpha = 0,
    axesAlpha = 0.18,
  } = {}
) {
  drawGhostDomain(ctx, cam, { alpha: ghostAlpha });
  drawAxes(ctx, cam, { alpha: axesAlpha });
  drawPlane(ctx, cam, { alpha: planeAlpha });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: imageGridAlpha,
    pointAlpha: 0.05,
    transform: applyA,
    tint: 0.88,
    lineWidth: 1,
  });
  if (kernelAlpha > 0.001) {
    drawKernelLine(ctx, cam, { alpha: kernelAlpha });
  }
}

/** Two-stage coda helper. */
function drawCodaImagePlane(ctx, cam, { u = 0, alpha = 1, size = 2.8 } = {}) {
  if (alpha <= 0.001) return;
  const sy = size * (1 - u);
  if (sy <= 0.025) return;
  poly3(
    ctx,
    [
      [-size, -sy, 0],
      [size, -sy, 0],
      [size, sy, 0],
      [-size, sy, 0],
    ],
    cam,
    {
      fill: COLORS.amber,
      fillAlpha: 0.14 * alpha,
      stroke: COLORS.amber,
      strokeAlpha: 0.9 * alpha,
      width: 1.6,
    }
  );
}

function drawCodaImageLine(ctx, cam, { alpha = 1, size = 2.8 } = {}) {
  if (alpha <= 0.001) return;
  line3(ctx, [-size, 0, 0], [size, 0, 0], cam, COLORS.amber, alpha * 0.95, 2.4);
}

function drawCodaKernelPlane(ctx, cam, { u = 0, alpha = 1, size = 1.9 } = {}) {
  if (alpha <= 0.001) return;
  const sy = size * u;
  if (sy <= 0.025) return;
  poly3(
    ctx,
    [
      [-size, -sy, 0],
      [size, -sy, 0],
      [size, sy, 0],
      [-size, sy, 0],
    ],
    cam,
    {
      fill: COLORS.cyan,
      fillAlpha: 0.06 * alpha,
      stroke: COLORS.cyan,
      strokeAlpha: 0.7 * alpha,
      width: 1,
    }
  );
  const ga = 0.10 * alpha * Math.min(1, u * 2);
  for (let i = -3; i <= 3; i++) {
    const x = i * 0.5;
    line3(ctx, [x, -sy, 0], [x, sy, 0], cam, COLORS.cyan, ga, 1);
    const y = i * 0.5;
    if (Math.abs(y) <= sy) {
      line3(ctx, [-size, y, 0], [size, y, 0], cam, COLORS.cyan, ga, 1);
    }
  }
}

function drawCodaKernelLine(ctx, cam, { u = 0, alpha = 1, size = 1.9 } = {}) {
  if (alpha <= 0.001) return;
  line3(ctx, [-size, 0, 0], [size, 0, 0], cam, COLORS.cyan, (0.72 - 0.2 * u) * alpha, 1.9);
}

function drawCodaKernelBox(ctx, cam, { u = 0, alpha = 1, size = 1.5 } = {}) {
  if (alpha <= 0.001) return;
  const h = size * u;
  const bottom = [
    [-size, -size, 0],
    [size, -size, 0],
    [size, size, 0],
    [-size, size, 0],
  ];
  poly3(ctx, bottom, cam, {
    fill: COLORS.cyan,
    fillAlpha: 0.025 * alpha,
    stroke: COLORS.cyan,
    strokeAlpha: 0.4 * alpha,
    width: 1,
  });
  if (h > 0.02) {
    const top = bottom.map((p) => [p[0], p[1], h]);
    poly3(ctx, top, cam, {
      fill: COLORS.cyan,
      fillAlpha: 0.02 * alpha,
      stroke: COLORS.cyan,
      strokeAlpha: 0.4 * alpha,
      width: 1,
    });
    const pts = [
      [-size, -size, -h],
      [size, -size, -h],
      [size, size, -h],
      [-size, size, -h],
      [-size, -size, h],
      [size, -size, h],
      [size, size, h],
      [-size, size, h],
    ];
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    for (const [i, j] of edges) {
      line3(ctx, pts[i], pts[j], cam, COLORS.cyan, 0.42 * alpha, 1.2);
    }
  }
  const ga = 0.10 * alpha;
  for (let i = -2; i <= 2; i++) {
    const x = i * 0.5;
    line3(ctx, [x, -size, 0], [x, size, 0], cam, COLORS.cyan, ga, 1);
    line3(ctx, [-size, x, 0], [size, x, 0], cam, COLORS.cyan, ga, 1);
  }
}

function drawCodaImagePoint(ctx, cam, { u = 0, alpha = 1 } = {}) {
  if (alpha <= 0.001) return;
  point3(ctx, [0, 0, 0], cam, 4 + 2.4 * u, COLORS.amber, alpha * (0.4 + 0.6 * u));
}

export function drawCodaStage(
  ctx,
  cam,
  {
    kind = 'A',
    k = 1,
    phase = 0,
    u = 0,
    alpha = 1,
    ghostAlpha = 0.10,
    gridAlpha = 0.20,
  } = {}
) {
  let tf;
  if (kind === 'A') {
    tf = applyA;
  } else if (phase === 1) {
    tf = (p) => [
      (1 - u) * p[1] + u * p[2],
      (1 - u) * p[2],
      0,
    ];
  } else if (phase === 2) {
    tf = (p) => [(1 - u) * p[2], 0, 0];
  } else {
    tf = (p) => applyJPow(p, 1);
  }

  drawGhostDomain(ctx, cam, { alpha: ghostAlpha * alpha });
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: gridAlpha * alpha,
    pointAlpha: 0.04 * alpha,
    transform: tf,
    tint: 0.88,
    lineWidth: 1,
  });

  if (kind === 'A') {
    drawPlane(ctx, cam, { alpha: 0.13 * alpha, size: 2.9 });
    drawKernelLine(ctx, cam, { alpha: 0.72 * alpha, length: 2.5, width: 1.7 });
  } else if (phase <= 1) {
    const uu = phase === 0 ? 0 : u;
    drawCodaKernelPlane(ctx, cam, { u: uu, alpha });
    drawCodaImagePlane(ctx, cam, { u: uu, alpha });
    drawCodaKernelLine(ctx, cam, { u: uu, alpha });
    drawCodaImageLine(ctx, cam, { alpha: alpha * Math.min(1, uu * 1.4) });
  } else {
    drawCodaKernelBox(ctx, cam, { u, alpha });
    drawCodaImageLine(ctx, cam, { alpha: alpha * (1 - u), size: 2.8 * (1 - u) });
    drawCodaImagePoint(ctx, cam, { u, alpha });
  }

  drawAxes(ctx, cam, {
    alpha: 0.55 * alpha,
    length: 2.3,
    labels: true,
    width: 1.6,
  });
}

/* ---------- coda v2: ghost control + solid state ---------- */

function codaPow(kind, k, p) {
  if (k <= 0) return p;
  return kind === 'A' ? applyA(p) : applyJPow(p, k);
}

function codaState(kind, from, to, u, p) {
  return lerp3(codaPow(kind, from, p), codaPow(kind, to, p), u);
}

function drawCodaRipple(ctx, cam, { u = 0, alpha = 1 } = {}) {
  if (u <= 0.001 || u >= 1 || alpha <= 0.001) return;
  const rings = [
    { r: 0.35 + 2.5 * u, a: 0.72 },
    { r: 0.15 + 1.8 * u, a: 0.42 },
  ];
  for (const { r, a } of rings) {
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      pts.push([r * Math.cos(t), r * Math.sin(t), 0]);
    }
    poly3(ctx, pts, cam, {
      stroke: [0, 0, 0],
      strokeAlpha: 0.22 * alpha * (1 - u),
      width: 2.6,
    });
    poly3(ctx, pts, cam, {
      stroke: COLORS.amber,
      strokeAlpha: a * alpha * (1 - u),
      width: 1.6,
    });
  }
}

function drawCodaGhost(ctx, cam, { kind, alpha = 1, u = 0, plane = 0 } = {}) {
  if (alpha <= 0.001) return;
  const one = (p) => codaPow(kind, 1, p);
  drawQGrid(ctx, cam, {
    alpha: 0,
    lineAlpha: 0.44 * alpha * (1 - 0.5 * plane),
    pointAlpha: 0.9 * alpha * (1 - 0.92 * plane),
    pointRadius: 1.7,
    transform: (p) => lerp3(p, one(p), u),
    tint: 0,
    lineWidth: 1.15,
  });
  if (plane > 0.001) {
    const s = 3.05;
    poly3(
      ctx,
      [
        [-s, -s, 0],
        [s, -s, 0],
        [s, s, 0],
        [-s, s, 0],
      ],
      cam,
      {
        fill: COLORS.amber,
        fillAlpha: 0.03 * alpha * plane,
        stroke: COLORS.amber,
        strokeAlpha: 0.34 * alpha * plane,
        width: 1.2,
        dash: [6, 7],
      }
    );
  }
}

function drawCodaKernelBack(ctx, cam, { kind, from, to, u, alpha = 1 } = {}) {
  if (kind === 'A') return;
  if (from === 1 && to === 2) {
    drawCodaKernelPlane(ctx, cam, { u, alpha, size: 2.2 });
  } else if (from === 2 && to === 3) {
    drawCodaKernelBox(ctx, cam, { u, alpha, size: 1.5 });
  }
}

function drawCodaKernelFront(ctx, cam, { kind, to, from, alpha = 1, ripple = 0 } = {}) {
  if (kind === 'A') {
    drawKernelLine(ctx, cam, {
      alpha: (0.62 + 0.16 * ripple) * alpha,
      length: 3.0,
      width: 1.6,
      dash: [6, 7],
    });
    return;
  }
  if (to <= 1) {
    line3(ctx, [-2.8, 0, 0], [2.8, 0, 0], cam, COLORS.cyan, 0.62 * alpha, 1.6, [6, 7]);
  } else if (from === 1 && to === 2) {
    line3(ctx, [-2.6, 0, 0], [2.6, 0, 0], cam, COLORS.cyan, 0.45 * alpha, 1.4, [6, 7]);
  }
}

function drawCodaSolid(ctx, cam, { kind, from, to, u, alpha = 1, ripple = 0 } = {}) {
  const state = (p) => codaState(kind, from, to, u, p);
  const showPlane = kind === 'A' || from <= 1;
  if (showPlane) {
    const fillA = alpha * 0.08 * (from === 0 ? smoothstep((u - 0.4) / 0.6) : 1);
    const base = [
      [-3, -3, 0],
      [3, -3, 0],
      [3, 3, 0],
      [-3, 3, 0],
    ];
    // The plane is the image P, not M(P). During the 1 -> 2 beat it
    // collapses to L; in all other beats it stays the same plane.
    const corners =
      kind === 'M' && from === 1
        ? base.map((p) => lerp3(p, applyJ(p), u))
        : base;
    const strokeA = 0.26 * alpha * (from === 0 ? smoothstep((u - 0.35) / 0.65) : 1);
    poly3(ctx, corners, cam, {
      fill: COLORS.amber,
      fillAlpha: fillA,
      stroke: COLORS.amber,
      strokeAlpha: strokeA,
      width: 1.4,
    });
  }

  if (kind === 'A' || from < 2) {
    const setup = from === 0;
    drawQGrid(ctx, cam, {
      alpha: 0,
      lineAlpha: (setup ? lerp(0.44, 0.24, smoothstep(u)) : 0.2) * alpha,
      pointAlpha: (setup ? lerp(0.9, 0.05, smoothstep(u)) : 0.04) * alpha,
      transform: state,
      tint: from === 0 ? 0.88 * u : 0.88,
      lineWidth: setup ? 1.15 : 1,
      pointRadius: setup ? 1.7 : 1.5,
    });
  }

  if (kind === 'M') {
    if (to === 2) {
      const lineA = alpha * smoothstep((u - 0.45) / 0.55);
      line3(ctx, [-2.8, 0, 0], [2.8, 0, 0], cam, COLORS.amber, 0.95 * lineA, 2.6);
    } else if (to === 3) {
      const len = 2.8 * (1 - u);
      line3(ctx, [-len, 0, 0], [len, 0, 0], cam, COLORS.amber, 0.95 * alpha * (1 - u), 2.6);
      const pa = alpha * smoothstep((u - 0.4) / 0.6);
      point3(ctx, [0, 0, 0], cam, 12 + 6 * u, COLORS.amber, 0.18 * pa);
      point3(ctx, [0, 0, 0], cam, 6 + 4 * u, COLORS.amber, pa);
    }
  }

  if (kind === 'A' && ripple > 0) drawCodaRipple(ctx, cam, { u: ripple, alpha });
}

function drawCodaColumns(ctx, cam, { kind, from, to, u, alpha = 1 } = {}) {
  const basis = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let i = 0; i < 3; i++) {
    const v = codaState(kind, from, to, u, basis[i]);
    const len = vlen(v);
    const color = mix(COLORS.ink, COLORS.amber, from === 0 ? u : 1);
    if (len > 0.08) {
      line3(ctx, [0, 0, 0], v, cam, [0, 0, 0], 0.55 * alpha, 6);
      arrow3(ctx, [0, 0, 0], v, cam, color, 0.98 * alpha, 3.2, 11);
      line3(ctx, [0, 0, 0], v, cam, mix(color, COLORS.ink, 0.5), 0.7 * alpha, 1);
      point3(ctx, v, cam, 3.4, color, 0.95 * alpha);
    } else {
      point3(ctx, [0, 0, 0], cam, 2.4, COLORS.amber, 0.3 * alpha);
    }
    const eA = from === 0 ? 1 - smoothstep((u - 0.1) / 0.35) : 0;
    const aA = from === 0 ? smoothstep((u - 0.45) / 0.35) : 1;
    const fade = clamp((len - 0.15) / 0.35);
    if (eA > 0.001) {
      label3(ctx, `e${i + 1}`, v, cam, {
        dx: i === 0 ? -14 : i === 1 ? 14 : 0,
        dy: -20,
        size: 28,
        family: FONT_MONO,
        color: COLORS.ink,
        alpha: eA * alpha,
      });
    }
    if (aA > 0.001 && fade > 0.001) {
      label3(ctx, `a${i + 1}`, v, cam, {
        dx: i === 0 ? -16 : i === 1 ? 14 : 20,
        dy: i === 2 ? 8 : -24,
        size: 28,
        family: FONT_MONO,
        color: COLORS.amber,
        alpha: aA * fade * alpha,
      });
    }
  }
}

export function drawCodaStageV2(
  ctx,
  cam,
  { kind = 'A', from = 0, to = 0, u = 0, alpha = 1, ghost = null, ripple = 0 } = {}
) {
  if (alpha <= 0.001) return;

  if (ghost) {
    drawCodaGhost(ctx, cam, {
      kind,
      alpha: ghost.alpha * alpha,
      u: ghost.u,
      plane: ghost.plane,
    });
  }

  drawCodaKernelBack(ctx, cam, { kind, from, to, u, alpha });
  drawCodaSolid(ctx, cam, { kind, from, to, u, alpha, ripple });
  drawCodaKernelFront(ctx, cam, { kind, from, to, u, alpha, ripple });
  drawAxes(ctx, cam, { alpha: 0.42 * alpha, length: 2.2, labels: true, width: 1.3 });
  drawCodaColumns(ctx, cam, { kind, from, to, u, alpha });
}

// keep imports used by tree-shaking-free modules
void applyB;
void applyJ;
void FONT_CN;
void point3;
void vcross;
void vlen;
void vnorm;
