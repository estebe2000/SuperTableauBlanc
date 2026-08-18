// Fichier: modules/ia/response-parser.js

import { logger } from '../utils/logger.js';

/**
 * Désinfecte une chaîne JSON brute venant de l'IA.
 * (Code de la ligne 937)
 */
function sanitizeAIJsonString(jsonString) {
    if (!jsonString) return '';
    const placeholderDoubleSlash = '___PLACEHOLDER_DOUBLE_SLASH___';
    const placeholderQuoteSlash = '___PLACEHOLDER_QUOTE_SLASH___';
    let sanitized = jsonString.replace(/\\\\/g, placeholderDoubleSlash); 
    sanitized = sanitized.replace(/\\"/g, placeholderQuoteSlash);   
    sanitized = sanitized.replace(/\\/g, '\\\\');
    sanitized = sanitized.replace(new RegExp(placeholderDoubleSlash, 'g'), '\\\\');
    sanitized = sanitized.replace(new RegExp(placeholderQuoteSlash, 'g'), '\\"');
    return sanitized;
}

/**
 * Nettoie la réponse brute de l'IA (enlève les blocs Markdown et texte d'intro).
 * (Code de la ligne 2180)
 */
function nettoyerReponseIA(reponseBrute, startToken = 'Q1:') {
    let reponseNettoyee = reponseBrute.trim();
    
    // Enlève les blocs de code Markdown (utilisation de \x60 pour éviter de casser l'affichage Markdown)
    const regexBlocCode = /^\x60\x60\x60(?:\w*\n)?([\s\S]+?)\n\x60\x60\x60$/;
    if (regexBlocCode.test(reponseNettoyee)) {
        reponseNettoyee = reponseNettoyee.replace(regexBlocCode, '$1').trim();
        logger.log("🧹 Bloc de code Markdown détecté et supprimé.");
    }
    
    // Enlève le texte avant le premier token
    const indexStart = reponseNettoyee.search(new RegExp(startToken, "i"));
    if (indexStart > 0) {
        reponseNettoyee = reponseNettoyee.substring(indexStart);
        logger.log("🧹 Texte d'introduction détecté et supprimé.");
    }
    return reponseNettoyee;
}

/**
 * Analyse la réponse IA pour le QCM standard.
 * (Code de la ligne 2200)
 * @returns {Array} Un tableau d'objets question.
 */
export function parserReponseIA_Quiz(reponseBrute) {
    if (!reponseBrute.trim()) {
        alert("Veuillez coller la réponse de l'IA.");
        return [];
    }
    const reponse = nettoyerReponseIA(reponseBrute, 'Q1:');
    const blocs = reponse.split(/---o---|---|—o—/g).map(b => b.trim()).filter(Boolean);
    
    if (blocs.length === 0) {
        logger.error("Format de réponse incorrect. Séparateur '---o---' non trouvé.");
        alert("Format de réponse incorrect.");
        return [];
    }

    const questionsData = [];
    blocs.forEach((bloc) => {
        const lignes = bloc.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        let questionText = '';
        let correctAnswers = [];
        let incorrectAnswers = [];

        lignes.forEach(ligne => {
            if (ligne.match(/^q/i)) {
                questionText = ligne.substring(ligne.indexOf(':') + 1).trim();
            } else if (ligne.match(/^ri/i) || ligne.match(/^d/i)) {
                incorrectAnswers.push(ligne.substring(ligne.indexOf(':') + 1).trim());
            } else if (ligne.match(/^r/i)) { // Doit être après RI
                correctAnswers.push(ligne.substring(ligne.indexOf(':') + 1).trim());
            }
        });
        
        if (questionText && (correctAnswers.length > 0 || incorrectAnswers.length > 0)) {
            questionsData.push({
                question: questionText,
                correct: correctAnswers,
                incorrect: incorrectAnswers
            });
        }
    });
    
    logger.log(`✅ ${questionsData.length} question(s) QCM importée(s).`);
    return questionsData;
}

/**
 * Analyse la réponse IA pour le Vrai/Faux standard.
 * (Code de la ligne 2115)
 * @returns {Array} Un tableau d'objets question.
 */
export function parserReponseIA_TrueFalse(reponseBrute) {
    if (!reponseBrute.trim()) {
        alert("Veuillez coller la réponse de l'IA.");
        return [];
    }
    const reponse = nettoyerReponseIA(reponseBrute, 'Q1:');
    const blocs = reponse.split(/---o---|---|—o—/g).map(b => b.trim()).filter(Boolean);
    
    const questionsData = [];
    blocs.forEach((bloc) => {
        const qMatch = bloc.match(/Q\d+:\s*(.*)/i);
        const rMatch = bloc.match(/R\d+:\s*(VRAI|FAUX)/i);

        if (qMatch && rMatch) {
            questionsData.push({
                question: qMatch[1].trim(),
                answer: rMatch[1].trim().toLowerCase() === 'vrai' ? 'true' : 'false'
            });
        } else {
            logger.warn(`Format V/F non reconnu dans le bloc: "${bloc}"`);
        }
    });
    
    logger.log(`✅ ${questionsData.length} affirmation(s) V/F importée(s).`);
    return questionsData;
}

/**
 * Analyse la réponse JSON de l'IA (pour les quiz math).
 * (Code de la ligne 1673 et 1740)
 * @param {string} reponseBrute La réponse JSON brute
 * @returns {Array|null} Un tableau d'objets, ou null en cas d'erreur.
 */
export function parserReponseIA_MathJSON(reponseBrute) {
    if (!reponseBrute.trim()) {
        alert("Veuillez coller la réponse JSON de l'IA");
        return null;
    }
    
    let response = reponseBrute.trim();
    // Nettoyer les blocs de code Markdown (utilisation de \x60)
    const regexBlocCode = /^\x60\x60\x60(?:\w*\n)?([\s\S]+?)\n\x60\x60\x60$/;
    if (regexBlocCode.test(response)) {
        response = response.replace(regexBlocCode, '$1').trim();
        logger.log("🧹 Bloc de code JSON détecté et nettoyé.");
    }

    const startIndex = response.indexOf('[');
    const endIndex = response.lastIndexOf(']');
    if (startIndex === -1 || endIndex === -1) {
        alert("Réponse invalide : aucun tableau JSON [ ... ] n'a été trouvé.");
        logger.error("Erreur parsing JSON : Délimiteurs [ et ] non trouvés.");
        return null;
    }
    
    let jsonString = response.substring(startIndex, endIndex + 1);
    jsonString = sanitizeAIJsonString(jsonString);
    
    try {
        const data = JSON.parse(jsonString);
        if (!Array.isArray(data)) {
            throw new Error("Le JSON n'est pas un tableau (array).");
        }
        logger.log(`✅ ${data.length} objet(s) JSON mathématique importé(s).`);
        return data;
    } catch (e) {
        logger.error(`Erreur de parsing JSON (Math): ${e.message}`);
        alert(`Erreur lors de la lecture du JSON. Vérifiez la syntaxe.\n\nDétail : ${e.message}`);
        return null;
    }
}


/**
 * Analyse la réponse IA pour la Dictée (Découpage de phrases).
 * Nettoyage avancé et tolérance aux artéfacts d'introduction, de titres (=) et de listes.
 * @param {string} reponseBrute
 * @returns {Array<string>} Tableau de phrases nettoyées.
 */
export function parserReponseIA_Dictation(reponseBrute) {
    if (!reponseBrute || !reponseBrute.trim()) {
        alert("Veuillez coller la réponse de l'IA.");
        return [];
    }

    let text = reponseBrute.trim();

    // 1. Nettoyage Markdown (gère les blocs de code n'importe où dans le texte via \x60)
    text = text.replace(/\x60\x60\x60(?:\w*)?([\s\S]*?)\x60\x60\x60/g, '$1').trim();

    // 2. Découpage (Gère ---o---, ---, ou —o—)
    const segments = text.split(/---o---|---|—o—/g);

    // 3. Nettoyage individuel approfondi et filtrage
    const phrases = segments
        .map(s => {
            let cleaned = s.trim();
            
            // Étape A : Supprime les signes "=" et espaces au début et à la fin (ex: "=La légende d'Hercule=" ou "= La légende")
            cleaned = cleaned.replace(/^[\s=]+/, '').replace(/[\s=]+$/, '');
            
            // Étape B : Supprime les préfixes de type "Phrase 1:", "Q1:", "P1:" (insensibles à la casse)
            cleaned = cleaned.replace(/^(?:Phrase|Question|Q|P)\s*\d*\s*[:.-]\s*/i, '');
            
            // Étape C : Supprime les puces, tirets et numérotations simples au début (ex: "1. ", "- ", "• ", "1)")
            cleaned = cleaned.replace(/^[\d\s.)\-*•‣◦]+\s*/, '');
            
            return cleaned.trim();
        })
        .filter(s => s.length > 0);

    logger.log(`✅ ${phrases.length} phrase(s) de dictée importée(s).`);
    return phrases;
}

/**
 * Nettoie une liste de mots pour Mots Mêlés (CSV).
 * Gère le cas où l'IA renvoie plusieurs lignes ou blocs.
 */
export function parserReponseIA_WordList(reponse) {
    if (!reponse) return '';
    
    // 1. Nettoyage de base
    let text = reponse.trim();
    
    // 2. Supprimer les blocs de code Markdown
    text = text.replace(/\x60\x60\x60/g, '').trim();
    
    // 3. IMPORTANT : Remplacer TOUS les sauts de ligne par des virgules
    // Cela permet de fusionner les listes générées par chaque document du corpus
    text = text.replace(/[\r\n]+/g, ',');
    
    // 4. Nettoyer et filtrer
    let mots = text.split(',');
    mots = mots.map(m => {
        // Garde uniquement Lettres, Chiffres et Tirets. Met en majuscules.
        return m.trim().toUpperCase().replace(/[^A-ZÀ-Ÿ0-9\-]/g, '');
    }).filter(m => m.length > 1); // Ignore les mots de 1 lettre ou vides
    
    // 5. Déduplication (Optionnel mais conseillé pour WordSearch)
    const uniqueMots = [...new Set(mots)];
    
    // 6. Retourne la string CSV propre
    return uniqueMots.join(',');
}



/**
 * Analyse la réponse IA pour "Trier les Paragraphes".
 * @param {string} reponseBrute La réponse de l'IA.
 * @returns {Array<string>} Un tableau de paragraphes.
 */
export function parserReponseIA_SortParagraphs(reponseBrute) {
    if (!reponseBrute.trim()) {
        alert("Veuillez coller la réponse de l'IA.");
        return [];
    }
    // On nettoie le texte d'intro (en supposant que le premier paragraphe commence)
    // C'est un parseur simple, on peut le raffiner si besoin.
    let reponse = reponseBrute.trim();
    const regexBlocCode = /^\x60\x60\x60(?:\w*\n)?([\s\S]+?)\n\x60\x60\x60$/;
    if (regexBlocCode.test(reponse)) {
        reponse = reponse.replace(regexBlocCode, '$1').trim();
    }
    
    const blocs = reponse.split(/---o---|---|—o—/g).map(b => b.trim()).filter(Boolean);
    
    if (blocs.length === 0) {
        logger.error("Format de réponse incorrect. Séparateur '---o---' non trouvé.");
        alert("Format de réponse incorrect.");
        return [];
    }
    
    logger.log(`✅ ${blocs.length} paragraphe(s) importé(s).`);
    return blocs; // Renvoie un simple tableau de strings
}


/**
 * Analyse la réponse IA pour "Summary".
 * (Similaire à parserReponseIA_Quiz)
 * @returns {Array} Un tableau d'objets : [{ correct: ["..."], incorrect: ["..."] }, ...]
 */
export function parserReponseIA_Summary(reponseBrute) {
    if (!reponseBrute.trim()) {
        alert("Veuillez coller la réponse de l'IA.");
        return [];
    }
    const reponse = nettoyerReponseIA(reponseBrute, 'RC:'); // Commence par RC:
    const blocs = reponse.split(/---o---|---|—o—/g).map(b => b.trim()).filter(Boolean);
    
    if (blocs.length === 0) {
        logger.error("Format de réponse incorrect. Séparateur '---o---' non trouvé.");
        alert("Format de réponse incorrect.");
        return [];
    }

    const groupsData = [];
    blocs.forEach((bloc) => {
        const lignes = bloc.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        let correctAnswers = [];
        let incorrectAnswers = [];

        lignes.forEach(ligne => {
            if (ligne.match(/^ri:/i)) {
                incorrectAnswers.push(ligne.substring(ligne.indexOf(':') + 1).trim());
            } else if (ligne.match(/^rc:/i)) {
                correctAnswers.push(ligne.substring(ligne.indexOf(':') + 1).trim());
            }
        });
        
        // Un groupe valide doit avoir au moins UNE correcte et UNE incorrecte
        if (correctAnswers.length > 0 && incorrectAnswers.length > 0) {
            groupsData.push({
                correct: correctAnswers, // Devrait être un tableau avec 1 seul élément
                incorrect: incorrectAnswers
            });
        }
    });
    
    logger.log(`✅ ${groupsData.length} groupe(s) de propositions importé(s).`);
    return groupsData;
}


/**
 * Analyse la réponse IA pour "Accordion (Glossaire)".
 * (Version ULTIME avec Fallback structurel)
 */
export function parserReponseIA_Accordion(reponseBrute) {
    if (!reponseBrute.trim()) {
        alert("Veuillez coller la réponse de l'IA.");
        return [];
    }
    
    // 1. Nettoyage global
    // On enlève les blocs de code Markdown éventuels
    let reponse = nettoyerReponseIA(reponseBrute, 'Concept'); 
    
    // 2. Découpage par blocs
    const blocs = reponse.split(/---o---|---|—o—/g).map(b => b.trim()).filter(Boolean);
    
    const entriesData = [];
    
    blocs.forEach((bloc) => {
        // --- TENTATIVE 1 : Recherche par mots-clés (Multilingue) ---
        // On essaie de trouver Concept/Terme/... et Définition/Description/...
        const conceptMatch = bloc.match(/(?:Concept|Terme|Mot|Titre|Concepto|Begriff|Concetto|Begrip|Termo|Title)\s*:\s*(.*)/i);
        const definitionMatch = bloc.match(/(?:D[ée]finition|Definici[oó]n|Description|Meaning|Erklärung|Definizione|Definitie|Definição|Content)\s*:\s*(.*)/is);

        if (conceptMatch && definitionMatch) {
            // Si on trouve les mots-clés, c'est parfait
            entriesData.push({
                concept: conceptMatch[1].trim(),
                definition: definitionMatch[1].trim()
            });
        } 
        else {
            // --- TENTATIVE 2 : Fallback Structurel (Plan B) ---
            // Si l'IA a utilisé des mots inconnus ou du formatage bizarre (ex: **Concept** :)
            // On suppose que : Ligne 1 = Titre, Reste = Définition
            
            const lines = bloc.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            
            if (lines.length >= 2) {
                // On prend la première ligne comme concept
                // On nettoie tout ce qui ressemble à un préfixe (ex: "Quelquechose : ") et le gras (**)
                let rawConcept = lines[0];
                let cleanConcept = rawConcept.replace(/^.*:\s*/, '').replace(/\*\*/g, '').trim();

                // On prend tout le reste comme définition
                // On nettoie le préfixe de la première ligne de définition aussi
                let rawDef = lines.slice(1).join('\n');
                let cleanDef = rawDef.replace(/^.*:\s*/, '').trim();

                if (cleanConcept && cleanDef) {
                    logger.warn("Parsing Fallback utilisé pour un bloc (mots-clés non trouvés).");
                    entriesData.push({
                        concept: cleanConcept,
                        definition: cleanDef
                    });
                }
            }
        }
    });
    
    if (entriesData.length === 0 && blocs.length > 0) {
        logger.error("Aucune entrée détectée malgré le fallback.");
        alert("Aucune entrée détectée. Vérifiez que la réponse de l'IA contient bien des blocs séparés par '---o---'.");
    } else {
        logger.log(`✅ ${entriesData.length} entrée(s) de glossaire importée(s).`);
    }
    
    return entriesData;
}


// Flashcards et Dialogcards
export function parserReponseIA_Cards(txt) {
    if (!txt) return [];
    // Utilise le séparateur standard ---o---
    const blocs = txt.split('---o---');
    const cards = [];

    blocs.forEach(bloc => {
        const lines = bloc.split('\n').map(l => l.trim()).filter(l => l);
        let q = "", r = "";
        lines.forEach(line => {
            if (line.startsWith('Q:') || line.startsWith('Front:')) q = line.substring(2).trim();
            else if (line.startsWith('R:') || line.startsWith('Back:')) r = line.substring(2).trim();
        });
        if (q && r) cards.push({ question: q, reponse: r });
    });
    return cards;
}

export function parserReponseIA_ImagePairing(reponseBrute) {
    const data = parserReponseIA_MathJSON(reponseBrute); // Utilise votre nettoyeur JSON existant
    if (!data) return [];

    const validPairs = [];

    data.forEach(item => {
        // Format V2 (Stratégie)
        if (item.left_content && item.right_content) {
            validPairs.push({
                // On détermine si c'est un prompt image ou du texte
                // Si left_type est "image", alors left_content est le prompt
                left_prompt: (item.left_type === 'image') ? item.left_content : null,
                left_text:   (item.left_type === 'text')  ? item.left_content : null,
                
                right_prompt: (item.right_type === 'image') ? item.right_content : null,
                right_text:   (item.right_type === 'text')  ? item.right_content : null,
                
                label: "Paire" // Label générique
            });
        }
        // Fallback V1
        else if (item.label && item.left_prompt) {
             validPairs.push(item);
        }
    });

    return validPairs;
}

/**
 * Analyse la réponse IA pour les molécules 3D
 */
export function parserReponseIA_Molecules3D(reponseBrute) {
    if (!reponseBrute || !reponseBrute.trim()) {
        alert("Veuillez coller la réponse JSON de l'IA");
        return null;
    }
    
    let response = reponseBrute.trim();
    
    // Nettoyer les blocs de code Markdown
    const regexBlocCode = /^\x60\x60\x60(?:\w*\n)?([\s\S]+?)\n\x60\x60\x60$/;
    if (regexBlocCode.test(response)) {
        response = response.replace(regexBlocCode, '$1').trim();
        logger.log("🧹 Bloc de code JSON détecté et nettoyé.");
    }
    
    // Trouver le début et la fin du tableau JSON
    const startIndex = response.indexOf('[');
    const endIndex = response.lastIndexOf(']');
    
    if (startIndex === -1 || endIndex === -1) {
        alert("Réponse invalide : aucun tableau JSON [ ... ] n'a été trouvé.");
        logger.error("Erreur parsing JSON : Délimiteurs [ et ] non trouvés.");
        return null;
    }
    
    let jsonString = response.substring(startIndex, endIndex + 1);
    jsonString = sanitizeAIJsonString(jsonString);
    
    try {
        const data = JSON.parse(jsonString);
        
        if (!Array.isArray(data)) {
            throw new Error("Le JSON n'est pas un tableau (array).");
        }
        
        // Validation
        const validMolecules = [];
        for (let i = 0; i < data.length; i++) {
            const mol = data[i];
            
            if (!mol.nom_pubchem || !mol.titre || !mol.formule) {
                logger.warn(`Molécule ${i + 1} ignorée : clés manquantes`);
                continue;
            }
            
            if (typeof mol.nom_pubchem !== 'string' || 
                typeof mol.titre !== 'string' || 
                typeof mol.formule !== 'string') {
                logger.warn(`Molécule ${i + 1} ignorée : types invalides`);
                continue;
            }
            
            validMolecules.push({
                nom_pubchem: mol.nom_pubchem.trim(),
                titre: mol.titre.trim(),
                formule: mol.formule.trim()
            });
        }
        
        if (validMolecules.length === 0) {
            alert("Aucune molécule valide trouvée dans la réponse de l'IA.");
            return null;
        }
        
        logger.log(`✅ ${validMolecules.length} molécule(s) importée(s).`);
        return validMolecules;
        
    } catch (e) {
        logger.error(`Erreur parsing JSON (Molécules 3D): ${e.message}`);
        alert(`Erreur lors de la lecture du JSON.\n\nDétail : ${e.message}`);
        return null;
    }
}

/**
 * Déduplique une liste de molécules
 */
export function deduplicateMolecules(molecules) {
    const seen = new Set();
    const unique = [];
    
    for (const mol of molecules) {
        const key = mol.nom_pubchem.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(mol);
        } else {
            logger.log(`🔄 Molécule dupliquée ignorée : ${mol.titre}`);
        }
    }
    
    return unique;
}