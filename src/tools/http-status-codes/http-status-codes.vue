<script setup lang="ts">
import { codesByCategories, registryStatusByCode } from './http-status-codes.constants';
import { statusCodeZh } from './http-status-codes.translations';
import { useFuzzySearch } from '@/composable/fuzzySearch';

const { t, locale } = useI18n();
const search = ref('');

const statusCategoryKeys: Record<string, string> = {
  '1xx informational response': 'informational',
  '2xx success': 'success',
  '3xx redirection': 'redirection',
  '4xx client error': 'clientError',
  '5xx server error': 'serverError',
};

const searchableCodes = computed(() => codesByCategories.flatMap(({ codes, category }) =>
  codes.map(code => ({
    ...code,
    nameZh: statusCodeZh[code.code]?.name ?? '',
    descriptionZh: statusCodeZh[code.code]?.description ?? '',
    category,
  })),
));

const { searchResult } = useFuzzySearch({
  search,
  data: searchableCodes,
  options: {
    keys: [
      { name: 'code', weight: 3 },
      { name: 'name', weight: 2 },
      { name: 'nameZh', weight: 2 },
      'description',
      'descriptionZh',
      'category',
    ],
  },
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
  return locale.value === 'zh' ? (statusCodeZh[code]?.name ?? name) : name;
}

function displayDescription(code: number, description: string) {
  return locale.value === 'zh' ? (statusCodeZh[code]?.description ?? description) : description;
}

function registryLabel(code: number) {
  const status = registryStatusByCode[code];
  return status ? t(`tools.http-status-codes.labels.${status}`) : '';
}
</script>

<template>
  <div>
    <c-card mb-6>
      <p mb-3 text-sm op-80 data-testid="status-response-boundary">
        {{ t('tools.http-status-codes.responseBoundary') }}
      </p>

      <details data-testid="status-class-guide">
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

      <p mt-3 text-xs op-70 data-testid="status-registry-note">
        {{ t('tools.http-status-codes.registryNote') }}
      </p>
    </c-card>

    <c-input-text
      v-model:value="search"
      :placeholder="t('tools.http-status-codes.searchPlaceholder')"
      autofocus raw-text mb-10
    />

    <div v-for="{ codes, category } of codesByCategoryFiltered" :key="category" mb-8>
      <div mb-2 text-xl font-semibold>
        {{ category }}
      </div>

      <div
        v-for="{ code, description, name, type } of codes"
        :key="code"
        :data-testid="`status-code-${code}`"
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
