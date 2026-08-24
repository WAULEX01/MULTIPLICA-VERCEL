-- Já aplicada no projeto Supabase multiplica-plus-8 em 23/08/2026.
-- Mantida no pacote apenas para auditoria/reprodutibilidade.
create or replace function public.mp_switch_department(p_session_token text, p_department text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_hash text;
  v_s public.mp_sessions%rowtype;
  v_person public.mp_entities%rowtype;
  v_requested text := nullif(btrim(coalesce(p_department,'')), '');
begin
  v_hash := public.mp_hash_token(p_session_token);
  select * into v_s from public.mp_sessions
   where token_hash = v_hash and expires_at > now();
  if not found then return jsonb_build_object('ok',false,'error','SESSION_INVALID'); end if;

  if v_s.role in ('Pastor Admin','Pastor','Secretaria Geral') then
    update public.mp_sessions set last_seen_at = now() where token_hash = v_hash;
    return jsonb_build_object('ok',true,'department',v_requested,'global',true);
  end if;

  if v_requested is null then return jsonb_build_object('ok',false,'error','DEPARTMENT_REQUIRED'); end if;

  select * into v_person from public.mp_entities
   where entity='people' and entity_id=v_s.person_id and deleted=false limit 1;
  if not found then return jsonb_build_object('ok',false,'error','PERSON_NOT_FOUND'); end if;

  if not public.mp_person_in_department(v_person.data, v_requested) then
    return jsonb_build_object('ok',false,'error','DEPARTMENT_FORBIDDEN');
  end if;

  update public.mp_sessions
     set department = v_requested, last_seen_at = now()
   where token_hash = v_hash;
  return jsonb_build_object('ok',true,'department',v_requested,'global',false);
end;
$function$;
