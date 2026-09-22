var DOC_GUIDE_ROLES = {
  sign: {
    label: "They sign & return",
    tone: "sign"
  },
  file: {
    label: "For their file",
    tone: "file"
  },
  context: {
    label: "Context / pitch",
    tone: "ctx"
  },
  internal: {
    label: "Internal only",
    tone: "int"
  }
};
var DOC_GUIDES = [{
  id: "new-counterparty",
  code: "01",
  label: "New counterparty",
  when: "Before either side discloses supply, pricing, or who the buyer is.",
  outcome: "Both sides covered, so the real detail can be discussed openly.",
  steps: [{
    match: ["doc-cn-ncnda", "doc-ssp-ncnda", /ncnda/i],
    role: "sign",
    note: "Mutual NDA + non-circumvent — it binds us as much as them. Neither side discloses the other's information, neither side goes around the other. Always first."
  }, {
    match: ["doc-cn-kyc-prequal", "doc-ssp-kyc-prequal", /pre-?qualification/i],
    role: "sign",
    note: "OEM-neutral KYC. Who the end user is, what they need, where it lands — the detail partners price and commit allocation against. Goes out with the NDA, not after it."
  }]
}, {
  id: "partner-neocloud",
  code: "02",
  label: "Partnership — neocloud / GPU cloud",
  when: "A compute provider wants to sell capacity through us, or buy allocation with us.",
  outcome: "Signed partnership plus a qualified picture of what they actually need.",
  steps: [{
    match: ["doc-cn-neocloud-pa", "doc-ssp-neocloud-pa", /neocloud/i],
    role: "sign",
    note: "The agreement itself."
  }, {
    match: ["doc-cn-gpuaas-qual", "doc-ssp-gpuaas-qual", /gpuaas qualification/i],
    role: "sign",
    note: "Workload, term, power, budget. Send before you quote anything."
  }]
}, {
  id: "partner-operator",
  code: "03",
  label: "Partnership — data-center operator",
  when: "A colo / DC operator partners on a buildout, decom, or hardware refresh.",
  outcome: "Signed partnership plus the site detail needed to size the job.",
  steps: [{
    match: ["doc-cn-operator-pa", "doc-ssp-operator-pa", /operator (partnership )?agreement/i],
    role: "sign",
    note: "The agreement itself."
  }, {
    match: ["doc-cn-dc-intake", "doc-ssp-dc-qual", /data cent(er|re) (intake|capacity)/i],
    role: "sign",
    note: "Space, power, cooling, timeline. Without this you're guessing at the rack count."
  }]
}, {
  id: "referral-agent",
  code: "04",
  label: "Referral agent",
  when: "Someone wants to introduce buyers or supply on commission.",
  outcome: "Commission terms in writing before the first introduction.",
  steps: [{
    match: ["doc-referral-agent", /referral agent/i],
    role: "sign",
    note: "Defines the commission, the term, and what counts as their introduction."
  }]
}, {
  id: "oem-dell",
  code: "05",
  label: "OEM compliance — Dell",
  when: "Any order that routes through Dell. Do this before quoting, not after.",
  outcome: "Customer cleared for Dell ordering.",
  steps: [{
    match: ["doc-dell-kyc-scoring", /dell.*kyc/i],
    role: "sign",
    note: "KYC risk scoring. The gate on every Dell order."
  }, {
    match: ["doc-dell-redflags", /red flags/i],
    role: "file",
    note: "Diversion red flags — clear these alongside the scoring."
  }]
}, {
  id: "oem-supermicro",
  code: "06",
  label: "OEM compliance — Supermicro",
  when: "SMC systems, including B300 / B200 configurations.",
  outcome: "Customer cleared for SMC ordering, GPU lines included.",
  steps: [{
    match: ["doc-smc-euc", /supermicro - end-user certification/i],
    role: "sign",
    note: "Baseline end-user certification."
  }, {
    match: ["doc-smc-gpu-euc", /gpu capable end-user/i],
    role: "sign",
    note: "The GPU-specific version. Required for B300 / B200 — easy one to miss."
  }, {
    match: ["doc-smc-dca", /supermicro.*data centre attestation/i],
    role: "sign",
    note: "Attests the destination is a real data center."
  }, {
    match: ["doc-smc-aic-hq", /advanced ic/i],
    role: "sign",
    note: "Advanced-IC and HQ certification for export-controlled silicon."
  }]
}, {
  id: "oem-lenovo-giga",
  code: "07",
  label: "OEM compliance — Lenovo & Giga",
  when: "An order routing through Lenovo or Giga Computing.",
  outcome: "Customer cleared on both OEMs.",
  steps: [{
    match: ["doc-lenovo-euc", /lenovo.*end user certification/i],
    role: "sign",
    note: "Lenovo end-user certification."
  }, {
    match: ["doc-lenovo-dca", /lenovo.*data centre attestation/i],
    role: "sign",
    note: "Lenovo destination-site attestation."
  }, {
    match: ["doc-giga-soa", /statement of assurance/i],
    role: "sign",
    note: "Giga Computing end-use assurance."
  }]
}, {
  id: "rack-build",
  code: "08",
  label: "Quoting a rack build",
  when: "A buyer is deciding between configurations or asks what's in a rack.",
  outcome: "Line-level answer on parts, quantities and vendors.",
  steps: [{
    match: ["doc-vr-nvl144-bom", /nvl144|vera rubin/i],
    role: "context",
    note: "L10 compute tray and L11 rack BOM — qty per rack and vendor on every line."
  }]
}];
function resolveGuide(guide, docs) {
  var steps = guide.steps.map(s => {
    var doc = null;
    var _loop = function (m) {
      if (typeof m === "string") doc = docs.find(d => d.id === m);else doc = docs.find(d => m.test(d.title || "") || m.test(d.fileName || ""));
      if (doc) return 1;
    };
    for (var m of s.match) {
      if (_loop(m)) break;
    }
    return {
      ...s,
      doc
    };
  });
  return {
    ...guide,
    steps,
    found: steps.filter(s => s.doc).length,
    total: steps.length
  };
}
function _dgExt(doc) {
  var n = doc.fileName || doc.title || "";
  var e = n.includes(".") ? n.split(".").pop() : "";
  return (e || "doc").toUpperCase().slice(0, 4);
}
function DocGuides({
  docs,
  onSend,
  onOpen,
  activeId,
  onActivate
}) {
  var resolved = DOC_GUIDES.map(g => resolveGuide(g, docs));
  var active = resolved.find(g => g.id === activeId) || resolved[0];
  return React.createElement("div", {
    className: "cn-dg"
  }, React.createElement("nav", {
    className: "cn-dg-rail"
  }, React.createElement("div", {
    className: "cn-dg-rail-head"
  }, "Scenario"), resolved.map(g => React.createElement("button", {
    key: g.id,
    className: `cn-dg-rail-item ${g.id === active.id ? "is-active" : ""}`,
    onClick: () => onActivate(g.id)
  }, React.createElement("span", {
    className: "cn-dg-rail-code"
  }, g.code), React.createElement("span", {
    className: "cn-dg-rail-label"
  }, g.label), React.createElement("span", {
    className: "cn-dg-rail-count"
  }, g.found, "/", g.total)))), React.createElement("section", {
    className: "cn-dg-panel"
  }, React.createElement("header", {
    className: "cn-dg-panel-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-dg-panel-code"
  }, "Scenario ", active.code), React.createElement("h3", {
    className: "cn-dg-panel-title"
  }, active.label)), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    disabled: active.found === 0,
    onClick: () => onSend(active.steps.filter(s => s.doc).map(s => s.doc))
  }, "\u2709 Send the set (", active.found, ")")), React.createElement("dl", {
    className: "cn-dg-facts"
  }, React.createElement("div", null, React.createElement("dt", null, "Use when"), React.createElement("dd", null, active.when)), React.createElement("div", null, React.createElement("dt", null, "What it gets you"), React.createElement("dd", null, active.outcome)), React.createElement("div", null, React.createElement("dt", null, "Email"), React.createElement("dd", null, "Written for this scenario \u2014 read and edit it in the send window before it goes."))), React.createElement("ol", {
    className: "cn-dg-steps"
  }, active.steps.map((s, i) => {
    var role = DOC_GUIDE_ROLES[s.role];
    return React.createElement("li", {
      key: i,
      className: `cn-dg-step ${s.doc ? "" : "is-missing"}`
    }, React.createElement("span", {
      className: "cn-dg-step-n"
    }, String(i + 1).padStart(2, "0")), React.createElement("div", {
      className: "cn-dg-step-main"
    }, React.createElement("div", {
      className: "cn-dg-step-top"
    }, s.doc ? React.createElement("button", {
      className: "cn-dg-step-title",
      onClick: () => onOpen(s.doc)
    }, s.doc.title) : React.createElement("span", {
      className: "cn-dg-step-title is-missing"
    }, "Not in the library yet"), React.createElement("span", {
      className: `cn-dg-role cn-dg-role--${role.tone}`
    }, role.label), s.doc ? React.createElement("span", {
      className: "cn-dg-step-ext"
    }, _dgExt(s.doc)) : null), React.createElement("div", {
      className: "cn-dg-step-note"
    }, s.note)), s.doc && React.createElement("button", {
      className: "cn-dg-step-send",
      onClick: () => onSend([s.doc]),
      title: "Send just this one"
    }, "Send \u2192"));
  })), active.found < active.total && React.createElement("div", {
    className: "cn-dg-gap"
  }, active.total - active.found, " document", active.total - active.found === 1 ? "" : "s", " in this scenario ", active.total - active.found === 1 ? "isn't" : "aren't", " in the library. Upload ", active.total - active.found === 1 ? "it" : "them", " and the scenario completes itself.")));
}
Object.assign(window, {
  DOC_GUIDES,
  DOC_GUIDE_ROLES,
  resolveGuide,
  DocGuides
});