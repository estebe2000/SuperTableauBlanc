// Fichier: modules/ui/summary-ui.js

import { logger } from '../utils/logger.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { creerAssistantIA_HTML, creerFeedbackIntervallesHTML, initFeedbackIntervalles, getFeedbackIntervallesData, setFeedbackIntervallesData } from '../utils/helpers.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_Summary } from '../ia/prompt-builder.js';
import { parserReponseIA_Summary } from '../ia/response-parser.js';
import { getH5PLocalization } from '../utils/h5p-translations.js';
import { getSummaryState, setSummaryState } from '../utils/states/summary-state.js';
import { SourceSelector } from './source-selector.js';

let container = null;
let corpus = '';
let updateGenerateButtonCallback = () => {};
let groupCounter = 0;
let localSourceSelector = null;
let currentRepartition = {};

export function init(targetContainer, corpusContent, updateBtnCallback) {
    container = targetContainer;
    corpus = corpusContent;
    updateGenerateButtonCallback = updateBtnCallback;
    groupCounter = 0;
    
    logger.log('🔧 Initialisation de "Summary" UI...');
    
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
        <div id="summary-generator-wrapper">
            
            <div class="section" style="background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                
                <div id="summary-source-selector"></div>
                <div id="summary-questions-repartition"></div>

                 <h2 style="margin:0 0 15px 0;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configuration du résumé</h2>
                
                <div style="display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 25px;">
                    <div class="input-group" style="margin: 0 0;">
                        <label for="summary-title" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Titre de l'activité :</label>
                        <input type="text" id="summary-title" value="Résumé du cours" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div class="input-group" style="margin: 0 0;">
                        <label for="summary-task" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Consigne pour l'élève :</label>
                        <input type="text" id="summary-task" value="Choisissez la proposition correcte pour construire le résumé." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                </div>

                <div id="prepare-action-summary" style="margin-top: 35px; text-align: center;">
                    <button id="btn-prepare-prompt-summary" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt
                    </button>
                </div>
            </div>
            
            <div id="ia-container-summary" class="section" style="display: none; background: var(--surface); border-radius: 8px; padding: 12px 25px 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                ${creerAssistantIA_HTML('ia-prompt-summary', 'ia-response-summary')}
            </div>
            
            <div id="albert-action-summary" style="display: none; text-align: center; margin-top: 15px; margin-bottom: 30px;">
                <button id="btn-send-albert-summary" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                    🇫🇷 Envoyer le prompt à l'IA
                </button>
            </div>
            
            <div class="section" id="summary-items-section" style="display:none; margin-top: 20px; background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <div style="border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="margin:0; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Éditez les propositions du résumé</h2>
                    <p id="summary-status-indicator" style="font-weight:bold; color:#e11d48; font-size:0.9em;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> Il faut au moins 1 groupe de propositions valide pour générer.</p>
                </div>
                
                <div id="summary-items-list"></div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn" id="btn-add-summary-group" style="background:#6c757d; color:white; border:none; padding:10px 20px; border-radius:25px; cursor:pointer;">+ Ajouter un groupe de propositions</button>
                </div>

				<div class="input-group" style="display: none; margin-top: 40px;" id="summary-options-section">
                    <details style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px;">
                        <summary style="font-weight:bold; font-size:1.2em; color:var(--text); cursor:pointer; outline:none; list-style-position: inside;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options globales
                        </summary>
                        
                        <div style="margin-top: 20px;" id="summary-global-wrapper">
                            <style>
                                #summary-global-wrapper .section { padding: 0; box-shadow: none; border: none; background: transparent; margin: 0; }
                                #summary-global-wrapper h2 { display: none; }
                            </style>
                            
                            ${creerFeedbackIntervallesHTML('summary', '')}

                            <hr style="border:0; border-top:1px solid var(--border); margin:25px 0 20px 0;">

                            <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px;">
                                <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options supplémentaires
                                </div>
                                <div style="display:flex; flex-direction:column; gap:20px;">
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="translate-ui-summary" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
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

	const selectorContainer = container.querySelector('#summary-source-selector');
	    if (selectorContainer) {
	        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'summary', (selectedDocs) => {
	            // Remplacez renderRepartitionConfigSummary par le nom exact de votre fonction si différent
	            if (typeof renderRepartitionConfigSummary === 'function') renderRepartitionConfigSummary(selectedDocs);
	            else if (typeof renderRepartitionConfig === 'function') renderRepartitionConfig(selectedDocs);
            
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

	    // 2. Écouteur sur la répartition (Nombre de groupes par source)
	    const repartitionContainer = container.querySelector('#summary-questions-repartition');
	    if (repartitionContainer) {
	        repartitionContainer.addEventListener('input', (e) => {
	            if (e.target.classList.contains('source-question-count')) {
	                showRegenerateButton();
	            }
	        });
	    }	
	
    // Événements Boutons
    document.getElementById('btn-prepare-prompt-summary').addEventListener('click', handlePreparePrompt);
    document.getElementById('btn-send-albert-summary').addEventListener('click', handleGenerateAlbertSummary);
    document.getElementById('btn-parse-ia-response-summary').addEventListener('click', handleParseIA);
    document.getElementById('btn-add-summary-group').addEventListener('click', () => {
        addSummaryGroupCard();
        updateGenerateButtonCallback();
        document.getElementById('summary-options-section').style.display = 'block';
    });

    const list = document.getElementById('summary-items-list');
    list.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('.delete-btn')) {
            target.closest('.card').remove();
            updateGenerateButtonCallback();
        }
        if (target.closest('.btn-add-incorrect')) {
            addIncorrectOption(target.closest('.card').querySelector('.summary-incorrect-list'));
            updateGenerateButtonCallback();
        }
        if (target.closest('.btn-remove-option')) {
            target.closest('.answer-option').remove();
            updateGenerateButtonCallback();
        }
    });
    list.addEventListener('input', updateGenerateButtonCallback);

// Initialisation du système de feedback par intervalles
    initFeedbackIntervalles('summary');

    // 🔴 BOUCLIER ANTI-BARRE DU BAS
    const enforceHideBottomBar = () => {
        const genSection = document.getElementById('generate-section');
        const cardsCount = document.querySelectorAll('#summary-items-list .card').length;
        if (genSection && cardsCount < 1) {
            genSection.style.display = 'none';
        }
    };

    enforceHideBottomBar();
    setTimeout(enforceHideBottomBar, 50);

    const tabBtn = document.querySelector('.tab-btn[data-tab-target="summary"]');
    if (tabBtn) {
        tabBtn.addEventListener('click', () => setTimeout(enforceHideBottomBar, 10));
    }
}

function renderRepartitionConfigSummary(selectedDocs) {
    const repContainer = container.querySelector('#summary-questions-repartition');
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
        if (name.match(/\\.(doc|docx|odt)$/)) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
        if (name.match(/\\.(ppt|pptx|odp)$/)) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
        if (name.endsWith('.txt')) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>';
        if (name.match(/\\.(jpe?g|png)$/)) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
        return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
    };

    let html = `
        <div style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px; margin-top: 10px; max-height: 250px; overflow-y: auto;">
            <label style="display:flex; justify-content:space-between; align-items:center; font-size: 0.95em; font-weight:bold; margin-bottom:12px; color:var(--text);">
                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Répartition des étapes du résumé à générer</span>
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
async function handlePreparePrompt() {
    const btn = document.getElementById('btn-prepare-prompt-summary');
    
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

    const success = await preparerAssistantIA_Summary(repartitionMap); 
    
    if (success) {
        // 🟢 NOUVEAU : On cache le conteneur parent de manière sécurisée
        if (btn.parentElement) {
            btn.parentElement.style.display = 'none';
        }

        const iaContainer = document.getElementById('ia-container-summary');
        if (iaContainer) {
            iaContainer.style.display = 'block';
            const promptArea = document.getElementById('ia-prompt-summary');
            if (promptArea) {
                promptArea.removeAttribute('readonly'); 
                promptArea.disabled = false;
                promptArea.style.backgroundColor = 'var(--field-bg)'; 
                promptArea.style.border = '2px solid var(--hapi-green)';
            }
        }
        
        const albertAction = document.getElementById('albert-action-summary');
        if (albertAction) albertAction.style.display = 'block';

        setTimeout(() => {
            const iaContainerToScroll = document.getElementById('ia-container-summary');
            if (iaContainerToScroll) iaContainerToScroll.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
    
    // 🟢 On réinitialise l'état pour la prochaine fois
    btn.disabled = false;
    btn.innerHTML = originalText;
}

// 🟢 BOUTON 2 : Envoyer à Albert
async function handleGenerateAlbertSummary() {
    const btn = document.getElementById('btn-send-albert-summary');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "L'IA rédige le résumé...";

    await callAlbertAPI('ia-prompt-summary', 'ia-response-summary', 'btn-parse-ia-response-summary', btn);

    btn.innerHTML = originalText;
    btn.disabled = false;
}

function handleParseIA() {
    const reponseBrute = document.getElementById('ia-response-summary').value;
    const groupsData = parserReponseIA_Summary(reponseBrute);
    
    if (!groupsData) return;

    const previewContainer = document.getElementById('summary-items-list');
    previewContainer.innerHTML = '';
    groupCounter = 0;
    
    groupsData.forEach(data => addSummaryGroupCard(data));
    
    if (groupsData.length > 0) updateGenerateButtonCallback();

    const previewSection = document.getElementById('summary-items-section');
    if (previewSection) {
        previewSection.style.display = 'block';
        previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const optionsSection = document.getElementById('summary-options-section');
    if (optionsSection) optionsSection.style.display = 'block';
    
    const genSection = document.getElementById('generate-section');
    if (genSection) genSection.style.display = 'block';
}

function addIncorrectOption(container, text = '') {
    const option = document.createElement('div');
    option.className = 'answer-option';
    option.style.display = 'flex';
    option.style.alignItems = 'center';
    option.style.marginBottom = '5px';
    option.innerHTML = `
        <span style="color: #dc3545; font-size: 1.2em; margin-right: 5px;">✕</span>
        <input type="text" class="summary-incorrect-text" style="flex-grow: 1; padding:8px; border:1px solid #ccc; border-radius:4px;" value="${text}">
        <button type="button" class="btn-remove-option" title="Supprimer cette proposition" style="background:transparent; border:none; cursor:pointer; color:var(--text-muted); margin-left:5px; display:inline-flex; align-items:center;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
    `;
    container.appendChild(option);
}

function addSummaryGroupCard(data = {}) {
    const container = document.getElementById('summary-items-list');
    groupCounter++;
    
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `summary-group-${groupCounter}`;
    card.style.cssText = "background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 15px; margin-bottom: 15px;";
    
    const correctText = data.correct ? data.correct[0] : '';
    let incorrectOptionsHTML = '';
    if (data.incorrect && data.incorrect.length > 0) {
        incorrectOptionsHTML = data.incorrect.map(text => `
            <div class="answer-option" style="display:flex; align-items:center; margin-bottom:5px;">
                <span style="color: #dc3545; font-size: 1.2em; margin-right: 5px;">✕</span>
                <input type="text" class="summary-incorrect-text" style="flex-grow: 1; padding:8px; border:1px solid #ccc; border-radius:4px;" value="${text}">
                <button type="button" class="btn-remove-option" title="Supprimer cette proposition" style="background:transparent; border:none; cursor:pointer; color:var(--text-muted); margin-left:5px; display:inline-flex; align-items:center;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
            </div>
        `).join('');
    }

    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;">
            <h4 style="margin:0; color:var(--text);">Étape ${groupCounter}</h4>
            <button class="delete-btn" style="background:transparent; border:none; cursor:pointer; font-size:1.2em;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
        </div>
        
        <div class="input-group" style="margin-bottom: 15px;">
            <label style="font-weight:bold; display:block; margin-bottom:5px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Proposition CORRECTE :</label>
            <textarea class="summary-correct-text" rows="2" style="width:100%; padding:10px; border:1px solid #c3e6cb; border-radius:4px; background-color: rgba(34, 197, 94, 0.16); resize:vertical;">${correctText}</textarea>
        </div>
        
        <div class="input-group" style="margin-bottom: 15px;">
            <label style="font-weight:bold; display:block; margin-bottom:5px;">✕ Propositions INCORRECTES :</label>
            <div class="summary-incorrect-list" style="display: flex; flex-direction: column; gap: 5px;">
                ${incorrectOptionsHTML}
            </div>
            <button type="button" class="btn btn-add-incorrect" style="background: var(--page-bg); color: var(--text); border:none; padding:6px 12px; border-radius:25px; margin-top: 10px; cursor:pointer; font-size:0.9em;">+ Ajouter une proposition incorrecte</button>
        </div>
        
        <div class="input-group">
            <label style="font-weight:bold; display:block; margin-bottom:5px;">Indice (optionnel) :</label>
            <input type="text" class="summary-tip" value="${data.tip || ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
        </div>
    `;
    container.appendChild(card);
    updateGenerateButtonCallback();
}

function showRegenerateButton() {
    const iaContainer = document.getElementById('ia-container-summary');
    const btnPrepare = document.getElementById('btn-prepare-prompt-summary');

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
    return getSummaryState();
}

export function setUIState(config) {
    setSummaryState(config, {
        clearPreview: () => {
            document.getElementById('summary-items-list').innerHTML = '';
            groupCounter = 0; 
        },
        addCard: addSummaryGroupCard, 
        updateBtn: updateGenerateButtonCallback
    });
    if (config.overallFeedback) {
        setFeedbackIntervallesData('summary', config.overallFeedback);
    }
}

export function gatherData() {
    if (!container) return null;

    const langSelect = document.getElementById('global-language');
    const lang = langSelect ? langSelect.value : 'Français';
    
    const niveauSelect = document.getElementById('global-niveau');
    const niveau = niveauSelect ? niveauSelect.value : 'Cycle 2';

    const titleInput = container.querySelector('#summary-title');
    const listContainer = container.querySelector('#summary-items-list');

    if (!titleInput || !listContainer) return null;

    const shouldTranslateUI = container.querySelector('#translate-ui-summary')?.checked;
    const uiLanguage = shouldTranslateUI ? lang : 'Français';
    const localizationParams = getH5PLocalization(uiLanguage, 'Summary');

	const donnees = {
	        titre: titleInput.value,
	        niveau: niveau, 
	        consignes: container.querySelector('#summary-task').value,
	        overallFeedback: getFeedbackIntervallesData('summary'),
	        summaries: [],
	        l10n: localizationParams
	    };
		
    const cards = listContainer.querySelectorAll('.card');
    
    const statusDiv = container.querySelector('#summary-status-indicator');

    if (cards.length === 0) {
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.textContent = `Il faut au moins 1 groupe de propositions rempli.`;
            statusDiv.style.color = 'var(--danger-text)';
        }
        return null;
    }

    let isValid = true;

    for (const card of cards) {
        const correctText = card.querySelector('.summary-correct-text').value.trim();
        const tip = card.querySelector('.summary-tip').value.trim();
        const summaryGroup = [];
        
        if (correctText) {
            summaryGroup.push(`<p>${correctText}</p>`);
        } else {
            isValid = false;
        }

        const incorrectInputs = card.querySelectorAll('.summary-incorrect-text');
        
        incorrectInputs.forEach(input => {
            const text = input.value.trim();
            if (text) {
                summaryGroup.push(`<p>${text}</p>`);
            }
        });

        // H5P a besoin d'au moins la phrase correcte (les fausses sont optionnelles mais recommandées)
        if (summaryGroup.length > 0 && correctText) {
            donnees.summaries.push({
                summary: summaryGroup,
                tip: tip,
                subContentId: crypto.randomUUID()
            });
        }
    }
    
    if (!isValid || donnees.summaries.length === 0) {
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.textContent = `Veuillez remplir la proposition CORRECTE pour chaque groupe.`;
            statusDiv.style.color = 'var(--danger-text)';
        }
        return null; 
    }

    if (statusDiv) {
        statusDiv.textContent = `${donnees.summaries.length} étapes valides. Prêt à générer.`;
        statusDiv.style.color = 'var(--hapi-grad-a)';
    }

    return donnees;
}