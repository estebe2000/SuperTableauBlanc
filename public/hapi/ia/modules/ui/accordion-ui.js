// Fichier: modules/ui/accordion-ui.js

import { logger } from '../utils/logger.js';
import { corpusManager } from '../corpus/corpus-manager.js'; 
import { creerAssistantIA_HTML } from '../utils/helpers.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_Accordion } from '../ia/prompt-builder.js';
import { parserReponseIA_Accordion } from '../ia/response-parser.js';
import { getFullLibraryString } from '../utils/h5p-library-manager.js';
import { getH5PLocalization } from '../utils/h5p-translations.js';
import { getAccordionState, setAccordionState } from '../utils/states/accordion-state.js';
import { SourceSelector } from './source-selector.js'; 

let container = null;
let corpus = '';
let updateGenerateButtonCallback = () => {};
let entryCounter = 0;
let localSourceSelector = null; 
let currentRepartition = {};    

export function init(targetContainer, corpusContent, updateBtnCallback) {
    container = targetContainer;
    corpus = corpusContent;
    updateGenerateButtonCallback = updateBtnCallback;
    entryCounter = 0;
    
    logger.log('🔧 Initialisation de "Accordion" UI (Sélecteur Dynamique)...');
    
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
        <div id="accordion-generator-wrapper">
            
            <div class="section" style="background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                
                <div id="accordion-source-selector"></div>
                <div id="accordion-questions-repartition"></div>

                <h2 style="margin:0 0 15px 0;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configuration de l'accordéon</h2>
                
                <div style="display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 15px;">
                    <div class="input-group">
                        <label for="accordion-title" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Titre de l'activité :</label>
                        <input type="text" id="accordion-title" value="Glossaire du cours" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                </div>
                
                <div id="prepare-action-accordion" style="margin-top: 35px; text-align: center;">
                    <button id="btn-prepare-prompt-accordion" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt
                    </button>
                </div>
            </div>
            
            <div id="ia-container-accordion" style="display: none; background: var(--page-bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border);"></div>
            
            <div id="albert-action-accordion" style="display: none; text-align: center; margin-top: 15px; margin-bottom: 30px;">
                <button id="btn-send-albert-accordion" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                    🇫🇷 Envoyer le prompt à l'IA
                </button>
            </div>
            
            <div class="section" id="accordion-preview-section" style="margin-top: 20px; display: none;">
                <div style="border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="margin:0; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Éditez les entrées du glossaire</h2>
                </div>
                
                <div id="accordion-items-list"></div>
                
                <button class="btn" id="btn-add-accordion-item" style="margin: 20px auto; display: block; background:#6c757d; color:white;">+ Ajouter une entrée manuelle</button>

                <div class="input-group" style="margin-top: 40px;">
                    <details style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px;">
                        <summary style="font-weight:bold; font-size:1.2em; color:var(--text); cursor:pointer; outline:none; list-style-position: inside;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options globales
                        </summary>
                        
                        <div style="margin-top: 20px;">
                            <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px;">
                                <div>
                                    <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options supplémentaires
                                    </div>
                                    
                                    <div style="display:flex; flex-direction:column; gap:20px;">
                                        <label style="display:flex; align-items:center; cursor:pointer;">
                                            <input type="checkbox" id="accordion-translate-ui" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                            <span style="font-weight:bold; font-size:1.05em; color: var(--hapi-accent-text);">Traduire les boutons H5P</span>
                                        </label>
                                        
                                        <div style="margin-top: 5px;">
                                            <label for="accordion-htag" style="display:block; font-weight:bold; font-size:1em; margin-bottom:8px; color:var(--text);">Niveau de titre (Accessibilité)</label>
                                            <select id="accordion-htag" style="width:100%; max-width:400px; padding:10px; border:1px solid #ccc; border-radius:6px; font-size:1.05em; background:var(--page-bg);">
                                                <option value="h2" selected>Titre de niveau 2 (h2)</option>
                                                <option value="h3">Titre de niveau 3 (h3)</option>
                                                <option value="h4">Titre de niveau 4 (h4)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;

    const selectorContainer = container.querySelector('#accordion-source-selector');
    if (selectorContainer) {
        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'accordion', (selectedDocs) => {
            renderRepartitionConfigAccordion(selectedDocs); // 👈 LE CORRECTIF EST ICI
            showRegenerateButton(); 
        });
    }

    const iaContainer = container.querySelector('#ia-container-accordion');
    if (iaContainer) {
        iaContainer.innerHTML = creerAssistantIA_HTML('ia-prompt-accordion', 'ia-response-accordion');
        
        const promptArea = iaContainer.querySelector('#ia-prompt-accordion');
        if (promptArea) {
            promptArea.rows = 12;
            promptArea.style.fontSize = '1.05em';
        }
        
        const responseArea = iaContainer.querySelector('#ia-response-accordion');
        if (responseArea) responseArea.parentElement.style.display = 'none';
        
        const iaParseBtn = iaContainer.querySelector('#btn-parse-ia-response-accordion');
        if (iaParseBtn) iaParseBtn.style.display = 'none';

        iaContainer.querySelectorAll('p, h4').forEach(el => {
            const text = el.innerText.toLowerCase();
            if (text.includes("collez la réponse") || text.includes("étape 2") || text.includes("étape 3")) {
                el.style.display = 'none';
            }
        });
    }

    const btnPrepare = container.querySelector('#btn-prepare-prompt-accordion');
    if (btnPrepare) btnPrepare.addEventListener('click', handlePreparePrompt);

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
	
    const repartitionContainer = container.querySelector('#accordion-questions-repartition');
    if (repartitionContainer) {
        repartitionContainer.addEventListener('input', (e) => {
            if (e.target.classList.contains('source-question-count')) {
                showRegenerateButton();
            }
        });
    }

    const btnAlbert = container.querySelector('#btn-send-albert-accordion');
    if (btnAlbert) btnAlbert.addEventListener('click', handleGenerateAlbertAccordion);

    const parseBtn = container.querySelector('#btn-parse-ia-response-accordion');
    if (parseBtn) parseBtn.addEventListener('click', handleParseIA);

    const addQuestionBtn = container.querySelector('#btn-add-accordion-item');
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', () => { 
            addAccordionItemCard(); 
            updateGenerateButtonCallback(); 
            const genSection = document.getElementById('generate-section');
            if (genSection) genSection.style.display = 'block';
            
            const previewSection = document.getElementById('accordion-preview-section');
            if (previewSection) previewSection.style.display = 'block';
        });
    }

    const questionsPreview = container.querySelector('#accordion-items-list');
    if (questionsPreview) {
        questionsPreview.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) { 
                e.target.closest('.card').remove(); 
                updateGenerateButtonCallback(); 
            }
        });
        questionsPreview.addEventListener('input', updateGenerateButtonCallback);
    }

    const enforceHideBottomBar = () => {
        const genSection = document.getElementById('generate-section');
        if (genSection && document.querySelectorAll('#accordion-items-list .card').length === 0) {
            genSection.style.display = 'none';
        }
    };

    enforceHideBottomBar();
    setTimeout(enforceHideBottomBar, 50);

    const tabBtn = document.querySelector('.tab-btn[data-tab-target="accordion"]');
    if (tabBtn) {
        tabBtn.addEventListener('click', () => setTimeout(enforceHideBottomBar, 10));
    }
}

function renderRepartitionConfigAccordion(selectedDocs) {
    const repContainer = container.querySelector('#accordion-questions-repartition');
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
                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Répartition des termes à générer</span>
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
    const btn = document.getElementById('btn-prepare-prompt-accordion');
    const originalText = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> 1. Générer et vérifier le prompt';
    
    btn.disabled = true;
    btn.innerHTML = 'Analyse du corpus...';
    
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

    const promptSuccess = await preparerAssistantIA_Accordion(repartitionMap); 
    if (promptSuccess) {
        const prepareAction = document.getElementById('prepare-action-accordion');
        if (prepareAction) prepareAction.style.display = 'none';

        const iaContainer = document.getElementById('ia-container-accordion');
        if (iaContainer) {
            iaContainer.style.display = 'block';
            
            const promptArea = document.getElementById('ia-prompt-accordion');
            if (promptArea) {
                promptArea.removeAttribute('readonly'); 
                promptArea.disabled = false;
                promptArea.style.backgroundColor = 'var(--field-bg)'; 
            }
            
            const albertAction = document.getElementById('albert-action-accordion');
            if (albertAction) albertAction.style.display = 'block';

            setTimeout(() => {
                iaContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
}

async function handleGenerateAlbertAccordion() {
    const btn = container.querySelector('#btn-send-albert-accordion');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "L'IA génère les entrées...";

    await callAlbertAPI('ia-prompt-accordion', 'ia-response-accordion', 'btn-parse-ia-response-accordion', btn);

    btn.innerHTML = originalText;
    btn.disabled = false;
}

function handleParseIA() {
    const textareaResponse = document.getElementById('ia-response-accordion');
    if (!textareaResponse) return;

    const reponseBrute = textareaResponse.value.trim();
    if (!reponseBrute) {
        alert("La zone de réponse de l'IA est vide !");
        return;
    }

    try {
        const entriesData = parserReponseIA_Accordion(reponseBrute);
        if (!entriesData || entriesData.length === 0) {
            alert("L'assistant n'a pas trouvé d'entrées valides. Vérifiez le format JSON.");
            return;
        }

        const previewContainer = document.getElementById('accordion-items-list');
        if (!previewContainer) return;

        previewContainer.innerHTML = '';
        entryCounter = 0;
        
        entriesData.forEach(data => addAccordionItemCard(data));
        
        if (entriesData.length > 0) {
            updateGenerateButtonCallback();
            
            const previewSection = document.getElementById('accordion-preview-section');
            if (previewSection) {
                previewSection.style.display = 'block';
                previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
            const genSection = document.getElementById('generate-section');
            if (genSection) genSection.style.display = 'block';
        }
    } catch (error) {
        console.error("Erreur lors du parsing :", error);
        alert("Une erreur est survenue lors de la création de l'accordéon. Ouvrez la console (F12).");
    }
}

function addAccordionItemCard(data = {}) {
    const container = document.getElementById('accordion-items-list');
    entryCounter++;
    
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `accordion-item-${entryCounter}`;
    
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="margin:0;">Entrée ${entryCounter}</h4>
            <button class="delete-btn" style="background:transparent; border:none; cursor:pointer;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
        </div>
        
        <div class="input-group">
            <label>Concept (Titre) :</label>
            <input type="text" class="accordion-concept" value="${data.concept || ''}">
        </div>
        
        <div class="input-group">
            <label>Définition (Contenu) :</label>
            <textarea class="accordion-definition" rows="3" placeholder="Entrez la définition ici...">${data.definition || ''}</textarea>
        </div>
    `;
    container.appendChild(card);
    updateGenerateButtonCallback();
}

function showRegenerateButton() {
    const iaContainer = document.getElementById('ia-container-accordion');
    const prepareAction = document.getElementById('prepare-action-accordion');
    const btnPrepare = document.getElementById('btn-prepare-prompt-accordion');

    if (iaContainer && iaContainer.style.display === 'block') {
        if (prepareAction) prepareAction.style.display = 'block';
        if (btnPrepare) {
            btnPrepare.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg> Régénérer le prompt';
            btnPrepare.style.background = 'linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark))';
            btnPrepare.style.boxShadow = '0 4px 15px rgba(var(--hapi-green-rgb), 0.3)';
        }
    }
}

export function getUIState() {
    return getAccordionState();
}

export function setUIState(config) {
    setAccordionState(config, {
        clearPreview: () => {
            document.getElementById('accordion-items-list').innerHTML = '';
            entryCounter = 0; 
        },
        addCard: addAccordionItemCard, 
        updateBtn: updateGenerateButtonCallback
    });
}

export function gatherData() {
    logger.log('📊 Collecte des données "Accordion" pour H5P...');
    
    const langSelect = document.getElementById('global-language');
    const lang = langSelect ? langSelect.value : 'Français'; 
    const translateCheckbox = document.getElementById('accordion-translate-ui');
    const uiLanguage = (translateCheckbox && translateCheckbox.checked) ? lang : 'Français';
    const localizationParams = getH5PLocalization(uiLanguage, 'Accordion');

    const hTagInput = document.getElementById('accordion-htag');
    const hTag = hTagInput ? hTagInput.value : 'h2';

    const panels = [];
    const cards = document.querySelectorAll('#accordion-items-list .card');

    if (cards.length === 0) {
        alert("Veuillez importer ou ajouter au moins une entrée de glossaire.");
        return null;
    }

    for (const card of cards) {
        const title = card.querySelector('.accordion-concept').value.trim();
        const definition = card.querySelector('.accordion-definition').value.trim();
        
        if (title && definition) {
            panels.push({
                "title": title,
                "content": {
                    "params": {
                        "text": `<p>${definition.replace(/\n/g, '<br>')}</p>`
                    },
                    "library": getFullLibraryString("H5P.AdvancedText"),
                    "subContentId": crypto.randomUUID(),
                    "metadata": { "contentType": "Text", "license": "U", "title": title }
                }
            });
        }
    }

    if (panels.length === 0) {
        alert("Aucune entrée valide (avec concept et définition) n'a été trouvée.");
        return null;
    }

    const donnees = {
        titre: document.getElementById('accordion-title').value,
        hTag: hTag,
        panels: panels,
        l10n: localizationParams
    };
    
    logger.log(`📊 Collecte H5P terminée : ${donnees.panels.length} panneaux prêts.`);
    return donnees;
}