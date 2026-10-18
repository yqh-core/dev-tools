<script setup lang="ts">
import { Copy, Download } from '@vicons/tabler';
import { useElementSize } from '@vueuse/core';
import hljs from 'highlight.js/lib/core';
import jsonHljs from 'highlight.js/lib/languages/json';
import sqlHljs from 'highlight.js/lib/languages/sql';
import xmlHljs from 'highlight.js/lib/languages/xml';
import yamlHljs from 'highlight.js/lib/languages/yaml';
import iniHljs from 'highlight.js/lib/languages/ini';
import markdownHljs from 'highlight.js/lib/languages/markdown';
import { useCopy } from '@/composable/copy';
import { buildDownloadFilename, downloadTextFile, mimeForLanguage } from '@/composable/downloadText';

const props = withDefaults(
  defineProps<{
    value: string
    followHeightOf?: HTMLElement | null
    language?: string
    copyPlacement?: 'top-right' | 'bottom-right' | 'outside' | 'none'
    copyMessage?: string
    /** 是否在复制按钮旁边再给一个「下载」按钮。默认关，避免动到已有 25 个调用方的版面。 */
    downloadable?: boolean
    /** 下载文件名（不含扩展名时按 language 自动补） */
    downloadFilename?: string
    /** 覆盖下载 MIME；不给则按 language 推导 */
    downloadMimeType?: string
    /** 下载按钮的稳定 test-id，供冒烟/e2e 定位 */
    downloadTestId?: string
  }>(),
  {
    followHeightOf: null,
    language: 'txt',
    copyPlacement: 'top-right',
    copyMessage: 'Copy to clipboard',
    downloadable: false,
    downloadFilename: 'download',
    downloadMimeType: undefined,
    downloadTestId: 'download-button',
  },
);
hljs.registerLanguage('sql', sqlHljs);
hljs.registerLanguage('json', jsonHljs);
hljs.registerLanguage('html', xmlHljs);
hljs.registerLanguage('xml', xmlHljs);
hljs.registerLanguage('yaml', yamlHljs);
hljs.registerLanguage('toml', iniHljs);
hljs.registerLanguage('markdown', markdownHljs);

const { value, language, followHeightOf, copyPlacement, copyMessage, downloadable, downloadFilename, downloadMimeType, downloadTestId } = toRefs(props);
const { height } = followHeightOf.value ? useElementSize(followHeightOf) : { height: ref(null) };

const { copy, isJustCopied } = useCopy({ source: value, createToast: false });
const tooltipText = computed(() => isJustCopied.value ? 'Copied!' : copyMessage.value);

const isJustDownloaded = ref(false);
const downloadTooltip = computed(() => isJustDownloaded.value ? 'Saved!' : 'Download file');
function handleDownload() {
  const mime = downloadMimeType.value ?? mimeForLanguage(language.value);
  const ok = downloadTextFile({
    content: value.value,
    filename: buildDownloadFilename(downloadFilename.value, language.value && language.value !== 'txt' ? language.value : 'txt'),
    mimeType: mime,
  });
  if (ok) {
    isJustDownloaded.value = true;
    setTimeout(() => isJustDownloaded.value = false, 1500);
  }
}
</script>

<template>
  <div style="overflow-x: hidden; width: 100%">
    <c-card relative>
      <n-scrollbar
        x-scrollable
        trigger="none"
        :style="height ? `min-height: ${height - 40 /* card padding */ + 10 /* negative margin compensation */}px` : ''"
      >
        <n-config-provider :hljs="hljs">
          <n-code :code="value" :language="language" :trim="false" data-test-id="area-content" />
        </n-config-provider>
      </n-scrollbar>
      <div absolute right-10px top-10px flex gap-2>
        <c-tooltip v-if="downloadable && value" :tooltip="downloadTooltip" position="left">
          <c-button circle important:h-10 important:w-10 :data-test-id="downloadTestId" @click="handleDownload">
            <n-icon size="22" :component="Download" />
          </c-button>
        </c-tooltip>
        <c-tooltip v-if="value" :tooltip="tooltipText" position="left">
          <c-button circle important:h-10 important:w-10 @click="copy()">
            <n-icon size="22" :component="Copy" />
          </c-button>
        </c-tooltip>
      </div>
    </c-card>
    <div v-if="copyPlacement === 'outside'" mt-4 flex justify-center>
      <c-button @click="copy()">
        {{ tooltipText }}
      </c-button>
    </div>
  </div>
</template>

<style lang="less" scoped>
::v-deep(.n-scrollbar) {
  padding-bottom: 10px;
  margin-bottom: -10px;
}
</style>
