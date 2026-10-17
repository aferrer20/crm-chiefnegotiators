// event-send — sends one saved event email (an email_templates row) straight
// through Resend, so it can run server side without a signed-in browser.
// send-campaign only accepts a user JWT, and the project's service key is not
// one. Headers, tags, BCC and suppression match send-campaign.
//
// It can only ever send what the template row already holds:
//   design.recipients       the guest list, with per-guest ctx
//   design.test_to          where a test copy goes
//   design.test_ctx         merge values for the test copy
//   design.live_campaign_id the campaign id for the real send
//   design.live_approved    must be true for a live send (set in the DB once
//                           the send has been signed off)
//   design.owner_rep_id     optional: the rep the send counts for
// A live send is one-shot: once the campaign id exists it refuses, unless the
// earlier attempt delivered nothing (status "error"), which may be retried.
//
// POST { template_id, mode: "test" | "live" }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "";
const BCC = (Deno.env.get("CAMPAIGN_BCC") || "sales@thechiefnegotiators.com").trim();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Same unsubscribe link and {{token}} merge as send-campaign.
function unsubUrl(campaignId: string, r: any, test: boolean) {
  const p = new URLSearchParams({ c: campaignId });
  if (r.contactId) p.set("k", String(r.contactId));
  p.set("e", String(r.email));
  if (test) p.set("t", "1");
  return `${SUPABASE_URL}/functions/v1/unsubscribe?${p.toString()}`;
}
const merge = (text: string, ctx: Record<string, string>) =>
  (text || "").replace(/\{\{(\w+)\}\}/g, (_, k) => (ctx[k] != null ? String(ctx[k]) : ""));

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!RESEND_API_KEY || !RESEND_FROM) return json({ error: "Resend is not configured" }, 500);
  let input: any;
  try { input = await req.json(); } catch { return json({ error: "body must be JSON" }, 400); }
  const mode = input?.mode === "live" ? "live" : "test";
  const isTest = mode === "test";

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: t, error } = await sb.from("email_templates")
    .select("id,name,subject,preheader,body,html,design").eq("id", String(input?.template_id || "")).maybeSingle();
  if (error || !t) return json({ error: "template not found" }, 404);
  const d = t.design || {};
  if (!Array.isArray(d.recipients) || !d.live_campaign_id || !d.test_to) {
    return json({ error: "template is not set up for event-send" }, 400);
  }

  const fromName = String(d.from_name || "Amanda Ferrer");
  const replyTo = String(d.reply_to || "amanda@thechiefnegotiators.com");
  let campaignId: string;
  let subject = String(t.subject || "");
  let recipients: any[];
  const skipped: string[] = [];

  if (isTest) {
    campaignId = `test-${Date.now()}`;
    subject = `[TEST] ${subject}`;
    recipients = [{ email: d.test_to, ctx: d.test_ctx || { first_name: "Amanda" } }];
  } else {
    if (d.live_approved !== true) return json({ error: "live send not approved on this template" }, 403);
    campaignId = String(d.live_campaign_id);
    // Claim the send atomically: the insert succeeds for exactly one caller, so
    // an overlapping run can never mail the list twice. A previous attempt that
    // delivered nothing (status "error") may be claimed again for a retry.
    const claim = {
      id: campaignId, name: t.name, subject, from_name: fromName, preheader: t.preheader, body: t.body,
      status: "sending", sent_at: new Date().toISOString(), error_message: null,
      ...(d.owner_rep_id ? { owner_id: String(d.owner_rep_id) } : {}),
    };
    const { error: insErr } = await sb.from("campaigns").insert(claim);
    if (insErr) {
      const { data: retried } = await sb.from("campaigns").update(claim)
        .eq("id", campaignId).eq("status", "error").select("id");
      if (!retried || !retried.length) {
        const { data: prior } = await sb.from("campaigns").select("id,status").eq("id", campaignId).maybeSingle();
        return json({ error: "already sent or in progress", campaign: prior }, 409);
      }
    }

    // Suppression: never mail an address or contact on the opt-out list.
    // Fail closed: if the list can't be read, send nothing (and allow a retry).
    const { data: outs, error: outErr } = await sb.from("email_optouts").select("email,contact_id");
    if (outErr) {
      await sb.from("campaigns").update({ status: "error", error_message: `opt-out list unreadable: ${outErr.message}` }).eq("id", campaignId);
      return json({ error: "could not read the opt-out list; nothing was sent" }, 500);
    }
    const byEmail = new Set((outs || []).map((o: any) => String(o.email || "").toLowerCase()));
    const byId = new Set((outs || []).map((o: any) => String(o.contact_id || "")).filter(Boolean));
    recipients = d.recipients.filter((r: any) => {
      const out = byEmail.has(String(r.email).toLowerCase()) || (r.contactId && byId.has(String(r.contactId)));
      if (out) skipped.push(r.email);
      return !out;
    });
    await sb.from("campaigns").update({ recipient_count: recipients.length }).eq("id", campaignId);
  }

  const from = `"${fromName}" <${RESEND_FROM}>`;
  const payload = recipients.map((r) => {
    const unsub = unsubUrl(campaignId, r, isTest);
    const ctx = { ...(r.ctx || {}), unsubscribe_url: unsub };
    return {
      from, reply_to: replyTo, to: [r.email],
      ...(!isTest && BCC ? { bcc: [BCC] } : {}),
      subject: merge(subject, ctx),
      html: merge(String(t.html || ""), ctx),
      text: merge(String(t.body || ""), ctx),
      ...(!isTest ? { headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
      tags: [
        { name: "campaign_id", value: campaignId },
        ...(r.contactId ? [{ name: "contact_id", value: String(r.contactId) }] : []),
        { name: "template_id", value: String(t.id) },
      ],
    };
  });

  const sent: { r: any; id: string | null }[] = [];
  const failures: any[] = [];
  for (let i = 0; i < payload.length; i += 100) {
    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload.slice(i, i + 100)),
      });
    } catch (e) { failures.push({ batch: i / 100, error: String(e) }); continue; }
    const out = await res.json().catch(() => null);
    if (!res.ok) { failures.push({ batch: i / 100, status: res.status, error: out }); continue; }
    (out?.data || []).forEach((row: any, j: number) => sent.push({ r: recipients[i + j], id: row?.id || null }));
  }

  if (!isTest) {
    const rows = sent.filter((p) => p.r.contactId).map((p) => ({
      campaign_id: campaignId, contact_id: p.r.contactId, email: p.r.email, resend_email_id: p.id,
    }));
    if (rows.length) await sb.from("campaign_recipients").upsert(rows, { onConflict: "campaign_id,contact_id" });
    await sb.from("campaigns").update({
      status: sent.length === 0 ? "error" : failures.length ? "sent_partial" : "sent",
      ...(failures.length ? { error_message: JSON.stringify(failures).slice(0, 2000) } : {}),
    }).eq("id", campaignId);
  }

  return json({ mode, campaign_id: campaignId, sent: sent.length, failed: failures.length, failures, skipped },
    sent.length ? 200 : 502);
});
