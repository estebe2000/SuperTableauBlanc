// Fichier: modules/utils/quill-manager.js

// 1. Fonction pour charger dynamiquement les scripts et CSS de Quill
export function ensureQuillLoaded() {
    if (!document.getElementById('quill-css')) {
        const css = document.createElement('link'); 
        css.id = 'quill-css'; 
        css.rel = 'stylesheet'; 
        css.href = new URL('../../../vendor/quill/quill.snow.css', import.meta.url).href; 
        document.head.appendChild(css);
    }
    if (!document.getElementById('quill-js') && typeof window.Quill === 'undefined') {
        const script = document.createElement('script'); 
        script.id = 'quill-js'; 
        script.src = new URL('../../../vendor/quill/quill.min.js', import.meta.url).href; 
        document.head.appendChild(script);
    }
// Ajout d'un petit correctif CSS pour arrondir l'éditeur et superposer l'infobulle
    if (!document.getElementById('quill-custom-css')) {
        const customCss = document.createElement('style');
        customCss.id = 'quill-custom-css';
        customCss.textContent = `
            .ql-toolbar.ql-snow { border-radius: 6px 6px 0 0; border-color: #ddd; background: #f8fafc; }
            .ql-container.ql-snow { border-radius: 0 0 6px 6px; border-color: #ddd; }
            .ql-tooltip { z-index: 9999 !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; border-radius: 6px !important; }

            /* ===== Mode sombre : barre d'outils + éditeur Quill (intro + repères) ===== */
            [data-mode="dark"] .ql-toolbar.ql-snow { background: var(--surface-2); border-color: var(--border); }
            [data-mode="dark"] .ql-container.ql-snow { border-color: var(--border); background: var(--surface); color: var(--text); }
            [data-mode="dark"] .ql-editor { color: var(--text); }
            [data-mode="dark"] .ql-editor.ql-blank::before { color: var(--text-muted); }
            /* Icônes de la barre d'outils */
            [data-mode="dark"] .ql-snow .ql-stroke { stroke: var(--text-muted); }
            [data-mode="dark"] .ql-snow .ql-fill, [data-mode="dark"] .ql-snow .ql-stroke.ql-fill { fill: var(--text-muted); }
            [data-mode="dark"] .ql-snow .ql-picker { color: var(--text-muted); }
            /* Survol / état actif → couleur du thème */
            [data-mode="dark"] .ql-snow.ql-toolbar button:hover .ql-stroke,
            [data-mode="dark"] .ql-snow.ql-toolbar button.ql-active .ql-stroke { stroke: var(--hapi-grad-a); }
            [data-mode="dark"] .ql-snow.ql-toolbar button:hover .ql-fill,
            [data-mode="dark"] .ql-snow.ql-toolbar button.ql-active .ql-fill { fill: var(--hapi-grad-a); }
            [data-mode="dark"] .ql-snow.ql-toolbar button:hover,
            [data-mode="dark"] .ql-snow.ql-toolbar button.ql-active,
            [data-mode="dark"] .ql-snow .ql-picker-label:hover { color: var(--hapi-grad-a); }
            /* Infobulle d'édition de lien */
            [data-mode="dark"] .ql-snow .ql-tooltip { background: var(--surface-2); border-color: var(--border); color: var(--text); box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important; }
            [data-mode="dark"] .ql-snow .ql-tooltip input[type=text] { background: var(--surface); border-color: var(--border); color: var(--text); }
            [data-mode="dark"] .ql-snow .ql-tooltip a { color: var(--hapi-accent-text); }
            /* Menus déroulants éventuels de la barre */
            [data-mode="dark"] .ql-snow .ql-picker-options { background: var(--surface-2); border-color: var(--border) !important; }
        `;
        document.head.appendChild(customCss);
    }
}

// 2. Fonction pour initialiser un éditeur spécifique
export function initQuillEditor(uniqueId, initialContent, updateCallback) {
    // Fonction récursive pour attendre que le script Quill soit bien téléchargé
    const checkAndInit = () => {
        if (typeof window.Quill === 'undefined') {
            setTimeout(checkAndInit, 100);
            return;
        }

        const containerSelector = `#quill-${uniqueId}`;
        const hiddenInputSelector = `#desc-hidden-${uniqueId}`;
        const quillContainer = document.querySelector(containerSelector);
        
        if (!quillContainer) return;

        // Création de l'éditeur
        const quill = new window.Quill(containerSelector, {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline'],       // Gras, Italique, Souligné
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }], // Listes
                    ['link', 'clean']                      // Lien HTML et Nettoyer
                ]
            },
            placeholder: 'Explication pédagogique...'
        });

        // Injection du contenu initial
        quill.clipboard.dangerouslyPasteHTML(initialContent || '');

        // Synchronisation avec le textarea caché
        const hiddenTextarea = document.querySelector(hiddenInputSelector);
        quill.on('text-change', () => {
            if (hiddenTextarea) {
                hiddenTextarea.value = quill.root.innerHTML;
            }
            if (typeof updateCallback === 'function') {
                updateCallback();
            }
        });

        // Stockage de l'instance dans le DOM (très utile pour le bouton Reset)
        quillContainer.__quill = quill;
    };

    checkAndInit();
}