// Fichier: modules/utils/exports-pdf/pdf-timeline.js

import { logger } from '../logger.js';
import "../../../../vendor/jspdf/jspdf.umd.min.js";

// --- 0. HELPER NETTOYAGE HTML ---
const cleanHTML = (htmlContent) => {
    if (!htmlContent) return "";
    
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = String(htmlContent);

    const frNode = tempDiv.querySelector('[lang="fr"]');
    if (frNode) return frNode.textContent.trim();

    const enNode = tempDiv.querySelector('[lang="en"]');
    if (enNode) return enNode.textContent.trim();

    const hiddenElements = tempDiv.querySelectorAll('[style*="display: none"], [style*="display:none"], .style_display_none');
    hiddenElements.forEach(el => el.remove());

    let text = tempDiv.textContent || tempDiv.innerText || "";
    text = text
        .replace(/French:\s*/gi, '') 
        .replace(/English:\s*/gi, '') 
        .replace(/label QS:[^]+/, '') 
        .replace(/\s+/g, ' ')         
        .trim();

    return text;
};

// --- 1. HELPER IMAGE ---
const getImageData = async (source) => {
    if (!source) return null;
    try {
        let loadableSrc = null;
        if (source.startsWith('data:image')) loadableSrc = source;
        else if (source.startsWith('http') || source.startsWith('blob:')) {
            const res = await fetch(source);
            const blob = await res.blob();
            loadableSrc = URL.createObjectURL(blob);
        }

        if (!loadableSrc) return null;

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.naturalWidth;
                let height = img.naturalHeight;

                const MAX_SIZE = 1500;
                if (width > MAX_SIZE || height > MAX_SIZE) {
                    if (width > height) { height *= MAX_SIZE / width; width = MAX_SIZE; } 
                    else { width *= MAX_SIZE / height; height = MAX_SIZE; }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                const compressedData = canvas.toDataURL('image/jpeg', 0.7);
                if (source.startsWith('http') || source.startsWith('blob:')) URL.revokeObjectURL(loadableSrc);
                resolve({ data: compressedData, w: width, h: height });
            };
            img.onerror = () => resolve(null);
            img.crossOrigin = "Anonymous";
            img.src = loadableSrc;
        });
    } catch (error) {
        console.error("Erreur image PDF", error);
        return null;
    }
};

// --- 2. HELPER DATES ---
const getYear = (dateStr) => {
    if (!dateStr) return null;
    const match = dateStr.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : null;
};

// --- 3. HELPER METADONNÉES ---
const getMetadataFromDOM = (container, prefix, imgElement = null, h5pField = null) => {
    
    const scope = container || document;

    const getSelectors = (suffix, isTitle = false) => {
        let selectors = [];

        if (h5pField) {
            let h5pKey = suffix;
            if (suffix === 'caption') h5pKey = 'title'; 
            if (suffix === 'credit') h5pKey = 'author';
            
            selectors.push(`input[name*="[${h5pField}][copyright][${h5pKey}]"]`);
            selectors.push(`textarea[name*="[${h5pField}][copyright][${h5pKey}]"]`);
            if (suffix === 'license') {
                selectors.push(`select[name*="[${h5pField}][copyright][license]"]`);
            }
        }

        let dataIdKey = suffix;
        if (suffix === 'caption') dataIdKey = 'title';
        if (suffix === 'credit') dataIdKey = 'author';
        selectors.push(`[data-id="${dataIdKey}"]`);
        selectors.push(`.h5p-copyright-${dataIdKey}`); 

        const standardSelectors = [
            `#${prefix}-${suffix}`,
            `.${prefix}-${suffix}`,
            `[id^="${prefix}"][id$="${suffix}"]`,
            `.inp-img-${suffix}`,
            `.field-${suffix} input`,
            `.h5p-copyright-${suffix} input`
        ];
        
        selectors = [...selectors, ...standardSelectors];

        return selectors;
    };

    const findValue = (selectors) => {
        for (const sel of selectors) {
            const el = scope.querySelector(sel);
            if (el && el.value && el.value.trim() !== "") {
                if (el.tagName === 'SELECT' && el.selectedOptions.length > 0) {
                     return cleanHTML(el.selectedOptions[0].text);
                }
                return cleanHTML(el.value);
            }
        }
        return "";
    };

    let caption = findValue(getSelectors('caption', true));
    if (!caption && imgElement && imgElement.alt) caption = cleanHTML(imgElement.alt);

    let year = findValue(getSelectors('year'));
    if (!year) year = findValue(getSelectors('date')); 

    let credit = findValue(getSelectors('credit'));
    if (!credit) credit = findValue(getSelectors('author'));

    let license = findValue(getSelectors('license'));
    if (!license) license = findValue(getSelectors('copyright')); 
    if (!license) license = findValue(getSelectors('droits'));

    let source = findValue(getSelectors('source'));

    return {
        caption: caption,
        year: year,
        credit: credit,
        source: source,
        license: license
    };
};

// --- HELPER URL WRAPPING ---
// Ajoute des espaces classiques après les caractères spéciaux pour permettre la césure par jsPDF
const makeUrlBreakable = (url) => {
    if (!url) return "";
    // Remplacer \u200B par un espace normal ' ' pour que jsPDF calcule correctement la largeur
    return url.replace(/([\/_\.\-\?=&])/g, '$1 ');
};

// --- 4. FONCTION PRINCIPALE ---
// 🟢 AJOUT DU PARAMÈTRE returnBlobOnly
export async function exportPDF_Timeline(returnBlobOnly = false) {
    try {
        const { jsPDF } = window.jspdf;
        const titreInput = document.getElementById('timeline-subject');
        const titre = titreInput ? cleanHTML(titreInput.value) : 'Frise Chronologique';
        
        const introInput = document.getElementById('timeline-intro-text');
        const intro = introInput ? cleanHTML(introInput.value) : '';
        
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const PAGE_W = 297;
        const PAGE_H = 210;
        const MARGIN = 15;

        // --- A. PÉRIODES ---
        const eraElements = document.querySelectorAll('.timeline-era-card');
        const eras = [];
        eraElements.forEach(el => {
            eras.push({
                start: cleanHTML(el.querySelector('.era-date-start').value),
                end: cleanHTML(el.querySelector('.era-date-end').value),
                title: cleanHTML(el.querySelector('.era-title').value),
                text: cleanHTML(el.querySelector('.era-text').value),
                tag: cleanHTML(el.querySelector('.era-tag').value)
            });
        });

        // ==========================================
        // --- B. PAGE DE COUVERTURE ---
        // ==========================================
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(28);
        doc.setTextColor(88, 17, 26);
        
        const splitTitle = doc.splitTextToSize(titre, PAGE_W - (MARGIN * 2));
        const titleY = 20; 
        doc.text(splitTitle, PAGE_W / 2, titleY, { align: 'center' });

        let cursorY = titleY + (splitTitle.length * 10) + 5;

        // Image de fond
        const bgInput = document.getElementById('bg-final-url');
        const bgImgElement = document.querySelector('#bg-preview-img') || document.querySelector('.bg-preview-img'); 
        const bgImgSrc = bgInput ? bgInput.value.trim() : (bgImgElement ? bgImgElement.src : null);

        if (bgImgSrc) { 
            const bgData = await getImageData(bgImgSrc);
            if (bgData) {
                const maxW = 180; 
                const maxH = 85; 
                const scale = Math.min(maxW / bgData.w, maxH / bgData.h);
                const w = bgData.w * scale; 
                const h = bgData.h * scale;
                const x = (PAGE_W - w)/2;
                
                doc.addImage(bgData.data, 'JPEG', x, cursorY, w, h);
                cursorY += h + 5; 

                // --- MÉTADONNÉES BACKGROUND ---
                let bgContainer = document.querySelector('.field-name-backgroundImage');
                if (!bgContainer && bgInput) {
                     bgContainer = bgInput.closest('.field-name-backgroundImage') || bgInput.closest('.h5p-v-anchor') || document;
                }
                const bgMeta = getMetadataFromDOM(bgContainer, 'bg-final', bgImgElement, 'backgroundImage'); 
                
                doc.setFontSize(8); 
                doc.setTextColor(100);
                
                const textWidth = Math.max(w, 80); 
                const textX = (PAGE_W - textWidth) / 2;

                // 1. Légende
                if (bgMeta.caption) {
                    doc.setFont("helvetica", "bold");
                    const splitCap = doc.splitTextToSize(bgMeta.caption, textWidth);
                    doc.text(splitCap, textX, cursorY);
                    cursorY += (splitCap.length * 3.5) + 1;
                }
                
                // 2. Date
                if (bgMeta.year) {
                    doc.setFont("helvetica", "normal");
                    doc.text(`Date : ${bgMeta.year}`, textX, cursorY);
                    cursorY += 4;
                }

                // 3. Crédit + Licence
                let creditText = "";
                if (bgMeta.credit) creditText += `Crédit : ${bgMeta.credit}`;
                if (bgMeta.license && bgMeta.license !== 'U') {
                    creditText += bgMeta.credit ? ` (${bgMeta.license})` : `Licence : ${bgMeta.license}`;
                }
                if (creditText) {
                    doc.setFont("helvetica", "italic");
                    const splitCred = doc.splitTextToSize(creditText, textWidth);
                    doc.text(splitCred, textX, cursorY);
                    cursorY += (splitCred.length * 3.5) + 1;
                }

                // 4. Source (URL COMPLÈTE)
                if (bgMeta.source) {
                    doc.setFont("helvetica", "italic"); doc.setTextColor(100);
                    // On prépare l'URL pour qu'elle puisse être coupée en bout de ligne
                    const breakableSource = makeUrlBreakable(bgMeta.source);
                    const splitSource = doc.splitTextToSize(`Source : ${breakableSource}`, textWidth);
                    
                    // Note : textWithLink ne supporte pas bien le multi-lignes standard, on utilise text() avec l'option url
                    doc.text(splitSource, textX, cursorY, { url: bgMeta.source });
                    cursorY += (splitSource.length * 3.5) + 1;
                }
            }
        }

        cursorY += 10; 
        if (cursorY < 60) cursorY = 60; 

        if (intro) {
            if (cursorY > 200) { doc.addPage(); cursorY = 30; }
            doc.setFont("helvetica", "normal");
            doc.setFontSize(14);
            doc.setTextColor(60);
            const splitIntro = doc.splitTextToSize(intro, 220);
            doc.text(splitIntro, PAGE_W / 2, cursorY, { align: 'center' });
        }

        // --- C. SOMMAIRE ---
        if (eras.length > 0) {
            doc.addPage();
            doc.setFillColor(245, 245, 245);
            doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(20);
            doc.setTextColor(50);
            doc.text("Périodes Clés", MARGIN, 20);

            let eraY = 35;
            eras.forEach(era => {
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(200);
                doc.rect(MARGIN, eraY, PAGE_W - (MARGIN*2), 30, 'FD');
                doc.setFontSize(14);
                doc.setTextColor(88, 17, 26);
                doc.text(`${era.title} (${era.start} - ${era.end})`, MARGIN + 5, eraY + 10);
                doc.setFontSize(11);
                doc.setTextColor(80);
                doc.setFont("helvetica", "normal");
                const splitDesc = doc.splitTextToSize(era.text, PAGE_W - (MARGIN*2) - 10);
                doc.text(splitDesc, MARGIN + 5, eraY + 18);
                eraY += 35;
                if (eraY > PAGE_H - 30) return;
            });
        }

        // --- D. ÉVÉNEMENTS ---
        const cards = document.querySelectorAll('.timeline-card');
        
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const dateStart = cleanHTML(card.querySelector('.inp-date-start')?.value);
            const dateEnd = cleanHTML(card.querySelector('.inp-date-end')?.value);
            const title = cleanHTML(card.querySelector('.inp-title')?.value);
            const text = cleanHTML(card.querySelector('.inp-text')?.value);
            const tag = cleanHTML(card.querySelector('.inp-tag')?.value);
            
            let dateStr = dateStart;
            if (dateEnd) dateStr += ` - ${dateEnd}`;

            // Image
            let imgData = null;
            const imgPreview = card.querySelector('.selected-img-preview');
            const imgUrlInput = card.querySelector('.final-img-url');
            let sourceToUse = imgUrlInput ? imgUrlInput.value.trim() : null;
            if (!sourceToUse && imgPreview && imgPreview.src.startsWith('data:')) sourceToUse = imgPreview.src;
            else if (!sourceToUse && imgPreview && imgPreview.src.startsWith('http')) sourceToUse = imgPreview.src;

            if (sourceToUse && !sourceToUse.includes('window.location')) {
               imgData = await getImageData(sourceToUse);
            }

            const evtYear = getYear(dateStart);
            let matchingEra = null;
            if (evtYear) {
                matchingEra = eras.find(e => {
                    const s = getYear(e.start);
                    const end = getYear(e.end);
                    return s && end && evtYear >= s && evtYear <= end;
                });
            }

            doc.addPage();
            doc.setFillColor(240, 240, 240);
            doc.rect(0, 0, PAGE_W, 35, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.setTextColor(50);
            doc.text(dateStr, MARGIN, 18);

            if (matchingEra) {
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.setFont("helvetica", "italic");
                doc.text(`Période : ${matchingEra.title}`, MARGIN, 28);
            }

            if (tag) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(12);
                doc.setTextColor(255);
                doc.setFillColor(100, 116, 139); 
                const tagW = doc.getTextWidth(tag) + 10;
                doc.roundedRect(PAGE_W - MARGIN - tagW, 12, tagW, 10, 3, 3, 'F');
                doc.text(tag, PAGE_W - MARGIN - (tagW/2), 18.5, { align: 'center' });
            }

            doc.setFontSize(24);
            doc.setTextColor(88, 17, 26); 
            doc.text(title, MARGIN, 55);

            const contentStartY = 70;
            
            if (imgData) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(14);
                doc.setTextColor(0);
                const splitDesc = doc.splitTextToSize(text, 160);
                doc.text(splitDesc, MARGIN, contentStartY);

                const imgBoxX = 180;
                const imgBoxY = contentStartY - 5;
                const imgBoxW = 100;
                const imgBoxH = 100;
                const scale = Math.min(imgBoxW / imgData.w, imgBoxH / imgData.h);
                const finalW = imgData.w * scale;
                const finalH = imgData.h * scale;
                const finalX = imgBoxX + (imgBoxW - finalW) / 2;
                
                try {
                    doc.addImage(imgData.data, 'JPEG', finalX, imgBoxY, finalW, finalH);
                } catch(err) { console.warn("Err img", err); }
                
                const imgMeta = getMetadataFromDOM(card, 'final-img', imgPreview); 
                
                if (!imgMeta.caption) {
                    const manualInput = card.querySelector('.inp-caption');
                    if (manualInput) imgMeta.caption = cleanHTML(manualInput.value);
                }

                let currentY = imgBoxY + finalH + 6;
                const metaWidth = Math.max(finalW, 50); 
                
                doc.setFontSize(8); doc.setTextColor(80);

                if (imgMeta.caption) {
                    doc.setFont("helvetica", "bold");
                    const splitT = doc.splitTextToSize(imgMeta.caption, metaWidth);
                    doc.text(splitT, finalX, currentY);
                    currentY += (splitT.length * 3.5) + 1;
                }
                
                if (imgMeta.year) {
                    doc.setFont("helvetica", "normal");
                    doc.text(`Date : ${imgMeta.year}`, finalX, currentY);
                    currentY += 4;
                }

                let credTxt = "";
                if (imgMeta.credit) credTxt += `Crédit : ${imgMeta.credit}`;
                if (imgMeta.license && imgMeta.license !== 'U') {
                    credTxt += imgMeta.credit ? ` (${imgMeta.license})` : `Licence : ${imgMeta.license}`;
                }
                if (credTxt) {
                    doc.setFont("helvetica", "italic");
                    const splitC = doc.splitTextToSize(credTxt, metaWidth);
                    doc.text(splitC, finalX, currentY);
                    currentY += (splitC.length * 3.5) + 1;
                }

                // URL COMPLÈTE (Events)
                // On récupère la source explicite (si elle existe), sinon on se rabat sur l'URL du média (.final-img-url)
                const finalSourceUrl = imgMeta.source || (imgUrlInput ? cleanHTML(imgUrlInput.value) : null);

                if (finalSourceUrl) {
                    doc.setFont("helvetica", "italic"); 
                    doc.setTextColor(100);
                    
                    // Utilisation de votre super fonction de césure !
                    const breakableSource = makeUrlBreakable(finalSourceUrl);
                    const splitSource = doc.splitTextToSize(`Source : ${breakableSource}`, metaWidth);
                    
                    doc.text(splitSource, finalX, currentY, { url: finalSourceUrl });
                    
                    // On incrémente le curseur Y au cas où vous voudriez ajouter d'autres éléments en dessous plus tard
                    currentY += (splitSource.length * 3.5) + 1; 
                }

            } else {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(14);
                doc.setTextColor(0);
                const splitDesc = doc.splitTextToSize(text, PAGE_W - (MARGIN * 2));
                doc.text(splitDesc, MARGIN, contentStartY);
            }

            doc.setFontSize(10);
            doc.setTextColor(200);
            doc.text(`${i + 1} / ${cards.length}`, PAGE_W / 2, PAGE_H - 10, { align: 'center' });
        }

        const fileName = `${titre.replace(/\s+/g, '_')}_Timeline.pdf`;

        // 🟢 NOUVELLE LOGIQUE D'INSERTION DU BLOB
        if (returnBlobOnly) {
            return { blob: doc.output('blob'), fileName };
        }

        doc.save(fileName);
        logger.log('✅ Export PDF Timeline (URL Complète) terminé.');

    } catch (e) {
        console.error(e);
        // 🟢 ALERTE RENDUE SILENCIEUSE
        if (!returnBlobOnly) alert("Erreur export PDF : " + e.message);
        return null;
    }
}