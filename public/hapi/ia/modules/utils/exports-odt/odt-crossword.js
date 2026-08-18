// Fichier: modules/utils/exports-odt/odt-crossword.js

import { logger } from '../logger.js';
import { 
    createBaseODT, 
    generateStylesXML, 
    generateManifestXML, // ✅ INDISPENSABLE
    wrapContentXML, 
    echapperXML, 
    telechargerBlob, 
    sanitizeFileName 
} from './odt-utils.js';

// =========================================================
// 1. MOTEUR DE GÉNÉRATION DE GRILLE
// =========================================================

class CrosswordGenerator {
    constructor(wordList) {
        this.originalData = wordList.map(w => ({
            original: w.answer,
            clue: w.clue,
            clean: w.answer.toUpperCase().replace(/[^A-Z]/g, '')
        }));
        this.gridSize = 60; 
    }

    generate() {
        let bestResult = null;
        let maxPlaced = -1;
        let minArea = Infinity;
        const ATTEMPTS = 50;

        for (let i = 0; i < ATTEMPTS; i++) {
            const result = this.computeSingleGrid();
            const placedCount = result.words.length;
            const bounds = this.calculateBounds(result.grid);
            const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);

            if (placedCount > maxPlaced || (placedCount === maxPlaced && area < minArea)) {
                maxPlaced = placedCount;
                minArea = area;
                bestResult = { ...result, bounds };
            }
        }
        return bestResult;
    }

    computeSingleGrid() {
        const grid = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(null));
        const currentWords = this.originalData.map(w => ({
            ...w, x: 0, y: 0, dir: 'horizontal', placed: false, number: 0
        }));

        currentWords.sort((a, b) => b.clean.length - a.clean.length);
        
        const first = currentWords[0];
        const others = currentWords.slice(1).sort(() => Math.random() - 0.5);
        const workList = [first, ...others];

        const mid = Math.floor(this.gridSize / 2);
        this.placeWord(grid, workList[0], mid - Math.floor(first.clean.length / 2), mid, 'horizontal');

        for (let i = 1; i < workList.length; i++) {
            this.findBestPosition(grid, workList[i]);
        }

        const placedWords = workList.filter(w => w.placed);
        const unplacedWords = workList.filter(w => !w.placed);

        placedWords.sort((a, b) => (a.y - b.y) || (a.x - b.x));
        placedWords.forEach((w, index) => w.number = index + 1);

        return { grid, words: placedWords, unplaced: unplacedWords };
    }

    findBestPosition(grid, wordObj) {
        const letters = wordObj.clean.split('');
        for (let i = 0; i < letters.length; i++) {
            const char = letters[i];
            for (let y = 0; y < this.gridSize; y++) {
                for (let x = 0; x < this.gridSize; x++) {
                    if (grid[y][x] === char) {
                        if (this.canPlaceAt(grid, wordObj.clean, x, y - i, 'vertical')) {
                            this.placeWord(grid, wordObj, x, y - i, 'vertical');
                            return true;
                        }
                        if (this.canPlaceAt(grid, wordObj.clean, x - i, y, 'horizontal')) {
                            this.placeWord(grid, wordObj, x - i, y, 'horizontal');
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    canPlaceAt(grid, word, startX, startY, dir) {
        if (startX < 0 || startY < 0 || startX >= this.gridSize || startY >= this.gridSize) return false;
        
        const dx = dir === 'horizontal' ? 1 : 0;
        const dy = dir === 'vertical' ? 1 : 0;

        if (startX + word.length * dx >= this.gridSize || startY + word.length * dy >= this.gridSize) return false;

        for (let i = 0; i < word.length; i++) {
            const x = startX + i * dx;
            const y = startY + i * dy;
            const currentCell = grid[y][x];
            const letter = word[i];

            if (currentCell !== null && currentCell !== letter) return false;

            if (currentCell === null) {
                if (dir === 'horizontal') {
                    if ((grid[y-1] && grid[y-1][x]) || (grid[y+1] && grid[y+1][x])) return false;
                } else {
                    if ((grid[y][x-1]) || (grid[y][x+1])) return false;
                }
            }
        }
        
        const beforeX = startX - dx;
        const beforeY = startY - dy;
        const afterX = startX + word.length * dx;
        const afterY = startY + word.length * dy;

        if (beforeX >= 0 && beforeY >= 0 && grid[beforeY][beforeX] !== null) return false;
        if (afterX < this.gridSize && afterY < this.gridSize && grid[afterY][afterX] !== null) return false;

        return true;
    }

    placeWord(grid, wordObj, x, y, dir) {
        wordObj.x = x;
        wordObj.y = y;
        wordObj.dir = dir;
        wordObj.placed = true;
        const dx = dir === 'horizontal' ? 1 : 0;
        const dy = dir === 'vertical' ? 1 : 0;
        for (let i = 0; i < wordObj.clean.length; i++) {
            grid[y + i * dy][x + i * dx] = wordObj.clean[i];
        }
    }

    calculateBounds(grid) {
        let minX = this.gridSize, minY = this.gridSize, maxX = 0, maxY = 0;
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (grid[y][x] !== null) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        return { 
            minX: Math.max(0, minX - 1), 
            maxX: Math.min(this.gridSize - 1, maxX + 1), 
            minY: Math.max(0, minY - 1), 
            maxY: Math.min(this.gridSize - 1, maxY + 1) 
        };
    }
}

// =========================================================
// 2. EXPORT ODT (Page 2 Enrichie & Corrigée)
// =========================================================

// 🟢 AJOUT DU PARAMÈTRE returnBlobOnly
export async function exportODT_Crossword(returnBlobOnly = false) {
    try {
        const titreFichier = document.getElementById('crossword-title').value || 'Mots-Croises';
        const consigne = document.getElementById('crosswordTask').value || "Remplissez la grille.";
        
        const cards = document.querySelectorAll('#crossword-items-list .card');
        const rawItems = [];
        cards.forEach(card => {
            const clue = card.querySelector('.cw-clue').value.trim();
            const answer = card.querySelector('.cw-answer').value.trim();
            if (clue && answer) rawItems.push({ clue, answer });
        });

        if (rawItems.length === 0) throw new Error("Aucun mot défini.");

        const generator = new CrosswordGenerator(rawItems);
        const { grid, words, unplaced, bounds } = generator.generate();

        if (words.length === 0) throw new Error("Impossible de placer les mots dans la grille.");

        // --- STYLES PERSONNALISÉS (Globals) ---
        const customStyles = `
            <style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard">
                <style:paragraph-properties fo:break-before="page"/>
            </style:style>
        `;

        // --- STYLES AUTOMATIQUES (Grille) ---
        // Ajout de CellContentCorr pour mettre les réponses en vert
        const autoStyles = `
            <style:style style:name="CrosswordTable" style:family="table">
                <style:table-properties table:align="center" table:border-model="collapsing"/>
            </style:style>
            
            <style:style style:name="CrosswordCol" style:family="table-column">
                <style:table-column-properties style:column-width="1.0cm"/>
            </style:style>

            <style:style style:name="CrosswordRow" style:family="table-row">
                <style:table-row-properties style:min-row-height="1.0cm"/>
            </style:style>

            <style:style style:name="CellGrey" style:family="table-cell">
                <style:table-cell-properties fo:background-color="#e0e0e0" fo:border="0.05pt solid #000000" fo:padding="0cm" style:vertical-align="middle"/>
            </style:style>
            
            <style:style style:name="CellWhite" style:family="table-cell">
                <style:table-cell-properties fo:background-color="#ffffff" fo:border="0.05pt solid #000000" fo:padding="0cm" style:vertical-align="top"/>
            </style:style>
            
            <style:style style:name="CellContent" style:family="paragraph">
                <style:text-properties fo:font-size="14pt" fo:font-weight="bold" fo:font-family="Arial"/>
                <style:paragraph-properties fo:text-align="center" fo:margin="0cm" fo:padding="0cm"/>
            </style:style>
            
            <style:style style:name="CellContentCorr" style:family="paragraph">
                <style:text-properties fo:font-size="14pt" fo:font-weight="bold" fo:font-family="Arial" fo:color="#008000"/>
                <style:paragraph-properties fo:text-align="center" fo:margin="0cm" fo:padding="0cm"/>
            </style:style>
            
            <style:style style:name="CellNumber" style:family="paragraph">
                <style:text-properties fo:font-size="7pt" fo:color="#000000"/>
                <style:paragraph-properties fo:text-align="start" fo:margin-left="0.05cm" fo:margin-top="0cm" fo:margin-bottom="0cm"/>
            </style:style>
        `;

        // Helper définitions
        const getDefinitionsXML = () => {
            const horizontalWords = words.filter(w => w.dir === 'horizontal').sort((a,b) => a.number - b.number);
            const verticalWords = words.filter(w => w.dir === 'vertical').sort((a,b) => a.number - b.number);
            
            let xml = `<text:h text:style-name="Heading_2">Horizontal :</text:h>`;
            if(horizontalWords.length > 0) {
                horizontalWords.forEach(w => {
                    xml += `<text:p text:style-name="Standard"><strong>${w.number}.</strong> ${echapperXML(w.clue)}</text:p>`;
                });
            } else { xml += `<text:p text:style-name="Standard">Aucun.</text:p>`; }

            xml += `<text:p text:style-name="Standard"/>`;
            xml += `<text:h text:style-name="Heading_2">Vertical :</text:h>`;
            if(verticalWords.length > 0) {
                verticalWords.forEach(w => {
                    xml += `<text:p text:style-name="Standard"><strong>${w.number}.</strong> ${echapperXML(w.clue)}</text:p>`;
                });
            } else { xml += `<text:p text:style-name="Standard">Aucun.</text:p>`; }
            
            return xml;
        };

        const createGridXML = (isCorrection) => {
            const width = bounds.maxX - bounds.minX + 1;
            let tbl = `<table:table table:name="Grid${isCorrection?'Corr':'Main'}" table:style-name="CrosswordTable">`;
            
            tbl += `<table:table-column table:style-name="CrosswordCol" table:number-columns-repeated="${width}"/>`;

            for (let y = bounds.minY; y <= bounds.maxY; y++) {
                tbl += `<table:table-row table:style-name="CrosswordRow">`;
                
                for (let x = bounds.minX; x <= bounds.maxX; x++) {
                    const letter = grid[y][x];
                    
                    if (letter === null) {
                        tbl += `<table:table-cell table:style-name="CellGrey" office:value-type="string">
                                    <text:p text:style-name="CellContent"/>
                                </table:table-cell>`;
                    } else {
                        tbl += `<table:table-cell table:style-name="CellWhite" office:value-type="string">`;
                        
                        const startWord = words.find(w => w.x === x && w.y === y);
                        const numDisplay = startWord ? startWord.number : " ";
                        
                        tbl += `<text:p text:style-name="CellNumber">${numDisplay}</text:p>`;
                        
                        // ✅ MODIF : Utilisation du style vert pour la correction
                        const content = isCorrection ? letter : " ";
                        const styleText = isCorrection ? "CellContentCorr" : "CellContent";
                        
                        tbl += `<text:p text:style-name="${styleText}">${content}</text:p>`;
                        
                        tbl += `</table:table-cell>`;
                    }
                }
                tbl += `</table:table-row>`;
            }
            tbl += `</table:table>`;
            return tbl;
        };

        // --- CONSTRUCTION DU DOCUMENT ---
        let contentBody = ``;

        // PAGE 1 : ÉLÈVE
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)}</text:h>`;
        // ✅ Espaces
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        
        contentBody += `<text:p text:style-name="Standard" fo:font-style="italic">${echapperXML(consigne)}</text:p>`;
        contentBody += `<text:p text:style-name="Standard"/>`; 

        contentBody += createGridXML(false); // Grille vide
        contentBody += `<text:p text:style-name="Standard"/>`;
        
        // Définitions Page 1
        contentBody += getDefinitionsXML();

        if (unplaced.length > 0) {
            contentBody += `<text:p text:style-name="Standard"/>`;
            contentBody += `<text:h text:style-name="Heading_2" style:color="#cc0000">⚠️ Mots non placés :</text:h>`;
            unplaced.forEach(w => {
                contentBody += `<text:p text:style-name="Standard">• ${echapperXML(w.original)} (${echapperXML(w.clue)})</text:p>`;
            });
        }

        // PAGE 2 : CORRECTION
        contentBody += `<text:p text:style-name="PageBreak"/>`; 
        
        // ✅ Titre Correction + Espaces
        contentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(titreFichier)} - CORRECTION</text:h>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:p text:style-name="Standard"/>`;
        
        contentBody += createGridXML(true); // Grille remplie (lettres vertes)
        
        contentBody += `<text:p text:style-name="Standard"/>`;
        contentBody += `<text:h text:style-name="Heading_3" style:font-style="italic">Rappel des définitions :</text:h>`;
        
        // Définitions Page 2
        contentBody += getDefinitionsXML();

        // --- GÉNÉRATION ZIP ---
        const zip = createBaseODT();
        zip.file("META-INF/manifest.xml", generateManifestXML()); // ✅ Ajout Manifeste
        zip.file("styles.xml", generateStylesXML(customStyles));  // ✅ Ajout Custom Styles (PageBreak)
        zip.file("content.xml", wrapContentXML(contentBody, autoStyles)); // ✅ AutoStyles (Grille)

        const blob = await zip.generateAsync({ type: "blob" });
        const fileName = `${sanitizeFileName(titreFichier)}.odt`;

        // 🟢 NOUVELLE LOGIQUE D'INSERTION DU BLOB (SILENCIEUX)
        if (returnBlobOnly) {
            return { blob, fileName };
        }

        telechargerBlob(blob, fileName);
        logger.log('✅ Export ODT (Crossword Grid) généré.');

    } catch (e) {
        logger.error(`Erreur ODT Crossword: ${e.message}`);
        console.error(e);
        // 🟢 ALERTE RENDUE SILENCIEUSE
        if (!returnBlobOnly) alert("Une erreur est survenue lors de la génération de la grille.");
        return null;
    }
}