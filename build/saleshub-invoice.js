var {
  shNewId,
  shNewLine,
  shLineTotal,
  shDocTotal,
  shFmt,
  shTimeAgo,
  shToday,
  shAddDays
} = window.shHelpers;
function shInvoiceTotals(d) {
  var sub = shDocTotal(d);
  var tax = sub * (parseFloat(d.taxRate) || 0) / 100;
  var ship = parseFloat(d.shippingFee) || 0;
  var disc = parseFloat(d.discount) || 0;
  return {
    subtotal: sub,
    tax,
    shipping: ship,
    discount: disc,
    total: sub + tax + ship - disc
  };
}
window.shInvoiceTotals = shInvoiceTotals;
function ShInvoiceBuilder({
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
  var updateLine = (id, patch) => update({
    lineItems: d.lineItems.map(li => li.id === id ? {
      ...li,
      ...patch
    } : li)
  });
  var addLine = () => update({
    lineItems: [...d.lineItems, shNewLine()]
  });
  var removeLine = id => update({
    lineItems: d.lineItems.filter(li => li.id !== id)
  });
  var tot = shInvoiceTotals(d);
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
  }, "Invoice ", d.fromQuoteId && React.createElement("span", {
    style: {
      color: "var(--cn-copper)",
      marginLeft: 8
    }
  }, "\xB7 from quote")), React.createElement("h2", {
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
    kind: "invoice"
  }))), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body cn-quote-body"
  }, React.createElement("div", {
    className: "cn-quote-doc-edit"
  }, React.createElement("div", {
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
  }, React.createElement("label", null, "Due date"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: d.dueDate,
    onChange: e => update({
      dueDate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "PO / quote ref"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: d.poReference,
    onChange: e => update({
      poReference: e.target.value
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
  }, c))))), React.createElement(window.ShSectionHead, null, "1 \xB7 Bill to & Ship to"), React.createElement("div", {
    className: "cn-sh-twocol"
  }, React.createElement("div", {
    className: "cn-sh-party-card"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Bill to"), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Company"), React.createElement("input", {
    className: "cn-input",
    value: d.billToName,
    onChange: e => update({
      billToName: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Address"), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 70
    },
    value: d.billToAddress,
    onChange: e => update({
      billToAddress: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Attention"), React.createElement("input", {
    className: "cn-input",
    value: d.billToAttention,
    onChange: e => update({
      billToAttention: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Email (AP / billing)"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: d.billToEmail,
    onChange: e => update({
      billToEmail: e.target.value
    })
  })))), React.createElement("div", {
    className: "cn-sh-party-card"
  }, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, "Ship to", React.createElement("label", {
    className: "cn-sh-check",
    style: {
      marginLeft: "auto",
      fontSize: 11.5,
      fontWeight: 500
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: d.shipToSame,
    onChange: e => update({
      shipToSame: e.target.checked,
      ...(e.target.checked ? {
        shipToName: d.billToName,
        shipToAddress: d.billToAddress,
        shipToAttention: d.billToAttention
      } : {})
    })
  }), "Same as bill-to")), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Facility / company"), React.createElement("input", {
    className: "cn-input",
    value: d.shipToName,
    onChange: e => update({
      shipToName: e.target.value
    }),
    disabled: d.shipToSame
  })), React.createElement("div", {
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
    disabled: d.shipToSame
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Attention"), React.createElement("input", {
    className: "cn-input",
    value: d.shipToAttention,
    onChange: e => update({
      shipToAttention: e.target.value
    }),
    disabled: d.shipToSame
  })))), React.createElement(window.ShSectionHead, null, "2 \xB7 Line items"), React.createElement("table", {
    className: "cn-li-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Mfr Part Number"), React.createElement("th", {
    style: {
      width: 80
    }
  }, "Qty"), React.createElement("th", {
    style: {
      width: 140
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
  }))), React.createElement("tbody", null, d.lineItems.map(li => React.createElement(Fragment, {
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
    disabled: d.lineItems.length === 1
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
    placeholder: "Description / serials / notes (optional)"
  })), React.createElement("td", null)))))), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      marginTop: 10
    },
    onClick: addLine
  }, "+ Add line"), React.createElement("div", {
    className: "cn-sh-adj-grid"
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Tax rate (%)"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    step: "0.01",
    value: d.taxRate,
    onChange: e => update({
      taxRate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Shipping fee"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    step: "0.01",
    value: d.shippingFee,
    onChange: e => update({
      shippingFee: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Discount"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    step: "0.01",
    value: d.discount,
    onChange: e => update({
      discount: e.target.value
    })
  }))), React.createElement("div", {
    className: "cn-quote-totals"
  }, React.createElement("div", {
    className: "cn-quote-totals-row"
  }, React.createElement("span", null, "Subtotal"), React.createElement("span", {
    className: "cn-mono"
  }, shFmt(tot.subtotal))), tot.tax > 0 && React.createElement("div", {
    className: "cn-quote-totals-row"
  }, React.createElement("span", null, "Tax (", d.taxRate, "%)"), React.createElement("span", {
    className: "cn-mono"
  }, shFmt(tot.tax))), tot.shipping > 0 && React.createElement("div", {
    className: "cn-quote-totals-row"
  }, React.createElement("span", null, "Shipping"), React.createElement("span", {
    className: "cn-mono"
  }, shFmt(tot.shipping))), tot.discount > 0 && React.createElement("div", {
    className: "cn-quote-totals-row"
  }, React.createElement("span", null, "Discount"), React.createElement("span", {
    className: "cn-mono"
  }, "\u2212", shFmt(tot.discount))), React.createElement("div", {
    className: "cn-quote-totals-row cn-quote-totals-row--final"
  }, React.createElement("span", null, "Amount due"), React.createElement("span", {
    className: "cn-mono"
  }, shFmt(tot.total), " ", d.currency))), React.createElement(window.ShSectionHead, null, "3 \xB7 Payment"), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Payment terms"), React.createElement("input", {
    className: "cn-input",
    value: d.paymentTerms,
    onChange: e => update({
      paymentTerms: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Accepted methods ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 one per line")), React.createElement("textarea", {
    className: "cn-textarea",
    value: (d.paymentMethods || []).join("\n"),
    onChange: e => update({
      paymentMethods: e.target.value.split("\n").filter(x => x.trim())
    }),
    style: {
      minHeight: 70
    }
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Bank name"), React.createElement("input", {
    className: "cn-input",
    value: d.bankName,
    onChange: e => update({
      bankName: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "SWIFT / BIC"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: d.bankSwift,
    onChange: e => update({
      bankSwift: e.target.value
    })
  }))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Routing"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: d.bankRouting,
    onChange: e => update({
      bankRouting: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Account"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: d.bankAccount,
    onChange: e => update({
      bankAccount: e.target.value
    })
  }))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Notes for customer"), React.createElement("textarea", {
    className: "cn-textarea cn-textarea--rich",
    rows: 5,
    value: d.notes,
    onChange: e => update({
      notes: e.target.value
    }),
    placeholder: "Optional message or structured details. ALL CAPS lines become section headers, dashes render as bullets, and 'Label \u2014 value' lines align cleanly."
  })))), React.createElement("footer", {
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
  }, "Send invoice \u2192")))));
}
function ShInvoiceShareView({
  doc,
  onUpdate
}) {
  var tot = shInvoiceTotals(doc);
  var [showPay, setShowPay] = useState(false);
  var [method, setMethod] = useState(doc.paymentMethods && doc.paymentMethods[0] || "Wire transfer (USD)");
  var [ref, setRef] = useState("");
  var paid = doc.status === "paid";
  var markPaid = () => {
    if (!ref.trim()) {
      alert("Please enter the wire / ACH / check reference number.");
      return;
    }
    var merged = {
      ...doc,
      status: "paid",
      paidAt: new Date().toISOString(),
      paymentMethodUsed: method,
      paymentReference: ref.trim()
    };
    onUpdate({
      status: "paid",
      paidAt: new Date().toISOString(),
      paymentMethodUsed: method,
      paymentReference: ref.trim()
    });
    var shareUrl = window.location.href;
    var emailedTo = [];
    try {
      if (window.sendDocumentCopy) {
        window.sendDocumentCopy({
          kind: "invoice",
          doc: merged,
          shareUrl
        }).catch(() => {});
      }
      var fallback = [window.CN_SALES_INBOX, doc.billToEmail, doc.sellerEmail].filter(Boolean);
      emailedTo = Array.from(new Set(fallback));
    } catch {}
    try {
      var pending = JSON.parse(localStorage.getItem("cn-sh-pending") || "[]");
      pending.push({
        id: shNewId("ps"),
        kind: "invoice",
        docId: doc.id,
        docNumber: doc.docNumber,
        action: "paid",
        at: new Date().toISOString(),
        method,
        reference: ref.trim(),
        buyerName: doc.billToName,
        totalCents: Math.round(tot.total * 100),
        emailedTo,
        processed: false
      });
      localStorage.setItem("cn-sh-pending", JSON.stringify(pending));
    } catch {}
  };
  var overdue = !paid && new Date(doc.dueDate) < new Date(shToday());
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
  }, "Invoice \xB7 ", doc.docNumber)), React.createElement("div", {
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
  }, window.CN_BRAND && window.CN_BRAND.name || "Chief Negotiators"), doc.sellerAddress && React.createElement("div", {
    className: "cn-qd-tag"
  }, doc.sellerAddress.split("\n").slice(0, 2).join(" · ")), doc.sellerEIN && React.createElement("div", {
    className: "cn-qd-tag",
    style: {
      marginTop: 4
    }
  }, window.CN_BRAND && window.CN_BRAND.taxIdLabel || "EIN", ": ", React.createElement("span", {
    className: "cn-mono"
  }, doc.sellerEIN))), React.createElement("div", {
    className: "cn-qd-stamp"
  }, React.createElement("div", {
    className: "cn-qd-stamp-label"
  }, paid ? "PAID" : overdue ? "Overdue" : "Invoice"), React.createElement("div", {
    className: "cn-qd-stamp-num cn-mono"
  }, doc.docNumber), React.createElement("div", {
    className: "cn-qd-stamp-meta"
  }, React.createElement("div", null, React.createElement("span", null, "Issued"), React.createElement("span", {
    className: "cn-mono"
  }, doc.issueDate)), React.createElement("div", null, React.createElement("span", null, "Due"), React.createElement("span", {
    className: "cn-mono"
  }, doc.dueDate)), doc.poReference && React.createElement("div", null, React.createElement("span", null, "Ref"), React.createElement("span", {
    className: "cn-mono"
  }, doc.poReference))))), React.createElement("div", {
    className: "cn-qd-parties"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-qd-eyebrow"
  }, "Bill to"), React.createElement("div", {
    className: "cn-qd-party-name"
  }, doc.billToName), React.createElement("div", {
    className: "cn-qd-party-addr"
  }, doc.billToAddress), doc.billToAttention && React.createElement("div", {
    className: "cn-qd-party-attn"
  }, React.createElement("div", {
    className: "cn-qd-eyebrow",
    style: {
      marginTop: 10
    }
  }, "Attention"), doc.billToAttention, doc.billToEmail && React.createElement("span", {
    className: "cn-mono",
    style: {
      color: "var(--cn-mute)",
      marginLeft: 6
    }
  }, "\xB7 ", doc.billToEmail))), React.createElement("div", null, React.createElement("div", {
    className: "cn-qd-eyebrow"
  }, "Ship to"), React.createElement("div", {
    className: "cn-qd-party-name"
  }, doc.shipToSame ? doc.billToName : doc.shipToName), React.createElement("div", {
    className: "cn-qd-party-addr"
  }, doc.shipToSame ? doc.billToAddress : doc.shipToAddress), (doc.shipToSame ? doc.billToAttention : doc.shipToAttention) && React.createElement("div", {
    className: "cn-qd-party-attn"
  }, React.createElement("div", {
    className: "cn-qd-eyebrow",
    style: {
      marginTop: 10
    }
  }, "Receiver"), doc.shipToSame ? doc.billToAttention : doc.shipToAttention))), React.createElement("table", {
    className: "cn-qd-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Mfr Part Number"), React.createElement("th", {
    style: {
      width: 70,
      textAlign: "right"
    }
  }, "Qty"), React.createElement("th", {
    style: {
      width: 140
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
  }, "Total"))), React.createElement("tbody", null, doc.lineItems.map(li => React.createElement("tr", {
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
  }, shFmt(shLineTotal(li))))))), React.createElement("div", {
    className: "cn-sh-totals-strip"
  }, React.createElement("div", {
    className: "cn-sh-totals-grid"
  }, React.createElement("div", null, React.createElement("span", null, "Subtotal"), React.createElement("span", {
    className: "cn-mono"
  }, shFmt(tot.subtotal))), tot.tax > 0 && React.createElement("div", null, React.createElement("span", null, "Tax (", doc.taxRate, "%)"), React.createElement("span", {
    className: "cn-mono"
  }, shFmt(tot.tax))), tot.shipping > 0 && React.createElement("div", null, React.createElement("span", null, "Shipping"), React.createElement("span", {
    className: "cn-mono"
  }, shFmt(tot.shipping))), tot.discount > 0 && React.createElement("div", null, React.createElement("span", null, "Discount"), React.createElement("span", {
    className: "cn-mono"
  }, "\u2212", shFmt(tot.discount))), React.createElement("div", {
    className: "cn-sh-totals-final"
  }, React.createElement("span", null, "Amount due"), React.createElement("span", {
    className: "cn-mono"
  }, shFmt(tot.total), " ", doc.currency)))), React.createElement(window.ShDocSection, {
    num: "1",
    title: "Payment instructions"
  }, React.createElement("p", null, React.createElement("strong", null, "Terms:"), " ", doc.paymentTerms, " \xB7 Due ", React.createElement("span", {
    className: "cn-mono"
  }, doc.dueDate)), React.createElement("p", {
    style: {
      marginTop: 8
    }
  }, React.createElement("strong", null, "Accepted methods:"), " ", (doc.paymentMethods || []).join(" · ")), React.createElement("div", {
    className: "cn-sh-bank"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Bank"), React.createElement("div", null, doc.bankName)), React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "SWIFT/BIC"), React.createElement("div", {
    className: "cn-mono"
  }, doc.bankSwift)), React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Routing"), React.createElement("div", {
    className: "cn-mono"
  }, doc.bankRouting)), React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Account"), React.createElement("div", {
    className: "cn-mono"
  }, doc.bankAccount)), React.createElement("div", {
    style: {
      gridColumn: "1 / -1"
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Reference"), React.createElement("div", {
    className: "cn-mono"
  }, doc.docNumber))), React.createElement("p", {
    className: "cn-field-help",
    style: {
      marginTop: 10
    }
  }, "Please include the invoice number in your wire reference so we can match the payment.")), doc.notes && React.createElement(window.ShDocSection, {
    num: "2",
    title: "Notes"
  }, React.createElement(window.ShRichText, {
    text: doc.notes
  })), React.createElement(window.ShDocSection, {
    num: doc.notes ? "3" : "2",
    title: "Confirm payment"
  }, paid ? React.createElement("div", {
    className: "cn-qd-decided cn-qd-decided--accepted"
  }, React.createElement("div", {
    className: "cn-qd-decided-icon"
  }, "\u2713"), React.createElement("div", null, React.createElement("div", {
    className: "cn-qd-decided-title"
  }, "Marked paid"), React.createElement("div", {
    className: "cn-qd-decided-sub"
  }, "Paid via ", doc.paymentMethodUsed, " on ", React.createElement("span", {
    className: "cn-mono"
  }, doc.paidAt && doc.paidAt.slice(0, 10)), " \xB7 Ref ", React.createElement("span", {
    className: "cn-mono"
  }, doc.paymentReference), ". The seller has been notified."))) : !showPay ? React.createElement(React.Fragment, null, React.createElement("p", {
    style: {
      color: "var(--cn-ink-2)",
      marginBottom: 14
    }
  }, "Once you've sent the wire / ACH / check, mark this invoice paid so we can reconcile and release any holds."), React.createElement("div", {
    className: "cn-qd-decision-actions"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--win",
    onClick: () => setShowPay(true)
  }, "I've paid this invoice \u2192"))) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-sh-fillable"
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Payment method used ", React.createElement("span", {
    className: "cn-sh-req"
  }, "*")), React.createElement("select", {
    className: "cn-input",
    value: method,
    onChange: e => setMethod(e.target.value)
  }, (doc.paymentMethods || ["Wire", "ACH", "Check"]).map(m => React.createElement("option", {
    key: m,
    value: m
  }, m)))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Reference / confirmation number ", React.createElement("span", {
    className: "cn-sh-req"
  }, "*")), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: ref,
    onChange: e => setRef(e.target.value),
    placeholder: "Wire / ACH ID, check number, etc."
  }))), React.createElement("div", {
    className: "cn-qd-decision-actions",
    style: {
      marginTop: 14
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setShowPay(false)
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--win",
    onClick: markPaid
  }, "\u2713 Confirm paid")))), React.createElement("footer", {
    className: "cn-qd-foot"
  }, React.createElement("div", null, "Thank you for your business."), React.createElement("div", {
    className: "cn-mono",
    style: {
      color: "var(--cn-mute)"
    }
  }, doc.docNumber, " \xB7 issued ", doc.issueDate))));
}
Object.assign(window, {
  ShInvoiceBuilder,
  ShInvoiceShareView
});