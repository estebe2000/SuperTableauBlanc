// Fichier: modules/utils/states/quiz-math-state.js
import { logger } from '../logger.js';

/**
 * CAPTURE L'ÉTAT COMPLET DU QUIZ MATHS (Export)
 */
export function getQuizMathState() {
    const questions = [];
    
    // 1. Extraction des cartes de questions mathématiques
    document.querySelectorAll('#questions-list .math-question-card').forEach(card => {
        const answers = [];
        card.querySelectorAll('.math-answer-row').forEach(row => {
            answers.push({
                texte: row.querySelector('.math-answer-text')?.value.trim() || '',
                correct: row.querySelector('.math-answer-checkbox')?.checked || false
            });
        });

        questions.push({
            question: card.querySelector('.math-question-text')?.value.trim() || '',
            answers: answers,
            // Rigueur : Feedbacks spécifiques à la question mathématique
            feedbackCorrect: card.querySelector('.q-feedback-correct-math')?.value.trim() || '',
            feedbackIncorrect: card.querySelector('.q-feedback-incorrect-math')?.value.trim() || ''
        });
    });

    return {
        type: 'quiz-math',
        titre: document.getElementById('quiz-math-title')?.value || '',
        
        // Rigueur : Menus globaux HAPI
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 3',
        //langue: document.getElementById('global-language')?.value || 'Français',
        
        sujet: document.getElementById('quiz-math-subject')?.value || '',
        translateUI: document.getElementById('translate-ui-quiz-math')?.checked ?? true,
        isMulti: document.getElementById('quiz-math-multi-reponse')?.value === 'true',
        
        // ✅ RIGUEUR IA : Sauvegarde du chantier Albert
        iaPrompt: document.getElementById('ia-prompt-quiz-math')?.value || '',
        iaResponse: document.getElementById('ia-response-quiz-math')?.value || '',
        
        questions: questions
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET DU QUIZ MATHS (Import)
 */
export function setQuizMathState(config, uiActions) {
    if (config.type !== 'quiz-math') return;

    logger.log('🔄 Restauration rigoureuse du Quiz Math...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Restauration des réglages globaux et textes
    setVal('quiz-math-title', config.titre);
    //setVal('global-niveau', config.niveau || 'Cycle 3');
    //setVal('global-language', config.langue || 'Français');
    setVal('quiz-math-subject', config.sujet);
    setVal('quiz-math-multi-reponse', config.isMulti ? 'true' : 'false');
    setCheck('translate-ui-quiz-math', config.translateUI);

    // 2. ✅ RIGUEUR IA : Restauration du chantier Albert
    setVal('ia-prompt-quiz-math', config.iaPrompt || '');
    setVal('ia-response-quiz-math', config.iaResponse || '');

    // 3. Nettoyage et reconstruction des questions
    uiActions.clearPreview();

    const hasQuestions = config.questions && config.questions.length > 0;

    if (hasQuestions) {
        config.questions.forEach(qData => {
            const mappedData = {
                question: qData.question,
                answers: qData.answers.map(a => ({ text: a.texte, correct: a.correct }))
            };
            
            uiActions.addCard(mappedData);
            
            // Rigueur : Injection des feedbacks dans la carte fraîchement créée
            const previewContainer = document.getElementById('questions-list');
            const lastCard = previewContainer.lastElementChild;
            if (lastCard) {
                const fbCorrectInput = lastCard.querySelector('.q-feedback-correct-math');
                const fbIncorrectInput = lastCard.querySelector('.q-feedback-incorrect-math');
                if (fbCorrectInput) fbCorrectInput.value = qData.feedbackCorrect || '';
                if (fbIncorrectInput) fbIncorrectInput.value = qData.feedbackIncorrect || '';
            }
        });
    }

    // 4. ✅ LOGIQUE DE VISIBILITÉ RIGUREUSE
    const iaContainer = document.getElementById('ia-container-quiz-math');
    const albertAction = document.getElementById('albert-action-quiz-math');
    const responseArea = document.getElementById('ia-response-quiz-math');

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

    // 5. Affichage automatique des sections de l'éditeur
    if (hasQuestions) {
        const questionsSec = document.getElementById('questions-container');
        const finalSec = document.getElementById('quiz-math-options-section'); 
        const generateSec = document.getElementById('generate-section');
        
        if (questionsSec) questionsSec.style.display = 'block';
        if (finalSec) finalSec.style.display = 'block';
        if (generateSec) generateSec.style.display = 'block';
    }

    if (uiActions.updateBtn) uiActions.updateBtn();
}