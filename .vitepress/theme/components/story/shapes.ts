/**
 * 每个场景的粒子形状（世界坐标，单位约等于"一个字"的大小，镜头一般在 z≈16 处看向原点）。
 * 每个形状给全部 N 个粒子都安排位置：用不到的粒子作为背景星尘，散在整条飞行路径周围。
 *
 * - pos/col/size：位置、颜色（线性空间）、大小（世界单位）
 * - par：沿路径的参数 0..1，着色器用它做"光脉冲沿连线流动"
 * - delay：0..1，过渡时粒子按它错开出发；停留时按它逐步点亮（reveal）
 * - fx：[自转, 漂浮, 0, 0]；gx：[脉冲, 呼吸, 微光, 闪烁]
 */

export interface Shape {
  pos: Float32Array
  col: Float32Array
  size: Float32Array
  par: Float32Array
  delay: Float32Array
  fx: [number, number, number, number]
  gx: [number, number, number, number]
}

type V3 = [number, number, number]

const TAU = Math.PI * 2
const SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif'
const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace'

export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 正态分布随机数 */
function gauss(r: () => number) {
  let u = 0
  while (u === 0) u = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r())
}

/** sRGB 十六进制 → 线性 RGB（着色器在线性空间里做叠加和泛光，最后一道再转回 sRGB） */
function lin(hex: string): V3 {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return [f(((n >> 16) & 255) / 255), f(((n >> 8) & 255) / 255), f((n & 255) / 255)]
}

const C = {
  cyan: lin('#7ce7ff'),
  blue: lin('#4c8dff'),
  violet: lin('#a78bfa'),
  ice: lin('#cfe6ff'),
  white: lin('#ffffff'),
  warm: lin('#ffb86b'),
  gold: lin('#ffd479'),
  pink: lin('#f0abfc'),
  green: lin('#5eead4'),
  dim: lin('#3b5b9a'),
}

const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const scale3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const ramp = (stops: V3[], t: number): V3 => {
  const x = Math.min(0.9999, Math.max(0, t)) * (stops.length - 1)
  const i = Math.floor(x)
  return mix3(stops[i]!, stops[i + 1]!, x - i)
}

/** 用 Canvas 画出文字，从亮的像素中取点；返回以原点为中心、宽度为 width 的平面坐标 */
function textPoints(lines: { text: string; font: string; y: number }[], width: number, W = 1200, H = 420) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const l of lines) {
    ctx.font = l.font
    ctx.fillText(l.text, W / 2, l.y)
  }
  const data = ctx.getImageData(0, 0, W, H).data
  const pts: [number, number][] = []
  const k = width / W
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3]! > 110) pts.push([(x - W / 2) * k, (H / 2 - y) * k])
  return pts.length ? pts : [[0, 0]]
}

/** 圆角矩形的周长上取点：t∈[0,1) → [x, y, 法线x, 法线y] */
function roundRectAt(t: number, w: number, h: number, r: number) {
  const sw = w - 2 * r
  const sh = h - 2 * r
  const arc = (Math.PI / 2) * r
  const perim = 2 * sw + 2 * sh + 4 * arc
  let s = t * perim
  const corner = (cx: number, cy: number, a0: number) => {
    const a = a0 - s / r
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a), Math.sin(a)] as const
  }
  if (s < sw) return [-sw / 2 + s, h / 2, 0, 1] as const
  s -= sw
  if (s < arc) return corner(sw / 2, sh / 2, Math.PI / 2)
  s -= arc
  if (s < sh) return [w / 2, sh / 2 - s, 1, 0] as const
  s -= sh
  if (s < arc) return corner(sw / 2, -sh / 2, 0)
  s -= arc
  if (s < sw) return [sw / 2 - s, -h / 2, 0, -1] as const
  s -= sw
  if (s < arc) return corner(-sw / 2, -sh / 2, -Math.PI / 2)
  s -= arc
  if (s < sh) return [-w / 2, -sh / 2 + s, -1, 0] as const
  s -= sh
  return corner(-sw / 2, sh / 2, Math.PI)
}

/* ---------------- 场景里各元素的位置（HUD 也要用） ---------------- */

export const RINGS = [
  { r: 2.3, label: 'apps/server', color: C.gold },
  { r: 3.35, label: 'packages/shared', color: C.ice },
  { r: 4.4, label: 'apps/web', color: C.violet },
]

export const INPUT = { w: 8.8, h: 1.5, y: 0 }

export const PANELS = [
  { x: -2.55, z: -0.35, yaw: 0.34, w: 4.1, h: 4.4, color: C.cyan },
  { x: 2.55, z: -0.35, yaw: -0.34, w: 4.1, h: 4.4, color: C.violet },
].map((p) => ({
  ...p,
  toWorld: (u: number, v: number): V3 => [p.x + Math.cos(p.yaw) * u, v, p.z - Math.sin(p.yaw) * u],
}))

export const FILES = (() => {
  const cols = 7
  const out: { c: V3; name: string }[] = []
  const names = [
    'customer.entity.ts',
    'customer.service.ts',
    'customer.controller.ts',
    'customer.module.ts',
    'customer.seed.ts',
    'customer.schema.ts',
    'crm.customer.json',
    'index.vue',
    'form.vue',
    'detail.vue',
    'api/crm/customer.ts',
    'crm.customer.json (web)',
    'crm-customer.e2e-spec.ts',
    'menu-groups.seed.ts',
  ]
  for (let i = 0; i < names.length; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = (col - (cols - 1) / 2) * 1.32
    out.push({ c: [x, 0.35 - row * 1.72, -0.07 * x * x], name: names[i]! })
  }
  return out
})()

export const TREE = (() => {
  const root: V3 = [0, 2.15, 0]
  const mid: V3[] = [
    [-3.1, 0.35, 0.7],
    [0, 0.35, -0.6],
    [3.1, 0.35, 0.7],
  ]
  const leaf: V3[] = [-4.3, -2.6, -1.1, 1.1, 2.6, 4.3].map((x, i) => [x, -1.6, i % 2 ? -0.5 : 0.6])
  const edges: [V3, V3, number][] = [
    ...mid.map((m) => [root, m, 0] as [V3, V3, number]),
    ...leaf.map((l, i) => [mid[Math.floor(i / 2)]!, l, 1] as [V3, V3, number]),
  ]
  return { root, mid, leaf, edges }
})()

export const FLOW = (() => {
  const nodes: V3[] = []
  for (let i = 0; i < 5; i++) nodes.push([-4.2 + i * 2.1, 1.05 * Math.sin(i * 1.25 + 0.3), 1.2 * Math.cos(i * 0.95)])
  const labels = ['发起', '审批', '会签', '抄送', '完成']
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [1, 3],
  ]
  return { nodes, labels, edges }
})()

export const TUNNEL = {
  modules: ['用户', '角色', '菜单', '部门', '岗位', '字典', '参数', '操作日志', '定时任务', '站内信', '文件存储', '代码生成', '在线用户', '审批流'],
  /** 模块标签在隧道壁上的位置：沿 z 从近到远 */
  anchors: [] as V3[],
}
for (let i = 0; i < TUNNEL.modules.length; i++) {
  const a = i * 2.35 + 0.6
  const z = 6 - i * 4.4
  TUNNEL.anchors.push([Math.cos(a) * 5.2, Math.sin(a) * 3.2, z])
}

export const BRAND_Z = -62

/* ---------------- 形状生成 ---------------- */

export class ShapeBuilder {
  constructor(readonly N: number) {}

  /** 全部粒子先铺成背景星尘：覆盖从 z=30 到 z=-120 的整条路径，离镜头的轴线至少 3 个单位 */
  private base(seed: number): Shape {
    const N = this.N
    const s: Shape = {
      pos: new Float32Array(N * 3),
      col: new Float32Array(N * 3),
      size: new Float32Array(N),
      par: new Float32Array(N),
      delay: new Float32Array(N),
      fx: [0, 0, 0, 0],
      gx: [0, 0, 0, 0],
    }
    const r = rng(seed)
    for (let i = 0; i < N; i++) {
      const a = r() * TAU
      const rad = 3 + 34 * r() ** 1.6
      s.pos.set([Math.cos(a) * rad, Math.sin(a) * rad * 0.7, 30 - r() * 150], i * 3)
      s.col.set(scale3(mix3(C.dim, C.ice, r()), 0.05 + r() * 0.12), i * 3)
      s.size[i] = 0.05 + r() * 0.05
      s.delay[i] = r()
    }
    return s
  }

  orb(): Shape {
    const s = this.base(11)
    const r = rng(101)
    const n = Math.floor(this.N * 0.6)
    for (let i = 0; i < n; i++) {
      const k = r()
      let p: V3
      let c: V3
      let size = 0.045
      if (k < 0.62) {
        const y = r() * 2 - 1
        const a = r() * TAU
        const rr = Math.sqrt(1 - y * y)
        const d: V3 = [rr * Math.cos(a), y, rr * Math.sin(a)]
        const bump = Math.sin(d[0] * 3.1 + 1.3) * Math.sin(d[1] * 2.7) * Math.sin(d[2] * 3.4 + 0.4)
        const rad = 2.7 * (1 + 0.11 * bump) + gauss(r) * 0.04
        p = scale3(d, rad)
        c = scale3(ramp([C.cyan, C.blue, C.violet], 0.5 + 0.5 * Math.sin(d[1] * 2.2 + d[0] * 1.4 + bump * 2)), 0.34 + r() * 0.36)
        size = 0.05 + r() * 0.035
        if (r() < 0.035) {
          c = scale3(C.white, 0.95)
          size = 0.14
        }
        s.par[i] = 1
      } else if (k < 0.7) {
        const y = r() * 2 - 1
        const a = r() * TAU
        const rr = Math.sqrt(1 - y * y)
        const rad = 1.05 * r() ** 2.2
        p = [rr * Math.cos(a) * rad, y * rad, rr * Math.sin(a) * rad]
        c = scale3(C.warm, 0.5)
        size = 0.06
      } else {
        const outer = r() < 0.5
        const rad = (outer ? 4.55 : 3.9) + gauss(r) * 0.06
        const a = r() * TAU
        let x = Math.cos(a) * rad
        let y = gauss(r) * 0.03
        let z = Math.sin(a) * rad
        const tiltX = outer ? -1.05 : 1.2
        const tiltZ = outer ? -0.45 : 0.3
        ;[y, z] = [y * Math.cos(tiltX) - z * Math.sin(tiltX), y * Math.sin(tiltX) + z * Math.cos(tiltX)]
        ;[x, y] = [x * Math.cos(tiltZ) - y * Math.sin(tiltZ), x * Math.sin(tiltZ) + y * Math.cos(tiltZ)]
        p = [x, y, z]
        c = scale3(C.ice, r() < 0.1 ? 0.8 : 0.3)
      }
      s.pos.set(p, i * 3)
      s.col.set(c, i * 3)
      s.size[i] = size
    }
    s.fx = [0.06, 0.05, 0, 0]
    s.gx = [0, 0.24, 0, 0.35]
    return s
  }

  /** 星盘：三圈光环对应三个包，中心是暖色的核 */
  disk(): Shape {
    const s = this.base(12)
    const r = rng(102)
    const n = Math.floor(this.N * 0.62)
    for (let i = 0; i < n; i++) {
      const k = r()
      let p: V3
      let c: V3
      let size = 0.05 + r() * 0.03
      if (k < 0.07) {
        const y = r() * 2 - 1
        const a = r() * TAU
        const rr = Math.sqrt(1 - y * y)
        const rad = 0.6 * r() ** 1.4
        p = [rr * Math.cos(a) * rad, y * rad * 0.7, rr * Math.sin(a) * rad]
        c = scale3(C.warm, 0.85)
        size = 0.07 + r() * 0.05
      } else if (k < 0.72) {
        const ring = Math.floor(r() * RINGS.length)
        const { r: R, color } = RINGS[ring]!
        const rad = R + gauss(r) * (0.07 + R * 0.012)
        const a = r() * TAU
        p = [Math.cos(a) * rad, gauss(r) * 0.04, Math.sin(a) * rad]
        c = scale3(color, 0.32 + r() * 0.34)
        if (r() < 0.03) {
          c = scale3(C.white, 0.9)
          size = 0.13
        }
        s.delay[i] = ring / RINGS.length + r() * 0.2
      } else {
        const rad = 0.8 + 5.2 * Math.sqrt(r())
        const a = (r() < 0.5 ? 0 : Math.PI) + Math.log(rad) * 2.3 + gauss(r) * 0.3
        p = [Math.cos(a) * rad, gauss(r) * 0.1, Math.sin(a) * rad]
        c = scale3(C.dim, 0.2)
        size = 0.045
      }
      s.pos.set(p, i * 3)
      s.col.set(c, i * 3)
      s.size[i] = size
    }
    s.fx = [0.3, 0, 0, 0]
    return s
  }

  /** 输入框：光沿边框流动（par = 周长上的位置） */
  input(): Shape {
    const s = this.base(13)
    const r = rng(103)
    const n = Math.floor(this.N * 0.34)
    const { w, h, y: cy } = INPUT
    for (let i = 0; i < n; i++) {
      const k = r()
      let p: V3
      let c: V3
      if (k < 0.52) {
        const t = r()
        const [x, y, nx, ny] = roundRectAt(t, w, h, 0.75)
        const off = gauss(r) * 0.022
        p = [x + nx * off, cy + y + ny * off, gauss(r) * 0.02]
        c = scale3(mix3(C.cyan, C.violet, (x + w / 2) / w), 0.55)
        s.par[i] = Math.max(0.001, t)
      } else if (k < 0.8) {
        const [x, y, nx, ny] = roundRectAt(r(), w, h, 0.75)
        const off = Math.abs(gauss(r)) * 0.3
        p = [x + nx * off, cy + y + ny * off, gauss(r) * 0.08]
        c = scale3(mix3(C.cyan, C.violet, (x + w / 2) / w), 0.12)
      } else if (k < 0.9) {
        p = [(r() * 2 - 1) * (w / 2 - 0.6), cy + (r() * 2 - 1) * (h / 2 - 0.2), -0.05]
        c = scale3(C.dim, 0.05)
      } else {
        const a = r() * TAU
        const rad = 0.4 + gauss(r) * 0.02
        p = [w / 2 - 0.72 + Math.cos(a) * rad, cy + Math.sin(a) * rad, 0]
        c = scale3(C.white, 0.45)
      }
      s.pos.set(p, i * 3)
      s.col.set(c, i * 3)
      s.size[i] = 0.045
    }
    s.gx = [0.9, 0, 0, 0.35]
    return s
  }

  /** 两块斜对着的面板：左边后端、右边前端。代码行按行号延迟（逐行写出来） */
  panels(): Shape {
    const s = this.base(14)
    const r = rng(104)
    const per = Math.floor((this.N * 0.5) / PANELS.length)
    const rows = [0.92, 0.7, 0.84, 0.55, 0.9, 0.62, 0.78, 0.4]
    for (let pi = 0; pi < PANELS.length; pi++) {
      const pnl = PANELS[pi]!
      for (let j = 0; j < per; j++) {
        const i = pi * per + j
        const k = r()
        let u: number
        let v: number
        let c: V3
        let size = 0.045
        let delay = r() * 0.08
        if (k < 0.18) {
          const [x, y] = roundRectAt(r(), pnl.w, pnl.h, 0.3)
          u = x + gauss(r) * 0.01
          v = y + gauss(r) * 0.01
          c = scale3(C.dim, 0.3)
        } else if (k < 0.22) {
          u = (r() * 2 - 1) * (pnl.w / 2 - 0.2)
          v = pnl.h / 2 - 0.7 + gauss(r) * 0.008
          c = scale3(C.dim, 0.2)
        } else {
          const row = Math.floor(r() * rows.length)
          const len = (pnl.w - 0.6) * rows[row]!
          const t = r()
          u = -pnl.w / 2 + 0.3 + t * len
          v = pnl.h / 2 - 1.1 - row * 0.42 + gauss(r) * 0.026
          c = scale3(pnl.color, 0.5 + r() * 0.25)
          delay = (row + t) / rows.length
          size = 0.048
        }
        s.pos.set(pnl.toWorld(u, v), i * 3)
        s.col.set(c, i * 3)
        s.size[i] = size
        s.delay[i] = delay
      }
    }
    s.gx = [0, 0, 0, 0.35]
    return s
  }

  /** 表名 + 14 个文件卡片，卡片按顺序生成 */
  files(): Shape {
    const s = this.base(15)
    const r = rng(105)
    const title = textPoints([{ text: 'crm_customer', font: `800 150px ${MONO}`, y: 210 }], 8.4)
    const nTitle = Math.floor(this.N * 0.16)
    for (let i = 0; i < nTitle; i++) {
      const [x, y] = title[Math.floor(r() * title.length)]!
      s.pos.set([x + gauss(r) * 0.01, y + 2.75, gauss(r) * 0.04], i * 3)
      s.col.set(scale3(mix3(C.green, C.cyan, (x + 4.2) / 8.4), 0.55 + r() * 0.2), i * 3)
      s.size[i] = 0.045
      s.delay[i] = 0
    }
    const per = Math.floor((this.N * 0.38) / FILES.length)
    const cw = 1.05
    const ch = 1.36
    for (let f = 0; f < FILES.length; f++) {
      const { c: center } = FILES[f]!
      const color = ramp([C.cyan, C.blue, C.violet], f / (FILES.length - 1))
      for (let j = 0; j < per; j++) {
        const i = nTitle + f * per + j
        const k = r()
        let x: number
        let y: number
        let c: V3
        if (k < 0.45) {
          ;[x, y] = roundRectAt(r(), cw, ch, 0.12)
          c = scale3(color, 0.55)
        } else if (k < 0.9) {
          const line = Math.floor(r() * 4)
          x = -cw / 2 + 0.15 + r() * (cw - 0.3) * [0.85, 0.6, 0.75, 0.45][line]!
          y = ch / 2 - 0.35 - line * 0.24
          c = scale3(color, 0.35)
        } else {
          x = (r() - 0.5) * (cw - 0.2)
          y = (r() - 0.5) * (ch - 0.2)
          c = scale3(C.dim, 0.08)
        }
        s.pos.set([center[0] + x, center[1] + y, center[2] + gauss(r) * 0.02], i * 3)
        s.col.set(c, i * 3)
        s.size[i] = 0.042
        s.delay[i] = (f + r() * 0.6) / FILES.length
      }
    }
    s.gx = [0, 0, 0.35, 0.3]
    return s
  }

  /** 立体的组织树：光从根往叶子流（par 按层级递增） */
  tree(): Shape {
    const s = this.base(16)
    const r = rng(106)
    const n = Math.floor(this.N * 0.46)
    const nodes: [V3, number, number][] = [
      [TREE.root, 0.5, 0],
      ...TREE.mid.map((m) => [m, 0.38, 1] as [V3, number, number]),
      ...TREE.leaf.map((l) => [l, 0.28, 2] as [V3, number, number]),
    ]
    for (let i = 0; i < n; i++) {
      const k = r()
      let p: V3
      let c: V3
      let size = 0.045
      if (k < 0.4) {
        const [center, rad, level] = nodes[Math.floor(r() * nodes.length)]!
        const y = r() * 2 - 1
        const a = r() * TAU
        const rr = Math.sqrt(1 - y * y)
        const d = rad * r() ** 0.5
        p = [center[0] + rr * Math.cos(a) * d, center[1] + y * d, center[2] + rr * Math.sin(a) * d]
        c = scale3(mix3(C.gold, C.white, r() * 0.4), 0.45 + r() * 0.3)
        s.delay[i] = level / 3 + r() * 0.05
        size = 0.05
      } else {
        const [a, b, level] = TREE.edges[Math.floor(r() * TREE.edges.length)]!
        const ctrl: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.55, (a[2] + b[2]) / 2]
        const t = r()
        const q = 1 - t
        p = [0, 1, 2].map((d) => q * q * a[d]! + 2 * q * t * ctrl[d]! + t * t * b[d]! + gauss(r) * 0.02) as V3
        c = scale3(mix3(C.warm, C.gold, t), 0.28)
        s.par[i] = Math.max(0.001, (level + t) / 2)
        s.delay[i] = (level + t) / 3
      }
      s.pos.set(p, i * 3)
      s.col.set(c, i * 3)
      s.size[i] = size
    }
    s.fx = [0, 0.02, 0, 0]
    s.gx = [1, 0, 0, 0.3]
    return s
  }

  /** 审批流程图：节点沿三维曲线排开，光脉冲沿连线流动 */
  flow(): Shape {
    const s = this.base(17)
    const r = rng(107)
    const n = Math.floor(this.N * 0.45)
    const { nodes, edges } = FLOW
    for (let i = 0; i < n; i++) {
      const k = r()
      let p: V3
      let c: V3
      let size = 0.045
      if (k < 0.34) {
        const ni = Math.floor(r() * nodes.length)
        const center = nodes[ni]!
        const y = r() * 2 - 1
        const a = r() * TAU
        const rr = Math.sqrt(1 - y * y)
        const d = 0.38 * r() ** 0.5
        p = [center[0] + rr * Math.cos(a) * d, center[1] + y * d, center[2] + rr * Math.sin(a) * d]
        c = scale3(mix3(C.white, C.cyan, r() * 0.5), 0.45 + r() * 0.3)
        s.delay[i] = ni / nodes.length + r() * 0.05
        size = 0.05
      } else if (k < 0.44) {
        const ni = Math.floor(r() * nodes.length)
        const center = nodes[ni]!
        const a = r() * TAU
        const rad = 0.62 + gauss(r) * 0.03
        p = [center[0] + Math.cos(a) * rad, center[1] + Math.sin(a) * rad * 0.35, center[2] + Math.sin(a) * rad]
        c = scale3(C.ice, 0.25)
        s.delay[i] = ni / nodes.length
      } else {
        const ei = Math.floor(r() * edges.length)
        const [ia, ib] = edges[ei]!
        const a = nodes[ia]!
        const b = nodes[ib]!
        const lift = ei === edges.length - 1 ? -1.3 : 0.55
        const ctrl: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + lift, (a[2] + b[2]) / 2 + 0.3]
        const t = r()
        const q = 1 - t
        p = [0, 1, 2].map((d) => q * q * a[d]! + 2 * q * t * ctrl[d]! + t * t * b[d]! + gauss(r) * 0.022) as V3
        c = scale3(mix3(C.blue, C.violet, t), 0.28)
        s.par[i] = Math.max(0.001, (ia + t) / (nodes.length - 1))
        s.delay[i] = (ia + t) / nodes.length
      }
      s.pos.set(p, i * 3)
      s.col.set(c, i * 3)
      s.size[i] = size
    }
    s.fx = [0, 0.02, 0, 0]
    s.gx = [1, 0, 0, 0.35]
    return s
  }

  /** 中英双语：粒子文字"你好 / Hello" */
  hello(): Shape {
    const s = this.base(18)
    const r = rng(108)
    const zh = textPoints([{ text: '你好', font: `900 300px ${SANS}`, y: 210 }], 5.2)
    const en = textPoints([{ text: 'Hello', font: `900 260px ${SANS}`, y: 210 }], 6.4)
    const n = Math.floor(this.N * 0.46)
    for (let i = 0; i < n; i++) {
      const isZh = i % 2 === 0
      const pts = isZh ? zh : en
      const [x, y] = pts[Math.floor(r() * pts.length)]!
      const p: V3 = isZh ? [x - 1.6, y + 1.1, 0.4 + gauss(r) * 0.05] : [x + 1.5, y - 1.2, -0.4 + gauss(r) * 0.05]
      s.pos.set(p, i * 3)
      s.col.set(scale3(isZh ? mix3(C.cyan, C.ice, r() * 0.5) : mix3(C.violet, C.pink, r() * 0.5), 0.45 + r() * 0.25), i * 3)
      s.size[i] = 0.042
      s.delay[i] = isZh ? r() * 0.5 : 0.5 + r() * 0.5
    }
    s.gx = [0, 0.1, 0.3, 0.5]
    return s
  }

  /** 隧道：一圈圈光环沿 z 排开，镜头从中间一路飞到品牌；颜色由近到远从青到紫再到粉 */
  tunnel(): Shape {
    const s = this.base(19)
    const r = rng(109)
    const n = Math.floor(this.N * 0.82)
    const Z0 = 18
    const Z1 = -76
    for (let i = 0; i < n; i++) {
      const a = r() * TAU
      const hoop = r() < 0.55
      // 光环：z 取整到每 3.2 个单位一圈，环很细；其余粒子散在隧道壁上
      const z = hoop ? Z0 - Math.floor(r() * ((Z0 - Z1) / 3.2)) * 3.2 + gauss(r) * 0.05 : Z1 + r() * (Z0 - Z1)
      const rad = hoop ? 6.6 + gauss(r) * 0.08 : 7.2 + gauss(r) * 0.9
      s.pos.set([Math.cos(a) * rad, Math.sin(a) * rad * 0.8, z], i * 3)
      const depth = (Z0 - z) / (Z0 - Z1)
      const bright = r() < 0.06
      const base = ramp([C.cyan, C.blue, C.violet, C.pink], depth)
      s.col.set(scale3(base, bright ? 0.9 : hoop ? 0.34 + r() * 0.2 : 0.18 + r() * 0.2), i * 3)
      s.size[i] = bright ? 0.13 : hoop ? 0.07 : 0.075
      s.par[i] = hoop ? 1 : 0
    }
    s.fx = [0, 0.03, 0, 0]
    s.gx = [0, 0, 0, 0.4]
    return s
  }

  /** 结尾："栖梧"两个字停在隧道尽头 */
  brand(): Shape {
    const s = this.base(20)
    const r = rng(110)
    const pts = textPoints([{ text: '栖梧', font: `900 330px ${SANS}`, y: 210 }], 7.2)
    const n = Math.floor(this.N * 0.42)
    const halo = Math.floor(this.N * 0.08)
    for (let i = 0; i < n; i++) {
      const [x, y] = pts[Math.floor(r() * pts.length)]!
      s.pos.set([x + gauss(r) * 0.008, y + 1.1 + gauss(r) * 0.008, BRAND_Z + gauss(r) * 0.06], i * 3)
      let c = scale3(mix3(C.ice, C.cyan, ((x + 3.6) / 7.2) * 0.6), 0.16 + r() * 0.12)
      let size = 0.05
      if (r() < 0.02) {
        c = scale3(C.white, 0.7)
        size = 0.1
      }
      s.col.set(c, i * 3)
      s.size[i] = size
    }
    for (let j = 0; j < halo; j++) {
      const i = n + j
      s.pos.set([gauss(r) * 5.2, 1.4 + gauss(r) * 1.7, BRAND_Z - 2.5 + gauss(r) * 1.2], i * 3)
      s.col.set(scale3(mix3(C.cyan, C.violet, r()), 0.07), i * 3)
      s.size[i] = 0.07
    }
    s.fx = [0, 0.015, 0, 0]
    s.gx = [0, 0, 0, 0.5]
    return s
  }

  all(): Shape[] {
    return [this.orb(), this.disk(), this.input(), this.panels(), this.files(), this.tree(), this.flow(), this.hello(), this.tunnel(), this.brand()]
  }
}
