// Fichier: modules/utils/states/cards-state.js
import { logger } from '../logger.js';

// --- UTILITAIRES DE CONVERSION (Identiques à ton original) ---
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function base64ToFile(dataurl, filename) {
    if (!dataurl) return null;
    try {
        let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--){ u8arr[n] = bstr.charCodeAt(n); }
        return new File([u8arr], filename, {type:mime});
    } catch(e) { return null; }
}

function imageToDataURL(imgElement) {
    if (!imgElement || !imgElement.src || imgElement.style.display === 'none') return null;
    if (imgElement.src.startsWith('data:')) return imgElement.src;
    try {
        const canvas = document.createElement('canvas');
        // On respecte tes dimensions originales
        canvas.width = imgElement.naturalWidth || 300;
        canvas.height = imgElement.naturalHeight || 300;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.85);
    } catch (e) { return null; }
}

/**
 * CAPTURE L'ÉTAT COMPLET (Export)
 */
export async function getCardsState(cardImagesMap, cardAudiosMap) {
    const cards = [];
    const domCards = document.querySelectorAll('#cards-list .card');
    
    for (const card of domCards) {
        const id = card.id;
        const activeTab = card.querySelector('.img-tab-btn.active')?.dataset.target || 'upload';
        
        let imgB64 = null;
        let imgName = 'image.jpg';

        const localFile = cardImagesMap.get(id);
        if (localFile) {
            imgB64 = await fileToBase64(localFile);
            imgName = localFile.name;
        } else {
            const iaImg = card.querySelector('.ia-generated-img');
            const wikiImg = card.querySelector('.wiki-img-preview');
            if (activeTab === 'ia') imgB64 = imageToDataURL(iaImg);
            else if (activeTab === 'wiki') imgB64 = imageToDataURL(wikiImg);
        }

        let audioB64 = null, audioName = '';
        const audioFile = cardAudiosMap.get(id);
        if (audioFile) { 
            audioB64 = await fileToBase64(audioFile); 
            audioName = audioFile.name; 
        }

        cards.push({
            front: card.querySelector('.card-front')?.value || '',
            back: card.querySelector('.card-back')?.value || '',
            tips: { 
                front: card.querySelector('.card-tip-front')?.value || '', 
                back: card.querySelector('.card-tip-back')?.value || '' 
            },
            ui: {
                activeImgTab: activeTab,
                wikiSearch: card.querySelector('.wiki-search-input')?.value || '',
                wikiCredits: card.querySelector('.wiki-img-credits')?.innerText || '',
                iaPrompt: card.querySelector('.ia-prompt-input')?.value || ''
            },
            media: {
                image: imgB64 ? { data: imgB64, name: imgName } : null,
                audio: audioB64 ? { data: audioB64, name: audioName } : null
            }
        });
    }

    return {
        type: 'cards',
        titre: document.getElementById('cards-title')?.value || '',
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 2',
        consignes: document.getElementById('cards-task')?.value || '',
        //langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-cards')?.checked ?? true,
        mode: document.querySelector('input[name="cards-mode"]:checked')?.value || 'dialog',
        passPercentage: parseInt(document.getElementById('cards-passPercentage')?.value || "50", 10),
        feedbackFail: document.getElementById('cards-feedback-fail')?.value || '',
        feedbackSuccess: document.getElementById('cards-feedback-success')?.value || '',
        options: {
            disableBack: document.getElementById('opt-disable-back')?.checked || false,
            random: document.getElementById('opt-random')?.checked || false,
            caseSensitive: document.getElementById('opt-case-sensitive')?.checked || false,
            generateTips: document.getElementById('cards-generate-tips')?.checked || false
        },
        // ✅ PROMPT ALBERT PRÉSERVÉ
        iaPrompt: document.getElementById('ia-prompt-cards')?.value || '',
        iaResponse: document.getElementById('ia-response-cards')?.value || '',
        cards: cards
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET (Import)
 */
export function setCardsState(config, uiActions) {
    if (config.type !== 'cards') return;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Mode
    const modeRadios = document.getElementsByName('cards-mode');
    modeRadios.forEach(r => { if (r.value === config.mode) { r.checked = true; } });

    // 2. Paramètres
    setVal('cards-title', config.titre);
    //setVal('global-niveau', config.niveau);
    //setVal('global-language', config.langue);
    setVal('cards-task', config.consignes);
    setCheck('translate-ui-cards', config.translateUI);
    setVal('cards-passPercentage', config.passPercentage || 50);
    setVal('cards-feedback-fail', config.feedbackFail);
    setVal('cards-feedback-success', config.feedbackSuccess);

    // 3. IA : Prompt et Réponse
    setVal('ia-prompt-cards', config.iaPrompt);
    setVal('ia-response-cards', config.iaResponse);

    // 4. Options
    setTimeout(() => {
        if (config.options) {
            setCheck('opt-disable-back', config.options.disableBack);
            setCheck('opt-random', config.options.random);
            setCheck('opt-case-sensitive', config.options.caseSensitive);
            setCheck('cards-generate-tips', config.options.generateTips);
        }
    }, 150);

    // 5. Reconstruction des cartes (Sans forçage CSS parasite)
    uiActions.clearPreview();
    if (config.cards) {
        config.cards.forEach((c, index) => {
            let img = null, aud = null;
            if (c.media?.image) img = base64ToFile(c.media.image.data, c.media.image.name);
            if (c.media?.audio) aud = base64ToFile(c.media.audio.data, c.media.audio.name);
            
            // On utilise ta fonction UI originale
            uiActions.addCard({ ...c, imgFile: img, audioFile: aud });

            // On restaure l'onglet et les champs locaux après un court délai
            setTimeout(() => {
                const domCards = document.querySelectorAll('#cards-list .card');
                const card = domCards[index];
                if (card && c.ui) {
                    const tabBtn = card.querySelector(`.img-tab-btn[data-target="${c.ui.activeImgTab}"]`);
                    if (tabBtn) tabBtn.click();
                    if (card.querySelector('.wiki-search-input')) card.querySelector('.wiki-search-input').value = c.ui.wikiSearch || '';
                    if (card.querySelector('.ia-prompt-input')) card.querySelector('.ia-prompt-input').value = c.ui.iaPrompt || '';
                }
            }, 200);
        });
        
        // ✅ GESTION VISIBILITÉ ALBERT
        const iaContainer = document.getElementById('ia-container-cards');
        const albertAction = document.getElementById('albert-action-cards');
        const responseArea = document.getElementById('ia-response-cards');

        if (config.iaPrompt) {
            if (iaContainer) iaContainer.style.display = 'block';
            if (albertAction) albertAction.style.display = 'block';
            // On cache le JSON si les cartes sont là
            if (responseArea && responseArea.parentElement) {
                responseArea.parentElement.style.display = 'none';
            }
        }

        document.getElementById('cards-preview-section').style.display = 'block';
        document.getElementById('cards-options-section').style.display = 'block';
        document.getElementById('generate-section').style.display = 'block';
        
        if(uiActions.updateBtn) uiActions.updateBtn();
    }
}