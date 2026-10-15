<script setup lang="ts">
import type { lib } from 'crypto-js';
import { MD5, RIPEMD160, SHA1, SHA224, SHA256, SHA3, SHA384, SHA512, enc } from 'crypto-js';

import InputCopyable from '../../components/InputCopyable.vue';
import { applyDigestCase, convertHexToBin, md5HexTo16 } from './hash-text.service';
import type { DigestCase } from './hash-text.service';
import { useQueryParam } from '@/composable/queryParams';

const algos = {
  MD5,
  SHA1,
  SHA256,
  SHA224,
  SHA512,
  SHA384,
  SHA3,
  RIPEMD160,
} as const;

type AlgoNames = keyof typeof algos;
type Encoding = keyof typeof enc | 'Bin';
const algoNames = Object.keys(algos) as AlgoNames[];
const encoding = useQueryParam<Encoding>({ defaultValue: 'Hex', name: 'encoding' });
const clearText = ref('');

function formatWithEncoding(words: lib.WordArray, encoding: Encoding) {
  if (encoding === 'Bin') {
    return convertHexToBin(words.toString(enc.Hex));
  }

  return words.toString(enc[encoding]);
}

const hashText = (algo: AlgoNames, value: string) => formatWithEncoding(algos[algo](value), encoding.value);

/**
 * 大小写与 16 位 MD5 只对十六进制摘要成立：Base64 改大小写会变值、Bin 没有大小写。
 * 所以这两个控件在非 Hex 编码下既不显示也不生效（用 computed 收口，避免模板里散落判断）。
 */
const digestCase = useQueryParam<DigestCase>({ defaultValue: 'lower', name: 'case' });
const isHex = computed(() => encoding.value === 'Hex');
const digest = (algo: AlgoNames) => applyDigestCase(hashText(algo, clearText.value), digestCase.value, isHex.value);
const md5Hex16 = computed(() => md5HexTo16(hashText('MD5', clearText.value)));
</script>

<template>
  <div>
    <c-card>
      <c-input-text v-model:value="clearText" placeholder="Your string to hash..." rows="3" raw-text autosize autofocus multiline label="Your text to hash:" />

      <n-divider />

      <c-select
        v-model:value="encoding"
        mb-4
        label="Digest encoding"
        :options="[
          {
            label: 'Binary (base 2)',
            value: 'Bin',
          },
          {
            label: 'Hexadecimal (base 16)',
            value: 'Hex',
          },
          {
            label: 'Base64 (base 64)',
            value: 'Base64',
          },
          {
            label: 'Base64url (base 64 with url safe chars)',
            value: 'Base64url',
          },
        ]"
      />

      <c-select
        v-if="isHex"
        v-model:value="digestCase"
        mb-4
        label="Digest letter case"
        :options="[
          {
            label: 'Lowercase (a-f)',
            value: 'lower',
          },
          {
            label: 'Uppercase (A-F)',
            value: 'upper',
          },
        ]"
      />

      <div v-for="algo in algoNames" :key="algo" style="margin: 5px 0">
        <n-input-group>
          <n-input-group-label style="flex: 0 0 120px">
            {{ algo }}
          </n-input-group-label>
          <InputCopyable :value="digest(algo)" readonly />
        </n-input-group>
      </div>

      <!-- 16 位 MD5 是「取 32 位十六进制结果的中间 16 位」这个中文工具圈约定，
           不是另一种哈希算法；换编码就没有这个概念，所以只在 Hex 下出现。 -->
      <div v-if="isHex" style="margin: 5px 0">
        <n-input-group>
          <n-input-group-label style="flex: 0 0 120px">
            MD5 (16)
          </n-input-group-label>
          <InputCopyable :value="applyDigestCase(md5Hex16, digestCase, isHex)" readonly test-id="hash-text-md5-16" />
        </n-input-group>
      </div>
    </c-card>
  </div>
</template>
