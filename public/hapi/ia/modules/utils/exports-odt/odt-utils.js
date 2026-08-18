// Fichier: modules/utils/exports-odt/odt-utils.js

import JSZip from '../../../../vendor/jszip/jszip.esm.js';

// --- Utilitaires Texte & Fichiers ---

export function echapperXML(texte) {
    if (typeof texte !== 'string') return '';
    return texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function sanitizeFileName(nom) {
    if (typeof nom !== 'string') nom = 'export';
    return nom.replace(/[^a-zA-Z0-9À-ÿ\-_\s]/g, '').replace(/\s+/g, '-').substring(0, 50);
}

export function telechargerTexte(contenu, nomFichier) {
    const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none'; 
    a.href = url; 
    a.download = nomFichier;
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function telechargerBlob(blob, nomFichier) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none'; 
    a.href = url; 
    a.download = nomFichier;
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Socle ODT ---

export function createBaseODT() {
    const zip = new JSZip();
    zip.file("mimetype", "application/vnd.oasis.opendocument.text");
    return zip;
}

export function generateManifestXML(extraEntries = []) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
 <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
 <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
 <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>`;

    extraEntries.forEach(entry => {
        xml += `\n <manifest:file-entry manifest:full-path="${entry.path}" manifest:media-type="${entry.type}"/>`;
    });

    xml += `\n</manifest:manifest>`;
    return xml;
}

export function generateStylesXML(customStyles = '') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
  <office:styles>
    <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
    <style:style style:name="Heading" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:class="text">
      <style:text-properties fo:font-size="14pt" fo:font-weight="bold" fo:font-name="Arial"/>
    </style:style>
    ${customStyles}
  </office:styles>
</office:document-styles>`;
}

// ⚠️ MODIFICATION CRITIQUE ICI : Ajout de xmlns:math
export function wrapContentXML(bodyContent, automaticStyles = '') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content 
    xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" 
    xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" 
    xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" 
    xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" 
    xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" 
    xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" 
    xmlns:xlink="http://www.w3.org/1999/xlink" 
    xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" 
    xmlns:math="http://www.w3.org/1998/Math/MathML" 
    office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="Heading_1" style:family="paragraph" style:parent-style-name="Heading">
      <style:text-properties fo:font-size="18pt" fo:color="#2c3e50" fo:text-align="center"/>
    </style:style>
    ${automaticStyles}
  </office:automatic-styles>
  <office:body>
    <office:text>
      ${bodyContent}
    </office:text>
  </office:body>
</office:document-content>`;
}