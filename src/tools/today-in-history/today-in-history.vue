<script setup lang="ts">
/**
 * 历史上的今天 —— 走本站 Pages Function `/api/today`，进入页面即自动加载。
 *
 * 本页没有输入，但有一种「请求成功、结果为空」的形态：数据集是精选的、只覆盖部分日期，
 * 用户看到空结果时最需要知道的是**为什么空**，所以这里用接口给的 note 走 error 通道展示，
 * 而不是只丢一句「没查到」。
 */
import { useToolFetch } from '@/composable/toolFetch';

interface HistoryEvent {
  date: string
  title: string
}

const { data, error, isLoading, execute } = useToolFetch<HistoryEvent[]>({
  resolveUrl: () => ({ url: '/api/today' }),
  interpret: (payload) => {
    const events = (payload.events as HistoryEvent[]) ?? [];
    return events.length === 0
      ? { error: (payload.note as string) ?? 'No events recorded for today (the dataset is still growing)', data: events }
      : { data: events };
  },
  errorPrefix: 'Load failed',
});

const events = computed(() => data.value ?? []);

onMounted(() => execute());
</script>

<template>
  <div flex flex-col gap-3>
    <div flex items-center gap-2>
      <c-button type="primary" :disabled="isLoading" @click="execute()">
        {{ isLoading ? 'Loading…' : 'Reload' }}
      </c-button>
      <span text-13px op-60>Loaded automatically once when the page opened</span>
    </div>

    <c-alert v-if="error">
      {{ error }}
    </c-alert>

    <c-card v-for="(event, index) of events" :key="`${event.date}-${index}`">
      <div flex items-baseline gap-3>
        <span ws-nowrap text-13px font-mono op-70>{{ event.date }}</span>
        <span>{{ event.title }}</span>
      </div>
    </c-card>
  </div>
</template>
