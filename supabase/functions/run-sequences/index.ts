// ─────────────────────────────────────────────────────────────────────────
// run-sequences — the scheduled sequence runner.
//
// Runs on a 15-minute cron and sends whatever step is due, whether anyone has
// the app open or not.
//
// The evaluation rules are the SAME as the browser's, deliberately restated
// here rather than shared: a browser module cannot be imported by an edge
// function, and a runner that silently disagreed with the UI preview would be
// worse than no runner. Any change to branch logic must be made in both.
//
// POST ?dry=1 reports what WOULD happen for every enrolled person without
// sending. Add &sequence=<id> to limit the report to one sequence. Every
// detail row carries { sequenceId, sequence, contactId, contact, step, status,
// detail } where status is one of:
//   would_send · waiting · skipped · done · stopped · error
//
// Delivery reconciliation: a send is only "delivered" once Resend says so, and
// that normally arrives by webhook. When a webhook is lost (endpoint down, a
// rejected insert) the send looks sent-but-never-delivered forever. Each run
// therefore asks Resend directly about recent sends that still have no
// delivered/bounced record, and writes what it learns into campaign_events.
//
// Brand-aware From: an SSP sequence (brand_key = 'ssp') leaves from the
// verified SSP domain (RESEND_FROM_SSP) so replies and DKIM line up with the
// brand; everything else uses RESEND_FROM. The display name is the sequence's
// from_name when set; reply_to is from_email.
// ─────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("RESEND_FROM") || "";
const FROM_EMAIL_SSP = Deno.env.get("RESEND_FROM_SSP") || "";

// Reconciliation budget per run. Resend allows ~2 requests/second; 40 lookups
// at 550ms is ~22s, well inside the function's time limit, and a backlog
// drains over a few runs.
const RECONCILE_MAX = 40;
const RECONCILE_MIN_AGE_MS = 20 * 60000;      // give the webhook a chance first
const RECONCILE_MAX_AGE_MS = 30 * 864e5;      // stop asking about month-old sends
const GAP_MS = 550;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function sbHeaders(extra: Record<string, string> = {}) {
  return { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json", ...extra };
}
async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`${path.split("?")[0]} → ${res.status}`);
  return await res.json();
}
// Writes are checked. An unchecked insert is how sends went missing from the
// reports: the row was rejected and nobody heard about it.
async function sbInsert(table: string, row: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: sbHeaders({ Prefer: "return=minimal" }), body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`insert ${table} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── brand routing ──────────────────────────────────────────────────────────
function isSspSeq(seq: any) {
  return String(seq?.brand_key || "").toLowerCase() === "ssp";
}
function baseFromFor(seq: any) {
  if (isSspSeq(seq) && FROM_EMAIL_SSP) return FROM_EMAIL_SSP;
  return FROM_EMAIL;
}
function fromHeaderFor(seq: any) {
  const addr = baseFromFor(seq);
  const name = String(seq?.from_name || "").trim();
  if (!addr) return "";
  if (/[<>]/.test(addr)) return addr;
  return name ? `${name} <${addr}>` : addr;
}

// ── merge ────────────────────────────────────────────────────────────────
const SYNTAXES: RegExp[] = [
  /\{\{\s*([\w .-]+?)\s*\}\}/g,
  /\[\[\s*([\w .-]+?)\s*\]\]/g,
  /\*\|\s*([\w .-]+?)\s*\|\*/g,
  /%%\s*([\w .-]+?)\s*%%/g,
  /\$\{\s*([\w .-]+?)\s*\}/g,
];
const ALIASES: Record<string, string> = {
  firstname: "first_name", fname: "first_name", givenname: "first_name",
  lastname: "last_name", lname: "last_name", surname: "last_name",
  fullname: "full_name", name: "full_name",
  company: "company", companyname: "company", account: "company", organisation: "company", organization: "company",
  title: "title", jobtitle: "title", role: "title",
  email: "email", emailaddress: "email",
  sendername: "sender_name", fromname: "sender_name",
  sendertitle: "sender_title", senderemail: "sender_email",
  unsubscribeurl: "unsubscribe_url",
};
function canonical(k: string) {
  const flat = k.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return ALIASES[flat] || k.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[ .-]+/g, "_").toLowerCase();
}
function merge(str: string, ctx: Record<string, string>) {
  let s = String(str ?? "");
  for (const re of SYNTAXES) {
    s = s.replace(new RegExp(re.source, "g"), (_m, k) => {
      const v = ctx[canonical(k)];
      return v != null && v !== "" ? v : "";
    });
  }
  return s;
}

// ── evaluation ───────────────────────────────────────────────────────────
function lastSend(en: any) {
  const sends = (en.history || []).filter((x: any) => x.result === "sent");
  return sends.length ? sends[sends.length - 1] : null;
}
// What the person did SINCE a given moment. The window matters: an open from
// last month must not satisfy "did they open the last email".
function folded(events: any[], sinceIso: string) {
  const since = sinceIso ? new Date(sinceIso).getTime() : 0;
  const out = { opened: false, clicked: false, replied: false, stopped: false };
  (events || []).forEach((e) => {
    if (new Date(e.occurred_at).getTime() < since) return;
    if (e.type === "opened") out.opened = true;
    if (e.type === "clicked") { out.clicked = true; out.opened = true; }
    if (e.type === "replied") out.replied = true;
    if (e.type === "unsubscribed" || e.type === "bounced" || e.type === "complained") out.stopped = true;
  });
  return out;
}

// ── delivery reconciliation ──────────────────────────────────────────────
// Resend's last_event for an email, mapped to the event we record. Anything
// past "delivered" (opened, clicked) proves delivery; we record only the
// delivery itself because Resend does not say WHEN the open happened.
const LAST_EVENT_MAP: Record<string, string> = {
  delivered: "delivered", opened: "delivered", clicked: "delivered",
  bounced: "bounced", complained: "complained",
};
async function reconcile(seqs: any[], eventsByContact: Record<string, any[]>) {
  const out = { checked: 0, recorded: 0, pending: 0, errors: 0 };
  if (!RESEND_KEY) return out;
  const now = Date.now();
  const todo: { seq: any; en: any; h: any }[] = [];
  for (const seq of seqs) {
    for (const en of seq.enrollments || []) {
      for (const h of en.history || []) {
        if (h.result !== "sent" || !h.id) continue;
        const age = now - new Date(h.at).getTime();
        if (age < RECONCILE_MIN_AGE_MS || age > RECONCILE_MAX_AGE_MS) continue;
        const prefix = `seq-${seq.id}-${h.step}`;
        const known = (eventsByContact[en.contactId] || []).some((e) =>
          (e.type === "delivered" || e.type === "bounced" || e.type === "complained") &&
          String(e.campaign_id || "").startsWith(prefix) &&
          (String(e.campaign_id) === prefix || String(e.campaign_id).startsWith(prefix + "-")));
        if (!known) todo.push({ seq, en, h });
      }
    }
  }
  for (const t of todo.slice(0, RECONCILE_MAX)) {
    out.checked++;
    try {
      await sleep(GAP_MS);
      const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(t.h.id)}`, {
        headers: { Authorization: `Bearer ${RESEND_KEY}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { out.errors++; continue; }
      const type = LAST_EVENT_MAP[String(body.last_event || "").toLowerCase()];
      if (!type) { out.pending++; continue; }
      await sbInsert("campaign_events", {
        campaign_id: `seq-${t.seq.id}-${t.h.step}`, contact_id: t.en.contactId, type,
        occurred_at: t.h.at,
        raw: { source: "resend-reconcile", email_id: t.h.id, last_event: body.last_event },
      });
      out.recorded++;
    } catch (_) {
      out.errors++;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const only = url.searchParams.get("sequence") || "";

  try {
    let seqs = await sbGet("email_sequences?select=*&status=eq.active");
    if (only) seqs = seqs.filter((s: any) => s.id === only);
    if (!seqs.length) return json({ ok: true, dry, sequences: 0, sent: 0, detail: [], note: "No active sequences." });

    const [contacts, accounts, optouts, templates] = await Promise.all([
      sbGet("contacts?select=id,name,email,title,account_id,email_opt_out"),
      sbGet("accounts?select=id,name"),
      sbGet("email_optouts?select=email,contact_id"),
      sbGet("email_templates?select=id,name,subject,html,body"),
    ]);
    const byContact: Record<string, any> = {};
    contacts.forEach((c: any) => (byContact[c.id] = c));
    const byAccount: Record<string, any> = {};
    accounts.forEach((a: any) => (byAccount[a.id] = a));
    const byTemplate: Record<string, any> = {};
    templates.forEach((t: any) => (byTemplate[t.id] = t));
    const blockedEmails = new Set(optouts.map((o: any) => String(o.email || "").toLowerCase()).filter(Boolean));
    const blockedIds = new Set(optouts.map((o: any) => String(o.contact_id || "")).filter(Boolean));

    const ids = [...new Set(seqs.flatMap((s: any) => (s.enrollments || []).map((e: any) => e.contactId)))].filter(Boolean) as string[];
    const eventsByContact: Record<string, any[]> = {};
    for (let i = 0; i < ids.length; i += 80) {
      const chunk = ids.slice(i, i + 80).map((x) => `"${x}"`).join(",");
      const evs = await sbGet(`campaign_events?select=campaign_id,contact_id,type,occurred_at&contact_id=in.(${chunk})`);
      evs.forEach((e: any) => {
        if (!e.contact_id) return;
        (eventsByContact[e.contact_id] = eventsByContact[e.contact_id] || []).push(e);
      });
    }

    const report: any[] = [];
    let sentTotal = 0;

    for (const seq of seqs) {
      const enrollments = seq.enrollments || [];
      const steps = seq.steps || [];
      let changed = false;
      const fromHeader = fromHeaderFor(seq);
      const row = (en: any, contact: any, status: string, detail: string, step?: number) =>
        report.push({
          sequenceId: seq.id, sequence: seq.name, contactId: en.contactId,
          contact: (contact && (contact.name || contact.email)) || "", email: (contact && contact.email) || "",
          step: step == null ? null : step + 1, status, detail,
        });

      for (const en of enrollments) {
        const contact = byContact[en.contactId];
        const i = en.stepIndex || 0;
        if (en.stoppedAt) { row(en, contact, "stopped", "Stopped · " + (en.stopReason || "other")); continue; }
        if (!contact) { row(en, null, "error", "Contact no longer exists in the CRM"); continue; }
        if (!contact.email) { row(en, contact, "error", "Contact has no email address", i); continue; }
        const addr = String(contact.email).toLowerCase();
        if (contact.email_opt_out || blockedEmails.has(addr) || blockedIds.has(String(contact.id))) {
          if (!dry) { en.stoppedAt = new Date().toISOString(); en.stopReason = "suppressed"; changed = true; }
          row(en, contact, "stopped", "Opted out or suppressed");
          continue;
        }

        const step = steps[i];
        if (!step) { row(en, contact, "done", `All ${steps.length} steps sent`); continue; }

        const prev = lastSend(en);
        const since = prev ? prev.at : en.enrolledAt;
        const ev = folded(eventsByContact[en.contactId] || [], since);

        if (ev.replied && seq.stop_on_reply !== false) {
          if (!dry) { en.stoppedAt = new Date().toISOString(); en.stopReason = "replied"; changed = true; }
          row(en, contact, "stopped", "Replied");
          continue;
        }
        if (ev.stopped) {
          if (!dry) { en.stoppedAt = new Date().toISOString(); en.stopReason = "unsubscribed"; changed = true; }
          row(en, contact, "stopped", "Unsubscribed or bounced");
          continue;
        }

        const waitMs = (step.waitDays || 0) * 864e5;
        const readyAt = new Date(since).getTime() + (i === 0 ? 0 : waitMs);
        if (Date.now() < readyAt) { row(en, contact, "waiting", "Due " + new Date(readyAt).toISOString(), i); continue; }

        if (i > 0 && step.condition && step.condition !== "always") {
          const pass = step.condition === "not_opened" ? !ev.opened
            : step.condition === "opened" ? (ev.opened && !ev.clicked)
              : step.condition === "clicked" ? ev.clicked : true;
          if (!pass) {
            if (!dry) {
              en.stepIndex = i + 1;
              en.history = (en.history || []).concat([{ step: i, at: new Date().toISOString(), result: "skipped" }]);
              changed = true;
            }
            row(en, contact, "skipped", "Condition not met: " + step.condition.replace("_", " "), i);
            continue;
          }
        }

        const tpl = byTemplate[step.templateId];
        if (!tpl) { row(en, contact, "error", `Step ${i + 1} has no template`, i); continue; }

        const acct = contact.account_id ? byAccount[contact.account_id] : null;
        const ctx: Record<string, string> = {
          first_name: String(contact.name || "").split(" ")[0],
          last_name: String(contact.name || "").split(" ").slice(1).join(" "),
          full_name: contact.name || "",
          company: (acct && acct.name) || "",
          title: contact.title || "",
          email: contact.email,
          sender_name: seq.from_name || "",
          unsubscribe_url: `${SUPABASE_URL}/functions/v1/unsubscribe?c=${encodeURIComponent(contact.id)}`,
        };

        if (dry) { row(en, contact, "would_send", merge(tpl.subject || "", ctx) || "(no subject)", i); continue; }
        if (!RESEND_KEY || !fromHeader) { row(en, contact, "error", "RESEND_API_KEY / RESEND_FROM(_SSP) not configured", i); continue; }

        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: fromHeader,
              ...(seq.from_email ? { reply_to: seq.from_email } : {}),
              to: [contact.email],
              subject: merge(tpl.subject || "", ctx),
              html: merge(tpl.html || String(tpl.body || "").replace(/\n/g, "<br />"), ctx),
              headers: {
                "List-Unsubscribe": `<${ctx.unsubscribe_url}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
              tags: [
                { name: "campaign_id", value: `seq-${seq.id}-${i}` },
                { name: "contact_id", value: String(contact.id) },
                { name: "template_id", value: String(step.templateId) },
              ],
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body?.message || `Resend ${res.status}`);

          en.history = (en.history || []).concat([{ step: i, at: new Date().toISOString(), result: "sent", id: body.id }]);
          en.stepIndex = i + 1;
          changed = true;
          sentTotal++;
          row(en, contact, "sent", "Sent from " + fromHeader, i);

          // Recorded immediately so the reports show the send even before the
          // webhook reports delivery. A failure here is reported, not swallowed.
          try {
            await sbInsert("campaign_events", {
              campaign_id: `seq-${seq.id}-${i}`, contact_id: contact.id,
              type: "sent", occurred_at: new Date().toISOString(),
              template_id: step.templateId, raw: { source: "run-sequences", email_id: body.id },
            });
          } catch (e) {
            row(en, contact, "error", "Sent, but the send record failed: " + (e as Error).message, i);
          }
        } catch (e) {
          row(en, contact, "error", (e as Error).message, i);
        }
      }

      if (changed && !dry) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/email_sequences?id=eq.${encodeURIComponent(seq.id)}`, {
          method: "PATCH", headers: sbHeaders({ Prefer: "return=minimal" }),
          body: JSON.stringify({ enrollments: enrollments, last_run_at: new Date().toISOString() }),
        });
        if (!res.ok) report.push({ sequenceId: seq.id, sequence: seq.name, status: "error", detail: "Could not save progress: " + res.status });
      }
    }

    const reconciled = dry ? null : await reconcile(seqs, eventsByContact);
    const wouldSend = report.filter((r) => r.status === "would_send").length;
    const errors = report.filter((r) => r.status === "error").length;
    return json({ ok: true, dry, sequences: seqs.length, sent: sentTotal, wouldSend, errors, reconciled, detail: report.slice(0, 500) });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
