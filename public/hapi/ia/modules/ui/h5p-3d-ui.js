// Fichier: modules/ui/h5p-3d-ui.js
import { logger } from '../utils/logger.js';
import { H5P_LIBS_BASE_URL } from '../utils/h5p-constants.js';
//import { generateMoleculeGLB } from '../generation/pubchem-3d-generator.js';
import { generateMoleculeGLB } from '../generation/activities/pubchem-3d-generator.js';
import { preparerAssistantIA_Molecules3D } from '../ia/prompt-builder.js';
import { parserReponseIA_Molecules3D, deduplicateMolecules } from '../ia/response-parser.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { lancerPrevisualisation } from '../ui/preview-manager.js';
//import { genererH5PModele, genererZIPModele } from '../generation/h5p-generator.js';
import { genererH5PModele, genererZIPModele, genererZIPMoleculesLot } from '../generation/h5p-generator.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { creerAssistantIA_HTML } from '../utils/helpers.js';
import { exportPDF_MoleculeSingle } from '../utils/exports-pdf/pdf-molecule.js';

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'; 
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'; 
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

import { getH5P3DState, setH5P3DState } from '../utils/states/h5p-3d-state.js';
import { SourceSelector } from './source-selector.js'; 

const LIBS_ZIP_PATH = `${H5P_LIBS_BASE_URL}/h5p-deps-3D.zip`;

const moleculesGenerees = new Map(); 
let moleculesDetectees = [];
let containerElement = null;
let updateButtonCallback = null;
let pendingH5PDownloadName = null;
let currentCorpus = null; 

let currentMoleculeName = null;
let currentScene = null;
let currentCamera = null;
let currentRenderer = null;
let currentRaycaster = null;
let currentMouse = null;
let annotationMarkers = [];
let currentModel = null; 
let isPlacementMode = false;
let hemiLight, dirLight, controls; 
let localSourceSelector = null;

// 🟢 NOUVEL UTILITAIRE : Convertit le fichier en Base64 instantanément
function blobToBase64(blob) {
    return new Promise((resolve) => {
        if (!blob) return resolve(null);
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
    });
}

export function init(container, corpus, updateCallback) {
    if (containerElement === container && container.querySelector('#h5p-3d-wrapper')) {
        if (corpus) updateCorpus(corpus);
        if (updateButtonCallback) updateButtonCallback();
        return;
    }

    containerElement = container;
    
	updateButtonCallback = () => {
	        if (updateCallback) updateCallback(); // Laisse HAPI faire sa validation de base
        
	        // 🟢 LE CORRECTIF EST ICI : On affiche intelligemment le bouton !
	        const mainGenBtn = document.getElementById('generate-button');
	        if (mainGenBtn) {
	            // Si des molécules sont générées, on montre le bouton "Passer à la finalisation"
	            if (typeof moleculesGenerees !== 'undefined' && moleculesGenerees.size > 0) {
	                mainGenBtn.style.display = 'inline-block'; 
	            } else {
	                mainGenBtn.style.display = 'none';
	            }
	        }
        
	        const previewBtn = document.getElementById('preview-button');
	        if (previewBtn) previewBtn.style.display = 'none'; // Gardé caché car inutile ici
        
	        document.querySelectorAll('button').forEach(btn => {
	            if (btn.textContent.includes("Prévisualiser l'activité en cours")) {
	                btn.style.display = 'none';
	            }
	        });
	    };
    
    if (corpus) currentCorpus = corpus;
    
    moleculesGenerees.clear();
    moleculesDetectees = [];
    renderUI();
    attachEventListeners();
    window.addEventListener('beforeunload', cleanupMoleculeURLs);
    
    const enforceHideBottomBar = () => {
        const genSection = document.getElementById('generate-section');
        const cardsCount = document.querySelectorAll('#molecules-list-container-3d .molecule-card.generated').length;
        if (genSection && cardsCount < 1) genSection.style.display = 'none';
        if (updateButtonCallback) updateButtonCallback();
    };

    enforceHideBottomBar();
    setTimeout(enforceHideBottomBar, 50);

    const tabBtn = document.querySelector('.tab-btn[data-tab-target="h5p3d"]');
    if (tabBtn) tabBtn.addEventListener('click', () => setTimeout(enforceHideBottomBar, 10));

    if (updateButtonCallback) updateButtonCallback();
}

export function updateCorpus(newCorpus) {
    currentCorpus = newCorpus;
    const textarea = document.getElementById('moleculesTexteSource');
    if (textarea) {
        textarea.value = currentCorpus || '';
        textarea.style.borderColor = 'var(--hapi-green)';
        setTimeout(() => textarea.style.borderColor = '#ccc', 1000);
    }
}

function renderUI() {
    const rawSources = corpusManager.getCorpusSources();
    const documentsList = [
        { id: 'all', title: 'Tout le corpus (Hybride)', content: currentCorpus, type: 'all', priority: 2 },
        ...rawSources.map(s => ({
            id: s.id,
            title: s.name,
            content: s.data || s.content || currentCorpus,
            type: s.type,
            priority: s.priority !== undefined ? s.priority : 2
        }))
    ];

    containerElement.innerHTML = `
        <div id="h5p-3d-wrapper" style="font-family:'Segoe UI', sans-serif;">
            <div class="section" style="background:var(--surface); padding:25px; border-radius:12px; margin-bottom:20px; border-left:6px solid var(--hapi-green); box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                <h3 style="margin:0 0 15px 0; color:var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Assistant IA (Génération 3D)</h3>
                <div id="h5p3d-source-selector"></div>
                <div id="h5p3d-selected-docs"></div>
                <textarea id="moleculesTexteSource" style="display:none;">${currentCorpus}</textarea>
                <div style="text-align:center; margin-top:25px;">
                    <button id="btn-prepare-prompt-3d" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt
                    </button>
                </div>
            </div>

            <div id="ia-container-3d" class="section" style="display:none; margin-bottom:20px; background:var(--surface); padding:25px; border-radius:12px; border-left:6px solid var(--hapi-green); box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                ${creerAssistantIA_HTML('ia-prompt-3d', 'ia-response-3d')}
                <div id="albert-action-3d" style="text-align: center; margin-top: 15px; margin-bottom: 10px;">
                    <button id="btn-send-albert-3d" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        🇫🇷 Envoyer le prompt à l'IA
                    </button>
                </div>
                <div style="text-align:center; margin-top:15px; display:none;">
                    <button id="btn-parse-ia-response-3d" class="btn" style="background:var(--hapi-grad-a); color:white; padding:10px 25px; border:none; border-radius:25px; cursor:pointer; font-weight:bold; font-size:1.05em; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg> Valider et générer les modèles
                    </button>
                </div>
            </div>

            <div class="section" id="molecules-list-section-3d" style="display:none; background:var(--surface); padding:25px; border-radius:12px; margin-bottom:20px; border-left:6px solid var(--hapi-green); box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                <h3 style="margin:0 0 15px 0; color:var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Génération et édition des modèles</h3>
                <div id="molecules-list-container-3d"></div>
            </div>
        </div>

        <div id="annotation-editor-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 style="margin:0; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Éditez les annotations 3D</h2>
                    <span class="close" id="close-annotation-editor">&times;</span>
                </div>
                <div class="modal-body">
                    <div id="annotation-viewer-container">
                        <div id="annotation-viewer-info">
                            <strong>Mode :</strong> <span id="annotation-mode" style="font-weight: bold; color: var(--hapi-accent-text);">Navigation</span><br>
                            <em id="annotation-instruction" style="color:var(--text-muted);">Tournez le modèle pour choisir un angle de vue.</em>
                        </div>
                        <canvas id="annotation-canvas"></canvas>
                    </div>
                    <div id="annotation-panel">
                        <h3 style="margin-top: 0; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg> Annotations</h3>
                        <div id="annotations-list"></div>
                        <div style="margin-top: 20px;">
                            <button id="add-annotation-btn" class="btn-primary" style="width: 100%; padding: 12px; display: flex; justify-content: center; align-items: center; gap: 8px;">
                                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg></span> Ajouter une annotation
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-annotations-btn" class="btn-secondary">Fermer</button>
                    <button id="save-annotations-btn" class="btn-success"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Enregistrer</button>
                </div>
            </div>
        </div>

        <div id="h5p-warning-modal" class="modal">
            <div class="modal-content" style="height: auto !important; max-height: 80vh; max-width: 600px; border-top: 5px solid #f39c12;">
                <div class="modal-header">
                    <h2 style="margin:0; color: var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> Téléchargement H5P</h2>
                    <span class="close" id="close-h5p-warning">&times;</span>
                </div>
                <div class="modal-body" style="flex-direction: column; padding: 30px; font-size: 1.1em; line-height: 1.6;">
                    <div style="font-size: 3em; color: var(--warning-text); margin-bottom: 20px; text-align: center;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></div>
                    <p>Vous allez télécharger un fichier <strong>.h5p</strong>.</p>
					<div style="background: rgba(234, 88, 12, 0.10); border-left: 4px solid #b45309; padding: 15px; margin: 15px 0; border-radius: 4px; font-size: 0.95em;">
						<p style="margin:0;"><strong>Ces fichiers ne sont pas implémentés sur Éléa. Utilisez la plateforme académique.</strong></p>
					</div>
                    <p>Voulez-vous continuer ?</p>
                </div>
                <div class="modal-footer">
                    <button id="cancel-h5p-download" class="btn-secondary">Annuler</button>
                    <button id="confirm-h5p-download" class="btn-action-main"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Générer et télécharger</button>
                </div>
            </div>
        </div>
    `;

    const selectorContainer = containerElement.querySelector('#h5p3d-source-selector');
    if (selectorContainer) {
        localSourceSelector = new SourceSelector(
            selectorContainer, documentsList, 'h5p3d', renderSelectedSources3D 
        );
    }
}

function attachEventListeners() {
    const btnPrepare = containerElement.querySelector('#btn-prepare-prompt-3d');
    if (btnPrepare) btnPrepare.addEventListener('click', handlePreparePrompt);
    
    const iaLauncher = document.getElementById('ia-launcher-ia-prompt-3d');
    if (iaLauncher) iaLauncher.style.display = 'none';

    const btnAlbert = document.getElementById('btn-send-albert-3d');
    if (btnAlbert) {
        btnAlbert.addEventListener('click', async () => {
            const originalText = btnAlbert.innerHTML;
            btnAlbert.disabled = true;
            btnAlbert.innerHTML = "L'IA extrait les molécules...";
            await callAlbertAPI('ia-prompt-3d', 'ia-response-3d', 'btn-parse-ia-response-3d', btnAlbert);
            btnAlbert.innerHTML = originalText;
            btnAlbert.disabled = false;
        });
    }

    const btnParse = document.getElementById('btn-parse-ia-response-3d');
    if (btnParse) btnParse.addEventListener('click', handleImportResponse);

    document.getElementById('close-annotation-editor').addEventListener('click', closeAnnotationEditor);
    document.getElementById('cancel-annotations-btn').addEventListener('click', closeAnnotationEditor);
    document.getElementById('save-annotations-btn').addEventListener('click', saveAnnotations);
    
    const btnAddAnno = document.getElementById('add-annotation-btn');
    if(btnAddAnno) btnAddAnno.addEventListener('click', handleAddAnnotationClick);
    
    document.getElementById('close-h5p-warning').addEventListener('click', closeH5PWarning);
    document.getElementById('cancel-h5p-download').addEventListener('click', closeH5PWarning);
    document.getElementById('confirm-h5p-download').addEventListener('click', proceedWithH5PDownload);
}

function renderSelectedSources3D(selectedDocs) {
    const hiddenSource = document.getElementById('moleculesTexteSource');
    if (hiddenSource && localSourceSelector) hiddenSource.value = localSourceSelector.getSelectedContent();
    const repContainer = containerElement.querySelector('#h5p3d-selected-docs');
    if (!repContainer) return;

    if (!selectedDocs || selectedDocs.length === 0) {
        repContainer.innerHTML = ''; return;
    }

    let html = `<div style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px; margin-top: 10px;">
            <label style="font-weight:bold; margin-bottom:12px; color:var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg> Documents analysés</label>`;
    selectedDocs.forEach(doc => {
        html += `<div style="margin-bottom: 8px; border-bottom: 1px dashed var(--border);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg> ${doc.title}</div>`;
    });
    html += `</div>`;
    repContainer.innerHTML = html;
}

async function handlePreparePrompt() {
    const localTextArea = document.getElementById('moleculesTexteSource');
    const texteSource = localTextArea ? localTextArea.value : currentCorpus; 
    if (!texteSource || texteSource.trim() === "") return alert("Veuillez sélectionner au moins une source.");

    const btn = document.getElementById('btn-prepare-prompt-3d');
    if(btn) { btn.disabled = true; btn.innerHTML = 'Analyse...'; }

    const success = await preparerAssistantIA_Molecules3D(texteSource);
    if (success) document.getElementById('ia-container-3d').style.display = 'block';

    if(btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt';
    }
}

function handleImportResponse() {
    const reponseBrute = containerElement.querySelector('#ia-response-3d').value;
    const molecules = parserReponseIA_Molecules3D(reponseBrute);
    if (molecules && molecules.length > 0) {
        moleculesDetectees = deduplicateMolecules(molecules);
        displayMoleculesList(moleculesDetectees);
    }
}

function displayMoleculesList(molecules) {
    const container = document.querySelector('#molecules-list-container-3d');
    const section = document.querySelector('#molecules-list-section-3d');
    if (!container || !section) return;

    section.style.display = 'block';
    container.innerHTML = '';
    
    molecules.forEach((mol, index) => {
        const card = document.createElement('div');
        card.className = 'card molecule-card'; 
        card.dataset.rawFormula = mol.formule || ''; 
        
        card.innerHTML = `
            <div class="molecule-header-row">
                <div class="molecule-input-group">
                    <label>Nom de la molécule :</label>
                    <input type="text" id="mol-title-${index}" value="${mol.titre}">
                </div>
                <div class="btn-generate-container">
                    <button class="btn-generate-glb" data-name="${mol.nom_pubchem}" data-formula="${mol.formule || ''}" data-input-id="mol-title-${index}">
                        Générer le modèle 3D
                    </button>
                </div>
            </div>
            <div class="molecule-content-row" id="molecule-content-${index}" style="display:none;"></div>
            <div class="generation-status" style="margin-top:5px; font-size:0.9em; color:var(--text-muted);"></div>
        `;
        container.appendChild(card);
        card.querySelector('.btn-generate-glb').addEventListener('click', function() { handleGenerateGLB(this, index); });
		
	    const globalGenSec = document.getElementById('generate-section');
	    if (globalGenSec) globalGenSec.style.display = 'block';
    });
}

async function handleGenerateGLB(button, index) {
    const nomPubChem = button.dataset.name;
    const inputId = button.dataset.inputId;
    const titrePersonnalise = document.getElementById(inputId).value;
    const formuleChimique = button.dataset.formula; 
    
    const card = button.closest('.card');
    const contentRow = card.querySelector(`#molecule-content-${index}`);
    const statusDiv = card.querySelector('.generation-status');
    
    button.disabled = true;
    button.textContent = '...';
    statusDiv.textContent = `Connexion à PubChem...`;

    try {
        const data = await generateMoleculeGLB(nomPubChem);
        const existingData = moleculesGenerees.get(nomPubChem);
        const savedHotspots = existingData && existingData.hotspots ? existingData.hotspots : [];
        
        // 🟢 SÉCURITÉ ABSOLUE : On convertit tout de suite le modèle en Base64
        const rawBase64 = data.fileBlob ? await blobToBase64(data.fileBlob) : null;

        let modelData = { 
            url: data.url, 
            title: titrePersonnalise,
            formula: formuleChimique,
            originalName: nomPubChem,
            hotspots: savedHotspots,
            isOptimized: false,
            fileBlob: data.fileBlob,
            glbB64: rawBase64 // <-- Stocké en mémoire instantanément !
        };

        statusDiv.textContent = `Alignement et centrage 3D...`;

        await new Promise((resolve) => {
            const loader = new GLTFLoader();
            loader.load(modelData.url, (gltf) => {
                const geometries = [];
                gltf.scene.traverse((child) => {
                    if (child.isMesh) {
                        child.updateMatrixWorld(true);
                        const geometry = child.geometry.clone();
                        geometry.applyMatrix4(child.matrixWorld);
                        
                        if (!geometry.attributes.color && child.material && child.material.color) {
                            const count = geometry.attributes.position.count;
                            const colors = new Float32Array(count * 3);
                            const color = child.material.color;
                            for (let i = 0; i < count; i++) {
                                colors[i * 3] = color.r;
                                colors[i * 3 + 1] = color.g;
                                colors[i * 3 + 2] = color.b;
                            }
                            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                        }
                        geometries.push(geometry);
                    }
                });

                if (geometries.length === 0) return resolve(); 

                const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, false);
                mergedGeometry.center(); 

                const mergedMaterial = new THREE.MeshStandardMaterial({
                    vertexColors: true, metalness: 0.3, roughness: 0.4
                });
                const optimizedModel = new THREE.Mesh(mergedGeometry, mergedMaterial);

                const exporter = new GLTFExporter();
                exporter.parse(optimizedModel, async function (result) {
                    const blob = new Blob([result], { type: 'application/octet-stream' });
                    const newUrl = URL.createObjectURL(blob);
                    
                    if (modelData.url.startsWith('blob:')) URL.revokeObjectURL(modelData.url);
                    
                    modelData.url = newUrl;
					modelData.fileBlob = blob;
                    modelData.isOptimized = true; 
                    
                    // 🟢 MISE À JOUR BASE64 : Modèle optimisé
                    modelData.glbB64 = await blobToBase64(blob);

                    resolve();
                }, function (error) { resolve(); }, { binary: true });
            }, undefined, function(error) { resolve(); }); 
        });

        moleculesGenerees.set(nomPubChem, modelData);
        
        button.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Modèle prêt';
        button.classList.add('success');
        card.classList.add('generated');
        statusDiv.textContent = ''; 
        contentRow.style.display = 'flex'; 
        
        let formulaDisplay = '';
        if (formuleChimique) {
            const htmlSub = formuleChimique.replace(/(\d+)/g, '<sub>$1</sub>');
            formulaDisplay = `<span class="html-fallback">${htmlSub}</span>`;
        } else {
            formulaDisplay = '<span style="font-size:0.6em; color:var(--text-muted);">Non disponible</span>';
        }

        const nomFichierClean = `${nettoyerNomFichier(titrePersonnalise)}.glb`;

        contentRow.innerHTML = `
            <div class="formula-box" id="formula-box-${index}">
                <div class="formula-label">FORMULE CHIMIQUE</div>
                <div class="formula-content">${formulaDisplay}</div>
                <button class="btn-download-formula" onclick="downloadFormulaImage('formula-box-${index}', '${nomFichierClean}')"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></svg></button>
            </div>
            <div class="export-buttons-grid">
                <div class="export-row-top">
                    <button class="btn-export-action btn-edit" data-name="${nomPubChem}"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></span> Annotations</button>
                    <button class="btn-export-action btn-preview btn-preview-h5p-single" data-name="${nomPubChem}"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></span> Prévisualiser</button>
                </div>
                <div class="export-row-bottom">
                    <button class="btn-export-action btn-glb btn-download-glb-single" data-name="${nomPubChem}" data-url="${modelData.url}" data-filename="${nomFichierClean}"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></span> GLB</button>
                    <button class="btn-export-action btn-pdf btn-download-pdf-single" data-name="${nomPubChem}"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></span> PDF</button>
                    <button class="btn-export-action btn-h5p btn-download-h5p-single" data-name="${nomPubChem}"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg></span> H5P</button>
                    <button class="btn-export-action btn-zip btn-download-zip-single" data-name="${nomPubChem}"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></span> ZIP</button>
                </div>
            </div>
        `;
		attachDynamicListeners(contentRow);
		if (typeof updateButtonCallback === 'function') updateButtonCallback();

    } catch (err) {
        statusDiv.textContent = `Échec: ${err.message}`;
        button.disabled = false;
        button.textContent = 'Réessayer';
    }
}

function attachDynamicListeners(parentElement) {
    parentElement.querySelector('.btn-edit').addEventListener('click', (e) => handleEditAnnotations(e.currentTarget));
    parentElement.querySelector('.btn-preview').addEventListener('click', (e) => handlePreviewHPSingle(e.currentTarget));
    parentElement.querySelector('.btn-download-glb-single').addEventListener('click', (e) => handleDownloadGLBSingle(e.currentTarget));
    parentElement.querySelector('.btn-download-h5p-single').addEventListener('click', (e) => handleDownloadH5PSingle(e.currentTarget));
    parentElement.querySelector('.btn-download-zip-single').addEventListener('click', (e) => handleDownloadZIPSingle(e.currentTarget));
    parentElement.querySelector('.btn-download-pdf-single').addEventListener('click', (e) => handleDownloadPDFSingle(e.currentTarget));
}

async function handleDownloadPDFSingle(btn) {
    const name = btn.dataset.name;
    const modelData = moleculesGenerees.get(name);
    if (!modelData) return alert("Données introuvables.");
    const originalText = btn.innerHTML;
    btn.innerHTML = ''; btn.disabled = true;
    try { await exportPDF_MoleculeSingle(modelData); } 
    catch (e) { alert("Erreur PDF: " + e.message); } 
    finally { btn.innerHTML = originalText; btn.disabled = false; }
}

window.downloadFormulaImage = function(elementId, fileName) {
    const element = document.getElementById(elementId);
    if (!element) return;
    if (typeof html2canvas === 'undefined') return alert("La librairie html2canvas n'est pas chargée.");
    const btn = element.querySelector('.btn-download-formula');
    if(btn) btn.style.display = 'none';
    html2canvas(element, { backgroundColor: null, scale: 3 }).then(canvas => {
        if(btn) btn.style.display = 'block';
        const link = document.createElement('a');
        link.download = `formule_${fileName}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    }).catch(err => {
        if(btn) btn.style.display = 'block';
        alert("Impossible de générer l'image.");
    });
};

function animate() {
    if (!currentRenderer) return;
    requestAnimationFrame(animate);
    currentRenderer.render(currentScene, currentCamera);
}

async function handleEditAnnotations(button) {
    const name = button.dataset.name;
    currentMoleculeName = name;
    const modelData = moleculesGenerees.get(name);
    if (!modelData) return alert("Erreur données.");
    document.getElementById('annotation-editor-modal').style.display = 'flex';
    await loadAnnotationViewer(modelData);
}

async function loadAnnotationViewer(modelData) {
    isPlacementMode = false;
    updateAnnotationModeUI();

    const canvas = document.getElementById('annotation-canvas');
    const container = document.getElementById('annotation-viewer-container');
    
    if (currentRenderer) {
        currentRenderer.dispose();
        annotationMarkers = [];
    }
    
    currentRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    currentRenderer.setSize(container.clientWidth, container.clientHeight);
    currentRenderer.outputColorSpace = THREE.SRGBColorSpace;
    
    const environment = new RoomEnvironment();
    const pmremGenerator = new THREE.PMREMGenerator(currentRenderer);
    
    currentScene = new THREE.Scene();
    currentScene.background = new THREE.Color(0xf0f0f0);
    currentScene.environment = pmremGenerator.fromScene(environment).texture;
    environment.dispose();
    
    hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 2.0);
    currentScene.add(hemiLight);
    dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(5, 10, 7.5);
    currentScene.add(dirLight);
    
    currentCamera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    controls = new OrbitControls(currentCamera, currentRenderer.domElement);
    controls.enableDamping = true;
    
    const loader = new GLTFLoader();
    loader.load(modelData.url, (gltf) => {
        currentModel = gltf.scene.children[0];
        currentScene.add(currentModel);
        setupSceneAndCamera();
        loadExistingHotspots(modelData);
        animate();
    });
    
    currentRaycaster = new THREE.Raycaster();
    currentMouse = new THREE.Vector2();
    canvas.addEventListener('click', onAnnotationCanvasClick);
    renderAnnotationsList();
}

function setupSceneAndCamera() {
    const box = new THREE.Box3().setFromObject(currentModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const center = new THREE.Vector3();
    controls.target.copy(center);
    controls.update();
    currentCamera.position.copy(center);
    currentCamera.position.z += maxDim * 1.5;
    currentCamera.updateProjectionMatrix();
}

function createMarkerMesh(position) {
    const radius = 0.09; 
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const mesh = new THREE.Mesh(geometry, coreMat);
    mesh.position.copy(position);
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
    const outline = new THREE.Mesh(geometry, outlineMat);
    outline.scale.multiplyScalar(1.25);
    mesh.add(outline); 
    return mesh;
}

function loadExistingHotspots(modelData) {
    modelData.hotspots.forEach(hotspot => {
        const pos = new THREE.Vector3(hotspot.vector.x, hotspot.vector.y, hotspot.vector.z);
        const marker = createMarkerMesh(pos);
        currentScene.add(marker);
        annotationMarkers.push(marker);
    });
}

function onAnnotationCanvasClick(event) {
    if (!isPlacementMode || !currentModel) return;
    
    const canvas = document.getElementById('annotation-canvas');
    const rect = canvas.getBoundingClientRect();
    currentMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    currentMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    currentRaycaster.setFromCamera(currentMouse, currentCamera);
    const intersects = currentRaycaster.intersectObject(currentModel, false);

    if (intersects.length > 0) {
        const intersect = intersects[0];
        const point = intersect.point;
        const face = intersect.face;
        const geometry = intersect.object.geometry; 
        const posAttr = geometry.attributes.position;
        
        const vA = new THREE.Vector3().fromBufferAttribute(posAttr, face.a);
        const vB = new THREE.Vector3().fromBufferAttribute(posAttr, face.b);
        const vC = new THREE.Vector3().fromBufferAttribute(posAttr, face.c);
        
        const bary = new THREE.Vector3();
        THREE.Triangle.getBarycoord(intersect.point, vA, vB, vC, bary);
        
        const surfaceString = `0 0 ${face.a} ${face.b} ${face.c} ${bary.x.toFixed(3)} ${bary.y.toFixed(3)} ${bary.z.toFixed(3)}`;
        addAnnotationAtPoint(point, surfaceString);
        
        isPlacementMode = false;
        updateAnnotationModeUI();
    }
}

function addAnnotationAtPoint(position, surface) {
    const modelData = moleculesGenerees.get(currentMoleculeName);
    modelData.hotspots.push({
        vector: { x: position.x, y: position.y, z: position.z },
        text: `Annotation ${modelData.hotspots.length + 1}`,
        surface: surface
    });
    
    const marker = createMarkerMesh(position);
    currentScene.add(marker);
    annotationMarkers.push(marker);
    renderAnnotationsList();
}

function renderAnnotationsList() {
    const modelData = moleculesGenerees.get(currentMoleculeName);
    const list = document.getElementById('annotations-list');
    list.innerHTML = '';
    
    if (modelData.hotspots.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); font-style: italic; text-align:center;">Aucune annotation.</p>';
        return;
    }

    modelData.hotspots.forEach((hotspot, index) => {
        const item = document.createElement('div');
        item.style.cssText = 'margin-bottom:10px; padding:12px; background:var(--page-bg); border-radius:12px; border:1px solid var(--border);';
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="color: var(--hapi-accent-text); font-size:0.9em;">Annotation #${index+1}</strong>
                <button data-index="${index}" class="btn-del-anno" title="Supprimer">✕</button>
            </div>
            <input type="text" value="${hotspot.text}" data-index="${index}" class="anno-input" placeholder="Texte...">
        `;
        list.appendChild(item);
    });
    list.querySelectorAll('.anno-input').forEach(inp => inp.addEventListener('input', (e) => {
        modelData.hotspots[e.target.dataset.index].text = e.target.value;
    }));
    list.querySelectorAll('.btn-del-anno').forEach(btn => btn.addEventListener('click', (e) => {
        deleteAnnotation(parseInt(e.target.dataset.index));
    }));
}

function deleteAnnotation(index) {
    const modelData = moleculesGenerees.get(currentMoleculeName);
    modelData.hotspots.splice(index, 1);
    if (annotationMarkers[index]) {
        currentScene.remove(annotationMarkers[index]);
        annotationMarkers.splice(index, 1);
    }
    renderAnnotationsList();
}

function saveAnnotations() { closeAnnotationEditor(); }
function closeAnnotationEditor() {
    document.getElementById('annotation-editor-modal').style.display = 'none';
    if(currentRenderer) currentRenderer.dispose();
    currentRenderer = null;
    currentModel = null;
}

function handleAddAnnotationClick() {
    isPlacementMode = !isPlacementMode;
    updateAnnotationModeUI();
}

function updateAnnotationModeUI() {
    const info = document.getElementById('annotation-mode');
    const infoInstr = document.getElementById('annotation-instruction');
    const btn = document.getElementById('add-annotation-btn');
    const canvas = document.getElementById('annotation-canvas');

    if (isPlacementMode) {
        if(info) { info.textContent = "PLACEMENT"; info.style.color = "var(--warning-text)"; }
        if(infoInstr) infoInstr.textContent = "Cliquez sur un atome pour poser l'étiquette.";
        if(btn) { btn.innerHTML = "✕ Annuler le placement"; btn.style.backgroundColor = "#b45309"; }
        if(canvas) canvas.style.cursor = "crosshair"; 
    } else {
        if(info) { info.textContent = "NAVIGATION"; info.style.color = "var(--hapi-green)"; }
        if(infoInstr) infoInstr.textContent = "Tournez le modèle pour choisir un angle de vue.";
        if(btn) { btn.innerHTML = `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Ajouter une annotation`; btn.style.backgroundColor = ""; }
        if(canvas) canvas.style.cursor = "default";
    }
}

async function handlePreviewHPSingle(btn) {
    const name = btn.dataset.name;
    const data = moleculesGenerees.get(name);
    const blob = await genererH5PModele(data); 
    lancerPrevisualisation({activite: {blob, nom: data.title}}, data);
}

async function handleDownloadH5PSingle(button) {
    const name = button.dataset.name;
    const modelData = moleculesGenerees.get(name);
    if (!modelData) return alert("Données introuvables.");
    pendingH5PDownloadName = name;
    document.getElementById('h5p-warning-modal').style.display = 'flex';
}

async function proceedWithH5PDownload() {
    if (!pendingH5PDownloadName) return;
    const name = pendingH5PDownloadName;
    const modelData = moleculesGenerees.get(name);
    closeH5PWarning();
    const btn = document.querySelector(`.btn-download-h5p-single[data-name="${name}"]`);
    const originalText = btn ? btn.innerHTML : '';
    if(btn) btn.innerHTML = "Intégration libs...";

    try {
        let libsBlob = null;
        try {
            const response = await fetch(LIBS_ZIP_PATH);
            if (response.ok) libsBlob = await response.blob();
        } catch (e) {}

        const blob = await genererH5PModele(modelData, libsBlob);
        telechargerFichier(blob, `${nettoyerNomFichier(modelData.title)}.h5p`, 'application/zip');
    } catch (err) { alert(`Erreur : ${err.message}`); } 
    finally { pendingH5PDownloadName = null; if(btn) btn.innerHTML = originalText; }
}

function closeH5PWarning() {
    document.getElementById('h5p-warning-modal').style.display = 'none';
    pendingH5PDownloadName = null;
}

async function handleDownloadZIPSingle(btn) {
    const name = btn.dataset.name;
    const data = moleculesGenerees.get(name);
    const blob = await genererZIPModele(data);
    telechargerFichier(blob, `${nettoyerNomFichier(data.title)}.zip`, 'application/zip');
}

// =========================================================
// 💾 GESTION IMPORT / EXPORT (Totalement Synchrone !)
// =========================================================

export function getUIState() {
    return getH5P3DState(moleculesGenerees);
}

export function setUIState(config) {
    setH5P3DState(config, {
        clearPreview: () => {
            const root = containerElement || document;
            const container = root.querySelector('#molecules-list-container-3d');
            if (container) container.innerHTML = '';
            if (typeof cleanupMoleculeURLs === 'function') cleanupMoleculeURLs();
            if (typeof moleculesGenerees !== 'undefined') moleculesGenerees.clear();
        },
        restoreModel: (pubchemName, data) => {
            if (data.fileBlob) data.url = URL.createObjectURL(data.fileBlob);
            moleculesGenerees.set(pubchemName, data);
        },
        renderList: (molecules) => {
            displayMoleculesList(molecules);
        },
        restoreCardUI: (index, mol) => {
            const card = document.querySelectorAll('#molecules-list-container-3d .molecule-card')[index];
            if (!card) return;

            const titleInput = card.querySelector(`input[id^="mol-title-"]`);
            if (titleInput && mol.titre) titleInput.value = mol.titre;

            const btnGen = card.querySelector('.btn-generate-glb');
            if (btnGen) {
                // 🟢 LE FIX EST ICI : On ajoute juste la classe "success" sans injecter "btn" qui cassait le CSS !
                btnGen.classList.add('success');
                btnGen.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Modèle Prêt';
            }

            const contentRow = card.querySelector(`#molecule-content-${index}`);
            if (!contentRow) return;

            contentRow.style.display = 'flex';
            card.classList.add('generated');

            const nomFichierClean = nettoyerNomFichier(mol.titre || mol.nom_pubchem);
            
            // 🟢 FIX : Restauration de la formule avec MathJax comme à l'origine
            let formulaDisplay = '<span style="font-size:0.6em; color:var(--text-muted);">Non disponible</span>';
            if (mol.formule) {
                const latex = mol.formule.replace(/(\d+)/g, '_{$1}');
                const htmlSub = mol.formule.replace(/(\d+)/g, '<sub>$1</sub>');
                formulaDisplay = `
                    <span class="mathjax-formula" style="display:none;">\\(\\mathit{${latex}}\\)</span>
                    <span class="html-fallback">${htmlSub}</span>
                `;
            }

            const modelData = moleculesGenerees.get(mol.nom_pubchem);
            const blobUrl = modelData ? modelData.url : '';

            contentRow.innerHTML = `
                <div class="formula-box" id="formula-box-${index}">
                    <div class="formula-label">FORMULE CHIMIQUE</div>
                    <div class="formula-content">${formulaDisplay}</div>
                    <button class="btn-download-formula" title="Télécharger l'image" onclick="downloadFormulaImage('formula-box-${index}', '${nomFichierClean}')"><svg class="ico" style="display:block; width:14px; height:14px; color:var(--text);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg></button>
                </div>
                <div class="export-buttons-grid">
                    <div class="export-row-top">
                        <button class="btn-export-action btn-edit" data-name="${mol.nom_pubchem}"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></span> Annotations</button>
                        <button class="btn-export-action btn-preview btn-preview-h5p-single" data-name="${mol.nom_pubchem}"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></span> Prévisualiser H5P</button>
                    </div>
                    <div class="export-row-bottom">
                        <button class="btn-export-action btn-glb btn-download-glb-single" data-name="${mol.nom_pubchem}" data-url="${blobUrl}" data-filename="${nomFichierClean}.glb"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></span> GLB</button>
                        <button class="btn-export-action btn-pdf btn-download-pdf-single" data-name="${mol.nom_pubchem}"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></span> PDF</button>
                        <button class="btn-export-action btn-h5p btn-download-h5p-single" data-name="${mol.nom_pubchem}"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg></span> H5P</button>
                        <button class="btn-export-action btn-zip btn-download-zip-single" data-name="${mol.nom_pubchem}"><span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></span> ZIP</button>
                    </div>
                </div>
            `;
            
            // 🟢 Exécution de MathJax pour formater joliment C6H12O6
            if (window.MathJax && window.MathJax.Hub) {
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, contentRow, function() {
                    const mj = contentRow.querySelector('.mathjax-formula');
                    const fb = contentRow.querySelector('.html-fallback');
                    if(mj && fb) { mj.style.display='inline'; fb.style.display='none'; }
                }]);
            } else if (window.MathJax && window.MathJax.typesetPromise) {
                 window.MathJax.typesetPromise([contentRow]).then(() => {
                    const mj = contentRow.querySelector('.mathjax-formula');
                    const fb = contentRow.querySelector('.html-fallback');
                    if(mj && fb) { mj.style.display='inline'; fb.style.display='none'; }
                 });
            }

            attachDynamicListeners(contentRow);
        },
        updateBtn: () => {
            if (typeof updateButtonCallback === 'function') updateButtonCallback();
        }
    });
}

async function handleDownloadGLBSingle(btn) {
    const name = btn.dataset.name;
    const modelData = moleculesGenerees.get(name);
    const filename = btn.dataset.filename; 

    if (!modelData) return alert("Données introuvables.");

    try {
        const resp = await fetch(modelData.url);
        if (!resp.ok) throw new Error("Le lien n'est plus valide.");
        const blob = await resp.blob();
        telechargerFichier(blob, filename, 'model/gltf-binary');
    } catch (error) {
        alert("Impossible de télécharger le fichier.");
    }
}

function telechargerFichier(blob, name, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
}

function cleanupMoleculeURLs() { moleculesGenerees.forEach(m => URL.revokeObjectURL(m.url)); }

export function gatherData() { 
    if (typeof moleculesGenerees !== 'undefined' && moleculesGenerees.size > 0) {
        return { 
            titre: "Lot_Molecules_3D",
            molecules: Array.from(moleculesGenerees.values()),
            questions: [1], 
            markers: [1]
        };
    }
    return null; 
}

function nettoyerNomFichier(texte) {
    // 🟢 SÉCURITÉ : Si le texte est vide ou undefined, on donne un nom par défaut
    if (!texte) return "molecule"; 
    
    return texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
}