var ECON_HOURS_PER_YEAR = 24 * 365;
var econNum = v => {
  var n = parseFloat(String(v ?? "").replace(/[^\d.-]/g, ""));
  return isNaN(n) ? 0 : n;
};
function econYears(term) {
  var t = String(term || "").trim();
  if (!t) return 0;
  var n = econNum(t);
  if (!n) return 0;
  return /mo/i.test(t) ? n / 12 : n;
}
function econDownPct(v) {
  var n = econNum(v);
  if (!n) return 0;
  return n > 0 && n <= 1 ? n * 100 : n;
}
var GPU_PRICED_KINDS = ["gpu", "baremetal"];
function econGpuCount(line) {
  if (!GPU_PRICED_KINDS.includes(line.kind || "gpu")) return 0;
  var nodes = econNum(line.nodes);
  var per = econNum(line.gpusPerNode);
  if (nodes && per) return nodes * per;
  if (nodes && !per) return nodes;
  if (/gpu/i.test(line.unit || "")) return econNum(line.available) || econNum(line.total);
  return 0;
}
function econTCV(line) {
  if (!GPU_PRICED_KINDS.includes(line.kind || "gpu")) return 0;
  var rate = econNum(line.rate);
  var years = econYears(line.term);
  var gpus = econGpuCount(line);
  if (!rate || !years || !gpus) return 0;
  return rate * gpus * ECON_HOURS_PER_YEAR * years;
}
function econDeposit(line) {
  var pct = econDownPct(line.deposit);
  var tcv = econTCV(line);
  return pct && tcv ? tcv * (pct / 100) : 0;
}
function econAnnual(line) {
  var years = econYears(line.term);
  var tcv = econTCV(line);
  return years ? tcv / years : 0;
}
function econSummary(line) {
  var gpus = econGpuCount(line);
  var tcv = econTCV(line);
  return {
    nodes: econNum(line.nodes),
    gpusPerNode: econNum(line.gpusPerNode),
    gpus,
    years: econYears(line.term),
    rate: econNum(line.rate),
    downPct: econDownPct(line.deposit),
    tcv,
    deposit: econDeposit(line),
    annual: econAnnual(line)
  };
}
var econUSD = (n, compact) => {
  if (!n) return "—";
  if (compact) {
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2).replace(/\.00$/, "") + "B";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return "$" + Math.round(n / 1e3) + "K";
  }
  return "$" + Math.round(n).toLocaleString("en-US");
};
var CAP_KINDS = [{
  id: "gpu",
  label: "GPU cluster",
  hint: "Hourly GPU capacity"
}, {
  id: "baremetal",
  label: "Bare-metal",
  hint: "Dedicated nodes"
}, {
  id: "dc",
  label: "Data center / MW",
  hint: "Power, space, colo"
}, {
  id: "network",
  label: "Networking",
  hint: "Transit and peering"
}, {
  id: "storage",
  label: "Storage",
  hint: "Capacity and IOPS"
}, {
  id: "hardware",
  label: "Hardware / gear",
  hint: "Boxed kit: model, qty, unit price"
}];
var capKindMeta = id => CAP_KINDS.find(k => k.id === id) || CAP_KINDS[0];
function capKindForSpecialties(specs) {
  var s = (specs || []).join(" ").toLowerCase();
  if (/mw|power|colo|data ?cent/.test(s)) return "dc";
  if (/bare/.test(s)) return "baremetal";
  if (/network/.test(s)) return "network";
  if (/storage/.test(s)) return "storage";
  if (/hardware|gear|switch|optic|nic/.test(s)) return "hardware";
  return "gpu";
}
var CAP_FIELDS = {
  gpu: {
    qty: [{
      k: "nodes",
      label: "Nodes",
      ph: "256",
      w: 1
    }, {
      k: "gpusPerNode",
      label: "GPUs / node",
      ph: "8",
      w: 1
    }],
    terms: [{
      k: "rate",
      label: "Price",
      ph: "3.65",
      w: 1.5,
      prefix: "$",
      suffix: "/GPU-hr"
    }, {
      k: "term",
      label: "Term",
      ph: "5Y",
      w: .8
    }, {
      k: "deposit",
      label: "Down payment",
      ph: "20%",
      w: 1
    }, {
      k: "leadTime",
      label: "Lead time",
      ph: "90 days",
      w: 1
    }, {
      k: "cooling",
      label: "Cooling",
      w: 1.6,
      type: "choice",
      options: ["Liquid", "Air"]
    }]
  },
  baremetal: {
    qty: [{
      k: "nodes",
      label: "Nodes",
      ph: "64",
      w: 1
    }, {
      k: "gpusPerNode",
      label: "GPUs / node",
      ph: "8",
      w: 1
    }],
    terms: [{
      k: "rate",
      label: "Price",
      ph: "3.65",
      w: 1.5,
      prefix: "$",
      suffix: "/GPU-hr"
    }, {
      k: "term",
      label: "Term",
      ph: "3Y",
      w: .8
    }, {
      k: "deposit",
      label: "Down payment",
      ph: "20%",
      w: 1
    }]
  },
  dc: {
    qty: [{
      k: "nodes",
      label: "MW contracted",
      ph: "8",
      w: 1
    }],
    terms: [{
      k: "powerCost",
      label: "Power cost",
      ph: "0.065",
      w: 1.5,
      prefix: "$",
      suffix: "/kWh"
    }, {
      k: "pue",
      label: "PUE",
      ph: "1.25",
      w: .7
    }, {
      k: "tier",
      label: "Tier",
      w: 2.2,
      type: "choice",
      options: ["Tier II", "Tier III", "Tier IV"]
    }, {
      k: "cooling",
      label: "Cooling",
      w: 2.4,
      type: "choice",
      options: ["Liquid", "Air", "Immersion"]
    }, {
      k: "readyDate",
      label: "Ready date",
      ph: "Q2 2027",
      w: 1.5
    }, {
      k: "term",
      label: "Term",
      ph: "10Y",
      w: .8
    }, {
      k: "deposit",
      label: "Down payment",
      ph: "20%",
      w: 1
    }]
  },
  network: {
    qty: [{
      k: "uplink",
      label: "Uplink",
      ph: "400",
      w: 1,
      suffix: "Gbps"
    }],
    terms: [{
      k: "transitType",
      label: "Type",
      w: 2,
      type: "choice",
      options: ["Transit", "Peering", "Both"]
    }, {
      k: "rate",
      label: "Price",
      ph: "0.40",
      w: 1,
      prefix: "$",
      suffix: "/Mbps"
    }, {
      k: "term",
      label: "Term",
      ph: "3Y",
      w: .8
    }]
  },
  // Boxed kit. Deliberately short: model, how many, what each costs. Anything
  // else a line needs is a per-line custom field, not a field for everyone.
  hardware: {
    qty: [{
      k: "nodes",
      label: "Qty",
      ph: "24",
      w: 1
    }],
    terms: [{
      k: "rate",
      label: "Unit price",
      ph: "1,850",
      w: 1.5,
      prefix: "$",
      suffix: "ea"
    }, {
      k: "condition",
      label: "Condition",
      w: 2.4,
      type: "choice",
      options: ["New", "Refurb", "Used"]
    }, {
      k: "leadTime",
      label: "Lead time",
      ph: "2 weeks",
      w: 1
    }, {
      k: "warranty",
      label: "Warranty",
      ph: "1Y",
      w: .8
    }]
  },
  storage: {
    qty: [{
      k: "nodes",
      label: "Capacity",
      ph: "500",
      w: 1,
      suffix: "TB"
    }],
    terms: [{
      k: "storageType",
      label: "Type",
      w: 2.6,
      type: "choice",
      options: ["NVMe", "SSD", "HDD", "Object"]
    }, {
      k: "iops",
      label: "IOPS",
      ph: "1M",
      w: 1
    }, {
      k: "rate",
      label: "Price",
      ph: "18",
      w: 1,
      prefix: "$",
      suffix: "/TB/mo"
    }, {
      k: "term",
      label: "Term",
      ph: "3Y",
      w: .8
    }]
  }
};
var capFields = kind => CAP_FIELDS[kind] || CAP_FIELDS.gpu;
function capTermsLine(line) {
  var kind = line.kind || "gpu";
  var out = [];
  var r = String(line.rate || "").trim();
  if (r) {
    var f = capFields(kind).terms.find(x => x.k === "rate");
    out.push((f?.prefix || "") + r + (f?.suffix || ""));
  }
  if (line.powerCost) out.push("$" + line.powerCost + "/kWh");
  if (line.pue) out.push("PUE " + line.pue);
  if (line.tier) out.push(line.tier);
  if (line.term) out.push(String(line.term).trim());
  if (line.deposit) out.push(String(line.deposit).trim().replace(/\s*down\s*$/i, "") + " down");
  if (line.condition) out.push(line.condition);
  if (line.warranty) out.push(line.warranty + " warranty");
  if (line.cooling) out.push(line.cooling);
  if (line.leadTime) out.push(line.leadTime + " lead");
  (Array.isArray(line.extras) ? line.extras : []).forEach(function (x) {
    if (x && String(x.value || "").trim()) {
      out.push((String(x.label || "").trim() ? x.label + " " : "") + x.value);
    }
  });
  if (line.readyDate) out.push("ready " + line.readyDate);
  return out.join(" · ");
}
function capQtyLine(line) {
  var s = econSummary(line);
  var kind = line.kind || "gpu";
  if (kind === "dc") return econNum(line.nodes) ? econNum(line.nodes) + " MW contracted" : "";
  if (kind === "storage") return econNum(line.nodes) ? econNum(line.nodes) + " TB" : "";
  if (kind === "network") return line.uplink ? line.uplink + " Gbps" : "";
  if (kind === "hardware") return econNum(line.nodes) ? econNum(line.nodes).toLocaleString() + " units" : "";
  var parts = [];
  if (s.nodes) parts.push(s.nodes.toLocaleString() + " nodes");
  if (s.gpus && s.gpus !== s.nodes) parts.push(s.gpus.toLocaleString() + " GPUs");
  return parts.join(" · ");
}
Object.assign(window, {
  cnEcon: {
    summary: econSummary,
    tcv: econTCV,
    deposit: econDeposit,
    annual: econAnnual,
    gpuCount: econGpuCount,
    years: econYears,
    downPct: econDownPct,
    usd: econUSD,
    hoursPerYear: ECON_HOURS_PER_YEAR
  },
  cnCapKinds: CAP_KINDS,
  cnCapKindMeta: capKindMeta,
  cnCapFields: capFields,
  cnCapKindForSpecialties: capKindForSpecialties,
  cnCapTermsLine: capTermsLine,
  cnCapQtyLine: capQtyLine
});