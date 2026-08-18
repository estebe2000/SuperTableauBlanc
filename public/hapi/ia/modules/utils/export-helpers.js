// Fichier: modules/utils/export-helpers.js
// Rôle : Point d'entrée unique pour tous les exports.
// Délègue la génération ODT complexe à des sous-modules situés dans ./exports-odt/

import { logger } from './logger.js';
import * as MathEditor from './math-editor.js'; 

// ✅ Imports des utilitaires partagés (depuis votre nouveau dossier)
import { 
    echapperXML, 
    sanitizeFileName, 
    telechargerTexte 
} from './exports-odt/odt-utils.js'; 
// Note : Assurez-vous d'avoir ajouté 'telechargerTexte' dans odt-utils.js, 
// sinon gardez la fonction locale définie plus bas.

// ✅ Imports des générateurs ODT spécifiques
import { exportODT_Quiz } from './exports-odt/odt-qcm.js';
import { exportODT_TrueFalse } from './exports-odt/odt-truefalse.js';
import { exportODT_QuizMath } from './exports-odt/odt-qcm-math.js';
import { exportODT_TrueFalseMath } from './exports-odt/odt-truefalse-math.js';
import { exportODT_WordSearch } from './exports-odt/odt-wordsearch.js';
import { exportODT_MarkTheWords } from './exports-odt/odt-markthewords.js';
import { exportODT_DragText } from './exports-odt/odt-dragtext.js';
import { exportODT_AdvancedBlanks } from './exports-odt/odt-advanced-blanks.js';
import { exportODT_Crossword } from './exports-odt/odt-crossword.js';
import { exportODT_SortParagraphs } from './exports-odt/odt-sortparagraphs.js';
import { exportODT_Summary } from './exports-odt/odt-summary.js';
import { exportODT_Accordion } from './exports-odt/odt-accordion.js';
import { exportPDF_Cards } from './exports-pdf/pdf-cards.js';
import { exportPDF_ImagePairing } from './exports-pdf/pdf-image-pairing.js';
import { exportPDF_Timeline } from './exports-pdf/pdf-timeline.js';
import { exportPDF_InteractiveMap } from './exports-pdf/pdf-interactive-map.js';
import { exportPDF_Dragndrop } from './exports-pdf/pdf-dragndrop.js';
import { exportPDF_InteractiveVideo } from './exports-pdf/pdf-interactive-video.js';

// --- Fonctions d'aide locales (Spécifiques à GIFT/Moodle) ---

/**
 * Échappe les caractères spéciaux pour le format GIFT.
 */
function echapperGIFT(texte) {
    if (typeof texte !== 'string') return '';
    return texte
        .replace(/\\/g, '\\\\')  // Backslash
        .replace(/~/g, '\\~')    // Tilde
        .replace(/=/g, '\\=')    // Égal
        .replace(/#/g, '\\#')    // Dièse
        .replace(/{/g, '\\{')    // Accolade ouvrante
        .replace(/}/g, '\\}')    // Accolade fermante
        .replace(/:/g, '\\:');   // Deux-points
}


// =========================================================
//  EXPORTS TEXTUELS (GIFT & MOODLE XML)
//  (Gardés ici car logique simple et concaténation de chaînes)
// =========================================================

/**
 * Exporte les questions au format GIFT.
 */
export function exporterGIFT(activityType, returnBlobOnly = false) {
    logger.log(`🚀 Demande d'export GIFT pour ${activityType}...`);
    let giftContent = `// Générateur H5P Modulaire - Export GIFT\n// Date: ${new Date().toLocaleString('fr-FR')}\n\n`;
    
    try {
        if (activityType === 'quiz' || activityType === 'quiz-math') {
            const isMath = activityType === 'quiz-math';
            const cardSelector = isMath ? '#questions-list .math-question-card' : '#comprehension-questions-preview .card';
            const cards = document.querySelectorAll(cardSelector);
            
            cards.forEach((card, index) => {
                const questionNum = index + 1;
                let questionText, answers = [];

                if (isMath) {
                    questionText = `$$${MathEditor.getMathFieldLatex(`${card.id}-q-field`)}$$`;
                    answers.push({ text: `$$${MathEditor.getMathFieldLatex(`${card.id}-a0-field`)}$$`, correct: true });
                    answers.push({ text: `$$${MathEditor.getMathFieldLatex(`${card.id}-a1-field`)}$$`, correct: false });
                    answers.push({ text: `$$${MathEditor.getMathFieldLatex(`${card.id}-a2-field`)}$$`, correct: false });
                } else {
                    questionText = card.querySelector('.q-text').value.trim();
                    card.querySelectorAll('.answer-option').forEach(opt => {
                        const text = opt.querySelector('.q-answer-text').value.trim();
                        const correct = opt.querySelector('input[type="checkbox"]').checked;
                        if (text) answers.push({ text, correct });
                    });
                }
                
                giftContent += `::Question ${questionNum}::${echapperGIFT(questionText)}{\n`;
                answers.forEach(ans => {
                    const prefix = ans.correct ? '=' : '~';
                    giftContent += `  ${prefix}${echapperGIFT(ans.text)}#${ans.correct ? 'Correct' : 'Incorrect'}\n`;
                });
                giftContent += `}\n\n`;
            });

        } else if (activityType === 'truefalse' || activityType === 'truefalse-math') {
            const isMath = activityType === 'truefalse-math';
            const cardSelector = isMath ? '#statements-list .math-question-card' : '#truefalse-questions-preview .card';
            const cards = document.querySelectorAll(cardSelector);
            
            cards.forEach((card, index) => {
                let statementText;
                if (isMath) {
                    statementText = `$$${MathEditor.getMathFieldLatex(`${card.id}-s-field`)}$$`;
                } else {
                    statementText = card.querySelector('.tf-text').value.trim();
                }
                
                const correctValue = card.querySelector(`input[name^="${card.id}"]:checked`)?.value;
                if (!statementText || !correctValue) return;

                const isTrue = correctValue === 'true';
                giftContent += `::Affirmation ${index + 1}::${echapperGIFT(statementText)}{${isTrue ? 'T' : 'F'}}\n\n`;
            });

        } else {
            if (!returnBlobOnly) alert(`Le type d'activité "${activityType}" n'est pas compatible avec l'export GIFT.`);
            return null; // Ignoré silencieusement pour le ZIP
        }
        
        const fileName = `export-gift-${activityType}-${Date.now()}.txt`;
        
        if (returnBlobOnly) {
            return { blob: new Blob([giftContent], { type: 'text/plain;charset=utf-8' }), fileName };
        }

        telechargerTexte(giftContent, fileName);
        logger.log('✅ Export GIFT généré.');

    } catch (e) {
        logger.error(`Erreur durant l'export GIFT: ${e.message}`);
        if (!returnBlobOnly) alert("Une erreur est survenue pendant l'export GIFT. Vérifiez la console.");
        return null;
    }
}

/**
 * Exporte les questions au format Moodle XML.
 */
export function exporterMoodleXML(activityType, returnBlobOnly = false) {
    logger.log(`🚀 Demande d'export Moodle XML (Questions) pour ${activityType}...`);
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<quiz>\n`;
    let titre = 'Export-Questions';
	if (activityType === 'advanced-blanks') {
	        return exporterMoodleXML_AdvancedBlanks(returnBlobOnly);
	    }
    try {
        if (activityType === 'quiz' || activityType === 'quiz-math') {
            const isMath = activityType === 'quiz-math';
            titre = document.getElementById(isMath ? 'quiz-math-title' : 'quiz-title').value || titre;
            const cardSelector = isMath ? '#questions-list .math-question-card' : '#comprehension-questions-preview .card';
            const cards = document.querySelectorAll(cardSelector);
            
            cards.forEach((card, index) => {
                xml += `  <question type="multichoice">\n`;
                xml += `    <name><text>Question ${index + 1}</text></name>\n`;
                
                let questionText = '';
                let answers = [];
                const feedbackCorrect = card.querySelector(isMath ? '.q-feedback-correct-math' : '.q-feedback-correct')?.value.trim() || '';
                const feedbackIncorrect = card.querySelector(isMath ? '.q-feedback-incorrect-math' : '.q-feedback-incorrect')?.value.trim() || '';

                if (isMath) {
                    questionText = `\\(${MathEditor.getMathFieldLatex(`${card.id}-q-field`)}\\)`;
                    answers.push({ text: `\\(${MathEditor.getMathFieldLatex(`${card.id}-a0-field`)}\\)`, correct: true, feedback: feedbackCorrect });
                    answers.push({ text: `\\(${MathEditor.getMathFieldLatex(`${card.id}-a1-field`)}\\)`, correct: false, feedback: feedbackIncorrect });
                    answers.push({ text: `\\(${MathEditor.getMathFieldLatex(`${card.id}-a2-field`)}\\)`, correct: false, feedback: feedbackIncorrect });
                } else {
                    questionText = card.querySelector('.q-text').value.trim();
                    card.querySelectorAll('.answer-option').forEach(opt => {
                        const text = opt.querySelector('.q-answer-text').value.trim();
                        const correct = opt.querySelector('input[type="checkbox"]').checked;
                        if (text) answers.push({ text, correct, feedback: correct ? feedbackCorrect : feedbackIncorrect });
                    });
                }
                
                xml += `    <questiontext format="html"><text><![CDATA[<p>${questionText}</p>]]></text></questiontext>\n`;
                const correctCount = answers.filter(a => a.correct).length;
                const isSingleChoice = correctCount === 1;
                const correctFraction = correctCount > 0 ? (100 / correctCount).toFixed(7) : 100;

                xml += `    <single>${isSingleChoice ? 'true' : 'false'}</single>\n`;
                xml += `    <shuffleanswers>true</shuffleanswers>\n`;
                xml += `    <answernumbering>abc</answernumbering>\n`;
                
                answers.forEach(ans => {
                    const fraction = ans.correct ? correctFraction : "0";
                    xml += `    <answer fraction="${fraction}" format="html">\n`;
                    xml += `      <text><![CDATA[${ans.text}]]></text>\n`;
                    xml += `      <feedback format="html"><text><![CDATA[${ans.feedback}]]></text></feedback>\n`;
                    xml += `    </answer>\n`;
                });
                xml += `  </question>\n\n`;
            });

        } else if (activityType === 'truefalse' || activityType === 'truefalse-math') {
            const isMath = activityType === 'truefalse-math';
            titre = document.getElementById(isMath ? 'truefalse-math-title' : 'truefalse-title').value || titre;
            const cardSelector = isMath ? '#statements-list .math-question-card' : '#truefalse-questions-preview .card';
            const cards = document.querySelectorAll(cardSelector);
            
            cards.forEach((card, index) => {
                let statementText = '';
                if (isMath) {
                    statementText = `\\(${MathEditor.getMathFieldLatex(`${card.id}-s-field`)}\\)`;
                } else {
                    statementText = card.querySelector('.tf-text').value.trim();
                }

                const correctValue = card.querySelector(`input[name^="${card.id}"]:checked`)?.value;
                if (!statementText || !correctValue) return;

                const isTrue = correctValue === 'true';
                const feedbackCorrect = card.querySelector(isMath ? '.tf-feedback-correct-math' : '.tf-feedback-correct')?.value.trim() || '';
                const feedbackIncorrect = card.querySelector(isMath ? '.tf-feedback-incorrect-math' : '.tf-feedback-incorrect')?.value.trim() || '';
                
                xml += `  <question type="truefalse">\n`;
                xml += `    <name><text>Affirmation ${index + 1}</text></name>\n`;
                xml += `    <questiontext format="html"><text><![CDATA[<p>${statementText}</p>]]></text></questiontext>\n`;
                xml += `    <generalfeedback format="html"><text></text></generalfeedback>\n`;
                xml += `    <defaultgrade>1.0000000</defaultgrade>\n`;
                xml += `    <penalty>1.0000000</penalty>\n`;
                xml += `    <hidden>0</hidden>\n`;
                
                xml += `    <answer fraction="${isTrue ? '100' : '0'}" format="moodle_auto_format">\n`;
                xml += `      <text>true</text>\n`;
                xml += `      <feedback format="html"><text><![CDATA[${isTrue ? feedbackCorrect : feedbackIncorrect}]]></text></feedback>\n`;
                xml += `    </answer>\n`;
                
                xml += `    <answer fraction="${isTrue ? '0' : '100'}" format="moodle_auto_format">\n`;
                xml += `      <text>false</text>\n`;
                xml += `      <feedback format="html"><text><![CDATA[${isTrue ? feedbackIncorrect : feedbackCorrect}]]></text></feedback>\n`;
                xml += `    </answer>\n`;
                xml += `  </question>\n\n`;
            });

        } else {
            if (!returnBlobOnly) alert(`Le type d'activité "${activityType}" n'est pas compatible avec l'export Moodle XML (Questions).`);
            return null; // Ignoré silencieusement pour le ZIP
        }
        
        xml += `</quiz>`;
        
        const fileName = `moodle-xml-questions-${sanitizeFileName(titre)}-${Date.now()}.xml`;
        
        if (returnBlobOnly) {
            return { blob: new Blob([xml], { type: 'application/xml;charset=utf-8' }), fileName };
        }

        telechargerTexte(xml, fileName);
        logger.log('✅ Export Moodle XML (Questions) généré.');
    
    } catch (e) {
        logger.error(`Erreur durant l'export Moodle XML: ${e.message}`);
        if (!returnBlobOnly) alert("Une erreur est survenue pendant l'export Moodle XML (Questions). Vérifiez la console.");
        return null;
    }
}


/**
 * Exporte l'activité Advanced Blanks au format Moodle XML (Question de type "Cloze").
 */
export function exporterMoodleXML_AdvancedBlanks(returnBlobOnly = false) {
    logger.log(`🚀 Demande d'export Moodle XML (Cloze) pour Advanced Blanks...`);

    try {
        const titre = document.getElementById('advanced-blanks-title')?.value || 'Texte à trous';
        const mode = document.getElementById('ab-mode')?.value || 'typing';
        const caseSensitive = document.getElementById('ab-caseSensitive')?.checked || false;
        let rawText = document.getElementById('ab-text-editor')?.value;

        if (!rawText) throw new Error("Le texte à trous est vide.");

        // Convertir les sauts de ligne en <br> pour Moodle
        let htmlText = rawText.replace(/\n/g, '<br/>');

        // Récupérer les données des trous depuis l'UI
        const cards = document.querySelectorAll('.ab-blank-card');
        const blanks = [];
        cards.forEach(card => {
            const correct = card.querySelector('.ab-correct-input')?.value || '';
            const incorrectList = [];
            const rows = card.querySelectorAll('.ab-incorrect-row');
            rows.forEach(row => {
                const ans = row.querySelector('.ab-inc-answer')?.value;
                const fb = row.querySelector('.ab-inc-feedback')?.value;
                if (ans) incorrectList.push({ text: ans, feedback: fb });
            });
            blanks.push({ correct, incorrectList });
        });

        // Échappement STRICT pour la syntaxe Cloze de Moodle (évite de casser le code)
        const echapperCloze = (texte) => {
            if (!texte) return '';
            return texte
                .replace(/\\/g, '\\\\')
                .replace(/~/g, '\\~')
                .replace(/=/g, '\\=')
                .replace(/#/g, '\\#')
                .replace(/{/g, '\\{')
                .replace(/}/g, '\\}')
                .replace(/:/g, '\\:');
        };

        let blankIndex = 0;
        
        // Remplacement des trous (____) par le code Cloze
        const clozeText = htmlText.replace(/_{3,}/g, () => {
            if (blankIndex >= blanks.length) return "???";
            const b = blanks[blankIndex++];
            let clozeTag = "";

            const correctSafe = echapperCloze(b.correct);

            if (mode === 'selection') {
                // Mode Menus déroulants : MULTICHOICE
                clozeTag = `{1:MULTICHOICE:~%100%${correctSafe}`;
                b.incorrectList.forEach(inc => {
                    const incText = echapperCloze(inc.text);
                    const incFb = inc.feedback ? `#${echapperCloze(inc.feedback)}` : '';
                    clozeTag += `~%0%${incText}${incFb}`;
                });
                clozeTag += `}`;
            } else {
                // Mode Saisie au clavier : SHORTANSWER ou SHORTANSWER_C
                const qType = caseSensitive ? 'SHORTANSWER_C' : 'SHORTANSWER';
                clozeTag = `{1:${qType}:~%100%${correctSafe}`;
                b.incorrectList.forEach(inc => {
                    const incText = echapperCloze(inc.text);
                    const incFb = inc.feedback ? `#${echapperCloze(inc.feedback)}` : '';
                    clozeTag += `~%0%${incText}${incFb}`;
                });
                // Capture de toutes les autres mauvaises réponses avec un feedback par défaut
                clozeTag += `~*#Faux}`;
            }
            return clozeTag;
        });

        // Construction du fichier XML Moodle
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<quiz>\n`;
        xml += `  <question type="cloze">\n`;
        xml += `    <name>\n      <text><![CDATA[${titre}]]></text>\n    </name>\n`;
        xml += `    <questiontext format="html">\n`;
        xml += `      <text><![CDATA[${clozeText}]]></text>\n`;
        xml += `    </questiontext>\n`;
        xml += `    <generalfeedback format="html">\n      <text></text>\n    </generalfeedback>\n`;
        xml += `    <penalty>0.3333333</penalty>\n`;
        xml += `    <hidden>0</hidden>\n`;
        xml += `  </question>\n`;
        xml += `</quiz>`;

        const fileName = `moodle-xml-cloze-${sanitizeFileName(titre)}-${Date.now()}.xml`;

        if (returnBlobOnly) {
            return { blob: new Blob([xml], { type: 'application/xml;charset=utf-8' }), fileName };
        }

        telechargerTexte(xml, fileName);
        logger.log('✅ Export Moodle XML (Cloze / Advanced Blanks) généré.');

    } catch (e) {
        logger.error(`Erreur export Moodle XML Advanced Blanks: ${e.message}`);
        if (!returnBlobOnly) alert("Une erreur est survenue pendant l'export Moodle XML.");
        return null;
    }
}


/**
 * Exporte le glossaire au format Moodle XML.
 */
export function exporterMoodleXML_Glossaire() {
    logger.log(`🚀 Demande d'export Moodle XML (Glossaire)...`);
    
    const titre = document.getElementById('accordion-title').value || 'Glossaire';
    const cards = document.querySelectorAll('#accordion-items-list .card');

    if (cards.length === 0) {
        alert("Aucune entrée de glossaire à exporter.");
        return;
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<GLOSSARY>\n  <INFO>\n`;
    xml += `    <NAME>${echapperXML(titre)}</NAME>\n`;
    xml += `    <INTRO></INTRO>\n`;
    xml += `    <INTROFORMAT>1</INTROFORMAT>\n`;
    xml += `    <ALLOWDUPLICATEDENTRIES>0</ALLOWDUPLICATEDENTRIES>\n`;
    xml += `    <DISPLAYFORMAT>dictionary</DISPLAYFORMAT>\n`;
    xml += `    <SHOWSPECIAL>1</SHOWSPECIAL>\n`;
    xml += `    <SHOWALPHABET>1</SHOWALPHABET>\n`;
    xml += `    <SHOWALL>1</SHOWALL>\n`;
    xml += `    <ALLOWCOMMENTS>0</ALLOWCOMMENTS>\n`;
    xml += `    <USEDYNALINK>0</USEDYNALINK>\n`;
    xml += `    <DEFAULTAPPROVAL>0</DEFAULTAPPROVAL>\n`;
    xml += `    <GLOBALGLOSSARY>0</GLOBALGLOSSARY>\n`;
    xml += `    <ENTBYPAGE>10</ENTBYPAGE>\n`;
    xml += `    <ENTRIES>\n`;

    cards.forEach(card => {
        const concept = card.querySelector('.accordion-concept').value.trim();
        const definition = card.querySelector('.accordion-definition').value.trim();
        
        if (concept && definition) {
            const definitionHTML = `&lt;p&gt;${echapperXML(definition.replace(/\n/g, '&lt;br&gt;'))}&lt;/p&gt;`;
            xml += `      <ENTRY>\n`;
            xml += `        <CONCEPT>${echapperXML(concept)}</CONCEPT>\n`;
            xml += `        <DEFINITION>${definitionHTML}</DEFINITION>\n`;
            xml += `        <FORMAT>1</FORMAT>\n`;
            xml += `        <USEDYNALINK>1</USEDYNALINK>\n`;
            xml += `        <CASESENSITIVE>0</CASESENSITIVE>\n`;
            xml += `        <FULLMATCH>0</FULLMATCH>\n`;
            xml += `        <TEACHERENTRY>1</TEACHERENTRY>\n`;
            xml += `      </ENTRY>\n`;
        }
    });

    xml += `    </ENTRIES>\n  </INFO>\n</GLOSSARY>\n`;
    const nomFichier = `moodle-xml-glossaire-${sanitizeFileName(titre)}-${Date.now()}.xml`;
    telechargerTexte(xml, nomFichier);
    logger.log('✅ Export Moodle XML (Glossaire) généré.');
}



export async function exporterPDF(activityType) {
    if (activityType === 'cards') {
        await exportPDF_Cards();
    } 
    else if (activityType === 'image-pairing') {
        await exportPDF_ImagePairing();
    }
    else if (activityType === 'timeline') {
        await exportPDF_Timeline();
    }
    else if (activityType === 'interactive-map') {
        await exportPDF_InteractiveMap();
    }
    // 🌟 AJOUTEZ CES 3 LIGNES :
    else if (activityType === 'dragndrop') {
        await exportPDF_Dragndrop();
    }
	else if (activityType === 'interactive-video') {
	        await exportPDF_InteractiveVideo();
	    }
    else {
        alert("L'export PDF n'est pas encore disponible pour cette activité.");
    }
}




// =========================================================
//  EXPORTS ODT (OpenDocument Text)
//  (Logique modulaire : délègue aux fichiers spécifiques)
// =========================================================

export async function exporterODT(activityType) {
    logger.log(`🚀 Dispatch Export ODT pour ${activityType}...`);
    
    switch(activityType) {
        case 'quiz':
            await exportODT_Quiz(false); // false = pas maths
            break;
        case 'truefalse':
            await exportODT_TrueFalse(false);
            break;
		case 'quiz-math':
		    await exportODT_QuizMath(); 
		    break;
		case 'truefalse-math':
		    await exportODT_TrueFalseMath();
		    break;
        case 'wordsearch':
            await exportODT_WordSearch();
            break;
		case 'markthewords':
		    await exportODT_MarkTheWords();
		    break;
		case 'dragtext':
		    await exportODT_DragText();
		    break;
		case 'advanced-blanks':
		    await exportODT_AdvancedBlanks();
		    break;
		case 'crossword':
		    await exportODT_Crossword();
		    break;
		case 'sortparagraphs':
		    await exportODT_SortParagraphs();
		    break;
		case 'summary':
		    await exportODT_Summary();
		    break;
		case 'accordion':
		    await exportODT_Accordion();
		    break;
    
        default:
            alert(`L'export ODT n'est pas encore disponible pour le type "${activityType}".`);
    }
}

// =========================================================
//  RÉCUPÉRATION SILENCIEUSE DES BLOBS (POUR LE SUPER-ZIP)
// =========================================================

export async function getODTBlob(activityType) {
    try {
        switch(activityType) {
            // Activités avec distinction Math / Pas Math (isMath = false, returnBlobOnly = true)
            case 'quiz': return await exportODT_Quiz(false, true);
            case 'truefalse': return await exportODT_TrueFalse(false, true);
            
            // Activités classiques (returnBlobOnly = true)
            case 'quiz-math': return await exportODT_QuizMath(true);
            case 'truefalse-math': return await exportODT_TrueFalseMath(true);
            case 'accordion': return await exportODT_Accordion(true);
            //case 'cards': return await exportODT_Cards(true);
            case 'crossword': return await exportODT_Crossword(true);
            case 'dragtext': return await exportODT_DragText(true);
			case 'advanced-blanks': return await exportODT_AdvancedBlanks(true);
            case 'markthewords': return await exportODT_MarkTheWords(true);
            case 'sortparagraphs': return await exportODT_SortParagraphs(true);
            case 'summary': return await exportODT_Summary(true);
            case 'wordsearch': return await exportODT_WordSearch(true);
            
            default: return null;
        }
    } catch(e) {
        logger.error(`Erreur création Blob ODT pour ${activityType}: ${e.message}`);
        return null;
    }
}

// =========================================================
//  RÉCUPÉRATION SILENCIEUSE DES BLOBS PDF (POUR LE SUPER-ZIP)
// =========================================================

export async function getPDFBlob(activityType) {
    try {
        switch(activityType) {
            case 'cards': 
                return await exportPDF_Cards(true);
            
            case 'image-pairing': 
                return await exportPDF_ImagePairing(true);
            
            case 'timeline': 
                return await exportPDF_Timeline(true);
            
            case 'interactive-map': 
                return await exportPDF_InteractiveMap(true);
                
            case 'dragndrop':
                return await exportPDF_Dragndrop(true);
			
			case 'interactive-video':
			    return await exportPDF_InteractiveVideo(true);

            default: 
                return null;
        }
    } catch(e) {
        logger.error(`Erreur création Blob PDF pour ${activityType}: ${e.message}`);
        return null;
    }
}

// =========================================================
//  RÉCUPÉRATION SILENCIEUSE DES BLOBS TEXTES (POUR LE SUPER-ZIP)
// =========================================================

export async function getGIFTBlob(activityType) {
    try {
        switch(activityType) {
            case 'quiz':
            case 'quiz-math':
            case 'truefalse':
            case 'truefalse-math':
                return exporterGIFT(activityType, true); // Appel silencieux
            
            default: 
                return null; // Ignore silencieusement les autres activités
        }
    } catch(e) {
        logger.error(`Erreur création Blob GIFT pour ${activityType}: ${e.message}`);
        return null;
    }
}

export async function getMoodleXMLBlob(activityType) {
    try {
        switch(activityType) {
            case 'quiz':
            case 'quiz-math':
            case 'truefalse':
            case 'truefalse-math':
                return exporterMoodleXML(activityType, true); // Appel silencieux
            
            // Note : Si un jour tu adaptes exporterMoodleXML_Glossaire() pour qu'il 
            // accepte le paramètre returnBlobOnly, tu pourras décommenter la ligne suivante :
            case 'accordion': return exporterMoodleXML_Glossaire(true);
			case 'advanced-blanks': return exporterMoodleXML_AdvancedBlanks(true);

            default: 
                return null; // Ignore silencieusement les autres activités
        }
    } catch(e) {
        logger.error(`Erreur création Blob XML pour ${activityType}: ${e.message}`);
        return null;
    }
}