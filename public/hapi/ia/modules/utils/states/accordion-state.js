// Fichier: modules/utils/states/accordion-state.js
import { logger } from '../logger.js';

/**
 * CAPTURE L'ÉTAT COMPLET DE L'ACCORDÉON (Export)
 */
export function getAccordionState() {
    const panels = [];
    
    // 1. Extraction rigoureuse des panneaux (Concept / Définition)
    document.querySelectorAll('#accordion-items-list .card').forEach(card => {
        panels.push({
            concept: card.querySelector('.accordion-concept')?.value.trim() || '',
            definition: card.querySelector('.accordion-definition')?.value.trim() || ''
        });
    });

    // 2. Export de l'objet de configuration total
    return {
        type: 'accordion',
        titre: document.getElementById('accordion-title')?.value || '',
        
        // Rigueur : Récupération sur les menus globaux HAPI
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 2',
        //langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-accordion')?.checked ?? true,
        
        // ✅ RIGUEUR IA : Sauvegarde du chantier Albert (Prompt & Réponse)
        iaPrompt: document.getElementById('ia-prompt-accordion')?.value || '',
        iaResponse: document.getElementById('ia-response-accordion')?.value || '',
        
        panels: panels
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET DE L'ACCORDÉON (Import)
 */
export function setAccordionState(config, uiActions) {
    if (config.type !== 'accordion') {
        logger.error("Erreur de type : attendu 'accordion', reçu", config.type);
        return;
    }

    logger.log('🔄 Restauration rigoureuse de l\'Accordéon...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Restauration des réglages globaux et titres
    setVal('accordion-title', config.titre);
    //setVal('global-niveau', config.niveau || 'Cycle 2');
    //setVal('global-language', config.langue || 'Français');
    setCheck('translate-ui-accordion', config.translateUI ?? true);

    // 2. ✅ RIGUEUR IA : Restauration du chantier Albert
    setVal('ia-prompt-accordion', config.iaPrompt || '');
    setVal('ia-response-accordion', config.iaResponse || '');

    // 3. Nettoyage et reconstruction des panneaux via l'UI
    uiActions.clearPreview();

    const hasPanels = config.panels && config.panels.length > 0;

    if (hasPanels) {
        config.panels.forEach(panelData => {
            uiActions.addCard(panelData);
        });
    }

    // 4. ✅ LOGIQUE DE VISIBILITÉ RIGUREUSE
    const iaContainer = document.getElementById('ia-container-accordion');
    const albertAction = document.getElementById('albert-action-accordion');
    const responseArea = document.getElementById('ia-response-accordion');

    // Affichage du chantier Albert si un prompt existe
    if (config.iaPrompt) {
        if (iaContainer) iaContainer.style.display = 'block';
        if (albertAction) albertAction.style.display = 'block';

        // Si les panneaux sont déjà là, on cache le JSON "parasite" pour un éditeur propre
        if (hasPanels && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'none';
        } else if (!hasPanels && config.iaResponse && responseArea && responseArea.parentElement) {
            // Si pas de panneaux, on montre le JSON pour permettre la validation
            responseArea.parentElement.style.display = 'block';
            responseArea.style.minHeight = '300px';
        }
    }

    // 5. Affichage automatique des sections de l'éditeur
    if (hasPanels) {
        const itemsSec = document.getElementById('accordion-items-section');
        const generateSec = document.getElementById('generate-section');
        
        if (itemsSec) itemsSec.style.display = 'block';
        if (generateSec) generateSec.style.display = 'block';
    }

    // Mise à jour de l'état des boutons UI
    if (uiActions.updateBtn) uiActions.updateBtn();
}