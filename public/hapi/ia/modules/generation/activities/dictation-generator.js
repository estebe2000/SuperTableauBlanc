// Fichier : modules/generation/activities/dictation-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization } from '../generator-utils.js';
import { L10N_DICTATION } from '../../utils/h5p-constants.js';

export async function genererH5PDictation(donnees) {
    logger.log(`📝 Génération Dictée pour "${donnees.titre}"...`);
    const zip = new JSZip();
    const fileOptions = { createFolders: false };

	const langCode = getH5PLangCode();
	const h5pJson = {
	"title": donnees.titre || "Activité HAPI",
	"language": langCode,
	"defaultLanguage": langCode,
    "mainLibrary": "H5P.Dictation",
    "embedTypes": ["div"], "license": "U",
    "preloadedDependencies": [
            getDependencyObject("H5P.JoubelUI"), getDependencyObject("H5P.Question"),
            getDependencyObject("H5P.Dictation"), getDependencyObject("H5P.Audio"),
            getDependencyObject("H5P.TextUtilities"), getDependencyObject("H5P.Transition"),
            getDependencyObject("FontAwesome"), getDependencyObject("H5P.FontIcons")
        ]
    };

    /**
     * Helper interne pour traiter un fichier audio et l'ajouter au ZIP
     * @param {File} file - Le fichier audio
     * @param {string} id - L'ID de la phrase
     * @param {string} suffix - "normal" ou "slow" pour différencier les noms de fichiers
     */
    const processAudioFile = async (file, id, suffix) => {
        if (!file) return null;

        // 1. Gestion stricte de l'extension
        let extension = "webm"; 
        if (file.name.endsWith('.wav') || file.type.includes('wav')) extension = "wav";
        else if (file.name.endsWith('.mp3') || file.type.includes('mpeg') || file.type.includes('mp3')) extension = "mp3";

        // 2. Nettoyage du nom
        const safeName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, '_');
        // On ajoute le suffixe (ex: _slow) pour éviter d'écraser le fichier normal
        const cleanFileName = `audio_${id}_${suffix}_${safeName}.${extension}`;

        // 3. Détection MIME TYPE
        let mimeType = file.type;
        if (!mimeType) {
             if (extension === 'wav') mimeType = 'audio/wav';
             else if (extension === 'mp3') mimeType = 'audio/mpeg';
             else mimeType = 'audio/webm';
        }

        // 4. Ajout au ZIP
        zip.file(`content/audios/${cleanFileName}`, await file.arrayBuffer(), { binary: true, createFolders: false });

        // 5. Retourne l'objet pour le JSON H5P
        return {
            "path": `audios/${cleanFileName}`,
            "mime": mimeType,
            "copyright": { "license": "U" }
        };
    };

    const statementsForJson = [];

    // Boucle sur toutes les phrases
    for (const [id, sentenceData] of Object.entries(donnees.sentences)) {
        // On récupère text, file (normal) ET fileSlow (lent)
        const { text, file, fileSlow } = sentenceData;

        if (text && file) {
            // A. Traitement Audio Normal (Obligatoire)
            const audioEntry = await processAudioFile(file, id, "normal");
        
            // B. Traitement Audio Lent (Optionnel)
            let audioSlowEntry = null;
            if (fileSlow) {
                audioSlowEntry = await processAudioFile(fileSlow, id, "slow");
            }

            // Construction de l'objet phrase pour H5P
            const statementObj = {
                "text": text,
                "sample": [ audioEntry ] // Version normale
            };

            // Ajout de la version lente si elle existe (C'est ICI que ça se joue)
            if (audioSlowEntry) {
                statementObj.sampleAlternative = [ audioSlowEntry ];
            }

            statementsForJson.push(statementObj);
        }
    }

    const contentJson = { 
        "taskDescription": donnees.consignes, 
        "media": { "disableImageZooming": false }, 
        "sentences": statementsForJson,
        "behaviour": { 
            "scoring": { "ignorePunctuation": true, "zeroMistakeMode": false, "typoFactor": "100" }, 
            "enableRetry": true, "enableSolutionsButton": true 
        },
        "overallFeedback": donnees.overallFeedback,
        "l10n": Object.assign({}, L10N_DICTATION || {}, donnees.l10n || {})
    };

    zip.file("h5p.json", JSON.stringify(h5pJson, null, 2), fileOptions);
    zip.file("content/content.json", JSON.stringify(contentJson, null, 2), fileOptions);

    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    return { blob, fileName: `h5p-dictee-${Date.now()}.h5p` };
}
