// Fichier: modules/utils/states/image-pairing-state.js
import { logger } from '../logger.js';

// --- UTILITAIRES DE CONVERSION ---
function fileToBase64(file) {
    return new Promise((resolve) => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

function imageToDataURL(imgElement) {
    // Ne pas capturer si l'image est absente, masquée ou s'il s'agit du placeholder SVG
    if (!imgElement || !imgElement.src || imgElement.src.includes('svg+xml') || imgElement.style.display === 'none') return null;
    if (imgElement.src.startsWith('data:image')) return imgElement.src;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth || 400;
        canvas.height = imgElement.naturalHeight || 400;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.85);
    } catch (e) { 
        // Si erreur CORS (Wikimedia), on conserve l'URL brute par défaut
        return imgElement.src; 
    }
}

/**
 * CAPTURE L'ÉTAT COMPLET DE L'APPARIEMENT (Export)
 */
export async function getImagePairingState() {
    const pairs = [];
    const domCards = document.querySelectorAll('#imgpair-list .card');
    
    for (const card of domCards) {
        const pair = { left: {}, right: {} };
        
        for (const side of ['left', 'right']) {
            const mode = card.querySelector(`.type-select[data-side="${side}"]`)?.value || 'text';
            
            // Capture des médias selon la source
            const iaPreview = card.querySelector(`.img-preview-${side}`);
            const wikiPreview = card.querySelector(`.img-preview-wiki-${side}`);
            const wikiSelected = card.querySelector(`.panel-wiki-selected-${side}`)?.style.display === 'block';
            const uploadInp = card.querySelector(`.input-file-${side}`);
            
            let uploadB64 = null;
            if (uploadInp && uploadInp.files[0]) {
                uploadB64 = await fileToBase64(uploadInp.files[0]);
            }

            pair[side] = {
                mode: mode,
                text: card.querySelector(`.input-text-${side}`)?.value || '',
                uploadB64: uploadB64,
                uploadName: uploadInp?.files[0]?.name || 'image.jpg',
                wikiSearch: card.querySelector(`.wiki-search-input-${side}`)?.value || '',
                wikiImgSrc: wikiSelected ? imageToDataURL(wikiPreview) : null,
                wikiCredits: card.querySelector(`.wiki-credits-${side}`)?.innerText || '',
                wikiSelected: wikiSelected,
                iaPrompt: card.querySelector(`.prompt-input-${side}`)?.value || '',
                iaB64: imageToDataURL(iaPreview)
            };
        }
        pairs.push(pair);
    }

    return {
        type: 'image-pairing',
        titre: document.getElementById('imgpair-title')?.value || '',
        consignes: document.getElementById('imgpairTask')?.value || '',
        
        // Rigueur : Récupération sur les menus globaux HAPI
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 2',
        //langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-imgpair')?.checked ?? true,
        
        // Seuils et feedbacks globaux
        passPercentage: parseInt(document.getElementById('imgpair-passPercentage')?.value || "50", 10),
        feedbackFail: document.getElementById('imgpair-feedback-fail')?.value || '',
        feedbackSuccess: document.getElementById('imgpair-feedback-success')?.value || '',
        
        // ✅ RIGUEUR IA : Sauvegarde du chantier Albert (Prompt & Réponse)
        iaPrompt: document.getElementById('ia-prompt-imgpair')?.value || '',
        iaResponse: document.getElementById('ia-response-imgpair')?.value || '',
        
        pairs: pairs
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET DE L'APPARIEMENT (Import)
 */
export function setImagePairingState(config, uiActions) {
    if (config.type !== 'image-pairing') return;

    logger.log('🔄 Restauration rigoureuse de l\'Appariement d\'images...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Restauration des réglages globaux et titres
    setVal('imgpair-title', config.titre);
    setVal('imgpairTask', config.consignes);
    //setVal('global-niveau', config.niveau || 'Cycle 2');
    //setVal('global-language', config.langue || 'Français');
    setCheck('translate-ui-imgpair', config.translateUI ?? true);
    
    // 2. Restauration des feedbacks et seuils
    setVal('imgpair-passPercentage', config.passPercentage || 50);
    setVal('imgpair-feedback-fail', config.feedbackFail || '');
    setVal('imgpair-feedback-success', config.feedbackSuccess || '');

    // 3. ✅ RIGUEUR IA : Restauration du chantier Albert
    setVal('ia-prompt-imgpair', config.iaPrompt || '');
    setVal('ia-response-imgpair', config.iaResponse || '');

    // 4. Nettoyage et reconstruction des paires via l'UI
    uiActions.clearPreview();

    const hasPairs = config.pairs && config.pairs.length > 0;

    if (hasPairs) {
        config.pairs.forEach(pairData => {
            uiActions.addCard(); 
            const card = document.getElementById('imgpair-list').lastElementChild;
            if (!card) return;

            ['left', 'right'].forEach(side => {
                const data = pairData[side];
                
                // Restauration du mode
                const sel = card.querySelector(`.type-select[data-side="${side}"]`);
                if (sel) { 
                    sel.value = data.mode; 
                    sel.dispatchEvent(new Event('change', { bubbles: true })); 
                }
                
                // Restauration du texte
                const txt = card.querySelector(`.input-text-${side}`);
                if (txt) txt.value = data.text;

                // Restauration du prompt IA local
                const iaPromptInp = card.querySelector(`.prompt-input-${side}`);
                if (iaPromptInp) iaPromptInp.value = data.iaPrompt || '';

                // Restauration visuelle des images (IA / Wiki / Upload)
                if (data.iaB64) {
                    const iaImg = card.querySelector(`.img-preview-${side}`);
                    if (iaImg) { iaImg.src = data.iaB64; iaImg.style.display = 'block'; iaImg.style.opacity = '1'; }
                }

                if (data.wikiSelected && data.wikiImgSrc) {
                    const wImg = card.querySelector(`.img-preview-wiki-${side}`);
                    if (wImg) { wImg.src = data.wikiImgSrc; wImg.style.display = 'block'; }
                    const wPan = card.querySelector(`.panel-wiki-selected-${side}`);
                    if (wPan) wPan.style.display = 'block';
                    card.querySelector(`.wiki-credits-${side}`).innerText = data.wikiCredits;
                    card.querySelector(`.wiki-search-input-${side}`).value = data.wikiSearch;
                }

                if (data.uploadB64) {
                    const upPrev = card.querySelector(`.img-preview-upload-${side}`);
                    if (upPrev) { upPrev.src = data.uploadB64; upPrev.style.display = 'block'; }
                    const upCont = card.querySelector(`.upload-preview-container-${side}`);
                    if (upCont) upCont.style.display = 'flex';
                }
            });
        });
    }

    // 5. ✅ LOGIQUE DE VISIBILITÉ RIGUREUSE
    const iaContainer = document.getElementById('ia-container-imgpair');
    const albertAction = document.getElementById('albert-action-imgpair');
    const responseArea = document.getElementById('ia-response-imgpair');

    // Affichage du chantier Albert si un prompt existe
    if (config.iaPrompt) {
        if (iaContainer) iaContainer.style.display = 'block';
        if (albertAction) albertAction.style.display = 'block';

        // Si les paires sont déjà là, on cache le JSON "parasite" pour un éditeur propre
        if (hasPairs && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'none';
        } else if (!hasPairs && config.iaResponse && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'block';
            responseArea.style.minHeight = '300px';
        }
    }

    // 6. Affichage automatique des sections de l'éditeur
    if (hasPairs) {
        const sections = ['preview-section-imgpair', 'imgpair-options-section', 'generate-section'];
        sections.forEach(id => { 
            const el = document.getElementById(id); 
            if (el) el.style.display = 'block'; 
        });
        if (uiActions.updatePairNumbers) uiActions.updatePairNumbers();
    }

    // Mise à jour de l'état des boutons UI
    if (uiActions.updateBtn) uiActions.updateBtn();
}