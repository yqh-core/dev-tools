/**
 * pdf-lib 共享封装 —— merge / split / watermark 三工具的唯一 PDF 引擎入口。
 *
 * 为什么单独一层：
 *   - pdf-lib 是 525KB 的重依赖，vite 动态 import 按需分包，本文件是分包边界；
 *   - 三工具共享同一份 ArrayBuffer→PDFDocument 加载与保存路径，避免三处各写一遍。
 *
 * 全部纯浏览器端（隐私纪律：文件不离开本机，与站点 Privacy 声明一致）。
 */
// pdf-lib vendored ESM（src/lib/pdf-lib.esm.min.js, v1.17.1, MIT）。vendor 原因：pnpm add 会连带
// 把 @vueuse/shared 12→15 重解析（'latest' 依赖声明），打破 @unhead/vue 的 resolveUnref 导入。
// pdf-lib 无第三方依赖，vendor 零 lockfile 影响。升级 = 替换该文件 + 同步 LICENSE。
import type { PDFPage } from '@/lib/pdf-lib.esm.min.js';
import { PDFDocument, StandardFonts, degrees, rgb } from '@/lib/pdf-lib.esm.min.js';

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
