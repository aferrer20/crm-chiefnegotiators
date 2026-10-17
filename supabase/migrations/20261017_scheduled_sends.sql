-- Campaigns queued from the Campaigns screen to go out at a set time.
-- payload is exactly what the browser would have posted to send-campaign
-- ({campaign, recipients}), prepared by the same pre-send pipeline, so a
-- scheduled send is the same send it replaces, only later.
create table if not exists public.scheduled_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  name text,
  subject text,
  brand text,
  send_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending','sending','sent','partial','failed','cancelled')),
  recipient_count integer not null default 0,
  payload jsonb not null,
  created_by uuid default auth.uid(),
  created_by_email text,
  owner_rep_id uuid,
  result jsonb,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  cancelled_at timestamptz
);

-- One live schedule per campaign: re-scheduling means cancelling first.
create unique index if not exists scheduled_sends_one_live
  on public.scheduled_sends (campaign_id) where status in ('pending','sending');
create index if not exists scheduled_sends_due
  on public.scheduled_sends (send_at) where status = 'pending';

-- Stamp who scheduled it and the rep it counts for. A client can't forge these
-- or start a row in any state but pending.
create or replace function public.scheduled_sends_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.status := 'pending';
  new.attempts := 0;
  new.result := null;
  new.error := null;
  new.sent_at := null;
  new.cancelled_at := null;
  new.created_by := auth.uid();
  new.created_by_email := public.auth_email();
  select id into new.owner_rep_id from reps where lower(email) = public.auth_email() limit 1;
  if new.send_at < now() - interval '2 minutes' then
    raise exception 'send_at is in the past';
  end if;
  return new;
end $$;
drop trigger if exists scheduled_sends_before_insert on public.scheduled_sends;
create trigger scheduled_sends_before_insert before insert on public.scheduled_sends
  for each row execute function public.scheduled_sends_before_insert();

-- The only change a signed-in user may make is cancelling a pending send; the
-- dispatcher (service role) moves rows through sending -> sent/failed.
create or replace function public.scheduled_sends_before_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    if old.status <> 'pending' or new.status <> 'cancelled' then
      raise exception 'only a pending send can be changed, and only to cancelled';
    end if;
    new := old;
    new.status := 'cancelled';
    new.cancelled_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists scheduled_sends_before_update on public.scheduled_sends;
create trigger scheduled_sends_before_update before update on public.scheduled_sends
  for each row execute function public.scheduled_sends_before_update();

alter table public.scheduled_sends enable row level security;
drop policy if exists "scheduled sends readable" on public.scheduled_sends;
create policy "scheduled sends readable" on public.scheduled_sends
  for select to authenticated using (true);
drop policy if exists "scheduled sends insert" on public.scheduled_sends;
create policy "scheduled sends insert" on public.scheduled_sends
  for insert to authenticated with check (true);
drop policy if exists "scheduled sends cancel" on public.scheduled_sends;
create policy "scheduled sends cancel" on public.scheduled_sends
  for update to authenticated using (status = 'pending') with check (status = 'cancelled');

-- Dispatcher claim: atomically move due rows to 'sending' so two overlapping
-- runs can never send the same campaign twice.
create or replace function public.claim_due_scheduled_sends(p_limit integer default 5)
returns setof public.scheduled_sends language sql security definer set search_path = public as $$
  update scheduled_sends s set status = 'sending', attempts = s.attempts + 1, updated_at = now()
  where s.id in (
    select id from scheduled_sends
    where status = 'pending' and send_at <= now()
    order by send_at
    limit p_limit
    for update skip locked
  )
  returning s.*;
$$;
revoke all on function public.claim_due_scheduled_sends(integer) from public, anon, authenticated;
grant execute on function public.claim_due_scheduled_sends(integer) to service_role;
