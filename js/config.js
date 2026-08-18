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
