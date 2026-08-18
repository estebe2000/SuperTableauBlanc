// Fichier : modules/generation/activities/molecules3D-generator.js
import { JSZip, logger, getH5PLangCode, getDependencyObject, getH5PLocalization, generateUUID } from '../generator-utils.js';

// ==========================================
// MÉTHODES GÉNÉRATION 3D (STANDALONE - HARDCODED PAR SÉCURITÉ)
// ==========================================

// 1. Outil interne (pas exporté)
async function telechargerEtAjouterAuZip(zip, urlPublique, typeContenu = "files") {
    const response = await fetch(urlPublique);
    if (!response.ok) throw new Error(`Erreur téléchargement GLB : ${response.status}`);
    const blob = await response.blob();
    const nomFichier = `model-${generateUUID().substring(0, 8)}.glb`;
    zip.file(`content/${typeContenu}/${nomFichier}`, blob, { createFolders: false, binary: true });
    return { cheminRelatif: `${typeContenu}/${nomFichier}` };
}

// 2. Générateur H5P 3D
export async function genererH5PStandaloneThreeDModel(modelData, libsZipBlob = null) {
    logger.log(`📦 Génération H5P 3D pour ${modelData.title} (MODE STANDALONE)...`);
    const zip = new JSZip();

    if (libsZipBlob) {
        try {
            const sourceZip = await JSZip.loadAsync(libsZipBlob);
            const promises = [];
            sourceZip.forEach((relativePath, fileEntry) => {
                if (!fileEntry.dir) {
                    promises.push(fileEntry.async("uint8array").then(content => zip.file(relativePath, content)));
                }
            });
            await Promise.all(promises);
        } catch (e) { logger.error("Erreur injection libs : " + e.message); }
    }

    const langCode = getH5PLangCode();
    const h5pJson = {
        "title": modelData.title || "Activité HAPI",
        "language": langCode,
        "defaultLanguage": langCode,
        "mainLibrary": "H5P.ThreeDModel",
        "embedTypes": ["div"], "license": "U",
        "preloadedDependencies": [
            { "machineName": "H5P.JoubelUI", "majorVersion": 1, "minorVersion": 3 },
            { "machineName": "H5P.ThreeDModel", "majorVersion": 1, "minorVersion": 0 },
            { "machineName": "H5P.ThreeJS", "majorVersion": 1, "minorVersion": 0 },
            { "machineName": "FontAwesome", "majorVersion": 4, "minorVersion": 5 }
        ],
        "editorDependencies": [
            { "machineName": "H5PEditor.ThreeDModelEditor", "majorVersion": 1, "minorVersion": 0 },
            { "machineName": "H5PEditor.ColorSelector", "majorVersion": 1, "minorVersion": 3 }
        ]
    };

    let cheminGLB;
    try {
        // CORRECTION : Appel direct de la fonction sans "this."
        const res = await telechargerEtAjouterAuZip(zip, modelData.url, "files");
        cheminGLB = res.cheminRelatif;
    } catch(e) { throw new Error("Impossible d'intégrer le modèle 3D au ZIP."); }

    const annotationsH5P = (modelData.hotspots || []).map((h, i) => ({
        id: generateUUID(), text: h.text || `Info ${i+1}`, surface: h.surface
    })).filter(a => a.surface);

    const contentJson = {
        "title": modelData.title,
        "model": { "file": { "path": cheminGLB, "mime": "model/gltf-binary" }, "zoom": 1, "view": "orbit" },
        "behaviour": { "autoRotate": false, "cameraControls": true }
    };
    if (annotationsH5P.length > 0) { contentJson.annotations = { annotations: annotationsH5P }; }

    zip.file("h5p.json", JSON.stringify(h5pJson, null, 2));
    zip.file("content/content.json", JSON.stringify(contentJson, null, 2));

    return await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

// 3. Visualiseur HTML 3D
export async function genererZIPViewer(modelData) {
    logger.log(`📦 Génération ZIP Viewer...`);
    const zip = new JSZip();
    
    const response = await fetch(modelData.url);
    zip.file("modele.glb", await response.blob(), { binary: true }); 

    let hotspotsHTML = (modelData.hotspots || []).map((h, i) => `
        <button class="hotspot" slot="hotspot-${i}" data-position="${h.vector.x} ${h.vector.y} ${h.vector.z}" data-normal="0 1 0">
            <div class="annotation">${h.text || `Info ${i+1}`}</div>
        </button>`).join('\n');

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${modelData.title}</title>
<script type="module" src="./model-viewer.min.js"></script>
<style>
@font-face{font-family:'Marianne';src:url('fonts/Marianne-Regular.woff2') format('woff2');font-weight:400;font-display:swap}@font-face{font-family:'Marianne';src:url('fonts/Marianne-Bold.woff2') format('woff2');font-weight:700;font-display:swap}body{margin:0;height:100vh;background-color:#f0f2f5;font-family:'Marianne','Segoe UI',sans-serif}model-viewer{width:100%;height:100%}
.hotspot{display:block;width:14px;height:14px;border-radius:50%;border:none;background-color:#2196F3;box-shadow:0 0 0 3px #ffffff;cursor:pointer;position:relative;animation:pulse 2s infinite}
.hotspot:hover{transform:scale(1.3);background-color:#1976D2;z-index:100;animation:none}
.annotation{background-color:#ffffff;color:#2c3e50;position:absolute;transform:translate(15px,-50%);top:50%;left:10px;border-radius:4px;padding:5px 10px;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.15);white-space:nowrap;border-left:3px solid #2196F3}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(33,150,243,0.7),0 0 0 3px #ffffff}70%{box-shadow:0 0 0 6px rgba(33,150,243,0),0 0 0 3px #ffffff}100%{box-shadow:0 0 0 0 rgba(33,150,243,0),0 0 0 3px #ffffff}}
</style></head><body>
<model-viewer src="modele.glb" camera-controls auto-rotate shadow-intensity="1" shadow-softness="1" alt="Modèle 3D">
${hotspotsHTML}
</model-viewer></body></html>`;
    
    zip.file("index.html", html);

    // RGPD : on embarque model-viewer dans le paquet (plus aucun appel Google
    // côté élève). Le GLB exporté étant non compressé, aucun décodeur distant.
    try {
        const mvUrl = new URL('../../../../vendor/model-viewer/model-viewer.min.js', import.meta.url).href;
        const mvJs = await (await fetch(mvUrl)).text();
        zip.file("model-viewer.min.js", mvJs);
    } catch (e) {
        logger.error("Embarquement model-viewer échoué : " + e.message);
    }

    // Charte : police Marianne (souveraine) embarquée dans le paquet.
    for (const __mf of ['Marianne-Regular.woff2', 'Marianne-Bold.woff2']) {
        try { zip.file('fonts/' + __mf, await (await fetch(new URL('../../../../css/fonts/' + __mf, import.meta.url).href)).arrayBuffer(), { binary: true }); } catch (__e) {}
    }

    return { blob: await zip.generateAsync({ type: "blob" }), fileName: "viewer.zip" };
}

// 4. Génération par lot
export async function genererZIPMoleculesLot(donnees) {
    logger.log(`📦 Génération ZIP Global des molécules (Correction Structure)...`);
    const mainZip = new JSZip();
    let count = 0;

    if (donnees && donnees.molecules && donnees.molecules.length > 0) {
        for (const mol of donnees.molecules) {
            if (mol.glbB64 && mol.url) {
                let safeMolName = (mol.title || mol.originalName || "molecule_inconnue")
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();

                const molFolder = mainZip.folder(safeMolName);
                const base64Brut = mol.glbB64.split(',')[1];
                
                if (base64Brut) {
                    molFolder.file(`${safeMolName}.glb`, base64Brut, { base64: true });
                }

                try {
                    // CORRECTION : Appels directs sans "this."
                    const h5pBlob = await genererH5PStandaloneThreeDModel(mol, null);
                    molFolder.file(`${safeMolName}.h5p`, h5pBlob);

                    const viewerRes = await genererZIPViewer(mol);
                    molFolder.file(`${safeMolName}.zip`, viewerRes.blob);
                
                    const singleJsonData = {
                        type: 'h5p-3d', 
                        titre: "Export_Individuel",
                        molecules: [{
                            nom_pubchem: mol.originalName, formule: mol.formula,
                            titre: mol.title, isGenerated: true,
                            hotspots: mol.hotspots || [],
                            models: { glb: { data: mol.glbB64, name: `${safeMolName}.glb` } }
                        }]
                    };
                    molFolder.file(`sauvegarde_${safeMolName}.json`, JSON.stringify(singleJsonData, null, 2));

                    count++;
                } catch (e) {
                    logger.error(`Erreur génération sous-fichiers pour ${safeMolName}:`, e);
                    if (base64Brut) count++;
                }
            }
        }
    }

    if (count === 0) {
        throw new Error("Aucun modèle 3D n'a été généré. Veuillez générer au moins une molécule.");
    }

    const blob = await mainZip.generateAsync({ type: "blob", compression: "DEFLATE" });
    return { blob, fileName: `Lot_Molecules_3D_${Date.now()}.zip` };
}

// ==========================================
// EXPORTS WRAPPERS (Pour compatibilité app.js)
// ==========================================

export async function genererH5PModele(modelData, libsZipBlob = null) {
    // Plus d'instanciation de classe ! On appelle juste la fonction.
    return await genererH5PStandaloneThreeDModel(modelData, libsZipBlob);
}

export async function genererZIPModele(modelData) {
    // Idem
    const res = await genererZIPViewer(modelData);
    return res.blob;
}