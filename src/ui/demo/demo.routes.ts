import type { RouteRecordRaw } from 'vue-router';
import DemoHome from './demo-home.page.vue';

// B3 实验（可逆，改回 { eager: true } 即回退）：eager 版把全部 15 个 *.demo.vue
// 及其组件依赖（实测含 c-markdown → marked 89KB src）静态拉进主 chunk。
// 这里只消费 Object.keys()（构建期字符串键），lazy 版语义等价；页面本体本来就是
// 下面的动态 import()。路由在 prod 也被 env 判断挡掉，demo 依赖更不该进首屏。
const demoPages = import.meta.glob('../*/*.demo.vue');

export const demoRoutes = Object.keys(demoPages).map((demoComponentPath) => {
  const [, , fileName] = demoComponentPath.split('/');
  const demoComponentName = fileName.split('.').shift();

  return {
    path: demoComponentName,
    name: demoComponentName,
    component: () => import(/* @vite-ignore */ demoComponentPath),
  } as RouteRecordRaw;
});

export const routes = [
  {
    path: '/c-lib',
    name: 'c-lib',
    children: [
      {
        path: '',
        name: 'c-lib-index',
        component: DemoHome,
      },
      ...demoRoutes,
    ],
    component: () => import('./demo-wrapper.vue'),
  },
];
