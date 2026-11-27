<script setup lang="ts">
import { computed } from 'vue';
import { useStorage } from '@vueuse/core';
import { darkTheme } from 'naive-ui';
import { apiStudioDarkOverrides, apiStudioLightOverrides } from '@/themes/api-studio';
import { config } from '@/config';

type ApiTheme = 'dark' | 'light';
const apiTheme = useStorage<ApiTheme>('api-studio:theme', 'dark');
const theme = computed(() => (apiTheme.value === 'dark' ? darkTheme : null));
const themeOverrides = computed(() =>
  apiTheme.value === 'dark' ? apiStudioDarkOverrides : apiStudioLightOverrides,
);
const version = config.app.version;
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides">
    <div class="api-studio-shell" :data-api-theme="apiTheme">
      <header class="api-topbar">
        <a href="/" class="api-brand" aria-label="API Studio overview">
          <span class="api-brand-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="api-brand-name">API Studio</span>
          <span class="api-brand-tag">by DigDevBox</span>
        </a>

        <div class="api-legend" aria-label="HTTP methods">
          <span v-for="method in methods" :key="method" class="api-legend-chip" :data-method="method">
            <span class="api-legend-dot" aria-hidden="true"/>
            <span class="api-legend-label">{{ method }}</span>
          </span>
        </div>

        <nav class="api-topbar-actions" aria-label="Workspace links">
          <a class="api-iconbtn api-back" href="/docs/">Guides</a>
          <button
            class="api-iconbtn"
            type="button"
            :aria-label="apiTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
            @click="apiTheme = apiTheme === 'dark' ? 'light' : 'dark'"
          >
            {{ apiTheme === 'dark' ? 'Light theme' : 'Dark theme' }}
          </button>
          <span class="api-version">v{{ version }}</span>
        </nav>
      </header>
      <main class="api-shell-body">
        <slot />
      </main>
    </div>
  </n-config-provider>
</template>

<style scoped>
.api-studio-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
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
  flex: 0 0 auto;
  color: var(--api-text);
  text-decoration: none;
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
  font-weight: 650;
  letter-spacing: .2px;
}
.api-brand-tag {
  margin-left: var(--api-gap-xs);
  padding-left: var(--api-gap-sm);
  border-left: 1px solid var(--api-border);
  color: var(--api-text-faint);
  font-size: var(--api-fs-xs);
}
.api-legend {
  display: flex;
  align-items: center;
  gap: var(--api-gap);
  margin-left: var(--api-gap-lg);
}
.api-legend-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--api-text-muted);
  font-size: var(--api-fs-xs);
}
.api-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--api-method-neutral);
}
.api-legend-chip[data-method="GET"] .api-legend-dot { background: var(--api-method-get); }
.api-legend-chip[data-method="POST"] .api-legend-dot { background: var(--api-method-post); }
.api-legend-chip[data-method="PUT"] .api-legend-dot { background: var(--api-method-put); }
.api-legend-chip[data-method="PATCH"] .api-legend-dot { background: var(--api-method-patch); }
.api-legend-chip[data-method="DELETE"] .api-legend-dot { background: var(--api-method-delete); }
.api-legend-label { font-family: var(--api-font-mono); font-weight: 650; }
.api-topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--api-gap-sm);
  margin-left: auto;
}
.api-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
  color: var(--api-text-soft);
  font: inherit;
  font-size: var(--api-fs-sm);
  text-decoration: none;
  cursor: pointer;
}
.api-iconbtn:hover { border-color: var(--api-primary-line); color: var(--api-text); }
.api-version {
  color: var(--api-text-faint);
  font-family: var(--api-font-mono);
  font-size: var(--api-fs-xs);
}
.api-shell-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: var(--api-bg);
}
@media (max-width: 760px) {
  .api-legend { display: none; }
}
@media (max-width: 520px) {
  .api-topbar { gap: 7px; padding: 0 9px; }
  .api-brand { gap: 6px; }
  .api-brand-mark { width: 26px; height: 26px; }
  .api-brand-name { font-size: var(--api-fs); }
  .api-brand-tag, .api-version { display: none; }
  .api-topbar-actions { gap: 5px; }
  .api-iconbtn { padding: 0 8px; }
}
</style>
