// call-sync — one inbound endpoint for call & meeting logs.
//
// The rep is matched from rep_email (exact mailbox first, then by name handle),
// and the call is filed under THAT rep's company unless the webhook pins one
// with ?company=. Without this, an SSP rep's calls landed under Chief
// Negotiators and never showed on the SSP side.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-call-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const str = (v: unknown) => (v == null ? "" : String(v).trim());

function pick(obj: any, paths: string[]): any {
  for (const p of paths) {
    let cur = obj;
    for (const seg of p.split(".")) {
      if (cur == null) break;
      cur = cur[seg];
    }
    if (cur != null && cur !== "") return cur;
  }
  return undefined;
}

function normalize(body: any) {
  const root = body?.session ?? body?.report ?? body?.data ?? body;

  const occurred =
    pick(root, ["occurred_at", "start_time", "startTime", "started_at", "session_start", "date", "timestamp"]) ??
    new Date().toISOString();

  let durationMin = pick(root, ["duration_min", "duration_minutes", "durationMinutes"]);
  if (durationMin == null) {
    const secs = pick(root, ["duration_sec", "duration_seconds", "duration"]);
    if (secs != null && Number(secs) > 0) durationMin = Math.round(Number(secs) / 60);
  }

  const summary = str(
    pick(root, [
      "summary", "ai_summary", "aiSummary", "summary_text", "overview",
      "report.summary", "session_summary", "notes", "body", "recap",
    ]),
  );

  const rawType = str(pick(root, ["type", "event", "call_type", "kind", "platform"])).toLowerCase();
  const type = /meet|zoom|teams|webinar|video|conference/.test(rawType) ? "meeting" : "call";

  const direction = /in(bound|coming)|received/.test(
    str(pick(root, ["direction", "call_direction", "disposition"])).toLowerCase(),
  ) ? "inbound" : "outbound";

  const people: any[] = [];
  const parts = pick(root, ["participants", "attendees", "speakers", "members"]);
  if (Array.isArray(parts)) {
    for (const p of parts) {
      if (typeof p === "string") people.push({ name: p.includes("@") ? "" : p, email: p.includes("@") ? p : "" });
      else people.push({ name: str(p?.name ?? p?.display_name ?? p?.full_name), email: str(p?.email), phone: str(p?.phone ?? p?.number) });
    }
  }
  const single = {
    name: str(pick(root, ["contact.name", "contact_name", "customer_name", "from_name", "caller_name", "name"])),
    email: str(pick(root, ["contact.email", "contact_email", "customer_email", "from_email", "email"])),
    phone: str(pick(root, ["contact.phone", "contact_phone", "from", "from_number", "caller", "phone", "number"])),
  };
  if (single.name || single.email || single.phone) people.unshift(single);

  return {
    type,
    direction,
    occurred_at: new Date(occurred).toISOString(),
    duration_min: durationMin != null ? Number(durationMin) : null,
    subject: str(pick(root, ["subject", "title", "topic", "session_title", "meeting_title"])) || (type === "meeting" ? "Meeting" : "Call"),
    summary,
    transcript_url: str(pick(root, ["transcript_url", "recording_url", "report_url", "share_url"])),
    rep_email: str(pick(root, ["rep_email", "owner_email", "host_email", "organizer_email", "user_email"])),
    people: people.filter(p => p.name || p.email || p.phone),
    provider: str(pick(body, ["provider", "source", "event_type"])) || "webhook",
  };
}

async function resolveContact(people: any[], company: string) {
  const { data: contacts } = await sb.from("contacts").select("id,name,email,phone,account_id,company");
  const pool = contacts ?? [];

  for (const p of people) {
    if (!p.email) continue;
    const hit = pool.find(c => str(c.email).toLowerCase() === p.email.toLowerCase());
    if (hit) return { id: hit.id, created: false };
  }
  for (const p of people) {
    const d = digits(p.phone).slice(-10);
    if (d.length < 7) continue;
    const hit = pool.find(c => digits(c.phone).slice(-10) === d);
    if (hit) return { id: hit.id, created: false };
  }
  for (const p of people) {
    if (!p.name) continue;
    const hit = pool.find(c => str(c.name).toLowerCase() === p.name.toLowerCase());
    if (hit) return { id: hit.id, created: false };
  }

  const best = people.find(p => p.phone) ?? people.find(p => p.email) ?? people[0];
  if (!best) return { id: null, created: false };

  const { data: made, error } = await sb.from("contacts").insert({
    name: str(best.name) || str(best.phone) || str(best.email) || "Unknown caller",
    email: str(best.email) || null,
    phone: str(best.phone) || null,
    company,
  }).select("id").single();
  if (error) return { id: null, created: false };
  return { id: made.id, created: true };
}

// Exact mailbox first, then the mailbox handle against the rep's name: full
// name, first name, surname, or initial+surname.
async function resolveRep(email: string): Promise<{ id: string; company: string | null } | null> {
  if (!email) return null;
  const { data } = await sb.from("reps").select("id,name,email,company");
  const pool = data ?? [];
  const exact = pool.find(r => str(r.email).toLowerCase() === email.toLowerCase());
  if (exact) return { id: exact.id, company: exact.company ?? null };
  const handle = email.split("@")[0].toLowerCase().replace(/[^a-z]/g, "");
  if (!handle) return null;

  for (const r of pool) {
    const name = str(r.name).toLowerCase();
    if (!name) continue;
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1] : "";
    const candidates = [
      name.replace(/[^a-z]/g, ""),
      first,
      last,
      first && last ? first[0] + last : "",
      first && last ? first + last[0] : "",
    ].filter(Boolean);
    if (candidates.includes(handle)) return { id: r.id, company: r.company ?? null };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const expected = Deno.env.get("CALL_SYNC_SECRET") ?? "";
  const url = new URL(req.url);
  const given = req.headers.get("x-call-sync-secret") ?? url.searchParams.get("token") ?? "";
  if (!expected) return json({ error: "CALL_SYNC_SECRET is not set on the function" }, 500);
  if (given !== expected) return json({ error: "bad or missing secret" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "body must be JSON" }, 400); }

  const n = normalize(body);
  const rep = await resolveRep(n.rep_email);
  const company = url.searchParams.get("company") || rep?.company || "Chief Negotiators";

  const log = async (ok: boolean, note: string, activityId: string | null) => {
    await sb.from("call_sync_log").insert({ provider: n.provider, ok, note, activity_id: activityId, payload: body });
  };

  if (!n.people.length) {
    await log(false, "no participant identifiable in payload", null);
    return json({ ok: false, error: "couldn't find a contact name, email or phone in the payload" }, 422);
  }

  const contact = await resolveContact(n.people, company);
  const minute = n.occurred_at.slice(0, 16);
  const { data: dupe } = await sb
    .from("activities")
    .select("id")
    .eq("type", n.type)
    .eq("contact_id", contact.id)
    .gte("occurred_at", minute + ":00Z")
    .lte("occurred_at", minute + ":59Z")
    .limit(1);
  if (dupe && dupe.length) {
    await log(true, "duplicate ignored", dupe[0].id);
    return json({ ok: true, duplicate: true, activity_id: dupe[0].id });
  }

  const summary = [n.summary, n.transcript_url ? `\n\nRecording / transcript: ${n.transcript_url}` : ""].join("").trim();

  const { data: act, error } = await sb.from("activities").insert({
    type: n.type,
    contact_id: contact.id,
    opportunity_id: null,
    owner_id: rep?.id ?? null,
    occurred_at: n.occurred_at,
    duration_min: n.duration_min,
    subject: n.subject,
    summary,
    company,
    source: "call-sync",
    raw: body,
  }).select("id").single();

  if (error) {
    await log(false, error.message, null);
    return json({ ok: false, error: error.message }, 500);
  }

  await log(true, contact.created ? "contact placeholder created" : "matched existing contact", act.id);
  return json({
    ok: true,
    activity_id: act.id,
    contact_id: contact.id,
    contact_created: contact.created,
    direction: n.direction,
  });
});
