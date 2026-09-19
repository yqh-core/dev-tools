import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router';
import { layouts } from './layouts/index';
import HomePage from './pages/Home.page.vue';
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
    routes: [
      {
        path: '/',
        name: 'home',
        component: HomePage,
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
