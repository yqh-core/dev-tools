/**
 * 首页搜索与 `?q=` 的纯函数。
 *
 * SearchAction 的 target 是 `https://digdevbox.com/?q={search_term_string}`。
 * 预渲染阶段不读 query（抓取器应看到完整目录），客户端挂载后再把 `q` 填进搜索框。
 */

export function readSearchParam(query: Record<string, unknown>): string {
  const value = query.q;
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return '';
}

export function applySearchParam(query: Record<string, unknown>, raw: string): Record<string, unknown> {
  const next: Record<string, unknown> = { ...query };
  const q = raw.trim();
  if (q) {
    next.q = q;
  }
  else {
    delete next.q;
  }
  return next;
}
