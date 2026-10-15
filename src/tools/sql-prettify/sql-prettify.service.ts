import { type FormatOptionsWithLanguage, format as formatSQL } from 'sql-formatter';
import { withDefaultOnError } from '@/utils/defaults';

export { collapseSqlWhitespace, minifySQL };

/**
 * 交替匹配：单引号串 / 双引号串 / 反引号标识符 / 块注释 / 行注释 / 空白。
 * 顺序很关键 —— 字面量与块注释放在最前，才能抢在 `--` 与空白规则之前被整段吃掉，
 * 否则 `'a--b'` 会被当成行注释起点，把后半句连同真实代码一起吞掉。
 */
const TOKEN = /('(?:[^'\\]|\\.)*')|("(?:[^"\\]|\\.)*")|(`(?:[^`\\]|\\.)*`)|(\/\*[\s\S]*?\*\/)|(--[^\n\r]*)|(\s+)/g;

/**
 * 折叠空白；行注释必须先转成块注释，否则把换行折掉之后
 * `-- 注释` 会把它后面本来属于代码的内容一起吃进注释里（这是 SQL 压缩最常见的翻车点）。
 *
 * 注意**不要**在这之后再补一道全局「多空格压一个」的兜底：那道替换看不见 token 边界，
 * 会把 `'a  b   c'` 这种字面量内部的空白也压掉 —— 单元测试就是这么抓到它的。
 * 空白折叠只在下面 ws 分支里做，天然不会产生连续空格。
 */
function collapseSqlWhitespace(input: string): string {
  return input.replace(TOKEN, (match, sq, dq, bt, block, lineComment, ws) => {
    if (sq || dq || bt || block) {
      return match;
    }
    if (lineComment) {
      return `/*${lineComment.slice(2)}*/`;
    }
    if (ws) {
      return ' ';
    }
    return match;
  }).trim();
}

/**
 * SQL 压缩。legacy /legacy/formatsql/ 对外承诺过「SQL查询语句压缩工具」，
 * 本页此前只有美化。做法是先交给 sql-formatter 解析（顺带得到语法校验），
 * 再做上面那套「只折空白、不动字面量与注释内容」的折叠。
 */
function minifySQL(sql: string, options: FormatOptionsWithLanguage): string {
  if (sql.trim() === '') {
    return '';
  }
  return withDefaultOnError(() => collapseSqlWhitespace(formatSQL(sql, options)), '');
}
