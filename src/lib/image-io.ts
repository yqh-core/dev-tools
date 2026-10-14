/**
 * 浏览器本地图像 IO 原语（零依赖）。
 *
 * 为什么要单独一层：
 *   resize / compress（以及后续 crop、favicon）都是「读文件 → canvas → 编码 → 下载」
 *   同一条管线。PDF 四件套的经验是共享服务层让边际成本远低于各写一遍
 *   （见 src/tools/pdf-merge/pdf-lib.service.ts 的同款注释）。
 *
 * 为什么零依赖：
 *   本项目加第三方包会连带重解析依赖树（pnpm add 曾把 @vueuse/shared 12→15
 *   顶掉 @unhead 的 resolveUnref 导入，构建直接红）。图像这三个能力
 *   原生 canvas 就够，不值得为此引入体积与 lockfile 风险。
 *   需要工业级编解码器（AVIF/JXL/WebP2/oxipng）的是 img 独立站，
 *   那边直接复用 squoosh 的 codec 栈，不在这里半吊子。
 *
 * ⚠ 本文件存在的首要理由之一是 canvas 的**静默回退**：
 *   规范说不支持的类型 toBlob 应返回 null，但 Chrome/Safari/Firefox 实际会
 *   **返回一张 PNG 而不报错**（2026-10-14 本机 Chrome 155 实测：请求
 *   image/avif|gif|bmp|tiff|heic 全部得到 image/png，字节数与 png 完全相同）。
 *   若不探测，用户会拿到扩展名与内容不符的文件。squoosh 作者在同一处踩过，
 *   其 canvasEncodeTest 的注释即为此。这里把探测做成强制入口。
 */

export interface LoadedImage {
  bitmap: ImageBitmap
  width: number
  height: number
};

/**
 * 这些类型是「浏览器能解码且 canvas 能直出」的交集。
 * 刻意不含 svg（createImageBitmap 不接 SVG，需 data-URL + <img> 另一条路）、
 * heic / tiff（浏览器不解码，需 wasm 解码器）、avif 编码（见文件头警告）。
 */
export const ACCEPTED_INPUT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/gif'];

/** 可承诺的输出类型候选；实际可用性由 canvasEncodeTest 逐个探测后裁剪。 */
export const OUTPUT_TYPE_CANDIDATES = [
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/webp', label: 'WebP' },
] as const;

export async function loadImageFromFile(file: File): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file);
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

/**
 * 探测浏览器是否**真的**能把 canvas 编成该类型。
 * 判据是回读 blob.type 是否等于请求类型 —— 只看「有没有返回 blob」会被
 * 静默回退骗过（Chrome 就是那样）。与 squoosh 的 canvasEncodeTest 同构。
 */
export async function canvasEncodeTest(mimeType: string): Promise<boolean> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(b => resolve(b), mimeType, 0.5);
    });
    if (!blob) {
      return false;
    }
    return blob.type === mimeType;
  }
  catch {
    return false;
  }
}

/** 返回当前浏览器真正支持的输出类型（探测失败的一律不呈现给用户）。 */
export async function getSupportedOutputTypes() {
  const probed = await Promise.all(
    OUTPUT_TYPE_CANDIDATES.map(async t => ({ ...t, ok: await canvasEncodeTest(t.value) })),
  );
  return probed.filter(t => t.ok);
}

export function drawToCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('canvas 2d context unavailable');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

/**
 * 高质量缩小：逐步折半再最后一次精调。
 *
 * 为什么不能一次 drawImage 到位：canvas 的双线性采样在**大幅缩小**时会丢像素
 * （出现锯齿与摩尔纹），而浏览器不提供 Lanczos。逐半采样让每一步的缩放比接近 2，
 * 等效于对源图做金字塔降采样，是纯前端能拿到的最好结果。
 * 只用于缩小；放大走 drawToCanvas 即可。
 */
export function resizeHighQuality(
  bitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
): HTMLCanvasElement {
  const downscaling = targetWidth < bitmap.width && targetHeight < bitmap.height;
  if (!downscaling) {
    return drawToCanvas(bitmap, targetWidth, targetHeight);
  }

  let src: CanvasImageSource = bitmap;
  let srcW = bitmap.width;
  let srcH = bitmap.height;

  // 每次至少折半，直到剩余尺寸不超过目标的两倍，再做最后一步精调
  while (srcW / 2 >= targetWidth && srcH / 2 >= targetHeight) {
    const next = drawToCanvas(src, Math.floor(srcW / 2) || 1, Math.floor(srcH / 2) || 1);
    src = next;
    srcW = next.width;
    srcH = next.height;
  }
  return drawToCanvas(src, targetWidth, targetHeight);
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(b => resolve(b), mimeType, quality);
  });
  if (!blob) {
    throw new Error(`encoding failed for ${mimeType}`);
  }
  // 二次防线：即便探测通过，也要确认产物类型与请求一致，否则宁可报错
  // 也不给用户一个扩展名与内容不符的文件。
  if (blob.type !== mimeType) {
    throw new Error(`browser silently returned ${blob.type || 'unknown'} instead of ${mimeType}`);
  }
  return blob;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 扩展名跟随真实编码结果，不跟用户选择（防静默回退时文件名说谎）。 */
export function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg': return 'jpg';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    case 'image/bmp': return 'bmp';
    default: return 'png';
  }
}

/**
 * 把若干 PNG 打包成一个 .ico（Vista+ 的 PNG-in-ICO 变体）。
 *
 * 为什么手写而不是引 zip/ico 库：ICO 结构极小且固定，且引任何依赖当前都会
 * 触发 pnpm 把 @vueuse/shared 12 重解析到 15（实测），CI 又是 frozen-lockfile。
 *
 * 结构：ICONDIR(6B) + N×ICONDIRENTRY(16B) + N×PNG 原始字节。
 * 注意 width/height 字段是 1 字节，256 要写成 0；本实现限制单边 ≤128 以免歧义。
 * 偏移量按**文件绝对位置**计，这是 ICO 最容易写错的地方。
 */
export function buildIco(pngs: { size: number; bytes: Uint8Array }[]): Uint8Array {
  const items = pngs.filter(p => p.size >= 1 && p.size <= 128);
  if (items.length === 0) {
    throw new Error('buildIco: no usable sizes (each must be 1-128 px)');
  }
  const headerSize = 6 + items.length * 16;
  const total = headerSize + items.reduce((n, p) => n + p.bytes.byteLength, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type = icon
  view.setUint16(4, items.length, true);

  let offset = headerSize;
  items.forEach((p, i) => {
    const entry = 6 + i * 16;
    out[entry + 0] = p.size; // width  (0 would mean 256; capped at 128 above)
    out[entry + 1] = p.size; // height
    out[entry + 2] = 0; // palette colors
    out[entry + 3] = 0; // reserved
    view.setUint16(entry + 4, 1, true); // planes
    view.setUint16(entry + 6, 32, true); // bit count
    view.setUint32(entry + 8, p.bytes.byteLength, true);
    view.setUint32(entry + 12, offset, true); // absolute data offset
    out.set(p.bytes, offset);
    offset += p.bytes.byteLength;
  });
  return out;
}
