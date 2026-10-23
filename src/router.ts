import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router';
import { layouts } from './layouts/index';

// [B3-experiment E2] Home 由静态 import 改为路由级动态 import：静态 import 让
// Home.page.vue 及其依赖（实测：guides.en.ts 239,795 B 源、vuedraggable+sortablejs
// 274,704 B 源）进入**每个页面**都要下载的主 chunk。预渲染不受影响：
// src/entry-server.ts 的 PAGES['/'] 本来就是 `() => import('./pages/Home.page.vue')`。
// 可逆：改回顶部静态 import + 组件引用即回退。
import NotFound from './pages/404.page.vue';
import { tools } from './tools';
import { config } from './config';
import { routes as demoRoutes } from './ui/demo/demo.routes';

const toolsRoutes = tools.map(({ path, name, component, ...config }) => ({
  path,
  name,
  component,
  meta: { isTool: true, layout: layouts.toolLayout, name, ...config },
}));
const toolsRedirectRoutes = tools
  .filter(({ redirectFrom }) => redirectFrom && redirectFrom.length > 0)
  .flatMap(
    ({ path, redirectFrom }) => redirectFrom?.map(redirectSource => ({ path: redirectSource, redirect: path })) ?? [],
  );

/**
 * 路由工厂。
 *
 * 客户端走 createWebHistory；构建期预渲染（scripts/build-seo.mjs）走
 * createMemoryHistory —— createWebHistory 在模块求值阶段就会访问 window，
 * 在 Node 下直接 ReferenceError，无法复用于 SSR。
 */
export function createAppRouter(history = createWebHistory(config.app.baseUrl)) {
  return createRouter({
    history,
    // 目录锚点必须自己滚：同路径换 hash 会被 vue-router 当成一次导航接管，
    // 而它默认不滚动（实测点 /faq 的目录只改了 location.hash，页面一动不动），
    // 浏览器原生的锚点跳转因此被吞掉。
    // 另外 naive-ui 的 layout 把滚动放在内部容器（.n-layout-scroll-container）上，
    // window.scrollTo 对它无效 —— 所以走元素的 scrollIntoView，让它自己找可滚祖先。
    scrollBehavior: (to) => {
      if (to.hash && typeof document !== 'undefined') {
        requestAnimationFrame(() => {
          document.querySelector(to.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
      // 其余情况一律返回 undefined：不把页面弹回顶部，保持改造前的导航行为不变。
      return undefined;
    },
    routes: [
      {
        path: '/',
        name: 'home',
        component: () => import('./pages/Home.page.vue'),
      },
      {
        path: '/about',
        name: 'about',
        component: () => import('./pages/About.vue'),
      },
      {
        path: '/privacy',
        name: 'privacy',
        component: () => import('./pages/Privacy.vue'),
      },
      {
        path: '/terms',
        name: 'terms',
        component: () => import('./pages/Terms.vue'),
      },
      {
        path: '/contact',
        name: 'contact',
        component: () => import('./pages/Contact.vue'),
      },
      {
        path: '/tools',
        name: 'tools-catalog',
        component: () => import('./pages/ToolsCatalog.vue'),
      },
      {
        path: '/faq',
        name: 'faq',
        component: () => import('./pages/Faq.vue'),
      },
      {
        // 工具指南文章页：/guides/uuid-converter 这类长尾入口（数据仍来自工具侧 guides）
        path: '/guides/:slug',
        name: 'guide-article',
        component: () => import('./pages/GuideArticle.vue'),
      },
      ...toolsRoutes,
      ...toolsRedirectRoutes,
      ...(config.app.env === 'development' ? demoRoutes : []),
      { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound },
    ],
  });
}

// 模块级默认实例。Node（构建期预渲染）下没有 window，走 memory history，
// 否则 createWebHistory 在求值阶段就抛 ReferenceError。
const router = typeof window === 'undefined' ? createAppRouter(createMemoryHistory()) : createAppRouter();

export default router;
