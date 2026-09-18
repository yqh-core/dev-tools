/*!
 * 经典版 CSV/Excel 转 HTML 表格实现（重建 dataToTable()）
 *
 * 本文件由 D:/work/_ops/build-legacy-glue.py 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原 pcjs/csv2table.js 不可追回；分隔符自动判定，支持引号包裹字段与引号转义。
 */

/* ==========================================================================
 * 胶水：按 htmlfromcsv 页（excel/csv 转 html 表格）的契约重建
 *   输入 #content → 结果写入 #result，页面调用 dataToTable()
 *   分隔符自动判定（制表符 / 分号 / 逗号，取首行里出现最多的那个）；
 *   支持双引号包裹字段与 "" 转义；单元格内容做 HTML 转义。
 *   不假设首行是表头（一律 <td>）——「首行即表头」是猜测，猜错会改坏用户数据。
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

    function pickDelim(text) {
        var first = text.split('\n')[0] || '';
        var t = (first.match(/\t/g) || []).length;
        var c = (first.match(/,/g) || []).length;
        var s = (first.match(/;/g) || []).length;
        if (t > 0 && t >= c && t >= s) { return '\t'; }
        return (s > c) ? ';' : ',';
    }

    function parseCsv(text, d) {
        var rows = [], row = [], field = '', i = 0, inQuote = false, c;
        while (i < text.length) {
            c = text.charAt(i);
            if (inQuote) {
                if (c === '"') {
                    if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
                    inQuote = false; i++; continue;
                }
                field += c; i++; continue;
            }
            if (c === '"' && field === '') { inQuote = true; i++; continue; }
            if (c === d) { row.push(field); field = ''; i++; continue; }
            if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
            if (c === '\r') { i++; continue; }
            field += c; i++;
        }
        if (field !== '' || row.length) { row.push(field); rows.push(row); }
        return rows;
    }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function toTable(text) {
        text = String(text).replace(/\r\n?/g, '\n').replace(/\n+$/, '');
        if (!text) { return ''; }
        var rows = parseCsv(text, pickDelim(text));
        var out = ['<table border="1" cellspacing="0" cellpadding="4">'], i, j;
        for (i = 0; i < rows.length; i++) {
            out.push('  <tr>');
            for (j = 0; j < rows[i].length; j++) {
                out.push('    <td>' + esc(rows[i][j]) + '</td>');
            }
            out.push('  </tr>');
        }
        out.push('</table>');
        return out.join('\n');
    }

    w.dataToTable = function () { emit(toTable(readText())); };

    w.__legacyFormat = w.__legacyFormat || {};
    w.__legacyFormat.csvToTable = toTable;
})(window);
