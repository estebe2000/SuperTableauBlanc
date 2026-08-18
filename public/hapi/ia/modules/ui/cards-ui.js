// Fichier: modules/ui/cards-ui.js

import { logger } from '../utils/logger.js';
import { localPlaceholder } from '../utils/placeholder.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { creerAssistantIA_HTML } from '../utils/helpers.js'; 
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_Cards } from '../ia/prompt-builder.js';
import { getH5PLocalization } from '../utils/h5p-translations.js';
import { getCardsState, setCardsState } from '../utils/states/cards-state.js';
import { SourceSelector } from './source-selector.js';

let localSourceSelector = null;
let currentRepartition = {};

let container = null;
let corpus = '';
let updateGenerateButtonCallback = () => {};

// Stockage des fichiers médias
let cardImages = new Map();
let cardAudios = new Map(); 
let cardCounter = 0;

let mediaRecorder = null;
let audioChunks = [];
let currentRecordingCardId = null;

// --- UTILITAIRES ---

async function translateToEnglish(text) {
    if (!text) return '';
    try {
        const promptSysteme = `Translate the following text to English. 
Reply ONLY with the translation, no explanation, no quotes.
Text: ${text}`;

        let translated = '';
        if (window.parent && typeof window.parent.makeNonStreamingRequest === 'function') {
            translated = await window.parent.makeNonStreamingRequest(promptSysteme, {
                tool: 'professor'
            });
        } else {
            const response = await fetch((typeof window !== 'undefined' ? window.location.origin : '') + "/proxy-n8n/webhook/hapi_albert", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: promptSysteme })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            translated = data.response 
                || data.text 
                || data.output
                || data.choices?.[0]?.message?.content
                || data.choices?.[0]?.text;
        }
        
        if (!translated || translated.trim().length < 2) throw new Error("Réponse vide");

        // 🛡️ Détection : Albert répond en chatbot au lieu de traduire
        const isChatbotResponse = translated.length > text.length * 4
            || translated.includes("Comment puis-je")
            || translated.includes("n'hésite pas")
            || translated.includes("Je suis là pour");
        
        if (isChatbotResponse) throw new Error("Réponse chatbot détectée");
        
        return translated.trim();
        
    } catch (e) { 
        return text; // Fallback silencieux : FLUX gère le français
    }
}

// ==========================================
// 🎨 SYSTÈME MULTI-API IMAGES (OPTIMISÉ)
// ==========================================

const IMAGE_SERVICES = {
    n8n: {
        name: 'n8n Image Generator',
        // ✅ On utilise l'URL du Webhook n8n de production
        getURL: (prompt) => (typeof window !== 'undefined' ? window.location.origin : '') + `/proxy-n8n/webhook/hapi-image?prompt=${encodeURIComponent(prompt)}`,
        enabled: true 
    }
};

async function generateImageWithFallback(prompt) {
    const seed = Math.floor(Math.random() * 99999);
    
    // ✅ On vérifie maintenant IMAGE_SERVICES.n8n (et plus .worker)
    if (IMAGE_SERVICES.n8n && IMAGE_SERVICES.n8n.enabled) {
        console.log(`Appel Direct n8n:`, IMAGE_SERVICES.n8n.name);
        return { 
            url: IMAGE_SERVICES.n8n.getURL(prompt), 
            service: 'n8n' 
        };
    }
    
    // Fallback de secours si n8n est désactivé
    return { 
        url: localPlaceholder(prompt.substring(0,25), {w:300,h:300,bg:'#1e293b',fg:'#cbd5e1'}), 
        service: 'placeholder',
        error: true 
    };
}

// ==========================================

function openLightbox(imgData, card) {
    const modal = document.createElement('div');
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; font-family:sans-serif;";
    modal.innerHTML = `
        <div style="background:var(--surface); max-width:1000px; width:95%; border-radius:12px; overflow:hidden; position:relative; display:flex; flex-direction:column; max-height:90vh;">
            <button id="close-light" style="position:absolute; top:15px; right:15px; background:var(--surface); border:none; font-size:24px; cursor:pointer; z-index:10; border-radius:50%; width:40px; height:40px; box-shadow:0 2px 10px rgba(0,0,0,0.2);">✕</button>
            <div style="flex:1; background:#000; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                <img src="${imgData.full}" crossorigin="anonymous" style="max-width:100%; max-height:100%; object-fit:contain;">
            </div>
            <div style="padding:20px; background:var(--surface); display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                <div style="max-width:70%;">
                    <h4 style="margin:0 0 5px 0; color:var(--text);">${imgData.title}</h4>
                    <p style="margin:0; font-size:0.85em; color:var(--text-muted);"><strong>Auteur:</strong> ${imgData.artist} | <strong>Licence:</strong> ${imgData.license}</p>
                </div>
                <button id="select-this-img" style="background:var(--hapi-grad-a); color:#fff; border:none; padding:12px 25px; border-radius:30px; font-weight:bold; cursor:pointer;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Sélectionner</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#close-light').onclick = () => modal.remove();
    
    modal.querySelector('#select-this-img').onclick = () => {
        const previewImg = card.querySelector('.wiki-img-preview');
        const previewZone = card.querySelector('.wiki-selected-preview');
        const creditsDiv = card.querySelector('.wiki-img-credits');

        previewImg.src = imgData.full;
        previewImg.dataset.credit = `${imgData.artist} (${imgData.license})`;
        creditsDiv.innerText = `Crédit : ${imgData.artist}`;
        previewZone.style.display = 'block';

        updateGenerateButtonCallback();
        checkStatus();
        modal.remove();
    };
}

async function searchWikimedia(query) {
    if (!query || query.length < 2) return [];
    const endpoint = "https://commons.wikimedia.org/w/api.php";
    
    const params = new URLSearchParams({
        action: "query", 
        generator: "search", 
        gsrnamespace: "6", 
        gsrsearch: `${query} filetype:bitmap`, 
        gsrlimit: "15", 
        prop: "imageinfo", 
        iiprop: "url|extmetadata", 
        iiurlwidth: "400", 
        format: "json", 
        origin: "*" 
    });

    try {
        const response = await fetch(`${endpoint}?${params.toString()}`);
        const data = await response.json();
        if (!data.query || !data.query.pages) return [];

        return Object.values(data.query.pages).map(page => {
            if (!page.imageinfo || !page.imageinfo[0]) return null;
            const info = page.imageinfo[0];
            const meta = info.extmetadata || {};
            const title = page.title.replace("File:", "");

            const forbiddenExt = ['.pdf', '.djvu', '.ogv', '.webm'];
            if (forbiddenExt.some(ext => title.toLowerCase().endsWith(ext))) return null;

            return {
                thumb: info.thumburl,
                full: info.url,
                title: title,
                artist: meta.Artist ? meta.Artist.value.replace(/<\/?[^>]+(>|$)/g, "") : "Inconnu",
                license: meta.LicenseShortName ? meta.LicenseShortName.value : "CC BY-SA"
            };
        }).filter(item => item !== null);
    } catch (e) { return []; }
}

function imageToBase64(imgElement) {
    try {
        if (!imgElement || !imgElement.src || imgElement.naturalWidth === 0) return null;
        if (imgElement.src.startsWith('data:image')) return imgElement.src;
        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth || 300;
        canvas.height = imgElement.naturalHeight || 300;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);
        const dataURL = canvas.toDataURL('image/jpeg', 0.85);
        return (dataURL.length > 100 && dataURL.includes('base64')) ? dataURL : null;
    } catch (e) { return null; }
}

function base64ToFile(dataurl, filename) {
    try {
        var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--) u8arr[n] = bstr.charCodeAt(n);
        return new File([u8arr], filename, {type:mime});
    } catch(e) { return null; }
}

const cleanText = (text) => text ? text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').trim() : "";

const extractTextAndTips = (rawText, manualTip, side) => {
    let text = rawText || "";
    let extractedTip = "";
    const regex = /(?:\n|^)(?:[\*\s]*)(IndiceAvant|IndiceArri[eè]re|IndiceArriere|Indice|Tip)(?:[\*\s]*)\s*:\s*(.*)/gi;

    text = text.replace(regex, (match, label, content) => {
        const l = label.toLowerCase();
        content = content.trim();
        if (side === 'front') {
            if (l.includes('avant') || l === 'indice' || l === 'tip') extractedTip = content;
        } else if (side === 'back') {
            if (l.includes('arri') || l === 'indice' || l === 'tip') extractedTip = content;
        }
        return ""; 
    });
    return { text: cleanText(text), tip: cleanText(manualTip || extractedTip) };
};

async function convertBlobToWavFile(blob, fileName) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i, sample, offset = 0, pos = 0;

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); 
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt "
    setUint32(16); 
    setUint16(1); 
    setUint16(numOfChan);
    setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16); 
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    for (i = 0; i < audioBuffer.numberOfChannels; i++) channels.push(audioBuffer.getChannelData(i));

    while (pos < audioBuffer.length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][pos])); 
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; 
            view.setInt16(44 + offset, sample, true); 
            offset += 2;
        }
        pos++;
    }

    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

    const wavBlob = new Blob([buffer], { type: 'audio/wav' });
    return new File([wavBlob], fileName.replace(/\.[^/.]+$/, "") + ".wav", { type: 'audio/wav' });
}

// --- INITIALISATION UI ---

export function init(targetContainer, corpusContent, updateBtnCallback) {
    container = targetContainer;
    corpus = corpusContent;
    updateGenerateButtonCallback = updateBtnCallback;
    cardImages.clear();
    cardAudios.clear();
    cardCounter = 0;
    
    logger.log('🔧 Initialisation Cards UI...');

    const rawSources = corpusManager.getCorpusSources();
    const documentsList = [
        { id: 'all', title: 'Tout le corpus (Hybride)', content: corpusContent, type: 'all', priority: 2 },
        ...rawSources.map(s => ({
            id: s.id,
            title: s.name,
            content: s.data || s.content || corpusContent,
            type: s.type,
            priority: s.priority !== undefined ? s.priority : 2
        }))
    ];

    const html = `
        <style>
            .cards-styled-file-input::file-selector-button { border-radius: 18px; padding: 6px 16px; margin-right: 12px; border: none; background: var(--hapi-green-dark); color: white; font-weight: 600; cursor: pointer; }
            .cards-styled-file-input { width: 100%; color: var(--text-muted); }
            .audio-btn { border:none; padding:8px 16px; border-radius:20px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition: all 0.2s; }
            .audio-btn-record { background: var(--hapi-green-mist); color: var(--hapi-accent-text); border:1px solid var(--hapi-grad-a); }
            .audio-btn-stop { background:#475569; color:white; }
            .recording-active { animation: pulse-red 1.5s infinite; background: #b91c1c; color: white; border-color: #7f1d1d; }
            @keyframes pulse-red { 0% { transform: scale(1); } 70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { transform: scale(1); } }
            .char-counter { font-size:0.75em; text-align:right; color:var(--text-muted); margin-top:2px; }
            .img-tabs-container { display: flex; gap: 15px; margin-bottom: 15px; background: var(--hapi-green-mist); padding: 8px; border-radius: 12px; border: 1px solid var(--border-strong); }
            .img-tab-btn { flex: 1; border: 2px solid transparent; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 700; color: var(--text-muted); background: var(--surface); display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; }
            .img-tab-btn:hover { transform: translateY(-1px); }
            .img-tab-btn.active { border-color: var(--hapi-grad-a); color: var(--hapi-accent-text); background: var(--hapi-green-mist); }
            .media-section { border: 1px solid var(--border); border-radius: 8px; padding: 15px; margin-bottom: 15px; background: var(--page-bg); }
            .media-section-title { font-size: 0.9em; font-weight: bold; color: var(--text); margin-bottom: 10px; display: block; letter-spacing: 0.5px; }
            .img-panel { animation: fadeIn 0.3s ease; }
            @keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
            .btn-remove-img-txt { background: transparent; color: var(--text); border: 1px solid var(--border); padding: 5px 10px; border-radius: 6px; font-size: 0.85em; cursor: pointer; display: flex; align-items: center; gap: 5px; margin-top: 5px; }
            .btn-remove-img-txt:hover { background: var(--border); }
        </style>
        
        <div id="cards-generator-wrapper">
            <div class="section" style="background:var(--surface); padding:25px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                
                <div id="cards-source-selector"></div>
                <div id="cards-questions-repartition"></div>

                <h2 style="margin:0 0 15px 0;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configuration des cartes</h2>
               
                <div style="display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 20px;">
                    <div class="input-group" style="margin: 0 0;">
                        <label style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Mode d'apprentissage :</label>
                        <div style="display: flex; gap: 20px; margin-top: 5px; padding: 10px; background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px;">
                            <label style="cursor:pointer; display:flex; align-items:center;"><input type="radio" name="cards-mode" value="dialog" checked style="transform: scale(1.2); margin-right: 8px;"> <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg> Révision (Dialogcards)</label>
                            <label style="cursor:pointer; display:flex; align-items:center;"><input type="radio" name="cards-mode" value="flash" style="transform: scale(1.2); margin-right: 8px;"> <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Exercice (Flashcards)</label>
                        </div>
                    </div>
                    <div class="input-group" style="margin: 0 0;">
                        <label for="cards-title" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Titre de l'activité :</label>
                        <input type="text" id="cards-title" value="Activité de révision" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div class="input-group" style="margin: 0 0;">
                        <label for="cards-task" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Consigne pour l'élève :</label>
                        <input type="text" id="cards-task" value="Lisez la face avant puis retournez la carte pour vérifier votre réponse." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                </div>

                <div class="input-group" style="padding: 15px; border-radius: 6px; border: 1px solid var(--border-strong); background: var(--hapi-green-mist); margin-bottom: 20px; margin: 0 0;">
                    <label style="display:block; font-weight:bold; margin-bottom:10px; color: var(--hapi-accent-text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Paramètre pour l'IA :</label>
                    <label style="display:flex; align-items:center; cursor:pointer; font-weight:600; color: var(--hapi-accent-text);">
                        <input type="checkbox" id="cards-generate-tips" checked style="transform: scale(1.2); margin-right: 10px; accent-color: var(--hapi-green);">
                        Générer des indices (textes) pour aider l'élève à trouver la réponse
                    </label>
                </div>

                <div id="prepare-action-cards" style="margin-top: 35px; text-align: center;">
                    <button id="btn-prepare-prompt-cards" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt
                    </button>
                </div>
            </div>

            <div id="ia-container-cards" class="section" style="display: none; background: var(--surface); border-radius: 8px; padding: 12px 25px 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                ${creerAssistantIA_HTML('ia-prompt-cards', 'ia-response-cards')}
            </div>
            
            <div id="albert-action-cards" style="display: none; text-align: center; margin-top: 15px; margin-bottom: 30px;">
                <button id="btn-send-albert-cards" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                    🇫🇷 Envoyer le prompt à l'IA
                </button>
            </div>

            <div class="section" id="cards-preview-section" style="display:none; margin-top:20px; background:var(--surface); padding:25px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                <div style="border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="margin:0; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg> Liste des cartes</h2>
                    <p id="cards-status-indicator" style="font-weight:bold; color:#e11d48; font-size:0.9em;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> Il faut au moins une carte remplie pour générer.</p>
                </div>
                
                <div id="cards-list"></div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn" id="btn-add-card" style="background:#6c757d; color:white; padding:10px 20px; border-radius:25px; border:none; font-weight:bold; cursor:pointer;">+ Ajouter une carte</button>
                </div>

                <div id="cards-options-section" class="input-group" style="margin-top: 40px;">
                    <details style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px;">
                        <summary style="font-weight:bold; font-size:1.2em; color:var(--text); cursor:pointer; outline:none; list-style-position: inside;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options globales
                        </summary>
                        <div style="margin-top: 20px;">
                            <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px; margin-bottom: 20px;">
                                <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Paramètres du mode
                                </div>
                                <div id="cards-dynamic-options" style="display: flex; flex-direction: column; gap: 10px;">
                                    </div>
                            </div>
                            <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px;">
                                <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options supplémentaires
                                </div>
                                <div style="display:flex; flex-direction:column; gap:20px;">
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="translate-ui-cards" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                        <span style="font-weight:bold; font-size:1.05em; color: var(--hapi-accent-text);">Traduire les boutons H5P</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
            </div>
        </div>`;
    
    container.innerHTML = html;

	const selectorContainer = container.querySelector('#cards-source-selector');
	    if (selectorContainer) {
	        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'cards', (selectedDocs) => {
	            renderRepartitionConfigCards(selectedDocs);
	            showRegenerateButton(); // 🔄 Relance si la source change
	        });
	    }

	// 1. Écouteurs sur les paramètres GLOBAUX (Niveau et Langue)
	// 1. Écoute des paramètres globaux de base
	    const niveauSelect = document.getElementById('global-niveau');
	    if (niveauSelect) niveauSelect.addEventListener('change', showRegenerateButton);

	    const langSelect = document.getElementById('global-language');
	    if (langSelect) langSelect.addEventListener('change', showRegenerateButton);

	    // 2. 🟢 Écoute complète de la cascade RAG BOEN
	    const ragElements = [
	        'toggle-rag-boen', 'standalone-niveau',     // La case à cocher d'activation du RAG
	        'global-scolarite',    // 1er menu
	        'global-cycle-voie',   // 2ème menu
	        'global-discipline'    // 4ème menu
	    ];

	    ragElements.forEach(id => {
	        const el = document.getElementById(id);
	        if (el) el.addEventListener('change', showRegenerateButton);
	    });

	    // 2. Écouteur sur la case à cocher des indices IA
	    const tipsCheckbox = container.querySelector('#cards-generate-tips');
	    if (tipsCheckbox) tipsCheckbox.addEventListener('change', showRegenerateButton);

	    // 3. Écouteur sur la répartition (Nombre de cartes par source)
	    const repartitionContainer = container.querySelector('#cards-questions-repartition');
	    if (repartitionContainer) {
	        repartitionContainer.addEventListener('input', (e) => {
	            if (e.target.classList.contains('source-question-count')) {
	                showRegenerateButton();
	            }
	        });
	    }

    // Événements boutons IA / Ajout
    document.getElementById('btn-prepare-prompt-cards').addEventListener('click', handlePreparePrompt);
    document.getElementById('btn-send-albert-cards').addEventListener('click', handleGenerateAlbertCards);
    document.getElementById('btn-parse-ia-response-cards').addEventListener('click', handleParseIA);
    document.getElementById('btn-add-card').addEventListener('click', () => {
        addCardItem();
        checkStatus();
    });
	
    document.querySelectorAll('input[name="cards-mode"]').forEach(r => r.addEventListener('change', handleModeChange));

    updateUIForMode();

    // 🔴 BOUCLIER ANTI-BARRE DU BAS
    const enforceHideBottomBar = () => {
        const genSection = document.getElementById('generate-section');
        const cardsCount = document.querySelectorAll('#cards-list .card').length;
        if (genSection && cardsCount < 1) {
            genSection.style.display = 'none';
        }
    };

    enforceHideBottomBar();
    setTimeout(enforceHideBottomBar, 50);

    const tabBtn = document.querySelector('.tab-btn[data-tab-target="cards"]');
    if (tabBtn) {
        tabBtn.addEventListener('click', () => setTimeout(enforceHideBottomBar, 10));
    }
}

function handleModeChange(e) {
    const list = document.getElementById('cards-list');
    
    if (list && list.children.length > 0) {
        const confirmSwitch = confirm("⚠️ Attention : Changer de mode va supprimer toutes les cartes actuelles et réinitialiser l'activité.\n\nVoulez-vous continuer ?");
        if (!confirmSwitch) {
            e.preventDefault(); 
            const previousMode = e.target.value === 'dialog' ? 'flash' : 'dialog';
            const prevRadio = document.querySelector(`input[name="cards-mode"][value="${previousMode}"]`);
            if(prevRadio) prevRadio.checked = true;
            return;
        }
    }

    logger.log("🧹 Changement de mode : Purge complète.");
    
    if (list) list.innerHTML = ''; 
    cardImages.clear();            
    cardAudios.clear();            
    cardCounter = 0;               

    const iaResponse = document.getElementById('ia-response-cards');
    if(iaResponse) iaResponse.value = '';
    
    const iaPrompt = document.getElementById('ia-prompt-cards');
    if(iaPrompt) iaPrompt.value = '';

    const iaSection = document.getElementById('ia-container-cards');
    if(iaSection) iaSection.style.display = 'none';

    const prepareAction = document.getElementById('prepare-action-cards');
    if(prepareAction) prepareAction.style.display = 'block';

    const albertAction = document.getElementById('albert-action-cards');
    if(albertAction) albertAction.style.display = 'none';

    const btnPrepare = document.getElementById('btn-prepare-prompt-cards');
    if(btnPrepare) {
        btnPrepare.disabled = false;
        btnPrepare.innerHTML = `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt`;
    }

    const previewSection = document.getElementById('cards-preview-section');
    if (previewSection) previewSection.style.display = 'none';

    let genSection = document.getElementById('generate-section');
    if (genSection) {
        genSection.style.display = 'none';
        const alerts = genSection.querySelectorAll('div');
        alerts.forEach(el => {
            const style = window.getComputedStyle(el);
            if (el.innerText.includes('est prêt') || style.backgroundColor === 'rgb(209, 231, 221)' || style.color === 'rgb(15, 81, 50)') {
                el.remove();
            }
        });
    }

    const h5pPreview = document.getElementById('h5p-preview-container');
    if (h5pPreview) h5pPreview.innerHTML = '';
    
    const orphanAlerts = document.querySelectorAll('.alert-success, #generation-results');
    orphanAlerts.forEach(el => el.innerHTML = '');

    updateUIForMode();
    checkStatus();
}

function updateUIForMode() {
    const mode = document.querySelector('input[name="cards-mode"]:checked').value;
    const optionsContainer = document.getElementById('cards-dynamic-options');
    const taskInput = document.getElementById('cards-task');

    if (mode === 'dialog') {
        if(taskInput) taskInput.value = "Lisez la face avant puis retournez la carte pour vérifier votre réponse.";
        
        if (optionsContainer) {
            optionsContainer.innerHTML = `
                <div style="margin-bottom:10px; color:var(--text-muted); font-style:italic; font-size:0.9em;">(Bouton recommencer activé par défaut)</div>
                <label style="display:flex; align-items:center; cursor:pointer; margin-bottom: 8px;"><input type="checkbox" id="opt-disable-back" style="margin-right:8px; width:16px; height:16px;"> Désactiver le bouton retour arrière</label>
                <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" id="opt-random" style="margin-right:8px; width:16px; height:16px;"> Mélanger les cartes</label>
            `;
        }
    } else {
        if(taskInput) taskInput.value = "Lisez la face avant, saisissez votre réponse dans le champ, puis vérifiez.";
        
        if (optionsContainer) {
            optionsContainer.innerHTML = `
                <div style="margin-bottom:10px; color:var(--text-muted); font-style:italic; font-size:0.9em;">(Saisie texte obligatoire activée)</div>
                <label style="display:flex; align-items:center; cursor:pointer; margin-bottom: 8px;"><input type="checkbox" id="opt-case-sensitive" style="margin-right:8px; width:16px; height:16px;"> Rendre la saisie sensible à la casse (majuscules/minuscules)</label>
                <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" id="opt-random" style="margin-right:8px; width:16px; height:16px;"> Mélanger les cartes</label>
            `;
        }
    }
    updateGenerateButtonCallback();
}

function renderRepartitionConfigCards(selectedDocs) {
    const repContainer = container.querySelector('#cards-questions-repartition');
    if (!repContainer) return;

    container.querySelectorAll('.source-question-count').forEach(input => {
        currentRepartition[input.dataset.sourceId] = parseInt(input.value, 10);
    });

    if (!selectedDocs || selectedDocs.length === 0) {
        repContainer.innerHTML = '';
        return;
    }

    const getDocIcon = (doc) => {
        if (doc.type === 'text') return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
        const name = (doc.title || '').toLowerCase();
        if (name.endsWith('.pdf')) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
        if (name.match(/\.(doc|docx|odt)$/)) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
        if (name.match(/\.(ppt|pptx|odp)$/)) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
        if (name.endsWith('.txt')) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>';
        if (name.match(/\.(jpe?g|png)$/)) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
        return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
    };

    let html = `
        <div style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px; margin-top: 10px; max-height: 250px; overflow-y: auto;">
            <label style="display:flex; justify-content:space-between; align-items:center; font-size: 0.95em; font-weight:bold; margin-bottom:12px; color:var(--text);">
                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Répartition des cartes à générer</span>
            </label>
    `;

    selectedDocs.forEach(doc => {
        let defaultCount = doc.priority === 3 ? 6 : (doc.priority === 2 ? 4 : 2);
        const val = currentRepartition[doc.id] !== undefined ? currentRepartition[doc.id] : defaultCount;
        currentRepartition[doc.id] = val;

        const icon = getDocIcon(doc);

        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed var(--border);">
                <span style="font-size: 0.9em; color: var(--text-muted); display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 75%;" title="${doc.title}">
                    <span>${icon}</span> <span style="overflow: hidden; text-overflow: ellipsis;">${doc.title}</span>
                </span>
                <input type="number" class="source-question-count" data-source-id="${doc.id}" value="${val}" min="0" max="30" style="width: 60px; padding: 4px; border: 1px solid var(--border); border-radius: 4px; text-align: center; font-weight: bold; color: var(--text);">
            </div>
        `;
    });

    html += `</div>`;
    repContainer.innerHTML = html;
}

async function handlePreparePrompt() {
    const btn = document.getElementById('btn-prepare-prompt-cards');
    
    // 🟢 On force le texte par défaut
    const originalText = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt';
    
    btn.disabled = true; 
    btn.innerHTML = 'Analyse...';
    
    const repartitionMap = {};
    container.querySelectorAll('.source-question-count').forEach(input => {
        const id = input.dataset.sourceId;
        const val = parseInt(input.value, 10);
        if (!isNaN(val) && val >= 0) repartitionMap[id] = val;
    });

    if (Object.keys(repartitionMap).length === 0) {
        alert("Aucune source valide sélectionnée.");
        btn.disabled = false;
        btn.innerHTML = originalText;
        return;
    }

    const mode = document.querySelector('input[name="cards-mode"]:checked').value;
    const tipsChecked = document.getElementById('cards-generate-tips')?.checked || false;

    const success = await preparerAssistantIA_Cards(repartitionMap, tipsChecked, mode);
    
    if (success) {
        // 🟢 NOUVEAU : On cache le conteneur parent du bouton de manière sécurisée et standardisée
        if (btn.parentElement) {
            btn.parentElement.style.display = 'none';
        }

        const iaContainer = document.getElementById('ia-container-cards');
        if (iaContainer) {
            iaContainer.style.display = 'block';
            const promptArea = document.getElementById('ia-prompt-cards');
            if (promptArea) {
                promptArea.removeAttribute('readonly'); 
                promptArea.disabled = false;
                promptArea.style.backgroundColor = 'var(--field-bg)'; 
                promptArea.style.border = '2px solid var(--hapi-green)';
            }
        }
        
        const albertAction = document.getElementById('albert-action-cards');
        if (albertAction) albertAction.style.display = 'block';

        setTimeout(() => {
            const iaContainerToScroll = document.getElementById('ia-container-cards');
            if (iaContainerToScroll) iaContainerToScroll.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
    
    // 🟢 On réinitialise l'état et le texte pour la prochaine fois
    btn.disabled = false; 
    btn.innerHTML = originalText;
}

async function handleGenerateAlbertCards() {
    const btn = document.getElementById('btn-send-albert-cards');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "L'IA crée les cartes...";

    await callAlbertAPI('ia-prompt-cards', 'ia-response-cards', 'btn-parse-ia-response-cards', btn);

    btn.innerHTML = originalText;
    btn.disabled = false;
}


function parseIACardsLocal(text) {
    if (!text) return [];
    
    return text.split('---o---').map(block => {
        block = block.trim();
        if (!block) return null;

        const qMatch = block.match(/Q:\s*([\s\S]*?)\s*(?=R:|$)/i);
        const rMatch = block.match(/R:\s*([\s\S]*?)\s*(?=(?:Indice|MotCléImage|---o---|$))/i);
        const iAvantMatch = block.match(/IndiceAvant:\s*([\s\S]*?)\s*(?=(?:IndiceArri[eè]re|MotCléImage|---o---|$))/i);
        const iArriereMatch = block.match(/IndiceArri[eè]re:\s*([\s\S]*?)\s*(?=(?:MotCléImage|---o---|$))/i);
        const imgMatch = block.match(/MotCléImage:\s*([\s\S]*?)\s*(?=(?:Indice|---o---|$))/i);

        if (qMatch && rMatch) {
            return { 
                question: qMatch[1].trim(), 
                reponse: rMatch[1].trim(), 
                indiceAvant: iAvantMatch ? iAvantMatch[1].trim() : '', 
                indiceArriere: iArriereMatch ? iArriereMatch[1].trim() : '',
                imagePrompt: imgMatch ? imgMatch[1].trim() : ''
            };
        }
        return null;
    }).filter(x => x);
}

function handleParseIA() {
    const items = parseIACardsLocal(document.getElementById('ia-response-cards').value);
    if (!items.length) return alert("Aucune carte trouvée.");
    
    document.getElementById('cards-list').innerHTML = '';
    
    const previewSection = document.getElementById('cards-preview-section');
    if (previewSection) {
        previewSection.style.display = 'block';
        previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    items.forEach(i => addCardItem(i.question, i.reponse, { front: i.indiceAvant, back: i.indiceArriere }, i.imagePrompt));
    
    const isDialog = document.querySelector('input[name="cards-mode"]:checked').value === 'dialog';
    document.querySelectorAll('.media-section-audio').forEach(el => el.style.display = isDialog ? 'block' : 'none');
    document.querySelectorAll('.tip-wrapper-back').forEach(el => el.style.display = isDialog ? 'block' : 'none');

    const genSection = document.getElementById('generate-section');
    if (genSection) genSection.style.display = 'block';
    
    updateGenerateButtonCallback();
    checkStatus();
}

function addCardItem(q = '', a = '', tips = { front: '', back: '' }, iaImagePrompt = '') {
    cardCounter++;
    const cardId = `card-unique-${cardCounter}`;
    const MAX_CHARS = 150;
    
    const div = document.createElement('div');
    div.className = 'card';
    div.id = cardId;
    div.style.cssText = "background:var(--surface); border:1px solid var(--border); padding:15px; margin-bottom:15px; border-radius:6px; border-left:4px solid var(--hapi-green); color: var(--text);";

    const inputStyle = "width:100%; border:1px solid var(--border); border-radius:4px; color: var(--text); background: var(--surface); padding: 8px; font-family: inherit; resize:vertical;";

div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;">
            <strong style="color: var(--hapi-accent-text); font-size:1.1em;">Carte #${cardCounter}</strong>
            <button class="btn-del-card" style="border:none; background:transparent; cursor:pointer; font-size:1.2em;" title="Supprimer"></button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
            <div>
                <label style="font-weight:bold; display:block; margin-bottom:5px;">Face Avant</label>
                <textarea class="card-front" maxlength="${MAX_CHARS}" rows="2" style="${inputStyle}"></textarea>
                <div class="char-counter">0/${MAX_CHARS}</div>
                <input type="text" class="card-tip-front" placeholder="Indice Avant" style="${inputStyle} margin-top:5px;">
            </div>
            <div>
                <label style="font-weight:bold; display:block; margin-bottom:5px;">Face Arrière</label>
                <textarea class="card-back" maxlength="${MAX_CHARS}" rows="2" style="${inputStyle}"></textarea>
                <div class="char-counter">0/${MAX_CHARS}</div>
                <div class="tip-wrapper-back" style="display:none;">
                    <input type="text" class="card-tip-back" placeholder="Indice Arrière" style="${inputStyle} margin-top:5px;">
                </div>
            </div>
        </div>

        <div class="media-section media-section-image">
            <div class="media-section-header" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; color: var(--text);">
                <span class="media-section-title" style="margin:0;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg> Image (optionnel)</span>
                <span class="toggle-icon">▼</span>
            </div>
            
            <div class="media-content" style="display:none; margin-top:15px; border-top:1px solid var(--border); paddingTop:10px;">
                <input type="hidden" class="img-mode-value" value="upload"> 
                
                <div class="img-tabs-container">
                    <button class="img-tab-btn active" data-target="upload"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9l-.83-1.2A2 2 0 0 0 7.9 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg></span> Importer un fichier</button>
					<button class="img-tab-btn" data-target="wiki"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg></span> Wikimedia</button>
                    <button class="img-tab-btn" data-target="ia"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></span> Générer par IA</button>
                </div>

				<div class="img-panel panel-img-wiki" style="display:none;">
    				<div style="display:flex; gap:8px; margin-bottom:8px;">
       	 				<input type="text" class="wiki-search-input" placeholder="Chercher sur Wikimedia..." style="${inputStyle} flex:1;">
        				<button class="btn-wiki-search" style="background:var(--hapi-green-dark); color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>
    				</div>
    			<div class="wiki-results-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; max-height:400px; overflow-y:auto; background:var(--surface); padding:5px; border:1px solid var(--border); border-radius:6px;">
        			<p style="grid-column:1/-1; text-align:center; font-size:0.8em; color:var(--text-muted);">Entrez un mot-clé pour rechercher.</p>
    			</div>
				<div class="wiki-selected-preview" style="display:none; margin-top:10px; text-align:center; padding:10px; background:var(--page-bg); border-radius:8px; border:1px solid var(--border);">
    				<img class="wiki-img-preview" crossorigin="anonymous" style="height:100px; border-radius:6px; margin-bottom:5px;">
    					<div class="wiki-img-credits" style="font-size:0.75em; color:var(--text-muted); font-weight:600;"></div>
    				<button class="btn-remove-wiki-img" style="margin-top:8px; background:transparent; color:var(--text); border:none; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.8em; font-weight:bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg> Retirer cette image</button>
				</div>
				</div>

                <div class="img-panel panel-img-ia" style="display:none;">
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <input type="text" class="ia-prompt-input" placeholder="Prompt pour décrire l'image..." style="${inputStyle} flex:1;">
                        <button class="btn-generate-ia" style="background:var(--hapi-grad-a); color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:bold;">Générer</button>
                    </div>

					<div style="background:var(--hapi-green-mist); border:1px solid var(--border-strong); color: var(--hapi-accent-text); padding:15px; border-radius:8px; font-size:0.85em; margin-bottom:20px; display:flex; gap:12px; align-items:start; line-height:1.5;">
                        <span style="font-size:1.5em; flex-shrink:0;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5A7 7 0 1 0 5 9c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/></svg></span>
                        <div>
                            <strong style="color: var(--hapi-accent-text); display:block; margin-bottom:4px;">Information "Image IA"</strong> 
                            L’application utilise un système gratuit multi-API de génération d’images. Il convient de l’utiliser à bon escient.
							<span style="font-weight:600; text-decoration-color:var(--hapi-green-light);">Privilégiez un usage frugal !</span>
                            <br>
                            Cliquez sur le bouton <strong>« Générer »</strong> pour obtenir une image. Vous pouvez modifier le prompt et générer à nouveau.
                            <br>
                            <em style="color: var(--hapi-accent-text);">Note : Les délais de traitement peuvent varier. Pour un fonctionnement optimal, veuillez générer les images les unes après les autres.</em>
                        </div>
                    </div>
	
                    <div style="position:relative; width:100%; height:200px; background:var(--border); border-radius:6px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                        <img class="ia-generated-img" crossorigin="anonymous" style="max-width:100%; max-height:100%; display:none;">
                        <span class="ia-placeholder" style="color:var(--text-muted);">Cliquez sur Générer...</span>
                        <button class="btn-delete-ia-img" style="display:none; position:absolute; top:5px; right:5px; background:rgba(255,255,255,0.9); color:var(--text); border:none; border-radius:50%; width:30px; height:30px; cursor:pointer; font-size:1.2em; box-shadow:0 2px 4px rgba(0,0,0,0.2);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
                    </div>
                </div>		
				
                <div class="img-panel panel-img-upload" style="display:block;">
                     <div style="display:flex; align-items:center; gap:10px;">
                        <input type="file" class="card-img-upload cards-styled-file-input" accept="image/*" style="color: var(--text);">
                    </div>
                    <div class="img-preview-container" style="margin-top:5px;"></div>
                </div>
            </div>
        </div>

        <div class="media-section media-section-audio" style="display:none;">
            <div class="media-section-header-audio" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; color: var(--text);">
                <span class="media-section-title" style="margin:0;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg> Audio (optionnel)</span>
                <span class="toggle-icon-audio">▼</span>
            </div>

            <div class="media-content-audio" style="display:none; margin-top:15px; border-top:1px solid var(--border); paddingTop:10px;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
                    <div style="background:var(--surface); padding:10px; border-radius:6px; border:1px solid var(--border);">
                        <strong style="display:block; margin-bottom:5px; font-size:0.85em; color: var(--text);">Enregistrement</strong>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <button class="btn-record audio-btn audio-btn-record">Enregistrer</button>
                            <button class="btn-stop audio-btn audio-btn-stop" disabled><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1"/></svg> Stop</button>
                        </div>
                        <div class="audio-record-preview" style="margin-top:8px;"></div>
                    </div>
                    <div style="background:var(--surface); padding:10px; border-radius:6px; border:1px solid var(--border);">
                        <strong style="display:block; margin-bottom:5px; font-size:0.85em; color: var(--text);">Ou importer un fichier</strong>
                        <input type="file" class="card-audio-upload cards-styled-file-input" accept="audio/*" style="color: var(--text);">
                        <div class="audio-upload-preview" style="margin-top:8px;"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

// --- LOGIQUE METIER CARTE ---

    div.querySelector('.card-front').value = q || '';
    div.querySelector('.card-back').value = a || '';
    div.querySelector('.card-tip-front').value = tips?.front || '';
    div.querySelector('.card-tip-back').value = tips?.back || '';
    div.querySelector('.ia-prompt-input').value = iaImagePrompt || q || ''; 

    const togglePanel = (header, content, icon) => {
        header.addEventListener('click', () => {
            const isClosed = content.style.display === 'none';
            content.style.display = isClosed ? 'block' : 'none';
            icon.style.transform = isClosed ? 'rotate(180deg)' : 'rotate(0deg)';
        });
    };
    togglePanel(div.querySelector('.media-section-header'), div.querySelector('.media-content'), div.querySelector('.toggle-icon'));
    togglePanel(div.querySelector('.media-section-header-audio'), div.querySelector('.media-content-audio'), div.querySelector('.toggle-icon-audio'));

    const updateCount = (t) => t.nextElementSibling.innerText = `${t.value.length}/${MAX_CHARS}`;
    div.querySelectorAll('textarea').forEach(t => {
        t.addEventListener('input', () => {
            updateCount(t);
            updateGenerateButtonCallback();
            checkStatus();
        });
    });
    div.querySelectorAll('textarea').forEach(t => updateCount(t));

    const promptInput = div.querySelector('.ia-prompt-input');
    const hiddenMode = div.querySelector('.img-mode-value');

    // --- GESTION DES ONGLETS ---
    div.querySelectorAll('.img-tab-btn').forEach(b => b.addEventListener('click', () => {
        div.querySelectorAll('.img-tab-btn').forEach(btn => btn.classList.remove('active'));
        b.classList.add('active');
        
        const target = b.dataset.target;
        hiddenMode.value = target;

        div.querySelector('.panel-img-upload').style.display = target === 'upload' ? 'block' : 'none';
        div.querySelector('.panel-img-ia').style.display = target === 'ia' ? 'block' : 'none';
        div.querySelector('.panel-img-wiki').style.display = target === 'wiki' ? 'block' : 'none';

        if (target === 'wiki') {
            const wikiInput = div.querySelector('.wiki-search-input');
            const autoQuery = div.querySelector('.ia-prompt-input').value || div.querySelector('.card-front').value;
            
            if (autoQuery && !wikiInput.value) {
                wikiInput.value = autoQuery;
                div.querySelector('.btn-wiki-search').click();
            }
        }
    }));

  
// --- LOGIQUE WIKIMEDIA ---
    const wikiInput = div.querySelector('.wiki-search-input');
    const wikiGrid = div.querySelector('.wiki-results-grid');
    const wikiPreviewZone = div.querySelector('.wiki-selected-preview');

	div.querySelector('.btn-wiki-search').onclick = async (e) => {
	        if(e) e.preventDefault();
        
	        const query = wikiInput.value.trim();
	        if (!query) return;

	        wikiGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; font-size:0.8em; color: var(--hapi-accent-text);">Recherche...</div>';
        
	        try {
	            const images = await searchWikimedia(query);
	            wikiGrid.innerHTML = '';
            
	            if (images.length === 0) {
	                wikiGrid.innerHTML = '<p style="grid-column:1/-1; text-align:center; font-size:0.8em;">Aucun résultat trouvé.</p>';
	                return;
	            }

	            images.forEach(img => {
	                const item = document.createElement('div');
	                item.style.cssText = "height:120px; border:2px solid var(--border); border-radius:6px; overflow:hidden; cursor:pointer; transition:border-color 0.2s;";
	                item.innerHTML = `<img src="${img.thumb}" style="width:100%; height:100%; object-fit:cover;" title="Cliquer pour agrandir">`;
                
	                item.onclick = () => openLightbox(img, div);
	                item.onmouseover = () => item.style.borderColor = 'var(--hapi-green)';
	                item.onmouseout = () => item.style.borderColor = '#e2e8f0';
                
	                wikiGrid.appendChild(item);
	            }); 

	        } catch (err) {
	            console.error(err);
	            wikiGrid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#b91c1c;">Erreur de connexion.</p>';
	        }
	    }; 

    div.querySelector('.btn-remove-wiki-img').onclick = () => {
        wikiPreviewZone.style.display = 'none';
        div.querySelector('.wiki-img-preview').src = '';
        updateGenerateButtonCallback();
        checkStatus();
    };

    // --- LOGIQUE UPLOAD LOCAL ---
    div.querySelector('.card-img-upload').addEventListener('change', (e) => {
        if(e.target.files[0]) {
            cardImages.set(cardId, e.target.files[0]);
            const reader = new FileReader();
            reader.onload = (ev) => {
                const container = div.querySelector('.img-preview-container');
                container.innerHTML = `<div style="text-align:center;"><img src="${ev.target.result}" style="height:100px; border-radius:6px;"><button class="btn-remove-img-txt"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg> Supprimer</button></div>`;
                container.querySelector('.btn-remove-img-txt').onclick = () => {
                    cardImages.delete(cardId);
                    div.querySelector('.card-img-upload').value = '';
                    container.innerHTML = '';
                    updateGenerateButtonCallback();
                    checkStatus();
                };
            };
            reader.readAsDataURL(e.target.files[0]);
        }
        updateGenerateButtonCallback();
        checkStatus();
    });

    // --- LOGIQUE IMAGE IA ---
    const btnGenIA = div.querySelector('.btn-generate-ia');
    const iaImg = div.querySelector('.ia-generated-img');
    const iaPlaceholder = div.querySelector('.ia-placeholder');
    const btnDeleteIA = div.querySelector('.btn-delete-ia-img');

    const generateIAImage = async () => {
        const pText = promptInput.value.trim();
        if(!pText) return;

        btnGenIA.disabled = true; btnGenIA.innerText = '';
        iaImg.style.opacity = '0.5';
        
        try {
            const enPrompt = await translateToEnglish(pText);
            const result = await generateImageWithFallback(enPrompt);
            
            iaImg.onload = () => {
                const isPlaceholder = iaImg.src.includes('hapi-ph');
                const finalService = isPlaceholder ? 'Placeholder' : result.service;
                console.log(`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Image chargée (${finalService})`);

                iaImg.style.display = 'block'; iaPlaceholder.style.display = 'none';
                iaImg.style.opacity = '1';
                btnGenIA.disabled = false; btnGenIA.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/></svg> Générer';
                btnDeleteIA.style.display = 'block';
                updateGenerateButtonCallback();
                checkStatus();
            };
            
            iaImg.onerror = () => {
                console.warn("Échec <img>. Bascule Placeholder.");
                if (!iaImg.src.includes('hapi-ph')) {
                    iaImg.src = localPlaceholder('Erreur API', {w:300,h:300,bg:'#fee2e2',fg:'#b91c1c'});
                } else {
                    btnGenIA.innerText = '✕ Echec'; btnGenIA.disabled = false;
                }
            };
            iaImg.src = result.url; 
            
        } catch (e) {
            console.error("Erreur critique:", e);
            btnGenIA.disabled = false; btnGenIA.innerText = '✕ Erreur';
        }
    };
    btnGenIA.addEventListener('click', generateIAImage);

    btnDeleteIA.addEventListener('click', () => {
        iaImg.src = ''; iaImg.style.display = 'none'; iaPlaceholder.style.display = 'block';
        btnDeleteIA.style.display = 'none';
        updateGenerateButtonCallback();
        checkStatus();
    });

    const setAudio = (f, type) => {
        cardAudios.set(cardId, f);
        const url = URL.createObjectURL(f);
        const html = `<div style="display:flex; align-items:center; gap:8px; margin-top:5px; background:var(--page-bg); padding:5px;"><audio controls src="${url}" style="height:30px; width:200px;"></audio><button class="btn-delete-audio" style="border:none; cursor:pointer;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button></div>`;
        const container = type === 'up' ? div.querySelector('.audio-upload-preview') : div.querySelector('.audio-record-preview');
        container.innerHTML = html;
        container.querySelector('.btn-delete-audio').addEventListener('click', () => {
            cardAudios.delete(cardId);
            if(type==='up') div.querySelector('.card-audio-upload').value = '';
            container.innerHTML = '';
            updateGenerateButtonCallback();
            checkStatus();
        });
        updateGenerateButtonCallback();
        checkStatus();
    };

    div.querySelector('.card-audio-upload').addEventListener('change', (e) => { 
        if(e.target.files[0]) { div.querySelector('.audio-record-preview').innerHTML=''; setAudio(e.target.files[0], 'up'); }
    });
    
// --- RECORDING AUDIO ---
    div.querySelector('.btn-record').addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            const btnRec = div.querySelector('.btn-record');
            btnRec.classList.add('recording-active'); btnRec.disabled = true;
            div.querySelector('.btn-stop').disabled = false;
            
            div.querySelector('.card-audio-upload').value = ''; 
            div.querySelector('.audio-upload-preview').innerHTML = '';
            
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            
            mediaRecorder.onstop = async () => { 
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                const blob = new Blob(audioChunks, { type: mimeType });
                
                btnRec.innerText = ""; 

                let audioFile;
                try {
                    audioFile = await convertBlobToWavFile(blob, `rec_${cardId}.wav`);
                    console.log("🍏 Audio converti en WAV pour iOS");
                } catch (err) {
                    console.error("Echec conversion WAV", err);
                    audioFile = new File([blob], `rec_${cardId}.webm`, { type: mimeType });
                }

                setAudio(audioFile, 'rec');
                
                btnRec.innerText = "Enregistrer";
                btnRec.classList.remove('recording-active'); btnRec.disabled = false;
                div.querySelector('.btn-stop').disabled = true;
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
        } catch(e) { 
            console.error(e);
            alert("Micro inaccessible ou refusé."); 
        }
    });

    div.querySelector('.btn-stop').addEventListener('click', () => {
        if(mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
    });

    div.querySelector('.btn-del-card').onclick = () => { 
        if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
        div.remove(); cardImages.delete(cardId); cardAudios.delete(cardId); 
        updateGenerateButtonCallback(); 
        checkStatus();
    };

    document.getElementById('cards-list').appendChild(div);
    updateGenerateButtonCallback();
    checkStatus();
}

function checkStatus() {
    const statusDiv = document.getElementById('cards-status-indicator');
    const divs = document.querySelectorAll('#cards-list .card');
    
    if(!divs.length) { 
        if(statusDiv) {
            statusDiv.textContent = `Il faut au moins une carte remplie.`;
            statusDiv.style.color = 'var(--danger-text)';
            statusDiv.style.display = 'block';
        }
        return;
    }
    
    let isValid = true;
    divs.forEach(div => {
        const frontText = div.querySelector('.card-front').value.trim();
        const backText = div.querySelector('.card-back').value.trim();
        if (!frontText || !backText) isValid = false;
    });

    if (!isValid) {
        if(statusDiv) {
            statusDiv.textContent = `Chaque face (avant/arrière) doit être remplie pour toutes les cartes.`;
            statusDiv.style.color = 'var(--danger-text)';
            statusDiv.style.display = 'block';
        }
    } else {
        if(statusDiv) {
            statusDiv.textContent = `${divs.length} cartes valides. Prêt à générer.`;
            statusDiv.style.color = 'var(--hapi-grad-a)';
        }
    }
}


function showRegenerateButton() {
    const iaContainer = document.getElementById('ia-container-cards');
    const btnPrepare = document.getElementById('btn-prepare-prompt-cards');

    // On vérifie si la section IA est visible
    if (iaContainer && iaContainer.style.display === 'block') {
        if (btnPrepare) {
            // On fait réapparaître le conteneur parent
            if (btnPrepare.parentElement) btnPrepare.parentElement.style.display = 'block'; 
            btnPrepare.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg> Régénérer le prompt';
            // On s'assure que le bouton reste bien vert
            btnPrepare.style.background = 'linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark))';
            btnPrepare.style.boxShadow = '0 4px 15px rgba(var(--hapi-green-rgb), 0.3)';
        }
    }
}

// =========================================================
// 💾 GESTION IMPORT / EXPORT (déléguée à utils/states/cards-state.js)
// =========================================================

export async function getUIState() {
    return await getCardsState(cardImages, cardAudios);
}

export function setUIState(config) {
    setCardsState(config, {
        updateModeUI: updateUIForMode, 
        clearPreview: () => {
            document.getElementById('cards-list').innerHTML = '';
            cardCounter = 0;
            cardImages.clear();
            cardAudios.clear();
        },
        addCard: (data) => {
            // 1. Création de la carte visuelle
            addCardItem(data.front, data.back, data.tips, data.ui.iaPrompt);
            
            const container = document.getElementById('cards-list');
            const newCard = container.lastElementChild;
            if (!newCard) return;
            const cardId = newCard.id;

            // 2. Restauration des champs spécifiques
            if (data.ui) {
                if (data.ui.wikiSearch) newCard.querySelector('.wiki-search-input').value = data.ui.wikiSearch;
                // On bascule sur l'onglet actif lors de la sauvegarde
                const targetBtn = newCard.querySelector(`.img-tab-btn[data-target="${data.ui.activeImgTab}"]`);
                if (targetBtn) targetBtn.click();
            }

            // 3. Restauration de l'image (IA, Wiki ou Upload)
            if (data.imgFile) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const b64Data = ev.target.result;
                    
                    if (data.ui.activeImgTab === 'upload') {
                        cardImages.set(cardId, data.imgFile); // Indispensable pour la génération H5P ultérieure
                        const imgContainer = newCard.querySelector('.img-preview-container');
                        imgContainer.innerHTML = `<div style="text-align:center;"><img src="${b64Data}" style="height:100px; border-radius:6px;"><button class="btn-remove-img-txt"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg> Supprimer</button></div>`;
                    } 
                    else if (data.ui.activeImgTab === 'ia') {
                        const iaImg = newCard.querySelector('.ia-generated-img');
                        iaImg.src = b64Data;
                        iaImg.style.display = 'block';
                        newCard.querySelector('.ia-placeholder').style.display = 'none';
                        newCard.querySelector('.btn-delete-ia-img').style.display = 'block';
                    } 
                    else if (data.ui.activeImgTab === 'wiki') {
                        const wikiImg = newCard.querySelector('.wiki-img-preview');
                        wikiImg.src = b64Data;
                        newCard.querySelector('.wiki-selected-preview').style.display = 'block';
                        if (data.ui.wikiCredits) newCard.querySelector('.wiki-img-credits').innerText = data.ui.wikiCredits;
                    }
                };
                reader.readAsDataURL(data.imgFile);
            }

            // 4. Restauration de l'audio
            if (data.audioFile) {
                cardAudios.set(cardId, data.audioFile);
                const url = URL.createObjectURL(data.audioFile);
                const html = `<div style="display:flex; align-items:center; gap:8px; margin-top:5px; background:var(--page-bg); padding:5px;"><audio controls src="${url}" style="height:30px; width:200px;"></audio><button class="btn-delete-audio" style="border:none; cursor:pointer;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button></div>`;
                newCard.querySelector('.audio-upload-preview').innerHTML = html;
            }

            const isDialog = document.querySelector('input[name="cards-mode"]:checked').value === 'dialog';
            newCard.querySelector('.media-section-audio').style.display = isDialog ? 'block' : 'none';
            newCard.querySelector('.tip-wrapper-back').style.display = isDialog ? 'block' : 'none';
        }, 
        updateBtn: updateGenerateButtonCallback
    });
}

// --- GATHER DATA ---

export function gatherData() {
    const mode = document.querySelector('input[name="cards-mode"]:checked').value;
    const cardsData = [];
    const divs = document.querySelectorAll('#cards-list .card');
    
    const statusDiv = document.getElementById('cards-status-indicator');

    if(!divs.length) { 
        if(statusDiv) {
            statusDiv.textContent = `Il faut au moins une carte remplie.`;
            statusDiv.style.color = 'var(--danger-text)';
            statusDiv.style.display = 'block';
        }
        return null; 
    }
    
    let isValid = true;

    divs.forEach(div => {
        const id = div.id;
        const activeTab = div.querySelector('.img-tab-btn.active').dataset.target;
        let imageFile = null;

		if (activeTab === 'upload') {
            imageFile = cardImages.get(id) || null;
        } 
        else if (activeTab === 'wiki') {
            const wikiImg = div.querySelector('.wiki-img-preview');
            if (wikiImg && wikiImg.src && wikiImg.style.display !== 'none') {
                const b64 = imageToBase64(wikiImg);
                if (b64) imageFile = base64ToFile(b64, `wiki_${id}.jpg`);
            }
        } 
        else if (activeTab === 'ia') {
            const iaImg = div.querySelector('.ia-generated-img');
            if (iaImg && iaImg.style.display !== 'none' && iaImg.src && !iaImg.src.includes('hapi-ph')) {
                const b64 = imageToBase64(iaImg);
                if (b64) imageFile = base64ToFile(b64, `ia_gen_${id}.jpg`);
            }
        }

        const frontText = div.querySelector('.card-front').value.trim();
        const backText = div.querySelector('.card-back').value.trim();
        
        if (!frontText || !backText) isValid = false;

        cardsData.push({
            front: frontText,
            back: backText,
            tips: { 
                front: div.querySelector('.card-tip-front').value, 
                back: mode === 'dialog' ? div.querySelector('.card-tip-back').value : '' 
            },
            image: imageFile, 
            audio: mode === 'dialog' ? (cardAudios.get(id) || null) : null
        });
    });

    if (!isValid) {
        if(statusDiv) {
            statusDiv.textContent = `Chaque face (avant/arrière) doit être remplie pour toutes les cartes.`;
            statusDiv.style.color = 'var(--danger-text)';
            statusDiv.style.display = 'block';
        }
        return null;
    }

    if(statusDiv) {
        statusDiv.textContent = `${cardsData.length} cartes valides. Prêt à générer.`;
        statusDiv.style.color = 'var(--hapi-grad-a)';
    }

    const langSelect = document.getElementById('global-language');
    const lang = langSelect ? langSelect.value : 'Français';
    const niveauSelect = document.getElementById('global-niveau');
    const niveau = niveauSelect ? niveauSelect.value : 'Cycle 2';

    const shouldTranslateUI = document.getElementById('translate-ui-cards')?.checked;
    const uiLanguage = shouldTranslateUI ? lang : 'Français';
    const l10n = getH5PLocalization(uiLanguage, mode === 'flash' ? 'Flashcards' : 'Dialogcards');
    
	return {
        type: 'cards', mode: mode,
        titre: document.getElementById('cards-title').value,
        consigne: document.getElementById('cards-task').value,
		niveau: niveau,
        cards: cardsData, l10n: l10n,
        options: {
            disableBack: document.getElementById('opt-disable-back')?.checked || false,
            random: document.getElementById('opt-random')?.checked || false,
            caseSensitive: document.getElementById('opt-case-sensitive')?.checked || false
        }
    };
}

export async function generatePreviewJSON() {
    const data = gatherData();
    if (!data) return null;
    
    const cardsArr = [];
    for(const c of data.cards) {
        let imgObj = null;
        if(c.image) {
            const url = URL.createObjectURL(c.image);
            const dims = await new Promise(r => { const i=new Image(); i.onload=()=>r({w:i.width,h:i.height}); i.onerror=()=>r({w:600,h:400}); i.src=url; });
            imgObj = { path: url, mime: c.image.type, width: dims.w, height: dims.h, copyright:{license:'U'} };
        }
        
        let audArr = null;
        if(c.audio) audArr = [{ path: URL.createObjectURL(c.audio), mime: c.audio.type, copyright:{license:'U'} }];

        const frontData = extractTextAndTips(c.front, c.tips.front, 'front');
        const backData = extractTextAndTips(c.back, c.tips.back, 'back');
        const combinedTip = frontData.tip || backData.tip || "";

        if(data.mode === 'flash') {
            cardsArr.push({ text: frontData.text, answer: backData.text, tip: combinedTip, image: imgObj });
        } else {
            const item = { text: frontData.text, answer: backData.text, tips: { front: frontData.tip, back: backData.tip } };
            if(imgObj) item.image = imgObj;
            if(audArr) item.audio = audArr;
            cardsArr.push(item);
        }
    }

    if (data.mode === 'flash') {
            return {
                library: "H5P.Flashcards 1.7",
                params: { 
                    description: cleanText(data.consigne), cards: cardsArr, 
                    progressText: data.l10n.progressText, next: data.l10n.next, previous: data.l10n.previous, 
                    checkAnswerText: data.l10n.checkAnswerText, defaultAnswerText: data.l10n.defaultAnswerText,
                    correctAnswerText: data.l10n.correctAnswerText, incorrectAnswerText: data.l10n.incorrectAnswerText,
                    solutionLabel: data.l10n.solutionLabel, showSolutionText: data.l10n.showSolutionTitle,
                    results: data.l10n.results, showResults: data.l10n.showResults, ofCorrect: data.l10n.ofCorrect,        
                    showSolutionsRequiresInput: true, caseSensitive: false,
                    l10n: { tryAgain: data.l10n.tryAgainText, showSolution: data.l10n.showSolutionButton } 
                }
            };
    } else {
        return {
            library: "H5P.Dialogcards 1.9",
            params: { 
                title: data.titre, description: cleanText(data.consigne), dialogs: cardsArr, 
                behaviour: { scaleTextNotCard: true }, 
                next: data.l10n.nextText, prev: data.l10n.prevText, retry: data.l10n.retryText, 
                answer: data.l10n.turnCardText, progressText: data.l10n.progressText,
                cardFrontLabel: data.l10n.cardFrontLabel, cardBackLabel: data.l10n.cardBackLabel
            }
        };
    }
}