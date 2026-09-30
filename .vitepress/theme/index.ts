import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import {
  NolebasePageProperties,
  NolebasePagePropertiesPlugin,
} from '@nolebase/vitepress-plugin-page-properties/client'
import '@nolebase/vitepress-plugin-page-properties/client/style.css'
import QwStory from './components/QwStory.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
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
