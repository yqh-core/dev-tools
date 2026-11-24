<script setup lang="ts">
import { getCountries, getCountryCallingCode, parsePhoneNumber } from 'libphonenumber-js/max';
import lookup from 'country-code-lookup';
import {
  formatTypeToHumanReadable,
  getDefaultCountryCode,
  getFullCountryName,
} from './phone-parser-and-formatter.models';
import { withDefaultOnError } from '@/utils/defaults';
import { booleanToHumanReadable } from '@/utils/boolean';
import { useValidation } from '@/composable/validation';

const rawPhone = ref('');
const defaultCountryCode = ref(getDefaultCountryCode());
const batchRawPhoneNumbers = ref('');
const MAX_BATCH_NUMBERS = 200;
const MAX_BATCH_LINE_LENGTH = 100;

const batchPhoneInputs = computed(() => batchRawPhoneNumbers.value
  .split(/\r?\n/)
  .map(value => value.trim())
  .filter(Boolean));
const batchHasTooManyNumbers = computed(() => batchPhoneInputs.value.length > MAX_BATCH_NUMBERS);
const batchHasOverlongNumber = computed(() => batchPhoneInputs.value.some(value => value.length > MAX_BATCH_LINE_LENGTH));

const batchPhoneResults = computed(() => {
  if (batchHasTooManyNumbers.value || batchHasOverlongNumber.value) {
    return [];
  }

  return batchPhoneInputs.value.map((input, index) => {
    try {
      const parsed = parsePhoneNumber(input, defaultCountryCode.value);
      if (!parsed) {
        throw new Error('Unrecognized phone number');
      }

      return {
        lineNumber: index + 1,
        input,
        country: getFullCountryName(parsed.country) ?? parsed.country ?? '',
        callingCode: parsed.countryCallingCode,
        valid: parsed.isValid() ? 'Yes' : 'No',
        possible: parsed.isPossible() ? 'Yes' : 'No',
        type: formatTypeToHumanReadable(parsed.getType()) ?? 'Unknown',
        e164: parsed.format('E.164'),
        international: parsed.formatInternational(),
        national: parsed.formatNational(),
        rfc3966: parsed.format('RFC3966'),
        error: '',
      };
    }
    catch {
      return {
        lineNumber: index + 1,
        input,
        country: '',
        callingCode: '',
        valid: 'No',
        possible: 'No',
        type: '',
        e164: '',
        international: '',
        national: '',
        rfc3966: '',
        error: 'Could not parse this number',
      };
    }
  });
});
const validation = useValidation({
  source: rawPhone,
  rules: [
    {
      validator: value => value === '' || /^[0-9 +\-()]+$/.test(value),
      message: 'Invalid phone number',
    },
  ],
});

const parsedDetails = computed(() => {
  if (!validation.isValid) {
    return undefined;
  }

  const parsed = withDefaultOnError(() => parsePhoneNumber(rawPhone.value, defaultCountryCode.value), undefined);

  if (!parsed) {
    return undefined;
  }

  return [
    {
      label: 'Country',
      value: parsed.country,
    },
    {
      label: 'Country',
      value: getFullCountryName(parsed.country),
    },
    {
      label: 'Country calling code',
      value: parsed.countryCallingCode,
    },
    {
      label: 'Is valid?',
      value: booleanToHumanReadable(parsed.isValid()),
    },
    {
      label: 'Is possible?',
      value: booleanToHumanReadable(parsed.isPossible()),
    },
    {
      label: 'Type',
      value: formatTypeToHumanReadable(parsed.getType()),
    },
    {
      label: 'International format',
      value: parsed.formatInternational(),
    },
    {
      label: 'National format',
      value: parsed.formatNational(),
    },
    {
      label: 'E.164 format',
      value: parsed.format('E.164'),
    },
    {
      label: 'RFC3966 format',
      value: parsed.format('RFC3966'),
    },
  ];
});

function downloadBatchCsv() {
  const columns = ['Line', 'Input', 'Country', 'Calling code', 'Valid', 'Possible', 'Type', 'E.164', 'International', 'National', 'RFC 3966', 'Error'];
  const rows = batchPhoneResults.value.map(result => [
    result.lineNumber,
    result.input,
    result.country,
    result.callingCode,
    result.valid,
    result.possible,
    result.type,
    result.e164,
    result.international,
    result.national,
    result.rfc3966,
    result.error,
  ]);
  const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [columns, ...rows].map(row => row.map(value => csvCell(value)).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'phone-number-results.csv';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const countriesOptions = getCountries().map(code => ({
  label: `${lookup.byIso(code)?.country || code} (+${getCountryCallingCode(code)})`,
  value: code,
}));
</script>

<template>
  <div>
    <c-select v-model:value="defaultCountryCode" label="Default country code:" :options="countriesOptions" searchable mb-5 />

    <c-input-text
      v-model:value="rawPhone"
      placeholder="Enter a phone number"
      label="Phone number:"
      :validation="validation"
      mb-5
    />

    <n-table v-if="parsedDetails">
      <tbody>
        <tr v-for="{ label, value } in parsedDetails" :key="label">
          <td font-bold>
            {{ label }}
          </td>
          <td>
            <span-copyable v-if="value" :value="value" />
            <span v-else op-70>
              Unknown
            </span>
          </td>
        </tr>
      </tbody>
    </n-table>
    <c-card mt-8 title="Batch phone number formatter" data-test-id="batch-phone-tool">
      <p mb-3 text-sm op-70>
        Enter one phone number per line. Up to 200 numbers are parsed locally in your browser; choose the default country above for numbers without an international calling code.
      </p>
      <c-input-text
        v-model:value="batchRawPhoneNumbers"
        test-id="batch-phone-numbers"
        label="Phone numbers (one per line):"
        placeholder="+1 650 253 0000&#10;+44 20 7031 3000"
        multiline
        rows="7"
        raw-text
        mb-3
      />
      <c-alert v-if="batchHasTooManyNumbers" type="warning" data-test-id="batch-limit-error" mb-3>
        Maximum 200 non-empty phone numbers per batch. Split the list into smaller batches.
      </c-alert>
      <c-alert v-else-if="batchHasOverlongNumber" type="warning" data-test-id="batch-line-error" mb-3>
        Each phone number must be 100 characters or fewer.
      </c-alert>
      <div v-else-if="batchPhoneResults.length > 0" data-test-id="batch-results">
        <div flex flex-wrap items-center justify-between gap-2 mb-3>
          <span text-sm>{{ batchPhoneResults.length }} numbers processed</span>
          <c-button size="small" @click="downloadBatchCsv">
            Download CSV
          </c-button>
        </div>
        <div class="max-w-full overflow-x-auto">
          <table w-full text-sm>
            <thead>
              <tr text-left>
                <th p-2>#</th>
                <th p-2>Input</th>
                <th p-2>Country</th>
                <th p-2>Valid</th>
                <th p-2>Possible</th>
                <th p-2>E.164</th>
                <th p-2>Type</th>
                <th p-2>Error</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="result in batchPhoneResults" :key="result.lineNumber" border-t data-test-id="batch-result-row">
                <td p-2>{{ result.lineNumber }}</td>
                <td p-2 font-mono>{{ result.input }}</td>
                <td p-2>{{ result.country || 'Unknown' }}</td>
                <td p-2>{{ result.valid }}</td>
                <td p-2>{{ result.possible }}</td>
                <td p-2 font-mono>{{ result.e164 || '—' }}</td>
                <td p-2>{{ result.type || '—' }}</td>
                <td p-2>{{ result.error }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p mt-3 text-xs op-70>
          Validity and possibility are checked against numbering-plan metadata. This does not confirm that a number is assigned, reachable or able to receive calls or messages.
        </p>
      </div>
    </c-card>
  </div>
</template>
