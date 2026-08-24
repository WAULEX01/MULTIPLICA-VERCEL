// Multiplica Plus 8.1 — Supabase adapter.
// Mantém a mesma interface usada pelas views da v7.8.6 para preservar o layout.
import { APP_VERSION, DATA_GENERATION, getOrCreateDeviceId } from './release';
import { assertSessionToken, getMultiplicaSessionToken, isSupabaseConfigured, subscribeToRevisionSignal, supabase } from './supabase';

// Compatibilidade temporária com imports antigos. A v8 NÃO usa chave compartilhada de API.
export const API_KEY = '';

export interface PatchPushOperation {
  id: string;
  type: string;
  itemId: string;
  patch?: Record<string, any>;
  data?: Record<string, any>;
  baseVersion?: number;
  operation?: 'CREATE' | 'UPDATE' | 'DELETE';
  timestamp: string;
  deviceId?: string;
}

const rpc = async <T = any>(fn: string, args: Record<string, any>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message || `Falha em ${fn}`);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
};

export async function apiLogin(username: string, password: string) {
  if (!isSupabaseConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const result = await rpc<any>('mp_login', { p_username: username, p_password: password });
  if (!result?.ok) return null;
  return {
    code: result.code,
    role: result.role,
    name: result.name,
    department: result.department || undefined,
    personId: result.personId,
    sessionToken: result.sessionToken,
  };
}


export async function apiSwitchDepartment(department?: string) {
  return rpc<any>('mp_switch_department', {
    p_session_token: assertSessionToken(),
    p_department: department || null,
  });
}

export async function apiLogout() {
  const token = getMultiplicaSessionToken();
  if (!token) return;
  try { await rpc('mp_logout', { p_session_token: token }); } catch {}
}

export async function apiGetData(_sinceRevision?: number) {
  return rpc<any>('mp_get_snapshot', { p_session_token: assertSessionToken() });
}

export async function apiPushPatches(items: PatchPushOperation[]) {
  if (items.length === 0) return { acknowledged_operation_ids: [], errors: [], server_revision: 0 };
  const operations = items.map(item => ({
    operation_id: item.id,
    entity: item.type,
    entity_id: item.itemId,
    operation: item.operation || 'UPDATE',
    patch: item.patch || item.data || {},
    base_version: Number(item.baseVersion || 0),
    updated_at: item.timestamp,
    updated_by: item.data?.updatedBy || item.deviceId || getOrCreateDeviceId(),
    device_id: item.deviceId || getOrCreateDeviceId(),
  }));
  return rpc<any>('mp_sync_push', {
    p_session_token: assertSessionToken(),
    p_operations: operations,
  });
}

export async function apiPullChanges(sinceRevision: number) {
  return rpc<any>('mp_pull_changes', {
    p_session_token: assertSessionToken(),
    p_since_revision: Math.max(0, Number(sinceRevision || 0)),
  });
}

export async function apiGetVersionInfo() {
  return { appVersion: APP_VERSION, dataGeneration: DATA_GENERATION, schemaVersion: 11 };
}

export async function apiReconcileCache(_payload: any) {
  // A v8 não envia snapshots locais ao servidor. Supabase é a fonte única de verdade.
  return { ok: true, mode: 'supabase-canonical' };
}

export async function apiGetActivityLogs(offset: number, limit = 200): Promise<any> {
  return rpc<any>('mp_get_activity_logs', {
    p_session_token: assertSessionToken(),
    p_offset: Math.max(0, offset || 0),
    p_limit: Math.max(1, Math.min(limit || 200, 500)),
  });
}

const saveBatch = async (entity: string, items: any[], pk: 'id' | 'month' = 'id') => {
  if (!items.length) return { acknowledged_operation_ids: [] };
  const now = new Date().toISOString();
  return apiPushPatches(items.map((item, index) => ({
    id: `direct-${entity}-${item[pk]}-${Date.now()}-${index}`,
    type: entity,
    itemId: String(item[pk]),
    data: item,
    patch: item,
    baseVersion: Math.max(0, Number(item.version || 1) - 1),
    operation: item.deleted ? 'DELETE' : (Number(item.version || 1) <= 1 ? 'CREATE' : 'UPDATE'),
    timestamp: item.updatedAt || now,
  })));
};

export async function apiSavePeople(items: any[]) { return saveBatch('people', items); }
export async function apiSaveDepartments(items: any[]) { return saveBatch('departments', items); }
export async function apiSaveAttendances(items: any[]) { return saveBatch('attendances', items); }
export async function apiSaveGoals(items: any[]) { return saveBatch('goals', items, 'month'); }
export async function apiSavePastoralLogs(items: any[]) { return saveBatch('pastoralLogs', items); }
export async function apiSaveWeeklyMissions(items: any[]) { return saveBatch('weeklyMissions', items); }
export async function apiSaveSpecialMissions(items: any[]) { return saveBatch('specialMissions', items); }
export async function apiSaveMessageHistory(items: any[]) { return saveBatch('messageHistory', items); }
export async function apiSaveChurchEvents(items: any[]) { return saveBatch('events', items); }
export async function apiSaveActivityLogs(items: any[]) { return saveBatch('activityLogs', items); }

export async function apiUploadMedia(file: File, mediaType: 'image' | 'video'): Promise<{ url: string; type: string }> {
  const functionUrl = import.meta.env.VITE_SUPABASE_MEDIA_FUNCTION_URL || '';
  if (!functionUrl) throw new Error('Upload de mídia ainda não configurado no ambiente Supabase.');
  const form = new FormData();
  form.append('media', file);
  form.append('media_type', mediaType);
  form.append('session_token', assertSessionToken());
  const res = await fetch(functionUrl, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export async function apiDownloadServerBackup(): Promise<void> {
  const snapshot = await apiGetData();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `multiplica-plus-v8-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function apiSubscribeToChanges(onRevision: (revision: number) => void) {
  const channel = subscribeToRevisionSignal(onRevision);
  return () => { void supabase.removeChannel(channel); };
}

export function findChanged<T extends { id?: string; month?: string; deleted?: boolean | number; version?: number; updatedAt?: string; updatedBy?: string }>(
  oldArr: T[] = [], newArr: T[] = [], pk = 'id'
): T[] {
  const oldMap = new Map(oldArr.map((item: any) => [item[pk], item]));
  return newArr.filter((item: any) => {
    const old = oldMap.get(item[pk]);
    return !old || JSON.stringify(old) !== JSON.stringify(item);
  });
}

export async function apiPushChanges(oldDb: any, newDb: any): Promise<string[]> {
  const configs: Array<[string, string, 'id' | 'month']> = [
    ['people','people','id'], ['departments','departments','id'], ['attendances','attendances','id'],
    ['goals','goals','month'], ['pastoralLogs','pastoralLogs','id'], ['weeklyMissions','weeklyMissions','id'],
    ['specialMissions','specialMissions','id'], ['messageHistory','messageHistory','id'],
    ['events','events','id'], ['activityLogs','activityLogs','id'],
  ];
  const touched: string[] = [];
  for (const [entity,key,pk] of configs) {
    const changed = findChanged(oldDb?.[key] || [], newDb?.[key] || [], pk);
    if (changed.length) {
      await saveBatch(entity, changed, pk);
      touched.push(entity);
    }
  }
  return touched;
}

export const SYNC_QUEUE_SAVERS: Record<string, (items: any[]) => Promise<any>> = {
  people: apiSavePeople,
  departments: apiSaveDepartments,
  attendances: apiSaveAttendances,
  goals: apiSaveGoals,
  pastoralLogs: apiSavePastoralLogs,
  weeklyMissions: apiSaveWeeklyMissions,
  specialMissions: apiSaveSpecialMissions,
  messageHistory: apiSaveMessageHistory,
  events: apiSaveChurchEvents,
  activityLogs: apiSaveActivityLogs,
};

const calendarFunctionUrl = () => import.meta.env.VITE_SUPABASE_CALENDAR_FUNCTION_URL || '';

export async function apiGetCalendarSettings() {
  const base = calendarFunctionUrl();
  if (!base) return { status: 'success', settings: { googleCalendarUrl: '' } };
  const url = new URL(base);
  url.searchParams.set('action','get_settings');
  url.searchParams.set('session_token', assertSessionToken());
  const res = await fetch(url.toString(), { cache:'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export async function apiSaveCalendarSettings(googleCalendarUrl: string) {
  const base = calendarFunctionUrl();
  if (!base) throw new Error('Integração de agenda ainda não configurada no Supabase.');
  const url = new URL(base);
  url.searchParams.set('action','save_settings');
  const res = await fetch(url.toString(), {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ session_token:assertSessionToken(), googleCalendarUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export async function apiProxyIcs() {
  const base = calendarFunctionUrl();
  if (!base) throw new Error('Integração de agenda ainda não configurada no Supabase.');
  const url = new URL(base);
  url.searchParams.set('action','proxy_ics');
  url.searchParams.set('session_token', assertSessionToken());
  const res = await fetch(url.toString(), { cache:'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

