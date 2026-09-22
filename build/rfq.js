var CAT_KEY = "cn-rfq-catalog-v1";
var RFQ_LOG_KEY = "cn-rfq-submissions-v1";
function _catRead() {
  try {
    return JSON.parse(localStorage.getItem(CAT_KEY) || "{}");
  } catch {
    return {};
  }
}
function _catWrite(obj) {
  try {
    localStorage.setItem(CAT_KEY, JSON.stringify(obj));
  } catch {}
}
function _catBucket(obj, name) {
  return obj[name] = obj[name] || {};
}
var _norm = s => (s || "").trim().toLowerCase();
var cnCatalog = {
  addCustomer({
    name,
    url
  }) {
    if (!_norm(name)) return;
    var o = _catRead();
    var b = _catBucket(o, "customers");
    var k = _norm(name);
    b[k] = {
      name: name.trim(),
      url: (url || b[k]?.url || "").trim()
    };
    _catWrite(o);
  },
  addContact({
    name,
    email,
    phone,
    customer
  }) {
    var key = _norm(email) || _norm(name);
    if (!key) return;
    var o = _catRead();
    var b = _catBucket(o, "contacts");
    b[key] = {
      name: (name || b[key]?.name || "").trim(),
      email: (email || b[key]?.email || "").trim(),
      phone: (phone || b[key]?.phone || "").trim(),
      customer: (customer || b[key]?.customer || "").trim()
    };
    _catWrite(o);
  },
  addProduct({
    name,
    mfr
  }) {
    if (!_norm(name)) return;
    var o = _catRead();
    var b = _catBucket(o, "products");
    var k = _norm(name);
    b[k] = {
      name: name.trim(),
      mfr: (mfr || b[k]?.mfr || "").trim()
    };
    _catWrite(o);
  },
  addRequestor({
    name,
    org,
    email,
    phone
  }) {
    var key = _norm(email) || _norm(name);
    if (!key) return;
    var o = _catRead();
    var b = _catBucket(o, "requestors");
    b[key] = {
      name: (name || b[key]?.name || "").trim(),
      org: (org || b[key]?.org || "").trim(),
      email: (email || b[key]?.email || "").trim(),
      phone: (phone || b[key]?.phone || "").trim()
    };
    _catWrite(o);
  },
  suggestions(scenario) {
    var o = _catRead();
    var customers = {},
      contacts = {},
      products = {},
      requestors = {};
    var accNameById = {};
    (scenario?.accounts || []).forEach(a => {
      accNameById[a.id] = a.name;
      var k = _norm(a.name);
      if (k) customers[k] = {
        name: a.name,
        url: a.website || ""
      };
    });
    (scenario?.contacts || []).forEach(c => {
      var k = _norm(c.email) || _norm(c.name);
      if (!k) return;
      contacts[k] = {
        name: c.name,
        email: c.email || "",
        phone: c.phone || "",
        customer: accNameById[c.accountId] || ""
      };
    });
    (scenario?.opps || []).forEach(op => {
      if (op.product) {
        var k = _norm(op.product);
        products[k] = {
          name: op.product,
          mfr: ""
        };
      }
    });
    Object.assign(customers, o.customers || {});
    Object.assign(contacts, o.contacts || {});
    Object.assign(products, o.products || {});
    Object.assign(requestors, o.requestors || {});
    var sort = m => Object.values(m).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return {
      customers: sort(customers),
      contacts: sort(contacts),
      products: sort(products),
      requestors: sort(requestors)
    };
  }
};
window.cnCatalog = cnCatalog;
var RFQ_REC_KEY = "cn-rfq-records-v1";
var RFQ_PING_ACK_KEY = "cn-rfq-ping-ack-v1";
function readRfqRecords() {
  try {
    return JSON.parse(localStorage.getItem(RFQ_REC_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeRfqRecords(list) {
  try {
    localStorage.setItem(RFQ_REC_KEY, JSON.stringify(list));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("cn-rfq-changed"));
  } catch {}
}
function upsertRfqRecord(rec) {
  var list = readRfqRecords();
  var idx = list.findIndex(r => r.id === rec.id);
  if (idx >= 0) list[idx] = rec;else list.unshift(rec);
  list.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  writeRfqRecords(list);
  if (window.cnRfqSync) {
    try {
      window.cnRfqSync.upsertRfqRemote(rec);
    } catch {}
  }
  return list;
}
async function refreshRfqRecords() {
  if (!window.cnRfqSync) return readRfqRecords();
  var remote = null;
  try {
    remote = await window.cnRfqSync.loadRfqsRemote();
  } catch {}
  if (!remote) return readRfqRecords();
  var byId = {};
  readRfqRecords().forEach(r => {
    byId[r.id] = r;
  });
  remote.forEach(r => {
    var cur = byId[r.id];
    if (!cur || (r.updatedAt || "") >= (cur.updatedAt || "")) byId[r.id] = r;
  });
  var merged = Object.values(byId).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  writeRfqRecords(merged);
  return merged;
}
function rfqTimeAgo(iso) {
  if (!iso) return "";
  var ms = Date.now() - new Date(iso).getTime();
  var m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  var h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  var d = Math.floor(h / 24);
  if (d < 30) return d + "d ago";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}
function readFileAsAttachment(file) {
  return new Promise((resolve, reject) => {
    var reader = new FileReader();
    reader.onload = () => {
      var base64 = String(reader.result || "").split(",")[1] || "";
      resolve({
        filename: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        content: base64
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
var fmtBytes = n => {
  if (!n && n !== 0) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
};
function CatalogInput({
  value,
  onChange,
  onPick,
  suggestions,
  placeholder,
  invalid,
  mono
}) {
  var [open, setOpen] = useState(false);
  var [hi, setHi] = useState(0);
  var rootRef = useRef(null);
  var q = _norm(value);
  var matches = (suggestions || []).filter(s => !q || _norm(s.label).includes(q) || _norm(s.sub).includes(q)).slice(0, 8);
  useEffect(() => {
    var onDoc = e => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  useEffect(() => {
    setHi(0);
  }, [value]);
  var choose = m => {
    onPick && onPick(m.record);
    setOpen(false);
  };
  var onKey = e => {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi(h => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(matches[hi]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };
  return React.createElement("div", {
    className: "cn-rfq-ac",
    ref: rootRef
  }, React.createElement("input", {
    className: `cn-input ${mono ? "cn-mono" : ""} ${invalid ? "cn-input--err" : ""}`,
    value: value || "",
    placeholder: placeholder,
    onChange: e => {
      onChange(e.target.value);
      setOpen(true);
    },
    onFocus: () => setOpen(true),
    onKeyDown: onKey,
    autoComplete: "off"
  }), open && matches.length > 0 && React.createElement("div", {
    className: "cn-rfq-ac-menu"
  }, matches.map((m, i) => React.createElement("div", {
    key: m.key,
    className: `cn-rfq-ac-item ${i === hi ? "is-hi" : ""}`,
    onMouseEnter: () => setHi(i),
    onMouseDown: e => {
      e.preventDefault();
      choose(m);
    }
  }, React.createElement("div", {
    className: "cn-rfq-ac-label"
  }, m.label), m.sub && React.createElement("div", {
    className: "cn-rfq-ac-sub"
  }, m.sub)))));
}
var CONDITIONS = ["New", "Refurbished", "Either"];
function blankItem() {
  return {
    product: "",
    mfr: "",
    qty: "",
    condition: "New",
    targetPrice: ""
  };
}
function RfqItems({
  items,
  setItems,
  productSuggestions
}) {
  var update = (i, patch) => setItems(items.map((it, idx) => idx === i ? {
    ...it,
    ...patch
  } : it));
  var remove = i => setItems(items.length === 1 ? [blankItem()] : items.filter((_, idx) => idx !== i));
  return React.createElement("div", {
    className: "cn-rfq-items"
  }, React.createElement("div", {
    className: "cn-rfq-items-head"
  }, React.createElement("span", {
    style: {
      flex: 1
    }
  }, "Product / part needed ", React.createElement("span", {
    className: "cn-rfq-req"
  }, "*")), React.createElement("span", {
    style: {
      width: 130
    }
  }, "Manufacturer ", React.createElement("span", {
    className: "cn-rfq-opt-tag"
  }, "opt")), React.createElement("span", {
    style: {
      width: 70
    }
  }, "Qty ", React.createElement("span", {
    className: "cn-rfq-opt-tag"
  }, "opt")), React.createElement("span", {
    style: {
      width: 124
    }
  }, "Condition ", React.createElement("span", {
    className: "cn-rfq-opt-tag"
  }, "opt")), React.createElement("span", {
    style: {
      width: 110
    }
  }, "Target price ", React.createElement("span", {
    className: "cn-rfq-opt-tag"
  }, "opt")), React.createElement("span", {
    style: {
      width: 28
    }
  })), items.map((it, i) => React.createElement("div", {
    key: i,
    className: "cn-rfq-item-row"
  }, React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement(CatalogInput, {
    value: it.product,
    onChange: v => update(i, {
      product: v
    }),
    onPick: r => update(i, {
      product: r.name,
      mfr: r.mfr || it.mfr
    }),
    suggestions: productSuggestions,
    placeholder: "e.g. NVIDIA H200 SXM"
  })), React.createElement("input", {
    className: "cn-input",
    style: {
      width: 130
    },
    value: it.mfr,
    onChange: e => update(i, {
      mfr: e.target.value
    }),
    placeholder: "NVIDIA"
  }), React.createElement("input", {
    className: "cn-input",
    style: {
      width: 70
    },
    value: it.qty,
    onChange: e => update(i, {
      qty: e.target.value
    }),
    placeholder: "0"
  }), React.createElement("select", {
    className: "cn-input",
    style: {
      width: 124
    },
    value: it.condition,
    onChange: e => update(i, {
      condition: e.target.value
    })
  }, CONDITIONS.map(c => React.createElement("option", {
    key: c,
    value: c
  }, c))), React.createElement("input", {
    className: "cn-input",
    style: {
      width: 110
    },
    value: it.targetPrice,
    onChange: e => update(i, {
      targetPrice: e.target.value
    }),
    placeholder: "optional"
  }), React.createElement("button", {
    type: "button",
    className: "cn-rfq-row-x",
    onClick: () => remove(i),
    title: "Remove line",
    "aria-label": "Remove line"
  }, "\u2715"))), React.createElement("button", {
    type: "button",
    className: "cn-btn cn-btn--ghost cn-rfq-additem",
    onClick: () => setItems([...items, blankItem()])
  }, "+ Add another product"));
}
function RFQForm({
  scenario,
  currentUser
}) {
  var sug = useMemo(() => cnCatalog.suggestions(scenario), [scenario]);
  var custOpts = sug.customers.map(c => ({
    key: _norm(c.name),
    label: c.name,
    sub: c.url,
    record: c
  }));
  var contactOpts = sug.contacts.map(c => ({
    key: _norm(c.email) || _norm(c.name),
    label: c.name,
    sub: [c.customer, c.email].filter(Boolean).join(" · "),
    record: c
  }));
  var productOpts = sug.products.map(p => ({
    key: _norm(p.name),
    label: p.name,
    sub: p.mfr,
    record: p
  }));
  var requestorOpts = sug.requestors.map(r => ({
    key: _norm(r.email) || _norm(r.name),
    label: r.name,
    sub: [r.org, r.email].filter(Boolean).join(" · "),
    record: r
  }));
  var blank = {
    customerName: "",
    companyUrl: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    requestorOrg: "Chief Negotiators",
    requestorName: currentUser?.fullName || currentUser?.name || "",
    requestorEmail: currentUser?.email || "",
    requestorPhone: "",
    items: [blankItem()],
    shipTo: "",
    neededBy: "",
    priority: "Standard",
    projectDetails: "",
    wantCall: false,
    callPhone: "",
    callWindow: ""
  };
  var [f, setF] = useState(blank);
  var [attachments, setAttachments] = useState([]);
  var [submitting, setSubmitting] = useState(false);
  var [errors, setErrors] = useState({});
  var [records, setRecords] = useState(() => readRfqRecords());
  var fileRef = useRef(null);
  useEffect(() => {
    var h = () => setRecords(readRfqRecords());
    window.addEventListener("cn-rfq-changed", h);
    return () => window.removeEventListener("cn-rfq-changed", h);
  }, []);
  var set = patch => setF(prev => ({
    ...prev,
    ...patch
  }));
  var validEmail = e => !e || (window.isValidEmailAddress ? window.isValidEmailAddress(e) : /.+@.+\..+/.test(e));
  var validate = () => {
    var er = {};
    if (!f.customerName.trim()) er.customerName = true;
    if (!f.contactName.trim()) er.contactName = true;
    if (!f.contactEmail.trim() || !validEmail(f.contactEmail)) er.contactEmail = true;
    if (!f.requestorName.trim()) er.requestorName = true;
    if (!f.requestorEmail.trim() || !validEmail(f.requestorEmail)) er.requestorEmail = true;
    if (!f.items.some(it => it.product.trim())) er.items = true;
    setErrors(er);
    return Object.keys(er).length === 0;
  };
  var onPickFiles = async fileList => {
    var files = Array.from(fileList || []);
    if (files.length === 0) return;
    var tooBig = files.find(fl => fl.size > 10 * 1024 * 1024);
    if (tooBig) {
      alert(`"${tooBig.name}" is over 10 MB. Please attach a smaller file or share a link in the project details.`);
      return;
    }
    var added = await Promise.all(files.map(readFileAsAttachment));
    setAttachments(prev => [...prev, ...added]);
  };
  var submit = async () => {
    if (submitting) return;
    if (!validate()) {
      window.cnToast && window.cnToast({
        kind: "error",
        title: "Missing required fields",
        sub: "Fill in the highlighted fields and try again."
      });
      return;
    }
    setSubmitting(true);
    var cleanItems = f.items.filter(it => it.product.trim());
    var rfq = {
      ...f,
      items: cleanItems,
      submittedAt: new Date().toISOString()
    };
    cnCatalog.addCustomer({
      name: f.customerName,
      url: f.companyUrl
    });
    cnCatalog.addContact({
      name: f.contactName,
      email: f.contactEmail,
      phone: f.contactPhone,
      customer: f.customerName
    });
    cnCatalog.addRequestor({
      name: f.requestorName,
      org: f.requestorOrg,
      email: f.requestorEmail,
      phone: f.requestorPhone
    });
    cleanItems.forEach(it => cnCatalog.addProduct({
      name: it.product,
      mfr: it.mfr
    }));
    var res = await window.sendRFQ(rfq, attachments);
    var record = {
      id: "rfq-" + Math.random().toString(36).slice(2, 9),
      status: "open",
      company: window.CN_BRAND && window.CN_BRAND.company || f.requestorOrg || "Chief Negotiators",
      customerName: f.customerName,
      companyUrl: f.companyUrl,
      contactName: f.contactName,
      contactEmail: f.contactEmail,
      contactPhone: f.contactPhone,
      requestorOrg: f.requestorOrg,
      requestorName: f.requestorName,
      requestorEmail: f.requestorEmail,
      requestorPhone: f.requestorPhone,
      items: cleanItems,
      itemsSummary: cleanItems.map(it => it.product + (it.qty ? ` ×${it.qty}` : "")).join(", "),
      itemCount: cleanItems.length,
      shipTo: f.shipTo,
      neededBy: f.neededBy,
      priority: f.priority,
      projectDetails: f.projectDetails,
      wantCall: f.wantCall,
      callPhone: f.callPhone,
      callWindow: f.callWindow,
      attachments: attachments.map(a => ({
        filename: a.filename,
        size: a.size
      })),
      emailDelivered: !!res.ok,
      submittedAt: rfq.submittedAt,
      updatedAt: new Date().toISOString(),
      response: null,
      completedAt: null
    };
    upsertRfqRecord(record);
    if (res.ok) {
      window.cnToast && window.cnToast({
        title: "Pricing request sent",
        sub: `Emailed to ${res.to || window.CN_RFQ_INBOX} · tracked in Requests`
      });
    } else {
      window.cnToast && window.cnToast({
        kind: "error",
        title: "Request logged — email pending",
        sub: "Tracked in Requests. Deploy the send-rfq function to enable live email."
      });
    }
    setF({
      ...blank,
      requestorOrg: f.requestorOrg,
      requestorName: f.requestorName,
      requestorEmail: f.requestorEmail,
      requestorPhone: f.requestorPhone
    });
    setAttachments([]);
    setErrors({});
    setSubmitting(false);
  };
  var itemCount = f.items.filter(it => it.product.trim()).length;
  var reqMark = React.createElement("span", {
    className: "cn-rfq-req"
  }, "*");
  return React.createElement("div", {
    className: "cn-rfq"
  }, React.createElement("div", {
    className: "cn-rfq-main"
  }, React.createElement("section", {
    className: "cn-card cn-rfq-sec"
  }, React.createElement("div", {
    className: "cn-rfq-sec-head"
  }, React.createElement("span", {
    className: "cn-rfq-sec-num"
  }, "1"), React.createElement("div", null, React.createElement("h3", {
    className: "cn-rfq-sec-title"
  }, "Customer"), React.createElement("p", {
    className: "cn-rfq-sec-sub"
  }, "Who needs the pricing. Start typing to pull from your catalog."))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.4
    }
  }, React.createElement("label", null, "Customer / company name ", reqMark), React.createElement(CatalogInput, {
    value: f.customerName,
    onChange: v => set({
      customerName: v
    }),
    onPick: r => set({
      customerName: r.name,
      companyUrl: r.url || f.companyUrl
    }),
    suggestions: custOpts,
    placeholder: "Acme Compute",
    invalid: errors.customerName
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Company URL"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: f.companyUrl,
    onChange: e => set({
      companyUrl: e.target.value
    }),
    placeholder: "acme.com"
  }))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Contact name ", reqMark), React.createElement(CatalogInput, {
    value: f.contactName,
    onChange: v => set({
      contactName: v
    }),
    onPick: r => set({
      contactName: r.name,
      contactEmail: r.email || f.contactEmail,
      contactPhone: r.phone || f.contactPhone,
      customerName: r.customer || f.customerName
    }),
    suggestions: contactOpts,
    placeholder: "Jordan Mills",
    invalid: errors.contactName
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Contact email ", reqMark), React.createElement("input", {
    className: `cn-input ${errors.contactEmail ? "cn-input--err" : ""}`,
    value: f.contactEmail,
    onChange: e => set({
      contactEmail: e.target.value
    }),
    placeholder: "jordan@acme.com"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Contact phone"), React.createElement("input", {
    className: "cn-input",
    value: f.contactPhone,
    onChange: e => set({
      contactPhone: e.target.value
    }),
    placeholder: "+1 555 000 0000"
  })))), React.createElement("section", {
    className: "cn-card cn-rfq-sec"
  }, React.createElement("div", {
    className: "cn-rfq-sec-head"
  }, React.createElement("span", {
    className: "cn-rfq-sec-num"
  }, "2"), React.createElement("div", null, React.createElement("h3", {
    className: "cn-rfq-sec-title"
  }, "Requestor"), React.createElement("p", {
    className: "cn-rfq-sec-sub"
  }, "Who's submitting this. Replies to the pricing come back to you."))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Submitting on behalf of ", reqMark), React.createElement("div", {
    className: "cn-rfq-seg"
  }, ["Chief Negotiators", "SSP"].map(org => React.createElement("button", {
    key: org,
    type: "button",
    className: `cn-rfq-seg-btn ${f.requestorOrg === org ? "is-active" : ""}`,
    onClick: () => set({
      requestorOrg: org
    })
  }, org)))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Requestor name ", reqMark), React.createElement(CatalogInput, {
    value: f.requestorName,
    onChange: v => set({
      requestorName: v
    }),
    onPick: r => set({
      requestorName: r.name,
      requestorEmail: r.email || f.requestorEmail,
      requestorPhone: r.phone || f.requestorPhone,
      requestorOrg: r.org || f.requestorOrg
    }),
    suggestions: requestorOpts,
    placeholder: "Your name",
    invalid: errors.requestorName
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Requestor email ", reqMark), React.createElement("input", {
    className: `cn-input ${errors.requestorEmail ? "cn-input--err" : ""}`,
    value: f.requestorEmail,
    onChange: e => set({
      requestorEmail: e.target.value
    }),
    placeholder: "you@thechiefnegotiators.com"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Requestor phone"), React.createElement("input", {
    className: "cn-input",
    value: f.requestorPhone,
    onChange: e => set({
      requestorPhone: e.target.value
    }),
    placeholder: "+1 555 000 0000"
  })))), React.createElement("section", {
    className: "cn-card cn-rfq-sec"
  }, React.createElement("div", {
    className: "cn-rfq-sec-head"
  }, React.createElement("span", {
    className: "cn-rfq-sec-num"
  }, "3"), React.createElement("div", null, React.createElement("h3", {
    className: "cn-rfq-sec-title"
  }, "Products needing pricing ", reqMark), React.createElement("p", {
    className: "cn-rfq-sec-sub"
  }, "Only the product name is required. Quantity, condition and target price are optional \u2014 leave them blank if you don't have them."))), errors.items && React.createElement("div", {
    className: "cn-rfq-inline-err"
  }, "Add at least one product."), React.createElement(RfqItems, {
    items: f.items,
    setItems: items => set({
      items
    }),
    productSuggestions: productOpts
  })), React.createElement("section", {
    className: "cn-card cn-rfq-sec"
  }, React.createElement("div", {
    className: "cn-rfq-sec-head"
  }, React.createElement("span", {
    className: "cn-rfq-sec-num"
  }, "4"), React.createElement("div", null, React.createElement("h3", {
    className: "cn-rfq-sec-title"
  }, "Project, logistics & call"), React.createElement("p", {
    className: "cn-rfq-sec-sub"
  }, "Context that sharpens the quote \u2014 timeline, destination, and how to reach you."))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Needed by"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: f.neededBy,
    onChange: e => set({
      neededBy: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Priority"), React.createElement("div", {
    className: "cn-rfq-seg"
  }, ["Standard", "Urgent"].map(p => React.createElement("button", {
    key: p,
    type: "button",
    className: `cn-rfq-seg-btn ${f.priority === p ? "is-active" : ""}`,
    onClick: () => set({
      priority: p
    })
  }, p)))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.4
    }
  }, React.createElement("label", null, "Ship-to location"), React.createElement("input", {
    className: "cn-input",
    value: f.shipTo,
    onChange: e => set({
      shipTo: e.target.value
    }),
    placeholder: "City, State / Country"
  }))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Project details"), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 120
    },
    value: f.projectDetails,
    onChange: e => set({
      projectDetails: e.target.value
    }),
    placeholder: "What's the project, where does this fit, any specs / part numbers, incumbent vendor, budget context, or constraints we should know about\u2026"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Attach documents ", React.createElement("span", {
    className: "cn-rfq-opt"
  }, "\xB7 BOM, spec sheet, existing quote \u2014 up to 10 MB each")), React.createElement("div", {
    className: "cn-rfq-drop",
    onClick: () => fileRef.current?.click(),
    onDragOver: e => {
      e.preventDefault();
      e.currentTarget.classList.add("is-over");
    },
    onDragLeave: e => e.currentTarget.classList.remove("is-over"),
    onDrop: e => {
      e.preventDefault();
      e.currentTarget.classList.remove("is-over");
      onPickFiles(e.dataTransfer.files);
    }
  }, React.createElement("span", {
    className: "cn-rfq-drop-icon"
  }, "\u21EA"), React.createElement("span", null, "Drag files here or ", React.createElement("span", {
    className: "cn-rfq-drop-link"
  }, "browse")), React.createElement("input", {
    ref: fileRef,
    type: "file",
    multiple: true,
    style: {
      display: "none"
    },
    onChange: e => {
      onPickFiles(e.target.files);
      e.target.value = "";
    }
  })), attachments.length > 0 && React.createElement("div", {
    className: "cn-rfq-files"
  }, attachments.map((a, i) => React.createElement("div", {
    key: i,
    className: "cn-rfq-file"
  }, React.createElement("span", {
    className: "cn-rfq-file-ico"
  }, "\uD83D\uDCCE"), React.createElement("span", {
    className: "cn-rfq-file-name"
  }, a.filename), React.createElement("span", {
    className: "cn-rfq-file-size"
  }, fmtBytes(a.size)), React.createElement("button", {
    type: "button",
    className: "cn-rfq-file-x",
    onClick: () => setAttachments(attachments.filter((_, idx) => idx !== i)),
    "aria-label": "Remove"
  }, "\u2715"))))), React.createElement("label", {
    className: "cn-rfq-callrow"
  }, React.createElement("input", {
    type: "checkbox",
    checked: f.wantCall,
    onChange: e => set({
      wantCall: e.target.checked
    })
  }), React.createElement("span", null, React.createElement("strong", null, "Request a call"), " to walk through this request")), f.wantCall && React.createElement("div", {
    className: "cn-field-row",
    style: {
      marginTop: 10
    }
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Best number"), React.createElement("input", {
    className: "cn-input",
    value: f.callPhone,
    onChange: e => set({
      callPhone: e.target.value
    }),
    placeholder: f.requestorPhone || f.contactPhone || "Phone for the call"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.4
    }
  }, React.createElement("label", null, "Best time window"), React.createElement("input", {
    className: "cn-input",
    value: f.callWindow,
    onChange: e => set({
      callWindow: e.target.value
    }),
    placeholder: "e.g. Weekdays 9\u201311am ET"
  }))))), React.createElement("aside", {
    className: "cn-rfq-rail"
  }, React.createElement("div", {
    className: "cn-card cn-rfq-summary"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Request for pricing"), React.createElement("h3", {
    className: "cn-rfq-summary-title"
  }, f.customerName || "New request"), React.createElement("div", {
    className: "cn-rfq-summary-rows"
  }, React.createElement("div", null, React.createElement("span", null, "Products"), React.createElement("strong", null, itemCount || "—")), React.createElement("div", null, React.createElement("span", null, "Priority"), React.createElement("strong", null, f.priority)), React.createElement("div", null, React.createElement("span", null, "Attachments"), React.createElement("strong", null, attachments.length || "—")), React.createElement("div", null, React.createElement("span", null, "Call"), React.createElement("strong", null, f.wantCall ? "Requested" : "No"))), React.createElement("div", {
    className: "cn-rfq-dest"
  }, React.createElement("span", {
    className: "cn-rfq-dest-ico"
  }, "\u2709"), React.createElement("div", null, "Emails directly to", React.createElement("br", null), React.createElement("span", {
    className: "cn-mono"
  }, window.CN_RFQ_INBOX || "rfq@thechiefnegotiators.com"))), React.createElement("button", {
    className: "cn-btn cn-btn--primary cn-rfq-submit",
    onClick: submit,
    disabled: submitting
  }, submitting ? React.createElement(Fragment, null, React.createElement("span", {
    className: "cn-spinner"
  }), " Sending\u2026") : "Send pricing request →"), React.createElement("p", {
    className: "cn-rfq-finehint"
  }, "Reply-to is set to your requestor email, so the quote comes straight back to you.")), records.length > 0 && React.createElement("div", {
    className: "cn-card cn-rfq-recent"
  }, React.createElement("div", {
    className: "cn-rfq-recent-head"
  }, "Recent requests ", React.createElement("span", null, records.length)), React.createElement("div", {
    className: "cn-rfq-recent-list"
  }, records.slice(0, 8).map(r => React.createElement("div", {
    key: r.id,
    className: "cn-rfq-recent-item"
  }, React.createElement("div", {
    className: "cn-rfq-recent-top"
  }, React.createElement("span", {
    className: "cn-rfq-recent-cust"
  }, r.customerName), React.createElement("span", {
    className: `cn-rfq-badge cn-rfq-badge--${r.status === "complete" ? "complete" : "open"}`
  }, r.status === "complete" ? "Complete" : "Open")), React.createElement("div", {
    className: "cn-rfq-recent-sub"
  }, r.itemsSummary || `${r.itemCount} item${r.itemCount === 1 ? "" : "s"}`), React.createElement("div", {
    className: "cn-rfq-recent-meta"
  }, r.requestorOrg, " \xB7 ", rfqTimeAgo(r.submittedAt))))))));
}
window.RFQForm = RFQForm;
function RFQRespondModal({
  record,
  currentUser,
  onClose,
  onCompleted
}) {
  var [lines, setLines] = useState(() => (record.items || []).map(it => ({
    product: it.product + (it.qty ? ` ×${it.qty}` : ""),
    price: "",
    leadTime: "",
    note: ""
  })));
  var [note, setNote] = useState("");
  var [busy, setBusy] = useState(false);
  var setLine = (i, patch) => setLines(lines.map((l, idx) => idx === i ? {
    ...l,
    ...patch
  } : l));
  var hasAnyPrice = lines.some(l => l.price.trim()) || note.trim();
  // Closing with nothing to say is a legitimate outcome — request withdrawn,
  // customer went elsewhere, can't quote it. Forcing a note just to clear the
  // row leaves stale RFQs open instead. No response email: there's nothing to
  // email.
  var closeOut = async () => {
    if (busy) return;
    setBusy(true);
    var now = new Date().toISOString();
    var updated = Object.assign({}, record, {
      status: "complete",
      closedWithoutResponse: true,
      response: note.trim() ? {
        lines: [], note: note.trim(),
        respondedBy: currentUser?.fullName || currentUser?.name || "",
        respondedAt: now
      } : null,
      completedAt: now,
      completedBy: currentUser?.fullName || currentUser?.name || "",
      updatedAt: now,
      pingPending: false,
      responseEmailSent: false
    });
    upsertRfqRecord(updated);
    setBusy(false);
    window.cnToast && window.cnToast({ title: "Closed", sub: "No response sent — nothing was emailed to the requestor." });
    onCompleted && onCompleted(updated);
    onClose && onClose();
  };
  var submit = async () => {
    if (busy) return;
    if (!hasAnyPrice) {
      window.cnToast && window.cnToast({
        kind: "error",
        title: "Nothing to send",
        sub: "Add at least one price or a feedback note."
      });
      return;
    }
    setBusy(true);
    var respondedAt = new Date().toISOString();
    var response = {
      lines: lines.map(l => ({
        product: l.product,
        price: l.price.trim(),
        leadTime: l.leadTime.trim(),
        note: l.note.trim()
      })),
      note: note.trim(),
      respondedBy: currentUser?.fullName || currentUser?.name || "",
      respondedAt
    };
    var updated = {
      ...record,
      status: "complete",
      response,
      completedAt: respondedAt,
      completedBy: currentUser?.fullName || currentUser?.name || "",
      updatedAt: respondedAt,
      pingPending: true
    };
    var emailRes = await window.sendRfqResponse(updated);
    updated.responseEmailSent = !!emailRes.ok;
    upsertRfqRecord(updated);
    if (window.cnRfqPing) {
      try {
        window.cnRfqPing({
          rfqId: updated.id,
          to: updated.requestorEmail,
          customerName: updated.customerName,
          completedBy: updated.completedBy
        });
      } catch {}
    }
    if (emailRes.ok) {
      window.cnToast && window.cnToast({
        title: "Marked complete",
        sub: `Response emailed to ${updated.requestorEmail} (you're CC'd) · requestor pinged`
      });
    } else {
      window.cnToast && window.cnToast({
        kind: "error",
        title: "Marked complete — email pending",
        sub: "Requestor pinged in-app. Deploy send-rfq-response to enable email."
      });
    }
    setBusy(false);
    onCompleted && onCompleted(updated);
    onClose && onClose();
  };
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onMouseDown: e => {
      if (e.target === e.currentTarget) onClose();
    }
  }, React.createElement("div", {
    className: "cn-modal cn-rfq-modal",
    role: "dialog",
    "aria-modal": "true"
  }, React.createElement("div", {
    className: "cn-rfq-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Respond to request"), React.createElement("h2", {
    className: "cn-rfq-modal-title"
  }, record.customerName), React.createElement("div", {
    className: "cn-rfq-modal-sub"
  }, "From ", record.requestorName, " (", record.requestorOrg, ") \xB7 ", rfqTimeAgo(record.submittedAt), record.priority === "Urgent" && React.createElement("span", {
    className: "cn-rfq-urgent"
  }, " \xB7 Urgent"))), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose,
    "aria-label": "Close"
  }, "\u2715")), React.createElement("div", {
    className: "cn-rfq-modal-body"
  }, React.createElement("div", {
    className: "cn-rfq-recap"
  }, React.createElement("div", {
    className: "cn-rfq-recap-grid"
  }, React.createElement("div", null, React.createElement("span", null, "Contact"), React.createElement("strong", null, record.contactName || "—")), React.createElement("div", null, React.createElement("span", null, "Contact email"), React.createElement("strong", null, record.contactEmail || "—")), React.createElement("div", null, React.createElement("span", null, "Needed by"), React.createElement("strong", null, record.neededBy || "—")), React.createElement("div", null, React.createElement("span", null, "Ship-to"), React.createElement("strong", null, record.shipTo || "—"))), record.projectDetails && React.createElement("div", {
    className: "cn-rfq-recap-notes"
  }, React.createElement("span", null, "Project details"), React.createElement("p", null, record.projectDetails)), record.wantCall && React.createElement("div", {
    className: "cn-rfq-recap-call"
  }, "\u260E Call requested \u2014 ", record.callPhone || record.requestorPhone || record.contactPhone || "no number", record.callWindow ? ` · ${record.callWindow}` : ""), record.attachments && record.attachments.length > 0 && React.createElement("div", {
    className: "cn-rfq-recap-files"
  }, record.attachments.map((a, i) => React.createElement("span", {
    key: i,
    className: "cn-rfq-recap-file"
  }, "\uD83D\uDCCE ", a.filename)))), React.createElement("div", {
    className: "cn-rfq-resp-label"
  }, "Pricing"), React.createElement("div", {
    className: "cn-rfq-resp-lines"
  }, lines.map((l, i) => React.createElement("div", {
    key: i,
    className: "cn-rfq-resp-line"
  }, React.createElement("div", {
    className: "cn-rfq-resp-prod"
  }, l.product), React.createElement("div", {
    className: "cn-rfq-resp-fields"
  }, React.createElement("input", {
    className: "cn-input",
    value: l.price,
    onChange: e => setLine(i, {
      price: e.target.value
    }),
    placeholder: "Price (e.g. $24,500)"
  }), React.createElement("input", {
    className: "cn-input",
    value: l.leadTime,
    onChange: e => setLine(i, {
      leadTime: e.target.value
    }),
    placeholder: "Lead time (e.g. 6 wks)"
  }), React.createElement("input", {
    className: "cn-input",
    value: l.note,
    onChange: e => setLine(i, {
      note: e.target.value
    }),
    placeholder: "Note (optional)"
  }))))), React.createElement("div", {
    className: "cn-field",
    style: {
      marginTop: 16
    }
  }, React.createElement("label", null, "Overall feedback to the requestor", React.createElement("span", {
    style: { textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "var(--cn-mute)" }
  }, " — optional")), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 110
    },
    value: note,
    onChange: e => setNote(e.target.value),
    placeholder: "Terms, alternatives, allocation notes, or anything the requestor should know. This goes in the email to them."
  }))), React.createElement("div", {
    className: "cn-rfq-modal-foot"
  }, React.createElement("div", {
    className: "cn-rfq-modal-foot-note"
  }, hasAnyPrice ? React.createElement(Fragment, null, "Emails ", record.requestorEmail || "the requestor", " \xB7 CC ", window.CN_RFQ_INBOX) : "Nothing to send yet — you can still close this out without a response."), React.createElement("div", {
    className: "cn-rfq-modal-foot-btns"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: closeOut,
    disabled: busy,
    title: "Mark complete without emailing a response"
  }, "Close, no response"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: submit,
    disabled: busy || !hasAnyPrice
  }, busy ? React.createElement(Fragment, null, React.createElement("span", {
    className: "cn-spinner"
  }), " Sending\u2026") : "Submit feedback & mark complete")))));
}
function RFQResponseView({
  record
}) {
  var r = record.response || {};
  // Closed with no pricing: say so plainly rather than render an empty table
  // that looks like data failed to load.
  if (record.closedWithoutResponse && !(r.lines || []).length) {
    return React.createElement("div", {
      className: "cn-rfq-respview"
    }, React.createElement("div", {
      className: "cn-rfq-respview-note"
    }, React.createElement("span", null, "Closed without a response"),
      React.createElement("p", null, r.note ? r.note : "No pricing was sent and the requestor was not emailed.")),
      React.createElement("div", {
        className: "cn-rfq-respview-meta"
      }, "Closed by ", record.completedBy || "\u2014", " \xB7 ", rfqTimeAgo(record.completedAt)));
  }
  return React.createElement("div", {
    className: "cn-rfq-respview"
  }, (r.lines || []).some(l => l.price || l.leadTime || l.note) && React.createElement("table", {
    className: "cn-rfq-respview-tbl"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Product"), React.createElement("th", null, "Price"), React.createElement("th", null, "Lead time"), React.createElement("th", null, "Note"))), React.createElement("tbody", null, r.lines.map((l, i) => React.createElement("tr", {
    key: i
  }, React.createElement("td", null, l.product), React.createElement("td", {
    className: "cn-mono"
  }, l.price || "—"), React.createElement("td", null, l.leadTime || "—"), React.createElement("td", null, l.note || ""))))), r.note && React.createElement("div", {
    className: "cn-rfq-respview-note"
  }, React.createElement("span", null, "Feedback"), React.createElement("p", null, r.note)), React.createElement("div", {
    className: "cn-rfq-respview-meta"
  }, "Completed by ", record.completedBy || r.respondedBy || "—", " \xB7 ", rfqTimeAgo(record.completedAt), record.responseEmailSent ? " · emailed to requestor (you CC'd)" : " · email pending"));
}
function RFQInbox({
  currentUser,
  focusId
}) {
  var [records, setRecords] = useState(() => readRfqRecords());
  var [filter, setFilter] = useState("open");
  var [openId, setOpenId] = useState(null);
  var [responding, setResponding] = useState(null);
  useEffect(() => {
    var h = () => setRecords(readRfqRecords());
    window.addEventListener("cn-rfq-changed", h);
    refreshRfqRecords().then(list => list && setRecords(list));
    return () => window.removeEventListener("cn-rfq-changed", h);
  }, []);
  useEffect(() => {
    if (!focusId) return;
    var rec = readRfqRecords().find(r => r.id === focusId);
    if (rec) {
      setFilter(rec.status === "complete" ? "complete" : "open");
      setOpenId(focusId);
    }
  }, [focusId]);
  var counts = useMemo(() => ({
    open: records.filter(r => r.status !== "complete").length,
    complete: records.filter(r => r.status === "complete").length,
    all: records.length
  }), [records]);
  var shown = records.filter(r => filter === "all" ? true : filter === "open" ? r.status !== "complete" : r.status === "complete");
  return React.createElement("div", {
    className: "cn-rfq-inbox"
  }, React.createElement("div", {
    className: "cn-rfq-inbox-filters"
  }, [["open", "Open", counts.open], ["complete", "Complete", counts.complete], ["all", "All", counts.all]].map(([k, label, n]) => React.createElement("button", {
    key: k,
    className: `cn-rfq-filter ${filter === k ? "is-active" : ""}`,
    onClick: () => setFilter(k)
  }, label, " ", React.createElement("span", null, n)))), shown.length === 0 ? React.createElement("div", {
    className: "cn-empty cn-rfq-empty"
  }, React.createElement("div", {
    className: "cn-empty-ico"
  }, "\u229E"), React.createElement("div", {
    className: "cn-empty-title"
  }, filter === "complete" ? "No completed requests yet" : "No open requests"), React.createElement("div", {
    className: "cn-empty-sub"
  }, filter === "open" ? "New pricing requests will land here." : "Switch filters to see other requests.")) : React.createElement("div", {
    className: "cn-rfq-table"
  }, React.createElement("div", {
    className: "cn-rfq-table-head"
  }, React.createElement("span", {
    style: {
      flex: 1.4
    }
  }, "Customer"), React.createElement("span", {
    style: {
      flex: 1.6
    }
  }, "Products"), React.createElement("span", {
    style: {
      width: 150
    }
  }, "Requestor"), React.createElement("span", {
    style: {
      width: 90
    }
  }, "Submitted"), React.createElement("span", {
    style: {
      width: 110
    }
  }, "Status"), React.createElement("span", {
    style: {
      width: 130
    }
  })), shown.map(r => {
    var isOpen = openId === r.id;
    return React.createElement("div", {
      key: r.id,
      className: `cn-rfq-trow-wrap ${isOpen ? "is-open" : ""}`
    }, React.createElement("div", {
      className: "cn-rfq-trow",
      onClick: () => setOpenId(isOpen ? null : r.id)
    }, React.createElement("span", {
      style: {
        flex: 1.4
      },
      className: "cn-rfq-tc-cust"
    }, r.priority === "Urgent" && r.status !== "complete" && React.createElement("span", {
      className: "cn-rfq-dot",
      title: "Urgent"
    }), r.customerName), React.createElement("span", {
      style: {
        flex: 1.6
      },
      className: "cn-rfq-tc-prod"
    }, r.itemsSummary || `${r.itemCount || (r.items || []).length} items`), React.createElement("span", {
      style: {
        width: 150
      },
      className: "cn-rfq-tc-req"
    }, r.requestorName, React.createElement("small", null, r.requestorOrg)), React.createElement("span", {
      style: {
        width: 90
      },
      className: "cn-rfq-tc-when"
    }, rfqTimeAgo(r.submittedAt)), React.createElement("span", {
      style: {
        width: 110
      }
    }, React.createElement("span", {
      className: `cn-rfq-badge cn-rfq-badge--${r.status === "complete" ? "complete" : "open"}`
    }, r.status === "complete" ? "Complete" : "Open")), React.createElement("span", {
      style: {
        width: 130
      },
      className: "cn-rfq-tc-act"
    }, r.status === "complete" ? React.createElement("button", {
      className: "cn-btn cn-btn--ghost cn-btn--sm",
      onClick: e => {
        e.stopPropagation();
        setOpenId(isOpen ? null : r.id);
      }
    }, isOpen ? "Hide" : "View") : React.createElement("button", {
      className: "cn-btn cn-btn--primary cn-btn--sm",
      onClick: e => {
        e.stopPropagation();
        setResponding(r);
      }
    }, "Add pricing"))), isOpen && React.createElement("div", {
      className: "cn-rfq-tdetail"
    }, React.createElement("div", {
      className: "cn-rfq-tdetail-grid"
    }, React.createElement("div", null, React.createElement("span", null, "Contact"), React.createElement("strong", null, r.contactName || "—")), React.createElement("div", null, React.createElement("span", null, "Email"), React.createElement("strong", null, r.contactEmail || "—")), React.createElement("div", null, React.createElement("span", null, "Phone"), React.createElement("strong", null, r.contactPhone || "—")), React.createElement("div", null, React.createElement("span", null, "Company"), React.createElement("strong", null, r.companyUrl || "—")), React.createElement("div", null, React.createElement("span", null, "Needed by"), React.createElement("strong", null, r.neededBy || "—")), React.createElement("div", null, React.createElement("span", null, "Ship-to"), React.createElement("strong", null, r.shipTo || "—")), React.createElement("div", null, React.createElement("span", null, "Priority"), React.createElement("strong", null, r.priority || "Standard")), React.createElement("div", null, React.createElement("span", null, "Call"), React.createElement("strong", null, r.wantCall ? `Yes — ${r.callWindow || "any time"}` : "No"))), (r.items || []).length > 0 && React.createElement("div", {
      className: "cn-rfq-tdetail-items"
    }, r.items.map((it, i) => React.createElement("div", {
      key: i,
      className: "cn-rfq-tdetail-item"
    }, React.createElement("strong", null, it.product), React.createElement("span", null, [it.mfr, it.qty ? `Qty ${it.qty}` : "", it.condition, it.targetPrice ? `Target ${it.targetPrice}` : ""].filter(Boolean).join(" · ") || "—")))), r.projectDetails && React.createElement("div", {
      className: "cn-rfq-tdetail-notes"
    }, React.createElement("span", null, "Project details"), React.createElement("p", null, r.projectDetails)), r.attachments && r.attachments.length > 0 && React.createElement("div", {
      className: "cn-rfq-recap-files"
    }, r.attachments.map((a, i) => React.createElement("span", {
      key: i,
      className: "cn-rfq-recap-file"
    }, "\uD83D\uDCCE ", a.filename))), r.status === "complete" ? React.createElement(RFQResponseView, {
      record: r
    }) : React.createElement("button", {
      className: "cn-btn cn-btn--primary cn-rfq-tdetail-cta",
      onClick: () => setResponding(r)
    }, "Add pricing & respond \u2192")));
  })), responding && React.createElement(RFQRespondModal, {
    record: responding,
    currentUser: currentUser,
    onClose: () => setResponding(null),
    onCompleted: () => {
      setRecords(readRfqRecords());
      setOpenId(responding.id);
    }
  }));
}
function RFQScreen({
  scenario,
  currentUser,
  initialTab,
  focusId
}) {
  var [tab, setTab] = useState(initialTab === "inbox" ? "inbox" : "new");
  var [openCount, setOpenCount] = useState(() => readRfqRecords().filter(r => r.status !== "complete").length);
  useEffect(() => {
    var h = () => setOpenCount(readRfqRecords().filter(r => r.status !== "complete").length);
    window.addEventListener("cn-rfq-changed", h);
    return () => window.removeEventListener("cn-rfq-changed", h);
  }, []);
  useEffect(() => {
    if (initialTab === "inbox") setTab("inbox");
  }, [initialTab, focusId]);
  return React.createElement("div", {
    className: "cn-rfq-screen"
  }, React.createElement("div", {
    className: "cn-rfq-tabs"
  }, React.createElement("button", {
    className: `cn-rfq-tab ${tab === "new" ? "is-active" : ""}`,
    onClick: () => setTab("new")
  }, "New request"), React.createElement("button", {
    className: `cn-rfq-tab ${tab === "inbox" ? "is-active" : ""}`,
    onClick: () => setTab("inbox")
  }, "Requests ", openCount > 0 && React.createElement("span", {
    className: "cn-rfq-tab-badge"
  }, openCount))), tab === "new" ? React.createElement(RFQForm, {
    scenario: scenario,
    currentUser: currentUser
  }) : React.createElement(RFQInbox, {
    currentUser: currentUser,
    focusId: focusId
  }));
}
window.RFQScreen = RFQScreen;
function readPingAcks() {
  try {
    return JSON.parse(localStorage.getItem(RFQ_PING_ACK_KEY) || "[]");
  } catch {
    return [];
  }
}
function ackPing(id) {
  var a = readPingAcks();
  if (!a.includes(id)) {
    a.push(id);
    try {
      localStorage.setItem(RFQ_PING_ACK_KEY, JSON.stringify(a));
    } catch {}
  }
  try {
    window.dispatchEvent(new CustomEvent("cn-rfq-changed"));
  } catch {}
}
window.cnRfqPing = function () {
  try {
    window.dispatchEvent(new CustomEvent("cn-rfq-changed"));
  } catch {}
};
function RFQPingHost({
  currentUser,
  onView
}) {
  var [records, setRecords] = useState(() => readRfqRecords());
  var [acks, setAcks] = useState(() => readPingAcks());
  useEffect(() => {
    var h = () => {
      setRecords(readRfqRecords());
      setAcks(readPingAcks());
    };
    window.addEventListener("cn-rfq-changed", h);
    refreshRfqRecords().then(list => list && setRecords(list));
    return () => window.removeEventListener("cn-rfq-changed", h);
  }, []);
  var myEmail = _norm(currentUser?.email);
  if (!myEmail) return null;
  var pending = records.filter(r => r.status === "complete" && _norm(r.requestorEmail) === myEmail && !acks.includes(r.id));
  if (pending.length === 0) return null;
  return React.createElement("div", {
    className: "cn-rfq-pings"
  }, pending.slice(0, 3).map(r => React.createElement("div", {
    key: r.id,
    className: "cn-rfq-ping"
  }, React.createElement("div", {
    className: "cn-rfq-ping-ico"
  }, "\u2713"), React.createElement("div", {
    className: "cn-rfq-ping-body"
  }, React.createElement("strong", null, "Pricing ready \u2014 ", r.customerName), React.createElement("span", null, r.completedBy ? r.completedBy + " " : "", "completed your request. View the pricing & feedback.")), React.createElement("div", {
    className: "cn-rfq-ping-acts"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary cn-btn--sm",
    onClick: () => {
      ackPing(r.id);
      onView && onView(r.id);
    }
  }, "View feedback"), React.createElement("button", {
    className: "cn-rfq-ping-x",
    onClick: () => ackPing(r.id),
    "aria-label": "Dismiss"
  }, "\u2715")))));
}
window.RFQPingHost = RFQPingHost;