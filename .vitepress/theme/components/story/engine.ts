/**
 * 粒子舞台：three.js 渲染几万个粒子，在场景形状之间变形；镜头按场景编排，隧道一段镜头向前飞。
 * 只在浏览器里动态导入（首页组件的 onMounted），不参与服务端渲染。
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  MathUtils,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShapeBuilder, rng, type Shape } from './shapes'
import { createTimeline, ease, type Timeline, type TimelineState } from './timeline'

/** 每段过渡的手感：stagger 越大粒子出发越错开，swirl 越大中途越"流" */
const MOTION = [
  { stagger: 1.2, swirl: 0.9 },
  { stagger: 1.0, swirl: 0.6 },
  { stagger: 2.2, swirl: 0.35 },
  { stagger: 1.4, swirl: 0.7 },
  { stagger: 1.2, swirl: 0.6 },
  { stagger: 1.0, swirl: 0.7 },
  { stagger: 1.2, swirl: 0.6 },
  { stagger: 1.4, swirl: 0.8 },
  { stagger: 1.2, swirl: 0.5 },
]
/** 停留时逐步点亮（按 delay）的场景 */
const REVEAL = new Set([3, 4, 5, 6])

type Layout = 'right' | 'center'
interface Cam {
  target: [number, number, number]
  offset: [number, number, number]
  layout: Layout
  fov: number
  flight?: boolean
}
const CAMS: Cam[] = [
  { target: [0, 0, 0], offset: [0, 0.6, 16.5], layout: 'right', fov: 38 },
  { target: [0, -0.3, 0], offset: [0, 6.4, 13.4], layout: 'right', fov: 38 },
  { target: [0, 0, 0], offset: [0, 0.2, 14.2], layout: 'center', fov: 38 },
  { target: [0, 0.1, -0.2], offset: [0, 0.5, 15.2], layout: 'center', fov: 38 },
  { target: [0, 0.9, 0], offset: [-4.5, 2.2, 16], layout: 'right', fov: 38 },
  { target: [0, 0.3, 0], offset: [4.2, 1.8, 16.6], layout: 'right', fov: 38 },
  { target: [0, 0, 0], offset: [0, 3, 16.4], layout: 'right', fov: 38 },
  { target: [0, 0, 0], offset: [0, 0.4, 15.5], layout: 'center', fov: 38 },
  { target: [0, 0, 3], offset: [0, 0, 14], layout: 'center', fov: 62, flight: true },
  { target: [0, -1.6, -62], offset: [0, 0.2, 16], layout: 'center', fov: 38 },
]

const VERT = /* glsl */ `
uniform float uTime;
uniform float uMorph;
uniform float uStagger;
uniform float uSwirl;
uniform float uProj;
uniform float uFade;
uniform float uAspect;
uniform float uReveal;
uniform float uRevealOn;
uniform vec2 uMouse;
uniform float uMouseForce;
uniform vec4 uFxA;   // 自转、漂浮
uniform vec4 uFxB;
uniform vec4 uGxA;   // 脉冲、呼吸、微光、闪烁
uniform vec4 uGxB;

attribute vec3 aPosA;
attribute vec3 aPosB;
attribute vec3 aColA;
attribute vec3 aColB;
attribute float aSizeA;
attribute float aSizeB;
attribute float aParA;
attribute float aParB;
attribute float aDelayB;
attribute vec4 aRnd;

varying vec3 vColor;
varying float vAlpha;

const float TAU = 6.28318530718;

mat2 rot(float a) { float c = cos(a); float s = sin(a); return mat2(c, -s, s, c); }

vec3 animate(vec3 p, vec4 fx, vec4 gx, float par, inout vec3 col) {
  float t = uTime;
  if (gx.y > 0.0 && par > 0.5) {
    // 呼吸：沿法线起伏
    float n = sin(p.x * 1.15 + t * 0.9) * sin(p.y * 1.3 - t * 0.7) * sin(p.z * 1.2 + t * 0.55);
    p += normalize(p + 1e-4) * n * gx.y;
  }
  if (fx.x > 0.0) {
    // 差速旋转：越靠内转得越快
    float r = length(p.xz);
    p.xz = rot(t * fx.x * (1.4 / (0.5 + r * 0.45))) * p.xz;
  }
  if (fx.y > 0.0) {
    p += fx.y * vec3(
      sin(t * 0.31 + p.y * 0.8 + aRnd.x * TAU),
      sin(t * 0.27 + p.z * 0.7 + aRnd.y * TAU),
      sin(t * 0.23 + p.x * 0.6 + aRnd.z * TAU));
  }
  if (gx.z > 0.0) col *= 1.0 + gx.z * 0.45 * sin(t * 2.6 + p.x * 1.7 + p.y * 0.8);
  if (gx.x > 0.0 && par > 0.0) {
    // 光脉冲：沿 par 往前跑
    float pulse = pow(max(0.0, sin(par * 18.0 - t * 3.6)), 12.0);
    col += vec3(0.25, 0.8, 1.0) * pulse * gx.x * 1.4;
  }
  if (gx.w > 0.0) col *= 1.0 + gx.w * pow(max(0.0, sin(t * (1.2 + aRnd.z * 2.0) + aRnd.x * TAU)), 16.0) * 2.5;
  return p;
}

void main() {
  vec3 cA = aColA;
  vec3 cB = aColB;
  if (uRevealOn > 0.5) cB *= mix(0.22, 1.0, step(aDelayB, uReveal));
  vec3 pA = animate(aPosA, uFxA, uGxA, aParA, cA);
  vec3 pB = animate(aPosB, uFxB, uGxB, aParB, cB);

  // 每个粒子按 aDelayB 错开出发
  float m = clamp(uMorph * (1.0 + uStagger) - aDelayB * uStagger, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  vec3 p = mix(pA, pB, m);

  // 过渡中段的涡旋：粒子"流"过去，而不是直线飞过去
  float arc = sin(3.14159265 * m);
  vec3 sw = vec3(
    sin(p.y * 0.42 + aRnd.x * TAU + uTime * 0.6),
    sin(p.z * 0.42 + aRnd.y * TAU + uTime * 0.5),
    sin(p.x * 0.42 + aRnd.z * TAU + uTime * 0.4));
  p += sw * arc * uSwirl * (0.5 + aRnd.w * 1.2);
  p.xz = rot(arc * uSwirl * 0.6 * (aRnd.x - 0.5)) * p.xz;

  vec3 col = mix(cA, cB, m);
  float size = mix(aSizeA, aSizeB, m);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / max(clip.w, 1e-3);
  vec2 dd = (ndc - uMouse) * vec2(uAspect, 1.0);
  float push = uMouseForce * exp(-dot(dd, dd) * 18.0);
  mv.xy += normalize(dd + vec2(1e-5)) * push * 0.9 * (0.6 + aRnd.w);
  col *= 1.0 + push * 1.6;

  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 0.01);
  float ps = size * uProj / depth;
  vAlpha = uFade * smoothstep(0.8, 3.5, depth) * clamp(ps, 0.0, 1.0);
  gl_PointSize = clamp(ps, 1.0, 32.0);
  vColor = col;
}
`

const FRAG = /* glsl */ `
uniform float uGain;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, d);
  float a = soft * soft * 0.85 + smoothstep(0.14, 0.0, d) * 0.55;
  gl_FragColor = vec4(vColor * a * vAlpha * uGain, 1.0);
}
`

/** 最后一道：转 sRGB、暗角、胶片颗粒、边缘轻微色差 */
const FINAL = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new Vector2(1, 1) } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    void main() {
      vec2 cc = vUv - 0.5;
      float r2 = dot(cc, cc);
      vec2 off = cc * r2 * 0.012;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col = toSrgb(col);
      col *= 1.0 - smoothstep(0.18, 0.62, r2) * 0.5;
      col += (hash(floor(vUv * uRes) + floor(fract(uTime * 3.0) * 97.0)) - 0.5) * 0.028;
      col += vec3(3.0, 5.0, 10.0) / 255.0;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
}

export interface Projector {
  width: number
  height: number
  toScreen(p: readonly number[]): { x: number; y: number; behind: boolean }
  depthOf(p: readonly number[]): number
}

export interface Frame {
  S: TimelineState
  tau: number
  time: number
  presence: (k: number) => number
  project: Projector
  narrow: boolean
}

export interface StageOptions {
  stage: HTMLElement
  canvas: HTMLCanvasElement
  /** 当前滚动对应的 tau（未平滑） */
  readTau: () => number
  reduced: () => boolean
  onFrame: (f: Frame) => void
}

function quality(stage: HTMLElement) {
  const coarse = matchMedia('(pointer: coarse)').matches
  const w = stage.clientWidth || innerWidth
  const h = stage.clientHeight || innerHeight
  const low = coarse || Math.min(w, h) < 700
  return {
    low,
    particles: low ? 22000 : 64000,
    bloom: !low,
    gain: low ? 0.62 : 0.5,
    pixelRatio: (width: number, height: number) =>
      Math.max(1, Math.min(devicePixelRatio || 1, low ? 1.25 : 1.5, Math.sqrt((low ? 1.6e6 : 3e6) / Math.max(1, width * height)))),
  }
}

export function createStage(opts: StageOptions) {
  const { stage, canvas } = opts
  const q = quality(stage)
  const timeline: Timeline = createTimeline()
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 1)
  const scene = new Scene()
  const camera = new PerspectiveCamera(38, 1, 0.1, 400)

  const N = q.particles
  const shapes = new ShapeBuilder(N).all()
  const geo = new BufferGeometry()
  const r = rng(3)
  const rnd = new Float32Array(N * 4)
  for (let i = 0; i < rnd.length; i++) rnd[i] = r()
  geo.setAttribute('aRnd', new BufferAttribute(rnd, 4))

  interface Attrs {
    pos: BufferAttribute
    col: BufferAttribute
    size: BufferAttribute
    par: BufferAttribute
    delay: BufferAttribute
  }
  const cache = new Map<Shape, Attrs>()
  const attrsOf = (s: Shape) => {
    let a = cache.get(s)
    if (!a) {
      a = {
        pos: new BufferAttribute(s.pos, 3),
        col: new BufferAttribute(s.col, 3),
        size: new BufferAttribute(s.size, 1),
        par: new BufferAttribute(s.par, 1),
        delay: new BufferAttribute(s.delay, 1),
      }
      cache.set(s, a)
    }
    return a
  }

  const U = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uStagger: { value: 1 },
    uSwirl: { value: 0 },
    uProj: { value: 1000 },
    uFade: { value: 0 },
    uAspect: { value: 1 },
    uReveal: { value: 1 },
    uRevealOn: { value: 0 },
    uMouse: { value: new Vector2(9, 9) },
    uMouseForce: { value: 0 },
    uGain: { value: q.gain },
    uFxA: { value: new Vector4() },
    uFxB: { value: new Vector4() },
    uGxA: { value: new Vector4() },
    uGxB: { value: new Vector4() },
  }
  const points = new Points(
    geo,
    new ShaderMaterial({
      uniforms: U,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    }),
  )
  points.frustumCulled = false
  scene.add(points)

  let pair = ''
  function bind(a: number, b: number) {
    const key = `${a}>${b}`
    if (key === pair) return
    pair = key
    const A = attrsOf(shapes[a]!)
    const B = attrsOf(shapes[b]!)
    geo.setAttribute('position', A.pos)
    geo.setAttribute('aPosA', A.pos)
    geo.setAttribute('aPosB', B.pos)
    geo.setAttribute('aColA', A.col)
    geo.setAttribute('aColB', B.col)
    geo.setAttribute('aSizeA', A.size)
    geo.setAttribute('aSizeB', B.size)
    geo.setAttribute('aParA', A.par)
    geo.setAttribute('aParB', B.par)
    geo.setAttribute('aDelayB', B.delay)
    U.uFxA.value.fromArray(shapes[a]!.fx)
    U.uFxB.value.fromArray(shapes[b]!.fx)
    U.uGxA.value.fromArray(shapes[a]!.gx)
    U.uGxB.value.fromArray(shapes[b]!.gx)
  }

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = q.bloom ? new UnrealBloomPass(new Vector2(stage.clientWidth, stage.clientHeight), 0.55, 0.4, 0.22) : null
  if (bloom) composer.addPass(bloom)
  const final = new ShaderPass(FINAL)
  composer.addPass(final)

  const narrow = () => stage.clientWidth / Math.max(1, stage.clientHeight) < 0.9

  // 减少动态效果模式下，画面不变就不重画；记下上次画的是什么
  let drawnTau = Number.NaN
  let drawnW = 0
  function resize() {
    const w = Math.max(1, stage.clientWidth)
    const h = Math.max(1, stage.clientHeight)
    const pr = q.pixelRatio(w, h)
    renderer.setPixelRatio(pr)
    renderer.setSize(w, h, false)
    composer.setPixelRatio(pr)
    composer.setSize(w, h)
    bloom?.setSize(w, h)
    final.uniforms.uRes!.value.set(w * pr, h * pr)
    camera.aspect = w / h
    drawnTau = Number.NaN
  }
  resize()
  let resizeTimer = 0
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(resize, 150)
  })
  ro.observe(stage)

  // 鼠标：靠近的粒子被推开
  const mouse = { x: 9, y: 9, sx: 0, sy: 0, active: 0, at: -10 }
  const fine = matchMedia('(pointer: fine)').matches
  const onMove = (e: PointerEvent) => {
    const rect = stage.getBoundingClientRect()
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    mouse.at = performance.now()
  }
  const onLeave = () => (mouse.at = -10)
  if (fine) {
    window.addEventListener('pointermove', onMove, { passive: true })
    stage.addEventListener('pointerleave', onLeave)
  }

  /* ---------------- 镜头 ---------------- */
  function camOf(k: number, p: number, time: number, reduced: boolean) {
    const c = CAMS[k]!
    if (c.flight) {
      // 减少动态效果：镜头停在隧道里一个固定位置，不随滚动纵深穿越
      if (reduced) p = 0.1
      const z = 17 - ease(p) * 61
      const x = reduced ? 0 : Math.sin(p * 5.5) * 0.9
      return {
        pos: [x, reduced ? 0 : Math.cos(p * 4) * 0.5, z],
        target: [x * 0.4 + (reduced ? 0 : Math.sin(p * 3) * 0.6), reduced ? 0 : Math.cos(p * 2.4) * 0.35, z - 14],
        layout: c.layout,
        fov: c.fov,
        roll: reduced ? 0 : Math.sin(p * 3.2) * 0.06,
      }
    }
    const sway = reduced ? 0 : Math.sin(time * 0.15) * 0.25
    // 竖屏：镜头沿视线往后拉，画面装得下
    const pull = camera.aspect < 1.2 ? Math.max(1, 1.12 / camera.aspect) : 1
    return {
      pos: [
        c.target[0] + c.offset[0] * pull + sway,
        c.target[1] + c.offset[1] * pull,
        c.target[2] + (c.offset[2] - p * 0.6) * pull,
      ],
      target: c.target,
      layout: c.layout,
      fov: c.fov,
      roll: 0,
    }
  }
  const shiftOf = (layout: Layout) => (narrow() ? [0, 0.14] : layout === 'right' ? [0.19, 0] : [0, 0])
  const lerp = (a: readonly number[], b: readonly number[], t: number) => a.map((v, i) => v + (b[i]! - v) * t)

  const vPos = new Vector3()
  const vTgt = new Vector3()
  const vRight = new Vector3()
  const vUp = new Vector3()
  const tmp = new Vector3()
  function placeCamera(S: TimelineState, time: number, reduced: boolean) {
    let pos: number[]
    let target: readonly number[]
    let fov: number
    let roll: number
    let shift: number[]
    if (S.travelK < 0) {
      const c = camOf(S.dwellK, S.dwellP, time, reduced)
      ;({ pos, target, fov, roll } = c)
      shift = shiftOf(c.layout)
    } else {
      const a = camOf(S.a, 1, time, reduced)
      const b = camOf(S.b, 0, time, reduced)
      const t = ease(S.u)
      pos = lerp(a.pos, b.pos, t)
      target = lerp(a.target, b.target, t)
      fov = a.fov + (b.fov - a.fov) * t
      roll = a.roll + (b.roll - a.roll) * t
      shift = lerp(shiftOf(a.layout), shiftOf(b.layout), t)
    }
    const flight = fov > 45
    vPos.set(pos[0]!, pos[1]!, pos[2]!)
    vTgt.set(target[0]!, target[1]!, target[2]!)
    const aspect = camera.aspect
    camera.fov = fov
    camera.position.copy(vPos)
    camera.up.set(0, 1, 0)
    camera.lookAt(vTgt)
    camera.updateMatrixWorld()
    // 把画面平移到一侧（文字在另一侧），再加上鼠标带来的一点视差
    const viewH = 2 * vPos.distanceTo(vTgt) * Math.tan(MathUtils.degToRad(fov) / 2)
    vRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
    vUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
    const ox = -shift[0]! * viewH * aspect
    const oy = -shift[1]! * viewH
    const live = mouse.at > 0 && !reduced
    mouse.sx += ((live ? mouse.x : 0) - mouse.sx) * 0.04
    mouse.sy += ((live ? mouse.y : 0) - mouse.sy) * 0.04
    const par = flight ? 0.9 : 0.55
    camera.position.add(tmp.copy(vRight).multiplyScalar(ox + mouse.sx * par))
    camera.position.add(tmp.copy(vUp).multiplyScalar(oy + mouse.sy * par * 0.6))
    vTgt.add(vRight.multiplyScalar(ox)).add(vUp.multiplyScalar(oy))
    camera.lookAt(vTgt)
    if (roll) camera.rotateZ(roll)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }

  const project: Projector = {
    width: 1,
    height: 1,
    toScreen(p) {
      tmp.set(p[0]!, p[1]!, p[2]!).project(camera)
      return { x: (tmp.x + 1) * 0.5 * project.width, y: (1 - tmp.y) * 0.5 * project.height, behind: tmp.z > 1 }
    },
    depthOf(p) {
      return -tmp.set(p[0]!, p[1]!, p[2]!).applyMatrix4(camera.matrixWorldInverse).z
    },
  }

  /* ---------------- 主循环 ---------------- */
  const t0 = performance.now()
  let last = t0
  let time = 0
  // 第一帧再读滚动位置：站内路由切换时，VitePress 会在挂载之后才把页面滚回顶部
  let tau = Number.NaN
  let raf = 0
  let running = false
  let frames = 0
  let slow = 0
  let base = 1
  let degraded = false
  const drawSize = new Vector2()

  function frame() {
    raf = requestAnimationFrame(frame)
    const now = performance.now()
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05) || 0.016
    last = now
    const reduced = opts.reduced()
    if (!reduced) time += dt
    U.uTime.value = time
    U.uFade.value = reduced ? 1 : Math.min(1, (now - t0) / 1600)

    const target = opts.readTau()
    tau = reduced || !Number.isFinite(tau) ? target : tau + (target - tau) * (1 - Math.exp(-dt * 9))
    if (Math.abs(target - tau) < 0.01) tau = target
    // 减少动态效果：画面不动时不重画
    if (reduced && tau === drawnTau && stage.clientWidth === drawnW) return
    drawnTau = reduced ? tau : Number.NaN
    drawnW = stage.clientWidth

    const S = timeline.at(tau)
    bind(S.a, S.b)
    const motion = MOTION[S.a] ?? MOTION[0]!
    U.uMorph.value = reduced ? Math.round(S.morph) : S.morph
    U.uStagger.value = motion.stagger
    U.uSwirl.value = reduced ? 0 : motion.swirl
    U.uRevealOn.value = REVEAL.has(S.b) ? 1 : 0
    U.uReveal.value = S.dwellK === S.b ? S.dwellP * 1.15 : 0

    placeCamera(reduced && S.travelK >= 0 ? { ...S, u: Math.round(S.u) } : S, time, reduced)
    project.width = stage.clientWidth
    project.height = stage.clientHeight
    U.uProj.value = renderer.getDrawingBufferSize(drawSize).y / (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2))
    U.uAspect.value = camera.aspect
    const active = +(mouse.at > 0 && now - mouse.at < 1800 && !reduced)
    mouse.active += (active - mouse.active) * 0.06
    const presence = (k: number) => timeline.presence(tau, k)
    U.uMouseForce.value = mouse.active * (0.35 + Math.max(presence(0), presence(9)) * 0.65)
    U.uMouse.value.set(mouse.x, mouse.y)

    final.uniforms.uTime!.value = time
    composer.render()
    opts.onFrame({ S, tau, time, presence, project, narrow: narrow() })

    // 太慢就降级：先关泛光，再少画 20% 的粒子
    frames++
    // 前 90 帧里最短的帧间隔 ≈ 显示器刷新间隔（30Hz 限帧时约 33ms，不算慢）
    if (frames <= 90) base = Math.min(base, Math.max(dt, 1 / 144))
    else if (!degraded) {
      slow = slow * 0.97 + (dt > Math.max(0.026, base * 1.5) ? 0.03 : 0)
      if (slow > 0.6) {
        if (bloom?.enabled) {
          bloom.enabled = false
          slow = 0
        } else {
          geo.setDrawRange(0, Math.floor(N * 0.8))
          degraded = true
        }
      }
    }
  }

  return {
    timeline,
    start() {
      if (running) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    },
    pause() {
      running = false
      cancelAnimationFrame(raf)
    },
    destroy() {
      running = false
      cancelAnimationFrame(raf)
      clearTimeout(resizeTimer)
      ro.disconnect()
      if (fine) {
        window.removeEventListener('pointermove', onMove)
        stage.removeEventListener('pointerleave', onLeave)
      }
      geo.dispose()
      ;(points.material as ShaderMaterial).dispose()
      bloom?.dispose()
      composer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}

export type Stage = ReturnType<typeof createStage>
