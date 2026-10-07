<script lang="ts" setup>
import { NIcon, useThemeVars } from 'naive-ui';

import { RouterLink } from 'vue-router';
import { Home2, Menu2 } from '@vicons/tabler';

import { storeToRefs } from 'pinia';
import HeroGradient from '../assets/hero-gradient.svg?component';
import MenuLayout from '../components/MenuLayout.vue';
import NavbarButtons from '../components/NavbarButtons.vue';
import { useStyleStore } from '@/stores/style.store';
import { config } from '@/config';
import type { ToolCategory } from '@/tools/tools.types';
import { useToolStore } from '@/tools/tools.store';
import { useTracker } from '@/modules/tracker/tracker.services';
import CollapsibleToolMenu from '@/components/CollapsibleToolMenu.vue';

const themeVars = useThemeVars();
const styleStore = useStyleStore();
const version = config.app.version;
const commitSha = config.app.lastCommitSha.slice(0, 7);

const { tracker } = useTracker();
const { t } = useI18n();

const toolStore = useToolStore();
const { favoriteTools, toolsByCategory } = storeToRefs(toolStore);

const tools = computed<ToolCategory[]>(() => [
  ...(favoriteTools.value.length > 0 ? [{ name: t('tools.categories.favorite-tools'), components: favoriteTools.value }] : []),
  ...toolsByCategory.value,
]);
</script>

<template>
  <MenuLayout class="menu-layout" :class="{ isSmallScreen: styleStore.isSmallScreen }">
    <template #sider>
      <RouterLink to="/" class="hero-wrapper">
        <HeroGradient class="gradient" />
        <div class="text-wrapper">
          <div class="title">
            {{ $t('legal.siteName') }}
          </div>
          <div class="divider" />
          <div class="subtitle">
            {{ $t('home.subtitle') }}
          </div>
        </div>
      </RouterLink>

      <div class="sider-content">
        <div v-if="styleStore.isSmallScreen" flex flex-col items-center>
          <locale-selector w="90%" />

          <div flex justify-center>
            <NavbarButtons />
          </div>
        </div>

        <CollapsibleToolMenu :tools-by-category="tools" />

        <div class="footer">
          <div>
            © {{ new Date().getFullYear() }}
            <c-link href="https://digdevbox.com">
              digdevbox.com
            </c-link>
          </div>

          <div class="footer-legal">
            <RouterLink to="/privacy">
              {{ $t('legal.privacy') }}
            </RouterLink>
            <span class="dot">·</span>
            <RouterLink to="/terms">
              {{ $t('legal.terms') }}
            </RouterLink>
            <span class="dot">·</span>
            <RouterLink to="/contact">
              {{ $t('legal.contact') }}
            </RouterLink>
          </div>

          <div class="footer-network">
            {{ $t('network.label') }}
            <a href="https://ip.digdevbox.com/">{{ $t('network.ip') }}</a> ·
            <a href="https://fangdai.digdevbox.com/">{{ $t('network.fangdai') }}</a> ·
            <a href="https://play.digdevbox.com/">{{ $t('network.play') }}</a> ·
            <a href="https://draw.digdevbox.com/">{{ $t('network.draw') }}</a> ·
            <a href="https://notes.digdevbox.com/">{{ $t('network.notes') }}</a> ·
            <a href="https://geek-typing.pages.dev/">{{ $t('network.typing') }}</a>
          </div>

          <div class="footer-trust">
            {{ $t('trust') }}
          </div>
        </div>
      </div>
    </template>

    <template #content>
      <div flex items-center justify-center gap-2>
        <c-button
          circle
          variant="text"
          :aria-label="$t('home.toggleMenu')"
          @click="styleStore.isMenuCollapsed = !styleStore.isMenuCollapsed"
        >
          <NIcon size="25" :component="Menu2" />
        </c-button>

        <c-tooltip :tooltip="$t('home.home')" position="bottom">
          <c-button to="/" circle variant="text" :aria-label="$t('home.home')">
            <NIcon size="25" :component="Home2" />
          </c-button>
        </c-tooltip>

        <c-tooltip :tooltip="$t('home.uiLib')" position="bottom">
          <c-button v-if="config.app.env === 'development'" to="/c-lib" circle variant="text" :aria-label="$t('home.uiLib')">
            <icon-mdi:brush-variant text-20px />
          </c-button>
        </c-tooltip>

        <command-palette />

        <locale-selector v-if="!styleStore.isSmallScreen" />

        <div>
          <NavbarButtons v-if="!styleStore.isSmallScreen" />
        </div>
      </div>
      <slot />
    </template>
  </MenuLayout>
</template>

<style lang="less" scoped>
// ::v-deep(.n-layout-scroll-container) {
//     @percent: 4%;
//     @position: 25px;
//     @size: 50px;
//     @color: #eeeeee25;
//     background-image: radial-gradient(@color @percent, transparent @percent),
//         radial-gradient(@color @percent, transparent @percent);
//     background-position: 0 0, @position @position;
//     background-size: @size @size;
// }

.support-button {
  background: rgb(37, 99, 108);
  background: linear-gradient(48deg, rgba(37, 99, 108, 1) 0%, rgba(59, 149, 111, 1) 60%, rgba(20, 160, 88, 1) 100%);
  color: #fff !important;
  transition: padding ease 0.2s !important;

  &:hover {
    color: #fff;
    padding-left: 30px;
    padding-right: 30px;
  }
}

.footer {
  text-align: center;
  color: #6b6d70;
  margin-top: 20px;
  padding: 20px 0;

  /*
   * 触控目标：B7 甄别出页脚这 4 个链接真实高度只有 16~18px（低于 24px 建议值），
   * 且它们**没有更大的可点祖先** —— 与侧栏菜单那 101 个（祖先点击区已达标）性质不同，
   * 这 4 个是真问题。用纵向 padding 把可点区撑到 >= 24px，视觉排版不变。
   */
  a {
    display: inline-block;
    padding: 4px 2px;
  }

  .footer-legal {
    margin-top: 4px;
    font-size: 13px;

    a {
      color: inherit;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    .dot {
      margin: 0 6px;
    }
  }

  .footer-network {
    margin-top: 8px;
    font-size: 13px;

    a {
      color: inherit;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .footer-trust {
    margin-top: 8px;
    font-size: 12px;
    opacity: 0.85;
    max-width: 560px;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.6;
  }
}

/* D022b：暗色下沿用 #6b6d70 只有 3.29:1（bg 约 #131c2b），换浅灰 #a3a3a3 保证 >= 4.5:1。
   scoped 编译后为 `.dark .footer[data-v-…]`，data-v 只加在末位选择器，html.dark 可正确命中 */
.dark .footer {
  color: #a3a3a3;
}

.sider-content {
  padding-top: 160px;
  padding-bottom: 200px;
}

.hero-wrapper {
  position: absolute;
  display: block;
  left: 0;
  width: 100%;
  z-index: 10;
  overflow: hidden;

  .gradient {
    margin-top: -65px;
  }

  .text-wrapper {
    position: absolute;
    left: 0;
    width: 100%;
    text-align: center;
    top: 16px;
    color: #fff;

    .title {
      font-size: 25px;
      font-weight: 600;
    }

    .divider {
      width: 50px;
      height: 2px;
      border-radius: 4px;
      background-color: v-bind('themeVars.primaryColor');
      margin: 0 auto 5px;
    }

    .subtitle {
      font-size: 16px;
    }
  }
}
</style>
