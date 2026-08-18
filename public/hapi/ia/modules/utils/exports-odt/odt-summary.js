// Fichier: modules/utils/exports-odt/odt-summary.js

import { logger } from '../logger.js';
import { 
    createBaseODT, 
    generateStylesXML, 
    generateManifestXML, // ✅ INDISPENSABLE
    wrapContentXML, 
    echapperXML, 
    telechargerBlob, 
    sanitizeFileName 
} from './odt-utils.js';

// 🟢 AJOUT DU PARAMÈTRE returnBlobOnly
export async function exportODT_Summary(returnBlobOnly = false) {
    try {
        const titreFichier = document.getElementById('summary-title').value || 'Resume';
        const consigne = document.getElementById('summary-task').value || "Choisissez la bonne phrase pour construire le résumé.";
        
        // 1. Récupération des données depuis le DOM
        const cards = document.querySelectorAll('#summary-items-list .card');
        const groups = [];

        cards.forEach((card, index) => {
            const correctText = card.querySelector('.summary-correct-text').value.trim();
            const incorrectInputs = card.querySelectorAll('.summary-incorrect-text');
            const incorrectTexts = [];
            
            incorrectInputs.forEach(input => {
                if(input.value.trim()) incorrectTexts.push(input.value.trim());
            });

            if (correctText) {
                // On prépare les options mélangées ICI pour qu'elles soient identiques 
                // sur la page Élève et sur la page Correction.
                const allOptions = [correctText, ...incorrectTexts];
                
                // ✅ ALGORITHME FISHER-YATES (Mélange Robuste)
                for (let i = allOptions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
                }

                groups.push({
                    id: index + 1,
                    correct: correctText,
                    incorrect: incorrectTexts,
                    mixedOptions: allOptions // On stocke l'ordre mélangé
                });
            }
        });

        if (groups.length === 0) {
            // 🟢 ALERTE RENDUE SILENCIEUSE
            if (!returnBlobOnly) alert("Aucun groupe de résumé trouvé.");
            return null;
        }

        // 2. Styles spécifiques
        const customStyles = `
            <style:style style:name="BoxOption" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:border="0.05pt solid #cccccc" fo:padding="0.2cm" fo:margin-bottom="0.2cm" fo:background-color="#fdfdfd"/>
            </style:style>
            
            <style:style style:name="CorrectOption" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:border="0.05pt solid #2e7d32" fo:padding="0.2cm" fo:margin-bottom="0.2cm" fo:background-color="#e8f5e9"/>
                <style:text-properties fo:color="#1b5e20" fo:font-weight="bold"/>
            </style:style>

            <style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:break-before="page"/>
            </style:style>
        `;

        // 3. Construction du contenu
        let contentBody = ``;

        // --- PAGE 1 : ÉLÈVE (Choix multiples) ---
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)}</text:h>`;
        
        // ✅ Espaces
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        
        contentBody += `<text:p text:style-name="Standard" fo:font-style="italic">${echapperXML(consigne)}</text:p>`;
        contentBody += `<text:p text:style-name="Standard"/>`;

        groups.forEach(group => {
            contentBody += `<text:h text:style-name="Heading_2">Étape ${group.id}</text:h>`;
            contentBody += `<text:p text:style-name="Standard">Cochez la phrase correcte :</text:p>`;
            
            // On utilise l'ordre mélangé pré-calculé
            group.mixedOptions.forEach(opt => {
                contentBody += `<text:p text:style-name="BoxOption">☐ ${echapperXML(opt)}</text:p>`;
            });
            contentBody += `<text:p text:style-name="Standard"/>`;
        });

        // --- PAGE 2 : CORRECTION DÉTAILLÉE ---
        contentBody += `<text:p text:style-name="PageBreak"/>`; 
        
        // ✅ Titre Correction + Espaces
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)} - CORRECTION</text:h>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;

        groups.forEach(group => {
            contentBody += `<text:h text:style-name="Heading_2">Étape ${group.id}</text:h>`;
            
            // On réutilise le MÊME ordre mélangé
            group.mixedOptions.forEach(opt => {
                if (opt === group.correct) {
                    // Si c'est la bonne réponse : Style Vert + Case cochée
                    contentBody += `<text:p text:style-name="CorrectOption">☒ ${echapperXML(opt)}</text:p>`;
                } else {
                    // Si c'est faux : Style Standard + Case vide
                    contentBody += `<text:p text:style-name="BoxOption">☐ ${echapperXML(opt)}</text:p>`;
                }
            });
            contentBody += `<text:p text:style-name="Standard"/>`;
        });

        // 4. Génération ZIP
        const zip = createBaseODT();
        zip.file("META-INF/manifest.xml", generateManifestXML()); // ✅ Ajout Manifeste
        zip.file("styles.xml", generateStylesXML(customStyles));  // ✅ Ajout Custom Styles
        zip.file("content.xml", wrapContentXML(contentBody));

        const blob = await zip.generateAsync({ type: "blob" });
        const fileName = `${sanitizeFileName(titreFichier)}.odt`;

        // 🟢 NOUVELLE LOGIQUE D'INSERTION DU BLOB
        if (returnBlobOnly) {
            return { blob, fileName };
        }

        telechargerBlob(blob, fileName);
        logger.log('✅ Export ODT (Summary) généré.');

    } catch (e) {
        logger.error(`Erreur ODT Summary: ${e.message}`);
        console.error(e);
        // 🟢 ALERTE RENDUE SILENCIEUSE
        if (!returnBlobOnly) alert("Une erreur est survenue lors de l'export ODT.");
        return null;
    }
}