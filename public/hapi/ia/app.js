// Fichier: app.js (COMPLET - Nettoyé - Sans StickyBar - Avec Onglet Finalisation)

import { logger } from './modules/utils/logger.js';
import { libraryManager } from './modules/utils/h5p-library-manager.js';
import { H5P_LIBS_BASE_URL } from './modules/utils/h5p-constants.js';
import { initMathEditor } from './modules/utils/math-editor.js';
import { corpusUI } from './modules/corpus/corpus-ui.js';
import { init as initActivitySelector, updateGenerateButtonState } from './modules/ui/activity-selector.js';
import { 
    genererH5PQuiz, genererH5PDictation, genererH5PWordSearch, genererH5PMarkTheWords, 
    genererH5PDragText, genererH5PAdvancedBlanks, genererH5PCrossword, genererH5PSortParagraphs, 
    genererH5PSummary, genererH5PAccordion, genererH5PCards, genererH5PImagePairing, 
    genererH5PTimeline, genererH5PModele, genererZIPModele, genererZIPMoleculesLot, 
    genererH5PCategorisation, genererZIPInteractiveMap 
} from './modules/generation/h5p-generator.js';
import { exportPDF_MoleculeSingle } from './modules/utils/exports-pdf/pdf-molecule.js';
import { loadTaxonomy, getTaxonomy } from './modules/ia/bo-context.js';
import { handleHelpersClick } from './modules/utils/helpers.js';
import { corpusManager } from './modules/corpus/corpus-manager.js';
import { readFileContent } from './modules/corpus/file-parsers.js';
import { getLanguageOptionsHTML } from './modules/utils/languages.js';
import { exportConfigToJSON, importConfigFromJSON } from './modules/utils/config-manager.js';
import { init as initPreviewManager } from './modules/ui/preview-manager.js';
import { getODTBlob, getPDFBlob, getGIFTBlob, getMoodleXMLBlob } from './modules/utils/export-helpers.js';
import { genererH5PInteractiveVideo } from './modules/generation/activities/h5p-video-generator.js';

import * as qcmUI from './modules/ui/qcm-ui.js';
import * as trueFalseUI from './modules/ui/truefalse-ui.js'; 
import * as quizMathUI from './modules/ui/quiz-math-ui.js'; 
import * as trueFalseMathUI from './modules/ui/truefalse-math-ui.js';
import * as dictationUI from './modules/ui/dictation-ui.js';
import * as wordSearchUI from './modules/ui/wordsearch-ui.js';
import * as markTheWordsUI from './modules/ui/markthewords-ui.js';
import * as dragTextUI from './modules/ui/dragtext-ui.js';
import * as advancedBlanksUI from './modules/ui/advanced-blanks-ui.js';
import * as crosswordUI from './modules/ui/crossword-ui.js';
import * as sortParagraphsUI from './modules/ui/sortparagraphs-ui.js';
import * as summaryUI from './modules/ui/summary-ui.js';
import * as accordionUI from './modules/ui/accordion-ui.js';
import * as cardsUI from './modules/ui/cards-ui.js';
import * as imagePairingUI from './modules/ui/image-pairing-ui.js';
import * as timelineUI from './modules/ui/timeline-ui.js';
import * as interactiveMapUI from './modules/ui/interactive-map-ui.js';
import * as h5p3dUI from './modules/ui/h5p-3d-ui.js';
import * as videoUI from './modules/ui/h5p-video-ui.js';
import * as dragDropUI from './modules/ui/dragndrop-ui.js';

let finalCorpusContent = '';
//let h5pGenerator;

export let globalDocumentsList = []; 

function onCorpusBuilt(masterContent, rawSources = []) {
    if (masterContent === null) return; 
    finalCorpusContent = masterContent;
	
	const corpusDetails = document.getElementById('corpus-details');
	if (corpusDetails) corpusDetails.removeAttribute('open');
	
    globalDocumentsList = [
        { id: 'all', title: 'Tout le corpus (Hybride)', content: masterContent, type: 'all' },
        ...rawSources.map(s => ({ id: s.id, title: s.name, content: s.content || s.text || masterContent, type: s.type }))
    ];

    const workflow = document.getElementById('activity-creation-workflow');
    workflow.classList.add('enabled');
    initActivitySelector(finalCorpusContent);
    logger.log("Corpus construit. Sélecteur d'activités initialisé.");
}

async function processActivityData(activeType) {
    let data;
    let generatorFunction;

    switch (activeType) {
        case 'quiz': data = qcmUI.gatherData(); generatorFunction = genererH5PQuiz; break;
        case 'truefalse': data = trueFalseUI.gatherData(); generatorFunction = genererH5PQuiz; break;
        case 'quiz-math': data = quizMathUI.gatherData(); generatorFunction = genererH5PQuiz; break;
        case 'truefalse-math': data = trueFalseMathUI.gatherData(); generatorFunction = genererH5PQuiz; break;
        case 'dictation': data = dictationUI.gatherData(); generatorFunction = genererH5PDictation; break;
        case 'wordsearch': data = wordSearchUI.gatherData(); generatorFunction = genererH5PWordSearch; break;
        case 'markthewords': data = markTheWordsUI.gatherData(); generatorFunction = genererH5PMarkTheWords; break;
        case 'dragtext': data = dragTextUI.gatherData(); generatorFunction = genererH5PDragText; break;
		case 'advanced-blanks': data = advancedBlanksUI.gatherData(); generatorFunction = genererH5PAdvancedBlanks; break;
        case 'crossword': data = crosswordUI.gatherData(); generatorFunction = genererH5PCrossword; break;
        case 'sortparagraphs': data = sortParagraphsUI.gatherData(); generatorFunction = genererH5PSortParagraphs; break;
        case 'summary': data = summaryUI.gatherData(); generatorFunction = genererH5PSummary; break;
        case 'accordion': data = accordionUI.gatherData(); generatorFunction = genererH5PAccordion; break;
        case 'cards': data = cardsUI.gatherData(); generatorFunction = genererH5PCards; break;
        case 'image-pairing': data = imagePairingUI.gatherData(); generatorFunction = genererH5PImagePairing; break;
        case 'timeline': data = await timelineUI.gatherData(); generatorFunction = genererH5PTimeline; break;
        case 'interactive-map': data = interactiveMapUI.gatherData(); generatorFunction = genererZIPInteractiveMap; break;
		case 'molecules-3d':
		case 'h5p-3d': data = h5p3dUI.gatherData(); generatorFunction = genererZIPMoleculesLot; break;
    	case 'interactive-video': data = videoUI.gatherData(); generatorFunction = (d) => genererH5PInteractiveVideo(d, libraryManager.libraryVersions); break;
		case 'dragndrop': data = dragDropUI.gatherData(); generatorFunction = genererH5PCategorisation; break;
        default: return null;
    }
    return { data, generatorFunction };
}

async function getSafeExportableSources() {
    const rawSources = corpusManager.getCorpusSources();
    const safeSources = [];
    
    for (const source of rawSources) {
        let textContent = '';
        try {
            if (source.type === 'text') {
                textContent = source.data || '';
            } else if (source.type === 'file') {
                if (typeof source.data === 'string') {
                    textContent = source.data;
                } else {
                    textContent = await readFileContent(source.data);
                }
            }
        } catch (e) {
            console.error("Erreur de lecture de la source", source.name, e);
        }
        
        safeSources.push({
            id: source.id,
            name: source.name,
            type: source.type,
            data: textContent,
            priority: source.priority !== undefined ? source.priority : 2
        });
    }
    return safeSources;
}

async function getMegaConfig() {
    logger.log("📊 Préparation du Méga-JSON de session...");
    const megaConfig = { 
        appVersion: "1.0", 
        isMultiExport: true, 
		globalSettings: { 
		            ragEnabled: document.getElementById('toggle-rag-boen')?.checked ?? true, // 🟢 NOUVEAU
		            scolarite: document.getElementById('global-scolarite')?.value || '',
		            cycleVoie: document.getElementById('global-cycle-voie')?.value || '',
		            niveau: document.getElementById('global-niveau')?.value || '',
		            discipline: document.getElementById('global-discipline')?.value || '',
		            langue: document.getElementById('global-language')?.value || 'Français',
		        },
        corpus: { 
            masterContent: finalCorpusContent,
            rawSources: await getSafeExportableSources()
        }, 
        activities: [] 
    };

    const activeCheckboxes = document.querySelectorAll('.activity-checkbox:checked');
    
	for (const checkbox of activeCheckboxes) {
	        const type = checkbox.value;
	        let state = null;
	        try {
	            // ✅ Ajout des "await" critiques pour les modules avec médias
	            if (type === 'quiz') state = qcmUI.getUIState();
	            else if (type === 'truefalse') state = trueFalseUI.getUIState();
	            else if (type === 'quiz-math') state = quizMathUI.getUIState();
	            else if (type === 'truefalse-math') state = trueFalseMathUI.getUIState();
	            else if (type === 'dictation') state = await dictationUI.getUIState(); // Déjà OK
	            else if (type === 'wordsearch') state = wordSearchUI.getUIState();
	            else if (type === 'markthewords') state = markTheWordsUI.getUIState();
	            else if (type === 'dragtext') state = dragTextUI.getUIState();
				else if (type === 'advanced-blanks') state = advancedBlanksUI.getUIState();
	            else if (type === 'crossword') state = crosswordUI.getUIState();
	            else if (type === 'sortparagraphs') state = sortParagraphsUI.getUIState();
	            else if (type === 'summary') state = summaryUI.getUIState();
	            else if (type === 'accordion') state = accordionUI.getUIState();
	            else if (type === 'cards') state = await cardsUI.getUIState(); // 🔴 AJOUT AWAIT
	            else if (type === 'image-pairing') state = await imagePairingUI.getUIState(); // 🔴 AJOUT AWAIT
	            else if (type === 'timeline') state = await timelineUI.getUIState(); // Déjà OK
	            else if (type === 'interactive-map') state = interactiveMapUI.getUIState();
	            else if (type === 'molecules-3d') state = h5p3dUI.getUIState();
				else if (type === 'interactive-video') state = videoUI.getUIState();
				else if (type === 'dragndrop') state = dragDropUI.getUIState();
	            if (state) {
	                megaConfig.activities.push({ activityType: type, uiState: state });
	            }
	        } catch (err) {
	            logger.warn(`⚠️ Impossible de récupérer l'état pour ${type}: ${err.message}`);
	        }
	    }
		
    return megaConfig;
}

// 📦 Génération Globale (Pour le Dashboard de Finalisation)
async function handleGenerateAll() {
    const btnAll = document.getElementById('btn-dash-zip-all'); // Cible le nouveau bouton
    if (!btnAll) return;
    
    const originalText = btnAll.innerHTML;
    btnAll.disabled = true;
    btnAll.innerHTML = '⏳ Création du ZIP...';

    try {
        const masterZip = new window.JSZip();
        let addedFilesCount = 0;
        
        const megaConfig = await getMegaConfig();
        const megaJsonString = JSON.stringify(megaConfig, null, 4);
        masterZip.file("configuration_globale_session.json", megaJsonString);
        logger.log("💎 Fichier configuration_globale_session.json ajouté au ZIP.");

        const activeCheckboxes = document.querySelectorAll('.activity-checkbox:checked');
        
        for (const checkbox of activeCheckboxes) {
            const activeType = checkbox.value;
            // On ignore l'onglet de finalisation s'il est coché
            if (activeType === 'finalisation') continue;

            const processResult = await processActivityData(activeType);

            if (processResult && processResult.data) {
                try {
                    const cleanType = activeType.charAt(0).toUpperCase() + activeType.slice(1);
                    const realTitle = processResult.data.titre || processResult.data.metadata?.title || "";
                    
                    let folderName = cleanType;
                    if (realTitle) {
                        const safeTitle = realTitle
                            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
                            .replace(/[^a-zA-Z0-9\s_]/g, "") 
                            .trim()
                            .replace(/[\s-]+/g, '_'); 
                        folderName = `${cleanType}_${safeTitle}`;
                    }

                    const activityFolder = masterZip.folder(folderName);

                    if (processResult.generatorFunction) {
                        const { blob: h5pBlob, fileName: h5pFileName } = await processResult.generatorFunction(processResult.data);
                        activityFolder.file(h5pFileName, h5pBlob);
                    } else if (activeType === 'molecules-3d') {
                        const molecules = processResult.data.molecules || [];
                        let libsBlob = null;
                        try {
                            const resp = await fetch(`${H5P_LIBS_BASE_URL}/h5p-deps-3D.zip`);
                            if (resp.ok) libsBlob = await resp.blob();
                        } catch(e) { logger.warn("Libs 3D non trouvées pour le ZIP global."); }

                        for (const molData of molecules) {
                            const safeMolTitle = (molData.title || molData.originalName).replace(/[^a-zA-Z0-9\s_]/g, "").trim().replace(/[\s-]+/g, '_');
                            const molFolder = activityFolder.folder(safeMolTitle); 

                            try {
                                const resp = await fetch(molData.url);
                                const glbBlob = await resp.blob();
                                molFolder.file(`${safeMolTitle}.glb`, glbBlob);
                            } catch(e) {}

                            try {
                                const h5pBlob = await genererH5PModele(molData, libsBlob);
                                molFolder.file(`${safeMolTitle}.h5p`, h5pBlob);
                            } catch(e) {}

                            try {
                                const zipBlob = await genererZIPModele(molData);
                                molFolder.file(`${safeMolTitle}.zip`, zipBlob);
                            } catch(e) {}

                            try {
                                if (typeof exportPDF_MoleculeSingle === 'function') {
                                    const pdfResult = await exportPDF_MoleculeSingle(molData, true);
                                    if (pdfResult && pdfResult.blob) molFolder.file(`${safeMolTitle}.pdf`, pdfResult.blob);
                                }
                            } catch(e) {}

                            const actData = megaConfig.activities.find(a => a.activityType === 'molecules-3d');
                            const molConfig = { 
                                appVersion: "1.0", 
                                activityType: "molecules-3d",
                                molecule_name: molData.originalName,
                                uiState: actData ? actData.uiState : null
                            };
                            molFolder.file(`sauvegarde_${safeMolTitle}.json`, JSON.stringify(molConfig, null, 2));
                        }
                    }
                    
					const actData = megaConfig.activities.find(a => a.activityType === activeType);
					                    if (actData) {
					                        const localConfig = { 
					                            appVersion: "1.0", 
					                            activityType: activeType, 
					                            globalSettings: megaConfig.globalSettings, // 🟢 NOUVEAU CRUCIAL
					                            corpus: { masterContent: finalCorpusContent }, 
					                            uiState: actData.uiState 
					                        };
					                        activityFolder.file(`source_editable_${activeType}.json`, JSON.stringify(localConfig, null, 2));
					                    }

                    const odt = await getODTBlob(activeType); 
                    if (odt && odt.blob) activityFolder.file(odt.fileName, odt.blob);
                    
                    const pdf = await getPDFBlob(activeType); 
                    if (pdf && pdf.blob) activityFolder.file(pdf.fileName, pdf.blob);

                    const gift = await getGIFTBlob(activeType);
                    if (gift && gift.blob) activityFolder.file(gift.fileName, gift.blob);

                    const xml = await getMoodleXMLBlob(activeType);
                    if (xml && xml.blob) activityFolder.file(xml.fileName, xml.blob);

                    addedFilesCount++;
                } catch (e) {
                    logger.error(`❌ Erreur dossier ${activeType}: ${e.message}`);
                }
            }
        }

        if (addedFilesCount > 0) {
            const masterBlob = await masterZip.generateAsync({ type: "blob", compression: "DEFLATE" });
            
            const now = new Date();
            const dateFr = `${now.getDate().toString().padStart(2,'0')}-${(now.getMonth()+1).toString().padStart(2,'0')}`;
            const masterFileName = `HAPI-Lot-Complet-${dateFr}.zip`;

            const url = URL.createObjectURL(masterBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = masterFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            logger.log("🚀 ZIP envoyé au navigateur !");
        } else {
            alert("Aucune activité n'était prête pour l'export.");
        }

    } catch (err) {
        logger.error("🔥 Erreur critique lors de la création du ZIP : " + err.message);
        alert("Une erreur est survenue. Vérifiez la console (F12).");
    } finally {
        btnAll.disabled = false;
        btnAll.innerHTML = originalText;
    }
}

function showToast(message, type = 'success') {
    let toast = document.getElementById('hapi-toast');
    
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'hapi-toast';
        
        // Ajout dynamique du CSS pour le toast si absent
        const toastStyle = document.createElement('style');
        toastStyle.innerHTML = `
            #hapi-toast {
                position: fixed; top: 20px; right: 20px; z-index: 10000;
                padding: 15px 25px; border-radius: 8px; font-family: 'Roboto', sans-serif;
                font-size: 1.05rem; font-weight: bold; color: white; 
                opacity: 0; transform: translateX(120%);
                transition: all 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55);
                box-shadow: 0 4px 15px rgba(0,0,0,0.2); pointer-events: none;
            }
            #hapi-toast.show { opacity: 1; transform: translateX(0); }
            #hapi-toast.success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
            #hapi-toast.error { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
        `;
        document.head.appendChild(toastStyle);
        document.body.appendChild(toast);
    }
    
    toast.className = `show ${type}`;
    
    let icon = '✅';
    if (type === 'error') icon = '❌';
    else if (message.includes('Sauvegard')) icon = '💾';
    else if (message.includes('restauré')) icon = '📂';

    toast.innerHTML = `${icon} ${message}`;
    
    if (toast.hideTimeout) clearTimeout(toast.hideTimeout);
    toast.hideTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

async function hydrateActivity(type, state) {
    try {
        switch (type) {
            case 'quiz': qcmUI.setUIState(state); break;
            case 'truefalse': trueFalseUI.setUIState(state); break;
            case 'quiz-math': quizMathUI.setUIState(state); break;
            case 'truefalse-math': trueFalseMathUI.setUIState(state); break;
            case 'dictation': await dictationUI.setUIState(state); break;
            case 'wordsearch': wordSearchUI.setUIState(state); break;
            case 'markthewords': markTheWordsUI.setUIState(state); break;
            case 'dragtext': dragTextUI.setUIState(state); break;
			case 'advanced-blanks': advancedBlanksUI.setUIState(state); break;
            case 'crossword': crosswordUI.setUIState(state); break;
            case 'sortparagraphs': sortParagraphsUI.setUIState(state); break;
            case 'summary': summaryUI.setUIState(state); break;
            case 'accordion': accordionUI.setUIState(state); break;
            case 'cards': cardsUI.setUIState(state); break;
            case 'image-pairing': imagePairingUI.setUIState(state); break;
            case 'timeline': timelineUI.setUIState(state); break;
            case 'interactive-map': interactiveMapUI.setUIState(state); break;
			case 'dragndrop': dragDropUI.setUIState(state); break;
			case 'molecules-3d':
			case 'h5p-3d': h5p3dUI.setUIState(state); break;
			case 'video':
			case 'interactive-video':
		    if (videoUI.setUIState) videoUI.setUIState(state); break;
            default: logger.warn(`Hydratation non supportée pour : ${type}`);
        }
        return true;
    } catch (e) {
        logger.error(`Erreur d'hydratation pour ${type}: ${e.message}`);
        return false;
    }
}

// ─── Cascade dynamique des sélecteurs BO ─────────────────────────────────────
// Câble les 4 dropdowns (scolarite → cycle/voie → niveau → discipline) avec
// la taxonomie chargée depuis /api/bo-taxonomy. Cascade non-bloquante : si la
// taxonomie n'est pas dispo, on laisse les sélecteurs vides (HAPI fonctionne quand même).
async function initBoCascade() {
    const scoSelect = document.getElementById('global-scolarite');
    const cycVoieSelect = document.getElementById('global-cycle-voie');
    const nivSelect = document.getElementById('global-niveau');
    const discSelect = document.getElementById('global-discipline');
    const nivWrapper = document.getElementById('global-niveau-wrapper');
    const discWrapper = document.getElementById('global-discipline-wrapper');
    const indicator = document.getElementById('bo-rag-indicator');
    const indicatorStatus = document.getElementById('bo-rag-status');

    if (!scoSelect || !cycVoieSelect || !nivSelect || !discSelect) {
        logger.warn('⚠ Sélecteurs de cascade BO non trouvés dans le DOM');
        return;
    }

    // Attendre que la taxonomie soit chargée (déjà déclenchée à l'import)
    const taxonomy = await loadTaxonomy();
    if (!taxonomy) {
        // Pas de cascade sans taxonomie, mais on branche quand même la persistance
        // plus bas (au minimum la checkbox RAG est mémorisée).
        logger.warn('⚠ Taxonomie indisponible, cascade désactivée');
    }

    if (taxonomy) {
    const resetSelect = (select, placeholder) => {
        select.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = placeholder;
        select.appendChild(opt);
        select.disabled = true;
    };

    const populateSelect = (select, items, valueKey, labelKey, placeholder) => {
        select.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = placeholder;
        select.appendChild(opt);
        items.forEach(item => {
            const o = document.createElement('option');
            o.value = item[valueKey];
            o.textContent = item[labelKey];
            select.appendChild(o);
        });
        select.disabled = false;
    };

    const updateIndicator = () => {
        const niveau = nivSelect.value;
        const disc = discSelect.value;
        if (niveau && indicator && indicatorStatus) {
            indicator.style.display = 'block';
            const niveauLabel = nivSelect.options[nivSelect.selectedIndex]?.text || niveau;
            const discLabel = disc ? (discSelect.options[discSelect.selectedIndex]?.text || disc) : '(auto-détection)';
            indicatorStatus.innerHTML = `✓ Programmes officiels disponibles : <strong>${niveauLabel}</strong> ${disc ? '— ' + discLabel : '— ' + discLabel}`;
        } else if (indicator) {
            indicator.style.display = 'none';
        }
    };

    // ─── Cascade : scolarité → cycle/voie ─────────────────────────────────
    scoSelect.addEventListener('change', () => {
        const scoCode = scoSelect.value;
        resetSelect(cycVoieSelect, '— Choisir cycle/voie —');
        resetSelect(nivSelect, '— Choisir cycle/voie d\'abord —');
        nivWrapper.style.display = 'none';
        discWrapper.style.display = 'none';
        if (indicator) indicator.style.display = 'none';

        if (!scoCode) return;
        const sco = taxonomy.scolarites[scoCode];
        if (!sco || !sco.cycles_voies) return;
        populateSelect(cycVoieSelect, sco.cycles_voies, 'code', 'label', '— Choisir cycle/voie —');
    });

    // ─── Cascade : cycle/voie → niveau ────────────────────────────────────
    cycVoieSelect.addEventListener('change', () => {
        const scoCode = scoSelect.value;
        const cvCode = cycVoieSelect.value;
        resetSelect(nivSelect, '— Choisir niveau —');
        discWrapper.style.display = 'none';
        if (indicator) indicator.style.display = 'none';

        if (!cvCode) {
            nivWrapper.style.display = 'none';
            return;
        }
        const sco = taxonomy.scolarites[scoCode];
        const cv = sco?.cycles_voies?.find(c => c.code === cvCode);
        if (!cv || !cv.niveaux) return;
        populateSelect(nivSelect, cv.niveaux, 'code', 'label', '— Choisir niveau —');
        nivWrapper.style.display = 'block';
    });

    // ─── Cascade : niveau → discipline ────────────────────────────────────
    nivSelect.addEventListener('change', () => {
        const nivCode = nivSelect.value;
        resetSelect(discSelect, '🤖 Auto-détection (Albert analyse le corpus)');

        if (!nivCode) {
            discWrapper.style.display = 'none';
            if (indicator) indicator.style.display = 'none';
            return;
        }
        const disciplines = taxonomy.disciplines_par_niveau?.[nivCode] || [];
        // Première option = auto-détection (valeur vide)
        discSelect.innerHTML = '<option value="">🤖 Auto-détection (Albert analyse le corpus)</option>';
        disciplines.forEach(d => {
            const o = document.createElement('option');
            o.value = d.code;
            o.textContent = `${d.label} (${d.n_chunks})`;
            discSelect.appendChild(o);
        });
        discSelect.disabled = false;
        discWrapper.style.display = 'block';
        updateIndicator();
    });

    // ─── Update indicator on discipline change ────────────────────────────
    discSelect.addEventListener('change', updateIndicator);

    logger.log('✓ Cascade BO câblée (scolarité → cycle/voie → niveau → discipline)');
    } // fin if (taxonomy)

    // ─── Persistance fonctionnelle (localStorage) des réglages RAG ────────────
    // Mémorise la checkbox RAG BOEN + les 4 menus en cascade dans le navigateur
    // (préférence 100% client, jamais envoyée au serveur, RGPD-friendly).
    const RAG_PREFS_KEY = 'hapi_rag_prefs';
    const ragToggleEl = document.getElementById('toggle-rag-boen');
    let isRestoringRag = false;

    const saveRagPrefs = () => {
        if (isRestoringRag) return;
        try {
            localStorage.setItem(RAG_PREFS_KEY, JSON.stringify({
                ragEnabled: !!(ragToggleEl && ragToggleEl.checked),
                scolarite: scoSelect.value || '',
                cycleVoie: cycVoieSelect.value || '',
                niveau: nivSelect.value || '',
                discipline: discSelect.value || '',
            }));
        } catch (e) { /* localStorage indispo (mode privé…) : on ignore */ }
    };

    const restoreRagPrefs = () => {
        let prefs = null;
        try { prefs = JSON.parse(localStorage.getItem(RAG_PREFS_KEY) || 'null'); } catch (e) { prefs = null; }
        if (!prefs || !prefs.ragEnabled) return;
        isRestoringRag = true;
        try {
            // 1) Activer la checkbox (ses écouteurs affichent + dégrisent le bloc)
            if (ragToggleEl && !ragToggleEl.checked) {
                ragToggleEl.checked = true;
                ragToggleEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            // 2) Rejouer la cascade dans l'ordre — chaque "change" peuple le niveau
            //    suivant de façon synchrone (la taxonomie est déjà chargée ici).
            const setAndFire = (select, value) => {
                if (!value) return false;
                select.value = value;
                if (select.value !== value) return false; // option absente (taxonomie modifiée)
                select.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            };
            if (setAndFire(scoSelect, prefs.scolarite)
                && setAndFire(cycVoieSelect, prefs.cycleVoie)
                && setAndFire(nivSelect, prefs.niveau)) {
                setAndFire(discSelect, prefs.discipline); // peut être vide (auto-détection)
            }
        } finally {
            isRestoringRag = false;
            saveRagPrefs(); // consigne l'état final effectivement restauré
        }
    };

    [ragToggleEl, scoSelect, cycVoieSelect, nivSelect, discSelect].forEach(el => {
        if (el) el.addEventListener('change', saveRagPrefs);
    });
    restoreRagPrefs();
}

document.addEventListener('DOMContentLoaded', async () => {
    logger.init();
    logger.log('🚀 Application H5P initialisée.');

    const globalLangSelect = document.getElementById('global-language');
    if (globalLangSelect) {
        globalLangSelect.innerHTML = getLanguageOptionsHTML('Français');
    }

    // ─── Persistance fonctionnelle (localStorage) des préférences globales ───
    // Même esprit que hapi_rag_prefs : langue de génération + niveau hors-RAG.
    // Préférence 100% client, jamais envoyée au serveur, RGPD-friendly.
    const GLOBAL_PREFS_KEY = 'hapi_global_prefs';
    const standaloneNiveauEl = document.getElementById('standalone-niveau');
    const saveGlobalPrefs = () => {
        try {
            localStorage.setItem(GLOBAL_PREFS_KEY, JSON.stringify({
                langue: globalLangSelect ? globalLangSelect.value : '',
                niveau: standaloneNiveauEl ? standaloneNiveauEl.value : '',
            }));
        } catch (e) { /* localStorage indispo (mode privé…) : on ignore */ }
    };
    try {
        const prefs = JSON.parse(localStorage.getItem(GLOBAL_PREFS_KEY) || 'null');
        if (prefs) {
            const setAndFire = (select, value) => {
                if (!select || !value) return;
                select.value = value;
                // option absente (liste modifiée) → on n'insiste pas
                if (select.value === value) select.dispatchEvent(new Event('change', { bubbles: true }));
            };
            setAndFire(globalLangSelect, prefs.langue);
            setAndFire(standaloneNiveauEl, prefs.niveau);
        }
    } catch (e) { /* JSON corrompu : on ignore */ }
    [globalLangSelect, standaloneNiveauEl].forEach(el => {
        if (el) el.addEventListener('change', saveGlobalPrefs);
    });

    window.H5P = window.H5P || {};
    window.H5P.jQuery = window.$ || window.jQuery;
    window.H5P.$ = window.$ || window.jQuery;
   
    window.H5PIntegration = {
        baseUrl: window.location.origin,
        url: H5P_LIBS_BASE_URL,
        urlLibraries: H5P_LIBS_BASE_URL,
        postUserStatistics: false,
        ajax: { setFinished: '', contentUserData: '' },
        saveFreq: false,
        siteUrl: window.location.origin,
        l10n: { H5P: { fullscreen: 'Plein écran', disableFullscreen: 'Quitter', download: 'Télécharger', close: 'Fermer' } },
        hubIsEnabled: false, reportingIsEnabled: false, contents: {}
    };
    
    await libraryManager.ready();
    //h5pGenerator = new H5PGenerator();
    initMathEditor();
    corpusUI.init(onCorpusBuilt);
    
    // Câble la cascade dynamique scolarité → cycle/voie → niveau → discipline
    // (non-bloquant : si le RAG est indispo, les sélecteurs restent vides
    //  mais HAPI continue de fonctionner normalement)
    initBoCascade().catch(e => logger.warn(`Cascade BO non initialisée : ${e.message}`));
    
    initPreviewManager();
    
	
// ==========================================
    // 🎛️ GESTION DE L'ACTIVATION DU RAG BOEN
    // ==========================================
    const ragToggle = document.getElementById('toggle-rag-boen');
    const boenContainer = document.getElementById('boen-selectors-container');

    if (ragToggle && boenContainer) {
        ragToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                // L'utilisateur active le RAG -> On dégrise la zone
                boenContainer.style.opacity = '1';
                boenContainer.style.pointerEvents = 'auto';
            } else {
                // L'utilisateur désactive le RAG -> On grise et on verrouille
                boenContainer.style.opacity = '0.4';
                boenContainer.style.pointerEvents = 'none';

                // On réinitialise les sélecteurs pour éviter d'envoyer des valeurs fantômes
                const scoSelect = document.getElementById('global-scolarite');
                if (scoSelect) scoSelect.value = '';
                
                const cycVoieSelect = document.getElementById('global-cycle-voie');
                if (cycVoieSelect) cycVoieSelect.innerHTML = '<option value="">— Désactivé —</option>';
                
                const nivSelect = document.getElementById('global-niveau');
                if (nivSelect) nivSelect.innerHTML = '<option value="">— Désactivé —</option>';
                
                const discSelect = document.getElementById('global-discipline');
                if (discSelect) discSelect.innerHTML = '<option value="">🤖 Auto-détection (désactivée)</option>';

                // On cache l'indicateur vert du RAG s'il était visible
                const boIndicator = document.getElementById('bo-rag-indicator');
                if (boIndicator) boIndicator.style.display = 'none';
            }
        });
    }
	
    // ==========================================
    // 👁️ NOUVELLE LOGIQUE DE PRÉVISUALISATION DIRECTE
    // ==========================================
    const btnGlobalPreview = document.getElementById('btn-global-preview');
    if (btnGlobalPreview) {
        btnGlobalPreview.addEventListener('click', async () => {
            const btn = document.getElementById('btn-global-preview');
            const originalText = btn.innerHTML;
            btn.innerHTML = '⏳ Création de l\'aperçu...';
            btn.disabled = true;

            const activeType = document.querySelector('input[name="activity-type"]:checked')?.value 
                            || document.querySelector('.activity-option-label.selected')?.dataset.type;

            if (!activeType || activeType === 'finalisation') {
                alert("Sélectionnez une activité valide à prévisualiser.");
                btn.innerHTML = originalText; btn.disabled = false;
                return;
            }

            const processResult = await processActivityData(activeType);
            if (processResult && processResult.generatorFunction) {
                try {
                    const { blob } = await processResult.generatorFunction(processResult.data);
                    const realTitle = processResult.data.titre || processResult.data.metadata?.title || 'Aperçu H5P';
                    
                    const { show: showPreview } = await import('./modules/ui/preview-manager.js');
                    showPreview(blob, realTitle, activeType);
                } catch (error) {
                    logger.error(`Erreur de prévisualisation: ${error.message}`);
                    alert("Erreur lors de la génération de l'aperçu.");
                }
            }
            btn.innerHTML = originalText; btn.disabled = false;
        });
    }

// ==========================================
    // 📦 CRÉATION ET BASCULE SUR L'ONGLET FINALISATION
    // ==========================================
	const btnGoFinalisation = document.getElementById('btn-go-finalisation');
	    if (btnGoFinalisation) {
	        btnGoFinalisation.addEventListener('click', async () => {
            
			// 🟢 NOUVEAU : Écouteur pour le bouton Précédent
			    const btnGoPrevious = document.getElementById('btn-go-previous');
			    if (btnGoPrevious) {
			        btnGoPrevious.addEventListener('click', () => {
			            const tabs = Array.from(document.querySelectorAll('.tab-btn:not([data-tab-target="finalisation"])'));
			            const currentIndex = tabs.findIndex(t => t.classList.contains('active'));
            
			            if (currentIndex > 0) {
			                tabs[currentIndex - 1].click(); // Simule le clic sur l'onglet précédent
                
			                // Remonte doucement la vue sur le début de la nouvelle zone
			                setTimeout(() => {
			                    const workspace = document.getElementById('multi-activity-workspace');
			                    if (workspace) workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
			                }, 100);
			            }
			        });
			    }
			
	            // ✅ NOUVEAU : Si le bouton sert de bouton "Suivant", on bascule simplement d'onglet
	            if (btnGoFinalisation.dataset.action === 'next') {
	                const tabs = Array.from(document.querySelectorAll('.tab-btn:not([data-tab-target="finalisation"])'));
	                const currentIndex = tabs.findIndex(t => t.classList.contains('active'));
	                if (currentIndex >= 0 && currentIndex < tabs.length - 1) {
	                    tabs[currentIndex + 1].click(); // Simule le clic sur l'onglet suivant
                    
	                    // On remonte doucement l'écran sur le nouvel onglet
	                    setTimeout(() => {
	                        const workspace = document.getElementById('multi-activity-workspace');
	                        if (workspace) workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
	                    }, 100);
	                }
	                return; // On arrête l'exécution ici, on ne crée pas le tableau de bord !
	            }

	            // 📦 SINON : COMPORTEMENT NORMAL DE FINALISATION (Création de l'onglet, du tableau de bord, etc.)
	            let finalTabBtn = document.querySelector('.tab-btn[data-tab-target="finalisation"]');
	            const tabsHeader = document.getElementById('tabs-header');
	            const tabsContent = document.getElementById('tabs-content');

	            if (!tabsHeader || !tabsContent) return;

	            if (!finalTabBtn) {
	                finalTabBtn = document.createElement('button');
	                finalTabBtn.className = 'tab-btn';
	                finalTabBtn.dataset.tabTarget = 'finalisation';
	                finalTabBtn.style.cssText = 'margin-left: 0; background: #1e293b; color: white; border-color: #0f172a;';
	                finalTabBtn.innerHTML = `📦 Finalisation`;
	                tabsHeader.appendChild(finalTabBtn);

	                const finalPane = document.createElement('div');
	                finalPane.className = 'tab-pane';
	                finalPane.id = 'pane-finalisation';
	                finalPane.dataset.type = 'finalisation';
	                tabsContent.appendChild(finalPane);

	                finalTabBtn.addEventListener('click', async () => {
	                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
	                    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                    
	                    finalTabBtn.classList.add('active');
	                    finalPane.classList.add('active');
                    
	                    const generateSection = document.getElementById('generate-section');
	                    if (generateSection) generateSection.style.display = 'none';
                    
	                    const activeCheckboxes = Array.from(document.querySelectorAll('.activity-checkbox:checked'))
	                                                  .map(cb => cb.value);

	                    const { renderFinalisationDashboard } = await import(`./modules/ui/download-ui.js?t=${Date.now()}`);
                    
	                    const appContext = {
	                        processActivityData,
	                        //h5pGenerator,
	                        getMegaConfig,
	                        handleGenerateAll,
	                        exportConfigToJSON
	                    };
                    
	                    renderFinalisationDashboard(finalPane, activeCheckboxes, appContext);
	                });
	            }
            
	            finalTabBtn.click();

	            // Le défilement vers l'étape 4 (Finalisation) est désormais géré par scrollToStepTarget()
		            // du workflow-stepper (atterrissage sur le titre, sous le bandeau d'étapes).
	        });
	    }


    const workflowContainer = document.getElementById('activity-creation-workflow');
    if (workflowContainer) {
        workflowContainer.addEventListener('click', handleHelpersClick);
    }

    // ==========================================
    // 📂 LOGIQUE D'IMPORTATION JSON
    // ==========================================
    const inputImport = document.getElementById('input-import-config');
    if (inputImport) {
        inputImport.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            importConfigFromJSON(file).then(async (fullData) => {
                if (!fullData) return;
                
				if (fullData.globalSettings) {
				                    const ragToggle = document.getElementById('toggle-rag-boen');
				                    const scoInput = document.getElementById('global-scolarite');
				                    const cycVoieInput = document.getElementById('global-cycle-voie');
				                    const nivInput = document.getElementById('global-niveau');
				                    const discInput = document.getElementById('global-discipline');
				                    const langInput = document.getElementById('global-language');

				                    // 1. Restaurer l'état du RAG en priorité
				                    if (ragToggle && fullData.globalSettings.ragEnabled !== undefined) {
				                        ragToggle.checked = fullData.globalSettings.ragEnabled;
				                        ragToggle.dispatchEvent(new Event('change'));
				                    }

				                    // 2. Ne restaurer la cascade BOEN que si le RAG est activé
				                    if (ragToggle?.checked) {
				                        if (scoInput && fullData.globalSettings.scolarite) {
				                            scoInput.value = fullData.globalSettings.scolarite;
				                            scoInput.dispatchEvent(new Event('change'));
				                        }
				                        await new Promise(r => setTimeout(r, 50));
                        
				                        if (cycVoieInput && fullData.globalSettings.cycleVoie) {
				                            cycVoieInput.value = fullData.globalSettings.cycleVoie;
				                            cycVoieInput.dispatchEvent(new Event('change'));
				                        }
				                        await new Promise(r => setTimeout(r, 50));
                        
				                        if (nivInput && fullData.globalSettings.niveau) {
				                            nivInput.value = fullData.globalSettings.niveau;
				                            nivInput.dispatchEvent(new Event('change'));
				                        }
				                        await new Promise(r => setTimeout(r, 50));
                        
				                        if (discInput && fullData.globalSettings.discipline !== undefined) {
				                            discInput.value = fullData.globalSettings.discipline;
				                            // Update visuel de l'indicateur vert si la discipline est chargée manuellement
				                            discInput.dispatchEvent(new Event('change'));
				                        }
				                    }

				                    // 3. Restaurer la langue (hors RAG)
				                    if (langInput) langInput.value = fullData.globalSettings.langue || "Français";
				                }

                if (fullData.corpus && fullData.corpus.masterContent) {
                    finalCorpusContent = fullData.corpus.masterContent;
                    
                    const importedSources = fullData.corpus.rawSources || [];
                    
                    corpusManager.getCorpusSources = function() { return importedSources; };

                    globalDocumentsList = [
                        { id: 'all', title: 'Tout le corpus (Hybride)', content: finalCorpusContent, type: 'all', priority: 2 },
                        ...importedSources.map(s => ({ 
                            id: s.id, 
                            title: s.name, 
                            content: s.data, 
                            type: s.type || 'text',
                            priority: s.priority !== undefined ? s.priority : 2
                        }))
                    ];

                    const mainCorpusTextarea = document.getElementById('corpus-input'); 
                    if (mainCorpusTextarea) mainCorpusTextarea.value = finalCorpusContent;

                    document.getElementById('activity-creation-workflow').classList.add('enabled');
                    
                    document.querySelectorAll('.activity-checkbox:checked').forEach(cb => {
                        cb.checked = false;
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                    });

                    initActivitySelector(finalCorpusContent);
                }

                if (fullData.isMultiExport && Array.isArray(fullData.activities)) {
                    logger.log(`📦 Importation d'un lot de ${fullData.activities.length} activités...`);
                    for (const act of fullData.activities) {
                        const checkbox = document.querySelector(`.activity-checkbox[value="${act.activityType}"]`);
                        if (checkbox) {
                            checkbox.checked = true;
                            checkbox.dispatchEvent(new Event('change'));
                            await new Promise(resolve => setTimeout(resolve, 300));
                            await hydrateActivity(act.activityType, act.uiState);
                        }
                    }
                
                    showToast(`Lot de ${fullData.activities.length} activité(s) restauré !`);
                
                    setTimeout(() => { 
                        const target = document.getElementById('generator-content');
                        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); 
                    }, 200);
                } 
                else {
                    const type = fullData.activityType;
                    const checkbox = document.querySelector(`.activity-checkbox[value="${type}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                        checkbox.dispatchEvent(new Event('change'));
                        await new Promise(resolve => setTimeout(resolve, 500));
                        const success = await hydrateActivity(type, fullData.uiState);
                        if (success) {
                            showToast(`Activité restaurée avec succès !`);
                        
                            setTimeout(() => { document.getElementById('generator-content').scrollIntoView({ behavior: 'smooth' }); }, 200);
                        } else {
                            showToast("Erreur de restauration de l'interface.", "error");
                        }
                    }
                }

                // Après restauration d'une sauvegarde, aller directement à l'étape 3 « Configuration »
                // (laisse le temps aux onglets/panneaux d'activité de se rendre avant de naviguer).
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('hapiGoToStep', { detail: { id: 3 } }));
                }, 400);

                inputImport.value = '';
            }).catch(err => {
                logger.error("Erreur d'importation: " + err.message);
                showToast("Fichier corrompu ou invalide.", "error");
            });
        });
    }

// ==========================================
    // 📈 SUIVI MATOMO — HAPI & Albert API
    // ==========================================
    document.body.addEventListener('click', (event) => {
        if (!window._paq) return;

        // Détermination du type d'activité actif (onglet courant ou label sélectionné)
        const activeInput = document.querySelector('input[name="activity-type"]:checked')?.value;
        const activeLabel = document.querySelector('.activity-option-label.selected')?.dataset.type;
        const activeType = activeInput || activeLabel || 'inconnu';

        // 1️⃣ SÉLECTION D'UNE ACTIVITÉ
        const activityLabel = event.target.closest('.activity-option-label');
        if (activityLabel) {
            window._paq.push(['trackEvent', 'HAPI - Activité', 'Sélection', activityLabel.dataset.type]);
            return;
        }

        const button = event.target.closest('button, .btn');
        if (!button) return;

        // 2️⃣ IA ALBERT (Préparation & Génération)
        const isAlbertAction = 
            button.dataset.ia === 'albert' || 
            (button.id && button.id.toLowerCase().includes('albert')) ||
            (button.id && button.id.toLowerCase().includes('prepare-prompt'));

        if (isAlbertAction) {
            const actionType = button.id.includes('prepare') ? 'Préparation Prompt' : 'Génération IA';
            window._paq.push(['trackEvent', 'HAPI - IA Albert', actionType, activeType]);
            return;
        }

        // 3️⃣ LOT COMPLET ZIP & SAUVEGARDE JSON
        if (button.id === 'btn-dash-zip-all') {
            window._paq.push(['trackEvent', 'HAPI - Export', 'Lot complet ZIP globale']);
            return;
        }
        if (button.id === 'btn-dash-save-json') {
            window._paq.push(['trackEvent', 'HAPI - Export', 'Sauvegarde Projet JSON', activeType]);
            return;
        }

        // 4️⃣ PRÉVISUALISATION
        if (button.id === 'btn-global-preview' || button.id === 'preview-btn' || button.classList.contains('btn-preview')) {
            window._paq.push(['trackEvent', 'HAPI - Activité', 'Prévisualisation', activeType]);
            return;
        }

        // 5️⃣ TÉLÉCHARGEMENT (Détection via les classes de download-ui.js)
        let exportFormat = button.dataset.export;
        
        if (!exportFormat) {
            if (button.classList.contains('btn-dash-h5p')) exportFormat = 'H5P';
            else if (button.classList.contains('btn-dash-moodle')) exportFormat = 'XML Moodle';
            else if (button.classList.contains('btn-dash-gift')) exportFormat = 'GIFT';
            else if (button.classList.contains('btn-dash-odt')) exportFormat = 'ODT';
            else if (button.classList.contains('btn-dash-pdf')) exportFormat = 'PDF';
            else if (button.classList.contains('btn-dash-zip-standalone')) exportFormat = 'ZIP Standalone';
        }

        if (exportFormat) {
            // Sur le tableau de bord de finalisation, l'activité est stockée dans data-type sur le bouton
            const targetActivity = button.dataset.type || activeType;
            window._paq.push(['trackEvent', 'HAPI - Export', exportFormat.toUpperCase(), targetActivity]);
        }
    });
});