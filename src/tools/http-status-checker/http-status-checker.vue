<script setup lang="ts">
/**
 * HTTP 状态码检测 —— 走本站 Pages Function `/api/webstatus`。
 *
 * 返回的是「边缘节点看到的」状态码与响应头：与本机 curl 结果可能不同
 * （例如本机被 DNS 缓存或代理影响时），这一点在界面里要说明。
 */
const url = useStorage('http-status-checker:url', '');
const status = ref<number | null>(null);
const headers = ref<Record<string, string>>({});
const error = ref('');
const loading = ref(false);

const statusTone = computed(() => {
  if (status.value === null) {
    return 'text-current';
  }
  if (status.value < 300) {
    return 'text-green';
  }
  if (status.value < 400) {
    return 'text-orange';
  }
  return 'text-red';
});

async function check() {
  let u = url.value.trim();
  if (!u) {
    error.value = 'Enter a URL first';
    return;
  }
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }

  error.value = '';
  status.value = null;
  headers.value = {};
  loading.value = true;
  try {
    const resp = await fetch(`/api/webstatus?url=${encodeURIComponent(u)}`);
    const data = await resp.json().catch(() => null);

    if (!resp.ok || !data) {
      throw new Error(data?.error ?? `Service returned HTTP ${resp.status}`);
    }
    status.value = data.status ?? null;
    headers.value = data.headers ?? {};

    if (status.value === null) {
      error.value = data.error ?? 'The service returned no status code';
    }
  }
  catch (e) {
    error.value = `Check failed: ${e instanceof Error ? e.message : String(e)} (this tool needs the Cloudflare Pages deployment)`;
  }
  finally {
    loading.value = false;
  }
}

const headerEntries = computed(() => Object.entries(headers.value));
const headersText = computed(() => JSON.stringify(headers.value, null, 2));
</script>

<template>
  <div flex flex-col gap-3>
    <c-input-text
      v-model:value="url"
      label="URL:"
      placeholder="Enter a URL, e.g. example.com"
      label-position="left"
      label-width="80px"
      label-align="right"
      raw-text
      clearable
      @keydown.enter="check"
    />

    <div flex items-center gap-2>
      <c-button type="primary" :disabled="loading || !url.trim()" @click="check">
        {{ loading ? 'Checking…' : 'Check status code' }}
      </c-button>
      <span text-13px op-60>Assumes https when no scheme is given</span>
    </div>

    <c-alert v-if="error">
      {{ error }}
    </c-alert>

    <c-card v-if="status !== null">
      <div flex items-baseline gap-3>
        <span text-13px op-70>Status code:</span>
        <span text-32px font-bold :class="statusTone">{{ status }}</span>
      </div>
    </c-card>

    <div v-if="headerEntries.length">
      <div mb-1 flex items-center justify-between>
        <span text-13px op-70>Response headers ({{ headerEntries.length }}):</span>
        <SpanCopyable v-if="headersText" :value="headersText" />
      </div>
      <c-card v-for="[key, value] of headerEntries" :key="key" mb-2>
        <div text-13px op-70>
          {{ key }}
        </div>
        <div break-all>
          {{ value }}
        </div>
      </c-card>
    </div>
  </div>
</template>
