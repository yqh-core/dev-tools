<script setup lang="ts">
import { codesByCategories, registryStatusByCode } from './http-status-codes.constants';

const { t, tm, rt, locale } = useI18n();
const search = ref('');

type I18nMessageValue = Parameters<typeof rt>[0];
type StatusCodeTranslation = {
  name?: I18nMessageValue;
  description?: I18nMessageValue;
};

const statusCodeZh = computed(() => {
  if (locale.value !== 'zh') {
    return {};
  }

  // tm() returns compiled message functions for nested YAML resources.
  // Resolve each message with rt() before rendering or indexing it for search.
  const messages = tm('tools.http-status-codes.statusCodes') as unknown as Record<string, StatusCodeTranslation>;

  return Object.fromEntries(
    Object.entries(messages).map(([code, message]) => [
      Number(code),
      {
        name: message.name == null ? '' : rt(message.name),
        description: message.description == null ? '' : rt(message.description),
      },
    ]),
  ) as Record<number, { name: string; description: string }>;
});

const statusCategoryKeys: Record<string, string> = {
  '1xx informational response': 'informational',
  '2xx success': 'success',
  '3xx redirection': 'redirection',
  '4xx client error': 'clientError',
  '5xx server error': 'serverError',
};

function searchableText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(searchableText).filter(Boolean).join(' ');
  }

  if (value && typeof value === 'object') {
    return Object.values(value).map(searchableText).filter(Boolean).join(' ');
  }

  return '';
}

const searchableCodes = computed(() => codesByCategories.flatMap(({ codes, category }) =>
  codes.map(code => ({
    ...code,
    nameZh: statusCodeZh.value[code.code]?.name ?? '',
    descriptionZh: statusCodeZh.value[code.code]?.description ?? '',
    category,
  })),
));

const searchResult = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();

  if (!query) {
    return searchableCodes.value;
  }

  if (/^\d{3}$/.test(query)) {
    return searchableCodes.value.filter(({ code }) => String(code) === query);
  }

  return searchableCodes.value.filter(code => [
    String(code.code),
    code.name,
    code.nameZh,
    code.description,
    code.descriptionZh,
    code.category,
  ].some(value => searchableText(value).toLocaleLowerCase().includes(query)));
});

const categoryGroups = computed(() => codesByCategories.map(({ category, codes }) => ({
  category: t(`tools.http-status-codes.categories.${statusCategoryKeys[category]}`),
  codes,
})));

const codesByCategoryFiltered = computed(() => {
  if (!search.value.trim()) {
    return categoryGroups.value;
  }

  return [{
    category: t('tools.http-status-codes.categories.search'),
    codes: searchResult.value,
  }];
});

function displayName(code: number, name: string) {
  return locale.value === 'zh' ? (statusCodeZh.value[code]?.name ?? name) : name;
}

function displayDescription(code: number, description: string) {
  return locale.value === 'zh' ? (statusCodeZh.value[code]?.description ?? description) : description;
}

function registryLabel(code: number) {
  const status = registryStatusByCode[code];
  return status ? t(`tools.http-status-codes.labels.${status}`) : '';
}
</script>

<template>
  <div>
    <c-card mb-6>
      <p mb-3 text-sm op-80 data-test-id="status-response-boundary">
        {{ t('tools.http-status-codes.responseBoundary') }}
      </p>

      <details data-test-id="status-class-guide">
        <summary cursor-pointer font-semibold>
          {{ t('tools.http-status-codes.guideToggle') }}
        </summary>

        <div mt-4 grid grid-cols-1 gap-3 md:grid-cols-2>
          <div rounded-md border p-3>
            <div mb-1 font-semibold>1xx</div>
            <p text-sm op-80>{{ t('tools.http-status-codes.classGuide.informational') }}</p>
          </div>
          <div rounded-md border p-3>
            <div mb-1 font-semibold>2xx</div>
            <p text-sm op-80>{{ t('tools.http-status-codes.classGuide.success') }}</p>
          </div>
          <div rounded-md border p-3>
            <div mb-1 font-semibold>3xx</div>
            <p text-sm op-80>{{ t('tools.http-status-codes.classGuide.redirection') }}</p>
          </div>
          <div rounded-md border p-3>
            <div mb-1 font-semibold>4xx</div>
            <p text-sm op-80>{{ t('tools.http-status-codes.classGuide.clientError') }}</p>
          </div>
          <div rounded-md border p-3 md:col-span-2>
            <div mb-1 font-semibold>5xx</div>
            <p text-sm op-80>{{ t('tools.http-status-codes.classGuide.serverError') }}</p>
          </div>
        </div>
      </details>

      <p mt-3 text-xs op-70 data-test-id="status-registry-note">
        {{ t('tools.http-status-codes.registryNote') }}
      </p>
    </c-card>

    <c-input-text
      v-model:value="search"
      :placeholder="t('tools.http-status-codes.searchPlaceholder')"
      autofocus raw-text mb-10
    />

    <c-card
      v-if="search.trim() && searchResult.length === 0"
      data-test-id="status-search-empty-state"
      mb-6
    >
      {{ t('tools.http-status-codes.noResults') }}
    </c-card>

    <div v-for="{ codes, category } of codesByCategoryFiltered" :key="category" mb-8>
      <div mb-2 text-xl font-semibold>
        {{ category }}
      </div>

      <div
        v-for="{ code, description, name, type } of codes"
        :key="code"
        :data-test-id="`status-code-${code}`"
        mb-2
      >
        <c-card>
          <div flex flex-wrap items-center gap-2>
            <div text-lg font-bold>
              {{ code }} {{ displayName(code, name) }}
            </div>
            <span
              v-if="type !== 'HTTP'"
              rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200
            >
              {{ t('tools.http-status-codes.labels.webDav') }}
            </span>
            <span
              v-if="registryLabel(code)"
              rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200
            >
              {{ registryLabel(code) }}
            </span>
          </div>
          <div mt-2 op-75>
            {{ displayDescription(code, description) }}
          </div>
        </c-card>
      </div>
    </div>
  </div>
</template>
