/*!
 * CodeMirror formatting 插件（重建）
 *
 * 本文件由 build-legacy-glue.py（仓库外构建脚本） 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原文件不可得；按 addon 契约重建 autoFormatRange。
 */

/* ==========================================================================
 * CodeMirror formatting 插件（原 addon/format/formatting.js 不可得，按 addon 契约重建）
 *   页面内联脚本调用：editor.autoFormatRange(from, to)
 *   这里注册同名扩展：取区间文本 → 去公共缩进 → js_beautify → 回写
 * ========================================================================== */
(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.CodeMirror === 'undefined') { return; }
    var CM = window.CodeMirror;

    function deindent(text) {
        var lines = text.split('\n'), min = null;
        for (var i = 0; i < lines.length; i++) {
            if (!lines[i].trim()) { continue; }
            var n = lines[i].match(/^[ \t]*/)[0].length;
            if (min === null || n < min) { min = n; }
        }
        if (!min) { return text; }
        return lines.map(function (l) { return l.replace(/^[ \t]{0,}/, '').slice(min); }).join('\n');
    }

    CM.defineExtension('autoFormatRange', function (from, to) {
        var cm = this;
        var text = deindent(cm.getRange(from, to));
        var unit = cm.getOption('indentUnit') || 4;
        var useTabs = cm.getOption('indentWithTabs');
        var res = text;
        if (typeof window.js_beautify === 'function') {
            res = window.js_beautify(text, {
                indent_size: useTabs ? 4 : unit,
                indent_with_tabs: !!useTabs,
                brace_style: 'collapse'
            });
        }
        cm.operation(function () { cm.replaceRange(res, from, to); });
    });

    CM.defineExtension('autoFormatSelection', function () {
        this.autoFormatRange(this.getCursor(true), this.getCursor(false));
        return true;
    });
})();
