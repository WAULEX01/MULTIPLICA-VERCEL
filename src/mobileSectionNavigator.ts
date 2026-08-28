import './styles/mobile-section-nav-v823.css';

const MOBILE_QUERY = '(max-width: 768px)';
const LONG_PAGES = new Set(['radar', 'attendance', 'birthdays', 'dashboard', 'reports', 'tutorial', 'agenda', 'missions', 'departments', 'settings', 'home']);

let trigger: HTMLButtonElement | null = null;
let panel: HTMLDivElement | null = null;
let lastSignature = '';

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

function getActivePageRoot(): HTMLElement | null {
  const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-mobile-page]'));
  return roots.find((root) => {
    const rect = root.getBoundingClientRect();
    const style = window.getComputedStyle(root);
    return style.display !== 'none' && rect.width > 0 && rect.height > 0;
  }) || null;
}

function collectHeadings(root: HTMLElement) {
  const items = Array.from(root.querySelectorAll<HTMLElement>('h2, h3'))
    .filter((heading) => !heading.closest('.mobile-section-nav-panel'))
    .map((heading) => ({ heading, label: normalize(heading.textContent || '') }))
    .filter((item) => item.label.length > 0)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.label === item.label) === index)
    .slice(0, 12);
  return items;
}

function closePanel() {
  if (!panel || !trigger) return;
  panel.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
}

function ensureShell() {
  if (!trigger) {
    trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'mobile-section-nav-trigger';
    trigger.textContent = '☰';
    trigger.setAttribute('aria-label', 'Abrir atalhos desta tela');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', () => {
      if (!panel) return;
      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      trigger?.setAttribute('aria-expanded', String(willOpen));
    });
    document.body.appendChild(trigger);
  }

  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'mobile-section-nav-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'navigation');
    panel.setAttribute('aria-label', 'Atalhos da tela atual');
    document.body.appendChild(panel);
  }
}

function refreshNavigator() {
  const mobile = window.matchMedia(MOBILE_QUERY).matches;
  const root = getActivePageRoot();
  const page = root?.dataset.mobilePage || '';
  const headings = root ? collectHeadings(root) : [];
  const shouldShow = mobile && !!root && LONG_PAGES.has(page) && headings.length >= 2;

  ensureShell();
  if (!trigger || !panel) return;

  trigger.hidden = !shouldShow;
  if (!shouldShow) {
    closePanel();
    return;
  }

  const signature = `${page}|${headings.map((item) => item.label).join('|')}`;
  if (signature === lastSignature) return;
  lastSignature = signature;

  panel.innerHTML = '';
  const title = document.createElement('strong');
  title.textContent = 'Ir para seção';
  panel.appendChild(title);

  const list = document.createElement('div');
  list.className = 'mobile-section-nav-list';
  headings.forEach(({ heading, label }, index) => {
    if (!heading.id) heading.id = `mobile-section-${page}-${index + 1}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mobile-section-nav-item';
    button.textContent = label;
    button.addEventListener('click', () => {
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      closePanel();
      window.setTimeout(() => heading.focus?.({ preventScroll: true }), 350);
    });
    list.appendChild(button);
  });
  panel.appendChild(list);
}

let scheduled = false;
const scheduleRefresh = () => {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    refreshNavigator();
  });
};

const observer = new MutationObserver(scheduleRefresh);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    refreshNavigator();
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-mobile-page'] });
    window.addEventListener('resize', scheduleRefresh, { passive: true });
  }, { once: true });
} else {
  refreshNavigator();
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-mobile-page'] });
  window.addEventListener('resize', scheduleRefresh, { passive: true });
}
