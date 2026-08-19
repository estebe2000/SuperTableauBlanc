/**
 * Export OpenDocument Text (.odt / ODF 1.2) Accessible en pur JavaScript côté client.
 * Conforme à la charte CUA : Police Arial corps 14, interligne 1.5, pas d'italique,
 * encadrés pastel avec bordures nettes et support intégral des tableaux pour LibreOffice Writer, Word et Google Docs.
 */

function escapeXml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convertit un arbre DOM ou du HTML en balises ODF 1.2 avec support des tableaux, titres, listes et blocs
 */
export function htmlToOdfBody(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');

  function traverse(node) {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeXml(node.textContent);
    }

    const tag = node.tagName ? node.tagName.toLowerCase() : '';

    if (tag === 'h1') {
      return `<text:h text:style-name="Heading_1" text:outline-level="1">${traverseChildren(node)}</text:h>`;
    }
    if (tag === 'h2') {
      return `<text:h text:style-name="Heading_2" text:outline-level="2">${traverseChildren(node)}</text:h>`;
    }
    if (tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
      return `<text:h text:style-name="Heading_3" text:outline-level="3">${traverseChildren(node)}</text:h>`;
    }
    if (tag === 'p') {
      return `<text:p text:style-name="P_CUA">${traverseChildren(node)}</text:p>`;
    }
    if (tag === 'strong' || tag === 'b') {
      return `<text:span text:style-name="T_Bold">${traverseChildren(node)}</text:span>`;
    }
    if (tag === 'blockquote') {
      return `<text:p text:style-name="P_Quote">${traverseChildren(node)}</text:p>`;
    }
    if (tag === 'ul' || tag === 'ol') {
      let listXml = '<text:list text:style-name="L1">';
      node.childNodes.forEach(child => {
        if (child.tagName && child.tagName.toLowerCase() === 'li') {
          listXml += `<text:list-item><text:p text:style-name="P_List">${traverseChildren(child)}</text:p></text:list-item>`;
        }
      });
      listXml += '</text:list>';
      return listXml;
    }
    if (tag === 'li') {
      return `<text:p text:style-name="P_List">• ${traverseChildren(node)}</text:p>`;
    }
    if (tag === 'table') {
      let tableXml = '<table:table table:name="TableauCUA">';
      node.childNodes.forEach(child => {
        tableXml += traverse(child);
      });
      tableXml += '</table:table>';
      return tableXml;
    }
    if (tag === 'thead' || tag === 'tbody') {
      return traverseChildren(node);
    }
    if (tag === 'tr') {
      let rowXml = '<table:table-row>';
      node.childNodes.forEach(child => {
        rowXml += traverse(child);
      });
      rowXml += '</table:table-row>';
      return rowXml;
    }
    if (tag === 'th') {
      return `<table:table-cell office:value-type="string"><text:p text:style-name="P_TableHeader"><text:span text:style-name="T_Bold">${traverseChildren(node)}</text:span></text:p></table:table-cell>`;
    }
    if (tag === 'td') {
      return `<table:table-cell office:value-type="string"><text:p text:style-name="P_TableCell">${traverseChildren(node)}</text:p></table:table-cell>`;
    }
    if (tag === 'hr') {
      return `<text:p text:style-name="Standard"/>`;
    }
    if (tag === 'svg') {
      try {
        const svgClone = node.cloneNode(true);
        if (!svgClone.getAttribute('xmlns')) {
          svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }
        const svgStr = new XMLSerializer().serializeToString(svgClone);
        const b64 = btoa(unescape(encodeURIComponent(svgStr)));
        return `<text:p text:style-name="P_CUA"><draw:frame draw:style-name="Graf1" draw:name="MermaidDiagramme" text:anchor-type="as-char" svg:width="16cm" svg:height="8.5cm"><draw:image><office:binary-data>${b64}</office:binary-data></draw:image></draw:frame></text:p>`;
      } catch (e) {
        return `<text:p text:style-name="P_Code">${escapeXml(node.textContent)}</text:p>`;
      }
    }
    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      const alt = escapeXml(node.getAttribute('alt') || 'Illustration');
      if (src.startsWith('data:image/')) {
        const b64 = src.split(',')[1] || '';
        return `<draw:frame draw:style-name="Graf1" draw:name="${alt}" text:anchor-type="as-char" svg:width="2.5cm" svg:height="2.5cm"><draw:image><office:binary-data>${b64}</office:binary-data></draw:image></draw:frame>`;
      }
      return `<draw:frame draw:style-name="Graf1" draw:name="${alt}" text:anchor-type="as-char" svg:width="2.5cm" svg:height="2.5cm"><draw:image xlink:href="${escapeXml(src)}"/></draw:frame>`;
    }
    if (node.classList && node.classList.contains('picto-card')) {
      return `<text:p text:style-name="P_Quote">${traverseChildren(node)}</text:p>`;
    }
    if (tag === 'pre' || tag === 'code') {
      // Check if it is a raw mermaid block that was not rendered as SVG
      if (node.textContent.includes('graph ') || node.textContent.includes('flowchart ') || node.textContent.includes('mindmap')) {
        return `<text:p text:style-name="P_Code">[Diagramme de synthèse]\n${escapeXml(node.textContent)}</text:p>`;
      }
      return `<text:p text:style-name="P_Code">${escapeXml(node.textContent)}</text:p>`;
    }

    return traverseChildren(node);
  }

  function traverseChildren(node) {
    let res = '';
    node.childNodes.forEach(child => {
      res += traverse(child);
    });
    return res;
  }

  return traverseChildren(doc.body);
}

/**
 * Construit un document Flat OpenDocument Text (FODT 1.2) complet et auto-contenu
 */
export function buildFodtXml(title, htmlContent) {
  const bodyXml = htmlToOdfBody(htmlContent);

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
                 xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
                 xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
                 xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
                 office:version="1.2"
                 office:mimetype="application/vnd.oasis.opendocument.text">
  <office:font-face-decls>
    <style:font-face style:name="Arial" svg:font-family="Arial, sans-serif"/>
  </office:font-face-decls>
  <office:automatic-styles>
    <style:style style:name="Heading_1" style:family="paragraph">
      <style:text-properties fo:font-family="Arial" fo:font-size="20pt" fo:font-weight="bold" fo:color="#1e293b"/>
      <style:paragraph-properties fo:margin-top="14pt" fo:margin-bottom="8pt" fo:line-height="150%"/>
    </style:style>
    <style:style style:name="Heading_2" style:family="paragraph">
      <style:text-properties fo:font-family="Arial" fo:font-size="16pt" fo:font-weight="bold" fo:color="#2563eb"/>
      <style:paragraph-properties fo:margin-top="12pt" fo:margin-bottom="6pt" fo:line-height="150%"/>
    </style:style>
    <style:style style:name="Heading_3" style:family="paragraph">
      <style:text-properties fo:font-family="Arial" fo:font-size="14pt" fo:font-weight="bold" fo:color="#0f766e"/>
      <style:paragraph-properties fo:margin-top="10pt" fo:margin-bottom="4pt" fo:line-height="150%"/>
    </style:style>
    <style:style style:name="P_CUA" style:family="paragraph">
      <style:text-properties fo:font-family="Arial" fo:font-size="14pt" fo:color="#0f172a"/>
      <style:paragraph-properties fo:line-height="150%" fo:margin-bottom="8pt" fo:text-align="start"/>
    </style:style>
    <style:style style:name="P_List" style:family="paragraph">
      <style:text-properties fo:font-family="Arial" fo:font-size="14pt" fo:color="#0f172a"/>
      <style:paragraph-properties fo:line-height="150%" fo:margin-bottom="4pt"/>
    </style:style>
    <style:style style:name="P_Quote" style:family="paragraph">
      <style:text-properties fo:font-family="Arial" fo:font-size="13pt" fo:font-weight="bold" fo:color="#1e3a8a"/>
      <style:paragraph-properties fo:line-height="140%" fo:margin-top="6pt" fo:margin-bottom="6pt" fo:margin-left="12pt" fo:background-color="#eff6ff" fo:padding="8pt" fo:border="1pt solid #93c5fd"/>
    </style:style>
    <style:style style:name="P_TableHeader" style:family="paragraph">
      <style:text-properties fo:font-family="Arial" fo:font-size="13pt" fo:font-weight="bold" fo:color="#ffffff"/>
      <style:paragraph-properties fo:line-height="130%" fo:background-color="#2563eb" fo:padding="6pt"/>
    </style:style>
    <style:style style:name="P_TableCell" style:family="paragraph">
      <style:text-properties fo:font-family="Arial" fo:font-size="13pt" fo:color="#0f172a"/>
      <style:paragraph-properties fo:line-height="130%" fo:padding="6pt" fo:border="0.5pt solid #cbd5e1"/>
    </style:style>
    <style:style style:name="P_Code" style:family="paragraph">
      <style:text-properties fo:font-family="Courier New, monospace" fo:font-size="12pt" fo:color="#334155"/>
      <style:paragraph-properties fo:line-height="120%" fo:background-color="#f8fafc" fo:padding="6pt" fo:border="1pt solid #e2e8f0"/>
    </style:style>
    <style:style style:name="T_Bold" style:family="text">
      <style:text-properties fo:font-weight="bold"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      <text:h text:style-name="Heading_1" text:outline-level="1">${escapeXml(title)}</text:h>
      ${bodyXml}
    </office:text>
  </office:body>
</office:document>`;
}

/**
 * Construit un Blob ODT (OpenDocument Accessible)
 */
export function getOdtBlob(title, markdownOrHtml) {
  let html = markdownOrHtml || '';
  if (window.marked && !html.includes('<p>') && !html.includes('<h')) {
    html = window.marked.parse(markdownOrHtml);
  }
  const cleanTitle = title || 'Seance_Pedagogique';
  const xmlContent = buildFodtXml(cleanTitle, html);
  return new Blob([xmlContent], { type: 'application/vnd.oasis.opendocument.text;charset=utf-8' });
}

/**
 * Télécharge le document au format OpenDocument Accessible (.odt)
 */
export function downloadOdt(title, markdownOrHtml, filename) {
  const cleanTitle = title || 'Seance_Pedagogique';
  const blob = getOdtBlob(cleanTitle, markdownOrHtml);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const safeFilename = filename || `${cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_accessible.odt`;
  a.download = safeFilename;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
