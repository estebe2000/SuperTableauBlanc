// Fichier : modules/generation/activities/markthewords-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization } from '../generator-utils.js';
import { L10N_MARKTHEWORDS } from '../../utils/h5p-constants.js';

export async function genererH5PMarkTheWords(donnees) { 
        logger.log(`🖋️ Génération 'Repérer les mots' pour "${donnees.titre}"...`); 
        const zip = new JSZip(); 
        const fileOptions = { createFolders: false };
		const langCode = getH5PLangCode();
		const h5pJson = {
		"title": donnees.titre || "Activité HAPI",
		"language": langCode,
		"defaultLanguage": langCode,
        "mainLibrary":"H5P.MarkTheWords", 
            "embedTypes":["div"], "license":"U",
            "preloadedDependencies":[
                getDependencyObject("H5P.JoubelUI"), getDependencyObject("H5P.Question"),
				getDependencyObject("H5P.MarkTheWords"), getDependencyObject("FontAwesome"),
                getDependencyObject("H5P.Transition"), getDependencyObject("H5P.FontIcons")
            ]
        }; 
        
        const contentJson = { 
            "media": { "disableImageZooming": false }, 
            "textField": donnees.texte, 
            "overallFeedback": donnees.overallFeedback,
			"behaviour": { 
                "enableRetry": donnees.comportement.enableRetry, 
                "enableSolutionsButton": donnees.comportement.enableSolutionsButton, 
                "enableCheckButton": true, 
                "showScorePoints": true 
            }, 
            "taskDescription": donnees.consignes, 
            ...(donnees.l10n || L10N_MARKTHEWORDS || {})
        };
    
        zip.file("h5p.json", JSON.stringify(h5pJson, null, 2), fileOptions); 
        zip.file("content/content.json", JSON.stringify(contentJson, null, 2), fileOptions); 
    
        const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
        return { blob, fileName: `h5p-reperer-mots-${Date.now()}.h5p` };
    }
