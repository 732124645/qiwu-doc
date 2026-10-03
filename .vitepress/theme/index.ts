import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { defineAsyncComponent } from 'vue'
import { NolebaseGitChangelogPlugin } from '@nolebase/vitepress-plugin-git-changelog/client'
import { defaultZhCNLocale } from '@nolebase/vitepress-plugin-git-changelog/locales'
import {
  NolebasePageProperties,
  NolebasePagePropertiesPlugin,
} from '@nolebase/vitepress-plugin-page-properties/client'
import '@nolebase/vitepress-plugin-page-properties/client/style.css'
import '@nolebase/vitepress-plugin-git-changelog/client/style.css'
import 'virtual:group-icons.css'
import Layout from './Layout.vue'
import QwStory from './components/QwStory.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('Mermaid', defineAsyncComponent(() => import('vitepress-plugin-mermaid/Mermaid.vue')))
    app.use(NolebaseGitChangelogPlugin, { locales: { 'zh-CN': defaultZhCNLocale } })
    app.component('NolebasePageProperties', NolebasePageProperties)
    app.component('QwStory', QwStory)
    app.use(NolebasePagePropertiesPlugin(), {
      properties: {
        'zh-CN': [
          { key: 'wordsCount', type: 'dynamic', title: '字数', options: { type: 'wordsCount' } },
          {
            key: 'readingTime',
            type: 'dynamic',
            title: '预计阅读',
            options: { type: 'readingTime', dateFnsLocaleName: 'zhCN' },
          },
        ],
      },
    })
  },
} satisfies Theme
