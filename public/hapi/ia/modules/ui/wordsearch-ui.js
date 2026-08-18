// Fichier: modules/ui/wordsearch-ui.js

import { logger } from '../utils/logger.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { creerAssistantIA_HTML } from '../utils/helpers.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_WordSearch } from '../ia/prompt-builder.js';
import { parserReponseIA_WordList } from '../ia/response-parser.js';
import { getH5PLocalization } from '../utils/h5p-translations.js';
import { getWordSearchState, setWordSearchState } from '../utils/states/wordsearch-state.js';
import { SourceSelector } from './source-selector.js';

let container = null;
let corpus = '';
let updateGenerateButtonCallback = () => {};

let localSourceSelector = null;
let currentRepartition = {};

export function init(targetContainer, corpusContent, updateBtnCallback) {
    container = targetContainer;
    corpus = corpusContent;
    updateGenerateButtonCallback = updateBtnCallback;
    
    logger.log('🔧 Initialisation de Mots Mêlés UI...');
    
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
            .info-tooltip { position: relative; display: inline-block; cursor: help; margin-left: 5px; font-size: 1.1em; }
            .info-tooltip .tooltip-text { visibility: hidden; width: 300px; background-color: #2d3748; color: #fff; text-align: left; border-radius: 6px; padding: 15px; position: absolute; z-index: 100; bottom: 135%; left: 50%; margin-left: -150px; opacity: 0; transition: opacity 0.3s; font-size: 0.85rem; font-weight: normal; line-height: 1.5; box-shadow: 0 4px 10px rgba(0,0,0,0.15); }
            .info-tooltip .tooltip-text::after { content: ""; position: absolute; top: 100%; left: 50%; margin-left: -5px; border-width: 5px; border-style: solid; border-color: #2d3748 transparent transparent transparent; }
            .info-tooltip:hover .tooltip-text { visibility: visible; opacity: 1; }
            .tooltip-list { margin: 0; padding-left: 15px; list-style-type: none; }
            .tooltip-list li { margin-bottom: 8px; }
            .tooltip-list strong { color: var(--hapi-green-light); }
        </style>

        <div id="wordsearch-generator-wrapper">
            
            <div class="section" style="background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                
                <div id="wordsearch-source-selector"></div>
                <div id="wordsearch-questions-repartition"></div>

                <h2 style="margin:0 0 15px 0;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configuration des mots mêlés</h2>

                <div style="display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 25px;">
                    <div class="input-group" style="margin: 0 0;">
                        <label for="wordsearch-title" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Titre de l'activité :</label>
                        <input type="text" id="wordsearch-title" value="Mots mêlés" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div class="input-group" style="margin: 0 0;">
                        <label for="wordsearchTask" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Consigne pour l'élève :</label>
                        <input type="text" id="wordsearchTask" value="Retrouvez les mots cachés dans la grille." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                </div>

                <div class="input-group" style="padding: 15px; border-radius: 6px; border: 1px solid var(--border-strong); background: var(--hapi-green-mist); margin-bottom: 20px; margin: 0 0;">
                    <label style="display:block; font-weight:bold; margin-bottom:15px; color:var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Stratégie d'extraction IA :</label>
                    
                    <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
                        <div>
                            <label style="display:block; font-size:0.9em; margin-bottom:8px; color:var(--text-muted);">
                                Cochez les types de mots :
                                <span class="info-tooltip"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                                    <div class="tooltip-text">
                                        <ul class="tooltip-list" style="padding:0; margin:0;">
                                            <li><strong>Vocabulaire clé :</strong> Noms essentiels pour le sens.</li>
                                            <li><strong>Verbes :</strong> Actions (mis à l'infinitif).</li>
                                            <li><strong>Adjectifs :</strong> Qualités et descriptions.</li>
                                            <li><strong>Invariables :</strong> Mots de liaison, adverbes.</li>
                                            <li><strong>Complexes :</strong> Difficultés orthographiques.</li>
                                        </ul>
                                    </div>
                                </span>
                            </label>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;">
                                <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" class="ws-mode-checkbox" value="vocabulary" checked style="transform: scale(1.1); margin-right: 8px; accent-color: var(--hapi-green);"> Vocabulaire clé</label>
                                <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" class="ws-mode-checkbox" value="verbs" style="transform: scale(1.1); margin-right: 8px; accent-color: var(--hapi-green);"> Verbes (Infinitif)</label>
                                <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" class="ws-mode-checkbox" value="adjectives" style="transform: scale(1.1); margin-right: 8px; accent-color: var(--hapi-green);"> Adjectifs</label>
                                <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" class="ws-mode-checkbox" value="invariable" style="transform: scale(1.1); margin-right: 8px; accent-color: var(--hapi-green);"> Mots invariables</label>
                                <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" class="ws-mode-checkbox" value="complex" style="transform: scale(1.1); margin-right: 8px; accent-color: var(--hapi-green);"> Mots complexes</label>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="prepare-action-wordsearch" style="margin-top: 35px; text-align: center;">
                    <button id="btn-prepare-prompt-wordsearch" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt
                    </button>
                </div>
            </div>

            <div id="ia-container-wordsearch" class="section" style="display: none; background: var(--surface); border-radius: 8px; padding: 12px 25px 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                ${creerAssistantIA_HTML('ia-prompt-wordsearch', 'ia-response-wordsearch')}
            </div>

            <div id="albert-action-wordsearch" style="display: none; text-align: center; margin-top: 15px; margin-bottom: 30px;">
                <button id="btn-send-albert-wordsearch" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                    🇫🇷 Envoyer le prompt à l'IA
                </button>
            </div>

            <div class="section" id="wordsearch-preview-section" style="display:none; margin-top: 20px; background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <div style="border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="margin:0; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg> Liste des mots à trouver</h2>
                    <p id="ws-status-indicator" style="font-weight:bold; color:#e11d48; font-size:0.9em;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> Il faut au moins un mot pour générer la grille.</p>
                </div>
                
                <div class="input-group" style="margin: 0 0;">
                    <label for="wordsearchText" style="display:block; font-weight:bold; margin-bottom:6px;">Mots extraits (séparés par des virgules) :</label>
                    <textarea id="wordsearchText" rows="6" style="width:100%; padding:15px; border:1px solid var(--border); border-radius:6px; font-family:monospace; background:var(--page-bg); color:var(--text); letter-spacing: 1px; resize:vertical;"></textarea>
                    <div style="font-size:0.85em; color:var(--text-muted); margin-top:8px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> Vous pouvez ajouter ou supprimer des mots manuellement.</div>
                </div>

                <div id="wordsearch-options-section" class="input-group" style="margin-top: 40px;">
                    <details style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px;">
                        <summary style="font-weight:bold; font-size:1.2em; color:var(--text); cursor:pointer; outline:none; list-style-position: inside;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options globales
                        </summary>
                        
                        <div style="margin-top: 20px;">
                            <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px; margin-bottom: 20px;">
                                <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options de la grille
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
                                    <label style="cursor:pointer; display:flex; align-items:center;"><input type="checkbox" id="ws-h" checked style="margin-right:8px; width:16px; height:16px; accent-color: var(--hapi-green);"> Horizontal (→)</label>
                                    <label style="cursor:pointer; display:flex; align-items:center;"><input type="checkbox" id="ws-v" checked style="margin-right:8px; width:16px; height:16px; accent-color: var(--hapi-green);"> Vertical (↓)</label>
                                    <label style="cursor:pointer; display:flex; align-items:center;"><input type="checkbox" id="ws-d" checked style="margin-right:8px; width:16px; height:16px; accent-color: var(--hapi-green);"> Diagonales (↘)</label>
                                    <label style="cursor:pointer; display:flex; align-items:center;"><input type="checkbox" id="ws-show-list" checked style="margin-right:8px; width:16px; height:16px; accent-color: var(--hapi-green);"> Afficher la liste</label>
                                    <label style="cursor:pointer; display:flex; align-items:center;"><input type="checkbox" id="ws-h-back" style="margin-right:8px; width:16px; height:16px; accent-color: var(--hapi-green);"> Horizontal inversé (←)</label>
                                    <label style="cursor:pointer; display:flex; align-items:center;"><input type="checkbox" id="ws-v-up" style="margin-right:8px; width:16px; height:16px; accent-color: var(--hapi-green);"> Vertical inversé (↑)</label>
                                </div>
                            </div>

                            <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px;">
                                <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options supplémentaires
                                </div>
                                <div style="display:flex; flex-direction:column; gap:20px;">
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="translate-ui-ws" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
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

	const selectorContainer = container.querySelector('#wordsearch-source-selector');
	    if (selectorContainer) {
	        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'wordsearch', (selectedDocs) => {
	            // Remplacez 'renderRepartitionConfigWordSearch' par le nom de votre fonction si nécessaire
	            if (typeof renderRepartitionConfigWordSearch === 'function') renderRepartitionConfigWordSearch(selectedDocs);
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

	    // 2. Écouteur sur la répartition (Nombre de mots par source)
	    const repartitionContainer = container.querySelector('#wordsearch-questions-repartition');
	    if (repartitionContainer) {
	        repartitionContainer.addEventListener('input', (e) => {
	            if (e.target.classList.contains('source-question-count')) {
	                showRegenerateButton();
	            }
	        });
	    }	

    // Événements Boutons
    document.getElementById('btn-prepare-prompt-wordsearch').addEventListener('click', handlePreparePrompt);
    document.getElementById('btn-send-albert-wordsearch').addEventListener('click', handleGenerateAlbertWordsearch);
    document.getElementById('btn-parse-ia-response-wordsearch').addEventListener('click', handleParseIA);
    
    document.getElementById('wordsearchText').addEventListener('input', () => {
        updateGenerateButtonCallback();
        checkStatus();
    });

    // 🔴 BOUCLIER ANTI-BARRE DU BAS
    const enforceHideBottomBar = () => {
        const genSection = document.getElementById('generate-section');
        const textarea = document.getElementById('wordsearchText');
        if (genSection && (!textarea || textarea.value.trim() === '')) {
            genSection.style.display = 'none';
        }
    };

    enforceHideBottomBar();
    setTimeout(enforceHideBottomBar, 50);

    const tabBtn = document.querySelector('.tab-btn[data-tab-target="wordsearch"]');
    if (tabBtn) {
        tabBtn.addEventListener('click', () => setTimeout(enforceHideBottomBar, 10));
    }
}

function renderRepartitionConfigWordSearch(selectedDocs) {
    const repContainer = container.querySelector('#wordsearch-questions-repartition');
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
        <div style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 8px; padding: 15px; margin-top: 10px; max-height: 250px; overflow-y: auto;">
            <label style="display:flex; justify-content:space-between; align-items:center; font-size: 0.9em; font-weight:bold; margin-bottom:12px; color:var(--text-muted);">
                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Nombre de mots à extraire par document</span>
            </label>
    `;

    selectedDocs.forEach(doc => {
        let defaultCount = doc.priority === 3 ? 6 : (doc.priority === 2 ? 4 : 3);
        const val = currentRepartition[doc.id] !== undefined ? currentRepartition[doc.id] : defaultCount;
        currentRepartition[doc.id] = val;

        const icon = getDocIcon(doc);

        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed var(--border);">
                <span style="font-size: 0.9em; color: var(--text); display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 75%;" title="${doc.title}">
                    <span>${icon}</span> <span style="overflow: hidden; text-overflow: ellipsis;">${doc.title}</span>
                </span>
                <input type="number" class="source-question-count" data-source-id="${doc.id}" value="${val}" min="0" max="30" style="width: 60px; padding: 5px; border: 1px solid var(--border); border-radius: 4px; text-align: center; font-weight: bold; color: var(--text);">
            </div>
        `;
    });

    html += `</div>`;
    repContainer.innerHTML = html;
}

async function handlePreparePrompt() {
    const btn = document.getElementById('btn-prepare-prompt-wordsearch');
    
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

    const success = await preparerAssistantIA_WordSearch(repartitionMap); 
    
    if (success) {
        // 🟢 NOUVEAU : On cache le conteneur parent de manière sécurisée
        if (btn.parentElement) {
            btn.parentElement.style.display = 'none';
        }

        const iaContainer = document.getElementById('ia-container-wordsearch');
        if (iaContainer) {
            iaContainer.style.display = 'block';
            const promptArea = document.getElementById('ia-prompt-wordsearch');
            if (promptArea) {
                promptArea.removeAttribute('readonly'); 
                promptArea.disabled = false;
                promptArea.style.backgroundColor = 'var(--field-bg)'; 
                promptArea.style.border = '2px solid var(--hapi-green)';
            }
        }
        
        const albertAction = document.getElementById('albert-action-wordsearch');
        if (albertAction) albertAction.style.display = 'block';

        setTimeout(() => {
            const iaContainerToScroll = document.getElementById('ia-container-wordsearch');
            if (iaContainerToScroll) iaContainerToScroll.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
    
    // 🟢 On réinitialise l'état
    btn.disabled = false;
    btn.innerHTML = originalText;
}

async function handleGenerateAlbertWordsearch() {
    const btn = document.getElementById('btn-send-albert-wordsearch');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "L'IA cherche les mots...";

    await callAlbertAPI('ia-prompt-wordsearch', 'ia-response-wordsearch', 'btn-parse-ia-response-wordsearch', btn);

    btn.innerHTML = originalText;
    btn.disabled = false;
}

function handleParseIA() {
    const reponseBrute = document.getElementById('ia-response-wordsearch').value;
    if (!reponseBrute.trim()) return;

    let mots = parserReponseIA_WordList(reponseBrute);
    
    // 🟢 SÉCURITÉ : Si le parser renvoie directement du texte au lieu d'un tableau
    let texteFinal = "";
    if (Array.isArray(mots)) {
        texteFinal = mots.join(', ');
    } else if (typeof mots === 'string') {
        texteFinal = mots;
    }

    if (texteFinal.trim().length > 0) {
        document.getElementById('wordsearchText').value = texteFinal;
        updateGenerateButtonCallback();
        checkStatus();
        
        const previewSection = document.getElementById('wordsearch-preview-section');
        if (previewSection) {
            previewSection.style.display = 'block';
            previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        const genSection = document.getElementById('generate-section');
        if (genSection) genSection.style.display = 'block';
    } else {
        alert("Aucun mot trouvé dans la réponse de l'IA.");
    }
}

function checkStatus() {
    const statusDiv = document.getElementById('ws-status-indicator');
    const text = document.getElementById('wordsearchText').value.trim();
    if (statusDiv) {
        if (text) {
            statusDiv.textContent = `Mots détectés. Prêt à générer.`;
            statusDiv.style.color = 'var(--hapi-grad-a)';
        } else {
            statusDiv.textContent = `Il faut au moins un mot pour générer la grille.`;
            statusDiv.style.color = 'var(--danger-text)';
        }
    }
}

function showRegenerateButton() {
    const iaContainer = document.getElementById('ia-container-wordsearch');
    const btnPrepare = document.getElementById('btn-prepare-prompt-wordsearch');

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


export function getUIState() {
    return getWordSearchState();
}

export function setUIState(config) {
    setWordSearchState(config, {
        updateBtn: updateGenerateButtonCallback
    });
}

export function gatherData() {
    logger.log('📊 Collecte des données Mots Mêlés...');
    const mots = document.getElementById('wordsearchText').value.trim();
    
    if (!mots) {
        alert("La liste de mots est vide.");
        return null;
    }

    const langSelect = document.getElementById('global-language');
    const lang = langSelect ? langSelect.value : 'Français';
    
    const niveauSelect = document.getElementById('global-niveau');
    const niveau = niveauSelect ? niveauSelect.value : 'Cycle 2';

    const shouldTranslateUI = document.getElementById('translate-ui-ws')?.checked;
    const uiLanguage = shouldTranslateUI ? lang : 'Français';
    const localizationParams = getH5PLocalization(uiLanguage, 'FindTheWords');

    const alphabets = {
        'Français': "ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÇÉÈÊËÎÏÔŒÙÛÜ",
        'English': "ABCDEFGHIJKLMNOPQRSTUVWXYZ", 
        'Spanish': "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑÜ", 
        'German': "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜß", 
        'Italian': "ABCDEFGHIJKLMNOPQRSTUVWXYZÀÈÉÌÍÒÓÙÚ", 
        'Dutch': "ABCDEFGHIJKLMNOPQRSTUVWXYZËÏÖÜÉ", 
        'Portuguese': "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÂÃÀÇÉÊÍÓÔÕÚ", 
        'Latin': "ABCDEFGHIJKLMNOPQRSTUVWXYZ", 
        'Normand': "ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÄÆÇÉÈÊËÎÏÔŒÙÛÜŸ" 
    };

    const currentFillPool = alphabets[lang] || alphabets['Français'];

    const donnees = {
        titre: document.getElementById('wordsearch-title').value,
        niveau: niveau,
        consignes: document.getElementById('wordsearchTask').value,
        mots: mots, 
        comportement: {
            orientations: {
                horizontal: document.getElementById('ws-h').checked, 
                horizontalBack: document.getElementById('ws-h-back').checked,
                vertical: document.getElementById('ws-v').checked, 
                verticalUp: document.getElementById('ws-v-up').checked,
                diagonal: document.getElementById('ws-d').checked, 
                diagonalBack: false,
                diagonalUp: false, 
                diagonalUpBack: false
            },
            showVocabulary: document.getElementById('ws-show-list').checked,
            enableRetry: true, 
            enableShowSolution: true,
            fillPool: currentFillPool
        },
        l10n: localizationParams
    };
    
    return donnees;
}