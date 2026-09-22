var PARTNER_KEY = "cn-partners-v1";
var paToday = () => window.cnDay();
function paTimeAgo(iso) {
  if (!iso) return "never";
  var d = window.cnParseDay(iso);
  if (isNaN(d)) return "";
  var days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return days + "d ago";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}
var paInitials = n => (n || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
var paNum = v => {
  var n = parseFloat(String(v).replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
};
function readPartners() {
  try {
    return JSON.parse(localStorage.getItem(PARTNER_KEY) || "[]");
  } catch {
    return [];
  }
}
function writePartners(list) {
  try {
    localStorage.setItem(PARTNER_KEY, JSON.stringify(list));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("cn-partners-changed"));
  } catch {}
}
function upsertPartner(rec, ownerRep) {
  if (window.cnPartnerSync) window.cnPartnerSync.upsertPartnerRemote(rec, ownerRep);
  var list = readPartners();
  var i = list.findIndex(x => x.id === rec.id);
  if (i >= 0) list[i] = rec;else list.unshift(rec);
  writePartners(list);
  return rec;
}
function deletePartner(id) {
  if (window.cnPartnerSync) window.cnPartnerSync.deletePartnerRemote(id);
  writePartners(readPartners().filter(x => x.id !== id));
}
function newPartner() {
  return {
    id: "pa-" + Math.random().toString(36).slice(2, 9),
    name: "",
    org: "",
    email: "",
    region: "",
    specialties: [],
    status: "active",
    capacity: [],
    notes: "",
    updatedAt: new Date().toISOString()
  };
}
function newCapLine(kind) {
  return {
    id: "cap-" + Math.random().toString(36).slice(2, 7),
    kind: kind || "gpu",
    resource: "",
    region: "",
    nodes: "",
    gpusPerNode: "",
    rate: "",
    term: "",
    deposit: ""
  };
}
function paRate(line) {
  var r = String(line.rate || "").trim();
  if (!r) return "";
  var money = /^[\d.,]+$/.test(r) ? "$" + r : r;
  return money + (line.rateUnit ? "/" + line.rateUnit : "");
}
function paTerms(line) {
  return [paRate(line), String(line.term || "").trim(), String(line.deposit || "").trim()].filter(Boolean).join(" · ");
}
window.cnPaTerms = paTerms;
var PA_STATUS = [{
  id: "active",
  label: "Open",
  tone: "good"
}, {
  id: "limited",
  label: "Limited",
  tone: "warn"
}, {
  id: "full",
  label: "At capacity",
  tone: "mute"
}];
var paStatusMeta = id => PA_STATUS.find(s => s.id === id) || PA_STATUS[0];
var SPECIALTIES = ["GPU", "Bare-metal", "Data center / MW", "Networking", "Storage", "Cooling"];
function partnerAvail(p) {
  return (p.capacity || []).reduce((s, c) => s + (window.cnEcon ? window.cnEcon.gpuCount(c) : 0), 0);
}
function partnerTCV(p) {
  return (p.capacity || []).reduce((s, c) => s + (window.cnEcon ? window.cnEcon.tcv(c) : 0), 0);
}
window.cnPaNum = paNum;
window.cnPartners = {
  read: readPartners,
  match(query) {
    var q = (query || "").toLowerCase();
    return readPartners().filter(p => p.status !== "full" && (p.capacity || []).some(c => paNum(c.available) > 0 && (!q || (c.resource + " " + c.region + " " + p.specialties.join(" ") + " " + p.region).toLowerCase().includes(q))));
  }
};
function CapBar({
  line
}) {
  var qty = window.cnCapQtyLine ? window.cnCapQtyLine(line) : "";
  var terms = window.cnCapTermsLine ? window.cnCapTermsLine(line) : "";
  var tcv = window.cnEcon ? window.cnEcon.tcv(line) : 0;
  return React.createElement("div", {
    className: "cn-pa-cap"
  }, React.createElement("div", {
    className: "cn-pa-cap-head"
  }, React.createElement("span", {
    className: "cn-pa-cap-res"
  }, line.resource || "Resource"), qty && React.createElement("span", {
    className: "cn-pa-cap-nums"
  }, qty)), terms && React.createElement("div", {
    className: "cn-pa-cap-terms"
  }, terms), tcv > 0 && React.createElement("div", {
    className: "cn-pa-cap-tcv"
  }, window.cnEcon.usd(tcv, true), " TCV"));
}
function capSpan(fd) {
  if (fd.type === "choice") return (fd.options || []).length >= 3 ? 2 : 1;
  return (fd.w || 1) >= 1.4 ? 2 : 1;
}
// What the second header field is called depends on the trade. "Cluster" is
// meaningless for boxed hardware in a warehouse, and a transit port lives at a
// POP, not a cluster.
const CAP_PLACE_LABEL = {
  gpu: ["Cluster / region", "APAC"],
  baremetal: ["Cluster / region", "APAC"],
  dc: ["Site / market", "Sydney"],
  network: ["POP / route", "SG1 \u2194 TY2"],
  storage: ["Region", "US-East"],
  hardware: ["Location / warehouse", "Sydney warehouse"]
};

function CapLineEditor({
  line,
  onChange,
  onRemove
}) {
  var kind = line.kind || "gpu";
  var place = CAP_PLACE_LABEL[kind] || CAP_PLACE_LABEL.gpu;
  // Per-line extras: the schema covers each kind's common trade, anything a
  // particular deal needs is added here instead of widening the shared form.
  var extras = Array.isArray(line.extras) ? line.extras : [];
  var setExtra = (i, patch) => onChange({ extras: extras.map((x, n) => n === i ? Object.assign({}, x, patch) : x) });
  var addExtra = () => onChange({ extras: extras.concat([{ label: "", value: "" }]) });
  var rmExtra = (i) => onChange({ extras: extras.filter((_, n) => n !== i) });
  var schema = window.cnCapFields ? window.cnCapFields(kind) : {
    qty: [],
    terms: []
  };
  var kinds = window.cnCapKinds || [];
  var field = fd => React.createElement("div", {
    key: fd.k,
    className: "cn-pa-fld",
    style: {
      gridColumn: "span " + capSpan(fd)
    }
  }, React.createElement("label", null, fd.label), fd.type === "choice" ? React.createElement("div", {
    className: "cn-pa-choice"
  }, fd.options.map(o => React.createElement("button", {
    key: o,
    type: "button",
    className: `cn-pa-choice-b ${line[fd.k] === o ? "is-on" : ""}`,
    onClick: () => onChange({
      [fd.k]: line[fd.k] === o ? "" : o
    })
  }, o))) : React.createElement("div", {
    className: "cn-pa-affix"
  }, fd.prefix && React.createElement("span", {
    className: "cn-pa-affix-p"
  }, fd.prefix), React.createElement("input", {
    className: "cn-input",
    value: line[fd.k] || "",
    placeholder: fd.ph || "",
    onChange: e => onChange({
      [fd.k]: e.target.value
    })
  }), fd.suffix && React.createElement("span", {
    className: "cn-pa-affix-s"
  }, fd.suffix)));
  var tcv = window.cnEcon ? window.cnEcon.tcv(line) : 0;
  var dep = window.cnEcon ? window.cnEcon.deposit(line) : 0;
  return React.createElement("div", {
    className: "cn-pa-cap-row"
  }, React.createElement("div", {
    className: "cn-pa-kindrow"
  }, kinds.map(k => React.createElement("button", {
    key: k.id,
    type: "button",
    className: `cn-pa-kind ${kind === k.id ? "is-on" : ""}`,
    onClick: () => onChange({
      kind: k.id
    })
  }, k.label)), React.createElement("button", {
    type: "button",
    className: "cn-pa-cap-x",
    onClick: onRemove
  }, "\u2715")), React.createElement("div", {
    className: "cn-pa-fldrow"
  }, React.createElement("div", {
    className: "cn-pa-fld",
    style: {
      gridColumn: "span 2"
    }
  }, React.createElement("label", null, kind === "dc" ? "Site / facility" : kind === "hardware" ? "Model / part no." : "Model"), React.createElement("input", {
    className: "cn-input",
    value: line.resource || "",
    placeholder: kind === "dc" ? "Ashburn DC2" : kind === "hardware" ? "QSFP28-100G-SR4" : "B300",
    onChange: e => onChange({
      resource: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-pa-fld",
    style: {
      gridColumn: "span 2"
    }
  }, React.createElement("label", null, place[0]), React.createElement("input", {
    className: "cn-input",
    value: line.region || "",
    placeholder: place[1],
    onChange: e => onChange({
      region: e.target.value
    })
  })), schema.qty.map(field)), React.createElement("div", {
    className: "cn-pa-fldrow"
  }, schema.terms.map(field)), extras.length > 0 && React.createElement("div", {
    className: "cn-pa-fldrow"
  }, extras.map((x, i) => React.createElement("div", {
    key: i,
    className: "cn-pa-fld cn-pa-fld--extra",
    style: { gridColumn: "span 2" }
  }, React.createElement("input", {
    className: "cn-input cn-pa-extra-label",
    value: x.label || "",
    placeholder: "Field name",
    onChange: e => setExtra(i, { label: e.target.value })
  }), React.createElement("div", {
    className: "cn-pa-affix"
  }, React.createElement("input", {
    className: "cn-input",
    value: x.value || "",
    placeholder: "Value",
    onChange: e => setExtra(i, { value: e.target.value })
  }), React.createElement("button", {
    type: "button",
    className: "cn-pa-extra-x",
    title: "Remove field",
    onClick: () => rmExtra(i)
  }, "\u2715"))))), React.createElement("button", {
    type: "button",
    className: "cn-pa-addfld",
    onClick: addExtra
  }, "+ Add a field"), tcv > 0 && React.createElement("div", {
    className: "cn-pa-calc"
  }, React.createElement("span", null, "TCV ", React.createElement("strong", null, window.cnEcon.usd(tcv))), dep > 0 && React.createElement("span", null, "Down ", React.createElement("strong", null, window.cnEcon.usd(dep))), React.createElement("span", {
    className: "cn-pa-calc-math"
  }, window.cnEcon.gpuCount(line).toLocaleString(), " GPUs \xD7 24h \xD7 365d \xD7 ", window.cnEcon.years(line.term), "Y")));
}
function PartnerCard({
  p,
  onEdit,
  currentUser,
  authEmail,
  scenario,
  onEmailCluster
}) {
  var clusters = useMemo(() => {
    var by = {};
    (p.capacity || []).forEach(c => {
      var k = c.region || "—";
      (by[k] = by[k] || []).push(c);
    });
    return Object.entries(by);
  }, [p]);
  var m = paStatusMeta(p.status);
  return React.createElement("div", {
    className: "cn-pa-card",
    onClick: () => onEdit(p)
  }, React.createElement("div", {
    className: "cn-pa-card-head"
  }, React.createElement("span", {
    className: "cn-pa-av"
  }, paInitials(p.name || p.org)), React.createElement("div", {
    className: "cn-pa-id"
  }, React.createElement("div", {
    className: "cn-pa-name"
  }, p.name || p.org || "Partner"), React.createElement("div", {
    className: "cn-pa-org"
  }, [p.org && p.name ? p.org : "", p.region].filter(Boolean).join(" · ") || "—")), React.createElement("span", {
    className: `cn-in-badge cn-in-badge--${m.tone}`
  }, m.label)), p.specialties && p.specialties.length > 0 && React.createElement("div", {
    className: "cn-pa-tags"
  }, p.specialties.map(s => React.createElement("span", {
    key: s,
    className: "cn-pa-tag"
  }, s))), clusters.length > 0 ? React.createElement("div", {
    className: "cn-pa-clusters"
  }, clusters.map(([region, lines]) => React.createElement("div", {
    key: region,
    className: "cn-pa-cluster"
  }, React.createElement("div", {
    className: "cn-pa-cluster-h"
  }, React.createElement("span", null, region), window.ClusterActions && React.createElement(window.ClusterActions, {
    partner: p,
    region: region,
    lines: lines,
    currentUser: currentUser,
    authEmail: authEmail,
    scenario: scenario,
    onEmail: onEmailCluster
  })), lines.map(l => React.createElement(CapBar, {
    key: l.id,
    line: l
  }))))) : React.createElement("div", {
    className: "cn-pa-nocap"
  }, "No capacity logged yet"), React.createElement("div", {
    className: "cn-pa-foot"
  }, "Updated ", paTimeAgo(p.updatedAt)));
}
function PartnerModal({
  partner,
  onClose,
  onSaved,
  currentUser
}) {
  var editing = !!partner;
  var [f, setF] = useState(() => partner ? {
    ...partner,
    capacity: (partner.capacity || []).map(c => ({
      ...c
    }))
  } : newPartner());
  var set = patch => setF(prev => ({
    ...prev,
    ...patch
  }));
  var setCap = (id, patch) => set({
    capacity: f.capacity.map(c => c.id === id ? {
      ...c,
      ...patch
    } : c)
  });
  var addCap = () => set({
    capacity: [...f.capacity, newCapLine(window.cnCapKindForSpecialties ? window.cnCapKindForSpecialties(f.specialties) : "gpu")]
  });
  var rmCap = id => set({
    capacity: f.capacity.filter(c => c.id !== id)
  });
  var toggleSpec = s => set({
    specialties: f.specialties.includes(s) ? f.specialties.filter(x => x !== s) : [...f.specialties, s]
  });
  var save = () => {
    if (!f.name.trim() && !f.org.trim()) {
      window.cnToast && window.cnToast({
        kind: "error",
        title: "Add a partner name or company"
      });
      return;
    }
    var rec = {
      ...f,
      updatedAt: new Date().toISOString()
    };
    upsertPartner(rec, currentUser?.name || null);
    onSaved && onSaved(rec);
    onClose && onClose();
    window.cnToast && window.cnToast({
      title: editing ? "Partner updated" : "Partner added",
      sub: rec.name || rec.org
    });
  };
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose
  }, React.createElement("div", {
    className: "cn-modal cn-pa-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "cn-modal-head"
  }, React.createElement("h3", null, editing ? "Edit partner" : "New partner"), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body cn-in-form"
  }, React.createElement("div", {
    className: "cn-in-row2"
  }, React.createElement("div", null, React.createElement("label", null, "Contact name"), React.createElement("input", {
    className: "cn-input",
    value: f.name,
    onChange: e => set({
      name: e.target.value
    }),
    placeholder: "Lloyd Chen"
  })), React.createElement("div", null, React.createElement("label", null, "Company"), React.createElement("input", {
    className: "cn-input",
    value: f.org,
    onChange: e => set({
      org: e.target.value
    }),
    placeholder: "Centra Digital"
  }))), React.createElement("div", {
    className: "cn-in-row2"
  }, React.createElement("div", null, React.createElement("label", null, "Email"), React.createElement("input", {
    className: "cn-input",
    value: f.email,
    onChange: e => set({
      email: e.target.value
    }),
    placeholder: "name@partner.com"
  })), React.createElement("div", null, React.createElement("label", null, "Home region"), React.createElement("input", {
    className: "cn-input",
    value: f.region,
    onChange: e => set({
      region: e.target.value
    }),
    placeholder: "US-East"
  }))), React.createElement("label", null, "Status"), React.createElement("div", {
    className: "cn-pa-statusrow"
  }, PA_STATUS.map(s => React.createElement("button", {
    key: s.id,
    type: "button",
    className: `cn-pa-statusbtn ${f.status === s.id ? "is-on" : ""}`,
    onClick: () => set({
      status: s.id
    })
  }, s.label))), React.createElement("label", null, "Specialties"), React.createElement("div", {
    className: "cn-pa-specs"
  }, SPECIALTIES.map(s => React.createElement("button", {
    key: s,
    type: "button",
    className: `cn-pa-spec ${f.specialties.includes(s) ? "is-on" : ""}`,
    onClick: () => toggleSpec(s)
  }, s))), React.createElement("div", {
    className: "cn-pa-cap-editor"
  }, React.createElement("div", {
    className: "cn-pa-cap-editor-h"
  }, React.createElement("label", {
    style: {
      margin: 0
    }
  }, "Capacity by cluster"), React.createElement("button", {
    type: "button",
    className: "cn-btn cn-btn--ghost cn-btn--sm",
    onClick: addCap
  }, "+ Add line")), f.capacity.length === 0 && React.createElement("div", {
    className: "cn-pa-nocap",
    style: {
      margin: "4px 0"
    }
  }, "Add what this partner has room for \u2014 e.g. H100 GPUs, MW of power, colo racks."), window.MandateSupplyHint && React.createElement(window.MandateSupplyHint, {
    partner: f
  }), f.capacity.map(c => React.createElement(CapLineEditor, {
    key: c.id,
    line: c,
    onChange: patch => setCap(c.id, patch),
    onRemove: () => rmCap(c.id)
  }))), React.createElement("label", null, "Notes"), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 54
    },
    value: f.notes,
    onChange: e => set({
      notes: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-modal-foot"
  }, editing && React.createElement("button", {
    className: "cn-btn cn-btn--danger",
    style: {
      marginRight: "auto"
    },
    onClick: () => {
      if (confirm("Delete this partner?")) {
        deletePartner(partner.id);
        onSaved && onSaved(null);
        onClose && onClose();
      }
    }
  }, "Delete"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: save
  }, editing ? "Save" : "Add partner"))));
}
function PartnersScreen({
  scenario,
  currentUser,
  authEmail
}) {
  var [partners, setPartners] = useState(() => readPartners());
  var [modal, setModal] = useState(null);
  var [q, setQ] = useState("");
  var [specFilter, setSpecFilter] = useState("");
  var [compose, setCompose] = useState(null);
  var [shared, setShared] = useState(null);
  useEffect(() => {
    var h = () => setPartners(readPartners());
    window.addEventListener("cn-partners-changed", h);
    return () => window.removeEventListener("cn-partners-changed", h);
  }, []);
  useEffect(() => {
    var live = true;
    (async () => {
      if (!window.cnPartnerSync) {
        setShared(false);
        return;
      }
      var remote = await window.cnPartnerSync.loadPartnersRemote();
      if (!live) return;
      if (remote) {
        var local = readPartners();
        var byId = {};
        [...local, ...remote].forEach(p => {
          byId[p.id] = p;
        });
        var merged = Object.values(byId);
        writePartners(merged);
        setPartners(merged);
        setShared(true);
      } else setShared(false);
      window.cnClusters && window.cnClusters.refresh();
    })();
    return () => {
      live = false;
    };
  }, []);
  var filtered = useMemo(() => {
    var query = q.toLowerCase();
    return partners.filter(p => {
      if (specFilter && !p.specialties.includes(specFilter)) return false;
      if (!query) return true;
      var hay = (p.name + " " + p.org + " " + p.region + " " + p.specialties.join(" ") + " " + (p.capacity || []).map(c => c.resource + " " + c.region).join(" ")).toLowerCase();
      return hay.includes(query);
    }).sort((a, b) => partnerAvail(b) - partnerAvail(a));
  }, [partners, q, specFilter]);
  var totalGpus = partners.reduce((s, p) => s + partnerAvail(p), 0);
  var totalTCV = partners.reduce((s, p) => s + partnerTCV(p), 0);
  var stats = [["Partners", partners.length], ["Clusters", new Set(partners.flatMap(p => (p.capacity || []).map(c => c.region).filter(Boolean))).size], ["GPUs available", totalGpus.toLocaleString()], ["Capacity value", window.cnEcon ? window.cnEcon.usd(totalTCV, true) : "—"]];
  return React.createElement("div", {
    className: "cn-page cn-partners"
  }, React.createElement("div", {
    className: "cn-in-head"
  }, React.createElement("div", {
    className: "cn-in-lead"
  }, "Who has room right now \u2014 capacity and clusters across your partner network. Shared by both brands.", shared === false && React.createElement("span", {
    className: "cn-pa-localnote"
  }, "Saving to this browser only \u2014 run migration 14 to share with the team.")), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setModal("new")
  }, "+ New partner")), React.createElement("div", {
    className: "cn-ref-stats"
  }, stats.map(([label, n]) => React.createElement("div", {
    key: label,
    className: "cn-ref-stat"
  }, React.createElement("div", {
    className: "cn-ref-stat-label"
  }, label), React.createElement("div", {
    className: "cn-ref-stat-num"
  }, n)))), partners.length === 0 ? React.createElement("div", {
    className: "cn-empty cn-ref-empty"
  }, React.createElement("div", {
    className: "cn-empty-ico"
  }, "\u25A6"), React.createElement("div", {
    className: "cn-empty-title"
  }, "No partners tracked yet"), React.createElement("div", {
    className: "cn-empty-sub"
  }, "Add your first partner and log what they have room for. Then you'll always know who to route a client to."), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      marginTop: 14
    },
    onClick: () => setModal("new")
  }, "+ New partner")) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-pa-controls"
  }, React.createElement("input", {
    className: "cn-input cn-pa-search",
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search partners, resources, regions\u2026"
  }), React.createElement("div", {
    className: "cn-pa-filters"
  }, React.createElement("button", {
    className: `cn-pa-filter ${specFilter === "" ? "is-on" : ""}`,
    onClick: () => setSpecFilter("")
  }, "All"), SPECIALTIES.map(s => React.createElement("button", {
    key: s,
    className: `cn-pa-filter ${specFilter === s ? "is-on" : ""}`,
    onClick: () => setSpecFilter(specFilter === s ? "" : s)
  }, s)))), filtered.length === 0 ? React.createElement("div", {
    className: "cn-in-clear"
  }, "No partners match that filter.") : React.createElement("div", {
    className: "cn-pa-grid"
  }, filtered.map(p => React.createElement(PartnerCard, {
    key: p.id,
    p: p,
    onEdit: setModal,
    currentUser: currentUser,
    authEmail: authEmail,
    scenario: scenario,
    onEmailCluster: c => setCompose(c)
  })))), modal && React.createElement(PartnerModal, {
    partner: modal === "new" ? null : modal,
    onClose: () => setModal(null),
    onSaved: () => setPartners(readPartners()),
    currentUser: currentUser
  }), compose && window.ContactComposeDrawer && (() => {
    var mail = compose.notice ? window.cnClusters.partnerNotice(compose) : window.cnClusters.email(compose);
    return React.createElement(window.ContactComposeDrawer, {
      scenario: scenario,
      currentUser: currentUser,
      initialSubject: mail.subject,
      initialBody: mail.body,
      onClose: () => setCompose(null),
      onSaved: () => setCompose(null)
    });
  })());
}
window.PartnersScreen = PartnersScreen;