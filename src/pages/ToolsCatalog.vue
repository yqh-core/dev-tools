<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { usePageSeo } from '@/seo/use-page-seo';
import { useToolStore } from '@/tools/tools.store';
import { normalizePath } from '@/seo/site';

/**
 * /tools 全量目录页（P1 重排 · 2026-10-13 新建）。
 *
 * 职责：承接原首页尾部「分类浏览」矩阵的 101 个工具内链（红线：整站内链
 * 不减少，从首页迁来而非删除）。首页从此只做入口（精选 + 类目卡），
 * 全量目录在这里按 10 类目平铺。
 *
 * 数据源：toolStore.toolsByCategory —— 与侧栏菜单、首页 categoriesPreview
 * 同一事实源，无第二份分类表。
 * 排序沿用注册顺序（toolsByCategory 的原始顺序），不引入热度算法（无后端统计）。
 */
const { t } = useI18n();
usePageSeo('/tools', t('site.toolsCatalogTitle'));
const toolStore = useToolStore();
</script>

<template>
  <div class="tools-catalog">
    <header class="catalog-hero">
      <h1 class="catalog-title">
        {{ $t('toolsCatalog.title') }}
      </h1>
      <p class="catalog-subtitle">
        {{ $t('toolsCatalog.subtitle', { count: toolStore.tools.length }) }}
      </p>
    </header>

    <RouterLink
      class="catalog-flagship"
      :to="normalizePath('/api-studio')"
      :aria-label="t('toolsCatalog.flagship.open')"
    >
      <div class="catalog-flagship-copy">
        <span class="catalog-flagship-eyebrow">{{ t('toolsCatalog.flagship.eyebrow') }}</span>
        <h2 class="catalog-flagship-title">{{ t('toolsCatalog.flagship.title') }}</h2>
        <p class="catalog-flagship-description">{{ t('toolsCatalog.flagship.description') }}</p>
      </div>
      <span class="catalog-flagship-action">
        {{ t('toolsCatalog.flagship.open') }}
        <span aria-hidden="true">→</span>
      </span>
    </RouterLink>

    <div class="catalog-body">
      <section
        v-for="cat in toolStore.toolsByCategory"
        :id="`cat-${cat.name.toLowerCase().replace(/[^a-z]+/g, '-')}`"
        :key="cat.name"
        class="catalog-section"
      >
        <h2 class="catalog-section-title">
          {{ cat.name }}
          <span class="catalog-section-count">{{ cat.components.length }}</span>
        </h2>
        <div class="catalog-grid">
          <RouterLink
            v-for="tool in cat.components"
            :key="tool.path"
            class="catalog-card"
            :to="normalizePath(tool.path)"
          >
            <n-icon :component="tool.icon" size="18" class="catalog-card-icon" />
            <div class="catalog-card-body">
              <span class="catalog-card-name">{{ tool.name }}</span>
              <span class="catalog-card-desc">{{ tool.description }}</span>
            </div>
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="less">
.tools-catalog {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.catalog-hero {
  margin-bottom: 28px;
}

.catalog-title {
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 8px;
}

.catalog-subtitle {
  color: var(--dd-text-soft, #475569);
  margin: 0;
}

.catalog-flagship {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin: 0 0 32px;
  padding: 20px 22px;
  border: 1px solid color-mix(in srgb, var(--dd-primary) 28%, var(--dd-border));
  border-left: 4px solid var(--dd-primary);
  border-radius: var(--dd-radius, 10px);
  background: var(--dd-surface, #fff);
  color: var(--dd-text, #0f172a);
  text-decoration: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;

  &:hover {
    border-color: var(--dd-primary);
    background: var(--dd-surface-2, #f8fafc);
  }

  &:focus-visible {
    outline: 2px solid var(--dd-primary);
    outline-offset: 3px;
  }
}

.catalog-flagship-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.catalog-flagship-eyebrow {
  color: var(--dd-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.catalog-flagship-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 650;
}

.catalog-flagship-description {
  margin: 0;
  color: var(--dd-text-soft, #475569);
  font-size: 0.9rem;
  line-height: 1.6;
}

.catalog-flagship-action {
  display: inline-flex;
  min-height: 44px;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
  padding: 9px 13px;
  border: 1px solid var(--dd-primary);
  border-radius: 8px;
  color: var(--dd-primary);
  font-size: 13px;
  font-weight: 650;
}

@media (max-width: 600px) {
  .catalog-flagship {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
    padding: 17px;
  }
}

.catalog-section {
  margin-bottom: 32px;
}

.catalog-section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 12px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.catalog-section-count {
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--dd-text-muted, #94a3b8);
}

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 10px;
}

@media (min-width: 640px) {
  .catalog-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 960px) {
  .catalog-grid { grid-template-columns: repeat(3, 1fr); }
}

.catalog-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--dd-border, #e2e8f0);
  border-radius: var(--dd-radius, 10px);
  background: var(--dd-surface, #fff);
  text-decoration: none;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(--dd-primary-hover, #0d9488);
  }
}

.catalog-card-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.catalog-card-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.catalog-card-name {
  font-weight: 500;
  color: var(--dd-text, #0f172a);
  overflow-wrap: break-word;
}

.catalog-card-desc {
  font-size: 0.8rem;
  color: var(--dd-text-muted, #94a3b8);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
