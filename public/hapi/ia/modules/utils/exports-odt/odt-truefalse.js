// Fichier: modules/utils/exports-odt/odt-truefalse.js

import { logger } from '../logger.js';
import * as MathEditor from '../math-editor.js';
import { 
    createBaseODT, 
    generateStylesXML, 
    generateManifestXML,
    wrapContentXML, 
    echapperXML, 
    telechargerBlob, 
    sanitizeFileName 
} from './odt-utils.js';

export async function exportODT_TrueFalse(isMath = false, returnBlobOnly = false) {
    try {
        const titreFichier = document.getElementById(isMath ? 'truefalse-math-title' : 'truefalse-title').value || 'Vrai-Faux';
        const cardSelector = isMath ? '#statements-list .math-question-card' : '#truefalse-questions-preview .card';
        const cards = document.querySelectorAll(cardSelector);
        
        const questionsData = [];
        cards.forEach((card, index) => {
            let statementText = '';
            let isTrue = false;
            if (isMath) {
                statementText = `$$${MathEditor.getMathFieldLatex(`${card.id}-s-field`)}$$`;
                const trueRadio = card.querySelector(`input[value="true"]`);
                if (trueRadio) isTrue = trueRadio.checked;
            } else {
                const txtElem = card.querySelector('.tf-text');
                if (txtElem) statementText = txtElem.value.trim();
                const checkedRadio = card.querySelector('.tf-answer:checked');
                if (checkedRadio) isTrue = (checkedRadio.value === 'true');
            }
            if (statementText) {
                questionsData.push({ 
                    id: index + 1, 
                    question: statementText, 
                    answers: [ { text: "Vrai", correct: isTrue }, { text: "Faux", correct: !isTrue } ]
                });
            }
        });

        // 2. Styles
        const customStyles = `
            <style:style style:name="CorrectAnswerStyle" style:family="text">
                <style:text-properties fo:color="#008000" fo:font-weight="bold"/>
            </style:style>
            
            <style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:break-before="page"/>
            </style:style>

            <style:style style:name="StatementBold" style:family="paragraph" style:parent-style-name="Standard">
                <style:text-properties fo:font-weight="bold" fo:color="#333333"/>
                <style:paragraph-properties fo:margin-bottom="0.2cm"/>
            </style:style>
        `;

        // 3. Construction du contenu
        
        // --- PAGE 1 : ÉLÈVE ---
        let contentBody = `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)}</text:h>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        
        questionsData.forEach(q => {
            contentBody += `<text:h text:style-name="Heading_2" text:outline-level="2">Question ${q.id}</text:h>`;
            contentBody += `<text:p text:style-name="Standard">${echapperXML(q.question)}</text:p>`;
            contentBody += `<text:list>`;
            q.answers.forEach(ans => contentBody += `<text:list-item><text:p text:style-name="Standard">☐ ${echapperXML(ans.text)}</text:p></text:list-item>`);
            contentBody += `</text:list>`;
			contentBody += `<text:p text:style-name="Standard"/>`;
        });

        // --- PAGE 2 : CORRECTION ---
        contentBody += `<text:p text:style-name="PageBreak"/>`;
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)} - CORRECTION</text:h>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        
        questionsData.forEach(q => {
            contentBody += `<text:h text:style-name="Heading_2" text:outline-level="2">Question ${q.id}</text:h>`;
            
            // Rappel de l'affirmation (en gras)
            contentBody += `<text:p text:style-name="StatementBold">${echapperXML(q.question)}</text:p>`;
            
            contentBody += `<text:list>`;
            q.answers.forEach(ans => {
                if (ans.correct) {
                    contentBody += `<text:list-item><text:p text:style-name="Standard">☒ <text:span text:style-name="CorrectAnswerStyle">${echapperXML(ans.text)}</text:span></text:p></text:list-item>`;
                } else {
                    contentBody += `<text:list-item><text:p text:style-name="Standard">☐ ${echapperXML(ans.text)}</text:p></text:list-item>`;
                }
            });
            contentBody += `</text:list>`;
			contentBody += `<text:p text:style-name="Standard"/>`;
			
        });

        // 4. Génération ZIP
        const zip = createBaseODT();
        zip.file("META-INF/manifest.xml", generateManifestXML());
        zip.file("styles.xml", generateStylesXML(customStyles));
        zip.file("content.xml", wrapContentXML(contentBody));

        const blob = await zip.generateAsync({ type: "blob" });
        const fileName = `${sanitizeFileName(titreFichier)}.odt`;

        if (returnBlobOnly) {
            return { blob, fileName };
        }

        telechargerBlob(blob, fileName);
        logger.log('✅ Export ODT (TrueFalse) généré.');

    } catch (e) {
        logger.error(`Erreur ODT TrueFalse: ${e.message}`);
        console.error(e);
        if (!returnBlobOnly) alert("Erreur export ODT.");
    }
}