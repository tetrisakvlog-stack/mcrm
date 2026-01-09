-- mcrm Supabase schema (run in Supabase SQL editor)

create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'user',
  base_salary integer not null default 700,
  active boolean not null default true,
  cloudtalk_agent_id integer null,
  sip_username text null,
  sip_password text null,
  sip_domain text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  present boolean not null default false,
  minutes integer not null default 0,
  successful_calls integer not null default 0,
  accounts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

create table if not exists public.contacts (
  id uuid primary key default uuid_generate_v4(),
  assigned_to_user_id uuid not null references public.profiles(id) on delete cascade,
  name text null,
  phone text null,
  email text null,
  company text null,
  status text not null default 'new',
  notes text null,
  last_call_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  id text primary key,
  cloudtalk jsonb not null default '{"enabled": false, "backendUrl": ""}'::jsonb,
  salary_rules jsonb not null default '{
    "bonusEnabled": true,
    "minutesThreshold": 1200,
    "minutesBonus": 50,
    "successfulCallsThreshold": 60,
    "successfulCallsBonus": 100,
    "accountsThreshold": 10,
    "accountsBonus": 150
  }'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values ('global')
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_records_updated on public.records;
create trigger trg_records_updated before update on public.records
for each row execute function public.set_updated_at();

drop trigger if exists trg_contacts_updated on public.contacts;
create trigger trg_contacts_updated before update on public.contacts
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.records enable row level security;
alter table public.contacts enable row level security;
alter table public.settings enable row level security;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists(select 1 from public.profiles p where p.id = uid and p.role = 'admin' and p.active = true);
$$;

create policy "profiles_select_self_or_admin" on public.profiles for select
using ( auth.uid() = id or public.is_admin(auth.uid()) );

create policy "profiles_insert_self" on public.profiles for insert
with check ( auth.uid() = id );

create policy "profiles_update_self_or_admin" on public.profiles for update
using ( auth.uid() = id or public.is_admin(auth.uid()) )
with check ( auth.uid() = id or public.is_admin(auth.uid()) );

create policy "records_select_self_or_admin" on public.records for select
using ( auth.uid() = user_id or public.is_admin(auth.uid()) );

create policy "records_insert_self_or_admin" on public.records for insert
with check ( auth.uid() = user_id or public.is_admin(auth.uid()) );

create policy "records_update_self_or_admin" on public.records for update
using ( auth.uid() = user_id or public.is_admin(auth.uid()) )
with check ( auth.uid() = user_id or public.is_admin(auth.uid()) );

create policy "records_delete_self_or_admin" on public.records for delete
using ( auth.uid() = user_id or public.is_admin(auth.uid()) );

create policy "contacts_select_self_or_admin" on public.contacts for select
using ( auth.uid() = assigned_to_user_id or public.is_admin(auth.uid()) );

create policy "contacts_insert_self_or_admin" on public.contacts for insert
with check ( auth.uid() = assigned_to_user_id or public.is_admin(auth.uid()) );

create policy "contacts_update_self_or_admin" on public.contacts for update
using ( auth.uid() = assigned_to_user_id or public.is_admin(auth.uid()) )
with check ( auth.uid() = assigned_to_user_id or public.is_admin(auth.uid()) );

create policy "contacts_delete_self_or_admin" on public.contacts for delete
using ( auth.uid() = assigned_to_user_id or public.is_admin(auth.uid()) );

create policy "settings_admin_only" on public.settings for all
using ( public.is_admin(auth.uid()) )
with check ( public.is_admin(auth.uid()) );
