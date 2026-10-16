/**
 * meta 标签产物的合法性修正。
 *
 * 为什么要这一层（实测，不是猜测）
 *   @it-tools/oggen@1.3.0 生成的标签把内容写在 `value=` 上：
 *     <meta property="og:title" value="T" />
 *   而 HTML 规范里 <meta> 的内容属性是 **content=**。也就是说这页产出的代码原样贴进
 *   网页是不生效的 —— 而这页唯一的用途就是产出可复制粘贴的 meta 标签。
 *   冒烟抓不到：它只断言"输出区有内容"，不校验产物语义。
 *
 * 边界
 *   只替换 `<meta` 标签内的第一个 ` value=`。`[^>]*?` 不允许跨过 `>`，所以一次匹配
 *   锁定一个标签；即使某个 content 值里真的含 "value=" 字样也不会被二次替换
 *   （下一次扫描位置已在该 value 之后，且标签开头的 `<meta` 已被消耗）。
 *   twitter 与 og 两种前缀都走同一条规则，因为它们都是 <meta>。
 */
function toValidMetaMarkup(generated: string): string {
  // 内外两处都要 i：外层负责大小写混写的标签，内层负责替换属性名本身。
  // 只漏一处就会静默留下 `VALUE=`，而 HTML 属性名解析虽然不区分大小写，
  // `VALUE` 也不是合法属性 —— 这类"一半修好了"比完全没修更容易骗过肉眼。
  return generated.replace(/<meta\b[^>]*?\svalue=/gi,
    m => m.replace(/\svalue=$/i, ' content='));
}

export { toValidMetaMarkup };
