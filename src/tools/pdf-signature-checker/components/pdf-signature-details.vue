<script setup lang="ts">
import type { SignatureInfo } from '../pdf-signature-checker.types';
import type { AxisState } from '../pdf-signature-checker.service';
import { signatureAxes } from '../pdf-signature-checker.service';

const props = defineProps<{ signature: SignatureInfo; index: number }>();
const { signature } = toRefs(props);

const dash = '—';

const tableHeaders = {
  validityPeriod: 'Validity period',
  issuedBy: 'Issued by',
  issuedTo: 'Issued to',
  pemCertificate: 'PEM certificate',
};

const axes = computed(() => signatureAxes(signature.value));

interface AxisRow {
  key: string
  label: string
  state: AxisState
  stateLabel: string
  help: string
}

// 三条独立的轴：签名「存在」之外，完整性 / 证书链信任 / 有效期各自判定，绝不合并成一个「有效」结论。
const axisRows = computed<AxisRow[]>(() => {
  const a = axes.value;
  return [
    {
      key: 'integrity',
      label: 'Document integrity',
      state: a.integrity,
      stateLabel: a.integrity === 'pass' ? 'Intact' : 'Modified',
      help: 'The hash recorded in the signature matches the hash of the signed bytes. Detects changes to the content that was covered by the signature.',
    },
    {
      key: 'trust',
      label: 'Certificate chain trust',
      state: a.trust,
      stateLabel: a.trust === 'pass' ? 'Trusted' : 'Not trusted',
      help: 'The signer certificate chains up to a trusted root in this tool’s built-in CA set. Revocation (CRL / OCSP) and trust-policy are NOT checked.',
    },
    {
      key: 'validity',
      label: 'Certificate validity (now)',
      state: a.validity,
      stateLabel: a.validity === 'warn' ? 'Expired' : 'Within validity',
      help: 'Whether any certificate is expired or not-yet-valid at the current time. No trusted signing timestamp is used, so an expired certificate does not by itself invalidate the signature.',
    },
  ];
});

function stateColorClass(state: AxisState): string {
  if (state === 'pass') {
    return 'text-green';
  }
  if (state === 'warn') {
    return 'text-orange';
  }
  if (state === 'fail') {
    return 'text-red';
  }
  return 'op-60';
}

const meta = computed(() => {
  const m = signature.value.meta?.signatureMeta;
  if (!m) {
    return null;
  }
  const items = [
    { label: 'Name', value: m.name || dash },
    { label: 'Reason', value: m.reason || dash },
    { label: 'Location', value: m.location || dash },
    { label: 'Contact info', value: m.contactInfo || dash },
  ];
  return items.some(i => i.value !== dash) ? items : null;
});

const certs = computed(() => (signature.value.meta?.certs ?? []).map((certificate, index) => ({
  ...certificate,
  validityPeriod: {
    notBefore: new Date(certificate.validityPeriod.notBefore).toLocaleString(),
    notAfter: new Date(certificate.validityPeriod.notAfter).toLocaleString(),
  },
  certificateName: `Certificate ${index + 1}`,
})));
</script>

<template>
  <div flex flex-col gap-3>
    <div flex items-center justify-between gap-2>
      <div font-bold>
        Signature {{ index + 1 }}
      </div>
      <c-tooltip>
        <span :class="stateColorClass(axes.verified)" text-13px font-semibold>
          {{ axes.verified === 'pass' ? 'Integrity + trust + validity all OK' : axes.verified === 'fail' ? 'Not fully verified' : 'Unknown' }}
        </span>
        <template #tooltip>
          "Verified" here is only the conjunction of integrity, certificate-chain trust and non-expiry as
          computed by this tool. It is a technical signal, not a legal opinion on validity.
        </template>
      </c-tooltip>
    </div>

    <c-card p-0 data-test-id="signature-status">
      <div
        v-for="row of axisRows"
        :key="row.key"
        flex
        items-center
        justify-between
        gap-3
        border-b
        px-4
        py-2
        :data-test-id="`axis-${row.key}`"
      >
        <div flex flex-col>
          <span>{{ row.label }}</span>
          <span text-12px op-55>{{ row.help }}</span>
        </div>
        <span :class="stateColorClass(row.state)" whitespace-nowrap font-semibold>
          {{ row.stateLabel }}
        </span>
      </div>
    </c-card>

    <c-key-value-list v-if="meta" :items="meta" />

    <c-table v-if="certs.length" :data="certs" :headers="tableHeaders">
      <template #validityPeriod="{ value }">
        <c-key-value-list
          :items="[
            { label: 'Not before', value: value.notBefore },
            { label: 'Not after', value: value.notAfter },
          ]"
        />
      </template>

      <template #issuedBy="{ value }">
        <c-key-value-list
          :items="[
            { label: 'Common name', value: value.commonName || dash },
            { label: 'Organization name', value: value.organizationName || dash },
            { label: 'Country name', value: value.countryName || dash },
            { label: 'Locality name', value: value.localityName || dash },
            { label: 'Organizational unit name', value: value.organizationalUnitName || dash },
            { label: 'State or province name', value: value.stateOrProvinceName || dash },
          ]"
        />
      </template>

      <template #issuedTo="{ value }">
        <c-key-value-list
          :items="[
            { label: 'Common name', value: value.commonName || dash },
            { label: 'Organization name', value: value.organizationName || dash },
            { label: 'Country name', value: value.countryName || dash },
            { label: 'Locality name', value: value.localityName || dash },
            { label: 'Organizational unit name', value: value.organizationalUnitName || dash },
            { label: 'State or province name', value: value.stateOrProvinceName || dash },
          ]"
        />
      </template>

      <template #pemCertificate="{ value }">
        <c-modal-value :value="value" label="View PEM cert">
          <template #value>
            <div break-all text-xs>
              {{ value }}
            </div>
          </template>
        </c-modal-value>
      </template>
    </c-table>
  </div>
</template>
