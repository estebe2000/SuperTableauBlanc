// Fichier: modules/utils/exports-pdf/pdf-interactive-video.js

import { logger } from '../logger.js';
import "../../../../vendor/jspdf/jspdf.umd.min.js";
import { gatherData } from '../../ui/h5p-video-ui.js';

const loadQRCodeLib = async () => {
    if (window.QRCode) return true;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL('../../../../vendor/qrcodejs/qrcode.min.js', import.meta.url).href;
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error("Impossible de charger QRCode.js"));
        document.head.appendChild(script);
    });
};

const cleanTextForPdf = (str) => {
    if (!str) return '';
    let s = str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''); 
    s = s.replace(/[\u2011\u2012\u2013\u2014]/g, '-'); 
    s = s.replace(/[\u00A0\u202F\u200B]/g, ' '); 
    s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"'); 
    return s.trim();
};

// 🌟 URL de base du player HAPI statique sur la forge — à adapter à ton projet
//const HAPI_PLAYER_BASE_URL = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/player.html`;
// 🌟 URL de base du player HAPI statique sur la forge (Ajustement dynamique vers 'ia')
let basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
if (basePath.includes('/outils')) {
    basePath = basePath.split('/outils')[0] + '/ia';
}
const HAPI_PLAYER_BASE_URL = `${window.location.origin}${basePath}/player.html`;



export async function exportPDF_InteractiveVideo(returnBlobOnly = false) {
    try {
        logger.log("🚀 Lancement de l'export PDF (Vidéo Interactive - Fiche + Corrigé)...");
        
        const donnees = gatherData();
        if (!donnees || !donnees.interactions) {
            if (!returnBlobOnly) alert("Impossible de générer le PDF : aucune donnée vidéo trouvée.");
            return null;
        }

        await loadQRCodeLib();
        const { jsPDF } = window.jspdf;
        
        const titreFichier = donnees.videoMetadata?.mainTitle || "Fiche Vidéo Interactive";
        const urlVideo = donnees.videoMetadata?.url || "Pas d'URL fournie";
        
        let cleanUrl = urlVideo;
        
        // 1. Nettoyage du proxy
        if (cleanUrl.includes('proxy/stream?url=')) {
            const match = cleanUrl.match(/[?&]url=([^&]+)/);
            if (match) cleanUrl = decodeURIComponent(match[1]);
        }

        let urlForLink = cleanUrl;

        // 2. Extraction des liens et redirections absolues
        const ytMatch = cleanUrl.match(/(?:youtube(?:-nocookie)?\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
        
        if (ytMatch && ytMatch[1]) {
            urlForLink = `${HAPI_PLAYER_BASE_URL}#${ytMatch[1]}`;
        } else if (cleanUrl.includes('podeduc.apps.education.fr')) {
            if (donnees.videoMetadata?.originalSourceUrl && donnees.videoMetadata.originalSourceUrl.includes('/video/')) {
                urlForLink = donnees.videoMetadata.originalSourceUrl;
            } else {
                const podEducIdMatch = cleanUrl.match(/\/(\d+)\/[^\/]+\.mp4$/);
                if (podEducIdMatch && podEducIdMatch[1]) {
                    const videoId = podEducIdMatch[1];
                    const slugRegex = new RegExp(`(${videoId}[a-zA-Z0-9_-]+)`, 'i');
                    const slugMatch = titreFichier.match(slugRegex);
                    
                    if (slugMatch) {
                        urlForLink = `https://podeduc.apps.education.fr/video/${slugMatch[1]}/`;
                    } else {
                        urlForLink = cleanUrl; 
                    }
                } else {
                    urlForLink = cleanUrl;
                }
            }
        } else if (cleanUrl.includes('lesfondamentaux.reseau-canope.fr') || donnees.videoMetadata?.originalSourceUrl) {
            urlForLink = donnees.videoMetadata?.originalSourceUrl || cleanUrl;
        }

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const PAGE_W = 210;
        const PAGE_H = 297;
        const MARGIN = 15;
        let yPos = MARGIN;

        const checkPageBreak = (neededHeight) => {
            if (yPos + neededHeight > PAGE_H - MARGIN) {
                doc.addPage();
                yPos = MARGIN;
            }
        };

        // ==========================================
        // 1. EN-TÊTE : TITRE ET QR CODE (FICHE ÉLÈVE)
        // ==========================================
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(30, 58, 138); 
        
        const splitTitle = doc.splitTextToSize(cleanTextForPdf(titreFichier), PAGE_W - (MARGIN * 2) - 40);
        doc.text(splitTitle, MARGIN, yPos + 5);
        
        let qrDataUrl = null; 
        
        try {
            qrDataUrl = await QRCode.toDataURL(urlForLink, { margin: 1, width: 150 });
            doc.addImage(qrDataUrl, 'PNG', PAGE_W - MARGIN - 30, yPos - 5, 30, 30);
            doc.link(PAGE_W - MARGIN - 30, yPos - 5, 30, 30, { url: urlForLink });
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text("Flashez ou cliquez", PAGE_W - MARGIN - 15, yPos + 28, { align: 'center' });
            doc.text("pour voir la vidéo", PAGE_W - MARGIN - 15, yPos + 32, { align: 'center' });
        } catch (e) {
            logger.warn("Impossible de générer le QR Code", e);
        }

        yPos += Math.max((splitTitle.length * 8) + 10, 40);

        doc.setDrawColor(200);
        doc.setLineWidth(0.5);
        doc.line(MARGIN, yPos, PAGE_W - MARGIN, yPos);
        yPos += 10;

        // ==========================================
        // 2. ZONE DE PRISES DE NOTES (Dès le début)
        // ==========================================
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(30, 58, 138); 
        doc.text("Prise de notes :", MARGIN, yPos); 
        yPos += 12;

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        for (let i = 0; i < 8; i++) {
            doc.line(MARGIN, yPos, PAGE_W - MARGIN, yPos);
            yPos += 10;
        }
        yPos += 8; 

        const interactions = [...donnees.interactions].sort((a, b) => {
            const t1 = a.timestamp.split(':').reduce((acc, time) => (60 * acc) + +time);
            const t2 = b.timestamp.split(':').reduce((acc, time) => (60 * acc) + +time);
            return t1 - t2;
        });

        // ==========================================
        // 3. PARCOURS DES INTERACTIONS (FICHE ÉLÈVE)
        // ==========================================
        if (interactions.length === 0) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(12);
            doc.text("Aucune question interactive configurée pour cette vidéo.", MARGIN, yPos);
        }

        interactions.forEach((item, index) => {
            const d = item.data || {};
            const ts = item.timestamp || "00:00";
            
            checkPageBreak(30); 

            doc.setFillColor(241, 245, 249);
            doc.rect(MARGIN, yPos, 22, 8, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(3, 105, 161);
            doc.text(ts, MARGIN + 11, yPos + 5.5, { align: 'center' });

            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(15, 23, 42);

            let questionText = "Question / Activité";
            if (['quiz', 'multichoice', 'truefalse'].includes(item.type)) questionText = d.question;
            else if (['fillblanks', 'dragtext', 'markthewords'].includes(item.type)) questionText = d.instruction;
            else if (item.type === 'summary') questionText = "Résumé (Cochez l'affirmation exacte)";

            questionText = cleanTextForPdf(questionText.replace(/<[^>]*>?/gm, ''));
            
            const splitQ = doc.splitTextToSize(`Q${index + 1}. ${questionText}`, PAGE_W - MARGIN - 40);
            doc.text(splitQ, MARGIN + 26, yPos + 5.5);
            
            yPos += (splitQ.length * 6) + 6;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            doc.setTextColor(51, 65, 85);

            if (item.type === 'quiz' || item.type === 'multichoice') {
                const options = d.options || [];
                options.forEach(opt => {
                    checkPageBreak(10);
                    doc.setLineWidth(0.3);
                    doc.setDrawColor(100);
                    doc.rect(MARGIN + 26, yPos - 3, 4, 4, 'S'); 
                    const splitOpt = doc.splitTextToSize(cleanTextForPdf(opt.replace(/<[^>]*>?/gm, '')), PAGE_W - MARGIN - 40);
                    doc.text(splitOpt, MARGIN + 34, yPos);
                    yPos += (splitOpt.length * 6) + 2;
                });
            } 
            else if (item.type === 'truefalse') {
                checkPageBreak(10);
                doc.setLineWidth(0.3);
                doc.setDrawColor(100);
                doc.rect(MARGIN + 26, yPos - 3, 4, 4, 'S'); doc.text("Vrai", MARGIN + 34, yPos);
                doc.rect(MARGIN + 56, yPos - 3, 4, 4, 'S'); doc.text("Faux", MARGIN + 64, yPos);
                yPos += 10;
            }
            else if (['fillblanks', 'dragtext', 'markthewords'].includes(item.type)) {
                // 🚀 NOUVELLE LOGIQUE RIGOUREUSE POUR LES TYPES TEXTUELS
                checkPageBreak(25);
                let rawText = cleanTextForPdf(d.text || "");
                
                // 1. Extraction des mots cachés
                const regex = /\*([^*]+)\*/g;
                let match;
                const hiddenWords = [];
                while ((match = regex.exec(rawText)) !== null) {
                    hiddenWords.push(cleanTextForPdf(match[1]));
                }

                // 2. Traitement spécifique selon le type
                if (item.type === 'markthewords') {
                    // Pour "Repérer des mots" : On affiche le texte normal et on demande d'entourer
                    doc.setFont("helvetica", "italic");
                    doc.setTextColor(100, 116, 139);
                    doc.text("(Entourez les mots correspondants directement dans le texte ci-dessous)", MARGIN + 26, yPos);
                    yPos += 6;

                    let textToRead = rawText.replace(/\*([^*]+)\*/g, "$1"); // Retire juste les étoiles
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(51, 65, 85);
                    const splitText = doc.splitTextToSize(textToRead, PAGE_W - MARGIN - 30);
                    doc.text(splitText, MARGIN + 26, yPos);
                    yPos += (splitText.length * 6) + 4;
                } 
                else {
                    // Pour "Texte à trous" et "Étiquettes à déplacer"
                    
                    // Si c'est un dragtext, on affiche obligatoirement la boîte à mots mélangée
                    if (item.type === 'dragtext' && hiddenWords.length > 0) {
                        const shuffledWords = [...hiddenWords].sort(() => Math.random() - 0.5);
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(3, 105, 161);
                        const wordBox = `Étiquettes à placer :   [ ${shuffledWords.join(' ]    [ ')} ]`;
                        const splitBox = doc.splitTextToSize(wordBox, PAGE_W - MARGIN - 30);
                        doc.text(splitBox, MARGIN + 26, yPos);
                        yPos += (splitBox.length * 6) + 4;
                    }

                    // On remplace par des pointillés
                    let textToFill = rawText.replace(/\*([^*]+)\*/g, " .............................. ");
                    doc.setFont("helvetica", "italic");
                    doc.setTextColor(51, 65, 85);
                    const splitText = doc.splitTextToSize(textToFill, PAGE_W - MARGIN - 30);
                    doc.text(splitText, MARGIN + 26, yPos);
                    yPos += (splitText.length * 6) + 4;
                }
            }
            else if (item.type === 'summary') {
                const statements = d.statements || [];
                statements.forEach(group => {
                    checkPageBreak(20);
                    let options = [group.correct, ...(group.distractors || [])].filter(Boolean);
                    options.sort(() => Math.random() - 0.5);
                    
                    options.forEach(opt => {
                        checkPageBreak(10);
                        doc.setLineWidth(0.3);
                        doc.setDrawColor(100);
                        doc.rect(MARGIN + 26, yPos - 3, 4, 4, 'S'); 
                        const splitOpt = doc.splitTextToSize(cleanTextForPdf(opt), PAGE_W - MARGIN - 40);
                        doc.text(splitOpt, MARGIN + 34, yPos);
                        yPos += (splitOpt.length * 6) + 2;
                    });
                    yPos += 4; 
                });
            }

            yPos += 8; 
        });

        // ==========================================
        // 4. PAGES DE CORRECTION (CORRIGÉ COMPLET)
        // ==========================================
        doc.addPage();
        yPos = MARGIN;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(185, 28, 28);
        doc.text("CORRIGÉ DE L'ACTIVITÉ", MARGIN, yPos + 5);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        const splitCorrTitle = doc.splitTextToSize(cleanTextForPdf(titreFichier), PAGE_W - (MARGIN * 2) - 40);
        doc.text(splitCorrTitle, MARGIN, yPos + 14);
        
        if (qrDataUrl) {
            doc.addImage(qrDataUrl, 'PNG', PAGE_W - MARGIN - 30, yPos - 5, 30, 30);
            doc.link(PAGE_W - MARGIN - 30, yPos - 5, 30, 30, { url: urlForLink });
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text("Flashez ou cliquez", PAGE_W - MARGIN - 15, yPos + 28, { align: 'center' });
            doc.text("pour voir la vidéo", PAGE_W - MARGIN - 15, yPos + 32, { align: 'center' });
        }

        yPos += Math.max(14 + (splitCorrTitle.length * 6) + 5, 40);
        
        doc.setDrawColor(200);
        doc.line(MARGIN, yPos, PAGE_W - MARGIN, yPos);
        yPos += 10;

        interactions.forEach((item, index) => {
            const d = item.data || {};
            const ts = item.timestamp || "00:00";
            
            checkPageBreak(25);

            let questionText = "Question / Activité";
            if (['quiz', 'multichoice', 'truefalse'].includes(item.type)) questionText = d.question;
            else if (['fillblanks', 'dragtext', 'markthewords'].includes(item.type)) questionText = d.instruction;
            else if (item.type === 'summary') questionText = "Résumé (Cochez l'affirmation exacte)";

            questionText = cleanTextForPdf(questionText.replace(/<[^>]*>?/gm, ''));

            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(15, 23, 42); 
            const splitQ = doc.splitTextToSize(`Q${index + 1}. [${ts}] ${questionText}`, PAGE_W - MARGIN - 10);
            doc.text(splitQ, MARGIN, yPos);
            yPos += (splitQ.length * 6) + 4;

            if (item.type === 'quiz' || item.type === 'multichoice') {
                const isMulti = item.type === 'multichoice';
                let correctData = d.correct;
                if (isMulti && !Array.isArray(correctData)) correctData = [correctData];

                const options = d.options || [];
                options.forEach((opt, i) => {
                    const isCorrect = isMulti ? correctData.includes(i) : (correctData === i);
                    checkPageBreak(10);
                    const cleanOpt = cleanTextForPdf(opt.replace(/<[^>]*>?/gm, ''));
                    
                    doc.setLineWidth(0.3);
                    if (isCorrect) {
                        doc.setDrawColor(21, 128, 61); doc.setFillColor(21, 128, 61); doc.rect(MARGIN + 10, yPos - 3, 4, 4, 'FD'); 
                        doc.setTextColor(21, 128, 61); doc.setFont("helvetica", "bold");
                    } else {
                        doc.setDrawColor(100, 116, 139); doc.setFillColor(255, 255, 255); doc.rect(MARGIN + 10, yPos - 3, 4, 4, 'S'); 
                        doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal");
                    }
                    
                    const splitOpt = doc.splitTextToSize(cleanOpt, PAGE_W - MARGIN - 25);
                    doc.text(splitOpt, MARGIN + 18, yPos);
                    yPos += (splitOpt.length * 6) + 2;
                });
            } 
            else if (item.type === 'truefalse') {
                checkPageBreak(10);
                const isTrue = (d.answer === true || d.answer === 'true');
                
                doc.setLineWidth(0.3);
                if (isTrue) {
                    doc.setDrawColor(21, 128, 61); doc.setFillColor(21, 128, 61); doc.rect(MARGIN + 10, yPos - 3, 4, 4, 'FD');
                    doc.setTextColor(21, 128, 61); doc.setFont("helvetica", "bold");
                } else {
                    doc.setDrawColor(100, 116, 139); doc.setFillColor(255, 255, 255); doc.rect(MARGIN + 10, yPos - 3, 4, 4, 'S');
                    doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal");
                }
                doc.text("Vrai", MARGIN + 18, yPos);

                if (!isTrue) {
                    doc.setDrawColor(21, 128, 61); doc.setFillColor(21, 128, 61); doc.rect(MARGIN + 40, yPos - 3, 4, 4, 'FD');
                    doc.setTextColor(21, 128, 61); doc.setFont("helvetica", "bold");
                } else {
                    doc.setDrawColor(100, 116, 139); doc.setFillColor(255, 255, 255); doc.rect(MARGIN + 40, yPos - 3, 4, 4, 'S');
                    doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal");
                }
                doc.text("Faux", MARGIN + 48, yPos);
                yPos += 10;
            }
            else if (['fillblanks', 'dragtext', 'markthewords'].includes(item.type)) {
                // 🚀 NOUVELLE LOGIQUE POUR LE CORRIGÉ DES TYPES TEXTUELS
                checkPageBreak(20);
                
                let rawText = cleanTextForPdf(d.text || "");
                
                // On met en évidence visuelle les réponses directement dans le texte (Ex: [ MOT ])
                const textCorrected = rawText.replace(/\*([^*]+)\*/g, " [ $1 ] ");
                
                doc.setTextColor(51, 65, 85);
                doc.setFont("helvetica", "normal");
                const splitText = doc.splitTextToSize(textCorrected, PAGE_W - MARGIN - 20);
                doc.text(splitText, MARGIN + 10, yPos);
                yPos += (splitText.length * 6) + 4;
                
                // On liste aussi les mots en vert en dessous pour vérification rapide
                const regex = /\*([^*]+)\*/g;
                let match;
                const answers = [];
                while ((match = regex.exec(rawText)) !== null) {
                    answers.push(cleanTextForPdf(match[1]));
                }

                if (answers.length > 0) {
                    doc.setTextColor(21, 128, 61);
                    doc.setFont("helvetica", "bold");
                    const ansText = `Mots attendus : ${answers.join(', ')}`;
                    const splitAns = doc.splitTextToSize(ansText, PAGE_W - MARGIN - 20);
                    doc.text(splitAns, MARGIN + 10, yPos);
                    yPos += (splitAns.length * 6) + 2;
                } else {
                    doc.setTextColor(220, 38, 38);
                    doc.setFont("helvetica", "italic");
                    const ansText = `(Attention : L'IA a oublié de mettre des *astérisques* autour des mots dans l'éditeur)`;
                    const splitAns = doc.splitTextToSize(ansText, PAGE_W - MARGIN - 20);
                    doc.text(splitAns, MARGIN + 10, yPos);
                    yPos += (splitAns.length * 6) + 2;
                }
            }
            else if (item.type === 'summary') {
                const statements = d.statements || [];
                statements.forEach((group, gIdx) => {
                    checkPageBreak(20);
                    doc.setTextColor(15, 23, 42);
                    doc.setFont("helvetica", "bold");
                    doc.text(`Séquence ${gIdx+1} :`, MARGIN + 10, yPos);
                    yPos += 6;

                    let options = [
                        { text: group.correct, isCorrect: true },
                        ...(group.distractors || []).map(dist => ({ text: dist, isCorrect: false }))
                    ].filter(o => o.text);
                    
                    options.forEach(opt => {
                        checkPageBreak(10);
                        const cleanOpt = cleanTextForPdf(opt.text.replace(/<[^>]*>?/gm, ''));
                        
                        doc.setLineWidth(0.3);
                        if (opt.isCorrect) {
                            doc.setDrawColor(21, 128, 61); doc.setFillColor(21, 128, 61); doc.rect(MARGIN + 15, yPos - 3, 4, 4, 'FD');
                            doc.setTextColor(21, 128, 61); doc.setFont("helvetica", "bold");
                        } else {
                            doc.setDrawColor(100, 116, 139); doc.setFillColor(255, 255, 255); doc.rect(MARGIN + 15, yPos - 3, 4, 4, 'S');
                            doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal");
                        }
                        
                        const splitOpt = doc.splitTextToSize(cleanOpt, PAGE_W - MARGIN - 30);
                        doc.text(splitOpt, MARGIN + 23, yPos);
                        yPos += (splitOpt.length * 6) + 2;
                    });
                    yPos += 4;
                });
            }

            yPos += 8; 
        });

        // ==========================================
        // FINALISATION DE L'EXPORT
        // ==========================================
        const titreNettoye = cleanTextForPdf(titreFichier)
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/gi, '_');

        const safeName = `Fiche_Video_${titreNettoye}.pdf`;

        if (returnBlobOnly) {
            return { blob: doc.output('blob'), fileName: safeName };
        }

        doc.save(safeName);
        logger.log('✅ Export PDF (Vidéo + Corrigé) terminé.');

    } catch (e) {
        logger.error(`Erreur PDF Interactive Video : ${e.message}`);
        if (!returnBlobOnly) alert("Une erreur est survenue lors de la génération du PDF de la vidéo.");
        return null;
    }
}