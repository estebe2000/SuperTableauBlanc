// Fichier: modules/ui/image-pairing-ui.js

import { logger } from '../utils/logger.js';
import { localPlaceholder } from '../utils/placeholder.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { creerAssistantIA_HTML } from '../utils/helpers.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_ImagePairing, preparerPrompt_IdesAppariement } from '../ia/prompt-builder.js';
import { parserReponseIA_ImagePairing } from '../ia/response-parser.js';
import { getH5PLocalization } from '../utils/h5p-translations.js';
import { getImagePairingState, setImagePairingState } from '../utils/states/image-pairing-state.js';
import { SourceSelector } from './source-selector.js';

let container = null;
let updateGenerateButtonCallback = () => {};
let currentCorpusContent = '';
let pairCounter = 0; // ✅ AJOUT : Compteur global pour les ID

let localSourceSelector = null;
let currentRepartition = {};

// ==========================================
// 🎨 SYSTÈME MULTI-API IMAGES (WORKER + FALLBACK)
// ==========================================

const IMAGE_SERVICES = {
    n8n: {
        name: 'n8n Image Generator',
        getURL: (prompt) => (typeof window !== 'undefined' ? window.location.origin : '') + `/proxy-n8n/webhook/hapi-image?prompt=${encodeURIComponent(prompt)}`,
        enabled: true 
    }
};

async function generateImageWithFallback(prompt) {
    if (IMAGE_SERVICES.n8n && IMAGE_SERVICES.n8n.enabled) {
        console.log(`[ImagePairing] Appel Direct n8n:`, IMAGE_SERVICES.n8n.name);
        return { 
            url: IMAGE_SERVICES.n8n.getURL(prompt), 
            service: 'n8n' 
        };
    }
    
    console.error('✕ Tous les services ont échoué');
    return { 
        url: localPlaceholder('Erreur Génération', {w:300,h:300,bg:'#fee2e2',fg:'#b91c1c'}), 
        service: 'placeholder',
        error: true 
    };
}

// ==========================================
// 🌐 TRADUCTION VIA LLM (API ALBERT)
// ==========================================

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

        // 🛡️ Détection réponse chatbot au lieu d'une traduction
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

// --- FONCTIONS WIKIMEDIA & LIGHTBOX ---

async function searchWikimedia(query) {
    if (!query || query.length < 2) return [];
    const endpoint = "https://commons.wikimedia.org/w/api.php";
    const params = new URLSearchParams({
        action: "query", generator: "search", gsrnamespace: "6", 
        gsrsearch: `${query} filetype:bitmap`, gsrlimit: "15", 
        prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "400", 
        format: "json", origin: "*" 
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
                thumb: info.thumburl, full: info.url, title: title,
                artist: meta.Artist ? meta.Artist.value.replace(/<\/?[^>]+(>|$)/g, "") : "Inconnu",
                license: meta.LicenseShortName ? meta.LicenseShortName.value : "CC BY-SA"
            };
        }).filter(item => item !== null);
    } catch (e) { return []; }
}

function openLightbox(imgData, card, side) {
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
        const previewImg = card.querySelector(`.img-preview-wiki-${side}`);
        const previewZone = card.querySelector(`.panel-wiki-selected-${side}`);
        const creditsDiv = card.querySelector(`.wiki-credits-${side}`);

        if(previewImg) previewImg.src = imgData.full;
        if(creditsDiv) creditsDiv.innerText = `Crédit : ${imgData.artist} (${imgData.license})`;
        if(previewZone) previewZone.style.display = 'block';

        updateGenerateButtonCallback();
        modal.remove();
    };
}

// --- UTILITAIRES DIVERS ---

function updatePairNumbers() {
    const cards = document.querySelectorAll('#imgpair-list .card');
    cards.forEach((card, index) => {
        const titleSpan = card.querySelector('.pair-number-label');
        if (titleSpan) titleSpan.innerText = `PAIRE ${index + 1}`;
    });
}

function updatePanelVisibility(card, side, type) {
    const pText = card.querySelector(`.panel-text-${side}`);
    const pIa = card.querySelector(`.panel-ia-${side}`);
    const pUpload = card.querySelector(`.panel-upload-${side}`);
    const pWiki = card.querySelector(`.panel-wiki-${side}`);

    if (pText) pText.style.display = type === 'text' ? 'block' : 'none';
    if (pIa) pIa.style.display = type === 'ia' ? 'block' : 'none';
    if (pUpload) pUpload.style.display = type === 'upload' ? 'block' : 'none';
    if (pWiki) pWiki.style.display = type === 'wiki' ? 'block' : 'none';
}

function imageToBase64(imgElement) {
    try {
        if (imgElement.src.startsWith('data:image')) return imgElement.src;
        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth || 300;
        canvas.height = imgElement.naturalHeight || 300;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.85);
    } catch (e) {
        console.warn("Erreur conversion Base64 (CORS):", e);
        return null;
    }
}

// --- LOGIQUE D'INJECTION DYNAMIQUE ---

function injectStepBlock(stepNumber) {
    const containerContent = document.getElementById('ia-container-content');
    if (!containerContent) return;

    logger.log(`🔧 Injection du bloc visuel clone pour l'Étape ${stepNumber}`);

    const html = `
        <div class="ia-block-group" style="margin-top: 15px;">
            <div id="ia-container-cards">
                ${creerAssistantIA_HTML('ia-prompt-imgpair', 'ia-response-imgpair')}
            </div>
            
            <div id="albert-action-imgpair" style="text-align: center; margin-top: 15px; margin-bottom: 30px;">
                <button id="btn-send-albert-imgpair" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                    🇫🇷 Envoyer le prompt à l'IA
                </button>
            </div>
            
            <div style="text-align:center; margin-top:15px; display:none;">
                <button id="btn-parse-ia-response-dynamic" class="btn" style="background:var(--hapi-grad-a); color:white; padding:10px 25px; border:none; border-radius:25px; cursor:pointer; font-weight:bold; font-size:1.05em; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg> Transformer en paires
                </button>
            </div>
        </div>
    `;

    containerContent.innerHTML = html;

    const btnAlbert = document.getElementById('btn-send-albert-imgpair');
    if (btnAlbert) {
        btnAlbert.addEventListener('click', async () => {
            const originalText = btnAlbert.innerHTML;
            btnAlbert.disabled = true;
            btnAlbert.innerHTML = "L'IA crée les paires...";
            await callAlbertAPI('ia-prompt-imgpair', 'ia-response-imgpair', 'btn-parse-ia-response-dynamic', btnAlbert);
            btnAlbert.innerHTML = originalText;
            btnAlbert.disabled = false;
        });
    }

    const btnParse = document.getElementById('btn-parse-ia-response-dynamic');
    if (btnParse) {
        btnParse.addEventListener('click', handleParseContent);
    }
}

async function remplirPromptIdees() {
    try {
        const prompt = await preparerPrompt_IdesAppariement();
        const textArea = document.getElementById('ia-prompt-imgpair-ideas');
        if (textArea) {
            textArea.value = prompt;
            textArea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    } catch (err) {
        console.error("Erreur lors de la préparation du prompt Idées :", err);
        alert("Impossible de générer le prompt d'idées.");
    }
}

// --- INITIALISATION ---

export function init(targetContainer, corpusContent, updateBtnCallback) {
    container = targetContainer;
    updateGenerateButtonCallback = updateBtnCallback;
    currentCorpusContent = corpusContent || '';
    pairCounter = 0; // Réinitialisation
    
    logger.log('✨ Initialisation UI Image Pairing (Pastilles & MultiAPI)...');

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
        <div id="imgpair-generator-wrapper" style="font-family: 'Segoe UI', sans-serif;">
            <style>
                .ia-accordion-wrapper { max-height: 0; overflow: hidden; opacity: 0; transition: max-height 0.5s ease, opacity 0.5s ease; }
                .ia-accordion-wrapper.open { max-height: 2500px; opacity: 1; margin-bottom: 20px; }
                .ia-toggle-btn { transition: transform 0.3s; display: inline-block; }
                .ia-toggle-btn.rotated { transform: rotate(180deg); }
                .step-title { transition: color 0.3s; }
            </style>

            <div class="section" style="background: var(--surface); padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
              
                <div id="imgpair-source-selector"></div>
                <div id="imgpair-questions-repartition"></div>

                <h2 style="margin:0 0 15px 0;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configuration des appariements</h2>

				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 5px;">
                    <div class="input-group">
                        <label for="imgpair-title" style="display:block; font-weight:bold; margin-bottom:6px;">Titre de l'activité :</label>
                        <input type="text" id="imgpair-title" value="Appariements d'images" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div class="input-group">
                        <label for="imgpair-subject" style="display:block; font-weight:bold; margin-bottom:6px;">Thème global :</label>
                        <input type="text" id="imgpair-subject" placeholder="Ex: Géographie..." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:5px;">
                    </div>
				</div>
				
                <div class="input-group" style="margin-bottom: 15px; margin-top:15px;">
                    <label for="imgpairTask" style="display:block; font-weight:bold; margin-bottom:6px;">Consigne pour l'élève :</label>
                    <input type="text" id="imgpairTask" value="Associez les éléments correspondants." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                </div>

                <div style="background:var(--hapi-green-mist); padding:15px; border-radius:8px; border:1px solid var(--border-strong); margin-top:10px;">
                    <label style="font-weight:700; color: var(--hapi-accent-text); display:block; margin-bottom:10px;">Mode rapide (frugal)</label>
                    <div style="display:flex; gap:10px; align-items: center; flex-wrap: nowrap;">
                        <input type="text" id="imgpair-manual-strategy" placeholder="Ex: Pays / Capitale" style="flex:1 1 auto; min-width:0; height:38px; padding:0 12px; border:1px solid var(--border-strong); border-radius:19px; box-sizing:border-box; outline:none;">
                        <button id="btn-manual-generate" class="btn" style="flex:0 0 auto; height:38px; display:flex; align-items:center; justify-content:center; background: linear-gradient(135deg, var(--hapi-green-light), var(--hapi-green-dark)); color:white; border:none; padding:0 20px; border-radius:19px; cursor:pointer; font-weight:600; white-space:nowrap; box-sizing:border-box;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Valider & générer le prompt
                        </button>
                    </div>
                </div>
                
                <div style="margin-top:20px; text-align:right; font-size:0.95em;">
                    Pas d'idée ? 
                    <span id="btn-toggle-ia-suggestions" style="color: var(--hapi-accent-text); cursor:pointer; font-weight:700; padding:8px 15px; border-radius:19px; background:var(--hapi-green-mist); border:1px solid var(--border-strong); display:inline-flex; align-items:center; gap:5px; transition:all 0.2s;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5A7 7 0 1 0 5 9c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/></svg> Demander des suggestions à l'IA <span class="ia-toggle-btn" style="transition: transform 0.3s;">▼</span>
                    </span>
                </div>
            </div>

            <div id="ia-suggestions-wrapper" class="ia-accordion-wrapper">
                <div class="section" style="background:var(--surface); padding:25px; border-radius:8px; margin-bottom:20px; border-left:5px solid var(--hapi-grad-a); box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                    <h3 style="margin-top:0; color:var(--hapi-accent-text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5A7 7 0 1 0 5 9c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/></svg> Assistant IA : Recherche d'idées</h3>
                    <div id="ia-container-ideas"></div>
                    <div id="albert-action-imgpair-ideas" style="text-align: center; margin-top: 15px; margin-bottom: 20px;">
                        <button id="btn-send-albert-imgpair-ideas" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                            🇫🇷 Envoyer le prompt à l'IA
                        </button>
                    </div>
                    
                    <div style="text-align:center; display:none;">
                        <button id="btn-parse-ia-response-imgpair-ideas" class="btn" style="background:var(--hapi-grad-a); color:white; padding:10px 25px; border:none; border-radius:25px; cursor:pointer; font-weight:bold; font-size:1em; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg> Valider les stratégies
                        </button>
                    </div>
                </div>

                <div id="section-strategy-choice" class="section" style="background:var(--surface); padding:25px; border-radius:8px; margin-bottom:20px; display:none; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                    <h3 style="margin-top:0; color: var(--hapi-accent-text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Choix de la stratégie</h3>
                    <div id="strategy-options-container" style="display:flex; flex-direction:column; gap:10px;"></div>
                    
                    <div style="margin-top:15px; padding-top:15px; border-top:1px dashed #e5e7eb;">
                        <div style="display:flex; align-items:center;">
                            <input type="radio" name="strategy-radio" id="strategy-custom" value="custom" style="accent-color: var(--hapi-green);">
                            <label for="strategy-custom" style="font-weight:bold; color: var(--hapi-accent-text); margin-left:8px;">Autre :</label>
                            <input type="text" id="strategy-custom-input" placeholder="Ex: Auteur / Livre" style="flex:1; padding:8px; margin-left:10px; border:1px solid var(--border-strong); border-radius:6px;">
                        </div>
                    </div>

                    <div style="margin-top:25px; text-align:center;">
                         <button id="prepare-ia-btn-imgpair" class="btn" style="padding:12px 35px; background:linear-gradient(135deg, var(--hapi-grad-a) 0%, var(--hapi-grad-a) 100%); color:white; font-weight:bold; border:none; border-radius:25px; cursor:pointer;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer le prompt
                        </button>
                    </div>
                </div>
            </div>
            
            <div id="step-generation-container" style="display:none; margin-bottom:20px; background:var(--surface); padding:25px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                <h3 class="step-title" style="margin-top:0; color:var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Étape ... : Génération du contenu</h3>
                <div id="ia-container-content"></div>
            </div>

			<div id="preview-section-imgpair" class="section" style="display:none; background:var(--surface); padding:25px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.05); margin-top:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:2px solid var(--border); padding-bottom:15px;">
                    <h2 style="margin:0; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg> Éditez les paires</h2>
                </div>

                <div style="background:var(--hapi-green-mist); border:1px solid var(--border-strong); color: var(--hapi-accent-text); padding:15px; border-radius:8px; font-size:0.85em; margin-bottom:20px; display:flex; gap:12px; align-items:start; line-height:1.5;">
                    <span style="font-size:1.5em; flex-shrink:0;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5A7 7 0 1 0 5 9c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/></svg></span>
                    <div>
                        <strong style="color: var(--hapi-accent-text); display:block; margin-bottom:4px;">Information "Image IA"</strong> 
                        L’application utilise un système gratuit multi-API de génération d’images. Il convient de l’utiliser à bon escient.
                        <span style="font-weight:600; text-decoration-color:var(--hapi-green-light);">Privilégiez un usage frugal !</span>
                        <br>
                        Cliquez sur le bouton <strong>« <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg> »</strong> pour obtenir une image. Vous pouvez modifier le prompt et générer à nouveau.
                        <br>
                        <em style="color: var(--hapi-accent-text);">Note : Les délais de traitement peuvent varier. Pour un fonctionnement optimal, veuillez générer les images les unes après les autres.</em>
                    </div>
                </div>

                <div id="imgpair-list"></div>
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn" id="btn-add-pair" style="background:#6c757d; color:white; padding:10px 20px; border-radius:25px; border:none; cursor:pointer;">
                        + Ajouter une paire manuellement
                    </button>
                </div>

                <div id="imgpair-options-section" class="input-group" style="margin-top: 40px;">
                    <details style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px;">
                        <summary style="font-weight:bold; font-size:1.2em; color:var(--text); cursor:pointer; outline:none; list-style-position: inside;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options globales
                        </summary>
                        <div style="margin-top: 20px;">
                            <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px;">
                                <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options supplémentaires
                                </div>
                                <div style="display:flex; flex-direction:column; gap:20px;">
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="translate-ui-imgpair" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                        <span style="font-weight:bold; font-size:1.05em; color: var(--hapi-accent-text);">Traduire les boutons H5P</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;

	const selectorContainer = container.querySelector('#imgpair-source-selector');
	    if (selectorContainer) {
	        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'imgpair', (selectedDocs) => {
	            renderRepartitionConfigImgPair(selectedDocs);
	            showRegenerateButton(); 
	        });
	    }
    
    const ideasContainer = document.getElementById('ia-container-ideas');
    ideasContainer.innerHTML = creerAssistantIA_HTML('ia-prompt-imgpair-ideas', 'ia-response-imgpair-ideas');
    const dupTitle1 = ideasContainer.querySelector('h2, h3');
    if (dupTitle1) dupTitle1.style.display = 'none';

    // --- LISTENERS ---

    document.getElementById('btn-toggle-ia-suggestions').addEventListener('click', async () => {
        const wrapper = document.getElementById('ia-suggestions-wrapper');
        const icon = document.querySelector('.ia-toggle-btn');
        wrapper.classList.toggle('open');
        icon.classList.toggle('rotated');
        
        if (wrapper.classList.contains('open')) {
            document.getElementById('step-generation-container').style.display = 'none';
            document.getElementById('preview-section-imgpair').style.display = 'none';
            await remplirPromptIdees();
            setTimeout(() => {
                document.getElementById('ia-suggestions-wrapper').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        }
    });

    document.getElementById('btn-send-albert-imgpair-ideas').addEventListener('click', async () => {
        const btn = document.getElementById('btn-send-albert-imgpair-ideas');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = "L'IA génère...";
        await callAlbertAPI('ia-prompt-imgpair-ideas', 'ia-response-imgpair-ideas', 'btn-parse-ia-response-imgpair-ideas', btn);
        btn.innerHTML = originalText;
        btn.disabled = false;
    });

    document.getElementById('prepare-ia-btn-imgpair').addEventListener('click', () => handlePrepareContent('ia'));
    document.getElementById('btn-manual-generate').addEventListener('click', () => handlePrepareContent('manual'));

    document.getElementById('btn-add-pair').addEventListener('click', () => { 
        addPairCard(); 
        updateGenerateButtonCallback(); 
    });

    document.getElementById('btn-parse-ia-response-imgpair-ideas').addEventListener('click', handleParseIdeas);
    
    setupListDelegation();

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

    // 2. Écouteurs spécifiques à l'appariement d'images
    container.addEventListener('input', (e) => {
        if (e.target.id === 'imgpair-subject' || 
            e.target.id === 'imgpair-manual-strategy' || 
            e.target.id === 'strategy-custom-input' || 
            e.target.classList.contains('source-question-count')) {
            showRegenerateButton();
        }
    });

    // 3. Écouteur sur le choix de stratégie (les cases à cocher / radios de l'IA)
    container.addEventListener('change', (e) => {
        if (e.target.name === 'strategy-radio') {
            showRegenerateButton();
        }
    });

    // 🔴 BOUCLIER ANTI-BARRE DU BAS
    const enforceHideBottomBar = () => {
        const genSection = document.getElementById('generate-section');
        const cardsCount = document.querySelectorAll('#imgpair-list .card').length;
        if (genSection && cardsCount < 1) {
            genSection.style.display = 'none';
        }
    };

    enforceHideBottomBar();
    setTimeout(enforceHideBottomBar, 50);

    const tabBtn = document.querySelector('.tab-btn[data-tab-target="imgpair"]');
    if (tabBtn) {
        tabBtn.addEventListener('click', () => setTimeout(enforceHideBottomBar, 10));
    }
}

// --- LOGIQUE METIER ---

function handleParseIdeas() {
    const raw = document.getElementById('ia-response-imgpair-ideas').value; 
    try {
        let jsonStr = raw.trim();
        if(jsonStr.indexOf('[') > -1) jsonStr = jsonStr.substring(jsonStr.indexOf('['));
        if(jsonStr.lastIndexOf(']') > -1) jsonStr = jsonStr.substring(0, jsonStr.lastIndexOf(']')+1);
        
        const ideas = JSON.parse(jsonStr);
        const container = document.getElementById('strategy-options-container');
        container.innerHTML = '';
        
        ideas.forEach((idea, index) => {
            const div = document.createElement('div');
            div.style.cssText = "display:flex; align-items:center; background:var(--page-bg); padding:8px; border-radius:6px; border:1px solid var(--border); margin-bottom:5px;";
            div.innerHTML = `
                <input type="radio" name="strategy-radio" id="strat-${index}" value="${idea}" ${index===0?'checked':''} style="accent-color: var(--hapi-green);">
                <label for="strat-${index}" class="strategy-label" style="cursor:pointer; padding-left:12px; flex:1; font-weight:500;">${idea}</label>
                <button class="btn-invert-single" title="Inverser" data-target="strat-${index}" style="margin-left:10px; background:var(--surface); border:1px solid var(--border); border-radius:4px; cursor:pointer; padding:5px 9px; color: var(--hapi-accent-text); font-size:1.05em; display:inline-flex; align-items:center;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg></button>
            `;
            container.appendChild(div);
        });

        container.querySelectorAll('.btn-invert-single').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation(); 
                const targetId = btn.dataset.target;
                const radio = document.getElementById(targetId);
                const label = radio.parentElement.querySelector('.strategy-label');
                const currentText = radio.value;
                let separator = " / ";
                if (!currentText.includes(separator)) separator = " - ";
                if (!currentText.includes(separator)) separator = " : ";
                
                if (currentText.includes(separator)) {
                    const parts = currentText.split(separator);
                    if (parts.length >= 2) {
                        const newText = `${parts[1].trim()}${separator}${parts[0].trim()}`;
                        radio.value = newText;
                        label.innerText = newText;
                        radio.checked = true;
                    }
                }
            });
        });
        
        document.getElementById('section-strategy-choice').style.display = 'block';
        document.getElementById('section-strategy-choice').scrollIntoView({ behavior: 'smooth' });

    } catch(e) {
        alert("Erreur JSON idées : " + e.message);
    }
}

function renderRepartitionConfigImgPair(selectedDocs) {
    const repContainer = container.querySelector('#imgpair-questions-repartition');
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
        <div style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px; margin-top: 10px; margin-bottom: 20px; max-height: 250px; overflow-y: auto;">
            <label style="display:flex; justify-content:space-between; align-items:center; font-size: 0.95em; font-weight:bold; margin-bottom:12px; color:var(--text);">
                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Répartition des paires à générer</span>
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

async function handlePrepareContent(mode) {
    let strategy = "";
    let btn = null;
    const stepNum = (mode === 'manual') ? '4' : '5';

    if (mode === 'manual') {
        const input = document.getElementById('imgpair-manual-strategy');
        strategy = input.value.trim();
        btn = document.getElementById('btn-manual-generate');
        if (!strategy) {
            alert("Veuillez entrer une stratégie (Ex: Pays / Capitale)");
            input.focus();
            return;
        }
    } else {
        const radios = document.getElementsByName('strategy-radio');
        for(let r of radios) { if(r.checked) strategy = r.value; }
        if(document.getElementById('strategy-custom').checked) strategy = document.getElementById('strategy-custom-input').value;
        btn = document.getElementById('prepare-ia-btn-imgpair');
        if(!strategy) { alert("Choisissez une stratégie !"); return; }
    }

    // 🟢 On force le texte initial de base
    const originalText = mode === 'manual' ? '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Valider & générer le prompt' : '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer le prompt';
    
    btn.disabled = true;
    btn.innerHTML = "Analyse...";

    injectStepBlock(stepNum);
    
    const genContainer = document.getElementById('step-generation-container');
    const mainTitle = genContainer.querySelector('h3.step-title');
    if (mainTitle) mainTitle.innerHTML = `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Étape ${stepNum}. Assistant IA : Génération du contenu`;
    genContainer.style.display = 'block';

    const repartitionMap = {};
    container.querySelectorAll('.source-question-count').forEach(input => {
        const id = input.dataset.sourceId;
        const val = parseInt(input.value, 10);
        if (!isNaN(val) && val >= 0) repartitionMap[id] = val;
    });

    const langSelect = document.getElementById('global-language');
    const targetLanguage = langSelect ? langSelect.value : 'Français';
    const globalTheme = document.getElementById('imgpair-subject').value || "Général";

    const success = await preparerAssistantIA_ImagePairing(strategy, repartitionMap, targetLanguage, globalTheme, currentCorpusContent);
    
    if (success) {
        if (mode === 'manual') {
            const wrapper = document.getElementById('ia-suggestions-wrapper');
            if (wrapper) wrapper.classList.remove('open');
            const toggleBtn = document.querySelector('.ia-toggle-btn');
            if (toggleBtn) toggleBtn.classList.remove('rotated');
        }
        genContainer.scrollIntoView({ behavior: 'smooth' });

        // 🟢 NOUVEAU : On cache les boutons d'action de façon sécurisée
        if (mode === 'manual') {
            btn.style.display = 'none'; // Le bouton manuel est masqué directement
        } else {
            if (btn.parentElement) btn.parentElement.style.display = 'none'; // Le bouton IA masque son parent
        }
    }

    // 🟢 On remet le texte par défaut pour la prochaine fois
    btn.disabled = false;
    btn.innerHTML = originalText;
}


function handleParseContent() {
    const reponseBrute = document.getElementById('ia-response-imgpair').value; 
    let data = [];
    
	try {
	    const start = reponseBrute.indexOf('[');
	    const end = reponseBrute.lastIndexOf(']');
	    if (start !== -1 && end !== -1) {
	        let jsonStr = reponseBrute.substring(start, end + 1);
        
	        // 🛡️ Remplacer les séparateurs ---o--- par des virgules JSON valides
	        jsonStr = jsonStr.replace(/\}\s*---[^-]*---\s*\{/g, '}, {');
        
	        data = JSON.parse(jsonStr);
	    }
	} catch(e) { console.warn("Extraction manuelle JSON échouée", e.message); }

    if (!data || data.length === 0) {
        try { data = parserReponseIA_ImagePairing(reponseBrute); } catch(e) {}
    }

    if (!data || data.length === 0) {
        alert("Impossible de trouver des paires dans la réponse. Vérifiez le JSON.");
        return;
    }

    const list = document.getElementById('imgpair-list');
    list.innerHTML = '';
    
    data.forEach(item => addPairCard(item));
    updatePairNumbers();
    
    document.getElementById('preview-section-imgpair').style.display = 'block';
    const genSec = document.getElementById('generate-section');
    if(genSec) genSec.style.display = 'block';
    
    document.getElementById('preview-section-imgpair').scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateGenerateButtonCallback();
}

async function triggerAsyncImageGeneration(imgElement, promptDisplayed, promptInput) {
    if (!promptDisplayed && !promptInput) return;
    
    const textToProcess = promptInput ? promptInput.value : promptDisplayed;
    if(!textToProcess) return;

    try {
        let englishPrompt = "";
        if (promptInput && promptInput.dataset.english) {
            console.log("Utilisation du prompt anglais en cache");
            englishPrompt = promptInput.dataset.english;
        } else {
            console.log("Traduction à la volée du prompt utilisateur...");
            englishPrompt = await translateToEnglish(textToProcess);
        }

        const result = await generateImageWithFallback(englishPrompt);
        
        imgElement.onload = () => { imgElement.style.opacity = '1'; };
        imgElement.onerror = () => { imgElement.src = localPlaceholder('Erreur Chargement'); };
        imgElement.src = result.url;
        
    } catch (e) {
        console.error("Erreur Async Gen:", e);
        imgElement.src = localPlaceholder('Erreur Script');
    }
}

function addPairCard(item = {}) {
    // ✅ CORRECTION : Incrémentation du compteur et génération de l'ID unique
    pairCounter++;
    const cardId = `imgpair-card-${pairCounter}`;

    const getVal = (key) => {
        if (item[key]) return item[key];
        const foundKey = Object.keys(item).find(k => k.toLowerCase() === key.toLowerCase());
        return foundKey ? item[foundKey] : "";
    };
    
    const leftLabel = getVal('left_label') || "Élément A";
    const leftText = getVal('left_label') || getVal('left_text') || "";
    const leftPrompt = getVal('left_prompt'); 
    const leftPromptFr = getVal('left_prompt_fr') || leftPrompt; 
    
    const rightLabel = getVal('right_label') || "Élément B";
    const rightText = getVal('right_text');
    const rightPrompt = getVal('right_prompt');     
    const rightPromptFr = getVal('right_prompt_fr') || rightPrompt; 
    
    const cardTitle = item.label || `${leftLabel} / ${rightLabel}`;
    const leftMode = 'text'; 
    const rightMode = 'text'; 
    
    const svgWaiting = `data:image/svg+xml;charset=utf-8,` + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
            <rect width="400" height="400" fill="#f1f5f9"/>
            <text x="50%" y="32%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="38" fill="#334155" font-weight="600">Appuyer sur <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg></text>
            <text x="50%" y="44%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="38" fill="#334155" font-weight="600">en bas à droite</text>
            <text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="38" fill="#334155" font-weight="600">pour générer</text>
            <text x="50%" y="68%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="38" fill="#334155" font-weight="600">l'image</text>
        </svg>
    `.trim());

    const urlLeft = leftPrompt ? svgWaiting : localPlaceholder('Aperçu');
    const urlRight = rightPrompt ? svgWaiting : localPlaceholder('Aperçu');

    const container = document.getElementById('imgpair-list');
    const card = document.createElement('div');
    card.className = 'card';
    card.id = cardId;
    card.style.cssText = "background:var(--surface); border:1px solid var(--border); padding:20px; margin-bottom:15px; border-radius:8px; border-left:4px solid var(--hapi-green); color: #1f2937; position: relative;";

    const escape = (str) => String(str).replace(/"/g, '&quot;');
    const MAX_CHARS = 40; 
    const MAX_CHARS_2 = 120;

    card.innerHTML = `
        <button class="delete-btn" style="position:absolute; right:15px; top:15px; background:transparent; border:none; cursor:pointer; font-size:1.2em; color:var(--text); transition:color 0.2s;" onmouseover="this.style.color='#0f172a'" onmouseout="this.style.color='var(--text)'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
        <div style="font-weight:700; color:var(--text); display:flex; align-items:center; gap:8px; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;">
            <span class="pair-number-label" style="background:var(--hapi-green-pale); color: var(--hapi-accent-text); padding:2px 8px; border-radius:4px; font-size:0.8em;">PAIRE ...</span>
            ${cardTitle}
        </div>

        <div style="display:flex; gap:15px; align-items:flex-start; flex-wrap: wrap;">
            
            <div style="flex:1; min-width: 280px; background:var(--page-bg); padding:15px; border-radius:8px; border:1px dashed #cbd5e0; display:flex; flex-direction:column; gap:12px;">
                <div style="font-size:0.85em; font-weight:700; color:var(--text-muted); text-align:center;">Élément A</div>
                
                <select class="type-select" data-side="left" style="height:38px; width:100%; padding:0 10px; border-radius:6px; border:1px solid var(--border); background:var(--surface); box-sizing:border-box; outline:none; cursor:pointer;">
                    <option value="text" ${leftMode==='text'?'selected':''}>Texte</option>
                    <option value="upload" ${leftMode==='upload'?'selected':''}>Image locale</option>
                    <option value="wiki" ${leftMode==='wiki'?'selected':''}>Wikimedia</option>
                    <option value="ia" ${leftMode==='ia'?'selected':''}>Image IA</option>
                </select>
                
                <div class="panel-text-left" style="display:${leftMode==='text'?'block':'none'}; width:100%;">
                    <textarea class="input-text-left" rows="3" maxlength="${MAX_CHARS}" style="width:100%; padding:10px; border:1px solid #cbd5e0; border-radius:6px; margin-bottom:5px; box-sizing:border-box; outline:none; font-family:inherit; resize:vertical;">${leftText}</textarea>
                    <div class="char-counter" style="font-size:0.7em; color:var(--text-muted); text-align:right; margin-bottom:8px;">${leftText.length} / ${MAX_CHARS}</div>
                    <div style="display:flex; gap:6px; width:100%; justify-content:center; align-items:center; flex-wrap:nowrap;">
                         <button class="btn-fill-label" data-side="left" data-label-content="${escape(leftLabel)}" style="height:38px; flex:1 1 auto; min-width:0; border-radius:19px; font-size:0.85em; font-weight:bold; cursor:pointer; background:var(--hapi-green-mist); color: var(--hapi-accent-text); border:1px solid var(--border-strong); box-sizing:border-box; white-space:nowrap; padding:0 10px; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/></svg> Titre</button>
                         <button class="btn-fill-prompt" data-side="left" data-text-content="${escape(leftText)}" style="height:38px; flex:1 1 auto; min-width:0; border-radius:19px; font-size:0.85em; font-weight:bold; cursor:pointer; background:var(--page-bg); color:var(--text-muted); border:1px solid #cbd5e0; box-sizing:border-box; white-space:nowrap; padding:0 10px; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg> Description</button>
                    </div>
                </div>

                <div class="panel-ia-left" style="display:${leftMode==='ia'?'block':'none'}; width:100%;">
                    <div style="width:100%; height:150px; background:var(--border); border-radius:6px; overflow:hidden; margin-bottom:8px; display:flex; justify-content:center; align-items:center;">
                         <img src="${urlLeft}" crossorigin="anonymous" class="img-preview-left" style="max-width:100%; max-height:100%; object-fit:contain; opacity:${leftPrompt?0.5:1};">
                    </div>
                    <div style="display:flex; gap:6px; width:100%; align-items:center; flex-wrap:nowrap;">
                        <input type="text" class="prompt-input-left" value="${escape(leftPromptFr)}" data-english="${escape(leftPrompt)}" style="height:38px; flex:1 1 auto; min-width:0; padding:0 12px; border:1px solid #cbd5e0; border-radius:19px; box-sizing:border-box; outline:none;">
                        <button class="btn-regen-img" data-side="left" style="height:38px; flex:0 0 38px; width:38px; margin:0; padding:0; border-radius:50%; background:var(--surface); border:1px solid #cbd5e0; cursor:pointer; display:flex; align-items:center; justify-content:center; box-sizing:border-box; font-size:1.1em; transition:background 0.2s;" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='var(--surface)'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg></button>
                    </div>
                </div>

                <div class="panel-upload-left" style="display:${leftMode==='upload'?'block':'none'}; width:100%;">
                    <div style="display:flex; justify-content:center; align-items:center; width:100%;">
                        <label for="${cardId}-upload-left" class="btn" style="height:32px; width:100%; display:flex; align-items:center; justify-content:center; gap:6px; margin:0; padding:0 12px; border-radius:16px; white-space:nowrap; font-weight:600; font-size:0.85em; background:var(--hapi-grad-a); color:white; border:none; cursor:pointer; box-sizing:border-box; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9l-.83-1.2A2 2 0 0 0 7.9 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg> Choisir image</label>
                        <input type="file" id="${cardId}-upload-left" class="input-file-left" data-side="left" accept="image/*" style="display:none;">
                    </div>
                    <div class="upload-preview-container-left" style="display:none; width:100%; height:150px; background:var(--border); border-radius:6px; overflow:hidden; justify-content:center; align-items:center; margin-top:8px;">
                        <img class="img-preview-upload-left" style="max-width:100%; max-height:100%; object-fit:contain;">
                    </div>
                </div>

                <div class="panel-wiki-left" style="display:${leftMode==='wiki'?'block':'none'}; width:100%;">
                    <div style="display:flex; gap:6px; width:100%; align-items:center; flex-wrap:nowrap; margin-bottom:8px;">
                        <input type="text" class="wiki-search-input-left" placeholder="Recherche Wiki..." style="height:38px; flex:1 1 auto; min-width:0; padding:0 12px; border:1px solid #cbd5e0; border-radius:19px; box-sizing:border-box; outline:none;">
                        <button class="btn-wiki-search" data-side="left" style="height:38px; flex:0 0 auto; padding:0 15px; margin:0; border-radius:19px; background:var(--hapi-green-dark); color:white; border:none; cursor:pointer; font-weight:bold; box-sizing:border-box; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>
                    </div>
                    <div class="wiki-results-grid-left" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:5px; max-height:200px; overflow-y:auto; background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:5px;"></div>
                    <div class="panel-wiki-selected-left" style="display:none; margin-top:10px; text-align:center; background:var(--page-bg); padding:10px; border-radius:6px;">
                        <img class="img-preview-wiki-left" crossorigin="anonymous" style="height:120px; object-fit:contain; border-radius:4px;">
                        <div class="wiki-credits-left" style="font-size:0.7em; color:var(--text-muted); margin-top:5px; word-break: break-all;"></div>
                        <button class="btn-remove-wiki" data-side="left" style="height:32px; margin-top:8px; background:transparent; color:var(--text); border:none; padding:0 12px; border-radius:16px; cursor:pointer; font-size:0.8em; font-weight:bold; transition:background 0.2s;" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='transparent'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg> Retirer</button>
                    </div>
                </div>
            </div>

            <div style="display:flex; align-items:center; justify-content:center; padding: 20px 0;">
                <button class="btn-swap-pair" title="Inverser les deux côtés" style="background:var(--surface); border:2px solid var(--hapi-green); color: var(--hapi-accent-text); border-radius:50%; width:40px; height:40px; cursor:pointer; font-size:1.2em; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.1); transition:all 0.2s;" onmouseover="this.style.background='var(--hapi-green-mist)'" onmouseout="this.style.background='var(--surface)'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg></button>
            </div>

            <div style="flex:1; min-width: 280px; background:var(--page-bg); padding:15px; border-radius:8px; border:1px dashed #cbd5e0; display:flex; flex-direction:column; gap:12px;">
                <div style="font-size:0.85em; font-weight:700; color:var(--text-muted); text-align:center;">Élément B</div>
                
                <select class="type-select" data-side="right" style="height:38px; width:100%; padding:0 10px; border-radius:6px; border:1px solid var(--border); background:var(--surface); box-sizing:border-box; outline:none; cursor:pointer;">
                    <option value="text" ${rightMode==='text'?'selected':''}>Texte</option>
                    <option value="upload" ${rightMode==='upload'?'selected':''}>Image locale</option>
                    <option value="wiki" ${rightMode==='wiki'?'selected':''}>Wikimedia</option>
                    <option value="ia" ${rightMode==='ia'?'selected':''}>Image IA</option>
                </select>
                
                <div class="panel-text-right" style="display:${rightMode==='text'?'block':'none'}; width:100%;">
                    <textarea class="input-text-right" rows="3" maxlength="${MAX_CHARS_2}" style="width:100%; padding:10px; border:1px solid #cbd5e0; border-radius:6px; margin-bottom:5px; box-sizing:border-box; outline:none; font-family:inherit; resize:vertical;">${rightText}</textarea>
                   <div class="char-counter" style="font-size:0.7em; color:var(--text-muted); text-align:right; margin-bottom:8px;">${rightText.length} / ${MAX_CHARS_2}</div>
                    <div style="display:flex; gap:6px; width:100%; justify-content:center; align-items:center; flex-wrap:nowrap;">
                         <button class="btn-fill-label" data-side="right" data-label-content="${escape(rightLabel)}" style="height:38px; flex:1 1 auto; min-width:0; border-radius:19px; font-size:0.85em; font-weight:bold; cursor:pointer; background:var(--hapi-green-mist); color: var(--hapi-accent-text); border:1px solid var(--border-strong); box-sizing:border-box; white-space:nowrap; padding:0 10px; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/></svg> Titre</button>
                         <button class="btn-fill-prompt" data-side="right" data-text-content="${escape(rightText)}" style="height:38px; flex:1 1 auto; min-width:0; border-radius:19px; font-size:0.85em; font-weight:bold; cursor:pointer; background:var(--page-bg); color:var(--text-muted); border:1px solid #cbd5e0; box-sizing:border-box; white-space:nowrap; padding:0 10px; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg> Description</button>
                    </div>
                </div>

                <div class="panel-ia-right" style="display:${rightMode==='ia'?'block':'none'}; width:100%;">
                    <div style="width:100%; height:150px; background:var(--border); border-radius:6px; overflow:hidden; margin-bottom:8px; display:flex; justify-content:center; align-items:center;">
                        <img src="${urlRight}" crossorigin="anonymous" class="img-preview-right" style="max-width:100%; max-height:100%; object-fit:contain; opacity:${rightPrompt?0.5:1};">
                    </div>
                    <div style="display:flex; gap:6px; width:100%; align-items:center; flex-wrap:nowrap;">
                        <input type="text" class="prompt-input-right" value="${escape(rightPromptFr)}" data-english="${escape(rightPrompt)}" style="height:38px; flex:1 1 auto; min-width:0; padding:0 12px; border:1px solid #cbd5e0; border-radius:19px; box-sizing:border-box; outline:none;">
                        <button class="btn-regen-img" data-side="right" style="height:38px; flex:0 0 38px; width:38px; margin:0; padding:0; border-radius:50%; background:var(--surface); border:1px solid #cbd5e0; cursor:pointer; display:flex; align-items:center; justify-content:center; box-sizing:border-box; font-size:1.1em; transition:background 0.2s;" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='var(--surface)'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg></button>
                    </div>
                </div>
                
                <div class="panel-upload-right" style="display:${rightMode==='upload'?'block':'none'}; width:100%;">
                    <div style="display:flex; justify-content:center; align-items:center; width:100%;">
                        <label for="${cardId}-upload-right" class="btn" style="height:32px; width:100%; display:flex; align-items:center; justify-content:center; gap:6px; margin:0; padding:0 12px; border-radius:16px; white-space:nowrap; font-weight:600; font-size:0.85em; background:var(--hapi-grad-a); color:white; border:none; cursor:pointer; box-sizing:border-box; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9l-.83-1.2A2 2 0 0 0 7.9 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg> Choisir image</label>
                        <input type="file" id="${cardId}-upload-right" class="input-file-right" data-side="right" accept="image/*" style="display:none;">
                    </div>
                    <div class="upload-preview-container-right" style="display:none; width:100%; height:150px; background:var(--border); border-radius:6px; overflow:hidden; justify-content:center; align-items:center; margin-top:8px;">
                        <img class="img-preview-upload-right" style="max-width:100%; max-height:100%; object-fit:contain;">
                    </div>
                </div>

                <div class="panel-wiki-right" style="display:${rightMode==='wiki'?'block':'none'}; width:100%;">
                    <div style="display:flex; gap:6px; width:100%; align-items:center; flex-wrap:nowrap; margin-bottom:8px;">
                        <input type="text" class="wiki-search-input-right" placeholder="Recherche Wiki..." style="height:38px; flex:1 1 auto; min-width:0; padding:0 12px; border:1px solid #cbd5e0; border-radius:19px; box-sizing:border-box; outline:none;">
                        <button class="btn-wiki-search" data-side="right" style="height:38px; flex:0 0 auto; padding:0 15px; margin:0; border-radius:19px; background:var(--hapi-green-dark); color:white; border:none; cursor:pointer; font-weight:bold; box-sizing:border-box; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>
                    </div>
                    <div class="wiki-results-grid-right" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:5px; max-height:200px; overflow-y:auto; background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:5px;"></div>
                    <div class="panel-wiki-selected-right" style="display:none; margin-top:10px; text-align:center; background:var(--page-bg); padding:10px; border-radius:6px;">
                        <img class="img-preview-wiki-right" crossorigin="anonymous" style="height:120px; object-fit:contain; border-radius:4px;">
                        <div class="wiki-credits-right" style="font-size:0.7em; color:var(--text-muted); margin-top:5px; word-break: break-all;"></div>
                        <button class="btn-remove-wiki" data-side="right" style="height:32px; margin-top:8px; background:transparent; color:var(--text); border:none; padding:0 12px; border-radius:16px; cursor:pointer; font-size:0.8em; font-weight:bold; transition:background 0.2s;" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='transparent'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg> Retirer</button>
                    </div>
                </div>

            </div>
        </div>
    `;
    container.appendChild(card);

    const txtLeft = card.querySelector('.input-text-left');
    if(txtLeft) txtLeft.dispatchEvent(new Event('input'));
    const txtRight = card.querySelector('.input-text-right');
    if(txtRight) txtRight.dispatchEvent(new Event('input'));

    document.getElementById('preview-section-imgpair').style.display = 'block';
    const genSec = document.getElementById('generate-section');
    if(genSec) genSec.style.display = 'block';
    
    updatePairNumbers();
    updateGenerateButtonCallback();
}

function setupListDelegation() {
    const list = document.getElementById('imgpair-list');
    
    list.addEventListener('click', async (e) => {
        const card = e.target.closest('.card');
        if (!card) return;

        if (e.target.closest('.delete-btn')) {
            if(confirm("Supprimer cette paire ?")) {
                card.remove();
                updatePairNumbers();
                updateGenerateButtonCallback();
            }
        }

        if (e.target.closest('.btn-swap-pair')) {
            const selL = card.querySelector('.type-select[data-side="left"]');
            const selR = card.querySelector('.type-select[data-side="right"]');
            
            const txtL = card.querySelector('.input-text-left');
            const txtR = card.querySelector('.input-text-right');
            const pmtL = card.querySelector('.prompt-input-left');
            const pmtR = card.querySelector('.prompt-input-right');

            const imgL = card.querySelector('.img-preview-left');
            const imgR = card.querySelector('.img-preview-right');

            const wikiInpL = card.querySelector('.wiki-search-input-left');
            const wikiInpR = card.querySelector('.wiki-search-input-right');
            const wikiImgL = card.querySelector('.img-preview-wiki-left');
            const wikiImgR = card.querySelector('.img-preview-wiki-right');
            const wikiCredL = card.querySelector('.wiki-credits-left');
            const wikiCredR = card.querySelector('.wiki-credits-right');
            const wikiSelPanelL = card.querySelector('.panel-wiki-selected-left');
            const wikiSelPanelR = card.querySelector('.panel-wiki-selected-right');

            const fileInpL = card.querySelector('.input-file-left');
            const fileInpR = card.querySelector('.input-file-right');
            const uploadImgL = card.querySelector('.img-preview-upload-left');
            const uploadImgR = card.querySelector('.img-preview-upload-right');
            const uploadContL = card.querySelector('.upload-preview-container-left');
            const uploadContR = card.querySelector('.upload-preview-container-right');

            const typeTemp = selL.value; selL.value = selR.value; selR.value = typeTemp;

            const txtTemp = txtL.value; txtL.value = txtR.value; txtR.value = txtTemp;
            const pmtTemp = pmtL.value; pmtL.value = pmtR.value; pmtR.value = pmtTemp;

            const srcTemp = imgL.src; imgL.src = imgR.src; imgR.src = srcTemp;

            const wInpTemp = wikiInpL.value; wikiInpL.value = wikiInpR.value; wikiInpR.value = wInpTemp;
            const wImgTemp = wikiImgL.src; wikiImgL.src = wikiImgR.src; wikiImgR.src = wImgTemp;
            const wCredTemp = wikiCredL.innerText; wikiCredL.innerText = wikiCredR.innerText; wikiCredR.innerText = wCredTemp;
            const wDispTemp = wikiSelPanelL.style.display; 
            wikiSelPanelL.style.display = wikiSelPanelR.style.display; 
            wikiSelPanelR.style.display = wDispTemp;

            const dtL = new DataTransfer();
            if (fileInpR.files && fileInpR.files.length > 0) dtL.items.add(fileInpR.files[0]);
            
            const dtR = new DataTransfer();
            if (fileInpL.files && fileInpL.files.length > 0) dtR.items.add(fileInpL.files[0]);
            
            fileInpL.files = dtL.files;
            fileInpR.files = dtR.files;

            const upImgTemp = uploadImgL.src;
            uploadImgL.src = uploadImgR.src;
            uploadImgR.src = upImgTemp;

            const upDispTemp = uploadContL.style.display;
            uploadContL.style.display = uploadContR.style.display;
            uploadContR.style.display = upDispTemp;

            updatePanelVisibility(card, 'left', selL.value);
            updatePanelVisibility(card, 'right', selR.value);

            updateGenerateButtonCallback();
        }
        
        const fillLabelBtn = e.target.closest('.btn-fill-label');
        if (fillLabelBtn) {
            e.preventDefault();
            const side = fillLabelBtn.dataset.side;
            const textArea = card.querySelector(`.input-text-${side}`);
            if (textArea) textArea.value = fillLabelBtn.dataset.labelContent || "";
        }
        const fillPromptBtn = e.target.closest('.btn-fill-prompt');
        if (fillPromptBtn) {
            e.preventDefault();
            const side = fillPromptBtn.dataset.side;
            const textArea = card.querySelector(`.input-text-${side}`);
            if (textArea) textArea.value = fillPromptBtn.dataset.textContent || "";
        }

        const regenBtn = e.target.closest('.btn-regen-img');
        if (regenBtn) {
            const side = regenBtn.dataset.side;
            const promptInput = card.querySelector(`.prompt-input-${side}`);
            const imgPreview = card.querySelector(`.img-preview-${side}`);
            const btn = regenBtn;
            
            if (promptInput && promptInput.value.trim()) {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = ''; btn.disabled = true;
                imgPreview.style.opacity = "0.5";
                
                try {
                    let englishPrompt = promptInput.dataset.english;
                    if (!englishPrompt) {
                         englishPrompt = await translateToEnglish(promptInput.value);
                         promptInput.dataset.english = englishPrompt;
                    }
                    
                    const result = await generateImageWithFallback(englishPrompt);
                    
                    imgPreview.onload = () => {
                        imgPreview.style.opacity = "1";
                        btn.innerHTML = originalHTML; btn.disabled = false;
                    };
                    imgPreview.onerror = () => {
                        imgPreview.style.opacity = "1";
                        btn.innerHTML = "✕"; btn.disabled = false;
                    };
                    imgPreview.src = result.url;
                    
                } catch (err) {
                    console.error("Erreur Regen:", err);
                    btn.innerHTML = "✕"; btn.disabled = false;
                }
            }
        }

        if (e.target.closest('.btn-wiki-search')) {
            const side = e.target.dataset.side; 
            const input = card.querySelector(`.wiki-search-input-${side}`);
            const grid = card.querySelector(`.wiki-results-grid-${side}`);
            const query = input.value.trim();

            if (!query) return;

            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:10px; color:var(--text-muted);">Recherche en cours...</div>';
            
            try {
                const images = await searchWikimedia(query); 
                grid.innerHTML = '';

                if (images.length === 0) {
                    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:10px; color:var(--text-muted);">Aucun résultat trouvé.</div>';
                    return;
                }

                images.forEach(img => {
                    const thumb = document.createElement('div');
                    thumb.style.cssText = "height:80px; cursor:pointer; border:2px solid transparent; border-radius:4px; overflow:hidden; position:relative;";
                    thumb.innerHTML = `<img src="${img.thumb}" style="width:100%; height:100%; object-fit:cover;" title="${img.title}">`;
                    
                    thumb.onmouseover = () => thumb.style.borderColor = "var(--hapi-green)";
                    thumb.onmouseout = () => thumb.style.borderColor = "transparent";
                    
                    thumb.onclick = () => openLightbox(img, card, side);
                    grid.appendChild(thumb);
                });
            } catch (err) {
                grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#b91c1c;">Erreur de connexion.</div>';
            }
        }

        if (e.target.classList.contains('btn-remove-wiki')) {
            const side = e.target.dataset.side;
            const previewZone = card.querySelector(`.panel-wiki-selected-${side}`);
            const img = card.querySelector(`.img-preview-wiki-${side}`);
            const credits = card.querySelector(`.wiki-credits-${side}`);
            
            img.src = "";
            if(credits) credits.innerText = "";
            previewZone.style.display = 'none';
            updateGenerateButtonCallback();
        }
    });

    list.addEventListener('change', (e) => {
        const card = e.target.closest('.card');
        if(!card) return;

        if (e.target.classList.contains('type-select')) {
            const side = e.target.dataset.side;
            const type = e.target.value;
            
            updatePanelVisibility(card, side, type);

            if (type === 'wiki') {
                const wikiInput = card.querySelector(`.wiki-search-input-${side}`);
                const textInput = card.querySelector(`.input-text-${side}`);
                const wikiBtn = card.querySelector(`.btn-wiki-search[data-side="${side}"]`);
                
                if (wikiInput && !wikiInput.value.trim() && textInput && textInput.value.trim()) {
                    wikiInput.value = textInput.value.trim();
                    if(wikiBtn) wikiBtn.click();
                }
            }
        }

        if (e.target.type === 'file') {
            const file = e.target.files[0];
            const side = e.target.dataset.side;
            const container = card.querySelector(`.upload-preview-container-${side}`);
            const imgPreview = card.querySelector(`.img-preview-upload-${side}`);

            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    imgPreview.src = event.target.result;
                    if (container) container.style.display = 'flex';
                    updateGenerateButtonCallback();
                };
                reader.readAsDataURL(file);
            } else {
                imgPreview.src = '';
                if (container) container.style.display = 'none';
            }
        }
    });
    
    list.addEventListener('input', (e) => {
        if (e.target.tagName === 'TEXTAREA' && e.target.maxLength > 0) {
            const counter = e.target.nextElementSibling;
            if (counter && counter.classList.contains('char-counter')) {
                counter.innerText = `${e.target.value.length} / ${e.target.maxLength}`;
            }
        }
        if (e.target.classList.contains('prompt-input-left') || e.target.classList.contains('prompt-input-right')) {
            delete e.target.dataset.english;
        }
    });
}

function showRegenerateButton() {
    const genContainer = document.getElementById('step-generation-container');
    
    // Si la zone IA a déjà été générée
    if (genContainer && genContainer.style.display === 'block') {
        const btnManual = document.getElementById('btn-manual-generate');
        const btnIA = document.getElementById('prepare-ia-btn-imgpair');

        if (btnManual) {
            btnManual.style.display = 'flex';
            btnManual.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg> Valider & regénérer';
        }
        if (btnIA) {
            if (btnIA.parentElement) btnIA.parentElement.style.display = 'block';
            btnIA.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg> Régénérer le prompt';
        }
    }
}

// =========================================================
// 💾 GESTION IMPORT / EXPORT (déléguée à utils/states/image-pairing-state.js)
// =========================================================

export async function getUIState() {
    return await getImagePairingState();
}

export function setUIState(config) {
    setImagePairingState(config, {
        injectStepBlock: injectStepBlock,
        updatePanelVis: updatePanelVisibility,
        updatePairNumbers: updatePairNumbers,
        clearPreview: () => {
            const list = document.getElementById('imgpair-list');
            if (list) list.innerHTML = '';
            pairCounter = 0; // Réinitialisation du compteur lors du chargement
        },
        addCard: () => addPairCard(), 
        updateBtn: updateGenerateButtonCallback
    });
}

export function gatherData() {
    logger.log('📊 Extraction des données Image Pairing...');
    
    const langSelect = document.getElementById('global-language');
    const lang = langSelect ? langSelect.value : 'Français';
    const translateCheckbox = document.getElementById('translate-ui-imgpair');
    const uiLanguage = (translateCheckbox && translateCheckbox.checked) ? lang : 'Français';
    const uiTranslations = getH5PLocalization(uiLanguage, 'ImagePair');

    const niveauSelect = document.getElementById('global-niveau');
    const niveau = niveauSelect ? niveauSelect.value : 'Cycle 2';

    const pairs = [];
    const cards = document.querySelectorAll('#imgpair-list .card');
    
    if (cards.length === 0) {
        alert("Attention : Aucune paire n'a été créée.");
        return null;
    }

    cards.forEach(card => {
        const pairData = { left: {}, right: {} };
        
        const extractSide = (side) => {
            const typeSelect = card.querySelector(`.type-select[data-side="${side}"]`);
            if (!typeSelect) return { type: 'text', content: 'Erreur' };

            const type = typeSelect.value;
            const data = { type: type };
            
            if (type === 'text') {
                data.content = card.querySelector(`.input-text-${side}`).value.trim() || "Texte vide";
            }

            else if (type === 'ia') {
                const img = card.querySelector(`.img-preview-${side}`);
                const promptInput = card.querySelector(`.prompt-input-${side}`);
                
                if (img && img.src && img.complete && img.naturalHeight !== 0 && !img.src.includes('hapi-ph')) {
                    const base64Result = imageToBase64(img);
                    
                    if (base64Result) {
                        data.src = base64Result;
                    } else {
                        data.src = img.src;
                        data.needsFetch = true;
                        data.prompt = promptInput ? promptInput.value : "";
                    }
                } else {
                    data.src = localPlaceholder('Image Manquante');
                    data.needsFetch = true;
                }
            }

            else if (type === 'upload') {
                const fileInput = card.querySelector(`.input-file-${side}`);
                if (fileInput && fileInput.files.length > 0) {
                    data.file = fileInput.files[0]; 
                } else {
                    data.src = localPlaceholder('Fichier Manquant');
                    data.needsFetch = true;
                }
            }

            else if (type === 'wiki') {
                const img = card.querySelector(`.img-preview-wiki-${side}`);
                const wrapper = card.querySelector(`.panel-wiki-selected-${side}`);
                
                if (wrapper && wrapper.style.display !== 'none' && img && img.src) {
                    const base64Result = imageToBase64(img);
                    
                    if (base64Result) {
                        data.src = base64Result;
                    } else {
                        data.src = img.src;
                        data.needsFetch = true;
                    }
                    
                    const creditsDiv = card.querySelector(`.wiki-credits-${side}`);
                    if(creditsDiv) data.alt = creditsDiv.innerText; 
                } else {
                    data.src = localPlaceholder('Wiki Vide');
                    data.needsFetch = true;
                }
            }

            return data;
        };
        
        pairData.left = extractSide('left');
        pairData.right = extractSide('right');
        
        pairs.push(pairData);
    });

    return {
        titre: document.getElementById('imgpair-title').value || "Activité Images",
		niveau: niveau,
        consignes: document.getElementById('imgpairTask')?.value || "Associez les éléments correspondants.", 
        pairs: pairs,
        l10n: uiTranslations
    };
}