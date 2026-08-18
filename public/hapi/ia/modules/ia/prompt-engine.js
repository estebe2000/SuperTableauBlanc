// Fichier: modules/ia/prompt-engine.js
import { logger } from '../utils/logger.js';
import { corpusManager } from '../corpus/corpus-manager.js';
import { readFileContent } from '../corpus/file-parsers.js';
import { fetchBOContext, buildBOPromptBlock, normalizeNiveauToCode } from './bo-context.js';

export async function genererPromptIAHierarchise(niveau, type, formatExemple, mode = 'strict' , langue = 'Français', repartitionQuestions = null, useSeparator = true, unites = { sing: 'élément', plur: 'éléments' }) {
    logger.log(`🤖 Construction du prompt IA (Mode: ${mode})...`);
    
    const sources = corpusManager.getCorpusSources(); 
    if (sources.length === 0) {
        alert("Le corpus est vide. Veuillez ajouter des documents.");
        return null;
    }

    // 🟢 NOUVEAU : Interception du niveau si le RAG est désactivé
    const isRagEnabled = document.getElementById('toggle-rag-boen')?.checked ?? true;
    let niveauEffectif = niveau; // Par défaut (celui venant du RAG si coché)

    if (!isRagEnabled) {
        const standaloneNiveau = document.getElementById('standalone-niveau')?.value;
        if (standaloneNiveau) {
            niveauEffectif = standaloneNiveau; // On écrase avec le choix hors-RAG
        }
    }
    
    const instructionLangue = `Tu dois rédiger TOUT le contenu EXCLUSIVEMENT en "${langue}".`;
    let promptIntro = '';
    
    if (repartitionQuestions) {
        const totalAttendu = Object.values(repartitionQuestions).reduce((a, b) => a + b, 0);
        if (totalAttendu > 0) {
            promptIntro += `OBJECTIF GLOBAL : Générer ${totalAttendu} ${unites.plur} au total, en respectant la répartition indiquée.\n`;
        }
    }

    // 🟢 MODIFICATION : On utilise niveauEffectif au lieu de niveau
    promptIntro += `Tu es un assistant pédagogique ${mode === 'strict' ? 'expert' : 'créatif'} de niveau '${niveauEffectif}'. Ta tâche est de type "${type}". \n${instructionLangue}\n\n`;

    // --- BLOC RAG BOEN ---
    let promptBO = '';

    if (isRagEnabled) {
        try {
            // 🟢 MODIFICATION : On utilise niveauEffectif ici aussi au cas où
            const cycleCode = normalizeNiveauToCode(niveauEffectif);
            if (cycleCode) {
                const disciplineChoisie = document.getElementById('global-discipline')?.value?.trim() || null;
                const sourcesPourQuery = corpusManager.getCorpusSources();
                let corpusExcerpt = '';
                for (const s of sourcesPourQuery.slice(0, 3)) {
                    if (typeof s.data === 'string') {
                        corpusExcerpt += s.data.substring(0, 800) + '\n';
                        if (corpusExcerpt.length > 1500) break;
                    }
                }
                const query = corpusExcerpt.trim().substring(0, 1500) || `programme ${niveau}`;
                const boContext = await fetchBOContext({
                    query, cycle: cycleCode, discipline: disciplineChoisie, topK: 3
                });
                promptBO = buildBOPromptBlock(boContext);
            }
        } catch (e) {
            logger.warn(`⚠ RAG échoué : ${e.message}`);
        }
    }
    promptIntro += promptBO;

    // --- TRAITEMENT DES SOURCES ---
    const promises = sources.map(async (source) => {
        let qCount = -1; 
        if (repartitionQuestions) {
            if (repartitionQuestions.hasOwnProperty(source.id)) qCount = repartitionQuestions[source.id];
            else if (repartitionQuestions.hasOwnProperty('all')) qCount = -1;
            else qCount = 0; 
        }
        if (qCount === 0) return ''; 

        let content = '';
        if (['text', 'video', 'web'].includes(source.type)) content = source.data;
        else if (source.type === 'file') {
            content = (typeof source.data === 'string') ? source.data : await readFileContent(source.data);
        }
        
        if (!content?.trim()) return ''; 

        const prioriteTexte = {3: 'Haute', 2: 'Moyenne', 1: 'Basse'};
        const instr = qCount > 0 ? `🛑 EXTRAIRE EXACTEMENT ${qCount} ${qCount > 1 ? unites.plur : unites.sing} de ce bloc.\n` : '';

        return `--- DEBUT BLOC SOURCE ---\nNOM: ${source.name}\nPRIORITE: ${prioriteTexte[source.priority]}\n${instr}CONTENU:\n"""\n${content.trim()}\n"""\n--- FIN BLOC SOURCE ---\n\n`;
    });

    const promptBlocs = (await Promise.all(promises)).join('');
// 🟢 NOUVEAU : Instructions anti-markdown globales et très strictes
    let instructionsFormat = `INSTRUCTIONS DE FORMATAGE :\n1. Combine les résultats.\n2. Réponds EXCLUSIVEMENT avec le format demandé en TEXTE BRUT.\n3. ⚠️ CRUCIAL : N'utilise STRICTEMENT AUCUN formatage Markdown (pas de **, pas de __, ni de ##). Ne mets JAMAIS de gras autour des étiquettes (ex: Q1:, RC:, etc.) ou des questions.\n`;
	
   // let instructionsFormat = `INSTRUCTIONS DE FORMATAGE :\n1. Combine les résultats.\n2. Réponds EXCLUSIVEMENT avec le format demandé.\n`;
    if (useSeparator) instructionsFormat += `4. SÉPARATEUR : Ajoute "---o---" entre chaque ${unites.sing}.\n`;

    return promptIntro + promptBlocs + instructionsFormat + `\nFORMAT ATTENDU :\n${formatExemple}`;
}