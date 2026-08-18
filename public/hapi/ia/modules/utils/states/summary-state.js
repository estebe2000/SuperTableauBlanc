// Fichier: modules/utils/states/summary-state.js
import { logger } from '../logger.js';

/**
 * CAPTURE L'ÉTAT COMPLET DU RÉSUMÉ (Export)
 */
export function getSummaryState() {
    const summaries = [];
    
    // 1. Extraction des groupes de résumés (phrases correctes et distracteurs)
    document.querySelectorAll('#summary-items-list .card').forEach(card => {
        const correctText = card.querySelector('.summary-correct-text')?.value.trim() || '';
        const tip = card.querySelector('.summary-tip')?.value.trim() || '';
        
        const incorrectTexts = [];
        card.querySelectorAll('.summary-incorrect-text').forEach(input => {
            const val = input.value.trim();
            if (val) incorrectTexts.push(val);
        });

        summaries.push({
            correct: [correctText], // Structure attendue par H5P
            incorrect: incorrectTexts,
            tip: tip
        });
    });

    // 2. Export de l'objet de configuration total
    return {
        type: 'summary',
        
        // Paramètres généraux
        titre: document.getElementById('summary-title')?.value || '',
        consignes: document.getElementById('summary-task')?.value || '',
        
        // Rigueur : Récupération sur les menus globaux HAPI
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 2',
        //langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-summary')?.checked ?? true,
        
        // Seuils et feedbacks globaux
        passPercentage: parseInt(document.getElementById('summary-passPercentage')?.value || "50", 10),
        feedbackFail: document.getElementById('summary-feedback-fail')?.value || '',
        feedbackSuccess: document.getElementById('summary-feedback-success')?.value || '',
        
        // ✅ RIGUEUR IA : Sauvegarde du chantier Albert (Prompt & Réponse)
        iaPrompt: document.getElementById('ia-prompt-summary')?.value || '',
        iaResponse: document.getElementById('ia-response-summary')?.value || '',
        
        summaries: summaries
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET DU RÉSUMÉ (Import)
 */
export function setSummaryState(config, uiActions) {
    if (config.type !== 'summary') return;

    logger.log('🔄 Restauration rigoureuse du Résumé...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Restauration des réglages globaux et titres
    setVal('summary-title', config.titre);
    setVal('summary-task', config.consignes);
    //setVal('global-niveau', config.niveau || 'Cycle 2');
    //setVal('global-language', config.langue || 'Français');
    setCheck('translate-ui-summary', config.translateUI ?? true);
        
    // 2. Restauration des feedbacks et seuils
    setVal('summary-passPercentage', config.passPercentage || 50);
    setVal('summary-feedback-fail', config.feedbackFail || '');
    setVal('summary-feedback-success', config.feedbackSuccess || '');

    // 3. ✅ RIGUEUR IA : Restauration du chantier Albert
    setVal('ia-prompt-summary', config.iaPrompt || '');
    setVal('ia-response-summary', config.iaResponse || '');

    // 4. Nettoyage et reconstruction des groupes via l'UI
    uiActions.clearPreview();

    const hasSummaries = config.summaries && config.summaries.length > 0;

    if (hasSummaries) {
        config.summaries.forEach(groupData => {
            uiActions.addCard(groupData);
        });
    }

    // 5. ✅ LOGIQUE DE VISIBILITÉ RIGUREUSE
    const iaContainer = document.getElementById('ia-container-summary');
    const albertAction = document.getElementById('albert-action-summary'); // Adapté selon votre nomenclature
    const responseArea = document.getElementById('ia-response-summary');

    // Affichage du chantier Albert si un prompt existe
    if (config.iaPrompt) {
        if (iaContainer) iaContainer.style.display = 'block';
        if (albertAction) albertAction.style.display = 'block';

        // Si les données sont déjà là, on cache le JSON "parasite" pour un éditeur propre
        if (hasSummaries && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'none';
        } else if (!hasSummaries && config.iaResponse && responseArea && responseArea.parentElement) {
            // Si pas de résumés, on montre le JSON pour permettre la validation
            responseArea.parentElement.style.display = 'block';
            responseArea.style.minHeight = '300px';
        }
    }

    // 6. Affichage automatique des sections de l'éditeur
    if (hasSummaries) {
        const itemsSec = document.getElementById('summary-items-section');
        const generateSec = document.getElementById('generate-section');
        
        if (itemsSec) itemsSec.style.display = 'block';
        if (generateSec) generateSec.style.display = 'block';
    }

    // Mise à jour de l'état des boutons UI
    if (uiActions.updateBtn) uiActions.updateBtn();
}