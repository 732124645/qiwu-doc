<script setup lang="ts">
import Giscus from '@giscus/vue'
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { giscusIds } from './giscus'

const { isDark, page } = useData()
const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #doc-after>
      <ClientOnly>
        <section v-if="giscusIds.repoId && giscusIds.categoryId" class="qw-comments" aria-label="评论">
          <Giscus
            :key="page.relativePath"
            repo="732124645/qiwu-doc"
            :repo-id="giscusIds.repoId"
            category="Announcements"
            :category-id="giscusIds.categoryId"
            mapping="pathname"
            lang="zh-CN"
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
