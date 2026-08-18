// Fichier: modules/ia/prompts/dictation-prompt.js

import { getBOPromptBlockForCurrentSelection } from '../bo-context.js';

export async function preparerAssistantIA_Dictation(texteSource) {
    const lang = document.getElementById('global-language')?.value || 'Français';

    // --- BLOC RAG BOEN (aligné sur le programme officiel) ---
    const promptBO = await getBOPromptBlockForCurrentSelection(texteSource);

    const promptFinal = `Tu es un expert linguistique et un professeur expérimenté.
Ta mission est de préparer les phrases d'une dictée audio à partir du contenu fourni par l'enseignant.

ANALYSE LE CONTENU POUR CHOISIR TON MODE D'ACTION EN SILENCE (Ne l'écris pas dans ta réponse) :
- Mode 1 (Découpage) : Si c'est un texte continu, découpe-le phrase par phrase sans rien modifier.
- Mode 2 (Création) : Si c'est une liste de mots ou une consigne, invente 5 à 10 phrases cohérentes.

Langue de la dictée : ${lang}

RÈGLES DE FORMATAGE STRICTES ET IMPÉRATIVES :
1. Tu dois renvoyer UNIQUEMENT le texte des phrases prêtes à être dictées.
2. N'écris AUCUN texte avant ou après (ni introduction, ni conclusion).
3. NE MENTIONNE JAMAIS le mode choisi.
4. N'utilise AUCUNE puce, AUCUN tiret (-), AUCUN signe égal (=), et AUCUNE numérotation.
5. Chaque phrase doit commencer DIRECTEMENT par sa première lettre (généralement une majuscule).
6. Sépare chaque phrase EXCLUSIVEMENT par la ligne de séparation suivante : ---o---

EXEMPLE DE SORTIE EXACTE ATTENDUE :
La légende d'Hercule.
---o---
Hercule réalisa de nombreux exploits.
---o---
Il tua par exemple le lion de Némée, un animal très dangereux.

${promptBO}Voici le contenu de l'enseignant à traiter :
"""
${texteSource}
"""`;

    const promptArea = document.getElementById('ia-prompt-dictation');
    if (promptArea) {
        promptArea.value = promptFinal;
        const section = document.getElementById('ia-assistant-section-ia-prompt-dictation');
        if (section) section.style.display = 'block';
        return true;
    }
    return false;
}