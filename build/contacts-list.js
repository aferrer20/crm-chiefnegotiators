// Compiled from contacts-list.jsx — edit the JSX and mirror changes here.
(function () {
  "use strict";
  var h = React.createElement;
  var useState = React.useState, useEffect = React.useEffect, useMemo = React.useMemo, useRef = React.useRef, Fragment = React.Fragment;

  var CN_CT_SORT_KEY = "cn-prefs-contacts-sort";
  var CN_CT_SEG_KEY = "cn-prefs-contacts-seg";
  var CN_CT_DAY = 86400000;

  function cnCtTouchIndex(activities) {
    var idx = {};
    (activities || []).forEach(function (a) {
      if (!a.contactId || !a.occurredAt) return;
      var t = new Date(a.occurredAt).getTime();
      if (!t) return;
      if (!idx[a.contactId] || t > idx[a.contactId]) idx[a.contactId] = t;
    });
    return idx;
  }
  function cnCtAgo(days) {
    if (days == null) return "\u2014";
    if (days < 1) return "today";
    if (days < 2) return "1d";
    if (days < 30) return Math.round(days) + "d";
    if (days < 365) return Math.round(days / 30) + "mo";
    return (days / 365).toFixed(1) + "y";
  }
  function cnCtFill(days) {
    if (days == null) return 0;
    return Math.max(0.04, Math.min(1, 1 - days / 90));
  }
  function cnCtTemp(days) {
    if (days == null) return "is-never";
    if (days <= 14) return "is-warm";
    if (days <= 45) return "is-cool";
    return "is-cold";
  }

  var CN_CT_FREEMAIL = {};
  ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "msn.com", "gmx.com"].forEach(function (d) { CN_CT_FREEMAIL[d] = true; });
  function cnCtDomain(email) {
    var at = String(email || "").toLowerCase().trim().split("@")[1];
    if (!at) return "";
    var d = at.replace(/[>,;\s].*$/, "");
    return CN_CT_FREEMAIL[d] ? "" : d;
  }
  function cnCtSiteDomain(url) {
    if (!url) return "";
    return String(url).toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split("?")[0];
  }
  function cnCtDomainIndex(scenario) {
    var map = {};
    (scenario.accounts || []).forEach(function (a) {
      var d = cnCtSiteDomain(a.website);
      if (d && !map[d]) map[d] = a;
    });
    var byId = {};
    (scenario.accounts || []).forEach(function (a) { byId[a.id] = a; });
    (scenario.contacts || []).forEach(function (c) {
      if (!c.accountId) return;
      var d = cnCtDomain(c.email);
      if (d && !map[d] && byId[c.accountId]) map[d] = byId[c.accountId];
    });
    return map;
  }

  var CN_CT_SORTS = [
    { id: "lasttouch", label: "Last touch (newest)", get: function (c, s, t) { return -(t[c.id] || 0); }, dir: 1 },
    { id: "stalest", label: "Last touch (stalest)", get: function (c, s, t) { return (t[c.id] || 0); }, dir: 1 },
    { id: "name-asc", label: "Name A \u2192 Z", get: function (c) { return (c.name || "").toLowerCase(); }, dir: 1 },
    { id: "name-desc", label: "Name Z \u2192 A", get: function (c) { return (c.name || "").toLowerCase(); }, dir: -1 },
    { id: "account", label: "Account A \u2192 Z", get: function (c, s) { var a = window.accountOf(c.accountId, s); return ((a && a.name) || "zzzz").toLowerCase(); }, dir: 1 },
    { id: "owner", label: "Owner", get: function (c) { if (!c.ownerId) return "zzzz"; var r = window.repOf(c.ownerId); return ((r && r.name) || "").toLowerCase(); }, dir: 1 },
  ];

  function CnReachButton(props) {
    var value = props.value, kind = props.kind, contactName = props.contactName;
    var st = useState(false), copied = st[0], setCopied = st[1];
    var has = !!value;
    var label = kind === "email" ? "email address" : "phone number";
    var click = function (e) {
      e.stopPropagation();
      if (!has) return;
      if (e.metaKey || e.ctrlKey) {
        window.open((kind === "email" ? "mailto:" : "tel:") + value, "_self");
        return;
      }
      var done = function () {
        setCopied(true);
        window.cnToast && window.cnToast({ title: value, sub: contactName + "'s " + label + " copied" });
        setTimeout(function () { setCopied(false); }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done, done);
      } else done();
    };
    return h("button", {
      className: "cn-ct-ico" + (copied ? " is-copied" : ""),
      disabled: !has,
      onClick: click,
      title: has ? value + " \u2014 click to copy, \u2318-click to " + (kind === "email" ? "compose" : "dial") : "No " + label + " on file",
    }, copied ? "\u2713" : (kind === "email" ? "\u2709" : "\u260E"));
  }

  function CnContactsList(props) {
    var scenario = props.scenario, currentUser = props.currentUser, onOpenContact = props.onOpenContact,
      onNewContact = props.onNewContact, onImport = props.onImport, onSaved = props.onSaved, onLogCall = props.onLogCall;

    var qs = useState(""), q = qs[0], setQ = qs[1];
    var sg = useState(function () { return localStorage.getItem(CN_CT_SEG_KEY) || "all"; }), seg = sg[0], setSeg = sg[1];
    var so = useState(function () {
      var saved = localStorage.getItem(CN_CT_SORT_KEY);
      return CN_CT_SORTS.some(function (s) { return s.id === saved; }) ? saved : "lasttouch";
    }), sort = so[0], setSort = so[1];
    var lk = useState(null), linking = lk[0], setLinking = lk[1];
    var searchRef = useRef(null);

    useEffect(function () { localStorage.setItem(CN_CT_SORT_KEY, sort); }, [sort]);
    useEffect(function () { localStorage.setItem(CN_CT_SEG_KEY, seg); }, [seg]);
    useEffect(function () {
      var onKey = function (e) {
        if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
        var t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
        e.preventDefault();
        searchRef.current && searchRef.current.focus();
      };
      window.addEventListener("keydown", onKey);
      return function () { window.removeEventListener("keydown", onKey); };
    }, []);

    var contacts = scenario.contacts || [];
    var touch = useMemo(function () { return cnCtTouchIndex(scenario.activities); }, [scenario.activities]);
    var domains = useMemo(function () { return cnCtDomainIndex(scenario); }, [scenario.accounts, scenario.contacts]);
    var now = Date.now();
    var daysOf = function (c) { return touch[c.id] ? (now - touch[c.id]) / CN_CT_DAY : null; };

    var leads = useMemo(function () { return contacts.filter(function (c) { return !c.accountId; }); }, [contacts]);
    var stale = useMemo(function () {
      return contacts.filter(function (c) { var d = daysOf(c); return c.accountId && d != null && d > 45; });
    }, [contacts, touch]);
    var untouched = useMemo(function () {
      return contacts.filter(function (c) { return c.accountId && daysOf(c) == null; });
    }, [contacts, touch]);
    var mine = useMemo(function () {
      return contacts.filter(function (c) { return currentUser && c.ownerId === currentUser.id; });
    }, [contacts, currentUser]);
    var touchedWeek = useMemo(function () {
      return contacts.filter(function (c) { var d = daysOf(c); return d != null && d <= 7; }).length;
    }, [contacts, touch]);
    var autoLinkable = useMemo(function () {
      return leads.map(function (c) { return { c: c, acct: domains[cnCtDomain(c.email)] }; }).filter(function (x) { return x.acct; });
    }, [leads, domains]);

    var base = seg === "leads" ? leads : seg === "stale" ? stale : seg === "untouched" ? untouched : seg === "mine" ? mine : contacts;
    var sortDef = CN_CT_SORTS.find(function (s) { return s.id === sort; }) || CN_CT_SORTS[0];

    var list = useMemo(function () {
      var needle = q.trim().toLowerCase();
      var filtered = !needle ? base : base.filter(function (c) {
        var a = window.accountOf(c.accountId, scenario);
        return (c.name || "").toLowerCase().indexOf(needle) >= 0
          || (c.title || "").toLowerCase().indexOf(needle) >= 0
          || (c.email || "").toLowerCase().indexOf(needle) >= 0
          || (c.phone || "").toLowerCase().indexOf(needle) >= 0
          || ((a && a.name) || "").toLowerCase().indexOf(needle) >= 0;
      });
      var arr = filtered.slice();
      arr.sort(function (a, b) {
        var va = sortDef.get(a, scenario, touch);
        var vb = sortDef.get(b, scenario, touch);
        if (va < vb) return -1 * sortDef.dir;
        if (va > vb) return 1 * sortDef.dir;
        return (a.name || "").localeCompare(b.name || "");
      });
      return arr;
    }, [base, q, sort, touch, scenario]);

    var linkTo = async function (contact, acct, e) {
      e && e.stopPropagation();
      setLinking(contact.id);
      try {
        await window.updateContact(contact.id, { account_id: acct.id });
        window.cnToast && window.cnToast({ title: contact.name + " \u2192 " + acct.name, sub: "Linked by email domain", kind: "success" });
        onSaved && onSaved();
      } catch (err) {
        window.cnToast && window.cnToast({ title: "Could not link", sub: err.message, kind: "error" });
      } finally { setLinking(null); }
    };

    var linkAll = async function () {
      if (!autoLinkable.length) return;
      setLinking("all");
      var ok = 0;
      for (var i = 0; i < autoLinkable.length; i++) {
        try { await window.updateContact(autoLinkable[i].c.id, { account_id: autoLinkable[i].acct.id }); ok++; } catch (err) { /* keep going */ }
      }
      setLinking(null);
      window.cnToast && window.cnToast({ title: "Linked " + ok + " lead" + (ok === 1 ? "" : "s"), sub: "Matched on email domain", kind: "success" });
      onSaved && onSaved();
    };

    var claim = async function (contact, acct, e) {
      e && e.stopPropagation();
      if (!currentUser) return;
      setLinking(contact.id);
      try {
        var patch = { owner_id: currentUser.id };
        if (acct) patch.account_id = acct.id;
        await window.updateContact(contact.id, patch);
        window.cnToast && window.cnToast({
          title: "Claimed " + contact.name,
          sub: acct ? "Linked to " + acct.name + " \u2014 add a note" : "Add an account and a note",
          kind: "success",
        });
        onSaved && onSaved();
        onOpenContact(contact.id);
      } catch (err) {
        window.cnToast && window.cnToast({ title: "Could not claim", sub: err.message, kind: "error" });
      } finally { setLinking(null); }
    };

    var SEGS = [
      { id: "all", label: "All contacts", n: contacts.length },
      { id: "leads", label: "Unclaimed leads", n: leads.length },
      { id: "stale", label: "Going cold", n: stale.length },
      { id: "untouched", label: "Never logged", n: untouched.length },
      { id: "mine", label: "Mine", n: mine.length },
    ];

    var EMPTY = {
      all: {
        hd: "No contacts yet",
        p: "Add a contact to start tracking conversations and deals, or import a spreadsheet to bring your existing book across.",
        primary: { label: "+ Add your first contact", fn: onNewContact },
      },
      leads: {
        hd: "No unclaimed leads",
        p: "Every contact that arrived from a meeting or call has an account on it. New attendees picked up by calendar and call sync will appear here for a rep to claim.",
        primary: null,
      },
      stale: {
        hd: "Nothing going cold",
        p: "Every account contact with a logged activity has been touched inside the last 45 days. Contacts drift into this queue as they age, so it is worth a look each week.",
        primary: untouched.length ? { label: "Check " + untouched.length + " never logged", fn: function () { setSeg("untouched"); } } : null,
      },
      untouched: {
        hd: "Everyone has been worked",
        p: "Every contact on an account has at least one call, email or note against it. Contacts imported or created without activity land here so nobody sits forgotten.",
        primary: null,
      },
      mine: {
        hd: "Nothing assigned to you",
        p: "Contacts you own show up here. Claim an unclaimed lead, or set yourself as owner on a contact record.",
        primary: leads.length ? { label: "Review " + leads.length + " unclaimed lead" + (leads.length === 1 ? "" : "s"), fn: function () { setSeg("leads"); } } : null,
      },
    };
    var empty = EMPTY[seg] || EMPTY.all;
    var segLabel = ((SEGS.find(function (s) { return s.id === seg; }) || {}).label || "contacts").toLowerCase();

    return h("div", { className: "cn-page" },
      h("dl", { className: "cn-ct-strip cn-ct-strip--5" },
        h("div", null, h("dt", null, "Contacts"), h("dd", null, contacts.length)),
        h("div", null, h("dt", null, "Unclaimed leads"), h("dd", { className: leads.length ? "is-flag" : "" }, leads.length, leads.length ? h("small", null, "awaiting a rep") : null)),
        h("div", null, h("dt", null, "Touched this week"), h("dd", null, touchedWeek, h("small", null, "of ", contacts.length))),
        h("div", null, h("dt", null, "Going cold"), h("dd", { className: stale.length ? "is-cold" : "" }, stale.length, h("small", null, "45d+"))),
        h("div", null, h("dt", null, "Never logged"), h("dd", { className: untouched.length ? "is-flag" : "" }, untouched.length, h("small", null, "no activity")))
      ),
      h("div", { className: "cn-toolbar" },
        h("div", { className: "cn-tabs" }, SEGS.map(function (s) {
          return h("button", { key: s.id, className: "cn-tab" + (seg === s.id ? " is-active" : ""), onClick: function () { setSeg(s.id); } },
            s.label, h("span", { className: "cn-tab-count" }, s.n));
        })),
        h("div", { className: "cn-toolbar-right" },
          h("input", { ref: searchRef, className: "cn-input", placeholder: "Filter contacts\u2026", value: q, onChange: function (e) { setQ(e.target.value); }, style: { width: 200 } }),
          h("label", { className: "cn-sort-select" },
            h("span", { className: "cn-sort-select-label" }, "Sort"),
            h("select", { className: "cn-input", value: sort, onChange: function (e) { setSort(e.target.value); } },
              CN_CT_SORTS.map(function (o) { return h("option", { key: o.id, value: o.id }, o.label); }))
          ),
          onImport && h("button", { className: "cn-btn cn-btn--ghost", onClick: onImport }, "\u2913 Import"),
          h("button", { className: "cn-btn cn-btn--primary", onClick: onNewContact }, "+ New contact")
        )
      ),
      seg === "leads" && leads.length > 0 && h("div", { className: "cn-ct-banner" },
        h("p", null,
          "These arrived from meetings and call sync with no account attached. ",
          h("strong", null, "Claim"),
          " takes ownership and opens the record so you can write the first note",
          autoLinkable.length > 0 ? " \u2014 " + autoLinkable.length + " of them already match an account by email domain." : "."
        ),
        autoLinkable.length > 0 && h("button", {
          className: "cn-btn cn-btn--primary cn-btn--sm",
          onClick: linkAll,
          disabled: linking === "all",
          style: { flex: "none" },
        }, linking === "all" ? "Linking\u2026" : "Link " + autoLinkable.length + " matched")
      ),
      list.length === 0
        ? h("section", { className: "cn-card" }, h("div", { className: "cn-ct-empty" },
            h("h3", null, q.trim() ? "No matches" : empty.hd),
            h("p", null, q.trim() ? "Nothing in " + segLabel + " matches \u201C" + q.trim() + "\u201D." : empty.p),
            h("div", { className: "cn-ct-empty-actions" },
              q.trim()
                ? h("button", { className: "cn-btn cn-btn--ghost", onClick: function () { setQ(""); } }, "Clear filter")
                : h(Fragment, null,
                    empty.primary && h("button", { className: "cn-btn cn-btn--primary", onClick: empty.primary.fn }, empty.primary.label),
                    seg === "all" && onImport && h("button", { className: "cn-btn cn-btn--ghost", onClick: onImport }, "\u2913 Import a spreadsheet"),
                    seg !== "all" && h("button", { className: "cn-btn cn-btn--ghost", onClick: function () { setSeg("all"); } }, "View all contacts")
                  )
            )
          ))
        : h("section", { className: "cn-card cn-card--flush" },
            h("div", { className: "cn-ct-scroll" },
              h("table", { className: "cn-ct-list" },
                h("colgroup", null,
                  h("col", { style: { width: "30%" } }),
                  h("col", { style: { width: "22%" } }),
                  h("col", { className: "c-owner", style: { width: "16%" } }),
                  h("col", { style: { width: "13%" } }),
                  h("col", { style: { width: "19%" } })
                ),
                h("thead", null, h("tr", null,
                  h("th", null, "Contact"),
                  h("th", null, "Account"),
                  h("th", { className: "c-owner" }, "Owner"),
                  h("th", { className: "is-right" }, "Reach"),
                  h("th", null, "Last touch")
                )),
                h("tbody", null, list.map(function (c) {
                  var acct = window.accountOf(c.accountId, scenario);
                  var owner = c.ownerId && window.repOf(c.ownerId);
                  var isLead = !c.accountId;
                  var match = isLead ? domains[cnCtDomain(c.email)] : null;
                  var d = daysOf(c);
                  var tier = (c.tier || "").toLowerCase().replace(/\s+/g, "-");
                  var busy = linking === c.id || linking === "all";
                  return h("tr", { key: c.id, className: isLead ? "is-lead" : "", onClick: function () { onOpenContact(c.id); } },
                    h("td", null, h("div", { className: "cn-ct-who" },
                      h("span", { className: "cn-ct-av" },
                        h("span", { className: "cn-avatar" }, (c.name || "?").split(" ").map(function (n) { return n[0]; }).join("").slice(0, 2)),
                        tier ? h("i", { className: "cn-ct-tier cn-ct-tier--" + tier, title: c.tier }) : null
                      ),
                      h("span", { className: "cn-ct-who-text" },
                        h("span", { className: "cn-ct-name" }, c.name),
                        h("span", { className: "cn-ct-title" + (c.title ? "" : " is-empty") }, c.title || "No title on file")
                      )
                    )),
                    h("td", null,
                      acct
                        ? h("div", { className: "cn-ct-acct" }, acct.name)
                        : match
                          ? h("button", {
                              className: "cn-ct-link-chip",
                              onClick: function (e) { linkTo(c, match, e); },
                              disabled: busy,
                              title: "Link to " + match.name + " \u2014 matched on " + cnCtDomain(c.email),
                            }, h("b", null, "\u21B3"), h("span", null, match.name))
                          : h("span", { className: "cn-ct-acct-none" }, "No account yet")
                    ),
                    h("td", { className: "c-owner" },
                      owner && owner.id
                        ? h("div", { className: "cn-ct-owner" },
                            h("span", { className: "cn-avatar cn-avatar--xs cn-avatar--copper" }, owner.initials),
                            h("span", { className: "cn-ct-owner-name" }, owner.name)
                          )
                        : (isLead && currentUser)
                          ? h("button", { className: "cn-btn cn-btn--ghost cn-btn--sm", onClick: function (e) { claim(c, match, e); }, disabled: busy }, busy ? "\u2026" : "Claim")
                          : h("span", { className: "cn-ct-unassigned" }, "Unassigned")
                    ),
                    h("td", null, h("div", { className: "cn-ct-reach", onClick: function (e) { e.stopPropagation(); } },
                      h(CnReachButton, { value: c.email, kind: "email", contactName: c.name }),
                      h(CnReachButton, { value: c.phone, kind: "phone", contactName: c.name }),
                      onLogCall && h("button", { className: "cn-ct-ico", title: "Log an activity for " + c.name, onClick: function () { onLogCall(c); } }, "\u270E")
                    )),
                    h("td", null, h("div", {
                      className: "cn-ct-touch " + cnCtTemp(d),
                      title: touch[c.id] ? new Date(touch[c.id]).toLocaleString() : "No logged activity",
                    },
                      h("span", { className: "cn-ct-bar" }, h("i", { style: { width: (cnCtFill(d) * 100) + "%" } })),
                      h("span", { className: "cn-ct-ago" }, cnCtAgo(d))
                    ))
                  );
                }))
              )
            ),
            h("div", { className: "cn-ct-count" },
              h("span", null, list.length + " of " + contacts.length + " contact" + (contacts.length === 1 ? "" : "s") + (q.trim() ? " matching \u201C" + q.trim() + "\u201D" : "")),
              h("span", { className: "cn-ct-hint" }, h("kbd", null, "/"), " to filter \u00B7 click \u2709 or \u260E to copy, \u2318-click to open")
            )
          )
    );
  }

  Object.assign(window, { CnContactsList: CnContactsList, CnReachButton: CnReachButton });
})();
