// Fichier: modules/ia/prompts/truefalse-math-prompt.js

import { logger } from '../../utils/logger.js';
import { genererPromptIAHierarchise } from '../prompt-engine.js';

export async function preparerAssistantIA_TrueFalseMath(repartitionMap = null) {
    logger.log("🤖 Préparation de l'assistant IA pour V/F Math...");
    const level = document.getElementById('tf-math-level').value;
    const subject = document.getElementById('tf-math-subject').value;

    const type = `affirmations Vrai/Faux (Mathématique) sur le sujet : "${subject}".`;
    
    // MODIFICATION ICI : On change les instructions et l'exemple
    const exempleFormat = `INSTRUCTIONS STRICTES (JSON):
1. Réponds EXCLUSIVEMENT avec un tableau JSON unique.
2. Clés: "statement_latex" (string) et "is_true" (boolean).
3. Double chaque backslash LaTeX (ex: \\\\frac -> \\\\frac).
4. Écris le texte en français normalement (sans \\\\text{}) et utilise LaTeX uniquement pour les formules mathématiques.

EXEMPLE:
[
  {
    "statement_latex": "La dérivée de la fonction \\\\cos(x) est égale à -\\\\sin(x).",
    "is_true": true
  },
  {
    "statement_latex": "Si \\\\Delta > 0, l'équation \\\\( ax^2+bx+c=0 \\\\) admet deux solutions.",
    "is_true": true
  }
]`;

    const prompt = await genererPromptIAHierarchise(level, type, exempleFormat, 'strict', 'Français', repartitionMap, false);

    if (prompt) {
        document.getElementById('ia-prompt-tf-math').value = prompt;
        document.getElementById(`ia-assistant-section-ia-prompt-tf-math`).style.display = 'block';
    }
    return !!prompt;
}