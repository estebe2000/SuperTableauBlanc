// Fichier: modules/ui/crossword-ui.js

import { logger } from '../utils/logger.js';
import { corpusManager } from '../corpus/corpus-manager.js'; 
import { creerAssistantIA_HTML, creerFeedbackIntervallesHTML, initFeedbackIntervalles, getFeedbackIntervallesData, setFeedbackIntervallesData } from '../utils/helpers.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_Crossword } from '../ia/prompt-builder.js';
// (Nous conservons le nom de votre fonction parser existante pour ne rien casser)
import { parserReponseIA_MathJSON } from '../ia/response-parser.js'; 
import { getFullLibraryString } from '../utils/h5p-library-manager.js';
import { getH5PLocalization } from '../utils/h5p-translations.js';
import { getCrosswordState, setCrosswordState } from '../utils/states/crossword-state.js';
import { SourceSelector } from './source-selector.js';

let localSourceSelector = null;
let currentRepartition = {};

let container = null;
let corpus = '';
let updateGenerateButtonCallback = () => {};
let itemCounter = 0;

export function init(targetContainer, corpusContent, updateBtnCallback) {
    container = targetContainer;
    corpus = corpusContent;
    updateGenerateButtonCallback = updateBtnCallback;
    itemCounter = 0;
    
    logger.log('🔧 Initialisation de Mots Croisés UI (Sélecteur Dynamique)...');
    
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
        <div id="crossword-generator-wrapper">
            
            <div class="section" style="background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                
                <div id="crossword-source-selector"></div>
                <div id="crossword-questions-repartition"></div>

                <h2 style="margin:0 0 15px 0;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configuration des Mots Croisés</h2>
                
                <div style="display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 1px;">
                    <div class="input-group" style="margin:0 0;">
                        <label for="crossword-title" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Titre de l'activité :</label>
                        <input type="text" id="crossword-title" value="Mots Croisés" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div class="input-group" style="margin:0 0;">
                        <label for="crosswordTask" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Consigne pour l'élève :</label>
                        <textarea id="crosswordTask" rows="2" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">Remplissez la grille avec les mots correspondant aux indices.</textarea>
                    </div>
                    <div class="input-group" style="margin:0 0;">
                        <label for="crossword-subject" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Sujet (pour l'IA) :</label>
                        <input type="text" id="crossword-subject" placeholder="ex: Vocabulaire du texte" value="Vocabulaire du texte" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                </div>
                
                <div id="prepare-action-crossword" style="margin-top: 35px; text-align: center;">
                    <button id="btn-prepare-prompt-crossword" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt
                    </button>
                </div>
            </div>
            
            <div id="ia-container-crossword" class="section" style="display: none; background: var(--surface); border-radius: 25px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);"></div>
            
            <div id="albert-action-crossword" style="display: none; text-align: center; margin-top: 15px; margin-bottom: 30px;">
                <button id="btn-send-albert-crossword" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                    🇫🇷 Envoyer le prompt à l'IA'
                </button>
            </div>
            
            <div class="section" id="crossword-items-section" style="margin-top: 20px; display: none;">
                <div style="border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="margin:0; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Éditez les indices et réponses</h2>
                </div>
                
                <div id="crossword-items-list"></div>
                
                <button class="btn" id="btn-add-crossword-item" style="margin: 20px auto; display: block; background:#6c757d; color:white;">+ Ajouter un mot manuellement</button>

			<div class="input-group" style="margin-top: 40px;" id="crossword-options-section">
                    <details style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px;">
                        <summary style="font-weight:bold; font-size:1.2em; color:var(--text); cursor:pointer; outline:none; list-style-position: inside;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options globales
                        </summary>
                        
                        <div style="margin-top: 20px;" id="crossword-global-wrapper">
                            <style>
                                #crossword-global-wrapper .section { padding: 0; box-shadow: none; border: none; background: transparent; margin: 0; }
                                #crossword-global-wrapper h2 { display: none; }
                            </style>
                            
                           ${creerFeedbackIntervallesHTML('crossword', '')}

                            <hr style="border:0; border-top:1px solid var(--border); margin:25px 0 20px 0;">

                            <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px;">
                                <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options supplémentaires
                                </div>
                                <div style="display:flex; flex-direction:column; gap:20px;">
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="translate-ui-cw" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
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
	
// Initialisation du système de feedback par intervalles
    initFeedbackIntervalles('crossword');

	const selectorContainer = container.querySelector('#crossword-source-selector');
	    if (selectorContainer) {
	        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'crossword', (selectedDocs) => {
	            renderRepartitionConfigCrossword(selectedDocs);
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

	    // 2. Écouteur sur la répartition (Nombre de mots par source)
	    const repartitionContainer = container.querySelector('#crossword-questions-repartition');
	    if (repartitionContainer) {
	        repartitionContainer.addEventListener('input', (e) => {
	            if (e.target.classList.contains('source-question-count')) {
	                showRegenerateButton();
	            }
	        });
	    }

    const iaContainer = container.querySelector('#ia-container-crossword');
    if (iaContainer) {
        iaContainer.innerHTML = creerAssistantIA_HTML('ia-prompt-crossword', 'ia-response-crossword');
    }

    const btnPrepare = container.querySelector('#btn-prepare-prompt-crossword');
    if (btnPrepare) btnPrepare.addEventListener('click', handlePreparePrompt);

    const btnAlbert = container.querySelector('#btn-send-albert-crossword');
    if (btnAlbert) btnAlbert.addEventListener('click', handleGenerateAlbertCrossword);

    const parseBtn = container.querySelector('#btn-parse-ia-response-crossword');
    if (parseBtn) parseBtn.addEventListener('click', handleParseIA);

    const addQuestionBtn = container.querySelector('#btn-add-crossword-item');
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', () => { 
            addCrosswordItemCard(); 
            updateGenerateButtonCallback(); 
            const genSection = document.getElementById('generate-section');
            if (genSection) genSection.style.display = 'block';
            
            const previewSection = document.getElementById('crossword-items-section');
            if (previewSection) previewSection.style.display = 'block';
        });
    }

    const itemsList = document.getElementById('crossword-items-list');
    if (itemsList) {
        itemsList.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) {
                e.target.closest('.card').remove();
                updateGenerateButtonCallback();
            }
        });
        
        // Sécurité : Les mots croisés ne prennent que des lettres majuscules sans espaces
        itemsList.addEventListener('input', (e) => {
            if (e.target.classList.contains('cw-answer')) {
                e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            }
            updateGenerateButtonCallback();
        });
    }

    // 🔴 BOUCLIER ANTI-BARRE DU BAS
    const enforceHideBottomBar = () => {
        const genSection = document.getElementById('generate-section');
        if (genSection && document.querySelectorAll('#crossword-items-list .card').length === 0) {
            genSection.style.display = 'none';
        }
    };

    enforceHideBottomBar();
    setTimeout(enforceHideBottomBar, 50);

    const tabBtn = document.querySelector('.tab-btn[data-tab-target="crossword"]');
    if (tabBtn) {
        tabBtn.addEventListener('click', () => setTimeout(enforceHideBottomBar, 10));
    }
}

function renderRepartitionConfigCrossword(selectedDocs) {
    const repContainer = container.querySelector('#crossword-questions-repartition');
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
                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Répartition des mots à générer</span>
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
    const btn = document.getElementById('btn-prepare-prompt-crossword');
    
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

    const success = await preparerAssistantIA_Crossword(repartitionMap);
    
    if (success) {
        // 🟢 NOUVEAU : On cache le conteneur parent du bouton de manière sécurisée
        if (btn.parentElement) {
            btn.parentElement.style.display = 'none';
        }

        const iaContainer = document.getElementById('ia-container-crossword');
        if (iaContainer) {
            iaContainer.style.display = 'block';
            const promptArea = document.getElementById('ia-prompt-crossword');
            if (promptArea) {
                promptArea.removeAttribute('readonly'); 
                promptArea.disabled = false;
                promptArea.style.backgroundColor = 'var(--field-bg)'; 
                promptArea.style.border = '2px solid var(--hapi-green)';
            }
        }
        
        const albertAction = document.getElementById('albert-action-crossword');
        if (albertAction) albertAction.style.display = 'block';

        setTimeout(() => {
            const iaContainerToScroll = document.getElementById('ia-container-crossword');
            if (iaContainerToScroll) iaContainerToScroll.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
    
    // 🟢 On réinitialise l'état et le texte pour la prochaine fois
    btn.disabled = false; 
    btn.innerHTML = originalText;
}

// 🟢 BOUTON 2 : Envoyer à Albert
async function handleGenerateAlbertCrossword() {
    const btn = container.querySelector('#btn-send-albert-crossword');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "L'IA génère les mots...";

    await callAlbertAPI('ia-prompt-crossword', 'ia-response-crossword', 'btn-parse-ia-response-crossword', btn);

    btn.innerHTML = originalText;
    btn.disabled = false;
}

function handleParseIA() {
    const textareaResponse = document.getElementById('ia-response-crossword');
    if (!textareaResponse) return;

    const reponseBrute = textareaResponse.value.trim();
    if (!reponseBrute) {
        alert("La zone de réponse de l'IA est vide !");
        return;
    }

    try {
        const itemsData = parserReponseIA_MathJSON(reponseBrute); 
        
        if (!itemsData || itemsData.length === 0) {
            alert("L'assistant n'a pas trouvé de mots valides. Vérifiez le format JSON.");
            return;
        }

        const previewContainer = document.getElementById('crossword-items-list');
        if (!previewContainer) return;

        previewContainer.innerHTML = '';
        itemCounter = 0;
        
        itemsData.forEach(data => addCrosswordItemCard(data));
        
        if (itemsData.length > 0) {
            updateGenerateButtonCallback();
            
            const previewSection = document.getElementById('crossword-items-section');
            if (previewSection) {
                previewSection.style.display = 'block';
                previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
            const genSection = document.getElementById('generate-section');
            if (genSection) genSection.style.display = 'block';
        }
    } catch (error) {
        console.error("Erreur lors du parsing :", error);
        alert("Une erreur est survenue lors de la création de la grille. Ouvrez la console (F12).");
    }
}

function addCrosswordItemCard(data = {}) {
    itemCounter++;
    const container = document.getElementById('crossword-items-list');
    
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `cw-item-${itemCounter}`;
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="margin:0;">Mot ${itemCounter}</h4>
            <button class="delete-btn" style="background:transparent; border:none; cursor:pointer;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
        </div>
        <div class="input-group">
            <label>Indice (Clue) :</label>
            <input type="text" class="cw-clue" value="${data.clue || ''}">
        </div>
        <div class="input-group">
            <label>Réponse (Answer) : <small>(Auto-formaté: SANS ESPACE, MAJUSCULES)</small></label>
            <input type="text" class="cw-answer" value="${data.answer || ''}">
        </div>
        <div class="input-group">
            <label>Indice supplémentaire (optionnel) :</label>
            <input type="text" class="cw-extra-clue" value="${data.extraClue || ''}">
        </div>
    `;
    container.appendChild(card);
    updateGenerateButtonCallback(); 
}

function showRegenerateButton() {
    const iaContainer = document.getElementById('ia-container-crossword');
    const btnPrepare = document.getElementById('btn-prepare-prompt-crossword');

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

export function getUIState() {
    return getCrosswordState();
}

export function setUIState(config) {
    setCrosswordState(config, {
        clearPreview: () => {
            document.getElementById('crossword-items-list').innerHTML = '';
            itemCounter = 0; 
        },
        addCard: addCrosswordItemCard, 
        updateBtn: updateGenerateButtonCallback
    });
    if (config.overallFeedback) {
        setFeedbackIntervallesData('crossword', config.overallFeedback);
    }
}

export function gatherData() {
    logger.log('📊 Collecte des données Mots Croisés...');
    
    // 🟢 Utilisation de la langue globale
    const langSelect = document.getElementById('global-language');
    const lang = langSelect ? langSelect.value : 'Français'; 
    const shouldTranslateUI = document.getElementById('translate-ui-cw')?.checked;
    const uiLanguage = shouldTranslateUI ? lang : 'Français';
    const localizationParams = getH5PLocalization(uiLanguage, 'Crossword');

    const donnees = {
        titre: document.getElementById('crossword-title').value,
        consignes: document.getElementById('crosswordTask').value,
        overallFeedback: getFeedbackIntervallesData('crossword'),
        words: [],
        l10n: localizationParams
    };

    const cards = document.querySelectorAll('#crossword-items-list .card');
    cards.forEach(card => {
        const clue = card.querySelector('.cw-clue').value.trim();
        const answer = card.querySelector('.cw-answer').value.trim();
        const extraClueText = card.querySelector('.cw-extra-clue').value.trim();

        if (clue && answer) {
            const wordData = {
                fixWord: false,
                orientation: "across", 
                clue: clue,
                answer: answer
            };
            if (extraClueText) {
                wordData.extraClue = {
                    "params": { "text": `<p>${extraClueText}</p>` },
                    "library": getFullLibraryString("H5P.AdvancedText"),
                    "metadata": { "contentType": "Text", "license": "U", "title": "Indice supplémentaire" },
                    "subContentId": crypto.randomUUID()
                };
            }
            donnees.words.push(wordData);
        }
    });

    if (donnees.words.length === 0) {
        alert("Veuillez ajouter au moins un mot valide.");
        return null;
    }
    return donnees;
}