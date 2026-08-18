// Fichier: modules/ia/prompts/wordsearch-prompt.js

import { logger } from '../../utils/logger.js';
import { genererPromptIAHierarchise } from '../prompt-engine.js';

/**
 * Prépare le prompt pour les Mots Mêlés (AVEC COMBINAISON DE MODES ET RÉPARTITION).
 * ✅ Mise à jour : Accepte repartitionMap pour définir le nb de mots par document.
 */
export async function preparerAssistantIA_WordSearch(repartitionMap = null, selectedModes = null) {
    logger.log("🤖 Préparation de l'assistant IA pour Mots Mêlés...");
    
    // ✅ CIBLAGE DES NOUVEAUX IDs GLOBAUX
    const levelSelect = document.getElementById('global-niveau');
    const level = levelSelect ? levelSelect.value : 'Cycle 4';

    const langueSelect = document.getElementById('global-language');
    const lang = langueSelect ? langueSelect.value : 'Français';
    
    // 1. Récupération des modes cochés (types de mots)
    if (!selectedModes) {
        const checkboxes = document.querySelectorAll('.ws-mode-checkbox:checked');
        selectedModes = Array.from(checkboxes).map(cb => cb.value);
    }

    // Sécurité : si rien n'est coché, on prend le vocabulaire par défaut
    if (selectedModes.length === 0) selectedModes.push('vocabulary');

    // 2. Construction dynamique des consignes
    let consignesList = [];
    if (selectedModes.includes('vocabulary')) consignesList.push(`- Des mots de VOCABULAIRE importants (Noms communs, concepts clés).`);
    if (selectedModes.includes('verbs')) consignesList.push(`- Des VERBES d'action (Mets-les IMPÉRATIVEMENT à l'INFINITIF).`);
    if (selectedModes.includes('adjectives')) consignesList.push(`- Des ADJECTIFS qualificatifs (Au masculin singulier).`);
    if (selectedModes.includes('invariable')) consignesList.push(`- Des mots INVARIABLES (conjonctions, prépositions).`);
    if (selectedModes.includes('complex')) consignesList.push(`- Des mots COMPLEXES ou difficiles à orthographier.`);

    const instructionsCombinees = consignesList.join('\n');

    const type = `liste variée de mots pour des Mots Mêlés.`;
    
    const exempleFormat = `INSTRUCTIONS STRICTES :
1. Extrais les mots correspondant aux critères suivants :
${instructionsCombinees}
2. Les mots doivent être en "${lang}".
3. Réponds UNIQUEMENT par une liste de mots séparés par une virgule.
4. PAS de numérotation, PAS de puces, PAS de séparateurs de texte.
5. Mots en MAJUSCULES, sans accents si possible.

EXEMPLE:
POMME,MANGER,ROUGE,VITE,ARBRE`;

    // ✅ CORRECTION : Le paramètre final passe à "false" pour désactiver le ---o---
    const prompt = await genererPromptIAHierarchise(
        level, 
        type, 
        exempleFormat, 
        'strict', 
        lang, 
        repartitionMap, 
        false 
    );

    if (prompt) {
        document.getElementById('ia-prompt-wordsearch').value = prompt;
        const sectionPrompt = document.getElementById('ia-assistant-section-ia-prompt-wordsearch');
        if (sectionPrompt) {
            sectionPrompt.style.display = 'block';
        }
    }
    
    return !!prompt;
}