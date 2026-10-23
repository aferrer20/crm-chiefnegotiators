// daily-brief — the morning helper. Reads the synced mailbox (email_messages,
// filled every 5 minutes by email-sync) and keeps a to-do list in brief_items:
//
//   reply    someone wrote and the owner hasn't answered (team included when
//            they're actually asking for something)
//   silent   the owner wrote and the other side went quiet for
//            FOLLOW_UP_BUSINESS_DAYS (taken from follow_ups, which already
//            tracks those threads and drafts the nudge)
//   promise  the owner said they'd do something ("I'll send it Monday") and
//            nothing later in the thread shows it done
//
// Each new candidate is read once by Claude for a one-line summary, why it
// matters, a 1-3 priority, and whether it really needs action (newsletters,
// FYIs and "thanks!" are dropped). Verdicts are stored, so a thread is never
// re-read until a newer message changes it. Items resolve themselves when the
// thread moves on.
//
// Then, on weekdays, one email at 8am New York time: today's meetings and the
// list, ranked. The same list backs the CRM's Today screen.
//
// POST {}                          cron: scans at 6am and 7am NY; at 7am also sends (once a day)
// POST { mode: "scan" }            scan now, send nothing
// POST { mode: "send", force }     scan + send now (force ignores the once-a-day guard)
// POST { mode: "preview" }         scan + return the email HTML without sending
// Optional { owner: "<email>" }    defaults to BRIEF_OWNER
import Anthropic from "npm:@anthropic-ai/sdk@0.128.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "";
const OWNER = (Deno.env.get("BRIEF_OWNER") || "amanda@thechiefnegotiators.com").toLowerCase();
const CRM_URL = Deno.env.get("CRM_URL") || "https://cncrm.thechiefnegotiators.com/";
const TZ = "America/New_York";
const LOOKBACK_DAYS = 30;
const PROMISE_DAYS = 14;
const MODEL = "claude-opus-5-5";
const READ_VERSION = 2;          // bump when the prompt changes; open items are re-read once
const AI_BATCH = 6;
const AI_PARALLEL = 4;
const AI_MAX_ITEMS = 60;         // per run; a backlog drains over the next runs
const SECTION_MAX = 10;
const TEAM = ["thechiefnegotiators.com", "strategicsupplypartners.com.au", "thevaultmarketingco.com"];

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const H = (extra: Record<string, string> = {}) => ({ apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json", ...extra });
async function sel(path: string, range?: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H(range ? { Range: range } : {}) });
  if (!r.ok) throw new Error(`select ${path.split("?")[0]} → ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}
async function write(method: string, path: string, body: unknown, prefer = "return=minimal") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers: H({ Prefer: prefer }), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${method} ${path.split("?")[0]} → ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return prefer.includes("representation") ? await r.json() : null;
}

const low = (s: unknown) => String(s ?? "").trim().toLowerCase();
const domainOf = (e: string) => low(e).split("@")[1] || "";
const isTeam = (e: string) => { const d = domainOf(e); return TEAM.some((t) => d === t || d.endsWith("." + t)); };
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── noise: mail no person needs to answer ──────────────────────────────────
const NOREPLY = /^(no-?reply|do-?not-?reply|donotreply|noreply[-.\w]*|notifications?|notify|mailer-daemon|postmaster|bounces?|alerts?|newsletters?|news|updates|marketing|automated|system|calendar|invites?|emails?|hello|info|team|support|billing|receipts?|digest|community)([+._-].*)?$/i;
const NOTIFY_HOST = /^(notifications?|notify|alerts?|mail\d*|mailer|mailing|email|e|m|mg|em\d*|bounces?|news(letters?)?|marketing|updates|send(er)?|sg|mc|mta\d*|smtp|msg|comms|transactional|campaigns?|engage|search)\./i;
const AUTO_SUBJECT = /^(accepted|declined|tentative|canceled|cancelled|updated invitation|invitation|automatic reply|auto(matic)?[- ]?reply|out of (the )?office|delivery status|undeliverable|read:)\b/i;
function isNoise(m: any) {
  const from = low(m.from_email);
  const [local, host] = [from.split("@")[0] || "", from.split("@")[1] || ""];
  if (!from || NOREPLY.test(local) || NOTIFY_HOST.test(host)) return true;
  if (AUTO_SUBJECT.test(String(m.subject || "").trim())) return true;
  const body = low(m.body_text).slice(-3000);
  return /\bunsubscribe\b|view (this email )?in (your )?browser|manage (your )?(email )?preferences/.test(body);
}
// "Thomas, Jared" -> "Jared Thomas"; a bare address becomes its local part, capitalised.
function cleanName(name: string, email: string) {
  let n = String(name || "").trim().replace(/^["']|["']$/g, "");
  if (/^[^,@]+,\s*[^,@]+$/.test(n)) { const [last, first] = n.split(/,\s*/); n = `${first} ${last}`; }
  if (!n || n.includes("@")) {
    const local = low(email).split("@")[0].replace(/[._-]+/g, " ").trim();
    n = local.replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return n;
}
// Drop the quoted history under a reply so only what this person wrote is read.
function ownText(body: string) {
  const s = String(body || "").replace(/\r/g, "");
  const cut = s.search(/\n\s*(On .{6,120}wrote:|From: .+\n|-{3,}\s*Original Message|_{8,}|Sent from my )/i);
  return (cut > 0 ? s.slice(0, cut) : s).replace(/\n{3,}/g, "\n\n").trim();
}
const PROMISE = /\b(i'?ll|i will|i'm going to|i am going to|let me (check|confirm|find|look|get|ask|circle|follow)|i can (send|share|get|have)|will (send|share|get back|follow up|circle back|revert|confirm)|(by|before|on) (monday|tuesday|wednesday|thursday|friday|tomorrow|end of (the )?(day|week)|eod|eow|cob))\b/i;

function businessDaysBetween(from: Date, to: Date) {
  let n = 0;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (d < end) { d.setUTCDate(d.getUTCDate() + 1); const wd = d.getUTCDay(); if (wd !== 0 && wd !== 6) n++; }
  return n;
}
function nyParts(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "short" });
  const p: Record<string, string> = {};
  f.formatToParts(d).forEach((x) => (p[x.type] = x.value));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, weekday: p.weekday };
}
const fmtDay = (d = new Date()) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" }).format(d);
const fmtTime = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
function ago(iso: string) {
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (h < 20) return "today";
  const d = Math.round(h / 24);
  return d <= 1 ? "1 day" : `${d} days`;
}

// ── Microsoft Graph (app credentials, as calendar-sync uses) ───────────────
let graphToken: string | null | undefined;
async function graph() {
  if (graphToken !== undefined) return graphToken;
  const tenant = Deno.env.get("AZURE_TENANT_ID"), cid = Deno.env.get("AZURE_CLIENT_ID"), sec = Deno.env.get("AZURE_CLIENT_SECRET");
  if (!tenant || !cid || !sec) return (graphToken = null);
  try {
    const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: cid, client_secret: sec, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
    });
    const j = await r.json();
    graphToken = r.ok ? j.access_token : null;
  } catch { graphToken = null; }
  return graphToken;
}
async function webLinkFor(owner: string, internetMessageId: string) {
  const t = await graph();
  if (!t || !internetMessageId) return null;
  const q = `$filter=internetMessageId eq '${internetMessageId.replace(/'/g, "''")}'&$select=webLink`;
  try {
    const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(owner)}/messages?${encodeURI(q).replace(/\+/g, "%2B")}`, { headers: { Authorization: `Bearer ${t}` } });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.value && j.value[0] && j.value[0].webLink) || null;
  } catch { return null; }
}
async function meetingsToday(owner: string) {
  const t = await graph();
  if (!t) return [];
  const { date } = nyParts();
  // Midnight-to-midnight New York, expressed in UTC (offset from the formatter).
  const probe = new Date(`${date}T12:00:00Z`);
  const nyNoon = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }).format(probe));
  const offsetH = 12 - nyNoon;
  const start = new Date(Date.parse(`${date}T00:00:00Z`) + offsetH * 36e5).toISOString();
  const end = new Date(Date.parse(start) + 24 * 36e5).toISOString();
  const q = new URLSearchParams({ startDateTime: start, endDateTime: end, $select: "subject,start,end,isAllDay,isCancelled,attendees,organizer,location,onlineMeeting", $orderby: "start/dateTime", $top: "30" });
  try {
    const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(owner)}/calendarView?${q}`, { headers: { Authorization: `Bearer ${t}`, Prefer: 'outlook.timezone="UTC"' } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.value || []).filter((e: any) => !e.isCancelled && !e.isAllDay).map((e: any) => {
      const people = [...(e.attendees || []).map((a: any) => a.emailAddress), e.organizer?.emailAddress]
        .filter((a: any) => a && low(a.address) !== owner)
        .map((a: any) => a.name || a.address);
      return {
        subject: e.subject || "Meeting",
        start: e.start?.dateTime ? e.start.dateTime + "Z" : null,
        end: e.end?.dateTime ? e.end.dateTime + "Z" : null,
        with: [...new Set(people)].slice(0, 4),
        where: e.onlineMeeting?.joinUrl ? "Online" : (e.location?.displayName || ""),
      };
    });
  } catch { return []; }
}

// ── AI read ────────────────────────────────────────────────────────────────
const SYSTEM = [
  "You triage a busy founder's inbox into a morning to-do list. The founder is Amanda Ferrer, who runs The Chief Negotiators (AI infrastructure brokerage: power, data center capacity, GPUs) and co-founded Strategic Supply Partners.",
  "For each item you get the kind, the people, and the latest messages of the thread (oldest first).",
  "kind=reply: someone wrote last. include=true only if a real person expects Amanda to answer, decide, send or do something. include=false for newsletters, marketing, notifications, receipts, FYIs, CCs where she isn't asked anything, and closers like 'thanks' or 'sounds good'. Team members count only when they ask her for something.",
  "kind=silent: Amanda wrote last and got no reply. include=true unless her last message clearly needed no answer (a thank-you, a closer, or the deal is plainly dead).",
  "kind=promise: Amanda's message contains a commitment. include=true only if she committed to a concrete action (send, check, intro, call, confirm) and nothing later in the thread shows it done. The summary must start with what Amanda promised, e.g. 'You promised Jeff (Tycapital) the site info before POF.'",
  "summary: one plain sentence under 22 words naming who and what, e.g. 'Juan (1547 Realty) asked for pricing on 2MW in Miami.' For promise, state what she promised.",
  "why: under 16 words on why it matters or what to do next. Concrete, no hype.",
  "priority: 1 = money, a deadline, a senior decision-maker or an active deal waiting on her; 2 = normal business; 3 = low stakes.",
  "person: the real person's name as 'First Last' (fix 'Last, First', drop titles; if a shared inbox like sales@ or info@ wrote, use the name signed in the message). company: the organisation's proper name as written in signatures or the email (e.g. 'TRPS Group', not 'Trpsgroup'); empty if unknown.",
  "Dates: today's date is given. If the thing was already handled, or its deadline or event has clearly passed and nothing is left to do, include=false.",
  "Never invent facts that are not in the messages. Plain language, no em dashes.",
].join("\n");
const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          include: { type: "boolean" },
          summary: { type: "string" },
          why: { type: "string" },
          priority: { type: "integer", enum: [1, 2, 3] },
          person: { type: "string" },
          company: { type: "string" },
        },
        required: ["id", "include", "summary", "why", "priority", "person", "company"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};
function transcript(msgs: any[], owner: string) {
  return msgs.slice(-4).map((m) => {
    const who = low(m.from_email) === owner ? "Amanda" : `${m.from_name || m.from_email}${isTeam(m.from_email) ? " (her team)" : ""}`;
    const when = new Date(m.sent_at).toUTCString().slice(0, 16);
    return `--- ${who} · ${when}\nSubject: ${m.subject || ""}\n${ownText(m.body_text).slice(0, 1200)}`;
  }).join("\n\n");
}
async function aiRead(client: Anthropic, batch: any[]) {
  const today = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date());
  const user = `Today is ${today}.\n\n` + batch.map((c) => [
    `### id=${c.key}`,
    `kind=${c.kind}`,
    `counterpart=${c.counterpart_name || c.counterpart_email}${c.company ? " · " + c.company : ""}${c.is_team ? " (team)" : ""}`,
    c.kind === "silent" ? `Amanda's last message went unanswered for ${c.waitDays} business days.` : "",
    c.thread,
  ].filter(Boolean).join("\n")).join("\n\n");
  const res: any = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: user }],
  } as any);
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return [];
  const text = (res.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  try { return JSON.parse(text).items || []; } catch { return []; }
}
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const q = items.slice();
  await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { while (q.length) await fn(q.shift()!); }));
}

// ── scan ───────────────────────────────────────────────────────────────────
async function scan(owner: string) {
  const reps = await sel(`reps?select=id,email,name`);
  const rep = reps.find((r: any) => low(r.email) === owner);
  if (!rep) throw new Error(`no rep row for ${owner}`);
  const since = new Date(Date.now() - LOOKBACK_DAYS * 864e5).toISOString();

  // Pages of 1000 until the window is read.
  const raw: any[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const page = await sel(`email_messages?select=message_id,conversation_id,account_id,direction,from_email,from_name,to_list,cc_list,subject,body_text,sent_at&rep_id=eq.${rep.id}&sent_at=gte.${encodeURIComponent(since)}&order=sent_at.asc`, `${from}-${from + 999}`);
    raw.push(...page);
    if (page.length < 1000) break;
  }
  const seen = new Set<string>();
  const msgs = raw.filter((m) => { const k = m.message_id || `${m.conversation_id}|${m.sent_at}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const threads = new Map<string, any[]>();
  for (const m of msgs) { if (!m.conversation_id) continue; (threads.get(m.conversation_id) || threads.set(m.conversation_id, []).get(m.conversation_id)!).push(m); }

  const accounts = await sel(`accounts?select=id,name`);
  const acctName = new Map(accounts.map((a: any) => [String(a.id), a.name]));
  const contacts = await sel(`contacts?select=id,email,name`);
  const contactBy = new Map(contacts.filter((c: any) => c.email).map((c: any) => [low(c.email), c]));

  const cands: any[] = [];
  const addr = (list: any) => (Array.isArray(list) ? list : []).map((x: any) => low(x?.email || x?.address || x));
  const now = new Date();

  for (const [cid, ms] of threads) {
    const last = ms[ms.length - 1];
    // reply owed
    if (last.direction === "in" && low(last.from_email) !== owner && !isNoise(last)
        && (addr(last.to_list).includes(owner) || addr(last.cc_list).includes(owner))) {
      const team = isTeam(last.from_email);
      if (team && !addr(last.to_list).includes(owner)) { /* team CCs are FYI */ } else {
        cands.push({
          kind: "reply", conversation_id: cid, anchor_message_id: last.message_id || last.sent_at,
          subject: last.subject, counterpart_name: last.from_name || last.from_email, counterpart_email: low(last.from_email),
          is_team: team, account_id: last.account_id || null, waiting_since: last.sent_at,
          thread: transcript(ms, owner), internet_id: last.message_id,
        });
      }
    }
    // promise made (latest committing message from the owner in the last two weeks)
    const recentOwn = ms.filter((m) => m.direction === "out" && Date.now() - new Date(m.sent_at).getTime() < PROMISE_DAYS * 864e5);
    const promised = [...recentOwn].reverse().find((m) => PROMISE.test(ownText(m.body_text)));
    if (promised) {
      const after = ms.filter((m) => new Date(m.sent_at) >= new Date(promised.sent_at));
      const to = (Array.isArray(promised.to_list) ? promised.to_list : [])[0] || {};
      cands.push({
        kind: "promise", conversation_id: cid, anchor_message_id: promised.message_id || promised.sent_at,
        subject: promised.subject, counterpart_name: to.name || to.email || "", counterpart_email: low(to.email),
        is_team: isTeam(to.email || ""), account_id: promised.account_id || null, waiting_since: promised.sent_at,
        thread: transcript(after, owner), internet_id: promised.message_id,
      });
    }
  }

  // gone quiet: follow_ups already tracks these per rep
  const fus = await sel(`follow_ups?select=conversation_id,last_message_id,last_subject,last_sent_at,to_email,to_name,account_id,contact_id&rep_id=eq.${rep.id}&status=eq.pending&order=last_sent_at.desc&limit=200`);
  for (const f of fus) {
    if (!f.conversation_id || cands.some((c) => c.kind === "reply" && c.conversation_id === f.conversation_id)) continue;
    const waitDays = businessDaysBetween(new Date(f.last_sent_at), now);
    const ms = threads.get(f.conversation_id) || [];
    cands.push({
      kind: "silent", conversation_id: f.conversation_id, anchor_message_id: f.last_message_id || f.last_sent_at,
      subject: f.last_subject, counterpart_name: f.to_name || f.to_email, counterpart_email: low(f.to_email),
      is_team: false, account_id: f.account_id || null, contact_id: f.contact_id || null, waiting_since: f.last_sent_at, waitDays,
      thread: ms.length ? transcript(ms, owner) : `Subject: ${f.last_subject || ""} (thread text not synced)`,
      internet_id: ms.length ? ms[ms.length - 1].message_id : null,
    });
  }

  for (const c of cands) {
    c.key = `${c.kind}|${c.conversation_id}|${c.anchor_message_id}`;
    c.company = c.account_id ? acctName.get(String(c.account_id)) || "" : "";
    const ct: any = contactBy.get(c.counterpart_email);
    if (ct) { c.contact_id = c.contact_id || ct.id; if (!c.counterpart_name || c.counterpart_name.includes("@")) c.counterpart_name = ct.name || c.counterpart_name; }
  }

  // What's already known (AI read once per anchor).
  const existing = await sel(`brief_items?select=id,kind,conversation_id,anchor_message_id,status,summary,web_link,ai&owner_email=eq.${encodeURIComponent(owner)}&created_at=gte.${encodeURIComponent(new Date(Date.now() - 60 * 864e5).toISOString())}`);
  const known = new Map(existing.map((e: any) => [`${e.kind}|${e.conversation_id}|${e.anchor_message_id}`, e]));
  const fresh = cands.filter((c) => !known.has(c.key));
  const reread = cands.filter((c) => { const k: any = known.get(c.key); return k && k.status === "open" && Number(k.ai?.v || 0) < READ_VERSION; });

  // AI read for new candidates, newest first.
  fresh.sort((a, b) => String(b.waiting_since).localeCompare(String(a.waiting_since)));
  const toRead = [...fresh, ...reread].slice(0, AI_MAX_ITEMS);
  const verdict = new Map<string, any>();
  let aiErrors = 0;
  if (ANTHROPIC_KEY && toRead.length) {
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
    const batches: any[][] = [];
    for (let i = 0; i < toRead.length; i += AI_BATCH) batches.push(toRead.slice(i, i + AI_BATCH));
    await pool(batches, AI_PARALLEL, async (b) => {
      try { (await aiRead(client, b)).forEach((v: any) => verdict.set(v.id, v)); } catch (_) { aiErrors++; }
    });
  }

  const rows = toRead.filter((c) => !known.has(c.key)).map((c) => {
    const v = verdict.get(c.key);
    const fallback = !ANTHROPIC_KEY;   // no AI: show everything, plainly worded
    if (!v && !fallback) return null;   // AI failed for this one: retry next run
    const include = v ? v.include : true;
    return {
      owner_email: owner, kind: c.kind, conversation_id: c.conversation_id, anchor_message_id: c.anchor_message_id,
      subject: c.subject, counterpart_name: (v && v.person) || cleanName(c.counterpart_name, c.counterpart_email), counterpart_email: c.counterpart_email, company: (v && v.company) || c.company || null,
      account_id: c.account_id, contact_id: c.contact_id || null, is_team: !!c.is_team,
      summary: v ? v.summary : (c.kind === "reply" ? `${c.counterpart_name} wrote about "${c.subject}".` : c.kind === "silent" ? `No reply from ${c.counterpart_name} on "${c.subject}".` : `You promised a follow-up on "${c.subject}".`),
      why: v ? v.why : "",
      priority: v ? v.priority : 2,
      waiting_since: c.waiting_since,
      status: include ? "open" : "skipped",
      ai: v ? { v: READ_VERSION, model: MODEL, read_at: new Date().toISOString(), internet_id: c.internet_id } : { internet_id: c.internet_id },
    };
  }).filter(Boolean);
  // Open items read by an older prompt get the new reading in place.
  for (const c of toRead.filter((c) => known.has(c.key))) {
    const v = verdict.get(c.key);
    if (!v) continue;
    const k: any = known.get(c.key);
    await write("PATCH", `brief_items?id=eq.${k.id}`, {
      summary: v.summary, why: v.why, priority: v.priority,
      counterpart_name: v.person || cleanName(c.counterpart_name, c.counterpart_email),
      company: v.company || c.company || null,
      status: v.include ? "open" : "skipped",
      ai: { ...(k.ai || {}), v: READ_VERSION, model: MODEL, read_at: new Date().toISOString(), internet_id: c.internet_id },
    });
  }
  if (rows.length) await write("POST", "brief_items?on_conflict=owner_email,kind,conversation_id,anchor_message_id", rows, "resolution=ignore-duplicates,return=minimal");

  // Anything still open that is no longer a candidate has been handled.
  const live = new Set(cands.map((c) => c.key));
  const stale = existing.filter((e: any) => ["open", "snoozed"].includes(e.status) && !live.has(`${e.kind}|${e.conversation_id}|${e.anchor_message_id}`));
  for (let i = 0; i < stale.length; i += 100) {
    const ids = stale.slice(i, i + 100).map((e: any) => e.id).join(",");
    await write("PATCH", `brief_items?id=in.(${ids})`, { status: "resolved" });
  }
  // Snoozes that have come due reopen.
  await write("PATCH", `brief_items?owner_email=eq.${encodeURIComponent(owner)}&status=eq.snoozed&snooze_until=lte.${encodeURIComponent(new Date().toISOString())}`, { status: "open", snooze_until: null });

  return { messages: msgs.length, threads: threads.size, candidates: cands.length, read: toRead.length, reread: reread.length, backlog: fresh.length + reread.length - toRead.length, aiErrors, resolved: stale.length };
}

// ── the email ──────────────────────────────────────────────────────────────
const C = { ink: "#17150F", body: "#3B362C", muted: "#857C6C", hair: "#E9E3D6", gold: "#A88A4F", paper: "#FBF9F5", card: "#FFFFFF", p1: "#8E3B2E" };
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
function itemRow(it: any) {
  const who = `${esc(it.counterpart_name || it.counterpart_email)}${it.company ? ` <span style="color:${C.muted}">· ${esc(it.company)}</span>` : ""}${it.is_team ? ` <span style="font:600 9.5px ${SANS};letter-spacing:.12em;color:${C.gold};border:1px solid ${C.hair};border-radius:3px;padding:1px 5px;margin-left:4px">TEAM</span>` : ""}`;
  const wait = it.waiting_since ? ago(it.waiting_since) : "";
  const meta = it.kind === "reply" ? `waiting ${wait}` : it.kind === "silent" ? `quiet ${wait}` : `promised ${wait} ago`.replace("today ago", "today");
  const link = it.web_link ? `<a href="${esc(it.web_link)}" style="color:${C.gold};text-decoration:none;font:600 12px ${SANS}">Open in Outlook &rarr;</a>` : "";
  return `<tr><td style="padding:16px 0;border-top:1px solid ${C.hair}">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      <td style="vertical-align:top;width:14px;padding-top:6px">${it.priority === 1 ? `<div style="width:6px;height:6px;border-radius:3px;background:${C.p1}"></div>` : `<div style="width:6px;height:6px;border-radius:3px;background:${C.hair}"></div>`}</td>
      <td style="vertical-align:top">
        <div style="font:600 14px/1.4 ${SANS};color:${C.ink}">${who}</div>
        <div style="font:15px/1.55 ${SERIF};color:${C.body};margin-top:3px">${esc(it.summary)}</div>
        ${it.why ? `<div style="font:13px/1.5 ${SANS};color:${C.muted};margin-top:4px">${esc(it.why)}</div>` : ""}
        <div style="margin-top:8px;font:12px ${SANS};color:${C.muted}">${esc(meta)}${link ? ` &nbsp;·&nbsp; ${link}` : ""}</div>
      </td></tr></table>
  </td></tr>`;
}
function section(title: string, note: string, items: any[], total: number) {
  if (!items.length) return "";
  const more = total > items.length ? `<tr><td style="padding:14px 0 0;border-top:1px solid ${C.hair};font:13px ${SANS};color:${C.muted}">+ ${total - items.length} more on your Today screen</td></tr>` : "";
  return `<tr><td style="padding:34px 40px 0">
    <div style="font:600 10.5px ${SANS};letter-spacing:.2em;color:${C.gold}">${esc(title.toUpperCase())} &nbsp;<span style="color:${C.muted};letter-spacing:.05em">${total}</span></div>
    <div style="font:13px ${SANS};color:${C.muted};margin:6px 0 4px">${esc(note)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${items.map(itemRow).join("")}${more}</table>
  </td></tr>`;
}
function renderBrief(p: any) {
  const first = String(p.ownerName || "").split(/\s+/)[0] || "";
  const meet = p.meetings.length ? `<tr><td style="padding:30px 40px 0">
      <div style="font:600 10.5px ${SANS};letter-spacing:.2em;color:${C.gold}">TODAY'S MEETINGS</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px">${p.meetings.map((m: any) => `
        <tr><td style="padding:10px 0;border-top:1px solid ${C.hair};width:84px;vertical-align:top;font:600 13px ${SANS};color:${C.ink}">${m.start ? esc(fmtTime(m.start)) : ""}</td>
        <td style="padding:10px 0;border-top:1px solid ${C.hair};vertical-align:top"><div style="font:15px ${SERIF};color:${C.ink}">${esc(m.subject)}</div>
        <div style="font:12.5px ${SANS};color:${C.muted};margin-top:2px">${esc([m.with.join(", "), m.where].filter(Boolean).join(" · "))}</div></td></tr>`).join("")}
      </table></td></tr>` : "";
  const total = p.counts.reply + p.counts.silent + p.counts.promise;
  const headline = total === 0 ? "Inbox zero on what matters. Enjoy it." : `${total} thing${total === 1 ? "" : "s"} need${total === 1 ? "s" : ""} you today.`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your day</title></head>
<body style="margin:0;padding:0;background:${C.paper}">
<div style="display:none;max-height:0;overflow:hidden">${esc(p.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.paper}"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:${C.card};border:1px solid ${C.hair};border-radius:14px">
  <tr><td style="padding:36px 40px 0">
    <div style="font:600 10.5px ${SANS};letter-spacing:.24em;color:${C.gold}">THE CHIEF NEGOTIATORS · DAILY BRIEF</div>
    <div style="font:400 30px/1.2 ${SERIF};color:${C.ink};margin-top:14px">Good morning${first ? ", " + esc(first) : ""}.</div>
    <div style="font:15px/1.5 ${SANS};color:${C.body};margin-top:8px">${esc(fmtDay())}. ${esc(headline)}</div>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:22px"><tr>
      ${[["Replies owed", p.counts.reply], ["Gone quiet", p.counts.silent], ["Promises", p.counts.promise]].map(([l, n]) => `<td style="padding:0 28px 0 0"><div style="font:400 26px ${SERIF};color:${C.ink}">${n}</div><div style="font:12px ${SANS};color:${C.muted};margin-top:2px">${l}</div></td>`).join("")}
    </tr></table>
    <div style="height:1px;background:${C.hair};margin-top:26px"></div>
  </td></tr>
  ${meet}
  ${section("Do first", "Highest stakes, oldest first.", p.first, p.first.length)}
  ${section("Replies owed", "They wrote, you haven't answered.", p.reply, p.counts.replyRest)}
  ${section("Gone quiet", "You wrote, no answer after 5 business days. A drafted nudge is waiting in the CRM.", p.silent, p.counts.silentRest)}
  ${section("Promises you made", "You said you would. Nothing in the thread shows it done yet.", p.promise, p.counts.promiseRest)}
  <tr><td style="padding:34px 40px 36px">
    <a href="${esc(CRM_URL)}#today" style="display:inline-block;background:${C.ink};color:#fff;text-decoration:none;font:600 13px ${SANS};padding:12px 20px;border-radius:8px">Open Today in the CRM</a>
    <div style="font:12px/1.6 ${SANS};color:${C.muted};margin-top:18px">Built from your amanda@ inbox overnight. Mark items done or snooze them on the Today screen and they leave tomorrow's brief.</div>
  </td></tr>
</table></td></tr></table></body></html>`;
}
function renderText(p: any) {
  const line = (it: any) => `- ${it.counterpart_name}${it.company ? " (" + it.company + ")" : ""}: ${it.summary}${it.why ? " " + it.why : ""}`;
  const block = (t: string, xs: any[]) => (xs.length ? `\n${t}\n${xs.map(line).join("\n")}\n` : "");
  return `Good morning. ${fmtDay()}.\n${p.counts.reply} replies owed, ${p.counts.silent} gone quiet, ${p.counts.promise} promises.\n`
    + (p.meetings.length ? `\nTODAY'S MEETINGS\n${p.meetings.map((m: any) => `- ${m.start ? fmtTime(m.start) : ""} ${m.subject}${m.with.length ? " with " + m.with.join(", ") : ""}`).join("\n")}\n` : "")
    + block("DO FIRST", p.first) + block("REPLIES OWED", p.reply) + block("GONE QUIET", p.silent) + block("PROMISES YOU MADE", p.promise)
    + `\nOpen Today in the CRM: ${CRM_URL}#today\n`;
}

async function compose(owner: string) {
  const items = await sel(`brief_items?select=*&owner_email=eq.${encodeURIComponent(owner)}&status=eq.open&order=priority.asc,waiting_since.asc&limit=500`);
  const by = (k: string) => items.filter((i: any) => i.kind === k);
  const first = items.filter((i: any) => i.priority === 1).slice(0, 3);
  const firstIds = new Set(first.map((i: any) => i.id));
  const rest = (k: string) => by(k).filter((i: any) => !firstIds.has(i.id));
  const shown = [...first, ...rest("reply").slice(0, SECTION_MAX), ...rest("silent").slice(0, SECTION_MAX), ...rest("promise").slice(0, SECTION_MAX)];
  // Outlook links for what's shown (stored, so each is looked up once).
  for (const it of shown) {
    if (it.web_link || !it.ai?.internet_id) continue;
    const link = await webLinkFor(owner, it.ai.internet_id);
    if (link) { it.web_link = link; await write("PATCH", `brief_items?id=eq.${it.id}`, { web_link: link }).catch(() => {}); }
  }
  const rep = (await sel(`reps?select=name&email=ilike.${encodeURIComponent(owner)}`))[0] || {};
  const meetings = await meetingsToday(owner);
  const counts = {
    reply: by("reply").length, silent: by("silent").length, promise: by("promise").length,
    replyRest: rest("reply").length, silentRest: rest("silent").length, promiseRest: rest("promise").length,
  };
  const p = {
    ownerName: owner.startsWith("amanda@") ? "Amanda" : rep.name || "",
    counts, meetings, first,
    reply: rest("reply").slice(0, SECTION_MAX), silent: rest("silent").slice(0, SECTION_MAX), promise: rest("promise").slice(0, SECTION_MAX),
    preheader: `${counts.reply} replies owed · ${counts.silent} gone quiet · ${counts.promise} promises${meetings.length ? ` · ${meetings.length} meeting${meetings.length === 1 ? "" : "s"}` : ""}`,
  };
  return p;
}

async function send(owner: string, p: any, briefDate: string) {
  if (!RESEND_API_KEY || !RESEND_FROM) throw new Error("Resend is not configured");
  const day = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(new Date());
  const subject = `Your ${day}: ${p.counts.reply} replies owed · ${p.counts.silent} gone quiet · ${p.counts.promise} promises`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `"CN Daily Brief" <${RESEND_FROM}>`, to: [owner], subject,
      html: renderBrief(p), text: renderText(p),
      tags: [{ name: "campaign_id", value: `brief-${briefDate}` }],
    }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out?.message || `Resend ${r.status}`);
  return out.id as string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: any = {}; try { body = await req.json(); } catch { /* cron sends {} */ }
  const owner = low(body.owner || OWNER);
  const mode = String(body.mode || "cron");
  const ny = nyParts();
  try {
    if (mode === "cron") {
      const weekday = !["Sat", "Sun"].includes(ny.weekday);
      if (!weekday || (ny.hour !== 6 && ny.hour !== 7)) return json({ ok: true, skipped: `not a brief hour (${ny.weekday} ${ny.hour}:00 NY)` });
      const scanned = await scan(owner);
      if (ny.hour === 6) return json({ ok: true, mode: "prescan", scanned });
      const already = await sel(`daily_briefs?select=id,sent_at&owner_email=eq.${encodeURIComponent(owner)}&brief_date=eq.${ny.date}`);
      if (already[0]?.sent_at) return json({ ok: true, skipped: "already sent today", scanned });
      const p = await compose(owner);
      const id = await send(owner, p, ny.date);
      await write("POST", "daily_briefs?on_conflict=owner_email,brief_date", { owner_email: owner, brief_date: ny.date, payload: { counts: p.counts, meetings: p.meetings.length }, sent_at: new Date().toISOString(), resend_id: id }, "resolution=merge-duplicates,return=minimal");
      return json({ ok: true, sent: id, counts: p.counts, scanned });
    }
    const scanned = await scan(owner);
    if (mode === "scan") return json({ ok: true, scanned });
    const p = await compose(owner);
    if (mode === "preview") return new Response(renderBrief(p), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    if (mode === "send") {
      const already = await sel(`daily_briefs?select=id,sent_at&owner_email=eq.${encodeURIComponent(owner)}&brief_date=eq.${ny.date}`);
      if (already[0]?.sent_at && !body.force) return json({ ok: true, skipped: "already sent today" });
      const id = await send(owner, p, ny.date);
      await write("POST", "daily_briefs?on_conflict=owner_email,brief_date", { owner_email: owner, brief_date: ny.date, payload: { counts: p.counts, meetings: p.meetings.length, manual: true }, sent_at: new Date().toISOString(), resend_id: id }, "resolution=merge-duplicates,return=minimal");
      return json({ ok: true, sent: id, counts: p.counts, scanned });
    }
    return json({ error: `unknown mode ${mode}` }, 400);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
