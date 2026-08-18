// Fichier : modules/generation/activities/crossswords-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization } from '../generator-utils.js';
import { L10N_CROSSWORD } from '../../utils/h5p-constants.js';

export async function genererH5PCrossword(donnees) {
    logger.log(`🔠 Génération 'Mots Croisés' pour "${donnees.titre}"...`); 
    const zip = new JSZip(); const fileOptions = { createFolders: false };
	const langCode = getH5PLangCode();
	const h5pJson = {
	"title": donnees.titre || "Activité HAPI",
	"language": langCode,
	"defaultLanguage": langCode,
    "mainLibrary": "H5P.Crossword", 
        "embedTypes": ["iframe"], "license": "U",
        "preloadedDependencies":[
            getDependencyObject("H5P.JoubelUI"), getDependencyObject("H5P.Question"), 
			getDependencyObject("H5P.Crossword"),getDependencyObject("H5P.Image"),
            getDependencyObject("H5P.MaterialDesignIcons"), getDependencyObject("H5P.AdvancedText"),
            getDependencyObject("H5P.FontIcons"), getDependencyObject("FontAwesome")
        ]
    }; 
    const contentJson = {
        "taskDescription": donnees.consignes,
        "words": donnees.words,
        "overallFeedback": donnees.overallFeedback,
        "theme": {
             "backgroundColor": "#173354", "gridColor": "#000000", "cellBackgroundColor": "#ffffff", "cellColor": "#000000", "clueIdColor": "#606060", "cellBackgroundColorHighlight": "#3e8de8", "cellColorHighlight": "#ffffff", "clueIdColorHighlight": "#e0e0e0" 
        },
        "behaviour": {
            "enableRetry": true, "enableSolutionsButton": true, "enableInstantFeedback": false, "scoreWords": true
        },
        "l10n": Object.assign({}, L10N_CROSSWORD || {}, donnees.l10n || {})
    };
    zip.file("h5p.json", JSON.stringify(h5pJson, null, 2), fileOptions); 
    zip.file("content/content.json", JSON.stringify(contentJson, null, 2), fileOptions); 
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    return { blob, fileName: `h5p-mots-croises-${Date.now()}.h5p` };
}