// ============================================================
//  CRM SUITE — per-workspace config (single source of truth)
//  Loaded by both index.html (login gate) and app.html (guard).
//
//  Backend values from: Supabase → Project → Settings → API
//    • Project URL       → SUPABASE_URL
//    • Publishable/anon   → SUPABASE_KEY
//  Confirmed project ref: stpkhpxhqzgruorrupaw  (shared by both CRMs)
// ============================================================
window.__CRM = {
  // ---- Supabase (same project powers both workspaces) ----
  SUPABASE_URL: 'https://stpkhpxhqzgruorrupaw.supabase.co',
  SUPABASE_KEY: 'sb_publishable_v4uwhuJdh4kJQrN1tGSEWA_5rf9Nl7q',

  // ---- This workspace ----
  COMPANY:      'chiefneg',                  // matches companies.id + RLS
  COMPANY_NAME: 'The Chief Negotiators',
  TAGLINE:      'Negotiation CRM',
  DOMAIN:       'thechiefnegotiators.com',   // members with this domain get in
  ICON:         '⚖️',
  ACCENT:       '#b98a5e',   // Chief Negotiators = gold / bronze
  ACCENT2:      '#8b5535',
  BTN_TEXT:     '#2a1c0f',

  // ---- Sibling workspace (owner-only switch link) ----
  OTHER_COMPANY: 'ssp',
  OTHER_NAME:    'Strategic Supply Partners',
  OTHER_URL:     'https://sspcrm.thechiefnegotiators.com'
};
