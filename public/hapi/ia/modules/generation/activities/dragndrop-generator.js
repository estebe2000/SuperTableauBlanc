// Fichier : modules/generation/activities/dragndrop-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization, generateUUID } from '../generator-utils.js';

// ==========================================
    // CATÉGORISATION (H5P.DragQuestion) - MULTIMÉDIA & RATIO IMAGES PROPORTIONNEL
    // ==========================================

export  async function genererH5PDragQuestion(donnees) {
        logger.log(`🧩 Génération H5P DragQuestion (Mode: ${donnees.layoutMode})...`);
        const zip = new JSZip();
        const fileOptions = { createFolders: false };

		const langCode = getH5PLangCode();
		const h5pJson = {
		"title": donnees.titre || "Activité HAPI",
		"language": langCode,
		"defaultLanguage": langCode,
            "mainLibrary": "H5P.DragQuestion",
            "embedTypes": ["iframe"],
            "license": "U",
            "preloadedDependencies": [
                getDependencyObject("H5P.DragNDrop"), getDependencyObject("H5P.DragNBar"),
                getDependencyObject("H5P.DragNResize"), getDependencyObject("jQuery.ui"),
                getDependencyObject("H5P.JoubelUI"), getDependencyObject("H5P.Question"),
                getDependencyObject("H5P.DragQuestion"), getDependencyObject("H5P.AdvancedText"),
                getDependencyObject("H5P.Image"), getDependencyObject("FontAwesome"),
                getDependencyObject("H5P.FontIcons"), getDependencyObject("H5P.Transition")
            ]
        };

        // 1. MÉLANGE DES ÉTIQUETTES
        let allItems = [...donnees.elements];
        for (let i = allItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
        }

        const nbMots = allItems.length;
        const nbZones = donnees.zones.length || 1;

        const etiquetteOpacity = donnees.backgroundOpacity !== undefined ? donnees.backgroundOpacity : 100;
        const behaviourParams = donnees.behaviour || {
            "enableRetry": true, "enableCheckButton": true, "singlePoint": false,
            "applyPenalties": true, "enableScoreExplanation": true, "dropZoneHighlighting": "dragging",
            "autoAlignSpacing": 2, "enableFullScreen": true, "showScorePoints": true, "showTitle": true
        };

        const feedbacks = donnees.overallFeedback && donnees.overallFeedback.length > 0 
            ? donnees.overallFeedback : [{ "from": 0, "to": 100, "feedback": "Activité terminée !" }];

        // 🌟 2. LECTURE DU RATIO NATUREL DES IMAGES POUR ÉVITER L'ÉCRASEMENT
        const getImageDimensions = (base64) => new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => resolve({ w: 110, h: 110 }); // Fallback
            img.src = base64;
        });

        let hasImages = false;
        for (let item of allItems) {
            if (item.type === 'image' && item.src) {
                hasImages = true;
                const dims = await getImageDimensions(item.src);
                item.natW = dims.w;
                item.natH = dims.h;
            }
        }

        // 🌟 3. GRILLE DYNAMIQUE INTELLIGENTE
        // Si l'exercice contient au moins une image, on passe d'une grille rectangulaire plate (150x38) 
        // à une grille de grandes cases carrées (110x110) pour accueillir les miniatures.
        const CELL_W_PX = hasImages ? 110 : 150; 
        const CELL_H_PX = hasImages ? 110 : 38;
        const ELEM_GAP_PX = 15; 
        const ELEM_ROW_GAP_PX = 15;
        const ELEM_SIDE_MARGIN_PX = 12;

        let dropZones = [];
        let elements = [];
        let CANVAS_W = 900;
        let CANVAS_H;
        let bgImageJson = null;

        // Calcul préliminaire de la hauteur de la zone d'étiquettes
        const usableW = CANVAS_W - 2 * ELEM_SIDE_MARGIN_PX;
        const perRow = Math.max(1, Math.floor((usableW + ELEM_GAP_PX) / (CELL_W_PX + ELEM_GAP_PX)));
        const rowCount = Math.ceil(nbMots / perRow);
        const elemAreaH = rowCount > 0 ? (rowCount * CELL_H_PX) + ((rowCount - 1) * ELEM_ROW_GAP_PX) + 12 : 0;

        // 4. CONSTRUCTION : MODE IMAGE (SCHÉMA)
        if (donnees.layoutMode === 'image' && donnees.bgImageFile) {
            try {
                const isPng = donnees.bgImageFile.type === 'image/png';
                const mime = isPng ? "image/png" : "image/jpeg";
                const ext = isPng ? "png" : "jpg";
                const safeName = `bg_bandeau_${Date.now()}.${ext}`;

                const imgUrl = URL.createObjectURL(donnees.bgImageFile);
                const imgObj = new Image();
                imgObj.src = imgUrl;
                await new Promise(r => { imgObj.onload = r; imgObj.onerror = r; });

                let CANVAS_H_MIN = 500;
                if (imgObj.width > 0) CANVAS_H_MIN = Math.round(CANVAS_W * (imgObj.height / imgObj.width));

                const paddingBandeau = 30;
                CANVAS_H = CANVAS_H_MIN + elemAreaH + paddingBandeau;

                const canvas = document.createElement('canvas');
                canvas.width = CANVAS_W; canvas.height = CANVAS_H;
                const ctx = canvas.getContext('2d');
                
                if (!isPng) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H); }
                ctx.drawImage(imgObj, 0, 0, CANVAS_W, CANVAS_H_MIN);

                const newBgBlob = await new Promise(r => canvas.toBlob(r, mime, 0.9));
                const arrayBuffer = await newBgBlob.arrayBuffer();
                zip.file(`content/images/${safeName}`, arrayBuffer, { binary: true });
                URL.revokeObjectURL(imgUrl);

                bgImageJson = { "path": `images/${safeName}`, "mime": mime, "copyright": { "license": "U" }, "width": CANVAS_W, "height": CANVAS_H };

                dropZones = donnees.zones.map((zone, dzIdx) => {
                    const ui_x = zone.x !== undefined ? zone.x : 2;
                    const ui_y = zone.y !== undefined ? zone.y : 2;
                    const ui_w = zone.w !== undefined ? zone.w : 15;
                    const ui_h = zone.h !== undefined ? zone.h : 8;

                    const final_y_pct = Number((((ui_y / 100) * CANVAS_H_MIN) / CANVAS_H * 100).toFixed(2));
                    const zoneW_em = Number((((ui_w / 100) * CANVAS_W) / 16).toFixed(2));
                    const zoneH_em = Number((((ui_h / 100) * CANVAS_H_MIN) / 16).toFixed(2));

                    const correctEls = allItems.map((item, i) => item.targets.includes(dzIdx) ? String(i) : null).filter(v => v !== null);

                    return {
                        "label": `<div>${zone.nom}</div>`, "showLabel": false,
                        "x": Number(ui_x.toFixed(2)), "y": final_y_pct, "width": zoneW_em, "height": zoneH_em,
                        "correctElements": correctEls,
                        "backgroundOpacity": 0, "tipsAndFeedback": { "tip": "", "feedbackOnCorrect": "", "feedbackOnIncorrect": "" },
                        "single": true, "autoAlign": true
                    };
                });
            } catch (e) { logger.warn("Erreur traitement image de fond:", e); }
        } 
        
        // 5. CONSTRUCTION : MODE TABLEAU CLASSIQUE
        else {
            CANVAS_H = Math.max(500, 20 + 80 + 15 + elemAreaH);
            const zoneW_px = (CANVAS_W - (2 * ELEM_SIDE_MARGIN_PX) - ((nbZones - 1) * 10)) / Math.max(1, nbZones);
            const zoneH_px = CANVAS_H - elemAreaH - 35;

            dropZones = donnees.zones.map((zone, dzIdx) => {
                const correctEls = allItems.map((item, i) => item.targets.includes(dzIdx) ? String(i) : null).filter(v => v !== null);
                
                return {
                    "label": `<div><strong>${zone.nom}</strong></div>`, 
                    "showLabel": true,
                    "x": Number((((ELEM_SIDE_MARGIN_PX + dzIdx * (zoneW_px + 10)) / CANVAS_W) * 100).toFixed(2)),
                    "y": Number(((20 / CANVAS_H) * 100).toFixed(2)), 
                    "width": Number((zoneW_px / 16).toFixed(2)), 
                    "height": Number((zoneH_px / 16).toFixed(2)),
                    "correctElements": correctEls,
                    "backgroundOpacity": 100, "tipsAndFeedback": { "tip": "", "feedbackOnCorrect": "", "feedbackOnIncorrect": "" },
                    "single": false, "autoAlign": true
                };
            });
        }

        // 🌟 6. TRAITEMENT DES ÉTIQUETTES (Calcul chirurgical du Ratio)
        const startY_px = CANVAS_H - elemAreaH;

        for (let idx = 0; idx < allItems.length; idx++) {
            const item = allItems[idx];
            const col = idx % perRow; 
            const row = Math.floor(idx / perRow);
            const elemsThisRow = Math.min(perRow, nbMots - row * perRow);
            const startX_px = (CANVAS_W - (elemsThisRow * CELL_W_PX + (elemsThisRow - 1) * ELEM_GAP_PX)) / 2;
            
            // 📐 CALCUL PROPORTIONNEL DE LA BOÎTE H5P
            let itemW_px = CELL_W_PX;
            let itemH_px = CELL_H_PX;

            if (item.type === 'image' && item.natW && item.natH) {
                const ratio = item.natW / item.natH;
                if (ratio > 1) { // Format Paysage
                    itemW_px = CELL_W_PX;
                    itemH_px = CELL_W_PX / ratio;
                } else { // Format Portrait ou Carré
                    itemH_px = CELL_H_PX;
                    itemW_px = CELL_H_PX * ratio;
                }
            } else if (hasImages && item.type === 'text') {
                // Si la grille est en mode "Image" (grosses cases carrées), on force 
                // l'étiquette texte à rester fine (38px de haut) pour faire joli.
                itemW_px = CELL_W_PX;
                itemH_px = 38;
            }

            // Centrage vertical et horizontal dans la case de la grille
            const offsetX = (CELL_W_PX - itemW_px) / 2;
            const offsetY = (CELL_H_PX - itemH_px) / 2;

            const finalX_pct = Number((((startX_px + col * (CELL_W_PX + ELEM_GAP_PX) + offsetX) / CANVAS_W) * 100).toFixed(2));
            const finalY_pct = Number((((startY_px + row * (CELL_H_PX + ELEM_ROW_GAP_PX) + offsetY) / CANVAS_H) * 100).toFixed(2));

            const finalW_em = Number((itemW_px / 16).toFixed(2));
            const finalH_em = Number((itemH_px / 16).toFixed(2));

            let typeObj = {};

            // 📸 GESTION D'UNE IMAGE
            if (item.type === 'image' && item.src) {
                try {
                    const arr = item.src.split(',');
                    const mime = arr[0].match(/:(.*?);/)[1];
                    const ext = mime.split('/')[1] === 'png' ? 'png' : 'jpg';
                    const bstr = atob(arr[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while(n--) { u8arr[n] = bstr.charCodeAt(n); }
                    
                    const safeName = `label_img_${Date.now()}_${idx}.${ext}`;
                    zip.file(`content/images/${safeName}`, u8arr.buffer, { binary: true });

                    typeObj = {
                        "library": "H5P.Image 1.1",
                        "params": {
                            "file": { "path": `images/${safeName}`, "mime": mime },
                            "alt": "Étiquette visuelle"
                        },
                        "subContentId": generateUUID(),
                        "metadata": { "contentType": "Image", "license": "U", "title": "Image" }
                    };
                } catch(e) {
                    logger.warn("Erreur de conversion Base64 d'une étiquette:", e);
                    typeObj = {
                        "library": "H5P.AdvancedText 1.1",
                        "params": { "text": `<p style="text-align:center;">Erreur Image</p>` },
                        "subContentId": generateUUID()
                    };
                }
            } 
            // 📝 GESTION DU TEXTE CLASSIQUE
            else {
                typeObj = {
                    "library": "H5P.AdvancedText 1.1",
                    "params": { "text": `<p style="text-align:center;font-size:0.9em;margin:0;line-height:1.2;"><strong>${item.text}</strong></p>` },
                    "subContentId": generateUUID(),
                    "metadata": { "contentType": "Text", "license": "U", "title": item.text }
                };
            }

            // GESTION DU DÉPÔT LIBRE
            const allDropZoneIds = donnees.zones.map((_, i) => String(i));
            let dZones = [];
            if (donnees.freeDrop) {
                dZones = allDropZoneIds; 
            } else {
                dZones = item.targets.map(t => String(t));
                if (dZones.length === 0) dZones = allDropZoneIds;
            }

            elements.push({
                "type": typeObj,
                "x": finalX_pct, "y": finalY_pct,
                // On passe les proportions exactes à H5P pour éviter l'écrasement !!
                "width": finalW_em, "height": finalH_em,
                "dropZones": dZones,
                "backgroundOpacity": etiquetteOpacity,
                "multiple": false
            });
        }

        // 7. JSON FINAL
        const contentJson = {
			"title": donnees.titre || "Activité de glisser-déposer",
            "scoreShow": "Vérifier", "submit": "Valider", "tryAgain": "Recommencer", 
            "scoreExplanation": "Les bonnes réponses donnent des points. Le score minimum est de 0.",
            "question": { "settings": { "size": { "width": CANVAS_W, "height": CANVAS_H } }, "task": { "elements": elements, "dropZones": dropZones } },
            "overallFeedback": feedbacks,
            "behaviour": behaviourParams,
            "localize": { "fullscreen": "Plein écran", "exitFullscreen": "Quitter le plein écran" },
            "grabbablePrefix": "Élément {num} sur {total}.", "grabbableSuffix": "Placé dans la zone {num}.", "dropzonePrefix": "Zone {num} sur {total}.", "noDropzone": "Pas de zone de dépôt.", "correctAnswer": "Bonne réponse", "wrongAnswer": "Mauvaise réponse", "feedbackHeader": "Résultat", "scoreBarLabel": "Vous avez :num sur :total points"
        };

        if (bgImageJson) contentJson.question.settings.background = bgImageJson;

        zip.file("h5p.json", JSON.stringify(h5pJson, null, 2), fileOptions);
        zip.file("content/content.json", JSON.stringify(contentJson, null, 2), fileOptions);
        Object.keys(zip.files).forEach(f => { if (zip.files[f].dir) delete zip.files[f]; });

        const titrePropre = donnees.titre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, '_');

        const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
        return { blob, fileName: `${titrePropre}_dragndrop.h5p` };
    }