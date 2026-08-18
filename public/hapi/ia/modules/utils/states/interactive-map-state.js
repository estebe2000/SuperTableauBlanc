// Fichier: modules/utils/states/interactive-map-state.js
import { logger } from '../logger.js';
import { sanitizeRichHtml } from '../sanitize.js';

// ✅ NOUVEAU : Helper pour convertir le Base64 en objet File lors de la restauration
function base64ToFile(dataurl, filename) {
    if (!dataurl || typeof dataurl !== 'string' || !dataurl.includes(',')) return null;
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

/**
 * CAPTURE L'ÉTAT COMPLET DE LA CARTE INTERACTIVE (Export)
 */
export function getInteractiveMapState(audioFiles = new Map()) {
    const markers = [];
    
    // 1. Extraction rigoureuse des repères (Coordonnées, Textes, Médias ET Audio)
    document.querySelectorAll('#map-markers-list .map-marker-card').forEach(card => {
        const uniqueId = card.querySelector('[id^="map-"]')?.id.replace('map-', '');
        const audioData = uniqueId ? audioFiles.get(uniqueId) : null;

        markers.push({
            lat: parseFloat(card.querySelector('.inp-lat')?.value) || 46.2276,
            lng: parseFloat(card.querySelector('.inp-lng')?.value) || 2.2137,
            zoom: parseInt(card.querySelector('.inp-zoom')?.value) || 5,
            title: card.querySelector('.inp-title')?.value || '',
            color: card.querySelector('.inp-color')?.value || '#0369a1',
            date: card.querySelector('.inp-date')?.value || '',
            desc: card.querySelector('.inp-text')?.value || '', 
            img_url: card.querySelector('.final-img-url')?.value || '', 
            credit: card.querySelector('.final-img-credit')?.value || '',
            caption: card.querySelector('.inp-caption')?.value || '',
            wikiSearch: card.querySelector('.wiki-search-input')?.value || '',
            audio: audioData ? audioData.base64 : null // ✅ SAUVEGARDE BASE64
        });
    });

    const introAudioData = audioFiles.get('intro');

    // 2. Exportation de l'objet de configuration total
    return {
        type: 'interactive-map',
        
        // Paramètres généraux
        titre: document.getElementById('map-subject')?.value || '',
        
        // La langue reste indispensable pour l'affichage dynamique des fonds de carte OSM
        langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-map')?.checked ?? true,
        
        // Introduction
        intro: document.getElementById('desc-hidden-intro')?.value || '',
        introAudio: introAudioData ? introAudioData.base64 : null, // ✅ SAUVEGARDE BASE64 INTRO

        // Options du mode "Tour" (Navigation automatique)
        tourEnabled: document.getElementById('tour-enabled')?.checked || false,
        tourDuration: parseInt(document.getElementById('tour-duration')?.value || "6", 10),
        tourLineColor: document.getElementById('tour-line-color')?.value || '#059669',
        tourLineStyle: document.getElementById('tour-line-style')?.value || 'dashed',

        // ✅ RIGUEUR IA : Sauvegarde du chantier Albert (Prompt & Réponse)
        iaPrompt: document.getElementById('ia-prompt-map')?.value || '',
        iaResponse: document.getElementById('ia-response-map')?.value || '',
        
        markers: markers
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET DE LA CARTE INTERACTIVE (Import)
 */
export function setInteractiveMapState(config, uiActions) {
    if (config.type !== 'interactive-map') return;

    logger.log('🔄 Restauration rigoureuse de la Carte Interactive (avec Audio)...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Restauration des réglages globaux et titres
    setVal('map-subject', config.titre);
    setVal('global-language', config.langue || 'Français'); // Restauration de la langue
    setCheck('translate-ui-map', config.translateUI ?? true);

    // 2. Options du Tour
    const tourCb = document.getElementById('tour-enabled');
    if (tourCb) {
        tourCb.checked = config.tourEnabled || false;
        tourCb.dispatchEvent(new Event('change'));
    }
    setVal('tour-duration', config.tourDuration || 6);
    setVal('tour-line-color', config.tourLineColor || '#059669');
    setVal('tour-line-style', config.tourLineStyle || 'dashed');

    // 3. Restauration de l'Introduction
    if (config.intro) {
        const safeIntro = sanitizeRichHtml(config.intro); // anti self-XSS : intro restauré collé dans Quill
        const introHidden = document.getElementById('desc-hidden-intro');
        if (introHidden) introHidden.value = safeIntro;

        const introQuillDiv = document.getElementById('quill-intro');
        if (introQuillDiv && introQuillDiv.__quill) {
            introQuillDiv.__quill.clipboard.dangerouslyPasteHTML(safeIntro);
        }
    }

    // ✅ NOUVEAU : RECONSTRUCTION DE L'AUDIO DE L'INTRO
    if (config.introAudio && uiActions.restoreIntroAudio) {
        const file = base64ToFile(config.introAudio, 'intro_audio.wav');
        if (file) uiActions.restoreIntroAudio({ file: file, base64: config.introAudio });
    }

    // 4. ✅ RIGUEUR IA : Restauration du chantier Albert
    setVal('ia-prompt-map', config.iaPrompt || '');
    setVal('ia-response-map', config.iaResponse || '');

    // 5. Nettoyage et reconstruction des repères via l'UI
    uiActions.clearPreview();

    const hasMarkers = config.markers && config.markers.length > 0;

    if (hasMarkers) {
        config.markers.forEach((markerData, i) => {
            // ✅ NOUVEAU : RECONSTRUCTION DE L'AUDIO DU REPÈRE
            if (markerData.audio && typeof markerData.audio === 'string') {
                const file = base64ToFile(markerData.audio, `marker_${i}_audio.wav`);
                markerData.audio = { file: file, base64: markerData.audio };
            } else {
                markerData.audio = null;
            }
            uiActions.addCard(markerData);
        });
    }

    // 6. ✅ LOGIQUE DE VISIBILITÉ RIGUREUSE
    const iaContainer = document.getElementById('ia-container-map');
    const albertAction = document.getElementById('albert-action-map');
    const responseArea = document.getElementById('ia-response-map');

    if (config.iaPrompt) {
        if (iaContainer) iaContainer.style.display = 'block';
        if (albertAction) albertAction.style.display = 'block';

        if (hasMarkers && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'none';
        } else if (!hasMarkers && config.iaResponse && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'block';
            responseArea.style.minHeight = '300px';
        }
    }

    // 7. Affichage automatique des sections de l'éditeur
    if (hasMarkers) {
        const editorMap = document.getElementById('editor-map');
        const generateSec = document.getElementById('generate-section');
        
        if (editorMap) editorMap.style.display = 'block';
        if (generateSec) generateSec.style.display = 'block';
    }

    if (uiActions.updateBtn) uiActions.updateBtn();
}