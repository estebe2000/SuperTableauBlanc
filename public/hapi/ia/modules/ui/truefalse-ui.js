// Fichier: modules/ui/truefalse-ui.js

import { logger } from '../utils/logger.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { creerAssistantIA_HTML, creerFeedbackGlobalHTML, handleHelpersClick } from '../utils/helpers.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_TrueFalse } from '../ia/prompt-builder.js';
import { parserReponseIA_TrueFalse } from '../ia/response-parser.js';
import { L10N_TRUEFALSE_PARAMS } from '../utils/h5p-constants.js';
import { getFullLibraryString } from '../utils/h5p-library-manager.js';
import { getLanguageOptionsHTML } from '../utils/languages.js';
import { getH5PLocalization } from '../utils/h5p-translations.js';
import { getTrueFalseState, setTrueFalseState } from '../utils/states/truefalse-state.js';
import { SourceSelector } from './source-selector.js';

let container = null;
let corpus = '';
let updateGenerateButtonCallback = () => {};
let questionCounter = 0;
let localSourceSelector = null;
let currentRepartition = {}; 

export function init(targetContainer, corpusContent, updateBtnCallback) {
    container = targetContainer;
    corpus = corpusContent;
    updateGenerateButtonCallback = updateBtnCallback;
    questionCounter = 0;
    
    logger.log('🔧 Initialisation de Vrai/Faux UI (Sélecteur Dynamique)...');
    
    const rawSources = corpusManager.getCorpusSources();
    const documentsList = [
        { id: 'all', title: 'Tout le corpus', content: corpusContent, type: 'all', priority: 2 },
        ...rawSources.map(s => ({
            id: s.id,
            title: s.name,
            content: s.data || s.content || corpusContent,
            type: s.type,
            priority: s.priority !== undefined ? s.priority : 2
        }))
    ];
    
    const html = `
        <div id="truefalse-generator-wrapper">
            
            <div class="section" style="background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                
                <div id="tf-source-selector"></div>
                <div id="tf-questions-repartition"></div>

                <h2 style="margin:0 0 15px 0;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configuration du Vrai/Faux</h2>
                
                <div style="display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 15px;">
                    <div class="input-group">
                        <label for="truefalse-title" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Titre de l'activité :</label>
                        <input type="text" id="truefalse-title" value="Vrai ou Faux ?" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                </div>
                
                <div id="prepare-action-tf" style="margin-top: 35px; text-align: center;">
                    <button id="btn-prepare-prompt-tf" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt
                    </button>
                </div>
            </div>
            
            <div id="ia-container-tf" style="display: none; background: var(--page-bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border);"></div>
            
            <div id="albert-action-tf" style="display: none; text-align: center; margin-top: 15px; margin-bottom: 30px;">
                <button id="btn-send-albert-tf" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                    🇫🇷 Envoyer le prompt à l'IA
                </button>
            </div>
            
            <div class="section" id="truefalse-preview-section" style="margin-top: 20px; display: none;">
                <div style="border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="margin:0; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Éditez vos affirmations</h2>
                </div>
                
                <div id="truefalse-questions-preview"></div>
                
                <button class="btn" id="btn-add-affirmation" style="margin: 20px auto; display: block; background:#6c757d; color:white;">+ Ajouter une affirmation manuelle</button>

<div class="input-group" style="margin-top: 40px;" id="tf-options-section">
                    <details style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px;">
                        <summary style="font-weight:bold; font-size:1.2em; color:var(--text); cursor:pointer; outline:none; list-style-position: inside;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options globales
                        </summary>
                        
                        <div style="margin-top: 20px;" id="tf-global-wrapper">
                            <style>
                                #tf-global-wrapper .section { padding: 0; box-shadow: none; border: none; background: transparent; margin: 0; }
                                #tf-global-wrapper h2 { display: none; }
                            </style>
                            
                            ${creerFeedbackGlobalHTML('tf', '')}

                            <hr style="border:0; border-top:1px solid var(--border); margin:25px 0 20px 0;">

                            <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px;">
                                <div>
                                    <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options supplémentaires
                                    </div>
                                    
                                    <div style="display:flex; flex-direction:column; gap:15px; margin-bottom: 25px; margin-top: 15px;">
                                        <label style="display:flex; align-items:center; cursor:pointer;">
                                            <input type="checkbox" id="tf-disable-back" style="margin-right:12px; width: 16px; height: 16px;">
                                            <span style="font-size:1.05em; color:var(--text);">Désactiver le retour en arrière</span>
                                        </label>
                                        <label style="display:flex; align-items:center; cursor:pointer;">
                                            <input type="checkbox" id="tf-random-questions" style="margin-right:12px; width: 16px; height: 16px;">
                                            <span style="font-size:1.05em; color:var(--text);">Afficher aléatoirement les questions</span>
                                        </label>
                                    </div>
                                    
                                    <hr style="border:0; border-top:1px solid var(--border); margin:20px 0;">
                                    
                                    <div style="display:flex; flex-direction:column; gap:20px;">
                                        <label style="display:flex; align-items:center; cursor:pointer;">
                                            <input type="checkbox" id="tf-translate-ui" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                            <span style="font-weight:bold; font-size:1.05em; color: var(--hapi-accent-text);">Traduire les boutons H5P</span>
                                        </label>

                                        <label style="display:flex; align-items:center; cursor:pointer;">
                                            <input type="checkbox" id="tf-show-check" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                            <span style="font-weight:bold; font-size:1.05em; color:var(--text);">Montrer les boutons "Vérifier"</span>
                                        </label>
                                        
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 5px;">
                                            <div>
                                                <label for="tf-override-solution" style="display:block; font-weight:bold; font-size:1em; margin-bottom:8px; color:var(--text);">Cacher le bouton "Voir la correction"</label>
                                                <select id="tf-override-solution" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; font-size:1.05em; background:var(--page-bg);">
                                                    <option value="default" selected>-</option><option value="on">Afficher</option><option value="off">Cacher</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label for="tf-override-retry" style="display:block; font-weight:bold; font-size:1em; margin-bottom:8px; color:var(--text);">Cacher le bouton "Recommencer"</label>
                                                <select id="tf-override-retry" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; font-size:1.05em; background:var(--page-bg);">
                                                    <option value="default" selected>-</option><option value="on">Afficher</option><option value="off">Cacher</option>
                                                </select>
                                            </div>
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

	const selectorContainer = container.querySelector('#tf-source-selector');
		    if (selectorContainer) {
		        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'truefalse', (selectedDocs) => {
		            renderRepartitionConfigTF(selectedDocs); // 🟢 CORRECTION : Ajout de "TF" à la fin
		            showRegenerateButton(); // <-- Déclencheur : modification du corpus ou des priorités
		        });
		    }
			
			
    const iaContainer = container.querySelector('#ia-container-tf');
    if (iaContainer) {
        iaContainer.innerHTML = creerAssistantIA_HTML('ia-prompt-tf', 'ia-response-tf');
        
        const promptArea = iaContainer.querySelector('#ia-prompt-tf');
        if (promptArea) {
            promptArea.rows = 12;
            promptArea.style.fontSize = '1.05em';
        }
        
        const responseArea = iaContainer.querySelector('#ia-response-tf');
        if (responseArea) responseArea.parentElement.style.display = 'none';
        
        const iaParseBtn = iaContainer.querySelector('#btn-parse-ia-response-tf');
        if (iaParseBtn) iaParseBtn.style.display = 'none';

        iaContainer.querySelectorAll('p, h4').forEach(el => {
            const text = el.innerText.toLowerCase();
            if (text.includes("collez la réponse") || text.includes("étape 2") || text.includes("étape 3")) {
                el.style.display = 'none';
            }
        });
    }

    const btnPrepare = container.querySelector('#btn-prepare-prompt-tf');
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

    // 2. Écouteur sur la répartition (Nombre de questions à générer par source)
    const repartitionContainer = container.querySelector('#tf-questions-repartition');
    if (repartitionContainer) {
        repartitionContainer.addEventListener('input', (e) => {
            if (e.target.classList.contains('source-question-count')) {
                showRegenerateButton();
            }
        });
    }

    const btnAlbert = container.querySelector('#btn-send-albert-tf');
    if (btnAlbert) btnAlbert.addEventListener('click', handleGenerateAlbertTF);

    const parseBtn = container.querySelector('#btn-parse-ia-response-tf');
    if (parseBtn) parseBtn.addEventListener('click', handleParseIA);

    const addQuestionBtn = container.querySelector('#btn-add-affirmation');
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', () => { 
            addAffirmationCard(); 
            updateGenerateButtonCallback(); 
            const genSection = document.getElementById('generate-section');
            if (genSection) genSection.style.display = 'block';
            
            const previewSection = document.getElementById('truefalse-preview-section');
            if (previewSection) previewSection.style.display = 'block';
        });
    }

    const questionsPreview = container.querySelector('#truefalse-questions-preview');
    if (questionsPreview) {
        questionsPreview.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) { 
                e.target.closest('.card').remove(); 
                updateGenerateButtonCallback(); 
            }
        });
    }

// ✅ Activation des pastilles du Helper global
    const globalOptionsSection = container.querySelector('#final-options-section-tf');
    if (globalOptionsSection) {
        globalOptionsSection.addEventListener('click', handleHelpersClick);
    }

    // 🔴 SÉCURITÉ RENFORCÉE : Bouclier anti-barre du bas !
    // Masque la section finale générée par l'architecture globale
    const enforceHideBottomBar = () => {
        const genSection = document.getElementById('generate-section');
        if (genSection && document.querySelectorAll('#truefalse-questions-preview .card').length === 0) {
            genSection.style.display = 'none';
        }
    };

    enforceHideBottomBar();
    setTimeout(enforceHideBottomBar, 50);

    // Contre-attaque : si l'utilisateur clique sur l'onglet TrueFalse, on recache la barre forcée par activity-selector
    const tabBtn = document.querySelector('.tab-btn[data-tab-target="truefalse"]');
    if (tabBtn) {
        tabBtn.addEventListener('click', () => setTimeout(enforceHideBottomBar, 10));
    }
}

function renderRepartitionConfigTF(selectedDocs) {
    const repContainer = container.querySelector('#tf-questions-repartition');
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
                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Répartition des affirmations à générer</span>
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
    const btn = container.querySelector('#btn-prepare-prompt-tf');
    
    // On repasse sur le texte par défaut
    const originalText = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt';
    
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

    const promptSuccess = await preparerAssistantIA_TrueFalse(repartitionMap); 
    if (promptSuccess) {
        const prepareAction = document.getElementById('prepare-action-tf');
        if (prepareAction) prepareAction.style.display = 'none';

        const iaContainer = document.getElementById('ia-container-tf');
        if (iaContainer) {
            iaContainer.style.display = 'block';
            
            const promptArea = document.getElementById('ia-prompt-tf');
            if (promptArea) {
                promptArea.removeAttribute('readonly'); 
                promptArea.disabled = false;
                promptArea.style.backgroundColor = 'var(--field-bg)'; 
                promptArea.style.border = '2px solid var(--hapi-green)';
            }
            
            const albertAction = document.getElementById('albert-action-tf');
            if (albertAction) albertAction.style.display = 'block';

            setTimeout(() => {
                iaContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
}

async function handleGenerateAlbertTF() {
    const btn = container.querySelector('#btn-send-albert-tf');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "L'IA génère les affirmations...";

    await callAlbertAPI('ia-prompt-tf', 'ia-response-tf', 'btn-parse-ia-response-tf', btn);

    btn.innerHTML = originalText;
    btn.disabled = false;
}

function handleParseIA() {
    const textareaResponse = document.getElementById('ia-response-tf');
    if (!textareaResponse) return;

    const reponseBrute = textareaResponse.value.trim();
    if (!reponseBrute) {
        alert("La zone de réponse de l'IA est vide !");
        return;
    }

    try {
        const questionsData = parserReponseIA_TrueFalse(reponseBrute);
        if (!questionsData || questionsData.length === 0) {
            alert("L'assistant n'a pas trouvé d'affirmations valides. Vérifiez le format JSON.");
            return;
        }

        const previewContainer = document.getElementById('truefalse-questions-preview');
        if (!previewContainer) return;

        previewContainer.innerHTML = '';
        questionCounter = 0;
        
        questionsData.forEach(data => addAffirmationCard(data));
        
        if (questionsData.length > 0) {
            updateGenerateButtonCallback();
            
            const previewSection = document.getElementById('truefalse-preview-section');
            if (previewSection) {
                previewSection.style.display = 'block';
                previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
            const genSection = document.getElementById('generate-section');
            if (genSection) genSection.style.display = 'block';
        }
    } catch (error) {
        console.error("Erreur lors du parsing :", error);
        alert("Une erreur est survenue lors de la création des affirmations. Ouvrez la console (F12).");
    }
}

function addAffirmationCard(data = {}) {
    questionCounter++;
    const container = document.getElementById('truefalse-questions-preview');
    const qText = data.question || '';
    const qAnswer = data.answer || 'true';
    const fbCorrect = data.feedbackCorrect || '';
    const fbIncorrect = data.feedbackIncorrect || '';
    const id = `tf-q${questionCounter}`;

    const card = document.createElement('div');
    card.className = 'card';
    card.id = id;
    card.innerHTML = `
        <button class="delete-btn"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
        <h4>Affirmation ${questionCounter}</h4>
        <div class="input-group">
            <label for="${id}-text">Texte de l'affirmation :</label>
            <textarea id="${id}-text" rows="2" class="tf-text">${qText}</textarea>
        </div>
        <div class="input-group">
            <label>La bonne réponse est :</label>
            <div style="display:flex; gap: 20px;">
                <label><input type="radio" name="${id}-answer" value="true" class="tf-answer" ${qAnswer === 'true' ? 'checked' : ''}> Vrai</label>
                <label><input type="radio" name="${id}-answer" value="false" class="tf-answer" ${qAnswer === 'false' ? 'checked' : ''}> Faux</label>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; border-top: 1px solid var(--border); padding-top: 15px; margin-top: 10px;">
            <div class="input-group">
                <label for="${id}-feedback-correct">Feedback si CORRECT :</label>
                <textarea id="${id}-feedback-correct" class="tf-feedback-correct" rows="2" style="background-color: rgba(34, 197, 94, 0.16);">${fbCorrect}</textarea>
            </div>
            <div class="input-group">
                <label for="${id}-feedback-incorrect">Feedback si INCORRECT :</label>
                <textarea id="${id}-feedback-incorrect" class="tf-feedback-incorrect" rows="2" style="background-color: rgba(220, 38, 38, 0.15);">${fbIncorrect}</textarea>
            </div>
        </div>
    `;
    container.appendChild(card);
}

function showRegenerateButton() {
    const iaContainer = document.getElementById('ia-container-tf');
    const prepareAction = document.getElementById('prepare-action-tf');
    const btnPrepare = document.getElementById('btn-prepare-prompt-tf');

    // On vérifie si l'IA container est visible (le prompt a déjà été généré)
    if (iaContainer && iaContainer.style.display === 'block') {
        if (prepareAction) prepareAction.style.display = 'block';
        if (btnPrepare) {
            btnPrepare.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg> Régénérer le prompt';
            // On s'assure que le bouton reste bien vert
            btnPrepare.style.background = 'linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark))';
            btnPrepare.style.boxShadow = '0 4px 15px rgba(var(--hapi-green-rgb), 0.3)';
        }
    }
}


export function getUIState() { return getTrueFalseState(); }

export function setUIState(config) {
    setTrueFalseState(config, {
        clearPreview: () => {
            document.getElementById('truefalse-questions-preview').innerHTML = '';
            questionCounter = 0; 
        },
        addCard: addAffirmationCard, 
        updateBtn: updateGenerateButtonCallback
    });
}

export function gatherData() {
    logger.log('📊 Collecte des données du Vrai/Faux...');
    const langSelect = document.getElementById('global-language');
    const lang = langSelect ? langSelect.value : 'Français'; 
    const translateCheckbox = document.getElementById('tf-translate-ui');
    const uiLanguage = (translateCheckbox && translateCheckbox.checked) ? lang : 'Français';
    
    const localizationParams = getH5PLocalization(uiLanguage, 'TrueFalse');

    if (localizationParams && localizationParams.score) {
        localizationParams.score = localizationParams.score.replace(':num', '@score').replace(':total', '@total');
        localizationParams.scoreBarLabel = localizationParams.score;
    }

    const donnees = {
        titre: document.getElementById('truefalse-title').value,
        langue: lang,
        passPercentage: document.getElementById('tf-passPercentage')?.value || 50,
        feedbackFail: document.getElementById('tf-feedback-fail')?.value || 'Réessayez',
        feedbackSuccess: document.getElementById('tf-feedback-success')?.value || 'Bravo',
        disableBackwardsNavigation: document.getElementById('tf-disable-back')?.checked || false,
        randomQuestions: document.getElementById('tf-random-questions')?.checked || false,
        showCheckButton: document.getElementById('tf-show-check')?.checked ?? true,
        overrideSolution: document.getElementById('tf-override-solution')?.value || 'default',
        overrideRetry: document.getElementById('tf-override-retry')?.value || 'default',
        questions: []
    };

    const cardSelector = '#truefalse-questions-preview .card';
    document.querySelectorAll(cardSelector).forEach(card => {
        const questionText = card.querySelector('.tf-text').value.trim();
        const correctValue = card.querySelector('.tf-answer:checked')?.value;
        const feedbackCorrect = card.querySelector('.tf-feedback-correct').value.trim();
        const feedbackWrong = card.querySelector('.tf-feedback-incorrect').value.trim();

        if (questionText && correctValue) {
            donnees.questions.push({
                "params": {
                    "question": questionText,
                    "correct": correctValue,
                    "behaviour": {
                        "enableSolutionsButton": true,
                        "enableRetry": true,
                        "enableCheckButton": true,
                        "feedbackOnCorrect": feedbackCorrect,
                        "feedbackOnWrong": feedbackWrong
                    },
                    "l10n": localizationParams 
                },
                "library": getFullLibraryString("H5P.TrueFalse"),
                "subContentId": crypto.randomUUID(),
                "metadata": { "title": "Vrai/Faux", "authors": [], "changes": [] }
            });
        }
    });

    if (donnees.questions.length === 0) {
        logger.error("Aucune affirmation V/F valide à générer.");
        alert("Aucune affirmation complète n'a été trouvée.");
        return null;
    }
    return donnees;
}