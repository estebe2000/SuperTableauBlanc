// Fichier : modules/generation/activities/quiz-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization } from '../generator-utils.js';

export async function genererH5PQuiz(donnees) {
        logger.log(`🔎 Génération Quiz (Question Set) pour "${donnees.titre}"...`);
        const zip = new JSZip(); 
        const fileOptions = { createFolders: false };
    
		const langCode = getH5PLangCode();
		const h5pJson = {
		"title": donnees.titre || "Activité HAPI",
		"language": langCode,
		"defaultLanguage": langCode,
            "mainLibrary": "H5P.QuestionSet",
            "embedTypes": ["iframe"], 
            "license": "U", 
            "preloadedDependencies": [
                getDependencyObject("H5P.JoubelUI"),
                getDependencyObject("H5P.QuestionSet"),
                getDependencyObject("H5P.Question"),
                getDependencyObject("H5P.MultiChoice"),
                getDependencyObject("H5P.TrueFalse"),
                getDependencyObject("H5P.FontIcons"),
                getDependencyObject("FontAwesome"),
                getDependencyObject("H5P.Transition")      
            ]
        }; 

        const langueCible = donnees.langue || 'Français';
        const qsTranslations = getH5PLocalization(langueCible, 'QuestionSet');

        // --- 1. PRÉPARATION DE L'OBJET OVERRIDE ---
        // On initialise toujours avec checkButton qui est un booléen
        const overrideSettings = {
            "checkButton": donnees.showCheckButton
        };
    
        // H5P attend explicitement les chaînes "on" ou "off" pour ces propriétés.
        // Si la valeur est "default", on n'ajoute pas la propriété pour laisser
        // la configuration individuelle de chaque question prendre le dessus.
        if (donnees.overrideSolution !== 'default') {
            overrideSettings.showSolutionButton = donnees.overrideSolution;
        }
        if (donnees.overrideRetry !== 'default') {
            overrideSettings.retryButton = donnees.overrideRetry;
        }

        // --- 2. CONSTRUCTION DU FICHIER CONTENT.JSON ---
        const contentJson = {
            "introPage": {
                "showIntroPage": false,
                "startButtonText": "Commencer",
                "title": donnees.titre
            },
            "progressType": "textual",
            "passPercentage": parseInt(donnees.passPercentage) || 50,
            "questions": donnees.questions,
            "disableBackwardsNavigation": donnees.disableBackwardsNavigation,
            "randomQuestions": donnees.randomQuestions, 
            "endGame": {
                "showResultPage": true,
                "showSolutionButton": true,
                "showRetryButton": true,
                "message": qsTranslations.yourResult,
                "noResultMessage": qsTranslations.noResultMessage,
                "scoreMessage": "Score : @score / @total",
                "successMessage": "Bravo !",
                "failMessage": "Dommage.",
                "solutionButtonLabel": qsTranslations.solutionButtonLabel,
                "retryButtonLabel": qsTranslations.retryButtonLabel,
                "finishButtonLabel": qsTranslations.finishButtonLabel,
                "solutionButtonText": qsTranslations.solutionButtonText,
                "retryButtonText": qsTranslations.retryButtonText,
                "finishButtonText": qsTranslations.finishButtonText,
                "submitButtonText": qsTranslations.submitButtonText
            },
        
            // On injecte notre objet dynamique ici au lieu du "override": { "checkButton": true } écrit en dur
            "override": overrideSettings,
        
            "texts": {
                "prevButtonLabel": qsTranslations.prevButtonLabel,
                "nextButtonLabel": qsTranslations.nextButtonLabel,
                "finishButtonLabel": qsTranslations.finishButtonLabel,
                "solutionButtonLabel": qsTranslations.solutionButtonLabel,
                "retryButtonLabel": qsTranslations.retryButtonLabel,
                "prevButton": qsTranslations.prevButton,
                "nextButton": qsTranslations.nextButton,
                "finishButton": qsTranslations.finishButton,
                "submitButton": qsTranslations.submitButton,
                "textualProgress": (qsTranslations.questionLabel || "Question") + " @current / @total"
            }
        };
    
        // --- 3. GÉNÉRATION DE L'ARCHIVE ---
        zip.file("h5p.json", JSON.stringify(h5pJson, null, 2), fileOptions); 
        zip.file("content/content.json", JSON.stringify(contentJson, null, 2), fileOptions); 
    
        const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
        return { blob, fileName: `h5p-quiz-${Date.now()}.h5p` };
    }