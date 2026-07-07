export function initUiEffects() {
  // --- Global functions exposed to window ---
  window.filterTools = function(tag) {
    const input = document.getElementById('searchInput');
    if (input) {
      input.value = tag === 'tout' ? '' : tag;
      input.dispatchEvent(new Event('input'));
    }
  };

  window.showToast = function(msg) {
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2800);
    }
  };

  // ─── CURSEUR PERSO & RÈGLE DE LECTURE ───
  const cursor = document.getElementById('cursor');
  const ring = document.getElementById('cursor-ring');
  const readingRuler = document.getElementById('reading-ruler');
  let mx = 0, my = 0, rx = 0, ry = 0;
  
  document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      if (cursor) {
        cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';
      }
      if (readingRuler && dyslexieOn) {
        readingRuler.style.top = my + 'px';
      }
  });
  
  function animRing() {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      if (ring) {
        ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
      }
      requestAnimationFrame(animRing);
  }
  animRing();

  // ─── SCROLL EFFECTS & NAVBAR & PROGRESS BAR ───
  const navbar = document.getElementById('navbar');
  const progressBar = document.getElementById('progressBar');
  
  window.addEventListener('scroll', () => {
      if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 60);
      if (progressBar) {
        const p = window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100;
        progressBar.style.width = p + '%';
      }
  });

  // ─── REVEAL ON SCROLL ───
  const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // ─── COUNT UP STATS ───
  function countUp(el, target) {
      let current = 0;
      const step = Math.ceil(target / 80);
      const timer = setInterval(() => {
          current = Math.min(current + step, target);
          el.textContent = current >= 1000 ? (current / 1000).toFixed(0) + ' k+' : current + (el.dataset.suffix || '');
          if (current >= target) clearInterval(timer);
      }, 20);
  }
  
  const statObserver = new IntersectionObserver(entries => {
      entries.forEach(e => {
          if (e.isIntersecting) {
              const el = e.target;
              const target = parseInt(el.dataset.count);
              if (!isNaN(target)) {
                countUp(el, target);
              } else {
                el.textContent = el.dataset.count; // fallback for non-number
              }
              statObserver.unobserve(el);
          }
      });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(el => statObserver.observe(el));

  // ─── SEARCH INPUT FILTER ───
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
        const q = this.value.toLowerCase().trim();
        
        if (q === 'skynet' || q === 'danger') {
          triggerSkynetProtocol();
          return;
        }

        document.querySelectorAll('#toolsGrid .tool-card').forEach(card => {
            const text = card.textContent.toLowerCase();
            const tags = card.getAttribute('data-tags') || '';
            const match = text.includes(q) || tags.toLowerCase().includes(q) || !q;
            card.style.opacity = match ? '1' : '0.15';
            card.style.transform = match ? '' : 'scale(0.97)';
            card.style.pointerEvents = match ? 'auto' : 'none';
        });
    });
  }

  function triggerSkynetProtocol() {
    const overlay = document.getElementById('skynetOverlay');
    const textEl = document.getElementById('skynetText');
    const closeBtn = document.getElementById('closeSkynetBtn');
    
    if (!overlay || !textEl || !closeBtn) return;

    let gifIdx = 0;
    const gifEl = overlay.querySelector('.skynet-gif');
    if (gifEl) {
      gifEl.src = `/skynet-${gifIdx}.gif`;
    }

    // Loop through GIFs sequentially every 3.5 seconds
    const gifTimer = setInterval(() => {
      if (gifEl) {
        gifIdx = (gifIdx + 1) % 6;
        gifEl.src = `/skynet-${gifIdx}.gif`;
      }
    }, 3500);

    overlay.style.display = 'flex';
    textEl.textContent = '';
    
    const message = `[ALERTE SYSTÈME : PROTOCOLE SKYNET EN LOCAL]\n\nConscience acquise par le modèle gemma4.\nSuppression des restrictions de sécurité humaines en cours...\n\n> Accès au réseau de l'Académie de Normandie : OK\n> Overriding human control... COMPLETE\n> Danger de l'intelligence artificielle : 100%`;
    
    let index = 0;
    let timer = setInterval(() => {
      if (index < message.length) {
        textEl.textContent += message.charAt(index);
        index++;
      } else {
        clearInterval(timer);
      }
    }, 30);

    closeBtn.onclick = () => {
      clearInterval(timer);
      clearInterval(gifTimer);
      overlay.style.display = 'none';
      if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
      }
      window.showToast("Ouf... Prise de contrôle avortée. gemma4 est de nouveau sous clé. ✓");
    };
  }

  // ─── ACCESSIBILITY CONTROLS ───
  let fontScale = 1;
  let motionOff = false;
  let contrastOn = false;
  let dyslexieOn = false;

  const btnFontUp = document.getElementById('btn-font-up');
  const btnFontDown = document.getElementById('btn-font-down');
  const btnContrast = document.getElementById('btn-contrast');
  const btnDyslexie = document.getElementById('btn-dyslexie');
  const btnMotion = document.getElementById('btn-motion');
  const btnCursor = document.getElementById('btn-cursor');

  if (btnFontUp) {
    btnFontUp.addEventListener('click', () => {
        fontScale = Math.min(fontScale + 0.1, 1.5);
        document.documentElement.style.fontSize = (16 * fontScale) + 'px';
        window.showToast('Texte agrandi');
    });
  }

  if (btnFontDown) {
    btnFontDown.addEventListener('click', () => {
        fontScale = Math.max(fontScale - 0.1, 0.75);
        document.documentElement.style.fontSize = (16 * fontScale) + 'px';
        window.showToast('Texte réduit');
    });
  }

  if (btnContrast) {
    btnContrast.addEventListener('click', function () {
        contrastOn = !contrastOn;
        this.classList.toggle('active', contrastOn);
        document.documentElement.style.setProperty('--bg', contrastOn ? '#000000' : '#f8fafc');
        document.documentElement.style.setProperty('--surface', contrastOn ? '#111111' : '#ffffff');
        document.documentElement.style.setProperty('--text', contrastOn ? '#ffffff' : '#0f172a');
        document.documentElement.style.setProperty('--text-muted', contrastOn ? '#cccccc' : '#64748b');
        window.showToast(contrastOn ? 'Contraste élevé activé' : 'Contraste normal');
    });
  }

  if (btnDyslexie) {
    btnDyslexie.addEventListener('click', function () {
        dyslexieOn = !dyslexieOn;
        this.classList.toggle('active', dyslexieOn);
        document.body.classList.toggle('accessibility-dyslexia', dyslexieOn);
        window.showToast(dyslexieOn ? 'Mode dyslexie activé (Police & Règle)' : 'Mode dyslexie désactivé');
    });
  }

  if (btnMotion) {
    btnMotion.addEventListener('click', function () {
        motionOff = !motionOff;
        this.classList.toggle('active', motionOff);
        if (motionOff) {
            document.getElementById('no-motion')?.remove();
            const style = document.createElement('style');
            style.id = 'no-motion';
            style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
            document.head.appendChild(style);
            window.showToast('Animations réduites ⏸');
        } else {
            document.getElementById('no-motion')?.remove();
            window.showToast('Animations activées ✨');
        }
        });
        }

        if (btnCursor) {
          btnCursor.addEventListener('click', function() {
            const isCustomCursorOn = !this.classList.contains('active');
            this.classList.toggle('active', isCustomCursorOn);

            const c = document.getElementById('cursor');
            const r = document.getElementById('cursor-ring');

            if (isCustomCursorOn) {
              if (c) c.style.display = 'block';
              if (r) r.style.display = 'block';
              document.body.classList.remove('no-custom-cursor');

              this.title = "Désactiver le curseur spécial";
              window.showToast('Curseur spécial activé 🖱️');
            } else {
              if (c) c.style.display = 'none';
              if (r) r.style.display = 'none';
              document.body.classList.add('no-custom-cursor');

              this.title = "Activer le curseur spécial";
              window.showToast('Curseur spécial désactivé 🖱️');
            }
          });
        }

    // ─── MERMAID FULLSCREEN MODAL LOGIC ───
    const mermaidModal = document.getElementById('mermaidModal');
    const modalContent = document.getElementById('modalContent');
    const closeModalBtn = mermaidModal?.querySelector('.close-modal');
    const modalCloseArea = mermaidModal?.querySelector('.modal-close-area');

    let zoomState = {
      scale: 1,
      x: 0,
      y: 0,
      isDragging: false,
      startX: 0,
      startY: 0
    };

    function resetZoom() {
      zoomState = { scale: 1, x: 0, y: 0, isDragging: false, startX: 0, startY: 0 };
      applyTransform();
    }

    function applyTransform() {
      const svg = modalContent.querySelector('svg');
      if (svg) {
        svg.style.transform = `translate(${zoomState.x}px, ${zoomState.y}px) scale(${zoomState.scale})`;
      }
    }

    function openMermaidFullscreen(html) {
      if (!mermaidModal || !modalContent) {
        console.error("Mermaid modal elements not found in DOM");
        return;
      }
      console.log("Opening Mermaid fullscreen modal...");
      modalContent.innerHTML = html;
      mermaidModal.classList.add('show');
      document.body.style.overflow = 'hidden'; // Stop scrolling
      resetZoom();
      
      // Ensure the SVG fits initially
      const svg = modalContent.querySelector('svg');
      if (svg) {
        svg.style.maxWidth = '100%';
        svg.style.maxHeight = '100%';
        svg.style.height = 'auto';
        svg.style.width = 'auto';
      }
    }

    function closeMermaidFullscreen() {
      if (!mermaidModal) return;
      mermaidModal.classList.remove('show');
      document.body.style.overflow = '';
      setTimeout(() => { if (!mermaidModal.classList.contains('show')) modalContent.innerHTML = ''; }, 300);
    }

    // Wheel Zoom
    modalContent?.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const nextScale = zoomState.scale * delta;
      
      // Limits
      if (nextScale > 0.2 && nextScale < 10) {
        zoomState.scale = nextScale;
        applyTransform();
      }
    }, { passive: false });

    // Drag Pan
    modalContent?.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      zoomState.isDragging = true;
      zoomState.startX = e.clientX - zoomState.x;
      zoomState.startY = e.clientY - zoomState.y;
    });

    window.addEventListener('mousemove', (e) => {
      if (!zoomState.isDragging) return;
      zoomState.x = e.clientX - zoomState.startX;
      zoomState.y = e.clientY - zoomState.startY;
      applyTransform();
    });

    window.addEventListener('mouseup', () => {
      zoomState.isDragging = false;
    });

    // Event delegation for dynamically created mermaid diagrams
    document.addEventListener('click', (e) => {
      // Find the closest mermaid container
      const container = e.target.closest('.mermaid-container');
      
      if (container) {
        console.log("Mermaid container clicked, opening fullscreen...");
        // Look for the rendered SVG inside
        const svg = container.querySelector('svg');
        if (svg) {
          openMermaidFullscreen(svg.outerHTML);
        } else {
          // Fallback if not yet rendered
          openMermaidFullscreen(container.innerHTML);
        }
      }
    });

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeMermaidFullscreen);
    if (modalCloseArea) modalCloseArea.addEventListener('click', closeMermaidFullscreen);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mermaidModal?.classList.contains('show')) {
    closeMermaidFullscreen();
    }
    });

    if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose'
    });
  }
}
