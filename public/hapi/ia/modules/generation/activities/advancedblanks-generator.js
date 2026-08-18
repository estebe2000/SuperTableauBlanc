// Fichier : modules/generation/activities/advancedblanks-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization } from '../generator-utils.js';


// 1. La fonction d'aide reste "locale" à ce fichier
function buildBlanksText(rawText, blanks) {
    let i = 0;
    return rawText.replace(/_{3,}/g, () => {
        const mot = blanks[i] ? blanks[i].correctAnswerText : '___';
        i++;
        return `*${mot}*`;
    });
}


export async function genererH5PAdvancedBlanks(donnees) {
	    logger.log(`🎯 Génération Advanced Blanks pour "${donnees.titre}"...`);
	    const zip = new JSZip();
	    const fileOptions = { createFolders: false };
    
		const langCode = getH5PLangCode();
		const h5pJson = {
		"title": donnees.titre || "Activité HAPI",
		"language": langCode,
		"defaultLanguage": langCode,
	        "mainLibrary": "H5P.AdvancedBlanks",
	        "embedTypes": ["iframe"],
	        "license": "U",
	        "preloadedDependencies": [
	            getDependencyObject("H5P.AdvancedBlanks"),
	            getDependencyObject("FontAwesome"),
	            getDependencyObject("H5P.JoubelUI"),
	            getDependencyObject("H5P.FontIcons"),
	            getDependencyObject("H5P.Transition"),
	            getDependencyObject("H5P.Question") // Attention : vérifie que ton gestionnaire renvoie bien la version 1.4 de H5P.Question si c'est ce que ton serveur exige
	        ]
	    };

	    // SÉCURITÉ : On s'assure que le pourcentage ne crée pas de plage négative

	    const contentJson = {
	        "content": {
	            "task": `<p>${donnees.consignes}</p>\n`,
	            "blanksList": donnees.blanks,
	            "blanksText": `<p>${donnees.texteHtml.replace(/\n/g, '<br/>')}</p>\n`
	        },
	        "overallFeedback": donnees.overallFeedback,
			"behaviour": {
				            "mode": (donnees.comportement.mode === "selection") ? "selection" : "typing",
				            "spellingErrorBehaviour": ["mistake", "warn", "accept"].includes(donnees.comportement.spellingErrorBehaviour) 
				                                      ? donnees.comportement.spellingErrorBehaviour 
				                                      : "mistake",
				            "caseSensitive": donnees.comportement.caseSensitive,
				            "autoCheck": donnees.comportement.autoCheck,
				            "enableCheckButton": donnees.comportement.enableCheckButton,
				            "confirmCheckDialog": donnees.comportement.confirmCheckDialog,
				            "enableSolutionsButton": donnees.comportement.enableSolutionsButton,
				            "showSolutionsRequiresInput": donnees.comportement.showSolutionsRequiresInput,
				            "enableRetry": donnees.comportement.enableRetry,
				            "confirmRetryDialog": donnees.comportement.confirmRetryDialog,
				            "selectAlternatives": "alternatives"
				        },
	        "checkAnswer": "Vérifier",
	        "tryAgain": "Réessayer",
	        "showSolutions": "Afficher la solution",
	        "notFilledOut": "Veuillez remplir tous les trous",
	        "tipLabel": "Indice",
	        "spellingMistakeWarning": "Vérifiez votre orthographe : @mistake",
	        "confirmCheck": {
	            "header": "Terminer ?",
	            "body": "Êtes-vous sûr de vouloir vérifier vos réponses ?",
	            "cancelLabel": "Annuler",
	            "confirmLabel": "Terminer"
	        },
	        "confirmRetry": {
	            "header": "Recommencer ?",
	            "body": "Êtes-vous sûr de vouloir recommencer ?",
	            "cancelLabel": "Annuler",
	            "confirmLabel": "Confirmer"
	        },
	        "scoreBarLabel": "Vous avez obtenu :num sur :total points", // ✅ FIX : Variables H5P originelles
            "submitAnswer": "Submit", // ✅ FIX : Clé manquante
            "media": { // ✅ FIX : Objet media obligatoire
                "disableImageZooming": false
            }
	    };

	    zip.file("h5p.json", JSON.stringify(h5pJson, null, 2), fileOptions);
	    zip.file("content/content.json", JSON.stringify(contentJson, null, 2), fileOptions);

	    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
	    return { blob, fileName: `h5p-advanced-blanks-${Date.now()}.h5p` };
	}