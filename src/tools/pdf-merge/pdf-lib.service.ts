/**
 * pdf-lib 共享封装 —— merge / split / watermark / compress 四工具的唯一 PDF 引擎入口。
 *
 * 为什么单独一层：
 *   - pdf-lib 是 525KB 的重依赖，vite 动态 import 按需分包，本文件是分包边界；
 *   - 四工具共享同一份 ArrayBuffer→PDFDocument 加载与保存路径，避免各写一遍。
 *
 * 全部纯浏览器端（隐私纪律：文件不离开本机，与站点 Privacy 声明一致）。
 */
// pdf-lib vendored ESM（src/lib/pdf-lib.esm.min.js, v1.17.1, MIT）。vendor 原因：pnpm add 会连带
// 把 @vueuse/shared 12→15 重解析（'latest' 依赖声明），打破 @unhead/vue 的 resolveUnref 导入。
// pdf-lib 无第三方依赖，vendor 零 lockfile 影响。升级 = 替换该文件 + 同步 LICENSE。
import type { PDFPage, PDFRef } from '@/lib/pdf-lib.esm.min.js';
import { PDFDocument, PDFName, PDFNumber, PDFRawStream, StandardFonts, degrees, rgb } from '@/lib/pdf-lib.esm.min.js';

export async function loadPdf(bytes: ArrayBuffer): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { ignoreEncryption: true });
}

export async function savePdf(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true });
}

/** 合并：files 按传入顺序拼接。返回合并后的 PDF 字节。 */
export async function mergePdfs(files: ArrayBuffer[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const bytes of files) {
    const src = await loadPdf(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p: PDFPage) => merged.addPage(p));
  }
  return savePdf(merged);
}

/**
 * 拆分：
 *   - mode 'each'：每页一个 PDF，返回 [name, bytes][]；
 *   - mode 'range'：按页码范围（1 起含端）提取为一个 PDF。range 为空时等价于 each 的整档单输出。
 */
export async function splitPdf(
  bytes: ArrayBuffer,
  mode: 'each' | 'range',
  range?: { from: number; to: number },
): Promise<{ name: string; bytes: Uint8Array }[]> {
  const src = await loadPdf(bytes);
  const total = src.getPageCount();

  if (mode === 'range' && range) {
    const from = Math.max(1, Math.min(range.from, total));
    const to = Math.max(from, Math.min(range.to, total));
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i));
    pages.forEach(p => out.addPage(p));
    return [{ name: `pages-${from}-${to}.pdf`, bytes: await savePdf(out) }];
  }

  const results: { name: string; bytes: Uint8Array }[] = [];
  for (let i = 0; i < total; i++) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [i]);
    out.addPage(page);
    results.push({ name: `page-${i + 1}.pdf`, bytes: await savePdf(out) });
  }
  return results;
}

/** 水印选项：文字 / 字号 / 透明度 / 角度 / 平铺（默认对角单行；tile 时网格覆盖） */
export interface WatermarkOptions {
  text: string
  fontSize?: number
  opacity?: number
  angle?: number
  tile?: boolean
}

/** 水印：每页绘制旋转文字水印。返回新 PDF 字节（不改源档）。 */
export async function watermarkPdf(
  bytes: ArrayBuffer,
  opts: WatermarkOptions,
): Promise<Uint8Array> {
  const { text, fontSize = 48, opacity = 0.18, angle = 45, tile = false } = opts;
  const doc = await loadPdf(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const color = rgb(0.5, 0.5, 0.5);

  doc.getPages().forEach((page: PDFPage) => {
    const { width, height } = page.getSize();
    if (tile) {
      // 网格平铺：步长按字号估，覆盖整页
      const stepX = Math.max(140, text.length * fontSize * 0.35);
      const stepY = Math.max(100, fontSize * 2.2);
      for (let y = -stepY; y < height + stepY; y += stepY) {
        for (let x = -stepX; x < width + stepX; x += stepX) {
          page.drawText(text, { x, y, size: fontSize, font, color, opacity, rotate: degrees(angle) });
        }
      }
    }
    else {
      page.drawText(text, {
        x: width * 0.5 - text.length * fontSize * 0.2,
        y: height * 0.35,
        size: fontSize,
        font,
        color,
        opacity,
        rotate: degrees(angle),
      });
    }
  });

  return savePdf(doc);
}

/** 页数查询（split 工具显示总页数用） */
export async function pageCount(bytes: ArrayBuffer): Promise<number> {
  return (await loadPdf(bytes)).getPageCount();
}

/* ============================ compress ============================ */

/** 压缩档位：balanced 保真优先；strong 减重优先（更低的 JPEG 质量与像素上限） */
export type CompressLevel = 'balanced' | 'strong';

export interface CompressResult {
  bytes: Uint8Array
  originalSize: number
  compressedSize: number
  /** 扫描到的 JPEG（DCTDecode）图像对象数 */
  imagesScanned: number
  /** 实际被替换（且确实变小）的图像数 */
  imagesOptimized: number
  /** true = 输出不比输入小（文本/矢量型 PDF 常见），此时 bytes 即原文件回传 */
  alreadyOptimal: boolean
}

export interface RecompressedImage {
  bytes: Uint8Array
  width: number
  height: number
}

/** 注入点：解码 JPEG → 缩放 → 重编码；失败或环境不支持时返回 null（该图跳过） */
export type ImageRecompressor =
  (jpeg: Uint8Array, maxDim: number, quality: number) => Promise<RecompressedImage | null>;

const COMPRESS_PRESETS: Record<CompressLevel, { maxDim: number; quality: number }> = {
  balanced: { maxDim: 1800, quality: 0.72 },
  strong: { maxDim: 1200, quality: 0.5 },
};

/**
 * 浏览器端默认实现：createImageBitmap 解码 → canvas 缩放 → toBlob 重编码。
 * 无这些 API 的环境（Node 单测）返回 null，让 compressPdf 退化为纯结构优化。
 */
export const browserJpegRecompressor: ImageRecompressor = async (jpeg, maxDim, quality) => {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return null;
  }
  try {
    const bitmap = await createImageBitmap(new Blob([jpeg as BlobPart], { type: 'image/jpeg' }));
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) {
      return null;
    }
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
  }
  catch {
    // CMYK JPEG / 损坏流等解码失败：跳过该图，不影响其余压缩
    return null;
  }
};

/**
 * 压缩 PDF —— 两笔收益，都无损于"文件不变大"这一底线：
 *   1) 图像层：逐个替换 DCTDecode(JPEG) 图像流为更低质量/更小像素的重编码版本；
 *      FlateDecode 图像与带 SMask 的透明图跳过（无法安全处理）。
 *   2) 结构层：load+save 重序列化（useObjectStreams）天然丢弃增量更新遗留的孤儿对象、
 *      合并交叉引用表——对反复编辑/邮件转发过的 PDF 收益明显。
 * 若整体输出不小于输入，回传原始字节（alreadyOptimal），用户永远不亏。
 */
export async function compressPdf(
  bytes: ArrayBuffer,
  level: CompressLevel,
  recompressor: ImageRecompressor = browserJpegRecompressor,
): Promise<CompressResult> {
  const doc = await loadPdf(bytes);
  const preset = COMPRESS_PRESETS[level];
  let imagesScanned = 0;
  let imagesOptimized = 0;

  // 先收集替换再写入：遍历 context 时改结构不安全
  const replacements: { ref: PDFRef; stream: PDFRawStream }[] = [];
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) {
      continue;
    }
    if (obj.dict.get(PDFName.of('Subtype'))?.toString() !== '/Image') {
      continue;
    }
    if (obj.dict.get(PDFName.of('Filter'))?.toString() !== '/DCTDecode') {
      continue;
    }
    if (obj.dict.get(PDFName.of('SMask'))) {
      continue;
    }
    imagesScanned += 1;
    const out = await recompressor(obj.contents, preset.maxDim, preset.quality);
    // 只收"确实变小 ≥5%"的替换，防止噪声性重写反而增大
    if (!out || out.bytes.byteLength >= obj.contents.byteLength * 0.95) {
      continue;
    }
    const dict = obj.dict.clone();
    dict.set(PDFName.of('Width'), PDFNumber.of(out.width));
    dict.set(PDFName.of('Height'), PDFNumber.of(out.height));
    replacements.push({ ref, stream: new PDFRawStream(dict, out.bytes) });
    imagesOptimized += 1;
  }
  for (const { ref, stream } of replacements) {
    doc.context.assign(ref, stream);
  }

  const saved = await savePdf(doc);
  if (saved.byteLength >= bytes.byteLength) {
    return {
      bytes: new Uint8Array(bytes),
      originalSize: bytes.byteLength,
      compressedSize: bytes.byteLength,
      imagesScanned,
      imagesOptimized,
      alreadyOptimal: true,
    };
  }
  return {
    bytes: saved,
    originalSize: bytes.byteLength,
    compressedSize: saved.byteLength,
    imagesScanned,
    imagesOptimized,
    alreadyOptimal: false,
  };
}

/* ============================ images → pdf ============================ */

/** 一张待嵌入的图像：字节 + 真实像素尺寸（尺寸由调用方用 createImageBitmap 取，不靠猜）。 */
export interface PdfImageInput {
  bytes: Uint8Array
  mime: string
  width: number
  height: number
}

/**
 * 多图合成 PDF：每张一页，页面尺寸取图像像素（1px = 1pt），可选白边。
 *
 * 只直接接受 JPEG 与 PNG：pdf-lib 对 JPEG 是**原样嵌入**（DCTDecode 流逐字节不变，
 * 实测产物里能找到源文件中段 4KB 连续命中），对 PNG 是**无损但换封装**
 * （解码后按 PDF 的无损编码存，画质不损失；实测源 PNG 的原始字节不在产物里）。
 * 其余格式由调用方先用 canvas 转成 PNG 再进来（canvas 编 PNG 是真支持的，
 * 见 src/lib/image-io.ts 的探测结论）。
 */
export async function imagesToPdf(images: PdfImageInput[], marginPt = 0): Promise<Uint8Array> {
  if (images.length === 0) {
    throw new Error('no images to embed');
  }
  const doc = await PDFDocument.create();
  for (const img of images) {
    let embedded;
    if (img.mime === 'image/jpeg') {
      embedded = await doc.embedJpg(img.bytes);
    }
    else if (img.mime === 'image/png') {
      embedded = await doc.embedPng(img.bytes);
    }
    else {
      throw new Error(`unsupported image mime for direct embedding: ${img.mime}`);
    }
    const pageW = img.width + marginPt * 2;
    const pageH = img.height + marginPt * 2;
    const page = doc.addPage([pageW, pageH]);
    page.drawImage(embedded, { x: marginPt, y: marginPt, width: img.width, height: img.height });
  }
  // 这里刻意关掉对象流（上面 merge 那条路径留着对象流是有意义的：它重序列化已有文档）。
  // 理由一：图片型 PDF 的体积由图像流决定，实测 2 页夹具开/关对象流只差 588 B
  //   （1200×630 JPEG + 1×1 PNG，76719 vs 77307），对本工具动辄几 MB 的产物是噪声。
  // 理由二：关掉之后页对象与 MediaBox 才是明文，冒烟门禁才能直接断言「N 张图 = N 页、
  //   页尺寸 = 图像尺寸 + 边距」——本工具的核心契约。对象流开着时这些全被压进流里。
  //   顺带一个实测坑：带 alpha 的 PNG 会被 pdf-lib 拆成图像 + SMask 两个 XObject，
  //   所以数 /Subtype /Image 不等于页数，必须数 /Type /Page 再减去 /Type /Pages。
  return doc.save({ useObjectStreams: false });
}
