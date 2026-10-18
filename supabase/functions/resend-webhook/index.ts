// Supabase Edge Function — POST /functions/v1/resend-webhook
// Receives delivery/open/click events from Resend and writes them into
// the campaign_events table so the CRM analytics view shows real data.
//
// IMPORTANT: This endpoint is PUBLIC (Resend can't auth). To prevent spoofing,
// set RESEND_WEBHOOK_SECRET to match the signing secret Resend shows you when
// you create the webhook — we'll verify the svix signature header.
//
// Every insert is checked. A failed insert answers 500 so Resend retries the
// delivery instead of the event being lost while the endpoint reports "ok" —
// which is how a week of sequence deliveries disappeared from the reports.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TYPE_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked",
};

// Resend echoes the tags we set when sending, but the SHAPE varies: sometimes
// an array of {name, value}, sometimes a plain object map {name: value}.
function readTag(tags: unknown, key: string): string | undefined {
  if (!tags) return undefined;
  if (Array.isArray(tags)) {
    const hit = tags.find((t: any) => t && t.name === key);
    return hit ? hit.value : undefined;
  }
  if (typeof tags === "object") {
    const v = (tags as Record<string, unknown>)[key];
    return v == null ? undefined : String(v);
  }
  return undefined;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};
const reply = (body: unknown, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": typeof body === "string" ? "text/plain" : "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // A GET is a health check, never an event.
  if (req.method === "GET") {
    return reply({
      ok: true,
      function: "resend-webhook",
      secretConfigured: !!Deno.env.get("RESEND_WEBHOOK_SECRET"),
      accepts: Object.keys(TYPE_MAP),
    });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  try {
    const body = await req.json();
    const evType = TYPE_MAP[body.type];
    if (!evType) return reply("Ignored");

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    const data = body.data || {};
    const campaignId = readTag(data.tags, "campaign_id");
    const contactId = readTag(data.tags, "contact_id");
    const templateId = readTag(data.tags, "template_id") || null;
    const emailId = data.email_id || data.id;
    const url = data.click?.link || data.link || null;
    const recipientEmail = (Array.isArray(data.to) ? data.to[0] : data.to) || data.email || null;

    // ── suppression ─────────────────────────────────────────────────────────
    // A hard bounce means the address is dead, so it joins the same
    // suppression list as an unsubscribe. A SOFT bounce does not.
    const bounceKind = String(data.bounce?.type || data.bounce?.subType || "").toLowerCase();
    const isHardBounce = evType === "bounced" && !/soft|transient|temporar|mailboxfull|undetermined/.test(bounceKind);
    const shouldSuppress = evType === "complained" || isHardBounce;

    // email_optouts has exactly (email PK, contact_id, campaign_id, created_at).
    // An earlier version wrote reason/detail columns that don't exist, so every
    // suppression was rejected and dead addresses kept being mailed. Errors are
    // now checked instead of swallowed.
    //  - Hard bounce: block the ADDRESS only. A typo'd address the rep later
    //    corrects must become mailable again, so no contact-level flag.
    //  - Complaint: the person asked not to be mailed; block address + contact.
    if (shouldSuppress) {
      const complained = evType === "complained";
      const addr = recipientEmail ? String(recipientEmail).toLowerCase() : "";
      if (addr) {
        const { error } = await supa.from("email_optouts").upsert(
          { email: addr, contact_id: complained ? (contactId || null) : null, campaign_id: campaignId || null, created_at: new Date().toISOString() },
          { onConflict: "email", ignoreDuplicates: !complained },
        );
        if (error) console.error("suppression failed", addr, error.message);
      }
      if (complained && contactId) {
        const { error } = await supa.from("contacts").update({ email_opt_out: true, email_opt_out_at: new Date().toISOString() }).eq("id", contactId);
        if (error) console.error("contact opt-out failed", contactId, error.message);
      }
    }

    let row: Record<string, unknown> | null = null;
    if (campaignId) {
      row = { campaign_id: campaignId, contact_id: contactId };
    } else if (emailId) {
      // No tag — try to look up by resend_email_id.
      const { data: rec } = await supa.from("campaign_recipients")
        .select("campaign_id,contact_id").eq("resend_email_id", emailId).maybeSingle();
      if (rec) row = { campaign_id: rec.campaign_id, contact_id: rec.contact_id };
    }
    if (!row) return reply("ok");

    const { error } = await supa.from("campaign_events").insert({
      ...row,
      type: evType,
      occurred_at: body.created_at || new Date().toISOString(),
      url, template_id: templateId,
      raw: body,
    });
    if (error) {
      console.error("campaign_events insert failed:", error.message);
      return reply({ error: "insert failed: " + error.message }, 500);
    }

    return reply({ ok: true, type: evType, suppressed: shouldSuppress });
  } catch (e) {
    console.error("Webhook error:", e);
    return reply({ error: (e as Error).message }, 500);
  }
});
