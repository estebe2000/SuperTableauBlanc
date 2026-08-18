// Fichier : modules/utils/sanitize.js
// Helpers d'assainissement partagés pour neutraliser les injections HTML (XSS)
// dans les artefacts générés (paquets autonomes, H5P/SCORM ouverts ensuite sur un LMS).
//
// Trois niveaux selon le type de donnée :
//   • escapeHtml(str)        → texte simple (titre, date, légende…). Rendu identique, neutralise < > " ' &.
//   • sanitizeRichHtml(str)  → HTML riche (sortie Quill / contenteditable). Conserve la mise en forme,
//                              supprime <script>, attributs on*, javascript:… via DOMPurify.
//   • safeUrl(str)           → URL/chemin destiné à un attribut src/href. Rejette les schémas dangereux.
//
// DOMPurify est chargé globalement (window.DOMPurify) par ia/index.html. Si absent, sanitizeRichHtml
// se rabat sur escapeHtml : on perd la mise en forme mais on ne laisse jamais passer de HTML non sûr.

/**
 * Échappe les caractères HTML d'une chaîne de texte simple.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Configuration DOMPurify : on autorise la mise en forme produite par Quill ainsi que les
// intégrations vidéo (<iframe> https), tout en interdisant scripts, gestionnaires d'événements
// et URL dangereuses (le filtrage des schémas est natif à DOMPurify).
const RICH_CONFIG = {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target'],
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option'],
    FORBID_ATTR: ['style'] // évite les CSS d'exfiltration ; la mise en forme passe par les balises
};

let _hookInstalled = false;
function _ensureHook(DP) {
    if (_hookInstalled || !DP || typeof DP.addHook !== 'function') return;
    // Durcit les liens et iframes ouverts dans le document généré.
    DP.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'A' && node.getAttribute('target')) {
            node.setAttribute('rel', 'noopener noreferrer');
        }
        if (node.tagName === 'IFRAME') {
            const src = node.getAttribute('src') || '';
            if (!/^https:\/\//i.test(src)) node.removeAttribute('src');
        }
    });
    _hookInstalled = true;
}

/**
 * Assainit un fragment HTML riche (sortie d'un éditeur WYSIWYG).
 * Conserve la mise en forme légitime, supprime tout vecteur d'exécution.
 * @param {*} value
 * @returns {string}
 */
export function sanitizeRichHtml(value) {
    if (value === null || value === undefined) return '';
    const dirty = String(value);
    const DP = (typeof window !== 'undefined') ? window.DOMPurify : undefined;
    if (DP && typeof DP.sanitize === 'function') {
        _ensureHook(DP);
        return DP.sanitize(dirty, RICH_CONFIG);
    }
    // Repli sûr : sans DOMPurify, on n'injecte jamais de HTML brut.
    return escapeHtml(dirty);
}

/**
 * Valide une URL/chemin avant insertion dans un attribut src/href.
 * Autorise http(s), data:(image|audio|video), blob:, mailto:, et les chemins relatifs.
 * Renvoie '' pour tout schéma dangereux (javascript:, vbscript:, data:text/html…).
 * Le résultat reste à passer dans un contexte d'attribut déjà échappé (cf. escapeHtml).
 * @param {*} value
 * @returns {string}
 */
export function safeUrl(value) {
    if (value === null || value === undefined) return '';
    const url = String(value).trim();
    if (url === '') return '';
    // Neutralise les tentatives d'obfuscation par espaces/retours de ligne dans le schéma.
    const collapsed = url.replace(/\s+/g, '');
    if (/^(javascript|vbscript|file):/i.test(collapsed)) return '';
    if (/^data:/i.test(collapsed) && !/^data:(image|audio|video)\//i.test(collapsed)) return '';
    return url;
}
