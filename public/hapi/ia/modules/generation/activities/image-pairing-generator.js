// Fichier : modules/generation/activities/image-pairing-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization } from '../generator-utils.js';

// UTILS IMAGES
export async function textToImageBlob(text) {
    return new Promise((resolve) => {
        const size = 500; const padding = 40;
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
        canvas.width = size; canvas.height = size;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size);
        ctx.lineWidth = 10; ctx.strokeStyle = "#e0e0e0"; ctx.strokeRect(0, 0, size, size);
        ctx.fillStyle = "#333333"; ctx.textAlign = "center"; ctx.textBaseline = "middle";

        const getLines = (ctx, text, maxWidth) => {
            const words = text.split(" "); const lines = []; let currentLine = words[0];
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                if (ctx.measureText(currentLine + " " + word).width < maxWidth) { currentLine += " " + word; } 
                else { lines.push(currentLine); currentLine = word; }
            }
            lines.push(currentLine); return lines;
        };

        let fontSize = 60; let lines = [];
        const maxWidth = size - (padding * 2); const maxHeight = size - (padding * 2);
        let lineHeight = 0; let totalHeight = 0;

        do {
            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            lineHeight = fontSize * 1.2;
            lines = getLines(ctx, text, maxWidth);
            totalHeight = lines.length * lineHeight;
            if (totalHeight > maxHeight || lines.some(line => ctx.measureText(line).width > maxWidth)) { fontSize -= 2; } 
            else { break; }
        } while (fontSize > 20);

        const startY = (size - totalHeight) / 2 + (lineHeight / 2);
        lines.forEach((line, index) => { ctx.fillText(line, size / 2, startY + (index * lineHeight) - (lineHeight / 2)); });
        canvas.toBlob((blob) => { resolve(blob); }, 'image/png');
    });
}


/**
 * IMAGE PAIRING (Version CSV Sync)
 */
export async function genererH5PImagePairing(donnees) {
    console.log('🖼️  DÉBUT GÉNÉRATION IMAGE PAIRING (CSV MODE)');
    const zip = new JSZip();

    // ✅ CORRECTION MAJEURE ICI : UTILISATION STRICTE DE getDependencyObject
    // Utilisation du CSV pour TOUTES les dépendances
	const langCode = getH5PLangCode();
	const h5pJson = {
	"title": donnees.titre || "Activité HAPI",
	"language": langCode,
	"defaultLanguage": langCode,
        "mainLibrary": "H5P.ImagePair",
        "embedTypes": ["iframe"],
        "license": "U",
        "preloadedDependencies": [
            getDependencyObject("jQuery.ui"),
			getDependencyObject("H5P.JoubelUI"),
            getDependencyObject("H5P.Image"),
            getDependencyObject("H5P.ImagePair"),
            getDependencyObject("H5P.Transition"),
            getDependencyObject("H5P.FontIcons"),
            getDependencyObject("FontAwesome"),
            getDependencyObject("H5P.Question")
        ]
    };

    const defaultL10n = {
        "checkAnswer": "Vérifier",
        "tryAgain": "Réessayer",
        "showSolution": "Voir la solution",
        "score": "Vous avez obtenu @score sur @total points"
    };
    const finalL10n = Object.assign({}, defaultL10n, donnees.l10n || {});
    const cards = [];

    const processSource = async (sourceData, index, prefix) => {
        const safeId = Math.random().toString(36).substring(2, 7);
        let blob = null; let mime = 'image/jpeg'; let ext = 'jpg';

        try {
            if (sourceData.type === 'text') {
                blob = await textToImageBlob(sourceData.content || "Sans texte");
                mime = 'image/png'; ext = 'png';
            } 
            else if (sourceData.type === 'upload' && sourceData.file instanceof File) {
                blob = sourceData.file; mime = blob.type || 'image/jpeg';
                if (blob.name && blob.name.toLowerCase().endsWith('png')) ext = 'png';
            } 
            else if (sourceData.src) {
                const response = await fetch(sourceData.src);
                blob = await response.blob();
                mime = blob.type; 
                if (mime.includes('png')) ext = 'png';
            } else {
                blob = await textToImageBlob("?"); mime = 'image/png'; ext = 'png';
            }

            if (!blob || blob.size === 0) throw new Error("Blob vide");
            const cleanFileName = `img_${prefix}_${index}_${safeId}.${ext}`.replace(/[^a-zA-Z0-9._-]/g, '_');
            const arrayBuffer = await blob.arrayBuffer();
            zip.file(`content/images/${cleanFileName}`, arrayBuffer, { binary: true });

            return {
                "path": `images/${cleanFileName}`, "mime": mime,
                "copyright": { "license": "U" }, "width": 400, "height": 400
            };
        } catch (e) {
            console.error('❌ ERREUR processSource:', e);
            return null;
        }
    };

    for (let i = 0; i < donnees.pairs.length; i++) {
        const pair = donnees.pairs[i];
        const imgLeft = await processSource(pair.left, i, 'L');
        const imgRight = await processSource(pair.right, i, 'R');
        if (imgLeft && imgRight) { cards.push({ "image": imgLeft, "match": imgRight }); }
    }

    const contentJson = {
        "taskDescription": donnees.consignes || "Associez les images correspondantes.",
        "cards": cards,
        "behaviour": { "allowRetry": true, "enableSolutionsButton": true, "enableRetry": true },
        "l10n": finalL10n
    };

    zip.file("h5p.json", JSON.stringify(h5pJson, null, 2));
    zip.file("content/content.json", JSON.stringify(contentJson, null, 2));

    Object.keys(zip.files).forEach(filename => {
        if (zip.files[filename].dir === true) delete zip.files[filename];
    });

    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    return { blob, fileName: `h5p-image-pairing-${Date.now()}.h5p` };
}