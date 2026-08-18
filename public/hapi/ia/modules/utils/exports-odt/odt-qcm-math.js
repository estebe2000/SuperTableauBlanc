// Fichier: modules/utils/exports-odt/odt-qcm-math.js

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

// Compteur global pour les objets mathématiques
let mathObjectCounter = 0;

/**
 * 🎯 Convertir LaTeX en StarMath (langage natif LibreOffice)
 * CORRECTIF CROCHETS : StarMath utilise [ et ] directement, PAS lbracket/rbracket
 */
function convertLatexToStarMath(latex) {
    let clean = latex
        .replace(/^\\\(/, '').replace(/\\\)$/, '')
        .replace(/^\$\$/, '').replace(/\$\$$/, '')
        .trim();

    let starmath = clean
        // 1. D'abord les Racines
        .replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, 'nroot{$1}{$2}')
        .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt{$1}')

        // 2. Fractions
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '{$1} over {$2}')
        
        // 3. Exposants et indices
        .replace(/\^(\{[^}]+\}|\w)/g, (m, exp) => ' sup ' + exp.replace(/[{}]/g, ''))
        .replace(/_(\{[^}]+\}|\w)/g, (m, sub) => ' sub ' + sub.replace(/[{}]/g, ''))
        
        // 4. Symboles et Opérateurs
        .replace(/\\int/g, ' int ')
        .replace(/\\sum/g, ' sum ')
        .replace(/\\prod/g, ' prod ')
        .replace(/\\alpha/g, ' %alpha ')
        .replace(/\\beta/g, ' %beta ')
        .replace(/\\gamma/g, ' %gamma ')
        .replace(/\\delta/g, ' %delta ')
        .replace(/\\epsilon/g, ' %epsilon ')
        .replace(/\\theta/g, ' %theta ')
        .replace(/\\lambda/g, ' %lambda ')
        .replace(/\\mu/g, ' %mu ')
        .replace(/\\pi/g, ' %pi ')
        .replace(/\\sigma/g, ' %sigma ')
        .replace(/\\phi/g, ' %phi ')
        .replace(/\\omega/g, ' %omega ')
        .replace(/\\times/g, ' times ')
        .replace(/\\cdot/g, ' cdot ')
        .replace(/\\div/g, ' div ')
        .replace(/\\pm/g, ' plusminus ')
        .replace(/\\leq/g, ' <= ')
        .replace(/\\geq/g, ' >= ')
        .replace(/\\neq/g, ' <> ')
        .replace(/\\approx/g, ' approx ')
        .replace(/\\equiv/g, ' equiv ')
        .replace(/\\infty/g, ' infinity ')
        .replace(/\\lim/g, ' lim ')
        .replace(/\\to/g, ' rightarrow ')

        // 5. Parenthèses et Crochets (L'ordre est important !)
        .replace(/\\left\(/g, ' left( ')
        .replace(/\\right\)/g, ' right) ')
        .replace(/\\left\{/g, ' left lbrace ')
        .replace(/\\right\}/g, ' right rbrace ')

        // ✅ CORRECTIF CROCHETS : Utiliser des guillemets pour forcer l'affichage littéral
        .replace(/\\left\[/g, ' left "[" ')   
        .replace(/\\right\]/g, ' right "]" ') 
        .replace(/\\left \[/g, ' left "[" ')
        .replace(/\\right \]/g, ' right "]" ')
        
        // Gestion des crochets simples isolés (ex: intervalles [0;1])
        // Les guillemets forcent StarMath à afficher le caractère littéralement
        .replace(/\[/g, ' "[" ')
        .replace(/\]/g, ' "]" ')
        
        // 6. Lettres calligraphiques et polices
        .replace(/\\mathcal\{([^}]+)\}/g, 'bold italic $1')
        .replace(/\\mathbb\{([^}]+)\}/g, 'bold $1')
        .replace(/\\mathbf\{([^}]+)\}/g, 'bold $1')
        .replace(/\\mathrm\{([^}]+)\}/g, '$1')
        
        // 7. Nettoyage final
        .replace(/\\text\{([^}]+)\}/g, '"$1"')
        .replace(/\\,/g, '~')
        .replace(/\\/g, '');

    return starmath;
}

/**
 * 🎨 Création d'un objet de formule StarMath pour LibreOffice
 * Utilise le style 'fr1' pour la transparence et l'alignement.
 */
function createStarMathObject(latex, objectName) {
    if (!latex) return null;

    const starmath = convertLatexToStarMath(latex);
    
    const mathContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE math:math PUBLIC "-//OpenOffice.org//DTD Modified W3C MathML 1.01//EN" "math.dtd">
<math:math xmlns:math="http://www.w3.org/1998/Math/MathML">
  <math:semantics>
    <math:mrow/>
    <math:annotation math:encoding="StarMath 5.0">${echapperXML(starmath)}</math:annotation>
  </math:semantics>
</math:math>`;

    return {
        xml: `<draw:frame draw:style-name="fr1" draw:name="${objectName}" text:anchor-type="as-char" draw:z-index="0">
  <draw:object xlink:href="./${objectName}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>
</draw:frame>`,
        content: mathContent,
        name: objectName
    };
}

/**
 * Découpe le texte et insère les objets StarMath
 */
function traiterTexteAvecMaths(content, mathObjects) {
    if (!content) return "";
    
    const regex = /(\\\(.*?\\\)|^\$\$.*?\$\$)/gs; 
    const parts = content.split(regex);
    let xmlBody = "";

    parts.forEach(part => {
        if (part.startsWith("\\(") || part.startsWith("$$")) {
            mathObjectCounter++;
            const objectName = `Object${mathObjectCounter}`;
            const mathObj = createStarMathObject(part, objectName);
            
            if (mathObj) {
                mathObjects.push(mathObj);
                xmlBody += mathObj.xml;
            } else {
                xmlBody += `<text:span text:style-name="SourceText">[${echapperXML(part)}]</text:span>`;
            }
        } else {
            let textPart = part.replace(/\\text\{([^{}]*)\}/g, '$1');
            xmlBody += echapperXML(textPart);
        }
    });

    return xmlBody;
}

// 🟢 AJOUT DU PARAMÈTRE returnBlobOnly
export async function exportODT_QuizMath(returnBlobOnly = false) {
    try {
        logger.log("📄 Génération de l'ODT Quiz Mathématique (StarMath + Crochets Fix)...");

        mathObjectCounter = 0;
        const mathObjects = [];

        const titreInput = document.getElementById('quiz-math-title');
        const titreFichier = titreInput ? titreInput.value : 'Quiz Mathématique';

        const cards = document.querySelectorAll('#questions-list .math-question-card');
        const questionsData = [];

        cards.forEach((card, index) => {
            const qTextArea = card.querySelector('.math-question-text');
            const questionText = qTextArea ? qTextArea.value.trim() : '';

            const answers = [];
            const answerRows = card.querySelectorAll('.math-answer-row');

            answerRows.forEach(row => {
                const aTextArea = row.querySelector('.math-answer-text');
                const checkbox = row.querySelector('.math-answer-checkbox');
                
                if (aTextArea && checkbox) {
                    const text = aTextArea.value.trim();
                    if (text) {
                        answers.push({
                            text: text,
                            correct: checkbox.checked
                        });
                    }
                }
            });

            if (questionText) {
                questionsData.push({ 
                    id: index + 1, 
                    question: questionText, 
                    answers: answers 
                });
            }
        });

        if (questionsData.length === 0) {
            // 🟢 ALERTE RENDUE SILENCIEUSE
            if (!returnBlobOnly) alert("Aucune question valide à exporter.");
            return null;
        }

        // Styles ODT
        const customStyles = `
            <style:style style:name="CorrectAnswerStyle" style:family="text">
                <style:text-properties fo:color="#008000" fo:font-weight="bold"/>
            </style:style>
            <style:style style:name="SourceText" style:family="text">
                <style:text-properties fo:font-family="Courier New" fo:font-size="9pt" fo:color="#555555"/>
            </style:style>
            <style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:break-before="page"/>
            </style:style>
            <style:style style:name="QuestionTitle" style:family="paragraph" style:parent-style-name="Heading_2">
                <style:text-properties fo:color="#2b6cb0"/>
            </style:style>
        `;

        const automaticStyles = `
            <style:style style:name="fr1" style:family="graphic" style:parent-style-name="Frame">
                <style:graphic-properties 
                    style:vertical-pos="middle" 
                    style:vertical-rel="text" 
                    fo:background-color="transparent" 
                    draw:stroke="none"
                    draw:fill="none"
                    fo:padding="0cm" 
                    fo:border="none"
                    style:wrap="as-char"
                    style:run-through="foreground"/>
            </style:style>
        `;

        // Construction du contenu
        let contentBody = `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)}</text:h>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;

        // PAGE 1 : ÉLÈVE
        questionsData.forEach(q => {
            contentBody += `<text:h text:style-name="QuestionTitle" text:outline-level="2">Question ${q.id}</text:h>`;
            
            const enonceXML = traiterTexteAvecMaths(q.question, mathObjects);
            contentBody += `<text:p text:style-name="Standard">${enonceXML}</text:p>`;
            
            contentBody += `<text:list>`;
            q.answers.forEach(ans => {
                const ansXML = traiterTexteAvecMaths(ans.text, mathObjects);
                contentBody += `<text:list-item><text:p text:style-name="Standard">☐ ${ansXML}</text:p></text:list-item>`;
            });
            contentBody += `</text:list>`;
            contentBody += `<text:p text:style-name="Standard"/>`;
        });

        // PAGE 2 : CORRECTION
        contentBody += `<text:p text:style-name="PageBreak"/>`;
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">CORRECTION - ${echapperXML(titreFichier)}</text:h>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;

        questionsData.forEach(q => {
            contentBody += `<text:h text:style-name="QuestionTitle" text:outline-level="2">Question ${q.id}</text:h>`;
            
            const enonceXML = traiterTexteAvecMaths(q.question, mathObjects);
            contentBody += `<text:p text:style-name="Standard" fo:font-style="italic">${enonceXML}</text:p>`;

            contentBody += `<text:list>`;
            q.answers.forEach(ans => {
                const ansXML = traiterTexteAvecMaths(ans.text, mathObjects);
                if (ans.correct) {
                    contentBody += `<text:list-item><text:p text:style-name="Standard">☑ <text:span text:style-name="CorrectAnswerStyle">${ansXML}</text:span></text:p></text:list-item>`;
                } else {
                    contentBody += `<text:list-item><text:p text:style-name="Standard">☐ ${ansXML}</text:p></text:list-item>`;
                }
            });
            contentBody += `</text:list>`;
            contentBody += `<text:p text:style-name="Standard"/>`;
        });

        const zip = createBaseODT();
        const manifestEntries = [];
        mathObjects.forEach(mathObj => {
            zip.file(mathObj.name + "/content.xml", mathObj.content);
            zip.file(mathObj.name + "/", null, { dir: true });
            manifestEntries.push({ 
                path: mathObj.name + "/", 
                type: "application/vnd.oasis.opendocument.formula" 
            });
            manifestEntries.push({ 
                path: mathObj.name + "/content.xml", 
                type: "text/xml" 
            });
        });

        zip.file("META-INF/manifest.xml", generateManifestXML(manifestEntries));
        zip.file("styles.xml", generateStylesXML(customStyles));
        zip.file("content.xml", wrapContentXML(contentBody, automaticStyles));

        const blob = await zip.generateAsync({ type: "blob" });
        const fileName = `${sanitizeFileName(titreFichier)}-MATH.odt`;
        
        // 🟢 NOUVELLE LOGIQUE D'INSERTION DU BLOB
        if (returnBlobOnly) {
            return { blob, fileName };
        }

        telechargerBlob(blob, fileName);
        logger.log(`✅ Export ODT Quiz Math terminé (${mathObjects.length} formules).`);

    } catch (e) {
        logger.error(`Erreur Export ODT Quiz Math: ${e.message}`);
        console.error(e);
        // 🟢 ALERTE RENDUE SILENCIEUSE
        if (!returnBlobOnly) alert("Une erreur est survenue lors de l'export ODT.");
        return null;
    }
}