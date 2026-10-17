export { DEFAULT_ALPHABET, ALPHABET_PRESETS, normalizeAlphabet, clampSize, clampCount, generateId, generateIds, fillRandomValues };

/**
 * Nano ID 风格的随机 ID 生成（纯前端、零依赖）。
 *
 * 为什么不引 nanoid 包
 * ------------------------------------------------------------------
 * 本仓库有硬约束：不新增依赖、不顺手升级依赖树（`@unhead/vue` 把 `@vueuse/*` 声明成
 * `latest`，任何 `pnpm add` 都会重解析 @vueuse 版本并把 CI 的 frozen-lockfile 装红）。
 * 而 nanoid 的核心本来就只是一段「按字符集做无偏取样」的循环，自己写更可控：
 * 字符集、长度、随机源都能注入，测试才能写出真判据（见 test 里的拒绝取样用例）。
 *
 * 无偏取样是怎么保证的
 * ------------------------------------------------------------------
 * 取 bits = ceil(log2(字符集大小))，mask = 2^bits - 1；每个随机字节先 `& mask`，
 * 落在 [0, size) 内才用，**越界的一律丢弃再取下一个**。
 * 常见写法 `byte % size` 在 size 不是 2 的幂时会偏置（例如 size=10 时
 * 0..5 各出现 26 次、6..9 各 25 次），这里靠丢弃避开 —— 测试用「越界字节必须被跳过」
 * 把这件事变成可证伪的判据，而不是注释里的承诺。
 */

const DEFAULT_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

/** 与参照实现同字母表（64 个字符、无重复、URL 安全），保证同族 ID 外观一致。 */
const ALPHABET_PRESETS = [
  { label: 'URL friendly (64)', value: 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict' },
  { label: 'Lowercase + digits (36)', value: '0123456789abcdefghijklmnopqrstuvwxyz' },
  { label: 'Digits only (10)', value: '0123456789' },
  { label: 'Hex (16)', value: '0123456789abcdef' },
  { label: 'Uppercase + digits (36)', value: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
];

const MIN_SIZE = 1;
const MAX_SIZE = 256;
const MIN_COUNT = 1;
const MAX_COUNT = 200;

/** 浏览器端随机源：crypto.getRandomValues（非密码学安全的 Math.random 一律不用）。 */
function fillRandomValues(target: Uint8Array): Uint8Array {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('Web Crypto (crypto.getRandomValues) is unavailable in this browser');
  }
  // getRandomValues 单次最多 65536 字节；这里每次最多要 256*? 字节，远小于上限，仍做切分以防未来放宽。
  let offset = 0;
  while (offset < target.length) {
    const end = Math.min(offset + 65536, target.length);
    c.getRandomValues(target.subarray(offset, end));
    offset = end;
  }
  return target;
}

function normalizeAlphabet(raw: string): string {
  const seen = new Set<string>();
  let out = '';
  for (const ch of raw) {
    if (!seen.has(ch)) {
      seen.add(ch);
      out += ch;
    }
  }
  return out;
}

function clampSize(value: number): number {
  if (!Number.isFinite(value)) {
    return 21;
  }
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.trunc(value)));
}

function clampCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.trunc(value)));
}

/**
 * 生成一个 ID。`random` 可注入（测试用它把随机源变成确定序列），
 * 缺省走 crypto.getRandomValues。
 */
function generateId(size: number, alphabet: string, random?: (n: number) => Uint8Array): string {
  const chars = normalizeAlphabet(alphabet);
  if (chars.length < 2) {
    throw new Error('The alphabet needs at least two distinct characters');
  }
  const n = clampSize(size);

  const bits = Math.ceil(Math.log2(chars.length));
  const mask = (1 << bits) - 1;
  // 每取一个字节最多产出 1 个字符；按 8 倍批量取，越界丢弃后再补，避免一次一调用的开销。
  const draw = random ?? ((need: number) => fillRandomValues(new Uint8Array(need)));

  let id = '';
  let guard = 0;
  while (id.length < n) {
    const bytes = draw(Math.max(8, (n - id.length) * 2 + 8));
    for (let i = 0; i < bytes.length && id.length < n; i++) {
      const value = bytes[i] & mask;
      if (value < chars.length) {
        id += chars[value];
      }
    }
    guard++;
    if (guard > 1000) {
      // 理论上到不了这里（取样拒绝率 < 50%），留着防止随机源退化时死循环。
      throw new Error('Random source looks degenerate: too many rejected samples');
    }
  }
  return id;
}

function generateIds(options: {
  size: number
  count: number
  alphabet: string
  random?: (n: number) => Uint8Array
}): string[] {
  const size = clampSize(options.size);
  const count = clampCount(options.count);
  const chars = normalizeAlphabet(options.alphabet);
  return Array.from({ length: count }, () => generateId(size, chars, options.random));
}
