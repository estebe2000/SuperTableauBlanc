/**
 * Client ARASAAC & Clé de Fitzgerald — Banque de pictogrammes libres pour la CAA.
 * Gouvernement d'Aragon / Sergio Palao (Licence CC BY-NC-SA 4.0).
 */

export const PICTO_STATIC = 'https://static.arasaac.org/pictograms';
export const PICTO_API = 'https://api.arasaac.org/v1';

export const ARASAAC_CREDIT =
  "Pictogrammes : ARASAAC (https://arasaac.org) — Sergio Palao, Gouvernement d'Aragon, CC BY-NC-SA.";

/**
 * Construit l'URL d'un pictogramme.
 */
export function pictoUrl(id, opts = {}) {
  const plural = opts.plural === true;
  const action = (opts.action === 'past' || opts.action === 'future') ? opts.action : '';
  const nocolor = opts.color === false;

  if (!plural && !action && !nocolor) {
    const res = (opts.resolution === 500 || opts.resolution === 2500) ? opts.resolution : 300;
    return `${PICTO_STATIC}/${id}/${id}_${res}.png`;
  }

  // Si variante demandée, basculer sur l'API dynamique
  const q = [];
  if (plural) q.push('plural=true');
  if (action) q.push(`action=${action}`);
  if (nocolor) q.push('color=false');
  q.push(`resolution=${opts.resolution === 2500 ? 2500 : 500}`);
  q.push('url=false');
  return `${PICTO_API}/pictograms/${id}?${q.join('&')}`;
}

/**
 * Recherche des pictogrammes par mot-clé (CORS public).
 */
export async function searchPictos(word) {
  if (!word || typeof word !== 'string' || word.trim().length === 0) return [];
  const normalized = word.trim().toLowerCase();
  
  try {
    const res = await fetch(`${PICTO_API}/pictograms/fr/bestsearch/${encodeURIComponent(normalized)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.slice(0, 8) : [];
  } catch (err) {
    console.warn("Erreur recherche ARASAAC:", err);
    return [];
  }
}

/**
 * Retourne la classe CSS / couleur selon la Clé de Fitzgerald (1929)
 */
export function fitzgeraldColor(category) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('person') || cat.includes('sujet') || cat.includes('pronom')) {
    return { bg: '#fef08a', border: '#ca8a04', text: '#854d0e', name: 'Personne' };
  }
  if (cat.includes('action') || cat.includes('verbe')) {
    return { bg: '#bbf7d0', border: '#16a34a', text: '#14532d', name: 'Action' };
  }
  if (cat.includes('objet') || cat.includes('chose') || cat.includes('nom')) {
    return { bg: '#fed7aa', border: '#ea580c', text: '#7c2d12', name: 'Objet' };
  }
  if (cat.includes('desc') || cat.includes('adjectif') || cat.includes('qualite')) {
    return { bg: '#bfdbfe', border: '#2563eb', text: '#1e3a8a', name: 'Description' };
  }
  if (cat.includes('social') || cat.includes('politesse') || cat.includes('emotion')) {
    return { bg: '#fbcfe8', border: '#db2777', text: '#831843', name: 'Social' };
  }
  return { bg: '#f3f4f6', border: '#9ca3af', text: '#374151', name: 'Divers' };
}
