'use strict';

/* ============================================================
   core — canvas / camera / color / text / 2D & 3D primitives
   1920×1080, 30 fps, z-up, orthographic.
   ============================================================ */

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const TOTAL = 5400;

export const BG = [7, 10, 15];

export const COLORS = {
  ink: [238, 242, 247],
  amber: [255, 180, 84],
  cyan: [95, 214, 242],
  red: [255, 95, 116],
  dim: [147, 164, 184],
  faint: [76, 97, 120],
  mint: [150, 255, 200],
  pink: [255, 130, 170],
};

export const FONT_CN =
  '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif';
export const FONT_MONO = '"Cascadia Mono",Consolas,"Courier New",monospace';
export const FONT_MATH = '"Cambria Math","Times New Roman",serif';

/* ---------- numeric ---------- */

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerp3 = (a, b, t) => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
export const smoothstep = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const mix = (a, b, t) => [
  Math.round(lerp(a[0], b[0], t)),
  Math.round(lerp(a[1], b[1], t)),
  Math.round(lerp(a[2], b[2], t)),
];
export const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function progress(f, start, end) {
  if (end <= start) return f >= end ? 1 : 0;
  return clamp((f - start) / (end - start));
}

/** 1 inside [start,end), 3-frame in/out by default. */
export function windowAlpha(f, start, end, fadeIn = 3, fadeOut = 3) {
  if (f < start || f >= end) return 0;
  let a = 1;
  if (fadeIn > 0) a = Math.min(a, (f - start + 1) / fadeIn);
  if (fadeOut > 0) a = Math.min(a, (end - f) / fadeOut);
  return clamp(a);
}

/* ---------- camera ---------- */

export function makeCamera({
  cx = 960,
  cy = 540,
  scale = 170,
  yaw = 65,
  pitch = 30,
} = {}) {
  const yr = (yaw * Math.PI) / 180;
  const pr = (pitch * Math.PI) / 180;
  const dir = [
    Math.cos(pr) * Math.sin(yr),
    -Math.cos(pr) * Math.cos(yr),
    Math.sin(pr),
  ];
  const right = [Math.cos(yr), Math.sin(yr), 0];
  const up = [
    -Math.sin(pr) * Math.sin(yr),
    Math.sin(pr) * Math.cos(yr),
    Math.cos(pr),
  ];
  return { cx, cy, scale, yaw, pitch, dir, right, up };
}

export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function project(p, cam) {
  const s = cam.scale;
  return [
    cam.cx + s * dot3(p, cam.right),
    cam.cy - s * dot3(p, cam.up),
  ];
}

export function depthOf(p, cam) {
  return dot3(p, cam.dir);
}

/* ---------- drawing: basic ---------- */

export function clear(ctx, color = BG) {
  ctx.fillStyle = rgba(color, 1);
  ctx.fillRect(0, 0, W, H);
}

export function roundRect(ctx, x, y, w, h, r = 10) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function cardSurface(
  ctx,
  x,
  y,
  w,
  h,
  {
    fill = [10, 14, 20],
    fillAlpha = 0.78,
    border = COLORS.faint,
    borderAlpha = 0.28,
    radius = 10,
    alpha = 1,
    accent = null,
  } = {}
) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = rgba(fill, fillAlpha);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(border, borderAlpha);
  ctx.stroke();
  if (accent) {
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 0.5);
    ctx.lineTo(x + w - 18, y + 0.5);
    ctx.strokeStyle = rgba(accent, 0.55);
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }
  ctx.restore();
}

export function screenGrid(ctx, alpha = 0.03, step = 80, color = COLORS.faint) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

export function withClip(ctx, x, y, w, h, fn) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  fn();
  ctx.restore();
}

/* ---------- drawing: text ---------- */

export function drawText(
  ctx,
  str,
  x,
  y,
  {
    size = 40,
    family = FONT_CN,
    weight = 400,
    style = 'normal',
    color = COLORS.ink,
    alpha = 1,
    align = 'center',
    baseline = 'middle',
    shadow = true,
    letterSpacing = 0,
    maxWidth = null,
  } = {}
) {
  if (alpha <= 0.001 || str === undefined || str === null || str === '') return;
  ctx.save();
  ctx.font = `${style} ${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.globalAlpha = clamp(alpha);
  ctx.fillStyle = rgba(color, 1);
  if (letterSpacing) ctx.letterSpacing = `${letterSpacing}px`;
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.62)';
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 1;
  }
  if (maxWidth) ctx.fillText(str, x, y, maxWidth);
  else ctx.fillText(str, x, y);
  ctx.restore();
}

export function drawTextLines(
  ctx,
  lines,
  x,
  y,
  { lineHeight = 1, size = 40, ...opts } = {}
) {
  const lh = lineHeight > 4 ? lineHeight : size * lineHeight;
  const start = y - ((lines.length - 1) * lh) / 2;
  lines.forEach((line, i) => drawText(ctx, line, x, start + i * lh, { size, ...opts }));
}

export function textWidth(ctx, str, size, family = FONT_CN, weight = 400) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/* ---------- drawing: 2D ---------- */

export function line2(ctx, x0, y0, x1, y1, color, alpha = 1, width = 1, dash = null) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

export function arrow2(
  ctx,
  x0,
  y0,
  x1,
  y1,
  color,
  alpha = 1,
  width = 2,
  head = 10
) {
  if (alpha <= 0.001) return;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return;
  const ux = dx / len;
  const uy = dy / len;
  const bx = x1 - ux * head;
  const by = y1 - uy * head;
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.fillStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(bx, by);
  ctx.stroke();
  const px = -uy;
  const py = ux;
  const half = head * 0.42;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(bx + px * half, by + py * half);
  ctx.lineTo(bx - px * half, by - py * half);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function dot2(ctx, x, y, r, color, alpha = 1) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ---------- drawing: 3D ---------- */

export function line3(ctx, p, q, cam, color, alpha = 1, width = 1, dash = null) {
  if (alpha <= 0.001) return;
  const a = project(p, cam);
  const b = project(q, cam);
  line2(ctx, a[0], a[1], b[0], b[1], color, alpha, width, dash);
}

export function arrow3(
  ctx,
  p0,
  p1,
  cam,
  color,
  alpha = 1,
  width = 2,
  head = 10
) {
  if (alpha <= 0.001) return;
  const a = project(p0, cam);
  const b = project(p1, cam);
  arrow2(ctx, a[0], a[1], b[0], b[1], color, alpha, width, head);
}

export function point3(ctx, p, cam, r, color, alpha = 1) {
  if (alpha <= 0.001) return;
  const a = project(p, cam);
  dot2(ctx, a[0], a[1], r, color, alpha);
}

export function poly3(
  ctx,
  points,
  cam,
  { fill = null, fillAlpha = 0, stroke = null, strokeAlpha = 1, width = 1, close = true, dash = null } = {}
) {
  if (points.length < 2) return;
  const pts = points.map((p) => project(p, cam));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
  if (fill && fillAlpha > 0.001) {
    ctx.fillStyle = rgba(fill, fillAlpha);
    ctx.fill();
  }
  if (stroke && strokeAlpha > 0.001) {
    ctx.strokeStyle = rgba(stroke, strokeAlpha);
    ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
  }
  ctx.restore();
}

export function label3(
  ctx,
  str,
  p,
  cam,
  {
    dx = 0,
    dy = -24,
    size = 36,
    family = FONT_CN,
    weight = 500,
    color = COLORS.ink,
    alpha = 1,
    align = 'center',
    shadow = true,
  } = {}
) {
  const a = project(p, cam);
  drawText(ctx, str, a[0] + dx, a[1] + dy, {
    size,
    family,
    weight,
    color,
    alpha,
    align,
    shadow,
  });
}

/** Screen-space bracket along a projected 3D segment. */
export function dimBracket(
  ctx,
  p0,
  p1,
  cam,
  {
    offset = 30,
    sign = 1,
    color = COLORS.dim,
    alpha = 1,
    width = 1.5,
    text = null,
    textSize = 24,
    textColor = null,
  } = {}
) {
  if (alpha <= 0.001) return;
  const a = project(p0, cam);
  const b = project(p1, cam);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const nx = (-dy / len) * offset * sign;
  const ny = (dx / len) * offset * sign;
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.fillStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a[0] + nx, a[1] + ny);
  ctx.lineTo(b[0] + nx, b[1] + ny);
  ctx.stroke();
  // ticks
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(a[0] + nx * 1.22, a[1] + ny * 1.22);
  ctx.moveTo(b[0], b[1]);
  ctx.lineTo(b[0] + nx * 1.22, b[1] + ny * 1.22);
  ctx.stroke();
  ctx.restore();
  if (text) {
    const mx = (a[0] + b[0]) / 2 + nx * 1.9;
    const my = (a[1] + b[1]) / 2 + ny * 1.9;
    drawText(ctx, text, mx, my, {
      size: textSize,
      family: FONT_MONO,
      color: textColor || color,
      alpha,
      shadow: true,
    });
  }
}

export function fadeOverlay(ctx, alpha, color = BG) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.fillStyle = rgba(color, 1);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ---------- tiny vector helpers ---------- */

export const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
export function vnorm(a) {
  const l = vlen(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
export const vcross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
