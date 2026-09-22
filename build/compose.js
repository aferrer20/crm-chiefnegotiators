function _csNewId(p) {
  return p + "-" + Math.random().toString(36).slice(2, 10);
}
function _csMerge(text, ctx) {
  var out = (text || "").replace(/\{\{(\w+)\}\}/g, (_, k) => ctx[k] != null ? ctx[k] : `{{${k}}}`);
  return window.fixSalutation ? window.fixSalutation(out) : out;
}
function _csQuoteShareUrl(quote) {
  return window.location.origin + window.location.pathname + "?quote=" + quote.shareToken;
}
function _csCurrency(cents) {
  var v = (cents || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(v);
}
function findQuotesForContact(contactId, scenario) {
  var opps = scenario.opps.filter(o => o.contactId === contactId);
  var out = [];
  opps.forEach(opp => {
    var quotes = window.cnQuotes?.readQuotes?.(opp.id) || [];
    quotes.forEach(q => out.push({
      quote: q,
      opp
    }));
  });
  return out.sort((a, b) => new Date(b.quote.updatedAt || b.quote.createdAt || 0) - new Date(a.quote.updatedAt || a.quote.createdAt || 0));
}
function ContactComposeDrawer({
  scenario,
  currentUser,
  initialContactId,
  initialQuoteIds,
  initialSubject,
  initialBody,
  onClose,
  onSaved
}) {
  var initialContact = scenario.contacts.find(c => c.id === initialContactId);
  var [recipients, setRecipients] = useState(initialContact ? [initialContact.id] : []);
  var [subject, setSubject] = useState(initialSubject || "");
  var [body, setBody] = useState(initialBody || (initialContact ? `Hi ${(initialContact.name || "").split(" ")[0]},\n\n` : ""));
  var [imageUrl, setImageUrl] = useState("");
  var [ctaText, setCtaText] = useState("");
  var [ctaUrl, setCtaUrl] = useState("");
  var [signature, setSignature] = useState(() => window.cnOutreach?.readSignature?.() ?? localStorage.getItem("cn-signature") ?? "");
  var [saveSig, setSaveSig] = useState(false);
  var [attachedQuoteRefs, setAttachedQuoteRefs] = useState(initialQuoteIds ? initialQuoteIds.map(q => ({
    oppId: q.oppId,
    quoteId: q.quoteId
  })) : []);
  var [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  var [createQuoteFor, setCreateQuoteFor] = useState(null);
  var [sending, setSending] = useState(false);
  var [sentResult, setSentResult] = useState(null);
  var [step, setStep] = useState(0);
  var [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    if (createQuoteFor !== null) return;
    setRefreshTick(t => t + 1);
  }, [createQuoteFor]);
  var primaryContact = scenario.contacts.find(c => c.id === recipients[0]);
  var primaryAcct = window.accountOf(primaryContact?.accountId, scenario);
  var availableQuotes = (() => {
    var refs = [];
    var seen = new Set();
    recipients.forEach(cid => {
      var list = findQuotesForContact(cid, scenario);
      list.forEach(({
        quote,
        opp
      }) => {
        var key = quote.id;
        if (seen.has(key)) return;
        seen.add(key);
        refs.push({
          quote,
          opp
        });
      });
    });
    return refs;
  })();
  void refreshTick;
  var isAttached = q => attachedQuoteRefs.find(r => r.quoteId === q.id);
  var toggleAttach = (opp, quote) => {
    if (isAttached(quote)) {
      setAttachedQuoteRefs(attachedQuoteRefs.filter(r => r.quoteId !== quote.id));
    } else {
      setAttachedQuoteRefs([...attachedQuoteRefs, {
        oppId: opp.id,
        quoteId: quote.id
      }]);
      if (!ctaText && !ctaUrl) {
        setCtaText("View & respond to quote →");
        setCtaUrl(_csQuoteShareUrl(quote));
      }
    }
  };
  var applyTemplate = t => {
    if (!t) return;
    if (t.subject) setSubject(t.subject);
    if (t.body) setBody(t.body);
    if (t.imageUrl) setImageUrl(t.imageUrl);
    if (t.ctaText && !ctaText) setCtaText(t.ctaText);
    if (t.ctaUrl && !ctaUrl) setCtaUrl(t.ctaUrl);
    setTemplatePickerOpen(false);
  };
  var startCreateQuote = () => {
    var eligibleOpps = scenario.opps.filter(o => recipients.includes(o.contactId));
    if (eligibleOpps.length === 0) {
      alert("This contact has no open deals yet. Create one from the contact's page first, then come back to quote.");
      return;
    }
    if (eligibleOpps.length === 1) {
      setCreateQuoteFor(eligibleOpps[0].id);
    } else {
      setCreateQuoteFor("ask");
    }
  };
  var removeRecipient = id => {
    if (recipients.length <= 1) return;
    setRecipients(recipients.filter(x => x !== id));
  };
  var addRecipient = c => {
    if (recipients.includes(c.id)) return;
    setRecipients([...recipients, c.id]);
  };
  var previewCtx = primaryContact ? {
    first_name: (primaryContact.name || "").split(" ")[0],
    last_name: (primaryContact.name || "").split(" ").slice(1).join(" "),
    company: primaryAcct?.name || "",
    title: primaryContact.title || "",
    sender_name: currentUser?.fullName || currentUser?.name || ""
  } : {
    first_name: "Friend",
    company: "",
    sender_name: currentUser?.name || ""
  };
  var attachedQuotes = attachedQuoteRefs.map(r => {
    var list = window.cnQuotes?.readQuotes?.(r.oppId) || [];
    return list.find(q => q.id === r.quoteId);
  }).filter(Boolean);
  var quoteLinksMarkup = attachedQuotes.length > 0 ? "\n\n" + attachedQuotes.map(q => `Quote ${q.quoteNumber} (v${q.version}) — ${_csQuoteShareUrl(q)}`).join("\n") : "";
  var previewBody = _csMerge(body, previewCtx) + quoteLinksMarkup + (signature.trim() ? "\n\n" + _csMerge(signature, previewCtx) : "");
  var send = async () => {
    if (sending) return;
    if (recipients.length === 0) {
      alert("Add at least one recipient.");
      return;
    }
    if (!subject.trim()) {
      alert("Add a subject line.");
      return;
    }
    setSending(true);
    if (saveSig) {
      if (window.cnOutreach?.writeSignature) window.cnOutreach.writeSignature(signature);else localStorage.setItem("cn-signature", signature);
    }
    var builtRecipients = recipients.map(id => scenario.contacts.find(c => c.id === id)).filter(c => c && c.email).map(c => {
      var acct = window.accountOf(c.accountId, scenario);
      return {
        contactId: c.id,
        email: (c.email || "").trim(),
        _name: c.name || "(no name)",
        ctx: {
          first_name: (c.name || "").split(" ")[0],
          last_name: (c.name || "").split(" ").slice(1).join(" "),
          company: acct?.name || "",
          title: c.title || "",
          sender_name: currentUser?.fullName || currentUser?.name || ""
        }
      };
    });
    var validRecipients = [];
    var droppedRecipients = [];
    builtRecipients.forEach(r => {
      if (window.isValidEmailAddress && window.isValidEmailAddress(r.email)) {
        var {
          _name,
          ...rest
        } = r;
        validRecipients.push(rest);
      } else {
        droppedRecipients.push(r);
      }
    });
    if (validRecipients.length === 0) {
      setSending(false);
      alert(builtRecipients.length === 0 ? "None of your recipients have an email address on file." : "None of your recipients have a valid email address.\n\n" + "Resend requires addresses like name@domain.com — no spaces, " + "no multiple emails in one field, must contain @ and a dot.");
      return;
    }
    if (droppedRecipients.length > 0) {
      var examples = droppedRecipients.slice(0, 5).map(d => `• ${d._name} — ${d.email || "(blank)"}`).join("\n");
      var proceed = confirm(`${droppedRecipients.length} recipient${droppedRecipients.length === 1 ? "" : "s"} have invalid email addresses and will be SKIPPED:\n\n` + examples + `\n\nSend to the remaining ${validRecipients.length}?`);
      if (!proceed) {
        setSending(false);
        return;
      }
    }
    var fullBody = body + quoteLinksMarkup + (signature.trim() ? "\n\n" + signature : "");
    var finalC = {
      id: _csNewId("c"),
      name: subject.slice(0, 80) + " · " + (primaryContact?.name || "compose"),
      audienceMode: "manual",
      manualIds: recipients,
      audience: {
        hasEmail: true
      },
      subject,
      fromName: currentUser?.fullName || currentUser?.name || "",
      preheader: "",
      body: fullBody,
      imageUrl,
      ctaText,
      ctaUrl,
      signature,
      attachedQuoteIds: attachedQuoteRefs.map(r => r.quoteId),
      kind: "compose",
      status: "sent",
      sentAt: new Date().toISOString(),
      events: [],
      createdAt: new Date().toISOString(),
      senderEmail: currentUser?.email || null,
      recipients: validRecipients
    };
    attachedQuoteRefs.forEach(ref => {
      var list = window.cnQuotes?.readQuotes?.(ref.oppId) || [];
      var next = list.map(q => q.id === ref.quoteId && q.status === "draft" ? {
        ...q,
        status: "sent",
        sentAt: new Date().toISOString()
      } : q);
      window.cnQuotes?.writeQuotes?.(ref.oppId, next);
    });
    var viaResend = false;
    if (window.SEND_VIA_RESEND) {
      try {
        await window.sendCampaignViaResend(finalC, validRecipients);
        finalC.viaResend = true;
        viaResend = true;
      } catch (err) {
        console.error("Resend send failed:", err);
        alert("Live send failed — falling back to simulation. Check the console.");
        finalC.events = window.cnOutreach?.simulateSend ? window.cnOutreach.simulateSend(finalC) : [];
      }
    } else {
      finalC.events = [];
    }
    if (window.cnOutreach?.saveCampaign) {
      window.cnOutreach.saveCampaign(finalC);
    } else {
      try {
        var arr = JSON.parse(localStorage.getItem("cn-campaigns") || "[]");
        arr.unshift(finalC);
        localStorage.setItem("cn-campaigns", JSON.stringify(arr));
      } catch {}
    }
    if (window.insertActivity) {
      for (var r of validRecipients) {
        try {
          await window.insertActivity({
            type: "email",
            owner_id: currentUser?.id || null,
            contact_id: r.contactId,
            subject,
            summary: body.slice(0, 280),
            occurred_at: new Date().toISOString()
          });
        } catch (e) {
          console.warn("Couldn't log email activity:", e);
        }
      }
    }
    setSending(false);
    setSentResult({
      count: validRecipients.length,
      viaResend
    });
    onSaved && onSaved();
  };
  if (sentResult) {
    return React.createElement("div", {
      className: "cn-modal-scrim",
      onClick: onClose,
      style: {
        zIndex: 170
      }
    }, React.createElement("div", {
      className: "cn-modal cn-compose-modal",
      onClick: e => e.stopPropagation()
    }, React.createElement("div", {
      className: "cn-modal-body",
      style: {
        textAlign: "center",
        padding: "60px 30px"
      }
    }, React.createElement("div", {
      className: "cn-success-tick",
      style: {
        display: "inline-flex",
        marginBottom: 14,
        width: 56,
        height: 56,
        fontSize: 26
      }
    }, "\u2713"), React.createElement("h2", {
      style: {
        fontFamily: "var(--cn-serif)",
        fontSize: 26,
        margin: "0 0 8px"
      }
    }, "Sent to ", sentResult.count, " ", sentResult.count === 1 ? "recipient" : "recipients"), React.createElement("div", {
      style: {
        color: "var(--cn-mute)",
        fontSize: 13,
        marginBottom: 24
      }
    }, sentResult.viaResend ? "Delivered live via Resend — tracking opens & clicks." : "Logged on the contact's timeline; analytics will appear in Campaigns."), React.createElement("button", {
      className: "cn-btn cn-btn--primary",
      onClick: onClose
    }, "Done"))));
  }
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose,
    style: {
      zIndex: 170
    }
  }, React.createElement("div", {
    className: "cn-modal cn-compose-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, step === 0 ? "Compose email" : "Review & send"), React.createElement("h2", {
    className: "cn-modal-title"
  }, subject || (primaryContact ? `To ${primaryContact.name}` : "New email"))), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-compose-steps"
  }, ["Compose", "Review"].map((label, i) => React.createElement("div", {
    key: label,
    className: `cn-camp-step ${i === step ? "is-current" : i < step ? "is-done" : ""}`,
    onClick: () => i < step && setStep(i)
  }, React.createElement("span", {
    className: "cn-camp-step-num"
  }, i < step ? "✓" : i + 1), React.createElement("span", null, label)))), React.createElement("div", {
    className: "cn-modal-body cn-compose-body"
  }, step === 0 ? React.createElement(Fragment, null, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "To"), React.createElement("div", {
    className: "cn-compose-to"
  }, recipients.map(id => {
    var c = scenario.contacts.find(x => x.id === id);
    if (!c) return null;
    return React.createElement("span", {
      key: id,
      className: "cn-rp-chip"
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, (c.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2)), React.createElement("span", {
      className: "cn-rp-chip-text"
    }, React.createElement("span", {
      className: "cn-rp-chip-name"
    }, c.name), React.createElement("span", {
      className: "cn-rp-chip-email"
    }, c.email || "no email")), recipients.length > 1 && React.createElement("button", {
      className: "cn-rp-chip-x",
      onClick: () => removeRecipient(id),
      title: "Remove"
    }, "\u2715"));
  }), React.createElement(AddRecipientInline, {
    scenario: scenario,
    excludeIds: recipients,
    onPick: addRecipient
  }))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 2
    }
  }, React.createElement("label", null, "Subject"), React.createElement("input", {
    className: "cn-input",
    value: subject,
    onChange: e => setSubject(e.target.value),
    placeholder: "A line that gets it opened\u2026"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: "none",
      display: "flex",
      alignItems: "flex-end"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 36
    },
    onClick: () => setTemplatePickerOpen(true)
  }, "\u21BA Use template"))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Body"), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 180
    },
    value: body,
    onChange: e => setBody(e.target.value),
    placeholder: "Write the message\u2026"
  }), React.createElement("div", {
    className: "cn-merge-help",
    style: {
      marginTop: 8
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Merge fields"), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 6
    }
  }, ["first_name", "last_name", "company", "title", "sender_name"].map(f => React.createElement("button", {
    key: f,
    className: "cn-chip-btn",
    onClick: () => setBody(body + ` {{${f}}}`)
  }, `{{${f}}}`))))), React.createElement(ComposeQuotesSection, {
    scenario: scenario,
    availableQuotes: availableQuotes,
    attachedQuoteIds: attachedQuoteRefs.map(r => r.quoteId),
    onToggle: toggleAttach,
    onCreateNew: startCreateQuote
  }), window.BannerImagePicker ? React.createElement(window.BannerImagePicker, {
    value: imageUrl,
    onChange: setImageUrl
  }) : null, React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "CTA button text"), React.createElement("input", {
    className: "cn-input",
    value: ctaText,
    onChange: e => setCtaText(e.target.value),
    placeholder: "View quote, Book a call, \u2026"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 2
    }
  }, React.createElement("label", null, "CTA URL"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12
    },
    value: ctaUrl,
    onChange: e => setCtaUrl(e.target.value),
    placeholder: "https://\u2026"
  }))), window.SignatureField ? React.createElement(window.SignatureField, {
    value: signature,
    onChange: (s, save) => {
      setSignature(s);
      setSaveSig(save);
    }
  }) : null) : React.createElement(Fragment, null, React.createElement("div", {
    className: "cn-camp-review-strip"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-strip-label"
  }, "To"), React.createElement("div", {
    className: "cn-strip-value",
    style: {
      fontSize: 14
    }
  }, recipients.length, " ", recipients.length === 1 ? "recipient" : "recipients")), React.createElement("div", null, React.createElement("div", {
    className: "cn-strip-label"
  }, "From"), React.createElement("div", {
    className: "cn-strip-value",
    style: {
      fontSize: 14
    }
  }, currentUser?.fullName || currentUser?.name || "—")), React.createElement("div", null, React.createElement("div", {
    className: "cn-strip-label"
  }, "Attached"), React.createElement("div", {
    className: "cn-strip-value",
    style: {
      fontSize: 14
    }
  }, attachedQuotes.length, " quote", attachedQuotes.length === 1 ? "" : "s"))), React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginTop: 18,
      marginBottom: 8
    }
  }, "Preview"), React.createElement("div", {
    className: "cn-email-preview"
  }, React.createElement("div", {
    className: "cn-email-header"
  }, React.createElement("div", null, React.createElement("span", {
    className: "cn-email-from"
  }, currentUser?.fullName || currentUser?.name || "Sender name"), React.createElement("span", {
    className: "cn-email-to"
  }, " to ", primaryContact?.email || "—", recipients.length > 1 && React.createElement("span", null, " + ", recipients.length - 1, " more"))), React.createElement("div", {
    className: "cn-email-subject"
  }, _csMerge(subject, previewCtx) || "(no subject)")), React.createElement("div", {
    className: "cn-email-body"
  }, imageUrl && React.createElement("div", {
    className: "cn-email-image"
  }, React.createElement("img", {
    src: imageUrl,
    alt: "",
    onError: e => {
      e.target.style.display = "none";
      e.target.nextSibling.style.display = "block";
    }
  }), React.createElement("div", {
    className: "cn-email-image-fallback"
  }, "\u229E Banner image (preview failed \u2014 will still send)")), React.createElement("div", {
    className: "cn-email-text"
  }, previewBody || "(empty body)"), attachedQuotes.length > 0 && React.createElement("div", {
    className: "cn-compose-quote-block"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Attached quotes"), attachedQuotes.map(q => React.createElement("a", {
    key: q.id,
    href: _csQuoteShareUrl(q),
    className: "cn-compose-quote-link",
    target: "_blank",
    rel: "noopener",
    onClick: e => e.preventDefault()
  }, React.createElement("span", {
    style: {
      fontSize: 18
    }
  }, "\uD83D\uDCC4"), React.createElement("span", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 500
    }
  }, "Quote ", q.quoteNumber, " \xB7 v", q.version), React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12
    }
  }, "Total ", _csCurrency(Math.round(window.cnQuotes && window.cnQuotes.readQuotes ? window.cnQuotes.readQuotes(attachedQuoteRefs.find(r => r.quoteId === q.id).oppId).find(x => x.id === q.id) ? 0 : 0 : 0)), " \xB7 valid through ", q.expiresDate)), React.createElement("span", {
    style: {
      color: "var(--cn-copper)"
    }
  }, "Open \u2192")))), ctaText && React.createElement("div", {
    style: {
      textAlign: "center",
      margin: "24px 0 8px"
    }
  }, React.createElement("a", {
    href: ctaUrl || "#",
    className: "cn-email-cta",
    onClick: e => e.preventDefault()
  }, ctaText)))))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, step === 0 ? React.createElement(Fragment, null, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Cancel"), React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setStep(1),
    disabled: !subject.trim() || recipients.length === 0
  }, "Next: Review \u2192"))) : React.createElement(Fragment, null, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setStep(0),
    disabled: sending
  }, "\u2190 Edit"), React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: send,
    disabled: sending
  }, sending ? React.createElement(Fragment, null, React.createElement("span", {
    className: "cn-spinner"
  }), "Sending\u2026") : `Send to ${recipients.length} ${recipients.length === 1 ? "person" : "people"} →`)))), templatePickerOpen && window.TemplatePicker && React.createElement(window.TemplatePicker, {
    onClose: () => setTemplatePickerOpen(false),
    onPick: applyTemplate
  }), createQuoteFor && React.createElement(InlineQuoteCreator, {
    scenario: scenario,
    createQuoteFor: createQuoteFor,
    recipientIds: recipients,
    currentUser: currentUser,
    onClose: () => setCreateQuoteFor(null),
    onCreated: (opp, quote) => {
      setAttachedQuoteRefs(prev => [...prev, {
        oppId: opp.id,
        quoteId: quote.id
      }]);
      if (!ctaText && !ctaUrl) {
        setCtaText("View & respond to quote →");
        setCtaUrl(_csQuoteShareUrl(quote));
      }
      setCreateQuoteFor(null);
    }
  })));
}
function AddRecipientInline({
  scenario,
  excludeIds,
  onPick
}) {
  var [q, setQ] = useState("");
  var [showProspect, setShowProspect] = useState(false);
  var [pn, setPn] = useState("");
  var [pe, setPe] = useState("");
  var search = q.trim().toLowerCase();
  var matches = search ? scenario.contacts.filter(c => !excludeIds.includes(c.id)).filter(c => (c.name || "").toLowerCase().includes(search) || (c.email || "").toLowerCase().includes(search) || (window.accountOf(c.accountId, scenario)?.name || "").toLowerCase().includes(search)).slice(0, 6) : [];
  if (showProspect) {
    return React.createElement("form", {
      className: "cn-rp-prospect-form",
      style: {
        width: "100%",
        marginTop: 6
      },
      onSubmit: e => {
        e.preventDefault();
        if (!pn.trim() || !pe.trim()) return;
        if (!/.+@.+\..+/.test(pe)) {
          alert("Enter a valid email");
          return;
        }
        var pid = "prospect-" + Math.random().toString(36).slice(2, 9);
        scenario.contacts.push({
          id: pid,
          name: pn.trim(),
          email: pe.trim(),
          title: "Prospect",
          accountId: null,
          tier: "Influencer"
        });
        onPick(scenario.contacts.find(c => c.id === pid));
        setPn("");
        setPe("");
        setShowProspect(false);
      }
    }, React.createElement("div", {
      className: "cn-field-row"
    }, React.createElement("div", {
      className: "cn-field",
      style: {
        flex: 1
      }
    }, React.createElement("label", null, "Name"), React.createElement("input", {
      className: "cn-input",
      value: pn,
      onChange: e => setPn(e.target.value),
      autoFocus: true
    })), React.createElement("div", {
      className: "cn-field",
      style: {
        flex: 1.4
      }
    }, React.createElement("label", null, "Email"), React.createElement("input", {
      className: "cn-input cn-mono",
      style: {
        fontSize: 12.5
      },
      value: pe,
      onChange: e => setPe(e.target.value),
      placeholder: "jane@company.com"
    }))), React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        justifyContent: "flex-end"
      }
    }, React.createElement("button", {
      type: "button",
      className: "cn-btn cn-btn--ghost",
      onClick: () => setShowProspect(false)
    }, "Cancel"), React.createElement("button", {
      type: "submit",
      className: "cn-btn cn-btn--primary"
    }, "Add")));
  }
  return React.createElement("div", {
    className: "cn-compose-add-recipient"
  }, React.createElement("input", {
    className: "cn-input",
    placeholder: "+ Add contact or prospect\u2026",
    value: q,
    onChange: e => setQ(e.target.value),
    style: {
      height: 32,
      fontSize: 12.5,
      minWidth: 220
    }
  }), matches.length > 0 && React.createElement("div", {
    className: "cn-rp-suggest",
    style: {
      marginTop: 4
    }
  }, matches.map(c => {
    var acct = window.accountOf(c.accountId, scenario);
    return React.createElement("button", {
      key: c.id,
      className: "cn-rp-sug-item",
      onClick: () => {
        onPick(c);
        setQ("");
      }
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, c.name.split(" ").map(n => n[0]).join("").slice(0, 2)), React.createElement("span", {
      className: "cn-rp-sug-text"
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 500
      }
    }, c.name), React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: "var(--cn-mute)"
      }
    }, c.email || "no email", acct ? " · " + acct.name : "")), React.createElement("span", {
      className: "cn-sr-kind"
    }, "+ Add"));
  })), search && matches.length === 0 && React.createElement("div", {
    className: "cn-rp-empty",
    style: {
      marginTop: 4
    }
  }, "No matches. ", React.createElement("button", {
    className: "cn-link",
    onClick: () => {
      setShowProspect(true);
      setPn(q);
      setQ("");
    }
  }, "+ Add \"", q, "\" as a prospect")));
}
function ComposeQuotesSection({
  scenario,
  availableQuotes,
  attachedQuoteIds,
  onToggle,
  onCreateNew
}) {
  return React.createElement("div", {
    className: "cn-compose-quotes"
  }, React.createElement("div", {
    className: "cn-compose-quotes-head"
  }, React.createElement("label", {
    style: {
      margin: 0
    }
  }, "Attach quote(s)"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 28,
      fontSize: 12,
      padding: "4px 10px"
    },
    onClick: onCreateNew
  }, "+ Create new quote")), availableQuotes.length === 0 ? React.createElement("div", {
    className: "cn-compose-quotes-empty"
  }, "No existing quotes for this contact. Create one above to attach it.") : React.createElement("div", {
    className: "cn-compose-quotes-list"
  }, availableQuotes.map(({
    quote,
    opp
  }) => {
    var total = window.cnQuotes && window.quoteTotal ? window.quoteTotal(quote) : 0;
    var checked = attachedQuoteIds.includes(quote.id);
    return React.createElement("label", {
      key: quote.id,
      className: `cn-compose-quote-row ${checked ? "is-on" : ""}`
    }, React.createElement("input", {
      type: "checkbox",
      checked: checked,
      onChange: () => onToggle(opp, quote)
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 500
      }
    }, "Quote ", quote.quoteNumber, " \xB7 v", quote.version, React.createElement("span", {
      className: `cn-q-pill ${quote.status === "accepted" ? "cn-q-accepted" : quote.status === "declined" ? "cn-q-declined" : quote.status === "viewed" ? "cn-q-viewed" : quote.status === "sent" ? "cn-q-sent" : ""}`,
      style: {
        marginLeft: 8,
        fontSize: 10
      }
    }, quote.status || "draft")), React.createElement("div", {
      style: {
        color: "var(--cn-mute)",
        fontSize: 11.5
      }
    }, opp.title, " \xB7 ", _csCurrency(Math.round(total * 100)), " \xB7 valid through ", quote.expiresDate)));
  })));
}
function InlineQuoteCreator({
  scenario,
  createQuoteFor,
  recipientIds,
  currentUser,
  onClose,
  onCreated
}) {
  var eligibleOpps = scenario.opps.filter(o => recipientIds.includes(o.contactId));
  var [pickedOppId, setPickedOppId] = useState(createQuoteFor !== "ask" ? createQuoteFor : null);
  var [createdQuoteId, setCreatedQuoteId] = useState(null);
  useEffect(() => {
    if (!pickedOppId || createdQuoteId) return;
    var opp = scenario.opps.find(o => o.id === pickedOppId);
    var contact = scenario.contacts.find(c => c.id === opp?.contactId);
    var account = window.accountOf(opp?.accountId, scenario);
    if (!opp || !window.cnQuotes) return;
    var list = window.cnQuotes.readQuotes(opp.id);
    var num = "Q-" + String(2026000 + list.length + 1).slice(-4);
    var today = new Date();
    var exp = new Date();
    exp.setDate(today.getDate() + 30);
    var newQuote = {
      id: "q-" + Math.random().toString(36).slice(2, 10),
      quoteNumber: num,
      version: 1,
      issuedDate: window.cnDay(today),
      expiresDate: window.cnDay(exp),
      billToName: account?.name || "",
      billToAddress: account?.hq || "",
      attentionName: contact?.name || "",
      attentionEmail: contact?.email || "",
      preparedBy: opp.ownerId || currentUser?.id || null,
      reference: opp.title || "",
      lineItems: [{
        id: "l-" + Math.random().toString(36).slice(2, 8),
        description: "",
        qty: 1,
        unitPrice: 0,
        leadTime: ""
      }],
      notes: "",
      terms: "Net 30 unless otherwise noted.",
      taxRate: 0,
      shippingCost: 0,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      sentAt: null,
      viewedAt: null,
      viewCount: 0,
      shareToken: "qt-" + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 8),
      status: "draft"
    };
    var next = [newQuote, ...list];
    window.cnQuotes.writeQuotes(opp.id, next);
    setCreatedQuoteId(newQuote.id);
  }, [pickedOppId]);
  if (createQuoteFor === "ask" && !pickedOppId) {
    return React.createElement("div", {
      className: "cn-modal-scrim",
      onClick: onClose,
      style: {
        zIndex: 180
      }
    }, React.createElement("div", {
      className: "cn-modal",
      style: {
        maxWidth: 520
      },
      onClick: e => e.stopPropagation()
    }, React.createElement("header", {
      className: "cn-modal-head"
    }, React.createElement("div", null, React.createElement("div", {
      className: "cn-card-eyebrow"
    }, "Pick a deal"), React.createElement("h2", {
      className: "cn-modal-title"
    }, "Which deal is this quote for?")), React.createElement("button", {
      className: "cn-icon-btn",
      onClick: onClose
    }, "\u2715")), React.createElement("div", {
      className: "cn-modal-body"
    }, React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, eligibleOpps.map(opp => {
      var acct = window.accountOf(opp.accountId, scenario);
      return React.createElement("button", {
        key: opp.id,
        className: "cn-tp-card",
        onClick: () => setPickedOppId(opp.id)
      }, React.createElement("div", {
        className: "cn-tp-name"
      }, opp.title), React.createElement("div", {
        className: "cn-tp-subject"
      }, acct?.name || "", " \xB7 ", opp.stage));
    })))));
  }
  if (pickedOppId && createdQuoteId && window.QuoteBuilderModal) {
    var opp = scenario.opps.find(o => o.id === pickedOppId);
    var account = window.accountOf(opp?.accountId, scenario);
    var contact = scenario.contacts.find(c => c.id === opp?.contactId);
    var quote = (window.cnQuotes.readQuotes(opp.id) || []).find(q => q.id === createdQuoteId);
    if (!quote) return null;
    return React.createElement(window.QuoteBuilderModal, {
      quote: quote,
      opp: opp,
      account: account,
      contact: contact,
      onChange: patch => {
        var list = window.cnQuotes.readQuotes(opp.id);
        var next = list.map(x => x.id === createdQuoteId ? {
          ...x,
          ...patch,
          updatedAt: new Date().toISOString()
        } : x);
        window.cnQuotes.writeQuotes(opp.id, next);
      },
      onClose: () => {
        var list = window.cnQuotes.readQuotes(opp.id);
        var final = list.find(x => x.id === createdQuoteId);
        if (final) onCreated(opp, final);else onClose();
      },
      onDelete: () => {
        var list = window.cnQuotes.readQuotes(opp.id).filter(x => x.id !== createdQuoteId);
        window.cnQuotes.writeQuotes(opp.id, list);
        onClose();
      }
    });
  }
  return null;
}
function QuickQuoteFromContact({
  scenario,
  contact,
  oppId,
  currentUser,
  onClose
}) {
  return React.createElement(InlineQuoteCreator, {
    scenario: scenario,
    createQuoteFor: oppId,
    recipientIds: [contact.id],
    currentUser: currentUser,
    onClose: onClose,
    onCreated: (_opp, _quote) => onClose()
  });
}
Object.assign(window, {
  ContactComposeDrawer,
  AddRecipientInline,
  QuickQuoteFromContact
});