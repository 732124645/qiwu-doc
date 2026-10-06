<script setup lang="ts">
import Giscus from '@giscus/vue'
import mediumZoom from 'medium-zoom'
import { useData, useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { onMounted, watch } from 'vue'
import { giscusIds } from './giscus'

const { isDark, page, lang } = useData()
const { Layout } = DefaultTheme
const route = useRoute()

// 正文图片点击放大（链接里的图片除外）；换页后解绑旧图片、绑定新页面的图片
const zoomable = '.vp-doc img:not(a img)'
onMounted(() => {
  const zoom = mediumZoom(zoomable, { background: 'var(--vp-c-bg)', margin: 24 })
  watch(() => route.path, () => zoom.detach().attach(zoomable), { flush: 'post' })
})
</script>

<template>
  <Layout>
    <template #doc-after>
      <ClientOnly>
        <section v-if="giscusIds.repoId && giscusIds.categoryId" class="qw-comments" :aria-label="lang.startsWith('en') ? 'Comments' : '评论'">
          <Giscus
            :key="page.relativePath"
            repo="732124645/qiwu-doc"
            :repo-id="giscusIds.repoId"
            category="Announcements"
            :category-id="giscusIds.categoryId"
            mapping="pathname"
            :lang="lang.startsWith('en') ? 'en' : 'zh-CN'"
            reactions-enabled="1"
            input-position="top"
            :theme="isDark ? 'dark' : 'light'"
          />
        </section>
      </ClientOnly>
    </template>
  </Layout>
</template>

<style scoped>
.qw-comments {
  margin-top: 32px;
}
</style>
