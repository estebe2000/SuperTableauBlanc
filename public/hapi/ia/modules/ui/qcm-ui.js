// Fichier: modules/ui/qcm-ui.js

import { logger } from '../utils/logger.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { creerAssistantIA_HTML, creerFeedbackGlobalHTML, handleHelpersClick } from '../utils/helpers.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_Quiz } from '../ia/prompt-builder.js';
import { parserReponseIA_Quiz } from '../ia/response-parser.js';
import { L10N_MULTICHOICE_PARAMS } from '../utils/h5p-constants.js';
import { getFullLibraryString } from '../utils/h5p-library-manager.js';
import { getLanguageOptionsHTML } from '../utils/languages.js';
import { getH5PLocalization } from '../utils/h5p-translations.js';
import { getQCMState, setQCMState } from '../utils/states/qcm-state.js';
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
    
    logger.log('🔧 Initialisation de QCM UI (Sélecteur + Répartition)...');

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
        <div id="quiz-generator-wrapper">
            
            <div class="section" style="background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                
                <div id="qcm-source-selector"></div>
                <div id="qcm-questions-repartition"></div>

                <h2 style="margin:10px 0 15px 0;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configurez le quiz</h2>
				
				
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div class="input-group">
                        <label for="quiz-title" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Titre du quiz :</label>
                        <input type="text" id="quiz-title" value="Questions de compréhension" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div class="input-group">
                        <label for="quiz-multi-reponse" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Type de questions :</label>
                        <select id="quiz-multi-reponse" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                            <option value="true" selected>Choix multiples (plusieurs réponses possibles)</option>
                            <option value="false">Choix unique (une seule réponse correcte)</option>
                        </select>
                    </div>
                </div>

			<div id="prepare-action-quiz" style="margin-top: 35px; text-align: center;">
                    <button id="btn-prepare-prompt-quiz" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background-color: var(--hapi-green-dark); background-image: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt
                    </button>
                </div>
            </div>
            
            <div id="ia-container-quiz" class="section" style="display: none; background: var(--surface); border-radius: 8px; padding: 12px 25px 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);"></div>
            
			<div id="albert-action-quiz" style="display: none; text-align: center; margin-top: 15px; margin-bottom: 30px;">
                <button id="btn-generate-albert-quiz" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background-color: var(--hapi-green-dark); background-image: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                    🇫🇷 Envoyer le prompt à l'IA
                </button>
            </div>
            
            <div class="section" id="preview-section" style="margin-top: 20px; display:none;">
                <div style="border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 20px;"><h2 style="margin:0; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Éditez le questionnaire</h2></div>
                <div id="comprehension-questions-preview"></div>
                <button class="btn" id="btn-add-question" style="margin: 20px auto; display: block; background:#6c757d; color:white;">+ Ajouter une question manuelle</button>

                <div class="input-group" style="margin-top: 40px;">
<details style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px;">
                        <summary style="font-weight:bold; font-size:1.2em; color:var(--text); cursor:pointer; outline:none; list-style-position: inside;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options globales
                        </summary>
                        
                        <div style="margin-top: 20px;" id="quiz-global-wrapper">
                            <style>
                                #quiz-global-wrapper .section { padding: 0; box-shadow: none; border: none; background: transparent; margin: 0; }
                                #quiz-global-wrapper h2 { display: none; }
                            </style>
                            
                            ${creerFeedbackGlobalHTML('quiz', '')}

                            <hr style="border:0; border-top:1px solid var(--border); margin:25px 0 20px 0;">

                            <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px;">
                                <div>
                                    <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options supplémentaires
                                    </div>
                                    
                                    <div style="display:flex; flex-direction:column; gap:15px; margin-bottom: 25px; margin-top: 15px;">
                                        <label style="display:flex; align-items:center; cursor:pointer;">
                                            <input type="checkbox" id="quiz-disable-back" style="margin-right:12px; width: 16px; height: 16px;">
                                            <span style="font-size:1.05em; color:var(--text);">Désactiver le retour en arrière</span>
                                        </label>
                                        <label style="display:flex; align-items:center; cursor:pointer;">
                                            <input type="checkbox" id="quiz-random-questions" style="margin-right:12px; width: 16px; height: 16px;">
                                            <span style="font-size:1.05em; color:var(--text);">Afficher aléatoirement les questions</span>
                                        </label>
                                    </div>
                                    
                                    <hr style="border:0; border-top:1px solid var(--border); margin:20px 0;">
                                    
                                    <div style="display:flex; flex-direction:column; gap:20px;">
                                        <label style="display:flex; align-items:center; cursor:pointer;">
                                            <input type="checkbox" id="quiz-translate-ui" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                            <span style="font-weight:bold; font-size:1.05em; color: var(--hapi-accent-text);">Traduire les boutons H5P</span>
                                        </label>

                                        <label style="display:flex; align-items:center; cursor:pointer;">
                                            <input type="checkbox" id="quiz-show-check" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                            <span style="font-weight:bold; font-size:1.05em; color:var(--text);">Montrer les boutons "Vérifier"</span>
                                        </label>
                                        
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 5px;">
                                            <div>
                                                <label for="quiz-override-solution" style="display:block; font-weight:bold; font-size:1em; margin-bottom:8px; color:var(--text);">Cacher le bouton "Voir la correction"</label>
                                                <select id="quiz-override-solution" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; font-size:1.05em; background:var(--page-bg);">
                                                    <option value="default" selected>-</option><option value="on">Afficher</option><option value="off">Cacher</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label for="quiz-override-retry" style="display:block; font-weight:bold; font-size:1em; margin-bottom:8px; color:var(--text);">Cacher le bouton "Recommencer"</label>
                                                <select id="quiz-override-retry" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; font-size:1.05em; background:var(--page-bg);">
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

	const selectorContainer = container.querySelector('#qcm-source-selector');
	    if (selectorContainer) {
	        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'quiz', (selectedDocs) => {
	            renderRepartitionConfig(selectedDocs);
	            showRegenerateButton(); // <-- Déclencheur : modification du corpus ou des priorités
	        });
	    }

    const iaContainer = container.querySelector('#ia-container-quiz');
    if (iaContainer) {
        iaContainer.innerHTML = creerAssistantIA_HTML('ia-prompt-quiz', 'ia-response-quiz');
        
        const promptArea = iaContainer.querySelector('#ia-prompt-quiz');
        if (promptArea) {
            promptArea.rows = 12;
            promptArea.style.fontSize = '1.05em';
        }
        
        const responseArea = iaContainer.querySelector('#ia-response-quiz');
        if (responseArea) responseArea.parentElement.style.display = 'none';
        
        const iaParseBtn = iaContainer.querySelector('#btn-parse-ia-response-quiz');
        if (iaParseBtn) iaParseBtn.style.display = 'none';

        iaContainer.querySelectorAll('p, h4').forEach(el => {
            const text = el.innerText.toLowerCase();
            if (text.includes("collez la réponse") || text.includes("étape 2") || text.includes("étape 3")) {
                el.style.display = 'none';
            }
        });
    }

    const btnPrepare = container.querySelector('#btn-prepare-prompt-quiz');
    if (btnPrepare) btnPrepare.addEventListener('click', handlePreparePrompt);

	// 1. Écouteurs sur les paramètres GLOBAUX (Niveau et Langue)
    const niveauSelect = document.getElementById('global-niveau');
    if (niveauSelect) niveauSelect.addEventListener('change', showRegenerateButton);

    const langSelect = document.getElementById('global-language');
    if (langSelect) langSelect.addEventListener('change', showRegenerateButton);

    // 1bis. Écoute complète du niveau hors-RAG et de la cascade RAG BOEN
    ['standalone-niveau', 'toggle-rag-boen', 'global-scolarite', 'global-cycle-voie', 'global-discipline'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', showRegenerateButton);
    });

    // 2. Écouteur sur le type de questions (Choix multiples ou unique)
    const typeSelect = container.querySelector('#quiz-multi-reponse');
    if (typeSelect) typeSelect.addEventListener('change', showRegenerateButton);

    // 3. Écouteur sur la répartition (Nombre de questions à générer par source)
    const repartitionContainer = container.querySelector('#qcm-questions-repartition');
    if (repartitionContainer) {
        repartitionContainer.addEventListener('input', (e) => {
            if (e.target.classList.contains('source-question-count')) {
                showRegenerateButton();
            }
        });
    }

    const btnAlbert = container.querySelector('#btn-generate-albert-quiz');
    if (btnAlbert) btnAlbert.addEventListener('click', handleGenerateAlbert);

    const parseBtn = container.querySelector('#btn-parse-ia-response-quiz');
    if (parseBtn) parseBtn.addEventListener('click', handleParseIA);

    const addQuestionBtn = container.querySelector('#btn-add-question');
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', () => { 
            addQuestionCard(); 
            updateGenerateButtonCallback(); 
            const genSection = document.getElementById('generate-section');
            if (genSection) genSection.style.display = 'block';
            
            const previewSection = document.getElementById('preview-section');
            if (previewSection) previewSection.style.display = 'block';
        });
    }

    const questionsPreview = container.querySelector('#comprehension-questions-preview');
    if (questionsPreview) {
        questionsPreview.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) { e.target.closest('.card').remove(); updateGenerateButtonCallback(); }
            if (e.target.closest('.btn-add-option')) addAnswerOption(e.target.closest('.btn-add-option'));
            if (e.target.closest('.btn-remove-option')) e.target.closest('.answer-option').remove();
        });
        
        questionsPreview.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && e.target.closest('.answer-option')) {
                e.target.nextElementSibling.style.backgroundColor = e.target.checked ? 'rgba(34, 197, 94, 0.16)' : 'rgba(220, 38, 38, 0.15)';
            }
        });
    }

// ✅ Activation des pastilles du Helper global
    const globalOptionsSection = container.querySelector('#final-options-section-quiz');
    if (globalOptionsSection) {
        globalOptionsSection.addEventListener('click', handleHelpersClick);
    }

    // 🔴 SÉCURITÉ : On cache le bloc de finalisation au lancement
    setTimeout(() => {
        const genSection = document.getElementById('generate-section');
        if (genSection && document.querySelectorAll('#comprehension-questions-preview .card').length === 0) {
            genSection.style.display = 'none';
        }
    }, 10);
}
    
function renderRepartitionConfig(selectedDocs) {
    const repContainer = container.querySelector('#qcm-questions-repartition');
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

// 🟢 BOUTON 1 : Préparer et rendre le prompt modifiable, puis afficher le bouton Albert
async function handlePreparePrompt() {
    const btn = document.getElementById('btn-prepare-prompt-quiz');
    
    // On repasse sur le texte par défaut lors du clic
    const originalText = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt'; 
    
    btn.disabled = true;
    btn.innerHTML = 'Analyse du corpus…';
    
    // Remettre le bouton en vert
    btn.style.backgroundColor = 'var(--hapi-green-dark)'; btn.style.backgroundImage = 'linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark))';
    btn.style.boxShadow = '0 4px 15px rgba(var(--hapi-green-rgb), 0.3)';

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

    const promptSuccess = await preparerAssistantIA_Quiz(repartitionMap); 
    if (promptSuccess) {
        // Cacher le conteneur du bouton de préparation
        const prepareAction = document.getElementById('prepare-action-quiz');
        if (prepareAction) prepareAction.style.display = 'none';

        const iaContainer = document.getElementById('ia-container-quiz');
        if (iaContainer) {
            iaContainer.style.display = 'block';
            
            // RENDRE LE PROMPT MODIFIABLE
            const promptArea = document.getElementById('ia-prompt-quiz');
            if (promptArea) {
                promptArea.removeAttribute('readonly'); 
                promptArea.disabled = false;
                promptArea.style.backgroundColor = 'var(--field-bg)'; 
                promptArea.style.border = '2px solid var(--hapi-green)';
            }
            
            // Afficher le bouton Albert juste en dessous
            const albertAction = document.getElementById('albert-action-quiz');
            if (albertAction) albertAction.style.display = 'block';

            setTimeout(() => {
                iaContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
}

function showRegenerateButton() {
    const iaContainer = document.getElementById('ia-container-quiz');
    const prepareAction = document.getElementById('prepare-action-quiz');
    const btnPrepare = document.getElementById('btn-prepare-prompt-quiz');

    // On vérifie si l'IA container est visible (ce qui signifie que le prompt a déjà été généré)
    if (iaContainer && iaContainer.style.display === 'block') {
        if (prepareAction) prepareAction.style.display = 'block';
        if (btnPrepare) {
            btnPrepare.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg> Régénérer le prompt';
            // On s'assure que le bouton reste bien vert
            btnPrepare.style.background = 'linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark))';
            btnPrepare.style.boxShadow = '0 4px 15px rgba(var(--hapi-green-rgb), 0.3)';
        }
    }
}


// 🟢 BOUTON 2 : Envoyer le prompt (modifié ou non) à Albert
async function handleGenerateAlbert() {
    const btn = container.querySelector('#btn-generate-albert-quiz');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "L'IA génère les questions...";

    await callAlbertAPI('ia-prompt-quiz', 'ia-response-quiz', 'btn-parse-ia-response-quiz', btn);

    btn.innerHTML = originalText;
    btn.disabled = false;
}

function handleParseIA() {
    const textareaResponse = document.getElementById('ia-response-quiz');
    if (!textareaResponse) return;

    const reponseBrute = textareaResponse.value.trim();
    if (!reponseBrute) {
        alert("La zone de réponse de l'IA est vide !");
        return;
    }

    try {
        const questionsData = parserReponseIA_Quiz(reponseBrute);
        if (!questionsData || questionsData.length === 0) {
            alert("L'assistant n'a pas trouvé de questions valides dans la réponse. Vérifiez le format JSON.");
            return;
        }

        const previewContainer = document.getElementById('comprehension-questions-preview');
        if (!previewContainer) return;

        previewContainer.innerHTML = ''; 
        questionCounter = 0;
        
        questionsData.forEach(data => addQuestionCard(data)); 
        
        if (questionsData.length > 0) {
            updateGenerateButtonCallback();
            
            // 🟢 L'affichage de la section édition
            const previewSection = document.getElementById('preview-section');
            if (previewSection) {
                previewSection.style.display = 'block';
                previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
            // 🟢 L'affichage de la barre de finalisation
            const genSection = document.getElementById('generate-section');
            if (genSection) genSection.style.display = 'block';
        }
    } catch (error) {
        console.error("Erreur lors du parsing :", error);
        alert("Une erreur est survenue lors de la création des questions. Ouvrez la console (F12).");
    }
}

function addQuestionCard(data = {}) {
    questionCounter++;
    const container = document.getElementById('comprehension-questions-preview');
    
    const toutesLesReponses = [];
    (data.correct || []).forEach(texte => toutesLesReponses.push({ texte, estCorrecte: true }));
    (data.incorrect || []).forEach(texte => toutesLesReponses.push({ texte, estCorrecte: false }));
    if (toutesLesReponses.length > 0) toutesLesReponses.sort(() => Math.random() - 0.5);

    let optionsHTML = toutesLesReponses.map(reponse => {
        const isChecked = reponse.estCorrecte ? 'checked' : '';
        const bgColor = reponse.estCorrecte ? 'rgba(34, 197, 94, 0.16)' : 'rgba(220, 38, 38, 0.15)';
        return `
            <div class="answer-option">
                <input type="checkbox" ${isChecked}>
                <input type="text" class="q-answer-text" value="${reponse.texte}" style="background-color: ${bgColor};">
                <button class="btn-remove-option">✕</button>
            </div>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="margin:0;">Question ${questionCounter}</h4>
            <button class="delete-btn" title="Supprimer la question" aria-label="Supprimer la question" style="background:transparent; border:none; cursor:pointer; color:var(--text);"><svg class="ico" style="width:1.35em;height:1.35em;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
        </div>
        <div class="input-group">
            <textarea rows="2" class="q-text" placeholder="Écrivez votre question ici...">${data.question || ''}</textarea>
        </div>
        <div class="input-group">
            <label style="font-size:0.9em; font-weight:bold;">Réponses possibles :</label>
            <div class="answers-container">${optionsHTML}</div>
        </div>
        <button class="btn btn-add-option" style="background: var(--page-bg); color: var(--text); font-size:0.8em; border:1px solid #ccc;">+ Ajouter une option</button>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; border-top: 1px solid var(--border); margin-top: 15px; padding-top: 10px;">
            <div class="input-group">
                <label>Feedback si bonne réponse :</label>
                <textarea class="q-feedback-correct" rows="2" style="background-color: rgba(34, 197, 94, 0.16);" placeholder="Optionnel...">${data.feedbackCorrect || ''}</textarea>
            </div>
            <div class="input-group">
                <label>Feedback si mauvaise réponse :</label>
                <textarea class="q-feedback-incorrect" rows="2" style="background-color: rgba(220, 38, 38, 0.15);" placeholder="Optionnel...">${data.feedbackIncorrect || ''}</textarea>
            </div>
        </div>
    `;
    container.appendChild(card);
}

function addAnswerOption(button) {
    const container = button.previousElementSibling.querySelector('.answers-container');
    const newOption = document.createElement('div');
    newOption.className = 'answer-option';
    newOption.innerHTML = `
        <input type="checkbox">
        <input type="text" class="q-answer-text" placeholder="Nouvelle option..." style="background-color: rgba(220, 38, 38, 0.15);">
        <button class="btn-remove-option">✕</button>
    `;
    container.appendChild(newOption);
}

export function getUIState() { return getQCMState(); }

export function setUIState(config) {
    setQCMState(config, {
        clearPreview: () => {
            document.getElementById('comprehension-questions-preview').innerHTML = '';
            questionCounter = 0; 
        },
        addCard: addQuestionCard, 
        updateBtn: updateGenerateButtonCallback
    });
}

export function gatherData() {
    logger.log('📊 Collecte des données du QCM...');
    const langSelect = document.getElementById('global-language');
    const lang = langSelect ? langSelect.value : 'Français'; 
    const translateCheckbox = document.getElementById('quiz-translate-ui');
    const uiLanguage = (translateCheckbox && translateCheckbox.checked) ? lang : 'Français';
    const uiTranslations = getH5PLocalization(uiLanguage, 'MultiChoice');

    const donnees = {
        titre: document.getElementById('quiz-title').value,
        langue: lang, 
        passPercentage: document.getElementById('quiz-passPercentage')?.value || 50,
        feedbackFail: document.getElementById('quiz-feedback-fail')?.value || 'Réessayez',
        feedbackSuccess: document.getElementById('quiz-feedback-success')?.value || 'Bravo',
        isMultiReponse: document.getElementById('quiz-multi-reponse').value === 'true',
		disableBackwardsNavigation: document.getElementById('quiz-disable-back')?.checked || false,
        randomQuestions: document.getElementById('quiz-random-questions')?.checked || false,
		showCheckButton: document.getElementById('quiz-show-check')?.checked ?? true,
        overrideSolution: document.getElementById('quiz-override-solution')?.value || 'default',
        overrideRetry: document.getElementById('quiz-override-retry')?.value || 'default',
        questions: []
    };

    const cardSelector = '#comprehension-questions-preview .card';
    document.querySelectorAll(cardSelector).forEach(card => {
        const questionText = card.querySelector('.q-text').value.trim();
        const feedbackCorrect = card.querySelector('.q-feedback-correct')?.value.trim() || '';
        const feedbackIncorrect = card.querySelector('.q-feedback-incorrect')?.value.trim() || '';
        
        const answerOptions = [];
        card.querySelectorAll('.answer-option').forEach(optionDiv => {
            const texte = optionDiv.querySelector('.q-answer-text').value.trim();
            const estCorrect = optionDiv.querySelector('input[type="checkbox"]').checked;
            if (texte) {
                answerOptions.push({
                    text: texte,
                    correct: estCorrect,
                    tipsAndFeedback: { chosenFeedback: estCorrect ? feedbackCorrect : feedbackIncorrect } 
                });
            }
        });

        if (questionText && answerOptions.some(opt => opt.correct)) {
            donnees.questions.push({
                "params": {
                    "question": `<p>${questionText}</p>`,
                    "answers": answerOptions,
                    "behaviour": {
                        "questionType": "multi-choice",
                        "type": donnees.isMultiReponse ? "multi" : "single",
                        "singlePoint": false,
                        "randomAnswers": true,
                        "showSolutionsRequiresInput": true,
                        "confirmCheckDialog": false,
                        "enableRetry": true,
                        "enableSolutionsButton": true,
                        "enableCheckButton": true
                    },
                    "UI": uiTranslations 
                },
                "library": getFullLibraryString("H5P.MultiChoice"),
                "subContentId": crypto.randomUUID()
            });
        }
    });

    if (donnees.questions.length === 0) {
        logger.error("Erreur : Aucune question valide.");
        alert("Aucune question complète trouvée.");
        return null;
    }
    return donnees;
}