// Fichier: modules/ia/prompts/image-pairing-prompt.js

import { logger } from '../../utils/logger.js';
import { genererPromptIAHierarchise } from '../prompt-engine.js';

/**
 * ÉTAPE 1 : Génère des PROPOSITIONS de stratégies d'appariement.
 * Ne prend pas encore en compte la répartition (on veut juste des idées globales).
 */
export async function preparerPrompt_IdesAppariement() {
    logger.log("🤖 Préparation prompt : Idées d'appariement...");
    
    const subject = document.getElementById('imgpair-subject')?.value || 'Sujet général';
    
    // ✅ Récupération du niveau global
    const levelSelect = document.getElementById('global-niveau');
    const level = levelSelect ? levelSelect.value : 'Cycle 4';
    
    const typeContext = `Ta tâche est de proposer des stratégies pédagogiques d'appariement d'images (associations logiques "Élément A / Élément B") pertinentes pour le sujet : "${subject}".
    Propose 5 à 8 logiques d'association pertinentes.`;

    // 🛠️ MODIFICATION ICI : On bétonne les instructions pour empêcher le mimétisme
    const formatDescription = `INSTRUCTIONS STRICTES (JSON PUR) :
1. Tu dois répondre EXCLUSIVEMENT avec un tableau JSON valide (Array de Strings).
2. Ne génère AUCUN texte avant ou après le tableau, et n'utilise pas de mise en forme spéciale (pas de flèches ou de symboles bizarres).
3. Adapte impérativement le contenu au sujet demandé ("${subject}"). NE COPIE SURTOUT PAS l'exemple ci-dessous.

EXEMPLE DE STRUCTURE ATTENDUE (uniquement à titre d'exemple pour un sujet de géographie/maths) :
[
  "Nom du pays / Drapeau",
  "Capitale / Silhouette du pays",
  "Monument célèbre / Ville",
  "Nom du solide / Patron (déplié)",
  "Objet du quotidien / Forme géométrique"
]`;

    // Utilisation du mode 'creative', sans répartition (null, false)
    return await genererPromptIAHierarchise(level, typeContext, formatDescription, 'creative', 'Français', null, false);
}

/**
 * ÉTAPE 2 : Génère les paires réelles en fonction de la stratégie choisie.
 */
export async function preparerAssistantIA_ImagePairing(strategy, repartitionMap, targetLanguage, globalTheme, corpusContent) {
    logger.log("🤖 Préparation de l'assistant IA pour l'Appariement d'Images...");
    
    // ✅ Récupération du niveau global
    const levelSelect = document.getElementById('global-niveau');
    const level = levelSelect ? levelSelect.value : 'Cycle 4';

    const typeContext = `Ta tâche est de créer une activité d'appariement (Image Pairing) sur le thème : "${globalTheme}".
    STRATÉGIE D'ASSOCIATION À RESPECTER IMPÉRATIVEMENT : "${strategy}".
    
    CONSIGNES DE LANGUE ET DE CONTENU :
    1. Les champs "label" (titre court, 2 à 3 mots max) et "text" (description détaillée, 120 caractères max) DOIVENT être rédigés en ${targetLanguage.toUpperCase()}.
    2. Pour faciliter la génération d'images, tu dois fournir DEUX versions de la description visuelle pour chaque élément :
       - Un "prompt_fr" : Description visuelle simple en FRANÇAIS (pour que l'enseignant comprenne l'image attendue).
       - Un "prompt" : Prompt visuel technique en ANGLAIS (pour le générateur Stable Diffusion/DALL-E, incluant le style, le contexte, l'éclairage, etc.).`;

	   const formatDescription = `IMPORTANT : Réponds UNIQUEMENT avec un tableau JSON valide. Aucun texte avant ou après. Aucun séparateur entre les objets autre que la virgule JSON standard.

	   [
	     {
	       "left_label": "Titre court Élément A",
	       "left_text": "Description détaillée Élément A",
	       "left_prompt_fr": "Description visuelle A en français",
	       "left_prompt": "Technical visual prompt A in english",
	       "right_label": "Titre court Élément B",
	       "right_text": "Description détaillée Élément B",
	       "right_prompt_fr": "Description visuelle B en français",
	       "right_prompt": "Technical visual prompt B in english"
	     },
	     {
	       "left_label": "Titre court Élément C",
	       "left_text": "Description détaillée Élément C",
	       "left_prompt_fr": "Description visuelle C en français",
	       "left_prompt": "Technical visual prompt C in english",
	       "right_label": "Titre court Élément D",
	       "right_text": "Description détaillée Élément D",
	       "right_prompt_fr": "Description visuelle D en français",
	       "right_prompt": "Technical visual prompt D in english"
	     }
	   ]`;

    // ✅ Appel au générateur hiérarchisé (avec gestion automatique du corpus et activation de la répartition à 'true')
    // Ici l'unité du moteur est une PAIRE (1 objet JSON = élément gauche + droit).
    // On surcharge donc le libellé « élément » → « paire d'éléments » pour que
    // le curseur à N produise N paires (et non N/2 : l'IA interprétait « N
    // éléments » comme N images = N/2 paires).
    const prompt = await genererPromptIAHierarchise(
        level, typeContext, formatDescription, 'strict', targetLanguage, repartitionMap, true,
        { sing: "paire d'éléments", plur: "paires d'éléments" }
    );
    
    if (prompt) {
        const promptInput = document.getElementById('ia-prompt-imgpair');
        if (promptInput) promptInput.value = prompt;
        
        const section = document.getElementById('ia-assistant-section-ia-prompt-imgpair');
        if (section) section.style.display = 'block';
    }
    
    return !!prompt;
}