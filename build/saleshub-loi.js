var {
  shNewId,
  shToken,
  shNewLine,
  shLineTotal,
  shDocTotal,
  shFmt,
  shTimeAgo,
  shToday,
  shAddDays,
  shOtherRole,
  shRoleLabel
} = window.shHelpers;
function ShLOIBuilder({
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
    var next = {
      ...d,
      ...patch
    };
    setD(next);
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
  var total = shDocTotal(d);
  var deposit = total * (parseFloat(d.depositPct) || 0) / 100;
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
  }, "Letter of Intent"), React.createElement("h2", {
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
    kind: "loi"
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
  }, React.createElement("label", null, "Valid through"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: d.expiresDate,
    onChange: e => update({
      expiresDate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Nature"), React.createElement("select", {
    className: "cn-input",
    value: d.bindingNature,
    onChange: e => update({
      bindingNature: e.target.value
    })
  }, React.createElement("option", {
    value: "non-binding"
  }, "Non-binding"), React.createElement("option", {
    value: "binding"
  }, "Binding"))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Target delivery"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: d.targetDelivery,
    onChange: e => update({
      targetDelivery: e.target.value
    })
  }))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Subject / Title"), React.createElement("input", {
    className: "cn-input",
    value: d.subject,
    onChange: e => update({
      subject: e.target.value
    }),
    placeholder: "e.g. H200 GPU cluster procurement \u2014 Phase 1"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Purpose"), React.createElement("textarea", {
    className: "cn-textarea cn-textarea--rich",
    rows: 6,
    value: d.purpose,
    onChange: e => update({
      purpose: e.target.value
    }),
    placeholder: "Describe what this LOI covers. You can paste structured specs:\n\nINFRASTRUCTURE COMPONENT SPECIFICATION\nCOMPUTE LAYER\n\nHGX GPU Nodes — HGX GPU Servers Per Rack — Qty: 4\n..."
  })), React.createElement(ShSectionHead, null, "1 \xB7 Parties"), React.createElement("div", {
    className: "cn-sh-ctrlbar"
  }, React.createElement(window.ShRoleToggle, {
    doc: d,
    update: update
  }), React.createElement("div", {
    className: "cn-sh-ctrl-help"
  }, (d.ourRole || "seller") === "seller" ? "We're selling. The Buyer fields are filled and signed by the customer from the share link." : "We're buying. The Seller fields are filled and signed by the counterparty from the share link.")), React.createElement("div", {
    className: "cn-sh-twocol"
  }, React.createElement(window.ShPartyCard, {
    role: "seller",
    doc: d,
    update: update,
    mine: (d.ourRole || "seller") === "seller"
  }), React.createElement(window.ShPartyCard, {
    role: "buyer",
    doc: d,
    update: update,
    mine: (d.ourRole || "seller") === "buyer"
  })), React.createElement(ShSectionHead, null, "2 \xB7 Products & pricing"), React.createElement("table", {
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
  }, React.createElement("span", null, "Total intended purchase"), React.createElement("span", {
    className: "cn-mono"
  }, shFmt(total), " ", d.currency))), React.createElement(ShSectionHead, null, "3 \xB7 Shipping destination"), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("label", {
    className: "cn-sh-check"
  }, React.createElement("input", {
    type: "checkbox",
    checked: d.shipToSame,
    onChange: e => update({
      shipToSame: e.target.checked,
      ...(e.target.checked ? {
        shipToName: d.buyerName,
        shipToAddress: d.buyerAddress,
        shipToAttention: d.buyerContactName
      } : {})
    })
  }), "Ship to buyer's billing address")), !d.shipToSame && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Ship-to company / facility"), React.createElement("input", {
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
  }, React.createElement("label", null, "Attention / receiver"), React.createElement("input", {
    className: "cn-input",
    value: d.shipToAttention,
    onChange: e => update({
      shipToAttention: e.target.value
    }),
    placeholder: "Who signs at receiving"
  }))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Ship-to address"), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 70
    },
    value: d.shipToAddress,
    onChange: e => update({
      shipToAddress: e.target.value
    }),
    placeholder: "Full delivery address"
  }))), React.createElement("div", {
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
    }),
    placeholder: "e.g. Air freight, white-glove, LTL"
  }))), React.createElement(ShSectionHead, null, "4 \xB7 Commercial terms"), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Currency"), React.createElement("select", {
    className: "cn-input",
    value: d.currency,
    onChange: e => update({
      currency: e.target.value
    })
  }, ["USD", "EUR", "GBP", "CAD", "AUD"].map(c => React.createElement("option", {
    key: c,
    value: c
  }, c)))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Deposit (%)"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    max: "100",
    step: "5",
    value: d.depositPct,
    onChange: e => update({
      depositPct: e.target.value
    })
  }), React.createElement("div", {
    className: "cn-field-help"
  }, "\u2248 ", shFmt(deposit), " due on PO issuance"))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Payment terms"), React.createElement("textarea", {
    className: "cn-textarea",
    value: d.paymentTerms,
    onChange: e => update({
      paymentTerms: e.target.value
    })
  })), React.createElement(ShSectionHead, null, "5 \xB7 Legal provisions"), React.createElement("div", {
    className: "cn-field-row",
    style: {
      flexWrap: "wrap"
    }
  }, React.createElement("label", {
    className: "cn-sh-check"
  }, React.createElement("input", {
    type: "checkbox",
    checked: d.exclusivity,
    onChange: e => update({
      exclusivity: e.target.checked
    })
  }), " Exclusivity period"), d.exclusivity && React.createElement("div", {
    className: "cn-field",
    style: {
      flex: "0 0 160px"
    }
  }, React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    step: "1",
    value: d.exclusivityDays,
    onChange: e => update({
      exclusivityDays: e.target.value
    })
  }), React.createElement("div", {
    className: "cn-field-help"
  }, "days of exclusive negotiation")), React.createElement("label", {
    className: "cn-sh-check"
  }, React.createElement("input", {
    type: "checkbox",
    checked: d.confidentiality,
    onChange: e => update({
      confidentiality: e.target.checked
    })
  }), " Mutual NDA (MNDA)"), React.createElement("label", {
    className: "cn-sh-check"
  }, React.createElement("input", {
    type: "checkbox",
    checked: d.nonCircumvent !== false,
    onChange: e => update({
      nonCircumvent: e.target.checked
    })
  }), " Non-circumvent")), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Governing law"), React.createElement("input", {
    className: "cn-input",
    value: d.governingLaw,
    onChange: e => update({
      governingLaw: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Conditions precedent"), React.createElement("textarea", {
    className: "cn-textarea",
    value: d.conditionsPrecedent,
    onChange: e => update({
      conditionsPrecedent: e.target.value
    }),
    placeholder: "What must happen before this becomes binding"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Termination clause"), React.createElement("textarea", {
    className: "cn-textarea",
    value: d.terminationClause,
    onChange: e => update({
      terminationClause: e.target.value
    })
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
  }, "Send LOI \u2192")))));
}
function ShSectionHead({
  children
}) {
  return React.createElement("div", {
    className: "cn-sh-sec-head"
  }, React.createElement("div", {
    className: "cn-sh-sec-bar"
  }), React.createElement("span", null, children));
}
window.ShSectionHead = ShSectionHead;
function ShLOIShareView({
  doc,
  onUpdate
}) {
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
    shipToSame: doc.shipToSame,
    shipToName: doc.shipToName || "",
    shipToAddress: doc.shipToAddress || "",
    shipToAttention: doc.shipToAttention || "",
    notes: doc.counterNotes || ""
  });
  var [agreed, setAgreed] = useState(false);
  var [signing, setSigning] = useState(false);
  var [showDecline, setShowDecline] = useState(false);
  var [reason, setReason] = useState("");
  var [editParty, setEditParty] = useState(false);
  var counterPrefilled = !!(doc[cf.name] && String(doc[cf.name]).trim());
  var set = patch => setEdit(prev => ({
    ...prev,
    ...patch
  }));
  var decided = doc.status === "accepted" || doc.status === "declined";
  var total = shDocTotal(doc);
  var deposit = total * (parseFloat(doc.depositPct) || 0) / 100;
  var counterPatch = () => ({
    [cf.name]: edit.cName,
    [cf.address]: edit.cAddress,
    [cf.taxId]: edit.cTaxId,
    [cf.contactName]: edit.cContactName,
    [cf.contactEmail]: edit.cContactEmail,
    [cf.contactPhone]: edit.cContactPhone,
    counterNotes: edit.notes,
    ...(counterFillsShipTo ? {
      shipToSame: edit.shipToSame,
      shipToName: edit.shipToName,
      shipToAddress: edit.shipToAddress,
      shipToAttention: edit.shipToAttention
    } : {})
  });
  var accept = async () => {
    if (signing) return;
    if (!edit.cName.trim() || !edit.signer.trim() || !edit.signerTitle.trim()) {
      alert("Please fill in your legal company name, signing authority, and title.");
      return;
    }
    if (!agreed) {
      alert("Please tick the box to confirm you agree to the terms.");
      return;
    }
    var today = shToday();
    var patch = {
      ...counterPatch(),
      buyerSignedName: edit.signer,
      buyerSignedTitle: edit.signerTitle,
      buyerSignedDate: today,
      status: "accepted",
      decidedAt: new Date().toISOString()
    };
    var merged = {
      ...doc,
      ...patch
    };
    if (window.publishSharedDoc) {
      setSigning(true);
      var res;
      try {
        res = await window.publishSharedDoc({
          kind: "loi",
          doc: merged
        });
      } catch (e) {
        res = {
          ok: false,
          error: String(e)
        };
      }
      setSigning(false);
      if (!res || res.ok === false) {
        alert("We couldn't submit your signature just now — please check your connection and try again.\n\nNothing has been sent and the document is not yet signed.");
        return;
      }
    }
    onUpdate(patch);
    var shareUrl = window.location.href;
    var emailedTo = [];
    try {
      if (window.sendDocumentCopy) {
        window.sendDocumentCopy({
          kind: "loi",
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
        kind: "loi",
        docId: doc.id,
        docNumber: doc.docNumber,
        action: "accepted",
        at: new Date().toISOString(),
        signedBy: edit.signer,
        buyerName: edit.cName,
        totalCents: Math.round(total * 100),
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
        kind: "loi",
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
    }),
    placeholder: "Street, city, state, ZIP, country"
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
  var CounterBlock = () => {
    if (!counterPrefilled || editParty) return React.createElement(FillParty, null);
    return React.createElement(React.Fragment, null, React.createElement("div", {
      className: "cn-qd-eyebrow"
    }, counterLabel, " ", React.createElement("span", {
      style: {
        textTransform: "none",
        letterSpacing: 0,
        color: "var(--cn-mute)",
        fontWeight: 400
      }
    }, "\xB7 your details")), React.createElement("div", {
      className: "cn-sh-party"
    }, React.createElement("strong", null, edit.cName || "—")), edit.cAddress ? React.createElement("div", {
      className: "cn-sh-party-addr"
    }, edit.cAddress) : null, React.createElement("div", {
      style: {
        fontSize: 13,
        marginTop: 6
      }
    }, edit.cTaxId ? React.createElement(React.Fragment, null, "Tax ID: ", React.createElement("span", {
      className: "cn-mono"
    }, edit.cTaxId), React.createElement("br", null)) : null, edit.cContactName ? React.createElement(React.Fragment, null, "Contact: ", edit.cContactName, edit.cContactEmail ? React.createElement(React.Fragment, null, " \xB7 ", React.createElement("span", {
      className: "cn-mono",
      style: {
        color: "var(--cn-mute)"
      }
    }, edit.cContactEmail)) : null, edit.cContactPhone ? " · " + edit.cContactPhone : "") : null), React.createElement("button", {
      className: "cn-link",
      style: {
        marginTop: 8,
        fontSize: 12.5
      },
      onClick: () => setEditParty(true)
    }, "Not right? Edit your details"));
  };
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
  }, "LOI \xB7 ", doc.docNumber)), React.createElement("div", {
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
  }, window.CN_BRAND && window.CN_BRAND.docTagline || "Procurement & Sourcing", " \xB7 Letter of Intent")), React.createElement("div", {
    className: "cn-qd-stamp"
  }, React.createElement("div", {
    className: "cn-qd-stamp-label"
  }, doc.bindingNature === "binding" ? "Binding LOI" : "Non-binding LOI"), React.createElement("div", {
    className: "cn-qd-stamp-num cn-mono"
  }, doc.docNumber), React.createElement("div", {
    className: "cn-qd-stamp-meta"
  }, React.createElement("div", null, React.createElement("span", null, "Issued"), React.createElement("span", {
    className: "cn-mono"
  }, doc.issueDate)), React.createElement("div", null, React.createElement("span", null, "Valid through"), React.createElement("span", {
    className: "cn-mono"
  }, doc.expiresDate))))), React.createElement("section", {
    className: "cn-sh-preamble"
  }, React.createElement("p", null, "This Letter of Intent (the \u201CLOI\u201D), dated ", React.createElement("span", {
    className: "cn-mono"
  }, doc.issueDate), ", sets forth the principal terms upon which ", React.createElement("strong", null, doc.sellerName || "the Seller"), " (\u201CSeller\u201D) and ", React.createElement("strong", null, doc.buyerName || "the Buyer"), " (\u201CBuyer\u201D) intend to enter into a definitive purchase agreement for the products described below. The ", counterLabel, " below is the undersigned party. Unless otherwise stated, this LOI is ", React.createElement("strong", null, doc.bindingNature === "binding" ? "legally binding" : "non-binding"), " on the parties, except that Sections covering MNDA, non-circumvent, exclusivity and governing law are binding regardless.")), React.createElement(ShDocSection, {
    num: "1",
    title: "Parties"
  }, React.createElement("div", {
    className: "cn-sh-twocol"
  }, React.createElement("div", null, counterRole === "seller" && !decided ? React.createElement(CounterBlock, null) : React.createElement(StaticParty, {
    role: "seller"
  })), React.createElement("div", null, counterRole === "buyer" && !decided ? React.createElement(CounterBlock, null) : React.createElement(StaticParty, {
    role: "buyer"
  })))), React.createElement(ShDocSection, {
    num: "2",
    title: "Subject & purpose"
  }, React.createElement("p", null, React.createElement("strong", null, doc.subject || "—")), React.createElement("div", {
    style: {
      marginTop: 6,
      color: "var(--cn-ink-2)"
    }
  }, React.createElement(window.ShRichText, {
    text: doc.purpose
  }))), React.createElement(ShDocSection, {
    num: "3",
    title: "Products & intended pricing"
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
  }, shFmt(shLineTotal(li)))))), React.createElement("tfoot", null, React.createElement("tr", null, React.createElement("td", {
    colSpan: 4,
    style: {
      textAlign: "right"
    }
  }, "Total intended purchase"), React.createElement("td", {
    className: "cn-mono cn-qd-grand",
    style: {
      textAlign: "right"
    }
  }, shFmt(total), " ", doc.currency))))), React.createElement(ShDocSection, {
    num: "4",
    title: "Shipping destination"
  }, !decided && counterFillsShipTo ? React.createElement("div", {
    className: "cn-sh-fillable"
  }, React.createElement("label", {
    className: "cn-sh-check",
    style: {
      marginBottom: 10
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: edit.shipToSame,
    onChange: e => set({
      shipToSame: e.target.checked
    })
  }), "Ship to my company's billing address (above)"), !edit.shipToSame && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Ship-to facility"), React.createElement("input", {
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
  }, React.createElement("label", null, "Attention / receiver"), React.createElement("input", {
    className: "cn-input",
    value: edit.shipToAttention,
    onChange: e => set({
      shipToAttention: e.target.value
    }),
    placeholder: "Who signs at receiving"
  }))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Full ship-to address"), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 70
    },
    value: edit.shipToAddress,
    onChange: e => set({
      shipToAddress: e.target.value
    }),
    placeholder: "Street, city, state, ZIP, country"
  })))) : React.createElement(React.Fragment, null, doc.shipToSame ? React.createElement("p", null, "Ship to buyer's address of record (above).") : React.createElement(React.Fragment, null, React.createElement("p", null, React.createElement("strong", null, doc.shipToName), doc.shipToAttention ? ` · Attn: ${doc.shipToAttention}` : ""), React.createElement("p", {
    className: "cn-sh-party-addr"
  }, doc.shipToAddress))), React.createElement("p", {
    style: {
      marginTop: 10
    }
  }, React.createElement("strong", null, "Incoterms:"), " ", React.createElement("span", {
    className: "cn-mono"
  }, doc.incoterms), " \xA0\xB7\xA0", React.createElement("strong", null, "Method:"), " ", doc.shipMethod, " \xA0\xB7\xA0", React.createElement("strong", null, "Target delivery:"), " ", React.createElement("span", {
    className: "cn-mono"
  }, doc.targetDelivery))), React.createElement(ShDocSection, {
    num: "5",
    title: "Commercial terms"
  }, React.createElement("p", null, React.createElement("strong", null, "Deposit:"), " ", doc.depositPct, "% (", shFmt(deposit), " ", doc.currency, ") due upon issuance of definitive Purchase Order."), React.createElement("p", {
    style: {
      marginTop: 6
    }
  }, React.createElement("strong", null, "Payment terms:"), " ", doc.paymentTerms)), React.createElement(ShDocSection, {
    num: "6",
    title: "Legal provisions"
  }, doc.exclusivity && React.createElement("p", null, React.createElement("strong", null, "Exclusivity."), " For a period of ", React.createElement("span", {
    className: "cn-mono"
  }, doc.exclusivityDays), " days from the date hereof, Buyer shall negotiate exclusively with Seller regarding the subject matter of this LOI and shall not solicit or accept competing offers from other suppliers for substantially equivalent goods."), doc.confidentiality && React.createElement("p", {
    style: {
      marginTop: 8
    }
  }, React.createElement("strong", null, "Mutual Non-Disclosure (MNDA)."), " Each party shall treat the existence and contents of this LOI, and any non-public information exchanged in connection herewith, as strictly confidential, and shall not disclose the same to any third party except (i) to its employees, advisors and lenders on a need-to-know basis under equivalent confidentiality obligations, or (ii) as required by law. This obligation survives termination of this LOI for a period of two (2) years."), doc.nonCircumvent !== false && React.createElement("p", {
    style: {
      marginTop: 8
    }
  }, React.createElement("strong", null, "Non-circumvent."), " Each party agrees that, for a period of twenty-four (24) months from the date hereof, it shall not directly or indirectly contact, transact with, or solicit any manufacturer, distributor, supplier, vendor, broker, or other source introduced by the other party in connection with the products contemplated by this LOI for the purpose of bypassing that party. Any such circumvention entitles the introducing party to the commercial margin it would have earned on the bypassed transaction, plus reasonable legal fees."), React.createElement("p", {
    style: {
      marginTop: 8
    }
  }, React.createElement("strong", null, "Conditions precedent."), " ", doc.conditionsPrecedent), React.createElement("p", {
    style: {
      marginTop: 8
    }
  }, React.createElement("strong", null, "Termination."), " ", doc.terminationClause), React.createElement("p", {
    style: {
      marginTop: 8
    }
  }, React.createElement("strong", null, "Governing law."), " This LOI shall be governed by and construed in accordance with the laws of the ", doc.governingLaw, ", without regard to its conflict-of-laws principles."), React.createElement("p", {
    style: {
      marginTop: 8
    }
  }, React.createElement("strong", null, "Nature."), " Except for the provisions on MNDA, Non-circumvent, Exclusivity and Governing law (which are binding), this LOI is ", doc.bindingNature === "binding" ? "binding on the parties." : "an expression of mutual intent only and is not a binding contract; a definitive purchase agreement is required to create binding obligations regarding the sale of goods.")), React.createElement(ShDocSection, {
    num: "7",
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
  }, "Reason: ", doc.declineReason), doc.status === "accepted" && doc.counterNotes && React.createElement("div", {
    className: "cn-qd-decided-sub",
    style: {
      marginTop: 6
    }
  }, "Additional information: ", doc.counterNotes))) : React.createElement(React.Fragment, null, !showDecline ? React.createElement(React.Fragment, null, React.createElement("p", {
    style: {
      marginBottom: 14,
      color: "var(--cn-ink-2)"
    }
  }, "Sign below to indicate your acceptance of the terms above. By accepting, the person named confirms they are authorized to bind the ", counterLabel, " to this LOI."), React.createElement("div", {
    className: "cn-sh-fillable",
    style: {
      marginBottom: 14
    }
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Additional information / special instructions ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      fontWeight: 400
    }
  }, "(optional)")), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 70
    },
    value: edit.notes,
    onChange: e => set({
      notes: e.target.value
    }),
    placeholder: "Anything we should know \u2014 PO references, delivery windows, receiving contacts, etc."
  }))), React.createElement("div", {
    className: "cn-sh-fillable"
  }, React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Authorized signer (full legal name) ", React.createElement("span", {
    className: "cn-sh-req"
  }, "*")), React.createElement("input", {
    className: "cn-input",
    value: edit.signer,
    onChange: e => set({
      signer: e.target.value
    }),
    placeholder: "e.g. Jane Smith"
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
    }),
    placeholder: "e.g. Chief Procurement Officer"
  }))), React.createElement("label", {
    className: "cn-sh-check cn-sh-check--big"
  }, React.createElement("input", {
    type: "checkbox",
    checked: agreed,
    onChange: e => setAgreed(e.target.checked)
  }), "I have authority to bind ", React.createElement("strong", null, edit.cName || `the ${counterLabel}`), " and I agree to the terms of this Letter of Intent.")), React.createElement("div", {
    className: "cn-qd-decision-actions",
    style: {
      marginTop: 16
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setShowDecline(true),
    disabled: signing
  }, "Decline"), React.createElement("button", {
    className: "cn-btn cn-btn--win",
    onClick: accept,
    disabled: signing
  }, signing ? "Submitting…" : "✓ Accept & sign"))) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Reason for declining (optional)"), React.createElement("textarea", {
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
  }, React.createElement("div", null, "Thank you for the opportunity."), React.createElement("div", {
    className: "cn-mono",
    style: {
      color: "var(--cn-mute)"
    }
  }, doc.docNumber, " \xB7 ", doc.issueDate))));
}
function ShDocSection({
  num,
  title,
  children
}) {
  return React.createElement("section", {
    className: "cn-sh-doc-sec"
  }, React.createElement("h3", null, React.createElement("span", {
    className: "cn-sh-doc-num"
  }, num), React.createElement("span", {
    dangerouslySetInnerHTML: {
      __html: title
    }
  })), React.createElement("div", {
    className: "cn-sh-doc-sec-body"
  }, children));
}
window.ShDocSection = ShDocSection;
Object.assign(window, {
  ShLOIBuilder,
  ShLOIShareView
});