<script setup lang="ts">
import {
  convertDecimalListToText,
  convertTextToDecimalList,
  convertTextToUnicode,
  convertUnicodeToText,
} from './text-to-unicode.service';
import { useCopy } from '@/composable/copy';

const inputText = ref('');
const unicodeFromText = computed(() => inputText.value.trim() === '' ? '' : convertTextToUnicode(inputText.value));
const { copy: copyUnicode } = useCopy({ source: unicodeFromText });

const inputUnicode = ref('');
const textFromUnicode = computed(() => inputUnicode.value.trim() === '' ? '' : convertUnicodeToText(inputUnicode.value));
const { copy: copyText } = useCopy({ source: textFromUnicode });

// 十进制码点：legacy /legacy/ascii/ 承诺的「Ascii码对照值」形态（裸数字，分隔符可选）
const separator = ref(', ');
const inputForCodes = ref('');
const decimalCodes = computed(() =>
  inputForCodes.value === '' ? '' : convertTextToDecimalList(inputForCodes.value, separator.value));
const { copy: copyCodes } = useCopy({ source: decimalCodes });

const inputCodes = ref('');
const textFromCodes = computed(() =>
  inputCodes.value.trim() === '' ? '' : convertDecimalListToText(inputCodes.value));
const { copy: copyTextFromCodes } = useCopy({ source: textFromCodes });
</script>

<template>
  <c-card title="Text to Unicode">
    <c-input-text v-model:value="inputText" multiline placeholder="e.g. 'Hello Avengers'" label="Enter text to convert to unicode" autosize autofocus raw-text test-id="text-to-unicode-input" />
    <c-input-text v-model:value="unicodeFromText" label="Unicode from your text" multiline raw-text readonly mt-2 placeholder="The unicode representation of your text will be here" test-id="text-to-unicode-output" />
    <div mt-2 flex justify-center>
      <c-button :disabled="!unicodeFromText" @click="copyUnicode()">
        Copy unicode to clipboard
      </c-button>
    </div>
  </c-card>

  <c-card title="Unicode to Text">
    <c-input-text v-model:value="inputUnicode" multiline placeholder="Input Unicode" label="Enter unicode to convert to text" autosize raw-text test-id="unicode-to-text-input" />
    <c-input-text v-model:value="textFromUnicode" label="Text from your Unicode" multiline raw-text readonly mt-2 placeholder="The text representation of your unicode will be here" test-id="unicode-to-text-output" />
    <div mt-2 flex justify-center>
      <c-button :disabled="!textFromUnicode" @click="copyText()">
        Copy text to clipboard
      </c-button>
    </div>
  </c-card>

  <c-card title="Text to decimal code points">
    <c-input-text v-model:value="inputForCodes" multiline placeholder="e.g. 中文😀A" label="Enter text to get its decimal code points" autosize raw-text test-id="text-to-codes-input" />
    <c-input-text
      v-model:value="separator"
      mt-2
      w-160px
      label="Separator"
      placeholder=", "
      hint="Any non-digit runs are accepted on the way back"
    />
    <c-input-text v-model:value="decimalCodes" label="Decimal code points" multiline raw-text readonly mt-2 placeholder="20013, 25991, 128512, 65" test-id="text-to-codes-output" />
    <div mt-2 flex justify-center>
      <c-button :disabled="!decimalCodes" @click="copyCodes()">
        Copy code points to clipboard
      </c-button>
    </div>
  </c-card>

  <c-card title="Decimal code points to Text">
    <c-input-text v-model:value="inputCodes" multiline placeholder="e.g. 20013, 25991 (comma, space or newline all work)" label="Enter decimal code points" autosize raw-text test-id="codes-to-text-input" />
    <c-input-text v-model:value="textFromCodes" label="Text from your code points" multiline raw-text readonly mt-2 placeholder="The decoded text will be here" test-id="codes-to-text-output" />
    <div mt-2 flex justify-center>
      <c-button :disabled="!textFromCodes" @click="copyTextFromCodes()">
        Copy text to clipboard
      </c-button>
    </div>
  </c-card>
</template>
