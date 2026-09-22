var QK = oppId => `cn-quotes-${oppId}`;
var TOKEN_INDEX = "cn-quote-token-index";
function readQuotes(oppId) {
  try {
    return JSON.parse(localStorage.getItem(QK(oppId)) || "[]");
  } catch {
    return [];
  }
}
function writeQuotes(oppId, list) {
  localStorage.setItem(QK(oppId), JSON.stringify(list));
  ensureGpuTracks(oppId, list);
  try {
    var idx = JSON.parse(localStorage.getItem(TOKEN_INDEX) || "{}");
    list.forEach(q => {
      idx[q.shareToken] = {
        oppId,
        quoteId: q.id
      };
    });
    localStorage.setItem(TOKEN_INDEX, JSON.stringify(idx));
  } catch {}
  if (window.publishSharedDoc) {
    for (var q of list) {
      if (q.shareToken) window.publishSharedDoc({
        kind: "quote",
        doc: {
          ...q,
          oppId
        }
      });
    }
  }
  try {
    if (window.upsertCatalogItem) {
      var seen = new Set();
      for (var _q of list) {
        for (var li of _q.lineItems || []) {
          var pn = (li.partNumber || "").trim();
          if (!pn || seen.has(pn)) continue;
          seen.add(pn);
          window.upsertCatalogItem(pn, {
            description: li.description || null,
            last_condition: li.condition || null,
            last_unit_price_cents: li.unitPrice ? Math.round(parseFloat(li.unitPrice) * 100) : null,
            last_used_by: _q.preparedBy || null
          });
        }
      }
    }
  } catch (e) {}
}
// A GPUaaS quote that has gone out is already at "Quoted": open its delivery
// track so the deal shows where it stands before the client responds.
function ensureGpuTracks(oppId, list) {
  if (!window.cnGpuTrack || !window.cnGpuQuotes || !window.cnCurrentUser) return;
  for (var q of list || []) {
    if (q && q.sentAt && window.cnGpuQuotes.isGpu(q)) {
      window.cnGpuTrack.ensure(oppId, { quoteId: q.id, quoteNumber: q.quoteNumber });
      break;
    }
  }
}
function lookupByToken(token) {
  try {
    var idx = JSON.parse(localStorage.getItem(TOKEN_INDEX) || "{}");
    var hit = idx[token];
    if (!hit) return null;
    var quotes = readQuotes(hit.oppId);
    var quote = quotes.find(q => q.id === hit.quoteId);
    return quote ? {
      ...hit,
      quote
    } : null;
  } catch {
    return null;
  }
}
window.cnQuotes = {
  readQuotes,
  writeQuotes,
  lookupByToken
};
var newId = p => p + "-" + Math.random().toString(36).slice(2, 10);
var CONDITIONS = ["New", "New Surplus", "Factory Refurbished", "Used", "Repaired", "As-Is"];
function newLine() {
  return {
    id: newId("li"),
    partNumber: "",
    description: "",
    qty: 1,
    condition: "New",
    unitPrice: 0
  };
}
var QUOTE_VALID_DAYS = 90;
function newQuote(opp, account, contact, prevVersion) {
  var today = new Date();
  var expires = new Date(today.getTime() + QUOTE_VALID_DAYS * 86400000);
  var num = "Q-" + today.getFullYear() + "-" + String(Math.floor(Math.random() * 9000) + 1000);
  return {
    id: newId("q"),
    version: (prevVersion || 0) + 1,
    quoteNumber: num,
    issueDate: window.cnDay(today),
    expiresDate: window.cnDay(expires),
    billToName: account?.name || "",
    billToAddress: account?.hq || "",
    attentionName: contact?.name || "",
    attentionEmail: contact?.email || "",
    preparedBy: opp.ownerId,
    reference: opp.title || "",
    lineItems: [newLine()],
    notes: "",
    terms: "Payment Net 30. Prices in USD. Quote valid 90 days from issue date. FOB Origin unless otherwise stated.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sentAt: null,
    viewedAt: null,
    viewCount: 0,
    shareToken: "qt-" + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 8),
    status: "draft"
  };
}
function lineTotal(li) {
  return (parseFloat(li.qty) || 0) * (parseFloat(li.unitPrice) || 0);
}
function quoteTotal(q) {
  // A GPUaaS quote carries no line items: value is rate x fleet x 24 x 365 x term.
  if (window.cnGpuQuotes && window.cnGpuQuotes.isGpu(q)) return window.cnGpuQuotes.tcv(q);
  return (q.lineItems || []).reduce((s, li) => s + lineTotal(li), 0);
}
function daysUntilDate(dateStr) {
  if (!dateStr) return null;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / 86400000);
}
function quoteIsExpired(q) {
  if (!q || !q.expiresDate) return false;
  if (["accepted", "declined", "superseded", "draft"].includes(q.status)) return false;
  var du = daysUntilDate(q.expiresDate);
  return du !== null && du < 0;
}
function quoteIsExpiringSoon(q, within = 7) {
  if (!q || !q.expiresDate) return false;
  if (["accepted", "declined", "superseded", "draft"].includes(q.status)) return false;
  var du = daysUntilDate(q.expiresDate);
  return du !== null && du >= 0 && du <= within;
}
window.cnQuoteIsExpired = quoteIsExpired;
window.cnQuoteIsExpiringSoon = quoteIsExpiringSoon;
window.cnDaysUntilDate = daysUntilDate;
function timeAgo(iso) {
  if (!iso) return "";
  var ms = Date.now() - new Date(iso).getTime();
  var m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  var h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  var d = Math.floor(h / 24);
  return d + "d ago";
}
function fmtCurrency(n) {
  return "$" + (Math.round((n || 0) * 100) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
function QuoteStatus({
  quote
}) {
  var labels = {
    draft: ["Draft", "cn-q-draft"],
    sent: ["Sent", "cn-q-sent"],
    viewed: ["Viewed", "cn-q-viewed"],
    accepted: ["Accepted", "cn-q-accepted"],
    declined: ["Declined", "cn-q-declined"],
    superseded: ["Superseded", "cn-q-superseded"],
    expired: ["Expired", "cn-q-expired"]
  };
  var status = quoteIsExpired(quote) ? "expired" : quote.status || "draft";
  var [label, cls] = labels[status] || labels.draft;
  return React.createElement("span", {
    className: `cn-q-pill ${cls}`
  }, label);
}
function QuotesSection({
  opp,
  account,
  contact,
  onValueUpdated
}) {
  var [versions, setVersions] = useState(() => readQuotes(opp.id));
  var [builderId, setBuilderId] = useState(null);
  var [shareId, setShareId] = useState(null);
  var [reopenId, setReopenId] = useState(null);
  var [mergeOpen, setMergeOpen] = useState(false);
  var refresh = () => setVersions(readQuotes(opp.id));
  useEffect(() => {
    var cancelled = false;
    (async () => {
      if (!window.loadCompanyDocs || !window.mergeDocLists) return;
      var server = await window.loadCompanyDocs("quote");
      if (cancelled || !server) return;
      var mine = server.filter(d => d.oppId === opp.id);
      if (mine.length === 0) return;
      var {
        merged,
        changed
      } = window.mergeDocLists(readQuotes(opp.id), mine);
      if (changed > 0) {
        writeQuotes(opp.id, merged.map(({
          oppId,
          ...q
        }) => q));
        if (!cancelled) setVersions(readQuotes(opp.id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opp.id]);
  var createVersion = (basedOnId, kind) => {
    var list = readQuotes(opp.id);
    var last = list[0];
    var q;
    if (basedOnId) {
      var src = list.find(x => x.id === basedOnId) || last;
      q = {
        ...src,
        id: newId("q"),
        version: (list[0]?.version || 0) + 1,
        lineItems: src.lineItems.map(li => ({
          ...li,
          id: newId("li")
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sentAt: null,
        viewedAt: null,
        viewCount: 0,
        shareToken: "qt-" + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 8),
        status: "draft"
      };
    } else {
      q = newQuote(opp, account, contact, list[0]?.version || 0);
      if (kind === "gpuaas" && window.cnGpuQuotes) q = window.cnGpuQuotes.makeGpu(q);
    }
    var next = [q, ...list.map(v => ["sent", "viewed"].includes(v.status) || quoteIsExpired(v) ? {
      ...v,
      status: "superseded",
      supersededBy: q.id,
      supersededAt: new Date().toISOString()
    } : v)];
    writeQuotes(opp.id, next);
    setVersions(next);
    setBuilderId(q.id);
  };
  var updateQuote = (id, patch) => {
    var list = readQuotes(opp.id);
    var next = list.map(q => q.id === id ? {
      ...q,
      ...patch,
      updatedAt: new Date().toISOString()
    } : q);
    writeQuotes(opp.id, next);
    setVersions(next);
  };
  var deleteQuote = id => {
    if (!confirm("Delete this quote version? This cannot be undone.")) return;
    var next = readQuotes(opp.id).filter(q => q.id !== id);
    writeQuotes(opp.id, next);
    setVersions(next);
    if (builderId === id) setBuilderId(null);
  };
  var pushToDeal = q => {
    var total = quoteTotal(q);
    if (!confirm(`Set deal value to ${fmtCurrency(total)} based on this quote?`)) return;
    window.updateOpportunity(opp.id, {
      value_cents: Math.round(total * 100)
    }).then(() => onValueUpdated && onValueUpdated()).catch(e => alert("Couldn't update deal: " + e.message));
  };
  var markWon = q => {
    var total = quoteTotal(q);
    if (!confirm(`Mark quote v${q.version} as Accepted and close the deal as Won at ${fmtCurrency(total)}?`)) return;
    updateQuote(q.id, {
      status: "accepted",
      decidedAt: new Date().toISOString()
    });
    window.updateOpportunity(opp.id, {
      stage: "won",
      value_cents: Math.round(total * 100)
    }).then(() => onValueUpdated && onValueUpdated()).catch(e => alert("Couldn't update deal: " + e.message));
  };
  var markLost = q => {
    var closeDeal = confirm(`Mark quote v${q.version} as Declined?\n\nClick OK to also mark the whole deal as Closed Lost. Click Cancel to only mark this version declined (other versions can still win).`);
    updateQuote(q.id, {
      status: "declined",
      decidedAt: new Date().toISOString()
    });
    if (closeDeal) {
      window.updateOpportunity(opp.id, {
        stage: "lost"
      }).then(() => onValueUpdated && onValueUpdated()).catch(e => alert("Couldn't update deal: " + e.message));
    }
  };
  var reopen = q => {
    updateQuote(q.id, {
      status: q.sentAt ? q.viewedAt ? "viewed" : "sent" : "draft",
      decidedAt: null
    });
  };
  var applyReopen = (id, patch) => {
    var list = readQuotes(opp.id);
    var src = list.find(x => x.id === id);
    var nextStatus = src && src.sentAt ? "sent" : "draft";
    var next = list.map(x => x.id === id ? {
      ...x,
      expiresDate: patch.expiresDate,
      lineItems: patch.lineItems,
      status: nextStatus,
      decidedAt: null,
      updatedAt: new Date().toISOString()
    } : x);
    writeQuotes(opp.id, next);
    setVersions(next);
    setReopenId(null);
    if (window.cnToast) window.cnToast({
      title: "Quote re-opened",
      sub: `Live again · valid through ${patch.expiresDate}`
    });
  };
  var doMergeQuotes = ({
    lineItems,
    supersede,
    sourceIds
  }) => {
    var list = readQuotes(opp.id);
    var base = list.find(x => x.id === sourceIds[0]) || list[0];
    var q = {
      ...base,
      id: newId("q"),
      version: (list[0]?.version || 0) + 1,
      lineItems: lineItems.map(li => ({
        ...li,
        id: newId("li")
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sentAt: null,
      viewedAt: null,
      viewCount: 0,
      decidedAt: null,
      declineReason: null,
      shareToken: "qt-" + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 8),
      status: "draft",
      supersededBy: null,
      supersededAt: null
    };
    var next = [q, ...list.map(v => supersede && sourceIds.includes(v.id) ? {
      ...v,
      status: "superseded",
      supersededBy: q.id,
      supersededAt: new Date().toISOString()
    } : v)];
    writeQuotes(opp.id, next);
    setVersions(next);
    setMergeOpen(false);
    setBuilderId(q.id);
    if (window.cnToast) window.cnToast({
      title: "Quotes merged",
      sub: `${lineItems.length} line item${lineItems.length === 1 ? "" : "s"} → v${q.version} (draft)`
    });
  };
  var editing = builderId ? versions.find(q => q.id === builderId) : null;
  var sharing = shareId ? versions.find(q => q.id === shareId) : null;
  return React.createElement("section", {
    style: {
      marginTop: 28
    },
    className: "cn-quotes-section"
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 12
    }
  }, React.createElement("h3", {
    className: "cn-side-title",
    style: {
      margin: 0
    }
  }, "Quotes ", versions.length > 0 && React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      fontFamily: "var(--cn-sans)",
      fontSize: 13
    }
  }, "\xB7 ", versions.length, " version", versions.length === 1 ? "" : "s")), versions.length > 0 && React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, versions.length >= 2 && React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 32,
      padding: "6px 12px",
      fontSize: 12.5
    },
    onClick: () => setMergeOpen(true),
    title: "Combine line items from two versions into one"
  }, "\u21C4 Merge"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 32,
      padding: "6px 12px",
      fontSize: 12.5
    },
    onClick: () => createVersion(versions[0].id)
  }, "+ New version (copy v", versions[0].version, ")"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 32,
      padding: "6px 12px",
      fontSize: 12.5
    },
    onClick: () => createVersion(null, "gpuaas"),
    title: "GPU-as-a-Service quote — fleet, rate per GPU-hour, term"
  }, "+ GPUaaS quote"))), versions.length > 0 && (() => {
    var accepted = versions.find(v => v.status === "accepted");
    var declined = versions.filter(v => v.status === "declined").length;
    if (!accepted && !declined) return null;
    return React.createElement("div", {
      className: "cn-q-summary"
    }, accepted && React.createElement("span", null, React.createElement("span", {
      className: "cn-q-status-dot cn-q-status-dot--accepted"
    }), " v", accepted.version, " accepted \xB7 ", React.createElement("span", {
      className: "cn-mono"
    }, fmtCurrency(quoteTotal(accepted)))), declined > 0 && React.createElement("span", {
      className: "cn-q-summary-sep"
    }, "\xB7"), declined > 0 && React.createElement("span", {
      style: {
        color: "var(--cn-mute)"
      }
    }, declined, " declined"));
  })(), versions.length === 0 ? React.createElement("div", {
    className: "cn-quote-empty"
  }, React.createElement("div", {
    className: "cn-quote-empty-icon"
  }, "\u2263"), React.createElement("div", null, React.createElement("div", {
    style: {
      fontWeight: 500,
      marginBottom: 4
    }
  }, "No quote yet"), React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12.5,
      marginBottom: 12
    }
  }, "Hardware quotes carry line items. GPUaaS quotes carry a fleet, an hourly rate and a term — both share a link and track views."), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "center",
      flexWrap: "wrap"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => createVersion(null, "gpuaas")
  }, "+ GPUaaS quote"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => createVersion(null)
  }, "+ Hardware quote")))) : React.createElement("div", {
    className: "cn-q-versions"
  }, versions.map(q => React.createElement("article", {
    key: q.id,
    className: `cn-q-row ${builderId === q.id ? "is-editing" : ""}`
  }, React.createElement("div", {
    className: "cn-q-row-left"
  }, React.createElement("div", {
    className: "cn-q-vtag"
  }, "v", q.version), React.createElement("div", {
    className: "cn-q-row-meta"
  }, React.createElement("div", {
    className: "cn-q-row-num"
  }, React.createElement("span", {
    className: "cn-mono"
  }, q.quoteNumber), React.createElement(QuoteStatus, {
    quote: q
  })), React.createElement("div", {
    className: "cn-q-row-sub"
  }, q.lineItems.length, " line", q.lineItems.length === 1 ? "" : "s", " \xB7 ", q.issueDate, q.sentAt && React.createElement(React.Fragment, null, " \xB7 Sent ", timeAgo(q.sentAt)), q.viewedAt && React.createElement(React.Fragment, null, " \xB7 ", React.createElement("span", {
    className: "cn-q-viewed-inline"
  }, "Viewed ", timeAgo(q.viewedAt), q.viewCount > 1 ? ` (${q.viewCount}×)` : "")), quoteIsExpired(q) ? React.createElement(React.Fragment, null, " \xB7 ", React.createElement("span", {
    style: {
      color: "#8A5A22",
      fontWeight: 500
    }
  }, "Expired ", q.expiresDate)) : quoteIsExpiringSoon(q) && React.createElement(React.Fragment, null, " \xB7 ", React.createElement("span", {
    style: {
      color: "var(--cn-copper-deep)",
      fontWeight: 500
    }
  }, "Expires in ", daysUntilDate(q.expiresDate), "d"))))), React.createElement("div", {
    className: "cn-q-row-right"
  }, React.createElement("div", {
    className: "cn-q-row-total cn-mono"
  }, fmtCurrency(quoteTotal(q))), React.createElement("div", {
    className: "cn-q-row-actions"
  }, React.createElement("button", {
    className: "cn-link",
    onClick: () => setBuilderId(q.id)
  }, q.status === "superseded" ? "View" : "Edit"), React.createElement("span", {
    className: "cn-q-actsep"
  }, "\xB7"), React.createElement("button", {
    className: "cn-link",
    onClick: () => setShareId(q.id)
  }, "Share"), q.status === "superseded" ? null : q.status === "accepted" || q.status === "declined" ? React.createElement(React.Fragment, null, React.createElement("span", {
    className: "cn-q-actsep"
  }, "\xB7"), React.createElement("button", {
    className: "cn-link",
    onClick: () => reopen(q),
    title: "Reopen this quote"
  }, "Reopen")) : quoteIsExpired(q) ? React.createElement(React.Fragment, null, React.createElement("span", {
    className: "cn-q-actsep"
  }, "\xB7"), React.createElement("button", {
    className: "cn-link cn-link--pos",
    onClick: () => setReopenId(q.id),
    title: "Review pricing and re-open with a fresh expiry"
  }, "Re-open"), React.createElement("span", {
    className: "cn-q-actsep"
  }, "\xB7"), React.createElement("button", {
    className: "cn-link cn-link--neg",
    onClick: () => markLost(q),
    title: "Mark this version as declined"
  }, "Lost")) : React.createElement(React.Fragment, null, React.createElement("span", {
    className: "cn-q-actsep"
  }, "\xB7"), React.createElement("button", {
    className: "cn-link cn-link--pos",
    onClick: () => markWon(q),
    title: "Mark this quote as accepted and close the deal as Won"
  }, "Won"), React.createElement("span", {
    className: "cn-q-actsep"
  }, "\xB7"), React.createElement("button", {
    className: "cn-link cn-link--neg",
    onClick: () => markLost(q),
    title: "Mark this version as declined"
  }, "Lost"))))))), editing && (window.cnGpuQuotes && window.cnGpuQuotes.isGpu(editing) ? window.cnGpuQuotes.editorEl({
    quote: editing,
    opp: opp,
    account: account,
    contact: contact,
    onSave: q2 => updateQuote(editing.id, q2),
    onClose: () => setBuilderId(null),
    onDelete: () => deleteQuote(editing.id),
    onShare: () => {
      setBuilderId(null);
      setShareId(editing.id);
    }
  }) : React.createElement(QuoteBuilderModal, {
    quote: editing,
    opp: opp,
    account: account,
    contact: contact,
    onChange: patch => updateQuote(editing.id, patch),
    onClose: () => setBuilderId(null),
    onDelete: () => deleteQuote(editing.id),
    onShare: () => {
      setShareId(editing.id);
    }
  })), sharing && React.createElement(QuoteShareModal, {
    quote: sharing,
    opp: opp,
    account: account,
    contact: contact,
    onClose: () => setShareId(null),
    onUpdate: patch => updateQuote(sharing.id, patch)
  }), reopenId && (() => {
    var rq = versions.find(x => x.id === reopenId);
    return rq ? React.createElement(QuoteReopenModal, {
      quote: rq,
      onClose: () => setReopenId(null),
      onApply: patch => applyReopen(rq.id, patch)
    }) : null;
  })(), mergeOpen && React.createElement(QuoteMergeModal, {
    versions: versions,
    onClose: () => setMergeOpen(false),
    onMerge: doMergeQuotes
  }));
}
function QuoteMergeModal({
  versions,
  onClose,
  onMerge
}) {
  var [aId, setAId] = useState(versions[0]?.id || "");
  var [bId, setBId] = useState(versions[1]?.id || "");
  var [supersede, setSupersede] = useState(true);
  var a = versions.find(v => v.id === aId);
  var b = versions.find(v => v.id === bId);
  var sameSel = aId && bId && aId === bId;
  var srcCount = (a?.lineItems || []).length + (b?.lineItems || []).length;
  var combined = useMemo(() => {
    var map = new Map();
    var order = [];
    [a, b].filter(Boolean).forEach(q => (q.lineItems || []).forEach(li => {
      if (!li.partNumber && !li.description) return;
      var key = (li.partNumber || "").trim().toLowerCase() + "|" + (li.condition || "").trim().toLowerCase();
      if (map.has(key)) {
        var ex = map.get(key);
        ex.qty = (parseFloat(ex.qty) || 0) + (parseFloat(li.qty) || 0);
      } else {
        map.set(key, {
          ...li
        });
        order.push(key);
      }
    }));
    return order.map(k => map.get(k));
  }, [aId, bId]);
  var collapsed = Math.max(0, srcCount - combined.length);
  var total = combined.reduce((s, li) => s + lineTotal(li), 0);
  var opt = v => `v${v.version} · ${v.quoteNumber} · ${(v.lineItems || []).length} lines`;
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose,
    style: {
      zIndex: 210
    }
  }, React.createElement("div", {
    className: "cn-modal",
    onClick: e => e.stopPropagation(),
    style: {
      width: 640
    }
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Merge quote versions"), React.createElement("h2", {
    className: "cn-modal-title"
  }, "Combine line items")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-field-help",
    style: {
      marginTop: 0,
      marginBottom: 14
    }
  }, "Pick two versions. Their line items combine into a new draft; matching parts (same part number + condition) merge and their quantities add up."), React.createElement("div", {
    className: "cn-grid-2",
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12
    }
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Version A"), React.createElement("select", {
    className: "cn-input",
    value: aId,
    onChange: e => setAId(e.target.value)
  }, versions.map(v => React.createElement("option", {
    key: v.id,
    value: v.id
  }, opt(v))))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Version B"), React.createElement("select", {
    className: "cn-input",
    value: bId,
    onChange: e => setBId(e.target.value)
  }, versions.map(v => React.createElement("option", {
    key: v.id,
    value: v.id
  }, opt(v)))))), sameSel && React.createElement("div", {
    className: "cn-field-help",
    style: {
      color: "var(--cn-neg)"
    }
  }, "Pick two different versions to merge."), React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginTop: 16,
      marginBottom: 4
    }
  }, "Combined preview ", collapsed > 0 && React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0
    }
  }, "\xB7 ", collapsed, " duplicate line", collapsed === 1 ? "" : "s", " merged")), React.createElement("div", {
    className: "cn-reopen-head"
  }, React.createElement("span", null, "Part / description"), React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "Qty"), React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "Line total")), React.createElement("div", {
    className: "cn-reopen-lines"
  }, combined.length === 0 ? React.createElement("div", {
    className: "cn-reopen-lrow",
    style: {
      gridTemplateColumns: "1fr",
      color: "var(--cn-mute)"
    }
  }, "No line items.") : combined.map((li, i) => React.createElement("div", {
    className: "cn-reopen-lrow",
    key: i
  }, React.createElement("div", {
    className: "cn-reopen-lpn"
  }, li.partNumber || "—", li.description && React.createElement("small", null, li.description)), React.createElement("div", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, li.qty), React.createElement("div", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, fmtCurrency(lineTotal(li)))))), React.createElement("div", {
    className: "cn-reopen-total"
  }, React.createElement("span", {
    className: "cn-card-eyebrow"
  }, "Merged total"), React.createElement("b", {
    className: "cn-mono"
  }, fmtCurrency(total))), React.createElement("label", {
    className: "cn-dup-openafter",
    style: {
      marginTop: 14
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: supersede,
    onChange: e => setSupersede(e.target.checked)
  }), React.createElement("span", null, "Mark the two source versions as ", React.createElement("b", null, "Superseded"), " (recommended \u2014 keeps history, collapses the duplicates)"))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    disabled: sameSel || combined.length === 0,
    onClick: () => onMerge({
      lineItems: combined,
      supersede,
      sourceIds: [aId, bId]
    })
  }, "Merge into new draft \u2192"))));
}
function QuoteReopenModal({
  quote,
  onClose,
  onApply
}) {
  var [lines, setLines] = useState(() => (quote.lineItems || []).map(li => ({
    ...li
  })));
  var [expiresDate, setExpiresDate] = useState(() => window.cnDayPlus(QUOTE_VALID_DAYS));
  var setLine = (id, patch) => setLines(ls => ls.map(l => l.id === id ? {
    ...l,
    ...patch
  } : l));
  var total = lines.reduce((s, li) => s + lineTotal(li), 0);
  var oldTotal = quoteTotal(quote);
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose,
    style: {
      zIndex: 210
    }
  }, React.createElement("div", {
    className: "cn-modal",
    onClick: e => e.stopPropagation(),
    style: {
      width: 640
    }
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Re-open expired quote"), React.createElement("h2", {
    className: "cn-modal-title"
  }, quote.quoteNumber)), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-field-help",
    style: {
      marginTop: 0,
      marginBottom: 16
    }
  }, "This quote expired on ", React.createElement("b", null, quote.expiresDate), ". Review each line and refresh pricing before re-opening \u2014 the customer's link goes live again with the new expiry."), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "New expiry date"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: expiresDate,
    onChange: e => setExpiresDate(e.target.value),
    style: {
      maxWidth: 200
    }
  })), React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginTop: 18,
      marginBottom: 4
    }
  }, "Review lines"), React.createElement("div", {
    className: "cn-reopen-head"
  }, React.createElement("span", null, "Part / description"), React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "Qty"), React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "Price / unit")), React.createElement("div", {
    className: "cn-reopen-lines"
  }, lines.map(li => React.createElement("div", {
    className: "cn-reopen-lrow",
    key: li.id
  }, React.createElement("div", {
    className: "cn-reopen-lpn"
  }, li.partNumber || "—", li.description && React.createElement("small", null, li.description)), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      textAlign: "right"
    },
    value: li.qty,
    onChange: e => setLine(li.id, {
      qty: e.target.value
    })
  }), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      textAlign: "right"
    },
    value: li.unitPrice,
    onChange: e => setLine(li.id, {
      unitPrice: e.target.value
    })
  })))), React.createElement("div", {
    className: "cn-reopen-total"
  }, React.createElement("span", {
    className: "cn-card-eyebrow"
  }, "New total", Math.abs(total - oldTotal) > 0.005 ? React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      marginLeft: 8,
      textTransform: "none",
      letterSpacing: 0
    }
  }, "was ", fmtCurrency(oldTotal)) : null), React.createElement("b", {
    className: "cn-mono"
  }, fmtCurrency(total)))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => onApply({
      expiresDate,
      lineItems: lines
    })
  }, "Re-open quote \u2192"))));
}
function QuoteBuilderModal({
  quote,
  opp,
  account,
  contact,
  onChange,
  onClose,
  onDelete,
  onShare
}) {
  var [q, setQ] = useState(quote);
  var dirtyRef = useRef(false);
  var [catalog, setCatalog] = useState(() => Object.values((() => {
    try {
      return JSON.parse(localStorage.getItem("cn-catalog-cache-v1") || "{}");
    } catch {
      return {};
    }
  })()));
  useEffect(() => {
    if (window.loadCatalog) {
      window.loadCatalog().then(list => setCatalog(list || []));
    }
  }, []);
  var catalogIndex = useMemo(() => {
    var m = {};
    for (var c of catalog) m[(c.part_number || "").toUpperCase()] = c;
    return m;
  }, [catalog]);
  useEffect(() => {
    setQ(quote);
    dirtyRef.current = false;
  }, [quote.id]);
  var update = patch => {
    var next = {
      ...q,
      ...patch
    };
    setQ(next);
    dirtyRef.current = true;
    onChange(patch);
  };
  var updateLine = (id, patch) => {
    var next = q.lineItems.map(li => li.id === id ? {
      ...li,
      ...patch
    } : li);
    update({
      lineItems: next
    });
  };
  var addLine = () => update({
    lineItems: [...q.lineItems, newLine()]
  });
  var removeLine = id => update({
    lineItems: q.lineItems.filter(li => li.id !== id)
  });
  var moveLine = (id, dir) => {
    var idx = q.lineItems.findIndex(li => li.id === id);
    if (idx < 0) return;
    var next = [...q.lineItems];
    var target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    update({
      lineItems: next
    });
  };
  var total = quoteTotal(q);
  return React.createElement("div", {
    className: "cn-modal-scrim cn-quote-scrim",
    onClick: onClose
  }, React.createElement("div", {
    className: "cn-modal cn-quote-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Quote v", q.version, " \xB7 ", opp.title), React.createElement("h2", {
    className: "cn-modal-title",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, React.createElement("input", {
    className: "cn-input cn-quote-num",
    value: q.quoteNumber,
    onChange: e => update({
      quoteNumber: e.target.value
    })
  }), React.createElement(QuoteStatus, {
    quote: q
  }))), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body cn-quote-body"
  }, React.createElement("div", {
    className: "cn-quote-doc-edit"
  }, React.createElement("div", {
    className: "cn-quote-meta-grid"
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Issue date"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: q.issueDate,
    onChange: e => update({
      issueDate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Expires"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: q.expiresDate,
    onChange: e => update({
      expiresDate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Reference"), React.createElement("input", {
    className: "cn-input",
    value: q.reference,
    onChange: e => update({
      reference: e.target.value
    }),
    placeholder: "Deal title or PO ref"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Prepared by"), React.createElement("select", {
    className: "cn-input",
    value: q.preparedBy || "",
    onChange: e => update({
      preparedBy: e.target.value
    })
  }, React.createElement("option", {
    value: ""
  }, "\u2014 Select \u2014"), (window.REPS || []).map(r => React.createElement("option", {
    key: r.id,
    value: r.id
  }, r.name))))), React.createElement("div", {
    className: "cn-quote-billto"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Bill to (company)"), React.createElement("input", {
    className: "cn-input",
    value: q.billToName,
    onChange: e => update({
      billToName: e.target.value
    })
  }), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 60,
      marginTop: 8
    },
    value: q.billToAddress,
    onChange: e => update({
      billToAddress: e.target.value
    }),
    placeholder: "Billing address"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Attention"), React.createElement("input", {
    className: "cn-input",
    value: q.attentionName,
    onChange: e => update({
      attentionName: e.target.value
    }),
    placeholder: "Contact name"
  }), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      marginTop: 8,
      fontSize: 12.5
    },
    value: q.attentionEmail,
    onChange: e => update({
      attentionEmail: e.target.value
    }),
    placeholder: "email@example.com"
  }))), React.createElement("div", {
    className: "cn-quote-li-wrap"
  }, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginBottom: 8
    }
  }, "Line items"), React.createElement("table", {
    className: "cn-li-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      width: 28
    }
  }), React.createElement("th", null, "Mfr Part Number"), React.createElement("th", {
    style: {
      width: 80
    }
  }, "Qty"), React.createElement("th", {
    style: {
      width: 160
    }
  }, "Condition"), React.createElement("th", {
    style: {
      width: 140
    },
    className: "cn-li-right"
  }, "Price / unit"), React.createElement("th", {
    style: {
      width: 140
    },
    className: "cn-li-right"
  }, "Total"), React.createElement("th", {
    style: {
      width: 32
    }
  }))), React.createElement("tbody", null, q.lineItems.map((li, i) => React.createElement(Fragment, {
    key: li.id
  }, React.createElement("tr", null, React.createElement("td", {
    className: "cn-li-handle"
  }, React.createElement("button", {
    className: "cn-li-mover",
    disabled: i === 0,
    onClick: () => moveLine(li.id, -1),
    title: "Move up"
  }, "\u2191"), React.createElement("button", {
    className: "cn-li-mover",
    disabled: i === q.lineItems.length - 1,
    onClick: () => moveLine(li.id, 1),
    title: "Move down"
  }, "\u2193")), React.createElement("td", null, React.createElement("input", {
    className: "cn-li-input cn-mono",
    value: li.partNumber,
    list: "cn-catalog-parts",
    onChange: e => {
      var pn = e.target.value;
      var match = catalogIndex[pn.trim().toUpperCase()];
      if (match && (!li.partNumber || pn.toUpperCase() !== (li.partNumber || "").toUpperCase())) {
        var patch = {
          partNumber: pn
        };
        if (!li.description && match.description) patch.description = match.description;
        if ((!li.condition || li.condition === "New") && match.last_condition) patch.condition = match.last_condition;
        if ((!li.unitPrice || parseFloat(li.unitPrice) === 0) && match.last_unit_price_cents) {
          patch.unitPrice = (match.last_unit_price_cents / 100).toFixed(2);
        }
        updateLine(li.id, patch);
      } else {
        updateLine(li.id, {
          partNumber: pn
        });
      }
    },
    placeholder: "MFR-PN-0000"
  }), (() => {
    var match = catalogIndex[(li.partNumber || "").trim().toUpperCase()];
    if (!match || (match.sample_count || 0) < 1) return null;
    return React.createElement("div", {
      className: "cn-li-catalog-hint",
      title: `Quoted ${match.sample_count}× · last ${match.last_used_at ? new Date(match.last_used_at).toLocaleDateString() : ""}`
    }, "\u2713 in catalog \xB7 ", match.sample_count, "\xD7 quoted");
  })()), React.createElement("td", null, React.createElement("input", {
    className: "cn-li-input cn-mono cn-li-right-input",
    type: "number",
    min: "0",
    step: "1",
    value: li.qty,
    onChange: e => updateLine(li.id, {
      qty: e.target.value
    })
  })), React.createElement("td", null, React.createElement("input", {
    className: "cn-li-input",
    list: `cn-cond-${li.id}`,
    value: li.condition,
    onChange: e => updateLine(li.id, {
      condition: e.target.value
    }),
    placeholder: "Condition"
  }), React.createElement("datalist", {
    id: `cn-cond-${li.id}`
  }, CONDITIONS.map(c => React.createElement("option", {
    key: c,
    value: c
  })))), React.createElement("td", null, React.createElement("div", {
    className: "cn-li-money"
  }, React.createElement("span", null, "$"), React.createElement("input", {
    className: "cn-li-input cn-mono cn-li-right-input",
    type: "number",
    min: "0",
    step: "0.01",
    value: li.unitPrice,
    onChange: e => updateLine(li.id, {
      unitPrice: e.target.value
    })
  }))), React.createElement("td", {
    className: "cn-li-right cn-mono cn-li-total"
  }, fmtCurrency(lineTotal(li))), React.createElement("td", null, React.createElement("button", {
    className: "cn-li-remove",
    onClick: () => removeLine(li.id),
    disabled: q.lineItems.length === 1,
    title: "Remove line"
  }, "\u2715"))), React.createElement("tr", {
    className: "cn-li-desc-row"
  }, React.createElement("td", null), React.createElement("td", {
    colSpan: 5
  }, React.createElement("input", {
    className: "cn-li-input cn-li-desc",
    value: li.description,
    onChange: e => updateLine(li.id, {
      description: e.target.value
    }),
    placeholder: "Description / notes for this line (optional)"
  })), React.createElement("td", null)))))), React.createElement("datalist", {
    id: "cn-catalog-parts"
  }, catalog.slice(0, 200).map(c => React.createElement("option", {
    key: c.part_number,
    value: c.part_number
  }, c.description ? `— ${c.description}` : "", c.last_unit_price_cents ? ` · ${fmtCurrency(c.last_unit_price_cents / 100)}` : ""))), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      marginTop: 10
    },
    onClick: addLine
  }, "+ Add line")), React.createElement("div", {
    className: "cn-quote-foot-grid"
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Notes for customer"), React.createElement("textarea", {
    className: "cn-textarea",
    value: q.notes,
    onChange: e => update({
      notes: e.target.value
    }),
    placeholder: "Internal note: lead time, shipping, exclusions, etc."
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Terms & conditions"), React.createElement("textarea", {
    className: "cn-textarea",
    value: q.terms,
    onChange: e => update({
      terms: e.target.value
    })
  }))), React.createElement("div", {
    className: "cn-quote-totals"
  }, React.createElement("div", {
    className: "cn-quote-totals-row cn-quote-totals-row--final"
  }, React.createElement("span", null, "Total"), React.createElement("span", {
    className: "cn-mono"
  }, fmtCurrency(total))), React.createElement("div", {
    className: "cn-quote-totals-meta"
  }, q.lineItems.length, " line item", q.lineItems.length === 1 ? "" : "s", " \xB7 ", q.lineItems.reduce((s, li) => s + (parseFloat(li.qty) || 0), 0).toLocaleString(), " units")))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--danger",
    onClick: onDelete
  }, "Delete version"), React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 8
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Close"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => {
      onShare();
      onClose();
    }
  }, "Share quote \u2192")))));
}
function QuoteShareModal({
  quote,
  opp,
  account,
  contact,
  onClose,
  onUpdate
}) {
  var shareUrl = window.location.origin + window.location.pathname + "?quote=" + quote.shareToken;
  var [copied, setCopied] = useState(false);
  var [, force] = useState(0);
  useEffect(() => {
    var tick = () => {
      var fresh = readQuotes(opp.id).find(q => q.id === quote.id);
      if (fresh && (fresh.viewedAt !== quote.viewedAt || fresh.viewCount !== quote.viewCount)) {
        onUpdate({
          viewedAt: fresh.viewedAt,
          viewCount: fresh.viewCount,
          status: fresh.status
        });
      }
      force(n => n + 1);
    };
    var id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, [quote.id]);
  var copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      var ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };
  var markSent = () => {
    onUpdate({
      sentAt: new Date().toISOString(),
      status: quote.status === "viewed" ? "viewed" : "sent"
    });
  };
  var [trackedSending, setTrackedSending] = useState(false);
  var [trackedResult, setTrackedResult] = useState(null);
  var [confirmDraft, setConfirmDraft] = useState(null);
  var startTrackedSend = () => {
    if (!contact?.email) {
      alert("This contact doesn't have an email address. Add one to their profile first.");
      return;
    }
    if (!window.SEND_VIA_RESEND) {
      alert("Tracked send is only available when Resend is connected. Use the email link instead.");
      return;
    }
    var senderRep = (window.REPS || []).find(r => r.id === quote.preparedBy);
    var cnBrandName = window.CN_BRAND && window.CN_BRAND.name || "Chief Negotiators";
    var senderName = senderRep?.fullName || senderRep?.name || cnBrandName;
    var total = fmtCurrency(quoteTotal(quote));
    var firstName = (contact?.name || "").split(" ")[0] || "there";
    setConfirmDraft({
      to: contact.email,
      name: contact.name,
      senderName,
      subject: `Quote ${quote.quoteNumber} — ${opp.title}`,
      body: `Hi ${firstName},\n\nQuote ${quote.quoteNumber} ready for review. Total is ${total}, valid through ${quote.expiresDate}.\n\nClick below to view the full breakdown — you can accept or request changes directly from the link.\n\n— ${senderName}\n${cnBrandName}`
    });
  };
  var confirmTrackedSend = async () => {
    if (!confirmDraft || trackedSending) return;
    var senderRep = (window.REPS || []).find(r => r.id === quote.preparedBy);
    var senderEmail = senderRep?.email || null;
    var total = fmtCurrency(quoteTotal(quote));
    var firstName = (contact?.name || "").split(" ")[0] || "there";
    var campaign = {
      id: "qc-" + quote.id + "-" + Date.now().toString(36),
      name: `Quote ${quote.quoteNumber} — ${opp.title}`,
      fromName: confirmDraft.senderName,
      senderEmail,
      subject: confirmDraft.subject,
      preheader: `Total ${total} · Valid through ${quote.expiresDate}`,
      body: confirmDraft.body,
      imageUrl: "",
      ctaText: "View & respond to quote →",
      ctaUrl: shareUrl
    };
    var recipients = [{
      contactId: contact.id,
      email: contact.email,
      ctx: {
        first_name: firstName,
        company: opp.title,
        sender_name: confirmDraft.senderName
      }
    }];
    setTrackedSending(true);
    try {
      await window.sendCampaignViaResend(campaign, recipients);
      markSent();
      setTrackedResult({
        ok: true
      });
      setConfirmDraft(null);
      if (window.cnToast) window.cnToast({
        title: `Quote ${quote.quoteNumber} sent to ${contact.name}`,
        sub: "Tracking opens & clicks — check back in a few minutes"
      });
    } catch (e) {
      console.error("Tracked send failed:", e);
      setTrackedResult({
        ok: false,
        error: e.message
      });
      if (window.cnToast) window.cnToast({
        title: `Send failed`,
        sub: e.message,
        kind: "error"
      });
    } finally {
      setTrackedSending(false);
    }
  };
  var openPreview = () => {
    window.open(shareUrl, "_blank", "noopener");
  };
  var emailHref = (() => {
    var cnBrandName = window.CN_BRAND && window.CN_BRAND.name || "Chief Negotiators";
    var subj = encodeURIComponent(`Quote ${quote.quoteNumber} from ${cnBrandName} — ${opp.title}`);
    var body = encodeURIComponent(`Hi ${(contact?.name || "").split(" ")[0] || "there"},

Please find quote ${quote.quoteNumber} attached at the link below. Total: ${fmtCurrency(quoteTotal(quote))}, valid through ${quote.expiresDate}.

${shareUrl}

Happy to walk through any of the line items or adjust based on your needs.

— ${cnBrandName}`);
    return `mailto:${contact?.email || ""}?subject=${subj}&body=${body}`;
  })();
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
      width: 580
    }
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Share quote \xB7 v", quote.version), React.createElement("h2", {
    className: "cn-modal-title"
  }, quote.quoteNumber)), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, !confirmDraft && React.createElement("div", {
    className: "cn-share-chooser"
  }, React.createElement("div", {
    className: "cn-share-chooser-lead"
  }, "How would you like to send ", React.createElement("span", {
    className: "cn-mono"
  }, quote.quoteNumber), "?"), React.createElement("div", {
    className: "cn-share-options"
  }, window.SEND_VIA_RESEND && contact?.email && React.createElement("button", {
    className: "cn-share-option cn-share-option--primary",
    onClick: startTrackedSend,
    disabled: trackedSending
  }, React.createElement("div", {
    className: "cn-share-option-glyph"
  }, "\u2709"), React.createElement("div", {
    className: "cn-share-option-text"
  }, React.createElement("div", {
    className: "cn-share-option-title"
  }, "Send via CRM ", React.createElement("span", {
    className: "cn-share-option-badge"
  }, "tracked")), React.createElement("div", {
    className: "cn-share-option-sub"
  }, "Email through Resend to ", React.createElement("span", {
    className: "cn-mono"
  }, contact.email), ". Tracks opens & clicks automatically.")), React.createElement("div", {
    className: "cn-share-option-chev"
  }, "\u203A")), React.createElement("a", {
    className: "cn-share-option",
    href: emailHref,
    onClick: markSent
  }, React.createElement("div", {
    className: "cn-share-option-glyph"
  }, "\u25F0"), React.createElement("div", {
    className: "cn-share-option-text"
  }, React.createElement("div", {
    className: "cn-share-option-title"
  }, "Send from my email app"), React.createElement("div", {
    className: "cn-share-option-sub"
  }, "Opens Outlook / Mail with the quote link pre-filled. Send from your own inbox \u2014 no open tracking.")), React.createElement("div", {
    className: "cn-share-option-chev"
  }, "\u2197")), React.createElement("button", {
    className: "cn-share-option",
    onClick: () => {
      openPreview();
    }
  }, React.createElement("div", {
    className: "cn-share-option-glyph"
  }, "\u2913"), React.createElement("div", {
    className: "cn-share-option-text"
  }, React.createElement("div", {
    className: "cn-share-option-title"
  }, "Save as PDF"), React.createElement("div", {
    className: "cn-share-option-sub"
  }, "Opens the printable quote in a new tab. Use Print \u2192 Save as PDF to download.")), React.createElement("div", {
    className: "cn-share-option-chev"
  }, "\u2197")), React.createElement("button", {
    className: "cn-share-option",
    onClick: copy
  }, React.createElement("div", {
    className: "cn-share-option-glyph"
  }, "\u29C9"), React.createElement("div", {
    className: "cn-share-option-text"
  }, React.createElement("div", {
    className: "cn-share-option-title"
  }, copied ? "Link copied ✓" : "Copy shareable link"), React.createElement("div", {
    className: "cn-share-option-sub cn-mono cn-share-option-link"
  }, shareUrl)), React.createElement("div", {
    className: "cn-share-option-chev"
  }, copied ? "✓" : "⧉")), !quote.sentAt && React.createElement("button", {
    className: "cn-share-option",
    onClick: markSent
  }, React.createElement("div", {
    className: "cn-share-option-glyph"
  }, "\u2713"), React.createElement("div", {
    className: "cn-share-option-text"
  }, React.createElement("div", {
    className: "cn-share-option-title"
  }, "Mark as sent"), React.createElement("div", {
    className: "cn-share-option-sub"
  }, "Already sent this quote another way? Flip it to ", React.createElement("strong", null, "Sent"), " so it's out of Draft. (No email is sent.)")), React.createElement("div", {
    className: "cn-share-option-chev"
  }, "\u203A"))), (quote.sentAt || quote.viewedAt) && React.createElement("div", {
    className: "cn-share-status",
    style: {
      marginTop: 8
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Delivery"), React.createElement("div", {
    className: "cn-share-status-line"
  }, quote.sentAt ? React.createElement("span", null, React.createElement("span", {
    className: "cn-q-status-dot cn-q-status-dot--sent"
  }), " Sent ", timeAgo(quote.sentAt)) : React.createElement("span", null, React.createElement("span", {
    className: "cn-q-status-dot cn-q-status-dot--draft"
  }), " Not yet sent"))), React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "View tracking"), React.createElement("div", {
    className: "cn-share-status-line"
  }, quote.viewedAt ? React.createElement("span", null, React.createElement("span", {
    className: "cn-q-status-dot cn-q-status-dot--viewed"
  }), " Viewed ", timeAgo(quote.viewedAt), quote.viewCount > 1 ? ` · ${quote.viewCount} opens` : "") : quote.sentAt ? React.createElement("span", null, React.createElement("span", {
    className: "cn-q-status-dot cn-q-status-dot--waiting"
  }), " Awaiting open\u2026") : React.createElement("span", null, React.createElement("span", {
    className: "cn-q-status-dot cn-q-status-dot--draft"
  }), " Pings here when recipient opens the link"))))), confirmDraft && React.createElement("div", {
    className: "cn-quote-confirm"
  }, React.createElement("button", {
    className: "cn-share-back",
    onClick: () => setConfirmDraft(null),
    disabled: trackedSending
  }, "\u2190 Choose another way"), React.createElement("div", {
    className: "cn-quote-confirm-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Review & send via CRM"), React.createElement("div", {
    className: "cn-quote-confirm-title"
  }, "Tracked email to ", confirmDraft.name))), React.createElement("div", {
    className: "cn-quote-confirm-grid"
  }, React.createElement("label", {
    className: "cn-quote-confirm-label"
  }, "To"), React.createElement("div", {
    className: "cn-mono cn-quote-confirm-to"
  }, confirmDraft.to), React.createElement("label", {
    className: "cn-quote-confirm-label"
  }, "From"), React.createElement("div", null, confirmDraft.senderName, " ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)"
    }
  }, "\xB7 via Resend")), React.createElement("label", {
    className: "cn-quote-confirm-label",
    htmlFor: "cn-q-conf-subj"
  }, "Subject"), React.createElement("input", {
    id: "cn-q-conf-subj",
    className: "cn-input",
    value: confirmDraft.subject,
    onChange: e => setConfirmDraft({
      ...confirmDraft,
      subject: e.target.value
    }),
    disabled: trackedSending
  }), React.createElement("label", {
    className: "cn-quote-confirm-label",
    htmlFor: "cn-q-conf-body"
  }, "Message"), React.createElement("textarea", {
    id: "cn-q-conf-body",
    className: "cn-textarea",
    value: confirmDraft.body,
    onChange: e => setConfirmDraft({
      ...confirmDraft,
      body: e.target.value
    }),
    disabled: trackedSending,
    style: {
      minHeight: 140
    }
  })), React.createElement("div", {
    className: "cn-quote-confirm-foot"
  }, React.createElement("div", {
    className: "cn-field-help",
    style: {
      margin: 0
    }
  }, "The share link ", React.createElement("span", {
    className: "cn-mono"
  }, shareUrl.length > 48 ? shareUrl.slice(0, 45) + "…" : shareUrl), " is appended as a button below the message."), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setConfirmDraft(null),
    disabled: trackedSending
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: confirmTrackedSend,
    disabled: trackedSending
  }, trackedSending ? React.createElement(React.Fragment, null, React.createElement("span", {
    className: "cn-spinner"
  }), " Sending\u2026") : "Send now")))), trackedResult?.ok && React.createElement("div", {
    style: {
      marginTop: 10,
      padding: "10px 12px",
      background: "#DCE9DE",
      border: "1px solid #B6D2BB",
      borderRadius: "var(--cn-r)",
      color: "var(--cn-pos)",
      fontSize: 12.5
    }
  }, "\u2713 Sent through Resend. Opens & clicks will update here automatically."), trackedResult?.ok === false && React.createElement("div", {
    className: "cn-login-error",
    style: {
      marginTop: 10
    }
  }, "Send failed: ", trackedResult.error), React.createElement("details", {
    className: "cn-share-demo"
  }, React.createElement("summary", null, "Tracking"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 10,
      flexWrap: "wrap"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => onUpdate({
      sentAt: null,
      viewedAt: null,
      viewCount: 0,
      status: "draft"
    })
  }, "Reset tracking")))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: onClose
  }, "Done")))));
}
function QuoteShareView({
  token
}) {
  var [resolved, setResolved] = useState(null);
  var [notFound, setNotFound] = useState(false);
  var [decision, setDecision] = useState(null);
  var [showDecline, setShowDecline] = useState(false);
  var [declineReason, setDeclineReason] = useState("");
  useEffect(() => {
    var cancelled = false;
    (async () => {
      var hit = lookupByToken(token);
      if (!hit && window.loadSharedDoc) {
        var remote = await window.loadSharedDoc(token);
        if (remote && remote.kind === "quote" && remote.doc) {
          var oppId = remote.doc.oppId || "remote";
          hit = {
            oppId,
            quoteId: remote.doc.id,
            quote: remote.doc
          };
          try {
            var _list = readQuotes(oppId);
            if (!_list.some(q => q.id === remote.doc.id)) {
              localStorage.setItem(QK(oppId), JSON.stringify([remote.doc, ..._list]));
              var idx = JSON.parse(localStorage.getItem(TOKEN_INDEX) || "{}");
              idx[remote.doc.shareToken] = {
                oppId,
                quoteId: remote.doc.id
              };
              localStorage.setItem(TOKEN_INDEX, JSON.stringify(idx));
            }
          } catch {}
        }
      }
      if (cancelled) return;
      if (!hit) {
        setNotFound(true);
        return;
      }
      {
        var chain = readQuotes(hit.oppId);
        var cur = chain.find(x => x.id === hit.quoteId);
        var guard = 0;
        while (cur && cur.supersededBy && guard++ < 25) {
          var nxt = chain.find(x => x.id === cur.supersededBy);
          if (!nxt) break;
          cur = nxt;
        }
        if (cur && cur.id !== hit.quoteId) hit = {
          ...hit,
          quoteId: cur.id
        };
      }
      setResolved(hit);
      var list = readQuotes(hit.oppId);
      var next = list.map(q => q.id === hit.quoteId ? {
        ...q,
        viewedAt: new Date().toISOString(),
        viewCount: (q.viewCount || 0) + 1,
        status: q.status === "sent" ? "viewed" : q.status
      } : q);
      writeQuotes(hit.oppId, next);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);
  if (notFound) {
    return React.createElement("div", {
      className: "cn-loading"
    }, React.createElement("div", {
      style: {
        textAlign: "center"
      }
    }, React.createElement("h2", {
      style: {
        fontFamily: "var(--cn-serif)",
        fontSize: 32,
        marginBottom: 8
      }
    }, "Quote not found"), React.createElement("p", {
      style: {
        color: "var(--cn-mute)"
      }
    }, "This link may have expired or the quote was deleted.")));
  }
  if (!resolved) return React.createElement("div", {
    className: "cn-loading"
  }, React.createElement("div", {
    className: "cn-loading-text"
  }, "Loading quote\u2026"));
  var q = resolved.quote;
  var total = quoteTotal(q);
  var preparer = (window.REPS || []).find(r => r.id === q.preparedBy);
  var decided = q.status === "accepted" || q.status === "declined";
  var expired = quoteIsExpired(q);
  var recordDecision = (status, extra = {}) => {
    var list = readQuotes(resolved.oppId);
    var prevQuote = list.find(x => x.id === resolved.quoteId);
    var prevStatus = prevQuote?.status || "sent";
    var next = list.map(x => x.id === resolved.quoteId ? {
      ...x,
      status,
      decidedAt: new Date().toISOString(),
      ...extra
    } : x);
    writeQuotes(resolved.oppId, next);
    setResolved({
      ...resolved,
      quote: next.find(x => x.id === resolved.quoteId)
    });
    setDecision(status);
    if (status === "accepted") {
      try {
        var acceptedQuote = next.find(x => x.id === resolved.quoteId);
        var _total = quoteTotal(acceptedQuote);
        try {
          if (window.sendDocumentCopy) {
            var preparerRep = (window.REPS || []).find(r => r.id === acceptedQuote.preparedBy);
            var docLike = {
              docNumber: acceptedQuote.quoteNumber,
              buyerName: acceptedQuote.billToName || "",
              buyerContactEmail: acceptedQuote.attentionEmail || "",
              billToName: acceptedQuote.billToName || "",
              billToEmail: acceptedQuote.attentionEmail || "",
              buyerSignedName: extra?.acceptedBy || acceptedQuote.attentionName || "",
              buyerSignedDate: window.cnDay(),
              sellerEmail: preparerRep?.email || "",
              currency: acceptedQuote.currency || "USD",
              lineItems: acceptedQuote.lineItems || []
            };
            window.sendDocumentCopy({
              kind: "quote",
              doc: docLike,
              shareUrl: window.location.href
            }).catch(() => {});
          }
        } catch {}
        var isGpuQuote = !!(window.cnGpuQuotes && window.cnGpuQuotes.isGpu(acceptedQuote));
        // Acceptance opens the delivery track; it does not win the deal.
        if (isGpuQuote && window.cnGpuTrack) window.cnGpuTrack.onAccepted(resolved.oppId, acceptedQuote);
        // The operator statement is drafted here so the commission is aligned
        // before go-live; the rep reviews and sends it.
        if (isGpuQuote && window.cnOpCommission) {
          try { window.cnOpCommission.createFromQuote(resolved.oppId, acceptedQuote); } catch (e) { console.warn("commission draft failed", e); }
        }
        var pending = JSON.parse(localStorage.getItem("cn-pending-sales") || "[]");
        pending.push({
          id: "ps-" + Math.random().toString(36).slice(2, 10),
          gpuaas: isGpuQuote,
          oppId: resolved.oppId,
          quoteId: resolved.quoteId,
          quoteNumber: acceptedQuote.quoteNumber,
          quoteVersion: acceptedQuote.version,
          accountName: acceptedQuote.billToName || "",
          contactName: acceptedQuote.attentionName || "",
          totalCents: Math.round(_total * 100),
          prevQuoteStatus: prevStatus,
          at: new Date().toISOString(),
          processed: false
        });
        localStorage.setItem("cn-pending-sales", JSON.stringify(pending));
      } catch (e) {
        console.warn("Failed to queue sale notification:", e);
      }
    }
  };
  // GPUaaS proposals render their own document (spec-led, not a line-item
  // table) but share this view's tracking, supersede chain and decision path.
  if (window.cnGpuQuotes && window.cnGpuQuotes.isGpu(q)) {
    return window.cnGpuQuotes.sharePageEl({
      quote: q,
      preparer: preparer,
      decided: decided,
      decision: decision,
      expired: expired,
      onDecide: recordDecision
    });
  }
  return React.createElement("div", {
    className: "cn-share-page"
  }, React.createElement("div", {
    className: "cn-share-toolbar"
  }, React.createElement("div", {
    className: "cn-share-toolbar-brand"
  }, React.createElement("span", {
    className: "cn-brand-name",
    style: {
      fontSize: 14,
      color: "var(--cn-ink)"
    }
  }, window.CN_BRAND && window.CN_BRAND.name || "Chief Negotiators"), React.createElement("span", {
    className: "cn-brand-sub"
  }, "Quote \xB7 ", q.quoteNumber)), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => window.print()
  }, "\u2913 Save as PDF"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => window.print()
  }, "Print"))), React.createElement("article", {
    className: "cn-quote-doc"
  }, React.createElement("header", {
    className: "cn-qd-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-qd-brand"
  }, window.CN_BRAND && window.CN_BRAND.name || "Chief Negotiators"), React.createElement("div", {
    className: "cn-qd-tag"
  }, window.CN_BRAND && window.CN_BRAND.docTagline || "Procurement & Sourcing")), React.createElement("div", {
    className: "cn-qd-stamp"
  }, React.createElement("div", {
    className: "cn-qd-stamp-label"
  }, "Quotation"), React.createElement("div", {
    className: "cn-qd-stamp-num cn-mono"
  }, q.quoteNumber), React.createElement("div", {
    className: "cn-qd-stamp-meta"
  }, React.createElement("div", null, React.createElement("span", null, "Issued"), React.createElement("span", {
    className: "cn-mono"
  }, q.issueDate)), React.createElement("div", null, React.createElement("span", null, "Expires"), React.createElement("span", {
    className: "cn-mono"
  }, q.expiresDate)), React.createElement("div", null, React.createElement("span", null, "Version"), React.createElement("span", {
    className: "cn-mono"
  }, "v", q.version))))), React.createElement("div", {
    className: "cn-qd-parties"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-qd-eyebrow"
  }, "Bill to"), React.createElement("div", {
    className: "cn-qd-party-name"
  }, q.billToName), React.createElement("div", {
    className: "cn-qd-party-addr"
  }, q.billToAddress), q.attentionName && React.createElement("div", {
    className: "cn-qd-party-attn"
  }, React.createElement("div", {
    className: "cn-qd-eyebrow",
    style: {
      marginTop: 10
    }
  }, "Attention"), q.attentionName, q.attentionEmail && React.createElement("span", {
    className: "cn-mono",
    style: {
      color: "var(--cn-mute)",
      marginLeft: 6
    }
  }, "\xB7 ", q.attentionEmail))), React.createElement("div", null, React.createElement("div", {
    className: "cn-qd-eyebrow"
  }, "Reference"), React.createElement("div", null, q.reference || "—"), preparer && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-qd-eyebrow",
    style: {
      marginTop: 10
    }
  }, "Prepared by"), React.createElement("div", null, preparer.name, preparer.email && React.createElement("span", {
    className: "cn-mono",
    style: {
      color: "var(--cn-mute)",
      marginLeft: 6
    }
  }, "\xB7 ", preparer.email))))), React.createElement("table", {
    className: "cn-qd-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Mfr Part Number"), React.createElement("th", {
    style: {
      width: 70,
      textAlign: "right"
    }
  }, "Qty"), React.createElement("th", {
    style: {
      width: 160
    }
  }, "Condition"), React.createElement("th", {
    style: {
      width: 130,
      textAlign: "right"
    }
  }, "Price / unit"), React.createElement("th", {
    style: {
      width: 140,
      textAlign: "right"
    }
  }, "Total"))), React.createElement("tbody", null, q.lineItems.map(li => React.createElement("tr", {
    key: li.id
  }, React.createElement("td", null, React.createElement("div", {
    className: "cn-mono cn-qd-pn"
  }, li.partNumber || "—"), li.description && React.createElement("div", {
    className: "cn-qd-desc"
  }, li.description)), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, li.qty), React.createElement("td", null, li.condition), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, fmtCurrency(li.unitPrice)), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, fmtCurrency(lineTotal(li)))))), React.createElement("tfoot", null, React.createElement("tr", null, React.createElement("td", {
    colSpan: 4,
    style: {
      textAlign: "right"
    }
  }, "Total"), React.createElement("td", {
    className: "cn-mono cn-qd-grand",
    style: {
      textAlign: "right"
    }
  }, fmtCurrency(total))))), q.notes && React.createElement("section", {
    className: "cn-qd-notes"
  }, React.createElement("div", {
    className: "cn-qd-eyebrow"
  }, "Notes"), React.createElement("p", null, q.notes)), q.terms && React.createElement("section", {
    className: "cn-qd-terms"
  }, React.createElement("div", {
    className: "cn-qd-eyebrow"
  }, "Terms & conditions"), React.createElement("p", null, q.terms)), React.createElement("footer", {
    className: "cn-qd-foot"
  }, React.createElement("div", {
    className: "cn-qd-foot-top"
  }, React.createElement("div", null, "Thank you for the opportunity."), React.createElement("div", {
    className: "cn-mono",
    style: {
      color: "var(--cn-mute)"
    }
  }, q.quoteNumber, " \xB7 v", q.version, " \xB7 ", q.issueDate)), (() => {
    var b = window.CN_BRAND || {};
    return React.createElement("div", {
      className: "cn-qd-foot-brand"
    }, React.createElement("div", {
      className: "cn-qd-foot-name"
    }, b.name || "Chief Negotiators"), b.docTagline && React.createElement("div", {
      className: "cn-qd-foot-tag"
    }, b.docTagline));
  })()), !decided && !decision && !expired && React.createElement("section", {
    className: "cn-qd-decision"
  }, !showDecline ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-qd-decision-lead"
  }, React.createElement("div", {
    className: "cn-qd-eyebrow"
  }, "Your response"), React.createElement("div", {
    className: "cn-qd-decision-text"
  }, "Ready to move forward? Accept to confirm this quote, or let us know if changes are needed.")), React.createElement("div", {
    className: "cn-qd-decision-actions"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setShowDecline(true)
  }, "Decline"), React.createElement("button", {
    className: "cn-btn cn-btn--win",
    onClick: () => recordDecision("accepted")
  }, "\u2713 Accept quote"))) : React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    className: "cn-qd-eyebrow",
    style: {
      marginBottom: 6
    }
  }, "Decline this quote"), React.createElement("textarea", {
    className: "cn-textarea",
    value: declineReason,
    onChange: e => setDeclineReason(e.target.value),
    placeholder: "Optional: what didn't work? (pricing, lead time, condition, etc.)",
    style: {
      minHeight: 70
    }
  })), React.createElement("div", {
    className: "cn-qd-decision-actions"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => {
      setShowDecline(false);
      setDeclineReason("");
    }
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--lose",
    onClick: () => recordDecision("declined", {
      declineReason: declineReason.trim() || null
    })
  }, "Submit decline")))), !decided && !decision && expired && React.createElement("section", {
    className: "cn-qd-expired-banner"
  }, React.createElement("div", {
    className: "cn-qd-expired-ic"
  }, "!"), React.createElement("div", null, "This quote expired on ", React.createElement("b", null, q.expiresDate), " and can no longer be accepted online. Please reach out and we'll send you a refreshed quote.")), (decided || decision) && React.createElement("section", {
    className: `cn-qd-decided cn-qd-decided--${q.status}`
  }, React.createElement("div", {
    className: "cn-qd-decided-icon"
  }, q.status === "accepted" ? "✓" : "✕"), React.createElement("div", null, React.createElement("div", {
    className: "cn-qd-decided-title"
  }, q.status === "accepted" ? "Quote accepted" : "Quote declined"), React.createElement("div", {
    className: "cn-qd-decided-sub"
  }, q.status === "accepted" ? React.createElement(React.Fragment, null, "Confirmed ", timeAgo(q.decidedAt), ". We'll be in touch to finalize next steps.") : React.createElement(React.Fragment, null, "Recorded ", timeAgo(q.decidedAt), ".", q.declineReason && React.createElement(React.Fragment, null, " Note: \u201C", q.declineReason, "\u201D")))))));
}
Object.assign(window, {
  QuotesSection,
  QuoteBuilderModal,
  QuoteShareModal,
  QuoteShareView,
  quoteTotal
});
function QuoteDuplicateModal({
  source,
  scenario,
  currentUser,
  onClose,
  onDuplicated
}) {
  var src = source.quote;
  var [targetOppId, setTargetOppId] = useState("");
  var [openAfter, setOpenAfter] = useState(true);
  var oppOptions = useMemo(() => {
    var accountById = Object.fromEntries((scenario.accounts || []).map(a => [a.id, a]));
    return (scenario.opps || []).filter(o => o.stage !== "won" && o.stage !== "lost").map(o => {
      var acct = accountById[o.accountId];
      var isCurrent = o.id === source.opp.id;
      return {
        value: o.id,
        label: o.title + (isCurrent ? " (current deal)" : ""),
        subtext: acct?.name || "—"
      };
    });
  }, [scenario, source.opp.id]);
  var target = (scenario.opps || []).find(o => o.id === targetOppId);
  var targetAccount = target ? window.accountOf(target.accountId, scenario) : null;
  var targetContact = target ? (scenario.contacts || []).find(c => c.id === target.contactId) : null;
  var doDuplicate = () => {
    if (!target) return;
    var today = new Date();
    var expires = new Date(today.getTime() + QUOTE_VALID_DAYS * 86400000);
    var existing = readQuotes(target.id);
    var newQ = {
      ...src,
      id: newId("q"),
      version: (existing[0]?.version || 0) + 1,
      quoteNumber: "Q-" + today.getFullYear() + "-" + String(Math.floor(Math.random() * 9000) + 1000),
      issueDate: window.cnDay(today),
      expiresDate: window.cnDay(expires),
      reference: target.title || src.reference || "",
      billToName: targetAccount?.name || "",
      billToAddress: targetAccount?.hq || "",
      attentionName: targetContact?.name || "",
      attentionEmail: targetContact?.email || "",
      preparedBy: currentUser?.id || src.preparedBy || null,
      lineItems: (src.lineItems || []).map(li => ({
        ...li,
        id: newId("li")
      })),
      notes: src.notes || "",
      terms: src.terms || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sentAt: null,
      viewedAt: null,
      viewCount: 0,
      decidedAt: null,
      declineReason: null,
      shareToken: "qt-" + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 8),
      status: "draft"
    };
    writeQuotes(target.id, [newQ, ...existing]);
    if (window.cnToast) window.cnToast({
      title: `Quote duplicated to ${targetAccount?.name || target.title}`,
      sub: `${newQ.quoteNumber} created as a draft`
    });
    onDuplicated && onDuplicated({
      quote: newQ,
      opp: target,
      account: targetAccount,
      contact: targetContact
    }, openAfter);
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
      width: 560
    }
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Duplicate quote"), React.createElement("h2", {
    className: "cn-modal-title"
  }, src.quoteNumber)), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-dup-source"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Copying"), React.createElement("div", {
    className: "cn-dup-source-row"
  }, React.createElement("span", null, (src.lineItems || []).length, " line item", (src.lineItems || []).length === 1 ? "" : "s", " \xB7 notes & terms"), React.createElement("span", {
    className: "cn-mono",
    style: {
      fontWeight: 500
    }
  }, fmtCurrency(quoteTotal(src)))), React.createElement("div", {
    className: "cn-field-help",
    style: {
      marginTop: 6
    }
  }, "From ", React.createElement("strong", null, source.account?.name || src.billToName || "—"), " \xB7 ", source.opp.title)), React.createElement("div", {
    className: "cn-field",
    style: {
      marginTop: 18
    }
  }, React.createElement("label", null, "Duplicate to deal"), React.createElement(window.SearchableSelect, {
    value: targetOppId,
    onChange: setTargetOppId,
    options: oppOptions,
    placeholder: "Search deals by title or account\u2026"
  }), React.createElement("div", {
    className: "cn-field-help"
  }, "Bill-to and attention will be set from this deal's account and contact.")), target && React.createElement("div", {
    className: "cn-dup-preview"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "New quote will be addressed to"), React.createElement("div", {
    className: "cn-dup-preview-name"
  }, targetAccount?.name || "—"), React.createElement("div", {
    className: "cn-dup-preview-sub"
  }, targetContact?.name || "No primary contact", targetContact?.email && React.createElement("span", {
    className: "cn-mono",
    style: {
      color: "var(--cn-mute)",
      marginLeft: 6
    }
  }, "\xB7 ", targetContact.email))), React.createElement("label", {
    className: "cn-dup-openafter"
  }, React.createElement("input", {
    type: "checkbox",
    checked: openAfter,
    onChange: e => setOpenAfter(e.target.checked)
  }), React.createElement("span", null, "Open the new draft to edit right away"))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: doDuplicate,
    disabled: !target
  }, "Duplicate quote \u2192"))));
}
function QuotesScreen({
  scenario,
  currentUser,
  onOpenOpp
}) {
  var [tick, setTick] = useState(0);
  var [filter, setFilter] = useState("all");
  var [search, setSearch] = useState("");
  var [editing, setEditing] = useState(null);
  var [sharing, setSharing] = useState(null);
  var [duplicating, setDuplicating] = useState(null);
  var refresh = () => setTick(n => n + 1);
  var [hydrating, setHydrating] = useState(true);
  useEffect(() => {
    var cancelled = false;
    (async () => {
      try {
        if (!window.loadCompanyDocs || !window.mergeDocLists) return;
        var server = await window.loadCompanyDocs("quote");
        if (cancelled || !server || server.length === 0) return;
        var byOpp = {};
        for (var d of server) {
          if (!d || !d.oppId) continue;
          (byOpp[d.oppId] = byOpp[d.oppId] || []).push(d);
        }
        var anyChanged = false;
        for (var oid in byOpp) {
          var {
            merged,
            changed
          } = window.mergeDocLists(readQuotes(oid), byOpp[oid]);
          if (changed > 0) {
            writeQuotes(oid, merged.map(({
              oppId,
              ...q
            }) => q));
            anyChanged = true;
          }
        }
        if (anyChanged && !cancelled) refresh();
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  var allQuotes = useMemo(() => {
    var opps = scenario.opps || [];
    var accountById = Object.fromEntries((scenario.accounts || []).map(a => [a.id, a]));
    var contactById = Object.fromEntries((scenario.contacts || []).map(c => [c.id, c]));
    var out = [];
    for (var opp of opps) {
      if (opp.stage === "won" || opp.stage === "lost") continue;
      var list = readQuotes(opp.id);
      for (var q of list) {
        out.push({
          quote: q,
          opp,
          account: accountById[opp.accountId || opp.account_id] || null,
          contact: contactById[opp.contactId || opp.contact_id] || null
        });
      }
    }
    out.sort((a, b) => {
      var ta = new Date(a.quote.updatedAt || a.quote.createdAt || 0).getTime();
      var tb = new Date(b.quote.updatedAt || b.quote.createdAt || 0).getTime();
      return tb - ta;
    });
    return out;
  }, [scenario, tick]);
  var counts = useMemo(() => {
    var c = {
      all: allQuotes.length,
      draft: 0,
      sent: 0,
      viewed: 0,
      accepted: 0,
      declined: 0,
      expired: 0
    };
    allQuotes.forEach(({
      quote
    }) => {
      var s = quote.status || "draft";
      if (c[s] != null) c[s]++;
      if (quoteIsExpired(quote)) c.expired++;
    });
    return c;
  }, [allQuotes]);
  var visible = useMemo(() => {
    var needle = search.trim().toLowerCase();
    return allQuotes.filter(({
      quote,
      opp,
      account,
      contact
    }) => {
      if (filter === "expired") {
        if (!quoteIsExpired(quote)) return false;
      } else if (filter !== "all" && (quote.status || "draft") !== filter) return false;
      if (!needle) return true;
      var hay = [quote.quoteNumber, quote.billToName, quote.attentionName, quote.attentionEmail, opp.title, account?.name, contact?.name, ...(quote.lineItems || []).map(li => `${li.partNumber} ${li.description}`)].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [allQuotes, filter, search]);
  var totals = useMemo(() => {
    var sum = visible.reduce((s, {
      quote
    }) => s + quoteTotal(quote), 0);
    var wonSum = visible.filter(v => v.quote.status === "accepted").reduce((s, {
      quote
    }) => s + quoteTotal(quote), 0);
    var openSum = visible.filter(v => ["draft", "sent", "viewed"].includes(v.quote.status || "draft")).reduce((s, {
      quote
    }) => s + quoteTotal(quote), 0);
    return {
      sum,
      wonSum,
      openSum
    };
  }, [visible]);
  var handleEditPatch = patch => {
    if (!editing) return;
    var list = readQuotes(editing.opp.id);
    var next = list.map(q => q.id === editing.quote.id ? {
      ...q,
      ...patch,
      updatedAt: new Date().toISOString()
    } : q);
    writeQuotes(editing.opp.id, next);
    var updatedQuote = next.find(q => q.id === editing.quote.id);
    setEditing({
      ...editing,
      quote: updatedQuote
    });
    refresh();
  };
  var handleShareUpdate = patch => {
    if (!sharing) return;
    var list = readQuotes(sharing.opp.id);
    var next = list.map(q => q.id === sharing.quote.id ? {
      ...q,
      ...patch,
      updatedAt: new Date().toISOString()
    } : q);
    writeQuotes(sharing.opp.id, next);
    var updatedQuote = next.find(q => q.id === sharing.quote.id);
    setSharing({
      ...sharing,
      quote: updatedQuote
    });
    refresh();
  };
  var handleDelete = () => {
    if (!editing) return;
    if (!confirm(`Delete quote ${editing.quote.quoteNumber}? This cannot be undone.`)) return;
    var next = readQuotes(editing.opp.id).filter(q => q.id !== editing.quote.id);
    writeQuotes(editing.opp.id, next);
    setEditing(null);
    refresh();
  };
  var FILTERS = [{
    id: "all",
    label: "All"
  }, {
    id: "draft",
    label: "Drafts"
  }, {
    id: "sent",
    label: "Sent"
  }, {
    id: "viewed",
    label: "Viewed"
  }, {
    id: "accepted",
    label: "Accepted"
  }, {
    id: "declined",
    label: "Declined"
  }, {
    id: "expired",
    label: "Expired"
  }];
  return React.createElement("div", {
    className: "cn-page"
  }, React.createElement("div", {
    className: "cn-toolbar"
  }, React.createElement("div", {
    className: "cn-tabs"
  }, FILTERS.map(f => React.createElement("button", {
    key: f.id,
    className: `cn-tab ${filter === f.id ? "is-active" : ""}`,
    onClick: () => setFilter(f.id)
  }, f.label, React.createElement("span", {
    className: "cn-tab-count"
  }, counts[f.id] ?? 0)))), React.createElement("div", {
    className: "cn-toolbar-right"
  }, React.createElement("input", {
    className: "cn-input",
    style: {
      width: 280,
      height: 32
    },
    placeholder: "Search quotes, deals, parts\u2026",
    value: search,
    onChange: e => setSearch(e.target.value)
  }))), React.createElement("div", {
    className: "cn-quotes-summary"
  }, React.createElement("div", {
    className: "cn-quotes-summary-cell"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Total quoted"), React.createElement("div", {
    className: "cn-quotes-summary-num cn-mono"
  }, fmtCurrency(totals.sum)), React.createElement("div", {
    className: "cn-quotes-summary-sub"
  }, visible.length, " quote", visible.length === 1 ? "" : "s")), React.createElement("div", {
    className: "cn-quotes-summary-cell"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Open pipeline"), React.createElement("div", {
    className: "cn-quotes-summary-num cn-mono"
  }, fmtCurrency(totals.openSum)), React.createElement("div", {
    className: "cn-quotes-summary-sub"
  }, "Draft \xB7 sent \xB7 viewed")), React.createElement("div", {
    className: "cn-quotes-summary-cell"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Accepted"), React.createElement("div", {
    className: "cn-quotes-summary-num cn-mono",
    style: {
      color: "var(--cn-pos)"
    }
  }, fmtCurrency(totals.wonSum)), React.createElement("div", {
    className: "cn-quotes-summary-sub"
  }, "Closed\u2011won via quote"))), visible.length === 0 ? React.createElement("div", {
    className: "cn-quote-empty",
    style: {
      marginTop: 24
    }
  }, React.createElement("div", {
    className: "cn-quote-empty-icon"
  }, "\u2263"), React.createElement("div", null, React.createElement("div", {
    style: {
      fontWeight: 500,
      marginBottom: 4
    }
  }, hydrating ? "Loading quotes…" : allQuotes.length === 0 ? "No quotes yet" : "No quotes match this filter"), React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12.5
    }
  }, hydrating ? "Syncing quotes saved across your deals and devices." : allQuotes.length === 0 ? "Quotes you build inside a deal will appear here automatically." : "Try a different status or clear the search."))) : React.createElement("div", {
    className: "cn-quotes-table-wrap"
  }, React.createElement("table", {
    className: "cn-quotes-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Quote"), React.createElement("th", null, "Deal \xB7 Account"), React.createElement("th", null, "Recipient"), React.createElement("th", {
    className: "cn-li-right"
  }, "Total"), React.createElement("th", null, "Status"), React.createElement("th", null, "Last activity"), React.createElement("th", {
    style: {
      width: 290
    }
  }, "Actions"))), React.createElement("tbody", null, visible.map(({
    quote,
    opp,
    account,
    contact
  }) => {
    var lastAt = quote.viewedAt || quote.sentAt || quote.updatedAt || quote.createdAt;
    var lastLabel = quote.viewedAt ? `Viewed ${timeAgo(quote.viewedAt)}` : quote.sentAt ? `Sent ${timeAgo(quote.sentAt)}` : `Updated ${timeAgo(quote.updatedAt || quote.createdAt)}`;
    return React.createElement("tr", {
      key: quote.id
    }, React.createElement("td", null, React.createElement("div", {
      className: "cn-mono",
      style: {
        fontWeight: 500
      }
    }, quote.quoteNumber), React.createElement("div", {
      style: {
        color: "var(--cn-mute)",
        fontSize: 12
      }
    }, window.cnGpuQuotes && window.cnGpuQuotes.isGpu(quote) ? `v${quote.version} · GPUaaS · ${(quote.gpu?.gpuCount || 0).toLocaleString()} GPUs · ${window.cnGpuQuotes.termLabel(quote)}` : `v${quote.version} · ${quote.lineItems?.length || 0} line${quote.lineItems?.length === 1 ? "" : "s"}`)), React.createElement("td", null, React.createElement("button", {
      className: "cn-link",
      onClick: () => onOpenOpp(opp.id),
      style: {
        textAlign: "left",
        padding: 0
      }
    }, opp.title), React.createElement("div", {
      style: {
        color: "var(--cn-mute)",
        fontSize: 12
      }
    }, account?.name || quote.billToName || "—")), React.createElement("td", null, React.createElement("div", null, contact?.name || quote.attentionName || "—"), React.createElement("div", {
      className: "cn-mono",
      style: {
        color: "var(--cn-mute)",
        fontSize: 12
      }
    }, contact?.email || quote.attentionEmail || "")), React.createElement("td", {
      className: "cn-li-right cn-mono",
      style: {
        fontWeight: 500
      }
    }, fmtCurrency(quoteTotal(quote))), React.createElement("td", null, React.createElement(QuoteStatus, {
      quote: quote
    })), React.createElement("td", null, React.createElement("div", {
      style: {
        fontSize: 12.5
      }
    }, lastLabel), React.createElement("div", {
      className: "cn-mono",
      style: {
        color: "var(--cn-mute)",
        fontSize: 11.5
      }
    }, lastAt ? new Date(lastAt).toLocaleDateString() : "")), React.createElement("td", null, React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        flexWrap: "wrap"
      }
    }, React.createElement("button", {
      className: "cn-btn cn-btn--ghost",
      style: {
        height: 28,
        padding: "4px 10px",
        fontSize: 12
      },
      onClick: () => setEditing({
        opp,
        account,
        contact,
        quote
      })
    }, "Edit"), React.createElement("button", {
      className: "cn-btn cn-btn--ghost",
      style: {
        height: 28,
        padding: "4px 10px",
        fontSize: 12
      },
      onClick: () => setSharing({
        opp,
        account,
        contact,
        quote
      })
    }, quote.sentAt ? "Re-send" : "Send"), React.createElement("button", {
      className: "cn-btn cn-btn--ghost",
      style: {
        height: 28,
        padding: "4px 10px",
        fontSize: 12
      },
      onClick: () => setDuplicating({
        opp,
        account,
        contact,
        quote
      }),
      title: "Duplicate this quote to another customer"
    }, "\u29C9 Duplicate"), React.createElement("button", {
      className: "cn-btn cn-btn--ghost",
      style: {
        height: 28,
        padding: "4px 10px",
        fontSize: 12
      },
      onClick: () => onOpenOpp(opp.id),
      title: "Open deal"
    }, "\u2197 Deal"))));
  })))), editing && (window.cnGpuQuotes && window.cnGpuQuotes.isGpu(editing.quote) ? window.cnGpuQuotes.editorEl({
    quote: editing.quote,
    opp: editing.opp,
    account: editing.account,
    contact: editing.contact,
    onSave: q2 => handleEditPatch(q2),
    onClose: () => setEditing(null),
    onDelete: handleDelete,
    onShare: () => {
      setSharing(editing);
      setEditing(null);
    }
  }) : React.createElement(QuoteBuilderModal, {
    quote: editing.quote,
    opp: editing.opp,
    account: editing.account,
    contact: editing.contact,
    onChange: handleEditPatch,
    onClose: () => setEditing(null),
    onDelete: handleDelete,
    onShare: () => {
      setSharing(editing);
      setEditing(null);
    }
  })), sharing && React.createElement(QuoteShareModal, {
    quote: sharing.quote,
    opp: sharing.opp,
    account: sharing.account,
    contact: sharing.contact,
    onClose: () => setSharing(null),
    onUpdate: handleShareUpdate
  }), duplicating && React.createElement(QuoteDuplicateModal, {
    source: duplicating,
    scenario: scenario,
    currentUser: currentUser,
    onClose: () => setDuplicating(null),
    onDuplicated: (created, openAfter) => {
      setDuplicating(null);
      refresh();
      if (openAfter) setEditing(created);
    }
  }));
}
Object.assign(window, {
  QuotesScreen
});