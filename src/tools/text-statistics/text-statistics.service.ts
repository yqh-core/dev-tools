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

type SegmentGranularity = 'grapheme' | 'word' | 'sentence'

interface Segment {
  segment: string
  isWordLike?: boolean
}

function getSegments(text: string, granularity: SegmentGranularity, locale = 'en'): Segment[] | null {
  const Segmenter = (Intl as unknown as {
    Segmenter?: new (locale?: string, options?: { granularity: SegmentGranularity }) => {
      segment: (input: string) => Iterable<Segment>
    }
  }).Segmenter

  if (!Segmenter) {
    return null
  }

  try {
    return [...new Segmenter(locale, { granularity }).segment(text)]
  }
  catch {
    return null
  }
}

function splitWords(text: string, locale: string): string[] {
  const segments = getSegments(text, 'word', locale)
  if (segments) {
    return segments.filter(item => item.isWordLike).map(item => item.segment)
  }

  // Unicode-aware fallback. It intentionally does not claim dictionary-based
  // segmentation for scripts that do not separate words with whitespace.
  return text.match(/[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu) ?? []
}

function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/)
}

export function getStringSizeInBytes(text: string): number {
  return new TextEncoder().encode(text).byteLength
}

export function getTextStatistics(text: string, locale = 'en'): TextStatistics {
  const lines = text === '' ? [] : splitLines(text)
  const words = splitWords(text, locale)
  const graphemeSegments = getSegments(text, 'grapheme', locale)
  const graphemes = graphemeSegments
    ? graphemeSegments.length
    : Array.from(text).length
  const noWhitespace = text.replace(/\s/gu, '')
  const noWhitespaceSegments = getSegments(noWhitespace, 'grapheme', locale)
  const paragraphs = text.trim()
    ? text.trim().split(/(?:\r\n|\r|\n)\s*(?:\r\n|\r|\n)+/).filter(Boolean).length
    : 0
  const sentenceSegments = getSegments(text, 'sentence', locale)
  const sentences = sentenceSegments
    ? sentenceSegments.filter(item => item.segment.trim().length > 0).length
    : (text.match(/[^.!?。！？\r\n]+(?:[.!?。！？]+|$)/gu) ?? []).filter(item => item.trim()).length

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
    longestLine: lines.reduce((max, line) => Math.max(max, getSegments(line, 'grapheme', locale)?.length ?? Array.from(line).length), 0),
    bytes: getStringSizeInBytes(text),
  }
}
