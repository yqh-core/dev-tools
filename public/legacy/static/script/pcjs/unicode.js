/*!
 * 经典版 ASCII 与中文互转实现（重建 a()）
 *
 * 本文件由 build-legacy-glue.py（仓库外构建脚本） 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原 pcjs/unicode.js 不可追回；页面调用 a('CONVERT_FMT3') 中文转ASCII / a('RECONVERT') ASCII转中文。
 *   - 表示形式：HTML 十进制字符引用 &#20013;；& 一并转义成 &#38;，否则解码不可逆。
 */

/* ==========================================================================
 * 胶水：按 ascii 页（在线 Ascii 编码解码 / ASCII 与中文互转）的契约重建
 *   输入 #content → 结果写入 #result
 *   页面调用 a('CONVERT_FMT3')「中文转ASCII」 / a('RECONVERT')「ASCII转中文」
 *
 *   形式选择：ASCII 只覆盖 0–127，中文必须「实体化」才能在 ASCII 文本里表示。
 *   这里用 HTML 十进制字符引用 &#20013;（最通用、任何编辑器都能读，且完全可逆），
 *   并把 & 一并转义成 &#38; —— 否则输入里的 & 会和实体混淆，「解码」结果就不可靠了。
 *   解码同时认得 &#NNN; / &#xHHH; 与 &amp; &lt; &gt; &quot; &nbsp;。
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

    var NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

    function encodeAscii(s) {
        s = String(s);
        var out = '', i = 0;
        while (i < s.length) {
            var cp = s.codePointAt(i);
            var ch = String.fromCodePoint(cp);
            i += cp > 0xffff ? 2 : 1;
            if (cp < 128 && ch !== '&') { out += ch; }        /* ASCII 且非 & 直接留下 */
            else { out += '&#' + cp + ';'; }
        }
        return out;
    }

    function decodeAscii(s) {
        return String(s).replace(/&#(\d+);|&#[xX]([0-9a-fA-F]+);|&([a-zA-Z]+);/g,
            function (all, dec, hex, name) {
                if (dec !== undefined) {
                    var cp = parseInt(dec, 10);
                    return (cp >= 0 && cp <= 0x10ffff) ? String.fromCodePoint(cp) : all;
                }
                if (hex !== undefined) {
                    var cp2 = parseInt(hex, 16);
                    return (cp2 >= 0 && cp2 <= 0x10ffff) ? String.fromCodePoint(cp2) : all;
                }
                var hit = NAMED[String(name).toLowerCase()];
                return hit === undefined ? all : hit;
            });
    }

    w.a = function (mode) {
        var s = readText();
        var m = String(mode || '').toUpperCase();
        emit(m === 'RECONVERT' ? decodeAscii(s) : encodeAscii(s));
    };

    w.__legacyFormat = w.__legacyFormat || {};
    w.__legacyFormat.encodeAscii = encodeAscii;
    w.__legacyFormat.decodeAscii = decodeAscii;
})(window);
