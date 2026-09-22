(function () {
  var css = `
.cn-dupe-warn{border:1px solid var(--cn-warn);background:color-mix(in oklab,var(--cn-warn) 8%,transparent);border-radius:var(--cn-r);padding:11px 13px;display:flex;flex-direction:column;gap:8px;margin-top:4px}
.cn-dupe-warn--block{border-color:var(--cn-neg);background:color-mix(in oklab,var(--cn-neg) 7%,transparent)}
.cn-dupe-warn-head{display:flex;align-items:baseline;gap:8px;font-size:12.5px;font-weight:600;color:var(--cn-ink)}
.cn-dupe-warn-head span{font-weight:400;color:var(--cn-mute);font-size:11.5px}
.cn-dupe-hit{display:flex;align-items:center;gap:10px;padding:7px 9px;background:var(--cn-card);border:1px solid var(--cn-line);border-radius:6px}
.cn-dupe-hit-text{min-width:0;flex:1}
.cn-dupe-hit-name{font-size:13px;font-weight:500;color:var(--cn-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cn-dupe-hit-why{font-size:11px;color:var(--cn-mute)}
.cn-dupe-hit-acts{display:flex;gap:6px;flex:none}
.cn-dupe-mini{font:inherit;font-size:11.5px;padding:3px 9px;border-radius:5px;border:1px solid var(--cn-line);background:var(--cn-paper-2);color:var(--cn-ink-2,var(--cn-ink));cursor:pointer;white-space:nowrap}
.cn-dupe-mini:hover{border-color:var(--cn-copper);color:var(--cn-copper-deep)}
.cn-dupe-mini--go{background:var(--cn-copper);border-color:var(--cn-copper);color:#fff}
.cn-dupe-mini--go:hover{background:var(--cn-copper-deep);color:#fff}

.cn-dupe-bar{display:flex;align-items:center;gap:12px;padding:10px 14px;margin-bottom:14px;border:1px solid var(--cn-copper-soft);background:var(--cn-copper-wash);border-radius:var(--cn-r-lg);font-size:12.5px}
.cn-dupe-bar-i{width:22px;height:22px;display:grid;place-items:center;border-radius:6px;background:var(--cn-copper);color:#fff;font-size:12px;flex:none}
.cn-dupe-bar-text{flex:1;min-width:0;color:var(--cn-ink-2,var(--cn-ink))}
.cn-dupe-bar-text b{color:var(--cn-ink)}
.cn-dupe-list{display:flex;flex-direction:column;gap:7px;margin-bottom:14px}
.cn-dupe-cluster{display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--cn-line);border-radius:var(--cn-r);background:var(--cn-card);font-size:12.5px}
.cn-dupe-cluster-names{flex:1;min-width:0}
.cn-dupe-cluster-names b{font-weight:500}
.cn-dupe-cluster-why{font-size:11px;color:var(--cn-mute);margin-top:2px}
`;
  if (!document.getElementById("cn-merge-css")) {
    var s = document.createElement("style");
    s.id = "cn-merge-css";
    s.textContent = css;
    document.head.appendChild(s);
  }
})();
var CN_LEGAL_SUFFIX = /\b(inc|incorporated|llc|l\.l\.c|llp|ltd|limited|corp|corporation|co|company|plc|gmbh|ag|sa|s\.a|nv|bv|oy|ab|as|pty|holdings|group|technologies|technology|tech|labs|solutions|systems|services|international|intl)\b/g;
function cnAcctNorm(name) {
  return String(name || "").toLowerCase().replace(/&/g, " and ").replace(/[.,'"’`()\[\]\/\\|+*]/g, " ").replace(/[-_]/g, " ").replace(/\bthe\b/g, " ").replace(CN_LEGAL_SUFFIX, " ").replace(/\s+/g, " ").trim();
}
function cnAcctDomain(website) {
  var w = String(website || "").trim().toLowerCase();
  if (!w) return "";
  return w.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[\/?#]/)[0].trim();
}
function cnAcctSim(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  var ta = new Set(a.split(" ").filter(Boolean));
  var tb = new Set(b.split(" ").filter(Boolean));
  var inter = 0;
  ta.forEach(t => {
    if (tb.has(t)) inter++;
  });
  var jac = inter / (ta.size + tb.size - inter);
  var ca = a.replace(/ /g, ""),
    cb = b.replace(/ /g, "");
  var dist = 0;
  if (Math.abs(ca.length - cb.length) <= 3 && ca.length < 40) {
    var prev = Array.from({
      length: cb.length + 1
    }, (_, i) => i);
    for (var i = 1; i <= ca.length; i++) {
      var last = prev[0];
      prev[0] = i;
      for (var j = 1; j <= cb.length; j++) {
        var cur = prev[j];
        prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (ca[i - 1] === cb[j - 1] ? 0 : 1));
        last = cur;
      }
    }
    dist = prev[cb.length];
  } else dist = 99;
  var ed = 1 - dist / Math.max(ca.length, cb.length, 1);
  return Math.max(jac, ed);
}
function cnFindAcctDupes(name, website, accounts, excludeId) {
  var n = cnAcctNorm(name);
  var d = cnAcctDomain(website);
  if (!n && !d) return [];
  var out = [];
  (accounts || []).forEach(a => {
    if (!a || a.id === excludeId) return;
    var an = cnAcctNorm(a.name);
    var ad = cnAcctDomain(a.website);
    if (d && ad && d === ad) {
      out.push({
        account: a,
        why: `Same website · ${ad}`,
        strength: "strong",
        score: 1
      });
      return;
    }
    if (!n || !an) return;
    if (an === n) {
      var exact = String(a.name || "").trim().toLowerCase() === String(name || "").trim().toLowerCase();
      out.push({
        account: a,
        why: exact ? "Already in the CRM under this exact name" : `Same name as “${a.name}” once Inc/LLC and punctuation are ignored`,
        strength: "exact",
        score: 1
      });
      return;
    }
    var sim = cnAcctSim(n, an);
    if (sim >= 0.82) out.push({
      account: a,
      why: `Very close to “${a.name}”`,
      strength: "strong",
      score: sim
    });else if (sim >= 0.62) out.push({
      account: a,
      why: `Looks similar to “${a.name}”`,
      strength: "likely",
      score: sim
    });
  });
  var rank = {
    exact: 0,
    strong: 1,
    likely: 2
  };
  return out.sort((x, y) => rank[x.strength] - rank[y.strength] || y.score - x.score).slice(0, 4);
}
function cnAcctForeign(a) {
  if (!a) return false;
  if (window.CN_CROSS && window.CN_CROSS.accountIsForeign) return !!window.CN_CROSS.accountIsForeign(a);
  var mine = window.CN_BRAND && window.CN_BRAND.company || "Chief Negotiators";
  return (a.company || mine) !== mine;
}
function cnIsSuper() {
  return !!(window.CN_CROSS && window.CN_CROSS.isSuperAdmin && window.CN_CROSS.isSuperAdmin());
}
function cnMergeContacts(scenario) {
  if (cnIsSuper() && scenario && scenario.allContacts) return scenario.allContacts;
  return scenario && scenario.contacts || [];
}
function cnMergeOpps(scenario) {
  if (cnIsSuper() && scenario && scenario.allOpps) return scenario.allOpps;
  return scenario && scenario.opps || [];
}
function cnAcctDupeClusters(accounts) {
  var list = (accounts || []).filter(a => a && a.name);
  var pairs = [];
  for (var i = 0; i < list.length; i++) {
    for (var j = i + 1; j < list.length; j++) {
      var a = list[i],
        b = list[j];
      var da = cnAcctDomain(a.website),
        db = cnAcctDomain(b.website);
      var na = cnAcctNorm(a.name),
        nb = cnAcctNorm(b.name);
      var why = null,
        strength = null;
      if (da && db && da === db) {
        why = `Same website · ${da}`;
        strength = "strong";
      } else if (na && na === nb) {
        why = "Same name";
        strength = "exact";
      } else {
        var sim = cnAcctSim(na, nb);
        if (sim >= 0.82) {
          why = "Nearly identical names";
          strength = "strong";
        }
      }
      if (why) pairs.push({
        a,
        b,
        why,
        strength,
        mine: cnIsSuper() || !cnAcctForeign(a) && !cnAcctForeign(b)
      });
    }
  }
  return pairs;
}
Object.assign(window, {
  cnAcctNorm,
  cnAcctDomain,
  cnFindAcctDupes,
  cnAcctDupeClusters,
  cnAcctForeign,
  cnIsSuper
});
function AccountDupeWarning({
  name,
  website,
  accounts,
  excludeId,
  onOpen,
  onMerge,
  onRequest
}) {
  var hits = React.useMemo(() => cnFindAcctDupes(name, website, accounts, excludeId), [name, website, accounts, excludeId]);
  if (!hits.length) return null;
  var blocking = hits.some(h => h.strength === "exact" || h.strength === "strong");
  var foreign = a => window.CN_CROSS && window.CN_CROSS.accountIsForeign(a);
  return React.createElement("div", {
    className: `cn-dupe-warn ${blocking ? "cn-dupe-warn--block" : ""}`
  }, React.createElement("div", {
    className: "cn-dupe-warn-head"
  }, blocking ? "This company is already in the CRM" : "Possible duplicate", React.createElement("span", null, blocking ? "Open it or merge instead of adding a second record." : "Check before you add a second record.")), hits.map(h => React.createElement("div", {
    className: "cn-dupe-hit",
    key: h.account.id
  }, React.createElement("div", {
    className: "cn-dupe-hit-text"
  }, React.createElement("div", {
    className: "cn-dupe-hit-name"
  }, h.account.name, foreign(h.account) && window.BrandChip && React.createElement(window.BrandChip, {
    company: h.account.company
  })), React.createElement("div", {
    className: "cn-dupe-hit-why"
  }, h.why)), React.createElement("div", {
    className: "cn-dupe-hit-acts"
  }, foreign(h.account) && !cnIsSuper() ? React.createElement("button", {
    className: "cn-dupe-mini cn-dupe-mini--go",
    onClick: () => onRequest && onRequest(h.account)
  }, "Open to request") : React.createElement(React.Fragment, null, onMerge && React.createElement("button", {
    className: "cn-dupe-mini",
    onClick: () => onMerge(h.account)
  }, "Merge\u2026"), React.createElement("button", {
    className: "cn-dupe-mini cn-dupe-mini--go",
    onClick: () => onOpen && onOpen(h.account)
  }, "Open"))))));
}
var CN_ACCT_FIELDS = [{
  key: "name",
  label: "Name",
  col: "name"
}, {
  key: "industry",
  label: "Industry",
  col: "industry"
}, {
  key: "hq",
  label: "HQ",
  col: "hq"
}, {
  key: "size",
  label: "Headcount",
  col: "size"
}, {
  key: "website",
  label: "Website",
  col: "website"
}, {
  key: "ownerId",
  label: "Owner",
  col: "owner_id",
  disp: v => v && window.repOf(v)?.name || "— Unassigned —"
}];
var cnAcctGet = (a, f) => a && a[f.key] || "";
var cnAcctDisp = (a, f) => (f.disp ? f.disp(cnAcctGet(a, f)) : cnAcctGet(a, f)) || "—";
async function cnMergeAccounts({
  primary,
  duplicate,
  choices,
  scenario
}) {
  var moveContacts = cnMergeContacts(scenario).filter(c => c.accountId === duplicate.id);
  var moveOpps = cnMergeOpps(scenario).filter(o => o.accountId === duplicate.id);
  var toCompany = primary.company || null;
  var payload = {};
  CN_ACCT_FIELDS.forEach(f => {
    var src = choices[f.key] === "duplicate" ? duplicate : primary;
    var v = cnAcctGet(src, f) || cnAcctGet(primary, f) || cnAcctGet(duplicate, f);
    if (v !== cnAcctGet(primary, f)) payload[f.col] = v || null;
  });
  if (Object.keys(payload).length) await window.updateAccount(primary.id, payload);
  for (var c of moveContacts) {
    var patch = {
      account_id: primary.id
    };
    if (toCompany && c.company !== toCompany) patch.company = toCompany;
    await window.updateContact(c.id, patch);
  }
  for (var o of moveOpps) {
    var _patch = {
      account_id: primary.id
    };
    if (toCompany && o.company !== toCompany) _patch.company = toCompany;
    await window.updateOpportunity(o.id, _patch);
  }
  await window.deleteAccount(duplicate.id);
  return {
    contacts: moveContacts.length,
    opps: moveOpps.length
  };
}
function MergeAccountsModal({
  open,
  onClose,
  scenario,
  initial,
  onSaved
}) {
  var accounts = scenario?.accounts || [];
  var [primaryId, setPrimaryId] = React.useState("");
  var [dupId, setDupId] = React.useState("");
  var [choices, setChoices] = React.useState({});
  var [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    setPrimaryId(initial?.aId || "");
    setDupId(initial?.bId || "");
    setChoices({});
    setBusy(false);
  }, [open, initial?.aId, initial?.bId]);
  if (!open) return null;
  var primary = accounts.find(a => a.id === primaryId) || null;
  var duplicate = accounts.find(a => a.id === dupId) || null;
  var same = !!primaryId && primaryId === dupId;
  var crossBrand = (primary && cnAcctForeign(primary) || duplicate && cnAcctForeign(duplicate)) && !cnIsSuper();
  var overriding = (primary && cnAcctForeign(primary) || duplicate && cnAcctForeign(duplicate)) && cnIsSuper();
  var pick = k => choices[k] || "primary";
  var movedContacts = duplicate ? cnMergeContacts(scenario).filter(c => c.accountId === duplicate.id).length : 0;
  var movedOpps = duplicate ? cnMergeOpps(scenario).filter(o => o.accountId === duplicate.id).length : 0;
  var acctOpt = a => ({
    value: a.id,
    label: a.name,
    subtext: [a.website, a.hq, window.CN_CROSS && window.CN_CROSS.accountIsForeign(a) ? window.CN_CROSS.companyLabel(a.company) : ""].filter(Boolean).join(" · ")
  });
  var doMerge = async () => {
    if (!primary || !duplicate || same || crossBrand || busy) return;
    if (!confirm(`Merge "${duplicate.name}" into "${primary.name}"?\n\nIts ${movedContacts} contact(s) and ${movedOpps} deal(s) move to the primary, then the emptied duplicate record is deleted. Unlike a merged deal, a deleted account can't be restored.`)) return;
    setBusy(true);
    try {
      var res = await cnMergeAccounts({
        primary,
        duplicate,
        choices,
        scenario
      });
      window.cnToast && window.cnToast({
        title: "Accounts merged",
        sub: `${res.contacts} contact(s) + ${res.opps} deal(s) moved onto ${primary.name}`
      });
      onSaved && onSaved();
      onClose();
    } catch (e) {
      window.cnToast && window.cnToast({
        kind: "error",
        title: "Merge failed",
        sub: String(e.message || e)
      });
    } finally {
      setBusy(false);
    }
  };
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose,
    style: {
      zIndex: 200
    }
  }, React.createElement("div", {
    className: "cn-modal",
    onClick: e => e.stopPropagation(),
    style: {
      width: 680
    }
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Merge accounts"), React.createElement("h2", {
    className: "cn-modal-title"
  }, "Combine two duplicate companies")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12
    }
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Keep (primary)"), React.createElement(window.SearchableSelect, {
    value: primaryId,
    onChange: setPrimaryId,
    options: accounts.map(acctOpt),
    placeholder: "Search accounts\u2026"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Merge in & delete (duplicate)"), React.createElement(window.SearchableSelect, {
    value: dupId,
    onChange: setDupId,
    options: accounts.map(acctOpt),
    placeholder: "Search accounts\u2026"
  }))), same && React.createElement("div", {
    className: "cn-field-help",
    style: {
      color: "var(--cn-neg)"
    }
  }, "Pick two different accounts."), overriding && !same && primary && duplicate && React.createElement("div", {
    className: "cn-dupe-warn",
    style: {
      marginTop: 10
    }
  }, React.createElement("div", {
    className: "cn-dupe-warn-head"
  }, "Owner override", React.createElement("span", null, "Merging across brands. Moved contacts and deals are re-stamped ", window.CN_CROSS ? window.CN_CROSS.companyLabel(primary.company) : primary.company, "."))), crossBrand && !same && React.createElement("div", {
    className: "cn-field-help",
    style: {
      color: "var(--cn-neg)"
    }
  }, (() => {
    var other = [primary, duplicate].filter(a => a && cnAcctForeign(a))[0];
    var label = window.CN_CROSS ? window.CN_CROSS.companyLabel(other?.company) : other?.company;
    return `${label} owns ${primary && duplicate && cnAcctForeign(primary) && cnAcctForeign(duplicate) ? "both of these accounts" : "one of these accounts"}. Request it instead — that brand's contacts aren't visible here, so a merge would delete the duplicate and leave them pointing at nothing.`;
  })()), primary && duplicate && !same && !crossBrand && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginTop: 12,
      marginBottom: 6
    }
  }, "Choose the winning value for each field"), React.createElement("div", {
    className: "cn-merge-grid"
  }, CN_ACCT_FIELDS.map(f => {
    var conflict = cnAcctGet(primary, f) !== cnAcctGet(duplicate, f);
    return React.createElement("div", {
      className: `cn-merge-row ${conflict ? "is-conflict" : ""}`,
      key: f.key
    }, React.createElement("div", {
      className: "cn-merge-field"
    }, f.label), conflict ? React.createElement("div", {
      className: "cn-merge-opts"
    }, React.createElement("button", {
      className: `cn-merge-opt ${pick(f.key) === "primary" ? "is-on" : ""}`,
      onClick: () => setChoices(c => ({
        ...c,
        [f.key]: "primary"
      }))
    }, cnAcctDisp(primary, f)), React.createElement("button", {
      className: `cn-merge-opt ${pick(f.key) === "duplicate" ? "is-on" : ""}`,
      onClick: () => setChoices(c => ({
        ...c,
        [f.key]: "duplicate"
      }))
    }, cnAcctDisp(duplicate, f))) : React.createElement("div", {
      className: "cn-merge-same"
    }, cnAcctDisp(primary, f)));
  })), React.createElement("div", {
    className: "cn-merge-moves"
  }, "Moving onto the primary: ", React.createElement("b", null, movedContacts), " contact", movedContacts === 1 ? "" : "s", " \xB7 ", React.createElement("b", null, movedOpps), " deal", movedOpps === 1 ? "" : "s", ". Nothing is lost \u2014 where the primary is blank it inherits the duplicate's value. The emptied duplicate record is then deleted; unlike a merged deal there's no archived copy to restore, so check both records first."))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose,
    disabled: busy
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: doMerge,
    disabled: !primary || !duplicate || same || crossBrand || busy
  }, busy ? "Merging…" : "Merge accounts →"))));
}
function AccountDupeBar({
  scenario,
  onMerge
}) {
  var [open, setOpen] = React.useState(false);
  var pairs = React.useMemo(() => cnAcctDupeClusters(scenario?.accounts), [scenario?.accounts]);
  var mine = pairs.filter(p => p.mine);
  if (!pairs.length) return null;
  return React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-dupe-bar"
  }, React.createElement("span", {
    className: "cn-dupe-bar-i"
  }, "\u29C9"), React.createElement("span", {
    className: "cn-dupe-bar-text"
  }, React.createElement("b", null, pairs.length, " possible duplicate", pairs.length === 1 ? "" : " pairs"), " in your accounts", mine.length !== pairs.length && ` · ${pairs.length - mine.length} owned by the other brand`), React.createElement("button", {
    className: "cn-dupe-mini",
    onClick: () => setOpen(o => !o)
  }, open ? "Hide" : "Review")), open && React.createElement("div", {
    className: "cn-dupe-list"
  }, pairs.map((p, i) => React.createElement("div", {
    className: "cn-dupe-cluster",
    key: i
  }, React.createElement("div", {
    className: "cn-dupe-cluster-names"
  }, React.createElement("div", null, React.createElement("b", null, p.a.name), " ", React.createElement("span", {
    style: {
      color: "var(--cn-mute-2)"
    }
  }, "\u2194"), " ", React.createElement("b", null, p.b.name)), React.createElement("div", {
    className: "cn-dupe-cluster-why"
  }, p.why, !p.mine ? " · owned by the other brand — request instead of merging" : "")), React.createElement("button", {
    className: "cn-dupe-mini cn-dupe-mini--go",
    disabled: !p.mine,
    onClick: () => onMerge && onMerge({
      aId: p.a.id,
      bId: p.b.id
    })
  }, "Merge\u2026")))));
}
Object.assign(window, {
  AccountDupeWarning,
  MergeAccountsModal,
  AccountDupeBar,
  cnMergeAccounts
});