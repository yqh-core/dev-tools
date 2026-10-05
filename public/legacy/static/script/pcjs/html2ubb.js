/*!
 * 经典版 UBB 与 HTML 互转实现（重建 htmltoubb() / ubbtohtml()）
 *
 * 本文件由 build-legacy-glue.py（仓库外构建脚本） 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原 pcjs/html2ubb.js 不可追回；按最常见的 UBB ↔ HTML 对照表重建。
 */

/* ==========================================================================
 * 胶水：按 html2ubb 页（UBB 与 HTML 互转）的契约重建
 *   输入 #content → 结果写入 #result
 *   页面调用 htmltoubb() / ubbtohtml()
 *
 *   UBB 是论坛时代的标记语法，与 HTML 一一对应。这里按最常见的一组对照实现：
 *     [b] ↔ <b>/<strong>   [i] ↔ <i>/<em>   [u] ↔ <u>   [s] ↔ <s>/<strike>/<del>
 *     [url=X]T[/url] ↔ <a href="X">T</a>          [img]X[/img] ↔ <img src="X">
 *     [code] ↔ <pre>/<code>                        [quote] ↔ <blockquote>
 *     [color=X] ↔ <font color="X">                 [size=N] ↔ <font size="N">
 *     [align=X] ↔ <div align="X">
 *     [list][*]项[/list] ↔ <ul><li>项</li></ul>
 *     <br> 与 <p> ↔ 换行
 *   属性里的引号可有可无（两种都认）；标签名大小写不敏感；不认识的标签原样保留。
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

    /* 成对标签逐条替换。注意顺序：长标签写在短标签前面，
       否则 <strong> 会被 <s…> 那条先吃掉一半。 */
    function htmlToUbb(src) {
        var s = String(src);

        /* 带属性的标签先按各自规则单独处理 */
        s = s.replace(/<a\s+[^>]*href\s*=\s*["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/a>/gi,
            function (all, href, text) { return '[url=' + href + ']' + text + '[/url]'; });
        s = s.replace(/<img\s+[^>]*src\s*=\s*["']?([^"'\s>]+)["']?[^>]*\/?>/gi,
            function (all, src2) { return '[img]' + src2 + '[/img]'; });
        s = s.replace(/<font\s+[^>]*color\s*=\s*["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/font>/gi,
            function (all, c, text) { return '[color=' + c + ']' + text + '[/color]'; });
        s = s.replace(/<font\s+[^>]*size\s*=\s*["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/font>/gi,
            function (all, n, text) { return '[size=' + n + ']' + text + '[/size]'; });
        s = s.replace(/<div\s+[^>]*align\s*=\s*["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/div>/gi,
            function (all, a, text) { return '[align=' + a + ']' + text + '[/align]'; });

        /* 列表：<ul>/<ol> + <li> */
        s = s.replace(/<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi, function (all, tag, inner) {
            var items = inner.replace(/<li[^>]*>/gi, '[*]').replace(/<\/li>/gi, '');
            return '[list]' + items + '[/list]';
        });

        /* 成对标签（长名在前，短的在后） */
        s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '[quote]$1[/quote]');
        s = s.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '[b]$1[/b]');
        s = s.replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '[s]$1[/s]');
        s = s.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '[s]$1[/s]');
        s = s.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '[i]$1[/i]');
        s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '[code]$1[/code]');
        s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '[code]$1[/code]');
        s = s.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '[b]$1[/b]');
        s = s.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '[i]$1[/i]');
        s = s.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '[u]$1[/u]');
        s = s.replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '[s]$1[/s]');

        /* 换行与段落 */
        s = s.replace(/<br\s*\/?>/gi, '\n');
        s = s.replace(/<\/p>\s*<p[^>]*>/gi, '\n');
        s = s.replace(/<\/?p[^>]*>/gi, '\n');
        s = s.replace(/<hr\s*\/?>/gi, '\n----------\n');
        return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
    }

    function ubbToHtml(src) {
        var s = String(src);
        s = s.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi,
            function (all, href, text) { return '<a href="' + href + '">' + text + '</a>'; });
        s = s.replace(/\[img\]([\s\S]*?)\[\/img\]/gi,
            function (all, src2) { return '<img src="' + src2.trim() + '">'; });
        s = s.replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi,
            function (all, c, text) { return '<font color="' + c + '">' + text + '</font>'; });
        s = s.replace(/\[size=([^\]]+)\]([\s\S]*?)\[\/size\]/gi,
            function (all, n, text) { return '<font size="' + n + '">' + text + '</font>'; });
        s = s.replace(/\[align=([^\]]+)\]([\s\S]*?)\[\/align\]/gi,
            function (all, a, text) { return '<div align="' + a + '">' + text + '</div>'; });
        s = s.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, function (all, inner) {
            var items = inner.split(/\[\*\]/).filter(function (x) { return x.trim() !== ''; });
            return '<ul>' + items.map(function (x) { return '<li>' + x.trim() + '</li>'; }).join('') + '</ul>';
        });
        var simples = { b: 'b', i: 'i', u: 'u', s: 's', code: 'pre', quote: 'blockquote' };
        s = s.replace(/\[(\/?)(b|i|u|s|code|quote)\]/gi, function (all, slash, tag) {
            var t = simples[tag.toLowerCase()];
            return '<' + slash + t + '>';
        });
        return s.replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
    }

    w.htmltoubb = function () { emit(htmlToUbb(readText())); };
    w.ubbtohtml = function () { emit(ubbToHtml(readText())); };

    w.__legacyFormat = w.__legacyFormat || {};
    w.__legacyFormat.htmlToUbb = htmlToUbb;
    w.__legacyFormat.ubbToHtml = ubbToHtml;
})(window);
