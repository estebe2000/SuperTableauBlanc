// Fichier: modules/ui/dragndrop-ui.js
// Module de Catégorisation (Drag & Drop) pour HAPI

import { logger } from '../utils/logger.js';
import { localPlaceholder } from '../utils/placeholder.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_Categorisation } from '../ia/prompt-builder.js';
import { SourceSelector } from './source-selector.js';
import { openFabricEditor } from '../utils/image-editor.js';
import { 
    creerAssistantIA_HTML, 
    creerFeedbackIntervallesHTML, 
    initFeedbackIntervalles, 
    getFeedbackIntervallesData, 
    setFeedbackIntervallesData 
} from '../utils/helpers.js';

import { getDragNDropState, setDragNDropState } from '../utils/states/dragndrop-state.js';

let container = null;
let corpus = '';
let updateGenerateButtonCallback = () => {};
let localSourceSelector = null;
let currentRepartition = {};
let uploadedImageURL = null;
let fabricJSONState = null;

let _zones = [];    
let _elements = []; 

// ==========================================
// 🎨 MOTEUR MULTIMÉDIA (IA, WIKI, BASE64)
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
        return { url: IMAGE_SERVICES.n8n.getURL(prompt), service: 'n8n' };
    }
    return { url: localPlaceholder('Erreur', {w:300,h:300,bg:'#fee2e2',fg:'#b91c1c'}), service: 'placeholder', error: true };
}

async function translateToEnglish(text) {
    if (!text) return '';
    try {
        // 🌟 PROMPT SPÉCIFIQUE POUR IMAGE IA
        const promptSysteme = `You are an expert at writing prompts for AI image generators.
Translate the following French description into an optimized English image prompt. 
Reply ONLY with the English translation, no explanation, no quotes. 
Add relevant keywords like "illustration, clear background" if appropriate.
Text: ${text}`;

        let translated = '';
        if (window.parent && typeof window.parent.makeNonStreamingRequest === 'function') {
            translated = await window.parent.makeNonStreamingRequest(promptSysteme, {
                tool: 'professor'
            });
        } else {
            const response = await fetch((typeof window !== 'undefined' ? window.location.origin : '') + "/proxy-n8n/webhook/hapi_albert", {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: promptSysteme })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            translated = data.response || data.text || data.output || data.choices?.[0]?.message?.content || data.choices?.[0]?.text;
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
        return text; // Fallback sur le texte original
    }
}

async function urlToBase64(url) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (e) { console.error("Erreur conversion image", e); return null; }
}

async function searchWikimedia(query) {
    if (!query || query.length < 2) return [];
    const endpoint = "https://commons.wikimedia.org/w/api.php";
    const params = new URLSearchParams({
        action: "query", generator: "search", gsrnamespace: "6", gsrsearch: `${query} filetype:bitmap`, gsrlimit: "15", 
        prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "400", format: "json", origin: "*" 
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
            if (['.pdf', '.djvu', '.ogv', '.webm'].some(ext => title.toLowerCase().endsWith(ext))) return null;
            return {
                thumb: info.thumburl, full: info.url, title: title,
                artist: meta.Artist ? meta.Artist.value.replace(/<\/?[^>]+(>|$)/g, "") : "Inconnu",
                license: meta.LicenseShortName ? meta.LicenseShortName.value : "CC BY-SA"
            };
        }).filter(item => item !== null);
    } catch (e) { return []; }
}

function openLightbox(imgData, elId) {
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
    modal.querySelector('#select-this-img').onclick = async () => {
        const btn = modal.querySelector('#select-this-img');
        btn.innerHTML = 'Chargement...'; btn.disabled = true;
        
        const b64 = await urlToBase64(imgData.full);
        const el = _elements.find(e => e.id === elId);
        if (el && b64) {
            el.wikiImgSrc = b64;
            el.wikiCredits = `Crédit : ${imgData.artist} (${imgData.license})`;
            el.wikiSelected = true;
            _renderUI();
        }
        modal.remove();
    };
}

// ==========================================
// ⚙️ INITIALISATION UI ET UTILITAIRES
// ==========================================

function _createNewElement(text = 'Nouvelle étiquette', targets = [], contextPrompt = '') {
    return {
        id: _genId('e'), mode: 'text', text: text, targets: targets,
        uploadB64: null, wikiSearch: text, wikiImgSrc: null, wikiCredits: '', wikiSelected: false, iaPrompt: contextPrompt || text, iaB64: null
    };
}

function _genId(prefix) { return prefix + '_' + Math.random().toString(36).substr(2, 9); }
function _esc(str) { return String(str||'').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

export function init(targetContainer, corpusContent, updateBtnCallback) {
    container = targetContainer;
    corpus = corpusContent;
    updateGenerateButtonCallback = updateBtnCallback;
    _zones = [];
    _elements = [];

    logger.log('📦 Initialisation de Catégorisation UI (Multimédia, rigoureux, sans doublons)...');

    const rawSources = corpusManager.getCorpusSources();
    const documentsList = [
        { id: 'all', title: 'Tout le corpus', content: corpusContent, type: 'all', priority: 2 },
        ...rawSources.map(s => ({ id: s.id, title: s.name, content: s.data || s.content || corpusContent, type: s.type, priority: s.priority !== undefined ? s.priority : 2 }))
    ];

    container.innerHTML = `
        <div id="cat-lightbox-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; justify-content:center; align-items:center; cursor:zoom-out;">
            <img id="cat-lightbox-img" src="" style="max-width:90%; max-height:90%; border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.5);">
        </div>

        <div id="cat-generator-wrapper">
            <div class="section" style="background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <div id="cat-source-selector"></div>
                <div id="cat-questions-repartition"></div>

                <h2 style="margin:0 0 15px 0; color:var(--text); font-size:1.4rem; font-weight:bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configuration de l'activité</h2>

                <div style="display:grid; grid-template-columns:1fr; gap:15px; margin-bottom:25px;">
                    <div class="input-group" style="margin:0;">
                        <label style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Titre de l'activité :</label>
                        <input type="text" id="cat-title" value="Activité de déplacement d'étiquettes" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div class="input-group" style="margin:0;">
                        <label style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Consigne pour l'élève :</label>
                        <input type="text" id="cat-consigne" value="Légendez le schéma ou classez les éléments." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                </div>

                <div style="margin-top: 20px; padding: 20px; background: var(--page-bg); border: 1px solid var(--border); border-radius: 8px;">
                    <label style="font-weight:bold; display:block; margin-bottom:8px; color: var(--text); font-size:1.1em;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.83-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C22 6 17.5 2 12 2z"/></svg> Mode d'affichage de l'exercice :</label>
                    <select id="cat-layout-mode" style="width:100%; padding:10px; border-radius:6px; border:2px solid #64748b; font-size: 1em; cursor: pointer;">
                        <option value="table">Mode Tableau (colonnes générées automatiquement)</option>
                        <option value="image">Mode Image (schéma à légender)</option>
                    </select>

				<div id="cat-image-upload-section" style="display:none; margin-top: 15px; padding-top: 15px; border-top: 1px dashed var(--border);">
                        <label style="font-weight:bold; display:block; margin-bottom:8px; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9l-.83-1.2A2 2 0 0 0 7.9 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg> Importez votre image de fond :</label>
                        <input type="file" id="cat-bg-image" accept="image/png, image/jpeg, image/jpg" style="width:100%; padding:10px; background:var(--page-bg); border:1px dashed var(--border); border-radius:6px; cursor: pointer; color: var(--text-muted);">

                        <div id="cat-thumbnail-container" style="display:none; margin-top: 15px; text-align: center;">
                            <p style="font-size: 0.85em; color: #64748b; margin-bottom: 5px;">Aperçu de l'image (cliquez pour zoomer) :</p>
                            <img id="cat-thumbnail-img" src="" style="max-height: 120px; max-width: 100%; border-radius: 6px; border: 2px solid #e2e8f0; cursor: zoom-in; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        </div>
	
						<button id="btn-edit-bg" class="btn" style="display:none; margin-top:10px; margin-left:auto; margin-right:auto; background:var(--hapi-green-dark); color:white; width:30%; padding:10px; border:none; border-radius:25px; cursor:pointer; font-weight:bold;">
    						<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.83-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C22 6 17.5 2 12 2z"/></svg> Annoter l'image de fond
						</button>
	
                    </div>
                </div>

                <div id="prepare-action-cat" style="margin-top:35px; text-align:center;">
                    <button id="btn-prepare-prompt-cat" class="btn" style="padding:10px 22px; font-size:1em; font-weight:600; background:linear-gradient(45deg,var(--hapi-grad-a),var(--hapi-green-dark)); color:white; border:none; cursor:pointer; border-radius:25px;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Préparer le contenu avec l'IA
                    </button>
                </div>
            </div>

            <div id="ia-container-cat" class="section" style="display:none; margin-top:20px; background:var(--surface); border-radius:8px; padding:25px;">
                ${creerAssistantIA_HTML('ia-prompt-cat', 'ia-response-cat')}
            </div>

            <div id="albert-action-cat" style="display:none; text-align:center; margin-top:15px; margin-bottom:30px;">
                <button id="btn-send-albert-cat" class="btn" style="padding:10px 22px; font-size:1em; font-weight:600; background:linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color:white; border:none; cursor:pointer; border-radius:25px;">
                    🇫🇷 Envoyer le prompt à l'IA
                </button>
            </div>

            <div id="cat-visual-editor-section" style="margin-top: 20px; display:none;">
                <div class="section" style="background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border-top: 5px solid var(--hapi-green);">
                    <h3 style="margin:0 0 10px 0; color: var(--hapi-accent-text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg> Positionnement des zones de dépôt sur l'image</h3>
                    <div id="cat-image-editor-container"></div>
                    <p id="cat-editor-hint" style="font-size: 0.85em; color: var(--hapi-accent-text); margin-top: 10px; font-weight:bold;">Déplacez et redimensionnez les boîtes bleues pour définir vos zones de dépôt !</p>
                </div>
            </div>

            <div class="section" id="cat-preview-section" style="display:none; margin-top:20px; background:var(--surface); border-radius:8px; padding:25px;">
                <h2 style="margin:0 0 20px 0; border-bottom:2px solid var(--border); padding-bottom:10px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Éditez les correspondances</h2>
                <p id="cat-status-indicator" style="font-weight:bold; color:#e11d48; font-size:0.9em; margin-bottom:20px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> Il faut au moins 1 zone et 1 étiquette valide.</p>

                <div style="display:flex; flex-direction:column; gap:30px;">
                    <div style="background:var(--page-bg); border:1px solid var(--border); border-radius:8px; padding:20px;">
                        <h3 style="margin-top:0; color:var(--text); display:flex; justify-content:space-between; align-items:center;">
                            <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg> Zones de dépôt</span>
                            <button id="btn-add-zone" class="btn" style="background:#475569; color:white; border:none; padding:6px 12px; border-radius:25px; cursor:pointer; font-size:0.85em;">+ Ajouter une zone</button>
                        </h3>
                        <div id="cat-zones-list" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:12px;"></div>
                    </div>

                    <div style="background:var(--hapi-green-mist); border:1px solid var(--border-strong); border-radius:8px; padding:20px;">
                        <h3 style="margin-top:0; color: var(--hapi-accent-text); display:flex; justify-content:space-between; align-items:center;">
                            <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4z"/><circle cx="7" cy="7" r="1.5"/></svg> Étiquettes (textes ou images)</span>
                            <button id="btn-add-element" class="btn" style="background:var(--hapi-green-dark); color:white; border:none; padding:6px 12px; border-radius:25px; cursor:pointer; font-size:0.85em;">+ Ajouter une étiquette</button>
                        </h3>
                        <div id="cat-elements-list" style="display:flex; flex-direction:column; gap:15px;"></div>
                    </div>
                </div>

                <details style="margin-top:30px; background:var(--page-bg); border:1px solid var(--border); border-radius:6px; padding:15px;">
                    <summary style="font-weight:bold; font-size:1.1em; color:var(--text); cursor:pointer; outline:none;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options H5P globales</summary>
                    <div style="margin-top:15px;" id="cat-global-wrapper">
                        <style>#cat-global-wrapper .section { padding: 0; box-shadow: none; border: none; background: transparent; margin: 0; }</style>
                        ${creerFeedbackIntervallesHTML('cat', '')}
                        <hr style="border:0; border-top:1px solid var(--border); margin:25px 0 20px 0;">
                        <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px; display:flex; flex-direction:column; gap:15px;">
                            <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 5px;">Paramètres de comportement</div>
                            <div style="background: var(--hapi-green-mist); padding: 15px; border-radius: 6px; border: 1px solid var(--border-strong); margin-bottom: 10px;">
                                <label style="display:flex; align-items:flex-start; cursor:pointer;">
                                    <input type="checkbox" id="cat-free-drop" checked style="margin-top:4px; margin-right:12px; width:18px; height:18px; accent-color:var(--hapi-green);">
                                    <div>
                                        <span style="font-size:1.05em; font-weight:bold; color: var(--hapi-accent-text);">Dépôt libre (anti-triche)</span>
                                        <p style="margin: 4px 0 0 0; font-size: 0.85em; color: var(--hapi-accent-text);">Si activé, l'élève peut déposer n'importe quel élément dans n'importe quelle zone. Sinon, l'élément rebondira si la zone est fausse.</p>
                                    </div>
                                </label>
                            </div>
                            <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" id="cat-enable-retry" checked style="margin-right:10px; width:16px; height:16px;"><span style="font-size:0.95em; font-weight:bold;">Activer le bouton "Recommencer"</span></label>
                            <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" id="cat-single-point" style="margin-right:10px; width:16px; height:16px;"><span style="font-size:0.95em; font-weight:bold;">Donner un point pour la question dans sa globalité</span></label>
                            <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" id="cat-apply-penalties" checked style="margin-right:10px; width:16px; height:16px;"><span style="font-size:0.95em; font-weight:bold;">Appliquer des pénalités</span></label>
                            <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" id="cat-enable-score-explanation" checked style="margin-right:10px; width:16px; height:16px;"><span style="font-size:0.95em; font-weight:bold;">Activer les explications du score</span></label>
                            <div style="display:flex; flex-direction:column; gap:5px; margin-top:5px;"><label for="cat-background-opacity" style="font-size:0.95em; font-weight:bold;">Opacité des étiquettes (0 à 100) :</label><input type="number" id="cat-background-opacity" value="100" min="0" max="100" style="width:100px; padding:6px; border:1px solid #ccc; border-radius:4px;"></div>
                            <div style="display:flex; flex-direction:column; gap:5px; margin-top:5px;"><label for="cat-drop-zone-highlighting" style="font-size:0.95em; font-weight:bold;">Mise en évidence de la zone de dépôt :</label><select id="cat-drop-zone-highlighting" style="width:250px; padding:6px; border:1px solid #ccc; border-radius:4px;"><option value="never">Jamais</option><option value="dragging" selected>Lors du glisser-déposer</option><option value="always">Toujours</option></select></div>
                            <div style="display:flex; flex-direction:column; gap:5px; margin-top:5px;"><label for="cat-auto-align-spacing" style="font-size:0.95em; font-weight:bold;">Marge pour l'alignement automatique (en pixels) :</label><input type="number" id="cat-auto-align-spacing" value="2" min="0" style="width:100px; padding:6px; border:1px solid #ccc; border-radius:4px;"></div>
                            <label style="display:flex; align-items:center; cursor:pointer; margin-top:10px;"><input type="checkbox" id="cat-enable-fullscreen" checked style="margin-right:10px; width:16px; height:16px;"><span style="font-size:0.95em; font-weight:bold;">Activer le bouton Plein écran</span></label>
                            <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" id="cat-show-score-points" checked style="margin-right:10px; width:16px; height:16px;"><span style="font-size:0.95em; font-weight:bold;">Montrer les points de votre score</span></label>
                            <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" id="cat-show-title" checked style="margin-right:10px; width:16px; height:16px;"><span style="font-size:0.95em; font-weight:bold;">Afficher le titre</span></label>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    `;

    _injectStyles();
    initFeedbackIntervalles('cat');



// On récupère le bouton
    const btnEditBg = container.querySelector('#btn-edit-bg');

    // Quand l'utilisateur clique sur le bouton de retouche
	if (btnEditBg) {
	        btnEditBg.onclick = () => {
	            if (!uploadedImageURL) return;

	            // On passe uploadedImageURL ET fabricJSONState
	            openFabricEditor(uploadedImageURL, fabricJSONState, (annotatedBase64, newJSONState) => {
	                uploadedImageURL = annotatedBase64; // L'image aplatie pour l'affichage
	                fabricJSONState = newJSONState;     // L'état vectoriel pour la prochaine édition
                
	                container.querySelector('#cat-bg-image').value = ''; 
                
	                _renderThumbnail();
	                _renderUI();        
                
	                logger.log("✅ Image de fond mise à jour avec les annotations (éditables).");
	            });
	        };
	    }

	// Petit helper pour transformer le résultat de Fabric en fichier
	function base64ToFile(base64, filename) {
	    const arr = base64.split(',');
	    const mime = arr[0].match(/:(.*?);/)[1];
	    const bstr = atob(arr[1]);
	    let n = bstr.length;
	    const u8arr = new Uint8Array(n);
	    while(n--) u8arr[n] = bstr.charCodeAt(n);
	    return new File([u8arr], filename, { type: mime });
	}



	const selectorDiv = container.querySelector('#cat-source-selector');
	    if (selectorDiv) {
	        localSourceSelector = new SourceSelector(selectorDiv, documentsList, 'cat', (selectedDocs) => {
	            _renderRepartitionConfig(selectedDocs);
	            showRegenerateButton(); // <-- Déclenchement au changement de source
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

	    // 2. Écouteur sur le Mode d'affichage (qui est envoyé dans le prompt IA)
	    const layoutMode = container.querySelector('#cat-layout-mode');
	    if (layoutMode) {
	        layoutMode.addEventListener('change', (e) => {
	            container.querySelector('#cat-image-upload-section').style.display = e.target.value === 'image' ? 'block' : 'none';
	            _renderUI();
	            showRegenerateButton();
	        });
	    }

	    // 3. Écouteur sur la répartition (Nombre de catégories à générer)
	    const repartitionContainer = container.querySelector('#cat-questions-repartition');
	    if (repartitionContainer) {
	        repartitionContainer.addEventListener('input', (e) => {
	            if (e.target.classList.contains('source-question-count')) {
	                showRegenerateButton();
	            }
	        });
	    }

	container.querySelector('#cat-bg-image').addEventListener('change', (e) => {
	        const file = e.target.files[0];
	        const editBtn = container.querySelector('#btn-edit-bg'); 
    
	        if (file) {
	            const reader = new FileReader();
	            reader.onload = (evt) => { 
	                uploadedImageURL = evt.target.result; 
	                fabricJSONState = null; // 👈 AJOUT: On purge l'ancien JSON
	                _renderThumbnail(); 
	                _renderUI(); 
	                if (editBtn) editBtn.style.display = 'block'; 
	            };
	            reader.readAsDataURL(file);
	        } else { 
	            uploadedImageURL = null; 
	            fabricJSONState = null; // 👈 AJOUT
	            _renderThumbnail(); 
	            _renderUI(); 
	            if (editBtn) editBtn.style.display = 'none'; 
	        }
	    });

    container.querySelector('#cat-thumbnail-img').addEventListener('click', () => {
        if (uploadedImageURL) { container.querySelector('#cat-lightbox-img').src = uploadedImageURL; container.querySelector('#cat-lightbox-overlay').style.display = 'flex'; }
    });

    container.querySelector('#cat-lightbox-overlay').addEventListener('click', (e) => { e.currentTarget.style.display = 'none'; });

    container.querySelector('#btn-prepare-prompt-cat').addEventListener('click', _handlePreparePrompt);
    container.querySelector('#btn-send-albert-cat').addEventListener('click', _handleGenerateAlbert);
    container.querySelector('#btn-parse-ia-response-cat').addEventListener('click', _handleParseIA);
    
    container.querySelector('#btn-add-zone').addEventListener('click', () => { 
        _zones.push({ id: _genId('z'), nom: 'Nouvelle zone' }); 
        _renderUI(); 
    });
    
    container.querySelector('#btn-add-element').addEventListener('click', () => { 
        _elements.push(_createNewElement()); 
        _renderUI(); 
    });
}

// ─── MOTEUR DE RENDU UI ──────────────────────────────────────────────────────

function _renderThumbnail() {
    const thumbContainer = container.querySelector('#cat-thumbnail-container');
    const thumbImg = container.querySelector('#cat-thumbnail-img');
    const btnEditBg = container.querySelector('#btn-edit-bg'); // 👈 On cible le bouton d'annotation

    if (uploadedImageURL) { 
        thumbImg.src = uploadedImageURL; 
        thumbContainer.style.display = 'block'; 
        
        // Fait apparaître le bouton si une image est présente (importée ou restaurée)
        if (btnEditBg) btnEditBg.style.display = 'block'; 
    } else { 
        thumbContainer.style.display = 'none'; 
        thumbImg.src = ''; 
        
        // Cache le bouton s'il n'y a plus d'image
        if (btnEditBg) btnEditBg.style.display = 'none'; 
    }
}

function _renderUI() { _renderZones(); _renderElements(); _renderImageEditor(); _updateStatusIndicator(); updateGenerateButtonCallback(); }

function _renderImageEditor() {
    const visualSection = container.querySelector('#cat-visual-editor-section');
    const editor = container.querySelector('#cat-image-editor-container');
    const mode = container.querySelector('#cat-layout-mode').value;

    if (mode === 'image' && uploadedImageURL && _zones.length > 0) {
        visualSection.style.display = 'block';
        editor.style.backgroundImage = `url(${uploadedImageURL})`;
        editor.innerHTML = '';
        const img = new Image();
        img.onload = () => {
            editor.style.aspectRatio = `${img.width / img.height}`;
            _zones.forEach((z, idx) => {
                if (z.x === undefined) { z.x = 2; z.y = 2 + (idx * 12); z.w = 18; z.h = 8; }
                const box = document.createElement('div');
                box.className = 'cat-editor-box';
                box.style.left = `${z.x}%`; box.style.top = `${z.y}%`; box.style.width = `${z.w}%`; box.style.height = `${z.h}%`;
                
                box.style.borderColor = 'var(--hapi-green)';
                box.style.backgroundColor = 'rgba(var(--hapi-green-rgb),0.25)';
                
                box.innerHTML = `<span class="cat-editor-label" data-zid="${z.id}">${_esc(z.nom)}</span>`;
                const handle = document.createElement('div'); handle.className = 'cat-resize-handle';
                handle.style.backgroundColor = 'var(--hapi-green)';
                box.appendChild(handle); editor.appendChild(box);
                _makeDraggableAndResizable(box, handle, z.id, editor);
            });
        };
        img.src = uploadedImageURL;
    } else { visualSection.style.display = 'none'; }
}

function _makeDraggableAndResizable(box, handle, zId, visualContainer) {
    let isDragging = false, isResizing = false, startX, startY, startLeft, startTop, startW, startH;
    handle.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); isResizing = true; startX = e.clientX; startY = e.clientY; startW = box.offsetWidth; startH = box.offsetHeight; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); });
    box.addEventListener('mousedown', (e) => { e.preventDefault(); isDragging = true; startX = e.clientX; startY = e.clientY; startLeft = box.offsetLeft; startTop = box.offsetTop; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); });
    function onMouseMove(e) {
        const rect = visualContainer.getBoundingClientRect();
        if (isResizing) { let newW = Math.max(30, startW + (e.clientX - startX)); let newH = Math.max(20, startH + (e.clientY - startY)); box.style.width = (newW / rect.width * 100) + '%'; box.style.height = (newH / rect.height * 100) + '%'; }
        else if (isDragging) { let newX = Math.max(0, Math.min(startLeft + (e.clientX - startX), rect.width - box.offsetWidth)); let newY = Math.max(0, Math.min(startTop + (e.clientY - startY), rect.height - box.offsetHeight)); box.style.left = (newX / rect.width * 100) + '%'; box.style.top = (newY / rect.height * 100) + '%'; }
    }
    function onMouseUp() { isDragging = false; isResizing = false; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); const z = _zones.find(z => z.id === zId); if (z) { z.x = parseFloat(box.style.left); z.y = parseFloat(box.style.top); z.w = parseFloat(box.style.width); z.h = parseFloat(box.style.height); } updateGenerateButtonCallback(); }
}

function _renderZones() {
    const list = container.querySelector('#cat-zones-list');
    list.innerHTML = '';
    _zones.forEach(z => {
        list.innerHTML += `
            <div style="background:var(--surface); border:1px solid var(--border); padding:10px; border-radius:6px; display:flex; align-items:center; gap:8px;">
                <input type="text" class="inp-zone-name" data-id="${z.id}" value="${_esc(z.nom)}" style="flex:1; padding:6px; border:1px solid var(--border); border-radius:4px;">
                <button class="btn-del-zone" data-id="${z.id}" style="background:transparent; color:var(--text); border:none; padding:6px 10px; border-radius:4px; cursor:pointer;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
            </div>`;
    });
	list.querySelectorAll('.inp-zone-name').forEach(inp => inp.addEventListener('input', e => { 
	    const zId = e.target.dataset.id;
	    const z = _zones.find(z => z.id === zId); 
    
	    if(z) { 
	        z.nom = e.target.value; 
	        updateGenerateButtonCallback(); 
        
	        // 1. Mise à jour des cases à cocher (identique)
	        container.querySelectorAll(`.cb-target[data-zid="${zId}"]`).forEach(cb => {
	            const label = cb.closest('label');
	            if (label) {
	                Array.from(label.childNodes).forEach(node => {
	                    if (node.nodeType === Node.TEXT_NODE) node.remove();
	                });
	                label.appendChild(document.createTextNode(z.nom));
	            }
	        });

	        // 2. ✅ CIBLAGE STRICT de l'étiquette bleue dans l'éditeur
	        const editorLabel = container.querySelector(`.cat-editor-label[data-zid="${zId}"]`);
	        if (editorLabel) {
	            editorLabel.textContent = z.nom;
	        }
	    } 
	}));
	list.querySelectorAll('.btn-del-zone').forEach(btn => btn.addEventListener('click', e => { const zId = e.currentTarget.dataset.id; _zones = _zones.filter(z => z.id !== zId); _elements.forEach(el => { el.targets = el.targets.filter(t => t !== zId); }); _renderUI(); }));
}

function _renderElements() {
    const list = container.querySelector('#cat-elements-list');
    let htmlStr = '';
    
    const svgWaiting = `data:image/svg+xml;charset=utf-8,` + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
            <rect width="400" height="400" fill="#f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="38" fill="#334155" font-weight="600">Générer <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg></text>
        </svg>`.trim());

    _elements.forEach((el, idx) => {
        if (!el.mode) el.mode = 'text';
        if (!el.wikiSearch) el.wikiSearch = el.text || '';
        if (!el.iaPrompt) el.iaPrompt = el.text || '';

        const checkboxesHtml = _zones.map(z => {
            const isChecked = el.targets.includes(z.id) ? 'checked' : '';
            const bgColor = isChecked ? 'var(--hapi-green-mist)' : 'var(--surface-2)';
            const borderColor = isChecked ? 'var(--hapi-grad-a)' : 'var(--border)';
            return `<label style="display:inline-flex; align-items:center; gap:6px; background:${bgColor}; border:1px solid ${borderColor}; padding:4px 10px; border-radius:20px; cursor:pointer; font-size:0.85em; color:var(--text);"><input type="checkbox" class="cb-target" data-elid="${el.id}" data-zid="${z.id}" ${isChecked}>${_esc(z.nom)}</label>`;
        }).join('') || '<span style="font-size:0.8em; color:var(--text-muted);">Créez d\'abord des zones</span>';
        
        htmlStr += `
            <div class="el-card" data-id="${el.id}" style="background:var(--surface); border:1px solid var(--border); border-left:4px solid var(--hapi-grad-a); padding:15px; border-radius:6px;">
                
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <div style="display:flex; gap:10px; align-items:center; width: 100%;">
                        <span style="background:var(--hapi-grad-a); color:white; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; font-size:0.8em; flex-shrink:0;">${idx+1}</span>
                        <div style="flex:1;">
                            <select class="el-type-select" data-id="${el.id}" style="height:38px; width:100%; max-width:250px; padding:0 10px; border-radius:6px; border:1px solid var(--border); background:var(--surface); outline:none; cursor:pointer; font-weight:bold;">
                                <option value="text" ${el.mode==='text'?'selected':''}>Étiquette Texte</option>
                                <option value="upload" ${el.mode==='upload'?'selected':''}>Étiquette Image locale</option>
                                <option value="wiki" ${el.mode==='wiki'?'selected':''}>Étiquette Wikimedia</option>
                                <option value="ia" ${el.mode==='ia'?'selected':''}>Étiquette Image IA</option>
                            </select>
                        </div>
                    </div>
                    <button class="btn-del-el" data-id="${el.id}" style="background:transparent; color:var(--text); border:none; padding:0 12px; border-radius:4px; cursor:pointer; margin-left:10px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
                </div>
                
                <div style="margin-bottom:15px; padding:15px; background:var(--page-bg); border:1px dashed #cbd5e0; border-radius:6px;">
                    
                    <div style="display:${el.mode==='text'?'block':'none'}; width:100%;">
                        <input type="text" class="inp-el-text" data-id="${el.id}" value="${_esc(el.text)}" placeholder="Texte de l'étiquette..." style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px; font-weight:bold;">
                    </div>

					<div style="display:${el.mode==='upload'?'block':'none'}; width:100%;">
                        <input type="file" class="input-file-el" data-id="${el.id}" accept="image/*" style="width:100%; padding:10px; background:var(--page-bg); border:1px dashed var(--border); border-radius:25px; cursor: pointer; color: var(--text-muted);">
                        
                        <div style="display:${el.uploadB64?'flex':'none'}; width:100%; height:120px; background:var(--border); border-radius:6px; overflow:hidden; justify-content:center; align-items:center; margin-top:8px;">
                            <img src="${el.uploadB64 || ''}" style="max-width:100%; max-height:100%; object-fit:contain;">
                        </div>
                    </div>

                    <div style="display:${el.mode==='wiki'?'block':'none'}; width:100%;">
                        <div style="display:flex; gap:6px; width:100%; align-items:center; margin-bottom:8px;">
                            <input type="text" class="wiki-search-input-el" data-id="${el.id}" value="${_esc(el.wikiSearch)}" placeholder="Recherche Wiki..." style="height:38px; flex:1; padding:0 12px; border:1px solid #cbd5e0; border-radius:6px; outline:none;">
                            <button class="btn-wiki-search-el" data-id="${el.id}" style="height:38px; padding:0 15px; border-radius:6px; background:var(--hapi-green-dark); color:white; border:none; cursor:pointer; font-weight:bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>
                        </div>
                        <div class="wiki-results-grid-el" data-id="${el.id}" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:5px; max-height:250px; overflow-y:auto; background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:5px; margin-bottom: ${el.wikiSelected?'8px':'0'};"></div>
                        <div style="display:${el.wikiSelected?'block':'none'}; text-align:center; background:var(--page-bg); padding:10px; border-radius:6px;">
                            <img src="${el.wikiImgSrc || ''}" style="height:100px; object-fit:contain; border-radius:4px;">
                            <div style="font-size:0.7em; color:var(--text-muted); margin-top:5px; word-break:break-all;">${_esc(el.wikiCredits)}</div>
                            <button class="btn-remove-wiki-el" data-id="${el.id}" style="height:32px; margin-top:8px; background:transparent; color:var(--text); border:none; padding:0 12px; border-radius:16px; cursor:pointer; font-size:0.8em; font-weight:bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg> Retirer</button>
                        </div>
                    </div>

                    <div style="display:${el.mode==='ia'?'block':'none'}; width:100%;">
                        <div style="width:100%; height:120px; background:var(--border); border-radius:6px; overflow:hidden; margin-bottom:8px; display:flex; justify-content:center; align-items:center;">
                             <img src="${el.iaB64 || (el.iaPrompt ? svgWaiting : localPlaceholder('Image IA'))}" style="max-width:100%; max-height:100%; object-fit:contain;">
                        </div>
                        <div style="display:flex; gap:6px; width:100%; align-items:center;">
                            <input type="text" class="prompt-input-el" data-id="${el.id}" value="${_esc(el.iaPrompt)}" placeholder="Décrivez l'image..." style="height:38px; flex:1; padding:0 12px; border:1px solid #cbd5e0; border-radius:6px; outline:none;">
                            <button class="btn-regen-img-el" data-id="${el.id}" style="height:38px; width:38px; border-radius:6px; background:var(--hapi-grad-a); color:#fff; border:none; cursor:pointer; font-size:1.1em; display:flex; align-items:center; justify-content:center;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg></button>
                        </div>
                    </div>

                </div>

                <div style="padding-left:10px; border-left:2px solid var(--border);">
                    <div style="font-size:0.8em; color:var(--text-muted); font-weight:bold; margin-bottom:6px; ">Zones cibles (réponses correctes) :</div>
                    <div style="display:flex; flex-wrap:wrap; gap:8px;">${checkboxesHtml}</div>
                </div>
            </div>`;
    });
    
    list.innerHTML = htmlStr;

    list.querySelectorAll('.el-type-select').forEach(sel => sel.addEventListener('change', (e) => {
        const el = _elements.find(e => e.id === sel.dataset.id);
        if (el) { el.mode = e.target.value; _renderUI(); }
    }));

    list.querySelectorAll('.inp-el-text').forEach(inp => inp.addEventListener('input', (e) => {
        const el = _elements.find(e => e.id === inp.dataset.id);
        if (el) { el.text = e.target.value; updateGenerateButtonCallback(); }
    }));

    list.querySelectorAll('.input-file-el').forEach(inp => inp.addEventListener('change', (e) => {
        const el = _elements.find(e => e.id === inp.dataset.id);
        const file = e.target.files[0];
        if (el && file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (evt) => { el.uploadB64 = evt.target.result; _renderUI(); };
            reader.readAsDataURL(file);
        }
    }));

    list.querySelectorAll('.prompt-input-el').forEach(inp => inp.addEventListener('input', (e) => {
        const el = _elements.find(e => e.id === inp.dataset.id);
        if (el) el.iaPrompt = e.target.value;
    }));

    list.querySelectorAll('.wiki-search-input-el').forEach(inp => inp.addEventListener('input', (e) => {
        const el = _elements.find(e => e.id === inp.dataset.id);
        if (el) el.wikiSearch = e.target.value;
    }));

    list.querySelectorAll('.cb-target').forEach(cb => cb.addEventListener('change', (e) => {
        const el = _elements.find(e => e.id === cb.dataset.elid);
        const zId = cb.dataset.zid;
        if(e.target.checked) { if(!el.targets.includes(zId)) el.targets.push(zId); } 
        else { el.targets = el.targets.filter(t => t !== zId); }
        _renderUI();
    }));

    list.querySelectorAll('.btn-del-el').forEach(btn => btn.addEventListener('click', (e) => {
        _elements = _elements.filter(el => el.id !== btn.dataset.id); _renderUI();
    }));

    list.querySelectorAll('.btn-remove-wiki-el').forEach(btn => btn.addEventListener('click', (e) => {
        const el = _elements.find(e => e.id === btn.dataset.id);
        if (el) { el.wikiSelected = false; el.wikiImgSrc = null; _renderUI(); }
    }));

    list.querySelectorAll('.btn-regen-img-el').forEach(btn => btn.addEventListener('click', async (e) => {
        const el = _elements.find(e => e.id === btn.dataset.id);
        if (el && el.iaPrompt) {
            btn.innerHTML = ''; btn.disabled = true;
            const englishPrompt = await translateToEnglish(el.iaPrompt);
            const result = await generateImageWithFallback(englishPrompt);
            const b64 = await urlToBase64(result.url);
            if (b64) { el.iaB64 = b64; _renderUI(); }
            else { btn.innerHTML = '✕'; btn.disabled = false; }
        }
    }));

    list.querySelectorAll('.btn-wiki-search-el').forEach(btn => btn.addEventListener('click', async (e) => {
        const el = _elements.find(e => e.id === btn.dataset.id);
        const grid = list.querySelector(`.wiki-results-grid-el[data-id="${el.id}"]`);
        if (el && grid && el.wikiSearch) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:5px;">...</div>';
            const images = await searchWikimedia(el.wikiSearch);
            grid.innerHTML = '';
            if (images.length === 0) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;">Aucun résultat</div>';
            images.forEach(img => {
                const thumb = document.createElement('div');
                thumb.style.cssText = "height:140px; cursor:pointer; border:2px solid transparent; border-radius:4px; overflow:hidden;";
                thumb.innerHTML = `<img src="${img.thumb}" style="width:100%; height:100%; object-fit:cover;">`;
                thumb.onmouseover = () => thumb.style.borderColor = "var(--hapi-green)";
                thumb.onmouseout = () => thumb.style.borderColor = "transparent";
                thumb.onclick = () => openLightbox(img, el.id);
                grid.appendChild(thumb);
            });
        }
    }));
}

function _handleParseIA() {
    const reponseBrute = container.querySelector('#ia-response-cat').value;
    if (!reponseBrute.trim()) return;
    let parsed = null;
    try { const jsonMatch = reponseBrute.match(/\{[\s\S]*\}/); parsed = JSON.parse(jsonMatch ? jsonMatch[0] : reponseBrute.replace(/```json/g, '').replace(/```/g, '').trim()); } catch (e) { alert("JSON invalide. Corrigez la réponse."); return; }
    
    if (parsed.consigne) container.querySelector('#cat-consigne').value = parsed.consigne;
    _zones = []; _elements = [];
    if (parsed.categories) {
        parsed.categories.forEach(cat => {
            const zId = _genId('z'); 
            const zoneNom = cat.nom || 'Zone';
            _zones.push({ id: zId, nom: zoneNom });
            
            const elemsArray = Array.isArray(cat.elements) ? cat.elements : [];
            elemsArray.forEach(item => { 
                let txt = "";
                let contextPrompt = "";

                // 🌟 GESTION DU DOUBLE FORMAT (String vs Objet)
                if (typeof item === 'string') {
                    txt = item;
                    contextPrompt = `${txt} (Contexte : ${zoneNom})`; 
                } else if (typeof item === 'object' && item.texte) {
                    txt = item.texte;
                    contextPrompt = item.image_prompt || `${txt} (Contexte : ${zoneNom})`;
                }

                if(!txt.trim()) return; 
                const cleanTxt = txt.trim();
                const existing = _elements.find(e => e.text.toLowerCase() === cleanTxt.toLowerCase()); 
                
                if (existing) { 
                    if (!existing.targets.includes(zId)) existing.targets.push(zId); 
                } else { 
                    // 🌟 Injection du prompt contextuel généré !
                    _elements.push(_createNewElement(cleanTxt, [zId], contextPrompt)); 
                } 
            });
        });
    }
    container.querySelector('#cat-preview-section').style.display = 'block';
    _renderUI();
}

function _updateStatusIndicator() { 
    const s = container.querySelector('#cat-status-indicator'); 
    const valid = _zones.length > 0 && _elements.some(e => e.targets.length > 0); 
    if (!valid) { s.style.display = 'block'; s.style.color = 'var(--danger-text)'; s.textContent = 'Créez au moins 1 zone et 1 étiquette ciblée.'; } 
    else { s.style.color = 'var(--hapi-grad-a)'; s.textContent = 'Configuration prête.'; } 
}

function _renderRepartitionConfig(selectedDocs) {
    const repContainer = container.querySelector('#cat-questions-repartition');
    if (!repContainer) return;
    container.querySelectorAll('.source-question-count').forEach(input => { currentRepartition[input.dataset.sourceId] = parseInt(input.value, 10); });
    if (!selectedDocs || selectedDocs.length === 0) { repContainer.innerHTML = ''; return; }

    let html = `<div style="background:var(--page-bg); border:1px solid var(--border); border-radius:6px; padding:15px; margin-top:10px; max-height:250px; overflow-y:auto;"><label style="display:flex; justify-content:space-between; align-items:center; font-size:0.95em; font-weight:bold; margin-bottom:12px; color:var(--text);"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Nombre de catégories à générer par source</span></label>`;
    selectedDocs.forEach(doc => {
        const defaultCount = doc.priority === 3 ? 6 : (doc.priority === 2 ? 4 : 2);
        const val = currentRepartition[doc.id] !== undefined ? currentRepartition[doc.id] : defaultCount;
        currentRepartition[doc.id] = val;
        html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px dashed var(--border);"><span style="font-size:0.9em; color:var(--text-muted); display:flex; align-items:center; gap:8px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:75%;" title="${doc.title}"><span style="overflow:hidden; text-overflow:ellipsis;">${doc.title}</span></span><input type="number" class="source-question-count" data-source-id="${doc.id}" value="${val}" min="0" max="20" style="width:60px; padding:4px; border:1px solid var(--border); border-radius:4px; text-align:center; font-weight:bold; color:var(--text);"></div>`;
    });
    html += `</div>`;
    repContainer.innerHTML = html;
}

async function _handlePreparePrompt() {
    const btn = container.querySelector('#btn-prepare-prompt-cat');
    
    // 🟢 On force le texte par défaut
    const originalText = `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Préparer le contenu avec l'IA`;
    
    btn.disabled = true;
    btn.innerHTML = 'Analyse du corpus...';

    const layoutMode = container.querySelector('#cat-layout-mode').value;
    const repartitionMap = {};
    container.querySelectorAll('.source-question-count').forEach(input => {
        const id = input.dataset.sourceId; 
        const val = parseInt(input.value, 10);
        if (!isNaN(val) && val >= 0) repartitionMap[id] = val;
    });

    const success = await preparerAssistantIA_Categorisation({ layoutMode, repartition: repartitionMap });
    
    if (success) {
        // 🟢 NOUVEAU : On cache le conteneur du bouton parent de manière sécurisée
        if (btn.parentElement) {
            btn.parentElement.style.display = 'none';
        }
        
        const iaContainer = container.querySelector('#ia-container-cat');
        if (iaContainer) {
            iaContainer.style.display = 'block';
            setTimeout(() => {
                iaContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
        
        const albertAction = container.querySelector('#albert-action-cat');
        if (albertAction) albertAction.style.display = 'block';
    }
    
    // 🟢 On réinitialise l'état et le texte
    btn.disabled = false;
    btn.innerHTML = originalText;
}

async function _handleGenerateAlbert() {
    const btn = container.querySelector('#btn-send-albert-cat');
    await callAlbertAPI('ia-prompt-cat', 'ia-response-cat', 'btn-parse-ia-response-cat', btn);
}

function _injectStyles() {
    if (document.getElementById('cat-styles')) return;
    const style = document.createElement('style'); style.id = 'cat-styles';
    style.innerHTML = `
        #cat-image-editor-container { position:relative; width:100%; border:2px dashed #94a3b8; background-size:100% 100%; background-color:var(--page-bg); }
        .cat-editor-box { position:absolute; border:2px solid var(--hapi-green); background:rgba(var(--hapi-green-rgb),0.25); cursor:move; display:flex; align-items:center; justify-content:center; border-radius:4px; transition: background 0.2s; }
        .cat-editor-box:hover { background:rgba(var(--hapi-green-rgb),0.4); }
        .cat-editor-label { pointer-events:none; background:rgba(255,255,255,0.9); padding:2px 6px; font-size:0.85em; border-radius:4px; font-weight:bold; color:#1e293b; box-shadow:0 1px 3px rgba(0,0,0,0.2); }
        .cat-resize-handle { position:absolute; width:14px; height:14px; background:var(--hapi-green); right:-7px; bottom:-7px; cursor:se-resize; border-radius:50%; border:2px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.3); }
        input[type="checkbox"] { cursor:pointer; }
        .cb-target, input[type="checkbox"][id^="cat-"] { accent-color: var(--hapi-green); }
/* STYLISATION DE TOUS LES BOUTONS FICHIERS NATIFS */
        #cat-bg-image::file-selector-button,
        .input-file-el::file-selector-button {
            background: var(--hapi-green-dark);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 25px;
            cursor: pointer;
            font-weight: bold;
            margin-right: 15px;
            transition: background 0.2s;
        }
        
        #cat-bg-image::file-selector-button:hover,
        .input-file-el::file-selector-button:hover {
            background: var(--hapi-green-dark);
        }
    `;
    document.head.appendChild(style);
}

function showRegenerateButton() {
    const iaContainer = document.getElementById('ia-container-cat');
    const btnPrepare = document.getElementById('btn-prepare-prompt-cat');

    if (iaContainer && iaContainer.style.display === 'block') {
        if (btnPrepare) {
            if (btnPrepare.parentElement) {
                btnPrepare.parentElement.style.display = 'block'; 
            }
            btnPrepare.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg> Régénérer le prompt';
            btnPrepare.style.background = 'linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark))';
            btnPrepare.style.boxShadow = '0 4px 15px rgba(var(--hapi-green-rgb), 0.3)';
        }
    }
}

// ─── API PUBLIQUE (EXPORT DES DONNÉES ET GESTION D'ÉTAT) ─────────────────────

export function gatherData() {
    const validElements = _elements.filter(e => {
        if (e.mode === 'text') return e.text && e.text.trim() !== '';
        if (e.mode === 'upload') return e.uploadB64 !== null;
        if (e.mode === 'wiki') return e.wikiSelected && e.wikiImgSrc !== null;
        if (e.mode === 'ia') return e.iaB64 !== null;
        return false;
    });

    if (_zones.length === 0 || validElements.length === 0) return null;

    const layoutMode = container.querySelector('#cat-layout-mode').value;
    const bgInput = container.querySelector('#cat-bg-image');

    let bgImageFile = (layoutMode === 'image' && bgInput.files.length > 0) ? bgInput.files[0] : null;
    
    if (!bgImageFile && uploadedImageURL && layoutMode === 'image') {
        try {
            let arr = uploadedImageURL.split(','), mime = arr[0].match(/:(.*?);/)[1];
            let bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
            while(n--) u8arr[n] = bstr.charCodeAt(n);
            bgImageFile = new File([u8arr], 'background_restored.jpg', {type:mime});
        } catch(e) { logger.warn("Erreur de conversion image:", e); }
    }

    return {
        titre: container.querySelector('#cat-title').value,
        consigne: container.querySelector('#cat-consigne').value,
        layoutMode: layoutMode,
        bgImageFile: bgImageFile,
        freeDrop: container.querySelector('#cat-free-drop')?.checked ?? true,
        overallFeedback: getFeedbackIntervallesData('cat'),
        backgroundOpacity: parseInt(container.querySelector('#cat-background-opacity')?.value || 100, 10),
        behaviour: {
            enableRetry: container.querySelector('#cat-enable-retry')?.checked ?? true,
            singlePoint: container.querySelector('#cat-single-point')?.checked ?? false,
            applyPenalties: container.querySelector('#cat-apply-penalties')?.checked ?? true,
            enableScoreExplanation: container.querySelector('#cat-enable-score-explanation')?.checked ?? true,
            dropZoneHighlighting: container.querySelector('#cat-drop-zone-highlighting')?.value || 'dragging',
            autoAlignSpacing: parseInt(container.querySelector('#cat-auto-align-spacing')?.value || 2, 10),
            enableFullScreen: container.querySelector('#cat-enable-fullscreen')?.checked ?? true,
            showScorePoints: container.querySelector('#cat-show-score-points')?.checked ?? true,
            showTitle: container.querySelector('#cat-show-title')?.checked ?? true
        },
        zones: _zones.map(z => ({ id: z.id, nom: z.nom.trim(), x: z.x, y: z.y, w: z.w, h: z.h })),
        
        elements: validElements.map(e => {
            let data = {
                targets: e.targets.map(tId => _zones.findIndex(z => z.id === tId)).filter(idx => idx !== -1)
            };
            if (e.mode === 'text') {
                data.type = 'text';
                data.text = e.text.trim();
            } else {
                data.type = 'image';
                if (e.mode === 'upload') data.src = e.uploadB64;
                else if (e.mode === 'wiki') data.src = e.wikiImgSrc;
                else if (e.mode === 'ia') data.src = e.iaB64;
            }
            return data;
        })
    };
}

export function getUIState() {
    return getDragNDropState(container, { zones: _zones, elements: _elements, uploadedImageURL: uploadedImageURL, fabricJSONState: fabricJSONState });
}

export function setUIState(config) {
    setDragNDropState(container, config, {
        restoreInternalData: (data) => {
            _zones = data.zones || [];
            _elements = data.elements || [];
            uploadedImageURL = data.uploadedImageURL || null;
			fabricJSONState = data.fabricJSONState || null;
            
            const bgInput = container.querySelector('#cat-bg-image');
            if (bgInput && !uploadedImageURL) bgInput.value = '';
            
            _renderThumbnail();
            _renderUI();
        }
    });
}
