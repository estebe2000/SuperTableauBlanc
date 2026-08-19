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
export function exportWord(title, htmlContent) {
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
  body { font-family: Arial, Helvetica, sans-serif; font-size: 14pt; line-height: 1.5; color: #0f172a; margin: 2.5cm; }
  h1 { font-size: 20pt; color: #1e293b; border-bottom: 2pt solid #2563eb; padding-bottom: 6pt; margin-top: 18pt; }
  h2 { font-size: 16pt; color: #2563eb; margin-top: 14pt; }
  h3 { font-size: 14pt; color: #0f766e; margin-top: 12pt; }
  p, li { font-size: 14pt; line-height: 1.5; }
  blockquote { background: #eff6ff; border-left: 4pt solid #3b82f6; padding: 10pt; margin: 10pt 0; font-weight: bold; }
  table { border-collapse: collapse; width: 100%; margin: 14pt 0; }
  th { background-color: #2563eb; color: #ffffff; padding: 8pt; border: 1pt solid #cbd5e1; text-align: left; font-weight: bold; }
  td { padding: 8pt; border: 1pt solid #cbd5e1; vertical-align: top; }
  pre, code { font-family: 'Courier New', monospace; font-size: 12pt; background: #f8fafc; padding: 6pt; border: 1pt solid #e2e8f0; }
</style>
</head>
<body>
  <h1>${title || 'Séance Pédagogique'}</h1>
  ${htmlContent}
</body>
</html>`;

  const blob = new Blob(['\ufeff' + header], { type: 'application/msword;charset=utf-8' });
  triggerDownload(blob, cleanFilename(title, 'doc'));
}

/**
 * 3. Export PDF (Impression stylée CUA)
 */
export function exportPDF(title, htmlContent) {
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
  @page { size: A4; margin: 20mm; }
  body {
    font-family: Arial, -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13pt;
    line-height: 1.5;
    color: #0f172a;
    background: #ffffff;
    margin: 0;
    padding: 10px;
  }
  h1 { font-size: 20pt; color: #1e293b; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-top: 0; }
  h2 { font-size: 16pt; color: #2563eb; margin-top: 20px; page-break-after: avoid; }
  h3 { font-size: 14pt; color: #0f766e; margin-top: 16px; page-break-after: avoid; }
  p, li { font-size: 13pt; line-height: 1.5; }
  blockquote { background: #f0f9ff; border-left: 4px solid #0284c7; padding: 10px 14px; margin: 14px 0; border-radius: 4px; font-weight: 500; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; page-break-inside: avoid; }
  th { background-color: #2563eb; color: #ffffff; padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left; }
  td { padding: 8px 10px; border: 1px solid #cbd5e1; vertical-align: top; }
  pre, code { font-family: monospace; font-size: 11pt; background: #f1f5f9; padding: 6px; border-radius: 4px; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <h1>${title || 'Séance Pédagogique'}</h1>
  ${htmlContent}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
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
