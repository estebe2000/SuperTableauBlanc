// Fichier: modules/corpus/corpus-manager.js
// MIS À JOUR : Filtrage DOCX/TXT et routage OCR vs Parsing pour Albert
// MIS À JOUR v1.4 : Compression d'image côté client + alertes de modération pédagogique

import { logger } from '../utils/logger.js';
import { readFileContent } from './file-parsers.js';

let corpusSources = [];
// Messages d'erreur de la dernière construction de corpus (transcription/extraction
// en échec). Permet à l'UI d'afficher un message clair et de rester à l'étape 1.
let lastBuildErrors = [];
const PROXY_BASE = 'https://nshapiproxyadd10448-hapi-proxy.functions.fnc.fr-par.scw.cloud/proxy';
// La transcription vidéo passe par n8n (et non plus en direct sur le proxy) :
// le credential httpHeaderAuth du workflow injecte la clé Albert vers le proxy,
// qui la relaie à Whisper. Ainsi aucun secret ne vit sur la fonction Scaleway.
// ⚠️ Le workflow doit renvoyer resolved_url (cf. nœud "Normalise réponse").
const N8N_TRANSCRIBE_WEBHOOK = (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-n8n/webhook/hapi_video_transcribe';

// ── Helpers privés ────────────────────────────────────────────────────────────
function _shortUrl(url) {
    try { const u = new URL(url); return u.hostname + u.pathname.slice(0, 40); }
    catch { return url.slice(0, 50); }
}

function _shortVideoName(url) {
    try {
        const u   = new URL(url);
        const vid = u.searchParams.get('v');
        if (vid) return `YouTube — ${vid}`;
        const seg = u.pathname.split('/').filter(Boolean);
        return `Vidéo — ${seg[seg.length - 1] || u.hostname}`;
    } catch { return `Vidéo — ${url.substring(0, 40)}`; }
}

async function _fetchPageSource(url) {
    const resp = await fetch(`${PROXY_BASE}/page`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data.text?.trim()) throw new Error('Page vide ou non parsable');
    return data;
}

async function _fetchVideoSource(url, lang = 'fr') {
    // Transcription routée via n8n : c'est le credential du workflow qui porte
    // la clé Albert. Le proxy reste appelé en direct ailleurs (résolution MP4,
    // streaming) car ces opérations n'ont pas besoin d'Albert.
    const resp = await fetch(N8N_TRANSCRIBE_WEBHOOK, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url, lang })
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
    }
    return await resp.json();
}

// ── 🗜️ Compression d'image côté client ────────────────────────────────────────
// Évite les erreurs "Request too large" en aval (base64 +33% sur le payload n8n)
// Paramètres :
//   maxWidth        → largeur cible (preserve ratio)
//   maxSizeBytes    → poids cible (compression itérative)
//   initialQuality  → qualité JPEG de départ
//   forceCompress   → si true, compresse même si déjà sous la limite (utile pour thumbnail)
async function _compressImageIfNeeded(file, maxWidth = 2000, maxSizeBytes = 2 * 1024 * 1024, initialQuality = 0.85, forceCompress = false) {
    // Si pas une image, on retourne tel quel
    if (!file.type?.startsWith('image/')) {
        return file;
    }
    // Si déjà assez petit ET pas de forçage, on retourne tel quel
    if (!forceCompress && file.size <= maxSizeBytes) {
        return file;
    }

    logger.log(`[Compression] Image ${(file.size/1024/1024).toFixed(2)} Mo → cible ${maxWidth}px / ${(maxSizeBytes/1024/1024).toFixed(2)} Mo...`);

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // Calcul des nouvelles dimensions (préserve le ratio)
            let { width, height } = img;
            if (width > maxWidth) {
                height = Math.round((maxWidth / width) * height);
                width = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // Fond blanc (utile si PNG transparent ou photo manuscrite)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            // Compression JPEG itérative jusqu'à atteindre la cible
            let quality = initialQuality;
            const tryCompress = () => {
                canvas.toBlob((blob) => {
                    if (!blob) return reject(new Error('Échec compression canvas'));

                    if (blob.size <= maxSizeBytes || quality <= 0.35) {
                        // On reconstruit un Blob "name-able" compatible avec FormData
                        const newName = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
                        const compressed = new Blob([blob], { type: 'image/jpeg' });
                        compressed.name = newName;
                        logger.log(`[Compression] → ${(compressed.size/1024).toFixed(0)} Ko (qualité ${quality.toFixed(2)}, ${width}×${height}px)`);
                        resolve(compressed);
                    } else {
                        quality -= 0.1;
                        tryCompress();
                    }
                }, 'image/jpeg', quality);
            };
            tryCompress();
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Image illisible pour compression'));
        };
        img.src = url;
    });
}

// ── 🛡️ Alertes de modération pédagogique ─────────────────────────────────────
let _moderationStylesInjected = false;

function _injectModerationStyles() {
    if (_moderationStylesInjected) return;
    _moderationStylesInjected = true;

    const style = document.createElement('style');
    style.id = 'hapi-moderation-styles';
    style.textContent = `
        /* ── Toast d'avertissement modération ──────────────────────── */
        .hapi-moderation-toast {
            position: fixed;
            top: 24px;
            right: 24px;
            max-width: 420px;
            background: rgba(234, 88, 12, 0.10);
            border: 1px solid #fb923c;
            border-left: 6px solid #ea580c;
            border-radius: 12px;
            padding: 18px 20px;
            display: flex;
            gap: 14px;
            align-items: flex-start;
            box-shadow: 0 10px 30px rgba(234, 88, 12, 0.18);
            z-index: 10000;
            opacity: 0;
            transform: translateX(100px);
            transition: opacity 0.3s ease, transform 0.3s ease;
            font-family: 'Marianne', system-ui, -apple-system, sans-serif;
        }
        .hapi-moderation-toast.hapi-mod-visible {
            opacity: 1;
            transform: translateX(0);
        }
        .hapi-mod-icon {
            font-size: 1.8rem;
            flex-shrink: 0;
            line-height: 1;
        }
        .hapi-mod-content { flex: 1; min-width: 0; }
        .hapi-mod-title {
            font-weight: 700;
            color: var(--warning-text);
            margin-bottom: 4px;
            font-size: 0.95rem;
        }
        .hapi-mod-text {
            color: var(--warning-text);
            font-size: 0.88rem;
            line-height: 1.45;
            margin-bottom: 6px;
        }
        .hapi-mod-hint {
            color: var(--warning-text);
            font-size: 0.78rem;
            font-style: italic;
            opacity: 0.85;
        }
        .hapi-mod-close {
            background: none;
            border: none;
            color: var(--warning-text);
            font-size: 1.4rem;
            cursor: pointer;
            padding: 0 4px;
            line-height: 1;
            flex-shrink: 0;
            opacity: 0.7;
            transition: opacity 0.2s;
        }
        .hapi-mod-close:hover { opacity: 1; }

        /* ── Modale de blocage modération ──────────────────────────── */
        .hapi-moderation-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(6px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            opacity: 0;
            transition: opacity 0.3s ease;
            font-family: 'Marianne', system-ui, -apple-system, sans-serif;
        }
        .hapi-moderation-overlay.hapi-mod-visible { opacity: 1; }
        .hapi-moderation-modal {
            background: var(--surface);
            border-radius: 20px;
            padding: 36px 32px;
            max-width: 480px;
            width: calc(100% - 40px);
            text-align: center;
            box-shadow: 0 25px 70px rgba(0, 0, 0, 0.35);
            transform: scale(0.92);
            transition: transform 0.3s ease;
        }
        .hapi-moderation-overlay.hapi-mod-visible .hapi-moderation-modal {
            transform: scale(1);
        }
        .hapi-mod-block-icon {
            font-size: 3.5rem;
            margin-bottom: 12px;
            filter: drop-shadow(0 4px 8px rgba(220, 38, 38, 0.25));
        }
        .hapi-mod-block-title {
            color: var(--danger-text);
            font-size: 1.5rem;
            font-weight: 700;
            margin: 0 0 12px 0;
        }
        .hapi-mod-block-text {
            color: var(--text-muted);
            font-size: 1rem;
            line-height: 1.5;
            margin-bottom: 20px;
        }
        .hapi-mod-block-reason {
            background: rgba(220, 38, 38, 0.10);
            border: 1px solid rgba(220, 38, 38, 0.35);
            border-radius: 10px;
            padding: 12px 16px;
            color: var(--danger-text);
            font-size: 0.88rem;
            text-align: left;
            margin-bottom: 18px;
        }
        .hapi-mod-block-hint {
            background: linear-gradient(135deg, var(--hapi-green-mist) 0%, var(--hapi-green-pale) 100%);
            border: 1px solid rgba(var(--hapi-green-rgb), 0.45);
            border-radius: 10px;
            padding: 14px 16px;
            color: var(--hapi-accent-text);
            font-size: 0.9rem;
            line-height: 1.45;
            margin-bottom: 24px;
            text-align: left;
        }
        .hapi-mod-block-btn {
            background: linear-gradient(135deg, var(--hapi-grad-a) 0%, var(--hapi-green-dark) 100%);
            color: white;
            border: none;
            border-radius: 10px;
            padding: 12px 32px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            font-family: inherit;
        }
        .hapi-mod-block-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(var(--hapi-green-rgb), 0.35);
        }
    `;
    document.head.appendChild(style);
}

function _showModerationWarning(data) {
    _injectModerationStyles();

    const toast = document.createElement('div');
    toast.className = 'hapi-moderation-toast';
    toast.innerHTML = `
        <div class="hapi-mod-icon"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg></div>
        <div class="hapi-mod-content">
            <div class="hapi-mod-title">Contenu sensible détecté</div>
            <div class="hapi-mod-text"></div>
            <div class="hapi-mod-hint">L'analyse a été autorisée en raison de la valeur pédagogique reconnue.</div>
        </div>
        <button class="hapi-mod-close" aria-label="Fermer">&times;</button>
    `;
    // Sécurité XSS : on injecte le texte via textContent, pas innerHTML
    toast.querySelector('.hapi-mod-text').textContent = data.warning || 'Contenu signalé par le filtre pédagogique.';
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('hapi-mod-visible'));

    const closeFn = () => {
        toast.classList.remove('hapi-mod-visible');
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
    };

    toast.querySelector('.hapi-mod-close').addEventListener('click', closeFn);
    //setTimeout(closeFn, 8000); // auto-fermeture

    // Tracking Matomo (si dispo)
    if (window._paq) {
        window._paq.push(['trackEvent', 'HAPI - IA Albert', 'Modération - Avertissement',
            data.moderation_reason || data.warning || 'Contenu sensible pédagogique']);
    }

    logger.log('[Modération] Contenu sensible autorisé :', data.warning);
}

function _showModerationBlock(errData) {
    _injectModerationStyles();

    const overlay = document.createElement('div');
    overlay.className = 'hapi-moderation-overlay';
    overlay.innerHTML = `
        <div class="hapi-moderation-modal">
            <div class="hapi-mod-block-icon"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg></div>
            <h2 class="hapi-mod-block-title">Image non autorisée</h2>
            <p class="hapi-mod-block-text">
                Cette image n'est pas adaptée à un usage scolaire et a été bloquée
                par le filtre de sécurité pédagogique.
            </p>
            <div class="hapi-mod-block-reason">
                <strong>Raison :</strong> <span class="hapi-mod-reason-text"></span>
            </div>
            <div class="hapi-mod-block-hint">
                <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5A7 7 0 1 0 5 9c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/></svg> Essaie avec une œuvre d'art, un schéma, un document historique
                ou une photo à vocation éducative.
            </div>
            <button class="hapi-mod-block-btn">J'ai compris</button>
        </div>
    `;
    // Sécurité XSS : textContent
    overlay.querySelector('.hapi-mod-reason-text').textContent =
        errData?.reason || 'Contenu inapproprié détecté';
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('hapi-mod-visible'));

    const closeFn = () => {
        overlay.classList.remove('hapi-mod-visible');
        setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 300);
    };
    overlay.querySelector('.hapi-mod-block-btn').addEventListener('click', closeFn);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFn(); });

    // Tracking Matomo
    if (window._paq) {
        window._paq.push(['trackEvent', 'HAPI - IA Albert', 'Modération - Blocage',
            errData?.verdict?.categorie || errData?.reason || 'inconnu']);
    }

    logger.error('[Modération] Image bloquée :', errData);
}

// ── Fonctions Publiques ───────────────────────────────────────────────────────
function getCorpusSources() { return corpusSources; }

function getFirstVideoSource() {
    return corpusSources.find(s => s.type === 'video' || s.type === 'video-pending');
}

function getCorpusStats() {
    const totalQuestions = corpusSources.reduce((sum, s) => sum + (s.questionCount || 0), 0);
    return {
        count:          corpusSources.length,
        totalQuestions,
        highPriority:   corpusSources.filter(s => s.priority === 3).length,
        mediumPriority: corpusSources.filter(s => s.priority === 2).length,
        lowPriority:    corpusSources.filter(s => s.priority === 1).length
    };
}

async function addSource(type, textInput, fileInput, urlInput) {
    let sourcesToAdd = [];

    if (type === 'text' && textInput && textInput.value.trim() !== '') {
        sourcesToAdd.push({
            id:            `source-${Date.now()}`,
            type:          'text',
            name:          `Texte collé (${textInput.value.substring(0, 40)}...)`,
            data:          textInput.value,
            priority:      2,
            questionCount: 2
        });
        textInput.value = '';

    } else if (type === 'file' && fileInput && fileInput.files.length > 0) {
        for (const file of fileInput.files) {
            const buffer   = await file.arrayBuffer();
            const safeBlob = new Blob([buffer], { type: file.type });
            safeBlob.name  = file.name;
            sourcesToAdd.push({
                id:            `source-${Date.now()}-${file.name}`,
                type:          'file',
                name:          file.name,
                data:          safeBlob,
                priority:      2,
                questionCount: 2
            });
        }
        fileInput.value = '';

    } else if (type === 'url' && urlInput && urlInput.value.trim() !== '') {
        const raw = urlInput.value.trim();
        if (!/^https?:\/\//i.test(raw)) {
            alert('URL invalide — elle doit commencer par http:// ou https://');
            return 0;
        }
        const isVideo = /youtube\.com|youtu\.be|podeduc\.apps\.education\.fr|reseau-canope\.fr/.test(raw);
        sourcesToAdd.push({
            id:            `source-${Date.now()}`,
            type:          isVideo ? 'video-pending' : 'web-pending',
            name:          isVideo ? _shortVideoName(raw) : _shortUrl(raw),
            url:           raw,
            priority:      2,
            questionCount: 2
        });
        urlInput.value = '';
    }

    if (sourcesToAdd.length > 0) {
        corpusSources.push(...sourcesToAdd);
        logger.log(`➕ ${sourcesToAdd.length} source(s) ajoutée(s) au corpus.`);
    }
    return sourcesToAdd.length;
}

function removeSource(sourceId) {
    corpusSources = corpusSources.filter(s => s.id !== sourceId);
}

function updateSourcePriority(sourceId, priority) {
    const source = corpusSources.find(s => s.id === sourceId);
    if (source) source.priority = parseInt(priority, 10);
}

function updateSourcePageRange(sourceId, pageRange) {
    const source = corpusSources.find(s => s.id === sourceId);
    if (source) source.pageRange = pageRange.trim();
}

function updateQuestionCount(sourceId, count) {
    const source = corpusSources.find(s => s.id === sourceId);
    if (source) source.questionCount = parseInt(count, 10) || 0;
}

function reorderSources(newIdOrder) {
    const newOrder = [];
    newIdOrder.forEach(id => {
        const s = corpusSources.find(s => s.id === id);
        if (s) newOrder.push(s);
    });
    corpusSources = newOrder;
}

// 🌟 MIS A JOUR Envoi dun paramètre "endpoint" pour router la requête dans n8n
// 🌟 AJOUT DU PARAMÈTRE 'mode' AVEC 'ocr' PAR DÉFAUT
// 🌟 v1.4 : Compression image préventive + gestion 403 modération + capture warning
// 🌟 v1.5 : Double-version (thumbnail légère pour modération + version OCR plus lourde)
async function _fetchAlbertOcr(blob, isPdf = false, mode = 'ocr') {
    let payloadBlob = blob;
    let thumbnailBlob = null;

    // 🗜️ Pour les images : on génère DEUX versions
    //    - thumbnailBlob (≤ 800px, JPEG 0.6 → ~150-300 Ko) pour la modération IA
    //    - payloadBlob (≤ 2000px, JPEG 0.85 → ~1-2 Mo) pour l'OCR final
    if (!isPdf && blob.type?.startsWith('image/')) {
        try {
            // Version OCR (qualité préservée pour lire le texte)
            payloadBlob = await _compressImageIfNeeded(blob, 2000, 2 * 1024 * 1024, 0.85, false);
            if (blob.pageRange && !payloadBlob.pageRange) payloadBlob.pageRange = blob.pageRange;
            if (!payloadBlob.name) payloadBlob.name = blob.name || 'image.jpg';

            // Version Modération (basse résolution forcée — l'IA n'a pas besoin de détail)
            thumbnailBlob = await _compressImageIfNeeded(blob, 800, 300 * 1024, 0.6, true);
            // Renommage explicite pour distinguer côté n8n
            thumbnailBlob.name = 'thumbnail.jpg';
        } catch (compressionErr) {
            logger.warn('[Compression] Échec, envoi de l\'original :', compressionErr.message);
            payloadBlob = blob;
            thumbnailBlob = null;
        }
    }

    const formData = new FormData();
    formData.append("file", payloadBlob, payloadBlob.name || blob.name);

    // 🛡️ Ajout de la thumbnail pour la modération (champ séparé)
    if (thumbnailBlob) {
        formData.append("thumbnail", thumbnailBlob, thumbnailBlob.name);
    }

    if (payloadBlob.pageRange || blob.pageRange) {
        formData.append("pages", payloadBlob.pageRange || blob.pageRange);
    }

    // Informe n8n s'il doit taper sur /parse ou /ocr
    formData.append("endpoint", isPdf ? "parse" : "ocr");

    // 🟢 On transmet le mode ('ocr' ou 'analyse') à n8n
    formData.append("mode", mode);

    const resp = await fetch((typeof window !== 'undefined' ? window.location.origin : '') + "/proxy-n8n/webhook/hapi-ocr", {
        method: "POST",
        body: formData
    });

    // 🛡️ Gestion explicite du blocage modération (HTTP 403)
    if (resp.status === 403) {
        const errData = await resp.json().catch(() => ({}));
        _showModerationBlock(errData);
        throw new Error(`MODERATION_BLOCKED: ${errData.reason || 'Image inappropriée'}`);
    }

    if (!resp.ok) throw new Error(`Albert API HTTP ${resp.status}`);

    const data = await resp.json();
    if (!data.text?.trim()) throw new Error("Extraction vide");

    // ⚠️ Affichage d'un avertissement si contenu sensible mais pédagogiquement autorisé
    if (data.warning) {
        _showModerationWarning(data);
    }

    return data.text;
}

async function buildFinalCorpus(onProgressUpdate = null) {
    let masterContent = '';
    let hasErrors     = false;
    lastBuildErrors   = [];
    const total       = corpusSources.length;

    for (let i = 0; i < total; i++) {
        const source      = corpusSources[i];
        const basePercent = (i / total) * 100;
        const nextPercent = ((i + 1) / total) * 100;

        try {
            let content = '';

            const runWithFakeProgress = async (label, speedMs, task) => {
                let current = Math.floor(basePercent);
                const max = Math.floor(nextPercent) - 1;
                let isTaskDone = false;
                if (onProgressUpdate) onProgressUpdate(current, label);
                const timer = setInterval(() => {
                    if (!isTaskDone && current < max) {
                        current++;
                        if (onProgressUpdate) onProgressUpdate(current, label);
                    }
                }, speedMs);
                try {
                    const result = await task();
                    isTaskDone = true;
                    clearInterval(timer);
                    while (current < max) {
                        current += Math.ceil((max - current) / 4);
                        if (current > max) current = max;
                        if (onProgressUpdate) onProgressUpdate(current, label);
                        await new Promise(r => setTimeout(r, 30));
                    }
                    return result;
                } catch (err) { clearInterval(timer); throw err; }
            };

            // ── CAS : FICHIERS ──
            if (source.type === 'file') {
                content = await runWithFakeProgress(`Analyse : ${source.name}`, 200, async () => {
                    // 1. Extraction locale (instantanée pour DOCX/TXT, ou via Tesseract/PDF.js)
                    let localResult = await readFileContent(source.data, (p) => {
                        const gp = Math.floor(basePercent + (p / 100) * (nextPercent - basePercent) * 0.5);
                        if (onProgressUpdate) onProgressUpdate(gp, `Lecture locale : ${source.name}`);
                    });

                    // 2. Détection du type pour le workflow visuel
                    const fileName = source.name.toLowerCase();
                    const fileType = source.data.type || '';
                    
                    const isPdf = fileName.endsWith('.pdf') || fileType === 'application/pdf';
                    const isImage = fileName.match(/\.(jpe?g|png|gif|webp)$/) || fileType.startsWith('image/');
                    
                    let validatedText = localResult || "";

                    // 🌟 3. Modale EXCLUSIVEMENT pour PDF et Images
					if (isImage || isPdf) {
					              validatedText = await askUserForOcrValidation(
					              source.name, 
					              localResult || "[Aucun texte détecté localement]", 
					              async (mode) => { // 🟢 ON CAPTURE LE MODE ICI
					              return await _fetchAlbertOcr(source.data, isPdf, mode); // 🟢 ON LE PASSE AU FETCH
					                         },
					                         isPdf
					                        );
					                    }

                    // On "fige" le résultat dans le corpus
                    source.originalType = 'file'; 
                    source.data = validatedText;  
                    source.type = 'text';         
                    
                    return validatedText;
                });

            } else if (source.type === 'web-pending') {
                content = await runWithFakeProgress(`Web : ${source.name}`, 150, async () => {
                    const data = await _fetchPageSource(source.url);
                    source.name = data.title || source.name; 
                    source.data = data.text;
                    source.type = 'web';
                    return source.data;
                });
                
			} else if (source.type === 'video-pending') {
			                content = await runWithFakeProgress(`Transcription en cours… : ${source.name}`, 800, async () => {
			                    // 1. On récupère la langue de l'interface
			                    const currentLang = document.getElementById('global-language')?.value || 'Français';
			                    const langMap = {
			                        'Français': 'fr', 'English': 'en', 'Spanish': 'es', 
			                        'German': 'de', 'Italian': 'it', 'Dutch': 'nl',
			                        'Portuguese': 'pt', 'Normand': 'fr', 'Latin': 'la'
			                    };
			                    const whisperLangCode = langMap[currentLang] || 'fr';

			                    // 2. On passe le code langue au proxy
			                    const data = await _fetchVideoSource(source.url, whisperLangCode);
                    
			                    source.data = data.text;
                    
			                    // 🌟 LA CORRECTION EST ICI 🌟
			                    // On sauvegarde l'URL d'origine AVANT de la remplacer par le mp4
			                    source.originalSourceUrl = source.url; 
			                    source.url = data.resolved_url || source.url; 
                    
			                    source.segments = data.segments || [];        
			                    source.transcSource = data.source;            
			                    source.type = 'video';
			                    return source.data;
			                });
                
            } else {
                content = source.data || '';
            }

            masterContent += content + '\n\n';

        } catch (error) {
            logger.error(`Erreur sur "${source.name}": ${error.message}`);
            hasErrors = true;
            lastBuildErrors.push(`${source.name} : ${error.message}`);
        }
    }

    if (onProgressUpdate) onProgressUpdate(100, "Terminé !");
    // Si rien d'exploitable n'a été extrait (ex. transcription en échec), on renvoie
    // null pour signaler l'échec : l'UI reste à l'étape 1 avec un message clair plutôt
    // que de valider un corpus vide et d'avancer silencieusement à l'étape 2.
    if (!masterContent.trim()) return null;
    return masterContent;
}

// Erreurs de la dernière construction (pour affichage UI).
function getLastBuildErrors() { return lastBuildErrors; }

// ── Interface : Modale de comparaison OCR / Parsing ──
// ── Interface : Modale de comparaison OCR / Parsing ──
function askUserForOcrValidation(fileName, localText, runAlbertCallback, isPdf) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; opacity: 0; transition: opacity 0.3s ease; font-family: system-ui, -apple-system, sans-serif;`;

        const previewLeft = localText.trim();
        
        // 🌟 NOUVEAU : On adapte le vocabulaire en fonction du fichier
        const typeIA = isPdf ? "Parsing" : "OCR / Vision";
        const descAide = isPdf ? 
            "Si le PDF est issu d'un scan ou si la lecture locale a perdu la structure, utilisez le parseur intelligent." : 
            "Choisissez l'action à effectuer sur cette image :";

        overlay.innerHTML = `
            <style>
                @keyframes hapi-pulse { 0%, 100% { opacity: 0.5; transform: scale(0.98); } 50% { opacity: 1; transform: scale(1); } }
                @keyframes slide-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
                
                .hapi-modal { background: var(--surface); width: 1000px; max-width: 95vw; max-height: 90vh; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,145,0.15); display: flex; flex-direction: column; animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; overflow: hidden; }
                
                .ocr-box { background: var(--page-bg); padding: 18px; border-radius: 12px; flex: 1; font-family: 'Courier New', Courier, monospace; font-size: 0.9rem; color: var(--text); line-height: 1.5; max-height: 35vh; overflow-y: auto; overflow-x: hidden; white-space: pre-wrap; border: 1px solid var(--border); box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
                .ocr-box::-webkit-scrollbar { width: 8px; }
                .ocr-box::-webkit-scrollbar-track { background: var(--page-bg); border-radius: 4px; }
                .ocr-box::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }
                .ocr-box::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

                .hapi-btn { padding: 14px 24px; font-size: 1.05rem; font-weight: 600; border: none; border-radius: 25px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s ease; width: 100%; }
                .hapi-btn-frugal { background: rgba(var(--hapi-green-rgb), 0.10); color: var(--hapi-accent-text); border: 2px solid rgba(var(--hapi-green-rgb), 0.4); }
                .hapi-btn-frugal:hover { background: rgba(var(--hapi-green-rgb), 0.18); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(22, 101, 52, 0.1); }
                
                .hapi-btn-solid { background: linear-gradient(135deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; box-shadow: 0 4px 15px rgba(var(--hapi-green-rgb), 0.3); }
                .hapi-btn-solid:hover { background: linear-gradient(135deg, var(--hapi-green-dark), var(--hapi-green-deep)); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(var(--hapi-green-rgb), 0.35); }

                /* NOUVELLES CLASSES POUR LES TUILES D'INTENTION */
                .hapi-tile { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 15px; border-radius: 12px; border: 2px solid var(--border); background: var(--page-bg); cursor: pointer; transition: all 0.2s ease; text-align: center; }
                .hapi-tile:hover { border-color: var(--hapi-green); background: var(--hapi-green-pale); transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(var(--hapi-green-rgb), 0.12); }
                .hapi-tile-analyse { border-color: rgba(var(--hapi-green-rgb), 0.35); background: var(--hapi-green-mist); }
                .hapi-tile-analyse:hover { border-color: var(--hapi-green-dark); background: var(--hapi-green-pale); box-shadow: 0 10px 15px -3px rgba(var(--hapi-green-rgb), 0.12); }
            </style>

            <div class="hapi-modal" id="ocr-modal-box">
                <div style="background: var(--surface); padding: 20px 30px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <h3 style="margin: 0; color: var(--hapi-accent-text); font-size: 1.3rem; font-weight: 700;">Vérification de l'extraction (${typeIA})</h3>
                        <p style="margin: 4px 0 0 0; color: var(--text-muted); font-size: 0.95rem;">Fichier analysé : <strong>${fileName}</strong></p>
                    </div>
				<button id="btn-close-ocr-modal" style="background: none; border: none; font-size: 1.8rem; color: var(--text-muted); cursor: pointer; padding: 0 5px; line-height: 1; transition: color 0.2s;" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text-muted)'" title="Fermer et annuler">&times;</button>
                </div>

                <div style="display: flex; flex-wrap: wrap; overflow: hidden; flex: 1;">
                    <div style="flex: 1; min-width: 300px; padding: 25px 30px; border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--hapi-accent-text); background: rgba(var(--hapi-green-rgb), 0.15); padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.5px;">Lecture locale (frugale)</span>
                        </div>
                        
                        <div class="ocr-box">${previewLeft || "[Aucun texte n'a pu être extrait localement]"}</div>
                        
                        <button id="btn-keep-tess" class="hapi-btn hapi-btn-frugal"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Valider et garder ce texte</button>
                    </div>

                    <div style="flex: 1; min-width: 300px; padding: 25px 30px; background: var(--page-bg); display: flex; flex-direction: column; gap: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--danger-text); background: rgba(220, 38, 38, 0.12); padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.5px;">🇫🇷 Analyse IA (moins frugale)</span>
                        </div>
                        
                        <div id="albert-placeholder" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: 2px dashed var(--border); border-radius: 12px; padding: 20px; background: var(--surface);">
                            <span style="font-size: 2.5rem; margin-bottom: 10px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></span>
                            <h4 style="margin: 0 0 8px 0; color: var(--text); font-size: 1.1rem;">La lecture locale est imparfaite ?</h4>
                            <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 20px;">${descAide}</p>
                            
                            <div style="display: flex; gap: 15px; width: 100%; align-items: stretch; justify-content: center;">
                                
                                <div id="btn-run-albert" class="hapi-tile">
                                    <span style="font-size: 2rem; margin-bottom: 5px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg></span>
                                    <strong style="color: var(--text); font-size: 1rem;">Extraire le texte</strong>
                                    <span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px;">Idéal pour les documents, manuscrits ou scans.</span>
                                </div>
                                
                                ${!isPdf ? `
                                <div id="btn-run-albert-analyse" class="hapi-tile hapi-tile-analyse">
                                    <span style="font-size: 2rem; margin-bottom: 5px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></span>
                                    <strong style="color: var(--hapi-accent-text); font-size: 1rem;">Analyser l'image</strong>
                                    <span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px;">L'IA décrit la scène et le contexte visuel.</span>
                                </div>
                                ` : ''}
                                
                            </div>
                            </div>

                        <div id="albert-loading" style="display: none; flex: 1; flex-direction: column; align-items: center; justify-content: center; animation: hapi-pulse 1.5s infinite; text-align: center;">
                            <span style="font-size: 3rem; margin-bottom: 15px;"></span>
                            <h4 style="margin: 0; color: var(--hapi-accent-text); font-size: 1.1rem;">Analyse IA en cours...</h4>
                            <p style="margin: 5px 0 0 0; color: var(--text-muted); font-size: 0.9rem;">Cela peut prendre quelques secondes.</p>
                        </div>

						<div id="albert-result-area" style="display: none; flex: 1; flex-direction: column; gap: 15px;">
                            <div id="albert-preview" class="ocr-box" style="background: var(--surface);"></div>
                            <div style="display: flex; gap: 10px;">
                                <button id="btn-retry-albert" class="hapi-btn" style="background: var(--page-bg); color: var(--text-muted); width: auto; padding: 14px 20px;" title="Essayer l'autre méthode">Revenir</button>
                                <button id="btn-keep-albert" class="hapi-btn hapi-btn-solid" style="flex: 1;">Valider ce texte généré par IA</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        setTimeout(() => { overlay.style.opacity = '1'; }, 10);

        let albertFullText = "";

        const finish = (text) => {
            overlay.style.opacity = '0';
            const modalBox = overlay.querySelector('#ocr-modal-box');
            if (modalBox) modalBox.style.transform = 'translateY(30px)';
			
// 🟢 NOUVEAU : Ferme tous les avertissements de modération encore ouverts
            document.querySelectorAll('.hapi-moderation-toast .hapi-mod-close').forEach(btn => btn.click());
			
            setTimeout(() => { overlay.remove(); resolve(text); }, 300);
        };

		// 🟢 NOUVEAU : Action pour fermer la modale avec la croix
        overlay.querySelector('#btn-close-ocr-modal').addEventListener('click', () => {
            finish(localText); // Renvoie le texte par défaut pour ne pas bloquer le processus HAPI
        });

        overlay.querySelector('#btn-keep-tess').addEventListener('click', () => finish(localText));

        // 🟢 FONCTION FACTORISÉE POUR GÉRER L'UI PENDANT L'APPEL
// 🟢 FONCTION FACTORISÉE POUR GÉRER L'UI PENDANT L'APPEL
        const triggerAlbert = async (mode) => {
            overlay.querySelector('#albert-placeholder').style.display = 'none';
            overlay.querySelector('#albert-loading').style.display = 'flex';
            
            const btnTess = overlay.querySelector('#btn-keep-tess');
            btnTess.disabled = true;
            btnTess.style.opacity = '0.5';

            try {
                // On passe le mode ('ocr' ou 'analyse') au callback
                let rawText = await runAlbertCallback(mode);
                
                // 🟢 NOUVEAU : Nettoyage strict du Markdown pour protéger le corpus
                albertFullText = rawText
                    .replace(/^#{1,6}\s+/gm, '')         // Supprime les en-têtes (## Titre -> Titre)
                    .replace(/\*\*(.*?)\*\*/g, '$1')     // Supprime le gras (**texte** -> texte)
                    .replace(/\*(.*?)\*/g, '$1')         // Supprime l'italique (*texte* -> texte)
                    .replace(/__(.*?)__/g, '$1')         // Supprime le gras (__texte__ -> texte)
                    .replace(/_(.*?)_/g, '$1')           // Supprime l'italique (_texte_ -> texte)
                    .replace(/^[\s]*[-+*]\s+/gm, '')     // Supprime les puces de listes (- item -> item)
                    .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // Supprime les balises de code
                    .replace(/\n{3,}/g, '\n\n')          // Normalise les sauts de ligne multiples
                    .trim();
                
                overlay.querySelector('#albert-loading').style.display = 'none';
                overlay.querySelector('#albert-result-area').style.display = 'flex';
                // L'interface affiche désormais un texte parfaitement propre
                overlay.querySelector('#albert-preview').textContent = albertFullText;
                
                btnTess.disabled = false;
                btnTess.style.opacity = '1';
                
            } catch (e) {
                // 🛡️ Cas spécial : blocage modération
                if (e.message && e.message.startsWith('MODERATION_BLOCKED:')) {
                    overlay.querySelector('#albert-placeholder').style.display = 'flex';
                    overlay.querySelector('#albert-loading').style.display = 'none';
                    btnTess.disabled = false;
                    btnTess.style.opacity = '1';
                } else {
                    alert("Erreur de connexion à l'IA : " + e.message);
                    overlay.querySelector('#albert-placeholder').style.display = 'flex';
                    overlay.querySelector('#albert-loading').style.display = 'none';
                    btnTess.disabled = false;
                    btnTess.style.opacity = '1';
                }
            }
        };  

        // 🟢 ON ATTACHE LA FONCTION À LA TUILE OCR
        overlay.querySelector('#btn-run-albert').addEventListener('click', () => triggerAlbert('ocr'));

        // 🟢 ON ATTACHE LA FONCTION À LA TUILE ANALYSE (si elle existe)
        const btnAnalyse = overlay.querySelector('#btn-run-albert-analyse');
        if (btnAnalyse) {
            btnAnalyse.addEventListener('click', () => triggerAlbert('analyse'));
        }
		
// 🟢 NOUVEAU : Bouton retour pour changer de méthode IA
        overlay.querySelector('#btn-retry-albert').addEventListener('click', () => {
            overlay.querySelector('#albert-result-area').style.display = 'none';
            overlay.querySelector('#albert-placeholder').style.display = 'flex';
            albertFullText = ""; // On réinitialise la mémoire
        });

        overlay.querySelector('#btn-keep-albert').addEventListener('click', () => {
            if (albertFullText) finish(albertFullText);
        });
    });
}

export const corpusManager = {
    getCorpusSources, getCorpusStats, addSource, removeSource,
    updateSourcePriority, updateSourcePageRange, updateQuestionCount,
    reorderSources, buildFinalCorpus, getFirstVideoSource, getLastBuildErrors
};