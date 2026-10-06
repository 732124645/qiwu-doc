import { computed } from 'vue'
import { useData } from 'vitepress'

/**
 * 替换默认主题内部的 composables/langs（config.mts 用别名指到这里），导航栏、"…"菜单和手机菜单的语言切换都走它。
 * 英文版只翻译了一部分页面（themeConfig.enPages）：中文页面有英文版时切到同一页，没有时去英文首页，不会进 404。
 */
export function useLangs({ correspondingLink = false } = {}) {
  const { site, localeIndex, page, theme, hash } = useData()

  const currentLang = computed(() => ({
    label: site.value.locales[localeIndex.value]?.label,
    link: site.value.locales[localeIndex.value]?.link || (localeIndex.value === 'root' ? '/' : `/${localeIndex.value}/`),
  }))

  const localeLinks = computed(() =>
    Object.entries(site.value.locales).flatMap(([key, value]) => {
      if (currentLang.value.label === value.label) return []
      const home = value.link || (key === 'root' ? '/' : `/${key}/`)
      const path = page.value.relativePath.slice(currentLang.value.link.length - 1)
      // 中文是完整版，任何页面都有（英文 404 页也切到同名中文页）；英文只有 enPages 里的页面
      const exists = key === 'root' || (theme.value.enPages ?? []).includes(path)
      if (!correspondingLink || theme.value.i18nRouting === false || !exists) return { text: value.label, link: home }
      const target = path.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, site.value.cleanUrls ? '' : '.html')
      return { text: value.label, link: `${home.replace(/\/$/, '')}/${target}${hash.value}` }
    }),
  )

  return { localeLinks, currentLang }
}
