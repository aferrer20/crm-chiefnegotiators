function BrandChip({
  company,
  title
}) {
  if (!window.CN_CROSS) return null;
  var mine = company === window.CN_CROSS.myCompany();
  return React.createElement("span", {
    className: `cn-brandchip ${mine ? "is-mine" : "is-other"}`,
    title: title || window.CN_CROSS.companyLabel(company)
  }, window.CN_CROSS.companyShort(company));
}
function ForeignAccountBanner({
  account,
  currentUser,
  onChanged
}) {
  var [claims, setClaims] = React.useState([]);
  var [asking, setAsking] = React.useState(false);
  var [reason, setReason] = React.useState("");
  var [busy, setBusy] = React.useState(false);
  var [msg, setMsg] = React.useState(null);
  var isAdmin = window.CN_CROSS && window.CN_CROSS.isCrossBrandAdmin(currentUser);
  var load = () => {
    if (!window.cnClaims) return;
    window.cnClaims.pull().then(rows => {
      if (rows) setClaims(rows.filter(r => r.account_id === account.id));
    }).catch(() => {});
  };
  React.useEffect(load, [account.id]);
  var pending = claims.find(c => c.status === "pending");
  var owner = account.ownerId && window.repOf(account.ownerId);
  var submit = async () => {
    setBusy(true);
    var res = await window.cnClaims.request({
      accountId: account.id,
      accountName: account.name,
      fromCompany: account.company,
      reason,
      user: currentUser
    });
    setBusy(false);
    if (!res.ok) {
      setMsg({
        bad: true,
        text: res.error || "Couldn't file the request."
      });
      return;
    }
    setAsking(false);
    setReason("");
    setMsg({
      text: "Request filed. A founder gets the call."
    });
    load();
  };
  var decide = async approve => {
    setBusy(true);
    var res = await window.cnClaims.decide(pending, approve, currentUser);
    setBusy(false);
    if (!res.ok) {
      setMsg({
        bad: true,
        text: res.error
      });
      return;
    }
    setMsg({
      text: approve ? "Approved — the account moved." : "Declined."
    });
    load();
    if (approve && onChanged) onChanged();
  };
  return React.createElement("div", {
    className: "cn-xb-banner"
  }, React.createElement("div", {
    className: "cn-xb-banner-main"
  }, React.createElement("div", {
    className: "cn-xb-banner-top"
  }, React.createElement("span", {
    className: "cn-xb-lock"
  }, "\u25CD"), React.createElement("strong", null, window.CN_CROSS.companyLabel(account.company), " owns this account")), React.createElement("div", {
    className: "cn-xb-banner-sub"
  }, owner ? React.createElement(React.Fragment, null, owner.name, " is the rep. ") : null, "You can read everything here, but quoting, contacts, and deals stay on their side. If it should move, ask \u2014 nothing changes without a founder's sign-off.")), pending ? React.createElement("div", {
    className: "cn-xb-pending"
  }, React.createElement("div", {
    className: "cn-xb-pending-t"
  }, "Claim pending \xB7 ", window.CN_CROSS.companyShort(pending.to_company), " requested by ", pending.requested_by_name || pending.requested_by || "someone"), pending.reason && React.createElement("div", {
    className: "cn-xb-pending-r"
  }, "\"", pending.reason, "\""), isAdmin && React.createElement("div", {
    className: "cn-xb-pending-acts"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 30
    },
    disabled: busy,
    onClick: () => decide(false)
  }, "Decline"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      height: 30
    },
    disabled: busy,
    onClick: () => decide(true)
  }, "Approve the move"))) : asking ? React.createElement("div", {
    className: "cn-xb-ask"
  }, React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 64
    },
    placeholder: "Why should this move? e.g. inbound RFQ came to us directly, their rep has no open deal.",
    value: reason,
    onChange: e => setReason(e.target.value)
  }), React.createElement("div", {
    className: "cn-xb-ask-acts"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 30
    },
    onClick: () => setAsking(false)
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      height: 30
    },
    disabled: busy,
    onClick: submit
  }, "File the request"))) : React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setAsking(true)
  }, "Request this account"), msg && React.createElement("div", {
    className: `cn-xb-msg ${msg.bad ? "is-bad" : ""}`
  }, msg.text));
}
function ClaimQueue({
  currentUser,
  onChanged
}) {
  var [claims, setClaims] = React.useState([]);
  var [busy, setBusy] = React.useState(null);
  var load = () => {
    if (!window.cnClaims) return;
    window.cnClaims.pull().then(rows => {
      if (rows) setClaims(rows.filter(r => r.status === "pending"));
    }).catch(() => {});
  };
  React.useEffect(load, []);
  if (!window.CN_CROSS || !window.CN_CROSS.isCrossBrandAdmin(currentUser) || !claims.length) return null;
  var decide = async (claim, approve) => {
    setBusy(claim.id);
    var res = await window.cnClaims.decide(claim, approve, currentUser);
    setBusy(null);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    load();
    if (approve && onChanged) onChanged();
  };
  return React.createElement("section", {
    className: "cn-claimq"
  }, React.createElement("div", {
    className: "cn-claimq-head"
  }, React.createElement("span", {
    className: "cn-card-eyebrow"
  }, "Waiting on you"), React.createElement("span", {
    className: "cn-claimq-n"
  }, claims.length, " account ", claims.length === 1 ? "claim" : "claims")), claims.map(c => React.createElement("div", {
    key: c.id,
    className: "cn-claimq-row"
  }, React.createElement("div", {
    className: "cn-claimq-main"
  }, React.createElement("div", {
    className: "cn-claimq-acct"
  }, c.account_name || "Account"), React.createElement("div", {
    className: "cn-claimq-move"
  }, window.CN_CROSS.companyShort(c.from_company), " \u2192 ", window.CN_CROSS.companyShort(c.to_company), c.requested_by_name ? ` · ${c.requested_by_name}` : ""), c.reason && React.createElement("div", {
    className: "cn-claimq-reason"
  }, "\"", c.reason, "\"")), React.createElement("div", {
    className: "cn-claimq-acts"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 28,
      fontSize: 12
    },
    disabled: busy === c.id,
    onClick: () => decide(c, false)
  }, "Decline"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      height: 28,
      fontSize: 12
    },
    disabled: busy === c.id,
    onClick: () => decide(c, true)
  }, "Approve")))));
}
Object.assign(window, {
  BrandChip,
  ForeignAccountBanner,
  ClaimQueue
});