// Fichier: modules/utils/states/advanced-blanks-state.js
import { logger } from '../logger.js';

export function getAdvancedBlanksState() {
    const ruleElements = document.querySelectorAll('.ab-rule-item');
    let rules = [];
    ruleElements.forEach(el => {
        const task = el.querySelector('.ab-rule-task')?.value.trim() || '';
        const example = el.querySelector('.ab-rule-example')?.value.trim() || '';
        if (task || example) rules.push({ task, example });
    });

    const blanks = [];
    document.querySelectorAll('.ab-blank-card').forEach(card => {
        const correct = card.querySelector('.ab-correct-input')?.value || '';
        const incorrectList = [];
        card.querySelectorAll('.ab-incorrect-row').forEach(row => {
            const answer = row.querySelector('.ab-inc-answer')?.value || '';
            const feedback = row.querySelector('.ab-inc-feedback')?.value || '';
            if (answer || feedback) {
                incorrectList.push({ text: answer, feedback: feedback });
            }
        });
        blanks.push({ correct: correct, incorrect: incorrectList });
    });

    return {
        type: 'advanced-blanks',
        titre: document.getElementById('advanced-blanks-title')?.value || '',
        consignes: document.getElementById('advanced-blanks-task-display')?.value || '',

        comportement: {
            mode: document.getElementById('ab-mode')?.value || 'typing',
            spellingErrorBehaviour: document.getElementById('ab-spelling')?.value || 'mistake',
            caseSensitive: document.getElementById('ab-caseSensitive')?.checked ?? false,
            autoCheck: document.getElementById('ab-autoCheck')?.checked ?? false,
            enableCheckButton: document.getElementById('ab-enableCheckButton')?.checked ?? true,
            confirmCheckDialog: document.getElementById('ab-confirmCheckDialog')?.checked ?? false,
            enableSolutionsButton: document.getElementById('ab-enableSolutionsButton')?.checked ?? true,
            showSolutionsRequiresInput: document.getElementById('ab-showSolutionsRequiresInput')?.checked ?? false,
            enableRetry: document.getElementById('ab-enableRetry')?.checked ?? true,
            confirmRetryDialog: document.getElementById('ab-confirmRetryDialog')?.checked ?? false
        },

        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 3',
        //langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-advanced-blanks')?.checked ?? true,

        passPercentage: parseInt(document.getElementById('advanced-blanks-passPercentage')?.value || "50", 10),
        feedbackFail: document.getElementById('advanced-blanks-feedback-fail')?.value || '',
        feedbackSuccess: document.getElementById('advanced-blanks-feedback-success')?.value || '',

        iaRules: rules,
        texteSource: document.getElementById('abTexteSource')?.value || '',
        iaPrompt: document.getElementById('ia-prompt-advanced-blanks')?.value || '',
        iaResponse: document.getElementById('advanced-blanks-ia-response')?.value || '',

        texteFinal: document.getElementById('ab-text-editor')?.value || '',
        blanks: blanks
    };
}

export function setAdvancedBlanksState(config, uiActions) {
    if (config.type !== 'advanced-blanks') return;
    logger.log('🔄 Restauration rigoureuse de Advanced Blanks...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    setVal('advanced-blanks-title', config.titre);
    setVal('advanced-blanks-task-display', config.consignes);

    if (config.comportement) {
        setVal('ab-mode', config.comportement.mode);
        setVal('ab-spelling', config.comportement.spellingErrorBehaviour);
        setCheck('ab-caseSensitive', config.comportement.caseSensitive);
        setCheck('ab-autoCheck', config.comportement.autoCheck);
        setCheck('ab-enableCheckButton', config.comportement.enableCheckButton);
        setCheck('ab-confirmCheckDialog', config.comportement.confirmCheckDialog);
        setCheck('ab-enableSolutionsButton', config.comportement.enableSolutionsButton);
        setCheck('ab-showSolutionsRequiresInput', config.comportement.showSolutionsRequiresInput);
        setCheck('ab-enableRetry', config.comportement.enableRetry);
        setCheck('ab-confirmRetryDialog', config.comportement.confirmRetryDialog);
    }

    //setVal('global-niveau', config.niveau || 'Cycle 3');
    //setVal('global-language', config.langue || 'Français');
    setCheck('translate-ui-advanced-blanks', config.translateUI ?? true);
    setVal('advanced-blanks-passPercentage', config.passPercentage || 50);
    setVal('advanced-blanks-feedback-fail', config.feedbackFail || '');
    setVal('advanced-blanks-feedback-success', config.feedbackSuccess || '');

    // Restauration des règles IA
    const rulesContainer = document.getElementById('ab-rules-container');
    if (rulesContainer) {
        rulesContainer.innerHTML = '';
        let rulesToRestore = config.iaRules || [{ task: '', example: '' }];
        if (rulesToRestore.length === 0) rulesToRestore.push({ task: '', example: '' });

        rulesToRestore.forEach((rule, idx) => {
            const newRule = document.createElement('div');
            newRule.className = 'ab-rule-item';
            newRule.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; align-items: center; margin-bottom: 10px;';
            newRule.innerHTML = `
                <input type="text" class="ab-rule-task" value="${(rule.task || '').replace(/"/g, '&quot;')}" placeholder="ex: verbes au passé composé" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:5px;">
                <input type="text" class="ab-rule-example" value="${(rule.example || '').replace(/"/g, '&quot;')}" placeholder="ex: *ont marché*" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:5px;">
                <button type="button" class="btn btn-remove-ab-rule" style="background:transparent; color:var(--text); border:none; padding:9px 12px; border-radius:6px; cursor:pointer;" title="${idx === 0 ? 'Effacer les champs de cette ligne' : 'Supprimer cette ligne'}"><svg class="ico" style="width:1.35em;height:1.35em;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
            `;
            rulesContainer.appendChild(newRule);
        });
    }

    setVal('abTexteSource', config.texteSource || '');
    setVal('ia-prompt-advanced-blanks', config.iaPrompt || '');
    setVal('advanced-blanks-ia-response', config.iaResponse || '');
    setVal('ab-text-editor', config.texteFinal || '');

    // 🟢 RECONSTRUCTION DYNAMIQUE DES CARTES
    const listContainer = document.getElementById('ab-blanks-editor-list');
    if (listContainer && config.blanks) {
        listContainer.innerHTML = '';
        config.blanks.forEach((blank, index) => {
            const card = document.createElement('div');
            card.className = 'ab-blank-card';
            card.style.cssText = 'background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:15px; box-shadow:0 2px 4px rgba(0,0,0,0.02); position: relative; margin-bottom: 10px;';
            
            let incorrectHtml = '';
            const incorrects = blank.incorrect || [];
            if (incorrects.length === 0) {
                incorrectHtml = `
                    <div class="ab-incorrect-row" style="display:flex; gap:10px; margin-bottom:8px;">
                        <input type="text" class="ab-inc-answer" value="" placeholder="Mauvaise réponse" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:4px;">
                        <input type="text" class="ab-inc-feedback" value="" placeholder="Explication de l'erreur..." style="flex:2; padding:8px; border:1px solid var(--border); border-radius:4px;">
                        <button type="button" class="ab-remove-inc-btn" style="background:none; border:none; color:#991b1b; cursor:pointer; padding:0 5px; font-size: 1.1em;" title="Supprimer">✖</button>
                    </div>
                `;
            } else {
                incorrects.forEach(inc => {
                    incorrectHtml += `
                        <div class="ab-incorrect-row" style="display:flex; gap:10px; margin-bottom:8px;">
                            <input type="text" class="ab-inc-answer" value="${(inc.text || '').replace(/"/g, '&quot;')}" placeholder="Mauvaise réponse" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:4px;">
                            <input type="text" class="ab-inc-feedback" value="${(inc.feedback || '').replace(/"/g, '&quot;')}" placeholder="Explication..." style="flex:2; padding:8px; border:1px solid var(--border); border-radius:4px;">
                            <button type="button" class="ab-remove-inc-btn" style="background:none; border:none; color:#991b1b; cursor:pointer; padding:0 5px; font-size: 1.1em;" title="Supprimer">✖</button>
                        </div>
                    `;
                });
            }

            card.innerHTML = `
                <button type="button" class="ab-delete-card-btn" style="position:absolute; top:15px; right:15px; background:transparent; border:none; border-radius:4px; color:var(--text); cursor:pointer; padding:4px 8px; font-size:1em; transition: 0.2s;" title="Supprimer la carte"><svg class="ico" style="width:1.35em;height:1.35em;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
                <h4 class="ab-card-title" style="margin:0 0 15px 0; color:#059669; font-size:1.1em; border-bottom: 2px solid #d1fae5; padding-bottom: 5px; display: inline-block;">Trou n°${index + 1}</h4>
                <div style="margin-bottom:15px;">
                    <label style="font-size:0.9em; font-weight:bold; color:var(--text); display:block; margin-bottom:5px;">✅ Bonne réponse attendue :</label>
                    <input type="text" class="ab-correct-input" value="${(blank.correct || '').replace(/"/g, '&quot;')}" style="width:100%; padding:10px; border:2px solid #10b981; border-radius:6px; background:rgba(34, 197, 94, 0.12); font-weight:bold; font-size:1.05em; color:var(--text);">
                </div>
                <div style="font-size:0.9em; font-weight:bold; color:var(--text); margin-bottom:8px;">❌ Erreurs anticipées et Feedbacks :</div>
                <div class="ab-incorrect-container">${incorrectHtml}</div>
                <button type="button" class="ab-add-inc-btn" style="background:var(--page-bg); border:1px dashed #94a3b8; color:var(--text-muted); padding:8px 10px; border-radius:6px; font-size:0.9em; cursor:pointer; margin-top:5px; width:100%; font-weight:bold;">➕ Ajouter une erreur courante</button>
            `;

            card.querySelectorAll('.ab-remove-inc-btn').forEach(btn => {
                btn.addEventListener('click', (e) => { e.target.closest('.ab-incorrect-row').remove(); if(uiActions.updateBtn) uiActions.updateBtn(); });
            });

            card.querySelector('.ab-add-inc-btn').addEventListener('click', (e) => {
                const container = e.target.previousElementSibling;
                const newRow = document.createElement('div');
                newRow.className = 'ab-incorrect-row';
                newRow.style.cssText = 'display:flex; gap:10px; margin-bottom:8px;';
                newRow.innerHTML = `
                    <input type="text" class="ab-inc-answer" value="" placeholder="Mauvaise réponse" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:4px;">
                    <input type="text" class="ab-inc-feedback" value="" placeholder="Explication..." style="flex:2; padding:8px; border:1px solid var(--border); border-radius:4px;">
                    <button type="button" class="ab-remove-inc-btn" style="background:none; border:none; color:#991b1b; cursor:pointer; padding:0 5px; font-size: 1.1em;">✖</button>
                `;
                newRow.querySelector('.ab-remove-inc-btn').addEventListener('click', () => { newRow.remove(); if(uiActions.updateBtn) uiActions.updateBtn(); });
                container.appendChild(newRow);
                if(uiActions.updateBtn) uiActions.updateBtn();
            });

            card.querySelector('.ab-delete-card-btn').addEventListener('click', () => {
                if(confirm("Supprimer cette carte ? N'oubliez pas de retirer également les tirets (___) correspondants dans le texte au dessus.")) {
                    card.remove();
                    const cards = document.querySelectorAll('.ab-blank-card');
                    cards.forEach((c, idx) => { const title = c.querySelector('.ab-card-title'); if (title) title.innerText = 'Trou n°' + (idx + 1); });
                    if(uiActions.updateBtn) uiActions.updateBtn();
                }
            });

            listContainer.appendChild(card);
        });
    }

    // Gestion Visibilité
    const iaSection = document.getElementById('advanced-blanks-ia-section');
    const albertAction = document.getElementById('albert-action-advanced-blanks');
    const responseArea = document.getElementById('advanced-blanks-ia-response');
    const hasFinalText = config.texteFinal && config.texteFinal.trim().length > 0;

    if (config.iaPrompt || config.iaResponse) {
        if (iaSection) iaSection.style.display = 'block';
        if (albertAction) albertAction.style.display = 'block';
        if (hasFinalText && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'none';
        } else if (!hasFinalText && config.iaResponse && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'block';
            responseArea.style.minHeight = '300px';
        }
    }

    if (hasFinalText || (config.texteSource && config.texteSource.trim().length > 0)) {
        const editorSec = document.getElementById('advanced-blanks-editor-section');
        const optionsSec = document.getElementById('advanced-blanks-options-section');
        const generateSec = document.getElementById('generate-section');
        
        if (editorSec) editorSec.style.display = 'block';
        if (optionsSec) optionsSec.style.display = 'block';
        if (generateSec && hasFinalText) generateSec.style.display = 'block';
    }

    if (uiActions.updateBtn) uiActions.updateBtn();
}