import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Função temporária de migração. Depois da importação ela deve ser substituída por uma versão desativada.
const LEGACY_URL = 'https://multiplicaplus.com.br/api.php?action=get_data';
const LEGACY_API_KEY = Deno.env.get('MP_LEGACY_API_KEY') || '__LEGACY_API_KEY__';
const MIGRATION_TOKEN = Deno.env.get('MP_MIGRATION_TOKEN') || '__MIGRATION_TOKEN__';

const collections = [
  'people','departments','attendances','goals','pastoralLogs','weeklyMissions',
  'specialMissions','messageHistory','events','activityLogs'
];

Deno.serve(async req => {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('token') !== MIGRATION_TOKEN || MIGRATION_TOKEN.startsWith('__')) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (LEGACY_API_KEY.startsWith('__')) return Response.json({ error: 'legacy key not configured' }, { status: 500 });

    const legacy = await fetch(LEGACY_URL + '&_t=' + Date.now(), {
      headers: {
        'X-API-Key': LEGACY_API_KEY,
        'X-Client-Version': 'v7.8.6',
        'X-Data-Generation': 'hostinger-master-v750-20260818',
        'X-Device-Id': 'supabase-migration-v8',
      },
    });
    if (!legacy.ok) return Response.json({ error: `legacy_http_${legacy.status}` }, { status: 502 });
    const snapshot = await legacy.json();
    if (snapshot?.error) return Response.json({ error: snapshot.error }, { status: 502 });

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    if (url.searchParams.get('replace') === '1') {
      const { error: delErr } = await sb.from('mp_entities').delete().neq('entity', '__never__');
      if (delErr) throw delErr;
    }

    const counts: Record<string, number> = {};
    for (const entity of collections) {
      const source = Array.isArray(snapshot?.[entity]) ? snapshot[entity] : [];
      counts[entity] = source.length;
      if (!source.length) continue;
      const rows = source.map((item: any) => ({
        entity,
        entity_id: String(item.id ?? item.month),
        data: item,
        version: Math.max(1, Number(item.version || 1)),
        deleted: item.deleted === true || item.deleted == 1,
        updated_at: item.updatedAt || new Date().toISOString(),
        updated_by: item.updatedBy || 'hostinger-migration-v8',
      }));
      for (let i=0; i<rows.length; i+=250) {
        const { error } = await sb.from('mp_entities').upsert(rows.slice(i,i+250), { onConflict: 'entity,entity_id' });
        if (error) throw error;
      }
    }

    const { data: revRow } = await sb.from('mp_realtime_signal').select('revision').eq('id',1).single();
    return Response.json({ ok: true, counts, revision: revRow?.revision || 0, source_revision: snapshot?.server_revision || 0 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
});
