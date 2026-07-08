export function initNavigation() {
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');
  const toolCards = document.querySelectorAll('.tool-card');

  function switchTab(tabId) {
    document.body.classList.toggle('bureau-active', tabId === 'bureau' || tabId === 'student');
    
    tabLinks.forEach(link => {
      if (link.getAttribute('data-tab') === tabId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    tabContents.forEach(content => {
      if (content.id === `tab-${tabId}`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  // Navigation Tab Clicks
  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      switchTab(link.getAttribute('data-tab'));
    });
  });

  // Home Page Card Clicks
  toolCards.forEach(card => {
    card.addEventListener('click', () => {
      const targetTab = card.getAttribute('data-target-tab');
      if (targetTab) {
        switchTab(targetTab);
      }
    });
    
    // Spotlight Hover Effect for Cards
    card.addEventListener('mousemove', (e) => {
      if(card.classList.contains('disabled')) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--x', `${x}px`);
      card.style.setProperty('--y', `${y}px`);
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });

  // Initial check on load
  const activeTab = document.querySelector('.tab-content.active');
  if (activeTab) {
    const tabId = activeTab.id.replace('tab-', '');
    document.body.classList.toggle('bureau-active', tabId === 'bureau' || tabId === 'student');
  }
}
