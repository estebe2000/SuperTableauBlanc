// Fichier: modules/ui/advanced-blanks-ui.js

import { logger } from '../utils/logger.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { SourceSelector } from './source-selector.js';
import { creerAssistantIA_HTML, creerFeedbackIntervallesHTML, initFeedbackIntervalles, getFeedbackIntervallesData, setFeedbackIntervallesData, renderRepartitionSources, construireBlocsSources } from '../utils/helpers.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_AdvancedBlanks } from '../ia/prompt-builder.js';
import { getAdvancedBlanksState, setAdvancedBlanksState } from '../utils/states/advanced-blanks-state.js';

let localSourceSelector = null;
let container = null;
let corpus = '';
let updateGenerateButtonCallback = () => {};
let currentRepartition = {};

export function init(targetContainer, corpusContent, updateBtnCallback) {
    container = targetContainer;
    corpus = corpusContent;
    updateGenerateButtonCallback = updateBtnCallback;
    
    logger.log('🔧 Initialisation de Textes à trous UI (Éditeur Visuel)...');
    
    const rawSources = corpusManager.getCorpusSources();
    const documentsList = [
        { id: 'all', title: 'Tout le corpus (Hybride)', content: corpusContent, type: 'all', priority: 2 },
        ...rawSources.map(s => ({
            id: s.id, title: s.name, content: s.data || s.content || corpusContent,
            type: s.type, priority: s.priority !== undefined ? s.priority : 2
        }))
    ];

    const html = `
        <div id="advanced-blanks-generator-wrapper">
            <div class="section" style="background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                
                <div id="advanced-blanks-source-selector"></div>
                <div id="ab-questions-repartition"></div>

                <h2 style="margin:0 0 15px 0;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configurez l'activité</h2>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                    <div class="input-group">
                        <label for="advanced-blanks-title" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Titre de l'activité :</label>
                        <input type="text" id="advanced-blanks-title" value="Texte à trous" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div class="input-group">
                        <label for="advanced-blanks-task-display" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Consigne pour l'élève :</label>
                        <input type="text" id="advanced-blanks-task-display" value="Complétez les trous présents dans le texte." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                </div>

                <div style="background: var(--hapi-green-mist); border: 1px solid var(--border-strong); padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                    <h3 style="margin-top:0; color: var(--hapi-accent-text); font-size:1.1em; margin-bottom:15px; display:flex; align-items:center; gap:8px;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Règles d'extraction par l'IA (combinaisons possibles)
                    </h3>
                    <p style="font-size:0.9em; color: var(--hapi-accent-text); margin-bottom:20px;">Définissez les critères. L'IA générera des feedbacks pour les erreurs courantes.</p>
                    
                    <div id="ab-rules-container">
                        <div class="ab-rule-item" style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; align-items: center;">
                            <input type="text" class="ab-rule-task" placeholder="ex: verbes au passé composé" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:5px;">
                            <input type="text" class="ab-rule-example" placeholder="ex: *ont marché*" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:5px;">
                            <button type="button" class="btn btn-remove-ab-rule" style="background:transparent; color:var(--text); border:none; padding:9px 12px; border-radius:6px; cursor:pointer;" title="Effacer les champs de cette ligne"><svg class="ico" style="width:1.35em;height:1.35em;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
                        </div>
                    </div>

                    <button id="btn-add-ab-rule" type="button" class="btn" style="background:var(--hapi-green-dark); color:white; border:none; padding:8px 16px; border-radius:25px; cursor:pointer; font-weight:bold; margin-bottom: 20px; font-size: 0.9em; transition: background 0.2s;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Ajouter une règle
                    </button>

                    <textarea id="abTexteSource" style="display:none;">${corpus}</textarea>

                    <div style="text-align: center; margin-top: 10px;">
                        <button id="prepare-ia-btn-advanced-blanks" class="btn" style="padding: 10px 30px; font-size: 1.05em; font-weight:600; background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3);">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt
                        </button>
                    </div>
                </div>

                <div id="advanced-blanks-ia-section" class="section" style="display: none; background: var(--surface); border-radius: 8px; padding: 12px 25px 25px;">
                    ${creerAssistantIA_HTML('ia-prompt-advanced-blanks', 'advanced-blanks-ia-response')}
                    
                    <div id="albert-action-advanced-blanks" style="text-align: center; margin-top: 15px;">
                        <button id="btn-send-albert-advanced-blanks" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3);">
                            🇫🇷 Envoyer le prompt à l'IA
                        </button>
                    </div>
                </div>

                <div id="advanced-blanks-editor-section" style="display: none; border-top: 2px solid #f0f0f0; padding-top: 20px; margin-top: 25px;">
                    <h3 style="margin-top:0; color:var(--text); margin-bottom: 20px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Éditez l'exercice</h3>
                    
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                        <label style="font-weight:bold; display:block; margin-bottom:5px; color:var(--text); font-size:1.1em;">1. Le Texte à trous</label>
                        <p style="font-size: 0.9em; color: var(--text-muted); margin-bottom: 10px;">Écrivez votre texte puis activez la baguette magique pour surligner les mots à transformer en trous (<code>___________</code>).</p>
                        
                        <button type="button" class="btn" id="ab-btn-magic" style="margin-bottom: 15px; background: var(--hapi-grad-a); color: white; border: none; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:0.95em; font-weight:bold; transition: all 0.2s;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/></svg> Activer la baguette magique
                        </button>
                        
                        <textarea id="ab-text-editor" rows="6" style="width:100%; padding:15px; border:2px solid var(--border); border-radius:6px; font-family:monospace; font-size:1.05em; background:var(--page-bg); resize: vertical; line-height: 1.5;"></textarea>
                    </div>

                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px;">
                        <label style="font-weight:bold; display:block; margin-bottom:15px; color:var(--text); font-size:1.1em;">2. Les Réponses et feedbacks</label>
                        <p style="font-size:0.85em; color:var(--text-muted); margin-bottom: 15px;">Les cartes ci-dessous correspondent aux trous du texte dans l'ordre d'apparition.</p>
                        <div id="ab-blanks-editor-list" style="display: flex; flex-direction: column; gap: 15px;">
                        </div>
                    </div>
                </div>

<div class="input-group" id="advanced-blanks-options-section" style="display: none; margin-top: 40px;">
                    <details style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px;">
                        <summary style="font-weight:bold; font-size:1.2em; color:var(--text); cursor:pointer; outline:none; list-style-position: inside;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options globales
                        </summary>
                        
                        <div style="margin-top: 20px;" id="advanced-blanks-global-wrapper">
                            <style>
                                #advanced-blanks-global-wrapper .section { padding: 0; box-shadow: none; border: none; background: transparent; margin: 0; }
                                #advanced-blanks-global-wrapper h2 { display: none; }
                            </style>
                            
                            ${creerFeedbackIntervallesHTML('advanced-blanks', '')}

                            <hr style="border:0; border-top:1px solid var(--border); margin:25px 0 20px 0;">

                            <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px;">
                                <div>
                                    <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options du texte à trous
                                    </div>
                                    
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; margin-top: 15px;">
                                        <div class="input-group" style="margin: 0;">
                                            <label style="font-weight:bold; display:block; margin-bottom:5px; color:var(--text); font-size:0.95em;">Mode de réponse</label>
                                            <select id="ab-mode" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:4px;">
                                                <option value="selection">Sélection dans un menu déroulant</option>
                                                <option value="typing" selected>Saisie au clavier</option>
                                            </select>
                                        </div>
                                        
                                        <div class="input-group" style="margin: 0;">
                                            <label style="font-weight:bold; display:block; margin-bottom:5px; color:var(--text); font-size:0.95em;">Tolérance orthographique</label>
                                            <select id="ab-spelling" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:4px;">
                                                <option value="accept">Accepter les fautes mineures</option>
                                                <option value="warn">Avertir l'utilisateur</option>
                                                <option value="mistake" selected>Considérer comme faux</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div style="display:flex; flex-direction:column; gap:15px; margin-bottom: 25px;">
                                        <label style="display:flex; align-items:center; cursor:pointer;">
                                            <input type="checkbox" id="ab-caseSensitive" style="margin-right:12px; width: 16px; height: 16px;">
                                            <span style="font-size:1.05em; color:var(--text);">Sensible à la casse</span>
                                        </label>
                                        <label style="display:flex; align-items:center; cursor:pointer;">
                                            <input type="checkbox" id="ab-autoCheck" style="margin-right:12px; width: 16px; height: 16px;">
                                            <span style="font-size:1.05em; color:var(--text);">Vérifier les réponses instantanément dès la saisie</span>
                                        </label>
                                    </div>
                                    
                                    <hr style="border:0; border-top:1px solid var(--border); margin:20px 0;">
                                    
                                    <div style="display:flex; flex-direction:column; gap:20px;">
                                        <label style="display:flex; align-items:center; cursor:pointer;">
                                            <input type="checkbox" id="translate-ui-advanced-blanks" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                            <span style="font-weight:bold; font-size:1.05em; color: var(--hapi-accent-text);">Traduire les boutons H5P</span>
                                        </label>

                                        <div style="display:flex; flex-direction:column; gap:15px; margin-top: 5px;">
                                            
                                            <label style="display:flex; align-items:center; cursor:pointer;">
                                                <input type="checkbox" id="ab-enableCheckButton" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                                <span style="font-weight:bold; font-size:1.05em; color:var(--text);">Activer le bouton "Vérifier"</span>
                                            </label>
                                            <label style="display:flex; align-items:center; cursor:pointer; margin-left: 30px;">
                                                <input type="checkbox" id="ab-confirmCheckDialog" style="margin-right:12px; width: 16px; height: 16px;">
                                                <span style="font-size:1em; color:var(--text-muted);">Afficher la fenêtre de confirmation pour "Vérifier"</span>
                                            </label>

                                            <label style="display:flex; align-items:center; cursor:pointer; margin-top: 10px;">
                                                <input type="checkbox" id="ab-enableSolutionsButton" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                                <span style="font-weight:bold; font-size:1.05em; color:var(--text);">Activer le bouton "Voir la correction"</span>
                                            </label>
                                            <label style="display:flex; align-items:center; cursor:pointer; margin-left: 30px;">
                                                <input type="checkbox" id="ab-showSolutionsRequiresInput" checked style="margin-right:12px; width: 16px; height: 16px;">
                                                <span style="font-size:1em; color:var(--text-muted);">Obliger l'utilisateur à remplir tous les blancs avant de voir la correction</span>
                                            </label>

                                            <label style="display:flex; align-items:center; cursor:pointer; margin-top: 10px;">
                                                <input type="checkbox" id="ab-enableRetry" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                                <span style="font-weight:bold; font-size:1.05em; color:var(--text);">Activer le bouton "Recommencer"</span>
                                            </label>
                                            <label style="display:flex; align-items:center; cursor:pointer; margin-left: 30px;">
                                                <input type="checkbox" id="ab-confirmRetryDialog" style="margin-right:12px; width: 16px; height: 16px;">
                                                <span style="font-size:1em; color:var(--text-muted);">Afficher la fenêtre de confirmation pour "Recommencer"</span>
                                            </label>

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

    // Helpers
    //const globalOptionsSection = container.querySelector('#final-options-section-advanced-blanks');
    //if (globalOptionsSection) globalOptionsSection.addEventListener('click', handleHelpersClick);
	
// Initialisation du système de feedback par intervalles
    initFeedbackIntervalles('advanced-blanks');

	
// 1. Source Selector (avec écouteur intégré)
	const selectorContainer = container.querySelector('#advanced-blanks-source-selector');
	    if (selectorContainer) {
	        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'advanced-blanks', (selectedDocs) => {
	            const hiddenSource = document.getElementById('abTexteSource');
	            renderRepartitionSources(container, '#ab-questions-repartition', selectedDocs, currentRepartition, 'Répartition des trous par source');
	            if (localSourceSelector && hiddenSource) {
	                hiddenSource.value = localSourceSelector.getSelectedContent();
	                showRegenerateButton(); // 🔄 Relance si la source change
	            }
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

	    // 2. Écouteur sur la modification des règles IA existantes
	    const rulesContainer = container.querySelector('#ab-rules-container');
	    if (rulesContainer) {
	        rulesContainer.addEventListener('input', showRegenerateButton);
	    }

    // Événements Règles
    document.getElementById('btn-add-ab-rule').addEventListener('click', addRule);
    document.getElementById('ab-rules-container').addEventListener('click', removeRule);

    // Événements IA
    document.getElementById('prepare-ia-btn-advanced-blanks').addEventListener('click', handlePreparePrompt);
    document.getElementById('btn-send-albert-advanced-blanks').addEventListener('click', handleGenerateAlbert);
    document.getElementById('btn-parse-advanced-blanks-ia-response').addEventListener('click', handleParseResponse);
    
    // Événement Baguette Magique (Mode Toggle)
    document.getElementById('ab-btn-magic').addEventListener('click', toggleMagicWand);

    // Déclencheur du bouton Générer
    document.getElementById('ab-text-editor').addEventListener('input', updateGenerateButtonCallback);
    document.getElementById('ab-blanks-editor-list').addEventListener('input', updateGenerateButtonCallback);
}

// ==========================================
// LOGIQUE BAGUETTE MAGIQUE (SÉLECTION MANUELLE TOGGLE)
// ==========================================
function toggleMagicWand(event) {
    const button = event.target;
    const textarea = document.getElementById('ab-text-editor'); 
    const isActive = button.classList.toggle('magic-wand-active');
    textarea.classList.toggle('magic-wand-enabled', isActive);
    
    if (isActive) {
        button.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/></svg> Baguette magique activée (surlignez les mots)';
        button.style.background = 'var(--hapi-grad-a)'; // Passe en vert quand actif
        textarea.addEventListener('mouseup', handleSelection);
        logger.log(`🪄 Baguette Magique activée pour Advanced Blanks.`);
    } else {
        button.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/></svg> Activer la baguette magique';
        button.style.background = 'var(--hapi-grad-a)'; // Retour au violet
        textarea.removeEventListener('mouseup', handleSelection);
        logger.log(`🪄 Baguette Magique désactivée pour Advanced Blanks.`);
    }
}

function handleSelection(event) {
    const editor = event.target;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    // Si on a juste cliqué sans rien sélectionner, on ignore
    if (start === end) return;

    const selectedText = editor.value.substring(start, end).trim();
    if (!selectedText) return;

    // 1. Calculer combien de trous (___________) existent AVANT cette sélection pour trouver l'ordre d'insertion
    const textBeforeSelection = editor.value.substring(0, start);
    const matchTrousAvant = textBeforeSelection.match(/_{3,}/g);
    const indexInsertion = matchTrousAvant ? matchTrousAvant.length : 0;

    // 2. Remplacer le mot sélectionné par des tirets
    const textBefore = editor.value.substring(0, start);
    const textAfter = editor.value.substring(end);
    const blankString = "___________"; // 11 underscores standard
    
    editor.value = textBefore + blankString + textAfter;
    
    // 3. Replacer le curseur et redonner le focus à l'éditeur
    const newCursorPos = start + blankString.length;
    editor.focus();
    setTimeout(() => { editor.selectionStart = editor.selectionEnd = newCursorPos; }, 0);

    // 4. Créer la carte de réponse dynamiquement AU BON ENDROIT
    createNewBlankCard(selectedText, [], indexInsertion);

    // 5. Mettre à jour l'UI globale
    updateGenerateButtonCallback();
}

// ==========================================
// CRÉATION ET GESTION DES CARTES DYNAMIQUES
// ==========================================
function createNewBlankCard(correctWord = '', incorrects = [], indexInsertion = -1) {
    const listContainer = document.getElementById('ab-blanks-editor-list');
    
    const card = document.createElement('div');
    card.className = 'ab-blank-card';
    card.style.cssText = 'background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:15px; box-shadow:0 2px 4px rgba(0,0,0,0.02); position: relative; margin-bottom: 10px;';
    
    // Construction HTML des erreurs
    let incorrectHtml = '';
    if (incorrects.length === 0) {
        incorrectHtml = `
            <div class="ab-incorrect-row" style="display:flex; gap:10px; margin-bottom:8px;">
                <input type="text" class="ab-inc-answer" value="" placeholder="Mauvaise réponse (ex: mangé)" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:4px;">
                <input type="text" class="ab-inc-feedback" value="" placeholder="Explication de l'erreur..." style="flex:2; padding:8px; border:1px solid var(--border); border-radius:4px;">
                <button type="button" class="ab-remove-inc-btn" style="background:none; border:none; color:var(--danger-text); cursor:pointer; padding:0 5px; font-size: 1.1em;" title="Supprimer cette ligne"></button>
            </div>
        `;
    } else {
        incorrects.forEach(inc => {
            incorrectHtml += `
                <div class="ab-incorrect-row" style="display:flex; gap:10px; margin-bottom:8px;">
                    <input type="text" class="ab-inc-answer" value="${inc.text || inc.answer || ''}" placeholder="Mauvaise réponse" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:4px;">
                    <input type="text" class="ab-inc-feedback" value="${inc.feedback || ''}" placeholder="Explication..." style="flex:2; padding:8px; border:1px solid var(--border); border-radius:4px;">
                    <button type="button" class="ab-remove-inc-btn" style="background:none; border:none; color:var(--danger-text); cursor:pointer; padding:0 5px; font-size: 1.1em;" title="Supprimer cette ligne"></button>
                </div>
            `;
        });
    }

    card.innerHTML = `
        <button type="button" class="ab-delete-card-btn" style="position:absolute; top:15px; right:15px; background:transparent; border:none; border-radius:4px; color:var(--text); cursor:pointer; padding:4px 8px; font-size:1em; transition: 0.2s;" title="Supprimer cette carte"><svg class="ico" style="width:1.35em;height:1.35em;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
        
        <h4 class="ab-card-title" style="margin:0 0 15px 0; color: var(--hapi-accent-text); font-size:1.1em; border-bottom: 2px solid #d1fae5; padding-bottom: 5px; display: inline-block;">Trou n°X</h4>
        
        <div style="margin-bottom:15px;">
            <label style="font-size:0.9em; font-weight:bold; color:var(--text); display:block; margin-bottom:5px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Bonne réponse attendue :</label>
            <input type="text" class="ab-correct-input" value="${correctWord}" style="width:100%; padding:10px; border:2px solid var(--hapi-grad-a); border-radius:6px; background:rgba(34, 197, 94, 0.12); font-weight:bold; font-size:1.05em; color:var(--text);">
        </div>
        
        <div style="font-size:0.9em; font-weight:bold; color:var(--text); margin-bottom:8px;">✕ Erreurs anticipées et Feedbacks :</div>
        <div class="ab-incorrect-container">
            ${incorrectHtml}
        </div>
        <button type="button" class="ab-add-inc-btn" style="background:var(--page-bg); border:1px dashed #64748b; color:var(--text-muted); padding:8px 10px; border-radius:6px; font-size:0.9em; cursor:pointer; margin-top:5px; width:100%; transition: background 0.2s; font-weight:bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Ajouter une erreur courante</button>
    `;

    // Événements pour supprimer une ligne d'erreur
    card.querySelectorAll('.ab-remove-inc-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.ab-incorrect-row').remove();
            updateGenerateButtonCallback();
        });
    });

    // Événement pour AJOUTER une nouvelle ligne d'erreur
    card.querySelector('.ab-add-inc-btn').addEventListener('click', (e) => {
        const container = e.target.previousElementSibling;
        const newRow = document.createElement('div');
        newRow.className = 'ab-incorrect-row';
        newRow.style.cssText = 'display:flex; gap:10px; margin-bottom:8px;';
        newRow.innerHTML = `
            <input type="text" class="ab-inc-answer" value="" placeholder="Mauvaise réponse" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:4px;">
            <input type="text" class="ab-inc-feedback" value="" placeholder="Explication..." style="flex:2; padding:8px; border:1px solid var(--border); border-radius:4px;">
            <button type="button" class="ab-remove-inc-btn" style="background:none; border:none; color:var(--danger-text); cursor:pointer; padding:0 5px; font-size: 1.1em;" title="Supprimer cette ligne"></button>
        `;
        newRow.querySelector('.ab-remove-inc-btn').addEventListener('click', () => {
            newRow.remove();
            updateGenerateButtonCallback();
        });
        container.appendChild(newRow);
        updateGenerateButtonCallback();
    });

    // Événement pour SUPPRIMER la carte entière
    card.querySelector('.ab-delete-card-btn').addEventListener('click', () => {
        if(confirm("Supprimer cette carte ? N'oubliez pas de retirer également les tirets (___) correspondants dans le texte au dessus.")) {
            card.remove();
            reindexCards();
            updateGenerateButtonCallback();
        }
    });

    // Insertion intelligente à la bonne place
    if (indexInsertion >= 0 && indexInsertion < listContainer.children.length) {
        listContainer.insertBefore(card, listContainer.children[indexInsertion]);
    } else {
        listContainer.appendChild(card);
    }
    
    // On renumérote tout pour être sûr
    reindexCards();
}

function reindexCards() {
    const cards = document.querySelectorAll('.ab-blank-card');
    cards.forEach((card, index) => {
        const title = card.querySelector('.ab-card-title');
        if (title) title.innerText = `Trou n°${index + 1}`;
    });
}

// ==========================================
// RÈGLES IA & APPELS API
// ==========================================
function addRule() {
    const container = document.getElementById('ab-rules-container');
    const newRule = document.createElement('div');
    newRule.className = 'ab-rule-item';
    newRule.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; align-items: center; margin-bottom: 10px;';
    newRule.innerHTML = `
        <input type="text" class="ab-rule-task" placeholder="ex: mots de liaison" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:5px;">
        <input type="text" class="ab-rule-example" placeholder="ex: *Cependant*" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:5px;">
        <button type="button" class="btn btn-remove-ab-rule" style="background:transparent; color:var(--text); border:none; padding:9px 12px; border-radius:6px; cursor:pointer;"><svg class="ico" style="width:1.35em;height:1.35em;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
    `;
    container.appendChild(newRule);
    updateRemoveButtons();
	showRegenerateButton();
}

function removeRule(e) {
    // closest() : le clic peut viser l'icône SVG à l'intérieur du bouton, pas le bouton lui-même
    const trashBtn = e.target.closest('.btn-remove-ab-rule');
    if (!trashBtn) return;
    const item = trashBtn.closest('.ab-rule-item');
    if (!item) return;
    const items = Array.from(document.querySelectorAll('.ab-rule-item'));
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
    document.querySelectorAll('.ab-rule-item').forEach((item, i) => {
        const btn = item.querySelector('.btn-remove-ab-rule');
        if (!btn) return;
        btn.disabled = false;
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text)';
        btn.style.cursor = 'pointer';
        btn.title = i === 0 ? 'Effacer les champs de cette ligne' : 'Supprimer cette ligne';
    });
}

async function handlePreparePrompt() {
    const ruleElements = document.querySelectorAll('.ab-rule-item');
    let rules = [];
    ruleElements.forEach(el => {
        const task = el.querySelector('.ab-rule-task').value.trim();
        const example = el.querySelector('.ab-rule-example').value.trim();
        if (task) rules.push({ task, example });
    });

    let sourceText = document.getElementById('abTexteSource').value;
    const btn = document.getElementById('prepare-ia-btn-advanced-blanks');

    if (!sourceText.trim()) { alert("Sélectionnez d'abord une source de texte."); return; }

    // Répartition multi-sources : un bloc par fichier avec son quota de trous
    const repartitionMap = {};
    container.querySelectorAll('#ab-questions-repartition .source-question-count').forEach(input => {
        const val = parseInt(input.value, 10);
        if (!isNaN(val) && val >= 0) repartitionMap[input.dataset.sourceId] = val;
    });
    const selectedDocs = localSourceSelector ? localSourceSelector.getSelectedSourceObjects() : [];
    const blocs = construireBlocsSources(selectedDocs, repartitionMap, 'CRÉE EXACTEMENT {n} trou(s) dans ce bloc.');
    if (blocs) sourceText = blocs;
    if (rules.length === 0) { alert("Renseignez au moins une tâche pour l'IA."); return; }

    // 🟢 On force le texte initial de base
    const originalText = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt';
    
    btn.disabled = true; 
    btn.innerHTML = 'Analyse...';
    
    const success = await preparerAssistantIA_AdvancedBlanks(rules, sourceText);
    
    if (success) {
        document.getElementById('advanced-blanks-ia-section').style.display = 'block';
        
        // 🟢 On cache le conteneur du bouton après succès de manière sécurisée
        if (btn.parentElement) {
            btn.parentElement.style.display = 'none';
        }

        // Si vous avez un bouton Albert sur ce module, on l'affiche ici
        const albertAction = document.getElementById('albert-action-advanced-blanks');
        if (albertAction) albertAction.style.display = 'block';

        setTimeout(() => {
            document.getElementById('advanced-blanks-ia-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
    
    // 🟢 On réinitialise l'état de base pour le prochain affichage (Régénérer)
    btn.disabled = false; 
    btn.innerHTML = originalText;
}

async function handleGenerateAlbert() {
    const btn = document.getElementById('btn-send-albert-advanced-blanks');
    const originalText = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = "L'IA génère les feedbacks...";
    await callAlbertAPI('ia-prompt-advanced-blanks', 'advanced-blanks-ia-response', 'btn-parse-advanced-blanks-ia-response', btn);
    btn.disabled = false; btn.innerHTML = originalText;
}

function handleParseResponse() {
    const responseArea = document.getElementById('advanced-blanks-ia-response');
    if (!responseArea || !responseArea.value.trim()) return;
    try {
        let cleanJson = responseArea.value.replace(/^\s*=+/, '').replace(/```json/g, '').replace(/```/g, '').trim();
        // Extraction tolérante : n8n peut préfixer un = ou du texte parasite autour du JSON
        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleanJson = jsonMatch[0];
        // Réparation : le modèle écrit parfois "blanksText": """...multiligne...""" (invalide
        // en JSON, calqué sur les délimiteurs du prompt) → on ré-échappe en chaîne JSON valide.
        cleanJson = cleanJson.replace(/:\s*"""([\s\S]*?)"""/g, (m, p1) => ': ' + JSON.stringify(p1.trim()));
        const data = JSON.parse(cleanJson);

        // Protocole [TROU] → standard 11 underscores (n8n réduit les ___________ à un seul _,
        // pris pour de l'emphase markdown ; les crochets survivent). On normalise aussi
        // les éventuelles suites d'underscores renvoyées malgré tout.
        const blanksText = (data.blanksText || '').replace(/\[TROU\]/gi, '___________').replace(/_+/g, '___________');

        document.getElementById('ab-text-editor').value = blanksText;
        
        const listContainer = document.getElementById('ab-blanks-editor-list');
        listContainer.innerHTML = '';
        
        data.blanks.forEach((blank) => {
            const incorrects = blank.incorrect || blank.incorrectAnswers || [];
            createNewBlankCard(blank.correct, incorrects); 
        });

        document.getElementById('advanced-blanks-editor-section').style.display = 'block';
        document.getElementById('advanced-blanks-options-section').style.display = 'block';
        
        document.getElementById('advanced-blanks-ia-section').style.display = 'none';

        updateGenerateButtonCallback();
    } catch (e) {
        alert("JSON invalide. Corrigez manuellement la zone de réponse de l'IA.");
    }
}

function showRegenerateButton() {
    const iaSection = document.getElementById('advanced-blanks-ia-section');
    const btnPrepare = document.getElementById('prepare-ia-btn-advanced-blanks');

    // On vérifie si la section IA est visible (ce qui signifie que le prompt a déjà été généré)
    if (iaSection && iaSection.style.display === 'block') {
        if (btnPrepare) {
            // On fait réapparaître le div parent du bouton
            btnPrepare.parentElement.style.display = 'block'; 
            btnPrepare.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg> Régénérer le prompt';
            // On s'assure que le bouton reste bien vert
            btnPrepare.style.background = 'linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark))';
            btnPrepare.style.boxShadow = '0 4px 15px rgba(var(--hapi-green-rgb), 0.3)';
        }
    }
}


export function getUIState() {
    return getAdvancedBlanksState();
}

export function setUIState(config) {
    setAdvancedBlanksState(config, {
        updateBtn: updateGenerateButtonCallback
    });
    if (config.overallFeedback) {
        setFeedbackIntervallesData('advanced-blanks', config.overallFeedback);
    }
}

export function gatherData() {
    const textElement = document.getElementById('ab-text-editor');
    if (!textElement || !textElement.value) return null;

    const blanks = [];
    const cards = document.querySelectorAll('.ab-blank-card');
    
    cards.forEach(card => {
        const correct = card.querySelector('.ab-correct-input').value;
        const incorrectList = [];
        const rows = card.querySelectorAll('.ab-incorrect-row');
        
        rows.forEach(row => {
            const answer = row.querySelector('.ab-inc-answer').value;
            const feedback = row.querySelector('.ab-inc-feedback').value;
            if (answer) {
                incorrectList.push({
                    showHighlight: false,
                    incorrectAnswerText: answer,
                    incorrectAnswerFeedback: `<div>${feedback}</div>`,
                    highlight: "-1" // Fix H5P
                });
            }
        });
        
        blanks.push({
            correctAnswerText: correct,
            incorrectAnswersList: incorrectList
        });
    });

    return {
        titre: document.getElementById('advanced-blanks-title').value,
        consignes: document.getElementById('advanced-blanks-task-display').value,
        texteHtml: textElement.value,
        blanks: blanks,
		overallFeedback: getFeedbackIntervallesData('advanced-blanks'),
        passPercentage: parseInt(document.getElementById('advanced-blanks-passPercentage')?.value || "50", 10),
        feedbackFail: document.getElementById('advanced-blanks-feedback-fail')?.value || "Réessayez",
        feedbackSuccess: document.getElementById('advanced-blanks-feedback-success')?.value || "Bravo",
        
        // 👉 LE NOUVEAU BLOC COMPORTEMENT COMPLET
        comportement: {
            mode: document.getElementById('ab-mode').value,
            spellingErrorBehaviour: document.getElementById('ab-spelling').value,
            caseSensitive: document.getElementById('ab-caseSensitive').checked,
            autoCheck: document.getElementById('ab-autoCheck')?.checked || false,
            enableCheckButton: document.getElementById('ab-enableCheckButton').checked,
            confirmCheckDialog: document.getElementById('ab-confirmCheckDialog')?.checked || false,
            enableSolutionsButton: document.getElementById('ab-enableSolutionsButton').checked,
            showSolutionsRequiresInput: document.getElementById('ab-showSolutionsRequiresInput')?.checked || false,
            enableRetry: document.getElementById('ab-enableRetry').checked,
            confirmRetryDialog: document.getElementById('ab-confirmRetryDialog')?.checked || false
        },
        
        // 👉 L'OPTION DE TRADUCTION GLOBALE
        translateUI: document.getElementById('translate-ui-advanced-blanks')?.checked || false
    };
}