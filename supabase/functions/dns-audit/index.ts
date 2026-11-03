// dns-audit — read-only email-security DNS snapshot for our domains: SPF,
// DMARC, MX, DKIM selectors (Resend + Microsoft 365), MTA-STS and TLS-RPT.
// POST {} (signed-in user or project key). Returns records only; changes
// nothing.
const DOMAINS = [
  "thechiefnegotiators.com", "strategicsupplypartners.com.au",
  "crm.thechiefnegotiators.com", "sspglobal.ai", "ferrersunshineestates.com",
];
const txt = async (n: string) => { try { return (await Deno.resolveDns(n, "TXT")).map((r) => r.join("")); } catch { return []; } };
const mx = async (n: string) => { try { return (await Deno.resolveDns(n, "MX")).map((r) => `${r.preference} ${r.exchange}`); } catch { return []; } };
const cname = async (n: string) => { try { return await Deno.resolveDns(n, "CNAME"); } catch { return []; } };

async function report(d: string) {
  const root = await txt(d);
  return {
    domain: d,
    spf: root.filter((t) => /^v=spf1/i.test(t)),
    dmarc: (await txt("_dmarc." + d)).filter((t) => /^v=DMARC1/i.test(t)),
    mx: await mx(d),
    dkim_resend: (await txt("resend._domainkey." + d)).length > 0,
    dkim_m365: [...await cname("selector1._domainkey." + d), ...await cname("selector2._domainkey." + d)],
    mta_sts: (await txt("_mta-sts." + d)).filter((t) => /^v=STSv1/i.test(t)),
    tls_rpt: (await txt("_smtp._tls." + d)).filter((t) => /^v=TLSRPTv1/i.test(t)),
    bimi: (await txt("default._bimi." + d)).filter((t) => /^v=BIMI1/i.test(t)),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const out = await Promise.all(DOMAINS.map(report));
  return new Response(JSON.stringify(out, null, 1), { headers: { "Content-Type": "application/json" } });
});
