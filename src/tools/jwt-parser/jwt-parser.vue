<script setup lang="ts">
import { type JwtDecodeErrorCode, decodeJwt } from './jwt-parser.service';
import { useValidation } from '@/composable/validation';

const { t, locale } = useI18n();

const rawJwt = ref(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
);

const decodedJWT = computed(() => {
  try {
    return decodeJwt({ jwt: rawJwt.value });
  }
  catch {
    return null;
  }
});

const sections = computed(() => [
  { key: 'header', title: t('tools.jwt-parser.headerTitle') },
  { key: 'payload', title: t('tools.jwt-parser.payloadTitle') },
] as const);

const claimDescriptionKeys: Record<string, string> = {
  alg: 'claims.algorithm',
  typ: 'claims.type',
  iss: 'claims.issuer',
  sub: 'claims.subject',
  aud: 'claims.audience',
  exp: 'claims.expiration',
  nbf: 'claims.notBefore',
  iat: 'claims.issuedAt',
  jti: 'claims.jwtId',
};

// Resolve all localized recovery messages together. This keeps the complete
// message table in the compiled locale bundle and updates it when the UI locale changes.
const jwtDecodeErrorMessages = computed<Record<JwtDecodeErrorCode, string>>(() => ({
  empty: t('tools.jwt-parser.errors.empty'),
  whitespace: t('tools.jwt-parser.errors.whitespace'),
  segments: t('tools.jwt-parser.errors.segments'),
  base64url: t('tools.jwt-parser.errors.base64url'),
  decode: t('tools.jwt-parser.errors.decode'),
}));

function isJwtDecodeErrorCode(value: unknown): value is JwtDecodeErrorCode {
  return value === 'empty'
    || value === 'whitespace'
    || value === 'segments'
    || value === 'base64url'
    || value === 'decode';
}

function getJwtDecodeErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? error.code
    : undefined;
  const messages = jwtDecodeErrorMessages.value;
  const localizedMessage = isJwtDecodeErrorCode(code) ? messages[code] : messages.decode;

  // A recovery explanation must never degrade to an empty suffix in the input control.
  if (localizedMessage) {
    return localizedMessage;
  }

  return locale.value.startsWith('zh')
    ? '无法解码此 Token。请检查三段式 JWT/JWS 格式及 Header、Payload 的 Base64URL JSON 对象。'
    : 'This token could not be decoded. Check the three-part JWT/JWS format and the Base64URL JSON objects in its Header and Payload.';
}

const validationRules = computed(() => [
  {
    validator: (value: string) => {
      try {
        decodeJwt({ jwt: value });
        return true;
      }
      catch {
        return false;
      }
    },
    message: '{0}',
    getErrorMessage: (value: string) => {
      try {
        decodeJwt({ jwt: value });
        return '';
      }
      catch (error) {
        return getJwtDecodeErrorMessage(error);
      }
    },
  },
]);

const validation = useValidation({
  source: rawJwt,
  rules: validationRules,
  watch: [locale],
});

const clipboardStatus = ref('');

function claimDescription(claim: string, fallback?: string) {
  const key = claimDescriptionKeys[claim];
  return key ? t(`tools.jwt-parser.${key}`) : fallback;
}

async function copySignatureSegment() {
  const signature = decodedJWT.value?.signatureSegment;
  if (!signature) {
    return;
  }

  try {
    await navigator.clipboard.writeText(signature);
    clipboardStatus.value = t('tools.jwt-parser.copied');
  }
  catch {
    clipboardStatus.value = t('tools.jwt-parser.clipboardError');
  }
}
</script>

<template>
  <c-card>
    <n-alert type="warning" class="status-note" data-test-id="jwt-unverified">
      {{ t('tools.jwt-parser.decodeNotice') }}
    </n-alert>

    <p class="privacy-note">
      {{ t('tools.jwt-parser.privacyNote') }}
    </p>

    <c-input-text
      v-model:value="rawJwt"
      test-id="jwt-input"
      :label="t('tools.jwt-parser.inputLabel')"
      :placeholder="t('tools.jwt-parser.inputPlaceholder')"
      :validation="validation"
      rows="5"
      multiline
      raw-text
      autofocus
      mb-3
    />

    <template v-if="validation.isValid && decodedJWT">
      <n-table data-test-id="jwt-claims">
        <tbody>
          <template v-for="section of sections" :key="section.key">
            <tr>
              <th colspan="2" class="table-header">
                {{ section.title }}
              </th>
            </tr>
            <tr
              v-for="{ claim, claimDescription: description, friendlyValue, value } in decodedJWT[section.key]"
              :key="claim + value"
            >
              <td class="claims" style="vertical-align: top;">
                <span font-bold>
                  {{ claim }}
                </span>
                <span v-if="claimDescription(claim, description)" ml-2 op-70>
                  ({{ claimDescription(claim, description) }})
                </span>
              </td>
              <td class="claim-value">
                <span>{{ value }}</span>
                <span v-if="friendlyValue" ml-2 op-70>
                  ({{ friendlyValue }})
                </span>
              </td>
            </tr>
          </template>
        </tbody>
      </n-table>

      <section class="signature-panel" data-test-id="jwt-signature">
        <div class="signature-heading">
          <strong>{{ t('tools.jwt-parser.signatureTitle') }}</strong>
          <n-tag type="warning" size="small">
            {{ t('tools.jwt-parser.notVerified') }}
          </n-tag>
        </div>
        <p class="signature-description">
          {{ t('tools.jwt-parser.signatureDescription') }}
        </p>
        <code class="signature-value" data-test-id="jwt-signature-value">{{ decodedJWT.signatureSegment || t('tools.jwt-parser.emptySignature') }}</code>
        <div class="signature-actions">
          <n-button
            size="small"
            quaternary
            :disabled="!decodedJWT.signatureSegment"
            data-test-id="jwt-copy-signature"
            @click="copySignatureSegment"
          >
            {{ t('tools.jwt-parser.copySignature') }}
          </n-button>
          <span v-if="clipboardStatus" role="status" data-test-id="jwt-clipboard-status">
            {{ clipboardStatus }}
          </span>
        </div>
      </section>

      <p class="timestamp-note">
        {{ t('tools.jwt-parser.timestampNote') }}
      </p>
    </template>
  </c-card>
</template>

<style lang="less" scoped>
.status-note {
  margin-bottom: 10px;
}

.privacy-note,
.signature-description,
.timestamp-note {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--muted-color, #777);
}

.table-header {
  text-align: left;
  padding: 9px 12px;
}

.claims {
  min-width: 150px;
}

.claim-value {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.signature-panel {
  display: grid;
  gap: 8px;
  margin-top: 14px;
  padding: 12px;
  border: 1px solid rgba(127, 127, 127, 0.28);
  border-radius: 8px;
}

.signature-heading,
.signature-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.signature-value {
  display: block;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-all;
  white-space: pre-wrap;
  line-height: 1.55;
}

.signature-actions {
  justify-content: flex-start;
}

.timestamp-note {
  margin-top: 12px;
  margin-bottom: 0;
}
</style>
