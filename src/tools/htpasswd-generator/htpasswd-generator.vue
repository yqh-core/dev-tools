<script setup lang="ts">
/** Local .htpasswd generation and verification for Apache / Nginx Basic Auth. */
import { compareSync, hashSync } from 'bcryptjs';
import CryptoJS from 'crypto-js';
import { apr1, apr1Verify } from './apr1';
import { buildHtpasswdLines, type HtpasswdEntry } from './htpasswd-generator.service';

type Fmt = 'bcrypt' | 'apr1' | 'sha1' | 'plain';
const FORMATS: { label: string; value: Fmt; hint: string }[] = [
  { label: 'bcrypt ($2b$, recommended)', value: 'bcrypt', hint: 'Recommended since Apache 2.4 — this is what htpasswd -B outputs' },
  { label: 'Apache MD5 ($apr1$)', value: 'apr1', hint: 'Classic Apache format — what htpasswd -m outputs' },
  { label: 'SHA1 ({SHA})', value: 'sha1', hint: 'Insecure legacy format; avoid for production' },
  { label: 'Plain text (never for production)', value: 'plain', hint: 'Debugging only; never use in production' },
];
const COSTS = [4, 6, 8, 10, 12];
const entries = ref<HtpasswdEntry[]>([{ username: 'admin', password: 'myPassword' }]);
const fmt = ref<Fmt>('apr1');
const salt = ref('');
const cost = ref(10);
const generated = ref('');
const genError = ref('');
const copyState = ref('');
const activeHint = computed(() => FORMATS.find(f => f.value === fmt.value)?.hint ?? '');
const SALT_CHARS = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function randomSalt(len = 8) {
  const array = new Uint8Array(len);
  crypto.getRandomValues(array);
  return Array.from(array, b => SALT_CHARS[b % SALT_CHARS.length]).join('');
}
function addEntry() { entries.value.push({ username: '', password: '' }); generated.value = ''; }
function removeEntry(index: number) { if (entries.value.length > 1) entries.value.splice(index, 1); generated.value = ''; }
function hashOne(password: string, index: number) {
  if (fmt.value === 'bcrypt') return hashSync(password, cost.value);
  if (fmt.value === 'apr1') {
    // Each row gets its own cryptographically random salt; the legacy custom salt is retained for one-user workflows.
    const rowSalt = entries.value.length === 1 && salt.value.trim() ? salt.value.trim().slice(0, 8) : randomSalt();
    return apr1(password, rowSalt);
  }
  if (fmt.value === 'sha1') return `{SHA}${CryptoJS.SHA1(password).toString(CryptoJS.enc.Base64)}`;
  return password;
}
function generate() {
  genError.value = ''; generated.value = ''; copyState.value = '';
  try { generated.value = buildHtpasswdLines(entries.value, hashOne).join('\\n'); }
  catch (error) { genError.value = error instanceof Error ? error.message : String(error); }
}
async function copyOutput() {
  try { await navigator.clipboard.writeText(generated.value); copyState.value = 'Copied'; }
  catch { copyState.value = 'Clipboard unavailable — select and copy the output'; }
}
function downloadOutput() {
  const blob = new Blob([generated.value + '\\n'], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = '.htpasswd'; anchor.click();
  URL.revokeObjectURL(url);
}

// Existing single-line verifier is retained for compatibility.
const line = ref('');
const passwordToCheck = ref('');
const verifyResult = ref<'match' | 'mismatch' | null>(null);
const verifyError = ref('');
const parsed = computed(() => {
  const value = line.value.trim(); if (!value) return null;
  const i = value.indexOf(':'); return i < 0 ? { user: '', hash: value } : { user: value.slice(0, i), hash: value.slice(i + 1) };
});
const detected = computed(() => {
  const h = parsed.value?.hash ?? '';
  if (h.startsWith('$2')) return 'bcrypt';
  if (h.startsWith('$apr1$')) return 'apr1';
  if (h.startsWith('{SHA}')) return 'sha1';
  if (h.startsWith('$1$')) return '$1$ md5-crypt (unsupported)';
  return 'plain text or unknown format';
});
function verify() {
  verifyError.value = ''; verifyResult.value = null;
  const h = parsed.value?.hash ?? '';
  if (!h) { verifyError.value = 'Paste one .htpasswd line first'; return; }
  try {
    let ok = false;
    if (h.startsWith('$2')) ok = compareSync(passwordToCheck.value, h);
    else if (h.startsWith('$apr1$')) ok = apr1Verify(passwordToCheck.value, h);
    else if (h.startsWith('{SHA}')) ok = `{SHA}${CryptoJS.SHA1(passwordToCheck.value).toString(CryptoJS.enc.Base64)}` === h;
    else ok = passwordToCheck.value === h;
    verifyResult.value = ok ? 'match' : 'mismatch';
  }
  catch (error) { verifyError.value = `Verification failed: ${error instanceof Error ? error.message : String(error)}`; }
}
function useGenerated() { line.value = generated.value.split('\\n')[0] ?? ''; passwordToCheck.value = entries.value[0]?.password ?? ''; verifyResult.value = null; }
</script>

<template>
  <div flex flex-col gap-3>
    <c-alert>For Nginx / Apache Basic Auth. Generate a complete .htpasswd file locally; passwords and hashes stay in this browser. Point <code>auth_basic_user_file</code> at the downloaded file and serve Basic Auth over HTTPS.</c-alert>
    <div flex flex-col gap-3>
      <div v-for="(entry, index) in entries" :key="index" border rounded p-3 flex flex-col gap-2>
        <div flex items-center justify-between><strong>User {{ index + 1 }}</strong><c-button v-if="entries.length > 1" @click="removeEntry(index)">Remove</c-button></div>
        <c-input-text v-model:value="entry.username" label="Username:" placeholder="admin" raw-text />
        <c-input-text v-model:value="entry.password" label="Password:" placeholder="Password" raw-text />
      </div>
      <div flex items-center gap-2><c-button @click="addEntry">Add user</c-button><span text-13px op-60>{{ entries.length }} user{{ entries.length === 1 ? '' : 's' }}</span></div>
      <c-select v-model:value="fmt" :options="FORMATS" label="Format:" />
      <c-input-text v-if="fmt === 'apr1' && entries.length === 1" v-model:value="salt" label="Salt (blank = random):" placeholder="Up to 8 characters" raw-text />
      <c-select v-if="fmt === 'bcrypt'" v-model:value="cost" :options="COSTS" label="Cost:" />
      <div flex items-center gap-2><c-button type="primary" @click="generate">Generate .htpasswd</c-button><span text-13px op-60>{{ activeHint }}</span></div>
    </div>
    <c-alert v-if="genError">{{ genError }}</c-alert>
    <div v-if="generated" flex flex-col gap-2>
      <strong>Generated .htpasswd file</strong>
      <textarea v-model="generated" readonly rows="5" w-full font-mono />
      <div flex flex-wrap items-center gap-2><c-button @click="copyOutput">Copy file</c-button><c-button @click="downloadOutput">Download .htpasswd</c-button><c-button @click="useGenerated">Verify first entry</c-button><span text-13px op-60>{{ copyState }}</span></div>
    </div>
    <n-divider />
    <div flex flex-col gap-3>
      <div text-16px fw-600>Verify an existing .htpasswd line</div>
      <c-input-text v-model:value="line" label="Line content:" placeholder="admin:$apr1$xxxx$…" raw-text />
      <c-input-text v-model:value="passwordToCheck" label="Password to check:" placeholder="Password to check" raw-text />
      <div flex items-center gap-2><c-button type="primary" @click="verify">Verify</c-button><span v-if="parsed" text-13px op-60>Detected format: {{ detected }}</span></div>
      <c-alert v-if="verifyError">{{ verifyError }}</c-alert>
      <div v-if="verifyResult" flex items-center gap-2><span v-if="verifyResult === 'match'" text-green>Password matches</span><span v-else text-red>Password does not match</span></div>
    </div>
  </div>
</template>
