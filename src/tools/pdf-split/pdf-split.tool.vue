<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { pageCount, splitPdf } from '../pdf-merge/pdf-lib.service';

const { t } = useI18n();
const file = ref<File | null>(null);
const total = ref<number | null>(null);
const mode = ref<'each' | 'range'>('each');
const from = ref(1);
const to = ref(1);
const busy = ref(false);
const error = ref<string | null>(null);
const results = ref<{ name: string; url: string }[]>([]);

async function onFileChange(f: File | null) {
  error.value = null;
  results.value = [];
  file.value = f;
  total.value = null;
  if (f) {
    try {
      total.value = await pageCount(await f.arrayBuffer());
      to.value = total.value;
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }
}

async function split() {
  if (!file.value) {
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    const parts = await splitPdf(
      await file.value.arrayBuffer(),
      mode.value,
      mode.value === 'range' ? { from: from.value, to: to.value } : undefined,
    );
    results.value = parts.map(p => ({
      name: p.name,
      url: URL.createObjectURL(new Blob([p.bytes as BlobPart], { type: 'application/pdf' })),
    }));
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
  finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <c-card>
      <c-file-upload
        accept="application/pdf"
        :title="t('tools.pdf-split.pickFile')"
        @file-upload="onFileChange"
      />

      <p v-if="total !== null" class="page-info">
        {{ t('tools.pdf-split.pageCount', { count: total }) }}
      </p>

      <n-form-item :label="t('tools.pdf-split.mode.label')" label-placement="left">
        <n-radio-group v-model:value="mode">
          <n-radio value="each">
            {{ t('tools.pdf-split.mode.each') }}
          </n-radio>
          <n-radio value="range">
            {{ t('tools.pdf-split.mode.range') }}
          </n-radio>
        </n-radio-group>
      </n-form-item>

      <n-form v-if="mode === 'range' && total" inline>
        <n-form-item :label="t('tools.pdf-split.from')">
          <n-input-number v-model:value="from" :min="1" :max="total" />
        </n-form-item>
        <n-form-item :label="t('tools.pdf-split.to')">
          <n-input-number v-model:value="to" :min="from" :max="total" />
        </n-form-item>
      </n-form>

      <div mt-4 flex justify-center>
        <c-button :disabled="busy || !file" @click="split">
          {{ busy ? t('tools.pdf-split.working') : t('tools.pdf-split.button.split') }}
        </c-button>
      </div>

      <n-alert v-if="error" type="error" mt-4>
        {{ error }}
      </n-alert>

      <div v-if="results.length" mt-4 class="result-list">
        <a v-for="r in results" :key="r.name" :href="r.url" :download="r.name" class="result-link">
          ⬇ {{ r.name }}
        </a>
      </div>
    </c-card>
  </div>
</template>

<style scoped>
.page-info { margin-top: 8px; color: var(--dd-text-soft, #475569); }
.result-list { display: flex; flex-direction: column; gap: 6px; align-items: center; }
.result-link { color: var(--dd-primary, #0f766e); text-decoration: none; }
.result-link:hover { text-decoration: underline; }
</style>
