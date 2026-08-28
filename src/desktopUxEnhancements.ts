import './styles/desktop-modern-v823.css';
import './styles/desktop-screen-refinements-v823.css';

/* Camada de apresentação desktop v8.2.3.
   Apenas marca a página atual para permitir CSS mais específico; não lê nem altera dados. */
const DESKTOP_MIN = 1024;

const pageMap: Record<string, string> = {
  'dashboard': 'dashboard',
  'membro': 'members',
  'membros': 'members',
  'presença': 'attendance',
  'presenca': 'attendance',
  'radar': 'radar',
  'agenda': 'agenda',
  'relatório': 'reports',
  'relatorios': 'reports',
  'anivers': 'birthdays',
  'departamento': 'departments',
  'tutorial': 'tutorial',
  'configura': 'settings',
  'miss': 'missions',
  'início': 'home',
  'inicio': 'home',
};

function inferPage(): string | null {
  const active = document.querySelector('.sidebar-link.active');
  const text = active?.textContent?.trim().toLowerCase() || '';
  for (const [needle, page] of Object.entries(pageMap)) {
    if (text.includes(needle)) return page;
  }
  return null;
}

function markDesktopPage() {
  if (window.innerWidth < DESKTOP_MIN) {
    document.body.removeAttribute('data-desktop-page');
    return;
  }
  const page = inferPage();
  if (page) document.body.setAttribute('data-desktop-page', page);
}

const observer = new MutationObserver(() => requestAnimationFrame(markDesktopPage));

function start() {
  markDesktopPage();
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', markDesktopPage, { passive: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
