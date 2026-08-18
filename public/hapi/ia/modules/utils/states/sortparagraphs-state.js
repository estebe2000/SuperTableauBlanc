// Fichier: modules/utils/states/sortparagraphs-state.js
import { logger } from '../logger.js';

/**
 * CAPTURE L'ÉTAT COMPLET DE LA MISE EN ORDRE (Export)
 */
export function getSortParagraphsState() {
    const paragraphs = [];
    // ✅ RIGUEUR : On capture l'ordre actuel du DOM (qui reflète les modifications de l'utilisateur)
    document.querySelectorAll('#sortparagraphs-list .card').forEach(card => {
        const text = card.querySelector('.sp-text')?.value.trim() || '';
        if (text) paragraphs.push(text);
    });

    return {
        type: 'sortparagraphs',
        
        // Paramètres généraux
        titre: document.getElementById('sortparagraphs-title')?.value || '',
        consignes: document.getElementById('sortparagraphs-task')?.value || '',
        
        // Rigueur : Récupération sur les menus globaux HAPI
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 2',
        //langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-sp')?.checked ?? true,
        
        // Mode de jeu et correction
        mode: document.getElementById('sortparagraphs-mode')?.value || 'strict',
        
        // Seuils et feedbacks globaux
        passPercentage: parseInt(document.getElementById('sortparagraphs-passPercentage')?.value || "50", 10),
        feedbackFail: document.getElementById('sortparagraphs-feedback-fail')?.value || '',
        feedbackSuccess: document.getElementById('sortparagraphs-feedback-success')?.value || '',
        
        // ✅ RIGUEUR IA : Sauvegarde du chantier Albert (Prompt & Réponse)
        iaPrompt: document.getElementById('ia-prompt-sortparagraphs')?.value || '',
        iaResponse: document.getElementById('ia-response-sortparagraphs')?.value || '',
        
        paragraphs: paragraphs
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET DE LA MISE EN ORDRE (Import)
 */
export function setSortParagraphsState(config, uiActions) {
    if (config.type !== 'sortparagraphs') return;

    logger.log('🔄 Restauration rigoureuse de la mise en ordre...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Restauration des réglages globaux et textes
    setVal('sortparagraphs-title', config.titre);
    setVal('sortparagraphs-task', config.consignes);
    //setVal('global-niveau', config.niveau || 'Cycle 2');
    //setVal('global-language', config.langue || 'Français');
    setCheck('translate-ui-sp', config.translateUI ?? true);
        
    // 2. Restauration des feedbacks, seuils et modes
    setVal('sortparagraphs-mode', config.mode || 'strict');
    setVal('sortparagraphs-passPercentage', config.passPercentage || 50);
    setVal('sortparagraphs-feedback-fail', config.feedbackFail || '');
    setVal('sortparagraphs-feedback-success', config.feedbackSuccess || '');

    // 3. ✅ RIGUEUR IA : Restauration du chantier Albert
    setVal('ia-prompt-sortparagraphs', config.iaPrompt || '');
    setVal('ia-response-sortparagraphs', config.iaResponse || '');

    // 4. Nettoyage et reconstruction des paragraphes via l'UI
    uiActions.clearPreview();

    const hasParagraphs = config.paragraphs && config.paragraphs.length > 0;

    if (hasParagraphs) {
        config.paragraphs.forEach(text => {
            uiActions.addCard(text);
        });
    }

    // 5. ✅ LOGIQUE DE VISIBILITÉ RIGUREUSE
    const iaContainer = document.getElementById('ia-container-sortparagraphs');
    const albertAction = document.getElementById('albert-action-sortparagraphs');
    const responseArea = document.getElementById('ia-response-sortparagraphs');

    // Affichage du chantier Albert si un prompt existe
    if (config.iaPrompt) {
        if (iaContainer) iaContainer.style.display = 'block';
        if (albertAction) albertAction.style.display = 'block';

        // Si les paragraphes sont déjà là, on cache le JSON "parasite" pour un éditeur propre
        if (hasParagraphs && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'none';
        } else if (!hasParagraphs && config.iaResponse && responseArea && responseArea.parentElement) {
            // Si pas de paragraphes, on montre le JSON pour permettre la validation
            responseArea.parentElement.style.display = 'block';
            responseArea.style.minHeight = '300px';
        }
    }

    // 6. Affichage automatique des sections de l'éditeur
    if (hasParagraphs) {
        const previewSec = document.getElementById('sortparagraphs-preview-section');
        const generateSec = document.getElementById('generate-section');
        
        if (previewSec) previewSec.style.display = 'block';
        if (generateSec) generateSec.style.display = 'block';
    }

    // Mise à jour de l'état des boutons UI
    if (uiActions.updateBtn) uiActions.updateBtn();
}