// Fichier: modules/utils/exports-odt/odt-accordion.js

import { logger } from '../logger.js';
import { 
    createBaseODT, 
    generateStylesXML, 
    generateManifestXML, // ✅ Indispensable
    wrapContentXML, 
    echapperXML, 
    telechargerBlob, 
    sanitizeFileName 
} from './odt-utils.js';

export async function exportODT_Accordion(returnBlobOnly = false) {
    try {
        const titreFichier = document.getElementById('accordion-title').value || 'Glossaire';
        
        // 1. Récupération des données
        const cards = document.querySelectorAll('#accordion-items-list .card');
        const items = [];

        cards.forEach(card => {
            const concept = card.querySelector('.accordion-concept').value.trim();
            const definition = card.querySelector('.accordion-definition').value.trim();
            
            if (concept && definition) {
                items.push({ concept, definition });
            }
        });

		if (items.length === 0) {
		            if (!returnBlobOnly) alert("Aucune entrée de glossaire trouvée."); // 👈 Rendu silencieux
		            return null; // 👈 Retourne null pour le ZIP
		        }

        // 2. Styles spécifiques (Cadre léger pour la définition)
        const customStyles = `
            <style:style style:name="ConceptTitle" style:family="paragraph" style:parent-style-name="Heading">
                <style:text-properties fo:font-size="14pt" fo:font-weight="bold" fo:color="#2c3e50"/>
                <style:paragraph-properties fo:margin-top="0.4cm" fo:margin-bottom="0.1cm" fo:keep-with-next="always"/>
            </style:style>
            
            <style:style style:name="DefinitionBox" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:border-left="0.1cm solid #3498db" fo:padding-left="0.3cm" fo:margin-bottom="0.4cm" fo:background-color="#f8f9fa"/>
                <style:text-properties fo:font-style="italic"/>
            </style:style>
        `;

        // 3. Construction du contenu (Liste simple sur une page)
        let contentBody = ``;

        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)}</text:h>`;
        
        // ✅ Espaces pour aérer
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;

        items.forEach(item => {
            // Titre du terme
            contentBody += `<text:h text:style-name="ConceptTitle" text:outline-level="2">${echapperXML(item.concept)}</text:h>`;
            // Définition
            // On gère les sauts de ligne simples
            const defLines = item.definition.split('\n');
            defLines.forEach(line => {
                if(line.trim()) {
                    contentBody += `<text:p text:style-name="DefinitionBox">${echapperXML(line)}</text:p>`;
                }
            });
        });

// 4. Génération ZIP
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
        logger.log('✅ Export ODT (Accordion) généré.');

    } catch (e) {
        logger.error(`Erreur ODT Accordion: ${e.message}`);
        console.error(e);
        if (!returnBlobOnly) alert("Une erreur est survenue lors de l'export ODT."); // 👈 Rendu silencieux
    }
}