/**
 * tool.js —— Dev 工具箱共享前端逻辑
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
            s.src = src;
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initClipboard);
    } else {
        initClipboard();
    }
})(window);
