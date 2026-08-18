// Fichier: modules/ia/prompts/sortparagraphs-prompt.js

import { logger } from '../../utils/logger.js';
import { genererPromptIAHierarchise } from '../prompt-engine.js';

export async function preparerAssistantIA_SortParagraphs(mode = 'strict', repartitionMap = null) {
    logger.log(`🤖 Préparation de l'assistant IA pour Trier les Paragraphes...`);
    
    // ✅ CIBLAGE DES NOUVEAUX IDs GLOBAUX
    const levelSelect = document.getElementById('global-niveau');
    const level = levelSelect ? levelSelect.value : 'Cycle 4';
    
    const langueSelect = document.getElementById('global-language');
    const langue = langueSelect ? langueSelect.value : 'Français';
    
    let type, exempleFormat;

    if (mode === 'strict') {
        type = "Découper le corpus en segments CONSÉCUTIFS par unité de sens, pour créer un exercice de remise en ordre.";
        exempleFormat = `INSTRUCTIONS STRICTES :
1. DÉCOUPAGE SÉMANTIQUE : découpe le corpus en segments consécutifs, chacun formant une UNITÉ DE SENS cohérente (une idée, une étape du raisonnement ou du récit). Si le texte est déjà mis en forme, appuie-toi sur ses paragraphes ; s'il est brut (un seul bloc, sans sauts de ligne), regroupe toi-même les phrases voisines qui traitent de la même idée.
2. CONTIGUÏTÉ ET ORDRE : les segments doivent SE SUIVRE sans trou ni chevauchement et couvrir l'ensemble du passage retenu, dans l'ordre d'origine — l'élève doit pouvoir reconstituer l'enchaînement logique. Ne coupe jamais au milieu d'une phrase.
3. VERBATIM : recopie chaque segment TEXTUELLEMENT depuis le corpus (aucune reformulation, aucun résumé). Ne sélectionne PAS seulement quelques phrases « importantes » isolées.
4. Utilise "---o---" comme séparateur unique entre les segments.`;

    } else {
        type = "une série de paragraphes qui racontent une histoire, en s'inspirant du corpus.";
        exempleFormat = `INSTRUCTIONS STRICTES :
1. Ta réponse doit être des paragraphes **NOUVEAUX**.
2. Utilise "---o---" comme séparateur unique.`;
    }
    
    // ✅ On intègre repartitionMap (et "true" pour forcer la prise en compte des compteurs)
    const prompt = await genererPromptIAHierarchise(level, type, exempleFormat, mode, langue, repartitionMap, true);

    if (prompt) {
        document.getElementById('ia-prompt-sortparagraphs').value = prompt;
        
        // Sécurité pour l'affichage de la zone
        const sectionPrompt = document.getElementById('ia-assistant-section-ia-prompt-sortparagraphs');
        if (sectionPrompt) {
            sectionPrompt.style.display = 'block';
        }
    }
    
    return !!prompt; // Renvoie 'true' si le prompt a bien été généré
}