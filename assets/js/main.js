// Theme toggle
const themeToggle = document.querySelector('.bascule-theme');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    document.body.classList.toggle('dark-theme');
  });
}

// Set initial theme
document.body.classList.add('dark-theme');

// Menu mobile
const menuToggle = document.querySelector('.bascule-menu');
if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    document.body.classList.toggle('menu-ouvert');
  });
}

// Année dynamique footer
const yearEl = document.getElementById('annee');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Animation "cracking" pour les projets
const projectCards = document.querySelectorAll('.projet-carte');

projectCards.forEach(card => {
  const paragraph = card.querySelector('p');
  const originalText = paragraph.textContent;
  const chars = '!<>-_\\/[]{}—=+*^?#________';

  card.addEventListener('mouseenter', () => {
    let i = 0;
    const interval = setInterval(() => {
      paragraph.textContent = originalText.split('').map((char, index) => {
        if (index < i) {
          return originalText[index];
        }
        return chars[Math.floor(Math.random() * chars.length)];
      }).join('');

      if (i >= originalText.length) {
        clearInterval(interval);
        paragraph.textContent = originalText;
      }
      i += 1;
    }, 10);
  });

  card.addEventListener('mouseleave', () => {
    paragraph.textContent = originalText;
  });
});
const pdfViewers = document.querySelectorAll('.pdf-viewer');

pdfViewers.forEach(viewer => {
    const unblurButton = viewer.querySelector('.unblur-button');
    const pdfEmbed = viewer.querySelector('.pdf-embed');
    const unblurOverlay = viewer.querySelector('.unblur-overlay');

    if (unblurButton && pdfEmbed && unblurOverlay) {
        unblurButton.addEventListener('click', () => {
            pdfEmbed.classList.remove('blurred');
            unblurOverlay.classList.add('hidden');
        });
    }
});

// Sticky secondary navbar for project pages
document.addEventListener('DOMContentLoaded', () => {
  const mainNav = document.querySelector('.barre-de-navigation');
  const projectNav = document.querySelector('.projets-navigation');

  if (mainNav && projectNav) {
    const setProjectNavTop = () => {
      const mainNavHeight = mainNav.offsetHeight;
      projectNav.style.top = `${mainNavHeight}px`;
    };

    setProjectNavTop();
    window.addEventListener('resize', setProjectNavTop);
  }
});
