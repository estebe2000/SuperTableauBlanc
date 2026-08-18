// Fichier: modules/utils/states/h5p-3d-state.js
import { logger } from '../logger.js';

// --- UTILITAIRES BASE64 ---
function base64ToFile(dataurl, filename) {
    if (!dataurl || !dataurl.includes(',')) return null;
    try {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return new File([u8arr], filename, { type: mime });
    } catch (e) {
        return null;
    }
}

/**
 * CAPTURE L'ÉTAT COMPLET DES MOLÉCULES 3D (Export)
 */
export function getH5P3DState(moleculesMap) {
    const molecules = [];
    const cards = document.querySelectorAll('#molecules-list-container-3d .molecule-card');
    
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const btn = card.querySelector('.btn-generate-glb');
        if (!btn) continue;

        const pubchemName = btn.dataset.name || card.querySelector('input[type="text"]')?.value;
        const modelData = moleculesMap ? moleculesMap.get(pubchemName) : null;
        
        const isGenerated = btn.classList.contains('success') || (modelData != null);
        
        const titleInput = card.querySelector('input[id^="mol-title-"]') || card.querySelector('.mol-title');
        const titreMolecule = titleInput ? titleInput.value : '';

        // Les annotations (hotspots) sont toujours enregistrées en direct dans la Map par l'éditeur
        const hotspots = modelData && modelData.hotspots ? modelData.hotspots : [];

        molecules.push({
            nom_pubchem: pubchemName,
            formule: (modelData && modelData.formula) ? modelData.formula : (card.querySelector('.molecule-formula')?.textContent || ''),
            titre: titreMolecule,
            isGenerated: isGenerated,
            hotspots: hotspots, 
            models: {
                glb: (modelData && modelData.glbB64) ? { data: modelData.glbB64, name: `${pubchemName}.glb` } : null,
                obj: (modelData && modelData.objB64) ? { data: modelData.objB64, name: `${pubchemName}.obj` } : null,
                stl: (modelData && modelData.stlB64) ? { data: modelData.stlB64, name: `${pubchemName}.stl` } : null
            }
        });
    }

    return {
        type: 'h5p-3d',
        titre: document.getElementById('h5p-3d-title')?.value || '',
        consignes: document.getElementById('h5p-3d-task')?.value || '',
        //niveau: document.getElementById('global-niveau')?.value || 'Lycée',
        //langue: document.getElementById('global-language')?.value || 'Français',
        translateUI: document.getElementById('translate-ui-3d')?.checked ?? true,
        passPercentage: parseInt(document.getElementById('h5p-3d-passPercentage')?.value || "50", 10),
        feedbackFail: document.getElementById('h5p-3d-feedback-fail')?.value || '',
        feedbackSuccess: document.getElementById('h5p-3d-feedback-success')?.value || '',
        iaPrompt: document.getElementById('ia-prompt-3d')?.value || '',
        iaResponse: document.getElementById('ia-response-3d')?.value || '',
        molecules: molecules
    };
}

/**
 * RESTAURE L'ÉTAT ET RECONSTRUIT LE VISUEL COMPLET (Import)
 */
export function setH5P3DState(config, uiActions) {
    if (config.type !== 'molecules-3d' && config.type !== 'h5p-3d') return;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    setVal('h5p-3d-title', config.titre);
    setVal('h5p-3d-task', config.consignes);
    //setVal('global-niveau', config.niveau);
    //setVal('global-language', config.langue);
    setCheck('translate-ui-3d', config.translateUI ?? true);
    setVal('h5p-3d-passPercentage', config.passPercentage || 50);
    setVal('h5p-3d-feedback-fail', config.feedbackFail);
    setVal('h5p-3d-feedback-success', config.feedbackSuccess);
    setVal('ia-prompt-3d', config.iaPrompt);
    setVal('ia-response-3d', config.iaResponse);

    if (uiActions.clearPreview) uiActions.clearPreview();

    const hasMolecules = config.molecules && config.molecules.length > 0;

    if (hasMolecules) {
        config.molecules.forEach((mol) => {
            let glbFile = null, objFile = null, stlFile = null;
            if (mol.models?.glb) glbFile = base64ToFile(mol.models.glb.data, mol.models.glb.name);
            if (mol.models?.obj) objFile = base64ToFile(mol.models.obj.data, mol.models.obj.name);
            if (mol.models?.stl) stlFile = base64ToFile(mol.models.stl.data, mol.models.stl.name);

            if (uiActions.restoreModel) {
                uiActions.restoreModel(mol.nom_pubchem, {
                    title: mol.titre || mol.nom_pubchem, // 🟢 FIX: On ajoute le titre !
                    originalName: mol.nom_pubchem,       // 🟢 FIX: On ajoute le nom original !
                    formula: mol.formule,
                    fileBlob: glbFile, 
                    objBlob: objFile,
                    stlBlob: stlFile,
                    glbB64: mol.models?.glb?.data || null,
                    objB64: mol.models?.obj?.data || null,
                    stlB64: mol.models?.stl?.data || null,
                    hotspots: mol.hotspots || [] 
                });
            }
        });

// 1. Dessine l'en-tête de base
        if (uiActions.renderList) uiActions.renderList(config.molecules);

        // 2. Reconstruit fidèlement les boutons et la formule
        setTimeout(() => {
            config.molecules.forEach((mol, index) => {
                if (mol.isGenerated && uiActions.restoreCardUI) {
                    uiActions.restoreCardUI(index, mol);
                }
            });
            
            // 🟢 DÉPLACEMENT : La validation se lance UNE FOIS le rendu terminé !
            if (uiActions.updateBtn) uiActions.updateBtn();
            
        }, 150);
    }

    const iaContainer = document.getElementById('ia-container-3d');
    const responseArea = document.getElementById('ia-response-3d');

    if (config.iaPrompt) {
        if (iaContainer) iaContainer.style.display = 'block';
        document.getElementById('albert-action-3d').style.display = 'block';

        if (hasMolecules && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'none';
        } else if (!hasMolecules && config.iaResponse && responseArea && responseArea.parentElement) {
            responseArea.parentElement.style.display = 'block';
            responseArea.style.minHeight = '300px';
        }
    }

    if (hasMolecules) {
        document.getElementById('molecules-list-section-3d').style.display = 'block';
        document.getElementById('generate-section').style.display = 'block';
    }

    // 🔴 ATTENTION : Retirez le "if (uiActions.updateBtn) uiActions.updateBtn();" 
    // qui se trouvait ici à l'origine, il est désormais dans le setTimeout !
}