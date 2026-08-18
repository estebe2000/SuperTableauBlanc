// Fichier : modules/generation/activities/accordion-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization } from '../generator-utils.js';

export async function genererH5PAccordion(donnees) {
    logger.log(`📑 Génération 'Accordion' pour "${donnees.titre}"...`); 
    const zip = new JSZip(); const fileOptions = { createFolders: false };
	const langCode = getH5PLangCode();
	const h5pJson = {
	"title": donnees.titre || "Activité HAPI",
	"language": langCode,
	"defaultLanguage": langCode,
    "mainLibrary": "H5P.Accordion", 
        "embedTypes": ["iframe"], "license": "U",
        "preloadedDependencies":[
            getDependencyObject("H5P.JoubelUI"),
			getDependencyObject("H5P.Accordion"), getDependencyObject("H5P.AdvancedText"),
            getDependencyObject("H5P.FontIcons"),
            getDependencyObject("FontAwesome")
        ]
    }; 
    const contentJson = { "panels": donnees.panels, "hTag": donnees.hTag }; 
    zip.file("h5p.json", JSON.stringify(h5pJson, null, 2), fileOptions); 
    zip.file("content/content.json", JSON.stringify(contentJson, null, 2), fileOptions); 
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    return { blob, fileName: `h5p-glossaire-accordion-${Date.now()}.h5p` };
}