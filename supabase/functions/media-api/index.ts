import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async req => {
  if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  const form = await req.formData();
  const token = String(form.get('session_token') || '');
  const file = form.get('media');
  const mediaType = String(form.get('media_type') || 'image');
  if (!(file instanceof File) || !token) return Response.json({ error: 'invalid_payload' }, { status: 400 });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: session, error: sessionError } = await sb.rpc('mp_session_person', { p_session_token: token });
  if (sessionError || !session?.personId) return Response.json({ error: 'SESSION_INVALID' }, { status: 401 });

  const ext = (file.name.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'jpg')).replace(/[^a-zA-Z0-9]/g,'');
  const path = `${mediaType}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await sb.storage.from('multiplica-media').upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 });
  const { data: pub } = sb.storage.from('multiplica-media').getPublicUrl(path);
  return Response.json({ url: pub.publicUrl, type: mediaType });
});
