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
  /**
   * 「{name} 是什么」—— 知识型背景说明（概念、原理、适用场景）。
   *
   * 与 intro 的分工：intro 说「这个工具能帮你干什么」，about 说「这个东西本身是什么」。
   * 只写给有真实知识增量可讲的工具，宁缺勿滥（可选字段就是为此）。
   * en / zh 必须成对出现（auditToolSeoData 强制校验）。
   */
  about?: string
  /**
   * 常见问题。只收真实高频的问题（工具本身容易用错、容易误解的点），
   * 不为凑 FAQ 数量编造问题——那是低价值内容政策的典型形态。
   * en / zh 必须成对出现（auditToolSeoData 强制校验）。
   */
  faqs?: { q: string, a: string }[]
}
