// Fichier: modules/ui/markthewords-ui.js

import { logger } from '../utils/logger.js';
import { creerAssistantIA_HTML, creerFeedbackIntervallesHTML, initFeedbackIntervalles, getFeedbackIntervallesData, setFeedbackIntervallesData, renderRepartitionSources, construireBlocsSources } from '../utils/helpers.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { preparerAssistantIA_MarkWords } from '../ia/prompt-builder.js';
import { getH5PLocalization } from '../utils/h5p-translations.js';
import { getMarkTheWordsState, setMarkTheWordsState } from '../utils/states/markthewords-state.js';
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
    
    logger.log('🔧 Initialisation de Repérer les Mots UI (avec IA Combinée)...');

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
        <div id="markthewords-generator-wrapper">
            
            <div class="section" style="background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                
                <div id="mark-source-selector"></div>
                <div id="markthewords-questions-repartition"></div>

                <h2 style="margin:0 0 15px 0;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configuration de l'activité</h2>
                
                <div style="display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 25px;">
                    <div class="input-group" style="margin :0 0;">
                        <label for="markthewords-title" style="font-weight:bold; display:block; margin-bottom:6px;">Titre de l'activité :</label>
                        <input type="text" id="markthewords-title" value="Repérer les mots" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div class="input-group" style="margin :0 0;">
                        <label for="markTask" style="font-weight:bold; display:block; margin-bottom:6px;">Consigne pour l'élève :</label>
                        <input type="text" id="markTask" value="Clique sur tous les mots corrects dans le texte." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                </div>

                <div style="background: var(--hapi-green-mist); border: 1px solid var(--border-strong); padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                    <h3 style="margin-top:0; color: var(--hapi-accent-text); font-size:1.1em; margin-bottom:15px; display:flex; align-items:center; gap:8px;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Règles d'extraction par l'IA (combinaisons possibles)
                    </h3>
                    <p style="font-size:0.9em; color: var(--hapi-accent-text); margin-bottom:20px;">Définissez une ou plusieurs règles pour indiquer à l'IA quels mots transformer en éléments cliquables.</p>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; margin-bottom: 8px; padding-right: 4px;">
                        <div style="font-weight:bold; font-size: 0.95em; color: var(--hapi-accent-text);">Tâche(s) pour l'IA :</div>
                        <div style="font-weight:bold; font-size: 0.95em; color: var(--hapi-accent-text);">Exemple(s) placé(s) entre astérisques :</div>
                        <div style="width: 38px;"></div> </div>

                    <div id="markthewords-rules-container">
                        <div class="markthewords-rule-item" style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; align-items: center;">
                            <input type="text" class="mtw-rule-task" placeholder="ex: verbes à l'infinitif" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:5px;">
                            <input type="text" class="mtw-rule-example" placeholder="ex: *manger*" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:5px;">
                            <button type="button" class="btn btn-remove-rule" style="background:transparent; border:none; color:var(--text); padding:9px 12px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition: opacity 0.2s;" title="Effacer les champs de cette ligne"><svg class="ico" style="width:1.35em;height:1.35em;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
                        </div>
                    </div>

                    <button id="btn-add-markthewords-rule" type="button" class="btn" style="background:var(--hapi-green-dark); color:white; border:none; padding:8px 16px; border-radius:25px; cursor:pointer; font-weight:bold; margin-top: 5px; margin-bottom: 20px; font-size: 0.9em; transition: background 0.2s;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Ajouter une règle
                    </button>

                    <textarea id="markthewordsTexteSource" style="display:none;">${corpus}</textarea>

                    <div style="text-align: center; margin-top: 10px;">
                        <button id="prepare-ia-btn-mark" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt
                        </button>
                    </div>
                </div>

                <div id="markthewords-ia-section" class="section" style="display: none; background: var(--surface); border-radius: 8px; padding: 12px 25px 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    ${creerAssistantIA_HTML('markthewords-ia-prompt', 'markthewords-ia-response')}
                </div>
                
                <div id="albert-action-mark" style="display: none; text-align: center; margin-top: 15px; margin-bottom: 25px;">
                    <button id="btn-send-albert-mark" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3);">
                        🇫🇷 Envoyer le prompt à l'IA
                    </button>
                </div>
                <div id="markthewords-editor-section" style="display: none; border-top: 2px solid #f0f0f0; padding-top: 20px;">
                    <h3 style="margin-top:0; color:var(--text); display:flex; justify-content:space-between; align-items:center;">
                        <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Éditez le texte final</span>
                    </h3>
                    <p style="font-size: 0.9em; color:var(--text-muted); margin-bottom: 15px;">Sélectionnez une source en haut pour importer son texte. Vous pouvez le modifier manuellement et activer la baguette magique pour surligner les mots à cliquer (*mot*).</p>
                    
                    <button class="btn" id="btn-toggle-magic-wand-mark" style="background:var(--hapi-grad-a); color:white; border:none; padding:8px 16px; border-radius:25px; cursor:pointer; margin-bottom: 15px; font-weight:bold; transition: background 0.2s;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/></svg> Activer la baguette magique</button>
                    
                    <textarea id="markTheWordsText" rows="12" placeholder="Le *mot* à cliquer." style="width:100%; padding:15px; border:2px solid var(--border); border-radius:6px; line-height: 1.5; font-family:monospace; font-size:1.05em; background:var(--page-bg); resize:vertical;">${corpus}</textarea>
                </div>

				<div class="input-group" style="display: none; margin-top: 40px;" id="markthewords-options-section">
                    <details style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px;">
                        <summary style="font-weight:bold; font-size:1.2em; color:var(--text); cursor:pointer; outline:none; list-style-position: inside;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options globales et techniques
                        </summary>
                        
                        <div style="margin-top: 20px;" id="mark-global-wrapper">
                            <style>
                                #mark-global-wrapper .section { padding: 0; box-shadow: none; border: none; background: transparent; margin: 0; }
                                #mark-global-wrapper h2 { display: none; }
                            </style>
                            
                            ${creerFeedbackIntervallesHTML('mark', '')}

                            <hr style="border:0; border-top:1px solid var(--border); margin:25px 0 20px 0;">

                            <div>
                                <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options techniques
                                </div>
								<div style="display:flex; flex-direction:column; gap:15px;">
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="translate-ui-mark" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                        <span style="font-weight:bold; font-size:1.05em; color: var(--hapi-accent-text);">Traduire les boutons H5P</span>
                                    </label>
                                    
                                    <div style="display:flex; flex-direction:column; gap:15px; margin-top: 5px;">
                                        <label style="display:flex; align-items:center; cursor:pointer;">
                                            <input type="checkbox" id="mtw-enableRetry" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                            <span style="font-weight:bold; font-size:1.05em; color:var(--text);">Activer le bouton "Recommencer"</span>
                                        </label>

                                        <label style="display:flex; align-items:center; cursor:pointer;">
                                            <input type="checkbox" id="mtw-enableSolutionsButton" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                            <span style="font-weight:bold; font-size:1.05em; color:var(--text);">Activer le bouton "Voir la solution"</span>
                                        </label>
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
	
// Initialisation du système de feedback par intervalles
    initFeedbackIntervalles('mark');
	
	
	const selectorContainer = container.querySelector('#mark-source-selector');
	    if (selectorContainer) {
	        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'mark', (selectedDocs) => {
            const hiddenSource = document.getElementById('markthewordsTexteSource');
            const finalEditor = document.getElementById('markTheWordsText');
            renderRepartitionSources(container, '#markthewords-questions-repartition', selectedDocs, currentRepartition, 'Répartition des mots à repérer par source');

            if (localSourceSelector) {
                const content = localSourceSelector.getSelectedContent();
                if (hiddenSource) hiddenSource.value = content;
            
                if (finalEditor && !finalEditor.value.includes('*')) {
                    finalEditor.value = content;
                }

                // 🟢 NOUVEAU : On affiche l'éditeur si l'utilisateur choisit une source manuellement
                const editorSection = document.getElementById('markthewords-editor-section');
                if (editorSection) editorSection.style.display = 'block';
                
                const optionsSection = document.getElementById('markthewords-options-section');
                if (optionsSection) optionsSection.style.display = 'block';
                updateGenerateButtonCallback();
				showRegenerateButton();
            }
        });
    }

// 🛡️ Écouteur global pour réafficher le bouton
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

    // 2. Écouteur sur la modification des règles d'extraction
    const rulesContainer = container.querySelector('#markthewords-rules-container');
    if (rulesContainer) {
        rulesContainer.addEventListener('input', (e) => {
            if (e.target.classList.contains('mtw-rule-task') || 
                e.target.classList.contains('mtw-rule-example')) {
                showRegenerateButton();
            }
        });
    }

    // IA Events
    document.getElementById('btn-add-markthewords-rule').addEventListener('click', addMarkTheWordsRule);
    document.getElementById('markthewords-rules-container').addEventListener('click', removeMarkTheWordsRule);
    document.getElementById('prepare-ia-btn-mark').addEventListener('click', handlePreparePrompt);
    document.getElementById('btn-send-albert-mark').addEventListener('click', handleGenerateAlbertMark);
    document.getElementById('btn-parse-markthewords-ia-response').addEventListener('click', handleParseIA);
    
    // Manuel Events
    document.getElementById('markTheWordsText').addEventListener('input', updateGenerateButtonCallback);
    document.getElementById('btn-toggle-magic-wand-mark').addEventListener('click', toggleMagicWand);
    
    // 🔴 BOUCLIER ANTI-BARRE DU BAS
    const enforceHideBottomBar = () => {
        const genSection = document.getElementById('generate-section');
        const editor = document.getElementById('markTheWordsText');
        if (genSection && editor && !editor.value.includes('*')) {
            genSection.style.display = 'none';
        }
    };

    enforceHideBottomBar();
    setTimeout(enforceHideBottomBar, 50);

    const tabBtn = document.querySelector('.tab-btn[data-tab-target="markthewords"]');
    if (tabBtn) {
        tabBtn.addEventListener('click', () => setTimeout(enforceHideBottomBar, 10));
    }
}

// ==========================================
// GESTION DES RÈGLES DYNAMIQUES
// ==========================================
function addMarkTheWordsRule() {
    const container = document.getElementById('markthewords-rules-container');
    const newRule = document.createElement('div');
    newRule.className = 'markthewords-rule-item';
    newRule.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; align-items: center; margin-bottom: 10px;';
    newRule.innerHTML = `
        <input type="text" class="mtw-rule-task" placeholder="ex: adjectifs qualificatifs" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:5px;">
        <input type="text" class="mtw-rule-example" placeholder="ex: *joli*" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:5px;">
        <button type="button" class="btn btn-remove-rule" style="background:transparent; border:none; color:var(--text); padding:9px 12px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition: opacity 0.2s;"><svg class="ico" style="width:1.35em;height:1.35em;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
    `;
    container.appendChild(newRule);
    updateRemoveButtons();
	showRegenerateButton();
}

function removeMarkTheWordsRule(e) {
    // closest() : le clic peut viser l'emoji (span) à l'intérieur du bouton, pas le bouton lui-même
    const trashBtn = e.target.closest('.btn-remove-rule');
    if (!trashBtn) return;
    const item = trashBtn.closest('.markthewords-rule-item');
    if (!item) return;
    const items = Array.from(document.querySelectorAll('.markthewords-rule-item'));
    if (items.indexOf(item) === 0) {
        // 1re ligne : on vide les champs (jamais supprimée)
        item.querySelectorAll('input').forEach(inp => { inp.value = ''; });
    } else {
        // Autres lignes : on supprime la ligne
        item.remove();
    }
    updateRemoveButtons();
    showRegenerateButton();
}

function updateRemoveButtons() {
    // 1re ligne = efface les champs ; lignes suivantes = suppriment la ligne
    document.querySelectorAll('.markthewords-rule-item').forEach((item, i) => {
        const btn = item.querySelector('.btn-remove-rule');
        if (!btn) return;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.title = i === 0 ? 'Effacer les champs de cette ligne' : 'Supprimer cette ligne';
    });
}

// ==========================================
// MÉCANIQUES IA
// ==========================================
async function handlePreparePrompt() {
    // Collecter les règles
    const ruleElements = document.querySelectorAll('.markthewords-rule-item');
    let rules = [];
    
    ruleElements.forEach(el => {
        const task = el.querySelector('.mtw-rule-task').value.trim();
        const example = el.querySelector('.mtw-rule-example').value.trim();
        if (task) {
            rules.push({ task, example });
        }
    });

    let sourceText = document.getElementById('markthewordsTexteSource').value;
    const btn = document.getElementById('prepare-ia-btn-mark');

    if (!sourceText.trim()) {
        alert("Veuillez d'abord sélectionner au moins une source de texte via les pastilles en haut.");
        return;
    }

    // Répartition multi-sources : un bloc par fichier avec son quota de mots à repérer
    const repartitionMap = {};
    container.querySelectorAll('#markthewords-questions-repartition .source-question-count').forEach(input => {
        const val = parseInt(input.value, 10);
        if (!isNaN(val) && val >= 0) repartitionMap[input.dataset.sourceId] = val;
    });
    const selectedDocs = localSourceSelector ? localSourceSelector.getSelectedSourceObjects() : [];
    const blocs = construireBlocsSources(selectedDocs, repartitionMap, 'MARQUE EXACTEMENT {n} mot(s) ou groupe(s) de mots dans ce bloc.');
    if (blocs) sourceText = blocs;
    
    if (rules.length === 0) {
        alert("Veuillez renseigner au moins une tâche pour l'IA.");
        return;
    }
    
// Forcez le texte de base
    const originalText = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt';
    btn.disabled = true;
    btn.innerHTML = 'Analyse...';

	const promptSuccess = await preparerAssistantIA_MarkWords(rules, sourceText); 
	    if (promptSuccess) {
	        // 🟢 NOUVEAU : On cache le conteneur parent du bouton après le succès
	        if (btn.parentElement) {
	            btn.parentElement.style.display = 'none';
	        }

	        const iaContainer = document.getElementById('markthewords-ia-section');
	        if (iaContainer) {
	            iaContainer.style.display = 'block';
            
	            const promptArea = document.getElementById('markthewords-ia-prompt');
	            if (promptArea) {
	                promptArea.removeAttribute('readonly'); 
	                promptArea.disabled = false;
	                promptArea.style.backgroundColor = 'var(--field-bg)'; 
	            }
            
	            const albertAction = document.getElementById('albert-action-mark');
	            if (albertAction) albertAction.style.display = 'block';

	            setTimeout(() => {
	                iaContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
	            }, 100);
	        }
	    }

		btn.innerHTML = originalText;
		btn.disabled = false;
}

// 🟢 Envoyer à Albert
async function handleGenerateAlbertMark() {
    const btn = document.getElementById('btn-send-albert-mark');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "L'IA modifie le texte...";

    await callAlbertAPI('markthewords-ia-prompt', 'markthewords-ia-response', 'btn-parse-markthewords-ia-response', btn);

    btn.innerHTML = originalText;
    btn.disabled = false;
}

// Balise chaque occurrence des mots cibles dans le texte au format H5P *mot*.
// Marquage côté client = exhaustif et insensible au strip markdown de n8n.
function markTargetWords(text, words) {
    if (!Array.isArray(words) || words.length === 0) return text;
    // Nettoie, déduplique, et traite les plus longs d'abord (priorité aux groupes de mots)
    const uniq = [...new Set(
        words.map(w => String(w).replace(/[\[\]*]/g, '').trim()).filter(Boolean)
    )].sort((a, b) => b.length - a.length);
    if (uniq.length === 0) return text;

    const escaped = uniq.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    let re;
    try {
        // Frontières Unicode (lettres/chiffres accentués) ; on exclut * pour ne pas re-baliser
        re = new RegExp('(?<![\\p{L}\\p{N}_*])(' + escaped.join('|') + ')(?![\\p{L}\\p{N}_*])', 'gu');
    } catch (e) {
        // Repli pour moteurs sans lookbehind/Unicode
        re = new RegExp('(' + escaped.join('|') + ')', 'g');
    }
    // H5P MarkTheWords ne rend cliquable qu'un token *mot* délimité par des espaces.
    // Sur un mot élidé, le balisage donne « l'*eau* » (collé à l'apostrophe) : H5P
    // ne le reconnaît plus et affiche les astérisques en littéral. On insère donc
    // une espace après l'apostrophe (droite ' ou typographique ’) → « l' *eau* ».
    return text.replace(re, '*$1*').replace(/(['’])\*/g, '$1 *');
}

function handleParseIA() {
    const responseArea = document.getElementById('markthewords-ia-response');
    if (!responseArea || !responseArea.value.trim()) return;

    let cleanResponse = responseArea.value.replace(/^\s*=+/, '').replace(/```(markdown|txt|text)?/g, '').replace(/```/g, '').trim();

    // Format « MOTS: ... / TEXTE: ... » : on récupère la liste et le texte nu,
    // puis on balise côté client (robuste, exhaustif, immunisé au strip n8n).
    const motsMatch = cleanResponse.match(/^[\s>*-]*MOTS\s*:(.*)$/im);
    const texteMatch = cleanResponse.match(/^[\s>*-]*TEXTE\s*:/im);

    if (motsMatch && texteMatch) {
        const words = motsMatch[1].split('|').map(w => w.trim()).filter(Boolean);
        let texte = cleanResponse.slice(texteMatch.index + texteMatch[0].length).trim();
        // Filet de sécurité : si l'IA a quand même inséré des crochets, les convertir
        texte = texte.replace(/\[([^\[\]\n]+)\]/g, '$1');
        cleanResponse = markTargetWords(texte, words);
    } else {
        // Repli legacy : ancien protocole [mot] → *mot* (et astérisques déjà présentes conservées)
        cleanResponse = cleanResponse.replace(/\[([^\[\]\n]+)\]/g, '*$1*');
    }

    document.getElementById('markTheWordsText').value = cleanResponse;
    
    updateGenerateButtonCallback();
    
   // 🟢 On affiche l'éditeur une fois qu'Albert a répondu
    const editorSection = document.getElementById('markthewords-editor-section');
    if (editorSection) {
        editorSection.style.display = 'block';
        editorSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // 🟢 On affiche aussi les options globales
    const optionsSection = document.getElementById('markthewords-options-section');
    if (optionsSection) optionsSection.style.display = 'block';
	
    const genSection = document.getElementById('generate-section');
    if (genSection) genSection.style.display = 'block';
}

// ==========================================
// OUTILS MANUELS
// ==========================================
function toggleMagicWand(event) {
    const button = event.target;
    const textarea = document.getElementById('markTheWordsText');
    const isActive = button.classList.toggle('magic-wand-active');
    textarea.classList.toggle('magic-wand-enabled', isActive);
    
    if (isActive) {
        button.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/></svg> Baguette magique activée (surlignez les mots)';
        button.style.background = 'var(--hapi-grad-a)';
        textarea.addEventListener('mouseup', handleSelection);
        logger.log(`🪄 Baguette Magique activée.`);
    } else {
        button.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/></svg> Activer la baguette magique';
        button.style.background = 'var(--hapi-grad-a)';
        textarea.removeEventListener('mouseup', handleSelection);
        logger.log(`🪄 Baguette Magique désactivée.`);
    }
}

function handleSelection(event) {
    const textarea = event.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) return;

    let text = textarea.value;
    const selectedText = text.substring(start, end);
    const isWrapped = text[start - 1] === '*' && text[end] === '*';
    
    let newText, newCursorPos;

    if (isWrapped) { 
        newText = text.substring(0, start - 1) + selectedText + text.substring(end + 1);
        newCursorPos = start + selectedText.length - 1;
    } else { 
        newText = text.substring(0, start) + '*' + selectedText + '*' + text.substring(end);
        newCursorPos = start + selectedText.length + 2;
    }
    textarea.value = newText;
    textarea.focus();
    setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = newCursorPos; }, 0);
    
    updateGenerateButtonCallback();
}

function showRegenerateButton() {
    // 🟢 FIX : L'ID correct est 'markthewords-ia-section'
    const iaContainer = document.getElementById('markthewords-ia-section');
    const btnPrepare = document.getElementById('prepare-ia-btn-mark');

    if (iaContainer && iaContainer.style.display === 'block') {
        if (btnPrepare) {
            if (btnPrepare.parentElement) btnPrepare.parentElement.style.display = 'block'; 
            btnPrepare.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg> Régénérer le prompt';
            btnPrepare.style.background = 'linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark))';
            btnPrepare.style.boxShadow = '0 4px 15px rgba(var(--hapi-green-rgb), 0.3)';
        }
    }
}

export function getUIState() {
    return getMarkTheWordsState();
}

export function setUIState(config) {
    setMarkTheWordsState(config, {
        updateBtn: updateGenerateButtonCallback
    });
    if (config.overallFeedback) {
        setFeedbackIntervallesData('mark', config.overallFeedback);
    }
}

export function gatherData() {
    logger.log('📊 Collecte des données Mark the Words...');
    
    const texte = document.getElementById('markTheWordsText').value;
    
    if (!texte || !texte.includes('*')) {
        alert("Le texte est vide ou ne contient aucun mot sélectionné (avec des *).");
        return null;
    }

    // 🟢 Langue et Niveau globaux
    const langSelect = document.getElementById('global-language');
    const lang = langSelect ? langSelect.value : 'Français';
    
    const niveauSelect = document.getElementById('global-niveau');
    const niveau = niveauSelect ? niveauSelect.value : 'Cycle 2';

    const shouldTranslateUI = document.getElementById('translate-ui-mark')?.checked;
    const uiLanguage = shouldTranslateUI ? lang : 'Français';
    const localizationParams = getH5PLocalization(uiLanguage, 'MarkTheWords');

	return {
	        titre: document.getElementById('markthewords-title').value,
	        niveau: niveau,
	        consignes: document.getElementById('markTask').value,
	        texte: texte,
	        overallFeedback: getFeedbackIntervallesData('mark'),
	        comportement: {
	            enableRetry: document.getElementById('mtw-enableRetry').checked,
	            enableSolutionsButton: document.getElementById('mtw-enableSolutionsButton').checked
	        },
	        l10n: localizationParams
	    };
}