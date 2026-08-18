// Fichier: modules/utils/exports-pdf/pdf-cards.js

import { logger } from '../logger.js';

// Utilisation de la version UMD pour compatibilité navigateur sans Babel
import "../../../../vendor/jspdf/jspdf.umd.min.js";

// Helper : Convertir Image URL -> Base64
const getBase64ImageFromUrl = async (imageUrl) => {
    try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Erreur conversion image PDF", error);
        return null;
    }
};

// 🟢 AJOUT DU PARAMÈTRE returnBlobOnly
export async function exportPDF_Cards(returnBlobOnly = false) {
    try {
        const { jsPDF } = window.jspdf;
        const titreFichier = document.getElementById('cards-title').value || 'Cartes';
        
        // 1. Initialisation A4 Portrait (mm)
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

        // --- GÉOMÉTRIE (3 cartes par page) ---
        const MARGIN_LEFT = 15;
        const MARGIN_TOP_FIRST_PAGE = 30; 
        const MARGIN_TOP_OTHER_PAGES = 20;
        
        const CARD_WIDTH = 90;  
        const CARD_HEIGHT = 80; 
        
        // 2. Récupération des données
        const cardElements = document.querySelectorAll('#cards-list .card');
        const cardsToPrint = [];

        for (const el of cardElements) {
            const front = el.querySelector('.card-front').value.trim();
            const back = el.querySelector('.card-back').value.trim();
            const tip = el.querySelector('.card-tip-front').value.trim();
            
            let imgData = null;
            const uploadImg = el.querySelector('.img-preview-container img');
            const wikiImg = el.querySelector('.wiki-img-preview');
            const iaImg = el.querySelector('.ia-generated-img');
            
            let visibleImg = null;
            if (uploadImg && document.body.contains(uploadImg)) visibleImg = uploadImg;
            else if (wikiImg && wikiImg.src && wikiImg.parentElement.style.display !== 'none') visibleImg = wikiImg;
            else if (iaImg && iaImg.src && !iaImg.src.includes('hapi-ph') && iaImg.style.display !== 'none') visibleImg = iaImg;

            if (visibleImg && visibleImg.src) {
                imgData = await getBase64ImageFromUrl(visibleImg.src);
            }

            if (front || back) {
                cardsToPrint.push({ front, back, tip, imgData });
            }
        }

        if (cardsToPrint.length === 0) {
            // 🟢 ALERTE RENDUE SILENCIEUSE
            if (!returnBlobOnly) alert("Aucune carte à exporter.");
            return null;
        }

        // 3. GÉNÉRATION
        let yPos = MARGIN_TOP_FIRST_PAGE;
        let cardsOnPage = 0;

        // Titre Document
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text(titreFichier, 105, 15, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.text("Imprimez, découpez les lignes, pliez au centre.", 105, 22, { align: 'center' });

        for (let i = 0; i < cardsToPrint.length; i++) {
            const card = cardsToPrint[i];

            if (cardsOnPage === 3) {
                doc.addPage();
                yPos = MARGIN_TOP_OTHER_PAGES;
                cardsOnPage = 0;
            }

            // Cadres
            doc.setDrawColor(150);
            doc.setLineWidth(0.1);
            doc.rect(MARGIN_LEFT, yPos, CARD_WIDTH, CARD_HEIGHT);
            doc.rect(MARGIN_LEFT + CARD_WIDTH, yPos, CARD_WIDTH, CARD_HEIGHT);

            // --- RECTO (Gauche) ---
            let textY_Front = yPos + (CARD_HEIGHT / 2); 
            
            if (card.imgData) {
                const imgW = 50; 
                const imgH = 40; 
                const imgX = MARGIN_LEFT + (CARD_WIDTH - imgW) / 2;
                const imgY = yPos + 8;
                doc.addImage(card.imgData, 'JPEG', imgX, imgY, imgW, imgH);
                textY_Front = yPos + 58; 
            }

            // Texte Principal Recto
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(0); // Noir
            
            const splitFront = doc.splitTextToSize(card.front, CARD_WIDTH - 10);
            const blockH_Front = splitFront.length * 5; 
            const finalY_Front = card.imgData ? textY_Front : (yPos + (CARD_HEIGHT/2) - (blockH_Front/2) + 2);
            
            doc.text(splitFront, MARGIN_LEFT + (CARD_WIDTH/2), finalY_Front, { align: 'center' });

            if (card.tip) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(9);
                doc.setTextColor(100); // Gris foncé
                const tipText = `Indice : ${card.tip}`;
                const splitTip = doc.splitTextToSize(tipText, CARD_WIDTH - 10);
                const tipY = yPos + CARD_HEIGHT - 6; 
                doc.text(splitTip, MARGIN_LEFT + (CARD_WIDTH/2), tipY, { align: 'center', baseline: 'bottom' });
            }

            // --- VERSO (Droite) ---
            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            doc.setTextColor(0); 
            
            const splitBack = doc.splitTextToSize(card.back, CARD_WIDTH - 10);
            const blockH_Back = splitBack.length * 5;
            const finalY_Back = yPos + (CARD_HEIGHT/2) - (blockH_Back/2) + 2;
            doc.text(splitBack, MARGIN_LEFT + CARD_WIDTH + (CARD_WIDTH/2), finalY_Back, { align: 'center' });

            // --- FINITIONS ---
            doc.setDrawColor(200);
            doc.setLineDash([2, 2], 0);
            doc.line(MARGIN_LEFT + CARD_WIDTH, yPos, MARGIN_LEFT + CARD_WIDTH, yPos + CARD_HEIGHT);
            doc.setLineDash([]); 

            doc.setFontSize(7);
            doc.setTextColor(150);
            doc.setFont("helvetica", "normal"); 
            doc.text("RECTO", MARGIN_LEFT + 2, yPos + 3);
            doc.text("VERSO", MARGIN_LEFT + CARD_WIDTH + 2, yPos + 3);

            yPos += CARD_HEIGHT;
            cardsOnPage++;
        }

        const fileName = `${titreFichier}.pdf`;

        // 🟢 NOUVELLE LOGIQUE D'INSERTION DU BLOB
        if (returnBlobOnly) {
            return { blob: doc.output('blob'), fileName };
        }

        doc.save(fileName);
        logger.log('✅ Export PDF Cards terminé.');

    } catch (e) {
        console.error(e);
        // 🟢 ALERTE RENDUE SILENCIEUSE
        if (!returnBlobOnly) alert("Erreur PDF : " + e.message);
        return null;
    }
}