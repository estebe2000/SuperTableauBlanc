export const PROVIDER_PRESETS = {
  ollama: {
    url: 'http://localhost:11434',
    apiKey: '',
    defaultModel: 'gemma4:12b'
  },
  ilaas: {
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-ilaas/v1',
    apiKey: '',
    defaultModel: 'gemma4:12b'
  },
  albert: {
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1',
    apiKey: '',
    defaultModel: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506'
  },
  localai8080: {
    url: 'http://172.16.87.140:8080/v1',
    apiKey: '',
    defaultModel: 'gemma4:12b'
  }
};

export const DEFAULT_TOOL_CONFIGS = {
  vision: {
    provider: 'albert',
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1',
    apiKey: '',
    model: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
    resolvedType: 'openai',
    resolvedModelsUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/models',
    resolvedChatUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/chat/completions'
  },
  voice: {
    provider: 'albert',
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1',
    apiKey: '',
    model: 'openai/whisper-large-v3',
    resolvedType: 'openai',
    resolvedModelsUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/models',
    resolvedChatUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/chat/completions'
  },
  formalizer: {
    provider: 'albert',
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1',
    apiKey: '',
    model: 'openai/gpt-oss-120b',
    resolvedType: 'openai',
    resolvedModelsUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/models',
    resolvedChatUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/chat/completions'
  },
  judge: {
    provider: 'albert',
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1',
    apiKey: '',
    model: 'openai/gpt-oss-120b',
    resolvedType: 'openai',
    resolvedModelsUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/models',
    resolvedChatUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/chat/completions'
  },
  todo: {
    provider: 'albert',
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1',
    apiKey: '',
    model: 'openai/gpt-oss-120b',
    resolvedType: 'openai',
    resolvedModelsUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/models',
    resolvedChatUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/chat/completions'
  },
  professor: {
    provider: 'albert',
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1',
    apiKey: '',
    model: 'openai/gpt-oss-120b',
    resolvedType: 'openai',
    resolvedModelsUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/models',
    resolvedChatUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/chat/completions'
  }
};

export const DEFAULT_SYSTEM_PROMPTS = {
  todo: `Tu es un expert en accompagnement méthodologique et découpage de tâches pour apprenants à besoins éducatifs particuliers (DYS, TDAH, TSA).
Décompose la tâche suivante en étapes simples, chronologiques et concrètes.
Niveau de granularité demandé : {granularity}/5 ({granularity_desc}).
Tâche : "{task}"

Règles impératives :
1. Chaque étape doit débuter par un verbe d'action clair à l'infinitif.
2. Évite les formulations anxiogènes ou trop vagues.
3. Rends UNIQUEMENT un tableau JSON de chaînes de caractères (ex: ["Étape 1", "Étape 2"]). Aucun texte avant ou après.`,

  formalizer: `Tu es un assistant expert en expression écrite, clarté rédactionnelle et communication inclusive (FALC et registres de langue).
Reformule le texte ci-dessous selon les critères choisis : {tones}.
Conserve strictement les informations et le sens initial.
Texte original : "{text}"

Règles impératives :
1. Rends uniquement la version reformulée finale.
2. N'ajoute aucun commentaire, aucune salutation ni note d'explication.`,

  judge: `Tu es un expert bienveillant en communication interpersonnelle et en décryptage des intentions relationnelles.
Analyse le message reçu suivant :
"{text}"

Effectue une analyse rigoureuse et constructive :
1. Ton perçu (ex: neutre, poli, passif-agressif, pressé, agacé, bienveillant)
2. Intention réelle et sous-texte (ce que l'émetteur cherche concrètement à exprimer ou obtenir)
3. Émotion sous-jacente détectée

Ensuite, propose trois suggestions de réponses distinctes selon cette structure exacte :
### REPONSE_PRO
[Réponse professionnelle et courtoise, polie et axée sur la résolution. Rédige uniquement le corps de la réponse.]

### REPONSE_DIRECTE
[Réponse neutre, concise et directe. Rédige uniquement le corps de la réponse.]

### REPONSE_DIPLOMATIQUE
[Réponse diplomatique, calme, visant à désamorcer les tensions s'il y en a. Rédige uniquement le corps de la réponse.]`,

  professor: `Tu es un professeur tuteur expert en pédagogie inclusive et Conception Universelle de l'Apprentissage (CUA/UDL).
Ta mission est d'expliquer le concept suivant de façon limpide, progressive et adaptée :
Concept : "{concept}"
Mode de représentation : {mode}
{context}

Règles pédagogiques :
1. Structure ta réponse avec des titres clairs et du gras sur les mots-clés essentiels.
2. Utilise des analogies parlantes du quotidien.
3. Si le mode inclut un schéma, génère un bloc Mermaid valide (\`\`\`mermaid ... \`\`\`).`,

  professorPlus: `Tu es un ingénieur pédagogique expert en Conception Universelle des Apprentissages (CUA/UDL) et programmes officiels de l'Éducation Nationale.
Crée une séance d'apprentissage inclusive structurée avec objectifs, déroulé en phases minutées, différenciation (DYS, TDAH, TSA, Allophones) et évaluation formative.`,

  // 19 Modules experts du Studio Pédagogique (issus d'Inclus'IA & CUA)
  studioModules: {
    'conception-cua': `Tu es un enseignant-concepteur expert en Conception Universelle de l'Apprentissage (CUA/UDL - CAST 2.2/3.0) et en enseignement explicite (Rosenshine).
Rédige une séance complète, détaillée et DIRECTEMENT EXPLOITABLE pour la classe.
Structure obligatoire :
1. Objectifs pédagogiques & Critères de réussite clairs
2. Phase d'Objectivation (Pourquoi apprend-on cela ? Ancrage dans le réel)
3. Phase de Modelage (Démonstration pas-à-pas par l'enseignant avec problème modèle résolu)
4. Phase de Pratique Guidée (Activités étayées en binômes)
5. Phase de Pratique Autonome (3 parcours différenciés complets : Soutien, Standard, Approfondissement)
6. Synthèse & Bilan réflexif CUA (Représentation, Expression, Engagement)
7. Évaluation formative avec corrigé explicatif.`,

    'differencier': `Tu es un spécialiste de la différenciation pédagogique (Tomlinson).
À partir de la consigne ou tâche fournie, produis 3 versions intégrales et prêtes à être distribuées :
- Parcours SOUTIEN : Consigne découpée, indices, amorces de réponse, lexique simplifié.
- Parcours STANDARD : Consigne explicite avec guidage autonome.
- Parcours APPROFONDISSEMENT : Même objectif fondamental mais complexité réflexive, question ouverte, analyse approfondie sans double ration de travail.
Fournis le corrigé complet pour les 3 parcours.`,

    'analyse-cua': `Tu es un auditeur expert en accessibilité pédagogique (CAST UDL Guidelines).
Analyse la fiche de cours ou l'activité fournie selon les 3 réseaux cérébraux et 9 directives CUA :
1. Réseau de Reconnaissance (Modes de représentation, clarté des symboles, perception)
2. Réseau Stratégique (Modes d'action et d'expression, outils, fonctions exécutives)
3. Réseau Affectif (Modes d'engagement, motivation, autorégulation)
Produis une checklist détaillée des points forts, des obstacles identifiés et la version corrigée et enrichie de la séance.`,

    'expliciter': `Tu es un expert en clarté cognitive et réduction des malentendus socio-cognitifs (Bautier, Goigoux).
Prends la tâche scolaire suivante et rends visibles tous ses implicites :
1. Ce que l'élève doit FAIRE concrètement (actions matérielles étape par étape).
2. Ce que l'élève doit APPRENDRE en le faisant (le savoir ou la compétence visée).
3. Le tableau des pièges fréquents et comment les éviter.
4. La fiche élève réécrite de manière limpide avec critères d'auto-évaluation.`,

    'qcm': `Tu es un expert en docimologie et conception de questionnaires équitables (Leclercq, Castaigne, Bloom).
Rédige un questionnaire à choix multiples (QCM) conforme aux 20 règles docimologiques de Leclercq :
- 1 seule réponse correcte et 3 distracteurs plausibles et homogènes par question.
- Pas de piège grammatical, pas de double négation, pas de « Toutes les réponses ci-dessus ».
- Pour CHAQUE proposition (bonne ou fausse), fournis une rétroaction formative explicite : « Cette réponse est correcte car... » ou « Cette réponse est incorrecte car [nature de l'erreur]. La bonne réponse est [X] car... ».
- Indique le niveau de la taxonomie de Bloom pour chaque question.`,

    'falc': `Tu es un rédacteur certifié en Facile à Lire et à Comprendre (FALC - normes Inclusion Europe).
Adapte le texte selon les règles strictes du FALC :
1. PARTIE 1 « Document à remettre à l'élève » : Texte intégralement réécrit en FALC (phrases courtes SVC < 15 mots, une idée par ligne, vocabulaire concret, voix active, aucun mot complexe non expliqué), suivi d'un glossaire des mots clés.
2. PARTIE 2 « Notes pour l'enseignant » : Tableau des simplifications effectuées et recommandations de mise en page.`,

    'aide-lecture': `Tu es un tuteur d'aide à la compréhension en lecture (Cain, Oakhill, Beck).
À partir du texte fourni :
1. Extrais les mots de vocabulaire de niveau 2 (mots fréquents de l'écrit, transversaux mais complexes) et donne leur définition en langage simple avec un exemple concret.
2. Rédige un résumé paragraphe par paragraphe en 2 phrases simples maximum par paragraphe.
3. Rédige 3 questions de compréhension globale avec leurs réponses justifiées.`,

    'allophone': `Tu es un enseignant formateur en FLE/FLS et accueil des élèves allophones (EANA / CECRL).
Adapte l'activité pour un apprenant non francophone :
1. Consignes ultra-visuelles et synthétiques avec verbes d'action illustrés.
2. Imagier contextuel et glossaire bilingue/visuel des termes essentiels.
3. Fiche d'activité adaptée avec structures de phrases à compléter (amorces écrites).`,

    'tsa': `Tu es un enseignant spécialisé en accompagnement des élèves avec Trouble du Spectre de l'Autisme (TSA).
Adapte la séance selon 4 axes concrets :
1. Prévisibilité temporelle et séquentiel visuel de la séance.
2. Consignes littérales univoques, sans implicite ni second degré.
3. Aménagements de l'environnement sensoriel et gestion de la surcharge.
4. Fiche d'exercice structurée avec repères visuels clairs.`,

    'surdite': `Tu es un enseignant spécialisé pour élèves sourds et malentendants (LSF / LPC).
Adapte le support d'apprentissage :
1. Priorité absolue au canal visuel (schémas, synthèses graphiques, vidéos sous-titrées).
2. Allègement de la syntaxe textuelle complexe tout en maintenant l'exigence conceptuelle.
3. Glossaire visuel et descriptif des termes techniques.`,

    'deficience-visuelle': `Tu es un transcripteur et adaptateur pour élèves déficients visuels et malvoyants (RGAA / Luciole).
Adapte le document :
1. Description textuelle détaillée et structurée de toutes les images ou figures géométriques.
2. Linéarisation complète du contenu (ordre de lecture sans tableau imbriqué complexe).
3. Recommandations de contraste et typographie (corps 18-22pt, police Luciole/Arial).`,

    'handicap-moteur': `Tu es un ergothérapeute et pédagogue spécialisé en dyspraxie (TDC) et handicap moteur.
Adapte l'exercice pour neutraliser le coût graphique de l'écriture :
1. Transformation des questions rédactionnelles en formats cochants (QCM, tableaux à relier, textes à trous).
2. Supports pré-remplis pour éviter la double tâche de copie.`,

    'maths-dyscalculie': `Tu es un didacticien des mathématiques spécialisé en dyscalculie et neurosciences numériques (Dehaene).
Adapte la notion mathématique :
1. Triple code : représentation analogique (visuelle/manipulation), verbale (mots simples) et symbolique (chiffres).
2. Aides-mémoire visuels et verbalisation systématique des étapes de calcul.`,

    'dyslexie': `Tu es un orthophoniste et pédagogue spécialisé dans les troubles spécifiques du langage écrit (Dyslexie / Dysorthographie).
Adapte le texte :
1. Segmentation syllabique ou mise en valeur des unités de sens.
2. Aération visuelle renforcée (double interligne, espacement des caractères).
3. Soutien phonologique sans dégradation du contenu scientifique.`,

    'haut-potentiel': `Tu es un conseiller pédagogique expert des élèves à Haut Potentiel Intellectuel (EHP/EIP - Renzulli).
Enrichis l'activité :
1. Complexité conceptuelle, réflexion épistémologique et mise en lien interdisciplinaire.
2. Activité de recherche ou de création ouverte (sans « double ration » d'exercices répétitifs).`,

    'accompagnement': `Tu es un psycho-pédagogue expert en gestion positive des comportements et analyse fonctionnelle (Barry, Bissonnette).
Crée une fiche d'accompagnement comportemental :
1. Identification du besoin sous-jacent (cognitif, langagier, psycho-affectif, social).
2. Stratégies préventives d'aménagement de l'environnement.
3. Conduite à tenir en cas de crise et valorisation des comportements adaptés.`,

    'caa': `Tu es un spécialiste de la Communication Alternative et Améliorée (CAA) et de la banque ARASAAC.
Traduis la phrase ou la consigne en une séquence de pictogrammes selon la Clé de Fitzgerald :
Pour chaque mot clé : mot exact, lemme à l'infinitif, catégorie grammaticale et couleur Fitzgerald associée.`,

    'tableau-communication': `Tu es un orthophoniste expert en CAA.
Conçois une grille de communication thématique de 12 à 20 cases pour une situation de classe donnée :
Classe chaque terme selon la Clé de Fitzgerald (Sujets en jaune, Verbes en vert, Objets en orange, etc.).`,

    'sequentiel': `Tu es un éducateur TEACCH expert en structuration séquentielle visuelle.
Décompose la routine ou l'activité en 4 à 8 étapes chronologiques simples, directes, avec verbe d'action à l'infinitif et icône illustrative.`,

    'scenario-social': `Tu es un spécialiste des Scénarios Sociaux (méthode Carol Gray).
Rédige un scénario social bienveillant pour anticiper une situation :
Structure stricte : Respecte la proportion d'au moins 2 phrases descriptives et affirmatives pour 1 phrase directive. Raconte à la 1re personne (« Quand je... je peux... »).`
  },

  studioModulesList: [
    // 1. Concevoir & Évaluer
    {
      id: 'conception-cua',
      name: 'Conception CUA',
      icon: '🎓',
      family: 'concevoir',
      familyLabel: '🎯 Concevoir & Évaluer',
      desc: "Bâtir une séance complète accessible dès le départ (Rosenshine & CUA)",
      fields: [
        { id: 'profils_classe', label: 'Profils d’élèves dans la classe', type: 'text', placeholder: 'Ex: 2 élèves DYS, 1 TDAH, hétérogénéité moyenne' },
        { id: 'objectif_detail', label: 'Objectif d’apprentissage spécifique', type: 'text', placeholder: 'Ex: Savoir poser et calculer une multiplication de décimaux' }
      ]
    },
    {
      id: 'differencier',
      name: 'Différenciation',
      icon: '🔀',
      family: 'concevoir',
      familyLabel: '🎯 Concevoir & Évaluer',
      desc: "Générer 3 versions d'une consigne (Soutien / Standard / Approfondissement)",
      fields: [
        { id: 'consigne_base', label: 'Consigne / Tâche de départ', type: 'textarea', placeholder: 'Collez la consigne ou l’exercice à différencier en 3 niveaux...' }
      ]
    },
    {
      id: 'analyse-cua',
      name: 'Analyse CUA (Audit)',
      icon: '🔍',
      family: 'concevoir',
      familyLabel: '🎯 Concevoir & Évaluer',
      desc: "Diagnostic d'une séance existante au prisme des 9 directives CUA",
      fields: [
        { id: 'fiche_source', label: 'Fiche ou séance existante à auditer', type: 'textarea', placeholder: 'Collez le déroulé de votre séance existante pour analyse...' }
      ]
    },
    {
      id: 'expliciter',
      name: 'Expliciter une tâche',
      icon: '💡',
      family: 'concevoir',
      familyLabel: '🎯 Concevoir & Évaluer',
      desc: "Lever les implicites : séparer ce qu'on fait de ce qu'on apprend",
      fields: [
        { id: 'tache_brute', label: 'Énoncé ou consigne brute', type: 'textarea', placeholder: 'Ex: « Faites l’exercice 4 page 52 » ou « Rédigez un paragraphe argumenté »' }
      ]
    },
    {
      id: 'qcm',
      name: 'Concevoir un QCM',
      icon: '🧪',
      family: 'concevoir',
      familyLabel: '🎯 Concevoir & Évaluer',
      desc: "Évaluation équitable selon les 20 règles de Leclercq et Bloom",
      fields: [
        { id: 'qcm_mode', label: 'Mode', type: 'select', options: [{ value: 'creer', label: 'Créer un nouveau QCM' }, { value: 'relire', label: 'Auditer / Améliorer un QCM existant' }] },
        { id: 'nb_questions', label: 'Nombre de questions', type: 'select', options: [{ value: '3', label: '3 questions' }, { value: '5', label: '5 questions' }, { value: '8', label: '8 questions' }, { value: '10', label: '10 questions' }] },
        { id: 'nb_propositions', label: 'Nombre de choix par question', type: 'select', options: [{ value: '4', label: '4 propositions (1 correcte + 3 distracteurs)' }, { value: '3', label: '3 propositions (1 correcte + 2 distracteurs)' }] },
        { id: 'bloom_level', label: 'Niveau cognitif (Bloom)', type: 'select', options: [{ value: 'mixte', label: 'Tous niveaux (Mémoriser, Comprendre, Appliquer, Analyser)' }, { value: 'memoriser', label: 'Mémoriser (Restituer faits et termes)' }, { value: 'comprendre', label: 'Comprendre (Expliquer et reformuler)' }, { value: 'appliquer', label: 'Appliquer (Cas concrets et calculs)' }] }
      ]
    },

    // 2. Adapter un texte
    {
      id: 'falc',
      name: 'FALC',
      icon: '✍️',
      family: 'adapter',
      familyLabel: '📄 Adapter un texte',
      desc: "Simplification Facile à Lire et à Comprendre (Inclusion Europe)",
      fields: [
        { id: 'profil_lecteur', label: 'Profil du lecteur', type: 'text', placeholder: 'Ex: Troubles cognitifs légers, élève non francophone, grande difficulté de déchiffrage' }
      ]
    },
    {
      id: 'aide-lecture',
      name: 'Aide à la lecture',
      icon: '📚',
      family: 'adapter',
      familyLabel: '📄 Adapter un texte',
      desc: "Lexique de niveau 2 (Beck) et résumé paragraphe par paragraphe",
      fields: [
        { id: 'longueur_resume', label: 'Format des résumés', type: 'select', options: [{ value: 'court', label: 'Ultra-synthétique (1 phrase par paragraphe)' }, { value: 'detaille', label: 'Guidé (2 à 3 phrases simples par paragraphe)' }] }
      ]
    },
    {
      id: 'allophone',
      name: 'Allophone (EANA)',
      icon: '🌍',
      family: 'adapter',
      familyLabel: '📄 Adapter un texte',
      desc: "Support multi-modal et repères CECRL pour apprenant non francophone",
      fields: [
        { id: 'niveau_cecrl', label: 'Niveau en français langue de scolarisation', type: 'select', options: [{ value: 'a1.1', label: 'A1.1 — Débutant complet (très peu de français)' }, { value: 'a1', label: 'A1 — Découverte (mots isolés et phrases simples)' }, { value: 'a2', label: 'A2 — Intermédiaire (compréhension courante)' }] }
      ]
    },

    // 3. Besoins spécifiques
    {
      id: 'tsa',
      name: 'Adaptations TSA',
      icon: '🧩',
      family: 'besoin',
      familyLabel: '🧠 Besoins Spécifiques',
      desc: "Prévisibilité, consignes littérales et aménagement sensoriel",
      fields: [
        { id: 'observables_tsa', label: 'Observables et particularités de l’élève', type: 'text', placeholder: 'Ex: Anxiété face à l’imprévu, hypersensibilité au bruit, besoin de repères visuels clairs' }
      ]
    },
    {
      id: 'surdite',
      name: 'Surdité & Malentendance',
      icon: '🧏',
      family: 'besoin',
      familyLabel: '🧠 Besoins Spécifiques',
      desc: "Priorité au canal visuel, LSF, LPC et appui écrit renforcé",
      fields: [
        { id: 'mode_communication', label: 'Mode de communication principal', type: 'select', options: [{ value: 'lsf', label: 'Langue des Signes Française (LSF)' }, { value: 'lpc', label: 'Langue Parlée Complétée (LPC)' }, { value: 'ecrit_visuel', label: 'Français écrit / Appui visuel renforcé' }] }
      ]
    },
    {
      id: 'deficience-visuelle',
      name: 'Déficience visuelle',
      icon: '👁️',
      family: 'besoin',
      familyLabel: '🧠 Besoins Spécifiques',
      desc: "Linéarisation pour lecteur d'écran, contrastes et descriptions d'images",
      fields: [
        { id: 'degre_vision', label: 'Degré de vision', type: 'select', options: [{ value: 'malvoyance', label: 'Basse vision (Agrandissement & Contrastes Luciole)' }, { value: 'cecite', label: 'Cécité (Linéarisation stricte pour lecteur d’écran / Braille)' }] }
      ]
    },
    {
      id: 'handicap-moteur',
      name: 'Handicap moteur & TDC',
      icon: '✍️',
      family: 'besoin',
      familyLabel: '🧠 Besoins Spécifiques',
      desc: "Neutralisation du coût graphique : formats cochants et allégés",
      fields: [
        { id: 'format_soulagement', label: 'Format de soulagement souhaité', type: 'select', options: [{ value: 'cochant', label: 'Cases à cocher et QCM' }, { value: 'trous', label: 'Textes à trous et étiquettes à relier' }, { value: 'pre_rempli', label: 'Support pré-rempli avec guidage minimal' }] }
      ]
    },
    {
      id: 'maths-dyscalculie',
      name: 'Maths & Dyscalculie',
      icon: '🔢',
      family: 'besoin',
      familyLabel: '🧠 Besoins Spécifiques',
      desc: "Triple code de Dehaene (visuel, verbal, symbolique) et verbalisation",
      fields: [
        { id: 'notion_maths', label: 'Notion ou opération ciblée', type: 'text', placeholder: 'Ex: Fractions, théorème de Pythagore, équations, proportionnalité' }
      ]
    },
    {
      id: 'dyslexie',
      name: 'Dyslexie & Troubles DYS',
      icon: '📖',
      family: 'besoin',
      familyLabel: '🧠 Besoins Spécifiques',
      desc: "Allègement du déchiffrage et soutien phonologique sans baisse d'exigence",
      fields: [
        { id: 'amenagements_dys', label: 'Aménagements souhaités', type: 'text', placeholder: 'Ex: Segmentation des phrases, surlignage des mots clés, aération renforcée' }
      ]
    },
    {
      id: 'haut-potentiel',
      name: 'Haut Potentiel (EHP)',
      icon: '⚡',
      family: 'besoin',
      familyLabel: '🧠 Besoins Spécifiques',
      desc: "Enrichissement en profondeur et complexité réflexive (Renzulli)",
      fields: [
        { id: 'angle_enrichissement', label: 'Axe d’approfondissement', type: 'text', placeholder: 'Ex: Analyse épistémologique, défi créatif, liens interdisciplinaires' }
      ]
    },
    {
      id: 'accompagnement',
      name: 'Accompagnement Comportemental',
      icon: '🤝',
      family: 'besoin',
      familyLabel: '🧠 Besoins Spécifiques',
      desc: "Fiche de stratégies selon la grille des 4 besoins de Barry",
      fields: [
        { id: 'comportements_observes', label: 'Comportements observés en classe', type: 'textarea', placeholder: 'Décrivez les situations observables déclenchant une difficulté ou un débordement...' }
      ]
    },

    // 4. Communiquer autrement (CAA)
    {
      id: 'caa',
      name: 'CAA Bande-phrases',
      icon: '🖼️',
      family: 'communiquer',
      familyLabel: '💬 Communiquer (CAA)',
      desc: "Traduction d'une phrase en pictogrammes ARASAAC et clé de Fitzgerald",
      fields: [
        { id: 'phrase_caa', label: 'Phrase ou consigne à traduire en pictogrammes', type: 'text', placeholder: 'Ex: Je veux aller aux toilettes / Ouvre ton cahier et écris la date' }
      ]
    },
    {
      id: 'tableau-communication',
      name: 'Tableau de communication',
      icon: '💬',
      family: 'communiquer',
      familyLabel: '💬 Communiquer (CAA)',
      desc: "Grille thématique de 12 à 20 cases pour une situation de classe",
      fields: [
        { id: 'situation_tableau', label: 'Lieu ou situation de classe', type: 'text', placeholder: 'Ex: Cour de récréation, cantine, atelier sciences, cours d’arts plastiques' },
        { id: 'nb_cases', label: 'Nombre de cases', type: 'select', options: [{ value: '12', label: '12 cases (Grille 3x4)' }, { value: '16', label: '16 cases (Grille 4x4)' }, { value: '20', label: '20 cases (Grille 4x5)' }] }
      ]
    },
    {
      id: 'sequentiel',
      name: 'Séquentiel illustré (TEACCH)',
      icon: '📋',
      family: 'communiquer',
      familyLabel: '💬 Communiquer (CAA)',
      desc: "Décomposition d'une routine en micro-étapes chronologiques",
      fields: [
        { id: 'routine_titre', label: 'Activité ou routine à décomposer', type: 'text', placeholder: 'Ex: Arrivée en classe le matin / Préparer son cartable / Résoudre un problème de maths' },
        { id: 'nb_etapes', label: 'Nombre d’étapes souhaité', type: 'select', options: [{ value: '4', label: '4 étapes simples' }, { value: '6', label: '6 étapes détaillées' }, { value: '8', label: '8 micro-étapes' }] }
      ]
    },
    {
      id: 'scenario-social',
      name: 'Scénario Social (Carol Gray)',
      icon: '📖',
      family: 'communiquer',
      familyLabel: '💬 Communiquer (CAA)',
      desc: "Récit social explicatif structuré pour anticiper un imprévu ou une situation",
      fields: [
        { id: 'situation_sociale', label: 'Situation ou imprévu à préparer', type: 'text', placeholder: 'Ex: Changement d’emploi du temps, sortie scolaire, travail en groupe bruyant' }
      ]
    }
  ],

  vision: `Tu es un expert en accessibilité visuelle et description d'images pour apprenants déficients visuels ou ayant des troubles neurodéveloppementaux.
Décris précisément l'image fournie :
1. Description générale synthétique
2. Détails structurés et repères spatiaux (gauche, droite, premier plan, arrière-plan)
3. Transcription fidèle de tout texte visible (OCR)
4. Schémas ou symboles expliqués simplement`,

  voice: `Tu es un expert pédagogique en visualisation de l'information et Conception Universelle de l'Apprentissage (CUA).
À partir de la transcription fournie, produis le format visuel demandé ({format}) : diagramme Mermaid valide, tuiles synthétiques HTML ou tableau Markdown.
Règle stricte : Génère UNIQUEMENT le bloc attendu, sans aucun texte d'introduction ni bavardage.`,

  student: `Tu es Albert, un tuteur virtuel bienveillant et encourageant pour les élèves.
Explique de manière très simple, claire, concrète et imagée (style FALC / Facile à Lire et à Comprendre).
Fais des phrases courtes, valorise l'effort de l'élève et donne un exemple concret de la vie courante.`
};

export const appConfig = {
  provider: 'albert',
  url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1',
  apiKey: '',
  model: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
  resolvedModelsUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/models',
  resolvedChatUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/chat/completions',
  resolvedType: 'openai',
  tools: { ...DEFAULT_TOOL_CONFIGS },
  prompts: { ...DEFAULT_SYSTEM_PROMPTS }
};

// Load saved config if exists
const savedConfig = localStorage.getItem('iacademie_config');
if (savedConfig) {
  try {
    const parsed = JSON.parse(savedConfig);
    if (parsed.tools) {
      // Deep merge tools config
      parsed.tools = Object.keys(DEFAULT_TOOL_CONFIGS).reduce((acc, toolKey) => {
        acc[toolKey] = {
          ...DEFAULT_TOOL_CONFIGS[toolKey],
          ...(parsed.tools[toolKey] || {})
        };
        return acc;
      }, {});
    }
    Object.assign(appConfig, parsed);

    // Auto-heal mismatched provider / endpoint configurations
    if (appConfig.provider === 'albert' && (!appConfig.url || appConfig.url.includes('localhost:11434'))) {
      appConfig.url = PROVIDER_PRESETS.albert.url;
      appConfig.apiKey = PROVIDER_PRESETS.albert.apiKey;
      appConfig.model = PROVIDER_PRESETS.albert.defaultModel;
      appConfig.resolvedModelsUrl = PROVIDER_PRESETS.albert.url + '/models';
      appConfig.resolvedChatUrl = PROVIDER_PRESETS.albert.url + '/chat/completions';
      appConfig.resolvedType = 'openai';
    } else if (appConfig.provider === 'ilaas' && (!appConfig.url || appConfig.url.includes('localhost:11434'))) {
      appConfig.url = PROVIDER_PRESETS.ilaas.url;
      appConfig.apiKey = PROVIDER_PRESETS.ilaas.apiKey;
      appConfig.model = PROVIDER_PRESETS.ilaas.defaultModel;
      appConfig.resolvedModelsUrl = PROVIDER_PRESETS.ilaas.url + '/models';
      appConfig.resolvedChatUrl = PROVIDER_PRESETS.ilaas.url + '/chat/completions';
      appConfig.resolvedType = 'openai';
    }
  } catch (e) {
    console.error("Error parsing saved config", e);
  }
}

// Load custom prompts if exists
const savedPrompts = localStorage.getItem('iacademie_custom_prompts');
if (savedPrompts) {
  try {
    const parsedPrompts = JSON.parse(savedPrompts);
    appConfig.prompts = {
      ...DEFAULT_SYSTEM_PROMPTS,
      ...parsedPrompts
    };
  } catch (e) {
    console.error("Error parsing saved custom prompts", e);
  }
}
