-- Daily brief: the helper that reads the synced mailbox every morning and
-- turns it into a to-do list (reply owed, gone quiet, promise made).
--
-- brief_items is the living to-do list. One row per (owner, kind, thread,
-- triggering message), so a newer message in the thread produces a new row
-- and the old one resolves itself. The CRM's Today screen and the 8am email
-- both read from here.
create table if not exists public.brief_items (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  kind text not null check (kind in ('reply', 'silent', 'promise')),
  conversation_id text not null,
  anchor_message_id text not null,
  subject text,
  counterpart_name text,
  counterpart_email text,
  company text,
  account_id text,
  contact_id uuid,
  is_team boolean not null default false,
  summary text,
  why text,
  priority integer not null default 2 check (priority between 1 and 3),
  waiting_since timestamptz,
  web_link text,
  status text not null default 'open'
    check (status in ('open', 'done', 'snoozed', 'dismissed', 'resolved', 'skipped')),
  snooze_until timestamptz,
  done_at timestamptz,
  ai jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_email, kind, conversation_id, anchor_message_id)
);
create index if not exists brief_items_open on public.brief_items (owner_email, status, priority);

-- One row per owner per day: what was sent, so a second cron run never sends twice.
create table if not exists public.daily_briefs (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  brief_date date not null,
  payload jsonb,
  sent_at timestamptz,
  resend_id text,
  error text,
  created_at timestamptz not null default now(),
  unique (owner_email, brief_date)
);

alter table public.brief_items enable row level security;
alter table public.daily_briefs enable row level security;

-- Each person sees and works only their own list.
drop policy if exists "brief items own read" on public.brief_items;
create policy "brief items own read" on public.brief_items
  for select to authenticated using (lower(owner_email) = public.auth_email());
drop policy if exists "brief items own update" on public.brief_items;
create policy "brief items own update" on public.brief_items
  for update to authenticated using (lower(owner_email) = public.auth_email())
  with check (lower(owner_email) = public.auth_email());
drop policy if exists "daily briefs own read" on public.daily_briefs;
create policy "daily briefs own read" on public.daily_briefs
  for select to authenticated using (lower(owner_email) = public.auth_email());

-- From the app a person may only change the workflow fields of their own items.
create or replace function public.brief_items_before_update()
returns trigger language plpgsql set search_path = public as $$
declare st text; sn timestamptz; dn timestamptz;
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    if new.status not in ('open', 'done', 'snoozed', 'dismissed') then
      raise exception 'status % cannot be set from the app', new.status;
    end if;
    st := new.status; sn := new.snooze_until; dn := new.done_at;
    new := old;
    new.status := st; new.snooze_until := sn; new.done_at := dn;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists brief_items_before_update on public.brief_items;
create trigger brief_items_before_update before update on public.brief_items
  for each row execute function public.brief_items_before_update();
