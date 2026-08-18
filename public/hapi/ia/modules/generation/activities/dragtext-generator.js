// Fichier : modules/generation/activities/dragtext-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization, getFullLibraryString } from '../generator-utils.js';

export async function genererH5PDragText(donnees) {
        logger.log(`🏷️ Génération 'Étiquettes à déplacer' pour "${donnees.titre}"...`);
        const zip = new JSZip();
        const fileOptions = { createFolders: false };
		const langCode = getH5PLangCode();
		const h5pJson = {
		"title": donnees.titre || "Activité HAPI",
		"language": langCode,
		"defaultLanguage": langCode,
        "mainLibrary": "H5P.DragText", 
            "embedTypes": ["div"], "license": "U",
            "preloadedDependencies": [
                getDependencyObject("H5P.JoubelUI"), getDependencyObject("H5P.Question"),
                getDependencyObject("H5P.DragText"),
                getDependencyObject("FontAwesome"), getDependencyObject("jQuery.ui"), 
                getDependencyObject("H5P.Transition"), getDependencyObject("H5P.FontIcons")
            ] 
        };

        const contentJson = { 
            "textField": donnees.texte, 
            "taskDescription": donnees.consignes, 
            "behaviour": {
                "enableRetry": donnees.comportement.enableRetry,
                "enableSolutionsButton": donnees.comportement.enableSolutionsButton,
                "instantFeedback": donnees.comportement.instantFeedback,
                "enableCheckButton": true // 🟢 FIX : On force l'affichage du bouton Vérifier
            }, 
            "overallFeedback": donnees.overallFeedback,
            ...(donnees.l10n || {}), // Injection directe des traductions à la racine
            "override": { 
                "libraries": { 
                    [getFullLibraryString("H5P.JoubelUI")]: { 
                        "l10n": { "confirmLabel": "Confirmer", "cancelLabel": "Annuler" } 
                    } 
                } 
            }
        };
    
        zip.file("h5p.json", JSON.stringify(h5pJson, null, 2), fileOptions);
        zip.file("content/content.json", JSON.stringify(contentJson, null, 2), fileOptions);
    
        const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
        return { blob, fileName: `h5p-etiquettes-${Date.now()}.h5p` };
    }