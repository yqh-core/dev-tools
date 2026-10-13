/**
 * pdf-lib v1.17.1 vendored 类型声明（最小面，只覆盖 pdf-lib.service.ts 消费的 API）。
 * 完整类型见官方仓库 src/types —— vendor 文件本身是 min.js 无类型。
 */
declare module '@/lib/pdf-lib.esm.min.js' {
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
    getSize(): { width: number; height: number }
  }
  export interface PDFFont { /** opaque handle */ }
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
    save(options?: { useObjectStreams?: boolean }): Promise<Uint8Array>
  }
  export type StandardFonts = string
  export function rgb(red: number, green: number, blue: number): RGB
  export function degrees(angle: number): { type: 'degrees'; angle: number }
  export const StandardFonts: Record<string, StandardFonts> & {
    Helvetica: StandardFonts
    HelveticaBold: StandardFonts
  }
}
