-- ============================================================
--  Negotiation CRM Suite - schema + domain-based RLS
--  Run once in the Supabase SQL Editor (shared project, both CRMs).
--  All tables are prefixed crm_ so they never collide with any
--  tables already in your database. Safe to re-run.
--
--  RLS is the REAL security layer: the GitHub Pages HTML is public,
--  but DATA is only reachable by an authenticated user whose email
--  domain (or owner status) grants access to that company's rows.
-- ============================================================

-- ---- Tenants ----
create table if not exists crm_companies (
  id          text primary key,
  name        text not null,
  domain      text not null unique,
  accent      text,
  created_at  timestamptz default now()
);

create table if not exists crm_owners (
  email       text primary key
);

-- ---- CRM data (every row scoped to a company) ----
create table if not exists crm_contacts (
  id           bigint generated always as identity primary key,
  company_id   text not null references crm_companies(id) on delete cascade,
  first_name   text,
  last_name    text,
  org          text,
  role         text,
  relationship text,
  last_contact text,
  created_at   timestamptz default now()
);

create table if not exists crm_deals (
  id           bigint generated always as identity primary key,
  company_id   text not null references crm_companies(id) on delete cascade,
  name         text not null,
  counterparty text,
  value        numeric default 0,
  stage        text,
  priority     text,
  progress     int  default 0,
  opened       date,
  next_step    text,
  notes        text,
  created_at   timestamptz default now()
);

create table if not exists crm_tasks (
  id           bigint generated always as identity primary key,
  company_id   text not null references crm_companies(id) on delete cascade,
  description  text not null,
  due_date     date,
  priority     text,
  done         boolean default false,
  deal_id      bigint references crm_deals(id) on delete set null,
  created_at   timestamptz default now()
);

-- ============================================================
--  Access helpers
-- ============================================================
create or replace function public.auth_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_owners o where o.email = public.auth_email())
$$;

create or replace function public.can_access(cid text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_owner()
      or exists (
           select 1 from crm_companies c
           where c.id = cid
             and c.domain = split_part(public.auth_email(), '@', 2)
         )
$$;

-- ============================================================
--  Row Level Security
-- ============================================================
alter table crm_companies enable row level security;
alter table crm_owners    enable row level security;
alter table crm_contacts  enable row level security;
alter table crm_deals     enable row level security;
alter table crm_tasks     enable row level security;

drop policy if exists crm_companies_read on crm_companies;
create policy crm_companies_read on crm_companies
  for select to authenticated
  using (public.can_access(id));

drop policy if exists crm_owners_read on crm_owners;
create policy crm_owners_read on crm_owners
  for select to authenticated using (true);

drop policy if exists crm_contacts_rw on crm_contacts;
create policy crm_contacts_rw on crm_contacts
  for all to authenticated
  using (public.can_access(company_id))
  with check (public.can_access(company_id));

drop policy if exists crm_deals_rw on crm_deals;
create policy crm_deals_rw on crm_deals
  for all to authenticated
  using (public.can_access(company_id))
  with check (public.can_access(company_id));

drop policy if exists crm_tasks_rw on crm_tasks;
create policy crm_tasks_rw on crm_tasks
  for all to authenticated
  using (public.can_access(company_id))
  with check (public.can_access(company_id));

-- ============================================================
--  Seed: tenants + owners
-- ============================================================
insert into crm_companies (id, name, domain, accent) values
  ('chiefneg', 'The Chief Negotiators',      'thechiefnegotiators.com',        '#b98a5e'),
  ('ssp',      'Strategic Supply Partners',  'strategicsupplypartners.com.au', '#3b82f6')
on conflict (id) do update
  set name = excluded.name, domain = excluded.domain, accent = excluded.accent;

insert into crm_owners (email) values
  ('arron@strategicsupplypartners.com.au'),
  ('amanda@thechiefnegotiators.com'),
  ('camila@thevaultmarketingco.com')
on conflict (email) do nothing;
