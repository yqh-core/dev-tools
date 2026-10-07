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
  faqs?: { q: string; a: string }[]
  /**
   * 配套的 forge-notes 文章（notes.digdevbox.com）—— 工具 ↔ 文章的**正向**一半。
   *
   * 为什么放在 guides 而不是 clusters：clusters 是「同任务簇的工具互链」，
   * 这里是「工具页 → 站群另一站的文章」这条跨站链路，粒度与消费方都不同。
   *
   * 为什么要数据化而不是在模板里写死：这是**双向绑定**的另一半 —— 首页 Blog
   * 区块从这里的 `relatedNotes` 反向聚合生成（`src/pages/Home.page.vue`）。
   * 一处数据、两处消费 ⇒ 新文章只要在某个工具的 `relatedNotes` 加一条，
   * 工具页与首页同时出现，不存在「只改了一处」的静默失效。
   *
   * ## 硬约束
   * - ⛔ 只给开发相关的工具加（JSON/JWT/Base64/UUID/ULID/Regex/Date/DevOps/Hash/
   *   HTTP），⛔ 不要给 101 个全加（那是无意义工作量，也会让工具页变成链接农场）。
   * - ⛔ `slug` 必须是 `src/seo/keyword-map.ts` 的 `KNOWN_NOTE_SLUGS` 里的真实
   *   slug —— forge-notes 在本仓库之外，拼错查不出来，只会在生产上变成 404 外链。
   * - ⛔ 只收英文文章（`lang: en`）。英文主站不能把 17 篇中文 AdSense /
   *   跨境电商 / SEO 文章混进正文与首页。
   * - ⛔ `title` / `description` 必须与 forge-notes frontmatter **逐字一致**
   *   （G-03 裁定④红线，防止「首页标题 ≠ 文章标题」的 SEO 信号分裂），
   *   由 `auditToolSeoData` + `audit-keyword-map.mjs --frontmatter` 双重把关。
   * - en / zh 必须成对出现且条数一致（`auditToolSeoData` 强制校验）。
   */
  relatedNotes?: ToolRelatedNote[]
}

/**
 * 一条「工具页 → 站外文章」的引用。
 *
 * `title` / `description` / `url` 全部是**从文章 frontmatter 抄下来的**既有真实数据，
 * 本仓库不生产任何新文案（与 guides 的 intro/about 同一纪律）。
 */
export interface ToolRelatedNote {
  /** forge-notes 文章 slug（`docs/posts/<slug>.md` 的文件名去掉 .md）。 */
  slug: string
  /** 文章标题，与 frontmatter `title` 逐字一致。 */
  title: string
  /** 文章摘要，与 frontmatter `description` 逐字一致。首页 Blog 卡片复用它。 */
  description: string
  /** 文章绝对 URL，形如 `https://notes.digdevbox.com/posts/<slug>`（⛔ 不带 query）。 */
  url: string
  /**
   * 人工派生的主题标签（如 `JWT` / `JSON` / `DevOps`）。
   *
   * ⛔ 不要试图用 frontmatter 的 `tags` 自动推断：实测部分文章的 `tags` 为空，
   *   且 `Home.page.vue` 里原先的 `tag: 'JWT'` 本来就是人工写的。
   *   这里延续「人工指定」而不是假装能自动派生。
   */
  tag: string
}
