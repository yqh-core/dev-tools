import { config } from '@/config';

/**
 * 「经典版」静态站入口。
 *
 * 经典版由 `public/legacy/` 原样提供（162 个早期工具页，Bootstrap 老站产物），
 * 它**不在 vue-router 的路由表里**，因此：
 *   - 只能用原生 `<a href>` 跳转；写成 `<RouterLink>` 会被 vue-router 接住并落到 404。
 *   - 地址必须按 `app.baseUrl` 拼接，以支持子路径部署（BASE_URL 环境变量）。
 *
 * 服务端侧由 public/_redirects 里 `/legacy/*` 规则保证不被 SPA fallback 吞掉。
 */
export const CLASSIC_SITE_TOOL_COUNT = 162;

export const classicSiteUrl = `${config.app.baseUrl.replace(/\/+$/, '')}/legacy/`;
