<script setup lang="ts">
/**
 * 首页滚动叙事：全屏粒子舞台（story/engine.ts，WebGL）粘在屏幕上，页面高度按时间线撑开，
 * 滚动位置 → 时间线 tau → 场景和场景内进度。文字、HUD 是真实的 DOM（可读、可选中），画布只是装饰。
 * 滚动停在两个场景之间时，顺着滚动方向走完这段过渡（吸附到下一个场景）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
import type { Frame, Stage } from './story/engine'
import { FILES, FLOW, INPUT, PANELS, RINGS, TREE, TUNNEL } from './story/shapes'
import { SCROLL_RATE, createTimeline, smooth } from './story/timeline'

interface Chapter {
  first: number
  last: number
  pos: 'left' | 'top' | 'bottom'
  kicker: string
  title: string
  body: string
  rail: string
}
const chapters: Chapter[] = [
  {
    first: 0,
    last: 0,
    pos: 'left',
    rail: '首页',
    kicker: '栖梧 QIWU · 开源 · MIT · Node 全栈',
    title: '一个仓库\n撑起整个后台',
    body: 'NestJS + Vue 3 + Element Plus + MySQL + Redis。登录、权限、组织、字典、日志、定时任务、消息、文件、代码生成、审批流，开箱即用。',
  },
  {
    first: 1,
    last: 1,
    pos: 'left',
    rail: '一个仓库',
    kicker: '01 · 单仓库',
    title: '三个包\n一种语言',
    body: '后端、前端、共享包放在同一个仓库里，全部是 TypeScript。类型从数据库一路贯通到页面。',
  },
  {
    first: 2,
    last: 3,
    pos: 'top',
    rail: '共享校验',
    kicker: '02 · 一份规则',
    title: '写一次，前后端同时生效',
    body: '用 zod 写一次校验规则：后端拿它校验请求、生成接口文档，前端拿它做表单校验。',
  },
  {
    first: 4,
    last: 4,
    pos: 'left',
    rail: '代码生成',
    kicker: '03 · 代码生成',
    title: '建一张表\n剩下的交给生成器',
    body: '从表名推导出领域、接口、权限点和菜单，前后端代码和测试一次生成，从不覆盖你已经写好的文件。',
  },
  {
    first: 5,
    last: 5,
    pos: 'left',
    rail: '权限',
    kicker: '04 · 权限',
    title: '权限\n真的在后端',
    body: '菜单与按钮权限、五种数据范围、防越权授予。超出范围一律 404，不泄露数据是否存在。',
  },
  {
    first: 6,
    last: 6,
    pos: 'left',
    rail: '审批流',
    kicker: '05 · 工作流',
    title: '审批流\n开箱即用',
    body: '会签、或签、条件与并行分支、退回、转办、加签、催办、超时提醒，和业务数据在同一个事务里提交。',
  },
  {
    first: 7,
    last: 7,
    pos: 'bottom',
    rail: '中英双语',
    kicker: '06 · 国际化',
    title: '中英双语',
    body: '界面、错误信息、菜单、字典、消息模板、Excel 表头，全部可以切换语言。',
  },
  {
    first: 8,
    last: 8,
    pos: 'left',
    rail: '全部模块',
    kicker: '07 · 开箱即用',
    title: '穿过所有模块',
    body: '用户、角色、菜单、部门、字典、日志、任务、消息、文件、代码生成、审批……一个模板全部带上。',
  },
  {
    first: 9,
    last: 9,
    pos: 'bottom',
    rail: '开始',
    kicker: '栖梧 · Qiwu',
    title: '从这里开始',
    body: '选一条适合你的路线：',
  },
]

const routes = [
  { title: '学生和新手', desc: '从安装环境讲起，一步步做出第一个模块', link: '/beginner/' },
  { title: '前端开发者', desc: '用前端的概念理解后端，再做一个完整功能', link: '/backend/' },
  { title: 'Java 开发者', desc: 'Spring、RuoYi 的写法在这里对应什么', link: '/java/' },
]
const techs = ['NestJS', 'Vue 3', 'TypeScript', 'MySQL', 'Redis', 'Element Plus', 'zod', 'Socket.IO']
const RULE = 'name: z.string().trim().max(64)'
const SCOPES = ['全部数据', '本部门及下级', '仅本人']
const langs = {
  zh: { title: '中英双语', body: '界面、错误信息、菜单、字典、消息模板、Excel 表头，全部可以切换语言。' },
  en: { title: 'Bilingual', body: 'UI, error messages, menus, dictionaries, message templates and Excel headers all switch language.' },
}

const timeline = createTimeline()
const root = ref<HTMLElement>()
const stage = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const chapterEls = ref<HTMLElement[]>([])
const chipEls = ref<HTMLElement[]>([])
const ringEls = ref<HTMLElement[]>([])
const headEls = ref<HTMLElement[]>([])
const flowEls = ref<HTMLElement[]>([])
const moduleEls = ref<HTMLElement[]>([])
const inputEl = ref<HTMLElement>()
const filesEl = ref<HTMLElement>()
const treeEl = ref<HTMLElement>()
const flowHudEl = ref<HTMLElement>()
const helloEl = ref<HTMLElement>()
const bar = ref<HTMLElement>()
const cue = ref<HTMLElement>()
const skip = ref<HTMLElement>()
const chaptersEl = ref<HTMLElement>()

const typed = ref('')
const panelDone = ref([false, false])
const fileIndex = ref(0)
const scope = ref(0)
const flowStep = ref(1)
const lang = ref<'zh' | 'en'>('zh')
const railOn = ref(0)
const fallback = ref(false)
const ready = ref(false)
const height = ref('1000vh')
const helloText = computed(() => langs[lang.value])

let engine: Stage | null = null
let stopAll = () => {}
let disposed = false

/** 滚动换算用的视口高度：挂载时取一次，之后只在宽度变化时更新（见 onResize） */
let baseH = 0
const stageHeight = () => baseH || innerHeight
const rootTop = () => (root.value ? root.value.getBoundingClientRect().top + scrollY : 0)
const toPx = (tau: number) => (tau / 100 / SCROLL_RATE) * stageHeight()
const readTau = () => ((scrollY - rootTop()) / stageHeight()) * 100 * SCROLL_RATE

function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}
function goTau(tau: number, smoothScroll = true) {
  window.scrollTo({ top: rootTop() + toPx(tau), behavior: smoothScroll && !reducedMotion() ? 'smooth' : 'auto' })
}
function goChapter(i: number) {
  const el = chapterEls.value[i]
  if (fallback.value) el?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' })
  else goTau(timeline.anchor(chapters[i]!.first))
  // 焦点和读屏光标跟着移到这一章的标题
  el?.querySelector<HTMLElement>('.qws-title')?.focus({ preventScroll: true })
}
function skipToEnd() {
  goTau(timeline.total, false)
  chapterEls.value[chapters.length - 1]?.querySelector<HTMLElement>('.qws-title')?.focus({ preventScroll: true })
}

const opacity = (el: HTMLElement | undefined, o: number) => {
  if (!el) return
  const v = o.toFixed(3)
  if (el.style.opacity !== v) el.style.opacity = v
}
const place = (el: HTMLElement, x: number, y: number, extra = '') => {
  el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ${extra}`
}
/** 场景 k 的进度：之前为 0，停留时按 dwellP，之后为 1 */
const progressOf = (S: Frame['S'], k: number, speed = 1) =>
  S.dwellK === k ? Math.min(1, S.dwellP * speed) : S.dwellK > k || S.travelK >= k ? 1 : 0

function onFrame(f: Frame) {
  const { S, tau, time, presence, project } = f
  const reduced = reducedMotion()

  // 章节文字：进入的过渡后半段淡入，离开的过渡前段淡出，停留时缓慢上移
  let best = 0
  let bestO = -1
  chapters.forEach((c, i) => {
    const el = chapterEls.value[i]
    if (!el) return
    const w = timeline.window(c.first, c.last)
    const fin = Number.isFinite(w.start) ? smooth(w.start, w.start + 16, tau) : 1
    const fout = Number.isFinite(w.end) ? smooth(w.end - 16, w.end, tau) : 0
    const o = fin * (1 - fout)
    const drift = Math.min(Math.max(tau - (Number.isFinite(w.start) ? w.start : 0), 0) * 0.45, 28)
    opacity(el, o)
    el.style.transform = reduced ? 'none' : `translate3d(0, ${((1 - fin) * 46 - fout * 46 - drift).toFixed(1)}px, 0)`
    el.classList.toggle('is-live', o > 0.02)
    if (o > bestO) {
      bestO = o
      best = i
    }
  })
  if (bestO > 0.02 && railOn.value !== best) railOn.value = best
  if (bar.value) bar.value.style.transform = `scaleX(${(tau / timeline.total).toFixed(4)})`
  opacity(cue.value, tau < 12 ? 1 : 0)
  const atEnd = tau > timeline.total - 60
  opacity(skip.value, atEnd ? 0 : 1)
  if (skip.value && skip.value.inert !== atEnd) skip.value.inert = atEnd

  // 第 0 场景：技术栈标签绕着星球转
  const p0 = presence(0)
  chipEls.value.forEach((el, j) => {
    if (p0 < 0.01) return opacity(el, 0)
    const a = (j / techs.length) * Math.PI * 2 + time * 0.06
    const pt = [Math.cos(a) * 4.9, Math.sin(a) * 1.3, Math.sin(a) * 4.9]
    const s = project.toScreen(pt)
    const d = project.depthOf(pt)
    opacity(el, p0 * (s.behind ? 0 : pt[2]! < -1 ? 0.35 : 1))
    place(el, s.x, s.y, `translate(-50%, -50%) scale(${Math.min(1.2, Math.max(0.7, 15 / d)).toFixed(3)})`)
    el.style.zIndex = String(Math.round(1000 - d * 10))
  })

  // 第 1 场景：三圈光环的名字
  const p1 = presence(1)
  ringEls.value.forEach((el, j) => {
    if (p1 < 0.01) return opacity(el, 0)
    const ring = RINGS[j]!
    const s = project.toScreen([0, 0, ring.r])
    opacity(el, p1)
    place(el, s.x, s.y, 'translate(-50%, 10px)')
  })

  // 第 2 场景：输入框逐字打出规则
  const p2 = presence(2)
  if (p2 < 0.01) opacity(inputEl.value, 0)
  else if (inputEl.value) {
    const a = project.toScreen([-INPUT.w / 2 + 0.2, INPUT.y + INPUT.h / 2, 0])
    const b = project.toScreen([INPUT.w / 2 - 1.3, INPUT.y - INPUT.h / 2, 0])
    const el = inputEl.value
    opacity(el, p2)
    const w = Math.max(0, b.x - a.x)
    el.style.width = `${w}px`
    el.style.fontSize = `${Math.min(20, Math.max(9, (w - 32) / (RULE.length * 0.62))).toFixed(1)}px`
    el.style.height = `${Math.max(0, b.y - a.y)}px`
    place(el, a.x, a.y)
    const t1 = timeline.travelOf(1)!
    const d2 = timeline.dwellOf(2)
    const k = smooth(t1.start + (t1.end - t1.start) * 0.7, d2.end - 6, tau)
    const text = RULE.slice(0, Math.round(k * RULE.length))
    if (typed.value !== text) typed.value = text
  }

  // 第 3 场景：两块面板的状态
  const p3 = presence(3)
  headEls.value.forEach((el, j) => {
    if (p3 < 0.01) return opacity(el, 0)
    const pnl = PANELS[j]!
    const s = project.toScreen(pnl.toWorld(-pnl.w / 2 + 0.28, pnl.h / 2 - 0.36))
    opacity(el, p3)
    place(el, s.x, s.y, 'translateY(-50%)')
  })
  const prog3 = progressOf(S, 3)
  const done = [prog3 > 0.3, prog3 > 0.65]
  if (done[0] !== panelDone.value[0] || done[1] !== panelDone.value[1]) panelDone.value = done

  // 第 4 场景：逐个生成文件
  const p4 = presence(4)
  if (p4 < 0.01) opacity(filesEl.value, 0)
  else if (filesEl.value) {
    const c = FILES[7]!.c
    const s = project.toScreen([c[0] - 0.55, c[1] - 1.05, c[2]])
    opacity(filesEl.value, p4)
    place(filesEl.value, s.x, s.y)
    const idx = Math.max(0, Math.min(FILES.length - 1, Math.ceil(progressOf(S, 4, 1.15) * FILES.length) - 1))
    if (fileIndex.value !== idx) fileIndex.value = idx
  }

  // 第 5 场景：数据范围依次切换
  const p5 = presence(5)
  if (p5 < 0.01) opacity(treeEl.value, 0)
  else if (treeEl.value) {
    const s = project.toScreen([TREE.root[0], TREE.root[1] + 1.05, TREE.root[2]])
    opacity(treeEl.value, p5)
    place(treeEl.value, s.x, s.y, 'translate(-50%, -100%)')
    const k = Math.min(SCOPES.length - 1, Math.floor(progressOf(S, 5) * SCOPES.length))
    if (scope.value !== k) scope.value = k
  }

  // 第 6 场景：审批节点依次点亮
  const p6 = presence(6)
  const step = Math.max(1, Math.min(FLOW.nodes.length, Math.ceil(progressOf(S, 6, 1.15) * FLOW.nodes.length)))
  if (flowStep.value !== step) flowStep.value = step
  flowEls.value.forEach((el, j) => {
    if (p6 < 0.01) return opacity(el, 0)
    const n = FLOW.nodes[j]!
    const s = project.toScreen([n[0], n[1] - 0.8, n[2]])
    opacity(el, p6)
    place(el, s.x, s.y, 'translate(-50%, 0)')
  })
  opacity(flowHudEl.value, p6)
  if (p6 > 0.01 && flowHudEl.value) {
    const n = FLOW.nodes[FLOW.nodes.length - 1]!
    const s = project.toScreen([n[0] + 0.2, n[1] + 1.1, n[2]])
    place(flowHudEl.value, s.x, s.y, 'translate(-100%, -100%)')
  }

  // 第 7 场景：语言开关，停留到一半切到英文
  opacity(helloEl.value, presence(7))
  const l = progressOf(S, 7) > 0.5 ? 'en' : 'zh'
  if (lang.value !== l) lang.value = l

  // 第 8 场景：隧道壁上掠过的模块名
  const p8 = Math.max(presence(8), S.travelK === 7 ? (reduced ? Math.round(S.u) : S.u) : 0)
  moduleEls.value.forEach((el, j) => {
    if (p8 < 0.01) return opacity(el, 0)
    const pt = TUNNEL.anchors[j]!
    const s = project.toScreen(pt)
    const d = project.depthOf(pt)
    const o = p8 * smooth(34, 16, d) * smooth(1.2, 5, d) * (s.behind ? 0 : 1)
    opacity(el, o)
    if (o > 0.01) place(el, s.x, s.y, `translate(-50%, -50%) scale(${Math.min(2.4, Math.max(0.6, 12 / d)).toFixed(3)})`)
  })
}

// 滚动长度 + 一屏：用 100vh（手机上是工具栏收起后的大视口），视口变高时结尾也到得了
const heightOf = () => `calc(${toPx(timeline.total)}px + 100vh)`

onMounted(async () => {
  baseH = innerHeight
  height.value = heightOf()
  try {
    const { createStage } = await import('./story/engine')
    if (disposed) return
    engine = createStage({ stage: stage.value!, canvas: canvas.value!, readTau, reduced: reducedMotion, onFrame })
  } catch (e) {
    console.error('[story] particle stage unavailable', e)
    fallback.value = true
    height.value = 'auto'
    return
  }
  ready.value = true

  // 只在宽度变化时重新计算高度：手机浏览器工具栏收起/展开只改变高度，不应让页面跳动
  let lastW = innerWidth
  const onResize = () => {
    if (innerWidth === lastW) return
    lastW = innerWidth
    // 换算比例变了：保持当前场景不变
    const tau = readTau()
    baseH = innerHeight
    height.value = heightOf()
    nextTick(() => goTau(tau, false))
  }
  addEventListener('resize', onResize)

  // 方向吸附：滚动停在两个场景之间的过渡里时，顺着滚动方向走完这段过渡
  let lastY = scrollY
  let dir = 1
  let idle = 0
  let snapping = false
  const onScroll = () => {
    const y = scrollY
    // 吸附自己的平滑滚动不改方向
    if (!snapping && y !== lastY) dir = y > lastY ? 1 : -1
    lastY = y
    clearTimeout(idle)
    idle = window.setTimeout(() => {
      snapping = false
      const tau = readTau()
      if (tau <= 0 || tau >= timeline.total || location.search.includes('nosnap')) return
      const S = timeline.at(tau)
      if (S.travelK < 0) return
      const d = timeline.dwellOf(dir > 0 ? S.b : S.a)
      snapping = true
      goTau(dir > 0 ? d.start + 1 : d.end - 1)
    }, 140)
  }
  // 用户再动滚轮、手指、键盘：吸附让位给用户
  const onInput = () => (snapping = false)
  addEventListener('scroll', onScroll, { passive: true })
  for (const t of ['wheel', 'touchstart', 'keydown'] as const) addEventListener(t, onInput, { passive: true })

  // Tab 到别的章节里的链接或按钮时，滚到那一章的场景
  const onFocusIn = (e: FocusEvent) => {
    // 标题只会被 goChapter / skipToEnd 聚焦，它们自己负责滚动
    if ((e.target as HTMLElement).classList.contains('qws-title')) return
    const i = chapterEls.value.findIndex((el) => el.contains(e.target as Node))
    if (i >= 0 && i !== railOn.value) goTau(timeline.anchor(chapters[i]!.first))
  }
  chaptersEl.value?.addEventListener('focusin', onFocusIn)

  const io = new IntersectionObserver(([entry]) => (entry!.isIntersecting ? engine?.start() : engine?.pause()))
  io.observe(root.value!)
  const onVisibility = () => (document.hidden ? engine?.pause() : engine?.start())
  document.addEventListener('visibilitychange', onVisibility)

  stopAll = () => {
    clearTimeout(idle)
    removeEventListener('resize', onResize)
    removeEventListener('scroll', onScroll)
    for (const t of ['wheel', 'touchstart', 'keydown'] as const) removeEventListener(t, onInput)
    chaptersEl.value?.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('visibilitychange', onVisibility)
    io.disconnect()
    engine?.destroy()
    engine = null
  }
})

onBeforeUnmount(() => {
  disposed = true
  stopAll()
})
</script>

<template>
  <div ref="root" class="qws" :class="{ 'is-fallback': fallback, 'is-ready': ready }" :style="{ height }">
    <div ref="stage" class="qws-stage">
      <header class="qws-nav">
        <a class="qws-brand" :href="withBase('/')"><img :src="withBase('/logo.svg')" alt="" />栖梧 Qiwu</a>
        <nav class="qws-links" aria-label="文档">
          <a :href="withBase('/guide/introduction')">指南</a>
          <a :href="withBase('/beginner/')">入门</a>
          <a :href="withBase('/core/')">开发指南</a>
          <a :href="withBase('/changelog')">更新日志</a>
          <a href="https://demo.qiwuadmin.com" target="_blank" rel="noopener">在线演示</a>
        </nav>
        <a class="qws-btn is-primary is-small" :href="withBase('/guide/getting-started')">开始使用 →</a>
      </header>
      <div class="qws-progress"><i ref="bar" /></div>
      <nav class="qws-rail" aria-label="章节">
        <button
          v-for="(c, i) in chapters"
          :key="i"
          type="button"
          :class="{ 'is-on': railOn === i }"
          :aria-label="c.rail"
          :aria-current="railOn === i ? 'step' : undefined"
          @click="goChapter(i)"
        >
          <span>{{ c.rail }}</span>
        </button>
      </nav>
      <div ref="cue" class="qws-cue" aria-hidden="true"><i />向下滚动</div>
      <button ref="skip" type="button" class="qws-skip" @click="skipToEnd">跳到结尾 ↓</button>
      <canvas ref="canvas" class="qws-canvas" aria-hidden="true" />

      <div class="qws-hud" aria-hidden="true">
        <span v-for="t in techs" :key="t" ref="chipEls" class="qws-chip">{{ t }}</span>
        <span v-for="ring in RINGS" :key="ring.label" ref="ringEls" class="qws-tag">{{ ring.label }}</span>

        <div ref="inputEl" class="qws-input">
          <span>{{ typed }}<i class="qws-caret" /></span>
        </div>

        <div v-for="(p, j) in PANELS" :key="j" ref="headEls" class="qws-head" :class="{ 'is-done': panelDone[j] }">
          <b>{{ j === 0 ? '后端 · NestJS' : '前端 · Vue' }}</b>
          <span>{{ panelDone[j] ? (j === 0 ? '✓ 校验通过 · 400 已拦截' : '✓ 表单提示已生成') : '校验中…' }}</span>
        </div>

        <div ref="filesEl" class="qws-panel">
          <div class="qws-step">
            <span>GENERATE</span><b>{{ String(fileIndex + 1).padStart(2, '0') }}</b><span>/ {{ FILES.length }}</span>
          </div>
          <div class="qws-bar"><i :style="{ transform: `scaleX(${(fileIndex + 1) / FILES.length})` }" /></div>
          <div class="qws-file">{{ FILES[fileIndex]!.name }}</div>
        </div>

        <div ref="treeEl" class="qws-pill">数据范围 · <b>{{ SCOPES[scope] }}</b></div>

        <span
          v-for="(label, j) in FLOW.labels"
          :key="label"
          ref="flowEls"
          class="qws-tag"
          :class="{ 'is-done': j < flowStep }"
          >{{ label }}</span
        >
        <div ref="flowHudEl" class="qws-pill">审批进度 <b>{{ flowStep }} / {{ FLOW.nodes.length }}</b></div>

        <div ref="helloEl" class="qws-toggle">
          <span :class="{ 'is-on': lang === 'zh' }">中文</span>
          <span :class="{ 'is-on': lang === 'en' }">EN</span>
        </div>

        <span v-for="m in TUNNEL.modules" :key="m" ref="moduleEls" class="qws-module">{{ m }}</span>
      </div>

      <main ref="chaptersEl" class="qws-chapters">
        <section
          v-for="(c, i) in chapters"
          :key="i"
          ref="chapterEls"
          class="qws-chapter"
          :class="[`is-${c.pos}`, { 'is-last': i === chapters.length - 1 }]"
        >
          <p class="qws-kicker">{{ c.kicker }}</p>
          <component :is="i === 0 ? 'h1' : 'h2'" class="qws-title" tabindex="-1" :lang="i === 6 && lang === 'en' ? 'en' : undefined">
            <template v-for="(line, n) in (i === 6 ? helloText.title : c.title).split('\n')" :key="n">
              <br v-if="n" />{{ line }}
            </template>
          </component>
          <p class="qws-body" :lang="i === 6 && lang === 'en' ? 'en' : undefined">{{ i === 6 ? helloText.body : c.body }}</p>
          <p v-if="i === 0" class="visually-hidden">技术栈：{{ techs.join('、') }}</p>

          <div v-if="i === 0" class="qws-actions">
            <a class="qws-btn is-primary" :href="withBase('/guide/getting-started')">快速开始</a>
            <a class="qws-btn" href="https://demo.qiwuadmin.com" target="_blank" rel="noopener">在线演示</a>
            <a class="qws-btn" href="https://github.com/732124645/qiwu-vue-admin" target="_blank" rel="noopener">源码</a>
            <button type="button" class="qws-btn" @click="goChapter(1)">看看它能做什么</button>
          </div>
          <template v-if="i === chapters.length - 1">
            <div class="qws-routes">
              <a v-for="r in routes" :key="r.link" class="qws-route" :href="withBase(r.link)">
                <strong>{{ r.title }}</strong><span>{{ r.desc }}</span>
              </a>
            </div>
            <div class="qws-actions">
              <a class="qws-btn is-primary" :href="withBase('/guide/getting-started')">快速开始</a>
              <a class="qws-btn" href="https://demo.qiwuadmin.com" target="_blank" rel="noopener">在线演示</a>
              <a class="qws-btn" href="https://github.com/732124645/qiwu-vue-admin" target="_blank" rel="noopener">源码</a>
              <a class="qws-btn" :href="withBase('/core/')">开发指南</a>
            </div>
          </template>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.qws {
  --bg: #03050a;
  --ink: #eef3ff;
  --muted: rgba(214, 226, 255, 0.64);
  --faint: rgba(214, 226, 255, 0.38);
  --line: rgba(255, 255, 255, 0.12);
  --accent: #7fe8ff;
  --accent-2: #a78bfa;
  --mono: 'SF Mono', 'JetBrains Mono', Menlo, ui-monospace, monospace;
  --gutter: clamp(16px, 4.2vw, 72px);
  position: relative;
  background: var(--bg);
  color: var(--ink);
  color-scheme: dark;
  -webkit-font-smoothing: antialiased;
}
.qws-stage {
  position: sticky;
  top: 0;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
.qws-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 1.2s;
}
.is-ready .qws-canvas {
  opacity: 1;
}
.qws-hud,
.qws-chapters {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
/* 标签的内联 z-index 只在 HUD 内部比较，不盖住导航和文字 */
.qws-hud {
  isolation: isolate;
}
.qws-hud > * {
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  will-change: transform, opacity;
}

/* 标签和面板 */
.qws-chip,
.qws-tag,
.qws-module {
  padding: 4px 12px;
  border: 1px solid rgba(160, 200, 255, 0.28);
  border-radius: 999px;
  background: rgba(8, 14, 28, 0.62);
  color: #dbe7ff;
  font-size: 13px;
  white-space: nowrap;
  backdrop-filter: blur(6px);
}
.qws-tag {
  color: var(--muted);
  font-family: var(--mono);
  font-size: 12px;
  transition: color 0.3s, border-color 0.3s;
}
.qws-tag.is-done {
  border-color: rgba(127, 232, 255, 0.6);
  color: var(--accent);
}
.qws-module {
  padding: 8px 16px;
  border-color: rgba(167, 139, 250, 0.4);
  font-size: 15px;
}
.qws-input {
  display: flex;
  align-items: center;
  padding: 0 14px;
  overflow: hidden;
  color: var(--ink);
  font-family: var(--mono);
  white-space: nowrap;
}
.qws-caret {
  display: inline-block;
  width: 2px;
  height: 1.1em;
  margin-left: 2px;
  vertical-align: -0.15em;
  background: var(--accent);
  animation: qws-blink 1s steps(1) infinite;
}
@keyframes qws-blink {
  50% {
    opacity: 0;
  }
}
.qws-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.qws-head b {
  color: var(--ink);
}
.qws-head span {
  color: var(--faint);
  font-family: var(--mono);
  font-size: 12px;
  transition: color 0.3s;
}
.qws-head.is-done span {
  color: var(--accent);
}
.qws-panel {
  width: 240px;
  font-family: var(--mono);
  font-size: 12px;
}
.qws-step {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--faint);
  letter-spacing: 0.08em;
}
.qws-step b {
  color: var(--ink);
  font-size: 22px;
}
.qws-bar {
  height: 2px;
  margin: 8px 0;
  background: var(--line);
}
.qws-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  transform-origin: left;
  transition: transform 0.25s;
}
.qws-file {
  color: var(--muted);
}
.qws-pill {
  padding: 6px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(8, 14, 28, 0.62);
  color: var(--muted);
  font-size: 13px;
  white-space: nowrap;
  backdrop-filter: blur(6px);
}
.qws-pill b {
  color: var(--accent);
}
.qws-hud > .qws-toggle {
  top: 16vh;
  left: 50%;
  display: flex;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(8, 14, 28, 0.62);
  translate: -50% 0;
}
.qws-toggle span {
  padding: 4px 16px;
  border-radius: 999px;
  color: var(--faint);
  font-size: 13px;
  transition: background 0.3s, color 0.3s;
}
.qws-toggle span.is-on {
  background: #1f6feb;
  color: #fff;
}

/* 章节文字 */
.qws-chapter {
  position: absolute;
  max-width: 540px;
  opacity: 0;
  will-change: transform, opacity;
}
.qws-chapter.is-live {
  pointer-events: auto;
}
/* 粒子还没加载好（或脚本没跑）时，首屏文字先显示；之后由内联 opacity 接管 */
.qws-chapter:first-child {
  opacity: 1;
}
.qws:not(.is-ready) .qws-chapter:first-child {
  pointer-events: auto;
}
/* 键盘聚焦到看不见的章节里的链接或按钮时，让它显示出来 */
.qws-chapter:has(a:focus-visible, button:focus-visible) {
  opacity: 1 !important;
}
.qws-title:focus {
  outline: none;
}
.qws-chapter.is-left {
  top: 50%;
  left: var(--gutter);
  margin-top: -130px;
}
.qws-chapter.is-top {
  top: 12vh;
  left: 50%;
  width: calc(100% - 2 * var(--gutter));
  max-width: 720px;
  translate: -50% 0;
  text-align: center;
}
.qws-chapter.is-bottom {
  bottom: 8vh;
  left: 50%;
  width: calc(100% - 2 * var(--gutter));
  max-width: 820px;
  translate: -50% 0;
  text-align: center;
}
.qws-kicker {
  margin: 0 0 14px;
  color: var(--accent);
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.14em;
}
.qws-title {
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--ink);
  font-size: clamp(34px, 4.4vw, 62px);
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.01em;
}
.qws-body {
  margin: 18px 0 0;
  color: var(--muted);
  font-size: 17px;
  line-height: 1.75;
}
.qws-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}
.is-bottom .qws-actions {
  justify-content: center;
}
.qws-btn {
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 22px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(8, 14, 28, 0.5);
  color: var(--ink);
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: border-color 0.2s, background 0.2s;
}
.qws-btn:hover {
  border-color: var(--accent);
}
.qws-btn.is-primary {
  border-color: transparent;
  background: #eef3ff;
  color: #03050a;
}
.qws-btn.is-small {
  height: 36px;
  padding: 0 16px;
  font-size: 14px;
}
.qws-routes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 22px;
  text-align: left;
}
.qws-route {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(8, 14, 28, 0.55);
  color: var(--ink);
  text-decoration: none;
  backdrop-filter: blur(8px);
  transition: border-color 0.2s, transform 0.2s;
}
.qws-route:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}
.qws-route strong {
  font-size: 16px;
}
.qws-route span {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

/* 导航、进度、章节圆点 */
.qws-nav {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 28px;
  height: 64px;
  padding: 0 var(--gutter);
}
.qws-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;
}
.qws-brand img {
  width: 26px;
  height: 26px;
}
.qws-links {
  display: flex;
  gap: 22px;
  margin-right: auto;
}
.qws-links a {
  color: var(--muted);
  font-size: 14px;
  text-decoration: none;
}
.qws-links a:hover {
  color: var(--ink);
}
.qws-progress {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  height: 2px;
}
.qws-progress i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #7fe8ff, #a78bfa, #ff9ec7);
  transform: scaleX(0);
  transform-origin: left;
}
.qws-rail {
  position: absolute;
  top: 50%;
  right: 14px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  transform: translateY(-50%);
}
/* 点击区域 24×24，里面画一个 8px 的圆点 */
.qws-rail button {
  position: relative;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: pointer;
}
.qws-rail button::after {
  content: '';
  position: absolute;
  inset: 8px;
  border-radius: 50%;
  background: var(--faint);
  transition: background 0.3s, transform 0.3s;
}
.qws-rail button.is-on::after {
  background: var(--accent);
  transform: scale(1.4);
}
.qws-rail span {
  position: absolute;
  top: 50%;
  right: 26px;
  color: var(--ink);
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity 0.3s;
  pointer-events: none;
}
.qws-rail button.is-on span,
.qws-rail button:hover span,
.qws-rail button:focus-visible span {
  opacity: 1;
}
.qws-cue {
  position: absolute;
  left: 50%;
  bottom: 28px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--faint);
  font-size: 12px;
  translate: -50% 0;
  transition: opacity 0.4s;
}
.qws-cue i {
  width: 18px;
  height: 28px;
  border: 1px solid var(--faint);
  border-radius: 10px;
}
.qws-skip {
  position: absolute;
  right: 22px;
  bottom: 22px;
  z-index: 3;
  padding: 6px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(8, 14, 28, 0.55);
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
  transition: opacity 0.3s;
}
.qws-btn:focus-visible,
.qws-route:focus-visible,
.qws-rail button:focus-visible,
.qws-skip:focus-visible,
.qws-links a:focus-visible,
.qws-brand:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

/* 平板宽度：图形和左侧文字会重叠，给文字加一层底板 */
@media (min-width: 768px) and (max-width: 1279px) {
  .qws-chapter.is-left {
    padding: 22px 24px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: rgba(3, 5, 10, 0.62);
    backdrop-filter: blur(10px);
  }
}

/* 没有 WebGL：文字按顺序排开 */
.is-fallback .qws-stage {
  position: relative;
  height: auto;
  background: radial-gradient(60% 50% at 68% 30%, #6078ff47, transparent 70%), var(--bg);
}
.is-fallback .qws-canvas,
.is-fallback .qws-hud,
.is-fallback .qws-rail,
.is-fallback .qws-cue,
.is-fallback .qws-skip,
.is-fallback .qws-progress {
  display: none;
}
.is-fallback .qws-chapters {
  position: relative;
  padding: 96px var(--gutter) 64px;
  pointer-events: auto;
}
/* 写成 .qws.is-fallback 提高特异性，压过后面手机媒体查询里的 margin: 0 */
.qws.is-fallback .qws-chapter {
  position: static;
  max-width: 820px;
  margin: 0 auto 72px;
  opacity: 1 !important;
  transform: none !important;
  translate: none;
  text-align: left;
}

@media (max-width: 767px) {
  .qws-links {
    display: none;
  }
  .qws-nav {
    justify-content: space-between;
  }
  .qws-chapter.is-left,
  .qws-chapter.is-top,
  .qws-chapter.is-bottom {
    top: auto;
    bottom: 7vh;
    left: 16px;
    right: 40px;
    width: auto;
    max-width: none;
    margin: 0;
    translate: none;
    text-align: left;
  }
  .qws-title {
    font-size: 30px;
  }
  .qws-body {
    font-size: 15px;
  }
  .qws-routes {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .qws-route span {
    display: none;
  }
  .qws-rail span {
    display: none;
  }
  .qws-rail {
    right: 8px;
  }
  .qws-skip {
    display: none;
  }
  .qws-chip,
  .qws-tag {
    padding: 2px 8px;
    font-size: 11px;
  }
  .qws-panel {
    width: 180px;
  }
  .qws-hud > .qws-toggle {
    top: 12vh;
  }
}

@media (prefers-reduced-motion: reduce) {
  .qws-canvas,
  .qws-bar i,
  .qws-rail button,
  .qws-route,
  .qws-btn,
  .qws-tag,
  .qws-toggle span {
    transition: none;
  }
  .qws-caret {
    animation: none;
  }
}
</style>
