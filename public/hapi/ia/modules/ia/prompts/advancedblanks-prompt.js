// Fichier: modules/ia/prompts/advancedblanks-prompt.js

import { logger } from '../../utils/logger.js';
import { getBOPromptBlockForCurrentSelection } from '../bo-context.js';

export async function preparerAssistantIA_AdvancedBlanks(rules, sourceText) {
    if (!rules || rules.length === 0) { 
        alert("Veuillez définir au moins une règle d'extraction."); 
        return false; 
    }
    if (!sourceText.trim()) { 
        alert('Le texte source est vide.'); 
        return false; 
    }

    const lang = document.getElementById('global-language')?.value || 'Français';

    // --- BLOC RAG BOEN (aligné sur le programme officiel) ---
    const promptBO = await getBOPromptBlockForCurrentSelection(sourceText);
    // Garde-fou : le bloc programme ne doit servir que d'orientation, jamais
    // de source de mots. N'apparaît que si le RAG a effectivement renvoyé un bloc.
    const ragGuard = promptBO
        ? `⚠️ PÉRIMÈTRE D'ANALYSE STRICT : le bloc « ÉLÉMENTS DU PROGRAMME OFFICIEL » ci-dessous est UNIQUEMENT un contexte d'orientation pédagogique. Tu dois identifier les trous EXCLUSIVEMENT à partir du TEXTE SOURCE délimité plus bas (entre --- DEBUT TEXTE --- et --- FIN TEXTE ---). Ne place JAMAIS de trou sur un mot issu du bloc programme officiel.\n\n`
        : '';

    let prompt = `Tu es un expert en ingénierie pédagogique.\n`;
    prompt += `Dans le texte fourni ci-dessous, tu dois identifier les mots qui correspondent à L'UN des critères suivants :\n\n`;

    rules.forEach((rule, index) => {
        prompt += `- CRITÈRE ${index + 1} : ${rule.task}\n`;
        if (rule.example) {
            prompt += `  Exemple attendu : ${rule.example}\n`;
        }
    });

    prompt += `
TA MISSION :
1. Crée un exercice de "Texte à trous complexe".
2. Remplace chaque mot trouvé par EXACTEMENT le marqueur [TROU] (entre crochets, en majuscules).
3. Pour CHAQUE trou, anticipe 1 ou 2 erreurs courantes que ferait un élève et rédige un feedback explicatif court.
4. CONTRAINTE JSON ABSOLUE : ta réponse doit être un JSON strictement valide. "blanksText" est UNE SEULE chaîne JSON : remplace chaque retour à la ligne par \\n et n'utilise JAMAIS de triples guillemets (""").
5. MULTI-SOURCES : si le texte est découpé en BLOCS (--- DEBUT BLOC SOURCE ---), respecte le nombre de trous indiqué par bloc (ligne 🛑) et construis "blanksText" avec le texte de TOUS les blocs dans l'ordre, SANS les lignes techniques (---, NOM:, 🛑, CONTENU:).

RÈGLE ABSOLUE : La langue de l'exercice et des feedbacks doit être : "${lang}".

FORMAT JSON ATTENDU STRICTEMENT :
{
  "task": "Consigne...",
  "blanksText": "Le chat [TROU] la souris.",
  "blanks": [
    {
      "correct": "mange",
      "incorrect": [
        {"text": "mangé", "feedback": "Attention au temps : ici c'est le présent."},
        {"text": "manges", "feedback": "Accord sujet/verbe : 'Le chat' est à la 3e personne."}
      ]
    }
  ]
}

${ragGuard}${promptBO}TEXTE SOURCE :
--- DEBUT TEXTE ---
${sourceText.trim()}
--- FIN TEXTE ---`;

    const promptTextarea = document.getElementById('ia-prompt-advanced-blanks');
    if (promptTextarea) {
        promptTextarea.value = prompt;
        logger.log('🤖 Prompt (Advanced Blanks) finalisé avec règles.');
    }
    
    return true;
}