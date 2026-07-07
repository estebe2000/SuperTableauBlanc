import { appConfig, PROVIDER_PRESETS, DEFAULT_TOOL_CONFIGS } from './config.js';
import { probeModelsEndpoint, checkActiveProviderStatus } from './api.js';

const TOOLS = [
  { id: 'vision', name: 'Vision AI (Images)', icon: '📸' },
  { id: 'voice', name: 'Voice AI (Transcription)', icon: '🎙️' },
  { id: 'formalizer', name: 'Formalizer (Reformulation)', icon: '💼' },
  { id: 'todo', name: 'Magic ToDo (Tâches)', icon: '🌶️' },
  { id: 'professor', name: 'Professor (CUA)', icon: '💡' },
  { id: 'judge', name: 'Judge AI (Intention & Réponse)', icon: '⚖️' }
];

const DEFAULT_MODELS_CACHE = {
  ollama: ['gemma4:12b'],
  ilaas: ['gemma4:12b'],
  albert: [
    'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
    'openai/whisper-large-v3',
    'openai/gpt-oss-120b',
    'Qwen/Qwen3-Coder-30B-A3B-Instruct',
    'mistralai/Ministral-3-8B-Instruct-2512'
  ],
  localai8080: ['gemma4:12b', 'whisper-1']
};

const DEFAULT_RESOLVED_DATA = {
  ollama: {
    type: 'ollama',
    modelsUrl: 'http://localhost:11434/api/tags',
    chatUrl: 'http://localhost:11434/api/generate'
  },
  ilaas: {
    type: 'openai',
    modelsUrl: 'https://litellm-pp.univ-lehavre.fr/ilaas/v1/models',
    chatUrl: 'https://litellm-pp.univ-lehavre.fr/ilaas/v1/chat/completions'
  },
  albert: {
    type: 'openai',
    modelsUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/models',
    chatUrl: (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1/chat/completions'
  },
  localai8080: {
    type: 'openai',
    modelsUrl: 'http://172.16.87.140:8080/v1/models',
    chatUrl: 'http://172.16.87.140:8080/v1/chat/completions'
  }
};

export function initSettings() {
  const providerOptionsContainer = document.getElementById('providerOptionsContainer');
  const apiEndpointInput = document.getElementById('apiEndpointInput');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const toolConfigList = document.getElementById('toolConfigList');
  const settingsConnectionStatus = document.getElementById('settingsConnectionStatus');

  const addProviderForm = document.getElementById('addProviderForm');
  const customProviderName = document.getElementById('customProviderName');
  const customProviderIcon = document.getElementById('customProviderIcon');
  const customProviderUrl = document.getElementById('customProviderUrl');
  const customProviderKey = document.getElementById('customProviderKey');
  const confirmAddProviderBtn = document.getElementById('confirmAddProviderBtn');
  const cancelAddProviderBtn = document.getElementById('cancelAddProviderBtn');

  if (!providerOptionsContainer || !apiEndpointInput || !apiKeyInput || !saveSettingsBtn || !toolConfigList || !settingsConnectionStatus) {
    console.warn("Settings DOM elements not fully found, skipping initialization.");
    return;
  }

  // Load custom providers
  let customProviders = [];
  try {
    const stored = localStorage.getItem('iacademie_custom_providers');
    if (stored) customProviders = JSON.parse(stored);
  } catch (e) {
    console.error("Error loading custom providers:", e);
  }

  // Load models cache
  let modelsCache = { ...DEFAULT_MODELS_CACHE };
  try {
    const storedCache = localStorage.getItem('iacademie_provider_models_cache');
    if (storedCache) {
      modelsCache = { ...DEFAULT_MODELS_CACHE, ...JSON.parse(storedCache) };
    }
  } catch (e) {
    console.error("Error loading models cache", e);
  }

  // Load resolved endpoints data
  let providerResolvedData = { ...DEFAULT_RESOLVED_DATA };
  try {
    const storedResolved = localStorage.getItem('iacademie_provider_resolved_data');
    if (storedResolved) {
      providerResolvedData = { ...DEFAULT_RESOLVED_DATA, ...JSON.parse(storedResolved) };
    }
  } catch (e) {
    console.error("Error loading resolved provider data", e);
  }

  // Pre-fill endpoints based on current provider card selected
  syncProviderInputs(appConfig.provider);

  function getProviderConfig(providerId) {
    if (PROVIDER_PRESETS[providerId]) {
      return { ...PROVIDER_PRESETS[providerId] };
    }
    return customProviders.find(p => p.id === providerId) || null;
  }

  function syncProviderInputs(providerId) {
    const config = getProviderConfig(providerId);
    if (config) {
      apiEndpointInput.value = config.url;
      apiKeyInput.value = config.apiKey;
    }
  }

  function renderProviders() {
    providerOptionsContainer.innerHTML = '';

    // Render default presets
    Object.entries(PROVIDER_PRESETS).forEach(([key, preset]) => {
      const isPresetActive = appConfig.provider === key;
      const card = document.createElement('label');
      card.className = `provider-card${isPresetActive ? ' active' : ''}`;
      card.setAttribute('data-provider', key);
      
      let icon = '🚀';
      let name = key;
      if (key === 'ollama') { icon = '🤖'; name = 'Ollama local'; }
      else if (key === 'ilaas') { icon = '🚀'; name = 'ILaaS (Univ Havre)'; }
      else if (key === 'albert') { icon = '🇫🇷'; name = 'Albert (Etalab)'; }
      else if (key === 'localai8080') { icon = '💻'; name = 'LocalAI 140:8080'; }

      card.innerHTML = `
        <input type="radio" name="provider-select" value="${key}" ${isPresetActive ? 'checked' : ''} style="display:none;">
        <span class="provider-icon">${icon}</span>
        <span class="provider-name">${name}</span>
      `;

      card.addEventListener('click', () => {
        selectProvider(key);
      });

      providerOptionsContainer.appendChild(card);
    });

    // Render custom providers
    customProviders.forEach(prov => {
      const isCustomActive = appConfig.provider === prov.id;
      const card = document.createElement('label');
      card.className = `provider-card${isCustomActive ? ' active' : ''}`;
      card.setAttribute('data-provider', prov.id);

      card.innerHTML = `
        <input type="radio" name="provider-select" value="${prov.id}" ${isCustomActive ? 'checked' : ''} style="display:none;">
        <button class="delete-provider-btn" title="Supprimer">×</button>
        <span class="provider-icon">${prov.icon || '⚡'}</span>
        <span class="provider-name">${prov.name}</span>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-provider-btn')) {
          e.preventDefault();
          e.stopPropagation();
          deleteCustomProvider(prov.id);
          return;
        }
        selectProvider(prov.id);
      });

      providerOptionsContainer.appendChild(card);
    });

    // Render the Add Provider Card
    const addCard = document.createElement('div');
    addCard.className = 'provider-card add-provider-card';
    addCard.id = 'addProviderCard';
    addCard.style.borderStyle = 'dashed';
    addCard.innerHTML = `
      <span class="provider-icon">➕</span>
      <span class="provider-name">Ajouter...</span>
    `;
    addCard.addEventListener('click', () => {
      addProviderForm.style.display = addProviderForm.style.display === 'none' ? 'block' : 'none';
      if (addProviderForm.style.display === 'block') {
        customProviderName.focus();
      }
    });
    providerOptionsContainer.appendChild(addCard);
  }

  function selectProvider(providerId) {
    addProviderForm.style.display = 'none';

    const cards = providerOptionsContainer.querySelectorAll('.provider-card');
    cards.forEach(c => {
      const pId = c.getAttribute('data-provider');
      if (pId === providerId) {
        c.classList.add('active');
        const radio = c.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      } else {
        c.classList.remove('active');
      }
    });

    appConfig.provider = providerId;
    syncProviderInputs(providerId);

    // Save global active provider card selection
    localStorage.setItem('iacademie_config', JSON.stringify(appConfig));
    checkActiveProviderStatus();
  }

  function deleteCustomProvider(providerId) {
    if (!confirm("Voulez-vous vraiment supprimer ce fournisseur ?")) return;

    customProviders = customProviders.filter(p => p.id !== providerId);
    localStorage.setItem('iacademie_custom_providers', JSON.stringify(customProviders));

    if (appConfig.provider === providerId) {
      appConfig.provider = 'ilaas';
      syncProviderInputs('ilaas');
    }

    // Fallback any tool configurations that used this deleted provider
    Object.keys(DEFAULT_TOOL_CONFIGS).forEach(toolKey => {
      if (appConfig.tools[toolKey] && appConfig.tools[toolKey].provider === providerId) {
        appConfig.tools[toolKey] = { ...DEFAULT_TOOL_CONFIGS[toolKey] };
      }
    });

    localStorage.setItem('iacademie_config', JSON.stringify(appConfig));
    renderProviders();
    renderToolConfigs();
    checkActiveProviderStatus();
  }

  // Render Panel 2: Configuration des Outils
  function renderToolConfigs() {
    toolConfigList.innerHTML = '';

    const allProviders = [
      ...Object.keys(PROVIDER_PRESETS).map(key => ({ id: key, name: getProviderLabel(key) })),
      ...customProviders.map(p => ({ id: p.id, name: p.name }))
    ];

    TOOLS.forEach(tool => {
      const row = document.createElement('div');
      row.className = 'tool-config-row';

      const toolConf = appConfig.tools[tool.id] || { ...DEFAULT_TOOL_CONFIGS[tool.id] };

      // Make sure the provider is still valid, fallback if not
      const providerExists = allProviders.some(p => p.id === toolConf.provider);
      const effectiveProvider = providerExists ? toolConf.provider : allProviders[0]?.id;

      // Tool Label Section
      const infoDiv = document.createElement('div');
      infoDiv.className = 'tool-info';
      infoDiv.innerHTML = `
        <span class="tool-icon">${tool.icon}</span>
        <span class="tool-name">${tool.name}</span>
      `;
      row.appendChild(infoDiv);

      // Selectors Container
      const selectorsDiv = document.createElement('div');
      selectorsDiv.className = 'tool-selectors';

      // 1. Provider select dropdown
      const provSelect = document.createElement('select');
      provSelect.className = 'search-input';
      provSelect.style.height = '38px';
      provSelect.style.fontSize = '0.82rem';
      provSelect.style.borderRadius = '8px';
      provSelect.style.paddingLeft = '8px';

      allProviders.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === effectiveProvider) opt.selected = true;
        provSelect.appendChild(opt);
      });
      selectorsDiv.appendChild(provSelect);

      // 2. Model select dropdown
      const modelSelect = document.createElement('select');
      modelSelect.className = 'search-input';
      modelSelect.style.height = '38px';
      modelSelect.style.fontSize = '0.82rem';
      modelSelect.style.borderRadius = '8px';
      modelSelect.style.paddingLeft = '8px';

      row.appendChild(selectorsDiv);
      toolConfigList.appendChild(row);

      // Function to populate model select options
      function populateModels(providerId, selectedModel) {
        modelSelect.innerHTML = '';
        const models = modelsCache[providerId] || [];
        
        models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          if (m === selectedModel) opt.selected = true;
          modelSelect.appendChild(opt);
        });

        // Fallback option if current selected model is not in the cached list
        if (selectedModel && !models.includes(selectedModel)) {
          const opt = document.createElement('option');
          opt.value = selectedModel;
          opt.textContent = selectedModel + ' (sauvegardé)';
          opt.selected = true;
          modelSelect.appendChild(opt);
        }
      }

      // Initial populate
      populateModels(effectiveProvider, toolConf.model);
      selectorsDiv.appendChild(modelSelect);

      // Listen for Provider change
      provSelect.addEventListener('change', async () => {
        const newProviderId = provSelect.value;
        const newProvConfig = getProviderConfig(newProviderId);
        const resolved = providerResolvedData[newProviderId] || {};
        
        // Auto-select first available model or keep default
        const cachedModels = modelsCache[newProviderId] || [];
        const fallbackModel = cachedModels[0] || (DEFAULT_TOOL_CONFIGS[tool.id]?.provider === newProviderId ? DEFAULT_TOOL_CONFIGS[tool.id].model : 'gemma4:12b');

        populateModels(newProviderId, fallbackModel);

        // Update tool config structure
        appConfig.tools[tool.id] = {
          provider: newProviderId,
          url: newProvConfig ? newProvConfig.url : '',
          apiKey: newProvConfig ? newProvConfig.apiKey : '',
          model: modelSelect.value,
          resolvedType: resolved.type || (newProviderId === 'ollama' ? 'ollama' : 'openai'),
          resolvedModelsUrl: resolved.modelsUrl || '',
          resolvedChatUrl: resolved.chatUrl || ''
        };
        localStorage.setItem('iacademie_config', JSON.stringify(appConfig));

        // Auto background probe to fetch models dynamically
        if (newProvConfig) {
          try {
            const result = await probeModelsEndpoint(newProvConfig.url, newProvConfig.apiKey);
            if (result && result.models.length > 0) {
              modelsCache[newProviderId] = result.models;
              localStorage.setItem('iacademie_provider_models_cache', JSON.stringify(modelsCache));

              providerResolvedData[newProviderId] = {
                type: result.type,
                modelsUrl: result.url,
                chatUrl: result.type === 'ollama' ? 
                  result.url.replace(/\/api\/tags\/?$/, '/api/generate') : 
                  result.url.replace(/\/models\/?$/, '/chat/completions')
              };
              localStorage.setItem('iacademie_provider_resolved_data', JSON.stringify(providerResolvedData));

              // Update this select dropdown options and any others using the same provider
              refreshAllDropdownsForProvider(newProviderId);
            }
          } catch (err) {
            console.warn(`Background models fetch failed for provider ${newProviderId}:`, err);
          }
        }
      });

      // Listen for Model change
      modelSelect.addEventListener('change', () => {
        const currentToolConf = appConfig.tools[tool.id] || {};
        currentToolConf.model = modelSelect.value;
        appConfig.tools[tool.id] = currentToolConf;
        localStorage.setItem('iacademie_config', JSON.stringify(appConfig));
      });
    });
  }

  // Refreshes dropdowns for a specific provider across all tools
  function refreshAllDropdownsForProvider(providerId) {
    const rows = toolConfigList.querySelectorAll('.tool-config-row');
    TOOLS.forEach((tool, idx) => {
      const row = rows[idx];
      if (!row) return;
      const provSelect = row.querySelector('.tool-selectors select:first-child');
      const modelSelect = row.querySelector('.tool-selectors select:last-child');
      
      if (provSelect && modelSelect && provSelect.value === providerId) {
        const currentModel = appConfig.tools[tool.id]?.model;
        modelSelect.innerHTML = '';
        const models = modelsCache[providerId] || [];
        
        models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          if (m === currentModel) opt.selected = true;
          modelSelect.appendChild(opt);
        });

        // Ensure the saved tool config is synced
        if (modelSelect.value && appConfig.tools[tool.id]) {
          appConfig.tools[tool.id].model = modelSelect.value;
          
          const resolved = providerResolvedData[providerId] || {};
          appConfig.tools[tool.id].resolvedType = resolved.type || (providerId === 'ollama' ? 'ollama' : 'openai');
          appConfig.tools[tool.id].resolvedModelsUrl = resolved.modelsUrl || '';
          appConfig.tools[tool.id].resolvedChatUrl = resolved.chatUrl || '';
        }
      }
    });
    localStorage.setItem('iacademie_config', JSON.stringify(appConfig));
  }

  // Button handler: Verify & Save details for the active provider in Panel 1
  saveSettingsBtn.addEventListener('click', async () => {
    const activeCard = document.querySelector('.provider-card.active');
    const providerId = activeCard ? activeCard.getAttribute('data-provider') : 'ilaas';
    const url = apiEndpointInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    saveSettingsBtn.disabled = true;
    saveSettingsBtn.querySelector('.btn-text').textContent = 'Connexion...';
    saveSettingsBtn.querySelector('.btn-loader').style.display = 'block';

    settingsConnectionStatus.className = 'status-box info-box';
    settingsConnectionStatus.innerHTML = '<p>Test de la connexion et récupération des modèles...</p>';

    try {
      const result = await probeModelsEndpoint(url, apiKey);
      const models = result.models;

      // Update provider config in presets or custom provider list
      if (PROVIDER_PRESETS[providerId]) {
        PROVIDER_PRESETS[providerId].url = url;
        PROVIDER_PRESETS[providerId].apiKey = apiKey;
      } else {
        const customProv = customProviders.find(p => p.id === providerId);
        if (customProv) {
          customProv.url = url;
          customProv.apiKey = apiKey;
          localStorage.setItem('iacademie_custom_providers', JSON.stringify(customProviders));
        }
      }

      // Update models cache
      modelsCache[providerId] = models;
      localStorage.setItem('iacademie_provider_models_cache', JSON.stringify(modelsCache));

      // Update resolved endpoints
      providerResolvedData[providerId] = {
        type: result.type,
        modelsUrl: result.url,
        chatUrl: result.type === 'ollama' ? 
          result.url.replace(/\/api\/tags\/?$/, '/api/generate') : 
          result.url.replace(/\/models\/?$/, '/chat/completions')
      };
      localStorage.setItem('iacademie_provider_resolved_data', JSON.stringify(providerResolvedData));

      // Sync the global appConfig matching options for compatibility
      appConfig.url = url;
      appConfig.apiKey = apiKey;
      appConfig.resolvedModelsUrl = result.url;
      appConfig.resolvedType = result.type;
      appConfig.resolvedChatUrl = providerResolvedData[providerId].chatUrl;
      localStorage.setItem('iacademie_config', JSON.stringify(appConfig));

      // Refresh selectors in Panel 2
      refreshAllDropdownsForProvider(providerId);
      renderToolConfigs(); // Full re-render to update inputs

      settingsConnectionStatus.className = 'status-box success-box';
      settingsConnectionStatus.innerHTML = `<p><strong>Connexion réussie !</strong> ${models.length} modèles chargés. La configuration est enregistrée.</p>`;

      checkActiveProviderStatus();
    } catch (err) {
      settingsConnectionStatus.className = 'status-box error-box';
      settingsConnectionStatus.innerHTML = `<p><strong>Échec de la connexion :</strong> ${err.message}. Veuillez vérifier l'URL et la clé API.</p>`;
    } finally {
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.querySelector('.btn-text').textContent = 'Vérifier & Enregistrer';
      saveSettingsBtn.querySelector('.btn-loader').style.display = 'none';
    }
  });

  // Custom provider form confirm
  confirmAddProviderBtn.addEventListener('click', () => {
    const name = customProviderName.value.trim();
    const icon = customProviderIcon.value.trim() || '⚡';
    const url = customProviderUrl.value.trim();
    const key = customProviderKey.value.trim();

    if (!name || !url) {
      alert("Veuillez renseigner au moins le nom et l'URL.");
      return;
    }

    const id = 'custom_' + Date.now();
    const newProv = { id, name, icon, url, apiKey: key };
    
    customProviders.push(newProv);
    localStorage.setItem('iacademie_custom_providers', JSON.stringify(customProviders));

    customProviderName.value = '';
    customProviderIcon.value = '⚡';
    customProviderUrl.value = '';
    customProviderKey.value = '';
    addProviderForm.style.display = 'none';

    renderProviders();
    selectProvider(id);
    renderToolConfigs();
  });

  cancelAddProviderBtn.addEventListener('click', () => {
    customProviderName.value = '';
    customProviderIcon.value = '⚡';
    customProviderUrl.value = '';
    customProviderKey.value = '';
    addProviderForm.style.display = 'none';
  });

  // Helper label mapping
  function getProviderLabel(provider) {
    switch (provider) {
      case 'ollama': return 'Ollama';
      case 'ilaas': return 'ILaaS';
      case 'albert': return 'Albert';
      case 'localai8080': return 'LocalAI 140:8080';
      default: return provider;
    }
  }

  // Initial renders
  renderProviders();
  renderToolConfigs();
}
