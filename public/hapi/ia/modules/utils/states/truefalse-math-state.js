// Fichier: modules/utils/states/truefalse-math-state.js
import { logger } from '../logger.js';

/**
 * CAPTURE L'ÉTAT COMPLET DU VRAI/FAUX MATHS (Export)
 */
export function getTrueFalseMathState() {
    const questions = [];
    
    // 1. Extraction rigoureuse des affirmations mathématiques et de leurs feedbacks
    document.querySelectorAll('#statements-list .math-question-card').forEach(card => {
        const cardId = card.id;
        const isTrueValue = card.querySelector(`input[name="${cardId}-answer"]:checked`)?.value;
        
        questions.push({
            statement: card.querySelector('.tf-math-text')?.value.trim() || '',
            isTrue: isTrueValue === 'true', 
            // Rigueur : Capture des feedbacks spécifiques à chaque affirmation
            feedbackCorrect: card.querySelector('.tf-feedback-correct-math')?.value.trim() || '',
            feedbackIncorrect: card.querySelector('.tf-feedback-incorrect-math')?.value.trim() || ''
        });
    });

    return {
        type: 'truefalse-math',
        titre: document.getElementById('truefalse-math-title')?.value || '',
        
        // Rigueur : Menus globaux HAPI
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 3',
        //langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-tf-math')?.checked ?? true,
        sujet: document.getElementById('tf-math-subject')?.value || '',
        
        // Options de comportement (H5P)
        disableBack: document.getElementById('tf-math-disable-back')?.checked || false,
        random: document.getElementById('tf-math-random-questions')?.checked || false,
        showCheck: document.getElementById('tf-math-show-check')?.checked ?? true,
        overrideSolution: document.getElementById('tf-math-override-solution')?.value || 'default',
        overrideRetry: document.getElementById('tf-math-override-retry')?.value || 'default',

        // Seuils et feedbacks globaux
        passPercentage: parseInt(document.getElementById('tf-math-passPercentage')?.value || "50", 10),
        feedbackFail: document.getElementById('tf-math-feedback-fail')?.value || '',
        feedbackSuccess: document.getElementById('tf-math-feedback-success')?.value || '',

        // ✅ RIGUEUR IA : Sauvegarde du chantier Albert
        iaPrompt: document.getElementById('ia-prompt-tf-math')?.value || '',
        iaResponse: document.getElementById('ia-response-tf-math')?.value || '',
        
        questions: questions
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET DU VRAI/FAUX MATHS (Import)
 */
export function setTrueFalseMathState(config, uiActions) {
    if (config.type !== 'truefalse-math') return;

    logger.log('🔄 Restauration rigoureuse du Vrai/Faux Math...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Restauration des réglages globaux et textes
    setVal('truefalse-math-title', config.titre || '');
    //setVal('global-niveau', config.niveau || 'Cycle 3');
    //setVal('global-language', config.langue || 'Français');
    setVal('tf-math-subject', config.sujet || '');
    setCheck('translate-ui-tf-math', config.translateUI ?? true);

    // 2. Options de comportement
    setCheck('tf-math-disable-back', config.disableBack || false);
    setCheck('tf-math-random-questions', config.random || false);
    setCheck('tf-math-show-check', config.showCheck ?? true);
    setVal('tf-math-override-solution', config.overrideSolution || 'default');
    setVal('tf-math-override-retry', config.overrideRetry || 'default');

    // 3. Seuils et feedbacks globaux
    setVal('tf-math-passPercentage', config.passPercentage || 50);
    setVal('tf-math-feedback-fail', config.feedbackFail || '');
    setVal('tf-math-feedback-success', config.feedbackSuccess || '');

    // 4. ✅ RIGUEUR IA : Restauration du chantier Albert
    setVal('ia-prompt-tf-math', config.iaPrompt || '');
    setVal('ia-response-tf-math', config.iaResponse || '');

    // 5. Nettoyage et reconstruction des affirmations
    uiActions.clearPreview();

    const hasQuestions = config.questions && config.questions.length > 0;

    if (hasQuestions) {
        config.questions.forEach(qData => {
            uiActions.addCard({
                statement: qData.statement,
                isTrue: qData.isTrue
            });
            
            // Rigueur : Injection des feedbacks dans la carte fraîchement créée
            const previewContainer = document.getElementById('statements-list');
            const lastCard = previewContainer.lastElementChild;
            if (lastCard) {
                const fbCorrectInput = lastCard.querySelector('.tf-feedback-correct-math');
                const fbIncorrectInput = lastCard.querySelector('.tf-feedback-incorrect-math');
                if (fbCorrectInput) fbCorrectInput.value = qData.feedbackCorrect || '';
                if (fbIncorrectInput) fbIncorrectInput.value = qData.feedbackIncorrect || '';
            }
        });
    }

    // 6. ✅ LOGIQUE DE VISIBILITÉ RIGUREUSE
    const iaContainer = document.getElementById('ia-container-tf-math');
    const albertAction = document.getElementById('albert-action-tf-math');
    const responseArea = document.getElementById('ia-response-tf-math');

    if (config.iaPrompt) {
        if (iaContainer) iaContainer.style.display = 'block';
        if (albertAction) albertAction.style.display = 'block';

        // Masquer le JSON parasite si les questions sont déjà là
        if (hasQuestions && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'none';
        } else if (!hasQuestions && config.iaResponse && responseArea && responseArea.parentElement) {
            // Si pas de cartes, on montre le JSON pour permettre le clic sur "Valider"
            responseArea.parentElement.style.display = 'block';
            responseArea.style.minHeight = '300px';
        }
    }

    // 7. Affichage des sections de l'éditeur
    if (hasQuestions) {
        const statementsSec = document.getElementById('statements-container');
        const finalSec = document.getElementById('tf-math-options-section');
        const generateSec = document.getElementById('generate-section');
        
        if (statementsSec) statementsSec.style.display = 'block';
        if (finalSec) finalSec.style.display = 'block';
        if (generateSec) generateSec.style.display = 'block';
    }

    if (uiActions.updateBtn) uiActions.updateBtn();
}