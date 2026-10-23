// Supabase Edge Function — POST /functions/v1/send-campaign. verify_jwt=true.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "onboarding@resend.dev";
const RESEND_FROM_SSP = Deno.env.get("RESEND_FROM_SSP") || ""; // verified SSP-domain sender (strategicsupplypartners.com.au)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Unsubscribe link shown in the email body. It lives on our own domain: a
// visible link to a random *.supabase.co host reads as phishing to filters.
// The page POSTs the opt-out back to the unsubscribe function.
const UNSUB_PAGE = Deno.env.get("UNSUBSCRIBE_PAGE") || "https://cncrm.thechiefnegotiators.com/unsubscribe.html";
// CAN-SPAM wants a postal address in every commercial email; filters look for it.
const POSTAL_ADDRESS = (Deno.env.get("SENDER_POSTAL_ADDRESS") || "").trim();
// Most real sends per UTC day across campaigns and sequences. A young domain
// that sends hundreds in a burst gets throttled into junk. "0" turns it off.
const DAILY_CAP = (() => {
  const v = (Deno.env.get("DAILY_SEND_CAP") || "").trim();
  const n = v === "" ? 150 : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
})();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function callerRole(req: Request): string | null {
  // Server-side callers (the scheduled-send dispatcher) present the service key
  // in x-cn-internal. The project's service key is not a JWT, so it can't ride
  // in Authorization and be decoded like a user token.
  const internal = req.headers.get("x-cn-internal") || "";
  if (internal && SERVICE_KEY && internal === SERVICE_KEY) return "service_role";
  const t = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!t) return null;
  try {
    const seg = t.split(".")[1] || "";
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    return JSON.parse(atob(b64 + pad))?.role ?? null;
  } catch { return null; }
}

function fromHeader(name: string, address: string) {
  const clean = String(name || "").replace(/[\r\n"\\]/g, " ").replace(/\s+/g, " ").trim();
  return clean ? `"${clean}" <${address}>` : address;
}

function domainOf(email: string) { return String(email || "").split("@")[1]?.toLowerCase() || ""; }
// SSP campaigns send FROM the verified SSP domain when RESEND_FROM_SSP is set;
// everything else stays on the CN domain. Brand comes from the campaign/recipient,
// or is inferred from an SSP reply-to address (e.g. sending as an SSP rep).
function isSspSend(campaign: any, r: any) {
  const b = String((r && r.brand) || campaign?.brand || campaign?.brandKey || "").toLowerCase();
  if (b === "ssp") return true;
  if (b === "chief" || b === "cn") return false;
  return domainOf((r && r.replyTo) || campaign?.replyTo) === "strategicsupplypartners.com.au";
}
function fromAddressFor(campaign: any, r: any) {
  return (isSspSend(campaign, r) && RESEND_FROM_SSP) ? RESEND_FROM_SSP : RESEND_FROM;
}

// Real sends since 00:00 UTC. The webhook's email.sent rows cover campaigns and
// sequences; run-sequences also logs its own row the moment it sends, which
// still counts when the webhook lags or isn't subscribed to email.sent.
async function sentToday(supa: any): Promise<number> {
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const count = async (col: string, val: string) => {
    try {
      const { count } = await supa.from("campaign_events").select("type", { count: "exact", head: true })
        .eq("type", "sent").gte("occurred_at", since.toISOString()).eq(col, val);
      return count || 0;
    } catch { return 0; }
  };
  const [hook, seq] = await Promise.all([count("raw->>type", "email.sent"), count("raw->>source", "run-sequences")]);
  return Math.max(hook, seq);
}

function validEmail(e: unknown) {
  const s = String(e ?? "").trim();
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(s) ? s : null;
}

const TOKEN_ALIASES: Record<string, string> = {
  firstname: "first_name", first: "first_name", fname: "first_name",
  contactfirstname: "first_name", recipientfirstname: "first_name",
  givenname: "first_name", forename: "first_name",
  lastname: "last_name", last: "last_name", lname: "last_name",
  surname: "last_name", familyname: "last_name",
  contactlastname: "last_name", recipientlastname: "last_name",
  name: "full_name", fullname: "full_name", contactname: "full_name", recipientname: "full_name",
  jobtitle: "title", contacttitle: "title", role: "title",
  companyname: "company", account: "company", accountname: "company",
  contactcompany: "company", organisation: "company", organization: "company",
  contactemail: "email", recipientemail: "email", emailaddress: "email",
  fromname: "sender_name", sendername: "sender_name", myname: "sender_name",
  fromtitle: "sender_title", sendertitle: "sender_title",
  fromemail: "sender_email", senderemail: "sender_email",
  quoteno: "quote_number", quotenumber: "quote_number", quotetotal: "quote_total",
};
function lookup(ctx: Record<string, string>, k: string) {
  if (ctx[k] != null && String(ctx[k]) !== "") return String(ctx[k]);
  const flat = k.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const alias = TOKEN_ALIASES[flat];
  if (alias && ctx[alias] != null && String(ctx[alias]) !== "") return String(ctx[alias]);
  if ((alias === "full_name" || flat === "fullname") && (ctx.first_name || ctx.last_name)) {
    return [ctx.first_name, ctx.last_name].filter(Boolean).join(" ");
  }
  const snake = k.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  if (snake !== k && ctx[snake] != null && String(ctx[snake]) !== "") return String(ctx[snake]);
  return null;
}

function merge(text: string, ctx: Record<string, string>) {
  let t = (text || "").replace(/\{\{(\w+)\}\}/g, (_, k) => lookup(ctx, k) ?? "");
  t = t.replace(/^[ \t]*(?:hi|hello|hey|dear)?[ \t]*(?:there)?[ \t]*[,:][ \t]*\r?\n+/i, "");
  t = t.replace(/(^|\n)[ \t]*(?:hi|hello|hey|dear)[ \t]*(?:there)?[ \t]*,[ \t]*(?=\S)/gi, "$1");
  return t.replace(/^([a-z])/, (m) => m.toUpperCase());
}

function isTestCampaign(c: any) {
  return c?.test === true || /^test-\d+$/.test(String(c?.id || ""));
}

function unsubQuery(campaignId: string | number, r: any, test?: boolean) {
  const p = new URLSearchParams();
  if (campaignId != null) p.set("c", String(campaignId));
  if (r?.contactId) p.set("k", String(r.contactId));
  if (r?.email) p.set("e", String(r.email));
  if (test) p.set("t", "1");
  return p.toString();
}
// List-Unsubscribe header target: Gmail/Outlook one-click POSTs straight here.
function unsubUrl(campaignId: string | number, r: any, test?: boolean) {
  return `${SUPABASE_URL}/functions/v1/unsubscribe?${unsubQuery(campaignId, r, test)}`;
}
// Link in the body: the confirm page on our own domain.
function unsubPageUrl(campaignId: string | number, r: any, test?: boolean) {
  return `${UNSUB_PAGE}?${unsubQuery(campaignId, r, test)}`;
}

function ctxFor(campaign: any, r: any): Record<string, string> {
  return { ...(r?.ctx || {}), unsubscribe_url: unsubPageUrl(campaign.id, r, isTestCampaign(campaign)) };
}

function escHtml(s: string) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let lastCall = 0;
const MIN_GAP_MS = 550;
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
async function resendFetch(url: string, body: any, attempt = 0): Promise<{ res: Response; json: any }> {
  const gap = Date.now() - lastCall;
  if (gap < MIN_GAP_MS) await sleep(MIN_GAP_MS - gap);
  lastCall = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch (_) { json = null; }
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    const wait = Number(res.headers.get("retry-after")) * 1000 || (800 * Math.pow(2, attempt));
    await sleep(Math.min(wait, 8000));
    return resendFetch(url, body, attempt + 1);
  }
  return { res, json };
}

function footerText(c: any, ctx: Record<string, string>) {
  const brand = c.brandName || c.fromName || "Chief Negotiators";
  return `--\n${brand}${POSTAL_ADDRESS ? "\n" + POSTAL_ADDRESS : ""}\nUnsubscribe: ${ctx.unsubscribe_url || ""}`;
}

// A custom HTML template that forgot the unsubscribe token still gets a footer.
function footerHtml(c: any, ctx: Record<string, string>) {
  const brand = escHtml(c.brandName || c.fromName || "Chief Negotiators");
  return `<div style="font-size:11px;color:#7A6F60;text-align:center;margin:24px 0 8px;font-family:-apple-system,system-ui,Helvetica,Arial,sans-serif">${brand}${POSTAL_ADDRESS ? ` · ${escHtml(POSTAL_ADDRESS)}` : ""} · <a href="${escHtml(ctx.unsubscribe_url || "")}" style="color:#7A6F60">Unsubscribe</a></div>`;
}

function plainText(c: any, ctx: Record<string, string>) {
  const t = plainTextBody(c, ctx);
  return ctx.unsubscribe_url && !t.includes(ctx.unsubscribe_url) ? `${t}\n\n${footerText(c, ctx)}` : t;
}

function plainTextBody(c: any, ctx: Record<string, string>) {
  const src = c.body && String(c.body).trim() ? c.body : (c.html || "");
  return merge(String(src), ctx)
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const t = String(label).replace(/<[^>]+>/g, "").trim();
      return t && !/^https?:/i.test(t) ? `${t} (${href})` : href;
    })
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function renderHtml(c: any, ctx: Record<string, string>) {
  if (c.html) {
    if (/\{\{\s*unsubscribe_?url\s*\}\}/i.test(c.html)) return merge(c.html, ctx);
    const html = merge(c.html, ctx);
    const foot = footerHtml(c, ctx);
    return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${foot}</body>`) : html + foot;
  }
  const body = merge(c.body || "", ctx).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  const subject = merge(c.subject || "", ctx);
  const preheader = merge(c.preheader || "", ctx);
  const ctaText = merge(c.ctaText || "", ctx);
  const ctaUrl = c.ctaUrl || "#";
  const image = c.imageUrl ? `<img src="${c.imageUrl}" alt="" style="width:100%;max-width:600px;display:block;border:0;margin:0 auto;">` : "";
  const cta = ctaText ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px auto"><tr><td style="background:#1A1612;border-radius:6px"><a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;color:#F4EEE3;text-decoration:none;font-weight:500;font-family:-apple-system,system-ui,Helvetica,Arial,sans-serif">${ctaText}</a></td></tr></table>` : "";
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${subject}</title>
<style>body{margin:0;padding:0;background:#F4EEE3;font-family:-apple-system,system-ui,Helvetica,Arial,sans-serif;color:#1A1612}</style></head>
<body>
<span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${preheader}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F4EEE3;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:white;border-radius:8px;overflow:hidden;max-width:600px">
      ${image ? `<tr><td>${image}</td></tr>` : ""}
      <tr><td style="padding:28px 32px;font-size:15px;line-height:1.6;color:#2D2620">
        ${body}
        ${cta}
        <hr style="border:none;border-top:1px solid #E5DBC6;margin:28px 0 14px">
        <div style="font-size:11px;color:#7A6F60;text-align:center">
          ${escHtml(c.brandName || c.fromName || "Chief Negotiators")}${POSTAL_ADDRESS ? ` · ${escHtml(POSTAL_ADDRESS)}` : ""} · <a href="${escHtml(ctx.unsubscribe_url || "")}" style="color:#7A6F60">Unsubscribe</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const role = callerRole(req);
  if (role !== "authenticated" && role !== "service_role") {
    return new Response(JSON.stringify({ error: "Unauthorized — sign in to send." }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  try {
    const { campaign, recipients: rawRecipients } = await req.json();
    if (!campaign || !Array.isArray(rawRecipients) || rawRecipients.length === 0) {
      return new Response(JSON.stringify({ error: "Missing campaign or recipients" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const isTest = isTestCampaign(campaign);

    // Sequence sends must go out as the sequence's configured sender — not
    // whatever the browser passed (which is the logged-in user, e.g. "Camila").
    // A sequence campaign id looks like "seq-<sequenceId>-<step>..."; when we
    // recognise one, the From name, Reply-To and brand are taken from the
    // email_sequences row server-side, so a sequence always sends as the rep it
    // is set to send as (e.g. Maxim Stoker on the SSP domain). forceSeqSender
    // then makes those campaign-level values win over any per-recipient fromName.
    let forceSeqSender = false;
    try {
      const sm = String(campaign.id || "").match(/^seq-([A-Za-z0-9]+)-\d+/);
      if (sm) {
        const { data: seqRow } = await supa.from("email_sequences")
          .select("from_name,from_email,brand_key").eq("id", sm[1]).maybeSingle();
        if (seqRow) {
          forceSeqSender = true;
          if (seqRow.from_name)  campaign.fromName = seqRow.from_name;
          if (seqRow.from_email) campaign.replyTo  = seqRow.from_email;
          if (seqRow.brand_key)  campaign.brand    = seqRow.brand_key;
        }
      }
    } catch (_) { /* best-effort: fall back to the client-provided sender */ }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY is not set on this function — no email can be sent." }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    if (!RESEND_FROM || /@resend\.dev$/i.test(RESEND_FROM)) {
      return new Response(JSON.stringify({ error: `RESEND_FROM is "${RESEND_FROM}" — that test sender only delivers to your own Resend account.` }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const skipped: any[] = [];
    const seen = new Set<string>();
    let recipients = (rawRecipients as any[]).filter((r) => {
      const e = validEmail(r?.email);
      if (!e) { skipped.push({ email: String(r?.email ?? ""), reason: "invalid address" }); return false; }
      const key = e.toLowerCase();
      if (seen.has(key)) { skipped.push({ email: e, reason: "duplicate" }); return false; }
      seen.add(key);
      r.email = e;
      return true;
    });

    if (!isTest) try {
      const byEmail = new Set<string>();
      const byId = new Set<string>();
      const emails = recipients.map((r) => String(r.email || "").toLowerCase()).filter(Boolean);
      const ids = recipients.map((r) => String(r.contactId || "")).filter(Boolean);
      for (let i = 0; i < emails.length; i += 200) {
        const { data } = await supa.from("email_optouts").select("email,contact_id").in("email", emails.slice(i, i + 200));
        (data || []).forEach((o: any) => { if (o.email) byEmail.add(String(o.email).toLowerCase()); if (o.contact_id) byId.add(String(o.contact_id)); });
      }
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supa.from("email_optouts").select("email,contact_id").in("contact_id", ids.slice(i, i + 200));
        (data || []).forEach((o: any) => { if (o.email) byEmail.add(String(o.email).toLowerCase()); if (o.contact_id) byId.add(String(o.contact_id)); });
      }
      if (byEmail.size || byId.size) {
        recipients = recipients.filter((r) => {
          const out = byEmail.has(String(r.email || "").toLowerCase()) || byId.has(String(r.contactId || ""));
          if (out) skipped.push({ email: r.email, reason: "unsubscribed" });
          return !out;
        });
      }
    } catch (_) { /* suppression table not migrated */ }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No sendable recipients left — every address was invalid, duplicate or unsubscribed.", skipped }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Daily volume cap. Anything over today's allowance is held back and
    // reported, not sent; send it again tomorrow.
    if (!isTest && DAILY_CAP > 0) {
      const room = Math.max(0, DAILY_CAP - await sentToday(supa));
      if (recipients.length > room) {
        recipients.slice(room).forEach((r: any) => skipped.push({ email: r.email, reason: `daily send cap (${DAILY_CAP}/day) reached; send again tomorrow` }));
        recipients = recipients.slice(0, room);
      }
      if (recipients.length === 0) {
        return new Response(JSON.stringify({ error: `Daily send cap of ${DAILY_CAP} reached. Nothing was sent; try again tomorrow.`, skipped }), { status: 429, headers: { ...CORS, "Content-Type": "application/json" } });
      }
    }

    // Authoritative personalization: real name + real company from the CRM.
    try {
      const cids = [...new Set(recipients.map((r: any) => r.contactId).filter(Boolean).map(String))];
      const cById = new Map<string, any>();
      for (let i = 0; i < cids.length; i += 300) {
        const { data } = await supa.from("contacts").select("id,name,title,account_id").in("id", cids.slice(i, i + 300));
        (data || []).forEach((c: any) => cById.set(String(c.id), c));
      }
      const accIds = [...new Set([...cById.values()].map((c: any) => c.account_id).filter(Boolean).map(String))];
      const accName = new Map<string, string>();
      for (let i = 0; i < accIds.length; i += 300) {
        const { data } = await supa.from("accounts").select("id,name").in("id", accIds.slice(i, i + 300));
        (data || []).forEach((a: any) => accName.set(String(a.id), String(a.name || "").trim()));
      }
      for (const r of recipients as any[]) {
        const base: any = { ...(r.ctx || {}) };
        // For a sequence send, the sender identity is the sequence's, so its
        // name/email win over any per-recipient fromName the browser attached.
        const senderNm = forceSeqSender ? (campaign.fromName || "") : (r.fromName || campaign.fromName || "");
        const senderEm = forceSeqSender ? (campaign.replyTo || "") : (r.replyTo || campaign.replyTo || "");
        base.sender_name = base.sender_name || senderNm;
        base.from_name = base.from_name || senderNm;
        base.sender_email = base.sender_email || String(senderEm).trim();
        const c = r.contactId ? cById.get(String(r.contactId)) : null;
        if (c) {
          const nm = String(c.name || "").trim();
          const first = nm.split(/\s+/)[0] || "";
          const last = nm.includes(" ") ? nm.slice(first.length).trim() : "";
          const company = c.account_id ? (accName.get(String(c.account_id)) || "") : "";
          if (first) base.first_name = first;
          if (last) base.last_name = last;
          if (nm) base.full_name = nm;
          if (c.title) base.title = c.title;
          if (company) base.company = company;
        }
        r.ctx = base;
      }
    } catch (_) { /* best-effort */ }

    if (!isTest) await supa.from("campaigns").upsert({
      id: campaign.id, name: campaign.name, subject: campaign.subject, from_name: campaign.fromName,
      preheader: campaign.preheader, body: campaign.body, image_url: campaign.imageUrl,
      cta_text: campaign.ctaText, cta_url: campaign.ctaUrl, status: "sending",
      recipient_count: Number(campaign.recipientTotal) || recipients.length, sent_at: new Date().toISOString(),
    });

    if (!isTest) {
      const rcRows = (recipients as any[]).filter((r) => r.contactId).map((r) => ({ campaign_id: campaign.id, contact_id: r.contactId, email: r.email }));
      for (let i = 0; i < rcRows.length; i += 500) {
        await supa.from("campaign_recipients").upsert(rcRows.slice(i, i + 500), { onConflict: "campaign_id,contact_id" });
      }
    }

    // Per-recipient sender (send on behalf of a rep) + brand-aware From domain.
    // When forceSeqSender is set, the sequence's sender wins over r.fromName/replyTo.
    function senderFor(r: any) {
      const addr = fromAddressFor(campaign, r);
      const nm = (!forceSeqSender && r && r.fromName) || campaign.fromName || (isSspSend(campaign, r) ? "Strategic Supply Partners" : "Chief Negotiators");
      return fromHeader(nm, addr);
    }
    function replyForRecipient(r: any) {
      const rt = ((!forceSeqSender && r && r.replyTo) || campaign.replyTo || "sales@thechiefnegotiators.com").trim();
      return rt || undefined;
    }
    const BCC_ALWAYS = (Deno.env.get("CAMPAIGN_BCC") || "sales@thechiefnegotiators.com").trim();
    const bccList = !isTest && BCC_ALWAYS ? [BCC_ALWAYS] : null;
    const attachments = Array.isArray(campaign.attachments)
      ? campaign.attachments.filter((a: any) => a && a.filename && a.content).map((a: any) => ({ filename: a.filename, content: a.content }))
      : [];

    const sentPairs: { r: any; id: string | null }[] = [];
    const failures: any[] = [];
    let batchCount = 0;

    if (attachments.length > 0) {
      for (const r of recipients) {
        try {
          const { res, json } = await resendFetch("https://api.resend.com/emails", {
            from: senderFor(r),
            ...(replyForRecipient(r) ? { reply_to: replyForRecipient(r) } : {}),
            ...(bccList ? { bcc: bccList } : {}),
            to: [r.email],
            subject: merge(campaign.subject, ctxFor(campaign, r)),
            html: renderHtml(campaign, ctxFor(campaign, r)),
            text: plainText(campaign, ctxFor(campaign, r)),
            ...(isTest ? {} : { headers: { "List-Unsubscribe": `<${unsubUrl(campaign.id, r)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
            attachments,
            tags: [
              { name: "campaign_id", value: String(campaign.id) },
              ...(r.contactId ? [{ name: "contact_id", value: String(r.contactId) }] : []),
              ...(campaign.templateId ? [{ name: "template_id", value: String(campaign.templateId) }] : []),
            ],
          });
          if (!res.ok) { failures.push({ email: r.email, error: json }); continue; }
          sentPairs.push({ r, id: json?.id || null });
        } catch (e) {
          failures.push({ email: r.email, error: String(e?.message || e) });
        }
      }
    } else {
      const batches: any[][] = [];
      for (let i = 0; i < recipients.length; i += 100) batches.push(recipients.slice(i, i + 100));
      batchCount = batches.length;
      for (const batch of batches) {
        const payload = batch.map((r: any) => ({
          from: senderFor(r),
          ...(replyForRecipient(r) ? { reply_to: replyForRecipient(r) } : {}),
          ...(bccList ? { bcc: bccList } : {}),
          to: [r.email],
          subject: merge(campaign.subject, ctxFor(campaign, r)),
          html: renderHtml(campaign, ctxFor(campaign, r)),
          text: plainText(campaign, ctxFor(campaign, r)),
          ...(isTest ? {} : { headers: { "List-Unsubscribe": `<${unsubUrl(campaign.id, r)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
          tags: [
            { name: "campaign_id", value: String(campaign.id) },
            ...(r.contactId ? [{ name: "contact_id", value: String(r.contactId) }] : []),
            ...(campaign.templateId ? [{ name: "template_id", value: String(campaign.templateId) }] : []),
          ],
        }));
        let res: Response; let json: any;
        try {
          ({ res, json } = await resendFetch("https://api.resend.com/emails/batch", payload));
        } catch (e) {
          batch.forEach((r: any) => failures.push({ email: r.email, error: String(e?.message || e) }));
          continue;
        }
        if (!res.ok) {
          for (const r of batch) {
            try {
              const { res: one, json: oj } = await resendFetch("https://api.resend.com/emails", payload[batch.indexOf(r)]);
              if (!one.ok) { failures.push({ email: r.email, error: oj }); continue; }
              sentPairs.push({ r, id: oj?.id || null });
            } catch (e) {
              failures.push({ email: r.email, error: String(e?.message || e) });
            }
          }
          continue;
        }
        const rows = json?.data || [];
        batch.forEach((r: any, i: number) => sentPairs.push({ r, id: rows[i]?.id || null }));
      }
    }

    if (!isTest) {
      const back = sentPairs.filter((p) => p.id && p.r?.contactId).map((p) => ({ campaign_id: campaign.id, contact_id: p.r.contactId, email: p.r.email, resend_email_id: p.id }));
      for (let i = 0; i < back.length; i += 500) {
        await supa.from("campaign_recipients").upsert(back.slice(i, i + 500), { onConflict: "campaign_id,contact_id" });
      }
    }

    if (sentPairs.length === 0) {
      if (!isTest) await supa.from("campaigns").update({ status: "error", error_message: JSON.stringify(failures.slice(0, 5)) }).eq("id", campaign.id);
      return new Response(JSON.stringify({ error: "Resend accepted none of the messages — nothing was delivered.", failures: failures.slice(0, 20), skipped }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const isFinalChunk = campaign.final !== false;
    const capped = skipped.some((x: any) => /daily send cap/.test(String(x.reason)));
    if (!isTest) {
      const total = Number(campaign.recipientTotal) || sentPairs.length;
      await supa.from("campaigns").update({
        status: isFinalChunk ? ((failures.length || capped) ? "sent_partial" : "sent") : "sending",
        recipient_count: total,
        ...(failures.length ? { error_message: JSON.stringify(failures.slice(0, 5)) } : {}),
      }).eq("id", campaign.id);
    }

    return new Response(JSON.stringify({ ok: true, test: isTest, sent: sentPairs.length, failed: failures.length, failures: failures.slice(0, 20), skipped, batches: batchCount }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
