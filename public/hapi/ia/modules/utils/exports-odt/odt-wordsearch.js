// Fichier: modules/utils/exports-odt/odt-wordsearch.js

import { logger } from '../logger.js';
import { 
    createBaseODT, 
    generateStylesXML, 
    generateManifestXML, // ✅ Indispensable
    wrapContentXML, 
    echapperXML, 
    telechargerBlob, 
    sanitizeFileName 
} from './odt-utils.js';

// --- GÉNÉRATEUR ALÉATOIRE ---
class WordSearchGenerator {
    constructor(words, size = 15) {
        this.size = size;
        this.words = words.map(w => w.toUpperCase().replace(/[^A-ZÀ-Ÿ]/g, ''));
        this.grid = Array(size).fill(null).map(() => Array(size).fill(''));
        this.solution = Array(size).fill(null).map(() => Array(size).fill(false));
        this.directions = [
            { x: 1, y: 0 },  // Horizontal
            { x: 0, y: 1 },  // Vertical
            { x: 1, y: 1 },  // Diagonal Bas-Droite
            { x: 1, y: -1 }  // Diagonal Haut-Droite
        ];
    }

    generate() {
        // Tri pour optimiser le placement (les longs d'abord), mais positionnement aléatoire
        this.words.sort((a, b) => b.length - a.length);

        for (let word of this.words) {
            let placed = false;
            let attempts = 0;
            // On essaie 200 fois de placer le mot au hasard
            while (!placed && attempts < 200) {
                const dir = this.directions[Math.floor(Math.random() * this.directions.length)];
                const startX = Math.floor(Math.random() * this.size);
                const startY = Math.floor(Math.random() * this.size);
                
                if (this.canPlace(word, startX, startY, dir)) {
                    this.place(word, startX, startY, dir);
                    placed = true;
                }
                attempts++;
            }
        }
        this.fillEmpty();
        return { grid: this.grid, solution: this.solution };
    }

    canPlace(word, x, y, dir) {
        for (let i = 0; i < word.length; i++) {
            const nx = x + i * dir.x;
            const ny = y + i * dir.y;
            if (nx < 0 || nx >= this.size || ny < 0 || ny >= this.size) return false;
            if (this.grid[ny][nx] !== '' && this.grid[ny][nx] !== word[i]) return false;
        }
        return true;
    }

    place(word, x, y, dir) {
        for (let i = 0; i < word.length; i++) {
            const nx = x + i * dir.x;
            const ny = y + i * dir.y;
            this.grid[ny][nx] = word[i];
            this.solution[ny][nx] = true;
        }
    }

    fillEmpty() {
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                if (this.grid[y][x] === '') {
                    this.grid[y][x] = letters[Math.floor(Math.random() * letters.length)];
                }
            }
        }
    }
}

// --- FONCTION D'EXPORT PRINCIPALE ---

// 🟢 AJOUT DU PARAMÈTRE returnBlobOnly
export async function exportODT_WordSearch(returnBlobOnly = false) {
    try {
        const titreInput = document.getElementById('wordsearch-title');
        const titreFichier = titreInput ? titreInput.value : 'Mots-Meles';
        
        const rawWords = document.getElementById('wordsearchText').value;
        const wordsList = rawWords.split(',').map(w => w.trim()).filter(w => w.length > 0);
        const consigne = document.getElementById('wordsearchTask') ? document.getElementById('wordsearchTask').value : "Retrouvez les mots cachés dans la grille.";

        if (wordsList.length === 0) throw new Error("Aucun mot trouvé.");

        // 1. Génération de la grille (15x15 standard)
        const gridSize = 15;
        const generator = new WordSearchGenerator(wordsList, gridSize);
        const { grid, solution } = generator.generate();

        // 2. Définition des styles automatiques (dans content.xml)
        const autoStyles = `
            <style:style style:name="GridTable" style:family="table">
                <style:table-properties table:align="center" style:width="15cm"/>
            </style:style>
            <style:style style:name="GridColumn" style:family="table-column">
                <style:table-column-properties style:column-width="1cm"/>
            </style:style>
            <style:style style:name="GridCell" style:family="table-cell">
                <style:table-cell-properties fo:border="0.05pt solid #000000" fo:padding="0.1cm" fo:background-color="transparent"/>
            </style:style>
            <style:style style:name="GridCellCorrect" style:family="table-cell">
                <style:table-cell-properties fo:border="0.05pt solid #000000" fo:padding="0.1cm" fo:background-color="#FFFF00"/>
            </style:style>
            <style:style style:name="CellText" style:family="paragraph">
                <style:text-properties fo:font-family="Courier New" fo:font-weight="bold" fo:font-size="12pt"/>
                <style:paragraph-properties fo:text-align="center"/>
            </style:style>
            <style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:break-before="page"/>
            </style:style>
        `;

        // 3. Helper Tableau XML
        const createTableXML = (isCorrection) => {
            let tbl = `<table:table table:name="Table${isCorrection ? 'Corr' : 'Main'}" table:style-name="GridTable">`;
            tbl += `<table:table-column table:style-name="GridColumn" table:number-columns-repeated="${gridSize}"/>`;
            
            for (let y = 0; y < gridSize; y++) {
                tbl += `<table:table-row>`;
                for (let x = 0; x < gridSize; x++) {
                    const letter = grid[y][x];
                    const style = (isCorrection && solution[y][x]) ? "GridCellCorrect" : "GridCell";
                    
                    tbl += `<table:table-cell table:style-name="${style}" office:value-type="string">`;
                    tbl += `<text:p text:style-name="CellText">${letter}</text:p>`;
                    tbl += `</table:table-cell>`;
                }
                tbl += `</table:table-row>`;
            }
            tbl += `</table:table>`;
            return tbl;
        };

        // 4. Construction du contenu
        let contentBody = ``;

        // --- PAGE 1 : ÉLÈVE ---
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)}</text:h>`;
        // ✅ Espaces
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        
        contentBody += `<text:p text:style-name="Standard">${echapperXML(consigne)}</text:p>`;
        contentBody += `<text:p text:style-name="Standard"/>`; // Espace avant grille
        
        // Grille vide
        contentBody += createTableXML(false);
        
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:h text:style-name="Heading_2">Mots à trouver :</text:h>`;
        contentBody += `<text:p text:style-name="Standard">${echapperXML(wordsList.join(' - '))}</text:p>`;

        // --- PAGE 2 : CORRECTION ---
        contentBody += `<text:p text:style-name="PageBreak"/>`; 
        
        // ✅ Titre Correction + Espaces
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)} - CORRECTION</text:h>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        
        // Grille corrigée
        contentBody += createTableXML(true);

        // 5. Création ZIP
        const zip = createBaseODT();
        zip.file("META-INF/manifest.xml", generateManifestXML()); // ✅ Ajout Manifeste
        zip.file("styles.xml", generateStylesXML()); 
        zip.file("content.xml", wrapContentXML(contentBody, autoStyles));

        const blob = await zip.generateAsync({ type: "blob" });
        const fileName = `${sanitizeFileName(titreFichier)}.odt`;

        // 🟢 NOUVELLE LOGIQUE D'INSERTION DU BLOB
        if (returnBlobOnly) {
            return { blob, fileName };
        }

        telechargerBlob(blob, fileName);
        logger.log('✅ Export ODT (Mots Mêlés) généré.');

    } catch (e) {
        logger.error(`Erreur ODT WordSearch: ${e.message}`);
        console.error(e);
        // 🟢 ALERTE RENDUE SILENCIEUSE
        if (!returnBlobOnly) alert("Une erreur est survenue lors de l'export ODT (Mots Mêlés).");
        return null;
    }
}