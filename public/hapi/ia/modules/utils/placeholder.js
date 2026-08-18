// Fichier: modules/utils/placeholder.js
//
// RGPD : génère localement les images « placeholder » (aperçu, erreur, manquant)
// auparavant servies par un service d'images tiers (US). Aucune requête réseau :
// l'image est une data-URI SVG construite côté client.
//
// Le marqueur id="hapi-ph" permet de reconnaître un placeholder via
// src.includes('hapi-ph') (ancien équivalent : détection par nom de domaine tiers).

export function localPlaceholder(text = '', { w = 400, h = 400, bg = '#e2e8f0', fg = '#475569' } = {}) {
    const fontSize = Math.max(12, Math.round(Math.min(w, h) / 10));
    const safe = String(text).replace(/[<>&]/g, ' ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
        `<rect id="hapi-ph" width="${w}" height="${h}" fill="${bg}"/>` +
        `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ` +
        `font-family="sans-serif" font-size="${fontSize}" fill="${fg}" font-weight="600">${safe}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
