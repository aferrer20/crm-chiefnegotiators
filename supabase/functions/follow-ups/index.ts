// follow-ups — finds conversations where the prospect went quiet and drafts
// the next email for the rep to approve.
//
// A thread qualifies when its LAST tracked message was sent by a rep, at least
// FOLLOW_UP_BUSINESS_DAYS business days ago, and nobody outside the team has
// written since. Each qualifying thread gets one `follow_ups` row (keyed on the
// conversation + the message being followed up), so a second silence after a
// follow-up produces a fresh draft rather than a duplicate.
//
// Drafts are written by Claude from the real thread when ANTHROPIC_API_KEY is
// set as a function secret; otherwise a short proven template is used. Nothing
// is ever sent from here — the rep approves each one in the CRM and it goes out
// from their own Outlook, as a reply in the original thread.
//
// Rows resolve themselves: a newer message in the thread (their reply, or the
// rep following up by hand) marks the pending draft `resolved`.
//
// POST {}                 → full pass (cron)
// POST { id }             → re-draft one follow-up (the "Rewrite" button)
import Anthropic from "npm:@anthropic-ai/sdk@0.128.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const BUSINESS_DAYS = Number(Deno.env.get("FOLLOW_UP_BUSINESS_DAYS") || 5);
const LOOKBACK_DAYS = 45;          // older silences are cold, not follow-ups
const MAX_ATTEMPTS = 3;            // never draft a 4th unanswered nudge
const MAX_AI_PER_RUN = 25;         // keeps a backlog from stalling one run
const MODEL = "claude-opus-5-5";
const INTERNAL = new Set(["thechiefnegotiators.com", "strategicsupplypartners.com.au", "thevaultmarketingco.com"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const H = (extra: Record<string, string> = {}) => ({ apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json", ...extra });
async function sel(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H() });
  if (!r.ok) throw new Error(`select ${path.split("?")[0]} → ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}
async function write(method: string, path: string, body: unknown, prefer = "return=minimal") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers: H({ Prefer: prefer }), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${method} ${path.split("?")[0]} → ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return prefer.includes("representation") ? await r.json() : null;
}

function domainOf(e: string) { return String(e || "").toLowerCase().split("@")[1] || ""; }
function isInternal(e: string) {
  const d = domainOf(e);
  return !d || [...INTERNAL].some((x) => d === x || d.endsWith("." + x));
}
// Business days elapsed between two instants (Mon–Fri, whole days).
function businessDaysBetween(from: Date, to: Date) {
  let n = 0;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}
function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}
function firstName(s: string) { return String(s || "").trim().split(/\s+/)[0] || ""; }
function reSubject(s: string) {
  const base = String(s || "").replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "").trim();
  return base ? "Re: " + base : "Following up";
}

// ── drafting ──────────────────────────────────────────────────────────────
const SYSTEM = [
  "You write follow-up emails for senior B2B sales reps who sell AI infrastructure (power, data center capacity, GPUs, hosting).",
  "Write the next email in an existing thread where the prospect has not replied.",
  "Rules:",
  "- 50 to 110 words. Plain text only. No subject line, no markdown, no bullet lists.",
  "- Open with the person's first name and a comma. Never open with 'Just checking in', 'Just following up', 'Circling back', 'Bumping this' or 'I hope this finds you well'.",
  "- Add one new reason to reply that builds on what was already said in the thread. Do not repeat the previous email or invent facts, prices, capacity, names or dates that are not in the thread.",
  "- End with one specific, low-effort question the person can answer in a line.",
  "- Match the tone of the rep's earlier emails in the thread.",
  "- Sign off with the rep's first name only on its own line.",
  "Return only the email body.",
].join("\n");

async function aiDraft(client: Anthropic, ctx: { repName: string; toName: string; company: string; attempt: number; thread: any[] }) {
  const transcript = ctx.thread.map((m) => {
    const who = m.direction === "out" ? `${ctx.repName || "Rep"} (rep)` : (m.from_name || m.from_email || "Prospect");
    const when = new Date(m.sent_at).toUTCString().slice(0, 16);
    const body = String(m.body_text || "").replace(/\n{3,}/g, "\n\n").slice(0, 1800);
    return `--- ${who} · ${when}\nSubject: ${m.subject || ""}\n${body}`;
  }).join("\n\n");
  const user = [
    `Rep: ${ctx.repName || "the rep"}`,
    `Prospect: ${ctx.toName || "unknown"}${ctx.company ? " at " + ctx.company : ""}`,
    `This will be unanswered follow-up number ${ctx.attempt}.`,
    "",
    "Thread so far, oldest first:",
    transcript,
  ].join("\n");
  const res: any = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  } as any);
  if (res.stop_reason === "refusal") return "";
  const text = (res.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
  return text;
}

function templateDraft(ctx: { repName: string; toName: string; company: string; attempt: number; lastSubject: string }) {
  const hi = firstName(ctx.toName) ? `${firstName(ctx.toName)},` : "Hi,";
  const sign = firstName(ctx.repName) || "";
  const topic = String(ctx.lastSubject || "").replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "").trim();
  const lines = ctx.attempt >= 3
    ? [hi, "", `I'll close the loop on ${topic ? "\"" + topic + "\"" : "this"} for now so I'm not filling your inbox.`, "", `If the timing changes${ctx.company ? " for " + ctx.company : ""}, a one-line reply is all it takes and I'll pick it straight back up. Is there someone else on your side I should be speaking with in the meantime?`]
    : ctx.attempt === 2
      ? [hi, "", `Coming back to ${topic ? "\"" + topic + "\"" : "my last note"} with one practical question.`, "", `Is this something ${ctx.company || "your team"} is planning for this quarter, or later in the year? Either answer helps me send you only what's relevant.`]
      : [hi, "", `Wanted to make sure ${topic ? "my note on \"" + topic + "\"" : "my last note"} didn't get buried.`, "", `If it's useful, I can send a short summary of what's available that fits your requirements. Would that be worth a look this week?`];
  return lines.concat(sign ? ["", sign] : []).join("\n");
}

// ── pass ──────────────────────────────────────────────────────────────────
async function run(onlyId: string | null) {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 864e5).toISOString();
  const [msgs, reps, contacts, accounts, existing] = await Promise.all([
    sel(`email_messages?select=message_id,conversation_id,direction,sent_at,rep_id,account_id,from_email,from_name,to_list,subject,body_text&conversation_id=not.is.null&sent_at=gte.${since}&order=sent_at.asc&limit=5000`),
    sel("reps?select=id,name,email,off_board"),
    sel("contacts?select=id,name,email,account_id&email=not.is.null"),
    sel("accounts?select=id,name"),
    sel("follow_ups?select=id,conversation_id,last_message_id,status&order=created_at.desc&limit=5000"),
  ]);
  const repById: Map<string, any> = new Map(reps.map((r: any) => [String(r.id), r]));
  const contactByEmail: Map<string, any> = new Map(contacts.map((c: any) => [String(c.email).toLowerCase(), c]));
  const acctName: Map<string, any> = new Map(accounts.map((a: any) => [String(a.id), a.name]));

  // One message can be logged once per account it touched; collapse to one.
  const byConv = new Map<string, any[]>();
  const seenMsg = new Set<string>();
  for (const m of msgs) {
    if (seenMsg.has(m.message_id)) continue;
    seenMsg.add(m.message_id);
    const l = byConv.get(m.conversation_id) || [];
    l.push(m); byConv.set(m.conversation_id, l);
  }
  const have = new Set(existing.map((f: any) => f.conversation_id + "|" + f.last_message_id));

  // Resolve pending drafts whose thread moved on.
  const stale = existing.filter((f: any) => f.status === "pending").filter((f: any) => {
    const l = byConv.get(f.conversation_id);
    return l && l[l.length - 1].message_id !== f.last_message_id;
  });
  for (const f of stale) await write("PATCH", `follow_ups?id=eq.${f.id}`, { status: "resolved", updated_at: new Date().toISOString() });

  const client = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;
  let created = 0, ai = 0, skipped = 0;
  const now = new Date();

  const candidates: any[] = [];
  for (const [conv, list] of byConv) {
    const last = list[list.length - 1];
    if (last.direction !== "out") continue;
    const rep = repById.get(String(last.rep_id));
    // Only mailboxes a real rep can send from. The off-boarded shared inbox is
    // monitored for replies, not worked for follow-ups.
    if (!rep || /^admin$/i.test(String(rep.name || ""))) continue;
    if (businessDaysBetween(new Date(last.sent_at), now) < BUSINESS_DAYS) continue;
    if (have.has(conv + "|" + last.message_id)) continue;
    // Consecutive unanswered rep emails at the end of the thread.
    let attempt = 0;
    for (let i = list.length - 1; i >= 0 && list[i].direction === "out"; i--) attempt++;
    if (attempt > MAX_ATTEMPTS) { skipped++; continue; }
    const to = (last.to_list || []).map((r: any) => r && r.email).find((e: string) => e && !isInternal(e));
    if (!to) { skipped++; continue; }
    candidates.push({ conv, list, last, rep, attempt, to });
  }

  for (const c of candidates) {
    const toRec = (c.last.to_list || []).find((r: any) => String(r.email || "").toLowerCase() === String(c.to).toLowerCase()) || {};
    const contact = contactByEmail.get(String(c.to).toLowerCase());
    const toName = (contact && contact.name) || toRec.name || "";
    const company = (c.last.account_id && acctName.get(String(c.last.account_id))) || "";
    const ctx = { repName: c.rep.name || "", toName, company, attempt: c.attempt, thread: c.list.slice(-6), lastSubject: c.last.subject || "" };
    let text = "", source = "template";
    if (client && ai < MAX_AI_PER_RUN) {
      try { text = await aiDraft(client, ctx); if (text) { source = "ai"; ai++; } } catch (_) { /* fall back to the template */ }
    }
    if (!text) text = templateDraft(ctx);
    await write("POST", "follow_ups?on_conflict=conversation_id,last_message_id", {
      conversation_id: c.conv, rep_id: String(c.rep.id), contact_id: contact ? contact.id : null,
      account_id: c.last.account_id || null, to_email: c.to, to_name: toName,
      last_message_id: c.last.message_id, last_subject: c.last.subject || "", last_sent_at: c.last.sent_at,
      due_at: addBusinessDays(new Date(c.last.sent_at), BUSINESS_DAYS).toISOString(),
      draft_subject: reSubject(c.last.subject), draft_text: text, draft_source: source, status: "pending",
    }, "resolution=ignore-duplicates,return=minimal");
    created++;
  }

  // Single re-draft on request.
  let redrafted = null;
  if (onlyId) {
    const [f] = await sel(`follow_ups?id=eq.${encodeURIComponent(onlyId)}&select=*`);
    if (f) {
      const list = byConv.get(f.conversation_id) || [];
      const rep: any = repById.get(String(f.rep_id)) || {};
      let attempt = 0;
      for (let i = list.length - 1; i >= 0 && list[i].direction === "out"; i--) attempt++;
      const ctx = { repName: rep.name || "", toName: f.to_name || "", company: (f.account_id && acctName.get(String(f.account_id))) || "", attempt: attempt || 1, thread: list.slice(-6), lastSubject: f.last_subject || "" };
      let text = "", source = "template";
      if (client) { try { text = await aiDraft(client, ctx); if (text) source = "ai"; } catch (_) { } }
      if (!text) text = templateDraft(ctx);
      await write("PATCH", `follow_ups?id=eq.${f.id}`, { draft_text: text, draft_source: source, updated_at: new Date().toISOString() });
      redrafted = { id: f.id, draft_text: text, draft_source: source };
    }
  }
  return { ok: true, aiEnabled: !!client, candidates: candidates.length, created, ai, skipped, resolved: stale.length, redrafted };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let body: any = {};
  try { body = await req.json(); } catch { /* cron sends no body */ }
  try {
    return json(await run(body && body.id ? String(body.id) : null));
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
