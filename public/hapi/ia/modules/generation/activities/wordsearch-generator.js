// Fichier : modules/generation/activities/quiz-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization } from '../generator-utils.js';
import { L10N_WORDSEARCH } from '../../utils/h5p-constants.js';

export async function genererH5PWordSearch(donnees) {
    logger.log(`🔎 Génération Mots Mêlés pour "${donnees.titre}"...`);
    const zip = new JSZip(); 
    const fileOptions = { createFolders: false };

	const langCode = getH5PLangCode();
	const h5pJson = {
	"title": donnees.titre || "Activité HAPI",
	"language": langCode,
	"defaultLanguage": langCode,
    "mainLibrary": "H5P.FindTheWords",
        "embedTypes": ["div"], "license": "U",
        "preloadedDependencies": [
            getDependencyObject("H5P.Timer"), getDependencyObject("H5P.JoubelUI"), 
			getDependencyObject("H5P.FindTheWords"), getDependencyObject("FontAwesome"),
            getDependencyObject("H5P.Transition"), getDependencyObject("H5P.FontIcons")
        ]
    }; 

    const contentJson = { 
        "wordList": donnees.mots || '',
        "taskDescription": donnees.consignes,
        "behaviour": { 
            ...donnees.comportement, 
            "fillPool": donnees.comportement.fillPool || "ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÄÆÇÉÈÊËÎÏÔŒÙÛÜŸ" 
        },
        "l10n": donnees.l10n || L10N_WORDSEARCH 
    }; 

    zip.file("h5p.json", JSON.stringify(h5pJson, null, 2), fileOptions); 
    zip.file("content/content.json", JSON.stringify(contentJson, null, 2), fileOptions); 

    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    return { blob, fileName: `h5p-mots-meles-${Date.now()}.h5p` };
}