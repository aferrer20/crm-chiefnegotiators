-- Daily brief for the whole team: one brief per person, built from their own
-- synced mailboxes and sent at about 7:30 in their own time zone.
-- Applied 2026-10-23 alongside these data changes:
--   * Camila back on both sides: her CN rep row (login camila@thevaultmarketingco.com)
--     now points at camila@thechiefnegotiators.com, plus an SSP row for
--     camila@strategicsupplypartners.com.au, so email-sync reads both mailboxes.
--   * PTO approvals belong to Amanda alone (pto_is_approver below).
create table if not exists public.brief_recipients (
  login_email text primary key,          -- the CRM login; brief_items.owner_email
  name text not null,
  send_to text not null,
  tz text not null default 'America/New_York',
  mailboxes text[] not null,             -- synced mailboxes the brief reads
  active boolean not null default true
);
alter table public.brief_recipients enable row level security;
drop policy if exists "brief recipients own read" on public.brief_recipients;
create policy "brief recipients own read" on public.brief_recipients
  for select to authenticated using (lower(login_email) = public.auth_email());

insert into public.brief_recipients (login_email, name, send_to, tz, mailboxes) values
 ('amanda@thechiefnegotiators.com', 'Amanda', 'amanda@thechiefnegotiators.com', 'America/New_York', '{amanda@thechiefnegotiators.com}'),
 ('dan@thechiefnegotiators.com', 'Dan', 'dan@thechiefnegotiators.com', 'America/New_York', '{dan@thechiefnegotiators.com}'),
 ('vanessa@thechiefnegotiators.com', 'Vanessa', 'vanessa@thechiefnegotiators.com', 'America/New_York', '{vanessa@thechiefnegotiators.com}'),
 ('monika@strategicsupplypartners.com.au', 'Monika', 'monika@strategicsupplypartners.com.au', 'America/New_York', '{monika@strategicsupplypartners.com.au}'),
 ('camila@thevaultmarketingco.com', 'Camila', 'camila@thechiefnegotiators.com', 'America/New_York', '{camila@thechiefnegotiators.com,camila@strategicsupplypartners.com.au}')
on conflict (login_email) do nothing;

create or replace function public.pto_is_approver()
returns boolean language sql stable security definer set search_path = public as $$
  select public.auth_email() = 'amanda@thechiefnegotiators.com'
$$;

-- Hourly, one call per active recipient; each call sends only at 7am in that
-- person's zone (and pre-scans at 6am), so every brief lands around 7:30 local.
select cron.unschedule('cn-daily-brief') where exists (select 1 from cron.job where jobname = 'cn-daily-brief');
-- (re-created with the project's function bearer; see cron.job 'cn-daily-brief')

-- Staggered sends, 30 minutes apart, each in the person's own zone:
-- Amanda 6:30 · Dan 7:00 · Vanessa 7:30 · Camila 8:00 (New York) · Monika 7:30 (Sydney).
alter table public.brief_recipients add column if not exists send_at time not null default '07:30';
update public.brief_recipients set send_at = '06:30' where login_email = 'amanda@thechiefnegotiators.com';
update public.brief_recipients set send_at = '07:00' where login_email = 'dan@thechiefnegotiators.com';
update public.brief_recipients set send_at = '08:00' where login_email = 'camila@thevaultmarketingco.com';
update public.brief_recipients set tz = 'Australia/Sydney' where login_email = 'monika@strategicsupplypartners.com.au';
