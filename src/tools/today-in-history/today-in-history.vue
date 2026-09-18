<script setup lang="ts">
/**
 * 历史上的今天 —— 走本站 Pages Function `/api/today`，进入页面即自动加载。
 */
interface HistoryEvent {
  date: string
  title: string
}

const events = ref<HistoryEvent[]>([]);
const error = ref('');
const loading = ref(false);

async function load() {
  loading.value = true;
  error.value = '';
  events.value = [];
  try {
    const resp = await fetch('/api/today');
    const data = await resp.json().catch(() => null);

    if (!resp.ok || !data) {
      throw new Error(data?.error ?? `服务返回 ${resp.status}`);
    }
    events.value = data.events ?? [];
    if (events.value.length === 0) {
      error.value = '今天没有查到历史事件记录';
    }
  }
  catch (e) {
    error.value = `加载失败：${e instanceof Error ? e.message : String(e)}（该工具需部署到 Cloudflare Pages 后使用）`;
  }
  finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div flex flex-col gap-3>
    <div flex gap-2 items-center>
      <c-button type="primary" :disabled="loading" @click="load">
        {{ loading ? '加载中…' : '重新加载' }}
      </c-button>
      <span op-60 text-13px>进入页面时已自动加载一次</span>
    </div>

    <c-alert v-if="error">
      {{ error }}
    </c-alert>

    <c-card v-for="(event, index) of events" :key="`${event.date}-${index}`">
      <div flex gap-3 items-baseline>
        <span op-70 text-13px font-mono ws-nowrap>{{ event.date }}</span>
        <span>{{ event.title }}</span>
      </div>
    </c-card>
  </div>
</template>
