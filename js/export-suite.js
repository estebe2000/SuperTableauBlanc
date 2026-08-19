/**
 * Export Suite — Suite complète d'exportation pédagogique accessible multi-formats :
 * - ODT (OpenDocument 1.2 CUA)
 * - Word (.doc / OpenXML)
 * - PDF Direct (Téléchargement binaire instantané sans coupure de texte via jsPDF.html)
 * - Markdown (.md)
 * - LaTeX (.tex)
 * - Packs ZIP (Fiche Élève + Fiche Enseignant séparées par format ou bundle complet)
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { getOdtBlob, downloadOdt } from './odt-export.js';

function cleanFilename(title, ext) {
  const safe = (title || 'seance_pedagogique')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${safe}.${ext}`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Découpe le document pédagogique en sous-fiches :
 * - Fiche 1 : Document Élève
 * - Fiche 2 : Fiche Enseignant (Préparation / Notes)
 */
export function splitSessionParts(htmlContent, mdContent = '') {
  let part1Html = htmlContent;
  let part2Html = '';

  const cleanHtml = (htmlContent || '').replace(/[\u202F\u00A0]/g, ' ');

  // Match Part 2 header with flexible regex
  const match = cleanHtml.match(/(?:<h[1-4][^>]*>|#{1,3}\s*).*?(?:PARTIE\s*2|Partie\s*2|Fiche\s*de\s*Pr[ée]paration|Notes\s*pour\s*l['’]Enseignant).*?(?:<\/h[1-4]>|\n)/i);
  if (match && match.index > 0) {
    part1Html = htmlContent.substring(0, match.index).trim();
    part2Html = htmlContent.substring(match.index).trim();
  } else {
    part1Html = htmlContent;
    part2Html = htmlContent;
  }

  let part1Md = mdContent;
  let part2Md = '';
  const cleanMd = (mdContent || '').replace(/[\u202F\u00A0]/g, ' ');
  const mdMatch = cleanMd.match(/(?:^|\n)#{1,3}\s+.*?(?:PARTIE\s*2|Partie\s*2|Fiche\s*de\s*Pr[ée]paration|Notes\s*pour\s*l['’]Enseignant)/i);
  if (mdMatch && mdMatch.index > 0) {
    part1Md = mdContent.substring(0, mdMatch.index).trim();
    part2Md = mdContent.substring(mdMatch.index).trim();
  } else {
    part1Md = mdContent;
    part2Md = mdContent;
  }

  return {
    part1Html: part1Html || htmlContent,
    part2Html: part2Html || htmlContent,
    fullHtml: htmlContent,
    part1Md: part1Md || mdContent,
    part2Md: part2Md || mdContent,
    fullMd: mdContent
  };
}

/**
 * 1. Export ODT (OpenDocument Accessible)
 */
export function exportODT(title, htmlOrMd, meta = {}) {
  downloadOdt(title, htmlOrMd, cleanFilename(title, 'odt'));
}

/**
 * 2. Construit le Blob Word (.doc / OpenXML)
 */
export function getWordBlob(title, htmlContent, meta = {}) {
  const header = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>${title || 'Séance Pédagogique'}</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13pt; line-height: 1.5; color: #0f172a; margin: 2.5cm; }
  .header-box { border-bottom: 2pt solid #2563eb; padding-bottom: 8pt; margin-bottom: 16pt; }
  .header-brand { font-size: 12pt; color: #2563eb; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5pt; }
  .header-meta { font-size: 10pt; color: #64748b; margin-top: 4pt; }
  h1 { font-size: 20pt; color: #1e293b; border-bottom: 2pt solid #2563eb; padding-bottom: 6pt; margin-top: 14pt; }
  h2 { font-size: 16pt; color: #2563eb; margin-top: 18pt; page-break-after: avoid; }
  h3 { font-size: 14pt; color: #0f766e; margin-top: 12pt; page-break-after: avoid; }
  p, li { font-size: 13pt; line-height: 1.5; margin-bottom: 6pt; }
  blockquote { background: #eff6ff; border-left: 4pt solid #3b82f6; padding: 8pt 12pt; margin: 10pt 0; font-weight: bold; }
  table { border-collapse: collapse; width: 100%; margin: 14pt 0; }
  th { background-color: #2563eb; color: #ffffff; padding: 8pt; border: 1pt solid #cbd5e1; text-align: left; font-weight: bold; }
  td { padding: 8pt; border: 1pt solid #cbd5e1; vertical-align: top; }
  pre, code { font-family: 'Courier New', monospace; font-size: 11pt; background: #f8fafc; padding: 6pt; border: 1pt solid #e2e8f0; }
  img { max-width: 100%; height: auto; }
</style>
</head>
<body>
  <div class="header-box">
    <div class="header-brand">All' Inclusive · Studio Pédagogique</div>
    <div class="header-meta">
      ${meta.cycle ? `<strong>Niveau :</strong> ${meta.cycle} | ` : ''}
      ${meta.discipline ? `<strong>Discipline :</strong> ${meta.discipline} | ` : ''}
      ${meta.theme ? `<strong>Thème :</strong> ${meta.theme}` : ''}
    </div>
  </div>
  <h1>${title || 'Séance Pédagogique'}</h1>
  ${htmlContent}
</body>
</html>`;

  return new Blob(['\ufeff' + header], { type: 'application/msword;charset=utf-8' });
}

export function exportWord(title, htmlContent, meta = {}) {
  const blob = getWordBlob(title, htmlContent, meta);
  triggerDownload(blob, cleanFilename(title, 'doc'));
}

/**
 * 3. Génération directe d'un PDF natif haute fidélité avec découpage de pages intelligent (jsPDF.html)
 */
export async function getDirectPDFBlob(title, htmlContent, meta = {}) {
  return new Promise(async (resolve, reject) => {
    let container = null;
    try {
      container = document.createElement('div');
      container.className = 'pdf-render-sandbox';
      container.style.cssText = `
        position: fixed;
        left: 0;
        top: 0;
        width: 780px;
        background: #ffffff;
        color: #0f172a;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 11.5pt;
        line-height: 1.5;
        padding: 24px 30px;
        box-sizing: border-box;
        opacity: 0;
        pointer-events: none;
        z-index: -9999;
      `;

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #2563eb; padding-bottom:6px; margin-bottom:14px;">
          <div>
            <div style="font-size:13pt; font-weight:800; color:#2563eb; letter-spacing:-0.2px;">All' Inclusive · Studio Pédagogique</div>
            <div style="font-size:8pt; color:#64748b; margin-top:2px;">Conception Universelle des Apprentissages & IA Souveraine</div>
          </div>
          <div style="text-align:right; font-size:8.5pt; color:#475569; line-height:1.3;">
            ${meta.cycle ? `<div><strong>Niveau :</strong> ${meta.cycle}</div>` : ''}
            ${meta.discipline ? `<div><strong>Discipline :</strong> ${meta.discipline}</div>` : ''}
            ${meta.theme ? `<div><strong>Thème :</strong> ${meta.theme}</div>` : ''}
          </div>
        </div>
        <div class="pdf-inner-body">
          ${htmlContent}
        </div>
      `;

      // Apply print-friendly styling to inner elements
      container.querySelectorAll('table').forEach(t => {
        t.style.cssText = 'width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9.5pt;';
      });
      container.querySelectorAll('th').forEach(th => {
        th.style.cssText = 'background-color: #2563eb; color: #ffffff; padding: 5px 7px; border: 1px solid #cbd5e1; text-align: left; font-weight: 700;';
      });
      container.querySelectorAll('td').forEach(td => {
        td.style.cssText = 'padding: 5px 7px; border: 1px solid #cbd5e1; vertical-align: top;';
      });
      container.querySelectorAll('.picto-card').forEach(pc => {
        pc.style.cssText = 'border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px; text-align: center; background: #fff; display: inline-flex; flex-direction: column; align-items: center; width: 95px; margin: 3px; font-size: 8pt;';
      });
      container.querySelectorAll('.picto-card img').forEach(img => {
        img.style.cssText = 'width: 48px; height: 48px; object-fit: contain;';
      });

      document.body.appendChild(container);

      // Wait for all images in container
      const images = Array.from(container.querySelectorAll('img'));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(res => { img.onload = img.onerror = res; });
      }));

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4'
      });

      doc.html(container, {
        callback: function (pdfDoc) {
          try {
            if (container && container.parentNode) {
              document.body.removeChild(container);
            }
            const blob = pdfDoc.output('blob');
            resolve(blob);
          } catch (e) {
            reject(e);
          }
        },
        x: 15,
        y: 15,
        width: 565, // A4 width in pt (595.28) minus margins (30)
        windowWidth: 780,
        autoPaging: 'text',
        html2canvas: {
          scale: 1.2,
          useCORS: true,
          logging: false
        }
      });
    } catch (err) {
      if (container && container.parentNode) {
        document.body.removeChild(container);
      }
      console.error("PDF generation error:", err);
      reject(err);
    }
  });
}

/**
 * Télécharge directement le fichier PDF binaire sans passer par la fenêtre d'impression
 */
export async function exportDirectPDF(title, htmlContent, meta = {}, customFilename = null) {
  try {
    window.showToast("Génération du fichier PDF en cours... ⏳");
    const blob = await getDirectPDFBlob(title, htmlContent, meta);
    const filename = customFilename || cleanFilename(title, 'pdf');
    triggerDownload(blob, filename);
    window.showToast("Fichier PDF téléchargé avec succès ! 📕");
  } catch (err) {
    console.error("Erreur export PDF:", err);
    window.showToast("❌ Erreur lors de la création du PDF : " + err.message);
  }
}

/**
 * 4. Export Markdown (.md)
 */
export function getMarkdownBlob(title, mdContent) {
  const fullContent = `# ${title || 'Séance Pédagogique'}\n\n${mdContent}`;
  return new Blob([fullContent], { type: 'text/markdown;charset=utf-8' });
}

export function exportMarkdown(title, mdContent) {
  const blob = getMarkdownBlob(title, mdContent);
  triggerDownload(blob, cleanFilename(title, 'md'));
}

/**
 * 5. Export LaTeX (.tex)
 */
export function exportLatex(title, mdContent) {
  function mdToLatex(text) {
    let lines = (text || '').split('\n');
    let out = [];
    for (let line of lines) {
      if (line.startsWith('# ')) {
        out.push(`\\section{${line.slice(2)}}`);
      } else if (line.startsWith('## ')) {
        out.push(`\\subsection{${line.slice(3)}}`);
      } else if (line.startsWith('### ')) {
        out.push(`\\subsubsection{${line.slice(4)}}`);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        out.push(`\\begin{itemize}\\item ${line.slice(2)}\\end{itemize}`);
      } else if (line.trim()) {
        out.push(`${line}\\\\`);
      }
    }
    return out.join('\n');
  }

  const latexDoc = `\\documentclass[a4paper,12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[french]{babel}
\\usepackage{geometry}
\\geometry{margin=2.5cm}
\\title{${title || 'Séance Pédagogique'}}
\\begin{document}
\\maketitle
${mdToLatex(mdContent)}
\\end{document}`;

  const blob = new Blob([latexDoc], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, cleanFilename(title, 'tex'));
}

/**
 * 6. Export Packs ZIP (Fiches Individuelles & Archives Complètes)
 */
export async function exportPackZip(title, htmlContent, mdContent, format = 'all', meta = {}) {
  try {
    window.showToast(`Préparation du Pack ZIP (${format.toUpperCase()})... ⏳`);
    const zip = new JSZip();
    const parts = splitSessionParts(htmlContent, mdContent);
    const safeTitle = (title || 'seance').toLowerCase().replace(/[^a-z0-9]+/g, '_');

    if (format === 'pdf' || format === 'all') {
      const pdfEleve = await getDirectPDFBlob(`${title} — Fiche Élève`, parts.part1Html, { ...meta, theme: `${meta.theme || title} (Fiche Élève)` });
      const pdfEnseignant = await getDirectPDFBlob(`${title} — Fiche Enseignant`, parts.part2Html, { ...meta, theme: `${meta.theme || title} (Fiche Enseignant)` });
      const pdfComplet = await getDirectPDFBlob(title, parts.fullHtml, meta);

      zip.file(`01_Fiche_Eleve_${safeTitle}.pdf`, pdfEleve);
      zip.file(`02_Fiche_Enseignant_${safeTitle}.pdf`, pdfEnseignant);
      zip.file(`00_Seance_Complete_${safeTitle}.pdf`, pdfComplet);
    }

    if (format === 'odt' || format === 'all') {
      zip.file(`01_Fiche_Eleve_${safeTitle}.odt`, getOdtBlob(`${title} — Fiche Élève`, parts.part1Html));
      zip.file(`02_Fiche_Enseignant_${safeTitle}.odt`, getOdtBlob(`${title} — Fiche Enseignant`, parts.part2Html));
      zip.file(`00_Seance_Complete_${safeTitle}.odt`, getOdtBlob(title, parts.fullHtml));
    }

    if (format === 'doc' || format === 'all') {
      zip.file(`01_Fiche_Eleve_${safeTitle}.doc`, getWordBlob(`${title} — Fiche Élève`, parts.part1Html, meta));
      zip.file(`02_Fiche_Enseignant_${safeTitle}.doc`, getWordBlob(`${title} — Fiche Enseignant`, parts.part2Html, meta));
      zip.file(`00_Seance_Complete_${safeTitle}.doc`, getWordBlob(title, parts.fullHtml, meta));
    }

    if (format === 'md' || format === 'all') {
      zip.file(`01_Fiche_Eleve_${safeTitle}.md`, getMarkdownBlob(`${title} — Fiche Élève`, parts.part1Md));
      zip.file(`02_Fiche_Enseignant_${safeTitle}.md`, getMarkdownBlob(`${title} — Fiche Enseignant`, parts.part2Md));
      zip.file(`00_Seance_Complete_${safeTitle}.md`, getMarkdownBlob(title, parts.fullMd));
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(zipBlob, `Pack_Seance_${format.toUpperCase()}_${safeTitle}.zip`);
    window.showToast(`Pack ZIP (${format.toUpperCase()}) téléchargé avec succès ! 📦`);
  } catch (err) {
    console.error("Erreur création pack ZIP:", err);
    window.showToast("❌ Erreur lors de la création du Pack ZIP : " + err.message);
  }
}
