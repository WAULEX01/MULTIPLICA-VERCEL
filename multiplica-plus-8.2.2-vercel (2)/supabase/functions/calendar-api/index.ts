import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || '';
  let body: any = {};
  if (req.method === 'POST') body = await req.json().catch(() => ({}));
  const token = String(url.searchParams.get('session_token') || body.session_token || '');

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: session } = await sb.rpc('mp_session_person', { p_session_token: token });
  if (!session?.personId) return Response.json({ error: 'SESSION_INVALID' }, { status: 401, headers: cors });

  if (action === 'get_settings') {
    const { data } = await sb.from('mp_system_settings').select('value').eq('key','google_calendar_url').maybeSingle();
    return Response.json({ status:'success', settings:{ googleCalendarUrl: data?.value?.url || '' } }, { headers: cors });
  }

  if (action === 'save_settings') {
    if (!['Pastor Admin','Pastor'].includes(String(session.role || ''))) {
      return Response.json({ error:'FORBIDDEN' }, { status:403, headers:cors });
    }
    const googleCalendarUrl = String(body.googleCalendarUrl || '').trim();
    const { error } = await sb.from('mp_system_settings').upsert({
      key:'google_calendar_url', value:{ url: googleCalendarUrl }, updated_at:new Date().toISOString()
    });
    if (error) return Response.json({ error:error.message }, { status:500, headers:cors });
    return Response.json({ status:'success' }, { headers:cors });
  }

  if (action === 'proxy_ics') {
    const { data } = await sb.from('mp_system_settings').select('value').eq('key','google_calendar_url').maybeSingle();
    const calendarUrl = String(data?.value?.url || '');
    if (!calendarUrl) return new Response('', { status:404, headers:cors });
    let parsed: URL;
    try { parsed = new URL(calendarUrl); } catch { return new Response('URL inválida', { status:400, headers:cors }); }
    if (parsed.protocol !== 'https:' || !['calendar.google.com','www.google.com'].includes(parsed.hostname)) {
      return new Response('Domínio de calendário não permitido', { status:400, headers:cors });
    }
    const remote = await fetch(calendarUrl, { redirect:'follow' });
    if (!remote.ok) return new Response('Falha ao buscar calendário', { status:502, headers:cors });
    return new Response(await remote.text(), {
      status:200,
      headers:{ ...cors, 'Content-Type':'text/calendar; charset=utf-8', 'Cache-Control':'no-store' }
    });
  }

  return Response.json({ error:'UNKNOWN_ACTION' }, { status:404, headers:cors });
});
