-- Dialpad call logging (dialpad-webhook function). Applied 2026-11-02.
-- Every Dialpad event for a call updates one activity row, keyed by
-- (source='dialpad', source_event_id=<call_id>); action items become task rows
-- keyed <call_id>:task:<n>.
alter table public.activities
  add column if not exists ai_summary text,
  add column if not exists transcript text,
  add column if not exists action_items jsonb,
  add column if not exists call_direction text;
create unique index if not exists activities_source_event_uniq
  on public.activities (source, source_event_id) where source_event_id is not null;

-- Server-only secrets for integrations (no grants: service role only).
-- dialpad_webhook_secret signs Dialpad's events; it is generated in the
-- database and handed to Dialpad by the function's register action, so it
-- never has to be typed or shown anywhere.
create table if not exists public.integration_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.integration_secrets enable row level security;
revoke all on public.integration_secrets from anon, authenticated;
insert into public.integration_secrets (name, value)
values ('dialpad_webhook_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;
