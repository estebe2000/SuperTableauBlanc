// Fichier : modules/generation/activities/summary-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization } from '../generator-utils.js';
import { L10N_SUMMARY } from '../../utils/h5p-constants.js';

export async function genererH5PSummary(donnees) {
    logger.log(`📝 Génération 'Summary' pour "${donnees.titre}"...`); 
    const zip = new JSZip(); const fileOptions = { createFolders: false };
	const langCode = getH5PLangCode();
	const h5pJson = {
	"title": donnees.titre || "Activité HAPI",
	"language": langCode,
	"defaultLanguage": langCode,
    "mainLibrary": "H5P.Summary", 
        "embedTypes": ["iframe"], "license": "U",
        "preloadedDependencies":[
            getDependencyObject("H5P.JoubelUI"), getDependencyObject("H5P.Question"),
			getDependencyObject("H5P.Summary"), getDependencyObject("H5P.FontIcons"), 
			getDependencyObject("FontAwesome")
            
        ]
    }; 
    const contentJson = { 
        "intro": donnees.consignes,
        "summaries": donnees.summaries,
        "overallFeedback": donnees.overallFeedback,
        "solvedLabel": "Progrès :",
        "scoreLabel": "Score :",
        "resultLabel": "Résultat",
        ...(donnees.l10n || L10N_SUMMARY || {})
    };
    zip.file("h5p.json", JSON.stringify(h5pJson, null, 2), fileOptions); 
    zip.file("content/content.json", JSON.stringify(contentJson, null, 2), fileOptions); 
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    return { blob, fileName: `h5p-summary-${Date.now()}.h5p` };
}