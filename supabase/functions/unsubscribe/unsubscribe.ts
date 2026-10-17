// Supabase Edge Function — /functions/v1/unsubscribe?c=<campaign>&k=<contact>&e=<email>
//
// The unsubscribe target for every email we send. Must be callable WITHOUT a
// JWT (verify_jwt off): recipients are anonymous.
//
// Supabase serves every function response from *.supabase.co as text/plain
// with a sandbox CSP, so an HTML page from here shows up as raw source. So:
//   GET  -> redirect to the confirm page on our own site (cncrm.../unsubscribe.html),
//           which POSTs back here when the person clicks Confirm. If that page
//           isn't published yet, GET answers in plain, readable text instead.
//   POST -> records the opt-out. Gmail and Outlook fire List-Unsubscribe=One-Click
//           as a POST with no body, and the confirm page posts the same way.
//
// A GET is never consent: mail-security scanners and link prefetchers fetch
// every link in an email before anyone reads it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CONFIRM_PAGE = "https://cncrm.thechiefnegotiators.com/unsubscribe.html";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };

const text = (status: number, title: string, body: string) =>
  new Response(`${title}\n${"=".repeat(title.length)}\n\n${body}\n\nThe Chief Negotiators\n`, {
    status,
    headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
  });

// Whether the confirm page is live, checked at most every 10 minutes.
let pageLive: { ok: boolean; at: number } | null = null;
async function confirmPageLive() {
  if (pageLive && Date.now() - pageLive.at < 10 * 60 * 1000) return pageLive.ok;
  let ok = false;
  try {
    const r = await fetch(CONFIRM_PAGE, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(2500) });
    ok = r.ok && (await r.text()).includes("cn-unsubscribe-page");
  } catch { ok = false; }
  pageLive = { ok, at: Date.now() };
  return ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("c") || null;
    const contactId = url.searchParams.get("k") || null;
    const email = (url.searchParams.get("e") || "").trim().toLowerCase() || null;
    // Test sends carry a live-looking footer link; honouring it would opt the
    // author's own address out, so a test link changes nothing.
    const isTest = url.searchParams.get("t") === "1";

    if (req.method === "GET") {
      if (await confirmPageLive()) {
        return new Response(null, { status: 302, headers: { ...CORS, Location: `${CONFIRM_PAGE}?${url.searchParams.toString()}` } });
      }
      if (isTest) {
        return text(200, "Test email: nothing changed", "This was a test send, so the unsubscribe link is inactive. No address has been removed from any list.");
      }
      return text(200, "Unsubscribe",
        "To stop receiving these emails, use the Unsubscribe button your mail app shows next to the sender's name (Gmail, Outlook and Apple Mail all show one), or simply reply to the email with the word \"unsubscribe\".\n\nEither way you will be removed right away. Nothing has changed yet.");
    }

    if (isTest) return text(200, "Test email: nothing changed", "This was a test send. No address has been removed from any list.");
    if (!contactId && !email) {
      return text(400, "Link incomplete", "This unsubscribe link is missing its identifier. Reply to the email and we will remove you by hand.");
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date().toISOString();

    // Flag the contact so every future send skips them.
    if (contactId) {
      await supa.from("contacts").update({ email_opt_out: true, email_opt_out_at: now }).eq("id", contactId);
    } else if (email) {
      await supa.from("contacts").update({ email_opt_out: true, email_opt_out_at: now }).ilike("email", email);
    }

    // Suppression list — covers typed-in addresses with no contact row. Keyed on
    // email when there is one, contact otherwise (a null email violates the key).
    if (email) {
      await supa.from("email_optouts").upsert(
        { email, contact_id: contactId, campaign_id: campaignId, created_at: now },
        { onConflict: "email" },
      );
    } else if (contactId) {
      const { data: existing } = await supa.from("email_optouts").select("id").eq("contact_id", contactId).maybeSingle();
      if (!existing) await supa.from("email_optouts").insert({ contact_id: contactId, campaign_id: campaignId, created_at: now });
    }

    // One analytics event per person per campaign: one-click POSTs, the confirm
    // page and reloads can all land here for the same person.
    if (campaignId && contactId) {
      const { data: prior } = await supa.from("campaign_events")
        .select("id").eq("campaign_id", campaignId).eq("contact_id", contactId).eq("type", "unsubscribed").limit(1);
      if (!prior || prior.length === 0) {
        await supa.from("campaign_events").insert({ campaign_id: campaignId, contact_id: contactId, type: "unsubscribed", occurred_at: now });
      }
    }

    return text(200, "You're unsubscribed", "You will not receive further emails from us. Nothing else is needed on your end.");
  } catch (_e) {
    return text(500, "Something went wrong", "We could not process that automatically. Reply to the email and we will remove you by hand.");
  }
});
