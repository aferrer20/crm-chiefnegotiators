function FinArEditor({
  rec,
  scenario,
  onClose,
  onSave,
  onDelete
}) {
  var today = finISO(finToday());
  var [d, setD] = useState(rec || {
    id: FIN_ID("com"),
    type: "commission",
    recordNumber: "COM-2026-" + String(Math.floor(Math.random() * 900) + 100),
    vendor: "",
    buyer: "",
    dealValue: "",
    rate: 5,
    amount: "",
    billToName: "",
    saleAmount: "",
    taxRate: 7,
    shippingFee: 0,
    issueDate: today,
    dueDate: finAddDays(today, 30),
    status: "expected",
    paidAt: null,
    notes: ""
  });
  var up = patch => setD({
    ...d,
    ...patch
  });
  var isComm = d.type === "commission";
  var autoAmt = Math.round((parseFloat(d.dealValue) || 0) * (parseFloat(d.rate) || 0) / 100);
  var effAmt = d.amount !== "" && d.amount != null ? parseFloat(d.amount) || 0 : autoAmt;
  var setType = type => up({
    type,
    status: type === "commission" ? "expected" : "sent"
  });
  var buildResale = () => ({
    id: d.id,
    type: "resale",
    docNumber: d.recordNumber?.startsWith("INV") ? d.recordNumber : "INV-2026-" + String(Math.floor(Math.random() * 900) + 100),
    billToName: d.billToName,
    issueDate: d.issueDate,
    dueDate: d.dueDate,
    lineItems: [{
      id: FIN_ID("li"),
      description: d.notes || "Resale",
      qty: 1,
      unitPrice: parseFloat(d.saleAmount) || 0
    }],
    taxRate: parseFloat(d.taxRate) || 0,
    shippingFee: parseFloat(d.shippingFee) || 0,
    discount: 0,
    status: d.status === "expected" ? "sent" : d.status,
    paidAt: d.status === "paid" ? d.paidAt || new Date().toISOString() : null,
    notes: d.notes,
    _sample: d._sample,
    createdAt: d.createdAt
  });
  var buildComm = () => ({
    id: d.id,
    type: "commission",
    recordNumber: d.recordNumber,
    vendor: d.vendor,
    buyer: d.buyer,
    accountId: d.accountId || null,
    dealValue: parseFloat(d.dealValue) || 0,
    rate: parseFloat(d.rate) || 0,
    amount: effAmt,
    issueDate: d.issueDate,
    dueDate: d.status === "expected" ? null : d.dueDate,
    status: d.status,
    paidAt: d.status === "paid" ? d.paidAt || new Date().toISOString() : null,
    notes: d.notes,
    _sample: d._sample,
    createdAt: d.createdAt
  });
  var valid = isComm ? d.vendor.trim() && effAmt > 0 : d.billToName.trim() && (parseFloat(d.saleAmount) || 0) > 0;
  var commStatuses = [["expected", "Expected"], ["invoiced", "Invoiced"], ["paid", "Paid"]];
  var resaleStatuses = [["sent", "Open / sent"], ["paid", "Paid"]];
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
      width: 560
    }
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, rec ? "Edit receivable" : "New receivable"), React.createElement("h2", {
    className: "cn-modal-title"
  }, isComm ? d.vendor || "Commission" : d.billToName || "Resale invoice")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, !rec && React.createElement("div", {
    className: "cn-segmented",
    style: {
      marginBottom: 16
    }
  }, React.createElement("button", {
    className: isComm ? "is-active" : "",
    onClick: () => setType("commission")
  }, "Vendor commission"), React.createElement("button", {
    className: !isComm ? "is-active" : "",
    onClick: () => setType("resale")
  }, "Resale invoice")), isComm ? React.createElement(Fragment, null, React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Vendor ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 who pays the kickback")), React.createElement("input", {
    className: "cn-input",
    value: d.vendor,
    onChange: e => up({
      vendor: e.target.value
    }),
    placeholder: "Dell, Cisco, HPE\u2026",
    autoFocus: true
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Buyer connected"), React.createElement("input", {
    className: "cn-input",
    value: d.buyer,
    onChange: e => up({
      buyer: e.target.value
    }),
    placeholder: "Customer name",
    list: "fin-acct-list"
  }), React.createElement("datalist", {
    id: "fin-acct-list"
  }, (scenario?.accounts || []).map(a => React.createElement("option", {
    key: a.id,
    value: a.name
  }))))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Deal value"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    value: d.dealValue,
    onChange: e => up({
      dealValue: e.target.value,
      amount: ""
    }),
    placeholder: "0"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 0.7
    }
  }, React.createElement("label", null, "Rate %"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    step: "0.1",
    value: d.rate,
    onChange: e => up({
      rate: e.target.value,
      amount: ""
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Commission"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    value: d.amount !== "" && d.amount != null ? d.amount : autoAmt,
    onChange: e => up({
      amount: e.target.value
    })
  }), React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--cn-mute)",
      marginTop: 3
    }
  }, "auto = value \xD7 rate. Override for a flat fee.")))) : React.createElement(Fragment, null, React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.4
    }
  }, React.createElement("label", null, "Customer"), React.createElement("input", {
    className: "cn-input",
    value: d.billToName,
    onChange: e => up({
      billToName: e.target.value
    }),
    placeholder: "Customer name",
    autoFocus: true,
    list: "fin-acct-list"
  }), React.createElement("datalist", {
    id: "fin-acct-list"
  }, (scenario?.accounts || []).map(a => React.createElement("option", {
    key: a.id,
    value: a.name
  })))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Sale amount"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    value: d.saleAmount,
    onChange: e => up({
      saleAmount: e.target.value
    }),
    placeholder: "0"
  }))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Sales tax %"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    step: "0.1",
    value: d.taxRate,
    onChange: e => up({
      taxRate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Shipping"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    value: d.shippingFee,
    onChange: e => up({
      shippingFee: e.target.value
    })
  })))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, isComm ? "Deal / close date" : "Issue date"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: d.issueDate,
    onChange: e => up({
      issueDate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Due date"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: d.dueDate || "",
    disabled: isComm && d.status === "expected",
    onChange: e => up({
      dueDate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Status"), React.createElement("select", {
    className: "cn-input",
    value: d.status,
    onChange: e => up({
      status: e.target.value
    })
  }, (isComm ? commStatuses : resaleStatuses).map(([v, l]) => React.createElement("option", {
    key: v,
    value: v
  }, l))))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Notes ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 optional")), React.createElement("input", {
    className: "cn-input",
    value: d.notes,
    onChange: e => up({
      notes: e.target.value
    }),
    placeholder: isComm ? "Deal context…" : "What was sold…"
  }))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, rec ? React.createElement("button", {
    className: "cn-btn cn-btn--danger",
    onClick: () => onDelete(d.id)
  }, "Delete") : React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Cancel"), React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => onSave(isComm ? buildComm() : buildResale()),
    disabled: !valid
  }, rec ? "Save" : "Add receivable")))));
}
function FinancePayables({
  bills,
  refresh
}) {
  var [filter, setFilter] = useState("open");
  var [q, setQ] = useState("");
  var [editing, setEditing] = useState(null);
  var rows = useMemo(() => bills.map(b => ({
    raw: b,
    c: finBillCompute(b)
  })), [bills]);
  var counts = {
    open: rows.filter(x => !x.c.isPaid).length,
    overdue: rows.filter(x => x.c.isOverdue).length,
    paid: rows.filter(x => x.c.isPaid).length,
    all: rows.length
  };
  var filtered = rows.filter(x => {
    if (filter === "open" && x.c.isPaid) return false;
    if (filter === "overdue" && !x.c.isOverdue) return false;
    if (filter === "paid" && !x.c.isPaid) return false;
    if (q) {
      var s = q.toLowerCase();
      if (!((x.raw.vendor || "").toLowerCase().includes(s) || (x.raw.billNumber || "").toLowerCase().includes(s) || (x.raw.category || "").toLowerCase().includes(s))) return false;
    }
    return true;
  }).sort((x, y) => filter === "open" || filter === "overdue" ? (x.c.daysToDue ?? 999) - (y.c.daysToDue ?? 999) : new Date(y.raw.issueDate) - new Date(x.raw.issueDate));
  var outstanding = rows.filter(x => !x.c.isPaid).reduce((s, x) => s + x.c.balance, 0);
  var overdueAmt = rows.filter(x => x.c.isOverdue).reduce((s, x) => s + x.c.balance, 0);
  var dueSoon = rows.filter(x => !x.c.isPaid && x.c.daysToDue != null && x.c.daysToDue >= 0 && x.c.daysToDue <= 7).reduce((s, x) => s + x.c.balance, 0);
  var paidTotal = rows.filter(x => x.c.isPaid).reduce((s, x) => s + x.c.amount, 0);
  var save = bill => {
    var list = finRead("bills");
    var i = list.findIndex(b => b.id === bill.id);
    if (i >= 0) list[i] = bill;else list.unshift(bill);
    finWrite("bills", list);
    setEditing(null);
    refresh();
  };
  var del = id => {
    if (!confirm("Delete this bill?")) return;
    finWrite("bills", finRead("bills").filter(b => b.id !== id));
    setEditing(null);
    refresh();
  };
  var togglePaid = x => {
    finWrite("bills", finRead("bills").map(b => b.id === x.raw.id ? {
      ...b,
      status: x.c.isPaid ? "unpaid" : "paid",
      paidAt: x.c.isPaid ? null : new Date().toISOString()
    } : b));
    refresh();
  };
  var byVendor = {};
  rows.filter(x => !x.c.isPaid).forEach(x => {
    byVendor[x.raw.vendor] = (byVendor[x.raw.vendor] || 0) + x.c.balance;
  });
  var vendorList = Object.entries(byVendor).sort((a, b) => b[1] - a[1]).slice(0, 5);
  var vendorMax = Math.max(1, ...vendorList.map(v => v[1]));
  return React.createElement("div", {
    className: "cn-fin-view"
  }, React.createElement("section", {
    className: "cn-fin-strip"
  }, React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Outstanding"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(outstanding)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, counts.open, " open bills")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Due \u2264 7 days"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: dueSoon > 0 ? "var(--cn-warn)" : "inherit"
    }
  }, finFmt0(dueSoon)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "plan the cash")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Overdue"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: overdueAmt > 0 ? "var(--cn-neg)" : "inherit"
    }
  }, finFmt0(overdueAmt)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, counts.overdue, " past due")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Paid to date"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: "var(--cn-pos)"
    }
  }, finFmt0(paidTotal)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, counts.paid, " settled"))), vendorList.length > 0 && React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Open balance by vendor"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Who we owe"))), React.createElement("div", {
    className: "cn-fin-aging"
  }, vendorList.map(([v, amt]) => React.createElement("div", {
    key: v,
    className: "cn-fin-aging-row"
  }, React.createElement("span", {
    className: "cn-fin-aging-label",
    style: {
      width: 170
    }
  }, v), React.createElement("span", {
    className: "cn-fin-aging-track"
  }, React.createElement("span", {
    className: "cn-fin-aging-fill is-ap",
    style: {
      width: `${amt / vendorMax * 100}%`
    }
  })), React.createElement("span", {
    className: "cn-fin-aging-amt cn-mono"
  }, finFmt0(amt)))))), React.createElement("div", {
    className: "cn-toolbar",
    style: {
      marginTop: 4
    }
  }, React.createElement("div", {
    className: "cn-tabs"
  }, [["open", "Open"], ["overdue", "Overdue"], ["paid", "Paid"], ["all", "All"]].map(([id, label]) => React.createElement("button", {
    key: id,
    className: `cn-tab ${filter === id ? "is-active" : ""}`,
    onClick: () => setFilter(id)
  }, label, " ", React.createElement("span", {
    className: "cn-fin-tabcount"
  }, counts[id])))), React.createElement("div", {
    className: "cn-toolbar-right"
  }, React.createElement("input", {
    className: "cn-input",
    placeholder: "Search vendor / bill\u2026",
    value: q,
    onChange: e => setQ(e.target.value),
    style: {
      width: 220
    }
  }), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setEditing("new")
  }, "+ New bill"))), React.createElement("section", {
    className: "cn-card cn-card--flush"
  }, filtered.length === 0 ? React.createElement("div", {
    className: "cn-fin-empty",
    style: {
      padding: 40
    }
  }, "No bills here. Log a vendor bill \u2014 resale hardware you purchased, or an operating cost.") : React.createElement("table", {
    className: "cn-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Vendor"), React.createElement("th", null, "Bill #"), React.createElement("th", null, "Category"), React.createElement("th", null, "Issued"), React.createElement("th", null, "Due"), React.createElement("th", null, "Status"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Amount"), React.createElement("th", null))), React.createElement("tbody", null, filtered.map(x => React.createElement("tr", {
    key: x.raw.id,
    className: "cn-tr-link",
    onClick: () => setEditing(x.raw)
  }, React.createElement("td", {
    className: "cn-cell-primary"
  }, x.raw.vendor), React.createElement("td", null, React.createElement("span", {
    className: "cn-mono cn-cell-secondary"
  }, x.raw.billNumber)), React.createElement("td", null, React.createElement("span", {
    className: `cn-fin-cat ${x.c.isCogs ? "is-cogs" : ""}`
  }, x.raw.category)), React.createElement("td", {
    className: "cn-cell-secondary"
  }, finDateLabel(x.raw.issueDate)), React.createElement("td", {
    className: "cn-cell-secondary"
  }, finDateLabel(x.raw.dueDate)), React.createElement("td", null, React.createElement(FinApStatusPill, {
    computed: x.c
  })), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, finFmt0(x.c.amount)), React.createElement("td", {
    style: {
      textAlign: "right"
    },
    onClick: e => e.stopPropagation()
  }, React.createElement("button", {
    className: x.c.isPaid ? "cn-link cn-cell-secondary" : "cn-link",
    onClick: () => togglePaid(x)
  }, x.c.isPaid ? "Undo" : "Mark paid"))))))), editing && React.createElement(FinBillEditor, {
    bill: editing === "new" ? null : editing,
    onClose: () => setEditing(null),
    onSave: save,
    onDelete: del
  }));
}
function FinBillEditor({
  bill,
  onClose,
  onSave,
  onDelete
}) {
  var today = finISO(finToday());
  var [d, setD] = useState(bill || {
    id: FIN_ID("bill"),
    vendor: "",
    billNumber: "",
    category: "Software & SaaS",
    issueDate: today,
    dueDate: finAddDays(today, 30),
    amount: 0,
    status: "unpaid",
    paidAt: null,
    notes: ""
  });
  var up = patch => setD({
    ...d,
    ...patch
  });
  var valid = d.vendor.trim() && (parseFloat(d.amount) || 0) > 0;
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
      width: 540
    }
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, bill ? "Edit bill" : "New vendor bill"), React.createElement("h2", {
    className: "cn-modal-title"
  }, d.vendor || "Accounts payable")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.4
    }
  }, React.createElement("label", null, "Vendor"), React.createElement("input", {
    className: "cn-input",
    value: d.vendor,
    onChange: e => up({
      vendor: e.target.value
    }),
    placeholder: "Ingram Micro, AWS, landlord\u2026",
    autoFocus: true
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Bill #"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: d.billNumber,
    onChange: e => up({
      billNumber: e.target.value
    }),
    placeholder: "optional"
  }))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.4
    }
  }, React.createElement("label", null, "Category"), React.createElement("select", {
    className: "cn-input",
    value: d.category,
    onChange: e => up({
      category: e.target.value
    })
  }, React.createElement("optgroup", {
    label: "Cost of goods (resale)"
  }, FIN_COGS_CATS.map(c => React.createElement("option", {
    key: c
  }, c))), React.createElement("optgroup", {
    label: "Operating"
  }, FIN_OPEX_CATS.map(c => React.createElement("option", {
    key: c
  }, c))))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Amount"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    step: "0.01",
    value: d.amount,
    onChange: e => up({
      amount: e.target.value
    })
  }))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Issued"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: d.issueDate,
    onChange: e => up({
      issueDate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Due"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: d.dueDate,
    onChange: e => up({
      dueDate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Status"), React.createElement("select", {
    className: "cn-input",
    value: d.status,
    onChange: e => up({
      status: e.target.value,
      paidAt: e.target.value === "paid" ? d.paidAt || new Date().toISOString() : null
    })
  }, React.createElement("option", {
    value: "unpaid"
  }, "Unpaid"), React.createElement("option", {
    value: "paid"
  }, "Paid")))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Notes ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 optional")), React.createElement("input", {
    className: "cn-input",
    value: d.notes,
    onChange: e => up({
      notes: e.target.value
    }),
    placeholder: "What this bill is for\u2026"
  }))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, bill ? React.createElement("button", {
    className: "cn-btn cn-btn--danger",
    onClick: () => onDelete(d.id)
  }, "Delete") : React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Cancel"), React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => onSave({
      ...d,
      amount: parseFloat(d.amount) || 0
    }),
    disabled: !valid
  }, bill ? "Save bill" : "Add bill")))));
}
function FinanceExpenses({
  expenses,
  refresh
}) {
  var [cat, setCat] = useState("all");
  var [q, setQ] = useState("");
  var [editing, setEditing] = useState(null);
  var months = finRecentMonths(6);
  var rows = expenses.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  var filtered = rows.filter(e => (cat === "all" || e.category === cat) && (!q || (e.payee || "").toLowerCase().includes(q.toLowerCase()) || (e.category || "").toLowerCase().includes(q.toLowerCase())));
  var total = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  var curKey = months[months.length - 1];
  var monthTotal = expenses.filter(e => finMonthKey(e.date) === curKey).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  var recurringMonthly = expenses.filter(e => e.recurring === "monthly" && finMonthKey(e.date) === curKey).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  var byCat = {};
  expenses.forEach(e => {
    byCat[e.category] = (byCat[e.category] || 0) + (parseFloat(e.amount) || 0);
  });
  var catList = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  var catMax = Math.max(1, ...catList.map(c => c[1]));
  var burn = months.map(m => expenses.filter(e => finMonthKey(e.date) === m).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0));
  var save = exp => {
    var list = finRead("expenses");
    var i = list.findIndex(e => e.id === exp.id);
    if (i >= 0) list[i] = exp;else list.unshift(exp);
    finWrite("expenses", list);
    setEditing(null);
    refresh();
  };
  var del = id => {
    if (!confirm("Delete this expense?")) return;
    finWrite("expenses", finRead("expenses").filter(e => e.id !== id));
    setEditing(null);
    refresh();
  };
  return React.createElement("div", {
    className: "cn-fin-view"
  }, React.createElement("section", {
    className: "cn-fin-strip"
  }, React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "This month"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(monthTotal)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "operating spend")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Recurring / mo"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(recurringMonthly)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "fixed monthly base")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Trailing total"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(total)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, expenses.length, " entries")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Avg burn / mo"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(burn.reduce((s, v) => s + v, 0) / Math.max(1, months.length))), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "last 6 months"))), React.createElement("div", {
    className: "cn-grid-2"
  }, React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Monthly burn"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Operating spend"))), React.createElement(FinBarChart, {
    months: months,
    seriesA: burn,
    labelA: "OpEx"
  })), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Where it goes"), React.createElement("h2", {
    className: "cn-card-title"
  }, "By category"))), React.createElement("div", {
    className: "cn-fin-aging"
  }, catList.map(([c, amt]) => React.createElement("div", {
    key: c,
    className: "cn-fin-aging-row"
  }, React.createElement("span", {
    className: "cn-fin-aging-label",
    style: {
      width: 160
    }
  }, c), React.createElement("span", {
    className: "cn-fin-aging-track"
  }, React.createElement("span", {
    className: "cn-fin-aging-fill is-opex",
    style: {
      width: `${amt / catMax * 100}%`
    }
  })), React.createElement("span", {
    className: "cn-fin-aging-amt cn-mono"
  }, finFmt0(amt))))))), React.createElement("div", {
    className: "cn-toolbar",
    style: {
      marginTop: 4
    }
  }, React.createElement("div", {
    className: "cn-toolbar-right",
    style: {
      marginRight: "auto"
    }
  }, React.createElement("label", {
    className: "cn-sort-select"
  }, React.createElement("span", {
    className: "cn-sort-select-label"
  }, "Category"), React.createElement("select", {
    className: "cn-input",
    value: cat,
    onChange: e => setCat(e.target.value),
    style: {
      width: 190
    }
  }, React.createElement("option", {
    value: "all"
  }, "All categories"), FIN_EXPENSE_CATS.map(c => React.createElement("option", {
    key: c
  }, c))))), React.createElement("div", {
    className: "cn-toolbar-right"
  }, React.createElement("input", {
    className: "cn-input",
    placeholder: "Search payee\u2026",
    value: q,
    onChange: e => setQ(e.target.value),
    style: {
      width: 200
    }
  }), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setEditing("new")
  }, "+ New expense"))), React.createElement("section", {
    className: "cn-card cn-card--flush"
  }, filtered.length === 0 ? React.createElement("div", {
    className: "cn-fin-empty",
    style: {
      padding: 40
    }
  }, "No expenses logged.") : React.createElement("table", {
    className: "cn-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Date"), React.createElement("th", null, "Payee"), React.createElement("th", null, "Category"), React.createElement("th", null, "Recurring"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Amount"))), React.createElement("tbody", null, filtered.map(e => React.createElement("tr", {
    key: e.id,
    className: "cn-tr-link",
    onClick: () => setEditing(e)
  }, React.createElement("td", {
    className: "cn-cell-secondary"
  }, finDateLabel(e.date)), React.createElement("td", {
    className: "cn-cell-primary"
  }, e.payee || "—", e.notes && React.createElement("span", {
    className: "cn-cell-secondary",
    style: {
      fontWeight: 400
    }
  }, " \xB7 ", e.notes)), React.createElement("td", null, React.createElement("span", {
    className: "cn-fin-cat"
  }, e.category)), React.createElement("td", {
    className: "cn-cell-secondary"
  }, e.recurring === "monthly" ? "Monthly" : "One-off"), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, finFmt0(parseFloat(e.amount) || 0))))))), editing && React.createElement(FinExpenseEditor, {
    exp: editing === "new" ? null : editing,
    onClose: () => setEditing(null),
    onSave: save,
    onDelete: del
  }));
}
function FinExpenseEditor({
  exp,
  onClose,
  onSave,
  onDelete
}) {
  var today = finISO(finToday());
  var [d, setD] = useState(exp || {
    id: FIN_ID("exp"),
    date: today,
    category: "Software & SaaS",
    payee: "",
    amount: 0,
    recurring: "none",
    notes: ""
  });
  var up = patch => setD({
    ...d,
    ...patch
  });
  var valid = d.payee.trim() && (parseFloat(d.amount) || 0) > 0;
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
      width: 520
    }
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, exp ? "Edit expense" : "New expense"), React.createElement("h2", {
    className: "cn-modal-title"
  }, d.payee || "Operating expense")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.4
    }
  }, React.createElement("label", null, "Payee"), React.createElement("input", {
    className: "cn-input",
    value: d.payee,
    onChange: e => up({
      payee: e.target.value
    }),
    placeholder: "Landlord, ADP, AWS\u2026",
    autoFocus: true
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Amount"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    step: "0.01",
    value: d.amount,
    onChange: e => up({
      amount: e.target.value
    })
  }))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.4
    }
  }, React.createElement("label", null, "Category"), React.createElement("select", {
    className: "cn-input",
    value: d.category,
    onChange: e => up({
      category: e.target.value
    })
  }, FIN_EXPENSE_CATS.map(c => React.createElement("option", {
    key: c
  }, c)))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Date"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: d.date,
    onChange: e => up({
      date: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Recurring"), React.createElement("select", {
    className: "cn-input",
    value: d.recurring,
    onChange: e => up({
      recurring: e.target.value
    })
  }, React.createElement("option", {
    value: "none"
  }, "One-off"), React.createElement("option", {
    value: "monthly"
  }, "Monthly")))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Notes ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 optional")), React.createElement("input", {
    className: "cn-input",
    value: d.notes,
    onChange: e => up({
      notes: e.target.value
    })
  }))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, exp ? React.createElement("button", {
    className: "cn-btn cn-btn--danger",
    onClick: () => onDelete(d.id)
  }, "Delete") : React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Cancel"), React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => onSave({
      ...d,
      amount: parseFloat(d.amount) || 0
    }),
    disabled: !valid
  }, exp ? "Save" : "Add expense")))));
}
function FinanceSettingsModal({
  settings,
  onClose,
  onSaved
}) {
  var [d, setD] = useState({
    ...settings
  });
  var up = patch => setD({
    ...d,
    ...patch
  });
  var save = () => {
    finWriteSettings({
      ...d,
      openingCash: parseFloat(d.openingCash) || 0,
      salesTaxRate: parseFloat(d.salesTaxRate) || 0,
      incomeTaxRate: parseFloat(d.incomeTaxRate) || 0
    });
    onSaved();
  };
  var clearAll = () => {
    if (!confirm("Delete every finance entry in this browser — commissions, resale records, vendor bills and expenses? Live Sales Hub invoices are not affected. This cannot be undone.")) return;
    finWrite("ar", []);
    finWrite("bills", []);
    finWrite("expenses", []);
    onSaved();
    window.cnToast && window.cnToast({
      title: "All finance entries cleared"
    });
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
      width: 540
    }
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Finance settings"), React.createElement("h2", {
    className: "cn-modal-title"
  }, "Assumptions & data")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Opening cash balance ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 bank balance at the start of the period")), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    step: "1000",
    value: d.openingCash,
    onChange: e => up({
      openingCash: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Sales tax rate % ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 resale only")), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    step: "0.1",
    value: d.salesTaxRate,
    onChange: e => up({
      salesTaxRate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Income tax set-aside %"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    step: "1",
    value: d.incomeTaxRate,
    onChange: e => up({
      incomeTaxRate: e.target.value
    })
  }))), React.createElement("div", {
    className: "cn-fin-settings-data"
  }, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginBottom: 8
    }
  }, "Reset"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: clearAll
  }, "Clear all finance entries"), React.createElement("p", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12,
      margin: "8px 0 0"
    }
  }, "Wipes commissions, resale records, vendor bills and expenses stored in this browser. Live Sales Hub invoices are never touched."))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Cancel"), React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: save
  }, "Save settings")))));
}
Object.assign(window, {
  FinArEditor,
  FinancePayables,
  FinBillEditor,
  FinanceExpenses,
  FinExpenseEditor,
  FinanceSettingsModal
});