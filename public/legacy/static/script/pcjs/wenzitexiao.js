/*!
 * 经典版彩色汉字特效实现（重建 randomise()）
 *
 * 本文件由 D:/work/_ops/build-legacy-glue.py 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原 pcjs/wenzitexiao.js 不可追回；按 select[name=randomiseby] 的两种模式重建。
 */

/* ==========================================================================
 * 胶水：按 wenzitexiao 页（彩色汉字特效）的契约重建
 *   输入 #content → 结果写入 #result，页面调用 randomise()
 *   下拉 select[name=randomiseby]："" = 区分字母（逐字符着色）/ " " = 区分单词（逐词着色）
 *   输出是可直接粘贴的 HTML：每个字母/单词包一个随机颜色的 <span>。
 *   颜色从固定调色板取（而不是全随机 RGB）—— 全随机容易撞出浅色看不清。
 * ========================================================================== */
(function (w) {
    'use strict';

    function $id(id) { return document.getElementById(id); }

    /* 取输入。老站的 onclick 写法不统一：有的传元素（ConvUtf(contents, this)）、
       有的不传（process()）。这里三种都吃：元素 / id 名 / 省略（默认 #content）。 */
    function readText(elOrId, fallbackId) {
        if (elOrId && typeof elOrId === 'object' && elOrId.value !== undefined) {
            return String(elOrId.value);
        }
        if (typeof elOrId === 'string' && elOrId) {
            var byId = $id(elOrId);
            if (byId && byId.value !== undefined) { return String(byId.value); }
        }
        var fb = $id(fallbackId || 'content');
        return fb && fb.value !== undefined ? String(fb.value) : '';
    }

    function emit(s) {
        s = (s === undefined || s === null) ? '' : String(s);
        if (typeof w.hightout === 'function') { w.hightout(s); return; }
        var r = $id('result');
        if (r) { r.textContent = s; }
    }

    /* 统一换行并去掉尾部空行 */
    function toLines(src) {
        var a = String(src).replace(/\r\n?/g, '\n').split('\n');
        while (a.length && a[a.length - 1].replace(/\s/g, '') === '') { a.pop(); }
        return a;
    }

    /* 按码位拆字符：直接 split('') 会劈开 emoji 等代理对，翻转/统计类工具必须避开 */
    function chars(s) {
        s = String(s);
        var out = [], i = 0;
        while (i < s.length) {
            var cp = s.codePointAt(i);
            out.push(String.fromCodePoint(cp));
            i += cp > 0xffff ? 2 : 1;
        }
        return out;
    }

    /* 右下角浮层：给「报告类」操作（统计字数 / 查错别字 / 输入校验）一个非阻塞出口。
       原站这类操作多用 alert()，既阻塞又会卡住自动化验收；浮层可点击关闭。
       返回浮层元素，同时把最后一次内容记在 w.__legacyLastMsg 供自动化断言。 */
    function status(msg) {
        var text = (msg === undefined || msg === null) ? '' : String(msg);
        w.__legacyLastMsg = text;
        var el = $id('dd-legacy-msg');
        if (!el || !el.parentNode) {
            if (!document.body || !document.createElement) { return null; }
            el = document.createElement('div');
            el.id = 'dd-legacy-msg';
            el.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9999;max-width:420px;' +
                'padding:10px 14px;border-radius:6px;background:#0f766e;color:#fff;font-size:13px;' +
                'line-height:1.7;white-space:pre-wrap;box-shadow:0 4px 16px rgba(0,0,0,.25);cursor:pointer';
            el.title = '点击关闭';
            el.onclick = function () { el.style.display = 'none'; };
            document.body.appendChild(el);
        }
        el.textContent = text;
        el.style.display = '';
        return el;
    }

    var PALETTE = ['#e11d48', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#c026d3'];

    function pick() { return PALETTE[Math.floor(Math.random() * PALETTE.length)]; }
    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function span(s) { return '<span style="color:' + pick() + '">' + esc(s) + '</span>'; }

    w.randomise = function () {
        var text = readText();
        if (!text) { emit(''); return; }
        var sel = document.querySelector ? document.querySelector('select[name="randomiseby"]') : null;
        var byWord = !!(sel && String(sel.value) === ' ');
        var parts = byWord ? String(text).split(/(\s+)/) : chars(text);
        var out = [];
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (p === '') { continue; }
            out.push(/^\s+$/.test(p) ? p : span(p));
        }
        emit(out.join(''));
    };
})(window);
