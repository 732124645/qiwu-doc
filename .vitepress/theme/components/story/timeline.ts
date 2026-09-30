/**
 * 滚动时间线：场景之间交替排列"停留"（dwell）和"过渡"（travel）。
 * 停留时画面不切换，滚动推进的是场景内部的进度（dwellP）；过渡时粒子从场景 a 变形到场景 b（u）。
 * 单位 tau：100 tau = 1/SCROLL_RATE 个视口高度。
 */

export const SCROLL_RATE = 1.4

/** 每个场景停留多久（tau），下标就是场景编号 */
export const DWELL = [8, 45, 60, 55, 75, 60, 65, 50, 150, 70]
/** 场景 i → i+1 的过渡多久（tau） */
export const TRAVEL = [85, 75, 70, 85, 85, 75, 75, 90, 85]

export const SCENE_COUNT = DWELL.length

interface Segment {
  type: 'dwell' | 'travel'
  k: number
  start: number
  end: number
}

export interface TimelineState {
  /** 过渡的起点和终点场景；停留时 b 是当前场景 */
  a: number
  b: number
  /** 过渡进度 0..1（停留时为 1，第一个场景停留时为 0） */
  morph: number
  /** 当前停留的场景；过渡时为 -1 */
  dwellK: number
  /** 停留内的进度 0..1 */
  dwellP: number
  /** 当前过渡的起点场景；停留时为 -1 */
  travelK: number
  /** 过渡进度 0..1 */
  u: number
}

export const smooth = (lo: number, hi: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export function createTimeline() {
  const segs: Segment[] = []
  let total = 0
  for (let k = 0; k < DWELL.length; k++) {
    segs.push({ type: 'dwell', k, start: total, end: total + DWELL[k]! })
    total += DWELL[k]!
    if (k < TRAVEL.length) {
      segs.push({ type: 'travel', k, start: total, end: total + TRAVEL[k]! })
      total += TRAVEL[k]!
    }
  }
  const dwellOf = (k: number) => segs.find((s) => s.type === 'dwell' && s.k === k)!
  const travelOf = (k: number) => segs.find((s) => s.type === 'travel' && s.k === k)

  function at(tau: number): TimelineState {
    const t = Math.min(Math.max(tau, 0), total)
    const seg = segs.find((s) => t <= s.end) ?? segs[segs.length - 1]!
    const p = Math.min(1, Math.max(0, (t - seg.start) / Math.max(1e-6, seg.end - seg.start)))
    if (seg.type === 'dwell') {
      return seg.k === 0
        ? { a: 0, b: 1, morph: 0, dwellK: 0, dwellP: p, travelK: -1, u: 0 }
        : { a: seg.k - 1, b: seg.k, morph: 1, dwellK: seg.k, dwellP: p, travelK: -1, u: 0 }
    }
    return { a: seg.k, b: seg.k + 1, morph: p, dwellK: -1, dwellP: 0, travelK: seg.k, u: p }
  }

  /** 场景 k 的"在场程度"：进入的过渡后半段淡入，离开的过渡前段淡出 */
  function presence(tau: number, k: number) {
    const d = dwellOf(k)
    const before = k > 0 ? travelOf(k - 1) : undefined
    const after = travelOf(k)
    if (tau < d.start) return before ? smooth(before.start + (before.end - before.start) * 0.55, before.end, tau) : 1
    if (tau > d.end) return after ? 1 - smooth(after.start, after.start + (after.end - after.start) * 0.4, tau) : 1
    return 1
  }

  /** 章节文字的显示区间：从进入过渡的 55% 到离开过渡的 35% */
  function window(first: number, last: number) {
    const before = first > 0 ? travelOf(first - 1) : undefined
    const after = travelOf(last)
    return {
      start: before ? before.start + (before.end - before.start) * 0.55 : -Infinity,
      end: after ? after.start + (after.end - after.start) * 0.35 : Infinity,
    }
  }

  /** 跳到场景 k 时的目标 tau：停留段的中间 */
  function anchor(k: number) {
    const d = dwellOf(k)
    return k === 0 ? 0 : d.start + (d.end - d.start) * 0.5
  }

  return { total, at, presence, window, anchor, dwellOf, travelOf }
}

export type Timeline = ReturnType<typeof createTimeline>
