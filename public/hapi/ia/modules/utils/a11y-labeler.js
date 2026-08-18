// Fichier: modules/ui/../utils/a11y-labeler.js
// Accessibilité RGAA pour l'app ia/ (UI injectée dynamiquement) :
//   1) nomme les boutons « icône seule » (aria-label),
//   2) masque aux lecteurs d'écran les emojis purement décoratifs (aria-hidden),
//      uniquement quand un nom accessible subsiste (texte ou aria-label).
// Travaille sur le DOM RENDU : ne touche jamais aux emojis présents dans la
// logique (alertes, logs, valeurs). Un seul point d'intégration ; aucune des
// 25 sources *-ui.js n'est modifiée. Couvre le présent ET les injections futures.

const ICON_TARGET_SELECTOR = 'button, [role="button"], .modal-close, .close, .detail-close';

// Éléments « porteurs de libellé » où un emoji en tête est décoratif.
// (on exclut <option> : un <option> ne peut pas contenir de <span>)
const EMOJI_HOST_SELECTOR = 'h1,h2,h3,h4,h5,h6,label,summary,legend,button,[role="button"],.badge-item,.activity-title,.activity-description,.feature-title,.tab-btn,.consigne';

/* ───────── 1) Nom accessible des boutons icône-seule ───────── */

function hasNoAccessibleName(el) {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
    return !/\p{L}/u.test(el.textContent || ''); // aucune lettre → nom manquant
}

function deriveLabel(el) {
    const title = (el.getAttribute('title') || '').trim();
    if (title) return title;
    const cls = el.className && el.className.toString ? el.className.toString() : '';
    const txt = el.textContent || '';
    if (/wiki-search|btn-search|-search\b|search-/i.test(cls) || txt.includes('🔍')) return 'Rechercher une image';
    if (/play/i.test(cls) || txt.includes('▶')) return 'Écouter';
    if (/stop/i.test(cls) || txt.includes('⏹')) return "Arrêter l'enregistrement";
    if (/close|fermer/i.test(cls)) return 'Fermer';
    if (/remove|delete|\bdel\b|del-|-del|suppr/i.test(cls) || txt.includes('🗑') || txt.includes('✖') || txt.includes('✕')) return 'Supprimer';
    if (txt.includes('×')) return 'Fermer';
    return null;
}

function labelOne(el) {
    if (!hasNoAccessibleName(el)) return;
    const label = deriveLabel(el);
    if (label) el.setAttribute('aria-label', label);
}

/* ───────── 2) Masquage des emojis décoratifs ───────── */

function wrapEmojiTextNode(textNode) {
    const text = textNode.nodeValue;
    const re = /(\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*)+/gu;
    if (!re.test(text)) return;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const span = document.createElement('span');
        span.setAttribute('aria-hidden', 'true');
        span.textContent = m[0];
        frag.appendChild(span);
        last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode.replaceChild(frag, textNode);
}

function hideEmojisInEl(el) {
    if (el.dataset.a11yEmoji) return;
    // Sécurité : ne jamais retirer le SEUL nom accessible (cas bouton icône-seule)
    const keepsName = /\p{L}/u.test(el.textContent || '') || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
    if (!keepsName) return;
    el.dataset.a11yEmoji = '1';
    Array.from(el.childNodes).forEach(n => { if (n.nodeType === 3) wrapEmojiTextNode(n); });
}

/* ───────── Orchestration ───────── */

function processA11y(root) {
    if (root.nodeType === 1) {
        if (root.matches && root.matches(ICON_TARGET_SELECTOR)) labelOne(root);
        // labelOne d'abord (pose les aria-label), puis masquage emoji
        if (root.matches && root.matches(EMOJI_HOST_SELECTOR)) hideEmojisInEl(root);
    }
    if (root.querySelectorAll) {
        root.querySelectorAll(ICON_TARGET_SELECTOR).forEach(labelOne);
        root.querySelectorAll(EMOJI_HOST_SELECTOR).forEach(hideEmojisInEl);
    }
}

export function labelIconButtons(root = document) { processA11y(root); }

/* ───────── Régions live (RGAA 9.x / WCAG 4.1.3) ─────────
   Annonce des changements dynamiques (statut de génération IA…) aux
   lecteurs d'écran via deux régions visuellement masquées (.sr-only). */
let _politeRegion = null;
let _assertiveRegion = null;

function makeRegion(id, live, role) {
    let r = document.getElementById(id);
    if (!r) {
        r = document.createElement('div');
        r.id = id;
        r.className = 'sr-only';
        r.setAttribute('aria-live', live);
        r.setAttribute('aria-atomic', 'true');
        if (role) r.setAttribute('role', role);
        document.body.appendChild(r);
    }
    return r;
}

function ensureLiveRegions() {
    if (!_politeRegion) _politeRegion = makeRegion('hapi-sr-polite', 'polite', 'status');
    if (!_assertiveRegion) _assertiveRegion = makeRegion('hapi-sr-assertive', 'assertive', 'alert');
}

/** Annonce un message aux lecteurs d'écran. assertive=true pour les erreurs. */
export function announce(message, assertive = false) {
    ensureLiveRegions();
    const region = assertive ? _assertiveRegion : _politeRegion;
    region.textContent = '';                 // reset → force la ré-annonce d'un message identique
    setTimeout(() => { region.textContent = message; }, 60);
}

export function startA11yLabeler() {
    ensureLiveRegions();
    processA11y(document);
    const observer = new MutationObserver((mutations) => {
        for (const mut of mutations) {
            for (const node of mut.addedNodes) {
                if (node.nodeType === 1) processA11y(node);
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
}
