// Fichier: outils/export-tools/exporter.js

import { 
    createBaseODT, 
    generateStylesXML, 
    generateManifestXML, 
    wrapContentXML, 
    echapperXML, 
    telechargerBlob, 
    sanitizeFileName 
} from '../../ia/modules/utils/exports-odt/odt-utils.js';

import "../../vendor/jspdf/jspdf.umd.min.js";

// --- DOM ELEMENTS ---
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const resultsContainer = document.getElementById('results-container');
const filesList = document.getElementById('files-list');
const globalActions = document.getElementById('global-actions');
const btnDownloadAll = document.getElementById('btn-download-all');

// --- STATE ---
let processedFiles = []; 

// --- STYLES INJECTÉS (UI: Croix Badge + Pastille Violette) ---
const style = document.createElement('style');
style.innerHTML = `
    /* Conteneur de la ligne */
    .file-row {
        position: relative; 
        padding-right: 20px;
        margin-top: 15px;
        overflow: visible;
    }
    
    /* Bouton Croix "Badge" sur le coin */
    .btn-delete-row {
        position: absolute;
        top: -10px;
        right: -10px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        box-shadow: 0 2px 5px rgba(0,0,0,0.15);
        color: #e53e3e; 
        font-size: 1.1rem;
        font-weight: bold; 
        line-height: 22px;
        text-align: center;
        cursor: pointer; 
        transition: all 0.2s ease;
        z-index: 10;
        padding: 0;
        display: flex; justify-content: center; align-items: center;
    }
    
    .btn-delete-row:hover { 
        background-color: #e53e3e;
        color: white;
        border-color: #c53030;
        transform: scale(1.1); 
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }

    /* Pastille PDF Violette */
    .badge-pdf { 
        background: #f3e8ff !important; 
        color: #6b46c1 !important; 
        border: 1px solid #d6bcfa !important; 
    }
`;
document.head.appendChild(style);

// --- INITIALISATION ---
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
btnDownloadAll.addEventListener('click', downloadAllAsZip);

// --- HANDLERS ---
function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
}

async function handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    
    resultsContainer.style.display = 'block';

    for (const file of fileList) {
        if(!file.name.endsWith('.h5p')) continue;

        const rowId = 'row-' + Math.random().toString(36).substr(2, 9);
        addLoadingRow(rowId, file.name);

        try {
            const processor = new H5PProcessor(file);
            await processor.load(); 
            
            const generatedResults = await processor.generate(); 
            const fileResults = [];

            for (const res of generatedResults) {
                let baseName = sanitizeFileName(processor.title);
                let finalFileName = `${baseName}.${res.extension}`;
                
                let counter = 1;
                while (processedFiles.some(f => f.name === finalFileName)) {
                    finalFileName = `${baseName} (${counter}).${res.extension}`;
                    counter++;
                }

                const fileObj = { name: finalFileName, blob: res.blob };
                processedFiles.push(fileObj);

                let typeLabel = res.extension.toUpperCase();
                if (typeLabel === 'TXT') typeLabel = 'GIFT';

                fileResults.push({ ...fileObj, type: typeLabel });
            }

            updateRowSuccessMulti(rowId, processor.title, fileResults);

        } catch (e) {
            console.error(e);
            updateRowError(rowId, e.message);
        }
    }

    if (processedFiles.length > 0) {
        globalActions.style.display = 'block';
    }
}

async function downloadAllAsZip() {
    if (processedFiles.length === 0) return;
    const zip = new JSZip();
    processedFiles.forEach(f => { zip.file(f.name, f.blob); });
    const content = await zip.generateAsync({ type: "blob" });
    telechargerBlob(content, "export-hapi-complet.zip");
}

// --- GESTION SUPPRESSION ---
function removeFileRow(rowId, fileNamesToRemove = []) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
    if (fileNamesToRemove.length > 0) {
        processedFiles = processedFiles.filter(f => !fileNamesToRemove.includes(f.name));
    }
    if (processedFiles.length === 0) {
        globalActions.style.display = 'none';
    }
}

// --- GESTION UI LISTE ---

function addLoadingRow(id, filename) {
    const div = document.createElement('div');
    div.id = id;
    div.className = 'file-row';
    div.innerHTML = `
        <div class="file-info-col">
            <span class="file-title">${echapperXML(filename)}</span>
            <span class="file-meta"><span class="badge badge-loading">⏳ Traitement...</span></span>
        </div>
        <button class="btn-delete-row" title="Annuler">&times;</button>
    `;
    div.querySelector('.btn-delete-row').addEventListener('click', () => removeFileRow(id));
    filesList.appendChild(div);
}

function updateRowSuccessMulti(id, title, files) {
    const div = document.getElementById(id);
    if (!div) return;

    // 1. Tri : XML > GIFT > ODT/PDF
    const priority = { 'XML': 1, 'GIFT': 2, 'ODT': 3, 'PDF': 3 };
    files.sort((a, b) => {
        const pA = priority[a.type] || 99;
        const pB = priority[b.type] || 99;
        return pA - pB;
    });

    const generatedFileNames = files.map(f => f.name);

    let buttonsHtml = '';
    files.forEach((f, index) => {
        if (index > 0) {
            buttonsHtml += `<span style="color:#cbd5e0; margin:0 8px; font-size:1.2em;">|</span>`;
        }

        const url = URL.createObjectURL(f.blob);
        let badgeClass = 'badge-odt'; 
        if (f.type === 'PDF') badgeClass = 'badge-pdf'; 
        if (f.type === 'XML' || f.type === 'GIFT') badgeClass = 'badge-loading'; 

	   // Bouton de téléchargement
	           buttonsHtml += `
	               <a href="${url}" download="${f.name}" class="btn-download-mini" title="Télécharger ${f.type}" style="text-decoration:none; color:#2d3748; display:inline-flex; align-items:center;">
	                   <span class="badge ${badgeClass}" style="height: 19.5px; line-height: 18px; display: inline-flex; align-items: center;">${f.type}</span>
	                   <span style="font-size: 1.2em; line-height: 1; margin-left: 1px; position: relative; bottom: 0.5px;">⬇️</span>
	               </a>
	           `;
    });

    div.innerHTML = `
        <div class="file-info-col">
            <span class="file-title">${echapperXML(title)}</span>
            <span class="file-meta" style="color:#276749;">
                ✅ Génération réussie
            </span>
        </div>
        <div style="display:flex; align-items:center;">
            ${buttonsHtml}
        </div>
        <button class="btn-delete-row" title="Supprimer la ligne">&times;</button>
    `;

    div.querySelector('.btn-delete-row').addEventListener('click', () => {
        removeFileRow(id, generatedFileNames);
    });
}

function updateRowError(id, msg) {
    const div = document.getElementById(id);
    if (!div) return;
    div.innerHTML = `
        <div class="file-info-col">
            <span class="file-title" style="color:red;">Erreur</span>
            <span class="file-meta" style="color:red;">${echapperXML(msg)}</span>
        </div>
        <button class="btn-delete-row" title="Supprimer">&times;</button>
    `;
    div.querySelector('.btn-delete-row').addEventListener('click', () => removeFileRow(id));
}

// =========================================================
// CLASSE PROCESSEUR
// =========================================================
class H5PProcessor {
    constructor(file) {
        this.file = file;
        this.zip = null;
        this.data = null;
        this.library = null;
        this.title = "";
        this.language = "fr";
        this.extension = "odt";
        this.mathObjectCounter = 0;
        this.mathObjects = [];
    }

	async load() {
	        this.zip = new JSZip();
	        const content = await this.zip.loadAsync(this.file);
        
	        if (!content.files['h5p.json'] || !content.files['content/content.json']) {
	            throw new Error("Structure H5P invalide.");
	        }

	        const metadata = JSON.parse(await content.files['h5p.json'].async('string'));
	        this.title = metadata.title || this.file.name.replace('.h5p', '');
	        this.language = metadata.defaultLanguage || 'fr';

	        // 🌟 1. AUTORISATION DU MODULE (+ H5P.InteractiveVideo)
	        const supportedLibs = [
	            'H5P.QuestionSet', 'H5P.Crossword', 'H5P.Summary', 'H5P.Accordion',
	            'H5P.MultiChoice', 'H5P.TrueFalse', 'H5P.DragText', 'H5P.SortParagraphs',
	            'H5P.FindTheWords', 'H5P.MarkTheWords',
	            'H5P.Dialogcards', 'H5P.Flashcards', 'H5P.ImagePair', 'H5P.Timeline', 'H5P.AdvancedBlanks',
	            'H5P.DragQuestion', 'H5P.InteractiveVideo'
	        ];

	        let mainLib = metadata.preloadedDependencies.find(d => d.machineName === 'H5P.QuestionSet');
	        if (!mainLib) {
	            mainLib = metadata.preloadedDependencies.find(dep => 
	                supportedLibs.some(sup => dep.machineName.startsWith(sup))
	            );
	        }

	        if (!mainLib) throw new Error("Type d'activité non supporté.");
	        this.library = mainLib.machineName;
        
	        // 🌟 2. ROUTAGE VERS LE PDF
	        const pdfLibs = ['H5P.Dialogcards', 'H5P.Flashcards', 'H5P.ImagePair', 'H5P.Timeline', 'H5P.DragQuestion', 'H5P.InteractiveVideo'];
	        this.extension = pdfLibs.some(pl => this.library.startsWith(pl)) ? 'pdf' : 'odt';

	        this.data = JSON.parse(await content.files['content/content.json'].async('string'));
	    }

    async generate() {
        const results = [];

        // 1. Export Visuel (ODT ou PDF)
        if (this.extension === 'pdf') {
            const pdfBlob = await this.generatePDF();
            results.push({ extension: 'pdf', blob: pdfBlob });
        } else {
            const odtBlob = await this.generateODT();
            results.push({ extension: 'odt', blob: odtBlob });
        }

        // 2. Export Technique (GIFT & XML) pour les Quiz
        const isQuiz = this.library.startsWith('H5P.QuestionSet') || 
                       this.library.startsWith('H5P.MultiChoice') || 
                       this.library.startsWith('H5P.TrueFalse') ||
					   this.library.startsWith('H5P.AdvancedBlanks');

        if (isQuiz) {
            try {
                const giftContent = this.generateGIFT();
                if (giftContent) {
                    results.push({ 
                        extension: 'txt', 
                        blob: new Blob([giftContent], { type: 'text/plain;charset=utf-8' }) 
                    });
                }

                const xmlContent = this.generateMoodleXML();
                if (xmlContent) {
                    results.push({ 
                        extension: 'xml', 
                        blob: new Blob([xmlContent], { type: 'text/xml;charset=utf-8' }) 
                    });
                }
            } catch (e) {
                console.warn("Erreur export technique:", e);
            }
        }

        return results;
    }

    // --- UTILITAIRES ---
    
    async getImageFromZip(imagePath) {
        if (!imagePath || !this.zip) return null;
        let cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
        const fileName = cleanPath.split('/').pop();
        const candidates = [`content/${cleanPath}`, cleanPath, `content/images/${fileName}`, `images/${fileName}`];
        let file = null;
        for (const p of candidates) { if (this.zip.files[p]) { file = this.zip.files[p]; break; } }
        if (!file) return null;
        try {
            const blob = await file.async('blob');
            const url = URL.createObjectURL(blob);
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.naturalWidth; let height = img.naturalHeight;
                    const MAX_SIZE = 1500;
                    if (width > MAX_SIZE || height > MAX_SIZE) {
                        if (width > height) { height *= MAX_SIZE / width; width = MAX_SIZE; } 
                        else { width *= MAX_SIZE / height; height = MAX_SIZE; }
                    }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    URL.revokeObjectURL(url);
                    resolve({ data: dataUrl, w: width, h: height, format: 'JPEG' });
                };
                img.onerror = () => resolve(null);
                img.src = url;
            });
        } catch (e) { return null; }
    }

    stripHtml(html) {
        if (!html) return "";
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return (tmp.textContent || tmp.innerText || "").trim();
    }

    cleanHtmlForExport(html) {
        if (!html) return "";
        let text = html.replace(/<br\s*\/?>/gi, " ");
        const tmp = document.createElement("DIV");
        tmp.innerHTML = text;
        return (tmp.textContent || tmp.innerText || "").trim();
    }

// --- FORMATAGE INTELLIGENT DES DATES ---
    formatDate(dateStr) {
        if (!dateStr) return "";
        const parts = dateStr.split(',');
        
        // Si on a juste l'année
        if (parts.length === 1) return parts[0]; 

        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1; // 0-11
        const day = parts[2] ? parseInt(parts[2], 10) : null;

        // Configuration multilingue complète
        const i18n = {
            'fr': { // Français
                months: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
                fmt: (d, m, y) => d ? `${d} ${m} ${y}` : `${m} ${y}`
            },
            'en': { // Anglais
                months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
                fmt: (d, m, y) => d ? `${m} ${d}, ${y}` : `${m} ${y}`
            },
            'es': { // Espagnol
                months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
                fmt: (d, m, y) => d ? `${d} de ${m} de ${y}` : `${m} de ${y}`
            },
            'de': { // Allemand
                months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
                fmt: (d, m, y) => d ? `${d}. ${m} ${y}` : `${m} ${y}`
            },
            'it': { // Italien
                months: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
                fmt: (d, m, y) => d ? `${d} ${m} ${y}` : `${m} ${y}`
            },
            'nl': { // Néerlandais
                months: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"],
                fmt: (d, m, y) => d ? `${d} ${m} ${y}` : `${m} ${y}`
            },
            'pt': { // Portugais
                months: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
                fmt: (d, m, y) => d ? `${d} de ${m} de ${y}` : `${m} de ${y}`
            },
            'la': { // Latin (Utile pour l'histoire)
                months: ["Ianuarius", "Februarius", "Martius", "Aprilis", "Maius", "Iunius", "Iulius", "Augustus", "September", "October", "November", "December"],
                fmt: (d, m, y) => d ? `${d} ${m} ${y}` : `${m} ${y}`
            }
        };

        // Sélection de la langue ou fallback 'fr'
        // this.language vient du fichier h5p.json parsé dans la méthode load()
        const langCode = (this.language && i18n[this.language]) ? this.language : 'fr';
        const config = i18n[langCode];

        if (monthIndex >= 0 && monthIndex < 12) {
            const m = config.months[monthIndex];
            return config.fmt(day, m, year);
        }
        
        return dateStr;
    }

    // --- RECUPERATION DES CREDITS (Optimisé) ---
    getCopyrightText(asset) {
        if (!asset || !asset.copyright) return null;
        const c = asset.copyright;
        let parts = [];
        if (c.title) parts.push(c.title);
        if (c.author) parts.push(`Auteur: ${c.author}`);
        if (c.source) parts.push(`Source: ${c.source}`);
        if (c.license) parts.push(`Licence: ${c.license}`);
        return parts.length > 0 ? parts.join(' - ') : null;
    }

    // --- MOTEUR EXPORT TEXTUEL (GIFT & XML) ---

    echapperGIFT(texte) {
        if (typeof texte !== 'string') return '';
        return texte
            .replace(/\\/g, '\\\\')
            .replace(/~/g, '\\~')
            .replace(/=/g, '\\=')
            .replace(/#/g, '\\#')
            .replace(/{/g, '\\{')
            .replace(/}/g, '\\}')
            .replace(/:/g, '\\:');
    }

    getQuestionsList() {
        if (this.library.startsWith('H5P.QuestionSet')) return this.data.questions || [];
        if (this.library.startsWith('H5P.MultiChoice') || this.library.startsWith('H5P.TrueFalse') || 
			this.library.startsWith('H5P.AdvancedBlanks')) return [{ library: this.library, params: this.data }];return [];
    }

    generateGIFT() {
        let content = `// Export GIFT HAPI\n// Titre: ${this.title}\n\n`;
        const questions = this.getQuestionsList();
        questions.forEach((q, index) => {
            const lib = q.library;
            const params = q.params;
            
            const label = lib.includes('TrueFalse') ? 'Affirmation' : 'Question';
            const qTitle = `${label} ${index + 1}`;
            
            if (lib.includes('MultiChoice')) {
                const qText = this.cleanHtmlForExport(params.question);
                content += `::${qTitle}::${this.echapperGIFT(qText)}{\n`;
                (params.answers || []).forEach(ans => {
                    content += `\t${ans.correct ? '=' : '~'}${this.echapperGIFT(this.cleanHtmlForExport(ans.text))}\n`;
                });
                content += `}\n\n`;
            } else if (lib.includes('TrueFalse')) {
                const qText = this.cleanHtmlForExport(params.question);
                content += `::${qTitle}::${this.echapperGIFT(qText)}{${(params.correct === "true") ? 'T' : 'F'}}\n\n`;
            }
        });
        return content;
    }

	generateMoodleXML() {
	        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<quiz>\n`;
	        const questions = this.getQuestionsList();
	        questions.forEach((q, index) => {
	            const lib = q.library;
	            const params = q.params;
            
	            const label = lib.includes('TrueFalse') ? 'Affirmation' : 'Question';
	            const qName = `${label} ${index + 1}`;
            
	            if (lib.includes('MultiChoice')) {
	                xml += `  <question type="multichoice">\n    <name><text>${qName}</text></name>\n    <questiontext format="html"><text><![CDATA[${params.question || ""}]]></text></questiontext>\n    <single>${(params.type === 'single' || params.singleAnswer) ? 'true' : 'false'}</single>\n    <shuffleanswers>true</shuffleanswers>\n`;
	                const answers = params.answers || [];
	                const correctCount = answers.filter(a => a.correct).length;
	                const correctFraction = correctCount > 0 ? (100 / correctCount).toFixed(7) : 0;
	                answers.forEach(ans => {
	                    xml += `    <answer fraction="${ans.correct ? correctFraction : "0"}" format="html">\n      <text><![CDATA[${ans.text}]]></text>\n`;
	                    if(ans.tipsAndFeedback?.chosenFeedback) xml += `      <feedback format="html"><text><![CDATA[${ans.tipsAndFeedback.chosenFeedback}]]></text></feedback>\n`;
	                    xml += `    </answer>\n`;
	                });
	                xml += `  </question>\n`;
	            } else if (lib.includes('TrueFalse')) {
	                const isTrue = (params.correct === "true");
	                xml += `  <question type="truefalse">\n    <name><text>${qName}</text></name>\n    <questiontext format="html"><text><![CDATA[${params.question || ""}]]></text></questiontext>\n    <answer fraction="${isTrue ? '100' : '0'}" format="moodle_auto_format"><text>true</text></answer>\n    <answer fraction="${isTrue ? '0' : '100'}" format="moodle_auto_format"><text>false</text></answer>\n  </question>\n`;
            
				} else if (lib.includes('AdvancedBlanks')) {
				                xml += `  <question type="cloze">\n    <name><text>${qName}</text></name>\n`;
                
				                // 🌟 Pareil ici, on pointe sur le sous-objet "content"
				                const contentBlock = params.content || params;
                
				                let instructionStr = contentBlock.task || contentBlock.consignes || contentBlock.taskDescription || "";
				                let questionText = instructionStr ? `<p>${instructionStr}</p><br/>` : "";
                
				                // Récupération du texte avec underscores
				                let texte = contentBlock.blanksText || contentBlock.texteHtml || contentBlock.template || "";

				                texte = texte.replace(/<input[^>]*>/gi, '___________');
				                texte = texte.replace(/<span[^>]*class="[^"]*blank[^"]*"[^>]*><\/span>/gi, '___________');
                
				                // Récupération de la liste des réponses et erreurs
				                const sourceArray = contentBlock.blanksList || contentBlock.blanks || [];
				                const blanks = [...sourceArray];
				                let blankIndex = 0;
                
				                texte = texte.replace(/_{3,}/g, () => {
				                    if (blankIndex < blanks.length) {
				                        const bData = blanks[blankIndex];
				                        const mainAnswer = bData.correctAnswerText || bData.text || "";
				                        let clozeAns = `{1:SHORTANSWER:=${mainAnswer}`;
                        
				                        if (bData.incorrectAnswersList) {
				                            bData.incorrectAnswersList.forEach(inc => {
				                                const incAns = inc.incorrectAnswerText || inc.text || "";
				                                clozeAns += `~${incAns}`;
				                                if (inc.incorrectAnswerFeedback) {
				                                    clozeAns += `#${this.cleanHtmlForExport(inc.incorrectAnswerFeedback)}`;
				                                }
				                            });
				                        }
				                        clozeAns += "}";
				                        blankIndex++;
				                        return clozeAns;
				                    }
				                    return "_____";
				                });
                
				                questionText += `<p>${texte}</p>`;
				                xml += `    <questiontext format="html"><text><![CDATA[${questionText}]]></text></questiontext>\n    <generalfeedback format="html"><text></text></generalfeedback>\n  </question>\n`;
				            }
	        });
        
	        xml += `</quiz>`;
	        return xml;
	    }
		
		
		
    // --- MOTEUR PDF (TIMELINE & CARDS & INTERACTIVE VIDEO) ---
	async generatePDF() {
	        const { jsPDF } = window.jspdf;
	        const titre = this.title;
        
	        // --- TIMELINE ---
	        if (this.library.startsWith('H5P.Timeline')) {
	            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
	            const PAGE_W = 297; const PAGE_H = 210; const MARGIN = 15;
	            const timelineData = this.data.timeline || this.data;
	            const headline = this.stripHtml(timelineData.headline || "Frise Chronologique");
	            const introText = this.stripHtml(timelineData.text || "");
	            const eras = timelineData.era || [];
	            const events = timelineData.date || [];

	            doc.setFont("helvetica", "bold"); doc.setFontSize(28); doc.setTextColor(88, 17, 26);
	            doc.text(headline, PAGE_W / 2, 40, { align: 'center' });

	            // Image de fond
	            let bgObj = timelineData.backgroundImage || timelineData.asset?.image || timelineData.asset?.media;
	            let bgPath = bgObj?.path;

	            if (bgPath) {
	                const bgData = await this.getImageFromZip(bgPath);
	                if (bgData) {
	                    const maxW = 180; const maxH = 100;
	                    const scale = Math.min(maxW / bgData.w, maxH / bgData.h);
	                    const w = bgData.w * scale; const h = bgData.h * scale;
	                    const x = (PAGE_W - w)/2;
	                    const y = 60;
	                    doc.addImage(bgData.data, bgData.format, x, y, w, h);
                    
	                    const bgCopy = this.getCopyrightText(bgObj);
	                    if(bgCopy) {
	                        doc.setFontSize(6); doc.setTextColor(100);
	                        doc.text(doc.splitTextToSize(bgCopy, w), x, y + h + 3);
	                    }
	                }
	            }
	            if (introText) {
	                doc.setFont("helvetica", "normal"); doc.setFontSize(14); doc.setTextColor(60);
	                const splitIntro = doc.splitTextToSize(introText, 220);
	                doc.text(splitIntro, PAGE_W / 2, 170, { align: 'center' });
	            }

	            // Eras (Périodes)
	            if (eras.length > 0) {
	                doc.addPage();
	                doc.setFillColor(245, 245, 245); doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
	                doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(50);
	                doc.text("Périodes Clés", MARGIN, 20);
	                let eraY = 35;
	                eras.forEach(era => {
	                    if (eraY > PAGE_H - 40) { doc.addPage(); doc.setFillColor(245, 245, 245); doc.rect(0, 0, PAGE_W, PAGE_H, 'F'); eraY = 35; }
	                    doc.setFillColor(255, 255, 255); doc.setDrawColor(200); doc.rect(MARGIN, eraY, PAGE_W - (MARGIN*2), 30, 'FD');
                    
	                    const startD = this.formatDate(era.startDate);
	                    const endD = this.formatDate(era.endDate);

	                    doc.setFontSize(14); doc.setTextColor(88, 17, 26);
	                    doc.text(`${this.stripHtml(era.headline)} (${startD} - ${endD})`, MARGIN + 5, eraY + 10);
                    
	                    doc.setFontSize(11); doc.setTextColor(80); doc.setFont("helvetica", "normal");
	                    doc.text(doc.splitTextToSize(this.stripHtml(era.text), PAGE_W - (MARGIN*2) - 10), MARGIN + 5, eraY + 18);
	                    eraY += 35;
	                });
	            }

				// Events (Événements)
				            for (let i = 0; i < events.length; i++) {
				                const evt = events[i];
				                doc.addPage();
				                doc.setFillColor(240, 240, 240); doc.rect(0, 0, PAGE_W, 35, 'F');
                
				                // Tag (coin supérieur droit)
				                let tag = evt.tag ? this.stripHtml(evt.tag) : "";
				                if (tag) {
				                    doc.setFontSize(12); doc.setTextColor(255); doc.setFillColor(100, 116, 139);
				                    const tagW = doc.getTextWidth(tag) + 10;
				                    doc.roundedRect(PAGE_W - MARGIN - tagW, 10, tagW, 10, 2, 2, 'F');
				                    doc.text(tag, PAGE_W - MARGIN - (tagW/2), 16.5, { align: 'center' });
				                }

				                // ✅ 1. DATE RÉTABLIE DANS L'ENTÊTE (EN HAUT)
				                doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(50);
                
				                let dateStr = this.formatDate(evt.startDate); 
				                if (evt.endDate) dateStr += ` - ${this.formatDate(evt.endDate)}`;
                
				                doc.text(dateStr, MARGIN, 18);

				                // Titre de l'événement
				                doc.setFontSize(24); doc.setTextColor(88, 17, 26); doc.setFont("helvetica", "bold");
				                doc.text(this.stripHtml(evt.headline), MARGIN, 55);

				                const contentStartY = 70;
                
				                // Récupération des données Image et Textes
				                let assetObj = null;
				                if (evt.asset?.media?.path) assetObj = evt.asset.media;
				                else if (evt.asset?.thumbnail?.path) assetObj = evt.asset.thumbnail;
				                else if (evt.asset?.image?.path) assetObj = evt.asset.image;
                
				                let captionText = (evt.asset && evt.asset.caption) ? this.stripHtml(evt.asset.caption) : "";
				                let creditText = (evt.asset && evt.asset.credit) ? this.stripHtml(evt.asset.credit) : "";
				                if (!creditText && assetObj) {
				                    creditText = this.getCopyrightText(assetObj) || "";
				                }

				                const evtText = this.stripHtml(evt.text);

				                if (assetObj && assetObj.path) {
				                    const imgData = await this.getImageFromZip(assetObj.path);
				                    if (imgData) {
				                        // Texte à gauche
				                        doc.setFont("helvetica", "normal"); doc.setFontSize(14); doc.setTextColor(0);
				                        doc.text(doc.splitTextToSize(evtText, 160), MARGIN, contentStartY);
                        
				                        // Image à droite
				                        const imgBoxX = 180; const imgBoxY = contentStartY - 5; const imgBoxW = 100; const imgBoxH = 100;
				                        const scale = Math.min(imgBoxW / imgData.w, imgBoxH / imgData.h);
				                        const finalW = imgData.w * scale;
				                        const finalH = imgData.h * scale;
				                        const finalX = imgBoxX + (imgBoxW - finalW)/2;
                        
				                        doc.addImage(imgData.data, imgData.format, finalX, imgBoxY, finalW, finalH);

				                        // --- LÉGENDES SOUS L'IMAGE ---
				                        let currentY = imgBoxY + finalH + 5;
				                        const maxWidth = Math.max(finalW, 60);

				                        // A. Titre de l'image (Caption)
				                        if (captionText) {
				                            doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(50);
				                            const splitCap = doc.splitTextToSize(captionText, maxWidth);
				                            doc.text(splitCap, finalX, currentY);
				                            currentY += (splitCap.length * 4) + 1;
				                        }

				                        // B. Source / Crédits
				                        if (creditText) {
				                            doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(120);
				                            const splitCred = doc.splitTextToSize("Source : " + creditText, maxWidth);
				                            doc.text(splitCred, finalX, currentY);
				                        }

				                    } else {
				                         // Fallback image corrompue
				                         doc.setFont("helvetica", "normal"); doc.setFontSize(14); doc.setTextColor(0);
				                         doc.text(doc.splitTextToSize(evtText, PAGE_W - (MARGIN * 2)), MARGIN, contentStartY);
				                    }
				                } else {
				                    // Pas d'image du tout
				                    doc.setFont("helvetica", "normal"); doc.setFontSize(14); doc.setTextColor(0);
				                    doc.text(doc.splitTextToSize(evtText, PAGE_W - (MARGIN * 2)), MARGIN, contentStartY);
				                }
                
				                // Pagination
				                doc.setFontSize(10); doc.setTextColor(200);
				                doc.text(`${i + 1} / ${events.length}`, PAGE_W / 2, PAGE_H - 10, { align: 'center' });
				            }
	            return doc.output('blob');
	        } 
        
	        // --- DIALOG / FLASH CARDS ---
	        else if (this.library.startsWith('H5P.Dialogcards') || this.library.startsWith('H5P.Flashcards')) {
	            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
	            const cards = this.data.dialogs || this.data.cards || [];
	            const MARGIN_LEFT = 15; const CARD_WIDTH = 90; const CARD_HEIGHT = 80; 
	            let yPos = 30; let cardsOnPage = 0;

	            doc.setFont("helvetica", "bold"); doc.setFontSize(18);
	            doc.text(titre, 105, 15, { align: 'center' });
	            doc.setFontSize(10); doc.setFont("helvetica", "italic");
	            doc.text("Imprimez, découpez les lignes, pliez au centre.", 105, 22, { align: 'center' });

	            for (let i = 0; i < cards.length; i++) {
	                if (cardsOnPage === 3) { doc.addPage(); yPos = 20; cardsOnPage = 0; }
	                const card = cards[i];
	                const front = this.stripHtml(card.text || "");
	                const back = this.stripHtml(card.answer || "");
                
	                doc.setDrawColor(150); doc.setLineWidth(0.1);
	                doc.rect(MARGIN_LEFT, yPos, CARD_WIDTH, CARD_HEIGHT); 
	                doc.rect(MARGIN_LEFT + CARD_WIDTH, yPos, CARD_WIDTH, CARD_HEIGHT);

	                let textY_Front = yPos + (CARD_HEIGHT / 2);
	                const imgData = await this.getImageFromZip(card.image?.path);
	                if (imgData) {
	                     const imgX = MARGIN_LEFT + (CARD_WIDTH - 50)/2;
	                     const imgY = yPos + 8;
	                     doc.addImage(imgData.data, imgData.format, imgX, imgY, 50, 40);
	                     textY_Front = yPos + 58;

	                     const copyTxt = this.getCopyrightText(card.image);
	                     if(copyTxt) {
	                         doc.setFontSize(5); doc.setTextColor(150);
	                         doc.text(doc.splitTextToSize(copyTxt, 48), imgX, imgY + 42);
	                     }
	                }
                
	                doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(0);
	                doc.text(doc.splitTextToSize(front, CARD_WIDTH - 10), MARGIN_LEFT + (CARD_WIDTH/2), textY_Front, { align: 'center' });

	                doc.setFont("helvetica", "normal"); doc.setFontSize(11);
	                doc.text(doc.splitTextToSize(back, CARD_WIDTH - 10), MARGIN_LEFT + CARD_WIDTH + (CARD_WIDTH/2), yPos + (CARD_HEIGHT/2), { align: 'center' });

	                doc.setDrawColor(200); doc.setLineDash([2, 2], 0);
	                doc.line(MARGIN_LEFT + CARD_WIDTH, yPos, MARGIN_LEFT + CARD_WIDTH, yPos + CARD_HEIGHT);
	                doc.setLineDash([]);
	                yPos += CARD_HEIGHT; cardsOnPage++;
	            }
	            return doc.output('blob');
	        }

	        // --- IMAGE PAIRING ---
	        else if (this.library.startsWith('H5P.ImagePair')) {
	            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
	            const pairs = this.data.cards || [];
	            const COL_W = 138.5; const ROW_H = 35; let y = 35;

	            doc.setFont("helvetica", "bold"); doc.setFontSize(22);
	            doc.text(titre, 148, 15, { align: 'center' });

	            const drawHeaders = (y) => {
	                doc.setFillColor(240, 240, 240);
	                doc.rect(10, y, COL_W, 8, 'F'); doc.rect(10 + COL_W, y, COL_W, 8, 'F');
	                doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(50);
	                doc.text("ÉLÉMENT A", 15, y + 5.5); doc.text("ÉLÉMENT B", 15 + COL_W, y + 5.5);
	            };
	            drawHeaders(y - 8);

	            for (let i = 0; i < pairs.length; i++) {
	                if (y + ROW_H > 200) { doc.addPage(); y = 20; drawHeaders(y-8); }
	                const pair = pairs[i];
                
	                const renderImg = async (imgObj, x) => {
	                    if(!imgObj || !imgObj.path) return;
	                    const img = await this.getImageFromZip(imgObj.path);
	                    if(img) {
	                        const scale = Math.min((COL_W-4)/img.w, (ROW_H-4)/img.h);
	                        const finalW = img.w*scale;
	                        const finalH = img.h*scale;
	                        const finalX = x + (COL_W - finalW)/2;
	                        const finalY = y + (ROW_H - finalH)/2;
	                        doc.addImage(img.data, img.format, finalX, finalY, finalW, finalH);

	                        const copyTxt = this.getCopyrightText(imgObj);
	                        if(copyTxt) {
	                            doc.setFontSize(5); doc.setTextColor(150);
	                            doc.text(copyTxt, x + COL_W - 2, y + ROW_H - 2, { align: 'right', maxWidth: COL_W/2 });
	                        }
	                    }
	                };

	                doc.setDrawColor(200); doc.setLineWidth(0.2);
	                doc.rect(10, y, COL_W, ROW_H); doc.rect(10+COL_W, y, COL_W, ROW_H);
                
	                await renderImg(pair.image, 10);
	                await renderImg(pair.match, 10+COL_W);
	                y += ROW_H;
	            }
	            return doc.output('blob');
	        }

	        // --- DRAG QUESTION (Catégorisation / Glisser-Déposer) ---
// --- DRAG QUESTION (Catégorisation / Glisser-Déposer) ---
	        else if (this.library.startsWith('H5P.DragQuestion')) {
	            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
	            const PAGE_W = 210; const PAGE_H = 297; const MARGIN = 15;
	            let yPos = MARGIN;

                // --- FONCTION DE RENDU GABARIT (ÉLÈVE / CORRECTION) ---
                const renderDragQuestionPage = async (isCorrection) => {
                    // Titre
                    doc.setFont("helvetica", "bold"); doc.setFontSize(22); 
                    if (isCorrection) {
                        doc.setTextColor(22, 163, 74); // Vert pour correction
                        const splitTitle = doc.splitTextToSize("Correction : " + titre, PAGE_W - (MARGIN * 2));
                        doc.text(splitTitle, PAGE_W / 2, yPos, { align: 'center' });
                        yPos += (splitTitle.length * 8) + 4;
                    } else {
                        doc.setTextColor(88, 17, 26);
                        const splitTitle = doc.splitTextToSize(titre, PAGE_W - (MARGIN * 2));
                        doc.text(splitTitle, PAGE_W / 2, yPos, { align: 'center' });
                        yPos += (splitTitle.length * 8) + 4;
                    
                        // Consigne (uniquement pour l'élève)
                        const consigneHtml = this.data.question?.settings?.questionTitle || "Placez les éléments au bon endroit.";
                        const consigne = this.stripHtml(consigneHtml);
                        doc.setFontSize(12); doc.setTextColor(50); doc.setFont("helvetica", "italic");
                        const splitConsigne = doc.splitTextToSize(consigne, PAGE_W - (MARGIN * 2));
                        doc.text(splitConsigne, PAGE_W / 2, yPos, { align: 'center' });
                        yPos += (splitConsigne.length * 6) + 10;
                    }

                    const bgObj = this.data.question?.settings?.background;
                    const dropZones = this.data.question?.task?.dropZones || [];
                    const elements = this.data.question?.task?.elements || [];
                    const canvasSize = this.data.question?.settings?.size || { width: 800, height: 600 };

                    // 1. DESSIN DE LA ZONE DE DÉPÔT
                    if (bgObj && bgObj.path) {
                        // --- MODE IMAGE DE FOND (Schéma) ---
                        const bgData = await this.getImageFromZip(bgObj.path);
                        if (bgData) {
                            const maxImgW = PAGE_W - (MARGIN * 2);
                            const maxImgH = 150; 
                            const scale = Math.min(maxImgW / bgData.w, maxImgH / bgData.h);
                            const finalW = bgData.w * scale;
                            const finalH = bgData.h * scale;
                            const finalX = MARGIN + (maxImgW - finalW) / 2;

                            doc.addImage(bgData.data, bgData.format, finalX, yPos, finalW, finalH);

                            dropZones.forEach((z, idx) => {
                                const zX = finalX + (z.x / 100) * finalW;
                                const zY = yPos + (z.y / 100) * finalH;
                                const zW = ((z.width * 16) / canvasSize.width) * finalW;
                                const zH = ((z.height * 16) / canvasSize.height) * finalH;
                                
                                if (isCorrection) {
                                    doc.setDrawColor(34, 197, 94); doc.setLineWidth(0.6); doc.setFillColor(240, 253, 244); 
                                    doc.rect(zX, zY, zW, zH, 'FD');
                                    
                                    // 🌟 CORRECTION ICI : On interroge les vraies réponses attendues
                                    const correctIds = z.correctElements || [];
                                    const els = correctIds.map(id => elements[parseInt(id, 10)]).filter(Boolean);
                                    let currentEY = zY + 2; 
                                    
                                    els.forEach(el => {
                                        if (el.type?.library?.startsWith('H5P.AdvancedText')) {
                                            const textContent = this.stripHtml(el.type.params?.text || "");
                                            doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(21, 128, 61);
                                            const splitText = doc.splitTextToSize(textContent, zW - 4);
                                            const hBox = (splitText.length * 3.5) + 3;
                                            
                                            doc.setFillColor(255, 255, 255);
                                            doc.rect(zX + 1, currentEY, zW - 2, hBox, 'F');
                                            doc.text(splitText, zX + zW/2, currentEY + (hBox / 2), { align: 'center', baseline: 'middle' });
                                            currentEY += hBox + 2;
                                        } 
                                    });
                                } else {
                                    doc.setDrawColor(59, 130, 246); doc.setLineWidth(0.5); doc.setLineDash([2, 2], 0);
                                    doc.setFillColor(255, 255, 255);
                                    doc.rect(zX, zY, zW, zH, 'FD');
                                }
                            });
                            doc.setLineDash([]);
                            yPos += finalH + 15;
                        }
                    } else {
                        // --- MODE TABLEAU ---
                        const nbZones = Math.max(1, dropZones.length);
                        const tableW = PAGE_W - (MARGIN * 2);
                        const gap = 4;
                        const colW = (tableW - (gap * (nbZones - 1))) / nbZones;
                        const rowH = 60;

                        dropZones.forEach((z, idx) => {
                            const x = MARGIN + idx * (colW + gap);
                            
                            // En-tête
                            if (isCorrection) doc.setFillColor(34, 197, 94); 
                            else doc.setFillColor(226, 232, 240); 
                            doc.rect(x, yPos, colW, 10, 'F');
                        
                            doc.setFont("helvetica", "bold"); doc.setFontSize(10); 
                            if (isCorrection) doc.setTextColor(255, 255, 255);
                            else doc.setTextColor(30, 41, 59);
                            let label = this.stripHtml(z.label || `Zone ${idx + 1}`);
                            if (label.length > 20) label = label.substring(0, 18) + '...';
                            doc.text(label, x + (colW / 2), yPos + 6.5, { align: 'center' });

                            // Boîte de dépôt
                            if (isCorrection) {
                                doc.setDrawColor(34, 197, 94); doc.setLineWidth(0.5); doc.setFillColor(240, 253, 244);
                            } else {
                                doc.setDrawColor(200); doc.setLineWidth(0.3); doc.setFillColor(250, 250, 250);
                            }
                            doc.rect(x, yPos + 10, colW, rowH, 'FD');

                            if (isCorrection) {
                                // 🌟 CORRECTION ICI AUSSI
                                const correctIds = z.correctElements || [];
                                const els = correctIds.map(id => elements[parseInt(id, 10)]).filter(Boolean);
                                let currentEY = yPos + 14;

                                els.forEach(el => {
                                    if (el.type?.library?.startsWith('H5P.AdvancedText')) {
                                        const textContent = this.stripHtml(el.type.params?.text || "");
                                        doc.setFillColor(255, 255, 255); doc.setDrawColor(22, 163, 74); doc.setLineWidth(0.3);
                                        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(21, 128, 61);
                                        
                                        const splitText = doc.splitTextToSize(textContent, colW - 8);
                                        const hBox = (splitText.length * 4.5) + 4;
                                        
                                        doc.rect(x + 4, currentEY, colW - 8, hBox, 'FD');
                                        doc.text(splitText, x + (colW / 2), currentEY + (hBox / 2), { align: 'center', baseline: 'middle' });
                                        currentEY += hBox + 4;
                                    } 
                                });
                            }
                        });
                        yPos += 10 + rowH + 15;
                    }

                    // 2. IMPRESSION DES ÉTIQUETTES (Uniquement Fiche Élève)
                    if (!isCorrection) {
                        if (yPos > PAGE_H - 40) { doc.addPage(); yPos = MARGIN; }

                        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(15, 23, 42);
                        doc.text("Étiquettes à découper :", MARGIN, yPos);
                        yPos += 10;

                        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
                        doc.setLineWidth(0.4); doc.setDrawColor(148, 163, 184); doc.setLineDash([2, 2], 0); 

                        const labelHeight = 22; const paddingX = 8; const gapX = 5; const gapY = 5;
                        const maxRight = PAGE_W - MARGIN;
                        let currentX = MARGIN; let currentY = yPos;

                        const elementsMix = [...elements].sort(() => Math.random() - 0.5);

                        for (const el of elementsMix) {
                            let labelWidth = 40;
                            let textContent = "";
                            let imgData = null;

                            if (el.type?.library?.startsWith('H5P.Image')) {
                                labelWidth = 30;
                                imgData = await this.getImageFromZip(el.type.params?.file?.path);
                            } else {
                                textContent = this.stripHtml(el.type?.params?.text || "Étiquette");
                                labelWidth = doc.getTextWidth(textContent) + (paddingX * 2);
                            }

                            if (currentX + labelWidth > maxRight) {
                                currentX = MARGIN; currentY += labelHeight + gapY;
                                if (currentY + labelHeight > PAGE_H - MARGIN) {
                                    doc.addPage(); currentY = MARGIN;
                                    doc.setDrawColor(148, 163, 184); doc.setLineWidth(0.4); doc.setLineDash([2, 2], 0);
                                }
                            }

                            doc.setFillColor(248, 250, 252);
                            doc.rect(currentX, currentY, labelWidth, labelHeight, 'FD');

                            if (imgData) {
                                const maxW = labelWidth - 4; const maxH = labelHeight - 4;
                                const scale = Math.min(maxW / imgData.w, maxH / imgData.h);
                                const fw = imgData.w * scale; const fh = imgData.h * scale;
                                const fx = currentX + (labelWidth - fw) / 2; const fy = currentY + (labelHeight - fh) / 2;
                                doc.addImage(imgData.data, imgData.format, fx, fy, fw, fh);
                            } else {
                                doc.setTextColor(30, 41, 59);
                                doc.text(textContent, currentX + (labelWidth / 2), currentY + (labelHeight / 2) + 1.5, { align: 'center', baseline: 'middle' });
                            }

                            currentX += labelWidth + gapX;
                        }
                        doc.setLineDash([]);
                    }
                };

                // Exécution
                await renderDragQuestionPage(false); 
                doc.addPage(); yPos = MARGIN;        
                await renderDragQuestionPage(true);  

	            return doc.output('blob');
	        }
            
// --- INTERACTIVE VIDEO ---
            else if (this.library.startsWith('H5P.InteractiveVideo')) {
                // Chargement dynamique de QRCode si non présent
                if (!window.QRCode) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = new URL('../../vendor/qrcodejs/qrcode.min.js', import.meta.url).href;
                        script.onload = () => resolve(true);
                        script.onerror = () => reject(new Error("Impossible de charger QRCode.js"));
                        document.head.appendChild(script);
                    });
                }
                
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                const PAGE_W = 210; const PAGE_H = 297; const MARGIN = 15;
                let yPos = MARGIN;

                const checkPageBreak = (neededHeight) => {
                    if (yPos + neededHeight > PAGE_H - MARGIN) {
                        doc.addPage();
                        yPos = MARGIN;
                    }
                };

                const cleanTextForPdf = (str) => {
                    if (!str) return '';
                    let s = str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''); // Emojis
                    s = s.replace(/[\u2011\u2012\u2013\u2014]/g, '-'); // Tirets bizarres
                    s = s.replace(/[\u00A0\u202F\u200B]/g, ' '); // Espaces insécables
                    s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
                    return this.stripHtml(s).trim();
                };

                const sec2ts = (s) => {
                    const t = Math.round(s);
                    return `${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toString().padStart(2,'0')}`;
                };

                let rawUrl = this.data.interactiveVideo?.video?.files?.[0]?.path || "";
                let cleanUrl = rawUrl;
                if (cleanUrl.includes('proxy/stream?url=')) {
                    const match = cleanUrl.match(/[?&]url=([^&]+)/);
                    if (match) cleanUrl = decodeURIComponent(match[1]);
                }

                // 🌟 NOUVEAU : Reconstitution intelligente de l URL finale
				// 🌟 NOUVEAU : Reconstitution intelligente de l URL finale pointant vers le dossier 'ia'
                let urlForLink = cleanUrl;
                let basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
                if (basePath.includes('/outils')) {
                    basePath = basePath.split('/outils')[0] + '/ia';
                }
                const HAPI_PLAYER_BASE_URL = `${window.location.origin}${basePath}/player.html`;
                const ytMatch = cleanUrl.match(/(?:youtube(?:-nocookie)?\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
                
                const titreFichier = this.title || "Fiche Vidéo Interactive";

                if (ytMatch && ytMatch[1]) {
                    // YouTube : Redirection vers le lecteur no-cookie HAPI
                    urlForLink = `${HAPI_PLAYER_BASE_URL}#${ytMatch[1]}`;
                } else if (cleanUrl.includes('podeduc.apps.education.fr')) {
                    // PodEduc : Reconstitution du slug via le nom du fichier
                    const podEducIdMatch = cleanUrl.match(/\/(\d+)\/[^\/]+\.mp4$/);
                    if (podEducIdMatch && podEducIdMatch[1]) {
                        const videoId = podEducIdMatch[1];
                        const slugRegex = new RegExp(`(${videoId}[a-zA-Z0-9_-]+)`, 'i');
                        const slugMatch = titreFichier.match(slugRegex);
                        if (slugMatch) {
                            urlForLink = `https://podeduc.apps.education.fr/video/${slugMatch[1]}/`;
                        }
                    }
                }

                // 1. EN-TÊTE
                doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(30, 58, 138); 
                const splitTitle = doc.splitTextToSize(cleanTextForPdf(titreFichier), PAGE_W - (MARGIN * 2) - 40);
                doc.text(splitTitle, MARGIN, yPos + 5);
                
                let qrDataUrl = null;
                try {
                    qrDataUrl = await QRCode.toDataURL(urlForLink, { margin: 1, width: 150 });
                    doc.addImage(qrDataUrl, 'PNG', PAGE_W - MARGIN - 30, yPos - 5, 30, 30);
                    doc.link(PAGE_W - MARGIN - 30, yPos - 5, 30, 30, { url: urlForLink });
                    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100);
                    doc.text("Flashez ou cliquez", PAGE_W - MARGIN - 15, yPos + 28, { align: 'center' });
                    doc.text("pour voir la vidéo", PAGE_W - MARGIN - 15, yPos + 32, { align: 'center' });
                } catch(e) { }

                yPos += Math.max((splitTitle.length * 8) + 10, 40);
                doc.setDrawColor(200); doc.setLineWidth(0.5);
                doc.line(MARGIN, yPos, PAGE_W - MARGIN, yPos);
                yPos += 10;

                // 2. PRISE DE NOTES
                doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(30, 58, 138); 
                doc.text("Prise de notes :", MARGIN, yPos); 
                yPos += 12;
                doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
                for (let i = 0; i < 8; i++) {
                    doc.line(MARGIN, yPos, PAGE_W - MARGIN, yPos); yPos += 10;
                }
                yPos += 8;

                // 3. RECUPERATION DES INTERACTIONS
                let interactions = [];
                if (this.data.interactiveVideo?.assets?.interactions) {
                    interactions = JSON.parse(JSON.stringify(this.data.interactiveVideo.assets.interactions));
                }
                
                if (this.data.interactiveVideo?.summary?.task) {
                    interactions.push({
                        action: this.data.interactiveVideo.summary.task,
                        duration: { from: 999999 }, 
                        isNativeSummary: true
                    });
                }
                
                interactions.sort((a, b) => {
                    const tA = (a.duration && a.duration.from !== undefined) ? Number(a.duration.from) : 0;
                    const tB = (b.duration && b.duration.from !== undefined) ? Number(b.duration.from) : 0;
                    return tA - tB;
                });

                const renderFiche = (isCorrection) => {
                    if (interactions.length === 0) {
                        doc.setFont("helvetica", "italic"); doc.setFontSize(12); doc.setTextColor(100);
                        doc.text("Aucune question interactive configurée pour cette vidéo.", MARGIN, yPos);
                        return;
                    }

                    interactions.forEach((item, index) => {
                        if (!item.action) return;
                        const lib = item.action.library || "";
                        const p = item.action.params || {};
                        
                        const ts = item.isNativeSummary ? "Fin" : sec2ts(item.duration?.from || 0);
                        
                        checkPageBreak(30);

                        if (!isCorrection) {
                            doc.setFillColor(241, 245, 249);
                            doc.rect(MARGIN, yPos, 22, 8, 'F');
                            doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(3, 105, 161);
                            doc.text(ts, MARGIN + 11, yPos + 5.5, { align: 'center' });
                        }

                        let qText = "Activité";
                        if (lib.includes('MultiChoice') || lib.includes('TrueFalse')) qText = p.question;
                        else if (lib.includes('Blanks')) qText = p.text; 
                        else if (lib.includes('DragText') || lib.includes('MarkTheWords')) qText = p.taskDescription;
                        else if (lib.includes('Summary')) qText = p.intro || "Résumé (Cochez l'affirmation exacte)";

                        qText = cleanTextForPdf(qText);

                        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(15, 23, 42);
                        let qLabel = isCorrection ? `Q${index + 1}. [${ts}] ${qText}` : `Q${index + 1}. ${qText}`;
                        let labelX = isCorrection ? MARGIN : MARGIN + 26;
                        let textW = isCorrection ? PAGE_W - MARGIN - 10 : PAGE_W - MARGIN - 40;
                        
                        const splitQ = doc.splitTextToSize(qLabel, textW);
                        if (isCorrection) {
                            doc.text(splitQ, labelX, yPos);
                            yPos += (splitQ.length * 6) + 4;
                        } else {
                            doc.text(splitQ, labelX, yPos + 5.5);
                            yPos += (splitQ.length * 6) + 6;
                        }

                        doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(51, 65, 85);
                        doc.setLineWidth(0.3); doc.setDrawColor(100);

                        // --- QCM ---
                        if (lib.includes('MultiChoice')) {
                            const answers = p.answers || [];
                            answers.forEach((ans) => {
                                checkPageBreak(10);
                                const optText = cleanTextForPdf(ans.text);
                                
                                if (isCorrection) {
                                    if (ans.correct) {
                                        doc.setDrawColor(21, 128, 61); doc.setFillColor(21, 128, 61); doc.rect(MARGIN + 10, yPos - 3, 4, 4, 'FD'); 
                                        doc.setTextColor(21, 128, 61); doc.setFont("helvetica", "bold");
                                    } else {
                                        doc.setDrawColor(100, 116, 139); doc.setFillColor(255, 255, 255); doc.rect(MARGIN + 10, yPos - 3, 4, 4, 'S'); 
                                        doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal");
                                    }
                                    const splitOpt = doc.splitTextToSize(optText, PAGE_W - MARGIN - 25);
                                    doc.text(splitOpt, MARGIN + 18, yPos);
                                    yPos += (splitOpt.length * 6) + 2;
                                } else {
                                    doc.rect(MARGIN + 26, yPos - 3, 4, 4, 'S');
                                    const splitOpt = doc.splitTextToSize(optText, PAGE_W - MARGIN - 40);
                                    doc.text(splitOpt, MARGIN + 34, yPos);
                                    yPos += (splitOpt.length * 6) + 2;
                                }
                            });
                        }
                        // --- VRAI/FAUX ---
                        else if (lib.includes('TrueFalse')) {
                            checkPageBreak(10);
                            const isTrue = p.correct === "true" || p.correct === true;
                            if (isCorrection) {
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
                            } else {
                                doc.rect(MARGIN + 26, yPos - 3, 4, 4, 'S'); doc.text("Vrai", MARGIN + 34, yPos);
                                doc.rect(MARGIN + 56, yPos - 3, 4, 4, 'S'); doc.text("Faux", MARGIN + 64, yPos);
                                yPos += 10;
                            }
                        }
                        // --- TEXTE A TROUS / ETIQUETTES / CLIC MOTS ---
                        else if (lib.includes('Blanks') || lib.includes('DragText') || lib.includes('MarkTheWords')) {
                            let rawText = "";
                            if (lib.includes('Blanks')) {
                                rawText = p.questions?.[0] || "";
                            } else {
                                rawText = p.textField || "";
                            }
                            
                            let cleanText = cleanTextForPdf(rawText);
                            
                            if (isCorrection) {
                                checkPageBreak(25);
                                const textCorrected = cleanText.replace(/\*([^*]+)\*/g, " [ $1 ] ");
                                
                                doc.setTextColor(51, 65, 85); doc.setFont("helvetica", "normal");
                                const splitT = doc.splitTextToSize(textCorrected, PAGE_W - MARGIN - 20);
                                doc.text(splitT, MARGIN + 10, yPos);
                                yPos += (splitT.length * 6) + 4;
                                
                                const regex = /\*([^*]+)\*/g;
                                let match; const answers = [];
                                while ((match = regex.exec(cleanText)) !== null) {
                                    answers.push(match[1].trim());
                                }

                                if (answers.length > 0) {
                                    doc.setTextColor(21, 128, 61); doc.setFont("helvetica", "bold");
                                    const ansText = `Mots attendus : ${answers.join(', ')}`;
                                    const splitAns = doc.splitTextToSize(ansText, PAGE_W - MARGIN - 20);
                                    doc.text(splitAns, MARGIN + 10, yPos);
                                    yPos += (splitAns.length * 6) + 2;
                                } else {
                                    doc.setTextColor(220, 38, 38); doc.setFont("helvetica", "italic");
                                    const ansText = `(Attention : L'IA a oublié de mettre des *astérisques* autour des mots dans l'éditeur)`;
                                    const splitAns = doc.splitTextToSize(ansText, PAGE_W - MARGIN - 20);
                                    doc.text(splitAns, MARGIN + 10, yPos);
                                    yPos += (splitAns.length * 6) + 2;
                                }
                            } else {
                                checkPageBreak(25);
                                
                                const regex = /\*([^*]+)\*/g;
                                let match; const hiddenWords = [];
                                while ((match = regex.exec(cleanText)) !== null) {
                                    hiddenWords.push(match[1].trim());
                                }

                                if (lib.includes('MarkTheWords')) {
                                    doc.setFont("helvetica", "italic"); doc.setTextColor(100, 116, 139);
                                    doc.text("(Entourez les mots correspondants directement dans le texte ci-dessous)", MARGIN + 26, yPos);
                                    yPos += 6;

                                    let textToRead = cleanText.replace(/\*([^*]+)\*/g, "$1");
                                    doc.setFont("helvetica", "normal"); doc.setTextColor(51, 65, 85);
                                    const splitText = doc.splitTextToSize(textToRead, PAGE_W - MARGIN - 30);
                                    doc.text(splitText, MARGIN + 26, yPos);
                                    yPos += (splitText.length * 6) + 4;
                                } else {
                                    if (lib.includes('DragText') && hiddenWords.length > 0) {
                                        const shuffledWords = [...hiddenWords].sort(() => Math.random() - 0.5);
                                        doc.setFont("helvetica", "bold"); doc.setTextColor(3, 105, 161);
                                        const wordBox = `Étiquettes à placer :   [ ${shuffledWords.join(' ]    [ ')} ]`;
                                        const splitBox = doc.splitTextToSize(wordBox, PAGE_W - MARGIN - 30);
                                        doc.text(splitBox, MARGIN + 26, yPos);
                                        yPos += (splitBox.length * 6) + 4;
                                    }

                                    let textToFill = cleanText.replace(/\*([^*]+)\*/g, " .............................. ");
                                    doc.setFont("helvetica", "italic"); doc.setTextColor(51, 65, 85);
                                    const splitText = doc.splitTextToSize(textToFill, PAGE_W - MARGIN - 30);
                                    doc.text(splitText, MARGIN + 26, yPos);
                                    yPos += (splitText.length * 6) + 4;
                                }
                            }
                        }
                        // --- RESUME ---
                        else if (lib.includes('Summary')) {
                            const summaries = p.summaries || [];
                            summaries.forEach((group, gIdx) => {
                                checkPageBreak(20);
                                const statements = group.summary || [];
                                if (statements.length === 0) return;
                                
                                let options = statements.map((s, i) => ({ text: s, isCorrect: i === 0 }));
                                
                                if (isCorrection) {
                                    doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
                                    doc.text(`Séquence ${gIdx+1} :`, MARGIN + 10, yPos);
                                    yPos += 6;
                                    
                                    options.forEach(opt => {
                                        checkPageBreak(10);
                                        const cleanOpt = cleanTextForPdf(opt.text);
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
                                } else {
                                    options.sort(() => Math.random() - 0.5);
                                    options.forEach(opt => {
                                        checkPageBreak(10);
                                        doc.setDrawColor(100);
                                        doc.rect(MARGIN + 26, yPos - 3, 4, 4, 'S');
                                        const splitOpt = doc.splitTextToSize(cleanTextForPdf(opt.text), PAGE_W - MARGIN - 40);
                                        doc.text(splitOpt, MARGIN + 34, yPos);
                                        yPos += (splitOpt.length * 6) + 2;
                                    });
                                }
                                yPos += 4;
                            });
                        }
                        
                        yPos += 8;
                    });
                };

                // Exécution fiche élève
                renderFiche(false);

                // 🌟 Exécution Corrigé (Avec le QR Code cliquable inclus !)
                doc.addPage();
                yPos = MARGIN;
                doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(185, 28, 28);
                doc.text("CORRIGÉ DE L'ACTIVITÉ", MARGIN, yPos + 5);
                
                doc.setFontSize(12); doc.setTextColor(100);
                const splitCorrTitle = doc.splitTextToSize(cleanTextForPdf(titreFichier), PAGE_W - (MARGIN * 2) - 40);
                doc.text(splitCorrTitle, MARGIN, yPos + 14);
                
                if (qrDataUrl) {
                    doc.addImage(qrDataUrl, 'PNG', PAGE_W - MARGIN - 30, yPos - 5, 30, 30);
                    doc.link(PAGE_W - MARGIN - 30, yPos - 5, 30, 30, { url: urlForLink });
                    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100);
                    doc.text("Flashez ou cliquez", PAGE_W - MARGIN - 15, yPos + 28, { align: 'center' });
                    doc.text("pour voir la vidéo", PAGE_W - MARGIN - 15, yPos + 32, { align: 'center' });
                }

                yPos += Math.max(14 + (splitCorrTitle.length * 6) + 5, 40);
                
                doc.setDrawColor(200); doc.line(MARGIN, yPos, PAGE_W - MARGIN, yPos);
                yPos += 10;
                
                renderFiche(true);

                return doc.output('blob');
            }

	        throw new Error("Génération PDF non implémentée pour ce type.");
	    }

    // --- MOTEUR ODT (LOGIQUE D'ORIGINE) ---

    convertLatexToStarMath(latex) {
        let clean = latex.replace(/^\\\(/, '').replace(/\\\)$/, '').replace(/^\$\$/, '').replace(/\$\$/, '').trim();
        return clean
            .replace(/\\binom\{([^}]+)\}\{([^}]+)\}/g, 'binom {$1} {$2}')
            .replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, 'nroot{$1}{$2}')
            .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt{$1}')
            .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '{$1} over {$2}')
            .replace(/\^(\{[^}]+\}|\w)/g, (m, e) => ' sup ' + e.replace(/[{}]/g, ''))
            .replace(/_(\{[^}]+\}|\w)/g, (m, s) => ' sub ' + s.replace(/[{}]/g, ''))
            .replace(/\\int/g, ' int ').replace(/\\sum/g, ' sum ').replace(/\\times/g, ' times ')
            .replace(/\\cdot/g, ' cdot ').replace(/\\div/g, ' div ').replace(/\\pm/g, ' plusminus ')
            .replace(/\\leq/g, ' <= ').replace(/\\geq/g, ' >= ').replace(/\\neq/g, ' <> ')
            .replace(/\\approx/g, ' approx ').replace(/\\infty/g, ' infinity ')
            .replace(/\\rightarrow/g, ' rightarrow ')
            .replace(/\\text\{([^}]+)\}/g, '"$1"').replace(/\\,/g, '~').replace(/\\/g, '');
    }

    createStarMathObject(latex, objectName) {
        const starmath = this.convertLatexToStarMath(latex);
        const mathContent = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE math:math PUBLIC "-//OpenOffice.org//DTD Modified W3C MathML 1.01//EN" "math.dtd"><math:math xmlns:math="http://www.w3.org/1998/Math/MathML"><math:semantics><math:mrow/><math:annotation math:encoding="StarMath 5.0">${echapperXML(starmath)}</math:annotation></math:semantics></math:math>`;
        return { xml: `<draw:frame draw:style-name="fr1" draw:name="${objectName}" text:anchor-type="as-char" draw:z-index="0"><draw:object xlink:href="./${objectName}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`, content: mathContent, name: objectName };
    }

    traiterTexteAvecMaths(content) {
        if (!content) return "";
        const regex = /(\\\(.*?\\\)|^\$\$.*?\$\$)/gs; 
        const parts = content.split(regex);
        let xmlBody = "";
        parts.forEach(part => {
            if (part.startsWith("\\(") || part.startsWith("$$")) {
                this.mathObjectCounter++;
                const objectName = `Object${this.mathObjectCounter}`;
                const mathObj = this.createStarMathObject(part, objectName);
                if (mathObj) { this.mathObjects.push(mathObj); xmlBody += mathObj.xml; } 
                else { xmlBody += `<text:span text:style-name="SourceText">[${echapperXML(part)}]</text:span>`; }
            } else {
                xmlBody += echapperXML(part.replace(/\\text\{([^{}]*)\}/g, '$1'));
            }
        });
        return xmlBody;
    }

    renderMultiChoice(p){let s='',c='';const q=this.traiterTexteAvecMaths(this.stripHtml(p.question));const a=p.answers||[];s+=`<text:p text:style-name="Standard">${q}</text:p><text:list>`;a.forEach(x=>s+=`<text:list-item><text:p text:style-name="Standard">☐ ${this.traiterTexteAvecMaths(this.stripHtml(x.text))}</text:p></text:list-item>`);s+=`</text:list>`;c+=`<text:p text:style-name="Standard" fo:font-style="italic">${q}</text:p><text:list>`;a.forEach(x=>c+=`<text:list-item><text:p text:style-name="Standard">${x.correct?'☒':'☐'} ${this.traiterTexteAvecMaths(this.stripHtml(x.text))}</text:p></text:list-item>`);c+=`</text:list>`;return{student:s,correction:c};}
    renderTrueFalse(p){let s='',c='';const q=this.traiterTexteAvecMaths(this.stripHtml(p.question));const t=p.correct==="true";s+=`<text:p text:style-name="StatementBold">${q}</text:p><text:list><text:list-item><text:p>☐ Vrai</text:p></text:list-item><text:list-item><text:p>☐ Faux</text:p></text:list-item></text:list>`;c+=`<text:p text:style-name="StatementBold">${q}</text:p><text:list><text:list-item><text:p>${t?'☒':'☐'} Vrai</text:p></text:list-item><text:list-item><text:p>${!t?'☒':'☐'} Faux</text:p></text:list-item></text:list>`;return{student:s,correction:c};}
    renderDragText(p,t='drag'){let s='',c='';const raw=this.stripHtml(p.textField||"");const l=raw.split('\n');let wb=[];l.forEach(line=>{const partsS=line.split('*');let ls="";partsS.forEach((pt,i)=>{if(i%2===1){const cw=pt.split(':')[0];wb.push(cw);if(t==='mark')ls+=this.traiterTexteAvecMaths(cw);else ls+=`<text:span text:style-name="BlankSpace">_______</text:span>`;}else{ls+=this.traiterTexteAvecMaths(pt);}});s+=`<text:p text:style-name="Standard">${ls}</text:p>`;const partsC=line.split('*');let lc="";partsC.forEach((pt,i)=>{if(i%2===1){const cw=pt.split(':')[0];lc+=`<text:span text:style-name="CorrectAnswerStyle">${this.traiterTexteAvecMaths(cw)}</text:span>`;}else{lc+=this.traiterTexteAvecMaths(pt);}});c+=`<text:p text:style-name="Standard">${lc}</text:p>`;});if(t==='drag'){wb.sort(()=>Math.random()-0.5);s=`<text:p text:style-name="ParagraphBox">${wb.join(' | ')}</text:p><text:p/>`+s;}return{student:s,correction:c};}
    renderSortParagraphs(p){let s='',c='';const ps=p.paragraphs||[];const txt=`<text:p text:style-name="Standard" fo:font-style="italic">${echapperXML(this.stripHtml(p.taskDescription||"Ordonnez"))}</text:p>`;const sh=[...ps];for(let i=sh.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[sh[i],sh[j]]=[sh[j],sh[i]];}s+=txt+`<text:p text:style-name="Standard"/>`;sh.forEach(x=>{s+=`<text:p text:style-name="ParagraphBox">${this.traiterTexteAvecMaths(this.stripHtml(x))}</text:p><text:p text:style-name="Standard" fo:font-size="6pt"/>`;});c+=txt+`<text:p text:style-name="Standard"/>`;ps.forEach((x,i)=>{c+=`<text:p text:style-name="Standard"><strong>${i+1}.</strong></text:p><text:p text:style-name="CorrectBox">${this.traiterTexteAvecMaths(this.stripHtml(x))}</text:p>`;});return{student:s,correction:c};}
    renderSummary(p){let s='',c='';const intro=p.intro?`<text:p text:style-name="Standard" fo:font-style="italic">${echapperXML(this.stripHtml(p.intro))}</text:p>`:'';s+=intro+`<text:p/>`;c+=intro+`<text:p/>`;const sums=p.summaries||[];sums.forEach((g,i)=>{const stmts=g.summary||[];if(stmts.length===0)return;const corr=stmts[0];const sh=[...stmts].sort(()=>Math.random()-0.5);const ti=`<text:h text:style-name="Heading_2">Groupe ${i+1}</text:h>`;s+=ti+`<table:table table:name="SumT_${i}" table:style-name="SummaryGroupTable"><table:table-column table:style-name="SummaryGroupCol"/><table:table-row><table:table-cell table:style-name="SummaryGroupCell" office:value-type="string">`;sh.forEach(x=>{s+=`<text:p text:style-name="Standard">☐ ${this.traiterTexteAvecMaths(this.stripHtml(x))}</text:p><text:p text:style-name="Standard" fo:font-size="6pt"/>`;});s+=`</table:table-cell></table:table-row></table:table><text:p/>`;c+=ti+`<table:table table:name="SumTC_${i}" table:style-name="SummaryGroupTable"><table:table-column table:style-name="SummaryGroupCol"/><table:table-row><table:table-cell table:style-name="SummaryGroupCell" office:value-type="string">`;sh.forEach(x=>{const isC=(x===corr);if(isC)c+=`<text:p text:style-name="Standard">☒ <text:span text:style-name="CorrectAnswerStyle">${this.traiterTexteAvecMaths(this.stripHtml(x))}</text:span></text:p>`;else c+=`<text:p text:style-name="Standard">☐ ${this.traiterTexteAvecMaths(this.stripHtml(x))}</text:p>`;c+=`<text:p text:style-name="Standard" fo:font-size="6pt"/>`;});c+=`</table:table-cell></table:table-row></table:table><text:p/>`;});return{student:s,correction:c};}
    renderAccordion(p){let c='';const pans=p.panels||[];c+=`<text:p text:style-name="Standard" fo:font-style="italic">Glossaire</text:p><text:p/>`;pans.forEach(pn=>{const ti=pn.title||"";let df="";if(typeof pn.content==='string')df=pn.content;else if(pn.content?.params?.text)df=pn.content.params.text;c+=`<text:h text:style-name="ConceptTitle" text:outline-level="2">${echapperXML(this.stripHtml(ti))}</text:h><text:p text:style-name="DefinitionBox">${this.traiterTexteAvecMaths(this.stripHtml(df))}</text:p><text:p/>`;});return{student:c,correction:""};}
	renderAdvancedBlanks(p) {
	        let s = '', c = '';
        
	        // 🌟 La clé était là : tout est caché dans l'objet "content" !
	        const contentBlock = p.content || p; 
        
	        // 1. On récupère la consigne
	        let instructionStr = contentBlock.task || contentBlock.consignes || contentBlock.taskDescription || "Complétez les blancs";
        
	        const instruction = this.stripHtml(instructionStr);
	        if (instruction) {
	            const intro = `<text:p text:style-name="Standard" fo:font-style="italic">${echapperXML(instruction)}</text:p><text:p/>`;
	            s += intro;
	            c += intro;
	        }

	        // 2. On récupère le texte avec les underscores
	        let rawHtml = contentBlock.blanksText || contentBlock.texteHtml || contentBlock.template || "";

	        let raw = rawHtml.replace(/<br\s*\/?>/gi, '\n');
	        raw = raw.replace(/<input[^>]*>/gi, '___________');
	        raw = raw.replace(/<span[^>]*class="[^"]*blank[^"]*"[^>]*><\/span>/gi, '___________');

	        raw = this.stripHtml(raw);
        
	        // 3. On récupère la liste des bonnes réponses
	        const sourceArray = contentBlock.blanksList || contentBlock.blanks || [];
	        const blanks = [...sourceArray];
        
	        const lines = raw.split('\n');
        
	        lines.forEach(line => {
	            if (!line.trim()) return;
	            const parts = line.split(/_{3,}/); 
            
	            let studentXml = "";
	            let correctionXml = "";
            
	            parts.forEach((pt, i) => {
	                studentXml += this.traiterTexteAvecMaths(pt);
	                correctionXml += this.traiterTexteAvecMaths(pt);
                
	                // Si on n'est pas au dernier morceau, c'est qu'il y a un trou !
	                if (i < parts.length - 1) {
	                    studentXml += `<text:span text:style-name="BlankSpace">_________</text:span>`;
	                    if (blanks.length > 0) {
	                        const currentBlank = blanks.shift();
	                        const mainAnswer = currentBlank.correctAnswerText || currentBlank.text || "";
	                        correctionXml += `<text:span text:style-name="CorrectAnswerStyle">${this.traiterTexteAvecMaths(mainAnswer)}</text:span>`;
	                    } else {
	                        correctionXml += `<text:span text:style-name="CorrectAnswerStyle">?????</text:span>`;
	                    }
	                }
	            });
            
	            s += `<text:p text:style-name="Standard">${studentXml}</text:p>`;
	            c += `<text:p text:style-name="Standard">${correctionXml}</text:p>`;
	        });

	        return { student: s, correction: c };
	    }



    async generateODT() {
        this.mathObjectCounter = 0;
        this.mathObjects = [];
        let studentBody = '', correctionBody = '';
        
        const isAccordion = this.library.includes('Accordion');
        
        const customStyles = `<style:style style:name="CorrectAnswerStyle" style:family="text"><style:text-properties fo:color="#008000" fo:font-weight="bold"/></style:style><style:style style:name="BlankSpace" style:family="text"><style:text-properties fo:font-weight="bold" fo:color="#555555"/></style:style><style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:break-before="page"/></style:style><style:style style:name="StatementBold" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-weight="bold"/></style:style><style:style style:name="ParagraphBox" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:border="0.05pt solid #000000" fo:padding="0.2cm" fo:margin-bottom="0.2cm" fo:background-color="#f9f9f9"/></style:style><style:style style:name="CorrectBox" style:family="paragraph" style:parent-style-name="ParagraphBox"><style:paragraph-properties fo:border="0.05pt solid #008000" fo:background-color="#e8f5e9"/></style:style><style:style style:name="ConceptTitle" style:family="paragraph" style:parent-style-name="Heading_2"><style:text-properties fo:font-size="14pt" fo:font-weight="bold" fo:color="#2c3e50"/><style:paragraph-properties fo:margin-top="0.4cm" fo:margin-bottom="0.2cm"/></style:style><style:style style:name="DefinitionBox" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:border="0.05pt solid #cccccc" fo:padding="0.2cm" fo:background-color="#fcfcfc" fo:margin-bottom="0.2cm"/></style:style>`;
        const automaticStyles = `<style:style style:name="fr1" style:family="graphic" style:parent-style-name="Frame"><style:graphic-properties style:vertical-pos="middle" style:vertical-rel="text" fo:background-color="transparent" draw:stroke="none" draw:fill="none" fo:padding="0cm" fo:border="none" style:wrap="as-char" style:run-through="foreground"/></style:style><style:style style:name="TableGrid" style:family="table"><style:table-properties table:align="center"/></style:style><style:style style:name="GridCol" style:family="table-column"><style:table-column-properties style:column-width="0.9cm"/></style:style><style:style style:name="GridRow" style:family="table-row"><style:table-row-properties style:row-height="0.9cm"/></style:style><style:style style:name="SummaryGroupTable" style:family="table"><style:table-properties style:width="17cm" table:align="center"/></style:style><style:style style:name="SummaryGroupCol" style:family="table-column"><style:table-column-properties style:column-width="17cm"/></style:style><style:style style:name="SummaryGroupCell" style:family="table-cell"><style:table-cell-properties fo:border="0.05pt solid #888888" fo:padding="0.3cm" fo:background-color="#ffffff"/></style:style><style:style style:name="CellBorder" style:family="table-cell"><style:table-cell-properties fo:border="0.05pt solid #000000" fo:padding="0cm" style:vertical-align="middle"/></style:style><style:style style:name="SolvedCell" style:family="table-cell"><style:table-cell-properties fo:border="0.05pt solid #000000" fo:padding="0cm" fo:background-color="#d4edda" style:vertical-align="middle"/></style:style><style:style style:name="CrosswordCell" style:family="table-cell"><style:table-cell-properties fo:border="0.05pt solid #000000" fo:padding="0cm" style:vertical-align="top"/></style:style><style:style style:name="CrosswordBlackCell" style:family="table-cell"><style:table-cell-properties fo:border="0.05pt solid #000000" fo:background-color="#e0e0e0"/></style:style><style:style style:name="CellContent" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="center" fo:margin="0cm" fo:line-height="100%"/><style:text-properties fo:font-weight="bold" fo:font-size="12pt"/></style:style><style:style style:name="CellContentSolved" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="center" fo:margin="0cm" fo:line-height="100%"/><style:text-properties fo:font-weight="bold" fo:font-size="12pt" fo:color="#008000"/></style:style><style:style style:name="SmallNumber" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-top="0.05cm" fo:margin-left="0.05cm" fo:margin-bottom="0cm" fo:line-height="100%"/><style:text-properties fo:font-size="7pt" fo:font-weight="bold" fo:color="#555555"/></style:style>`;

        studentBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(this.title)}</text:h><text:p text:style-name="Standard"/>`;
		// ✅ MODIFICATION ICI : Ajout du titre devant "CORRECTION"
		        if (!isAccordion) {
		            correctionBody += `<text:h text:style-name="Heading_1" text:outline-level="1">${echapperXML(this.title)} - CORRECTION</text:h><text:p 					text:style-name="Standard"/>`;
		        }
        const processQuestion = (lib, params, index = null) => {
            let res = { student: '', correction: '' };
            if (index !== null) {
                const prefix = `<text:h text:style-name="Heading_2">Question ${index}</text:h>`;
                res.student += prefix; res.correction += prefix;
            }
            if (lib.includes('MultiChoice')) { const r=this.renderMultiChoice(params); res.student+=r.student; res.correction+=r.correction; }
            else if (lib.includes('TrueFalse')) { const r=this.renderTrueFalse(params); res.student+=r.student; res.correction+=r.correction; }
            else if (lib.includes('DragText')||lib.includes('MarkTheWords')) { const type=lib.includes('Mark')?'mark':'drag'; const r=this.renderDragText(params, type); res.student+=r.student; res.correction+=r.correction; }
            else if (lib.includes('SortParagraphs')) { const r=this.renderSortParagraphs(params); res.student+=r.student; res.correction+=r.correction; }
            else if (lib.includes('Summary')) { const r=this.renderSummary(params); res.student+=r.student; res.correction+=r.correction; }
            else if (lib.includes('Accordion')) { const r=this.renderAccordion(params); res.student+=r.student; res.correction+=r.correction; }
            else if (lib.includes('FindTheWords')) { 
                const rawList = (typeof params.wordList === 'string') ? params.wordList.split(',') : (params.wordList || []);
                const cleanList = rawList.map(w => this.stripHtml(w).trim()).filter(w => w);
                const generator = new WordSearchGenerator(cleanList);
                generator.generate();
                const consigne = `<text:p text:style-name="Standard" fo:font-style="italic">${echapperXML(this.stripHtml(params.taskDescription || "Retrouvez les mots"))}</text:p>`;
                const listXML = `<text:p text:style-name="Standard"><strong>Mots : </strong>${echapperXML(cleanList.join(' - '))}</text:p>`;
                res.student += consigne + `<text:p/>` + createWordSearchGridXML(generator, false) + `<text:p/>` + listXML;
                res.correction += consigne + `<text:p/>` + createWordSearchGridXML(generator, true) + `<text:p/>` + listXML;
            }
			else if (lib.includes('AdvancedBlanks')) { const r=this.renderAdvancedBlanks(params); res.student+=r.student; res.correction+=r.correction; }
            else if (lib.includes('Crossword')) {
                const words = params.words || [];
                const generator = new CrosswordGenerator(words);
                const gridData = generator.generate();
                const consigne = `<text:p text:style-name="Standard" fo:font-style="italic">${echapperXML(this.stripHtml(params.taskDescription || "Remplissez la grille"))}</text:p>`;
                let defs = ''; 
                const sortedWords = gridData.words.sort((a,b) => a.number - b.number);
                const h = sortedWords.filter(w=>w.dir==='horizontal'); const v=sortedWords.filter(w=>w.dir==='vertical');
                if(h.length>0){ defs+=`<text:h text:style-name="Heading_2">Horizontalement</text:h><text:list>`; h.forEach(w=>{defs+=`<text:list-item><text:p>${w.number}. ${echapperXML(this.stripHtml(w.clue))}</text:p></text:list-item>`;}); defs+=`</text:list>`;}
                if(v.length>0){ defs+=`<text:h text:style-name="Heading_2">Verticalement</text:h><text:list>`; v.forEach(w=>{defs+=`<text:list-item><text:p>${w.number}. ${echapperXML(this.stripHtml(w.clue))}</text:p></text:list-item>`;}); defs+=`</text:list>`;}
                res.student += consigne + `<text:p/>` + createCrosswordGridXML(gridData, false) + `<text:p/>` + defs;
                res.correction += consigne + `<text:p/>` + createCrosswordGridXML(gridData, true) + `<text:p/>` + defs;
            }
            res.student += `<text:p/>`; res.correction += `<text:p/>`;
            return res;
        };

        if (this.library.startsWith('H5P.QuestionSet')) {
            const questions = this.data.questions || [];
            questions.forEach((q, idx) => {
                const result = processQuestion(q.library, q.params, idx + 1);
                studentBody += result.student; correctionBody += result.correction;
            });
        } else {
            const result = processQuestion(this.library, this.data);
            studentBody += result.student; correctionBody += result.correction;
        }

        let contentBody = studentBody;
        if (!isAccordion) contentBody += `<text:p text:style-name="PageBreak"/>` + correctionBody;

        const zip = createBaseODT();
        const manifestEntries = [];
        this.mathObjects.forEach(m => {
            zip.file(m.name + "/content.xml", m.content);
            zip.file(m.name + "/", null, { dir: true });
            manifestEntries.push({ path: m.name + "/", type: "application/vnd.oasis.opendocument.formula" });
            manifestEntries.push({ path: m.name + "/content.xml", type: "text/xml" });
        });
        zip.file("META-INF/manifest.xml", generateManifestXML(manifestEntries));
        zip.file("styles.xml", generateStylesXML(customStyles));
        zip.file("content.xml", wrapContentXML(contentBody, automaticStyles));
        return await zip.generateAsync({ type: "blob" });
    }
}

// =========================================================
// CLASSES UTILITAIRES (Crossword & WordSearch)
// =========================================================
class WordSearchGenerator {
    constructor(words, size = 15) {
        this.size = size;
        this.words = words.map(w => w.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z]/g, ''));
        this.grid = Array(size).fill(null).map(() => Array(size).fill(''));
        this.solution = Array(size).fill(null).map(() => Array(size).fill(false));
        this.directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }];
    }
    generate() {
        this.words.sort((a, b) => b.length - a.length);
        for (let word of this.words) {
            let placed = false, attempts = 0;
            while (!placed && attempts < 200) {
                const dir = this.directions[Math.floor(Math.random() * this.directions.length)];
                const startX = Math.floor(Math.random() * this.size), startY = Math.floor(Math.random() * this.size);
                if (this.canPlace(word, startX, startY, dir)) { this.place(word, startX, startY, dir); placed = true; }
                attempts++;
            }
        }
        this.fillEmpty();
    }
    canPlace(word, x, y, dir) {
        for (let i = 0; i < word.length; i++) {
            const nx = x + i * dir.x, ny = y + i * dir.y;
            if (nx < 0 || nx >= this.size || ny < 0 || ny >= this.size) return false;
            if (this.grid[ny][nx] !== '' && this.grid[ny][nx] !== word[i]) return false;
        }
        return true;
    }
    place(word, x, y, dir) {
        for (let i = 0; i < word.length; i++) {
            const nx = x + i * dir.x, ny = y + i * dir.y;
            this.grid[ny][nx] = word[i]; this.solution[ny][nx] = true;
        }
    }
    fillEmpty() {
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                if (this.grid[y][x] === '') this.grid[y][x] = letters[Math.floor(Math.random() * letters.length)];
            }
        }
    }
}

function createWordSearchGridXML(generator, showSolution) {
    const size = generator.size;
    let xml = `<table:table table:name="WordSearchGrid" table:style-name="TableGrid">`;
    xml += `<table:table-column table:style-name="GridCol" table:number-columns-repeated="${size}"/>`;
    for (let y = 0; y < size; y++) {
        xml += `<table:table-row table:style-name="GridRow">`;
        for (let x = 0; x < size; x++) {
            const letter = generator.grid[y][x]; const isSolution = generator.solution[y][x];
            const styleName = (showSolution && isSolution) ? "SolvedCell" : "CellBorder";
            xml += `<table:table-cell table:style-name="${styleName}" office:value-type="string"><text:p text:style-name="CellContent">${letter}</text:p></table:table-cell>`;
        }
        xml += `</table:table-row>`;
    }
    xml += `</table:table>`;
    return xml;
}

class CrosswordGenerator {
    constructor(wordList) {
        this.originalData = wordList.map(w => ({ original: w.answer, clue: w.clue, clean: w.answer.toUpperCase().replace(/[^A-Z]/g, '') }));
        this.gridSize = 25; 
    }
    generate() {
        let bestResult = null; let maxPlaced = -1;
        for (let i = 0; i < 20; i++) {
            const result = this.computeSingleGrid();
            if (result.words.length > maxPlaced) { maxPlaced = result.words.length; bestResult = result; }
        }
        return bestResult;
    }
    computeSingleGrid() {
        let grid = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(null));
        let placedWords = [];
        let wordList = [...this.originalData].sort((a, b) => b.clean.length - a.clean.length);
        const first = wordList[0];
        const startX = Math.floor(this.gridSize / 2) - Math.floor(first.clean.length / 2);
        const startY = Math.floor(this.gridSize / 2);
        this.placeWordInGrid(grid, first, startX, startY, 'horizontal');
        placedWords.push({ ...first, x: startX, y: startY, dir: 'horizontal', number: 1 });
        wordList.shift();
        for (let word of wordList) {
            let placed = false;
            for (let pw of placedWords) {
                if (placed) break;
                for (let i = 0; i < word.clean.length; i++) {
                    for (let j = 0; j < pw.clean.length; j++) {
                        if (word.clean[i] === pw.clean[j]) {
                            const newDir = pw.dir === 'horizontal' ? 'vertical' : 'horizontal';
                            const newX = pw.dir === 'horizontal' ? pw.x + j : pw.x - i;
                            const newY = pw.dir === 'horizontal' ? pw.y - i : pw.y + j;
                            if (this.canPlaceWord(grid, word.clean, newX, newY, newDir)) {
                                this.placeWordInGrid(grid, word, newX, newY, newDir);
                                placedWords.push({ ...word, x: newX, y: newY, dir: newDir, number: placedWords.length + 1 });
                                placed = true; break;
                            }
                        }
                    }
                    if (placed) break;
                }
            }
        }
        return { grid, words: placedWords };
    }
    canPlaceWord(grid, word, x, y, dir) {
        if (x < 0 || y < 0 || x + word.length >= this.gridSize || y + word.length >= this.gridSize) return false;
        for (let i = 0; i < word.length; i++) {
            const cx = dir === 'horizontal' ? x + i : x;
            const cy = dir === 'horizontal' ? y : y + i;
            const cell = grid[cy][cx];
            if (cell && cell !== word[i]) return false; 
        }
        return true;
    }
    placeWordInGrid(grid, word, x, y, dir) {
        for (let i = 0; i < word.clean.length; i++) {
            const cx = dir === 'horizontal' ? x + i : x;
            const cy = dir === 'horizontal' ? y : y + i;
            grid[cy][cx] = word.clean[i];
        }
    }
}

function createCrosswordGridXML(gridData, showSolution) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    gridData.words.forEach(w => {
        minX = Math.min(minX, w.x); minY = Math.min(minY, w.y);
        maxX = Math.max(maxX, w.dir === 'horizontal' ? w.x + w.clean.length : w.x);
        maxY = Math.max(maxY, w.dir === 'vertical' ? w.y + w.clean.length : w.y);
    });
    minX = Math.max(0, minX - 1); minY = Math.max(0, minY - 1);
    const width = (maxX - minX) + 2; const height = (maxY - minY) + 2;
    let xml = `<table:table table:name="Crossword" table:style-name="TableGrid">`;
    xml += `<table:table-column table:style-name="GridCol" table:number-columns-repeated="${width}"/>`;
    for (let y = minY; y < minY + height; y++) {
        xml += `<table:table-row table:style-name="GridRow">`;
        for (let x = minX; x < minX + width; x++) {
            let letter = null, number = null;
            const startingWord = gridData.words.find(w => w.x === x && w.y === y);
            if (startingWord) number = startingWord.number;
            if (gridData.grid[y] && gridData.grid[y][x]) letter = gridData.grid[y][x];
            if (letter) {
                xml += `<table:table-cell table:style-name="CrosswordCell" office:value-type="string">`;
                const numText = number ? number : "\u00A0";
                xml += `<text:p text:style-name="SmallNumber">${numText}</text:p>`;
                const content = showSolution ? letter : "\u00A0";
                const style = showSolution ? "CellContentSolved" : "CellContent";
                xml += `<text:p text:style-name="${style}">${content}</text:p>`;
                xml += `</table:table-cell>`;
            } else { xml += `<table:table-cell table:style-name="CrosswordBlackCell"/>`; }
        }
        xml += `</table:table-row>`;
    }
    xml += `</table:table>`;
    return xml;
}