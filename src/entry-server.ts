/**
 * SSR / SSG 预渲染入口（STEP 1 静态页 + STEP 3 工具页）。
 *
 * 刻意不复用 src/main.ts：main.ts 里有 registerSW() 等浏览器专用逻辑，Node 下无法执行。
 * 由 scripts/build-seo.mjs 通过 vite.ssrLoadModule 加载，不参与客户端打包。
 *
 * 渲染范围说明：这里只渲染「页面组件本身」，不套 App.vue / base.layout。
 * 原因是 base.layout 的导航栏用到 naive-ui 的 Follower（vueuc + css-render），
 * 它在 setup 阶段就访问 document，Node 下必崩（实测）。
 * 只渲染页面组件 = 内容是真实来源（md + i18n），且不触碰浏览器 API。
 *
 * 工具页走的是另一条路：不渲染真实工具组件，而是渲染 `src/seo/ToolSeoPage.vue`
 * 这个正文骨架（原因见该文件顶部的注释）。
 */
import type { Component } from 'vue';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createPinia } from 'pinia';
import { createHead, renderHeadToString } from '@vueuse/head';
import { createMemoryHistory } from 'vue-router';

import { createAppRouter } from './router';
import { i18nPlugin } from './plugins/i18n.plugin';
import { naive } from './plugins/naive.plugin';
import { getToolSeoEntry } from './seo/tool-page';
import type { StaticRoutePath } from './seo/routes';
import ToolSeoPage from './seo/ToolSeoPage.vue';

// 用 StaticRoutePath 约束键名：往 src/seo/routes.ts 的 STATIC_ROUTES 里加了路由
// 却忘了在这里登记页面组件，vue-tsc --noEmit 会直接报错，不会到构建期才发现。
const PAGES: Record<StaticRoutePath, () => Promise<{ default: unknown }>> = {
  '/': () => import('./pages/Home.page.vue'),
  '/about': () => import('./pages/About.vue'),
  '/privacy': () => import('./pages/Privacy.vue'),
  '/terms': () => import('./pages/Terms.vue'),
  '/contact': () => import('./pages/Contact.vue'),
};

/**
 * 渲染单个页面并取回其结果。
 *
 * 每次调用都新建 app / head / router 实例：复用会有跨页状态污染
 * （STEP 1 实测：模块级默认 router 在多次 render 之间互相影响）。
 *
 * @param resolveRoute 是否挂 router 并把路由 push 到 `path`。
 *   静态页面必须为 true —— 首页里有 `<RouterLink>`，不挂 router 会渲染成无 href 的死链。
 *   工具页必须为 false —— 工具页骨架不用路由，而 `router.push('/<tool>')` 会让
 *   vue-router **真的去动态 import 那个工具组件**，于是 Node 下依次踩到
 *   工具组件的浏览器依赖与 CJS 包（实测第一个炸的是 `/yaml-to-toml` 依赖的
 *   iarna-toml-esm：`export default parseString` 在 CJS 加载器下直接 SyntaxError）。
 *   这正是「不渲染真实工具组件」这一取舍的必然结果，不是可以绕过的偶发问题。
 */
async function renderPage(
  component: Component,
  path: string,
  props?: Record<string, unknown>,
  { resolveRoute = true }: { resolveRoute?: boolean } = {},
) {
  const app = createSSRApp(component, props);
  const head = createHead();

  app.use(createPinia());
  app.use(head);
  app.use(i18nPlugin);
  app.use(naive);

  if (resolveRoute) {
    const router = createAppRouter(createMemoryHistory());
    app.use(router);
    await router.push(path);
    await router.isReady();

    // 路由未命中时 vue-router 会落到 `/:pathMatch(.*)*` 的 404 页而不是抛错，
    // 那样会安静地渲染出一个「页面不存在」的预渲染产物。这里显式拦住。
    const resolved = router.currentRoute.value;
    if (resolved.name === 'NotFound') {
      throw new Error(`[entry-server] 路由未注册，预渲染会产生 404 页面: ${path}`);
    }
  }

  const html = await renderToString(app);
  // renderHeadToString 是 async（unhead renderSSRHead 返回 Promise），漏了 await 会拿到 undefined
  const { headTags, htmlAttrs, bodyAttrs } = await renderHeadToString(head);

  return { html, headTags, htmlAttrs, bodyAttrs };
}

export async function render(path: StaticRoutePath) {
  const loader = PAGES[path];
  if (!loader) {
    // 类型层面已被 Record<StaticRoutePath, …> 挡住，这里只防 .mjs 侧传入意外值。
    throw new Error(`[entry-server] 未登记的预渲染路由: ${path}`);
  }
  const { default: Page } = await loader();

  return renderPage(Page as Component, path);
}

/** 工具页预渲染。`path` 必须来自 `src/seo/tool-page.ts` 的 TOOL_SEO_PAGES。 */
export async function renderTool(path: string) {
  const entry = getToolSeoEntry(path);
  if (!entry) {
    throw new Error(`[entry-server] 不是可索引的工具页路径: ${path}`);
  }

  return renderPage(ToolSeoPage as unknown as Component, path, { entry }, { resolveRoute: false });
}
