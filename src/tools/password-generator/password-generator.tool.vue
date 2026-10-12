<script setup lang="ts">
import { createPassword } from './password-generator.service';
import { useCopy } from '@/composable/copy';
import { useQueryParam } from '@/composable/queryParams';
import { computedRefreshable } from '@/composable/computedRefreshable';

const length = useQueryParam({ name: 'length', defaultValue: 20 });
const withUppercase = useQueryParam({ name: 'uppercase', defaultValue: true });
const withLowercase = useQueryParam({ name: 'lowercase', defaultValue: true });
const withNumbers = useQueryParam({ name: 'numbers', defaultValue: true });
const withSymbols = useQueryParam({ name: 'symbols', defaultValue: false });
const withAmbiguous = useQueryParam({ name: 'ambiguous', defaultValue: false });
const { t } = useI18n();

const [password, refreshPassword] = computedRefreshable(() =>
  createPassword({
    length: length.value,
    withUppercase: withUppercase.value,
    withLowercase: withLowercase.value,
    withNumbers: withNumbers.value,
    withSymbols: withSymbols.value,
    withAmbiguous: withAmbiguous.value,
  }),
);

const { copy } = useCopy({ source: password, text: t('tools.password-generator.copied') });
</script>

<template>
  <div>
    <c-card>
      <n-form label-placement="left" label-width="160">
        <div flex justify-center>
          <div>
            <n-form-item :label="t('tools.password-generator.uppercase')">
              <n-switch v-model:value="withUppercase" />
            </n-form-item>

            <n-form-item :label="t('tools.password-generator.lowercase')">
              <n-switch v-model:value="withLowercase" />
            </n-form-item>
          </div>

          <div>
            <n-form-item :label="t('tools.password-generator.numbers')">
              <n-switch v-model:value="withNumbers" />
            </n-form-item>

            <n-form-item :label="t('tools.password-generator.symbols')">
              <n-switch v-model:value="withSymbols" />
            </n-form-item>
          </div>
        </div>

        <n-form-item :label="t('tools.password-generator.ambiguous')" label-placement="left">
          <n-switch v-model:value="withAmbiguous" />
        </n-form-item>
      </n-form>

      <n-form-item :label="`${t('tools.password-generator.length')} (${length})`" label-placement="left">
        <n-slider v-model:value="length" :step="1" :min="8" :max="128" />
      </n-form-item>

      <c-input-text
        v-model:value="password"
        multiline
        :placeholder="t('tools.password-generator.passwordPlaceholder')"
        readonly
        rows="2"
        autosize
        class="password-display"
      />

      <div mt-5 flex justify-center gap-3>
        <c-button @click="copy()">
          {{ t('tools.password-generator.button.copy') }}
        </c-button>
        <c-button @click="refreshPassword">
          {{ t('tools.password-generator.button.refresh') }}
        </c-button>
      </div>
    </c-card>
  </div>
</template>

<style scoped lang="less">
::v-deep(.password-display) {
  textarea {
    text-align: center;
  }
}
</style>
