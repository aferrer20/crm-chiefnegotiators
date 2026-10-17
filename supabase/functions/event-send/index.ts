// event-send — sends one saved event email (an email_templates row) through
// send-campaign with the service role, so it can run from the server side
// without a signed-in browser.
//
// It can only ever send what the template row already holds:
//   design.recipients       the guest list, with per-guest ctx
//   design.test_to          where a test copy goes
//   design.live_campaign_id the campaign id for the real send
//   design.live_approved    must be true for a live send (set in the DB once
//                           the send has been signed off)
// A live send is one-shot: if the campaign id already exists, it refuses.
//
// POST { template_id, mode: "test" | "live" }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let input: any;
  try { input = await req.json(); } catch { return json({ error: "body must be JSON" }, 400); }
  const mode = input?.mode === "live" ? "live" : "test";

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: t, error } = await sb.from("email_templates")
    .select("id,name,subject,preheader,body,html,design").eq("id", String(input?.template_id || "")).maybeSingle();
  if (error || !t) return json({ error: "template not found" }, 404);
  const d = t.design || {};
  if (!Array.isArray(d.recipients) || !d.live_campaign_id || !d.test_to) {
    return json({ error: "template is not set up for event-send" }, 400);
  }

  const campaign: Record<string, unknown> = {
    name: t.name, subject: t.subject, preheader: t.preheader, html: t.html, body: t.body,
    fromName: d.from_name || "Amanda Ferrer", replyTo: d.reply_to || "amanda@thechiefnegotiators.com",
    brand: d.brand || "chief", templateId: t.id,
  };
  let recipients: any[];
  if (mode === "test") {
    campaign.id = `test-${Date.now()}`;
    campaign.test = true;
    campaign.subject = `[TEST] ${t.subject}`;
    recipients = [{ email: d.test_to, ctx: d.test_ctx || { first_name: "Amanda", guest_line: "" } }];
  } else {
    if (d.live_approved !== true) return json({ error: "live send not approved on this template" }, 403);
    const { data: prior } = await sb.from("campaigns").select("id,status").eq("id", d.live_campaign_id).maybeSingle();
    if (prior) return json({ error: "already sent", campaign: prior }, 409);
    campaign.id = d.live_campaign_id;
    campaign.recipientTotal = d.recipients.length;
    recipients = d.recipients;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-campaign`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ campaign, recipients }),
  });
  const out = await res.json().catch(() => ({}));
  return json({ mode, campaign_id: campaign.id, status: res.status, result: out }, res.ok ? 200 : 502);
});
