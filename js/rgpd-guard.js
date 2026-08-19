/**
 * RGPD Guard — Détecteur préventif de données sensibles et médicales côté client.
 * Analyse les champs de texte avant envoi aux LLMs (Albert, ILaaS, Mistral, Ollama)
 * pour éviter toute transmission de données nominatives ou médicales protégées.
 */

const MEDICAL_KEYWORDS = [
  'autisme', 'autiste', 'trisomie', 'epilepsie', 'epileptique',
  'dyslexie', 'dyslexique', 'dyspraxie', 'dyspraxique',
  'dyscalculie', 'dyscalculique', 'dysorthographie',
  'dysphasie', 'dysphasique', 'asperger', 'tdah',
  'hyperactif', 'hyperactivite', 'schizophrenie',
  'bipolaire', 'depression', 'anxieux', 'psychotique',
  'handicap mental', 'deficience intellectuelle',
  'trouble envahissant', 'spectre autistique',
  'trouble oppositionnel', 'trouble des conduites'
];

const MDPH_PATTERN = /\b\d{2}[\s.-]?\d{2,}[\s.-]?\d{2,}[\s.-]?\d{2,}\b/;
const PHONE_PATTERN = /(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const ADDRESS_PATTERN = /\d{1,4}[\s,]+(?:rue|avenue|boulevard|impasse|chemin|place|allee|passage|route)\s+/i;
const NAME_PATTERN = /(?<=[.!?\s]\s*)[A-Z][a-z]+\s+[A-Z][a-z]+/g;

/**
 * Analyse un texte et retourne la liste des alertes de confidentialité.
 * @param {string} text
 * @returns {Array<{ id: string, level: 'warning' | 'error', message: string }>}
 */
export function checkRGPD(text) {
  const alerts = [];
  if (!text || typeof text !== 'string' || text.trim().length === 0) return alerts;

  const lower = text.toLowerCase();

  // 1. Diagnostic médical protégé
  for (const keyword of MEDICAL_KEYWORDS) {
    if (lower.includes(keyword)) {
      alerts.push({
        id: 'diagnosis',
        level: 'warning',
        message: `Terme médical ou diagnostic détecté (« ${keyword} »). Préférez décrire les besoins fonctionnels (ex: « besoin d'aération visuelle ») plutôt qu'un diagnostic médical.`
      });
      break;
    }
  }

  // 2. Numéro de dossier MDPH
  if (MDPH_PATTERN.test(text) && lower.includes('mdph')) {
    alerts.push({
      id: 'mdph',
      level: 'error',
      message: "Numéro de dossier MDPH détecté. Ne transmettez aucun identifiant administratif."
    });
  }

  // 3. Numéro de téléphone
  if (PHONE_PATTERN.test(text)) {
    alerts.push({
      id: 'phone',
      level: 'error',
      message: "Numéro de téléphone détecté. Supprimez toute coordonnée personnelle."
    });
  }

  // 4. Adresse e-mail
  if (EMAIL_PATTERN.test(text)) {
    alerts.push({
      id: 'email',
      level: 'error',
      message: "Adresse e-mail détectée. Anonymisez les adresses électroniques."
    });
  }

  // 5. Adresse postale
  if (ADDRESS_PATTERN.test(text)) {
    alerts.push({
      id: 'address',
      level: 'error',
      message: "Adresse postale détectée. Retirez les adresses physiques."
    });
  }

  // 6. Noms d'élèves potentiels
  const nameMatches = text.match(NAME_PATTERN);
  if (nameMatches && nameMatches.length > 0) {
    alerts.push({
      id: 'name',
      level: 'warning',
      message: `Nom propre potentiel détecté (« ${nameMatches[0]} »). Utilisez des pseudonymes ou désignations génériques (Élève A, Groupe 1).`
    });
  }

  return alerts;
}
