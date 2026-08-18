// Fichier: modules/ui/activity-selector.js

import { logger } from '../utils/logger.js';
import { corpusManager } from '../corpus/corpus-manager.js'; // 👈 1. Ajout du corpus manager
import { init as initQcmUI } from './qcm-ui.js';
import { init as initTrueFalseUI } from './truefalse-ui.js'; 
import { init as initQuizMathUI } from './quiz-math-ui.js'; 
import { init as initTrueFalseMathUI } from './truefalse-math-ui.js'; 
import { init as initDictationUI } from './dictation-ui.js'; 
import { init as initWordSearchUI } from './wordsearch-ui.js';
import { init as initMarkTheWordsUI } from './markthewords-ui.js';
import { init as initDragTextUI } from './dragtext-ui.js';
import { init as initAdvancedBlanksUI } from './advanced-blanks-ui.js';
import { init as initCrosswordUI } from './crossword-ui.js';
import { init as initSortParagraphsUI } from './sortparagraphs-ui.js';
import { init as initSummaryUI } from './summary-ui.js';
import { init as initAccordionUI } from './accordion-ui.js';
import { init as initCardsUI } from './cards-ui.js';
import { init as initImagePairingUI } from './image-pairing-ui.js';
import { init as initTimelineUI } from './timeline-ui.js';
import { init as init3DMoleculesUI } from './h5p-3d-ui.js';
import { init as initInteractiveMapUI } from './interactive-map-ui.js';
import { init as initVideoUI, injectCorpusVideo } from './h5p-video-ui.js'; // 👈 2. Ajout de injectCorpusVideo
import { init as initDragDropUI } from './dragndrop-ui.js';

let finalCorpusContent = '';
let ui = {
    selector: null,
    generatorContent: null,
    generateSection: null,
    generateButton: null,
    downloadSection: null, 
    activityLabels: null
};

const loadedModules = {};
let currentActiveTab = null;

// Familles d'activités (pour le filtre de la barre d'outils)
const ACTIVITY_FAMILY = {
    quiz: 'comprehension', truefalse: 'comprehension', summary: 'comprehension',
    'quiz-math': 'maths', 'truefalse-math': 'maths',
    dictation: 'lexique', wordsearch: 'lexique', markthewords: 'lexique', crossword: 'lexique', accordion: 'lexique',
    dragtext: 'texte', 'advanced-blanks': 'texte', dragndrop: 'texte', sortparagraphs: 'texte',
    cards: 'images', 'image-pairing': 'images',
    timeline: 'reperes', 'interactive-map': 'reperes',
    'molecules-3d': 'avance', 'interactive-video': 'avance',
};

export function init(corpus) {
    finalCorpusContent = corpus;
    logger.log('🔄 Initialisation du Sélecteur d\'Activités (Mode Multiple)...');
// 🔴 AJOUTE CES DEUX LIGNES POUR LE DÉBOGAGE :
    console.log("🧐 Contenu reçu par le sélecteur d'activités :");
    console.log(finalCorpusContent);
    
    ui = {
        selector: document.getElementById('activity-selector'),
        generatorContent: document.getElementById('generator-content'), 
        generateSection: document.getElementById('generate-section'),
        generateButton: document.getElementById('generate-button'),
        downloadSection: document.getElementById('download-section'), 
        activityLabels: null 
    };

    if (!document.getElementById('multi-tabs-styles')) {
        const style = document.createElement('style');
        style.id = 'multi-tabs-styles';
        style.innerHTML = `
        /* --- Barre d'onglets — style premium HAPI --- */
        .multi-tabs-header { 
            display: flex; flex-wrap: wrap; gap: 6px 4px; margin-bottom: 0; 
            border-bottom: 2px solid var(--hapi-green-pale, #d4e9da); 
            padding: 0 4px; align-items: flex-end; 
            background: rgba(255,255,255,0.5); backdrop-filter: blur(6px); 
            border-radius: 12px 12px 0 0;
        }
        .tab-btn { 
            padding: 10px 18px; font-size: 0.95rem; background: rgba(255,255,255,0.7); 
            border-radius: 10px 10px 0 0; cursor: pointer; font-weight: 600; 
            color: var(--text-muted); transition: all 0.25s ease; white-space: nowrap; 
            border: 1px solid var(--border); border-bottom: none; margin-bottom: -2px; 
        }
        .tab-btn:hover { background: var(--hapi-green-pale, var(--hapi-green-pale)); color: var(--hapi-green-dark, var(--hapi-green-dark)); }
        .tab-btn.active { 
            background: var(--hapi-green-dark, var(--hapi-green-dark)); color: #fff; 
            border-color: var(--hapi-green-dark, var(--hapi-green-dark)); border-bottom: none; 
            box-shadow: 0 -3px 12px rgba(var(--hapi-green-rgb), 0.2); padding-bottom: 11px; 
        }
        .tab-btn svg { width: 16px; height: 16px; vertical-align: -2px; margin-right: 4px; }
        .tab-pane { display: none; animation: tabFadeIn 0.4s ease-out; }
        .tab-pane.active { display: block; }
        @keyframes tabFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        /* Workspace : conteneur transparent, on s'appuie sur le cartouche parent
           (#activity-creation-workflow) pour le fond. On récupère ainsi toute la largeur. */
        #multi-activity-workspace {
            background: transparent;
            border: none;
            border-radius: 0;
            padding: 0;
            box-shadow: none;
        }

        /* --- Pastilles d'icônes : anneau vert foncé + icône au trait --- */
        .activity-option-label .activity-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 54px;
            height: 54px;
            margin: 0 auto 6px;
            color: var(--text);
            transition: transform 0.2s ease, color 0.2s ease;
        }
        /* Icône au trait : pourtour vert foncé du logo, intérieur clair */
        .activity-option-label .activity-icon svg {
            width: 64px;
            height: 64px;
            stroke: currentColor;
            fill: none;
        }
        .activity-option-label:hover .activity-icon {
            transform: scale(1.08);
        }
        /* Sélection d'une activité : tons gris + bordure ardoise (slate) */
        .activity-option-label.selected {
            border-color: var(--border-strong);
            /* background-color: var(--page-bg);*/
            box-shadow: 0 0 0 3px rgba(71, 85, 105, 0.18), 0 8px 25px rgba(0,0,0,0.08);
        }
        .activity-option-label.selected .activity-icon {
            transform: scale(1.08);
            color: var(--text);
        }
        /* Icône reprise dans l'onglet (hérite la couleur du texte de l'onglet) */
        .tab-btn svg {
            width: 18px;
            height: 18px;
            stroke: currentColor;
            fill: none;
            vertical-align: -3px;
            margin-right: 3px;
        }

        /* --- Barre d'outils de sélection : recherche + familles + compteur --- */
        .activity-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 14px 0 18px; }
        .activity-family-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .family-chip { padding: 6px 12px; border-radius: 16px; border: 1px solid rgba(var(--hapi-green-rgb), 0.35); background: var(--hapi-green-mist); color: var(--hapi-accent-text); font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background 0.15s ease, color 0.15s ease; }
        .family-chip:hover { background: var(--hapi-green-pale); }
        .family-chip[aria-pressed="true"] { background: var(--hapi-green-dark); color: #fff; border-color: var(--hapi-green-dark); }
        .activity-count { margin-left: auto; font-size: 0.9rem; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
        .activity-option-label.is-hidden { display: none !important; }

        /* Checkbox masquée VISUELLEMENT mais focusable (RGAA : opérable au clavier) */
        .activity-option-label .activity-checkbox { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; }
        .activity-option-label:has(.activity-checkbox:focus-visible) {
            outline: 3px solid var(--hapi-green-dark);
            outline-offset: 2px;
        }
        `;
        document.head.appendChild(style);
    }

    ui.selector.innerHTML = `
        <div>
            <div class="activity-toolbar">
                <div class="activity-family-chips" role="group" aria-label="Filtrer par famille d'activités">
                    <button type="button" class="family-chip" data-family="all" aria-pressed="true">Toutes</button>
                    <button type="button" class="family-chip" data-family="comprehension" aria-pressed="false">Compréhension</button>
                    <button type="button" class="family-chip" data-family="maths" aria-pressed="false">Maths</button>
                    <button type="button" class="family-chip" data-family="lexique" aria-pressed="false">Lexique</button>
                    <button type="button" class="family-chip" data-family="texte" aria-pressed="false">Texte à compléter</button>
                    <button type="button" class="family-chip" data-family="images" aria-pressed="false">Images &amp; cartes</button>
                    <button type="button" class="family-chip" data-family="reperes" aria-pressed="false">Repères &amp; frises</button>
                    <button type="button" class="family-chip" data-family="avance" aria-pressed="false">3D &amp; vidéo</button>
                </div>
                <div class="activity-count" id="activity-count" aria-live="polite">Aucune activité sélectionnée</div>
            </div>
            <div id="activity-selector" class="activity-grid">
                
                <label class="activity-option-label" data-type="quiz">
                    <div class="activity-badge-container"><div class="badge-item badge-xml">+ XML Éléa</div></div>
                    <input type="checkbox" class="activity-checkbox" value="quiz" style="display:none;">
                    <div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg></div><div class="activity-title">Quiz (QCM)</div><div class="activity-description">Questions de compréhension</div></div>
                </label>
                
                <label class="activity-option-label" data-type="truefalse">
                    <div class="activity-badge-container"><div class="badge-item badge-xml">+ XML Éléa</div></div>
                    <input type="checkbox" class="activity-checkbox" value="truefalse" style="display:none;">
                    <div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/></svg></div><div class="activity-title">Vrai ou Faux</div><div class="activity-description">Affirmations sur un texte</div></div>
                </label>
                
                <label class="activity-option-label" data-type="quiz-math">
                    <div class="activity-badge-container"><div class="badge-item badge-latex">LaTeX</div><div class="badge-item badge-xml">+ XML Éléa</div></div>
                    <input type="checkbox" class="activity-checkbox" value="quiz-math" style="display:none;">
                    <div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="8" y2="11"/><line x1="12" y1="11" x2="12" y2="11"/><line x1="16" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="8" y2="15"/><line x1="12" y1="15" x2="12" y2="15"/><line x1="16" y1="15" x2="16" y2="15"/><line x1="8" y1="18" x2="16" y2="18"/></svg></div><div class="activity-title">Quiz Math</div><div class="activity-description">Questions avec formules LaTeX</div></div>
                </label>

                <label class="activity-option-label" data-type="truefalse-math">
                     <div class="activity-badge-container"><div class="badge-item badge-latex">LaTeX</div><div class="badge-item badge-xml">+ XML Éléa</div></div>
                    <input type="checkbox" class="activity-checkbox" value="truefalse-math" style="display:none;">
                     <div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M16 8.9V7H8l4 5-4 5h8v-1.9"/></svg></div><div class="activity-title">Vrai/Faux Math</div><div class="activity-description">Affirmations mathématiques</div></div>
                </label>

                <label class="activity-option-label" data-type="dictation">
    				<div class="activity-badge-container"><div class="badge-item badge-new" style="background-color: var(--hapi-green-dark); background-image: linear-gradient(135deg, var(--hapi-green-dark), var(--hapi-green-deep));">IA Audio</div></div>
                    <input type="checkbox" class="activity-checkbox" value="dictation" style="display:none;">
                    <div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a9 9 0 0 1 18 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg></div><div class="activity-title">Dictée audio</div><div class="activity-description">Phrases à écrire sous la dictée</div></div>
                </label>
                
                <label class="activity-option-label" data-type="wordsearch">
                    <input type="checkbox" class="activity-checkbox" value="wordsearch" style="display:none;">
                    <div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg></div><div class="activity-title">Mots mêlés</div><div class="activity-description">Liste de mots dans une grille</div></div>
                </label>

                <label class="activity-option-label" data-type="markthewords">
                    <input type="checkbox" class="activity-checkbox" value="markthewords" style="display:none;">
                    <div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div><div class="activity-title">Mots à repérer</div><div class="activity-description">Mots à identifier dans un texte</div></div>
                </label>

                <label class="activity-option-label" data-type="dragtext">
                    <input type="checkbox" class="activity-checkbox" value="dragtext" style="display:none;">
                    <div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 3-4 4 4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg></div><div class="activity-title">Étiquettes à déplacer</div><div class="activity-description">Texte à compléter</div></div>
                </label>
				
				<label class="activity-option-label" data-type="advanced-blanks">
    				<div class="activity-badge-container"><div class="badge-item badge-nouveau">Nouveau</div><div class="badge-item badge-xml">+ XML Éléa</div></div>
    				<input type="checkbox" class="activity-checkbox" value="advanced-blanks" style="display:none;">
    				<div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M7 12h.01"/><path d="M12 12h.01"/><path d="M17 12h.01"/></svg></div><div class="activity-title">Texte à trous</div><div class="activity-description">Texte à compléter</div></div>
				</label>
		
				<label class="activity-option-label" data-type="dragndrop">
    				<div class="activity-badge-container"><div class="badge-item badge-nouveau">Nouveau</div></div>
    				<input type="checkbox" class="activity-checkbox" value="dragndrop" style="display:none;">
    				<div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M15 19l-3 3-3-3"/><path d="M19 9l3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20"/></svg></div><div class="activity-title">Glisser-déposer</div><div class="activity-description">Déplacer des étiquettes</div></div>
				</label>
		
                <label class="activity-option-label" data-type="crossword">
                    <input type="checkbox" class="activity-checkbox" value="crossword" style="display:none;">
                    <div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18"/><path d="M12 3v18"/></svg></div><div class="activity-title">Mots Croisés</div><div class="activity-description">Mots à écrire</div></div>
                </label>

                <label class="activity-option-label" data-type="sortparagraphs">
                    <input type="checkbox" class="activity-checkbox" value="sortparagraphs" style="display:none;">
                    <div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg></div><div class="activity-title">Paragraphes</div><div class="activity-description">Remise en ordre</div></div>
                </label>

                <label class="activity-option-label" data-type="summary">
                    <input type="checkbox" class="activity-checkbox" value="summary" style="display:none;">
                    <div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 12H3"/><path d="M17 6H3"/><path d="M21 18H3"/></svg></div><div class="activity-title">Résumé</div><div class="activity-description">Meilleure proposition à trouver</div></div>
                </label>
                
                <label class="activity-option-label" data-type="accordion">
                    <div class="activity-badge-container"><div class="badge-item badge-xml">+ XML Éléa</div></div>
                    <input type="checkbox" class="activity-checkbox" value="accordion" style="display:none;">
                    <div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg></div><div class="activity-title">Accordéon (Glossaire)</div><div class="activity-description">Glossaire dépliant</div></div>
                </label>
	
				<label class="activity-option-label" data-type="cards">
    				<div class="activity-badge-container"><div class="badge-item badge-new" style="background-color: var(--hapi-green-dark); background-image: linear-gradient(135deg, var(--hapi-green-dark), var(--hapi-green-deep));">IA Image</div></div>
    				<input type="checkbox" class="activity-checkbox" value="cards" style="display:none;">
    				<div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg></div><div class="activity-title">Cartes Mémoire</div><div class="activity-description">Cartes de révision</div></div>
				</label>

				<label class="activity-option-label" data-type="image-pairing">
    				<div class="activity-badge-container"><div class="badge-item badge-new" style="background-color: var(--hapi-green-dark); background-image: linear-gradient(135deg, var(--hapi-green-dark), var(--hapi-green-deep));">IA Image</div></div>
    				<input type="checkbox" class="activity-checkbox" value="image-pairing" style="display:none;">
    				<div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg></div><div class="activity-title">Appariements</div><div class="activity-description">Association d'étiquettes</div></div>
				</label>
	
				<label class="activity-option-label" data-type="timeline">
                    <input type="checkbox" class="activity-checkbox" value="timeline" style="display:none;">
                    <div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.17a2 2 0 0 0-.59-1.41L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22"/><path d="M7 2v4.17a2 2 0 0 0 .59 1.41L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/></svg></div><div class="activity-title">Frise chronologique</div><div class="activity-description">Timeline interactive multimédia</div></div>
                </label>
	
				<label class="activity-option-label" data-type="interactive-map">
    				<div class="activity-badge-container"><div class="badge-item badge-nouveau">Nouveau</div></div>
   	 				<input type="checkbox" class="activity-checkbox" value="interactive-map" style="display:none;">
   	 				<div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg></div><div class="activity-title">Carte interactive</div><div class="activity-description">Repères sur une carte</div></div>
				</label>
	
				<label class="activity-option-label" data-type="molecules-3d">
    				<input type="checkbox" class="activity-checkbox" value="molecules-3d" style="display:none;">
    				<div class="activity-content"><div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5z"/></svg></div><div class="activity-title">Laboratoire</div><div class="activity-description">Visualisation de molécules 3D</div></div>
				</label>
				<label class="activity-option-label" data-type="interactive-video">
    				<div class="activity-badge-container"><div class="badge-item badge-nouveau">Nouveau</div>
        				<div class="badge-item badge-new" style="background-color: var(--hapi-green-dark); background-image: linear-gradient(135deg, var(--hapi-green-dark), var(--hapi-green-deep));">IA</div>
    				</div>
   	 				<input type="checkbox" class="activity-checkbox" value="interactive-video" style="display:none;">
    				<div class="activity-content">
        			<div class="activity-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg></div>
        			<div class="activity-title">Vidéo interactive</div>
        			<div class="activity-description">Interactions sur une vidéo</div>
    				</div>
				</label>

            </div>
        </div>
    `;

    ui.generatorContent.innerHTML = `
        <div id="multi-activity-workspace" style="display:none;">
            <div id="tabs-header" class="multi-tabs-header"></div>
            <div id="tabs-content"></div>
            <div id="hidden-app-state" style="display:none;"></div> 
        </div>
    `;
    
    ui.activityLabels = ui.selector.querySelectorAll('.activity-option-label');

    ui.activityLabels.forEach(label => {
        const checkbox = label.querySelector('input[type="checkbox"]');
        checkbox.style.display = '';                                   // checkbox focusable (clavier)
        label.dataset.family = ACTIVITY_FAMILY[label.dataset.type] || 'autre';
        checkbox.addEventListener('change', (e) => {
            handleActivityToggle(e.target.checked, label, checkbox);
        });
    });

    setupActivityFilters();
    updateActivityCount();

    if (ui.generateButton) {
        ui.generateButton.disabled = true;
        ui.generateButton.textContent = 'Générer'; 
    }
}

// 🔎 Filtre de la grille : recherche texte + puce de famille
function setupActivityFilters() {
    const search = document.getElementById('activity-search');
    const chips = Array.from(document.querySelectorAll('.family-chip'));
    let activeFamily = 'all';

    const apply = () => {
        const q = (search && search.value ? search.value : '').trim().toLowerCase();
        ui.activityLabels.forEach(label => {
            const okFamily = activeFamily === 'all' || label.dataset.family === activeFamily;
            const okText = !q || (label.textContent || '').toLowerCase().includes(q);
            label.classList.toggle('is-hidden', !(okFamily && okText));
        });
    };

    if (search) search.addEventListener('input', apply);
    chips.forEach(chip => chip.addEventListener('click', () => {
        activeFamily = chip.dataset.family;
        chips.forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
        apply();
    }));
}

// 🔢 Compteur de sélection (annoncé via aria-live)
function updateActivityCount() {
    const el = document.getElementById('activity-count');
    if (!el || !ui.selector) return;
    const n = ui.selector.querySelectorAll('.activity-checkbox:checked').length;
    el.textContent = n === 0
        ? 'Aucune activité sélectionnée'
        : `${n} activité${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''}`;
}

// 🟢 FONCTION TOAST : Affiche un beau message temporaire
function showToast(message) {
    const toast = document.createElement('div');
    toast.innerHTML = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: #b91c1c;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        font-weight: bold;
        font-size: 1em;
        z-index: 9999;
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    document.body.appendChild(toast);

    // Animation d'entrée
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    // Disparition après 4 secondes
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function handleActivityToggle(isChecked, label, checkbox) {
    const activityType = label.dataset.type;
    const activityTitle = label.querySelector('.activity-title').innerText;
    const activityIcon = label.querySelector('.activity-icon').innerHTML;
    
    // 🔴 SÉCURITÉ : On vérifie si l'onglet Finalisation existe déjà
    const isFinalisationActive = document.querySelector('.tab-btn[data-tab-target="finalisation"]');

    if (isChecked && isFinalisationActive) {
        // L'utilisateur essaie d'ajouter une activité après la finalisation !
        checkbox.checked = false; // On décoche la case pour lui
        label.classList.remove('selected');
        
        // On affiche le message toast
        showToast('<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> <span>Impossible d\'ajouter une activité car vous êtes déjà à l\'étape de finalisation.<br><small style="font-weight:normal;">Pour modifier votre sélection, veuillez rafraîchir la page.</small></span>');
        return; // On arrête tout !
    }

    if (isChecked) {
        label.classList.add('selected');
        createTab(activityType, activityTitle, activityIcon);
    } else {
        label.classList.remove('selected');
        removeTab(activityType);
    }
    updateActivityCount();
    // 🟢 Recalcule le total + émet hapiGlobalStateChange à CHAQUE ajout/retrait
    // (createTab ne déclenche switchTab que pour le 1er onglet → sinon le
    //  compteur « X/N prêtes » de l'étape 3 resterait figé).
    updateGenerateButtonState();
}

function createTab(type, title, icon) {
    document.getElementById('multi-activity-workspace').style.display = 'block';
    const tabsHeader = document.getElementById('tabs-header');
    const tabsContent = document.getElementById('tabs-content');

    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.dataset.tabTarget = type;
    btn.innerHTML = `${icon} ${title}`;
    btn.onclick = () => switchTab(type);
    tabsHeader.appendChild(btn);

    const pane = document.createElement('div');
    pane.className = 'tab-pane';
    pane.id = `pane-${type}`;
    pane.dataset.type = type;
    tabsContent.appendChild(pane);

    if (ui.downloadSection) ui.downloadSection.style.display = 'none';

    if (!loadedModules[type]) {
        loadedModules[type] = true;
        loadModuleUI(type, pane);
    }

    if (!currentActiveTab) {
        switchTab(type);
    }
}

function removeTab(type) {
    const btn = document.querySelector(`.tab-btn[data-tab-target="${type}"]`);
    const pane = document.getElementById(`pane-${type}`);
    
    if (btn) btn.remove();
    if (pane) pane.remove();
    
    delete loadedModules[type];

    if (currentActiveTab === type) {
        const remainingBtn = document.querySelector('.tab-btn:not([data-tab-target="finalisation"])');
        if (remainingBtn) {
            switchTab(remainingBtn.dataset.tabTarget);
        } else {
            currentActiveTab = null;
            document.getElementById('multi-activity-workspace').style.display = 'none';
            if (ui.generateSection) ui.generateSection.style.display = 'none';
            updateGenerateButtonState();
        }
    } else {
        updateGenerateButtonState(); 
    }
}

function switchTab(type) {
    currentActiveTab = type;

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    
    document.querySelector(`.tab-btn[data-tab-target="${type}"]`).classList.add('active');
    document.getElementById(`pane-${type}`).classList.add('active');

    const hiddenState = document.getElementById('hidden-app-state');
    hiddenState.innerHTML = `<input type="radio" name="activity-type" value="${type}" checked>`;

    if (ui.downloadSection) ui.downloadSection.style.display = 'none';

    updateGenerateButtonState();
}

function loadModuleUI(activityType, paneElement) {
    switch (activityType) {
        case 'quiz': initQcmUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
        case 'truefalse': initTrueFalseUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
        case 'quiz-math': initQuizMathUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
        case 'truefalse-math': initTrueFalseMathUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
        case 'dictation': initDictationUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
        case 'wordsearch': initWordSearchUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
        case 'markthewords': initMarkTheWordsUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
        case 'dragtext': initDragTextUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
		case 'advanced-blanks': initAdvancedBlanksUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
        case 'crossword': initCrosswordUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
        case 'sortparagraphs': initSortParagraphsUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
        case 'summary': initSummaryUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
        case 'accordion': initAccordionUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
		case 'cards': initCardsUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
		case 'image-pairing': initImagePairingUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
		case 'timeline': initTimelineUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
		case 'interactive-map': initInteractiveMapUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
		case 'molecules-3d': init3DMoleculesUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
		case 'dragndrop': initDragDropUI(paneElement, finalCorpusContent, updateGenerateButtonState); break;
		case 'interactive-video': 
            // 1. Initialise l'interface normalement
            initVideoUI(paneElement, finalCorpusContent, updateGenerateButtonState); 
        
            // 2. Vérifie s'il y a une vidéo dans le corpus
            const videoSource = corpusManager.getFirstVideoSource();
            if (videoSource) {
                // 3. Injecte l'URL et la transcription
                injectCorpusVideo(videoSource);
            }
            break;
        default:
            logger.warn(`Aucun module UI trouvé pour : ${activityType}`);
            paneElement.innerHTML = `<p style="padding: 20px; text-align: center;">Le module pour "<strong>${activityType}</strong>" n'est pas encore migré.</p>`;
    }
}

export function isPaneValid(pane) {
    if (!pane) return false;
    const activityType = pane.dataset.type;
    let isValid = false;

    switch(activityType) {
        case 'quiz': isValid = pane.querySelectorAll('#comprehension-questions-preview .card').length > 0; break;
        case 'truefalse': isValid = pane.querySelectorAll('#truefalse-questions-preview .card').length > 0; break;
        case 'quiz-math': isValid = pane.querySelectorAll('#questions-list .math-question-card').length > 0; break;
        case 'truefalse-math': isValid = pane.querySelectorAll('#statements-list .math-question-card').length > 0; break;
        case 'dictation': isValid = pane.querySelectorAll('#dictation-statements-container .card').length > 0; break;
        case 'wordsearch': { const w = pane.querySelector('#wordsearchText'); isValid = w && w.value.trim().length > 0; break; }
        case 'markthewords': { const t = pane.querySelector('#markTheWordsText'); isValid = t && t.value.includes('*'); break; }
        case 'dragtext': { const t = pane.querySelector('#dragTheWordsText'); isValid = t && t.value.includes('*'); break; }
		case 'advanced-blanks': { 
		            // On vérifie que la zone de texte existe ET qu'elle contient au moins un trou (les fameux tirets)
		            const textEditor = pane.querySelector('#ab-text-editor'); 
		            isValid = textEditor && textEditor.value.includes('___________'); 
		            break; 
		        }
		case 'crossword': isValid = pane.querySelectorAll('#crossword-items-list .card').length > 0; break;
        case 'sortparagraphs': isValid = pane.querySelectorAll('#sortparagraphs-list .sp-text').length > 1; break;
        case 'summary': isValid = pane.querySelectorAll('#summary-items-list .card').length > 0; break;
        case 'accordion': {
            const title = pane.querySelector('#accordion-title');
            const entries = pane.querySelectorAll('#accordion-items-list .card');
            isValid = title && title.value.trim() !== '' && entries.length > 0;
            break;
        }
        case 'cards': {
            const title = pane.querySelector('#cards-title');
            const list = pane.querySelectorAll('#cards-list .card');
            isValid = title && title.value.trim() !== '' && list.length > 0;
            break;
        }
        case 'image-pairing': isValid = pane.querySelectorAll('#imgpair-list .card').length > 0; break;
        case 'timeline': isValid = pane.querySelectorAll('.timeline-card').length > 0; break;
        case 'interactive-map': isValid = pane.querySelectorAll('.map-marker-card').length > 0; break;
        case 'molecules-3d': isValid = pane.querySelectorAll('.molecule-card.generated').length > 0; break;
		case 'dragndrop': 
	            isValid = pane.querySelectorAll('.inp-zone-name').length >= 1 && pane.querySelectorAll('.inp-el-text').length >= 1; 
	            break;
		case 'interactive-video': {
		            // Valide dès qu'au moins une interaction a été générée dans le pane
		            isValid = pane.querySelectorAll('#vid-interaction-list .vid-card').length > 0;
		            break;
		        }
    }
    return isValid;
}

export function updateGenerateButtonState() {
    const button = ui.generateButton;
    const activePane = document.querySelector('.tab-pane.active:not([data-type="finalisation"])');
    
    if (activePane) {
        const valid = isPaneValid(activePane);
        if (button) button.disabled = !valid;
        
        if (ui.generateSection) {
            ui.generateSection.style.display = valid ? 'block' : 'none';
        }
    }

    const allPanes = document.querySelectorAll('.tab-pane:not([data-type="finalisation"])');
    const total = allPanes.length;
    let readyCount = 0;

    allPanes.forEach(pane => {
        if (isPaneValid(pane)) readyCount++;
    });

	const btnGoFinalisation = document.getElementById('btn-go-finalisation');
	    const btnGoPrevious = document.getElementById('btn-go-previous'); // 🟢 NOUVEAU

	    if (btnGoFinalisation) {
	        const tabs = Array.from(document.querySelectorAll('.tab-btn:not([data-tab-target="finalisation"])'));
	        const currentIndex = tabs.findIndex(t => t.classList.contains('active'));
        
	        // 🟢 NOUVEAU : Gestion de l'affichage du bouton Précédent
	        if (btnGoPrevious) {
	            if (currentIndex > 0) {
	                btnGoPrevious.style.display = 'inline-block'; // On affiche si ce n'est pas le 1er onglet
	            } else {
	                btnGoPrevious.style.display = 'none'; // On cache sur le 1er onglet
	            }
	        }

	        // Gestion du bouton Suivant / Finalisation
	        if (currentIndex >= 0 && currentIndex < tabs.length - 1) {
	            btnGoFinalisation.innerHTML = '→ Passer à l\'activité suivante';
	            btnGoFinalisation.dataset.action = 'next';
	            btnGoFinalisation.style.background = 'linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark))';
	        } else {
	            btnGoFinalisation.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg> Passer à la finalisation';
	            btnGoFinalisation.dataset.action = 'finalisation';
	            btnGoFinalisation.style.background = 'linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark))';
	        }
	    }

    window.dispatchEvent(new CustomEvent('hapiGlobalStateChange', {
        detail: { total, readyCount }
    }));
}