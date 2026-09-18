/*!
 * 经典版 HTML 过滤实现（重建 Filter()）
 *
 * 本文件由 D:/work/_ops/build-legacy-glue.py 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原 pcjs/htmlfilter.js 不可追回；按页面勾选项 0/1/2/3 的语义重建。
 */

/* ==========================================================================
 * 胶水：按 formatfilter 的调用契约重建  Filter()
 *   勾选项 name="type"：0 过滤HTML / 1 过滤JS / 2 过滤CSS / 3 自定义过滤
 *   自定义过滤使用 #preplace → #nextplace，勾选时展开 #place
 * ========================================================================== */
(function (w) {
    'use strict';

    function $id(id) { return document.getElementById(id); }
    function val(id) { var e = $id(id); return e ? String(e.value || '') : ''; }

    function out(s) {
        if (typeof w.hightout === 'function') { w.hightout(s); return; }
        var r = $id('result');
        if (r) { r.textContent = (s === undefined || s === null) ? '' : String(s); }
    }

    function checkedTypes() {
        var boxes = document.querySelectorAll('input[name="type"]'), res = [];
        for (var i = 0; i < boxes.length; i++) { if (boxes[i].checked) { res.push(String(boxes[i].value)); } }
        return res;
    }

    function stripTags(html) {
        var s = String(html);
        s = s.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '');
        s = s.replace(/<!--[\s\S]*?-->/g, '');
        s = s.replace(/<[^>]*>/g, '');
        s = s.replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
             .replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&amp;/gi, '&');
        s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ');
        return s.trim();
    }

    w.Filter = function () {
        var src = val('content');
        var types = checkedTypes();
        var res = src;
        if (types.indexOf('0') >= 0) { res = stripTags(res); }
        if (types.indexOf('1') >= 0) {
            res = res.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
                     .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
                     .replace(/javascript:[^"'\s>]*/gi, '');
        }
        if (types.indexOf('2') >= 0) {
            res = res.replace(/<style\b[\s\S]*?<\/style\s*>/gi, '')
                     .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '');
        }
        if (types.indexOf('3') >= 0) {
            var from = val('preplace');
            if (from) { res = res.split(from).join(val('nextplace')); }
        }
        out(res);
    };

    /* 勾选「自定义过滤」时展开替换输入区 */
    function syncPlace() {
        var place = $id('place');
        if (!place) { return; }
        var boxes = document.querySelectorAll('input[name="type"]');
        for (var i = 0; i < boxes.length; i++) {
            if (String(boxes[i].value) === '3') {
                place.style.display = boxes[i].checked ? 'block' : 'none';
                return;
            }
        }
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function () {
        syncPlace();
        document.addEventListener('change', function (e) {
            if (e.target && e.target.name === 'type') { syncPlace(); }
        }, true);
    }); } else { syncPlace(); }
})(window);
