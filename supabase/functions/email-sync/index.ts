// email-sync — company-wide (app token per tenant) + per-rep fallback. See Email Tracking Setup.md.
//
// Contact capture: every external person a rep emails, AND every external
// person who emails a rep, is recorded the moment the message is tracked —
// the same way call-sync records an unknown caller. Unknown business domains
// become accounts owned by the rep. Everything created here is stamped
// capture_source = 'email-sync' so the CRM can badge it "New from email" and
// a rep can bulk-dismiss anything that isn't a real relationship.
// Never captured: internal/team domains, personal mailboxes (gmail, outlook…),
// vendors and notification senders, no-reply addresses, calendar invites and
// auto-replies.
const MS_CLIENT_ID = Deno.env.get("MS_CLIENT_ID") || "add7572c-ae7a-4668-bd9d-2f15d27f935e";
const MS_CLIENT_SECRET = Deno.env.get("MS_CLIENT_SECRET") || "";
const MS_TENANT = Deno.env.get("MS_TENANT") || "common";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;
const BACKFILL_DAYS = Number(Deno.env.get("EMAIL_SYNC_BACKFILL_DAYS") || 7);
const OVERLAP_MS = 15 * 60000;
const MAX_PER_FOLDER = 300;
const MAX_FILE = 25 * 1024 * 1024;
const MAX_FILES_TOTAL = 40 * 1024 * 1024;
const BUCKET = "email-attachments";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST,OPTIONS" };

const list = (s: string | undefined) => String(s || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const INTERNAL = new Set(["thechiefnegotiators.com", "strategicsupplypartners.com.au", "thevaultmarketingco.com", ...list(Deno.env.get("EMAIL_SYNC_INTERNAL_DOMAINS"))]);
const PERSONAL_LABELS = new Set(["gmail", "googlemail", "yahoo", "ymail", "rocketmail", "hotmail", "outlook", "live", "msn", "passport", "icloud", "me", "mac", "aol", "proton", "protonmail", "pm", "gmx", "web", "mail", "yandex", "zoho", "qq", "163", "126", "naver", "bigpond", "optusnet", "tpg", "iinet", "comcast", "verizon", "att", "sbcglobal", "cox", "charter", "btinternet", "sky", "virginmedia", "orange", "free", "laposte", "libero", "t-online", "rediffmail", "fastmail", "hey", "tutanota", "duck"]);
const VENDOR = new Set([
  "docusign.net", "docusign.com", "zoom.us", "zoom.com", "zoomgov.com", "calendly.com", "cal.com", "savvycal.com",
  "hubspot.com", "hubspotemail.net", "mailchimp.com", "mcsv.net", "sendgrid.net", "resend.dev", "amazonses.com", "mailgun.org", "postmarkapp.com",
  "linkedin.com", "slack.com", "notion.so", "dropbox.com", "box.com", "wetransfer.com", "loom.com", "typeform.com", "eventbrite.com",
  "gong.io", "fireflies.ai", "otter.ai", "fathom.video", "read.ai", "tldv.io", "stripe.com", "paypal.com", "intuit.com", "xero.com",
  "atlassian.net", "github.com", "zendesk.com", "intercom.io", "intercom-mail.com", "salesforce.com", "pandadoc.com", "adobesign.com", "echosign.com",
  "facebookmail.com", "medium.com", "substack.com", "formsubmit.co", "supabase.com", "supabase.io", "vercel.com",
  ...list(Deno.env.get("EMAIL_SYNC_BLOCK_DOMAINS")),
]);
const NOREPLY = /^(no-?reply|do-?not-?reply|donotreply|noreply[-.\w]*|notifications?|notify|mailer-daemon|postmaster|bounces?|alerts?|newsletters?|news|updates|marketing|automated|system|calendar|invites?)([+._-].*)?$/i;
const NOTIFY_HOST = /^(notifications?|notify|alerts?|mail\d*|mailer|mailing|email|e|m|mg|em\d*|bounces?|news(letters?)?|marketing|updates|info|send(er)?|sg|mc|cmail\d*|mta\d*|smtp|msg|messages?|comms|noreply|no-reply|reply|transactional|campaigns?|engage|hello)\./i;
// Automated mailboxes that carry a brand prefix (microsoft-noreply@,
// workspace-noreply@) or are product mail rather than a person.
const NOREPLY_ANY = /(^|[._+-])(no-?reply|do-?not-?reply|donotreply)([._+-]|$)/i;
const SYSTEM_LOCAL = /^(welcome|submissions?|verify|verification|identity|identitycheck|onboarding-noreply|receipts?|statements?)([+._-].*)?$/i;
const INVITE_SUBJ = /^\s*(accepted|declined|tentative(ly accepted)?|canceled|cancelled|updated invitation|invitation|new time proposed)\s*:/i;
const AUTO_SUBJ = /^\s*(automatic reply|auto(matic)?[- ]?reply|out of (the )?office|ooo\b|undeliverable|delivery status notification|mail delivery (failed|subsystem)|returned mail|read:|not read:)/i;
const REPLY_SUBJ = /^\s*(re|aw|antw|rv|ref|sv)\s*:/i;
// Generic role inboxes are fine to log against but are not people, so they are
// never created as contacts on INBOUND capture (outbound keeps old behaviour).
const ROLE_INBOX = /^(sales|contact|enquiries|inquiries|office|careers|jobs|hr|press|media|partners?|procurement|purchasing|ap|ar|finance|billing|invoices?|receipts?|support|help|hello|info|team|admin|security|accounts?)([+._-].*)?$/i;

const SLD = new Set(["co", "com", "net", "org", "gov", "ac", "edu", "ltd", "plc", "ne", "or", "id", "asn"]);
function baseDomain(host: string) {
  const p = String(host || "").toLowerCase().replace(/\.$/, "").split(".").filter(Boolean);
  if (p.length <= 2) return p.join(".");
  const tld = p[p.length - 1], sld = p[p.length - 2];
  return tld.length === 2 && SLD.has(sld) ? p.slice(-3).join(".") : p.slice(-2).join(".");
}
function isPersonal(dom: string) { return PERSONAL_LABELS.has(dom.split(".")[0]); }
function excludedAddress(addr: string, repEmails: Set<string>) {
  const a = addr.toLowerCase();
  const [local, host] = a.split("@");
  if (!local || !host) return "invalid";
  const dom = baseDomain(host);
  if (repEmails.has(a) || INTERNAL.has(dom)) return "internal";
  if (isPersonal(dom)) return "personal";
  if (VENDOR.has(dom) || VENDOR.has(host)) return "vendor";
  // System senders live on sending subdomains (notifications.microsoft.com,
  // email.stripe.com, mail.linkedin.com…) even when the parent company is a
  // real prospect, so the subdomain decides, not the brand.
  if (host !== dom && NOTIFY_HOST.test(host)) return "vendor";
  if (NOREPLY.test(local) || NOREPLY_ANY.test(local) || SYSTEM_LOCAL.test(local)) return "noreply";
  return "";
}
function nameFromDomain(dom: string) {
  return dom.split(".")[0].split(/[-_]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || dom;
}
function nameFromAddress(ea: any) {
  const n = String(ea?.name || "").trim();
  if (n && !n.includes("@")) return n;
  return String(ea?.address || "").split("@")[0].split(/[._-]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || String(ea?.address || "");
}
const strip = (html: string) => String(html || "")
  .replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

const H = (extra: Record<string, string> = {}) => ({ apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json", ...extra });
async function sel(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H() });
  if (!r.ok) throw new Error(`select ${path.split("?")[0]}: ${await r.text()}`);
  return await r.json();
}
async function ins(table: string, row: any) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: H({ Prefer: "return=representation" }), body: JSON.stringify(row) });
  if (!r.ok) throw new Error(`insert ${table}: ${await r.text()}`);
  const j = await r.json();
  return Array.isArray(j) ? j[0] : j;
}
async function patch(path: string, body: any) {
  await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "PATCH", headers: H({ Prefer: "return=minimal" }), body: JSON.stringify(body) });
}
async function insLoose(table: string, row: any) {
  let attempt = { ...row };
  for (let i = 0; i < 8; i++) {
    try { return await ins(table, attempt); } catch (e) {
      const m = /column "?([a-z_]+)"? .*does not exist|Could not find the '([a-z_]+)' column/i.exec(String(e));
      const col = m && (m[1] || m[2]);
      if (!col || !(col in attempt)) throw e;
      delete attempt[col];
    }
  }
  return await ins(table, attempt);
}
async function upload(path: string, bytes: Uint8Array, type: string) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST", headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": type || "application/octet-stream", "x-upsert": "true" }, body: bytes,
  });
  return r.ok;
}

let BASE = "/me";
const APP_ID = Deno.env.get("AZURE_CLIENT_ID") || MS_CLIENT_ID;
const APP_SECRET = Deno.env.get("AZURE_CLIENT_SECRET") || MS_CLIENT_SECRET;
const cleanTenant = (s: string) => String(s || "").trim().replace(/^["'<\[{(\s]+|[>"'\]})\s]+$/g, "").trim();
const TENANT_MAP = new Map<string, string>(list(Deno.env.get("EMAIL_SYNC_TENANTS")).map((p) => p.split("=").map((x) => cleanTenant(x).toLowerCase()) as [string, string]).filter((p) => p[0] && p[1]));
const DEFAULT_TENANT = cleanTenant(Deno.env.get("AZURE_TENANT_ID") || "");
function tenantFor(email: string) {
  const dom = String(email || "").toLowerCase().split("@")[1] || "";
  return TENANT_MAP.get(dom) || (TENANT_MAP.size ? "" : DEFAULT_TENANT);
}
const appTokens = new Map<string, Promise<string>>();
function appToken(tenant: string) {
  if (!appTokens.has(tenant)) appTokens.set(tenant, (async () => {
    const form = new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" });
    const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
    const j = await r.json();
    if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || "app token failed");
    return j.access_token as string;
  })());
  return appTokens.get(tenant)!;
}
async function refresh(rt: string) {
  const form = new URLSearchParams({ client_id: MS_CLIENT_ID, client_secret: MS_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: rt, scope: "openid profile offline_access User.Read Mail.Read Mail.Send" });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || "token refresh failed — reconnect Outlook");
  return { token: j.access_token as string, rt: (j.refresh_token as string) || null };
}
async function graph(token: string, url: string, raw = false) {
  const r = await fetch(url.startsWith("http") ? url : "https://graph.microsoft.com/v1.0" + url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`graph ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return raw ? new Uint8Array(await r.arrayBuffer()) : await r.json();
}
const FIELDS = "id,internetMessageId,conversationId,subject,body,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,hasAttachments";
async function folder(token: string, name: string, dateField: string, since: string) {
  let url = `${BASE}/mailFolders/${name}/messages?$top=50&$orderby=${dateField} desc&$select=${FIELDS}&$filter=${dateField} ge ${since}`;
  const out: any[] = [];
  while (url && out.length < MAX_PER_FOLDER) {
    const d = await graph(token, url);
    out.push(...(d.value || []));
    url = d["@odata.nextLink"] || "";
  }
  return out;
}

type Ctx = { reps: any[]; repEmails: Set<string>; acctByDomain: Map<string, any>; contactByEmail: Map<string, any>; openOpps: any[]; knownConvs: Set<string>; };
async function loadCtx(): Promise<Ctx> {
  const [reps, accts, contacts, opps] = await Promise.all([
    sel("reps?select=id,name,email,auth_user_id,company"),
    sel("accounts?select=id,name,owner_id,company,website,email_domain"),
    sel("contacts?select=id,email,account_id,owner_id&email=not.is.null"),
    sel("opportunities?select=id,account_id,owner_id,stage").catch(() => []),
  ]);
  const acctByDomain = new Map<string, any>();
  for (const a of accts) {
    const d = String(a.email_domain || "").toLowerCase() || (a.website ? baseDomain(String(a.website).replace(/^[a-z]+:\/\//i, "").replace(/^www\./i, "").split(/[/:?#]/)[0]) : "");
    if (d && !acctByDomain.has(d)) acctByDomain.set(d, a);
  }
  const acctById = new Map(accts.map((a: any) => [String(a.id), a]));
  const contactByEmail = new Map<string, any>();
  for (const c of contacts) {
    const e = String(c.email || "").toLowerCase().trim();
    if (!e) continue;
    if (!contactByEmail.has(e)) contactByEmail.set(e, c);
    const d = baseDomain(e.split("@")[1] || "");
    if (c.account_id && d && !acctByDomain.has(d) && !isPersonal(d) && !INTERNAL.has(d)) {
      const a = acctById.get(String(c.account_id));
      if (a) acctByDomain.set(d, a);
    }
  }
  return { reps, repEmails: new Set(reps.map((r: any) => String(r.email || "").toLowerCase()).filter(Boolean)), acctByDomain, contactByEmail, openOpps: opps.filter((o: any) => !["won", "lost"].includes(String(o.stage || "").toLowerCase())), knownConvs: new Set() };
}

// Accounts and contacts created here carry their provenance, so the CRM can
// badge them "New from email" and nobody wonders where a record came from.
function captureStamp(why: string) {
  return { capture_source: "email-sync", captured_at: new Date().toISOString(), capture_reason: why };
}
async function ensureAccount(ctx: Ctx, dom: string, rep: any, why: string) {
  const hit = ctx.acctByDomain.get(dom);
  if (hit) {
    if (!hit.email_domain) { hit.email_domain = dom; await patch(`accounts?id=eq.${hit.id}`, { email_domain: dom }); }
    return { acct: hit, created: false };
  }
  const stamp = captureStamp(why);
  const acct = await insLoose("accounts", { name: nameFromDomain(dom), website: dom, email_domain: dom, owner_id: rep.id, company: rep.company || "Chief Negotiators", capture_source: stamp.capture_source, captured_at: stamp.captured_at });
  ctx.acctByDomain.set(dom, acct);
  return { acct, created: true };
}
async function ensureContact(ctx: Ctx, ea: any, acct: any, rep: any, why: string) {
  const email = String(ea.address || "").toLowerCase();
  const hit = ctx.contactByEmail.get(email);
  if (hit) {
    if (!hit.account_id) { hit.account_id = acct.id; await patch(`contacts?id=eq.${hit.id}`, { account_id: acct.id }); }
    return { contact: hit, created: false };
  }
  const c = await insLoose("contacts", { name: nameFromAddress(ea), email: ea.address, account_id: acct.id, owner_id: acct.owner_id || rep.id, company: acct.company || rep.company || "Chief Negotiators", ...captureStamp(why) });
  ctx.contactByEmail.set(email, c);
  return { contact: c, created: true };
}
function oppFor(ctx: Ctx, acctId: any, repId: any) {
  const on = ctx.openOpps.filter((o) => String(o.account_id) === String(acctId));
  return (on.find((o) => o.owner_id === repId) || on[0] || null)?.id || null;
}

async function saveAttachments(token: string, m: any) {
  if (!m.hasAttachments) return [];
  const d = await graph(token, `${BASE}/messages/${m.id}/attachments?$select=id,name,contentType,size,isInline`);
  const out: any[] = []; let total = 0;
  for (const a of d.value || []) {
    if (a.isInline || a["@odata.type"] !== "#microsoft.graph.fileAttachment") continue;
    const meta: any = { name: a.name, size: a.size, contentType: a.contentType };
    if (a.size > MAX_FILE || total + a.size > MAX_FILES_TOTAL) { meta.skipped = "too large"; out.push(meta); continue; }
    try {
      const bytes = await graph(token, `${BASE}/messages/${m.id}/attachments/${a.id}/$value`, true) as Uint8Array;
      const path = `${hash(m.internetMessageId || m.id)}/${Date.now().toString(36)}-${String(a.name || "file").replace(/[^\w.\-]+/g, "_")}`;
      if (await upload(path, bytes, a.contentType)) { meta.path = path; total += a.size; } else meta.skipped = "upload failed";
    } catch { meta.skipped = "download failed"; }
    out.push(meta);
  }
  return out;
}

async function alreadyLogged(mids: string[]) {
  const seen = new Set<string>();
  for (let i = 0; i < mids.length; i += 40) {
    const chunk = mids.slice(i, i + 40).map((x) => `"${x.replace(/"/g, '\\"')}"`).join(",");
    const rows = await sel(`email_messages?select=message_id,account_id&message_id=in.(${encodeURIComponent(chunk)})`);
    rows.forEach((r: any) => seen.add(r.message_id + "|" + r.account_id));
  }
  return seen;
}
async function loadConvs(ids: string[], into: Set<string>) {
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40).map((x) => `"${x}"`).join(",");
    const rows = await sel(`email_messages?select=conversation_id&conversation_id=in.(${encodeURIComponent(chunk)})`);
    rows.forEach((r: any) => r.conversation_id && into.add(r.conversation_id));
  }
}

async function logOne(ctx: Ctx, token: string, rep: any, m: any, dir: "out" | "in", groups: Map<string, any[]>, seen: Set<string>, stats: any) {
  const mid = m.internetMessageId || m.id;
  const html = m.body?.contentType === "html" ? String(m.body?.content || "") : "";
  const text = html ? strip(html) : String(m.body?.content || "");
  let files: any[] | null = null;
  const at = (dir === "out" ? m.sentDateTime : m.receivedDateTime) || new Date().toISOString();
  const addrs = (arr: any[]) => (arr || []).map((r: any) => ({ name: r.emailAddress?.name || "", email: r.emailAddress?.address || "" }));
  const why = dir === "out" ? "emailed by rep" : "emailed a rep";
  for (const [dom, people] of groups) {
    // Inbound mail now creates the company too — someone writing to a rep
    // from a domain the CRM has never seen is exactly the lead to capture.
    const { acct, created } = await ensureAccount(ctx, dom, rep, why);
    if (!acct) continue;
    if (seen.has(mid + "|" + acct.id)) continue;
    const contacts = [];
    for (const ea of people) {
      const local = String(ea.address || "").split("@")[0];
      // A role inbox (sales@, office@) is logged against the company but is
      // not a person, so inbound mail never creates a contact for it.
      if (dir === "in" && ROLE_INBOX.test(local)) continue;
      const r = await ensureContact(ctx, ea, acct, rep, why);
      contacts.push(r.contact);
      if (r.created) stats.contactsCreated++;
    }
    if (files === null) files = await saveAttachments(token, m).catch(() => []);
    const act = await insLoose("activities", {
      type: "email", owner_id: rep.id, participants: [rep.id],
      contact_id: contacts[0]?.id || null, opportunity_id: oppFor(ctx, acct.id, rep.id),
      subject: (m.subject || "(no subject)").slice(0, 300),
      summary: text.slice(0, 600) + (text.length > 600 ? "…" : ""),
      occurred_at: at, company: rep.company || "Chief Negotiators", source: "email-sync",
      raw: { messageId: mid, conversationId: m.conversationId || null, direction: dir, accountId: acct.id, accountOwnerId: acct.owner_id || null, createdAccount: created, contactIds: contacts.map((c: any) => c.id), attachments: (files || []).length, from: m.from?.emailAddress?.address || "" },
    });
    await ins("email_messages", {
      message_id: mid, conversation_id: m.conversationId || null, account_id: String(acct.id), activity_id: String(act.id),
      rep_id: rep.id, direction: dir, from_email: m.from?.emailAddress?.address || "", from_name: m.from?.emailAddress?.name || "",
      to_list: addrs(m.toRecipients), cc_list: addrs(m.ccRecipients), subject: m.subject || "",
      body_html: html || null, body_text: text, attachments: files || [], sent_at: at,
    }).catch((e) => { if (!/duplicate|23505/.test(String(e))) throw e; });
    seen.add(mid + "|" + acct.id);
    if (m.conversationId) ctx.knownConvs.add(m.conversationId);
    for (const c of contacts) await patch(`contacts?id=eq.${c.id}`, { last_touch: at.slice(0, 10) }).catch(() => {});
    stats.logged++; if (created) stats.accountsCreated++;
  }
}
function isInvite(m: any) { return m["@odata.type"] === "#microsoft.graph.eventMessage" || INVITE_SUBJ.test(m.subject || ""); }
function isAuto(m: any) { return AUTO_SUBJ.test(m.subject || ""); }

async function runMailbox(ctx: Ctx, token: string, rep: any, mailbox: string, lastSync: string | null) {
  const stats = { email: mailbox, sent: 0, inbox: 0, logged: 0, accountsCreated: 0, contactsCreated: 0, error: null as string | null };
  const mine = new Set([mailbox.toLowerCase(), String(rep.email || "").toLowerCase()].filter(Boolean));
  const repEmails = new Set([...ctx.repEmails, ...mine]);
  const sinceMs = lastSync ? new Date(lastSync).getTime() - OVERLAP_MS : Date.now() - BACKFILL_DAYS * 86400000;
  const since = new Date(sinceMs).toISOString();
  const sent = (await folder(token, "sentitems", "sentDateTime", since)).filter((m) => !isInvite(m)).reverse();
  const inbox = (await folder(token, "inbox", "receivedDateTime", since)).filter((m) => !isInvite(m) && !isAuto(m)).reverse();
  stats.sent = sent.length; stats.inbox = inbox.length;
  const seen = await alreadyLogged([...sent, ...inbox].map((m) => m.internetMessageId || m.id));
  await loadConvs(Array.from(new Set(inbox.map((m) => m.conversationId).filter(Boolean))), ctx.knownConvs);
  for (const m of sent) {
    const groups = new Map<string, any[]>();
    for (const r of [...(m.toRecipients || []), ...(m.ccRecipients || [])]) {
      const ea = r.emailAddress || {}; const a = String(ea.address || "").toLowerCase();
      if (!a || excludedAddress(a, repEmails)) continue;
      const dom = baseDomain(a.split("@")[1]);
      const g = groups.get(dom) || []; if (!g.some((x) => x.address.toLowerCase() === a)) g.push(ea); groups.set(dom, g);
    }
    if (groups.size) await logOne(ctx, token, rep, m, "out", groups, seen, stats);
  }
  // Inbound: anyone outside the team who writes to a rep is recorded, known
  // company or not, thread or not. Exclusions above keep newsletters, vendors,
  // no-reply senders, personal mailboxes and auto-replies out.
  for (const m of inbox) {
    const ea = m.from?.emailAddress || {}; const a = String(ea.address || "").toLowerCase();
    if (!a || excludedAddress(a, repEmails)) continue;
    const dom = baseDomain(a.split("@")[1]);
    await logOne(ctx, token, rep, m, "in", new Map([[dom, [ea]]]), seen, stats);
  }
  return stats;
}

async function runCompanyWide(ctx: Ctx, onlyRepId: string | null) {
  const out: any[] = []; const covered = new Set<string>();
  if (!APP_SECRET || (!DEFAULT_TENANT && !TENANT_MAP.size)) return { out, covered };
  const state = new Map<string, any>((await sel("email_sync_mailboxes?select=*").catch(() => [])).map((r: any) => [r.mailbox, r]));
  for (const rep of ctx.reps) {
    const mailbox = String(rep.email || "").toLowerCase();
    if (!mailbox.includes("@") || (onlyRepId && rep.id !== onlyRepId)) continue;
    const tenant = tenantFor(mailbox);
    if (!tenant) continue;
    const started = new Date().toISOString();
    const row = { mailbox, rep_id: rep.id, auth_user_id: rep.auth_user_id || null, updated_at: started } as any;
    try {
      const token = await appToken(tenant);
      BASE = `/users/${encodeURIComponent(mailbox)}`;
      const stats = await runMailbox(ctx, token, rep, mailbox, state.get(mailbox)?.email_sync_at || null);
      out.push({ mode: "company", ...stats });
      row.email_sync_at = started; row.email_sync_error = null;
      covered.add(rep.id);
    } catch (e) {
      const msg = String((e as any)?.message || e);
      row.email_sync_error = /graph 403/.test(msg) ? "Mailbox not in the CRM access group" : /graph 404/.test(msg) ? "Mailbox not found in Microsoft 365" : msg.slice(0, 300);
      if (state.get(mailbox)?.email_sync_at) row.email_sync_at = state.get(mailbox).email_sync_at;
      out.push({ mode: "company", email: mailbox, error: row.email_sync_error });
    }
    await fetch(`${SUPABASE_URL}/rest/v1/email_sync_mailboxes?on_conflict=mailbox`, { method: "POST", headers: H({ Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify(row) }).catch(() => {});
  }
  return { out, covered };
}

async function runConnection(ctx: Ctx, conn: any) {
  const started = new Date().toISOString();
  try {
    const rep = ctx.reps.find((r) => r.auth_user_id === conn.auth_user_id) || ctx.reps.find((r) => String(r.email || "").toLowerCase() === String(conn.email || "").toLowerCase());
    if (!rep) throw new Error("No rep is linked to this login — add it in reps.auth_user_id");
    const { token, rt } = await refresh(conn.refresh_token);
    if (rt) await patch(`outlook_connections?auth_user_id=eq.${conn.auth_user_id}`, { refresh_token: rt });
    BASE = "/me";
    const stats = await runMailbox(ctx, token, rep, String(conn.email || ""), conn.email_sync_at);
    await patch(`outlook_connections?auth_user_id=eq.${conn.auth_user_id}`, { email_sync_at: started, email_sync_error: null });
    return { mode: "connected", ...stats };
  } catch (e) {
    const error = String((e as any)?.message || e).slice(0, 300);
    await patch(`outlook_connections?auth_user_id=eq.${conn.auth_user_id}`, { email_sync_error: error });
    return { mode: "connected", email: conn.email, error };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let body: any = {};
  try { body = await req.json(); } catch {}
  try {
    const ctx = await loadCtx();
    const onlyRep = body.uid ? (ctx.reps.find((r) => r.auth_user_id === body.uid)?.id || "__none__") : null;
    const { out, covered } = await runCompanyWide(ctx, onlyRep);
    const conns = await sel(`outlook_connections?select=auth_user_id,email,refresh_token,email_sync_at&status=neq.revoked${body.uid ? `&auth_user_id=eq.${body.uid}` : ""}`);
    for (const c of conns) {
      const rep = ctx.reps.find((r) => r.auth_user_id === c.auth_user_id);
      if (rep && covered.has(rep.id)) continue;
      out.push(await runConnection(ctx, c));
    }
    return new Response(JSON.stringify({ ok: true, results: out }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message || e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
