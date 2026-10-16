<script setup lang="ts">
/**
 * WHOIS 查询 —— 走本站 Pages Function `/api/whois`（RDAP 协议）。
 *
 * 注意：接口只在部署到 Cloudflare Pages 后存在，本地 `vite dev` 下会请求失败，
 * 所以错误文案里要明确写出这一点，避免被误判成工具本身的 bug。
 *
 * loading / 错误 / 结果这一组状态改由 `@/composable/toolFetch` 统一持有，
 * 本页只留两件事：输入怎么归一化，以及 200 之后 payload 怎么解释。
 */
import { useToolFetch } from '@/composable/toolFetch';

const domain = useStorage('whois-lookup:domain', '');

// 用户常把整条 URL 粘进来；这里只取主机名部分
function normalize(input: string) {
  return input
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '');
}

const { data, error, isLoading, execute, clear } = useToolFetch<string>({
  resolveUrl: (input) => {
    const d = normalize(input);
    return d ? { url: `/api/whois?domain=${encodeURIComponent(d)}` } : { error: 'Enter a domain first' };
  },
  // raw 缺失时退回接口给的 error 文本，再退回占位句 —— 与改造前逐字一致
  interpret: payload => ({ data: (payload.raw ?? payload.error ?? 'Nothing returned') as string }),
  errorPrefix: 'Lookup failed',
});

const result = computed(() => data.value ?? '');
</script>

<template>
  <div flex flex-col gap-3>
    <c-input-text
      v-model:value="domain"
      label="Domain:"
      placeholder="Enter a domain, e.g. example.com"
      label-position="left"
      label-width="80px"
      label-align="right"
      raw-text
      clearable
      @keydown.enter="execute(domain)"
    />

    <div flex items-center gap-2>
      <c-button type="primary" :disabled="isLoading || !domain.trim()" @click="execute(domain)">
        {{ isLoading ? 'Querying…' : 'Query WHOIS' }}
      </c-button>
      <c-button v-if="result || error" @click="clear">
        Clear
      </c-button>
    </div>

    <c-alert v-if="error">
      {{ error }}
    </c-alert>

    <div v-if="result">
      <div mb-1 text-13px op-70>
        Registration details:
      </div>
      <TextareaCopyable :value="result" />
    </div>
  </div>
</template>
