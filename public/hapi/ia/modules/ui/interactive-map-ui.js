// Fichier: modules/ui/interactive-map-ui.js

import { logger } from '../utils/logger.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { creerAssistantIA_HTML } from '../utils/helpers.js';
import { callAlbertAPI } from '../ia/ia-connectors.js';
import { preparerAssistantIA_InteractiveMap } from '../ia/prompt-builder.js';
import { ensureQuillLoaded, initQuillEditor } from '../utils/quill-manager.js';
import { escapeHtml, sanitizeRichHtml } from '../utils/sanitize.js';
import { getInteractiveMapState, setInteractiveMapState } from '../utils/states/interactive-map-state.js';
import { SourceSelector } from './source-selector.js';

let container = null;
let updateGenerateButtonCallback = () => {};

let localSourceSelector = null;
let currentRepartition = {};


// ==========================================
// MOTEUR AUDIO POUR LA BARRE D'OUTILS QUILL
// ==========================================
let audioFiles = new Map();
let mediaRecorder;
let audioChunks = [];
let currentRecordingMarkerId = null;

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

function bufferToWav(abuffer, name) {
    const numOfChan = abuffer.numberOfChannels;
    const length = abuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i, sample; let offset = 0; let pos = 0;
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
        } pos++;
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

async function startMapRecording(btn) {
    const uniqueId = btn.dataset.id;
    const stopBtn = btn.parentElement.querySelector('.btn-stop-toolbar');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        currentRecordingMarkerId = uniqueId;
        audioChunks = [];
        mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
        mediaRecorder.onstop = async () => {
            const mimeType = mediaRecorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            let audioFile;
            try { audioFile = await convertBlobToWavFile(audioBlob, `map_audio_${uniqueId}.wav`); }
            catch (e) { audioFile = new File([audioBlob], `map_audio_${uniqueId}.webm`, { type: mimeType }); }
            const base64 = await blobToBase64(audioFile);           
            audioFiles.set(uniqueId, { file: audioFile, base64: base64 });
            updateMapAudioPreview(uniqueId, audioFile);
            
            document.querySelectorAll('.btn-record-toolbar').forEach(b => { if (!audioFiles.has(b.dataset.id)) b.style.display = 'inline-flex'; });
            stopBtn.style.display = 'none';
            stream.getTracks().forEach(track => track.stop());
            updateGenerateButtonCallback();
            currentRecordingMarkerId = null;
        };
        mediaRecorder.start();
        document.querySelectorAll('.btn-record-toolbar').forEach(b => b.style.display = 'none');
        stopBtn.style.display = 'inline-block';
    } catch (err) {
        alert("Microphone inaccessible.");
        document.querySelectorAll('.btn-record-toolbar').forEach(b => { if (!audioFiles.has(b.dataset.id)) b.style.display = 'inline-flex'; });
    }
}

function stopMapRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
}

async function handleMapAudioUpload(input) {
    const uniqueId = input.dataset.id;
    if (input.files.length > 0) {
        const file = input.files[0];
        const base64 = await blobToBase64(file);
        audioFiles.set(uniqueId, { file: file, base64: base64 });
        updateMapAudioPreview(uniqueId, file);
        updateGenerateButtonCallback();
    }
}

function updateMapAudioPreview(uniqueId, file) {
    const preview = document.getElementById(`audio-preview-toolbar-${uniqueId}`);
    if (!preview) return;

    // Le lecteur remplace Enregistrer/Importer (sinon la toolbar déborde et le
    // groupe audio replie sur une 2e ligne) ; ils reviennent via deleteMapAudio.
    const recBtn = document.querySelector(`.btn-record-toolbar[data-id="${uniqueId}"]`);
    if (recBtn) recBtn.style.display = 'none';
    const importLabel = document.querySelector(`.statement-audio-upload-toolbar[data-id="${uniqueId}"]`)?.closest('label');
    if (importLabel) importLabel.style.display = 'none';

    const audioUrl = URL.createObjectURL(file);

    // ✅ UI corrigée : Un lecteur "pilule" élégant avec une zone de sécurité pour éviter les coupures
	preview.innerHTML = `
	    <div style="display: inline-flex; align-items: center; background: var(--page-bg); border-radius: 12px; padding: 0 3px 0 6px; margin: 2px 0 2px 4px; border: 1px solid var(--border); height: 22px; box-sizing: border-box; box-shadow: 0 1px 1px rgba(0,0,0,0.06); flex-shrink: 0; max-width: 100%;">
	        <audio class="hidden-audio-player" id="hidden-audio-${uniqueId}" src="${audioUrl}"></audio>
        
	        <button type="button" class="btn-play-mini" data-id="${uniqueId}" style="background:transparent; border:none; cursor:pointer; font-size:11px; padding:0 2px; line-height:1; display:inline-flex; align-items:center; justify-content:center; color:var(--text); outline:none;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'" title="Écouter">▶️</button>
        
	        <span class="audio-time-mini" id="time-${uniqueId}" style="font-size: 10px; color: var(--text-muted); margin: 0 2px; font-weight: 700; min-width: 24px; text-align: center; font-family: ui-monospace, monospace; line-height: 1;">...</span>
        
	        <span style="width: 1px; height: 12px; background: var(--border); margin: 0 2px;"></span>
        
	        <button type="button" class="btn-delete-audio-toolbar" data-id="${uniqueId}" style="background:transparent; color:var(--danger-text); border:none; cursor:pointer; font-size:11px; padding:0 4px; line-height:1; display:inline-flex; align-items:center; justify-content:center; font-weight:bold; outline:none;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'" title="Supprimer l'audio">✕</button>
	    </div>
	`;

    // ✅ La logique JavaScript reste la même
    const audioEl = preview.querySelector(`#hidden-audio-${uniqueId}`);
    const playBtn = preview.querySelector('.btn-play-mini');
    const timeSpan = preview.querySelector(`#time-${uniqueId}`);

    if (audioEl && playBtn && timeSpan) {
        // Affichage de la durée initiale
        audioEl.onloadedmetadata = () => {
            if (isFinite(audioEl.duration)) {
                let s = Math.round(audioEl.duration);
                let m = Math.floor(s/60);
                s = s % 60;
                timeSpan.innerText = m + ':' + (s < 10 ? '0'+s : s);
            } else {
                timeSpan.innerText = "0:00";
            }
        };
        
        // Mise à jour pendant la lecture (compte à rebours)
        audioEl.ontimeupdate = () => {
            let current = Math.round(audioEl.currentTime);
            let duration = Math.round(audioEl.duration);
            if (isNaN(duration) || !isFinite(duration)) return;
            
            let rem = duration - current;
            let m = Math.floor(rem/60);
            let s = rem % 60;
            timeSpan.innerText = m + ':' + (s < 10 ? '0'+s : s);
        };

        // Remise à zéro du bouton à la fin de l'audio
        audioEl.onended = () => {
            playBtn.innerText = '▶️';
            if (isFinite(audioEl.duration)) {
                let s = Math.round(audioEl.duration);
                let m = Math.floor(s/60);
                s = s % 60;
                timeSpan.innerText = m + ':' + (s < 10 ? '0'+s : s);
            }
        };

        // Gestion Play/Pause avec coupure des autres audios
        playBtn.onclick = () => {
            if (audioEl.paused) {
                // Met en pause tous les autres lecteurs ouverts dans la page
                document.querySelectorAll('.hidden-audio-player').forEach(a => {
                    if (a !== audioEl && !a.paused) {
                        a.pause();
                        const otherBtn = a.parentElement.querySelector('.btn-play-mini');
                        if (otherBtn) otherBtn.innerText = '▶️';
                    }
                });
                audioEl.play();
                playBtn.innerText = '⏸️';
            } else {
                audioEl.pause();
                playBtn.innerText = '▶️';
            }
        };
    }
}

function deleteMapAudio(uniqueId) {
    audioFiles.delete(uniqueId);
    const preview = document.getElementById(`audio-preview-toolbar-${uniqueId}`);
    if (preview) preview.innerHTML = '';
    const fileInput = document.querySelector(`.statement-audio-upload-toolbar[data-id="${uniqueId}"]`);
    if (fileInput) fileInput.value = '';
    // Réaffiche Enregistrer/Importer (masqués tant qu'un audio existait)
    const recBtn = document.querySelector(`.btn-record-toolbar[data-id="${uniqueId}"]`);
    if (recBtn) recBtn.style.display = 'inline-flex';
    if (fileInput && fileInput.closest('label')) fileInput.closest('label').style.display = 'inline-flex';
    updateGenerateButtonCallback();
}


// ==========================================
// 1. UTILITAIRES & WIKIMEDIA
// ==========================================

async function searchWikimedia(query) {
    if (!query || query.length < 2) return [];
    const endpoint = "https://commons.wikimedia.org/w/api.php";
    
    const params = new URLSearchParams({
        action: "query", 
        generator: "search", 
        gsrnamespace: "6", 
        gsrsearch: `${query} filetype:bitmap`, 
        gsrlimit: "12", 
        prop: "imageinfo", 
        iiprop: "url|extmetadata", 
        iiurlwidth: "800",
        format: "json", 
        origin: "*" 
    });

    try {
        const response = await fetch(`${endpoint}?${params.toString()}`);
        const data = await response.json();
        if (!data.query || !data.query.pages) return [];

        return Object.values(data.query.pages).map(page => {
            if (!page.imageinfo || !page.imageinfo[0]) return null;
            
            const info = page.imageinfo[0];
            const meta = info.extmetadata || {};
            const fileName = page.title.replace("File:", "");

            const forbiddenExt = ['.pdf', '.djvu', '.ogv', '.webm', '.mpg', '.mp4'];
            if (forbiddenExt.some(ext => fileName.toLowerCase().endsWith(ext))) return null;

            let year = "";
            if (meta.DateTimeOriginal && meta.DateTimeOriginal.value) {
                const match = meta.DateTimeOriginal.value.match(/\d{4}/);
                if (match) year = match[0];
            } else if (meta.DateTime && meta.DateTime.value) {
                const match = meta.DateTime.value.match(/\d{4}/);
                if (match) year = match[0];
            }

            let rawCaption = meta.ObjectName ? meta.ObjectName.value : fileName.split('.')[0];
            let cleanCaption = rawCaption;
            
            if (cleanCaption.includes('<')) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cleanCaption;
                tempDiv.querySelectorAll('[style*="display: none"], [style*="display:none"]').forEach(el => el.remove());
                cleanCaption = tempDiv.textContent || tempDiv.innerText || "";
                cleanCaption = cleanCaption.replace(/\s+/g, ' ').trim();
            }

            return {
                thumb: info.thumburl,
                full: info.url,
                sourceUrl: info.descriptionurl || info.url, 
                title: fileName,
                artist: meta.Artist ? meta.Artist.value.replace(/<\/?[^>]+(>|$)/g, "") : "Inconnu",
                license: meta.LicenseShortName ? meta.LicenseShortName.value : "CC BY-SA",
                caption: cleanCaption,
                year: year
            };
        }).filter(item => item !== null);
    } catch (e) { 
        console.error("Erreur Wikimedia:", e);
        return []; 
    }
}

function openWikiLightbox(imgData, card) {
    const modal = document.createElement('div');
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; font-family:sans-serif;";
    modal.innerHTML = `
        <div style="background:var(--surface); max-width:1000px; width:95%; border-radius:12px; overflow:hidden; position:relative; display:flex; flex-direction:column; max-height:90vh;">
            <button id="close-light" style="position:absolute; top:15px; right:15px; background:var(--surface); border:none; font-size:24px; cursor:pointer; z-index:10; border-radius:50%; width:40px; height:40px; box-shadow:0 2px 10px rgba(0,0,0,0.2);">✕</button>
            <div style="flex:1; background:#000; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                <img src="${imgData.full}" crossorigin="anonymous" style="max-width:100%; max-height:100%; object-fit:contain;">
            </div>
            <div style="padding:20px; background:var(--surface); display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                <div style="max-width:70%;">
                    <h4 style="margin:0 0 5px 0; color:var(--text);">${imgData.title}</h4>
                    <p style="margin:0; font-size:0.85em; color:var(--text-muted);"><strong>Auteur:</strong> ${imgData.artist} | <strong>Année:</strong> ${imgData.year || 'N/A'}</p>
                </div>
                <button id="select-this-img" style="background:var(--hapi-grad-a); color:#fff; border:none; padding:12px 25px; border-radius:30px; font-weight:bold; cursor:pointer;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Sélectionner</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelector('#close-light').onclick = () => modal.remove();
    modal.querySelector('#select-this-img').onclick = () => {
        if (card) {
            card.querySelector('.final-img-url').value = imgData.full;
            card.querySelector('.final-img-credit').value = `${imgData.artist} (${imgData.license})`;
            
            const captionField = card.querySelector('.inp-caption');
            if (captionField) captionField.value = imgData.caption || imgData.title;

            const thumbImg = card.querySelector('.selected-img-preview');
            if (thumbImg) {
                thumbImg.src = imgData.thumb;
                thumbImg.style.display = 'block';
            }

            const noPrev = card.querySelector('.no-img-preview');
            if(noPrev) noPrev.style.display = 'none';
            const iframePrev = card.querySelector('.selected-iframe-preview');
            if(iframePrev) iframePrev.style.display = 'none';

            const creditsPanel = card.querySelector('.media-credits-panel');
            if (creditsPanel) creditsPanel.style.display = 'block';
        }
        modal.remove();
        updateGenerateButtonCallback();
    };
}


// ==========================================
// 2. LOGIQUE CARTE LEAFLET PAR REPÈRE
// ==========================================

function ensureLeafletLoaded() {
    if (!document.getElementById('leaflet-css')) {
        const css = document.createElement('link');
        css.id = 'leaflet-css';
        css.rel = 'stylesheet';
        css.href = new URL('../../../vendor/leaflet/leaflet.css', import.meta.url).href;
        document.head.appendChild(css);
    }
    if (!document.getElementById('leaflet-js') && typeof L === 'undefined') {
        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = new URL('../../../vendor/leaflet/leaflet.js', import.meta.url).href;
        document.head.appendChild(script);
    }
    if (!document.getElementById('leaflet-swipe-js')) {
        const scriptSwipe = document.createElement('script');
        scriptSwipe.id = 'leaflet-swipe-js';
        scriptSwipe.src = new URL('../../../vendor/leaflet-side-by-side/leaflet-side-by-side.min.js', import.meta.url).href;
        document.head.appendChild(scriptSwipe);
    }
}

function initLeafletMap(uniqueId, initialLat, initialLng, initialZoom, initialColor = "var(--hapi-green-dark)") {
    if (typeof L === 'undefined') {
        setTimeout(() => initLeafletMap(uniqueId, initialLat, initialLng, initialZoom, initialColor), 200);
        return;
    }

    const mapId = `map-${uniqueId}`;
    const mapContainer = document.getElementById(mapId);
    if (!mapContainer) return;

    const latInput = document.getElementById(`lat-${uniqueId}`);
    const lngInput = document.getElementById(`lng-${uniqueId}`);
    const zoomInput = document.getElementById(`zoom-${uniqueId}`);

    const isSwipeMode = document.getElementById('map-swipe-mode')?.checked || false;
    const mapStyle = document.getElementById('map-style')?.value || 'osm';
    const styleLeft = document.getElementById('map-style-left')?.value || 'ign_1950';
    const styleRight = document.getElementById('map-style-right')?.value || 'satellite';
    
    const langSelect = document.getElementById('global-language');
    const langueActuelle = langSelect ? langSelect.value : 'Français';
    
    const getTileUrls = (langue) => {
        let osmUrl = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
        if (langue === 'German' || langue === 'Allemand') osmUrl = 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';
        else if (langue !== 'Français' && langue !== 'French') osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        
        return {
            'voyager': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
            'osm': osmUrl,
            'satellite': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
            'topo': 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            'ign_cassini': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.CASSINI&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
            'ign_1950': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS.1950-1965&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
        };
    };

    const tileUrls = getTileUrls(langueActuelle);
    const map = L.map(mapId).setView([initialLat, initialLng], initialZoom);

    if (isSwipeMode && typeof L.control.sideBySide !== 'undefined') {
        const leftLayer = L.tileLayer(tileUrls[styleLeft], { maxZoom: 18 }).addTo(map);
        const rightLayer = L.tileLayer(tileUrls[styleRight], { maxZoom: 18 }).addTo(map);
        L.control.sideBySide(leftLayer, rightLayer).addTo(map);

        setTimeout(() => {
            const slider = mapContainer.querySelector('.leaflet-sbs-range');
            if (slider) {
                L.DomEvent.disableClickPropagation(slider);
                slider.addEventListener('mousedown', () => map.dragging.disable());
                slider.addEventListener('touchstart', () => map.dragging.disable(), {passive: true});
                window.addEventListener('mouseup', () => { if(map.dragging) map.dragging.enable(); });
                window.addEventListener('touchend', () => { if(map.dragging) map.dragging.enable(); });
            }
        }, 200);
    } else {
        L.tileLayer(tileUrls[mapStyle], { maxZoom: 18 }).addTo(map);
    }

    const getIcon = (c) => L.divIcon({
        className: 'custom-colored-pin',
        html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
                <path fill="${c}" stroke="#ffffff" stroke-width="2" d="M12 0C5.373 0 0 5.373 0 12c0 7.632 10.334 22.548 11.235 23.865a1.002 1.002 0 0 0 1.53 0C13.666 34.548 24 19.632 24 12c0-6.627-5.373-12-12-12zm0 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>
               </svg>`,
        iconSize: [28, 42],
        iconAnchor: [14, 42]
    });

    const marker = L.marker([initialLat, initialLng], { 
        draggable: true, 
        icon: getIcon(initialColor) 
    }).addTo(map);

    marker.on('dragend', function() {
        const position = marker.getLatLng();
        if (latInput) latInput.value = position.lat.toFixed(5);
        if (lngInput) lngInput.value = position.lng.toFixed(5);
        updateGenerateButtonCallback();
    });

    map.on('zoomend', function() {
        if(zoomInput) {
            zoomInput.value = map.getZoom();
            updateGenerateButtonCallback();
        }
    });

    mapContainer._leafletMap = map;
    mapContainer._leafletMarker = marker;
    mapContainer._getIcon = getIcon;

    setTimeout(() => { map.invalidateSize(); }, 300);
}


// ==========================================
// 3. LOGIQUE IA & ÉDITION
// ==========================================

function renderRepartitionConfigMap(selectedDocs) {
    const repContainer = document.getElementById('map-questions-repartition');
    if (!repContainer) return;

    document.querySelectorAll('.source-question-count').forEach(input => {
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
                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> Répartition des repères à extraire</span>
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

async function handlePreparePrompt() {
    const subjectInput = document.getElementById('map-subject');
    const btn = document.getElementById('btn-prep-map');
    
    if (!subjectInput || !subjectInput.value.trim()) {
        alert("⚠️ Le champ 'Sujet / Titre' est obligatoire.");
        if (subjectInput) {
            subjectInput.style.borderColor = "#b91c1c";
            subjectInput.focus();
        }
        return;
    }
    if (subjectInput) subjectInput.style.borderColor = "#cbd5e1";
    
    // 🟢 On force le texte initial de base
    const originalText = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt';
    
    btn.disabled = true; 
    btn.innerHTML = "Analyse...";

    try {
        const repartitionMap = {};
        container.querySelectorAll('.source-question-count').forEach(i => {
            repartitionMap[i.dataset.sourceId] = parseInt(i.value, 10) || 0;
        });
        
        const success = await preparerAssistantIA_InteractiveMap(repartitionMap);
        
        if (success) {
            // 🟢 NOUVEAU : On cache le conteneur parent de manière sécurisée
            if (btn.parentElement) {
                btn.parentElement.style.display = 'none';
            }

            const iaContainer = document.getElementById('ia-container-map');
            if (iaContainer) {
                iaContainer.style.display = 'block';
                const promptArea = document.getElementById('ia-prompt-map');
                if (promptArea) {
                    promptArea.removeAttribute('readonly'); 
                    promptArea.disabled = false;
                    promptArea.style.backgroundColor = 'var(--field-bg)'; 
                    promptArea.style.border = '2px solid var(--hapi-green)';
                }
            }
            
            const albertAction = document.getElementById('albert-action-map');
            if (albertAction) albertAction.style.display = 'block';

            setTimeout(() => {
                const iaContainerToScroll = document.getElementById('ia-container-map');
                if (iaContainerToScroll) iaContainerToScroll.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    } catch (e) {
        console.error("Erreur de préparation IA:", e);
    } finally {
        // 🟢 On réinitialise l'état pour la prochaine fois
        btn.disabled = false; 
        btn.innerHTML = originalText;
    }
}

async function handleGenerateAlbertMap() {
    const btn = document.getElementById('btn-send-albert-map');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "L'IA place les repères...";

    await callAlbertAPI('ia-prompt-map', 'ia-response-map', 'btn-parse-ia-response-map', btn);

    btn.innerHTML = originalText;
    btn.disabled = false;
}

async function triggerAutoSearch(card, query) {
    const resultsDiv = card.querySelector('.wiki-results');
    if (!resultsDiv) return;
    resultsDiv.innerHTML = '<div style="grid-column:1/-1; text-align:center; font-size:0.8em; color: var(--hapi-accent-text);">Recherche auto...</div>';
    const images = await searchWikimedia(query);
    resultsDiv.innerHTML = '';
    images.forEach(img => {
        const imgThumb = document.createElement('div');
        imgThumb.style.cssText = "height:90px; border-radius:6px; border:2px solid var(--border); overflow:hidden; cursor:pointer;";
        imgThumb.innerHTML = `<img src="${img.thumb}" style="width:100%; height:100%; object-fit:cover;">`;
        imgThumb.onclick = () => openWikiLightbox(img, card);
        resultsDiv.appendChild(imgThumb);
    });
}

function updateCounter() {
    const badge = document.getElementById('map-counter-badge');
    if (badge) badge.innerText = document.querySelectorAll('.map-marker-card').length;
}

function refreshMarkerIndices() {
    const cards = document.querySelectorAll('.map-marker-card');
    cards.forEach((card, index) => {
        const span = card.querySelector('.num-index');
        if (span) span.innerText = (index + 1);
    });
    updateCounter();
}

function addCard(data = {}) {
    const lat = data.lat !== undefined && data.lat !== "" ? parseFloat(data.lat) : 46.2276;
    const lng = data.lng !== undefined && data.lng !== "" ? parseFloat(data.lng) : 2.2137;
    const zoom = data.zoom !== undefined ? parseInt(data.zoom) : 5;
    const color = data.color || "var(--hapi-green-dark)";
    const title = data.title || "";
    const date = data.date || "";
    const desc = sanitizeRichHtml(data.desc || ""); // anti self-XSS : desc importé chargé dans Quill + textarea

    const mediaUrl = data.img_url || "";
    const caption = "";
    const credit = data.credit || "";
    const thumbnail = mediaUrl;

    const uniqueId = `marker-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const originalDataStr = encodeURIComponent(JSON.stringify(data));

    const list = document.getElementById('map-markers-list');
    const div = document.createElement('div');
    div.className = 'map-marker-card';
    div.dataset.original = originalDataStr;
    div.style.cssText = "background:var(--surface); border:1px solid var(--border); padding:30px 20px 20px 20px; margin-bottom:20px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.05); position:relative;";
    
    div.innerHTML = `
        <div class="marker-number" style="position:absolute; top:-10px; left:20px; background:var(--hapi-grad-a); color:white; padding:4px 12px; border-radius:6px; font-size:0.75em; font-weight:bold; z-index:5; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            Repère <span class="num-index"></span>
        </div>

        <button class="btn-del" style="position:absolute; top:5px; right:6px; color:var(--text); background:transparent; border:none; cursor:pointer; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; z-index:10;" title="Supprimer ce repère"><svg class="ico" style="width:1.35em;height:1.35em;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
		<div style="position:absolute; top:5px; right:45px; display:flex; gap:5px; z-index:10;">
   	 		<button class="btn-move-up" style="background:var(--page-bg); border:1px solid var(--border); cursor:pointer; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; color:var(--text-muted);" title="Monter ce repère"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg></button>
   	 		<button class="btn-move-down" style="background:var(--page-bg); border:1px solid var(--border); cursor:pointer; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; color:var(--text-muted);" title="Descendre ce repère"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg></button>
		</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; padding-top:10px;">
            
            <div>
                <input type="text" class="inp-title" value="${escapeHtml(title)}" placeholder="Nom du lieu / Événement" style="width:100%; font-weight:bold; padding:8px; border:1px solid var(--border); border-radius:6px; margin-bottom:10px; box-sizing:border-box;">
                
                <div style="display:flex; gap:10px; margin-bottom:10px; align-items:flex-end;">
                    <div style="flex:1;">
                        <label style="font-size:0.75em; font-weight:700; color: var(--hapi-accent-text); display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <span>Latitude (° déc.) :</span>
                            <button type="button" class="btn-dms-toggle" style="background:none; border:none; cursor:pointer; font-size:1.2em; padding:0; line-height:1;" title="Maintenir cliqué pour DMS"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></button>
                        </label>
                        <input type="text" class="inp-lat" id="lat-${uniqueId}" value="${lat}" placeholder="Ex: 48.8566" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div style="flex:1;">
                        <label style="font-size:0.75em; font-weight:700; color: var(--hapi-accent-text); display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <span>Longitude (° déc.) :</span>
                            <button type="button" class="btn-dms-toggle" style="background:none; border:none; cursor:pointer; font-size:1.2em; padding:0; line-height:1;" title="Maintenir cliqué pour DMS"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></button>
                        </label>
                        <input type="text" class="inp-lng" id="lng-${uniqueId}" value="${lng}" placeholder="Ex: 2.3522" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div style="flex:0.6;">
                        <label style="font-size:0.75em; font-weight:700; color: var(--hapi-accent-text); display:block; margin-bottom:4px;">Zoom :</label>
                        <input type="number" class="inp-zoom" id="zoom-${uniqueId}" value="${zoom}" min="1" max="18" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div style="flex:0.8;">
                        <label style="font-size:0.75em; font-weight:700; color: var(--hapi-accent-text); display:block; margin-bottom:4px;">Couleur / Reset :</label>
                        <div style="display:flex; gap:5px;">
                            <input type="color" class="inp-color" id="color-${uniqueId}" value="${escapeHtml(color)}" style="width:100%; height:34px; padding:2px; border:1px solid var(--border); border-radius:6px; cursor:pointer;" title="Couleur du repère">
                            <button type="button" class="btn-reset-card" style="background:var(--hapi-green-pale); color: var(--hapi-accent-text); border:1px solid var(--border-strong); border-radius:6px; width:40px; cursor:pointer; font-weight:bold; font-size:1.2em; display:flex; align-items:center; justify-content:center; padding:0;" title="Réinitialiser la carte IA">⟲</button>
                        </div>
                    </div>
                </div>

                <div id="map-${uniqueId}" style="height: 250px; width: 100%; margin-bottom: 10px; border-radius: 6px; border: 1px solid #ccc; z-index: 1;"></div>
                
				<div style="margin-bottom:10px;">
                    <label style="font-size:0.75em; font-weight:700; color: var(--hapi-accent-text); display:block; margin-bottom:4px;">Date / Époque :</label>
                    <input type="text" class="inp-date" value="${escapeHtml(date)}" placeholder="Ex: 14 juillet 1789" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; background:var(--hapi-green-mist); box-sizing:border-box;">
                </div>

				<label style="font-size:0.75em; font-weight:700; color: var(--hapi-accent-text); display:block; margin-bottom:4px;">Description :</label>             
                <div style="background:var(--surface); margin-bottom:10px;">
                    <div id="quill-${uniqueId}" style="height: 120px; font-family: sans-serif; font-size: 14px;"></div>
                </div>
                
                <textarea class="inp-text" id="desc-hidden-${uniqueId}" style="display:none;">${desc}</textarea>
            </div> 
            
            <div style="background:var(--page-bg); padding:15px; border-radius:10px; border:1px dashed #cbd5e0;">
                
                <div style="display:flex; gap:6px; width:100%; align-items:center; flex-wrap:nowrap; margin-bottom:8px;">
                    <input type="text" class="wiki-search-input" placeholder="Recherche WikiCommons..." style="height:38px; flex:1 1 auto; min-width:0; padding:0 12px; border:1px solid #cbd5e0; border-radius:19px; box-sizing:border-box; outline:none;">
                    <button class="btn-wiki-search" style="height:38px; flex:0 0 auto; padding:0 15px; margin:0; border-radius:19px; background:var(--hapi-green-dark); color:white; border:none; cursor:pointer; font-weight:bold; box-sizing:border-box; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>
                </div>

                <div class="wiki-results" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; max-height:280px; overflow-y:auto; background:var(--surface); padding:8px; border:1px solid var(--border); border-radius:6px; margin-bottom:12px; min-height:60px;"></div>

                <button type="button" class="btn-toggle-media" style="height:38px; width:100%; background:#64748b; color:white; border:none; border-radius:19px; padding:0 15px; font-weight:bold; font-size:0.85em; cursor:pointer; margin-bottom:12px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg> Ajouter un média distant (URL / Iframe)</button>
                
                <div class="media-details" style="display:none; background:var(--surface); padding:12px; border:1px solid #cbd5e0; border-radius:12px; margin-bottom:12px;">
                    <label style="font-size:0.7em; font-weight:700; color:var(--text-muted);">URL de l'image OU Code Iframe :</label>
                    <textarea class="final-img-url" rows="2" placeholder="Lien direct (.jpg ou .png) OU code complet <iframe src=...></iframe>" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:6px; font-size:0.85em; box-sizing:border-box; font-family:monospace;">${escapeHtml(mediaUrl)}</textarea>
                </div>

                <div style="display:flex; align-items:center; gap:12px; border-top:1px solid var(--border); padding-top:12px;">
                    <div style="width:60px; height:60px; border:2px solid var(--border); border-radius:6px; overflow:hidden; background:var(--page-bg); position:relative; flex-shrink:0; cursor:pointer;" class="img-preview-container">
                        <img class="selected-img-preview" src="${escapeHtml(thumbnail)}" style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0; display:${thumbnail && !thumbnail.startsWith('<iframe') ? 'block' : 'none'};" onclick="openPreviewLightbox(this.src)" title="Cliquez pour agrandir">
                        <div class="selected-iframe-preview" style="width:100%; height:100%; position:absolute; top:0; left:0; display:${thumbnail && thumbnail.startsWith('<iframe') ? 'flex' : 'none'}; align-items:center; justify-content:center; font-size:24px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4"/></svg></div>
                        <div class="no-img-preview" style="width:100%; height:100%; position:absolute; top:0; left:0; display:${!thumbnail ? 'flex' : 'none'}; align-items:center; justify-content:center; font-size:24px; color:var(--text-muted);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>
                    </div>

                    <div style="flex:1; min-width:0; display:flex; flex-direction:column; justify-content: center; gap:6px;">
                        <input type="file" class="inp-thumb-local styled-file-input" accept="image/*" style="width:100%; font-size:0.85em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    </div>
                    
                    <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
                        <button type="button" class="btn-edit-source" style="height:28px; background:var(--border); color:var(--text); border:none; border-radius:14px; padding:0 12px; font-size:0.75em; cursor:pointer; font-weight:bold; transition:background 0.2s;" onmouseover="this.style.background='var(--hapi-green-pale)'; this.style.color='var(--hapi-accent-text)'" onmouseout="this.style.background='var(--border)'; this.style.color='var(--text)'"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Légende/Source</button>
                        <a href="#" class="btn-remove-img" style="font-size:0.75em; color:var(--danger-text); text-decoration:none; display:${mediaUrl ? 'inline' : 'none'}; font-weight:bold; padding:4px;">✕ Retirer</a>
                    </div>
                </div>

                <div class="media-credits-panel" style="display:${caption || credit ? 'block' : 'none'}; background:var(--page-bg); padding:12px; border:1px solid var(--border); border-radius:8px; margin-top:12px;">
                    <label style="font-size:0.7em; font-weight:700; color: var(--hapi-accent-text);">Légende du média :</label>
                    <input type="text" class="inp-caption" value="${caption}" placeholder="Courte description visible sous l'image..." style="width:100%; padding:6px; border:1px solid #ccc; border-radius:6px; margin-bottom:8px; font-size:0.85em; box-sizing:border-box;">
                    
                    <label style="font-size:0.7em; font-weight:700; color: var(--hapi-accent-text);">Crédits / Source :</label>
                    <input type="text" class="final-img-credit" value="${escapeHtml(credit)}" placeholder="Auteur, institution, licence..." style="width:100%; padding:6px; border:1px solid #ccc; border-radius:6px; font-size:0.85em; box-sizing:border-box;">
                </div>

                <div style="font-size:0.7em; color:var(--text-muted); margin-top:12px; font-style:italic; line-height:1.3; border-top: 1px dotted #cbd5e0; padding-top: 8px;">
                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> Bien que l'exception pédagogique autorise certaines utilisations, le respect du droit d'auteur reste primordial. Nous vous invitons à utiliser en priorité des images libres de droits (ex. : Wikimedia Commons, Pixabay) et à toujours mentionner leurs auteurs dans le champ ci-dessus. Cette rigueur est d'autant plus importante lors d'un export au format PDF.
                </div>

            </div>
        </div>
    `;
    list.appendChild(div);

	if (data.audio) {
	        audioFiles.set(uniqueId, data.audio);
	    }
	    list.appendChild(div);


		setTimeout(() => {
		        initLeafletMap(uniqueId, lat, lng, zoom);
		        initQuillEditor(uniqueId, desc, updateGenerateButtonCallback);
        
		        // --- INJECTION DE LA TOOLBAR AUDIO DU REPÈRE ---
		        setTimeout(() => {
		            const quillContainer = document.getElementById(`quill-${uniqueId}`);
		            if (quillContainer && quillContainer.previousElementSibling && quillContainer.previousElementSibling.classList.contains('ql-toolbar')) {
		                const toolbar = quillContainer.previousElementSibling;
                
		                // On s'assure que la toolbar s'adapte en hauteur
						toolbar.style.height = 'auto';
						toolbar.style.display = 'flex';
						toolbar.style.flexWrap = 'wrap';
						toolbar.style.alignItems = 'center';
						toolbar.querySelectorAll('.ql-formats').forEach(f => {
						    f.style.flexShrink = '0';
						    f.style.marginRight = '8px';
						});

						const audioGroup = document.createElement('span');
						audioGroup.className = 'ql-formats audio-toolbar-group';
						audioGroup.style.cssText = 'display: inline-flex; align-items: center; gap: 2px; margin-left: 4px; padding-left: 8px; border-left: 1px solid #e5e7eb; flex-shrink: 0;';

						audioGroup.innerHTML = `
						    <button type="button" class="btn-record-toolbar" data-id="${uniqueId}" style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:24px; padding:0; border-radius:3px; font-size:14px; color:var(--text); border:none; cursor:pointer; background:transparent; line-height:1; transition:color 0.2s;" onmouseover="this.style.color='var(--hapi-accent-text)'" onmouseout="this.style.color='var(--text)'" title="Enregistrer un audio"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/></svg></button>
    
						    <button type="button" class="btn-stop-toolbar" data-id="${uniqueId}" style="display:none; align-items:center; justify-content:center; width:28px; height:24px; padding:0; border-radius:3px; font-size:14px; color:var(--danger-text); border:none; cursor:pointer; background:transparent; line-height:1; transition:color 0.2s;" onmouseover="this.style.color='var(--danger-text)'" onmouseout="this.style.color='var(--danger-text)'" title="Arrêter l'enregistrement"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1"/></svg></button>
    
						    <label style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:24px; padding:0; border-radius:3px; font-size:14px; color:var(--text); cursor:pointer; background:transparent; line-height:1; transition:color 0.2s;" onmouseover="this.style.color='var(--hapi-accent-text)'" onmouseout="this.style.color='var(--text)'" title="Importer un fichier audio">
						        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9l-.83-1.2A2 2 0 0 0 7.9 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg>
						        <input type="file" class="statement-audio-upload-toolbar" data-id="${uniqueId}" accept="audio/*" style="display:none;">
						    </label>
    
						    <div id="audio-preview-toolbar-${uniqueId}" style="display:inline-flex; align-items:center; flex-shrink:1; min-width:0;"></div>
						`;
		                toolbar.appendChild(audioGroup);

		                // --- RESTAURATION DE L'AUDIO DU REPÈRE À L'IMPORT ---
		                const existingAudio = audioFiles.get(uniqueId);
		                if (existingAudio && existingAudio.file) {
		                    updateMapAudioPreview(uniqueId, existingAudio.file);
		                }
		            }
		        }, 150);
		    }, 50);

		    return div;
		}
	
// ==========================================
// 4. INITIALISATION & UI
// ==========================================

export function init(p_container, corpusContent, updateBtnCallback) {
    audioFiles.clear();
	container = p_container;
    updateGenerateButtonCallback = updateBtnCallback;
    ensureQuillLoaded();
    ensureLeafletLoaded(); 

    logger.log('🔧 Initialisation de la Carte Interactive UI (Pilules & Menus Globaux)...');

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
            .styled-file-input::file-selector-button { border-radius: 19px; padding: 0 16px; height: 38px; margin-right: 12px; border: none; background: var(--hapi-grad-a); color: white; font-weight: bold; cursor: pointer; transition: opacity 0.2s; }
            .styled-file-input::file-selector-button:hover { opacity: 0.9; }
            .styled-file-input { font-size: 0.85em; width: 100%; color: var(--text-muted); background: transparent; line-height: 38px; }
        </style>
        <div id="map-wrapper" style="font-family:'Segoe UI', sans-serif;">
            
            <div class="section" style="background:var(--surface); padding:25px; border-radius:12px; margin-bottom:20px; border-left:6px solid var(--hapi-grad-a); box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                <div id="map-source-selector"></div>
                <div id="map-questions-repartition"></div>

                <h2 style="margin:20px 0 15px 0;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:var(--text); font-size: 1.4rem; font-weight: bold;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> Configuration de la carte interactive</h2>

                <div class="input-group" style="margin-bottom: 15px;">
                    <label style="font-weight:bold; display:block; margin-bottom:6px;">Sujet / Titre de la carte :</label>
                    <input type="text" id="map-subject" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px; box-sizing:border-box;">
                </div>

                <div style="background:var(--page-bg); padding:15px; border-radius:8px; border:1px solid var(--border); margin-bottom:20px;">
                    <label style="font-weight:bold; display:block; margin-bottom:6px;">Style de la carte (vue simple) :</label>
                    <select id="map-style" style="width:100%; padding:10px; border:1px solid var(--border-strong); border-radius:6px; box-sizing:border-box; outline:none;">
                        <option value="osm" selected>Plan classique (OSM)</option>
                        <option value="voyager">Plan clair (Carto)</option>
                        <option value="satellite">Vue satellite récente (Esri)</option>
                        <option value="topo">Topographie / Reliefs</option>
                        <option value="ign_1950">Photos aériennes (1950-1965)</option>
                        <option value="ign_cassini">Carte de Cassini (18e siècle)</option>
                    </select>
                </div>

                <div style="background:var(--page-bg); padding:15px; border-radius:8px; border:1px solid var(--border); margin-bottom:20px;">
                    <label style="font-weight:700; color: var(--hapi-accent-text); display:flex; align-items:center; gap:10px; cursor:pointer;">
                        <input type="checkbox" id="map-swipe-mode" style="width:18px; height:18px;">
                        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Activer le mode Comparaison (balayage avant / après)
                    </label>
                    <div id="swipe-options" style="display:none; grid-template-columns:1fr 1fr; gap:20px; margin-top:15px; padding-top:15px; border-top:1px dashed var(--border-strong);">
                        <div>
                            <label style="font-weight:600; font-size:0.9em;">Carte de gauche (Ex: ancienne)</label>
                            <select id="map-style-left" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px;">
                                <option value="ign_1950" selected>Photos aériennes IGN (1950-1965)</option>
                                <option value="ign_cassini">Carte de Cassini (18e siècle)</option>
                                <option value="satellite">Vue Satellite récente (Esri)</option>
                                <option value="osm">Plan classique (OSM)</option>
                                <option value="voyager">Plan clair (Carto)</option>
                                <option value="topo">Topographie / Reliefs</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-weight:600; font-size:0.9em;">Carte de droite (Ex: récente)</label>
                            <select id="map-style-right" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px;">
                                <option value="satellite" selected>Vue Satellite récente (Esri)</option>
                                <option value="osm">Plan classique (OSM)</option>
                                <option value="ign_1950">Photos aériennes IGN (1950-1965)</option>
                                <option value="ign_cassini">Carte de Cassini (18e siècle)</option>
                                <option value="voyager">Plan clair (Carto)</option>
                                <option value="topo">Topographie / Reliefs</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style="background:var(--page-bg); padding:15px; border-radius:8px; border:1px solid var(--border); margin-bottom:20px;">
                    <label style="font-weight:700; color: var(--hapi-accent-text); display:flex; align-items:center; gap:10px; cursor:pointer;">
                        <input type="checkbox" id="map-tour-mode" style="width:18px; height:18px;">
                        Activer le mode Visite virtuelle guidée
                    </label>
                    <div id="tour-options" style="display:none; grid-template-columns:1fr 1fr 1fr; gap:20px; margin-top:15px; padding-top:15px; border-top:1px dashed var(--border-strong);">
                        <div>
                            <label style="font-weight:600; font-size:0.9em;">Temps par repère (sec)</label>
                            <input type="number" id="tour-duration" value="6" min="3" max="60" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px;">
                        </div>
                        <div>
                            <label style="font-weight:600; font-size:0.9em;">Couleur du tracé</label>
                            <input type="color" id="tour-line-color" value="var(--hapi-green-dark)" style="width:100%; height:38px; padding:2px; border:1px solid var(--border); border-radius:6px;">
                        </div>
                        <div>
                            <label style="font-weight:600; font-size:0.9em;">Style du tracé</label>
                            <select id="tour-line-style" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px;">
                                <option value="dashed" selected>Pointillés</option>
                                <option value="solid">Ligne continue</option>
                                <option value="dotted">Petits points</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style="text-align:center; margin-top: 25px; padding-top: 20px; border-top: 2px dashed var(--border);">
                    <button id="btn-prep-map" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Générer et vérifier le prompt</button>
                </div>
            </div>

            <div id="ia-container-map" class="section" style="display:none; margin-bottom:20px; background:var(--surface); padding:25px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                ${creerAssistantIA_HTML('ia-prompt-map', 'ia-response-map')}
                <div id="albert-action-map" style="display: none; text-align: center; margin-top: 15px; margin-bottom: 30px;">
                    <button id="btn-send-albert-map" class="btn" style="padding: 10px 22px; font-size: 1em; font-weight:600; background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; cursor: pointer; border-radius: 25px; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); transition: all 0.2s ease;">
                        🇫🇷 Envoyer le prompt à l'IA
                    </button>
                </div>
                <div style="text-align:center; display:none;">
                    <button id="btn-parse-ia-response-map" class="btn"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg> Générer les repères</button>
                </div>
            </div>

            <div id="editor-map" style="display:none; background:var(--surface); padding:25px; border-radius:12px; margin-top:20px; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:2px solid var(--border); padding-bottom:10px;">
                    <h3 style="margin:0; color:var(--text);"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Éditez les repères géographiques</h3>
                    <span id="map-counter-badge" style="background:var(--hapi-green-pale); color:var(--hapi-accent-text); padding:5px 12px; border-radius:15px; font-weight:bold;">0</span>
                </div>

                <div style="background:var(--surface); padding:15px; border-radius:8px; border:1px solid var(--hapi-green-pale); margin-bottom:20px;">
                    <label style="font-size:0.85em; font-weight:700; color:var(--hapi-accent-text); display:block; margin-bottom:8px;">Texte d'introduction de la carte :</label>
                    <div style="background:var(--surface); margin-bottom:10px;">
                        <div id="quill-intro" style="height: 100px; font-family: sans-serif; font-size: 14px;"></div>
                    </div>
                    <textarea id="desc-hidden-intro" style="display:none;"></textarea>
                </div>

                <div id="map-markers-list"></div>
                <button id="btn-add-manual-map" style="display:block; margin:25px auto; padding:10px 25px; background:#4b5563; color:white; border-radius:20px; border:none; cursor:pointer; font-weight:600;">+ Ajouter un repère manuel</button>

            </div>
        </div>
    `;

    container.innerHTML = html;

	const selectorContainer = container.querySelector('#map-source-selector');
	    if (selectorContainer) {
	        localSourceSelector = new SourceSelector(selectorContainer, documentsList, 'map', (selectedDocs) => {
	            renderRepartitionConfigMap(selectedDocs);
	            showRegenerateButton(); // <-- NOUVEAU
	        });
	    }

    document.getElementById('btn-prep-map').addEventListener('click', handlePreparePrompt);
    document.getElementById('btn-send-albert-map').addEventListener('click', handleGenerateAlbertMap);
    document.getElementById('btn-parse-ia-response-map').addEventListener('click', handleParseResponse);
    document.getElementById('btn-add-manual-map').addEventListener('click', () => { addCard(); refreshMarkerIndices(); updateCounter(); });
    
    document.getElementById('map-swipe-mode').addEventListener('change', function(e) {
        const swipeOpts = document.getElementById('swipe-options');
        const normalStyle = document.getElementById('map-style');
        if (e.target.checked) {
            swipeOpts.style.display = 'grid';
            normalStyle.disabled = true;
        } else {
            swipeOpts.style.display = 'none';
            normalStyle.disabled = false;
        }
        forceRebuildAllMaps();
    });
    
    document.getElementById('map-tour-mode')?.addEventListener('change', function(e) {
        document.getElementById('tour-options').style.display = e.target.checked ? 'grid' : 'none';
        updateGenerateButtonCallback();
    });
    
    document.getElementById('tour-duration')?.addEventListener('input', updateGenerateButtonCallback);
    document.getElementById('tour-line-color')?.addEventListener('input', updateGenerateButtonCallback);
    document.getElementById('tour-line-style')?.addEventListener('change', updateGenerateButtonCallback);
    
    document.getElementById('map-style-left').addEventListener('change', forceRebuildAllMaps);
    document.getElementById('map-style-right').addEventListener('change', forceRebuildAllMaps);
    document.getElementById('map-style').addEventListener('change', forceRebuildAllMaps);

    // Sync Global Language to Map Tiles
    const globalLangSelect = document.getElementById('global-language');
    if (globalLangSelect) {
        globalLangSelect.addEventListener('change', (e) => {
            const nouvelleLangue = e.target.value;
            const styleActuel = document.getElementById('map-style')?.value || 'voyager';
            
            const getTileUrls = (langue) => {
                let osmUrl = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
                if (langue === 'German' || langue === 'Allemand') osmUrl = 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';
                else if (langue !== 'Français' && langue !== 'French') osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
                
                return {
                    'voyager': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
                    'osm': osmUrl,
                    'satellite': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
                    'topo': 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
                    'ign_cassini': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.CASSINI&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
                    'ign_1950': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS.1950-1965&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
                };
            };
            
            const newTileUrls = getTileUrls(nouvelleLangue); 
            const nouvelleUrl = newTileUrls[styleActuel] || newTileUrls['voyager'];

            document.querySelectorAll('[id^="map-"]').forEach(mapContainer => {
                if (mapContainer._leafletMap) {
                    mapContainer._leafletMap.eachLayer((layer) => {
                        if (layer instanceof L.TileLayer) {
                            mapContainer._leafletMap.removeLayer(layer);
                        }
                    });
                    L.tileLayer(nouvelleUrl, { maxZoom: 18 }).addTo(mapContainer._leafletMap);
                }
            });

            if (typeof updateGenerateButtonCallback === 'function') {
                updateGenerateButtonCallback();
            }
        });
    }
    
    function forceRebuildAllMaps() {
        const cards = document.querySelectorAll('.map-marker-card');
        cards.forEach(card => {
            const mapDivs = card.querySelectorAll('[id^="map-"]');
            mapDivs.forEach(mapDiv => {
                const uniqueId = mapDiv.id.replace('map-', '');
                const lat = parseFloat(document.getElementById(`lat-${uniqueId}`).value) || 46.2276;
                const lng = parseFloat(document.getElementById(`lng-${uniqueId}`).value) || 2.2137;
                const zoom = parseInt(document.getElementById(`zoom-${uniqueId}`).value) || 5;
                
                const newMapDiv = document.createElement('div');
                newMapDiv.id = mapDiv.id;
                newMapDiv.style.cssText = "height: 250px; width: 100%; margin-bottom: 10px; border-radius: 6px; border: 1px solid #ccc; z-index: 1;";
                mapDiv.parentNode.replaceChild(newMapDiv, mapDiv);
                
                initLeafletMap(uniqueId, lat, lng, zoom);
            });
        });
        updateGenerateButtonCallback();
    }
        
    setupDelegation();
	
	setTimeout(() => {
	        if (typeof initQuillEditor === 'function') {
	            initQuillEditor('intro', '', updateGenerateButtonCallback);

	            // --- INJECTION DES OUTILS AUDIO DANS LA TOOLBAR DE L'INTRO ---
	            setTimeout(() => {
	                const uniqueId = 'intro';
	                const quillContainer = document.getElementById(`quill-${uniqueId}`);
            
	                if (quillContainer && quillContainer.previousElementSibling && quillContainer.previousElementSibling.classList.contains('ql-toolbar')) {
	                    const toolbar = quillContainer.previousElementSibling;
                    
	                    // ✅ MÊME LOGIQUE FLEXBOX
	                    toolbar.style.display = 'flex';
						toolbar.style.flexWrap = 'wrap';
						toolbar.style.rowGap = '4px';
	                    toolbar.style.alignItems = 'center';
	                    toolbar.style.overflowX = 'visible';
	                    toolbar.style.paddingBottom = '6px';

	                    toolbar.querySelectorAll('.ql-formats').forEach(f => {
	                        f.style.flexShrink = '0';
	                        f.style.marginRight = '8px';
	                    });

	                    const audioGroup = document.createElement('span');
	                    audioGroup.className = 'ql-formats audio-toolbar-group';
	                    audioGroup.style.cssText = 'display:inline-flex; align-items:center; gap:6px; margin-left:4px; border-left:1px solid var(--border); padding-left:12px; flex-shrink: 0;';
                
	                    audioGroup.innerHTML = `
	                        <button type="button" class="btn-record-toolbar" data-id="${uniqueId}" style="width:auto !important; min-width:max-content; display:inline-flex; align-items:center; gap:4px; justify-content:center; box-sizing:border-box; height:24px; padding:0 6px !important; border-radius:3px; font-size:13px; font-weight:600 !important; color:var(--text); border:none; cursor:pointer; background:transparent; margin:0; line-height:1; white-space:nowrap; transition:color 0.2s;" onmouseover="this.style.color='var(--hapi-accent-text)'" onmouseout="this.style.color='var(--text)'" title="Enregistrer un audio"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/></svg> Enregistrer</button>
	                        <button type="button" class="btn-stop-toolbar" data-id="${uniqueId}" style="width:auto !important; min-width:max-content; display:none; align-items:center; gap:4px; justify-content:center; box-sizing:border-box; height:24px; padding:0 6px !important; border-radius:3px; font-size:13px; font-weight:600 !important; color:var(--danger-text); border:none; cursor:pointer; background:transparent; margin:0; line-height:1; white-space:nowrap; transition:color 0.2s;" onmouseover="this.style.color='var(--danger-text)'" onmouseout="this.style.color='var(--danger-text)'" title="Arrêter l'enregistrement"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1"/></svg> Stop</button>
	                        <label style="width:auto !important; min-width:max-content; display:inline-flex; align-items:center; gap:4px; justify-content:center; box-sizing:border-box; height:24px; padding:0 6px !important; border-radius:3px; font-size:13px; font-weight:600 !important; color:var(--text); border:none; cursor:pointer; background:transparent; margin:0; line-height:1; white-space:nowrap; transition:color 0.2s;" onmouseover="this.style.color='var(--hapi-accent-text)'" onmouseout="this.style.color='var(--text)'" title="Importer un fichier audio">
	                            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9l-.83-1.2A2 2 0 0 0 7.9 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg> Importer
	                            <input type="file" class="statement-audio-upload-toolbar" data-id="${uniqueId}" accept="audio/*" style="display:none;">
	                        </label>
	                        <div id="audio-preview-toolbar-${uniqueId}" style="display:inline-flex; align-items:center; flex-shrink:0;"></div>
	                    `;
	                    toolbar.appendChild(audioGroup);

	                    // --- RESTAURATION DE L'AUDIO DE L'INTRO À L'IMPORT ---
	                    const existingAudio = audioFiles.get(uniqueId);
	                    if (existingAudio && existingAudio.file) {
	                        updateMapAudioPreview(uniqueId, existingAudio.file);
	                    }
	                }
	            }, 150);
	        }
	    }, 150);

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

    // 2. Écouteurs sur le Sujet de la carte et la Répartition par source
    container.addEventListener('input', (e) => {
        if (e.target.id === 'map-subject' || 
            e.target.classList.contains('source-question-count')) {
            showRegenerateButton();
        }
    });


    // 🔴 BOUCLIER ANTI-BARRE DU BAS
    const enforceHideBottomBar = () => {
        const genSection = document.getElementById('generate-section');
        const cardsCount = document.querySelectorAll('#map-markers-list .map-marker-card').length;
        if (genSection && cardsCount < 1) {
            genSection.style.display = 'none';
        }
    };

    enforceHideBottomBar();
    setTimeout(enforceHideBottomBar, 50);

    const tabBtn = document.querySelector('.tab-btn[data-tab-target="map"]');
    if (tabBtn) {
        tabBtn.addEventListener('click', () => setTimeout(enforceHideBottomBar, 10));
    }
}


// ==========================================
// 5. GESTIONNAIRE DES ÉVÉNEMENTS GLOBAUX
// ==========================================

function setupDelegation() {
    // --- NOUVEAU : ÉCOUTEURS GLOBAUX POUR L'AUDIO (INTRO + REPÈRES) ---
    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-record-toolbar') || e.target.closest('.btn-record-toolbar')) {
            e.preventDefault();
            startMapRecording(e.target.closest('.btn-record-toolbar'));
        }

        if (e.target.classList.contains('btn-stop-toolbar') || e.target.closest('.btn-stop-toolbar')) {
            e.preventDefault();
            stopMapRecording();
        }

        if (e.target.classList.contains('btn-delete-audio-toolbar') || e.target.closest('.btn-delete-audio-toolbar')) {
            e.preventDefault();
            deleteMapAudio(e.target.closest('.btn-delete-audio-toolbar').dataset.id);
        }
    });

    container.addEventListener('change', (e) => {
        if (e.target.classList.contains('statement-audio-upload-toolbar')) {
            handleMapAudioUpload(e.target);
        }
    });
	
    const list = document.getElementById('map-markers-list');
    
    if (list) {
        list.addEventListener('click', async (e) => {
            const card = e.target.closest('.map-marker-card');
            if (!card) return;

            if (e.target.classList.contains('btn-toggle-media') || e.target.closest('.btn-toggle-media')) {
                e.preventDefault();
                const details = card.querySelector('.media-details');
                const creditsPanel = card.querySelector('.media-credits-panel');
                const urlInput = card.querySelector('.final-img-url');
                
                if (details) {
                    const isHidden = details.style.display === 'none' || details.style.display === '';
                    details.style.display = isHidden ? 'block' : 'none';
                    if (isHidden && creditsPanel) {
                        creditsPanel.style.display = 'block';
                        urlInput.focus();
                    }
                }
            }

            if (e.target.classList.contains('btn-edit-source') || e.target.closest('.btn-edit-source')) {
                e.preventDefault();
                const creditsPanel = card.querySelector('.media-credits-panel');
                const creditInput = card.querySelector('.final-img-credit');
                if (creditsPanel) {
                    creditsPanel.style.display = creditsPanel.style.display === 'none' ? 'block' : 'none';
                    if (creditsPanel.style.display === 'block' && creditInput) creditInput.focus();
                }
            }

            if (e.target.closest('.btn-wiki-search')) {
                const q = card.querySelector('.wiki-search-input').value.trim();
                if (q) triggerAutoSearch(card, q);
            }

            if (e.target.classList.contains('btn-del') || e.target.closest('.btn-del')) {
                if (confirm("Supprimer ce repère ?")) { 
                    const uniqueId = card.querySelector('[id^="map-"]')?.id.replace('map-', '');
                    const mapInst = document.getElementById(`map-${uniqueId}`)?._leafletMap;
                    if(mapInst) mapInst.remove();

					// Nettoyage de l'audio en mémoire
                    audioFiles.delete(uniqueId); // <-- AJOUT ICI

                    card.remove(); 
                    refreshMarkerIndices(); 
                    updateGenerateButtonCallback(); 
                }
            }
			
            if (e.target.classList.contains('btn-move-up') || e.target.closest('.btn-move-up')) {
                e.preventDefault();
                const prevCard = card.previousElementSibling;
                if (prevCard) {
                    card.parentNode.insertBefore(card, prevCard);
                    refreshMarkerIndices();
                    updateGenerateButtonCallback();
                }
            }

            if (e.target.classList.contains('btn-move-down') || e.target.closest('.btn-move-down')) {
                e.preventDefault();
                const nextCard = card.nextElementSibling;
                if (nextCard) {
                    card.parentNode.insertBefore(nextCard, card);
                    refreshMarkerIndices();
                    updateGenerateButtonCallback();
                }
            }

            if (e.target.classList.contains('btn-reset-card') || e.target.closest('.btn-reset-card')) {
                if (confirm("Voulez-vous vraiment réinitialiser ce repère avec les données initiales de l'IA ?")) {
                    const originalDataStr = card.dataset.original;
                    if (originalDataStr) {
                        const orig = JSON.parse(decodeURIComponent(originalDataStr));
                        
                        card.querySelector('.inp-title').value = orig.title || "";
                        card.querySelector('.inp-date').value = orig.date || "";
                        card.querySelector('.inp-text').value = orig.desc || "";
                        
                        const latInput = card.querySelector('.inp-lat');
                        const lngInput = card.querySelector('.inp-lng');
                        const zoomInput = card.querySelector('.inp-zoom');
                        
                        latInput.value = orig.lat !== undefined && orig.lat !== "" ? orig.lat : 46.2276;
                        lngInput.value = orig.lng !== undefined && orig.lng !== "" ? orig.lng : 2.2137;
                        if(zoomInput) zoomInput.value = orig.zoom !== undefined ? orig.zoom : 5;

                        const colorInput = card.querySelector('.inp-color');
                        if (colorInput) colorInput.value = orig.color || "var(--hapi-green-dark)";
                        
                        latInput.dispatchEvent(new Event('input', { bubbles: true }));

                        const mediaUrl = orig.img_url || "";
                        card.querySelector('.final-img-url').value = mediaUrl;
                        
                        const previewImg = card.querySelector('.selected-img-preview');
                        const previewIframe = card.querySelector('.selected-iframe-preview');
                        
                        if (mediaUrl.toLowerCase().startsWith('<iframe')) {
                            if (previewImg) previewImg.style.display = 'none';
                            if (previewIframe) previewIframe.style.display = 'flex';
                        } else {
                            if (previewIframe) previewIframe.style.display = 'none';
                            if (previewImg) {
                                previewImg.src = mediaUrl;
                                previewImg.style.display = mediaUrl ? 'block' : 'none';
                            }
                        }
                        
                        const removeBtn = card.querySelector('.btn-remove-img');
                        if (removeBtn) removeBtn.style.display = mediaUrl ? 'inline' : 'none';
                        
                        updateGenerateButtonCallback();
                    }
                }
            }

            if (e.target.classList.contains('btn-remove-img')) {
                e.preventDefault(); 
                card.querySelector('.final-img-url').value = ""; 
                const preview = card.querySelector('.selected-img-preview');
                const noPrev = card.querySelector('.no-img-preview');
                const iframePrev = card.querySelector('.selected-iframe-preview');
                const fileInput = card.querySelector('.inp-thumb-local');

                if (preview) preview.style.display = 'none'; 
                if (iframePrev) iframePrev.style.display = 'none';
                if (noPrev) noPrev.style.display = 'flex';
                if (fileInput) fileInput.value = '';

                e.target.style.display = 'none';
                updateGenerateButtonCallback();
            }
        });

        list.addEventListener('pointerdown', (e) => {
            const btn = e.target.closest('.btn-dms-toggle');
            if (!btn) return;
            
            e.preventDefault(); 
            const container = btn.closest('div'); 
            const input = container.querySelector('input');
            const isLng = input.classList.contains('inp-lng');
            const val = parseFloat(input.value.replace(',', '.'));
            
            if (isNaN(val)) return;

            const convertToDMS = (dd, isLongitude) => {
                const dir = dd < 0 ? (isLongitude ? 'O' : 'S') : (isLongitude ? 'E' : 'N');
                const absDd = Math.abs(dd);
                const deg = Math.floor(absDd);
                const minFloat = (absDd - deg) * 60;
                const min = Math.floor(minFloat);
                const sec = Math.round((minFloat - min) * 60);
                return `${deg}° ${min}' ${sec}" ${dir}`;
            };

            input.dataset.dd = input.value;
            input.value = convertToDMS(val, isLng);
            input.style.backgroundColor = 'rgba(34, 197, 94, 0.12)';
            input.style.color = 'var(--hapi-green-dark)';
            input.style.fontWeight = 'bold';

            const restoreDD = () => {
                if (input.dataset.dd !== undefined) {
                    input.value = input.dataset.dd;
                    delete input.dataset.dd;
                    input.style.backgroundColor = '';
                    input.style.color = '';
                    input.style.fontWeight = '';
                }
                window.removeEventListener('pointerup', restoreDD);
                btn.removeEventListener('pointerleave', restoreDD);
            };

            window.addEventListener('pointerup', restoreDD);
            btn.addEventListener('pointerleave', restoreDD);
        });

        list.addEventListener('change', (e) => {
            if (e.target.classList.contains('inp-thumb-local')) {
                const file = e.target.files[0];
                const card = e.target.closest('.map-marker-card');
                if (file && card) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        const thumbImg = card.querySelector('.selected-img-preview');
                        const iframePrev = card.querySelector('.selected-iframe-preview');
                        const noPrev = card.querySelector('.no-img-preview');
                        const urlInput = card.querySelector('.final-img-url');
                        const mediaDetails = card.querySelector('.media-details');
                        const creditsPanel = card.querySelector('.media-credits-panel');
                        const creditInput = card.querySelector('.final-img-credit');
                        const removeBtn = card.querySelector('.btn-remove-img');

                        if (thumbImg) {
                            thumbImg.src = evt.target.result;
                            thumbImg.style.display = 'block';
                            if (iframePrev) iframePrev.style.display = 'none';
                            if (noPrev) noPrev.style.display = 'none';
                            
                            if (urlInput) urlInput.value = evt.target.result; 
                            if (mediaDetails) mediaDetails.style.display = 'none'; 
                            if (removeBtn) removeBtn.style.display = 'inline';
                            
                            if (creditsPanel) creditsPanel.style.display = 'block';
                            if (creditInput) creditInput.focus();
                            
                            updateGenerateButtonCallback();
                        }
                    };
                    reader.readAsDataURL(file);
                }
            }
        });

        const handleMapUpdate = (e) => {
            if (e.target.classList.contains('final-img-url')) {
                const val = e.target.value.trim();
                const card = e.target.closest('.map-marker-card');
                const previewImg = card.querySelector('.selected-img-preview');
                const previewIframe = card.querySelector('.selected-iframe-preview');
                const noPreview = card.querySelector('.no-img-preview'); 

                if (val.toLowerCase().startsWith('<iframe')) {
                    if(previewImg) previewImg.style.display = 'none';
                    if(previewIframe) previewIframe.style.display = 'flex';
                    if(noPreview) noPreview.style.display = 'none';
                } else if (val) {
                    if(previewIframe) previewIframe.style.display = 'none';
                    if(noPreview) noPreview.style.display = 'none';
                    if(previewImg) {
                        previewImg.src = val;
                        previewImg.style.display = 'block';
                    }
                } else {
                    if(previewIframe) previewIframe.style.display = 'none';
                    if(previewImg) previewImg.style.display = 'none';
                    if(noPreview) noPreview.style.display = 'flex';
                }
            }

            if (e.target.classList.contains('inp-lat') || e.target.classList.contains('inp-lng') || e.target.classList.contains('inp-zoom') || e.target.classList.contains('inp-color')) {
                const card = e.target.closest('.map-marker-card');
                const mapDiv = card.querySelector('[id^="map-"]'); 
                
                if (mapDiv && mapDiv._leafletMap && mapDiv._leafletMarker) {
                    const latVal = card.querySelector('.inp-lat').value.replace(',', '.');
                    const lngVal = card.querySelector('.inp-lng').value.replace(',', '.');
                    const lat = parseFloat(latVal);
                    const lng = parseFloat(lngVal);
                    const zoom = parseInt(card.querySelector('.inp-zoom').value) || 12;
                    const color = card.querySelector('.inp-color').value;

                    if (!isNaN(lat) && !isNaN(lng)) {
                        mapDiv._leafletMarker.setLatLng([lat, lng]);
                        mapDiv._leafletMarker.setIcon(mapDiv._getIcon(color));
                        
                        if (e.target.classList.contains('inp-zoom')) {
                            mapDiv._leafletMap.setView([lat, lng], zoom);
                        } else {
                            mapDiv._leafletMap.panTo([lat, lng]);
                        }
                    }
                }
            }

            if(!e.target.classList.contains('inp-lat') && !e.target.classList.contains('inp-lng') && !e.target.classList.contains('inp-zoom')) {
                updateGenerateButtonCallback();
            }
        };

        list.addEventListener('input', handleMapUpdate);
        list.addEventListener('change', handleMapUpdate);
    }
}


// ==========================================
// 6. SOUMISSION DES DONNÉES ET PARSING IA
// ==========================================

async function handleParseResponse() {
    const raw = document.getElementById('ia-response-map').value;
    let json;
    
    try {
        let jsonStr = raw.trim();
        const startIdx = jsonStr.indexOf('{');
        const endIdx = jsonStr.lastIndexOf('}');
        json = JSON.parse(jsonStr.substring(startIdx, endIdx + 1));
    } catch(e) { alert("Format JSON invalide."); return; }

	if (json.intro) {
        const safeIntro = sanitizeRichHtml(json.intro); // anti self-XSS : intro importé collé dans Quill
        const introQuillDiv = document.getElementById('quill-intro');
        if (introQuillDiv && introQuillDiv.__quill) {
            introQuillDiv.__quill.clipboard.dangerouslyPasteHTML(safeIntro);
        } else {
            document.getElementById('desc-hidden-intro').value = safeIntro;
        }
    }

    const list = document.getElementById('map-markers-list');
    if (list) list.innerHTML = '';
    
    const markers = json.markers || [];
    for (const item of markers) {
        const card = addCard(item);
        const searchQuery = item.image_query || item.title || "";
        if (searchQuery && card) {
            const wikiInput = card.querySelector('.wiki-search-input');
            if (wikiInput) wikiInput.value = searchQuery;
            triggerAutoSearch(card, searchQuery);
        }
    }
    
    refreshMarkerIndices();

    document.getElementById('editor-map').style.display = 'block';

	if(document.getElementById('generate-section')) {
        document.getElementById('generate-section').style.display = 'block';
        const btnGen = document.getElementById('generate-button');
        if (btnGen) btnGen.style.display = 'inline-block';
    }
    updateCounter();
    updateGenerateButtonCallback();
}

// =========================================================
// 💾 GESTION IMPORT / EXPORT (déléguée à utils/states/interactive-map-state.js)
// =========================================================

export function getUIState() {
    return getInteractiveMapState(audioFiles); // On repasse en synchrone !
}

export function setUIState(config) {
    setInteractiveMapState(config, {
        clearPreview: () => {
            const list = document.getElementById('map-markers-list');
            if (list) list.innerHTML = '';
            for (const key of audioFiles.keys()) {
                if (key !== 'intro') audioFiles.delete(key);
            }
        },
        addCard: (data) => {
            const card = addCard(data); 
            if (card) {
                const captionInput = card.querySelector('.inp-caption');
                if (captionInput && data.caption) captionInput.value = data.caption;
                const urlInput = card.querySelector('.final-img-url');
                if (urlInput) urlInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        },
        restoreIntroAudio: (audioData) => {
            audioFiles.set('intro', audioData);
            const preview = document.getElementById('audio-preview-toolbar-intro');
            if (preview && audioData && audioData.file) {
                updateMapAudioPreview('intro', audioData.file);
            }
        },
        updateGlobal: () => {
            refreshMarkerIndices();
            updateCounter();
            updateGenerateButtonCallback();
        }
    });
}

// ==========================================
// 7. EXPORTATION DES DONNÉES
// ==========================================

export function gatherData() {
    const cards = document.querySelectorAll('.map-marker-card');
    if (cards.length === 0) return null;
    
    const subject = document.getElementById('map-subject')?.value.trim() || "Carte Interactive";
    const introText = document.getElementById('desc-hidden-intro')?.value.trim() || "";
    const introAudio = audioFiles.get('intro') || null; 
    
    const mapStyle = document.getElementById('map-style')?.value || "osm";
    const isSwipeMode = document.getElementById('map-swipe-mode')?.checked || false;
    const styleLeft = document.getElementById('map-style-left')?.value || "ign_1950";
    const styleRight = document.getElementById('map-style-right')?.value || "satellite";
    const isTourMode = document.getElementById('map-tour-mode')?.checked || false;
    const tourDuration = parseInt(document.getElementById('tour-duration')?.value) || 6;
    const tourLineColor = document.getElementById('tour-line-color')?.value || "var(--hapi-green-dark)";
    const tourLineStyle = document.getElementById('tour-line-style')?.value || "dashed";
    
    const items = [];
    
    cards.forEach(card => {
        const lat = parseFloat(card.querySelector('.inp-lat')?.value.trim());
        const lng = parseFloat(card.querySelector('.inp-lng')?.value.trim());
        const zoom = parseInt(card.querySelector('.inp-zoom')?.value.trim()) || 12;
        const title = card.querySelector('.inp-title')?.value.trim();
        const color = card.querySelector('.inp-color')?.value || "var(--hapi-green-dark)"; 
        
        if (isNaN(lat) || isNaN(lng) || !title) return; 

        const imgUrl = card.querySelector('.final-img-url')?.value.trim() || "";
        const isIframe = imgUrl.toLowerCase().startsWith('<iframe');

        const mapDiv = card.querySelector('[id^="map-"]');
        const uniqueId = mapDiv ? mapDiv.id.replace('map-', '') : null;
        const audioFile = uniqueId ? audioFiles.get(uniqueId) : null;

        items.push({
            lat: lat,
            lng: lng,
            zoom: zoom,
            title: title,
            date: card.querySelector('.inp-date')?.value.trim() || "",
            desc: card.querySelector('.inp-text')?.value.trim() || "",
            img_url: imgUrl,
            color: color,
            isIframe: isIframe,
            credit: card.querySelector('.final-img-credit')?.value.trim() || "",
            caption: card.querySelector('.inp-caption')?.value.trim() || "",
            audio: audioFile ? audioFile.file : null 
        });
    });

    const langueProf = document.getElementById('global-language')?.value || 'Français';
    

    return {
        titre: subject,
        intro: introText,
        introAudio: introAudio ? introAudio.file : null, 
        langue: langueProf,
        style: mapStyle,
        isSwipeMode: isSwipeMode,
        styleLeft: styleLeft,
        styleRight: styleRight,
        isTourMode: isTourMode,       
        tourDuration: tourDuration,   
        tourLineColor: tourLineColor, 
        tourLineStyle: tourLineStyle,
        markers: items
    };
}


function showRegenerateButton() {
    const iaContainer = document.getElementById('ia-container-map');
    const btnPrepare = document.getElementById('btn-prep-map');

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


// ==========================================
// 8. MOTEUR LIGHTBOX VIGNETTE NATIVE
// ==========================================

(function initInternalLightbox() {
    window.openPreviewLightbox = function(imgSrc) {
        const lb = document.getElementById('h5p-ia-lightbox');
        const lbImg = document.getElementById('h5p-ia-lightbox-content');
        if (lb && lbImg && imgSrc) { 
            lbImg.src = imgSrc;
            lb.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    window.closePreviewLightbox = function() {
        const lb = document.getElementById('h5p-ia-lightbox');
        if (lb) {
            lb.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    if (!document.getElementById('internal-lightbox-style')) {
        const style = document.createElement('style');
        style.id = 'internal-lightbox-style';
        style.textContent = `
            #h5p-ia-lightbox {
                display: none; position: fixed; z-index: 999999; left: 0; top: 0; width: 100%; height: 100%;
                overflow: hidden; background-color: rgba(0,0,0,0.85); backdrop-filter: blur(5px);
                align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease;
            }
            #h5p-ia-lightbox.active { display: flex; opacity: 1; }
            #h5p-ia-lightbox-content {
                max-width: 90%; max-height: 90%; box-shadow: 0 5px 25px rgba(0,0,0,0.5);
                border-radius: 8px; border: 4px solid white; transform: scale(0.9); transition: transform 0.3s ease;
            }
            #h5p-ia-lightbox.active #h5p-ia-lightbox-content { transform: scale(1); }
            #h5p-ia-lightbox-close {
                position: absolute; top: 20px; right: 30px; color: white; font-size: 40px;
                font-weight: bold; cursor: pointer; transition: color 0.2s; font-family: Arial, sans-serif;
            }
            #h5p-ia-lightbox-close:hover { color: #cbd5e1; }
        `;
        document.head.appendChild(style);
    }

    if (!document.getElementById('h5p-ia-lightbox')) {
        const lb = document.createElement('div');
        lb.id = 'h5p-ia-lightbox';
        lb.innerHTML = `
            <span id="h5p-ia-lightbox-close">&times;</span>
            <img id="h5p-ia-lightbox-content" src="">
        `;
        document.body.appendChild(lb);

        lb.addEventListener('click', (e) => { if (e.target.id !== 'h5p-ia-lightbox-content') window.closePreviewLightbox(); });
        document.getElementById('h5p-ia-lightbox-close').addEventListener('click', window.closePreviewLightbox);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lb.classList.contains('active')) window.closePreviewLightbox(); });
    }
})();