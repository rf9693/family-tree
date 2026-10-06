-- Schema, row level security and integrity rules for «Древо рода».
-- Idempotent: safe to run on an existing project (Supabase Dashboard → SQL Editor → Run).
-- Set the owner e-mail below before running.

-- ───────────────────────── Tables ─────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

create table if not exists public.persons (
  id text primary key,
  first_name text not null default '',
  last_name text not null default '',
  birth_date text,
  death_date text,
  birth_place text,
  gender text not null default 'unknown',
  notes text,
  privacy text not null default 'public',
  photo_url text,
  x double precision not null default 0,
  y double precision not null default 0,
  is_me boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.relations (
  id text primary key,
  type text not null,
  source_id text not null,
  target_id text not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  user_name text,
  action text not null,
  entity_id text,
  entity_name text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- Columns that older versions of the tables may lack.
alter table public.persons add column if not exists photo_url text;
alter table public.persons add column if not exists is_me boolean not null default false;
alter table public.persons add column if not exists created_by uuid;
alter table public.persons add column if not exists updated_at timestamptz not null default now();
alter table public.relations add column if not exists created_by uuid;

-- Relations are deleted together with the people they connect.
delete from public.relations r
where not exists (select 1 from public.persons p where p.id = r.source_id)
   or not exists (select 1 from public.persons p where p.id = r.target_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'relations_source_id_fkey') then
    alter table public.relations
      add constraint relations_source_id_fkey foreign key (source_id) references public.persons (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'relations_target_id_fkey') then
    alter table public.relations
      add constraint relations_target_id_fkey foreign key (target_id) references public.persons (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'relations_type_check') then
    alter table public.relations
      add constraint relations_type_check check (type in ('parent-child', 'spouse', 'sibling')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('owner', 'member')) not valid;
  end if;
end $$;

create index if not exists relations_source_id_idx on public.relations (source_id);
create index if not exists relations_target_id_idx on public.relations (target_id);
create index if not exists history_created_at_idx on public.history (created_at desc);

-- ───────────────────────── Helpers ─────────────────────────
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

-- Profile for every new user; the owner is decided here, not in the browser.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when lower(new.email) = lower('rf9339945@gmail.com') then 'owner' else 'member' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only the owner may change roles; the e-mail of a profile is not editable.
-- Requests without a user (SQL Editor, service role) are trusted.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_owner() then
    new.role := old.role;
  end if;
  if auth.uid() is not null then
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- created_by is fixed at insert time and never changes.
create or replace function public.keep_created_by()
returns trigger
language plpgsql
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

drop trigger if exists keep_created_by on public.persons;
create trigger keep_created_by before update on public.persons
  for each row execute function public.keep_created_by();

drop trigger if exists keep_created_by on public.relations;
create trigger keep_created_by before update on public.relations
  for each row execute function public.keep_created_by();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_updated_at on public.persons;
create trigger touch_updated_at before update on public.persons
  for each row execute function public.touch_updated_at();

-- Make sure the owner account (if it already exists) has the owner role.
update public.profiles p set role = 'owner'
from auth.users u
where u.id = p.id and lower(u.email) = lower('rf9339945@gmail.com') and p.role <> 'owner';

-- ───────────────────────── Row level security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.persons enable row level security;
alter table public.relations enable row level security;
alter table public.history enable row level security;

-- Remove every existing policy on these tables so only the rules below apply.
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('profiles', 'persons', 'relations', 'history')
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- profiles: family members see each other; everyone edits only their own profile.
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_owner()) with check (id = auth.uid() or public.is_owner());

-- persons: everyone signed in can view, add and edit; delete only own rows (owner — any).
create policy persons_select on public.persons for select to authenticated using (true);
create policy persons_insert on public.persons for insert to authenticated
  with check (created_by = auth.uid() or public.is_owner());
create policy persons_update on public.persons for update to authenticated using (true) with check (true);
create policy persons_delete on public.persons for delete to authenticated
  using (created_by = auth.uid() or public.is_owner());

-- relations: same rules as persons.
create policy relations_select on public.relations for select to authenticated using (true);
create policy relations_insert on public.relations for insert to authenticated
  with check (created_by = auth.uid() or public.is_owner());
create policy relations_update on public.relations for update to authenticated
  using (created_by = auth.uid() or public.is_owner()) with check (true);
create policy relations_delete on public.relations for delete to authenticated
  using (created_by = auth.uid() or public.is_owner());

-- history: append-only log, each user writes entries only on their own behalf.
create policy history_select on public.history for select to authenticated using (true);
create policy history_insert on public.history for insert to authenticated with check (user_id = auth.uid());

-- ───────────────────────── Realtime ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['persons', 'relations', 'history'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
