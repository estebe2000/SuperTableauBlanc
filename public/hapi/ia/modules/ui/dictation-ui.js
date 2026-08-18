// Fichier: modules/ui/dictation-ui.js

import { logger } from '../utils/logger.js';
// Remplace la ligne d'import actuelle par celle-ci :
import { creerAssistantIA_HTML, creerFeedbackIntervallesHTML, initFeedbackIntervalles, getFeedbackIntervallesData, setFeedbackIntervallesData } from '../utils/helpers.js';
import { getH5PLocalization } from '../utils/h5p-translations.js';

// --- IMPORTS IA ---
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_Dictation } from '../ia/prompt-builder.js';
import { parserReponseIA_Dictation } from '../ia/response-parser.js';
import { corpusManager } from '../corpus/corpus-manager.js';

import { getDictationState, setDictationState } from '../utils/states/dictation-state.js';
import { SourceSelector } from './source-selector.js';

// --- CONFIGURATION PONCTUATION ---
const PUNCTUATION_MAPS = {
    'fr-FR': { '.': 'point', ',': 'virgule', '?': 'point d\'interrogation', '!': 'point d\'exclamation', ':': 'deux points', ';': 'point-virgule' },
    'en-US': { '.': 'period', ',': 'comma', '?': 'question mark', '!': 'exclamation point', ':': 'colon', ';': 'semicolon' },
    'en-GB': { '.': 'full stop', ',': 'comma', '?': 'question mark', '!': 'exclamation mark', ':': 'colon', ';': 'semicolon' },
    'es-ES': { '.': 'punto', ',': 'coma', '?': 'signo de interrogación', '!': 'signo de exclamación', ':': 'dos puntos', ';': 'punto y coma' },
    'de-DE': { '.': 'Punkt', ',': 'Komma', '?': 'Fragezeichen', '!': 'Ausrufezeichen', ':': 'Doppelpunkt', ';': 'Semikolon' },
    'it-IT': { '.': 'punto', ',': 'virgola', '?': 'punto interrogativo', '!': 'punto esclamativo', ':': 'due punti', ';': 'punto e virgola' },
    'nl-NL': { '.': 'punt', ',': 'komma', '?': 'vraagteken', '!': 'uitroepteken', ':': 'dubbele punt', ';': 'puntkomma' },
    'pt-PT': { '.': 'ponto', ',': 'vírgula', '?': 'ponto de interrogação', '!': 'ponto de exclamação', ':': 'dois pontos', ';': 'ponto e virgola' }
};

let container = null;
let corpus = '';
let updateGenerateButtonCallback = () => {};
let statementCounter = 0;
let localSourceSelector = null; 
let currentRepartition = {};    

// État interne
let audioFiles = new Map();
let mediaRecorder;
let audioChunks = [];
let currentRecordingStatementId = null;

function getPunctuationMap(langCode) {
    if (langCode === 'la') return PUNCTUATION_MAPS['it-IT']; 
    if (langCode.toLowerCase().includes('normand')) return PUNCTUATION_MAPS['fr-FR'];
    const baseLang = langCode.split('-')[0];
    const key = Object.keys(PUNCTUATION_MAPS).find(k => k.startsWith(baseLang));
    return PUNCTUATION_MAPS[langCode] || PUNCTUATION_MAPS[key] || PUNCTUATION_MAPS['fr-FR'];
}

// ============================================================
// 🎵 MOTEUR AUDIO V4 : HIGH DENSITY OLA
// ============================================================

async function genererVersionLentePhysique(fileNormal) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await fileNormal.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const rate = 0.75; 
        const stretchedBuffer = await timeStretchHighDensity(audioContext, audioBuffer, rate);
        return bufferToWav(stretchedBuffer, fileNormal.name.replace('.', '_slow.'));
    } catch (e) {
        console.error("Erreur TimeStretch:", e);
        return null; 
    }
}

async function timeStretchHighDensity(context, buffer, rate) {
    const channels = buffer.numberOfChannels;
    const inputData = new Array(channels).fill(0).map((_, i) => buffer.getChannelData(i));
    const newLength = Math.ceil(buffer.length / rate);
    const outputBuffer = context.createBuffer(channels, newLength, buffer.sampleRate);
    
    const grainSize = Math.floor(0.08 * buffer.sampleRate); 
    const overlapFactor = 4;
    const outputHop = Math.floor(grainSize / overlapFactor);
    const inputHop = Math.floor(outputHop * rate);
    
    const window = new Float32Array(grainSize);
    for (let i = 0; i < grainSize; i++) {
        window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (grainSize - 1)));
    }

    for (let c = 0; c < channels; c++) {
        const input = inputData[c];
        const output = outputBuffer.getChannelData(c);
        
        for (let outPos = 0, inPos = 0; outPos + grainSize < newLength; outPos += outputHop, inPos += inputHop) {
            const inputIndex = Math.min(Math.floor(inPos), input.length - grainSize);
            if (inputIndex < 0) continue;
            for (let i = 0; i < grainSize; i++) {
                const gain = window[i] / (overlapFactor / 2);
                output[outPos + i] += input[inputIndex + i] * gain;
            }
        }
    }
    return outputBuffer;
}

function bufferToWav(abuffer, name) {
    const numOfChan = abuffer.numberOfChannels;
    const length = abuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    
    let i, sample;
    let offset = 0;
    let pos = 0;

    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157); setUint32(0x20746d66);
    setUint32(16); setUint16(1); setUint16(numOfChan); setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); setUint16(numOfChan * 2); setUint16(16); 
    setUint32(0x61746164); setUint32(length - pos - 4);

    for(i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));

    while(pos < abuffer.length) {
        for(i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][pos])); 
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; 
            view.setInt16(44 + offset, sample, true); offset += 2;
        }
        pos++;
    }

    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

    return new File([buffer], name.replace(/\.[^/.]+$/, "") + ".wav", { type: 'audio/wav' });
}

async function convertBlobToWavFile(blob, fileName) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return bufferToWav(audioBuffer, fileName);
}

// ============================================================
// UI & LOGIQUE PRINCIPALE
// ============================================================

export function init(targetContainer, corpusContent, updateBtnCallback) {
    container = targetContainer;
    corpus = corpusContent;
    updateGenerateButtonCallback = updateBtnCallback;
    statementCounter = 0;
    audioFiles.clear();
    
    logger.log('🔧 Initialisation Dictée UI (Pastilles & High Density Audio)...');

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
        <style>
            .info-bubble { position: relative; display: inline-block; cursor: help; margin-left: 8px; font-size: 1.2em; vertical-align: middle; }
            .info-bubble .tooltip-content { visibility: hidden; width: 260px; background-color: #1e293b; color: #fff; text-align: left; border-radius: 6px; padding: 12px; position: absolute; z-index: 100; bottom: 140%; left: 50%; margin-left: -130px; opacity: 0; transition: opacity 0.3s; font-size: 0.85rem; font-weight: normal; line-height: 1.4; box-shadow: 0 4px 15px rgba(0,0,0,0.2); pointer-events: none; }
            .info-bubble .tooltip-content::after { content: ""; position: absolute; top: 100%; left: 50%; margin-left: -6px; border-width: 6px; border-style: solid; border-color: #1e293b transparent transparent transparent; }
            .info-bubble:hover .tooltip-content { visibility: visible; opacity: 1; }
        </style>

        <div id="dictation-generator-wrapper">
            <div class="section" style="background: var(--surface); border-radius: 8px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                
                <div id="dictation-source-selector"></div>
                <div id="dictation-questions-repartition"></div>

                <h2 style="margin:0 0 15px 0;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configuration de la dictée audio</h2>
                
                <div style="display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 25px;">
                    <div class="input-group" style="margin: 0 0;">
                        <label for="dictationTitle" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Titre de l'activité :</label>
                        <input type="text" id="dictationTitle" value="Dictée audio" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                    <div class="input-group" style="margin: 0 0;">
                        <label for="dictationTask" style="display:block; font-weight:bold; margin-bottom:4px; font-size:0.9em;">Consigne pour l'élève :</label>
                        <input type="text" id="dictationTask" value="Écoutez attentivement chaque phrase, puis écrivez ce que vous entendez." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    </div>
                </div>
            
                <div style="text-align:center; margin-top:35px;">
                    <button id="prepare-ia-btn-dictation" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt
                    </button>
                </div>
            </div>

            <div id="ia-container-dictation" class="section" style="display: none; background: var(--surface); border-radius: 8px; padding: 12px 25px 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                ${creerAssistantIA_HTML('ia-prompt-dictation', 'ia-response-dictation')}
            </div>
            
            <div id="albert-action-dictation" style="display: none; text-align: center; margin-top: 15px; margin-bottom: 30px;">
                <button id="btn-send-albert-dictation" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                    🇫🇷 Envoyer le prompt à l'IA
                </button>
            </div>

            <div class="section" id="dictation-preview-section" style="display: none; background: var(--surface); border-radius: 8px; padding: 12px 25px 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-top:20px;">
                <div style="border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="margin:0; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 14v3a2 2 0 0 0 2 2h2v-7H5a9 9 0 0 1 14 0h-2v7h2a2 2 0 0 0 2-2v-3a9 9 0 0 0-18 0z"/></svg> Phrases de la dictée</h2>
                    <p id="dictation-status-indicator" style="font-weight:bold; color:#e11d48; font-size:0.9em;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> Il faut au moins une phrase remplie (texte et audio) pour générer.</p>
                </div>
                
                <div style="background: var(--hapi-green-mist); border: 1px solid var(--border-strong); padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <div style="display:flex; align-items:center;">
                        <strong style="color: var(--hapi-accent-text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg> Action globale :</strong>
                        <div class="info-bubble"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><div class="tooltip-content"><strong>Génération en série</strong><br><br>Applique ces réglages à TOUTES les phrases.<br><em style="color:#fbbf24;">Attention aux quotas journaliers.</em></div></div>
                    </div>
        
                    <div style="flex: 1; min-width: 300px; display: flex; gap: 10px; align-items: center;">
                        <div id="global-lang-display" style="padding: 5px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 4px; color: var(--text); font-size: 0.8em; font-weight: 600; white-space: nowrap; display: flex; align-items: center; min-width: 120px; justify-content: flex-start;">🇫🇷 Français</div>
							<select id="global-ai-gender" style="width: max-content; padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
    							<option value="female" selected>👩 Femme</option>
    							<option value="male">👨 Homme</option>
							</select>
							<select id="global-ai-accent" style="width: max-content; padding: 8px; border-radius: 4px; border: 1px solid #ccc; display:none;">
    							<option value="GB" selected>🇬🇧 Accent anglais</option>
    							<option value="US">🇺🇸 Accent US</option>
							</select>
                    </div>
                    <button id="btn-generate-all-ai" class="btn" style="background: var(--hapi-green-dark); color: white; border: none; padding: 8px 20px; border-radius: 25px; margin: 0; font-weight: bold; cursor: pointer;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer tout</button>
                </div>
                
                <div id="dictation-statements-container" style="margin-top: 15px;"></div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn" id="btn-add-dictation-statement" style="background:#6c757d; color:white; padding:10px 20px; border-radius:25px; border: none; font-weight: bold; cursor: pointer;">+ Ajouter une phrase manuellement</button>
                </div>

				<div class="input-group" style="margin-top: 40px;" id="dictation-options-section">
                    <details style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px;">
                        <summary style="font-weight:bold; font-size:1.2em; color:var(--text); cursor:pointer; outline:none; list-style-position: inside;">
                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options globales et techniques
                        </summary>
                        
                        <div style="margin-top: 20px;" id="dictation-global-wrapper">
                            <style>
                                #dictation-global-wrapper .section { padding: 0; box-shadow: none; border: none; background: transparent; margin: 0; }
                                #dictation-global-wrapper h2 { display: none; }
                            </style>
                            
                            ${creerFeedbackIntervallesHTML('dictation', '')}

                            <hr style="border:0; border-top:1px solid var(--border); margin:25px 0 20px 0;">

                            <div>
                                <div style="font-weight:bold; font-size:1.1em; color:var(--text); margin-bottom: 15px;">
                                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Options techniques
                                </div>
                                <div style="display:flex; flex-direction:column; gap:15px;">
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="read-punctuation-checkbox" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                        <span style="font-weight:bold; font-size:1.05em; color:var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg> Lire la ponctuation (pour l'audio IA)</span>
                                    </label>
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="generate-slow-audio" style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
                                        <span style="font-weight:bold; font-size:1.05em; color:var(--text);">Générer automatiquement une version lente</span>
                                    </label>
                                    <label style="display:flex; align-items:center; cursor:pointer;">
                                        <input type="checkbox" id="translate-ui-dictation" checked style="margin-right:12px; width: 18px; height: 18px; accent-color: var(--hapi-green);">
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
    initFeedbackIntervalles('dictation');

// ✅ 1. INITIALISATION DU SÉLECTEUR (CORPUS)
    const selectorContainer = container.querySelector('#dictation-source-selector');
    if (selectorContainer) {
        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'dictation', (selectedDocs) => {
            renderRepartitionConfigDictation(selectedDocs);
            showRegenerateButton(); // 🔄 Déclencheur Corpus
        });
    }

// ✅ 2. ÉCOUTEURS PARAMÈTRES GLOBAUX (RAG, NIVEAU & LANGUE)

    // A. La Langue (avec la logique spécifique à la dictée conservée)
    const langSelect = document.getElementById('global-language');
    if (langSelect) {
        langSelect.addEventListener('change', () => {
            showRegenerateButton(); // 🔄 Déclencheur Régénération
            updateAccentVisibility();
            updateGlobalLangLabel();
        });
    }

    // B. Écoute complète de la cascade RAG BOEN (incluant le Niveau)
    const ragElements = [
        'global-niveau',       // Le niveau HAPI de base
        'toggle-rag-boen', 'standalone-niveau',     // La case à cocher d'activation du RAG
        'global-scolarite',    // 1er menu
        'global-cycle-voie',   // 2ème menu
        'global-discipline'    // 4ème menu
    ];

    ragElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', showRegenerateButton);
    });
    
	// --- LOGIQUE VISUELLE DES PASTILLES DE SEUIL ---
	
	
    document.getElementById('btn-add-dictation-statement').addEventListener('click', () => {
        addDictationStatement();
        checkStatus();
    });
    document.getElementById('prepare-ia-btn-dictation').addEventListener('click', handlePrepareIA);
    document.getElementById('btn-send-albert-dictation').addEventListener('click', handleGenerateAlbertDictation);
    document.getElementById('btn-parse-ia-response-dictation').addEventListener('click', handleParseIA);
    document.getElementById('btn-generate-all-ai').addEventListener('click', handleGenerateAllAudio);

    const statementsContainer = document.getElementById('dictation-statements-container');
    statementsContainer.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('.delete-btn')) {
            const card = target.closest('.card');
            supprimerPhraseDictation(card.id);
            card.remove();
            updateGenerateButtonCallback();
            checkStatus();
        } else if (target.closest('.btn-record')) {
            startRecording(target.closest('.btn-record'), target.closest('.card').id);
        } else if (target.closest('.btn-stop')) {
            stopRecording(target.closest('.btn-stop'), target.closest('.card').id);
        } else if (target.closest('.btn-generate-ai')) {
            generateAIAudio(target.closest('.btn-generate-ai'), target.closest('.card').id);
        } else if (target.closest('.btn-delete-audio')) {
            deleteAudio(target.closest('.card').id, target.dataset.type);
        }
    });
    
    statementsContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('statement-audio-upload')) {
            handleFileUpload(e.target, e.target.closest('.card').id);
        }
    });
    
    // SYNCHRONISATION LANGUE GLOBALE
    //const langSelect = document.getElementById('global-language');
    const updateAccentVisibility = () => {
        const lang = langSelect ? langSelect.value : 'Français';
        const isEnglish = ['English', 'Anglais', 'en', 'en-US', 'en-GB'].includes(lang);
        const globalAccent = document.getElementById('global-ai-accent');
        if (globalAccent) globalAccent.style.display = isEnglish ? 'block' : 'none';
        document.querySelectorAll('.ai-accent-select').forEach(select => {
            select.style.display = isEnglish ? 'block' : 'none';
        });
    };
    if (langSelect) langSelect.addEventListener('change', updateAccentVisibility);
    updateAccentVisibility();
    
    const globalLangDisplay = document.getElementById('global-lang-display');
    const updateGlobalLangLabel = () => {
        if (langSelect && langSelect.options[langSelect.selectedIndex]) {
            const selectedText = langSelect.options[langSelect.selectedIndex].text;
            if(globalLangDisplay) globalLangDisplay.textContent = selectedText;
        }
    };
    if (langSelect) langSelect.addEventListener('change', updateGlobalLangLabel);
    updateGlobalLangLabel();
    
    const applyGlobalSetting = (globalId, localClass) => {
        const globalEl = document.getElementById(globalId);
        if (!globalEl) return;
        globalEl.addEventListener('change', () => {
            const newValue = globalEl.value;
            document.querySelectorAll(`.${localClass}`).forEach(select => {
                select.value = newValue;
                select.style.backgroundColor = "var(--hapi-green-pale)"; 
                setTimeout(() => select.style.backgroundColor = "", 500);
            });
        });
    };
    applyGlobalSetting('global-ai-gender', 'ai-gender-select');
    applyGlobalSetting('global-ai-accent', 'ai-accent-select');

    // 🔴 BOUCLIER ANTI-BARRE DU BAS
    const enforceHideBottomBar = () => {
        const genSection = document.getElementById('generate-section');
        const cardsCount = document.querySelectorAll('#dictation-statements-container .card').length;
        if (genSection && cardsCount < 1) {
            genSection.style.display = 'none';
        }
    };

    enforceHideBottomBar();
    setTimeout(enforceHideBottomBar, 50);

    const tabBtn = document.querySelector('.tab-btn[data-tab-target="dictation"]');
    if (tabBtn) {
        tabBtn.addEventListener('click', () => setTimeout(enforceHideBottomBar, 10));
    }
}

function renderRepartitionConfigDictation(selectedDocs) {
    const repContainer = container.querySelector('#dictation-questions-repartition');
    if (!repContainer) return;

    // Si aucun document n'est sélectionné, on vide l'affichage
    if (!selectedDocs || selectedDocs.length === 0) {
        repContainer.innerHTML = '';
        return;
    }

    // Le système d'icônes que vous vouliez garder !
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
                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg> Documents sélectionnés pour la dictée</span>
            </label>
    `;

    selectedDocs.forEach(doc => {
        const icon = getDocIcon(doc);

        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed var(--border);">
                <span style="font-size: 0.9em; color: var(--text-muted); display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 80%;" title="${doc.title}">
                    <span>${icon}</span> <span style="overflow: hidden; text-overflow: ellipsis;">${doc.title}</span>
                </span>
                <span style="font-size: 0.85em; color: var(--text-muted); font-weight: 600; background: var(--surface-2); border: 1px solid var(--border); padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">
                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Inclus
                </span>
            </div>
        `;
    });

    html += `</div>`;
    repContainer.innerHTML = html;
}

async function handlePrepareIA() {
    const btn = document.getElementById('prepare-ia-btn-dictation');
    if (!btn) return;

    const originalText = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt';
    btn.disabled = true; 
    btn.innerHTML = 'Analyse...';
    
    const texteCombine = localSourceSelector ? localSourceSelector.getSelectedContent() : corpus;

    if (!texteCombine || texteCombine.trim() === '') {
        alert("Aucune source valide sélectionnée.");
        btn.disabled = false;
        btn.innerHTML = originalText;
        return;
    }

    const success = await preparerAssistantIA_Dictation(texteCombine);
    
    if (success) {
        // On cache le conteneur du bouton
        if (btn.parentElement) btn.parentElement.style.display = 'none';

        const iaContainer = document.getElementById('ia-container-dictation');
        if (iaContainer) {
            iaContainer.style.display = 'block';
            const promptArea = document.getElementById('ia-prompt-dictation');
            if (promptArea) {
                promptArea.removeAttribute('readonly'); 
                promptArea.disabled = false;
                promptArea.style.backgroundColor = 'var(--field-bg)'; 
                promptArea.style.border = '2px solid var(--hapi-green)';
            }
        }
        
        const albertAction = document.getElementById('albert-action-dictation');
        if (albertAction) albertAction.style.display = 'block';

        setTimeout(() => {
            if (iaContainer) iaContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
    
    btn.disabled = false; 
    btn.innerHTML = originalText;
}

async function handleGenerateAlbertDictation() {
    const btn = document.getElementById('btn-send-albert-dictation');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "L'IA découpe le texte...";

    // 🔴 NOUVEAU : On cache la barre de finalisation pendant que l'IA tourne !
    const genSection = document.getElementById('generate-section');
    if (genSection) genSection.style.display = 'none';

    await callAlbertAPI('ia-prompt-dictation', 'ia-response-dictation', 'btn-parse-ia-response-dictation', btn);

    btn.innerHTML = originalText;
    btn.disabled = false;
}

function handleParseIA() {
    const responseText = document.getElementById('ia-response-dictation').value;
    if (!responseText.trim()) { alert("Réponse vide."); return; }
    const phrases = parserReponseIA_Dictation(responseText);
    if (phrases.length === 0) { alert("Aucune phrase détectée."); return; }
    const listContainer = document.getElementById('dictation-statements-container');
    listContainer.innerHTML = '';
    audioFiles.clear();
    statementCounter = 0;
    phrases.forEach(phrase => addDictationStatement(phrase));
    
    const previewSection = document.getElementById('dictation-preview-section');
    if (previewSection) {
        previewSection.style.display = 'block';
        previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    const genSection = document.getElementById('generate-section');
    if (genSection) genSection.style.display = 'block';

    updateGenerateButtonCallback();
    checkStatus();
}

// ✅ ICI LA RESTAURATION EXACTE DE VOTRE STRUCTURE CSS ORIGINALE POUR LES CARTES :
function addDictationStatement(initialText = '') {
    const container = document.getElementById('dictation-statements-container');
    statementCounter++;
    const statementId = `statement-${statementCounter}`;
    
    const card = document.createElement('div');
    card.className = 'card';
    card.id = statementId;
    card.innerHTML = `
        <button class="delete-btn"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
        <h4>Phrase ${statementCounter}</h4>
        <div class="input-group">
            <label for="${statementId}-text">Texte de la phrase :</label>
            <input type="text" id="${statementId}-text" class="statement-text" value="${initialText}">
        </div>
        <div class="input-group">
            <label>Audio de la phrase :</label>
            <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr); gap: 15px; margin-top: 10px;">
				<div class="dictation-option">
                    <strong>Option 1 : Générer par IA <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></strong>
                    <div style="display: flex; gap: 5px; align-items: center; margin-top: 10px; margin-bottom: 10px;">
                        <select id="${statementId}-ai-gender" class="ai-gender-select" style="width: max-content; padding: 5px;">
                            <option value="female" selected>👩 Femme</option>
                            <option value="male">👨 Homme</option>
                        </select>
                        <select id="${statementId}-ai-accent" class="ai-accent-select" style="width: max-content; padding: 5px; display:none;">
                            <option value="GB" selected>🇬🇧 Anglais</option>
                            <option value="US">🇺🇸 US</option>
                        </select>
                        <button class="btn btn-generate-ai" style="margin: 0; white-space: nowrap; flex: 1;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg> Générer</button>
                    </div>
                    <div id="${statementId}-ai-preview"></div>
                    <small id="${statementId}-ai-status" class="ai-status"></small>
                </div>
                <div class="dictation-option">
                    <strong>Option 2 : Enregistrer <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/></svg></strong>
                    <div class="recorder-controls">
                        <button class="btn btn-record">Enregistrer</button>
                        <button class="btn btn-stop" disabled><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1"/></svg> Arrêter</button>
                    </div>
                    <div id="${statementId}-record-preview"></div>
                    <small id="${statementId}-status" class="recorder-status"></small>
                </div>
                <div class="dictation-option">
                    <strong>Option 3 : Importer <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9l-.83-1.2A2 2 0 0 0 7.9 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg></strong>
                    <div class="custom-file-upload-container">
                        <label for="${statementId}-audio" class="btn btn-parcourir" style="margin-top: 10px; padding: 6px 20px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg> Choisir l'audio...</label>
                        <input type="file" id="${statementId}-audio" class="statement-audio-upload" accept="audio/*" style="display:none;">
                        <span id="${statementId}-audio-name-display" class="file-names-display">Aucun fichier</span>
                    </div>
                    <div id="${statementId}-upload-preview"></div>
                </div>          
            </div>
        </div>`;
    container.appendChild(card);
    
    // Logique pour afficher l'accent selon le menu global
    const langSelect = document.getElementById('global-language');
    const mainLang = langSelect ? langSelect.value : 'Français';
    const isEnglish = ['English', 'Anglais', 'en', 'en-US', 'en-GB'].includes(mainLang);
    const newAccentSelect = card.querySelector('.ai-accent-select');
    if (newAccentSelect) newAccentSelect.style.display = isEnglish ? 'block' : 'none';
    
    card.querySelector('.statement-text').addEventListener('input', () => {
        updateGenerateButtonCallback();
        checkStatus();
    });

    updateGenerateButtonCallback();
}

function checkStatus() {
    const statusDiv = document.getElementById('dictation-status-indicator');
    const cards = document.querySelectorAll('#dictation-statements-container .card');
    
    if(!cards.length) { 
        if(statusDiv) {
            statusDiv.textContent = `Il faut au moins une phrase remplie.`;
            statusDiv.style.color = 'var(--danger-text)';
            statusDiv.style.display = 'block';
        }
        return;
    }
    
    let allReady = true;
    cards.forEach(card => {
        const text = card.querySelector('.statement-text').value.trim();
        const hasAudio = audioFiles.has(card.id);
        if (!text || !hasAudio) allReady = false;
    });

    if (!allReady) {
        if(statusDiv) {
            statusDiv.textContent = `Le texte et l'audio doivent être renseignés pour chaque phrase.`;
            statusDiv.style.color = 'var(--danger-text)';
            statusDiv.style.display = 'block';
        }
    } else {
        if(statusDiv) {
            statusDiv.textContent = `${cards.length} phrases prêtes.`;
            statusDiv.style.color = 'var(--hapi-grad-a)';
        }
    }
}

// --- UPLOAD HANDLER ---
async function handleFileUpload(fileInput, statementId) {
    const display = document.getElementById(`${statementId}-audio-name-display`);
    const preview = document.getElementById(`${statementId}-upload-preview`);
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        deleteAudio(statementId, 'record', true);
        deleteAudio(statementId, 'ai', true);
        
        const makeSlowVersion = document.getElementById('generate-slow-audio').checked;
        let fileSlow = null;

        if (makeSlowVersion) {
            preview.innerHTML = `<div style="color:var(--text-muted); font-size:0.9em;">Traitement HD...</div>`;
            fileSlow = await genererVersionLentePhysique(file);
        }

        audioFiles.set(statementId, { normal: file, slow: fileSlow });
        
        const audioUrl = URL.createObjectURL(file);
		preview.innerHTML = `
            <div class="audio-preview-container"><audio controls src="${audioUrl}"></audio><button class="btn-delete-audio" data-type="upload"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button></div>
            ${fileSlow ? '<small style="color: var(--hapi-accent-text); font-size:0.8em; display:block; margin-top:2px; text-align:center;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Version lente générée</small>' : ''}
        `;
        display.textContent = file.name;
    }
    updateGenerateButtonCallback();
    checkStatus();
}

// --- RECORD HANDLER ---
async function startRecording(recordBtn, statementId) {
    logger.log(`🎤 Enregistrement ${statementId}...`);
    const card = recordBtn.closest('.card');
    const stopBtn = card.querySelector('.btn-stop');
    const statusEl = card.querySelector('.recorder-status');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        currentRecordingStatementId = statementId;
        audioChunks = [];
        mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
        
        mediaRecorder.onstop = async () => {
            if (statusEl) statusEl.textContent = 'Traitement...';
            const mimeType = mediaRecorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            
            let audioFile;
            try {
                audioFile = await convertBlobToWavFile(audioBlob, `dictation_${statementId}.wav`);
            } catch (e) {
                audioFile = new File([audioBlob], `enregistrement_${statementId}.webm`, { type: mimeType });
            }

            const makeSlowVersion = document.getElementById('generate-slow-audio').checked;
            let fileSlow = null;
            
            if (makeSlowVersion) {
                if(statusEl) statusEl.textContent = 'Traitement HD...';
                fileSlow = await genererVersionLentePhysique(audioFile);
            }

            audioFiles.set(statementId, { normal: audioFile, slow: fileSlow });
            
            const audioUrl = URL.createObjectURL(audioFile);
            const preview = document.getElementById(`${statementId}-record-preview`);
			if (preview) {
			preview.innerHTML = `
			                    <div class="audio-preview-container"><audio controls src="${audioUrl}"></audio><button class="btn-delete-audio" data-type="record"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button></div>
			                    ${fileSlow ? '<small style="color: var(--hapi-accent-text); font-size:0.8em; display:block; margin-top:2px; text-align:center;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Version lente générée</small>' : ''}
			                `;
			            }
            
            if (statusEl) statusEl.textContent = 'Enregistrement sauvegardé.';
            document.querySelectorAll('.btn-record').forEach(btn => btn.disabled = false);
            stopBtn.disabled = true;
            stream.getTracks().forEach(track => track.stop());
            updateGenerateButtonCallback();
            checkStatus();
            currentRecordingStatementId = null;
        };
        mediaRecorder.start();
        document.querySelectorAll('.btn-record').forEach(btn => btn.disabled = true);
        stopBtn.disabled = false;
        statusEl.textContent = 'Enregistrement en cours...';
        deleteAudio(statementId, 'upload', true);
        deleteAudio(statementId, 'ai', true);
    } catch (err) {
        alert("Microphone inaccessible.");
        document.querySelectorAll('.btn-record').forEach(btn => btn.disabled = false);
    }
}

function stopRecording(stopBtn, statementId) {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        stopBtn.disabled = true;
    }
}

// --- GENERATION IA ---
async function generateAIAudio(generateBtn, statementId) {
    logger.log(`🤖 Génération IA ${statementId}...`);
    
    const card = generateBtn.closest('.card');
    const textInput = card.querySelector('.statement-text');
    const genderSelect = card.querySelector('.ai-gender-select');
    const accentSelect = card.querySelector('.ai-accent-select');
    const statusEl = card.querySelector('.ai-status');
    const preview = document.getElementById(`${statementId}-ai-preview`);
    
    const text = textInput.value.trim();
    if (!text) { alert("Texte vide !"); return; }
    
    const readPunctuation = document.getElementById('read-punctuation-checkbox').checked;
    const makeSlowVersion = document.getElementById('generate-slow-audio').checked;

    generateBtn.disabled = true;
    generateBtn.textContent = '...';
    if (statusEl) { statusEl.textContent = `Connexion au serveur...`; statusEl.style.color = 'var(--text)'; }

    try {
        let textToProcess = text;
        const languageSelect = document.getElementById('global-language');
        const langValue = languageSelect ? languageSelect.value : 'Français';
        const langLower = langValue.toLowerCase();

        let codeLang = 'fr-FR'; 
        switch(langValue) {
            case 'English': codeLang = accentSelect?.value === 'US' ? 'en-US' : 'en-GB'; break;
            case 'Spanish': codeLang = 'es-ES'; break;
            case 'German': codeLang = 'de-DE'; break;
            case 'Italian': codeLang = 'it-IT'; break;
            case 'Dutch': codeLang = 'nl-NL'; break;
            case 'Portuguese': codeLang = 'pt-PT'; break;
            case 'Latin': codeLang = 'la'; break;
            case 'Normand': 
            case 'Français':
            default: codeLang = 'fr-FR'; break;
        }
		
        if (readPunctuation) {
            const map = getPunctuationMap(codeLang);
            for (const [sign, word] of Object.entries(map)) {
                textToProcess = textToProcess.split(sign).join(` - ${word} - `); 
            }
        }

        const userGender = genderSelect.value;
        let targetVoice = 'nova'; 

        if (langLower.includes('anglais') || langLower.includes('english')) {
            const isUS = accentSelect?.value === 'US';
            if (userGender === 'female') {
                targetVoice = isUS ? 'nova' : 'lily'; 
            } else {
                targetVoice = isUS ? 'onyx' : 'brian';
            }
        } else {
            targetVoice = userGender === 'female' ? 'nova' : 'onyx';
        }

        const WORKER_URL = (typeof window !== 'undefined' ? window.location.origin : '') + "/proxy-n8n/webhook/hapi-audio";

		const response = await fetch(WORKER_URL, {
		    method: 'POST',
		    headers: { 'Content-Type': 'application/json' },
		    body: JSON.stringify({ 
		        text: textToProcess,
		        voice: targetVoice 
		    })
		});

        if (!response.ok) {
            let errorMessage = `Erreur serveur: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage += ` - Détails : ${errorData.error}`;
            } catch(e) {}
            throw new Error(errorMessage);
        }

        if (statusEl) statusEl.textContent = `Réception de l'audio...`;

        const blobNormal = await response.blob();
        const fileNormal = new File([blobNormal], `ai_normal_${statementId}.mp3`, { type: 'audio/mpeg' });

        let fileSlow = null;
        if (makeSlowVersion) {
            if (statusEl) statusEl.textContent = 'Traitement HD...';
            fileSlow = await genererVersionLentePhysique(fileNormal);
            if (!fileSlow) fileSlow = new File([blobNormal], `ai_slow_fallback_${statementId}.mp3`, { type: 'audio/mpeg' });
        }

        deleteAudio(statementId, 'upload', true);
        deleteAudio(statementId, 'record', true);
        audioFiles.set(statementId, { normal: fileNormal, slow: fileSlow });
        
        const audioUrl = URL.createObjectURL(fileNormal);
        preview.innerHTML = `
            <div class="audio-preview-container"><audio controls src="${audioUrl}"></audio><button class="btn-delete-audio" data-type="ai"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button></div>
            ${fileSlow ? '<small style="color: var(--hapi-accent-text); font-size:0.8em; display:block; margin-top:2px; text-align:center;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Version lente générée</small>' : ''}
        `;
        
        if (statusEl) {
            statusEl.textContent = `Succès (Voix : ${targetVoice})`;
            statusEl.style.color = 'var(--hapi-green-deep)';
        }
        updateGenerateButtonCallback();
        checkStatus();

    } catch (error) {
        console.error(error);
        alert(`Erreur: ${error.message}`);
        if (statusEl) { statusEl.textContent = 'Erreur de génération'; statusEl.style.color = 'var(--danger-text)'; }
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Générer l\'audio';
    }
}

function askConfirmation(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 9999;
            display: flex; align-items: center; justify-content: center;
            font-family: sans-serif; opacity: 0; transition: opacity 0.2s;
        `;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: var(--surface); padding: 25px; border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            max-width: 450px; width: 90%; text-align: center;
            border: 1px solid var(--border); transform: scale(0.95); transition: transform 0.2s;
        `;

        modal.innerHTML = `
            <div style="font-size: 3em; margin-bottom: 10px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
            <h3 style="margin: 0 0 10px 0; color: var(--text); font-size: 1.25rem;">Confirmation</h3>
            <p style="color: var(--text-muted); line-height: 1.5; margin-bottom: 25px; white-space: pre-line;">${message}</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="modal-btn-no" style="padding: 10px 20px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); border-radius: 6px; cursor: pointer; font-weight: 600;">Annuler</button>
                <button id="modal-btn-yes" style="padding: 10px 20px; border: none; background: var(--hapi-green-dark); color: white; border-radius: 6px; cursor: pointer; font-weight: 600; box-shadow: 0 2px 5px rgba(var(--hapi-green-rgb), 0.3);">Confirmer</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        });

        const close = (result) => {
            overlay.style.opacity = '0';
            modal.style.transform = 'scale(0.95)';
            setTimeout(() => overlay.remove(), 200);
            resolve(result);
        };

        modal.querySelector('#modal-btn-yes').onclick = () => close(true);
        modal.querySelector('#modal-btn-no').onclick = () => close(false);
        overlay.onclick = (e) => { if (e.target === overlay) close(false); };
    });
}

function showBatchSummary(success, errors) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            font-family: sans-serif; opacity: 0; transition: opacity 0.2s;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: var(--surface); padding: 25px; border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            max-width: 400px; width: 90%; text-align: center;
            border: 1px solid var(--border); transform: scale(0.95); transition: transform 0.2s;
        `;

        const icon = errors === 0 ? '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' : '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg>';
        const titleColor = errors === 0 ? '#1e293b' : '#b45309';

        modal.innerHTML = `
            <div style="font-size: 3em; margin-bottom: 10px;">${icon}</div>
            <h3 style="margin: 0 0 15px 0; color: ${titleColor}; font-size: 1.25rem;">Génération terminée</h3>
            <div style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: left;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                    <span style="color: var(--text-muted);">Traitement total :</span>
                    <strong>${success + errors}</strong>
                </div>
                <hr style="border: 0; border-top: 1px solid var(--border); margin: 8px 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">
                    <span style="color: #15803d; font-weight: 600;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Succès :</span>
                    <span style="background:rgba(34, 197, 94, 0.20); color: var(--hapi-accent-text); padding:2px 8px; border-radius:10px; font-weight:bold; font-size:0.9em;">${success}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="color: ${errors > 0 ? '#b91c1c' : 'var(--text-muted)'}; font-weight: 600;">✕ Erreurs :</span>
                    <span style="background:${errors > 0 ? 'rgba(220, 38, 38, 0.12)' : '#f1f5f9'}; color:${errors > 0 ? '#991b1b' : 'var(--text-muted)'}; padding:2px 8px; border-radius:10px; font-weight:bold; font-size:0.9em;">${errors}</span>
                </div>
            </div>
            <button id="modal-btn-close" style="width: 100%; padding: 10px 20px; border: none; background: #0f172a; color: white; border-radius: 6px; cursor: pointer; font-weight: 600;">Fermer</button>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        });

        const close = () => {
            overlay.style.opacity = '0';
            modal.style.transform = 'scale(0.95)';
            setTimeout(() => overlay.remove(), 200);
            resolve();
        };

        modal.querySelector('#modal-btn-close').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };
    });
}

async function handleGenerateAllAudio() {
    const cards = document.querySelectorAll('#dictation-statements-container .card');
    if (cards.length === 0) return;
    if (!await askConfirmation(`Générer ${cards.length} phrases ?`)) return;

    const btn = document.getElementById('btn-generate-all-ai');
    btn.disabled = true; btn.textContent = '...';
    
    const gen = document.getElementById('global-ai-gender').value;
    const acc = document.getElementById('global-ai-accent').value;
    
    cards.forEach(card => {
        card.querySelector('.ai-gender-select').value = gen;
        const accSel = card.querySelector('.ai-accent-select');
        if(accSel) accSel.value = acc;
    });

    let s = 0, e = 0;
    for (const card of cards) {
        const txt = card.querySelector('.statement-text').value.trim();
        if(txt) {
            try {
                await generateAIAudio(card.querySelector('.btn-generate-ai'), card.id);
                s++;
                await new Promise(r => setTimeout(r, 300));
            } catch(err) { e++; }
        }
    }
    btn.disabled = false; btn.textContent = 'Générer tout';
    await showBatchSummary(s, e);
}

function deleteAudio(statementId, type, silent = false) {
    if (type === 'record') {
        const preview = document.getElementById(`${statementId}-record-preview`);
        if(preview) preview.innerHTML = '';
        const status = document.getElementById(`${statementId}-status`);
        if(status) status.textContent = ''; 
    } 
    else if (type === 'upload') {
        const preview = document.getElementById(`${statementId}-upload-preview`);
        if(preview) preview.innerHTML = '';
        document.getElementById(`${statementId}-audio`).value = '';
        document.getElementById(`${statementId}-audio-name-display`).textContent = 'Aucun fichier';
    } 
    else if (type === 'ai') {
        const preview = document.getElementById(`${statementId}-ai-preview`);
        if(preview) preview.innerHTML = '';
        const statusAi = document.getElementById(`${statementId}-ai-status`);
        if(statusAi) statusAi.textContent = '';
    }
    
    if (audioFiles.has(statementId)) audioFiles.delete(statementId);
    if (!silent) {
        updateGenerateButtonCallback();
        checkStatus();
    }
}

function supprimerPhraseDictation(statementId) {
    if (currentRecordingStatementId === statementId && mediaRecorder) mediaRecorder.stop();
    audioFiles.delete(statementId);
}

// =========================================================
// 💾 GESTION IMPORT / EXPORT (déléguée à utils/states/dictation-state.js)
// =========================================================

export async function getUIState() {
    return await getDictationState(audioFiles);
}

export function setUIState(config) {
    setDictationState(config, {
        clearPreview: () => {
            document.getElementById('dictation-statements-container').innerHTML = '';
            statementCounter = 0;
            audioFiles.clear(); 
        },
        addCard: (data) => {
            addDictationStatement(data.text);
            
            const container = document.getElementById('dictation-statements-container');
            const lastCard = container.lastElementChild;
            if (!lastCard) return;
            const statementId = lastCard.id;
            
            if (data.gender) lastCard.querySelector('.ai-gender-select').value = data.gender;
            if (data.accent) lastCard.querySelector('.ai-accent-select').value = data.accent;
            
            if (data.normalFile) {
                audioFiles.set(statementId, { normal: data.normalFile, slow: data.slowFile });
                
                const fileName = data.normalFile.name || '';
                const audioUrl = URL.createObjectURL(data.normalFile);
                
                // 🟢 ASTUCE : On détecte l'origine de l'audio grâce à son nom
                let targetType = 'upload';
                let previewContainerId = `${statementId}-upload-preview`;
                
                if (fileName.includes('ai_normal')) {
                    targetType = 'ai';
                    previewContainerId = `${statementId}-ai-preview`;
                } else if (fileName.includes('dictation_') || fileName.includes('enregistrement_')) {
                    targetType = 'record';
                    previewContainerId = `${statementId}-record-preview`;
                }
                
                const preview = document.getElementById(previewContainerId);
                
                // Mise à jour de l'affichage spécifique selon l'onglet
                if (targetType === 'upload') {
                    const display = document.getElementById(`${statementId}-audio-name-display`);
                    if (display) display.textContent = fileName;
                } else if (targetType === 'ai') {
                    const statusAi = document.getElementById(`${statementId}-ai-status`);
                    if (statusAi) {
                        statusAi.textContent = 'Audio IA restauré';
                        statusAi.style.color = 'var(--hapi-green-deep)';
                    }
                } else if (targetType === 'record') {
                    const statusRec = document.getElementById(`${statementId}-status`);
                    if (statusRec) {
                        statusRec.textContent = 'Enregistrement restauré';
                    }
                }

                // Affichage du lecteur audio dans la bonne section
                if (preview) {
                    preview.innerHTML = `
                        <div class="audio-preview-container">
                            <audio controls src="${audioUrl}"></audio>
                            <button class="btn-delete-audio" data-type="${targetType}"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
                        </div>
                        ${data.slowFile ? '<small style="color: var(--hapi-accent-text); font-size:0.8em; display:block; margin-top:2px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Version lente restaurée</small>' : ''}
                    `;
                }
            }
        },
        updateBtn: updateGenerateButtonCallback
    });
// 🟢 AJOUT POUR RESTAURER LES INTERVALLES :
    if (config.overallFeedback) {
        setFeedbackIntervallesData('dictation', config.overallFeedback);
    }
}

function showRegenerateButton() {
    const iaContainer = document.getElementById('ia-container-dictation');
    const btnPrepare = document.getElementById('prepare-ia-btn-dictation');

    // On ne réveille le bouton que si la zone IA est déjà visible
    if (iaContainer && iaContainer.style.display === 'block') {
        if (btnPrepare) {
            if (btnPrepare.parentElement) btnPrepare.parentElement.style.display = 'block'; 
            btnPrepare.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg> Régénérer le prompt';
            btnPrepare.style.background = 'linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark))';
            btnPrepare.style.boxShadow = '0 4px 15px rgba(var(--hapi-green-rgb), 0.3)';
        }
    }
}


export function gatherData() {
    logger.log('📊 Collecte...');
    const langSelect = document.getElementById('global-language');
    const lang = langSelect ? langSelect.value : 'Français';
    const niveauSelect = document.getElementById('global-niveau');
    const niveau = niveauSelect ? niveauSelect.value : 'Cycle 2';
    const translateUI = document.getElementById('translate-ui-dictation')?.checked;
    
    const donnees = {
        titre: document.getElementById('dictationTitle').value,
		niveau: niveau, 
        consignes: document.getElementById('dictationTask').value,
        overallFeedback: getFeedbackIntervallesData('dictation'),
        l10n: getH5PLocalization(translateUI ? lang : 'Français', 'Dictation'),
        sentences: {} 
    };

    const cards = document.querySelectorAll('#dictation-statements-container .card');
    const statusDiv = document.getElementById('dictation-status-indicator');
    
    if (cards.length === 0) {
        if(statusDiv) {
            statusDiv.textContent = `Il faut au moins une phrase remplie.`;
            statusDiv.style.color = 'var(--danger-text)';
            statusDiv.style.display = 'block';
        }
        return null;
    }

    let allReady = true;
    
    cards.forEach(card => {
        const id = card.id;
        const text = card.querySelector('.statement-text').value.trim();
        const entry = audioFiles.get(id);
        
        if (text && entry) {
            const fNormal = (entry instanceof File) ? entry : entry.normal;
            const fSlow = (entry instanceof File) ? null : entry.slow;
            donnees.sentences[id] = { text, file: fNormal, fileSlow: fSlow };
        } else allReady = false;
    });

    if (!allReady) { 
        if(statusDiv) {
            statusDiv.textContent = `Le texte et l'audio doivent être renseignés pour chaque phrase.`;
            statusDiv.style.color = 'var(--danger-text)';
            statusDiv.style.display = 'block';
        }
        return null; 
    }

    if(statusDiv) {
        statusDiv.textContent = `${cards.length} phrases valides. Prêt à générer.`;
        statusDiv.style.color = 'var(--hapi-grad-a)';
    }

    return donnees;
}

export function getAudioFiles() {
    return audioFiles;
}