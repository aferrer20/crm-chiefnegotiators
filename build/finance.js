var FIN_KEYS = {
  bills: "cn-finance-bills",
  expenses: "cn-finance-expenses",
  ar: "cn-finance-ar",
  settings: "cn-finance-settings",
  accounts: "cn-finance-accounts",
  banktxns: "cn-finance-banktxns",
  seed: "cn-finance-seed-v2"
};
function finRead(key) {
  try {
    return JSON.parse(localStorage.getItem(FIN_KEYS[key]) || "[]");
  } catch {
    return [];
  }
}
function finWrite(key, list) {
  var prev = finRead(key);
  localStorage.setItem(FIN_KEYS[key], JSON.stringify(list));
  finSyncPush(key, prev, list);
}
function finSyncPush(key, prev, next) {
  if (!window.cnFinanceSync) return;
  if (["bills", "expenses", "ar", "accounts", "banktxns"].indexOf(key) < 0) return;
  try {
    var prevById = {};
    (prev || []).forEach(r => {
      if (r && r.id) prevById[r.id] = JSON.stringify(r);
    });
    var nextIds = new Set((next || []).filter(r => r && r.id).map(r => r.id));
    (prev || []).forEach(r => {
      if (r && r.id && !nextIds.has(r.id)) window.cnFinanceSync.remove(key, r.id);
    });
    (next || []).forEach(r => {
      if (!r || !r.id) return;
      var ps = prevById[r.id];
      if (ps == null || ps !== JSON.stringify(r)) window.cnFinanceSync.upsert(key, r);
    });
  } catch (e) {}
}
async function finSyncPull() {
  if (!window.cnFinanceSync) return;
  var remote;
  try {
    remote = await window.cnFinanceSync.loadAll();
  } catch (e) {
    remote = null;
  }
  if (!remote) return;
  var touched = false;
  ["bills", "expenses", "ar", "accounts", "banktxns"].forEach(key => {
    var server = remote[key] || [];
    var local = finRead(key);
    var byId = {};
    local.forEach(r => {
      if (r && r.id) byId[r.id] = r;
    });
    server.forEach(r => {
      if (r && r.id) byId[r.id] = r;
    });
    Object.keys(byId).forEach(id => {
      if (window.cnIsTombstoned && window.cnIsTombstoned("fin:" + key, id)) delete byId[id];
    });
    localStorage.setItem(FIN_KEYS[key], JSON.stringify(Object.values(byId)));
    local.forEach(r => {
      if (!r || !r.id || server.some(s => s.id === r.id)) return;
      if (window.cnIsTombstoned && window.cnIsTombstoned("fin:" + key, r.id)) return;
      window.cnFinanceSync.upsert(key, r);
    });
    touched = true;
  });
  if (touched && window.cnFinanceRefresh) window.cnFinanceRefresh();
}
window.finSyncPull = finSyncPull;
function finReadSettings() {
  try {
    return JSON.parse(localStorage.getItem(FIN_KEYS.settings) || "null") || {
      ...FIN_DEFAULT_SETTINGS
    };
  } catch {
    return {
      ...FIN_DEFAULT_SETTINGS
    };
  }
}
function finWriteSettings(s) {
  localStorage.setItem(FIN_KEYS.settings, JSON.stringify(s));
}
var FIN_DEFAULT_SETTINGS = {
  openingCash: 0,
  salesTaxRate: 7,
  incomeTaxRate: 21
};
var FIN_ID = p => p + "-" + Math.random().toString(36).slice(2, 10);
// Amanda sees BOTH brands' finance (brand follows the login, so she needs the
// tab whichever brand she is viewing); Arron is SSP only. Mailbox-level match
// across the two company domains, same rule as owner access.
var FINANCE_ALLOW = {
  ssp: ["arron@strategicsupplypartners.com.au", "amanda@thechiefnegotiators.com"],
  chief: ["amanda@thechiefnegotiators.com"]
};
var FINANCE_DOMAINS = ["thechiefnegotiators.com", "strategicsupplypartners.com.au"];
window.cnCanViewFinance = function (email) {
  if (!email) return false;
  var brand = window.CN_BRAND && window.CN_BRAND.key || "chief";
  var e = String(email).trim().toLowerCase();
  var allowed = {};
  (FINANCE_ALLOW[brand] || []).forEach(function (addr) {
    var a = String(addr).trim().toLowerCase();
    allowed[a] = true;
    var parts = a.split("@");
    if (FINANCE_DOMAINS.indexOf(parts[1]) > -1) {
      FINANCE_DOMAINS.forEach(function (d) { allowed[parts[0] + "@" + d] = true; });
    }
  });
  return !!allowed[e];
};
var FIN_COGS_CATS = ["Resale hardware", "Freight & logistics", "Refurb & testing"];
var FIN_OPEX_CATS = ["Payroll", "Rent & facilities", "Software & SaaS", "Marketing", "Insurance", "Professional services", "Travel", "Office & supplies", "Other"];
var FIN_BILL_CATS = [...FIN_COGS_CATS, ...FIN_OPEX_CATS];
var FIN_EXPENSE_CATS = FIN_OPEX_CATS;
var isCogsCat = c => FIN_COGS_CATS.includes(c);
function finToday() {
  return new Date();
}
function finParse(d) {
  return d instanceof Date ? new Date(d.getTime()) : new Date(d + (String(d).length <= 10 ? "T00:00:00" : ""));
}
function finDays(a, b) {
  return Math.round((finParse(a) - finParse(b)) / 86400000);
}
function finISO(d) {
  return window.cnDay(finParse(d));
}
function finAddDays(d, n) {
  var x = finParse(d);
  x.setDate(x.getDate() + n);
  return finISO(x);
}
function finMonthKey(d) {
  var x = finParse(d);
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0");
}
function finMonthLabel(key) {
  var [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "short"
  });
}
function finDateLabel(d) {
  return d ? finParse(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }) : "—";
}
function finRecentMonths(n) {
  var out = [],
    now = finToday();
  for (var i = n - 1; i >= 0; i--) out.push(finMonthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return out;
}
var finFmt = (n, opts) => window.fmtUSD(n || 0, opts || {});
var finFmt0 = n => (n < 0 ? "−$" : "$") + Math.round(Math.abs(n || 0)).toLocaleString("en-US");
function finArCompute(rec) {
  var today = finToday();
  var type = rec.type || "resale";
  if (type === "commission") {
    var dealValue = parseFloat(rec.dealValue) || 0;
    var rate = parseFloat(rec.rate) || 0;
    var amount = rec.amount != null && rec.amount !== "" ? parseFloat(rec.amount) || 0 : dealValue * rate / 100;
    var _status = rec.status || "expected";
    var _isPaid = _status === "paid";
    var isExpected = _status === "expected";
    var isInvoiced = _status === "invoiced";
    var _counts = isInvoiced || _isPaid;
    var _daysToDue = rec.dueDate ? finDays(rec.dueDate, today) : null;
    var _isOverdue = isInvoiced && _daysToDue != null && _daysToDue < 0;
    var _daysOverdue = _isOverdue ? -_daysToDue : 0;
    var _balance = isInvoiced && !_isPaid ? amount : 0;
    var _bucket = "current";
    if (_isOverdue) _bucket = _daysOverdue <= 30 ? "1-30" : _daysOverdue <= 60 ? "31-60" : _daysOverdue <= 90 ? "61-90" : "90+";
    return {
      type,
      payer: rec.vendor || "—",
      amount,
      total: amount,
      tax: 0,
      revenue: _counts ? amount : 0,
      dealValue,
      rate,
      status: _status,
      isPaid: _isPaid,
      isExpected,
      isInvoiced,
      isDraft: false,
      isVoid: false,
      counts: _counts,
      balance: _balance,
      daysToDue: _daysToDue,
      isOverdue: _isOverdue,
      daysOverdue: _daysOverdue,
      bucket: _bucket
    };
  }
  var subtotal = (rec.lineItems || []).reduce((s, li) => s + (parseFloat(li.qty) || 0) * (parseFloat(li.unitPrice) || 0), 0) || parseFloat(rec.amount) || 0;
  var discount = parseFloat(rec.discount) || 0;
  var shipping = parseFloat(rec.shippingFee) || 0;
  var taxable = Math.max(0, subtotal - discount);
  var tax = taxable * (parseFloat(rec.taxRate) || 0) / 100;
  var total = taxable + tax + shipping;
  var status = rec.status || "draft";
  var isPaid = status === "paid";
  var isVoid = status === "void";
  var isDraft = status === "draft";
  var counts = !isDraft && !isVoid;
  var daysToDue = rec.dueDate ? finDays(rec.dueDate, today) : null;
  var isOverdue = counts && !isPaid && daysToDue != null && daysToDue < 0;
  var daysOverdue = isOverdue ? -daysToDue : 0;
  var balance = counts && !isPaid ? total : 0;
  var bucket = "current";
  if (isOverdue) bucket = daysOverdue <= 30 ? "1-30" : daysOverdue <= 60 ? "31-60" : daysOverdue <= 90 ? "61-90" : "90+";
  return {
    type,
    payer: rec.billToName || "—",
    amount: subtotal,
    subtotal,
    discount,
    shipping,
    taxable,
    tax,
    total,
    revenue: counts ? taxable + shipping : 0,
    status,
    isPaid,
    isExpected: false,
    isInvoiced: false,
    isDraft,
    isVoid,
    counts,
    balance,
    daysToDue,
    isOverdue,
    daysOverdue,
    bucket
  };
}
function finBillCompute(bill) {
  var today = finToday();
  var amount = parseFloat(bill.amount) || 0;
  var isPaid = (bill.status || "unpaid") === "paid";
  var daysToDue = bill.dueDate ? finDays(bill.dueDate, today) : null;
  var isOverdue = !isPaid && daysToDue != null && daysToDue < 0;
  var daysOverdue = isOverdue ? -daysToDue : 0;
  var bucket = "current";
  if (isOverdue) bucket = daysOverdue <= 30 ? "1-30" : daysOverdue <= 60 ? "31-60" : daysOverdue <= 90 ? "61-90" : "90+";
  return {
    amount,
    isPaid,
    daysToDue,
    isOverdue,
    daysOverdue,
    balance: isPaid ? 0 : amount,
    bucket,
    isCogs: isCogsCat(bill.category)
  };
}
function finAllAr() {
  var sh = (window.cnSalesHub?.shRead?.("invoice") || []).map(d => ({
    ...d,
    type: "resale",
    _src: "saleshub"
  }));
  var own = finRead("ar").map(d => ({
    ...d,
    _src: "finance"
  }));
  var seen = new Set(sh.map(d => d.docNumber));
  return [...sh, ...own.filter(d => !seen.has(d.docNumber))];
}
function finSetArPayment(rec, patch) {
  if (rec._src === "saleshub" && window.cnSalesHub?.shSave) {
    window.cnSalesHub.shSave("invoice", {
      ...rec,
      ...patch
    });
  } else {
    finWrite("ar", finRead("ar").map(d => d.id === rec.id ? {
      ...d,
      ...patch,
      updatedAt: new Date().toISOString()
    } : d));
  }
}
function finSaveAr(rec) {
  var list = finRead("ar");
  var i = list.findIndex(d => d.id === rec.id);
  if (i >= 0) list[i] = rec;else list.unshift(rec);
  finWrite("ar", list);
}
function finDeleteAr(id) {
  finWrite("ar", finRead("ar").filter(d => d.id !== id));
}
function finBankAccounts() {
  return finRead("accounts");
}
function finBankTxns(accountId) {
  var all = finRead("banktxns");
  return accountId ? all.filter(t => t.accountId === accountId) : all;
}
function finAccountBalance(acc) {
  var opening = parseFloat(acc.openingBalance) || 0;
  return opening + finBankTxns(acc.id).reduce((s, t) => s + (parseFloat(t.received) || 0) - (parseFloat(t.spent) || 0), 0);
}
function finAccountReconciled(acc) {
  var opening = parseFloat(acc.openingBalance) || 0;
  return opening + finBankTxns(acc.id).filter(t => t.status === "reconciled").reduce((s, t) => s + (parseFloat(t.received) || 0) - (parseFloat(t.spent) || 0), 0);
}
function finBankCash() {
  var accs = finRead("accounts");
  if (!accs.length) return null;
  return accs.reduce((s, a) => s + finAccountBalance(a), 0);
}
function finSaveAccount(acc) {
  var l = finRead("accounts");
  var i = l.findIndex(a => a.id === acc.id);
  if (i >= 0) l[i] = acc;else l.unshift(acc);
  finWrite("accounts", l);
}
function finDeleteAccount(id) {
  finWrite("accounts", finRead("accounts").filter(a => a.id !== id));
  finWrite("banktxns", finRead("banktxns").filter(t => t.accountId !== id));
}
function finSaveTxn(t) {
  var l = finRead("banktxns");
  var i = l.findIndex(x => x.id === t.id);
  if (i >= 0) l[i] = t;else l.unshift(t);
  finWrite("banktxns", l);
}
function finDeleteTxn(id) {
  finWrite("banktxns", finRead("banktxns").filter(t => t.id !== id));
}
window.cnFinance = {
  FIN_KEYS,
  finRead,
  finWrite,
  finReadSettings,
  finWriteSettings,
  finAllAr,
  finArCompute,
  finBillCompute,
  finSetArPayment,
  finSaveAr,
  finDeleteAr,
  finBankAccounts,
  finBankTxns,
  finAccountBalance,
  finAccountReconciled,
  finBankCash,
  finSaveAccount,
  finDeleteAccount,
  finSaveTxn,
  finDeleteTxn,
  FIN_BILL_CATS,
  FIN_COGS_CATS,
  FIN_OPEX_CATS,
  FIN_EXPENSE_CATS,
  isCogsCat
};
function finSeedIfNeeded(scenario) {
  if (localStorage.getItem("cn-finance-clean-v1")) return;
  finWipeSample();
  finWriteSettings({
    ...finReadSettings(),
    openingCash: 0
  });
  localStorage.setItem("cn-finance-clean-v1", "1");
}
function finWipeSample() {
  ["bills", "expenses", "ar"].forEach(k => finWrite(k, finRead(k).filter(d => !d._sample)));
}
function FinTypeChip({
  type
}) {
  return React.createElement("span", {
    className: `cn-fin-type cn-fin-type--${type}`
  }, type === "commission" ? "Commission" : "Resale");
}
function FinStatusPill({
  computed
}) {
  var label, cls;
  if (computed.isPaid) {
    label = "Paid";
    cls = "cn-q-accepted";
  } else if (computed.isOverdue) {
    label = computed.daysOverdue + "d overdue";
    cls = "cn-q-declined";
  } else if (computed.isExpected) {
    label = "Expected";
    cls = "cn-q-draft";
  } else if (computed.isDraft) {
    label = "Draft";
    cls = "cn-q-draft";
  } else if (computed.isInvoiced) {
    label = "Invoiced";
    cls = "cn-q-sent";
  } else {
    label = "Open";
    cls = "cn-q-sent";
  }
  return React.createElement("span", {
    className: `cn-q-pill ${cls}`
  }, label);
}
function FinApStatusPill({
  computed
}) {
  if (computed.isPaid) return React.createElement("span", {
    className: "cn-q-pill cn-q-accepted"
  }, "Paid");
  if (computed.isOverdue) return React.createElement("span", {
    className: "cn-q-pill cn-q-declined"
  }, computed.daysOverdue, "d overdue");
  return React.createElement("span", {
    className: "cn-q-pill cn-q-sent"
  }, "Open");
}
function FinDelta({
  value,
  suffix
}) {
  if (value == null || !isFinite(value)) return null;
  var up = value >= 0;
  return React.createElement("span", {
    className: up ? "cn-pos" : "cn-neg"
  }, up ? "▲" : "▼", " ", Math.abs(value).toFixed(1), suffix || "%");
}
function FinBarChart({
  months,
  seriesA,
  seriesB,
  labelA,
  labelB,
  fmt
}) {
  var max = Math.max(1, ...seriesA, ...(seriesB || []));
  var f = fmt || (v => finFmt(v, {
    compact: true
  }));
  return React.createElement("div", {
    className: "cn-fin-chart"
  }, React.createElement("div", {
    className: "cn-fin-chart-legend"
  }, React.createElement("span", null, React.createElement("i", {
    className: "cn-fin-dot cn-fin-dot--a"
  }), labelA), seriesB && React.createElement("span", null, React.createElement("i", {
    className: "cn-fin-dot cn-fin-dot--b"
  }), labelB)), React.createElement("div", {
    className: "cn-fin-chart-cols"
  }, months.map((m, i) => React.createElement("div", {
    key: m,
    className: "cn-fin-chart-col"
  }, React.createElement("div", {
    className: "cn-fin-chart-bars"
  }, React.createElement("div", {
    className: "cn-fin-bar cn-fin-bar--a",
    style: {
      height: `${seriesA[i] / max * 100}%`
    },
    title: `${labelA}: ${f(seriesA[i])}`
  }), seriesB && React.createElement("div", {
    className: "cn-fin-bar cn-fin-bar--b",
    style: {
      height: `${seriesB[i] / max * 100}%`
    },
    title: `${labelB}: ${f(seriesB[i])}`
  })), React.createElement("div", {
    className: "cn-fin-chart-x"
  }, finMonthLabel(m))))));
}
function finAggregate(ar, bills, expenses, settings) {
  var A = ar.map(r => ({
    raw: r,
    c: finArCompute(r)
  }));
  var B = bills.map(b => ({
    raw: b,
    c: finBillCompute(b)
  }));
  var commissionIncome = A.filter(x => x.c.type === "commission" && x.c.counts).reduce((s, x) => s + x.c.amount, 0);
  var commissionPipeline = A.filter(x => x.c.type === "commission" && x.c.isExpected).reduce((s, x) => s + x.c.amount, 0);
  var resaleRevenue = A.filter(x => x.c.type === "resale" && x.c.counts).reduce((s, x) => s + x.c.revenue, 0);
  var totalRevenue = commissionIncome + resaleRevenue;
  var cogs = B.filter(x => x.c.isCogs).reduce((s, x) => s + x.c.amount, 0);
  var grossProfit = totalRevenue - cogs;
  var grossMargin = totalRevenue > 0 ? grossProfit / totalRevenue * 100 : 0;
  var opexBills = B.filter(x => !x.c.isCogs).reduce((s, x) => s + x.c.amount, 0);
  var expTotal = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  var opex = opexBills + expTotal;
  var netProfit = grossProfit - opex;
  var arOpen = A.filter(x => x.c.balance > 0);
  var arOutstanding = arOpen.reduce((s, x) => s + x.c.balance, 0);
  var arOverdue = arOpen.filter(x => x.c.isOverdue);
  var arOverdueAmt = arOverdue.reduce((s, x) => s + x.c.balance, 0);
  var apOpen = B.filter(x => !x.c.isPaid);
  var apOutstanding = apOpen.reduce((s, x) => s + x.c.balance, 0);
  var apDueSoon = apOpen.filter(x => x.c.daysToDue != null && x.c.daysToDue >= 0 && x.c.daysToDue <= 7);
  var apDueSoonAmt = apDueSoon.reduce((s, x) => s + x.c.balance, 0);
  var apOverdueAmt = apOpen.filter(x => x.c.isOverdue).reduce((s, x) => s + x.c.balance, 0);
  var collected = A.filter(x => x.c.isPaid).reduce((s, x) => s + x.c.total, 0);
  var billsPaid = B.filter(x => x.c.isPaid).reduce((s, x) => s + x.c.amount, 0);
  var expPaid = expTotal;
  var cashOnHand = (settings.openingCash || 0) + collected - billsPaid - expPaid;
  var dso = totalRevenue > 0 ? Math.round(arOutstanding / (totalRevenue / 180)) : 0;
  var taxCollected = A.filter(x => x.c.type === "resale" && x.c.isPaid).reduce((s, x) => s + x.c.tax, 0);
  var taxAccrued = arOpen.filter(x => x.c.type === "resale").reduce((s, x) => s + x.c.tax, 0);
  return {
    A,
    B,
    commissionIncome,
    commissionPipeline,
    resaleRevenue,
    totalRevenue,
    cogs,
    grossProfit,
    grossMargin,
    opexBills,
    expTotal,
    opex,
    netProfit,
    arOpen,
    arOutstanding,
    arOverdue,
    arOverdueAmt,
    apOpen,
    apOutstanding,
    apDueSoon,
    apDueSoonAmt,
    apOverdueAmt,
    collected,
    billsPaid,
    expPaid,
    cashOnHand,
    dso,
    taxCollected,
    taxAccrued
  };
}
function finMonthlySeries(months, ar, bills, expenses) {
  var com = {},
    resale = {},
    cogs = {},
    opex = {};
  months.forEach(m => {
    com[m] = 0;
    resale[m] = 0;
    cogs[m] = 0;
    opex[m] = 0;
  });
  ar.forEach(r => {
    var c = finArCompute(r);
    if (!c.counts) return;
    var k = finMonthKey(r.issueDate);
    if (c.type === "commission") {
      if (k in com) com[k] += c.amount;
    } else {
      if (k in resale) resale[k] += c.revenue;
    }
  });
  bills.forEach(b => {
    var k = finMonthKey(b.issueDate),
      amt = parseFloat(b.amount) || 0;
    if (isCogsCat(b.category)) {
      if (k in cogs) cogs[k] += amt;
    } else {
      if (k in opex) opex[k] += amt;
    }
  });
  expenses.forEach(e => {
    var k = finMonthKey(e.date);
    if (k in opex) opex[k] += parseFloat(e.amount) || 0;
  });
  return {
    com: months.map(m => com[m]),
    resale: months.map(m => resale[m]),
    rev: months.map(m => com[m] + resale[m]),
    cogs: months.map(m => cogs[m]),
    opex: months.map(m => opex[m])
  };
}
function FinanceScreen({
  scenario,
  currentUser,
  onOpenOpp
}) {
  var [tab, setTab] = useState("overview");
  var [tick, setTick] = useState(0);
  var refresh = () => setTick(t => t + 1);
  var [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    finSeedIfNeeded(scenario);
    window.cnFinanceRefresh = refresh;
    refresh();
    finSyncPull();
  }, []);
  var ar = useMemo(() => finAllAr(), [tick]);
  var bills = useMemo(() => finRead("bills"), [tick]);
  var expenses = useMemo(() => finRead("expenses"), [tick]);
  var settings = useMemo(() => finReadSettings(), [tick, settingsOpen]);
  var tabs = [{
    id: "overview",
    label: "Overview"
  }, {
    id: "bank",
    label: "Bank"
  }, {
    id: "ar",
    label: "Receivables"
  }, {
    id: "ap",
    label: "Payables"
  }, {
    id: "expenses",
    label: "Expenses"
  }, {
    id: "reports",
    label: "Reports"
  }];
  var shared = {
    ar,
    bills,
    expenses,
    settings,
    scenario,
    currentUser,
    onOpenOpp,
    refresh,
    setTab
  };
  return React.createElement("div", {
    className: "cn-page",
    style: {
      padding: 0,
      gap: 18
    }
  }, React.createElement("header", {
    className: "cn-docs-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Finance"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      marginTop: 4
    }
  }, "Your numbers, in one place"), React.createElement("p", {
    style: {
      color: "var(--cn-mute)",
      margin: "6px 0 0",
      maxWidth: 660,
      fontSize: 13.5
    }
  }, "Bank balances, money in and out, profitability and tax \u2014 a complete read on what you're owed, what you owe, and where cash is heading.")), React.createElement("div", {
    className: "cn-docs-head-actions"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setSettingsOpen(true),
    title: "Opening cash, tax rates, sample data"
  }, "\u2699 Settings"))), React.createElement("div", {
    className: "cn-fin-tabs"
  }, tabs.map(tb => React.createElement("button", {
    key: tb.id,
    className: `cn-fin-tab ${tab === tb.id ? "is-active" : ""}`,
    onClick: () => setTab(tb.id)
  }, tb.label))), tab === "overview" && React.createElement(FinanceOverview, shared), tab === "bank" && React.createElement(window.FinanceBank, shared), tab === "ar" && React.createElement(FinanceReceivables, shared), tab === "ap" && React.createElement(window.FinancePayables, shared), tab === "expenses" && React.createElement(window.FinanceExpenses, shared), tab === "reports" && React.createElement(window.FinanceReports, shared), settingsOpen && React.createElement(window.FinanceSettingsModal, {
    settings: settings,
    onClose: () => setSettingsOpen(false),
    onSaved: () => {
      setSettingsOpen(false);
      refresh();
    }
  }));
}
function FinanceOverview({
  ar,
  bills,
  expenses,
  settings,
  setTab
}) {
  var a = useMemo(() => finAggregate(ar, bills, expenses, settings), [ar, bills, expenses, settings]);
  var months = finRecentMonths(6);
  var series = useMemo(() => finMonthlySeries(months, ar, bills, expenses), [ar, bills, expenses]);
  var curRev = series.rev[series.rev.length - 1];
  var priorRev = series.rev[series.rev.length - 2] || 0;
  var revDelta = priorRev > 0 ? (curRev - priorRev) / priorRev * 100 : null;
  var buckets = ["current", "1-30", "31-60", "61-90", "90+"];
  var agingAmt = {};
  buckets.forEach(b => agingAmt[b] = 0);
  a.arOpen.forEach(x => {
    agingAmt[x.c.bucket] += x.c.balance;
  });
  var agingMax = Math.max(1, ...buckets.map(b => agingAmt[b]));
  var bucketLabel = {
    "current": "Current",
    "1-30": "1–30",
    "31-60": "31–60",
    "61-90": "61–90",
    "90+": "90+"
  };
  var collectList = a.arOpen.slice().sort((x, y) => y.c.daysOverdue - x.c.daysOverdue || y.c.balance - x.c.balance).slice(0, 6);
  var billsDue = a.apOpen.slice().sort((x, y) => (x.c.daysToDue ?? 999) - (y.c.daysToDue ?? 999)).slice(0, 6);
  return React.createElement("div", {
    className: "cn-fin-view"
  }, window.FinBankSummaryCard && React.createElement(window.FinBankSummaryCard, {
    setTab: setTab
  }), React.createElement("section", {
    className: "cn-kpi-row"
  }, React.createElement("div", {
    className: "cn-kpi cn-kpi--hero"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, "Cash on hand"), React.createElement("div", {
    className: "cn-kpi-value"
  }, finFmt(a.cashOnHand, {
    compact: true
  })), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", null, "Opening ", finFmt(settings.openingCash, {
    compact: true
  }), " + collections \u2212 outflows"))), React.createElement("div", {
    className: "cn-kpi"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, "Revenue \xB7 trailing"), React.createElement("div", {
    className: "cn-kpi-value"
  }, finFmt(a.totalRevenue, {
    compact: true
  })), React.createElement("div", {
    className: "cn-kpi-foot"
  }, revDelta != null ? React.createElement("span", null, React.createElement(FinDelta, {
    value: revDelta
  }), React.createElement("span", {
    className: "cn-kpi-foot-sep"
  }, "vs last mo")) : React.createElement("span", null, finFmt(a.commissionIncome, {
    compact: true
  }), " commission"))), React.createElement("div", {
    className: "cn-kpi"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, "Gross margin"), React.createElement("div", {
    className: "cn-kpi-value cn-kpi-value--copper"
  }, a.grossMargin.toFixed(1), React.createElement("span", {
    className: "cn-kpi-unit"
  }, "%")), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", null, finFmt(a.grossProfit, {
    compact: true
  }), " gross profit"))), React.createElement("div", {
    className: "cn-kpi"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, "Net profit \xB7 trailing"), React.createElement("div", {
    className: "cn-kpi-value",
    style: {
      color: a.netProfit >= 0 ? "var(--cn-pos)" : "var(--cn-neg)"
    }
  }, finFmt(a.netProfit, {
    compact: true
  })), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", null, "after ", finFmt(a.opex, {
    compact: true
  }), " operating")))), React.createElement("section", {
    className: "cn-fin-strip"
  }, React.createElement("button", {
    className: "cn-fin-stat",
    onClick: () => setTab("ar")
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Commission pipeline"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: "var(--cn-copper)"
    }
  }, finFmt0(a.commissionPipeline)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "expected, not yet invoiced")), React.createElement("button", {
    className: "cn-fin-stat",
    onClick: () => setTab("ar")
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "A/R outstanding"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(a.arOutstanding)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, a.arOverdueAmt > 0 ? React.createElement("span", {
    className: "cn-neg"
  }, finFmt0(a.arOverdueAmt), " overdue") : React.createElement("span", {
    className: "cn-pos"
  }, "nothing overdue"), " \xB7 ", a.arOpen.length, " open")), React.createElement("button", {
    className: "cn-fin-stat",
    onClick: () => setTab("ap")
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "A/P outstanding"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(a.apOutstanding)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, a.apDueSoonAmt > 0 ? React.createElement("span", {
    className: "cn-warn"
  }, finFmt0(a.apDueSoonAmt), " due \u22647d") : React.createElement("span", null, "none due this week"), " \xB7 ", a.apOpen.length, " open")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "DSO"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, a.dso, React.createElement("span", {
    style: {
      fontSize: 13,
      color: "var(--cn-mute)"
    }
  }, " days")), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, "avg days to collect"))), React.createElement("div", {
    className: "cn-grid-2"
  }, React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Last 6 months"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Revenue vs. total cost"))), React.createElement(FinBarChart, {
    months: months,
    seriesA: series.rev,
    seriesB: months.map((m, i) => series.cogs[i] + series.opex[i]),
    labelA: "Revenue",
    labelB: "Cost (COGS + OpEx)"
  })), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Income mix \xB7 trailing"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Where revenue comes from"))), React.createElement(FinIncomeMix, {
    commission: a.commissionIncome,
    resale: a.resaleRevenue,
    pipeline: a.commissionPipeline
  }))), React.createElement("div", {
    className: "cn-grid-2"
  }, React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Action needed"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Money to collect")), React.createElement("button", {
    className: "cn-link",
    onClick: () => setTab("ar")
  }, "Open A/R \u2192")), collectList.length === 0 ? React.createElement("div", {
    className: "cn-fin-empty"
  }, "\u2713 Nothing outstanding \u2014 collections are current.") : React.createElement("table", {
    className: "cn-table cn-table--tight"
  }, React.createElement("tbody", null, collectList.map(x => React.createElement("tr", {
    key: x.raw.id
  }, React.createElement("td", {
    className: "cn-cell-primary"
  }, x.c.payer), React.createElement("td", null, React.createElement(FinTypeChip, {
    type: x.c.type
  })), React.createElement("td", null, x.c.isOverdue ? React.createElement("span", {
    className: "cn-q-pill cn-q-declined"
  }, x.c.daysOverdue, "d late") : React.createElement("span", {
    className: "cn-cell-secondary"
  }, "due ", finDateLabel(x.raw.dueDate))), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, finFmt0(x.c.balance))))))), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Cash out"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Bills coming due")), React.createElement("button", {
    className: "cn-link",
    onClick: () => setTab("ap")
  }, "Open A/P \u2192")), billsDue.length === 0 ? React.createElement("div", {
    className: "cn-fin-empty"
  }, "No open vendor bills.") : React.createElement("table", {
    className: "cn-table cn-table--tight"
  }, React.createElement("tbody", null, billsDue.map(x => React.createElement("tr", {
    key: x.raw.id
  }, React.createElement("td", {
    className: "cn-cell-primary"
  }, x.raw.vendor), React.createElement("td", {
    className: "cn-cell-secondary"
  }, finDateLabel(x.raw.dueDate)), React.createElement("td", null, x.c.isOverdue ? React.createElement("span", {
    className: "cn-q-pill cn-q-declined"
  }, x.c.daysOverdue, "d late") : x.c.daysToDue <= 7 ? React.createElement("span", {
    className: "cn-q-pill cn-q-sent"
  }, "in ", x.c.daysToDue, "d") : React.createElement("span", {
    className: "cn-cell-secondary"
  }, "in ", x.c.daysToDue, "d")), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, finFmt0(x.c.balance)))))))), React.createElement(FinAgingCard, {
    buckets: buckets,
    agingAmt: agingAmt,
    agingMax: agingMax,
    bucketLabel: bucketLabel,
    setTab: setTab
  }));
}
function FinIncomeMix({
  commission,
  resale,
  pipeline
}) {
  var total = Math.max(1, commission + resale);
  var cPct = commission / total * 100,
    rPct = resale / total * 100;
  return React.createElement("div", {
    className: "cn-fin-mix"
  }, React.createElement("div", {
    className: "cn-fin-mix-bar"
  }, React.createElement("span", {
    className: "cn-fin-mix-seg cn-fin-mix-seg--com",
    style: {
      width: cPct + "%"
    },
    title: "Commission"
  }), React.createElement("span", {
    className: "cn-fin-mix-seg cn-fin-mix-seg--res",
    style: {
      width: rPct + "%"
    },
    title: "Resale"
  })), React.createElement("div", {
    className: "cn-fin-mix-rows"
  }, React.createElement("div", {
    className: "cn-fin-mix-row"
  }, React.createElement("span", null, React.createElement("i", {
    className: "cn-fin-dot cn-fin-dot--com"
  }), "Commission income"), React.createElement("span", {
    className: "cn-mono"
  }, finFmt0(commission), " \xB7 ", cPct.toFixed(0), "%")), React.createElement("div", {
    className: "cn-fin-mix-row"
  }, React.createElement("span", null, React.createElement("i", {
    className: "cn-fin-dot cn-fin-dot--res"
  }), "Resale revenue"), React.createElement("span", {
    className: "cn-mono"
  }, finFmt0(resale), " \xB7 ", rPct.toFixed(0), "%")), React.createElement("div", {
    className: "cn-fin-mix-row cn-fin-mix-row--muted"
  }, React.createElement("span", null, "Commission pipeline (expected)"), React.createElement("span", {
    className: "cn-mono"
  }, finFmt0(pipeline)))));
}
function FinAgingCard({
  buckets,
  agingAmt,
  agingMax,
  bucketLabel,
  setTab
}) {
  return React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Receivables aging"), React.createElement("h2", {
    className: "cn-card-title"
  }, "How late we're getting paid")), React.createElement("button", {
    className: "cn-link",
    onClick: () => setTab("ar")
  }, "Open A/R \u2192")), React.createElement("div", {
    className: "cn-fin-aging"
  }, buckets.map(b => React.createElement("div", {
    key: b,
    className: "cn-fin-aging-row"
  }, React.createElement("span", {
    className: "cn-fin-aging-label"
  }, bucketLabel[b]), React.createElement("span", {
    className: "cn-fin-aging-track"
  }, React.createElement("span", {
    className: `cn-fin-aging-fill ${b === "current" ? "is-current" : "is-late"}`,
    style: {
      width: `${agingAmt[b] / agingMax * 100}%`
    }
  })), React.createElement("span", {
    className: "cn-fin-aging-amt cn-mono"
  }, finFmt0(agingAmt[b]))))));
}
function FinanceReceivables({
  ar,
  bills,
  expenses,
  settings,
  scenario,
  refresh
}) {
  var [filter, setFilter] = useState("open");
  var [typeF, setTypeF] = useState("all");
  var [q, setQ] = useState("");
  var [payFor, setPayFor] = useState(null);
  var [editing, setEditing] = useState(null);
  var rows = useMemo(() => ar.map(r => ({
    raw: r,
    c: finArCompute(r)
  })), [ar]);
  var counts = {
    pipeline: rows.filter(x => x.c.isExpected).length,
    open: rows.filter(x => x.c.balance > 0).length,
    paid: rows.filter(x => x.c.isPaid).length,
    all: rows.filter(x => !x.c.isVoid).length
  };
  var filtered = rows.filter(x => {
    if (x.c.isVoid) return false;
    if (typeF !== "all" && x.c.type !== typeF) return false;
    if (filter === "pipeline" && !x.c.isExpected) return false;
    if (filter === "open" && x.c.balance <= 0) return false;
    if (filter === "paid" && !x.c.isPaid) return false;
    if (q) {
      var s = q.toLowerCase();
      if (!((x.c.payer || "").toLowerCase().includes(s) || (x.raw.buyer || "").toLowerCase().includes(s) || (x.raw.recordNumber || x.raw.docNumber || "").toLowerCase().includes(s))) return false;
    }
    return true;
  }).sort((x, y) => new Date(y.raw.issueDate) - new Date(x.raw.issueDate));
  var a = finAggregate(ar, bills, expenses, settings);
  var collected = rows.filter(x => x.c.isPaid).reduce((s, x) => s + x.c.total, 0);
  var markInvoiced = x => {
    var due = finAddDays(finISO(finToday()), 30);
    finSetArPayment(x.raw, {
      status: "invoiced",
      issueDate: x.raw.issueDate || finISO(finToday()),
      dueDate: due
    });
    refresh();
    window.cnToast && window.cnToast({
      title: "Marked invoiced",
      sub: `${x.c.payer} · ${finFmt0(x.c.amount)} — due in 30 days`
    });
  };
  var recordPayment = (x, method, ref) => {
    finSetArPayment(x.raw, {
      status: "paid",
      paidAt: new Date().toISOString(),
      paymentMethodUsed: method,
      paymentReference: ref
    });
    setPayFor(null);
    refresh();
    window.cnToast && window.cnToast({
      title: "Payment recorded",
      sub: `${x.c.payer} · ${finFmt0(x.c.total)}`
    });
  };
  var undo = x => {
    var back = x.c.type === "commission" ? "invoiced" : "sent";
    finSetArPayment(x.raw, {
      status: back,
      paidAt: null
    });
    refresh();
  };
  var saveRec = rec => {
    finSaveAr(rec);
    setEditing(null);
    refresh();
  };
  var delRec = id => {
    if (!confirm("Delete this record?")) return;
    finDeleteAr(id);
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
  }, "Pipeline (expected)"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: "var(--cn-copper)"
    }
  }, finFmt0(a.commissionPipeline)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, counts.pipeline, " commissions")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Outstanding"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono"
  }, finFmt0(a.arOutstanding)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, a.arOpen.length, " invoiced & open")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Overdue"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: a.arOverdueAmt > 0 ? "var(--cn-neg)" : "inherit"
    }
  }, finFmt0(a.arOverdueAmt)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, a.arOverdue.length, " past due")), React.createElement("div", {
    className: "cn-fin-stat cn-fin-stat--plain"
  }, React.createElement("div", {
    className: "cn-fin-stat-label"
  }, "Collected"), React.createElement("div", {
    className: "cn-fin-stat-val cn-mono",
    style: {
      color: "var(--cn-pos)"
    }
  }, finFmt0(collected)), React.createElement("div", {
    className: "cn-fin-stat-sub"
  }, counts.paid, " paid"))), React.createElement("div", {
    className: "cn-toolbar",
    style: {
      marginTop: 4
    }
  }, React.createElement("div", {
    className: "cn-tabs"
  }, [["pipeline", "Pipeline"], ["open", "Open"], ["paid", "Paid"], ["all", "All"]].map(([id, label]) => React.createElement("button", {
    key: id,
    className: `cn-tab ${filter === id ? "is-active" : ""}`,
    onClick: () => setFilter(id)
  }, label, " ", React.createElement("span", {
    className: "cn-fin-tabcount"
  }, counts[id])))), React.createElement("div", {
    className: "cn-toolbar-right"
  }, React.createElement("div", {
    className: "cn-segmented"
  }, [["all", "All"], ["commission", "Commission"], ["resale", "Resale"]].map(([id, label]) => React.createElement("button", {
    key: id,
    className: typeF === id ? "is-active" : "",
    onClick: () => setTypeF(id)
  }, label))), React.createElement("input", {
    className: "cn-input",
    placeholder: "Search payer / deal\u2026",
    value: q,
    onChange: e => setQ(e.target.value),
    style: {
      width: 200
    }
  }), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setEditing("new")
  }, "+ New"))), React.createElement("section", {
    className: "cn-card cn-card--flush"
  }, filtered.length === 0 ? React.createElement("div", {
    className: "cn-fin-empty",
    style: {
      padding: 40
    }
  }, "Nothing here. Log a commission you're owed, or create resale invoices in ", React.createElement("strong", null, "Sales Hub"), " \u2014 they flow into A/R automatically.") : React.createElement("table", {
    className: "cn-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Payer"), React.createElement("th", null, "Type"), React.createElement("th", null, "Detail"), React.createElement("th", null, "Issued"), React.createElement("th", null, "Due"), React.createElement("th", null, "Status"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Amount"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Balance"), React.createElement("th", null))), React.createElement("tbody", null, filtered.map(x => React.createElement("tr", {
    key: x.raw.id,
    className: "cn-tr-link",
    onClick: () => x.raw._src !== "saleshub" && setEditing(x.raw)
  }, React.createElement("td", {
    className: "cn-cell-primary"
  }, x.c.payer, x.raw._src === "saleshub" && React.createElement("span", {
    className: "cn-fin-src",
    title: "From Sales Hub"
  }, "\u21A9")), React.createElement("td", null, React.createElement(FinTypeChip, {
    type: x.c.type
  })), React.createElement("td", {
    className: "cn-cell-secondary"
  }, x.c.type === "commission" ? React.createElement("span", null, x.raw.buyer || "—", x.c.dealValue ? React.createElement("span", null, " \xB7 ", finFmt0(x.c.dealValue), " @ ", x.c.rate, "%") : "") : React.createElement("span", {
    className: "cn-mono"
  }, x.raw.docNumber || "resale")), React.createElement("td", {
    className: "cn-cell-secondary"
  }, finDateLabel(x.raw.issueDate)), React.createElement("td", {
    className: "cn-cell-secondary"
  }, x.raw.dueDate ? finDateLabel(x.raw.dueDate) : "—"), React.createElement("td", null, React.createElement(FinStatusPill, {
    computed: x.c
  })), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right"
    }
  }, finFmt0(x.c.amount)), React.createElement("td", {
    className: "cn-mono",
    style: {
      textAlign: "right",
      color: x.c.balance > 0 ? "var(--cn-ink)" : "var(--cn-mute)"
    }
  }, x.c.balance > 0 ? finFmt0(x.c.balance) : "—"), React.createElement("td", {
    style: {
      textAlign: "right"
    },
    onClick: e => e.stopPropagation()
  }, x.c.isExpected && React.createElement("button", {
    className: "cn-link",
    onClick: () => markInvoiced(x)
  }, "Mark invoiced"), x.c.balance > 0 && !x.c.isExpected && React.createElement("button", {
    className: "cn-link",
    onClick: () => setPayFor(x)
  }, "Record payment"), x.c.isPaid && React.createElement("button", {
    className: "cn-link cn-cell-secondary",
    onClick: () => undo(x)
  }, "Undo"))))))), payFor && React.createElement(FinRecordPaymentModal, {
    x: payFor,
    onClose: () => setPayFor(null),
    onRecord: recordPayment
  }), editing && React.createElement(window.FinArEditor, {
    rec: editing === "new" ? null : editing,
    scenario: scenario,
    onClose: () => setEditing(null),
    onSave: saveRec,
    onDelete: delRec
  }));
}
function FinRecordPaymentModal({
  x,
  onClose,
  onRecord
}) {
  var [method, setMethod] = useState("Wire transfer");
  var [ref, setRef] = useState("");
  var isComm = x.c.type === "commission";
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
      width: 460
    }
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Record ", isComm ? "commission" : "payment"), React.createElement("h2", {
    className: "cn-modal-title"
  }, x.c.payer)), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-fin-paysum"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, isComm ? "Vendor" : "Customer"), React.createElement("div", {
    style: {
      fontWeight: 500
    }
  }, x.c.payer)), React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Amount"), React.createElement("div", {
    className: "cn-mono",
    style: {
      fontSize: 20,
      fontWeight: 600
    }
  }, finFmt0(x.c.total)))), React.createElement("div", {
    className: "cn-field-row",
    style: {
      marginTop: 14
    }
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Method"), React.createElement("select", {
    className: "cn-input",
    value: method,
    onChange: e => setMethod(e.target.value)
  }, ["Wire transfer", "ACH", "Check", "Credit card", "Other"].map(m => React.createElement("option", {
    key: m
  }, m)))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.3
    }
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
    value: ref,
    onChange: e => setRef(e.target.value),
    placeholder: "Wire #, check #\u2026"
  })))), React.createElement("footer", {
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
    onClick: () => onRecord(x, method, ref)
  }, "Mark paid \xB7 ", finFmt0(x.c.total))))));
}
Object.assign(window, {
  FinanceScreen,
  FinanceOverview,
  FinanceReceivables,
  FinRecordPaymentModal,
  FinBarChart,
  FinStatusPill,
  FinApStatusPill,
  FinTypeChip,
  FinDelta,
  FinIncomeMix,
  FinAgingCard,
  finAggregate,
  finMonthlySeries,
  finRecentMonths,
  finMonthKey,
  finMonthLabel,
  finDateLabel,
  finFmt,
  finFmt0,
  finRead,
  finWrite,
  finReadSettings,
  finWriteSettings,
  finArCompute,
  finBillCompute,
  finAddDays,
  finISO,
  finToday,
  finDays,
  finParse,
  finWipeSample,
  finSaveAr,
  finDeleteAr,
  finAllAr,
  finSetArPayment,
  finBankAccounts,
  finBankTxns,
  finAccountBalance,
  finAccountReconciled,
  finBankCash,
  finSaveAccount,
  finDeleteAccount,
  finSaveTxn,
  finDeleteTxn,
  FIN_ID,
  FIN_KEYS,
  FIN_BILL_CATS,
  FIN_COGS_CATS,
  FIN_OPEX_CATS,
  FIN_EXPENSE_CATS,
  isCogsCat
});