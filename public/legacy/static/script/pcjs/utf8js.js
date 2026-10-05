/*!
 * 经典版 UTF-8 与中文互转实现（重建 ConvUtf() / ResChinese()）
 *
 * 本文件由 build-legacy-glue.py（仓库外构建脚本） 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原 pcjs/utf8js.js 不可追回；页面调用 ConvUtf(contents, this) / ResChinese(contents, this)，
 *   - 第一个实参是元素本身（该页输入框 id 是 #contents，不是 #content）。
 *   - 实现：中文 → UTF-8 百分号编码（中 → %E4%B8%AD）；反向用 TextDecoder(fatal) 容错解回，
 *   - 非法序列原样保留、不抛异常。
 */

/* ==========================================================================
 * 胶水：按 utf8 页（UTF-8 编码与中文互转）的契约重建
 *   注意输入框是 #contents（不是 #content），且页面这样调用：
 *     ConvUtf(contents, this) / ResChinese(contents, this)   —— 第一个实参是元素本身
 *   ConvUtf()     中文 → UTF-8 百分号编码（中 → %E4%B8%AD）
 *   ResChinese()  百分号编码 → 中文；非法序列原样保留，不抛异常
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

    function encoder() { return w.TextEncoder || (typeof TextEncoder !== 'undefined' ? TextEncoder : null); }
    function decoder() { return w.TextDecoder || (typeof TextDecoder !== 'undefined' ? TextDecoder : null); }

    function hex2(n) { return '%' + ('0' + n.toString(16).toUpperCase()).slice(-2); }

    /* ASCII 可见字符原样保留（便于阅读），其余一律 %XX；% 自身必须编码，否则不可逆 */
    function utf8ToPercent(s) {
        var TE = encoder();
        if (!TE) { return encodeURIComponent(String(s)); }
        var bytes = new TE().encode(String(s)), out = '';
        for (var i = 0; i < bytes.length; i++) {
            var b = bytes[i];
            if (b >= 0x20 && b < 0x7f && b !== 0x25) { out += String.fromCharCode(b); }
            else { out += hex2(b); }
        }
        return out;
    }

    function percentToText(s) {
        var TD = decoder();
        return String(s).replace(/(?:%[0-9a-fA-F]{2})+/g, function (seq) {
            var bytes = [];
            for (var i = 1; i < seq.length; i += 3) { bytes.push(parseInt(seq.substr(i, 2), 16)); }
            if (!TD) { return seq; }
            try {
                return new TD('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
            } catch (e) {
                return seq;
            }
        });
    }

    w.ConvUtf = function (src) {
        emit(utf8ToPercent(readText(src, 'contents')));
    };

    w.ResChinese = function (src) {
        emit(percentToText(readText(src, 'contents')));
    };

    w.__legacyFormat = w.__legacyFormat || {};
    w.__legacyFormat.utf8ToPercent = utf8ToPercent;
    w.__legacyFormat.percentToText = percentToText;
})(window);
