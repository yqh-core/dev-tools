/*!
 * 经典版 HTML 互转实现（重建 tojs / tohtml / htmltoarray / htmlCov / tocsharp / tojsp）
 *
 * 本文件由 build-legacy-glue.py（仓库外构建脚本） 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原 pcjs/html2js.js 不可追回；html2js / html2all / html2cj / html2php / htmloutjs
 *   - 五页共用它，各自只调用其中一部分函数（见各页 onclick）。
 *   - 输出目标：各页均为 <pre><code id="result">，统一由 hightout() 写入。
 */

/* ==========================================================================
 * 胶水：按 html2js / html2all / html2cj / html2php / htmloutjs 五页的契约重建
 *   五页共用本文件：输入 #content，结果写入 <code id="result">（hightout 兜底）
 *   暴露的全局函数取自各页 onclick，签名与文案保持一致：
 *     tojs()         HTML → JS        每行一条 document.write("…");
 *     tohtml()       JS → HTML        抽出 document.write(…) / 字符串字面量并反转义
 *     htmltoarray()  HTML → JS 数组   new Array("…", "…")
 *     htmlCov(lang)  HTML → ASP / VB.NET / Perl / Sws / PHP 的输出语句
 *     tocsharp()     HTML → C#        Response.Write("…");
 *     tojsp()        HTML → JSP       out.print("…");
 *
 *   原实现不可追回，此处按「函数名所述语义 + 该语言最常见的输出写法」重建：
 *   只做逐行包裹与转义，不改写 HTML 内容本身，因此结果可预期、可逐字节断言。
 * ========================================================================== */
(function (w) {
    'use strict';

    function $id(id) { return document.getElementById(id); }

    function readInput() {
        var ta = $id('content');
        return ta ? String(ta.value || '') : '';
    }

    function emit(s) {
        s = (s === undefined || s === null) ? '' : String(s);
        if (typeof w.hightout === 'function') { w.hightout(s); return; }
        var r = $id('result');
        if (r) { r.textContent = s; }
    }

    /* 统一换行、去掉尾部空行（从编辑器复制常带尾随空行，不处理会多出空语句） */
    function toLines(src) {
        var a = String(src).replace(/\r\n?/g, '\n').split('\n');
        while (a.length && a[a.length - 1].replace(/\s/g, '') === '') { a.pop(); }
        return a;
    }

    /* 放进双引号字面量前转义反斜杠与双引号 */
    function dq(s) {
        return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    /* 从 JS 字符串字面量还原文本：\n \t \" \\ \' \/ \uXXXX \xNN */
    function unquote(s) {
        return String(s).replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, function (all, esc) {
            var head = esc.charAt(0);
            if (head === 'u' || head === 'x') { return String.fromCharCode(parseInt(esc.slice(1), 16)); }
            return ({ n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v' })[esc] || esc;
        });
    }

    /* 各目标语言的「逐行输出 HTML」写法。open/close 为空表示不包语言块。 */
    var LANG = {
        asp:   { open: '<%',    close: '%>', line: function (l) { return 'Response.Write("' + dq(l) + '")'; } },
        vbnet: { open: '',      close: '',   line: function (l) { return 'Response.Write("' + dq(l) + '")'; } },
        perl:  { open: '',      close: '',   line: function (l) { return 'print "' + dq(l) + '\\n";'; } },
        sws:   { open: '',      close: '',   line: function (l) { return 'echo "' + dq(l) + '";'; } },
        php:   { open: '<?php', close: '?>', line: function (l) { return 'echo "' + dq(l) + '";'; } }
    };

    function wrapPerLine(fn) {
        var a = toLines(readInput());
        if (!a.length) { emit(''); return; }
        emit(a.map(fn).join('\n'));
    }

    w.tojs = function () {
        wrapPerLine(function (l) { return 'document.write("' + dq(l) + '");'; });
    };

    w.htmltoarray = function () {
        var a = toLines(readInput());
        if (!a.length) { emit(''); return; }
        emit('var htmlArr = new Array(\n'
            + a.map(function (l) { return '    "' + dq(l) + '"'; }).join(',\n')
            + '\n);');
    };

    /* JS → HTML，只认两种明确的 JS 形态，认不出就原样回显（不清空用户输入）：
         1) document.write("…")  —— tojs() 的输出，二者互逆
         2) 每行一个字符串字面量 —— htmltoarray() 的输出，也覆盖常见的数组写法
       刻意不做「抽取全文所有字符串」：那样会把 <div class="a"> 的 class 值也当内容。 */
    w.tohtml = function () {
        var src = readInput(), out = [], m, mm;

        var call = /document\.write\s*\(([^)]*)\)/g;
        while ((m = call.exec(src)) !== null) {
            var q = /(['"])((?:\\.|(?!\1)[\s\S])*?)\1/g;
            while ((mm = q.exec(m[1])) !== null) { out.push(unquote(mm[2])); }
        }
        if (out.length) { emit(out.join('\n')); return; }

        var line = /^\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1\s*,?\s*$/;
        var a = String(src).replace(/\r\n?/g, '\n').split('\n');
        for (var i = 0; i < a.length; i++) {
            var lm = line.exec(a[i]);
            if (lm) { out.push(unquote(lm[2])); }
        }
        emit(out.length ? out.join('\n') : src);
    };

    w.htmlCov = function (lang) {
        var spec = LANG[String(lang || '').toLowerCase()];
        if (!spec) { emit(''); return; }
        var a = toLines(readInput());
        if (!a.length) { emit(''); return; }
        var body = a.map(spec.line).join('\n');
        if (spec.open) { body = spec.open + '\n' + body + '\n' + spec.close; }
        emit(body);
    };

    w.tocsharp = function () {
        wrapPerLine(function (l) { return 'Response.Write("' + dq(l) + '");'; });
    };

    w.tojsp = function () {
        wrapPerLine(function (l) { return 'out.print("' + dq(l) + '");'; });
    };
})(window);
