<script lang="ts" setup>
// API Studio · 独立全屏应用壳（G3 UI 第 2 步）。
// 不走 dev-tools 的 tool.layout（那是「工具」chrome：面包屑/600px 列/SEO/guide/related）。
// 这里是产品级工作台外壳：自带嵌套 n-config-provider（深色为主，明暗自适应），
// 使 API-Studio 的主题独立于站点全局明暗；顶栏 + 全高内容区，内容区由路由页填充。
import { darkTheme } from 'naive-ui';
import { RouterLink } from 'vue-router';
import { apiStudioDarkOverrides, apiStudioLightOverrides } from '@/themes/api-studio';
import { config } from '@/config';
import '../styles/api-studio-tokens.css';

type ApiTheme = 'dark' | 'light';
// 深色是默认与主形态（专业 API 工作台）；偏好持久化，仅作用于本壳，不碰站点 styleStore。
const apiTheme = useStorage<ApiTheme>('api-studio:theme', 'dark');

const theme = computed(() => (apiTheme.value === 'dark' ? darkTheme : null));
const themeOverrides = computed(() => (apiTheme.value === 'dark' ? apiStudioDarkOverrides : apiStudioLightOverrides));

const version = config.app.version;

// 方法色标图例：既是设计系统的展示，也是给用户的颜色速查（商业 API 工具的标配）。
const methodLegend = [
  { m: 'GET', v: 'var(--api-method-get)' },
  { m: 'POST', v: 'var(--api-method-post)' },
  { m: 'PUT', v: 'var(--api-method-put)' },
  { m: 'PATCH', v: 'var(--api-method-patch)' },
  { m: 'DELETE', v: 'var(--api-method-delete)' },
] as const;
</script>

<template>
  <div class="api-studio-shell" :data-api-theme="apiTheme">
    <n-config-provider :theme="theme" :theme-overrides="themeOverrides">
      <header class="api-topbar">
        <RouterLink to="/api-studio" class="api-brand" aria-label="API Studio home">
          <span class="api-brand-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </span>
          <span class="api-brand-name">API Studio</span>
          <span class="api-brand-tag">by DigDevBox</span>
        </RouterLink>

        <div class="api-legend" aria-hidden="true">
          <span v-for="it in methodLegend" :key="it.m" class="api-legend-chip">
            <span class="api-legend-dot" :style="{ background: it.v }" />
            <span class="api-legend-label">{{ it.m }}</span>
          </span>
        </div>

        <div class="api-topbar-actions">
          <button
            class="api-iconbtn"
            type="button"
            :aria-label="apiTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
            :title="apiTheme === 'dark' ? 'Light theme' : 'Dark theme'"
            @click="apiTheme = apiTheme === 'dark' ? 'light' : 'dark'"
          >
            <svg v-if="apiTheme === 'dark'" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="2" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
            </svg>
          </button>

          <RouterLink to="/tools" class="api-iconbtn api-back" title="All tools">
            Tools
          </RouterLink>

          <span class="api-version">v{{ version }}</span>
        </div>
      </header>

      <div class="api-shell-body">
        <slot />
      </div>
    </n-config-provider>
  </div>
</template>

<style scoped>
.api-studio-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.api-topbar {
  display: flex;
  align-items: center;
  gap: var(--api-gap);
  height: var(--api-topbar-h);
  flex: 0 0 var(--api-topbar-h);
  padding: 0 var(--api-pad);
  background: var(--api-surface);
  border-bottom: 1px solid var(--api-border);
}

.api-brand {
  display: inline-flex;
  align-items: center;
  gap: var(--api-gap-sm);
  text-decoration: none;
  color: var(--api-text);
  flex: 0 0 auto;
}

.api-brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--api-radius-sm);
  background: var(--api-primary-soft);
  color: var(--api-primary);
}

.api-brand-name {
  font-size: var(--api-fs-lg);
  font-weight: 600;
  letter-spacing: 0.2px;
}

.api-brand-tag {
  font-size: var(--api-fs-xs);
  color: var(--api-text-faint);
  padding-left: var(--api-gap-sm);
  border-left: 1px solid var(--api-border);
  margin-left: var(--api-gap-xs);
}

.api-legend {
  display: flex;
  align-items: center;
  gap: var(--api-gap);
  margin-left: var(--api-gap-lg);
  overflow: hidden;
}

.api-legend-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--api-fs-xs);
  color: var(--api-text-muted);
  white-space: nowrap;
}

.api-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.api-legend-label {
  font-family: var(--api-font-mono);
  font-weight: 600;
}

.api-topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--api-gap-sm);
  margin-left: auto;
  flex: 0 0 auto;
}

.api-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 0 var(--api-gap-sm);
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
  color: var(--api-text-soft);
  font-size: var(--api-fs-sm);
  text-decoration: none;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.api-iconbtn:hover {
  border-color: var(--api-primary-line);
  color: var(--api-text);
  background: var(--api-surface-3);
}

.api-version {
  font-size: var(--api-fs-xs);
  font-family: var(--api-font-mono);
  color: var(--api-text-faint);
  padding-left: var(--api-gap-sm);
}

.api-shell-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: var(--api-bg);
}

/* App.vue supplies the named <main id="main-content"> through this layout slot.
   Give that nested route container a definite height so the mobile column layout
   can allocate the remaining viewport to the request editor instead of collapsing it. */
.api-shell-body :deep(#main-content) {
  height: 100%;
  min-height: 0;
}

@media (max-width: 760px) {
  .api-legend {
    display: none;
  }
}

@media (max-width: 520px) {
  .api-topbar {
    gap: 7px;
    padding: 0 9px;
  }

  .api-brand {
    gap: 6px;
  }

  .api-brand-mark {
    width: 26px;
    height: 26px;
  }

  .api-brand-name {
    font-size: var(--api-fs);
  }

  .api-brand-tag,
  .api-version {
    display: none;
  }

  .api-topbar-actions {
    gap: 5px;
  }
}
</style>
