import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const esc = (value: unknown) => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/\r?\n/g, '\\n')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;');

const icsDate = (input: unknown) => {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/-/g, '');
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
};

Deno.serve(async req => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await sb
      .from('mp_entities')
      .select('entity_id,data,updated_at')
      .eq('entity', 'events')
      .eq('deleted', false);
    if (error) throw error;

    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'PRODID:-//Multiplica Plus//Agenda 8.0//PT-BR',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:Multiplica Plus - IEAD JK',
    ];

    for (const row of data || []) {
      const e: any = row.data || {};
      const start = icsDate(e.startDateTime || e.start || e.date);
      if (!start) continue;
      const end = icsDate(e.endDateTime || e.endDate || e.end);
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${esc(e.id || row.entity_id)}@multiplicaplus`);
      lines.push(`DTSTAMP:${icsDate(row.updated_at || new Date().toISOString())}`);
      lines.push(/^\d{8}$/.test(start) ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`);
      if (end) lines.push(/^\d{8}$/.test(end) ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`);
      lines.push(`SUMMARY:${esc(e.title || e.name || 'Evento')}`);
      if (e.description || e.notes) lines.push(`DESCRIPTION:${esc(e.description || e.notes)}`);
      if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');

    return new Response(lines.join('\r\n') + '\r\n', {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="multiplica-plus.ics"',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error(err);
    return new Response('Falha ao gerar calendário', { status: 500 });
  }
});
