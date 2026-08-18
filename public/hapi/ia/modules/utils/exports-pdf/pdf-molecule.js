// Fichier: modules/utils/exports-pdf/pdf-molecule.js

import { logger } from '../../utils/logger.js';
import "../../../../vendor/jspdf/jspdf.umd.min.js";

// Imports Three.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// --- 1. FONCTIONS DE TRAITEMENT D'IMAGE ---

// ✂️ Fonction de Rognage (Auto-Crop) : Enlève les marges blanches
function cropImageWhitespace(sourceCanvas) {
    const ctx = sourceCanvas.getContext('2d');
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    let minX = w, minY = h, maxX = 0, maxY = 0;
    let found = false;

    // Analyse pixel par pixel
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            // On cherche tout pixel qui n'est pas "presque blanc"
            if (data[i] < 240 || data[i+1] < 240 || data[i+2] < 240) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                found = true;
            }
        }
    }

    if (!found) return sourceCanvas;

    const padding = 30;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(w, maxX + padding);
    maxY = Math.min(h, maxY + padding);

    const cropW = maxX - minX;
    const cropH = maxY - minY;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext('2d');
    
    cropCtx.fillStyle = '#FFFFFF';
    cropCtx.fillRect(0, 0, cropW, cropH);
    cropCtx.drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    
    return cropCanvas;
}

// 📥 Chargeur d'image Robuste
async function fetchAndProcess2DImage(name) {
    if (!name) return null;
    // URL PubChem Haute Résolution
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/PNG?record_type=2d&image_size=2000x2000`;

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                
                const cropped = cropImageWhitespace(canvas);
                resolve(cropped.toDataURL('image/jpeg', 1.0));
            } catch (e) {
                console.warn("Erreur process image 2D", e);
                resolve(null);
            }
        };
        
        img.onerror = () => {
            console.warn(`❌ Impossible de charger l'image 2D pour : ${name}`);
            resolve(null);
        };
        
        img.src = url;
    });
}

// 🟡 Pastille 3D
function createNumberedSprite(number) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 4, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#333333";
    ctx.stroke();

    ctx.font = "bold 80px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#000000";
    ctx.fillText(number, size/2, size/2 + 4); 
    
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
    sprite.scale.set(0.35, 0.35, 1);
    return sprite;
}

// 📸 Capture 3D "Gros Plan"
async function capture3DSnapshot(url, hotspots = []) {
    return new Promise((resolve, reject) => {
        const width = 2000; 
        const height = 1500; // Format un peu plus carré pour la page 2
        
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.setSize(width, height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        scene.environment = pmremGenerator.fromScene(new RoomEnvironment()).texture;
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
        dirLight.position.set(5, 10, 7.5);
        scene.add(dirLight);

        const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 10000);

        const loader = new GLTFLoader();
        loader.load(url, (gltf) => {
            const model = gltf.scene;
            
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);

            model.position.x += (model.position.x - center.x);
            model.position.y += (model.position.y - center.y);
            model.position.z += (model.position.z - center.z);
            scene.add(model);

            if (hotspots && hotspots.length > 0) {
                hotspots.forEach((hotspot, index) => {
                    const pos = new THREE.Vector3(hotspot.vector.x, hotspot.vector.y, hotspot.vector.z);
                    const anchor = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0x000000 }));
                    anchor.position.copy(pos);
                    scene.add(anchor);

                    const sprite = createNumberedSprite(index + 1);
                    sprite.position.copy(pos);
                    sprite.position.y += 0.35; 
                    scene.add(sprite);
                });
            }

            const maxDim = Math.max(size.x, size.y, size.z);
            const fovRad = camera.fov * (Math.PI / 180);
            let cameraDist = Math.abs(maxDim / 2 / Math.tan(fovRad / 2));
            cameraDist *= 0.85; 

            camera.position.set(cameraDist * 0.7, cameraDist * 0.5, cameraDist * 1.0);
            camera.lookAt(new THREE.Vector3(0, 0, 0));
            camera.updateProjectionMatrix();

            setTimeout(() => {
                try {
                    renderer.render(scene, camera);
                    renderer.render(scene, camera);
                    const dataURL = renderer.domElement.toDataURL('image/jpeg', 0.98);
                    renderer.dispose();
                    pmremGenerator.dispose();
                    resolve(dataURL);
                } catch (e) { reject(e); }
            }, 250);

        }, undefined, (err) => reject(err));
    });
}

// Rendu Formule Chimique (Indices)
function drawChemicalFormula(doc, rawFormula, centerX, y) {
    if (!rawFormula) return;
    const clean = rawFormula.replace(/_\{(\d+)\}/g, '$1').replace(/[\{\}_^]/g, '');
    const parts = clean.split(/(\d+)/).filter(p => p !== "");

    doc.setFont("helvetica", "bold");
    const sMain = 24; const sSub = 16; // Police plus grande pour Page 1
    let w = 0;
    parts.forEach(p => { w += doc.setFontSize(p.match(/^\d+$/)?sSub:sMain).getTextWidth(p); });

    let cx = centerX - (w / 2);
    parts.forEach(p => {
        if (p.match(/^\d+$/)) {
            doc.setFontSize(sSub).setTextColor(80,80,80).text(p, cx, y+3);
        } else {
            doc.setFontSize(sMain).setTextColor(50,50,50).text(p, cx, y);
        }
        cx += doc.getTextWidth(p);
    });
}

// --- FONCTION PRINCIPALE EXPORT PDF (MULTI-PAGES) ---

// 🟢 AJOUT DU PARAMÈTRE returnBlobOnly
export async function exportPDF_MoleculeSingle(moleculeData, returnBlobOnly = false) {
    try {
        const { jsPDF } = window.jspdf;
        const { title, formula, url, hotspots, originalName } = moleculeData;

        // --- 1. GÉNÉRATION DES VISUELS ---
        logger.log("📸 Génération du rendu 3D...");
        const img3DData = await capture3DSnapshot(url, hotspots);
        
        logger.log("🖼️ Récupération image 2D...");
        let img2DData = null;
        let img2DProps = { ratio: 1 };

        // Essai avec le nom original ou le titre
        let searchName = originalName || title;
        if(searchName) img2DData = await fetchAndProcess2DImage(searchName);
        
        if (!img2DData && title && title !== originalName) {
            img2DData = await fetchAndProcess2DImage(title);
        }

        if (img2DData) {
            await new Promise(r => { 
                const i = new Image(); 
                i.onload = () => { img2DProps.ratio = i.width / i.height; r(); }; 
                i.src = img2DData; 
            });
        }

        // --- 2. CRÉATION DU PDF ---
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const PAGE_W = 210;
        const PAGE_H = 297;
        const MARGIN = 15;
        const BOX_WIDTH = PAGE_W - (MARGIN * 2);
        
        // ==========================================
        // PAGE 1 : BANDEAU & FORMULES 2D
        // ==========================================
        
        // Bandeau Titre
        doc.setFillColor(52, 73, 94); // Bleu nuit élégant
        doc.rect(0, 0, PAGE_W, 35, 'F');
        doc.setFont("helvetica", "bold").setFontSize(26).setTextColor(255, 255, 255);
        doc.text((title || "Molécule").toUpperCase(), PAGE_W/2, 23, { align: 'center' });

        // Sous-titre formule brute
        if (formula) {
            doc.setFillColor(240, 240, 240);
            doc.roundedRect(PAGE_W/2 - 40, 45, 80, 20, 3, 3, 'F');
            doc.setFontSize(10).setTextColor(100).text("FORMULE BRUTE", PAGE_W/2, 51, { align: 'center' });
            drawChemicalFormula(doc, formula, PAGE_W/2, 60);
        }

        // Section Formule Développée / 2D
        const y2D = 80;
        const h2D = 180; // Grande zone pour l'image
        
        doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(52, 73, 94);
        doc.text("STRUCTURE 2D", MARGIN, y2D);
        doc.setDrawColor(200).line(MARGIN, y2D + 2, PAGE_W - MARGIN, y2D + 2);

        // Zone Image 2D
        doc.setFillColor(255, 255, 255);
        // On pourrait mettre 2 cases ici si on avait 2 images. 
        // Comme on en a qu'une, on la centre joliment.
        
        if (img2DData) {
            const availW = BOX_WIDTH * 0.9; // 90% de la largeur
            const availH = h2D - 20;
            
            let finalW = availW;
            let finalH = finalW / img2DProps.ratio;

            if (finalH > availH) {
                finalH = availH;
                finalW = finalH * img2DProps.ratio;
            }

            const xImg = (PAGE_W - finalW) / 2;
            const yImg = y2D + 15 + (availH - finalH) / 2;
            
            doc.addImage(img2DData, 'JPEG', xImg, yImg, finalW, finalH);
            
            // Petit texte explicatif discret
            doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(150);
            doc.text("Représentation plane issue de PubChem", PAGE_W/2, yImg + finalH + 5, { align: 'center' });
        } else {
            doc.setFont("helvetica", "italic").setFontSize(12).setTextColor(150);
            doc.text("Image 2D non disponible pour cette molécule.", PAGE_W/2, y2D + 60, { align: 'center' });
        }
        
        // Pied de page P1
        doc.setFontSize(9).setTextColor(180);
        doc.text("Page 1/2", PAGE_W - MARGIN, 290, { align: 'right' });

        // ==========================================
        // PAGE 2 : MODÈLE 3D & LÉGENDE
        // ==========================================
        doc.addPage();

        // Rappel Titre (plus discret)
        doc.setFillColor(245, 245, 245);
        doc.rect(0, 0, PAGE_W, 20, 'F');
        doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(100);
        doc.text(`${(title || "Molécule").toUpperCase()} - MODÈLE 3D`, MARGIN, 13);

        // Image 3D (Massive)
        const y3D = 30;
        const h3D = 180; // Hauteur réservée à la 3D
        
        if (img3DData) {
            // Calcul pour remplir la largeur tout en gardant le ratio
            const imgW = BOX_WIDTH;
            const imgH = imgW * (1500/2000); // Ratio de la capture défini dans capture3DSnapshot
            
            const x3D = MARGIN;
            const yPos3D = y3D + (h3D - imgH) / 2; // Centrage vertical dans la zone haute

            doc.addImage(img3DData, 'JPEG', x3D, yPos3D, imgW, imgH);
			
            // --- AJOUT : LÉGENDE SOUS L'IMAGE 3D ---
            doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(150);
            // On place le texte 5mm sous l'image (yPos3D + imgH + 5)
            doc.text("Modélisation 3D issue de Pubchem", PAGE_W/2, yPos3D + imgH + 5, { align: 'center' });
					
        }

        // Zone Légende (Bas de page)
        const yLegendTitle = 220;
        doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(52, 73, 94);
        doc.text("LÉGENDE ET ANNOTATIONS", MARGIN, yLegendTitle);
        doc.setDrawColor(200).line(MARGIN, yLegendTitle + 2, PAGE_W - MARGIN, yLegendTitle + 2);

        if (hotspots && hotspots.length > 0) {
            let yItem = yLegendTitle + 15;
            const colWidth = BOX_WIDTH / 2; // 2 colonnes si beaucoup de points
            
            doc.setFontSize(11).setFont("helvetica", "normal").setTextColor(50);

            hotspots.forEach((hotspot, index) => {
                const num = index + 1;
                const text = hotspot.text || "Élément sans nom";
                
                // Gestion colonnes simple
                let xItem = MARGIN;
                if (index > 5) { // Si plus de 5 items, on passe à droite (ajustement basique)
                    xItem = MARGIN + colWidth;
                    if (index === 6) yItem = yLegendTitle + 15; // Reset Y pour colonne 2
                }

                // Pastille noire
                doc.setFillColor(0);
                doc.circle(xItem + 3, yItem - 1, 3.5, 'F');
                doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(9);
                doc.text(String(num), xItem + 3, yItem - 1, { align: 'center', baseline: 'middle' });
                
                // Texte
                doc.setTextColor(50).setFont("helvetica", "normal").setFontSize(11);
                doc.text(text, xItem + 12, yItem);
                
                yItem += 10;
            });
        } else {
            doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(150);
            doc.text("Aucune annotation ajoutée sur ce modèle.", MARGIN, yLegendTitle + 15);
        }

        // Pied de page P2
        doc.setFontSize(9).setTextColor(180);
        doc.text("Page 2/2", PAGE_W - MARGIN, 290, { align: 'right' });
        doc.text("Généré par HAPI", MARGIN, 290);

        // Sauvegarde
        const fileName = `Molecule_${(title || '3D').replace(/\s+/g, '_')}.pdf`;

        // 🟢 NOUVELLE LOGIQUE D'INSERTION DU BLOB
        if (returnBlobOnly) {
            return { blob: doc.output('blob'), fileName };
        }

        doc.save(fileName);
        logger.log(`✅ PDF Molécule généré (2 Pages) : ${title}`);

    } catch (e) {
        console.error(e);
        // 🟢 ALERTE RENDUE SILENCIEUSE
        if (!returnBlobOnly) alert("Erreur PDF : " + e.message);
        return null;
    }
}