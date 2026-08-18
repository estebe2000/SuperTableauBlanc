// Fichier: modules/ia/prompts/qcm-prompt.js
import { logger } from '../../utils/logger.js';
import { genererPromptIAHierarchise } from '../prompt-engine.js';

export async function preparerAssistantIA_Quiz(repartitionMap = null) {
    logger.log("🤖 Préparation Assistant QCM...");
    const niveau = document.getElementById('global-niveau').value;
    const isMulti = document.getElementById('quiz-multi-reponse').value === 'true';
    const langue = document.getElementById('global-language')?.value || 'Français';

    const exempleFormat = isMulti 
        ? `Q1: [Texte]?\nRC: [Correct].\nRC: [Correct].\nRI: [Incorrect].\n---o---`
        : `Q1: [Texte]?\nRC: [Correct].\nRI: [Incorrect].\nRI: [Incorrect].\n---o---`;

    const prompt = await genererPromptIAHierarchise(
        niveau, isMulti ? "QCM (multi)" : "QCM (unique)", exempleFormat, 'strict', langue, repartitionMap, true
    );
    
    if (prompt) {
        document.getElementById('ia-prompt-quiz').value = prompt; 
        document.getElementById('ia-assistant-section-ia-prompt-quiz').style.display = 'block';
    }
    return !!prompt;
}