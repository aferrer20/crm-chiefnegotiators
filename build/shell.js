var {
  useState,
  useEffect,
  useMemo,
  useRef,
  Fragment
} = React;
window.Fragment = Fragment;
window.__cnToastListeners = window.__cnToastListeners || [];
window.cnToast = function (input) {
  var t = typeof input === "string" ? {
    title: input
  } : input || {};
  var item = {
    id: Math.random().toString(36).slice(2),
    kind: "success",
    ...t
  };
  window.__cnToastListeners.forEach(fn => fn(item));
};
function ToastHost() {
  var [items, setItems] = useState([]);
  useEffect(() => {
    var handler = it => {
      setItems(list => [...list, it]);
      setTimeout(() => setItems(list => list.filter(x => x.id !== it.id)), it.duration || 5200);
    };
    window.__cnToastListeners.push(handler);
    return () => {
      var i = window.__cnToastListeners.indexOf(handler);
      if (i >= 0) window.__cnToastListeners.splice(i, 1);
    };
  }, []);
  var dismiss = id => setItems(list => list.filter(x => x.id !== id));
  if (items.length === 0) return null;
  return React.createElement("div", {
    className: "cn-toast-stack"
  }, items.map(t => React.createElement("div", {
    key: t.id,
    className: `cn-toast cn-toast--${t.kind || "success"}`,
    role: "status",
    "aria-live": "polite"
  }, React.createElement("span", {
    className: `cn-toast-tick cn-toast-tick--${t.kind || "success"}`
  }, t.kind === "error" ? "!" : "✓"), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    className: "cn-toast-title"
  }, t.title), t.sub && React.createElement("div", {
    className: "cn-toast-sub"
  }, t.sub)), React.createElement("button", {
    className: "cn-toast-x",
    onClick: () => dismiss(t.id),
    "aria-label": "Dismiss"
  }, "\u2715"))));
}
window.ToastHost = ToastHost;
window.cnCopy = async function (text, label) {
  var value = (text == null ? "" : String(text)).trim();
  if (!value) return;
  var confirmCopy = () => window.cnToast && window.cnToast({
    title: "Copied to clipboard",
    sub: (label ? label + " · " : "") + value
  });
  try {
    await navigator.clipboard.writeText(value);
    confirmCopy();
    return;
  } catch {}
  try {
    var ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    confirmCopy();
  } catch (e) {
    window.cnToast && window.cnToast({
      title: "Couldn't copy",
      sub: value,
      kind: "error"
    });
  }
};
function SaleBannerHost({
  scenario,
  currentUser,
  onReload
}) {
  var [banners, setBanners] = useState([]);
  var processingRef = useRef(false);
  var fmtMoney = cents => {
    var v = (cents || 0) / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(v);
  };
  var processPending = async () => {
    if (processingRef.current) return;
    var pending;
    try {
      pending = JSON.parse(localStorage.getItem("cn-pending-sales") || "[]");
    } catch {
      pending = [];
    }
    var unprocessed = pending.filter(p => !p.processed);
    if (unprocessed.length === 0) return;
    processingRef.current = true;
    var newBanners = [];
    var _loop = async function (p) {
      try {
        var opp = scenario?.opps?.find(o => o.id === p.oppId);
        var prevStage = opp?.stage || null;
        var prevValueCents = opp ? Math.round((opp.value || 0) * 100) : null;
        // A GPUaaS acceptance books the contract value but does NOT win the
        // deal: that happens when the down payment lands (see cnGpuTrack).
        if (opp && window.updateOpportunity) {
          await window.updateOpportunity(p.oppId, p.gpuaas ? {
            value_cents: p.totalCents
          } : {
            stage: "won",
            value_cents: p.totalCents
          });
        }
        var activityId = null;
        if (opp && window.insertActivity) {
          var a = await window.insertActivity({
            type: p.gpuaas ? "note" : "won",
            owner_id: opp.ownerId || currentUser?.id || null,
            contact_id: opp.contactId || null,
            opportunity_id: opp.id,
            subject: p.gpuaas ? `GPUaaS quote ${p.quoteNumber || ""} accepted — MSA/SLA next` : `Quote ${p.quoteNumber || ""} accepted — deal won`,
            summary: `${p.accountName || "Customer"} accepted v${p.quoteVersion || ""} for ${fmtMoney(p.totalCents)}.` + (p.gpuaas ? " Contract value booked; deal is Won when the down payment is received." : ""),
            occurred_at: new Date().toISOString()
          });
          activityId = a?.id || null;
        }
        newBanners.push({
          id: p.id,
          accountName: p.accountName || "A customer",
          contactName: p.contactName || "",
          quoteNumber: p.quoteNumber || "",
          totalCents: p.totalCents || 0,
          oppId: p.oppId,
          quoteId: p.quoteId,
          activityId,
          prevStage,
          prevValueCents,
          prevQuoteStatus: p.prevQuoteStatus || "sent",
          undone: false
        });
        p.processed = true;
      } catch (err) {
        console.error("Failed to process pending sale:", err);
        p.processed = true;
      }
    };
    for (var p of unprocessed) {
      await _loop(p);
    }
    var remaining = pending.filter(p => !p.processed);
    localStorage.setItem("cn-pending-sales", JSON.stringify(remaining));
    processingRef.current = false;
    if (newBanners.length) {
      setBanners(bs => [...newBanners, ...bs]);
      onReload && onReload();
    }
  };
  useEffect(() => {
    processPending();
    var onStorage = e => {
      if (e.key === "cn-pending-sales") processPending();
    };
    var onFocus = () => processPending();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    var id = setInterval(processPending, 4000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
    };
  }, [scenario?.opps?.length]);
  var dismiss = id => setBanners(bs => bs.filter(b => b.id !== id));
  var undo = async b => {
    if (b.undone) return;
    try {
      if (window.updateOpportunity && b.prevStage) {
        await window.updateOpportunity(b.oppId, {
          stage: b.prevStage,
          ...(b.prevValueCents != null ? {
            value_cents: b.prevValueCents
          } : {})
        });
      }
      if (b.activityId && window.deleteActivity) {
        try {
          await window.deleteActivity(b.activityId);
        } catch (e) {
          console.warn("delete activity failed", e);
        }
      }
      try {
        var all = window.cnQuotes?.readQuotes?.(b.oppId) || [];
        var reverted = all.map(q => q.id === b.quoteId ? {
          ...q,
          status: b.prevQuoteStatus || "sent",
          decidedAt: null
        } : q);
        window.cnQuotes?.writeQuotes?.(b.oppId, reverted);
      } catch (e) {
        console.warn("revert quote failed", e);
      }
      setBanners(bs => bs.map(x => x.id === b.id ? {
        ...x,
        undone: true
      } : x));
      onReload && onReload();
      window.cnToast && window.cnToast({
        title: "Sale undone",
        sub: `${b.accountName} reverted to ${b.prevStage}`
      });
      setTimeout(() => dismiss(b.id), 2200);
    } catch (e) {
      alert("Undo failed: " + (e.message || e));
    }
  };
  if (banners.length === 0) return null;
  return React.createElement("div", {
    className: "cn-sale-stack",
    role: "status",
    "aria-live": "polite"
  }, banners.map(b => React.createElement("div", {
    key: b.id,
    className: `cn-sale-banner ${b.undone ? "is-undone" : ""}`
  }, React.createElement("div", {
    className: "cn-sale-marquee",
    "aria-hidden": "true"
  }, React.createElement("div", {
    className: "cn-sale-marquee-track"
  }, Array.from({
    length: 8
  }).map((_, i) => React.createElement("span", {
    key: i,
    className: "cn-sale-marquee-item"
  }, React.createElement("span", {
    className: "cn-sale-marquee-icon"
  }, "\u2605"), "You got a sale!", React.createElement("span", {
    className: "cn-sale-marquee-icon"
  }, "\u2605"), b.accountName, " \xB7 ", fmtMoney(b.totalCents))))), React.createElement("div", {
    className: "cn-sale-body"
  }, React.createElement("div", {
    className: "cn-sale-body-left"
  }, React.createElement("div", {
    className: "cn-sale-eyebrow"
  }, b.undone ? "Sale undone" : "Sale closed · moved to Won"), React.createElement("div", {
    className: "cn-sale-headline"
  }, b.undone ? React.createElement(Fragment, null, b.accountName, " reverted") : React.createElement(Fragment, null, b.accountName, " accepted ", b.quoteNumber ? `quote ${b.quoteNumber}` : "your quote", " for ", React.createElement("span", {
    className: "cn-sale-amount"
  }, fmtMoney(b.totalCents)))), b.contactName && !b.undone && React.createElement("div", {
    className: "cn-sale-sub"
  }, "Confirmed by ", b.contactName, " \xB7 logged on the deal timeline")), React.createElement("div", {
    className: "cn-sale-actions"
  }, !b.undone && React.createElement("button", {
    className: "cn-sale-btn cn-sale-btn--ghost",
    onClick: () => undo(b)
  }, "Undo"), React.createElement("button", {
    className: "cn-sale-x",
    onClick: () => dismiss(b.id),
    "aria-label": "Dismiss"
  }, "\u2715"))))));
}
window.SaleBannerHost = SaleBannerHost;
function ShDocBannerHost() {
  var [banners, setBanners] = useState([]);
  var processingRef = useRef(false);
  var fmtMoney = cents => {
    var v = (cents || 0) / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(v);
  };
  var process = () => {
    if (processingRef.current) return;
    var pending;
    try {
      pending = JSON.parse(localStorage.getItem("cn-sh-pending") || "[]");
    } catch {
      pending = [];
    }
    var unprocessed = pending.filter(p => !p.processed);
    if (unprocessed.length === 0) return;
    processingRef.current = true;
    var newOnes = unprocessed.map(p => ({
      id: p.id,
      kind: p.kind,
      docNumber: p.docNumber,
      action: p.action,
      buyerName: p.buyerName || "",
      signedBy: p.signedBy || "",
      totalCents: p.totalCents || 0,
      emailedTo: p.emailedTo || [],
      reference: p.reference || "",
      method: p.method || "",
      reason: p.reason || ""
    }));
    unprocessed.forEach(p => {
      p.processed = true;
    });
    var remaining = pending.filter(p => !p.processed);
    localStorage.setItem("cn-sh-pending", JSON.stringify(remaining));
    processingRef.current = false;
    if (newOnes.length) setBanners(bs => [...newOnes, ...bs]);
  };
  useEffect(() => {
    process();
    var onStorage = e => {
      if (e.key === "cn-sh-pending") process();
    };
    var onFocus = () => process();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    var id = setInterval(process, 3000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
    };
  }, []);
  var dismiss = id => setBanners(bs => bs.filter(b => b.id !== id));
  if (banners.length === 0) return null;
  var kindMeta = {
    loi: {
      label: "Letter of Intent",
      eyebrow: "LOI signed",
      glyph: "✍"
    },
    po: {
      label: "Open PO",
      eyebrow: "Open PO signed",
      glyph: "▤"
    },
    invoice: {
      label: "Invoice",
      eyebrow: "Invoice paid",
      glyph: "$"
    }
  };
  return React.createElement("div", {
    className: "cn-sh-banner-stack",
    role: "status",
    "aria-live": "polite"
  }, banners.map(b => {
    var meta = kindMeta[b.kind] || {
      label: b.kind,
      eyebrow: "Submitted",
      glyph: "✓"
    };
    var declined = b.action === "declined";
    return React.createElement("div", {
      key: b.id,
      className: `cn-sh-banner cn-sh-banner--${declined ? "neg" : "pos"}`
    }, React.createElement("div", {
      className: `cn-sh-banner-glyph cn-sh-banner-glyph--${declined ? "neg" : "pos"}`
    }, declined ? "✕" : meta.glyph), React.createElement("div", {
      className: "cn-sh-banner-body"
    }, React.createElement("div", {
      className: "cn-sh-banner-eyebrow"
    }, declined ? `${meta.label} declined` : meta.eyebrow), React.createElement("div", {
      className: "cn-sh-banner-headline"
    }, declined ? React.createElement(Fragment, null, b.buyerName || "The buyer", " declined ", React.createElement("span", {
      className: "cn-mono"
    }, b.docNumber)) : React.createElement(Fragment, null, b.kind === "invoice" ? React.createElement(Fragment, null, React.createElement("span", {
      className: "cn-mono"
    }, b.docNumber), " \xB7 ", b.buyerName || "Buyer", " paid ", React.createElement("span", {
      className: "cn-sh-banner-amount"
    }, fmtMoney(b.totalCents))) : React.createElement(Fragment, null, b.signedBy || b.buyerName || "The buyer", " signed ", React.createElement("span", {
      className: "cn-mono"
    }, b.docNumber), b.totalCents ? React.createElement(Fragment, null, " \xB7 ", React.createElement("span", {
      className: "cn-sh-banner-amount"
    }, fmtMoney(b.totalCents))) : null))), !declined && b.emailedTo.length > 0 && React.createElement("div", {
      className: "cn-sh-banner-sub"
    }, React.createElement("span", {
      className: "cn-sh-banner-pip"
    }, "\u2709"), "Copies sent to ", React.createElement("span", {
      className: "cn-mono"
    }, b.emailedTo.join(", "))), b.kind === "invoice" && b.reference && React.createElement("div", {
      className: "cn-sh-banner-sub"
    }, "Payment ref ", React.createElement("span", {
      className: "cn-mono"
    }, b.reference), b.method ? ` · ${b.method}` : ""), declined && b.reason && React.createElement("div", {
      className: "cn-sh-banner-sub"
    }, "Reason: ", b.reason)), React.createElement("button", {
      className: "cn-sh-banner-x",
      onClick: () => dismiss(b.id),
      "aria-label": "Dismiss"
    }, "\u2715"));
  }));
}
window.ShDocBannerHost = ShDocBannerHost;
window.makeBackdropHandler = function (isDirty, onClose) {
  return e => {
    if (e.target !== e.currentTarget) return;
    if (typeof isDirty === "function" ? isDirty() : isDirty) {
      if (!confirm("You have unsaved changes. Discard and close?")) return;
    }
    onClose();
  };
};
function KnightMark({
  size = 28,
  color = "#C68352"
}) {
  return React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    fill: "none"
  }, React.createElement("path", {
    d: "M8 27 L24 27 L23 24 L9 24 Z M9 24 L9 21 C9 19 10 18 11.5 17.5 L13 17 L13 14 L11 14 L13 11 L11 11 L14 6 L17 8 L20 7 L22 9 L22 12 L24 14 L23 16 L22 17 L22 24",
    stroke: color,
    strokeWidth: "1.4",
    strokeLinejoin: "round",
    strokeLinecap: "round",
    fill: "none"
  }), React.createElement("circle", {
    cx: "19",
    cy: "11",
    r: "0.6",
    fill: color
  }));
}
function Sidebar({
  view,
  setView,
  scenario,
  currentUser,
  showFinance,
  showBulk,
  showStudio,
  onUserSwitch,
  onSignOut
}) {
  var groups = [{
    section: "Overview",
    items: [{
      id: "dashboard",
      label: "Dashboard",
      icon: "◐"
    }, {
      id: "calendar",
      label: "Calendar",
      icon: "▦"
    }]
  }, {
    section: "Pipeline",
    items: [{
      id: "pipeline",
      label: "Pipeline",
      icon: "▤"
    }, {
      id: "mandates",
      label: "Mandates",
      icon: "◎"
    }, {
      id: "introductions",
      label: "Introductions",
      icon: "‹›"
    }, {
      id: "quotes",
      label: "Quotes",
      icon: "$"
    }, {
      id: "rfq",
      label: "RFQ",
      icon: "⊞"
    }, {
      id: "sales-hub",
      label: "Sales Hub",
      icon: "✍"
    }]
  }, {
    section: "Relationships",
    items: [{
      id: "partners",
      label: "Partners",
      icon: "▦"
    }, {
      id: "contacts",
      label: "Contacts",
      icon: "◉"
    }, {
      id: "accounts",
      label: "Accounts",
      icon: "▢"
    }, {
      id: "calls",
      label: "Calls",
      icon: "☎"
    }, {
      id: "activity",
      label: "Activity",
      icon: "≡"
    }, {
      id: "bulk",
      label: "Bulk edit",
      icon: "☰",
      ownerOnly: true
    }]
  }, {
    section: "Growth",
    items: [{
      id: "outreach",
      label: "Outreach",
      icon: "✉"
    }, {
      id: "prospecting",
      label: "Prospecting",
      icon: "◎"
    }]
  }, {
    section: "Library",
    items: [{
      id: "documents",
      label: "Documents",
      icon: "📑"
    }, {
      id: "brand-studio",
      label: "Brand studio",
      icon: "◈",
      studioOnly: true
    }]
  }, {
    section: "Finance",
    items: [{
      id: "finance",
      label: "Finance",
      icon: "▦",
      gated: true
    }, {
      id: "reports",
      label: "Reports",
      icon: "△"
    }]
  }].map(g => ({
    ...g,
    items: g.items.filter(it => (!it.gated || showFinance) && (!it.ownerOnly || showBulk) && (!it.studioOnly || showStudio))
  })).filter(g => g.items.length);
  return React.createElement("aside", {
    className: "cn-sidebar"
  }, React.createElement("div", {
    className: "cn-brand"
  }, React.createElement("img", {
    src: window.cnBrandLogoSrc && window.cnBrandLogoSrc() || window.__resources?.logoMark || "assets/logo-mark.png",
    alt: window.CN_BRAND?.name || "Chief Negotiators",
    className: "cn-brand-logo"
  }), React.createElement("div", {
    className: "cn-brand-text"
  }, React.createElement("div", {
    className: "cn-brand-name"
  }, window.CN_BRAND?.wordTop || "Chief"), React.createElement("div", {
    className: "cn-brand-sub"
  }, window.CN_BRAND?.wordBottom || "Negotiators"))), React.createElement("nav", {
    className: "cn-nav"
  }, groups.map(g => React.createElement("div", {
    className: "cn-nav-group",
    key: g.section
  }, React.createElement("div", {
    className: "cn-nav-section"
  }, g.section), g.items.map(it => React.createElement("button", {
    key: it.id,
    className: `cn-nav-item ${view === it.id ? "is-active" : ""}`,
    onClick: () => setView(it.id),
    title: it.label
  }, React.createElement("span", {
    className: "cn-nav-icon"
  }, it.icon), React.createElement("span", null, it.label)))))), window.cnOwnerScope?.isOwner() && React.createElement("div", {
    className: "cn-brandview",
    title: "You own both businesses, so you can work across them from either site."
  }, React.createElement("span", {
    className: "cn-brandview-k"
  }, "Viewing"), React.createElement("div", {
    className: "cn-brandview-opts"
  }, [["all", "All"], ["Chief Negotiators", "CN"], ["SSP", "SSP"]].map(([v, label]) => React.createElement("button", {
    key: v,
    className: `cn-brandview-opt ${window.cnOwnerScope.brandView() === v ? "is-active" : ""}`,
    onClick: () => window.cnOwnerScope.setBrandView(v)
  }, label)))), React.createElement("div", {
    className: "cn-sidebar-foot"
  }, React.createElement("div", {
    className: "cn-user",
    title: currentUser?.name || ""
  }, React.createElement("div", {
    className: "cn-avatar cn-avatar--copper"
  }, currentUser?.initials || "?"), React.createElement("div", {
    className: "cn-user-text"
  }, React.createElement("div", {
    className: "cn-user-name"
  }, currentUser?.name || "—"), React.createElement("div", {
    className: "cn-user-role"
  }, currentUser?.role || ""))), onSignOut && React.createElement("button", {
    className: "cn-signout",
    onClick: onSignOut
  }, "Sign out")));
}
function Topbar({
  title,
  breadcrumb,
  onLogCall,
  onAddOpp,
  onAddTask,
  scenario,
  onOpenContact,
  onOpenOpp,
  onOpenAccount,
  onSetView
}) {
  var [q, setQ] = useState("");
  var [open, setOpen] = useState(false);
  var [hi, setHi] = useState(0);
  var wrapRef = useRef(null);
  var inputRef = useRef(null);
  useEffect(() => {
    var onKey = e => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current.blur();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    var onDoc = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  var results = useMemo(() => {
    if (!q || !scenario) return {
      contacts: [],
      accounts: [],
      opps: [],
      views: []
    };
    var needle = q.toLowerCase();
    var match = s => (s || "").toLowerCase().includes(needle);
    return {
      views: (window.CN_VIEWS || []).filter(v => match(v.label) || match(v.section)).slice(0, 5),
      contacts: scenario.contacts.filter(c => match(c.name) || match(c.title) || match(c.email) || match(c.phone)).slice(0, 6),
      accounts: scenario.accounts.filter(a => match(a.name) || match(a.industry) || match(a.hq) || match(a.website)).slice(0, 5),
      opps: (scenario.sharedOpps || scenario.opps).filter(o => match(o.title) || match(o.product)).slice(0, 6)
    };
  }, [q, scenario]);
  var flat = [...(results.views || []).map(v => ({
    kind: "view",
    id: v.id,
    item: v
  })), ...results.contacts.map(c => ({
    kind: "contact",
    id: c.id,
    item: c
  })), ...results.accounts.map(a => ({
    kind: "account",
    id: a.id,
    item: a
  })), ...results.opps.map(o => ({
    kind: "opp",
    id: o.id,
    item: o
  }))];
  var total = flat.length;
  var idxOf = (kind, id) => flat.findIndex(f => f.kind === kind && f.id === id);
  useEffect(() => {
    setHi(0);
  }, [q]);
  var pick = entry => {
    setQ("");
    setOpen(false);
    if (entry.kind === "view") onSetView && onSetView(entry.id);else if (entry.kind === "contact") onOpenContact && onOpenContact(entry.id);else if (entry.kind === "opp") onOpenOpp && onOpenOpp(entry.id);else if (entry.kind === "account") { if (onOpenAccount) onOpenAccount(entry.id); else if (window.cnOpenAccount) window.cnOpenAccount(entry.id); else onSetView && onSetView("accounts"); }
  };
  var onKeyInput = e => {
    if (!open || total === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi(h => Math.min(h + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(flat[hi]);
    }
  };
  return React.createElement("header", {
    className: "cn-topbar"
  }, React.createElement("div", {
    className: "cn-topbar-left"
  }, breadcrumb && React.createElement("div", {
    className: "cn-breadcrumb"
  }, breadcrumb.map((b, i) => React.createElement("span", {
    key: i,
    className: "cn-bc-wrap"
  }, i > 0 && React.createElement("span", {
    className: "cn-bc-sep"
  }, "/"), React.createElement("span", {
    className: i === breadcrumb.length - 1 ? "cn-bc-current" : "cn-bc-link"
  }, b)))), React.createElement("h1", {
    className: "cn-page-title"
  }, title)), React.createElement("div", {
    className: "cn-topbar-right"
  }, React.createElement("div", {
    className: "cn-search",
    ref: wrapRef
  }, React.createElement("span", {
    className: "cn-search-icon"
  }, "\u2315"), React.createElement("input", {
    ref: inputRef,
    value: q,
    onChange: e => {
      setQ(e.target.value);
      setOpen(true);
    },
    onFocus: () => q && setOpen(true),
    onKeyDown: onKeyInput,
    placeholder: "Search accounts, contacts, deals\u2026"
  }), React.createElement("span", {
    className: "cn-search-kbd"
  }, "\u2318K"), open && q && React.createElement("div", {
    className: "cn-search-results"
  }, total === 0 ? React.createElement("div", {
    className: "cn-sr-empty"
  }, "No matches for \"", q, "\"") : React.createElement(Fragment, null, (results.views || []).length > 0 && React.createElement("div", {
    className: "cn-sr-group"
  }, React.createElement("div", {
    className: "cn-sr-group-name"
  }, "Go to"), results.views.map(v => {
    var idx = idxOf("view", v.id);
    return React.createElement("button", {
      key: v.id,
      className: `cn-sr-item ${hi === idx ? "is-highlight" : ""}`,
      onMouseEnter: () => setHi(idx),
      onClick: () => pick({
        kind: "view",
        id: v.id
      })
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, v.icon), React.createElement("span", {
      className: "cn-sr-item-text"
    }, React.createElement("div", {
      className: "cn-sr-item-title"
    }, v.label), React.createElement("div", {
      className: "cn-sr-item-sub"
    }, v.section, v.key ? " · g then " + v.key : "")), React.createElement("span", {
      className: "cn-sr-kind"
    }, "Screen"));
  })), results.contacts.length > 0 && React.createElement("div", {
    className: "cn-sr-group"
  }, React.createElement("div", {
    className: "cn-sr-group-name"
  }, "Contacts"), results.contacts.map((c, i) => {
    var acct = window.accountOf(c.accountId, scenario);
    var idx = idxOf("contact", c.id);
    return React.createElement("button", {
      key: c.id,
      className: `cn-sr-item ${hi === idx ? "is-highlight" : ""}`,
      onMouseEnter: () => setHi(idx),
      onClick: () => pick({
        kind: "contact",
        id: c.id
      })
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, c.name.split(" ").map(n => n[0]).join("").slice(0, 2)), React.createElement("span", {
      className: "cn-sr-item-text"
    }, React.createElement("div", {
      className: "cn-sr-item-title"
    }, c.name), React.createElement("div", {
      className: "cn-sr-item-sub"
    }, c.title, acct ? " · " + acct.name : "")), React.createElement("span", {
      className: "cn-sr-kind"
    }, "Contact"));
  })), results.opps.length > 0 && React.createElement("div", {
    className: "cn-sr-group"
  }, React.createElement("div", {
    className: "cn-sr-group-name"
  }, "Deals"), results.opps.map((o, i) => {
    var idx = idxOf("opp", o.id);
    var acct = window.accountOf(o.accountId, scenario);
    return React.createElement("button", {
      key: o.id,
      className: `cn-sr-item ${hi === idx ? "is-highlight" : ""}`,
      onMouseEnter: () => setHi(idx),
      onClick: () => pick({
        kind: "opp",
        id: o.id
      })
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs cn-avatar--copper",
      style: {
        background: "linear-gradient(135deg, var(--cn-copper-soft), var(--cn-copper))"
      }
    }, "\u25A4"), React.createElement("span", {
      className: "cn-sr-item-text"
    }, React.createElement("div", {
      className: "cn-sr-item-title"
    }, o.title), React.createElement("div", {
      className: "cn-sr-item-sub"
    }, acct?.name, " \xB7 ", window.fmtUSD(o.value, {
      compact: true
    }))), React.createElement("span", {
      className: "cn-sr-kind"
    }, "Deal"));
  })), results.accounts.length > 0 && React.createElement("div", {
    className: "cn-sr-group"
  }, React.createElement("div", {
    className: "cn-sr-group-name"
  }, "Accounts"), results.accounts.map((a, i) => {
    var idx = idxOf("account", a.id);
    return React.createElement("button", {
      key: a.id,
      className: `cn-sr-item ${hi === idx ? "is-highlight" : ""}`,
      onMouseEnter: () => setHi(idx),
      onClick: () => pick({
        kind: "account",
        id: a.id
      })
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, "\u25A2"), React.createElement("span", {
      className: "cn-sr-item-text"
    }, React.createElement("div", {
      className: "cn-sr-item-title"
    }, a.name), React.createElement("div", {
      className: "cn-sr-item-sub"
    }, a.industry, a.hq ? " · " + a.hq : "")), React.createElement("span", {
      className: "cn-sr-kind"
    }, "Account"));
  }))))), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onLogCall
  }, React.createElement("span", {
    style: {
      fontSize: 14
    }
  }, "\u260E"), " Log call"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onAddTask
  }, React.createElement("span", {
    style: {
      fontSize: 14
    }
  }, "\u25EF"), " Add task"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: onAddOpp
  }, "+ New opportunity")));
}
Object.assign(window, {
  Sidebar,
  Topbar,
  KnightMark
});
function CNFeedText({
  text,
  lines = 3,
  className = "cn-feed-text",
  lessLabel = "Show less"
}) {
  var [open, setOpen] = React.useState(false);
  var [over, setOver] = React.useState(false);
  var ref = React.useRef(null);
  React.useEffect(() => {
    if (open) return;
    var el = ref.current;
    if (!el) return;
    var check = () => setOver(el.scrollHeight - el.clientHeight > 2);
    check();
    if (!window.ResizeObserver) return;
    var ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, lines, open]);
  if (!text) return null;
  return React.createElement("div", {
    className: "cn-feed-textwrap"
  }, React.createElement("p", {
    ref: ref,
    className: `${className}${open ? " is-open" : ""}`,
    style: {
      "--cn-clamp": lines
    }
  }, text), (over || open) && React.createElement("button", {
    type: "button",
    className: "cn-readmore",
    onClick: e => {
      e.stopPropagation();
      setOpen(v => !v);
    }
  }, open ? lessLabel : "Read more"));
}
function cnDayLabel(iso) {
  if (!iso) return "Earlier";
  var d = window.cnParseDay(iso);
  if (isNaN(d)) return "Earlier";
  var day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  var diff = Math.round((day(new Date()) - day(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString(undefined, {
    weekday: "long"
  });
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric"
  });
}
function cnGroupByDay(list, key = "occurredAt") {
  var out = [];
  var seen = new Map();
  for (var item of list) {
    var label = cnDayLabel(item[key]);
    if (!seen.has(label)) {
      var g = {
        label,
        items: []
      };
      seen.set(label, g);
      out.push(g);
    }
    seen.get(label).items.push(item);
  }
  return out;
}
function ExpandableText({
  text,
  className = "cn-feed-text",
  lines = 2
}) {
  return React.createElement(CNFeedText, {
    text: text,
    className: className,
    lines: lines,
    lessLabel: "Read less"
  });
}
Object.assign(window, {
  CNFeedText,
  ExpandableText,
  cnDayLabel,
  cnGroupByDay
});
function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Search…",
  emptyText = "No matches.",
  allowClear = false
}) {
  var [open, setOpen] = useState(false);
  var [q, setQ] = useState("");
  var [highlight, setHighlight] = useState(0);
  var rootRef = useRef(null);
  var inputRef = useRef(null);
  var selected = options.find(o => o.value === value);
  var filtered = q ? options.filter(o => (o.label || "").toLowerCase().includes(q.toLowerCase()) || (o.subtext || "").toLowerCase().includes(q.toLowerCase())) : options;
  useEffect(() => {
    var onDoc = e => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  useEffect(() => {
    setHighlight(0);
  }, [q, open]);
  var choose = opt => {
    onChange(opt.value);
    setQ("");
    setOpen(false);
  };
  var onKey = e => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) choose(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };
  return React.createElement("div", {
    className: "cn-ss",
    ref: rootRef
  }, React.createElement("div", {
    className: `cn-ss-control ${open ? "is-open" : ""}`,
    onClick: () => {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, open ? React.createElement("input", {
    ref: inputRef,
    className: "cn-ss-input",
    value: q,
    placeholder: selected ? selected.label : placeholder,
    onChange: e => setQ(e.target.value),
    onKeyDown: onKey,
    autoFocus: true
  }) : React.createElement(Fragment, null, selected ? React.createElement("div", {
    className: "cn-ss-value"
  }, React.createElement("span", {
    className: "cn-ss-label"
  }, selected.label), selected.subtext && React.createElement("span", {
    className: "cn-ss-subtext"
  }, selected.subtext)) : React.createElement("span", {
    className: "cn-ss-placeholder"
  }, placeholder), allowClear && selected && React.createElement("button", {
    className: "cn-ss-clear",
    onClick: e => {
      e.stopPropagation();
      onChange("");
    }
  }, "\u2715")), React.createElement("span", {
    className: "cn-ss-caret"
  }, "\u25BE")), open && React.createElement("div", {
    className: "cn-ss-menu"
  }, filtered.length === 0 ? React.createElement("div", {
    className: "cn-ss-empty"
  }, emptyText) : filtered.map((o, i) => React.createElement("div", {
    key: o.value,
    className: `cn-ss-item ${i === highlight ? "is-highlight" : ""} ${o.value === value ? "is-selected" : ""}`,
    onMouseEnter: () => setHighlight(i),
    onMouseDown: e => {
      e.preventDefault();
      choose(o);
    }
  }, React.createElement("div", {
    className: "cn-ss-item-label"
  }, o.label), o.subtext && React.createElement("div", {
    className: "cn-ss-item-sub"
  }, o.subtext)))));
}
window.SearchableSelect = SearchableSelect;