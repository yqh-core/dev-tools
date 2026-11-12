/**
 * cURL 命令解析器（WP-003 阶段 B · WS-1 入口，零依赖纯函数）。
 *
 * 纪律：支持的子集明确；**未知 flag 报错列出**（不静默跳过冒充解析成功）；
 * 忽略类 flag（-s/-v/-k/-L 等）进 warnings 如实告知；@file 引用不支持（浏览器无本地文件语义）。
 * 支持：-X/--request、-H/--header、-d/--data/--data-raw/--data-binary、--json、
 *       -u/--user、-A/--user-agent、-e/--referer、-b/--cookie、--url、单双引号与行续接。
 */

export interface CurlHeader { name: string; value: string }
export interface CurlRequest { method: string; url: string; headers: CurlHeader[]; body: string }
export type CurlParseResult = { ok: true; request: CurlRequest; warnings: string[] } | { ok: false; error: string };

const IGNORED_FLAGS = new Set(['-s', '-S', '-i', '-v', '--silent', '--show-error', '--include', '--verbose', '-k', '--insecure', '-L', '--location', '--compressed', '-#', '--progress-bar']);
const VALUE_FLAGS = new Set(['-X', '--request', '-H', '--header', '-d', '--data', '--data-raw', '--data-binary', '--json', '-u', '--user', '-A', '--user-agent', '-e', '--referer', '-b', '--cookie', '--url', '-o', '--output', '--max-time', '-m', '--connect-timeout']);
const UNSUPPORTED_VALUE_FLAGS = new Set(['-o', '--output', '--max-time', '-m', '--connect-timeout', '-F', '--form', '--form-string', '-T', '--upload-file']);

/** shell 风格分词：单引号全字面、双引号允许 \\ 与 \" 转义、反斜杠行续接。 */
export function tokenizeCurl(input: string): string[] {
  const src = input.replace(/\\\r?\n/g, ' ');
  const tokens: string[] = [];
  let cur = '';
  let has = false;
  let i = 0;
  const push = () => {
    if (has) {
      tokens.push(cur);
      cur = '';
      has = false;
    }
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '\'') {
      has = true;
      i++;
      while (i < src.length && src[i] !== '\'') {
        cur += src[i];
        i++;
      }
      if (i >= src.length) {
        throw new Error('Unterminated single quote');
      }
      i++;
      continue;
    }
    if (c === '"') {
      has = true;
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < src.length && (src[i + 1] === '"' || src[i + 1] === '\\')) {
          cur += src[i + 1];
          i += 2;
          continue;
        }
        cur += src[i];
        i++;
      }
      if (i >= src.length) {
        throw new Error('Unterminated double quote');
      }
      i++;
      continue;
    }
    if (c === '\\' && i + 1 < src.length) {
      has = true;
      cur += src[i + 1];
      i += 2;
      continue;
    }
    if (/\s/.test(c)) {
      push();
      i++;
      continue;
    }
    has = true;
    cur += c;
    i++;
  }
  push();
  return tokens;
}

export function parseCurl(input: string): CurlParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: 'Empty cURL command.' };
  }
  if (!/^curl\b/i.test(trimmed)) {
    return { ok: false, error: 'Not a cURL command (must start with "curl").' };
  }

  let tokens: string[];
  try {
    tokens = tokenizeCurl(trimmed);
  }
  catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const warnings: string[] = [];
  const headers: CurlHeader[] = [];
  const dataParts: string[] = [];
  let method = '';
  let url = '';
  let jsonMode = false;

  const takeValue = (flag: string, idx: number): { value: string; next: number } | { error: string } => {
    const t = tokens[idx];
    const eq = t.indexOf('=');
    if (t.startsWith('--') && eq > 2) {
      return { value: t.slice(eq + 1), next: idx + 1 };
    }
    if (idx + 1 >= tokens.length) {
      return { error: `Flag ${flag} requires a value.` };
    }
    return { value: tokens[idx + 1], next: idx + 2 };
  };

  let i = 1;
  while (i < tokens.length) {
    const t = tokens[i];
    const bare = t.startsWith('--') && t.includes('=') ? t.slice(0, t.indexOf('=')) : t;
    if (IGNORED_FLAGS.has(bare)) {
      warnings.push(`Ignored ${bare} (the proxy manages redirects/TLS/verbosity).`);
      i++;
      continue;
    }
    if (UNSUPPORTED_VALUE_FLAGS.has(bare)) {
      const v = takeValue(bare, i);
      if ('error' in v) {
        return { ok: false, error: v.error };
      }
      if (bare === '-o' || bare === '--output' || bare === '-T' || bare === '--upload-file' || bare === '-F' || bare === '--form' || bare === '--form-string') {
        return { ok: false, error: `Flag ${bare} is not supported (file upload / local output have no browser semantics).` };
      }
      warnings.push(`Ignored ${bare} (the proxy uses a fixed 12s timeout).`);
      i = v.next;
      continue;
    }
    if (VALUE_FLAGS.has(bare)) {
      const v = takeValue(bare, i);
      if ('error' in v) {
        return { ok: false, error: v.error };
      }
      const val = v.value;
      i = v.next;
      if (bare === '-X' || bare === '--request') {
        method = val.toUpperCase();
      }
      else if (bare === '-H' || bare === '--header') {
        const colon = val.indexOf(':');
        if (colon <= 0) {
          return { ok: false, error: `Header must be "Name: value", got: ${val.slice(0, 40)}` };
        }
        headers.push({ name: val.slice(0, colon).trim(), value: val.slice(colon + 1).trim() });
      }
      else if (bare === '-d' || bare === '--data' || bare === '--data-raw' || bare === '--data-binary') {
        if (val.startsWith('@')) {
          return { ok: false, error: 'Data @file references are not supported in the browser.' };
        }
        dataParts.push(val);
      }
      else if (bare === '--json') {
        if (val.startsWith('@')) {
          return { ok: false, error: 'Data @file references are not supported in the browser.' };
        }
        dataParts.push(val);
        jsonMode = true;
      }
      else if (bare === '-u' || bare === '--user') {
        headers.push({ name: 'Authorization', value: `Basic ${btoa(val)}` });
      }
      else if (bare === '-A' || bare === '--user-agent') {
        headers.push({ name: 'User-Agent', value: val });
      }
      else if (bare === '-e' || bare === '--referer') {
        headers.push({ name: 'Referer', value: val });
      }
      else if (bare === '-b' || bare === '--cookie') {
        headers.push({ name: 'Cookie', value: val });
      }
      else if (bare === '--url') {
        url = val;
      }
      continue;
    }
    if (t.startsWith('-')) {
      return { ok: false, error: `Unknown flag ${t}. Supported: -X -H -d --data-raw --json -u -A -e -b --url.` };
    }
    if (!url) {
      url = t;
    }
    else {
      warnings.push('Multiple URLs found; only the first is used.');
    }
    i++;
  }

  if (!url) {
    return { ok: false, error: 'No URL found in the cURL command.' };
  }
  const body = dataParts.join('&');
  if (!method) {
    method = body !== '' || jsonMode ? 'POST' : 'GET';
  }
  if (jsonMode) {
    headers.push({ name: 'Content-Type', value: 'application/json' });
    headers.push({ name: 'Accept', value: 'application/json' });
  }
  else if (body !== '' && !headers.some(h => h.name.toLowerCase() === 'content-type')) {
    headers.push({ name: 'Content-Type', value: 'application/x-www-form-urlencoded' });
  }
  return { ok: true, request: { method, url, headers, body }, warnings };
}

/** 请求状态 → cURL 命令（单引号安全转义）。分享前请先 sanitizeForShare。 */
export function toCurl(req: { method: string; url: string; headers: CurlHeader[]; body: string }): string {
  const q = (s: string) => `'${s.replace(/'/g, '\'\\\'\'')}'`;
  const parts = ['curl'];
  if (req.method !== 'GET') {
    parts.push('-X', req.method);
  }
  parts.push(q(req.url));
  for (const h of req.headers) {
    if (h.name.trim()) {
      parts.push('-H', q(`${h.name}: ${h.value}`));
    }
  }
  if (req.body !== '') {
    parts.push('-d', q(req.body));
  }
  return parts.join(' ');
}
