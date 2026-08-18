// Fichier: modules/ia/prompts/cards-prompt.js

import { logger } from '../../utils/logger.js';
import { genererPromptIAHierarchise } from '../prompt-engine.js';

export async function preparerAssistantIA_Cards(repartitionMap = null, generateTips = false, mode = 'dialog') {
    logger.log("🤖 Préparation de l'assistant IA pour les Cartes...");
    
    // ✅ CIBLAGE DES NOUVEAUX IDs GLOBAUX
    const levelSelect = document.getElementById('global-niveau');
    const level = levelSelect ? levelSelect.value : 'Cycle 4';

    const langueSelect = document.getElementById('global-language');
    const lang = langueSelect ? langueSelect.value : 'Français';
    
    // --- DÉFINITION DU MODE ET DU FORMAT ---
    let typeContext = '';
    let formatDescription = '';
    const commonExpertRule = `RÔLE D'EXPERT : Si le texte source est court, UTILISEZ VOS CONNAISSANCES INTERNES pour identifier les concepts clés. Ne vous limitez pas aux mots présents dans le texte.`;
    
    if (mode === 'flash') {
        // --- MODE FLASHCARDS ---
        typeContext = `Ta tâche est de type "Exercice Flashcards" (Mémorisation et Saisie stricte).
        ${commonExpertRule}
        
        CONSIGNES SPÉCIFIQUES :
        1. FORMAT PÉDAGOGIQUE :
           - Q (Question) : Une définition précise, une fonction, un usage.
           - R (Réponse) : Le MOT-CLÉ exact (1 à 3 mots max). Jamais de phrase complète.
        2. La réponse doit être unique et sans ambiguïté.
        3. MotCléImage : 4-5 mots DANS LA LANGUE DE L'EXERCICE (${lang}) décrivant une scène visuelle concrète.`;
        
        formatDescription = `Q: [Définition / Usage]\nR: [Terme exact]\nMotCléImage: [Description visuelle de la scène]`;
        
    } else {
        // --- MODE DIALOGCARDS ---
        typeContext = `Activité "Dialog Cards" (Cartes de révision / Flashcards orales).
        ${commonExpertRule}
        CONSIGNES SPÉCIFIQUES :
        1. OBJECTIF : Vérifier la compréhension essentielle.
        2. STYLE DES QUESTIONS : Questions ouvertes ou mises en situation.
        3. STYLE DES RÉPONSES : SOYEZ CONCIS. 
           - Maximum 2 à 3 phrases courtes.
           - Synthétisez l'information pour qu'elle tienne sur une carte.
        4. MotCléImage : 4-5 mots DANS LA LANGUE DE L'EXERCICE (${lang}) décrivant une scène visuelle concrète.
        
        RÈGLES DE FORMATAGE (CRUCIAL) :
        - NE METTEZ JAMAIS de gras (**) sur les étiquettes "Q:", "R:", "IndiceAvant:", "MotCléImage:".
        - Écrivez les étiquettes en texte brut uniquement.`;
        
        formatDescription = `Q: [Question]\nR: [Réponse courte et synthétique]\nMotCléImage: [Description visuelle de la scène]`;
    }
    
    // ✅ GESTION DES INDICES (TIPS)
    if (generateTips) {
        if (mode === 'flash') {
            formatDescription = formatDescription.replace('\nMotCléImage:', '\nIndiceAvant: [Indice court pour aider à trouver le mot]\nMotCléImage:');
        } else {
            formatDescription = formatDescription.replace('\nMotCléImage:', '\nIndiceAvant: [Indice court pour aider]\nIndiceArriere: [Info complémentaire ou "Le saviez-vous ?"]\nMotCléImage:');
        }
    }
    
    formatDescription += `\n---o---`;
    
    // ✅ EXEMPLE
    const exemple = `
EXEMPLE DE FORMAT ATTENDU :
Q: Pourquoi un électricien utilise-t-il un multimètre ?
R: Pour diagnostiquer les problèmes électriques
MotCléImage: électricien utilisant un multimètre sur un tableau électrique
${generateTips ? 'IndiceAvant: Outil de mesure électrique' : ''}
---o---`;
    
    // ✅ APPEL AU GÉNÉRATEUR (avec le niveau global et l'activation de la répartition 'true')
    const prompt = await genererPromptIAHierarchise(level, typeContext + exemple, formatDescription, 'strict', lang, repartitionMap, true);
    
    if (prompt) {
        const promptInput = document.getElementById('ia-prompt-cards');
        if (promptInput) promptInput.value = prompt;
        
        const section = document.getElementById('ia-assistant-section-ia-prompt-cards');
        if (section) section.style.display = 'block';
    }
    return !!prompt;
}