/*!
 * 经典版键位绑定实现（重建 hotkeys）
 *
 * 本文件由 build-legacy-glue.py（仓库外构建脚本） 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原 huaban/hotkeys.js 不可追回；tuya 页内联脚本调用 hotkeys('ctrl+z'|'ctrl+s', fn)。
 *   - 只实现该页需要的部分：修饰键严格匹配、handler 收原生事件。
 */

/* ==========================================================================
 * 胶水：huaban/hotkeys.js —— 最小键位绑定实现（重建）
 *   原文件不可追回。tuya 页的内联脚本这样调用它：
 *     hotkeys('ctrl+z', function () { re_draw(); });
 *     hotkeys('ctrl+s', function (e) { e.preventDefault(); saveImageInfo(); });
 *   这里实现 hotkeys(combo, handler)：
 *     · combo 形如 'ctrl+shift+z' / 'ctrl+s' / 'esc'，修饰键顺序不限、大小写不限
 *     · 修饰键必须**严格匹配**（绑了 ctrl+z 时，ctrl+shift+z 不会误触发）
 *     · handler 收到原生事件，可自行 preventDefault()
 *   绑定挂在 document 的 keydown 上；焦点在输入控件里时只放行带修饰键的组合，
 *   否则会把输入框里正常的打字按键抢走。
 * ========================================================================== */
(function (w) {
    'use strict';

    var MODS = ['ctrl', 'alt', 'shift', 'meta'];
    var binds = [];

    function parse(combo) {
        var parts = String(combo).toLowerCase().split('+');
        var key = '', mods = {};
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i].replace(/\s/g, '');
            if (!p) { continue; }
            if (p === 'control') { p = 'ctrl'; }
            if (p === 'cmd' || p === 'command' || p === 'win') { p = 'meta'; }
            if (p === 'option') { p = 'alt'; }
            if (MODS.indexOf(p) >= 0) { mods[p] = true; }
            else { key = p; }
        }
        return key ? { key: key, mods: mods } : null;
    }

    function hotkeys(combo, handler) {
        if (typeof handler !== 'function') { return false; }
        var b = parse(combo);
        if (!b) { return false; }
        binds.push({ key: b.key, mods: b.mods, fn: handler });
        return true;
    }

    function onKey(e) {
        var t = e.target || {};
        var tag = String(t.tagName || '').toUpperCase();
        var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
        var hasMod = !!(e.ctrlKey || e.altKey || e.metaKey);
        if (typing && !hasMod) { return; }
        var key = String(e.key || '').toLowerCase();
        for (var i = 0; i < binds.length; i++) {
            var b = binds[i];
            if (b.key !== key) { continue; }
            if (!!b.mods.ctrl !== !!e.ctrlKey) { continue; }
            if (!!b.mods.alt !== !!e.altKey) { continue; }
            if (!!b.mods.shift !== !!e.shiftKey) { continue; }
            if (!!b.mods.meta !== !!e.metaKey) { continue; }
            b.fn(e);
            return;
        }
    }

    if (document.addEventListener) { document.addEventListener('keydown', onKey, false); }
    w.hotkeys = hotkeys;
})(window);
