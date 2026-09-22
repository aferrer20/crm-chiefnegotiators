var FIN_ACCT_TYPES = ["Checking", "Savings", "Credit card", "Cash", "Line of credit"];
var FIN_ACCT_COLORS = ["#B47148", "#3D6B47", "#2D2620", "#8B5535", "#A07A2A", "#5C6C80"];
function finBankCandidates(line) {
  var out = [];
  var inAmt = parseFloat(line.received) || 0;
  var outAmt = parseFloat(line.spent) || 0;
  if (inAmt > 0) {
    (window.cnFinance.finAllAr() || []).forEach(r => {
      var c = finArCompute(r);
      if (c.balance > 0) out.push({
        kind: "ar",
        id: r.id,
        label: (c.payer || "—") + " · " + (r.docNumber || r.recordNumber || c.type),
        amount: c.balance,
        exact: Math.abs(c.balance - inAmt) < 0.5
      });
    });
  } else {
    finRead("bills").forEach(b => {
      var c = finBillCompute(b);
      if (!c.isPaid) out.push({
        kind: "ap",
        id: b.id,
        label: (b.vendor || "—") + " · " + (b.billNumber || b.category || "bill"),
        amount: c.balance,
        exact: Math.abs(c.balance - outAmt) < 0.5
      });
    });
  }
  var target = inAmt || outAmt;
  out.sort((a, b) => b.exact - a.exact || Math.abs(a.amount - target) - Math.abs(b.amount - target));
  return out.slice(0, 8);
}
function FinBankSummaryCard({
  setTab
}) {
  var accs = finBankAccounts();
  if (!accs.length) {
    return React.createElement("section", {
      className: "cn-card cn-bank-empty-card"
    }, React.createElement("div", {
      className: "cn-bank-empty-inner"
    }, React.createElement("div", null, React.createElement("div", {
      className: "cn-card-eyebrow"
    }, "Bank"), React.createElement("h2", {
      className: "cn-card-title",
      style: {
        marginTop: 2
      }
    }, "Connect your accounts"), React.createElement("p", {
      className: "cn-bank-empty-copy"
    }, "Add your bank and credit-card accounts to track real cash \u2014 then reconcile statement lines against invoices and bills in a couple of clicks.")), React.createElement("button", {
      className: "cn-btn cn-btn--primary",
      onClick: () => setTab("bank")
    }, "Set up bank \u2192")));
  }
  var txns = finBankTxns();
  var unrec = txns.filter(t => t.status !== "reconciled").length;
  var total = accs.reduce((s, a) => s + finAccountBalance(a), 0);
  return React.createElement("section", {
    className: "cn-card cn-bank-sum"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Bank"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Cash across ", accs.length, " account", accs.length > 1 ? "s" : "")), React.createElement("button", {
    className: "cn-link",
    onClick: () => setTab("bank")
  }, unrec > 0 ? unrec + " to reconcile →" : "Open bank →")), React.createElement("div", {
    className: "cn-bank-sum-grid"
  }, accs.slice(0, 5).map(a => React.createElement("button", {
    key: a.id,
    className: "cn-bank-sum-tile",
    onClick: () => setTab("bank")
  }, React.createElement("span", {
    className: "cn-bank-sum-dot",
    style: {
      background: a.color || "var(--cn-copper)"
    }
  }), React.createElement("div", {
    className: "cn-bank-sum-name"
  }, a.name), React.createElement("div", {
    className: "cn-bank-sum-bal cn-mono"
  }, finFmt0(finAccountBalance(a))), React.createElement("div", {
    className: "cn-bank-sum-type"
  }, a.type || "Checking", a.institution ? " · " + a.institution : ""))), React.createElement("div", {
    className: "cn-bank-sum-tile cn-bank-sum-tile--total"
  }, React.createElement("div", {
    className: "cn-bank-sum-name"
  }, "Total cash"), React.createElement("div", {
    className: "cn-bank-sum-bal cn-mono"
  }, finFmt0(total)), React.createElement("div", {
    className: "cn-bank-sum-type"
  }, unrec > 0 ? React.createElement("span", {
    className: "cn-warn"
  }, unrec, " unreconciled") : React.createElement("span", {
    className: "cn-pos"
  }, "all reconciled")))));
}
function FinanceBank({
  refresh
}) {
  var [accId, setAccId] = useState(null);
  var [editAcc, setEditAcc] = useState(null);
  var [addLine, setAddLine] = useState(false);
  var [importOpen, setImportOpen] = useState(false);
  var [tick, setTick] = useState(0);
  var bump = () => {
    setTick(t => t + 1);
    refresh && refresh();
  };
  var accounts = useMemo(() => finBankAccounts(), [tick]);
  var account = accounts.find(a => a.id === accId) || null;
  var applyReconcile = (line, choice, category) => {
    var matchKind = "category",
      matchId = null,
      matchLabel = "";
    if (choice.indexOf("ar:") === 0) {
      var id = choice.slice(3);
      var rec = (window.cnFinance.finAllAr() || []).find(r => r.id === id);
      if (rec) {
        window.cnFinance.finSetArPayment(rec, {
          status: "paid",
          paidAt: new Date().toISOString(),
          paymentMethodUsed: "Bank",
          paymentReference: line.reference || ""
        });
        var c = finArCompute(rec);
        matchKind = "ar";
        matchId = id;
        matchLabel = c.payer || "Invoice";
      }
    } else if (choice.indexOf("ap:") === 0) {
      var _id = choice.slice(3);
      finWrite("bills", finRead("bills").map(b => b.id === _id ? {
        ...b,
        status: "paid",
        paidAt: new Date().toISOString()
      } : b));
      var b = finRead("bills").find(x => x.id === _id);
      matchKind = "ap";
      matchId = _id;
      matchLabel = b && b.vendor || "Bill";
    } else if (choice === "expense") {
      var exp = {
        id: FIN_ID("exp"),
        date: line.date,
        category: category || "Other",
        payee: line.payee || "Bank payment",
        amount: parseFloat(line.spent) || 0,
        recurring: "none",
        notes: "Reconciled from bank"
      };
      var l = finRead("expenses");
      l.unshift(exp);
      finWrite("expenses", l);
      matchKind = "expense";
      matchLabel = category || "Expense";
    } else if (choice === "income") {
      matchKind = "income";
      matchLabel = "Other income";
    } else if (choice === "transfer") {
      matchKind = "transfer";
      matchLabel = "Transfer";
    }
    finSaveTxn({
      ...line,
      status: "reconciled",
      matchKind,
      matchId,
      matchLabel,
      category: category || null
    });
    bump();
    window.cnToast && window.cnToast({
      title: "Reconciled",
      sub: (line.payee || "Statement line") + " · " + finFmt0(parseFloat(line.received) || 0 || parseFloat(line.spent) || 0)
    });
  };
  var unreconcile = line => {
    finSaveTxn({
      ...line,
      status: "unreconciled",
      matchKind: null,
      matchId: null,
      matchLabel: ""
    });
    bump();
  };
  var deleteLine = line => {
    finDeleteTxn(line.id);
    bump();
  };
  var saveAccount = acc => {
    finSaveAccount(acc);
    setEditAcc(null);
    bump();
  };
  var deleteAccount = id => {
    if (!confirm("Delete this account and all its statement lines? Reconciled invoices/bills stay paid.")) return;
    finDeleteAccount(id);
    setEditAcc(null);
    setAccId(null);
    bump();
  };
  var saveLines = lines => {
    lines.forEach(l => finSaveTxn(l));
    setAddLine(false);
    setImportOpen(false);
    bump();
  };
  if (!account) {
    if (!accounts.length) {
      return React.createElement("div", {
        className: "cn-fin-view"
      }, React.createElement("section", {
        className: "cn-card",
        style: {
          textAlign: "center",
          padding: "56px 32px"
        }
      }, React.createElement("div", {
        className: "cn-bank-bignum",
        style: {
          marginBottom: 14
        }
      }, "\u25A6"), React.createElement("h2", {
        className: "cn-card-title",
        style: {
          fontSize: 22
        }
      }, "No bank accounts yet"), React.createElement("p", {
        style: {
          color: "var(--cn-mute)",
          maxWidth: 440,
          margin: "10px auto 22px",
          fontSize: 13.5
        }
      }, "Add your operating account, savings and any credit cards. Then reconcile each statement line against an invoice, a bill, or a category \u2014 the way you would in any modern ledger."), React.createElement("button", {
        className: "cn-btn cn-btn--primary",
        onClick: () => setEditAcc("new")
      }, "+ Add bank account")), editAcc && React.createElement(FinBankAccountEditor, {
        acc: editAcc === "new" ? null : editAcc,
        onClose: () => setEditAcc(null),
        onSave: saveAccount,
        onDelete: deleteAccount
      }));
    }
    var total = accounts.reduce((s, a) => s + finAccountBalance(a), 0);
    var allUnrec = finBankTxns().filter(t => t.status !== "reconciled").length;
    return React.createElement("div", {
      className: "cn-fin-view"
    }, React.createElement("section", {
      className: "cn-fin-strip"
    }, React.createElement("div", {
      className: "cn-fin-stat cn-fin-stat--plain"
    }, React.createElement("div", {
      className: "cn-fin-stat-label"
    }, "Total cash"), React.createElement("div", {
      className: "cn-fin-stat-val cn-mono"
    }, finFmt0(total)), React.createElement("div", {
      className: "cn-fin-stat-sub"
    }, accounts.length, " account", accounts.length > 1 ? "s" : "")), React.createElement("div", {
      className: "cn-fin-stat cn-fin-stat--plain"
    }, React.createElement("div", {
      className: "cn-fin-stat-label"
    }, "To reconcile"), React.createElement("div", {
      className: "cn-fin-stat-val cn-mono",
      style: {
        color: allUnrec > 0 ? "var(--cn-warn)" : "var(--cn-pos)"
      }
    }, allUnrec), React.createElement("div", {
      className: "cn-fin-stat-sub"
    }, "statement lines")), React.createElement("div", {
      className: "cn-fin-stat cn-fin-stat--plain"
    }, React.createElement("div", {
      className: "cn-fin-stat-label"
    }, "Statement lines"), React.createElement("div", {
      className: "cn-fin-stat-val cn-mono"
    }, finBankTxns().length), React.createElement("div", {
      className: "cn-fin-stat-sub"
    }, "across all accounts")), React.createElement("div", {
      className: "cn-fin-stat cn-fin-stat--plain"
    }, React.createElement("div", {
      className: "cn-fin-stat-label"
    }, "Reconciled"), React.createElement("div", {
      className: "cn-fin-stat-val cn-mono",
      style: {
        color: "var(--cn-pos)"
      }
    }, finBankTxns().filter(t => t.status === "reconciled").length), React.createElement("div", {
      className: "cn-fin-stat-sub"
    }, "matched & cleared"))), React.createElement("div", {
      className: "cn-toolbar",
      style: {
        marginTop: 4
      }
    }, React.createElement("div", null, React.createElement("div", {
      className: "cn-card-eyebrow"
    }, "Accounts"), React.createElement("h2", {
      className: "cn-card-title",
      style: {
        margin: "2px 0 0"
      }
    }, "Your cash, by account")), React.createElement("button", {
      className: "cn-btn cn-btn--primary",
      onClick: () => setEditAcc("new")
    }, "+ Add account")), React.createElement("div", {
      className: "cn-bank-acct-grid"
    }, accounts.map(a => {
      var unrec = finBankTxns(a.id).filter(t => t.status !== "reconciled").length;
      return React.createElement("button", {
        key: a.id,
        className: "cn-bank-acct-card",
        onClick: () => setAccId(a.id)
      }, React.createElement("div", {
        className: "cn-bank-acct-top"
      }, React.createElement("span", {
        className: "cn-bank-acct-chip",
        style: {
          background: a.color || "var(--cn-copper)"
        }
      }, (a.type || "C").slice(0, 1)), React.createElement("div", null, React.createElement("div", {
        className: "cn-bank-acct-name"
      }, a.name), React.createElement("div", {
        className: "cn-bank-acct-meta"
      }, a.type || "Checking", a.institution ? " · " + a.institution : ""))), React.createElement("div", {
        className: "cn-bank-acct-bal cn-mono"
      }, finFmt0(finAccountBalance(a))), React.createElement("div", {
        className: "cn-bank-acct-foot"
      }, unrec > 0 ? React.createElement("span", {
        className: "cn-q-pill cn-q-sent"
      }, unrec, " to reconcile") : React.createElement("span", {
        className: "cn-q-pill cn-q-accepted"
      }, "Reconciled"), React.createElement("span", {
        className: "cn-link"
      }, "Open \u2192")));
    })), editAcc && React.createElement(FinBankAccountEditor, {
      acc: editAcc === "new" ? null : editAcc,
      onClose: () => setEditAcc(null),
      onSave: saveAccount,
      onDelete: deleteAccount
    }));
  }
  var txns = finBankTxns(account.id).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  var unrecLines = txns.filter(t => t.status !== "reconciled");
  var recLines = txns.filter(t => t.status === "reconciled");
  var balance = finAccountBalance(account);
  var recBalance = finAccountReconciled(account);
  return React.createElement("div", {
    className: "cn-fin-view"
  }, React.createElement("div", {
    className: "cn-bank-detail-head"
  }, React.createElement("button", {
    className: "cn-link",
    onClick: () => setAccId(null)
  }, "\u2190 All accounts"), React.createElement("div", {
    className: "cn-bank-detail-title"
  }, React.createElement("span", {
    className: "cn-bank-acct-chip",
    style: {
      background: account.color || "var(--cn-copper)"
    }
  }, (account.type || "C").slice(0, 1)), React.createElement("div", null, React.createElement("h2", {
    className: "cn-card-title",
    style: {
      margin: 0
    }
  }, account.name), React.createElement("div", {
    className: "cn-bank-acct-meta"
  }, account.type || "Checking", account.institution ? " · " + account.institution : ""))), React.createElement("div", {
    className: "cn-bank-detail-actions"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setImportOpen(true)
  }, "Import lines"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setAddLine(true)
  }, "+ Statement line"), React.createElement("button", {
    className: "cn-icon-btn",
    title: "Edit account",
    onClick: () => setEditAcc(account)
  }, "\u2699"))), React.createElement("section", {
    className: "cn-fin-strip"
  }, React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Statement balance"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(balance)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "opening ", finFmt0(parseFloat(account.openingBalance) || 0), " + activity")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Reconciled balance"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: "var(--cn-pos)"
    }
  }, finFmt0(recBalance)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "cleared in the books")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "To reconcile"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: unrecLines.length ? "var(--cn-warn)" : "var(--cn-pos)"
    }
  }, unrecLines.length), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "lines waiting")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Unreconciled diff"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(balance - recBalance)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "statement \u2212 books"))), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Reconcile"), React.createElement("h2", {
    className: "cn-card-title"
  }, unrecLines.length ? `${unrecLines.length} statement line${unrecLines.length > 1 ? "s" : ""} to clear` : "Nothing to reconcile"))), unrecLines.length === 0 ? React.createElement("div", {
    className: "cn-fin-empty",
    style: {
      padding: 30
    }
  }, "\u2713 This account is fully reconciled. Add or import new statement lines to keep going.") : React.createElement("div", {
    className: "cn-recon-list"
  }, unrecLines.map(line => React.createElement(BankReconcileRow, {
    key: line.id,
    line: line,
    onReconcile: applyReconcile,
    onDelete: deleteLine
  })))), recLines.length > 0 && React.createElement("section", {
    className: "cn-card cn-card--flush"
  }, React.createElement("div", {
    className: "cn-card-head",
    style: {
      padding: "16px 18px 0"
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Cleared"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Reconciled history"))), React.createElement("table", {
    className: "cn-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Date"), React.createElement("th", null, "Description"), React.createElement("th", null, "Matched to"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Spent"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Received"), React.createElement("th", null))), React.createElement("tbody", null, recLines.map(t => {
    var isIn = (parseFloat(t.received) || 0) > 0;
    return React.createElement("tr", {
      key: t.id
    }, React.createElement("td", {
      className: "cn-cell-secondary"
    }, finDateLabel(t.date)), React.createElement("td", {
      className: "cn-cell-primary",
      style: {
        fontWeight: 400
      }
    }, t.payee || "—", t.reference && React.createElement("span", {
      className: "cn-cell-secondary cn-mono"
    }, " \xB7 ", t.reference)), React.createElement("td", null, React.createElement("span", {
      className: `cn-recon-chip cn-recon-chip--${t.matchKind || "category"}`
    }, t.matchLabel || "Categorised")), React.createElement("td", {
      className: "cn-mono",
      style: {
        textAlign: "right",
        color: isIn ? "var(--cn-mute-2)" : "var(--cn-neg)"
      }
    }, isIn ? "—" : finFmt0(parseFloat(t.spent) || 0)), React.createElement("td", {
      className: "cn-mono",
      style: {
        textAlign: "right",
        color: isIn ? "var(--cn-pos)" : "var(--cn-mute-2)"
      }
    }, isIn ? finFmt0(parseFloat(t.received) || 0) : "—"), React.createElement("td", {
      style: {
        textAlign: "right"
      }
    }, React.createElement("button", {
      className: "cn-link cn-cell-secondary",
      onClick: () => unreconcile(t)
    }, "Undo")));
  })))), editAcc && React.createElement(FinBankAccountEditor, {
    acc: editAcc === "new" ? null : editAcc,
    onClose: () => setEditAcc(null),
    onSave: saveAccount,
    onDelete: deleteAccount
  }), addLine && React.createElement(FinBankTxnEditor, {
    accountId: account.id,
    onClose: () => setAddLine(false),
    onSave: saveLines
  }), importOpen && React.createElement(FinBankImport, {
    accountId: account.id,
    onClose: () => setImportOpen(false),
    onSave: saveLines
  }));
}
function BankReconcileRow({
  line,
  onReconcile,
  onDelete
}) {
  var isIn = (parseFloat(line.received) || 0) > 0;
  var amt = isIn ? parseFloat(line.received) || 0 : parseFloat(line.spent) || 0;
  var cands = useMemo(() => finBankCandidates(line), [line]);
  var best = cands.find(c => c.exact) || null;
  var [choice, setChoice] = useState(best ? best.kind + ":" + best.id : "");
  var [cat, setCat] = useState(FIN_OPEX_CATS[0]);
  return React.createElement("div", {
    className: `cn-recon-row ${best ? "has-match" : ""}`
  }, React.createElement("div", {
    className: "cn-recon-left"
  }, React.createElement("div", {
    className: "cn-recon-date cn-mono"
  }, finDateLabel(line.date)), React.createElement("div", {
    className: "cn-recon-desc"
  }, React.createElement("div", {
    className: "cn-recon-payee"
  }, line.payee || "Statement line"), line.reference && React.createElement("div", {
    className: "cn-recon-ref cn-mono"
  }, line.reference)), React.createElement("div", {
    className: `cn-recon-amt cn-mono ${isIn ? "cn-pos" : ""}`
  }, isIn ? "+" : "−", finFmt0(amt))), React.createElement("div", {
    className: "cn-recon-arrow"
  }, "\u2192"), React.createElement("div", {
    className: "cn-recon-right"
  }, React.createElement("select", {
    className: "cn-input cn-recon-select",
    value: choice,
    onChange: e => setChoice(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "Choose a match\u2026"), cands.length > 0 && React.createElement("optgroup", {
    label: isIn ? "Open invoices" : "Open bills"
  }, cands.map(c => React.createElement("option", {
    key: c.kind + c.id,
    value: c.kind + ":" + c.id
  }, c.label, " \xB7 ", finFmt0(c.amount), c.exact ? "  ✓ exact" : ""))), React.createElement("optgroup", {
    label: "Or categorise"
  }, isIn ? React.createElement("option", {
    value: "income"
  }, "Other income") : React.createElement("option", {
    value: "expense"
  }, "Expense\u2026"), React.createElement("option", {
    value: "transfer"
  }, "Transfer between accounts"))), choice === "expense" && React.createElement("select", {
    className: "cn-input cn-recon-cat",
    value: cat,
    onChange: e => setCat(e.target.value)
  }, FIN_OPEX_CATS.map(c => React.createElement("option", {
    key: c
  }, c))), React.createElement("button", {
    className: "cn-recon-ok",
    disabled: !choice,
    onClick: () => onReconcile(line, choice, cat)
  }, "OK"), React.createElement("button", {
    className: "cn-icon-btn cn-recon-del",
    title: "Delete line",
    onClick: () => onDelete(line)
  }, "\u2715")));
}
function FinBankAccountEditor({
  acc,
  onClose,
  onSave,
  onDelete
}) {
  var today = finISO(finToday());
  var [d, setD] = useState(acc || {
    id: FIN_ID("acct"),
    name: "",
    type: "Checking",
    institution: "",
    openingBalance: 0,
    openingDate: today,
    color: FIN_ACCT_COLORS[0]
  });
  var up = patch => setD({
    ...d,
    ...patch
  });
  var valid = (d.name || "").trim().length > 0;
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
  }, acc ? "Edit account" : "New bank account"), React.createElement("h2", {
    className: "cn-modal-title"
  }, d.name || "Bank account")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.5
    }
  }, React.createElement("label", null, "Account name"), React.createElement("input", {
    className: "cn-input",
    value: d.name,
    onChange: e => up({
      name: e.target.value
    }),
    placeholder: "Operating \xB7 Chase 1234",
    autoFocus: true
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Type"), React.createElement("select", {
    className: "cn-input",
    value: d.type,
    onChange: e => up({
      type: e.target.value
    })
  }, FIN_ACCT_TYPES.map(t => React.createElement("option", {
    key: t
  }, t))))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.5
    }
  }, React.createElement("label", null, "Institution ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 optional")), React.createElement("input", {
    className: "cn-input",
    value: d.institution,
    onChange: e => up({
      institution: e.target.value
    }),
    placeholder: "Chase, Mercury, Amex\u2026"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Opening balance"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    step: "0.01",
    value: d.openingBalance,
    onChange: e => up({
      openingBalance: e.target.value
    })
  }))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Opening date"), React.createElement("input", {
    className: "cn-input",
    type: "date",
    value: d.openingDate,
    onChange: e => up({
      openingDate: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.5
    }
  }, React.createElement("label", null, "Colour"), React.createElement("div", {
    className: "cn-bank-swatches"
  }, FIN_ACCT_COLORS.map(c => React.createElement("button", {
    key: c,
    type: "button",
    className: `cn-bank-swatch ${d.color === c ? "is-active" : ""}`,
    style: {
      background: c
    },
    onClick: () => up({
      color: c
    })
  })))))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, acc ? React.createElement("button", {
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
      openingBalance: parseFloat(d.openingBalance) || 0
    }),
    disabled: !valid
  }, acc ? "Save account" : "Add account")))));
}
function FinBankTxnEditor({
  accountId,
  onClose,
  onSave
}) {
  var today = finISO(finToday());
  var [d, setD] = useState({
    date: today,
    payee: "",
    reference: "",
    dir: "out",
    amount: 0
  });
  var up = patch => setD({
    ...d,
    ...patch
  });
  var valid = (parseFloat(d.amount) || 0) > 0;
  var submit = () => {
    var amt = parseFloat(d.amount) || 0;
    onSave([{
      id: FIN_ID("btx"),
      accountId,
      date: d.date,
      payee: d.payee,
      reference: d.reference,
      spent: d.dir === "out" ? amt : 0,
      received: d.dir === "in" ? amt : 0,
      status: "unreconciled",
      matchKind: null,
      matchId: null,
      matchLabel: ""
    }]);
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
      width: 480
    }
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "New statement line"), React.createElement("h2", {
    className: "cn-modal-title"
  }, "Bank transaction")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-segmented cn-segmented--full",
    style: {
      marginBottom: 16
    }
  }, React.createElement("button", {
    className: d.dir === "out" ? "is-active" : "",
    onClick: () => up({
      dir: "out"
    })
  }, "Money out"), React.createElement("button", {
    className: d.dir === "in" ? "is-active" : "",
    onClick: () => up({
      dir: "in"
    })
  }, "Money in")), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
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
  }, React.createElement("label", null, "Amount"), React.createElement("input", {
    className: "cn-input cn-mono",
    type: "number",
    min: "0",
    step: "0.01",
    value: d.amount,
    onChange: e => up({
      amount: e.target.value
    }),
    autoFocus: true
  }))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Description / payee"), React.createElement("input", {
    className: "cn-input",
    value: d.payee,
    onChange: e => up({
      payee: e.target.value
    }),
    placeholder: "Who the money went to / came from"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Reference ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 optional")), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: d.reference,
    onChange: e => up({
      reference: e.target.value
    }),
    placeholder: "Wire #, memo\u2026"
  }))), React.createElement("footer", {
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
    onClick: submit,
    disabled: !valid
  }, "Add line")))));
}
var finImpPad = n => String(n).padStart(2, "0");
function finImpDate(raw, fmt) {
  raw = (raw || "").trim().replace(/^["']|["']$/g, "");
  if (!raw) return null;
  var m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${finImpPad(m[2])}-${finImpPad(m[3])}`;
  m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    var a = +m[1],
      b = +m[2],
      y = m[3];
    if (y.length === 2) y = "20" + y;
    var mo, da;
    if (fmt === "dmy") {
      da = a;
      mo = b;
    } else {
      mo = a;
      da = b;
    }
    if (mo > 12 && da <= 12) {
      var t = mo;
      mo = da;
      da = t;
    }
    return `${y}-${finImpPad(mo)}-${finImpPad(da)}`;
  }
  var d = new Date(raw);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}
function finParseOFX(text) {
  var out = [];
  var blocks = text.split(/<STMTTRN>/i).slice(1);
  blocks.forEach(b => {
    var seg = b.split(/<\/STMTTRN>/i)[0];
    var get = tag => {
      var mm = seg.match(new RegExp("<" + tag + ">([^<\\r\\n]*)", "i"));
      return mm ? mm[1].trim() : "";
    };
    var amt = parseFloat(get("TRNAMT")) || 0;
    out.push({
      rawDate: get("DTPOSTED"),
      desc: get("NAME") || get("MEMO") || get("PAYEE") || "Transaction",
      ref: get("FITID"),
      amt
    });
  });
  return out;
}
function finDetectDelim(line) {
  var counts = [[",", (line.match(/,/g) || []).length], ["\t", (line.match(/\t/g) || []).length], [";", (line.match(/;/g) || []).length]];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}
function finSplitCSV(line, delim) {
  var res = [];
  var cur = "",
    q = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else {
      if (ch === '"') q = true;else if (ch === delim) {
        res.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  res.push(cur);
  return res.map(s => s.trim());
}
var finImpNum = s => parseFloat((s || "").replace(/[()]/g, m => m === "(" ? "-" : "").replace(/[^0-9.\-]/g, "")) || 0;
var finColMatch = (headers, re) => headers.findIndex(h => re.test((h || "").toLowerCase()));
function FinBankImport({
  accountId,
  onClose,
  onSave
}) {
  var [text, setText] = useState("");
  var [fileName, setFileName] = useState("");
  var [dateFmt, setDateFmt] = useState("mdy");
  var [flip, setFlip] = useState(false);
  var [map, setMap] = useState(null);
  var [drag, setDrag] = useState(false);
  var loadFile = file => {
    if (!file) return;
    setFileName(file.name);
    var reader = new FileReader();
    reader.onload = e => {
      setText(String(e.target.result || ""));
      setMap(null);
    };
    reader.readAsText(file);
  };
  var onDrop = e => {
    e.preventDefault();
    setDrag(false);
    loadFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  };
  var detect = useMemo(() => {
    var t = text.trim();
    if (!t) return {
      format: "empty"
    };
    if (/<OFX>|<STMTTRN>/i.test(t)) return {
      format: "ofx"
    };
    var lines = t.split(/\r?\n/).filter(l => l.trim());
    var delim = finDetectDelim(lines[0] || "");
    var rows = lines.map(l => finSplitCSV(l, delim));
    var first = rows[0] || [];
    var looksHeader = first.some(c => /date|desc|payee|amount|debit|credit|balance|memo|withdraw|deposit/i.test(c)) && !first.some(c => /^\d{4}-\d/.test(c));
    var headers = looksHeader ? first : first.map((_, i) => "Column " + (i + 1));
    var dataRows = looksHeader ? rows.slice(1) : rows;
    return {
      format: "csv",
      delim,
      headers,
      dataRows
    };
  }, [text]);
  var autoMap = useMemo(() => {
    if (detect.format !== "csv") return null;
    var h = detect.headers;
    var debit = finColMatch(h, /debit|withdrawal|paid out|money out|payment/);
    var credit = finColMatch(h, /credit|deposit|paid in|money in/);
    return {
      date: Math.max(0, finColMatch(h, /date|posted/)),
      desc: Math.max(0, finColMatch(h, /desc|payee|name|memo|detail|narrat|reference|transaction/)),
      amount: finColMatch(h, /^amount$|amount|value/),
      debit,
      credit,
      mode: debit >= 0 && credit >= 0 ? "split" : "single"
    };
  }, [detect]);
  var m = map || autoMap;
  var parsed = useMemo(() => {
    if (detect.format === "ofx") {
      return finParseOFX(text).map(r => {
        var amt = r.amt;
        if (flip) amt = -amt;
        return {
          date: finImpDate(r.rawDate, dateFmt),
          desc: r.desc,
          ref: r.ref || "",
          spent: amt < 0 ? Math.abs(amt) : 0,
          received: amt > 0 ? amt : 0
        };
      }).map(r => ({
        ...r,
        valid: !!r.date && (r.spent > 0 || r.received > 0)
      }));
    }
    if (detect.format === "csv" && m) {
      return detect.dataRows.map(cells => {
        var date = finImpDate(cells[m.date], dateFmt);
        var desc = (cells[m.desc] || "").trim() || "Transaction";
        var spent = 0,
          received = 0;
        if (m.mode === "split") {
          spent = Math.abs(finImpNum(cells[m.debit]));
          received = Math.abs(finImpNum(cells[m.credit]));
        } else {
          var amt = finImpNum(cells[m.amount >= 0 ? m.amount : 0]);
          if (flip) amt = -amt;
          if (amt < 0) spent = Math.abs(amt);else received = amt;
        }
        return {
          date,
          desc,
          ref: "",
          spent,
          received,
          valid: !!date && (spent > 0 || received > 0)
        };
      });
    }
    return [];
  }, [detect, m, text, dateFmt, flip]);
  var existing = useMemo(() => finBankTxns(accountId), [accountId]);
  var isDup = p => existing.some(t => t.date === p.date && (t.payee || "").toLowerCase() === p.desc.toLowerCase() && (parseFloat(t.spent) || 0) === p.spent && (parseFloat(t.received) || 0) === p.received);
  var good = parsed.filter(p => p.valid);
  var fresh = good.filter(p => !isDup(p));
  var dupCount = good.length - fresh.length;
  var submit = () => {
    onSave(fresh.map(p => ({
      id: FIN_ID("btx"),
      accountId,
      date: p.date,
      payee: p.desc,
      reference: p.ref || "",
      spent: p.spent,
      received: p.received,
      status: "unreconciled",
      matchKind: null,
      matchId: null,
      matchLabel: ""
    })));
  };
  var colSelect = (key, label, allowNone) => React.createElement("label", {
    className: "cn-imp-mapcol"
  }, React.createElement("span", null, label), React.createElement("select", {
    className: "cn-input",
    value: m ? m[key] : -1,
    onChange: e => setMap({
      ...m,
      [key]: parseInt(e.target.value, 10)
    })
  }, allowNone && React.createElement("option", {
    value: -1
  }, "\u2014"), detect.headers.map((h, i) => React.createElement("option", {
    key: i,
    value: i
  }, h))));
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
      width: 660
    }
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Import statement"), React.createElement("h2", {
    className: "cn-modal-title"
  }, "Import from your bank")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("p", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12.5,
      margin: "0 0 12px",
      lineHeight: 1.55
    }
  }, "Export a statement from your online banking \u2014 ", React.createElement("strong", null, "CSV"), ", ", React.createElement("strong", null, "OFX"), ", ", React.createElement("strong", null, "QFX"), " or ", React.createElement("strong", null, "QBO"), " all work \u2014 then drop the file here. Columns are detected automatically. (Or paste rows below.)"), React.createElement("label", {
    className: `cn-imp-drop ${drag ? "is-drag" : ""}`,
    onDragOver: e => {
      e.preventDefault();
      setDrag(true);
    },
    onDragLeave: () => setDrag(false),
    onDrop: onDrop
  }, React.createElement("input", {
    type: "file",
    accept: ".csv,.ofx,.qfx,.qbo,.txt,text/csv",
    style: {
      display: "none"
    },
    onChange: e => loadFile(e.target.files && e.target.files[0])
  }), React.createElement("span", {
    className: "cn-imp-drop-glyph"
  }, "\u2B73"), React.createElement("span", {
    className: "cn-imp-drop-main"
  }, fileName ? fileName : "Drop a statement file, or click to choose"), React.createElement("span", {
    className: "cn-imp-drop-sub"
  }, "CSV \xB7 OFX \xB7 QFX \xB7 QBO")), React.createElement("details", {
    className: "cn-imp-paste"
  }, React.createElement("summary", null, "or paste rows"), React.createElement("textarea", {
    className: "cn-input cn-mono",
    style: {
      width: "100%",
      minHeight: 110,
      fontSize: 12.5,
      resize: "vertical",
      marginTop: 8
    },
    value: text,
    onChange: e => {
      setText(e.target.value);
      setFileName("");
      setMap(null);
    },
    placeholder: "Date, Description, Amount\n2026-06-01, ACH from Dell, 12500\n2026-06-02, AWS invoice, -1840"
  })), detect.format !== "empty" && React.createElement("div", {
    className: "cn-imp-controls"
  }, React.createElement("span", {
    className: `cn-imp-badge cn-imp-badge--${detect.format}`
  }, detect.format === "ofx" ? "OFX / QFX detected" : "CSV detected"), detect.format === "csv" && m && React.createElement(Fragment, null, colSelect("date", "Date"), colSelect("desc", "Description"), React.createElement("label", {
    className: "cn-imp-mapcol"
  }, React.createElement("span", null, "Amounts"), React.createElement("select", {
    className: "cn-input",
    value: m.mode,
    onChange: e => setMap({
      ...m,
      mode: e.target.value
    })
  }, React.createElement("option", {
    value: "single"
  }, "Single column"), React.createElement("option", {
    value: "split"
  }, "Debit + Credit"))), m.mode === "single" ? colSelect("amount", "Amount") : React.createElement(Fragment, null, colSelect("debit", "Money out", true), colSelect("credit", "Money in", true)))), detect.format !== "empty" && React.createElement("div", {
    className: "cn-imp-toggles"
  }, React.createElement("label", {
    className: "cn-imp-toggle"
  }, React.createElement("span", null, "Date order"), React.createElement("div", {
    className: "cn-segmented"
  }, React.createElement("button", {
    className: dateFmt === "mdy" ? "is-active" : "",
    onClick: () => setDateFmt("mdy")
  }, "US \xB7 M/D/Y"), React.createElement("button", {
    className: dateFmt === "dmy" ? "is-active" : "",
    onClick: () => setDateFmt("dmy")
  }, "D/M/Y"))), React.createElement("label", {
    className: "cn-imp-flip"
  }, React.createElement("input", {
    type: "checkbox",
    checked: flip,
    onChange: e => setFlip(e.target.checked)
  }), " Flip +/\u2212 (my bank shows spending as positive)")), good.length > 0 && React.createElement("div", {
    className: "cn-bank-import-preview"
  }, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginBottom: 6
    }
  }, fresh.length, " new line", fresh.length !== 1 ? "s" : "", " ready", dupCount > 0 && React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0
    }
  }, " \xB7 ", dupCount, " duplicate", dupCount !== 1 ? "s" : "", " skipped")), React.createElement("div", {
    className: "cn-bank-import-rows"
  }, good.slice(0, 7).map((p, i) => React.createElement("div", {
    key: i,
    className: `cn-bank-import-row ${isDup(p) ? "is-bad" : ""}`
  }, React.createElement("span", {
    className: "cn-mono"
  }, p.date || "?"), React.createElement("span", {
    className: "cn-bank-import-desc"
  }, p.desc || "—", isDup(p) && React.createElement("span", {
    className: "cn-cell-secondary"
  }, " \xB7 already imported")), React.createElement("span", {
    className: "cn-mono",
    style: {
      color: p.received > 0 ? "var(--cn-pos)" : "var(--cn-neg)"
    }
  }, p.received > 0 ? "+" + finFmt0(p.received) : "−" + finFmt0(p.spent)))), good.length > 7 && React.createElement("div", {
    className: "cn-cell-secondary",
    style: {
      fontSize: 12
    }
  }, "+ ", good.length - 7, " more\u2026"))), detect.format !== "empty" && good.length === 0 && React.createElement("div", {
    className: "cn-fin-empty",
    style: {
      padding: 16,
      fontSize: 12.5
    }
  }, "No transactions read yet \u2014 check the column mapping or date order above.")), React.createElement("footer", {
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
    onClick: submit,
    disabled: !fresh.length
  }, "Import ", fresh.length || "", " line", fresh.length !== 1 ? "s" : "")))));
}
Object.assign(window, {
  FinanceBank,
  FinBankSummaryCard,
  BankReconcileRow,
  FinBankAccountEditor,
  FinBankTxnEditor,
  FinBankImport,
  finBankCandidates
});