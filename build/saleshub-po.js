var {
  shNewId,
  shNewLine,
  shLineTotal,
  shDocTotal,
  shFmt,
  shTimeAgo,
  shToday,
  shAddDays,
  shYearEnd,
  shOtherRole,
  shRoleLabel
} = window.shHelpers;
function shPOTotals(d) {
  var qty = parseFloat(d.contractQty) || 0;
  var unit = parseFloat(d.unitPrice) || 0;
  var scheduled = (d.schedule || []).reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
  return {
    contractValue: qty * unit,
    scheduled,
    remaining: qty - scheduled
  };
}
window.shPOTotals = shPOTotals;
function ShPOBuilder({
  doc,
  scenario,
  currentUser,
  onChange,
  onClose,
  onShare,
  onDelete
}) {
  var [d, setD] = useState(doc);
  useEffect(() => {
    setD(doc);
  }, [doc.id]);
  var update = patch => {
    var n = {
      ...d,
      ...patch
    };
    setD(n);
    onChange(patch);
  };
  var updateRelease = (id, patch) => update({
    schedule: d.schedule.map(r => r.id === id ? {
      ...r,
      ...patch
    } : r)
  });
  var removeRelease = id => update({
    schedule: d.schedule.filter(r => r.id !== id)
  });
  var addRelease = () => {
    var yr = (d.effectiveDate || shToday()).slice(0, 4);
    var lastDate = d.schedule.length ? d.schedule[d.schedule.length - 1].date : d.effectiveDate;
    var next = shAddDays(lastDate || shToday(), 30);
    var clamped = next.slice(0, 4) === yr ? next : `${yr}-12-31`;
    update({
      schedule: [...d.schedule, {
        id: shNewId("rel"),
        date: clamped,
        qty: 0,
        note: ""
      }]
    });
  };
  var updateLine = (id, patch) => update({
    lineItems: (d.lineItems || []).map(li => li.id === id ? {
      ...li,
      ...patch
    } : li)
  });
  var addLine = () => update({
    lineItems: [...(d.lineItems || []), shNewLine()]
  });
  var removeLine = id => update({
    lineItems: (d.lineItems || []).filter(li => li.id !== id)
  });
  var poType = d.poType || "open";
  var isOpen = poType === "open";
  var ourRole = d.ourRole || "seller";
  var setPoType = t => {
    if (t === poType) return;
    var docNumber = d.docNumber;
    if (t === "onetime" && /^OPO-/.test(docNumber)) docNumber = docNumber.replace(/^OPO-/, "PO-");
    if (t === "open" && /^PO-/.test(docNumber)) docNumber = docNumber.replace(/^PO-/, "OPO-");
    update({
      poType: t,
      docNumber
    });
  };
  var tot = shPOTotals(d);
  var lineTotal = shDocTotal(d);
  var year = (d.effectiveDate || shToday()).slice(0, 4);
  var yearStart = `${year}-01-01`;
  var yearEnd = `${year}-12-31`;
  var offSchedule = (d.schedule || []).some(r => (r.date || "").slice(0, 4) !== year);
  var qtyMismatch = Math.round((tot.scheduled - (parseFloat(d.contractQty) || 0)) * 100) !== 0;
  return React.createElement("div", {
    className: "cn-modal-scrim cn-quote-scrim",
    onClick: onClose
  }, React.createElement("div", {
    className: "cn-modal cn-quote-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, isOpen ? "Open Purchase Order · blanket" : "Purchase Order · one-time"), React.createElement("h2", {
    className: "cn-modal-title",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, React.createElement("input", {
    className: "cn-input cn-quote-num",
    value: d.docNumber,
    onChange: e => update({
      docNumber: e.target.value
    })
  }), React.createElement(window.ShStatus, {
    doc: d,
    kind: "po"
  }))), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body cn-quote-body"
  }, React.createElement("div", {
    className: "cn-quote-doc-edit"
  }, React.createElement("div", {
    className: "cn-sh-ctrlbar"
  }, React.createElement("div", {
    className: "cn-sh-ctrl"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "PO type"), React.createElement("div", {
    className: "cn-segmented"
  }, React.createElement("button", {
    className: isOpen ? "is-active" : "",
    onClick: () => setPoType("open")
  }, "Open / blanket"), React.createElement("button", {
    className: !isOpen ? "is-active" : "",
    onClick: () => setPoType("onetime")
  }, "One-time"))), React.createElement(window.ShRoleToggle, {
    doc: d,
    update: update
  }), React.createElement("div", {
    className: "cn-sh-ctrl-help"
  }, isOpen ? "Locks one SKU + total quantity at a fixed price, drawn down on a release schedule within the calendar year." : "A single itemized order with one delivery date.", " ", ourRole === "seller" ? "The Buyer fills their details and signs." : "The Seller fills their details and signs.")), isOpen ? React.createElement("div", {
    className: "cn-quote-meta-grid",
    style: {
      gridTemplateColumns: "repeat(4, 1fr)"
    }
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Issue date"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: d.issueDate,
    onChange: e => update({
      issueDate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Effective"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: d.effectiveDate,
    onChange: e => update({
      effectiveDate: e.target.value,
      expirationDate: shYearEnd(e.target.value)
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Expires ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 same year")), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: d.expirationDate,
    min: yearStart,
    max: yearEnd,
    onChange: e => {
      var v = e.target.value;
      if (v.slice(0, 4) !== year) return;
      update({
        expirationDate: v
      });
    }
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Currency"), React.createElement("select", {
    className: "cn-input",
    value: d.currency,
    onChange: e => update({
      currency: e.target.value
    })
  }, ["USD", "EUR", "GBP", "CAD", "AUD"].map(c => React.createElement("option", {
    key: c,
    value: c
  }, c))))) : React.createElement("div", {
    className: "cn-quote-meta-grid",
    style: {
      gridTemplateColumns: "repeat(3, 1fr)"
    }
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Issue date"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: d.issueDate,
    onChange: e => update({
      issueDate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Requested delivery"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: d.deliveryDate,
    onChange: e => update({
      deliveryDate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Currency"), React.createElement("select", {
    className: "cn-input",
    value: d.currency,
    onChange: e => update({
      currency: e.target.value
    })
  }, ["USD", "EUR", "GBP", "CAD", "AUD"].map(c => React.createElement("option", {
    key: c,
    value: c
  }, c))))), React.createElement(window.ShSectionHead, null, "1 \xB7 Parties"), React.createElement("div", {
    className: "cn-sh-twocol"
  }, React.createElement(window.ShPartyCard, {
    role: "seller",
    doc: d,
    update: update,
    mine: ourRole === "seller"
  }), React.createElement(window.ShPartyCard, {
    role: "buyer",
    doc: d,
    update: update,
    mine: ourRole === "buyer"
  })), isOpen ? React.createElement(React.Fragment, null, React.createElement(window.ShSectionHead, null, "2 \xB7 Locked product & pricing"), React.createElement("div", {
    className: "cn-sh-lock-card"
  }, React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 2
    }
  }, React.createElement("label", null, "Mfr Part Number / SKU ", React.createElement("span", {
    className: "cn-sh-req"
  }, "*")), React.createElement("input", {
    className: "cn-input cn-mono",
    value: d.partNumber,
    onChange: e => update({
      partNumber: e.target.value
    }),
    placeholder: "MFR-PN-0000"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Condition"), React.createElement("select", {
    className: "cn-input",
    value: d.condition,
    onChange: e => update({
      condition: e.target.value
    })
  }, ["New", "New Surplus", "Factory Refurbished", "Used", "Repaired", "As-Is"].map(c => React.createElement("option", {
    key: c,
    value: c
  }, c))))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Description"), React.createElement("textarea", {
    className: "cn-textarea cn-textarea--rich",
    rows: 6,
    value: d.description,
    onChange: e => update({
      description: e.target.value
    }),
    placeholder: "Full description of the product / scope. Paste structured specs here \u2014 ALL CAPS lines become section headers, \u201cLabel \u2014 value\u201d lines line up, and dashes/bullets render as a list."
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Total contract qty ", React.createElement("span", {
    className: "cn-sh-req"
  }, "*")), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "1",
    step: "1",
    value: d.contractQty,
    onChange: e => update({
      contractQty: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Unit price (locked) ", React.createElement("span", {
    className: "cn-sh-req"
  }, "*")), React.createElement("div", {
    className: "cn-li-money"
  }, React.createElement("span", null, "$"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    step: "0.01",
    value: d.unitPrice,
    onChange: e => update({
      unitPrice: e.target.value
    })
  }))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Min release qty"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "1",
    step: "1",
    value: d.minReleaseQty,
    onChange: e => update({
      minReleaseQty: e.target.value
    })
  }))), React.createElement("div", {
    className: "cn-sh-lock-summary"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Contract value"), React.createElement("div", {
    className: "cn-mono",
    style: {
      fontSize: 20,
      fontWeight: 600
    }
  }, shFmt(tot.contractValue), " ", d.currency)), React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Effective term"), React.createElement("div", null, d.effectiveDate, " \u2192 ", d.expirationDate))))) : React.createElement(React.Fragment, null, React.createElement(window.ShSectionHead, null, "2 \xB7 Products & pricing"), React.createElement("table", {
    className: "cn-li-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Mfr Part Number"), React.createElement("th", {
    style: {
      width: 80
    }
  }, "Qty"), React.createElement("th", {
    style: {
      width: 160
    }
  }, "Condition"), React.createElement("th", {
    style: {
      width: 140
    },
    className: "cn-li-right"
  }, "Unit price"), React.createElement("th", {
    style: {
      width: 140
    },
    className: "cn-li-right"
  }, "Total"), React.createElement("th", {
    style: {
      width: 32
    }
  }))), React.createElement("tbody", null, (d.lineItems || []).map(li => React.createElement(Fragment, {
    key: li.id
  }, React.createElement("tr", null, React.createElement("td", null, React.createElement("input", {
    className: "cn-li-input cn-mono",
    value: li.partNumber,
    onChange: e => updateLine(li.id, {
      partNumber: e.target.value
    }),
    placeholder: "MFR-PN-0000"
  })), React.createElement("td", null, React.createElement("input", {
    className: "cn-li-input cn-mono cn-li-right-input",
    type: "number",
    min: "0",
    step: "1",
    value: li.qty,
    onChange: e => updateLine(li.id, {
      qty: e.target.value
    })
  })), React.createElement("td", null, React.createElement("select", {
    className: "cn-li-input",
    value: li.condition,
    onChange: e => updateLine(li.id, {
      condition: e.target.value
    })
  }, ["New", "New Surplus", "Factory Refurbished", "Used", "Repaired", "As-Is"].map(c => React.createElement("option", {
    key: c,
    value: c
  }, c)))), React.createElement("td", null, React.createElement("div", {
    className: "cn-li-money"
  }, React.createElement("span", null, "$"), React.createElement("input", {
    className: "cn-li-input cn-mono cn-li-right-input",
    type: "number",
    min: "0",
    step: "0.01",
    value: li.unitPrice,
    onChange: e => updateLine(li.id, {
      unitPrice: e.target.value
    })
  }))), React.createElement("td", {
    className: "cn-li-right cn-mono cn-li-total"
  }, shFmt(shLineTotal(li))), React.createElement("td", null, React.createElement("button", {
    className: "cn-li-remove",
    onClick: () => removeLine(li.id),
    disabled: (d.lineItems || []).length === 1
  }, "\u2715"))), React.createElement("tr", {
    className: "cn-li-desc-row"
  }, React.createElement("td", {
    colSpan: 5
  }, React.createElement("input", {
    className: "cn-li-input cn-li-desc",
    value: li.description,
    onChange: e => updateLine(li.id, {
      description: e.target.value
    }),
    placeholder: "Description / specs / notes (optional)"
  })), React.createElement("td", null)))))), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      marginTop: 10
    },
    onClick: addLine
  }, "+ Add line"), React.createElement("div", {
    className: "cn-quote-totals"
  }, React.createElement("div", {
    className: "cn-quote-totals-row cn-quote-totals-row--final"
  }, React.createElement("span", null, "Purchase order total"), React.createElement("span", {
    className: "cn-mono"
  }, shFmt(lineTotal), " ", d.currency)))), React.createElement(window.ShSectionHead, null, "3 \xB7 Shipping destination"), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Ship-to facility"), React.createElement("input", {
    className: "cn-input",
    value: d.shipToName,
    onChange: e => update({
      shipToName: e.target.value
    }),
    placeholder: "Data center / warehouse name"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Attention"), React.createElement("input", {
    className: "cn-input",
    value: d.shipToAttention,
    onChange: e => update({
      shipToAttention: e.target.value
    }),
    placeholder: "Receiver name / dock contact"
  }))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Address"), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 70
    },
    value: d.shipToAddress,
    onChange: e => update({
      shipToAddress: e.target.value
    }),
    placeholder: "Street, city, state, ZIP, country"
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Incoterms"), React.createElement("select", {
    className: "cn-input",
    value: d.incoterms,
    onChange: e => update({
      incoterms: e.target.value
    })
  }, ["FOB Origin", "FOB Destination", "EXW", "CIP", "CIF", "DAP", "DDP", "DPU"].map(t => React.createElement("option", {
    key: t,
    value: t
  }, t)))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Shipping method"), React.createElement("input", {
    className: "cn-input",
    value: d.shipMethod,
    onChange: e => update({
      shipMethod: e.target.value
    })
  }))), isOpen && React.createElement(React.Fragment, null, React.createElement(window.ShSectionHead, null, "4 \xB7 Shipping schedule ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 12,
      fontWeight: 400
    }
  }, "\xB7 ", year, " only")), React.createElement("table", {
    className: "cn-li-table cn-sh-rel-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      width: 50
    }
  }, "#"), React.createElement("th", null, "Release date"), React.createElement("th", {
    style: {
      width: 120
    },
    className: "cn-li-right"
  }, "Quantity"), React.createElement("th", null, "Notes"), React.createElement("th", {
    style: {
      width: 32
    }
  }))), React.createElement("tbody", null, d.schedule.map((r, i) => {
    var offYear = (r.date || "").slice(0, 4) !== year;
    return React.createElement("tr", {
      key: r.id
    }, React.createElement("td", {
      className: "cn-mono",
      style: {
        color: "var(--cn-mute)"
      }
    }, "R", String(i + 1).padStart(2, "0")), React.createElement("td", null, React.createElement("input", {
      className: `cn-li-input ${offYear ? "cn-sh-rel-bad" : ""}`,
      type: "date",
      min: yearStart,
      max: yearEnd,
      value: r.date,
      onChange: e => {
        var v = e.target.value;
        if (v && v.slice(0, 4) !== year) return;
        updateRelease(r.id, {
          date: v
        });
      }
    })), React.createElement("td", null, React.createElement("input", {
      className: "cn-li-input cn-mono cn-li-right-input",
      type: "number",
      min: "0",
      step: "1",
      value: r.qty,
      onChange: e => updateRelease(r.id, {
        qty: e.target.value
      })
    })), React.createElement("td", null, React.createElement("input", {
      className: "cn-li-input",
      value: r.note,
      onChange: e => updateRelease(r.id, {
        note: e.target.value
      }),
      placeholder: "Optional \u2014 site / build / serial range"
    })), React.createElement("td", null, React.createElement("button", {
      className: "cn-li-remove",
      onClick: () => removeRelease(r.id)
    }, "\u2715")));
  }))), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      marginTop: 10
    },
    onClick: addRelease
  }, "+ Add release"), React.createElement("div", {
    className: "cn-sh-rel-summary"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Scheduled"), React.createElement("div", {
    className: "cn-mono"
  }, tot.scheduled, " of ", d.contractQty, " units")), React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Remaining unscheduled"), React.createElement("div", {
    className: `cn-mono ${qtyMismatch ? "cn-sh-rel-warn" : ""}`
  }, tot.remaining, " units ", qtyMismatch && (tot.remaining > 0 ? "· some quantity still unscheduled" : "· over-scheduled"))), React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Releases"), React.createElement("div", {
    className: "cn-mono"
  }, d.schedule.length))), offSchedule && React.createElement("div", {
    className: "cn-login-error",
    style: {
      marginTop: 10
    }
  }, "One or more releases fall outside ", year, ". Open POs must stay within the same calendar year \u2014 adjust the dates or extend the term.")), React.createElement(window.ShSectionHead, null, isOpen ? "5" : "4", " \xB7 Commercial & legal"), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Payment terms"), React.createElement("textarea", {
    className: "cn-textarea",
    value: d.paymentTerms,
    onChange: e => update({
      paymentTerms: e.target.value
    })
  })), isOpen && React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Price-lock clause"), React.createElement("textarea", {
    className: "cn-textarea",
    value: d.priceLockClause,
    onChange: e => update({
      priceLockClause: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Cancellation policy"), React.createElement("textarea", {
    className: "cn-textarea",
    value: d.cancellationPolicy,
    onChange: e => update({
      cancellationPolicy: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Governing law"), React.createElement("input", {
    className: "cn-input",
    value: d.governingLaw,
    onChange: e => update({
      governingLaw: e.target.value
    })
  })), React.createElement("label", {
    className: "cn-sh-check"
  }, React.createElement("input", {
    type: "checkbox",
    checked: d.forceMajeure,
    onChange: e => update({
      forceMajeure: e.target.checked
    })
  }), " Include force majeure clause"))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--danger",
    onClick: onDelete
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
    onClick: onShare
  }, "Send ", isOpen ? "Open PO" : "PO", " \u2192")))));
}
function ShPOShareView({
  doc,
  onUpdate
}) {
  var poType = doc.poType || "open";
  var isOpen = poType === "open";
  var ourRole = doc.ourRole || "seller";
  var counterRole = shOtherRole(ourRole);
  var cf = window.shHelpers.shPartyFields(counterRole);
  var counterLabel = shRoleLabel(counterRole);
  var counterFillsShipTo = counterRole === "buyer";
  var [edit, setEdit] = useState({
    cName: doc[cf.name] || "",
    cAddress: doc[cf.address] || "",
    cTaxId: doc[cf.taxId] || "",
    cContactName: doc[cf.contactName] || "",
    cContactEmail: doc[cf.contactEmail] || "",
    cContactPhone: doc[cf.contactPhone] || "",
    signer: doc.buyerSignedName || "",
    signerTitle: doc.buyerSignedTitle || "",
    shipToName: doc.shipToName || "",
    shipToAddress: doc.shipToAddress || "",
    shipToAttention: doc.shipToAttention || ""
  });
  var [schedule, setSchedule] = useState(doc.schedule || []);
  var [agreed, setAgreed] = useState(false);
  var [showDecline, setShowDecline] = useState(false);
  var [reason, setReason] = useState("");
  var set = patch => setEdit(prev => ({
    ...prev,
    ...patch
  }));
  var setRel = (id, patch) => setSchedule(prev => prev.map(r => r.id === id ? {
    ...r,
    ...patch
  } : r));
  var decided = doc.status === "accepted" || doc.status === "declined";
  var year = (doc.effectiveDate || shToday()).slice(0, 4);
  var yearStart = `${year}-01-01`;
  var yearEnd = `${year}-12-31`;
  var tot = shPOTotals({
    ...doc,
    schedule
  });
  var lineTotal = shDocTotal(doc);
  var value = isOpen ? tot.contractValue : lineTotal;
  var counterPatch = () => ({
    [cf.name]: edit.cName,
    [cf.address]: edit.cAddress,
    [cf.taxId]: edit.cTaxId,
    [cf.contactName]: edit.cContactName,
    [cf.contactEmail]: edit.cContactEmail,
    [cf.contactPhone]: edit.cContactPhone,
    ...(counterFillsShipTo ? {
      shipToName: edit.shipToName,
      shipToAddress: edit.shipToAddress,
      shipToAttention: edit.shipToAttention
    } : {})
  });
  var accept = () => {
    if (!edit.cName.trim() || !edit.signer.trim() || !edit.signerTitle.trim()) {
      alert("Please fill in your legal company name, signing authority, and title.");
      return;
    }
    if (counterFillsShipTo && !edit.shipToAddress.trim()) {
      alert("Please confirm a shipping destination.");
      return;
    }
    if (!agreed) {
      alert("Please confirm you agree to the terms.");
      return;
    }
    var patch = {
      ...counterPatch(),
      ...(isOpen ? {
        schedule
      } : {}),
      buyerSignedName: edit.signer,
      buyerSignedTitle: edit.signerTitle,
      buyerSignedDate: shToday(),
      status: "accepted",
      decidedAt: new Date().toISOString()
    };
    var merged = {
      ...doc,
      ...patch
    };
    onUpdate(patch);
    var shareUrl = window.location.href;
    var emailedTo = [];
    try {
      if (window.sendDocumentCopy) {
        window.sendDocumentCopy({
          kind: "po",
          doc: merged,
          shareUrl
        }).catch(() => {});
      }
      var fallback = [window.CN_SALES_INBOX, edit.cContactEmail, doc[window.shHelpers.shPartyFields(ourRole).contactEmail]].filter(Boolean);
      emailedTo = Array.from(new Set(fallback));
    } catch {}
    try {
      var pending = JSON.parse(localStorage.getItem("cn-sh-pending") || "[]");
      pending.push({
        id: shNewId("ps"),
        kind: "po",
        docId: doc.id,
        docNumber: doc.docNumber,
        action: "accepted",
        at: new Date().toISOString(),
        signedBy: edit.signer,
        buyerName: edit.cName,
        totalCents: Math.round(value * 100),
        emailedTo,
        processed: false
      });
      localStorage.setItem("cn-sh-pending", JSON.stringify(pending));
    } catch {}
  };
  var decline = () => {
    onUpdate({
      status: "declined",
      declineReason: reason,
      decidedAt: new Date().toISOString()
    });
    try {
      var pending = JSON.parse(localStorage.getItem("cn-sh-pending") || "[]");
      pending.push({
        id: shNewId("ps"),
        kind: "po",
        docId: doc.id,
        docNumber: doc.docNumber,
        action: "declined",
        at: new Date().toISOString(),
        reason,
        processed: false
      });
      localStorage.setItem("cn-sh-pending", JSON.stringify(pending));
    } catch {}
  };
  var StaticParty = ({
    role
  }) => {
    var f = window.shHelpers.shPartyFields(role);
    return React.createElement(React.Fragment, null, React.createElement("div", {
      className: "cn-qd-eyebrow"
    }, shRoleLabel(role)), React.createElement("div", {
      className: "cn-sh-party"
    }, React.createElement("strong", null, doc[f.name] || "—")), React.createElement("div", {
      className: "cn-sh-party-addr"
    }, doc[f.address]), React.createElement("div", {
      style: {
        fontSize: 13,
        marginTop: 6
      }
    }, doc[f.taxId] ? React.createElement(React.Fragment, null, "Tax ID: ", React.createElement("span", {
      className: "cn-mono"
    }, doc[f.taxId]), React.createElement("br", null)) : null, doc[f.contactName] ? React.createElement(React.Fragment, null, role === "seller" ? "Authorized rep" : "Contact", ": ", doc[f.contactName], doc[f.contactEmail] ? React.createElement(React.Fragment, null, " \xB7 ", React.createElement("span", {
      className: "cn-mono",
      style: {
        color: "var(--cn-mute)"
      }
    }, doc[f.contactEmail])) : null, doc[f.contactPhone] ? " · " + doc[f.contactPhone] : "") : null));
  };
  var FillParty = () => React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-qd-eyebrow"
  }, counterLabel, " ", React.createElement("span", {
    style: {
      textTransform: "none",
      letterSpacing: 0,
      color: "var(--cn-mute)",
      fontWeight: 400
    }
  }, "\xB7 your details")), React.createElement("div", {
    className: "cn-sh-fillable"
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Legal company name ", React.createElement("span", {
    className: "cn-sh-req"
  }, "*")), React.createElement("input", {
    className: "cn-input",
    value: edit.cName,
    onChange: e => set({
      cName: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Address"), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 70
    },
    value: edit.cAddress,
    onChange: e => set({
      cAddress: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Tax ID / EIN / VAT"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: edit.cTaxId,
    onChange: e => set({
      cTaxId: e.target.value
    })
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
    value: edit.cContactPhone,
    onChange: e => set({
      cContactPhone: e.target.value
    })
  }))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Primary contact"), React.createElement("input", {
    className: "cn-input",
    value: edit.cContactName,
    onChange: e => set({
      cContactName: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Email"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: edit.cContactEmail,
    onChange: e => set({
      cContactEmail: e.target.value
    })
  })))));
  var secSign = isOpen ? "6" : "5";
  var secLegal = isOpen ? "5" : "4";
  return React.createElement("div", {
    className: "cn-share-page"
  }, React.createElement("div", {
    className: "cn-share-toolbar"
  }, React.createElement("div", {
    className: "cn-share-toolbar-brand"
  }, React.createElement("span", {
    className: "cn-brand-name",
    style: {
      fontSize: 14,
      color: "var(--cn-ink)"
    }
  }, window.CN_BRAND && window.CN_BRAND.name || "Chief Negotiators"), React.createElement("span", {
    className: "cn-brand-sub"
  }, isOpen ? "Open PO" : "PO", " \xB7 ", doc.docNumber)), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => window.print()
  }, "\u2913 Save as PDF"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => window.print()
  }, "Print"))), React.createElement("article", {
    className: "cn-quote-doc cn-sh-doc"
  }, React.createElement("header", {
    className: "cn-qd-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-qd-brand"
  }, window.CN_BRAND && window.CN_BRAND.name || "Chief Negotiators"), React.createElement("div", {
    className: "cn-qd-tag"
  }, isOpen ? "Open Purchase Order · Blanket" : "Purchase Order · One-time")), React.createElement("div", {
    className: "cn-qd-stamp"
  }, React.createElement("div", {
    className: "cn-qd-stamp-label"
  }, isOpen ? "Open PO" : "Purchase Order"), React.createElement("div", {
    className: "cn-qd-stamp-num cn-mono"
  }, doc.docNumber), React.createElement("div", {
    className: "cn-qd-stamp-meta"
  }, isOpen ? React.createElement(React.Fragment, null, React.createElement("div", null, React.createElement("span", null, "Effective"), React.createElement("span", {
    className: "cn-mono"
  }, doc.effectiveDate)), React.createElement("div", null, React.createElement("span", null, "Expires"), React.createElement("span", {
    className: "cn-mono"
  }, doc.expirationDate))) : React.createElement(React.Fragment, null, React.createElement("div", null, React.createElement("span", null, "Issued"), React.createElement("span", {
    className: "cn-mono"
  }, doc.issueDate)), React.createElement("div", null, React.createElement("span", null, "Delivery"), React.createElement("span", {
    className: "cn-mono"
  }, doc.deliveryDate || "—")))))), React.createElement("section", {
    className: "cn-sh-preamble"
  }, React.createElement("p", null, isOpen ? React.createElement(React.Fragment, null, "This Open Purchase Order (the \u201CPO\u201D), dated ", React.createElement("span", {
    className: "cn-mono"
  }, doc.issueDate), ", between ", React.createElement("strong", null, doc.sellerName || "the Seller"), " (\u201CSeller\u201D) and ", React.createElement("strong", null, doc.buyerName || "the Buyer"), " (\u201CBuyer\u201D), locks pricing on the SKU below for the total contract quantity, drawn down through scheduled releases between ", React.createElement("span", {
    className: "cn-mono"
  }, doc.effectiveDate), " and ", React.createElement("span", {
    className: "cn-mono"
  }, doc.expirationDate), ". All releases ship within calendar year ", React.createElement("span", {
    className: "cn-mono"
  }, year), ".") : React.createElement(React.Fragment, null, "This Purchase Order (the \u201CPO\u201D), dated ", React.createElement("span", {
    className: "cn-mono"
  }, doc.issueDate), ", between ", React.createElement("strong", null, doc.sellerName || "the Seller"), " (\u201CSeller\u201D) and ", React.createElement("strong", null, doc.buyerName || "the Buyer"), " (\u201CBuyer\u201D), is a firm order for the products itemized below, for delivery on or about ", React.createElement("span", {
    className: "cn-mono"
  }, doc.deliveryDate || "the agreed date"), "."), " ", "The ", counterLabel, " below is the undersigned party.")), React.createElement(window.ShDocSection, {
    num: "1",
    title: "Parties"
  }, React.createElement("div", {
    className: "cn-sh-twocol"
  }, React.createElement("div", null, counterRole === "seller" && !decided ? React.createElement(FillParty, null) : React.createElement(StaticParty, {
    role: "seller"
  })), React.createElement("div", null, counterRole === "buyer" && !decided ? React.createElement(FillParty, null) : React.createElement(StaticParty, {
    role: "buyer"
  })))), isOpen ? React.createElement(window.ShDocSection, {
    num: "2",
    title: "Locked product & pricing"
  }, React.createElement("div", {
    className: "cn-sh-lock-summary"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "SKU / Part Number"), React.createElement("div", {
    className: "cn-mono",
    style: {
      fontSize: 16
    }
  }, doc.partNumber || "—")), React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Condition"), React.createElement("div", null, doc.condition)), React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Contract qty"), React.createElement("div", {
    className: "cn-mono",
    style: {
      fontSize: 16
    }
  }, doc.contractQty)), React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Locked unit price"), React.createElement("div", {
    className: "cn-mono",
    style: {
      fontSize: 16
    }
  }, shFmt(doc.unitPrice))), React.createElement("div", {
    style: {
      gridColumn: "1 / -1"
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Contract value"), React.createElement("div", {
    className: "cn-mono",
    style: {
      fontSize: 22,
      fontWeight: 600
    }
  }, shFmt(tot.contractValue), " ", doc.currency))), doc.description && React.createElement("div", {
    style: {
      marginTop: 12,
      color: "var(--cn-ink-2)"
    }
  }, React.createElement(window.ShRichText, {
    text: doc.description
  })), React.createElement("p", {
    style: {
      marginTop: 8,
      fontSize: 13
    }
  }, "Minimum release qty: ", React.createElement("span", {
    className: "cn-mono"
  }, doc.minReleaseQty), " units")) : React.createElement(window.ShDocSection, {
    num: "2",
    title: "Products & pricing"
  }, React.createElement("table", {
    className: "cn-qd-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Mfr Part Number"), React.createElement("th", {
    style: {
      width: 70,
      textAlign: "right"
    }
  }, "Qty"), React.createElement("th", {
    style: {
      width: 160
    }
  }, "Condition"), React.createElement("th", {
    style: {
      width: 130,
      textAlign: "right"
    }
  }, "Unit price"), React.createElement("th", {
    style: {
      width: 140,
      textAlign: "right"
    }
  }, "Total"))), React.createElement("tbody", null, (doc.lineItems || []).map(li => React.createElement("tr", {
    key: li.id
  }, React.createElement("td", null, React.createElement("div", {
    className: "cn-mono cn-qd-pn"
  }, li.partNumber || "—"), li.description && React.createElement("div", {
    className: "cn-qd-desc"
  }, li.description)), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, li.qty), React.createElement("td", null, li.condition), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, shFmt(li.unitPrice)), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, shFmt(shLineTotal(li)))))), React.createElement("tfoot", null, React.createElement("tr", null, React.createElement("td", {
    colSpan: 4,
    style: {
      textAlign: "right"
    }
  }, "Purchase order total"), React.createElement("td", {
    className: "cn-mono cn-qd-grand",
    style: {
      textAlign: "right"
    }
  }, shFmt(lineTotal), " ", doc.currency))))), React.createElement(window.ShDocSection, {
    num: "3",
    title: "Shipping destination"
  }, decided || !counterFillsShipTo ? React.createElement(React.Fragment, null, React.createElement("p", null, React.createElement("strong", null, doc.shipToName || "—"), doc.shipToAttention ? ` · Attn: ${doc.shipToAttention}` : ""), React.createElement("p", {
    className: "cn-sh-party-addr"
  }, doc.shipToAddress)) : React.createElement("div", {
    className: "cn-sh-fillable"
  }, React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Ship-to facility ", React.createElement("span", {
    className: "cn-sh-req"
  }, "*")), React.createElement("input", {
    className: "cn-input",
    value: edit.shipToName,
    onChange: e => set({
      shipToName: e.target.value
    }),
    placeholder: "Data center / DC name"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Receiver / dock contact"), React.createElement("input", {
    className: "cn-input",
    value: edit.shipToAttention,
    onChange: e => set({
      shipToAttention: e.target.value
    })
  }))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Address ", React.createElement("span", {
    className: "cn-sh-req"
  }, "*")), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 70
    },
    value: edit.shipToAddress,
    onChange: e => set({
      shipToAddress: e.target.value
    }),
    placeholder: "Street, city, state, ZIP, country"
  }))), React.createElement("p", {
    style: {
      marginTop: 10
    }
  }, React.createElement("strong", null, "Incoterms:"), " ", React.createElement("span", {
    className: "cn-mono"
  }, doc.incoterms), " \xA0\xB7\xA0", React.createElement("strong", null, "Method:"), " ", doc.shipMethod, !isOpen && React.createElement(React.Fragment, null, " \xA0\xB7\xA0 ", React.createElement("strong", null, "Requested delivery:"), " ", React.createElement("span", {
    className: "cn-mono"
  }, doc.deliveryDate || "—")))), isOpen && React.createElement(window.ShDocSection, {
    num: "4",
    title: `Shipping schedule · ${year}`
  }, React.createElement("p", {
    style: {
      marginBottom: 12,
      color: "var(--cn-ink-2)"
    }
  }, decided ? "Releases as confirmed below." : "Confirm or adjust the planned releases. All dates must fall within ", !decided && React.createElement("span", {
    className: "cn-mono"
  }, year), !decided ? "." : ""), React.createElement("table", {
    className: "cn-qd-table cn-sh-rel-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      width: 70
    }
  }, "Release"), React.createElement("th", null, "Ship date"), React.createElement("th", {
    style: {
      width: 120,
      textAlign: "right"
    }
  }, "Quantity"), React.createElement("th", null, "Notes"))), React.createElement("tbody", null, (decided ? doc.schedule : schedule).map((r, i) => React.createElement("tr", {
    key: r.id
  }, React.createElement("td", {
    className: "cn-mono",
    style: {
      color: "var(--cn-mute)"
    }
  }, "R", String(i + 1).padStart(2, "0")), React.createElement("td", null, decided ? React.createElement("span", {
    className: "cn-mono"
  }, r.date) : React.createElement("input", {
    className: "cn-li-input",
    type: "date",
    min: yearStart,
    max: yearEnd,
    value: r.date,
    onChange: e => {
      var v = e.target.value;
      if (v && v.slice(0, 4) !== year) return;
      setRel(r.id, {
        date: v
      });
    }
  })), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, decided ? r.qty : React.createElement("input", {
    className: "cn-li-input cn-mono cn-li-right-input",
    type: "number",
    min: "0",
    step: "1",
    value: r.qty,
    onChange: e => setRel(r.id, {
      qty: e.target.value
    })
  })), React.createElement("td", null, decided ? r.note || "—" : React.createElement("input", {
    className: "cn-li-input",
    value: r.note || "",
    onChange: e => setRel(r.id, {
      note: e.target.value
    }),
    placeholder: "Site / build / serial range"
  }))))), React.createElement("tfoot", null, React.createElement("tr", null, React.createElement("td", {
    colSpan: 2,
    style: {
      textAlign: "right"
    }
  }, "Scheduled / contract"), React.createElement("td", {
    className: "cn-mono cn-qd-grand",
    style: {
      textAlign: "right"
    }
  }, tot.scheduled, " / ", doc.contractQty), React.createElement("td", null))))), React.createElement(window.ShDocSection, {
    num: secLegal,
    title: "Commercial & legal provisions"
  }, React.createElement("p", null, React.createElement("strong", null, "Payment terms."), " ", doc.paymentTerms), isOpen && React.createElement("p", {
    style: {
      marginTop: 8
    }
  }, React.createElement("strong", null, "Price lock."), " ", doc.priceLockClause), React.createElement("p", {
    style: {
      marginTop: 8
    }
  }, React.createElement("strong", null, "Cancellation."), " ", doc.cancellationPolicy), doc.forceMajeure && React.createElement("p", {
    style: {
      marginTop: 8
    }
  }, React.createElement("strong", null, "Force majeure."), " Neither party shall be liable for any failure or delay in performance to the extent caused by events beyond its reasonable control, including but not limited to acts of God, war, terrorism, pandemic, labor disputes, government action, export-control restrictions, or supply-chain disruption at an upstream OEM.", isOpen ? " Affected releases may be re-scheduled within the term by mutual written agreement." : ""), React.createElement("p", {
    style: {
      marginTop: 8
    }
  }, React.createElement("strong", null, "Governing law."), " This PO shall be governed by and construed in accordance with the laws of the ", doc.governingLaw, ", without regard to its conflict-of-laws principles.")), React.createElement(window.ShDocSection, {
    num: secSign,
    title: "Acceptance & signature"
  }, decided ? React.createElement("div", {
    className: `cn-qd-decided cn-qd-decided--${doc.status}`
  }, React.createElement("div", {
    className: "cn-qd-decided-icon"
  }, doc.status === "accepted" ? "✓" : "✕"), React.createElement("div", null, React.createElement("div", {
    className: "cn-qd-decided-title"
  }, doc.status === "accepted" ? "Accepted & signed" : "Declined"), doc.status === "accepted" && React.createElement("div", {
    className: "cn-qd-decided-sub"
  }, "Signed by ", React.createElement("strong", null, doc.buyerSignedName), doc.buyerSignedTitle ? `, ${doc.buyerSignedTitle}` : "", " on ", React.createElement("span", {
    className: "cn-mono"
  }, doc.buyerSignedDate), ", for the ", counterLabel, ". The other party has been notified."), doc.status === "declined" && doc.declineReason && React.createElement("div", {
    className: "cn-qd-decided-sub"
  }, "Reason: ", doc.declineReason))) : React.createElement(React.Fragment, null, !showDecline ? React.createElement(React.Fragment, null, React.createElement("p", {
    style: {
      marginBottom: 14,
      color: "var(--cn-ink-2)"
    }
  }, "By signing, the person named below confirms they are authorized to bind ", React.createElement("strong", null, edit.cName || `the ${counterLabel}`), " to this ", isOpen ? `Open PO for ${doc.contractQty} units of ${doc.partNumber || "the SKU above"} at ${shFmt(doc.unitPrice)} per unit, totaling ${shFmt(tot.contractValue)}` : `Purchase Order, totaling ${shFmt(lineTotal)}`, "."), React.createElement("div", {
    className: "cn-sh-fillable"
  }, React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Authorized signer ", React.createElement("span", {
    className: "cn-sh-req"
  }, "*")), React.createElement("input", {
    className: "cn-input",
    value: edit.signer,
    onChange: e => set({
      signer: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Title ", React.createElement("span", {
    className: "cn-sh-req"
  }, "*")), React.createElement("input", {
    className: "cn-input",
    value: edit.signerTitle,
    onChange: e => set({
      signerTitle: e.target.value
    })
  }))), React.createElement("label", {
    className: "cn-sh-check cn-sh-check--big"
  }, React.createElement("input", {
    type: "checkbox",
    checked: agreed,
    onChange: e => setAgreed(e.target.checked)
  }), "I agree to the terms of this ", isOpen ? "Open Purchase Order" : "Purchase Order", " and confirm authority to bind the ", counterLabel, ".")), React.createElement("div", {
    className: "cn-qd-decision-actions",
    style: {
      marginTop: 16
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setShowDecline(true)
  }, "Decline"), React.createElement("button", {
    className: "cn-btn cn-btn--win",
    onClick: accept
  }, "\u2713 Accept & sign"))) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Reason (optional)"), React.createElement("textarea", {
    className: "cn-textarea",
    value: reason,
    onChange: e => setReason(e.target.value),
    style: {
      minHeight: 70
    }
  })), React.createElement("div", {
    className: "cn-qd-decision-actions",
    style: {
      marginTop: 10
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => {
      setShowDecline(false);
      setReason("");
    }
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--lose",
    onClick: decline
  }, "Submit decline"))))), React.createElement("footer", {
    className: "cn-qd-foot"
  }, React.createElement("div", null, isOpen ? "Thank you for the long-term partnership." : "Thank you for your business."), React.createElement("div", {
    className: "cn-mono",
    style: {
      color: "var(--cn-mute)"
    }
  }, doc.docNumber, " \xB7 ", isOpen ? `effective ${doc.effectiveDate}` : `issued ${doc.issueDate}`))));
}
Object.assign(window, {
  ShPOBuilder,
  ShPOShareView
});