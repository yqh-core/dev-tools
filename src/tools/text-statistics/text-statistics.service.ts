export interface TextStatistics {
  utf16CodeUnits: number
  codePoints: number
  graphemes: number
  charactersWithoutWhitespace: number
  words: number
  uniqueWords: number
  lines: number
  nonEmptyLines: number
  paragraphs: number
  sentences: number
  longestLine: number
  bytes: number
}

type SegmentGranularity = 'grapheme' | 'word' | 'sentence';

interface Segment {
  segment: string
  isWordLike?: boolean
}

function getSegments(text: string, granularity: SegmentGranularity, locale = 'en'): Segment[] | null {
  const Segmenter = (Intl as unknown as {
    Segmenter?: new (locale?: string, options?: { granularity: SegmentGranularity }) => {
      segment: (input: string) => Iterable<Segment>
    }
  }).Segmenter;

  if (!Segmenter) {
    return null;
  }

  try {
    return [...new Segmenter(locale, { granularity }).segment(text)];
  }
  catch {
    return null;
  }
}

function splitWords(text: string, locale: string): string[] {
  const segments = getSegments(text, 'word', locale);
  if (segments) {
    return segments.filter(item => item.isWordLike).map(item => item.segment);
  }

  // Unicode-aware fallback; dictionary-based segmentation is not available here.
  return text.match(/[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu) ?? [];
}

function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

export function getStringSizeInBytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function getTextStatistics(text: string, locale = 'en'): TextStatistics {
  const lines = text === '' ? [] : splitLines(text);
  const words = splitWords(text, locale);
  const graphemeSegments = getSegments(text, 'grapheme', locale);
  const graphemes = graphemeSegments ? graphemeSegments.length : Array.from(text).length;
  const noWhitespace = text.replace(/\s/gu, '');
  const noWhitespaceSegments = getSegments(noWhitespace, 'grapheme', locale);
  const paragraphs = text.trim()
    ? text.trim().split(/(?:\r\n|\r|\n)\s*(?:\r\n|\r|\n)+/).filter(Boolean).length
    : 0;
  const sentenceSegments = getSegments(text, 'sentence', locale);
  const sentences = sentenceSegments
    ? sentenceSegments.filter(item => item.segment.trim().length > 0).length
    : (text.match(/[^.!?。！？\r\n]+(?:[.!?。！？]+|$)/gu) ?? []).filter(item => item.trim()).length;

  return {
    utf16CodeUnits: text.length,
    codePoints: Array.from(text).length,
    graphemes,
    charactersWithoutWhitespace: noWhitespaceSegments
      ? noWhitespaceSegments.length
      : Array.from(noWhitespace).length,
    words: words.length,
    uniqueWords: new Set(words.map(word => word.toLocaleLowerCase(locale))).size,
    lines: lines.length,
    nonEmptyLines: lines.filter(line => line.trim().length > 0).length,
    paragraphs,
    sentences,
    longestLine: lines.reduce((max, line) => Math.max(
      max,
      getSegments(line, 'grapheme', locale)?.length ?? Array.from(line).length,
    ), 0),
    bytes: getStringSizeInBytes(text),
  };
}


export interface TopTermFrequency {
  term: string
  count: number
  share: number
}

export interface TopTermFrequencyResult {
  totalTokens: number
  terms: TopTermFrequency[]
}

export interface TopTermFrequencyOptions {
  excludeEnglishStopWords?: boolean
  limit?: number
}

const ENGLISH_STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his',
  'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me',
  'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once',
  'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we',
  'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why',
  'will', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves',
]);

export function getTopTermFrequency(
  text: string,
  locale = 'en',
  options: TopTermFrequencyOptions = {},
): TopTermFrequencyResult {
  const shouldExcludeStopWords = options.excludeEnglishStopWords === true
    && locale.toLowerCase().startsWith('en');
  const limit = Number.isInteger(options.limit) ? Math.min(50, Math.max(1, options.limit!)) : 10;
  const tokens = splitWords(text, locale)
    .map(token => token.toLocaleLowerCase(locale))
    .filter(token => !shouldExcludeStopWords || !ENGLISH_STOP_WORDS.has(token));
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const totalTokens = tokens.length;
  const terms = [...counts.entries()]
    .sort(([leftTerm, leftCount], [rightTerm, rightCount]) => {
      if (leftCount !== rightCount) {
        return rightCount - leftCount;
      }
      return leftTerm.localeCompare(rightTerm, locale);
    })
    .slice(0, limit)
    .map(([term, count]) => ({
      term,
      count,
      share: totalTokens === 0 ? 0 : count / totalTokens,
    }));

  return { totalTokens, terms };
}
