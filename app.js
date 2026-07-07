import { checkActiveProviderStatus } from './js/api.js';
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

// Import HTML templates as raw strings via Vite
import homeHtml from './templates/home.html?raw';
import visionHtml from './templates/vision.html?raw';
import todoHtml from './templates/todo.html?raw';
import formalizerHtml from './templates/formalizer.html?raw';
import judgeHtml from './templates/judge.html?raw';
import voiceHtml from './templates/voice.html?raw';
import professorHtml from './templates/professor.html?raw';
import professorPlusHtml from './templates/professor-plus.html?raw';
import settingsHtml from './templates/settings.html?raw';
import aboutHtml from './templates/about.html?raw';
import accessibilityHtml from './templates/accessibility.html?raw';
import rgpdHtml from './templates/rgpd.html?raw';

// New templates
import bureauHtml from './templates/bureau.html?raw';
import studentHtml from './templates/student.html?raw';
import profilingHtml from './templates/profiling.html?raw';

// Expose checks globally
window.checkOllamaStatus = checkActiveProviderStatus;
window.checkActiveProviderStatus = checkActiveProviderStatus;

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
  document.getElementById('tab-settings').innerHTML = settingsHtml;
  document.getElementById('tab-about').innerHTML = aboutHtml;
  document.getElementById('tab-accessibility').innerHTML = accessibilityHtml;
  document.getElementById('tab-rgpd').innerHTML = rgpdHtml;

  // Inject new templates
  document.getElementById('tab-bureau').innerHTML = bureauHtml;
  document.getElementById('tab-student').innerHTML = studentHtml;
  document.getElementById('tab-profiling').innerHTML = profilingHtml;

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

  initUiEffects();
  
  // 3. Handle URL parameters for SPA routing (Student view vs main dashboard)
  const params = new URLSearchParams(window.location.search);
  if (params.has('session') || params.get('tab') === 'student') {
    const nav = document.getElementById('navbar');
    const footer = document.querySelector('footer');
    if (nav) nav.style.display = 'none';
    if (footer) footer.style.display = 'none';

    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-student')?.classList.add('active');
  } else if (params.get('tab') === 'profiling') {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-profiling')?.classList.add('active');
  }

  // Check provider status on startup
  checkActiveProviderStatus();
});

