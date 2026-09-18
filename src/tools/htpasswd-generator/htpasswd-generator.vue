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
import { hashSync, compareSync } from 'bcryptjs';
import CryptoJS from 'crypto-js';
import { apr1, apr1Verify } from './apr1';

type Fmt = 'bcrypt' | 'apr1' | 'sha1' | 'plain';

const FORMATS: { label: string; value: Fmt; hint: string }[] = [
  { label: 'bcrypt（$2b$，推荐）', value: 'bcrypt', hint: 'Apache 2.4 起推荐；htpasswd -B 生成的就是它' },
  { label: 'Apache MD5（$apr1$）', value: 'apr1', hint: '经典格式，兼容性最好；htpasswd -m 生成的就是它' },
  { label: 'SHA1（{SHA}）', value: 'sha1', hint: '仅比明文强一点，Apache 官方明确标注「不安全」' },
  { label: '明文（勿用于生产）', value: 'plain', hint: '仅 Windows / Netware 支持，调试用' },
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
    genError.value = '请先填写用户名';
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
    genError.value = `生成失败：${e instanceof Error ? e.message : String(e)}`;
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
    return '$1$ md5-crypt（本工具不支持校验，Apache 也已不推荐）';
  }
  return '明文或未知格式';
});

async function verify() {
  verifyError.value = '';
  verifyResult.value = null;

  const h = parsed.value?.hash ?? '';
  if (!h) {
    verifyError.value = '请先粘贴一行 .htpasswd 内容（形如 user:$apr1$…）';
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
    verifyError.value = `校验失败：${e instanceof Error ? e.message : String(e)}`;
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
      用于 Nginx / Apache 的 Basic Auth。生成后把 <code>用户名:哈希</code> 写入 .htpasswd 文件
      （用 <code>auth_basic_user_file</code> 指向它）。全程本地计算，密码不会离开浏览器。
    </c-alert>

    <div flex flex-col gap-3>
      <c-input-text v-model:value="user" label="用户名：" placeholder="admin" label-position="left" label-width="110px" label-align="right" raw-text />
      <c-input-text v-model:value="password" label="密码：" placeholder="密码" label-position="left" label-width="110px" label-align="right" raw-text />
      <c-select v-model:value="fmt" :options="FORMATS" label="格式：" label-position="left" label-width="110px" label-align="right" />
      <c-input-text
        v-if="fmt === 'apr1'"
        v-model:value="salt"
        label="盐（留空随机）："
        placeholder="最多 8 字符"
        label-position="left"
        label-width="110px"
        label-align="right"
        raw-text
      />
      <c-select
        v-if="fmt === 'bcrypt'"
        v-model:value="cost"
        :options="COSTS"
        label="成本："
        label-position="left"
        label-width="110px"
        label-align="right"
      />

      <div flex gap-2 items-center>
        <c-button type="primary" @click="generate">
          生成
        </c-button>
        <c-button v-if="fmt === 'apr1'" @click="salt = randomSalt()">
          随机盐
        </c-button>
        <span op-60 text-13px>{{ activeHint }}</span>
      </div>
    </div>

    <c-alert v-if="genError">
      {{ genError }}
    </c-alert>

    <div v-if="generated" flex flex-col gap-2>
      <div op-70 text-13px>
        生成结果{{ saltUsed ? `（本次使用的盐：${saltUsed}）` : '' }}：
      </div>
      <InputCopyable :value="generated" />
      <div>
        <c-button @click="useGenerated">
          拿去校验
        </c-button>
      </div>
    </div>

    <n-divider />

    <div flex flex-col gap-3>
      <div text-16px fw-600>
        校验已有 .htpasswd
      </div>

      <c-input-text
        v-model:value="line"
        label="一行内容："
        placeholder="admin:$apr1$xxxx$…"
        label-position="left"
        label-width="110px"
        label-align="right"
        raw-text
      />
      <c-input-text
        v-model:value="passwordToCheck"
        label="待验证密码："
        placeholder="待验证密码"
        label-position="left"
        label-width="110px"
        label-align="right"
        raw-text
      />

      <div flex gap-2 items-center>
        <c-button type="primary" @click="verify">
          校验
        </c-button>
        <span v-if="parsed" op-60 text-13px>识别到格式：{{ detected }}</span>
      </div>

      <c-alert v-if="verifyError">
        {{ verifyError }}
      </c-alert>

      <div v-if="verifyResult" flex items-center gap-2>
        <span v-if="verifyResult === 'match'" text-green>✅ 密码匹配</span>
        <span v-else text-red>❌ 密码不匹配</span>
      </div>
    </div>
  </div>
</template>
