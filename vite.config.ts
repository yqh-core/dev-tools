import { resolve } from 'node:path';
import { URL, fileURLToPath } from 'node:url';

import VueI18n from '@intlify/unplugin-vue-i18n/vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import Unocss from 'unocss/vite';
import AutoImport from 'unplugin-auto-import/vite';
import IconsResolver from 'unplugin-icons/resolver';
import Icons from 'unplugin-icons/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import markdown from 'vite-plugin-vue-markdown';
import svgLoader from 'vite-svg-loader';
import { configDefaults } from 'vitest/config';

const baseUrl = process.env.BASE_URL ?? '/';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    VueI18n({
      runtimeOnly: true,
      jitCompilation: true,
      compositionOnly: true,
      fullInstall: true,
      strictMessage: false,
      include: [
        resolve(__dirname, 'locales/**'),
      ],
    }),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        '@vueuse/core',
        'vue-i18n',
        {
          'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar'],
        },
      ],
      vueTemplate: true,
      eslintrc: {
        enabled: true,
      },
    }),
    Icons({ compiler: 'vue3' }),
    vue({
      include: [/\.vue$/, /\.md$/],
    }),
    vueJsx(),
    markdown(),
    svgLoader(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      // 经典版静态站（public/legacy/）必须**同时**从两处排除，缺一不可：
      //
      // ① globIgnores —— 不让它的 174 个文件进 precache manifest。
      //    实测：不排除时 precache 从 275 条涨到 448 条（约 14MB），首访安装
      //    Service Worker 要白下载十几 MB，而这些页面用户可能永远不会打开。
      //
      // ② navigateFallbackDenylist —— 不让它的导航请求被 SW 接管。
      //    这一条是**必须的，不是保险**：VitePWA 默认会给 workbox 启用
      //    navigateFallback='index.html'，生成的 dist/sw.js 末尾是
      //        registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")))
      //    这个 NavigationRoute 不带 denylist 时会拦下**所有**导航请求并直接返回
      //    预缓存的 index.html。后果：SW 一旦接管（第二次访问起），
      //    /legacy/ 与 /legacy/xxx/ 全部变成 SPA 路由，渲染出「页面不存在」。
      //    而服务端 _redirects 已正确放行，所以这是纯浏览器层的静默故障 ——
      //    只在 fetch 里测（服务端视角）永远发现不了，必须用真实浏览器验证。
      workbox: {
        globIgnores: ['legacy/**'],
        navigateFallbackDenylist: [/^\/legacy\//],
      },
      manifest: {
        name: 'DigDevBox',
        // ⚠ short_name 必须**显式**写死。不写时 vite-plugin-pwa 会回落到 package.json 的
        //    `name`（本仓库沿用至今的旧包名），于是用户把 PWA 装到桌面/手机上，图标上的名字
        //    仍是旧品牌。而这个值只存在于构建产物 dist/manifest.webmanifest 里，
        //    **源码全局搜索永远查不到** —— 是「品牌统一」里最容易漏的一处。
        //    判据：_ops/brand-consistency-check.mjs 的判据 3（产物侧）。
        short_name: 'DigDevBox',
        // 站点默认语言是 en（A2 已拍板），而 manifest 只有一份、不随 locale 变，
        // 所以这里跟默认语言对齐；中文由界面内的语言切换承担。
        lang: 'en',
        description:
          'A curated collection of practical online tools for developers and IT professionals, with a friendly interface and simple workflows. DigDevBox is a free and open-source toolkit covering encryption, conversion, development, networking and more.',
        display: 'standalone',
        start_url: `${baseUrl}?utm_source=pwa&utm_medium=pwa`,
        orientation: 'any',
        theme_color: '#0f766e',
        background_color: '#f1f5f9',
        icons: [
          {
            src: '/favicon-16x16.png',
            type: 'image/png',
            sizes: '16x16',
          },
          {
            src: '/favicon-32x32.png',
            type: 'image/png',
            sizes: '32x32',
          },
          {
            src: '/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
    Components({
      dirs: ['src/'],
      extensions: ['vue', 'md'],
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      resolvers: [NaiveUiResolver(), IconsResolver({ prefix: 'icon' })],
    }),
    Unocss(),
  ],
  base: baseUrl,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(process.env.npm_package_version),
  },
  test: {
    exclude: [...configDefaults.exclude, '**/*.e2e.spec.ts'],
  },
  build: {
    target: 'esnext',
  },
});
