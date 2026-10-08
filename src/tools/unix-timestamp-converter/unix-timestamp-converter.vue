<script setup lang="ts">
import {
  formatISO,
  formatRFC3339,
  fromUnixTime,
  getTime,
  getUnixTime,
  isDate,
  isValid,
  parseISO,
  parseJSON,
} from 'date-fns';
import { useNow } from '@vueuse/core';
import type { DateFormat, ToDateMapper } from './unix-timestamp-converter.types';
import {
  isISO8601DateTimeString,
  isRFC3339DateString,
  isTimestamp,
  isUTCDateString,
  isUnixTimestamp,
} from '@/utils/datetime';
import { withDefaultOnError } from '@/utils/defaults';
import { useValidation } from '@/composable/validation';

const inputDate = ref('');

const toDate: ToDateMapper = date => new Date(date);

/**
 * Reduced, epoch-centric format list (reusing the shared datetime predicates).
 * Epoch seconds and milliseconds are listed first, because this tool owns the
 * "unix timestamp converter" intent — the broad format zoo lives on /date-converter.
 */
const formats: DateFormat[] = [
  {
    name: 'Unix timestamp',
    fromDate: date => String(getUnixTime(date)),
    toDate: sec => fromUnixTime(+sec),
    formatMatcher: date => isUnixTimestamp(date),
  },
  {
    name: 'Timestamp',
    fromDate: date => String(getTime(date)),
    toDate: ms => parseJSON(+ms),
    formatMatcher: date => isTimestamp(date),
  },
  {
    name: 'ISO 8601',
    fromDate: formatISO,
    toDate: parseISO,
    formatMatcher: date => isISO8601DateTimeString(date),
  },
  {
    name: 'RFC 3339',
    fromDate: formatRFC3339,
    toDate,
    formatMatcher: date => isRFC3339DateString(date),
  },
  {
    name: 'UTC format',
    fromDate: date => date.toUTCString(),
    toDate,
    formatMatcher: date => isUTCDateString(date),
  },
  {
    name: 'JS locale date string',
    fromDate: date => date.toString(),
    toDate,
    formatMatcher: () => false,
  },
];

const formatIndex = ref(0);
const now = useNow();

const normalizedDate = computed(() => {
  if (!inputDate.value) {
    return now.value;
  }

  const { toDate } = formats[formatIndex.value];

  try {
    return toDate(inputDate.value);
  }
  catch (_ignored) {
    return undefined;
  }
});

function onDateInputChanged(value: string) {
  const matchingIndex = formats.findIndex(({ formatMatcher }) => formatMatcher(value));
  if (matchingIndex !== -1) {
    formatIndex.value = matchingIndex;
  }
}

/** Fill the input with the current epoch time (seconds) and snap to the Unix timestamp format. */
function fillNow() {
  inputDate.value = String(getUnixTime(new Date()));
  formatIndex.value = 0;
}

const validation = useValidation({
  source: inputDate,
  watch: [formatIndex],
  rules: [
    {
      message: 'This date is invalid for this format',
      validator: value =>
        withDefaultOnError(() => {
          if (value === '') {
            return true;
          }

          const maybeDate = formats[formatIndex.value].toDate(value);
          return isDate(maybeDate) && isValid(maybeDate);
        }, false),
    },
  ],
});

function formatDateUsingFormatter(formatter: (date: Date) => string, date?: Date) {
  if (!date || !validation.isValid) {
    return '';
  }

  return withDefaultOnError(() => formatter(date), '');
}
</script>

<template>
  <div>
    <div flex gap-2>
      <c-input-text
        v-model:value="inputDate"
        autofocus
        placeholder="Put your timestamp or date string here..."
        clearable
        test-id="unix-timestamp-converter-input"
        :validation="validation"
        @update:value="onDateInputChanged"
      />

      <c-button test-id="unix-timestamp-converter-now" @click="fillNow">
        Now
      </c-button>

      <c-select
        v-model:value="formatIndex"
        style="flex: 0 0 170px"
        :options="formats.map(({ name }, i) => ({ label: name, value: i }))"
        data-test-id="unix-timestamp-converter-format-select"
      />
    </div>

    <n-divider />

    <input-copyable
      v-for="{ name, fromDate } in formats"
      :key="name"
      :label="name"
      label-width="150px"
      label-position="left"
      label-align="right"
      :value="formatDateUsingFormatter(fromDate, normalizedDate)"
      placeholder="Invalid date..."
      :test-id="name"
      readonly
      mt-2
    />
  </div>
</template>
