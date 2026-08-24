-- Multiplica Plus 8.0 — núcleo Supabase
-- Mantém o formato de dados da v7.8.6, mas move a fonte de verdade para PostgreSQL.

create extension if not exists pgcrypto;

create sequence if not exists public.mp_revision_seq start with 1 increment by 1;

create table if not exists public.mp_entities (
  entity text not null,
  entity_id text not null,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text,
  revision bigint not null default nextval('public.mp_revision_seq'),
  primary key (entity, entity_id)
);

create index if not exists mp_entities_revision_idx on public.mp_entities(revision);
create index if not exists mp_entities_entity_revision_idx on public.mp_entities(entity, revision);
create index if not exists mp_people_username_idx
  on public.mp_entities ((upper(data->>'username')))
  where entity = 'people';

create table if not exists public.mp_sessions (
  token_hash text primary key,
  person_id text not null,
  role text not null,
  department text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  last_seen_at timestamptz not null default now()
);
create index if not exists mp_sessions_person_idx on public.mp_sessions(person_id);
create index if not exists mp_sessions_expiry_idx on public.mp_sessions(expires_at);

create table if not exists public.mp_operation_receipts (
  operation_id text primary key,
  entity text not null,
  entity_id text not null,
  person_id text,
  revision bigint,
  acknowledged_at timestamptz not null default now()
);

create table if not exists public.mp_system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.mp_system_settings(key, value)
values
  ('app_version', '"v8.0.0"'::jsonb),
  ('data_generation', '"supabase-master-v800-20260822"'::jsonb),
  ('schema_version', '11'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- O canal de Realtime não contém dados pessoais; ele só avisa que uma revisão mudou.
create table if not exists public.mp_realtime_signal (
  id smallint primary key default 1 check (id = 1),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.mp_realtime_signal(id, revision) values (1, 0)
on conflict (id) do nothing;

create or replace function public.mp_entity_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.revision := nextval('public.mp_revision_seq');
    if new.updated_at is null or new.updated_at = old.updated_at then
      new.updated_at := now();
    end if;
  elsif tg_op = 'INSERT' then
    if new.revision is null or new.revision <= 0 then
      new.revision := nextval('public.mp_revision_seq');
    end if;
    if new.updated_at is null then new.updated_at := now(); end if;
  end if;
  return new;
end;
$$;

drop trigger if exists mp_entities_before_write on public.mp_entities;
create trigger mp_entities_before_write
before insert or update on public.mp_entities
for each row execute function public.mp_entity_before_write();

create or replace function public.mp_entity_signal_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mp_realtime_signal
     set revision = new.revision, updated_at = now()
   where id = 1;
  return new;
end;
$$;

drop trigger if exists mp_entities_signal_after_write on public.mp_entities;
create trigger mp_entities_signal_after_write
after insert or update on public.mp_entities
for each row execute function public.mp_entity_signal_after_write();

create or replace function public.mp_hash_token(p_token text)
returns text
language sql
immutable
as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

create or replace function public.mp_merge_text_arrays(p_base jsonb, p_add jsonb, p_remove jsonb)
returns jsonb
language sql
immutable
as $$
  with values_union as (
    select value as v from jsonb_array_elements_text(coalesce(p_base, '[]'::jsonb))
    union
    select value as v from jsonb_array_elements_text(coalesce(p_add, '[]'::jsonb))
  ), removals as (
    select value as v from jsonb_array_elements_text(coalesce(p_remove, '[]'::jsonb))
  )
  select coalesce(jsonb_agg(v order by v), '[]'::jsonb)
  from values_union
  where v not in (select v from removals);
$$;

create or replace function public.mp_login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person public.mp_entities%rowtype;
  v_stored text;
  v_expected text;
  v_token text;
  v_role text;
  v_department text;
  v_safe_name text;
begin
  delete from public.mp_sessions where expires_at <= now();

  select * into v_person
  from public.mp_entities
  where entity = 'people'
    and deleted = false
    and upper(coalesce(data->>'username','')) = upper(trim(coalesce(p_username,'')))
    and coalesce(data->>'status','') = 'Ativo'
    and coalesce(data->>'role','Membro') <> 'Membro'
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'INVALID_CREDENTIALS');
  end if;

  v_stored := coalesce(v_person.data->>'password','');
  if left(v_stored, 7) = 'sha256$' then
    v_expected := 'sha256$' || encode(digest('mp$2026$' || trim(coalesce(p_password,'')), 'sha256'), 'hex');
    if v_expected <> v_stored then
      return jsonb_build_object('ok', false, 'error', 'INVALID_CREDENTIALS');
    end if;
  elsif v_stored <> trim(coalesce(p_password,'')) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_CREDENTIALS');
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_role := coalesce(v_person.data->>'role', 'Membro');
  v_department := case when v_role in ('Pastor Admin','Pastor','Secretaria Geral') then null else v_person.data->>'department' end;
  v_safe_name := coalesce(v_person.data->>'name', p_username);

  insert into public.mp_sessions(token_hash, person_id, role, department)
  values (public.mp_hash_token(v_token), v_person.entity_id, v_role, v_department);

  return jsonb_build_object(
    'ok', true,
    'sessionToken', v_token,
    'code', coalesce(v_person.data->>'username', v_person.entity_id),
    'role', v_role,
    'name', v_safe_name,
    'department', v_department,
    'personId', v_person.entity_id,
    'expiresAt', now() + interval '30 days'
  );
end;
$$;

create or replace function public.mp_logout(p_session_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.mp_sessions where token_hash = public.mp_hash_token(p_session_token);
  return true;
end;
$$;

create or replace function public.mp_session_person(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s public.mp_sessions%rowtype;
begin
  select * into v_s from public.mp_sessions
   where token_hash = public.mp_hash_token(p_session_token)
     and expires_at > now();
  if not found then return null; end if;
  update public.mp_sessions set last_seen_at = now() where token_hash = v_s.token_hash;
  return jsonb_build_object('personId', v_s.person_id, 'role', v_s.role, 'department', v_s.department);
end;
$$;

create or replace function public.mp_safe_payload(p_entity text, p_data jsonb, p_version bigint, p_deleted boolean, p_updated_at timestamptz, p_updated_by text)
returns jsonb
language sql
stable
as $$
  select
    (case when p_entity = 'people' then coalesce(p_data,'{}'::jsonb) - 'password' else coalesce(p_data,'{}'::jsonb) end)
    || jsonb_build_object(
      'version', coalesce(p_version,0),
      'deleted', coalesce(p_deleted,false),
      'updatedAt', p_updated_at,
      'updatedBy', p_updated_by
    );
$$;

create or replace function public.mp_get_snapshot(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_result jsonb;
  v_group record;
  v_revision bigint;
  v_activity_count bigint;
begin
  v_session := public.mp_session_person(p_session_token);
  if v_session is null then return jsonb_build_object('error','SESSION_INVALID'); end if;

  select coalesce(max(revision),0) into v_revision from public.mp_entities;
  select count(*) into v_activity_count from public.mp_entities where entity='activityLogs' and deleted=false;

  v_result := jsonb_build_object(
    'people','[]'::jsonb,
    'departments','[]'::jsonb,
    'attendances','[]'::jsonb,
    'goals','[]'::jsonb,
    'pastoralLogs','[]'::jsonb,
    'weeklyMissions','[]'::jsonb,
    'specialMissions','[]'::jsonb,
    'messageHistory','[]'::jsonb,
    'events','[]'::jsonb,
    'activityLogs','[]'::jsonb
  );

  for v_group in
    select entity,
           jsonb_agg(public.mp_safe_payload(entity,data,version,deleted,updated_at,updated_by) order by revision, entity_id) as items
    from public.mp_entities
    group by entity
  loop
    v_result := jsonb_set(v_result, array[v_group.entity], coalesce(v_group.items,'[]'::jsonb), true);
  end loop;

  return v_result || jsonb_build_object(
    'server_revision', v_revision,
    'activity_log_count', v_activity_count,
    'appVersion', 'v8.0.0',
    'dataGeneration', 'supabase-master-v800-20260822',
    'schemaVersion', 11
  );
end;
$$;

create or replace function public.mp_pull_changes(p_session_token text, p_since_revision bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_group record;
  v_revision bigint;
  v_activity_count bigint;
begin
  v_session := public.mp_session_person(p_session_token);
  if v_session is null then return jsonb_build_object('error','SESSION_INVALID'); end if;

  select coalesce(max(revision),0) into v_revision from public.mp_entities;
  select count(*) into v_activity_count from public.mp_entities where entity='activityLogs' and deleted=false;

  for v_group in
    select entity,
           jsonb_agg(public.mp_safe_payload(entity,data,version,deleted,updated_at,updated_by) order by revision, entity_id) as items
    from public.mp_entities
    where revision > greatest(coalesce(p_since_revision,0),0)
    group by entity
  loop
    v_changes := jsonb_set(v_changes, array[v_group.entity], coalesce(v_group.items,'[]'::jsonb), true);
  end loop;

  return jsonb_build_object(
    'changes', v_changes,
    'server_revision', v_revision,
    'activity_log_count', v_activity_count,
    'reset_required', false,
    'appVersion', 'v8.0.0'
  );
end;
$$;

create or replace function public.mp_sync_push(p_session_token text, p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_person_id text;
  v_op jsonb;
  v_operation_id text;
  v_entity text;
  v_entity_id text;
  v_operation text;
  v_patch jsonb;
  v_base_version bigint;
  v_existing public.mp_entities%rowtype;
  v_next_data jsonb;
  v_next_deleted boolean;
  v_next_version bigint;
  v_new_revision bigint;
  v_ack jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_server_revision bigint;
begin
  v_session := public.mp_session_person(p_session_token);
  if v_session is null then return jsonb_build_object('error','SESSION_INVALID'); end if;
  v_person_id := v_session->>'personId';

  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb)) <> 'array' then
    return jsonb_build_object('error','INVALID_OPERATIONS');
  end if;

  for v_op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb))
  loop
    v_operation_id := coalesce(v_op->>'operation_id', v_op->>'id');
    v_entity := v_op->>'entity';
    v_entity_id := v_op->>'entity_id';
    v_operation := upper(coalesce(v_op->>'operation','UPDATE'));
    v_patch := coalesce(v_op->'patch', '{}'::jsonb);
    v_base_version := greatest(coalesce((v_op->>'base_version')::bigint,0),0);

    if v_operation_id is null or v_entity_id is null or v_entity not in (
      'people','departments','attendances','goals','pastoralLogs','weeklyMissions',
      'specialMissions','messageHistory','events','activityLogs'
    ) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'operation_id', v_operation_id, 'code','INVALID_OPERATION'
      ));
      continue;
    end if;

    if exists(select 1 from public.mp_operation_receipts where operation_id=v_operation_id) then
      v_ack := v_ack || jsonb_build_array(v_operation_id);
      continue;
    end if;

    select * into v_existing
    from public.mp_entities
    where entity=v_entity and entity_id=v_entity_id
    for update;

    if found then
      if v_existing.version <> v_base_version then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'operation_id', v_operation_id,
          'code','BASE_VERSION_CONFLICT',
          'current_version',v_existing.version,
          'entity',v_entity,
          'entity_id',v_entity_id
        ));
        continue;
      end if;
      v_next_data := coalesce(v_existing.data,'{}'::jsonb);
      v_next_deleted := v_existing.deleted;
      v_next_version := v_existing.version + 1;
    else
      if v_base_version <> 0 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'operation_id', v_operation_id,
          'code','BASE_VERSION_CONFLICT',
          'current_version',0,
          'entity',v_entity,
          'entity_id',v_entity_id
        ));
        continue;
      end if;
      v_next_data := '{}'::jsonb;
      v_next_deleted := false;
      v_next_version := 1;
    end if;

    if v_entity = 'attendances' and (v_patch ? 'presentIdsAdd' or v_patch ? 'presentIdsRemove') then
      v_next_data := v_next_data || (v_patch - 'presentIdsAdd' - 'presentIdsRemove');
      v_next_data := jsonb_set(
        v_next_data,
        '{presentIds}',
        public.mp_merge_text_arrays(
          v_next_data->'presentIds',
          v_patch->'presentIdsAdd',
          v_patch->'presentIdsRemove'
        ),
        true
      );
    else
      v_next_data := v_next_data || v_patch;
    end if;

    if v_operation = 'DELETE' or coalesce((v_patch->>'deleted')::boolean,false) then
      v_next_deleted := true;
      v_next_data := v_next_data || jsonb_build_object('deleted',true);
    elsif v_patch ? 'deleted' and coalesce((v_patch->>'deleted')::boolean,false) = false then
      v_next_deleted := false;
      v_next_data := v_next_data || jsonb_build_object('deleted',false);
    end if;

    insert into public.mp_entities(entity,entity_id,data,version,deleted,updated_at,updated_by)
    values(v_entity,v_entity_id,v_next_data,v_next_version,v_next_deleted,now(),v_person_id)
    on conflict(entity,entity_id) do update set
      data=excluded.data,
      version=excluded.version,
      deleted=excluded.deleted,
      updated_at=excluded.updated_at,
      updated_by=excluded.updated_by
    returning revision into v_new_revision;

    insert into public.mp_operation_receipts(operation_id,entity,entity_id,person_id,revision)
    values(v_operation_id,v_entity,v_entity_id,v_person_id,v_new_revision)
    on conflict(operation_id) do nothing;

    v_ack := v_ack || jsonb_build_array(v_operation_id);
  end loop;

  select coalesce(max(revision),0) into v_server_revision from public.mp_entities;
  return jsonb_build_object(
    'acknowledged_operation_ids',v_ack,
    'errors',v_errors,
    'server_revision',v_server_revision
  );
end;
$$;

create or replace function public.mp_get_activity_logs(p_session_token text, p_offset integer default 0, p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_items jsonb;
  v_total bigint;
begin
  v_session := public.mp_session_person(p_session_token);
  if v_session is null then return jsonb_build_object('error','SESSION_INVALID'); end if;
  select count(*) into v_total from public.mp_entities where entity='activityLogs' and deleted=false;
  select coalesce(jsonb_agg(item),'[]'::jsonb) into v_items
  from (
    select public.mp_safe_payload(entity,data,version,deleted,updated_at,updated_by) as item
    from public.mp_entities
    where entity='activityLogs' and deleted=false
    order by coalesce(data->>'timestamp', updated_at::text) desc
    offset greatest(coalesce(p_offset,0),0)
    limit least(greatest(coalesce(p_limit,200),1),500)
  ) q;
  return jsonb_build_object('activityLogs',v_items,'total',v_total);
end;
$$;

-- Sem acesso direto aos dados pessoais: somente as RPCs SECURITY DEFINER acima.
revoke all on public.mp_entities from anon, authenticated;
revoke all on public.mp_sessions from anon, authenticated;
revoke all on public.mp_operation_receipts from anon, authenticated;
revoke all on public.mp_system_settings from anon, authenticated;

grant execute on function public.mp_login(text,text) to anon, authenticated;
grant execute on function public.mp_logout(text) to anon, authenticated;
grant execute on function public.mp_get_snapshot(text) to anon, authenticated;
grant execute on function public.mp_pull_changes(text,bigint) to anon, authenticated;
grant execute on function public.mp_sync_push(text,jsonb) to anon, authenticated;
grant execute on function public.mp_get_activity_logs(text,integer,integer) to anon, authenticated;

-- Bucket usado pelas missões/mídias. Uploads passam pela Edge Function autenticada.
insert into storage.buckets (id, name, public, file_size_limit)
values ('multiplica-media', 'multiplica-media', true, 52428800)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

-- Realtime seguro: conteúdo público = somente revisão/timestamp.
alter table public.mp_realtime_signal enable row level security;
drop policy if exists mp_realtime_signal_read on public.mp_realtime_signal;
create policy mp_realtime_signal_read on public.mp_realtime_signal
for select to anon, authenticated using (true);
grant select on public.mp_realtime_signal to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='mp_realtime_signal'
  ) then
    alter publication supabase_realtime add table public.mp_realtime_signal;
  end if;
end $$;
