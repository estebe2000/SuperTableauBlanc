import { makeStreamingRequest, formatMarkdown } from './api.js';
import { appConfig } from './config.js';

export function initVision() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const dropZoneContent = document.getElementById('dropZoneContent');
  const previewContainer = document.getElementById('previewContainer');
  const imagePreview = document.getElementById('imagePreview');
  const changeImageBtn = document.getElementById('changeImageBtn');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const promptInput = document.getElementById('promptInput');
  const generateBtn = document.getElementById('generateBtn');
  const copyBtn = document.getElementById('copyBtn');
  const clearBtn = document.getElementById('clearBtn');
  const outputPlaceholder = document.getElementById('outputPlaceholder');
  const skeletonLoader = document.getElementById('skeletonLoader');
  const outputText = document.getElementById('outputText');

  if (!dropZone || !fileInput || !generateBtn) {
    console.warn("Vision AI DOM elements not found, skipping.");
    return;
  }

  let base64Image = null;

  dropZone.addEventListener('click', (e) => {
    if (e.target !== changeImageBtn && !changeImageBtn.contains(e.target)) fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
  });

  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
  });

  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
  });

  window.addEventListener('paste', (e) => {
    const activeTab = document.querySelector('.tab-content.active');
    if(activeTab && activeTab.id !== 'tab-vision') return; // Only paste in vision if active
    
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
      if (items[index].kind === 'file' && items[index].type.startsWith('image/')) {
        handleFile(items[index].getAsFile());
        break;
      }
    }
  });

  changeImageBtn.addEventListener('click', (e) => {
    e.stopPropagation(); resetImage();
  });

  function handleFile(file) {
    if (!file.type.startsWith('image/')) { alert('Fichier image invalide.'); return; }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      imagePreview.src = reader.result;
      base64Image = reader.result.split(',')[1];
      dropZoneContent.style.display = 'none';
      previewContainer.style.display = 'block';
      generateBtn.disabled = false;
    };
  }

  function resetImage() {
    base64Image = null; imagePreview.src = '';
    previewContainer.style.display = 'none'; dropZoneContent.style.display = 'flex';
    fileInput.value = ''; generateBtn.disabled = true;
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      promptInput.value = btn.getAttribute('data-prompt');
    });
  });

  generateBtn.addEventListener('click', () => {
    if (!base64Image) return;
    const promptText = promptInput.value.trim() || "Décris cette image.";
    generateBtn.disabled = true;
    generateBtn.querySelector('.btn-text').textContent = 'Génération...';
    generateBtn.querySelector('.btn-loader').style.display = 'block';
    
    outputPlaceholder.style.display = 'none'; skeletonLoader.style.display = 'flex';
    outputText.style.display = 'none'; outputText.textContent = '';
    copyBtn.disabled = true; clearBtn.disabled = true;

    const requestOptions = {
      tool: 'vision',
      images: [base64Image]
    };

    // Select the best model for images by default if the active provider is text-only (like ILaaS)
    // or if Albert is selected but the active model is not vision-capable.
    const toolConf = (appConfig.tools && appConfig.tools.vision) || {};
    const effectiveProvider = toolConf.provider || appConfig.provider;
    const effectiveModel = toolConf.model || appConfig.model || '';

    if (effectiveProvider === 'ilaas') {
      requestOptions.provider = 'albert';
      requestOptions.url = (typeof window !== 'undefined' ? window.location.origin : '') + '/proxy-albert/v1';
      requestOptions.apiKey = 'sk-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4NTAyLCJ0b2tlbl9pZCI6MTYxNTQsImV4cGlyZXMiOjE4MDQ0NjA0MDB9.GDGvca0HKxkvziUfe6lFh2GbLwymyDJzvdRgRkSEztA';
      requestOptions.model = 'mistralai/Mistral-Small-3.2-24B-Instruct-2506';
      requestOptions.resolvedType = 'openai';
    } else if (effectiveProvider === 'albert' && !effectiveModel.includes('Mistral-Small')) {
      requestOptions.model = 'mistralai/Mistral-Small-3.2-24B-Instruct-2506';
    }

    makeStreamingRequest(
      promptText, requestOptions,
      (chunk, full) => {
        skeletonLoader.style.display = 'none'; outputText.style.display = 'block';
        formatMarkdown(outputText, full);
        const container = outputText.parentElement; container.scrollTop = container.scrollHeight;
      },
      () => {
        copyBtn.disabled = false; clearBtn.disabled = false;
        generateBtn.disabled = false; generateBtn.querySelector('.btn-text').textContent = 'Générer la description';
        generateBtn.querySelector('.btn-loader').style.display = 'none';
        if (window.mermaid) window.mermaid.run().catch(e => {});
      },
      (error) => {
        skeletonLoader.style.display = 'none'; outputText.style.display = 'block';
        outputText.innerHTML = `<span style="color: var(--danger-color); font-weight: 600;">Erreur :</span> ${error.message}`;
        clearBtn.disabled = false; generateBtn.disabled = false;
        generateBtn.querySelector('.btn-text').textContent = 'Générer la description';
        generateBtn.querySelector('.btn-loader').style.display = 'none';
      }
    );
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(outputText.textContent).then(() => {
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--success-color)" stroke-width="2.5" width="18" height="18"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => copyBtn.innerHTML = original, 1500);
    });
  });

  clearBtn.addEventListener('click', () => {
    outputText.textContent = ''; outputText.style.display = 'none';
    skeletonLoader.style.display = 'none'; outputPlaceholder.style.display = 'flex';
    copyBtn.disabled = true; clearBtn.disabled = true;
  });
}
