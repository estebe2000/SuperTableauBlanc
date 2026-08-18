// Fichier: modules/ui/truefalse-math-ui.js

import { logger } from '../utils/logger.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { creerAssistantIA_HTML, creerFeedbackGlobalHTML, handleHelpersClick } from '../utils/helpers.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_TrueFalseMath } from '../ia/prompt-builder.js';
import { parserReponseIA_MathJSON } from '../ia/response-parser.js';
import { L10N_TRUEFALSE_PARAMS } from '../utils/h5p-constants.js';
import { getFullLibraryString } from '../utils/h5p-library-manager.js';
import { getH5PLocalization } from '../utils/h5p-translations.js'; // Ajout pour la cohérence
import * as MathEditor from '../utils/math-editor.js';
import { getTrueFalseMathState, setTrueFalseMathState } from '../utils/states/truefalse-math-state.js';
import { SourceSelector } from './source-selector.js'; // ✅ NOUVEL IMPORT

// --- Variables privées ---
let container = null;
let corpus = '';
let updateGenerateButtonCallback = () => {};
let statementCounter = 0;
const cardPrefix = 'tf-math-s-';

// ✅ NOUVELLES VARIABLES
let localSourceSelector = null;
let currentRepartition = {};

/**
 * Initialise l'interface utilisateur pour le Vrai/Faux Mathématique.
 */
export function init(targetContainer, corpusContent, updateBtnCallback) {
    container = targetContainer;
    corpus = corpusContent;
    updateGenerateButtonCallback = updateBtnCallback;
    statementCounter = 0;
    
    logger.log('🔧 Initialisation de Vrai/Faux Math UI (Standardisé)...');
    

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
	        <div id="tf-math-generator-wrapper">
	             <div class="section" style="background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                
	                <div id="tf-math-source-selector"></div>
                
	                <div id="tf-math-questions-repartition"></div>

	                <h2 style="margin-top:25px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configuration du Vrai/Faux Mathématique</h2>
                
	                <div class="input-group" style="margin-bottom: 20px; margin-top: 15px;">
	                    <label for="truefalse-math-title" style="display:block; font-weight:bold; margin-bottom:6px;">Titre de l'activité :</label>
	                    <input type="text" id="truefalse-math-title" value="Vrai ou Faux Mathématique" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:5px;">
	                </div>

	                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 20px; margin-bottom: 30px;">
	                    <div class="input-group">
	                        <label for="tf-math-level" style="display:block; font-weight:bold; margin-bottom:6px;">Niveau scolaire :</label>
	                        <select id="tf-math-level" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:5px;">
	                            <option value="Cycle 3" selected>Cycle 3</option>
	                            <option value="Cycle 4">Cycle 4</option>
	                            <option value="Lycée">Lycée</option>
	                            <option value="Post-Bac">Post-Bac</option>
	                        </select>
	                    </div>
	                    <div class="input-group">
	                        <label for="tf-math-subject" style="display:block; font-weight:bold; margin-bottom:6px;">Sujet (pour l'IA) :</label>
	                        <input type="text" id="tf-math-subject" placeholder="ex: thématique mathématique" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:5px;">
	                    </div>
	                </div>

	                <div id="prepare-action-tf-math" style="margin-top: 35px; text-align: center;">
	                    <button id="btn-prepare-prompt-tf-math" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
	                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt
	                    </button>
	                </div>
	            </div>
            
	            <div id="ia-container-tf-math" class="section" style="display: none; background: var(--surface); border-radius: 8px; padding: 12px 25px 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);"></div>

	            <div id="albert-action-tf-math" style="display: none; text-align: center; margin-top: 15px; margin-bottom: 30px;">
	                <button id="btn-send-albert-tf-math" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
	                    🇫🇷 Envoyer le prompt à l'IA
	                </button>
	            </div>
            
	            <div class="section" id="statements-container" style="display:none; margin-top: 20px; background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
	                <div style="border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 20px;">
	                    <h2 style="margin:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Éditez vos affirmations</h2>
	                </div>
	                <div id="statements-list"></div>
	                <button class="btn" id="btn-add-tf-math-statement" style="margin: 20px auto; display: block; background:#6c757d; color:white;">+ Ajouter une affirmation manuellement</button>

	                
<div class="input-group" style="margin-top: 40px;" id="tf-math-options-section">
                    <details style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px;">
                        <summary style="font-weight:bold; font-size:1.2em; color:var(--text); cursor:pointer; outline:none; list-style-position: inside;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options globales
                        </summary>
                        
                        <div style="margin-top: 20px;" id="tf-math-global-wrapper">
                            <style>
                                #tf-math-global-wrapper .section { padding: 0; box-shadow: none; border: none; background: transparent; margin: 0; }
                                #tf-math-global-wrapper h2 { display: none; }
                            </style>
                            
                            ${creerFeedbackGlobalHTML('tf-math', '')}

                            <hr style="border:0; border-top:1px solid var(--border); margin:25px 0 20px 0;">

                            <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px;">
                                <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options supplémentaires
                                </div>
                                
                                <div style="display:flex; flex-direction:column; gap:15px; margin-bottom: 25px; margin-top: 15px;">
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="tf-math-disable-back" style="margin-right:12px; width: 16px; height: 16px;">
                                        <span style="font-size:1.05em; color:var(--text);">Désactiver le retour en arrière</span>
                                    </label>
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="tf-math-random-questions" style="margin-right:12px; width: 16px; height: 16px;">
                                        <span style="font-size:1.05em; color:var(--text);">Afficher aléatoirement les questions</span>
                                    </label>
                                </div>
                                
                                <hr style="border:0; border-top:1px solid var(--border); margin:20px 0;">
                                
                                <div style="display:flex; flex-direction:column; gap:20px;">
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="tf-math-show-check" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                        <span style="font-weight:bold; font-size:1.05em; color:var(--text);">Montrer les boutons "Vérifier"</span>
                                    </label>
                                    
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 5px;">
                                        <div>
                                            <label for="tf-math-override-solution" style="display:block; font-weight:bold; font-size:1em; margin-bottom:8px; color:var(--text);">Cacher le bouton "Voir la correction"</label>
                                            <select id="tf-math-override-solution" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; font-size:1.05em; background:var(--page-bg);">
                                                <option value="default" selected>-</option><option value="on">Afficher</option><option value="off">Cacher</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label for="tf-math-override-retry" style="display:block; font-weight:bold; font-size:1em; margin-bottom:8px; color:var(--text);">Cacher le bouton "Recommencer"</label>
                                            <select id="tf-math-override-retry" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; font-size:1.05em; background:var(--page-bg);">
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

	// ✅ Activation des pastilles du Helper global
	    const globalOptionsSection = container.querySelector('#tf-math-options-section');
	    if (globalOptionsSection) {
	        globalOptionsSection.addEventListener('click', handleHelpersClick);
	    }


	// (Ajustez '#tf-math-source-selector' selon l'ID exact dans votre fichier)
	    const selectorContainer = container.querySelector('#tf-math-source-selector') || container.querySelector('[id$="-source-selector"]');
	    if (selectorContainer) {
	        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'truefalse-math', (selectedDocs) => {
	            // Remplacez 'renderRepartitionConfig' par le nom exact de votre fonction si différent
	            if (typeof renderRepartitionConfigTFMath === 'function') renderRepartitionConfigTFMath(selectedDocs);
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

	    // 2. Écouteur global sur la répartition (Nombre de questions par source)
	    container.addEventListener('input', (e) => {
	        if (e.target.classList.contains('source-question-count')) {
	            showRegenerateButton();
	        }
	    });
		

    const iaContainer = container.querySelector('#ia-container-tf-math');
    if (iaContainer) {
        iaContainer.innerHTML = creerAssistantIA_HTML('ia-prompt-tf-math', 'ia-response-tf-math');

        const promptArea = iaContainer.querySelector('#ia-prompt-tf-math');
        if (promptArea) {
            promptArea.rows = 12;
            promptArea.style.fontSize = '1.05em';
        }

        const responseArea = iaContainer.querySelector('#ia-response-tf-math');
        if (responseArea) responseArea.parentElement.style.display = 'none';

        const iaParseBtn = iaContainer.querySelector('#btn-parse-ia-response-tf-math');
        if (iaParseBtn) iaParseBtn.style.display = 'none';

        iaContainer.querySelectorAll('p, h4').forEach(el => {
            const text = el.innerText.toLowerCase();
            if (text.includes("collez la réponse") || text.includes("étape 2") || text.includes("étape 3")) {
                el.style.display = 'none';
            }
        });
    }

    const btnPrepare = container.querySelector('#btn-prepare-prompt-tf-math');
    if (btnPrepare) btnPrepare.addEventListener('click', handlePreparePrompt);

    const btnAlbert = container.querySelector('#btn-send-albert-tf-math');
    if (btnAlbert) btnAlbert.addEventListener('click', handleGenerateAlbert);

    const parseBtn = container.querySelector('#btn-parse-ia-response-tf-math');
    if (parseBtn) parseBtn.addEventListener('click', handleParseIA);

    const addStatementBtn = container.querySelector('#btn-add-tf-math-statement');
    if (addStatementBtn) {
        addStatementBtn.addEventListener('click', () => {
            addTrueFalseStatementCard();
            updateGenerateButtonCallback();
            const genSection = document.getElementById('generate-section');
            if (genSection) genSection.style.display = 'block';
            const stmtContainer = document.getElementById('statements-container');
            if (stmtContainer) stmtContainer.style.display = 'block';
        });
    }

    const statementsContainer = container.querySelector('#statements-container');
    if (statementsContainer) {
        statementsContainer.addEventListener('click', (e) => {
            
            if (e.target.closest('.toolbar-tab-btn') || e.target.closest('.toolbar-btn')) {
                e.preventDefault();
                MathEditor.handleToolbarClick(e);
                return;
            }
            const toggleBtn = e.target.closest('.btn-toggle-toolbar');
            if (toggleBtn) {
                const toolbarId = toggleBtn.dataset.toolbarId;
                const toolbar = document.getElementById(toolbarId);
                if (toolbar) toolbar.style.display = toolbar.style.display === 'none' ? 'block' : 'none';
                return;
            }
            if (e.target.closest('.delete-btn')) {
                if (confirm("Supprimer cette affirmation ?")) {
                    e.target.closest('.math-question-card').remove();
                    updateGenerateButtonCallback();
                }
                return;
            }
        });
    }

    setTimeout(() => {
        const genSection = document.getElementById('generate-section');
        if (genSection && document.querySelectorAll('#statements-list .math-question-card').length === 0) {
            genSection.style.display = 'none';
        }
    }, 10);
}

// ✅ NOUVELLE FONCTION DE RENDU
function renderRepartitionConfigTFMath(selectedDocs) {
    const repContainer = container.querySelector('#tf-math-questions-repartition');
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
                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Répartition des affirmations mathématiques à générer</span>
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


/**
 * Nettoie le LaTeX pour l'affichage final (Moodle/H5P).
 * Supprime les \text{} inutiles pour éviter les problèmes de rendu.
 */
function optimiserPourMoodle(latex) {
    if (!latex) return '';
    let s = latex;
    
    // 1. Nettoyage esthétique standard
    s = s.replace(/\\mathcal\s*\{([A-Z])\}/g, '$1'); 
    
    // 2. Suppression des wrappers \text{} et \mbox{} imbriqués ou inutiles
    let oldS = '';
    while (s !== oldS) {
        oldS = s;
        s = s.replace(/\\text\{([^{}]*)\}/g, '$1'); 
        s = s.replace(/\\mbox\{([^{}]*)\}/g, '$1');
    }

    return s;
}

/**
 * Initialise la prévisualisation MathJax pour un champ donné.
 */
function setupMathPreview(fid) {
    const el = document.getElementById(fid);
    const prev = document.getElementById(`${fid}-preview`);
    if(!el || !prev) return;

    const render = () => {
        const val = el.value.trim();
        if (!val) {
            prev.innerHTML = '';
            return;
        }

        let safeVal = optimiserPourMoodle(val);
        safeVal = safeVal.replace(/\n/g, '<br>');
        prev.innerHTML = safeVal;

        if (window.MathJax) {
            if (MathJax.typesetPromise) {
                MathJax.typesetClear([prev]);
                MathJax.typesetPromise([prev]);
            } else if (MathJax.Hub) {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, prev]);
            }
        }
        if (typeof updateGenerateButtonCallback === 'function') updateGenerateButtonCallback();
    };

    el.addEventListener('input', render);
    // Premier rendu différé
    setTimeout(render, 300);
}

async function handlePreparePrompt() { 
    const btn = document.getElementById('btn-prepare-prompt-tf-math') || document.querySelector('[id^="btn-prepare-prompt"]');
    if (!btn) return;

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

    const success = await preparerAssistantIA_TrueFalseMath(repartitionMap); 
    
    if (success) {
        // 🟢 NOUVEAU : On cache le conteneur parent de manière sécurisée
        if (btn.parentElement) {
            btn.parentElement.style.display = 'none';
        }

        const iaContainer = document.getElementById('ia-container-tf-math') || document.querySelector('[id^="ia-container"]');
        if (iaContainer) {
            iaContainer.style.display = 'block';
            const promptArea = document.getElementById('ia-prompt-tf-math') || document.querySelector('[id^="ia-prompt"]');
            if (promptArea) {
                promptArea.removeAttribute('readonly'); 
                promptArea.disabled = false;
                promptArea.style.backgroundColor = 'var(--field-bg)'; 
                promptArea.style.border = '2px solid var(--hapi-green)';
            }
        }
        
        const albertAction = document.getElementById('albert-action-tf-math') || document.querySelector('[id^="albert-action"]');
        if (albertAction) albertAction.style.display = 'block';

        setTimeout(() => {
            if (iaContainer) iaContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
    
    // 🟢 On réinitialise l'état
    btn.disabled = false;
    btn.innerHTML = originalText;
}

async function handleGenerateAlbert() {
    const btn = container.querySelector('#btn-send-albert-tf-math');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "L'IA génère les affirmations...";

    await callAlbertAPI('ia-prompt-tf-math', 'ia-response-tf-math', 'btn-parse-ia-response-tf-math', btn);

    btn.innerHTML = originalText;
    btn.disabled = false;
}


function handleParseIA() {
    let reponseBrute = document.getElementById('ia-response-tf-math').value;
    reponseBrute = reponseBrute.replace(/[\r\n]+/g, ' '); 

    const statementsData = parserReponseIA_MathJSON(reponseBrute); 
    
    if (!statementsData) return;

    const previewContainer = document.getElementById('statements-list');
    previewContainer.innerHTML = '';
    statementCounter = 0;
    
    statementsData.forEach(data => {
        const rawStatement = data.statement_latex || data.question_latex;

        if (rawStatement !== undefined && typeof data.is_true === 'boolean') {
            // Nettoyage initial du LaTeX venant de l'IA
            const cleanStatement = rawStatement
                .replace(/\\begin\{aligned\}/g, '') 
                .replace(/\\end\{aligned\}/g, '')   
                .replace(/&/g, '')                  
                .replace(/\\\\/g, '\n'); // Important: transformer les sauts de ligne LaTeX en sauts réels pour le textarea

            const cardData = {
                statement: cleanStatement,
                isTrue: data.is_true
            };
            addTrueFalseStatementCard(cardData);
        }
    });
    
    if (statementsData.length > 0) {
        updateGenerateButtonCallback();

        const stmtContainer = document.getElementById('statements-container');
        if (stmtContainer) {
            stmtContainer.style.display = 'block';
            stmtContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        const genSection = document.getElementById('generate-section');
        if (genSection) genSection.style.display = 'block';
    }
}

function addTrueFalseStatementCard(data = {}) {
    statementCounter++;
    const statementId = `${cardPrefix}${statementCounter}`;
    const container = document.getElementById('statements-list');
    
    const textId = `${statementId}-text`;
    const toolbarId = `tb-${textId}`;
    
    const isTrueChecked = (data.isTrue === true) ? 'checked' : '';
    const isFalseChecked = (data.isTrue === false) ? 'checked' : '';
    const content = data.statement || '';

    // Génération du HTML de la barre d'outils
    const toolbarHTML = MathEditor.createMathToolbar(textId);

    const card = document.createElement('div');
    card.className = 'math-question-card';
    card.id = statementId;
    card.style.background = 'var(--surface)';
    card.style.padding = '20px';
    card.style.marginBottom = '20px';
    card.style.borderRadius = '8px';
    card.style.border = '1px solid #e2e8f0';

    card.innerHTML = `
        <button class="delete-btn" style="float:right; background:none; border:none; font-size:1.2em; cursor:pointer;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
        <h4 style="margin-top:0;">Affirmation ${statementCounter}</h4>
        
        <div class="input-group">
            <label style="display:block; font-weight:bold; margin-bottom:5px;">Énoncé de l'affirmation :</label>
            
            <div class="math-controls" style="margin-bottom: 5px;">
                 <button class="btn btn-sm btn-outline-secondary btn-toggle-toolbar" data-toolbar-id="${toolbarId}" style="font-size:0.8em; padding:2px 8px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/></svg> Outils Latex</button>
            </div>
            
            <div id="${toolbarId}" style="display:none; background:var(--page-bg); padding:5px; border:1px solid var(--border); border-bottom:none;">${toolbarHTML}</div>
            
            <textarea id="${textId}" class="tf-math-text" rows="3" style="width:100%; padding:10px;">${content}</textarea>
            
            <div id="${textId}-preview" class="math-preview-box" style="margin-top:5px; background:var(--page-bg); padding:10px; border:1px solid var(--border); min-height:40px; white-space: pre-wrap; word-break: break-word;"></div>
        </div>
        
        <div class="input-group" style="margin-top:15px;">
            <label style="font-weight:bold;">La réponse attendue est :</label>
            <div style="display: flex; gap: 20px; margin-top: 10px; font-size:1.1em;">
                <label style="cursor:pointer;"><input type="radio" name="${statementId}-answer" value="true" ${isTrueChecked}> <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> VRAI</label>
                <label style="cursor:pointer;"><input type="radio" name="${statementId}-answer" value="false" ${isFalseChecked}> ✕ FAUX</label>
            </div>
        </div>
         
        <div style="border-top: 1px solid var(--border); padding-top: 15px; margin-top: 15px;">
            <h5 style="margin-bottom:10px; font-size:0.9em; color:var(--text-muted);">Feedback (optionnel)</h5>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="input-group">
                    <label for="${statementId}-feedback-correct" style="font-size:0.9em;">Si CORRECTE :</label>
                    <textarea id="${statementId}-feedback-correct" class="tf-feedback-correct-math" rows="2" style="background-color: rgba(34, 197, 94, 0.16); width:100%; border:1px solid #c3e6cb;"></textarea>
                </div>
                <div class="input-group">
                    <label for="${statementId}-feedback-incorrect" style="font-size:0.9em;">Si INCORRECTE :</label>
                    <textarea id="${statementId}-feedback-incorrect" class="tf-feedback-incorrect-math" rows="2" style="background-color: rgba(220, 38, 38, 0.15); width:100%; border:1px solid #f5c6cb;"></textarea>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(card);
    
    // Activer la prévisualisation sur ce nouveau champ
    setupMathPreview(textId);
}

function showRegenerateButton() {
    const iaContainer = document.getElementById('ia-container-tf-math') || document.querySelector('[id^="ia-container"]');
    const btnPrepare = document.getElementById('btn-prepare-prompt-tf-math') || document.querySelector('[id^="btn-prepare-prompt"]');

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
// 💾 GESTION IMPORT / EXPORT (déléguée à utils/states/truefalse-math-state.js)
// =========================================================

export function getUIState() {
    return getTrueFalseMathState();
}

export function setUIState(config) {
    setTrueFalseMathState(config, {
        clearPreview: () => {
            document.getElementById('statements-list').innerHTML = '';
            statementCounter = 0; // Remise à zéro du compteur spécifique de ce module
        },
        addCard: addTrueFalseStatementCard, 
        updateBtn: updateGenerateButtonCallback
    });
}


export function gatherData() {
    logger.log('📊 Collecte des données du Vrai/Faux Math (Optimisé)...');

    // 1. Récupération de la langue (défaut Français si non spécifié, mais on utilise le helper)
    const localizationParams = getH5PLocalization('Français', 'TrueFalse');
    
    // Patch pour le score (comme dans les autres fichiers)
    if (localizationParams && localizationParams.score) {
        localizationParams.score = localizationParams.score
            .replace(':num', '@score')
            .replace(':total', '@total');
        localizationParams.scoreBarLabel = localizationParams.score;
    }

	const donnees = {
	        titre: document.getElementById('truefalse-math-title').value,
	        // NOUVEAU : parseInt pour le pourcentage
	        passPercentage: parseInt(document.getElementById('tf-math-passPercentage')?.value || "50", 10),
	        feedbackFail: document.getElementById('tf-math-feedback-fail')?.value || 'Réessayez',
	        feedbackSuccess: document.getElementById('tf-math-feedback-success')?.value || 'Bravo',
        
        // Options
        disableBackwardsNavigation: document.getElementById('tf-math-disable-back')?.checked || false,
        randomQuestions: document.getElementById('tf-math-random-questions')?.checked || false,
        
		// Nouvelles options de surcharge
        showCheckButton: document.getElementById('tf-math-show-check')?.checked ?? true,
        overrideSolution: document.getElementById('tf-math-override-solution')?.value || 'default',
        overrideRetry: document.getElementById('tf-math-override-retry')?.value || 'default',
		
        questions: []
    };

    const cardSelector = '#statements-list .math-question-card';
    document.querySelectorAll(cardSelector).forEach(card => {
        const cardId = card.id;
        
        // Récupération via le Textarea (plus robuste)
        const textarea = card.querySelector('.tf-math-text');
        const rawLatex = textarea ? textarea.value.trim() : '';
        
        const correctValue = card.querySelector(`input[name="${cardId}-answer"]:checked`)?.value;
        
        if (!rawLatex || !correctValue) return; 

        // Nettoyage Final pour H5P
        const safeLatex = optimiserPourMoodle(rawLatex);
        
        // Transformation des sauts de ligne en <br> pour l'affichage HTML
        const questionHtml = safeLatex.replace(/\n/g, '<br>');

        const feedbackCorrect = card.querySelector('.tf-feedback-correct-math').value.trim();
        const feedbackWrong = card.querySelector('.tf-feedback-incorrect-math').value.trim();
        
        donnees.questions.push({
            "params": {
                "question": questionHtml,
                "correct": correctValue,
                "behaviour": {
                    "enableSolutionsButton": true,
                    "enableRetry": true,
                    "feedbackOnCorrect": feedbackCorrect,
                    "feedbackOnWrong": feedbackWrong
                },
                "l10n": localizationParams 
            },
            "library": getFullLibraryString("H5P.TrueFalse"),
            "subContentId": crypto.randomUUID(),
            "metadata": { "title": "Vrai/Faux Math" }
        });
    });

    if (donnees.questions.length === 0) {
        logger.error("Aucune affirmation V/F Math valide à générer.");
        alert("Aucune affirmation mathématique complète n'a été trouvée.");
        return null;
    }
    return donnees;
}