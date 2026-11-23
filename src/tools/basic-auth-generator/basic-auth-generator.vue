<script setup lang="ts">
import { useCopy } from '@/composable/copy';
import { textToBase64 } from '@/utils/base64';

const username = ref('');
const password = ref('');
const header = computed(() => `Authorization: Basic ${textToBase64(`${username.value}:${password.value}`)}`);

const { copy } = useCopy({ source: header, text: 'Header copied to the clipboard' });
</script>

<template>
  <div>
    <c-input-text v-model:value="username" label="Username" placeholder="Your username..." clearable raw-text mb-5 />
    <c-input-text
      v-model:value="password"
      label="Password"
      placeholder="Your password..."
      clearable
      raw-text
      mb-2
      type="password"
    />

    <c-card>
      <n-statistic label="Authorization header:" class="header">
        <n-scrollbar x-scrollable style="max-width: 550px; margin-bottom: -10px; padding-bottom: 10px" trigger="none">
          <span data-test-id="basic-auth-generated-header">{{ header }}</span>
        </n-scrollbar>
      </n-statistic>
    </c-card>
    <div mt-5 flex justify-center>
      <c-button @click="copy()">
        Copy header
      </c-button>
    </div>

    <section class="mx-auto mt-8 max-w-800px px-4" data-test-id="basic-auth-guide">
      <h2 class="mb-3 text-xl font-semibold">How HTTP Basic Authentication works</h2>
      <p class="mb-3">
        HTTP Basic Authentication combines a username and password as username:password, encodes that
        text with Base64, and sends it in the Authorization request header after the word Basic.
      </p>

      <h3 class="mb-2 text-lg font-semibold">Example</h3>
      <p class="mb-2">For the sample credentials demo and example, the encoded value is:</p>
      <pre class="mb-3 overflow-x-auto rounded bg-gray-500:5 p-3"><code>Authorization: Basic ZGVtbzpleGFtcGxl</code></pre>
      <p class="mb-3">
        The same request can be made with curl using <code>curl --user demo:example https://example.com/</code>.
        Use placeholder credentials in examples, not a real password.
      </p>

      <h3 class="mb-2 text-lg font-semibold">Security and format notes</h3>
      <ul class="list-disc pl-6">
        <li>Base64 is encoding, not encryption. It does not protect a password from someone who can read the request.</li>
        <li>Use HTTPS for every Basic Authentication request so credentials are protected in transit.</li>
        <li>Under the HTTP Basic scheme, a username cannot contain a colon because the first colon separates it from the password.</li>
        <li>This page creates the header in your browser. Do not share the generated header or paste real credentials into an untrusted page.</li>
      </ul>
    </section>
  </div>
</template>

<style lang="less" scoped>
::v-deep(.n-statistic-value__content) {
  font-family: monospace;
  font-size: 17px !important;
  white-space: nowrap;
}
</style>
