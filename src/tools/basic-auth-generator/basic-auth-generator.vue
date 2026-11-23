<script setup lang="ts">
import { useCopy } from '@/composable/copy';
import { decodeBasicAuthHeader } from './basic-auth-generator.service';
import { textToBase64 } from '@/utils/base64';

const username = ref('');
const password = ref('');
const header = computed(() => `Authorization: Basic ${textToBase64(`${username.value}:${password.value}`)}`);
const curlExample = 'curl --user "$BASIC_AUTH_USERNAME:$BASIC_AUTH_PASSWORD" https://example.com/';

const decodeInput = ref('');
const decodedCredentials = computed(() => {
  if (!decodeInput.value.trim()) {
    return null;
  }

  try {
    return { credentials: decodeBasicAuthHeader(decodeInput.value), error: '' };
  }
  catch (error: any) {
    return { credentials: null, error: error.message };
  }
});

const { copy: copyHeader } = useCopy({ source: header, text: 'Header copied to the clipboard' });
const { copy: copyCurl } = useCopy({ source: curlExample, text: 'cURL example copied to the clipboard' });
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
      <c-button @click="copyHeader()">
        Copy header
      </c-button>
    </div>

    <section class="mx-auto mt-8 max-w-800px px-4" data-test-id="basic-auth-decode">
      <h2 class="mb-3 text-xl font-semibold">Decode an existing Basic Auth header</h2>
      <p class="mb-3">
        Paste a complete Authorization header or its Base64 token to inspect the username and password.
        Decoding happens in this browser tab; do not paste credentials on a shared or untrusted device.
      </p>
      <c-input-text
        v-model:value="decodeInput"
        label="Authorization header or Base64 token"
        placeholder="Paste Authorization: Basic ..."
        raw-text
        clearable
      />
      <div v-if="decodedCredentials?.credentials" mt-3 rounded bg-gray-500:5 p-3>
        <p><strong>Username:</strong> <code data-test-id="basic-auth-decoded-username">{{ decodedCredentials.credentials.username }}</code></p>
        <p mt-2><strong>Password:</strong> <code data-test-id="basic-auth-decoded-password">{{ decodedCredentials.credentials.password }}</code></p>
      </div>
      <p v-else-if="decodedCredentials?.error" mt-3 role="alert" text-error data-test-id="basic-auth-decode-error">
        {{ decodedCredentials.error }}
      </p>
    </section>

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
        The same request can be made with curl. Set the environment variables in your shell or secret manager first:
      </p>
      <pre class="mb-2 overflow-x-auto rounded bg-gray-500:5 p-3"><code data-test-id="basic-auth-curl-example">{{ curlExample }}</code></pre>
      <div mb-3 flex justify-start>
        <c-button size="small" @click="copyCurl()">
          Copy cURL example
        </c-button>
      </div>

      <h3 class="mb-2 text-lg font-semibold">Security and format notes</h3>
      <ul class="list-disc pl-6">
        <li>Base64 is encoding, not encryption. It does not protect a password from someone who can read the request.</li>
        <li>Use HTTPS for every Basic Authentication request so credentials are protected in transit.</li>
        <li>Under the HTTP Basic scheme, a username cannot contain a colon because the first colon separates it from the password.</li>
        <li>This page generates and decodes credentials in your browser. Do not share the generated header or paste real credentials into an untrusted page.</li>
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
