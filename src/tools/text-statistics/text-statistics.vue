<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { getTextStatistics, getTopTermFrequency } from './text-statistics.service';

const { t } = useI18n();
const text = ref('');
const readingWpm = ref(200);
const speakingWpm = ref(150);
const analysisLocale = ref('en');
const excludeEnglishStopWords = ref(false);
const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Chinese', value: 'zh' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Thai', value: 'th' },
];
const stats = computed(() => getTextStatistics(text.value, analysisLocale.value));
const termAnalysis = computed(() => getTopTermFrequency(text.value, analysisLocale.value, {
  excludeEnglishStopWords: excludeEnglishStopWords.value,
  limit: 10,
}));
const effectiveReadingWpm = computed(() => Math.min(1000, Math.max(1, readingWpm.value || 200)));
const effectiveSpeakingWpm = computed(() => Math.min(1000, Math.max(1, speakingWpm.value || 150)));
const readingMinutes = computed(() => stats.value.words === 0
  ? 0
  : Math.ceil(stats.value.words / effectiveReadingWpm.value));
const speakingMinutes = computed(() => stats.value.words === 0
  ? 0
  : Math.ceil(stats.value.words / effectiveSpeakingWpm.value));
const summary = computed(() => [
  `Words: ${stats.value.words}`,
  `Unique words: ${stats.value.uniqueWords}`,
  `Visible characters (graphemes): ${stats.value.graphemes}`,
  `Characters without whitespace: ${stats.value.charactersWithoutWhitespace}`,
  `Unicode code points: ${stats.value.codePoints}`,
  `UTF-16 code units: ${stats.value.utf16CodeUnits}`,
  `UTF-8 bytes: ${stats.value.bytes}`,
  `Lines: ${stats.value.lines} (${stats.value.nonEmptyLines} non-empty)`,
  `Paragraphs: ${stats.value.paragraphs}`,
  `Sentences: ${stats.value.sentences}`,
  `Longest line: ${stats.value.longestLine} visible characters`,
  `Estimated reading time: ${readingMinutes.value} min at ${effectiveReadingWpm.value} words/min`,
  `Estimated speaking time: ${speakingMinutes.value} min at ${effectiveSpeakingWpm.value} words/min`,
  `Top terms: ${termAnalysis.value.terms.map(term => `${term.term} (${term.count}, ${(term.share * 100).toFixed(1)}%)`).join(', ') || 'None'}`,
  `Analyzed term tokens: ${termAnalysis.value.totalTokens}`,
].join('\n'));
</script>

<template>
  <div flex flex-col gap-3>
    <c-card title="Text to analyze">
      <c-input-text v-model:value="text" multiline placeholder="Paste or type your text here..." rows="7" data-test-id="text-input" />
      <div mt-3 flex flex-wrap items-center justify-between gap-2>
        <c-select v-model:value="analysisLocale" :options="languageOptions" label="Text language for word segmentation" />
        <p text-xs opacity-70>
          All analysis runs locally in your browser. Your text is not uploaded.
        </p>
        <input-copyable :value="summary" readonly placeholder="Copy statistics" test-id="copy-statistics" />
      </div>
    </c-card>

    <c-card title="Text statistics" data-test-id="text-statistics-results">
      <div grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4>
        <div data-test-id="words"><n-statistic label="Words" :value="stats.words" /></div>
        <div data-test-id="unique-words"><n-statistic label="Unique words" :value="stats.uniqueWords" /></div>
        <div data-test-id="graphemes"><n-statistic label="Visible characters" :value="stats.graphemes" /></div>
        <div data-test-id="no-whitespace"><n-statistic label="Characters without whitespace" :value="stats.charactersWithoutWhitespace" /></div>
        <div data-test-id="code-points"><n-statistic label="Unicode code points" :value="stats.codePoints" /></div>
        <div data-test-id="utf16"><n-statistic label="UTF-16 code units" :value="stats.utf16CodeUnits" /></div>
        <div data-test-id="bytes"><n-statistic label="UTF-8 bytes" :value="stats.bytes" /></div>
        <div data-test-id="lines"><n-statistic label="Lines" :value="stats.lines" /></div>
        <div data-test-id="non-empty-lines"><n-statistic label="Non-empty lines" :value="stats.nonEmptyLines" /></div>
        <div data-test-id="paragraphs"><n-statistic label="Paragraphs" :value="stats.paragraphs" /></div>
        <div data-test-id="sentences"><n-statistic label="Sentences" :value="stats.sentences" /></div>
        <div data-test-id="longest-line"><n-statistic label="Longest line (visible chars)" :value="stats.longestLine" /></div>
      </div>
    </c-card>

    <c-card title="Reading & speaking time" data-test-id="time-estimates">
      <div grid grid-cols-1 gap-3 sm:grid-cols-2>
        <div data-test-id="reading-time">
          <n-statistic label="Estimated reading time" :value="readingMinutes === 0 ? '0 min' : `${readingMinutes} min`" />
          <label mt-2 flex flex-wrap items-center gap-2 text-sm>
            Reading speed
            <input v-model.number="readingWpm" type="number" min="1" max="1000" step="10" aria-label="Reading speed in words per minute" w-24 border rounded px-2 py-1>
            <span>words/min</span>
          </label>
        </div>
        <div data-test-id="speaking-time">
          <n-statistic :label="t('tools.text-statistics.speakingTime')" :value="speakingMinutes === 0 ? '0 min' : `${speakingMinutes} min`" />
          <label mt-2 flex flex-wrap items-center gap-2 text-sm>
            {{ t('tools.text-statistics.speakingSpeed') }}
            <input v-model.number="speakingWpm" type="number" min="1" max="1000" step="10" :aria-label="t('tools.text-statistics.speakingSpeedAria')" w-24 border rounded px-2 py-1>
            <span>{{ t('tools.text-statistics.wordsPerMinute') }}</span>
          </label>
        </div>
      </div>
      <p mt-2 text-xs opacity-70>
        Estimate = word count divided by the selected words-per-minute rate, rounded up to a whole minute. Actual reading and speaking speed varies.
      </p>
    </c-card>

    <c-card :title="t('tools.text-statistics.topTerms')" data-test-id="top-terms">
      <div v-if="analysisLocale === 'en'" mb-3>
        <label flex items-start gap-2 text-sm>
          <input v-model="excludeEnglishStopWords" type="checkbox" data-test-id="exclude-stop-words" mt-1>
          <span>
            {{ t('tools.text-statistics.excludeEnglishStopWords') }}
            <span block text-xs opacity-70>{{ t('tools.text-statistics.stopWordsDescription') }}</span>
          </span>
        </label>
      </div>
      <p mb-2 text-xs opacity-70 data-test-id="term-denominator">
        {{ t('tools.text-statistics.analyzedTokens', { count: termAnalysis.totalTokens }) }}
      </p>
      <table v-if="termAnalysis.terms.length" w-full border-collapse text-sm>
        <thead>
          <tr border-b text-left>
            <th py-2 pr-2>{{ t('tools.text-statistics.termColumn') }}</th>
            <th py-2 pr-2 text-right>{{ t('tools.text-statistics.countColumn') }}</th>
            <th py-2 text-right>{{ t('tools.text-statistics.shareColumn') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="term in termAnalysis.terms" :key="term.term" border-b border-gray-200 dark:border-gray-700>
            <td py-2 pr-2 break-all>{{ term.term }}</td>
            <td py-2 pr-2 text-right tabular-nums>{{ term.count }}</td>
            <td py-2 text-right tabular-nums>{{ (term.share * 100).toFixed(1) }}%</td>
          </tr>
        </tbody>
      </table>
      <p v-else text-sm opacity-70 data-test-id="no-terms">
        {{ t('tools.text-statistics.noTerms') }}
      </p>
      <p mt-3 text-xs opacity-70>
        {{ t('tools.text-statistics.termFrequencyNote') }}
      </p>
    </c-card>

    <c-card title="How counts are calculated" data-test-id="counting-methodology">
      <ul list-disc pl-5 text-sm space-y-2>
        <li><strong>Visible characters</strong> count Unicode grapheme clusters where the browser supports Intl.Segmenter. A joined emoji or accented letter can be one visible character.</li>
        <li><strong>Unicode code points</strong> count Unicode values; <strong>UTF-16 code units</strong> match JavaScript string length; <strong>UTF-8 bytes</strong> measure encoded storage size. These numbers are different by design.</li>
        <li><strong>Words and sentences</strong> use browser locale-aware segmentation when available. Older browsers use an approximate Unicode-aware fallback, which may not split Chinese, Japanese or Thai into dictionary words.</li>
        <li><strong>Lines</strong> split on LF, CRLF or CR. Paragraphs are blocks separated by one or more blank lines. Longest line uses visible-character counts.</li>
        <li>Different platforms may apply their own character, byte or weighted-length rules. Use the receiving platform's documented limit when precision matters.</li>
        <li>Term shares use only the tokens included in the table denominator; the English stop-word option changes that denominator without changing the headline word count.</li>
        <li>Speaking time is an estimate based on the selected speaking rate, not a measurement of an individual speaker.</li>
      </ul>
    </c-card>
  </div>
</template>
