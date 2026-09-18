/*!
 * 经典版 htaccess 转 nginx 实现（重建 htaccess2nginx()）
 *
 * 本文件由 D:/work/_ops/build-legacy-glue.py 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原 pcjs/htaccess2nginx.js 与 rewrite-conf.js 均不可追回；按常用指令集重建。
 *   - 多条件 RewriteCond 与部分 flag 在 nginx 无直接对应，输出里逐处注明需人工确认。
 */

/* ==========================================================================
 * 胶水：按 htaccess2nginx 页的契约重建
 *   输入 #content → 结果写入 #result，页面调用 htaccess2nginx(1)
 *   覆盖最常用的一批指令：RewriteEngine / RewriteCond + RewriteRule / Redirect /
 *   ErrorDocument / Options / Order+Deny+Allow / AddType / Header / ExpiresByType /
 *   DirectoryIndex / php_value 系列。其余指令原样保留并加 # 注释提示需人工确认。
 *
 *   两个必须说清楚的翻译限制（已写进输出顶部的提示）：
 *     1) nginx 的 if 不支持多条件 —— 多条 RewriteCond 时这里只按第一条生成 if，
 *        并明确注释告诉使用者需要改写成 map + set 形式；
 *     2) [QSA]/[NE]/[PT] 等 flag 在 nginx 里要么是默认行为、要么无对应物，
 *        统一以行内注释说明，不做静默丢弃。
 *   变量映射表见 VAR_MAP（%{HTTP_HOST} → $http_host 等）。
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

    var VAR_MAP = {
        'HTTP_HOST': '$http_host', 'SERVER_NAME': '$host', 'REQUEST_URI': '$request_uri',
        'QUERY_STRING': '$query_string', 'REQUEST_FILENAME': '$request_filename',
        'REQUEST_METHOD': '$request_method', 'REMOTE_ADDR': '$remote_addr',
        'HTTP_USER_AGENT': '$http_user_agent', 'HTTP_REFERER': '$http_referer',
        'HTTP_COOKIE': '$http_cookie', 'HTTPS': '$https', 'DOCUMENT_ROOT': '$document_root',
        'SERVER_PORT': '$server_port', 'SERVER_PROTOCOL': '$server_protocol'
    };

    function mapVars(s) {
        var out = String(s).replace(/%\{([A-Z_]+)\}/g, function (all, k) {
            return VAR_MAP[k] !== undefined ? VAR_MAP[k] : '/* ' + all + ' */';
        });
        /* Apache 的 %1/%2 是 RewriteCond 的捕获组，nginx 里对应 if 正则的 $1/$2。
           不转的话 nginx 会原样输出 %1，是个静默错误。 */
        return out.replace(/%([1-9])/g, '$$$1');
    }

    /* 兼容两种输入：带方括号的（RewriteRule 的 [L,R=301]）与裸 flag 串（RewriteCond 的 NC）。
       早先只认方括号，导致 [R=301] 与 NC 都被当成空 flag，permanent 与 ~* 全丢了。 */
    function flagsOf(raw) {
        var s = String(raw || '');
        var m = /\[([^\]]*)\]/.exec(s);
        var body = m ? m[1] : s;
        return body.split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x; });
    }

    function nginxFlags(flags, notes) {
        var last = false, code = null;
        for (var i = 0; i < flags.length; i++) {
            var f = flags[i].toUpperCase();
            if (f === 'L') { last = true; }
            else if (f === 'END') { last = true; }
            else if (f === 'R' || f === 'REDIRECT') { code = 302; }
            else if (/^R=\d+$/.test(f)) { code = parseInt(f.slice(2), 10); }
            else if (f === 'F' || f === 'FORBIDDEN') { code = 403; }
            else if (f === 'G' || f === 'GONE') { code = 410; }
            else if (f === 'NC') { notes.push('NC 在 nginx 里表现为条件用 ~*（大小写不敏感）'); }
            else if (f === 'QSA') { notes.push('QSA：nginx 的 rewrite 默认保留 query string，无需处理'); }
            else if (f === 'PT' || f === 'NE' || f === 'B' || f === 'DPI') { notes.push(f + '：nginx 无对应 flag，已忽略'); }
            else if (f.charAt(0) === 'E') { notes.push(f + '：nginx 需用 set 指令改写'); }
            else if (/^C$/.test(f)) { notes.push('C：nginx 无链式 flag 概念'); }
            else { notes.push(f + '：未识别的 flag，请人工确认'); }
        }
        return { last: last, code: code };
    }

    function condToIf(cond, notes) {
        /* RewriteCond <测试串> <匹配> [flags] */
        var m = /^\s*RewriteCond\s+(\S+)\s+(\S+)(?:\s+\[([^\]]*)\])?/i.exec(cond);
        if (!m) { return null; }
        var test = mapVars(m[1]);
        var pattern = m[2];
        var fl = flagsOf(m[3] || '');
        var neg = false;
        var op;

        if (pattern === '!-f') { return '!-f ' + test; }
        if (pattern === '!-d') { return '!-d ' + test; }
        if (pattern === '-f') { return '-f ' + test; }
        if (pattern === '-d') { return '-d ' + test; }
        if (pattern.charAt(0) === '!') { neg = true; pattern = pattern.slice(1); }

        if (fl.join(',').toUpperCase().indexOf('NC') >= 0) { op = '~*'; }
        else if (/^[A-Za-z0-9_.\-]+$/.test(pattern)) { op = '='; }
        else { op = '~'; }

        if (op === '=') { return (neg ? '!= ' : '= ') + test + ' "' + pattern + '"'; }
        return (neg ? '! ' : '') + test + ' ' + op + ' "' + pattern.replace(/"/g, '\\"') + '"';
    }

    function convert(src) {
        var lines = String(src).replace(/\r\n?/g, '\n').split('\n');
        var out = [];
        var conds = [];
        var notesAll = [];
        var multiCondWarned = false;

        out.push('# 由 htaccess 转换得到（htaccess转nginx）');
        out.push('# 转换自经典版工具，请对照原规则复核后再上线。');
        out.push('');

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) { out.push(''); continue; }
            if (line.charAt(0) === '#') { out.push(line); continue; }

            var notes = [];

            if (/^RewriteEngine\s+/i.test(line)) {
                out.push('# ' + line + '（nginx 的 rewrite 模块默认启用）');
                continue;
            }
            if (/^RewriteBase\s+/i.test(line)) {
                out.push('# ' + line + '：nginx 的路径前缀由 location 决定，请人工确认');
                continue;
            }
            if (/^RewriteCond\s+/i.test(line)) { conds.push(line); continue; }

            if (/^RewriteRule\s+/i.test(line)) {
                var rm = /^RewriteRule\s+(\S+)\s+(\S+)(?:\s+\[([^\]]*)\])?/i.exec(line);
                if (!rm) { out.push('# ' + line); continue; }
                var pat = rm[1], target = rm[2];
                var fl = flagsOf(rm[3] || '');
                var nf = nginxFlags(fl, notes);

                if (target === '-') {
                    if (nf.code) { out.push('return ' + nf.code + ';'); }
                    else { out.push('# RewriteRule ' + pat + ' -：仅作为后续规则的匹配条件，nginx 需用 location / if 另行表达'); }
                } else {
                    var mods = [];
                    if (nf.code === 301 || nf.code === 308) { mods.push('permanent'); }
                    else if (nf.code === 302 || nf.code === 307) { mods.push('redirect'); }
                    else if (nf.code === 403 || nf.code === 410) { mods.push('return ' + nf.code + ';'); }
                    else if (nf.last) { mods.push('last'); }

                    if (nf.code === 403 || nf.code === 410) {
                        out.push('return ' + nf.code + ';');
                    } else {
                        var stmt = 'rewrite ' + pat + ' ' + mapVars(target) + (mods.length ? ' ' + mods.join(' ') : '') + ';';
                        if (conds.length === 1) {
                            var condIf = condToIf(conds[0], notes);
                            out.push(condIf ? 'if (' + condIf + ') {' : '# ' + conds[0]);
                            out.push('    ' + stmt);
                            out.push('}');
                        } else if (conds.length > 1) {
                            var first = condToIf(conds[0], notes);
                            out.push('# 原 htaccess 在这里有 ' + conds.length + ' 条 RewriteCond；nginx 的 if 不支持多条件，');
                            out.push('# 常见做法是 map + set 组合，下面只按第一条生成，请务必人工复核：');
                            for (var ci = 1; ci < conds.length; ci++) { out.push('#   ' + conds[ci]); }
                            out.push('if (' + (first || 'true') + ') {');
                            out.push('    ' + stmt);
                            out.push('}');
                            if (!multiCondWarned) { notesAll.push('存在多条件 RewriteCond，已在对应位置注明'); multiCondWarned = true; }
                        } else {
                            out.push(stmt);
                        }
                    }
                }
                conds = [];
                if (notes.length) { out.push('#   ↳ ' + notes.join('；')); }
                continue;
            }

            var m2;
            if ((m2 = /^Redirect(?:Match)?\s+(?:permanent\s+|temp\s+)?(\d{3})?\s*(\S+)\s+(\S+)/i.exec(line))) {
                var code2 = m2[1] ? parseInt(m2[1], 10) : 302;
                if (code2 === 301 || code2 === 308) {
                    out.push('rewrite ' + m2[2] + ' ' + mapVars(m2[3]) + ' permanent;');
                } else {
                    out.push('rewrite ' + m2[2] + ' ' + mapVars(m2[3]) + ' redirect;');
                }
                continue;
            }
            if ((m2 = /^ErrorDocument\s+(\d{3})\s+(\S+)/i.exec(line))) {
                out.push('error_page ' + m2[1] + ' ' + m2[2] + ';');
                continue;
            }
            if ((m2 = /^Options\s+(.*)$/i.exec(line))) {
                var opt = m2[1];
                if (/-Indexes/i.test(opt)) { out.push('autoindex off;'); }
                if (/\+Indexes|(^|\s)Indexes/i.test(opt)) { out.push('autoindex on;'); }
                if (/-FollowSymLinks|\+FollowSymLinks|FollowSymLinks/i.test(opt)) {
                    out.push('# FollowSymLinks：nginx 由 disable_symlinks 控制，默认允许');
                }
                if (/-MultiViews|MultiViews/i.test(opt)) { out.push('# MultiViews：nginx 无对应指令'); }
                continue;
            }
            if (/^<IfModule[^>]*>\s*$/i.test(line) || /^<\/IfModule>/i.test(line)) { continue; }
            if (/^Order\s+/i.test(line)) {
                out.push('# ' + line + ' → 见下面的 allow / deny');
                continue;
            }
            if (/^Deny\s+from\s+all/i.test(line)) { out.push('deny all;'); continue; }
            if (/^Allow\s+from\s+all/i.test(line)) { out.push('allow all;'); continue; }
            if ((m2 = /^Deny\s+from\s+(\S+)/i.exec(line))) { out.push('deny ' + m2[1] + ';'); continue; }
            if ((m2 = /^Allow\s+from\s+(\S+)/i.exec(line))) { out.push('allow ' + m2[1] + ';'); continue; }
            if ((m2 = /^AddType\s+(\S+)\s+(\S+)/i.exec(line))) {
                /* nginx 的 types 块是「MIME 在前、扩展名在后」，且扩展名不带点 */
                out.push('# ' + line + ' → 放入 types 块：');
                out.push('#   types { ' + m2[1] + ' ' + m2[2].replace(/^\./, '') + '; }');
                continue;
            }
            if ((m2 = /^AddHandler\s+(\S+)\s+(\S+)/i.exec(line))) {
                out.push('# ' + line + ' → nginx 需用 location ~ \\.' + m2[2].replace(/^\./, '') + '$ { ... } 处理');
                continue;
            }
            if ((m2 = /^Header\s+(set|append|add)\s+(\S+)\s+(.*)$/i.exec(line))) {
                out.push('add_header ' + m2[2] + ' ' + m2[3] + ' always;');
                continue;
            }
            if ((m2 = /^ExpiresByType\s+(\S+)\s+"?([^"]+)"?/i.exec(line))) {
                out.push('location ~* \\.' + m2[1].split('/').pop() + '$ { expires ' + m2[2] + '; }');
                continue;
            }
            if (/^DirectoryIndex\s+/i.test(line)) { out.push('index ' + line.replace(/^DirectoryIndex\s+/i, '') + ';'); continue; }
            if (/^php_value\s+/i.test(line) || /^php_flag\s+/i.test(line)) {
                out.push('# ' + line + '：PHP-FPM 需在 pool 配置里设置，nginx 不直接支持');
                continue;
            }
            if (/^SetEnv\s+/i.test(line)) { out.push('#' + line + ' → nginx 用 fastcgi_param 或 set 表达'); continue; }

            out.push('# ' + line + '（未识别，请人工确认）');
        }

        var body = out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
        if (notesAll.length) {
            body = body.replace(/^(# 由 htaccess 转换得到[\s\S]*?\n)/,
                '$1# 注意：' + notesAll.join('；') + '\n');
        }
        return body;
    }

    w.htaccess2nginx = function () { emit(convert(readText())); };

    w.__legacyFormat = w.__legacyFormat || {};
    w.__legacyFormat.htaccessToNginx = convert;
})(window);
