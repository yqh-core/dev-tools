<script setup lang="ts">
/**
 * HTTP 状态检测：通过本站 Pages Function 从 Cloudflare 边缘发起无 Cookie 请求。
 *
 * 上游 404/500 仍然是一次成功收到的 HTTP 响应；只有目标校验、DNS、超时、
 * 重定向或传输层问题才属于检测失败。接口只返回最终响应，不返回逐跳时间线。
 */
import { useI18n } from 'vue-i18n';
import { useCopy } from '@/composable/copy';
import { useToolFetch } from '@/composable/toolFetch';

interface WebStatus {
  url: string
  status: number | null
  headers: Record<string, string>
}

const { t } = useI18n();
const url = useStorage('http-status-checker:url', '');

const { data, error, isLoading, execute, clear } = useToolFetch<WebStatus>({
  resolveUrl: (input) => {
    const value = input.trim();
    if (!value) {
      return { error: t('tools.http-status-checker.enterUrl') };
    }
    // 未写协议时按 HTTPS 处理；服务端仍会校验协议、主机和每一跳目标。
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return { url: `/api/webstatus?url=${encodeURIComponent(withScheme)}` };
  },
  interpret: (payload) => {
    const status = (payload.status as number | null) ?? null;
    const headers = (payload.headers as Record<string, string>) ?? {};
    const finalUrl = typeof payload.url === 'string' ? payload.url : '';
    const result = { url: finalUrl, status, headers };
    return status === null
      ? { error: (payload.error as string) ?? t('tools.http-status-checker.noStatus'), data: result }
      : { data: result };
  },
  errorPrefix: t('tools.http-status-checker.checkFailed'),
});

const status = computed(() => data.value?.status ?? null);
const finalUrl = computed(() => data.value?.url ?? '');
const { copy: copyFinalUrl, isJustCopied: isFinalUrlCopied } = useCopy({
  source: finalUrl,
  text: t('tools.http-status-checker.copiedUrl'),
});
const headers = computed(() => data.value?.headers ?? {});
const hasResponse = computed(() => status.value !== null);

const statusTone = computed(() => {
  if (status.value === null) {
    return 'text-current';
  }
  if (status.value < 300) {
    return 'text-green';
  }
  if (status.value < 400) {
    return 'text-orange';
  }
  return 'text-red';
});

const headerEntries = computed(() => Object.entries(headers.value));
const headersText = computed(() => JSON.stringify(headers.value, null, 2));
</script>

<template>
  <div flex flex-col gap-3 data-test-id="http-status-checker">
    <c-input-text
      v-model:value="url"
      :label="`${t('tools.http-status-checker.urlLabel')}: `"
      :placeholder="t('tools.http-status-checker.urlPlaceholder')"
      label-position="left"
      label-width="80px"
      label-align="right"
      raw-text
      clearable
      data-test-id="status-url"
      @keydown.enter="execute(url)"
    />

    <p text-13px op-65>
      {{ t('tools.http-status-checker.httpsDefaultHint') }}
    </p>

    <div flex flex-wrap items-center gap-2>
      <c-button
        type="primary"
        data-test-id="check-url"
        :disabled="isLoading || !url.trim()"
        @click="execute(url)"
      >
        {{ isLoading ? t('tools.http-status-checker.checking') : t('tools.http-status-checker.checkAction') }}
      </c-button>
      <c-button v-if="data || error" size="small" @click="clear">
        {{ t('tools.http-status-checker.clear') }}
      </c-button>
    </div>

    <div flex flex-col gap-1 text-13px op-65>
      <p>{{ t('tools.http-status-checker.requestContext') }}</p>
      <p>{{ t('tools.http-status-checker.requestLimits') }}</p>
    </div>

    <c-alert v-if="error" data-test-id="lookup-error">
      {{ error }}
    </c-alert>

    <c-card v-if="hasResponse" data-test-id="lookup-success">
      <div mb-2 text-sm font-semibold text-green>
        {{ t('tools.http-status-checker.lookupReceived') }}
      </div>
      <div flex flex-wrap items-baseline gap-3>
        <span text-13px op-70>
          {{ t('tools.http-status-checker.upstreamStatus') }}
        </span>
        <span text-32px font-bold :class="statusTone" data-test-id="upstream-status">
          {{ status }}
        </span>
        <span text-13px op-60>
          {{ t('tools.http-status-checker.statusIsNotLookupError') }}
        </span>
      </div>
      <div v-if="finalUrl" mt-3 border-t border-base pt-3>
        <div mb-1 text-13px op-70>
          {{ t('tools.http-status-checker.finalUrl') }}
        </div>
        <div flex flex-wrap items-start gap-2>
          <span class="min-w-0 flex-1 break-all" data-test-id="final-url">{{ finalUrl }}</span>
          <c-button
            size="small"
            type="tertiary"
            data-test-id="copy-final-url"
            @click="copyFinalUrl()"
          >
            {{ isFinalUrlCopied ? t('tools.http-status-checker.copiedUrl') : t('tools.http-status-checker.copyUrl') }}
          </c-button>
        </div>
      </div>
    </c-card>

    <div v-if="headerEntries.length" data-test-id="response-headers">
      <div mb-1 flex items-center justify-between>
        <span text-13px op-70>
          {{ t('tools.http-status-checker.responseHeaders', { count: headerEntries.length }) }}
        </span>
        <SpanCopyable v-if="headersText" :value="headersText" />
      </div>
      <c-card v-for="[key, value] of headerEntries" :key="key" mb-2>
        <div text-13px op-70>
          {{ key }}
        </div>
        <div break-all>
          {{ value }}
        </div>
      </c-card>
    </div>
  </div>
</template>
