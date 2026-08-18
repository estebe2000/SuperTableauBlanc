// Fichier: modules/utils/timeline-ui.js

import { logger } from '../utils/logger.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { creerAssistantIA_HTML } from '../utils/helpers.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_Timeline } from '../ia/prompt-builder.js';
//import { getLanguageOptionsHTML } from '../utils/languages.js';
import { getH5PLocalization } from '../utils/h5p-translations.js';
import { getTimelineState, setTimelineState } from '../utils/states/timeline-state.js';
import { SourceSelector } from './source-selector.js';

let container = null;
let updateGenerateButtonCallback = () => {};
let localSourceSelector = null; 
let currentRepartition = {};    

// ==========================================
// 1. UTILITAIRES & WIKIMEDIA
// ==========================================

async function searchWikimedia(query) {
    if (!query || query.length < 2) return [];
    const endpoint = "https://commons.wikimedia.org/w/api.php";
    
    const params = new URLSearchParams({
        action: "query", 
        generator: "search", 
        gsrnamespace: "6", 
        gsrsearch: `${query} filetype:bitmap`, 
        gsrlimit: "12", 
        prop: "imageinfo", 
        iiprop: "url|extmetadata", 
        iiurlwidth: "800",
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
            const fileName = page.title.replace("File:", "");

            const forbiddenExt = ['.pdf', '.djvu', '.ogv', '.webm', '.mpg', '.mp4'];
            if (forbiddenExt.some(ext => fileName.toLowerCase().endsWith(ext))) return null;

            let year = "";
            if (meta.DateTimeOriginal && meta.DateTimeOriginal.value) {
                const match = meta.DateTimeOriginal.value.match(/\d{4}/);
                if (match) year = match[0];
            } else if (meta.DateTime && meta.DateTime.value) {
                const match = meta.DateTime.value.match(/\d{4}/);
                if (match) year = match[0];
            }

            let rawCaption = meta.ObjectName ? meta.ObjectName.value : fileName.split('.')[0];
            let cleanCaption = rawCaption;
            
            if (cleanCaption.includes('<')) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cleanCaption;
                tempDiv.querySelectorAll('[style*="display: none"], [style*="display:none"]').forEach(el => el.remove());
                cleanCaption = tempDiv.textContent || tempDiv.innerText || "";
                cleanCaption = cleanCaption.replace(/\s+/g, ' ').trim(); 
            }

            return {
                thumb: info.thumburl,
                full: info.url,
                sourceUrl: info.descriptionurl || info.url, 
                title: fileName,
                artist: meta.Artist ? meta.Artist.value.replace(/<\/?[^>]+(>|$)/g, "") : "Inconnu",
                license: meta.LicenseShortName ? meta.LicenseShortName.value : "CC BY-SA",
                caption: cleanCaption, 
                year: year
            };
        }).filter(item => item !== null);
    } catch (e) { 
        console.error("Erreur Wikimedia:", e);
        return []; 
    }
}

function openLightbox(imgData, card, isBackground = false) {
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
                    <p style="margin:0; font-size:0.85em; color:var(--text-muted);"><strong>Auteur:</strong> ${imgData.artist} | <strong>Année:</strong> ${imgData.year || 'N/A'}</p>
                </div>
                <button id="select-this-img" style="background:var(--hapi-grad-a); color:#fff; border:none; padding:12px 25px; border-radius:30px; font-weight:bold; cursor:pointer;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Sélectionner</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#close-light').onclick = () => modal.remove();
    modal.querySelector('#select-this-img').onclick = () => {
        if (!isBackground && card) {
            card.querySelector('.final-img-url').value = imgData.full;
            card.querySelector('.final-img-credit').value = `${imgData.artist} (${imgData.license})`;
            
            const captionField = card.querySelector('.inp-caption');
            if (captionField) captionField.value = imgData.caption || imgData.title;

            const thumbImg = card.querySelector('.selected-img-preview');
            if (thumbImg) {
                thumbImg.src = imgData.thumb;
                thumbImg.style.display = 'block';
            }

            const mediaDetails = card.querySelector('.media-details');
            if (mediaDetails) mediaDetails.style.display = 'block';

        } else if (isBackground) {
            document.getElementById('bg-final-url').value = imgData.full;
            document.getElementById('bg-final-credit').value = `${imgData.artist} (${imgData.license})`;
            
            document.getElementById('bg-final-caption').value = imgData.caption || imgData.title;
            document.getElementById('bg-final-year').value = ""; 
            
            document.getElementById('bg-final-source').value = imgData.sourceUrl || imgData.full;

            document.getElementById('bg-selected-img').src = imgData.full;
            document.getElementById('bg-selected-credit').innerText = `${imgData.caption}`;
            document.getElementById('bg-preview-zone').style.display = 'flex';
        }

        modal.remove();
        updateGenerateButtonCallback();
    };
}

// ==========================================
// 2. LOGIQUE IA & ÉDITION
// ==========================================

function renderRepartitionConfigTimeline(selectedDocs) {
    const repContainer = container.querySelector('#timeline-questions-repartition');
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
        <div style="background:var(--page-bg); border:1px solid var(--border); border-radius:6px; padding:15px; margin-top:10px; max-height:250px; overflow-y:auto;">
            <label style="display:flex; justify-content:space-between; align-items:center; font-size:0.95em; font-weight:bold; margin-bottom:12px; color:var(--text);">
                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Répartition des événements à extraire</span>
            </label>
    `;

    selectedDocs.forEach(doc => {
        let defaultCount = doc.priority === 3 ? 6 : (doc.priority === 2 ? 4 : 2);
        const val = currentRepartition[doc.id] !== undefined ? currentRepartition[doc.id] : defaultCount;
        currentRepartition[doc.id] = val;

        const icon = getDocIcon(doc);

        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px dashed var(--border);">
                <span style="font-size:0.9em; color:var(--text-muted); display:flex; align-items:center; gap:8px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:75%;" title="${doc.title}">
                    <span>${icon}</span> <span>${doc.title}</span>
                </span>
                <input type="number" class="source-question-count" data-source-id="${doc.id}" value="${val}" min="0" max="30" style="width:60px; padding:4px; border:1px solid var(--border); border-radius:4px; text-align:center; font-weight:bold; color:var(--text);">
            </div>
        `;
    });

    html += `</div>`;
    repContainer.innerHTML = html;

    repContainer.querySelectorAll('.source-question-count').forEach(input => {
        input.addEventListener('input', () => {
            const albertAction = container.querySelector('#albert-action-timeline');
            if (albertAction) albertAction.style.display = 'none';
            
            const prepBtn = container.querySelector('#btn-prep-timeline');
            if (prepBtn) {
                prepBtn.style.background = 'linear-gradient(45deg, #f59e0b, #d97706)';
                prepBtn.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> Régénérer le prompt';
            }
        });
    });
}

async function handlePreparePrompt() {
    const subjectInput = document.getElementById('timeline-subject');
    const btn = document.getElementById('btn-prep-timeline');
    
    if (!subjectInput || !subjectInput.value.trim()) {
        alert("⚠️ Le champ 'Sujet / Titre de la frise' est obligatoire.");
        if (subjectInput) {
            subjectInput.style.borderColor = "#b91c1c";
            subjectInput.focus();
        }
        return;
    }
    if (subjectInput) subjectInput.style.borderColor = "#cbd5e1";
    
    // 🟢 On force le texte par défaut
    const originalText = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt';
    
    btn.disabled = true;
    btn.innerHTML = 'Analyse...';

    try {
        const repartitionMap = {};
        container.querySelectorAll('.source-question-count').forEach(input => {
            const id = input.dataset.sourceId;
            const val = parseInt(input.value, 10);
            if (!isNaN(val) && val >= 0) repartitionMap[id] = val;
        });

        // Adaptez l'appel selon les paramètres réels de votre fonction `preparerAssistantIA_Timeline`
        const success = await preparerAssistantIA_Timeline(repartitionMap, subjectInput.value.trim()); 
        
        if (success) {
            // 🟢 NOUVEAU : On cache le conteneur parent de manière sécurisée
            if (btn.parentElement) {
                btn.parentElement.style.display = 'none';
            }

            const iaContainer = document.getElementById('ia-container-timeline');
            if (iaContainer) {
                iaContainer.style.display = 'block';
                const promptArea = document.getElementById('ia-prompt-timeline');
                if (promptArea) {
                    promptArea.removeAttribute('readonly'); 
                    promptArea.disabled = false;
                    promptArea.style.backgroundColor = 'var(--field-bg)'; 
                    promptArea.style.border = '2px solid var(--hapi-green)';
                }
            }
            
            const albertAction = document.getElementById('albert-action-timeline');
            if (albertAction) albertAction.style.display = 'block';

            setTimeout(() => {
                const iaContainerToScroll = document.getElementById('ia-container-timeline');
                if (iaContainerToScroll) iaContainerToScroll.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    } catch (e) {
        console.error("Erreur lors de la préparation de l'IA pour Timeline:", e);
    } finally {
        // 🟢 On réinitialise l'état pour la prochaine fois
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function triggerAutoSearch(card, query) {
    const resultsDiv = card.querySelector('.wiki-results');
    if (!resultsDiv) return;
    resultsDiv.innerHTML = '<div style="grid-column:1/-1; text-align:center; font-size:0.8em; color: var(--hapi-accent-text);">Recherche auto...</div>';
    const images = await searchWikimedia(query);
    resultsDiv.innerHTML = '';
    images.forEach(img => {
        const imgThumb = document.createElement('div');
        imgThumb.style.cssText = "height:90px; border-radius:6px; border:2px solid var(--border); overflow:hidden; cursor:pointer;";
        imgThumb.innerHTML = `<img src="${img.thumb}" style="width:100%; height:100%; object-fit:cover;">`;
        imgThumb.onclick = () => openLightbox(img, card);
        resultsDiv.appendChild(imgThumb);
    });
}

function updateCounter() {
    const badge = document.getElementById('counter-badge');
    if (badge) badge.innerText = document.querySelectorAll('.timeline-card').length;
}

function refreshEventIndices() {
    const cards = document.querySelectorAll('.timeline-card');
    cards.forEach((card, index) => {
        const span = card.querySelector('.num-index');
        if (span) span.innerText = (index + 1);
    });
    const badge = document.getElementById('counter-badge');
    if (badge) badge.innerText = cards.length;
}

function addCard(data = {}) {
    const asset = data.asset || {};
    const mediaUrl = asset.media || "";
    const caption = asset.caption || "";
    const credit = asset.credit || "";
    const tag = data.tag || "";
    const headline = data.headline || "";
    const text = data.text || "";
    const startDate = data.startDate || "";
    const endDate = data.endDate || "";
    
    let thumbnail = "";
    if (asset.thumbnail) {
        thumbnail = (typeof asset.thumbnail === 'string') ? asset.thumbnail : (asset.thumbnail.path || "");
    }

    const list = document.getElementById('timeline-cards-list');
    const div = document.createElement('div');
    div.className = 'timeline-card';
    div.style.cssText = "background:var(--surface); border:1px solid var(--border); padding:30px 20px 20px 20px; margin-bottom:20px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.05); position:relative;";
    
    div.innerHTML = `
        <div class="event-number" style="position:absolute; top:-10px; left:20px; background:var(--hapi-green-dark); color:white; padding:4px 12px; border-radius:6px; font-size:0.75em; font-weight:bold; z-index:5; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            Événement <span class="num-index"></span>
        </div>

        <button class="btn-del" style="position:absolute; top:5px; right:6px; color:var(--text); background:transparent; border:none; cursor:pointer; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; z-index:10;" title="Supprimer cet événement"><svg class="ico" style="width:1.35em;height:1.35em;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; padding-top:10px;">
            <div>
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <input type="text" class="inp-date-start" value="${startDate}" placeholder="JJ-MM-AAAA (min. AAAA)" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:6px;">
                    <input type="text" class="inp-date-end" value="${endDate}" placeholder="JJ-MM-AAAA (Fin, min. AAAA)" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:6px;">
                </div>
                
                <div style="margin-bottom:10px;">
                    <label style="font-size:0.75em; font-weight:700; color: var(--hapi-accent-text); display:block; margin-bottom:4px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4z"/><circle cx="7" cy="7" r="1.5"/></svg> Étiquette (catégorie) :</label>
                    <input type="text" class="inp-tag" list="existing-tags-list" value="${tag}" placeholder="Ex: Résistance, Collaboration..." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; background:var(--hapi-green-mist);">
                </div>

                <input type="text" class="inp-title" value="${headline}" placeholder="Titre de l'événement" style="width:100%; font-weight:bold; padding:8px; border:1px solid var(--border); border-radius:6px; margin-bottom:10px;">
                <textarea class="inp-text" rows="4" placeholder="Description pédagogique..." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px;">${text}</textarea>
            </div>

            <div style="background:var(--page-bg); padding:15px; border-radius:10px; border:1px dashed #cbd5e0;">
                <div style="display:flex; gap:6px; width:100%; align-items:center; flex-wrap:nowrap; margin-bottom:8px;">
                    <input type="text" class="wiki-search-input" placeholder="Mots-clés image..." style="height:38px; flex:1 1 auto; min-width:0; padding:0 12px; border:1px solid #cbd5e0; border-radius:19px; box-sizing:border-box; outline:none;">
                    <button class="btn-wiki-search" style="height:38px; flex:0 0 auto; padding:0 15px; margin:0; border-radius:19px; background:var(--hapi-green-dark); color:white; border:none; cursor:pointer; font-weight:bold; box-sizing:border-box; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>
                </div>

                <div class="wiki-results" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; max-height:280px; overflow-y:auto; background:var(--surface); padding:8px; border:1px solid var(--border); border-radius:6px; margin-bottom:12px; min-height:60px;"></div>

                <button type="button" class="btn-toggle-media" style="height:38px; width:100%; background:#64748b; color:white; border:none; border-radius:19px; padding:0 15px; font-weight:bold; font-size:0.85em; cursor:pointer; margin-bottom:12px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; transition:opacity 0.2s;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg> Ajouter média (URL / Iframe)</button>
                
                <div class="media-details" style="display:none; background:var(--surface); padding:12px; border:1px solid #cbd5e0; border-radius:12px; margin-bottom:12px;">
                    <label style="font-size:0.7em; font-weight:700; color:var(--text-muted);">Adresse URL du média :</label>
                    <input type="text" class="final-img-url" value="${mediaUrl}" placeholder="Lien YouTube, Vimeo, GoogleMaps, SoundCloud..." style="width:100%; padding:6px; border:1px solid #ccc; border-radius:6px; margin-bottom:8px; font-size:0.85em;">
                    
                    <label style="font-size:0.7em; font-weight:700; color:var(--text-muted);">Légende du média :</label>
                    <input type="text" class="inp-caption" value="${caption}" placeholder="Saisissez ici la légende..." style="width:100%; padding:6px; border:1px solid #ccc; border-radius:6px; margin-bottom:8px; font-size:0.85em;">
                    
                    <label style="font-size:0.7em; font-weight:700; color:var(--text-muted);">Crédits :</label>
                    <input type="text" class="final-img-credit" value="${credit}" placeholder="Auteur / Licence" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:6px; font-size:0.85em;">
                </div>

                <div style="display:flex; align-items:center; gap:12px; border-top:1px solid var(--border); padding-top:12px;">
                    <div style="width:60px; height:60px; border:2px solid var(--border); border-radius:6px; overflow:hidden; background:var(--page-bg); position:relative; flex-shrink:0; cursor:pointer;" class="img-preview-container">
                        <img class="selected-img-preview" src="${thumbnail}" style="width:100%; height:100%; object-fit:cover; display:${thumbnail ? 'block' : 'none'};">
                    </div>
                    <div style="flex:1; min-width:0; display:flex; flex-direction:column; justify-content: center; gap:6px;">
                        <input type="file" class="inp-thumb-local styled-file-input" accept="image/*" style="width:100%; font-size:0.85em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    </div>
                    <a href="#" class="btn-remove-img" style="font-size:0.75em; color:var(--danger-text); text-decoration:none; display:${mediaUrl ? 'inline' : 'none'}; font-weight:bold; padding:4px;">✕ Retirer</a>
                </div>
            </div>
        </div>
    `;
    list.appendChild(div);
    return div;
}

function addEraCard() {
    const list = document.getElementById('timeline-eras-list');
    const div = document.createElement('div');
    div.className = 'timeline-era-card';
    div.style.cssText = "background:var(--page-bg); border:1px solid var(--border); padding:20px; margin-bottom:15px; border-radius:10px; position:relative;";
    div.innerHTML = `
        <button class="btn-del-era" style="position:absolute; top:10px; right:10px; background:transparent; border:none; color:var(--text); width:28px; height:28px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;" title="Supprimer cette période"><svg class="ico" style="width:1.35em;height:1.35em;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px; padding-right:30px;">
            <input type="text" class="era-date-start" placeholder="Début (JJ-MM-AAAA ou AAAA)" style="padding:8px; border:1px solid var(--border); border-radius:6px;">
            <input type="text" class="era-date-end" placeholder="Fin (JJ-MM-AAAA ou AAAA)" style="padding:8px; border:1px solid var(--border); border-radius:6px;">
        </div>
        <div style="margin-bottom:10px;">
            <label style="font-size:0.75em; font-weight:700; color:var(--text-muted); display:block; margin-bottom:4px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4z"/><circle cx="7" cy="7" r="1.5"/></svg> Étiquette (catégorie) :</label>
            <input type="text" class="era-tag" list="existing-tags-list" placeholder="Ex: Guerre mondiale..." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px;">
        </div>
        <input type="text" class="era-title" placeholder="Nom de la période" style="width:100%; font-weight:bold; padding:8px; border:1px solid var(--border); border-radius:6px; margin-bottom:10px;">
        <textarea class="era-text" rows="2" placeholder="Description de la période..." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px;"></textarea>
    `;
    list.appendChild(div);
}

// ==========================================
// 3. INITIALISATION & UI
// ==========================================

export function init(p_container, corpusContent, updateBtnCallback) {
    container = p_container;
    updateGenerateButtonCallback = updateBtnCallback;

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

    container.innerHTML = `
    <style>
        .styled-file-input::file-selector-button { border-radius: 19px; padding: 0 16px; height: 38px; margin-right: 12px; border: none; background: var(--hapi-green-dark); color: white; font-weight: bold; cursor: pointer; transition: opacity 0.2s; }
        .styled-file-input::file-selector-button:hover { opacity: 0.9; }
        .styled-file-input { font-size: 0.85em; width: 100%; color: var(--text-muted); background: transparent; line-height: 38px; }
    </style>
        <div id="timeline-wrapper" style="font-family:'Segoe UI', sans-serif;">
            
            <div class="section" style="background:var(--surface); padding:25px; border-radius:12px; margin-bottom:20px; border-left:6px solid var(--hapi-green); box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                
                <h3 style="margin:0 0 15px 0; color:var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Assistant IA (Génération de Timeline)</h3>

                <div id="timeline-source-selector"></div>
                <div id="timeline-questions-repartition"></div>

                <div style="background:var(--hapi-green-mist); border:1px solid var(--border-strong); color: var(--hapi-accent-text); padding:15px; border-radius:8px; font-size:0.95em; margin-bottom:20px; margin-top:20px; display:flex; gap:12px; align-items:start;">
                    <span style="font-size:1.5em; flex-shrink:0;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5A7 7 0 1 0 5 9c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/></svg></span>
                    <div>Configurez le sujet pour orienter la génération de l'IA.</div>
                </div>

			<div style="margin-bottom:25px;">
                    <div class="input-group" style="margin: 0;">
                        <label for="timeline-subject" style="font-weight:bold; display:block; margin-bottom:6px; font-size:0.9em;">Sujet / Titre de l'activité :</label>
                        <input type="text" id="timeline-subject" placeholder="Ex: La Révolution Française" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px; box-sizing:border-box;">
                    </div>
                </div>
                
                <div id="prepare-action-timeline" style="text-align:center; margin-top:25px;">
                    <button id="btn-prep-timeline" class="btn" style="background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color:white; padding:10px 22px; font-size: 1em; font-weight:600; border-radius:25px; border:none; cursor:pointer; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt</button>
                </div>
            </div>

            <div id="ia-container-timeline" class="section" style="display:none; margin-bottom:20px; background:var(--surface); padding:25px; border-radius:12px; border-left:6px solid var(--hapi-green); box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                ${creerAssistantIA_HTML('ia-prompt-timeline', 'ia-response-timeline')}
                
                <div id="albert-action-timeline" style="display: none; text-align: center; margin-top: 15px; margin-bottom: 30px;">
                    <button id="btn-send-albert-timeline" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        🇫🇷 Envoyer le prompt à l'IA
                    </button>
                </div>
                
                <div style="text-align:center; display:none;">
                    <button id="btn-parse-ia-response-timeline" class="btn"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg> Valider et générer</button>
                </div>
            </div>

            <div id="editor-timeline" style="display:none; background:var(--surface); padding:25px; border-radius:12px; margin-top:20px; border-left:6px solid var(--hapi-grad-a); box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:2px solid var(--border); padding-bottom:10px;">
                    <h3 style="margin:0; color:var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Éditez les événements</h3>
                    <span id="counter-badge" style="background:#d1fae5; color:var(--text); padding:5px 12px; border-radius:15px; font-weight:bold;">0</span>
                </div>

                <div style="margin-bottom:25px; padding:20px; background:var(--hapi-green-mist); border-radius:12px; border:1px solid var(--border-strong);">
                    <label style="font-weight:700; color: var(--hapi-accent-text); display:block; margin-bottom:15px; font-size:1.1em;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg> Éléments d'introduction</label>
                    <div style="background:var(--surface); padding:15px; border-radius:8px; border:1px solid var(--hapi-green-pale); margin-bottom:20px;">
                        <label style="font-size:0.85em; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Texte de présentation :</label>
                        <textarea id="timeline-intro-text" rows="3" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; font-size:0.95em; box-sizing:border-box;" placeholder="Le résumé de l'IA apparaîtra ici..."></textarea>
                    </div>

                    <div style="display:grid; grid-template-columns: 2fr 1.2fr; gap:20px; align-items: stretch;">
                        <div style="background:var(--surface); padding:15px; border-radius:8px; border:1px solid var(--hapi-green-pale); display:flex; flex-direction:column;">
                            <label style="font-size:0.85em; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Recherche Wikimedia pour l'image de fond :</label>
                            <div style="display:flex; gap:6px; width:100%; align-items:center; flex-wrap:nowrap; margin-bottom:8px;">
                                <input type="text" id="bg-wiki-query" placeholder="Sujet de l'image..." style="height:38px; flex:1 1 auto; min-width:0; padding:0 12px; border:1px solid #cbd5e0; border-radius:19px; box-sizing:border-box; outline:none;">
                                <button id="btn-search-bg-wiki" style="height:38px; flex:0 0 auto; padding:0 15px; margin:0; border-radius:19px; background:var(--hapi-green-dark); color:white; border:none; cursor:pointer; font-weight:bold; box-sizing:border-box; transition:opacity 0.2s;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>
                            </div>
                            <div id="bg-wiki-results" style="display:none; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:12px; max-height:280px; overflow-y:auto; background:var(--surface); padding:8px; border-radius:4px; border:1px solid var(--border);"></div>
                        </div>

                        <div style="background:var(--surface); padding:15px; border-radius:18px; border:1px solid var(--hapi-green-pale); display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
                            <label style="font-size:0.85em; font-weight:700; color:var(--text-muted); display:block; margin-bottom:12px;">Import local :</label>
                            <div style="width:100%;">
                                <input type="file" id="bg-file-input" accept="image/*" class="styled-file-input">
                            </div>
                        </div>
                    </div>

                    <div id="bg-preview-zone" style="display:none; margin-top:20px; flex-direction:column; align-items:center; background:var(--surface); padding:15px; border-radius:10px; border:1px solid var(--border-strong); position:relative;">
                        <button id="btn-remove-bg" style="position:absolute; top:10px; right:10px; background:rgba(255,255,255,0.9); border:1px solid var(--border); color:var(--text); width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
                        <div style="width:100%; max-width:400px; height:200px; overflow:hidden; border:1px solid var(--border); background:var(--page-bg); display:flex; align-items:center; justify-content:center;"><img id="bg-selected-img" src="" style="max-width:100%; max-height:100%; object-fit:contain;"></div>
                        <div id="bg-selected-credit" style="margin-top:10px; font-size:0.85em; color: var(--hapi-accent-text); font-weight:600; text-align:center;"></div>
                        
                        <button id="btn-toggle-bg-meta" style="margin-top:10px; background:none; border:none; color: var(--hapi-accent-text); text-decoration:underline; cursor:pointer; font-size:0.85em;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg> Modifier les métadonnées (Titre, Date, Source)</button>
                        
                        <div id="bg-meta-details" style="display:none; width:100%; margin-top:15px; padding-top:10px; border-top:1px dashed #cbd5e0;">
                             <label style="font-size:0.75em; font-weight:700; color:var(--text-muted);">Légende / Titre :</label>
                             <input type="text" id="bg-final-caption" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px; margin-bottom:8px; box-sizing:border-box;">
                             <label style="font-size:0.75em; font-weight:700; color:var(--text-muted);">Année / Date :</label>
                             <input type="text" id="bg-final-year" placeholder="Ex: 1789" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px; margin-bottom:8px; box-sizing:border-box;">
                             <label style="font-size:0.75em; font-weight:700; color:var(--text-muted);">Source (URL) :</label>
                             <input type="text" id="bg-final-source" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px; margin-bottom:8px; box-sizing:border-box;">
                             <label style="font-size:0.75em; font-weight:700; color:var(--text-muted);">Crédits / Licence :</label>
                             <input type="text" id="bg-final-credit" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;">
                        </div>
                    </div>
                    
                    <input type="hidden" id="bg-final-url" value="">
                    
                    <div style="background:var(--surface); padding:15px; border-radius:18px; border:1px solid var(--hapi-green-pale); margin-top:10px;">
                        <button type="button" class="btn-toggle-intro-media" style="width:100%; background:#64748b; color:white; border:none; border-radius:18px; padding:8px; font-size:0.85em; cursor:pointer;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg> Ajouter un média complémentaire (vidéo, carte, son...)</button>
                        <div id="intro-media-details" style="display:none; margin-top:10px; padding:10px; border:1px solid #cbd5e0; border-radius:12px;">
                            <label style="font-size:0.75em; font-weight:700; color:var(--text-muted);">URL du média :</label>
                            <input type="text" id="intro-media-url" placeholder="YouTube, Google Maps, SoundCloud..." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; margin-bottom:10px; box-sizing:border-box;">
                            <label style="font-size:0.75em; font-weight:700; color:var(--text-muted);">Légende du média :</label>
                            <input type="text" id="intro-media-caption" placeholder="Légende..." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">
                            <label style="font-size:0.75em; font-weight:700; color:var(--text-muted);">Crédits du média :</label>
                            <input type="text" id="intro-media-credit" placeholder="Auteur / Licence..." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">
                        </div>
                    </div>

                    <datalist id="existing-tags-list"></datalist>
                </div>

                <div id="timeline-cards-list"></div>
                <button id="btn-add-manual" style="display:block; margin:25px auto; padding:10px 25px; background:#4b5563; color:white; border-radius:20px; border:none; cursor:pointer; font-weight:600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">+ Ajouter un événement manuel</button>
            </div>
            
            <div id="era-section-timeline" style="display:none; margin-top:20px;">
                <div style="background:var(--surface); padding:25px; border-radius:12px; border-left:6px solid #475569; box-shadow:0 4px 12px rgba(0,0,0,0.05); margin-bottom:20px;">
                    <h3 style="color:var(--text-muted); margin-bottom:15px; display:flex; align-items:center; gap:10px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Définissez des périodes</h3>
                    <div id="timeline-eras-list"></div>
                    <button id="btn-add-era" style="padding:10px 20px; background:#64748b; color:white; border:none; border-radius:20px; cursor:pointer; font-weight:600; font-size:0.9em; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">+ Ajouter une période</button>
                </div>  
            </div>
				
			<div id="timeline-options-section" class="input-group" style="margin-top: 40px;">
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
                                        <input type="checkbox" id="translate-ui-timeline" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                        <span style="font-weight:bold; font-size:1.05em; color: var(--hapi-accent-text);">Traduire les boutons H5P</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>	
				
				
        </div>
    `;

	const selectorContainer = container.querySelector('#timeline-source-selector');
	    if (selectorContainer) {
	        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'timeline', (selectedDocs) => {
	            // Appelle votre fonction de rendu existante (ajustez le nom si différent)
	            if (typeof renderRepartitionConfigTimeline === 'function') renderRepartitionConfigTimeline(selectedDocs);
	            else if (typeof renderRepartitionConfig === 'function') renderRepartitionConfig(selectedDocs);
            
	            showRegenerateButton(); // 🔄 Relance si la source change
	        });
	    }
	
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

	    // 2. Écouteurs sur le Sujet de la frise et la Répartition par source
	    container.addEventListener('input', (e) => {
	        if (e.target.id === 'timeline-subject' || 
	            e.target.classList.contains('source-question-count')) {
	            showRegenerateButton();
	        }
	    });

    const iaLauncher = container.querySelector('#ia-launcher-ia-prompt-timeline');
    if (iaLauncher) {
        iaLauncher.style.display = 'none';
    }

    container.querySelector('#btn-prep-timeline').addEventListener('click', handlePreparePrompt);
    
    const btnAlbert = container.querySelector('#btn-send-albert-timeline');
    if (btnAlbert) {
        btnAlbert.addEventListener('click', async () => {
            const originalText = btnAlbert.innerHTML;
            btnAlbert.disabled = true;
            btnAlbert.innerHTML = "L'IA génère les événements...";
            await callAlbertAPI('ia-prompt-timeline', 'ia-response-timeline', 'btn-parse-ia-response-timeline', btnAlbert);
            btnAlbert.innerHTML = originalText;
            btnAlbert.disabled = false;
        });
    }
    
    container.querySelector('#btn-parse-ia-response-timeline').addEventListener('click', handleParseResponse);
    container.querySelector('#btn-add-manual').addEventListener('click', () => { addCard(); refreshEventIndices(); updateCounter(); });
    
    document.getElementById('btn-toggle-bg-meta').addEventListener('click', (e) => {
        const details = document.getElementById('bg-meta-details');
        if (details.style.display === 'none' || details.style.display === '') {
            details.style.display = 'block';
        } else {
            details.style.display = 'none';
        }
    });

    document.getElementById('btn-search-bg-wiki').addEventListener('click', async () => {
        const q = document.getElementById('bg-wiki-query').value || document.getElementById('timeline-subject').value;
        const resDiv = document.getElementById('bg-wiki-results');
        resDiv.innerHTML = '<p style="grid-column:1/-1; text-align:center; font-size:0.8em; color: var(--hapi-accent-text);">Recherche...</p>';
        resDiv.style.display = 'grid';
        const images = await searchWikimedia(q);
        resDiv.innerHTML = '';
        if (images.length === 0) {
            resDiv.innerHTML = '<p style="grid-column:1/-1; text-align:center; font-size:0.8em; color:var(--text-muted);">Aucun résultat trouvé.</p>';
            return;
        }
        images.forEach(img => {
            const d = document.createElement('div');
            d.style.cssText = "height:65px; border:1px solid var(--border); cursor:pointer; border-radius:4px; overflow:hidden; transition: transform 0.2s;";
            d.innerHTML = `<img src="${img.thumb}" style="width:100%; height:100%; object-fit:cover;">`;
            d.onclick = () => openLightbox(img, null, true);
            resDiv.appendChild(d);
        });
    });

    document.getElementById('bg-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                document.getElementById('bg-final-url').value = evt.target.result;
                document.getElementById('bg-final-credit').value = "Image locale";
                document.getElementById('bg-final-caption').value = "Image locale";
                document.getElementById('bg-final-year').value = "";
                document.getElementById('bg-final-source').value = "";
                
                document.getElementById('bg-selected-img').src = evt.target.result;
                document.getElementById('bg-selected-credit').innerText = "Arrière-plan : Import local";
                document.getElementById('bg-preview-zone').style.display = 'flex';
                updateGenerateButtonCallback();
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('btn-remove-bg').addEventListener('click', () => {
        document.getElementById('bg-final-url').value = "";
        document.getElementById('bg-final-credit').value = "";
        document.getElementById('bg-final-caption').value = "";
        document.getElementById('bg-final-year').value = "";
        document.getElementById('bg-final-source').value = "";
        document.getElementById('bg-selected-img').src = "";
        document.getElementById('bg-preview-zone').style.display = 'none';
        document.getElementById('bg-file-input').value = "";
        document.getElementById('bg-wiki-results').style.display = 'none';
        updateGenerateButtonCallback();
    });

    setupDelegation();

    // 🔴 BOUCLIER ANTI-BARRE DU BAS
    const enforceHideBottomBar = () => {
        const genSection = document.getElementById('generate-section');
        const cardsCount = document.querySelectorAll('#timeline-cards-list .timeline-card').length;
        if (genSection && cardsCount < 1) {
            genSection.style.display = 'none';
        } else if (genSection && cardsCount >= 1) {
            genSection.style.display = 'block';
        }
    };

    enforceHideBottomBar();
    setTimeout(enforceHideBottomBar, 50);

    const tabBtn = document.querySelector('.tab-btn[data-tab-target="timeline"]');
    if (tabBtn) {
        tabBtn.addEventListener('click', () => setTimeout(enforceHideBottomBar, 10));
    }
}

function setupDelegation() {
    const list = document.getElementById('timeline-cards-list');
    const wrapper = document.getElementById('timeline-wrapper');
    
    if (!wrapper) return;

    wrapper.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-toggle-intro-media')) {
            const target = document.getElementById('intro-media-details');
            if (target) target.style.display = target.style.display === 'none' ? 'block' : 'none';
        }

        if (e.target.id === 'btn-add-era') {
            addEraCard();
            updateGenerateButtonCallback();
        }

        if (e.target.closest('.btn-del-era')) {
            if (confirm("Supprimer cette période ?")) {
                e.target.closest('.timeline-era-card').remove();
                updateGenerateButtonCallback();
            }
        }
    });

    if (list) {
        list.addEventListener('click', async (e) => {
            const card = e.target.closest('.timeline-card');
            if (!card) return;

            if (e.target.classList.contains('btn-toggle-media') || e.target.closest('.btn-toggle-media')) {
                e.preventDefault();
                const details = card.querySelector('.media-details');
                if (details) {
                    const isHidden = details.style.display === 'none' || details.style.display === '';
                    details.style.display = isHidden ? 'block' : 'none';
                }
            }

            if (e.target.closest('.btn-wiki-search')) {
                const q = card.querySelector('.wiki-search-input').value.trim();
                if (q) triggerAutoSearch(card, q);
            }

            if (e.target.classList.contains('btn-del') || e.target.closest('.btn-del')) {
                if (confirm("Supprimer cet événement ?")) { 
                    card.remove(); 
                    refreshEventIndices(); 
                    updateGenerateButtonCallback(); 
                }
            }

            if (e.target.classList.contains('btn-remove-img')) {
                e.preventDefault(); 
                card.querySelector('.final-img-url').value = ""; 
                const preview = card.querySelector('.selected-img-preview');
                if (preview) preview.style.display = 'none'; 
                updateGenerateButtonCallback();
            }
        });

        list.addEventListener('change', (e) => {
            if (e.target.classList.contains('inp-thumb-local')) {
                const file = e.target.files[0];
                const card = e.target.closest('.timeline-card');
                if (file && card) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        const thumbImg = card.querySelector('.selected-img-preview');
                        if (thumbImg) {
                            thumbImg.src = evt.target.result;
                            thumbImg.style.display = 'block';
                            updateGenerateButtonCallback();
                        }
                    };
                    reader.readAsDataURL(file);
                }
            }
        });

        list.addEventListener('input', (e) => {
            if (e.target.classList.contains('inp-tag')) {
                const allTags = Array.from(document.querySelectorAll('.inp-tag, .era-tag'))
                    .map(input => input.value.trim())
                    .filter((v, i, a) => v && a.indexOf(v) === i);
                
                const datalist = document.getElementById('existing-tags-list');
                if (datalist) {
                    datalist.innerHTML = allTags.map(tag => `<option value="${tag}">`).join('');
                }
            }
            updateGenerateButtonCallback();
        });
    }
}

async function handleParseResponse() {
    const raw = document.getElementById('ia-response-timeline').value;
    let json;
    const toFR = (date) => {
        if (!date || !date.includes('-')) return date;
        const p = date.split('-');
        if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`;
        return date;
    };
    
    try {
        let jsonStr = raw.trim();
        const startIdx = jsonStr.indexOf('{');
        const endIdx = jsonStr.lastIndexOf('}');
        json = JSON.parse(jsonStr.substring(startIdx, endIdx + 1));
    } catch(e) { alert("Format JSON invalide."); return; }

    if (json.intro) {
        document.getElementById('timeline-intro-text').value = json.intro;
    }

    const subject = document.getElementById('timeline-subject').value;
    const bgQueryInput = document.getElementById('bg-wiki-query');
    if (bgQueryInput && subject) {
        bgQueryInput.value = subject;
        document.getElementById('btn-search-bg-wiki').click();
    }

    const list = document.getElementById('timeline-cards-list');
    if (list) list.innerHTML = '';
    
    const events = json.events || [];
    for (const item of events) {
        const itemFR = { ...item, startDate: toFR(item.startDate), endDate: toFR(item.endDate) };
        const card = addCard(itemFR);
        const searchQuery = item.image_prompt || item.headline || "";
        if (searchQuery && card) {
            const wikiInput = card.querySelector('.wiki-search-input');
            if (wikiInput) wikiInput.value = searchQuery;
            triggerAutoSearch(card, searchQuery);
        }
    }
    
    refreshEventIndices();

    document.getElementById('editor-timeline').style.display = 'block';
    
    const eraSection = document.getElementById('era-section-timeline');
    if (eraSection) eraSection.style.display = 'block';

    if(document.getElementById('generate-section')) {
        document.getElementById('generate-section').style.display = 'block';
    }

    updateCounter();
    updateGenerateButtonCallback();
    
    document.getElementById('editor-timeline').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showRegenerateButton() {
    const iaContainer = document.getElementById('ia-container-timeline');
    const btnPrepare = document.getElementById('btn-prep-timeline');

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


// =========================================================
// 💾 GESTION IMPORT / EXPORT (déléguée à utils/states/timeline-state.js)
// =========================================================

export async function getUIState() {
    return getTimelineState();
}

export function setUIState(config) {
    setTimelineState(config, {
        clearPreview: () => {
            const listDates = document.getElementById('timeline-cards-list');
            if (listDates) listDates.innerHTML = '';
            
            const listEras = document.getElementById('timeline-eras-list');
            if (listEras) listEras.innerHTML = '';
            
            refreshEventIndices();
        },
        addDateCard: (data) => addCard(data), 
        addEraCard: () => addEraCard(),   
        updateBtn: updateGenerateButtonCallback
    });
}

export function gatherData() {
    const fromFR = (date) => {
        if (!date || !date.includes('-')) return date;
        const p = date.split('-');
        if (p.length === 3) return `${p[2]},${p[1]},${p[0]}`; 
        return date;
    };

    const cards = document.querySelectorAll('.timeline-card');
    const eraCards = document.querySelectorAll('.timeline-era-card');
    if (cards.length === 0 && eraCards.length === 0) return null;
    
	const translateCheckbox = document.getElementById('translate-ui-timeline');
    
	    // 🟢 On récupère la langue depuis le menu global de HAPI
	const langSelect = document.getElementById('global-language');
	const langValue = langSelect ? langSelect.value.trim() : 'Français';
    
	    // On mappe vers le code court pour Timeline
	const mapLangues = { 
	        'Français': 'fr', 'Normand': 'fr', 
	        'English': 'en', 'Anglais': 'en', 
	        'Spanish': 'es', 'Espagnol': 'es', 
	        'German': 'de', 'Allemand': 'de',
	        'Italian': 'it', 'Italien': 'it'
	    };
	const codeLangue = mapLangues[langValue] || 'fr';

    const subject = document.getElementById('timeline-subject')?.value.trim() || "";
    const introText = document.getElementById('timeline-intro-text')?.value.trim() || "";
    
    const bgUrl = document.getElementById('bg-final-url')?.value.trim() || "";
    
    const bgObj = bgUrl ? {
        media: bgUrl,
        copyright: {
             author: document.getElementById('bg-final-credit')?.value.trim() || "",
             title: document.getElementById('bg-final-caption')?.value.trim() || "",
             year: document.getElementById('bg-final-year')?.value.trim() || "",
             source: document.getElementById('bg-final-source')?.value.trim() || "",
             license: 'U'
        }
    } : null;

    const introMediaUrl = document.getElementById('intro-media-url')?.value.trim() || "";
    const introCredit = document.getElementById('intro-media-credit')?.value.trim() || "";
    const introCaption = document.getElementById('intro-media-caption')?.value.trim() || "";
    
    const items = [];
    cards.forEach(card => {
        const rawStart = card.querySelector('.inp-date-start')?.value.trim();
        const headline = card.querySelector('.inp-title')?.value.trim();
        if (!rawStart || !headline) return; 

        const mediaUrl = card.querySelector('.final-img-url')?.value.trim();
        const thumbSrc = card.querySelector('.selected-img-preview')?.src;
        
        let assetObj = {};
        if (mediaUrl || (thumbSrc && !thumbSrc.includes('localhost'))) {
            assetObj = {
                media: mediaUrl,
                credit: card.querySelector('.final-img-credit')?.value.trim() || "",
                caption: card.querySelector('.inp-caption')?.value.trim() || "",
                thumbnail: (thumbSrc && !thumbSrc.includes('localhost')) ? thumbSrc : ""
            };
        }

        items.push({
            startDate: fromFR(rawStart),
            endDate: fromFR(card.querySelector('.inp-date-end')?.value.trim()),
            headline: headline,
            tag: card.querySelector('.inp-tag')?.value.trim(), 
            text: `<p>${card.querySelector('.inp-text')?.value.trim()}</p>`,
            asset: assetObj
        });
    });

    const eras = [];
    eraCards.forEach(card => {
        const start = card.querySelector('.era-date-start')?.value.trim();
        const title = card.querySelector('.era-title')?.value.trim();
        if (!start || !title) return;

        eras.push({
            startDate: fromFR(start),
            endDate: fromFR(card.querySelector('.era-date-end')?.value.trim()),
            headline: title,
            tag: card.querySelector('.era-tag')?.value.trim(),
            text: `<div>${card.querySelector('.era-text')?.value.trim()}</div>`
        });
    });

    return {
        titre: subject,
        language: codeLangue, 
        headline: { 
            title: subject, 
            text: `<div>${introText}</div>`, 
            asset: introMediaUrl ? {
                media: introMediaUrl,
                credit: introCredit,
                caption: introCaption
            } : null,
            backgroundImage: bgObj
        },
        dates: items,
        eras: eras,
        l10n: getH5PLocalization(translateCheckbox && translateCheckbox.checked ? langValue : 'Français', 'Timeline')
    };
}