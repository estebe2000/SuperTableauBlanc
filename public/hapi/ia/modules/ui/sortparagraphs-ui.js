// Fichier: modules/ui/sortparagraphs-ui.js

import { logger } from '../utils/logger.js';
import { creerAssistantIA_HTML, creerFeedbackIntervallesHTML, initFeedbackIntervalles, getFeedbackIntervallesData, setFeedbackIntervallesData } from '../utils/helpers.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_SortParagraphs } from '../ia/prompt-builder.js';
import { parserReponseIA_SortParagraphs } from '../ia/response-parser.js';
import { getH5PLocalization } from '../utils/h5p-translations.js';
import { getSortParagraphsState, setSortParagraphsState } from '../utils/states/sortparagraphs-state.js';
import { SourceSelector } from './source-selector.js';
import { corpusManager } from '../corpus/corpus-manager.js';

let localSourceSelector = null;
let currentRepartition = {};

let container = null;
let corpus = '';
let updateGenerateButtonCallback = () => {};
let paragraphCounter = 0;

export function init(targetContainer, corpusContent, updateBtnCallback) {
    container = targetContainer;
    corpus = corpusContent;
    updateGenerateButtonCallback = updateBtnCallback;
    paragraphCounter = 0;
    
    logger.log('🔧 Initialisation de Sort Paragraphs UI...');

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
        <div id="sortparagraphs-generator-wrapper">
            
            <div class="section" style="background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                
                <div id="sortparagraphs-source-selector"></div>
                <div id="sortparagraphs-questions-repartition"></div>

                <h2 style="margin:0 0 15px 0;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configuration du tri de paragraphes</h2>
                
                <div style="display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 25px;">
                    <div class="input-group" style="margin: 0 0;">
                        <label for="sortparagraphs-title" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Titre de l'activité :</label>
                        <input type="text" id="sortparagraphs-title" value="Remettre dans l'ordre" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div class="input-group" style="margin: 0 0;">
                        <label for="sortparagraphs-task" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Consigne pour l'élève :</label>
                        <input type="text" id="sortparagraphs-task" value="Remettez les paragraphes dans le bon ordre." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div class="input-group" style="margin: 0 0;">
                        <label for="sortparagraphs-mode" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Mode de génération (pour l'IA) :</label>
                        <select id="sortparagraphs-mode" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                            <option value="strict" selected>Strict (Extraits exacts du texte)</option>
                            <option value="creative">Créatif (Histoire réécrite)</option>
                        </select>
                    </div>
                </div>

                <div id="prepare-action-sortparagraphs" style="margin-top: 35px; text-align: center;">
                    <button id="btn-prepare-prompt-sortparagraphs" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt
                    </button>
                </div>
            </div>
            
            <div id="ia-container-sortparagraphs" class="section" style="display: none; background: var(--surface); border-radius: 8px; padding: 12px 25px 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                ${creerAssistantIA_HTML('ia-prompt-sortparagraphs', 'ia-response-sortparagraphs')}
            </div>
            
            <div id="albert-action-sortparagraphs" style="display: none; text-align: center; margin-top: 15px; margin-bottom: 30px;">
                <button id="btn-send-albert-sortparagraphs" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                    🇫🇷 Envoyer le prompt à l'IA
                </button>
            </div>
            
            <div class="section" id="sortparagraphs-preview-section" style="display:none; margin-top: 20px; background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <div style="border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="margin:0; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Éditez l'ordre correct</h2>
                    <p style="font-size:0.9em; color:var(--text-muted);">L'ordre affiché ici sera considéré comme l'ordre <strong>CORRECT</strong>.</p>
                    <p id="sp-status-indicator" style="font-weight:bold; color:#e11d48; font-size:0.9em;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> Il faut au moins 2 paragraphes non vides pour générer.</p>
                </div>
                
                <div id="sortparagraphs-list"></div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn" id="btn-add-paragraph" style="background:#6c757d; color:white; border:none; padding:10px 20px; border-radius:25px; cursor:pointer;">+ Ajouter un paragraphe</button>
                </div>

				<div class="input-group" style="display: none; margin-top: 40px;" id="sortparagraphs-options-section">
                    <details style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px;">
                        <summary style="font-weight:bold; font-size:1.2em; color:var(--text); cursor:pointer; outline:none; list-style-position: inside;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options globales et techniques
                        </summary>
                        
                        <div style="margin-top: 20px;" id="sp-global-wrapper">
                            <style>
                                #sp-global-wrapper .section { padding: 0; box-shadow: none; border: none; background: transparent; margin: 0; }
                                #sp-global-wrapper h2 { display: none; }
                            </style>
                            
                           ${creerFeedbackIntervallesHTML('sp', '')}

                            <hr style="border:0; border-top:1px solid var(--border); margin:25px 0 20px 0;">

                            <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px;">
                                <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options supplémentaires
                                </div>
                                <div style="display:flex; flex-direction:column; gap:20px;">
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="translate-ui-sp" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
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
	
	

	const selectorContainer = container.querySelector('#sortparagraphs-source-selector');
	    if (selectorContainer) {
	        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'sortparagraphs', (selectedDocs) => {
	            renderRepartitionConfigSortParagraphs(selectedDocs);
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

	    // 2. Écouteurs spécifiques au Tri de Paragraphes (Mode et Répartition)
	    container.addEventListener('change', (e) => {
	        if (e.target.id === 'sortparagraphs-mode') {
	            showRegenerateButton();
	        }
	    });

	    container.addEventListener('input', (e) => {
	        if (e.target.classList.contains('source-question-count')) {
	            showRegenerateButton();
	        }
	    });
		
		
    // Événements Boutons
    document.getElementById('btn-prepare-prompt-sortparagraphs').addEventListener('click', handlePreparePrompt);
    document.getElementById('btn-send-albert-sortparagraphs').addEventListener('click', handleGenerateAlbertSortParagraphs);
    document.getElementById('btn-parse-ia-response-sortparagraphs').addEventListener('click', handleParseIA);
    document.getElementById('btn-add-paragraph').addEventListener('click', () => addParagraphCard());
    
    // Délégation d'événements
    const list = document.getElementById('sortparagraphs-list');
    
    if (typeof Sortable !== 'undefined') {
        new Sortable(list, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            onEnd: () => {
                logger.log('🔄 Ordre modifié via Drag&Drop');
                updateGenerateButtonCallback();
            }
        });
    }

    list.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) {
            e.target.closest('.card').remove();
            updateGenerateButtonCallback();
        }
    });

    list.addEventListener('input', (e) => {
        if (e.target.classList.contains('sp-text')) {
            updateGenerateButtonCallback();
        }
    });


// Initialisation du système de feedback par intervalles
    initFeedbackIntervalles('sp');


    // 🔴 BOUCLIER ANTI-BARRE DU BAS
    const enforceHideBottomBar = () => {
        const genSection = document.getElementById('generate-section');
        const cardsCount = document.querySelectorAll('#sortparagraphs-list .card').length;
        if (genSection && cardsCount < 2) {
            genSection.style.display = 'none';
        }
    };

    enforceHideBottomBar();
    setTimeout(enforceHideBottomBar, 50);

    const tabBtn = document.querySelector('.tab-btn[data-tab-target="sortparagraphs"]');
    if (tabBtn) {
        tabBtn.addEventListener('click', () => setTimeout(enforceHideBottomBar, 10));
    }
}

function renderRepartitionConfigSortParagraphs(selectedDocs) {
    const repContainer = container.querySelector('#sortparagraphs-questions-repartition');
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
                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Répartition des paragraphes à générer</span>
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

// 🟢 BOUTON 1 : Préparer le prompt
// 🟢 BOUTON 1 : Préparer le prompt
async function handlePreparePrompt() {
    const btn = document.getElementById('btn-prepare-prompt-sortparagraphs');
    
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

    const mode = document.getElementById('sortparagraphs-mode').value;
    
    const success = await preparerAssistantIA_SortParagraphs(mode, repartitionMap); 
    
    if (success) {
        // 🟢 NOUVEAU : On cache le conteneur parent de manière sécurisée
        if (btn.parentElement) {
            btn.parentElement.style.display = 'none';
        }

        const iaContainer = document.getElementById('ia-container-sortparagraphs');
        if (iaContainer) {
            iaContainer.style.display = 'block';
            const promptArea = document.getElementById('ia-prompt-sortparagraphs');
            if (promptArea) {
                promptArea.removeAttribute('readonly'); 
                promptArea.disabled = false;
                promptArea.style.backgroundColor = 'var(--field-bg)'; 
                promptArea.style.border = '2px solid var(--hapi-green)';
            }
        }
        
        const albertAction = document.getElementById('albert-action-sortparagraphs');
        if (albertAction) albertAction.style.display = 'block';

        setTimeout(() => {
            const iaContainerToScroll = document.getElementById('ia-container-sortparagraphs');
            if (iaContainerToScroll) iaContainerToScroll.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
    
    // 🟢 On réinitialise l'état
    btn.disabled = false;
    btn.innerHTML = originalText;
}

// 🟢 BOUTON 2 : Envoyer à Albert
async function handleGenerateAlbertSortParagraphs() {
    const btn = document.getElementById('btn-send-albert-sortparagraphs');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "L'IA découpe le texte...";

    await callAlbertAPI('ia-prompt-sortparagraphs', 'ia-response-sortparagraphs', 'btn-parse-ia-response-sortparagraphs', btn);

    btn.innerHTML = originalText;
    btn.disabled = false;
}

function handleParseIA() {
    const reponseBrute = document.getElementById('ia-response-sortparagraphs').value;
    if (!reponseBrute.trim()) return;

    const paragraphs = parserReponseIA_SortParagraphs(reponseBrute);
    if (!paragraphs) return;

    const list = document.getElementById('sortparagraphs-list');
    list.innerHTML = '';
    paragraphCounter = 0;
    
    paragraphs.forEach(text => {
        addParagraphCard(text);
    });
    
    updateGenerateButtonCallback();

    const previewSection = document.getElementById('sortparagraphs-preview-section');
    if (previewSection) {
        previewSection.style.display = 'block';
        previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const optionsSection = document.getElementById('sortparagraphs-options-section');
    if (optionsSection) optionsSection.style.display = 'block';
    
    const genSection = document.getElementById('generate-section');
    if (genSection) genSection.style.display = 'block';
}

function addParagraphCard(text = '') {
    paragraphCounter++;
    const container = document.getElementById('sortparagraphs-list');
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = "background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 10px; margin-bottom: 10px;";
    
    card.innerHTML = `
        <div style="display: flex; align-items: flex-start; width: 100%; gap: 10px;">
            <div style="flex: 0 0 30px; display: flex; justify-content: center; padding-top: 3px;">
                <span class="drag-handle" style="cursor: move; font-size: 1.5em; color: var(--text-muted);" title="Déplacer">☰</span>
            </div>
            <div style="flex: 1; min-width: 0;">
                <textarea class="sp-text" rows="2" 
                    style="width: 100%; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; padding: 10px; font-family: inherit; font-size: 1rem; resize: vertical; min-height: 60px;"
                    placeholder="Texte du paragraphe...">${text}</textarea>
            </div>
            <div style="flex: 0 0 50px; display: flex; justify-content: flex-end; align-items: flex-start;">
                <button class="delete-btn" title="Supprimer"
                    style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 1.2rem; transition: all 0.2s;">
                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>
                </button>
            </div>
        </div>
    `;
    
    container.appendChild(card);
    updateGenerateButtonCallback();
}

function showRegenerateButton() {
    const iaContainer = document.getElementById('ia-container-sortparagraphs');
    const btnPrepare = document.getElementById('btn-prepare-prompt-sortparagraphs');

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
    return getSortParagraphsState();
}

export function setUIState(config) {
    setSortParagraphsState(config, {
        clearPreview: () => {
            document.getElementById('sortparagraphs-list').innerHTML = '';
            paragraphCounter = 0;
        },
        addCard: addParagraphCard, 
        updateBtn: updateGenerateButtonCallback
    });
    if (config.overallFeedback) {
        setFeedbackIntervallesData('sp', config.overallFeedback);
    }
}

export function gatherData() {
    if (!container) return null;

    const langSelect = document.getElementById('global-language');
    const lang = langSelect ? langSelect.value : 'Français';
    
    const niveauSelect = document.getElementById('global-niveau');
    const niveau = niveauSelect ? niveauSelect.value : 'Cycle 2';

    const titleInput = container.querySelector('#sortparagraphs-title');
    const listContainer = container.querySelector('#sortparagraphs-list');

    if (!titleInput || !listContainer) return null;

    const shouldTranslateUI = container.querySelector('#translate-ui-sp')?.checked;
    const uiLanguage = shouldTranslateUI ? lang : 'Français';
    const localizationParams = getH5PLocalization(uiLanguage, 'SortParagraphs');

	const donnees = {
	        titre: titleInput.value,
	        niveau: niveau,
	        consignes: container.querySelector('#sortparagraphs-task').value,
	        overallFeedback: getFeedbackIntervallesData('sp'),
	        paragraphs: [],
	        l10n: localizationParams
	    };

    const cards = listContainer.querySelectorAll('.card');
    cards.forEach((card) => {
        const textArea = card.querySelector('.sp-text');
        if (textArea) {
            const text = textArea.value.trim();
            if (text) donnees.paragraphs.push(text);
        }
    });

    const statusDiv = container.querySelector('#sp-status-indicator');
    
    if (donnees.paragraphs.length < 2) {
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.textContent = `Il faut au moins 2 paragraphes remplis (Actuel: ${donnees.paragraphs.length})`;
            statusDiv.style.color = 'var(--danger-text)';
        }
        return null; 
    }

    if (statusDiv) {
        statusDiv.textContent = `${donnees.paragraphs.length} paragraphes valides. Prêt à générer.`;
        statusDiv.style.color = 'var(--hapi-grad-a)';
    }

    return donnees;
}