// Fichier: modules/utils/h5p-constants.js

/**
 * Base URL des bibliothèques H5P.
 *
 * Les bibliothèques ont été externalisées dans le dépôt parallèle
 * « hapi-h5p-libraries » (déployé en GitLab Pages) pour alléger ce dépôt.
 * En production les deux projets sont servis sur le même hôte Pages
 * (drane-normandie.forge.apps.education.fr), et l'hôte renvoie
 * `Access-Control-Allow-Origin: *`, donc cette URL absolue fonctionne
 * aussi bien en production qu'en développement local.
 *
 * ⚠️ Si le chemin de déploiement du dépôt de bibliothèques change,
 *    c'est ICI (et uniquement ici) qu'il faut le mettre à jour.
 */
export const H5P_LIBS_BASE_URL = 'https://drane-normandie.forge.apps.education.fr/hapi-h5p-libraries/ia/h5p-libraries';

/**
 * Versions de secours des librairies H5P si le chargement
 * du CSV échoue.
 * (Code des lignes 834-855)
 */
export const H5P_FALLBACK_VERSIONS = {
    "H5P.QuestionSet": { major: 1, minor: 20 },
    "H5P.MathDisplay": { major: 1, minor: 0 },
    "H5P.MultiChoice": { major: 1, minor: 16 },
    "H5P.Question": { major: 1, minor: 5 },
    "H5P.TrueFalse": { major: 1, minor: 8 },
    "H5P.JoubelUI": { major: 1, minor: 3 },
    "H5P.Transition": { major: 1, minor: 0 },
    "FontAwesome": { major: 4, minor: 5 },
    "H5P.Dictation": { major: 1, minor: 3 },
    "H5P.Audio": { major: 1, minor: 5 },
    "H5P.TextUtilities": { major: 1, minor: 3 },
    "H5P.FindTheWords": { major: 1, minor: 4 },
    "H5P.Timer": { major: 0, minor: 4 },
    "H5P.FontIcons": { major: 1, minor: 0 },
    "H5P.MarkTheWords": { major: 1, minor: 11 },
    "H5P.DragText": { major: 1, minor: 10 },
    "jQuery.ui": { major: 1, minor: 10 },
	"H5P.Crossword": { major: 0, minor: 5 },
    "H5P.AdvancedText": { major: 1, minor: 1 },
	"H5P.SortParagraphs": { major: 0, minor: 11 },
	"H5P.Summary": { major: 1, minor: 10 },
	"H5P.Accordion": { major: 1, minor: 0 }
};

/**
 * Textes de localisation (l10n) pour H5P.QuestionSet
 * (Code de la ligne 857)
 */
export const L10N_QUESTION_SET = {
    "prevButton":"Question précédente",
    "nextButton":"Suivant",
    "finishButton":"Terminer",
    "textualProgress":"Question @current sur @total",
    "scoreBarLabel":"Votre score : @score sur @total",
    "showSolutionButton":"Voir la solution",
    "retryButton":"Recommencer"
};

/**
 * Textes de localisation (l10n) pour H5P.TrueFalse (utilisé en sous-contenu)
 * (Code de la ligne 858)
 */
export const L10N_TRUEFALSE_PARAMS = {
    "trueText": "Vrai",
    "falseText": "Faux",
    "checkAnswer": "Vérifier",
    "showSolutionButton": "Voir la solution",
    "tryAgain": "Recommencer"
};

/**
 * Textes de localisation (l10n) pour H5P.MarkTheWords
 * (Code de la ligne 865)
 */
export const L10N_MARKTHEWORDS = {
    "checkAnswerButton":"Vérifier",
    "tryAgainButton":"Recommencer",
    "showSolutionButton":"Solution",
    "score":"Vous avez @score sur @total points."
};

/**
 * Textes de localisation (l10n) pour H5P.DragText
 * (Code de la ligne 866)
 */
export const L10N_DRAGTEXT = {
    "checkAnswer": "Vérifier", "tryAgain": "Recommencer", "showSolution": "Voir la correction",
    "correctText": "Correct !", "incorrectText": "Incorrect !", "scoreBarLabel": "Vous avez obtenu :num sur :total points",
    "dropZoneIndex": "Zone de dépôt @index.", "emptyDropZone": "Zone de dépôt @index vide.",
    "contains": "La zone de dépôt @index contient le texte @text.", "ariaDraggable": "Élément déplaçable : @text.",
    "ariaCorrect": "Réponses correctes.", "ariaIncorrect": "Réponses incorrectes.",
    "resetDropTitle": "Réinitialiser l'élément", "resetDropDescription": "Êtes-vous sûr de vouloir réinitialiser cet élément ?",
    "resetDropConfirm": "Confirmer", "resetDropCancel": "Annuler"
};

/**
 * Textes de localisation (l10n) pour H5P.MultiChoice (utilisé en sous-contenu)
 * (Code de la ligne 873)
 */
export const L10N_MULTICHOICE_PARAMS = {
    "UI":{
        "checkAnswerButton":"Vérifier",
        "showSolutionButton":"Voir la solution",
        "tryAgainButton":"Essayer à nouveau",
        "tipsLabel":"Afficher l'indice",
        "scoreBarLabel":"Vous avez obtenu :num points sur :total",
        "tipAvailable":"Indice disponible",
        "feedbackAvailable":"Feedback disponible",
        "readFeedback":"Lire le feedback",
        "wrongAnswer":"Mauvaise réponse",
        "correctAnswer":"Bonne réponse",
        "noInput":"Tu dois répondre d'abord !",
        "submitAnswerButton":"Valider"
    },
    "confirmCheck":{
        "header":"Terminer ?",
        "body":"<p>Es-tu certain de vouloir terminer ?</p>",
        "cancelLabel":"Annuler",
        "confirmLabel":"Terminer"
    },
    "confirmRetry":{
        "header":"Recommencer ?",
        "body":"<p>Es-tu sûr(e) de vouloir recommencer ?</p>",
        "cancelLabel":"Annuler",
        "confirmLabel":"Confirmer"
    }
};

/**
 * Textes de localisation (l10n) pour H5P.Dictation
 * (Code de la ligne 874)
 */
export const L10N_DICTATION = {
    "checkAnswer":"Vérifier",
    "tryAgain":"Recommencer",
    "showSolution":"Voir la réponse",
    "audioNotSupported":"Votre navigateur ne prend pas en charge cet audio.",
    "generalFeedback":"Tu as commis @total erreur(s).",
    "zeroMistakesMode":"Vous avez écrit @total mot(s) correctement et @typo mot(s) avec des erreurs mineures."
};

/**
 * Textes de localisation (l10n) pour H5P.FindTheWords (Mots Mêlés)
 * (Code de la ligne 875)
 */
export const L10N_WORDSEARCH = {
    "check":"Vérifier",
    "tryAgain":"Recommencer",
    "showSolution":"Voir la solution",
    "found":"@found sur @totalWords trouvés",
    "timeSpent":"Temps écoulé",
    "score":"Tu as obtenu @score sur @total points",
    "wordListHeader":"Mots à trouver"
};

export const L10N_CROSSWORD = {
    "across": "Horizontalement",
    "down": "Verticalement",
    "checkAnswer": "Vérifier",
    "tryAgain": "Recommencer",
    "showSolution": "Voir la solution",
    "couldNotGenerateCrossword": "Impossible de générer les mots croisés avec les mots donnés.",
    "couldNotGenerateCrosswordTooFewWords": "Impossible de générer les mots croisés. Il faut au moins deux mots.",
    "probematicWords": "Mot(s) problématique(s): @words",
    "extraClue": "Indice supplémentaire",
    "closeWindow": "Fermer",
    "submitAnswer": "Valider",
    // ... (Tu peux copier le reste de la section "a11y" de ton content.json)
};

// ✅✅✅ CORRECTION ICI ✅✅✅
// J'ai traduit les valeurs de l'anglais au français
export const L10N_SORTPARAGRAPHS = {
    "checkAnswer": "Vérifier",
    "tryAgain": "Recommencer",
    "showSolution": "Voir la solution",
    "up": "Monter",
    "down": "Descendre",
    "disabled": "Désactivé"
};

// --- Constantes d'Accessibilité (a11y) ---

export const A11Y_SORTPARAGRAPHS = {
    "check": "Vérifiez les réponses. Les réponses seront marquées comme correctes ou incorrectes.",
    "showSolution": "Voir la solution. La solution correcte sera affichée.",
    "retry": "Recommencez l'exercice. Réinitialisez toutes les réponses et recommencez.",
    "yourResult": "Vous avez obtenu @score sur @total points",
    "paragraph": "Paragraphe",
    "correct": "correct",
    "wrong": "incorrect",
    "point": "@score point",
    "sevenOfNine": "@current sur @total",
    "currentPosition": "Position actuelle dans la liste",
    "instructionsSelected": "Appuyez sur Espace pour réorganiser",
    "instructionsGrabbed": "Appuyez sur les flèches haut et bas pour changer de position, Espace pour déposer, Echap pour annuler",
    "grabbed": "Attrapé",
    "moved": "Déplacé",
    "dropped": "Déposé",
    "reorderCancelled": "Réorganisation annulée",
    "finalPosition": "Position finale",
    "nextParagraph": "Paragraphe suivant",
    "correctParagraph": "Paragraphe correct à la position",
    "listDescription": "Liste de paragraphes à trier.",
    "listDescriptionCheckAnswer": "Liste de paragraphes avec résultats.",
    "listDescriptionShowSolution": "Liste de paragraphes avec solutions."
};

export const L10N_SUMMARY = {
    "solvedLabel": "Progression :",
    "scoreLabel": "Mauvaises réponses :",
    "resultLabel": "Votre résultat",
    "overallFeedback": [ // Feedback par défaut
        {"from": 0, "to": 100, "feedback": "Vous avez @score sur @total affirmations correctes (@percent %)."}
    ],
    "labelCorrect": "Correct.",
    "labelIncorrect": "Incorrect ! Veuillez réessayer.",
    "labelCorrectAnswers": "Réponses correctes.",
    "tipButtonLabel": "Afficher l'indice",
    "scoreBarLabel": "Vous avez :num sur :total points", // Standard
    "progressText": "Progression :num sur :total",
    "alternativeIncorrectLabel": "Incorrect"
};