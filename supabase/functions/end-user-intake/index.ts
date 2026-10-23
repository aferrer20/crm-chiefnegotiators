// end-user-intake — receives the public end-user discovery form
// (cncrm.thechiefnegotiators.com/end-user.html). verify_jwt is off: visitors are
// anonymous, so this function is the only way in and checks everything itself.
//
// On a valid submission it:
//   1. saves the row to end_user_submissions
//   2. links the submitter to a CRM contact (creating contact + account if new)
//   3. emails the owner the full discovery, reply-to the submitter
//   4. sends the submitter a short confirmation from the owner
//
// POST { offer, campaign, contact{name,title,company,email,phone}, quantity,
//        answers{...}, compliance{...}, attestation{name,title,agree}, website }
// "website" is a honeypot: people never see it, bots fill it in.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "";
const OWNER_EMAIL = "amanda@thechiefnegotiators.com";
const OWNER_NAME = "Amanda Ferrer";
const OWNER_REP_ID = "0264b86c-3692-452e-a410-f9e2e4fdd0fb";
const CRM_URL = "https://cncrm.thechiefnegotiators.com/";
const ORIGINS = ["https://cncrm.thechiefnegotiators.com", "http://localhost:8080"];
const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|mac|aol|proton|protonmail|gmx|zoho|qq|163|126|yandex|mail)\./i;

const OFFERS: Record<string, string> = {
  "h100-8gpu-2026-10": "8× NVIDIA H100 SXM5 servers · 40 available",
};
const QUESTIONS: [string, string][] = [
  ["end_user", "Actual end user(s)"],
  ["funding", "Funding sources and title"],
  ["workloads", "Workloads and software stack"],
  ["network", "Networking topology"],
  ["site", "Colocation / datacenter location"],
  ["schedule", "Deployment / rollout schedule"],
];
const DOCS: [string, string][] = [
  ["registrations", "Corporate registrations"],
  ["ownership", "Ownership and management structure"],
  ["board", "Board of directors"],
  ["other", "Other compliance documents"],
  ["leases", "Signed leases / hosting contracts"],
];
const DOC_STATUS = ["Ready", "In progress", "Not yet", "Not applicable"];

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin",
  };
}
const H = (extra: Record<string, string> = {}) => ({ apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json", ...extra });
async function sel(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H() });
  if (!r.ok) throw new Error(`select ${path.split("?")[0]} ${r.status}`);
  return await r.json();
}
async function ins(table: string, row: unknown) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: H({ Prefer: "return=representation" }), body: JSON.stringify(row) });
  if (!r.ok) throw new Error(`insert ${table} ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return (await r.json())[0];
}
async function patch(path: string, body: unknown) {
  await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "PATCH", headers: H({ Prefer: "return=minimal" }), body: JSON.stringify(body) });
}

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const validEmail = (e: string) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(e);

async function sendMail(msg: Record<string, unknown>) {
  if (!RESEND_API_KEY || !RESEND_FROM) return null;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });
  const out = await r.json().catch(() => ({}));
  return r.ok ? out.id : null;
}

// The submitter becomes (or matches) a CRM contact owned by the owner, filed
// under an account for their email domain unless it's a personal mailbox.
async function linkContact(c: any) {
  const email = c.email.toLowerCase();
  const found = await sel(`contacts?select=id&email=ilike.${encodeURIComponent(email)}&limit=1`);
  if (found[0]) return found[0].id as string;
  const domain = email.split("@")[1];
  let accountId: string | null = null;
  if (!FREE_MAIL.test(domain)) {
    const acct = await sel(`accounts?select=id&email_domain=eq.${encodeURIComponent(domain)}&limit=1`);
    accountId = acct[0]?.id || (await ins("accounts", {
      name: c.company, website: domain, email_domain: domain, owner_id: OWNER_REP_ID,
      company: "Chief Negotiators", capture_source: "end-user-form", captured_at: new Date().toISOString(),
    })).id;
  }
  const row = await ins("contacts", {
    name: c.name, title: c.title || null, email, phone: c.phone || null, account_id: accountId,
    owner_id: OWNER_REP_ID, company: "Chief Negotiators", last_touch: new Date().toISOString().slice(0, 10),
    capture_source: "end-user-form", captured_at: new Date().toISOString(), capture_reason: "Submitted end-user discovery form",
  });
  return row.id as string;
}

function ownerEmail(s: any) {
  const row = (k: string, v: string) => v ? `<tr><td style="padding:10px 0;border-top:1px solid #E6E0D3;width:190px;vertical-align:top;font:600 11px/1.5 Menlo,Consolas,monospace;letter-spacing:.08em;color:#8A6E3E;text-transform:uppercase">${esc(k)}</td><td style="padding:10px 0;border-top:1px solid #E6E0D3;vertical-align:top;font:14px/1.55 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1B2433;white-space:pre-wrap">${esc(v)}</td></tr>` : "";
  const block = (title: string, rows: string) => `<tr><td style="padding:26px 32px 0"><div style="font:400 20px Georgia,serif;color:#13254A">${esc(title)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px">${rows}</table></td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#F6F3EC">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F3EC"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#fff;border:1px solid #E6E0D3">
<tr><td style="background:#13254A;padding:24px 32px"><div style="font:600 11px Menlo,Consolas,monospace;letter-spacing:.18em;color:#C9A86A">NEW END-USER SUBMISSION</div>
<div style="font:400 26px/1.25 Georgia,serif;color:#fff;margin-top:8px">${esc(s.contact_company)} wants ${esc(s.quantity || "an allocation")}</div>
<div style="font:14px -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#C8D0DE;margin-top:6px">${esc(OFFERS[s.offer] || s.offer)}${s.campaign_id ? " · from " + esc(s.campaign_id) : ""}</div></td></tr>
${block("Contact", row("Name", s.contact_name) + row("Title", s.contact_title) + row("Company", s.contact_company) + row("Email", s.contact_email) + row("Phone", s.contact_phone) + row("Servers wanted", s.quantity))}
${block("Discovery", QUESTIONS.map(([k, l]) => row(l, s.answers[k])).join(""))}
${block("Compliance package", DOCS.map(([k, l]) => row(l, s.compliance[k])).join("") + row("Notes", s.compliance.notes))}
${block("Attestation", row("Signed", [s.attestation.name, s.attestation.title].filter(Boolean).join(", ")) + row("Date", s.attestation.date))}
<tr><td style="padding:28px 32px 32px"><a href="mailto:${esc(s.contact_email)}" style="display:inline-block;background:#13254A;color:#fff;text-decoration:none;font:600 13px -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;padding:12px 20px;border-radius:6px">Reply to ${esc(s.contact_name.split(" ")[0])}</a>
<div style="font:12px/1.6 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#776E5F;margin-top:16px">Saved in the CRM under End-user submissions and linked to the contact. Replying to this email goes straight to the submitter.</div></td></tr>
</table></td></tr></table></body></html>`;
}

function confirmEmail(s: any) {
  const first = s.contact_name.split(" ")[0];
  const text = `Hi ${first},\n\nThank you. Your end-user discovery for the ${OFFERS[s.offer] || "allocation"} is in.\n\nWhat happens next:\n1. I review it personally, usually within one business day.\n2. Once you qualify, I send the full datasheet, pricing and allocation terms.\n3. Discovery then goes to the OEM and NVIDIA for compliance alignment, so your quote is not held up later.\n\nIf anything changes in the meantime, just reply to this email.\n\n${OWNER_NAME}\nFounder & CEO, The Chief Negotiators\n${OWNER_EMAIL} · +1 727-504-9949`;
  const html = `<!doctype html><html><body style="margin:0;background:#F6F3EC"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F3EC"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #E6E0D3">
<tr><td style="background:#13254A;padding:22px 32px;font:600 11px Menlo,Consolas,monospace;letter-spacing:.18em;color:#C9A86A">END-USER DISCOVERY RECEIVED</td></tr>
<tr><td style="padding:30px 32px 6px;font:16px/1.65 Georgia,serif;color:#1B2433">Hi ${esc(first)},<br><br>Thank you. Your end-user discovery for the <b>${esc(OFFERS[s.offer] || "allocation")}</b> is in.</td></tr>
<tr><td style="padding:10px 32px 0">${[
    ["01", "I review it personally, usually within one business day."],
    ["02", "Once you qualify, I send the full datasheet, pricing and allocation terms."],
    ["03", "Discovery goes to the OEM and NVIDIA for compliance alignment, so your quote is not held up later."],
  ].map(([n, t]) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="width:40px;padding:12px 0;border-top:1px solid #E6E0D3;vertical-align:top;font:400 18px Georgia,serif;color:#A88A4F">${n}</td><td style="padding:12px 0;border-top:1px solid #E6E0D3;font:15px/1.55 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#3B3F4A">${t}</td></tr></table>`).join("")}</td></tr>
<tr><td style="padding:22px 32px 32px;font:15px/1.65 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#3B3F4A">If anything changes in the meantime, just reply to this email.<br><br><span style="font:400 18px Georgia,serif;color:#13254A">${OWNER_NAME}</span><br><span style="color:#776E5F;font-size:13px">Founder &amp; CEO, The Chief Negotiators<br>${OWNER_EMAIL} · +1 727-504-9949</span></td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}

Deno.serve(async (req) => {
  const C = cors(req);
  const out = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...C, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: C });
  if (req.method !== "POST") return out({ error: "POST only" }, 405);

  let b: any;
  try { b = await req.json(); } catch { return out({ error: "Please try again." }, 400); }
  if (clip(b.website, 200)) return out({ ok: true });   // honeypot: look successful, keep nothing

  const offer = clip(b.offer, 60);
  if (!OFFERS[offer]) return out({ error: "This form link is out of date. Reply to the email and we'll send a fresh one." }, 400);
  const c = b.contact || {};
  const s: any = {
    offer, campaign_id: clip(b.campaign, 120) || null,
    contact_name: clip(c.name, 120), contact_title: clip(c.title, 120) || null, contact_company: clip(c.company, 160),
    contact_email: clip(c.email, 200).toLowerCase(), contact_phone: clip(c.phone, 60) || null,
    quantity: clip(b.quantity, 60) || null,
    answers: Object.fromEntries(QUESTIONS.map(([k]) => [k, clip(b.answers?.[k], 4000)])),
    compliance: {
      ...Object.fromEntries(DOCS.map(([k]) => [k, DOC_STATUS.includes(b.compliance?.[k]) ? b.compliance[k] : "Not yet"])),
      notes: clip(b.compliance?.notes, 2000),
    },
    attestation: { name: clip(b.attestation?.name, 120), title: clip(b.attestation?.title, 120), agree: b.attestation?.agree === true, date: new Date().toISOString().slice(0, 10) },
    user_agent: clip(req.headers.get("user-agent"), 300),
  };

  const missing: string[] = [];
  if (!s.contact_name) missing.push("your name");
  if (!s.contact_company) missing.push("company");
  if (!validEmail(s.contact_email)) missing.push("a valid work email");
  for (const k of ["end_user", "funding", "workloads", "site", "schedule"]) if (!s.answers[k]) missing.push(QUESTIONS.find((q) => q[0] === k)![1].toLowerCase());
  if (!s.attestation.name || !s.attestation.agree) missing.push("the attestation");
  if (missing.length) return out({ error: `Please add ${missing.join(", ")}.` }, 422);

  try {
    // A double click or a resubmit within two minutes is the same submission.
    const since = new Date(Date.now() - 120000).toISOString();
    const dup = await sel(`end_user_submissions?select=id&contact_email=eq.${encodeURIComponent(s.contact_email)}&offer=eq.${offer}&created_at=gte.${encodeURIComponent(since)}&limit=1`);
    if (dup[0]) return out({ ok: true, id: dup[0].id });

    try { s.contact_id = await linkContact({ name: s.contact_name, title: s.contact_title, company: s.contact_company, email: s.contact_email, phone: s.contact_phone }); }
    catch (_) { s.contact_id = null; }   // never lose a submission over the CRM link
    const row = await ins("end_user_submissions", s);

    const notified = await sendMail({
      from: `"CN End-User Desk" <${RESEND_FROM}>`, to: [OWNER_EMAIL], reply_to: s.contact_email,
      subject: `Qualify: ${s.contact_company} · ${s.quantity || "H100"} · end-user form`,
      html: ownerEmail(s),
      text: `${s.contact_name} (${s.contact_company}) submitted end-user discovery for ${OFFERS[offer]}.\n${s.contact_email}${s.contact_phone ? " · " + s.contact_phone : ""}\n\n` + QUESTIONS.map(([k, l]) => `${l}:\n${s.answers[k] || "-"}`).join("\n\n") + `\n\nOpen the CRM: ${CRM_URL}`,
      tags: [{ name: "campaign_id", value: "end-user-intake" }],
    });
    if (notified) await patch(`end_user_submissions?id=eq.${row.id}`, { notified_at: new Date().toISOString() });
    const conf = confirmEmail(s);
    await sendMail({
      from: `"${OWNER_NAME}" <${RESEND_FROM}>`, to: [s.contact_email], reply_to: OWNER_EMAIL,
      subject: "Received: your end-user discovery", html: conf.html, text: conf.text,
      tags: [{ name: "campaign_id", value: "end-user-intake" }],
    });
    return out({ ok: true, id: row.id });
  } catch (_e) {
    return out({ error: "We couldn't save that just now. Please try again, or email amanda@thechiefnegotiators.com." }, 500);
  }
});
