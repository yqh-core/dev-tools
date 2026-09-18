/*!
 * 经典版 SQL 转 Java 实体类实现（重建 change() / demo()）
 *
 * 本文件由 D:/work/_ops/build-legacy-glue.py 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原 pcjs/sql2java.js 不可追回；解析 CREATE TABLE 列定义并按 TYPE_MAP 做类型映射。
 */

/* ==========================================================================
 * 胶水：按 sql2java 页（SQL 转 Java 实体类）的契约重建
 *   输入 #content → 结果写入 #result，页面调用 change() / demo()
 *   解析 CREATE TABLE 的列定义 → 生成字段与 getter/setter，行尾保留原 SQL 类型注释。
 *   类型映射见 TYPE_MAP（顺序敏感：tinyint(1) 必须先于 tinyint 匹配）。
 *   跳过 primary key / unique / index / constraint 等约束行。
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

    var TYPE_MAP = [
        [/^(tinyint\s*\(\s*1\s*\)|bit|boolean|bool)/i, 'Boolean'],
        [/^(tinyint|smallint|mediumint)/i, 'Integer'],
        [/^(int|integer)/i, 'Integer'],
        [/^bigint/i, 'Long'],
        [/^(decimal|numeric|money)/i, 'BigDecimal'],
        [/^float/i, 'Float'],
        [/^(double|real)/i, 'Double'],
        [/^(date|time|datetime|timestamp)/i, 'Date'],
        [/^(text|tinytext|mediumtext|longtext|varchar|char|nvarchar|clob|blob|json|enum)/i, 'String']
    ];
    var KEYWORDS = ['abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class',
        'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally',
        'float', 'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long',
        'native', 'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static',
        'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try',
        'void', 'volatile', 'while'];

    function javaType(sqlType) {
        for (var i = 0; i < TYPE_MAP.length; i++) {
            if (TYPE_MAP[i][0].test(sqlType)) { return TYPE_MAP[i][1]; }
        }
        return 'String';
    }

    function camel(name) {
        var parts = String(name).split(/[_\-\s]+/).filter(function (x) { return x !== ''; });
        var out = parts[0] ? parts[0].charAt(0).toLowerCase() + parts[0].slice(1).toLowerCase() : 'field';
        for (var i = 1; i < parts.length; i++) {
            out += parts[i].charAt(0).toUpperCase() + parts[i].slice(1).toLowerCase();
        }
        if (KEYWORDS.indexOf(out) >= 0) { out += 'Field'; }   /* 撞 Java 关键字就改名 */
        return out;
    }

    function pascal(name) {
        var c = camel(name);
        return c.charAt(0).toUpperCase() + c.slice(1);
    }

    /* 取 CREATE TABLE 的第一个配对括号里的内容，再按「顶层逗号」切列 */
    function parseCreate(sql) {
        sql = String(sql);
        var m = /create\s+table\s+(?:if\s+not\s+exists\s+)?[`"\[\]]?(\w+)[`"\[\]]?/i.exec(sql);
        var table = m ? m[1] : 'Entity';
        var open = sql.indexOf('(');
        var body = '';
        if (open >= 0) {
            var depth = 0;
            for (var j = open; j < sql.length; j++) {
                if (sql.charAt(j) === '(') { depth++; }
                else if (sql.charAt(j) === ')') {
                    depth--;
                    if (depth === 0) { body = sql.slice(open + 1, j); break; }
                }
            }
        }
        var cols = [];
        var lines = body.split(/,(?![^()]*\))/);
        for (var k = 0; k < lines.length; k++) {
            var L = lines[k].trim();
            if (!L || /^(primary|unique|key|index|constraint|foreign|check)\b/i.test(L)) { continue; }
            var cm = /^[`"\[\]]?(\w+)[`"\[\]]?\s+([A-Za-z]+(?:\s*\([^)]*\))?(?:\s+unsigned)?)/.exec(L);
            if (!cm) { continue; }
            cols.push({ name: cm[1], type: cm[2].replace(/\s+/g, ' ') });
        }
        return { table: table, cols: cols };
    }

    function toJava(parsed) {
        var cls = pascal(parsed.table);
        var out = ['public class ' + cls + ' {', ''];
        var i, c, jt, fields = [], decls = [], longestDecl = 0;
        for (i = 0; i < parsed.cols.length; i++) {
            fields.push(camel(parsed.cols[i].name));
        }
        /* 对齐要按「整条声明」算：类型长度不同（Integer / String / BigDecimal），
           只按字段名补齐，注释列还是参差不齐 */
        for (i = 0; i < parsed.cols.length; i++) {
            var decl = 'private ' + javaType(parsed.cols[i].type) + ' ' + fields[i] + ';';
            decls.push(decl);
            if (decl.length > longestDecl) { longestDecl = decl.length; }
        }
        for (i = 0; i < parsed.cols.length; i++) {
            c = parsed.cols[i];
            out.push('    ' + decls[i]
                + new Array(longestDecl - decls[i].length + 1).join(' ')
                + ' // ' + c.type);
        }
        out.push('');
        for (i = 0; i < parsed.cols.length; i++) {
            c = parsed.cols[i];
            jt = javaType(c.type);
            out.push('    public ' + jt + ' get' + pascal(c.name) + '() {');
            out.push('        return ' + fields[i] + ';');
            out.push('    }');
            out.push('');
            out.push('    public void set' + pascal(c.name) + '(' + jt + ' ' + fields[i] + ') {');
            out.push('        this.' + fields[i] + ' = ' + fields[i] + ';');
            out.push('    }');
            if (i !== parsed.cols.length - 1) { out.push(''); }
        }
        out.push('}');
        return out.join('\n');
    }

    w.change = function () {
        var sql = readText();
        if (!sql.trim()) { emit(''); return; }
        var parsed = parseCreate(sql);
        if (!parsed.cols.length) { emit('没有解析到列定义。请贴入完整的 CREATE TABLE 语句。'); return; }
        emit(toJava(parsed));
    };

    w.demo = function () {
        var ta = $id('content');
        if (!ta) { return; }
        ta.value = [
            'CREATE TABLE `sys_user` (',
            '  `id` int(11) NOT NULL AUTO_INCREMENT,',
            '  `user_name` varchar(64) NOT NULL COMMENT \'登录名\',',
            '  `age` tinyint(3) unsigned DEFAULT 0,',
            '  `balance` decimal(10,2) DEFAULT 0.00,',
            '  `enabled` tinyint(1) DEFAULT 1,',
            '  `created_at` datetime DEFAULT NULL,',
            '  PRIMARY KEY (`id`),',
            '  UNIQUE KEY `uk_name` (`user_name`)',
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
        ].join('\n');
        w.change();
    };
})(window);
