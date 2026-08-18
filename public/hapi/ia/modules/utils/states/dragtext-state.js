// Fichier: modules/utils/states/dragtext-state.js
import { logger } from '../logger.js';

/**
 * CAPTURE L'ÉTAT COMPLET DU DRAG TEXT (Export)
 */
export function getDragTextState() {
    // 1. Extraction dynamique des règles combinées
    const ruleElements = document.querySelectorAll('.dragtext-rule-item');
    let rules = [];
    ruleElements.forEach(el => {
        const task = el.querySelector('.dt-rule-task')?.value.trim() || '';
        const example = el.querySelector('.dt-rule-example')?.value.trim() || '';
        if (task || example) {
            rules.push({ task, example });
        }
    });

    return {
        type: 'dragtext',
        
        // Paramètres généraux
        titre: document.getElementById('dragtext-title')?.value || '',
        consignes: document.getElementById('dragtextTask')?.value || '',
        
        // Options techniques spécifiques
        comportement: {
            enableRetry: document.getElementById('dt-enableRetry')?.checked ?? true,
            enableSolutionsButton: document.getElementById('dt-enableSolutionsButton')?.checked ?? true,
            instantFeedback: document.getElementById('dt-instantFeedback')?.checked ?? false
        },
        
        // Réglages globaux HAPI
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 3',
        //langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-dragtext')?.checked ?? true,
        
        // Seuils et feedbacks
        passPercentage: parseInt(document.getElementById('dragtext-passPercentage')?.value || "50", 10),
        feedbackFail: document.getElementById('dragtext-feedback-fail')?.value || '',
        feedbackSuccess: document.getElementById('dragtext-feedback-success')?.value || '',
        
        // IA : Champs de préparation
        iaRules: rules,
        texteSource: document.getElementById('dragtextTexteSource')?.value || '',
        
        // IA : Chantier Albert
        iaPrompt: document.getElementById('dragtext-ia-prompt')?.value || '',
        iaResponse: document.getElementById('dragtext-ia-response')?.value || '',

        // Texte final contenant les astérisques *mot*
        texteFinal: document.getElementById('dragTheWordsText')?.value || ''
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET DU DRAG TEXT (Import)
 */
export function setDragTextState(config, uiActions) {
    if (config.type !== 'dragtext') return;

    logger.log('🔄 Restauration rigoureuse du Drag Text (avec règles combinées)...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Restauration des réglages généraux
    setVal('dragtext-title', config.titre);
    setVal('dragtextTask', config.consignes);
    
    // 2. Restauration des options spécifiques
    if (config.comportement) {
        setCheck('dt-enableRetry', config.comportement.enableRetry ?? true);
        setCheck('dt-enableSolutionsButton', config.comportement.enableSolutionsButton ?? true);
        setCheck('dt-instantFeedback', config.comportement.instantFeedback ?? false);
    }
    
    //setVal('global-niveau', config.niveau || 'Cycle 3');
    //setVal('global-language', config.langue || 'Français');
    setCheck('translate-ui-dragtext', config.translateUI ?? true);
        
    setVal('dragtext-passPercentage', config.passPercentage || 50);
    setVal('dragtext-feedback-fail', config.feedbackFail || '');
    setVal('dragtext-feedback-success', config.feedbackSuccess || '');

    // 3. IA : Restauration des Règles Dynamiques
    const rulesContainer = document.getElementById('dragtext-rules-container');
    if (rulesContainer) {
        rulesContainer.innerHTML = ''; 
        
        let rulesToRestore = config.iaRules || [];
        // Toujours afficher au moins une règle vide pour ne pas casser l'UI
        if (rulesToRestore.length === 0) {
            rulesToRestore.push({ task: '', example: '' });
        }

        rulesToRestore.forEach((rule, index) => {
            
            const btnState = '';
            const btnColor = 'var(--text)';
            const btnCursor = 'pointer';
            
            const newRule = document.createElement('div');
            newRule.className = 'dragtext-rule-item';
            newRule.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; align-items: center;';
            newRule.innerHTML = `
                <input type="text" class="dt-rule-task" value="${(rule.task || '').replace(/"/g, '&quot;')}" placeholder="ex: adverbes" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:5px;">
                <input type="text" class="dt-rule-example" value="${(rule.example || '').replace(/"/g, '&quot;')}" placeholder="ex: *soudainement*" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:5px;">
                <button type="button" class="btn btn-remove-rule" style="background:transparent; color:${btnColor}; border:none; padding:9px 12px; border-radius:6px; cursor:${btnCursor}; display:flex; align-items:center; justify-content:center; transition: opacity 0.2s;" title="${index === 0 ? 'Effacer les champs de cette ligne' : 'Supprimer cette ligne'}"><svg class="ico" style="width:1.35em;height:1.35em;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></button>
            `;
            rulesContainer.appendChild(newRule);
        });
    }

    setVal('dragtextTexteSource', config.texteSource || '');

    // 4. IA : Restauration du chantier Albert
    setVal('dragtext-ia-prompt', config.iaPrompt || '');
    setVal('dragtext-ia-response', config.iaResponse || '');

    // 5. Restauration du texte final balisé
    setVal('dragTheWordsText', config.texteFinal || '');

    // 6. LOGIQUE DE VISIBILITÉ RIGOUREUSE
    const iaSection = document.getElementById('dragtext-ia-section');
    const albertAction = document.getElementById('albert-action-dragtext');
    const responseArea = document.getElementById('dragtext-ia-response');
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

    // 7. Affichage automatique des sections de l'éditeur final
    if (hasFinalText || (config.texteSource && config.texteSource.trim().length > 0)) {
        const editorSec = document.getElementById('dragtext-editor-section');
        const optionsSec = document.getElementById('dragtext-options-section');
        const generateSec = document.getElementById('generate-section');
        
        if (editorSec) editorSec.style.display = 'block';
        if (optionsSec) optionsSec.style.display = 'block';
        if (generateSec && hasFinalText) generateSec.style.display = 'block';
    }

    if (uiActions.updateBtn) uiActions.updateBtn();
}