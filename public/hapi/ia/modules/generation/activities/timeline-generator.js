// Fichier : modules/generation/activities/timeline-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization } from '../generator-utils.js';

/**
 * TIMELINE - VERSION CORRIGÉE (REGEX VALIDÉE)
 */
export async function genererH5PTimeline(donnees) {
	    logger.log(`⏳ Génération H5P Timeline pour "${donnees.titre}"...`);
	    const zip = new JSZip();

	    // 1. UTILITAIRES DE DATE
	    const fixDate = (dateStr) => {
	        if (!dateStr) return "";
	        let clean = dateStr.toString().replace(/[-/]/g, ',');
	        const parts = clean.split(',');
	        if (parts.length === 1) return `${parts[0]},01,01`;
	        if (parts.length === 2) return `${parts[0]},${parts[1]},01`;
	        return clean; 
	    };

	    // ✅ IMAGE FANTÔME CORRIGÉE (PNG 1x1 VALIDE FIREFOX)
	    // Cette version est garantie valide par tous les navigateurs
	    const VOID_IMG_DATA = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
	    const voidBuffer = Uint8Array.from(atob(VOID_IMG_DATA), c => c.charCodeAt(0)).buffer;
	    zip.file("content/images/void.png", voidBuffer, { binary: true });

		const processAsset = async (assetData, prefix, index, forceLocal = false) => {
		    if (!assetData) return null;
		    let mediaValue = (typeof assetData === 'object') ? assetData.media : assetData;
		    if (!mediaValue) return null;

		    // ✅ Si distant ET qu'on ne force pas le local, on retourne l'URL telle quelle
		    if (mediaValue.startsWith('http') && !forceLocal) {
		        return { 
		            "media": mediaValue, 
		            "credit": assetData.credit || "", 
		            "caption": assetData.caption || "" 
		        };
		    }

		    // ✅ Sinon on télécharge et on intègre au ZIP
		    try {
		        let fileBuffer = null;
		        let extension = "jpg";
		        let mimeType = "image/jpeg";

		        if (mediaValue.startsWith('data:image')) {
		            const matches = mediaValue.match(/^data:image\/([a-z]+);base64,(.+)$/);
		            if (matches) {
		                extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
		                mimeType = `image/${extension}`;
		                fileBuffer = Uint8Array.from(atob(matches[2]), c => c.charCodeAt(0)).buffer;
		            }
		        } else if (mediaValue.startsWith('http')) {
		            // ✅ Téléchargement forcé (forceLocal = true)
		            const response = await fetch(mediaValue);
		            if (response.ok) {
		                fileBuffer = await response.arrayBuffer();
                
		                // Extraction ultra-sécurisée de l'extension
		                try {
		                    const cleanUrl = mediaValue.split('?')[0].split('#')[0];
		                    const lastSegment = cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1);
		                    const dotIndex = lastSegment.lastIndexOf('.');
		                    let rawExt = dotIndex > 0 ? lastSegment.substring(dotIndex + 1) : '';
                    
		                    rawExt = rawExt.toLowerCase().replace(/[^a-z]/g, '');
                    
		                    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
		                    extension = validExtensions.includes(rawExt) ? rawExt : 'jpg';
		                    if (extension === 'jpeg') extension = 'jpg';
                    
		                } catch (e) {
		                    extension = 'jpg';
		                }
                
		                mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
		            }
		        }

		        if (fileBuffer) {
		            const timestamp = Date.now();
		            const randomNum = Math.floor(Math.random() * 100000);
		            const safeId = `${timestamp}${randomNum}`;
            
		            let fileName = `img_${prefix}_${index}_${safeId}.${extension}`;
		            fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            
		            zip.file(`content/images/${fileName}`, fileBuffer, { binary: true });
            
		            // ✅ RETOUR AVEC PATH (image locale dans le ZIP)
		            return {
		                "path": `images/${fileName}`,
		                "mime": mimeType,
		                "credit": assetData.credit || "",
		                "caption": assetData.caption || ""
		            };
		        }
		    } catch (e) { 
		        console.error("Erreur processAsset:", e); 
		    }
		    return null;
		};
		
		
	    // 2. TRAITEMENT DE LA COUVERTURE
	    let bgData = null;
	    let headlineAsset = null;
    
	    if (donnees.headline?.backgroundImage) {
	        bgData = await processAsset(donnees.headline.backgroundImage, 'bg', 0, true);
	    }
    
	    if (donnees.headline?.asset?.media) {
	        headlineAsset = {
	            "media": donnees.headline.asset.media,
	            "credit": donnees.headline.asset.credit || "",
	            "caption": donnees.headline.asset.caption || ""
	        };
	    }

		// 3. TRAITEMENT DES ÉVÉNEMENTS
		const datesProcessed = [];
		if (donnees.dates) {
		    for (let i = 0; i < donnees.dates.length; i++) {
		        const item = donnees.dates[i];
        
		        let itemAsset = null;
        
		        // ✅ LOGIQUE CONDITIONNELLE : Distant vs Local
		        if (item.asset?.media) {
		            const mediaUrl = item.asset.media;
            
		            // CAS 1 : Image distante (HTTP) - ON LA GARDE DISTANTE
		            if (mediaUrl.startsWith('http')) {
		                itemAsset = {
		                    "media": mediaUrl,
		                    "credit": item.asset.credit || "",
		                    "caption": item.asset.caption || ""
		                };
		            }
		            // CAS 2 : Image locale ou Base64 - ON LA TÉLÉCHARGE
		            else {
		                itemAsset = await processAsset(item.asset, 'event', i, true); // forceLocal = true
		            }
		        }
        
		        // Traitement de la miniature (toujours locale si présente)
		        if (item.asset?.thumbnail && itemAsset) {
		            const thumbData = await processAsset(item.asset.thumbnail, 'thumb', i, true);
		            if (thumbData) {
		                itemAsset.thumbnail = { 
		                    "path": thumbData.path,
		                    "mime": thumbData.mime,
		                    "width": 32, 
		                    "height": 32 
		                };
		            }
		        }

		        const eventObject = {
		            "startDate": fixDate(item.startDate),
		            "endDate": fixDate(item.endDate),
		            "headline": item.headline || "",
		            "text": item.text || "",
		            "tag": item.tag || ""
		        };

		        // ✅ GESTION ASSET : Réel ou Void
		        if (itemAsset) {
		            eventObject.asset = itemAsset;
		        } else {
		            // Image VOID locale
		            eventObject.asset = {
		                "media": "images/void.png",
		                "mime": "image/png",
		                "credit": "",
		                "caption": "",
		                "thumbnail": {
		                    "path": "images/void.png",
		                    "mime": "image/png",
		                    "width": 1,
		                    "height": 1
		                }
		            };
		        }

		        datesProcessed.push(eventObject);
		    }
		}

	    // 4. CONSTRUCTION DE L'OBJET TIMELINE
	    const timelineJson = {
	        "timeline": {
	            "defaultZoomLevel": "0",
	            "height": 600,
	            "date": datesProcessed,
	            "language": (donnees.language || "fr").toLowerCase(),
	            "headline": donnees.headline?.title || donnees.titre,
	            "text": donnees.headline?.text || "",
	            "era": donnees.eras || []
	        }
	    };

	    if (bgData) {
	        timelineJson.timeline.backgroundImage = {
	            "path": bgData.path,
	            "mime": bgData.mime, // ✅ UTILISATION DU MIME RÉEL
	            "copyright": { 
	                "author": donnees.headline?.backgroundImage?.credit || "", 
	                "license": "U" 
	            }
	        };
	    }

	    if (headlineAsset) {
	        timelineJson.timeline.asset = headlineAsset;
	    }

	    // 5. MANIFESTE H5P
	    const h5pJson = {
	        "title": donnees.titre,
	        "language": timelineJson.timeline.language,
	        "mainLibrary": "H5P.Timeline",
	        "embedTypes": ["div"],
	        "license": "U",
	        "preloadedDependencies": [
	            { "machineName": "H5P.Timeline", "majorVersion": 1, "minorVersion": 1 },
	            { "machineName": "TimelineJS", "majorVersion": 1, "minorVersion": 1 }
	        ]
	    };

	    zip.file("h5p.json", JSON.stringify(h5pJson, null, 2));
	    zip.file("content/content.json", JSON.stringify(timelineJson, null, 2));

	    Object.keys(zip.files).forEach(filename => {
	        if (zip.files[filename].dir === true) {
	            delete zip.files[filename];
	        }
	    });

	    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    
	    return { 
	        blob, 
	        fileName: `h5p-timeline-${Date.now()}.h5p` 
	    };
	}