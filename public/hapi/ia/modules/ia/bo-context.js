// Fichier: modules/ia/bo-context.js
// Module RAG pour HAPI : interroge le service /api/bo-search du VPS
// et fournit les attendus officiels à injecter dans les prompts Albert.
//
// 3 fonctions principales :
//   - loadTaxonomy()       : charge l'arborescence Scolarité>Niveau>Discipline (1×)
//   - fetchBOContext(...)  : interroge le RAG avec auto-détection discipline si besoin
//   - buildBOPromptBlock() : formate les chunks pour injection dans un prompt LLM

import { logger } from '../utils/logger.js';

// ─── Configuration ─────────────────────────────────────────────────────────

const VPS_BASE_URL = 'https://nshapiproxyadd10448-hapi-proxy.functions.fnc.fr-par.scw.cloud';
const N8N_ALBERT_URL = (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-n8n/webhook/hapi_albert';

// Cache global
let _taxonomyCache = null;
let _taxonomyLoadPromise = null;

// ─── 1. Chargement de la taxonomie ─────────────────────────────────────────

/**
 * Charge la taxonomie hiérarchique du RAG (Scolarité > Cycle/Voie > Niveau > Discipline).
 * Appel idempotent : la 2e fois renvoie le cache.
 * 
 * Structure renvoyée :
 *   {
 *     scolarites: { ecole: {...}, college: {...}, lycee: {...} },
 *     disciplines_par_niveau: { "cycle_3": [...], "premiere_generale": [...] },
 *     stats: { total_chunks, total_niveaux, total_disciplines }
 *   }
 * 
 * @returns {Promise<Object|null>} La taxonomie, ou null si erreur (non bloquant).
 */
export async function loadTaxonomy() {
    if (_taxonomyCache) return _taxonomyCache;
    if (_taxonomyLoadPromise) return _taxonomyLoadPromise;

	_taxonomyLoadPromise = (async () => {
	    try {
	        logger.log('📚 Chargement de la taxonomie BO…');
	        const resp = await fetch(`${VPS_BASE_URL}/api/bo-taxonomy`);
	        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
	        const data = await resp.json();
	        _taxonomyCache = data;
	        logger.log(`✓ Taxonomie chargée : ${data.stats?.total_chunks || '?'} chunks`);
	        return data;
	    } catch (e) {
	        logger.warn(`⚠ Taxonomie BO indisponible : ${e.message}`);
	        return null;
	    }
	})();

    return _taxonomyLoadPromise;
}

/**
 * Accès synchrone à la taxonomie (utilisé par les sélecteurs UI).
 * @returns {Object|null} Taxonomie en cache ou null si pas encore chargée.
 */
export function getTaxonomy() {
    return _taxonomyCache;
}

// ─── 2. Auto-détection de discipline via Albert ─────────────────────────────

/**
 * Demande à Albert de deviner la discipline scolaire à partir d'un extrait
 * du corpus enseignant. Renvoie un code discipline (ex: "mathematiques",
 * "sciences_technologie") qui correspond aux codes utilisés dans l'index.
 * 
 * @param {string} corpusExcerpt - Extrait du corpus (les 1000 premiers chars suffisent)
 * @param {string} niveauCode - Code niveau pour aider Albert à contextualiser
 * @returns {Promise<string|null>} Code discipline normalisé, ou null si échec.
 */
export async function autoDetectDiscipline(corpusExcerpt, niveauCode = null) {
    if (!corpusExcerpt || corpusExcerpt.trim().length < 50) {
        logger.log('⚠ Corpus trop court pour auto-détection, on saute.');
        return null;
    }

    // On donne à Albert la liste des codes possibles pour qu'il choisisse
    const taxo = getTaxonomy();
    let disciplinesValides = [];
    if (taxo && niveauCode && taxo.disciplines_par_niveau?.[niveauCode]) {
        disciplinesValides = taxo.disciplines_par_niveau[niveauCode].map(d => d.code);
    } else if (taxo) {
        // Fallback : toutes les disciplines toutes niveaux confondus
        const allDisc = new Set();
        Object.values(taxo.disciplines_par_niveau || {}).forEach(arr => {
            arr.forEach(d => allDisc.add(d.code));
        });
        disciplinesValides = Array.from(allDisc);
    }

    if (disciplinesValides.length === 0) {
        logger.warn('⚠ Aucune discipline valide pour auto-détection');
        return null;
    }

    const excerpt = corpusExcerpt.substring(0, 1500).trim();

    const systemPrompt = `Tu es un classificateur de contenu pédagogique. Tu reçois un extrait de cours ou de ressource enseignante, et tu dois identifier la discipline scolaire principale parmi une liste fermée de codes. Tu réponds UNIQUEMENT par un code de la liste, rien d'autre, pas de phrase, pas de ponctuation.`;

    const userPrompt = `Voici un extrait de contenu pédagogique :

"""
${excerpt}
"""

Identifie la discipline scolaire principale. Réponds UNIQUEMENT par un code parmi cette liste (rien d'autre) :

${disciplinesValides.join(', ')}

Code discipline :`;

    try {
        logger.log('🔍 Auto-détection discipline via Albert…');
        const t0 = Date.now();
        let raw = '';
        if (window.parent && typeof window.parent.makeNonStreamingRequest === 'function') {
            const combinedPrompt = `${systemPrompt}\n\nUser Content:\n${userPrompt}`;
            raw = await window.parent.makeNonStreamingRequest(combinedPrompt, {
                tool: 'professor'
            });
        } else {
            const resp = await fetch(N8N_ALBERT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    module: 'bo_context_autodetect'
                })
            });
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }
            const data = await resp.json();
            raw = data.choices?.[0]?.message?.content || '';
        }
        const cleaned = raw.trim().toLowerCase().replace(/[^a-z_]/g, '').slice(0, 50);

        // Valide que la réponse fait partie de la liste
        if (disciplinesValides.includes(cleaned)) {
            logger.log(`✓ Discipline auto-détectée : "${cleaned}" (en ${Date.now() - t0}ms)`);
            return cleaned;
        }
        // Tolère un match approximatif (préfixe)
        const fuzzy = disciplinesValides.find(d => cleaned.startsWith(d) || d.startsWith(cleaned));
        if (fuzzy) {
            logger.log(`✓ Discipline auto-détectée (fuzzy) : "${fuzzy}" (depuis "${cleaned}")`);
            return fuzzy;
        }
        logger.warn(`⚠ Albert a répondu "${cleaned}", non reconnu dans la liste`);
        return null;
    } catch (e) {
        logger.warn(`⚠ Auto-détection échouée : ${e.message}`);
        return null;
    }
}

// ─── 3. Appel principal du RAG ──────────────────────────────────────────────

/**
 * Récupère les attendus officiels du programme pertinents pour un corpus.
 * Auto-détecte la discipline si non fournie.
 * 
 * @param {Object} opts
 * @param {string} opts.query          - Question/sujet (peut être un extrait de corpus)
 * @param {string} opts.cycle          - Code niveau (ex: "cycle_3"), requis
 * @param {string} opts.discipline     - Code discipline, ou null pour auto-détection
 * @param {string} opts.corpusExcerpt  - Extrait corpus pour auto-détection si discipline absente
 * @param {number} opts.topK           - Nombre de chunks (défaut 3)
 * @returns {Promise<Object|null>} { results: [...], filters: {...} } ou null si erreur
 */
export async function fetchBOContext({
    query,
    cycle,
    discipline = null,
    corpusExcerpt = null,
    topK = 3
} = {}) {
    if (!query || !cycle) {
        logger.warn('⚠ fetchBOContext: query et cycle requis');
        return null;
    }

    // Auto-détection discipline si demandée
    if (!discipline && corpusExcerpt) {
        discipline = await autoDetectDiscipline(corpusExcerpt, cycle);
    }

    const payload = {
        query: query.substring(0, 2000),
        cycle,
        top_k: topK
    };
    if (discipline) {
        payload.discipline = discipline;
    }

    try {
        logger.log(`🔎 RAG: query="${payload.query.substring(0, 60)}..." cycle=${cycle} disc=${discipline || 'aucun filtre'}`);
        const t0 = Date.now();
        const resp = await fetch(`${VPS_BASE_URL}/api/bo-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }
        const data = await resp.json();
        const nResults = data.results?.length || 0;
        logger.log(`✓ RAG : ${nResults} extraits BO récupérés (en ${Date.now() - t0}ms)`);
        return data;
    } catch (e) {
        logger.warn(`⚠ RAG indisponible : ${e.message}. On continue sans BO.`);
        return null;
    }
}

// ─── 4. Construction du bloc à injecter dans un prompt LLM ─────────────────

/**
 * Formate les résultats du RAG en un bloc de texte prêt à injecter dans
 * un prompt Albert.
 * 
 * @param {Object} boContext - Le résultat de fetchBOContext (peut être null)
 * @param {Object} opts
 * @param {boolean} opts.compact - Si true, format condensé (défaut false)
 * @returns {string} Bloc texte (peut être vide si pas de contexte)
 */
export function buildBOPromptBlock(boContext, { compact = false } = {}) {
    if (!boContext || !boContext.results || boContext.results.length === 0) {
        return '';
    }

    const results = boContext.results;
    const cycleLabel = boContext.filters?.cycle || 'programme officiel';
    const discLabel = boContext.filters?.discipline_code || '';

    const header = compact
        ? `=== ÉLÉMENTS DU PROGRAMME OFFICIEL (${cycleLabel}${discLabel ? ' / ' + discLabel : ''}) ===\n\n`
        : `=== ÉLÉMENTS DU PROGRAMME OFFICIEL ===\n\n` +
          `Les éléments suivants proviennent du programme officiel de l'Éducation nationale (${cycleLabel}${discLabel ? ', ' + discLabel : ''}). ` +
          `Les activités générées DOIVENT s'aligner sur ce programme. ` +
          `Privilégie les questions et exercices qui mobilisent les notions et compétences du programme plutôt que la pure restitution factuelle.\n\n`;

    const chunks = results.map((r, i) => {
        const ctx = r.context || {};
        const path = [ctx.cycle, ctx.discipline_code, ctx.section_title]
            .filter(Boolean).join(' > ');
        const source = r.source?.texte_officiel || 'programme officiel';
        return `[Extrait ${i + 1} — ${path}]\n` +
               `Source : ${source}\n` +
               `${r.text}\n`;
    }).join('\n---\n\n');

    const footer = `\n=== FIN DES ÉLÉMENTS DU PROGRAMME OFFICIEL ===\n\n`;

    return header + chunks + footer;
}

// ─── 4 bis. Helper tout-en-un : bloc BO pour la sélection UI courante ───────

/**
 * Construit le bloc « programme officiel » à injecter dans un prompt, en
 * lisant directement la sélection courante de l'UI (#toggle-rag-boen,
 * #global-niveau, #global-discipline). Centralise la logique commune à toutes
 * les activités (cf. genererPromptIAHierarchise).
 *
 * Non bloquant : renvoie une chaîne vide si le RAG est désactivé, si le niveau
 * n'est pas reconnu, ou en cas d'erreur réseau.
 *
 * @param {string} query - Sujet / extrait de corpus servant de requête au RAG.
 * @returns {Promise<string>} Bloc texte prêt à injecter (peut être vide).
 */
export async function getBOPromptBlockForCurrentSelection(query) {
    const isRagEnabled = document.getElementById('toggle-rag-boen')?.checked ?? true;
    if (!isRagEnabled) return '';

    try {
        const niveau = document.getElementById('global-niveau')?.value || '';
        const cycleCode = normalizeNiveauToCode(niveau);
        if (!cycleCode) return '';

        const discipline = document.getElementById('global-discipline')?.value?.trim() || null;
        const finalQuery = (query || '').trim().substring(0, 1500) || `programme ${niveau}`;
        const boContext = await fetchBOContext({
            query: finalQuery, cycle: cycleCode, discipline, topK: 3
        });
        return buildBOPromptBlock(boContext);
    } catch (e) {
        logger.warn(`⚠ RAG échoué : ${e.message}`);
        return '';
    }
}

// ─── 5. Helper : normalise le label "Cycle 3" du sélecteur en code BO ───────

/**
 * Convertit le label affiché du sélecteur #global-niveau en code utilisable
 * par le RAG. Ex: "Cycle 3" → "cycle_3", "Première générale" → "premiere_generale".
 * 
 * @param {string} label - Valeur lue depuis #global-niveau
 * @returns {string|null} Code niveau pour le RAG
 */
export function normalizeNiveauToCode(label) {
    if (!label) return null;
	
// 🔴 NOUVELLE LIGNE : Si c'est déjà un code (contient un underscore), on le renvoie direct !
    if (label.includes('_')) return label.toLowerCase().trim();
	
    const n = label.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // sans accents
        .replace(/\s+/g, ' ');

    // Cycles 1 à 4
    if (n.includes('cycle 1') || n.includes('maternelle')) return 'cycle_1';
    if (n.includes('cycle 2')) return 'cycle_2';
    if (n.includes('cycle 3')) return 'cycle_3';
    if (n.includes('cycle 4') || n.includes('college')) return 'cycle_4';

    // Lycée général
    if (n.includes('seconde')) {
        if (n.includes('pro')) return 'seconde_professionnelle';
        if (n.includes('sthr')) return 'seconde_sthr';
        return 'seconde_generale_et_technologique';
    }
    if (n.includes('premiere') || n.includes('1ere') || n.includes('1re')) {
        if (n.includes('pro')) return 'premiere_professionnelle';
        if (n.includes('stmg')) return 'premiere_stmg';
        if (n.includes('sti2d')) return 'premiere_sti2d';
        if (n.includes('stl')) return 'premiere_stl';
        if (n.includes('st2s')) return 'premiere_st2s';
        if (n.includes('std2a')) return 'premiere_std2a';
        if (n.includes('sthr')) return 'premiere_sthr';
        if (n.includes('s2tmd')) return 'premiere_s2tmd';
        return 'premiere_generale';
    }
    if (n.includes('terminale') || n.includes('tle')) {
        if (n.includes('pro')) return 'terminale_professionnelle';
        if (n.includes('stmg')) return 'terminale_stmg';
        if (n.includes('sti2d')) return 'terminale_sti2d';
        if (n.includes('stl')) return 'terminale_stl';
        if (n.includes('st2s')) return 'terminale_st2s';
        if (n.includes('std2a')) return 'terminale_std2a';
        if (n.includes('sthr')) return 'terminale_sthr';
        if (n.includes('s2tmd')) return 'terminale_s2tmd';
        return 'terminale_generale';
    }
    // CAP
    if (n.includes('cap')) {
        if (n.includes('2e') || n.includes('2eme') || n.includes('deuxieme')) return 'deuxieme_annee_de_cap';
        return 'premiere_annee_de_cap';
    }

    return null;
}

// ─── Bootstrap : on lance le chargement de la taxonomie dès l'import ───────

// Idempotent : si plusieurs modules importent ce fichier, un seul fetch est lancé.
loadTaxonomy();
