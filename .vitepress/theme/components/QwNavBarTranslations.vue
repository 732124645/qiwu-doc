<script setup lang="ts">
// 替换默认主题的 VPNavBarTranslations（config.mts 用别名指到这里）：按钮上除了图标，再写出当前语言名
import { useData } from 'vitepress'
import VPFlyout from 'vitepress/dist/client/theme-default/components/VPFlyout.vue'
import VPMenuLink from 'vitepress/dist/client/theme-default/components/VPMenuLink.vue'
import { useLangs } from '../langs'

const { theme } = useData()
const { localeLinks, currentLang } = useLangs({ correspondingLink: true })
</script>

<template>
  <VPFlyout
    v-if="localeLinks.length && currentLang.label"
    class="VPNavBarTranslations"
    icon="vpi-languages"
    :button="currentLang.label"
    :label="`${theme.langMenuLabel || 'Change language'} (${currentLang.label})`"
  >
    <div class="items">
      <p class="title">{{ currentLang.label }}</p>

      <template v-for="locale in localeLinks" :key="locale.link">
        <VPMenuLink :item="locale" />
      </template>
    </div>
  </VPFlyout>
</template>

<style scoped>
.VPNavBarTranslations {
  display: none;
}

@media (min-width: 1280px) {
  .VPNavBarTranslations {
    display: flex;
    align-items: center;
  }
}

.VPNavBarTranslations :deep(.option-icon) {
  margin-right: 6px;
}

.title {
  padding: 0 24px 0 12px;
  line-height: 32px;
  font-size: 14px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}
</style>
