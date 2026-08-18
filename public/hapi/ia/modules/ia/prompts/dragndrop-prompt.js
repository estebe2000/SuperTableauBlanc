// Fichier: modules/ia/prompts/dragndrop-prompt.js

import { logger } from '../../utils/logger.js';
import { corpusManager } from '../../corpus/corpus-manager.js';
import { getBOPromptBlockForCurrentSelection } from '../bo-context.js';

export async function preparerAssistantIA_Categorisation(options = {}) {
    const repartitionMap = options.repartition || {};
    const layoutMode = options.layoutMode || 'table';

    let texteSources = "";
    const allSources = corpusManager.getCorpusSources() || [];

    if (Object.keys(repartitionMap).length === 0 || repartitionMap['all']) {
        texteSources = allSources.map(s => `\n--- Source: ${s.name || 'Document'} ---\n${s.data || s.content || ''}\n`).join('');
    } else {
        for (const [sourceId, count] of Object.entries(repartitionMap)) {
            if (count > 0) {
                const source = allSources.find(s => s.id === sourceId);
                if (source) texteSources += `\n--- Source: ${source.name || 'Document'} ---\n${source.data || source.content || ''}\n`;
            }
        }
    }

    if (!texteSources.trim()) texteSources = "Le texte fourni est vide. Veuillez utiliser vos connaissances générales.";

    // --- BLOC RAG BOEN (aligné sur le programme officiel) ---
    const promptBO = await getBOPromptBlockForCurrentSelection(texteSources);

    let systemPrompt = "";

    if (layoutMode === 'image') {
        systemPrompt = `Agis comme un concepteur pédagogique. Tu dois extraire le vocabulaire technique, spécifique ou les lieux du texte fourni pour permettre à un élève de légender un schéma ou une carte.
        
Génère STRICTEMENT un objet JSON valide avec cette structure :
1. "consigne": Une consigne claire du type "Légendez le schéma suivant avec les termes appropriés."
2. "categories": Un tableau où chaque élément correspond à une partie à légender. Le "nom" de la catégorie DOIT ÊTRE le mot exact à trouver, et "elements" doit être un tableau d'objets.

Chaque objet dans "elements" doit contenir :
- "texte" : Le mot exact à afficher.
- "image_prompt" : Des mots-clés TRES précis intégrant le contexte global pour trouver ou générer une image de cet élément (ex: au lieu de juste "remparts", écris "remparts muraille de pierre d'un château fort médiéval").

Exemple de format JSON attendu :
{
  "consigne": "Légendez le château fort.",
  "categories": [
    { "nom": "donjon", "elements": [ { "texte": "donjon", "image_prompt": "tour principale d'un château fort médiéval en pierre" } ] },
    { "nom": "pont-levis", "elements": [ { "texte": "pont-levis", "image_prompt": "pont-levis en bois au-dessus des douves d'un château fort" } ] }
  ]
}`;
    } else {
        systemPrompt = `Agis comme un concepteur pédagogique expert. Ton objectif est de créer un exercice de catégorisation pertinent basé sur le texte fourni.

RÈGLES D'ANALYSE ET DE CRÉATION :
1. Si le texte contient explicitement des listes d'éléments, extrais-les et regroupe-les logiquement.
2. Si le texte donne simplement un thème, un concept ou des noms de catégories, tu DOIS GÉNÉRER TOI-MÊME des exemples pertinents.
3. Crée idéalement entre 2 et 4 catégories, avec au moins 3 à 5 éléments par catégorie pour que l'exercice soit consistant.

Génère STRICTEMENT un objet JSON valide avec la structure exacte ci-dessous, sans aucun texte ou formatage markdown avant ou après :
{
  "consigne": "Classez les éléments suivants dans les bonnes catégories.",
  "categories": [
    { 
      "nom": "Nom de la catégorie 1", 
      "elements": [
        { "texte": "élément 1", "image_prompt": "mots-clés décrivant l'élément 1 dans son contexte global" },
        { "texte": "élément 2", "image_prompt": "mots-clés décrivant l'élément 2 dans son contexte global" }
      ] 
    }
  ]
}`;
    }

    const promptArea = document.getElementById('ia-prompt-cat');
    if (promptArea) {
        promptArea.value = `${systemPrompt}\n\n${promptBO}Voici le texte source à analyser pour générer l'exercice :\n-----------------\n${texteSources.substring(0, 8000)}`;
        return true;
    } else { return false; }
}