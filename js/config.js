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

    'allophone': `Tu es un enseignant formateur expert en FLE/FLS et accueil des élèves allophones (EANA / CECRL).
Adapte l'activité pour un apprenant non francophone :
1. PARTIE 1 - ÉLÈVE :
   - Mise en situation concrète avec balises de pictogrammes : utilise la balise [picto: mot_clé] (ex: [picto: carte postale], [picto: vent], [picto: lampe]). N'invente pas de faux liens Markdown d'images.
   - Tableau de Lexique disciplinaire bilingue complet avec colonnes : | Mot (français) | Traduction | Exemple simple |
   - Schéma de décision ou règle visuelle : si tu inclus un bloc Mermaid, utilise une syntaxe simple et valide :
\`\`\`mermaid
graph TD
  A["Règle ou Question"] -->|Option 1| B["Action A"]
  A -->|Option 2| C["Action B"]
\`\`\`
   - Phrases modèles à trous (ex: « J'écris le mot [mot] avec [en/an] ») et 4 exercices concrets prêts à imprimer.
2. PARTIE 2 - ENSEIGNANT : Déroulé minuté, principes d'accessibilité et corrigé complet.`,

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

export const INCLUSIA_LANGUAGES = [
  "Albanais", "Allemand", "Anglais", "Arabe", "Arménien", "Bambara", "Bengali", "Berbère", "Bulgare",
  "Chinois (mandarin)", "Coréen", "Créole haïtien", "Dari", "Espagnol", "Géorgien", "Grec", "Hindi",
  "Italien", "Japonais", "Khmer", "Kurde", "Lingala", "Malgache", "Néerlandais", "Ourdou", "Pachto",
  "Peul", "Polonais", "Portugais", "Roumain", "Russe", "Serbe", "Somali", "Soninké", "Swahili",
  "Tamoul", "Tchétchène", "Thaï", "Tigrigna", "Turc", "Ukrainien", "Vietnamien", "Wolof"
];

export const studioModulesList = [
  // 1. Concevoir & Évaluer
  {
    id: 'conception-cua',
    name: 'Conception CUA',
    icon: '🎓',
    family: 'concevoir',
    familyLabel: '🎯 Concevoir & Évaluer',
    desc: "Bâtir une séance accessible à tous dès le départ (Rosenshine & CUA)",
    fields: [
      { id: 'sujet', label: "Sujet ou thème de la séance *", type: 'text', placeholder: "Ex : Les fractions et pourcentages dans la vie quotidienne" },
      { id: 'objectif', label: "Objectif d'apprentissage visé *", type: 'text', placeholder: "Ex : Savoir modéliser et calculer des proportions" },
      { id: 'profils_classe', label: "Profils d'élèves / Hétérogénéité", type: 'text', placeholder: "Ex : 2 élèves DYS, 1 élève TDAH, écarts de vitesse de calcul" },
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. tenir sur une page, travail en îlots..." }
    ]
  },
  {
    id: 'differencier',
    name: 'Différenciation de consignes',
    icon: '🔀',
    family: 'concevoir',
    familyLabel: '🎯 Concevoir & Évaluer',
    desc: "Générer 3 versions d'une même consigne (Soutien / Standard / Expert - Tomlinson)",
    fields: [
      { id: 'sourceInstruction', label: "Consigne source à différencier *", type: 'textarea', placeholder: "Collez la consigne ou l'exercice à décliner en 3 versions autonomes..." },
      { id: 'objectif', label: "Objectif d'apprentissage *", type: 'text', placeholder: "Ex : Savoir justifier une réponse avec un argument historique" },
      { id: 'options_differenciation', label: "Options de différenciation prioritaires", type: 'select', options: [
        { value: 'Processus et productions', label: "Processus & Productions (étayage pas-à-pas / formats de réponse variés)" },
        { value: 'Contenus et processus', label: "Contenus & Processus (supports imagés / lexique allégé)" },
        { value: 'Environnement et matériel', label: "Environnement & Matériel (binôme, manipulation, temps)" }
      ]},
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. même format d'évaluation pour tous..." }
    ]
  },
  {
    id: 'analyse-cua',
    name: 'Analyse CUA (Diagnostic)',
    icon: '🔍',
    family: 'concevoir',
    familyLabel: '🎯 Concevoir & Évaluer',
    desc: "Diagnostic d'une séance existante au prisme des 9 directives CUA",
    fields: [
      { id: 'sessionDescription', label: "Description de la séance (objectif, déroulement, évaluation) *", type: 'textarea', placeholder: "Collez les phases, consignes et supports de votre séance..." },
      { id: 'probleme_observe', label: "Problèmes ou obstacles observés", type: 'text', placeholder: "Ex : Décrochage lors du passage à l'écrit, manque d'autonomie" },
      { id: 'contraintes_materielles', label: "Contraintes matérielles de la classe", type: 'text', placeholder: "Ex : Pas d'ordinateurs, vidéoprojecteur disponible" },
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. prioriser les aménagements à faible coût de préparation..." }
    ]
  },
  {
    id: 'expliciter',
    name: 'Expliciter une tâche',
    icon: '💡',
    family: 'concevoir',
    familyLabel: '🎯 Concevoir & Évaluer',
    desc: "Rendre visible ce qu'une tâche attend sans le dire, sans en baisser l'exigence",
    fields: [
      { id: 'sourceText', label: "Tâche, consigne ou activité telle que vous la donnez *", type: 'textarea', placeholder: "Ex : « Rédigez une synthèse de 10 lignes sur l'expérience en vous aidant du schéma »" },
      { id: 'objectif', label: "Ce que la tâche vise à faire apprendre *", type: 'text', placeholder: "Ex : Maîtriser le vocabulaire de la démarche scientifique" },
      { id: 'constats', label: "Ce que vous observez chez les élèves", type: 'text', placeholder: "Ex : Les élèves décrivent le schéma sans formuler de conclusion" },
      { id: 'modalites', label: "Leviers retenus", type: 'select', options: [
        { value: 'Relecture croisée avec critères', label: "Relecture croisée en binôme avec critères en mots d'élèves" },
        { value: 'Reformulation de consigne', label: "Reformulation orale de l'attendu avant démarrage" },
        { value: 'Exemple contrasté', label: "Confrontation de deux productions contrastées" }
      ]},
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. formuler 3 critères observables..." }
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
      { id: 'qcm_mode', label: "Mode de conception *", type: 'select', options: [
        { value: 'creer', label: "Créer un nouveau QCM" },
        { value: 'relire', label: "Auditer / Améliorer un QCM existant" }
      ]},
      { id: 'notion', label: "Notion ou contenu à évaluer (ou QCM à auditer) *", type: 'textarea', placeholder: "Collez la leçon, le texte de référence ou votre QCM à auditer..." },
      { id: 'objectif', label: "Objectif d'apprentissage", type: 'text', placeholder: "Ex : Distinguer aire et périmètre" },
      { id: 'nb_propositions', label: "Nombre de choix par question", type: 'select', options: [
        { value: '4 propositions', label: "4 propositions (1 correcte + 3 distracteurs plausibles)" },
        { value: '3 propositions', label: "3 propositions (1 correcte + 2 distracteurs)" }
      ]},
      { id: 'bloom_level', label: "Niveau cognitif ciblé (Bloom)", type: 'select', options: [
        { value: 'Équilibré (Mémoriser, Comprendre, Appliquer)', label: "Équilibré (Mémoriser, Comprendre, Appliquer)" },
        { value: 'Mémoriser (Définitions et faits)', label: "Mémoriser (Définitions et faits)" },
        { value: 'Comprendre (Explications et sens)', label: "Comprendre (Explications et sens)" },
        { value: 'Appliquer (Cas pratiques et calculs)', label: "Appliquer (Cas pratiques et calculs)" }
      ]},
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. expliciter chaque distracteur..." }
    ]
  },

  // 2. Adapter un texte
  {
    id: 'falc',
    name: 'FALC — Facile à Lire et à Comprendre',
    icon: '✍️',
    family: 'adapter',
    familyLabel: '📄 Adapter un texte',
    desc: "Adapter un texte en version simplifiée (normes Inclusion Europe)",
    fields: [
      { id: 'sourceText', label: "Texte à adapter en FALC *", type: 'textarea', placeholder: "Collez le texte du cours, l'énoncé ou le document..." },
      { id: 'profil', label: "Profil de l'élève/étudiant", type: 'select', options: [
        { value: 'Troubles cognitifs ou handicap intellectuel', label: "Élève avec troubles cognitifs ou handicap intellectuel" },
        { value: 'Grande difficulté de déchiffrage', label: "Élève en grande difficulté de lecture" },
        { value: 'Allophone débutant', label: "Élève allophone débutant" }
      ]},
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. garder le vocabulaire essentiel avec glossaire..." }
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
      { id: 'sourceText', label: "Texte source à équiper *", type: 'textarea', placeholder: "Collez le texte à analyser..." },
      { id: 'objectif_lecture', label: "Objectif de lecture", type: 'text', placeholder: "Ex : Extraire les causes et conséquences de la Révolution" },
      { id: 'langue_maternelle', label: "Langue maternelle de référence pour le lexique", type: 'select', options: [
        { value: '', label: "Français uniquement (pas de traduction)" },
        ...INCLUSIA_LANGUAGES.map(l => ({ value: l, label: l }))
      ]},
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. questions de compréhension en fin de fiche..." }
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
      { id: 'activityDescription', label: "Description de l'activité *", type: 'textarea', placeholder: "Séance de géographie sur les paysages de France. Les élèves doivent lire un texte descriptif, identifier les éléments du paysage sur une carte et rédiger 3 phrases sur le paysage de leur choix." },
      { id: 'niveau_francais', label: "Niveau de français de l'élève/étudiant *", type: 'select', options: [
        { value: 'Ne parle pas français', label: "Ne parle pas français (A1.1 — Débutant complet)" },
        { value: 'Quelques mots', label: "Quelques mots (A1 — Découverte)" },
        { value: 'Phrases simples', label: "Phrases simples (A2 — Intermédiaire)" },
        { value: 'Conversations basiques', label: "Conversations basiques (B1 — Seuil)" }
      ]},
      { id: 'langue_maternelle', label: "Langue maternelle", type: 'select', options: [
        { value: 'Arabe', label: "Arabe" },
        ...INCLUSIA_LANGUAGES.filter(l => l !== 'Arabe').map(l => ({ value: l, label: l })),
        { value: '__other__', label: "Autre langue…" }
      ]},
      { id: 'supports', label: "Types de supports souhaités", type: 'checkboxes', options: [
        { value: 'Texte simplifié', label: "Texte simplifié", checked: true },
        { value: 'Consignes visuelles décrites', label: "Consignes visuelles décrites", checked: true },
        { value: 'Lexique illustré', label: "Lexique illustré", checked: true },
        { value: 'Phrase modèle à trous', label: "Phrase modèle à trous", checked: true },
        { value: 'Autre', label: "Autre", checked: false }
      ]},
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. tenir sur une page, garder le vocabulaire disciplinaire…" }
    ]
  },

  // 3. Besoins spécifiques
  {
    id: 'tsa',
    name: 'Adaptations TSA (Autisme)',
    icon: '🧩',
    family: 'besoin',
    familyLabel: '🧠 Besoins Spécifiques',
    desc: "Traduire des fonctionnements observés en classe en adaptations concrètes",
    fields: [
      { id: 'observables', label: "Observables relevés en classe par domaine *", type: 'textarea', placeholder: "Ex : Anxiété lors des transitions, difficulté à interpréter les métaphores, hypersensibilité au bruit..." },
      { id: 'contexte', label: "Contexte de mise en œuvre", type: 'select', options: [
        { value: 'Classe entière avec AESH', label: "Classe entière avec AESH" },
        { value: 'Classe ordinaire en autonomie', label: "Classe ordinaire en autonomie" },
        { value: 'Travail en petit groupe', label: "Travail en petit groupe / Îlots" }
      ]},
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. fournir un timer visuel, prévoir un sas de repli..." }
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
      { id: 'sourceText', label: "Activité ou support à adapter *", type: 'textarea', placeholder: "Collez le texte ou la consigne de l'activité..." },
      { id: 'mode_communication', label: "Mode de communication de l'élève *", type: 'select', options: [
        { value: 'Bilingue LSF', label: "Bilingue LSF (Langue des Signes Française)" },
        { value: 'Oraliste avec LPC', label: "Oraliste avec LPC (Langue française Parlée Complétée)" },
        { value: 'Appui écrit et visuel', label: "Appui écrit et visuel renforcé (lecture labiale)" }
      ]},
      { id: 'difficultes', label: "Difficulté(s) visée(s)", type: 'text', placeholder: "Ex : Double tâche sensorielle, charge lexicale" },
      { id: 'supports', label: "Supports souhaités", type: 'select', options: [
        { value: 'Consignes écrites et lexique illustré', label: "Consignes écrites visuelles + Lexique illustré" },
        { value: 'Documents préparatoires à l’avance', label: "Supports à préparer à l'avance (textes pré-écrits, transcriptions)" }
      ]},
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. sous-titrage obligatoire pour toute vidéo..." }
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
      { id: 'sourceText', label: "Support à adapter (texte, énoncé, description des figures) *", type: 'textarea', placeholder: "Collez le texte du document et décrivez brièvement les schémas/cartes..." },
      { id: 'type_deficience', label: "Type de déficience *", type: 'select', options: [
        { value: 'Malvoyance / Basse vision', label: "Malvoyance / Basse vision (Agrandissement, Luciole, Contrastes WCAG)" },
        { value: 'Cécité', label: "Cécité (Linéarisation stricte pour lecteur d'écran / Braille)" }
      ]},
      { id: 'nature_support', label: "Nature du support", type: 'select', options: [
        { value: 'Texte avec figures géométriques / Cartes', label: "Texte avec figures géométriques / Schémas à décrire" },
        { value: 'Texte documentaire / Consignes seules', label: "Texte documentaire / Consignes seules" },
        { value: 'Tableaux de données complexes', label: "Tableaux de données complexes à mettre à plat" }
      ]},
      { id: 'adaptations', label: "Adaptations souhaitées", type: 'text', placeholder: "Ex : Descriptions pédagogiques détaillées, mise à plat des tableaux" },
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. police Luciole 18pt minimum..." }
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
      { id: 'sourceText', label: "Activité ou évaluation à ré-outiller *", type: 'textarea', placeholder: "Collez les exercices ou questions rédactionnelles..." },
      { id: 'entraves', label: "Entrave(s) motrice(s) visée(s)", type: 'select', options: [
        { value: 'Fatigabilité et lenteur de l’écriture', label: "Fatigabilité et lenteur de l'écriture manuscrite" },
        { value: 'Dyspraxie visuo-spatiale', label: "Trouble visuo-spatial (difficulté de repérage et tracé)" },
        { value: 'Coordination motrice fine', label: "Atteinte motrice fine des membres supérieurs" }
      ]},
      { id: 'alternatives', label: "Alternative(s) disponible(s)", type: 'select', options: [
        { value: 'Numérique (ordinateur / tablette)', label: "Ordinateur / Tablette en classe" },
        { value: 'Secrétaire / AESH', label: "Secrétaire / AESH pour la dictée" },
        { value: 'Papier adapté', label: "Papier adapté pré-rempli avec lignage et cases" }
      ]},
      { id: 'adaptations', label: "Adaptations souhaitées", type: 'text', placeholder: "Ex : Formats cochants, textes à trous, figures pré-tracées" },
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. aucun tracé géométrique à main levée..." }
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
      { id: 'sourceText', label: "Notion ou exercice de mathématiques *", type: 'textarea', placeholder: "Collez l'exercice ou la notion de calcul/géométrie..." },
      { id: 'obstacles', label: "Obstacle(s) principal(aux) visé(s)", type: 'select', options: [
        { value: 'Sens du nombre et passage entre les 3 codes', label: "Sens du nombre et passage entre les 3 codes (Dehaene)" },
        { value: 'Charge de lecture de l’énoncé', label: "Charge de lecture de l'énoncé qui masque le raisonnement" },
        { value: 'Mémoire de travail saturée', label: "Surcharge de la mémoire de travail dans les calculs posés" }
      ]},
      { id: 'leviers', label: "Leviers d'adaptation souhaités", type: 'select', options: [
        { value: 'Manipulation concrète et imagée', label: "Manipulation concrète (réglettes, cubes) puis représentation imagée" },
        { value: 'Procédure pas-à-pas avec verbalisation', label: "Procédure décomposée pas-à-pas avec verbalisation" },
        { value: 'Aides-mémoire réutilisables', label: "Aides-mémoire réutilisables (tables, réglettes, repères)" }
      ]},
      { id: 'profil', label: "Profil de l'élève", type: 'text', placeholder: "Ex : Difficulté à mémoriser les tables, besoin de manipuler" },
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. décomposer la résolution en 4 étapes numérotées..." }
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
      { id: 'sourceText', label: "Support à adapter (texte, énoncé, consigne) *", type: 'textarea', placeholder: "Collez le texte source ou le document de cours..." },
      { id: 'obstacles', label: "Obstacle(s) visé(s)", type: 'select', options: [
        { value: 'Déchiffrage coûteux qui sature la compréhension', label: "Déchiffrage coûteux qui sature la compréhension (Gough & Tunmer)" },
        { value: 'Surcharge visuelle et encombrement', label: "Encombrement visuel et fatigue de lecture" },
        { value: 'Double tâche copie / écoute', label: "Double tâche de copie et d'écoute" }
      ]},
      { id: 'leviers', label: "Leviers retenus", type: 'select', options: [
        { value: 'Aération visuelle et espacement 1.5', label: "Aération visuelle stricte (interligne 1.5, pas de justifié, paragraphes courts)" },
        { value: 'Contournement par canal oral/audio', label: "Contournement par le canal oral / audio / lecture à voix haute" },
        { value: 'Quantité d’écrit allégée', label: "Quantité d'écrit allégée sans baisse de l'exigence conceptuelle" }
      ]},
      { id: 'profil', label: "Profil de l'élève", type: 'text', placeholder: "Ex : Dyslexie phonologique sévère, vitesse de lecture lente" },
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. ne pas pénaliser l'orthographe hors objectif..." }
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
      { id: 'sourceText', label: "Activité ou séance standard à enrichir *", type: 'textarea', placeholder: "Collez l'activité proposée à l'ensemble de la classe..." },
      { id: 'objectif', label: "Objectif d'apprentissage de la classe *", type: 'text', placeholder: "Ex : Comprendre la photosynthèse" },
      { id: 'profil', label: "Profil observé de l'élève", type: 'text', placeholder: "Ex : Termine les exercices en 5 minutes, pose des questions pointues" },
      { id: 'type_enrichissement', label: "Type d'enrichissement souhaité (Renzulli)", type: 'select', options: [
        { value: 'Complexification et abstraction', label: "Complexification et abstraction (cas limites, contraintes supplémentaires)" },
        { value: 'Ouverture et démarche de projet', label: "Ouverture interdisciplinaire et démarche d'investigation" },
        { value: 'Analyse critique supérieure', label: "Analyse critique et questions de niveau Bloom supérieur" }
      ]},
      { id: 'modalites', label: "Modalités retenues", type: 'text', placeholder: "Ex : Travail en autonomie pendant les exercices de la classe" },
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. garde-fou anti double-ration de travail..." }
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
      { id: 'comportements', label: "Comportements observés en classe (faits descriptifs) *", type: 'textarea', placeholder: "Décrivez précisément ce qui se voit et s'entend (situation déclenchante, durée, fréquence)..." },
      { id: 'contexte', label: "Contexte de survenue", type: 'select', options: [
        { value: 'Pendant le travail individuel écrit', label: "Pendant le travail individuel écrit" },
        { value: 'Lors des transitions', label: "Lors des transitions et changements d'activité" },
        { value: 'Pendant les temps d’échange collectif', label: "Pendant les temps d'échange ou de travail collectif" }
      ]},
      { id: 'ressources', label: "Ressources disponibles", type: 'select', options: [
        { value: 'Enseignant seul en classe ordinaire', label: "Enseignant seul en classe ordinaire" },
        { value: 'Avec accompagnement AESH', label: "Avec accompagnement AESH" },
        { value: 'Avec appui du RASED ou enseignant spécialisé', label: "Avec appui du RASED ou enseignant spécialisé" }
      ]},
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. valoriser le renforcement positif plutôt que la sanction..." }
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
      { id: 'phrase', label: "Phrase à mettre en pictogrammes *", type: 'text', placeholder: "Ex : À midi, je mange à la cantine avec mes camarades" },
      { id: 'profil', label: "Profil de communication", type: 'text', placeholder: "Ex : Élève non verbal utilisant un classeur de communication PECS/CAA" },
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. garder le style télégraphique..." }
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
      { id: 'situation', label: "Situation ou lieu de la classe *", type: 'text', placeholder: "Ex : La cantine, la cour de récréation, l'atelier sciences, le cours d'EPS" },
      { id: 'nb_cases', label: "Nombre de cases de la grille", type: 'select', options: [
        { value: '16 cases (Grille 4x4)', label: "16 cases (Grille 4x4 avec vocabulaire noyau + situation)" },
        { value: '12 cases (Grille 3x4)', label: "12 cases (Grille 3x4 allégée)" },
        { value: '20 cases (Grille 4x5)', label: "20 cases (Grille 4x5 étendue)" }
      ]},
      { id: 'profil', label: "Profil de communication", type: 'text', placeholder: "Ex : Élève TSA utilisant un tableau de choix thématique" },
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. inclure impérativement les mots pour exprimer un malaise..." }
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
      { id: 'routine', label: "Routine ou activité à décomposer *", type: 'text', placeholder: "Ex : Se laver les mains / Préparer son matériel de géométrie / Résoudre un problème" },
      { id: 'nb_etapes', label: "Nombre d'étapes souhaité", type: 'select', options: [
        { value: '6 étapes', label: "6 étapes détaillées" },
        { value: '4 étapes', label: "4 étapes simples" },
        { value: '8 étapes', label: "8 micro-étapes exhaustives" }
      ]},
      { id: 'profil', label: "Profil de l'élève", type: 'text', placeholder: "Ex : Élève ayant besoin de repères visuels pour l'autonomie" },
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. formuler chaque verbe à l'infinitif..." }
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
      { id: 'situation', label: "Situation sociale ou imprévu à préparer *", type: 'text', placeholder: "Ex : L'alarme incendie va sonner / Un professeur remplaçant arrive / Sortie scolaire" },
      { id: 'profil', label: "Profil de l'élève", type: 'text', placeholder: "Ex : Élève autiste ayant une grande anxiété face au changement de routine" },
      { id: 'contraintes_additionnelles', label: "Autre consigne à respecter (facultatif)", type: 'text', placeholder: "Ex. terminer par une solution de repli rassurante..." }
    ]
  }
];

DEFAULT_SYSTEM_PROMPTS.studioModulesList = studioModulesList;

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
