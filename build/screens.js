function cnCompanyLabel(company) {
  if (company === "SSP" || company === "Strategic Supply Partners") return "SSP";
  return "Chief Negotiators";
}
function CompanyTag({
  company
}) {
  var isSSP = company === "SSP" || company === "Strategic Supply Partners";
  return React.createElement("span", {
    className: `cn-coTag ${isSSP ? "cn-coTag--ssp" : "cn-coTag--cn"}`
  }, cnCompanyLabel(company));
}
window.cnCompanyLabel = cnCompanyLabel;
window.CompanyTag = CompanyTag;
function OppMergeModal({
  scenario,
  onClose,
  onDone
}) {
  var [primaryId, setPrimaryId] = useState("");
  var [dupId, setDupId] = useState("");
  var [choices, setChoices] = useState({});
  var [busy, setBusy] = useState(false);
  var opps = (scenario.opps || []).filter(o => !(o.title || "").startsWith("⤳"));
  var oppOpt = o => ({
    value: o.id,
    label: o.title || "Untitled deal",
    subtext: (window.accountOf(o.accountId, scenario)?.name || "—") + " · " + (window.stageOf(o.stage)?.label || o.stage)
  });
  var primary = opps.find(o => o.id === primaryId);
  var duplicate = opps.find(o => o.id === dupId);
  var same = primaryId && dupId && primaryId === dupId;
  var contactName = id => (scenario.contacts || []).find(c => c.id === id)?.name || "—";
  var FIELDS = [{
    key: "title",
    label: "Deal name",
    col: "title",
    get: o => o.title,
    disp: o => o.title || "—"
  }, {
    key: "stage",
    label: "Stage",
    col: "stage",
    get: o => o.stage,
    disp: o => window.stageOf(o.stage)?.label || o.stage
  }, {
    key: "value",
    label: "Value",
    col: "value_cents",
    get: o => o.value,
    disp: o => window.fmtUSD(o.value),
    toCol: v => Math.round((v || 0) * 100)
  }, {
    key: "owner",
    label: "Owner",
    col: "owner_id",
    get: o => o.ownerId,
    disp: o => window.repOf(o.ownerId)?.name || "—"
  }, {
    key: "account",
    label: "Account",
    col: "account_id",
    get: o => o.accountId,
    disp: o => window.accountOf(o.accountId, scenario)?.name || "—"
  }, {
    key: "contact",
    label: "Primary contact",
    col: "contact_id",
    get: o => o.contactId,
    disp: o => contactName(o.contactId)
  }, {
    key: "close",
    label: "Close date",
    col: "expected_close",
    get: o => o.close,
    disp: o => o.close || "—"
  }];
  var pick = k => choices[k] || "primary";
  var chosenOpp = k => pick(k) === "duplicate" ? duplicate : primary;
  var dupQuoteCount = (() => {
    try {
      return duplicate ? (window.cnQuotes.readQuotes(duplicate.id) || []).length : 0;
    } catch {
      return 0;
    }
  })();
  var dupActCount = duplicate ? (scenario.activities || []).filter(a => (a.opportunity_id || a.opportunityId) === duplicate.id).length : 0;
  var doMerge = async () => {
    if (!primary || !duplicate || same || busy) return;
    if (!confirm(`Merge "${duplicate.title}" into "${primary.title}"?\n\nThe duplicate's quotes and activity move to the primary, and the duplicate is archived (Closed Lost). This can be undone by editing the archived deal.`)) return;
    setBusy(true);
    try {
      try {
        var dupQ = window.cnQuotes.readQuotes(duplicate.id) || [];
        if (dupQ.length) {
          var primQ = window.cnQuotes.readQuotes(primary.id) || [];
          window.cnQuotes.writeQuotes(primary.id, [...dupQ.map(q => ({
            ...q,
            oppId: primary.id
          })), ...primQ]);
          window.cnQuotes.writeQuotes(duplicate.id, []);
        }
      } catch (e) {
        console.warn("quote move failed", e);
      }
      var acts = (scenario.activities || []).filter(a => (a.opportunity_id || a.opportunityId) === duplicate.id);
      for (var a of acts) {
        try {
          await window.updateActivity(a.id, {
            opportunity_id: primary.id
          });
        } catch (e) {
          console.warn("act move failed", e);
        }
      }
      var payload = {};
      FIELDS.forEach(f => {
        var src = chosenOpp(f.key);
        if (!src) return;
        if (f.get(src) !== f.get(primary)) payload[f.col] = f.toCol ? f.toCol(f.get(src)) : f.get(src);
      });
      if (Object.keys(payload).length) await window.updateOpportunity(primary.id, payload);
      await window.updateOpportunity(duplicate.id, {
        stage: "lost",
        title: "⤳ Merged → " + (primary.title || "").slice(0, 60)
      });
      window.cnToast && window.cnToast({
        title: "Deals merged",
        sub: `${dupQuoteCount} quote(s) + ${dupActCount} activity item(s) moved`
      });
      onDone && onDone();
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
  }, "Merge opportunities"), React.createElement("h2", {
    className: "cn-modal-title"
  }, "Combine two duplicate deals")), React.createElement("button", {
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
    options: opps.map(oppOpt),
    placeholder: "Search deals\u2026"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Merge in & archive (duplicate)"), React.createElement(window.SearchableSelect, {
    value: dupId,
    onChange: setDupId,
    options: opps.map(oppOpt),
    placeholder: "Search deals\u2026"
  }))), same && React.createElement("div", {
    className: "cn-field-help",
    style: {
      color: "var(--cn-neg)"
    }
  }, "Pick two different deals."), primary && duplicate && !same && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginTop: 12,
      marginBottom: 6
    }
  }, "Choose the winning value for each field"), React.createElement("div", {
    className: "cn-merge-grid"
  }, FIELDS.map(f => {
    var conflict = f.get(primary) !== f.get(duplicate);
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
    }, f.disp(primary)), React.createElement("button", {
      className: `cn-merge-opt ${pick(f.key) === "duplicate" ? "is-on" : ""}`,
      onClick: () => setChoices(c => ({
        ...c,
        [f.key]: "duplicate"
      }))
    }, f.disp(duplicate))) : React.createElement("div", {
      className: "cn-merge-same"
    }, f.disp(primary)));
  })), React.createElement("div", {
    className: "cn-merge-moves"
  }, "Also moving onto the primary: ", React.createElement("b", null, dupQuoteCount), " quote", dupQuoteCount === 1 ? "" : "s", " \xB7 ", React.createElement("b", null, dupActCount), " activity item", dupActCount === 1 ? "" : "s", ". The duplicate is archived as Closed Lost (restorable)."))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose,
    disabled: busy
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: doMerge,
    disabled: !primary || !duplicate || same || busy
  }, busy ? "Merging…" : "Merge deals →"))));
}
function Pipeline({
  scenario,
  currentUser,
  isFounder,
  onOpenOpp,
  onAddOpp
}) {
  var [view, setView] = useState("kanban");
  var [filter, setFilter] = useState("all");
  var [companyFilter, setCompanyFilter] = useState("all");
  // Any rep's board, on demand.
  var [ownerFilter, setOwnerFilter] = useState("all");
  var [merging, setMerging] = useState(false);
  var myCompany = scenario.myCompany || "Chief Negotiators";
  var source = scenario.allOpps || scenario.opps;
  var companiesPresent = Array.from(new Set(source.map(o => o.company || myCompany)));
  var showCompanySelect = companiesPresent.length > 1;
  var acctNameOf = o => o.accountName || window.accountOf(o.accountId, scenario)?.name || "—";
  var isClosed = o => o.stage === "won" || o.stage === "lost";
  var opps = source.filter(o => {
    if (companyFilter !== "all" && (o.company || myCompany) !== companyFilter) return false;
    if (ownerFilter !== "all" && o.ownerId !== ownerFilter) return false;
    if (filter === "closed") return isClosed(o);
    if (filter === "mine") return o.ownerId === currentUser.id;
    if (filter === "open") return !isClosed(o);
    if (filter === "all") return !isClosed(o);
    return true;
  });
  var closedCount = source.filter(o => isClosed(o) && (companyFilter === "all" || (o.company || myCompany) === companyFilter)).length;
  var effView = filter === "closed" ? "table" : view;
  var reopen = async (o, e) => {
    e.stopPropagation();
    if (!window.updateOpportunity) return;
    await window.updateOpportunity(o.id, {
      stage: "intro_partner"
    });
    window.cnToast && window.cnToast({
      title: "Deal reopened",
      sub: `${o.title} — back at Intro to Partner`
    });
    window.cnReloadCRM && window.cnReloadCRM();
  };
  var cols = window.STAGES.filter(s => s.id !== "lost");
  var grouped = cols.map(s => ({
    ...s,
    items: opps.filter(o => o.stage === s.id),
    total: opps.filter(o => o.stage === s.id).reduce((sum, o) => sum + o.value, 0)
  }));
  // Every rep is selectable, with a live count, so a rep who holds no open deal
  // right now can still be pulled up and seen to be empty.
  var oppCountByOwner = {};
  source.filter(o => !isClosed(o)).forEach(o => {
    if (o.ownerId) oppCountByOwner[o.ownerId] = (oppCountByOwner[o.ownerId] || 0) + 1;
  });
  var ownersPresent = ((window.REPS || []).length ? window.REPS.slice() : Object.keys(oppCountByOwner).map(id => ({
    id: id,
    fullName: "Unassigned"
  }))).map(r => ({
    ...r,
    count: oppCountByOwner[r.id] || 0
  })).sort((a, b) => b.count - a.count || String(a.fullName || a.name).localeCompare(String(b.fullName || b.name)));
  var companyOpts = [{
    id: "all",
    label: "All companies"
  }].concat(companiesPresent.map(c => ({
    id: c,
    label: cnCompanyLabel(c)
  })));
  return React.createElement("div", {
    className: "cn-page"
  }, React.createElement("div", {
    className: "cn-toolbar"
  }, React.createElement("div", {
    className: "cn-tabs"
  }, [{
    id: "all",
    label: "Team pipeline"
  }, {
    id: "mine",
    label: "Mine"
  }, {
    id: "closed",
    label: "Closed",
    count: closedCount
  }].map(t => React.createElement("button", {
    key: t.id,
    className: `cn-tab ${filter === t.id ? "is-active" : ""}`,
    onClick: () => setFilter(t.id)
  }, t.label, t.count ? React.createElement("span", {
    className: "cn-tab-count"
  }, t.count) : null))), React.createElement("div", {
    className: "cn-toolbar-right"
  }, ownersPresent.length > 1 && React.createElement("select", {
    className: "cn-input cn-pipe-owner",
    value: ownerFilter,
    onChange: e => setOwnerFilter(e.target.value),
    title: "Show one rep's board"
  }, React.createElement("option", { value: "all" }, "All reps"), ownersPresent.map(r => React.createElement("option", {
    key: r.id,
    value: r.id
  }, (r.fullName || r.name) + " \xB7 " + r.count))), showCompanySelect && React.createElement("div", {
    className: "cn-segmented cn-segmented--co"
  }, companyOpts.map(c => React.createElement("button", {
    key: c.id,
    className: companyFilter === c.id ? "is-active" : "",
    onClick: () => setCompanyFilter(c.id)
  }, c.label))), filter !== "closed" && React.createElement("div", {
    className: "cn-segmented"
  }, React.createElement("button", {
    className: view === "kanban" ? "is-active" : "",
    onClick: () => setView("kanban")
  }, "Board"), React.createElement("button", {
    className: view === "table" ? "is-active" : "",
    onClick: () => setView("table")
  }, "Table")), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setMerging(true),
    title: "Combine two duplicate deals into one"
  }, "\u21C4 Merge deals"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: onAddOpp
  }, "+ New opportunity"))), filter === "closed" && React.createElement("div", {
    className: "cn-closed-lead"
  }, "Deals you've won or written off. Nothing here is on the board or in your forecast \u2014 but a dead deal is still a warm name. Reopen one when the timing changes."), effView === "kanban" ? React.createElement("div", {
    className: "cn-kanban"
  }, grouped.map(col => React.createElement("div", {
    key: col.id,
    className: `cn-col cn-col--${col.id}`
  }, React.createElement("div", {
    className: "cn-col-head"
  }, React.createElement("div", {
    className: "cn-col-title"
  }, React.createElement("span", {
    className: `cn-col-dot cn-stage--${col.id}`
  }), col.label, React.createElement("span", {
    className: "cn-col-count"
  }, col.items.length)), React.createElement("div", {
    className: "cn-col-value cn-mono"
  }, window.fmtUSD(col.total, {
    compact: true
  }))), React.createElement("div", {
    className: "cn-col-body"
  }, col.items.map(o => {
    return React.createElement("article", {
      key: o.id,
      className: `cn-deal-card ${o.isOther ? "cn-deal-card--other" : ""}`,
      onClick: () => onOpenOpp && onOpenOpp(o.id)
    }, React.createElement("div", {
      className: "cn-deal-title"
    }, o.title, window.cnOtherBadge && window.cnOtherBadge(o)), React.createElement("div", {
      className: "cn-deal-acct"
    }, acctNameOf(o)), React.createElement("div", {
      className: "cn-deal-value cn-mono"
    }, window.fmtUSD(o.value, {
      compact: true
    })), React.createElement("div", {
      className: "cn-deal-meta"
    }, React.createElement("span", {
      className: "cn-chip cn-chip--quiet"
    }, String(o.product || "—").split("—")[0].trim() || "—"), showCompanySelect && React.createElement(CompanyTag, {
      company: o.company || myCompany
    })), React.createElement("div", {
      className: "cn-deal-foot"
    }, React.createElement("span", {
      className: "cn-deal-close"
    }, "Close ", o.close), React.createElement("span", {
      className: "cn-avatar cn-avatar--xs",
      title: window.repOf(o.ownerId).name
    }, window.repOf(o.ownerId).initials)));
  }))))) : React.createElement("section", {
    className: "cn-card cn-card--flush"
  }, React.createElement("table", {
    className: "cn-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Deal"), React.createElement("th", null, "Account"), showCompanySelect && React.createElement("th", null, "Company"), React.createElement("th", null, "Stage"), React.createElement("th", null, "Owner"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Value"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Commission"), React.createElement("th", null, "Close"), filter === "closed" && React.createElement("th", null))), React.createElement("tbody", null, opps.length === 0 && React.createElement("tr", null, React.createElement("td", {
    colSpan: 9,
    className: "cn-table-empty"
  }, filter === "closed" ? "Nothing closed yet." : "No deals match this filter.")), opps.map(o => {
    return React.createElement("tr", {
      key: o.id,
      className: "cn-tr-link",
      onClick: () => onOpenOpp && onOpenOpp(o.id)
    }, React.createElement("td", null, React.createElement("div", {
      className: "cn-cell-primary"
    }, o.title), React.createElement("div", {
      className: "cn-cell-secondary"
    }, o.product)), React.createElement("td", null, acctNameOf(o)), showCompanySelect && React.createElement("td", null, React.createElement(CompanyTag, {
      company: o.company || myCompany
    })), React.createElement("td", null, React.createElement(StagePill, {
      stage: o.stage
    })), React.createElement("td", null, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, window.repOf(o.ownerId).initials), React.createElement("span", {
      style: {
        marginLeft: 8
      }
    }, window.repOf(o.ownerId).name)), React.createElement("td", {
      className: "cn-mono",
      style: {
        textAlign: "right"
      }
    }, window.fmtUSD(o.value, {
      compact: true
    })), React.createElement("td", {
      className: "cn-mono cn-copper",
      style: {
        textAlign: "right"
      }
    }, o.isOther ? "—" : window.fmtUSD(window.cnCommission(o), {
      compact: true
    })), React.createElement("td", null, o.close), filter === "closed" && React.createElement("td", {
      style: {
        textAlign: "right"
      }
    }, React.createElement("button", {
      className: "cn-btn cn-btn--ghost cn-btn--sm",
      onClick: e => reopen(o, e)
    }, "Reopen")));
  })))), merging && React.createElement(OppMergeModal, {
    scenario: scenario,
    onClose: () => setMerging(false),
    onDone: () => {
      setMerging(false);
      window.cnReloadCRM && window.cnReloadCRM();
    }
  }));
}
function Contacts(props) {
  var List = window.CnContactsList;
  if (!List) return React.createElement("div", { className: "cn-page" }, React.createElement("p", null, "Contacts list did not load."));
  return React.createElement(List, props);
}
function ContactDetail({
  scenario,
  contactId,
  onBack,
  onOpenOpp,
  onLogCall,
  onAddTask,
  onSaved,
  onEditActivity,
  onNewOpp,
  currentUser
}) {
  var contact = scenario.contacts.find(c => c.id === contactId) || scenario.contacts[0];
  var account = window.accountOf(contact?.accountId, scenario);
  var contactOpps = scenario.opps.filter(o => o.contactId === contact?.id);
  var activities = scenario.activities.filter(a => a.contactId === contact?.id);
  var [composeOpen, setComposeOpen] = useState(false);
  var [quickQuoteOppId, setQuickQuoteOppId] = useState(null);
  var [tab, setTab] = useState("timeline");
  var [editing, setEditing] = useState(false);
  var [draft, setDraft] = useState(null);
  var [busy, setBusy] = useState(false);
  var [error, setError] = useState(null);
  useEffect(() => {
    if (contact) {
      setDraft({
        name: contact.name || "",
        title: contact.title || "",
        email: contact.email || "",
        phone: contact.phone || "",
        tier: contact.tier || "Influencer",
        accountId: contact.accountId || "",
        ownerId: contact.ownerId || ""
      });
      setEditing(false);
      setError(null);
    }
  }, [contact?.id]);
  if (!contact || !draft) return React.createElement("div", {
    className: "cn-page"
  }, React.createElement("p", null, "Contact not found."));
  var tier = contact.tier || "Influencer";
  var totalOpen = contactOpps.filter(o => o.stage !== "won" && o.stage !== "lost").reduce((s, o) => s + o.value, 0);
  var totalWon = contactOpps.filter(o => o.stage === "won").reduce((s, o) => s + o.value, 0);
  var shownActivities = tab === "timeline" ? activities : activities.filter(a => a.type === tab.slice(0, -1));
  var saveEdits = async () => {
    if (!draft.name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await window.updateContact(contact.id, {
        name: draft.name.trim(),
        title: draft.title,
        email: draft.email,
        phone: draft.phone,
        tier: draft.tier,
        account_id: draft.accountId || null,
        owner_id: draft.ownerId || null
      });
      window.cnToast && window.cnToast({
        title: `Saved ${draft.name.trim()}`,
        sub: "Contact updated"
      });
      onSaved && onSaved();
      setEditing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  var deleteContact = async () => {
    if (!confirm(`Delete ${contact.name}? Their activities and deals will stay in the timeline but be unlinked.`)) return;
    setBusy(true);
    setError(null);
    try {
      await window.deleteContact(contact.id);
      window.cnToast && window.cnToast({
        title: `Deleted ${contact.name}`,
        kind: "success"
      });
      onSaved && onSaved();
      onBack();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  return React.createElement("div", {
    className: "cn-page cn-page--detail"
  }, React.createElement("div", {
    className: "cn-detail-head"
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, React.createElement("button", {
    className: "cn-back",
    onClick: onBack
  }, "\u2190 Back"), !editing ? React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setComposeOpen(true),
    disabled: !contact?.email,
    title: contact?.email ? "" : "No email on file"
  }, "\u2709 Email"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => {
      if (contactOpps.length === 0) {
        if (confirm("This contact has no deals yet. Create one first?")) onNewOpp && onNewOpp(contact);
        return;
      }
      setQuickQuoteOppId(contactOpps.length === 1 ? contactOpps[0].id : "ask");
    }
  }, "$ Quote"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setEditing(true)
  }, "Edit contact"), React.createElement("button", {
    className: "cn-btn cn-btn--danger",
    onClick: deleteContact,
    disabled: busy
  }, "Delete")) : React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setEditing(false),
    disabled: busy
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: saveEdits,
    disabled: busy
  }, busy ? "Saving…" : "Save"))), React.createElement("div", {
    className: "cn-detail-hero"
  }, React.createElement("div", {
    className: "cn-avatar cn-avatar--xl"
  }, draft.name.split(" ").map(n => n[0]).join("").slice(0, 2) || "?"), React.createElement("div", {
    className: "cn-detail-meta"
  }, editing ? React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, React.createElement("span", null, "Company"), React.createElement("select", {
    className: "cn-input",
    style: {
      width: "auto",
      padding: "4px 10px",
      fontSize: 11,
      letterSpacing: "0.14em",
      textTransform: "uppercase"
    },
    value: draft.accountId || "",
    onChange: e => setDraft(d => ({
      ...d,
      accountId: e.target.value
    }))
  }, React.createElement("option", {
    value: ""
  }, "\u2014 None \u2014"), scenario.accounts.map(a => React.createElement("option", {
    key: a.id,
    value: a.id
  }, a.name)))) : React.createElement("div", {
    className: "cn-card-eyebrow"
  }, account?.name || "—", account?.industry ? " · " + account.industry : ""), editing ? React.createElement(React.Fragment, null, React.createElement("input", {
    className: "cn-input cn-detail-name-input",
    value: draft.name,
    onChange: e => setDraft(d => ({
      ...d,
      name: e.target.value
    }))
  }), React.createElement("input", {
    className: "cn-input cn-detail-sub-input",
    value: draft.title,
    onChange: e => setDraft(d => ({
      ...d,
      title: e.target.value
    })),
    placeholder: "Title"
  })) : React.createElement(React.Fragment, null, React.createElement("h1", {
    className: "cn-detail-name"
  }, contact.name), React.createElement("div", {
    className: "cn-detail-sub"
  }, contact.title || "—", account?.hq ? " · " + account.hq : "")), React.createElement("div", {
    className: "cn-detail-chips"
  }, editing ? React.createElement(React.Fragment, null, React.createElement("select", {
    className: "cn-input",
    style: {
      width: "auto",
      padding: "4px 10px"
    },
    value: draft.tier,
    onChange: e => setDraft(d => ({
      ...d,
      tier: e.target.value
    }))
  }, ["Champion", "Decision Maker", "Influencer", "Gatekeeper"].map(t => React.createElement("option", {
    key: t,
    value: t
  }, t))), React.createElement("select", {
    className: "cn-input",
    style: {
      width: "auto",
      padding: "4px 10px"
    },
    value: draft.ownerId,
    onChange: e => setDraft(d => ({
      ...d,
      ownerId: e.target.value
    }))
  }, React.createElement("option", {
    value: ""
  }, "\u2014 Unassigned \u2014"), window.REPS.map(r => React.createElement("option", {
    key: r.id,
    value: r.id
  }, "Owner: ", r.name)))) : React.createElement(React.Fragment, null, React.createElement("span", {
    className: `cn-tier cn-tier--${tier.toLowerCase().replace(" ", "-")}`
  }, tier), (() => {
    var owner = contact.ownerId && window.repOf(contact.ownerId);
    return owner ? React.createElement("span", {
      className: "cn-chip",
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs cn-avatar--copper"
    }, owner.initials), "Owned by ", owner.name) : React.createElement("span", {
      className: "cn-chip",
      style: {
        fontStyle: "italic"
      }
    }, "Unassigned");
  })()), contact.lastTouch && React.createElement("span", {
    className: "cn-chip"
  }, "Last touch \xB7 ", contact.lastTouch))), !editing && React.createElement("div", {
    className: "cn-detail-actions"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onLogCall
  }, "\u260E Log call"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => onAddTask && onAddTask(contact.id)
  }, "\u25CB Add task"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => onNewOpp && onNewOpp(contact.id)
  }, "+ New opportunity"))), error && React.createElement("div", {
    className: "cn-login-error",
    style: {
      marginTop: 12
    }
  }, error), React.createElement("div", {
    className: "cn-detail-strip"
  }, React.createElement("div", {
    className: "cn-strip-item"
  }, React.createElement("div", {
    className: "cn-strip-label"
  }, "Open pipeline"), React.createElement("div", {
    className: "cn-strip-value"
  }, window.fmtUSD(totalOpen, {
    compact: true
  }))), React.createElement("div", {
    className: "cn-strip-item"
  }, React.createElement("div", {
    className: "cn-strip-label"
  }, "Closed with us"), React.createElement("div", {
    className: "cn-strip-value"
  }, window.fmtUSD(totalWon, {
    compact: true
  }))), React.createElement("div", {
    className: "cn-strip-item"
  }, React.createElement("div", {
    className: "cn-strip-label"
  }, "Email"), editing ? React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      marginTop: 2,
      fontSize: 12
    },
    value: draft.email,
    onChange: e => setDraft(d => ({
      ...d,
      email: e.target.value
    })),
    placeholder: "email"
  }) : contact.email ? React.createElement("button", {
    className: "cn-strip-value cn-strip-value--mono cn-copyable",
    title: "Click to copy",
    onClick: () => window.cnCopy(contact.email, "Email")
  }, contact.email) : React.createElement("div", {
    className: "cn-strip-value cn-strip-value--mono"
  }, "\u2014")), React.createElement("div", {
    className: "cn-strip-item"
  }, React.createElement("div", {
    className: "cn-strip-label"
  }, "Direct"), editing ? React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      marginTop: 2,
      fontSize: 12
    },
    value: draft.phone,
    onChange: e => setDraft(d => ({
      ...d,
      phone: e.target.value
    })),
    placeholder: "phone"
  }) : contact.phone ? React.createElement("button", {
    className: "cn-strip-value cn-strip-value--mono cn-copyable",
    title: "Click to copy",
    onClick: () => window.cnCopy(contact.phone, "Phone")
  }, contact.phone) : React.createElement("div", {
    className: "cn-strip-value cn-strip-value--mono"
  }, "\u2014")))), React.createElement("div", {
    className: "cn-detail-body"
  }, React.createElement("div", {
    className: "cn-detail-main"
  }, React.createElement("div", {
    className: "cn-tabs cn-tabs--underline"
  }, [{
    id: "timeline",
    label: "Timeline"
  }, {
    id: "calls",
    label: `Calls (${activities.filter(a => a.type === "call").length})`
  }, {
    id: "emails",
    label: `Emails (${activities.filter(a => a.type === "email").length})`
  }, {
    id: "notes",
    label: "Notes"
  }, {
    id: "files",
    label: "Files"
  }].map(t => React.createElement("button", {
    key: t.id,
    className: `cn-tab ${tab === t.id ? "is-active" : ""}`,
    onClick: () => setTab(t.id)
  }, t.label))), tab === "notes" && React.createElement(NoteComposer, {
    contactId: contact.id,
    currentUser: currentUser,
    onSaved: onSaved
  }), React.createElement("div", {
    className: "cn-timeline"
  }, shownActivities.map((a, i) => React.createElement("div", {
    key: a.id,
    className: "cn-tl-item cn-tl-item--clickable",
    onClick: () => onEditActivity && onEditActivity(a)
  }, React.createElement("div", {
    className: "cn-tl-spine"
  }, React.createElement("div", {
    className: `cn-tl-dot cn-tl-dot--${a.type}`
  }, a.type === "call" && "☎", a.type === "email" && "✉", a.type === "note" && "✎", a.type === "won" && "✓"), i < shownActivities.length - 1 && React.createElement("div", {
    className: "cn-tl-line"
  })), React.createElement("div", {
    className: "cn-tl-content"
  }, React.createElement("div", {
    className: "cn-tl-head"
  }, React.createElement("span", {
    className: "cn-tl-title"
  }, a.type === "call" && "Call logged", a.type === "email" && a.subject, a.type === "note" && "Internal note", a.type === "won" && "Deal won"), React.createElement("span", {
    className: "cn-tl-when"
  }, a.when)), React.createElement("div", {
    className: "cn-tl-meta"
  }, React.createElement("span", {
    className: "cn-avatar cn-avatar--xs"
  }, window.repOf(a.ownerId).initials), React.createElement("span", null, window.repOf(a.ownerId).name), a.duration && React.createElement("span", null, "\xB7 ", a.duration, " min"), a.sentiment && React.createElement("span", {
    className: `cn-chip cn-chip--${a.sentiment}`
  }, a.sentiment)), a.summary && React.createElement("p", {
    className: "cn-tl-body"
  }, a.summary), a.snippet && React.createElement("p", {
    className: "cn-tl-body cn-tl-body--quote"
  }, a.snippet)))), shownActivities.length === 0 && tab !== "notes" && React.createElement("div", {
    className: "cn-side-empty",
    style: {
      padding: "28px 0",
      textAlign: "center"
    }
  }, tab === "calls" ? "No calls logged yet." : tab === "emails" ? "No emails yet." : tab === "files" ? "No files attached yet." : "Nothing here yet."))), React.createElement("aside", {
    className: "cn-detail-side"
  }, window.CnAgreementsPanel && React.createElement(window.CnAgreementsPanel, {
    entityType: "contact",
    entityId: contact.id,
    entityName: contact.name,
    account: account,
    currentUser: currentUser
  }), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("h3", {
    className: "cn-side-title"
  }, "Open opportunities"), React.createElement("div", {
    className: "cn-side-list"
  }, contactOpps.filter(o => o.stage !== "won" && o.stage !== "lost").map(o => React.createElement("div", {
    key: o.id,
    className: "cn-side-deal",
    onClick: () => onOpenOpp && onOpenOpp(o.id)
  }, React.createElement("div", {
    className: "cn-side-deal-title"
  }, o.title), React.createElement("div", {
    className: "cn-side-deal-meta"
  }, React.createElement(StagePill, {
    stage: o.stage
  }), React.createElement("span", {
    className: "cn-mono"
  }, window.fmtUSD(o.value, {
    compact: true
  }))))), contactOpps.filter(o => o.stage !== "won" && o.stage !== "lost").length === 0 && React.createElement("div", {
    className: "cn-side-empty"
  }, "No open deals."))), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("h3", {
    className: "cn-side-title"
  }, "Account"), React.createElement("div", {
    className: "cn-side-acct"
  }, React.createElement("div", {
    className: "cn-side-acct-name"
  }, account.name), React.createElement("div", {
    className: "cn-side-acct-row"
  }, React.createElement("span", null, "Industry"), React.createElement("span", null, account.industry)), React.createElement("div", {
    className: "cn-side-acct-row"
  }, React.createElement("span", null, "HQ"), React.createElement("span", null, account.hq)), React.createElement("div", {
    className: "cn-side-acct-row"
  }, React.createElement("span", null, "Headcount"), React.createElement("span", {
    className: "cn-mono"
  }, account.size)), React.createElement("div", {
    className: "cn-side-acct-row"
  }, React.createElement("span", null, "Web"), React.createElement("span", {
    className: "cn-mono"
  }, account.website)))), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("h3", {
    className: "cn-side-title"
  }, "Other contacts at ", account.name), React.createElement("div", {
    className: "cn-side-list"
  }, scenario.contacts.filter(c => c.accountId === account.id && c.id !== contact.id).map(c => React.createElement("button", {
    key: c.id,
    className: "cn-side-person",
    onClick: () => window.location.hash = `#contact-${c.id}`
  }, React.createElement("span", {
    className: "cn-avatar cn-avatar--xs"
  }, c.name.split(" ").map(n => n[0]).join("").slice(0, 2)), React.createElement("span", null, React.createElement("div", {
    className: "cn-side-person-name"
  }, c.name), React.createElement("div", {
    className: "cn-side-person-title"
  }, c.title)))))))), composeOpen && window.ContactComposeDrawer && React.createElement(window.ContactComposeDrawer, {
    scenario: scenario,
    currentUser: currentUser,
    initialContactId: contact.id,
    onClose: () => setComposeOpen(false),
    onSaved: () => {
      onSaved && onSaved();
    }
  }), quickQuoteOppId && window.QuickQuoteFromContact && React.createElement(window.QuickQuoteFromContact, {
    scenario: scenario,
    contact: contact,
    oppId: quickQuoteOppId,
    currentUser: currentUser,
    onClose: () => setQuickQuoteOppId(null)
  }));
}
Object.assign(window, {
  Pipeline,
  Contacts,
  ContactDetail
});
function NoteComposer({
  contactId,
  currentUser,
  onSaved
}) {
  var [text, setText] = useState("");
  var [saving, setSaving] = useState(false);
  var [error, setError] = useState(null);
  var save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await window.insertActivity({
        type: "note",
        owner_id: currentUser?.id || null,
        contact_id: contactId,
        summary: text.trim(),
        occurred_at: new Date().toISOString()
      });
      window.cnToast && window.cnToast({
        title: "Note added",
        sub: text.trim().slice(0, 70)
      });
      setText("");
      onSaved && onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return React.createElement("div", {
    style: {
      marginBottom: 18,
      paddingBottom: 18,
      borderBottom: "1px solid var(--cn-line-2)"
    }
  }, React.createElement("textarea", {
    className: "cn-textarea",
    rows: "3",
    placeholder: "Add an internal note about this contact\u2026 (visible to the team, not the customer)",
    value: text,
    onChange: e => setText(e.target.value)
  }), error && React.createElement("div", {
    className: "cn-login-error",
    style: {
      marginTop: 8
    }
  }, error), React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      marginTop: 8
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: save,
    disabled: saving || !text.trim()
  }, saving ? "Saving…" : "Add note")));
}
Object.assign(window, {
  NoteComposer
});