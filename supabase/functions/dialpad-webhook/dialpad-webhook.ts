// dialpad-webhook — Dialpad call events into the CRM call log.
//
// Dialpad posts one event per call state (hangup, missed, voicemail, then
// later the transcript and the Ai recap). Every event for a call lands on the
// SAME activity row, keyed by Dialpad's call_id, so the summary, transcript
// and action items fill in as they arrive instead of making new entries.
//
//   POST /functions/v1/dialpad-webhook          Dialpad events (JWT, HS256)
//   POST /functions/v1/dialpad-webhook?token=…  plain JSON, for testing
//   POST …?action=register&token=…              create the Dialpad webhook and
//                                               call-event subscription
//
// Secrets: the signing secret lives in public.integration_secrets
// (dialpad_webhook_secret; locked to the service role) unless
// DIALPAD_WEBHOOK_SECRET overrides it. DIALPAD_API_KEY (transcript fetch +
// registration) and optional DIALPAD_API_BASE are function secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

let SECRET = Deno.env.get("DIALPAD_WEBHOOK_SECRET") ?? "";
const API_KEY = Deno.env.get("DIALPAD_API_KEY") ?? "";
const API_BASE = (Deno.env.get("DIALPAD_API_BASE") ?? "https://dialpad.com/api/v2").replace(/\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const str = (v: unknown) => (v == null ? "" : String(v).trim());
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

// ── signature ────────────────────────────────────────────────────────────────
function b64urlToBytes(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
async function verifyJwt(token: string): Promise<any | null> {
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig || !SECRET) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;
  try { return JSON.parse(new TextDecoder().decode(b64urlToBytes(p))); } catch { return null; }
}

// ── event shape ──────────────────────────────────────────────────────────────
function pick(obj: any, paths: string[]): any {
  for (const path of paths) {
    let cur = obj;
    for (const seg of path.split(".")) { if (cur == null) break; cur = cur[seg]; }
    if (cur != null && cur !== "" && !(Array.isArray(cur) && !cur.length)) return cur;
  }
  return undefined;
}
// Dialpad timestamps are epoch milliseconds; accept seconds and ISO too.
function toDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return new Date(n > 1e12 ? n : n * 1000);
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}
function textOf(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join("\n");
  return str(v.summary ?? v.content ?? v.text ?? v.description ?? v.title ?? v.value ?? "");
}
function listOf(v: any): string[] {
  if (v == null) return [];
  if (typeof v === "string") return v.split(/\n+/).map((s) => s.replace(/^\s*[-•*\d.)]+\s*/, "").trim()).filter(Boolean);
  if (Array.isArray(v)) return v.map(textOf).filter(Boolean);
  return listOf(v.items ?? v.action_items ?? textOf(v));
}
function transcriptOf(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  const lines = Array.isArray(v) ? v : v.lines ?? v.transcript ?? v.utterances ?? [];
  if (!Array.isArray(lines)) return textOf(v);
  return lines
    .filter((l: any) => !l?.type || /transcript|utterance|speech/i.test(String(l.type)))
    .map((l: any) => { const who = str(l?.name ?? l?.speaker ?? l?.contact_name); const t = textOf(l?.content ?? l?.text ?? l); return t ? (who ? `${who}: ${t}` : t) : ""; })
    .filter(Boolean).join("\n");
}

function normalize(ev: any) {
  const callId = str(pick(ev, ["call_id", "callId", "master_call_id", "id"]));
  const state = str(pick(ev, ["state", "event", "event_type", "type"])).toLowerCase();
  const started = toDate(pick(ev, ["date_started", "date_connected", "date_rang", "start_time", "started_at", "timestamp"]));
  const ended = toDate(pick(ev, ["date_ended", "end_time", "ended_at"]));
  let durationMin: number | null = null;
  if (started && ended && ended > started) durationMin = Math.max(1, Math.round((+ended - +started) / 60000));
  else {
    const d = Number(pick(ev, ["duration", "total_duration", "talk_time"]));
    if (Number.isFinite(d) && d > 0) durationMin = Math.max(1, Math.round(d / 60000)); // milliseconds
  }
  const contact = ev.contact ?? {};
  const target = ev.target ?? {};
  const rec = pick(ev, ["recording_url", "recording_details.0.url", "call_recording.url", "recording.url", "voicemail_link", "voicemail_recording_url"]);
  return {
    callId,
    state,
    occurredAt: (started ?? toDate(ev.date_rang) ?? new Date()).toISOString(),
    durationMin,
    direction: /in/.test(str(ev.direction).toLowerCase()) ? "inbound" : str(ev.direction) ? "outbound" : "",
    person: {
      name: str(contact.name ?? ev.contact_name),
      email: str(contact.email ?? ev.contact_email),
      phone: str(contact.phone ?? ev.external_number ?? ev.contact_phone),
    },
    repEmail: str(target.email ?? ev.target_email ?? ev.user_email ?? ev.operator_email),
    repName: str(target.name),
    recordingUrl: Array.isArray(rec) ? str(rec[0]) : str(rec),
    aiSummary: textOf(pick(ev, ["recap_summary", "call_recap.summary", "ai_recap.summary", "recap.summary", "ai_summary", "summary"])),
    actionItems: listOf(pick(ev, ["action_items", "recap_action_items", "call_recap.action_items", "ai_recap.action_items", "recap.action_items"])),
    transcript: transcriptOf(pick(ev, ["transcription_text", "call_transcription", "transcript", "transcription"])),
    missed: /missed|voicemail|abandoned/.test(state),
  };
}

// States that only describe a call in progress: nothing to log yet.
const IN_PROGRESS = /^(calling|ringing|preanswer|connected|queued|hold|unhold|parked|merged|transfer|eavesdrop|monitor|barge|admin)/;

// ── CRM lookups ──────────────────────────────────────────────────────────────
async function resolveRep(email: string, name: string) {
  const { data } = await sb.from("reps").select("id,name,email,company");
  const pool = data ?? [];
  const byEmail = email && pool.find((r) => str(r.email).toLowerCase() === email.toLowerCase());
  if (byEmail) return byEmail;
  const byName = name && pool.find((r) => str(r.name).toLowerCase() === name.toLowerCase());
  return byName || null;
}
async function resolveContact(p: { name: string; email: string; phone: string }, company: string) {
  const { data } = await sb.from("contacts").select("id,name,email,phone,account_id");
  const pool = data ?? [];
  if (p.email) { const hit = pool.find((c) => str(c.email).toLowerCase() === p.email.toLowerCase()); if (hit) return { contact: hit, created: false }; }
  const d = digits(p.phone).slice(-10);
  if (d.length >= 7) { const hit = pool.find((c) => digits(c.phone).slice(-10) === d); if (hit) return { contact: hit, created: false }; }
  if (p.name && !/^\+?[\d\s()-]+$/.test(p.name)) { const hit = pool.find((c) => str(c.name).toLowerCase() === p.name.toLowerCase()); if (hit) return { contact: hit, created: false }; }
  if (!p.phone && !p.email && !p.name) return { contact: null, created: false };
  const { data: made } = await sb.from("contacts").insert({
    name: p.name || p.phone || p.email || "Unknown caller", email: p.email || null, phone: p.phone || null, company,
  }).select("id,name,email,phone,account_id").single();
  return { contact: made ?? null, created: !!made };
}
// The open deal this call belongs to: only when there is exactly one, so a
// call is never pinned to the wrong deal.
async function openDealFor(contact: any): Promise<string | null> {
  if (!contact) return null;
  const or = contact.account_id ? `contact_id.eq.${contact.id},account_id.eq.${contact.account_id}` : `contact_id.eq.${contact.id}`;
  const { data } = await sb.from("opportunities").select("id,stage").or(or);
  const open = (data ?? []).filter((o) => !/^(won|lost)$/.test(str(o.stage)));
  return open.length === 1 ? open[0].id : null;
}
async function fetchTranscript(callId: string): Promise<string> {
  if (!API_KEY || !callId) return "";
  try {
    const r = await fetch(`${API_BASE}/transcripts/${encodeURIComponent(callId)}`, { headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json" } });
    if (!r.ok) return "";
    return transcriptOf(await r.json());
  } catch { return ""; }
}
async function log(ok: boolean, note: string, activityId: string | null, payload: unknown) {
  try { await sb.from("call_sync_log").insert({ provider: "dialpad", ok, note, activity_id: activityId, payload }); } catch { /* best-effort */ }
}

// ── registration ─────────────────────────────────────────────────────────────
async function register() {
  if (!API_KEY) return json({ ok: false, error: "Set DIALPAD_API_KEY first." }, 400);
  const hookUrl = `${SUPABASE_URL}/functions/v1/dialpad-webhook`;
  const call = async (path: string, body: unknown) => {
    const r = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    let j: any = null; try { j = await r.json(); } catch { /* */ }
    return { ok: r.ok, status: r.status, body: j };
  };
  const hook = await call("/webhooks", { hook_url: hookUrl, secret: SECRET });
  if (!hook.ok) return json({ ok: false, step: "webhook", ...hook }, 502);
  const webhookId = hook.body?.id;
  const states = ["hangup", "missed", "voicemail", "call_transcription", "recap_summary", "recording"];
  const sub = await call("/subscriptions/call", { webhook_id: webhookId, call_states: states, enabled: true, group_calls_only: false });
  return json({ ok: hook.ok && sub.ok, webhook_id: webhookId, subscription: sub }, sub.ok ? 200 : 502);
}

// ── handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!SECRET) {
    const { data } = await sb.from("integration_secrets").select("value").eq("name", "dialpad_webhook_secret").maybeSingle();
    SECRET = str(data?.value);
  }
  if (!SECRET) return json({ error: "no Dialpad signing secret configured" }, 500);
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-dialpad-test-token") ?? "";
  if (url.searchParams.get("action") === "register") {
    if (token !== SECRET) return json({ error: "bad or missing token" }, 401);
    return register();
  }

  let raw = (await req.text()).trim();
  // A signed token can also arrive wrapped as a JSON string.
  if (/^"[\w-]+\.[\w-]+\.[\w-]+"$/.test(raw)) raw = raw.slice(1, -1);
  let ev: any = null;
  if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(raw)) ev = await verifyJwt(raw);
  else if (token && token === SECRET) { try { ev = JSON.parse(raw); } catch { /* */ } }
  if (!ev) { await log(false, "rejected: unsigned or bad signature", null, null); return json({ error: "unauthorized" }, 401); }

  const n = normalize(ev);
  if (!n.callId) { await log(false, "no call_id", null, ev); return json({ ok: false, error: "no call_id" }, 422); }
  if (IN_PROGRESS.test(n.state) && !n.aiSummary && !n.transcript && !n.actionItems.length) return json({ ok: true, ignored: n.state });

  // Transcript: from the event when Dialpad includes it, else from the API once the call is over.
  if (!n.transcript && /hangup|transcription|recap/.test(n.state)) n.transcript = await fetchTranscript(n.callId);

  const { data: existing } = await sb.from("activities").select("id,contact_id,owner_id,opportunity_id,company,summary,ai_summary,transcript,action_items,recording_url,duration_min")
    .eq("source", "dialpad").eq("source_event_id", n.callId).maybeSingle();

  let act = existing;
  let contactNote = "existing call updated";
  if (!act) {
    const rep = await resolveRep(n.repEmail, n.repName);
    const company = str(url.searchParams.get("company")) || rep?.company || "Chief Negotiators";
    const { contact, created } = await resolveContact(n.person, company);
    contactNote = created ? "contact placeholder created" : contact ? "matched existing contact" : "no contact";
    const dealId = await openDealFor(contact);
    const who = contact?.name || n.person.name || n.person.phone || "unknown caller";
    const subject = n.missed ? `${/voicemail/.test(n.state) ? "Voicemail" : "Missed call"} — ${who}` : `${n.direction === "inbound" ? "Call from" : "Call with"} ${who}`;
    const { data: made, error } = await sb.from("activities").insert({
      type: "call", contact_id: contact?.id ?? null, opportunity_id: dealId, owner_id: rep?.id ?? null,
      occurred_at: n.occurredAt, duration_min: n.missed ? null : n.durationMin, subject,
      summary: n.aiSummary || null, ai_summary: n.aiSummary || null, transcript: n.transcript || null,
      action_items: n.actionItems.length ? n.actionItems : null, recording_url: n.recordingUrl || null,
      call_direction: n.direction || null, company, source: "dialpad", source_event_id: n.callId, raw: ev,
    }).select("id,contact_id,owner_id,opportunity_id,company").single();
    if (error) {
      // A parallel event for the same call won the insert: update that row instead.
      if (error.code !== "23505") { await log(false, error.message, null, ev); return json({ ok: false, error: error.message }, 500); }
      const { data: again } = await sb.from("activities").select("id,contact_id,owner_id,opportunity_id,company").eq("source", "dialpad").eq("source_event_id", n.callId).maybeSingle();
      act = again;
    } else act = made;
  }
  if (!act) { await log(false, "could not create or find the call", null, ev); return json({ ok: false }, 500); }

  // Later events fill in what's new; nothing already there is blanked.
  const patch: Record<string, unknown> = {};
  if (n.aiSummary) { patch.ai_summary = n.aiSummary; patch.summary = n.aiSummary; }
  if (n.transcript) patch.transcript = n.transcript;
  if (n.actionItems.length) patch.action_items = n.actionItems;
  if (n.recordingUrl) patch.recording_url = n.recordingUrl;
  if (n.durationMin && !n.missed) patch.duration_min = n.durationMin;
  if (existing && Object.keys(patch).length) await sb.from("activities").update(patch).eq("id", act.id);

  // Action items become follow-up tasks for the rep, due the next day.
  let tasks = 0;
  if (n.actionItems.length) {
    const due = new Date(new Date(n.occurredAt).getTime() + 24 * 3600 * 1000);
    due.setUTCHours(16, 0, 0, 0);
    for (let i = 0; i < n.actionItems.length; i++) {
      const { error } = await sb.from("activities").insert({
        type: "task", owner_id: act.owner_id, contact_id: act.contact_id, opportunity_id: act.opportunity_id,
        summary: n.actionItems[i], occurred_at: due.toISOString(), company: act.company,
        source: "dialpad", source_event_id: `${n.callId}:task:${i}`, task_done: false,
      });
      if (!error) tasks++;
    }
  }

  await log(true, `${n.state || "event"}: ${contactNote}${tasks ? `, ${tasks} task(s)` : ""}`, act.id, ev);
  return json({ ok: true, activity_id: act.id, state: n.state, tasks });
});
