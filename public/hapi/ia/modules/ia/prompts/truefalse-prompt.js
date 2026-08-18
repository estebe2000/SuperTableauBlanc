// Fichier: modules/ia/prompts/truefalse-prompt.js
import { logger } from '../../utils/logger.js';
import { genererPromptIAHierarchise } from '../prompt-engine.js';

export async function preparerAssistantIA_TrueFalse(repartitionMap = null) {
    logger.log("🤖 Préparation de l'assistant IA pour Vrai/Faux...");
    
    // CIBLAGE DES IDs GLOBAUX
    const niveau = document.getElementById('global-niveau').value;
    const langueSelect = document.getElementById('global-language');
    const langue = langueSelect ? langueSelect.value : 'Français';
    
    const exempleFormat = `Q1: [Affirmation 1].\nR1: VRAI (en français)\n---o---\nQ2: [Affirmation 2].\nR2: FAUX (en français)`;

    // Appel au moteur principal
    const prompt = await genererPromptIAHierarchise(
        niveau, 
        "affirmations (VRAI ou FAUX)", 
        exempleFormat, 
        'strict', 
        langue, 
        repartitionMap
    );

    if (prompt) {
        document.getElementById('ia-prompt-tf').value = prompt;
        
        // Sécurité : vérifier que l'élément parent existe avant de changer son style
        const sectionPrompt = document.getElementById('ia-assistant-section-ia-prompt-tf');
        if (sectionPrompt) {
            sectionPrompt.style.display = 'block';
        }
    }
    return !!prompt;
}