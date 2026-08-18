// Fichier: modules/ui/download-ui.js

import { logger } from '../utils/logger.js';
import { exporterGIFT, exporterMoodleXML, exporterODT, exporterPDF } from '../utils/export-helpers.js';
import { isPaneValid } from './activity-selector.js'; 

const ACTIVITY_NAMES_FR = {
    'quiz': 'Quiz (QCM)',
    'truefalse': 'Vrai / Faux',
    'quiz-math': 'Quiz Math',
    'truefalse-math': 'Vrai/Faux Math',
    'dictation': 'Dictée audio',
    'wordsearch': 'Mots mêlés',
    'markthewords': 'Mots à repérer',
    'dragtext': 'Étiquettes à déplacer',
    'advanced-blanks': 'Texte à trous',
    'crossword': 'Mots Croisés',
    'sortparagraphs': 'Paragraphes',
    'summary': 'Résumé',
    'accordion': 'Accordéon (Glossaire)',
    'cards': 'Cartes Mémoire',
    'image-pairing': 'Appariements',
    'timeline': 'Frise chronologique',
    'interactive-map': 'Carte interactive',
    'molecules-3d': 'Laboratoire 3D',
    'dragndrop': 'Glisser-déposer',
	'interactive-video': 'Vidéo interactive',
	 // 🌟 AJOUT ICI
};

export function renderFinalisationDashboard(container, activeTypes, appContext) {
    if (activeTypes.length === 0) {
        container.innerHTML = `
            <div class="section" style="background: transparent; padding: 0; border-radius: 0; box-shadow: none; text-align: center;">
                <h2 style="color: var(--text); margin-top: 0;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg> Tableau de bord de finalisation</h2>
                <div style="background: rgba(220, 38, 38, 0.10); border: 1px solid rgba(220, 38, 38, 0.35); padding: 20px; border-radius: 8px; margin-top: 20px;">
                    <p style="color: var(--danger-text); font-weight: bold; font-size: 1.1em;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:#b91c1c;"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> Aucune activité n'est sélectionnée pour l'export.</p>
                </div>
            </div>
        `;
        return;
    }

    const isSingle = activeTypes.length === 1;

    let allGenerated = true;
    activeTypes.forEach(type => {
        const pane = document.getElementById(`pane-${type}`);
        if (!pane || !isPaneValid(pane)) {
            allGenerated = false;
        }
    });

    let html = `
        <div class="section" style="background: transparent; padding: 0; border-radius: 0; box-shadow: none; animation: fadeIn 0.3s ease;">
            <p style="color: var(--text-muted); margin-top: 0; margin-bottom: 25px;">${isSingle ? 'Téléchargez votre activité sous différents formats.' : 'Téléchargez vos activités individuellement ou regroupez-les dans une archive complète.'}</p>
    `;

    html += `
            <h3 style="margin-bottom: 15px; color: var(--text);">${isSingle ? 'Formats d\'export disponibles' : 'Exports individuels par activité'}</h3>
            <div id="dash-individual-list" style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 35px;">
    `;

    activeTypes.forEach(type => {
        const typeName = ACTIVITY_NAMES_FR[type] || (type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' '));
    
        const peutExporterH5P = type !== 'interactive-map' && type !== 'molecules-3d';
        const peutExporterZIPStandalone = type === 'interactive-map';
        const peutExporterArchive3D = (!isSingle) && (type === 'molecules-3d' || type === 'h5p-3d');
    
        // SÉPARATION MOODLE / GIFT
        const peutExporterMoodle = ['quiz', 'quiz-math', 'truefalse', 'truefalse-math', 'advanced-blanks'].includes(type);
        const peutExporterGIFT = ['quiz', 'quiz-math', 'truefalse', 'truefalse-math'].includes(type);
        
        const peutExporterODT = ['quiz', 'quiz-math', 'truefalse', 'truefalse-math' , 'wordsearch' , 'markthewords' , 'dragtext' , 'advanced-blanks', 'crossword' , 'sortparagraphs' , 'summary' , 'accordion'].includes(type);
        
		// 🌟 AJOUT DE LA CATÉGORISATION DANS LES EXPORTS PDF ICI
		const peutExporterPDF = ['cards', 'image-pairing', 'timeline', 'interactive-map', 'dragndrop', 'interactive-video'].includes(type);
    
        const pane = document.getElementById(`pane-${type}`);
        const isThisValid = pane && isPaneValid(pane);
        const statusIcon = isThisValid
            ? '<svg class="status-ok-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path d="M7 12.4l3.3 3.3L17 8.9"/></svg>'
            : '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:#b91c1c;"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg>';
        const statusColor = isThisValid ? 'var(--text)' : 'var(--danger-text)';
        const statusText = isThisValid ? '' : '<span style="font-size:0.85em; color:var(--danger-text); margin-left:10px; font-weight:normal;">(Activité incomplète)</span>';

        let customTitle = "";
        if (pane) {
            const titleInput = pane.querySelector('input[id$="-title"], #dictationTitle, #map-subject, #cat-title');
            if (titleInput && titleInput.value.trim() !== '') {
                customTitle = `<div style="font-weight: normal; font-size: 0.85em; color: var(--text-muted); margin-top: 5px;"><i>${titleInput.value.trim()}</i></div>`;
            }
        }

        html += `
            <div style="border: 1px solid var(--border); border-radius: 8px; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; background: var(--page-bg); flex-wrap: wrap; gap: 15px;">
                <div style="font-weight: bold; font-size: 1.1em; color: ${statusColor};">
                    <div>${statusIcon} ${typeName} ${statusText}</div>
                    ${customTitle}
                </div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                    ${peutExporterH5P ? `<button class="btn btn-dash-h5p" data-type="${type}" title="Activité interactive H5P : à déposer telle quelle dans Éléa (Moodle) ou toute plateforme compatible H5P — jouable et notée." ${!isThisValid ? 'disabled' : ''} style="padding: 8px 15px; font-size: 0.9em; background: var(--hapi-green-dark); color: white; border: none; border-radius: 15px; font-weight: 600; ${!isThisValid ? 'background-color:var(--border);background-image:none;color:var(--text-muted);cursor:not-allowed;' : ''}"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg> H5P</button>` : ''}
                    
                    ${peutExporterMoodle ? `<button class="btn btn-dash-moodle" data-type="${type}" title="Questions au format XML Moodle : à importer dans la banque de questions d'Éléa / Moodle pour créer des tests notés." ${!isThisValid ? 'disabled' : ''} style="padding: 8px 15px; font-size: 0.9em; background: var(--hapi-green-dark); color: white; border: none; border-radius: 15px; font-weight: 600; ${!isThisValid ? 'background-color:var(--border);background-image:none;color:var(--text-muted);cursor:not-allowed;' : ''}"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/></svg> XML</button>` : ''}
                    
                    ${peutExporterGIFT ? `<button class="btn btn-dash-gift" data-type="${type}" title="Questions au format texte GIFT : à importer dans la banque de questions Moodle — modifiable dans un simple éditeur de texte." ${!isThisValid ? 'disabled' : ''} style="padding: 8px 15px; font-size: 0.9em; background: var(--hapi-green-dark); color: white; border: none; border-radius: 15px; font-weight: 600; ${!isThisValid ? 'background-color:var(--border);background-image:none;color:var(--text-muted);cursor:not-allowed;' : ''}"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/></svg> GIFT</button>` : ''}
                    
                    ${peutExporterODT ? `<button class="btn btn-dash-odt" data-type="${type}" title="Document texte modifiable (LibreOffice / Word) : pour adapter et imprimer une version papier de l'activité." ${!isThisValid ? 'disabled' : ''} style="padding: 8px 15px; font-size: 0.9em; background: var(--hapi-green-dark); color: white; border: none; border-radius: 15px; font-weight: 600; ${!isThisValid ? 'background-color:var(--border);background-image:none;color:var(--text-muted);cursor:not-allowed;' : ''}"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg> ODT</button>` : ''}
                
                    ${peutExporterZIPStandalone ? `<button class="btn btn-dash-zip-standalone" data-type="${type}" title="Archive ZIP autonome : décompressez puis ouvrez index.html dans un navigateur — fonctionne sans plateforme." ${!isThisValid ? 'disabled' : ''} style="padding: 8px 15px; font-size: 0.9em; background: var(--hapi-green-dark); color: white; border: none; border-radius: 15px; font-weight: 600; ${!isThisValid ? 'background-color:var(--border);background-image:none;color:var(--text-muted);cursor:not-allowed;' : ''}"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg> ZIP</button>` : ''}
                
                    ${peutExporterArchive3D ? `<button class="btn btn-dash-zip-standalone" data-type="${type}" title="Archive ZIP de l'activité 3D : décompressez puis ouvrez index.html dans un navigateur — fonctionne sans plateforme." ${!isThisValid ? 'disabled' : ''} style="padding: 8px 15px; font-size: 0.9em; background-color: var(--hapi-green-dark); background-image: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; border-radius: 15px; font-weight: 600; ${!isThisValid ? 'background-color:var(--border);background-image:none;color:var(--text-muted);cursor:not-allowed;' : ''}"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg> Tout télécharger</button>` : ''}

                    ${peutExporterPDF ? `<button class="btn btn-dash-pdf" data-type="${type}" title="Document PDF prêt à imprimer pour une utilisation papier en classe." ${!isThisValid ? 'disabled' : ''} style="padding: 8px 15px; font-size: 0.9em; background: var(--hapi-green-dark); color: white; border: none; border-radius: 15px; font-weight: 600; ${!isThisValid ? 'background-color:var(--border);background-image:none;color:var(--text-muted);cursor:not-allowed;' : ''}"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg> PDF</button>` : ''}
                </div>
            </div>
        `;
    });

    if (allGenerated) {
        html += `
            <div style="background: var(--page-bg); border: 2px dashed var(--border); border-radius: 8px; padding: 25px; text-align: center;">
                <h3 style="margin-top: 0; color: var(--text);">${isSingle ? 'Projet complet' : 'Lot complet (Multi-activités)'}</h3>
                <p style="font-size: 0.9em; color: var(--text-muted); margin-bottom: 20px;">${isSingle ? 'Votre activité est prête ! Sauvegardez l\'état de votre projet ou générez le ZIP global HAPI.' : 'Toutes vos activités sont prêtes ! Sauvegardez l\'état de votre projet ou générez le ZIP global HAPI.'}</p>
                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                    <button id="btn-dash-save-json" class="btn" title="Sauvegarde du projet (.json) : à réimporter dans HAPI pour reprendre le travail plus tard." style="background: var(--hapi-green-dark); color: white; border: none; padding: 12px 25px; font-weight: bold; border-radius: 25px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg> Sauvegarder le projet</button>
                    <button id="btn-dash-zip-all" class="btn" title="Archive ZIP globale HAPI : tous les fichiers générés du projet en un seul téléchargement." style="background-color: var(--hapi-green-dark); background-image: linear-gradient(45deg, var(--hapi-grad-a), var(--hapi-green-dark)); color: white; border: none; padding: 12px 25px; font-weight: bold; border-radius: 25px;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg> ${isSingle ? 'Tout télécharger' : 'Télécharger l\'archive globale'}</button>
                </div>
            </div>
        `;
    } else {
        html += `
            <div style="background: rgba(225, 29, 72, 0.08); border: 1px dashed rgba(225, 29, 72, 0.35); border-radius: 8px; padding: 20px; text-align: center;">
                <p style="color: var(--danger-text); margin: 0; font-weight: bold; font-size: 1.05em;"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:#b91c1c;"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/></svg> ${isSingle ? 'Action indisponible' : 'Lot complet indisponible'}</p>
                <p style="color: var(--danger-text); font-size: 0.9em; margin-top: 5px; margin-bottom: 0;">Veuillez configurer et générer <strong>${isSingle ? 'l\'activité sélectionnée' : 'toutes les activités sélectionnées'}</strong> ci-dessus pour débloquer la sauvegarde du projet et l'export ZIP global.</p>
            </div>
        `;
    }

    html += `
        </div>
    `;

    container.innerHTML = html;

    const btnSaveJson = document.getElementById('btn-dash-save-json');
    if (btnSaveJson) {
        btnSaveJson.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.innerHTML = 'En cours…';
            btn.disabled = true;
            try {
                const config = await appContext.getMegaConfig();
                const now = new Date();
                const dateStr = `${now.getDate().toString().padStart(2,'0')}-${(now.getMonth()+1).toString().padStart(2,'0')}`;
                appContext.exportConfigToJSON(config, `projet-HAPI-${isSingle ? activeTypes[0] : 'multiple'}-${dateStr}.json`);
                btn.innerHTML = '✓ OK !';
            } catch(err) {
                logger.error(err);
                btn.innerHTML = '✕ Erreur';
            }
            setTimeout(() => { btn.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg> Sauvegarder le projet'; btn.disabled = false; }, 2000);
        });
    }

    const btnZipAll = document.getElementById('btn-dash-zip-all');
    if (btnZipAll) {
        btnZipAll.addEventListener('click', () => appContext.handleGenerateAll());
    }

    // GESTIONNAIRE D'EXPORT UNITAIRE
    container.querySelectorAll('.btn-dash-h5p, .btn-dash-zip-standalone').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const button = e.currentTarget;
            const type = button.dataset.type;
            const originalText = button.innerHTML;
            button.innerHTML = 'Création...';
            button.disabled = true;

            try {
                const processResult = await appContext.processActivityData(type);
                
                if (processResult && processResult.generatorFunction) {
                    const resultData = await processResult.generatorFunction.call(appContext.h5pGenerator, processResult.data);
                    
                    let finalBlob;
                    let finalFileName;

                    if (resultData instanceof Blob) {
                        finalBlob = resultData;
                        const ext = e.target.classList.contains('btn-dash-zip-standalone') ? 'zip' : 'h5p';
                        finalFileName = `${type}-${Date.now()}.${ext}`;
                    } 
                    else if (resultData && resultData.blob) {
                        finalBlob = resultData.blob;
                        finalFileName = resultData.fileName || `${type}-${Date.now()}.h5p`;
                    } else {
                        throw new Error("Le format renvoyé par le générateur est invalide.");
                    }

                    const url = URL.createObjectURL(finalBlob);
                    const a = document.createElement('a');
                    a.style.display = 'none'; 
                    a.href = url; 
                    a.download = finalFileName;
                    document.body.appendChild(a); 
                    a.click(); 
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                } else {
                    throw new Error("Générateur ou données introuvables pour ce module.");
                }

            } catch (err) {
                logger.error(`Erreur génération unitaire (${type}):`, err);
                alert("Erreur lors de la génération du fichier : " + err.message);
            }
            
            button.innerHTML = originalText;
            button.disabled = false;
        });
    });

    // Exports annexes
    container.querySelectorAll('.btn-dash-moodle').forEach(btn => btn.addEventListener('click', e => exporterMoodleXML(e.currentTarget.dataset.type)));
    container.querySelectorAll('.btn-dash-gift').forEach(btn => btn.addEventListener('click', e => exporterGIFT(e.currentTarget.dataset.type)));
    container.querySelectorAll('.btn-dash-odt').forEach(btn => btn.addEventListener('click', e => exporterODT(e.currentTarget.dataset.type)));
    
    // Gestion asynchrone avec sablier pour le PDF
    container.querySelectorAll('.btn-dash-pdf').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const button = e.currentTarget;
            const originalText = button.innerHTML; 
            
            button.innerHTML = 'Création...';
            button.disabled = true;

            try {
                await exporterPDF(button.dataset.type);
            } catch (err) {
                console.error(`Erreur génération PDF:`, err);
                alert("Erreur lors de la génération du PDF : " + err.message);
            } finally {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        });
    });
}