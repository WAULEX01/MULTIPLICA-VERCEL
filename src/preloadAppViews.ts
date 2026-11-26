// Pré-aquecimento progressivo das telas do Multiplica PLUS.
// Desktop mantém a estratégia anterior. No celular, as telas mais usadas
// são carregadas SOMENTE após login/snapshot, em momentos de ociosidade.
// Nenhum acesso ao Supabase, fila offline ou banco é feito aqui.

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
};

const idleWindow = window as IdleWindow;

const runWhenIdle = (callback: () => void, fallbackDelay: number) => {
  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(callback, { timeout: fallbackDelay + 1500 });
    return;
  }
  window.setTimeout(callback, fallbackDelay);
};

const isMobileDevice = () =>
  window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

const shouldAvoidBackgroundPreload = (mobile: boolean) => {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  const connection = nav.connection;
  if (connection?.saveData) return true;
  if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return true;

  // Evita competir por CPU, memória e rede em aparelhos modestos.
  if (mobile && connection?.effectiveType === '3g') return true;
  if (mobile && typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return true;

  return false;
};

const warmPrimaryViews = () => {
  void Promise.allSettled([
    import('./views/DashboardView'),
    import('./views/PeopleListView'),
    import('./views/AttendanceView'),
    import('./views/RadarView'),
  ]);
};

const warmSecondaryViews = () => {
  void Promise.allSettled([
    import('./views/AgendaView'),
    import('./views/ReportsView'),
    import('./views/DepartmentsView'),
    import('./views/BirthdaysView'),
    import('./views/SpecialMissionsView'),
  ]);
};

let mobileWarmupScheduled = false;

/**
 * Chamado pelo App somente após sessão autenticada e snapshot disponível.
 * As importações são sequenciais, para não disputar o primeiro carregamento
 * nem baixar simultaneamente todas as telas em um celular.
 */
export function scheduleMobileNavigationWarmup(): void {
  if (mobileWarmupScheduled || !isMobileDevice() || shouldAvoidBackgroundPreload(true)) return;
  mobileWarmupScheduled = true;

  window.setTimeout(() => runWhenIdle(() => {
    void (async () => {
      const loaders = [
        () => import('./views/PeopleListView'),
        () => import('./views/AttendanceView'),
        () => import('./views/RadarView'),
        () => import('./views/DashboardView'),
        () => import('./views/ReportsView'),
      ];
      for (const load of loaders) {
        if (document.hidden || !navigator.onLine) return;
        try {
          await load();
        } catch (error) {
          console.warn('[Mobile navigation] Pré-carregamento adiado:', error);
          return;
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 600));
      }
    })();
  }, 1000), 1200);
}

// Mantém o pré-aquecimento original para desktop.
window.addEventListener('load', () => {
  if (isMobileDevice() || shouldAvoidBackgroundPreload(false)) return;
  window.setTimeout(() => runWhenIdle(warmPrimaryViews, 1200), 1800);
  window.setTimeout(() => runWhenIdle(warmSecondaryViews, 1800), 6000);
}, { once: true });
