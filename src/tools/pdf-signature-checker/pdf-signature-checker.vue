<script setup lang="ts">
import type { CheckKind, CheckOutcome } from './pdf-signature-checker.service';
import { inspectPdf } from './pdf-signature-checker.check';
import { summarizeSignatures } from './pdf-signature-checker.service';
import { formatBytes } from '@/utils/convert';

const outcome = ref<CheckOutcome | null>(null);
const status = ref<'idle' | 'loading' | 'done'>('idle');
const file = ref<File | null>(null);

async function onVerifyClicked(uploadedFile: File) {
  file.value = uploadedFile;
  outcome.value = null;
  status.value = 'loading';
  // inspectPdf 内部把「头部/EOF 探测 + 底层库调用 + throw/return 归一 + 分类」全包了，
  // 组件只消费一个可判别结果，绝不会再出现把 undefined 塞进模板读 .length 的渲染崩溃。
  try {
    const buffer = await uploadedFile.arrayBuffer();
    outcome.value = inspectPdf(buffer);
  }
  catch {
    // 兜底：连 arrayBuffer / 库调用都抛了（例如浏览器端某些极端环境），也要给出明确的失败反馈，
    // 而不是让界面永远卡在「Checking…」。unknown 会渲染成「无法归类，请谨慎」的告警。
    outcome.value = { kind: 'unknown' };
  }
  finally {
    status.value = 'done';
  }
}

const summary = computed(() =>
  outcome.value?.kind === 'signed' && outcome.value.signatures
    ? summarizeSignatures(outcome.value.signatures)
    : null,
);

const signedSignatures = computed(() =>
  outcome.value?.kind === 'signed' ? outcome.value.signatures ?? [] : [],
);

interface FailureView { type: 'error' | 'warning'; title: string; text: string }

const failureView = computed<FailureView | null>(() => {
  const o = outcome.value;
  if (!o || o.kind === 'signed') {
    return null;
  }
  switch (o.kind as CheckKind) {
    case 'not-a-pdf':
      return {
        type: 'error',
        title: 'Not a readable PDF',
        text: 'This file has no PDF header, so it is either the wrong file type or a badly corrupted download. Nothing about signatures can be determined.',
      };
    case 'unsigned':
      return {
        type: 'warning',
        title: 'No digital signature found',
        text: 'The PDF was read successfully but contains no digital signature. This is normal for an unsigned document and does not, by itself, indicate tampering.',
      };
    case 'unsupported-signature':
      return {
        type: 'warning',
        title: 'Signature format not supported',
        text: `A signature was detected, but its format (${o.subFilter ?? 'unknown'}) can’t be verified by this tool. Supported formats: adbe.pkcs7.detached and ETSI.CAdES.detached.`,
      };
    case 'unreadable':
      return {
        type: 'error',
        title: 'Couldn’t read the PDF structure',
        text: 'The file’s internal structure couldn’t be parsed — it may be truncated, damaged, or password/encryption-protected. No conclusion about its signatures can be drawn.',
      };
    case 'signature-invalid':
      return {
        type: 'error',
        title: 'Signature could not be authenticated',
        text: 'A signature is present, but its cryptographic signature does not validate against its own certificate. The signature is invalid or has been broken — treat the document as unverified.',
      };
    case 'byte-range-mismatch':
      return {
        type: 'warning',
        title: 'Content changed after signing (byte-range mismatch)',
        text: 'There is data beyond the byte range the signature covers. The document may have been modified after signing, or this is not the most recent signature. Integrity cannot be confirmed.',
      };
    default:
      return {
        type: 'error',
        title: 'Unexpected result',
        text: 'The checker returned a state it could not classify. No conclusion about signatures should be drawn from this file.',
      };
  }
});

interface SignedView { tone: 'green' | 'orange' | 'red'; headline: string; note?: string }

const signedView = computed<SignedView | null>(() => {
  const s = summary.value;
  if (!s) {
    return null;
  }
  const count = `${s.signatureCount} signature${s.signatureCount === 1 ? '' : 's'} found`;
  if (!s.allIntegrityPass) {
    return {
      tone: 'red',
      headline: `${count} — content changed after signing`,
      note: 'At least one signature’s integrity check failed: the bytes covered by that signature no longer match what was signed.',
    };
  }
  if (!s.allTrustPass) {
    return {
      tone: 'orange',
      headline: `${count} — cryptographically intact, but the certificate is not trusted`,
      note: 'The signatures verify against their own certificates, but at least one signer certificate does not chain to a trusted root in this tool’s CA set.',
    };
  }
  if (s.anyExpired) {
    return {
      tone: 'orange',
      headline: `${count} — intact and trusted, but a certificate is expired`,
      note: 'Without a trusted signing timestamp, an expiry shown against the current time does not by itself invalidate the signature.',
    };
  }
  return {
    tone: 'green',
    headline: `${count} — integrity, certificate trust and validity all OK`,
    note: 'All technical checks this tool performs passed. See the limits below for what it does not check.',
  };
});

const toneColor: Record<SignedView['tone'], string> = {
  green: 'text-green',
  orange: 'text-orange',
  red: 'text-red',
};
</script>

<template>
  <div mx-auto max-w-720px flex flex-col gap-4>
    <c-file-upload
      title="Drag and drop a PDF file here, or click to select a file"
      accept=".pdf"
      data-test-id="upload"
      @file-upload="onVerifyClicked"
    />

    <c-card v-if="file" flex items-center gap-2>
      <div font-bold>
        {{ file.name }}
      </div>
      <div op-65>
        {{ formatBytes(file.size) }}
      </div>
    </c-card>

    <div v-if="status === 'loading'" op-65>
      Checking…
    </div>

    <template v-if="status === 'done' && outcome">
      <c-alert v-if="failureView" :type="failureView.type" :title="failureView.title" data-test-id="failure">
        {{ failureView.text }}
      </c-alert>

      <c-card v-else-if="signedView" p-0 data-test-id="summary">
        <div border-b px-4 py-3>
          <div :class="toneColor[signedView.tone]" font-semibold>
            {{ signedView.headline }}
          </div>
          <div v-if="signedView.note" mt-1 text-13px op-65>
            {{ signedView.note }}
          </div>
        </div>
        <div px-4 py-3 text-13px op-70>
          The three checks are reported separately on purpose: a signature can be present and cryptographically
          intact yet use a certificate this tool does not trust (and none of these means the signature is legally valid).
        </div>
      </c-card>

      <div v-if="signedSignatures.length" flex flex-col gap-4 data-test-id="signatures">
        <pdf-signature-details
          v-for="(signature, index) of signedSignatures"
          :key="index"
          :signature="signature"
          :index="index"
        />
      </div>

      <details v-if="signedView" border rounded p-4 data-test-id="limits">
        <summary cursor-pointer font-semibold>
          What this tool checks — and what it does not
        </summary>
        <ul mt-3 flex flex-col gap-2 text-13px op-85>
          <li>
            <b>Signature presence</b>: whether the PDF contains one or more digital signatures.
          </li>
          <li>
            <b>Cryptographic integrity</b>: whether the bytes covered by each signature still match the hash embedded in the signature. Only the signed byte range is protected; content added outside it (e.g. some incremental updates) is not caught here.
          </li>
          <li>
            <b>Certificate-chain trust</b>: whether the signer certificate chains to a root CA in this tool’s built-in trusted set. It does <b>not</b> check revocation (CRL / OCSP), key usage, or any enterprise trust policy.
          </li>
          <li>
            <b>Validity window</b>: whether certificates are expired or not-yet-valid <b>at the current time</b>. Without a trusted timestamp, this cannot confirm the certificate was valid when the document was actually signed.
          </li>
          <li>
            <b>Legal validity is out of scope.</b> Nothing here determines whether a signature is legally binding. Legal effect depends on the applicable e-signature law, the type of certificate (e.g. qualified / QCP), signer identity, and often a trusted timestamp — none of which this in-browser check evaluates.
          </li>
          <li>
            Everything runs locally in your browser; the file is never uploaded.
          </li>
        </ul>
      </details>
    </template>
  </div>
</template>
