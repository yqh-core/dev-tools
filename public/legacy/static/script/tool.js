/**
 * tool.js —— DigDevBox共享前端逻辑
 *
 * 提供全站模板共用的辅助函数（原 upstream 仓库缺失，此处按调用契约重建）：
 *   - tj()           : footer「返回顶部」按钮行为
 *   - setJS(list)    : 动态注入额外脚本（barcode / htpasswd 等工具使用）
 *   - is_show()      : 结果区存在内容时确保可见
 *   - ClearAll()     : 清空输入与结果
 *   - 复制按钮        : 接管 [data-clipboard-target] 的点击复制
 */
(function (global) {
    'use strict';

    /* formatcs/java/perl/py/ruby 五个页面的内联初始化写成
       `the.editor = CodeMirror.fromTextArea(...)`，依赖丢失脚本提供的全局 the。
       在这里（parser 阶段就执行、早于 DOM ready）先占位，否则页面自己的初始化
       会以 "the is not defined" 抛错，编辑器只能靠后续兜底重建。 */
    global.the = global.the || {};

    /* ---------- 返回顶部 (footer .gotop) ---------- */
    function tj() {
        var gotop = document.querySelector('.gotop');
        if (!gotop) {
            return;
        }
        var onScroll = function () {
            gotop.style.display = (window.pageYOffset > 200) ? '' : 'none';
        };
        if (window.addEventListener) {
            window.addEventListener('scroll', onScroll, { passive: true });
        }
        onScroll();
        gotop.addEventListener('click', function (e) {
            e.preventDefault();
            if (window.scrollTo) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                window.scrollTo(0, 0);
            }
        });
    }

    /* ---------- 动态脚本加载器 ---------- */
    /* 老站页面以 setJS(["/static/script/..."]) 的绝对路径动态引资源；静态化时只改写了
       src="..." 属性，**没改 script 体内的字符串**，于是这 31 个页面的动态加载全部落空。
       这里统一补 /legacy 前缀（已经是 /legacy/ 的、以及外链不动），一处修好全部页面。 */
    function legacyPath(src) {
        if (typeof src !== 'string' || src.charAt(0) !== '/') {
            return src;
        }
        if (src.indexOf('/legacy/') === 0) {
            return src;
        }
        return '/legacy' + src;
    }

    function setJS(list) {
        if (!list) {
            return;
        }
        var arr = Array.isArray(list) ? list : [list];
        arr.forEach(function (src) {
            if (!src) {
                return;
            }
            var s = document.createElement('script');
            s.src = legacyPath(src);
            s.async = false;
            document.body.appendChild(s);
        });
    }

    /* ---------- 结果区可见性初始化 ---------- */
    function is_show() {
        var r = document.getElementById('result');
        if (!r) {
            return;
        }
        if (r.textContent.trim() !== '') {
            var box = r.closest('.panel, .form-group, pre');
            if (box) {
                box.style.display = '';
            }
        }
    }

    /* ---------- 清空 ---------- */
    function ClearAll() {
        var c = document.getElementById('content');
        var r = document.getElementById('result');
        if (c) {
            if (c.tagName === 'TEXTAREA' || c.tagName === 'INPUT') {
                c.value = '';
            } else {
                c.innerHTML = '';
            }
        }
        if (r) {
            r.textContent = '';
        }
    }

    /* 老站多数页面的「清空」按钮调 Empty()，但全站从未定义过它
       （审计里这批页面的清空按钮报 "Empty is not defined" 就是这个原因）。
       语义与 ClearAll() 一致：输入框 + 结果区一起清空。 */
    function Empty() {
        ClearAll();
    }

    /* ---------- 复制按钮接管 ---------- */
    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
        } catch (e) { /* noop */ }
        document.body.removeChild(ta);
    }

    function flash(el) {
        var old = el.getAttribute('data-original') || el.textContent;
        el.setAttribute('data-original', old);
        el.textContent = '已复制';
        setTimeout(function () {
            el.textContent = old;
        }, 1200);
    }

    function initClipboard() {
        var els = document.querySelectorAll('[data-clipboard-target]');
        Array.prototype.forEach.call(els, function (el) {
            el.addEventListener('click', function () {
                var sel = el.getAttribute('data-clipboard-target');
                var src = sel ? document.querySelector(sel) : null;
                if (!src) {
                    return;
                }
                var text = (src.textContent || src.value || '').replace(/\u00a0/g, ' ');
                if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
                    global.navigator.clipboard.writeText(text).then(
                        function () { flash(el); },
                        function () { fallbackCopy(text); flash(el); }
                    );
                } else {
                    fallbackCopy(text);
                    flash(el);
                }
            });
        });
    }

    global.tj = tj;
    global.setJS = setJS;
    global.is_show = is_show;
    global.ClearAll = ClearAll;
    global.Empty = Empty;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initClipboard);
    } else {
        initClipboard();
    }
})(window);
