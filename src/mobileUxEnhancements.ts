import './styles/mobile-ux-v823.css';

/* Multiplica PLUS v8.2.3 — melhorias progressivas de UX/acessibilidade.
   Esta camada apenas adiciona classes/atributos/comportamento de teclado ao DOM.
   Não chama API, não salva dados e não interfere na sincronização. */

const MOBILE_QUERY = '(max-width: 768px)';
const PAGE_NAME_MAP: Array<[RegExp, string]> = [
  [/radar/i, 'radar'],
  [/presen[cç]a/i, 'attendance'],
  [/anivers/i, 'birthdays'],
  [/relat[oó]r/i, 'reports'],
  [/tutorial/i, 'tutorial'],
  [/dashboard/i, 'dashboard'],
  [/agenda/i, 'agenda'],
  [/miss[oõ]es?/i, 'missions'],
  [/departament/i, 'departments'],
  [/configura/i, 'settings'],
  [/membros|lideran[cç]a/i, 'members'],
  [/in[ií]cio|bem-vindo/i, 'home'],
];

let activeMemberDialog: HTMLElement | null = null;
let memberDialogTrigger: HTMLElement | null = null;
let memberDialogKeydown: ((event: KeyboardEvent) => void) | null = null;

const isVisible = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
};

const getFocusable = (container: HTMLElement) => Array.from(
  container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ),
).filter(isVisible);

function annotateViewHeaders() {
  document.querySelectorAll<HTMLElement>('.view-header').forEach((header) => {
    const heading = header.querySelector<HTMLElement>('h1, h2, h3');
    if (!heading) return;

    let copy = heading.parentElement as HTMLElement | null;
    if (!copy || copy === header) {
      copy = Array.from(header.children).find((child) => child.contains(heading)) as HTMLElement | undefined || null;
    }
    if (copy && copy !== header) copy.classList.add('view-header-copy');

    const text = `${heading.textContent || ''} ${header.querySelector('.subtitle')?.textContent || ''}`;
    const pageName = PAGE_NAME_MAP.find(([pattern]) => pattern.test(text))?.[1];
    if (pageName) {
      const pageRoot = header.closest<HTMLElement>('.animate-fade') || header.parentElement;
      pageRoot?.setAttribute('data-mobile-page', pageName);
    }
  });
}

function ensureLabelAssociation(form: HTMLFormElement, labelText: RegExp, fallbackId: string) {
  const labels = Array.from(form.querySelectorAll<HTMLLabelElement>('label'));
  const label = labels.find((item) => labelText.test(item.textContent || ''));
  if (!label || label.htmlFor) return;

  const group = label.closest('.form-group') || label.parentElement;
  const field = group?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
  if (!field) return;
  if (!field.id) field.id = fallbackId;
  label.htmlFor = field.id;
}

function releaseMemberDialogFocus() {
  if (memberDialogKeydown) {
    document.removeEventListener('keydown', memberDialogKeydown, true);
    memberDialogKeydown = null;
  }

  activeMemberDialog = null;
  const trigger = memberDialogTrigger;
  memberDialogTrigger = null;
  if (trigger?.isConnected) {
    window.setTimeout(() => trigger.focus({ preventScroll: true }), 0);
  }
}

function enhanceMemberDialog() {
  const nameField = document.querySelector<HTMLInputElement>('#reg-name');
  if (!nameField) {
    if (activeMemberDialog && !activeMemberDialog.isConnected) releaseMemberDialogFocus();
    return;
  }

  const form = nameField.closest<HTMLFormElement>('form');
  const dialog = nameField.closest<HTMLElement>('.modal-content');
  const overlay = dialog?.closest<HTMLElement>('.modal-overlay');
  if (!form || !dialog || !overlay) return;
  if (dialog.dataset.memberDialogEnhanced === 'true') return;

  memberDialogTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeMemberDialog = dialog;

  overlay.classList.add('member-edit-modal-overlay');
  dialog.classList.add('member-edit-modal');
  form.classList.add('member-edit-form');

  const header = dialog.querySelector<HTMLElement>('.modal-header');
  header?.classList.add('member-edit-modal-header');

  const heading = header?.querySelector<HTMLElement>('h1, h2, h3');
  if (heading) {
    if (!heading.id) heading.id = 'member-edit-modal-title';
    dialog.setAttribute('aria-labelledby', heading.id);
  } else {
    dialog.setAttribute('aria-label', 'Editar pessoa');
  }

  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('tabindex', '-1');
  dialog.dataset.memberDialogEnhanced = 'true';

  const closeButton = dialog.querySelector<HTMLButtonElement>('.modal-close');
  if (closeButton) {
    closeButton.setAttribute('aria-label', 'Fechar edição de pessoa');
    closeButton.type = 'button';
  }

  ensureLabelAssociation(form, /^\s*Sexo\b/i, 'reg-gender');

  // Completa associações simples de labels apenas dentro deste formulário.
  form.querySelectorAll<HTMLLabelElement>('label').forEach((label, index) => {
    if (label.htmlFor) return;
    const group = label.closest('.form-group') || label.parentElement;
    const field = group?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
    if (!field) return;
    if (!field.id) field.id = `member-edit-field-${index + 1}`;
    label.htmlFor = field.id;
  });

  memberDialogKeydown = (event: KeyboardEvent) => {
    if (!activeMemberDialog?.isConnected) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeButton?.click();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = getFocusable(activeMemberDialog);
    if (!focusable.length) {
      event.preventDefault();
      activeMemberDialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;
    if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', memberDialogKeydown, true);
  window.setTimeout(() => dialog.focus({ preventScroll: true }), 0);
}

function enhanceTestModeBar() {
  document.querySelectorAll<HTMLElement>('.test-mode-bar').forEach((bar) => {
    if (bar.dataset.mobileUxEnhanced === 'true') return;
    bar.dataset.mobileUxEnhanced = 'true';
    bar.classList.add('mobile-test-mode-enhanced');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mobile-test-mode-toggle';
    toggle.setAttribute('aria-label', 'Recolher modo de teste');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.textContent = '⌃';
    toggle.addEventListener('click', () => {
      const collapsed = bar.classList.toggle('is-collapsed');
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Expandir modo de teste' : 'Recolher modo de teste');
      toggle.textContent = collapsed ? '⌄' : '⌃';
    });
    bar.appendChild(toggle);
  });
}

function ensureBackToTop() {
  if (document.querySelector('.mobile-back-to-top')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mobile-back-to-top';
  button.setAttribute('aria-label', 'Voltar ao topo');
  button.title = 'Voltar ao topo';
  button.textContent = '↑';
  button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(button);

  const refreshVisibility = () => {
    const shouldShow = window.matchMedia(MOBILE_QUERY).matches && window.scrollY > 420;
    button.classList.toggle('is-visible', shouldShow);
  };
  window.addEventListener('scroll', refreshVisibility, { passive: true });
  window.addEventListener('resize', refreshVisibility, { passive: true });
  refreshVisibility();
}

function enhanceDom() {
  annotateViewHeaders();
  enhanceMemberDialog();
  enhanceTestModeBar();
  ensureBackToTop();
}

let scheduled = false;
const scheduleEnhance = () => {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    enhanceDom();
  });
};

const observer = new MutationObserver(scheduleEnhance);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    enhanceDom();
    observer.observe(document.body, { childList: true, subtree: true });
  }, { once: true });
} else {
  enhanceDom();
  observer.observe(document.body, { childList: true, subtree: true });
}
