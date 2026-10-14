/**
 * pdf-lib v1.17.1 vendored 类型声明（最小面，只覆盖 pdf-lib.service.ts 消费的 API）。
 * 完整类型见官方仓库 src/types —— vendor 文件本身是 min.js 无类型。
 */
declare module '@/lib/pdf-lib.esm.min.js' {
  /** 任意可 toString 的 PDF 元素（低层遍历里 dict.get 的返回值形态） */
  export interface PDFElementLike {
    toString(): string
  }
  export interface PDFName extends PDFElementLike {}
  export interface PDFNumber extends PDFElementLike {}
  export interface PDFRef extends PDFElementLike {}
  export const PDFName: { of(name: string): PDFName }
  export const PDFNumber: { of(n: number): PDFNumber }
  export interface PDFDict {
    get(key: PDFName): PDFElementLike | undefined
    set(key: PDFName, value: PDFElementLike): PDFDict
    clone(): PDFDict
  }
  export class PDFRawStream {
    constructor(dict: PDFDict, contents: Uint8Array)
    readonly dict: PDFDict
    readonly contents: Uint8Array
  }
  export interface PDFContext {
    enumerateIndirectObjects(): Iterable<[PDFRef, unknown]>
    assign(ref: PDFRef, object: unknown): PDFRef
  }
  export interface PDFPage {
    drawText(text: string, options: {
      x: number
      y: number
      size?: number
      font?: PDFFont
      color?: RGB
      opacity?: number
      rotate?: { type: 'degrees'; angle: number }
    }): void
    drawImage(image: PDFImage, options: { x: number; y: number; width: number; height: number }): void
    getSize(): { width: number; height: number }
  }
  export interface PDFFont { /** opaque handle */ }
  export interface PDFImage { /** opaque handle */ }
  export interface RGB { red: number; green: number; blue: number }
  export declare class PDFDocument {
    static create(): Promise<PDFDocument>
    static load(bytes: ArrayBuffer | Uint8Array, options?: { ignoreEncryption?: boolean }): Promise<PDFDocument>
    getPageCount(): number
    getPageIndices(): number[]
    getPage(index: number): PDFPage
    getPages(): PDFPage[]
    addPage(page?: PDFPage | [number, number]): PDFPage
    copyPages(src: PDFDocument, indices: number[]): Promise<PDFPage[]>
    embedFont(font: StandardFonts): Promise<PDFFont>
    embedJpg(jpg: Uint8Array): Promise<PDFImage>
    /**
     * PNG 嵌入。声明补记于 2026-10-14：运行时确实存在
     * （用 1×1 PNG 实测 embedPng → save() 得到 %PDF- 头、930 字节），
     * 此前 d.ts 只是漏声明，不是库缺能力。
     */
    embedPng(png: Uint8Array): Promise<PDFImage>
    save(options?: { useObjectStreams?: boolean }): Promise<Uint8Array>
    /** 低层对象上下文（compress 遍历/替换图像流用；pdf-lib 运行时公开属性） */
    readonly context: PDFContext
  }
  export type StandardFonts = string
  export function rgb(red: number, green: number, blue: number): RGB
  export function degrees(angle: number): { type: 'degrees'; angle: number }
  export const StandardFonts: Record<string, StandardFonts> & {
    Helvetica: StandardFonts
    HelveticaBold: StandardFonts
  }
}
