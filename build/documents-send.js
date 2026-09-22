var DOC_SEND_LOG_KEY = "cn-doc-sends-v1";
var DOC_ATTACH_WARN = 12 * 1024 * 1024;
var DOC_ATTACH_MAX = 22 * 1024 * 1024;
function readDocSendLog() {
  try {
    return JSON.parse(localStorage.getItem(DOC_SEND_LOG_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeDocSendLog(rows) {
  try {
    localStorage.setItem(DOC_SEND_LOG_KEY, JSON.stringify(rows.slice(0, 2000)));
  } catch {}
}
function appendDocSendLog(rows) {
  var next = [...rows, ...readDocSendLog()];
  writeDocSendLog(next);
  return next;
}
function docSendStats(docId, log) {
  var rows = (log || readDocSendLog()).filter(r => r.docId === docId);
  if (!rows.length) return null;
  var sorted = rows.slice().sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
  return {
    count: rows.length,
    lastAt: sorted[0].sentAt,
    lastTo: sorted[0].email
  };
}
async function refreshDocSendLog() {
  if (!window.cnDocLibrary) return readDocSendLog();
  var remote = await window.cnDocLibrary.pullSends();
  if (!remote) return readDocSendLog();
  var rows = remote.map(r => ({
    docId: r.doc_id,
    docTitle: r.doc_title,
    campaignId: r.campaign_id,
    contactId: r.contact_id,
    email: r.email,
    sentBy: r.sent_by,
    sentAt: r.sent_at
  }));
  writeDocSendLog(rows);
  return rows;
}
function _dsBlobToB64(blob) {
  return new Promise((resolve, reject) => {
    var fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || "").split(",")[1] || "");
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
async function docToBlob(doc) {
  if (window.__resources && window.__resources[doc.id]) {
    var r = await fetch(window.__resources[doc.id]);
    if (!r.ok) throw new Error("bundled asset unavailable");
    return r.blob();
  }
  if (doc.kind === "file" && doc.data) return (await fetch(doc.data)).blob();
  if (doc.cloudPath && window.cnDocLibrary) {
    try {
      return await window.cnDocLibrary.download(doc.cloudPath);
    } catch (e) {}
  }
  if (doc.kind === "url" && doc.url) {
    if (/^https?:\/\//i.test(doc.url)) throw new Error("external-link");
    var _r = await fetch(doc.url);
    if (!_r.ok) throw new Error("couldn't read " + doc.url);
    return _r.blob();
  }
  throw new Error("no file stored for this document");
}
function isLinkOnly(doc) {
  var bundled = window.__resources && window.__resources[doc.id];
  if (bundled || doc.cloudPath || doc.kind === "file" && doc.data) return false;
  return doc.kind === "url" && /^https?:\/\//i.test(doc.url || "");
}
async function docToAttachment(doc) {
  var blob = await docToBlob(doc);
  var content = await _dsBlobToB64(blob);
  return {
    docId: doc.id,
    filename: doc.fileName || doc.title,
    content,
    size: blob.size,
    type: doc.fileType || blob.type || "application/octet-stream"
  };
}
var DOC_INTENT_RULES = [{
  intent: "mutual",
  re: /ncnda|\bnda\b|non[\s-]?disclosure|non[\s-]?circumvent/i
}, {
  intent: "commission",
  re: /referral|finder|commission/i
}, {
  intent: "internal",
  re: /red[\s-]?flag|risk scoring|due diligence|screening/i
}, {
  intent: "prequal",
  re: /pre[\s-]?qual/i
}, {
  intent: "form",
  re: /qualification|intake|questionnaire/i
}, {
  intent: "signature",
  re: /end[\s-]?use|end[\s-]?user|user statement|\bkyc\b|\bw-?9\b|attestation|assurance|advanced ic|headquarters certification|statement$|signature/i
}, {
  intent: "credential",
  re: /certification|certificate|authorized|compliance/i
}];
function _dsCleanTitle(doc) {
  return String(doc.title || doc.fileName || "document").replace(/\s+[—–-]\s+(CN|SSP|Chief Negotiators|Strategic Supply Partners)\s*$/i, "").trim();
}
function _dsIntent(doc) {
  var hay = `${doc.title || ""} ${doc.fileName || ""}`;
  for (var r of DOC_INTENT_RULES) if (r.re.test(hay)) return r.intent;
  if (doc.category === "compliance") return "signature";
  return doc.category || "playbooks";
}
function _dsDominant(docs) {
  var counts = {};
  docs.forEach(d => {
    var k = _dsIntent(d);
    counts[k] = (counts[k] || 0) + 1;
  });
  var keys = Object.keys(counts);
  var top = keys.sort((a, b) => counts[b] - counts[a])[0];
  return {
    cat: top || "playbooks",
    mixed: keys.length > 1
  };
}
var DOC_SEND_COPY = {
  prequal: {
    subjectOne: () => "Before I make the introduction",
    subjectMany: () => "Before I make the introduction",
    leadOne: () => `Attached is our client pre-qualification form.\n\nOur model runs on relationships, not inventory. Partners commit allocation and price off what I can tell them about the end user — who they are, what the compute is for, where it lands. Thin information gets you a slow answer and a worse number.\n\nIt's OEM-neutral, so nothing in it commits you to a route. What you send stays between us.`,
    leadMany: list => `Attached:\n\n${list}\n\nOur model runs on relationships, not inventory. Partners commit allocation and price off what I can tell them about the end user — who they are, what the compute is for, where it lands. Thin information gets you a slow answer and a worse number.\n\nOEM-neutral, so nothing in them commits you to a route. What you send stays between us.`,
    askOne: "Fill in what you know, flag what's undecided, send it back. I'll take it to the right partners and come back with who can actually serve it.",
    askMany: "Fill in what you know, flag what's undecided, send them back. I'll take it to the right partners and come back with who can actually serve it."
  },
  mutual: {
    subjectOne: () => "Mutual NDA — so we can both talk openly",
    subjectMany: () => "Mutual NDA — so we can both talk openly",
    leadOne: () => `Attached is our mutual NDA.\n\nIt cuts both ways: neither of us discloses what the other shares, and neither of us goes around the other to a counterparty we introduced. That's what lets me be straight with you about who actually holds the supply and what it really costs.`,
    leadMany: list => `Attached:\n\n${list}\n\nMutual and cutting both ways: neither side discloses what the other shares, and neither side goes around the other to a counterparty we introduced. That's what lets us both talk openly.`,
    askOne: "Sign it and I'll send the detail the same day. If your legal wants a change, send me the redline directly — I'd rather fix it than trade rounds by email.",
    askMany: "Sign and I'll send the detail the same day. If your legal wants changes, send me the redlines directly — I'd rather fix them than trade rounds by email."
  },
  commission: {
    subjectOne: () => "Referral agreement — commission terms in writing",
    subjectMany: () => "Referral agreement — commission terms in writing",
    leadOne: () => `Attached is our referral agreement.\n\nIt puts your commission in writing before you make an introduction — what you earn, when it's paid, and what counts as your deal. You keep the relationship; I do the negotiating.`,
    leadMany: list => `Attached:\n\n${list}\n\nCommission in writing before any introduction — what you earn, when it's paid, and what counts as your deal.`,
    askOne: "Sign it and send me the first name you have in mind. If a term doesn't work for you, tell me which and I'll change it.",
    askMany: "Sign and send me the first name you have in mind. If a term doesn't work, tell me which and I'll change it."
  },
  internal: {
    subjectOne: () => "A few questions before I can quote",
    subjectMany: () => "A few questions before I can quote",
    leadOne: () => `Before I can put pricing in front of you I have to clear our own diligence — end use, destination, and who operates the site.\n\nIt's on me, not you. Short answers are enough.`,
    leadMany: () => `Before I can put pricing in front of you I have to clear our own diligence — end use, destination, and who operates the site.\n\nIt's on me, not you. Short answers are enough.`,
    askOne: "Reply with what you can and I'll handle the rest on our side.",
    askMany: "Reply with what you can and I'll handle the rest on our side."
  },
  form: {
    subjectOne: t => `${t} — so I can price it properly`,
    subjectMany: () => "a couple of forms — so I can price it properly",
    leadOne: t => `Attached is our ${t}.\n\nShort, and it's what lets me quote something real instead of a range. Workload, term, power and budget are the lines that move the number — the rest you can skip.`,
    leadMany: list => `Attached:\n\n${list}\n\nBoth short, and they're what let me quote something real instead of a range. The specifics on workload, term, power and budget are what actually change the number.`,
    askOne: "Fill in what you know and send it back — I'll come back with pricing and availability, and I'll tell you if I think you're over-speccing it.",
    askMany: "Fill in what you know and send them back — I'll come back with pricing and availability, and I'll tell you if I think you're over-speccing anything."
  },
  signature: {
    subjectOne: t => `${t} — needs a signature before we ship`,
    subjectMany: () => "paperwork we need back before shipping",
    leadOne: t => `Attached is the ${t}.\n\nThis is the piece that has to be on file before anything moves — export-controlled hardware doesn't ship without it. Whoever owns trade compliance on your side is usually the fastest route.`,
    leadMany: list => `Attached is what we still need back:\n\n${list}\n\nThese have to be on file before anything ships. Whoever owns trade compliance on your side is usually the fastest route.`,
    askOne: "Send it back signed and I'll release the order.",
    askMany: "Send them back signed and I'll release the order."
  },
  credential: {
    subjectOne: t => `${t} — for your vendor file`,
    subjectMany: () => "our authorizations — for your vendor file",
    leadOne: t => `Attached is our ${t} — proof we're authorized to sell and support the line, in case procurement or vendor management needs it on file.`,
    leadMany: list => `Attached are our authorizations:\n\n${list}\n\nProof we're authorized to sell and support these lines, in case procurement or vendor management needs them on file.`,
    askOne: "Nothing needed back from you. If your team wants anything else for onboarding, tell me what and I'll get it over.",
    askMany: "Nothing needed back from you. If your team wants anything else for onboarding, tell me what and I'll get it over."
  },
  contracts: {
    subjectOne: t => `${t} — for your review`,
    subjectMany: () => "paperwork for review",
    leadOne: t => `Attached is the ${t}.\n\nNothing unusual in it — mutual protection, standard terms.`,
    leadMany: list => `Attached is the paperwork:\n\n${list}\n\nNothing unusual in any of it — mutual protection, standard terms.`,
    askOne: "If legal wants a change, send me the redline directly and I'll turn it around — faster than trading rounds through email.",
    askMany: "If legal wants changes, send me the redlines directly and I'll turn them around — faster than trading rounds through email."
  },
  specs: {
    subjectOne: t => `${t} — part-level detail`,
    subjectMany: () => "spec package — part-level detail",
    leadOne: t => `Attached is the ${t} — configured, part numbers included, so your team can check it line by line.`,
    leadMany: list => `Attached is the spec package:\n\n${list}\n\nConfigured, part numbers included, so your team can check them line by line.`,
    askOne: "Tell me which lines you want changed or priced differently and I'll requote. If it's close as-is, I'd rather lock pricing now — allocation moves faster than quotes do.",
    askMany: "Tell me which lines you want changed or priced differently and I'll requote. If they're close as-is, I'd rather lock pricing now — allocation moves faster than quotes do."
  },
  partners: {
    subjectOne: t => `${t}`,
    subjectMany: () => "partner capability — the short version",
    leadOne: t => `Attached is the ${t} — the short version of what they actually hold and support, not a brochure.`,
    leadMany: list => `Attached is the partner set:\n\n${list}\n\nShort versions of what each one actually holds and supports — not brochures.`,
    askOne: "If it maps to what you're building, say so and I'll put you in front of them directly.",
    askMany: "If any of it maps to what you're building, say which and I'll put you in front of them directly."
  },
  stories: {
    subjectOne: t => `${t}`,
    subjectMany: () => "builds that looked like yours",
    leadOne: t => `Attached is the ${t} — same shape as what you're working through, including what went wrong and what it cost to fix.`,
    leadMany: list => `Attached:\n\n${list}\n\nAll close to what you're working through — including what went wrong and what it cost to fix.`,
    askOne: "Worth five minutes before we talk pricing.",
    askMany: "Worth five minutes before we talk pricing."
  },
  playbooks: {
    subjectOne: t => `${t} — everything in one place`,
    subjectMany: () => "the reference set — everything in one place",
    leadOne: t => `Attached is the ${t} — lead times, escalation path, payment terms, all in one place.`,
    leadMany: list => `Attached is the reference set:\n\n${list}\n\nLead times, escalation path, payment terms — all in one place.`,
    askOne: "Keep it handy. Anything that isn't clear, ask me rather than digging for it.",
    askMany: "Keep them handy. Anything that isn't clear, ask me rather than digging for it."
  },
  battlecards: {
    subjectOne: t => `${t} — internal`,
    subjectMany: () => "battlecards — internal",
    leadOne: t => `Attached is the ${t}.\n\nInternal use: where the competition is weak and how to answer the objections that actually come up.`,
    leadMany: list => `Attached:\n\n${list}\n\nInternal use: where the competition is weak and how to answer the objections that actually come up.`,
    askOne: "If you hit an objection that isn't in there, send it to me and I'll add it.",
    askMany: "If you hit an objection that isn't in there, send it to me and I'll add it."
  }
};
function _dsCopy(cat) {
  return DOC_SEND_COPY[cat] || DOC_SEND_COPY.playbooks;
}
function defaultDocSubject(docs) {
  var {
    cat,
    mixed
  } = _dsDominant(docs);
  if (docs.length === 1) return _dsCopy(cat).subjectOne(_dsCleanTitle(docs[0]));
  if (mixed) return `${docs.length} documents — as promised`;
  return _dsCopy(cat).subjectMany(docs.length);
}
function defaultDocBody(docs, currentUser) {
  var saved = (window.cnOutreach?.readSignature?.() || "").trim();
  var who = currentUser?.fullName || currentUser?.name || "";
  var sign = saved ? `\n\n${saved}` : who ? `\n\n— ${who.split(" ")[0]}` : "";
  var {
    cat,
    mixed
  } = _dsDominant(docs);
  var copy = _dsCopy(cat);
  if (docs.length === 1) {
    return `{{first_name}},\n\n${copy.leadOne(_dsCleanTitle(docs[0]))}\n\n${copy.askOne}${sign}`;
  }
  var list = docs.map(d => `  • ${_dsCleanTitle(d)}`).join("\n");
  if (mixed) {
    var needsBack = docs.filter(d => _dsIntent(d) === "signature");
    var backLine = needsBack.length ? `\n\nThe ${needsBack.map(d => _dsCleanTitle(d)).join(" and ")} ${needsBack.length === 1 ? "needs" : "need"} to come back signed before anything ships — everything else is yours to keep.` : "";
    return `{{first_name}},\n\nEverything we went over, in one place:\n\n${list}${backLine}\n\nAnything you'd rather walk through than read, tell me and we'll take ten minutes on a call.${sign}`;
  }
  return `{{first_name}},\n\n${copy.leadMany(list)}\n\n${copy.askMany}${sign}`;
}
function _dsBytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}
function DocumentSendDrawer({
  docs,
  scenario,
  currentUser,
  onClose,
  onSent
}) {
  var sendable = docs.filter(d => !isLinkOnly(d));
  var linkOnly = docs.filter(d => isLinkOnly(d));
  var [recipients, setRecipients] = useState([]);
  var [q, setQ] = useState("");
  var [subject, setSubject] = useState(() => defaultDocSubject(docs));
  var [body, setBody] = useState(() => defaultDocBody(docs, currentUser));
  var [prepping, setPrepping] = useState(true);
  var [attachments, setAttachments] = useState([]);
  var [prepError, setPrepError] = useState(null);
  var [sending, setSending] = useState(false);
  var [sent, setSent] = useState(null);
  useEffect(() => {
    var cancelled = false;
    (async () => {
      var built = [];
      var failed = [];
      for (var d of sendable) {
        try {
          built.push(await docToAttachment(d));
        } catch (e) {
          failed.push({
            title: d.title,
            why: e.message || String(e)
          });
        }
      }
      if (cancelled) return;
      setAttachments(built);
      setPrepError(failed.length ? failed : null);
      setPrepping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [docs.map(d => d.id).join(",")]);
  var totalBytes = attachments.reduce((s, a) => s + (a.size || 0), 0);
  var overMax = totalBytes > DOC_ATTACH_MAX;
  var overWarn = totalBytes > DOC_ATTACH_WARN && !overMax;
  var search = q.trim().toLowerCase();
  var matches = !search ? [] : (scenario.contacts || []).filter(c => {
    if (recipients.find(r => r.contactId === c.id)) return false;
    var acct = window.accountOf && window.accountOf(c.accountId, scenario);
    return (c.name || "").toLowerCase().includes(search) || (c.email || "").toLowerCase().includes(search) || (acct && acct.name || "").toLowerCase().includes(search);
  }).slice(0, 6);
  var addContact = c => {
    if (!c.email) {
      alert(`${c.name} has no email address on file.`);
      return;
    }
    setRecipients(r => [...r, {
      contactId: c.id,
      name: c.name,
      email: c.email
    }]);
    setQ("");
  };
  var addTyped = () => {
    var raw = q.trim().replace(/[,;]$/, "");
    if (!raw) return;
    if (!window.isValidEmailAddress || !window.isValidEmailAddress(raw)) {
      alert(`"${raw}" doesn't look like an email address.`);
      return;
    }
    if (recipients.find(r => r.email.toLowerCase() === raw.toLowerCase())) {
      setQ("");
      return;
    }
    setRecipients(r => [...r, {
      contactId: null,
      name: raw,
      email: raw
    }]);
    setQ("");
  };
  var removeRecipient = email => setRecipients(r => r.filter(x => x.email !== email));
  var linkBlock = linkOnly.length ? "\n\n" + linkOnly.map(d => `${_dsCleanTitle(d)}: ${d.url}`).join("\n") : "";
  var send = async () => {
    if (sending) return;
    if (!recipients.length) {
      alert("Add at least one recipient.");
      return;
    }
    if (!subject.trim()) {
      alert("Add a subject line.");
      return;
    }
    if (overMax) {
      alert("These attachments are too large to email. Send fewer documents, or share the big ones as links.");
      return;
    }
    if (!attachments.length && !linkOnly.length) {
      alert("Nothing to send — no file could be read for these documents.");
      return;
    }
    setSending(true);
    var brand = window.CN_BRAND && window.CN_BRAND.name || "Chief Negotiators";
    var campaignId = "docsend-" + Math.random().toString(36).slice(2, 10);
    var builtRecipients = recipients.map(r => {
      var c = r.contactId ? (scenario.contacts || []).find(x => x.id === r.contactId) : null;
      var acct = c && window.accountOf ? window.accountOf(c.accountId, scenario) : null;
      var first = (r.name || "").split(" ")[0] || "";
      return {
        contactId: r.contactId,
        email: r.email,
        contact: c || null,
        ctx: {
          first_name: c ? (c.name || "").split(" ")[0] : r.contactId ? first : "",
          last_name: c ? (c.name || "").split(" ").slice(1).join(" ") : "",
          company: acct && acct.name || "",
          title: c && c.title || "",
          sender_name: currentUser?.fullName || currentUser?.name || brand
        }
      };
    });
    var campaign = {
      id: campaignId,
      name: `Documents · ${docs.length === 1 ? docs[0].title : docs.length + " docs"}`,
      subject: subject.trim(),
      preheader: "",
      body: body + linkBlock,
      imageUrl: "",
      ctaText: "",
      ctaUrl: "",
      fromName: brand,
      kind: "documents",
      status: "sent",
      docIds: docs.map(d => d.id),
      attachments,
      recipients: builtRecipients,
      senderEmail: currentUser?.email || null,
      createdAt: new Date().toISOString(),
      events: []
    };
    var viaResend = false;
    try {
      await window.sendCampaignViaResend(campaign, builtRecipients);
      viaResend = true;
      campaign.viaResend = true;
    } catch (err) {
      console.error("Document send failed:", err);
      setSending(false);
      (() => {
      var msg = String(err && (err.message || err));
      var maybeDelivered = /non-2xx|500|Internal Server Error|Failed to fetch|network/i.test(msg);
      alert("The send didn't complete:\n\n" + msg + "\n\n" + (maybeDelivered ? "Some copies may already have gone out. Check the recipient's inbox or Resend before resending, so nobody gets it twice." : "Nothing was sent — fix the above and try again."));
    })();
      return;
    }
    var record = {
      ...campaign,
      attachments: attachments.map(a => ({
        docId: a.docId,
        filename: a.filename,
        size: a.size,
        type: a.type
      }))
    };
    try {
      window.cnOutreach?.saveCampaign?.(record);
    } catch {}
    var now = new Date().toISOString();
    var logRows = [];
    docs.forEach(d => recipients.forEach(r => logRows.push({
      docId: d.id,
      docTitle: d.title,
      campaignId,
      contactId: r.contactId || null,
      email: r.email,
      sentBy: currentUser?.fullName || currentUser?.name || null,
      sentAt: now
    })));
    appendDocSendLog(logRows);
    try {
      window.cnDocLibrary?.logSends?.(logRows);
    } catch {}
    var titles = docs.map(d => d.title).join(", ");
    await Promise.all(recipients.filter(r => r.contactId).map(r => window.insertActivity?.({
      type: "email",
      owner_id: currentUser?.id || null,
      contact_id: r.contactId,
      summary: `Sent ${docs.length === 1 ? "document" : docs.length + " documents"}: ${titles}\nSubject: ${subject.trim()}`,
      occurred_at: now
    }).catch(() => {})));
    setSending(false);
    setSent({
      count: recipients.length,
      viaResend
    });
    onSent && onSent();
  };
  if (sent) {
    return React.createElement("div", {
      className: "cn-modal-scrim",
      onClick: onClose,
      style: {
        zIndex: 190
      }
    }, React.createElement("div", {
      className: "cn-modal cn-docsend",
      style: {
        maxWidth: 460
      },
      onClick: e => e.stopPropagation()
    }, React.createElement("div", {
      style: {
        padding: "44px 32px",
        textAlign: "center"
      }
    }, React.createElement("div", {
      style: {
        fontSize: 34,
        marginBottom: 12
      }
    }, "\u2713"), React.createElement("h2", {
      className: "cn-modal-title",
      style: {
        marginBottom: 6
      }
    }, "Sent to ", sent.count, " ", sent.count === 1 ? "recipient" : "recipients"), React.createElement("div", {
      style: {
        color: "var(--cn-mute)",
        fontSize: 13,
        marginBottom: 24
      }
    }, "Opens and clicks will show up under Campaigns. Contacts got a timeline entry."), React.createElement("button", {
      className: "cn-btn cn-btn--primary",
      onClick: onClose
    }, "Done"))));
  }
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose,
    style: {
      zIndex: 190
    }
  }, React.createElement("div", {
    className: "cn-modal cn-docsend",
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Send documents"), React.createElement("h2", {
    className: "cn-modal-title"
  }, subject || "Untitled email")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body cn-docsend-body"
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "To ", React.createElement("span", {
    className: "cn-field-help",
    style: {
      display: "inline"
    }
  }, "\xB7 CRM contacts or any email address")), recipients.length > 0 && React.createElement("div", {
    className: "cn-docsend-chips"
  }, recipients.map(r => React.createElement("span", {
    key: r.email,
    className: `cn-docsend-chip ${r.contactId ? "" : "is-external"}`
  }, r.contactId ? "◉" : "✉", " ", r.name, r.contactId && r.name !== r.email ? React.createElement("span", {
    className: "cn-docsend-chip-mail"
  }, r.email) : null, React.createElement("button", {
    onClick: () => removeRecipient(r.email),
    title: "Remove"
  }, "\u2715")))), React.createElement("input", {
    className: "cn-input",
    placeholder: "Search contacts, or type an email and press Enter\u2026",
    value: q,
    onChange: e => setQ(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (matches.length === 1) addContact(matches[0]);else addTyped();
      }
    }
  }), matches.length > 0 && React.createElement("div", {
    className: "cn-docsend-matches"
  }, matches.map(c => {
    var acct = window.accountOf && window.accountOf(c.accountId, scenario);
    return React.createElement("button", {
      key: c.id,
      className: "cn-docsend-match",
      onClick: () => addContact(c)
    }, React.createElement("span", {
      className: "cn-docsend-match-name"
    }, c.name), React.createElement("span", {
      className: "cn-docsend-match-sub"
    }, c.email || "no email on file", acct ? ` · ${acct.name}` : ""));
  }))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Subject"), React.createElement("input", {
    className: "cn-input",
    value: subject,
    onChange: e => setSubject(e.target.value)
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Message", React.createElement("span", {
    className: "cn-field-help",
    style: {
      display: "inline"
    }
  }, " \xB7 ", "{{first_name}}", " and ", "{{company}}", " fill in per recipient"), React.createElement("button", {
    className: "cn-docsend-reset",
    onClick: () => {
      setSubject(defaultDocSubject(docs));
      setBody(defaultDocBody(docs, currentUser));
    },
    title: "Restore the suggested copy for what you're sending"
  }, "\u21BB reset copy")), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 190
    },
    value: body,
    onChange: e => setBody(e.target.value)
  })), React.createElement("div", {
    className: "cn-docsend-att"
  }, React.createElement("div", {
    className: "cn-docsend-att-head"
  }, React.createElement("span", {
    className: "cn-card-eyebrow"
  }, "Attaching"), React.createElement("span", {
    className: `cn-docsend-size ${overMax ? "is-bad" : overWarn ? "is-warn" : ""}`
  }, prepping ? "reading files…" : `${attachments.length} file${attachments.length === 1 ? "" : "s"} · ${_dsBytes(totalBytes)}`)), React.createElement("div", {
    className: "cn-docsend-att-list"
  }, docs.map(d => {
    var att = attachments.find(a => a.docId === d.id);
    var link = isLinkOnly(d);
    var failed = prepError && prepError.find(f => f.title === d.title);
    return React.createElement("div", {
      key: d.id,
      className: `cn-docsend-att-row ${failed ? "is-bad" : ""}`
    }, React.createElement("span", {
      className: "cn-docsend-att-name"
    }, d.title), React.createElement("span", {
      className: "cn-docsend-att-meta"
    }, link ? "sent as a link" : failed ? "couldn't read file" : att ? _dsBytes(att.size) : prepping ? "…" : "—"));
  })), overMax && React.createElement("div", {
    className: "cn-docsend-note is-bad"
  }, "Too large to email (", _dsBytes(totalBytes), "). Drop a document or two \u2014 the practical ceiling is about ", _dsBytes(DOC_ATTACH_MAX), "."), overWarn && React.createElement("div", {
    className: "cn-docsend-note is-warn"
  }, _dsBytes(totalBytes), " of attachments. Some corporate mail servers reject anything over 10 MB."), linkOnly.length > 0 && React.createElement("div", {
    className: "cn-docsend-note"
  }, linkOnly.length, " document", linkOnly.length === 1 ? " is" : "s are", " an external link \u2014 ", linkOnly.length === 1 ? "it's" : "they're", " added to the bottom of the message instead of attached."), recipients.some(r => !r.contactId) && React.createElement("div", {
    className: "cn-docsend-note"
  }, "Open tracking only works for CRM contacts. Typed addresses still receive the email."))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose,
    disabled: sending
  }, "Cancel"), React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: send,
    disabled: sending || prepping || overMax
  }, sending ? React.createElement(Fragment, null, React.createElement("span", {
    className: "cn-spinner"
  }), "Sending\u2026") : `Send${recipients.length ? ` to ${recipients.length}` : ""} →`)))));
}
Object.assign(window, {
  DocumentSendDrawer,
  docToAttachment,
  docToBlob,
  isLinkOnly,
  readDocSendLog,
  appendDocSendLog,
  docSendStats,
  refreshDocSendLog
});