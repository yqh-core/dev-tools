/*!
 * 经典版多语言代码格式化实现（重建 beautify() / Clean()）
 *
 * 本文件由 build-legacy-glue.py（仓库外构建脚本） 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原 allformat_html.js 不可追回；这五个页（C#/Java/Perl/Python/Ruby）共用它。
 *   - 输入 #code，选项取自 #tabsize / #max-preserve-newlines / #wrap-line-length / #brace-style。
 */

/* ==========================================================================
 * 胶水：按 formatcs / formatjava / formatperl / formatpy / formatruby 的契约重建
 *   输入 #code（CodeMirror 由页面自身的内联脚本 fromTextArea 初始化）
 *   选项： #tabsize / #max-preserve-newlines / #wrap-line-length / #brace-style
 *   调用： beautify() / Clean()
 *
 * 三件事：
 *   1) 页面内联初始化写成 `the.editor = CodeMirror.fromTextArea(...)`，依赖丢失脚本
 *      提供的全局 `the`；这里占位，并在其缺失时兜底自建实例。
 *   2) 输出目标：这五页没有 #result，结果按原契约「就地回写」到编辑器。
 *   3) 引擎按语言分流（关键，见下）。
 *
 * 引擎为什么必须分流：
 *   js-beautify 是 JS / CSS / HTML 美化器，靠**花括号**判定块结构，页面的
 *   brace-style / wrap-line-length / max-preserve-newlines 三个下拉框就是它的选项。
 *   对 C# / Java / Perl 这类花括号语言它完全够用；
 *   但 Python 靠「冒号 + 缩进」判块、Ruby 靠 end 关键字判块，js-beautify 识别不了，
 *   实测会把 Python 的 `return x` 顶格 —— 那是**改坏用户代码**，不是格式化。
 *   因此这两个语言改用下面的块结构重新缩进器：
 *     只重算每行的行首空白，行内内容一个字符都不动。
 *     Python 的语义完全由缩进表达，而缩进由块关键字推导；Ruby 的语义与缩进无关。
 * ========================================================================== */
(function (w) {
    'use strict';

    w.the = w.the || {};

    function $id(id) { return document.getElementById(id); }
    function sel(id, dflt) { var e = $id(id); return e && e.value !== '' ? e.value : dflt; }
    function selInt(id, dflt) { var v = parseInt(sel(id, dflt), 10); return isNaN(v) ? dflt : v; }

    /* ------------------------- 语言识别 ------------------------- */
    function detectLang() {
        var p = String((w.location && w.location.pathname) || '').toLowerCase();
        var m = p.match(/\/format([a-z]+)/);
        if (m) { return m[1]; }
        var t = String(document.title || '').toLowerCase();
        if (t.indexOf('python') >= 0) { return 'py'; }
        if (t.indexOf('ruby') >= 0) { return 'ruby'; }
        if (t.indexOf('perl') >= 0) { return 'perl'; }
        if (t.indexOf('c#') >= 0 || t.indexOf('csharp') >= 0) { return 'cs'; }
        if (t.indexOf('c++') >= 0) { return 'cpp'; }
        if (t.indexOf('java') >= 0 && t.indexOf('script') < 0) { return 'java'; }
        return 'c';
    }

    /* ------------------- 通用扫描（引号感知） ------------------- */
    function stripComment(s, marks) {
        var q = null;
        for (var i = 0; i < s.length; i++) {
            var c = s.charAt(i);
            if (q) {
                if (c === '\\') { i += 1; continue; }
                if (c === q) { q = null; }
                continue;
            }
            if (marks.indexOf(c) >= 0) { return s.slice(0, i); }
            if (c === '"' || c === "'" || c === '`') { q = c; }
        }
        return s;
    }

    function bracketDelta(s) {
        var q = null, d = 0;
        for (var i = 0; i < s.length; i++) {
            var c = s.charAt(i);
            if (q) {
                if (c === '\\') { i += 1; continue; }
                if (c === q) { q = null; }
                continue;
            }
            if (c === '"' || c === "'" || c === '`') { q = c; continue; }
            if (c === '(' || c === '[' || c === '{') { d += 1; }
            else if (c === ')' || c === ']' || c === '}') { d -= 1; }
        }
        return d;
    }

    function pad(unit, level) {
        var s = '';
        for (var i = 0; i < level; i++) { s += unit; }
        return s;
    }

    function countOcc(s, sub) {
        var n = 0, i = 0, j;
        while ((j = s.indexOf(sub, i)) >= 0) { n += 1; i = j + sub.length; }
        return n;
    }

    function collapseBlanks(lines, maxBlank) {
        if (maxBlank < 0) { return lines; }
        var out = [], run = 0;
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].replace(/\s/g, '') === '') {
                run += 1;
                if (run <= maxBlank) { out.push(''); }
            } else {
                run = 0;
                out.push(lines[i]);
            }
        }
        return out;
    }

    /* ======================================================================
     * Python：按「冒号开块 + 缩进」重排行首缩进
     *   - elif / else / except / finally 先回退一级（它们与对应的 if/try 同级）
     *   - match/case：case 与上一个 case 同级
     *   - 三引号字符串内部、整行注释不参与块判定
     *   - 括号未闭合的续行按括号深度加一级；以闭括号开头的行减一级
     * ====================================================================== */
    function reindentPython(text, unit, maxBlank) {
        var DQ3 = '"' + '"' + '"';
        var SQ3 = "'" + "'" + "'";
        var lines = collapseBlanks(String(text).replace(/\r\n?/g, '\n').split('\n'), maxBlank);
        var out = [], stack = [], bracket = 0, triple = null;

        function tripleMark(st) {
            var a = st.indexOf(DQ3), b = st.indexOf(SQ3);
            if (a < 0 && b < 0) { return null; }
            if (a < 0) { return SQ3; }
            if (b < 0) { return DQ3; }
            return a < b ? DQ3 : SQ3;
        }

        for (var i = 0; i < lines.length; i++) {
            var raw = lines[i];
            var st = raw.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
            if (st === '') { out.push(''); continue; }

            if (triple) {
                if (countOcc(st, triple) % 2 === 1) {
                    var mark = triple;
                    triple = null;
                    /* 只由三引号收尾（后面可能跟 , ) ] } ）的行：按当前块缩进对齐，
                       这样 docstring 的收尾引号不会与函数体错位；文档内容行仍原样保留。 */
                    var rest = st.split(mark).join('').replace(/[,)\]}]+\s*$/, '');
                    if (rest.replace(/\s/g, '') === '') {
                        out.push(pad(unit, stack.length + bracket) + st);
                        continue;
                    }
                }
                out.push(raw);
                continue;
            }
            var tm = tripleMark(st);
            if (tm && countOcc(st, tm) % 2 === 1) { triple = tm; }

            var commentOnly = st.charAt(0) === '#';
            var code = stripComment(st, '#').replace(/[ \t]+$/, '');
            var fw = (code.match(/^[A-Za-z_][A-Za-z0-9_]*/) || [''])[0];
            var extra = bracket;

            if (commentOnly) {
                out.push(pad(unit, stack.length + extra) + st);
                continue;
            }

            if (fw === 'elif' || fw === 'else' || fw === 'except' || fw === 'finally') {
                if (stack.length) { stack.pop(); }
            } else if (fw === 'case' && stack.length && stack[stack.length - 1] === 'case') {
                stack.pop();
            }
            if (/^[)\]}]/.test(code)) { extra = Math.max(0, bracket - 1); }
            bracket = Math.max(0, bracket + bracketDelta(code));

            out.push(pad(unit, stack.length + extra) + st);

            if (bracket === 0 && /:$/.test(code) && !/::$/.test(code)) {
                stack.push(fw === 'case' ? 'case' : 'block');
            }
        }
        return out.join('\n');
    }

    /* ======================================================================
     * Ruby：按块关键字（def/class/if/… ↔ end）与 do / 花括号重排缩进
     *   - end 回退一级；else/elsif/when/rescue/ensure 回退一级后重新开块
     *   - 只认行首关键字，因此 `x = 1 if y` 这类修饰语写法不会被误判成块开头
     *   - private/protected/public 前缀会被跳过（`private def foo` 仍识别为 def）
     *   - `def f; end` 这类同行收尾的块不产生缩进
     * ====================================================================== */
    function reindentRuby(text, unit, maxBlank) {
        var lines = collapseBlanks(String(text).replace(/\r\n?/g, '\n').split('\n'), maxBlank);
        var out = [], level = 0, bracket = 0, pending = false;
        var OPENERS = { 'class': 1, 'module': 1, 'def': 1, 'if': 1, 'unless': 1, 'while': 1, 'until': 1, 'case': 1, 'begin': 1, 'for': 1 };
        var MIDDLE = { 'else': 1, 'elsif': 1, 'when': 1, 'rescue': 1, 'ensure': 1 };

        for (var i = 0; i < lines.length; i++) {
            var raw = lines[i];
            var st = raw.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
            if (st === '') { out.push(''); continue; }

            var code = stripComment(st, '#').trim();
            var extra = bracket;
            if (/^[)\]}]/.test(code)) { extra = Math.max(0, bracket - 1); }

            if (code !== '') {
                var fwm = code.match(/^(?:(?:private|public|protected|module_function)\s+)*([A-Za-z_][A-Za-z0-9_]*)/);
                var fw = fwm ? fwm[1] : '';
                var isEnd = /^end\b/.test(code);
                if (isEnd) { level = Math.max(0, level - 1); }
                else if (MIDDLE[fw]) { level = Math.max(0, level - 1); }

                out.push(pad(unit, level + extra) + st);

                var selfEnd = /\bend$/.test(code) && !isEnd;
                var opensByKeyword = !selfEnd && !isEnd &&
                    (!!OPENERS[fw] || !!MIDDLE[fw] || /\bdo\s*(\|[^|]*\|)?\s*$/.test(code));
                var opensByBrace = /[{\[(]\s*$/.test(code);
                bracket = Math.max(0, bracket + bracketDelta(code));

                if (opensByKeyword) {
                    if (bracket === 0) { level += 1; } else { pending = true; }
                } else if (pending && bracket === 0) {
                    level += 1;
                    pending = false;
                }
                if (bracket === 0 && !opensByKeyword) { pending = false; }
                void opensByBrace;
            } else {
                out.push(pad(unit, level + extra) + st);
            }
        }
        return out.join('\n');
    }

    /* ------------------------- 编辑器与输出 ------------------------- */
    function editor() {
        if (w.the && w.the.editor) { return w.the.editor; }
        var host = document.querySelector('.CodeMirror');
        return host ? host.CodeMirror : null;
    }

    function readCode() {
        var ed = editor();
        if (ed) { return ed.getValue(); }
        var t = $id('code') || $id('content');
        return t ? String(t.value || '') : '';
    }

    /* 输出目标：这五个页面没有 #result，结果按原契约「就地回写」到 CodeMirror 编辑器
       （页面用 fromTextArea 把 #code 换成编辑器，复制/清空都是对编辑器操作）。
       若某天页面改成 #result 输出，这里也能兼容。 */
    function emit(s) {
        s = (s === undefined || s === null) ? '' : String(s);
        var ed = editor();
        if (ed) { ed.setValue(s); return; }
        var t = $id('code') || $id('content');
        if (t && t.value !== undefined) { t.value = s; return; }
        var r = $id('result');
        if (r) { r.textContent = s; }
    }

    /* 兜底初始化：页面内联脚本若因 CodeMirror 未就绪而失败，这里补建编辑器 */
    function ensureEditor() {
        if (editor() || typeof w.CodeMirror === 'undefined') { return; }
        var ta = $id('code');
        if (!ta) { return; }
        var mode = (ta.getAttribute('data-mode') || document.title || '').toLowerCase();
        var m = 'text/x-csrc';
        if (mode.indexOf('java') >= 0 && mode.indexOf('script') < 0) { m = 'text/x-java'; }
        if (mode.indexOf('perl') >= 0) { m = 'text/x-perl'; }
        if (mode.indexOf('python') >= 0) { m = 'text/x-python'; }
        if (mode.indexOf('ruby') >= 0) { m = 'text/x-ruby'; }
        if (mode.indexOf('c#') >= 0 || mode.indexOf('csharp') >= 0) { m = 'text/x-csharp'; }
        w.the.editor = w.CodeMirror.fromTextArea(ta, { lineNumbers: true, mode: m });
        w.editor = w.the.editor;
    }

    w.beautify = function () {
        ensureEditor();
        var code = readCode();
        var size = selInt('tabsize', 4);
        var unit = (size === 1) ? '\t' : pad(' ', size);
        var maxBlank = selInt('max-preserve-newlines', -1);
        var lang = detectLang();
        var res;

        if (lang === 'py') {
            res = reindentPython(code, unit, maxBlank);
        } else if (lang === 'ruby') {
            res = reindentRuby(code, unit, maxBlank);
        } else {
            var opts = {
                indent_size: (size === 1) ? 4 : size,
                indent_with_tabs: size === 1,
                wrap_line_length: selInt('wrap-line-length', 0),
                brace_style: sel('brace-style', 'collapse'),
                max_preserve_newlines: maxBlank,
                preserve_newlines: true
            };
            res = w.js_beautify(code, opts);
        }
        emit(res);
    };

    w.Clean = function () {
        emit('');
    };

    w.autoFormatProxy = function () { w.beautify(); };

    /* 供测试直接调用（rebuild 脚本的单元测试会用到） */
    w.__legacyFormat = {
        detectLang: detectLang,
        python: reindentPython,
        ruby: reindentRuby
    };

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', ensureEditor); }
    else { ensureEditor(); }
})(window);
