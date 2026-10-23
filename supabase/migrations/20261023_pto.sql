-- PTO: reps request time off, the manager approves, approved time off shows on
-- the CRM calendar for both companies and is written to Outlook.
--
-- Every write goes through the `pto` Edge Function (it sends the emails and
-- writes Outlook), so signed-in users get no insert/update/delete here.
-- Reads:
--   pto_requests  the full request (note, decline reason): the requester and
--                 approvers only, so pending requests stay private
--   pto_team      approved time off for everyone, without the private note
create table if not exists public.pto_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rep_id uuid not null,
  rep_name text not null,
  rep_email text not null,
  company text not null,                       -- 'Chief Negotiators' | 'SSP'
  start_date date not null,
  end_date date not null,
  start_part text not null default 'full' check (start_part in ('full', 'am', 'pm')),
  end_part text not null default 'full' check (end_part in ('full', 'am', 'pm')),
  tz text not null default 'America/New_York',
  type text not null default 'Vacation'
    check (type in ('Vacation', 'Sick', 'Personal', 'Holiday', 'Conference / travel')),
  days numeric(5, 1) not null default 0,       -- business days, halves count 0.5
  coverage_rep_id uuid,
  coverage_name text,
  note text,                                   -- private: requester + approvers
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'cancelled')),
  decided_by text,
  decided_at timestamptz,
  decline_reason text,
  outlook jsonb not null default '{}'::jsonb,  -- event ids written on approval
  outlook_error text,
  check (end_date >= start_date)
);
create index if not exists pto_requests_dates on public.pto_requests (start_date, end_date);
create index if not exists pto_requests_rep on public.pto_requests (lower(rep_email), status);

alter table public.pto_requests enable row level security;

-- Approvers: the active admins in reps (Amanda today).
create or replace function public.pto_is_approver()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from reps
    where lower(email) = public.auth_email() and is_admin and not coalesce(off_board, false)
  )
$$;

drop policy if exists "pto own or approver read" on public.pto_requests;
create policy "pto own or approver read" on public.pto_requests
  for select to authenticated
  using (lower(rep_email) = public.auth_email() or public.pto_is_approver());

-- Approved time off, visible to the whole team (both companies), minus the note.
create or replace view public.pto_team as
  select id, rep_id, rep_name, company, start_date, end_date, start_part, end_part,
         tz, type, days, coverage_rep_id, coverage_name
  from public.pto_requests
  where status = 'approved';
revoke all on public.pto_team from anon;
grant select on public.pto_team to authenticated;
