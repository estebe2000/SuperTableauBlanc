// Fichier: modules/utils/states/wordsearch-state.js
import { logger } from '../logger.js';

/**
 * CAPTURE L'ÉTAT COMPLET DES MOTS MÊLÉS (Export)
 */
export function getWordSearchState() {
    // 1. Capture de la stratégie d'extraction IA (Mots-clés, thèmes, etc.)
    const modes = [];
    document.querySelectorAll('.ws-mode-checkbox').forEach(cb => {
        if (cb.checked) modes.push(cb.value);
    });

    // 2. Exportation rigoureuse de l'objet de configuration total
    return {
        type: 'wordsearch',
        
        // Paramètres généraux
        titre: document.getElementById('wordsearch-title')?.value || '',
        consignes: document.getElementById('wordsearchTask')?.value || '',
        
        // Rigueur : Récupération sur les menus globaux HAPI
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 3',
        //langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-ws')?.checked ?? true,
        
        // Seuils et feedbacks globaux
        passPercentage: parseInt(document.getElementById('wordsearch-passPercentage')?.value || "50", 10),
        feedbackFail: document.getElementById('wordsearch-feedback-fail')?.value || '',
        feedbackSuccess: document.getElementById('wordsearch-feedback-success')?.value || '',
        
        // Stratégie IA et Contenu brut
        modes: modes,
        iaPrompt: document.getElementById('ia-prompt-wordsearch')?.value || '',
        iaResponse: document.getElementById('ia-response-wordsearch')?.value || '',
        mots: document.getElementById('wordsearchText')?.value || '',

        // Options techniques de la grille
        options: {
            h: document.getElementById('ws-h')?.checked ?? true,
            hBack: document.getElementById('ws-h-back')?.checked ?? false,
            v: document.getElementById('ws-v')?.checked ?? true,
            vUp: document.getElementById('ws-v-up')?.checked ?? false,
            d: document.getElementById('ws-d')?.checked ?? true,
            showList: document.getElementById('ws-show-list')?.checked ?? true
        }
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET DES MOTS MÊLÉS (Import)
 */
export function setWordSearchState(config, uiActions) {
    if (config.type !== 'wordsearch') return;

    logger.log('🔄 Restauration rigoureuse des Mots Mêlés...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Restauration des réglages globaux et textes
    setVal('wordsearch-title', config.titre);
    setVal('wordsearchTask', config.consignes);
    //setVal('global-niveau', config.niveau || 'Cycle 3');
    //setVal('global-language', config.langue || 'Français');
    setCheck('translate-ui-ws', config.translateUI ?? true);
        
    // 2. Restauration des feedbacks et seuils
    setVal('wordsearch-passPercentage', config.passPercentage || 50);
    setVal('wordsearch-feedback-fail', config.feedbackFail || '');
    setVal('wordsearch-feedback-success', config.feedbackSuccess || '');

    // 3. ✅ RIGUEUR IA : Restauration du chantier Albert
    setVal('ia-prompt-wordsearch', config.iaPrompt || '');
    setVal('ia-response-wordsearch', config.iaResponse || '');
    setVal('wordsearchText', config.mots || '');

    // Restauration des modes de sélection IA
    if (config.modes) {
        document.querySelectorAll('.ws-mode-checkbox').forEach(cb => {
            cb.checked = config.modes.includes(cb.value);
        });
    }

    // 4. Options techniques de la grille
    if (config.options) {
        setCheck('ws-h', config.options.h ?? true);
        setCheck('ws-h-back', config.options.hBack ?? false);
        setCheck('ws-v', config.options.v ?? true);
        setCheck('ws-v-up', config.options.vUp ?? false);
        setCheck('ws-d', config.options.d ?? true);
        setCheck('ws-show-list', config.options.showList ?? true);
    }

    // 5. ✅ LOGIQUE DE VISIBILITÉ RIGUREUSE
    const iaContainer = document.getElementById('ia-container-wordsearch');
    const albertAction = document.getElementById('albert-action-wordsearch');
    const responseArea = document.getElementById('ia-response-wordsearch');
    const hasContent = config.mots && config.mots.trim().length > 0;

    // Affichage du chantier Albert si un prompt existe
    if (config.iaPrompt) {
        if (iaContainer) iaContainer.style.display = 'block';
        if (albertAction) albertAction.style.display = 'block';

        // Si les mots sont déjà là, on cache le JSON "parasite" pour un éditeur propre
        if (hasContent && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'none';
        } else if (!hasContent && config.iaResponse && responseArea && responseArea.parentElement) {
            // Si pas de mots, on montre le JSON pour permettre la validation
            responseArea.parentElement.style.display = 'block';
            responseArea.style.minHeight = '300px';
        }
    }

    // 6. Affichage automatique des sections de l'éditeur
    if (hasContent) {
        const previewSec = document.getElementById('wordsearch-preview-section');
        const optionsSec = document.getElementById('wordsearch-options-section');
        const generateSec = document.getElementById('generate-section');
        
        if (previewSec) previewSec.style.display = 'block';
        if (optionsSec) optionsSec.style.display = 'block';
        if (generateSec) generateSec.style.display = 'block';
    }

    // Mise à jour de l'état des boutons UI
    if (uiActions.updateBtn) uiActions.updateBtn();
}