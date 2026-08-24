// @ts-nocheck
// src/App.tsx
// Force rebuild hash to bypass cache
console.log("CACHE_BUSTER_V21_V78_SYNC_CONSISTENCY");
import { getLocalDateISO } from './utils/localDate';
import { useState, useEffect, useRef } from 'react';
import { initializeDB, saveDB, getWeekKey, createWeeklyMissionIfMissing, isYouthOrTeenDepartment, personInDepartment, generateUUID, getUserAllowedDepartments, canUserSelectDepartment, getDepartmentTheme, getVisibleDepartments, hashPassword, getSyncQueue, acknowledgeSyncQueue, markSyncQueueInFlight, rebaseSyncQueue } from './services/db';
import { apiGetData, apiGetVersionInfo, apiPullChanges, apiPushPatches, apiLogout, apiSubscribeToChanges, apiSwitchDepartment } from './services/api';
import { persistPreUpdateCheckpoint } from './services/versionSync';
import { enqueueDatabaseChanges } from './services/syncEngine';
import { applyServerDelta, normalizeServerEntity, applyPendingSyncOverlay } from './services/serverDelta';
import {
  APP_VERSION,
  DATA_GENERATION,
  SCHEMA_VERSION,
  activateCurrentDataGeneration,
  getOrCreateDeviceId,
  isCurrentDataGenerationActive,
  isVersionNewer,
  prepareCurrentDataGeneration,
} from './services/release';

// Chave de autenticacao da API (centralizada em api.ts)

import type { AppDatabase, UserSession, Person, AttendanceRecord, MonthlyGoal, PastoralLog, WeeklyMission, Message, ChurchEvent, ActivityLog } from './types';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { DepartmentsView } from './views/DepartmentsView';
import { PeopleListView } from './views/PeopleListView';
import { AttendanceView } from './views/AttendanceView';
import { RadarView } from './views/RadarView';
import { ReportsView } from './views/ReportsView';
import { AgendaView } from './views/AgendaView';
import { TutorialView } from './views/TutorialView';
import { BirthdaysView } from './views/BirthdaysView';
import { SettingsView } from './views/SettingsView';
import { SpecialMissionsView } from './views/SpecialMissionsView';
import { InicioView } from './views/InicioView';
import { ChatWidget } from './components/ChatWidget';

// Indicador de sincronização — bolinha discreta no canto superior direito
// 🔴 Vermelho = offline | 🟠 Laranja = conectado sincronizando | 🟢 Verde = sincronizado
const SyncIndicator = ({ isSyncing, hasPendingSync, isOnline }: { isSyncing: boolean; hasPendingSync: boolean; isOnline: boolean }) => {
  const getColor = () => {
    if (!isOnline) return '#ef4444';        // vermelho: offline
    if (isSyncing) return '#f97316';        // laranja: sincronizando
    return '#22c55e';                       // verde: sincronizado
  };
  const getTooltip = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Sincronizando...';
    return 'Sincronizado';
  };
  return (
    <div title={getTooltip()} style={{
      position: 'fixed',
      top: '14px',
      right: '14px',
      zIndex: 9999,
      width: '14px',
      height: '14px',
      borderRadius: '50%',
      background: getColor(),
      boxShadow: `0 0 8px ${getColor()}`,
      transition: 'background 0.4s ease, box-shadow 0.4s ease',
      cursor: 'default'
    }} />
  );
};

// Executa antes da primeira leitura do banco local. A geração Supabase master
// ou fila pertencente às versões anteriores é descartado uma única vez.
prepareCurrentDataGeneration();

// Marcador da limpeza automática de banco divergente. Quando este valor muda,
// todos os aparelhos JÁ ATIVADOS fazem UMA vez a reconciliação completa com o
// Supabase na próxima execução — sem depender do usuário clicar em "Forçar
// Download (Pull)". Para agendar uma nova limpeza futura, basta incrementar o
// valor abaixo e rebuildar/deployar.
const AUTO_RECONCILE_KEY = 'pm_auto_reconcile';
const AUTO_RECONCILE_VALUE = 'v7.7-force-reset-v1';

// Icons
import {
  LayoutDashboard,
  Network,
  Users,
  Calendar,
  AlertTriangle,
  Target,
  FileSpreadsheet,
  LogOut,
  Sparkles,
  MessageSquare,
  MessageCircle,
  BookOpen,
  CloudOff,
  RefreshCw,
  Cloud,
  Cake,
  Settings,
  Plus,
  BarChart3,
  Sun,
  Moon
} from 'lucide-react';

// A v8 usa sessão individual no Supabase; nenhuma chave compartilhada fica no frontend.

// Normalização única do snapshot vindo da Supabase. Todas as telas consomem o
// mesmo AppDatabase; portanto, atualizar este estado atualiza Início, Dashboard,
// Membros, Agenda, Presença, Radar, Departamentos, Aniversários e Relatórios.
const parseDepartments = (value: any, fallbackDepartment?: string, fallbackRole?: string) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return fallbackDepartment ? [{ department: fallbackDepartment, role: fallbackRole }] : undefined;
};

const cloudPayloadToDatabase = (cloudData: any): AppDatabase => ({
  departments: (cloudData.departments || []).map((row: any) => normalizeServerEntity('departments', row)),
  people: (cloudData.people || []).map((row: any) => {
    const person = normalizeServerEntity('people', row);
    return { ...person, departments: person.departments || parseDepartments(row.departments, row.department, row.role) };
  }),
  attendances: (cloudData.attendances || []).map((row: any) => normalizeServerEntity('attendances', row)),
  goals: (cloudData.goals || []).map((row: any) => normalizeServerEntity('goals', row)),
  pastoralLogs: (cloudData.pastoralLogs || []).map((row: any) => normalizeServerEntity('pastoralLogs', row)),
  activityLogs: (cloudData.activityLogs || []).map((row: any) => normalizeServerEntity('activityLogs', row)),
  activityLogCount: typeof cloudData.activity_log_count === 'number'
    ? cloudData.activity_log_count
    : (cloudData.activityLogs || []).length,
  weeklyMissions: (cloudData.weeklyMissions || []).map((row: any) => normalizeServerEntity('weeklyMissions', row)),
  specialMissions: (cloudData.specialMissions || []).map((row: any) => normalizeServerEntity('specialMissions', row)),
  messageHistory: (cloudData.messageHistory || []).map((row: any) => normalizeServerEntity('messageHistory', row)),
  events: (cloudData.events || []).map((row: any) => normalizeServerEntity('events', row)),
});

// ===== Helpers de auditoria — log automático de interações =====
// Campos de sincronização/rastreamento ignorados no diff (não representam ação real do usuário)
const AUDIT_VOLATILE_FIELDS = ['version', 'updatedAt', 'updatedBy', 'interactionCount', 'loginCount', 'timeOnlineSeconds', 'timeOnline', 'lastActive'];
const auditStripVolatile = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out: any = {};
  Object.keys(obj).forEach(k => {
    if (AUDIT_VOLATILE_FIELDS.includes(k)) return;
    out[k] = obj[k];
  });
  return out;
};
function auditCountChanged<T extends { id?: string; month?: string }>(oldArr: T[] = [], newArr: T[] = [], pk: string = 'id'): number {
  const oldMap = new Map(oldArr.map((i: any) => [i[pk], JSON.stringify(auditStripVolatile(i))]));
  return newArr.filter((i: any) => {
    const key = i[pk];
    return !oldMap.has(key) || oldMap.get(key) !== JSON.stringify(auditStripVolatile(i));
  }).length;
}

export default function App() {
  const [db, setDb] = useState<AppDatabase | null>(null);
  // Uma geração já ativada contém um snapshot previamente confirmado da
  // Supabase. Ela pode abrir imediatamente, online ou offline, enquanto o
  // pull e a fila pendente são processados em segundo plano. Somente o
  // primeiro acesso absoluto à geração Supabase master permanece bloqueado até receber o
  // snapshot oficial.
  const [versionSyncReady, setVersionSyncReady] = useState<boolean>(() => isCurrentDataGenerationActive());
  const [versionNotice, setVersionNotice] = useState<{ kind: 'checking' | 'updating' | 'syncing' | 'ready' | 'warning'; text: string } | null>(
    isCurrentDataGenerationActive()
      ? null
      : navigator.onLine
        ? { kind: 'checking', text: 'Baixando o banco oficial do Supabase…' }
        : { kind: 'warning', text: `Primeiro acesso à ${APP_VERSION}: conecte este aparelho à internet.` }
  );
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('multiplica_plus_session');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Sessões da 7.x não são reaproveitadas: a 8.0 exige token individual emitido pelo Supabase.
      if (!parsed?.sessionToken) {
        localStorage.removeItem('multiplica_plus_session');
        return null;
      }
      return parsed;
    } catch {
      localStorage.removeItem('multiplica_plus_session');
      return null;
    }
  });
  const [currentView, setCurrentView] = useState<string>('inicio');
  const [targetDepartmentFilter, setTargetDepartmentFilter] = useState<string | undefined>(undefined);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [quickAddModal, setQuickAddModal] = useState<{ open: boolean; type: 'membro' | 'departamento' }>({ open: false, type: 'membro' });
  const [chatOpen, setChatOpen] = useState(false);
  const [emulatedRole, setEmulatedRole] = useState<string | null>(null);
  const [emulatedDept, setEmulatedDept] = useState('Novo Alvorecer (Jovens)');
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'light');

  const handleToggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const handleNavigate = (view: string, deptName?: string) => {
    setTargetDepartmentFilter(deptName);
    setCurrentView(view);
  };
  

  const activeSession = session && emulatedRole
    ? { ...session, role: emulatedRole as any, department: emulatedDept }
    : session;

  // Wrapper limpo: salva local + envia ao servidor
  const dbRef = useRef(db);
  useEffect(() => { dbRef.current = db; }, [db]);
  const pushInProgressRef = useRef(false);
  const lastPushTimeRef = useRef<number>(Date.now());
  const runPendingPushRef = useRef<() => Promise<void>>(async () => {});
  const pushRetryCountRef = useRef<Map<string, number>>(new Map());

  // ⚠️ SISTEMA DE SINCRONIZAÇÃO FINALIZADO v5.8.0 — Não alterar sem autorização do Pastor Wagner
  const updateDatabase = async (newDB: AppDatabase, isInteraction = true, skipPush = false, logAction?: string) => {
    if (!newDB) return;
    if (!isCurrentDataGenerationActive()) {
      console.warn('[Generation] Alteração bloqueada antes do primeiro snapshot oficial');
      return;
    }
    const oldDB = dbRef.current;
    
    let dbToSave = newDB;
    // Auto increment interactionCount for logged in leader/multiplier
    if (session?.personId && isInteraction) {
      dbToSave = {
        ...newDB,
        people: newDB.people.map(p => {
          if (p.id === session.personId) {
            return {
              ...p,
              interactionCount: (p.interactionCount || 0) + 1,
              version: (p.version || 0) + 1,
              updatedAt: new Date().toISOString(),
              updatedBy: session.personId
            };
          }
          return p;
        })
      };
    }

    // Defesa: garante que specialMissions nunca seja perdido
    if (!dbToSave.specialMissions && oldDB?.specialMissions?.length) {
      dbToSave.specialMissions = oldDB.specialMissions;
    }

    // Auditoria: log automático de interações (todas as telas/perfis)
    // Gera um registro sempre que houver mudança real de dados por um usuário logado.
    if (session?.personId && isInteraction) {
      const explicitNewLogs = (dbToSave.activityLogs || []).filter(l => !(oldDB?.activityLogs || []).some(o => o.id === l.id));
      if (explicitNewLogs.length === 0) {
        const changedParts: { label: string; n: number }[] = [];
        const nPeople = auditCountChanged(oldDB?.people, dbToSave.people);
        if (nPeople > 0) changedParts.push({ label: nPeople === 1 ? 'membro' : 'membros', n: nPeople });
        const nAtt = auditCountChanged(oldDB?.attendances, dbToSave.attendances);
        if (nAtt > 0) changedParts.push({ label: nAtt === 1 ? 'presença' : 'presenças', n: nAtt });
        const nEvents = auditCountChanged(oldDB?.events, dbToSave.events);
        if (nEvents > 0) changedParts.push({ label: nEvents === 1 ? 'evento na agenda' : 'eventos na agenda', n: nEvents });
        const nMissions = auditCountChanged(oldDB?.weeklyMissions, dbToSave.weeklyMissions);
        if (nMissions > 0) changedParts.push({ label: 'missões semanais', n: nMissions });
        const nSpecial = auditCountChanged(oldDB?.specialMissions, dbToSave.specialMissions);
        if (nSpecial > 0) changedParts.push({ label: 'missões especiais', n: nSpecial });
        const nGoals = auditCountChanged(oldDB?.goals, dbToSave.goals, 'month');
        if (nGoals > 0) changedParts.push({ label: 'metas', n: nGoals });
        const nDepts = auditCountChanged(oldDB?.departments, dbToSave.departments);
        if (nDepts > 0) changedParts.push({ label: 'departamentos', n: nDepts });
        const nMsgs = auditCountChanged(oldDB?.messageHistory, dbToSave.messageHistory);
        if (nMsgs > 0) changedParts.push({ label: nMsgs === 1 ? 'mensagem' : 'mensagens', n: nMsgs });
        const nPastoral = auditCountChanged(oldDB?.pastoralLogs, dbToSave.pastoralLogs);
        if (nPastoral > 0) changedParts.push({ label: 'ações pastorais', n: nPastoral });

        const action = logAction || (changedParts.length > 0
          ? 'Atualizou dados no sistema (' + changedParts.map(c => `${c.n} ${c.label}`).join(', ') + ')'
          : '');

        if (action) {
          const logEntry: ActivityLog = {
            id: 'log-' + generateUUID(),
            recordedBy: session.personId,
            recordedByName: session.name,
            recordedByRole: session.role,
            action,
            details: action,
            timestamp: new Date().toISOString()
          };
          dbToSave = {
            ...dbToSave,
            activityLogs: [logEntry, ...(dbToSave.activityLogs || [])]
          };
        }
      }
    }
    // UX 8.1.1 — resposta realmente imediata.
    // Atualizamos o React e a referência síncrona agora, para o modal/lista responder
    // no mesmo clique. As tarefas pesadas (JSON.stringify do banco inteiro + diff da
    // Outbox) ficam para o próximo macrotask, permitindo o navegador pintar primeiro.
    setDb(dbToSave);
    dbRef.current = dbToSave;

    const persistAndQueue = () => {
      try {
        saveDB(dbToSave);

        // ═══ MODO OFFLINE TIPO WHATSAPP ═══
        // Sempre enfileira para push, independente de conexão. A Outbox persiste
        // no localStorage e só remove a operação depois do ACK do Supabase.
        const shouldQueue = !skipPush;
        const queuedCount = shouldQueue ? enqueueDatabaseChanges(oldDB, dbToSave) : 0;
        if (queuedCount > 0) {
          localStorage.setItem('pm_pending_sync', 'true');
          setHasPendingSync(true);

          void runPendingPushRef.current().then(() => {
            lastPushTimeRef.current = Date.now();
          }).catch((error) => {
            console.warn('[Optimistic UI 8.1.1] Push em segundo plano falhou; operação preservada na Outbox:', error);
          });
        }
      } catch (error) {
        console.error('[Optimistic UI 8.1.1] Falha ao persistir/enfileirar; estado React mantido para retry:', error);
        try {
          localStorage.setItem('pm_pending_sync', 'true');
          setHasPendingSync(true);
        } catch {}
      }
    };

    // setTimeout(0), e não Promise/microtask: microtasks ainda rodam antes da pintura.
    // O macrotask permite que o clique/fechamento do modal apareça imediatamente.
    window.setTimeout(persistAndQueue, 0);
  };

  // Rastreamento de tempo ativo online do líder logado (soma +30s a cada 30 segundos)
  useEffect(() => {
    if (!session || !versionSyncReady || !isCurrentDataGenerationActive()) return;
    const interval = setInterval(() => {
      const currentDBState = dbRef.current;
      if (!currentDBState) return;

      const updatedPeople = currentDBState.people.map(p => {
        if (p.id === session.personId) {
          return {
            ...p,
            timeOnlineSeconds: (p.timeOnlineSeconds || 0) + 30,
            lastActive: new Date().toISOString(),
            version: (p.version || 0) + 1,
            updatedAt: new Date().toISOString(),
            updatedBy: session.personId
          };
        }
        return p;
      });

      // Throttle network push to once every 5 minutes (300000ms) to prevent server overload
      const shouldPush = (Date.now() - lastPushTimeRef.current) > 300000;
      updateDatabase({ ...currentDBState, people: updatedPeople }, false, !shouldPush);
      if (shouldPush) {
        lastPushTimeRef.current = Date.now();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [session, versionSyncReady]);


  // Initial load
  useEffect(() => {
    if (!db) {
      const initialDb = initializeDB();
      setDb(initialDb);
      
    }
  }, []);

  // Reenvia SOMENTE as operações realmente registradas na fila offline. O fluxo
  // antigo fazia merge do banco local inteiro e podia ressuscitar cadastros que
  // existiam apenas no cache de um aparelho. Desde a v6.9.5 o Supabase é o master.
  const runPendingPush = async () => {
    if (!navigator.onLine) return;
    if (!isCurrentDataGenerationActive()) return;
    if (pushInProgressRef.current) return;
    const currentDb = dbRef.current;
    if (!currentDb) return;

    const retryQueue = getSyncQueue();
    if (retryQueue.length === 0) {
      // Compatibilidade com versões antigas que deixavam apenas a flag, sem os
      // registros necessários para um reenvio seguro.
      localStorage.removeItem('pm_pending_sync');
      setHasPendingSync(false);
      return;
    }

    // Log detalhado da fila para debug
    const queueByType = retryQueue.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('[Sync] 📋 Fila de sincronização:', queueByType, '| Total:', retryQueue.length);

    pushInProgressRef.current = true;
    setIsSyncing(true);
    const revisionBeforePush = serverRevisionRef.current;
    console.log(`[Sync] ▶ PUSH: ${retryQueue.length} itens → Supabase (rev ${revisionBeforePush})`);
    markSyncQueueInFlight(retryQueue, true);
    try {
      const response = await apiPushPatches(retryQueue);
      const versionConflicts = Array.isArray(response?.errors)
        ? response.errors.filter((err: any) => err?.code === 'BASE_VERSION_CONFLICT')
        : [];
      if (versionConflicts.length > 0) {
        rebaseSyncQueue(versionConflicts);
        console.warn(`[Outbox] ${versionConflicts.length} conflito(s) rebaseado(s) para a versão atual do Supabase`);
      }
      const acknowledgedIds = new Set(response?.acknowledged_operation_ids || []);
      const acknowledgedItems = retryQueue.filter(item => acknowledgedIds.has(item.id));
      const unacknowledgedItems = retryQueue.filter(item => !acknowledgedIds.has(item.id));
      
      // Log detalhado do resultado
      const ackByType = acknowledgedItems.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const nackByType = unacknowledgedItems.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(`[Sync] ✅ PUSH OK: ${acknowledgedItems.length} ACK`, ackByType, `| ${unacknowledgedItems.length} não-ACK`, nackByType, `(nova rev: ${response?.server_revision || '?'})`);
      
      // Reset retry count para itens que foram confirmados
      acknowledgedItems.forEach(item => {
        pushRetryCountRef.current.delete(item.id);
      });
      
      acknowledgeSyncQueue(acknowledgedItems);
      markSyncQueueInFlight(unacknowledgedItems, false);

      // ═══════════════════════════════════════════════════════════════════
      // SEMPRE fazer pull após push — garante que o estado local reflita
      // o que outros aparelhos adicionaram (chamadas simultâneas, etc.)
      // Mesmo que o push tenha falhado parcialmente, o pull traz o estado
      // canônico do Supabase e evita que o merge local sobrescreva presenças
      // de outro aparelho.
      // ═══════════════════════════════════════════════════════════════════
      try {
        const delta = await apiPullChanges(revisionBeforePush);
        const changedEntities = delta.changes ? Object.keys(delta.changes).filter(k => delta.changes[k]?.length > 0) : [];
        console.log(`[Sync] ⬇ PULL: rev ${delta.server_revision || '?'} | ${delta.reset_required ? 'RESET' : 'delta'} | mudanças: ${changedEntities.length > 0 ? changedEntities.join(', ') : 'nenhuma'}`);
        let canonicalDb: AppDatabase;
        let confirmedRevision: number;
        if (delta.reset_required) {
          const cloudData = await apiGetData();
          canonicalDb = applyPendingSyncOverlay(cloudPayloadToDatabase(cloudData));
          confirmedRevision = Number(cloudData.server_revision || 0);
        } else {
          canonicalDb = applyPendingSyncOverlay(applyServerDelta(dbRef.current || currentDb, delta.changes || {}, delta.activity_log_count));
          confirmedRevision = Number(delta.server_revision || response.server_revision || revisionBeforePush);
        }
        setServerRevision(confirmedRevision);
        serverRevisionRef.current = confirmedRevision;
        try { localStorage.setItem('pm_server_revision', String(confirmedRevision)); } catch {}
        setDb(canonicalDb);
        dbRef.current = canonicalDb;
        saveDB(canonicalDb);
        initialSnapshotLoadedRef.current = true;
        setHasInitialServerSnapshot(true);
        const syncedAt = new Date().toISOString();
        setLastSyncedAt(syncedAt);
        try { localStorage.setItem('pm_last_synced_at', syncedAt); } catch {}
        console.log('[Outbox] Pós-push pull aplicado — estado local sincronizado com Supabase');
      } catch (pullErr) {
        console.warn('[Outbox] Pull pós-push falhou (push já confirmado):', pullErr);
      }

      // Tratar itens não confirmados - aplicar retry com backoff
      if (unacknowledgedItems.length > 0) {
        const now = Date.now();
        unacknowledgedItems.forEach(item => {
          const retryKey = item.id;
          const currentRetry = pushRetryCountRef.current.get(retryKey) || 0;
          
          // Verificar se deve fazer retry (backoff exponencial: 2s, 4s, 8s, 16s, 30s max)
          const backoffMs = Math.min(30000, 2000 * Math.pow(2, currentRetry));
          const lastAttempt = pushRetryCountRef.current.get(`${retryKey}_lastAttempt`) || 0;
          
          if (now - lastAttempt < backoffMs) {
            // Ainda não é hora de retentar
            return;
          }
          
          // Incrementar contador e marcar timestamp
          pushRetryCountRef.current.set(retryKey, currentRetry + 1);
          pushRetryCountRef.current.set(`${retryKey}_lastAttempt`, now);
          
          // NUNCA descartar alteração de negócio por número de tentativas.
          // Depois de 5 falhas, mantemos a operação na Outbox e apenas
          // reduzimos a frequência dos retries. Ela só sai mediante ACK.
          if (currentRetry >= 5) {
            console.warn(`[Outbox] Item ${item.id} continua pendente após ${currentRetry + 1} tentativas; preservado na fila`);
          }
        });
        
        // Reagendar próximo push se ainda houver itens
        const remainingQueue = getSyncQueue();
        if (remainingQueue.length > 0) {
          localStorage.setItem('pm_pending_sync', 'true');
          setHasPendingSync(true);
          
          // Agendar próximo retry em 2-5s
          const minRetryDelay = 2000;
          const maxRetryDelay = 5000;
          const nextRetry = minRetryDelay + Math.random() * (maxRetryDelay - minRetryDelay);
          
          setTimeout(() => {
            if (navigator.onLine && pushInProgressRef.current === false) {
              runPendingPush();
            }
          }, nextRetry);
          
          console.log(`[Outbox] ${unacknowledgedItems.length} itens não confirmados, reagendando retry em ${Math.round(nextRetry/1000)}s`);
        }
      } else {
        localStorage.removeItem('pm_pending_sync');
        setHasPendingSync(false);
      }
    } catch (e: any) {
      markSyncQueueInFlight(retryQueue, false);
      
      // Tratar erro de conflito de versão
      if (e?.message?.includes('base_version') || e?.message?.includes('conflito') || e?.message?.includes('versão')) {
        console.error('[Outbox] Conflito de versão detectado:', e);
        // Marcar todos os itens como não in-flight para retry
        const currentQueue = getSyncQueue();
        const updatedQueue = currentQueue.map(item => ({ ...item, inFlight: false }));
        localStorage.setItem('pm_sync_queue', JSON.stringify(updatedQueue));
        
        // Forçar reconciliação com snapshot completo
        if (navigator.onLine) {
          setTimeout(() => {
            if (dbRef.current && isCurrentDataGenerationActive()) {
              apiGetData().then(cloudData => {
                const canonicalDb = applyPendingSyncOverlay(cloudPayloadToDatabase(cloudData));
                const confirmedRevision = Number(cloudData.server_revision || 0);
                setDb(canonicalDb);
                dbRef.current = canonicalDb;
                saveDB(canonicalDb);
                setServerRevision(confirmedRevision);
                serverRevisionRef.current = confirmedRevision;
                localStorage.setItem('pm_server_revision', String(confirmedRevision));
                setHasInitialServerSnapshot(true);
                initialSnapshotLoadedRef.current = true;
                console.log('[Outbox] Conflito resolvido com snapshot completo');
              }).catch(err => {
                console.error('[Outbox] Falha ao resolver conflito:', err);
              });
            }
          }, 1000);
        }
      } else {
        console.warn('[Outbox] Falha ao sincronizar pendências:', e);
      }

      // O operation_id é idempotente e deve permanecer estável em falhas/timeout.
      // Regenerá-lo poderia reaplicar uma operação que o servidor já confirmou
      // antes de a resposta se perder na rede. Mantemos o UUID até receber ACK.

      // ═══ FASE 1 — RETRY SEM FILA OFFLINE ═══
      // Itens já estão na fila (enqueueDatabaseChanges). Basta agendar retry.
      // Não setamos pm_pending_sync — a fila (getSyncQueue) já é a verdade.
      setHasPendingSync(getSyncQueue().length > 0);
      
      // Agendar retry automático em caso de erro de rede
      if (navigator.onLine) {
        const retryDelay = Math.min(30000, 3000 * Math.pow(2, Math.min(4, (pushRetryCountRef.current.get('global') || 0))));
        pushRetryCountRef.current.set('global', (pushRetryCountRef.current.get('global') || 0) + 1);
        
        setTimeout(() => {
          pushRetryCountRef.current.set('global', Math.max(0, (pushRetryCountRef.current.get('global') || 1) - 1));
          if (navigator.onLine && pushInProgressRef.current === false) {
            runPendingPush();
          }
        }, retryDelay);
        
        console.log(`[Outbox] Retry automático em ${Math.round(retryDelay/1000)}s`);
      }
    } finally {
      setIsSyncing(false);
      pushInProgressRef.current = false;
    }
  };
  runPendingPushRef.current = runPendingPush;

  // Push proativo no startup: se houver pendências locais (ex: ficou offline e fechou a aba),
  // sincroniza com o servidor ANTES do primeiro pull para não perder alterações.
  useEffect(() => {
    if (!db) return;
    if (!versionSyncReady) return;
    runPendingPush();
  }, [db, versionSyncReady]);

  // Generate weekly mission for all applicable leaders automatically
  useEffect(() => {
    if (!db || !activeSession?.personId || !versionSyncReady || !isCurrentDataGenerationActive()) return;
    
    let currentDb = db;
    let changed = false;

    // F3 — v6.7.0: inclui Pastor/Admin/Secretaria na criação automática de missão
    const allMissionRoles = currentDb.people.filter(p => 
      (p.role === 'Multiplicador' || p.role === 'Líder' || p.role === 'Pastor' || p.role === 'Pastor Admin' || p.role === 'Secretaria Geral') &&
      !p.deleted &&
      p.status === 'Ativo'
    );
    
    allMissionRoles.forEach(m => {
      const nextDb = createWeeklyMissionIfMissing(currentDb, m, getWeekKey());
      if (nextDb !== currentDb) {
        currentDb = nextDb;
        changed = true;
      }
    });

    if (changed) {
      // Corrige bug de auditoria: criação automática de missão NÃO é interação do usuário
      updateDatabase(currentDb, false, true);
    }
  }, [db, activeSession?.personId, versionSyncReady]);

  const onlineThresholdMs = 10 * 60 * 1000; // 10 minutos
  const onlineProfiles = db ? db.people
    .filter(p => p.lastActive && !p.deleted && p.role !== 'Membro')
    .map(p => ({ ...p, lastActiveDate: new Date(p.lastActive!) }))
    .filter(p => !isNaN(p.lastActiveDate.getTime()) && Date.now() - p.lastActiveDate.getTime() <= onlineThresholdMs)
    .sort((a, b) => b.lastActiveDate.getTime() - a.lastActiveDate.getTime()) : [];

  const isAdmin = activeSession?.role === 'Pastor Admin' || activeSession?.role === 'Pastor' || activeSession?.role === 'Secretaria Geral';

  // Snapshot inicial único + Realtime; polling de 30s fica apenas como fallback.
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [hasPendingSync, setHasPendingSync] = useState<boolean>(() => {
    // Reflete pendências persistidas (ex: edições offline de sessão anterior)
    try { return localStorage.getItem('pm_pending_sync') === 'true' || getSyncQueue().length > 0; } catch { return false; }
  });
  const [forcePasswordChange, setForcePasswordChange] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [serverRevision, setServerRevision] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pm_server_revision');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => {
    try { return localStorage.getItem('pm_last_synced_at') || ''; } catch { return ''; }
  });
  const [hasInitialServerSnapshot, setHasInitialServerSnapshot] = useState<boolean>(() => isCurrentDataGenerationActive());
  const serverRevisionRef = useRef(serverRevision);
  const initialSnapshotLoadedRef = useRef(isCurrentDataGenerationActive());
  useEffect(() => { serverRevisionRef.current = serverRevision; }, [serverRevision]);
  // Permite disparar um pull imediato após salvar (tempo real):
  // quando um push termina, buscamos as mudanças dos outros aparelhos na hora.
  const loadFromServerRef = useRef<(() => Promise<void>) | null>(null);
  // Evita múltiplos pulls simultâneos (polling + online + focus disparando juntos → menos carga no servidor)
  const loadInProgressRef = useRef<boolean>(false);
  const versionLifecycleStartedRef = useRef(false);

  // Geração Supabase master: no primeiro acesso nenhum cache antigo é enviado.
  // O aparelho recebe o snapshot Supabase, ativa a geração e, somente daí em
  // diante, pode criar operações offline pertencentes à geração atual.
  useEffect(() => {
    if (!db || !isOnline || !session?.sessionToken || versionLifecycleStartedRef.current) return;
    versionLifecycleStartedRef.current = true;
    let cancelled = false;
    let versionTimer: any;
    let retryTimer: any;
    let readyNoticeTimer: any;
    let retryAttempt = 0;

    // Mostra um aviso que some sozinho depois de alguns segundos (não fica preso na tela).
    const flashNotice = (kind: 'checking' | 'updating' | 'syncing' | 'ready' | 'warning', text: string, ms = 2500) => {
      setVersionNotice({ kind, text });
      if (readyNoticeTimer) clearTimeout(readyNoticeTimer);
      readyNoticeTimer = setTimeout(() => setVersionNotice(null), ms);
    };

    const installNewVersion = async (targetVersion: string) => {
      persistPreUpdateCheckpoint(dbRef.current, getSyncQueue(), APP_VERSION);
      localStorage.setItem('pm_update_target_version', targetVersion);
      setVersionNotice({ kind: 'warning', text: `Nova versão ${targetVersion} disponível. O app continuará aberto; atualize pelo navegador quando for conveniente.` });
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(async registration => {
          await registration.update();
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        }));
      }
      console.warn('[VersionSync] Atualização disponível sem reload automático:', targetVersion); return;
    };

    const runLifecycle = async () => {
      try {
        // O Supabase/Vercel controla CORS e origem; previews da Vercel são aceitos.
        const firstActivation = !isCurrentDataGenerationActive();
        if (firstActivation) {
          setVersionNotice({ kind: 'updating', text: 'Baixando uma vez o banco oficial do Supabase…' });
          const confirmedCloud = await apiGetData();
          if (cancelled) return;
          if (confirmedCloud.appVersion && isVersionNewer(confirmedCloud.appVersion, APP_VERSION)) {
            await installNewVersion(confirmedCloud.appVersion);
            return;
          }
          if (confirmedCloud.dataGeneration !== DATA_GENERATION) throw new Error('Geração de dados divergente');
          if (!Array.isArray(confirmedCloud.people) || !Array.isArray(confirmedCloud.attendances)) {
            throw new Error('Snapshot incompleto recebido do Supabase');
          }
          setVersionNotice({ kind: 'syncing', text: 'Validando e aplicando o banco oficial do Supabase…' });
          const canonicalDb = applyPendingSyncOverlay(cloudPayloadToDatabase(confirmedCloud));
          saveDB(canonicalDb);
          activateCurrentDataGeneration(Number(confirmedCloud.server_revision || 0));
          // Aparelho novo já recebeu o snapshot oficial: marca a limpeza como feita
          // para não reconciliar de novo na próxima execução.
          localStorage.setItem(AUTO_RECONCILE_KEY, AUTO_RECONCILE_VALUE);
          setDb(canonicalDb);
          dbRef.current = canonicalDb;
          
          // Preservar fila de sincronização: não limpar sem antes verificar
          // Itens de gerações antigas são filtrados automaticamente pelo getSyncQueue()
          const queueBeforeActivation = getSyncQueue();
          if (queueBeforeActivation.length > 0) {
            console.log(`[Outbox] Preservando ${queueBeforeActivation.length} itens da fila durante ativação da geração`);
            localStorage.setItem('pm_pending_sync', 'true');
            setHasPendingSync(true);
          }
          
          // Não limpar mais a fila automaticamente - itens antigos são filtrados por geração
          // clearSyncQueue();  // Removido: preservar itens válidos da geração atual
          localStorage.removeItem('pm_pending_sync');
          localStorage.removeItem('pm_update_target_version');
          localStorage.setItem('pm_last_migrated_version', APP_VERSION);
          localStorage.setItem('pm_schema_version', String(SCHEMA_VERSION));
          localStorage.setItem('pm_version_migration_report', JSON.stringify({
            version: APP_VERSION,
            dataGeneration: DATA_GENERATION,
            completedAt: new Date().toISOString(),
            mode: 'initial-supabase-snapshot-then-realtime-delta',
            discardedLegacyState: true,
            server_revision: confirmedCloud.server_revision,
          }));
          const confirmedRevision = Number(confirmedCloud.server_revision || 0);
          setServerRevision(confirmedRevision);
          serverRevisionRef.current = confirmedRevision;
          try { localStorage.setItem('pm_server_revision', String(confirmedRevision)); } catch {}
          const syncedAt = new Date().toISOString();
          setLastSyncedAt(syncedAt);
          try { localStorage.setItem('pm_last_synced_at', syncedAt); } catch {}
          console.log('[Outbox] Patches confirmados e delta canônico do Supabase aplicado');
          // Aviso de conclusão aparece e some sozinho em ~2,5s (não fica preso)
          flashNotice('ready', 'Banco oficial do Supabase aplicado com sucesso', 2500);
        } else {
          // Em aparelhos já ativados, não baixa novamente o banco inteiro. A
          // Outbox e o polling incremental assumem a partir do cursor salvo.
          const latest = await apiGetVersionInfo();
          if (latest.appVersion && isVersionNewer(latest.appVersion, APP_VERSION)) {
            await installNewVersion(latest.appVersion);
            return;
          }

          // LIMPEZA AUTOMÁTICA (uma única vez): aparelhos que ficaram com banco
          // divergente (contagens de membros diferentes, contatos não
          // sincronizados em tempo real) convergem sozinhos com o Supabase. Nenhum
          // usuário precisa clicar em "Forçar Download (Pull)".
          if (false && localStorage.getItem(AUTO_RECONCILE_KEY) !== AUTO_RECONCILE_VALUE) {
            setVersionNotice({ kind: 'syncing', text: 'Conferindo uma vez o banco oficial do Supabase…' });
            // 1) Envia pendências offline primeiro (não perde edições legítimas)
            if (getSyncQueue().length > 0) {
              try { await runPendingPushRef.current(); } catch {}
            }
            // 2) Baixa o snapshot completo e substitui o cache local
            const cleanCloud = await apiGetData();
            if (!cancelled && cleanCloud && !cleanCloud.error) {
              const cleanDb = applyPendingSyncOverlay(cloudPayloadToDatabase(cleanCloud));
              const cleanRev = Number(cleanCloud.server_revision || 0);

              // PRESERVA exclusões locais pendentes: se o usuário excluiu um
              // contato e o push ainda não foi confirmado pelo Supabase, o
              // snapshot não pode restaurá-lo. Sem isso, contatos excluídos
              // "voltam" após atualizar a página.
              const pendingDeletes = new Set(
                getSyncQueue().filter(q => q.type === 'people' && q.operation === 'DELETE').map(q => q.itemId)
              );
              if (pendingDeletes.size > 0) {
                const currentDb = dbRef.current;
                if (currentDb) {
                  const localDeletedById = new Map(
                    (currentDb.people || [])
                      .filter(p => pendingDeletes.has(String(p.id)) && p.deleted)
                      .map(p => [String(p.id), p])
                  );
                  if (localDeletedById.size > 0) {
                    console.log(`[Reconcile] 🛡️ Preservando ${localDeletedById.size} exclusão(ões) local(is) pendente(s)`);
                    cleanDb.people = (cleanDb.people || []).map(p =>
                      localDeletedById.get(String(p.id)) || p
                    );
                  }
                }
              }

              saveDB(cleanDb);
              setDb(cleanDb);
              dbRef.current = cleanDb;
              setServerRevision(cleanRev);
              serverRevisionRef.current = cleanRev;
              try { localStorage.setItem('pm_server_revision', String(cleanRev)); } catch {}
              // Aparelho agora espelha o Supabase: limpa o restante da fila local
              // SOMENTE se não houver pendências não confirmadas. Nunca
              // descartar uma exclusão/edição que ainda não recebeu ACK.
              if (getSyncQueue().length === 0) {
                try { localStorage.removeItem('pm_sync_queue'); } catch {}
              }
              try { localStorage.removeItem('pm_pending_sync'); } catch {}
              setHasPendingSync(getSyncQueue().length > 0);
              localStorage.setItem(AUTO_RECONCILE_KEY, AUTO_RECONCILE_VALUE);
              const syncedAt = new Date().toISOString();
              setLastSyncedAt(syncedAt);
              try { localStorage.setItem('pm_last_synced_at', syncedAt); } catch {}
              initialSnapshotLoadedRef.current = true;
              setHasInitialServerSnapshot(true);
              console.log('[Reconcile] Limpeza automática concluída — banco igualado ao Supabase');
            }
          }

          // SEMPRE processa a fila de sincronização antes de considerar os
          // dados locais válidos. Isso evita que registros excluídos
          // localmente sejam sobrescritos pelo servidor durante a
          // inicialização (contatos que "voltam" após atualizar a página).
          if (getSyncQueue().length > 0) {
            try { await runPendingPushRef.current(); } catch (err) {
              console.warn('[Startup] Falha ao processar fila de sincronização: ', err);
            }
          }

          initialSnapshotLoadedRef.current = true;
          setHasInitialServerSnapshot(true);
          setVersionNotice(null);
        }
        retryAttempt = 0;
        setVersionSyncReady(true);

        versionTimer = setInterval(async () => {
          try {
            const latest = await apiGetVersionInfo();
            if (latest.appVersion && isVersionNewer(latest.appVersion, APP_VERSION)) await installNewVersion(latest.appVersion);
          } catch (error) {
            console.warn('[VersionSync] Consulta periódica de versão falhou:', error);
          }
        }, 60000);
      } catch (error) {
        console.error('[VersionSync] Reconciliação inicial falhou:', error);
        const retryDelay = Math.min(15000, 2500 * Math.pow(2, retryAttempt++));
        const pendingActivation = !isCurrentDataGenerationActive();
        if (pendingActivation) {
          setVersionNotice({
            kind: 'warning',
            text: `Aguardando o banco oficial do Supabase. Nenhum dado antigo será enviado; nova tentativa em ${Math.ceil(retryDelay / 1000)}s…`,
          });
        } else {
          setVersionNotice(null);
        }
        if (!cancelled) retryTimer = setTimeout(runLifecycle, retryDelay);
      }
    };

    runLifecycle();
    return () => {
      cancelled = true;
      versionLifecycleStartedRef.current = false;
      if (versionTimer) clearInterval(versionTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (readyNoticeTimer) clearTimeout(readyNoticeTimer);
    };
  }, [!!db, isOnline, session?.sessionToken]);

  useEffect(() => {
    if (!versionSyncReady) return;
    // Carrega dados do servidor ao abrir o app
    // ⚠️ SISTEMA DE SINCRONIZAÇÃO FINALIZADO v5.8.0 — Não alterar sem autorização do Pastor Wagner
    const loadFromServer = async () => {
      console.log('[Sync] 🔄 loadFromServer chamado | online:', navigator.onLine, '| fila:', getSyncQueue().length, '| rev:', serverRevisionRef.current);
      if (!navigator.onLine) return;
      if (pushInProgressRef.current) return;
      if (loadInProgressRef.current) return;

      // ═══ FASE 2 — MYSQL É A FONTE ÚNICA ═══
      // Se há itens na fila (edições feitas online que falharam o push),
      // envia primeiro. O pull abaixo traz o estado canônico do Supabase.
      if (getSyncQueue().length > 0) {
        await runPendingPush();
      }

      loadInProgressRef.current = true;
      try {
        // ═══ SNAPSHOT COMPLETO vs DELTA ═══
        // Puxa snapshot COMPLETO do Supabase quando:
        // 1. Primeira carga (initialSnapshotLoadedRef = false)
        // 2. Última sync > 2 minutos (dados potencialmente defasados)
        // 3. Sem revisão registrada (serverRevision = 0)
        // Isso GARANTE que todos os dispositivos mostrem os mesmos dados.
        // Snapshot completo só quando realmente necessário. Em uso normal,
        // trabalha exclusivamente com DELTA (somente o que mudou).
        const localReplicaMissing = !dbRef.current?.people?.length;
        const isStale = !initialSnapshotLoadedRef.current
          || !serverRevisionRef.current
          || localReplicaMissing;

        if (isStale) {
          // ═══ FULL SNAPSHOT — Supabase é a ÚNICA fonte de verdade ═══
          // Antes de substituir o estado local, garante que todas as
          // pendências da fila sejam enviadas com sucesso. Isso evita
          // perder criações/edições feitas localmente mas não sincronizadas.
          console.log('[Sync] ⬇ FULL SNAPSHOT: primeira carga ou dados >2min sem sync');
          
          // Força push de todas as pendências antes do snapshot
          const pendingQueue = getSyncQueue();
          if (pendingQueue.length > 0) {
            console.log(`[Sync] 🔄 Enviando ${pendingQueue.length} pendências antes do snapshot...`);
            try {
              await runPendingPushRef.current();
            } catch (pushErr) {
              console.warn('[Sync] Push pré-snapshot falhou, tentando novamente...', pushErr);
              // Tenta mais uma vez com delay
              await new Promise(r => setTimeout(r, 2000));
              try { await runPendingPushRef.current(); } catch {}
            }
          }
          
          const cloudData = await apiGetData();
          if (!cloudData || cloudData.error) return;
          if (cloudData.appVersion && isVersionNewer(cloudData.appVersion, APP_VERSION)) {
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              await Promise.all(registrations.map(registration => registration.update()));
            }
            console.warn('[VersionSync] Atualização disponível sem reload automático:', cloudData.appVersion); return;
            return;
          }
          const nextDb = applyPendingSyncOverlay(cloudPayloadToDatabase(cloudData));
          const nextRevision = Number(cloudData.server_revision || 0);
          
          // PRESERVA dados locais não sincronizados: se o usuário criou
          // algum registro local que ainda não foi aceito pelo servidor,
          // mantém-o no estado final para não perder trabalho. Também
          // preserva exclusões locais pendentes para que o snapshot não
          // restaure contatos que o usuário acabou de excluir.
          const currentDb = dbRef.current;
          if (currentDb) {
            const serverIds = new Set((nextDb.people || []).map((p: any) => String(p.id)));
            const pendingDeletes = new Set(
              getSyncQueue().filter(q => q.type === 'people' && q.operation === 'DELETE').map(q => q.itemId)
            );
            const localById = new Map<string, any>();
            for (const p of (currentDb.people || [])) {
              const id = String(p.id);
              // Criações locais pendentes (não existem no servidor)
              if (!serverIds.has(id) && !p.deleted) localById.set(id, p);
              // Exclusões locais pendentes (não deixar o snapshot restaurar)
              if (pendingDeletes.has(id) && p.deleted) localById.set(id, p);
            }
            if (localById.size > 0) {
              console.log(`[Sync] 🛡️ Preservando ${localById.size} registro(s) local(is) pendente(s)`);
              const merged = (nextDb.people || []).map(p => localById.get(String(p.id)) || p);
              const mergedIds = new Set(merged.map(p => String(p.id)));
              for (const [id, p] of localById) {
                if (!mergedIds.has(id)) merged.push(p);
              }
              nextDb.people = merged;
            }
          }
          
          setDb(nextDb);
          dbRef.current = nextDb;
          saveDB(nextDb);
          setServerRevision(nextRevision);
          serverRevisionRef.current = nextRevision;
          try { localStorage.setItem('pm_server_revision', String(nextRevision)); } catch {}
          initialSnapshotLoadedRef.current = true;
          setHasInitialServerSnapshot(true);
          const syncedAt = new Date().toISOString();
          setLastSyncedAt(syncedAt);
          try { localStorage.setItem('pm_last_synced_at', syncedAt); } catch {}
          console.log(`[Sync] ⬇ FULL OK: rev ${nextRevision} | pessoas: ${nextDb.people?.length || 0}`);
        } else {
          // ═══ DELTA INCREMENTAL — eficiente, só traz mudanças ═══
          const delta = await apiPullChanges(serverRevisionRef.current);
          if (!delta || delta.error) return;
          if (delta.appVersion && isVersionNewer(delta.appVersion, APP_VERSION)) {
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              await Promise.all(registrations.map(registration => registration.update()));
            }
            console.warn('[VersionSync] Atualização disponível sem reload automático:', delta.appVersion); return;
            return;
          }
          let nextDb = dbRef.current;
          let nextRevision = Number(delta.server_revision || serverRevisionRef.current);
          if (delta.reset_required) {
            console.log('[Sync] 🔄 RESET REQUIRED: baixando snapshot completo');
            const cloudData = await apiGetData();
            nextDb = applyPendingSyncOverlay(cloudPayloadToDatabase(cloudData));
            nextRevision = Number(cloudData.server_revision || 0);
          } else if (nextDb) {
            // Log detalhado das mudanças recebidas
            const changes = delta.changes || {};
            const changeSummary = Object.entries(changes).map(([entity, items]) => {
              const arr = Array.isArray(items) ? items : [];
              const creates = arr.filter((i: any) => !i.deleted && !i.version || i.version === 1).length;
              const updates = arr.filter((i: any) => !i.deleted && i.version > 1).length;
              const deletes = arr.filter((i: any) => i.deleted).length;
              return `${entity}: +${creates}/~${updates}/-${deletes}`;
            }).join(', ');
            console.log(`[Sync] 📊 Delta recebido: ${changeSummary || 'nenhuma mudança'} | rev ${nextRevision}`);
            
            nextDb = applyPendingSyncOverlay(applyServerDelta(nextDb, changes, delta.activity_log_count));
          }
          if (nextDb) {
            setDb(nextDb);
            dbRef.current = nextDb;
            saveDB(nextDb);
          }
          setServerRevision(nextRevision);
          serverRevisionRef.current = nextRevision;
          try { localStorage.setItem('pm_server_revision', String(nextRevision)); } catch {}
          initialSnapshotLoadedRef.current = true;
          setHasInitialServerSnapshot(true);
          const syncedAt = new Date().toISOString();
          setLastSyncedAt(syncedAt);
          try { localStorage.setItem('pm_last_synced_at', syncedAt); } catch {}
          const changedEntities = delta.changes ? Object.keys(delta.changes).filter(k => delta.changes[k]?.length > 0) : [];
          console.log(`[Sync] ⬇ DELTA: rev ${nextRevision} | ${delta.reset_required ? 'RESET' : 'delta'} | ${changedEntities.length > 0 ? changedEntities.join(', ') : 'sem mudanças'}`);
        }
        consecutiveFailuresRef.current = 0;
      } catch (e) {
        console.warn('[Polling] Falha ao buscar dados:', e);
        consecutiveFailuresRef.current++;
      } finally {
        loadInProgressRef.current = false;
      }
    };

    loadFromServerRef.current = loadFromServer;
    let timeoutId: any;
    const consecutiveFailuresRef = { current: 0 };
    const runPolling = async () => {
      await loadFromServer();
      // Realtime é imediato; polling de 30s é apenas fallback. Em falhas de rede,
      // aplica backoff; ao recuperar, retorna ao fallback padrão.
      const fails = consecutiveFailuresRef.current;
      // Polling inteligente: app em segundo plano usa 60s (economiza chamadas ao servidor)
      if (document.visibilityState === 'hidden') {
        timeoutId = setTimeout(runPolling, 60000);
        return;
      }
      let baseDelay = 30000;
      if (fails >= 6) baseDelay = 180000;
      else if (fails >= 5) baseDelay = 120000;
      else if (fails >= 4) baseDelay = 80000;
      else if (fails >= 3) baseDelay = 40000;
      else if (fails >= 2) baseDelay = 20000;
      else if (fails >= 1) baseDelay = 10000;
      timeoutId = setTimeout(runPolling, baseDelay);
    };

    runPolling();
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => {
      setIsOnline(true);
      setHasInitialServerSnapshot(isCurrentDataGenerationActive());
      // ═══ OFFLINE → ONLINE: push primeiro, depois pull ═══
      // Envia alterações pendentes da fila (feitas offline) antes de buscar dados novos.
      // Isso garante que edições offline cheguem ao Supabase antes do pull.
      if (getSyncQueue().length > 0) {
        console.log(`[Sync] 📡 Reconectou — ${getSyncQueue().length} alterações pendentes sendo enviadas`);
        runPendingPushRef.current().then(() => loadFromServer());
      } else {
        loadFromServer();
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    // Polling inteligente: ao voltar ao app (visible/focus), sincroniza imediatamente
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        if (loadFromServerRef.current) loadFromServerRef.current();
      }
    };
    const handleFocus = () => {
      if (navigator.onLine) {
        if (loadFromServerRef.current) loadFromServerRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [versionSyncReady]);

  // Realtime é o caminho principal da v8: o canal público recebe apenas o número
  // da revisão. Os dados reais continuam sendo baixados pelas RPCs autenticadas.
  useEffect(() => {
    if (!versionSyncReady || !session?.sessionToken) return;
    const unsubscribe = apiSubscribeToChanges((revision) => {
      if (!navigator.onLine) return;
      if (Number(revision || 0) <= serverRevisionRef.current) return;
      void loadFromServerRef.current?.();
    });
    return unsubscribe;
  }, [versionSyncReady, session?.sessionToken]);

  const [newPassword, setNewPassword] = useState<string>('');
  const [pwdError, setPwdError] = useState<string>('');

  
  // ⚠️ SISTEMA DE SINCRONIZAÇÃO FINALIZADO v5.8.0 — Não alterar version/updatedAt
  const findDeltas = <T extends { id?: string; month?: string; version?: number; updatedAt?: string; updatedBy?: string; deleted?: boolean | number }>(
    oldArr: T[] | undefined,
    newArr: T[] | undefined,
    sessionUser: string
  ): { modifiedArr: T[]; idsToQueue: string[] } => {
    if (!oldArr) oldArr = [];
    if (!newArr) newArr = [];
    const idsToQueue: string[] = [];
    const modifiedArr: T[] = [...newArr];
    const oldMap = new Map(oldArr.map(item => [item.id || item.month || '', item]));
    const newMap = new Map(newArr.map(item => [item.id || item.month || '', item]));
    
    for (let i = 0; i < modifiedArr.length; i++) {
      const newItem = modifiedArr[i];
      const pk = newItem.id || newItem.month || '';
      const oldItem = oldMap.get(pk);
      
      const cleanNew = { ...newItem, version: undefined, updatedAt: undefined, updatedBy: undefined };
      const cleanOld = oldItem ? { ...oldItem, version: undefined, updatedAt: undefined, updatedBy: undefined } : null;
      
      if (!oldItem || JSON.stringify(cleanOld) !== JSON.stringify(cleanNew)) {
        modifiedArr[i] = {
          ...newItem,
          version: (oldItem?.version || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: sessionUser
        };
        if (pk) idsToQueue.push(pk);
      }
    }
    
    // Check for physical deletions (items in oldArr not in newArr)
    for (const oldItem of oldArr) {
      const pk = oldItem.id || oldItem.month || '';
      if (!newMap.has(pk)) {
        const deletedItem = {
          ...oldItem,
          deleted: 1, // Soft delete
          version: (oldItem.version || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: sessionUser
        };
        modifiedArr.push(deletedItem);
        if (pk) idsToQueue.push(pk);
      }
    }
    
    return { modifiedArr, idsToQueue };
  };

  const resetPersonPassword = async (personId: string, newPassword?: string) => {
    if (!db) return;
    const plain = newPassword && newPassword.trim() ? newPassword.trim() : 'mudar123';
    const hashed = await hashPassword(plain);
    const newPeople = db.people.map(p => {
      if (p.id === personId) {
        return { ...p, password: hashed, passwordChanged: false };
      }
      return p;
    });
    updateDatabase({ ...db, people: newPeople });
    alert(`Senha ${plain === 'mudar123' ? "resetada para 'mudar123'" : "definida"} com sucesso.`);
  };

  // ⚠️ SISTEMA DE SINCRONIZAÇÃO FINALIZADO v5.8.0 — Não alterar version/updatedAt
  const updatePeople = (newPeople: Person[]) => {
    if (!db) return;
    
    const changedIds: string[] = [];
    let logMessage = '';
    
    // Não normalizar todos os cadastros ao editar uma pessoa.
    // O array recebido já contém exatamente o estado escolhido pelo usuário.
    const processedPeople = newPeople;
    
    processedPeople.forEach(p => {
      const oldP = db.people.find(op => op.id === p.id);
      if (!oldP) {
        changedIds.push(p.id);
        logMessage = `Cadastrou: ${p.name} (Cargo: ${p.role} | Depto: ${p.department.split(' ')[0]})`;
      } else if (JSON.stringify(oldP) !== JSON.stringify(p)) {
        changedIds.push(p.id);
        if (oldP.deleted !== p.deleted) {
          logMessage = p.deleted ? `Apagou (Lixeira) o cadastro de ${p.name}` : `Restaurou o cadastro de ${p.name}`;
        } else {
          const changes = [];
          if (oldP.name !== p.name) changes.push(`Nome para "${p.name}"`);
          if (oldP.role !== p.role) changes.push(`Cargo para "${p.role}"`);
          if (oldP.department !== p.department) changes.push(`Depto para "${p.department.split(' ')[0]}"`);
          if (oldP.phone !== p.phone) changes.push(`Telefone para "${p.phone}"`);
          if (oldP.status !== p.status) changes.push(`Status para "${p.status}"`);
          if (oldP.baptized !== p.baptized) changes.push(`Batismo`);
          if (oldP.address !== p.address) changes.push(`Endereço`);
          
          if (changes.length > 0) {
            logMessage = `Atualizou ${oldP.name}: ${changes.join(', ')}`;
          } else if (oldP.loginCount === p.loginCount && oldP.timeOnlineSeconds === p.timeOnlineSeconds) {
            logMessage = `Atualizou detalhes avançados do membro ${p.name}`;
          }
        }
      }
    });

    // Apply version control to changed items (increment version, set updatedAt/updatedBy)
    const versionedPeople = processedPeople.map(p => {
      if (changedIds.includes(p.id)) {
        const oldP = db.people.find(op => op.id === p.id);
        return {
          ...p,
          version: (oldP?.version || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: session?.personId || 'unknown'
        };
      }
      return p;
    });

    if (changedIds.length > 0) {
      if (logMessage && session) {
        updateDatabase({ ...db, people: versionedPeople }, true, false, logMessage);
      } else {
        updateDatabase({ ...db, people: versionedPeople });
      }
    }
  };

  // ⚠️ SISTEMA DE SINCRONIZAÇÃO FINALIZADO v5.8.0 — Não alterar version/updatedAt
  const updateDepartments = (newDepts: Department[]) => {
    if (!db) return;
    const oldDepts = db.departments || [];
    const changed = newDepts.filter(d => {
      const old = oldDepts.find(o => o.id === d.id);
      return !old || JSON.stringify(old) !== JSON.stringify(d);
    });
    const versionedDepts = newDepts.map(d => {
      if (changed.find(c => c.id === d.id)) {
        const old = oldDepts.find(o => o.id === d.id);
        return {
          ...d,
          version: (old?.version || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: session?.personId || 'unknown'
        };
      }
      return d;
    });
    if (changed.length > 0 && session) {
      updateDatabase({ ...db, departments: versionedDepts }, true, false, `Atualizou departamentos: ${changed.map(d => d.deleted ? `Excluiu "${d.name}"` : `Modificou "${d.name}"`).join(', ')}`);
    } else {
      updateDatabase({ ...db, departments: versionedDepts });
    }
  };

  // ⚠️ SISTEMA DE SINCRONIZAÇÃO FINALIZADO v5.8.0 — Não alterar version/updatedAt
  const updateAttendances = (newAttendances: AttendanceRecord[]) => {
    if (!db) return;
    const oldAtts = db.attendances || [];
    const versionedAtts = newAttendances.map(a => {
      const old = oldAtts.find(o => o.id === a.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(a)) {
        return {
          ...a,
          version: (old?.version || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: session?.personId || 'unknown'
        };
      }
      return a;
    });

    const changedAttendances = versionedAtts.filter(att => {
      const old = oldAtts.find(item => item.id === att.id);
      return !old || JSON.stringify(old) !== JSON.stringify(att);
    });

    // Uma única entrada de auditoria por chamada. Cada clique atualiza a mesma
    // linha (id determinístico), em vez de criar uma linha para cada presença.
    let consolidatedLogs = [...(db.activityLogs || [])];
    if (session) {
      const now = new Date().toISOString();
      changedAttendances.forEach(att => {
        const auditId = `audit-attendance-${att.id}`;
        const previousLog = consolidatedLogs.find(log => log.id === auditId);
        const [year, month, day] = String(att.date || '').split('-');
        const formattedDate = year && month && day ? `${day}/${month}/${year}` : att.date;
        const action = att.deleted
          ? `Excluiu chamada — ${att.department} — ${formattedDate}`
          : `Atualizou chamada — ${att.department} — ${formattedDate}`;
        const summary: ActivityLog = {
          id: auditId,
          recordedBy: session.personId || session.code,
          recordedByName: session.name,
          recordedByRole: session.role,
          action,
          details: att.deleted
            ? `${att.type || 'Culto'} • chamada removida`
            : `${att.type || 'Culto'} • ${(att.presentIds || []).length} presentes`,
          timestamp: now,
          version: (previousLog?.version || 0) + 1,
          updatedAt: now,
          updatedBy: session.personId || session.code,
        };
        consolidatedLogs = [summary, ...consolidatedLogs.filter(log => log.id !== auditId)];
      });
    }

    // isInteraction=false impede o log genérico "1 presença" a cada clique.
    updateDatabase({ ...db, attendances: versionedAtts, activityLogs: consolidatedLogs }, false);
  };

  // ⚠️ SISTEMA DE SINCRONIZAÇÃO FINALIZADO v5.8.0 — Não alterar version/updatedAt
  const updateGoals = (newGoals: MonthlyGoal[]) => {
    if (!db) return;
    const oldGoals = db.goals || [];
    const versionedGoals = newGoals.map(g => {
      const old = oldGoals.find(o => o.month === g.month);
      if (!old || JSON.stringify(old) !== JSON.stringify(g)) {
        return {
          ...g,
          version: (old?.version || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: session?.personId || 'unknown'
        };
      }
      return g;
    });
    if (session) {
      updateDatabase({ ...db, goals: versionedGoals }, true, false, `Atualizou metas mensais (${newGoals.length} registros)`);
    } else {
      updateDatabase({ ...db, goals: versionedGoals });
    }
  };

  // ⚠️ SISTEMA DE SINCRONIZAÇÃO FINALIZADO v5.8.0 — Não alterar version/updatedAt
  const updatePastoralLogs = (newLogs: PastoralLog[]) => {
    if (!db) return;
    const oldLogs = db.pastoralLogs || [];
    const versionedLogs = newLogs.map(l => {
      const old = oldLogs.find(o => o.id === l.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(l)) {
        return {
          ...l,
          version: (old?.version || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: session?.personId || 'unknown'
        };
      }
      return l;
    });
    updateDatabase({ ...db, pastoralLogs: versionedLogs });
  };

  // ⚠️ SISTEMA DE SINCRONIZAÇÃO FINALIZADO v5.8.0 — Não alterar version/updatedAt
  const updateWeeklyMissions = (newWeeklyMissions: WeeklyMission[]) => {
    if (!db) return;
    const oldMissions = db.weeklyMissions || [];
    const versionedMissions = newWeeklyMissions.map(m => {
      const old = oldMissions.find(o => o.id === m.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(m)) {
        return {
          ...m,
          version: (old?.version || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: session?.personId || 'unknown'
        };
      }
      return m;
    });
    if (session) {
      const pending = versionedMissions.filter(m => m.sentIds.length < m.targetCount).length;
      const completed = versionedMissions.filter(m => m.sentIds.length >= m.targetCount).length;
      updateDatabase({ ...db, weeklyMissions: versionedMissions }, true, false, `Atualizou missões semanais (${completed} concluídas, ${pending} pendentes)`);
    } else {
      updateDatabase({ ...db, weeklyMissions: versionedMissions });
    }
  };

  // ⚠️ SISTEMA DE SINCRONIZAÇÃO FINALIZADO v5.8.0 — Não alterar version/updatedAt
  const updateMessageHistory = (newHistory: Message[]) => {
    if (!db) return;
    const oldHistory = db.messageHistory || [];
    const versionedHistory = newHistory.map(h => {
      const old = oldHistory.find(o => o.id === h.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(h)) {
        return {
          ...h,
          version: (old?.version || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: session?.personId || 'unknown'
        };
      }
      return h;
    });
    updateDatabase({ ...db, messageHistory: versionedHistory });
  };

  // ⚠️ SISTEMA DE SINCRONIZAÇÃO FINALIZADO v5.8.0 — Não alterar version/updatedAt
  const updateChurchEvents = (newEvents: ChurchEvent[]) => {
    if (!db) return;
    const oldEvents = db.events || [];
    const versionedEvents = newEvents.map(e => {
      const old = oldEvents.find(o => o.id === e.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(e)) {
        return {
          ...e,
          version: (old?.version || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: session?.personId || 'unknown'
        };
      }
      return e;
    });
    if (session) {
      const now = new Date().toISOString();
      const oldMap = new Map(oldEvents.map(e => [e.id, e]));
      const eventLogs: ActivityLog[] = [];
      versionedEvents.forEach(e => {
        const old = oldMap.get(e.id);
        if (!old) {
          eventLogs.push({ id: 'log-' + generateUUID(), recordedBy: session.personId || session.code, recordedByName: session.name, recordedByRole: session.role, action: `Adicionou evento: ${e.title}`, details: `${e.date}${e.department ? ` • ${e.department}` : ''}`, timestamp: now });
        } else if (JSON.stringify(old) !== JSON.stringify(e)) {
          const action = e.deleted && !old.deleted ? `Excluiu evento: ${e.title}` : `Atualizou evento: ${e.title}`;
          eventLogs.push({ id: 'log-' + generateUUID(), recordedBy: session.personId || session.code, recordedByName: session.name, recordedByRole: session.role, action, details: `${e.date}${e.department ? ` • ${e.department}` : ''}`, timestamp: now });
        }
      });
      updateDatabase({ ...db, events: versionedEvents, activityLogs: [...eventLogs, ...(db.activityLogs || [])] }, true);
    } else {
      updateDatabase({ ...db, events: versionedEvents });
    }
  };

  const handleHardDeleteDept = (id: string, name: string) => {
    if (!db) return;
    // Move all people in this dept to empty string and soft-delete the dept
    const newPeople = db.people.map(p => {
      const isPrimary = p.department === name;
      const hasExtra = p.departments?.some(d => d.department === name);
      if (!isPrimary && !hasExtra) return p;
      return {
        ...p,
        department: isPrimary ? '' : p.department,
        departments: p.departments?.filter(d => d.department !== name) || []
      };
    });
    const newDepts = db.departments.map(d =>
      d.id === id ? { ...d, deleted: true } : d
    );
    updateDatabase({ ...db, departments: newDepts, people: newPeople });
  };

  const downloadAuditBackup = () => {
    if (!db) return;
    const now = new Date();
    const activities = db.activityLogs || [];
    const activityRows = activities.map(log => `
        <tr>
          <td>${log.timestamp}</td>
          <td>${log.recordedByName} (${log.recordedBy})</td>
          <td>${log.action}</td>
        </tr>
      `).join('');
    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Relatório de Auditoria Multiplica PLUS</title>
<style>
  body { font-family: Arial, sans-serif; color: #1f2937; }
  h1, h2 { color: #d94f00; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
  th, td { border: 1px solid #9ca3af; padding: 0.5rem; text-align: left; }
  th { background: #e0e7ff; }
  pre { background: #f3f4f6; padding: 0.75rem; border-radius: 8px; overflow-x: auto; }
</style>
</head>
<body>
  <h1>Relatório de Auditoria - Multiplica PLUS</h1>
  <p>Exportado em ${now.toLocaleString('pt-BR')}</p>
  <h2>Histórico de Atividades</h2>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Usuário</th>
        <th>Ação</th>
      </tr>
    </thead>
    <tbody>
      ${activityRows || '<tr><td colspan="3">Nenhum registro de auditoria encontrado.</td></tr>'}
    </tbody>
  </table>
  <h2>Resumo do Banco</h2>
  <p>Pessoas cadastradas: ${db.people.length}</p>
  <p>Departamentos: ${db.departments.length}</p>
  <p>Presenças registradas: ${db.attendances.length}</p>
  <p>Metas mensais: ${db.goals.length}</p>
  <p>Registros pastorais: ${db.pastoralLogs.length}</p>
  <h2>Backup completo</h2>
  <pre>${JSON.stringify(db, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `multiplica_plus_audit_report_${now.toISOString().replace(/[:.]/g, '-')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSwitchSessionDepartment = async (newDepartment: string | undefined) => {
    if (!session) return;
    const previousDepartment = session.department;
    const isRestrictedRole = session.role === 'Líder' || session.role === 'Multiplicador';

    // 8.2.2 — multi-departamento seguro: para Líder/Multiplicador, a troca
    // precisa ser validada também no Supabase. Assim snapshot/push passam a
    // usar o departamento realmente selecionado, não apenas o principal.
    if (isRestrictedRole) {
      try {
        const result = await apiSwitchDepartment(newDepartment);
        if (!result?.ok) throw new Error(result?.error || 'DEPARTMENT_SWITCH_FAILED');
      } catch (error) {
        console.warn('[8.2.2] Troca de departamento recusada pelo servidor:', error);
        alert('Não foi possível trocar de departamento. O acesso foi mantido no departamento anterior.');
        if (previousDepartment !== session.department) {
          const restored = { ...session, department: previousDepartment || undefined };
          setSession(restored);
          localStorage.setItem('multiplica_plus_session', JSON.stringify(restored));
        }
        return;
      }
    }

    const updatedSession = { ...session, department: newDepartment || undefined };
    setSession(updatedSession);
    localStorage.setItem('multiplica_plus_session', JSON.stringify(updatedSession));

    // Para perfis restritos, baixa snapshot completo do departamento recém
    // autorizado. Não altera Outbox/ACK/Realtime; apenas muda o contexto da sessão.
    if (isRestrictedRole && loadFromServerRef.current) {
      try { await loadFromServerRef.current(); }
      catch (error) { console.warn('[8.2.2] Departamento trocado; snapshot será atualizado pelo Realtime/pull:', error); }
    }
  };

  const handleLogout = () => {
    void apiLogout();
    setSession(null);
    localStorage.removeItem('multiplica_plus_session');
    setVersionSyncReady(false);
    setHasInitialServerSnapshot(false);
    initialSnapshotLoadedRef.current = false;
    versionLifecycleStartedRef.current = false;
  };

  const triggerManualSync = async () => {
    if (!navigator.onLine) {
      alert('Você está offline. Conecte-se à internet para sincronizar.');
      return;
    }
    if (!db || pushInProgressRef.current) return;
    if (getSyncQueue().length > 0) await runPendingPushRef.current();
    if (loadFromServerRef.current) await loadFromServerRef.current();
    lastPushTimeRef.current = Date.now();
  };

  const handleLogin = (userSession: UserSession) => {
    setSession(userSession);
    localStorage.setItem('multiplica_plus_session', JSON.stringify(userSession));
    setCurrentView('dashboard');

    if (!dbRef.current) return;

    // Registrar log de auditoria para o login
    const logEntry: ActivityLog = {
      id: 'log-login-' + generateUUID(),
      recordedBy: userSession.personId,
      recordedByName: userSession.name,
      recordedByRole: userSession.role,
      action: 'Realizou login',
      details: `O usuário ${userSession.name} realizou login no sistema.`,
      timestamp: new Date().toISOString()
    };

    // Incrementar o loginCount do usuário
    const updatedPeople = dbRef.current.people.map(p => {
      if (p.id === userSession.personId) {
        return {
          ...p,
          loginCount: (p.loginCount || 0) + 1,
          version: (p.version || 0) + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: userSession.personId
        };
      }
      return p;
    });

    const newLogs = [logEntry, ...(dbRef.current.activityLogs || [])];
    updateDatabase({ ...dbRef.current, people: updatedPeople, activityLogs: newLogs }, false);
  };
  const renderSyncIndicator = () => {
    // Bolinha de status: 🔴 offline | 🟠 sincronizando | 🟢 sincronizado
    const color = !isOnline ? '#ef4444' : isSyncing ? '#f97316' : '#22c55e';
    const tooltip = !isOnline ? 'Offline' : isSyncing ? 'Sincronizando...' : `Sincronizado (Rev. ${serverRevision || '—'})`;
    return (
      <div title={tooltip} onClick={triggerManualSync} style={{
        width: '12px', height: '12px', borderRadius: '50%', background: color,
        boxShadow: `0 0 6px ${color}`, cursor: 'pointer',
        transition: 'background 0.4s ease, box-shadow 0.4s ease'
      }} />
    );
  };

  const resetAllData = async () => {
    if (!db) return;
    if (window.confirm('Atenção: Isso limpará todo o histórico de presenças, contatos pastorais e cadastros locais. Deseja continuar?')) {
      const resetDB: AppDatabase = {
        people: db.people.filter(p => p.role !== 'Membro'), // Keep staff/leaders
        departments: db.departments,
        attendances: [],
        goals: db.goals,
        pastoralLogs: []
      };
      updateDatabase(resetDB);
      alert('Dados redefinidos com sucesso.');
    }
  };

  if (!db) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'var(--power-orange)',
        fontSize: '1.2rem',
        fontWeight: 'bold',
        fontFamily: 'sans-serif'
      }}>
        Inicializando o Multiplica PLUS...
      </div>
    );
  }

  if (!session) {
    return <LoginView db={db} onLogin={handleLogin} />;
  }

  if (!versionSyncReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.25rem', background: 'linear-gradient(145deg, #07172b 0%, #102a4f 100%)', color: '#fff' }}>
        <div role="status" aria-live="polite" style={{ width: 'min(480px, 100%)', padding: '1.6rem', borderRadius: '20px', background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.18)', textAlign: 'center', boxShadow: '0 22px 60px rgba(0,0,0,0.3)' }}>
          {isOnline
            ? <RefreshCw size={34} aria-hidden="true" style={{ color: '#f59e0b', animation: 'spin 1.2s linear infinite', marginBottom: '0.8rem' }} />
            : <CloudOff size={34} aria-hidden="true" style={{ color: '#f59e0b', marginBottom: '0.8rem' }} />}
          <h1 style={{ fontSize: '1.3rem', margin: '0 0 0.55rem' }}>Atualização segura {APP_VERSION}</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
            {versionNotice?.text || 'Preparando o banco oficial do Supabase.'}
          </p>
          <p style={{ margin: '1rem 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.58)' }}>
            {isOnline
              ? 'Não feche o aplicativo durante esta primeira conferência.'
              : 'A primeira abertura desta versão precisa de internet. Nenhum dado antigo será enviado.'}
          </p>
        </div>
      </div>
    );
  }

  if (session && isOnline && !hasInitialServerSnapshot) {
    return (
      <div style={{
        minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.25rem',
        background: 'linear-gradient(145deg, #07172b 0%, #102a4f 100%)', color: '#fff'
      }}>
        <div role="status" aria-live="polite" style={{
          width: 'min(440px, 100%)', padding: '1.5rem', borderRadius: '18px',
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.24)', textAlign: 'center'
        }}>
          <RefreshCw size={30} aria-hidden="true" style={{ color: '#f59e0b', animation: 'spin 1.2s linear infinite', marginBottom: '0.75rem' }} />
          <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>Validando o banco do Supabase</h1>
          <p style={{ margin: '0 0 1rem', color: 'rgba(255,255,255,0.76)', lineHeight: 1.55 }}>
            Enviando pendências e carregando o snapshot oficial do Supabase antes de abrir as telas.
          </p>
          <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-small" onClick={() => loadFromServerRef.current?.()}>
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Navigation Items
  const menuItems = [
    { id: 'inicio', label: 'Início', icon: <LayoutDashboard size={20} /> },
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'tutorial', label: 'Projeto & Tutorial', icon: <BookOpen size={20} /> },
    { id: 'agenda', label: 'Agenda', icon: <Calendar size={20} /> },
    { id: 'membros', label: 'Membros', icon: <Users size={20} /> },
    { id: 'presenca', label: 'Presença', icon: <Calendar size={20} /> },
    { id: 'aniversariantes', label: 'Aniversariantes', icon: <Cake size={20} /> },
    { id: 'radar', label: 'Radar Inteligente', icon: <AlertTriangle size={20} />, badge: true },
    { id: 'departamentos', label: 'Departamentos', icon: <Network size={20} /> },
    { id: 'missoes-especiais', label: 'Missões Especiais', icon: <Sparkles size={20} /> },
    { id: 'relatorios', label: 'Relatórios', icon: <BarChart3 size={20} /> },
    { id: 'configuracoes', label: 'Configurações', icon: <Settings size={20} /> },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (!activeSession) return true;
    if (item.id === 'departamentos' && (activeSession.role === 'Líder' || activeSession.role === 'Multiplicador')) {
      return false;
    }
    if (item.id === 'configuracoes' && (activeSession.role === 'Líder' || activeSession.role === 'Multiplicador')) {
      return false;
    }
    if (activeSession.role === 'Multiplicador') {
      if (item.id === 'radar' || item.id === 'relatorios' || item.id === 'missoes-especiais') {
        return false;
      }
    }
    // Only show special missions for Pastor, Secretary, and Leader
    if (item.id === 'missoes-especiais' && (activeSession.role === 'Multiplicador' || activeSession.role === 'Membro')) {
      return false;
    }
    return true;
  });

  // Admin Operations: Force Pull and Force Push
  const forcePullFromServer = async () => {
    if (!window.confirm("Atenção: isso irá baixar todos os dados oficiais do Supabase e substituir o cache local atual. Deseja continuar?")) return;
    if (!navigator.onLine) {
      alert("Você está offline. Conecte-se à internet para puxar os dados da nuvem.");
      return;
    }
    const hadPending = localStorage.getItem('pm_pending_sync') === 'true' || getSyncQueue().length > 0;
    if (hadPending) {
      alert('Este aparelho possui alteração offline pendente. Sincronize antes de substituir o cache pelo Supabase.');
      return;
    }
    setIsSyncing(true);
    try {
      const cloudData = await apiGetData();
      if (!cloudData || cloudData.error) throw new Error(cloudData?.error || 'Dados inválidos');
      const finalDB = cloudPayloadToDatabase(cloudData);
      setDb(finalDB);
      dbRef.current = finalDB;
      saveDB(finalDB);
      localStorage.removeItem('pm_sync_queue');
      localStorage.removeItem('pm_pending_sync');
      setHasPendingSync(false);
      const confirmedRevision = Number(cloudData.server_revision || 0);
      setServerRevision(confirmedRevision);
      serverRevisionRef.current = confirmedRevision;
      localStorage.setItem('pm_server_revision', String(confirmedRevision));
      initialSnapshotLoadedRef.current = true;
      setHasInitialServerSnapshot(true);
      const syncedAt = new Date().toISOString();
      setLastSyncedAt(syncedAt);
      localStorage.setItem('pm_last_synced_at', syncedAt);
      const activeCount = finalDB.people.filter(p => p.status === 'Ativo' && !p.deleted).length;
      alert(`Cache substituído pelo Supabase com sucesso. Membros ativos: ${activeCount}. Revisão: ${confirmedRevision}.`);
    } catch (e: any) {
      console.error(e);
      alert('Erro ao buscar os dados oficiais do Supabase: ' + (e?.message || 'falha de conexão'));
    } finally {
      setIsSyncing(false);
    }
  };

  const forcePushToServer = async () => {
    if (!navigator.onLine) {
      alert('Você está offline. Conecte-se à internet para enviar dados.');
      return;
    }
    if (getSyncQueue().length === 0) {
      alert('Não há alterações offline pendentes. O aparelho já está seguindo o Supabase.');
      if (loadFromServerRef.current) await loadFromServerRef.current();
      return;
    }
    if (!window.confirm('Enviar somente as alterações identificadas na fila offline e depois baixar o banco oficial do Supabase?')) return;
    await runPendingPush();
    if (getSyncQueue().length === 0) alert('Pendências confirmadas. O snapshot oficial do Supabase foi aplicado.');
  };

  // Calculate Radar badge alert count
  const getRadarCount = () => {
    if (!activeSession) return 0;
    const isRestricted = activeSession.role === 'Líder' || activeSession.role === 'Multiplicador';
    const deptFilter = isRestricted ? activeSession.department : undefined;

    const absentees = db.people.filter(p => {
      const isAtivo = p.status === 'Ativo' && !p.deleted;
      const matchesDept = !deptFilter || personInDepartment(p, deptFilter);
      if (!isAtivo || !matchesDept) return false;

      // Count absences
      const deptAttendances = db.attendances.filter(a => a.department === p.department);
      const sorted = [...deptAttendances].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      let count = 0;
      for (const rec of sorted) {
        if (rec.date < (p.startDate || '2026-01-01')) break;
        if (rec.presentIds.includes(p.id)) break;
        count++;
      }
      return count >= 1; // 1 or more absences triggers yellow/orange/red
    });

    return absentees.length;
  };

  const radarCount = getRadarCount();

  const renderView = () => {
    // If no session, always show LoginView
    if (!activeSession) {
      return <LoginView db={db} onLogin={setSession} />;
    }
    
    switch (currentView) {
      case 'inicio':
        return <InicioView db={db} session={activeSession} onNavigate={setCurrentView} onChangeDepartment={handleSwitchSessionDepartment} />;
      case 'dashboard':
        return <DashboardView db={db} session={activeSession} onNavigate={setCurrentView} onOpenQuickAdd={() => setQuickAddModal({ open: true, type: 'membro' })} onUpdateDatabase={updateDatabase} onChangeDepartment={handleSwitchSessionDepartment} />;
      case 'tutorial':
        return <TutorialView session={activeSession} />;
      case 'agenda':
        return <AgendaView db={db} session={activeSession} onUpdateDatabase={updateDatabase} />;
      case 'membros':
        return <PeopleListView db={db} session={activeSession} onUpdatePeople={updatePeople} onResetPassword={resetPersonPassword} initialDepartmentFilter={targetDepartmentFilter} onChangeDepartment={handleSwitchSessionDepartment} />;
      case 'presenca':
        return <AttendanceView db={db} session={activeSession} onUpdateAttendances={updateAttendances} initialDepartmentFilter={targetDepartmentFilter} />;
      case 'radar':
        return <RadarView db={db} session={activeSession} onUpdatePastoralLogs={updatePastoralLogs} />;
      case 'missoes-especiais':
        return <SpecialMissionsView db={db} session={activeSession} onUpdateDatabase={updateDatabase} />;
      case 'departamentos':
        return <DepartmentsView db={db} session={activeSession} onUpdateDepts={updateDepartments} onHardDeleteDept={handleHardDeleteDept} onNavigate={handleNavigate} />;
      case 'relatorios':
        return <ReportsView db={db} session={activeSession} />;
      case 'aniversariantes':
        return <BirthdaysView db={db} session={activeSession} />;
      case 'configuracoes':
        if (activeSession && (activeSession.role === 'Líder' || activeSession.role === 'Multiplicador')) {
          return <DashboardView db={db} session={activeSession} onNavigate={setCurrentView} onOpenQuickAdd={() => setQuickAddModal({ open: true, type: 'membro' })} onUpdateDatabase={updateDatabase} onChangeDepartment={handleSwitchSessionDepartment} />;
        }
        return (
          <SettingsView
            db={db}
            session={activeSession}
            onResetData={resetAllData}
            onUpdateGoals={updateGoals}
            onUpdateDatabase={updateDatabase}
            onForcePull={forcePullFromServer}
            onForcePush={forcePushToServer}
          />
        );
      default:
        return <DashboardView db={db} session={activeSession} onNavigate={setCurrentView} onOpenQuickAdd={() => setQuickAddModal({ open: true, type: 'membro' })} onUpdateDatabase={updateDatabase} onChangeDepartment={handleSwitchSessionDepartment} />;
    }
  };

  // Quick Add handler inside FAB Modal
  const handleQuickAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = fd.get('name') as string;
    const phone = fd.get('phone') as string;
    const isRestrictedDept = activeSession && (activeSession.role === 'Líder' || activeSession.role === 'Multiplicador');
    const department = isRestrictedDept ? (activeSession?.department || '') : (fd.get('department') as string);
    const role = activeSession?.role === 'Multiplicador' ? 'Membro' : (fd.get('role') as any);
    const address = fd.get('address') as string;
    const observations = fd.get('observations') as string;

    if (quickAddModal.type === 'membro') {
      if (!nome) return;
      
      const generateUsername = (r: string, n: string): string => {
        const clean = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
        const parts = clean.split(/\s+/);
        const first = parts[0] || '';
        const last = parts.length > 1 ? parts[parts.length - 1] : '';
        const prefix = r === 'Líder' ? 'LIDER' : r === 'Multiplicador' ? 'MULT' : r === 'Pastor' ? 'PASTOR' : r === 'Secretaria Geral' ? 'SEC' : 'USER';
        return last ? `${prefix}_${first}.${last}` : `${prefix}_${first}`;
      };

      const newPerson: Person = {
        id: 'p_' + generateUUID(),
        name: nome.trim(),
        phone: phone ? phone.replace(/\D/g, '') : '',
        department: department,
        role: role,
        startDate: getLocalDateISO(),
        status: 'Ativo',
        createdAt: getLocalDateISO(),
        address: address ? address.trim() : '',
        observations: observations ? observations.trim() : '',
        ...(role !== 'Membro' ? {
          username: generateUsername(role, nome),
          password: await hashPassword('mudar123'),
          passwordChanged: false
        } : {})
      };
      updatePeople([...db.people, newPerson]);
    } else {
      if (!nome || !phone) return;
      const newDept: Department = {
        id: 'd_' + generateUUID(),
        name: nome.trim(),
        description: phone.trim() // Treat phone box as description for department
      };
      updateDepartments([...db.departments, newDept]);
    }

    setQuickAddModal({ open: false, type: 'membro' });
  };

  return (
    <div className="app-container">
      <a className="skip-link" href="#main-content">Ir para o conteúdo principal</a>
      {versionNotice && (
        <div role="status" aria-live="polite" style={{
          position: 'fixed', top: '68px', left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
          maxWidth: 'min(92vw, 720px)', padding: '0.48rem 0.85rem', borderRadius: '999px',
          fontSize: '0.76rem', fontWeight: 700, textAlign: 'center',
          color: versionNotice.kind === 'warning' ? '#7c2d12' : versionNotice.kind === 'ready' ? '#065f46' : '#1e3a8a',
          background: versionNotice.kind === 'warning' ? '#ffedd5' : versionNotice.kind === 'ready' ? '#d1fae5' : '#dbeafe',
          border: `1px solid ${versionNotice.kind === 'warning' ? '#fb923c' : versionNotice.kind === 'ready' ? '#34d399' : '#60a5fa'}`,
          boxShadow: '0 8px 24px rgba(15,23,42,0.14)'
        }}>
          {versionNotice.text}
        </div>
      )}
      <SyncIndicator isSyncing={isSyncing} hasPendingSync={hasPendingSync} isOnline={isOnline} />
      {/* Animação spin movida para App.css */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Force password change modal overlay */}
      {forcePasswordChange && (
        <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '400px', animation: 'slideUp 0.3s ease-out', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0.5rem', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', width: '100%' }}>
                Alteração de Senha Obrigatória
              </h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--power-muted)', textAlign: 'center', marginBottom: '1.5rem' }}>
              Olá, <strong>{session?.name}</strong>! Este é seu primeiro acesso com a senha padrão. Por favor, defina uma nova senha segura para continuar.
            </p>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newPassword || newPassword.trim() === 'mudar123' || newPassword.trim().length < 4) {
                setPwdError('A senha deve ter pelo menos 4 caracteres e não pode ser a senha padrão "mudar123".');
                return;
              }
              if (!db || !session) return;
              (async () => {
                const hashed = await hashPassword(newPassword.trim());
                const updatedPeople = db.people.map(p => {
                  if (p.id === session.personId) {
                    return { ...p, password: hashed, passwordChanged: true };
                  }
                  return p;
                });
                updatePeople(updatedPeople);
                setForcePasswordChange(false);
                setPwdError('');
                alert('Senha alterada com sucesso! Bem-vindo ao Multiplica PLUS.');
              })();
            }}>
              <div className="form-group">
                <label>Nova Senha</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Defina sua nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              {pwdError && (
                <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 600 }}>
                  {pwdError}
                </p>
              )}
              <div style={{ marginTop: '2rem' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  Confirmar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 0. Top Bar for Desktop (white, fixed, professional layout) */}
      <header className="desktop-topbar">
        {/* Branding */}
        <div className="topbar-brand">
          <div className="topbar-logo">
            <img src="logo.png" alt="Multiplica Plus" />
          </div>
          <div className="topbar-title">
            <h1> Multiplica <span className="topbar-title-accent">PLUS</span> </h1>
            <span className="topbar-subtitle"> IEAD - JOTA <span className="topbar-version" title={lastSyncedAt ? `Última sincronização: ${new Date(lastSyncedAt).toLocaleString('pt-BR')}` : 'Aguardando primeira sincronização'}>{APP_VERSION} • {isOnline ? 'Supabase' : 'Offline'} {serverRevision || '—'}</span> </span>
          </div>
        </div>

        {/* Back to Início button — shown when not on inicio view */}
        {currentView !== 'inicio' && activeSession && (
          <button className="btn btn-secondary btn-small" onClick={() => { setTargetDepartmentFilter(undefined); setCurrentView('inicio'); }} >
            ← Início
          </button>
        )}

        {/* Actions */}
        <div className="topbar-actions">
          {/* Online box */}
          {onlineProfiles.length > 0 && (
            <div className="topbar-online">
              <span className="topbar-label">
                <span className="topbar-dot" /> {onlineProfiles.length} online
              </span>
              <div className="topbar-online-names">
                {onlineProfiles.slice(0, 3).map(p => (
                  <span key={p.id} className="badge badge-active">{p.name}</span>
                ))}
                {onlineProfiles.length > 3 && (
                  <span className="badge" style={{ background: 'var(--color-neutral-100)', color: 'var(--color-text-muted)', border: '1px solid var(--border-color)' }}>
                    +{onlineProfiles.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="topbar-divider" />

          {/* Department */}
          <div className="topbar-field">
            <span className="topbar-label">Departamento</span>
            {canUserSelectDepartment(activeSession, db) ? (
              <select
                value={activeSession?.department || ''}
                onChange={e => handleSwitchSessionDepartment(e.target.value)}
                className="form-control"
                title="Departamento ativo"
              >
                <option value="">GERAL</option>
                {getUserAllowedDepartments(activeSession, db).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            ) : (
              <span className="badge badge-active"> {activeSession?.department ? `Dept: ${activeSession.department}` : 'GERAL'} </span>
            )}
          </div>

          {/* Role */}
          <div className="topbar-field">
            <span className="topbar-label">Perfil</span>
            <span className="badge badge-active"> {activeSession?.role === 'Pastor Admin' || activeSession?.role === 'Pastor' ? 'Pr.' : activeSession?.role || ''} </span>
          </div>

          {/* Divider */}
          <div className="topbar-divider" />

          {/* Theme toggle (dia/noite) */}
          <button
            className="btn btn-icon btn-outline"
            onClick={handleToggleTheme}
            title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Chat button */}
          <button
            className="btn btn-primary btn-small"
            onClick={() => setChatOpen(!chatOpen)}
            title="Chat global"
          >
            <MessageCircle size={16} />
            <span>Chat ({onlineProfiles.length} online)</span>
          </button>

          {/* Quick Add */}
          {(activeSession?.role === 'Pastor Admin' || activeSession?.role === 'Pastor' || activeSession?.role === 'Secretaria Geral') && (
            <button
              className="btn btn-icon btn-primary"
              onClick={() => setShowAddMenu(!showAddMenu)}
              title="Adicionar"
            >
              <Plus size={16} />
            </button>
          )}

          {/* Logout */}
          <button
            className="btn btn-ghost btn-small"
            onClick={handleLogout}
            title="Sair"
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      </header>

      {/* 1. Sidebar for Desktop */}
      <aside className="sidebar" aria-label="Navegação principal">
        <ul className="sidebar-menu">
          {filteredMenuItems.map(item => (
            <li key={item.id}>
              <button
                type="button"
                className={`sidebar-link ${currentView === item.id ? 'active' : ''}`}
                onClick={() => setCurrentView(item.id)}
                aria-current={currentView === item.id ? 'page' : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && radarCount > 0 && (
                  <span 
                    className="badge badge-danger" 
                    style={{ 
                      marginLeft: 'auto', 
                      fontSize: '0.65rem',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '50px'
                    }}
                  >
                    {radarCount}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <div className="sidebar-user">
          <span className="sidebar-user-name">{session?.name || ''}</span>
          <span className="sidebar-user-role">{activeSession?.role || ''}</span>
          <button className="sidebar-logout" onClick={handleLogout}>
            <LogOut size={14} /> Sair
          </button>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-secondary btn-small"
              style={{ width: '100%', marginTop: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem' }}
              onClick={downloadAuditBackup}
            >
              Baixar Auditoria
            </button>
          )}
        </div>
      </aside>

      {/* 2. Top Header for Mobile */}
      <header className="mobile-header">
        <div className="mobile-header-brand">
          <img src="logo.png" alt="Multiplica Plus" />
          <div className="mobile-header-title">
            <h1>Multiplica PLUS</h1>
            <span>
              IEAD - JOTA <span className="mobile-header-version" title={lastSyncedAt ? `Última sincronização: ${new Date(lastSyncedAt).toLocaleString('pt-BR')}` : 'Aguardando primeira sincronização'}>{APP_VERSION} • {isOnline ? 'Supabase' : 'Offline'} {serverRevision || '—'}</span>
            </span>
          </div>
        </div>

        {/* Back to Início button — shown inline in header when not on inicio view */}
        {currentView !== 'inicio' && activeSession && (
          <button
            className="btn btn-secondary btn-small"
            onClick={() => {
              setTargetDepartmentFilter(undefined);
              setCurrentView('inicio');
            }}
          >
            ← Início
          </button>
        )}

        <div className="mobile-header-actions">
          {/* Theme Toggle Button (dia/noite) */}
          <button
            className="btn btn-icon btn-outline"
            onClick={handleToggleTheme}
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Chat Toggle Button */}
          <button
            className={`btn btn-icon ${chatOpen ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setChatOpen(!chatOpen)}
            title="Chat global"
          >
            <MessageSquare size={16} />
            {onlineProfiles.length > 0 && (
              <span className="mobile-badge-count">{onlineProfiles.length}</span>
            )}
          </button>

          {/* Quick Add Button (Pastor/Pastor Admin/Secretaria only) */}
          {(activeSession?.role === 'Pastor Admin' || activeSession?.role === 'Pastor' || activeSession?.role === 'Secretaria Geral') && (
            <button
              className={`btn btn-icon ${showAddMenu ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setShowAddMenu(!showAddMenu)}
              title="Adicionar"
            >
              <Plus size={16} />
            </button>
          )}

          {/* Quick Add Dropdown (appears below header when showAddMenu is true) */}
          {showAddMenu && (
            <div className="quick-add-menu">
              <button 
                className="btn btn-primary btn-small"
                onClick={() => {
                  setQuickAddModal({ open: true, type: 'membro' });
                  setShowAddMenu(false);
                }}
              >
                + Membro / Líder
              </button>
              {(activeSession?.role === 'Pastor Admin' || activeSession?.role === 'Pastor') && (
                <button 
                  className="btn btn-secondary btn-small"
                  onClick={() => {
                    setQuickAddModal({ open: true, type: 'departamento' });
                    setShowAddMenu(false);
                  }}
                >
                  + Departamento
                </button>
              )}
            </div>
          )}

          {canUserSelectDepartment(activeSession, db) && (
            <select
              value={activeSession?.department || ''}
              onChange={e => handleSwitchSessionDepartment(e.target.value)}
              className="mobile-dept-select"
            >
              <option value="">GERAL</option>
              {getUserAllowedDepartments(activeSession, db).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
          <span className="badge badge-active mobile-role-badge">
            {activeSession?.role === 'Pastor Admin' || activeSession?.role === 'Pastor' ? 'Pr.' : activeSession?.role || ''}
          </span>
          <button 
            className="btn btn-icon btn-ghost mobile-logout"
            onClick={handleLogout}
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* 3. Main View Area */}
      <main id="main-content" className="main-content" tabIndex={-1}>
        {/* Test Simulation Bar for Pastor Wagner */}
        {session?.code === 'PASTOR_WAGNER' && (
          <div className="test-mode-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="test-mode-badge">
                <Sparkles size={14} aria-hidden="true" /> Modo de Teste
              </span>
              <span>Olá, Pr. Wagner! Teste a visualização de outros perfis:</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="test-mode-label">Função:</span>
                <select 
                  value={emulatedRole || 'Pastor'} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'Pastor') {
                      setEmulatedRole(null);
                    } else {
                      setEmulatedRole(val as any);
                    }
                  }}
                  className="test-mode-select"
                >
                  <option value="Pastor">Pastor (Wagner)</option>
                  <option value="Pastor Admin">Pastor Admin</option>
                  <option value="Secretaria Geral">Secretaria Geral</option>
                  <option value="Líder">Líder de Departamento</option>
                  <option value="Multiplicador">Multiplicador</option>
                </select>
              </div>

              {/* Dept selector only for department-scoped roles (Líder / Multiplicador) */}
              {(emulatedRole === 'Líder' || emulatedRole === 'Multiplicador') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="test-mode-label">Depto:</span>
                  <select 
                    value={emulatedDept} 
                    onChange={(e) => setEmulatedDept(e.target.value)}
                    className="test-mode-select"
                  >
                    {getVisibleDepartments(db).map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {emulatedRole && (
                <button 
                  className="test-mode-reset"
                  onClick={() => {
                    setEmulatedRole(null);
                    setEmulatedDept('Novo Alvorecer (Jovens)');
                  }}
                >
                  Voltar ao Original
                </button>
              )}
            </div>
          </div>
        )}
        {renderView()}
      </main>

      {/* 4. Bottom Nav for Mobile — all items with horizontal scroll */}
      <nav className="mobile-nav" aria-label="Navegação móvel" style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none', justifyContent: 'flex-start', gap: '0.15rem', padding: '0 0.25rem' }}>
        <style>{`
          .mobile-nav::-webkit-scrollbar { display: none; }
          .mobile-nav-item { flex: 0 0 auto; min-width: 0; padding: 0.3rem 0.45rem; white-space: nowrap; }
        `}</style>
        {filteredMenuItems.map(item => (
          <button
            type="button"
            key={item.id}
            className={`mobile-nav-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => setCurrentView(item.id)}
            style={{ position: 'relative' }}
            aria-current={currentView === item.id ? 'page' : undefined}
          >
            {item.icon}
            <span>{item.label === 'Radar Inteligente' ? 'Radar' : item.label === 'Departamentos' ? 'Depts' : item.label === 'Aniversariantes' ? 'Aniv.' : item.label === 'Configurações' ? 'Config' : item.label === 'Relatórios' ? 'Relat.' : item.label === 'Projeto & Tutorial' ? 'Tutorial' : item.label}</span>
            {item.badge && radarCount > 0 && (
              <span 
                style={{ 
                  position: 'absolute', 
                  top: '2px', 
                  right: '10px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '14px',
                  height: '14px',
                  fontSize: '0.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}
              >
                {radarCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Global Chat Widget — controlled from header */}
      {activeSession && (
        <ChatWidget 
          db={db} 
          session={activeSession} 
          onUpdateDatabase={updateDatabase} 
          onlineProfiles={onlineProfiles} 
          isOpen={chatOpen}
          onToggle={() => setChatOpen(!chatOpen)}
        />
      )}
      {quickAddModal.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Adicionar {quickAddModal.type === 'membro' ? 'Pessoa / Função' : 'Departamento'}</h3>
              <button className="modal-close" onClick={() => setQuickAddModal({ open: false, type: 'membro' })}>&times;</button>
            </div>
            
            <form onSubmit={handleQuickAddSubmit}>
              <div className="form-group">
                <label>{quickAddModal.type === 'membro' ? 'Nome Completo' : 'Nome do Departamento'}</label>
                <input type="text" name="name" className="form-control" placeholder={quickAddModal.type === 'membro' ? 'Ex: João Silva' : 'Ex: Geração Eleita'} required />
              </div>
              
              <div className="form-group">
                <label>{quickAddModal.type === 'membro' ? 'Telefone (Opcional)' : 'Descrição'}</label>
                <input type="text" name="phone" className="form-control" placeholder={quickAddModal.type === 'membro' ? 'Ex: 69992345678' : 'Ex: Irmãos e Círculo Masculino'} required={quickAddModal.type !== 'membro'} />
              </div>

              {quickAddModal.type === 'membro' && (
                <>
                  <div className="form-group">
                    <label>Endereço (Opcional)</label>
                    <input type="text" name="address" className="form-control" placeholder="Ex: Rua das Flores, 123" />
                  </div>
                  
                  <div className="form-group">
                    <label>Observações / Detalhes (Opcional)</label>
                    <textarea name="observations" className="form-control" placeholder="Detalhes ou observações sobre o participante..." rows={2} />
                  </div>

                  <div className="form-group">
                    <label>Departamento</label>
                    {activeSession && (activeSession.role === 'Líder' || activeSession.role === 'Multiplicador') ? (
                      <input
                        type="text"
                        className="form-control"
                        value={activeSession.department || ''}
                        disabled
                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--power-muted)' }}
                      />
                    ) : (
                      <select name="department" className="form-control">
                        {getVisibleDepartments(db).map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label>Função</label>
                    <select name="role" className="form-control">
                      {activeSession?.role === 'Multiplicador' ? (
                        <option value="Membro">Membro Comum</option>
                      ) : activeSession?.role === 'Líder' ? (
                        <>
                          <option value="Membro">Membro Comum</option>
                          <option value="Multiplicador">Multiplicador</option>
                        </>
                      ) : (
                        <>
                          <option value="Membro">Membro Comum</option>
                          <option value="Líder">Líder de Departamento</option>
                          <option value="Multiplicador">Multiplicador</option>
                          {activeSession?.role === 'Pastor' && <option value="Pastor">Pastor Auxiliar</option>}
                        </>
                      )}
                    </select>
                  </div>
                </>
              )}
              
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setQuickAddModal({ open: false, type: 'membro' })}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Cadastro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
