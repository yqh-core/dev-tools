/*!
 * 经典版涂鸦画板实现（重建 clearAll / re_draw / saveImageInfo）
 *
 * 本文件由 build-legacy-glue.py（仓库外构建脚本） 生成，请勿手改。
 * 经典版(legacy)的静态脚本在从老 PHP 站迁移时整体丢失（源站从未入库），
 * 此处按页面的调用契约重建：公开库按原样取回，自研胶水按契约重写。
 *
 * 组成来源：
 *   - 原画板逻辑在 huaban/ 的四个脚本里（zepto / ocanvas / ga / hotkeys），全部不可追回。
 *   - 这里用原生 canvas 2D 重写，并把三个 onclick 函数挂回全局；画笔画笔工具条在运行时动态补，
 *   - 页面 HTML 未改动（原 DOM 里本来就没有颜色/粗细控件）。
 *   - 撤销走画布快照，栈上限 10 步。
 */

/* ==========================================================================
 * 胶水：按 tuya 页（在线涂鸦画板）的契约重建
 *   页面元素：<canvas id="canvas" width="1000" height="500"> 与三个按钮
 *     onclick="clearAll()"      清空
 *     onclick="re_draw()"       撤销（页面内联另外绑了 Ctrl+Z）
 *     onclick="saveImageInfo()" 保存（Ctrl+S）
 *   原画板逻辑在 huaban/ 下的四个脚本里（zepto / ocanvas / ga / hotkeys），全部不可追回；
 *   这里用原生 canvas 2D 重写，并把 re_draw / saveImageInfo / clearAll 挂回全局。
 *
 *   两处必须说明的取舍：
 *     1 原页面 DOM 里**没有任何画笔控件**（颜色/粗细由丢失的脚本自己造），所以这里
 *       在画布上方动态补一条工具条（8 色 + 粗细滑杆）。页面的 HTML 一个字没动。
 *     2 撤销用画布快照（getImageData），栈上限 10 步 —— 1000×500 的快照约 2MB，
 *       再深会明显吃内存。
 *   saveImageInfo() 返回 dataURL，供自动化验收直接断言（不依赖下载行为）。
 * ========================================================================== */
(function (w) {
    'use strict';

    var PALETTE = ['#000000', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#ffffff'];
    var MAX_UNDO = 10;
    var color = PALETTE[0], size = 3, undo = [], drawing = false, lastX = 0, lastY = 0;

    function cv() { return document.getElementById('canvas'); }
    function g2d() { var c = cv(); return (c && c.getContext) ? c.getContext('2d') : null; }
    function state() { return (w.__legacyTuya = w.__legacyTuya || { color: function () { return color; },
                                                               size: function () { return size; },
                                                               depth: function () { return undo.length; },
                                                               palette: PALETTE }); }

    function push() {
        var c = cv(), g = g2d();
        if (!c || !g || !g.getImageData) { return; }
        try {
            undo.push(g.getImageData(0, 0, c.width, c.height));
            if (undo.length > MAX_UNDO) { undo.shift(); }
        } catch (e) { /* 跨域画布等异常：撤销功能退化，不影响画 */ }
    }

    function paint(x0, y0, x1, y1) {
        var g = g2d();
        if (!g) { return; }
        g.strokeStyle = color;
        g.lineWidth = size;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
    }
    function dot(x, y) { paint(x, y, x + 0.01, y + 0.01); }

    function pos(e) {
        var c = cv();
        var r = (c && c.getBoundingClientRect) ? c.getBoundingClientRect() : { left: 0, top: 0, width: c ? c.width : 1, height: c ? c.height : 1 };
        var sx = r.width ? (c.width / r.width) : 1;
        var sy = r.height ? (c.height / r.height) : 1;
        return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
    }

    function down(e) { push(); drawing = true; var p = pos(e); lastX = p.x; lastY = p.y; dot(p.x, p.y); }
    function move(e) {
        if (!drawing) { return; }
        var p = pos(e);
        paint(lastX, lastY, p.x, p.y);
        lastX = p.x; lastY = p.y;
    }
    function up() { drawing = false; }
    function touch(e) {
        if (!e.touches || !e.touches.length) { return; }
        if (e.preventDefault) { e.preventDefault(); }
        return e.touches[0];
    }

    /* ---------------- 页面契约 ---------------- */
    w.re_draw = function () {                       /* 撤销 */
        var g = g2d();
        if (!g || !undo.length) { return false; }
        var img = undo.pop();
        try { g.putImageData(img, 0, 0); } catch (e) { return false; }
        return true;
    };

    w.clearAll = function () {                      /* 清空（清空本身也可撤销） */
        var c = cv(), g = g2d();
        if (!c || !g) { return false; }
        push();
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, c.width, c.height);
        return true;
    };

    w.saveImageInfo = function () {                 /* 保存为 PNG */
        var c = cv();
        if (!c || !c.toDataURL) { return ''; }
        var url;
        try { url = c.toDataURL('image/png'); } catch (e) { return ''; }
        try {
            var a = document.createElement('a');
            var d = new Date();
            var pad = function (n) { return (n < 10 ? '0' : '') + n; };
            var name = 'tuya-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
                       pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.png';
            if (a) {
                a.href = url;
                a.download = name;
                if (a.setAttribute) { a.setAttribute('download', name); }
                if (document.body && document.body.appendChild) { document.body.appendChild(a); }
                if (a.click) { a.click(); }
                if (document.body && document.body.removeChild) { document.body.removeChild(a); }
            }
        } catch (e) { /* 下载被拦：仍返回 dataURL */ }
        state().lastSave = url;
        return url;
    };

    /* ---------------- 画笔工具条（页面 DOM 原本没有，动态补） ---------------- */
    function setColor(c) {
        color = c;
        var bar = document.getElementById('dd-tuya-tools');
        if (!bar || !bar.querySelectorAll) { return; }
        var sw = bar.querySelectorAll('.dd-tuya-swatch');
        for (var i = 0; i < sw.length; i++) {
            var on = sw[i].getAttribute('data-color') === c;
            sw[i].style.boxShadow = on ? '0 0 0 2px #0f766e' : 'none';
        }
    }
    function setSize(n) { size = Math.min(30, Math.max(1, parseInt(n, 10) || 1)); }

    function buildBar() {
        var c = cv();
        if (!c || !c.parentNode || document.getElementById('dd-tuya-tools')) { return; }
        var bar = document.createElement('div');
        bar.id = 'dd-tuya-tools';
        bar.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0;font-size:13px;';
        var t = document.createElement('span');
        t.textContent = '画笔：';
        bar.appendChild(t);
        for (var i = 0; i < PALETTE.length; i++) {
            (function (col) {
                var b = document.createElement('span');
                b.className = 'dd-tuya-swatch';
                if (b.setAttribute) { b.setAttribute('data-color', col); }
                b.title = col;
                b.style.cssText = 'width:20px;height:20px;border-radius:50%;border:1px solid #ccc;' +
                    'display:inline-block;cursor:pointer;background:' + col;
                b.onclick = function () { setColor(col); };
                bar.appendChild(b);
            })(PALETTE[i]);
        }
        var r = document.createElement('input');
        r.type = 'range';
        r.min = '1'; r.max = '30'; r.value = String(size);
        r.id = 'dd-tuya-size';
        r.onchange = r.oninput = function () { setSize(r.value); };
        bar.appendChild(r);
        var tip = document.createElement('span');
        tip.style.color = '#888';
        tip.textContent = '（Ctrl+Z 撤销 / Ctrl+S 保存）';
        bar.appendChild(tip);
        c.parentNode.insertBefore(bar, c);
    }

    function init() {
        var c = cv();
        if (!c || c.__legacyTuya) { return false; }
        var g = g2d();
        if (!g) { return false; }
        c.__legacyTuya = true;
        try {
            g.fillStyle = '#ffffff';
            g.fillRect(0, 0, c.width, c.height);
        } catch (e) { /* noop */ }
        if (c.addEventListener) {
            c.addEventListener('mousedown', down, false);
            c.addEventListener('mousemove', move, false);
            c.addEventListener('mouseup', up, false);
            c.addEventListener('mouseleave', up, false);
            c.addEventListener('touchstart', function (e) { var t = touch(e); if (t) { down(t); } }, false);
            c.addEventListener('touchmove', function (e) { var t = touch(e); if (t) { move(t); } }, false);
            c.addEventListener('touchend', up, false);
        }
        buildBar();
        state();
        return true;
    }

    w.__legacyTuyaInit = init;
    if (!init()) {
        if (document.readyState === 'loading' && document.addEventListener) {
            document.addEventListener('DOMContentLoaded', init, false);
        } else if (w.setTimeout) {
            w.setTimeout(init, 0);
        }
    }
})(window);
