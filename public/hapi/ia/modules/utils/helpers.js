// Fichier: modules/utils/helpers.js

import { logger } from './logger.js';

/**
 * Crée le HTML pour les options de feedback global (Ancien système binaire).
 */
export function creerFeedbackGlobalHTML(idPrefix, stepNumber = '6') {
     const suggestions = `
        <div class="seuil-suggestions">
            <span class="pastille" data-action="setSeuil" data-target="${idPrefix}-passPercentage" data-value="50">50%</span>
            <span class="pastille" data-action="setSeuil" data-target="${idPrefix}-passPercentage" data-value="67">67%</span>
            <span class="pastille" data-action="setSeuil" data-target="${idPrefix}-passPercentage" data-value="75">75%</span>
            <span class="pastille" data-action="setSeuil" data-target="${idPrefix}-passPercentage" data-value="100">100%</span>
        </div>`;
     
     const feedbackFailSuggestions = `
        <div class="feedback-suggestions">
            <button type="button" class="btn-suggestion" data-action="setFeedback" data-target="${idPrefix}-feedback-fail" data-value="Continue tes efforts !">Continue !</button>
            <button type="button" class="btn-suggestion" data-action="setFeedback" data-target="${idPrefix}-feedback-fail" data-value="Presque ! Réessaye.">Presque...</button>
        </div>`;
     
     const feedbackSuccessSuggestions = `
        <div class="feedback-suggestions">
            <button type="button" class="btn-suggestion" data-action="setFeedback" data-target="${idPrefix}-feedback-success" data-value="Excellent travail !">Excellent !</button>
            <button type="button" class="btn-suggestion" data-action="setFeedback" data-target="${idPrefix}-feedback-success" data-value="Bravo, c'est une belle réussite !">Bravo !</button>
        </div>`;
     
     return `
        <div class="section" id="final-options-section-${idPrefix}">
            <h2><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> ${stepNumber}. Options de fin (globales)</h2>
            <div class="input-group">
                <label for="${idPrefix}-passPercentage">Seuil de réussite (%) :</label>
                <input type="number" id="${idPrefix}-passPercentage" value="67" min="0" max="100" step="1">
                ${suggestions}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="input-group">
                    <label for="${idPrefix}-feedback-fail">Feedback si score &lt; seuil :</label>
                    <textarea id="${idPrefix}-feedback-fail" rows="3">Continue tes efforts, tu vas y arriver !</textarea>
                    ${feedbackFailSuggestions}
                </div>
                <div class="input-group">
                    <label for="${idPrefix}-feedback-success">Feedback si score ≥ seuil :</label>
                    <textarea id="${idPrefix}-feedback-success" rows="3">Bravo, excellent travail !</textarea>
                    ${feedbackSuccessSuggestions}
                </div>
            </div>
        </div>`;
}

// ============================================================================
// NOUVEAU SYSTÈME : FEEDBACK PAR INTERVALLES (STANDARD H5P)
// ============================================================================

const intervalsState = {};
const intervalsRenderers = {};

/**
 * Crée le HTML pour le système de feedback par intervalles.
 */
export function creerFeedbackIntervallesHTML(idPrefix, stepNumber = '') {
    return `
    <div class="section" id="feedback-intervals-section-${idPrefix}" style="border: 1px solid var(--border); border-radius: 6px; background: var(--surface); padding: 20px; margin-top: 15px;">
        <div style="font-weight:bold; font-size:0.9em; color:var(--text); margin-bottom: 5px;">
            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M1 12h3M20 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2"/></svg> ${stepNumber ? stepNumber + '. ' : ''}Feedback général
        </div>
        
        <div style="margin-bottom: 20px;">
            <strong style="display:block; font-size: 0.9em; color: var(--text); margin-bottom: 5px;">Définissez le feedback pour chaque intervalle de score</strong>
            <p style="font-size: 0.9em; color: var(--text-muted); margin: 0;">
                Cliquez sur le bouton "Ajouter Intervalle" pour ajouter autant d'intervalles de score que vous souhaitez. Exemple : 0-50% Score insuffisant, 51-75% Score moyen, 76-90% Bon score , 91-100% Score excellent !
            </p>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.9em; font-weight: bold; color: var(--text); margin-bottom: 10px; padding: 0 15px;">
            <div style="width: 180px; text-align: center; flex-shrink: 0;">Intervalle de score</div>
            <div style="flex: 1; margin-left: 10px;">Feedback pour l'intervalle de score défini</div>
        </div>
        
        <div id="${idPrefix}-intervals-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px;">
            </div>

        <div style="display: flex; gap: 10px;">
            <button type="button" id="${idPrefix}-btn-add-interval" class="btn" style="background:var(--hapi-green-dark); color:white; border:none; padding:10px 20px; border-radius:4px; cursor:pointer; font-weight:bold; font-size: 0.85em;">
                Ajouter Intervalle
            </button>
            <button type="button" id="${idPrefix}-btn-distribute-intervals" class="btn" style="background:var(--page-bg); color:var(--text-muted); border:1px solid var(--border); padding:10px 20px; border-radius:4px; cursor:pointer; font-weight:bold; font-size: 0.85em;">
                ✕ Répartir également
            </button>
        </div>
    </div>`;
}

/**
 * Initialise la logique Javascript pour les intervalles.
 */
export function initFeedbackIntervalles(idPrefix) {
    if (!intervalsState[idPrefix]) {
        intervalsState[idPrefix] = [{ max: 100, feedback: '' }];
    }

    const container = document.getElementById(`${idPrefix}-intervals-list`);
    const btnAdd = document.getElementById(`${idPrefix}-btn-add-interval`);
    const btnDistribute = document.getElementById(`${idPrefix}-btn-distribute-intervals`);
    
    if(!container || !btnAdd || !btnDistribute) return;

    const render = () => {
        container.innerHTML = '';
        let previousMax = 0;
        
        intervalsState[idPrefix].forEach((interval, index) => {
            const isLast = index === intervalsState[idPrefix].length - 1;
            const min = previousMax === 0 && index === 0 ? 0 : previousMax + 1;
            const max = isLast ? 100 : interval.max;
            
            const row = document.createElement('div');
            row.style.cssText = "display: flex; align-items: center; background: var(--page-bg); padding: 12px 15px; border: 1px solid var(--border); border-radius: 4px;";
            
            row.innerHTML = `
                <div style="display: flex; align-items: center; width: 180px; font-size: 1.05em; color: var(--text); flex-shrink: 0;">
                    
                    <div style="width: 75px; display: flex; align-items: center; justify-content: flex-end;">
                        <div style="width: 48px; text-align: center;">${min}</div>
                        <div style="width: 15px; text-align: left; margin-left: 2px;">%</div>
                    </div>
                    
                    <div style="width: 30px; text-align: center; color: var(--text-muted);">-</div>
                    
                    <div style="width: 75px; display: flex; align-items: center; justify-content: flex-start;">
                        ${isLast 
                            ? `<div style="width: 48px; text-align: center; padding: 6px 0;">100</div>`
                            : `<input type="number" class="interval-max-input" data-index="${index}" value="${max}" min="${min}" max="99" style="width: 48px; padding: 6px 0; border: 1px solid var(--border); border-radius: 4px; text-align: center; font-size: 1em; background: var(--surface); outline: none; color: var(--text); box-sizing: border-box; -moz-appearance: textfield;">`
                        }
                        <div style="width: 15px; text-align: left; margin-left: 2px;">%</div>
                    </div>
                    
                </div>
                
                <div style="flex: 1; margin-left: 10px; display: flex; align-items: center; gap: 10px;">
                    <input type="text" class="interval-feedback-input" data-index="${index}" value="${interval.feedback.replace(/"/g, '&quot;')}" placeholder="Renseigner le feedback" style="flex: 1; padding: 10px; border: 1px solid var(--border); border-radius: 4px; font-size: 0.9em;">
                    <button type="button" class="btn-del-interval" data-index="${index}" style="background:#e2e8f0; border:none; color:var(--text-muted); font-size:1em; width:28px; height:28px; border-radius:50%; cursor:${intervalsState[idPrefix].length > 1 ? 'pointer' : 'not-allowed'}; opacity:${intervalsState[idPrefix].length > 1 ? '1' : '0.4'}; display:flex; align-items:center; justify-content:center;" ${intervalsState[idPrefix].length === 1 ? 'disabled' : ''} title="Supprimer cet intervalle">
                        ✕
                    </button>
                </div>
            `;
            container.appendChild(row);
            previousMax = max;
        });

        // Events de mise à jour des seuils
        container.querySelectorAll('.interval-max-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                let val = parseInt(e.target.value);
                
                const minAllowed = idx === 0 ? 0 : intervalsState[idPrefix][idx-1].max + 1;
                const maxAllowed = idx === intervalsState[idPrefix].length - 2 ? 99 : intervalsState[idPrefix][idx+1].max - 1;
                
                if(isNaN(val) || val < minAllowed) val = minAllowed;
                if(val > maxAllowed) val = maxAllowed;
                
                intervalsState[idPrefix][idx].max = val;
                render();
            });
        });

        // Sauvegarde du texte en temps réel
        container.querySelectorAll('.interval-feedback-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                intervalsState[idPrefix][idx].feedback = e.target.value;
            });
        });

        // Suppression
        container.querySelectorAll('.btn-del-interval').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                intervalsState[idPrefix].splice(idx, 1);
                if(intervalsState[idPrefix].length > 0) {
                    intervalsState[idPrefix][intervalsState[idPrefix].length - 1].max = 100;
                }
                render();
            });
        });
    };

    intervalsRenderers[idPrefix] = render;

    btnAdd.addEventListener('click', () => {
        const len = intervalsState[idPrefix].length;
        if(len === 1) {
            intervalsState[idPrefix] = [
                { max: 50, feedback: intervalsState[idPrefix][0].feedback },
                { max: 100, feedback: '' }
            ];
        } else {
            const prev = intervalsState[idPrefix][len - 2];
            const newMax = Math.floor((prev.max + 100) / 2);
            if(newMax > prev.max && newMax < 100) {
                intervalsState[idPrefix].splice(len - 1, 0, { max: newMax, feedback: '' });
            } else {
                intervalsState[idPrefix].splice(len - 1, 0, { max: prev.max + 1, feedback: '' });
            }
        }
        render();
    });

    btnDistribute.addEventListener('click', () => {
        const len = intervalsState[idPrefix].length;
        if(len === 0) return;
        const step = 100 / len;
        for(let i=0; i<len; i++) {
            intervalsState[idPrefix][i].max = i === len - 1 ? 100 : Math.round(step * (i + 1));
        }
        render();
    });

    render();
}

/**
 * Récupère les données au format attendu par H5P ({from, to, feedback}).
 */
export function getFeedbackIntervallesData(idPrefix) {
    if(!intervalsState[idPrefix]) return [{ from: 0, to: 100, feedback: "" }];
    
    const result = [];
    let previousMax = 0;
    
    intervalsState[idPrefix].forEach((interval, index) => {
        const min = previousMax === 0 && index === 0 ? 0 : previousMax + 1;
        const max = index === intervalsState[idPrefix].length - 1 ? 100 : interval.max;
        
        result.push({
            from: min,
            to: max,
            feedback: interval.feedback
        });
        
        previousMax = max;
    });
    
    return result;
}

/**
 * Recharge les données lors de l'import d'un état existant.
 */
export function setFeedbackIntervallesData(idPrefix, intervalsArray) {
    if(!intervalsArray || !Array.isArray(intervalsArray) || intervalsArray.length === 0) return;
    intervalsState[idPrefix] = intervalsArray.map(int => ({
        max: int.to,
        feedback: int.feedback || ''
    }));
    if(intervalsRenderers[idPrefix]) {
        intervalsRenderers[idPrefix]();
    }
}

// ============================================================================

/**
 * Crée le HTML pour l'assistant IA.
 */
export function creerAssistantIA_HTML(promptId, responseId, parseFunction, charCounterId) {
    return `
    <div id="ia-assistant-section-${promptId}">
        <h2 style="margin:0 0 15px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: var(--text); font-size: 1.4rem; font-weight: bold; border-bottom: 2px solid rgba(var(--hapi-green-rgb), 0.35); padding-bottom: 10px;">
            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> Vérifiez et ajustez le prompt.
        </h2>
        <p style="font-size: 0.95em; margin-bottom: 15px;font-style: italic; color: var(--text-muted);">
            Voici les instructions qui vont être envoyées à l'IA. Vous pouvez les modifier librement avant de cliquer sur le bouton d'envoi.
        </p>
        
        <div style="position: relative;">
            <textarea id="${promptId}" rows="12" style="width: 100%; padding: 15px; border: 2px solid var(--hapi-green); border-radius: 6px; font-size: 1.05em; font-family: 'Courier New', monospace; box-sizing: border-box; background-color: var(--field-bg); color: var(--text); resize: vertical;"></textarea>
            <small id="${charCounterId || ''}" class="char-counter" style="position: absolute; bottom: 10px; right: 15px; color: var(--text-muted); font-size: 0.8em;"></small>
        </div>

        <div style="display: none;">
            <textarea id="${responseId}"></textarea>
            <div class="ia-launcher-group" id="ia-launcher-${promptId}"></div>
            <button id="btn-parse-${responseId}"></button>
        </div>
    </div>`;
}

/**
 * Gère les clics sur les pastilles de suggestion (Seuil et Feedback).
 */
export function handleHelpersClick(event) {
    const target = event.target;
    const action = target.dataset.action;
    
    if (!action) return;

    const targetId = target.dataset.target;
    const value = target.dataset.value;
    const element = document.getElementById(targetId);

    if (!element) {
        logger.error(`Élément cible ${targetId} non trouvé pour l'helper.`);
        return;
    }

    if (action === 'setSeuil') {
        element.value = value;
        logger.log(`Seuil pour '${targetId}' défini à ${value}%.`);
    } else if (action === 'setFeedback') {
        element.value = value;
        logger.log(`Feedback pour '${targetId}' défini.`);
    }
}

/**
 * Convertit un objet Fichier (File) en chaîne Data URL (Base64).
 * C'est le nom utilisé par les modules 3D (locaux).
 */
export function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * ✨ AJOUTÉ : Alias pour l'ancien nom.
 * C'est le nom utilisé par les modules 2D (grand public).
 * Il pointe vers la même fonction 'fileToDataUrl'.
 */
export { fileToDataUrl as fileToBase64 };

/**
 * Génère un UUID v4.
 * Nécessaire pour h5p-generator.js (ID d'annotations).
 */
export function generateUUID() {
    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    // Fallback si crypto.randomUUID n'est pas disponible
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
/**
 * Rendu partagé de la répartition par source (combien d'éléments extraire de chaque
 * fichier du corpus). Utilisé par markthewords / dragtext / advanced-blanks ;
 * même apparence que les répartitions historiques (qcm, crossword…).
 * @param {HTMLElement} rootEl   conteneur racine du module (variable `container`)
 * @param {string} containerSel  sélecteur du div de répartition (ex. '#x-questions-repartition')
 * @param {Array} selectedDocs   docs sélectionnés (getSelectedSourceObjects())
 * @param {Object} currentRepartition  map {sourceId: count} du module (mutée ici)
 * @param {string} titre         libellé (ex. 'Répartition des mots à repérer')
 */
export function renderRepartitionSources(rootEl, containerSel, selectedDocs, currentRepartition, titre) {
    const repContainer = rootEl.querySelector(containerSel);
    if (!repContainer) return;

    rootEl.querySelectorAll(containerSel + ' .source-question-count').forEach(input => {
        const val = parseInt(input.value, 10);
        currentRepartition[input.dataset.sourceId] = isNaN(val) ? '' : val;
    });

    if (!selectedDocs || selectedDocs.length === 0) {
        repContainer.innerHTML = '';
        return;
    }

    const getDocIcon = (doc) => {
        if (doc.type === 'text') return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
        const name = (doc.title || '').toLowerCase();
        if (name.match(/\.(jpe?g|png)$/)) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
        if (name.endsWith('.txt')) return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>';
        return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
    };

    let html = `
        <div style="background: var(--page-bg); border: 1px solid var(--border); border-radius: 6px; padding: 15px; margin-top: 10px; max-height: 250px; overflow-y: auto;">
            <label style="display:flex; justify-content:space-between; align-items:center; font-size: 0.95em; font-weight:bold; margin-bottom:12px; color:var(--text);">
                <span><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> ${titre}</span>
            </label>
    `;

    selectedDocs.forEach(doc => {
        const defaultCount = doc.priority === 3 ? 6 : (doc.priority === 2 ? 4 : 2);
        const val = currentRepartition[doc.id] !== undefined && currentRepartition[doc.id] !== '' ? currentRepartition[doc.id] : defaultCount;
        currentRepartition[doc.id] = val;

        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed var(--border);">
                <span style="font-size: 0.9em; color: var(--text-muted); display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 75%;" title="${doc.title}">
                    <span>${getDocIcon(doc)}</span> <span style="overflow: hidden; text-overflow: ellipsis;">${doc.title}</span>
                </span>
                <input type="number" class="source-question-count" data-source-id="${doc.id}" value="${val}" min="0" max="30" style="width: 60px; padding: 4px; border: 1px solid var(--border); border-radius: 4px; text-align: center; font-weight: bold; color: var(--text);">
            </div>
        `;
    });

    html += `</div>`;
    repContainer.innerHTML = html;
}

/**
 * Construit le texte source en BLOCS par fichier avec quota d'extraction (même
 * convention que le prompt-engine QCM). Retourne null si pas de multi-source exploitable.
 * @param {Array} selectedDocs  docs sélectionnés
 * @param {Object} repartitionMap  {sourceId: count}
 * @param {string} instructionQuota  ex. 'MARQUE EXACTEMENT {n} mot(s) dans ce bloc.'
 */
export function construireBlocsSources(selectedDocs, repartitionMap, instructionQuota) {
    if (!selectedDocs || selectedDocs.length === 0) return null;
    const blocs = selectedDocs.map(d => {
        const n = repartitionMap[d.id];
        const instr = (n > 0) ? `🛑 ${instructionQuota.replace('{n}', n)}\n` : '';
        const content = (d.content || '').trim();
        if (!content) return '';
        return `--- DEBUT BLOC SOURCE ---\nNOM: ${d.title}\n${instr}CONTENU:\n${content}\n--- FIN BLOC SOURCE ---`;
    }).filter(Boolean);
    return blocs.length ? blocs.join('\n\n') : null;
}
