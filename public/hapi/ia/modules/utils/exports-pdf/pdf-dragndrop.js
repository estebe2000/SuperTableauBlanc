// Fichier: modules/utils/exports-pdf/pdf-dragndrop.js

import { logger } from '../logger.js';
import "../../../../vendor/jspdf/jspdf.umd.min.js";
import { gatherData } from '../../ui/dragndrop-ui.js';

// Helper ultra-robuste pour convertir l'image (Fichier, URL, ou Base64 directe)
const getImageData = async (source, type) => {
    if (!source) return null;
    try {
        let base64String = null;
        
        if (type === 'file') {
            base64String = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(source);
            });
        } 
        else if (type === 'url') {
            if (source.startsWith('data:image')) {
                base64String = source;
            } else {
                const res = await fetch(source);
                const blob = await res.blob();
                base64String = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            }
        }

        if (!base64String) return null;

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ data: base64String, w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => resolve(null);
            img.src = base64String;
        });
    } catch (error) {
        logger.error("Erreur récup image PDF", error);
        return null;
    }
};

// Helper pour filtrer les emojis (jsPDF ne supporte pas les surrogates)
const stripEmojis = (str) => {
    if (!str) return '';
    return str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').trim();
};

const hexToRgb = (hex) => {
    let h = hex ? hex.replace('#', '') : 'e2e8f0';
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
};

export async function exportPDF_Dragndrop(returnBlobOnly = false) {
    try {
        logger.log("🚀 Lancement de l'export PDF (Drag & Drop)...");
        
        const donnees = gatherData();
        if (!donnees) {
            if (!returnBlobOnly) alert("Impossible de générer le PDF : données invalides ou incomplètes.");
            return null;
        }

        const { jsPDF } = window.jspdf;
        const titreFichier = donnees.titre || 'Exercice de Catégorisation';
        const consigne = donnees.consigne || 'Placez les éléments au bon endroit.';
        
        // Format PAYSAGE : élargit les colonnes du mode Tableau pour accueillir
        // les étiquettes que les élèves découpent et déposent dans les colonnes.
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        const PAGE_W = 297; // A4 paysage : largeur
        const PAGE_H = 210; // A4 paysage : hauteur
        const MARGIN = 15;
        let yPos = MARGIN;

        // --- EN-TÊTE ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(88, 17, 26); 
        
        const splitTitle = doc.splitTextToSize(stripEmojis(titreFichier), PAGE_W - (MARGIN * 2));
        doc.text(splitTitle, PAGE_W / 2, yPos, { align: 'center' });
        yPos += (splitTitle.length * 8) + 4;
        
        doc.setFontSize(12);
        doc.setTextColor(50);
        doc.setFont("helvetica", "italic");
        const splitConsigne = doc.splitTextToSize(stripEmojis(consigne), PAGE_W - (MARGIN * 2));
        doc.text(splitConsigne, PAGE_W / 2, yPos, { align: 'center' });
        yPos += (splitConsigne.length * 6) + 10;

        // --- PRÉPARATION DES ÉLÉMENTS (Textes & Images) ---
        let allElements = [];
        for (const e of donnees.elements) {
            if (e.type === 'text') {
                // MODIFICATION : On conserve la propriété 'targets' pour la correction
                allElements.push({ type: 'text', content: stripEmojis(e.text) || "Texte", targets: e.targets });
            } else if (e.type === 'image' && e.src) {
                const imgData = await getImageData(e.src, 'url');
                // MODIFICATION : On conserve la propriété 'targets' pour la correction
                allElements.push({ type: 'image', content: imgData, targets: e.targets });
            }
        }

        // On fait une copie non mélangée pour le rendu de la correction
        const elementsForCorrection = [...allElements];

        // Mélange pour les étiquettes à découper de l'élève
        if (donnees.randomItems !== false) {
            allElements = allElements.sort(() => Math.random() - 0.5);
        }

        // Métriques des colonnes — partagées entre le mode Tableau et le calcul de la
        // largeur MAX des étiquettes (afin qu'une étiquette tienne dans une colonne).
        const nbZones = Math.max(1, donnees.zones.length);
        const colGap = 4;
        const tableW = PAGE_W - (MARGIN * 2);
        const colW = (tableW - (colGap * (nbZones - 1))) / nbZones;

        // ==========================================
        // PAGE 1 : GABARIT DE L'ÉLÈVE
        // ==========================================

        // --- MODE IMAGE DE FOND ---
        if (donnees.layoutMode === 'image' && donnees.bgImageFile) {
            const imgObj = await getImageData(donnees.bgImageFile, 'file');
            
            if (imgObj && imgObj.data) {
                const maxImgW = PAGE_W - (MARGIN * 2);
                const maxImgH = 150; 

                const scale = Math.min(maxImgW / imgObj.w, maxImgH / imgObj.h);
                const finalW = imgObj.w * scale;
                const finalH = imgObj.h * scale;
                const finalX = MARGIN + (maxImgW - finalW) / 2;

                doc.addImage(imgObj.data, 'JPEG', finalX, yPos, finalW, finalH);

                doc.setDrawColor(59, 130, 246);
                doc.setLineWidth(0.5);
                doc.setLineDash([2, 2], 0);

                donnees.zones.forEach(z => {
                    const zX = finalX + (z.x / 100) * finalW;
                    const zY = yPos + (z.y / 100) * finalH;
                    const zW = (z.w / 100) * finalW;
                    const zH = (z.h / 100) * finalH;
                    doc.setFillColor(255, 255, 255);
                    doc.rect(zX, zY, zW, zH, 'FD');
                });
                
                doc.setLineDash([]);
                yPos += finalH + 20;
            } else {
                doc.setFont("helvetica", "normal");
                doc.text("(Image non disponible)", PAGE_W / 2, yPos, { align: 'center' });
                yPos += 20;
            }
        } 
        // --- MODE TABLEAU ---
        else {
            const nbZones = donnees.zones.length;
            const tableW = PAGE_W - (MARGIN * 2);
            const gap = 4;
            const colW = (tableW - (gap * (nbZones - 1))) / nbZones;
            const rowH = 100;

            // En-têtes : titres sur plusieurs lignes si besoin (plus de troncature).
            // Hauteur d'en-tête UNIFORME, basée sur le titre le plus long.
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            const titleLineH = 4.5;     // hauteur d'une ligne de titre (mm)
            const titlePadX = 3;
            let maxTitleLines = 1;
            const titlesLines = donnees.zones.map(z => {
                const lines = doc.splitTextToSize(stripEmojis(z.nom) || "Catégorie", colW - titlePadX * 2);
                maxTitleLines = Math.max(maxTitleLines, lines.length);
                return lines;
            });
            const headerH = Math.max(12, maxTitleLines * titleLineH + 5);

            donnees.zones.forEach((z, idx) => {
                const x = MARGIN + idx * (colW + gap);

                const rgb = hexToRgb(z.color);
                doc.setFillColor(rgb[0], rgb[1], rgb[2]);
                doc.rect(x, yPos, colW, headerH, 'F');

                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                const yiq = ((rgb[0] * 299) + (rgb[1] * 587) + (rgb[2] * 114)) / 1000;
                doc.setTextColor(yiq >= 128 ? 0 : 255);

                // Titre (1..N lignes) centré verticalement dans l'en-tête
                const lines = titlesLines[idx];
                const totalH = lines.length * titleLineH;
                let ty = yPos + (headerH - totalH) / 2 + titleLineH * 0.75;
                lines.forEach(line => {
                    doc.text(line, x + (colW / 2), ty, { align: 'center' });
                    ty += titleLineH;
                });

                doc.setDrawColor(200);
                doc.setLineWidth(0.3);
                doc.setFillColor(250, 250, 250);
                doc.rect(x, yPos + headerH, colW, rowH, 'FD');
            });

            yPos += headerH + rowH + 20;
        }

        // --- IMPRESSION DES ÉTIQUETTES (MIXTES) À DÉCOUPER ---
        if (yPos > PAGE_H - 40) {
            doc.addPage();
            yPos = MARGIN;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text("Étiquettes à découper :", MARGIN, yPos);
        yPos += 10;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setLineWidth(0.4);
        doc.setDrawColor(148, 163, 184); 
        doc.setLineDash([2, 2], 0); 

        const paddingX = 6;
        const gapX = 5;
        const gapY = 5;
        const lineH = 5;                      // hauteur d'une ligne de texte (mm)
        const maxRight = PAGE_W - MARGIN;
        const maxLabelW = colW;               // une étiquette ne dépasse JAMAIS une colonne

        // Pré-calcul : on découpe le texte de chaque étiquette pour qu'il tienne dans
        // la largeur d'une colonne (retour à la ligne auto), et on mémorise sa largeur.
        let maxLines = 1;
        const prepared = allElements.map(el => {
            if (el.type === 'text') {
                const lines = doc.splitTextToSize(el.content, maxLabelW - paddingX * 2);
                maxLines = Math.max(maxLines, lines.length);
                // 1 ligne → largeur juste ce qu'il faut (plafonnée) ; plusieurs lignes → pleine colonne
                const width = lines.length === 1
                    ? Math.min(doc.getTextWidth(lines[0]) + paddingX * 2, maxLabelW)
                    : maxLabelW;
                return { el, lines, width };
            }
            return { el, lines: null, width: Math.min(30, maxLabelW) }; // image bornée à la colonne
        });

        // Hauteur uniforme des étiquettes (basée sur l'étiquette la plus haute) → grille régulière
        const labelHeight = Math.max(20, maxLines * lineH + 10);

        let currentX = MARGIN;
        let currentY = yPos;

        prepared.forEach(item => {
            const labelWidth = item.width;

            if (currentX + labelWidth > maxRight) {
                currentX = MARGIN;
                currentY += labelHeight + gapY;

                if (currentY + labelHeight > PAGE_H - MARGIN) {
                    doc.addPage();
                    currentY = MARGIN;
                    doc.setDrawColor(148, 163, 184);
                    doc.setLineWidth(0.4);
                    doc.setLineDash([2, 2], 0);
                }
            }

            doc.setFillColor(248, 250, 252);
            doc.rect(currentX, currentY, labelWidth, labelHeight, 'FD');

            if (item.el.type === 'text') {
                doc.setTextColor(30, 41, 59);
                // Bloc de texte (1 à N lignes) centré verticalement dans l'étiquette
                const totalTextH = item.lines.length * lineH;
                let ty = currentY + (labelHeight - totalTextH) / 2 + lineH * 0.75;
                item.lines.forEach(line => {
                    doc.text(line, currentX + labelWidth / 2, ty, { align: 'center' });
                    ty += lineH;
                });
            }
            else if (item.el.type === 'image' && item.el.content && item.el.content.data) {
                const padding = 2;
                const maxW = labelWidth - (padding * 2);
                const maxH = labelHeight - (padding * 2);

                const scale = Math.min(maxW / item.el.content.w, maxH / item.el.content.h);
                const finalW = item.el.content.w * scale;
                const finalH = item.el.content.h * scale;

                const finalX = currentX + (labelWidth - finalW) / 2;
                const finalY = currentY + (labelHeight - finalH) / 2;

                try {
                    doc.addImage(item.el.content.data, 'JPEG', finalX, finalY, finalW, finalH);
                } catch(e) {
                    doc.setFontSize(8);
                    doc.text("Erreur img", currentX + (labelWidth/2), currentY + (labelHeight/2), { align: 'center' });
                    doc.setFontSize(11);
                }
            }

            currentX += labelWidth + gapX;
        });

        doc.setLineDash([]); // Reset

        // ==========================================
        // PAGE DE CORRECTION (GABARIT REMPLI)
        // ==========================================
        
        doc.addPage();
        yPos = MARGIN;

        // Titre Correction
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(22, 163, 74); // Vert correction
        
        const splitTitleCorr = doc.splitTextToSize("Correction : " + stripEmojis(titreFichier), PAGE_W - (MARGIN * 2));
        doc.text(splitTitleCorr, PAGE_W / 2, yPos, { align: 'center' });
        yPos += (splitTitleCorr.length * 8) + 10;

        // --- CORRECTION MODE IMAGE ---
        if (donnees.layoutMode === 'image' && donnees.bgImageFile) {
            const imgObj = await getImageData(donnees.bgImageFile, 'file');
            
            if (imgObj && imgObj.data) {
                const maxImgW = PAGE_W - (MARGIN * 2);
                const maxImgH = 150; 

                const scale = Math.min(maxImgW / imgObj.w, maxImgH / imgObj.h);
                const finalW = imgObj.w * scale;
                const finalH = imgObj.h * scale;
                const finalX = MARGIN + (maxImgW - finalW) / 2;

                // Dessin de l'image de fond
                doc.addImage(imgObj.data, 'JPEG', finalX, yPos, finalW, finalH);

                donnees.zones.forEach((z, idx) => {
                    const zX = finalX + (z.x / 100) * finalW;
                    const zY = yPos + (z.y / 100) * finalH;
                    const zW = (z.w / 100) * finalW;
                    const zH = (z.h / 100) * finalH;
                    
                    // Fond semi-transparent simulé (Vert clair)
                    doc.setDrawColor(34, 197, 94);
                    doc.setLineWidth(0.6);
                    doc.setFillColor(240, 253, 244); 
                    doc.rect(zX, zY, zW, zH, 'FD');

                    // Récupération des étiquettes associées à cette zone
                    const els = elementsForCorrection.filter(e => e.targets && e.targets.includes(idx));
                    
                    let currentEY = zY + 2; 
                    
                    els.forEach(el => {
                        if (el.type === 'text') {
                            doc.setFont("helvetica", "bold");
                            doc.setFontSize(8);
                            doc.setTextColor(21, 128, 61); // Vert foncé texte
                            
                            const splitText = doc.splitTextToSize(el.content, zW - 4);
                            const hBox = (splitText.length * 3.5) + 3;
                            
                            // Petite étiquette blanche pour rendre le texte lisible par dessus l'image
                            doc.setFillColor(255, 255, 255);
                            doc.rect(zX + 1, currentEY, zW - 2, hBox, 'F');
                            doc.text(splitText, zX + zW/2, currentEY + (hBox / 2), { align: 'center', baseline: 'middle' });
                            
                            currentEY += hBox + 2;
                        } else if (el.type === 'image' && el.content && el.content.data) {
                            const padding = 2;
                            const maxEW = zW - (padding * 2);
                            const maxEH = Math.max(10, (zH / els.length) - (padding * 2)); 
                            
                            const sc = Math.min(maxEW / el.content.w, maxEH / el.content.h);
                            const ew = el.content.w * sc;
                            const eh = el.content.h * sc;
                            const ex = zX + (zW - ew) / 2;
                            
                            doc.addImage(el.content.data, 'JPEG', ex, currentEY, ew, eh);
                            currentEY += eh + padding;
                        }
                    });
                });
            }
        } 
        // --- CORRECTION MODE TABLEAU ---
        else {
            const nbZones = donnees.zones.length;
            const tableW = PAGE_W - (MARGIN * 2);
            const gap = 4;
            const colW = (tableW - (gap * (nbZones - 1))) / nbZones;
            const rowH = 100;

            // En-têtes multi-lignes (cohérent avec la page élève), hauteur uniforme.
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            const titleLineH = 4.5;
            const titlePadX = 3;
            let maxTitleLines = 1;
            const titlesLines = donnees.zones.map(z => {
                const lines = doc.splitTextToSize(stripEmojis(z.nom) || "Catégorie", colW - titlePadX * 2);
                maxTitleLines = Math.max(maxTitleLines, lines.length);
                return lines;
            });
            const headerH = Math.max(12, maxTitleLines * titleLineH + 5);

            donnees.zones.forEach((z, idx) => {
                const x = MARGIN + idx * (colW + gap);

                // En-tête (Garde la même couleur)
                const rgb = hexToRgb(z.color);
                doc.setFillColor(rgb[0], rgb[1], rgb[2]);
                doc.rect(x, yPos, colW, headerH, 'F');

                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                const yiq = ((rgb[0] * 299) + (rgb[1] * 587) + (rgb[2] * 114)) / 1000;
                doc.setTextColor(yiq >= 128 ? 0 : 255);

                const lines = titlesLines[idx];
                const totalH = lines.length * titleLineH;
                let ty = yPos + (headerH - totalH) / 2 + titleLineH * 0.75;
                lines.forEach(line => {
                    doc.text(line, x + (colW / 2), ty, { align: 'center' });
                    ty += titleLineH;
                });

                // Box de dépôt avec liseré vert
                doc.setDrawColor(34, 197, 94);
                doc.setLineWidth(0.5);
                doc.setFillColor(240, 253, 244);
                doc.rect(x, yPos + headerH, colW, rowH, 'FD');

                // Éléments associés
                const els = elementsForCorrection.filter(e => e.targets && e.targets.includes(idx));
                let currentEY = yPos + headerH + 4;

                els.forEach(el => {
                    if (el.type === 'text') {
                        doc.setFillColor(255, 255, 255);
                        doc.setDrawColor(22, 163, 74);
                        doc.setLineWidth(0.3);
                        
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(9);
                        const splitText = doc.splitTextToSize(el.content, colW - 8);
                        const hBox = (splitText.length * 4.5) + 4;
                        
                        // Dessin de l'étiquette
                        doc.rect(x + 4, currentEY, colW - 8, hBox, 'FD');
                        
                        doc.setTextColor(21, 128, 61);
                        doc.text(splitText, x + (colW / 2), currentEY + (hBox / 2), { align: 'center', baseline: 'middle' });
                        
                        currentEY += hBox + 4;
                    } else if (el.type === 'image' && el.content && el.content.data) {
                        const maxEW = colW - 8;
                        const maxEH = 30; // Max arbitraire
                        
                        const sc = Math.min(maxEW / el.content.w, maxEH / el.content.h);
                        const ew = el.content.w * sc;
                        const eh = el.content.h * sc;
                        const ex = x + (colW - ew) / 2;
                        
                        doc.setDrawColor(22, 163, 74);
                        doc.setLineWidth(0.3);
                        doc.rect(ex - 1, currentEY - 1, ew + 2, eh + 2, 'S');
                        doc.addImage(el.content.data, 'JPEG', ex, currentEY, ew, eh);
                        
                        currentEY += eh + 6;
                    }
                });
            });
        }

        // ==========================================
        // FINALISATION
        // ==========================================
        
        const titreNettoye = stripEmojis(titreFichier)
            .normalize("NFD")               
            .replace(/[\u0300-\u036f]/g, "") 
            .replace(/[^a-z0-9]/gi, '_');   

        const safeName = `Etiquettes_${titreNettoye}.pdf`;

        if (returnBlobOnly) {
            return { blob: doc.output('blob'), fileName: safeName };
        }

        doc.save(safeName);
        logger.log('✅ Export PDF terminé avec un nom de fichier propre.');

    } catch (e) {
        logger.error(`Erreur PDF Dragndrop : ${e.message}`);
        if (!returnBlobOnly) alert("Une erreur est survenue lors de la génération du PDF.");
        return null;
    }
}