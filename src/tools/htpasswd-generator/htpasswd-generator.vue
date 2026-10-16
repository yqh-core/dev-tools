<script setup lang="ts">
/**
 * .htpasswd 密码生成与校验（Apache / Nginx Basic Auth）。
 *
 * 支持 bcrypt($2b$，Apache 2.4 起推荐)、apr1($apr1$，经典 Apache MD5)、
 * SHA1({SHA})、以及明文（仅用于本地调试，勿在生产使用）。
 * apr1 的实现在同目录 apr1.ts，已用 openssl 的权威向量对拍验证。
 *
 * 注意：生成动作刻意做成「点按钮」而不是 computed —— 随机盐放进 computed 会让结果
 * 在每次无关输入时自己变化，bcrypt 在高成本下还要几百毫秒。
 */
import { compareSync, hashSync } from 'bcryptjs';
import CryptoJS from 'crypto-js';
import { apr1, apr1Verify } from './apr1';

type Fmt = 'bcrypt' | 'apr1' | 'sha1' | 'plain';

const FORMATS: { label: string; value: Fmt; hint: string }[] = [
  { label: 'bcrypt ($2b$, recommended)', value: 'bcrypt', hint: 'Recommended since Apache 2.4 — this is what htpasswd -B outputs' },
  { label: 'Apache MD5 ($apr1$)', value: 'apr1', hint: 'Classic format with the widest compatibility — what htpasswd -m outputs' },
  { label: 'SHA1 ({SHA})', value: 'sha1', hint: 'Barely stronger than plain text; flagged insecure by Apache itself' },
  { label: 'Plain text (never for production)', value: 'plain', hint: 'Supported on Windows / Netware only; for debugging' },
];

const COSTS = [4, 6, 8, 10, 12];

const user = ref('admin');
const password = ref('myPassword');
const fmt = ref<Fmt>('apr1');
const salt = ref('');
const cost = ref(10);

const generated = ref('');
const saltUsed = ref('');
const genError = ref('');

// 校验区
const line = ref('');
const passwordToCheck = ref('');
const verifyResult = ref<'match' | 'mismatch' | null>(null);
const verifyError = ref('');

const activeHint = computed(() => FORMATS.find(f => f.value === fmt.value)?.hint ?? '');

const SALT_CHARS = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function randomSalt(len = 8) {
  const array = new Uint8Array(len);
  crypto.getRandomValues(array);
  return Array.from(array, b => SALT_CHARS[b % SALT_CHARS.length]).join('');
}

async function generate() {
  genError.value = '';
  generated.value = '';
  saltUsed.value = '';

  const u = user.value.trim();
  if (!u) {
    genError.value = 'Enter a username first';
    return;
  }

  try {
    let hash = '';
    if (fmt.value === 'bcrypt') {
      hash = hashSync(password.value, cost.value);
    }
    else if (fmt.value === 'apr1') {
      saltUsed.value = salt.value.trim().slice(0, 8) || randomSalt();
      hash = apr1(password.value, saltUsed.value);
    }
    else if (fmt.value === 'sha1') {
      hash = `{SHA}${CryptoJS.SHA1(password.value).toString(CryptoJS.enc.Base64)}`;
    }
    else {
      hash = password.value;
    }
    generated.value = `${u}:${hash}`;
  }
  catch (e) {
    genError.value = `Generation failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}

const parsed = computed(() => {
  const l = line.value.trim();
  if (!l) {
    return null;
  }
  const i = l.indexOf(':');
  return i < 0 ? { user: '', hash: l } : { user: l.slice(0, i), hash: l.slice(i + 1) };
});

const detected = computed(() => {
  const h = parsed.value?.hash ?? '';
  if (h.startsWith('$2')) {
    return 'bcrypt';
  }
  if (h.startsWith('$apr1$')) {
    return 'apr1';
  }
  if (h.startsWith('{SHA}')) {
    return 'sha1';
  }
  if (h.startsWith('$1$')) {
    return '$1$ md5-crypt (this tool cannot verify it, and Apache deprecates it too)';
  }
  return 'plain text or unknown format';
});

async function verify() {
  verifyError.value = '';
  verifyResult.value = null;

  const h = parsed.value?.hash ?? '';
  if (!h) {
    verifyError.value = 'Paste one .htpasswd line first, e.g. user:$apr1$…';
    return;
  }

  try {
    let ok = false;
    if (h.startsWith('$2')) {
      ok = compareSync(passwordToCheck.value, h);
    }
    else if (h.startsWith('$apr1$')) {
      ok = apr1Verify(passwordToCheck.value, h);
    }
    else if (h.startsWith('{SHA}')) {
      ok = `{SHA}${CryptoJS.SHA1(passwordToCheck.value).toString(CryptoJS.enc.Base64)}` === h;
    }
    else {
      ok = passwordToCheck.value === h;
    }
    verifyResult.value = ok ? 'match' : 'mismatch';
  }
  catch (e) {
    verifyError.value = `Verification failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function useGenerated() {
  line.value = generated.value;
  passwordToCheck.value = password.value;
  verifyResult.value = null;
  verifyError.value = '';
}
</script>

<template>
  <div flex flex-col gap-3>
    <c-alert>
      For Nginx / Apache Basic Auth. Write the generated <code>user:hash</code> line into a .htpasswd file
      (point <code>auth_basic_user_file</code> at it). Everything runs locally — the password never leaves your browser.
    </c-alert>

    <div flex flex-col gap-3>
      <c-input-text v-model:value="user" label="Username:" placeholder="admin" label-position="left" label-width="110px" label-align="right" raw-text />
      <c-input-text v-model:value="password" label="Password:" placeholder="Password" label-position="left" label-width="110px" label-align="right" raw-text />
      <c-select v-model:value="fmt" :options="FORMATS" label="Format:" label-position="left" label-width="110px" label-align="right" />
      <c-input-text
        v-if="fmt === 'apr1'"
        v-model:value="salt"
        label="Salt (blank = random):"
        placeholder="Up to 8 characters"
        label-position="left"
        label-width="110px"
        label-align="right"
        raw-text
      />
      <c-select
        v-if="fmt === 'bcrypt'"
        v-model:value="cost"
        :options="COSTS"
        label="Cost:"
        label-position="left"
        label-width="110px"
        label-align="right"
      />

      <div flex items-center gap-2>
        <c-button type="primary" @click="generate">
          Generate
        </c-button>
        <c-button v-if="fmt === 'apr1'" @click="salt = randomSalt()">
          Random salt
        </c-button>
        <span text-13px op-60>{{ activeHint }}</span>
      </div>
    </div>

    <c-alert v-if="genError">
      {{ genError }}
    </c-alert>

    <div v-if="generated" flex flex-col gap-2>
      <div text-13px op-70>
        Generated line{{ saltUsed ? ` (salt used this time: ${saltUsed})` : '' }}:
      </div>
      <InputCopyable :value="generated" />
      <div>
        <c-button @click="useGenerated">
          Send to verifier
        </c-button>
      </div>
    </div>

    <n-divider />

    <div flex flex-col gap-3>
      <div text-16px fw-600>
        Verify an existing .htpasswd
      </div>

      <c-input-text
        v-model:value="line"
        label="Line content:"
        placeholder="admin:$apr1$xxxx$…"
        label-position="left"
        label-width="110px"
        label-align="right"
        raw-text
      />
      <c-input-text
        v-model:value="passwordToCheck"
        label="Password to check:"
        placeholder="Password to check"
        label-position="left"
        label-width="110px"
        label-align="right"
        raw-text
      />

      <div flex items-center gap-2>
        <c-button type="primary" @click="verify">
          Verify
        </c-button>
        <span v-if="parsed" text-13px op-60>Detected format: {{ detected }}</span>
      </div>

      <c-alert v-if="verifyError">
        {{ verifyError }}
      </c-alert>

      <div v-if="verifyResult" flex items-center gap-2>
        <span v-if="verifyResult === 'match'" text-green>Password matches</span>
        <span v-else text-red>Password does not match</span>
      </div>
    </div>
  </div>
</template>
