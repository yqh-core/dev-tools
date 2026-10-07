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
    error.value = '请先输入网址';
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
      throw new Error(data?.error ?? `服务返回 ${resp.status}`);
    }
    status.value = data.status ?? null;
    headers.value = data.headers ?? {};

    if (status.value === null) {
      error.value = data.error ?? '服务未返回状态码';
    }
  }
  catch (e) {
    error.value = `检测失败：${e instanceof Error ? e.message : String(e)}（该工具需部署到 Cloudflare Pages 后使用）`;
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
      label="网址："
      placeholder="输入网址，如 example.com"
      label-position="left"
      label-width="80px"
      label-align="right"
      raw-text
      clearable
      @keydown.enter="check"
    />

    <div flex items-center gap-2>
      <c-button type="primary" :disabled="loading || !url.trim()" @click="check">
        {{ loading ? '检测中…' : '检测状态码' }}
      </c-button>
      <span text-13px op-60>未写协议时按 https 处理</span>
    </div>

    <c-alert v-if="error">
      {{ error }}
    </c-alert>

    <c-card v-if="status !== null">
      <div flex items-baseline gap-3>
        <span text-13px op-70>状态码：</span>
        <span text-32px font-bold :class="statusTone">{{ status }}</span>
      </div>
    </c-card>

    <div v-if="headerEntries.length">
      <div mb-1 flex items-center justify-between>
        <span text-13px op-70>响应头（{{ headerEntries.length }} 项）：</span>
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
