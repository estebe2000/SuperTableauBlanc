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

  function syncIframeAccessibility() {
    const iframe = document.getElementById('hapiIframe');
    if (!iframe) return;
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc || !iframeDoc.documentElement) return;

      // 1. Font size / Text scale
      iframeDoc.documentElement.style.fontSize = (16 * fontScale) + 'px';

      // 2. High Contrast
      if (contrastOn) {
        iframeDoc.documentElement.style.setProperty('--bg', '#000000');
        iframeDoc.documentElement.style.setProperty('--page-bg', '#000000');
        iframeDoc.documentElement.style.setProperty('--surface', '#111111');
        iframeDoc.documentElement.style.setProperty('--surface-2', '#111111');
        iframeDoc.documentElement.style.setProperty('--text', '#ffffff');
        iframeDoc.documentElement.style.setProperty('--text-muted', '#cccccc');
        iframeDoc.documentElement.style.setProperty('--border', '#333333');
      } else {
        iframeDoc.documentElement.style.removeProperty('--bg');
        iframeDoc.documentElement.style.removeProperty('--page-bg');
        iframeDoc.documentElement.style.removeProperty('--surface');
        iframeDoc.documentElement.style.removeProperty('--surface-2');
        iframeDoc.documentElement.style.removeProperty('--text');
        iframeDoc.documentElement.style.removeProperty('--text-muted');
        iframeDoc.documentElement.style.removeProperty('--border');
      }
      if (iframeDoc.body) {
        iframeDoc.body.classList.toggle('high-contrast-active', contrastOn);
      }

      // 3. Dyslexia Mode (inject styles dynamically if they aren't in HAPI CSS)
      if (iframeDoc.body) {
        iframeDoc.body.classList.toggle('accessibility-dyslexia', dyslexieOn);
      }
      let dyslexiaStyle = iframeDoc.getElementById('accessibility-dyslexia-style');
      if (dyslexieOn) {
        if (!dyslexiaStyle) {
          dyslexiaStyle = iframeDoc.createElement('style');
          dyslexiaStyle.id = 'accessibility-dyslexia-style';
          dyslexiaStyle.textContent = `
            body.accessibility-dyslexia,
            body.accessibility-dyslexia * {
                font-family: 'OpenDyslexic', 'OpenDyslexicRegular', 'Lexend', 'Comic Sans MS', sans-serif !important;
                letter-spacing: 0.12em !important;
                word-spacing: 0.22em !important;
                line-height: 1.9 !important;
                text-align: left !important;
            }
          `;
          iframeDoc.head.appendChild(dyslexiaStyle);
        }
      } else {
        dyslexiaStyle?.remove();
      }

      // 4. Reduced Motion
      let motionStyle = iframeDoc.getElementById('no-motion');
      if (motionOff) {
        if (!motionStyle) {
          motionStyle = iframeDoc.createElement('style');
          motionStyle.id = 'no-motion';
          motionStyle.textContent = `
            *, *::before, *::after {
                animation: none !important;
                transition: none !important;
            }
          `;
          iframeDoc.head.appendChild(motionStyle);
        }
      } else {
        motionStyle?.remove();
      }
    } catch (err) {
      console.warn("Could not synchronize accessibility settings to iframe:", err);
    }
  }

  const hapiIframe = document.getElementById('hapiIframe');
  if (hapiIframe) {
    hapiIframe.addEventListener('load', () => {
      syncIframeAccessibility();

      // Bind mousemove event inside the iframe to keep the custom cursor & reading ruler working inside it
      try {
        const iframeDoc = hapiIframe.contentDocument || hapiIframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.addEventListener('mousemove', e => {
            const rect = hapiIframe.getBoundingClientRect();
            mx = e.clientX + rect.left;
            my = e.clientY + rect.top;
            if (cursor) {
              cursor.style.left = mx + 'px';
              cursor.style.top = my + 'px';
            }
            if (readingRuler && dyslexieOn) {
              readingRuler.style.top = my + 'px';
            }
          });
        }
      } catch (err) {
        console.warn("Could not bind mousemove to HAPI iframe (possible cross-origin):", err);
      }
    });
  }

  if (btnFontUp) {
    btnFontUp.addEventListener('click', () => {
        fontScale = Math.min(fontScale + 0.1, 1.5);
        document.documentElement.style.fontSize = (16 * fontScale) + 'px';
        window.showToast('Texte agrandi');
        syncIframeAccessibility();
    });
  }

  if (btnFontDown) {
    btnFontDown.addEventListener('click', () => {
        fontScale = Math.max(fontScale - 0.1, 0.75);
        document.documentElement.style.fontSize = (16 * fontScale) + 'px';
        window.showToast('Texte réduit');
        syncIframeAccessibility();
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
        syncIframeAccessibility();
    });
  }

  if (btnDyslexie) {
    btnDyslexie.addEventListener('click', function () {
        dyslexieOn = !dyslexieOn;
        this.classList.toggle('active', dyslexieOn);
        document.body.classList.toggle('accessibility-dyslexia', dyslexieOn);
        window.showToast(dyslexieOn ? 'Mode dyslexie activé (Police & Règle)' : 'Mode dyslexie désactivé');
        syncIframeAccessibility();
    });
  }

  if (btnMotion) {
    btnMotion.addEventListener('click', function () {
        motionOff = !motionOff;
        this.classList.toggle('active', motionOff);
        document.body.classList.toggle('no-motion-active', motionOff);
        if (motionOff) {
            document.getElementById('no-motion')?.remove();
            const style = document.createElement('style');
            style.id = 'no-motion';
            style.textContent = `
              *, *::before, *::after {
                  animation: none !important;
                  transition: none !important;
              }
              .hero-neural-canvas,
              .hero-brain-aura,
              .orb-pulse-ring {
                  display: none !important;
              }
              .neuro-orb {
                  animation: none !important;
                  transform: none !important;
              }
            `;
            document.head.appendChild(style);

            // Clear and hide neural canvas
            const canvas = document.getElementById('heroNeuralCanvas');
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            // Reset orbs transforms
            document.querySelectorAll('.neuro-orb').forEach(orb => {
              orb.style.transform = 'none';
            });

            window.showToast('Toutes les animations sont désactivées ⏸');
        } else {
            document.getElementById('no-motion')?.remove();
            document.querySelectorAll('.neuro-orb').forEach(orb => {
              orb.style.transform = '';
            });
            window.showToast('Animations réactivées ✨');
        }
        syncIframeAccessibility();
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

    // ─── NEURAL SYNAPSE CANVAS & BRAIN PARTICLES ───
    function initNeuralCanvas() {
      const canvas = document.getElementById('heroNeuralCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let width = 0, height = 0;
      let particles = [];
      let mouse = { x: null, y: null, radius: 160 };

      const colors = [
        'rgba(139, 92, 246, ',  // Violet / Neuro
        'rgba(245, 158, 11, ',  // Ambre / IA
        'rgba(14, 165, 233, ',  // Cyan / Étude
        'rgba(239, 68, 68, '    // Corail / Cognition
      ];

      function resize() {
        const hero = canvas.parentElement;
        if (!hero) return;
        width = canvas.width = hero.offsetWidth;
        height = canvas.height = hero.offsetHeight;
        createParticles();
      }

      function createParticles() {
        particles = [];
        const count = Math.min(Math.floor((width * height) / 13000), 40);
        for (let i = 0; i < count; i++) {
          const colorBase = colors[Math.floor(Math.random() * colors.length)];
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            radius: Math.random() * 2.2 + 1.4,
            colorBase: colorBase,
            alpha: Math.random() * 0.45 + 0.35,
            pulseSpeed: Math.random() * 0.02 + 0.015,
            pulseAngle: Math.random() * Math.PI * 2
          });
        }
      }

      const heroEl = canvas.parentElement;
      if (heroEl) {
        heroEl.addEventListener('mousemove', (e) => {
          if (motionOff) return;
          const rect = heroEl.getBoundingClientRect();
          mouse.x = e.clientX - rect.left;
          mouse.y = e.clientY - rect.top;

          // Subtle 3D Parallax on cognitive orbs
          const orbs = heroEl.querySelectorAll('.neuro-orb');
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const offsetX = (e.clientX - rect.left - centerX) / centerX;
          const offsetY = (e.clientY - rect.top - centerY) / centerY;

          orbs.forEach(orb => {
            const speed = parseFloat(orb.dataset.speed || '1.0');
            orb.style.transform = `translate(${offsetX * 16 * speed}px, ${offsetY * 12 * speed}px)`;
          });
        });

        heroEl.addEventListener('mouseleave', () => {
          mouse.x = null;
          mouse.y = null;
          const orbs = heroEl.querySelectorAll('.neuro-orb');
          orbs.forEach(orb => {
            orb.style.transform = '';
          });
        });
      }

      window.addEventListener('resize', resize);
      resize();

      function render() {
        if (motionOff) {
          ctx.clearRect(0, 0, width, height);
          requestAnimationFrame(render);
          return;
        }

        ctx.clearRect(0, 0, width, height);

        // Draw synaptic connections
        for (let i = 0; i < particles.length; i++) {
          const p1 = particles[i];
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 130) {
              const lineAlpha = (1 - dist / 130) * 0.26;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `rgba(148, 163, 184, ${lineAlpha})`;
              ctx.lineWidth = 0.85;
              ctx.stroke();
            }
          }

          // Interactive mouse synapse connection
          if (mouse.x !== null && mouse.y !== null) {
            const dx = p1.x - mouse.x;
            const dy = p1.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < mouse.radius) {
              const lineAlpha = (1 - dist / mouse.radius) * 0.45;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(mouse.x, mouse.y);
              ctx.strokeStyle = `rgba(124, 58, 237, ${lineAlpha})`;
              ctx.lineWidth = 1.2;
              ctx.stroke();
            }
          }
        }

        // Update and draw neural nodes
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;

          p.pulseAngle += p.pulseSpeed;
          const currentRadius = p.radius + Math.sin(p.pulseAngle) * 0.6;
          const currentAlpha = p.alpha + Math.sin(p.pulseAngle) * 0.2;

          // Glowing outer halo
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentRadius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `${p.colorBase}${currentAlpha * 0.28})`;
          ctx.fill();

          // Core neuron node
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
          ctx.fillStyle = `${p.colorBase}${currentAlpha})`;
          ctx.fill();
        });

        requestAnimationFrame(render);
      }

      render();
    }

    initNeuralCanvas();
}
