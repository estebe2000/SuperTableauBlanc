// Fichier: modules/utils/exports-odt/odt-sortparagraphs.js

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
export async function exportODT_SortParagraphs(returnBlobOnly = false) {
    try {
        const titreFichier = document.getElementById('sortparagraphs-title').value || 'Tri-paragraphes';
        const consigne = document.getElementById('sortparagraphs-task').value || "Remettez les paragraphes dans l'ordre.";
        
        // 1. Récupération des données (Texte correct dans l'ordre)
        const textAreas = document.querySelectorAll('.sp-text');
        const paragraphs = [];
        
        textAreas.forEach(area => {
            const text = area.value.trim();
            if (text) paragraphs.push(text);
        });

        if (paragraphs.length < 2) {
            // 🟢 ALERTE RENDUE SILENCIEUSE
            if (!returnBlobOnly) alert("Il faut au moins 2 paragraphes pour exporter.");
            return null;
        }

        // 2. Préparation des listes (Ordre correct vs Désordre)
        const correctOrder = [...paragraphs];
        
        // ✅ ALGORITHME FISHER-YATES (Mélange Robuste)
        const shuffledOrder = [...paragraphs];
        for (let i = shuffledOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledOrder[i], shuffledOrder[j]] = [shuffledOrder[j], shuffledOrder[i]];
        }

        // 3. Styles spécifiques
        const customStyles = `
            <style:style style:name="ParagraphBox" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:border="0.05pt solid #000000" fo:padding="0.3cm" fo:margin-top="0.2cm" fo:margin-bottom="0.2cm" fo:background-color="#f9f9f9"/>
            </style:style>
            
            <style:style style:name="CorrectBox" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:border="0.05pt solid #2e7d32" fo:padding="0.2cm" fo:margin-bottom="0.2cm" fo:background-color="#e8f5e9"/>
                <style:text-properties fo:color="#1b5e20"/>
            </style:style>
            
            <style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:break-before="page"/>
            </style:style>
        `;

        // 4. Construction du contenu
        let contentBody = ``;

        // --- PAGE 1 : ÉLÈVE (Mélangé) ---
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)}</text:h>`;
        
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        
        contentBody += `<text:p text:style-name="Standard" fo:font-style="italic">${echapperXML(consigne)}</text:p>`;
        contentBody += `<text:p text:style-name="Standard"/>`;

        contentBody += `<text:h text:style-name="Heading_2">Paragraphes à remettre dans l'ordre :</text:h>`;
        
        shuffledOrder.forEach((para) => {
            contentBody += `<text:p text:style-name="ParagraphBox">${echapperXML(para)}</text:p>`;
            // Petit espace entre les boites
            contentBody += `<text:p text:style-name="Standard" fo:font-size="6pt"/>`; 
        });

        // --- PAGE 2 : CORRECTION (Bon ordre) ---
        contentBody += `<text:p text:style-name="PageBreak"/>`; 
        
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)} - CORRECTION</text:h>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;

        correctOrder.forEach((para, index) => {
            contentBody += `<text:p text:style-name="Standard"><strong>${index + 1}.</strong></text:p>`;
            contentBody += `<text:p text:style-name="CorrectBox">${echapperXML(para)}</text:p>`;
        });

        // 5. Génération ZIP
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
        logger.log('✅ Export ODT (SortParagraphs) généré.');

    } catch (e) {
        logger.error(`Erreur ODT SortParagraphs: ${e.message}`);
        console.error(e);
        // 🟢 ALERTE RENDUE SILENCIEUSE
        if (!returnBlobOnly) alert("Une erreur est survenue lors de l'export ODT.");
        return null;
    }
}