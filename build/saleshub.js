var SH_KEYS = {
  loi: "cn-sh-lois",
  invoice: "cn-sh-invoices",
  po: "cn-sh-pos"
};
var SH_TOKEN_INDEX = "cn-sh-token-index";
function shRead(kind) {
  try {
    return JSON.parse(localStorage.getItem(SH_KEYS[kind]) || "[]");
  } catch {
    return [];
  }
}
function shWrite(kind, list) {
  localStorage.setItem(SH_KEYS[kind], JSON.stringify(list));
  try {
    var idx = JSON.parse(localStorage.getItem(SH_TOKEN_INDEX) || "{}");
    for (var k of Object.keys(idx)) if (idx[k].kind === kind) delete idx[k];
    list.forEach(d => {
      if (d.shareToken) idx[d.shareToken] = {
        kind,
        id: d.id
      };
    });
    localStorage.setItem(SH_TOKEN_INDEX, JSON.stringify(idx));
  } catch {}
}
function shSave(kind, doc) {
  var list = shRead(kind);
  var i = list.findIndex(d => d.id === doc.id);
  var stamped = {
    ...doc,
    updatedAt: new Date().toISOString()
  };
  if (i >= 0) list[i] = stamped;else list.unshift(stamped);
  shWrite(kind, list);
  var shIsSent = !!stamped.sentAt || stamped.status && stamped.status !== "draft";
  if (window.publishSharedDoc && stamped.shareToken && shIsSent) {
    window.publishSharedDoc({
      kind,
      doc: stamped
    });
  }
  return stamped;
}
function shDelete(kind, id) {
  var doomed = shRead(kind).find(d => d.id === id);
  var next = shRead(kind).filter(d => d.id !== id);
  shWrite(kind, next);
  if (window.cnDeleteSharedDoc) window.cnDeleteSharedDoc({
    kind,
    id,
    shareToken: doomed && doomed.shareToken
  });
  return next;
}
function shLookupByToken(token) {
  try {
    var idx = JSON.parse(localStorage.getItem(SH_TOKEN_INDEX) || "{}");
    var hit = idx[token];
    if (!hit) return null;
    var doc = shRead(hit.kind).find(d => d.id === hit.id);
    return doc ? {
      kind: hit.kind,
      doc
    } : null;
  } catch {
    return null;
  }
}
function shCorrectCompanyInfoOnce() {
  var FLAG = "cn-sh-bankinfo-fix-2026";
  try {
    if (localStorage.getItem(FLAG)) return;
    var OLD_EIN = "88-2914003";
    var NEW = {
      ein: "42-2151519",
      bankName: "American Express National Bank",
      bankRouting: "124303243",
      bankAccount: "400119482877",
      bankSwift: "AEIBUS33"
    };
    var isOldBank = d => /jpmorgan|chase/i.test(d.bankName || "") || d.bankSwift === "CHASUS33" || d.bankRouting === "021000021" || (d.bankAccount || "").replace(/\D/g, "").endsWith("4827");
    ["loi", "invoice", "po"].forEach(kind => {
      var list = shRead(kind);
      var touched = false;
      list.forEach(d => {
        if (isOldBank(d)) {
          d.bankName = NEW.bankName;
          d.bankRouting = NEW.bankRouting;
          d.bankAccount = NEW.bankAccount;
          d.bankSwift = NEW.bankSwift;
          touched = true;
        }
        if (d.sellerEIN === OLD_EIN) {
          d.sellerEIN = NEW.ein;
          touched = true;
        }
      });
      if (touched) {
        shWrite(kind, list);
        if (window.publishSharedDoc) {
          list.forEach(d => {
            var sent = !!d.sentAt || d.status && d.status !== "draft";
            if (d.shareToken && sent) window.publishSharedDoc({
              kind,
              doc: d
            });
          });
        }
      }
    });
    localStorage.setItem(FLAG, "1");
  } catch (e) {}
}
shCorrectCompanyInfoOnce();
window.cnSalesHub = {
  shRead,
  shWrite,
  shSave,
  shDelete,
  shLookupByToken,
  SH_KEYS
};
function ShRichText({
  text
}) {
  if (!text) return null;
  var raw = String(text).replace(/\r\n?/g, "\n");
  var lines = raw.split("\n");
  var blocks = [];
  var bulletGroup = null;
  var flush = () => {
    if (bulletGroup) {
      blocks.push({
        kind: "bullets",
        items: bulletGroup
      });
      bulletGroup = null;
    }
  };
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i];
    var trimmed = ln.trim();
    if (!trimmed) {
      flush();
      blocks.push({
        kind: "gap"
      });
      continue;
    }
    var letters = trimmed.replace(/[^A-Za-z]/g, "");
    var isHeader = letters.length >= 3 && letters === letters.toUpperCase() && trimmed.length <= 80;
    if (isHeader) {
      flush();
      blocks.push({
        kind: "header",
        text: trimmed
      });
      continue;
    }
    var bulletMatch = trimmed.match(/^([-•])\s+(.*)$/);
    if (bulletMatch) {
      if (!bulletGroup) bulletGroup = [];
      bulletGroup.push(bulletMatch[2]);
      continue;
    }
    flush();
    var kv = trimmed.match(/^(.+?)\s+[—–-]\s+(.+)$/);
    if (kv && kv[1].length <= 60) {
      blocks.push({
        kind: "kv",
        label: kv[1],
        value: kv[2]
      });
      continue;
    }
    blocks.push({
      kind: "para",
      text: trimmed
    });
  }
  flush();
  return React.createElement("div", {
    className: "cn-rich"
  }, blocks.map((b, i) => {
    if (b.kind === "gap") return React.createElement("div", {
      key: i,
      className: "cn-rich-gap",
      "aria-hidden": "true"
    });
    if (b.kind === "header") return React.createElement("div", {
      key: i,
      className: "cn-rich-header"
    }, b.text);
    if (b.kind === "bullets") return React.createElement("ul", {
      key: i,
      className: "cn-rich-bullets"
    }, b.items.map((it, j) => React.createElement("li", {
      key: j
    }, it)));
    if (b.kind === "kv") return React.createElement("div", {
      key: i,
      className: "cn-rich-kv"
    }, React.createElement("span", {
      className: "cn-rich-kv-label"
    }, b.label), React.createElement("span", {
      className: "cn-rich-kv-dash"
    }, "\u2014"), React.createElement("span", {
      className: "cn-rich-kv-value"
    }, b.value));
    return React.createElement("p", {
      key: i,
      className: "cn-rich-para"
    }, b.text);
  }));
}
window.ShRichText = ShRichText;
var shNewId = p => p + "-" + Math.random().toString(36).slice(2, 10);
var shToken = () => "sh-" + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 8);
function shNewLine() {
  return {
    id: shNewId("li"),
    partNumber: "",
    description: "",
    qty: 1,
    condition: "New",
    unitPrice: 0
  };
}
function shLineTotal(li) {
  return (parseFloat(li.qty) || 0) * (parseFloat(li.unitPrice) || 0);
}
function shDocTotal(d) {
  return (d.lineItems || []).reduce((s, li) => s + shLineTotal(li), 0);
}
function shFmt(n) {
  return "$" + (Math.round((n || 0) * 100) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
function shTimeAgo(iso) {
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
function shToday() {
  return window.cnDay();
}
function shAddDays(iso, days) {
  return window.cnDayPlus(days, iso);
}
function shYearEnd(iso) {
  var d = window.cnParseDay(iso || shToday());
  return `${d.getFullYear()}-12-31`;
}
function shPartyFields(role) {
  return role === "seller" ? {
    name: "sellerName",
    address: "sellerAddress",
    taxId: "sellerTaxId",
    contactName: "sellerRep",
    contactEmail: "sellerEmail",
    contactPhone: "sellerPhone"
  } : {
    name: "buyerName",
    address: "buyerAddress",
    taxId: "buyerTaxId",
    contactName: "buyerContactName",
    contactEmail: "buyerContactEmail",
    contactPhone: "buyerContactPhone"
  };
}
var shOtherRole = role => role === "seller" ? "buyer" : "seller";
var shRoleLabel = role => role === "seller" ? "Seller" : "Buyer";
window.shHelpers = {
  shNewId,
  shToken,
  shNewLine,
  shLineTotal,
  shDocTotal,
  shFmt,
  shTimeAgo,
  shToday,
  shAddDays,
  shYearEnd,
  shPartyFields,
  shOtherRole,
  shRoleLabel
};
function ShPartyCard({
  role,
  doc,
  update,
  mine
}) {
  var f = shPartyFields(role);
  return React.createElement("div", {
    className: `cn-sh-party-card ${mine ? "cn-sh-party-card--mine" : "cn-sh-party-card--fill"}`
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, shRoleLabel(role), " ", React.createElement("span", {
    className: `cn-sh-party-tag ${mine ? "cn-sh-party-tag--mine" : ""}`
  }, mine ? "· that's us" : "· counterparty fills")), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Company (legal name)"), React.createElement("input", {
    className: "cn-input",
    value: doc[f.name] || "",
    onChange: e => update({
      [f.name]: e.target.value
    }),
    placeholder: mine ? "" : "Counterparty's legal entity name"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Address"), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 70
    },
    value: doc[f.address] || "",
    onChange: e => update({
      [f.address]: e.target.value
    }),
    placeholder: mine ? "" : "Street, city, state, ZIP, country"
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Tax ID / EIN"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: doc[f.taxId] || "",
    onChange: e => update({
      [f.taxId]: e.target.value
    }),
    placeholder: mine ? "" : "(counterparty fills)"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, role === "seller" ? "Representative" : "Primary contact"), React.createElement("input", {
    className: "cn-input",
    value: doc[f.contactName] || "",
    onChange: e => update({
      [f.contactName]: e.target.value
    }),
    placeholder: mine ? "" : "Contact name"
  }))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Email"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: doc[f.contactEmail] || "",
    onChange: e => update({
      [f.contactEmail]: e.target.value
    }),
    placeholder: mine ? "" : "contact@example.com"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Phone"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: doc[f.contactPhone] || "",
    onChange: e => update({
      [f.contactPhone]: e.target.value
    }),
    placeholder: mine ? "" : "(counterparty fills)"
  }))));
}
window.ShPartyCard = ShPartyCard;
function shSwapParties(doc) {
  return {
    sellerName: doc.buyerName,
    sellerAddress: doc.buyerAddress,
    sellerTaxId: doc.buyerTaxId,
    sellerRep: doc.buyerContactName,
    sellerEmail: doc.buyerContactEmail,
    sellerPhone: doc.buyerContactPhone,
    buyerName: doc.sellerName,
    buyerAddress: doc.sellerAddress,
    buyerTaxId: doc.sellerTaxId,
    buyerContactName: doc.sellerRep,
    buyerContactEmail: doc.sellerEmail,
    buyerContactPhone: doc.sellerPhone
  };
}
function ShRoleToggle({
  doc,
  update
}) {
  var our = doc.ourRole || "seller";
  var setRole = role => {
    if (role === our) return;
    update({
      ourRole: role,
      ...shSwapParties(doc)
    });
  };
  return React.createElement("div", {
    className: "cn-sh-ctrl"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Our position"), React.createElement("div", {
    className: "cn-segmented"
  }, React.createElement("button", {
    className: our === "seller" ? "is-active" : "",
    onClick: () => setRole("seller")
  }, "We're the Seller"), React.createElement("button", {
    className: our === "buyer" ? "is-active" : "",
    onClick: () => setRole("buyer")
  }, "We're the Buyer")));
}
window.ShRoleToggle = ShRoleToggle;
function shNewLOI(opp, account, contact, currentUser) {
  var today = shToday();
  var num = "LOI-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 9000) + 1000);
  return {
    id: shNewId("loi"),
    docNumber: num,
    issueDate: today,
    expiresDate: shAddDays(today, 30),
    sellerName: window.CN_BRAND ? window.CN_BRAND.legalName : "Chief Negotiators, LLC",
    sellerAddress: window.CN_BRAND ? window.CN_BRAND.address : "St. Petersburg, FL 33710\nUnited States",
    sellerRep: currentUser?.name || "",
    sellerEmail: currentUser?.email || "",
    sellerTaxId: window.CN_BRAND ? window.CN_BRAND.ein || "" : "",
    sellerPhone: "",
    ourRole: "seller",
    buyerName: account?.name || "",
    buyerAddress: account?.hq || "",
    buyerSigner: "",
    buyerTitle: "",
    buyerContactName: contact?.name || "",
    buyerContactEmail: contact?.email || "",
    buyerContactPhone: contact?.phone || "",
    buyerTaxId: "",
    subject: opp?.title || "",
    purpose: "Purchase of hardware as itemized below for production deployment.",
    lineItems: [shNewLine()],
    shipToSame: false,
    shipToName: "",
    shipToAddress: "",
    shipToAttention: "",
    incoterms: "FOB Origin",
    shipMethod: "Standard freight",
    targetDelivery: shAddDays(today, 60),
    paymentTerms: "50% deposit on PO issuance; balance Net 30 from delivery.",
    depositPct: 50,
    currency: "USD",
    bindingNature: "non-binding",
    exclusivity: true,
    exclusivityDays: 30,
    confidentiality: true,
    nonCircumvent: true,
    governingLaw: "State of Florida, USA",
    conditionsPrecedent: "Buyer due diligence on product condition, export-control clearance, and credit approval.",
    terminationClause: "Either party may terminate this LOI by written notice prior to execution of the definitive purchase agreement.",
    status: "draft",
    shareToken: shToken(),
    sentAt: null,
    viewedAt: null,
    viewCount: 0,
    buyerSignedName: "",
    buyerSignedTitle: "",
    buyerSignedDate: "",
    buyerSignatureDataURL: "",
    declineReason: "",
    oppId: opp?.id || null,
    accountId: account?.id || null,
    contactId: contact?.id || null,
    createdBy: currentUser?.id || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
function shNewInvoice(opp, account, contact, currentUser, fromQuote) {
  var today = shToday();
  var num = "INV-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 9000) + 1000);
  return {
    id: shNewId("inv"),
    docNumber: num,
    issueDate: today,
    dueDate: shAddDays(today, 30),
    poReference: fromQuote?.quoteNumber || "",
    sellerName: window.CN_BRAND ? window.CN_BRAND.legalName : "Chief Negotiators, LLC",
    sellerAddress: window.CN_BRAND ? window.CN_BRAND.address : "St. Petersburg, FL 33710\nUnited States",
    sellerEIN: window.CN_BRAND ? window.CN_BRAND.ein : "42-2151519",
    sellerRep: currentUser?.name || "",
    sellerEmail: currentUser?.email || "",
    billToName: account?.name || "",
    billToAddress: account?.hq || "",
    billToAttention: contact?.name || "",
    billToEmail: contact?.email || "",
    shipToSame: true,
    shipToName: account?.name || "",
    shipToAddress: account?.hq || "",
    shipToAttention: contact?.name || "",
    lineItems: fromQuote ? fromQuote.lineItems.map(li => ({
      ...li,
      id: shNewId("li")
    })) : [shNewLine()],
    taxRate: 0,
    shippingFee: 0,
    discount: 0,
    notes: fromQuote?.notes || "",
    currency: "USD",
    paymentTerms: "Net 30",
    paymentMethods: ["Wire transfer (USD)", "ACH (USD)", "Check"],
    bankName: "American Express National Bank",
    bankRouting: "124303243",
    bankAccount: "400119482877",
    bankSwift: "AEIBUS33",
    status: "draft",
    shareToken: shToken(),
    sentAt: null,
    viewedAt: null,
    viewCount: 0,
    paidAt: null,
    paymentMethodUsed: "",
    paymentReference: "",
    oppId: opp?.id || null,
    accountId: account?.id || null,
    contactId: contact?.id || null,
    fromQuoteId: fromQuote?.id || null,
    createdBy: currentUser?.id || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
function shNewPO(opp, account, contact, currentUser) {
  var today = shToday();
  var num = "OPO-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 9000) + 1000);
  var effective = today;
  return {
    id: shNewId("po"),
    docNumber: num,
    issueDate: today,
    poType: "open",
    ourRole: "seller",
    effectiveDate: effective,
    expirationDate: shYearEnd(today),
    sellerName: window.CN_BRAND ? window.CN_BRAND.legalName : "Chief Negotiators, LLC",
    sellerAddress: window.CN_BRAND ? window.CN_BRAND.address : "St. Petersburg, FL 33710\nUnited States",
    sellerRep: currentUser?.name || "",
    sellerEmail: currentUser?.email || "",
    sellerTaxId: window.CN_BRAND ? window.CN_BRAND.ein || "" : "",
    sellerPhone: "",
    buyerName: account?.name || "",
    buyerAddress: account?.hq || "",
    buyerSigner: "",
    buyerTitle: "",
    buyerContactName: contact?.name || "",
    buyerContactEmail: contact?.email || "",
    buyerContactPhone: contact?.phone || "",
    buyerTaxId: "",
    partNumber: "",
    description: "",
    condition: "New",
    contractQty: 100,
    unitPrice: 0,
    minReleaseQty: 1,
    lineItems: [shNewLine()],
    deliveryDate: shAddDays(today, 45),
    shipToSame: false,
    shipToName: "",
    shipToAddress: "",
    shipToAttention: "",
    incoterms: "FOB Origin",
    shipMethod: "Standard freight",
    schedule: [{
      id: shNewId("rel"),
      date: shAddDays(today, 30),
      qty: 25,
      note: ""
    }, {
      id: shNewId("rel"),
      date: shAddDays(today, 60),
      qty: 25,
      note: ""
    }, {
      id: shNewId("rel"),
      date: shAddDays(today, 90),
      qty: 25,
      note: ""
    }, {
      id: shNewId("rel"),
      date: shAddDays(today, 120),
      qty: 25,
      note: ""
    }],
    paymentTerms: "Net 30 per release, invoiced upon shipment.",
    currency: "USD",
    cancellationPolicy: "Buyer may cancel any unshipped release with 30 days written notice. Pricing locked through expiration date; no price escalation without mutual written agreement.",
    priceLockClause: "Unit price fixed for the full contract quantity through expiration. Volume rebates apply at 250+ and 500+ units.",
    governingLaw: "State of Florida, USA",
    forceMajeure: true,
    buyerSignedName: "",
    buyerSignedTitle: "",
    buyerSignedDate: "",
    buyerSignatureDataURL: "",
    declineReason: "",
    status: "draft",
    shareToken: shToken(),
    sentAt: null,
    viewedAt: null,
    viewCount: 0,
    oppId: opp?.id || null,
    accountId: account?.id || null,
    contactId: contact?.id || null,
    createdBy: currentUser?.id || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
window.shNewDocs = {
  shNewLOI,
  shNewInvoice,
  shNewPO
};
function ShStatus({
  doc,
  kind
}) {
  var status = doc.status || "draft";
  var labels = kind === "invoice" ? {
    draft: ["Draft", "cn-q-draft"],
    sent: ["Sent", "cn-q-sent"],
    viewed: ["Viewed", "cn-q-viewed"],
    paid: ["Paid", "cn-q-accepted"],
    overdue: ["Overdue", "cn-q-declined"],
    void: ["Void", "cn-q-declined"]
  } : {
    draft: ["Draft", "cn-q-draft"],
    sent: ["Sent", "cn-q-sent"],
    viewed: ["Viewed", "cn-q-viewed"],
    accepted: ["Accepted", "cn-q-accepted"],
    declined: ["Declined", "cn-q-declined"]
  };
  var [label, cls] = labels[status] || labels.draft;
  return React.createElement("span", {
    className: `cn-q-pill ${cls}`
  }, label);
}
window.ShStatus = ShStatus;
function SalesHubScreen({
  scenario,
  currentUser,
  onOpenContact,
  onOpenOpp
}) {
  var [tab, setTab] = useState("loi");
  var [lois, setLois] = useState(() => shRead("loi"));
  var [invoices, setInvoices] = useState(() => shRead("invoice"));
  var [pos, setPos] = useState(() => shRead("po"));
  var [editing, setEditing] = useState(null);
  var [sharing, setSharing] = useState(null);
  var [q, setQ] = useState("");
  var [syncing, setSyncing] = useState(false);
  var [syncNote, setSyncNote] = useState(null);
  var refreshAll = () => {
    setLois(shRead("loi"));
    setInvoices(shRead("invoice"));
    setPos(shRead("po"));
  };
  var syncFromServer = async ({
    quiet = false
  } = {}) => {
    if (!window.loadCompanyDocs || !window.mergeDocLists) return;
    if (!quiet) setSyncing(true);
    var totalChanged = 0,
      totalAdded = 0,
      failed = false;
    try {
      for (var kind of ["loi", "invoice", "po"]) {
        var server = await window.loadCompanyDocs(kind);
        if (server === null) {
          failed = true;
          continue;
        }
        var {
          merged,
          changed,
          added
        } = window.mergeDocLists(shRead(kind), server, kind);
        if (changed > 0) shWrite(kind, merged);
        totalChanged += changed;
        totalAdded += added;
      }
      refreshAll();
      setSyncNote(failed && totalChanged === 0 ? {
        error: true,
        at: Date.now()
      } : {
        changed: totalChanged,
        added: totalAdded,
        at: Date.now()
      });
    } catch (e) {
      console.warn("Sales Hub sync failed:", e);
      if (!quiet) setSyncNote({
        error: true,
        at: Date.now()
      });
    } finally {
      if (!quiet) setSyncing(false);
    }
  };
  useEffect(() => {
    syncFromServer({
      quiet: true
    });
  }, []);
  var lists = {
    loi: lois,
    invoice: invoices,
    po: pos
  };
  var titles = {
    loi: {
      label: "Letters of Intent",
      eyebrow: "LOI",
      blurb: "Non-binding (or binding) intent to purchase. Customer fills buyer info, agrees to terms, signs back."
    },
    invoice: {
      label: "Invoices",
      eyebrow: "Invoice",
      blurb: "Billable invoices. Send standalone or from a closed quote. Customer can mark paid once funds are received."
    },
    po: {
      label: "Purchase Orders",
      eyebrow: "PO",
      blurb: "Cut a one-time PO (itemized, single delivery) or an open/blanket PO (locked SKU + release schedule). Either party can be buyer or seller — the counterparty fills their details and signs."
    }
  };
  var filtered = (() => {
    var list = lists[tab] || [];
    var needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(d => (d.docNumber || "").toLowerCase().includes(needle) || (d.buyerName || d.billToName || "").toLowerCase().includes(needle) || (d.subject || d.poReference || d.partNumber || "").toLowerCase().includes(needle));
  })();
  var createNew = (kind, fromQuote = null) => {
    var acct = null,
      cont = null,
      opp = null;
    var doc;
    if (kind === "loi") doc = shNewLOI(opp, acct, cont, currentUser);else if (kind === "invoice") doc = shNewInvoice(opp, acct, cont, currentUser, fromQuote);else if (kind === "po") doc = shNewPO(opp, acct, cont, currentUser);
    setEditing({
      kind,
      doc
    });
  };
  var onSaveDoc = (kind, doc) => {
    var saved = shSave(kind, doc);
    refreshAll();
    setEditing({
      kind,
      doc: saved
    });
  };
  var onDeleteDoc = (kind, id) => {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    shDelete(kind, id);
    refreshAll();
    if (editing?.doc?.id === id) setEditing(null);
  };
  var stats = (() => {
    var totals = {
      loi: lois.reduce((s, d) => s + shDocTotal(d), 0),
      invoice: invoices.reduce((s, d) => s + (shDocTotal(d) + (parseFloat(d.shippingFee) || 0) + shDocTotal(d) * (parseFloat(d.taxRate) || 0) / 100 - (parseFloat(d.discount) || 0)), 0),
      po: pos.reduce((s, d) => s + (d.poType === "onetime" ? shDocTotal(d) : (parseFloat(d.contractQty) || 0) * (parseFloat(d.unitPrice) || 0)), 0)
    };
    return {
      lois: {
        count: lois.length,
        open: lois.filter(d => d.status === "sent" || d.status === "viewed").length,
        won: lois.filter(d => d.status === "accepted").length,
        value: totals.loi
      },
      invoices: {
        count: invoices.length,
        open: invoices.filter(d => d.status === "sent" || d.status === "viewed").length,
        paid: invoices.filter(d => d.status === "paid").length,
        value: totals.invoice
      },
      pos: {
        count: pos.length,
        open: pos.filter(d => d.status === "sent" || d.status === "viewed").length,
        active: pos.filter(d => d.status === "accepted").length,
        value: totals.po
      }
    };
  })();
  return React.createElement("div", {
    className: "cn-page",
    style: {
      padding: 0,
      gap: 20
    }
  }, React.createElement("header", {
    className: "cn-docs-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Sales Hub"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      marginTop: 4
    }
  }, "Letters of Intent, Invoices & Open POs"), React.createElement("p", {
    style: {
      color: "var(--cn-mute)",
      margin: "6px 0 0",
      maxWidth: 640,
      fontSize: 13.5
    }
  }, "Send legally-sound LOIs, billable invoices, and blanket purchase orders with shipping schedules. Customer fills, agrees, signs \u2014 comes straight back to you.")), React.createElement("div", {
    className: "cn-docs-head-actions"
  }, React.createElement("input", {
    className: "cn-input",
    placeholder: `Search ${titles[tab].label.toLowerCase()}…`,
    value: q,
    onChange: e => setQ(e.target.value),
    style: {
      width: 240
    }
  }), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => syncFromServer(),
    disabled: syncing,
    title: "Sync with the team: pull in documents created by other reps and any customer-signed copies. Run this if a doc or signature isn't showing up."
  }, syncing ? "Syncing…" : "↻ Sync with team"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => createNew(tab)
  }, "+ New ", titles[tab].eyebrow))), syncNote && React.createElement("div", {
    className: "cn-sh-band",
    style: {
      background: syncNote.error ? "#FBE9E4" : syncNote.changed > 0 ? "#E8F3EC" : "var(--cn-surface-2, #F0E9D8)",
      borderRadius: 8,
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: "var(--cn-ink-2)"
    }
  }, syncNote.error ? "Couldn't reach the server to sync. You're seeing this browser's copies only — check your connection and try again." : syncNote.changed > 0 || syncNote.added > 0 ? `✓ Synced with the team. ${syncNote.added > 0 ? `Pulled in ${syncNote.added} doc${syncNote.added === 1 ? "" : "s"} from teammates / other devices. ` : ""}${syncNote.changed - (syncNote.added || 0) > 0 ? `${syncNote.changed - syncNote.added} signed/updated cop${syncNote.changed - syncNote.added === 1 ? "y" : "ies"} refreshed.` : ""}`.trim() : "Up to date with the team. No new signatures or documents. (If a customer says they signed, make sure they used the share link — clicked “Accept & sign” — not just replied to the email.)"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      padding: "4px 10px"
    },
    onClick: () => setSyncNote(null)
  }, "Dismiss")), React.createElement("div", {
    className: "cn-kpi-row"
  }, React.createElement("button", {
    className: `cn-sh-kpi ${tab === "loi" ? "is-active" : ""}`,
    onClick: () => setTab("loi")
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, "Letters of Intent"), React.createElement("div", {
    className: "cn-kpi-value"
  }, stats.lois.count), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", {
    className: "cn-kpi-foot-pri"
  }, stats.lois.open), " awaiting", React.createElement("span", {
    className: "cn-kpi-foot-sep"
  }, "\xB7"), React.createElement("span", {
    style: {
      color: "var(--cn-pos)"
    }
  }, stats.lois.won), " accepted", React.createElement("span", {
    className: "cn-kpi-foot-sep"
  }, "\xB7"), React.createElement("span", {
    className: "cn-mono"
  }, shFmt(stats.lois.value)))), React.createElement("button", {
    className: `cn-sh-kpi ${tab === "invoice" ? "is-active" : ""}`,
    onClick: () => setTab("invoice")
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, "Invoices"), React.createElement("div", {
    className: "cn-kpi-value"
  }, stats.invoices.count), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", {
    className: "cn-kpi-foot-pri"
  }, stats.invoices.open), " outstanding", React.createElement("span", {
    className: "cn-kpi-foot-sep"
  }, "\xB7"), React.createElement("span", {
    style: {
      color: "var(--cn-pos)"
    }
  }, stats.invoices.paid), " paid", React.createElement("span", {
    className: "cn-kpi-foot-sep"
  }, "\xB7"), React.createElement("span", {
    className: "cn-mono"
  }, shFmt(stats.invoices.value)))), React.createElement("button", {
    className: `cn-sh-kpi ${tab === "po" ? "is-active" : ""}`,
    onClick: () => setTab("po")
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, "Purchase Orders"), React.createElement("div", {
    className: "cn-kpi-value"
  }, stats.pos.count), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", {
    className: "cn-kpi-foot-pri"
  }, stats.pos.open), " awaiting", React.createElement("span", {
    className: "cn-kpi-foot-sep"
  }, "\xB7"), React.createElement("span", {
    style: {
      color: "var(--cn-pos)"
    }
  }, stats.pos.active), " active", React.createElement("span", {
    className: "cn-kpi-foot-sep"
  }, "\xB7"), React.createElement("span", {
    className: "cn-mono"
  }, shFmt(stats.pos.value))))), React.createElement("div", {
    className: "cn-sh-band"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      color: "var(--cn-copper)"
    }
  }, titles[tab].eyebrow), React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: "var(--cn-ink-2)",
      marginTop: 2
    }
  }, titles[tab].blurb)), tab === "invoice" && React.createElement(ShInvoiceFromQuote, {
    scenario: scenario,
    onPick: (opp, account, contact, quote) => {
      var doc = shNewInvoice(opp, account, contact, currentUser, quote);
      doc.oppId = opp.id;
      doc.accountId = account.id;
      doc.contactId = contact?.id || null;
      setEditing({
        kind: "invoice",
        doc
      });
    }
  })), React.createElement("div", {
    className: "cn-sh-list"
  }, filtered.length === 0 ? React.createElement("div", {
    className: "cn-docs-empty"
  }, React.createElement("div", {
    className: "cn-docs-empty-title"
  }, q ? "No matches." : `No ${titles[tab].label.toLowerCase()} yet.`), React.createElement("div", {
    className: "cn-docs-empty-sub"
  }, "Build one and send it for signature."), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      marginTop: 14
    },
    onClick: () => createNew(tab)
  }, "+ New ", titles[tab].eyebrow)) : filtered.map(d => React.createElement(ShDocRow, {
    key: d.id,
    doc: d,
    kind: tab,
    scenario: scenario,
    onEdit: () => setEditing({
      kind: tab,
      doc: d
    }),
    onShare: () => setSharing({
      kind: tab,
      doc: d
    }),
    onDelete: () => onDeleteDoc(tab, d.id),
    onOpenContact: onOpenContact,
    onOpenOpp: onOpenOpp
  }))), editing?.kind === "loi" && React.createElement(window.ShLOIBuilder, {
    doc: editing.doc,
    scenario: scenario,
    currentUser: currentUser,
    onChange: patch => onSaveDoc("loi", {
      ...editing.doc,
      ...patch
    }),
    onClose: () => {
      setEditing(null);
      refreshAll();
    },
    onShare: () => {
      setSharing({
        kind: "loi",
        doc: editing.doc
      });
      setEditing(null);
    },
    onDelete: () => onDeleteDoc("loi", editing.doc.id)
  }), editing?.kind === "invoice" && React.createElement(window.ShInvoiceBuilder, {
    doc: editing.doc,
    scenario: scenario,
    currentUser: currentUser,
    onChange: patch => onSaveDoc("invoice", {
      ...editing.doc,
      ...patch
    }),
    onClose: () => {
      setEditing(null);
      refreshAll();
    },
    onShare: () => {
      setSharing({
        kind: "invoice",
        doc: editing.doc
      });
      setEditing(null);
    },
    onDelete: () => onDeleteDoc("invoice", editing.doc.id)
  }), editing?.kind === "po" && React.createElement(window.ShPOBuilder, {
    doc: editing.doc,
    scenario: scenario,
    currentUser: currentUser,
    onChange: patch => onSaveDoc("po", {
      ...editing.doc,
      ...patch
    }),
    onClose: () => {
      setEditing(null);
      refreshAll();
    },
    onShare: () => {
      setSharing({
        kind: "po",
        doc: editing.doc
      });
      setEditing(null);
    },
    onDelete: () => onDeleteDoc("po", editing.doc.id)
  }), sharing && React.createElement(ShShareModal, {
    kind: sharing.kind,
    doc: sharing.doc,
    scenario: scenario,
    currentUser: currentUser,
    onClose: () => {
      setSharing(null);
      refreshAll();
    },
    onUpdate: patch => {
      var next = shSave(sharing.kind, {
        ...sharing.doc,
        ...patch
      });
      setSharing({
        ...sharing,
        doc: next
      });
      refreshAll();
    }
  }));
}
function ShInvoiceFromQuote({
  scenario,
  onPick
}) {
  var [open, setOpen] = useState(false);
  var allQuotes = useMemo(() => {
    if (!scenario?.opps) return [];
    var out = [];
    var _loop = function (opp) {
      var list = window.cnQuotes?.readQuotes?.(opp.id) || [];
      for (var q of list) {
        var acct = scenario.accounts.find(a => a.id === opp.accountId) || {
          id: null,
          name: "—"
        };
        var cont = scenario.contacts.find(c => c.id === opp.contactId) || {
          id: null,
          name: "—",
          email: ""
        };
        out.push({
          opp,
          account: acct,
          contact: cont,
          quote: q
        });
      }
    };
    for (var opp of scenario.opps) {
      _loop(opp);
    }
    out.sort((a, b) => {
      var pri = x => x.quote.status === "accepted" ? 0 : 1;
      var aP = pri(a),
        bP = pri(b);
      if (aP !== bP) return aP - bP;
      return new Date(b.quote.updatedAt || 0) - new Date(a.quote.updatedAt || 0);
    });
    return out;
  }, [scenario]);
  return React.createElement("div", {
    style: {
      position: "relative"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setOpen(!open)
  }, "Invoice from a quote \u2193"), open && React.createElement("div", {
    className: "cn-sh-quote-pop",
    onMouseLeave: () => setOpen(false)
  }, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      padding: "12px 14px 6px"
    }
  }, "Pick a quote"), allQuotes.length === 0 ? React.createElement("div", {
    style: {
      padding: "0 14px 14px",
      fontSize: 12.5,
      color: "var(--cn-mute)"
    }
  }, "No quotes yet. Build one from a deal first.") : allQuotes.slice(0, 8).map((row, i) => React.createElement("button", {
    key: i,
    className: "cn-sh-quote-row",
    onClick: () => {
      onPick(row.opp, row.account, row.contact, row.quote);
      setOpen(false);
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-mono",
    style: {
      fontSize: 12.5
    }
  }, row.quote.quoteNumber, " \xB7 v", row.quote.version), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--cn-mute)"
    }
  }, row.account?.name || "—", " \xB7 ", row.opp.title)), React.createElement("div", {
    className: "cn-mono",
    style: {
      fontSize: 12.5
    }
  }, shFmt(shDocTotal(row.quote)))))));
}
function ShDocRow({
  doc,
  kind,
  scenario,
  onEdit,
  onShare,
  onDelete,
  onOpenContact,
  onOpenOpp
}) {
  var total = kind === "po" ? doc.poType === "onetime" ? shDocTotal(doc) : (parseFloat(doc.contractQty) || 0) * (parseFloat(doc.unitPrice) || 0) : shDocTotal(doc) + (kind === "invoice" ? (parseFloat(doc.shippingFee) || 0) + shDocTotal(doc) * (parseFloat(doc.taxRate) || 0) / 100 - (parseFloat(doc.discount) || 0) : 0);
  var counterName = d => {
    if (kind === "invoice") return d.billToName;
    return d.ourRole === "buyer" ? d.sellerName : d.buyerName;
  };
  var counter = counterName(doc);
  var poTypeLabel = doc.poType === "onetime" ? "One-time" : "Open";
  var sub = kind === "po" ? doc.poType === "onetime" ? `One-time · ${(doc.lineItems || []).length} line${(doc.lineItems || []).length === 1 ? "" : "s"} · deliver ${doc.deliveryDate || "—"}` : `Open · ${doc.partNumber || "—"} · qty ${doc.contractQty || 0} · through ${doc.expirationDate}` : kind === "invoice" ? `Issued ${doc.issueDate} · due ${doc.dueDate}${doc.poReference ? " · ref " + doc.poReference : ""}` : `${doc.subject || "—"} · ${doc.bindingNature === "binding" ? "Binding" : "Non-binding"} · valid through ${doc.expiresDate}`;
  var linkedOpp = doc.oppId ? scenario?.opps?.find(o => o.id === doc.oppId) : null;
  return React.createElement("article", {
    className: "cn-q-row",
    style: {
      marginBottom: 8
    }
  }, React.createElement("div", {
    className: "cn-q-row-left"
  }, React.createElement("div", {
    className: "cn-q-vtag cn-mono",
    style: {
      minWidth: 44
    }
  }, kind === "loi" ? "LOI" : kind === "invoice" ? "INV" : doc.poType === "onetime" ? "PO" : "OPO"), React.createElement("div", {
    className: "cn-q-row-meta"
  }, React.createElement("div", {
    className: "cn-q-row-num"
  }, React.createElement("span", {
    className: "cn-mono"
  }, doc.docNumber), React.createElement(ShStatus, {
    doc: doc,
    kind: kind
  }), counter && React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12.5
    }
  }, "\xB7 ", counter)), React.createElement("div", {
    className: "cn-q-row-sub"
  }, sub, doc.sentAt && React.createElement(React.Fragment, null, " \xB7 Sent ", shTimeAgo(doc.sentAt)), doc.viewedAt && React.createElement(React.Fragment, null, " \xB7 ", React.createElement("span", {
    className: "cn-q-viewed-inline"
  }, "Viewed ", shTimeAgo(doc.viewedAt), doc.viewCount > 1 ? ` (${doc.viewCount}×)` : "")), linkedOpp && React.createElement(React.Fragment, null, " · ", React.createElement("button", {
    className: "cn-link-inline",
    onClick: () => onOpenOpp && onOpenOpp(linkedOpp.id),
    style: {
      fontSize: 12
    }
  }, "\u25A4 ", linkedOpp.title))))), React.createElement("div", {
    className: "cn-q-row-right"
  }, React.createElement("div", {
    className: "cn-q-row-total cn-mono"
  }, shFmt(total)), React.createElement("div", {
    className: "cn-q-row-actions"
  }, React.createElement("button", {
    className: "cn-link",
    onClick: onEdit
  }, "Edit"), React.createElement("span", {
    className: "cn-q-actsep"
  }, "\xB7"), React.createElement("button", {
    className: "cn-link",
    onClick: onShare
  }, "Send"), React.createElement("span", {
    className: "cn-q-actsep"
  }, "\xB7"), React.createElement("button", {
    className: "cn-link cn-link--neg",
    onClick: onDelete
  }, "Delete"))));
}
function ShShareModal({
  kind,
  doc,
  scenario,
  currentUser,
  onClose,
  onUpdate
}) {
  var labels = {
    loi: "Letter of Intent",
    invoice: "Invoice",
    po: doc.poType === "onetime" ? "Purchase Order" : "Open Purchase Order"
  };
  var param = {
    loi: "loi",
    invoice: "invoice",
    po: "po"
  }[kind];
  var shareUrl = window.location.origin + window.location.pathname + "?" + param + "=" + doc.shareToken;
  var [copied, setCopied] = useState(false);
  var [justSent, setJustSent] = useState(false);
  var [, force] = useState(0);
  useEffect(() => {
    var tick = () => {
      var fresh = shRead(kind).find(d => d.id === doc.id);
      if (fresh && (fresh.viewedAt !== doc.viewedAt || fresh.viewCount !== doc.viewCount || fresh.status !== doc.status)) {
        onUpdate({
          viewedAt: fresh.viewedAt,
          viewCount: fresh.viewCount,
          status: fresh.status,
          buyerSignedName: fresh.buyerSignedName,
          buyerSignedDate: fresh.buyerSignedDate,
          paidAt: fresh.paidAt
        });
      }
      force(n => n + 1);
    };
    var id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, [doc.id]);
  var copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      var ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    markSent();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  var markSent = () => onUpdate({
    sentAt: new Date().toISOString(),
    status: doc.status === "viewed" ? "viewed" : "sent",
    sendCount: (doc.sendCount || 0) + 1
  });
  var handleEmailSend = () => {
    markSent();
    setJustSent(true);
  };
  var alreadySent = !!doc.sentAt || justSent;
  var openPreview = () => window.open(shareUrl + "&preview=1", "_blank", "noopener");
  var counterIsSeller = doc.ourRole === "buyer";
  var buyerEmail = kind === "invoice" ? doc.billToEmail || "" : counterIsSeller ? doc.sellerEmail || "" : doc.buyerContactEmail || "";
  var buyerName = kind === "invoice" ? doc.billToAttention || "" : counterIsSeller ? doc.sellerRep || "" : doc.buyerContactName || "";
  var firstName = (buyerName || "").split(" ")[0] || "there";
  var cnBrandName = window.CN_BRAND && window.CN_BRAND.name || "Chief Negotiators";
  var poNoun = doc.poType === "onetime" ? "Purchase Order" : "Open PO";
  var subjectMap = {
    loi: `Letter of Intent ${doc.docNumber} from ${cnBrandName}`,
    invoice: `Invoice ${doc.docNumber} from ${cnBrandName} — due ${doc.dueDate}`,
    po: `${poNoun} ${doc.docNumber} — ${cnBrandName}`
  };
  var poBody = doc.poType === "onetime" ? `Hi ${firstName},

Please find Purchase Order ${doc.docNumber} at the link below — itemized, with a delivery date of ${doc.deliveryDate || "TBD"}. Review the lines, fill in your details, and accept directly from the link.

${shareUrl}

— ${currentUser?.name || cnBrandName}` : `Hi ${firstName},

Open PO ${doc.docNumber} locks in pricing on ${doc.partNumber || "the agreed SKU"} for the contract quantity of ${doc.contractQty} units through ${doc.expirationDate}. Review the shipping schedule, fill in your signing-authority details, and accept directly from the link.

${shareUrl}

— ${currentUser?.name || cnBrandName}`;
  var bodyMap = {
    loi: `Hi ${firstName},

Please find Letter of Intent ${doc.docNumber} at the link below. The LOI sets out the products, pricing, shipping destination, and commercial terms. You can fill in your company's signing-authority details and accept the terms directly from the link — it'll come straight back to me.

${shareUrl}

Happy to walk through any section before you sign.

— ${currentUser?.name || cnBrandName}`,
    invoice: `Hi ${firstName},

Invoice ${doc.docNumber} is ready for payment — due ${doc.dueDate}. Wire & ACH details are on the invoice itself; you can mark it paid from the link once funds are out the door.

${shareUrl}

Thanks,
${currentUser?.name || cnBrandName}`,
    po: poBody
  };
  var emailHref = `mailto:${buyerEmail}?subject=${encodeURIComponent(subjectMap[kind])}&body=${encodeURIComponent(bodyMap[kind])}`;
  var encSubj = encodeURIComponent(subjectMap[kind]);
  var encBody = encodeURIComponent(bodyMap[kind]);
  var gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(buyerEmail)}&su=${encSubj}&body=${encBody}`;
  var outlookHref = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(buyerEmail)}&subject=${encSubj}&body=${encBody}`;
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
  }, "Send ", labels[kind]), React.createElement("h2", {
    className: "cn-modal-title"
  }, doc.docNumber)), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-share-chooser"
  }, alreadySent ? React.createElement("div", {
    className: "cn-share-sent-banner",
    role: "status",
    "aria-live": "polite"
  }, React.createElement("span", {
    className: "cn-share-sent-check"
  }, "\u2713"), React.createElement("div", null, React.createElement("div", {
    className: "cn-share-sent-title"
  }, labels[kind], " marked as sent", doc.sentAt ? React.createElement("span", {
    className: "cn-share-sent-ago"
  }, " \xB7 ", shTimeAgo(doc.sentAt)) : null), React.createElement("div", {
    className: "cn-share-sent-sub"
  }, "A draft should have opened in the tab/app you picked \u2014 hit send there to actually deliver it. It's one shareable link, so re-sending never creates a duplicate ", labels[kind].toLowerCase(), "."))) : React.createElement("div", {
    className: "cn-share-chooser-lead"
  }, "How would you like to send ", React.createElement("span", {
    className: "cn-mono"
  }, doc.docNumber), "?"), React.createElement("div", {
    className: "cn-share-options"
  }, React.createElement("div", {
    className: "cn-share-option cn-share-option--email" + (alreadySent ? " cn-share-option--done" : "")
  }, React.createElement("div", {
    className: "cn-share-option-glyph"
  }, alreadySent ? "✓" : "✉"), React.createElement("div", {
    className: "cn-share-option-text"
  }, React.createElement("div", {
    className: "cn-share-option-title"
  }, alreadySent ? "Email draft was opened" : "Open an email draft"), React.createElement("div", {
    className: "cn-share-option-sub"
  }, alreadySent ? React.createElement(React.Fragment, null, "Same link to the same ", labels[kind].toLowerCase(), " \u2014 re-sending won't create a duplicate.") : React.createElement(React.Fragment, null, "Opens a pre-filled draft to ", React.createElement("span", {
    className: "cn-mono"
  }, buyerEmail || "buyer email"), ". Pick where you read email:")), React.createElement("div", {
    className: "cn-share-mailrow"
  }, React.createElement("a", {
    className: "cn-share-mailchip",
    href: gmailHref,
    target: "_blank",
    rel: "noopener",
    onClick: handleEmailSend
  }, "Gmail \u2197"), React.createElement("a", {
    className: "cn-share-mailchip",
    href: outlookHref,
    target: "_blank",
    rel: "noopener",
    onClick: handleEmailSend
  }, "Outlook web \u2197"), React.createElement("a", {
    className: "cn-share-mailchip",
    href: emailHref,
    onClick: handleEmailSend
  }, "Desktop mail app \u2197")))), React.createElement("button", {
    className: "cn-share-option",
    onClick: openPreview
  }, React.createElement("div", {
    className: "cn-share-option-glyph"
  }, "\u2913"), React.createElement("div", {
    className: "cn-share-option-text"
  }, React.createElement("div", {
    className: "cn-share-option-title"
  }, "Preview / Save as PDF"), React.createElement("div", {
    className: "cn-share-option-sub"
  }, "Opens the printable ", labels[kind].toLowerCase(), " in a new tab. Print \u2192 Save as PDF.")), React.createElement("div", {
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
  }, copied ? "✓" : "⧉"))), (doc.sentAt || doc.viewedAt) && React.createElement("div", {
    className: "cn-share-status",
    style: {
      marginTop: 8
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Delivery"), React.createElement("div", {
    className: "cn-share-status-line"
  }, doc.sentAt ? React.createElement("span", null, React.createElement("span", {
    className: "cn-q-status-dot cn-q-status-dot--sent"
  }), " Sent ", shTimeAgo(doc.sentAt)) : React.createElement("span", null, React.createElement("span", {
    className: "cn-q-status-dot cn-q-status-dot--draft"
  }), " Not yet sent"))), React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "View tracking"), React.createElement("div", {
    className: "cn-share-status-line"
  }, doc.viewedAt ? React.createElement("span", null, React.createElement("span", {
    className: "cn-q-status-dot cn-q-status-dot--viewed"
  }), " Viewed ", shTimeAgo(doc.viewedAt), doc.viewCount > 1 ? ` · ${doc.viewCount} opens` : "") : doc.sentAt ? React.createElement("span", null, React.createElement("span", {
    className: "cn-q-status-dot cn-q-status-dot--waiting"
  }), " Awaiting open\u2026") : React.createElement("span", null, React.createElement("span", {
    className: "cn-q-status-dot cn-q-status-dot--draft"
  }), " Pings here when the buyer opens the link")))), (doc.status === "accepted" || doc.status === "paid") && React.createElement("div", {
    className: "cn-sh-accepted"
  }, React.createElement("span", null, "\u2713"), React.createElement("div", null, React.createElement("div", {
    style: {
      fontWeight: 600
    }
  }, doc.status === "paid" ? "Marked paid" : "Accepted & signed"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--cn-mute)"
    }
  }, doc.buyerSignedName ? `By ${doc.buyerSignedName}${doc.buyerSignedTitle ? ", " + doc.buyerSignedTitle : ""}` : "", doc.buyerSignedDate ? ` on ${doc.buyerSignedDate}` : "", doc.paymentMethodUsed ? `via ${doc.paymentMethodUsed}` : "")))), React.createElement("details", {
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
      status: "draft",
      buyerSignedName: "",
      buyerSignedDate: "",
      paidAt: null
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
function ShShareRouter({
  token,
  kind,
  preview = false
}) {
  var [hit, setHit] = useState(null);
  var [notFound, setNotFound] = useState(false);
  useEffect(() => {
    var cancelled = false;
    (async () => {
      var doc = shRead(kind).find(d => d.shareToken === token);
      if (!doc && window.loadSharedDoc) {
        var remote = await window.loadSharedDoc(token);
        if (remote && remote.kind === kind) doc = remote.doc;
        if (doc) {
          var _list = shRead(kind);
          if (!_list.some(d => d.id === doc.id)) shWrite(kind, [doc, ..._list]);
        }
      }
      if (cancelled) return;
      if (!doc) {
        setNotFound(true);
        return;
      }
      var isSent = !!doc.sentAt || doc.status && doc.status !== "draft";
      if (!isSent) {
        if (preview) {
          setHit({
            doc
          });
          return;
        }
        setNotFound(true);
        return;
      }
      if (preview) {
        setHit({
          doc
        });
        return;
      }
      var list = shRead(kind);
      var idx = list.findIndex(d => d.id === doc.id);
      var updated = {
        ...doc,
        viewedAt: new Date().toISOString(),
        viewCount: (doc.viewCount || 0) + 1,
        status: doc.status === "sent" ? "viewed" : doc.status
      };
      if (idx >= 0) list[idx] = updated;else list.unshift(updated);
      shWrite(kind, list);
      if (window.publishSharedDoc) window.publishSharedDoc({
        kind,
        doc: updated
      });
      setHit({
        doc: updated
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [token, kind, preview]);
  if (notFound) return React.createElement("div", {
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
  }, "Document not found"), React.createElement("p", {
    style: {
      color: "var(--cn-mute)"
    }
  }, "This link may have expired or been deleted.")));
  if (!hit) return React.createElement("div", {
    className: "cn-loading"
  }, React.createElement("div", {
    className: "cn-loading-text"
  }, "Loading\u2026"));
  var update = patch => {
    var list = shRead(kind);
    var next = list.map(d => d.id === hit.doc.id ? {
      ...d,
      ...patch,
      updatedAt: new Date().toISOString()
    } : d);
    shWrite(kind, next);
    var merged = next.find(d => d.id === hit.doc.id);
    if (window.publishSharedDoc) window.publishSharedDoc({
      kind,
      doc: merged
    });
    setHit({
      doc: merged
    });
  };
  if (kind === "loi") return React.createElement(window.ShLOIShareView, {
    doc: hit.doc,
    onUpdate: update
  });
  if (kind === "invoice") return React.createElement(window.ShInvoiceShareView, {
    doc: hit.doc,
    onUpdate: update
  });
  if (kind === "po") return React.createElement(window.ShPOShareView, {
    doc: hit.doc,
    onUpdate: update
  });
  return null;
}
Object.assign(window, {
  SalesHubScreen,
  ShShareRouter,
  ShShareModal,
  ShDocRow
});