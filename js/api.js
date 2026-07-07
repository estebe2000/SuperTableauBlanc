import { appConfig } from './config.js';

// Helper to handle API Streaming Requests
export async function makeStreamingRequest(prompt, options = {}, onChunk, onComplete, onError) {
  let provider = options.provider;
  let url = options.url;
  let apiKey = options.apiKey;
  let model = options.model;
  let resolvedType = options.resolvedType;
  let chatUrl = options.resolvedChatUrl;

  if (options.tool && appConfig.tools && appConfig.tools[options.tool]) {
    const tConf = appConfig.tools[options.tool];
    provider = provider || tConf.provider;
    url = url || tConf.url;
    apiKey = apiKey !== undefined ? apiKey : tConf.apiKey;
    model = model || tConf.model;
    resolvedType = resolvedType || tConf.resolvedType;
    chatUrl = chatUrl || tConf.resolvedChatUrl;
  }

  // Fallback to global config
  provider = provider || appConfig.provider;
  url = url || appConfig.url;
  apiKey = apiKey !== undefined ? apiKey : appConfig.apiKey;
  model = model || appConfig.model;
  resolvedType = resolvedType || appConfig.resolvedType || (provider === 'ollama' ? 'ollama' : 'openai');

  if (!chatUrl) {
    chatUrl = (options.url || (options.tool && appConfig.tools[options.tool] && !appConfig.tools[options.tool].resolvedChatUrl) || !appConfig.resolvedChatUrl) ? 
      (resolvedType === 'ollama' ? `${url.replace(/\/+$/, '')}/api/generate` : `${url.replace(/\/+$/, '')}/chat/completions`) : 
      (options.tool && appConfig.tools[options.tool] && appConfig.tools[options.tool].resolvedChatUrl) || appConfig.resolvedChatUrl;
  }

  // Detect Whisper model
  const isWhisper = model.toLowerCase().includes('whisper');
  if (isWhisper && resolvedType === 'openai') {
    try {
      const transcriptionUrl = `${url.replace(/\/+$/, '')}/audio/transcriptions`;
      const headers = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const formData = new FormData();
      formData.append('model', model);
      formData.append('response_format', 'verbose_json');
      
      let base64Audio = '';
      if (options.images && options.images.length > 0) {
        const img = options.images[0];
        base64Audio = img.includes('base64,') ? img.split('base64,')[1] : img;
      }
      
      if (!base64Audio) {
        throw new Error("Aucun fichier audio n'a été fourni pour Whisper.");
      }
      
      const byteCharacters = atob(base64Audio);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mp3' });
      
      formData.append('file', blob, 'audio.mp3');
      
      const response = await fetch(transcriptionUrl, {
        method: 'POST',
        headers: headers,
        body: formData
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      let transcription = '';
      if (data.segments && Array.isArray(data.segments)) {
        transcription = data.segments.map(seg => {
          let seconds = seg.start;
          if (seg.start > 100000) {
            seconds = seg.start / 1e9;
          }
          const mins = Math.floor(seconds / 60);
          const secs = Math.floor(seconds % 60);
          const timeStr = `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
          return `${timeStr} ${seg.text.trim()}`;
        }).join('\n');
      } else {
        transcription = data.text || '';
      }
      
      onChunk(transcription, transcription);
      onComplete(transcription);
      return;
    } catch (err) {
      onError(err);
      return;
    }
  }

  try {
    let response;
    
    if (resolvedType === 'ollama') {
      const body = {
        model: model,
        prompt: prompt,
        stream: true,
        options: {
          temperature: 0.0,
          num_ctx: 8192,
          ...(options.options || {})
        },
        ...options
      };
      delete body.options.options;

      // For Ollama, multimodal data (images OR audio) must be sent in the 'images' array.
      if (options.images && options.images.length > 0) {
        body.images = options.images.map(img => {
          if (img.includes('base64,')) {
            return img.split('base64,')[1];
          }
          return img;
        });
      }

      response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });
    } else {
      // OpenAI-compatible
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const messages = [];
      if (options.images && options.images.length > 0) {
        const content = [
          { type: 'text', text: prompt }
        ];

        const isAudio = options.tool === 'voice';

        options.images.forEach(img => {
          if (isAudio) {
            const rawBase64 = img.includes('base64,') ? img.split('base64,')[1] : img;
            let format = 'mp3';
            if (img.startsWith('data:audio/')) {
              const mime = img.split(';')[0].split(':')[1];
              format = mime.split('/')[1] || 'mp3';
            }
            content.push({
              type: 'input_audio',
              input_audio: {
                data: rawBase64,
                format: format
              }
            });
          } else {
            let dataUrl = img;
            if (!img.startsWith('data:')) {
              dataUrl = 'data:image/jpeg;base64,' + img;
            }
            content.push({
              type: 'image_url',
              image_url: {
                url: dataUrl
              }
            });
          }
        });
        messages.push({ role: 'user', content: content });
      } else {
        messages.push({ role: 'user', content: prompt });
      }
      
      const body = {
        model: model,
        messages: messages,
        stream: true,
        temperature: 0.0,
        ...options
      };
      delete body.images;

      response = await fetch(chatUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `Erreur HTTP: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let partialLine = '';
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = (partialLine + chunk).split('\n');
      partialLine = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '') continue;

        if (resolvedType === 'ollama') {
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed.response) {
              accumulatedText += parsed.response;
              onChunk(parsed.response, accumulatedText);
            }
          } catch (e) {
            console.warn('Line parse error:', e, trimmed);
          }
        } else {
          // OpenAI SSE parsing
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                accumulatedText += delta;
                onChunk(delta, accumulatedText);
              }
            } catch (e) {
              console.warn('SSE Line parse error:', e, dataStr);
            }
          }
        }
      }
    }

    if (partialLine.trim() !== '') {
      const trimmed = partialLine.trim();
      if (resolvedType === 'ollama') {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.response) {
            accumulatedText += parsed.response;
            onChunk(parsed.response, accumulatedText);
          }
        } catch (e) {}
      } else {
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim();
          if (dataStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                accumulatedText += delta;
                onChunk(delta, accumulatedText);
              }
            } catch (e) {}
          }
        }
      }
    }

    onComplete(accumulatedText);
  } catch (error) {
    onError(error);
  }
}

// Helper for non-streaming requests
export async function makeNonStreamingRequest(prompt, options = {}) {
  let provider = options.provider;
  let url = options.url;
  let apiKey = options.apiKey;
  let model = options.model;
  let resolvedType = options.resolvedType;
  let chatUrl = options.resolvedChatUrl;

  if (options.tool && appConfig.tools && appConfig.tools[options.tool]) {
    const tConf = appConfig.tools[options.tool];
    provider = provider || tConf.provider;
    url = url || tConf.url;
    apiKey = apiKey !== undefined ? apiKey : tConf.apiKey;
    model = model || tConf.model;
    resolvedType = resolvedType || tConf.resolvedType;
    chatUrl = chatUrl || tConf.resolvedChatUrl;
  }

  // Fallback to global config
  provider = provider || appConfig.provider;
  url = url || appConfig.url;
  apiKey = apiKey !== undefined ? apiKey : appConfig.apiKey;
  model = model || appConfig.model;
  resolvedType = resolvedType || appConfig.resolvedType || (provider === 'ollama' ? 'ollama' : 'openai');

  if (!chatUrl) {
    chatUrl = (options.url || (options.tool && appConfig.tools[options.tool] && !appConfig.tools[options.tool].resolvedChatUrl) || !appConfig.resolvedChatUrl) ? 
      (resolvedType === 'ollama' ? `${url.replace(/\/+$/, '')}/api/generate` : `${url.replace(/\/+$/, '')}/chat/completions`) : 
      (options.tool && appConfig.tools[options.tool] && appConfig.tools[options.tool].resolvedChatUrl) || appConfig.resolvedChatUrl;
  }

  if (resolvedType === 'ollama') {
    const body = {
      model: model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.0,
        num_ctx: 8192,
        ...(options.options || {})
      },
      ...options
    };
    delete body.options.options;

    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `Erreur HTTP: ${response.status}`);
    }
    const data = await response.json();
    return data.response;
  } else {
    // OpenAI-compatible
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        temperature: 0.0,
        ...options
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `Erreur HTTP: ${response.status}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

// Markdown Formatter helper
export function formatMarkdown(element, rawText) {
  if (!rawText) {
    element.innerHTML = '';
    return;
  }

  console.log("formatMarkdown rawText:", rawText);

  // Parse markdown to HTML using marked (if loaded, otherwise fallback to text)
  let html = window.marked ? window.marked.parse(rawText) : rawText;

  console.log("formatMarkdown html before postprocess:", html);

  // Post-process to support mermaid blocks:
  // Convert <pre><code class="language-mermaid">...</code></pre> to <pre class="mermaid">...</pre>
  if (html.includes('class="language-mermaid"') || html.includes('class="mermaid"')) {
    html = html.replace(/<pre><code class="(?:language-)?mermaid">([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
      // Decode HTML entities in code (e.g. &gt; back to >) so mermaid parser receives clean code
      let decodedCode = code
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
        
      // Safety: remove redundant 'mermaid' keyword if LLM added it inside the block
      if (decodedCode.startsWith('mermaid')) {
        decodedCode = decodedCode.replace(/^mermaid\s+/, '').trim();
      }
      
      return `<div class="mermaid-container"><pre class="mermaid">${decodedCode}</pre></div>`;
    });
  }

  element.innerHTML = html;
}

export function parseProbedModels(data, type) {
  let modelsList = [];
  if (type === 'openai') {
    if (data && Array.isArray(data.data)) {
      modelsList = data.data.flatMap(m => {
        const ids = [];
        if (m.id) ids.push(m.id);
        if (m.name && m.name !== m.id) ids.push(m.name);
        if (Array.isArray(m.aliases)) {
          m.aliases.forEach(a => { if (!ids.includes(a)) ids.push(a); });
        }
        return ids;
      });
    } else if (data && Array.isArray(data)) {
      modelsList = data.map(m => m.id || m.name || m);
    } else if (data && typeof data === 'object') {
      const keys = Object.keys(data);
      for (const k of keys) {
        if (Array.isArray(data[k])) {
          modelsList = data[k].map(m => m.id || m.name || (typeof m === 'string' ? m : null)).filter(Boolean);
          if (modelsList.length > 0) break;
        }
      }
    }
  } else if (type === 'ollama') {
    if (data && Array.isArray(data.models)) {
      modelsList = data.models.map(m => m.name);
    }
  }
  return [...new Set(modelsList)].filter(Boolean);
}

export async function probeModelsEndpoint(baseUrl, apiKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const cleanBase = baseUrl.replace(/\/+$/, '');
  const candidates = [];

  // 1. Ollama /api/tags (PRIORITY)
  candidates.push({
    url: `${cleanBase}/api/tags`,
    type: 'ollama'
  });

  // 2. Standard OpenAI /models relative to baseUrl
  candidates.push({
    url: `${cleanBase}/models`,
    type: 'openai'
  });

  // 3. If base ends with /v1, try root /models, otherwise try appending /v1/models
  if (cleanBase.endsWith('/v1')) {
    candidates.push({
      url: `${cleanBase.slice(0, -3)}/models`,
      type: 'openai'
    });
  } else {
    candidates.push({
      url: `${cleanBase}/v1/models`,
      type: 'openai'
    });
  }

  // 4. /api/v1/models
  candidates.push({
    url: `${cleanBase}/api/v1/models`,
    type: 'openai'
  });

  // 5. /api/models
  candidates.push({
    url: `${cleanBase}/api/models`,
    type: 'openai'
  });

  let lastError = null;

  for (const candidate of candidates) {
    try {
      console.log(`Probing endpoint candidate: ${candidate.url} (${candidate.type})`);
      const response = await fetch(candidate.url, {
        method: 'GET',
        headers: headers
      });

      if (response.ok) {
        const data = await response.json();
        const modelsList = parseProbedModels(data, candidate.type);

        if (modelsList.length > 0) {
          console.log(`Successfully probed endpoint: ${candidate.url}`);
          return {
            url: candidate.url,
            type: candidate.type,
            models: modelsList
          };
        }
      } else {
        const errText = await response.text();
        console.warn(`Candidate ${candidate.url} returned ${response.status}: ${errText}`);
      }
    } catch (err) {
      console.warn(`Probe failed for candidate: ${candidate.url}`, err);
      lastError = err;
    }
  }

  if (lastError && lastError.name === 'TypeError' && lastError.message === 'Failed to fetch') {
    throw new Error("Erreur de connexion ou de CORS. Le serveur distant (comme Albert) bloque peut-être les requêtes depuis votre navigateur.");
  }

  throw new Error(lastError ? lastError.message : "Aucun endpoint de modèles valide n'a été détecté.");
}

export async function checkActiveProviderStatus() {
  const serverStatus = document.getElementById('serverStatus');
  const provider = appConfig.provider;
  const url = appConfig.url;
  const apiKey = appConfig.apiKey;
  const model = appConfig.model;
  
  if (!serverStatus) return;
  
  serverStatus.className = 'status-badge checking';
  serverStatus.innerHTML = `
    <span class="status-dot"></span>
    <span class="status-text">Vérification ${getProviderLabel(provider)}...</span>
  `;
  
  try {
    let success = false;
    let availableModels = [];
    
    if (appConfig.resolvedModelsUrl && appConfig.resolvedType) {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey && appConfig.resolvedType === 'openai') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      const response = await fetch(appConfig.resolvedModelsUrl, { headers });
      if (response.ok) {
        const data = await response.json();
        availableModels = parseProbedModels(data, appConfig.resolvedType);
        success = true;
      }
    } else {
      const result = await probeModelsEndpoint(url, apiKey);
      if (result) {
        availableModels = result.models;
        success = true;
        
        appConfig.resolvedModelsUrl = result.url;
        appConfig.resolvedType = result.type;
        appConfig.resolvedChatUrl = result.type === 'ollama' ? 
          result.url.replace(/\/api\/tags\/?$/, '/api/generate') : 
          result.url.replace(/\/models\/?$/, '/chat/completions');
      }
    }
    
    if (success) {
      const hasModel = availableModels.some(m => m === model || m.startsWith(model + ':') || model.startsWith(m + ':'));
      
      if (hasModel || availableModels.length > 0) {
        serverStatus.className = 'status-badge connected';
        serverStatus.innerHTML = `
          <span class="status-dot"></span>
          <span class="status-text">${getProviderLabel(provider)} : Connecté</span>
        `;
      } else {
        serverStatus.className = 'status-badge disconnected';
        serverStatus.innerHTML = `
          <span class="status-dot"></span>
          <span class="status-text">Modèle absent</span>
        `;
      }
    } else {
      setDisconnectedStatus(provider);
    }
  } catch (error) {
    console.error("Error checking status:", error);
    setDisconnectedStatus(provider);
  }
}

export function getProviderLabel(provider) {
  switch (provider) {
    case 'ollama': return 'Ollama';
    case 'ilaas': return 'ILaaS';
    case 'albert': return 'Albert';
    case 'localai8080': return 'LocalAI 140:8080';
    default: return provider;
  }
}

function setDisconnectedStatus(provider) {
  const serverStatus = document.getElementById('serverStatus');
  if (!serverStatus) return;
  serverStatus.className = 'status-badge disconnected';
  serverStatus.innerHTML = `
    <span class="status-dot"></span>
    <span class="status-text">${getProviderLabel(provider)} : Hors ligne</span>
  `;
}
