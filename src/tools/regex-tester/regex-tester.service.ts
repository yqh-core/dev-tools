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


export interface RegexPreset {
  label: string
  pattern: string
  flags: string
  sample: string
}

export const REGEX_PRESETS: RegexPreset[] = [
  {
    label: 'Email address',
    pattern: '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\\\.[A-Z]{2,}
  results: RegexMatch[]
  replacementPreview: string
  sample: string
}

interface RegExpExecArrayWithIndices extends RegExpExecArray {
  indices: Array<[number, number] | undefined> & {
    groups: Record<string, [number, number] | undefined>
  }
}

/** Evaluate a JavaScript RegExp. This function is called inside a dedicated Worker. */
export function matchRegex(regex: string, text: string, flags: string): RegexMatch[] {
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
,
    flags: 'di',
    sample: 'dev@example.com',
  },
  {
    label: 'URL',
    pattern: 'https?:\\\\/\\\\/[^\\\\s]+',
    flags: 'd',
    sample: 'https://example.com/path',
  },
  {
    label: 'IPv4 address',
    pattern: '\\\\b(?:(?:25[0-5]|2[0-4]\\\\d|1?\\\\d?\\\\d)\\\\.){3}(?:25[0-5]|2[0-4]\\\\d|1?\\\\d?\\\\d)\\\\b',
    flags: 'd',
    sample: '192.168.1.42',
  },
  {
    label: 'ISO date format (YYYY-MM-DD)',
    pattern: '\\\\b\\\\d{4}-\\\\d{2}-\\\\d{2}\\\\b',
    flags: 'd',
    sample: '2026-11-23',
  },
];

export interface RegexEvaluation {
  results: RegexMatch[]
  replacementPreview: string
  sample: string
}

interface RegExpExecArrayWithIndices extends RegExpExecArray {
  indices: Array<[number, number] | undefined> & {
    groups: Record<string, [number, number] | undefined>
  }
}

/** Evaluate a JavaScript RegExp. This function is called inside a dedicated Worker. */
export function matchRegex(regex: string, text: string, flags: string): RegexMatch[] {
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
