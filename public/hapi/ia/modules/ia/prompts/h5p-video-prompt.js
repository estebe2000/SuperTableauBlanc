// Fichier: modules/ia/prompts/h5p-video-prompt.js
import { logger } from '../../utils/logger.js';
import { genererPromptIAHierarchise } from '../prompt-engine.js';

/**
 * Construit le prompt pour générer les interactions de la vidéo H5P
 */
export function genererPrompt_H5PVideo(videoDur, formattedTranscript, typesList, currentLang, summaryCount, summaryGroupsCount, summaryAtEnd, niveau, discipline, extraInstructions = '') {
    return `Tu es un expert en pédagogie et en didactique.

CONTEXTE PÉDAGOGIQUE :
- Public cible (Niveau) : ${niveau}
- Discipline concernée : ${discipline}
- Durée de la vidéo : ${videoDur}

Transcription horodatée :
---
${formattedTranscript}
---
MISSION : Génère EXACTEMENT ${typesList}.
${extraInstructions ? '\n' + extraInstructions + '\n' : ''}
RÈGLES :
- 🌐 CRUCIAL : Rédige TOUT le contenu généré (questions, affirmations, feedbacks, options) obligatoirement en : ${currentLang}.
- Chaque interaction doit être ancrée dans un passage précis de la transcription. Le timestamp doit être placé À LA FIN de l'explication du concept (marge de 5 à 10 secondes).

🧠 DIRECTIVES PÉDAGOGIQUES (CRITIQUES) :
- Adapte STRICTEMENT ton vocabulaire, la complexité de tes phrases et le niveau d'exigence cognitif au niveau cible (${niveau}) et à la discipline (${discipline}).
- Les questions NE DOIVENT PAS être de la simple extraction d'informations de surface (ex: retrouver un nom propre ou une date sans enjeu). Elles doivent forcer l'analyse, la compréhension causale ou la résolution de problème selon les standards de la discipline.
- Pour "quiz" (Choix Unique) et "multichoice" (Choix Multiples) : Les mauvaises réponses (distracteurs) DOIVENT être des idées fausses plausibles ou des confusions fréquentes typiques des élèves de ce niveau. 1 seule bonne réponse pour "quiz" ("correct" est un nombre), 2 ou 3 pour "multichoice" ("correct" est un tableau).
- Pour "truefalse" : Ne teste pas des évidences. Cible des nuances, des exceptions ou des concepts contre-intuitifs.
- Pour "fillblanks" (Texte à trous) et "dragtext" (Étiquettes) : Cible UNIQUEMENT le vocabulaire technique ou les concepts clés de la discipline. Ne cache JAMAIS des mots de liaison, des verbes génériques ou des prénoms. ⚠️ RÈGLE TECHNIQUE : Ne crée JAMAIS de trous sur une liste ou une énumération (ex: "téléphone, tablette et PC"). L'outil pénalise si l'ordre est inversé. Cible UNIQUEMENT des mots clés uniques déductibles grâce au contexte. Mets dans "text" la phrase COMPLÈTE et NON trouée (le mot cible écrit EN TOUTES LETTRES, sans marqueur), et liste les mots cibles (mots isolés) dans le tableau "words" — le trou est fabriqué automatiquement à partir de "words". ⚠️ Pour "dragtext" (Étiquettes) UNIQUEMENT : prévois TOUJOURS au moins 2 étiquettes (au moins 2 mots dans "words") — avec une seule étiquette l'exercice n'a aucun intérêt pédagogique (la seule étiquette se place sans choix possible).
- Pour "markthewords" (Mots à repérer) : La consigne ("instruction") doit exiger une catégorisation sémantique ou une analyse pertinente pour le niveau (ex: "Cliquez sur tous les composants du circuit"). INTERDIT de demander de chercher de simples noms propres sans consigne analytique. ⚠️ RÈGLE TECHNIQUE STRICTE (différente de fillblanks/dragtext où les groupes de mots sont autorisés) : ici le composant BUGUE sur les groupes de mots et les articles élidés. Chaque entrée de "words" doit être UN SEUL mot, sans aucune espace. JAMAIS de groupe de mots ni d'expression à plusieurs mots ("lac de retenue", "réseaux sociaux", "réalité virtuelle"), et JAMAIS l'article avec apostrophe : mets "eau" et non "l'eau". ➡️ Si un concept clé est une expression de plusieurs mots (ex: "réseaux sociaux", "réalité virtuelle"), NE la sélectionne PAS en entier : choisis UN SEUL mot significatif de l'expression (ex: "virtuelle" seul, ou "réseaux" seul) OU cible un autre mot isolé pertinent. Ne place JAMAIS deux mots consécutifs dans "words" lorsqu'ils forment une même expression. Avant de finaliser, VÉRIFIE que chaque élément de "words" ne contient aucune espace. Mets le texte SANS marqueur dans "text" et les mots à cliquer dans le tableau "words".
${summaryCount ? `- Pour "summary" (Résumé) : Les affirmations correctes doivent synthétiser les concepts clés à retenir, pas juste résumer chronologiquement. Les distracteurs doivent être des contresens fréquents. Le tableau "statements" de CHAQUE résumé DOIT contenir EXACTEMENT ${summaryGroupsCount} séquences.` : ''}
${(summaryCount && summaryAtEnd) ? `- IMPORTANT : Le DERNIER résumé généré doit absolument faire office de conclusion globale de la vidéo.` : ''}

- Réponds UNIQUEMENT en JSON strict, sans texte avant ni après.
- 🚫 N'utilise JAMAIS d'astérisques (*) ni aucun formatage Markdown nulle part dans le JSON. Pour "fillblanks", "dragtext" et "markthewords", le champ "text" contient le texte NU (recopié à l'identique) et le champ "words" la liste des mots cibles tels qu'ils apparaissent dans "text" (le balisage est appliqué automatiquement ensuite).
- 🚫 INTERDICTION DE TROUS VIDES (fillblanks/dragtext/markthewords) : dans "text", n'écris JAMAIS le mot cible sous forme de tirets bas (___), de blanc, de points de suspension (…) ou de crochets. Le champ "text" doit contenir la phrase COMPLÈTE avec le mot réponse écrit EN TOUTES LETTRES ; le trou (ou l'étiquette, ou le mot cliquable) est fabriqué automatiquement à partir de "words". ✅ CORRECT : "text": "En 1972, la première console s'appelle l'Odyssey.", "words": ["Odyssey"]. ❌ INTERDIT : "text": "En 1972, la première console s'appelle l'________.".
- ⚠️ ÉLISION (apostrophe) : ne SUPPRIME JAMAIS le mot cible du champ "text". Après une apostrophe élidée, garde le mot ENTIER dans "text" — écris « On verse 130 ml d'eau » et JAMAIS « On verse 130 ml d' ». Dans "words", mets uniquement le nom nu (« eau », pas « l'eau » ni « d'eau »).

FORMAT DE SORTIE (tableau JSON) :
[
  { "type": "quiz", "timestamp": "MM:SS", "data": { "question": "...", "options": ["A","B","C"], "correct": 0, "feedbackCorrect": "...", "feedbackIncorrect": "..." }},
  { "type": "multichoice", "timestamp": "MM:SS", "data": { "question": "...", "options": ["A","B","C","D"], "correct": [0, 2], "feedbackCorrect": "...", "feedbackIncorrect": "..." }},
  { "type": "truefalse", "timestamp": "MM:SS", "data": { "question": "...", "answer": true, "feedbackCorrect": "...", "feedbackIncorrect": "..." }},
  { "type": "fillblanks", "timestamp": "MM:SS", "data": { "instruction": "Remplissez les mots manquants.", "text": "Le mot est important.", "words": ["mot"] }},
  { "type": "dragtext", "timestamp": "MM:SS", "data": { "instruction": "Faites glisser les éléments au bon endroit.", "text": "Le chat dort sur le tapis.", "words": ["chat", "tapis"] }},
  { "type": "markthewords", "timestamp": "MM:SS", "data": { "instruction": "[CRÉER UNE CONSIGNE SÉMANTIQUE PRÉCISE ICI]", "text": "Voici le mot à cliquer et l'autre mot.", "words": ["mot", "autre"] }}
  ${summaryCount ? `, { "type": "summary", "timestamp": "MM:SS", "data": { "statements": [ /* METTRE EXACTEMENT ${summaryGroupsCount} OBJETS { "correct": "...", "distractors": ["..."] } ICI */ ] }}` : ''}
]
Génère maintenant :`;
}