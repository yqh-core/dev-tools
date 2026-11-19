<script lang="ts" setup>
// API Studio · 工作台页（G3 UI 第 2 步：骨架与视觉落地）。
// 这是全屏壳内的内容区，定义工作区的两栏结构（集合树 / 请求面板）与设计基调。
// 集合树的真实编辑能力（新建/重命名/拖拽/删除、脚本继承、运行）在下一步接入
// collection-tree.ts —— 此处不放「点了没反应」的假控件，避免误导。
</script>

<template>
  <div class="api-workspace">
    <aside class="api-sidebar" aria-label="Collections">
      <div class="api-sidebar-head">
        <span class="api-sidebar-title">Collections</span>
      </div>
      <div class="api-tree" role="tree" aria-label="Collection tree">
        <div class="api-empty">
          <div class="api-empty-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M4 6a2 2 0 0 1 2-2h3l2 2h5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
            </svg>
          </div>
          <p class="api-empty-title">
            No folders yet
          </p>
          <p class="api-empty-hint">
            Your requests and folders will live here, organized in a tree you can rename, move, and run.
          </p>
        </div>
      </div>
    </aside>

    <section class="api-editor" aria-label="Request">
      <div class="api-editor-empty">
        <div class="api-editor-mark" aria-hidden="true">
          <span class="api-method-badge" style="color: var(--api-method-get); border-color: var(--api-method-get)">GET</span>
          <span class="api-url-ghost">https://api.example.com/…</span>
        </div>
        <h2 class="api-editor-title">
          A calmer place to build and test APIs
        </h2>
        <p class="api-editor-sub">
          Organize requests into folders, chain them with scripts, and run a whole collection —
          with your data kept on your own machine.
        </p>
        <p class="api-editor-note">
          The collection workspace is coming online next. The look, density, and theme you see here
          are the real foundation it will be built on.
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.api-workspace {
  display: flex;
  height: 100%;
  min-height: 0;
}

.api-sidebar {
  display: flex;
  flex-direction: column;
  flex: 0 0 var(--api-sidebar-w);
  width: var(--api-sidebar-w);
  min-height: 0;
  background: var(--api-surface-2);
  border-right: 1px solid var(--api-border);
}

.api-sidebar-head {
  display: flex;
  align-items: center;
  height: 40px;
  flex: 0 0 40px;
  padding: 0 var(--api-gap);
  border-bottom: 1px solid var(--api-border);
}

.api-sidebar-title {
  font-size: var(--api-fs-sm);
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--api-text-muted);
}

.api-tree {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: var(--api-gap);
}

.api-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 40px 16px;
  color: var(--api-text-muted);
}

.api-empty-icon {
  color: var(--api-text-faint);
  margin-bottom: 4px;
}

.api-empty-title {
  margin: 0;
  font-size: var(--api-fs-md);
  font-weight: 600;
  color: var(--api-text-soft);
}

.api-empty-hint {
  margin: 0;
  font-size: var(--api-fs-sm);
  line-height: 1.55;
  max-width: 220px;
  color: var(--api-text-muted);
}

.api-editor {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--api-gap-lg);
  overflow: auto;
}

.api-editor-empty {
  max-width: 520px;
  text-align: center;
}

.api-editor-mark {
  display: inline-flex;
  align-items: center;
  gap: var(--api-gap-sm);
  padding: 8px 12px;
  margin-bottom: var(--api-gap-lg);
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius);
  background: var(--api-surface);
  box-shadow: var(--api-shadow-sm);
}

.api-method-badge {
  font-family: var(--api-font-mono);
  font-size: var(--api-fs-sm);
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border: 1px solid;
  border-radius: var(--api-radius-sm);
}

.api-url-ghost {
  font-family: var(--api-font-mono);
  font-size: var(--api-fs);
  color: var(--api-text-faint);
}

.api-editor-title {
  margin: 0 0 var(--api-gap);
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.2px;
  color: var(--api-text);
}

.api-editor-sub {
  margin: 0 0 var(--api-gap);
  font-size: var(--api-fs-md);
  line-height: 1.6;
  color: var(--api-text-soft);
}

.api-editor-note {
  margin: 0;
  font-size: var(--api-fs-sm);
  line-height: 1.6;
  color: var(--api-text-muted);
}
</style>
