export const PROVIDER_PRESETS = {
  ollama: {
    url: 'http://localhost:11434',
    apiKey: '',
    defaultModel: 'gemma4:12b'
  },
  ilaas: {
    url: 'https://litellm-pp.univ-lehavre.fr/ilaas/v1',
    apiKey: '0d1e747a-8dbe-4788-bf9a-c49c23bf1fda',
    defaultModel: 'gemma4:12b'
  },
  albert: {
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1',
    apiKey: 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA',
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
    apiKey: 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA',
    model: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
    resolvedType: 'openai',
    resolvedModelsUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/models',
    resolvedChatUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/chat/completions'
  },
  voice: {
    provider: 'albert',
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1',
    apiKey: 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA',
    model: 'openai/whisper-large-v3',
    resolvedType: 'openai',
    resolvedModelsUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/models',
    resolvedChatUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/chat/completions'
  },
  formalizer: {
    provider: 'albert',
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1',
    apiKey: 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA',
    model: 'openai/gpt-oss-120b',
    resolvedType: 'openai',
    resolvedModelsUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/models',
    resolvedChatUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/chat/completions'
  },
  judge: {
    provider: 'albert',
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1',
    apiKey: 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA',
    model: 'openai/gpt-oss-120b',
    resolvedType: 'openai',
    resolvedModelsUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/models',
    resolvedChatUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/chat/completions'
  },
  todo: {
    provider: 'albert',
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1',
    apiKey: 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA',
    model: 'openai/gpt-oss-120b',
    resolvedType: 'openai',
    resolvedModelsUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/models',
    resolvedChatUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/chat/completions'
  },
  professor: {
    provider: 'albert',
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1',
    apiKey: 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA',
    model: 'openai/gpt-oss-120b',
    resolvedType: 'openai',
    resolvedModelsUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/models',
    resolvedChatUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/chat/completions'
  }
};

export const appConfig = {
  provider: 'ollama',
  url: 'http://localhost:11434',
  apiKey: '',
  model: 'gemma4:12b',
  resolvedModelsUrl: '',
  resolvedChatUrl: '',
  resolvedType: 'ollama',
  tools: { ...DEFAULT_TOOL_CONFIGS }
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
  } catch (e) {
    console.error("Error parsing saved config", e);
  }
}
