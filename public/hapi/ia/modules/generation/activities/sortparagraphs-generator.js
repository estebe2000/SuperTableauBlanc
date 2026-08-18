// Fichier : modules/generation/activities/sortparagrpahs-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization } from '../generator-utils.js';
import { L10N_SORTPARAGRAPHS } from '../../utils/h5p-constants.js';

export async function genererH5PSortParagraphs(donnees) {
    logger.log(`↕️ Génération 'Trier les Paragraphes' pour "${donnees.titre}"...`); 
    const zip = new JSZip(); const fileOptions = { createFolders: false };
	const langCode = getH5PLangCode();
	const h5pJson = {
	"title": donnees.titre || "Activité HAPI",
	"language": langCode,
	"defaultLanguage": langCode,
    "mainLibrary": "H5P.SortParagraphs", 
        "embedTypes": ["iframe"], "license": "U",
        "preloadedDependencies":[
            getDependencyObject("H5P.JoubelUI"), getDependencyObject("H5P.Question"), 
			getDependencyObject("H5P.SortParagraphs"),
            getDependencyObject("H5P.FontIcons"), getDependencyObject("H5P.AdvancedText"),
            getDependencyObject("H5P.TextUtilities"), getDependencyObject("FontAwesome")
            
        ]
    }; 
    const contentJson = {
        "taskDescription": donnees.consignes,
        "paragraphs": donnees.paragraphs,
        "behaviour": { "enableRetry": true, "enableSolutionsButton": true },
        "overallFeedback": donnees.overallFeedback,
        "l10n": Object.assign({}, L10N_SORTPARAGRAPHS || {}, donnees.l10n || {})
    };
    zip.file("h5p.json", JSON.stringify(h5pJson, null, 2), fileOptions); 
    zip.file("content/content.json", JSON.stringify(contentJson, null, 2), fileOptions); 
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    return { blob, fileName: `h5p-trier-paragraphes-${Date.now()}.h5p` };
}