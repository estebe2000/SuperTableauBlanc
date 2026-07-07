import { makeStreamingRequest, formatMarkdown } from './api.js';
import { appConfig } from './config.js';
import { initDefia } from './tool-defia.js';

export function initProfessorPlus() {
    const cycleSelect = document.getElementById('pp-cycle');
    const disciplineSelect = document.getElementById('pp-discipline');
    const competenceContainer = document.getElementById('pp-competence-container');
    const generateBtn = document.getElementById('pp-generate-btn');
    const outputEl = document.getElementById('pp-output');
    const placeholderEl = document.getElementById('pp-placeholder');
    const skeletonEl = document.getElementById('pp-skeleton');
    const gameContainer = document.getElementById('pp-game-container');
    
    // File/Audio elements
    const fileInputDoc = document.getElementById('pp-file-input-doc');
    const dropZoneDoc = document.getElementById('pp-drop-zone-doc');
    const docStatus = document.getElementById('pp-doc-status');
    const fileInputAudio = document.getElementById('pp-file-input-audio');
    const dropZoneAudio = document.getElementById('pp-drop-zone-audio');
    const recordBtn = document.getElementById('pp-record-btn');
    
    let extractedDocText = "";
    let base64Audio = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let generatedMarkdown = "";

    // Source Tabs Logic
    const sourceTabs = document.querySelectorAll('.pp-source-tab');
    const sourceContents = document.querySelectorAll('.pp-source-content');
    let currentSource = 'text';
    
    sourceTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            currentSource = tab.getAttribute('data-source');
            sourceTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            sourceContents.forEach(content => {
                if (content.id === `pp-source-${currentSource}`) {
                    content.style.display = 'block';
                } else {
                    content.style.display = 'none';
                }
            });
        });
    });

    // DOC/PDF Handling
    if (dropZoneDoc) {
        dropZoneDoc.addEventListener('click', () => fileInputDoc.click());
        fileInputDoc.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleDocFile(e.target.files[0]);
        });
    }

    async function handleDocFile(file) {
        docStatus.style.display = 'block';
        docStatus.textContent = `Chargement de ${file.name}...`;
        extractedDocText = "";

        try {
            if (file.type === 'application/pdf') {
                extractedDocText = await extractPdfText(file);
            } else if (file.name.endsWith('.docx')) {
                extractedDocText = await extractDocxText(file);
            } else {
                throw new Error("Format de fichier non supporté (PDF ou DOCX uniquement).");
            }
            docStatus.textContent = `✅ ${file.name} chargé (${extractedDocText.length} caractères)`;
            docStatus.style.color = 'var(--success-color)';
        } catch (error) {
            console.error(error);
            docStatus.textContent = `❌ Erreur: ${error.message}`;
            docStatus.style.color = 'var(--danger-color)';
        }
    }

    // Audio Handling
    if (dropZoneAudio) {
        dropZoneAudio.addEventListener('click', () => fileInputAudio.click());
        fileInputAudio.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleAudioFile(e.target.files[0]);
        });
    }

    function handleAudioFile(file) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            base64Audio = reader.result.split('base64,')[1];
            dropZoneAudio.querySelector('p').textContent = `✅ ${file.name} prêt`;
        };
    }

    // Recording Logic
    if (recordBtn) {
        recordBtn.addEventListener('click', async () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                recordBtn.textContent = 'Enregistrer';
                recordBtn.classList.remove('btn-danger');
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                mediaRecorder.onstop = () => {
                    const blob = new Blob(audioChunks, { type: 'audio/wav' });
                    handleAudioFile(new File([blob], "enregistrement.wav", { type: 'audio/wav' }));
                    stream.getTracks().forEach(t => t.stop());
                };
                mediaRecorder.start();
                recordBtn.textContent = '⏹ Arrêter';
                recordBtn.classList.add('btn-danger');
            } catch (err) {
                alert("Erreur micro: " + err.message);
            }
        });
    }

    // Format selection
    const formatBtns = document.querySelectorAll('#pp-output-format .tone-btn');
    let currentFormat = 'fiche';
    
    formatBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            formatBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFormat = btn.getAttribute('data-format');
        });
    });

    // Cycle & Discipline Loading Logic
    cycleSelect.addEventListener('change', async () => {
        const cycle = cycleSelect.value;
        const filiereField = document.getElementById('pp-filiere-field');
        const filiereSelect = document.getElementById('pp-filiere');

        if (!cycle) {
            disciplineSelect.disabled = true;
            disciplineSelect.innerHTML = '<option value="">— Choisir le niveau —</option>';
            filiereField.style.display = 'none';
            return;
        }

        if (cycle === 'post-bac') {
            filiereField.style.display = 'block';
            disciplineSelect.disabled = true;
            disciplineSelect.innerHTML = '<option value="">— Choisir la filière —</option>';
            filiereSelect.value = "";
        } else {
            if (filiereField) filiereField.style.display = 'none';
            disciplineSelect.disabled = false;
            disciplineSelect.innerHTML = '<option value="">Chargement...</option>';
            const disciplines = await fetchDisciplines(cycle);
            populateDisciplines(disciplines);
        }
    });

    const filiereSelect = document.getElementById('pp-filiere');
    if (filiereSelect) {
        filiereSelect.addEventListener('change', async () => {
            const cycle = cycleSelect.value;
            const filiere = filiereSelect.value;
            if (cycle === 'post-bac' && filiere) {
                disciplineSelect.disabled = false;
                disciplineSelect.innerHTML = '<option value="">Chargement...</option>';
                const disciplines = await fetchDisciplines(cycle, filiere);
                populateDisciplines(disciplines);
            } else {
                disciplineSelect.disabled = true;
                disciplineSelect.innerHTML = '<option value="">— Choisir la filière —</option>';
            }
        });
    }

    disciplineSelect.addEventListener('change', async () => {
        const cycle = cycleSelect.value;
        const discipline = disciplineSelect.value;
        const filiere = filiereSelect ? filiereSelect.value : null;
        if (!cycle || !discipline) return;
        competenceContainer.innerHTML = '<p class="placeholder-text">Chargement des compétences...</p>';
        try {
            const programme = await loadProgramme(cycle, discipline, filiere);
            populateCompetences(programme);
        } catch (error) {
            competenceContainer.innerHTML = `<p class="placeholder-text">Erreur : ${error.message}</p>`;
        }
    });

    // Generation Logic
    generateBtn.addEventListener('click', async () => {
        const cycle = cycleSelect.value;
        const discipline = disciplineSelect.value;
        const theme = document.getElementById('pp-theme').value;
        let inputText = document.getElementById('pp-input-text').value;
        
        const pillars = [];
        if (document.getElementById('pp-pillar-engagement').checked) pillars.push('Engagement');
        if (document.getElementById('pp-pillar-representation').checked) pillars.push('Représentation');
        if (document.getElementById('pp-pillar-action').checked) pillars.push('Action & Expression');

        const selectedCompetences = Array.from(competenceContainer.querySelectorAll('input:checked'))
            .map(input => input.value);

        if (!cycle || !discipline) {
            alert('Veuillez renseigner au moins le cycle et la discipline.');
            return;
        }

        // Context preparation
        let context = "";
        if (currentSource === 'text') context = inputText;
        if (currentSource === 'doc') context = extractedDocText;
        
        // Prepare UI
        placeholderEl.style.display = 'none';
        skeletonEl.style.display = 'block';
        outputEl.style.display = 'none';
        gameContainer.style.display = 'none';
        outputEl.innerHTML = '';
        generateBtn.disabled = true;
        document.getElementById('pp-copy-btn').disabled = true;
        const exportBtn = document.getElementById('pp-export-btn');
        if (exportBtn) exportBtn.disabled = true;
        const exportDropdown = document.querySelector('.export-dropdown');
        if (exportDropdown) exportDropdown.classList.add('disabled');
        generateBtn.querySelector('.btn-loader').style.display = 'block';
        generateBtn.querySelector('.btn-text').textContent = 'Analyse...';

        if (currentFormat === 'defia') {
            generateBtn.querySelector('.btn-text').textContent = 'Préparation du défi...';
            skeletonEl.style.display = 'none';
            gameContainer.style.display = 'block';
            
            // Special initialization for Defia as an output format
            initDefia(context || selectedCompetences.join(', '), {
                targetEl: gameContainer,
                cycle,
                discipline,
                competences: selectedCompetences,
                theme: theme // Passing the theme from the input field
            });
            
            generateBtn.disabled = false;
            generateBtn.querySelector('.btn-loader').style.display = 'none';
            generateBtn.querySelector('.btn-text').textContent = 'Générer le défi';
            return;
        }

        // Handling Audio source
        if (currentSource === 'audio' && base64Audio) {
            generateBtn.querySelector('.btn-text').textContent = 'Transcription audio...';
            try {
                context = await transcribeAudio(base64Audio);
            } catch (err) {
                console.error("Audio transcription failed:", err);
            }
        }

        const prompt = constructPrompt(cycle, discipline, theme, selectedCompetences, pillars, context, currentFormat);

        try {
            await makeStreamingRequest(prompt, { tool: 'professor' }, 
                (chunk, full) => {
                    skeletonEl.style.display = 'none';
                    outputEl.style.display = 'block';
                    generatedMarkdown = full;
                    formatMarkdown(outputEl, full);
                },
                () => {
                    generateBtn.disabled = false;
                    generateBtn.querySelector('.btn-loader').style.display = 'none';
                    generateBtn.querySelector('.btn-text').textContent = 'Générer la séance inclusive';
                    document.getElementById('pp-copy-btn').disabled = false;
                    const exportBtn = document.getElementById('pp-export-btn');
                    if (exportBtn) exportBtn.disabled = false;
                    const exportDropdown = document.querySelector('.export-dropdown');
                    if (exportDropdown) exportDropdown.classList.remove('disabled');
                    if (window.mermaid) window.mermaid.run().catch(e => {});
                },
                (error) => {
                    outputEl.innerHTML = `<p class="error">Erreur : ${error.message}</p>`;
                    generateBtn.disabled = false;
                    generateBtn.querySelector('.btn-loader').style.display = 'none';
                    generateBtn.querySelector('.btn-text').textContent = 'Réessayer';
                }
            );
        } catch (error) {
            console.error('Request failed:', error);
        }
    });

    const themeInput = document.getElementById('pp-theme');
    const copyBtn = document.getElementById('pp-copy-btn');
    const exportOpts = document.querySelectorAll('.export-opt');

    // Copy
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(outputEl.innerText);
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅';
            setTimeout(() => copyBtn.textContent = originalText, 2000);
        });
    }

    // Export Option Handlers
    exportOpts.forEach(btn => {
        btn.addEventListener('click', () => {
            const formatType = btn.getAttribute('data-format');
            const title = themeInput.value || disciplineSelect.value || "seance_inclusive";
            try {
                if (formatType === 'pdf') {
                    exportToPDF(outputEl, currentFormat, title);
                } else if (formatType === 'word') {
                    exportToWord(outputEl, currentFormat, title);
                } else if (formatType === 'md') {
                    exportToMarkdown(generatedMarkdown, currentFormat, title);
                } else if (formatType === 'odt') {
                    exportToODT(outputEl, currentFormat, title);
                }
            } catch (error) {
                console.error(`Export ${formatType} failed:`, error);
                alert(`Erreur lors de l'export ${formatType.toUpperCase()}.`);
            }
        });
    });
}

function exportToPDF(element, format, title) {
    const opt = {
        margin: [15, 15],
        filename: `IAcademie_${format}_${title.replace(/[^a-z0-9]/gi, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollX: 0, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // Create a clone for export to apply specific print styles
    const clone = element.cloneNode(true);
    clone.style.padding = "10px";
    clone.style.color = "#1e293b";
    clone.style.backgroundColor = "#ffffff";
    clone.style.fontSize = "11pt";
    clone.style.fontFamily = "'Sora', sans-serif";
    clone.style.lineHeight = "1.6";
    clone.style.textAlign = "left";
    
    // Header for the PDF
    const header = document.createElement('div');
    header.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-bottom: 20px; font-family: 'Sora', sans-serif;">
            <div style="font-weight: 800; color: #dc2626; font-size: 18pt;">IAcadémie</div>
            <div style="text-align: right; font-size: 10pt; color: #64748b;">Ressource Pédagogique Inclusive</div>
        </div>
        <h1 style="font-size: 22pt; margin: 0 0 10px 0; color: #1e293b; font-family: 'Sora', sans-serif; font-weight: 700; text-align: left;">${title}</h1>
        <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin-bottom: 25px; font-size: 10pt; color: #334155; line-height: 1.5; font-family: 'Sora', sans-serif; text-align: left;">
            Type de document : <strong>${format.toUpperCase()}</strong><br>
            Date de génération : ${new Date().toLocaleDateString('fr-FR')}
        </div>
    `;

    // Apply styles to elements in the clone to make them look clean and consistent
    const headings = clone.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(h => {
        h.style.color = "#dc2626";
        h.style.fontFamily = "'Sora', sans-serif";
        h.style.textAlign = "left";
    });

    const h1s = clone.querySelectorAll('h1');
    h1s.forEach(h1 => {
        h1.style.borderBottom = "2px solid #dc2626";
        h1.style.paddingBottom = "6px";
        h1.style.fontSize = "16pt";
        h1.style.marginTop = "20px";
        h1.style.marginBottom = "10px";
    });

    const h2s = clone.querySelectorAll('h2');
    h2s.forEach(h2 => {
        h2.style.borderBottom = "1px solid #e2e8f0";
        h2.style.paddingBottom = "4px";
        h2.style.fontSize = "14pt";
        h2.style.marginTop = "15px";
        h2.style.marginBottom = "8px";
    });

    const paragraphs = clone.querySelectorAll('p');
    paragraphs.forEach(p => {
        p.style.color = "#1e293b";
        p.style.marginBottom = "8px";
        p.style.fontSize = "11pt";
        p.style.textAlign = "left";
    });

    const listItems = clone.querySelectorAll('li');
    listItems.forEach(li => {
        li.style.color = "#1e293b";
        li.style.marginBottom = "4px";
        li.style.fontSize = "11pt";
        li.style.textAlign = "left";
    });

    const strongs = clone.querySelectorAll('strong');
    strongs.forEach(s => {
        s.style.color = "#dc2626";
    });

    // Format tables to make column widths clean and space-saving
    const tables = clone.querySelectorAll('table');
    tables.forEach(table => {
        table.style.width = "100%";
        table.style.tableLayout = "fixed";
        table.style.borderCollapse = "collapse";
        table.style.margin = "15px 0";
        
        const headers = table.querySelectorAll('thead th, tr:first-child th, tr:first-child td');
        if (headers.length === 5) {
            // "Déroulement chronologique" table columns
            // Phase (18%), Temps (10%), Activités prof (42%), Activités élèves (18%), CUA (12%)
            const widths = ["18%", "10%", "42%", "18%", "12%"];
            headers.forEach((th, idx) => {
                if (widths[idx]) th.style.width = widths[idx];
            });
        } else if (headers.length === 2) {
            // "Différenciation" table columns
            // Besoin (20%), Variante (80%)
            const widths = ["20%", "80%"];
            headers.forEach((th, idx) => {
                if (widths[idx]) th.style.width = widths[idx];
            });
        } else if (headers.length === 3) {
            // "Matériel nécessaire" table columns
            // Ressource (45%), Quantité (25%), Usage (30%)
            const widths = ["45%", "25%", "30%"];
            headers.forEach((th, idx) => {
                if (widths[idx]) th.style.width = widths[idx];
            });
        }

        const cells = table.querySelectorAll('th, td');
        cells.forEach(cell => {
            cell.style.wordBreak = "break-word";
            cell.style.padding = "6px 8px";
            cell.style.fontSize = "10pt";
            cell.style.lineHeight = "1.4";
            cell.style.textAlign = "left";
            cell.style.color = "#1e293b";
        });
        
        table.querySelectorAll('th').forEach(th => {
            th.style.backgroundColor = "#f1f5f9";
            th.style.color = "#0f172a";
            th.style.borderColor = "#cbd5e1";
            th.style.fontWeight = "700";
        });
        
        table.querySelectorAll('td').forEach(td => {
            td.style.borderColor = "#e2e8f0";
        });
    });

    const wrapper = document.createElement('div');
    wrapper.style.backgroundColor = "#ffffff";
    wrapper.style.color = "#1e293b";
    wrapper.style.padding = "10px";
    wrapper.appendChild(header);
    wrapper.appendChild(clone);
    
    // Add footer to each page (simplified via CSS in html2pdf)
    const footer = document.createElement('div');
    footer.innerHTML = `<div style="text-align: center; font-size: 9pt; color: #94a3b8; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-family: 'Sora', sans-serif;">
        Généré par IAcadémie — Atelier Pédagogique
    </div>`;
    wrapper.appendChild(footer);
    
    // If the user has Dyslexic mode on, apply it to the PDF too
    if (document.body.classList.contains('accessibility-dyslexia')) {
        wrapper.style.fontFamily = "'OpenDyslexic', 'Lexend', sans-serif";
        wrapper.style.lineHeight = "1.8";
        
        clone.querySelectorAll('p, li, span, td, th, h1, h2, h3, h4, h5, h6').forEach(el => {
            el.style.fontFamily = "'OpenDyslexic', 'Lexend', sans-serif";
            el.style.lineHeight = "1.8";
        });
    }

    if (window.html2pdf) {
        window.html2pdf().set(opt).from(wrapper).save();
    }
}

function exportToWord(element, format, title) {
    const filename = `IAcademie_${format}_${title.replace(/[^a-z0-9]/gi, '_')}.doc`;
    
    // Create simple HTML template styled for Word
    const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
            body {
                font-family: 'Segoe UI', Arial, sans-serif;
                color: #1e293b;
                line-height: 1.6;
            }
            h1, h2, h3, h4, h5, h6 {
                color: #dc2626;
                font-family: 'Segoe UI', Arial, sans-serif;
            }
            h1 {
                border-bottom: 2px solid #dc2626;
                padding-bottom: 5px;
                font-size: 20pt;
                margin-top: 25px;
            }
            h2 {
                border-bottom: 1px solid #e2e8f0;
                padding-bottom: 3px;
                font-size: 16pt;
                margin-top: 20px;
            }
            p, li {
                font-size: 11pt;
                margin-bottom: 8px;
            }
            strong {
                color: #dc2626;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
            }
            th, td {
                border: 1px solid #cbd5e1;
                padding: 8px 10px;
                text-align: left;
                font-size: 10pt;
                vertical-align: top;
            }
            th {
                background-color: #f1f5f9;
                color: #0f172a;
                font-weight: bold;
            }
            pre, code {
                font-family: Consolas, monospace;
                background-color: #f1f5f9;
                color: #0f172a;
                font-size: 10pt;
            }
        </style>
    </head>
    <body>
        <div style="border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-bottom: 20px;">
            <span style="font-weight: bold; color: #dc2626; font-size: 18pt;">IAcadémie</span>
            <span style="float: right; font-size: 10pt; color: #64748b; margin-top: 10px;">Ressource Pédagogique Inclusive</span>
        </div>
        <h1 style="font-size: 22pt; margin: 0 0 10px 0; color: #1e293b; font-weight: bold;">${title}</h1>
        <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin-bottom: 25px; font-size: 10pt; color: #334155;">
            Type de document : <strong>${format.toUpperCase()}</strong><br>
            Date de génération : ${new Date().toLocaleDateString('fr-FR')}
        </div>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 25px;">
        ${element.innerHTML}
        <div style="text-align: center; font-size: 9pt; color: #94a3b8; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
            Généré par IAcadémie — Atelier Pédagogique
        </div>
    </body>
    </html>`;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportToMarkdown(markdownText, format, title) {
    const filename = `IAcademie_${format}_${title.replace(/[^a-z0-9]/gi, '_')}.md`;
    const blob = new Blob([markdownText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportToODT(element, format, title) {
    const filename = `IAcademie_${format}_${title.replace(/[^a-z0-9]/gi, '_')}.odt`;
    const xmlContent = htmlToFodt(element.innerHTML, title);
    const blob = new Blob([xmlContent], { type: 'application/vnd.oasis.opendocument.text;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function htmlToFodt(html, title) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
                 xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
                 xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
                 xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
                 office:version="1.2"
                 office:mimetype="application/vnd.oasis:opendocument.text"
                 office:class="text">
  <office:font-face-decls>
    <style:font-face style:name="Segoe UI" svg:font-family="Segoe UI, Arial, sans-serif"/>
  </office:font-face-decls>
  <office:automatic-styles>
    <style:style style:name="H1" style:family="paragraph">
      <style:text-properties fo:font-size="18pt" fo:font-weight="bold" fo:color="#dc2626"/>
    </style:style>
    <style:style style:name="H2" style:family="paragraph">
      <style:text-properties fo:font-size="14pt" fo:font-weight="bold" fo:color="#dc2626"/>
    </style:style>
    <style:style style:name="P" style:family="paragraph">
      <style:text-properties fo:font-size="11pt" fo:color="#1e293b"/>
    </style:style>
    <style:style style:name="Strong" style:family="text">
      <style:text-properties fo:font-weight="bold" fo:color="#dc2626"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      <text:h text:style-name="H1" text:outline-level="1">${title}</text:h>
`;

    function traverse(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        
        const tagName = node.tagName ? node.tagName.toLowerCase() : "";
        
        if (tagName === "h1") {
            return `<text:h text:style-name="H1" text:outline-level="1">${traverseChildren(node)}</text:h>`;
        }
        if (tagName === "h2" || tagName === "h3") {
            return `<text:h text:style-name="H2" text:outline-level="2">${traverseChildren(node)}</text:h>`;
        }
        if (tagName === "p") {
            return `<text:p text:style-name="P">${traverseChildren(node)}</text:p>`;
        }
        if (tagName === "strong" || tagName === "b") {
            return `<text:span text:style-name="Strong">${traverseChildren(node)}</text:span>`;
        }
        if (tagName === "li") {
            return `<text:p text:style-name="P">• ${traverseChildren(node)}</text:p>`;
        }
        if (tagName === "table") {
            return `<table:table>${traverseChildren(node)}</table:table>`;
        }
        if (tagName === "tr") {
            return `<table:table-row>${traverseChildren(node)}</table:table-row>`;
        }
        if (tagName === "td" || tagName === "th") {
            return `<table:table-cell><text:p>${traverseChildren(node)}</text:p></table:table-cell>`;
        }
        
        return traverseChildren(node);
    }

    function traverseChildren(node) {
        let res = "";
        node.childNodes.forEach(child => {
            res += traverse(child);
        });
        return res;
    }

    xml += traverseChildren(doc.body);
    xml += `
    </office:text>
  </office:body>
</office:document>`;
    return xml;
}

// Extraction Helpers
async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(" ") + "\n";
    }
    return text;
}

async function extractDocxText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

async function transcribeAudio(base64) {
    // Re-use logic for whisper transcription
    const prompt = "RÉPONDS UNIQUEMENT PAR LA TRANSCRIPTION DU DIALOGUE AUDIO.";
    let transcription = "";
    await makeStreamingRequest(prompt, { tool: 'voice', images: [base64] }, (chunk) => transcription += chunk);
    return transcription;
}

// Programme loading helpers (simplified mapping)
export async function fetchDisciplines(cycle, filiere = null) {
    const DISCIPLINES_PAR_CYCLE = {
        cycle1: ['Maternelle'],
        cycle2: ['Toutes disciplines'],
        cycle3: ['Français', 'Mathématiques', 'Anglais', 'Histoire-Géographie', 'Sciences et technologie', 'EMC', 'Arts Plastiques', 'Éducation Musicale', 'EPS', 'Histoire des Arts'],
        cycle4: ['Français', 'Mathématiques', 'Anglais', 'Histoire-Géographie', 'SVT', 'Physique-Chimie', 'Technologie', 'EMC', 'Arts Plastiques', 'Éducation Musicale', 'EPS'],
        'lycee-gt': [
            'Français', 'Mathématiques', 'Mathématiques Seconde', 'Mathématiques 1ère Ens. Scientifique', 'Mathématiques 1ère Tech',
            'Histoire-Géographie', 'SVT', 'Physique-Chimie', 'EMC', 'EPS', 
            'Anglais', 'Espagnol', 'Allemand', 'Italien', 'Latin', 'Grec ancien',
            'Philosophie', 'SES', 'NSI', 'SNT', 'Géopolitique et Sciences Politiques',
            'Histoire des Arts', 'Arts Plastiques', 'Arts Appliqués et Cultures Artistiques', 
            'Éducation Musicale', 'Théâtre', 'Cinéma-Audiovisuel',
            'SI', 'Biologie-Écologie', 'Biotechnologies', 'STI2D', 'ST2S', 'STMG'
        ],
        'lycee-pro': [
            'Français', 'Mathématiques', 'Histoire-Géographie', 'Anglais', 'Espagnol', 'EMC', 'EPS',
            'Physique-Chimie', 'PSE', 'Économie-Gestion', 'STMG',
            'Arts Plastiques', 'Arts Appliqués et Cultures Artistiques',
            'Bac Pro ASSP', 'Bac Pro AEPA', 'Bac Pro AGORA', 'Bac Pro CIEL', 'Bac Pro MELEC', 'Bac Pro MCV', 'Bac Pro Cuisine', 'Bac Pro CSR',
            'CAP AEPE', 'CAP Cuisine', 'CAP Électricien', 'CAP Coiffure'
        ],
        'post-bac': {
            'but-tc': ['Marketing', 'Vente', 'Communication commerciale', 'Économie', 'Droit des affaires', 'Anglais des affaires'],
            'licence-anglais': ['Langue et Grammaire', 'Littérature', 'Civilisation', 'Traduction (Thème/Version)', 'Linguistique', 'Phonétique']
        }
    };

    if (cycle === 'post-bac' && filiere) {
        return DISCIPLINES_PAR_CYCLE[cycle][filiere] || [];
    }
    return DISCIPLINES_PAR_CYCLE[cycle] || [];
}

function populateDisciplines(disciplines) {
    const disciplineSelect = document.getElementById('pp-discipline');
    if (!disciplineSelect) return;
    disciplineSelect.innerHTML = '<option value="">— Choisir —</option>';
    disciplines.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        disciplineSelect.appendChild(opt);
    });
}

export async function loadProgramme(cycle, discipline, filiere = null) {
    const disciplineMappings = {
        'EMC': 'education-morale-et-civique',
        'EPS': 'education-physique-et-sportive',
        'SVT': 'sciences-de-la-vie-et-de-la-terre',
        'SES': 'sciences-economiques-et-sociales',
        'NSI': 'numerique-et-sciences-informatiques',
        'SNT': 'snt-sciences-numeriques-et-technologie',
        'PSE': 'pse-prevention-sante-environnement',
        'Sciences et technologie': 'sciences-et-technologie',
        'Histoire des Arts': 'histoire-des-arts',
        'Arts Appliqués et Cultures Artistiques': 'arts-appliques-et-cultures-artistiques',
        'Géopolitique et Sciences Politiques': 'geopolitique-et-sciences-politiques',
        'Mathématiques 1ère Ens. Scientifique': 'mathematiques-premiere-enseignement-scientifique',
        'Mathématiques 1ère Tech': 'mathematiques-premiere-technologique',
        'Mathématiques Seconde': 'mathematiques-seconde',
        'SI': 'sciences-de-l-ingenieur',
        'STI2D': 'sciences-et-technologies-de-l-industrie',
        'ST2S': 'sciences-et-technologies-de-la-sante',
        'STMG': 'sciences-et-technologies-du-management',
        'Bac Pro MCV': 'bac-pro-mcv-commerce-et-vente',
        'Bac Pro CSR': 'bac-pro-csr-restauration',
        'Toutes disciplines': ''
    };

    const mappedDiscipline = disciplineMappings[discipline] || discipline;
    let filename = "";
    let subDir = "";
    
    if (cycle === 'cycle1') filename = 'cycle1-maternelle.json';
    else if (cycle === 'cycle2') filename = 'cycle2.json';
    else if (cycle === 'post-bac' && filiere) {
        subDir = filiere + "/";
        const discSlug = mappedDiscipline.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        filename = `${filiere}-${discSlug}.json`;
    }
    else {
        const discSlug = mappedDiscipline.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        filename = `${cycle}-${discSlug}.json`;
    }

    const path = `/programmes/${subDir}${filename}`;
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Le programme "${discipline}" n'est pas disponible (Fichier ${filename} introuvable).`);
    }
    return await response.json();
}

function populateCompetences(programme) {
    const container = document.getElementById('pp-competence-container');
    if (!container) return;
    container.innerHTML = '';
    
    let items = [];

    // Case 1: programme.domaines is an object (like cycle2.json)
    if (programme.domaines && !Array.isArray(programme.domaines)) {
        Object.values(programme.domaines).forEach(domaine => {
            // Check for sous_domaines
            if (domaine.sous_domaines) {
                Object.values(domaine.sous_domaines).forEach(sd => {
                    if (sd.attendus) items.push(...sd.attendus);
                    if (sd.competences) items.push(...sd.competences);
                });
            }
            if (domaine.competences) items.push(...domaine.competences);
            if (domaine.attendus) items.push(...domaine.attendus);
        });
    } 
    // Case 2: programme.domaines is an array (like cycle3-francais.json)
    else if (Array.isArray(programme.domaines)) {
        programme.domaines.forEach(domaine => {
            if (domaine.competences) items.push(...domaine.competences);
            if (domaine.attendus) items.push(...domaine.attendus);
        });
    }
    // Case 3: Flat array
    else if (Array.isArray(programme.competences)) {
        items = programme.competences;
    }

    items.forEach(comp => {
        const label = typeof comp === 'string' ? comp : (comp.intitule || comp.label || comp.nom || JSON.stringify(comp));
        const id = `comp-${Math.random().toString(36).substr(2, 9)}`;
        const item = document.createElement('div');
        item.className = 'competence-item';
        item.innerHTML = `<input type="checkbox" id="${id}" value="${label}"> <label for="${id}">${label}</label>`;
        container.appendChild(item);
    });

    if (container.innerHTML === '') {
        container.innerHTML = '<p class="placeholder-text">Aucune compétence répertoriée pour cette discipline.</p>';
    }
}

function constructPrompt(cycle, discipline, theme, competences, pillars, context, format) {
    let prompt = `Tu es un expert en pédagogie inclusive et en Conception Universelle des Apprentissages (CUA/UDL).
Ta mission est de concevoir une ressource pour le niveau ${cycle} en ${discipline}.

SUJET : ${theme || 'Non précisé'}
COMPÉTENCES VISÉES : ${competences.join(', ') || 'Selon le programme officiel'}
PILIERS CUA À MOBILISER : ${pillars.join(', ')}
${context ? `\nCONTEXTE / DOCUMENTS FOURNIS :\n${context}\n` : ''}

FORMAT DE SORTIE ATTENDU : ${format}
`;

    if (format === 'fiche') {
        prompt += `\nProduis une Fiche de Mise en Œuvre structurée comprenant :
1. Objectifs de la séance
2. Déroulement chronologique (Phases)
3. Différenciation par pilier CUA (propose des variantes concrètes pour les élèves DYS, TDAH ou Allophones)
4. Matériel nécessaire.`;
    } else if (format === 'eleve') {
        prompt += `\nProduis un support pour l'élève. Utilise un langage simple (FALC), des phrases courtes, et une structure très claire.`;
    } else if (format === 'mindmap') {
        prompt += `\nProduis une carte mentale du concept au format Mermaid.js. 
CONSIGNES STRICTES POUR MERMAID :
1. Utilise UNIQUEMENT la syntaxe "graph TD" ou "graph LR".
2. Entoure TOUS les textes des nœuds par des guillemets doubles (ex: A["Mon texte"]) pour éviter les erreurs de syntaxe avec les caractères spéciaux.
3. Ne mets AUCUN commentaire à l'intérieur du bloc mermaid.
4. Ajoute une brève explication textuelle sous le diagramme.`;
    } else if (format === 'todo') {
        prompt += `\nDécoupe la tâche principale en une liste de micro-étapes (check-list) pour aider un élève ayant des troubles des fonctions exécutives (TDAH).`;
    }

    prompt += `\nRéponds en français, avec un ton professionnel. Utilise le format Markdown pour la structure.`;
    
    return prompt;
}
