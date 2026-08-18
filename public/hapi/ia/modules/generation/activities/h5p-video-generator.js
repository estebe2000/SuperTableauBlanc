// Fichier: modules/generation/h5p-video-generator.js
// VERSION BLINDÉE - Correction de compatibilité stricte Logiquiz (H5P 1.27 / Blanks 1.14 / MTW 1.11)

import { syncEditorToState, gatherData } from '../../ui/h5p-video-ui.js';
import { getH5PLocalization } from '../../utils/h5p-translations.js';

export async function genererH5PInteractiveVideo(data, libVersions) {
    if (!data || !data.videoMetadata || !data.interactions) {
        throw new Error('Données vidéo manquantes.');
    }

    syncEditorToState();
    const freshData = gatherData();
    if (freshData) {
        data.interactions   = freshData.interactions;
        data.globalSettings = freshData.globalSettings;
    }

    const { videoMetadata: vm, interactions, globalSettings: gs } = data;

    const getVer = (name) => {
        const s = libVersions?.get(name);
        if (s) {
            const p = s.split('.');
            return { major: parseInt(p[0]), minor: parseInt(p[1]) };
        }
        // 🛡️ MISES À JOUR STRICTES LOGIQUIZ
        const defaults = {
            'H5P.InteractiveVideo': { major: 1, minor: 27 },
            'jQuery.ui':            { major: 1, minor: 10 },
            'H5P.JoubelUI':         { major: 1, minor: 3  },
            'H5P.Question':         { major: 1, minor: 5  },
            'H5P.Video':            { major: 1, minor: 6  },
            'H5P.DragNDrop':        { major: 1, minor: 1  },
            'H5P.DragNBar':         { major: 1, minor: 5  },
            'H5P.MultiChoice':      { major: 1, minor: 16 },
            'H5P.MarkTheWords':     { major: 1, minor: 11 },
            'H5P.TrueFalse':        { major: 1, minor: 8  },
            'H5P.Blanks':           { major: 1, minor: 14 },
            'H5P.DragText':         { major: 1, minor: 10 },
            'H5P.Summary':          { major: 1, minor: 10 },
            'H5P.FontIcons':        { major: 1, minor: 0  },
            'FontAwesome':          { major: 4, minor: 5  }
        };
        return defaults[name] || { major: 1, minor: 0 };
    };

    const libStr = (name) => { const v = getVer(name); return `${name} ${v.major}.${v.minor}`; };
    const depObj = (name) => { const v = getVer(name); return { machineName: name, majorVersion: v.major, minorVersion: v.minor }; };

    // Générateur UUID strict RFC4122 v4
    const subId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });

    const ts2sec = (ts) => { const p = (ts || '00:00').split(':'); return parseInt(p[0]) * 60 + parseInt(p[1]); };

    // ─── CONSTRUCTION DES INTERACTIONS ───────────────────────────────────────
    const h5pInteractions = [];
    let summaryData = null;

    for (const item of interactions) {
        const d = item.data || {};
        
        // 🌟 NOUVEAU : Calcul du timestamp de fin
        const sec = ts2sec(item.timestamp);
        const secEnd = item.timestampEnd ? ts2sec(item.timestampEnd) : sec + 5;


        // 🌟 NOUVEAU : On injecte le titre personnalisé s'il existe
        const makeMeta = (label) => {
            const finalTitle = item.title ? item.title : label;
            return {
                contentType: label,
                license:     'U',
                title:       finalTitle,
                authors:     [],
                changes:     [],
                extraTitle:  finalTitle
            };
        };

        let action = { subContentId: subId() };
        let libraryTitle = '';

        if (item.type === 'imported') {
            action = item.action;
            if (!action.subContentId) action.subContentId = subId();
            if (!action.metadata) action.metadata = makeMeta(item.libraryTitle || 'Activité Importée');
            libraryTitle = item.libraryTitle || 'Activité Importée';
        }
        else if (item.type === 'quiz' || item.type === 'multichoice') {
            const isMulti = item.type === 'multichoice';
            let opts = d.options || [];
            if (opts.length < 2) opts = ['Option 1', 'Option 2'];

            libraryTitle = isMulti ? 'Multiple Choice (Checkboxes)' : 'Multiple Choice (Radio)';
            action.metadata = makeMeta(libraryTitle);
            action.library  = libStr('H5P.MultiChoice');
            action.params = {
                question: `<p>${d.question || 'Question ?'}</p>`,
                answers: opts.map((opt, i) => {
                    const isCorrect = isMulti ? (d.correct || []).includes(i) : (i === d.correct);
                    return {
                        correct: isCorrect,
                        text: `<div>${opt || 'Option'}</div>`,
                        tipsAndFeedback: {
                            chosenFeedback: isCorrect ? (d.feedbackCorrect || '') : (d.feedbackIncorrect || '')
                        }
                    };
                }),
                overallFeedback: [{ from: 0, to: 100, feedback: "Terminé !" }],
				behaviour: {
				    enableRetry: true,
				    enableSolutionsButton: true,
				    type: 'auto',  // type uniquement pour multichoice
				    singlePoint: !isMulti,
				    randomAnswers: false,
				    showSolutionsRequiresInput: true
				},
                UI: {
                    checkAnswerButton: "Vérifier", submitAnswerButton: "Soumettre",
                    showSolutionButton: "Afficher la solution", tryAgainButton: "Réessayer"
                }
            };
        }
		else if (item.type === 'truefalse') {
				    libraryTitle    = 'True/False Question';
				    action.metadata = makeMeta(libraryTitle);
				    action.library  = libStr('H5P.TrueFalse');
				    action.params = {
				        question: `<p>${d.question || 'Vrai ou Faux ?'}</p>`,
                
				        // 🟢 CORRECTION 1 : On force la sortie en STRING ("true" ou "false")
				        correct: (d.answer === false || d.answer === 'false') ? "false" : "true",
                
				        behaviour: {
				            enableRetry: true, enableSolutionsButton: true,
				            feedbackOnCorrect: d.feedbackCorrect || '',
				            feedbackOnWrong: d.feedbackIncorrect || ''
				        },
				        l10n: {
				            trueText: 'Vrai', falseText: 'Faux', checkAnswer: 'Vérifier',
				            showSolutionButton: 'Afficher la solution', tryAgain: 'Réessayer'
				        }
				        // 🟢 CORRECTION 2 : On a supprimé 'overallFeedback' qui n'est pas supporté par TrueFalse
				    };
				}
        else if (item.type === 'fillblanks') {
            let safeText = d.text || 'Texte vide';
            if (!safeText.includes('*')) safeText += ' *vide*';

            libraryTitle    = 'Fill in the Blanks';
            action.metadata = makeMeta(libraryTitle);
            action.library  = libStr('H5P.Blanks');
            action.params = {
                media: { disableImageZooming: false },
                text: `<p>${d.instruction || 'Complétez les mots manquants'}</p>`,
                showSolutions: "Voir la correction",
                tryAgain: "Recommencer",
                checkAnswer: "Vérifier",
                submitAnswer: "Vérifier",
                notFilledOut: "Vous devez avoir rempli tous les blancs avant de voir la correction",
                answerIsCorrect: "':ans' est une réponse exacte",
                answerIsWrong: "':ans' est une réponse inexacte",
                answeredCorrectly: "Réponse exacte",
                answeredIncorrectly: "Mauvaise réponse",
                solutionLabel: "Réponse correcte :",
                inputLabel: "Blanc @num sur @total",
                inputHasTipLabel: "Indice disponible",
                tipLabel: "Indice",
				overallFeedback: [{ from: 0, to: 100, feedback: 'Terminé !' }],
                behaviour: {
                    enableRetry: true,
                    enableSolutionsButton: true,
                    enableCheckButton: true,
                    autoCheck: false,
                    caseSensitive: false,
                    showSolutionsRequiresInput: true,
                    separateLines: false,
                    confirmCheckDialog: false,
                    confirmRetryDialog: false,
                    acceptSpellingErrors: false
                },
                scoreBarLabel: "Vous avez obtenu :num points sur un total de :points",
                a11yCheck: "Vérifiez les réponses. Les réponses seront marquées comme correctes, incorrectes ou sans réponse.",
                a11yShowSolution: "Montrez la solution. La tâche sera marquée avec sa solution correcte.",
                a11yRetry: "Réessayez la tâche. Réinitialisez toutes les réponses et recommencez la tâche.",
                a11yCheckingModeHeader: "Mode de contrôle",
                confirmCheck: {
                    header: "Terminer ?",
                    body: "Êtes-vous sûr de vouloir terminer ?",
                    cancelLabel: "Annuler",
                    confirmLabel: "Terminer"
                },
                confirmRetry: {
                    header: "Recommencer ?",
                    body: "Êtes-vous sûr de vouloir recommencer ?",
                    cancelLabel: "Annuler",
                    confirmLabel: "Confirmer"
                },
                questions: [`<p>${safeText.replace(/\n/g, '<br>')}</p>`]
            };
        }
        else if (item.type === 'dragtext') {
            let safeText = d.text || 'Texte vide';
            if (!safeText.includes('*')) safeText += ' *vide*';

            libraryTitle    = 'Drag Text';
            action.metadata = makeMeta(libraryTitle);
            action.library  = libStr('H5P.DragText');
            action.params = {
                media: { disableImageZooming: false },
                taskDescription: `<p>${d.instruction || 'Faites glisser les mots.'}</p>`,
                textField: `<p>${safeText.replace(/\n/g, '<br>')}</p>`,
                overallFeedback: [{ from: 0, to: 100, feedback: 'Terminé !' }],
                checkAnswer: "Vérifier",
                submitAnswer: "Vérifier",
                tryAgain: "Recommencer",
                showSolution: "Voir la correction",
                dropZoneIndexLabel: "Zone de dépôt @index",
                emptyDropZoneLabel: "Zone vide",
                containsDropZoneLabel: "Contient @keyword",
                draggableTextLabel: "Texte glissable @text",
                feedbackHeader: "Feedback",
                scoreBarLabel: "Vous avez obtenu :num points sur un total de :total",
                a11yCheck: "Vérifiez les réponses. Les réponses seront marquées comme correctes, incorrectes ou sans réponse.",
                a11yShowSolution: "Afficher la solution. La tâche sera notée avec sa solution correcte.",
                a11yRetry: "Réessayer la tâche. Réinitialiser toutes les réponses et recommencer la tâche.",
                behaviour: {
                    enableRetry: true,
                    enableSolutionsButton: true,
                    enableCheckButton: true,
                    instantFeedback: false
                }
            };
        }
		// ✅ AJOUTER CE BLOC :
		else if (item.type === 'summary') {
		    libraryTitle    = 'Résumé'; // Force le français pour le tooltip par défaut
		    action.metadata = makeMeta(libraryTitle);
		    action.library  = libStr('H5P.Summary');
			action.params = {
			                intro: 'Choisissez les affirmations correctes',
			                summaries: (d.statements || []).map(s => ({ subContentId: subId(), summary: [s.correct, ...(s.distractors || [])], tip: '' })),
			                overallFeedback: [{ from: 0, to: 100, feedback: 'Terminé !' }],
                
			                // 👇 LES TRADUCTIONS DOIVENT ÊTRE À LA RACINE POUR LE MODULE SUMMARY
			                resultLabel: "Votre résultat :",
			                scoreLabel: "Mauvaises réponses :",
			                wrongAnswer: "Mauvaise réponse",
			                wrongAnswers: "Mauvaises réponses",
			                solvedLabel: "Résolu :",
			                scoreBarLabel: "Vous avez obtenu :num sur :total points"
			            };
		}
		
        else if (item.type === 'markthewords') {
            let safeText = d.text || 'Texte vide';
            if (!safeText.includes('*')) safeText += ' *vide*';

            libraryTitle    = 'Mark the Words';
            action.metadata = makeMeta(libraryTitle);
            action.library  = libStr('H5P.MarkTheWords');
            action.params = {
                media: { disableImageZooming: false },
                taskDescription: `<p>${d.instruction || 'Cliquez sur les mots.'}</p>`,
                textField: `<p>${safeText.replace(/\n/g, '<br>')}</p>`,
                overallFeedback: [{ from: 0, to: 100, feedback: 'Terminé !' }],
                checkAnswerButton: "Vérifier",
                submitAnswerButton: "Vérifier",
                tryAgainButton: "Recommencer",
                showSolutionButton: "Voir la correction",
                behaviour: {
                    enableRetry: true,
                    enableSolutionsButton: true,
                    enableCheckButton: true,
                    showScorePoints: true
                },
                correctAnswer: "Réponse correcte !",
                incorrectAnswer: "Réponse incorrecte !",
                missedAnswer: "Absence de réponse !",
                displaySolutionDescription: "L'activité a été mise à jour pour afficher la solution.",
                scoreBarLabel: "Vous avez :num points sur un total de :total",
                a11yFullTextLabel: "Texte complet lisible",
                a11yClickableTextLabel: "Texte complet où les mots peuvent être marqués",
                a11ySolutionModeHeader: "Mode solution",
                a11yCheckingHeader: "Mode de contrôle",
                a11yCheck: "Vérifiez les réponses. Les réponses seront marquées comme correctes, incorrectes ou sans réponse.",
                a11yShowSolution: "Afficher la solution. La tâche sera notée avec sa solution correcte.",
                a11yRetry: "Réessayer la tâche. Réinitialiser toutes les réponses et recommencer la tâche."
            };
        }

		if (item.overallFeedback && item.overallFeedback.length > 0 && action.params
		    && item.type !== 'truefalse') {   // ← ajouter cette exclusion
		    action.params.overallFeedback = item.overallFeedback;
		}

					// ✅ REMPLACER LA CRÉATION DE interactionNode PAR CECI :
					const interactionNode = {
					    x: 45, y: 45, width: 10, height: 10,
					    duration: { from: sec, to: secEnd },
					    pause: item.pause !== false,
					    displayType: 'button',
					    buttonSize: 'big',
					    //buttonOnMobile: false,
					    libraryTitle: libraryTitle,
					    action: action
					};

					// On ajoute la clé 'label' UNIQUEMENT si l'utilisateur en a tapé un
					if (item.label && item.label.trim() !== '') {
					    interactionNode.label = item.label; 
					}
            if (item.adaptivity) {
                interactionNode.adaptivity = { requireCompletion: item.adaptivity.requireCompletion || false };
                if (item.adaptivity.correct) interactionNode.adaptivity.correct = item.adaptivity.correct;
                if (item.adaptivity.wrong)   interactionNode.adaptivity.wrong   = item.adaptivity.wrong;
            }

            h5pInteractions.push(interactionNode);
        }
    

	// ─── GESTION DU RÉSUMÉ DE FIN (RÉCAPITULATIF NATIF) ──────────────────────
	    if (gs?.summaryAtEnd) {
	        // On parcours les interactions générées à l'envers pour trouver le DERNIER résumé
	        for (let i = h5pInteractions.length - 1; i >= 0; i--) {
	            if (h5pInteractions[i].action.library.startsWith('H5P.Summary')) {
	                // On le retire de la timeline classique (les petits boutons ronds)
	                const nativeSummary = h5pInteractions.splice(i, 1)[0];
                
	                // On prépare l'objet spécial pour la fin de la vidéo
	                summaryData = {
	                    task: nativeSummary.action,
	                    displayAt: gs.summaryEndSeconds || 3
	                };
	                break; // On ne prend que le dernier, on laisse les autres sur la timeline !
	            }
	        }
	    }
    

// ─── 1. DÉFINITION DES LANGUES (À FAIRE EN PREMIER) ──────────────────────
    // 🟢 On déplace ce bloc AVANT l'écran de soumission pour pouvoir utiliser currentLang !
    const currentLang = (gs?.translateUI !== false) 
        ? (document.getElementById('global-language')?.value || 'Français') 
        : 'English';

    const h5pLangMap = {
        'Français': 'fr', 'English': 'en', 'Spanish': 'es', 
        'German': 'de', 'Italian': 'it', 'Dutch': 'nl',
        'Portuguese': 'pt', 'Normand': 'fr', 
        'Latin': 'la'
    };
    const h5pLangCode = h5pLangMap[currentLang] || 'fr';

    // ─── CHAPITRES ET ÉCRAN DE SOUMISSION ────────────────────────────────────
    const h5pBookmarks = (data.bookmarks || []).map(b => ({
        time: ts2sec(b.timestamp), label: b.label
    }));

    const endscreens = [];
    if (gs?.enableSubmitScreen) {
        let videoDuration = vm.duration || 60;
        if (interactions.length > 0) {
            const lastTs = ts2sec(interactions[interactions.length - 1].timestamp);
            if (lastTs > videoDuration) videoDuration = lastTs + 5;
        }
        
        // 🟢 CORRECTION 1 : Titre traduit dynamiquement
        const submitLabel = currentLang === 'Français' ? 'Écran de soumission' : 'Submit screen';
        endscreens.push({ time: Math.max(0, videoDuration - 0.5), label: submitLabel });
    }

    // ─── 2. CONTENT.JSON ───────────────────────────────
    
    // Nettoyage de l'URL (On retire le proxy pour Moodle)
    let finalMoodleUrl = vm.url;
    if (finalMoodleUrl.includes('/proxy/stream?url=')) {
        const match = finalMoodleUrl.match(/url=([^&]+)/);
        if (match) {
            finalMoodleUrl = decodeURIComponent(match[1]);
        }
    }

    // 🟢 CORRECTION 2 : Force l'injection des traductions de l'écran de fin
    let baseL10n = getH5PLocalization(currentLang, 'InteractiveVideo') || {};
    if (currentLang === 'Français') {
        baseL10n = {
            ...baseL10n,
            endcardTitle: "@answered question(s) auxquelles vous avez répondu",
            endcardInformation: "Vous avez répondu à @answered questions.",
            endcardInformationOnSubmitButtonDisabled: "Vous avez répondu à @answered questions. Cliquez ci-dessous pour les soumettre.",
            endcardInformationNoAnswers: "Vous n'avez répondu à aucune question.",
            endcardInformationMustHaveAnswer: "Vous devez répondre à au moins une question avant de pouvoir soumettre.",
            endcardSubmitButton: "Soumettre les réponses",
            endcardSubmitMessage: "Vos réponses ont bien été enregistrées !",
            endcardTableRowAnswered: "Questions répondues",
            endcardTableRowScore: "Score",
            endcardAnsweredScore: "Réponses"
        };
    }

    const contentJson = {
        interactiveVideo: {
            video: {
                startScreenOptions: { title: 'Vidéo Interactive', hideStartTitle: false },
                files: [{ path: finalMoodleUrl, mime: vm.mime, copyright: { license: 'Copyright' } }] // 🛡️ Licence sécurisée pour Moodle
            },
            assets: { interactions: h5pInteractions, bookmarks: h5pBookmarks, endscreens: endscreens },
            ...(summaryData && { summary: summaryData }) // 📋 Le résumé natif à la fin
        },
        override: {
            showBookmarksmenuOnLoad: false, showRewind10: false, loop: false,
            deactivateSound: false, autoplay: false,
            preventSkipping: gs?.navigationControl !== 'none',
            ...(gs?.navigationControl !== 'none' && {
                preventSkippingMode: gs.navigationControl
            })
        },
        l10n: baseL10n // 🟢 Injection des traductions consolidées
    };
	
    // ─── 3. H5P.JSON (Utilise h5pLangCode) ───────────────────────────────────
    const ivVer = getVer('H5P.InteractiveVideo');
    const finalTitle = vm.mainTitle || "Vidéo Interactive";
	
    const h5pJson = {
        "title":           finalTitle,
        "language":        h5pLangCode,
        "defaultLanguage": h5pLangCode,
        "mainLibrary":     "H5P.InteractiveVideo",
        "majorVersion":    ivVer.major,
        "minorVersion":    ivVer.minor,
        "embedTypes":      ["iframe"],
        "license":         "U",
        "preloadedDependencies": [
            depObj('jQuery.ui'),
            depObj('H5P.JoubelUI'),
            depObj('H5P.Question'),
            depObj('H5P.Video'),
            depObj('H5P.DragNDrop'),
            depObj('H5P.DragNBar'),
            depObj('H5P.InteractiveVideo'),
            depObj('H5P.MultiChoice'),
            depObj('H5P.TrueFalse'),
            depObj('H5P.Blanks'),
            depObj('H5P.DragText'),
            depObj('H5P.MarkTheWords'),
            depObj('H5P.Summary'),
            depObj('H5P.FontIcons'),
            depObj('FontAwesome')
        ]
    };
	
    const zip = new JSZip();
// 🌟 LE NOM DU FICHIER .H5P SERA AUSSI BASÉ SUR LE TITRE (Slugify propre)
    const cleanFileName = finalTitle
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // 1. Supprime les accents (é devient e, à devient a)
        .replace(/[^a-zA-Z0-9]/g, '-')                    // 2. Remplace espaces, apostrophes et symboles par des tirets
        .replace(/-+/g, '-')                              // 3. Écrase les tirets multiples (ex: "---" devient "-")
        .replace(/^-|-$/g, '')                            // 4. Nettoie les tirets parasites au tout début ou à la fin
        .toLowerCase();                                   // 5. Met tout en minuscules
    zip.file('h5p.json',             JSON.stringify(h5pJson,     null, 2));
    zip.file('content/content.json', JSON.stringify(contentJson, null, 2));

    Object.keys(zip.files).forEach(filename => {
        if (zip.files[filename].dir) delete zip.files[filename];
    });

    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

	return {
	    blob:        blob,
	    fileName:    `video-interactive-${cleanFileName}-${Date.now()}.h5p`,
	    previewData: { h5pJson, contentJson }
	};
}