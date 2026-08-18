// Fichier: modules/ia/prompts/molecules3D-prompt.js

import { logger } from '../../utils/logger.js';
import { corpusManager } from '../../corpus/corpus-manager.js';
import { readFileContent } from '../../corpus/file-parsers.js';

export async function preparerAssistantIA_Molecules3D(directCorpus = null) {
    logger.log("🤖 Préparation de l'assistant IA pour détection de molécules 3D...");
    
    let corpusText = '';
    if (directCorpus && typeof directCorpus === 'string' && directCorpus.trim().length > 0) {
        corpusText = directCorpus;
    } else if (typeof corpusManager !== 'undefined') {
        const sources = corpusManager.getCorpusSources();
        const promises = sources.map(async (source) => {
            try {
                if (source.type === 'text') return source.data;
                else return await readFileContent(source.data);
            } catch (e) {
                return '';
            }
        });
        const contents = await Promise.all(promises);
        corpusText = contents.join('\n\n');
    }

    if (!corpusText || corpusText.trim().length === 0) {
        alert("Impossible de générer le prompt : le corpus est vide.");
        return false;
    }
    
    const texteNettoye = corpusText.replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => c === '\n' ? '\n' : '');

    const prompt = `
Tu es un expert en chimie organique et en nomenclature IUPAC.
Ton rôle est d'analyser le texte brut ci-dessous pour identifier TOUTES les molécules mentionnées.

CONSIGNES STRICTES :
1. **Repère les noms explicites** (ex: "Méthane").
2. **INTERPRÈTE LES FORMULES** (ex: "C2H6"). Traduis-les en nom anglais officiel (PubChem).
3. **Sortie JSON uniquement**.

FORMAT CIBLE (JSON) :
[
  {
    "nom_pubchem": "nom_anglais_pour_pubchem",
    "titre": "Nom français ou tel qu'il apparait",
    "formule": "Formule brute (ex: C2H6)"
  }
]

TEXTE :
---------------------
${texteNettoye}
---------------------
`;
    
    const promptTextarea = document.getElementById('ia-prompt-3d');
    if (promptTextarea) {
        promptTextarea.value = prompt;
        try {
            await navigator.clipboard.writeText(prompt);
            const btn = document.getElementById('btn-prepare-prompt-3d');
            if(btn) {
                const original = btn.innerHTML;
                btn.innerHTML = "📋 Copié !";
                setTimeout(() => btn.innerHTML = original, 2000);
            }
        } catch (e) { }
        return true;
    }
    return false;
}