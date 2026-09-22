function FinancePnL({
  ar,
  bills,
  expenses,
  settings
}) {
  var [period, setPeriod] = useState("6mo");
  var range = useMemo(() => {
    var now = finToday();
    if (period === "mo") return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      label: now.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric"
      })
    };
    if (period === "qtr") {
      var q = Math.floor(now.getMonth() / 3);
      return {
        start: new Date(now.getFullYear(), q * 3, 1),
        label: "Q" + (q + 1) + " " + now.getFullYear()
      };
    }
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 5, 1),
      label: "Trailing 6 months"
    };
  }, [period]);
  var inRange = d => d && finParse(d) >= range.start;
  var arP = ar.filter(r => inRange(r.issueDate));
  var billsP = bills.filter(b => inRange(b.issueDate));
  var expP = expenses.filter(e => inRange(e.date));
  var a = finAggregate(arP, billsP, expP, settings);
  var opexByCat = {};
  billsP.forEach(b => {
    var c = finBillCompute(b);
    if (!c.isCogs) opexByCat[b.category] = (opexByCat[b.category] || 0) + c.amount;
  });
  expP.forEach(e => {
    opexByCat[e.category] = (opexByCat[e.category] || 0) + (parseFloat(e.amount) || 0);
  });
  var opexRows = Object.entries(opexByCat).sort((x, y) => y[1] - x[1]);
  var incomeTax = Math.max(0, a.netProfit) * (parseFloat(settings.incomeTaxRate) || 0) / 100;
  var netAfterTax = a.netProfit - incomeTax;
  var pct = n => a.totalRevenue > 0 ? (n / a.totalRevenue * 100).toFixed(1) + "%" : "—";
  var Row = ({
    label,
    val,
    kind,
    sub
  }) => React.createElement("div", {
    className: `cn-pnl-row ${kind || ""}`
  }, React.createElement("span", {
    className: "cn-pnl-label"
  }, label, sub && React.createElement("span", {
    className: "cn-pnl-sub"
  }, " ", sub)), React.createElement("span", {
    className: "cn-pnl-pct cn-mono"
  }, kind === "total" || kind === "grand" ? pct(val) : ""), React.createElement("span", {
    className: "cn-pnl-val cn-mono"
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
  }, "Profit & loss"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      margin: "2px 0 0"
    }
  }, range.label)), React.createElement("div", {
    className: "cn-toolbar-right"
  }, React.createElement("div", {
    className: "cn-segmented"
  }, [["mo", "This month"], ["qtr", "This quarter"], ["6mo", "6 months"]].map(([id, l]) => React.createElement("button", {
    key: id,
    className: period === id ? "is-active" : "",
    onClick: () => setPeriod(id)
  }, l))))), React.createElement("div", {
    className: "cn-grid-2"
  }, React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-pnl"
  }, React.createElement("div", {
    className: "cn-pnl-section"
  }, "Revenue"), React.createElement(Row, {
    label: "Commission income",
    val: a.commissionIncome
  }), React.createElement(Row, {
    label: "Resale revenue",
    val: a.resaleRevenue
  }), React.createElement(Row, {
    label: "Total revenue",
    val: a.totalRevenue,
    kind: "total"
  }), React.createElement("div", {
    className: "cn-pnl-section"
  }, "Cost of goods sold"), React.createElement(Row, {
    label: "Resale hardware & freight",
    val: a.cogs,
    sub: a.cogs === 0 ? "— commission deals carry no COGS" : ""
  }), React.createElement(Row, {
    label: "Gross profit",
    val: a.grossProfit,
    kind: "total"
  }), React.createElement("div", {
    className: "cn-pnl-margin"
  }, "Gross margin ", React.createElement("strong", null, a.grossMargin.toFixed(1), "%")), React.createElement("div", {
    className: "cn-pnl-section"
  }, "Operating expenses"), opexRows.length === 0 ? React.createElement(Row, {
    label: "No operating expense in period",
    val: 0
  }) : opexRows.map(([c, v]) => React.createElement(Row, {
    key: c,
    label: c,
    val: v
  })), React.createElement(Row, {
    label: "Total operating expenses",
    val: a.opex,
    kind: "total"
  }), React.createElement(Row, {
    label: "Operating income",
    val: a.netProfit,
    kind: "grand"
  }), React.createElement(Row, {
    label: `Income tax set-aside (${settings.incomeTaxRate || 0}%)`,
    val: -incomeTax
  }), React.createElement(Row, {
    label: "Net income after set-aside",
    val: netAfterTax,
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
  }, "Margin waterfall"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Revenue \u2192 net"))), React.createElement(FinWaterfall, {
    revenue: a.totalRevenue,
    cogs: a.cogs,
    opex: a.opex,
    tax: incomeTax,
    net: netAfterTax
  })), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Health checks"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Quick read"))), React.createElement("div", {
    className: "cn-fin-metrics"
  }, React.createElement("div", {
    className: "cn-fin-metric"
  }, React.createElement("span", null, "Gross margin"), React.createElement("strong", {
    className: "cn-mono"
  }, a.grossMargin.toFixed(1), "%")), React.createElement("div", {
    className: "cn-fin-metric"
  }, React.createElement("span", null, "Operating (net) margin"), React.createElement("strong", {
    className: "cn-mono"
  }, a.totalRevenue > 0 ? (a.netProfit / a.totalRevenue * 100).toFixed(1) : "0", "%")), React.createElement("div", {
    className: "cn-fin-metric"
  }, React.createElement("span", null, "Commission share of revenue"), React.createElement("strong", {
    className: "cn-mono"
  }, a.totalRevenue > 0 ? (a.commissionIncome / a.totalRevenue * 100).toFixed(0) : 0, "%")), React.createElement("div", {
    className: "cn-fin-metric"
  }, React.createElement("span", null, "Revenue per OpEx $"), React.createElement("strong", {
    className: "cn-mono"
  }, a.opex > 0 ? "$" + (a.totalRevenue / a.opex).toFixed(2) : "—")), React.createElement("div", {
    className: "cn-fin-metric"
  }, React.createElement("span", null, "Commission pipeline (upside)"), React.createElement("strong", {
    className: "cn-mono",
    style: {
      color: "var(--cn-copper)"
    }
  }, finFmt0(a.commissionPipeline))))))));
}
function FinWaterfall({
  revenue,
  cogs,
  opex,
  tax,
  net
}) {
  var steps = [{
    label: "Revenue",
    val: revenue,
    kind: "rev"
  }, {
    label: "− COGS",
    val: -cogs,
    kind: "neg"
  }, {
    label: "− OpEx",
    val: -opex,
    kind: "neg"
  }, {
    label: "− Tax",
    val: -tax,
    kind: "neg"
  }, {
    label: "Net",
    val: net,
    kind: "net"
  }];
  var max = Math.max(1, revenue);
  return React.createElement("div", {
    className: "cn-fin-water"
  }, steps.map((s, i) => React.createElement("div", {
    key: i,
    className: "cn-fin-water-row"
  }, React.createElement("span", {
    className: "cn-fin-water-label"
  }, s.label), React.createElement("span", {
    className: "cn-fin-water-track"
  }, React.createElement("span", {
    className: `cn-fin-water-fill cn-fin-water-fill--${s.kind}`,
    style: {
      width: `${Math.min(100, Math.abs(s.val) / max * 100)}%`
    }
  })), React.createElement("span", {
    className: "cn-fin-water-val cn-mono"
  }, finFmt0(s.val)))));
}
function FinanceCashFlow({
  ar,
  bills,
  expenses,
  settings
}) {
  var a = useMemo(() => finAggregate(ar, bills, expenses, settings), [ar, bills, expenses, settings]);
  var today = finToday();
  var horizon = finAddDays(today, 90);
  var events = useMemo(() => {
    var ev = [];
    a.arOpen.forEach(x => {
      var when = x.raw.dueDate ? finParse(x.raw.dueDate) : finParse(finAddDays(today, 14));
      if (when < today) when = finParse(finAddDays(today, 7));
      if (when <= finParse(horizon)) ev.push({
        date: finISO(when),
        label: (x.c.type === "commission" ? "Commission · " : "Invoice · ") + x.c.payer,
        amount: x.c.balance,
        dir: "in"
      });
    });
    a.apOpen.forEach(x => {
      var when = x.raw.dueDate ? finParse(x.raw.dueDate) : finParse(finAddDays(today, 14));
      if (when < today) when = finParse(finAddDays(today, 3));
      if (when <= finParse(horizon)) ev.push({
        date: finISO(when),
        label: "Bill · " + x.raw.vendor,
        amount: -x.c.balance,
        dir: "out"
      });
    });
    var seenRecur = new Set();
    expenses.filter(e => e.recurring === "monthly").forEach(e => {
      var key = (e.payee || "") + "|" + e.category + "|" + (parseFloat(e.amount) || 0);
      if (seenRecur.has(key)) return;
      seenRecur.add(key);
      var day = finParse(e.date).getDate();
      for (var k = 0; k <= 3; k++) {
        var dt = new Date(today.getFullYear(), today.getMonth() + k, day);
        if (dt >= today && dt <= finParse(horizon)) ev.push({
          date: finISO(dt),
          label: "Recurring · " + e.payee,
          amount: -(parseFloat(e.amount) || 0),
          dir: "out"
        });
      }
    });
    ev.sort((x, y) => finParse(x.date) - finParse(y.date));
    var bal = a.cashOnHand;
    ev.forEach(e => {
      bal += e.amount;
      e.balance = bal;
    });
    return ev;
  }, [ar, bills, expenses, settings]);
  var in30 = events.filter(e => e.dir === "in" && finDays(e.date, today) <= 30).reduce((s, e) => s + e.amount, 0);
  var out30 = events.filter(e => e.dir === "out" && finDays(e.date, today) <= 30).reduce((s, e) => s + e.amount, 0);
  var proj30 = a.cashOnHand + in30 + out30;
  var minBal = events.length ? Math.min(a.cashOnHand, ...events.map(e => e.balance)) : a.cashOnHand;
  var weeks = [];
  var _loop = function () {
    var cutoff = finAddDays(today, w * 7);
    var last = events.filter(e => finParse(e.date) <= finParse(cutoff)).slice(-1)[0];
    weeks.push({
      w,
      bal: last ? last.balance : a.cashOnHand
    });
  };
  for (var w = 1; w <= 12; w++) {
    _loop();
  }
  var wMax = Math.max(a.cashOnHand, ...weeks.map(x => x.bal), 1);
  var wMin = Math.min(0, a.cashOnHand, ...weeks.map(x => x.bal));
  var span = Math.max(1, wMax - wMin);
  return React.createElement("div", {
    className: "cn-fin-view"
  }, React.createElement("section", {
    className: "cn-fin-strip"
  }, React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Cash on hand"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(a.cashOnHand)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "today")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Expected in \xB7 30d"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: "var(--cn-pos)"
    }
  }, finFmt0(in30)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "A/R coming due")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Going out \xB7 30d"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: "var(--cn-neg)"
    }
  }, finFmt0(out30)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "bills + recurring")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Projected \xB7 30d"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(proj30)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, minBal < 0 ? React.createElement("span", {
    className: "cn-neg"
  }, "dips below 0 in 90d") : "stays positive"))), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "12-week outlook"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Projected cash balance")), React.createElement("div", {
    className: "cn-legend"
  }, React.createElement("span", {
    className: "cn-mono cn-cell-secondary"
  }, "Pipeline upside not included \xB7 ", finFmt0(a.commissionPipeline), " expected"))), React.createElement("div", {
    className: "cn-fin-cashbars"
  }, weeks.map(({
    w,
    bal
  }) => {
    var h = (bal - wMin) / span * 100;
    return React.createElement("div", {
      key: w,
      className: "cn-fin-cashbar-col"
    }, React.createElement("div", {
      className: "cn-fin-cashbar-track"
    }, React.createElement("div", {
      className: `cn-fin-cashbar ${bal < 0 ? "is-neg" : ""}`,
      style: {
        height: `${Math.max(2, h)}%`
      },
      title: `Week ${w}: ${finFmt0(bal)}`
    })), React.createElement("div", {
      className: "cn-fin-cashbar-x"
    }, "W", w));
  }))), React.createElement("section", {
    className: "cn-card cn-card--flush"
  }, React.createElement("div", {
    className: "cn-card-head",
    style: {
      padding: "16px 18px 0"
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Forecast ledger"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Next 90 days"))), events.length === 0 ? React.createElement("div", {
    className: "cn-fin-empty",
    style: {
      padding: 40
    }
  }, "No scheduled inflows or outflows in the next 90 days.") : React.createElement("table", {
    className: "cn-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Date"), React.createElement("th", null, "Item"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "In"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Out"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Running balance"))), React.createElement("tbody", null, events.map((e, i) => React.createElement("tr", {
    key: i
  }, React.createElement("td", {
    className: "cn-cell-secondary"
  }, finDateLabel(e.date)), React.createElement("td", {
    className: "cn-cell-primary",
    style: {
      fontWeight: 400
    }
  }, e.label), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right",
      color: "var(--cn-pos)"
    }
  }, e.dir === "in" ? finFmt0(e.amount) : ""), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right",
      color: "var(--cn-neg)"
    }
  }, e.dir === "out" ? finFmt0(-e.amount) : ""), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right",
      fontWeight: 500,
      color: e.balance < 0 ? "var(--cn-neg)" : "inherit"
    }
  }, finFmt0(e.balance))))))));
}
function FinanceTax({
  ar,
  bills,
  expenses,
  settings
}) {
  var a = useMemo(() => finAggregate(ar, bills, expenses, settings), [ar, bills, expenses, settings]);
  var salesTaxLiability = a.taxCollected + a.taxAccrued;
  var incomeTaxSetAside = Math.max(0, a.netProfit) * (parseFloat(settings.incomeTaxRate) || 0) / 100;
  var rows = ar.map(r => ({
    raw: r,
    c: finArCompute(r)
  })).filter(x => x.c.type === "resale" && x.c.counts && x.c.tax > 0);
  var byQ = {};
  rows.forEach(x => {
    var d = finParse(x.raw.issueDate);
    var q = "Q" + (Math.floor(d.getMonth() / 3) + 1) + " " + d.getFullYear();
    if (!byQ[q]) byQ[q] = {
      collected: 0,
      accrued: 0
    };
    if (x.c.isPaid) byQ[q].collected += x.c.tax;else byQ[q].accrued += x.c.tax;
  });
  var qRows = Object.entries(byQ);
  return React.createElement("div", {
    className: "cn-fin-view"
  }, React.createElement("section", {
    className: "cn-fin-strip"
  }, React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Sales tax \u2014 to remit"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(salesTaxLiability)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "resale only")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Collected"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: "var(--cn-pos)"
    }
  }, finFmt0(a.taxCollected)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "on paid invoices")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Accrued"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(a.taxAccrued)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "on open invoices")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Income tax set-aside"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(incomeTaxSetAside)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, settings.incomeTaxRate, "% of net"))), React.createElement("div", {
    className: "cn-grid-2"
  }, React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Sales tax"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Liability by quarter"))), qRows.length === 0 ? React.createElement("div", {
    className: "cn-fin-empty"
  }, "No taxable resale yet. Commission/referral income is service revenue \u2014 no sales tax, only income tax.") : React.createElement("table", {
    className: "cn-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Quarter"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Collected"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Accrued"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "To remit"))), React.createElement("tbody", null, qRows.map(([q, v]) => React.createElement("tr", {
    key: q
  }, React.createElement("td", {
    className: "cn-cell-primary"
  }, q), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, finFmt0(v.collected)), React.createElement("td", {
    className: "cn-mono cn-cell-secondary",
    style: {
      textAlign: "right"
    }
  }, finFmt0(v.accrued)), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right",
      fontWeight: 500
    }
  }, finFmt0(v.collected + v.accrued))))))), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Income tax"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Recommended set-aside"))), React.createElement("div", {
    className: "cn-fin-taxbox"
  }, React.createElement("div", {
    className: "cn-fin-tax-line"
  }, React.createElement("span", null, "Net income (trailing)"), React.createElement("span", {
    className: "cn-mono"
  }, finFmt0(a.netProfit))), React.createElement("div", {
    className: "cn-fin-tax-line"
  }, React.createElement("span", null, "Set-aside rate"), React.createElement("span", {
    className: "cn-mono"
  }, settings.incomeTaxRate, "%")), React.createElement("div", {
    className: "cn-fin-tax-line cn-fin-tax-line--total"
  }, React.createElement("span", null, "Reserve for income tax"), React.createElement("span", {
    className: "cn-mono"
  }, finFmt0(incomeTaxSetAside))), React.createElement("p", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12,
      margin: "10px 0 0",
      lineHeight: 1.55
    }
  }, "A working estimate, not tax advice. Commission/referral income is ordinary business income \u2014 set cash aside each time a commission is collected so quarterly estimates don't bite. Adjust the rate in Settings.")))));
}
Object.assign(window, {
  FinancePnL,
  FinWaterfall,
  FinanceCashFlow,
  FinanceTax
});