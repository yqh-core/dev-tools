import type { Ref } from 'vue';

export {
  mimeForLanguage,
  buildDownloadFilename,
  downloadTextFile,
  useDownloadTextFile,
};

/**
 * 文本文件下载 —— 与 `downloadBase64` 平行，但面向「已经是纯文本」的产物
 * （CSV / JSON / XML / YAML / TOML 这些格式互转工具的输出）。
 *
 * 为什么单独开这个文件
 * ------------------------------------------------------------------
 * `downloadBase64` 处理的是「手里只有一串 base64、需要还原成二进制」的图片 / PDF /
 * docker-compose 那类。格式互转工具的输出本来就是文本，硬转成 base64 data URI
 * 既绕（多一次编码）又容易在换行、编码上出错。这里直接用 Blob + object URL，
 * 是所有「复制或下载」链路里下载那一半的**唯一实现**，避免每个工具各写一遍
 * `document.createElement('a')` 然后各自漏掉 revokeObjectURL（内存泄漏）或漏掉
 * 文件名清洗（跨平台非法字符）。
 */

/** 语言 / 产物类型 → 下载用的 MIME。未命中回落到 text/plain。 */
const MIME_BY_LANGUAGE: Record<string, string> = {
  json: 'application/json',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  xml: 'application/xml',
  html: 'text/html',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  toml: 'application/toml',
  txt: 'text/plain',
  md: 'text/markdown',
  sql: 'application/sql',
};

function mimeForLanguage(language?: string): string {
  if (!language) {
    return 'text/plain';
  }
  return MIME_BY_LANGUAGE[language.toLowerCase()] ?? 'text/plain';
}

/**
 * 拼一个跨平台安全、且一定带正确扩展名的下载文件名。
 * 规则：
 *  - 去掉路径分隔符与控制字符，防止把 `../../x` 或 `a/b` 直接当成文件名；
 *  - 没有有效名字时回落到 `defaultName`；
 *  - 结尾没带 `.ext` 时补上，带扩展名但用户写的名里已含点也不会重复补。
 */
function buildDownloadFilename(rawName: string | undefined, extension: string, defaultName = 'download'): string {
  const cleaned = (rawName ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '')
    .trim();

  const base = cleaned === '' ? defaultName : cleaned;
  const ext = extension.startsWith('.') ? extension : `.${extension}`;

  return base.toLowerCase().endsWith(ext.toLowerCase()) ? base : `${base}${ext}`;
}

/**
 * 触发一次浏览器下载。空内容直接 no-op 返回 false，
 * 免得产出一个 0 字节的文件让用户以为「下载了但坏了」。
 */
function downloadTextFile({
  content,
  filename,
  mimeType = 'text/plain',
}: {
  content: string
  filename: string
  mimeType?: string
}): boolean {
  if (content === '') {
    return false;
  }

  // \n 起头的 CSV/JSON 在记事本里会被吞掉首行；多数浏览器已经处理，
  // 这里不加 BOM，保持和页面复制出来的字节完全一致（所见即所下）。
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return true;
}

function useDownloadTextFile({
  source,
  filename,
  language,
  mimeType,
}: {
  source: Ref<string>
  filename: string | Ref<string>
  language?: string | Ref<string>
  mimeType?: string
}) {
  return {
    download(): boolean {
      const resolvedLanguage = unrefSafe(language);
      const effectiveMime = mimeType ?? mimeForLanguage(resolvedLanguage);
      const ext = resolvedLanguage ?? 'txt';
      return downloadTextFile({
        content: source.value,
        filename: buildDownloadFilename(unrefSafe(filename), ext),
        mimeType: effectiveMime,
      });
    },
  };
}

function unrefSafe<T>(value: T | Ref<T> | undefined): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  // 只在这里判断 ref，避免把 @vueuse 的 toValue 依赖拉进这个纯工具文件
  return isRefLike(value) ? (value as Ref<T>).value : (value as T);
}

function isRefLike(value: unknown): boolean {
  return typeof value === 'object' && value !== null && '__v_isRef' in value;
}
