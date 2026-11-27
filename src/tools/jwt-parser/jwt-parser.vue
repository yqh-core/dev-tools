<script setup lang="ts">
import { decodeJwt, type JwtDecodeErrorCode } from './jwt-parser.service';
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

// Keep every locale key explicit. Dynamically assembled Vue I18n paths are not
// reliably included by the locale build transform and can render an empty reason.
function isJwtDecodeErrorCode(value: unknown): value is JwtDecodeErrorCode {
  return value === 'empty'
    || value === 'whitespace'
    || value === 'segments'
    || value === 'base64url'
    || value === 'decode';
}

function getJwtDecodeErrorMessage(error: unknown): string {
  // Use the stable error code rather than instanceof: validation may receive an
  // error object across Vue/component boundaries where constructor identity differs.
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? error.code
    : undefined;

  if (!isJwtDecodeErrorCode(code)) {
    return t('tools.jwt-parser.errors.decode');
  }

  switch (code) {
    case 'empty':
      return t('tools.jwt-parser.errors.empty');
    case 'whitespace':
      return t('tools.jwt-parser.errors.whitespace');
    case 'segments':
      return t('tools.jwt-parser.errors.segments');
    case 'base64url':
      return t('tools.jwt-parser.errors.base64url');
    case 'decode':
      return t('tools.jwt-parser.errors.decode');
  }
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
    message: t('tools.jwt-parser.errors.invalidWithReason'),
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
