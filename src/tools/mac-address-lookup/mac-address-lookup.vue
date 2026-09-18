<script setup lang="ts">
import { macAddressValidationRules } from '@/utils/macAddress';
import { useCopy } from '@/composable/copy';

const getVendorValue = (address: string) => address.trim().replace(/[.:-]/g, '').toUpperCase().substring(0, 6);

const macAddress = ref('20:37:06:12:34:56');

// oui-data 整包约 1MB，改为按需动态加载：仅在工具挂载后才拉取，
// 并拆成独立 chunk，避免拖慢首屏与其它工具。
const db = shallowRef<Record<string, string> | null>(null);

const details = computed<string | undefined>(() => {
  if (!db.value) {
    return undefined;
  }
  return db.value[getVendorValue(macAddress.value)];
});

async function loadVendorDb() {
  if (db.value) {
    return;
  }
  const mod = await import('oui-data');
  db.value = mod.default as Record<string, string>;
}

onMounted(loadVendorDb);

const { copy } = useCopy({ source: () => details.value ?? '', text: 'Vendor info copied to the clipboard' });
</script>

<template>
  <div>
    <c-input-text
      v-model:value="macAddress"
      label="MAC address:"
      size="large"
      placeholder="Type a MAC address"
      clearable
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      :validation-rules="macAddressValidationRules"
      mb-5
    />

    <div mb-5px>
      Vendor info:
    </div>
    <c-card mb-5>
      <div v-if="details">
        <div v-for="(detail, index) of details.split('\n')" :key="index">
          {{ detail }}
        </div>
      </div>

      <div v-else italic op-60>
        Unknown vendor for this address
      </div>
    </c-card>

    <div flex justify-center>
      <c-button :disabled="!details" @click="copy()">
        Copy vendor info
      </c-button>
    </div>
  </div>
</template>
