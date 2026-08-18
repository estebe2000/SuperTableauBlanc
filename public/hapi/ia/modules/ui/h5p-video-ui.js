// Fichier: modules/ui/h5p-video-ui.js
// Module Vidéo Interactive H5P — intégré dans HAPI (Albert API + n8n)

import { logger } from '../utils/logger.js';
import { creerAssistantIA_HTML, creerFeedbackIntervallesHTML, initFeedbackIntervalles, getFeedbackIntervallesData, setFeedbackIntervallesData } from '../utils/helpers.js';
import { getInteractiveVideoState, setInteractiveVideoState } from '../utils/states/interactive-video-state.js';
import { genererPrompt_H5PVideo } from '../ia/prompts/h5p-video-prompt.js';

// ─── État interne du module ────────────────────────────────────────────────────
let _pane = null;
let _corpusContent = '';
let _onValidCallback = null;

let _videoMetadata = {
    url: '',
    originalSourceUrl: '',
	mime: '',          // 'video/YouTube' | 'video/mp4' | …
    transcript: '',
    segments: [],      // [{ start, end, text }]
    duration: 0
};

let _generatedInteractions = [];  // interactions éditées
let _bookmarks = [];              // ⬅️ NOUVEAU : Liste des chapitres
let _h5pLibraryVersions = new Map();

// ─── Constantes ────────────────────────────────────────────────────────────────
// ⚠️ Remplace ces URLs par tes endpoints n8n réels
const N8N_TRANSCRIBE_WEBHOOK = (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-n8n/webhook/hapi_video_transcribe'; // 🟢 Ton URL de prod
const ALBERT_CHAT_ENDPOINT   = (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-n8n/webhook/hapi_albert';

const PYTHON_PROXY_URL = 'https://nshapiproxyadd10448-hapi-proxy.functions.fnc.fr-par.scw.cloud/proxy/video';

// ─── Entrée publique ───────────────────────────────────────────────────────────
export function init(pane, corpusContent, onValidCallback) {
    _pane             = pane;
    _corpusContent    = corpusContent;
    _onValidCallback  = onValidCallback;
    _videoMetadata    = { url: '', originalSourceUrl: '', mime: '', transcript: '', segments: [], duration: 0 }; // ⬅️ NOUVEAU _generatedInteractions = [];
    _injectStyles();
    _render();
    logger.log('🎬 h5p-video-ui initialisé');
}

// ─── Lecture de l'état (pour gatherData / getUIState / setUIState) ─────────────
export function gatherData() {
    // 🔴 FAILLE CORRIGÉE : Il FAUT forcer la synchronisation avant de générer ou valider !
    syncEditorToState(); 
    
    if (!_generatedInteractions || _generatedInteractions.length === 0) return null;
    return {
        // Titre exposé comme pour les autres activités (data.titre) afin que la
        // modale d'aperçu affiche « Aperçu : <titre> » et non « Aperçu H5P ».
        // Même valeur/fallback que le titre H5P généré (cf. h5p-video-generator).
        titre: (_videoMetadata.mainTitle || '').trim() || 'Vidéo Interactive',
        videoMetadata: { ..._videoMetadata },
        interactions: _deepClone(_generatedInteractions),
        bookmarks: _deepClone(_bookmarks),
        globalSettings: _readGlobalSettings()
    };
}

export function getUIState() {
    syncEditorToState(); // On force la sauvegarde des champs ouverts
    return getInteractiveVideoState(_videoMetadata, _generatedInteractions, _bookmarks, _readGlobalSettings());
}

export function setUIState(state) {
    if (!state) return;

    // 1. Mise à jour PRIORITAIRE de la mémoire vive
    if (state.videoMetadata) _videoMetadata = { ...state.videoMetadata };
    if (state.interactions) _generatedInteractions = [...state.interactions];
    if (state.bookmarks) _bookmarks = [...state.bookmarks];

    // 🌟 NOUVEAU : MISE À JOUR VISUELLE DES CARTES (ÉTAPE 3)
    if (_pane && state.interactions) {
        const typeCounts = {};
        let summaryMaxGroups = 1;

        state.interactions.forEach(item => {
            typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
            if (item.type === 'summary' && item.data && item.data.statements) {
                summaryMaxGroups = Math.max(summaryMaxGroups, item.data.statements.length);
            }
        });

        // 🟢 C'est cette ligne qui avait disparu !
        const allTypes = ['quiz', 'multichoice', 'truefalse', 'fillblanks', 'dragtext', 'markthewords', 'summary'];
        
        allTypes.forEach(type => {
            const cb = _pane.querySelector(`.vid-itype-cb[value="${type}"]`);
            const countInput = _pane.querySelector(`#vid-count-${type}`);
            const groupInput = _pane.querySelector(`#vid-groups-${type}`);
            
            // 🟢 CIBLES POUR LE RÉSUMÉ DE FIN
            const summaryEndCb = _pane.querySelector('#vid-summary-at-end');
            const summaryEndSec = _pane.querySelector('#vid-summary-end-seconds');

            if (cb && countInput) {
                const card = cb.closest('.vid-choice-card');
                const count = typeCounts[type] || 0;
                
                if (count > 0) {
                    cb.checked = true;
                    countInput.value = count;
                    if (groupInput) groupInput.value = summaryMaxGroups;
                    
                    if (card) card.classList.add('vid-choice-active');
                    countInput.style.opacity = '1';
                    if (groupInput) groupInput.style.opacity = '1';
                    
                    // 🟢 OPACITÉ ACTIVE POUR RÉSUMÉ FIN
                    if (type === 'summary') {
                        if (summaryEndCb) summaryEndCb.style.opacity = '1';
                        if (summaryEndSec) summaryEndSec.style.opacity = '1';
                    }
                } else {
                    cb.checked = false;
                    countInput.value = 1; 
                    if (groupInput) groupInput.value = 1;
                    
                    if (card) card.classList.remove('vid-choice-active');
                    countInput.style.opacity = '0.4';
                    if (groupInput) groupInput.style.opacity = '0.4';
                    
                    // 🟢 OPACITÉ DÉSACTIVÉE POUR RÉSUMÉ FIN
                    if (type === 'summary') {
                        if (summaryEndCb) summaryEndCb.style.opacity = '0.4';
                        if (summaryEndSec) summaryEndSec.style.opacity = '0.4';
                    }
                }
            }
        });
    }

    // 2. Restauration de l'interface visuelle de base
    setInteractiveVideoState(state, {
        formatTs: _secondsToTs,
        updateBtn: _onValidCallback 
    });

    // 3. Rendu des éléments dynamiques de l'éditeur
    _renderInteractionEditor(_generatedInteractions);
    _renderBookmarks();
    _applyGlobalSettings(state.globalSettings);

    // 4. Notification standard à l'application
    if (_onValidCallback) _onValidCallback();

    // 🛡️ 5. SÉCURITÉ ABSOLUE : Forçage asynchrone des boutons globaux
    setTimeout(() => {
        const generateSec = document.getElementById('generate-section');
        if (generateSec && _generatedInteractions && _generatedInteractions.length > 0) {
            generateSec.style.display = 'block';
            generateSec.classList.remove('hidden', 'd-none');
        }
    }, 150);
}

// ─── Rendu principal ──────────────────────────────────────────────────────────
function _render() {
    _pane.innerHTML = `

<!-- ═══ ÉTAPE 1 : Source vidéo ════════════════════════════════════════════ -->
<div id="vid-step-source" class="vid-step">
    <h3 class="vid-step-title"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4"/></svg> 1. Configuration de l'activité</h3>

    <div class="vid-field">
        <label class="vid-label">Titre principal de l'activité H5P</label>
        <input id="vid-main-title" type="text" class="vid-input" 
               placeholder="Ex: Cours sur les planètes - Étude de cas">
    </div>

    <div class="vid-field" style="margin-top:10px;">
        <label class="vid-label">URL de la vidéo (issue du corpus)</label>
        <input id="vid-url-input" type="text" class="vid-input" readonly
               style="background: var(--page-bg); color: var(--text-muted); cursor: not-allowed; border-color: var(--border);"
               placeholder="Aucune vidéo chargée...">
    </div>
</div>

<!-- ═══ ÉTAPE 2 : Transcript ══════════════════════════════════════════════ -->

<div id="vid-step-transcript" class="vid-step" style="display:none;">
    <h3 class="vid-step-title"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg> 2. Transcription horodatée</h3>
    
    <div class="vid-field" style="margin-bottom:15px; display:flex; align-items:center; gap:8px;">
        <label class="vid-label" style="margin-bottom:0;">Durée détectée :</label>
        <span id="vid-duration" style="font-weight:700; color: var(--hapi-accent-text);">--:--</span>
    </div>
    
    <div class="vid-field">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:6px;">
            <label class="vid-label" style="margin-bottom:0;">Texte extrait</label>
            <button id="vid-edit-transcript-btn" class="vid-btn" 
                    style="padding:2px 10px; font-size:0.75em; background:var(--page-bg); border:1px solid var(--border); color:var(--text-muted); border-radius:4px; height:24px;">
                <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Modifier le texte
            </button>
        </div>
        
        <textarea id="vid-transcript-display" class="vid-input" rows="7" readonly
                  style="font-size:0.88em; font-family:monospace; background:var(--page-bg); transition: background 0.3s;"></textarea>
        
        <p style="font-size:0.75em; color:var(--text-muted); margin-top:6px;">
            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> <em>Note : L'IA peut faire des erreurs, à vous de vérifier et de corriger si nécessaire. En revanche, attention à l'horodatage !</em>
        </p>
    </div>


    <h3 class="vid-step-title" style="margin-top:24px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg> 3. Interactions à générer</h3>
    <div id="vid-interaction-choices" style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
        ${_renderChoiceCards()}
    </div>

    <details style="margin-bottom:14px; background:var(--page-bg); border:1px solid var(--border); border-radius:8px; padding:12px;">
        <summary style="font-weight:600; cursor:pointer; color:var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options avancées</summary>
        <div style="margin-top:12px;">
            <label class="vid-label"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg> Créativité IA : <strong id="vid-temp-val">0.4</strong></label>
            <input id="vid-temperature" type="range" min="0" max="1" step="0.1" value="0.4" style="width:100%;">
            <div style="display:flex;justify-content:space-between;font-size:0.8em;color:var(--text-muted);padding:0 4px;">
                <span>Strict</span><span>Créatif</span>
            </div>
        </div>
    </details>

		<div style="text-align:center;">
			<button id="vid-generate-btn" class="vid-btn" data-ia="albert" style="padding: 10px 22px; font-size: 1em; justify-content: center; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
    				<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer les interactions avec l'IA
			</button>
    </div>
    <div id="vid-generate-status" style="display:none; margin-top:12px;"></div>
</div>

<!-- ═══ ÉTAPE 4 : Éditeur ══════════════════════════════════════════════════ -->
<div id="vid-step-editor" class="vid-step" style="display:none;">
    <h3 class="vid-step-title"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> 4. Éditez les interactions</h3>
    <p style="font-size:0.9em; color:var(--text-muted); margin-bottom:12px;">
        Cliquez sur un en-tête pour déplier. Les timestamps sont éditables.
    </p>

    <div id="vid-interaction-list"></div>
		
    <div style="display:flex; gap:10px; align-items:center; margin-bottom:16px; background:var(--page-bg); padding:10px; border-radius:6px; border:1px dashed var(--border);">
        <select id="vid-manual-type" class="vid-input" style="width:auto; min-width:200px;">
            <option value="quiz">🔘 QCM (Choix Unique)</option>
            <option value="multichoice">☑️ QCM (Choix Multiples)</option>
            <option value="truefalse">⚖️ Vrai / Faux</option>
            <option value="fillblanks">✍️ Texte à trous</option>
            <option value="dragtext">Étiquettes à déplacer</option>
            <option value="markthewords">🔍 Mots à repérer</option>
            <option value="summary">📝 Résumé (fin)</option>
        </select>
        <button id="vid-add-manual-btn" class="vid-btn vid-btn-primary" style="padding:6px 14px; font-size:0.85em;">
            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Ajouter manuellement
        </button>
    </div>

<!-- ═══ ÉTAPE 5 : Paramètres globaux ════════════════════════════════════════ -->
<div id="vid-step-settings" class="vid-step" style="display:none;">
    <details style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 15px;">
        <summary style="font-weight:bold; font-size:1.1rem; color: var(--hapi-accent-text); cursor:pointer; outline:none; list-style-position: inside;">
            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> 5. Paramètres de la vidéo interactive
        </summary>
        <div style="margin-top: 15px;">
            <div style="display:grid; grid-template-columns:1fr; gap:14px;">
				<div class="vid-field">
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; background:rgba(34, 197, 94, 0.12); padding:10px; border-radius:6px; border:1px solid rgba(34, 197, 94, 0.45);">
                        <input type="checkbox" id="vid-translate-ui" checked style="accent-color: var(--hapi-green); width: 16px; height: 16px;">
                        <span style="font-weight:600; color: var(--hapi-accent-text);">Traduire les boutons H5P (selon la langue choisie)</span>
                    </label>
                </div>
                
				<div class="vid-field">
                    <h4 style="margin: 0 0 10px 0; color: var(--hapi-accent-text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg> Chapitrage (Bookmarks) :</h4>
                    <div id="vid-bookmarks-list" style="margin-bottom: 10px; display:flex; flex-direction:column; gap:6px;"></div>
                    <div style="display:flex; gap:10px;">
                        <input type="text" id="vid-new-bm-ts" placeholder="MM:SS" class="vid-input" style="width:80px;">
                        <input type="text" id="vid-new-bm-label" placeholder="Titre du chapitre" class="vid-input" style="flex:1;">
                        <button type="button" id="vid-add-bm-btn" class="vid-btn" style="padding:4px 12px; background:var(--border); color:var(--text);">+ Ajouter</button>
                    </div>
                </div>

                <div class="vid-field">
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; background:var(--page-bg); padding:10px; border-radius:6px; border:1px solid var(--border);">
                        <input type="checkbox" id="vid-enable-submit" checked>
                        <span style="font-weight:600;">Afficher l'écran de soumission des scores à la fin de la vidéo</span>
                    </label>
                </div>

				<div class="vid-field">
                    <label class="vid-label">Restriction de navigation :</label>
                    <select id="vid-nav-control" class="vid-input" style="width: auto; max-width: 100%; min-width: 250px;">
                        <option value="none">Libre (défaut)</option>
                        <option value="forward">Interdire l'avance rapide (Retour en arrière autorisé)</option>
                        <option value="both">Totalement bloquée (Ni avance, ni retour)</option>
                    </select>
                </div>
                
            </div>
        </div>
    </details>
</div>
`;

    _attachEvents();
}

// ─── Cartes de choix des interactions ─────────────────────────────────────────
function _renderChoiceCards() {
	const types = [
			{ value: 'quiz',        label: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg> QCM (Choix Unique)',  default: 1, checked: false  },
        	{ value: 'multichoice', label: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> QCM (Choix Multiples)',default: 1, checked: false }, // ⬅️ NOUVEAU
	        { value: 'truefalse',   label: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Vrai / Faux',         default: 1, checked: false  },
	        { value: 'fillblanks',  label: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Texte à trous',        default: 1, checked: false },
	        { value: 'dragtext',    label: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg> Étiquettes à déplacer', default: 1, checked: false },
	        { value: 'markthewords',label: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Mots à repérer',       default: 1, checked: false }, // ⬅️ NOUVEAU ICI
	        { value: 'summary',     label: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg> Résumé',          default: 1, checked: false  },
	    ];
		return types.map(t => `
		        <div class="vid-choice-card ${t.checked ? 'vid-choice-active' : ''}">
		            <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; cursor:pointer;">
		                <input type="checkbox" class="vid-itype-cb" value="${t.value}" ${t.checked ? 'checked' : ''}>
		                <span style="font-weight:600;">${t.label}</span>
		            </label>
		            <div style="display:flex; flex-direction:row; align-items:center; gap:16px; margin-left:24px; flex-wrap:wrap;">
		                <div style="display:flex; align-items:center; gap:8px;">
		                    <label style="font-size:0.88em; color:var(--text-muted);">Nombre :</label>
		                    <input type="number" id="vid-count-${t.value}" value="${t.default}" min="0" max="10"
		                           class="vid-count-input" style="width:55px; ${!t.checked ? 'opacity:0.4;' : ''}">
		                </div>
		                ${t.value === 'summary' ? `
		                <div style="display:flex; align-items:center; gap:8px;">
		                    <label style="font-size:0.88em; color:var(--text-muted);">Groupes par résumé :</label>
		                    <input type="number" id="vid-groups-${t.value}" value="1" min="1" max="10"
		                           class="vid-count-input" style="width:55px; ${!t.checked ? 'opacity:0.4;' : ''}">
		                </div>
                
		                <div style="width:100%; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-top:8px; padding-top:8px; border-top:1px dashed var(--border);">
		                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.88em; color: var(--hapi-accent-text); font-weight:600;">
		                        <input type="checkbox" id="vid-summary-at-end" checked style="accent-color:var(--hapi-green-dark); ${!t.checked ? 'opacity:0.4;' : ''}">
		                        Dont 1 récapitulatif à la fin
		                    </label>
		                    <div style="display:flex; align-items:center; gap:6px;">
		                        <label style="font-size:0.88em; color:var(--text-muted);">Afficher à :</label>
		                        <input type="number" id="vid-summary-end-seconds" value="3" min="1" max="60"
		                               class="vid-count-input" style="width:50px; ${!t.checked ? 'opacity:0.4;' : ''}">
		                        <span style="font-size:0.88em; color:var(--text-muted);">sec. de la fin</span>
		                    </div>
		                </div>
		                ` : ''}
		            </div>
		        </div>
		    `).join('');
		}
		
// ─── Attachement des événements ────────────────────────────────────────────────
function _attachEvents() {

// Checkboxes types interaction
	_pane.querySelectorAll('.vid-itype-cb').forEach(cb => {
	        cb.addEventListener('change', () => {
	            const card = cb.closest('.vid-choice-card');
	            const countInput = _pane.querySelector(`#vid-count-${cb.value}`);
	            const groupInput = _pane.querySelector(`#vid-groups-${cb.value}`);
	            const summaryEndCb = _pane.querySelector('#vid-summary-at-end');
	            const summaryEndSec = _pane.querySelector('#vid-summary-end-seconds');
            
	            if (cb.checked) {
	                card.classList.add('vid-choice-active');
	                if(countInput) countInput.style.opacity = '1';
	                if(groupInput) groupInput.style.opacity = '1';
	                if(cb.value === 'summary') {
	                    if(summaryEndCb) summaryEndCb.style.opacity = '1';
	                    if(summaryEndSec) summaryEndSec.style.opacity = '1';
	                }
	                if (countInput && parseInt(countInput.value) === 0) countInput.value = 1;
	            } else {
	                card.classList.remove('vid-choice-active');
	                if(countInput) countInput.style.opacity = '0.4';
	                if(groupInput) groupInput.style.opacity = '0.4';
	                if(cb.value === 'summary') {
	                    if(summaryEndCb) summaryEndCb.style.opacity = '0.4';
	                    if(summaryEndSec) summaryEndSec.style.opacity = '0.4';
	                }
	            }
	        });
	    });

    // Slider température
    const slider = _pane.querySelector('#vid-temperature');
    if (slider) {
        slider.addEventListener('input', () => {
            const val = _pane.querySelector('#vid-temp-val');
            if(val) val.textContent = slider.value;
        });
    }
	
    // Bouton de modification du transcript
    const editTranscriptBtn = _pane.querySelector('#vid-edit-transcript-btn');
    const transcriptArea = _pane.querySelector('#vid-transcript-display');

    if (editTranscriptBtn && transcriptArea) {
        editTranscriptBtn.addEventListener('click', () => {
            const isReadOnly = transcriptArea.readOnly;
            transcriptArea.readOnly = !isReadOnly;
            
            if (transcriptArea.readOnly) {
                transcriptArea.style.background = 'var(--page-bg)';
                editTranscriptBtn.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Modifier le texte';
                editTranscriptBtn.style.background = 'var(--page-bg)';
                _videoMetadata.transcript = transcriptArea.value;
                logger.log('📝 Transcript mis à jour manuellement');
            } else {
                transcriptArea.style.background = 'var(--field-bg)';
                transcriptArea.focus();
                editTranscriptBtn.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg> Enregistrer';
                editTranscriptBtn.style.background = 'rgba(34, 197, 94, 0.20)';
            }
        });
        
        transcriptArea.addEventListener('input', () => {
            _videoMetadata.transcript = transcriptArea.value;
        });
    }
	
    // 🛡️ SÉCURITÉ MAXIMUM : Utilisation de "?." (Optional Chaining)
    // Si le bouton n'existe pas dans le HTML, le code ne plantera plus !

    // Boutons principaux
    _pane.querySelector('#vid-generate-btn')?.addEventListener('click', _handleGenerateInteractions);
    _pane.querySelector('#vid-import-h5p-btn')?.addEventListener('click', _handleImportH5P);
    
    // NOUVEAU : Bouton ajout manuel
    _pane.querySelector('#vid-add-manual-btn')?.addEventListener('click', _handleManualAdd);

    // NOUVEAU : Gestion des chapitres (Bookmarks)
    _pane.querySelector('#vid-add-bm-btn')?.addEventListener('click', () => {
        const tsInput = _pane.querySelector('#vid-new-bm-ts');
        const labelInput = _pane.querySelector('#vid-new-bm-label');
        if (tsInput && labelInput && /^\d{2}:\d{2}$/.test(tsInput.value) && labelInput.value.trim()) {
            _bookmarks.push({ timestamp: tsInput.value, label: labelInput.value.trim() });
            _bookmarks.sort((a, b) => _tsToSeconds(a.timestamp) - _tsToSeconds(b.timestamp));
            _renderBookmarks();
            tsInput.value = ''; labelInput.value = '';
        } else {
            alert('Format invalide. Utilisez MM:SS pour le temps et n\'oubliez pas le titre.');
        }
    });

    _pane.querySelector('#vid-bookmarks-list')?.addEventListener('click', e => {
        if (e.target.classList.contains('vid-del-bm')) {
            const idx = parseInt(e.target.dataset.idx);
            _bookmarks.splice(idx, 1);
            _renderBookmarks();
        }
    });

    // Délégation sur la liste d'interactions (delete + toggle)
// Délégation sur la liste d'interactions (actions internes aux cartes)
    _pane.querySelector('#vid-interaction-list')?.addEventListener('click', e => {
        // 1. Déplier / Replier une carte
        const header = e.target.closest('.vid-card-header');
        if (header && !e.target.closest('button') && !e.target.closest('input')) {
            header.closest('.vid-card').classList.toggle('vid-card-collapsed');
            return;
        }

        // 2. Supprimer TOUTE l'interaction (la carte complète)
        const delBtn = e.target.closest('.vid-del-btn');
        if (delBtn) {
            const idx = parseInt(delBtn.dataset.idx);
            _generatedInteractions.splice(idx, 1);
            _renderInteractionEditor(_generatedInteractions);
            _onValidCallback && _onValidCallback();
            return;
        }

        // 3. Ajouter une OPTION à l'intérieur d'un QCM
        const addOptBtn = e.target.closest('.vid-add-opt-btn');
        if (addOptBtn) {
            e.preventDefault();
            syncEditorToState(); // On sauvegarde ce que l'utilisateur a déjà tapé
            const idx = parseInt(addOptBtn.dataset.idx);
            if (_generatedInteractions[idx].data.options) {
                _generatedInteractions[idx].data.options.push(""); // Ajoute un champ vide
                _renderInteractionEditor(_generatedInteractions);
            }
            return;
        }

        // 4. Supprimer une OPTION à l'intérieur d'un QCM
        const delOptBtn = e.target.closest('.vid-del-opt-btn');
        if (delOptBtn) {
            e.preventDefault();
            syncEditorToState(); // On sauvegarde
            const idx = parseInt(delOptBtn.dataset.idx);
            const optIdx = parseInt(delOptBtn.dataset.optidx);
            const item = _generatedInteractions[idx];
            
            if (item.data.options && item.data.options.length > 2) {
                // On supprime l'option
                item.data.options.splice(optIdx, 1);
                
                // On recale l'index des bonnes réponses pour ne pas créer de bug
                if (item.type === 'quiz') {
                    if (item.data.correct === optIdx) item.data.correct = 0;
                    else if (item.data.correct > optIdx) item.data.correct--;
                } else if (item.type === 'multichoice') {
                    item.data.correct = item.data.correct
                        .filter(c => c !== optIdx)
                        .map(c => c > optIdx ? c - 1 : c);
                }
                _renderInteractionEditor(_generatedInteractions);
            } else {
                alert("Un QCM doit comporter au minimum 2 options.");
            }
            return;
        }
		
// --- GESTION DU RÉSUMÉ (SUMMARY) ---
        
        // 5. Ajouter un GROUPE dans Résumé
        const addGroupBtn = e.target.closest('.vid-add-group-btn');
        if (addGroupBtn) {
            e.preventDefault(); syncEditorToState();
            const idx = parseInt(addGroupBtn.dataset.idx);
            if (!_generatedInteractions[idx].data.statements) _generatedInteractions[idx].data.statements = [];
            _generatedInteractions[idx].data.statements.push({ correct: "", distractors: [""] });
            _renderInteractionEditor(_generatedInteractions);
            return;
        }

        // 6. Supprimer un GROUPE dans Résumé
        const delGroupBtn = e.target.closest('.vid-del-group-btn');
        if (delGroupBtn) {
            e.preventDefault(); syncEditorToState();
            const idx = parseInt(delGroupBtn.dataset.idx);
            const gIdx = parseInt(delGroupBtn.dataset.gidx);
            _generatedInteractions[idx].data.statements.splice(gIdx, 1);
            _renderInteractionEditor(_generatedInteractions);
            return;
        }

        // 7. Ajouter un DISTRACTEUR dans Résumé
        const addDistBtn = e.target.closest('.vid-add-dist-btn');
        if (addDistBtn) {
            e.preventDefault(); syncEditorToState();
            const idx = parseInt(addDistBtn.dataset.idx);
            const gIdx = parseInt(addDistBtn.dataset.gidx);
            _generatedInteractions[idx].data.statements[gIdx].distractors.push("");
            _renderInteractionEditor(_generatedInteractions);
            return;
        }

        // 8. Supprimer un DISTRACTEUR dans Résumé
        const delDistBtn = e.target.closest('.vid-del-dist-btn');
        if (delDistBtn) {
            e.preventDefault(); syncEditorToState();
            const idx = parseInt(delDistBtn.dataset.idx);
            const gIdx = parseInt(delDistBtn.dataset.gidx);
            const dIdx = parseInt(delDistBtn.dataset.didx);
            _generatedInteractions[idx].data.statements[gIdx].distractors.splice(dIdx, 1);
            _renderInteractionEditor(_generatedInteractions);
            return;
        }
			
    });
// ==========================================
    // 🟢 NOUVEAUX ÉCOUTEURS : BOUTON RÉGÉNÉRER
    // ==========================================
    
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

    // 2. Écouteur sur la transcription (Le "Corpus" de la vidéo)
    //const transcriptArea = _pane.querySelector('#vid-transcript-display');
    if (transcriptArea) {
        transcriptArea.addEventListener('input', showRegenerateButton);
    }

    // 3. Écouteurs sur les réglages IA (Température, Types d'interactions, Nombre)
    const tempSlider = _pane.querySelector('#vid-temperature');
    if (tempSlider) tempSlider.addEventListener('change', showRegenerateButton);
	
	const sumEndCb = _pane.querySelector('#vid-summary-at-end');
	    if (sumEndCb) sumEndCb.addEventListener('change', showRegenerateButton);

	const sumEndSec = _pane.querySelector('#vid-summary-end-seconds');
	    if (sumEndSec) {
	        sumEndSec.addEventListener('input', showRegenerateButton);
	        sumEndSec.addEventListener('change', showRegenerateButton);
	    }


    _pane.querySelectorAll('.vid-itype-cb, .vid-count-input').forEach(el => {
        el.addEventListener('input', showRegenerateButton);
        el.addEventListener('change', showRegenerateButton);
    });
}

function _renderBookmarks() {
    const list = _pane.querySelector('#vid-bookmarks-list');
    if (!list) return;
    list.innerHTML = _bookmarks.map((b, i) => `
        <div style="display:flex; justify-content:space-between; background:var(--page-bg); padding:6px 10px; border-radius:4px; align-items:center;">
            <span style="font-family:monospace; font-weight:bold; color: var(--hapi-accent-text);">${b.timestamp}</span>
            <span style="flex:1; margin-left:10px;">${_esc(b.label)}</span>
            <button class="vid-del-bm" data-idx="${i}" style="border:none; background:none; cursor:pointer; color:var(--danger-text);">✕</button>
        </div>
    `).join('');
}



// ─── Génération des interactions via Albert ────────────────────────────────────
async function _handleGenerateInteractions() {
    if (!_videoMetadata.transcript || !_videoMetadata.segments.length) {
        _setStatus('vid-generate-status', 'error', '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> Transcription non disponible.');
        return;
    }

    const typeCounts = _readTypeCounts();
    if (!Object.keys(typeCounts).length) {
        _setStatus('vid-generate-status', 'error', '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> Sélectionnez au moins un type d\'interaction.');
        return;
    }

    const btn = _pane.querySelector('#vid-generate-btn');
    btn.disabled = true;
    btn.innerHTML = 'Génération en cours…<span class="vid-spinner"></span>';
    _setStatus('vid-generate-status', 'info', 'Génération en cours…');

    const temperature = parseFloat(_pane.querySelector('#vid-temperature').value);

    try {
        const formattedTranscript = _pane.querySelector('#vid-transcript-display').value;

        const videoDur = _secondsToTs(_videoMetadata.duration);

// 👇 1. On récupère la langue globale
        const currentLang = document.getElementById('global-language')?.value || 'Français';

        // 🧠 NOUVEAU : On récupère toute la cascade pédagogique
        const scolarite = document.getElementById('global-scolarite')?.value || '';
        const cycle = document.getElementById('global-cycle-voie')?.value || '';
        const niveauSelect = document.getElementById('global-niveau')?.value || '';

        // On filtre les valeurs vides et on construit la chaîne de contexte
        const niveau = [scolarite, cycle, niveauSelect]
            .filter(val => val && val !== "")
            .join(' > ') || 'Général';

        const discipline = document.getElementById('global-discipline')?.value || 'Générale';

        const summaryGroupsCount = parseInt(_pane.querySelector('#vid-groups-summary')?.value) || 1;
        const summaryCount = typeCounts['summary'] || 0;

        const typesList = Object.entries(typeCounts)
            .map(([t, n]) => `${n} interaction(s) de type "${t}"`)
            .join(', ');

        // 👇 ON APPELLE LA FONCTION EXTERNALISÉE ICI AVEC LES NOUVEAUX PARAMÈTRES
        const summaryAtEnd = _pane.querySelector('#vid-summary-at-end')?.checked;
        const prompt = genererPrompt_H5PVideo(
            videoDur,
            formattedTranscript,
            typesList,
            currentLang,
            summaryCount,
            summaryGroupsCount,
            summaryAtEnd,
            niveau,      // ⬅️ AJOUT ICI
            discipline   // ⬅️ AJOUT ICI
        );

        // Appel Albert API (compatible OpenAI) via proxy
        let interactions = await _callAlbertInteractions(prompt, temperature);

        // Filtrage sur les types réellement demandés
        const requestedTypes = Object.keys(typeCounts);
        interactions = interactions.filter(i => requestedTypes.includes(i.type));

        // 🔁 COMPLÉTION : si l'IA a livré moins d'interactions que demandé pour un
        // type, on RELANCE l'IA pour générer UNIQUEMENT les manquantes (en lui
        // transmettant les questions déjà produites pour qu'elle ne les répète pas),
        // puis on dédoublonne. On ne clone JAMAIS à l'identique (ancien bug : 6 QCM
        // demandés → 6 fois la même question). Borné à 2 relances ; repli honnête sinon.
        const MAX_COMPLETION_TRIES = 2;
        for (let attempt = 0; attempt < MAX_COMPLETION_TRIES; attempt++) {
            const missing = {};
            for (const [type, count] of Object.entries(typeCounts)) {
                if (type === 'summary') continue; // résumés gérés à part, jamais clonés
                const actual = interactions.filter(i => i.type === type).length;
                if (actual < count) missing[type] = count - actual;
            }
            if (!Object.keys(missing).length) break;

            const missingList = Object.entries(missing)
                .map(([t, n]) => `${n} interaction(s) de type "${t}"`)
                .join(', ');

            const dejaVues = interactions
                .map(i => (i.data?.question || i.data?.text || i.data?.instruction || '').toString().trim())
                .filter(Boolean);
            const avoid = `⚠️ COMPLÉTION : Les interactions ci-dessous ont DÉJÀ été générées. Tu dois produire des interactions TOTALEMENT DIFFÉRENTES (autres concepts, autres passages de la transcription, autres formulations). Ne les répète JAMAIS :\n${dejaVues.map(q => `- ${q}`).join('\n')}`;

            const completionPrompt = genererPrompt_H5PVideo(
                videoDur, formattedTranscript, missingList, currentLang,
                0, summaryGroupsCount, false, niveau, discipline, avoid
            );

            let extra;
            try {
                extra = await _callAlbertInteractions(completionPrompt, temperature);
            } catch (e) {
                logger.error('Complétion interactions vidéo : ' + e.message);
                break; // on garde ce qu'on a (repli honnête plutôt que des doublons)
            }

            // Fusion : seulement les types encore manquants, sans doublon
            const seen = new Set(interactions.map(_interactionKey));
            for (const it of extra) {
                if (!missing[it.type]) continue;
                const key = _interactionKey(it);
                if (seen.has(key)) continue;
                seen.add(key);
                interactions.push(it);
                missing[it.type]--;
                if (missing[it.type] <= 0) delete missing[it.type];
            }
        }

        // Tri chronologique
        interactions.sort((a, b) => _tsToSeconds(a.timestamp) - _tsToSeconds(b.timestamp));

        _generatedInteractions = interactions;
        _renderInteractionEditor(_generatedInteractions);

        _showBlock('vid-step-editor');
        _showBlock('vid-step-settings');

        // Bilan honnête : a-t-on atteint le quota demandé pour chaque type ?
        // Le résumé (summary) est inclus dans l'alerte (il n'est jamais complété
        // automatiquement) mais le décompte reste fiable ici : la mise à l'écart du
        // dernier résumé (summaryAtEnd) n'intervient que plus tard, dans le générateur.
        const shortfall = Object.entries(typeCounts)
            .map(([t, n]) => ({ type: t, manque: n - interactions.filter(i => i.type === t).length }))
            .filter(s => s.manque > 0);

        if (shortfall.length) {
            const detail = shortfall.map(s => `${_typeLabel(s.type)} (${s.manque} de moins)`).join(', ');
            _setStatus('vid-generate-status', 'info', `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> ${interactions.length} interaction(s) générée(s) au lieu du nombre demandé pour : ${detail}. Le contenu de la vidéo ne permet pas de créer davantage de questions distinctes et pertinentes sur ces points (transcription trop courte ou trop peu dense). ⚠️ Relancer la génération ne donnera pas plus de questions (cela repart de zéro). Pour en obtenir davantage : réduisez le nombre demandé, choisissez une vidéo plus longue ou plus riche, ou ajoutez les interactions manquantes manuellement ci-dessous.`);
        } else {
            _setStatus('vid-generate-status', 'ok', `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> ${interactions.length} interaction(s) générée(s).`);
        }
        _onValidCallback && _onValidCallback();

    } catch (err) {
        _setStatus('vid-generate-status', 'error', `✕ ${err.message}`);
        logger.error('Génération interactions vidéo : ' + err.message);
	} finally {
	        btn.disabled = false;
	        // 🟢 On réinitialise l'état visuel au bouton Albert de base
	        btn.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer les interactions par IA';
	        btn.style.background = 'linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark))';
	        btn.style.boxShadow = '0 4px 15px rgba(var(--hapi-green-rgb), 0.3)';
	    }
}

// ─── Éditeur d'interactions ───────────────────────────────────────────────────
function _renderInteractionEditor(interactions) {
    const list = _pane.querySelector('#vid-interaction-list');
    if (!list) return;
    list.innerHTML = '';

    if (!interactions.length) {
        list.innerHTML = '<p style="color:var(--text-muted); padding:12px;">Aucune interaction.</p>';
        return;
    }

    interactions.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'vid-card vid-card-collapsed';
        card.dataset.idx = idx;

        const badge = _typeBadge(item.type);
        let contentHtml = _buildEditorContent(item, idx);

        const idPrefix = `vid-inter-${idx}`;
        const feedbackIntervalsHTML = `
            <div style="margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 10px;">
                <details>
                    <summary style="cursor:pointer;font-size:0.88em;color:var(--text-muted);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Intervalles de feedback spécifiques</summary>
                    <div style="margin-top:10px;">
                        ${creerFeedbackIntervallesHTML(idPrefix, '')}
                    </div>
                </details>
            </div>
        `;

        // 🌟 NOUVEAU : Bloc des réglages génériques (Titre, Label, Pause, Fin)
        const tsStart = item.timestamp || '00:00';
        const tsEnd = item.timestampEnd || _secondsToTs(_tsToSeconds(tsStart) + 5);
        
        const genericSettingsHtml = `
            <div style="background:var(--page-bg); padding:12px; border-radius:6px; margin-bottom:14px; border:1px solid var(--border); display:flex; flex-direction:column; gap:12px;">
                <div style="display:flex; gap:15px; align-items:center;">
                     <label style="font-size:0.9em; display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:600; color: var(--hapi-accent-text);">
                        <input type="checkbox" class="vid-edit-pause" ${item.pause !== false ? 'checked' : ''}>
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg> Mettre la vidéo sur pause à l'apparition du bouton
                    </label>
                </div>
                <div style="display:flex; gap:15px;">
                    <div style="flex:1;">
                        <label class="vid-label" style="font-size:0.85em; color:var(--text-muted); margin-bottom:4px;">Titre interne (Métadonnées)</label>
                        <input type="text" class="vid-edit-title vid-input" value="${_esc(item.title || '')}" placeholder="Ex: QCM Planètes" style="padding:6px 10px; font-size:0.9em;">
                    </div>
                    <div style="flex:1;">
                        <label class="vid-label" style="font-size:0.85em; color:var(--text-muted); margin-bottom:4px;">Étiquette (affichée à côté du bouton)</label>
                        <input type="text" class="vid-edit-label vid-input" value="${_esc(item.label || '')}" placeholder="Ex: Cliquez ici" style="padding:6px 10px; font-size:0.9em;">
                    </div>
                </div>
            </div>
        `;

        card.innerHTML = `
            <div class="vid-card-header">
                <span class="vid-card-arrow">▼</span>
                <span class="vid-card-num">${idx + 1}.</span>
                <span class="vid-type-badge">${badge}</span>
                <div style="margin-left:auto; display:flex; align-items:center; gap:6px;">
                    <label style="font-size:0.85em; color:var(--text-muted);">⏱</label>
                    <input type="text" class="vid-ts-input" value="${tsStart}" style="width:55px; text-align:center; border:1px solid var(--border); border-radius:4px; padding:4px; font-family:monospace;">
                    <span style="color:var(--text-muted); font-weight:bold;">-</span>
                    <input type="text" class="vid-ts-end-input" value="${tsEnd}" style="width:55px; text-align:center; border:1px solid var(--border); border-radius:4px; padding:4px; font-family:monospace;">
                </div>
                <button type="button" class="vid-del-btn" data-idx="${idx}" title="Supprimer l'interaction" aria-label="Supprimer l'interaction" style="margin-left:10px; color:var(--text-muted);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
            </div>
            <div class="vid-card-body">
                ${genericSettingsHtml}
                ${contentHtml}
                ${_adaptivityHtml()}
                ${feedbackIntervalsHTML}
            </div>
        `;

        // 🌟 NOUVEAU : Sync en live des deux timestamps
        card.querySelector('.vid-ts-input').addEventListener('input', e => {
            _generatedInteractions[idx].timestamp = e.target.value;
        });
        card.querySelector('.vid-ts-end-input').addEventListener('input', e => {
            _generatedInteractions[idx].timestampEnd = e.target.value;
        });

        list.appendChild(card);

        initFeedbackIntervalles(idPrefix);
        if (item.overallFeedback) {
            setFeedbackIntervallesData(idPrefix, item.overallFeedback);
        }
    });

    if (list.firstElementChild) list.firstElementChild.classList.remove('vid-card-collapsed');
}

// ─── Ajout Manuel d'une Interaction ───────────────────────────────────────────
function _handleManualAdd() {
    // 1. Sauvegarder ce qui est en cours de saisie
    syncEditorToState();

    const type = _pane.querySelector('#vid-manual-type').value;
    
    // 2. Créer un objet par défaut selon le type choisi
    let newItem = {
        type: type,
        timestamp: "00:00", // Par défaut au début, l'utilisateur modifiera
        data: {}
    };

    if (type === 'quiz') {
        newItem.data = { question: "Nouvelle question ?", options: ["Option 1", "Option 2"], correct: 0 };
    } else if (type === 'multichoice') {
        newItem.data = { question: "Nouvelle question ?", options: ["Option 1", "Option 2", "Option 3"], correct: [0] };
    } else if (type === 'truefalse') {
        newItem.data = { question: "Cette affirmation est vraie.", answer: true };
    } else if (type === 'fillblanks' || type === 'dragtext' || type === 'markthewords') {
        newItem.data = { instruction: "Trouvez le bon mot", text: "Voici le *mot* caché." };
    } else if (type === 'summary') {
        newItem.data = { statements: [{ correct: "Bonne affirmation", distractors: ["Mauvaise affirmation"] }] };
    }

    // 3. Ajouter à la liste et trier chronologiquement
    _generatedInteractions.push(newItem);
    _generatedInteractions.sort((a, b) => _tsToSeconds(a.timestamp) - _tsToSeconds(b.timestamp));
    
    // 4. Redessiner et afficher les blocs finaux
    _renderInteractionEditor(_generatedInteractions);
    
    _showBlock('vid-step-editor');
    _showBlock('vid-step-settings');
    _showBlock('vid-step-finalize');

    _onValidCallback && _onValidCallback();
}



function _buildEditorContent(item, idx) {
    const d = item.data || {};
    if (item.type === 'imported') {
        return `<p style="padding:10px;background:var(--hapi-green-pale);border-radius:5px;">
                    <strong>Activité H5P importée</strong> — <em>${item.libraryTitle || ''}</em>
                </p>`;
    }
	if (item.type === 'quiz' || item.type === 'multichoice') {
	        const isMulti = item.type === 'multichoice';
	        const opts = d.options || ['', '', ''];
        
	        let correctData = d.correct;
	        if (isMulti && !Array.isArray(correctData)) {
	            correctData = (correctData !== undefined && correctData !== null) ? [correctData] : [];
	        }

	        const isCorrect = (i) => isMulti ? correctData.includes(i) : i === d.correct;
	        const inputType = isMulti ? 'checkbox' : 'radio';

	        return `
	            <div class="vid-field"><label class="vid-label">Question</label>
	                <input type="text" class="vid-edit-question vid-input" value="${_esc(d.question || '')}"></div>
	            <div class="vid-field"><label class="vid-label">Options (cocher la/les bonne(s) réponse(s))</label>
	                <div class="vid-options-container">
	                ${opts.map((o, i) => `
	                    <div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
	                        <input type="${inputType}" name="vid-correct-${idx}" class="vid-correct-opt" value="${i}" ${isCorrect(i) ? 'checked' : ''}>
	                        <input type="text" class="vid-option-text vid-input" data-opt="${i}" value="${_esc(o)}" style="flex:1;">
	                        <button type="button" class="vid-del-opt-btn" data-idx="${idx}" data-optidx="${i}" style="border:none;background:none;cursor:pointer;color:var(--text-muted);font-size:1.1em;" title="Supprimer cette option" aria-label="Supprimer cette option"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
	                    </div>`).join('')}
						</div>
			                <button type="button" class="vid-add-opt-btn vid-btn" data-idx="${idx}" style="padding:4px 10px; font-size:0.75em; margin-top:6px; background:var(--page-bg); color:var(--text-muted); border:1px solid var(--border);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Ajouter une option</button>
			            </div>`;
	    }
    if (item.type === 'truefalse') {
        return `
            <div class="vid-field"><label class="vid-label">Affirmation</label>
                <input type="text" class="vid-edit-question vid-input" value="${_esc(d.question || '')}"></div>
			<div class="vid-field"><label class="vid-label">Réponse correcte</label>
                <select class="vid-edit-answer vid-input" style="width:auto;">
                    <option value="true"  ${d.answer === true  ? 'selected' : ''}>Vrai</option>
                    <option value="false" ${d.answer === false ? 'selected' : ''}>Faux</option>
                </select>
            </div>`;
    }
	if (item.type === 'fillblanks' || item.type === 'dragtext' || item.type === 'markthewords') {
	        return `
	            <div class="vid-field"><label class="vid-label">Instruction</label>
	                <input type="text" class="vid-edit-instruction vid-input" value="${_esc(d.instruction || '')}"></div>
	            <div class="vid-field"><label class="vid-label">Texte (les *mots* entre astérisques sont interactifs)</label>
	                <textarea class="vid-edit-text vid-input" rows="3">${_esc(d.text || '')}</textarea></div>`;
	}	
	if (item.type === 'summary') {
	        const statements = d.statements || [{ correct: '', distractors: [''] }];
	        return `
	            <div class="vid-field">
	                <label class="vid-label">Séquences du résumé (1 correcte, plusieurs fausses)</label>
	                <div class="vid-summary-container" style="display:flex; flex-direction:column; gap:14px; margin-top:8px;">
	                ${statements.map((group, gIdx) => `
	                    <div class="vid-summary-group" style="background:var(--page-bg); padding:12px; border:1px solid var(--border); border-radius:6px; position:relative;">
	                        <button type="button" class="vid-del-group-btn" data-idx="${idx}" data-gidx="${gIdx}" style="position:absolute; top:5px; right:5px; border:none; background:none; cursor:pointer; color:var(--text-muted);" title="Supprimer cette séquence" aria-label="Supprimer cette séquence"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
                        
	                        <div class="vid-field" style="margin-bottom:8px;">
	                            <label style="font-size:0.8em; color: var(--hapi-accent-text); font-weight:bold;">✓ Bonne affirmation</label>
	                            <input type="text" class="vid-sum-correct vid-input" value="${_esc(group.correct || '')}" style="border-color:rgba(34, 197, 94, 0.45); background:rgba(34, 197, 94, 0.12);">
	                        </div>
                        
	                        <div class="vid-field">
	                            <label style="font-size:0.8em; color:#dc2626; font-weight:bold;">✗ Distracteurs (Fausses affirmations)</label>
	                            <div style="margin-left:10px; display:flex; flex-direction:column; gap:6px; margin-top:6px;">
	                            ${(group.distractors || []).map((dist, dIdx) => `
	                                <div style="display:flex; gap:6px; align-items:center;">
	                                    <input type="text" class="vid-sum-dist vid-input" data-didx="${dIdx}" value="${_esc(dist)}" style="border-color:rgba(220, 38, 38, 0.35); background:rgba(220, 38, 38, 0.10);">
	                                    <button type="button" class="vid-del-dist-btn" data-idx="${idx}" data-gidx="${gIdx}" data-didx="${dIdx}" style="border:none;background:none;cursor:pointer;color:var(--text-muted);" title="Supprimer ce distracteur" aria-label="Supprimer ce distracteur"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
	                                </div>
	                            `).join('')}
	                            </div>
	                            <button type="button" class="vid-add-dist-btn vid-btn" data-idx="${idx}" data-gidx="${gIdx}" style="padding:4px 10px; font-size:0.75em; margin-top:8px; background:var(--surface); border:1px dashed var(--border); color:var(--text-muted);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Ajouter un distracteur</button>
	                        </div>
	                    </div>
	                `).join('')}
	                </div>
	                <button type="button" class="vid-add-group-btn vid-btn" data-idx="${idx}" style="padding:6px 12px; font-size:0.8em; margin-top:12px; background:var(--hapi-green-pale); color: var(--hapi-accent-text); border:1px solid var(--border-strong);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Ajouter une nouvelle séquence au résumé</button>
	            </div>`;
	    }
    return `<p style="color:var(--text-muted);">Type inconnu : ${item.type}</p>`;
}

function _adaptivityHtml() {
    return `<details style="margin-top:14px;">
        <summary style="cursor:pointer;font-size:0.88em;color:var(--text-muted);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg> Adaptivité (optionnel)</summary>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;">
            <fieldset style="border:1px solid var(--hapi-grad-a);border-radius:6px;padding:8px;">
                <legend style="color: var(--hapi-accent-text);font-size:0.85em;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Si bonne réponse</legend>
                <div class="vid-field"><label class="vid-label">Aller à (MM:SS)</label>
                    <input type="text" class="vid-adapt-ok-seek vid-input" placeholder="01:30"></div>
                <div class="vid-field"><label class="vid-label">Message</label>
                    <input type="text" class="vid-adapt-ok-msg vid-input"></div>
            </fieldset>
            <fieldset style="border:1px solid var(--border);border-radius:6px;padding:8px;">
                <legend style="color:var(--text-muted);font-size:0.85em;">✕ Si mauvaise réponse</legend>
                <div class="vid-field"><label class="vid-label">Aller à (MM:SS)</label>
                    <input type="text" class="vid-adapt-ko-seek vid-input" placeholder="00:45"></div>
                <div class="vid-field"><label class="vid-label">Message</label>
                    <input type="text" class="vid-adapt-ko-msg vid-input"></div>
            </fieldset>
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:0.88em;">
            <input type="checkbox" class="vid-require-completion">
            Exiger une réponse correcte pour continuer
        </label>
    </details>`;
}

// ─── Import H5P externe ────────────────────────────────────────────────────────
async function _handleImportH5P() {
    const fileInput = _pane.querySelector('#vid-h5p-file');
    const tsInput   = _pane.querySelector('#vid-h5p-ts');
    if (!fileInput.files.length) { alert('Veuillez sélectionner un fichier .h5p'); return; }
    const ts = tsInput.value;
    if (!/^\d{2}:\d{2}$/.test(ts)) { alert('Timestamp invalide (format MM:SS requis)'); return; }

    try {
        const zip       = await JSZip.loadAsync(fileInput.files[0]);
        const h5pJson   = JSON.parse(await zip.file('h5p.json').async('string'));
        const contentJson = JSON.parse(await zip.file('content/content.json').async('string'));

        let mainLib = h5pJson.mainLibrary;
        let major   = h5pJson.majorVersion;
        let minor   = h5pJson.minorVersion;

        if (major === undefined) {
            const dep = (h5pJson.preloadedDependencies || []).find(d => d.machineName === mainLib);
            if (dep) { major = dep.majorVersion; minor = dep.minorVersion; }
        }

        const interaction = {
            type: 'imported',
            timestamp: ts,
            libraryTitle: h5pJson.title || `${mainLib} ${major}.${minor}`,
            action: {
                library: `${mainLib} ${major}.${minor}`,
                params: contentJson,
                subContentId: _genSubContentId(),
                metadata: { contentType: h5pJson.title || 'Imported', license: 'U' }
            }
        };

        _generatedInteractions.push(interaction);
        _generatedInteractions.sort((a, b) => _tsToSeconds(a.timestamp) - _tsToSeconds(b.timestamp));
        _renderInteractionEditor(_generatedInteractions);
        _onValidCallback && _onValidCallback();
        fileInput.value = '';
        tsInput.value   = '';
    } catch (err) {
        alert('Erreur lors de la lecture du H5P : ' + err.message);
    }
}

// ─── Collecte des données de l'éditeur ────────────────────────────────────────
/**
 * Lit les valeurs saisies dans l'éditeur et met à jour _generatedInteractions.
 * Appelé juste avant gatherData() dans h5p-video-generator.js.
 */
export function syncEditorToState() {
    const cards = _pane ? _pane.querySelectorAll('#vid-interaction-list .vid-card') : [];
    cards.forEach((card, idx) => {
        if (idx >= _generatedInteractions.length) return;
        const item = _generatedInteractions[idx];

        item.timestamp = card.querySelector('.vid-ts-input')?.value || item.timestamp;
	
// 🌟 NOUVEAU : Sauvegarde des réglages génériques
        item.timestampEnd = card.querySelector('.vid-ts-end-input')?.value || item.timestampEnd;
        item.title = card.querySelector('.vid-edit-title')?.value || '';
        item.label = card.querySelector('.vid-edit-label')?.value || '';
        const pauseCheckbox = card.querySelector('.vid-edit-pause');
        if (pauseCheckbox) item.pause = pauseCheckbox.checked;

	// 🌟 SAUVEGARDE DU TITRE PRINCIPAL
	    const mainTitleInput = _pane.querySelector('#vid-main-title');
	    if (mainTitleInput) {
	        _videoMetadata.mainTitle = mainTitleInput.value;
	    }

        const d = item.data || {};
		if (item.type === 'quiz' || item.type === 'multichoice') {
		    d.question = card.querySelector('.vid-edit-question')?.value || '';
		    d.options  = Array.from(card.querySelectorAll('.vid-option-text')).map(i => i.value);
            
		            // Si c'est multichoice, on stocke un tableau des index cochés. Sinon un seul int.
		if (item.type === 'multichoice') {
		    d.correct = Array.from(card.querySelectorAll('.vid-correct-opt:checked')).map(cb => parseInt(cb.value));
		} else {
		    const checked = card.querySelector('.vid-correct-opt:checked');
		    d.correct  = checked ? parseInt(checked.value) : 0;
		    }
        } else if (item.type === 'truefalse') {
            d.question = card.querySelector('.vid-edit-question')?.value || '';
            d.answer   = card.querySelector('.vid-edit-answer')?.value === 'true'; 
		} else if (['fillblanks', 'dragtext', 'markthewords'].includes(item.type)) {
		    d.instruction = card.querySelector('.vid-edit-instruction')?.value || '';
		    d.text   	  = card.querySelector('.vid-edit-text')?.value || '';
		} else if (item.type === 'summary') {
		            const groups = Array.from(card.querySelectorAll('.vid-summary-group'));
		            d.statements = groups.map(g => {
		                const correct = g.querySelector('.vid-sum-correct')?.value || '';
		                const distractors = Array.from(g.querySelectorAll('.vid-sum-dist')).map(inp => inp.value);
		                return { correct, distractors };
		            }).filter(s => s.correct || s.distractors.some(dist => dist)); // On garde si au moins un champ est rempli
		        }

        // Adaptivité
        const adaptivity = { requireCompletion: card.querySelector('.vid-require-completion')?.checked || false };
        const okSeek = card.querySelector('.vid-adapt-ok-seek')?.value;
        if (okSeek && /^\d{2}:\d{2}$/.test(okSeek)) {
            adaptivity.correct = { seekTo: _tsToSeconds(okSeek), message: card.querySelector('.vid-adapt-ok-msg')?.value || '' };
        }
        const koSeek = card.querySelector('.vid-adapt-ko-seek')?.value;
        if (koSeek && /^\d{2}:\d{2}$/.test(koSeek)) {
            adaptivity.wrong = { seekTo: _tsToSeconds(koSeek), message: card.querySelector('.vid-adapt-ko-msg')?.value || '' };
        }
        item.adaptivity = adaptivity;
        item.data = d;
		
// --- COLLECTE DES INTERVALLES DE FEEDBACK ---
        const idPrefix = `vid-inter-${idx}`;
        item.overallFeedback = getFeedbackIntervallesData(idPrefix);
    });
}

// ─── Lecture des réglages globaux ─────────────────────────────────────────────
function _readGlobalSettings() {
    if (!_pane) return {};
    return {
        navigationControl: _pane.querySelector('#vid-nav-control')?.value || 'none',
        enableSubmitScreen: _pane.querySelector('#vid-enable-submit')?.checked ?? true,
        translateUI: _pane.querySelector('#vid-translate-ui')?.checked ?? true,
        summaryAtEnd: _pane.querySelector('#vid-summary-at-end')?.checked ?? true,
        summaryEndSeconds: parseInt(_pane.querySelector('#vid-summary-end-seconds')?.value) || 3
    };
}

function _applyGlobalSettings(s) {
    if (!s || !_pane) return;
    const navEl = _pane.querySelector('#vid-nav-control');
    if (navEl) navEl.value = s.navigationControl || 'none';
    
    const submitEl = _pane.querySelector('#vid-enable-submit');
    if (submitEl) submitEl.checked = s.enableSubmitScreen ?? true;

    const transEl = _pane.querySelector('#vid-translate-ui');
    if (transEl) transEl.checked = s.translateUI ?? true;

    const sumCb = _pane.querySelector('#vid-summary-at-end');
    if (sumCb) sumCb.checked = s.summaryAtEnd ?? true;

    const sumSec = _pane.querySelector('#vid-summary-end-seconds');
    if (sumSec) sumSec.value = s.summaryEndSeconds || 3;
}

function _readTypeCounts() {
    const counts = {};
    _pane.querySelectorAll('.vid-itype-cb').forEach(cb => {
        if (cb.checked) {
            const n = parseInt(_pane.querySelector(`#vid-count-${cb.value}`)?.value) || 0;
            if (n > 0) counts[cb.value] = n;
        }
    });
    return counts;
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────
function _showBlock(id) {
    const el = _pane.querySelector(`#${id}`);
    if (el) el.style.display = '';
}

function _setStatus(id, type, msg) {
    const el = _pane.querySelector(`#${id}`);
    if (!el) return;
    const colors = { ok: 'var(--hapi-green-mist)', error: 'rgba(220, 38, 38, 0.12)', info: 'var(--hapi-green-mist)' };
    const borders = { ok: 'var(--hapi-grad-a)', error: '#dc2626', info: 'var(--hapi-green)' };
    el.style.cssText = `display:block; padding:10px 14px; margin-top:20px; border-radius:8px; border-left:4px solid ${borders[type]}; background:${colors[type]}; color: var(--text); font-size:0.9em;`;
    el.innerHTML = msg; // msg contient des icônes SVG (markup interne, jamais de contenu utilisateur/IA)
}

function _typeBadge(type) {
    const map = {
        quiz: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg> Choix unique', multichoice: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Choix multiples', truefalse: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Vrai/Faux', fillblanks: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg> Texte à trous',
        dragtext: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg> Étiquettes', markthewords: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Mots à repérer', summary: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg> Résumé', imported: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg> Importé'
    };
    return map[type] || type;
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function _secondsToTs(s) {
    const t = Math.round(s);
    return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
}

function _tsToSeconds(ts) {
    const p = (ts || '00:00').split(':');
    return parseInt(p[0] || 0) * 60 + parseInt(p[1] || 0);
}

function _normalizeVideoUrl(url) {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/);
    if (ytMatch) return `https://www.youtube.com/watch?v=${ytMatch[1]}`;
    return url;
}

function _detectMime(url) {
    if (/youtube\.com|youtu\.be/i.test(url)) return 'video/YouTube';
    // ✅ Ajout de reseau-canope.fr pour forcer le lecteur MP4 de H5P
    if (/\.mp4/i.test(url) || /podeduc|pod\.ac-normandie/i.test(url) || /reseau-canope\.fr/i.test(url)) return 'video/mp4';
    if (/\.webm/i.test(url)) return 'video/webm';
    return 'video/mp4'; // Fallback par défaut
}

function _genSubContentId() {
    return `subcontent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function _deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
function _esc(s) { return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

// Libellé lisible d'un type d'interaction (pour les messages de statut).
function _typeLabel(type) {
    const map = {
        quiz: 'QCM (Choix unique)', multichoice: 'QCM (Choix multiples)',
        truefalse: 'Vrai/Faux', fillblanks: 'Texte à trous',
        dragtext: 'Étiquettes', markthewords: 'Mots à repérer', summary: 'Résumé'
    };
    return map[type] || type;
}

// Clé de comparaison d'une interaction (dédoublonnage entre appels IA).
function _interactionKey(it) {
    const d = it?.data || {};
    const base = (d.question || d.text || d.instruction || '')
        .toString().toLowerCase().replace(/\s+/g, ' ').trim();
    return `${it?.type || ''}::${base}`;
}

// Balisage *mot* côté client à partir du tableau "words" (le texte arrive nu :
// l'IA ne met plus d'astérisques, que n8n strippait même dans le JSON).
function _baliseMarkerWords(interactions) {
    const MARKER_TYPES = new Set(['fillblanks', 'dragtext', 'markthewords']);
    for (const it of interactions) {
        if (it && it.data && MARKER_TYPES.has(it.type)) {
            if (Array.isArray(it.data.words) && it.data.words.length) {
                it.data.text = _markWordsInText(it.data.text || '', it.data.words, it.type === 'dragtext');
            }
            delete it.data.words;
        }
    }
    return interactions;
}

// Appel Albert (proxy n8n, format compatible OpenAI) → tableau d'interactions
// parsé et balisé. Lève en cas d'échec HTTP ou de JSON absent.
async function _callAlbertInteractions(prompt, temperature) {
    let rawText;
    if (window.parent && typeof window.parent.makeNonStreamingRequest === 'function') {
        rawText = await window.parent.makeNonStreamingRequest(prompt, {
            tool: 'professor',
            temperature,
            options: {
                temperature
            }
        });
    } else {
        const resp = await fetch(ALBERT_CHAT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'openweight-large',
                messages: [{ role: 'user', content: prompt }],
                temperature,
                max_tokens: 8192
            })
        });
        if (!resp.ok) throw new Error(`IA HTTP ${resp.status}`);

        const aiData = await resp.json();
        rawText = aiData.choices?.[0]?.message?.content || '';
    }

    // Extraction JSON robuste
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('IA n\'a pas retourné un JSON valide.');

    const parsed = JSON.parse(jsonMatch[0]);
    return _baliseMarkerWords(Array.isArray(parsed) ? parsed : []);
}

// Balise chaque occurrence des mots cibles au format H5P *mot*. Marquage côté client
// (à partir du tableau "words") = exhaustif et insensible au strip d'astérisques de n8n.
function _markWordsInText(text, words, oncePerWord = false) {
    if (!text || !Array.isArray(words) || words.length === 0) return text || '';
    // Nettoie, déduplique, plus longs d'abord (priorité aux éventuels groupes)
    const uniq = [...new Set(
        words.map(w => String(w).replace(/[\[\]*]/g, '').trim()).filter(Boolean)
    )].sort((a, b) => b.length - a.length);
    if (uniq.length === 0) return text;

    const escaped = uniq.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    let re;
    try {
        // Frontières Unicode ; on exclut * pour ne pas re-baliser un mot déjà entouré
        re = new RegExp('(?<![\\p{L}\\p{N}_*])(' + escaped.join('|') + ')(?![\\p{L}\\p{N}_*])', 'gu');
    } catch (e) {
        re = new RegExp('(' + escaped.join('|') + ')', 'g');
    }
    // oncePerWord : une seule occurrence balisée par mot. Pour "dragtext" : un mot
    // récurrent dans le texte ("eau" ×3) produirait sinon plusieurs étiquettes
    // identiques (sans intérêt). Mark the Words / Blanks balisent toutes les occurrences.
    const seen = new Set();
    let out = text.replace(re, (m, g1) => {
        if (oncePerWord) {
            const key = g1.toLocaleLowerCase('fr');
            if (seen.has(key)) return g1;   // déjà balisé → on laisse le texte nu
            seen.add(key);
        }
        return '*' + g1 + '*';
    });

    // H5P (Mark the Words / Blanks / Drag Text) tokenise par espaces et bugue si
    // l'astérisque est collée à une apostrophe (d'*eau*) : le mot élidé est avalé.
    // On insère une espace pour isoler le mot (d' *eau*). Vaut pour les 3 types.
    out = out.replace(/(['’‘])\*/g, '$1 *');

    return out;
}

// ─── Injection CSS du module ──────────────────────────────────────────────────
function _injectStyles() {
    if (document.getElementById('vid-ui-styles')) return;
    const s = document.createElement('style');
    s.id = 'vid-ui-styles';
    s.textContent = `
    .vid-step { margin-bottom: 24px; }
    .vid-step-title { font-size: 1.05rem; font-weight: 700; color: var(--text); margin-bottom: 14px; padding-bottom: 6px; border-bottom: 2px solid var(--border); }
    .vid-field { margin-bottom: 10px; }
    .vid-label { display: block; font-weight: 600; font-size: 0.88em; color: var(--text-muted); margin-bottom: 4px; }
    .vid-input { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.9em; background: var(--surface); box-sizing: border-box; }
    .vid-input:focus { outline: none; border-color: var(--hapi-green-dark); box-shadow: 0 0 0 3px rgba(var(--hapi-green-rgb),0.1); }
    .vid-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; border: none; border-radius: 22px; cursor: pointer; font-size: 0.95rem; font-weight: 700; transition: all 0.2s; }
    .vid-btn:disabled { background: var(--border); color: var(--text-muted); cursor: not-allowed; }
    .vid-btn-primary { background: linear-gradient(135deg, var(--hapi-green-dark), var(--hapi-grad-a)); color: #fff; }
    .vid-btn-primary:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(var(--hapi-green-rgb),0.35); }
    .vid-btn-warning { background: linear-gradient(135deg, #d97706, #fbbf24); color: #1c1917; }
    .vid-btn-warning:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(217,119,6,0.35); }
    .vid-choice-card { background: var(--page-bg); border: 2px solid var(--border); border-radius: 8px; padding: 12px 14px; transition: all 0.2s; }
    .vid-choice-card.vid-choice-active { border-color: var(--hapi-green-dark); background: var(--hapi-green-mist); }
    .vid-count-input { border: 1px solid var(--border); border-radius: 4px; padding: 4px 6px; font-size: 0.9em; }
    .vid-step input[type="checkbox"], .vid-step input[type="radio"],
    .vid-card input[type="checkbox"], .vid-card input[type="radio"],
    .vid-choice-card input[type="checkbox"], .vid-choice-card input[type="radio"],
    .vid-itype-cb, .vid-edit-pause, .vid-require-completion, .vid-correct-opt { accent-color: var(--hapi-green); }
    .vid-card { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--hapi-green-dark); border-radius: 8px; margin-bottom: 10px; overflow: hidden; }
    .vid-card-header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; cursor: pointer; user-select: none; background: var(--page-bg); }
    .vid-card-header:hover { background: var(--page-bg); }
    .vid-card-arrow { font-size: 0.8em; transition: transform 0.2s; flex-shrink: 0; }
    .vid-card-collapsed .vid-card-arrow { transform: rotate(-90deg); }
    .vid-card-num { font-weight: 900; color: var(--hapi-accent-text); }
    .vid-type-badge { background: var(--hapi-green-pale); color: var(--hapi-accent-text); padding: 3px 10px; border-radius: 12px; font-size: 0.85em; font-weight: 600; }
    .vid-card-body { padding: 0 16px; max-height: 2000px; overflow: hidden; transition: max-height 0.35s ease, padding 0.35s ease; border-top: 1px solid var(--border); padding: 14px 16px; }
    .vid-card-collapsed .vid-card-body { max-height: 0; padding-top: 0; padding-bottom: 0; border-top-color: transparent; }
    .vid-del-btn { background: transparent; border: none; cursor: pointer; font-size: 1.1em; opacity: 0.6; transition: opacity 0.2s; }
    .vid-del-btn:hover { opacity: 1; }
    .vid-ts-input { font-family: monospace; }
    .vid-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: vid-spin 0.8s linear infinite; }
    @keyframes vid-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(s);
}

function showRegenerateButton() {
    // La zone d'édition (Etape 4) apparaît seulement après une première génération réussie
    const editorStep = _pane.querySelector('#vid-step-editor');
    const btnGenerate = _pane.querySelector('#vid-generate-btn');

    // On s'assure que l'IA a bien généré un premier jet avant de proposer la "Régénération"
    if (editorStep && editorStep.style.display !== 'none') {
        if (btnGenerate) {
            btnGenerate.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg> Régénérer les interactions';
            // 🟢 Style "Bouton Vert" pour indiquer qu'une mise à jour est requise
            btnGenerate.style.background = 'linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark))';
            btnGenerate.style.boxShadow = '0 4px 15px rgba(var(--hapi-green-rgb), 0.3)';
        }
    }
}


// ─── Injection depuis le Corpus ───────────────────────────────────────────────
	
export async function injectCorpusVideo(videoSource) {
    if (!videoSource || !_pane) return;

    // 🌟 RÉCUPÉRATION DU TITRE DEPUIS LE CORPUS
    const mainTitleInput = _pane.querySelector('#vid-main-title');
    if (mainTitleInput && videoSource.name) {
        mainTitleInput.value = videoSource.name;
        _videoMetadata.mainTitle = videoSource.name; // On le stocke dans les métadonnées
    }

    // 🌟 NOUVEAU : SAUVEGARDE DE L'URL D'ORIGINE
    // On récupère la trace de l'URL laissée par le corpus-manager
    if (videoSource.originalSourceUrl) {
        _videoMetadata.originalSourceUrl = videoSource.originalSourceUrl; 
    } else {
        _videoMetadata.originalSourceUrl = videoSource.url; // Fallback de sécurité
    }

    logger.log('🎬 Injection de la vidéo du corpus dans l\'éditeur H5P...');

    let finalUrl = videoSource.resolved_url || videoSource.url;

    // 🛡️ PATCH AUTO-RÉPARATEUR : Si le corpus a oublié de nous transmettre le MP4 pour Canopé
    if (finalUrl.includes('reseau-canope.fr') && !finalUrl.endsWith('.mp4')) {
        logger.log('🔧 Le lien MP4 manque. Récupération auto en arrière-plan...');
        try {
            // Utilise la constante PYTHON_PROXY_URL définie en haut de ton fichier
            const targetUrl = typeof PYTHON_PROXY_URL !== 'undefined' ? PYTHON_PROXY_URL : 'https://nshapiproxyadd10448-hapi-proxy.functions.fnc.fr-par.scw.cloud/proxy/video';
            
            const resp = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: finalUrl, lang: 'fr' })
            });
            
            if (resp.ok) {
                const data = await resp.json();
                if (data.resolved_url) {
                    finalUrl = data.resolved_url;
                    logger.log('✅ Lien MP4 Canopé auto-réparé : ' + finalUrl);
                }
            }
        } catch(e) {
            logger.warn('Erreur lors de l\'auto-réparation du MP4:', e);
        }
    }

    // 1. Pré-remplir le champ URL avec la bonne URL (MP4 ou YouTube)
    const urlInput = _pane.querySelector('#vid-url-input');
    if (urlInput) {
        urlInput.value = finalUrl;
    }

// 2. Traitement de la transcription
// 🛡️ PATCH : Si Albert n'a renvoyé que du texte sans segments, on en fabrique un faux.
    if (videoSource.data && (!videoSource.segments || videoSource.segments.length === 0)) {
        logger.log('⚠️ Segments manquants, création d\'un segment virtuel.');
        videoSource.segments = [{
            start: 0,
            end: 600, // Durée par défaut arbitraire (10 minutes)
            text: videoSource.data
        }];
    }

    // 2. Traitement de la transcription
    if (videoSource.segments && videoSource.segments.length > 0) {
        
        let finalMp4 = finalUrl;
        
// 🛡️ DÉBLOCAGE CORS & FIX MP4 (Canopé, PodEduc, etc.)
        // On l'applique à tout ce qui n'est pas nativement YouTube
        if (!finalMp4.includes('youtube.com') && !finalMp4.includes('youtu.be')) {
            const vpsStreamBase = typeof PYTHON_PROXY_URL !== 'undefined' 
                ? PYTHON_PROXY_URL.replace('/proxy/video', '/proxy/stream') 
                : 'https://nshapiproxyadd10448-hapi-proxy.functions.fnc.fr-par.scw.cloud/proxy/stream';
            
            // Le '&ext=.mp4' à la fin est OBLIGATOIRE. Il trompe H5P pour qu'il 
            // croie lire un vrai fichier et l'accepte dans le content.json !
            finalMp4 = `${vpsStreamBase}?url=${encodeURIComponent(finalMp4)}&ext=.mp4`;
        }

        // ✅ CRUCIAL : On assigne l'URL du proxy aux métadonnées
        _videoMetadata.url = finalMp4; 
        _videoMetadata.mime = 'video/mp4'; // On force le type MP4
        
        _videoMetadata.transcript = videoSource.data;
        _videoMetadata.segments = videoSource.segments;
        _videoMetadata.duration = videoSource.segments[videoSource.segments.length - 1].end;

        // Remplir l'interface
        const display = _pane.querySelector('#vid-transcript-display');
        if (display) {
            display.value = videoSource.segments.map(s => `[${_secondsToTs(s.start)}] ${s.text.trim()}`).join('\n');
        }
        
        const dur = _pane.querySelector('#vid-duration');
        if (dur) dur.textContent = _secondsToTs(_videoMetadata.duration);

        _setStatus('vid-transcribe-status', 'ok', '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Vidéo et transcription prêtes !');
        _showBlock('vid-step-transcript');
        
        if (_onValidCallback) _onValidCallback();
    }
  }

// Mets à jour l'export final :
export const videoUI = { init, gatherData, getUIState, setUIState, syncEditorToState, injectCorpusVideo };