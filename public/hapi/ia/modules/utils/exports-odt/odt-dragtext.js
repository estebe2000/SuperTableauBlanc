// Fichier: modules/utils/exports-odt/odt-dragtext.js

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
export async function exportODT_DragText(returnBlobOnly = false) {
    try {
        const titreFichier = document.getElementById('dragtext-title').value || 'Etiquettes-a-deplacer';
        const consigne = document.getElementById('dragtextTask').value || "Déplacez les mots dans les bons emplacements.";
        
        const rawText = document.getElementById('dragTheWordsText').value;

        if (!rawText) throw new Error("Le texte est vide.");

        // --- 1. STYLES SPÉCIFIQUES ---
        const customStyles = `
            <style:style style:name="BlankSpace" style:family="text">
                <style:text-properties fo:font-weight="bold" fo:color="#555555"/>
            </style:style>
            
            <style:style style:name="WordBankStyle" style:family="paragraph" style:parent-style-name="Standard">
                <style:text-properties fo:font-size="12pt" fo:font-family="Courier New" fo:font-weight="bold" fo:background-color="#f0f0f0"/>
                <style:paragraph-properties fo:border="0.05pt solid #cccccc" fo:padding="0.2cm" fo:margin-bottom="0.5cm"/>
            </style:style>

            <style:style style:name="CorrectAnswerStyle" style:family="text">
                <style:text-properties fo:color="#008000" fo:font-weight="bold"/>
            </style:style>
            
            <style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:break-before="page"/>
            </style:style>
        `;

        // --- 2. ANALYSE ET EXTRACTION ---
        const lines = rawText.split('\n');
        let wordsBank = [];
        let studentBodyXML = '';
        let correctionBodyXML = '';

        lines.forEach(line => {
            if (line.trim() === '') return;

            let safeLine = echapperXML(line);

            const correctionLine = safeLine.replace(
                /\*([^*]+)\*/g, 
                (match, capture) => {
                    const cleanWord = capture.split(':')[0]; 
                    return `<text:span text:style-name="CorrectAnswerStyle">${cleanWord}</text:span>`;
                }
            );
            correctionBodyXML += `<text:p text:style-name="Standard">${correctionLine}</text:p>`;

            const studentLine = safeLine.replace(
                /\*([^*]+)\*/g,
                (match, capture) => {
                    const cleanWord = capture.split(':')[0];
                    wordsBank.push(cleanWord);
                    return `<text:span text:style-name="BlankSpace">________________</text:span>`;
                }
            );
            studentBodyXML += `<text:p text:style-name="Standard">${studentLine}</text:p>`;
        });

        // --- 3. CRÉATION DE LA BANQUE DE MOTS ---
        for (let i = wordsBank.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [wordsBank[i], wordsBank[j]] = [wordsBank[j], wordsBank[i]];
        }
        
        let wordsBankXML = '';
        if (wordsBank.length > 0) {
            wordsBankXML += `<text:h text:style-name="Heading_2">Étiquettes à placer :</text:h>`;
            const labels = wordsBank.map(w => `[ ${echapperXML(w)} ]`).join('   ');
            wordsBankXML += `<text:p text:style-name="WordBankStyle">${labels}</text:p>`;
            wordsBankXML += `<text:p text:style-name="Standard"/>`;
        }

        // --- 4. ASSEMBLAGE DU DOCUMENT ---
        let contentBody = ``;
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)}</text:h>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard" fo:font-style="italic">${echapperXML(consigne)}</text:p>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += wordsBankXML; 
        contentBody += studentBodyXML;

        contentBody += `<text:p text:style-name="PageBreak"/>`; 
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)} - CORRECTION</text:h>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += correctionBodyXML;

        // --- GÉNÉRATION ZIP ---
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
        logger.log('✅ Export ODT (DragText) généré.');

    } catch (e) {
        logger.error(`Erreur ODT DragText: ${e.message}`);
        console.error(e);
        // 🟢 ALERTE RENDUE SILENCIEUSE
        if (!returnBlobOnly) alert("Une erreur est survenue lors de l'export ODT.");
        return null;
    }
}