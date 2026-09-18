/*!
 * 经典版在线运行 JS/HTML 实现（覆盖页面内联的 webdebug）
 *
 * 本文件由 D:/work/_ops/build-legacy-glue.py 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 页面内联的 webdebug() 在弹窗被拦截时 window.open() 返回 null，直接抛 TypeError
 *   - （真机审计报的 Cannot read properties of null 就是它）；且写死了 jQuery。
 *   - 这里在页面内联脚本之后覆盖同名全局函数：优先开新窗口，开不出来退化为页内 iframe 预览。
 */

/* ==========================================================================
 * 胶水：按 runjs 页（HTML/CSS/JS 在线运行）的契约重建
 *   页面内联定义了 webdebug()：
 *     function webdebug(){ var win=window.open(); win.document.open();
 *                          win.document.write($("#content").val()); win.document.close() }
 *   两个毛病：
 *     1 window.open() 被浏览器拦截时返回 **null** → 「点了没反应」（真机审计抓到的就是它）
 *     2 写死 jQuery
 *   本文件在页面内联脚本之后加载，覆盖同名全局函数（onclick 在点击时才解析全局名，
 *   所以后加载的这份生效）：优先仍然开新窗口（与原行为一致），开不出来就退化成
 *   页面内 iframe 预览 —— 任何情况下都能看到运行结果。
 *   执行结果状态记在 w.__legacyRunjs（mode: popup|frame|none），供自动化验收断言。
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

    function frameFor(text) {
        var f = $id('dd-runjs-frame');
        if (!f) {
            f = document.createElement('iframe');
            f.id = 'dd-runjs-frame';
            f.style.cssText = 'width:100%;height:420px;border:1px solid #ddd;border-radius:4px;' +
                'margin-top:12px;background:#fff';
            var host = $id('content');
            var box = host && host.closest ? (host.closest('form') || host.parentNode) : null;
            if (!box) { box = document.body; }
            if (box && box.appendChild) { box.appendChild(f); }
        }
        if ('srcdoc' in f) {
            f.srcdoc = text;
        } else if (f.contentDocument) {          /* 老浏览器兜底 */
            f.contentDocument.open();
            f.contentDocument.write(text);
            f.contentDocument.close();
        } else if (f.setAttribute) {
            f.setAttribute('srcdoc', text);
        }
        return f;
    }

    w.webdebug = function () {
        var text = readText(null, 'content');
        var st = { mode: 'none', ok: false, chars: text.length };
        w.__legacyRunjs = st;
        if (text.replace(/\s/g, '') === '') {
            status('请先把要调试的 HTML/JS 代码粘贴到输入框');
            return st;
        }
        var win = null;
        try { win = w.open('', '_blank'); } catch (e) { win = null; }
        if (win && win.document) {
            try {
                win.document.open();
                win.document.write(text);
                win.document.close();
                st.mode = 'popup';
                st.ok = true;
                return st;
            } catch (e) { /* 落到 iframe 兜底 */ }
        }
        var f = frameFor(text);
        st.mode = 'frame';
        st.ok = !!f;
        return st;
    };
})(window);
