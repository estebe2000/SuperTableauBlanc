// Fichier: modules/utils/states/qcm-state.js
import { logger } from '../logger.js';

/**
 * CAPTURE L'ÉTAT COMPLET DU QUIZ (Export)
 */
export function getQCMState() {
    const questions = [];
    
    // 1. Extraction des questions et des feedbacks spécifiques par carte
    const questionCards = document.querySelectorAll('#comprehension-questions-preview .card');
    questionCards.forEach(card => {
        const options = [];
        card.querySelectorAll('.answer-option').forEach(opt => {
            options.push({
                texte: opt.querySelector('.q-answer-text')?.value.trim() || '',
                correct: opt.querySelector('input[type="checkbox"]')?.checked || false
            });
        });

        questions.push({
            question: card.querySelector('.q-text')?.value.trim() || '',
            options: options,
            // Rigueur : On récupère les feedbacks spécifiques à cette question
            feedbackCorrect: card.querySelector('.q-feedback-correct')?.value.trim() || '',
            feedbackIncorrect: card.querySelector('.q-feedback-incorrect')?.value.trim() || ''
        });
    });

    // 2. Exportation de l'objet de configuration total
    return {
        type: 'quiz',
        titre: document.getElementById('quiz-title')?.value || '',
        
        // Rigueur : Récupération sur les menus globaux HAPI
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 3',
        //langue: document.getElementById('global-language')?.value || 'Français',
        
        // Paramètres spécifiques
        translateUI: document.getElementById('translate-ui-quiz')?.checked ?? true,
        isMulti: document.getElementById('quiz-multi-reponse')?.value === 'true',
        
        // ✅ RIGUEUR IA : Sauvegarde du chantier Albert
        iaPrompt: document.getElementById('ia-prompt-quiz')?.value || '',
        iaResponse: document.getElementById('ia-response-quiz')?.value || '',
        
        questions: questions
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET DU QUIZ (Import)
 */
export function setQCMState(config, uiActions) {
    if (config.type !== 'quiz') return;

    logger.log('🔄 Restauration rigoureuse du QCM...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Restauration des réglages globaux et titres
    setVal('quiz-title', config.titre);
    //setVal('global-niveau', config.niveau);
    //setVal('global-language', config.langue);
    setVal('quiz-multi-reponse', config.isMulti ? 'true' : 'false');
    setCheck('translate-ui-quiz', config.translateUI);

    // 2. ✅ RIGUEUR IA : Restauration du prompt et de la réponse
    setVal('ia-prompt-quiz', config.iaPrompt);
    setVal('ia-response-quiz', config.iaResponse);

    // 3. Nettoyage et reconstruction des questions
    uiActions.clearPreview();

    if (config.questions && config.questions.length > 0) {
        config.questions.forEach(qData => {
            // On utilise l'action UI pour créer la structure de base
            uiActions.addCard({
                question: qData.question,
                correct: qData.options.filter(o => o.correct).map(o => o.texte),
                incorrect: qData.options.filter(o => !o.correct).map(o => o.texte)
            });
            
            // Rigueur : Injection des feedbacks spécifiques dans la carte fraîchement créée
            const previewContainer = document.getElementById('comprehension-questions-preview');
            const lastCard = previewContainer.lastElementChild;
            if (lastCard) {
                const fbCorrect = lastCard.querySelector('.q-feedback-correct');
                const fbIncorrect = lastCard.querySelector('.q-feedback-incorrect');
                if (fbCorrect) fbCorrect.value = qData.feedbackCorrect || '';
                if (fbIncorrect) fbIncorrect.value = qData.feedbackIncorrect || '';
            }
        });
    }

    // 4. ✅ LOGIQUE DE VISIBILITÉ RIGUREUSE
    const iaContainer = document.getElementById('ia-container-quiz');
    const albertAction = document.getElementById('albert-action-quiz');
    const responseArea = document.getElementById('ia-response-quiz');
    const hasQuestions = config.questions && config.questions.length > 0;

    // Affichage du chantier Albert si un prompt existe
    if (config.iaPrompt) {
        if (iaContainer) iaContainer.style.display = 'block';
        if (albertAction) albertAction.style.display = 'block';

        // Si les questions sont déjà générées, on cache le JSON "parasite"
        if (hasQuestions && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'none';
        } else if (!hasQuestions && responseArea && responseArea.parentElement) {
            // Si pas de questions, on montre le JSON pour permettre le clic sur "Valider"
            responseArea.parentElement.style.display = 'block';
            responseArea.style.minHeight = '300px';
        }
    }

    // 5. Affichage des sections d'édition et de finalisation
    if (hasQuestions) {
        const sections = ['preview-section', 'final-options-section-quiz', 'generate-section'];
        sections.forEach(id => { 
            const el = document.getElementById(id); 
            if (el) el.style.display = 'block'; 
        });
    }

    // Mise à jour du bouton de génération H5P
    if (uiActions.updateBtn) uiActions.updateBtn();
}