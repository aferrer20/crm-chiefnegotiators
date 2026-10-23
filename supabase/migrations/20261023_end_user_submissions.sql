-- End-user discovery submissions from the public qualification form
-- (cncrm.../end-user.html). NVIDIA and the OEM require this discovery before a
-- quote is issued, so each offer email links here instead of to pricing.
--
-- Rows are written only by the end-user-intake function (service role), which
-- validates the payload, links or creates the contact and alerts the owner.
-- Signed-in CRM users can read them and move them through review.
create table if not exists public.end_user_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  offer text not null,                -- e.g. 'h100-8gpu-2026-10'
  campaign_id text,                   -- the email the form was opened from
  contact_name text not null,
  contact_title text,
  contact_company text not null,
  contact_email text not null,
  contact_phone text,
  quantity text,                      -- servers wanted
  answers jsonb not null default '{}'::jsonb,     -- discovery questions 01-06
  compliance jsonb not null default '{}'::jsonb,  -- package status per item
  attestation jsonb not null default '{}'::jsonb, -- typed name, title, date
  contact_id uuid,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'qualified', 'not_qualified', 'quoted')),
  reviewed_at timestamptz,
  notified_at timestamptz,
  user_agent text
);
create index if not exists end_user_submissions_created on public.end_user_submissions (created_at desc);
create index if not exists end_user_submissions_email on public.end_user_submissions (lower(contact_email));

alter table public.end_user_submissions enable row level security;

drop policy if exists "end user submissions read" on public.end_user_submissions;
create policy "end user submissions read" on public.end_user_submissions
  for select to authenticated using (true);
drop policy if exists "end user submissions review" on public.end_user_submissions;
create policy "end user submissions review" on public.end_user_submissions
  for update to authenticated using (true) with check (true);
-- No insert policy: anonymous visitors cannot write here directly.
