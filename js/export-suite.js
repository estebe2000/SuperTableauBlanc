/**
 * Export Suite — Suite complète d'exportation pédagogique accessible multi-formats :
 * - ODT (OpenDocument 1.2 CUA)
 * - Word (.doc / .docx compatible)
 * - PDF (Impression / Mise en page CUA haute lisibilité)
 * - Markdown (.md brut)
 * - LaTeX (.tex structuré et compilable)
 */

import { downloadOdt } from './odt-export.js';

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
 * 1. Export ODT (OpenDocument Accessible)
 */
export function exportODT(title, htmlOrMd) {
  downloadOdt(title, htmlOrMd, cleanFilename(title, 'odt'));
}

/**
 * 2. Export Word (.doc / HTML-based OpenXML compatible)
 */
export function exportWord(title, htmlContent, meta = {}) {
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

  const blob = new Blob(['\ufeff' + header], { type: 'application/msword;charset=utf-8' });
  triggerDownload(blob, cleanFilename(title, 'doc'));
}

/**
 * 3. Export PDF (Impression Haute Fidélité CUA)
 */
export function exportPDF(title, htmlContent, meta = {}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.showToast("Veuillez autoriser les fenêtres pop-up pour générer le PDF.");
    return;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${title || 'Séance Pédagogique'}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 18mm 14mm 18mm 14mm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12.5pt;
    line-height: 1.55;
    color: #0f172a;
    background: #ffffff;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .print-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2.5px solid #2563eb;
    padding-bottom: 8px;
    margin-bottom: 16px;
  }
  .print-brand {
    font-size: 14pt;
    font-weight: 800;
    color: #2563eb;
    letter-spacing: -0.3px;
  }
  .print-sub {
    font-size: 8.5pt;
    color: #64748b;
    margin-top: 2px;
    font-weight: 500;
  }
  .print-meta {
    text-align: right;
    font-size: 9pt;
    color: #475569;
    line-height: 1.35;
  }
  h1 {
    font-size: 18pt;
    color: #1e293b;
    margin: 12px 0 16px 0;
    line-height: 1.3;
  }
  h2 {
    font-size: 14.5pt;
    color: #1d4ed8;
    margin-top: 22px;
    margin-bottom: 8px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4px;
    page-break-after: avoid;
    break-after: avoid;
  }
  h3 {
    font-size: 12.5pt;
    color: #0f766e;
    margin-top: 16px;
    margin-bottom: 6px;
    page-break-after: avoid;
    break-after: avoid;
  }
  p, li {
    font-size: 12pt;
    line-height: 1.5;
    margin-top: 4px;
    margin-bottom: 6px;
  }
  strong, b {
    font-weight: 700;
    color: #0f172a;
  }
  blockquote {
    background: #f0f9ff;
    border-left: 4px solid #0284c7;
    padding: 8px 12px;
    margin: 12px 0;
    border-radius: 4px;
    font-size: 11.5pt;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 14px 0;
    page-break-inside: avoid;
    break-inside: avoid;
    font-size: 11pt;
  }
  th {
    background-color: #2563eb !important;
    color: #ffffff !important;
    padding: 7px 10px;
    border: 1px solid #94a3b8;
    text-align: left;
    font-weight: 700;
  }
  td {
    padding: 7px 10px;
    border: 1px solid #cbd5e1;
    vertical-align: top;
  }
  tr:nth-child(even) td {
    background-color: #f8fafc;
  }
  .picto-lexique-container {
    margin: 16px 0;
    padding: 12px;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .picto-cards-grid {
    display: grid !important;
    grid-template-columns: repeat(4, 1fr) !important;
    gap: 10px !important;
  }
  .picto-card {
    background: #ffffff !important;
    border: 1.5px solid #cbd5e1 !important;
    border-radius: 6px !important;
    padding: 6px !important;
    text-align: center !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .picto-card img {
    width: 55px !important;
    height: 55px !important;
    object-fit: contain !important;
  }
  .mermaid-container, svg {
    max-width: 100% !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    margin: 12px auto;
  }
  pre, code {
    font-family: Consolas, Monaco, "Courier New", monospace;
    font-size: 10pt;
    background: #f1f5f9;
    padding: 6px;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
  }
  hr {
    border: none;
    border-top: 1.5px solid #cbd5e1;
    margin: 18px 0;
  }
  @media print {
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="print-header">
    <div>
      <div class="print-brand">All' Inclusive · Studio Pédagogique</div>
      <div class="print-sub">Conception Universelle des Apprentissages & IA Souveraine</div>
    </div>
    <div class="print-meta">
      ${meta.cycle ? `<div><strong>Niveau :</strong> ${meta.cycle}</div>` : ''}
      ${meta.discipline ? `<div><strong>Discipline :</strong> ${meta.discipline}</div>` : ''}
      ${meta.theme ? `<div><strong>Thème :</strong> ${meta.theme}</div>` : ''}
    </div>
  </div>

  ${htmlContent}

  <script>
    window.onload = function() {
      const images = Array.from(document.images);
      Promise.all(images.filter(img => !img.complete).map(img => new Promise(res => {
        img.onload = img.onerror = res;
      }))).then(function() {
        setTimeout(function() {
          window.print();
        }, 300);
      });
    };
  </script>
</body>
</html>`);
  printWindow.document.close();
}

/**
 * 4. Export Markdown (.md)
 */
export function exportMarkdown(title, mdContent) {
  const fullContent = `# ${title || 'Séance Pédagogique'}\n\n${mdContent}`;
  const blob = new Blob([fullContent], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, cleanFilename(title, 'md'));
}

/**
 * 5. Export LaTeX (.tex)
 */
export function exportLatex(title, mdContent) {
  function mdToLatex(text) {
    let lines = (text || '').split('\n');
    let latex = '';
    let inList = false;

    lines.forEach(line => {
      let l = line.trim();
      if (!l) {
        if (inList) { latex += '\\end{itemize}\n'; inList = false; }
        latex += '\n';
        return;
      }

      // Headers
      if (l.startsWith('# ')) {
        if (inList) { latex += '\\end{itemize}\n'; inList = false; }
        latex += `\\section*{${escapeLatex(l.substring(2))}}\n`;
      } else if (l.startsWith('## ')) {
        if (inList) { latex += '\\end{itemize}\n'; inList = false; }
        latex += `\\subsection*{${escapeLatex(l.substring(3))}}\n`;
      } else if (l.startsWith('### ')) {
        if (inList) { latex += '\\end{itemize}\n'; inList = false; }
        latex += `\\subsubsection*{${escapeLatex(l.substring(4))}}\n`;
      } else if (l.startsWith('- ') || l.startsWith('* ')) {
        if (!inList) { latex += '\\begin{itemize}\n'; inList = true; }
        latex += `  \\item ${formatLatexInline(l.substring(2))}\n`;
      } else if (l.startsWith('> ')) {
        if (inList) { latex += '\\end{itemize}\n'; inList = false; }
        latex += `\\begin{quote}\n\\textbf{${escapeLatex(l.substring(2))}}\n\\end{quote}\n`;
      } else if (l.startsWith('|') && l.endsWith('|')) {
        // Simple table line placeholder or skip table delimiters
        if (!l.includes('---')) {
          const cells = l.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          latex += cells.map(c => escapeLatex(c.trim())).join(' & ') + ' \\\\\n';
        }
      } else {
        if (inList) { latex += '\\end{itemize}\n'; inList = false; }
        latex += `${formatLatexInline(l)}\n\n`;
      }
    });

    if (inList) latex += '\\end{itemize}\n';
    return latex;
  }

  function escapeLatex(str) {
    return (str || '')
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }

  function formatLatexInline(str) {
    let res = escapeLatex(str);
    // Convert bold
    res = res.replace(/\\\*\\\*(.*?)\\\*\\\*/g, '\\textbf{$1}');
    return res;
  }

  const texDoc = `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[french]{babel}
\\usepackage{geometry}
\\usepackage{xcolor}
\\usepackage{amsmath,amssymb}
\\usepackage{hyperref}
\\usepackage{booktabs}
\\usepackage{parskip}

\\geometry{margin=2.5cm}

\\title{\\textbf{${escapeLatex(title || 'Séance Pédagogique')}}}
\\author{All' Inclusive · Studio Pédagogique}
\\date{\\today}

\\begin{document}

\\maketitle

${mdToLatex(mdContent)}

\\end{document}`;

  const blob = new Blob([texDoc], { type: 'application/x-latex;charset=utf-8' });
  triggerDownload(blob, cleanFilename(title, 'tex'));
}
