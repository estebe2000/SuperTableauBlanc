// Fichier: modules/corpus/corpus-ui.js
// MIS À JOUR : UI simplifiée, les URLs s'ajoutent à la liste et sont résolues lors de la validation

import { logger } from '../utils/logger.js';
import { corpusManager } from './corpus-manager.js';

let ui = {};
let softReturnMode = false; // bouton « Suivant » réveillé après un changement de réglage global (sans revalidation)

export function init(onCorpusBuiltCallback) {
    logger.log('📦 Initialisation de Corpus UI...');

    ui = {
        textInput:        document.getElementById('source-text-input'),
        fileInput:        document.getElementById('source-file-input'),
        urlInput:         document.getElementById('source-url-input'), // NOUVEAU
        fileNamesDisplay: document.getElementById('file-names-display'),
        addTextBtn:       document.getElementById('btn-add-text'),
        addFileBtn:       document.getElementById('btn-add-file'),
        addUrlBtnHidden:  document.getElementById('btn-add-url-hidden'), // NOUVEAU
        buildCorpusBtn:   document.getElementById('build-corpus-btn'),
        corpusList:       document.getElementById('corpus-list')
    };

    if (ui.buildCorpusBtn) ui.buildCorpusBtn.style.display = 'none';

    // ── Écouteurs d'ajout ──
    if (ui.addTextBtn) ui.addTextBtn.addEventListener('click', handleAddText);
    if (ui.addFileBtn) ui.addFileBtn.addEventListener('click', handleAddFile);
    if (ui.fileInput)  ui.fileInput.addEventListener('change', updateFileNameDisplay);
    if (ui.addUrlBtnHidden) ui.addUrlBtnHidden.addEventListener('click', handleAddUrl);

// ── Retour aux réglages après validation ──
    // Si l'utilisateur revient à l'étape 1 changer un réglage global (langue,
    // niveau, RAG) alors que le corpus est déjà validé, on réveille le bouton
    // « Suivant ». Son clic NE revalide PAS le corpus (cela réinitialiserait la
    // grille d'activités) : il renvoie vers les activités via le stepper — les
    // éditeurs affichent déjà « Régénérer le prompt » avec les nouveaux réglages.
    // ⚠️ Ce listener DOIT rester enregistré AVANT celui de validation ci-dessous
    // (stopImmediatePropagation court-circuite la revalidation destructive).
    ui.buildCorpusBtn.addEventListener('click', (e) => {
        if (!softReturnMode) return;
        e.stopImmediatePropagation();
        softReturnMode = false;
        ui.buildCorpusBtn.disabled = true;
        ui.buildCorpusBtn.innerHTML = `
            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(var(--hapi-green-rgb), 0.18);color: var(--hapi-accent-text);font-weight:bold;">
                <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Corpus validé
            </div>`;
        document.querySelector('.hapi-stepper li[data-step="2"] .step-btn')?.click();
    });

    const corpusGlobalIds = ['global-language', 'standalone-niveau', 'toggle-rag-boen', 'global-scolarite', 'global-cycle-voie', 'global-niveau', 'global-discipline'];
    corpusGlobalIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            // seulement si le corpus est déjà validé (pastille désactivée) et non vide
            if (!ui.buildCorpusBtn.disabled || corpusManager.getCorpusSources().length === 0) return;
            softReturnMode = true;
            ui.buildCorpusBtn.style.width = '';
            ui.buildCorpusBtn.style.height = '';
            ui.buildCorpusBtn.style.padding = '';
            ui.buildCorpusBtn.disabled = false;
            ui.buildCorpusBtn.textContent = 'Suivant : régénérer avec les nouveaux réglages →';
        });
    });

// ── Bouton "Valider le corpus" ──
    	ui.buildCorpusBtn.addEventListener('click', async () => {
        ui.buildCorpusBtn.disabled = true;
        ui.buildCorpusBtn.textContent = 'Validation en cours…';

        // Progression affichée dans une MODALE dédiée (plus lisible et impossible à
        // rater qu'à l'intérieur du bouton, surtout pour la transcription vidéo qui
        // peut durer plusieurs dizaines de secondes).
        const masterContent = await corpusManager.buildFinalCorpus((percent, fileName) => {
            _updateProgressModal(percent, fileName);
            renderCorpusList(); // Rafraîchit les badges "en attente" -> "Résolu" en temps réel
        });

        _closeProgressModal();

		if (masterContent === null) {
		            const errs = (corpusManager.getLastBuildErrors && corpusManager.getLastBuildErrors()) || [];
		            const detail = errs.length ? '\n\n• ' + errs.join('\n• ') : '';
		            alert("Le corpus n'a pas pu être construit : aucun contenu exploitable." + detail +
		                  "\n\nVérifiez les URLs / fichiers (ex. transcription vidéo en échec) puis réessayez.");
		            ui.buildCorpusBtn.style.width = '';
		            ui.buildCorpusBtn.style.height = '';
		            ui.buildCorpusBtn.style.padding = '';
		            render();
		        } else {
		            ui.buildCorpusBtn.innerHTML = `
		                <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(var(--hapi-green-rgb), 0.18);color: var(--hapi-accent-text);font-weight:bold;">
		                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Corpus validé
		                </div>`;
            
		            // On déclenche la suite de l'application
		            onCorpusBuiltCallback(masterContent, corpusManager.getCorpusSources());

			            // Navigation vers l'étape 2 UNIQUEMENT maintenant, le corpus étant
			            // réellement construit (transcription/extraction terminées). Le curseur
			            // de progression est ainsi resté visible à l'étape 1 pendant tout le traitement.
			            window.dispatchEvent(new CustomEvent('hapiGoToStep', { detail: { id: 2 } }));

		            // ⬇️ SCROLL 1→2 : on amène le titre « 2. Choisissez les activités… » à un écart constant
		            // sous le bandeau d'étapes sticky. Double passage (150 + 600 ms) pour recaler
		            // après le rendu différé de la grille d'activités.
		            const scrollToActivitiesTitle = () => {
		                const titre = document.querySelector('.workflow-title-activites') || document.getElementById('activity-creation-workflow');
		                if (!titre) return;
		                const stepperH = document.querySelector('.hapi-stepper')?.offsetHeight || 0;
		                const yPosition = titre.getBoundingClientRect().top + window.scrollY - stepperH - 24;
		                window.scrollTo({ top: Math.max(0, yPosition), behavior: 'smooth' });
		            };
		            setTimeout(scrollToActivitiesTitle, 150);
		            setTimeout(scrollToActivitiesTitle, 600);
		        }
		    });

    ui.corpusList.addEventListener('click', handleListClick);
    ui.corpusList.addEventListener('change', handleListChange);

    if (typeof Sortable !== 'undefined') {
        new Sortable(ui.corpusList, {
            handle: '.drag-handle', animation: 150,
            ghostClass: 'dragging', onEnd: handleDrop
        });
    }

    render();
    updateFileNameDisplay();
}

function render() {
    renderCorpusList();
    const sources = corpusManager.getCorpusSources();
    if (sources.length > 0) {
        softReturnMode = false; // le corpus a changé : le clic doit revalider pour de vrai
        ui.buildCorpusBtn.style.display = 'inline-block';
        ui.buildCorpusBtn.style.minWidth = '330px'; // ⬅️ AJOUT : On force la largeur initiale
        ui.buildCorpusBtn.disabled      = false;
        ui.buildCorpusBtn.textContent   = `Suivant : valider corpus →`;
    } else {
        ui.buildCorpusBtn.style.display = 'none';
    }
}

// ── Modale de progression (construction du corpus) ───────────────────────────
// Affiche l'avancement (transcription vidéo, OCR, scraping) au centre de l'écran,
// pilotée par le callback onProgressUpdate de buildFinalCorpus. Créée à la demande
// (au 1er appel) : un corpus 100 % texte (instantané) ne la déclenche jamais.
let _progressModal = null;

function _updateProgressModal(percent, label) {
    if (!_progressModal) {
        const overlay = document.createElement('div');
        overlay.id = 'corpus-progress-modal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.7);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:9000;font-family:system-ui,-apple-system,sans-serif;';
        overlay.innerHTML = `
            <style>@keyframes hapi-pm-spin{to{transform:rotate(360deg)}}</style>
            <div role="dialog" aria-live="polite" aria-label="Construction du corpus en cours"
                 style="background:var(--surface);color:var(--text);width:min(440px,92vw);padding:26px 28px;border-radius:16px;border:1px solid var(--border);box-shadow:0 12px 40px rgba(0,0,0,0.35);">
                <div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:1.05em;margin-bottom:6px;">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:0 0 auto;animation:hapi-pm-spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Préparation du corpus…
                </div>
                <div data-pm-label style="color:var(--text-muted);font-size:0.9em;margin-bottom:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Initialisation…</div>
                <div style="background:rgba(var(--hapi-green-rgb),0.15);border-radius:99px;height:12px;overflow:hidden;">
                    <div data-pm-fill style="height:100%;width:0%;background:var(--hapi-green-dark);border-radius:99px;transition:width 0.25s ease;"></div>
                </div>
                <div data-pm-pct style="text-align:right;font-weight:700;font-size:0.85em;margin-top:8px;color:var(--hapi-accent-text);">0 %</div>
            </div>`;
        document.body.appendChild(overlay);
        _progressModal = overlay;
    }
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    _progressModal.querySelector('[data-pm-fill]').style.width = p + '%';
    _progressModal.querySelector('[data-pm-pct]').textContent = p + ' %';
    if (label) _progressModal.querySelector('[data-pm-label]').textContent = label;
}

function _closeProgressModal() {
    if (_progressModal) { _progressModal.remove(); _progressModal = null; }
}

async function handleAddText() {
    const n = await corpusManager.addSource('text', ui.textInput, null, null);
    if (n > 0) render();
}

async function handleAddFile() {
    const n = await corpusManager.addSource('file', null, ui.fileInput, null);
    if (n > 0) { render(); updateFileNameDisplay(); }
}

async function handleAddUrl() {
    const n = await corpusManager.addSource('url', null, null, ui.urlInput);
    if (n > 0) render();
}

function handleListClick(event) {
    const btn = event.target.closest('.btn-remove-source');
    if (btn) { corpusManager.removeSource(btn.dataset.sourceId); render(); }
}

function handleListChange(event) {
    const target = event.target;
    const item   = target.closest('.corpus-item');
    if (!item) return;
    const sourceId = item.dataset.sourceId;
    if (target.classList.contains('priority-select'))
        { corpusManager.updateSourcePriority(sourceId, target.value); renderCorpusList(); }
    if (target.classList.contains('page-range-input'))
        corpusManager.updateSourcePageRange(sourceId, target.value);
}

function handleDrop() {
    const order = Array.from(ui.corpusList.querySelectorAll('.corpus-item'))
        .map(el => el.dataset.sourceId);
    corpusManager.reorderSources(order);
}

function updateFileNameDisplay() {
    const n = ui.fileInput.files.length;
    ui.fileNamesDisplay.textContent = n > 1
        ? `${n} fichiers sélectionnés`
        : n === 1 ? ui.fileInput.files[0].name : 'Aucun fichier sélectionné';
}

function renderCorpusList() {
    const sources = corpusManager.getCorpusSources();
    ui.corpusList.innerHTML = '';

    if (!document.getElementById('corpus-edge-style')) {
        const s = document.createElement('style');
        s.id = 'corpus-edge-style';
        s.innerHTML = `
            .corpus-item { transition: transform .2s, box-shadow .2s; }
            .corpus-item:hover { transform: translateX(5px); box-shadow: 0 4px 12px rgba(0,0,0,.08) !important; }
            .btn-remove-source { transition: all .2s; }
            .btn-remove-source:hover { background-color:var(--border)!important; color:var(--text)!important; transform:scale(1.1); }
            .priority-select { border-radius:4px; padding:2px; border:1px solid transparent; }
            .priority-select:focus { border-color:var(--border-strong); background:var(--page-bg); }
            /* Pastille de priorité : accent FONCÉ (haute) / accent CLAIR (moyenne) /
               GRIS (basse) — choix utilisateur 2026-06-11. */
            .prio-dot { width:14px; height:14px; border-radius:50%; display:inline-block; flex-shrink:0; box-sizing:border-box; }
            .prio-dot[data-prio="3"] { background: var(--hapi-green-dark); }
            .prio-dot[data-prio="2"] { background: var(--hapi-green-light); }
            .prio-dot[data-prio="1"] { background: var(--text-muted); }`;
        document.head.appendChild(s);
    }

    if (sources.length === 0) {
        ui.corpusList.innerHTML = `
            <li style="list-style:none;text-align:center;padding:2rem;background:var(--page-bg);border-radius:.5rem;color:var(--text-muted);border:1px dashed var(--border-strong);">
                <div style="font-size:2rem;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9l-.83-1.2A2 2 0 0 0 7.9 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg></div>Votre corpus est vide.
            </li>`;
        return;
    }

    sources.forEach(source => {
        const li = document.createElement('li');
        li.className = 'corpus-item';
        li.dataset.sourceId = source.id;

        const colors = (source.type === 'video' || source.type === 'video-pending') ? { main: 'var(--hapi-green)', text: 'var(--hapi-green-dark)' }
                     : (source.type === 'web'   || source.type === 'web-pending')   ? { main: 'var(--hapi-grad-a)', text: 'var(--hapi-green-dark)' }
                     : getEdgeColors(source.priority);

        li.style.cssText = `
            display:flex;align-items:center;justify-content:space-between;
            background:var(--surface);border:1px solid var(--border);
            border-left:4px solid ${colors.main};border-radius:4px;
            margin-bottom:8px;padding:10px 16px;
            box-shadow:0 1px 3px rgba(0,0,0,.02);list-style:none;`;

        // Badge selon le statut de la source
        let typeBadge = '';
        if (source.type === 'video' || source.type === 'video-pending') {
            const label = source.transcSource ? { subtitles: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4"/></svg> Sous-titres', whisper: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/></svg> Whisper', albert: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Albert' }[source.transcSource] || '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4"/></svg> Vidéo' : 'En attente...';
            typeBadge = `<span style="font-size:.85em;background:var(--hapi-green-pale);color: var(--hapi-accent-text);font-weight:700;padding:2px 10px;border-radius:12px;margin-left:10px;">${label}</span>`;
        } else if (source.type === 'web' || source.type === 'web-pending') {
            const label = source.type === 'web-pending' ? 'En attente...' : '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg> Web';
            typeBadge = `<span style="font-size:.85em;background:var(--hapi-green-pale);color: var(--hapi-accent-text);font-weight:700;padding:2px 10px;border-radius:12px;margin-left:10px;">${label}</span>`;
        } else if (source.type === 'file' && (source.name.toLowerCase().endsWith('.pdf') || source.name.toLowerCase().endsWith('.pptx') || source.name.toLowerCase().endsWith('.odp'))) {
            const label = source.name.toLowerCase().endsWith('.pdf') ? 'Page(s)' : 'Diapo(s)';
            typeBadge = `
                <span style="font-size:.9em;color:var(--text-muted);font-weight:700;margin-left:10px;">${label} :</span>
                <input type="text" class="page-range-input"
                    placeholder="Ex: 1, 3-5" value="${source.pageRange || ''}"
                    style="width:100px;border:1px solid var(--border);border-radius:4px;padding:6px;font-size:.85em;outline:none;background:var(--page-bg);color:var(--text);">`;
        }

        li.innerHTML = `
            <div style="display:flex;align-items:center;flex:1;min-width:0;gap:15px;">
                <span class="drag-handle" style="cursor:grab;color:var(--text-muted);font-size:1.2em;" title="Déplacer">⋮⋮</span>
                <div style="display:flex;flex-direction:column;min-width:0;">
                    <span class="source-name" style="display:block;font-weight:600;color:var(--text);font-size:.95em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${source.name}">${source.name}</span>
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <span style="font-size:.9em;color:var(--text-muted);font-weight:700;">Priorité :</span>
                        <span class="prio-dot" data-prio="${source.priority}" aria-hidden="true"></span>
                        <select class="priority-select" style="color:var(--text);font-weight:700;font-size:.9em;cursor:pointer;background:transparent;outline:none;">
                            <option value="3" ${source.priority === 3 ? 'selected' : ''}>Haute</option>
                            <option value="2" ${source.priority === 2 ? 'selected' : ''}>Moyenne</option>
                            <option value="1" ${source.priority === 1 ? 'selected' : ''}>Basse</option>
                        </select>
                        ${typeBadge}
                    </div>
                </div>
            </div>
            <div>
                <button class="btn-remove-source" data-source-id="${source.id}" title="Retirer" aria-label="Retirer" style="background:transparent;border:none;cursor:pointer;color:var(--text);">
                    <svg class="ico" style="width:1.35em;height:1.35em;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>
                </button>
            </div>`;

        ui.corpusList.appendChild(li);
    });
}

function getEdgeColors(p) {
    /* Liseré gradué dans la couleur du thème (pastille d'intensité = le vrai signal).
       `text` n'est plus utilisé pour colorer le select (texte normal). */
    if (p === 3) return { main: 'var(--hapi-green-dark)', text: 'var(--text)' };
    if (p === 2) return { main: 'var(--hapi-green-light)', text: 'var(--text)' };
    return { main: 'var(--border-strong)', text: 'var(--text)' };
}

export const corpusUI = { init };