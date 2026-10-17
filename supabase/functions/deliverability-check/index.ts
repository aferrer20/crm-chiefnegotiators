// deliverability-check — read-only audit of what decides inbox vs junk:
// SPF / DKIM / DMARC / MX for every domain the CRM sends from, plus Resend's
// own verification and tracking status for those domains. Returns findings
// only; never echoes keys. POST {} (signed-in user).
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROMS = [Deno.env.get("RESEND_FROM") || "", Deno.env.get("RESEND_FROM_SSP") || ""].filter(Boolean);
const EXTRA = ["thechiefnegotiators.com", "strategicsupplypartners.com.au"];
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

const addr = (s: string) => (/<([^>]+)>/.exec(s)?.[1] || s).trim().toLowerCase();
async function txt(name: string) {
  try { return (await Deno.resolveDns(name, "TXT")).map((r) => r.join("")); } catch { return []; }
}
async function mx(name: string) {
  try { return (await Deno.resolveDns(name, "MX")).map((r) => `${r.preference} ${r.exchange}`); } catch { return []; }
}
async function cname(name: string) {
  try { return await Deno.resolveDns(name, "CNAME"); } catch { return []; }
}

async function domainReport(d: string) {
  const root = await txt(d);
  const spf = root.filter((t) => /^v=spf1/i.test(t));
  const dmarc = (await txt("_dmarc." + d)).filter((t) => /^v=DMARC1/i.test(t));
  const dkimResend = await txt("resend._domainkey." + d);
  const dkimM365 = [...await cname("selector1._domainkey." + d), ...await cname("selector2._domainkey." + d)];
  // Resend sends the envelope (Return-Path) from send.<domain>
  const sendSpf = (await txt("send." + d)).filter((t) => /^v=spf1/i.test(t));
  const sendMx = await mx("send." + d);
  return { domain: d, spf, dmarc, mx: await mx(d), dkim_resend: dkimResend.map((t) => t.slice(0, 40) + "…"), dkim_m365: dkimM365, send_subdomain: { spf: sendSpf, mx: sendMx } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const fromDomains = FROMS.map((f) => addr(f).split("@")[1]).filter(Boolean);
  const domains = [...new Set([...fromDomains, ...EXTRA])];
  const dns = await Promise.all(domains.map(domainReport));
  let resend: any = null;
  if (RESEND_API_KEY) {
    try {
      const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } });
      const j = await r.json();
      const list = j?.data || [];
      resend = await Promise.all(list.map(async (x: any) => {
        let det: any = {};
        try { det = await (await fetch(`https://api.resend.com/domains/${x.id}`, { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } })).json(); } catch {}
        return {
          name: x.name, status: x.status, region: x.region,
          open_tracking: det.open_tracking ?? null, click_tracking: det.click_tracking ?? null, tracking_subdomain: det.tracking_subdomain ?? null,
          records: (det.records || []).map((rec: any) => ({ record: rec.record, type: rec.type, name: rec.name, status: rec.status })),
        };
      }));
      if (!r.ok) resend = { error: r.status, message: j?.message || j?.name };
    } catch (e) { resend = { error: String(e) }; }
  }
  return new Response(JSON.stringify({ from_addresses: FROMS.map(addr), dns, resend }, null, 1), { headers: { ...CORS, "Content-Type": "application/json" } });
});
