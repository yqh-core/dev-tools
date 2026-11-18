/**
 * API Studio CLI · 环境文件解析（任务书 §8 C2「Environment 文件/名称」+ C4 CI 凭据注入）。
 *
 * 接受两种格式（fail-closed，不静默修补）：
 *  1. Postman environment v2.1：{ "name": "...", "values": [{ "key","value","enabled","secret"? }] }
 *     —— enabled !== false 的条目进入环境层；secret 条目照常参与替换（引擎报告面已脱敏）。
 *  2. 扁平键值表 { "KEY": "value" }（API Studio 导出/手写的简洁形态）。
 * 命名环境（Newman -e staging 从 Postman 应用存储按名取）在 CLI 不支持：
 *   CLI 无本地变量存储，歧义输入一律 fail-closed（C4：不得偷偷回退任何凭据）。
 */

export type EnvParseResult = { ok: true; name?: string; env: Record<string, string> } | { ok: false; error: string };

export function parseEnvironmentFile(text: string, filename: string): EnvParseResult {
  if (typeof text !== 'string') return { ok: false, error: 'Environment file content must be text.' };
  let doc: unknown;
  try {
    doc = JSON.parse(text.replace(/^\uFEFF/, ''));
  }
  catch (e) {
    return { ok: false, error: `Environment file "${filename}" is not valid JSON: ${String(e instanceof Error ? e.message : e).slice(0, 120)}` };
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, error: `Environment file "${filename}" must be a JSON object (Postman environment v2.1 or flat key-value map).` };
  }
  const obj = doc as Record<string, unknown>;
  // 形态 1：Postman environment v2.1（values 数组）
  if (Array.isArray(obj.values)) {
    const env: Record<string, string> = {};
    for (const entry of obj.values) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return { ok: false, error: `Environment file "${filename}": every values entry must be an object.` };
      }
      const rec = entry as Record<string, unknown>;
      if (rec.enabled === false) continue;
      if (typeof rec.key !== 'string' || rec.key.trim() === '') {
        return { ok: false, error: `Environment file "${filename}": values entries require a non-empty string "key".` };
      }
      env[rec.key] = rec.value === undefined || rec.value === null ? '' : String(rec.value);
    }
    return { ok: true, name: typeof obj.name === 'string' ? obj.name : undefined, env };
  }
  // 形态 2：扁平键值表
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') {
      return { ok: false, error: `Environment file "${filename}": nested values are not supported (flat map or Postman values array only).` };
    }
    env[k] = String(v);
  }
  return { ok: true, env };
}
