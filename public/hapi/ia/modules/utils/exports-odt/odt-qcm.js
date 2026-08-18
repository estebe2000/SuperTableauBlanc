// Fichier: modules/utils/exports-odt/odt-qcm.js

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

export async function exportODT_Quiz(isMath = false, returnBlobOnly = false) {
    try {
        const titreFichier = document.getElementById(isMath ? 'quiz-math-title' : 'quiz-title').value || 'Quiz';
        const cardSelector = isMath ? '#questions-list .math-question-card' : '#comprehension-questions-preview .card';
        const cards = document.querySelectorAll(cardSelector);
        const questionsData = [];

        // 1. Récupération des données
        cards.forEach((card, index) => {
            let questionText = '', answers = [];
            if (isMath) {
                questionText = `$$${MathEditor.getMathFieldLatex(`${card.id}-q-field`)}$$`;
                answers.push({ text: `$$${MathEditor.getMathFieldLatex(`${card.id}-a0-field`)}$$`, correct: true });
                answers.push({ text: `$$${MathEditor.getMathFieldLatex(`${card.id}-a1-field`)}$$`, correct: false });
                answers.push({ text: `$$${MathEditor.getMathFieldLatex(`${card.id}-a2-field`)}$$`, correct: false });
            } else {
                const qElem = card.querySelector('.q-text');
                if (qElem) questionText = qElem.value.trim();
                card.querySelectorAll('.answer-option').forEach(opt => {
                    const textElem = opt.querySelector('.q-answer-text');
                    const checkElem = opt.querySelector('input[type="checkbox"]');
                    if (textElem && checkElem) answers.push({ text: textElem.value.trim(), correct: checkElem.checked });
                });
            }
            if (questionText) questionsData.push({ id: index + 1, question: questionText, answers: answers });
        });

        // 2. Styles (Couleurs + Sauts de page)
        const customStyles = `
            <style:style style:name="CorrectAnswerStyle" style:family="text">
                <style:text-properties fo:color="#008000" fo:font-weight="bold"/>
            </style:style>
            
            <style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:break-before="page"/>
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
            contentBody += `<text:p text:style-name="Standard">${echapperXML(q.question)}</text:p>`;
			
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
        logger.log('✅ Export ODT (Quiz) généré.');

    } catch (e) {
        logger.error(`Erreur ODT Quiz: ${e.message}`);
        console.error(e);
        if (!returnBlobOnly) alert("Erreur export ODT.");
    }
}