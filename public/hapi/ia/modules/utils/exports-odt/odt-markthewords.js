// Fichier: modules/utils/exports-odt/odt-markthewords.js

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

// 🟢 AJOUT DU PARAMÈTRE returnBlobOnly
export async function exportODT_MarkTheWords(returnBlobOnly = false) {
    try {
        const titreFichier = document.getElementById('markthewords-title').value || 'Reperer-les-mots';
        const consigne = document.getElementById('markTask').value || "Cliquez sur les mots corrects.";
        const rawText = document.getElementById('markTheWordsText').value;

        if (!rawText) {
            if (!returnBlobOnly) alert("Le texte est vide.");
            return null;
        }

        const customStyles = `
            <style:style style:name="CorrectAnswerStyle" style:family="text">
                <style:text-properties fo:color="#008000" fo:font-weight="bold"/>
            </style:style>
            
            <style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:break-before="page"/>
            </style:style>
        `;

        const lines = rawText.split('\n');
        let studentBodyXML = '';
        let correctionBodyXML = '';

        lines.forEach(line => {
            if (line.trim() === '') return;

            let safeLine = echapperXML(line);

            const studentLine = safeLine.replace(/\*/g, '');
            studentBodyXML += `<text:p text:style-name="Standard">${studentLine}</text:p>`;

            const correctionLine = safeLine.replace(
                /\*([^*]+)\*/g, 
                '<text:span text:style-name="CorrectAnswerStyle">$1</text:span>'
            );
            correctionBodyXML += `<text:p text:style-name="Standard">${correctionLine}</text:p>`;
        });

        let contentBody = ``;

        // PAGE 1 : ÉLÈVE
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)}</text:h>`;
        contentBody += `<text:p text:style-name="Standard"/>`; 
        contentBody += `<text:p text:style-name="Standard"/>`; 
        contentBody += `<text:p text:style-name="Standard" fo:font-style="italic">${echapperXML(consigne)}</text:p>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += studentBodyXML;

        // PAGE 2 : CORRECTION
        contentBody += `<text:p text:style-name="PageBreak"/>`; 
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)} - CORRECTION</text:h>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += correctionBodyXML;

        const zip = createBaseODT();
        zip.file("META-INF/manifest.xml", generateManifestXML()); 
        zip.file("styles.xml", generateStylesXML(customStyles));  
        zip.file("content.xml", wrapContentXML(contentBody));

        const blob = await zip.generateAsync({ type: "blob" });
        const fileName = `${sanitizeFileName(titreFichier)}.odt`;

        // 🟢 NOUVELLE LOGIQUE D'INSERTION DU BLOB
        if (returnBlobOnly) {
            return { blob, fileName };
        }

        telechargerBlob(blob, fileName);
        logger.log('✅ Export ODT (MarkTheWords) généré.');

    } catch (e) {
        logger.error(`Erreur ODT MarkTheWords: ${e.message}`);
        console.error(e);
        // 🟢 ALERTE RENDUE SILENCIEUSE
        if (!returnBlobOnly) alert("Une erreur est survenue lors de l'export ODT.");
        return null;
    }
}