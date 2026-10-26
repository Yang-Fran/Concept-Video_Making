'use strict';

import { A, B, C, ZERO } from './math.js';

/* ============================================================
   data — copy, questions, tracker tokens, subtitles, cards.
   Subtitles are lightly tightened for 3.0–3.5 char/s; meaning
   and section ownership follow main/sections/s*.md.
   ============================================================ */

export const QUESTIONS = [
  {
    id: 0,
    full: '矩阵变换，留下几维，压掉几维？',
    docked: '留下几维',
    compact: '维度',
    token: '2+1',
    compactToken: '2+1',
    symbol: 'dims',
  },
  {
    id: 1,
    full: '三个列向量线性相关吗？',
    docked: '线性相关',
    compact: '相关',
    token: '共面',
    compactToken: '共面',
    symbol: 'plane',
  },
  {
    id: 2,
    full: '方程 Ax = b 有解吗？',
    docked: 'Ax=b 有解',
    compact: '有解',
    token: 'b 在像上',
    compactToken: 'b 在像上',
    symbol: 'solve',
  },
  {
    id: 3,
    full: '矩阵 A 可逆吗？',
    docked: 'A 可逆吗',
    compact: '可逆',
    token: 'A 降了一维',
    compactToken: 'A 降维',
    symbol: 'invert',
  },
];

export const CHAPTERS = [
  { num: '01', title: '四问一答', subtitle: '留下与压掉' },
  { num: '02', title: '变与不变', subtitle: '秩与零度，和不变' },
];

/** f5268–f5327 的 2 s credits 卡：标题 / 线 / 匿名版留空。 */
export const CREDITS = {
  title: 'AI “教与学” 作品',
  names: [],
};

export const TABLE_COLUMNS = [
  { matrix: B, image: 3, kernel: 0, kind: 'full' },
  { matrix: A, image: 2, kernel: 1, kind: 'plane' },
  { matrix: C, image: 1, kernel: 2, kind: 'line' },
  { matrix: ZERO, image: 0, kernel: 3, kind: 'point' },
];

export const SUBS = {
  s0: [
    { start: 0, end: 120, text: '线性代数中，矩阵可以表示空间的变换' },
    { start: 120, end: 269, text: '观察在变换时，空间失去了什么？' },
    { start: 430, end: 539, text: '这四个常见问题，看似无关。' },
    { start: 558, end: 640, text: '实际问的是同一件事。' },
    { start: 640, end: 719, text: '什么留下，什么被压掉。' },
  ],
  s1: [
    { start: 910, end: 1044, text: '留下的平面是像，其维数叫秩' },
    { start: 1045, end: 1194, text: '压成零的是零空间，其维数叫零度' },
    { start: 1314, end: 1428, text: '变换中，原空间的三个基向量跌入像平面' },
    { start: 1429, end: 1608, text: '三个向量共面，可以用a1, a2的线性组合表示a3' },
    { start: 1639, end: 1803, text: '原先不相关的三个基向量，变换后相关' },
  ],
  s2: [
    { start: 1914, end: 1997, text: '在像上取一个 b。' },
    { start: 1998, end: 2093, text: '回看 A，找它的原像。' },
    { start: 2094, end: 2273, text: '落到 b 的 x 是一条线，和零空间平行。' },
    { start: 2274, end: 2363, text: '这就是解集。' },
    { start: 2364, end: 2439, text: 'b′ 浮出像面。' },
    { start: 2454, end: 2559, text: '空间跌入平面，碰不到它。' },
    { start: 2679, end: 2784, text: '换一个不压掉方向的 B。' },
    { start: 2784, end: 2904, text: '倒放 B，找到唯一的 x。' },
    { start: 2904, end: 2964, text: 'B 可逆，A 不可。' },
  ],
  s3: [
    { start: 3118, end: 3218, text: '满秩矩阵什么都没压掉。' },
    { start: 3223, end: 3328, text: '对应的秩是3，零度是0。' },
    { start: 3348, end: 3448, text: '留下一个面，压掉一条线。' },
    { start: 3453, end: 3543, text: '秩是2，零度是1。' },
    { start: 3588, end: 3693, text: '只剩一条线，零空间是一个面。' },
    { start: 3698, end: 3788, text: '秩是1，零度是2。' },
    { start: 3858, end: 3978, text: '压成一个点，零空间是整个空间。' },
    { start: 3983, end: 4073, text: '秩是0，零度是3。' },
  ],
  s4: [
    { start: 4128, end: 4188, text: '四列都齐了。' },
    { start: 4188, end: 4318, text: '把像的维数和零空间的维数加起来。' },
    { start: 4318, end: 4427, text: '每一列都是3；和，确实没有变。' },
    { start: 4478, end: 4592, text: '秩 + 零度 = 原来的维数。' },
    { start: 4600, end: 4692, text: '这就是秩-零度定理。' },
    { start: 4718, end: 4817, text: '同一个和，不同命运。' },
  ],
  s5: [
    { start: 4890, end: 4991, text: 'A 把空间压成一张平面。' },
    { start: 4991, end: 5077, text: '再作用一次，平面没有动。' },
    { start: 5077, end: 5180, text: '另一个矩阵，每次像都少一维。' },
    { start: 5180, end: 5300, text: '同是秩二，为什么一个停、一个归零？' },
  ],
};

export const ALL_SUBS = [
  ...SUBS.s0,
  ...SUBS.s1,
  ...SUBS.s2,
  ...SUBS.s3,
  ...SUBS.s4,
  ...SUBS.s5,
];
