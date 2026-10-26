'use strict';

/* ============================================================
   math — the exact matrices / vectors used on screen.
   Keep in sync with main/MATH.md.
   ============================================================ */

export const A = [
  [1, 0, 1],
  [0, 1, 1],
  [0, 0, 0],
];

export const B = [
  [1.2, -0.3, 0],
  [0.3, 1.2, 0],
  [0, 0, 1.2],
];

export const C = [
  [1, 2, 3],
  [1, 2, 3],
  [0, 0, 0],
];

export const ZERO = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

export const J = [
  [0, 1, 0],
  [0, 0, 1],
  [0, 0, 0],
];

export function apply(M, p) {
  return [
    M[0][0] * p[0] + M[0][1] * p[1] + M[0][2] * p[2],
    M[1][0] * p[0] + M[1][1] * p[1] + M[1][2] * p[2],
    M[2][0] * p[0] + M[2][1] * p[1] + M[2][2] * p[2],
  ];
}

export const applyA = (p) => apply(A, p);
export const applyB = (p) => apply(B, p);
export const applyC = (p) => apply(C, p);
export const applyJ = (p) => apply(J, p);
export const applyZero = () => [0, 0, 0];

/** Inverse of B, used for the unique preimage in C1B6. */
export function invB(p) {
  const det = 1.2 * 1.2 - -0.3 * 0.3; // 1.53
  return [
    (1.2 * p[0] + 0.3 * p[1]) / det,
    (-0.3 * p[0] + 1.2 * p[1]) / det,
    p[2] / 1.2,
  ];
}

/** A^k p; A² = A, so k >= 1 is the same plane projection. */
export function applyAPow(p, k) {
  return k <= 0 ? p : applyA(p);
}

/** J^k p; J³ = 0. */
export function applyJPow(p, k) {
  let q = p;
  for (let i = 0; i < k; i++) q = applyJ(q);
  return q;
}

export const KERNEL_DIR = (() => {
  const v = [1, 1, -1];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

export const B_IN = [1, 1, 0];
export const B_OUT = [1, 1, 1];
export const X_P = [1, 1, 0];

/** A representative b and its unique preimage under B. */
export const B_TARGET = [1.5, 0.5, 1.0];
export const B_PREIMAGE = invB(B_TARGET);
