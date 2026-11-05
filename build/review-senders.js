// Review senders: the queue the nightly CRM sync fills.
//
// The nightly job (one run for CN on Eastern time, one for SSP on Sydney time)
// adds every external person who emailed a rep to that person's account. When
// the sender's domain matches no account, it does not guess. It parks them in
// crm_prefs under:
//
//   nightly_sync.cn.review_senders    Chief Negotiators queue
//   nightly_sync.ssp.review_senders   SSP queue
//
// Each value is an array of { email, name, domain, rep_mailbox, first_seen,
// subject, status }. status is missing or "pending" until someone acts here.
// This screen resolves each sender one of four ways and writes the decision
// back to the same array, so the nightly job never re-queues them:
//
//   added      contact created on a new or existing account
//   dismissed  real person, not someone we track
//   spam       junk; domain (or address, for free mail) goes on the block list
//              nightly_sync.<brand>.blocked_domains, which the job soft-deletes
//
// Owners viewing "All" see both queues; everyone else sees their site's brand.
(function () {
  var h = React.createElement;
  var useState = React.useState, useEffect = React.useEffect, useMemo = React.useMemo;

  var BRANDS = {
    cn: { key: "cn", company: "Chief Negotiators", label: "CN" },
    ssp: { key: "ssp", company: "SSP", label: "SSP" },
  };
  var FREE = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "yahoo.com.au", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "bigpond.com", "bigpond.net.au", "optusnet.com.au", "gmx.com", "zoho.com", "yandex.com", "qq.com", "163.com"];
  var CHANGED = "cn-review-senders-changed";

  function sb() { return window.sb; }
  function qKey(b) { return "nightly_sync." + b + ".review_senders"; }
  function blockKey(b) { return "nightly_sync." + b + ".blocked_domains"; }
  function lc(s) { return String(s || "").trim().toLowerCase(); }
  function isFree(d) { return FREE.indexOf(lc(d)) >= 0; }
  function isPending(e) { return !e.status || e.status === "pending"; }
  function domainOf(e) { return lc(e.domain || String(e.email || "").split("@")[1]); }
  function nowIso() { return new Date().toISOString(); }
  function toast(t) { if (window.cnToast) window.cnToast(t); }

  function visibleBrands() {
    var f = window.cnOwnerScope && window.cnOwnerScope.companyFilter ? window.cnOwnerScope.companyFilter() : ((window.CN_BRAND && window.CN_BRAND.company) || "Chief Negotiators");
    if (f == null) return ["cn", "ssp"];
    return String(f).toUpperCase().indexOf("SSP") >= 0 ? ["ssp"] : ["cn"];
  }

  // "acme-power.co.uk" -> "Acme Power"
  function companyFromDomain(d) {
    var parts = lc(d).split(".");
    var tlds = ["com", "net", "org", "io", "ai", "co", "au", "uk", "ca", "us", "de", "fr", "jp", "sg", "nz", "in", "cloud", "tech", "dev", "inc", "ltd"];
    while (parts.length > 1 && tlds.indexOf(parts[parts.length - 1]) >= 0) parts.pop();
    var core = parts[parts.length - 1] || d;
    return core.split(/[-_]/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
  }
  function nameFromEmail(e) {
    var local = String(e || "").split("@")[0];
    return local.split(/[._-]+/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ") || e;
  }
  function ago(iso) {
    if (!iso) return "";
    var d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
    if (isNaN(d)) return "";
    return d <= 0 ? "today" : d === 1 ? "yesterday" : d + " days ago";
  }

  async function readKey(key) {
    var r = await sb().from("crm_prefs").select("value").eq("key", key).maybeSingle();
    if (r.error) throw r.error;
    var v = r.data && r.data.value;
    return Array.isArray(v) ? v : [];
  }
  async function writeKey(key, value) {
    var r = await sb().from("crm_prefs").upsert({ key: key, value: value, updated_at: nowIso() }, { onConflict: "key" });
    if (r.error) throw r.error;
  }

  // Re-read before writing so a nightly run that lands mid-review is not lost.
  async function resolveEntries(brand, emails, patch) {
    var want = {};
    emails.forEach(function (e) { want[lc(e)] = 1; });
    var list = await readKey(qKey(brand));
    var stamp = nowIso();
    var me = (window.cnAuthEmail || "") || null;
    var next = list.map(function (e) {
      if (!want[lc(e.email)]) return e;
      return Object.assign({}, e, patch, { resolved_at: stamp, resolved_by: me });
    });
    await writeKey(qKey(brand), next);
    return next;
  }
  async function addBlocks(brand, values) {
    var list = await readKey(blockKey(brand));
    var have = {};
    list.forEach(function (v) { have[lc(v)] = 1; });
    var add = values.map(lc).filter(function (v) { return v && !have[v]; });
    if (add.length) await writeKey(blockKey(brand), list.concat(add));
  }

  // Groups: one per company domain, one per address for free mail.
  function groupQueue(entries) {
    var g = {};
    entries.forEach(function (e) {
      var d = domainOf(e);
      var free = isFree(d);
      var id = e._brand + "|" + (free ? lc(e.email) : d);
      var x = g[id] = g[id] || { id: id, brand: e._brand, domain: d, free: free, people: [], first: e.first_seen || "", mailboxes: {} };
      if (!x.people.some(function (p) { return lc(p.email) === lc(e.email); })) x.people.push(e);
      if (e.first_seen && (!x.first || e.first_seen < x.first)) x.first = e.first_seen;
      if (e.rep_mailbox) x.mailboxes[lc(e.rep_mailbox)] = 1;
    });
    return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return a.first < b.first ? 1 : -1; });
  }

  function setCount(n) {
    window.cnReviewSendersCount = n;
    try { window.dispatchEvent(new CustomEvent(CHANGED, { detail: n })); } catch (e) {}
  }

  // ── nav badge ──
  function Badge() {
    var st = useState(typeof window.cnReviewSendersCount === "number" ? window.cnReviewSendersCount : 0), n = st[0], setN = st[1];
    useEffect(function () {
      var f = function (e) { setN(Number(e.detail) || 0); };
      window.addEventListener(CHANGED, f);
      if (typeof window.cnReviewSendersCount !== "number" && sb()) {
        Promise.all(visibleBrands().map(function (b) { return readKey(qKey(b)).catch(function () { return []; }); })).then(function (lists) {
          if (typeof window.cnReviewSendersCount === "number") return;
          var c = 0;
          lists.forEach(function (l) { c += l.filter(isPending).length; });
          setN(c);
        });
      }
      return function () { window.removeEventListener(CHANGED, f); };
    }, []);
    return n ? h("span", { className: "cnx-badge" }, n > 99 ? "99+" : n) : null;
  }

  // ── account picker for "Add to existing" ──
  function AccountPicker(p) {
    var st = useState(""), q = st[0], setQ = st[1];
    var hits = useMemo(function () {
      var t = lc(q);
      if (t.length < 2) return [];
      return p.accounts.filter(function (a) { return lc(a.name).indexOf(t) >= 0 || lc(a.email_domain).indexOf(t) >= 0; }).slice(0, 8);
    }, [q, p.accounts]);
    return h("div", { className: "cn-rs-pick" },
      h("input", { className: "cn-input", autoFocus: true, placeholder: "Search accounts by name or domain", value: q, onChange: function (e) { setQ(e.target.value); } }),
      hits.length ? h("div", { className: "cn-rs-hits" }, hits.map(function (a) {
        return h("button", { key: a.id, className: "cn-rs-hit", onClick: function () { p.onPick(a); } },
          h("span", null, a.name), a.email_domain ? h("span", { className: "cn-rs-dim" }, a.email_domain) : null);
      })) : lc(q).length >= 2 ? h("div", { className: "cn-rs-dim cn-rs-pad" }, "No matching account.") : null,
      h("button", { className: "cn-btn cn-btn--ghost cn-btn--sm", onClick: p.onCancel }, "Cancel"));
  }

  // ── one sender group ──
  function Group(p) {
    var g = p.group;
    var st = useState(null), mode = st[0], setMode = st[1];        // null | "new" | "existing"
    var nm = useState(g.free ? "" : companyFromDomain(g.domain)), acctName = nm[0], setAcctName = nm[1];
    var own = useState(p.defaultOwner || ""), ownerId = own[0], setOwnerId = own[1];
    var bz = useState(false), busy = bz[0], setBusy = bz[1];
    var emails = g.people.map(function (x) { return x.email; });
    var brandReps = p.reps.filter(function (r) { return r.company === BRANDS[g.brand].company && !r.off_board; });

    async function addPeople(account) {
      var company = BRANDS[g.brand].company;
      var existing = await sb().from("contacts").select("email").in("email", emails.concat(emails.map(lc)));
      var have = {};
      ((existing && existing.data) || []).forEach(function (c) { have[lc(c.email)] = 1; });
      var stamp = nowIso();
      var made = 0;
      for (var i = 0; i < g.people.length; i++) {
        var person = g.people[i];
        if (have[lc(person.email)]) continue;
        await window.insertContact({
          account_id: account.id, name: person.name || nameFromEmail(person.email), email: lc(person.email),
          owner_id: account.owner_id || ownerId || null, company: company,
          capture_source: "nightly-review", capture_reason: "emailed a rep", captured_at: person.first_seen || stamp, capture_reviewed_at: stamp,
        });
        made++;
      }
      await resolveEntries(g.brand, emails, { status: "added", account_id: account.id });
      p.onDone(g, "Added " + made + " contact" + (made === 1 ? "" : "s") + " to " + account.name, made < g.people.length ? (g.people.length - made) + " already existed in the CRM." : "Future emails from them land on the account automatically.");
    }

    async function createAccount() {
      if (!acctName.trim()) return;
      setBusy(true);
      try {
        var stamp = nowIso();
        var row = { name: acctName.trim(), owner_id: ownerId || null, company: BRANDS[g.brand].company, capture_source: "nightly-review", captured_at: g.first || stamp, capture_reviewed_at: stamp };
        if (!g.free) { row.email_domain = g.domain; row.website = g.domain; }
        var acct = await window.insertAccount(row);
        // insertAccount falls back to a browser-only record when the database
        // write fails; contacts can't hang off that, so stop here.
        if (!acct || String(acct.id).indexOf("acct-local") === 0) throw new Error("The database didn't accept the new account. Nothing was saved.");
        await addPeople(acct);
      } catch (e) {
        toast({ kind: "error", title: "Couldn't create the account", sub: e.message || String(e) });
        setBusy(false);
      }
    }
    async function useExisting(a) {
      setBusy(true);
      try {
        if (!g.free && !a.email_domain && window.updateAccount) await window.updateAccount(a.id, { email_domain: g.domain });
        await addPeople(a);
      } catch (e) {
        toast({ kind: "error", title: "Couldn't add to " + a.name, sub: e.message || String(e) });
        setBusy(false);
      }
    }
    async function dismiss() {
      setBusy(true);
      try {
        await resolveEntries(g.brand, emails, { status: "dismissed" });
        p.onDone(g, "Dismissed " + (g.free ? emails[0] : g.domain), "They won't be queued again.");
      } catch (e) { toast({ kind: "error", title: "Couldn't save", sub: e.message || String(e) }); setBusy(false); }
    }
    async function spam() {
      setBusy(true);
      try {
        await resolveEntries(g.brand, emails, { status: "spam" });
        await addBlocks(g.brand, g.free ? emails : [g.domain]);
        p.onDone(g, "Marked " + (g.free ? emails[0] : g.domain) + " as spam", "Blocked. The nightly cleanup will clear anything they left in the CRM.");
      } catch (e) { toast({ kind: "error", title: "Couldn't save", sub: e.message || String(e) }); setBusy(false); }
    }

    var mailboxes = Object.keys(g.mailboxes).map(function (m) {
      var r = p.reps.find(function (x) { return lc(x.email) === m; });
      return r ? r.name : m;
    });

    return h("article", { className: "cn-rs-card" + (busy ? " is-busy" : "") + (p.selected ? " is-sel" : "") },
      h("div", { className: "cn-rs-top" },
        h("input", { type: "checkbox", className: "cn-rs-check", checked: !!p.selected, onChange: p.onToggle, "aria-label": "Select " + (g.free ? emails[0] : g.domain) }),
        h("div", { className: "cn-rs-main" },
          h("div", { className: "cn-rs-title" },
            h("span", null, g.free ? (g.people[0].name || nameFromEmail(g.people[0].email)) : g.domain),
            p.showBrand ? h("span", { className: "cn-rs-tag cn-rs-tag--" + g.brand }, BRANDS[g.brand].label) : null,
            g.free ? h("span", { className: "cn-rs-tag" }, "Personal email") : null),
          h("div", { className: "cn-rs-meta" },
            (mailboxes.length ? "Emailed " + mailboxes.join(", ") : "Emailed a rep") + (g.first ? " · first seen " + ago(g.first) : ""))),
        h("div", { className: "cn-rs-n" }, g.people.length, h("span", null, g.people.length === 1 ? "person" : "people"))),
      h("ul", { className: "cn-rs-people" }, g.people.map(function (x) {
        return h("li", { key: x.email },
          h("span", { className: "cn-rs-who" }, x.name || nameFromEmail(x.email)),
          h("span", { className: "cn-rs-dim" }, x.email),
          x.subject ? h("span", { className: "cn-rs-subj", title: x.subject }, x.subject) : null);
      })),
      mode === "new" ? h("div", { className: "cn-rs-form" },
        h("label", null, h("span", null, "Account name"), h("input", { className: "cn-input", autoFocus: true, value: acctName, onChange: function (e) { setAcctName(e.target.value); } })),
        h("label", null, h("span", null, "Owner"),
          h("select", { className: "cn-input", value: ownerId, onChange: function (e) { setOwnerId(e.target.value); } },
            h("option", { value: "" }, "Unassigned"),
            brandReps.map(function (r) { return h("option", { key: r.id, value: r.id }, r.name); }))),
        h("div", { className: "cn-rs-actions" },
          h("button", { className: "cn-btn cn-btn--primary cn-btn--sm", disabled: busy || !acctName.trim(), onClick: createAccount }, busy ? "Saving..." : "Create account and add"),
          h("button", { className: "cn-btn cn-btn--ghost cn-btn--sm", onClick: function () { setMode(null); } }, "Cancel"))) :
      mode === "existing" ? h(AccountPicker, { accounts: p.accounts.filter(function (a) { return a.company === BRANDS[g.brand].company; }), onPick: useExisting, onCancel: function () { setMode(null); } }) :
      h("div", { className: "cn-rs-actions" },
        h("button", { className: "cn-btn cn-btn--primary cn-btn--sm", disabled: busy, onClick: function () { setMode("new"); } }, "New account"),
        h("button", { className: "cn-btn cn-btn--sm", disabled: busy, onClick: function () { setMode("existing"); } }, "Add to existing"),
        h("span", { className: "cn-rs-spacer" }),
        h("button", { className: "cn-btn cn-btn--ghost cn-btn--sm", disabled: busy, onClick: dismiss }, "Not a prospect"),
        h("button", { className: "cn-btn cn-btn--ghost cn-btn--sm cn-rs-spam", disabled: busy, onClick: spam }, "Spam")));
  }

  // ── screen ──
  function ReviewSenders(props) {
    var brands = visibleBrands();
    var st = useState(null), entries = st[0], setEntries = st[1];
    var er = useState(null), err = er[0], setErr = er[1];
    var ac = useState([]), accounts = ac[0], setAccounts = ac[1];
    var rp = useState([]), reps = rp[0], setReps = rp[1];
    var sl = useState({}), sel = sl[0], setSel = sl[1];
    var qs = useState(""), q = qs[0], setQ = qs[1];
    var tk = useState(0), tick = tk[0], setTick = tk[1];

    useEffect(function () {
      var alive = true;
      if (!sb()) { setErr("Not connected to the database."); setEntries([]); return; }
      Promise.all([
        Promise.all(brands.map(function (b) { return readKey(qKey(b)).then(function (l) { return l.map(function (e) { return Object.assign({ _brand: b }, e); }); }); })),
        sb().from("accounts").select("id,name,email_domain,company,owner_id").order("name"),
        sb().from("reps").select("id,name,email,company,off_board"),
      ]).then(function (r) {
        if (!alive) return;
        var all = [].concat.apply([], r[0]);
        setEntries(all);
        setAccounts((r[1] && r[1].data) || []);
        setReps((r[2] && r[2].data) || []);
        setCount(all.filter(isPending).length);
        setErr(null);
      }, function (e) { if (alive) { setErr(e.message || String(e)); setEntries([]); } });
      return function () { alive = false; };
    }, [tick]);

    var me = useMemo(function () {
      var em = lc(window.cnAuthEmail || (props.currentUser && props.currentUser.email));
      var r = reps.find(function (x) { return lc(x.email) === em; });
      return r ? r.id : (props.currentUser && props.currentUser.id) || "";
    }, [reps, props.currentUser]);

    var pending = (entries || []).filter(isPending);
    var groups = useMemo(function () {
      var t = lc(q);
      var list = groupQueue(pending);
      if (!t) return list;
      return list.filter(function (g) { return g.domain.indexOf(t) >= 0 || g.people.some(function (x) { return lc(x.email).indexOf(t) >= 0 || lc(x.name).indexOf(t) >= 0 || lc(x.subject).indexOf(t) >= 0; }); });
    }, [entries, q]);
    var resolvedRecent = (entries || []).filter(function (e) { return !isPending(e) && e.resolved_at && Date.now() - new Date(e.resolved_at).getTime() < 7 * 864e5; }).length;

    function ownerFor(g) {
      var mb = Object.keys(g.mailboxes)[0];
      var r = mb && reps.find(function (x) { return lc(x.email) === mb; });
      return r ? r.id : me;
    }
    function done(g, title, sub) {
      toast({ title: title, sub: sub });
      var gone = {};
      g.people.forEach(function (x) { gone[g.brand + "|" + lc(x.email)] = 1; });
      setEntries(function (list) {
        var next = list.map(function (e) { return gone[e._brand + "|" + lc(e.email)] ? Object.assign({}, e, { status: "resolved-local", resolved_at: nowIso() }) : e; });
        setCount(next.filter(isPending).length);
        return next;
      });
      setSel(function (s) { var n = Object.assign({}, s); delete n[g.id]; return n; });
    }
    async function bulk(kind) {
      var chosen = groups.filter(function (g) { return sel[g.id]; });
      if (!chosen.length) return;
      if (kind === "spam" && !confirm("Mark " + chosen.length + " sender group" + (chosen.length === 1 ? "" : "s") + " as spam and block them?")) return;
      try {
        for (var i = 0; i < chosen.length; i++) {
          var g = chosen[i], emails = g.people.map(function (x) { return x.email; });
          await resolveEntries(g.brand, emails, { status: kind });
          if (kind === "spam") await addBlocks(g.brand, g.free ? emails : [g.domain]);
        }
        toast({ title: (kind === "spam" ? "Marked " : "Dismissed ") + chosen.length + " group" + (chosen.length === 1 ? "" : "s"), sub: kind === "spam" ? "Blocked for the nightly cleanup." : "They won't be queued again." });
        setSel({});
        setTick(function (t) { return t + 1; });
      } catch (e) { toast({ kind: "error", title: "Couldn't save", sub: e.message || String(e) }); }
    }

    var nSel = groups.filter(function (g) { return sel[g.id]; }).length;
    var header = h("header", { className: "cn-rs-head" },
      h("div", null,
        h("h1", { className: "cn-page-title" }, "Review senders"),
        h("p", { className: "cn-rs-sub" }, "People who emailed a rep from a company we don't have yet. Add them to an account, or clear them out. The nightly sync won't ask twice.")),
      h("div", { className: "cn-rs-head-r" },
        h("button", { className: "cn-btn cn-btn--ghost cn-btn--sm", onClick: function () { setTick(function (t) { return t + 1; }); } }, "Refresh")));

    var body;
    if (entries == null) body = h("div", { className: "cn-rs-calm" }, "Loading the queue...");
    else if (err) body = h("div", { className: "cn-rs-calm" }, h("b", null, "Couldn't load the queue."), h("span", null, err));
    else if (!pending.length) body = h("div", { className: "cn-rs-calm" },
      h("b", null, "All clear."),
      h("span", null, "No unknown senders waiting." + (resolvedRecent ? " " + resolvedRecent + " handled this week." : " New ones show up here after each nightly sync.")));
    else body = h(React.Fragment, null,
      h("div", { className: "cn-rs-bar" },
        h("span", { className: "cn-rs-count" }, pending.length + " " + (pending.length === 1 ? "person" : "people") + " in " + groupQueue(pending).length + " group" + (groupQueue(pending).length === 1 ? "" : "s")),
        nSel ? h(React.Fragment, null,
          h("span", { className: "cn-rs-dim" }, nSel + " selected"),
          h("button", { className: "cn-btn cn-btn--ghost cn-btn--sm", onClick: function () { bulk("dismissed"); } }, "Not prospects"),
          h("button", { className: "cn-btn cn-btn--ghost cn-btn--sm cn-rs-spam", onClick: function () { bulk("spam"); } }, "Spam")) :
          h("button", { className: "cn-btn cn-btn--ghost cn-btn--sm", onClick: function () { var n = {}; groups.forEach(function (g) { n[g.id] = 1; }); setSel(n); } }, "Select all"),
        h("span", { className: "cn-rs-spacer" }),
        h("input", { className: "cn-input cn-rs-search", type: "search", placeholder: "Search domain, name, subject", value: q, onChange: function (e) { setQ(e.target.value); } })),
      groups.length ? h("div", { className: "cn-rs-list" }, groups.map(function (g) {
        return h(Group, {
          key: g.id, group: g, accounts: accounts, reps: reps, defaultOwner: ownerFor(g), showBrand: brands.length > 1,
          selected: !!sel[g.id], onToggle: function () { setSel(function (s) { var n = Object.assign({}, s); if (n[g.id]) delete n[g.id]; else n[g.id] = 1; return n; }); },
          onDone: done,
        });
      })) : h("div", { className: "cn-rs-calm cn-rs-calm--small" }, "Nothing matches that search."));

    return h("div", { className: "cn-page cn-rs" }, header, body);
  }

  var css = [
    ".cn-rs{max-width:960px}",
    ".cn-rs-head{display:flex;align-items:flex-start;gap:16px;margin-bottom:20px}",
    ".cn-rs-head>div:first-child{flex:1}",
    ".cn-rs-sub{color:var(--cn-mute);margin-top:6px;max-width:620px;line-height:1.5}",
    ".cn-rs-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}",
    ".cn-rs-count{font-weight:600;color:var(--cn-ink)}",
    ".cn-rs-search{max-width:260px}",
    ".cn-rs-spacer{flex:1}",
    ".cn-rs-dim{color:var(--cn-mute);font-size:12.5px}",
    ".cn-rs-pad{padding:8px 2px}",
    ".cn-rs-list{display:flex;flex-direction:column;gap:12px}",
    ".cn-rs-card{background:var(--cn-card);border:1px solid var(--cn-line);border-radius:var(--cn-r-lg,12px);padding:16px 18px;box-shadow:var(--cn-shadow);transition:opacity .2s,border-color .2s}",
    ".cn-rs-card.is-busy{opacity:.55;pointer-events:none}",
    ".cn-rs-card.is-sel{border-color:var(--cn-copper)}",
    ".cn-rs-top{display:flex;align-items:flex-start;gap:12px}",
    ".cn-rs-check{margin-top:4px;accent-color:var(--cn-copper)}",
    ".cn-rs-main{flex:1;min-width:0}",
    ".cn-rs-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:600;font-size:15px;color:var(--cn-ink)}",
    ".cn-rs-meta{color:var(--cn-mute);font-size:12.5px;margin-top:3px}",
    ".cn-rs-tag{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:var(--cn-paper-2);color:var(--cn-ink-2)}",
    ".cn-rs-tag--cn{background:var(--cn-copper-wash);color:var(--cn-copper-deep)}",
    ".cn-rs-tag--ssp{background:#E6ECF7;color:#0B1629}",
    ".cn-rs-n{text-align:right;font-weight:700;font-size:18px;color:var(--cn-ink);line-height:1}",
    ".cn-rs-n span{display:block;font-size:11px;font-weight:500;color:var(--cn-mute);margin-top:3px}",
    ".cn-rs-people{list-style:none;margin:12px 0 0 28px;padding:0;display:flex;flex-direction:column;gap:6px}",
    ".cn-rs-people li{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;font-size:13.5px}",
    ".cn-rs-who{font-weight:500;color:var(--cn-ink)}",
    ".cn-rs-subj{color:var(--cn-ink-2);font-size:12.5px;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".cn-rs-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:14px 0 0 28px}",
    ".cn-rs-spam{color:var(--cn-neg)}",
    ".cn-rs-form{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin:14px 0 0 28px}",
    ".cn-rs-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--cn-mute);min-width:200px}",
    ".cn-rs-form .cn-rs-actions{margin:0}",
    ".cn-rs-pick{margin:14px 0 0 28px;display:flex;flex-direction:column;gap:8px;max-width:420px;align-items:flex-start}",
    ".cn-rs-pick .cn-input{width:100%}",
    ".cn-rs-hits{width:100%;border:1px solid var(--cn-line);border-radius:var(--cn-r,8px);overflow:hidden;background:var(--cn-card)}",
    ".cn-rs-hit{display:flex;justify-content:space-between;gap:12px;width:100%;padding:9px 12px;background:none;border:0;border-bottom:1px solid var(--cn-line);text-align:left;cursor:pointer;color:var(--cn-ink);font:inherit}",
    ".cn-rs-hit:last-child{border-bottom:0}",
    ".cn-rs-hit:hover{background:var(--cn-copper-wash)}",
    ".cn-rs-calm{display:flex;flex-direction:column;gap:6px;align-items:center;text-align:center;padding:56px 20px;color:var(--cn-mute);background:var(--cn-card);border:1px dashed var(--cn-line);border-radius:var(--cn-r-lg,12px)}",
    ".cn-rs-calm b{color:var(--cn-ink);font-size:16px}",
    ".cn-rs-calm--small{padding:28px 20px}",
    "@media (max-width:640px){.cn-rs-people,.cn-rs-actions,.cn-rs-form,.cn-rs-pick{margin-left:0}.cn-rs-search{max-width:none;width:100%}}",
  ].join("\n");
  try {
    var tag = document.createElement("style");
    tag.id = "cn-review-senders-css";
    tag.textContent = css;
    document.head.appendChild(tag);
  } catch (e) {}

  window.CnReviewSenders = ReviewSenders;
  window.CnReviewSendersBadge = Badge;
})();
