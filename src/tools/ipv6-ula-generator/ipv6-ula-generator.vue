<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import InputCopyable from '@/components/InputCopyable.vue';
import { useCopy } from '@/composable/copy';
import { createUlaPrefix, generateRandomUlaPrefixes } from './ipv6-ula-generator.models';

type GenerationMode = 'random' | 'manual';

const { t } = useI18n();
const mode = ref<GenerationMode>('random');
const quantity = ref(1);
const manualGlobalId = ref('');
const results = ref<ReturnType<typeof createUlaPrefix>[]>([]);
const error = ref('');

const prefixesForCopy = computed(() => results.value.map(result => result.prefix).join('\n'));
const { copy } = useCopy({
  source: prefixesForCopy,
  text: t('tools.ipv6-ula-generator.copied'),
});

function generate(): void {
  error.value = '';
  results.value = [];

  try {
    if (mode.value === 'manual') {
      results.value = [createUlaPrefix(manualGlobalId.value)];
      return;
    }

    if (!Number.isInteger(quantity.value) || quantity.value < 1 || quantity.value > 20) {
      error.value = t('tools.ipv6-ula-generator.errors.invalidQuantity');
      return;
    }

    results.value = generateRandomUlaPrefixes(quantity.value);
  }
  catch {
    error.value = mode.value === 'manual'
      ? t('tools.ipv6-ula-generator.errors.invalidGlobalId')
      : t('tools.ipv6-ula-generator.errors.randomUnavailable');
  }
}

function setMode(nextMode: GenerationMode): void {
  mode.value = nextMode;
  error.value = '';
}

onMounted(generate);
</script>

<template>
  <div flex flex-col gap-4>
    <div rounded-lg border border-gray-200 p-4 dark:border-gray-700>
      <div flex flex-wrap items-center gap-2>
        <button
          type="button"
          data-test-id="ula-mode-random"
          :aria-pressed="mode === 'random'"
          class="rounded border px-3 py-2 text-sm"
          :class="mode === 'random' ? 'border-primary bg-primary/10 font-semibold' : 'border-gray-300 dark:border-gray-600'"
          @click="setMode('random')"
        >
          {{ t('tools.ipv6-ula-generator.randomMode') }}
        </button>
        <button
          type="button"
          data-test-id="ula-mode-manual"
          :aria-pressed="mode === 'manual'"
          class="rounded border px-3 py-2 text-sm"
          :class="mode === 'manual' ? 'border-primary bg-primary/10 font-semibold' : 'border-gray-300 dark:border-gray-600'"
          @click="setMode('manual')"
        >
          {{ t('tools.ipv6-ula-generator.manualMode') }}
        </button>
      </div>

      <div v-if="mode === 'random'" mt-4>
        <label for="ula-quantity" mb-1 block text-sm font-semibold>
          {{ t('tools.ipv6-ula-generator.quantity') }}
        </label>
        <n-input-number
          id="ula-quantity"
          v-model:value="quantity"
          data-test-id="ula-quantity"
          :min="1"
          :max="20"
          :precision="0"
          w-full
        />
        <p mt-2 text-sm op-70>
          {{ t('tools.ipv6-ula-generator.randomHelp') }}
        </p>
      </div>

      <div v-else mt-4>
        <label for="ula-global-id" mb-1 block text-sm font-semibold>
          {{ t('tools.ipv6-ula-generator.globalId') }}
        </label>
        <n-input
          id="ula-global-id"
          v-model:value="manualGlobalId"
          data-test-id="ula-manual-global-id"
          maxlength="12"
          spellcheck="false"
          placeholder="0123456789"
        />
        <p mt-2 text-sm op-70>
          {{ t('tools.ipv6-ula-generator.manualHelp') }}
        </p>
      </div>

      <div mt-4 flex flex-wrap gap-2>
        <c-button data-test-id="ula-generate" @click="generate">
          {{ t('tools.ipv6-ula-generator.generate') }}
        </c-button>
        <c-button v-if="results.length" secondary @click="copy">
          {{ t('tools.ipv6-ula-generator.copyAll') }}
        </c-button>
      </div>
    </div>

    <n-alert v-if="error" type="error" data-test-id="ula-error">
      {{ error }}
    </n-alert>

    <section
      v-for="(result, index) in results"
      :key="result.globalId"
      :data-test-id="`ula-result-${index + 1}`"
      rounded-lg border border-gray-200 p-4 dark:border-gray-700
    >
      <h2 mb-3 text-base font-semibold>
        {{ t('tools.ipv6-ula-generator.resultNumber', { number: index + 1 }) }}
      </h2>
      <InputCopyable
        :value="result.globalId"
        :label="t('tools.ipv6-ula-generator.globalId')"
        :label-width="190"
        label-position="left"
        label-align="left"
        readonly
        mb-2
        :data-test-id="`ula-global-id-${index + 1}`"
      />
      <InputCopyable
        :value="result.prefix"
        :label="t('tools.ipv6-ula-generator.ulaPrefix')"
        :label-width="190"
        label-position="left"
        label-align="left"
        readonly
        mb-2
        :data-test-id="`ula-prefix-${index + 1}`"
      />
      <InputCopyable
        :value="result.firstSubnet"
        :label="t('tools.ipv6-ula-generator.firstSubnet')"
        :label-width="190"
        label-position="left"
        label-align="left"
        readonly
        mb-2
        :data-test-id="`ula-first-subnet-${index + 1}`"
      />
      <InputCopyable
        :value="result.lastSubnet"
        :label="t('tools.ipv6-ula-generator.lastSubnet')"
        :label-width="190"
        label-position="left"
        label-align="left"
        readonly
        :data-test-id="`ula-last-subnet-${index + 1}`"
      />
      <p mt-3 text-sm op-70>
        {{ t('tools.ipv6-ula-generator.subnetCount', { count: result.subnetCount.toLocaleString() }) }}
      </p>
    </section>

    <n-alert type="info">
      {{ t('tools.ipv6-ula-generator.privacyNote') }}
    </n-alert>
    <n-alert type="warning" data-test-id="ula-routing-warning">
      {{ t('tools.ipv6-ula-generator.routingWarning') }}
    </n-alert>
  </div>
</template>
