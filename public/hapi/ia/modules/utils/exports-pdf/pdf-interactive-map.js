// Fichier: modules/utils/exports-pdf/pdf-interactive-map.js

import { logger } from '../../utils/logger.js'; // Ajustez le chemin de l'import selon votre arborescence
import "../../../../vendor/jspdf/jspdf.umd.min.js";

// ============================================================================
// 1. HELPERS BASIQUES
// ============================================================================

const cleanHTML = (htmlContent) => {
    if (!htmlContent) return "";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = String(htmlContent);
    const hiddenElements = tempDiv.querySelectorAll('[style*="display: none"], [style*="display:none"]');
    hiddenElements.forEach(el => el.remove());
    return (tempDiv.textContent || tempDiv.innerText || "").replace(/\s+/g, ' ').trim();
};

const convertToDMS = (dd, isLongitude) => {
    if (isNaN(dd)) return "Invalide";
    const dir = dd < 0 ? (isLongitude ? 'O' : 'S') : (isLongitude ? 'E' : 'N');
    const absDd = Math.abs(dd);
    const deg = Math.floor(absDd);
    const minFloat = (absDd - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = Math.round((minFloat - min) * 60);
    return `${deg}° ${min}' ${sec}" ${dir}`;
};

const extractExternalUrl = (val) => {
    if (!val) return null;
    let url = null;

    if (val.toLowerCase().startsWith('<iframe')) {
        const match = val.match(/src=["']?([^"'\s>]+)/);
        if (match && match[1]) {
            url = match[1];
            if (url.startsWith('//')) url = 'https:' + url;
        }
    } else if (val.startsWith('http')) {
        url = val;
    }

    if (!url) return null;

    if (url.includes('youtube.com/embed/') || url.includes('youtube-nocookie.com/embed/')) {
        const videoIdMatch = url.match(/embed\/([^?&]+)/);
        if (videoIdMatch && videoIdMatch[1]) return `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
    }
    
    if (url.includes('player.vimeo.com/video/')) {
        const videoIdMatch = url.match(/video\/([^?&]+)/);
        if (videoIdMatch && videoIdMatch[1]) return `https://vimeo.com/${videoIdMatch[1]}`;
    }

    if (url.includes('podeduc.apps.education.fr') && url.includes('is_iframe=true')) {
        url = url.replace('?is_iframe=true', '').replace('&is_iframe=true', '');
    }

    return url;
};

// ============================================================================
// 2. HELPERS DE GÉNÉRATION D'IMAGES (QR, Médias, et Rendu HTML)
// ============================================================================

const generateQRCodeBase64 = async (url) => {
    if (typeof QRious === 'undefined') {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = new URL('../../../../vendor/qrious/qrious.min.js', import.meta.url).href;
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
    const qr = new QRious({ value: url, size: 256, level: 'M' });
    return qr.toDataURL('image/jpeg');
};

const getImageData = async (source) => {
    if (!source) return null;
    try {
        let loadableSrc = null;
        
        if (source.startsWith('data:image')) {
            loadableSrc = source; 
        } else if (source.startsWith('http') || source.startsWith('blob:')) {
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
                const MAX_SIZE = 1000; 
                
                if (width > MAX_SIZE || height > MAX_SIZE) {
                    if (width > height) { height *= MAX_SIZE / width; width = MAX_SIZE; } 
                    else { width *= MAX_SIZE / height; height = MAX_SIZE; }
                }
                
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                resolve({ data: canvas.toDataURL('image/jpeg', 0.8), w: width, h: height });
            };
            img.onerror = () => resolve(null);
            img.src = loadableSrc; 
        });
    } catch (e) { return null; }
};

const renderHtmlToImage = async (htmlContent, widthMm, fontSize = 12) => {
    if (!htmlContent || htmlContent.trim() === '' || htmlContent === '<p><br></p>') return null;
    if (typeof html2canvas === 'undefined') return null;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const scale = 3; 
    const pxWidth = Math.floor(widthMm * 3.78 * scale);
    
    tempDiv.style.cssText = `
        position: absolute; left: -9999px; top: 0; width: ${pxWidth}px; 
        background: transparent; font-family: 'Helvetica', 'Arial', sans-serif;
        font-size: ${fontSize * scale}px; color: #000000; line-height: 1.4; padding: 0; margin: 0;
    `;

    const styles = document.createElement('style');
    styles.textContent = `
        #temp-pdf-text p { margin: 0 0 ${4 * scale}px 0; }
        #temp-pdf-text ul, #temp-pdf-text ol { margin: 0 0 ${4 * scale}px 0; padding-left: ${20 * scale}px; }
        #temp-pdf-text li { margin-bottom: ${2 * scale}px; }
        #temp-pdf-text a { color: #0369a1; text-decoration: none; }
        #temp-pdf-text strong, #temp-pdf-text b { font-weight: bold; }
        #temp-pdf-text em, #temp-pdf-text i { font-style: italic; }
        #temp-pdf-text u { text-decoration: underline; }
    `;
    tempDiv.id = 'temp-pdf-text';
    tempDiv.appendChild(styles);
    document.body.appendChild(tempDiv);

    try {
        await new Promise(r => setTimeout(r, 50)); 

        const links = [];
        const aTags = tempDiv.querySelectorAll('a');
        const containerRect = tempDiv.getBoundingClientRect();
        
        aTags.forEach(a => {
            const rects = a.getClientRects(); 
            for (let i = 0; i < rects.length; i++) {
                const r = rects[i];
                links.push({
                    url: a.href, 
                    x: r.left - containerRect.left, 
                    y: r.top - containerRect.top, 
                    w: r.width, h: r.height
                });
            }
        });

        const canvas = await html2canvas(tempDiv, { scale: 1, useCORS: true, logging: false, backgroundColor: null });
        const imgData = canvas.toDataURL('image/png', 1.0);
        const heightMm = canvas.height / (3.78 * scale);
        
        document.body.removeChild(tempDiv);
        return { imgData, heightMm, pxWidth, links };
    } catch(e) {
        if(document.body.contains(tempDiv)) document.body.removeChild(tempDiv);
        return null;
    }
};

// ============================================================================
// 3. GÉNÉRATEUR CARTE GLOBALE (SNAPSHOT)
// ============================================================================

const generateGlobalMapImage = async (markersData, mapStyleUrl) => {
    if (typeof L === 'undefined') return null;

    if (typeof html2canvas === 'undefined') {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = new URL('../../../../vendor/html2canvas/html2canvas.min.js', import.meta.url).href;
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    return new Promise((resolve) => {
        const mapContainer = document.createElement('div');
        mapContainer.id = 'temp-pdf-map';
        mapContainer.style.cssText = 'position:fixed; top:-10000px; left:0; width:1200px; height:600px; z-index:-1;';
        document.body.appendChild(mapContainer);

        const tempMap = L.map('temp-pdf-map', { 
            zoomControl: false, attributionControl: false, fadeAnimation: false, zoomAnimation: false, markerZoomAnimation: false
        });
    
        L.tileLayer(mapStyleUrl, { crossOrigin: true, maxZoom: 18 }).addTo(tempMap);

        const coords = [];
        markersData.forEach((m, i) => {
            const safeLat = typeof m.lat === 'string' ? parseFloat(m.lat.replace(',', '.')) : m.lat;
            const safeLng = typeof m.lng === 'string' ? parseFloat(m.lng.replace(',', '.')) : m.lng;

            if (!isNaN(safeLat) && !isNaN(safeLng)) {
                coords.push([safeLat, safeLng]);
                const icon = L.divIcon({
                    className: 'pdf-marker',
                    html: `<div style="
                        background:#0369a1; color:white; width:30px; height:30px; border-radius:50%; 
                        border:3px solid white; box-shadow:0 3px 6px rgba(0,0,0,0.3); opacity:0.95;
                        display: flex; justify-content: center; align-items: center; 
                        font-weight:bold; font-size:16px; font-family:'Arial', 'Helvetica', sans-serif;
                    ">${i+1}</div>`,
                    iconSize: [36, 36], iconAnchor: [18, 18] 
                });
                L.marker([safeLat, safeLng], { icon }).addTo(tempMap);
            }
        });

        tempMap.invalidateSize();

        if (coords.length > 0) {
            const bounds = L.latLngBounds(coords);
            const distance = bounds.getNorthEast().distanceTo(bounds.getSouthWest());
            if (distance < 500) tempMap.setView(bounds.getCenter(), 14, { animate: false });
            else tempMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: false });
        } else {
            tempMap.setView([46.2, 2.2], 5, { animate: false });
        }

        setTimeout(async () => {
            try {
                const canvas = await html2canvas(mapContainer, { useCORS: true, allowTaint: false, logging: false, scale: 1.5 });
                const imgData = canvas.toDataURL('image/jpeg', 0.8);
                tempMap.remove(); document.body.removeChild(mapContainer);
                resolve({ data: imgData, w: canvas.width, h: canvas.height });
            } catch (e) {
                tempMap.remove(); document.body.removeChild(mapContainer);
                resolve(null);
            }
        }, 1500);
    });
};

// ============================================================================
// 4. FONCTION D'EXPORT PRINCIPALE
// ============================================================================

// 🟢 AJOUT DU PARAMÈTRE returnBlobOnly
export async function exportPDF_InteractiveMap(returnBlobOnly = false) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        
        const PAGE_W = 297;
        const PAGE_H = 210;
        const MARGIN = 15;
        const MID_X = PAGE_W / 2;

        const titreInput = document.getElementById('map-subject');
        const titre = titreInput ? cleanHTML(titreInput.value) : 'Carte Interactive';
        
        const introInput = document.getElementById('desc-hidden-intro') || document.getElementById('map-intro-text');
        const introHtml = introInput ? introInput.value : '';
        const introPlain = cleanHTML(introHtml);
        
        const cards = document.querySelectorAll('.map-marker-card');

        if (cards.length === 0) {
            // 🟢 ALERTE RENDUE SILENCIEUSE
            if (!returnBlobOnly) alert("Aucun repère à exporter.");
            return null;
        }

        const langueSelect = document.getElementById('output-language-select');
        const langueChoisie = langueSelect ? langueSelect.value : 'Français';
        const styleSelect = document.getElementById('map-style');
        const selectedStyle = styleSelect ? styleSelect.value : 'osm'; 

        const getTileUrls = (langue) => {
            let osmUrl = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
            if (langue === 'German' || langue === 'Allemand') osmUrl = 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';
            else if (langue !== 'Français' && langue !== 'French') osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            
            return {
                'voyager': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
                'osm': osmUrl,
                'satellite': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
                'topo': 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
                'ign_cassini': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.CASSINI&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
                'ign_1950': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS.1950-1965&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
            };
        };
        const dynamicTileUrls = getTileUrls(langueChoisie);
        const activeMapUrl = dynamicTileUrls[selectedStyle] || dynamicTileUrls['osm'];

        const markersData = Array.from(cards).map(card => ({
            lat: parseFloat(card.querySelector('.inp-lat')?.value),
            lng: parseFloat(card.querySelector('.inp-lng')?.value)
        }));

        // PAGE 1 : COUVERTURE
        doc.setFont("helvetica", "bold");
        doc.setFontSize(28);
        doc.setTextColor(3, 105, 161);
        
        const splitTitle = doc.splitTextToSize(titre, PAGE_W - (MARGIN * 2));
        doc.text(splitTitle, PAGE_W / 2, 25, { align: 'center' });

        let cursorY = 25 + (splitTitle.length * 10) + 5;

        if (introHtml && introPlain !== '') {
            const introRender = await renderHtmlToImage(introHtml, 240, 14); 
            if (introRender) {
                const x = (PAGE_W - 240) / 2;
                doc.addImage(introRender.imgData, 'PNG', x, cursorY, 240, introRender.heightMm);
                if (introRender.links && introRender.links.length > 0) {
                    const ratio = 240 / introRender.pxWidth;
                    introRender.links.forEach(link => {
                        doc.link(x + (link.x * ratio), cursorY + (link.y * ratio), link.w * ratio, link.h * ratio, { url: link.url });
                    });
                }
                cursorY += introRender.heightMm + 10;
            } else {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(14); 
                doc.setTextColor(60);
                const splitIntro = doc.splitTextToSize(introPlain, 240);
                doc.text(splitIntro, PAGE_W / 2, cursorY, { align: 'center' });
                cursorY += (splitIntro.length * 7) + 5;
            }
        }

        const globalImg = await generateGlobalMapImage(markersData, activeMapUrl);
        if (globalImg) {
            const availableHeight = PAGE_H - cursorY - MARGIN;
            const maxW = PAGE_W - (MARGIN * 2);
            const scale = Math.min(maxW / globalImg.w, availableHeight / globalImg.h);
            const w = globalImg.w * scale;
            const h = globalImg.h * scale;
            const x = (PAGE_W - w) / 2;
            
            doc.setDrawColor(200);
            doc.setLineWidth(1);
            doc.rect(x, cursorY, w, h);
            doc.addImage(globalImg.data, 'JPEG', x, cursorY, w, h);
        }

        // PAGES SUIVANTES : COLONNES
        const colWidth = (PAGE_W / 2) - MARGIN - 10; 

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            
            if (i % 2 === 0) {
                doc.addPage();
                doc.setDrawColor(200);
                doc.setLineWidth(0.5);
                doc.line(MID_X, MARGIN, MID_X, PAGE_H - MARGIN);
            }

            const isLeftCol = (i % 2 === 0);
            const startX = isLeftCol ? MARGIN : MID_X + 10;
            let colY = MARGIN + 5;

            const mTitle = cleanHTML(card.querySelector('.inp-title')?.value) || "Sans titre";
            const mDate = cleanHTML(card.querySelector('.inp-date')?.value);
            const mTextHtml = card.querySelector('.inp-text')?.value || "";
            const mTextPlain = cleanHTML(mTextHtml);
            
            const rawLat = parseFloat(card.querySelector('.inp-lat')?.value) || 0;
            const rawLng = parseFloat(card.querySelector('.inp-lng')?.value) || 0;
            const mLatDMS = convertToDMS(rawLat, false);
            const mLngDMS = convertToDMS(rawLng, true);
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(3, 105, 161);
            const splitMTitle = doc.splitTextToSize(`${i + 1}. ${mTitle}`, colWidth);
            doc.text(splitMTitle, startX, colY);
            colY += (splitMTitle.length * 8) + 2;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(255);
            doc.setFillColor(71, 85, 105); 
            doc.roundedRect(startX, colY - 5, 115, 7, 2, 2, 'F');
            doc.text(`Latitude : ${mLatDMS} | Longitude : ${mLngDMS}`, startX + 2, colY);
            
            colY += 8;
            
            if (mDate) {
                doc.setTextColor(100);
                doc.setFont("helvetica", "italic");
                doc.text(`Date : ${mDate}`, startX, colY); 
                colY += 6; 
            } else { colY += 2; }

            const imgPreview = card.querySelector('.selected-img-preview');
            const imgUrlInput = card.querySelector('.final-img-url');
            let sourceToUse = imgUrlInput ? imgUrlInput.value.trim() : null;
            if (!sourceToUse && imgPreview && imgPreview.src.startsWith('data:')) sourceToUse = imgPreview.src;

            const externalUrl = extractExternalUrl(sourceToUse);
            let qrBase64 = null;
            if (externalUrl) qrBase64 = await generateQRCodeBase64(externalUrl);

            if (sourceToUse) {
                const imgData = await getImageData(sourceToUse);
                if (imgData) {
                    const imgBoxW = colWidth;
                    const imgBoxH = 65; 
                    const scale = Math.min(imgBoxW / imgData.w, imgBoxH / imgData.h);
                    const finalW = imgData.w * scale;
                    const finalH = imgData.h * scale;
                    const finalX = startX + (colWidth - finalW) / 2;
                    
                    doc.addImage(imgData.data, 'JPEG', finalX, colY, finalW, finalH);
                    colY += finalH + 5;

                    const mCaption = cleanHTML(card.querySelector('.inp-caption')?.value);
                    if (mCaption) {
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(9);
                        doc.setTextColor(51, 65, 85);
                        const splitCaption = doc.splitTextToSize(mCaption, colWidth);
                        doc.text(splitCaption, startX, colY);
                        colY += (splitCaption.length * 4) + 2;
                    }

                    const mCredit = cleanHTML(card.querySelector('.final-img-credit')?.value);
                    if (mCredit) {
                        doc.setFont("helvetica", "italic");
                        doc.setFontSize(8);
                        doc.setTextColor(120);
                        doc.text(`© ${mCredit}`, startX, colY);
                        colY += 5;
                    }
                }
            }

            colY += 2;
            if (mTextHtml && mTextPlain !== '') {
                const descRender = await renderHtmlToImage(mTextHtml, colWidth, 12); 
                if (descRender) {
                    doc.addImage(descRender.imgData, 'PNG', startX, colY, colWidth, descRender.heightMm);
                    if (descRender.links && descRender.links.length > 0) {
                        const ratio = colWidth / descRender.pxWidth;
                        descRender.links.forEach(link => {
                            doc.link(startX + (link.x * ratio), colY + (link.y * ratio), link.w * ratio, link.h * ratio, { url: link.url });
                        });
                    }
                    colY += descRender.heightMm; 
                } else {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(12); 
                    doc.setTextColor(0);
                    const splitDesc = doc.splitTextToSize(mTextPlain, colWidth);
                    doc.text(splitDesc, startX, colY);
                    colY += (splitDesc.length * 5); 
                }
            }
            
            if (qrBase64 && externalUrl) {
                colY += 5; 
                const qrSize = 38; 
                doc.addImage(qrBase64, 'JPEG', startX, colY, qrSize, qrSize);
                doc.setFont("helvetica", "bolditalic");
                doc.setFontSize(9);
                doc.setTextColor(3, 105, 161); 
                const isIframe = sourceToUse.toLowerCase().startsWith('<iframe');
                const qrText1 = isIframe ? "Média interactif" : "Média distant";
                doc.text(qrText1, startX + qrSize + 5, colY + 16);
                doc.setFont("helvetica", "italic");
                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.text("Scannez ou Ctrl+Clic pour l'ouvrir", startX + qrSize + 5, colY + 22);
                doc.link(startX, colY, qrSize + 55, qrSize, { url: externalUrl });
                colY += qrSize + 5; 
            }
        } 

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(150);
            doc.text(`Page ${i} / ${pageCount}`, PAGE_W / 2, PAGE_H - 10, { align: 'center' });
        }

        const fileName = `${titre.replace(/\s+/g, '_')}_Carte.pdf`;

        // 🟢 NOUVELLE LOGIQUE D'INSERTION DU BLOB
        if (returnBlobOnly) {
            return { blob: doc.output('blob'), fileName };
        }

        doc.save(fileName);
        logger.log('✅ Export PDF Interactive Map terminé.');

    } catch (e) { 
        console.error("Erreur PDF:", e);
        // 🟢 ALERTE RENDUE SILENCIEUSE
        if (!returnBlobOnly) alert("Erreur lors de la génération du PDF : " + e.message);
        return null;
    }
}