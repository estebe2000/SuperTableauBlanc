// Fichier: modules/utils/exports-odt/odt-advanced-blanks.js

import { logger } from '../logger.js';
import { 
    createBaseODT, 
    generateStylesXML, 
    generateManifestXML, 
    wrapContentXML, 
    echapperXML, 
    telechargerBlob, 
    sanitizeFileName 
} from './odt-utils.js';

export async function exportODT_AdvancedBlanks(returnBlobOnly = false) {
    try {
        // 1. Récupération des données depuis l'UI
        const titreFichier = document.getElementById('advanced-blanks-title')?.value || 'Texte-a-trous';
        const consigne = document.getElementById('advanced-blanks-task-display')?.value || 'Complétez les trous présents dans le texte.';
        const rawText = document.getElementById('ab-text-editor')?.value;

        if (!rawText) throw new Error("Le texte à trous est vide.");

        // Récupération des réponses correctes dans l'ordre
        const correctInputs = document.querySelectorAll('.ab-correct-input');
        const correctAnswers = Array.from(correctInputs).map(input => input.value.trim());

        // 2. Styles spécifiques ODT
        const customStyles = `
            <style:style style:name="BlankSpace" style:family="text">
                <style:text-properties fo:font-weight="bold" fo:color="#555555"/>
            </style:style>

            <style:style style:name="CorrectAnswerStyle" style:family="text">
                <style:text-properties fo:color="#008000" fo:font-weight="bold"/>
            </style:style>
            
            <style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:break-before="page"/>
            </style:style>
        `;

        // 3. Analyse du texte et remplacement des trous (au moins 3 tirets du bas consécutifs)
        const lines = rawText.split('\n');
        let studentBodyXML = '';
        let correctionBodyXML = '';
        let blankIndex = 0;

        lines.forEach(line => {
            if (line.trim() === '') {
                studentBodyXML += `<text:p text:style-name="Standard"/>`;
                correctionBodyXML += `<text:p text:style-name="Standard"/>`;
                return;
            }

            let safeLine = echapperXML(line);

            // Version Élève : On uniformise la taille des trous pour l'impression
            const studentLine = safeLine.replace(/_{3,}/g, '<text:span text:style-name="BlankSpace">________________</text:span>');
            studentBodyXML += `<text:p text:style-name="Standard">${studentLine}</text:p>`;

            // Version Correction : On remplace le trou par la réponse correspondante
            const correctionLine = safeLine.replace(/_{3,}/g, () => {
                const answer = correctAnswers[blankIndex] ? echapperXML(correctAnswers[blankIndex]) : '???';
                blankIndex++;
                return `<text:span text:style-name="CorrectAnswerStyle">${answer}</text:span>`;
            });
            correctionBodyXML += `<text:p text:style-name="Standard">${correctionLine}</text:p>`;
        });

        // 4. Assemblage du document ODT
        let contentBody = ``;
        
        // -- Page Élève --
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)}</text:h>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard" fo:font-style="italic">${echapperXML(consigne)}</text:p>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += studentBodyXML;

        // -- Saut de page --
        contentBody += `<text:p text:style-name="PageBreak"/>`; 
        
        // -- Page Correction --
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)} - CORRECTION</text:h>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += correctionBodyXML;

        // 5. Génération ZIP
        const zip = createBaseODT();
        zip.file("META-INF/manifest.xml", generateManifestXML());
        zip.file("styles.xml", generateStylesXML(customStyles));
        zip.file("content.xml", wrapContentXML(contentBody));

        const blob = await zip.generateAsync({ type: "blob" });
        const fileName = `${sanitizeFileName(titreFichier)}.odt`;

        // 6. Gestion du retour (Téléchargement ou Super-ZIP)
        if (returnBlobOnly) {
            return { blob, fileName };
        }

        telechargerBlob(blob, fileName);
        logger.log('✅ Export ODT (Advanced Blanks) généré.');

    } catch (e) {
        logger.error(`Erreur ODT Advanced Blanks: ${e.message}`);
        console.error(e);
        if (!returnBlobOnly) alert(`Une erreur est survenue lors de l'export ODT : ${e.message}`);
        return null;
    }
}