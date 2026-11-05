// dns-audit — read-only security snapshot for our domains: email auth (SPF,
// DMARC, DKIM, MTA-STS, TLS-RPT), certificate control (CAA) and website
// headers (HSTS, CSP, framing). POST {}. Returns records only; changes nothing.
const DOMAINS = [
  "thechiefnegotiators.com", "strategicsupplypartners.com.au",
  "crm.thechiefnegotiators.com", "sspglobal.ai", "ferrersunshineestates.com",
];
const WEB = ["https://thechiefnegotiators.com", "https://www.thechiefnegotiators.com",
  "https://crm.thechiefnegotiators.com", "https://strategicsupplypartners.com.au"];
const q = async (n: string, t: string) => { try { return await Deno.resolveDns(n, t as any); } catch { return []; } };
const txt = async (n: string) => (await q(n, "TXT") as string[][]).map((r) => r.join(""));

async function report(d: string) {
  return {
    domain: d,
    spf: (await txt(d)).filter((t) => /^v=spf1/i.test(t)),
    dmarc: (await txt("_dmarc." + d)).filter((t) => /^v=DMARC1/i.test(t)),
    mx: (await q(d, "MX") as any[]).map((r) => `${r.preference} ${r.exchange}`),
    dkim_resend: (await txt("resend._domainkey." + d)).length > 0,
    dkim_m365: [...await q("selector1._domainkey." + d, "CNAME"), ...await q("selector2._domainkey." + d, "CNAME")],
    caa: (await q(d, "CAA") as any[]).map((r) => `${r.critical ? 128 : 0} ${r.tag} "${r.value}"`),
    mta_sts: (await txt("_mta-sts." + d)).filter((t) => /^v=STSv1/i.test(t)),
    tls_rpt: (await txt("_smtp._tls." + d)).filter((t) => /^v=TLSRPTv1/i.test(t)),
  };
}

const H = ["strict-transport-security", "content-security-policy", "x-frame-options",
  "x-content-type-options", "referrer-policy", "permissions-policy", "server"];
async function web(u: string) {
  try {
    const r = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    const h: Record<string, string | null> = {};
    for (const k of H) h[k] = r.headers.get(k);
    return { url: u, status: r.status, location: r.headers.get("location"), headers: h };
  } catch (e) { return { url: u, error: String(e) }; }
}
async function httpRedirect(host: string) {
  try {
    const r = await fetch("http://" + host, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    return { host, status: r.status, location: r.headers.get("location") };
  } catch (e) { return { host, error: String(e) }; }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const [dns, sites, plain] = await Promise.all([
    Promise.all(DOMAINS.map(report)),
    Promise.all(WEB.map(web)),
    Promise.all(["thechiefnegotiators.com", "crm.thechiefnegotiators.com"].map(httpRedirect)),
  ]);
  return new Response(JSON.stringify({ dns, sites, plain }, null, 1), { headers: { "Content-Type": "application/json" } });
});
