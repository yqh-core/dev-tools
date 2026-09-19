/**
 * SSR / SSG 预渲染入口（STEP 1）。
 *
 * 刻意不复用 src/main.ts：main.ts 里有 registerSW() 等浏览器专用逻辑，Node 下无法执行。
 * 由 scripts/build-seo.mjs 通过 vite.ssrLoadModule 加载，不参与客户端打包。
 *
 * 渲染范围说明：这里只渲染「页面组件本身」，不套 App.vue / base.layout。
 * 原因是 base.layout 的导航栏用到 naive-ui 的 Follower（vueuc + css-render），
 * 它在 setup 阶段就访问 document，Node 下必崩（实测）。
 * 只渲染页面组件 = 内容是真实来源（md + i18n），且不触碰浏览器 API。
 */
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createPinia } from 'pinia';
import { createHead, renderHeadToString } from '@vueuse/head';
import { createMemoryHistory } from 'vue-router';

import { createAppRouter } from './router';
import { i18nPlugin } from './plugins/i18n.plugin';
import { naive } from './plugins/naive.plugin';
import type { StaticRoutePath } from './seo/routes';

// 用 StaticRoutePath 约束键名：往 src/seo/routes.ts 的 STATIC_ROUTES 里加了路由
// 却忘了在这里登记页面组件，vue-tsc --noEmit 会直接报错，不会到构建期才发现。
const PAGES: Record<StaticRoutePath, () => Promise<{ default: unknown }>> = {
  '/': () => import('./pages/Home.page.vue'),
  '/about': () => import('./pages/About.vue'),
  '/privacy': () => import('./pages/Privacy.vue'),
  '/terms': () => import('./pages/Terms.vue'),
  '/contact': () => import('./pages/Contact.vue'),
};

export async function render(path: StaticRoutePath) {
  const loader = PAGES[path];
  if (!loader) {
    // 类型层面已被 Record<StaticRoutePath, …> 挡住，这里只防 .mjs 侧传入意外值。
    throw new Error(`[entry-server] 未登记的预渲染路由: ${path}`);
  }
  const { default: Page } = await loader();

  const app = createSSRApp(Page as never);
  const head = createHead();
  // 每次 render 独立建一个 memory-history router：
  // ① 页面里有 <RouterLink>（首页 ToolCard），不挂 router 会渲染成无 href 的死链
  // ② 不复用模块级默认实例，避免多次 render 之间的路由状态互相污染
  const router = createAppRouter(createMemoryHistory());

  app.use(createPinia());
  app.use(head);
  app.use(i18nPlugin);
  app.use(naive);
  app.use(router);

  await router.push(path);
  await router.isReady();

  const html = await renderToString(app);
  // renderHeadToString 是 async（unhead renderSSRHead 返回 Promise），漏了 await 会拿到 undefined
  const { headTags, htmlAttrs, bodyAttrs } = await renderHeadToString(head);

  return { html, headTags, htmlAttrs, bodyAttrs };
}
