<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { config } from '@/config';

/**
 * 不挡操作区的赞助位。
 *
 * 没有 `VITE_ADSENSE_SLOT` 时只显示一行说明和联系入口，不渲染空的广告 iframe。
 * 广告脚本已在 index.html 引入；这里只在站长填了广告位 id 之后 push 一次。
 */
withDefaults(defineProps<{ placement?: string }>(), { placement: 'content' });

const slotId = computed(() => (config.adsenseSlot || '').trim());
const adRef = ref<HTMLElement | null>(null);

onMounted(() => {
  if (!slotId.value || !adRef.value) {
    return;
  }
  const win = window as Window & { adsbygoogle?: Record<string, unknown>[] };
  win.adsbygoogle = win.adsbygoogle || [];
  try {
    win.adsbygoogle.push({});
  }
  catch {
    // 热更新时同一个 <ins> 再 push 会抛错，单元本身仍由已加载的脚本绘制。
  }
});
</script>

<template>
  <aside class="sponsor" :data-placement="placement" aria-label="Sponsor">
    <div class="sponsor-label">
      {{ $t('tool.sponsorLabel') }}
    </div>
    <ins
      v-if="slotId"
      ref="adRef"
      class="adsbygoogle sponsor-unit"
      data-ad-client="ca-pub-7944759654100814"
      :data-ad-slot="slotId"
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
    <p v-else class="sponsor-fallback">
      {{ $t('tool.sponsorBody') }}
      <RouterLink to="/contact">
        {{ $t('tool.sponsorCta') }}
      </RouterLink>
    </p>
  </aside>
</template>

<style scoped lang="less">
.sponsor {
  box-sizing: border-box;
  width: 100%;
  max-width: 1100px;
  margin: 20px auto 0;
  padding: 10px 14px;
  border: 1px dashed var(--dd-border);
  border-radius: var(--dd-radius);
  background: var(--dd-surface);
  color: var(--dd-text-soft);
  font-size: 13px;
  line-height: 1.5;
}

.sponsor-label {
  margin-bottom: 2px;
  color: var(--dd-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sponsor-fallback {
  margin: 0;

  a {
    margin-left: 6px;
    color: var(--dd-primary);
  }
}

.sponsor-unit {
  display: block;
  min-height: 90px;
}
</style>
