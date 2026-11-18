/**
 * 下线工具 → 最近的仍在线上的工具。
 *
 * 这些路径不再注册、不再预渲染、不再进 sitemap。
 * `public/_redirects` 用 301 把旧地址（含指南页）指到目标工具。
 * guides 里的旧条目保留，避免为了下线去改写 80 多篇说明；
 * `auditToolSeoData` 把这里的 path 视为已退休，而不是「说明和路由对不上」。
 */
export const RETIRED_REDIRECTS: Record<string, string> = {
  '/today-in-history': '/date-converter/',
  '/reaction-time-test': '/eta-calculator/',
  '/chronometer': '/eta-calculator/',
  '/benchmark-builder': '/eta-calculator/',
  '/camera-recorder': '/image-compress/',
  '/text-to-nato-alphabet': '/text-to-unicode/',
  '/numeronym-generator': '/slugify-string/',
  '/string-obfuscator': '/hash-text/',
  '/keycode-info': '/device-information/',
  '/html-wysiwyg-editor': '/markdown-to-html/',
  '/random-port-generator': '/token-generator/',
  '/svg-placeholder-generator': '/image-resize/',
  '/roman-numeral-converter': '/base-converter/',
  '/morse-code-converter': '/text-to-unicode/',
  '/email-normalizer': '/list-converter/',
  '/ipv6-ula-generator': '/ipv4-subnet-calculator/',
};

export const RETIRED_PATHS: ReadonlySet<string> = new Set(Object.keys(RETIRED_REDIRECTS));
