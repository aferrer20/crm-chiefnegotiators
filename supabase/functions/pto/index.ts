// pto — time-off requests for both companies (CN and SSP).
//
// Every write to pto_requests comes through here so the side effects happen
// with it: the approver is emailed, the rep hears the decision, and approved
// time off is written to Outlook (the rep's calendar as Out of office, the
// approver's as a free all-day note). CN and SSP are separate Microsoft
// tenants; each mailbox is written with its own tenant's app credentials, as
// calendar-peek reads them.
//
// POST (signed-in user's JWT) { action, ... }
//   request  { start_date, end_date, start_part, end_part, tz, type, coverage_rep_id, note }
//   update   { id, ...same }      dates/parts change -> back to pending
//   cancel   { id }               requester or approver
//   decide   { id, decision: "approve" | "decline", reason }   approver only
//   health   {}                   approver/service: which tenants can write calendars
//
// Approvers are the active admins in reps (Amanda). An approver's own request
// is approved on submit.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "";
const CRM_URL = Deno.env.get("CRM_URL") || "https://cncrm.thechiefnegotiators.com/";
const NOTIFY_TO = "amanda@thechiefnegotiators.com";
const env = (k: string) => Deno.env.get(k) || "";
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();
const TYPES = ["Vacation", "Sick", "Personal", "Holiday", "Conference / travel"];
const PARTS = ["full", "am", "pm"];
const HALF = { am: ["09:00:00", "13:00:00"], pm: ["13:00:00", "17:00:00"] } as const;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// ── dates ──────────────────────────────────────────────────────────────────
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const weekday = (d: string) => new Date(d + "T00:00:00Z").getUTCDay();
// Business days, with a half day at either end counting 0.5.
function countDays(r: any) {
  let n = 0;
  for (let d = r.start_date; d <= r.end_date; d = addDays(d, 1)) {
    if (weekday(d) === 0 || weekday(d) === 6) continue;
    const part = d === r.start_date ? r.start_part : d === r.end_date ? r.end_part : "full";
    n += part === "full" ? 1 : 0.5;
  }
  return n;
}
const fmt = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
function when(r: any) {
  const p = (x: string) => (x === "am" ? " (morning)" : x === "pm" ? " (afternoon)" : "");
  if (r.start_date === r.end_date) return fmt(r.start_date) + p(r.start_part);
  return `${fmt(r.start_date)}${p(r.start_part)} – ${fmt(r.end_date)}${p(r.end_part)}`;
}
const dayWord = (n: number) => `${n % 1 ? n.toFixed(1) : n} day${n === 1 ? "" : "s"}`;

// ── Microsoft Graph (per-tenant app credentials) ─────────────────────────────
function tenantConf(email: string) {
  const domain = low(email).split("@")[1] || "";
  if (domain === "thechiefnegotiators.com")
    return { key: "cn", tenant: env("AZURE_TENANT_ID"), cid: env("AZURE_CLIENT_ID"), sec: env("AZURE_CLIENT_SECRET") };
  if (domain === "strategicsupplypartners.com.au")
    return { key: "ssp", tenant: env("AZURE_SSP_TENANT_ID"), cid: env("AZURE_SSP_CLIENT_ID") || env("AZURE_CLIENT_ID"), sec: env("AZURE_SSP_CLIENT_SECRET") || env("AZURE_CLIENT_SECRET") };
  return null;
}
const tokens = new Map<string, Promise<{ token: string | null; roles: string[]; error?: string }>>();
function tokenFor(email: string) {
  const c = tenantConf(email);
  if (!c || !c.tenant || !c.cid || !c.sec) return Promise.resolve({ token: null, roles: [], error: "no Microsoft tenant configured for this address" });
  if (!tokens.has(c.key)) {
    tokens.set(c.key, (async () => {
      try {
        const r = await fetch(`https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/token`, {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: c.cid, client_secret: c.sec, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
        });
        const j = await r.json();
        if (!r.ok) return { token: null, roles: [], error: String(j.error_description || j.error || r.status).split("\n")[0] };
        let roles: string[] = [];
        try { roles = JSON.parse(atob(j.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).roles || []; } catch { /* opaque token */ }
        return { token: j.access_token as string, roles };
      } catch (e) { return { token: null, roles: [], error: (e as Error).message }; }
    })());
  }
  return tokens.get(c.key)!;
}
async function createEvent(mailbox: string, ev: Record<string, unknown>) {
  const t = await tokenFor(mailbox);
  if (!t.token) throw new Error(t.error || "no token");
  const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/events`, {
    method: "POST", headers: { Authorization: `Bearer ${t.token}`, "Content-Type": "application/json" }, body: JSON.stringify(ev),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Graph ${r.status}`);
  return j.id as string;
}
async function deleteEvent(mailbox: string, id: string) {
  const t = await tokenFor(mailbox);
  if (!t.token) return;
  await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/events/${encodeURIComponent(id)}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${t.token}` },
  }).catch(() => {});
}

// The rep's calendar: Out of office, split so half days block only that half.
function repEvents(r: any) {
  const subject = `Out of office · ${r.type}`;
  const body = { contentType: "text", content: `Approved PTO in the CRM.${r.coverage_name ? ` Coverage: ${r.coverage_name}.` : ""}` };
  const base = { subject, body, showAs: "oof", isReminderOn: false, categories: ["PTO"] };
  const out: Record<string, unknown>[] = [];
  const half = (d: string, p: "am" | "pm") => out.push({ ...base, isAllDay: false,
    start: { dateTime: `${d}T${HALF[p][0]}`, timeZone: r.tz }, end: { dateTime: `${d}T${HALF[p][1]}`, timeZone: r.tz } });
  const allDay = (from: string, to: string) => { if (from <= to) out.push({ ...base, isAllDay: true,
    start: { dateTime: `${from}T00:00:00`, timeZone: r.tz }, end: { dateTime: `${addDays(to, 1)}T00:00:00`, timeZone: r.tz } }); };
  if (r.start_date === r.end_date) {
    if (r.start_part === "full") allDay(r.start_date, r.end_date); else half(r.start_date, r.start_part);
    return out;
  }
  let from = r.start_date, to = r.end_date;
  if (r.start_part === "pm") { half(r.start_date, "pm"); from = addDays(from, 1); }
  if (r.end_part === "am") { half(r.end_date, "am"); to = addDays(to, -1); }
  allDay(from, to);
  return out;
}
// The approver's calendar: one free all-day note across the whole absence.
function ownerEvent(r: any) {
  return {
    subject: `${r.rep_name} OOO · ${r.type}${r.start_part !== "full" || r.end_part !== "full" ? " (part day)" : ""}`,
    body: { contentType: "text", content: `${when(r)} · ${dayWord(Number(r.days))}${r.coverage_name ? ` · Coverage: ${r.coverage_name}` : ""}` },
    isAllDay: true, showAs: "free", isReminderOn: false, categories: ["PTO"],
    start: { dateTime: `${r.start_date}T00:00:00`, timeZone: "America/New_York" },
    end: { dateTime: `${addDays(r.end_date, 1)}T00:00:00`, timeZone: "America/New_York" },
  };
}
async function writeOutlook(r: any, approverEmail: string) {
  const ids: Record<string, unknown> = { rep: [], rep_mailbox: r.rep_email, owner: null, owner_mailbox: approverEmail };
  const errs: string[] = [];
  for (const ev of repEvents(r)) {
    try { (ids.rep as string[]).push(await createEvent(r.rep_email, ev)); }
    catch (e) { errs.push(`${r.rep_name}'s calendar: ${(e as Error).message}`); break; }
  }
  if (low(approverEmail) !== low(r.rep_email)) {
    try { ids.owner = await createEvent(approverEmail, ownerEvent(r)); }
    catch (e) { errs.push(`your calendar: ${(e as Error).message}`); }
  }
  return { ids, error: errs.length ? errs.join("; ").slice(0, 500) : null };
}
async function clearOutlook(r: any) {
  const o = r.outlook || {};
  for (const id of o.rep || []) await deleteEvent(o.rep_mailbox || r.rep_email, id);
  if (o.owner) await deleteEvent(o.owner_mailbox || NOTIFY_TO, o.owner);
}

// ── email ──────────────────────────────────────────────────────────────────
async function mail(to: string, subject: string, html: string, text: string, replyTo?: string) {
  if (!RESEND_API_KEY || !RESEND_FROM) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `"CN Team Calendar" <${RESEND_FROM}>`, to: [to], subject, html, text,
      ...(replyTo ? { reply_to: replyTo } : {}), tags: [{ name: "campaign_id", value: "pto" }] }),
  }).catch(() => {});
}
function card(kicker: string, title: string, rows: [string, string][], buttons: [string, string, boolean][], foot: string) {
  const row = ([k, v]: [string, string]) => v ? `<tr><td style="padding:9px 0;border-top:1px solid #ECE6DA;width:120px;font:600 10.5px Menlo,Consolas,monospace;letter-spacing:.1em;color:#8A6E3E;text-transform:uppercase;vertical-align:top">${esc(k)}</td><td style="padding:9px 0;border-top:1px solid #ECE6DA;font:14.5px/1.5 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1B2433">${esc(v)}</td></tr>` : "";
  const btn = ([label, href, primary]: [string, string, boolean]) => `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 22px;border-radius:6px;font:600 14px -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;text-decoration:none;${primary ? "background:#13254A;color:#fff" : "background:#fff;color:#13254A;border:1px solid #C9BFA9"}">${esc(label)}</a>`;
  return `<!doctype html><html><body style="margin:0;background:#F6F3EC"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F3EC"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#fff;border:1px solid #E6E0D3">
<tr><td style="background:#13254A;padding:22px 30px"><div style="font:600 10.5px Menlo,Consolas,monospace;letter-spacing:.18em;color:#D2B67E">${esc(kicker)}</div><div style="font:400 24px/1.25 Georgia,serif;color:#fff;margin-top:8px">${esc(title)}</div></td></tr>
<tr><td style="padding:18px 30px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows.map(row).join("")}</table></td></tr>
${buttons.length ? `<tr><td style="padding:22px 30px 6px">${buttons.map(btn).join("")}</td></tr>` : ""}
<tr><td style="padding:12px 30px 26px;font:12.5px/1.6 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#776E5F">${esc(foot)}</td></tr>
</table></td></tr></table></body></html>`;
}
const link = (id: string, act?: string) => `${CRM_URL}#pto/${id}${act ? "/" + act : ""}`;
function details(r: any): [string, string][] {
  return [["Who", `${r.rep_name} · ${r.company}`], ["When", when(r)], ["Days", dayWord(Number(r.days)) + " (business days)"],
    ["Type", r.type], ["Coverage", r.coverage_name || ""], ["Note", r.note || ""]];
}
async function notifyApprover(r: any, kind: "new" | "changed" | "cancelled") {
  const title = kind === "cancelled" ? `${r.rep_name} cancelled their PTO` : `${r.rep_name} ${kind === "changed" ? "changed" : "requested"} time off`;
  const buttons: [string, string, boolean][] = kind === "cancelled" ? [["Open the calendar", `${CRM_URL}#calendar`, false]]
    : [["Approve", link(r.id, "approve"), true], ["Decline", link(r.id, "decline"), false]];
  await mail(NOTIFY_TO, `PTO ${kind === "cancelled" ? "cancelled" : kind === "changed" ? "changed" : "request"}: ${r.rep_name} · ${when(r)}`,
    card(kind === "cancelled" ? "PTO CANCELLED" : "PTO REQUEST · NEEDS YOUR APPROVAL", title, details(r), buttons,
      kind === "cancelled" ? "Removed from the CRM calendar and Outlook." : "The buttons open the request in the CRM, where you confirm. Nothing changes until you do."),
    `${title}\n${when(r)} · ${dayWord(Number(r.days))} · ${r.type}${r.coverage_name ? " · Coverage: " + r.coverage_name : ""}${r.note ? "\nNote: " + r.note : ""}\n\nReview: ${link(r.id)}`, r.rep_email);
}
async function notifyRep(r: any, outcome: "approved" | "declined" | "cancelled") {
  const first = String(r.rep_name).split(" ")[0];
  const title = outcome === "approved" ? `${first}, your time off is approved` : outcome === "declined" ? `${first}, your time off was not approved` : `${first}, your time off was cancelled`;
  const rows = details(r).filter(([k]) => k !== "Who" && k !== "Note");
  if (outcome === "declined" && r.decline_reason) rows.push(["Reason", r.decline_reason]);
  const foot = outcome === "approved"
    ? (r.outlook_error ? "It's on the team calendar in the CRM. Outlook could not be updated automatically, so add an Out of office block yourself." : "It's on the team calendar in the CRM and blocked as Out of office in your Outlook.")
    : outcome === "declined" ? "Reply to this email to talk it through." : "It has been removed from the team calendar and your Outlook.";
  await mail(r.rep_email, title + ` · ${when(r)}`, card(`PTO ${outcome.toUpperCase()}`, title, rows, [["Open the calendar", `${CRM_URL}#calendar`, false]], foot),
    `${title}.\n${when(r)} · ${dayWord(Number(r.days))} · ${r.type}${outcome === "declined" && r.decline_reason ? "\nReason: " + r.decline_reason : ""}\n\n${foot}`, NOTIFY_TO);
}

// ── handlers ────────────────────────────────────────────────────────────────
function readFields(b: any, prev?: any) {
  const v = {
    start_date: String(b.start_date ?? prev?.start_date ?? ""), end_date: String(b.end_date ?? b.start_date ?? prev?.end_date ?? ""),
    start_part: String(b.start_part ?? prev?.start_part ?? "full"), end_part: String(b.end_part ?? prev?.end_part ?? "full"),
    tz: String(b.tz ?? prev?.tz ?? "America/New_York").slice(0, 60), type: String(b.type ?? prev?.type ?? "Vacation"),
    coverage_rep_id: b.coverage_rep_id !== undefined ? (b.coverage_rep_id || null) : (prev?.coverage_rep_id ?? null),
    note: String(b.note ?? prev?.note ?? "").trim().slice(0, 1000) || null,
  };
  if (!isDate(v.start_date) || !isDate(v.end_date)) return { error: "Pick a start and end date." };
  if (v.end_date < v.start_date) return { error: "The end date is before the start date." };
  if (Date.parse(v.end_date) - Date.parse(v.start_date) > 90 * 864e5) return { error: "Requests are limited to 90 days. Split longer leave into parts." };
  if (!PARTS.includes(v.start_part) || !PARTS.includes(v.end_part)) return { error: "Unknown part of day." };
  if (v.start_date === v.end_date) v.end_part = v.start_part;
  else { if (v.start_part === "am") v.start_part = "full"; if (v.end_part === "pm") v.end_part = "full"; }
  if (!TYPES.includes(v.type)) return { error: "Unknown type of time off." };
  try { new Intl.DateTimeFormat("en-US", { timeZone: v.tz }); } catch { v.tz = "America/New_York"; }
  return { v };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");

  // verify_jwt has already checked the signature, so the role claim can be trusted.
  let role = "";
  try { role = JSON.parse(atob(bearer.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role || ""; } catch { /* not a JWT */ }
  const isService = bearer === SERVICE_ROLE || role === "service_role";

  // Who is calling, and are they an approver?
  const { data: reps } = await sb.from("reps").select("id,name,email,company,is_admin,off_board");
  const approvers = (reps || []).filter((r: any) => r.is_admin && !r.off_board).map((r: any) => low(r.email));
  let me: any = null;
  if (bearer && bearer !== SERVICE_ROLE && role !== "service_role") {
    const { data } = await sb.auth.getUser(bearer);
    const email = low(data?.user?.email);
    me = (reps || []).find((r: any) => low(r.email) === email && !r.off_board) || null;
  }
  const isApprover = !!me && approvers.includes(low(me.email));
  // health answers yes/no to anyone holding a project key; the role list only to approvers.
  if (!me && action !== "health") return json({ error: "Sign in to the CRM first." }, 401);

  try {
    if (action === "health") {
      const full = isApprover || isService;
      const out: Record<string, unknown> = {};
      for (const [k, mailbox] of [["cn", NOTIFY_TO], ["ssp", "monika@strategicsupplypartners.com.au"]]) {
        const t = await tokenFor(mailbox);
        out[k] = { ok: !!t.token, canWriteCalendars: t.roles.includes("Calendars.ReadWrite"), ...(full ? { roles: t.roles, error: t.error || null } : {}) };
      }
      return json({ ok: true, tenants: out });
    }

    if (action === "request") {
      const f = readFields(b);
      if ("error" in f) return json({ error: f.error }, 422);
      const cov = f.v.coverage_rep_id ? (reps || []).find((r: any) => r.id === f.v.coverage_rep_id) : null;
      const row: any = {
        ...f.v, coverage_name: cov?.name || null, coverage_rep_id: cov?.id || null,
        rep_id: me.id, rep_name: me.name, rep_email: low(me.email), company: me.company || "Chief Negotiators",
      };
      row.days = countDays(row);
      if (row.days === 0) return json({ error: "Those dates fall on a weekend." }, 422);
      const { data: overlap } = await sb.from("pto_requests").select("id").eq("rep_id", me.id).in("status", ["pending", "approved"])
        .lte("start_date", row.end_date).gte("end_date", row.start_date).limit(1);
      if (overlap?.length) return json({ error: "You already have time off requested for some of those dates." }, 409);
      if (isApprover) Object.assign(row, { status: "approved", decided_by: low(me.email), decided_at: new Date().toISOString() });
      const { data: saved, error } = await sb.from("pto_requests").insert(row).select().single();
      if (error) throw error;
      if (saved.status === "approved") {
        const w = await writeOutlook(saved, low(me.email));
        await sb.from("pto_requests").update({ outlook: w.ids, outlook_error: w.error }).eq("id", saved.id);
        return json({ ok: true, request: { ...saved, outlook_error: w.error } });
      }
      await notifyApprover(saved, "new");
      return json({ ok: true, request: saved });
    }

    const { data: r } = await sb.from("pto_requests").select("*").eq("id", String(b.id || "")).maybeSingle();
    if (!r) return json({ error: "That request no longer exists." }, 404);
    const mine = r.rep_id === me.id;

    if (action === "update") {
      if (!mine) return json({ error: "Only the person who asked can change it." }, 403);
      if (!["pending", "approved"].includes(r.status)) return json({ error: `This request is ${r.status}.` }, 409);
      const f = readFields(b, r);
      if ("error" in f) return json({ error: f.error }, 422);
      const cov = f.v.coverage_rep_id ? (reps || []).find((x: any) => x.id === f.v.coverage_rep_id) : null;
      const next: any = { ...f.v, coverage_rep_id: cov?.id || null, coverage_name: cov?.name || null, updated_at: new Date().toISOString() };
      next.days = countDays({ ...r, ...next });
      if (next.days === 0) return json({ error: "Those dates fall on a weekend." }, 422);
      const moved = ["start_date", "end_date", "start_part", "end_part"].some((k) => next[k] !== r[k]);
      const { data: overlap } = await sb.from("pto_requests").select("id").eq("rep_id", me.id).in("status", ["pending", "approved"])
        .neq("id", r.id).lte("start_date", next.end_date).gte("end_date", next.start_date).limit(1);
      if (overlap?.length) return json({ error: "You already have time off requested for some of those dates." }, 409);
      if (r.status === "approved" && (moved || next.type !== r.type || next.coverage_rep_id !== r.coverage_rep_id)) await clearOutlook(r);
      if (moved && !isApprover) Object.assign(next, { status: "pending", decided_by: null, decided_at: null, outlook: {}, outlook_error: null });
      const { data: saved, error } = await sb.from("pto_requests").update(next).eq("id", r.id).select().single();
      if (error) throw error;
      if (saved.status === "approved" && (moved || next.type !== r.type || next.coverage_rep_id !== r.coverage_rep_id)) {
        const w = await writeOutlook(saved, isApprover ? low(me.email) : r.decided_by || NOTIFY_TO);
        await sb.from("pto_requests").update({ outlook: w.ids, outlook_error: w.error }).eq("id", r.id);
        saved.outlook_error = w.error;
      }
      if (saved.status === "pending") await notifyApprover(saved, r.status === "approved" ? "changed" : "new");
      return json({ ok: true, request: saved, reapproval: saved.status === "pending" && r.status === "approved" });
    }

    if (action === "cancel") {
      if (!mine && !isApprover) return json({ error: "Only the person who asked, or an approver, can cancel it." }, 403);
      if (!["pending", "approved"].includes(r.status)) return json({ ok: true, request: r });
      if (r.status === "approved") await clearOutlook(r);
      const { data: saved } = await sb.from("pto_requests").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", r.id).select().single();
      if (mine && !isApprover) await notifyApprover(saved, "cancelled");
      if (!mine) await notifyRep(saved, "cancelled");
      return json({ ok: true, request: saved });
    }

    if (action === "decide") {
      if (!isApprover) return json({ error: "Only an approver can decide." }, 403);
      if (r.status !== "pending") return json({ error: `Already ${r.status}.`, request: r }, 409);
      const approve = b.decision === "approve";
      const patch: any = { status: approve ? "approved" : "declined", decided_by: low(me.email), decided_at: new Date().toISOString(),
        decline_reason: approve ? null : String(b.reason || "").trim().slice(0, 500) || null, updated_at: new Date().toISOString() };
      if (approve) { const w = await writeOutlook({ ...r, ...patch }, low(me.email)); patch.outlook = w.ids; patch.outlook_error = w.error; }
      const { data: saved, error } = await sb.from("pto_requests").update(patch).eq("id", r.id).eq("status", "pending").select().single();
      if (error || !saved) return json({ error: "Someone else just decided this one." }, 409);
      await notifyRep(saved, approve ? "approved" : "declined");
      return json({ ok: true, request: saved });
    }

    return json({ error: `Unknown action ${action}` }, 400);
  } catch (e) {
    return json({ error: "Something went wrong saving that. Try again.", detail: (e as Error).message }, 500);
  }
});
