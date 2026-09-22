function ClusterActions({
  partner,
  region,
  lines,
  currentUser,
  authEmail,
  scenario,
  onEmail,
  onClaimed
}) {
  var [, force] = React.useState(0);
  var [busy, setBusy] = React.useState(false);
  var [modal, setModal] = React.useState(false);
  React.useEffect(() => {
    var h = () => force(x => x + 1);
    window.addEventListener("cn-cluster-claims-changed", h);
    if (!window.cnClusters.loaded()) window.cnClusters.refresh();
    return () => window.removeEventListener("cn-cluster-claims-changed", h);
  }, []);
  var key = window.cnClusters.key(partner.id, region);
  var claim = window.cnClusters.claimFor(key);
  var mine = claim && (authEmail && claim.claimed_by && claim.claimed_by.toLowerCase() === String(authEmail).toLowerCase() || !claim.claimed_by && claim.claimed_by_name === (currentUser?.fullName || currentUser?.name));
  var isSuper = !!(window.CN_CROSS && window.CN_CROSS.isSuperAdmin && window.CN_CROSS.isSuperAdmin());
  var otherBrand = claim && window.CN_CROSS && claim.company && claim.company !== window.CN_CROSS.myCompany();
  var warning = claim && window.cnClusters.isWarning(claim);
  var idle = claim ? window.cnClusters.idleDays(claim) : 0;
  var doRelease = async e => {
    e && e.stopPropagation();
    setBusy(true);
    await window.cnClusters.release(claim);
    setBusy(false);
    window.cnToast && window.cnToast({
      title: `Released ${region}`,
      sub: "Anyone can pick it up now."
    });
  };
  return React.createElement("div", {
    className: "cn-cl-acts",
    onClick: e => e.stopPropagation()
  }, claim ? React.createElement("span", {
    className: `cn-cl-holder ${mine ? "is-mine" : ""} ${warning ? "is-warn" : ""}`,
    title: warning ? `Idle ${idle} days — auto-releases at ${window.cnClusters.staleDays}` : claim.note || ""
  }, React.createElement("span", {
    className: "cn-cl-dot"
  }), mine ? "Yours" : claim.claimed_by_name || claim.claimed_by || "Claimed", warning && React.createElement("span", {
    className: "cn-cl-idle"
  }, window.cnClusters.staleDays - idle, "d"), otherBrand && !mine && window.BrandChip && React.createElement(window.BrandChip, {
    company: claim.company
  })) : React.createElement("button", {
    className: "cn-cl-btn cn-cl-btn--go",
    disabled: busy,
    onClick: e => {
      e.stopPropagation();
      setModal(true);
    }
  }, "Claim"), claim && (mine || isSuper) && React.createElement("button", {
    className: "cn-cl-btn cn-cl-btn--quiet",
    disabled: busy,
    onClick: doRelease
  }, mine ? "Release" : "Force release"), React.createElement("button", {
    className: "cn-cl-btn",
    onClick: e => {
      e.stopPropagation();
      onEmail && onEmail({
        partner,
        region,
        lines
      });
    }
  }, "Email buyer"), modal && React.createElement(ClusterClaimModal, {
    partner: partner,
    region: region,
    lines: lines,
    currentUser: currentUser,
    authEmail: authEmail,
    scenario: scenario,
    onClose: () => setModal(false),
    onDone: onClaimed,
    onEmailPartner: onEmail
  }));
}
function ClusterClaimModal({
  partner,
  region,
  lines,
  currentUser,
  authEmail,
  scenario,
  onClose,
  onDone,
  onEmailPartner
}) {
  var accounts = scenario && scenario.accounts || [];
  var [buyer, setBuyer] = React.useState("");
  var [busy, setBusy] = React.useState(false);
  var [done, setDone] = React.useState(null);
  var headline = lines.slice().sort((a, b) => window.cnEcon.tcv(b) - window.cnEcon.tcv(a))[0] || lines[0] || {};
  var s = window.cnEcon.summary(headline);
  var qty = window.cnCapQtyLine(headline);
  var terms = window.cnCapTermsLine(headline);
  var known = accounts.find(a => (a.name || "").toLowerCase() === buyer.trim().toLowerCase());
  var go = async withDeal => {
    setBusy(true);
    var oppRes = null;
    if (withDeal) {
      oppRes = await window.cnClusters.createOpp({
        partner,
        region,
        lines,
        buyerName: buyer,
        accounts,
        currentUser
      });
      if (!oppRes.ok) {
        setBusy(false);
        return window.cnToast && window.cnToast({
          kind: "error",
          title: "Couldn't create the deal",
          sub: oppRes.error
        });
      }
    }
    var res = await window.cnClusters.claim({
      partner,
      region,
      currentUser,
      email: authEmail,
      oppId: oppRes?.opp?.id || null,
      buyer: withDeal ? buyer.trim() : null
    });
    setBusy(false);
    if (!res.ok) return window.cnToast && window.cnToast({
      kind: "error",
      title: "Couldn't claim",
      sub: res.error
    });
    window.cnToast && window.cnToast({
      kind: oppRes && oppRes.local ? "error" : undefined,
      title: withDeal ? oppRes.local ? "Claimed — but the deal is local-only" : "Cluster claimed · deal opened" : `${region} is yours`,
      sub: withDeal ? oppRes.local ? "Couldn't write to the database — nobody else can see this deal yet." : `${buyer.trim()} — ${window.cnEcon.usd(s.tcv, true)} at Intro to Partner` : res.local ? "Saved in this browser — run migration 14 to share it." : "The team can see you're working it."
    });
    if (withDeal) window.cnReloadCRM && window.cnReloadCRM();
    onDone && onDone();
    setDone({
      withDeal,
      opp: oppRes?.opp || null,
      local: !!oppRes?.local
    });
  };
  if (done) {
    return React.createElement("div", {
      className: "cn-modal-scrim",
      onClick: onClose
    }, React.createElement("div", {
      className: "cn-modal cn-cl-modal",
      onClick: e => e.stopPropagation()
    }, React.createElement("div", {
      className: "cn-modal-head"
    }, React.createElement("h3", null, region, " is yours \u2014 do this next"), React.createElement("button", {
      className: "cn-icon-btn",
      onClick: onClose
    }, "\u2715")), React.createElement("div", {
      className: "cn-modal-body"
    }, React.createElement("ol", {
      className: "cn-cl-next"
    }, React.createElement("li", null, React.createElement("strong", null, "Get the NCNDA signed."), React.createElement("span", null, "Mutual \u2014 it protects their supply relationship and your commission both. Until it's back you can't name the counterparty. Documents \u2192 New counterparty."), React.createElement("button", {
      className: "cn-btn cn-btn--ghost cn-btn--sm",
      onClick: () => {
        window.cnGoto && window.cnGoto("documents");
        onClose();
      }
    }, "Open documents")), React.createElement("li", null, React.createElement("strong", null, "Tell ", partner.name || partner.org, " they have an off-taker."), React.createElement("span", null, "Partners move faster for the broker who brings demand, not questions."), React.createElement("button", {
      className: "cn-btn cn-btn--ghost cn-btn--sm",
      onClick: () => {
        onEmailPartner && onEmailPartner({
          partner,
          region,
          lines,
          notice: true,
          buyerName: done.withDeal ? buyer.trim() : ""
        });
        onClose();
      }
    }, "Draft that email"))), done.opp && React.createElement("div", {
      className: "cn-cl-doneopp"
    }, "Deal opened: ", React.createElement("strong", null, done.opp.title), " \xB7 ", window.cnEcon.usd(s.tcv, true), " \xB7 Intro to Partner", done.local && React.createElement("div", {
      className: "cn-cl-localwarn"
    }, "Saved in this browser only \u2014 the database rejected the write, so your team can't see it yet."))), React.createElement("div", {
      className: "cn-modal-foot"
    }, React.createElement("button", {
      className: "cn-btn cn-btn--primary",
      onClick: onClose
    }, "Done"))));
  }
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose
  }, React.createElement("div", {
    className: "cn-modal cn-cl-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "cn-modal-head"
  }, React.createElement("h3", null, "Claim ", region), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body cn-in-form"
  }, React.createElement("div", {
    className: "cn-cl-sum"
  }, React.createElement("div", {
    className: "cn-cl-sum-h"
  }, partner.org || partner.name, headline.resource ? " · " + headline.resource : ""), qty && React.createElement("div", {
    className: "cn-cl-sum-qty"
  }, qty), terms && React.createElement("div", {
    className: "cn-cl-sum-terms"
  }, terms), s.tcv > 0 && React.createElement("div", {
    className: "cn-cl-econ"
  }, React.createElement("div", null, React.createElement("span", null, "TCV"), React.createElement("strong", null, window.cnEcon.usd(s.tcv))), React.createElement("div", null, React.createElement("span", null, "Annualized"), React.createElement("strong", null, window.cnEcon.usd(s.annual))), s.deposit > 0 && React.createElement("div", null, React.createElement("span", null, "Down payment (", s.downPct, "%)"), React.createElement("strong", null, window.cnEcon.usd(s.deposit)))), s.tcv > 0 && React.createElement("div", {
    className: "cn-cl-math"
  }, "$", s.rate, " \xD7 ", s.gpus.toLocaleString(), " GPUs \xD7 24h \xD7 365d \xD7 ", s.years, "Y")), React.createElement("label", null, "Who's the off-taker?"), React.createElement("input", {
    className: "cn-input",
    value: buyer,
    autoFocus: true,
    onChange: e => setBuyer(e.target.value),
    placeholder: "Buyer company name",
    list: "cn-cl-accts",
    onKeyDown: e => {
      if (e.key === "Enter" && buyer.trim()) go(true);
    }
  }), React.createElement("datalist", {
    id: "cn-cl-accts"
  }, accounts.map(a => React.createElement("option", {
    key: a.id,
    value: a.name
  }))), React.createElement("div", {
    className: "cn-cl-hint"
  }, buyer.trim() ? known ? `Existing account — the deal attaches to it.` : `New account — I'll create "${buyer.trim()}" and attach the deal.` : `Claim without a buyer if you're still sourcing one.`), s.tcv > 0 && buyer.trim() && React.createElement("div", {
    className: "cn-cl-will"
  }, "Opens a deal at ", React.createElement("strong", null, window.cnEcon.usd(s.tcv, true)), " in ", React.createElement("strong", null, "Intro to Partner"), ", pre-filled with the product, quantity, rate, term and down payment.")), React.createElement("div", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    disabled: busy,
    onClick: () => go(false)
  }, "Claim only"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    disabled: busy || !buyer.trim(),
    onClick: () => go(true)
  }, busy ? "Working…" : "Claim & open deal"))));
}
Object.assign(window, {
  ClusterActions,
  ClusterClaimModal
});