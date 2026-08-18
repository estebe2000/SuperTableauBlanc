// Fichier: modules/utils/states/dragndrop-state.js
import { logger } from '../logger.js';
import { getFeedbackIntervallesData, setFeedbackIntervallesData } from '../helpers.js';

/**
 * CAPTURE L'ÉTAT COMPLET DE LA CATÉGORISATION (Export)
 */
export function getDragNDropState(container, internalData) {
    try {
        logger.log('📊 Capture de l\'état Drag & Drop (Catégorisation)...');
        
        if (!container) throw new Error("Conteneur UI introuvable.");

        return {
            type: 'categorisation', // 🌟 C'est ce type qui permet la restauration globale
            titre: container.querySelector('#cat-title')?.value || '',
            consigne: container.querySelector('#cat-consigne')?.value || '',
            layoutMode: container.querySelector('#cat-layout-mode')?.value || 'table',
            
            iaPrompt: container.querySelector('#ia-prompt-cat')?.value || '',
            iaResponse: container.querySelector('#ia-response-cat')?.value || '',
            
            uploadedImageURL: internalData.uploadedImageURL || null,
            fabricJSONState: internalData.fabricJSONState || null, // 👈 AJOUT ICI POUR L'EXPORT
            
            zones: JSON.parse(JSON.stringify(internalData.zones || [])),
            elements: JSON.parse(JSON.stringify(internalData.elements || [])),
            
            freeDrop: container.querySelector('#cat-free-drop')?.checked ?? true,
            scorePartial: container.querySelector('#cat-score-partial')?.checked ?? true,
            backgroundOpacity: parseInt(container.querySelector('#cat-background-opacity')?.value || 100, 10),
            
            behaviour: {
                enableRetry: container.querySelector('#cat-enable-retry')?.checked ?? true,
                singlePoint: container.querySelector('#cat-single-point')?.checked ?? false,
                applyPenalties: container.querySelector('#cat-apply-penalties')?.checked ?? true,
                enableScoreExplanation: container.querySelector('#cat-enable-score-explanation')?.checked ?? true,
                dropZoneHighlighting: container.querySelector('#cat-drop-zone-highlighting')?.value || 'dragging',
                autoAlignSpacing: parseInt(container.querySelector('#cat-auto-align-spacing')?.value || 2, 10),
                enableFullScreen: container.querySelector('#cat-enable-fullscreen')?.checked ?? true,
                showScorePoints: container.querySelector('#cat-show-score-points')?.checked ?? true,
                showTitle: container.querySelector('#cat-show-title')?.checked ?? true
            },
            
            overallFeedback: getFeedbackIntervallesData('cat') || []
        };
    } catch (e) {
        logger.error("❌ Erreur critique lors de l'export de l'état Catégorisation:", e);
        return null;
    }
}

/**
 * RESTAURE L'ÉTAT COMPLET DE LA CATÉGORISATION (Import)
 */
export function setDragNDropState(container, config, uiActions) {
    if (!config || config.type !== 'categorisation' || !container) return;

    try {
        logger.log('🔄 Restauration rigoureuse du Drag & Drop...');

        const setVal = (id, val) => { const el = container.querySelector(`#${id}`); if (el && val !== undefined) el.value = val; };
        const setCheck = (id, val) => { const el = container.querySelector(`#${id}`); if (el && val !== undefined) el.checked = val; };

        // 1. Textes et Layout
        setVal('cat-title', config.titre);
        setVal('cat-consigne', config.consigne);
        
        const layoutSelect = container.querySelector('#cat-layout-mode');
        if (layoutSelect && config.layoutMode) {
            layoutSelect.value = config.layoutMode;
            layoutSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // 2. Chantier IA
        setVal('ia-prompt-cat', config.iaPrompt);
        setVal('ia-response-cat', config.iaResponse);

        // 3. Réglages H5P
        setCheck('cat-free-drop', config.freeDrop);
        setCheck('cat-score-partial', config.scorePartial);
        setVal('cat-background-opacity', config.backgroundOpacity);

        if (config.behaviour) {
            setCheck('cat-enable-retry', config.behaviour.enableRetry);
            setCheck('cat-single-point', config.behaviour.singlePoint);
            setCheck('cat-apply-penalties', config.behaviour.applyPenalties);
            setCheck('cat-enable-score-explanation', config.behaviour.enableScoreExplanation);
            setVal('cat-drop-zone-highlighting', config.behaviour.dropZoneHighlighting);
            setVal('cat-auto-align-spacing', config.behaviour.autoAlignSpacing);
            setCheck('cat-enable-fullscreen', config.behaviour.enableFullScreen);
            setCheck('cat-show-score-points', config.behaviour.showScorePoints);
            setCheck('cat-show-title', config.behaviour.showTitle);
        }

        if (config.overallFeedback && config.overallFeedback.length > 0) {
            setFeedbackIntervallesData('cat', config.overallFeedback);
        }

        // 4. Logique de Visibilité IA
        const iaContainer = container.querySelector('#ia-container-cat');
        const albertAction = container.querySelector('#albert-action-cat');
        const responseArea = container.querySelector('#ia-response-cat');

        if (config.iaPrompt) {
            if (iaContainer) iaContainer.style.display = 'block';
            if (albertAction) albertAction.style.display = 'block';

            if (config.zones && config.zones.length > 0 && responseArea && responseArea.parentElement) {
                responseArea.parentElement.style.display = 'none';
            } else if (config.iaResponse && responseArea && responseArea.parentElement) {
                responseArea.parentElement.style.display = 'block';
                responseArea.style.minHeight = '300px';
            }
        }
        
        if (config.zones && config.zones.length > 0) {
            const previewSection = container.querySelector('#cat-preview-section');
            if (previewSection) previewSection.style.display = 'block';
        }

        // 5. Restauration des données privées
        if (uiActions && uiActions.restoreInternalData) {
            uiActions.restoreInternalData({
                zones: config.zones || [],
                elements: config.elements || [],
                uploadedImageURL: config.uploadedImageURL || null,
                fabricJSONState: config.fabricJSONState || null // 👈 AJOUT ICI POUR L'IMPORT
            });
        }
    } catch (e) {
        logger.error("❌ Erreur lors de la restauration de l'état Catégorisation:", e);
    }
}