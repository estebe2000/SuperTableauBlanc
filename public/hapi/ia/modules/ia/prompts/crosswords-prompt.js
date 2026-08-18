// Fichier: modules/ia/prompts/crosswords-prompt.js

import { logger } from '../../utils/logger.js';
import { genererPromptIAHierarchise } from '../prompt-engine.js';

export async function preparerAssistantIA_Crossword(repartitionMap = null) {
    logger.log("🤖 Préparation de l'assistant IA pour Mots Croisés...");
    
    // ✅ CIBLAGE DES NOUVEAUX IDs GLOBAUX
    const level = document.getElementById('global-niveau').value;
    const langueSelect = document.getElementById('global-language');
    const langue = langueSelect ? langueSelect.value : 'Français';

    // ✅ LE SUJET RESTE LOCAL (il existe toujours dans crossword-ui)
    const subject = document.getElementById('crossword-subject')?.value || 'Connaissances générales';

    const type = `paires "indice" et "réponse" pour des mots croisés sur le sujet : "${subject}".`;
    
    const exempleFormat = `INSTRUCTIONS STRICTES (JSON):
1. Réponds EXCLUSIVEMENT avec un tableau JSON unique contenant tous les éléments.
2. Clés: "clue" (string), "answer" (string), "extraClue" (string).
3. Les indices (clue) doivent être rédigés en ${langue}.
4. La "answer" (réponse) doit être le mot dans la langue cible (${langue}), sans espace, sans accent, en MAJUSCULES.

EXEMPLE:
[
  {
    "clue": "Indice en ${langue}...",
    "answer": "REPONSE",
    "extraClue": "Indice supplémentaire..."
  }
]`;
    
    // ✅ useSeparator = false
    const prompt = await genererPromptIAHierarchise(level, type, exempleFormat, 'creative', langue, repartitionMap, false);

    if (prompt) {
        document.getElementById('ia-prompt-crossword').value = prompt;
        
        // Sécurité pour l'affichage de la section
        const sectionPrompt = document.getElementById(`ia-assistant-section-ia-prompt-crossword`);
        if (sectionPrompt) {
            sectionPrompt.style.display = 'block';
        }
    }
    return !!prompt;
}