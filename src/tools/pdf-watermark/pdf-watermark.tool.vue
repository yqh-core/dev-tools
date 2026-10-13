<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { watermarkPdf } from '../pdf-merge/pdf-lib.service';

const { t } = useI18n();
const file = ref<File | null>(null);
const text = ref('CONFIDENTIAL');
const fontSize = ref(48);
const opacity = ref(0.18);
const angle = ref(45);
const tile = ref(false);
const busy = ref(false);
const error = ref<string | null>(null);
const resultUrl = ref<string | null>(null);

async function onFileChange(f: File | null) {
  error.value = null;
  resultUrl.value = null;
  file.value = f;
}

async function apply() {
  if (!file.value || !text.value.trim()) {
    error.value = t('tools.pdf-watermark.errors.needText');
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    const out = await watermarkPdf(await file.value.arrayBuffer(), {
      text: text.value.trim(),
      fontSize: fontSize.value,
      opacity: opacity.value,
      angle: angle.value,
      tile: tile.value,
    });
    resultUrl.value = URL.createObjectURL(new Blob([out as BlobPart], { type: 'application/pdf' }));
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
        :title="t('tools.pdf-watermark.pickFile')"
        @file-upload="onFileChange"
      />

      <n-form label-placement="left" label-width="140" mt-3>
        <n-form-item :label="t('tools.pdf-watermark.text')">
          <n-input v-model:value="text" :placeholder="t('tools.pdf-watermark.textPlaceholder')" />
        </n-form-item>
        <n-form-item :label="t('tools.pdf-watermark.fontSize')">
          <n-slider v-model:value="fontSize" :min="12" :max="120" :step="2" />
        </n-form-item>
        <n-form-item :label="t('tools.pdf-watermark.opacity')">
          <n-slider v-model:value="opacity" :min="0.05" :max="0.8" :step="0.01" />
        </n-form-item>
        <n-form-item :label="t('tools.pdf-watermark.angle')">
          <n-slider v-model:value="angle" :min="0" :max="90" :step="5" />
        </n-form-item>
        <n-form-item :label="t('tools.pdf-watermark.tile')">
          <n-switch v-model:value="tile" />
        </n-form-item>
      </n-form>

      <div mt-3 flex justify-center>
        <c-button :disabled="busy || !file" @click="apply">
          {{ busy ? t('tools.pdf-watermark.working') : t('tools.pdf-watermark.button.apply') }}
        </c-button>
      </div>

      <n-alert v-if="error" type="error" mt-4>
        {{ error }}
      </n-alert>

      <div v-if="resultUrl" mt-4 flex justify-center>
        <a :href="resultUrl" download="watermarked.pdf">
          <c-button>{{ t('tools.pdf-watermark.button.download') }}</c-button>
        </a>
      </div>
    </c-card>
  </div>
</template>
