/* Fichier : js/sanitize-standalone.js
 * Version « script classique » des helpers d'assainissement anti-XSS, pour les
 * générateurs autonomes no-ia/ (qui ne sont pas des modules ES).
 * Équivalent de ia/modules/utils/sanitize.js. Expose window.HAPISanitize.
 *
 * Charger APRÈS js/vendor/purify.min.js. Sans DOMPurify, sanitizeRichHtml se rabat
 * sur escapeHtml : on perd la mise en forme mais on n'injecte jamais de HTML non sûr.
 */
(function (global) {
    'use strict';

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    var RICH_CONFIG = {
        USE_PROFILES: { html: true },
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target'],
        FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option'],
        FORBID_ATTR: ['style']
    };

    var _hookInstalled = false;
    function _ensureHook(DP) {
        if (_hookInstalled || !DP || typeof DP.addHook !== 'function') return;
        DP.addHook('afterSanitizeAttributes', function (node) {
            if (node.tagName === 'A' && node.getAttribute('target')) {
                node.setAttribute('rel', 'noopener noreferrer');
            }
            if (node.tagName === 'IFRAME') {
                var src = node.getAttribute('src') || '';
                if (!/^https:\/\//i.test(src)) node.removeAttribute('src');
            }
        });
        _hookInstalled = true;
    }

    function sanitizeRichHtml(value) {
        if (value === null || value === undefined) return '';
        var dirty = String(value);
        var DP = global.DOMPurify;
        if (DP && typeof DP.sanitize === 'function') {
            _ensureHook(DP);
            return DP.sanitize(dirty, RICH_CONFIG);
        }
        return escapeHtml(dirty);
    }

    function safeUrl(value) {
        if (value === null || value === undefined) return '';
        var url = String(value).trim();
        if (url === '') return '';
        var collapsed = url.replace(/\s+/g, '');
        if (/^(javascript|vbscript|file):/i.test(collapsed)) return '';
        if (/^data:/i.test(collapsed) && !/^data:(image|audio|video)\//i.test(collapsed)) return '';
        return url;
    }

    global.HAPISanitize = { escapeHtml: escapeHtml, sanitizeRichHtml: sanitizeRichHtml, safeUrl: safeUrl };
})(window);
