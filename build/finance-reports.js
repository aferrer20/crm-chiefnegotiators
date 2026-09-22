var FIN_AGE_BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"];
var FIN_AGE_LABELS = {
  "current": "Current",
  "1-30": "1–30",
  "31-60": "31–60",
  "61-90": "61–90",
  "90+": "90+ days"
};
function FinanceReports(props) {
  var [report, setReport] = useState(null);
  var groups = [{
    title: "Financial statements",
    items: [{
      id: "pnl",
      glyph: "▤",
      name: "Profit & Loss",
      desc: "Revenue, cost of sales and operating expenses down to net income."
    }, {
      id: "balance",
      glyph: "▦",
      name: "Balance Sheet",
      desc: "What you own and owe — assets, liabilities and equity at a point in time."
    }, {
      id: "cash",
      glyph: "◇",
      name: "Cash flow forecast",
      desc: "Projected cash position over the next 12 weeks and 90-day ledger."
    }]
  }, {
    title: "Receivables & payables",
    items: [{
      id: "agedar",
      glyph: "◖",
      name: "Aged Receivables",
      desc: "Everything you're owed, bucketed by how overdue it is, per customer."
    }, {
      id: "agedap",
      glyph: "◗",
      name: "Aged Payables",
      desc: "Everything you owe, bucketed by due date, per supplier."
    }]
  }, {
    title: "Tax",
    items: [{
      id: "tax",
      glyph: "％",
      name: "Tax summary",
      desc: "Sales tax to remit and a recommended income-tax set-aside."
    }]
  }];
  if (report) {
    var map = {
      pnl: window.FinancePnL,
      balance: FinanceBalanceSheet,
      cash: window.FinanceCashFlow,
      agedar: FinanceAgedReceivables,
      agedap: FinanceAgedPayables,
      tax: window.FinanceTax
    };
    var Cmp = map[report];
    var name = groups.flatMap(g => g.items).find(i => i.id === report).name;
    return React.createElement("div", {
      className: "cn-fin-view"
    }, React.createElement("div", {
      className: "cn-rep-back"
    }, React.createElement("button", {
      className: "cn-link",
      onClick: () => setReport(null)
    }, "\u2190 All reports"), React.createElement("span", {
      className: "cn-bc-sep"
    }, "/"), React.createElement("span", {
      className: "cn-rep-back-name"
    }, name)), Cmp ? React.createElement(Cmp, props) : React.createElement("div", {
      className: "cn-fin-empty"
    }, "Report unavailable."));
  }
  return React.createElement("div", {
    className: "cn-fin-view"
  }, React.createElement("div", {
    style: {
      padding: "2px 2px 0"
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Reports"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      margin: "2px 0 0"
    }
  }, "Every number, on demand"), React.createElement("p", {
    style: {
      color: "var(--cn-mute)",
      margin: "6px 0 0",
      fontSize: 13.5
    }
  }, "The standard statements a director reviews \u2014 built live off your receivables, payables, expenses and bank.")), groups.map(g => React.createElement("section", {
    key: g.title,
    className: "cn-rep-group"
  }, React.createElement("div", {
    className: "cn-rep-group-title"
  }, g.title), React.createElement("div", {
    className: "cn-rep-grid"
  }, g.items.map(it => React.createElement("button", {
    key: it.id,
    className: "cn-rep-card",
    onClick: () => setReport(it.id)
  }, React.createElement("span", {
    className: "cn-rep-glyph"
  }, it.glyph), React.createElement("div", {
    className: "cn-rep-card-body"
  }, React.createElement("div", {
    className: "cn-rep-card-name"
  }, it.name), React.createElement("div", {
    className: "cn-rep-card-desc"
  }, it.desc)), React.createElement("span", {
    className: "cn-rep-card-go"
  }, "\u2192")))))));
}
function FinanceBalanceSheet({
  ar,
  bills,
  expenses,
  settings
}) {
  var a = useMemo(() => finAggregate(ar, bills, expenses, settings), [ar, bills, expenses, settings]);
  var bankCash = finBankCash();
  var cash = bankCash != null ? bankCash : a.cashOnHand;
  var accounts = finBankAccounts();
  var ar_ = a.arOutstanding;
  var totalCurrentAssets = cash + ar_;
  var totalAssets = totalCurrentAssets;
  var ap = a.apOutstanding;
  var salesTaxPayable = a.taxCollected + a.taxAccrued;
  var incomeTaxPayable = Math.max(0, a.netProfit) * (parseFloat(settings.incomeTaxRate) || 0) / 100;
  var totalLiabilities = ap + salesTaxPayable + incomeTaxPayable;
  var equity = totalAssets - totalLiabilities;
  var ownerFunds = parseFloat(settings.openingCash) || 0;
  var retained = equity - ownerFunds;
  var currentRatio = totalLiabilities > 0 ? totalCurrentAssets / totalLiabilities : null;
  var workingCapital = totalCurrentAssets - totalLiabilities;
  var balanced = Math.abs(totalAssets - (totalLiabilities + equity)) < 1;
  var today = finToday();
  var Row = ({
    label,
    val,
    kind,
    sub
  }) => React.createElement("div", {
    className: `cn-bs-row ${kind || ""}`
  }, React.createElement("span", {
    className: "cn-bs-label"
  }, label, sub && React.createElement("span", {
    className: "cn-bs-sub"
  }, " ", sub)), React.createElement("span", {
    className: "cn-bs-val cn-mono"
  }, finFmt0(val)));
  return React.createElement("div", {
    className: "cn-fin-view"
  }, React.createElement("div", {
    className: "cn-toolbar",
    style: {
      marginTop: 2
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Balance sheet"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      margin: "2px 0 0"
    }
  }, "As at ", finDateLabel(today))), React.createElement("div", {
    className: "cn-legend"
  }, React.createElement("span", {
    className: balanced ? "cn-pos" : "cn-neg",
    style: {
      fontSize: 12.5,
      fontWeight: 600
    }
  }, balanced ? "✓ Balances" : "Out of balance"))), React.createElement("div", {
    className: "cn-grid-2"
  }, React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-bs"
  }, React.createElement("div", {
    className: "cn-bs-section"
  }, "Assets"), React.createElement("div", {
    className: "cn-bs-sub-section"
  }, "Current assets"), React.createElement(Row, {
    label: accounts.length ? `Cash at bank · ${accounts.length} account${accounts.length > 1 ? "s" : ""}` : "Cash & cash equivalents",
    val: cash
  }), React.createElement(Row, {
    label: "Accounts receivable",
    val: ar_,
    sub: ar_ === 0 ? "— nothing outstanding" : ""
  }), React.createElement(Row, {
    label: "Total current assets",
    val: totalCurrentAssets,
    kind: "total"
  }), React.createElement(Row, {
    label: "Total assets",
    val: totalAssets,
    kind: "grand"
  }), React.createElement("div", {
    className: "cn-bs-section"
  }, "Liabilities"), React.createElement("div", {
    className: "cn-bs-sub-section"
  }, "Current liabilities"), React.createElement(Row, {
    label: "Accounts payable",
    val: ap
  }), React.createElement(Row, {
    label: "Sales tax payable",
    val: salesTaxPayable,
    sub: salesTaxPayable === 0 ? "— no taxable resale" : ""
  }), React.createElement(Row, {
    label: `Income tax set-aside (${settings.incomeTaxRate || 0}%)`,
    val: incomeTaxPayable
  }), React.createElement(Row, {
    label: "Total liabilities",
    val: totalLiabilities,
    kind: "total"
  }), React.createElement("div", {
    className: "cn-bs-section"
  }, "Equity"), React.createElement(Row, {
    label: "Owner's funds introduced",
    val: ownerFunds,
    sub: ownerFunds === 0 ? "— set opening cash in Settings" : ""
  }), React.createElement(Row, {
    label: "Retained earnings",
    val: retained,
    sub: "incl. current period"
  }), React.createElement(Row, {
    label: "Total equity",
    val: equity,
    kind: "total"
  }), React.createElement(Row, {
    label: "Liabilities + equity",
    val: totalLiabilities + equity,
    kind: "grand"
  }))), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 18
    }
  }, React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Composition"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Assets = Liabilities + Equity"))), React.createElement(FinBalanceBars, {
    cash: cash,
    ar: ar_,
    ap: ap,
    tax: salesTaxPayable + incomeTaxPayable,
    equity: equity,
    totalAssets: totalAssets
  })), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Health checks"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Solvency at a glance"))), React.createElement("div", {
    className: "cn-fin-metrics"
  }, React.createElement("div", {
    className: "cn-fin-metric"
  }, React.createElement("span", null, "Current ratio"), React.createElement("strong", {
    className: "cn-mono",
    style: {
      color: currentRatio != null && currentRatio < 1 ? "var(--cn-neg)" : "var(--cn-pos)"
    }
  }, currentRatio != null ? currentRatio.toFixed(2) + "×" : "—")), React.createElement("div", {
    className: "cn-fin-metric"
  }, React.createElement("span", null, "Working capital"), React.createElement("strong", {
    className: "cn-mono",
    style: {
      color: workingCapital < 0 ? "var(--cn-neg)" : "inherit"
    }
  }, finFmt0(workingCapital))), React.createElement("div", {
    className: "cn-fin-metric"
  }, React.createElement("span", null, "Cash as % of assets"), React.createElement("strong", {
    className: "cn-mono"
  }, totalAssets > 0 ? (cash / totalAssets * 100).toFixed(0) : 0, "%")), React.createElement("div", {
    className: "cn-fin-metric"
  }, React.createElement("span", null, "Debt-to-equity"), React.createElement("strong", {
    className: "cn-mono"
  }, equity > 0 ? (totalLiabilities / equity).toFixed(2) : "—"))), React.createElement("p", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 11.5,
      margin: "12px 0 0",
      lineHeight: 1.5
    }
  }, "A working management balance sheet from your live ledger \u2014 cash from bank accounts, receivables and payables from open invoices and bills. Not a substitute for a closed-book statement.")))));
}
function FinBalanceBars({
  cash,
  ar,
  ap,
  tax,
  equity,
  totalAssets
}) {
  var max = Math.max(1, totalAssets);
  var seg = (label, val, cls) => React.createElement("div", {
    className: "cn-bs-bar-seg-row"
  }, React.createElement("span", {
    className: "cn-bs-bar-label"
  }, React.createElement("i", {
    className: `cn-fin-dot ${cls}`
  }), label), React.createElement("span", {
    className: "cn-bs-bar-track"
  }, React.createElement("span", {
    className: `cn-bs-bar-fill ${cls}`,
    style: {
      width: `${Math.max(0, val) / max * 100}%`
    }
  })), React.createElement("span", {
    className: "cn-bs-bar-val cn-mono"
  }, finFmt0(val)));
  return React.createElement("div", {
    className: "cn-bs-bars"
  }, React.createElement("div", {
    className: "cn-bs-bar-group-title"
  }, "Assets"), seg("Cash at bank", cash, "is-cash"), seg("Receivables", ar, "is-ar"), React.createElement("div", {
    className: "cn-bs-bar-group-title",
    style: {
      marginTop: 12
    }
  }, "Claims on those assets"), seg("Payables", ap, "is-ap"), seg("Tax owed", tax, "is-tax"), seg("Equity", equity, "is-eq"));
}
function FinanceAgedReceivables() {
  var rows = useMemo(() => (window.cnFinance.finAllAr() || []).map(r => ({
    raw: r,
    c: finArCompute(r)
  })).filter(x => x.c.balance > 0), []);
  return React.createElement(FinAgedReport, {
    rows: rows,
    who: x => x.c.payer || "—",
    title: "Aged Receivables",
    eyebrow: "What you're owed",
    label: "customer",
    empty: "Nothing outstanding \u2014 every invoice is collected.",
    tone: "ar"
  });
}
function FinanceAgedPayables({
  bills
}) {
  var rows = useMemo(() => (bills || finRead("bills")).map(b => ({
    raw: b,
    c: finBillCompute(b)
  })).filter(x => !x.c.isPaid && x.c.balance > 0), [bills]);
  return React.createElement(FinAgedReport, {
    rows: rows,
    who: x => x.raw.vendor || "—",
    title: "Aged Payables",
    eyebrow: "What you owe",
    label: "supplier",
    empty: "No open bills \u2014 you're all paid up.",
    tone: "ap"
  });
}
function FinAgedReport({
  rows,
  who,
  title,
  eyebrow,
  label,
  empty,
  tone
}) {
  var today = finToday();
  var byContact = {};
  rows.forEach(x => {
    var k = who(x);
    if (!byContact[k]) {
      byContact[k] = {
        current: 0,
        "1-30": 0,
        "31-60": 0,
        "61-90": 0,
        "90+": 0,
        total: 0,
        count: 0
      };
    }
    byContact[k][x.c.bucket] += x.c.balance;
    byContact[k].total += x.c.balance;
    byContact[k].count += 1;
  });
  var contacts = Object.entries(byContact).sort((a, b) => b[1].total - a[1].total);
  var totals = {
    current: 0,
    "1-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
    total: 0
  };
  contacts.forEach(([, v]) => FIN_AGE_BUCKETS.forEach(b => {
    totals[b] += v[b];
    totals.total += 0;
  }));
  FIN_AGE_BUCKETS.forEach(b => totals.total += 0);
  totals.total = FIN_AGE_BUCKETS.reduce((s, b) => s + totals[b], 0);
  var overdue = totals.total - totals.current;
  return React.createElement("div", {
    className: "cn-fin-view"
  }, React.createElement("div", {
    className: "cn-toolbar",
    style: {
      marginTop: 2
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, eyebrow), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      margin: "2px 0 0"
    }
  }, title, " \xB7 as at ", finDateLabel(today)))), React.createElement("section", {
    className: "cn-fin-strip"
  }, React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Total outstanding"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(totals.total)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, contacts.length, " ", label, contacts.length !== 1 ? "s" : "")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Current"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: "var(--cn-pos)"
    }
  }, finFmt0(totals.current)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "not yet due")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Overdue"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: overdue > 0 ? "var(--cn-neg)" : "inherit"
    }
  }, finFmt0(overdue)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "past due date")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "90+ days"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: totals["90+"] > 0 ? "var(--cn-neg)" : "inherit"
    }
  }, finFmt0(totals["90+"])), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "at risk"))), React.createElement("section", {
    className: "cn-card cn-card--flush"
  }, contacts.length === 0 ? React.createElement("div", {
    className: "cn-fin-empty",
    style: {
      padding: 40
    }
  }, "\u2713 ", empty) : React.createElement("table", {
    className: "cn-table cn-aged-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, label === "customer" ? "Customer" : "Supplier"), FIN_AGE_BUCKETS.map(b => React.createElement("th", {
    key: b,
    style: {
      textAlign: "right"
    }
  }, FIN_AGE_LABELS[b])), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Total"))), React.createElement("tbody", null, contacts.map(([name, v]) => React.createElement("tr", {
    key: name
  }, React.createElement("td", {
    className: "cn-cell-primary"
  }, name, React.createElement("span", {
    className: "cn-cell-secondary",
    style: {
      fontWeight: 400
    }
  }, " \xB7 ", v.count)), FIN_AGE_BUCKETS.map(b => React.createElement("td", {
    key: b,
    className: "cn-mono",
    style: {
      textAlign: "right",
      color: v[b] === 0 ? "var(--cn-mute-2)" : b === "current" ? "var(--cn-ink)" : "var(--cn-neg)"
    }
  }, v[b] > 0 ? finFmt0(v[b]) : "—")), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right",
      fontWeight: 600
    }
  }, finFmt0(v.total))))), React.createElement("tfoot", null, React.createElement("tr", {
    className: "cn-aged-total"
  }, React.createElement("td", null, "Total"), FIN_AGE_BUCKETS.map(b => React.createElement("td", {
    key: b,
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, finFmt0(totals[b]))), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right",
      fontWeight: 700
    }
  }, finFmt0(totals.total)))))));
}
Object.assign(window, {
  FinanceReports,
  FinanceBalanceSheet,
  FinBalanceBars,
  FinanceAgedReceivables,
  FinanceAgedPayables,
  FinAgedReport
});