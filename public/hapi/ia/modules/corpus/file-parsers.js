// Fichier: modules/corpus/file-parsers.js

import { logger } from '../utils/logger.js';

// Configuration pour PDF.js
// On s'assure que le worker est bien défini
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../../../vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;
}

/**
 * Fonction utilitaire pour lancer l'OCR sur une image (File ou Canvas)
 * Utilise une instance Tesseract éphémère.
 */
async function performOCR(imageInput, onProgress, currentProgressOffset = 0, progressScale = 100) {
    let text = "";
    try {
        const worker = await Tesseract.createWorker('fra', 1, {
            workerPath: new URL('../../../vendor/tesseract/worker.min.js', import.meta.url).href,
            corePath: new URL('../../../vendor/tesseract/core/', import.meta.url).href,
            langPath: new URL('../../../vendor/tesseract/lang/', import.meta.url).href,
            logger: m => {
                if (m.status === 'recognizing text' && onProgress) {
                    // Calcul savant pour adapter la progression (0-100) à une sous-partie du chargement global
                    const localPercent = m.progress * 100;
                    const globalPercent = currentProgressOffset + (localPercent * (progressScale / 100));
                    onProgress(Math.floor(globalPercent));
                }
            }
        });

        const { data } = await worker.recognize(imageInput);
        text = data.text;
        await worker.terminate();
    } catch (err) {
        logger.error("Erreur Tesseract interne : " + err.message);
    }
    return text;
}

/**
 * Convertit une page PDF en élément Canvas HTML pour l'OCR
 */
async function renderPageToCanvas(page) {
    const viewport = page.getViewport({ scale: 2.0 }); // Scale 2.0 améliore la qualité pour l'OCR
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;

    return canvas;
}


// --- Parsers Spécifiques ---


/**
 * Convertit une chaîne (ex: "1, 3-5") en tableau de numéros de pages uniques et triés.
 */
function parsePageRange(rangeStr, maxPages) {
    if (!rangeStr) return Array.from({length: maxPages}, (_, i) => i + 1);
    
    const pages = new Set();
    rangeStr.split(',').forEach(part => {
        const bounds = part.trim().split('-');
        if (bounds.length === 1) {
            const p = parseInt(bounds[0], 10);
            if (!isNaN(p) && p > 0 && p <= maxPages) pages.add(p);
        } else if (bounds.length === 2) {
            const start = parseInt(bounds[0], 10);
            const end = parseInt(bounds[1], 10);
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
                    pages.add(i);
                }
            }
        }
    });
    return Array.from(pages).sort((a, b) => a - b);
}


async function parsePptxFile(file) {
    logger.log(`📄 Décompression du fichier PPTX : ${file.name}...`);
    try {
        const zip = await JSZip.loadAsync(file);
        const parser = new DOMParser();
        let fullText = '';
        
        // 1. Lister toutes les slides et extraire leur numéro
        const slideFiles = [];
        zip.folder("ppt/slides").forEach((relativePath, zipEntry) => {
            if (relativePath.startsWith('slide') && relativePath.endsWith('.xml')) {
                // Extraire le numéro de la slide (ex: slide12.xml -> 12)
                const match = relativePath.match(/slide(\d+)\.xml/);
                if (match) {
                    slideFiles.push({ path: relativePath, entry: zipEntry, num: parseInt(match[1], 10) });
                }
            }
        });
        
        // 2. Trier les slides par numéro
        slideFiles.sort((a, b) => a.num - b.num);
        const totalSlides = slideFiles.length;
        
        // 3. Déterminer quelles slides lire
        const slidesToRead = parsePageRange(file.pageRange, totalSlides);
        logger.log(`📑 Extraction des slides PPTX : ${slidesToRead.join(', ')}`);
        
        for (let i = 0; i < slidesToRead.length; i++) {
            const slideNum = slidesToRead[i];
            const slideFile = slideFiles.find(s => s.num === slideNum);
            if (!slideFile) continue; // Si la slide n'existe pas, on passe
            
            const xmlString = await slideFile.entry.async('string');
            const xmlDoc = parser.parseFromString(xmlString, "application/xml");
            const textNodes = xmlDoc.getElementsByTagName('a:t');
            
            let slideText = '';
            for (let j = 0; j < textNodes.length; j++) {
                slideText += textNodes[j].textContent + ' ';
            }
            if (slideText.trim()) {
                fullText += `--- Diapositive ${slideNum} ---\n` + slideText.trim() + '\n\n';
            }
        }
        return fullText.trim();
    } catch (error) {
        logger.error(`Erreur parsing PPTX ${file.name}: ${error.message}`);
        return null;
    }
}

async function parseOdpFile(file) {
    logger.log(`📄 Décompression du fichier ODP : ${file.name}...`);
    try {
        const zip = await JSZip.loadAsync(file);
        const contentXmlFile = zip.file('content.xml');
        if (!contentXmlFile) throw new Error("content.xml introuvable.");
        
        const xmlString = await contentXmlFile.async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
        
        // 1. Récupérer toutes les slides (balise <draw:page>)
        const pages = xmlDoc.getElementsByTagName('draw:page');
        const totalSlides = pages.length;
        let fullText = '';
        
        // 2. Déterminer quelles slides lire
        const slidesToRead = parsePageRange(file.pageRange, totalSlides);
        logger.log(`📑 Extraction des slides ODP : ${slidesToRead.join(', ')}`);
        
        for (let i = 0; i < slidesToRead.length; i++) {
            const slideIndex = slidesToRead[i] - 1; // Les index XML commencent à 0 (slide 1 = index 0)
            const pageNode = pages[slideIndex];
            if (!pageNode) continue;
            
            let slideText = '';
            const textParagraphs = pageNode.getElementsByTagName('text:p');
            for (let j = 0; j < textParagraphs.length; j++) {
                slideText += textParagraphs[j].textContent + ' ';
            }
            
            if (slideText.trim()) {
                fullText += `--- Diapositive ${slidesToRead[i]} ---\n` + slideText.trim().replace(/\s+/g, ' ') + '\n\n';
            }
        }
        return fullText.trim();
    } catch (error) {
        logger.error(`Erreur parsing ODP ${file.name}: ${error.message}`);
        return null;
    }
}

async function parseOdtFile(file) {
    // ... (Code identique)
    logger.log(`📄 Décompression du fichier ODT : ${file.name}...`);
    try {
        const zip = await JSZip.loadAsync(file);
        const contentXmlFile = zip.file('content.xml');
        if (!contentXmlFile) throw new Error("content.xml introuvable.");
        const xmlString = await contentXmlFile.async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
        const officeText = xmlDoc.getElementsByTagName('office:text')[0];
        if (!officeText) throw new Error("<office:text> introuvable.");
        let fullText = '';
        officeText.childNodes.forEach(node => {
            if (node.textContent.trim()) {
                fullText += node.textContent.trim() + '\n';
            }
        });
        return fullText.trim();
    } catch (error) {
        logger.error(`Erreur parsing ODT ${file.name}: ${error.message}`);
        return null;
    }
}

// --- Main Parser Function ---

export async function readFileContent(file, onProgress = null) {
    const fileName = file.name.toLowerCase();
    
    // 1. Cas Image Directe (JPG, PNG)
    if (/\.(jpe?g|png)$/i.test(fileName)) {
        logger.log(`👁️ OCR Image directe : ${file.name}`);
        return await performOCR(file, onProgress, 0, 100);
    }
    
  
// 2. Cas PDF (Mixte Texte / Image)
    else if (fileName.endsWith('.pdf')) {
        logger.log(`📄 Lecture PDF (Hybride) : ${file.name}...`);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = '';
            
            // NOUVEAU : On détermine les pages à lire grâce à la propriété pageRange transmise par le manager
            const pagesToRead = parsePageRange(file.pageRange, pdf.numPages);
            logger.log(`📑 Extraction des pages : ${pagesToRead.join(', ')}`);

            // On boucle uniquement sur les pages demandées
            for (let i = 0; i < pagesToRead.length; i++) {
                const pageNum = pagesToRead[i];
                const page = await pdf.getPage(pageNum);
                
                // Extraction texte standard
                const textContent = await page.getTextContent();
                let pageText = textContent.items.map(item => item.str).join(' ');

                // Détection OCR si page quasi vide
                if (pageText.trim().length < 50) {
                    logger.log(`⚠️ Page ${pageNum}/${pdf.numPages} semble être une image. Passage à l'OCR...`);
                    const canvas = await renderPageToCanvas(page);
                    
                    const pageOCR = await performOCR(
                        canvas, 
                        onProgress, 
                        Math.floor((i / pagesToRead.length) * 100), 
                        Math.floor((1 / pagesToRead.length) * 100)
                    );
                    pageText = pageOCR + '\n';
                }

                // Ajout d'un petit marqueur visuel (optionnel mais très utile pour l'IA)
                fullText += `--- Début de la page ${pageNum} ---\n` + pageText + `\n--- Fin de la page ${pageNum} ---\n\n`;
                
                // Mise à jour de la progression
                if (onProgress) onProgress(Math.floor(((i + 1) / pagesToRead.length) * 100));
            }
            return fullText;
        } catch (e) {
            logger.error(`Erreur lecture PDF ${file.name} : ${e.message}`);
            return null;
        }
    }
	
    // 3. Autres formats bureautiques
    else if (fileName.endsWith('.docx')) {
        if(onProgress) onProgress(50);
        logger.log(`📄 Lecture DOCX : ${file.name}...`);
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        if(onProgress) onProgress(100);
        return result.value;
        
    } else if (fileName.endsWith('.odt')) {
        if(onProgress) onProgress(50);
        const res = await parseOdtFile(file);
        if(onProgress) onProgress(100);
        return res;
        
    } else if (fileName.endsWith('.pptx')) {
        if(onProgress) onProgress(50);
        const res = await parsePptxFile(file);
        if(onProgress) onProgress(100);
        return res;
        
    } else if (fileName.endsWith('.odp')) {
        if(onProgress) onProgress(50);
        const res = await parseOdpFile(file);
        if(onProgress) onProgress(100);
        return res;
        
    } else if (fileName.endsWith('.doc')) {
        logger.warn(`Format .doc non supporté. Convertissez ${file.name} en .docx.`);
        return null;
        
    } else { 
        // 4. Texte brut
        logger.log(`📄 Lecture Texte : ${file.name}...`);
        if(onProgress) onProgress(100);
        return await file.text();
    }
}