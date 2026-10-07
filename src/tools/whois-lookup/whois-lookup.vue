<script setup lang="ts">
/**
 * WHOIS 查询 —— 走本站 Pages Function `/api/whois`（RDAP 协议）。
 *
 * 注意：接口只在部署到 Cloudflare Pages 后存在，本地 `vite dev` 下会请求失败，
 * 所以错误文案里要明确写出这一点，避免被误判成工具本身的 bug。
 */
const domain = useStorage('whois-lookup:domain', '');
const result = ref('');
const error = ref('');
const loading = ref(false);

// 用户常把整条 URL 粘进来；这里只取主机名部分
function normalize(input: string) {
  return input
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '');
}

async function queryWhois() {
  const d = normalize(domain.value);
  if (!d) {
    error.value = '请先输入域名';
    return;
  }

  error.value = '';
  result.value = '';
  loading.value = true;
  try {
    const resp = await fetch(`/api/whois?domain=${encodeURIComponent(d)}`);
    const data = await resp.json().catch(() => null);

    if (!resp.ok || !data) {
      throw new Error(data?.error ?? `服务返回 ${resp.status}`);
    }
    result.value = data.raw ?? data.error ?? '无返回内容';
  }
  catch (e) {
    error.value = `查询失败：${e instanceof Error ? e.message : String(e)}（该工具需部署到 Cloudflare Pages 后使用）`;
  }
  finally {
    loading.value = false;
  }
}

function clear() {
  result.value = '';
  error.value = '';
}
</script>

<template>
  <div flex flex-col gap-3>
    <c-input-text
      v-model:value="domain"
      label="域名："
      placeholder="输入域名，如 example.com"
      label-position="left"
      label-width="80px"
      label-align="right"
      raw-text
      clearable
      @keydown.enter="queryWhois"
    />

    <div flex items-center gap-2>
      <c-button type="primary" :disabled="loading || !domain.trim()" @click="queryWhois">
        {{ loading ? '查询中…' : '查询 WHOIS' }}
      </c-button>
      <c-button v-if="result || error" @click="clear">
        清空
      </c-button>
    </div>

    <c-alert v-if="error">
      {{ error }}
    </c-alert>

    <div v-if="result">
      <div mb-1 text-13px op-70>
        注册信息：
      </div>
      <TextareaCopyable :value="result" />
    </div>
  </div>
</template>
