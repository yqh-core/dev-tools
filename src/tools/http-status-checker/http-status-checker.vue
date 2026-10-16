<script setup lang="ts">
/**
 * HTTP 状态码检测 —— 走本站 Pages Function `/api/webstatus`。
 *
 * 返回的是「边缘节点看到的」状态码与响应头：与本机 curl 结果可能不同
 * （例如本机被 DNS 缓存或代理影响时），这一点在界面里要说明。
 *
 * 本页有一种「部分结果 + 错误」的形态：响应头拿到了但状态码为空时，
 * 要**同时**显示响应头和一句说明，所以不能压成成功/失败二选一。
 * toolFetch 的 error 态允许带 data，正是为这种形态留的扩展点。
 */
import { useToolFetch } from '@/composable/toolFetch';

interface WebStatus {
  status: number | null
  headers: Record<string, string>
}

const url = useStorage('http-status-checker:url', '');

const { data, error, isLoading, execute } = useToolFetch<WebStatus>({
  resolveUrl: (input) => {
    const u = input.trim();
    if (!u) {
      return { error: 'Enter a URL first' };
    }
    // 未写协议时按 https 处理（界面上有这句提示）
    const withScheme = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    return { url: `/api/webstatus?url=${encodeURIComponent(withScheme)}` };
  },
  interpret: (payload) => {
    const status = (payload.status as number) ?? null;
    const headers = (payload.headers as Record<string, string>) ?? {};
    return status === null
      ? { error: (payload.error as string) ?? 'The service returned no status code', data: { status, headers } }
      : { data: { status, headers } };
  },
  errorPrefix: 'Check failed',
});

const status = computed(() => data.value?.status ?? null);
const headers = computed(() => data.value?.headers ?? {});

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
      @keydown.enter="execute(url)"
    />

    <div flex items-center gap-2>
      <c-button type="primary" :disabled="isLoading || !url.trim()" @click="execute(url)">
        {{ isLoading ? 'Checking…' : 'Check status code' }}
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
