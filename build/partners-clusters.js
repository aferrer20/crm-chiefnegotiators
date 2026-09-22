var CN_CLAIM_LOCAL_KEY = "cn-cluster-claims-v1";
var CLAIM_STALE_DAYS = 14;
var CLAIM_WARN_DAYS = 10;
var _cnClaims = [];
var _cnClaimsLoaded = false;
function cnClusterKey(partnerId, region) {
  return String(partnerId) + "::" + String(region || "—");
}
function _cnReadLocalClaims() {
  try {
    return JSON.parse(localStorage.getItem(CN_CLAIM_LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}
function _cnWriteLocalClaims(list) {
  try {
    localStorage.setItem(CN_CLAIM_LOCAL_KEY, JSON.stringify(list));
  } catch (e) {}
}
function _cnEmitClaims() {
  try {
    window.dispatchEvent(new CustomEvent("cn-cluster-claims-changed"));
  } catch (e) {}
}
function claimIdleDays(claim) {
  var t = claim && (claim.last_activity_at || claim.created_at);
  if (!t) return 0;
  var d = new Date(t);
  if (isNaN(d)) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
var claimIsStale = c => claimIdleDays(c) >= CLAIM_STALE_DAYS;
var claimIsWarning = c => {
  var d = claimIdleDays(c);
  return d >= CLAIM_WARN_DAYS && d < CLAIM_STALE_DAYS;
};
async function cnRefreshClaims() {
  var remote = window.cnPartnerSync ? await window.cnPartnerSync.loadClusterClaimsRemote() : null;
  var list = remote || _cnReadLocalClaims();
  var stale = list.filter(claimIsStale);
  if (stale.length) {
    for (var c of stale) {
      if (remote && window.cnPartnerSync) await window.cnPartnerSync.releaseClusterRemote(c.id);
    }
    if (!remote) _cnWriteLocalClaims(_cnReadLocalClaims().filter(c => !claimIsStale(c)));
    _cnClaims = list.filter(c => !claimIsStale(c));
    window.cnToast && window.cnToast({
      title: `${stale.length} cluster${stale.length > 1 ? "s" : ""} released`,
      sub: `No activity in ${CLAIM_STALE_DAYS} days — back in the pool.`
    });
  } else {
    _cnClaims = list;
  }
  _cnClaimsLoaded = true;
  _cnEmitClaims();
  return _cnClaims;
}
function cnClaimFor(key) {
  return _cnClaims.find(c => c.cluster_key === key && !c.released_at) || null;
}
async function cnClaimCluster({
  partner,
  region,
  note,
  oppId,
  buyer,
  currentUser,
  email
}) {
  var key = cnClusterKey(partner.id, region);
  if (cnClaimFor(key)) return {
    ok: false,
    error: "Already claimed."
  };
  var res = window.cnPartnerSync ? await window.cnPartnerSync.claimClusterRemote({
    clusterKey: key,
    partnerId: partner.id,
    partnerName: partner.org || partner.name,
    cluster: region,
    note,
    oppId,
    buyer,
    user: currentUser,
    email
  }) : {
    ok: false,
    skipped: true
  };
  if (!res.ok && !res.skipped) return res;
  if (res.skipped) {
    var list = _cnReadLocalClaims().concat([{
      id: "cl-" + Math.random().toString(36).slice(2, 9),
      cluster_key: key,
      partner_id: partner.id,
      partner_name: partner.org || partner.name,
      cluster: region,
      company: window.CN_BRAND && window.CN_BRAND.company || "Chief Negotiators",
      claimed_by: email || null,
      claimed_by_name: currentUser && (currentUser.fullName || currentUser.name) || null,
      note: note || null,
      opp_id: oppId || null,
      buyer: buyer || null,
      released_at: null,
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString()
    }]);
    _cnWriteLocalClaims(list);
  }
  await cnRefreshClaims();
  return {
    ok: true,
    local: !!res.skipped
  };
}
async function cnReleaseCluster(claim) {
  var res = window.cnPartnerSync ? await window.cnPartnerSync.releaseClusterRemote(claim.id) : {
    skipped: true
  };
  if (res.skipped) _cnWriteLocalClaims(_cnReadLocalClaims().filter(c => c.id !== claim.id));
  await cnRefreshClaims();
  return {
    ok: true
  };
}
async function cnCreateClusterOpp({
  partner,
  region,
  lines,
  buyerName,
  accounts,
  currentUser
}) {
  if (!window.insertOpportunity) return {
    ok: false,
    error: "Deal creation needs the hosted CRM."
  };
  var headline = lines.slice().sort((a, b) => window.cnEcon.tcv(b) - window.cnEcon.tcv(a))[0] || lines[0] || {};
  var s = window.cnEcon.summary(headline);
  var name = (buyerName || "").trim();
  if (!name) return {
    ok: false,
    error: "Name the off-taker."
  };
  try {
    var acct = (accounts || []).find(a => (a.name || "").toLowerCase() === name.toLowerCase());
    if (!acct) acct = await window.insertAccount({
      name,
      industry: "",
      hq: region || ""
    });
    var qty = window.cnCapQtyLine(headline);
    var terms = window.cnCapTermsLine(headline);
    var title = [partner.org || partner.name, headline.resource, region].filter(Boolean).join(" — ");
    var opp = await window.insertOpportunity({
      title,
      account_id: acct.id,
      owner_id: currentUser?.id || null,
      product: headline.resource || "",
      value_cents: Math.round(s.tcv * 100) || 0,
      stage: "intro_partner",
      notes: [`Supply: ${partner.org || partner.name}${partner.email ? " (" + partner.email + ")" : ""}`, `Cluster: ${region}${qty ? " — " + qty : ""}`, terms && `Terms: ${terms}`, s.tcv && `TCV: ${window.cnEcon.usd(s.tcv)} over ${s.years}Y`, s.deposit && `Down payment: ${window.cnEcon.usd(s.deposit)} (${s.downPct}%)`, s.annual && `Annualized: ${window.cnEcon.usd(s.annual)}`].filter(Boolean).join("\n")
    });
    return {
      ok: true,
      opp,
      account: acct,
      summary: s,
      headline,
      local: !!(opp && (opp._local || String(opp.id).startsWith("opp-local-")))
    };
  } catch (e) {
    return {
      ok: false,
      error: String(e.message || e)
    };
  }
}
function cnClusterEmail({
  partner,
  region,
  lines
}) {
  var brand = window.CN_BRAND && window.CN_BRAND.name || "The Chief Negotiators";
  var live = (lines || []).filter(l => window.cnPaNum ? window.cnPaNum(l.available) > 0 || window.cnEcon.gpuCount(l) > 0 : true);
  var use = live.length ? live : lines || [];
  var headline = use[0] || {};
  var resources = use.map(l => l.resource).filter(Boolean);
  var subjResource = resources.length === 1 ? resources[0] : resources[0] ? resources[0] + " + more" : "GPU capacity";
  var bullet = l => {
    var qty = window.cnCapQtyLine(l);
    var terms = window.cnCapTermsLine(l);
    return `· ${[l.resource, qty, terms].filter(Boolean).join(" — ")}`;
  };
  var subject = `${region} — ${subjResource} available now`;
  var body = [`Hi {{first_name}},`, ``, `If you're still sourcing ${headline.resource || "[resource]"}, I have live capacity in ${region} right now:`, ``, use.map(bullet).join("\n"), ``, `This is an authorized supplier holding real allocation — not a broker re-quoting supply they don't have. We sit on your side of the deal and negotiate your pricing and terms, and it costs you nothing.`, ``, `Want the full spec and pricing on this cluster?`, ``, `{{sender_name}}`, brand, `[phone]  |  [email]`].join("\n");
  return {
    subject,
    body
  };
}
function cnPartnerNoticeEmail({
  partner,
  region,
  lines,
  buyerName
}) {
  var brand = window.CN_BRAND && window.CN_BRAND.name || "The Chief Negotiators";
  var headline = (lines || [])[0] || {};
  var first = (partner.name || "").split(" ")[0] || "there";
  return {
    subject: `Off-taker for your ${region} cluster`,
    body: [`Hi ${first},`, ``, `I have an off-taker for the ${[headline.resource, region].filter(Boolean).join(" ")} capacity${buyerName ? "" : ""} — qualified, funded, and ready to move on the terms you quoted.`, ``, `NCNDA is in place. Send me the current spec sheet and I'll get their commitment in writing.`, ``, `{{sender_name}}`, brand].join("\n")
  };
}
Object.assign(window, {
  cnClusters: {
    key: cnClusterKey,
    refresh: cnRefreshClaims,
    claimFor: cnClaimFor,
    claim: cnClaimCluster,
    release: cnReleaseCluster,
    createOpp: cnCreateClusterOpp,
    email: cnClusterEmail,
    partnerNotice: cnPartnerNoticeEmail,
    idleDays: claimIdleDays,
    isStale: claimIsStale,
    isWarning: claimIsWarning,
    staleDays: CLAIM_STALE_DAYS,
    warnDays: CLAIM_WARN_DAYS,
    loaded: () => _cnClaimsLoaded,
    all: () => _cnClaims
  }
});