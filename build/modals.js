function linkableOpps(scenario, accountId) {
  var opps = scenario.opps || [];
  var isOpen = o => !/^(won|lost)$/i.test(o.stage || "");
  var atAccount = accountId ? opps.filter(o => o.accountId === accountId) : [];
  var list = atAccount.length ? atAccount : opps.filter(isOpen);
  return [...list].sort((a, b) => (isOpen(b) ? 1 : 0) - (isOpen(a) ? 1 : 0));
}
function oppSubtext(o, scenario) {
  var acct = window.accountOf(o.accountId, scenario);
  return [acct?.name, window.fmtUSD(o.value, {
    compact: true
  }), window.stageOf(o.stage)?.label].filter(Boolean).join(" · ");
}
function LogCallDrawer({
  open,
  onClose,
  scenario,
  currentUser,
  onSaved,
  prefillContactId
}) {
  var [contactId, setContactId] = useState(scenario.contacts[0]?.id || "");
  var [oppLink, setOppLink] = useState("");
  var [duration, setDuration] = useState(25);
  var [sentiment, setSentiment] = useState("positive");
  var [outcome, setOutcome] = useState("Advance to negotiation");
  var [summary, setSummary] = useState("");
  var [saving, setSaving] = useState(false);
  var [error, setError] = useState(null);
  var myRepId = (window.cnMyRepId && window.cnMyRepId(currentUser)) || currentUser?.id || "";
  var [onCall, setOnCall] = useState([]);
  useEffect(() => {
    if (open) {
      setContactId(prefillContactId || scenario.contacts[0]?.id || "");
      setOppLink("");
      setDuration(25);
      setSentiment("positive");
      setSummary("");
      setOnCall(myRepId ? [myRepId] : []);
      setError(null);
    }
  }, [open, prefillContactId]);
  if (!open) return null;
  if (scenario.contacts.length === 0) {
    return React.createElement("div", {
      className: "cn-drawer-scrim",
      onClick: onClose
    }, React.createElement("aside", {
      className: "cn-drawer",
      onClick: e => e.stopPropagation()
    }, React.createElement("header", {
      className: "cn-drawer-head"
    }, React.createElement("div", null, React.createElement("div", {
      className: "cn-card-eyebrow"
    }, "Log call"), React.createElement("h2", {
      className: "cn-drawer-title"
    }, "No contacts yet")), React.createElement("button", {
      className: "cn-icon-btn",
      onClick: onClose
    }, "\u2715")), React.createElement("div", {
      className: "cn-drawer-body"
    }, React.createElement("p", {
      style: {
        color: "var(--cn-mute)",
        lineHeight: 1.6
      }
    }, "Add a contact first, then you can log calls against them. Go to Contacts \u2192 New contact."))));
  }
  var contact = scenario.contacts.find(c => c.id === contactId) || scenario.contacts[0];
  var account = window.accountOf(contact.accountId, scenario);
  var contactOpps = window.linkableOpps(scenario, contact?.accountId);
  var isDirty = () => summary.trim().length > 0;
  var save = async () => {
    setSaving(true);
    setError(null);
    try {
      await window.insertActivity({
        type: "call",
        owner_id: currentUser?.id,
        contact_id: contactId,
        opportunity_id: oppLink || null,
        duration_min: duration,
        summary,
        sentiment,
        participants: onCall.length ? onCall : (myRepId ? [myRepId] : null),
        occurred_at: new Date().toISOString()
      });
      var cName = scenario.contacts.find(c => c.id === contactId)?.name || "contact";
      window.cnToast({
        title: `Call logged with ${cName}`,
        sub: `${duration} min · ${sentiment} · added to timeline`
      });
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return React.createElement("div", {
    className: "cn-drawer-scrim",
    onClick: window.makeBackdropHandler(isDirty, onClose)
  }, React.createElement("aside", {
    className: "cn-drawer",
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-drawer-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Log call"), React.createElement("h2", {
    className: "cn-drawer-title"
  }, "New call entry")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-drawer-body"
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Contact"), React.createElement(SearchableSelect, {
    value: contactId,
    onChange: setContactId,
    options: scenario.contacts.map(c => {
      var a = window.accountOf(c.accountId, scenario);
      return {
        value: c.id,
        label: c.name,
        subtext: `${c.title ? c.title + " · " : ""}${a?.name || "—"}`
      };
    }),
    placeholder: "Search by name, title or company\u2026"
  }), React.createElement("div", {
    className: "cn-field-help"
  }, contact.title, " \xB7 ", account?.name || "—", " \xB7 ", React.createElement("span", {
    className: "cn-mono"
  }, contact.phone))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Linked opportunity"), React.createElement(SearchableSelect, {
    value: oppLink,
    onChange: setOppLink,
    options: [{
      value: "",
      label: "— None —"
    }, ...contactOpps.map(o => ({
      value: o.id,
      label: o.title,
      subtext: window.oppSubtext(o, scenario)
    }))],
    placeholder: "Search deals\u2026"
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Duration"), React.createElement("div", {
    className: "cn-stepper"
  }, React.createElement("button", {
    onClick: () => setDuration(Math.max(1, duration - 5))
  }, "\u2212"), React.createElement("span", {
    className: "cn-mono"
  }, duration, " min"), React.createElement("button", {
    onClick: () => setDuration(duration + 5)
  }, "+"))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Sentiment"), React.createElement("div", {
    className: "cn-segmented cn-segmented--full"
  }, ["positive", "neutral", "negative"].map(s => React.createElement("button", {
    key: s,
    className: sentiment === s ? "is-active" : "",
    onClick: () => setSentiment(s)
  }, s))))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Who was on this call?"), React.createElement("div", {
    className: "cn-chip-row"
  }, (window.REPS || []).map(r => React.createElement("button", {
    key: r.id,
    className: "cn-chip-btn " + (onCall.includes(r.id) ? "is-active" : ""),
    onClick: () => setOnCall(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])
  }, r.name.split(" ")[0]))), React.createElement("div", {
    className: "cn-field-help"
  }, "Everyone picked gets the call on their scoreboard; the team total still counts it once.")), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Outcome"), React.createElement("div", {
    className: "cn-chip-row"
  }, ["Advance to Intro Call", "Advance to Quote", "Advance to Negotiate", "Holding pattern", "Closed lost"].map(o => React.createElement("button", {
    key: o,
    className: `cn-chip-btn ${outcome === o ? "is-active" : ""}`,
    onClick: () => setOutcome(o)
  }, o)))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Notes"), React.createElement("textarea", {
    className: "cn-textarea",
    rows: "6",
    placeholder: "Discussion, next steps, objections, decision criteria\u2026",
    value: summary,
    onChange: e => setSummary(e.target.value)
  })), error && React.createElement("div", {
    className: "cn-login-error"
  }, error)), React.createElement("footer", {
    className: "cn-drawer-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose,
    disabled: saving
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: save,
    disabled: saving
  }, saving ? "Saving…" : "Save call · update timeline"))));
}
function NewOppModal({
  open,
  onClose,
  scenario,
  currentUser,
  onSaved,
  prefillContactId
}) {
  var [title, setTitle] = useState("");
  var [accountId, setAccountId] = useState("");
  var [contactId, setContactId] = useState("");
  var [brand, setBrand] = useState("");
  var [brandOther, setBrandOther] = useState("");
  var [productSubtype, setProductSubtype] = useState("");
  var [stage, setStage] = useState("ncnda");
  var [value, setValue] = useState(500000);
  var [commission, setCommission] = useState(0);
  var [ownerId, setOwnerId] = useState(currentUser?.id || "");
  var [closeDate, setCloseDate] = useState(() => {
    var d = new Date();
    d.setMonth(d.getMonth() + 3);
    return window.cnDay(d);
  });
  var [saving, setSaving] = useState(false);
  var [error, setError] = useState(null);
  var [showQuickContact, setShowQuickContact] = useState(false);
  var [qcName, setQcName] = useState("");
  var [qcEmail, setQcEmail] = useState("");
  var [qcTitle, setQcTitle] = useState("");
  var [qcSaving, setQcSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setTitle("");
      if (prefillContactId) {
        var c = scenario.contacts.find(x => x.id === prefillContactId);
        setAccountId(c?.accountId || scenario.accounts[0]?.id || "");
        setContactId(prefillContactId);
      } else {
        setAccountId(scenario.accounts[0]?.id || "");
        setContactId("");
      }
      setBrand("");
      setBrandOther("");
      setProductSubtype("");
      setStage("ncnda");
      setValue(500000);
      setCommission(0);
      setOwnerId(currentUser?.id || "");
      setError(null);
      setShowQuickContact(false);
      setQcName("");
      setQcEmail("");
      setQcTitle("");
    }
  }, [open, currentUser?.id, prefillContactId]);
  if (!open) return null;
  var accountContacts = scenario.contacts.filter(c => c.accountId === accountId);
  var brandLabel = brand === "Other" ? brandOther : brand;
  var productString = brandLabel ? productSubtype ? `${brandLabel} — ${productSubtype}` : brandLabel : "";
  var isDirty = () => title.trim().length > 0 || qcName.trim().length > 0 || brand !== "";
  var addQuickContact = async () => {
    if (!qcName.trim()) {
      setError("Contact name is required.");
      return;
    }
    if (!accountId) {
      setError("Pick an account first.");
      return;
    }
    setQcSaving(true);
    setError(null);
    try {
      var inserted = await window.insertContact({
        name: qcName.trim(),
        title: qcTitle.trim(),
        email: qcEmail.trim(),
        phone: "",
        tier: "Influencer",
        account_id: accountId,
        owner_id: ownerId || currentUser?.id || null
      });
      var newC = {
        id: inserted?.id || "tmp-" + Math.random().toString(36).slice(2, 8),
        name: qcName.trim(),
        title: qcTitle.trim(),
        email: qcEmail.trim(),
        accountId,
        tier: "Influencer"
      };
      if (inserted?.id) {
        scenario.contacts.unshift({
          ...newC,
          id: inserted.id
        });
        setContactId(inserted.id);
      } else {
        scenario.contacts.unshift(newC);
        setContactId(newC.id);
      }
      onSaved && onSaved();
      setShowQuickContact(false);
      setQcName("");
      setQcEmail("");
      setQcTitle("");
      window.cnToast({
        title: `Added ${newC.name}`,
        sub: `Linked as primary contact on this new deal`
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setQcSaving(false);
    }
  };
  var save = async () => {
    if (!title.trim()) {
      setError("Deal title is required.");
      return;
    }
    if (!accountId) {
      setError("Pick an account.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      var inserted = await window.insertOpportunity({
        title: title.trim(),
        account_id: accountId,
        contact_id: contactId || accountContacts[0]?.id || null,
        owner_id: ownerId,
        product: productString,
        value_cents: Math.round(value * 100),
        commission_rate: value > 0 ? commission / value : 0,
        stage,
        expected_close: closeDate
      });
      window.cnSetDealMeta(inserted.id, {
        commissionAmount: Math.round(commission),
        commissionStatus: "earned"
      });
      var acctName = window.accountOf(accountId, scenario)?.name || "";
      window.cnToast({
        title: `Opportunity created — ${title.trim()}`,
        sub: `${acctName} · ${window.fmtUSD(value, {
          compact: true
        })} · stage: ${window.stageOf(stage)?.label}`
      });
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  var BRAND_OPTIONS = ["NVIDIA", "AMD", "Cisco", "Juniper", "Dell", "Arista", "Mellanox", "Other"];
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: window.makeBackdropHandler(isDirty, onClose)
  }, React.createElement("div", {
    className: "cn-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "New opportunity"), React.createElement("h2", {
    className: "cn-modal-title"
  }, "Open a deal")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, scenario.accounts.length === 0 ? React.createElement("p", {
    style: {
      color: "var(--cn-mute)",
      lineHeight: 1.6
    }
  }, "You don't have any accounts yet. Go to Accounts \u2192 New account first.") : React.createElement(Fragment, null, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Deal title"), React.createElement("input", {
    className: "cn-input",
    placeholder: "e.g. H200 cluster \u2014 128 nodes",
    value: title,
    onChange: e => setTitle(e.target.value),
    autoFocus: true
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 2
    }
  }, React.createElement("label", null, "Account"), React.createElement(SearchableSelect, {
    value: accountId,
    onChange: v => {
      setAccountId(v);
      setContactId("");
    },
    options: scenario.accounts.map(a => ({
      value: a.id,
      label: a.name,
      subtext: a.industry
    })),
    placeholder: "Search accounts\u2026"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 2
    }
  }, React.createElement("label", null, "Primary contact"), React.createElement(SearchableSelect, {
    value: contactId,
    onChange: setContactId,
    options: [{
      value: "",
      label: "— None —"
    }, ...accountContacts.map(c => ({
      value: c.id,
      label: c.name,
      subtext: c.title
    }))],
    placeholder: accountContacts.length === 0 ? "No contacts at this account yet" : "Search contacts…"
  }), !showQuickContact && React.createElement("button", {
    type: "button",
    className: "cn-link",
    style: {
      marginTop: 6,
      fontSize: 12
    },
    onClick: () => setShowQuickContact(true)
  }, "+ Add a new contact at this account"))), showQuickContact && React.createElement("div", {
    className: "cn-quick-add"
  }, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginBottom: 10
    }
  }, "New contact at ", window.accountOf(accountId, scenario)?.name || "this account"), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1,
      marginBottom: 0
    }
  }, React.createElement("label", null, "Name"), React.createElement("input", {
    className: "cn-input",
    value: qcName,
    onChange: e => setQcName(e.target.value),
    placeholder: "Jane Doe",
    autoFocus: true
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1,
      marginBottom: 0
    }
  }, React.createElement("label", null, "Title"), React.createElement("input", {
    className: "cn-input",
    value: qcTitle,
    onChange: e => setQcTitle(e.target.value),
    placeholder: "VP Procurement"
  }))), React.createElement("div", {
    className: "cn-field",
    style: {
      marginBottom: 10
    }
  }, React.createElement("label", null, "Email"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 13
    },
    value: qcEmail,
    onChange: e => setQcEmail(e.target.value),
    placeholder: "jane@company.com"
  })), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "flex-end"
    }
  }, React.createElement("button", {
    type: "button",
    className: "cn-btn cn-btn--ghost",
    onClick: () => {
      setShowQuickContact(false);
      setQcName("");
      setQcEmail("");
      setQcTitle("");
    },
    disabled: qcSaving
  }, "Cancel"), React.createElement("button", {
    type: "button",
    className: "cn-btn cn-btn--primary",
    onClick: addQuickContact,
    disabled: qcSaving || !qcName.trim()
  }, qcSaving ? "Adding…" : "+ Add contact"))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Product line"), React.createElement("div", {
    className: "cn-chip-row",
    style: {
      marginBottom: 8
    }
  }, BRAND_OPTIONS.map(b => React.createElement("button", {
    key: b,
    type: "button",
    className: `cn-chip-btn ${brand === b ? "is-active" : ""}`,
    onClick: () => setBrand(b)
  }, b))), React.createElement("div", {
    className: "cn-field-row",
    style: {
      marginBottom: 0
    }
  }, brand === "Other" && React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1,
      marginBottom: 0
    }
  }, React.createElement("input", {
    className: "cn-input",
    placeholder: "Brand name",
    value: brandOther,
    onChange: e => setBrandOther(e.target.value)
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 2,
      marginBottom: 0
    }
  }, React.createElement("input", {
    className: "cn-input",
    placeholder: brand === "NVIDIA" ? "e.g. H200, DGX H100, L40S, L4…" : brand === "Cisco" ? "e.g. Nexus 9000, Catalyst 9300…" : brand === "Juniper" ? "e.g. QFX5220, MX480…" : brand === "Dell" ? "e.g. PowerEdge XE9680, PowerSwitch…" : "Model / subtype (optional)",
    value: productSubtype,
    onChange: e => setProductSubtype(e.target.value)
  }))), productString && React.createElement("div", {
    className: "cn-field-help",
    style: {
      marginTop: 6
    }
  }, "Will save as: ", React.createElement("span", {
    className: "cn-mono"
  }, productString))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Deal value (USD)"), React.createElement("div", {
    className: "cn-money-input"
  }, React.createElement("span", null, "$"), React.createElement("input", {
    className: "cn-input cn-mono",
    value: value.toLocaleString(),
    onChange: e => setValue(parseInt(e.target.value.replace(/,/g, "") || "0", 10))
  }))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Commission (USD)"), React.createElement("div", {
    className: "cn-money-input"
  }, React.createElement("span", null, "$"), React.createElement("input", {
    className: "cn-input cn-mono",
    placeholder: "0",
    value: commission ? commission.toLocaleString() : "",
    onChange: e => setCommission(parseInt(e.target.value.replace(/,/g, "") || "0", 10))
  }))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Effective rate"), React.createElement("div", {
    className: "cn-readout cn-mono cn-copper"
  }, value > 0 && commission ? (commission / value * 100).toFixed(1) + "%" : "—"))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Stage"), React.createElement("div", {
    className: "cn-stage-picker"
  }, window.STAGES.filter(s => s.id !== "won" && s.id !== "lost").map(s => React.createElement("button", {
    key: s.id,
    className: `cn-stage-step ${stage === s.id ? "is-active" : ""}`,
    onClick: () => setStage(s.id)
  }, React.createElement("span", {
    className: "cn-stage-step-label"
  }, s.label), React.createElement("span", {
    className: "cn-stage-step-prob cn-mono"
  }, (s.prob * 100).toFixed(0), "%"))))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Owner"), React.createElement("select", {
    className: "cn-input",
    value: ownerId,
    onChange: e => setOwnerId(e.target.value)
  }, window.REPS.map(r => React.createElement("option", {
    key: r.id,
    value: r.id
  }, r.name)))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Expected close"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: closeDate,
    onChange: e => setCloseDate(e.target.value)
  }))), error && React.createElement("div", {
    className: "cn-login-error"
  }, error))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose,
    disabled: saving
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: save,
    disabled: saving || scenario.accounts.length === 0
  }, saving ? "Creating…" : "Create opportunity"))));
}
function NewContactModal({
  open,
  onClose,
  scenario,
  currentUser,
  onSaved,
  prefillAccountId
}) {
  var [name, setName] = useState("");
  var [title, setTitle] = useState("");
  var [email, setEmail] = useState("");
  var [phone, setPhone] = useState("");
  var [tier, setTier] = useState("Influencer");
  var [accountId, setAccountId] = useState("");
  var [ownerId, setOwnerId] = useState(currentUser?.id || "");
  var [saving, setSaving] = useState(false);
  var [error, setError] = useState(null);
  useEffect(() => {
    if (open) {
      setName("");
      setTitle("");
      setEmail("");
      setPhone("");
      setTier("Influencer");
      setAccountId(prefillAccountId || scenario.accounts[0]?.id || "");
      setOwnerId(currentUser?.id || "");
      setError(null);
    }
  }, [open, currentUser?.id, prefillAccountId]);
  if (!open) return null;
  var isDirty = () => name.trim().length > 0;
  var save = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!accountId) {
      setError("Pick an account.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await window.insertContact({
        name: name.trim(),
        title,
        email,
        phone,
        tier,
        account_id: accountId,
        owner_id: ownerId
      });
      var acctName = window.accountOf(accountId, scenario)?.name || "";
      window.cnToast({
        title: `Added ${name.trim()}`,
        sub: `${title || "Contact"} at ${acctName}`
      });
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: window.makeBackdropHandler(isDirty, onClose)
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
  }, "New contact"), React.createElement("h2", {
    className: "cn-modal-title"
  }, "Add a person")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, scenario.accounts.length === 0 ? React.createElement("p", {
    style: {
      color: "var(--cn-mute)",
      lineHeight: 1.6
    }
  }, "Create an account first \u2014 every contact belongs to a company. Go to Accounts \u2192 New account.") : React.createElement(Fragment, null, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Full name"), React.createElement("input", {
    className: "cn-input",
    value: name,
    onChange: e => setName(e.target.value),
    autoFocus: true,
    placeholder: "e.g. Anya Reinhardt"
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Title"), React.createElement("input", {
    className: "cn-input",
    value: title,
    onChange: e => setTitle(e.target.value),
    placeholder: "VP, Infrastructure"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Account"), React.createElement(SearchableSelect, {
    value: accountId,
    onChange: setAccountId,
    options: scenario.accounts.map(a => ({
      value: a.id,
      label: a.name,
      subtext: a.industry
    })),
    placeholder: "Search accounts\u2026"
  }))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Email"), React.createElement("input", {
    className: "cn-input",
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value),
    placeholder: "name@company.com"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Phone"), React.createElement("input", {
    className: "cn-input",
    value: phone,
    onChange: e => setPhone(e.target.value),
    placeholder: "+1 555 555 0100"
  }))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Tier"), React.createElement("div", {
    className: "cn-chip-row"
  }, ["Champion", "Decision Maker", "Influencer", "Gatekeeper"].map(t => React.createElement("button", {
    key: t,
    className: `cn-chip-btn ${tier === t ? "is-active" : ""}`,
    onClick: () => setTier(t)
  }, t)))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Owner"), React.createElement("select", {
    className: "cn-input",
    value: ownerId,
    onChange: e => setOwnerId(e.target.value)
  }, window.REPS.map(r => React.createElement("option", {
    key: r.id,
    value: r.id
  }, r.name))), React.createElement("div", {
    className: "cn-field-help"
  }, "This contact is owned by the assigned rep. Other reps can see it but should not touch it without permission.")), error && React.createElement("div", {
    className: "cn-login-error"
  }, error))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose,
    disabled: saving
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: save,
    disabled: saving || scenario.accounts.length === 0
  }, saving ? "Adding…" : "Add contact"))));
}
function NewAccountModal({
  open,
  onClose,
  onSaved,
  account = null,
  currentUser,
  scenario,
  onOpenAccount,
  onMerge
}) {
  var isEdit = !!account;
  var [name, setName] = useState("");
  var [industry, setIndustry] = useState("");
  var [hq, setHq] = useState("");
  var [size, setSize] = useState("");
  var [website, setWebsite] = useState("");
  var [ownerId, setOwnerId] = useState("");
  var [company, setCompany] = useState("");
  var [isPartner, setIsPartner] = useState(false);
  var [saving, setSaving] = useState(false);
  var [error, setError] = useState(null);
  useEffect(() => {
    if (open) {
      setName(account?.name || "");
      setIndustry(account?.industry || "");
      setHq(account?.hq || "");
      setSize(account?.size || "");
      setWebsite(account?.website || "");
      setOwnerId(account?.ownerId || currentUser?.id || "");
      setCompany(account?.company || window.CN_BRAND && window.CN_BRAND.company || "Chief Negotiators");
      setIsPartner(!!(account?.isPartner ?? account?.is_partner));
      setError(null);
    }
  }, [open, account?.id, currentUser?.id]);
  if (!open) return null;
  var isDirty = () => name.trim().length > 0 || industry.trim().length > 0 || hq.trim().length > 0;
  var dupes = window.cnFindAcctDupes && scenario ? window.cnFindAcctDupes(name, website, scenario.accounts, account?.id) : [];
  var blocked = dupes.some(d => d.strength === "exact" || d.strength === "strong");
  var canReassign = isEdit && !!(window.CN_CROSS && window.CN_CROSS.isSuperAdmin && window.CN_CROSS.isSuperAdmin());
  var save = async () => {
    if (!name.trim()) {
      setError("Account name is required.");
      return;
    }
    if (blocked) {
      setError("That company is already in the CRM. Open the existing account or merge the two.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        var patch = {
          name: name.trim(),
          industry,
          hq,
          size,
          website,
          owner_id: ownerId || null,
          is_partner: isPartner
        };
        if (canReassign && company && company !== (account.company || "")) {
          patch.company = company;
          patch.company_changed_at = new Date().toISOString();
          patch.company_changed_by = currentUser?.name || null;
        }
        await window.updateAccount(account.id, patch);
        window.cnToast({
          title: `Saved ${name.trim()}`,
          sub: patch.company ? `Moved to ${window.CN_CROSS.companyLabel(patch.company)}` : "Account updated"
        });
      } else {
        await window.insertAccount({
          name: name.trim(),
          industry,
          hq,
          size,
          website,
          owner_id: ownerId || null,
          is_partner: isPartner
        });
        window.cnToast({
          title: `Added ${name.trim()}`,
          sub: industry ? `Industry: ${industry}` : "New account created"
        });
      }
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  var remove = async () => {
    if (!confirm(`Delete ${account.name}? Contacts and deals linked to this account will be unlinked.`)) return;
    setSaving(true);
    setError(null);
    try {
      await window.deleteAccount(account.id);
      window.cnToast({
        title: `Deleted ${account.name}`,
        kind: "success"
      });
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: window.makeBackdropHandler(isDirty, onClose)
  }, React.createElement("div", {
    className: "cn-modal",
    onClick: e => e.stopPropagation(),
    style: {
      width: 540
    }
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, isEdit ? "Edit account" : "New account"), React.createElement("h2", {
    className: "cn-modal-title"
  }, isEdit ? account.name : "Add a company")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Company name"), React.createElement("input", {
    className: "cn-input",
    value: name,
    onChange: e => setName(e.target.value),
    autoFocus: true,
    placeholder: "e.g. Lumen Compute Labs"
  }), window.AccountDupeWarning && scenario && React.createElement(window.AccountDupeWarning, {
    name: name,
    website: website,
    accounts: scenario.accounts,
    excludeId: account?.id,
    onOpen: a => {
      onClose();
      onOpenAccount && onOpenAccount(a.id);
    },
    onRequest: a => {
      onClose();
      onOpenAccount && onOpenAccount(a.id);
    },
    onMerge: a => {
      onClose();
      onMerge && onMerge({
        aId: a.id
      });
    }
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Industry"), React.createElement("input", {
    className: "cn-input",
    value: industry,
    onChange: e => setIndustry(e.target.value),
    placeholder: "AI Research"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Headcount"), React.createElement("input", {
    className: "cn-input",
    value: size,
    onChange: e => setSize(e.target.value),
    placeholder: "120"
  }))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "HQ"), React.createElement("input", {
    className: "cn-input",
    value: hq,
    onChange: e => setHq(e.target.value),
    placeholder: "Palo Alto, CA"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Website"), React.createElement("input", {
    className: "cn-input",
    value: website,
    onChange: e => setWebsite(e.target.value),
    placeholder: "company.com"
  }))),
  // Partner accounts are jointly worked: both brands see the record and share
  // its contacts, activities and notes.
  React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Relationship"), React.createElement("button", {
    type: "button",
    className: "cn-acct-partner" + (isPartner ? " is-on" : ""),
    onClick: () => setIsPartner(v => !v),
    "aria-pressed": isPartner
  }, React.createElement("span", {
    className: "cn-acct-partner-box"
  }, isPartner ? "\u2713" : ""), React.createElement("span", null,
    React.createElement("strong", null, "Partner account"),
    React.createElement("em", null, "Shared with both brands \u2014 contacts, activity and notes are visible to Chief Negotiators and SSP alike.")))),
  React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Owner"), React.createElement("select", {
    className: "cn-input",
    value: ownerId,
    onChange: e => setOwnerId(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "\u2014 Unassigned \u2014"), window.REPS.map(r => React.createElement("option", {
    key: r.id,
    value: r.id
  }, r.name))), React.createElement("div", {
    className: "cn-field-help"
  }, "The rep who owns this account. Visible across the team \u2014 but only the owner should touch it.")), canReassign && React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Brand"), React.createElement("select", {
    className: "cn-input",
    value: company,
    onChange: e => setCompany(e.target.value)
  }, React.createElement("option", {
    value: "Chief Negotiators"
  }, "Chief Negotiators"), React.createElement("option", {
    value: "SSP"
  }, "Strategic Supply Partners")), React.createElement("div", {
    className: "cn-field-help"
  }, "Which business owns this account. You can move it either way without a claim \u2014 the change is stamped with your name and the time.", account?.company && company !== account.company && React.createElement("b", null, " Moving out of ", window.CN_CROSS.companyLabel(account.company), "."))), error && React.createElement("div", {
    className: "cn-login-error"
  }, error)), React.createElement("footer", {
    className: "cn-modal-foot"
  }, isEdit && React.createElement("button", {
    className: "cn-btn cn-btn--danger",
    onClick: remove,
    disabled: saving
  }, "Delete"), React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 10
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose,
    disabled: saving
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: save,
    disabled: saving || blocked,
    title: blocked ? "This company is already in the CRM" : ""
  }, saving ? isEdit ? "Saving…" : "Adding…" : isEdit ? "Save changes" : "Add account")))));
}
function OppDetailDrawer({
  open,
  onClose,
  oppId,
  scenario,
  onOpenContact,
  onSaved
}) {
  var [editing, setEditing] = useState(false);
  var [draft, setDraft] = useState(null);
  var [original, setOriginal] = useState(null);
  var [busy, setBusy] = useState(false);
  var [error, setError] = useState(null);
  useEffect(() => {
    if (!open || !oppId) return;
    var o = scenario.opps.find(o => o.id === oppId) || (scenario.allOpps || []).find(o => o.id === oppId);
    if (o) {
      var seed = {
        title: o.title,
        product: o.product || "",
        value: o.value,
        commissionRate: o.commissionRate,
        commissionAmount: window.cnCommission(o),
        commissionStatus: o.commissionStatus || "earned",
        splitPartner: o.splitPartner || "",
        splitPartnerAmount: o.splitPartnerAmount != null ? o.splitPartnerAmount : "",
        referralPartner: o.referralPartner || "",
        referralPayout: o.referralPayout != null ? o.referralPayout : "",
        nextStep: o.nextStep || "",
        nextStepDue: o.nextStepDue || "",
        stage: o.stage,
        ownerId: o.ownerId,
        contactId: o.contactId,
        accountId: o.accountId,
        close: o.close || ""
      };
      setDraft(seed);
      setOriginal(seed);
      setEditing(false);
      setError(null);
    }
  }, [open, oppId]);
  if (!open || !oppId || !draft) return null;
  var opp = scenario.opps.find(o => o.id === oppId) || (scenario.allOpps || []).find(o => o.id === oppId);
  if (!opp) return null;
  if (opp.isOther) {
    var rep2 = window.repOf(opp.ownerId);
    return React.createElement("div", {
      className: "cn-drawer-scrim",
      onClick: onClose
    }, React.createElement("aside", {
      className: "cn-drawer cn-drawer--wide",
      onClick: e => e.stopPropagation()
    }, React.createElement("header", {
      className: "cn-drawer-head"
    }, React.createElement("div", null, React.createElement("div", {
      className: "cn-card-eyebrow"
    }, opp.accountName || "—", " \xB7 ", opp.product || "—"), React.createElement("h2", {
      className: "cn-drawer-title"
    }, opp.title)), React.createElement("button", {
      className: "cn-icon-btn",
      onClick: onClose
    }, "\u2715")), React.createElement("div", {
      className: "cn-drawer-body"
    }, React.createElement("div", {
      className: "cn-shared-note"
    }, React.createElement(window.CompanyTag, {
      company: opp.company
    }), React.createElement("span", null, "Shared deal owned by ", window.cnCompanyLabel(opp.company), ". Contact details are private to that company.")), React.createElement("div", {
      className: "cn-opp-strip"
    }, React.createElement("div", null, React.createElement("div", {
      className: "cn-strip-label"
    }, "Value"), React.createElement("div", {
      className: "cn-strip-value cn-mono"
    }, window.fmtUSD(opp.value))), React.createElement("div", null, React.createElement("div", {
      className: "cn-strip-label"
    }, "Stage"), React.createElement("div", null, React.createElement(StagePill, {
      stage: opp.stage
    }))), React.createElement("div", null, React.createElement("div", {
      className: "cn-strip-label"
    }, "Close"), React.createElement("div", {
      className: "cn-strip-value"
    }, opp.close || "—"))), React.createElement("div", {
      className: "cn-drawer-section"
    }, React.createElement("div", {
      className: "cn-card-eyebrow"
    }, "Customer"), React.createElement("div", {
      className: "cn-detail-row"
    }, React.createElement("span", null, "Company"), React.createElement("strong", null, opp.accountName || "—")), React.createElement("div", {
      className: "cn-detail-row"
    }, React.createElement("span", null, "Contact"), React.createElement("strong", {
      className: "cn-muted"
    }, "Private \xB7 ", window.cnCompanyLabel(opp.company))), React.createElement("div", {
      className: "cn-detail-row"
    }, React.createElement("span", null, "Owner"), React.createElement("strong", null, rep2.name)), React.createElement("div", {
      className: "cn-detail-row"
    }, React.createElement("span", null, "Product"), React.createElement("strong", null, opp.product || "—"))))));
  }
  var acct = window.accountOf(opp.accountId, scenario) || {
    name: opp.accountName || "—"
  };
  var contact = window.contactOf(opp.contactId, scenario);
  var oppActivities = scenario.activities.filter(a => a.oppId === opp.id);
  var rep = window.repOf(opp.ownerId);
  var draftAcct = window.accountOf(draft.accountId, scenario) || {
    name: opp.accountName || "—"
  };
  var accountContacts = scenario.contacts.filter(c => c.accountId === draft.accountId);
  var isDirty = () => editing && original && JSON.stringify(draft) !== JSON.stringify(original);
  var STAGE_ORDER = ["ncnda", "intro_partner", "intro_call", "quote", "negotiate", "won"];
  var changeStage = async newStage => {
    setBusy(true);
    setError(null);
    try {
      await window.updateOpportunity(opp.id, {
        stage: newStage
      });
      onSaved && onSaved();
      setDraft(d => ({
        ...d,
        stage: newStage
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  var advance = () => {
    var idx = STAGE_ORDER.indexOf(opp.stage);
    if (idx >= 0 && idx < STAGE_ORDER.length - 1) changeStage(STAGE_ORDER[idx + 1]);
  };
  var saveEdits = async () => {
    setBusy(true);
    setError(null);
    try {
      var commissionAmount = Math.round(parseFloat(draft.commissionAmount) || 0);
      await window.updateOpportunity(opp.id, {
        title: draft.title,
        product: draft.product,
        value_cents: Math.round(draft.value * 100),
        commission_rate: draft.value > 0 ? commissionAmount / draft.value : 0,
        owner_id: draft.ownerId,
        contact_id: draft.contactId || null,
        account_id: draft.accountId,
        stage: draft.stage,
        expected_close: draft.close || null
      });
      window.cnSetDealMeta(opp.id, {
        commissionAmount,
        commissionStatus: draft.commissionStatus || "earned",
        splitPartner: (draft.splitPartner || "").trim(),
        splitPartnerAmount: draft.splitPartnerAmount === "" ? null : Math.round(parseFloat(draft.splitPartnerAmount) || 0),
        referralPartner: (draft.referralPartner || "").trim(),
        referralPayout: draft.referralPayout === "" ? 0 : Math.round(parseFloat(draft.referralPayout) || 0),
        nextStep: (draft.nextStep || "").trim(),
        nextStepDue: draft.nextStepDue || ""
      });
      window.cnToast({
        title: `Saved ${draft.title}`,
        sub: "Opportunity updated"
      });
      onSaved && onSaved();
      setOriginal(draft);
      setEditing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  var deleteOpp = async () => {
    if (!confirm(`Delete "${opp.title}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await window.deleteOpportunity(opp.id);
      window.cnToast({
        title: `Deleted ${opp.title}`,
        kind: "success"
      });
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return React.createElement("div", {
    className: "cn-drawer-scrim",
    onClick: window.makeBackdropHandler(isDirty, onClose)
  }, React.createElement("aside", {
    className: "cn-drawer cn-drawer--wide",
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-drawer-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, (editing ? draftAcct : acct)?.name || "—", " \xB7 ", (editing ? draft.product : opp.product) || "—"), editing ? React.createElement("input", {
    className: "cn-input cn-drawer-title-input",
    value: draft.title,
    onChange: e => setDraft(d => ({
      ...d,
      title: e.target.value
    })),
    placeholder: "Deal title"
  }) : React.createElement("h2", {
    className: "cn-drawer-title"
  }, opp.title)), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: () => isDirty() ? confirm("You have unsaved changes. Discard?") && (setEditing(false), onClose()) : onClose()
  }, "\u2715")), React.createElement("div", {
    className: "cn-drawer-body"
  }, React.createElement("div", {
    className: "cn-opp-strip"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-strip-label"
  }, "Value"), editing ? React.createElement("div", {
    className: "cn-money-input",
    style: {
      marginTop: 4
    }
  }, React.createElement("span", null, "$"), React.createElement("input", {
    className: "cn-input cn-mono",
    value: draft.value.toLocaleString(),
    onChange: e => setDraft(d => ({
      ...d,
      value: parseInt(e.target.value.replace(/,/g, "") || "0", 10)
    }))
  })) : React.createElement("div", {
    className: "cn-strip-value cn-mono"
  }, window.fmtUSD(opp.value))), React.createElement("div", null, React.createElement("div", {
    className: "cn-strip-label"
  }, "Stage"), React.createElement("div", null, React.createElement(StagePill, {
    stage: opp.stage
  }))), React.createElement("div", null, React.createElement("div", {
    className: "cn-strip-label"
  }, "Commission"), editing ? React.createElement("div", {
    className: "cn-money-input",
    style: {
      marginTop: 4
    }
  }, React.createElement("span", null, "$"), React.createElement("input", {
    className: "cn-input cn-mono",
    placeholder: "0",
    value: draft.commissionAmount === "" ? "" : Number(draft.commissionAmount).toLocaleString(),
    onChange: e => setDraft(d => ({
      ...d,
      commissionAmount: parseInt(e.target.value.replace(/,/g, "") || "0", 10)
    }))
  })) : React.createElement("div", {
    className: "cn-strip-value cn-mono cn-copper"
  }, window.fmtUSD(window.cnCommission(opp)), React.createElement("span", {
    className: "cn-strip-sub cn-mono"
  }, window.cnEffectiveRate(opp) ? (window.cnEffectiveRate(opp) * 100).toFixed(1) + "% eff." : "", opp.splitPartnerAmount ? " · net " + window.fmtUSD(window.cnNetCommission(opp)) : ""))), React.createElement("div", null, React.createElement("div", {
    className: "cn-strip-label"
  }, "Owner"), editing ? React.createElement("select", {
    className: "cn-input",
    value: draft.ownerId || "",
    onChange: e => setDraft(d => ({
      ...d,
      ownerId: e.target.value
    })),
    style: {
      marginTop: 4
    }
  }, window.REPS.map(r => React.createElement("option", {
    key: r.id,
    value: r.id
  }, r.name))) : React.createElement("div", {
    className: "cn-strip-value"
  }, rep ? React.createElement(Fragment, null, React.createElement("span", {
    className: "cn-avatar cn-avatar--xs"
  }, rep.initials), " ", rep.name) : "—")), React.createElement("div", null, React.createElement("div", {
    className: "cn-strip-label"
  }, "Close"), editing ? React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: (() => {
      var d = new Date(draft.close);
      return draft.close && !isNaN(d) ? d.toISOString().slice(0, 10) : "";
    })(),
    onChange: e => setDraft(d => ({
      ...d,
      close: e.target.value
    })),
    style: {
      marginTop: 4
    }
  }) : React.createElement("div", {
    className: "cn-strip-value"
  }, opp.close))), editing && React.createElement("section", {
    className: "cn-edit-extras"
  }, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginBottom: 10
    }
  }, "Account & contact"), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Account"), React.createElement(SearchableSelect, {
    value: draft.accountId,
    onChange: v => setDraft(d => ({
      ...d,
      accountId: v,
      contactId: ""
    })),
    options: scenario.accounts.map(a => ({
      value: a.id,
      label: a.name,
      subtext: a.industry
    })),
    placeholder: "Search accounts\u2026"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Primary contact"), React.createElement(SearchableSelect, {
    value: draft.contactId || "",
    onChange: v => setDraft(d => ({
      ...d,
      contactId: v
    })),
    options: [{
      value: "",
      label: "— None —"
    }, ...accountContacts.map(c => ({
      value: c.id,
      label: c.name,
      subtext: c.title
    }))],
    placeholder: accountContacts.length === 0 ? "No contacts at this account" : "Search contacts…"
  }))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Product / brand"), React.createElement("input", {
    className: "cn-input",
    value: draft.product,
    onChange: e => setDraft(d => ({
      ...d,
      product: e.target.value
    })),
    placeholder: "e.g. NVIDIA \u2014 H200"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Stage"), React.createElement("div", {
    className: "cn-stage-picker"
  }, window.STAGES.filter(s => s.id !== "won" && s.id !== "lost").map(s => React.createElement("button", {
    key: s.id,
    type: "button",
    className: `cn-stage-step ${draft.stage === s.id ? "is-active" : ""}`,
    onClick: () => setDraft(d => ({
      ...d,
      stage: s.id
    }))
  }, React.createElement("span", {
    className: "cn-stage-step-label"
  }, s.label), React.createElement("span", {
    className: "cn-stage-step-prob cn-mono"
  }, (s.prob * 100).toFixed(0), "%"))))), React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      margin: "22px 0 10px"
    }
  }, "Commission & payout"), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Commission (USD)"), React.createElement("div", {
    className: "cn-money-input"
  }, React.createElement("span", null, "$"), React.createElement("input", {
    className: "cn-input cn-mono",
    placeholder: "0",
    value: draft.commissionAmount === "" ? "" : Number(draft.commissionAmount).toLocaleString(),
    onChange: e => setDraft(d => ({
      ...d,
      commissionAmount: parseInt(e.target.value.replace(/,/g, "") || "0", 10)
    }))
  }))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Status"), React.createElement("div", {
    className: "cn-seg"
  }, window.CN_COMMISSION_STATUSES.map(s => React.createElement("button", {
    key: s.id,
    type: "button",
    className: draft.commissionStatus === s.id ? "is-active" : "",
    onClick: () => setDraft(d => ({
      ...d,
      commissionStatus: s.id
    }))
  }, s.label))))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.4
    }
  }, React.createElement("label", null, "Split with (co-party)"), React.createElement("input", {
    className: "cn-input",
    list: "cn-split-parties",
    placeholder: "e.g. SSP",
    value: draft.splitPartner,
    onChange: e => setDraft(d => ({
      ...d,
      splitPartner: e.target.value
    }))
  }), React.createElement("datalist", {
    id: "cn-split-parties"
  }, React.createElement("option", {
    value: "SSP"
  }), React.createElement("option", {
    value: "Chief Negotiators"
  }))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Their share (USD)"), React.createElement("div", {
    className: "cn-money-input"
  }, React.createElement("span", null, "$"), React.createElement("input", {
    className: "cn-input cn-mono",
    placeholder: "0",
    value: draft.splitPartnerAmount === "" ? "" : Number(draft.splitPartnerAmount).toLocaleString(),
    onChange: e => setDraft(d => ({
      ...d,
      splitPartnerAmount: e.target.value === "" ? "" : parseInt(e.target.value.replace(/,/g, "") || "0", 10)
    }))
  }))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "CN net"), React.createElement("div", {
    className: "cn-readout cn-mono cn-copper"
  }, window.fmtUSD(Math.max(0, (parseFloat(draft.commissionAmount) || 0) - (parseFloat(draft.splitPartnerAmount) || 0)))))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.4
    }
  }, React.createElement("label", null, "Referral partner (payout)"), React.createElement("input", {
    className: "cn-input",
    placeholder: "Partner who sent this",
    value: draft.referralPartner,
    onChange: e => setDraft(d => ({
      ...d,
      referralPartner: e.target.value
    }))
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Referral payout (USD)"), React.createElement("div", {
    className: "cn-money-input"
  }, React.createElement("span", null, "$"), React.createElement("input", {
    className: "cn-input cn-mono",
    placeholder: "0",
    value: draft.referralPayout === "" ? "" : Number(draft.referralPayout).toLocaleString(),
    onChange: e => setDraft(d => ({
      ...d,
      referralPayout: e.target.value === "" ? "" : parseInt(e.target.value.replace(/,/g, "") || "0", 10)
    }))
  })))), React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      margin: "22px 0 10px"
    }
  }, "Next step"), React.createElement("div", {
    className: "cn-field-row",
    style: {
      marginBottom: 0
    }
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 2
    }
  }, React.createElement("label", null, "What needs to happen next"), React.createElement("input", {
    className: "cn-input",
    placeholder: "e.g. Send revised quote, book intro call\u2026",
    value: draft.nextStep,
    onChange: e => setDraft(d => ({
      ...d,
      nextStep: e.target.value
    }))
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Due"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: draft.nextStepDue || "",
    onChange: e => setDraft(d => ({
      ...d,
      nextStepDue: e.target.value
    }))
  })))), !editing && (() => {
    var overdue = opp.nextStepDue && window.cnDaysUntilDate && window.cnDaysUntilDate(opp.nextStepDue) < 0;
    return React.createElement("section", {
      className: `cn-nextstep ${overdue ? "is-overdue" : ""}`,
      style: {
        marginTop: 18
      }
    }, React.createElement("div", {
      className: "cn-nextstep-ic"
    }, "\u2192"), React.createElement("div", {
      className: "cn-nextstep-body"
    }, React.createElement("div", {
      className: "cn-nextstep-label"
    }, "Next step"), opp.nextStep ? React.createElement("div", {
      className: "cn-nextstep-text"
    }, opp.nextStep, opp.nextStepDue && React.createElement("span", {
      className: "cn-nextstep-due"
    }, overdue ? "overdue · " : "due ", opp.nextStepDue)) : React.createElement("div", {
      className: "cn-nextstep-text cn-nextstep-empty"
    }, "No next step set \u2014 click Edit to add one so this deal keeps moving.")), React.createElement("button", {
      className: "cn-btn cn-btn--ghost cn-btn--sm",
      onClick: () => setEditing(true)
    }, opp.nextStep ? "Update" : "Set"));
  })(), !editing && (window.cnCommission(opp) > 0 || opp.splitPartner || opp.referralPayout > 0) && React.createElement("section", {
    className: "cn-comm-summary",
    style: {
      marginTop: 18
    }
  }, React.createElement("div", {
    className: "cn-comm-summary-row"
  }, React.createElement("span", null, "Commission"), React.createElement("strong", {
    className: "cn-mono cn-copper"
  }, window.fmtUSD(window.cnCommission(opp)))), opp.splitPartner && React.createElement("div", {
    className: "cn-comm-summary-row"
  }, React.createElement("span", null, "Split \u2192 ", opp.splitPartner), React.createElement("strong", {
    className: "cn-mono"
  }, "\u2212", window.fmtUSD(window.cnSplitOther(opp)))), opp.splitPartner && React.createElement("div", {
    className: "cn-comm-summary-row cn-comm-summary-row--net"
  }, React.createElement("span", null, "CN net"), React.createElement("strong", {
    className: "cn-mono"
  }, window.fmtUSD(window.cnNetCommission(opp)))), opp.referralPayout > 0 && React.createElement("div", {
    className: "cn-comm-summary-row"
  }, React.createElement("span", null, "Referral payout", opp.referralPartner ? " → " + opp.referralPartner : ""), React.createElement("strong", {
    className: "cn-mono"
  }, "\u2212", window.fmtUSD(opp.referralPayout))), React.createElement("div", {
    className: "cn-comm-summary-row"
  }, React.createElement("span", null, "Status"), React.createElement("span", {
    className: `cn-comm-stat cn-comm-stat--${opp.commissionStatus}`
  }, (window.CN_COMMISSION_STATUSES.find(s => s.id === opp.commissionStatus) || {}).label || "Earned"))), !editing && opp.stage !== "won" && opp.stage !== "lost" && React.createElement("section", {
    style: {
      marginTop: 20
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Move this deal"), React.createElement("div", {
    className: "cn-stage-actions"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: advance,
    disabled: busy || opp.stage === "negotiate"
  }, "\u2192 Advance to ", STAGE_ORDER[STAGE_ORDER.indexOf(opp.stage) + 1] ? window.stageOf(STAGE_ORDER[STAGE_ORDER.indexOf(opp.stage) + 1]).label : "—"), React.createElement("button", {
    className: "cn-btn cn-btn--win",
    onClick: () => changeStage("won"),
    disabled: busy
  }, "\u2713 Mark Won"), React.createElement("button", {
    className: "cn-btn cn-btn--lose",
    onClick: () => changeStage("lost"),
    disabled: busy
  }, "\u2715 Mark Lost"))), React.createElement("section", {
    style: {
      marginTop: 24
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Stage progression"), React.createElement("div", {
    className: "cn-progress"
  }, window.STAGES.filter(s => s.id !== "lost").map((s, i, arr) => {
    var idx = arr.findIndex(x => x.id === opp.stage);
    var state = i < idx ? "done" : i === idx ? "current" : "future";
    return React.createElement("button", {
      key: s.id,
      className: `cn-progress-step cn-progress-step--${state} cn-progress-step--clickable`,
      onClick: () => changeStage(s.id),
      disabled: busy || editing
    }, React.createElement("div", {
      className: "cn-progress-dot"
    }, state === "done" ? "✓" : i + 1), React.createElement("div", {
      className: "cn-progress-label"
    }, s.label));
  }))), !editing && window.cnGpuTrack && window.cnGpuTrack.read(opp.id) ? React.createElement("section", {
    style: {
      marginTop: 24,
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, window.cnGpuTrack.panelEl({
    opp: opp,
    currentUser: window.cnCurrentUser,
    onChanged: onSaved
  }), window.cnCommissionUI && window.cnCommissionUI.panelEl ? window.cnCommissionUI.panelEl({
    opp: opp,
    currentUser: window.cnCurrentUser
  }) : null) : null, !editing && React.createElement(window.QuotesSection, {
    opp: opp,
    account: acct,
    contact: contact,
    onValueUpdated: onSaved
  }), contact && !editing && React.createElement("section", {
    style: {
      marginTop: 28
    }
  }, React.createElement("h3", {
    className: "cn-side-title"
  }, "Primary contact"), React.createElement("button", {
    className: "cn-contact-row",
    onClick: () => onOpenContact(contact.id)
  }, React.createElement("span", {
    className: "cn-avatar"
  }, contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)), React.createElement("span", null, React.createElement("div", {
    className: "cn-cell-primary"
  }, contact.name), React.createElement("div", {
    className: "cn-cell-secondary"
  }, contact.title, " \xB7 ", contact.email)), React.createElement("span", {
    className: "cn-link",
    style: {
      marginLeft: "auto"
    }
  }, "Open \u2192"))), oppActivities.length > 0 && !editing && React.createElement("section", {
    style: {
      marginTop: 28
    }
  }, React.createElement("h3", {
    className: "cn-side-title"
  }, "Activity on this deal"), React.createElement("div", {
    className: "cn-timeline"
  }, oppActivities.map((a, i) => React.createElement("div", {
    key: a.id,
    className: "cn-tl-item"
  }, React.createElement("div", {
    className: "cn-tl-spine"
  }, React.createElement("div", {
    className: `cn-tl-dot cn-tl-dot--${a.type}`
  }, a.type === "call" && "☎", a.type === "email" && "✉", a.type === "note" && "✎", a.type === "won" && "✓", a.type === "task" && "◯"), i < oppActivities.length - 1 && React.createElement("div", {
    className: "cn-tl-line"
  })), React.createElement("div", {
    className: "cn-tl-content"
  }, React.createElement("div", {
    className: "cn-tl-head"
  }, React.createElement("span", {
    className: "cn-tl-title"
  }, a.type === "call" && "Call", a.type === "email" && a.subject, a.type === "note" && "Note", a.type === "task" && "Task", a.type === "won" && "Won"), React.createElement("span", {
    className: "cn-tl-when"
  }, a.when)), a.summary && React.createElement("p", {
    className: "cn-tl-body"
  }, a.summary)))))), error && React.createElement("div", {
    className: "cn-login-error",
    style: {
      marginTop: 16
    }
  }, error)), React.createElement("footer", {
    className: "cn-drawer-foot"
  }, editing ? React.createElement(Fragment, null, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => {
      if (isDirty() && !confirm("Discard changes?")) return;
      setDraft(original);
      setEditing(false);
    },
    disabled: busy
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: saveEdits,
    disabled: busy
  }, busy ? "Saving…" : "Save changes")) : React.createElement(Fragment, null, React.createElement("button", {
    className: "cn-btn cn-btn--danger",
    onClick: deleteOpp,
    disabled: busy
  }, "Delete"), React.createElement("div", {
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
    onClick: () => setEditing(true),
    disabled: busy
  }, "Edit"))))));
}
Object.assign(window, {
  LogCallDrawer,
  NewOppModal,
  OppDetailDrawer,
  NewContactModal,
  NewAccountModal,
  EditActivityModal,
  linkableOpps,
  oppSubtext
});
function EditActivityModal({
  open,
  onClose,
  activity,
  scenario,
  onSaved
}) {
  var [type, setType] = useState("note");
  var [summary, setSummary] = useState("");
  var [subject, setSubject] = useState("");
  var [sentiment, setSentiment] = useState("neutral");
  var [duration, setDuration] = useState(25);
  var [saving, setSaving] = useState(false);
  var [error, setError] = useState(null);
  useEffect(() => {
    if (open && activity) {
      setType(activity.type || "note");
      setSummary(activity.summary || "");
      setSubject(activity.subject || "");
      setSentiment(activity.sentiment || "neutral");
      setDuration(activity.duration || 25);
      setError(null);
    }
  }, [open, activity?.id]);
  if (!open || !activity) return null;
  var save = async () => {
    setSaving(true);
    setError(null);
    try {
      await window.updateActivity(activity.id, {
        type,
        summary,
        subject,
        sentiment: type === "call" ? sentiment : null,
        duration_min: type === "call" ? duration : null
      });
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  var remove = async () => {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    setSaving(true);
    setError(null);
    try {
      await window.deleteActivity(activity.id);
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose
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
  }, "Edit activity"), React.createElement("h2", {
    className: "cn-modal-title"
  }, activity.when)), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Type"), React.createElement("div", {
    className: "cn-segmented cn-segmented--full"
  }, ["call", "email", "note", "task"].map(s => React.createElement("button", {
    key: s,
    className: type === s ? "is-active" : "",
    onClick: () => setType(s)
  }, s)))), type === "email" && React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Subject"), React.createElement("input", {
    className: "cn-input",
    value: subject,
    onChange: e => setSubject(e.target.value),
    placeholder: "Email subject"
  })), type === "call" && React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Duration"), React.createElement("div", {
    className: "cn-stepper"
  }, React.createElement("button", {
    onClick: () => setDuration(Math.max(1, duration - 5))
  }, "\u2212"), React.createElement("span", {
    className: "cn-mono"
  }, duration, " min"), React.createElement("button", {
    onClick: () => setDuration(duration + 5)
  }, "+"))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Sentiment"), React.createElement("div", {
    className: "cn-segmented cn-segmented--full"
  }, ["positive", "neutral", "negative"].map(s => React.createElement("button", {
    key: s,
    className: sentiment === s ? "is-active" : "",
    onClick: () => setSentiment(s)
  }, s))))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, type === "task" ? "Task" : "Notes"), React.createElement("textarea", {
    className: "cn-textarea",
    rows: "6",
    value: summary,
    onChange: e => setSummary(e.target.value)
  })), error && React.createElement("div", {
    className: "cn-login-error"
  }, error)), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--danger",
    onClick: remove,
    disabled: saving
  }, "Delete"), React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 10
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose,
    disabled: saving
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: save,
    disabled: saving
  }, saving ? "Saving…" : "Save changes")))));
}
function AddTaskModal({
  open,
  onClose,
  scenario,
  currentUser,
  onSaved,
  prefillContactId
}) {
  var [summary, setSummary] = useState("");
  var [due, setDue] = useState(() => window.cnDay());
  var [oppLink, setOppLink] = useState("");
  var [contactId, setContactId] = useState("");
  var [ownerId, setOwnerId] = useState(currentUser?.id || "");
  var [saving, setSaving] = useState(false);
  var [error, setError] = useState(null);
  useEffect(() => {
    if (open) {
      setSummary("");
      setDue(window.cnDay());
      setOppLink("");
      setContactId(prefillContactId || "");
      setOwnerId(currentUser?.id || "");
      setError(null);
    }
  }, [open, currentUser?.id, prefillContactId]);
  if (!open) return null;
  var muted = {
    color: "var(--cn-mute)",
    textTransform: "none",
    letterSpacing: 0,
    fontSize: 11
  };
  var linkedContact = contactId ? scenario.contacts.find(c => c.id === contactId) : null;
  var contactOpps = window.linkableOpps(scenario, linkedContact?.accountId);
  var save = async () => {
    if (!summary.trim()) {
      setError("Add a short description of the task.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      var occurred = new Date(due + "T12:00:00").toISOString();
      await window.insertActivity({
        type: "task",
        owner_id: ownerId || currentUser?.id || null,
        contact_id: contactId || null,
        opportunity_id: oppLink || null,
        summary: summary.trim(),
        occurred_at: occurred
      });
      window.cnToast && window.cnToast({
        title: "Task added",
        sub: summary.trim().slice(0, 70)
      });
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose
  }, React.createElement("div", {
    className: "cn-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Follow-up"), React.createElement("h2", {
    className: "cn-modal-title"
  }, "Add task")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Task"), React.createElement("textarea", {
    className: "cn-textarea",
    rows: "3",
    placeholder: "e.g. Call Dan to confirm PO timing before Friday",
    value: summary,
    onChange: e => setSummary(e.target.value)
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Due"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: due,
    onChange: e => setDue(e.target.value)
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Owner"), React.createElement("select", {
    className: "cn-input",
    value: ownerId,
    onChange: e => setOwnerId(e.target.value)
  }, window.REPS.map(r => React.createElement("option", {
    key: r.id,
    value: r.id
  }, r.name))))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Linked contact ", React.createElement("span", {
    style: muted
  }, "\xB7 optional")), React.createElement(SearchableSelect, {
    value: contactId,
    onChange: setContactId,
    options: [{
      value: "",
      label: "— None —"
    }, ...scenario.contacts.map(c => {
      var a = window.accountOf(c.accountId, scenario);
      return {
        value: c.id,
        label: c.name,
        subtext: `${c.title ? c.title + " · " : ""}${a?.name || "—"}`
      };
    })],
    placeholder: "Search contacts\u2026"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Linked deal ", React.createElement("span", {
    style: muted
  }, "\xB7 optional")), React.createElement(SearchableSelect, {
    value: oppLink,
    onChange: setOppLink,
    options: [{
      value: "",
      label: "— None —"
    }, ...contactOpps.map(o => ({
      value: o.id,
      label: o.title,
      subtext: window.oppSubtext(o, scenario)
    }))],
    placeholder: "Search deals\u2026"
  })), error && React.createElement("div", {
    className: "cn-login-error"
  }, error)), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose,
    disabled: saving
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: save,
    disabled: saving
  }, saving ? "Adding…" : "Add task"))));
}