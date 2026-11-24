import RandExp from 'randexp';

export interface GroupCapture {
  name: string
  value: string
  start: number
  end: number
}

export interface RegexMatch {
  index: number
  value: string
  captures: GroupCapture[]
  groups: GroupCapture[]
}

export interface RegexEvaluation {
  results: RegexMatch[]
  replacementPreview: string
  sample: string
}

export interface RegexPreset {
  label: string
  pattern: string
  flags: string
  sample: string
}

export const REGEX_PRESETS: RegexPreset[] = [
  {
    label: 'Email address',
    pattern: '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$',
    flags: 'dgi',
    sample: 'dev@example.com',
  },
  {
    label: 'URL',
    pattern: 'https?:\\/\\/[^\\s]+',
    flags: 'dg',
    sample: 'https://example.com/path',
  },
  {
    label: 'IPv4 address',
    pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b',
    flags: 'dg',
    sample: '192.168.1.42',
  },
  {
    label: 'ISO date format (YYYY-MM-DD)',
    pattern: '\\b\\d{4}-\\d{2}-\\d{2}\\b',
    flags: 'dg',
    sample: '2026-11-23',
  },
];

type MatchIndices = Array<[number, number] | undefined> & {
  groups?: Record<string, [number, number] | undefined>
};

type RegExpExecArrayWithIndices = RegExpExecArray & {
  indices: MatchIndices
};

/** Evaluate a JavaScript RegExp. This function is called inside a dedicated Worker. */
export function matchRegex(regex: string, text: string, flags: string): RegexMatch[] {
  // An empty pattern is treated as unset, but a non-empty pattern may validly match an empty input.
  if (!regex) {
    return [];
  }

  const re = new RegExp(regex, flags);
  const results: RegexMatch[] = [];
  let match = re.exec(text) as RegExpExecArrayWithIndices | null;

  while (match !== null) {
    const indices = match.indices;
    const captures: GroupCapture[] = [];
    for (let index = 1; index < match.length; index++) {
      const range = indices[index];
      if (range) {
        captures.push({
          name: String(index),
          value: match[index],
          start: range[0],
          end: range[1],
        });
      }
    }

    const groups: GroupCapture[] = [];
    for (const [name, value] of Object.entries(match.groups ?? {})) {
      const range = indices.groups?.[name];
      if (range && value !== undefined) {
        groups.push({ name, value, start: range[0], end: range[1] });
      }
    }

    results.push({ index: match.index, value: match[0], captures, groups });

    if (!re.global) {
      break;
    }

    // RegExp.exec does not advance lastIndex for an empty global match.
    // Advance by one Unicode code point so zero-width patterns cannot loop forever.
    if (match[0] === '') {
      const codePoint = text.codePointAt(re.lastIndex);
      if (codePoint === undefined) {
        break;
      }
      re.lastIndex += (re.flags.includes('u') || re.flags.includes('v')) && codePoint > 0xFFFF ? 2 : 1;
    }

    match = re.exec(text) as RegExpExecArrayWithIndices | null;
  }

  return results;
}

export function evaluateRegex(
  regex: string,
  text: string,
  flags: string,
  replacement: string,
): RegexEvaluation {
  const results = matchRegex(regex, text, flags);
  const replacementPreview = text.replace(new RegExp(regex, flags), replacement);

  let sample = '';
  try {
    // RandExp does not implement named groups; convert only their declaration to non-capturing syntax.
    const samplePattern = regex.replace(/\(\?<[^>]+>/g, '(?:');
    sample = new RandExp(new RegExp(samplePattern)).gen();
  }
  catch {
    // Sample generation is optional; matching and replacement remain available.
  }

  return { results, replacementPreview, sample };
}

export interface RegexTestCase {
  id: string
  name: string
  text: string
  shouldMatch: boolean
}

export interface RegexTestCaseResult extends RegexTestCase {
  passed: boolean
  actualMatch: boolean
  firstMatch: RegexMatch | null
}

/** Run a named positive/negative suite inside the same isolated Worker as matching.
 * Each case reuses the live match semantics and retains its first match for capture inspection.
 */
export function evaluateRegexTestCases(
  regex: string,
  flags: string,
  cases: RegexTestCase[],
): RegexTestCaseResult[] {
  return cases.map((testCase) => {
    const matches = matchRegex(regex, testCase.text, flags);
    const actualMatch = matches.length > 0;
    return {
      ...testCase,
      actualMatch,
      passed: actualMatch === testCase.shouldMatch,
      firstMatch: matches[0] ?? null,
    };
  });
}

export type RegexExplanationKind = 'anchor' | 'character-class' | 'escape' | 'group' | 'quantifier' | 'alternation' | 'wildcard' | 'literal' | 'unknown';

export interface RegexTokenExplanation {
  token: string
  explanation: string
  kind: RegexExplanationKind
  recognized: boolean
}

export interface RegexFlagExplanation {
  flag: string
  explanation: string
}

function tokenExplanation(token: string, explanation: string, kind: RegexExplanationKind, recognized = true): RegexTokenExplanation {
  return { token, explanation, kind, recognized };
}

function characterClassEnd(pattern: string, start: number, unicodeSets: boolean): number {
  let depth = 1;
  for (let index = start + 1; index < pattern.length; index++) {
    if (pattern[index] === '\\') {
      index += 1;
      continue;
    }
    if (unicodeSets && pattern[index] === '[') {
      depth += 1;
    }
    else if (pattern[index] === ']') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function explainEscape(pattern: string, index: number, flags: string): { token: string; explanation: string; recognized: boolean } {
  const next = pattern[index + 1];
  if (next === undefined) {
    return { token: '\\', explanation: 'A trailing backslash has no character to escape; the pattern is incomplete.', recognized: false };
  }

  const shorthand: Record<string, string> = {
    d: 'Matches one ASCII digit (0–9).',
    D: 'Matches one character that is not an ASCII digit.',
    w: 'Matches one word character: letters, digits or underscore.',
    W: 'Matches one character that is not a word character.',
    s: 'Matches one whitespace character.',
    S: 'Matches one character that is not whitespace.',
    b: 'Matches a word boundary (or a backspace inside a character class).',
    B: 'Matches a position that is not a word boundary.',
    n: 'Matches a line-feed character.',
    r: 'Matches a carriage-return character.',
    t: 'Matches a tab character.',
    f: 'Matches a form-feed character.',
    v: 'Matches a vertical-tab character.',
    0: 'Matches the NUL character.',
  };
  if (shorthand[next]) {
    return { token: pattern.slice(index, index + 2), explanation: shorthand[next], recognized: true };
  }

  if (next === 'p' || next === 'P') {
    const match = pattern.slice(index).match(/^\\[pP]\{[^}]+\}/);
    if (match) {
      const supported = flags.includes('u') || flags.includes('v');
      return {
        token: match[0],
        explanation: `${next === 'p' ? 'Matches a character with' : 'Matches a character without'} the stated Unicode property${supported ? '.' : '; this escape requires the u or v flag.'}`,
        recognized: supported,
      };
    }
  }

  if (next === 'k') {
    const match = pattern.slice(index).match(/^\\k<([A-Za-z_$][\w$]*)>/);
    if (match) {
      return { token: match[0], explanation: `Matches the same text previously captured by the named group "${match[1]}".`, recognized: true };
    }
  }

  if (next === 'x' && /^[\da-fA-F]{2}$/.test(pattern.slice(index + 2, index + 4))) {
    return { token: pattern.slice(index, index + 4), explanation: 'Matches the character with this two-digit hexadecimal code.', recognized: true };
  }

  if (next === 'u') {
    const point = pattern.slice(index).match(/^\\u\{[\da-fA-F]+\}/);
    const unit = pattern.slice(index).match(/^\\u[\da-fA-F]{4}/);
    if (point || unit) {
      return { token: (point || unit)![0], explanation: 'Matches the Unicode character represented by this code point.', recognized: true };
    }
  }

  if (next === 'c' && /^[A-Za-z]$/.test(pattern[index + 2] || '')) {
    return { token: pattern.slice(index, index + 3), explanation: 'Matches the corresponding ASCII control character.', recognized: true };
  }

  if (/^[1-9]$/.test(next)) {
    const digits = pattern.slice(index + 1).match(/^\d+/)?.[0] || next;
    return { token: `\\${digits}`, explanation: 'Refers to a previously captured numbered group (JavaScript backreference syntax).', recognized: true };
  }

  if ('^$.*+?()[]{}|/\\-'.includes(next)) {
    return { token: pattern.slice(index, index + 2), explanation: `Treats "${next}" as a literal character instead of regex syntax.`, recognized: true };
  }

  return {
    token: pattern.slice(index, index + 2),
    explanation: 'This escape is not explained by the helper; check JavaScript RegExp compatibility and flags.',
    recognized: false,
  };
}

/**
 * Best-effort explanation of common JavaScript RegExp tokens.
 * This is deliberately not a complete parser; unknown syntax is marked for review.
 */
export function explainRegexPattern(pattern: string, flags = ''): RegexTokenExplanation[] {
  const output: RegexTokenExplanation[] = [];
  const unicodeSets = flags.includes('v');
  let index = 0;

  while (index < pattern.length) {
    const character = pattern[index];

    if (character === '\\') {
      const result = explainEscape(pattern, index, flags);
      output.push(tokenExplanation(result.token, result.explanation, result.recognized ? 'escape' : 'unknown', result.recognized));
      index += result.token.length;
      continue;
    }

    if (character === '[') {
      const end = characterClassEnd(pattern, index, unicodeSets);
      const value = end >= 0 ? pattern.slice(index, end + 1) : pattern.slice(index);
      const negated = value[1] === '^';
      output.push(tokenExplanation(
        value,
        end >= 0
          ? `${negated ? 'Matches one character outside' : 'Matches one character inside'} this character class${unicodeSets ? ' (Unicode set mode also supports nested sets and set operators).' : '.'}`
          : 'This character class is not closed, so the pattern is incomplete.',
        end >= 0 ? 'character-class' : 'unknown',
        end >= 0,
      ));
      index += value.length;
      continue;
    }

    if (character === '(') {
      const rest = pattern.slice(index);
      const named = rest.match(/^\(\?<([A-Za-z_$][\w$]*)>/);
      const pythonNamed = rest.match(/^\(\?P<([^>]+)>/);
      let value = '(';
      let explanation = 'Starts a capturing group; its text is available as a numbered capture.';
      let recognized = true;

      if (rest.startsWith('(?:')) {
        value = '(?:';
        explanation = 'Starts a non-capturing group; it groups the expression without adding a capture.';
      }
      else if (rest.startsWith('(?=')) {
        value = '(?=';
        explanation = 'Starts a positive lookahead; the following expression must match here without consuming text.';
      }
      else if (rest.startsWith('(?!')) {
        value = '(?!';
        explanation = 'Starts a negative lookahead; the following expression must not match here.';
      }
      else if (rest.startsWith('(?<=')) {
        value = '(?<=';
        explanation = 'Starts a positive lookbehind; the preceding text must match without being consumed.';
      }
      else if (rest.startsWith('(?<!')) {
        value = '(?<!';
        explanation = 'Starts a negative lookbehind; the preceding text must not match.';
      }
      else if (named) {
        value = named[0];
        explanation = `Starts a named capture group called "${named[1]}".`;
      }
      else if (pythonNamed) {
        value = pythonNamed[0];
        explanation = 'Python-style named groups are not JavaScript RegExp syntax; use (?<name>...) instead.';
        recognized = false;
      }
      else if (rest.startsWith('(?>')) {
        value = '(?>';
        explanation = 'Atomic groups are not supported by JavaScript RegExp.';
        recognized = false;
      }
      else if (rest.startsWith('(?(')) {
        value = '(?(';
        explanation = 'Conditional groups are not supported by JavaScript RegExp.';
        recognized = false;
      }
      else if (rest.startsWith('(?#')) {
        value = '(?#';
        explanation = 'Inline comment groups are not supported by JavaScript RegExp.';
        recognized = false;
      }
      else if (rest.startsWith('(?')) {
        value = '(?';
        explanation = 'This group prefix is not recognized; check JavaScript RegExp compatibility.';
        recognized = false;
      }
      output.push(tokenExplanation(value, explanation, recognized ? 'group' : 'unknown', recognized));
      index += value.length;
      continue;
    }

    if (character === ')') {
      output.push(tokenExplanation(')', 'Ends the current group.', 'group'));
      index += 1;
      continue;
    }

    if (character === '^') {
      output.push(tokenExplanation('^', 'Matches the start of the input, or the start of a line when m is enabled.', 'anchor'));
      index += 1;
      continue;
    }

    if (character === '$') {
      output.push(tokenExplanation('$', 'Matches the end of the input, or the end of a line when m is enabled.', 'anchor'));
      index += 1;
      continue;
    }

    if (character === '.') {
      output.push(tokenExplanation('.', flags.includes('s')
        ? 'Matches any character, including line terminators, because s is enabled.'
        : 'Matches any character except line terminators unless s is enabled.', 'wildcard'));
      index += 1;
      continue;
    }

    if (character === '|') {
      output.push(tokenExplanation('|', 'Alternation: matches the expression on the left or the expression on the right.', 'alternation'));
      index += 1;
      continue;
    }

    const quantifier = pattern.slice(index).match(/^(?:[*+?]|\{\d+(?:,\d*)?\})/);
    if (quantifier) {
      let value = quantifier[0];
      const lazy = pattern[index + value.length] === '?';
      if (lazy) value += '?';
      let explanation = value[0] === '*'
        ? 'Matches the previous token zero or more times.'
        : value[0] === '+'
          ? 'Matches the previous token one or more times.'
          : value[0] === '?'
            ? 'Makes the previous token optional (zero or one time).'
            : `Matches the previous token ${value.slice(1, -1)} times or within that range.`;
      if (lazy) explanation += ' The trailing ? makes this quantifier lazy (prefers fewer characters).';
      output.push(tokenExplanation(value, explanation, 'quantifier'));
      index += value.length;
      continue;
    }

    // Coalesce plain text into readable literal runs.
    let end = index + 1;
    while (end < pattern.length && !'\\.^$|?*+()[]{}'.includes(pattern[end])) {
      end += 1;
    }
    const value = pattern.slice(index, end);
    output.push(tokenExplanation(value, `Matches this literal text: "${value}".`, 'literal'));
    index = end;
  }

  return output;
}

export function explainRegexFlags(flags: string): RegexFlagExplanation[] {
  const descriptions: Record<string, string> = {
    d: 'Includes match and capture indices (used to show exact source ranges).',
    g: 'Finds all matches instead of stopping after the first one.',
    i: 'Ignores letter case when matching.',
    m: 'Makes ^ and $ match the start and end of each line.',
    s: 'Lets . match line terminators as well as other characters.',
    u: 'Enables Unicode code-point mode and Unicode property escapes.',
    v: 'Enables Unicode sets mode, including nested character classes and set operations.',
    y: 'Sticky mode: the next match must start at the current lastIndex.',
  };
  return [...new Set(flags)].map(flag => ({
    flag,
    explanation: descriptions[flag] || 'No explanation is available for this flag.',
  }));
}
