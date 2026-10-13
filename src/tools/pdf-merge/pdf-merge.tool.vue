<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mergePdfs } from './pdf-lib.service';

const { t } = useI18n();
const files = ref<File[]>([]);
const busy = ref(false);
const resultUrl = ref<string | null>(null);
const error = ref<string | null>(null);

function onFilesChange(list: File[]) {
  error.value = null;
  resultUrl.value = null;
  files.value = list;
}

async function merge() {
  if (files.value.length < 2) {
    error.value = t('tools.pdf-merge.errors.needTwo');
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    const buffers = await Promise.all(files.value.map(f => f.arrayBuffer()));
    const merged = await mergePdfs(buffers);
    const blob = new Blob([merged as BlobPart], { type: 'application/pdf' });
    resultUrl.value = URL.createObjectURL(blob);
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
        multiple
        accept="application/pdf"
        :title="t('tools.pdf-merge.pickFiles')"
        @files-upload="onFilesChange"
      />

      <p v-if="files.length" class="file-summary">
        {{ t('tools.pdf-merge.selected', { count: files.length }) }}
      </p>

      <div mt-4 flex justify-center gap-3>
        <c-button :disabled="busy || files.length < 2" @click="merge">
          {{ busy ? t('tools.pdf-merge.working') : t('tools.pdf-merge.button.merge') }}
        </c-button>
      </div>

      <n-alert v-if="error" type="error" mt-4>
        {{ error }}
      </n-alert>

      <div v-if="resultUrl" mt-4 flex justify-center>
        <a :href="resultUrl" download="merged.pdf">
          <c-button>{{ t('tools.pdf-merge.button.download') }}</c-button>
        </a>
      </div>
    </c-card>
  </div>
</template>

<style scoped>
.file-summary { margin-top: 8px; color: var(--dd-text-soft, #475569); }
</style>
