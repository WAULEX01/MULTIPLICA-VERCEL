import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

const ENV_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ENV_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const SUPABASE_URL = ENV_SUPABASE_URL || 'https://qaaijdopbuhcfsuvtaew.supabase.co';
const SUPABASE_KEY = ENV_SUPABASE_KEY || 'sb_publishable_jqKFclSXPITDiphTOSeAjA_G74oCrQd';

export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('placeholder'));

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

export const getMultiplicaSessionToken = (): string => {
  try {
    const raw = localStorage.getItem('multiplica_plus_session');
    if (!raw) return '';
    return JSON.parse(raw)?.sessionToken || '';
  } catch {
    return '';
  }
};

export const assertSessionToken = () => {
  const token = getMultiplicaSessionToken();
  if (!token) throw new Error('SESSION_INVALID');
  return token;
};

export const subscribeToRevisionSignal = (onRevision: (revision: number) => void): RealtimeChannel => {
  return supabase
    .channel('multiplica-v8-revision')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'mp_realtime_signal' },
      payload => {
        const revision = Number((payload.new as any)?.revision || 0);
        onRevision(revision);
      },
    )
    .subscribe();
};
