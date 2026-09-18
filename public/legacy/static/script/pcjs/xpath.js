/*!
 * 经典版 XPath 工具实现（重建 find() / demo()）
 *
 * 本文件由 D:/work/_ops/build-legacy-glue.py 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原 pcjs/xpath.js 不可追回；页面调用 find(1) 解析图片 / find(3) 解析链接 / find(2) xpath 匹配 / demo()。
 *   - 实现基于浏览器原生 XPath（document.evaluate）+ DOMParser 解析 HTML 文本（不插入文档，脚本不会执行）。
 */

/* ==========================================================================
 * 胶水：按 xpath 页的契约重建
 *   输入 #content（待解析的 HTML 文本）+ #xpath（表达式），结果写入 #result
 *   页面调用：find(1) 解析图片 / find(3) 解析链接 / find(2) xpath 匹配 / demo() 示例数据
 *   实现基于浏览器原生 XPath（document.evaluate），解析用 DOMParser（不插入文档，
 *   因此页面里的脚本不会被执行）。
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

    var PRESET = { 1: '//img', 3: '//a' };

    function parseDoc(html) {
        var DP = w.DOMParser;
        if (DP) { return new DP().parseFromString(String(html), 'text/html'); }
        var d = document.createElement('div');
        d.innerHTML = String(html);
        return d;
    }

    function describe(node, index) {
        var tag = node.nodeName;
        if (node.nodeType === 2) { return '[' + index + '] @' + tag + ' = ' + node.nodeValue; }
        if (node.nodeType === 3) { return '[' + index + '] #text = ' + String(node.nodeValue).replace(/\s+/g, ' ').trim(); }
        var bits = ['[' + index + '] <' + tag.toLowerCase() + '>'];
        if (node.getAttribute) {
            var src = node.getAttribute('src'), href = node.getAttribute('href');
            if (src) { bits.push('src=' + src); }
            if (href) { bits.push('href=' + href); }
        }
        var text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) { bits.push('文本=' + (text.length > 60 ? text.slice(0, 60) + '…' : text)); }
        return bits.join('  ');
    }

    w.find = function (mode) {
        var html = readText();
        if (!html.trim()) { emit('请先在输入框里粘贴 HTML 内容。'); return; }

        var expr = PRESET[mode];
        if (!expr) {
            var x = $id('xpath');
            expr = x ? String(x.value || '').trim() : '';
        }
        if (!expr) { emit('请填写 XPath 表达式，或改用「解析图片」「解析链接」。'); return; }

        var doc;
        try { doc = parseDoc(html); }
        catch (e) { emit('HTML 解析失败：' + e.message); return; }

        var res;
        try {
            res = doc.evaluate(expr, doc, null, 7 /* ORDERED_NODE_SNAPSHOT_TYPE */, null);
        } catch (e) {
            emit('XPath 表达式无效：' + e.message);
            return;
        }

        var out = [];
        for (var i = 0; i < res.snapshotLength; i++) {
            out.push(describe(res.snapshotItem(i), i + 1));
        }
        emit(out.length ? out.join('\n') : '没有匹配到节点。表达式：' + expr);
    };

    w.demo = function () {
        var c = $id('content');
        if (c) {
            c.value = [
                '<div class="box">',
                '  <a href="https://example.com">示例站点</a>',
                '  <img src="https://example.com/cover.png" alt="封面">',
                '  <a href="/about">关于</a>',
                '  <img src="/logo.svg" alt="Logo">',
                '</div>'
            ].join('\n');
        }
        var x = $id('xpath');
        if (x) { x.value = '//a/@href'; }
        w.find(2);
    };
})(window);
