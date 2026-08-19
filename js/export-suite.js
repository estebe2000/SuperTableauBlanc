/**
 * Export Suite — Suite complète d'exportation pédagogique accessible multi-formats :
 * - ODT (OpenDocument 1.2 CUA)
 * - Word (.doc / OpenXML)
 * - PDF Direct (Téléchargement binaire instantané sans impression via jsPDF & html2canvas)
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
  // Split HTML
  let part1Html = htmlContent;
  let part2Html = '';

  const part2Regex = /<h2[^>]*>.*?PARTIE\s*2.*?<\/h2>/i;
  const match = htmlContent.match(part2Regex);
  if (match) {
    const idx = match.index;
    part1Html = htmlContent.substring(0, idx);
    part2Html = htmlContent.substring(idx);
  }

  // Split MD
  let part1Md = mdContent;
  let part2Md = '';
  const mdSplit = mdContent.split(/(?:^|\n)##\s+.*?PARTIE\s*2/i);
  if (mdSplit.length > 1) {
    part1Md = mdSplit[0].trim();
    part2Md = `## 🧑‍🏫 PARTIE 2${mdSplit[1]}`.trim();
  }

  return {
    part1Html,
    part2Html: part2Html || htmlContent,
    fullHtml: htmlContent,
    part1Md,
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
 * 3. Génération directe d'un PDF natif haute fidélité (jsPDF + html2canvas)
 */
export async function getDirectPDFBlob(title, htmlContent, meta = {}) {
  // Create offscreen rendering sandbox with clean A4 layout (794px width)
  const container = document.createElement('div');
  container.className = 'pdf-render-sandbox';
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 794px;
    background: #ffffff;
    color: #0f172a;
    font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13pt;
    line-height: 1.55;
    padding: 36px 40px;
    box-sizing: border-box;
  `;

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2.5px solid #2563eb; padding-bottom:8px; margin-bottom:16px;">
      <div>
        <div style="font-size:14pt; font-weight:800; color:#2563eb; letter-spacing:-0.3px;">All' Inclusive · Studio Pédagogique</div>
        <div style="font-size:8.5pt; color:#64748b; margin-top:2px; font-weight:500;">Conception Universelle des Apprentissages & IA Souveraine</div>
      </div>
      <div style="text-align:right; font-size:9pt; color:#475569; line-height:1.35;">
        ${meta.cycle ? `<div><strong>Niveau :</strong> ${meta.cycle}</div>` : ''}
        ${meta.discipline ? `<div><strong>Discipline :</strong> ${meta.discipline}</div>` : ''}
        ${meta.theme ? `<div><strong>Thème :</strong> ${meta.theme}</div>` : ''}
      </div>
    </div>
    <div class="pdf-body">${htmlContent}</div>
  `;

  // Apply print-friendly styling to inner elements
  const tables = container.querySelectorAll('table');
  tables.forEach(t => {
    t.style.cssText = 'width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11pt;';
  });
  container.querySelectorAll('th').forEach(th => {
    th.style.cssText = 'background-color: #2563eb; color: #ffffff; padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;';
  });
  container.querySelectorAll('td').forEach(td => {
    td.style.cssText = 'padding: 6px 8px; border: 1px solid #cbd5e1; vertical-align: top;';
  });
  container.querySelectorAll('.picto-card').forEach(pc => {
    pc.style.cssText = 'border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 6px; text-align: center; background: #fff; display: inline-flex; flex-direction: column; align-items: center; width: 110px; margin: 4px;';
  });

  document.body.appendChild(container);

  // Wait for all images
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(images.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(res => { img.onload = img.onerror = res; });
  }));

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const pdfHeight = 297;
    const margin = 10;
    const contentWidth = pdfWidth - (margin * 2);

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const pageHeightPx = (canvasWidth / contentWidth) * (pdfHeight - (margin * 2));

    let renderedHeight = 0;
    let pageNum = 0;

    while (renderedHeight < canvasHeight) {
      if (pageNum > 0) pdf.addPage();

      const sourceY = renderedHeight;
      const sourceHeight = Math.min(pageHeightPx, canvasHeight - renderedHeight);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvasWidth;
      pageCanvas.height = sourceHeight;
      const ctx = pageCanvas.getContext('2d');

      ctx.drawImage(
        canvas,
        0, sourceY, canvasWidth, sourceHeight,
        0, 0, canvasWidth, sourceHeight
      );

      const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
      const renderHeightMm = (sourceHeight / canvasWidth) * contentWidth;

      pdf.addImage(pageImgData, 'JPEG', margin, margin, contentWidth, renderHeightMm);

      // Page footer
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`Page ${pageNum + 1} — All' Inclusive`, pdfWidth - margin, pdfHeight - 4, { align: 'right' });

      renderedHeight += pageHeightPx;
      pageNum++;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Télécharge directement le fichier PDF binaire sans passer par la fenêtre d'impression
 */
export async function exportDirectPDF(title, htmlContent, meta = {}, customFilename = null) {
  window.showToast("Génération du fichier PDF en cours... ⏳");
  const blob = await getDirectPDFBlob(title, htmlContent, meta);
  const filename = customFilename || cleanFilename(title, 'pdf');
  triggerDownload(blob, filename);
  window.showToast("Fichier PDF téléchargé avec succès ! 📕");
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
}
