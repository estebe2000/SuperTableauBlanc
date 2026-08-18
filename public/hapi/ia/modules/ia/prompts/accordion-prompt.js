// Fichier: modules/ia/prompts/accordion-prompt.js

import { logger } from '../../utils/logger.js';
import { genererPromptIAHierarchise } from '../prompt-engine.js';

export async function preparerAssistantIA_Accordion(repartitionMap = null) {
    logger.log("🤖 Préparation de l'assistant IA pour Accordéon...");
    
    // CIBLAGE DES NOUVEAUX IDs GLOBAUX
    const level = document.getElementById('global-niveau').value;
    const langueSelect = document.getElementById('global-language');
    const langue = langueSelect ? langueSelect.value : 'Français';

    const type = "termes de glossaire (Concept et Définition)";
    const exempleFormat = `INSTRUCTIONS STRICTES :
1. Les mots "Concept:" et "Définition:" doivent IMPÉRATIVEMENT rester en FRANÇAIS.
2. Ne mets pas en caractères gras les mots Concept et Définition, ni les mots dans le reste du contenu.
3. Extrais les concepts clés et leurs définitions.
4. Rédige le reste du contenu en ${langue}.
5. Utilise "---o---" comme séparateur unique entre les entrées.

EXEMPLE:
Concept: [Terme en ${langue}]
Définition: [Définition complète en ${langue}]`;
    
    const prompt = await genererPromptIAHierarchise(level, type, exempleFormat, 'strict', langue, repartitionMap);

    if (prompt) {
        document.getElementById('ia-prompt-accordion').value = prompt;
        
        // Sécurité pour l'affichage de la section
        const sectionPrompt = document.getElementById('ia-assistant-section-ia-prompt-accordion');
        if (sectionPrompt) {
            sectionPrompt.style.display = 'block';
        }
    }
    return !!prompt;
}