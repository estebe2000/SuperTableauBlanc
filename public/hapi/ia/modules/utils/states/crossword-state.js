// Fichier: modules/utils/states/crossword-state.js
import { logger } from '../logger.js';

/**
 * CAPTURE L'ÉTAT COMPLET DES MOTS CROISÉS (Export)
 */
export function getCrosswordState() {
    const words = [];
    
    // 1. Extraction rigoureuse des mots, indices et indices supplémentaires
    document.querySelectorAll('#crossword-items-list .card').forEach(card => {
        words.push({
            clue: card.querySelector('.cw-clue')?.value.trim() || '',
            answer: card.querySelector('.cw-answer')?.value.trim() || '',
            extraClue: card.querySelector('.cw-extra-clue')?.value.trim() || ''
        });
    });

    // 2. Exportation de l'objet de configuration total
    return {
        type: 'crossword',
        
        // Paramètres généraux
        titre: document.getElementById('crossword-title')?.value || '',
        consignes: document.getElementById('crosswordTask')?.value || '',
        sujet: document.getElementById('crossword-subject')?.value || '',
        
        // Rigueur : Récupération sur les menus globaux HAPI
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 3',
        //langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-cw')?.checked ?? true,

        // Seuils et feedbacks globaux
        passPercentage: parseInt(document.getElementById('crossword-passPercentage')?.value || "50", 10),
        feedbackFail: document.getElementById('crossword-feedback-fail')?.value || '',
        feedbackSuccess: document.getElementById('crossword-feedback-success')?.value || '',
        
        // ✅ RIGUEUR IA : Sauvegarde du chantier Albert (Prompt & Réponse)
        iaPrompt: document.getElementById('ia-prompt-crossword')?.value || '',
        iaResponse: document.getElementById('ia-response-crossword')?.value || '',
        
        words: words
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET DES MOTS CROISÉS (Import)
 */
export function setCrosswordState(config, uiActions) {
    if (config.type !== 'crossword') return;

    logger.log('🔄 Restauration rigoureuse des Mots Croisés...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Restauration des réglages globaux et titres
    setVal('crossword-title', config.titre);
    setVal('crosswordTask', config.consignes);
    setVal('crossword-subject', config.sujet);
    //setVal('global-niveau', config.niveau || 'Cycle 3');
    //setVal('global-language', config.langue || 'Français');
    setCheck('translate-ui-cw', config.translateUI ?? true);

    // 2. Restauration des feedbacks et seuils
    setVal('crossword-passPercentage', config.passPercentage || 50);
    setVal('crossword-feedback-fail', config.feedbackFail || '');
    setVal('crossword-feedback-success', config.feedbackSuccess || '');

    // 3. ✅ RIGUEUR IA : Restauration du chantier Albert
    setVal('ia-prompt-crossword', config.iaPrompt || '');
    setVal('ia-response-crossword', config.iaResponse || '');

    // 4. Nettoyage et reconstruction des mots via l'UI
    uiActions.clearPreview();

    const hasWords = config.words && config.words.length > 0;

    if (hasWords) {
        config.words.forEach(wordData => {
            uiActions.addCard(wordData);
        });
    }

    // 5. ✅ LOGIQUE DE VISIBILITÉ RIGUREUSE
    const iaContainer = document.getElementById('ia-container-crossword');
    const albertAction = document.getElementById('albert-action-crossword');
    const responseArea = document.getElementById('ia-response-crossword');

    // Affichage du chantier Albert si un prompt existe
    if (config.iaPrompt) {
        if (iaContainer) iaContainer.style.display = 'block';
        if (albertAction) albertAction.style.display = 'block';

        // Si les mots sont déjà là, on cache le JSON "parasite" pour un éditeur propre
        if (hasWords && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'none';
        } else if (!hasWords && config.iaResponse && responseArea && responseArea.parentElement) {
            // Si pas de mots, on montre le JSON pour permettre la validation
            responseArea.parentElement.style.display = 'block';
            responseArea.style.minHeight = '300px';
        }
    }

    // 6. Affichage automatique des sections de l'éditeur
    if (hasWords) {
        const itemsSec = document.getElementById('crossword-items-section');
        const optionsSec = document.getElementById('crossword-options-section');
        const generateSec = document.getElementById('generate-section');
        
        if (itemsSec) itemsSec.style.display = 'block';
        if (optionsSec) optionsSec.style.display = 'block';
        if (generateSec) generateSec.style.display = 'block';
    }

    // Mise à jour de l'état des boutons UI
    if (uiActions.updateBtn) uiActions.updateBtn();
}