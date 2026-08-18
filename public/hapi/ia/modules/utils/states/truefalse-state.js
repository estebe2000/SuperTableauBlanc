// Fichier: modules/utils/states/truefalse-state.js
import { logger } from '../logger.js';

/**
 * CAPTURE L'ÉTAT COMPLET DU VRAI/FAUX (Export)
 */
export function getTrueFalseState() {
    const questions = [];
    
    // 1. Extraction rigoureuse des affirmations et de leurs feedbacks spécifiques
    document.querySelectorAll('#truefalse-questions-preview .card').forEach(card => {
        questions.push({
            question: card.querySelector('.tf-text')?.value.trim() || '',
            answer: card.querySelector('.tf-answer:checked')?.value || 'true',
            // Rigueur : Capturer les commentaires spécifiques à chaque affirmation
            feedbackCorrect: card.querySelector('.tf-feedback-correct')?.value.trim() || '',
            feedbackIncorrect: card.querySelector('.tf-feedback-incorrect')?.value.trim() || ''
        });
    });

    // 2. Exportation de l'objet de configuration total
    return {
        type: 'truefalse', 
        titre: document.getElementById('truefalse-title')?.value || '',
        
        // Rigueur : Récupération sur les menus globaux HAPI
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 3',
        //langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-tf')?.checked ?? true,
        
        // Options de comportement (H5P)
        disableBack: document.getElementById('tf-disable-back')?.checked || false,
        random: document.getElementById('tf-random-questions')?.checked || false,
        showCheck: document.getElementById('tf-show-check')?.checked ?? true,
        overrideSolution: document.getElementById('tf-override-solution')?.value || 'default',
        overrideRetry: document.getElementById('tf-override-retry')?.value || 'default',
        
        // Seuils et feedbacks globaux (préfixes tf-)
        passPercentage: parseInt(document.getElementById('tf-passPercentage')?.value || "50", 10),
        feedbackFail: document.getElementById('tf-feedback-fail')?.value || '',
        feedbackSuccess: document.getElementById('tf-feedback-success')?.value || '',
        
        // ✅ RIGUEUR IA : Sauvegarde du chantier Albert
        iaPrompt: document.getElementById('ia-prompt-tf')?.value || '',
        iaResponse: document.getElementById('ia-response-tf')?.value || '',
        
        questions: questions
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET DU VRAI/FAUX (Import)
 */
export function setTrueFalseState(config, uiActions) {
    if (config.type !== 'truefalse') return;

    logger.log('🔄 Restauration rigoureuse du Vrai/Faux...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Restauration des réglages globaux et titres
    setVal('truefalse-title', config.titre || '');
    //setVal('global-niveau', config.niveau || 'Cycle 3');
    //setVal('global-language', config.langue || 'Français');
    setCheck('translate-ui-tf', config.translateUI ?? true);
    
    // 2. Options de comportement
    setCheck('tf-disable-back', config.disableBack || false);
    setCheck('tf-random-questions', config.random || false);
    setCheck('tf-show-check', config.showCheck ?? true);
    setVal('tf-override-solution', config.overrideSolution || 'default');
    setVal('tf-override-retry', config.overrideRetry || 'default');
    
    // 3. Seuils et feedbacks globaux
    setVal('tf-passPercentage', config.passPercentage || 50);
    setVal('tf-feedback-fail', config.feedbackFail || '');
    setVal('tf-feedback-success', config.feedbackSuccess || '');
    
    // 4. ✅ RIGUEUR IA : Restauration du prompt et de la réponse
    setVal('ia-prompt-tf', config.iaPrompt || '');
    setVal('ia-response-tf', config.iaResponse || '');

    // 5. Nettoyage et reconstruction des cartes
    uiActions.clearPreview();

    const hasQuestions = config.questions && config.questions.length > 0;

    if (hasQuestions) {
        config.questions.forEach(qData => {
            uiActions.addCard({
                question: qData.question,
                answer: qData.answer,
                feedbackCorrect: qData.feedbackCorrect,
                feedbackIncorrect: qData.feedbackIncorrect
            });
        });
    }

    // 6. ✅ LOGIQUE DE VISIBILITÉ RIGUREUSE
    const iaContainer = document.getElementById('ia-container-tf');
    const albertAction = document.getElementById('albert-action-tf');
    const responseArea = document.getElementById('ia-response-tf');

    // Affichage du chantier Albert si un prompt existe
    if (config.iaPrompt) {
        if (iaContainer) iaContainer.style.display = 'block';
        if (albertAction) albertAction.style.display = 'block';

        // Si les cartes sont déjà là, on cache le JSON "parasite" pour un éditeur propre
        if (hasQuestions && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'none';
        } else if (!hasQuestions && config.iaResponse && responseArea && responseArea.parentElement) {
            // Si pas de cartes, on montre le JSON pour permettre au prof de cliquer sur "Valider"
            responseArea.parentElement.style.display = 'block';
            responseArea.style.minHeight = '300px';
        }
    }

    // 7. Affichage des sections de l'éditeur
    if (hasQuestions) {
        const sections = ['truefalse-preview-section', 'final-options-section-tf', 'generate-section'];
        sections.forEach(id => { 
            const el = document.getElementById(id); 
            if (el) el.style.display = 'block'; 
        });
    }

    // Notification du changement à l'UI
    if (uiActions.updateBtn) uiActions.updateBtn();
}