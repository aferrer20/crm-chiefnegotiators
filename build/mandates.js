// Compiled from mandates.jsx — plain React.createElement, no build step.
// Edit mandates.jsx and mirror changes here; the shells load this file.
const { useState: useStateMand, useEffect: useEffectMand, useMemo: useMemoMand } = React;
const _mh = React.createElement;

const MAND_KINDS = [
  { id: "gpu", label: "GPU", unit: "GPUs" },
  { id: "power", label: "Power / MW", unit: "MW" },
  { id: "colo", label: "Colo / racks", unit: "racks" },
  { id: "network", label: "Network", unit: "Gbps" },
  { id: "storage", label: "Storage", unit: "PB" },
  { id: "other", label: "Other", unit: "units" },
];

function mandDaysTo(iso) {
  if (!iso) return null;
  var d = new Date(String(iso).length <= 10 ? iso + "T12:00:00" : iso);
  if (isNaN(d)) return null;
  var sod = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()); };
  return Math.round((sod(d) - sod(new Date())) / 86400000);
}
function mandUrgency(m) {
  var d = mandDaysTo(m.neededBy);
  if (m.priority === "urgent") return "urgent";
  if (d != null && d < 0) return "overdue";
  if (d != null && d <= 21) return "soon";
  return "normal";
}
function mandDueLabel(m) {
  var d = mandDaysTo(m.neededBy);
  if (d == null) return "No date";
  if (d < 0) return Math.abs(d) + "d overdue";
  if (d === 0) return "Due today";
  if (d < 31) return d + "d left";
  return new Date(m.neededBy + "T12:00:00").toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
function mandSort(a, b) {
  var rank = { overdue: 0, urgent: 1, soon: 2, normal: 3 };
  var ra = rank[mandUrgency(a)], rb = rank[mandUrgency(b)];
  if (ra !== rb) return ra - rb;
  var da = mandDaysTo(a.neededBy), db = mandDaysTo(b.neededBy);
  if (da == null) return 1;
  if (db == null) return -1;
  return da - db;
}

function useMandates() {
  var bumpState = useStateMand(0);
  var bump = bumpState[1];
  useEffectMand(function () {
    var on = function () { bump(function (x) { return x + 1; }); };
    window.addEventListener("cn-mandates-changed", on);
    window.addEventListener("cn-partners-changed", on);
    return function () {
      window.removeEventListener("cn-mandates-changed", on);
      window.removeEventListener("cn-partners-changed", on);
    };
  }, []);
  var M = window.cnMandates;
  var list = M ? M.list() : [];
  var matches = useMemoMand(function () { return M ? M.matches() : []; }, [list.length, M]);
  var byMandate = useMemoMand(function () {
    var g = {};
    matches.forEach(function (x) { (g[x.mandate.id] = g[x.mandate.id] || []).push(x); });
    return g;
  }, [matches]);
  return { M: M, list: list, matches: matches, byMandate: byMandate };
}

// ── claim dialog ────────────────────────────────────────────────────────────
function MandateClaimModal(props) {
  var mandate = props.mandate, matches = props.matches || [], onClose = props.onClose, onDone = props.onDone;
  var M = window.cnMandates;
  var lk = useStateMand(function () { return matches[0] ? matches[0].key : ""; }), lineKey = lk[0], setLineKey = lk[1];
  var nt = useStateMand(""), note = nt[0], setNote = nt[1];
  var bs = useStateMand(false), busy = bs[0], setBusy = bs[1];
  var er = useStateMand(null), err = er[0], setErr = er[1];
  var partners = (window.cnPartners && window.cnPartners.read && window.cnPartners.read()) || [];

  var allLines = useMemoMand(function () {
    var out = [];
    partners.forEach(function (p) {
      (p.capacity || []).forEach(function (l) {
        var key = mandate.id + "::" + p.id + "::" + (l.id || "");
        out.push({
          key: key, partnerId: p.id, partnerName: p.name || p.org || "Partner", lineId: l.id || "",
          label: (p.name || p.org || "Partner") + " — " + (l.resource || l.kind || "capacity") + (l.region ? " · " + l.region : ""),
          matched: matches.some(function (m) { return m.key === key; }),
        });
      });
    });
    return out.sort(function (a, b) { return (b.matched ? 1 : 0) - (a.matched ? 1 : 0); });
  }, [partners.length, mandate.id, matches.length]);

  var submit = async function () {
    setBusy(true); setErr(null);
    var pick = allLines.find(function (l) { return l.key === lineKey; });
    var res = await M.claim(mandate.id, pick
      ? { partnerId: pick.partnerId, partnerName: pick.partnerName, lineId: pick.lineId, note: note }
      : { note: note });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    window.cnToast && window.cnToast({ title: "Mandate claimed", sub: "It's locked to you and the team has been told." });
    onDone && onDone();
    onClose && onClose();
  };

  return _mh("div", { className: "cn-modal-scrim", onClick: onClose },
    _mh("div", { className: "cn-modal", style: { width: 520 }, onClick: function (e) { e.stopPropagation(); } },
      _mh("div", { className: "cn-modal-head" },
        _mh("div", null,
          _mh("div", { className: "cn-card-eyebrow" }, "Claim mandate"),
          _mh("h2", { className: "cn-modal-title" }, mandate.title || M.mandLine(mandate))),
        _mh("button", { className: "cn-icon-btn", onClick: onClose }, "\u2715")),
      _mh("div", { className: "cn-modal-body" },
        _mh("p", { className: "cn-mand-claim-note" },
          "Claiming locks this to you — nobody else can take it until you release it. It returns to the pool after " + M.EXPIRY_DAYS + " days without activity."),
        _mh("label", null, "Filling with which supply?"),
        _mh("select", { className: "cn-input", value: lineKey, onChange: function (e) { setLineKey(e.target.value); } },
          _mh("option", { value: "" }, "Not sure yet"),
          allLines.map(function (l) {
            return _mh("option", { key: l.key, value: l.key }, (l.matched ? "\u2605 " : "") + l.label);
          })),
        _mh("label", { style: { marginTop: 12 } }, "How you'll work it"),
        _mh("textarea", {
          className: "cn-input", rows: 3, value: note,
          onChange: function (e) { setNote(e.target.value); },
          placeholder: "Intro call booked Thursday, pricing to confirm…",
        }),
        err && _mh("div", { className: "cn-mand-err" }, err)),
      _mh("div", { className: "cn-modal-foot" },
        _mh("button", { className: "cn-btn cn-btn--ghost", onClick: onClose }, "Cancel"),
        _mh("button", { className: "cn-btn cn-btn--primary", disabled: busy, onClick: submit }, busy ? "Claiming…" : "Claim it"))));
}

// ── buyer field ─────────────────────────────────────────────────────────────
// Type the buyer. If it matches an account we already have, picking it links
// the mandate to that account; if it matches nothing the text stands alone —
// plenty of mandates come from a desk we haven't set up yet. A dropdown of
// every account was unusable past a few dozen rows and couldn't express the
// second case at all.
function MandBuyerField(props) {
  var accounts = props.accounts || [], accountId = props.accountId, onPick = props.onPick;
  var linked = accounts.find(function (a) { return a.id === accountId; });
  var qs = useStateMand(function () { return (linked ? linked.name : props.text) || ""; }), q = qs[0], setQ = qs[1];
  var op = useStateMand(false), open = op[0], setOpen = op[1];
  var wrap = React.useRef(null);
  useEffectMand(function () {
    var onDoc = function (e) { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return function () { document.removeEventListener("mousedown", onDoc); };
  }, []);
  var hits = useMemoMand(function () {
    var needle = q.trim().toLowerCase();
    if (!needle) return [];
    return accounts.filter(function (a) {
      var n = String(a.name || "").toLowerCase();
      return n.indexOf(needle) !== -1 && n !== needle;
    }).slice(0, 6);
  }, [q, accounts]);

  var type = function (v) {
    setQ(v); setOpen(true);
    // Typing past a linked account unlinks it — the text is now the truth.
    var exact = accounts.find(function (a) { return String(a.name || "").toLowerCase() === v.trim().toLowerCase(); });
    onPick(exact ? exact.id : "", v);
  };

  return _mh("div", { className: "cn-mand-buyer", ref: wrap },
    _mh("input", {
      className: "cn-input", value: q, placeholder: "Type a buyer or company",
      autoComplete: "off",
      onChange: function (e) { type(e.target.value); },
      onFocus: function () { setOpen(true); },
    }),
    linked && _mh("span", { className: "cn-mand-buyer-link", title: "Linked to this account in the CRM" }, "linked"),
    open && hits.length > 0 && _mh("div", { className: "cn-mand-buyer-pop" },
      hits.map(function (a) {
        return _mh("button", {
          key: a.id, type: "button", className: "cn-mand-buyer-opt",
          onClick: function () { setQ(a.name); onPick(a.id, a.name); setOpen(false); },
        }, a.name, _mh("span", null, "in the CRM"));
      })));
}

// ── mandate editor ──────────────────────────────────────────────────────────
function MandateModal(props) {
  var mandate = props.mandate, scenario = props.scenario, onClose = props.onClose;
  var M = window.cnMandates;
  var editing = !!mandate;
  var fs = useStateMand(function () { return mandate ? Object.assign({}, mandate) : M.blank(); }), f = fs[0], setF = fs[1];
  var bs = useStateMand(false), busy = bs[0], setBusy = bs[1];
  var set = function (patch) { setF(function (p) { return Object.assign({}, p, patch); }); };
  var accounts = (scenario && (scenario.accounts || [])) || [];
  var kind = MAND_KINDS.find(function (k) { return k.id === f.resourceKind; }) || MAND_KINDS[0];

  var save = async function () {
    if (!String(f.resource || "").trim() && !String(f.title || "").trim()) {
      window.cnToast && window.cnToast({ kind: "error", title: "Say what we're hunting" });
      return;
    }
    if (!String(f.region || "").trim()) {
      window.cnToast && window.cnToast({ kind: "error", title: "A mandate needs a region", sub: "Matching is region-based." });
      return;
    }
    setBusy(true);
    await M.save(f);
    await M.scanAfterSupply(null);
    setBusy(false);
    window.cnToast && window.cnToast({ title: editing ? "Mandate updated" : "Mandate logged", sub: M.mandLine(f) });
    onClose && onClose();
  };

  var fld = function (label, key, placeholder, extra) {
    return _mh("div", null,
      _mh("label", null, label),
      _mh("input", Object.assign({
        className: "cn-input", value: f[key] || "",
        onChange: function (e) { var p = {}; p[key] = e.target.value; set(p); },
        placeholder: placeholder,
      }, extra || {})));
  };

  return _mh("div", { className: "cn-modal-scrim", onClick: onClose },
    _mh("div", { className: "cn-modal", onClick: function (e) { e.stopPropagation(); } },
      _mh("div", { className: "cn-modal-head" },
        _mh("div", null,
          _mh("div", { className: "cn-card-eyebrow" }, editing ? "Edit mandate" : "New mandate"),
          _mh("h2", { className: "cn-modal-title" }, "What have we been asked to find?")),
        _mh("button", { className: "cn-icon-btn", onClick: onClose }, "\u2715")),
      _mh("div", { className: "cn-modal-body" },
        _mh("label", null, "Headline"),
        _mh("input", {
          className: "cn-input", value: f.title || "",
          onChange: function (e) { set({ title: e.target.value }); },
          placeholder: "20 MW APAC, energised by Q2",
        }),
        _mh("div", { className: "cn-mand-grid2" },
          _mh("div", null,
            _mh("label", null, "Buyer"),
            _mh(MandBuyerField, {
              accounts: accounts,
              accountId: f.buyerAccount,
              text: f.buyerText || "",
              onPick: function (id, name) { set({ buyerAccount: id, buyerText: name }); },
            })),
          fld("Contact / desk", "buyerName", "Procurement desk \u2014 optional")),
        _mh("label", null, "What they need"),
        _mh("div", { className: "cn-mand-kinds" },
          MAND_KINDS.map(function (k) {
            return _mh("button", {
              key: k.id, type: "button",
              className: "cn-pa-spec" + (f.resourceKind === k.id ? " is-on" : ""),
              onClick: function () { set({ resourceKind: k.id, unit: f.unit && f.unit !== kind.unit ? f.unit : k.unit }); },
            }, k.label);
          })),
        _mh("div", { className: "cn-mand-grid3" },
          fld("Spec", "resource", "H100 SXM"),
          fld("Quantity", "quantity", "20", { inputMode: "decimal" }),
          fld("Unit", "unit", kind.unit)),
        _mh("div", { className: "cn-mand-grid3" },
          fld("Region / market", "region", "APAC"),
          _mh("div", null,
            _mh("label", null, "Needed by"),
            _mh("input", {
              className: "cn-input", type: "date", value: f.neededBy || "",
              onChange: function (e) { set({ neededBy: e.target.value }); },
            })),
          fld("Term", "term", "36 months")),
        _mh("div", { className: "cn-mand-grid2" },
          fld("Budget ceiling / target rate", "budget", "$2.40/GPU-hr or $9M/yr"),
          _mh("div", null,
            _mh("label", null, "Priority"),
            _mh("div", { className: "cn-pa-statusrow" },
              [["normal", "Normal"], ["urgent", "Urgent"]].map(function (pair) {
                return _mh("button", {
                  key: pair[0], type: "button",
                  className: "cn-pa-statusbtn" + (f.priority === pair[0] ? " is-on" : ""),
                  onClick: function () { set({ priority: pair[0] }); },
                }, pair[1]);
              })))),
        _mh("label", null, "Notes"),
        _mh("textarea", {
          className: "cn-input", rows: 3, value: f.notes || "",
          onChange: function (e) { set({ notes: e.target.value }); },
          placeholder: "Anything the hunter needs to know — who else is bidding, hard constraints…",
        })),
      _mh("div", { className: "cn-modal-foot" },
        editing && M.isOwner() && _mh("button", {
          className: "cn-btn cn-btn--ghost cn-mand-del",
          onClick: async function () { if (confirm("Delete this mandate?")) { await M.remove(f.id); onClose && onClose(); } },
        }, "Delete"),
        _mh("div", { style: { flex: 1 } }),
        _mh("button", { className: "cn-btn cn-btn--ghost", onClick: onClose }, "Cancel"),
        _mh("button", { className: "cn-btn cn-btn--primary", disabled: busy, onClick: save },
          busy ? "Saving…" : editing ? "Save mandate" : "Log mandate"))));
}

// ── the card ────────────────────────────────────────────────────────────────
function MandateCard(props) {
  var mandate = props.mandate, matches = props.matches || [], scenario = props.scenario;
  var compact = props.compact, onEdit = props.onEdit, onClaim = props.onClaim;
  var M = window.cnMandates;
  var held = M.claimOf(mandate.id);
  var urg = mandUrgency(mandate);
  var me = M.me();
  var mine = held && String(held.claimed_by || "").toLowerCase() === me.email;
  var buyer = mandate.buyerAccount
    ? (((scenario && (scenario.accounts || [])) || []).find(function (a) { return a.id === mandate.buyerAccount; }) || {}).name
    : (mandate.buyerText || mandate.buyerName);

  var release = async function (reason) {
    var res = await M.release(mandate.id, reason);
    if (!res.ok) window.cnToast && window.cnToast({ kind: "error", title: res.error });
    else window.cnToast && window.cnToast({ title: reason === "filled" ? "Marked filled" : "Back in the pool" });
  };

  var showN = compact ? 1 : 3;

  return _mh("article", { className: "cn-mand-card is-" + urg + (held ? " is-claimed" : "") },
    _mh("div", { className: "cn-mand-card-top" },
      _mh("div", { className: "cn-mand-what" },
        _mh("div", {
          className: "cn-mand-title",
          onClick: function () { onEdit && onEdit(mandate); },
        }, mandate.title || M.mandLine(mandate) || "Mandate"),
        _mh("div", { className: "cn-mand-sub" }, [buyer, M.mandLine(mandate)].filter(Boolean).join(" · ") || "—")),
      _mh("div", { className: "cn-mand-due-wrap" },
        _mh("span", { className: "cn-mand-due is-" + urg }, mandDueLabel(mandate)),
        mandate.company && window.BrandChip && _mh(window.BrandChip, {
          company: mandate.company === "SSP" ? "SSP" : "CN",
          title: "Raised by " + mandate.company,
        }))),

    !compact && (mandate.budget || mandate.term) && _mh("div", { className: "cn-mand-terms" },
      mandate.budget && _mh("span", { key: "b" }, _mh("em", null, "Budget"), " " + mandate.budget),
      mandate.term && _mh("span", { key: "t" }, _mh("em", null, "Term"), " " + mandate.term)),

    _mh("div", { className: "cn-mand-supply" },
      matches.length === 0
        ? _mh("span", { className: "cn-mand-nosupply" }, "No matching supply logged yet")
        : [
          _mh("span", { className: "cn-mand-hit", key: "n" }, matches.length + " match" + (matches.length === 1 ? "" : "es")),
          _mh("span", { className: "cn-mand-hit-names", key: "l" },
            matches.slice(0, showN).map(function (x) {
              return _mh("button", {
                key: x.key, className: "cn-link cn-mand-hit-name",
                onClick: function () { window.cnGoto && window.cnGoto("partners"); },
                title: M.summarise(x),
              }, x.partner.name || x.partner.org,
                x.score.partial && _mh("span", { className: "cn-mand-partial" }, " partial"));
            }),
            matches.length > showN && _mh("span", { className: "cn-mand-more" }, "+" + (matches.length - showN))),
        ]),

    _mh("div", { className: "cn-mand-foot" },
      held
        ? [
          _mh("span", { className: "cn-mand-holder", key: "h" },
            _mh("span", { className: "cn-mand-lock" }, "\uD83D\uDD12"),
            mine ? "You have this" : "Claimed by " + (held.claimed_by_name || held.claimed_by),
            held.partner_name && _mh("span", { className: "cn-mand-via" }, " · via " + held.partner_name)),
          _mh("span", { className: "cn-mand-expiry", key: "e" }, M.expiresInDays(held) + "d left"),
          (mine || M.isOwner()) && _mh("div", { className: "cn-mand-acts", key: "a" },
            mine && _mh("button", {
              className: "cn-btn cn-btn--sm cn-btn--ghost", key: "s",
              onClick: function () { M.touch(mandate.id); },
            }, "Still on it"),
            _mh("button", {
              className: "cn-btn cn-btn--sm cn-btn--ghost", key: "r",
              onClick: function () { release("released"); },
            }, mine ? "Release" : "Force release"),
            mine && _mh("button", {
              className: "cn-btn cn-btn--sm cn-btn--primary", key: "f",
              onClick: function () { release("filled"); },
            }, "Filled")),
        ]
        : [
          _mh("span", { className: "cn-mand-open", key: "o" }, "Open — anyone can take this"),
          _mh("div", { className: "cn-mand-acts", key: "a" },
            _mh("button", {
              className: "cn-btn cn-btn--sm cn-btn--ghost",
              onClick: function () { onEdit && onEdit(mandate); },
            }, "Details"),
            _mh("button", {
              className: "cn-btn cn-btn--sm cn-btn--primary",
              onClick: function () { onClaim && onClaim(mandate); },
            }, "Claim")),
        ]));
}

// ── dashboard section ───────────────────────────────────────────────────────
function MandatesSection(props) {
  var scenario = props.scenario;
  var mm = useMandates(), M = mm.M, list = mm.list, byMandate = mm.byMandate;
  var ed = useStateMand(null), editing = ed[0], setEditing = ed[1];
  var cl = useStateMand(null), claiming = cl[0], setClaiming = cl[1];
  if (!M) return null;

  var live = list.filter(function (m) { return m.status !== "filled" && m.status !== "closed"; });
  var open = live.filter(function (m) { return !M.claimOf(m.id); });
  var withSupply = open.filter(function (m) { return (byMandate[m.id] || []).length; });
  var top = live.slice().sort(mandSort).slice(0, 3);

  return _mh("section", { className: "cn-mand-band" },
    _mh("div", { className: "cn-mand-band-head" },
      _mh("div", null,
        _mh("div", { className: "cn-card-eyebrow" }, "Buyer mandates · shared across both brands"),
        _mh("h2", { className: "cn-card-title" },
          live.length === 0 ? "No live mandates" : [
            live.length + " live mandate" + (live.length === 1 ? "" : "s"),
            withSupply.length > 0 && _mh("span", { className: "cn-mand-band-hit", key: "w" },
              " · " + withSupply.length + " with supply waiting"),
          ])),
      _mh("div", { className: "cn-mand-band-acts" },
        _mh("button", {
          className: "cn-btn cn-btn--sm cn-btn--ghost",
          onClick: function () { setEditing("new"); },
        }, "+ Mandate"),
        _mh("button", {
          className: "cn-link",
          onClick: function () { window.cnGoto && window.cnGoto("mandates"); },
        }, "Hunt all →"))),

    live.length === 0
      ? _mh("div", { className: "cn-mand-empty" },
        "A mandate is a buyer telling us to go find something. Log one and every rep in both brands can hunt it — and gets told the moment matching supply lands.")
      : _mh("div", { className: "cn-mand-band-cards" },
        top.map(function (m) {
          return _mh(MandateCard, {
            key: m.id, mandate: m, matches: byMandate[m.id] || [], scenario: scenario, compact: true,
            onEdit: setEditing, onClaim: setClaiming,
          });
        })),

    editing && _mh(MandateModal, {
      mandate: editing === "new" ? null : editing,
      scenario: scenario, onClose: function () { setEditing(null); },
    }),
    claiming && _mh(MandateClaimModal, {
      mandate: claiming, matches: byMandate[claiming.id] || [],
      onClose: function () { setClaiming(null); },
    }));
}

// ── full screen ─────────────────────────────────────────────────────────────
function MandatesScreen(props) {
  var scenario = props.scenario;
  var mm = useMandates(), M = mm.M, list = mm.list, byMandate = mm.byMandate;
  var tb = useStateMand("hunt"), tab = tb[0], setTab = tb[1];
  var qq = useStateMand(""), q = qq[0], setQ = qq[1];
  var ed = useStateMand(null), editing = ed[0], setEditing = ed[1];
  var cl = useStateMand(null), claiming = cl[0], setClaiming = cl[1];
  useEffectMand(function () { if (window.cnMandates) window.cnMandates.load(); }, []);

  var me = M ? M.me() : { email: "" };
  var filtered = useMemoMand(function () {
    if (!M) return [];
    var needle = q.trim().toLowerCase();
    return list.filter(function (m) {
      var held = M.claimOf(m.id);
      var done = m.status === "filled" || m.status === "closed";
      if (tab === "hunt" && (held || done)) return false;
      if (tab === "mine" && (!held || String(held.claimed_by || "").toLowerCase() !== me.email)) return false;
      if (tab === "claimed" && (!held || done)) return false;
      if (tab === "done" && !done) return false;
      if (!needle) return true;
      var hay = [m.title, m.resource, m.region, m.buyerName, m.buyerText, m.notes, m.unit].join(" ").toLowerCase();
      return hay.indexOf(needle) !== -1;
    }).sort(mandSort);
  }, [list, tab, q, me.email, M]);

  if (!M) return null;

  var live = list.filter(function (m) { return m.status !== "filled" && m.status !== "closed"; });
  var stats = [
    ["Live mandates", live.length],
    ["Unclaimed", live.filter(function (m) { return !M.claimOf(m.id); }).length],
    ["With supply", live.filter(function (m) { return (byMandate[m.id] || []).length; }).length],
    ["Yours", M.claims().filter(function (c) { return String(c.claimed_by || "").toLowerCase() === me.email; }).length],
  ];
  var TABS = [["hunt", "To hunt"], ["mine", "Yours"], ["claimed", "Claimed"], ["done", "Filled"], ["all", "All"]];

  return _mh("div", { className: "cn-page" },
    _mh("div", { className: "cn-in-head" },
      _mh("div", { className: "cn-in-lead" },
        "What buyers have mandated us to find. Shared across both brands — anyone can claim, one holder at a time, and a claim lapses after " + M.EXPIRY_DAYS + " quiet days.",
        M.shared() === false && _mh("span", { className: "cn-pa-localnote" },
          "Saving to this browser only — run migration 27 to share with the team.")),
      _mh("button", {
        className: "cn-btn cn-btn--primary",
        onClick: function () { setEditing("new"); },
      }, "+ New mandate")),

    _mh("section", { className: "cn-kpi-row cn-kpi-row--4" },
      stats.map(function (s) {
        return _mh("div", { className: "cn-kpi", key: s[0] },
          _mh("div", { className: "cn-kpi-eyebrow" }, s[0]),
          _mh("div", { className: "cn-kpi-value" }, s[1]));
      })),

    _mh("div", { className: "cn-pa-controls" },
      _mh("input", {
        className: "cn-input cn-pa-search", value: q,
        onChange: function (e) { setQ(e.target.value); },
        placeholder: "Search mandates, regions, buyers…",
      }),
      _mh("div", { className: "cn-pa-filters" },
        TABS.map(function (t) {
          return _mh("button", {
            key: t[0], className: "cn-pa-filter" + (tab === t[0] ? " is-on" : ""),
            onClick: function () { setTab(t[0]); },
          }, t[1]);
        }))),

    filtered.length === 0
      ? _mh("div", { className: "cn-mand-empty cn-mand-empty--screen" },
        tab === "hunt" ? "Nothing waiting to be hunted."
          : tab === "mine" ? "You haven't claimed anything." : "Nothing here yet.")
      : _mh("div", { className: "cn-mand-list" },
        filtered.map(function (m) {
          return _mh(MandateCard, {
            key: m.id, mandate: m, matches: byMandate[m.id] || [], scenario: scenario,
            onEdit: setEditing, onClaim: setClaiming,
          });
        })),

    editing && _mh(MandateModal, {
      mandate: editing === "new" ? null : editing,
      scenario: scenario, onClose: function () { setEditing(null); },
    }),
    claiming && _mh(MandateClaimModal, {
      mandate: claiming, matches: byMandate[claiming.id] || [],
      onClose: function () { setClaiming(null); },
    }));
}

// ── Partners hint ───────────────────────────────────────────────────────────
function MandateSupplyHint(props) {
  var partner = props.partner;
  var mm = useMandates(), M = mm.M, matches = mm.matches;
  if (!M || !partner) return null;
  var hits = matches.filter(function (m) { return m.partner.id === partner.id && !M.claimOf(m.mandate.id); });
  if (!hits.length) return null;
  var byMand = {};
  hits.forEach(function (h) { byMand[h.mandate.id] = h; });
  var uniq = Object.keys(byMand).map(function (k) { return byMand[k]; });
  return _mh("div", { className: "cn-mand-hint" },
    _mh("span", { className: "cn-mand-hint-tag" }, "Fills a mandate"),
    _mh("div", { className: "cn-mand-hint-body" },
      uniq.slice(0, 3).map(function (h) {
        return _mh("button", {
          key: h.mandate.id, className: "cn-link",
          onClick: function () { window.cnGoto && window.cnGoto("mandates"); },
        }, h.mandate.title || M.mandLine(h.mandate),
          h.score.partial && _mh("span", { className: "cn-mand-partial" }, " partial"));
      }),
      uniq.length > 3 && _mh("span", { className: "cn-mand-more" }, "+" + (uniq.length - 3) + " more")));
}

Object.assign(window, {
  MandatesScreen: MandatesScreen,
  MandatesSection: MandatesSection,
  MandateCard: MandateCard,
  MandateModal: MandateModal,
  MandateClaimModal: MandateClaimModal,
  MandateSupplyHint: MandateSupplyHint,
  MAND_KINDS: MAND_KINDS,
});
