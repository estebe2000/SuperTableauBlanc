// Fichier: modules/ia/prompts/dragtext-prompt.js

import { logger } from '../../utils/logger.js';
import { getBOPromptBlockForCurrentSelection } from '../bo-context.js';

export async function preparerAssistantIA_DragText(rules, sourceText) {
    if (!rules || rules.length === 0) { 
        alert("Veuillez définir au moins une règle d'extraction."); 
        return false; 
    }
    if (!sourceText.trim()) { 
        alert('Le texte source est vide.'); 
        return false; 
    }

    // Récupération de la langue globale
    const langueSelect = document.getElementById('global-language');
    const langue = langueSelect ? langueSelect.value : 'Français';

    // --- BLOC RAG BOEN (aligné sur le programme officiel) ---
    const promptBO = await getBOPromptBlockForCurrentSelection(sourceText);
    // Garde-fou : le bloc programme ne doit servir que d'orientation, jamais
    // de source de mots. N'apparaît que si le RAG a effectivement renvoyé un bloc.
    const ragGuard = promptBO
        ? `⚠️ PÉRIMÈTRE D'ANALYSE STRICT : le bloc « ÉLÉMENTS DU PROGRAMME OFFICIEL » ci-dessous est UNIQUEMENT un contexte d'orientation pédagogique. Tu dois analyser, recopier et extraire des mots EXCLUSIVEMENT à partir du TEXTE SOURCE délimité plus bas (entre guillemets triples). N'extrais JAMAIS un mot issu du bloc programme officiel.\n\n`
        : '';

    // ARCHITECTURE « liste + texte nu » (cf. markthewords) : on NE demande PLUS à
    // l'IA d'insérer des marqueurs dans le texte (trop fragile : l'IA en oublie, et
    // n8n strippe les astérisques). L'IA renvoie séparément la LISTE des mots cibles
    // et le texte recopié SANS marqueur ; le balisage *mot* (format H5P) est fait côté
    // client par handleParseIADragText, ce qui garantit l'exhaustivité et survit à n8n.
    let prompt = `Tu es un assistant pédagogique expert en linguistique.\n`;
    prompt += `Analyse le texte fourni ci-dessous (entre guillemets triples) et identifie TOUS les mots ou groupes de mots qui correspondent à L'UN des critères suivants :\n\n`;

    rules.forEach((rule, index) => {
        prompt += `- CRITÈRE ${index + 1} : ${rule.task}\n`;
        if (rule.example) {
            prompt += `  Exemple de mot cible : ${rule.example.replace(/[\[\]*]/g, '').trim()}\n`;
        }
    });

    prompt += `\n⚠️ EXHAUSTIVITÉ ABSOLUE : liste CHAQUE mot correspondant, du début à la fin du texte, sans EN OUBLIER UN SEUL. Parcours le texte phrase par phrase jusqu'au point final. Avant de répondre, relis une seconde fois pour vérifier qu'aucun mot cible n'a été oublié.\n`;

    prompt += `\nFORMAT DE RÉPONSE (obligatoire, exactement deux parties) :\n`;
    prompt += `MOTS: mot1 | mot2 | mot3 | ...\n`;
    prompt += `TEXTE:\n(le texte source recopié à l'identique, sans aucun marqueur)\n`;

    prompt += `\nRÈGLES DE FORMAT :\n`;
    prompt += `- Ligne « MOTS: » : tous les mots cibles séparés par une barre verticale « | », recopiés EXACTEMENT comme dans le texte (même orthographe, même casse, mêmes accents). Aucun crochet, aucune astérisque, aucun numéro.\n`;
    prompt += `- Bloc « TEXTE: » : recopie le texte source SANS rien y ajouter — aucun crochet, aucune astérisque, aucun gras, aucun surlignage. Le balisage est appliqué automatiquement à partir de la liste MOTS.\n`;
    prompt += `- N'utilise NULLE PART d'astérisques (*) ni de formatage Markdown.\n`;
    prompt += `- MULTI-SOURCES : si le texte est découpé en BLOCS (--- DEBUT BLOC SOURCE ---), respecte le quota indiqué dans chaque bloc (ligne 🛑) et, dans TEXTE, recopie le contenu de TOUS les blocs dans l'ordre SANS les lignes techniques (---, NOM:, 🛑, CONTENU:).\n`;
    prompt += `- LANGUE : le bloc TEXTE (et donc les mots) doit être en "${langue}". Si le texte source est dans une autre langue, traduis-le d'abord, puis liste les mots cibles tels qu'ils apparaissent dans ta traduction.\n`;

    prompt += `\nNe réponds RIEN d'autre que ces deux parties (la ligne MOTS: puis le bloc TEXTE:).\n\n${ragGuard}${promptBO}TEXTE SOURCE :\n"""\n${sourceText.trim()}\n"""`;

    const promptTextarea = document.getElementById('dragtext-ia-prompt');
    if (promptTextarea) {
        promptTextarea.value = prompt;
        logger.log('🤖 Prompt (Drag Text) finalisé avec combinaisons.');
    }
    
    return true;
}