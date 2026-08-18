import { checkActiveProviderStatus, makeNonStreamingRequest, getProviderLabel } from './js/api.js';
import { appConfig } from './js/config.js';
import { initNavigation } from './js/navigation.js';
import { initVision } from './js/tool-vision.js';
import { initTodo } from './js/tool-todo.js';
import { initFormalizer } from './js/tool-formalizer.js';
import { initJudge } from './js/tool-judge.js';
import { initVoice } from './js/tool-voice.js';
import { initProfessor } from './js/tool-professor.js';
import { initProfessorPlus } from './js/tool-professor-plus.js';
import { initUiEffects } from './js/ui-effects.js';
import { initSettings } from './js/settings.js';

// Import new features
import { initBureau } from './js/tool-bureau.js';
import { initStudent } from './js/tool-student.js';
import { initProfiling } from './js/tool-profiling.js';
import { initMic } from './js/tool-mic.js';

// Import HTML templates as raw strings via Vite
import homeHtml from './templates/home.html?raw';
import visionHtml from './templates/vision.html?raw';
import todoHtml from './templates/todo.html?raw';
import formalizerHtml from './templates/formalizer.html?raw';
import judgeHtml from './templates/judge.html?raw';
import voiceHtml from './templates/voice.html?raw';
import professorHtml from './templates/professor.html?raw';
import professorPlusHtml from './templates/professor-plus.html?raw';
import hapiHtml from './templates/hapi.html?raw';
import settingsHtml from './templates/settings.html?raw';
import aboutHtml from './templates/about.html?raw';
import accessibilityHtml from './templates/accessibility.html?raw';
import rgpdHtml from './templates/rgpd.html?raw';

// New templates
import bureauHtml from './templates/bureau.html?raw';
import studentHtml from './templates/student.html?raw';
import profilingHtml from './templates/profiling.html?raw';
import micHtml from './templates/mic.html?raw';

// Expose checks globally
window.checkOllamaStatus = checkActiveProviderStatus;
window.checkActiveProviderStatus = checkActiveProviderStatus;
window.makeNonStreamingRequest = makeNonStreamingRequest;

// Initialize all features on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  // 1. Inject HTML templates into the DOM
  document.getElementById('tab-home').innerHTML = homeHtml;
  document.getElementById('tab-vision').innerHTML = visionHtml;
  document.getElementById('tab-todo').innerHTML = todoHtml;
  document.getElementById('tab-formalizer').innerHTML = formalizerHtml;
  document.getElementById('tab-judge').innerHTML = judgeHtml;
  document.getElementById('tab-audio').innerHTML = voiceHtml;
  document.getElementById('tab-professor').innerHTML = professorHtml;
  document.getElementById('tab-professor-plus').innerHTML = professorPlusHtml;
  document.getElementById('tab-hapi').innerHTML = hapiHtml;

  // Protection against HAPI iframe navigating out of the HAPI context
  const hapiIframe = document.getElementById('hapiIframe');
  if (hapiIframe) {
    hapiIframe.addEventListener('load', () => {
      try {
        const path = hapiIframe.contentWindow.location.pathname;
        const hasNavbar = hapiIframe.contentWindow.document.getElementById('navbar');
        if (hasNavbar || path === '/' || path === '/index.html' || (!path.startsWith('/hapi/') && path !== '/hapi')) {
          console.warn('HAPI iframe tried to navigate out to parent app, redirecting back to /hapi/index.html');
          hapiIframe.src = '/hapi/index.html';
        }
      } catch (err) {
        console.error('Error checking HAPI iframe location, redirecting back to HAPI:', err);
        hapiIframe.src = '/hapi/index.html';
      }
    });
  }
  document.getElementById('tab-settings').innerHTML = settingsHtml;
  document.getElementById('tab-about').innerHTML = aboutHtml;
  document.getElementById('tab-accessibility').innerHTML = accessibilityHtml;
  document.getElementById('tab-rgpd').innerHTML = rgpdHtml;

  // Inject new templates
  document.getElementById('tab-bureau').innerHTML = bureauHtml;
  document.getElementById('tab-student').innerHTML = studentHtml;
  document.getElementById('tab-profiling').innerHTML = profilingHtml;
  const tabMic = document.getElementById('tab-mic');
  if (tabMic) tabMic.innerHTML = micHtml;

  // 2. Initialize feature initializers and dynamic behaviors
  initNavigation();
  initVision();
  initTodo();
  initFormalizer();
  initJudge();
  initVoice();
  initProfessor();
  initProfessorPlus();
  initSettings();
  
  // Initialize new features
  initBureau();
  initStudent();
  initProfiling();
  initMic();

  initUiEffects();
  
  // 3. Handle URL parameters for SPA routing (Student view vs Mic vs main dashboard)
  const params = new URLSearchParams(window.location.search);
  const isMicMode = params.get('mode') === 'mic' || params.get('tab') === 'mic';
  const isStudentMode = (params.has('session') && !isMicMode) || params.get('tab') === 'student';

  if (isMicMode) {
    const nav = document.getElementById('navbar');
    const footer = document.querySelector('footer');
    if (nav) nav.style.display = 'none';
    if (footer) footer.style.display = 'none';

    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-mic')?.classList.add('active');
    document.body.classList.add('bureau-active');
  } else if (isStudentMode) {
    const nav = document.getElementById('navbar');
    const footer = document.querySelector('footer');
    if (nav) nav.style.display = 'none';
    if (footer) footer.style.display = 'none';

    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-student')?.classList.add('active');
    document.body.classList.add('bureau-active');
  } else if (params.get('tab') === 'profiling') {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-profiling')?.classList.add('active');
  }

  // Check provider status on startup
  checkActiveProviderStatus();

  // Attach listener to Navbar "Vérifier le serveur" icon button
  const verifyServerBtn = document.getElementById('verifyServerBtn');
  if (verifyServerBtn) {
    verifyServerBtn.addEventListener('click', async () => {
      verifyServerBtn.classList.add('rotating');
      verifyServerBtn.disabled = true;

      try {
        const res = await checkActiveProviderStatus();
        if (res && res.success) {
          if (window.showToast) {
            window.showToast(`✅ ${getProviderLabel(res.provider)} connecté (${res.count} modèles disponibles) !`);
          } else {
            alert(`✅ ${getProviderLabel(res.provider)} connecté (${res.count} modèles)`);
          }
        } else {
          const providerName = getProviderLabel(appConfig.provider);
          if (window.showToast) {
            window.showToast(`⚠️ ${providerName} est hors ligne. Ouvrez les Paramètres pour sélectionner un autre fournisseur (Albert, ILaaS).`, 'error');
          } else {
            alert(`⚠️ ${providerName} est hors ligne. Rendez-vous dans les Paramètres.`);
          }
        }
      } catch (err) {
        if (window.showToast) {
          window.showToast(`⚠️ Erreur : ${err.message}`, 'error');
        }
      } finally {
        verifyServerBtn.classList.remove('rotating');
        verifyServerBtn.disabled = false;
      }
    });
  }

  // Click on top server status badge opens settings
  const serverStatusBadge = document.getElementById('serverStatus');
  if (serverStatusBadge) {
    serverStatusBadge.style.cursor = 'pointer';
    serverStatusBadge.title = 'Cliquer pour ouvrir les paramètres IA';
    serverStatusBadge.addEventListener('click', () => {
      document.querySelector('[data-tab="settings"]')?.click();
    });
  }
});

