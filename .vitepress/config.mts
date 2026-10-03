import { PageProperties, PagePropertiesMarkdownSection } from '@nolebase/vitepress-plugin-page-properties/vite'
import { GitChangelog, GitChangelogMarkdownSection } from '@nolebase/vitepress-plugin-git-changelog/vite'
import { defineConfig } from 'vitepress'
import { groupIconMdPlugin, groupIconVitePlugin } from 'vitepress-plugin-group-icons'
import { MermaidMarkdown, MermaidPlugin } from 'vitepress-plugin-mermaid'

// 站点部署在 Cloudflare Pages 的根路径（https://qiwuadmin.com）；GitHub Pages 的副本在子路径下（流水线设 DOCS_BASE=/qiwu-doc/）
const base = process.env.DOCS_BASE ?? '/'
// 规范地址：站点地图、分享卡片、canonical 一律指向官方域名，副本也不例外，避免被当成重复内容
const site = 'https://qiwuadmin.com'
// 只保留插件的虚拟配置模块，组件由主题按需加载，不静态注入全站入口。
const mermaidConfigPlugin = MermaidPlugin({ theme: 'default' })
delete mermaidConfigPlugin.transform

export default defineConfig({
  base,
  lang: 'zh-CN',
  title: '栖梧 Qiwu',
  description: 'Node 全栈管理后台模板：NestJS + Vue 3 + Element Plus，MIT 开源',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['README.md'],
  markdown: {
    codeCopyButtonTitle: '复制代码',
    container: {
      tipLabel: '提示',
      infoLabel: '说明',
      warningLabel: '注意',
      dangerLabel: '警告',
      detailsLabel: '详细信息',
    },
    config(md) {
      md.use(MermaidMarkdown)
      md.use(groupIconMdPlugin)
    },
  },
  sitemap: { hostname: `${site}/` },
  transformHead({ pageData, siteData }) {
    const path = pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
    const url = new URL(`/${path}`, site).href
    const image = new URL('/og.png', site).href
    const title = pageData.title || siteData.title
    const description = pageData.frontmatter.description || siteData.description
    const head: [string, Record<string, string>, string?][] = []
    // 首页加结构化数据：告诉搜索引擎这是哪个网站、什么语言
    if (path === '')
      head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: siteData.title,
          url: `${site}/`,
          description: siteData.description,
          inLanguage: 'zh-CN',
        }),
      ])
    return [
      ...head,
      ['meta', { name: 'theme-color', content: '#03050a' }],
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:site_name', content: siteData.title }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:image', content: image }],
      ['meta', { property: 'og:locale', content: 'zh_CN' }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { name: 'twitter:url', content: url }],
      ['meta', { name: 'twitter:image', content: image }],
    ]
  },
  vite: {
    // 字数和预计阅读时间（首页 index.md 默认不显示）
    plugins: [
      PageProperties(),
      PagePropertiesMarkdownSection(),
      mermaidConfigPlugin,
      groupIconVitePlugin({
        // 插件从本地 Iconify 图标包读取 SVG，不在构建时请求网络。
        customIcon: { macos: 'logos:apple', windows: 'logos:microsoft-windows-icon' },
      }),
      GitChangelog({ repoURL: 'https://github.com/732124645/qiwu-doc' }),
      GitChangelogMarkdownSection({ excludes: ['index.md'], sections: { disableContributors: true } }),
    ],
    optimizeDeps: { exclude: ['@nolebase/vitepress-plugin-page-properties/client'] },
    ssr: { noExternal: ['@nolebase/vitepress-plugin-page-properties', '@nolebase/ui'] },
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}logo.svg` }],
    // 禁用脚本时首页不做滚动叙事，章节按顺序排开（同组件里的 .is-fallback）
    [
      'noscript',
      {},
      '<style>.qws{height:auto!important}.qws-stage{position:relative!important;height:auto!important}' +
        '.qws-canvas,.qws-hud,.qws-rail,.qws-cue,.qws-skip,.qws-progress{display:none!important}' +
        '.qws-chapters{position:relative!important;padding:96px 5vw 64px;pointer-events:auto!important}' +
        '.qws-chapter{position:static!important;max-width:820px!important;margin:0 auto 72px!important;opacity:1!important;translate:none!important;text-align:left!important}</style>',
    ],
  ],
  themeConfig: {
    // 每页底部的"在 GitHub 上编辑此页"：读者可以直接提交修改（Pull Request）
    editLink: {
      pattern: 'https://github.com/732124645/qiwu-doc/edit/main/:path',
      text: '在 GitHub 上编辑此页',
    },
    logo: '/logo.svg',
    nav: [
      { text: '指南', link: '/guide/introduction', activeMatch: '/guide/' },
      {
        text: '入门',
        activeMatch: '/(beginner|backend|java)/',
        items: [
          { text: '学生和新手：从零开始', link: '/beginner/' },
          { text: '前端开发者：后端入门', link: '/backend/' },
          { text: 'Java 开发者：转到 Node', link: '/java/' },
        ],
      },
      { text: '开发指南', link: '/core/', activeMatch: '/core/' },
      { text: '功能', link: '/features/', activeMatch: '/features/' },
      { text: '参考', link: '/reference/api', activeMatch: '/reference/' },
      { text: '更新日志', link: '/changelog' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '开始',
          items: [
            { text: '介绍', link: '/guide/introduction' },
            { text: '项目由来', link: '/guide/story' },
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '目录结构', link: '/guide/structure' },
          ],
        },
        {
          text: '开发',
          items: [
            { text: '新增业务模块', link: '/guide/new-module' },
            { text: '部署', link: '/guide/deploy' },
          ],
        },
      ],
      '/backend/': [
        {
          text: '写给前端开发者',
          items: [
            { text: '先看这里', link: '/backend/' },
            { text: '一个请求的一生', link: '/backend/request-lifecycle' },
          ],
        },
        {
          text: '基础概念',
          items: [
            { text: 'NestJS 基础', link: '/backend/nestjs' },
            { text: '数据库基础', link: '/backend/database' },
            { text: 'Redis 是做什么的', link: '/backend/redis' },
            { text: '登录是怎么回事', link: '/backend/auth' },
          ],
        },
        {
          text: '动手',
          items: [
            { text: '手把手：加一个自定义操作', link: '/backend/tutorial' },
            { text: '写测试', link: '/backend/testing' },
            { text: '排查问题', link: '/backend/debugging' },
          ],
        },
      ],
      '/beginner/': [
        {
          text: '准备',
          items: [
            { text: '先看这里', link: '/beginner/' },
            { text: '网站是怎么工作的', link: '/beginner/how-web-works' },
            { text: '终端入门', link: '/beginner/terminal' },
            { text: '安装环境（Mac）', link: '/beginner/install-mac' },
            { text: '安装环境（Windows）', link: '/beginner/install-windows' },
          ],
        },
        {
          text: '上手',
          items: [
            { text: '第一次把项目跑起来', link: '/beginner/first-run' },
            { text: '逛一逛后台', link: '/beginner/admin-tour' },
            { text: '第一次改代码', link: '/beginner/first-change' },
            { text: '做第一个模块：课程管理', link: '/beginner/first-module' },
            { text: '用 Git 保存进度', link: '/beginner/git' },
          ],
        },
        {
          text: '遇到问题',
          items: [
            { text: '看不懂报错怎么办', link: '/beginner/errors' },
            { text: '术语表', link: '/beginner/glossary' },
            { text: '接下来学什么', link: '/beginner/next' },
          ],
        },
      ],
      '/java/': [
        {
          text: '写给 Java 开发者',
          items: [
            { text: '先看这里', link: '/java/' },
            { text: 'Node.js 和 JVM 的差异', link: '/java/node-runtime' },
            { text: 'TypeScript 速成', link: '/java/typescript' },
            { text: 'Spring Boot 对照 NestJS', link: '/java/spring-to-nest' },
            { text: '从 RuoYi 过来', link: '/java/from-ruoyi' },
            { text: '前端速成：Vue 3', link: '/java/vue-primer' },
          ],
        },
      ],
      '/core/': [
        { text: '总览', items: [{ text: '开发指南总览', link: '/core/' }] },
        {
          text: '后端核心',
          items: [
            { text: '模块结构与注册', link: '/core/module' },
            { text: '控制器', link: '/core/controller' },
            { text: '服务', link: '/core/service' },
            { text: '实体与数据库', link: '/core/entity' },
            { text: '查询', link: '/core/query' },
            { text: '参数校验', link: '/core/validation' },
            { text: '异常处理', link: '/core/errors' },
            { text: '种子与菜单', link: '/core/seed' },
          ],
        },
        {
          text: '后端功能',
          items: [
            { text: '权限与数据范围', link: '/core/permission' },
            { text: '缓存', link: '/core/cache' },
            { text: '防重复提交、限流与锁', link: '/core/guards' },
            { text: '定时任务', link: '/core/job' },
            { text: '消息通知', link: '/core/notify' },
            { text: '实时推送', link: '/core/realtime' },
            { text: '文件上传', link: '/core/upload' },
            { text: 'Excel 导入导出', link: '/core/excel' },
            { text: '富文本', link: '/core/richtext' },
            { text: '字典', link: '/core/dict' },
            { text: '参数设置', link: '/core/param' },
            { text: '操作日志', link: '/core/action-log' },
            { text: '国际化', link: '/core/i18n' },
          ],
        },
        {
          text: '前端核心',
          items: [
            { text: '接口请求', link: '/core/web-request' },
            { text: '路由与菜单', link: '/core/web-router' },
            { text: '列表页', link: '/core/crud-list' },
            { text: '表单弹框', link: '/core/crud-form' },
            { text: '权限与翻译', link: '/core/web-perm-i18n' },
            { text: '常用组件', link: '/core/web-components' },
          ],
        },
      ],
      '/features/': [
        { text: '总览', items: [{ text: '功能总览', link: '/features/' }] },
        {
          text: '系统',
          items: [
            { text: '系统管理', link: '/features/system' },
            { text: '登录与账号', link: '/features/login' },
            { text: '单点登录（OAuth2）', link: '/features/oauth' },
            { text: '权限与数据范围', link: '/features/permission' },
            { text: '监控与日志', link: '/features/monitor' },
            { text: '定时任务', link: '/features/job' },
            { text: '消息中心', link: '/features/messaging' },
            { text: '文件管理', link: '/features/storage' },
          ],
        },
        {
          text: '开发工具',
          items: [
            { text: '代码生成器', link: '/features/codegen' },
            { text: '表单设计器', link: '/features/formkit' },
          ],
        },
        {
          text: '审批',
          items: [{ text: '工作流', link: '/features/workflow' }],
        },
        {
          text: '全局能力',
          items: [
            { text: '国际化', link: '/features/i18n' },
            { text: '实时推送', link: '/features/realtime' },
            { text: '安全基线', link: '/features/security' },
          ],
        },
      ],
      '/reference/': [
        {
          text: '参考',
          items: [
            { text: 'API 约定', link: '/reference/api' },
            { text: '命令', link: '/reference/commands' },
            { text: '环境变量', link: '/reference/env' },
            { text: 'OAuth2 接入指南', link: '/reference/oauth2' },
          ],
        },
      ],
    },
    search: {
      provider: 'local',
      options: {
        miniSearch: {
          searchOptions: { combineWith: 'AND' },
          options: {
            // VitePress 1.6 会序列化函数并在浏览器还原，因此不能引用外部闭包。
            tokenize: (text) => {
              const segmenter = new Intl.Segmenter('zh', { granularity: 'word' })
              return Array.from(segmenter.segment(text))
                .filter((word) => word.isWordLike)
                .map((word) => word.segment)
                .flatMap((word) => word.split(/\p{P}+/u))
                .filter(Boolean)
            },
          },
        },
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清除',
            backButtonTitle: '关闭搜索',
            displayDetails: '显示详细列表',
            footer: {
              selectText: '选择',
              selectKeyAriaLabel: '回车键',
              navigateText: '切换',
              navigateUpKeyAriaLabel: '向上方向键',
              navigateDownKeyAriaLabel: '向下方向键',
              closeText: '关闭',
              closeKeyAriaLabel: '退出键',
            },
          },
        },
      },
    },
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdated: { text: '最后更新' },
    darkModeSwitchLabel: '外观',
    darkModeSwitchTitle: '切换到深色模式',
    lightModeSwitchTitle: '切换到浅色模式',
    langMenuLabel: '切换语言',
    skipToContentLabel: '跳到正文',
    notFound: {
      title: '页面不存在',
      quote: '这个地址没有对应的页面，可以返回首页继续浏览。',
      linkLabel: '返回首页',
      linkText: '返回首页',
    },
    externalLinkIcon: true,
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    footer: { message: '基于 MIT 协议发布', copyright: '© 2026 栖梧 Qiwu' },
  },
})
