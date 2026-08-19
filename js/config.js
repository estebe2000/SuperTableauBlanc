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
        { id: 'objectif', label: "Objectif d'apprentissage visé", type: 'text', placeholder: "Ex : Modéliser le coût du tabac et calculer des pourcentages" },
        { id: 'profils_classe', label: "Profils d'élèves de la classe", type: 'text', placeholder: "Ex : Hétérogénéité moyenne, 2 élèves DYS, 1 élève TDAH" },
        { id: 'contraintes_additionnelles', label: "Contraintes pédagogiques spécifiques", type: 'text', placeholder: "Ex : Travail en îlots de 4, matériel de géométrie autorisé" }
      ]
    },
    {
      id: 'differencier',
      name: 'Différenciation de consignes',
      icon: '🔀',
      family: 'concevoir',
      familyLabel: '🎯 Concevoir & Évaluer',
      desc: "Générer 3 versions d'une consigne (Soutien / Standard / Expert - Tomlinson)",
      fields: [
        { id: 'sourceInstruction', label: "Consigne ou tâche de base à différencier", type: 'textarea', placeholder: "Collez la consigne ou l'exercice à décliner en 3 parcours distincts..." },
        { id: 'objectif', label: "Objectif d'apprentissage socle", type: 'text', placeholder: "Ex : Savoir poser une équation à une inconnue" },
        { id: 'options_differenciation', label: "Leviers de différenciation prioritaires (Tomlinson)", type: 'select', options: [
          { value: 'processus_productions', label: "Processus & Productions (aides pas-à-pas / formats de réponse variés)" },
          { value: 'contenus_processus', label: "Contenus & Processus (supports visuels / amorces de raisonnement)" },
          { value: 'environnement', label: "Environnement & Modalités (binôme, temps, matériel d'étayage)" }
        ]}
      ]
    },
    {
      id: 'analyse-cua',
      name: 'Analyse CUA (Diagnostic)',
      icon: '🔍',
      family: 'concevoir',
      familyLabel: '🎯 Concevoir & Évaluer',
      desc: "Audit d'une séance existante au prisme des 9 directives CUA (CAST 2.2/3.0)",
      fields: [
        { id: 'sessionDescription', label: "Fiche ou déroulé de séance à diagnostiquer", type: 'textarea', placeholder: "Collez les objectifs, déroulement et modalités de votre séance existante..." },
        { id: 'probleme_observe', label: "Difficultés ou obstacles observés", type: 'text', placeholder: "Ex : Beaucoup d'élèves décrochent lors de la phase autonome" },
        { id: 'contraintes_materielles', label: "Matériel et environnement disponibles", type: 'text', placeholder: "Ex : Vidéoprojecteur, 1 tablette pour 2 élèves, tableau blanc" }
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
        { id: 'sourceText', label: "Tâche, consigne ou activité brute", type: 'textarea', placeholder: "Ex : « Rédigez un paragraphe argumenté à partir des documents 1 et 2 »" },
        { id: 'objectif', label: "Ce que la tâche vise réellement à faire apprendre", type: 'text', placeholder: "Ex : Savoir distinguer un fait historique d'une interprétation" },
        { id: 'constats', label: "Ce que vous observez chez les élèves", type: 'text', placeholder: "Ex : Les élèves recopient les documents sans argumenter" },
        { id: 'modalites', label: "Modalité de coopération retenue", type: 'select', options: [
          { value: 'relecture_croisee', label: "Relecture croisée en binôme avec critères" },
          { value: 'reformulation_orale', label: "Reformulation orale de l'attendu avant démarrage" },
          { value: 'confrontation_paires', label: "Confrontation de deux productions contrastées" }
        ]}
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
        { id: 'mode', label: "Mode de travail", type: 'select', options: [
          { value: 'creer', label: "Créer un nouveau QCM à partir d'une notion" },
          { value: 'relire', label: "Auditer / Améliorer un QCM existant" }
        ]},
        { id: 'notion', label: "Notion ou contenu à évaluer", type: 'textarea', placeholder: "Décrivez la notion ou collez le QCM à auditer..." },
        { id: 'objectif', label: "Objectif d'apprentissage évalué", type: 'text', placeholder: "Ex : Identifier la valeur de position des chiffres décimaux" },
        { id: 'nb_propositions', label: "Nombre de propositions par question", type: 'select', options: [
          { value: '4', label: "4 choix (1 réponse correcte + 3 distracteurs plausibles)" },
          { value: '3', label: "3 choix (1 réponse correcte + 2 distracteurs)" }
        ]},
        { id: 'bloom_level', label: "Niveau cognitif (Bloom)", type: 'select', options: [
          { value: 'mixte', label: "Équilibré (Mémoriser, Comprendre, Appliquer, Analyser)" },
          { value: 'memoriser', label: "Mémoriser (Restituer faits, définitions et règles)" },
          { value: 'comprendre', label: "Comprendre (Expliquer, reformuler et distinguer)" },
          { value: 'appliquer', label: "Appliquer (Résoudre des cas concrets et calculs)" }
        ]}
      ]
    },

    // 2. Adapter un texte
    {
      id: 'falc',
      name: 'FALC — Facile à Lire et à Comprendre',
      icon: '✍️',
      family: 'adapter',
      familyLabel: '📄 Adapter un texte',
      desc: "Simplification aux normes européennes (Inclusion Europe)",
      fields: [
        { id: 'sourceText', label: "Texte source à adapter en FALC", type: 'textarea', placeholder: "Collez le texte du cours, le règlement ou l'énoncé à simplifier..." },
        { id: 'profil', label: "Profil du lecteur", type: 'select', options: [
          { value: 'handicap_intellectuel', label: "Élève avec trouble cognitif / handicap intellectuel" },
          { value: 'difficulte_lecture', label: "Élève en grande difficulté de déchiffrage et compréhension" },
          { value: 'allophone_debutant', label: "Élève allophone nouvellement arrivé" }
        ]}
      ]
    },
    {
      id: 'aide-lecture',
      name: 'Aide à la lecture — Lexique & Résumé',
      icon: '📚',
      family: 'adapter',
      familyLabel: '📄 Adapter un texte',
      desc: "Lexique de niveau 2 (Beck) et résumé paragraphe par paragraphe",
      fields: [
        { id: 'sourceText', label: "Texte de lecture à équiper", type: 'textarea', placeholder: "Collez le texte ou document à analyser..." },
        { id: 'objectif_lecture', label: "Objectif de lecture visé", type: 'text', placeholder: "Ex : Comprendre la chronologie des événements et les causes" },
        { id: 'langue_maternelle', label: "Langue de traduction pour le lexique (optionnelle)", type: 'select', options: [
          { value: '', label: "Français uniquement (pas de traduction bilingue)" },
          { value: 'arabe', label: "Arabe (العربية)" },
          { value: 'ukrainien', label: "Ukrainien (Українська)" },
          { value: 'anglais', label: "Anglais (English)" },
          { value: 'espagnol', label: "Espagnol (Español)" },
          { value: 'portugais', label: "Portugais (Português)" },
          { value: 'turc', label: "Turc (Türkçe)" },
          { value: 'russe', label: "Russe (Русский)" }
        ]}
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
        { id: 'activityDescription', label: "Description de l'activité ou texte de travail", type: 'textarea', placeholder: "Collez le contenu disciplinaire à adapter pour l'élève allophone..." },
        { id: 'niveau_francais', label: "Niveau de français selon le CECRL", type: 'select', options: [
          { value: 'A1.1', label: "A1.1 — Débutant complet (très peu de mots, consignes 3-5 mots, appui image/geste)" },
          { value: 'A1', label: "A1 — Découverte (phrases très simples au présent, vocabulaire concret)" },
          { value: 'A2', label: "A2 — Intermédiaire (phrases courtes reliées, situations familières)" },
          { value: 'B1', label: "B1 — Seuil (textes cohérents, explication de raisonnement)" }
        ]},
        { id: 'langue_maternelle', label: "Langue maternelle de l'élève (pour le lexique bilingue)", type: 'select', options: [
          { value: 'arabe', label: "Arabe (العربية)" },
          { value: 'ukrainien', label: "Ukrainien (Українська)" },
          { value: 'espagnol', label: "Espagnol (Español)" },
          { value: 'anglais', label: "Anglais (English)" },
          { value: 'portugais', label: "Portugais (Português)" },
          { value: 'turc', label: "Turc (Türkçe)" },
          { value: 'roumain', label: "Roumain (Română)" },
          { value: 'russe', label: "Russe (Русский)" },
          { value: 'chinois', label: "Chinois (中文)" },
          { value: 'autre', label: "Autre langue / Sans traduction" }
        ]},
        { id: 'supports', label: "Types de supports souhaités", type: 'select', options: [
          { value: 'complet', label: "Complet : Lexique bilingue + Phrases modèles à trous + Consignes visuelles" },
          { value: 'lexique_seul', label: "Lexique bilingue disciplinaire illustré en tableau Markdown" },
          { value: 'phrases_trous', label: "Structures de phrases modèles à compléter (amorces écrites)" }
        ]}
      ]
    },

    // 3. Besoins spécifiques
    {
      id: 'tsa',
      name: 'Adaptations TSA (Autisme)',
      icon: '🧩',
      family: 'besoin',
      familyLabel: '🧠 Besoins Spécifiques',
      desc: "Prévisibilité, communication littérale et aménagement sensoriel",
      fields: [
        { id: 'observables', label: "Observables relevés en classe", type: 'textarea', placeholder: "Décrivez les comportements observés (anxiété lors des transitions, sensibilité au bruit, besoin de repères visuels)..." },
        { id: 'contexte', label: "Contexte de mise en œuvre", type: 'select', options: [
          { value: 'classe_entiere', label: "Classe entière avec AESH" },
          { value: 'classe_seul', label: "Classe ordinaire en autonomie" },
          { value: 'petit_groupe', label: "Travail en petit groupe / Îlots" }
        ]}
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
        { id: 'sourceText', label: "Activité ou support à adapter", type: 'textarea', placeholder: "Collez le texte ou la consigne de l'activité..." },
        { id: 'mode_communication', label: "Mode de communication de l'élève", type: 'select', options: [
          { value: 'LSF', label: "Bilingue LSF (Langue des Signes Française)" },
          { value: 'LPC', label: "Oraliste avec LPC (Langue française Parlée Complétée)" },
          { value: 'ecrit_visuel', label: "Appui écrit et visuel renforcé (lecture labiale)" }
        ]},
        { id: 'supports', label: "Supports souhaités", type: 'select', options: [
          { value: 'consignes_lexique', label: "Consignes écrites visuelles + Lexique illustré de la séance" },
          { value: 'preparation_amont', label: "Supports à fournir à l'avance (textes pré-écrits, transcriptions)" }
        ]}
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
        { id: 'sourceText', label: "Support à adapter (texte et description des figures)", type: 'textarea', placeholder: "Collez le texte du document et décrivez brièvement les schémas présents..." },
        { id: 'type_deficience', label: "Degré de déficience", type: 'select', options: [
          { value: 'malvoyance', label: "Malvoyance / Basse vision (Agrandissement, Luciole, Contrastes WCAG)" },
          { value: 'cecite', label: "Cécité (Linéarisation stricte pour lecteur d'écran / Braille)" }
        ]},
        { id: 'nature_support', label: "Nature des contenus", type: 'select', options: [
          { value: 'texte_figures', label: "Texte avec figures géométriques / Schémas à décrire" },
          { value: 'texte_seul', label: "Texte documentaire / Consignes écrites" },
          { value: 'tableaux_complexes', label: "Tableaux de données à mettre à plat" }
        ]}
      ]
    },
    {
      id: 'handicap-moteur',
      name: 'Handicap moteur & Dyspraxie (TDC)',
      icon: '✍️',
      family: 'besoin',
      familyLabel: '🧠 Besoins Spécifiques',
      desc: "Neutralisation du coût graphique : formats cochants et allégés",
      fields: [
        { id: 'sourceText', label: "Activité ou évaluation à ré-outiller", type: 'textarea', placeholder: "Collez les exercices ou questions rédactionnelles..." },
        { id: 'entraves', label: "Entrave motrice principale", type: 'select', options: [
          { value: 'fatigabilite_graphique', label: "Fatigabilité et lenteur de l'écriture manuscrite" },
          { value: 'dyspraxie_visuo_spatiale', label: "Trouble visuo-spatial (difficulté de repérage et de tracé)" },
          { value: 'coordination_motrice', label: "Atteinte motrice des membres supérieurs" }
        ]},
        { id: 'alternatives', label: "Alternative matérielle disponible", type: 'select', options: [
          { value: 'numerique', label: "Ordinateur / Tablette en classe" },
          { value: 'secretaire_aesh', label: "Secrétaire / AESH pour la dictée" },
          { value: 'papier_adapte', label: "Papier adapté pré-rempli avec lignage et cases" }
        ]}
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
        { id: 'sourceText', label: "Notion ou exercice de mathématiques", type: 'textarea', placeholder: "Collez l'exercice ou la notion de calcul/géométrie..." },
        { id: 'obstacles', label: "Obstacle cognitif ciblé", type: 'select', options: [
          { value: 'sens_du_nombre', label: "Sens du nombre et passage entre les 3 codes (Dehaene)" },
          { value: 'charge_lecture', label: "Charge de lecture de l'énoncé qui masque le raisonnement" },
          { value: 'memoire_travail', label: "Surcharge de la mémoire de travail dans les calculs posés" }
        ]},
        { id: 'leviers', label: "Levier d'adaptation prioritaire", type: 'select', options: [
          { value: 'manipulation_visuel', label: "Manipulation concrète (réglettes, cubes) puis représentation imagée" },
          { value: 'etapes_verbalisation', label: "Procédure décomposée pas-à-pas avec verbalisation" },
          { value: 'aides_memoire', label: "Aides-mémoire réutilisables (tables, réglettes, repères)" }
        ]}
      ]
    },
    {
      id: 'dyslexie',
      name: 'Dyslexie & Dysorthographie',
      icon: '📖',
      family: 'besoin',
      familyLabel: '🧠 Besoins Spécifiques',
      desc: "Allègement du déchiffrage et soutien phonologique sans baisse d'exigence",
      fields: [
        { id: 'sourceText', label: "Support à adapter (texte, énoncé, consigne)", type: 'textarea', placeholder: "Collez le texte source ou le document de cours..." },
        { id: 'obstacles', label: "Obstacle principal", type: 'select', options: [
          { value: 'dechiffrage_couteux', label: "Déchiffrage coûteux qui sature la compréhension (Gough & Tunmer)" },
          { value: 'surcharge_visuelle', label: "Encombrement visuel et fatigue de lecture" },
          { value: 'double_tache_copie', label: "Double tâche de copie et d'écoute" }
        ]},
        { id: 'leviers', label: "Leviers retenus", type: 'select', options: [
          { value: 'espacement_aeration', label: "Aération visuelle stricte (interligne 1.5, pas de justifié, paragraphes courts)" },
          { value: 'canal_audio_oral', label: "Contournement par le canal oral / audio / lecture à voix haute" },
          { value: 'quantite_ajustee', label: "Quantité d'écrit allégée sans baisse de l'exigence conceptuelle" }
        ]}
      ]
    },
    {
      id: 'haut-potentiel',
      name: 'Haut Potentiel (EHP/EIP)',
      icon: '⚡',
      family: 'besoin',
      familyLabel: '🧠 Besoins Spécifiques',
      desc: "Enrichissement en profondeur et complexité réflexive (Renzulli)",
      fields: [
        { id: 'sourceText', label: "Activité ou séance standard à enrichir", type: 'textarea', placeholder: "Collez l'activité proposée à l'ensemble de la classe..." },
        { id: 'objectif', label: "Objectif d'apprentissage socle de la classe", type: 'text', placeholder: "Ex : Maîtriser le théorème de Pythagore" },
        { id: 'type_enrichissement', label: "Type d'enrichissement souhaité (Renzulli)", type: 'select', options: [
          { value: 'complexification', label: "Complexification et abstraction (cas limites, contraintes supplémentaires)" },
          { value: 'ouverture_projet', label: "Ouverture interdisciplinaire et démarche d'investigation" },
          { value: 'analyse_critique', label: "Analyse critique et questions de niveau Bloom supérieur" }
        ]}
      ]
    },
    {
      id: 'accompagnement',
      name: 'Accompagnement Comportemental',
      icon: '🤝',
      family: 'besoin',
      familyLabel: '🧠 Besoins Spécifiques',
      desc: "Fiche de stratégies selon le modèle RAI à 3 paliers et grille de Barry",
      fields: [
        { id: 'comportements', label: "Comportements observables en classe (faits descriptifs)", type: 'textarea', placeholder: "Décrivez précisément ce qui se voit et s'entend (situation déclenchante, durée, fréquence)..." },
        { id: 'contexte', label: "Contexte de survenue", type: 'select', options: [
          { value: 'travail_individuel', label: "Pendant le travail individuel écrit" },
          { value: 'transitions', label: "Lors des transitions et changements d'activité" },
          { value: 'travail_groupe', label: "Pendant les temps d'échange ou de travail collectif" }
        ]},
        { id: 'ressources', label: "Ressources disponibles", type: 'select', options: [
          { value: 'enseignant_seul', label: "Enseignant seul en classe ordinaire" },
          { value: 'avec_aesh', label: "Avec accompagnement AESH" },
          { value: 'appui_rased', label: "Avec appui du RASED ou enseignant spécialisé" }
        ]}
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
        { id: 'phrase', label: "Phrase à mettre en pictogrammes", type: 'text', placeholder: "Ex : À midi, je mange à la cantine avec mes camarades" },
        { id: 'profil', label: "Profil de communication", type: 'text', placeholder: "Ex : Élève non verbal utilisant un classeur de communication PECS/CAA" }
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
        { id: 'situation', label: "Situation ou lieu de la classe", type: 'text', placeholder: "Ex : La cantine, la cour de récréation, l'atelier sciences, le cours d'EPS" },
        { id: 'nb_cases', label: "Nombre de cases de la grille", type: 'select', options: [
          { value: '16', label: "16 cases (Grille 4x4 avec vocabulaire noyau + situation)" },
          { value: '12', label: "12 cases (Grille 3x4 allégée)" },
          { value: '20', label: "20 cases (Grille 4x5 étendue)" }
        ]}
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
        { id: 'routine', label: "Routine ou activité à décomposer", type: 'text', placeholder: "Ex : Se laver les mains / Préparer son matériel de géométrie / Résoudre un problème" },
        { id: 'nb_etapes', label: "Nombre d'étapes souhaité", type: 'select', options: [
          { value: '6', label: "6 étapes détaillées" },
          { value: '4', label: "4 étapes simples" },
          { value: '8', label: "8 micro-étapes exhaustives" }
        ]}
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
        { id: 'situation', label: "Situation sociale ou imprévu à préparer", type: 'text', placeholder: "Ex : L'alarme incendie va sonner / Un professeur remplaçant arrive / Sortie scolaire" },
        { id: 'profil', label: "Profil de l'élève", type: 'text', placeholder: "Ex : Élève autiste ayant une grande anxiété face au changement de routine" }
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
