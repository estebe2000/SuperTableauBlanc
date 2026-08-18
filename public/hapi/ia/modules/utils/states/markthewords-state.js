// Fichier: modules/utils/states/markthewords-state.js
import { logger } from '../logger.js';

export function getMarkTheWordsState() {
    const ruleElements = document.querySelectorAll('.markthewords-rule-item');
    let rules = [];
    ruleElements.forEach(el => {
        const task = el.querySelector('.mtw-rule-task')?.value.trim() || '';
        const example = el.querySelector('.mtw-rule-example')?.value.trim() || '';
        if (task || example) rules.push({ task, example });
    });

    return {
        type: 'markthewords',
        titre: document.getElementById('markthewords-title')?.value || '',
        consignes: document.getElementById('markTask')?.value || '',
        
        // 🟢 NOUVEAU : Sauvegarde des options de comportement
        comportement: {
            enableRetry: document.getElementById('mtw-enableRetry')?.checked ?? true,
            enableSolutionsButton: document.getElementById('mtw-enableSolutionsButton')?.checked ?? true
        },
        
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 3',
        //langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-mark')?.checked ?? true,
        
        passPercentage: parseInt(document.getElementById('mark-passPercentage')?.value || "50", 10),
        feedbackFail: document.getElementById('mark-feedback-fail')?.value || '',
        feedbackSuccess: document.getElementById('mark-feedback-success')?.value || '',
        
        iaRules: rules,
        texteSource: document.getElementById('markthewordsTexteSource')?.value || '',
        iaPrompt: document.getElementById('markthewords-ia-prompt')?.value || '',
        iaResponse: document.getElementById('markthewords-ia-response')?.value || '',
        texteFinal: document.getElementById('markTheWordsText')?.value || ''
    };
}

export function setMarkTheWordsState(config, uiActions) {
    if (config.type !== 'markthewords') return;

    logger.log('🔄 Restauration rigoureuse des Mots à souligner...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    setVal('markthewords-title', config.titre);
    setVal('markTask', config.consignes);
    
    // 🟢 NOUVEAU : Restauration des options de comportement
    if (config.comportement) {
        setCheck('mtw-enableRetry', config.comportement.enableRetry ?? true);
        setCheck('mtw-enableSolutionsButton', config.comportement.enableSolutionsButton ?? true);
    }
    
    //setVal('global-niveau', config.niveau || 'Cycle 3');
    //setVal('global-language', config.langue || 'Français');
    setCheck('translate-ui-mark', config.translateUI ?? true);
        
    setVal('mark-passPercentage', config.passPercentage || 50);
    setVal('mark-feedback-fail', config.feedbackFail || '');
    setVal('mark-feedback-success', config.feedbackSuccess || '');

    const rulesContainer = document.getElementById('markthewords-rules-container');
    if (rulesContainer) {
        rulesContainer.innerHTML = ''; 
        let rulesToRestore = config.iaRules || [];
        if (rulesToRestore.length === 0 && config.tacheIA) {
            rulesToRestore.push({ task: config.tacheIA, example: config.exempleIA || '' });
        }
        if (rulesToRestore.length === 0) rulesToRestore.push({ task: '', example: '' });

        rulesToRestore.forEach((rule, idx) => {
            
            const btnState = '';
            const btnColor = 'var(--text)';
            const btnCursor = 'pointer';
            const newRule = document.createElement('div');
            newRule.className = 'markthewords-rule-item';
            newRule.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; align-items: center;';
            newRule.innerHTML = `
                <input type="text" class="mtw-rule-task" value="${(rule.task || '').replace(/"/g, '&quot;')}" placeholder="ex: adjectifs qualificatifs" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:5px;">
                <input type="text" class="mtw-rule-example" value="${(rule.example || '').replace(/"/g, '&quot;')}" placeholder="ex: *joli*" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:5px;">
                <button type="button" class="btn btn-remove-rule" style="background:transparent; color:${btnColor}; border:none; padding:9px 12px; border-radius:6px; cursor:${btnCursor}; display:flex; align-items:center; justify-content:center; transition: opacity 0.2s;" title="${idx === 0 ? 'Effacer les champs de cette ligne' : 'Supprimer cette ligne'}"><svg class="ico" style="width:1.35em;height:1.35em;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
            `;
            rulesContainer.appendChild(newRule);
        });
    }

    setVal('markthewordsTexteSource', config.texteSource || '');
    setVal('markthewords-ia-prompt', config.iaPrompt || '');
    setVal('markthewords-ia-response', config.iaResponse || '');
    setVal('markTheWordsText', config.texteFinal || '');

    const iaSection = document.getElementById('markthewords-ia-section');
    const albertAction = document.getElementById('albert-action-mark');
    const responseArea = document.getElementById('markthewords-ia-response');
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
        const editorSec = document.getElementById('markthewords-editor-section');
        const optionsSec = document.getElementById('markthewords-options-section');
        const generateSec = document.getElementById('generate-section');
        
        if (editorSec) editorSec.style.display = 'block';
        if (optionsSec) optionsSec.style.display = 'block';
        if (generateSec && hasFinalText) generateSec.style.display = 'block';
    }

    if (uiActions.updateBtn) uiActions.updateBtn();
}