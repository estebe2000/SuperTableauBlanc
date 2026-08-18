// Fichier: modules/ui/preview-manager.js

import { logger } from '../utils/logger.js';
import { libraryManager } from '../utils/h5p-library-manager.js';
import { H5P_LIBS_BASE_URL } from '../utils/h5p-constants.js';
import { fileToBase64 } from '../utils/helpers.js';

// Imports des modules UI
import * as cardsUI from './cards-ui.js';
import { getAudioFiles } from './dictation-ui.js'; 
import * as dictationUI from './dictation-ui.js';

const libraryCache = new Map(); // ⚡ Cache en mémoire pour les librairies

const uiModules = {
    'cards': cardsUI,
    'dictation': dictationUI
};

let modal, container, titleEl, closeBtn;

export function init() {
    modal = document.getElementById('preview-modal');
    container = document.getElementById('h5p-preview-container');
    titleEl = document.getElementById('preview-title');
    closeBtn = modal.querySelector('.modal-close');
    
    if (closeBtn) closeBtn.onclick = hide; 
    
    const btnPreview = document.getElementById('btn-visualiser');
    if (btnPreview) {
        btnPreview.addEventListener('click', handleLivePreview);
    }
    
    logger.log('👁️ Preview Manager initialisé.');
}

function hide() {
    if (modal) {
        modal.style.display = 'none';
        container.innerHTML = '';
    }
}

// --- 1. LIVE PREVIEW (Avant génération) ---
async function handleLivePreview() {
    const activeOption = document.querySelector('.activity-option-label.selected');
    if (!activeOption) return alert("Sélectionnez une activité.");

    const type = activeOption.dataset.type;
    const module = uiModules[type];

    if (!module) return alert(`Prévisualisation non disponible pour : ${type}`);

    modal.style.display = 'flex';
    container.innerHTML = '<div style="color:var(--text-muted); padding:20px; text-align:center;">Chargement...</div>';
    titleEl.textContent = `Prévisualisation : ${type}`;

    try {
        if (typeof module.generatePreviewJSON === 'function') {
            const previewData = await module.generatePreviewJSON();
            if (previewData) {
                await loadIframeContent(previewData.library, previewData.params);
            } else {
                hide();
            }
        } else {
             container.innerHTML = '<p style="text-align:center; color:orange;">Pour ce module, utilisez le bouton <b>"Générer le fichier H5P"</b>.</p>';
        }
    } catch (e) {
        logger.error(e);
        container.innerHTML = `<p style="color:#b91c1c; text-align:center;">Erreur : ${e.message}</p>`;
    }
}

async function loadIframeContent(libraryNameString, paramsJson) {
    const contentId = `preview-${Date.now()}`;
    const [machineName, version] = libraryNameString.split(' ');

    let { jsPaths, cssPaths } = await getLibraryPaths(machineName, version);
    
    if (machineName === 'H5P.Dialogcards' || machineName === 'H5P.Flashcards') {
        const criticalDeps = [
            'H5P.JoubelUI', 'H5P.FontIcons', 'H5P.Transition',
            'H5P.Audio', 'FontAwesome', 'H5P.Question', 'H5P.Image'
        ];
        
        let newJsPaths = [];
        let newCssPaths = [];
        
        for (let e of criticalDeps) {
            const [n, v] = e.split('-');
            const p = await getLibraryPaths(n, '1.9'); 
            newJsPaths.push(...p.jsPaths); 
            newCssPaths.push(...p.cssPaths);
        }
        
        newJsPaths.push(...jsPaths);
        newCssPaths.push(...cssPaths);
        jsPaths = newJsPaths;
        cssPaths = newCssPaths;
    }


    const uniqueJs = [...new Set(jsPaths)];
    const uniqueCss = [...new Set(cssPaths)];

    container.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = 'h5p-viewer.html';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    container.appendChild(iframe);

    iframe.onload = () => {
        try {
            const patchScript = iframe.contentDocument.createElement('script');
            patchScript.textContent = `
                (function(){
                    window.H5P = window.H5P || {};
                    if(!window.H5P.ConfirmationDialog){
                        console.warn('<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> Patch Virtuel : Mocking H5P.ConfirmationDialog');
                        window.H5P.ConfirmationDialog = function(){
                            return {
                                appendTo:()=>{}, 
                                show:()=>{}, 
                                hide:()=>{}, 
                                on:()=>{}, 
                                trigger:()=>{},
                                getElement:()=>{return document.createElement('div')}
                            };
                        }
                    }
                })();
            `;
            iframe.contentDocument.head.appendChild(patchScript);
        } catch(e) { console.warn("Echec patch virtuel", e); }

        iframe.contentWindow.postMessage({
            action: 'loadH5P',
            scripts: uniqueJs,
            styles: uniqueCss,
            contentId: contentId,
            integration: {
                contents: {
                    [contentId]: {
                        library: libraryNameString,
                        jsonContent: JSON.stringify(paramsJson),
                        fullScreen: false,
                        title: "Aperçu"
                    }
                },
                baseUrl: window.location.origin,
                url: H5P_LIBS_BASE_URL,
                // urlLibraries : nos dossiers de libs sont directement sous baseUrl
                // (sans sous-dossier /libraries/), donc on surcharge getLibraryPath.
                urlLibraries: H5P_LIBS_BASE_URL,
                siteUrl: window.location.origin
            }
        }, '*');
    };
}

// --- 2. BLOB PREVIEW (Après génération) ---
export async function show(blob, title, activityType, modelData = null) {
    if (!blob) return alert("Erreur Blob");
    
    modal.style.display = 'flex';
    container.innerHTML = 'Chargement...';
    titleEl.textContent = `Aperçu : ${title}`;

    try {
        const zip = await JSZip.loadAsync(blob);

        // =========================================================
        // ✅ PATCH CARTE INTERACTIVE (HTML ZIP)
        // =========================================================
        if (activityType === 'interactive-map') {
            logger.log("🗺️ Prévisualisation de la carte interactive (HTML/ZIP)...");
            
            // 1. On récupère le template HTML et les données JS
            let htmlContent = await zip.file("index.html").async("string");
            const dataJsContent = await zip.file("data.js").async("string");
            
            // 2. On injecte les données directement dans l'HTML (remplace l'appel au fichier local)
            htmlContent = htmlContent.replace('<script src="data.js"></script>', `<script>${dataJsContent}</script>`);
            
            // 2b. Les libs (Leaflet + plugins) et la police Marianne sont bundlées
            // dans le ZIP sous ./libs/ et fonts/ (pour l'élève). Mais l'aperçu est
            // un iframe srcdoc : ces chemins relatifs se résoudraient sur /ia/libs/…
            // (404). On les réécrit vers les copies vendorisées servies par HAPI
            // (résolues relativement à /ia/, base du srcdoc). Sans ça : Leaflet ne
            // charge pas → « L is not defined » → carte vide.
            const previewAssetMap = {
                './libs/leaflet.css': '../vendor/leaflet/leaflet.css',
                './libs/leaflet.fullscreen.css': '../vendor/leaflet-fullscreen/leaflet.fullscreen.css',
                './libs/leaflet.js': '../vendor/leaflet/leaflet.js',
                './libs/leaflet-side-by-side.min.js': '../vendor/leaflet-side-by-side/leaflet-side-by-side.min.js',
                './libs/Leaflet.fullscreen.min.js': '../vendor/leaflet-fullscreen/Leaflet.fullscreen.min.js',
                'fonts/Marianne-Regular.woff2': '../css/fonts/Marianne-Regular.woff2',
                'fonts/Marianne-Bold.woff2': '../css/fonts/Marianne-Bold.woff2',
            };
            for (const [bundled, vendored] of Object.entries(previewAssetMap)) {
                htmlContent = htmlContent.split(bundled).join(vendored);
            }

            // 3. On traite les images locales (pour qu'elles s'affichent sans serveur)
            const imageFiles = Object.keys(zip.files).filter(name => name.startsWith('images/') && !zip.files[name].dir);
            for (const imgName of imageFiles) {
                const imgB64 = await zip.file(imgName).async("base64");
                let mime = "image/jpeg";
                if (imgName.toLowerCase().endsWith(".png")) mime = "image/png";

                const dataUrl = `data:${mime};base64,${imgB64}`;
                // Remplacement global dans tout le HTML (qui contient maintenant aussi la variable MAP_DATA)
                htmlContent = htmlContent.split(imgName).join(dataUrl);
            }

            // 4. On crée et injecte l'iframe avec tout le code "en dur" (srcdoc)
            container.innerHTML = '';
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            container.appendChild(iframe);
            
            iframe.srcdoc = htmlContent;
            return; // 🛑 On s'arrête ici pour la carte interactive.
        }
        // =========================================================

        const h5pJsonFile = zip.file("h5p.json");
        if (!h5pJsonFile) throw new Error("h5p.json introuvable. L'archive n'est pas un fichier H5P valide.");

        const h5pJson = JSON.parse(await h5pJsonFile.async("string"));
        let contentJsonStr = await zip.file("content/content.json").async("string");


		// --- PATCH ADVANCED BLANKS ---
        if (h5pJson.mainLibrary === 'H5P.AdvancedBlanks') {
            logger.log("🎯 Patch AdvancedBlanks : injection dépendances critiques...");
            const abDeps = [
                { machineName: 'H5P.JoubelUI', majorVersion: 1, minorVersion: 3 },
                { machineName: 'H5P.Question', majorVersion: 1, minorVersion: 5 }, // Version de base
                { machineName: 'H5P.Transition', majorVersion: 1, minorVersion: 0 },
                { machineName: 'H5P.FontIcons', majorVersion: 1, minorVersion: 0 }
            ];

            // Force JoubelUI et Question à se placer tout en haut de la liste
            h5pJson.preloadedDependencies = abDeps.concat(
                h5pJson.preloadedDependencies.filter(dep =>
                    !abDeps.some(c => c.machineName === dep.machineName)
                )
            );
        }

        // --- PATCH DICTÉE ---
        if (h5pJson.mainLibrary === 'H5P.Dictation') {
            logger.log("🎧 Patch Dictée détecté (Support Slow Mode).");
            
            const map = getAudioFiles();
            const content = JSON.parse(contentJsonStr);
            
            if (content.sentences) {
                for (let s of content.sentences) {
                    let statementId = null;
                    if (s.sample && s.sample[0] && s.sample[0].path) {
                        const m = s.sample[0].path.match(/_(statement-\d+)_/);
                        if (m) statementId = m[1];
                    }

                    if (statementId && map.has(statementId)) {
                        const audioEntry = map.get(statementId);
                        
                        let fileNormal = null;
                        let fileSlow = null;

                        if (audioEntry instanceof File) {
                            fileNormal = audioEntry;
                        } 
                        else if (audioEntry.normal) {
                            fileNormal = audioEntry.normal;
                            fileSlow = audioEntry.slow;
                        }

                        if (fileNormal && s.sample && s.sample[0]) {
                            s.sample[0].path = await fileToBase64(fileNormal);
                        }

                        if (fileSlow && s.sampleAlternative && s.sampleAlternative[0]) {
                            s.sampleAlternative[0].path = await fileToBase64(fileSlow);
                            logger.log(`🐢 Version lente injectée pour ${statementId}`);
                        }
                    }
                }
                contentJsonStr = JSON.stringify(content);
            }

            const criticalDeps = [
                { machineName: 'H5P.JoubelUI', majorVersion: 1, minorVersion: 3 },
                { machineName: 'H5P.Question', majorVersion: 1, minorVersion: 5 },
                { machineName: 'H5P.FontIcons', majorVersion: 1, minorVersion: 0 }
            ];
            h5pJson.preloadedDependencies = criticalDeps.concat(
                h5pJson.preloadedDependencies.filter(dep => 
                    !criticalDeps.some(c => c.machineName === dep.machineName)
                )
            );
        }

        // --- PATCH CARDS ---
        if (h5pJson.mainLibrary.startsWith('H5P.Dialogcards') || h5pJson.mainLibrary.startsWith('H5P.Flashcards')) {
            logger.log("🃏 Patch Cards : Extraction Images ZIP...");
            const content = JSON.parse(contentJsonStr);
            const items = content.dialogs || content.cards || [];
            
            for (const item of items) {
                if (item.image && item.image.path) {
                    const originalPath = item.image.path;
                    let imgFile = zip.file(`content/${originalPath}`);
                    if (!imgFile) imgFile = zip.file(originalPath);
                    
                    if (imgFile) {
                        const b64 = await imgFile.async("base64");
                        const mime = item.image.mime || "image/jpeg";
                        item.image.path = `data:${mime};base64,${b64}`;
                    }
                }
                if (item.audio && item.audio[0] && item.audio[0].path) {
                    let audioFile = zip.file(`content/${item.audio[0].path}`);
                    if (!audioFile) audioFile = zip.file(item.audio[0].path);

                    if (audioFile) {
                        const b64 = await audioFile.async("base64");
                        const mime = item.audio[0].mime || "audio/webm";
                        item.audio[0].path = `data:${mime};base64,${b64}`;
                    }
                }
            }
            contentJsonStr = JSON.stringify(content);
        }


        // --- PATCH IMAGE PAIRING ---
        if (h5pJson.mainLibrary.startsWith('H5P.ImagePair')) {
            logger.log("🖼️ Patch Image Pairing : Extraction Images ZIP...");
            const content = JSON.parse(contentJsonStr);
            
            if (content.cards && Array.isArray(content.cards)) {
                for (const card of content.cards) {
                    if (card.image && card.image.path && !card.image.path.startsWith('data:')) {
                        const originalPath = card.image.path;
                        let imgFile = zip.file(`content/${originalPath}`);
                        if (!imgFile) imgFile = zip.file(originalPath);
                        
                        if (imgFile) {
                            const b64 = await imgFile.async("base64");
                            const mime = card.image.mime || "image/jpeg";
                            card.image.path = `data:${mime};base64,${b64}`;
                        }
                    }
                    
                    if (card.match && card.match.path && !card.match.path.startsWith('data:')) {
                        const originalPath = card.match.path;
                        let imgFile = zip.file(`content/${originalPath}`);
                        if (!imgFile) imgFile = zip.file(originalPath);
                        
                        if (imgFile) {
                            const b64 = await imgFile.async("base64");
                            const mime = card.match.mime || "image/jpeg";
                            card.match.path = `data:${mime};base64,${b64}`;
                        }
                    }
                }
                contentJsonStr = JSON.stringify(content);
            }
        }


// --- PATCH DRAG QUESTION (Image de fond + Étiquettes images) ---
        if (h5pJson.mainLibrary.startsWith('H5P.DragQuestion')) {
            logger.log("🧩 Patch DragQuestion : Extraction Multimédia du ZIP...");
            const content = JSON.parse(contentJsonStr);
            
            // 1. Traitement de l'image de fond (Schéma)
            if (content.question && content.question.settings && content.question.settings.background) {
                const bg = content.question.settings.background;
                if (bg.path && !bg.path.startsWith('data:')) {
                    let imgFile = zip.file(`content/${bg.path}`) || zip.file(bg.path);
                    if (imgFile) {
                        const b64 = await imgFile.async("base64");
                        bg.path = `data:${bg.mime || "image/jpeg"};base64,${b64}`;
                    }
                }
            }

            // 2. Traitement des étiquettes (si ce sont des images)
            if (content.question && content.question.task && content.question.task.elements) {
                for (let el of content.question.task.elements) {
                    // On vérifie si l'élément utilise la librairie Image
                    if (el.type && el.type.library && el.type.library.startsWith('H5P.Image')) {
                        const imgParams = el.type.params.file;
                        if (imgParams && imgParams.path && !imgParams.path.startsWith('data:')) {
                            let imgFile = zip.file(`content/${imgParams.path}`) || zip.file(imgParams.path);
                            if (imgFile) {
                                const b64 = await imgFile.async("base64");
                                imgParams.path = `data:${imgParams.mime || "image/jpeg"};base64,${b64}`;
                            }
                        }
                    }
                }
            }
            contentJsonStr = JSON.stringify(content);
        }


        // --- PATCH TIMELINE ---
        if (h5pJson.mainLibrary.startsWith('H5P.Timeline')) {
            logger.log("⏰ Patch Timeline : Extraction et Correction MIME...");
            const content = JSON.parse(contentJsonStr);
            
			const injectBase64 = async (obj, pathProp, mimeProp) => {
			    if (!obj || !obj[pathProp]) return;
			    const path = obj[pathProp];
			    if (path.startsWith('http') || path.startsWith('data:')) return;

			    let imgFile = zip.file(`content/${path}`);
			    if (!imgFile) imgFile = zip.file(path);

			    if (imgFile) {
			        const b64 = await imgFile.async("base64");
			        const mime = obj[mimeProp] || "image/jpeg"; 
			        obj[pathProp] = `data:${mime};base64,${b64}`;
			    }
			};

            if (content.timeline?.backgroundImage) await injectBase64(content.timeline.backgroundImage, 'path', 'mime');
            if (content.timeline?.asset) await injectBase64(content.timeline.asset, 'media', 'mime');
            
            if (content.timeline?.date && Array.isArray(content.timeline.date)) {
                for (let i = 0; i < content.timeline.date.length; i++) {
                    const event = content.timeline.date[i];
                    if (event.asset) await injectBase64(event.asset, 'media', 'mime');
                    if (event.asset?.thumbnail) await injectBase64(event.asset.thumbnail, 'path', 'mime');
                }
            }
            contentJsonStr = JSON.stringify(content);
        }

        // --- Patch 3D ---
        if (h5pJson.mainLibrary === 'H5P.ThreeDModel' && modelData) {
            const c = JSON.parse(contentJsonStr);
            if(c.model && c.model.file) c.model.file.path = modelData.url;
            contentJsonStr = JSON.stringify(c);
        }

        let css = [], js = [];
        
		// --- PATCH INTERACTIVE VIDEO ---
		// --- PATCH INTERACTIVE VIDEO ---
		if (h5pJson.mainLibrary === 'H5P.InteractiveVideo') {
		    logger.log("🎬 Patch InteractiveVideo : injection dépendances critiques...");

		    const ivDeps = [
				{ machineName: 'jQuery.ui',         majorVersion: 1, minorVersion: 10 },
		        { machineName: 'H5P.JoubelUI',      majorVersion: 1, minorVersion: 3 },
		        { machineName: 'H5P.Question',      majorVersion: 1, minorVersion: 5 },
		        { machineName: 'H5P.Video',         majorVersion: 1, minorVersion: 6 },
		        { machineName: 'H5P.DragNBar',      majorVersion: 1, minorVersion: 5 },
		        { machineName: 'H5P.DragNDrop',     majorVersion: 1, minorVersion: 1 }, // ⬅️ CORRECTION : minorVersion 1 (au lieu de 0)
		        { machineName: 'H5P.FontIcons',     majorVersion: 1, minorVersion: 0 },
		        { machineName: 'H5P.Transition',    majorVersion: 1, minorVersion: 0 },
		        { machineName: 'H5P.MathDisplay',   majorVersion: 1, minorVersion: 0 },
		    ];

		    h5pJson.preloadedDependencies = ivDeps.concat(
		        h5pJson.preloadedDependencies.filter(dep =>
		            !ivDeps.some(c => c.machineName === dep.machineName)
		        )
		    );
		}
		
// ⚡ Lancer la recherche de toutes les dépendances EN MÊME TEMPS
        const depPromises = h5pJson.preloadedDependencies.map(dep => 
            getLibraryPaths(dep.machineName, `${dep.majorVersion}.${dep.minorVersion}`)
        );
        const resolvedDeps = await Promise.all(depPromises);
        resolvedDeps.forEach(p => { js.push(...p.jsPaths); css.push(...p.cssPaths); });

        const mainDep = h5pJson.preloadedDependencies.find(d => d.machineName === h5pJson.mainLibrary) || 
                        { machineName: h5pJson.mainLibrary.split(' ')[0], majorVersion: 1, minorVersion: 0 };
                        
        const libStr = `${mainDep.machineName} ${mainDep.majorVersion}.${mainDep.minorVersion}`;
        const cid = `blob-${Date.now()}`;

        container.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.src = 'h5p-viewer.html';
        iframe.style.cssText = "width:100%; height:100%; border:none;";
        container.appendChild(iframe);

        iframe.onload = () => {
             try {
                const patchScript = iframe.contentDocument.createElement('script');
			patchScript.textContent = `
			    (function(){
			        window.H5P = window.H5P || {};
        
			        // Mock ConfirmationDialog
			        if(!window.H5P.ConfirmationDialog){
			            window.H5P.ConfirmationDialog = function(){
			                return {appendTo:()=>{}, show:()=>{}, hide:()=>{}, on:()=>{}, trigger:()=>{}, getElement:()=>{return document.createElement('div')}};
			            }
			        }
        
			        // ✅ AJOUT : Mock communicator (nécessaire pour les sous-contenus IV)
			        if(!window.H5P.communicator){
			            window.H5P.communicator = { on: function(){}, send: function(){} };
			        }
        
			        // ✅ AJOUT : Mock fullscreen
			        if(!window.H5P.fullscreen){
			            window.H5P.fullscreen = function(){};
			        }

					// ✅ AJOUT : Mock createUUID (utilisé par IV pour les interactions)
			        if(!window.H5P.createUUID){
			            window.H5P.createUUID = function(){
			                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
			                    const r = Math.random()*16|0;
			                    return (c==='x'?r:(r&0x3|0x8)).toString(16);
			                });
			            };
			        }

			        // 🛡️ LE FAMEUX HACK : Faux composant H5P.Dialog pour éviter le crash JS
			        if(!window.H5P.Dialog){
			            window.H5P.Dialog = function(){
                            var $el = window.H5P.jQuery('<div></div>');
			                this.appendTo = function($c){ $c.append($el); };
                            this.open = function(){};
                            this.close = function(){};
                            this.on = function(){};
                            this.trigger = function(){};
			            }
			        }
			    })();
			`;
                iframe.contentDocument.head.appendChild(patchScript);
            } catch(e) {}
            
			iframe.contentWindow.postMessage({
			    action: 'loadH5P',
			    scripts: [...new Set(js)], styles: [...new Set(css)], contentId: cid,
			    integration: {
			        contents: { [cid]: { library: libStr, jsonContent: contentJsonStr, fullScreen: false, title: h5pJson.title } },
			        baseUrl: window.location.origin, url: H5P_LIBS_BASE_URL, urlLibraries: H5P_LIBS_BASE_URL, siteUrl: window.location.origin,
        
			        // AJOUT VITAL : Envoi du dictionnaire depuis le manager
			        l10n: {
			            "H5P": { "close": "Fermer", "fullscreen": "Plein écran", "disableFullscreen": "Quitter", "download": "Télécharger" },
			            "H5P.InteractiveVideo": {},
			            "H5P.DragNBar": {},
			            "H5P.Dialog": {}
			        }
			    }
			}, '*');
        };

    } catch (e) {
        console.error(e);
        container.innerHTML = `Erreur: ${e.message}`;
    }
}

export async function lancerPrevisualisation(h, m) { if(h?.activite?.blob) show(h.activite.blob, h.activite.nom, "3d", m); }

async function getLibraryPaths(name, ver) {
    const cacheKey = `${name}-${ver}`;
    // ⚡ Si on a déjà cherché cette librairie, on renvoie le résultat instantanément !
    if (libraryCache.has(cacheKey)) return libraryCache.get(cacheKey);

    const attempts = [ver, '1.9', '1.8', '1.7', '1.6', '1.5', '1.4', '1.3', '1.2', '1.1', '1.0'];
    // Bibliothèques externalisées : on pointe vers le dépôt parallèle (URL absolue).
    const baseDir = H5P_LIBS_BASE_URL;

    for (const v of attempts) {
        if (!v) continue;
        const dirName = `${name}-${v}`;
        const url = `${baseDir}/${dirName}/library.json`;

        try {
            const r = await fetch(url);
            if (r.ok) {
                const j = await r.json();
                const result = {
                    jsPaths: (j.preloadedJs||[]).map(f=>`${baseDir}/${dirName}/${f.path}`),
                    cssPaths: (j.preloadedCss||[]).map(f=>`${baseDir}/${dirName}/${f.path}`)
                };
                libraryCache.set(cacheKey, result); // On sauvegarde dans le cache
                return result;
            }
        } catch(e) {}
    }
    console.warn(`✕ Lib introuvable: ${name}`);
    const emptyResult = { jsPaths:[], cssPaths:[] };
    libraryCache.set(cacheKey, emptyResult);
    return emptyResult;
}