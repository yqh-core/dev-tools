/*!
 * 经典版 VBScript 格式化实现（重建 beautify()）
 *
 * 本文件由 build-legacy-glue.py（仓库外构建脚本） 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原 vbsformat.js 不可追回；按关键字块缩进规则重建。
 */

/* ==========================================================================
 * 胶水：按 formatvbs 的调用契约重建  beautify()  —— VBScript 代码缩进美化
 *   原 vbsformat.js 不可追回；此处实现基于关键字块的缩进器：
 *     增加缩进：Sub / Function / If..Then(行尾) / For / Do / While / Select Case / With / Class / Property / Type / Try
 *     减少缩进：End 系列 / Next / Loop / Wend / Else / ElseIf / Case
 *   「If ... Then 后面还有语句」视为单行 If，不增加缩进。
 * ========================================================================== */
(function (w) {
    'use strict';

    var DEC = /^(end\s+(if|sub|function|with|select|class|property|type|enum)|next|loop|wend|else|elseif|case)\b/i;
    var MID = /^(else|elseif|case)\b/i;                       // 先减后加
    var INC = /^(if\b.*\bthen\s*$|for\b|do\b|while\b|select\s+case\b|with\b|sub\b|function\b|class\b|property\b|type\b|enum\b|try\b)/i;
    var CONT = /^(_|&)\s*$/;                                  // 续行

    function out(s) {
        if (typeof w.hightout === 'function') { w.hightout(s); return; }
        var r = document.getElementById('result');
        if (r) { r.textContent = (s === undefined || s === null) ? '' : String(s); }
    }

    function indentVbs(src) {
        var lines = String(src).replace(/\r\n?/g, '\n').split('\n');
        var unit = '\t', ind = 0, res = [];
        for (var i = 0; i < lines.length; i++) {
            var raw = lines[i].replace(/\s+$/, '');
            var t = raw.replace(/^\s+/, '');
            if (t === '') { res.push(''); continue; }
            var dec = DEC.test(t), mid = MID.test(t);
            if (dec && !mid) { ind = Math.max(0, ind - 1); }
            if (mid) { res.push(new Array(Math.max(0, ind - 1) + 1).join(unit) + t); }
            else { res.push(new Array(ind + 1).join(unit) + t); }
            if (mid) { continue; }
            if (INC.test(t) && !/then\s+\S/i.test(t)) { ind += 1; }
        }
        return res.join('\n');
    }

    w.beautify = function () {
        var ta = document.getElementById('content');
        out(indentVbs(ta ? String(ta.value || '') : ''));
    };
    w.indentVbs = indentVbs;
})(window);
