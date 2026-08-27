// Pré-aquecimento progressivo das telas do Multiplica PLUS.
// Objetivo: manter a abertura inicial leve e, depois que o app estiver pronto,
// baixar em segundo plano as telas mais usadas para que a navegação seguinte
// fique mais rápida. Não acessa nem altera banco, sincronização ou sessão.

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

const shouldAvoidBackgroundPreload = () => {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;

  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
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

window.addEventListener('load', () => {
  if (shouldAvoidBackgroundPreload()) return;

  // Primeiro deixa a tela inicial terminar de abrir e estabilizar.
  window.setTimeout(() => runWhenIdle(warmPrimaryViews, 1200), 1800);

  // As telas menos frequentes entram depois, sem disputar a abertura do app.
  window.setTimeout(() => runWhenIdle(warmSecondaryViews, 1800), 6000);
}, { once: true });
