// Fichier: modules/utils/states/dictation-state.js
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

function base64ToFile(dataurl, filename) {
    if (!dataurl || typeof dataurl !== 'string' || !dataurl.includes(',')) return null;
    try {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return new File([u8arr], filename, { type: mime });
    } catch (e) {
        console.error("Erreur de conversion Base64 pour :", filename, e);
        return null;
    }
}

/**
 * CAPTURE L'ÉTAT COMPLET (Export)
 */
export async function getDictationState(audioFilesMap) {
    const sentences = [];
    // ✅ RIGUEUR : On cible les cartes du container dictation
    const cards = document.querySelectorAll('#dictation-statements-container .card');
    
    for (const card of cards) {
        const id = card.id;
        const entry = audioFilesMap.get(id); // entry = { normal, slow }
        
        let normalB64 = null, slowB64 = null;
        let normalName = 'audio.mp3', slowName = 'audio_slow.mp3';

        if (entry?.normal) {
            normalB64 = await fileToBase64(entry.normal);
            normalName = entry.normal.name;
        }
        if (entry?.slow) {
            slowB64 = await fileToBase64(entry.slow);
            slowName = entry.slow.name;
        }

        sentences.push({
            // ✅ CORRECTION SÉLECTEUR : .statement-text (conforme à ton dictation-ui.js)
            text: card.querySelector('.statement-text')?.value.trim() || '',
            audioNormal: normalB64 ? { data: normalB64, name: normalName } : null,
            audioSlow: slowB64 ? { data: slowB64, name: slowName } : null
        });
    }

    return {
        type: 'dictation',
        titre: document.getElementById('dictationTitle')?.value || '',
        //niveau: document.getElementById('global-niveau')?.value || 'Cycle 3',
        //langue: document.getElementById('global-language')?.value || 'Français',
        consignes: document.getElementById('dictationTask')?.value || '',
        translateUI: document.getElementById('translate-ui-dictation')?.checked ?? true,
        readPunctuation: document.getElementById('read-punctuation-checkbox')?.checked ?? true,
        generateSlow: document.getElementById('generate-slow-audio')?.checked ?? false,
        
        passPercentage: parseInt(document.getElementById('dictation-passPercentage')?.value || "67", 10),
        feedbackFail: document.getElementById('dictation-feedback-fail')?.value || '',
        feedbackSuccess: document.getElementById('dictation-feedback-success')?.value || '',
        
        globalGender: document.getElementById('global-ai-gender')?.value || 'female',
        globalAccent: document.getElementById('global-ai-accent')?.value || 'FR',
        
        // ✅ SAUVEGARDE IA
        iaPrompt: document.getElementById('ia-prompt-dictation')?.value || '',
        iaResponse: document.getElementById('ia-response-dictation')?.value || '',
        
        sentences: sentences
    };
}

/**
 * RESTAURE L'ÉTAT COMPLET (Import)
 */
export function setDictationState(config, uiActions) {
    if (config.type !== 'dictation') return;

    logger.log('🔄 Restauration rigoureuse de la Dictée...');

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // 1. Paramètres globaux
    setVal('dictationTitle', config.titre);
    setVal('dictationTask', config.consignes);
    //setVal('global-niveau', config.niveau);
    //setVal('global-language', config.langue);
    setCheck('translate-ui-dictation', config.translateUI);
    setCheck('read-punctuation-checkbox', config.readPunctuation);
    setCheck('generate-slow-audio', config.generateSlow);
    setVal('dictation-passPercentage', config.passPercentage);
    setVal('dictation-feedback-fail', config.feedbackFail);
    setVal('dictation-feedback-success', config.feedbackSuccess);
    setVal('global-ai-gender', config.globalGender);
    setVal('global-ai-accent', config.globalAccent);

    // 2. Restauration IA
    setVal('ia-prompt-dictation', config.iaPrompt);
    setVal('ia-response-dictation', config.iaResponse);

    // 3. Reconstruction des phrases
    uiActions.clearPreview();

    if (config.sentences && config.sentences.length > 0) {
        config.sentences.forEach((sData, index) => {
            const normalFile = base64ToFile(sData.audioNormal?.data, sData.audioNormal?.name);
            const slowFile = base64ToFile(sData.audioSlow?.data, sData.audioSlow?.name);

            // ✅ INJECTION : addCard attend 'text' pour addDictationStatement
            uiActions.addCard({ 
                text: sData.text, 
                normalFile: normalFile, 
                slowFile: slowFile 
            });

            // ✅ RIGUEUR EXTRÊME : Forçage manuel différé si l UI est trop lente
            setTimeout(() => {
                const cards = document.querySelectorAll('#dictation-statements-container .card');
                const card = cards[index];
                if (card && sData.text) {
                    const input = card.querySelector('.statement-text');
                    if (input) {
                        input.value = sData.text;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            }, 150);
        });
    }

    // 4. LOGIQUE DE VISIBILITÉ IA
    const iaContainer = document.getElementById('ia-container-dictation');
    const albertAction = document.getElementById('albert-action-dictation');
    const responseArea = document.getElementById('ia-response-dictation');
    const hasSentences = config.sentences && config.sentences.length > 0;

    if (config.iaPrompt) {
        if (iaContainer) iaContainer.style.display = 'block';
        if (albertAction) albertAction.style.display = 'block';
        
        // On cache le JSON si les phrases sont déjà là
        if (hasSentences && responseArea?.parentElement) {
            responseArea.parentElement.style.display = 'none';
        }
    }

    if (hasSentences) {
        document.getElementById('dictation-preview-section').style.display = 'block';
        document.getElementById('generate-section').style.display = 'block';
    }

    if (uiActions.updateBtn) uiActions.updateBtn();
}