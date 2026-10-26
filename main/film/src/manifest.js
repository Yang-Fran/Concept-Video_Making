'use strict';

/* ============================================================
   manifest — ordered beats, durations and transitions.
   This is the human-editable layer. Absolute starts are derived.
   ============================================================ */

export const BEATS = [
  { id: 'S0/H1', section: 'S0', label: 'H1 塌', dur: 270, layout: 'L1' },
  { id: 'S0/H2', section: 'S0', label: 'H2 四问', dur: 270, layout: 'L2' },
  { id: 'S0/H3', section: 'S0', label: 'H3 承诺', dur: 180, layout: 'L2' },
  { id: 'S0/H4', section: 'S0', label: 'H4 片名', dur: 120, layout: 'L3' },
  { id: 'S0/CARD01', section: 'S0', label: '卡 01', dur: 54, layout: 'L0' },

  { id: 'S1/C1B1', section: 'S1', label: 'C1B1 命名+维数', dur: 360, layout: 'L1' },
  { id: 'S1/C1B2', section: 'S1', label: 'C1B2 向量', dur: 660, layout: 'L1' },

  // C1B3 已并入 C1B2，编号留空；不要复用，避免旧 clip / 帧引用错位。
  { id: 'S2/C1B4', section: 'S2', label: 'C1B4 解', dur: 450, layout: 'L1' },
  { id: 'S2/C1B5B6', section: 'S2', label: 'C1B5B6 无解→可逆', dur: 660, layout: 'L1' },
  { id: 'S2/CARD02', section: 'S2', label: '卡 02', dur: 54, layout: 'L0' },

  { id: 'S3/C2B1', section: 'S3', label: 'C2B1 B 列', dur: 270, layout: 'L4' },
  { id: 'S3/C2B2', section: 'S3', label: 'C2B2 A 列', dur: 240, layout: 'L4' },
  { id: 'S3/C2B3', section: 'S3', label: 'C2B3 C 列', dur: 270, layout: 'L4' },
  { id: 'S3/C2B4', section: 'S3', label: 'C2B4 0 列', dur: 270, layout: 'L4' },

  { id: 'S4/C2B5', section: 'S4', label: 'C2B5 求和', dur: 300, layout: 'L4' },
  { id: 'S4/C2B6', section: 'S4', label: 'C2B6 定理', dur: 390, layout: 'L4→L3' },

  { id: 'S5/CARD', section: 'S5', label: 'Extra 请思考', dur: 72, layout: 'L0' },
  { id: 'S5/D1', section: 'S5', label: 'D1 同一个 2+1', dur: 450, layout: 'L5' },
  { id: 'S5/RESERVE', section: 'S5', label: '片尾 credits', dur: 60, layout: '—' },
];

export const SECTION_DEFS = [
  { id: 'S0', slug: 'hook', title: 'Hook', subtitle: '塌 / 四问 / 承诺 / 片名' },
  { id: 'S1', slug: 'halves', title: '两半', subtitle: '命名 / 维数 / 向量' },
  { id: 'S2', slug: 'equations', title: '方程', subtitle: '解 / 无解 / 可逆' },
  { id: 'S3', slug: 'table', title: '表', subtitle: 'B / A / C / 0' },
  { id: 'S4', slug: 'theorem', title: '和与定理', subtitle: '3 3 3 3 / rank-nullity' },
  { id: 'S5', slug: 'coda', title: 'Coda', subtitle: '同一个 2+1' },
];

/* Boundary transitions live after a beat; internal transitions use
   an offset from a beat start. This keeps them attached to the beat
   when durations change. */
export const TRANSITIONS = [
  { after: 'S0/H1', dur: 30, type: 'stage-shift' },
  { after: 'S0/H3', dur: 18, type: 'dip' },
  { after: 'S1/C1B2', dur: 20, type: 'crossfade' },
  { after: 'S2/C1B4', dur: 14, type: 'crossfade' },
  { after: 'S4/C2B5', dur: 20, type: 'crossfade' },
  { after: 'S4/C2B6', dur: 24, type: 'dip' },
];

const idOrder = new Map(BEATS.map((b, i) => [b.id, i]));

function nextBeatId(id) {
  const i = idOrder.get(id);
  if (i === undefined || i + 1 >= BEATS.length) return null;
  return BEATS[i + 1].id;
}

export function buildTimeline() {
  let cursor = 0;
  const beats = BEATS.map((b) => {
    const start = cursor;
    cursor += b.dur;
    return { ...b, start, end: cursor };
  });
  const byId = new Map(beats.map((b) => [b.id, b]));

  const sections = SECTION_DEFS.map((s) => {
    const list = beats.filter((b) => b.section === s.id);
    return {
      ...s,
      start: list.length ? list[0].start : 0,
      end: list.length ? list[list.length - 1].end : 0,
      beats: list.map((b) => b.id),
    };
  });

  const transitions = TRANSITIONS.map((t) => {
    if (t.after) {
      const b = byId.get(t.after);
      return {
        ...t,
        at: b ? b.end : 0,
        from: t.after,
        to: nextBeatId(t.after),
      };
    }
    const b = byId.get(t.atBeat);
    return {
      ...t,
      at: b ? b.start + (t.offset || 0) : 0,
      from: t.atBeat,
      to: t.atBeat,
    };
  }).sort((a, b) => a.at - b.at);

  return { beats, byId, sections, transitions, total: cursor };
}

export const TIMELINE = buildTimeline();
export const TOTAL_FRAMES = TIMELINE.total;

export function beatAt(f) {
  const { beats } = TIMELINE;
  if (f < 0 || f >= TOTAL_FRAMES) return null;
  let lo = 0;
  let hi = beats.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = beats[mid];
    if (f < b.start) hi = mid - 1;
    else if (f >= b.end) lo = mid + 1;
    else return b;
  }
  return null;
}

export function sectionAt(f) {
  if (f < 0 || f >= TOTAL_FRAMES) return null;
  return TIMELINE.sections.find((s) => f >= s.start && f < s.end) || null;
}

export function transitionAt(f) {
  return (
    TIMELINE.transitions.find((t) => f >= t.at && f < t.at + t.dur) || null
  );
}

export function sectionById(id) {
  return TIMELINE.sections.find((s) => s.id === id) || null;
}

export function beatById(id) {
  return TIMELINE.byId.get(id) || null;
}

export function sectionBeats(id) {
  const s = sectionById(id);
  if (!s) return [];
  return s.beats.map((bid) => TIMELINE.byId.get(bid)).filter(Boolean);
}

export function fmtTime(f, fps = 30) {
  const totalSeconds = f / fps;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
