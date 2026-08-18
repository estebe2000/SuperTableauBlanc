// Fichier: modules/utils/exports-pdf/pdf-image-pairing.js

import { logger } from '../logger.js';
import "../../../../vendor/jspdf/jspdf.umd.min.js";

// Helper amélioré : Retourne le Base64 ET les dimensions originales
const getImageData = async (source, type) => {
    if (!source) return null;

    try {
        let base64String = null;

        // 1. Récupération du Base64 brut
        if (type === 'file') {
            base64String = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(source);
            });
        } 
        else if (type === 'url') {
            const res = await fetch(source);
            const blob = await res.blob();
            base64String = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        if (!base64String) return null;

        // 2. Calcul des dimensions via un objet Image
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    data: base64String,
                    w: img.naturalWidth,
                    h: img.naturalHeight
                });
            };
            img.onerror = () => resolve(null); // En cas d'erreur image, on renvoie null
            img.src = base64String;
        });

    } catch (error) {
        console.error("Erreur récup image PDF", error);
        return null;
    }
};

export async function exportPDF_ImagePairing() {
    try {
        const { jsPDF } = window.jspdf;
        const titreFichier = document.getElementById('imgpair-title').value || 'Appariement';
        
        // 1. Initialisation A4 PAYSAGE
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        // --- GÉOMÉTRIE ---
        const PAGE_WIDTH = 297;
        const PAGE_HEIGHT = 210;
        const MARGIN = 10;
        
        const HEADER_HEIGHT = 25;
        const PAIR_HEIGHT = 55;
        const COL_WIDTH = (PAGE_WIDTH - (MARGIN * 2)) / 2;

        // 2. Récupération des données
        const cardElements = document.querySelectorAll('#imgpair-list .card');
        const pairsToPrint = [];

        // Extraction des données (y compris dimensions images)
        const extractSideData = async (card, side) => {
            const typeSelect = card.querySelector(`.type-select[data-side="${side}"]`);
            if (!typeSelect) return { type: 'text', content: '' };
            
            const type = typeSelect.value;
            
            if (type === 'text') {
                const textVal = card.querySelector(`.input-text-${side}`).value.trim();
                return { type: 'text', content: textVal };
            } 
            else if (type === 'upload') {
                const fileInput = card.querySelector(`.input-file-${side}`);
                if (fileInput && fileInput.files[0]) {
                    // Retourne { data, w, h }
                    return { type: 'image', content: await getImageData(fileInput.files[0], 'file') };
                }
            }
            else {
                // IA ou Wiki
                let imgSelector = type === 'ia' ? `.img-preview-${side}` : `.img-preview-wiki-${side}`;
                const imgEl = card.querySelector(imgSelector);
                if (imgEl && imgEl.src && !imgEl.src.includes('hapi-ph') && !imgEl.src.startsWith('data:image/svg')) {
                    // Retourne { data, w, h }
                    return { type: 'image', content: await getImageData(imgEl.src, 'url') };
                }
            }
            return { type: 'empty', content: null };
        };

        for (const el of cardElements) {
            const leftData = await extractSideData(el, 'left');
            const rightData = await extractSideData(el, 'right');
            pairsToPrint.push({ left: leftData, right: rightData });
        }

        if (pairsToPrint.length === 0) {
            alert("Aucune paire à exporter.");
            return;
        }

        // 3. GÉNÉRATION
        let yPos = MARGIN + HEADER_HEIGHT;
        let pairsOnPage = 0;

        // Titre
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(88, 17, 26); // Lie de vin
        doc.text(titreFichier, PAGE_WIDTH / 2, 15, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.setFont("helvetica", "italic");
        doc.text("Activité d'association : Reliez ou assemblez les éléments correspondants.", PAGE_WIDTH / 2, 22, { align: 'center' });

        const drawHeaders = (y) => {
            doc.setFillColor(240, 240, 240);
            doc.rect(MARGIN, y, COL_WIDTH, 8, 'F');
            doc.rect(MARGIN + COL_WIDTH, y, COL_WIDTH, 8, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(50);
            doc.text("ÉLÉMENT A", MARGIN + 5, y + 5.5);
            doc.text("ÉLÉMENT B", MARGIN + COL_WIDTH + 5, y + 5.5);
        };

        drawHeaders(yPos - 8);

        for (let i = 0; i < pairsToPrint.length; i++) {
            const pair = pairsToPrint[i];

            if (pairsOnPage === 3) {
                doc.addPage('a4', 'landscape');
                yPos = MARGIN + 10;
                pairsOnPage = 0;
                drawHeaders(yPos - 8);
            }

            // Cadres
            doc.setDrawColor(200);
            doc.setLineWidth(0.2);
            doc.rect(MARGIN, yPos, COL_WIDTH, PAIR_HEIGHT);
            doc.rect(MARGIN + COL_WIDTH, yPos, COL_WIDTH, PAIR_HEIGHT);

            // --- FONCTION D'AFFICHAGE INTELLIGENTE ---
            const renderContent = (data, xBase, yBase, cellW, cellH) => {
                if (data.type === 'text') {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(12);
                    doc.setTextColor(0);
                    const splitText = doc.splitTextToSize(data.content, cellW - 10);
                    const blockH = splitText.length * 6;
                    const textY = yBase + (cellH / 2) - (blockH / 2) + 4;
                    doc.text(splitText, xBase + (cellW / 2), textY, { align: 'center' });
                } 
                else if (data.type === 'image' && data.content && data.content.data) {
                    const imgObj = data.content; // Contient { data, w, h }
                    
                    // Marges internes pour que l'image ne touche pas les bords
                    const padding = 4; // 4mm de marge
                    const maxImgW = cellW - (padding * 2);
                    const maxImgH = cellH - (padding * 2);

                    // --- CALCUL DU RATIO (CONTAIN) ---
                    // On cherche le facteur d'échelle le plus petit pour faire entrer l'image
                    const ratioW = maxImgW / imgObj.w;
                    const ratioH = maxImgH / imgObj.h;
                    const scale = Math.min(ratioW, ratioH);

                    // Nouvelles dimensions
                    const finalW = imgObj.w * scale;
                    const finalH = imgObj.h * scale;

                    // Centrage
                    const finalX = xBase + (cellW - finalW) / 2;
                    const finalY = yBase + (cellH - finalH) / 2;

                    try {
                       doc.addImage(imgObj.data, 'JPEG', finalX, finalY, finalW, finalH);
                    } catch(e) {
                        doc.setFontSize(8);
                        doc.text("(Erreur image)", xBase + 10, yBase + 20);
                    }
                }
            };

            renderContent(pair.left, MARGIN, yPos, COL_WIDTH, PAIR_HEIGHT);
            renderContent(pair.right, MARGIN + COL_WIDTH, yPos, COL_WIDTH, PAIR_HEIGHT);

            // Pointillés séparation
            doc.setDrawColor(150);
            doc.setLineDash([3, 3], 0);
            doc.line(MARGIN, yPos + PAIR_HEIGHT, MARGIN + (COL_WIDTH * 2), yPos + PAIR_HEIGHT);
            doc.setLineDash([]); 

            yPos += PAIR_HEIGHT;
            pairsOnPage++;
        }

        doc.save(`${titreFichier}.pdf`);
        logger.log('✅ Export PDF Image Pairing (Ratio Fix) terminé.');

    } catch (e) {
        console.error(e);
        alert("Erreur PDF : " + e.message);
    }
}