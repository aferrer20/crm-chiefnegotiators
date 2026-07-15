-- ============================================================
--  Negotiation CRM Suite — schema + domain-based RLS
--  Applied to the Supabase project once the correct account
--  is reconnected. RLS is the REAL security layer: even though
--  the GitHub Pages HTML is public, the DATA is only reachable
--  by an authenticated user whose email domain (or owner status)
--  grants access to that company's rows.
-- ============================================================

-- ---- Tenants -------------------------------------------------
create table if not exists companies (
  id          text primary key,           -- 'chiefneg' | 'ssp'
  name        text not null,
  domain      text not null unique,        -- 'thechiefnegotiators.com'
  accent      text,
  created_at  timestamptz default now()
);

-- Owners see ALL companies regardless of their email domain.
create table if not exists owners (
  email       text primary key
);

-- ---- CRM data (every row scoped to a company) ---------------
create table if not exists contacts (
  id           bigint generated always as identity primary key,
  company_id   text not null references companies(id) on delete cascade,
  first_name   text,
  last_name    text,
  org          text,
  role         text,
  relationship text,
  last_contact text,
  created_at   timestamptz default now()
);

create table if not exists deals (
  id           bigint generated always as identity primary key,
  company_id   text not null references companies(id) on delete cascade,
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

create table if not exists tasks (
  id           bigint generated always as identity primary key,
  company_id   text not null references companies(id) on delete cascade,
  description  text not null,
  due_date     date,
  priority     text,
  done         boolean default false,
  deal_id      bigint references deals(id) on delete set null,
  created_at   timestamptz default now()
);

-- ============================================================
--  Access helpers
-- ============================================================
-- Lower-cased email from the verified JWT (null when anon).
create or replace function public.auth_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- Is the caller one of the named owners?
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from owners o where o.email = public.auth_email())
$$;

-- Can the caller access rows belonging to :cid ?
--   owner            -> every company
--   otherwise        -> only the company whose domain == their email domain
create or replace function public.can_access(cid text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_owner()
      or exists (
           select 1 from companies c
           where c.id = cid
             and c.domain = split_part(public.auth_email(), '@', 2)
         )
$$;

-- ============================================================
--  Row Level Security
-- ============================================================
alter table companies enable row level security;
alter table owners    enable row level security;
alter table contacts  enable row level security;
alter table deals     enable row level security;
alter table tasks     enable row level security;

-- Companies: an authenticated user may read only the companies
-- they can access (owners: all; members: their own).
drop policy if exists companies_read on companies;
create policy companies_read on companies
  for select to authenticated
  using (public.can_access(id));

-- Owners table: readable by authenticated users (needed by helpers);
-- no client writes.
drop policy if exists owners_read on owners;
create policy owners_read on owners
  for select to authenticated using (true);

-- Data tables: full CRUD, but ONLY within accessible companies.
drop policy if exists contacts_rw on contacts;
create policy contacts_rw on contacts
  for all to authenticated
  using (public.can_access(company_id))
  with check (public.can_access(company_id));

drop policy if exists deals_rw on deals;
create policy deals_rw on deals
  for all to authenticated
  using (public.can_access(company_id))
  with check (public.can_access(company_id));

drop policy if exists tasks_rw on tasks;
create policy tasks_rw on tasks
  for all to authenticated
  using (public.can_access(company_id))
  with check (public.can_access(company_id));

-- ============================================================
--  Seed: tenants + owners
-- ============================================================
insert into companies (id, name, domain, accent) values
  ('chiefneg', 'The Chief Negotiators',      'thechiefnegotiators.com',        '#3b82f6'),
  ('ssp',      'Strategic Supply Partners',  'strategicsupplypartners.com.au', '#14b8a6')
on conflict (id) do update
  set name = excluded.name, domain = excluded.domain, accent = excluded.accent;

insert into owners (email) values
  ('arron@strategicsupplypartners.com.au'),
  ('amanda@thechiefnegotiators.com'),
  ('camila@thevaultmarketingco.com')
on conflict (email) do nothing;
