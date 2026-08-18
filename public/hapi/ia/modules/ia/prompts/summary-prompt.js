// Fichier: modules/ia/prompts/summary-prompt.js

import { logger } from '../../utils/logger.js';
import { genererPromptIAHierarchise } from '../prompt-engine.js';

export async function preparerAssistantIA_Summary(repartitionMap = null) {
    logger.log("🤖 Préparation de l'assistant IA pour Summary...");
    
    // ✅ CIBLAGE DES NOUVEAUX IDs GLOBAUX
    const levelSelect = document.getElementById('global-niveau');
    const level = levelSelect ? levelSelect.value : 'Cycle 4';
    
    const langueSelect = document.getElementById('global-language');
    const langue = langueSelect ? langueSelect.value : 'Français';

    const type = "groupes de propositions pour une activité 'Choix de résumé' (1 groupe = 1 étape du résumé).";
    
    const exempleFormat = `INSTRUCTIONS STRICTES :
1. Chaque groupe doit contenir UNE SEULE proposition correcte (RC:) et PLUSIEURS propositions incorrectes (RI:).
2. Tout doit être rédigé en ${langue}.
3. Utilise "---o---" comme séparateur unique entre les groupes.

EXEMPLE:
RC: [Correct summary in ${langue}]
RI: [Incorrect summary in ${langue}]
RI: [Incorrect summary in ${langue}]`;
    
    // ✅ "true" à la fin pour forcer la prise en compte de repartitionMap
    const prompt = await genererPromptIAHierarchise(level, type, exempleFormat, 'strict', langue, repartitionMap, true);

    if (prompt) {
        document.getElementById('ia-prompt-summary').value = prompt;
        
        // Sécurité pour s'assurer que l'encadré est bien visible
        const sectionPrompt = document.getElementById('ia-assistant-section-ia-prompt-summary');
        if (sectionPrompt) {
            sectionPrompt.style.display = 'block';
        }
    }
    
    return !!prompt; // Renvoie 'true' si le prompt a bien été généré
}