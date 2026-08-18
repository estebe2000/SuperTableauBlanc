// Fichier : modules/generation/activities/cards-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization } from '../generator-utils.js';

/**
     * CARDS (Flash/Dialog) - CORRIGÉ (Options Checkbox + CSV Strict)
     */
export async function genererH5PCards(donnees) {
	    logger.log(`🃏 Génération Cartes (Mode: ${donnees.mode}) pour "${donnees.titre}"...`);
	    const zip = new JSZip();
    
	    let h5pJson = {};
	    let contentJson = {};

	    const cleanText = (text) => {
	        if (!text) return "";
	        return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').trim();
	    };

	    const extractTips = (rawText, manualTip) => {
	        let text = rawText || "";
	        let tip = manualTip || "";
	        const tipMatch = text.match(/(?:\n|^)(?:Indice|Tip|IndiceAvant|IndiceArrière|IndiceArriere)\s*:\s*(.*)/i);
	        if (tipMatch) {
	            tip = tipMatch[1].trim();
	            text = text.replace(tipMatch[0], "").trim();
	        }
	        return { text: cleanText(text), tip: cleanText(tip) };
	    };

	    // --- CORRECTION MAJEURE ICI : GESTION ROBUSTE EXTENSIONS / MIME ---
	    const processMedia = async (file, type, index) => {
	        if (!file) return null;
        
	        // 1. Détection stricte de l'extension
	        let extension = "dat"; // Fallback
	        const lowerName = file.name.toLowerCase();
        
	        if (type === 'audio') {
	            if (lowerName.endsWith('.wav') || file.type.includes('wav')) extension = "wav";
	            else if (lowerName.endsWith('.mp3') || file.type.includes('mpeg')) extension = "mp3";
	            else extension = "webm";
	        } else {
	            // Images
	            if (lowerName.endsWith('.png')) extension = "png";
	            else if (lowerName.endsWith('.gif')) extension = "gif";
	            else extension = "jpg"; // Defaut image
	        }

	        const safeName = `${type}_${index}_${crypto.randomUUID ? crypto.randomUUID().substring(0,5) : Math.random().toString(36).substring(2,7)}.${extension}`;
	        const folder = type === 'audio' ? 'audios' : 'images';
        
	        // 2. Détection stricte du MimeType (Vital pour iOS)
	        let mime = file.type;
	        if (type === 'audio') {
	            if (extension === 'wav') mime = 'audio/wav'; // ou audio/x-wav
	            else if (extension === 'mp3') mime = 'audio/mpeg';
	            else mime = 'audio/webm';
	        } else if (!mime) {
	            mime = 'image/jpeg';
	        }

	        let width = null, height = null;

	        if (type === 'image') {
	            try {
	                const objectUrl = URL.createObjectURL(file);
	                const img = new Image();
	                img.src = objectUrl;
	                await new Promise((resolve) => {
	                    img.onload = () => { width = img.width; height = img.height; resolve(); };
	                    img.onerror = () => { resolve(); };
	                });
	                URL.revokeObjectURL(objectUrl);
	            } catch (e) { logger.warn("Erreur dim: " + e.message); }
	        }
        
	        try {
	            const arrayBuffer = await file.arrayBuffer();
	            zip.file(`content/${folder}/${safeName}`, arrayBuffer, { binary: true });
            
	            const mediaObject = { "path": `${folder}/${safeName}`, "mime": mime, "copyright": { "license": "U" } };
	            if (type === 'image' && width && height) { mediaObject.width = width; mediaObject.height = height; }
            
	            return [mediaObject];
	        } catch (e) { return null; }
	    };

	    // ==========================================
	    //  MODE FLASHCARDS
	    // ==========================================
	    if (donnees.mode === 'flash') {
			const langCode = getH5PLangCode();
			h5pJson = {
			"title": donnees.titre || "Activité HAPI",
			"language": langCode,
			"defaultLanguage": langCode,
	        "mainLibrary": "H5P.Flashcards", 
	            "embedTypes": ["iframe"], "license": "U",
	            "preloadedDependencies": [
	                getDependencyObject("H5P.JoubelUI"),
	                getDependencyObject("H5P.Flashcards"),
	                getDependencyObject("FontAwesome"),
	                getDependencyObject("H5P.FontIcons"),
	                getDependencyObject("H5P.Transition")   
	            ]
	        };

	        const cardsArray = [];
	        for (let i = 0; i < donnees.cards.length; i++) {
	            const c = donnees.cards[i];
	            let imageJson = null;
	            if (c.image) {
	                const res = await processMedia(c.image, 'image', i);
	                if (res) imageJson = res[0];
	            }
	            const frontData = extractTips(c.front, c.tips?.front);
	            const backData = extractTips(c.back, c.tips?.back);
	            const combinedTip = frontData.tip || backData.tip || "";

	            const cardItem = { "text": frontData.text, "answer": backData.text, "tip": combinedTip };
	            if (imageJson) { cardItem.image = imageJson; cardItem.imageAltText = "Image"; }
	            cardsArray.push(cardItem);
	        }

	        contentJson = {
	            "description": cleanText(donnees.consigne), 
	            "cards": cardsArray,
	            "progressText": donnees.l10n.progressText, 
	            "next": donnees.l10n.next,
	            "previous": donnees.l10n.previous, 
	            "checkAnswerText": donnees.l10n.checkAnswerText, 
	            "defaultAnswerText": donnees.l10n.defaultAnswerText,
	            "correctAnswerText": donnees.l10n.correctAnswerText,
	            "incorrectAnswerText": donnees.l10n.incorrectAnswerText,
	            "solutionLabel": donnees.l10n.solutionLabel,
	            "showSolutionText": donnees.l10n.showSolutionTitle,
	            "results": donnees.l10n.results,
	            "showResults": donnees.l10n.showResults,
	            "ofCorrect": donnees.l10n.ofCorrect,
	            "showSolutionsRequiresInput": true,             
	            "caseSensitive": donnees.options.caseSensitive, 
	            "randomCards": donnees.options.random,          
	            "l10n": { 
	                "tryAgain": donnees.l10n.tryAgainText, 
	                "showSolution": donnees.l10n.showSolutionButton
	            }
	        };
	    }
	    // ==========================================
	    //  MODE DIALOGCARDS
	    // ==========================================
	    else {
			const langCode = getH5PLangCode();
			h5pJson = {
			"title": donnees.titre || "Activité HAPI",
			"language": langCode,
			"defaultLanguage": langCode,
	        "mainLibrary": "H5P.Dialogcards",
	            "embedTypes": ["iframe"], "license": "U",
	            "preloadedDependencies": [
	                getDependencyObject("FontAwesome"),
	                getDependencyObject("H5P.JoubelUI"),
	                getDependencyObject("H5P.Transition"),
	                getDependencyObject("H5P.FontIcons"),
	                getDependencyObject("H5P.Audio"),
	                getDependencyObject("H5P.Dialogcards")
	            ]
	        };

	        const dialogsArray = [];
	        for (let i = 0; i < donnees.cards.length; i++) {
	            const c = donnees.cards[i];
	            let imageJson = null;
	            if (c.image) {
	                const res = await processMedia(c.image, 'image', i);
	                if (res) imageJson = res[0];
	            }
            
	            // Traitement Audio avec détection WAV
	            let audioJson = null;
	            if (c.audio) audioJson = await processMedia(c.audio, 'audio', i);

	            const frontData = extractTips(c.front, c.tips?.front);
	            const backData = extractTips(c.back, c.tips?.back);

	            const dialogItem = {
	                "text": frontData.text,
	                "answer": backData.text,
	                "tips": { "front": frontData.tip, "back": backData.tip }
	            };
	            if (imageJson) { dialogItem.image = imageJson; dialogItem.imageAltText = "Image"; }
	            if (audioJson) { dialogItem.audio = audioJson; }
	            dialogsArray.push(dialogItem);
	        }

	        contentJson = {
	            "title": donnees.titre, 
	            "description": cleanText(donnees.consigne), 
	            "dialogs": dialogsArray,
	            "behaviour": { 
	                "scaleTextNotCard": true,  
	                "enableRetry": true,       
	                "disableBackwardsNavigation": donnees.options.disableBack, 
	                "randomCards": donnees.options.random,                     
	                "mode": "normal", 
	                "maxProficiency": 5, 
	                "quickProgression": false 
	            },
	            "next": donnees.l10n.nextText, "prev": donnees.l10n.prevText, "retry": donnees.l10n.retryText,
	            "answer": donnees.l10n.turnCardText, "progressText": donnees.l10n.progressText,
	            "cardFrontLabel": donnees.l10n.cardFrontLabel, "cardBackLabel": donnees.l10n.cardBackLabel,
	            "confirmStartingOver": { "header": "Recommencer ?", "body": "Progression perdue.", "cancelLabel": "Annuler", "confirmLabel": "Oui" }
	        };
	    }

	    zip.file("h5p.json", JSON.stringify(h5pJson, null, 2));
	    zip.file("content/content.json", JSON.stringify(contentJson, null, 2));

	    Object.keys(zip.files).forEach(filename => {
	        if (zip.files[filename].dir === true) { delete zip.files[filename]; }
	    });

	    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
	    const safeTitle = donnees.titre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
	    return { blob, fileName: `${safeTitle}_${donnees.mode}.h5p` };
	}
	
	
	