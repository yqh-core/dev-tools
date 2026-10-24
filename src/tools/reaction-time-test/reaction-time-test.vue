<script setup lang="ts">
import { useEventListener } from '@vueuse/core';
import { computeStats, isValidReaction, parseRangeFromSearch, pickWaitMs } from './reaction-time-test.service';

type Phase = 'idle' | 'waiting' | 'ready' | 'early' | 'done';

const phase = ref<Phase>('idle');
const rounds = ref<number[]>([]);
const lastMs = ref<number | null>(null);

// 构建期预渲染跑 setup：window 访问必须等挂载，否则 SSG 直接 ReferenceError
let range = { minMs: 1200, maxMs: 4500 };

// 计时锚点：green 帧真正绘制完成后才起表（double rAF 越过本帧提交）。
// setTimeout 到期时刻直接起表会系统性偏快最多一帧 + 绘制管线的时间。
let armedAt = 0;
let waitTimer: ReturnType<typeof setTimeout> | undefined;

function clearWaitTimer() {
  if (waitTimer !== undefined) {
    clearTimeout(waitTimer);
    waitTimer = undefined;
  }
}

function armReady(delayMs: number) {
  clearWaitTimer();
  waitTimer = setTimeout(() => {
    phase.value = 'ready';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      armedAt = performance.now();
    }));
  }, delayMs);
}

function startRound() {
  phase.value = 'waiting';
  lastMs.value = null;
  armReady(pickWaitMs(range));
}

function onPanelClick() {
  switch (phase.value) {
    case 'waiting':
      // 抢跑：本次作废不进统计——统计里混进预判值就全毁了
      clearWaitTimer();
      phase.value = 'early';
      break;
    case 'ready': {
      const ms = performance.now() - armedAt;
      if (isValidReaction(ms)) {
        lastMs.value = Math.round(ms * 10) / 10;
        rounds.value = [...rounds.value, ms].slice(-5);
        phase.value = 'done';
      }
      else {
        phase.value = 'early';
      }
      break;
    }
    case 'early':
    case 'done':
    case 'idle':
      startRound();
      break;
  }
}

function onKey(e: KeyboardEvent) {
  if ((e.key === ' ' || e.key === 'Enter') && phase.value !== 'idle') {
    e.preventDefault();
    onPanelClick();
  }
}

// SSR 预渲染跑 setup：window 引用必须等挂载，否则构建期 ReferenceError
let stopKeydown: (() => void) | undefined;
onMounted(() => {
  range = parseRangeFromSearch(window.location.search);
  stopKeydown = useEventListener(window, 'keydown', onKey);
});

onUnmounted(() => {
  stopKeydown?.();
  clearWaitTimer();
});

const stats = computed(() => computeStats(rounds.value));
const panelText = computed(() => ({
  idle: 'Press Start, then click the instant the panel turns green',
  waiting: 'Wait for green…',
  ready: 'Click now!',
  early: 'Too soon — click to try again',
  done: `${lastMs.value} ms — click to go again`,
}[phase.value]));

const panelClass = computed(() => {
  if (phase.value === 'ready') {
    return 'rt-panel rt-green';
  }
  if (phase.value === 'waiting') {
    return 'rt-panel rt-red';
  }
  if (phase.value === 'early') {
    return 'rt-panel rt-orange';
  }
  return 'rt-panel rt-neutral';
});
</script>

<template>
  <div>
    <div
      :class="panelClass"
      data-test-id="rt-panel"
      role="button"
      tabindex="0"
      :aria-label="panelText"
      @click="onPanelClick"
    >
      <div class="rt-hint">
        {{ panelText }}
      </div>
    </div>

    <div mt-4 flex justify-center gap-3>
      <c-button v-if="phase === 'idle'" type="primary" data-test-id="rt-start" @click.stop="startRound">
        Start
      </c-button>
      <c-button v-if="phase === 'done'" data-test-id="rt-again" @click.stop="startRound">
        Try again
      </c-button>
      <c-button v-if="rounds.length > 0" data-test-id="rt-reset" @click.stop="clearWaitTimer(); rounds = []; phase = 'idle'">
        Reset
      </c-button>
    </div>

    <c-card v-if="rounds.length > 0" mt-5 title="Results" data-test-id="rt-result">
      <div grid grid-cols-3 mb-3 gap-2 text-center>
        <div>
          <div class="rt-stat-label">
            Best
          </div>
          <div data-test-id="rt-best" text-lg font-mono>
            {{ stats.bestMs !== null ? Math.round(stats.bestMs * 10) / 10 : '—' }}
          </div>
        </div>
        <div>
          <div class="rt-stat-label">
            Median
          </div>
          <div data-test-id="rt-median" text-lg font-mono>
            {{ stats.medianMs !== null ? Math.round(stats.medianMs * 10) / 10 : '—' }}
          </div>
        </div>
        <div>
          <div class="rt-stat-label">
            Mean
          </div>
          <div data-test-id="rt-mean" text-lg font-mono>
            {{ stats.meanMs !== null ? Math.round(stats.meanMs * 10) / 10 : '—' }}
          </div>
        </div>
      </div>
      <div v-for="(r, i) in rounds" :key="i" flex justify-between text-sm font-mono data-test-id="rt-round-row">
        <span>Round {{ i + 1 }}</span>
        <span>{{ Math.round(r * 10) / 10 }} ms</span>
      </div>
    </c-card>
  </div>
</template>

<style lang="css" scoped>
.rt-panel {
  min-height: 180px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  font-size: 22px;
  font-weight: 600;
  transition: background-color 60ms linear;
}
.rt-hint {
  padding: 0 16px;
  text-align: center;
}
.rt-stat-label {
  font-size: 12px;
  opacity: 0.6;
}
.rt-neutral { background: #e2e8f0; color: #334155; }
.rt-red { background: #dc2626; color: #fff; }
.rt-green { background: #16a34a; color: #fff; }
.rt-orange { background: #d97706; color: #fff; }
@media (prefers-color-scheme: dark) {
  .rt-neutral { background: #334155; color: #e2e8f0; }
}
@media (max-width: 640px) {
  .rt-panel { min-height: 150px; font-size: 18px; }
}
</style>
