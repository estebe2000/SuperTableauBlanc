// Fichier: modules/ia/prompts/quiz-math-prompt.js

import { logger } from '../../utils/logger.js';
import { genererPromptIAHierarchise } from '../prompt-engine.js';

/**
 * Prépare le prompt pour Quiz Math avec gestion dynamique de la structure JSON (Single/Multi).
 */
export async function preparerAssistantIA_QuizMath(repartitionMap = {}, isMulti = false) {
    logger.log(`🤖 Préparation Assistant Quiz Math (Mode: ${isMulti ? 'MULTI' : 'SINGLE'})...`);
    
    // Calcul du nombre de questions et sécurisation des variables
    const totalQuestions = Object.values(repartitionMap).reduce((acc, val) => acc + val, 0);
    const questionsCount = totalQuestions > 0 ? totalQuestions : 5;
    
    const levelSelect = document.getElementById('quiz-math-level');
    const level = levelSelect ? levelSelect.value : 'Cycle 4';
    
    const subjectInput = document.getElementById('quiz-math-subject');
    const subject = (subjectInput && subjectInput.value.trim() !== '') ? subjectInput.value.trim() : 'Général';
    
    // 1. Définition des formats JSON selon le mode
    let formatInstruction = '';
    let jsonExample = '';

    if (isMulti) {
        // --- MODE MULTI-RÉPONSES : On demande un tableau de réponses ---
        formatInstruction = `
3. **STRUCTURE JSON MULTI-RÉPONSES (OBLIGATOIRE)** :
   - Clé "question_latex" : L'énoncé.
   - Clé "reponses" : Un TABLEAU d'objets contenant :
     - "latex" : Le texte de la réponse.
     - "correct" : true (si c'est une bonne réponse) ou false.
   - ⚠️ IMPORTANT : Il doit y avoir **PLUSIEURS** réponses correctes (correct: true) et au moins une fausse.`;

        jsonExample = `
[
  {
    "question_latex": "Quelles sont les solutions de \\\\( x^2 = 4 \\\\) ?",
    "reponses": [
      { "latex": "\\\\( 2 \\\\)", "correct": true },
      { "latex": "\\\\( -2 \\\\)", "correct": true },
      { "latex": "\\\\( 4 \\\\)", "correct": false },
      { "latex": "\\\\( 0 \\\\)", "correct": false }
    ]
  }
]`;
    } else {
        // --- MODE CHOIX UNIQUE : On garde l'ancien format (plus stable pour le simple) ---
        formatInstruction = `
3. **STRUCTURE JSON CHOIX UNIQUE (OBLIGATOIRE)** :
   - Clés exactes : "question_latex", "reponse_correcte_latex", "distracteur_un_latex", "distracteur_deux_latex".`;

        jsonExample = `
[
  {
    "question_latex": "Quelle est la primitive de \\\\( 2x \\\\) ?",
    "reponse_correcte_latex": "\\\\( x^2 \\\\)",
    "distracteur_un_latex": "\\\\( 2x^2 \\\\)",
    "distracteur_deux_latex": "\\\\( x \\\\)"
  }
]`;
    }

    // 2. Construction du Prompt Complet
    const typeContext = `Tu es un professeur de mathématiques expert.
    Génère EXACTEMENT ${questionsCount} questions QCM sur le sujet : "${subject}".
    Adapte le niveau au public visé (${level}).
    ${isMulti ? "CONTEXTE : Ce sont des questions à CHOIX MULTIPLES (plusieurs bonnes réponses possibles par question)." : "CONTEXTE : Ce sont des questions à CHOIX UNIQUE."}
    
    ATTENTION : Tu dois IMPÉRATIVEMENT générer le nombre exact de questions demandé (${questionsCount}), ni plus, ni moins !`;

    const exempleFormat = `RÈGLES DE FORMATAGE STRICTES (JSON PUR):

1. **TEXTE vs MATHS** :
   - Écris le français sans balises (PAS de \\text{}).
   - Formules mathématiques UNIQUEMENT entre \\\\( et \\\\).

2. **INTERDICTION DES TABLEAUX** : Transforme les tableaux de valeurs en phrases descriptives.

${formatInstruction}

4. **JSON VALIDE** : Échappe les backslashs (ex: \\\\frac). Réponds uniquement par le tableau JSON, sans texte avant ou après.

EXEMPLE ATTENDU :
${jsonExample}`;
    
    // 3. Appel Générateur (avec inclusion du corpus activée sur 'true')
    const prompt = await genererPromptIAHierarchise(
        level,           
        typeContext,     
        exempleFormat,   
        'strict',        
        'Français',      
        repartitionMap,
        false // ⚠️ useSeparator : DOIT être false en sortie JSON. Le séparateur "---o---" casse le JSON.parse.
              // (Le corpus est lu inconditionnellement, ce flag ne contrôle PAS la lecture des documents.)
    );

    // 4. Affichage dans l'UI
    if (prompt) {
        const promptField = document.getElementById('ia-prompt-quiz-math');
        if (promptField) {
            promptField.value = prompt;
            // L'apparition du bloc IA est gérée proprement du côté de quiz-math-ui.js
        }
    }
    
    return !!prompt;
}