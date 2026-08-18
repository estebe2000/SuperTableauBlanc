// Fichier: modules/ui/quiz-math-ui.js

import { logger } from '../utils/logger.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { creerAssistantIA_HTML, creerFeedbackGlobalHTML, handleHelpersClick } from '../utils/helpers.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_QuizMath } from '../ia/prompt-builder.js';
import { parserReponseIA_MathJSON } from '../ia/response-parser.js';
import { L10N_MULTICHOICE_PARAMS } from '../utils/h5p-constants.js';
import { getFullLibraryString } from '../utils/h5p-library-manager.js';
import * as MathEditor from '../utils/math-editor.js';
import { getQuizMathState, setQuizMathState } from '../utils/states/quiz-math-state.js';
import { SourceSelector } from './source-selector.js';

let container = null;
let corpus = '';
let updateGenerateButtonCallback = () => {};
let questionCounter = 0;
const questionCardPrefix = 'math-q-'; 

let localSourceSelector = null;
let currentRepartition = {}; 

export function init(targetContainer, corpusContent, updateBtnCallback) {
    container = targetContainer;
    corpus = corpusContent;
    updateGenerateButtonCallback = updateBtnCallback;
    questionCounter = 0;
    
    logger.log('🔧 Initialisation de Quiz Math UI (Correction Parsing JSON)...');
    
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
        <div id="quiz-math-generator-wrapper" style="font-family:'Segoe UI', sans-serif;">
            
            <div class="section" style="background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                
                <div id="quiz-math-source-selector"></div>
                <div id="quiz-math-questions-repartition"></div>

                <div style="border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-top: 20px; margin-bottom: 20px;">
                    <h2 style="margin:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configurez le quiz
                    </h2>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div class="input-group">
                        <label for="quiz-math-title" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Titre du quiz :</label>
                        <input type="text" id="quiz-math-title" value="Quiz Mathématique" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div class="input-group">
                        <label for="quiz-math-multi-reponse" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Type de questions :</label>
                        <select id="quiz-math-multi-reponse" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                            <option value="false" selected>Choix Unique</option>
                            <option value="true">Choix multiples (plusieurs réponses possibles)</option>
                        </select>
                    </div>
                    <div class="input-group" style="grid-column: span 2;">
                        <label for="quiz-math-subject" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Sujet (pour l'IA) :</label>
                        <input type="text" id="quiz-math-subject" placeholder="ex: Équations du 2nd degré (Optionnel, aide l'IA à cibler)" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                </div>

                <div id="prepare-action-quiz-math" style="margin-top: 35px; text-align: center;">
                    <button id="btn-prepare-prompt-quiz-math" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt
                    </button>
                </div>
            </div>
            
            <div id="ia-container-quiz-math" class="section" style="display: none; background: var(--surface); border-radius: 8px; padding: 12px 25px 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                ${creerAssistantIA_HTML('ia-prompt-quiz-math', 'ia-response-quiz-math')}
                
                <div id="albert-action-quiz-math" style="display: none; text-align: center; margin-top: 15px; margin-bottom: 30px;">
                    <button id="btn-send-albert-quiz-math" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        🇫🇷 Envoyer le prompt à l'IA
                    </button>
                </div>
                
                <div style="text-align:center; display:none;">
                    <button id="btn-parse-ia-response-quiz-math" class="btn"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg> Valider et générer</button>
                </div>
            </div>
            
            <div class="section" id="questions-container" style="display:none; margin-top: 20px; background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <div style="border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="margin:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Éditez vos questions</h2>
                </div>
                
                <div id="questions-list"></div>
                
                <button class="btn" id="btn-add-math-question" style="margin: 20px auto; display: block; background:#6c757d; color:white; padding:10px 25px; border-radius:20px; border:none; cursor:pointer; font-weight:600;">+ Ajouter une question manuellement</button>

               
<div class="input-group" style="margin-top: 40px;" id="quiz-math-options-section">
                    <details style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px;">
                        <summary style="font-weight:bold; font-size:1.2em; color:var(--text); cursor:pointer; outline:none; list-style-position: inside;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options globales
                        </summary>
                        
                        <div style="margin-top: 20px;" id="quiz-math-global-wrapper">
                            <style>
                                #quiz-math-global-wrapper .section { padding: 0; box-shadow: none; border: none; background: transparent; margin: 0; }
                                #quiz-math-global-wrapper h2 { display: none; }
                            </style>
                            
                            ${creerFeedbackGlobalHTML('quiz-math', '')}

                            <hr style="border:0; border-top:1px solid var(--border); margin:25px 0 20px 0;">

                            <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px;">
                                <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options supplémentaires
                                </div>
                                
                                <div style="display:flex; flex-direction:column; gap:15px; margin-bottom: 25px; margin-top: 15px;">
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="math-disable-back" style="margin-right:12px; width: 16px; height: 16px;">
                                        <span style="font-size:1.05em; color:var(--text);">Désactiver le retour en arrière</span>
                                    </label>
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="math-random-questions" style="margin-right:12px; width: 16px; height: 16px;">
                                        <span style="font-size:1.05em; color:var(--text);">Afficher aléatoirement les questions</span>
                                    </label>
                                </div>
                                
                                <hr style="border:0; border-top:1px solid var(--border); margin:20px 0;">
                                
                                <div style="display:flex; flex-direction:column; gap:20px;">
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="math-show-check" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                        <span style="font-weight:bold; font-size:1.05em; color:var(--text);">Montrer les boutons "Vérifier"</span>
                                    </label>
                                    
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 5px;">
                                        <div>
                                            <label for="math-override-solution" style="display:block; font-weight:bold; font-size:1em; margin-bottom:8px; color:var(--text);">Cacher le bouton "Voir la correction"</label>
                                            <select id="math-override-solution" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; font-size:1.05em; background:var(--page-bg);">
                                                <option value="default" selected>-</option><option value="on">Afficher</option><option value="off">Cacher</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label for="math-override-retry" style="display:block; font-weight:bold; font-size:1em; margin-bottom:8px; color:var(--text);">Cacher le bouton "Recommencer"</label>
                                            <select id="math-override-retry" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; font-size:1.05em; background:var(--page-bg);">
                                                <option value="default" selected>-</option><option value="on">Afficher</option><option value="off">Cacher</option>
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
    
// (L'ID peut être '#math-source-selector' ou '#quiz-math-source-selector' selon votre HTML)
	const selectorContainer = container.querySelector('#quiz-math-source-selector') || container.querySelector('[id$="-source-selector"]');
	    if (selectorContainer) {
	        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'quiz-math', (selectedDocs) => {
            
	            // 🟢 CORRECTION : On appelle la fonction avec son VRAI nom !
	            if (typeof renderRepartitionConfigQuizMath === 'function') {
	                renderRepartitionConfigQuizMath(selectedDocs);
	            }
            
	            showRegenerateButton();
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

    // 2. Écouteur global sur la répartition (Nombre de questions par source)
    container.addEventListener('input', (e) => {
        if (e.target.classList.contains('source-question-count')) {
            showRegenerateButton();
        }
    });
	

// ✅ Activation des pastilles du Helper global
    const globalOptionsSection = container.querySelector('#quiz-math-options-section');
    if (globalOptionsSection) {
        globalOptionsSection.addEventListener('click', handleHelpersClick);
    }

    container.querySelector('#btn-prepare-prompt-quiz-math').addEventListener('click', handlePreparePrompt);
    
    const iaLauncher = container.querySelector('#ia-launcher-ia-prompt-quiz-math');
    if (iaLauncher) {
        iaLauncher.style.display = 'none';
    }
    
    const btnAlbert = container.querySelector('#btn-send-albert-quiz-math');
    if (btnAlbert) {
        btnAlbert.addEventListener('click', handleGenerateAlbert);
    }
    
    container.querySelector('#btn-parse-ia-response-quiz-math').addEventListener('click', handleParseIA);
    container.querySelector('#btn-add-math-question').addEventListener('click', () => { addMathQuestionCard(); updateGenerateButtonCallback(); });

    const questionsList = container.querySelector('#questions-list');
    questionsList.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('.toolbar-tab-btn') || target.closest('.toolbar-btn')) {
            e.preventDefault();
            MathEditor.handleToolbarClick(e);
            return;
        }
        const toggleBtn = target.closest('.btn-toggle-toolbar');
        if (toggleBtn) {
            const toolbarId = toggleBtn.dataset.toolbarId;
            const toolbar = document.getElementById(toolbarId);
            if (toolbar) toolbar.style.display = toolbar.style.display === 'none' ? 'block' : 'none';
            return;
        }
        const deleteBtn = target.closest('.delete-btn');
        if (deleteBtn) {
            if(confirm("Supprimer cette question ?")) {
                const card = deleteBtn.closest('.math-question-card');
                card.remove();
                updateGenerateButtonCallback();
            }
            return;
        }
    });

    setTimeout(() => {
        const genSection = document.getElementById('generate-section');
        if (genSection && document.querySelectorAll('#questions-list .math-question-card').length === 0) {
            genSection.style.display = 'none';
        }
    }, 10);
}

function renderRepartitionConfigQuizMath(selectedDocs) {
    const repContainer = container.querySelector('#quiz-math-questions-repartition');
    if (!repContainer) return;

    container.querySelectorAll('.source-question-count').forEach(input => {
        const val = parseInt(input.value, 10);
        currentRepartition[input.dataset.sourceId] = isNaN(val) ? '' : val; 
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
                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Répartition des questions à générer</span>
            </label>
    `;

    selectedDocs.forEach(doc => {
        let defaultCount = doc.priority === 3 ? 6 : (doc.priority === 2 ? 4 : 2);
        let val = currentRepartition[doc.id] !== undefined ? currentRepartition[doc.id] : defaultCount;
        if (Number.isNaN(val)) val = '';
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
    // 🟢 CORRECTION : On pointe vers le bon ID du bouton HTML
    const btn = document.getElementById('btn-prepare-prompt-quiz-math');
    if (!btn) return;

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

    const success = await preparerAssistantIA_QuizMath(repartitionMap); 
    
    if (success) {
        if (btn.parentElement) {
            btn.parentElement.style.display = 'none';
        }

        // 🟢 CORRECTION : On pointe vers les bons conteneurs (quiz-math)
        const iaContainer = document.getElementById('ia-container-quiz-math');
        if (iaContainer) {
            iaContainer.style.display = 'block';
            const promptArea = document.getElementById('ia-prompt-quiz-math');
            if (promptArea) {
                promptArea.removeAttribute('readonly'); 
                promptArea.disabled = false;
                promptArea.style.backgroundColor = 'var(--field-bg)'; 
                promptArea.style.border = '2px solid var(--hapi-green)';
            }
        }
        
        const albertAction = document.getElementById('albert-action-quiz-math');
        if (albertAction) albertAction.style.display = 'block';

        setTimeout(() => {
            const iaContainerToScroll = document.getElementById('ia-container-quiz-math');
            if (iaContainerToScroll) iaContainerToScroll.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
    
    btn.disabled = false;
    btn.innerHTML = originalText;
}

async function handleGenerateAlbert() {
    const btn = container.querySelector('#btn-send-albert-quiz-math');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "L'IA génère les questions...";

    await callAlbertAPI('ia-prompt-quiz-math', 'ia-response-quiz-math', 'btn-parse-ia-response-quiz-math', btn);

    btn.innerHTML = originalText;
    btn.disabled = false;
}

function cleanIAQuestion(input) {
    if (!input) return '';
    let txt = input.trim();
    txt = txt.replace(/\\\\\(/g, '\\(').replace(/\\\\\)/g, '\\)');
    txt = txt.replace(/\\\\\[/g, '\\[').replace(/\\\\\]/g, '\\]');
    return txt;
}

function cleanIAAnswer(input) {
    if (!input) return '';
    let txt = input.trim();

    txt = txt.replace(/\\\\\(/g, '\\(').replace(/\\\\\)/g, '\\)');
    txt = txt.replace(/\\\\\[/g, '\\[').replace(/\\\\\]/g, '\\]');

    const needsDelimiters = /[\+\-\*\/=^]/.test(txt) && !txt.includes('\\(') && !txt.includes('$$') && !txt.includes('\\[');
    txt = txt.replace(/\\text\{€\}/g, '€').replace(/€\}/g, '€');

    if (needsDelimiters && !txt.includes('\n')) return `\\(${txt}\\)`;
    return txt;
}

// 🟢 CORRECTION MAJEURE ICI : On ne retire plus les retours à la ligne !
function handleParseIA() {
    const textareaResponse = document.getElementById('ia-response-quiz-math');
    if (!textareaResponse) return;

    // Ne SURTOUT PAS faire replace(/[\r\n]+/g, ' ') car ça fusionne les blocs Markdown avec le JSON
    const reponseBrute = textareaResponse.value.trim();
    
    if (!reponseBrute) {
        alert("La zone de réponse de l'IA est vide !");
        return;
    }

    let questionsData;
    
    try {
        questionsData = parserReponseIA_MathJSON(reponseBrute);
    } catch (error) {
        console.error("Erreur parsing JSON Math :", error);
        alert("Erreur lors de la lecture du JSON. Vérifiez la syntaxe.\nDétail : " + error.message);
        return;
    }
    
    if (!questionsData || !Array.isArray(questionsData) || questionsData.length === 0) {
        console.error("L'IA n'a pas renvoyé un format JSON valide ou tableau vide.");
        alert("L'IA n'a pas renvoyé un format valide.");
        return;
    }

    const previewContainer = document.getElementById('questions-list');
    previewContainer.innerHTML = '';
    questionCounter = 0;
    
    questionsData.forEach(data => {
        try {
            const cleanQuestion = cleanIAQuestion(data.question_latex || '');
            let answersArray = [];

            if (data.reponses && Array.isArray(data.reponses)) {
                answersArray = data.reponses.map(rep => ({
                    text: cleanIAAnswer(rep.latex || rep.texte || ''),
                    correct: rep.correct === true || rep.est_correct === true
                }));
            } else {
                const cleanA0 = cleanIAAnswer(data.reponse_correcte_latex || '');
                const cleanA1 = cleanIAAnswer(data.distracteur_un_latex || '');
                const cleanA2 = cleanIAAnswer(data.distracteur_deux_latex || '');

                answersArray = [
                    { text: cleanA0, correct: true },
                    { text: cleanA1, correct: false },
                    { text: cleanA2, correct: false }
                ];
                answersArray.sort(() => Math.random() - 0.5);
            }

            addMathQuestionCard({ question: cleanQuestion, answers: answersArray });
        } catch (e) { console.error("Erreur ajout de la carte Math :", e); }
    });
    
    if (questionsData.length > 0) {
        document.getElementById('questions-container').style.display = 'block';
        
        const genSection = document.getElementById('generate-section');
        if (genSection) genSection.style.display = 'block';
        
        updateGenerateButtonCallback();
        
        document.getElementById('questions-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function optimiserPourMoodle(latex) {
    if (!latex) return '';
    let s = latex.replace(/\\mathcal\s*\{([A-Z])\}/g, '$1'); 
    let oldS = '';
    while (s !== oldS) {
        oldS = s;
        s = s.replace(/\\text\{([^{}]*)\}/g, '$1'); 
        s = s.replace(/\\mbox\{([^{}]*)\}/g, '$1');
    }
    return s;
}

function addMathQuestionCard(data = {}) {
    questionCounter++;
    const questionId = `${questionCardPrefix}${questionCounter}`;
    const container = document.getElementById('questions-list');
    
    const card = document.createElement('div');
    card.className = 'math-question-card';
    card.id = questionId;
    card.style.background = 'var(--surface)';
    card.style.padding = '20px';
    card.style.marginBottom = '20px';
    card.style.borderRadius = '8px';
    card.style.border = '1px solid #e2e8f0';
    card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';

    const qFieldId = `${questionId}-q`;
    const qToolbarHTML = MathEditor.createMathToolbar(qFieldId);

    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;">
            <h4 style="margin:0; color:var(--text);">Question ${questionCounter}</h4>
            <button class="delete-btn" style="background:none; border:none; font-size:1.2em; cursor:pointer;" title="Supprimer la question"></button>
        </div>
        <div class="input-group" style="margin-bottom:20px;">
            <label style="font-weight:bold; display:block; margin-bottom:5px;">Énoncé</label>
            <div class="math-controls" style="margin-bottom: 10px;">
                 <button class="btn btn-sm btn-outline-secondary btn-toggle-toolbar" data-toolbar-id="tb-${qFieldId}"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/></svg> Outils Latex</button>
            </div>
            <div id="tb-${qFieldId}" style="display:none; background:var(--page-bg); padding:5px; border:1px solid var(--border); border-bottom:none;">${qToolbarHTML}</div>
            <textarea id="${qFieldId}" class="form-control math-question-text" rows="4" placeholder="Énoncé de la question (Texte et formules \\( x \\))..." style="width:100%; white-space: pre-wrap;">${data.question || ''}</textarea>
            <div id="${qFieldId}-preview" class="math-preview-box" style="margin-top:5px; background:var(--page-bg); padding:10px; border:1px solid var(--border); min-height:40px; white-space: pre-wrap; word-break: break-word;"></div>
        </div>
        <div class="math-answers-section">
            <label style="font-weight:bold; display:block; margin-bottom:10px;">Réponses possibles (Cochez les bonnes réponses)</label>
            <div class="math-answers-container" id="${questionId}-answers" rows="4"></div>
            <button class="btn btn-sm btn-add-math-option" data-target="${questionId}-answers" style="margin-top:10px; background:var(--page-bg); border:1px solid #ced4da; color:var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Ajouter une option</button>
        </div>
        <div style="border-top: 1px solid var(--border); padding-top: 15px; margin-top: 20px;">
            <h5 style="margin-bottom:10px; font-size:0.9em; color:var(--text-muted);">Feedback (Optionnel)</h5>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <textarea class="q-feedback-correct-math" rows="2" placeholder="Feedback si correct..." style="background:rgba(34, 197, 94, 0.16); border:1px solid #c3e6cb; width:100%; border-radius:4px; padding:5px;"></textarea>
                <textarea class="q-feedback-incorrect-math" rows="2" placeholder="Feedback si incorrect..." style="background:rgba(220, 38, 38, 0.15); border:1px solid #f5c6cb; width:100%; border-radius:4px; padding:5px;"></textarea>
            </div>
        </div>
    `;
    
    container.appendChild(card);
    setupMathPreview(qFieldId);

    card.querySelector('.btn-add-math-option').addEventListener('click', (e) => addMathAnswerRow(e.target.dataset.target, '', false));

    if (data.answers && data.answers.length > 0) {
        data.answers.forEach((ans) => {
            let text = typeof ans === 'string' ? ans : ans.text;
            let isCorrect = typeof ans === 'object' && ans.correct !== undefined ? ans.correct : false;
            addMathAnswerRow(`${questionId}-answers`, text, isCorrect);
        });
    } else {
        addMathAnswerRow(`${questionId}-answers`, '', true);
        addMathAnswerRow(`${questionId}-answers`, '', false);
    }
}

function addMathAnswerRow(containerId, content = '', isCorrect = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const uniqueId = 'ans-' + Math.random().toString(36).substr(2, 9);
    
    const row = document.createElement('div');
    row.className = 'math-answer-row';
    row.style.cssText = `display:flex; align-items:start; gap:10px; margin-bottom:15px; padding:10px; background:${isCorrect ? 'rgba(34, 197, 94, 0.16)' : 'rgba(220, 38, 38, 0.15)'}; border:1px solid var(--border); border-radius:6px;`;

    const toolbarHTML = MathEditor.createMathToolbar(uniqueId);
    row.innerHTML = `
        <div style="padding-top:35px;"><input type="checkbox" class="math-answer-checkbox" ${isCorrect ? 'checked' : ''} title="Cocher si c'est une bonne réponse"></div>
        <div style="flex:1;">
            <div class="math-controls" style="margin-bottom: 10px; display:flex; justify-content:space-between;">
                 <button class="btn btn-sm btn-outline-secondary btn-toggle-toolbar" data-toolbar-id="tb-${uniqueId}" style="font-size:0.75em; padding:2px 5px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/></svg> Outils Latex</button>
            </div>
            <div id="tb-${uniqueId}" style="display:none; background:var(--surface); border:1px solid #ccc; padding:2px; margin-bottom:2px;">${toolbarHTML}</div>
            <textarea id="${uniqueId}" class="form-control math-answer-text" rows="4" placeholder="Réponse..." style="width:100%; resize:vertical; padding-top:6px ;padding-left:3px">${content}</textarea>
            <div id="${uniqueId}-preview" class="math-preview-box" style="margin-top:2px; min-height:20px; font-size:0.9em; color:var(--text); white-space: pre-wrap; word-break: break-word;"></div>
        </div>
        <button class="btn-remove-answer" style="background:none; border:none; color:var(--danger-text); cursor:pointer; font-size:1.2em; padding-top:35px;">✕</button>
    `;

    container.appendChild(row);
    setupMathPreview(uniqueId);

    row.querySelector('.btn-remove-answer').addEventListener('click', () => {
        row.remove();
        if (typeof updateGenerateButtonCallback === 'function') updateGenerateButtonCallback();
    });
    row.querySelector('.math-answer-checkbox').addEventListener('change', (e) => {
        row.style.background = e.target.checked ? 'rgba(34, 197, 94, 0.16)' : 'rgba(220, 38, 38, 0.15)';
        if (typeof updateGenerateButtonCallback === 'function') updateGenerateButtonCallback();
    });
}

function setupMathPreview(fid) {
    const el = document.getElementById(fid);
    const prev = document.getElementById(`${fid}-preview`);
    if(!el || !prev) return;

    const render = () => {
        const val = el.value.trim();
        if (!val) { prev.innerHTML = ''; return; }
        let safeVal = optimiserPourMoodle(val);
        prev.innerHTML = safeVal.replace(/\n/g, '<br>');

        if (window.MathJax) {
            try {
                if (MathJax.typesetPromise) {
                    MathJax.typesetClear([prev]);
                    MathJax.typesetPromise([prev]).catch(e => console.error(e));
                } else if (MathJax.Hub) {
                    MathJax.Hub.Queue(["Typeset", MathJax.Hub, prev]);
                }
            } catch (err) {}
        }
        if (typeof updateGenerateButtonCallback === 'function') updateGenerateButtonCallback();
    };
    el.addEventListener('input', render);
    setTimeout(render, 150);
}


function showRegenerateButton() {
    // 🟢 CORRECTION : Les bons IDs ici aussi
    const iaContainer = document.getElementById('ia-container-quiz-math');
    const btnPrepare = document.getElementById('btn-prepare-prompt-quiz-math');

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

export function getUIState() { return getQuizMathState(); }

export function setUIState(config) {
    setQuizMathState(config, {
        clearPreview: () => { document.getElementById('questions-list').innerHTML = ''; questionCounter = 0; },
        addCard: addMathQuestionCard, updateBtn: updateGenerateButtonCallback
    });
}

export function gatherData() {
    logger.log('📊 Collecte des données du Quiz Math...');
    
    const isMultiReponseSetting = document.getElementById('quiz-math-multi-reponse').value === 'true';

	const passPercentage = parseInt(document.getElementById('quiz-math-passPercentage')?.value || "50", 10);
	const feedbackSuccess = document.getElementById('quiz-math-feedback-success')?.value || 'Bravo';
	const feedbackFail = document.getElementById('quiz-math-feedback-fail')?.value || 'Réessayez';
    
	const donnees = {
        titre: document.getElementById('quiz-math-title')?.value || 'Quiz Mathématique',
        passPercentage: passPercentage, 
        feedbackFail: feedbackFail, 
        feedbackSuccess: feedbackSuccess,
        isMultiReponse: isMultiReponseSetting,
        disableBackwardsNavigation: document.getElementById('math-disable-back')?.checked || false,
        randomQuestions: document.getElementById('math-random-questions')?.checked || false,
        showCheckButton: document.getElementById('math-show-check')?.checked ?? true,
        overrideSolution: document.getElementById('math-override-solution')?.value || 'default',
        overrideRetry: document.getElementById('math-override-retry')?.value || 'default',
        questions: []
    };

    const cardSelector = '#questions-list .math-question-card';
    
    document.querySelectorAll(cardSelector).forEach(card => {
        const qTextarea = card.querySelector('.math-question-text');
        if (!qTextarea) return;
        const qVal = qTextarea.value.trim();
        if (!qVal) return;

        const feedbackCorrect = card.querySelector('.q-feedback-correct-math').value.trim();
        const feedbackIncorrect = card.querySelector('.q-feedback-incorrect-math').value.trim();

        const answers = [];
        card.querySelectorAll('.math-answer-row').forEach(row => {
            const aVal = row.querySelector('.math-answer-text').value.trim();
            const isChecked = row.querySelector('.math-answer-checkbox').checked;
            
            if (aVal) {
                const aSafe = optimiserPourMoodle(aVal);
                answers.push({
                    text: aSafe.replace(/\n/g, '<br>'),
                    correct: isChecked,
                    tipsAndFeedback: { chosenFeedback: isChecked ? feedbackCorrect : feedbackIncorrect, notChosenFeedback: '' }
                });
            }
        });

        if (answers.length < 2) return;

        const correctCount = answers.filter(a => a.correct).length;
        const forceMulti = correctCount > 1; 

        donnees.questions.push({
            "params": {
                "question": optimiserPourMoodle(qVal).replace(/\n/g, '<br>'),
                "answers": answers,
                "behaviour": {
                    "questionType": "multi-choice", "randomAnswers": true,
                    "type": (isMultiReponseSetting || forceMulti) ? "multi" : "single",
                    "singlePoint": false
                },
                "UI": L10N_MULTICHOICE_PARAMS.UI
            },
            "library": getFullLibraryString("H5P.MultiChoice"),
            "subContentId": crypto.randomUUID()
        });
    });

    if (donnees.questions.length === 0) {
        alert("Attention : Aucune question complète n'a été trouvée.");
        return null;
    }
    return donnees;
}