/**
 * Export OpenDocument Text (.odt / ODF 1.2) Accessible en pur JavaScript côté client.
 * Conforme à la charte CUA : Police Arial corps 14, interligne 1.5, pas d'italique,
 * encadrés pastel avec bordures nettes pour LibreOffice Writer, Word et Google Docs.
 */

var _crcTable = null;
function crc32(bytes) {
  if (!_crcTable) {
    _crcTable = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      _crcTable[n] = c >>> 0;
    }
  }
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ _crcTable[(crc ^ bytes[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function _u16(n) { return [n & 0xFF, (n >>> 8) & 0xFF]; }
function _u32(n) { return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]; }

function zipStore(entries) {
  var enc = new TextEncoder();
  var chunks = [];
  var central = [];
  var offset = 0;

  entries.forEach(function (e) {
    var nameBytes = enc.encode(e.name);
    var data = e.bytes;
    var crc = crc32(data);
    var size = data.length;

    var local = [
      0x50, 0x4B, 0x03, 0x04,
      20, 0, 0, 0, 0, 0,
      0, 0, 0, 0,
      _u32(crc), _u32(size), _u32(size),
      _u16(nameBytes.length), 0, 0
    ].flat();

    chunks.push(new Uint8Array(local), nameBytes, data);

    var cdir = [
      0x50, 0x4B, 0x01, 0x02,
      20, 0, 20, 0, 0, 0, 0, 0,
      0, 0, 0, 0,
      _u32(crc), _u32(size), _u32(size),
      _u16(nameBytes.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      _u32(offset)
    ].flat();

    central.push(new Uint8Array(cdir), nameBytes);
    offset += local.length + nameBytes.length + size;
  });

  var centralOffset = offset;
  var centralSize = central.reduce(function (acc, c) { return acc + c.length; }, 0);

  var end = [
    0x50, 0x4B, 0x05, 0x06,
    0, 0, 0, 0,
    _u16(entries.length), _u16(entries.length),
    _u32(centralSize), _u32(centralOffset),
    0, 0
  ].flat();

  var all = chunks.concat(central, [new Uint8Array(end)]);
  var totalLen = all.reduce(function (acc, c) { return acc + c.length; }, 0);
  var out = new Uint8Array(totalLen);
  var pos = 0;
  all.forEach(function (c) { out.set(c, pos); pos += c.length; });
  return out;
}

function escapeXml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convertit du texte Markdown simple en paragraphes XML OpenDocument
 */
function markdownToOdfXml(text) {
  var lines = (text || '').split('\n');
  var xml = '';
  
  lines.forEach(function(line) {
    var trimmed = line.trim();
    if (!trimmed) {
      xml += '<text:p text:style-name="Standard"/>';
      return;
    }

    if (trimmed.startsWith('# ')) {
      xml += `<text:h text:style-name="Heading_1" text:outline-level="1">${escapeXml(trimmed.substring(2))}</text:h>`;
    } else if (trimmed.startsWith('## ')) {
      xml += `<text:h text:style-name="Heading_2" text:outline-level="2">${escapeXml(trimmed.substring(3))}</text:h>`;
    } else if (trimmed.startsWith('### ')) {
      xml += `<text:h text:style-name="Heading_3" text:outline-level="3">${escapeXml(trimmed.substring(4))}</text:h>`;
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      xml += `<text:list text:style-name="L1"><text:list-item><text:p text:style-name="P_List">${escapeXml(trimmed.substring(2))}</text:p></text:list-item></text:list>`;
    } else if (trimmed.startsWith('> ')) {
      xml += `<text:p text:style-name="P_Quote">${escapeXml(trimmed.substring(2))}</text:p>`;
    } else {
      // Bold handling: **texte** -> <text:span text:style-name="T_Bold">texte</text:span>
      var formatted = escapeXml(trimmed).replace(/\*\*(.*?)\*\*/g, '<text:span text:style-name="T_Bold">$1</text:span>');
      xml += `<text:p text:style-name="P_CUA">${formatted}</text:p>`;
    }
  });

  return xml;
}

/**
 * Construit le contenu XML complet du document ODF 1.2
 */
export function buildOdtContentXml(title, markdownBody) {
  var bodyXml = markdownToOdfXml(markdownBody);

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
 xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
 xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
 office:version="1.2">
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
</office:document-content>`;
}

/**
 * Construit et télécharge un fichier .odt accessible en pur JavaScript.
 */
export function downloadOdt(title, markdownBody, filename) {
  var enc = new TextEncoder();
  var mimetypeBytes = enc.encode("application/vnd.oasis.opendocument.text");
  var manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;
  
  var contentXml = buildOdtContentXml(title, markdownBody);

  var zipBytes = zipStore([
    { name: "mimetype", bytes: mimetypeBytes },
    { name: "META-INF/manifest.xml", bytes: enc.encode(manifestXml) },
    { name: "content.xml", bytes: enc.encode(contentXml) }
  ]);

  var blob = new Blob([zipBytes], { type: "application/vnd.oasis.opendocument.text" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename || `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_accessible.odt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
