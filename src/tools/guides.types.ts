/**
 * 使用说明的数据结构。
 *
 * 为什么单独成文件
 * ------------------------------------------------------------------
 * 英文（guides.en.ts）与中文（guides.zh.ts）都要 import 这个类型；
 * 若把类型留在 guides.ts，而 guides.ts 又要动态 import 两份数据，
 * 就会在类型层形成循环引用。抽出来两边都能干净地引用。
 */

export interface ToolGuide {
  /** 一句话说清这工具干什么、什么时候该用它 */
  intro: string
  /** 操作步骤 */
  steps: string[]
  /** 注意事项 / 常见坑 */
  notes?: string[]
  /** 一键示例：点按钮后把 text 填进页面第一个输入框 */
  example?: {
    /** 按钮文案 */
    label: string
    /** 要填入的内容 */
    text: string
  }
}
