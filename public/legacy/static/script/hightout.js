/**
 * hightout.js —— 通用结果输出函数
 *
 * 全站工具统一通过 hightout(text) 把计算结果写入 <code id="result">。
 * 使用 textContent 写入，避免 XSS 且保留换行。
 */
(function (global) {
    'use strict';

    function hightout(str) {
        var el = document.getElementById('result');
        if (!el) {
            return;
        }
        if (str === undefined || str === null) {
            str = '';
        }
        // 兼容传入带 pre 包裹的对象
        if (typeof str === 'object') {
            try {
                str = JSON.stringify(str, null, 2);
            } catch (e) {
                str = String(str);
            }
        }
        el.textContent = String(str);
    }

    // 兼容可能的全局别名
    global.hightout = hightout;
    if (typeof jQuery !== 'undefined') {
        jQuery.hightout = hightout;
    }
})(window);
