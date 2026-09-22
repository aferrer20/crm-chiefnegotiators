function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function _docsBrandKey() {
  return window.CN_BRAND && window.CN_BRAND.key || "chief";
}
var DOCS_KEY_LEGACY = "cn-documents";
var DOCS_SEED_V_LEGACY = "cn-documents-seed-v";
function DOCS_KEY_FOR() {
  return "cn-documents:" + _docsBrandKey();
}
function DOCS_SEED_V_FOR() {
  return "cn-documents-seed-v:" + _docsBrandKey();
}
var DOCS_CURRENT_SEED = "15";
var DOC_RETIRED_IDS = new Set(["doc-cn-neocloud-pa", "doc-ssp-neocloud-pa", "doc-referral-agent"]);
var DOC_RETIRED_TITLES = new Set(["neocloud partnership agreement", "neocloud operating agreement", "neocloud contract", "neocloud partnership agreement — cn", "neocloud operating agreement — ssp", "operator agreement", "operator agreement — ssp", "cn client pre-qualification kyc form", "ssp client pre-qualification kyc form", "ssp dc qualification", "ssp ncnda", "referral agent agreement"]);
function docIsRetired(d) {
  if (!d) return false;
  if (DOC_RETIRED_IDS.has(d.id)) return true;
  if (typeof d.id === "string" && d.id.startsWith("doc-")) return false;
  return DOC_RETIRED_TITLES.has(String(d.title || "").trim().toLowerCase());
}
var DOC_CATEGORIES = [{
  id: "contracts",
  code: "CT",
  label: "Agreements",
  icon: "📑",
  desc: "NCNDAs, partnership and operator agreements"
}, {
  id: "forms",
  code: "FM",
  label: "Qualification & Intake",
  icon: "◫",
  desc: "Forms a counterparty fills in before we quote"
}, {
  id: "compliance",
  code: "CO",
  label: "OEM Compliance",
  icon: "✓",
  desc: "End-user certs, attestations, KYC — per OEM"
}, {
  id: "specs",
  code: "SP",
  label: "Specs & BOMs",
  icon: "📐",
  desc: "Configurations, bills of materials, part detail"
}];
function _persistDocs(key, list) {
  var trim = arr => arr.map(d => d && d.cloudPath && d.data ? {
    ...d,
    data: ""
  } : d);
  var lite = arr => arr.map(d => d && d.data ? {
    ...d,
    data: ""
  } : d);
  for (var candidate of [trim(list), lite(list)]) {
    try {
      localStorage.setItem(key, JSON.stringify(candidate));
      return;
    } catch (e) {
      if (!(e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014))) throw e;
    }
  }
  try {
    localStorage.removeItem(key);
  } catch (_) {}
}
var DOCS_REMOVED_KEY = "cn-documents-removed";
var TOMBSTONE_PREFIX = "__removed__:";
function readDocTombstones() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DOCS_REMOVED_KEY) || "[]"));
  } catch (_) {
    return new Set();
  }
}
function writeDocTombstones(set) {
  try {
    localStorage.setItem(DOCS_REMOVED_KEY, JSON.stringify(Array.from(set)));
  } catch (_) {}
}
function tombstoneDoc(id) {
  var s = readDocTombstones();
  s.add(id);
  writeDocTombstones(s);
}
function untombstoneDoc(id) {
  var s = readDocTombstones();
  if (s.delete(id)) writeDocTombstones(s);
}
function readDocs() {
  var KEY = DOCS_KEY_FOR(),
    SEED_KEY = DOCS_SEED_V_FOR();
  if (localStorage.getItem(KEY) === null && localStorage.getItem(DOCS_KEY_LEGACY) !== null && _docsBrandKey() === "chief") {
    try {
      localStorage.setItem(KEY, localStorage.getItem(DOCS_KEY_LEGACY));
    } catch (_) {}
    var v = localStorage.getItem(DOCS_SEED_V_LEGACY);
    if (v) localStorage.setItem(SEED_KEY, v);
  }
  var seedVer = localStorage.getItem(SEED_KEY);
  var stored = (() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  })();
  var storedIsUsable = Array.isArray(stored) && stored.length > 0;
  if (storedIsUsable && seedVer === DOCS_CURRENT_SEED) {
    var _removed = readDocTombstones();
    var kept = stored.filter(d => !docIsRetired(d) && !_removed.has(d.id));
    if (kept.length !== stored.length) _persistDocs(KEY, kept);
    return kept;
  }
  var seeded = [{
    id: "doc-cn-ncnda",
    title: "NCNDA — Chief Negotiators",
    description: "Mutual NDA + non-circumvent, fillable. Signed before any supply, pricing or buyer detail is disclosed.",
    category: "contracts",
    scope: "Chief Negotiators",
    kind: "url",
    url: "assets/docs/CN NCNDA.docx",
    fileName: "CN NCNDA.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-ssp-ncnda",
    title: "NCNDA — SSP",
    description: "Mutual NDA + non-circumvent, SSP paper, fillable. Same role as the CN version.",
    category: "contracts",
    scope: "SSP",
    kind: "url",
    url: "assets/docs/SSP NCNDA.docx",
    fileName: "SSP NCNDA.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-cn-operator-pa",
    title: "Operator Partnership Agreement — CN",
    description: "For colo / data-centre operators. Referral fee terms, registration and Schedule 1 rate scale. Fillable — send, they complete and sign, it comes back.",
    category: "contracts",
    scope: "Chief Negotiators",
    kind: "url",
    url: "assets/docs/CN Operator Partnership Agreement.docx",
    fileName: "CN Operator Partnership Agreement.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-ssp-operator-pa",
    title: "Operator Partnership Agreement — SSP",
    description: "SSP paper for the same operator relationship: AUD, GST, NSW law. Fillable and signable.",
    category: "contracts",
    scope: "SSP",
    kind: "url",
    url: "assets/docs/SSP Operator Agreement.docx",
    fileName: "SSP Operator Agreement.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-offtake-referral",
    title: "Offtake Referral Partnership Agreement",
    description: "Invitation-only paper for partners bringing offtakers to our suppliers. Non-binding; fee runs for the life of the closed contract only.",
    category: "contracts",
    scope: "__shared__",
    kind: "url",
    url: "assets/docs/Offtake Referral Partnership Agreement.docx",
    fileName: "Offtake Referral Partnership Agreement.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-08T10:00:00Z",
    attachments: []
  }, {
    id: "doc-cn-outside-party",
    title: "Outside-Party Justification — CN",
    description: "Internal gate. Complete before any introduction is made outside the ecosystem.",
    category: "forms",
    scope: "Chief Negotiators",
    kind: "url",
    url: "assets/docs/CN Outside-Party Justification.docx",
    fileName: "CN Outside-Party Justification.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-09T12:00:00Z",
    attachments: []
  }, {
    id: "doc-cn-strategic-partnership",
    title: "Strategic Partnership Agreement — CN",
    description: "Provider-side paper. Registered clients, lifetime Commission, Schedule A rate scale. Fillable; Florida governing law.",
    category: "contracts",
    scope: "Chief Negotiators",
    kind: "url",
    url: "assets/docs/CN Strategic Partnership Agreement.docx",
    fileName: "CN Strategic Partnership Agreement.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-11T10:00:00Z",
    attachments: []
  }, {
    id: "doc-ssp-strategic-partnership",
    title: "Strategic Partnership Agreement — SSP",
    description: "Provider-side paper. Registered clients, lifetime Commission, Schedule A rate scale. Fillable; NSW governing law.",
    category: "contracts",
    scope: "SSP",
    kind: "url",
    url: "assets/docs/SSP Strategic Partnership Agreement.docx",
    fileName: "SSP Strategic Partnership Agreement.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Strategic Supply Partners",
    uploadedAt: "2026-09-10T10:00:00Z",
    attachments: []
  }, {
    id: "doc-ssp-outside-party",
    title: "Outside-Party Justification — SSP",
    description: "Internal gate. Complete before any introduction is made outside the ecosystem.",
    category: "forms",
    scope: "SSP",
    kind: "url",
    url: "assets/docs/SSP Outside-Party Justification.docx",
    fileName: "SSP Outside-Party Justification.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Strategic Supply Partners",
    uploadedAt: "2026-09-09T12:00:00Z",
    attachments: []
  }, {
    id: "doc-cn-referral",
    title: "Referral Agreement — CN",
    description: "Simple, non-exclusive, 50/50 split for the full contract. Fillable; Delaware governing law.",
    category: "contracts",
    scope: "Chief Negotiators",
    kind: "url",
    url: "assets/docs/CN Referral Agreement.docx",
    fileName: "CN Referral Agreement.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-09T10:00:00Z",
    attachments: []
  }, {
    id: "doc-ssp-referral",
    title: "Referral Agreement — SSP",
    description: "Simple, non-exclusive, 50/50 split for the full contract. Fillable; Delaware governing law.",
    category: "contracts",
    scope: "SSP",
    kind: "url",
    url: "assets/docs/SSP Referral Agreement.docx",
    fileName: "SSP Referral Agreement.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Strategic Supply Partners",
    uploadedAt: "2026-09-09T10:00:00Z",
    attachments: []
  }, {
    id: "doc-cn-gpuaas-qual",
    title: "GPUaaS Qualification Form — CN",
    description: "Qualifies a GPU-as-a-service opportunity: workload, term, power, budget. Send before quoting.",
    category: "forms",
    scope: "Chief Negotiators",
    kind: "url",
    url: "assets/docs/CN GPUaaS Qualification Form.docx",
    fileName: "CN GPUaaS Qualification Form.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-ssp-gpuaas-qual",
    title: "GPUaaS Qualification Form — SSP",
    description: "Same qualification, SSP branding.",
    category: "forms",
    scope: "SSP",
    kind: "url",
    url: "assets/docs/SSP GPUaaS Qualification Form.docx",
    fileName: "SSP GPUaaS Qualification Form.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-cn-dc-capacity",
    title: "Data Center Capacity Qualification — CN",
    description: "Offtaker qualification for a capacity deal: load, ramp, hardware BOM, resilience and compliance. Fillable.",
    category: "forms",
    scope: "Chief Negotiators",
    kind: "url",
    url: "assets/docs/CN Data Center Capacity Qualification.docx",
    fileName: "CN Data Center Capacity Qualification.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-11T12:00:00Z",
    attachments: []
  }, {
    id: "doc-ssp-dc-qual",
    title: "Data Centre Capacity Qualification — SSP",
    description: "Site qualification for a data-centre build or capacity deal: space, power, cooling, timeline.",
    category: "forms",
    scope: "SSP",
    kind: "url",
    url: "assets/docs/SSP Data Centre Capacity Qualification.docx",
    fileName: "SSP Data Centre Capacity Qualification.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "SSP",
    uploadedAt: "2026-09-07T10:00:00Z",
    attachments: []
  }, {
    id: "doc-cn-dc-intake",
    title: "Data Center Intake Form — CN",
    description: "Site intake for a data-center build or refresh: space, power, cooling, timeline.",
    category: "forms",
    scope: "Chief Negotiators",
    kind: "url",
    url: "assets/docs/CN Data Center Intake Form.docx",
    fileName: "CN Data Center Intake Form.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-ssp-dc-intake",
    title: "Data Centre Intake Form — SSP",
    description: "Site intake for a data-centre build or refresh: space, power, cooling, timeline.",
    category: "forms",
    scope: "SSP",
    kind: "url",
    url: "assets/docs/SSP Data Centre Intake Form.docx",
    fileName: "SSP Data Centre Intake Form.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "SSP",
    uploadedAt: "2026-09-14T10:00:00Z",
    attachments: []
  }, {
    id: "doc-cn-kyc-prequal",
    title: "Client Pre-Qualification & KYC — CN",
    description: "OEM-neutral first form. Establishes who the end user is, what they need, and where it lands — before an OEM route is chosen.",
    category: "forms",
    scope: "Chief Negotiators",
    kind: "url",
    url: "assets/docs/CN Client Pre-Qualification KYC Form.docx",
    fileName: "CN Client Pre-Qualification KYC Form.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-07T10:00:00Z",
    attachments: []
  }, {
    id: "doc-ssp-kyc-prequal",
    title: "Client Pre-Qualification & KYC — SSP",
    description: "Same OEM-neutral pre-qualification, SSP paper.",
    category: "forms",
    scope: "SSP",
    kind: "url",
    url: "assets/docs/SSP Client Pre-Qualification KYC Form.docx",
    fileName: "SSP Client Pre-Qualification KYC Form.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploaderName: "Strategic Supply Partners",
    uploadedAt: "2026-09-07T10:00:00Z",
    attachments: []
  }, {
    id: "doc-dell-kyc-scoring",
    title: "Dell — KYC Risk Scoring Checklist",
    description: "Know-your-customer scoring. Required before any order routes through Dell.",
    category: "compliance",
    scope: "__shared__",
    kind: "url",
    url: "assets/docs/Dell - KYC Risk Scoring Checklist.pdf",
    fileName: "Dell - KYC Risk Scoring Checklist.pdf",
    fileType: "application/pdf",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-dell-redflags",
    title: "Dell — Simplified Red Flags Checklist",
    description: "Diversion red flags to clear alongside the KYC scoring.",
    category: "compliance",
    scope: "__shared__",
    kind: "url",
    url: "assets/docs/Dell - Simplified Red Flags Checklist.pdf",
    fileName: "Dell - Simplified Red Flags Checklist.pdf",
    fileType: "application/pdf",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-lenovo-euc",
    title: "Lenovo — End User Certification",
    description: "End user certifies who they are and what the hardware is for.",
    category: "compliance",
    scope: "__shared__",
    kind: "url",
    url: "assets/docs/Lenovo - End User Certification.pdf",
    fileName: "Lenovo - End User Certification.pdf",
    fileType: "application/pdf",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-lenovo-dca",
    title: "Lenovo — Data Centre Attestation",
    description: "Attests the destination site is a real data center.",
    category: "compliance",
    scope: "__shared__",
    kind: "url",
    url: "assets/docs/Lenovo - Data Centre Attestation.pdf",
    fileName: "Lenovo - Data Centre Attestation.pdf",
    fileType: "application/pdf",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-smc-euc",
    title: "Supermicro — End-User Certification",
    description: "Baseline end-user certification for SMC systems.",
    category: "compliance",
    scope: "__shared__",
    kind: "url",
    url: "assets/docs/Supermicro - End-User Certification.pdf",
    fileName: "Supermicro - End-User Certification.pdf",
    fileType: "application/pdf",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-smc-gpu-euc",
    title: "Supermicro — GPU Capable End-User Certification",
    description: "The GPU-specific version. Required for B300 / B200 configurations.",
    category: "compliance",
    scope: "__shared__",
    kind: "url",
    url: "assets/docs/Supermicro - GPU Capable End-User Certification.pdf",
    fileName: "Supermicro - GPU Capable End-User Certification.pdf",
    fileType: "application/pdf",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-smc-dca",
    title: "Supermicro — Data Centre Attestation",
    description: "Destination site attestation for SMC orders.",
    category: "compliance",
    scope: "__shared__",
    kind: "url",
    url: "assets/docs/Supermicro - Data Centre Attestation.pdf",
    fileName: "Supermicro - Data Centre Attestation.pdf",
    fileType: "application/pdf",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-smc-aic-hq",
    title: "Supermicro — Advanced IC and Headquarters Certification",
    description: "Advanced-IC and HQ certification for export-controlled silicon.",
    category: "compliance",
    scope: "__shared__",
    kind: "url",
    url: "assets/docs/Supermicro - Advanced IC and Headquarters Certification.pdf",
    fileName: "Supermicro - Advanced IC and Headquarters Certification.pdf",
    fileType: "application/pdf",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-giga-soa",
    title: "Giga Computing — Statement of Assurance",
    description: "Giga Computing end-use assurance statement.",
    category: "compliance",
    scope: "__shared__",
    kind: "url",
    url: "assets/docs/Giga Computing - Statement of Assurance.pdf",
    fileName: "Giga Computing - Statement of Assurance.pdf",
    fileType: "application/pdf",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }, {
    id: "doc-vr-nvl144-bom",
    title: "Vera Rubin NVL144 — Rack BOM",
    description: "Full L10 compute tray and L11 rack bill of materials: part detail, qty per rack, vendor per line.",
    category: "specs",
    scope: "__shared__",
    kind: "url",
    url: "assets/docs/Vera Rubin NVL144 BOM.jpg",
    fileName: "Vera Rubin NVL144 BOM.jpg",
    fileType: "image/jpeg",
    uploaderName: "Chief Negotiators",
    uploadedAt: "2026-09-05T10:00:00Z",
    attachments: []
  }];
  var removed = readDocTombstones();
  var storedById = new Map((stored || []).map(d => [d.id, d]));
  var seededMerged = seeded.map(s => {
    var local = storedById.get(s.id);
    return local && local.userEdited ? {
      ...s,
      ...local
    } : s;
  });
  var userDocs = (stored || []).filter(d => !d.id.startsWith("doc-") && !docIsRetired(d));
  var merged = [...seededMerged, ...userDocs].filter(d => !docIsRetired(d) && !removed.has(d.id));
  _persistDocs(KEY, merged);
  localStorage.setItem(SEED_KEY, DOCS_CURRENT_SEED);
  return merged;
}
function writeDocs(list) {
  _persistDocs(DOCS_KEY_FOR(), list);
}
function saveDoc(doc, opts) {
  untombstoneDoc(doc.id);
  var list = readDocs();
  var idx = list.findIndex(d => d.id === doc.id);
  var stamped = {
    ...doc,
    updatedAt: doc.updatedAt || new Date().toISOString(),
    userEdited: true
  };
  if (!(opts && opts.synced)) stamped.editedAt = new Date().toISOString();else if (idx >= 0 && list[idx].editedAt) stamped.editedAt = list[idx].editedAt;
  if (opts && opts.synced) delete stamped.pendingSync;else stamped.pendingSync = true;
  if (idx >= 0) list[idx] = stamped;else list.unshift(stamped);
  writeDocs(list);
  return list;
}
function deleteDoc(id) {
  tombstoneDoc(id);
  var list = readDocs().filter(d => d.id !== id);
  writeDocs(list);
  return list;
}
window.cnDocuments = {
  readDocs,
  writeDocs,
  saveDoc,
  deleteDoc,
  DOC_CATEGORIES,
  readDocTombstones,
  tombstoneDoc,
  untombstoneDoc,
  TOMBSTONE_PREFIX
};
function fileIcon(typeOrName) {
  var t = (typeOrName || "").toLowerCase();
  if (t.includes("pdf")) return "📕";
  if (t.includes("word") || t.endsWith(".doc") || t.endsWith(".docx") || t.includes("officedocument.wordprocessing")) return "📘";
  if (t.includes("sheet") || t.endsWith(".xls") || t.endsWith(".xlsx") || t.includes("officedocument.spreadsheet")) return "📗";
  if (t.includes("presentation") || t.endsWith(".ppt") || t.endsWith(".pptx")) return "📙";
  if (t.includes("image")) return "🖼";
  if (t.includes("video")) return "🎬";
  return "📄";
}
function formatBytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}
function dateAgo(iso) {
  if (!iso) return "—";
  var ms = Date.now() - new Date(iso).getTime();
  var d = Math.floor(ms / 86_400_000);
  if (d < 1) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return d + " days ago";
  if (d < 365) return Math.floor(d / 30) + " months ago";
  return Math.floor(d / 365) + " years ago";
}
function isInlineable(typeOrName) {
  var t = (typeOrName || "").toLowerCase();
  return t.includes("pdf") || t.includes("image") || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(t);
}
async function resolveDocBlobURL(doc) {
  if (window.__resources && window.__resources[doc.id] && !doc.userEdited) {
    var r = await fetch(window.__resources[doc.id]);
    if (!r.ok) throw new Error("Couldn't load bundled asset (" + r.status + ")");
    var blob = await r.blob();
    var typed = new Blob([blob], {
      type: doc.fileType || blob.type || "application/octet-stream"
    });
    return URL.createObjectURL(typed);
  }
  if (doc.cloudPath && window.cnDocLibrary) {
    try {
      var _blob = await window.cnDocLibrary.download(doc.cloudPath);
      var _typed = new Blob([_blob], {
        type: doc.fileType || _blob.type || "application/octet-stream"
      });
      return URL.createObjectURL(_typed);
    } catch {}
  }
  if (doc.kind === "file" && doc.data) {
    var res = await fetch(doc.data);
    var _blob2 = await res.blob();
    var _typed2 = new Blob([_blob2], {
      type: doc.fileType || _blob2.type || "application/octet-stream"
    });
    return URL.createObjectURL(_typed2);
  }
  if (doc.kind === "url" && doc.url) {
    var isAbsolute = /^https?:\/\//i.test(doc.url);
    if (isAbsolute) return doc.url;
    var _r = await fetch(doc.url);
    if (!_r.ok) throw new Error("Couldn't load (" + _r.status + ")");
    var _blob3 = await _r.blob();
    var _typed3 = new Blob([_blob3], {
      type: doc.fileType || _blob3.type || "application/octet-stream"
    });
    return URL.createObjectURL(_typed3);
  }
  throw new Error("Nothing to open");
}
function downloadDoc(doc) {
  var trigger = (href, revoke) => {
    var a = document.createElement("a");
    a.href = href;
    a.download = doc.fileName || doc.title;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      if (revoke) URL.revokeObjectURL(href);
    }, 800);
  };
  if (window.__resources && window.__resources[doc.id] && !doc.userEdited) {
    fetch(window.__resources[doc.id]).then(r => r.blob()).then(blob => {
      var objURL = URL.createObjectURL(new Blob([blob], {
        type: doc.fileType || blob.type
      }));
      trigger(objURL, true);
    }).catch(err => alert("Couldn't download: " + (err.message || err)));
    return;
  }
  if (doc.kind === "file" && doc.data) {
    trigger(doc.data, false);
    return;
  }
  if (doc.cloudPath && window.cnDocLibrary) {
    window.cnDocLibrary.download(doc.cloudPath).then(blob => trigger(URL.createObjectURL(new Blob([blob], {
      type: doc.fileType || blob.type
    })), true)).catch(err => alert("Couldn't download: " + (err.message || err)));
    return;
  }
  if (doc.kind === "url" && doc.url) {
    var isAbsolute = /^https?:\/\//i.test(doc.url);
    if (isAbsolute) {
      trigger(doc.url, false);
      return;
    }
    fetch(doc.url).then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.blob();
    }).then(blob => {
      var objURL = URL.createObjectURL(new Blob([blob], {
        type: doc.fileType || blob.type
      }));
      trigger(objURL, true);
    }).catch(err => alert("Couldn't download: " + (err.message || err)));
  }
}
function DocumentViewer({
  doc,
  onClose,
  onSend
}) {
  var [status, setStatus] = useState("loading");
  var [blobURL, setBlobURL] = useState(null);
  var [errMsg, setErrMsg] = useState("");
  useEffect(() => {
    var url = null;
    var cancelled = false;
    if (!isInlineable(doc.fileType || doc.fileName)) {
      setStatus("unsupported");
      return;
    }
    resolveDocBlobURL(doc).then(u => {
      if (cancelled) {
        if (u && u.startsWith("blob:")) URL.revokeObjectURL(u);
        return;
      }
      url = u;
      setBlobURL(u);
      setStatus("ready");
    }).catch(e => {
      if (cancelled) return;
      setErrMsg(e.message || String(e));
      setStatus("error");
    });
    return () => {
      cancelled = true;
      if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [doc.id, doc.updatedAt]);
  useEffect(() => {
    var onKey = e => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  var ext = (doc.fileName || "").split(".").pop().toUpperCase();
  var isImage = (doc.fileType || "").includes("image") || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(doc.fileName || "");
  return React.createElement("div", {
    className: "cn-modal-scrim cn-doc-viewer-scrim",
    onClick: onClose,
    style: {
      zIndex: 180
    }
  }, React.createElement("div", {
    className: "cn-doc-viewer",
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-doc-viewer-head"
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("span", {
    style: {
      fontSize: 22
    }
  }, fileIcon(doc.fileType || doc.fileName)), React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "cn-doc-viewer-title"
  }, doc.title), React.createElement("div", {
    className: "cn-doc-viewer-sub"
  }, React.createElement("span", {
    className: "cn-mono",
    style: {
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 0.04
    }
  }, ext), doc.fileSize ? React.createElement("span", null, " \xB7 ", formatBytes(doc.fileSize)) : null))), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, onSend ? React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      height: 32
    },
    onClick: onSend
  }, "\u2709 Send") : null, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 32
    },
    onClick: () => downloadDoc(doc)
  }, "\u2913 Download"), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose,
    title: "Close (Esc)"
  }, "\u2715"))), React.createElement("div", {
    className: "cn-doc-viewer-body"
  }, status === "loading" && React.createElement("div", {
    className: "cn-doc-viewer-msg"
  }, React.createElement("div", {
    className: "cn-spinner",
    style: {
      borderColor: "var(--cn-mute)",
      borderTopColor: "var(--cn-copper)"
    }
  }), React.createElement("div", null, "Loading\u2026")), status === "ready" && blobURL && (isImage ? React.createElement("img", {
    src: blobURL,
    alt: doc.title,
    style: {
      maxWidth: "100%",
      maxHeight: "100%",
      margin: "auto",
      display: "block"
    }
  }) : React.createElement("iframe", {
    src: blobURL,
    title: doc.title,
    style: {
      border: 0,
      width: "100%",
      height: "100%"
    }
  })), status === "unsupported" && React.createElement("div", {
    className: "cn-doc-viewer-msg"
  }, React.createElement("div", {
    style: {
      fontSize: 40
    }
  }, fileIcon(doc.fileType || doc.fileName)), React.createElement("div", {
    className: "cn-doc-viewer-msg-title"
  }, "No in-app preview for ", ext, " files"), React.createElement("div", {
    className: "cn-doc-viewer-msg-sub"
  }, "Word & Excel docs can't render in the browser. Download to open in their native app."), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      marginTop: 14
    },
    onClick: () => downloadDoc(doc)
  }, "\u2913 Download ", doc.fileName || doc.title)), status === "error" && React.createElement("div", {
    className: "cn-doc-viewer-msg"
  }, React.createElement("div", {
    style: {
      fontSize: 32,
      color: "var(--cn-neg)"
    }
  }, "!"), React.createElement("div", {
    className: "cn-doc-viewer-msg-title"
  }, "Couldn't load this document"), React.createElement("div", {
    className: "cn-doc-viewer-msg-sub"
  }, errMsg), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      marginTop: 14
    },
    onClick: () => downloadDoc(doc)
  }, "Try downloading instead")))));
}
function DocumentsScreen({
  scenario,
  currentUser,
  onOpenContact,
  onOpenOpp
}) {
  var [docs, setDocs] = useState(() => readDocs());
  var [q, setQ] = useState("");
  var [activeCat, setActiveCat] = useState("all");
  var [editing, setEditing] = useState(null);
  var [viewing, setViewing] = useState(null);
  var [selected, setSelected] = useState([]);
  var [mode, setMode] = useState("guides");
  var [activeGuide, setActiveGuide] = useState("ncnda");
  var [sendingDocs, setSendingDocs] = useState(null);
  var [sendLog, setSendLog] = useState(() => window.readDocSendLog ? window.readDocSendLog() : []);
  var [sync, setSync] = useState({
    state: "idle",
    note: ""
  });
  var refresh = () => setDocs(readDocs());
  var syncLibrary = async verbose => {
    if (!window.cnDocLibrary) {
      setSync({
        state: "offline",
        note: "Local only — shared storage isn't connected in this build."
      });
      return;
    }
    setSync({
      state: "syncing",
      note: "Syncing library…"
    });
    try {
      var remoteAll = await window.cnDocLibrary.pull();
      if (remoteAll === null) {
        setSync({
          state: "offline",
          note: "Local only — not shared with the team yet. Run migration 12 to enable shared storage."
        });
        return;
      }
      var remote = [];
      var tombs = readDocTombstones();
      var tombsChanged = false;
      remoteAll.forEach(r => {
        if (String(r.id).startsWith(TOMBSTONE_PREFIX)) {
          var dead = String(r.id).slice(TOMBSTONE_PREFIX.length);
          if (!tombs.has(dead)) {
            tombs.add(dead);
            tombsChanged = true;
          }
        } else remote.push(r);
      });
      if (tombsChanged) writeDocTombstones(tombs);
      var list = readDocs();
      var byId = new Map(list.map(d => [d.id, d]));
      remote.forEach(r => {
        if (docIsRetired(r) || tombs.has(r.id)) return;
        var local = byId.get(r.id);
        if (!local) {
          byId.set(r.id, r);
          return;
        }
        var FIELDS = ["title", "description", "category", "scope", "fileName", "url"];
        var differs = FIELDS.some(k => (r[k] || "") !== (local[k] || ""));
        if (!differs) {
          byId.set(r.id, {
            ...local,
            cloudPath: r.cloudPath || local.cloudPath || null,
            sharedAt: r.sharedAt || local.sharedAt || null
          });
          return;
        }
        var lt = Date.parse(local.editedAt || local.updatedAt || local.uploadedAt || 0) || 0;
        var rt = Date.parse(r.updatedAt || r.uploadedAt || 0) || 0;
        var remoteWins = rt > lt && !local.pendingSync;
        var winner = remoteWins ? {
          ...local,
          ...r
        } : {
          ...r,
          ...local
        };
        byId.set(r.id, {
          ...winner,
          userEdited: true,
          editedAt: remoteWins ? r.updatedAt || local.editedAt : local.editedAt,
          pendingSync: local.pendingSync,
          data: local.data,
          url: local.url || r.url,
          kind: local.data ? local.kind : winner.kind || r.kind,
          cloudPath: r.cloudPath || local.cloudPath || null,
          sharedAt: r.sharedAt || local.sharedAt || null
        });
      });
      list = Array.from(byId.values()).filter(d => !docIsRetired(d) && !tombs.has(d.id));
      var missing = list.filter(d => d.pendingSync || !d.cloudPath && !d.sharedAt);
      var pushed = 0;
      var failures = [];
      for (var d of missing) {
        var metaOnly = d.pendingSync && (d.cloudPath || d.sharedAt);
        if (metaOnly || window.isLinkOnly && window.isLinkOnly(d)) {
          var res = await window.cnDocLibrary.push(d, null);
          if (res.ok) {
            d.cloudPath = res.path || d.cloudPath || null;
            d.sharedAt = new Date().toISOString();
            delete d.pendingSync;
            pushed++;
          } else if (!res.skipped) failures.push({
            title: d.title,
            why: res.error
          });
          continue;
        }
        try {
          var blob = await window.docToBlob(d);
          var _res = await window.cnDocLibrary.push(d, blob);
          if (_res.ok) {
            d.cloudPath = _res.path;
            d.sharedAt = new Date().toISOString();
            delete d.pendingSync;
            pushed++;
          } else if (!_res.skipped) failures.push({
            title: d.title,
            why: _res.error
          });
        } catch (e) {
          failures.push({
            title: d.title,
            why: "nothing readable to upload — " + (e.message || String(e))
          });
        }
      }
      var knownTombs = new Set(remoteAll.filter(r => String(r.id).startsWith(TOMBSTONE_PREFIX)).map(r => String(r.id).slice(TOMBSTONE_PREFIX.length)));
      for (var dead of tombs) {
        if (knownTombs.has(dead)) continue;
        try {
          await window.cnDocLibrary.push({
            id: TOMBSTONE_PREFIX + dead,
            title: "(removed)",
            description: "Tombstone — this document was removed from the library.",
            category: "contracts",
            scope: "__shared__",
            kind: "url",
            fileName: "removed",
            fileType: "application/x-cn-tombstone"
          }, null);
        } catch (_) {}
      }
      writeDocs(list);
      setDocs(list);
      var inCloud = list.filter(d => d.cloudPath || d.sharedAt).length;
      if (failures.length) console.warn("Documents that couldn't be shared:", failures);
      setSync({
        state: failures.length ? "warn" : "ok",
        note: `${inCloud} of ${list.length} shared${pushed ? ` · uploaded ${pushed}` : ""}` + (failures.length ? ` · ${failures.length} couldn't be shared: ${failures[0].why}` : "")
      });
    } catch (e) {
      setSync({
        state: "error",
        note: "Couldn't reach shared storage — documents are local to this browser. " + (e.message || String(e))
      });
    }
  };
  useEffect(() => {
    syncLibrary(false);
    if (window.refreshDocSendLog) window.refreshDocSendLog().then(rows => setSendLog(rows)).catch(() => {});
  }, []);
  var search = q.trim().toLowerCase();
  var filtered = docs.filter(d => {
    if (window.CN_CROSS && !window.CN_CROSS.canSeeDoc(d)) return false;
    if (activeCat !== "all" && d.category !== activeCat) return false;
    if (!search) return true;
    return (d.title || "").toLowerCase().includes(search) || (d.description || "").toLowerCase().includes(search) || (d.fileName || "").toLowerCase().includes(search);
  });
  filtered.sort((a, b) => new Date(b.updatedAt || b.uploadedAt || 0) - new Date(a.updatedAt || a.uploadedAt || 0));
  var visibleDocs = window.CN_CROSS ? docs.filter(d => window.CN_CROSS.canSeeDoc(d)) : docs;
  var counts = {};
  visibleDocs.forEach(d => {
    counts[d.category] = (counts[d.category] || 0) + 1;
  });
  var handleDelete = doc => {
    if (!confirm(`Delete “${doc.title}”? This removes it for both brands.`)) return;
    setDocs(deleteDoc(doc.id));
    setSelected(s => s.filter(id => id !== doc.id));
    if (!window.cnDocLibrary) return;
    (async () => {
      try {
        if (doc.cloudPath || doc.sharedAt) await window.cnDocLibrary.remove(doc.id, doc.cloudPath);
      } catch (_) {}
      try {
        await window.cnDocLibrary.push({
          id: TOMBSTONE_PREFIX + doc.id,
          title: "(removed)",
          description: "Tombstone — this document was removed from the library.",
          category: doc.category || "contracts",
          scope: "__shared__",
          kind: "url",
          fileName: "removed",
          fileType: "application/x-cn-tombstone"
        }, null);
      } catch (_) {}
    })();
  };
  var handleSave = doc => {
    var existing = docs.find(d => d.id === doc.id);
    var merged = existing ? {
      ...existing,
      ...doc
    } : doc;
    setDocs(saveDoc(merged));
    setEditing(null);
    if (window.cnDocLibrary) {
      (async () => {
        var res;
        try {
          var blob = window.isLinkOnly && window.isLinkOnly(merged) ? null : await window.docToBlob(merged);
          res = await window.cnDocLibrary.push(merged, blob);
        } catch (e) {
          res = {
            ok: false,
            error: "couldn't read the file — " + (e.message || String(e))
          };
        }
        if (res.ok) {
          setDocs(saveDoc({
            ...merged,
            cloudPath: res.path || merged.cloudPath || null,
            sharedAt: new Date().toISOString()
          }, {
            synced: true
          }));
          return;
        }
        if (res.skipped) return;
        window.cnToast && window.cnToast({
          kind: "error",
          title: "Saved, but not shared",
          sub: (res.error || "couldn't reach shared storage") + " — only you can see it."
        });
      })();
    }
  };
  var toggleSelect = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  var selectedDocs = selected.map(id => docs.find(d => d.id === id)).filter(Boolean);
  var openSend = list => setSendingDocs(list);
  var rowProps = doc => ({
    doc,
    scenario,
    selected: selected.includes(doc.id),
    stats: window.docSendStats ? window.docSendStats(doc.id, sendLog) : null,
    onToggleSelect: () => toggleSelect(doc.id),
    onSend: () => openSend([doc]),
    onOpen: () => setViewing(doc),
    onEdit: () => setEditing(doc),
    onDelete: () => handleDelete(doc),
    onOpenContact,
    onOpenOpp
  });
  var catLabel = id => (DOC_CATEGORIES.find(c => c.id === id) || {}).label || id;
  return React.createElement("div", {
    className: "cn-page cn-docs-page",
    style: {
      padding: 0,
      gap: 18
    }
  }, React.createElement("header", {
    className: "cn-docs-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Document system"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      marginTop: 4
    }
  }, "Every form, and when to send it"), React.createElement("div", {
    className: "cn-docs-sync"
  }, React.createElement("span", {
    className: `cn-docs-sync-dot is-${sync.state}`
  }), React.createElement("span", null, sync.state === "syncing" ? "Syncing library…" : sync.state === "idle" ? "Checking shared storage…" : sync.note || `${visibleDocs.length} documents · shared with the team`), React.createElement("button", {
    className: "cn-docs-sync-btn",
    onClick: () => syncLibrary(true),
    disabled: sync.state === "syncing"
  }, "Sync now"))), React.createElement("div", {
    className: "cn-docs-head-actions"
  }, React.createElement("div", {
    className: "cn-docs-modes"
  }, React.createElement("button", {
    className: `cn-docs-mode ${mode === "guides" ? "is-active" : ""}`,
    onClick: () => setMode("guides")
  }, "Scenarios"), React.createElement("button", {
    className: `cn-docs-mode ${mode === "library" ? "is-active" : ""}`,
    onClick: () => setMode("library")
  }, "Library ", React.createElement("span", {
    className: "cn-docs-mode-n"
  }, visibleDocs.length))), React.createElement("input", {
    className: "cn-input",
    placeholder: "Search\u2026",
    value: q,
    onChange: e => {
      setQ(e.target.value);
      if (e.target.value) setMode("library");
    },
    style: {
      width: 200
    }
  }), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setEditing({
      id: null,
      category: activeCat === "all" ? "contracts" : activeCat
    })
  }, "+ New"))), selected.length > 0 && React.createElement("div", {
    className: "cn-docs-selbar"
  }, React.createElement("span", {
    className: "cn-docs-selbar-count"
  }, selected.length, " selected"), React.createElement("span", {
    className: "cn-docs-selbar-names"
  }, selectedDocs.map(d => d.title).join(" · ")), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 32
    },
    onClick: () => selectedDocs.forEach(downloadDoc)
  }, "Download all"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 32
    },
    onClick: () => setSelected([])
  }, "Clear"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      height: 32
    },
    onClick: () => openSend(selectedDocs)
  }, "\u2709 Send ", selected.length, " document", selected.length === 1 ? "" : "s")), mode === "guides" && window.DocGuides ? React.createElement(window.DocGuides, {
    docs: visibleDocs,
    activeId: activeGuide,
    onActivate: setActiveGuide,
    onSend: list => openSend(list),
    onOpen: d => setViewing(d)
  }) : React.createElement("div", {
    className: "cn-docs-layout"
  }, React.createElement("aside", {
    className: "cn-docs-rail"
  }, React.createElement("div", {
    className: "cn-dg-rail-head"
  }, "Shelf"), React.createElement("button", {
    className: `cn-docs-rail-item ${activeCat === "all" ? "is-active" : ""}`,
    onClick: () => setActiveCat("all")
  }, React.createElement("span", {
    className: "cn-docs-rail-code"
  }, "\u2211"), React.createElement("span", {
    className: "cn-docs-rail-label"
  }, "All documents"), React.createElement("span", {
    className: "cn-docs-rail-count"
  }, visibleDocs.length)), DOC_CATEGORIES.map(cat => React.createElement("button", {
    key: cat.id,
    className: `cn-docs-rail-item ${activeCat === cat.id ? "is-active" : ""}`,
    onClick: () => setActiveCat(cat.id)
  }, React.createElement("span", {
    className: "cn-docs-rail-code"
  }, cat.code), React.createElement("span", {
    className: "cn-docs-rail-label"
  }, cat.label), React.createElement("span", {
    className: "cn-docs-rail-count"
  }, counts[cat.id] || 0)))), React.createElement("section", {
    className: "cn-docs-main"
  }, filtered.length === 0 ? React.createElement("div", {
    className: "cn-docs-empty"
  }, React.createElement("div", {
    className: "cn-docs-empty-title"
  }, search ? "Nothing matches that." : "Nothing on this shelf yet."), React.createElement("div", {
    className: "cn-docs-empty-sub"
  }, "Upload a file and it becomes sendable by the whole team."), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      marginTop: 14
    },
    onClick: () => setEditing({
      id: null,
      category: activeCat === "all" ? "contracts" : activeCat
    })
  }, "+ Upload document")) : React.createElement("div", {
    className: "cn-doclist"
  }, React.createElement("div", {
    className: "cn-doclist-head"
  }, React.createElement("span", null), React.createElement("span", null, "Document"), React.createElement("span", null, "Type"), React.createElement("span", {
    className: "cn-doclist-size"
  }, "Size"), React.createElement("span", null, "Last sent"), React.createElement("span", null)), (activeCat === "all" ? DOC_CATEGORIES.map(c => c.id) : [activeCat]).map(catId => {
    var inCat = filtered.filter(d => d.category === catId);
    if (!inCat.length) return null;
    return React.createElement(Fragment, {
      key: catId
    }, activeCat === "all" && React.createElement("div", {
      className: "cn-doclist-sep"
    }, React.createElement("span", null, catLabel(catId)), React.createElement("span", {
      className: "cn-doclist-sep-n"
    }, inCat.length)), inCat.map(doc => React.createElement(DocumentRow, _extends({
      key: doc.id
    }, rowProps(doc)))));
  })))), editing && React.createElement(DocumentEditor, {
    doc: editing,
    scenario: scenario,
    currentUser: currentUser,
    onClose: () => setEditing(null),
    onSave: handleSave
  }), viewing && React.createElement(DocumentViewer, {
    doc: viewing,
    onClose: () => setViewing(null),
    onSend: () => {
      setSendingDocs([viewing]);
      setViewing(null);
    }
  }), sendingDocs && window.DocumentSendDrawer && React.createElement(window.DocumentSendDrawer, {
    docs: sendingDocs,
    scenario: scenario,
    currentUser: currentUser,
    onClose: () => setSendingDocs(null),
    onSent: () => {
      setSelected([]);
      setSendLog(window.readDocSendLog ? window.readDocSendLog() : []);
    }
  }));
}
function DocumentRow({
  doc,
  scenario,
  selected,
  stats,
  onToggleSelect,
  onSend,
  onOpen,
  onEdit,
  onDelete,
  onOpenContact,
  onOpenOpp
}) {
  var attachments = doc.attachments || [];
  var ext = ((doc.fileName || "").includes(".") ? (doc.fileName || "").split(".").pop() : "doc").toUpperCase();
  var extClass = /pdf/i.test(ext) ? "pdf" : /docx?/i.test(ext) ? "doc" : /xlsx?|csv/i.test(ext) ? "xls" : /pptx?/i.test(ext) ? "ppt" : "gen";
  var links = attachments.map((a, i) => {
    if (a.kind === "contact") {
      var c = scenario.contacts.find(x => x.id === a.id);
      return c ? {
        label: c.name,
        onClick: () => onOpenContact && onOpenContact(c.id)
      } : null;
    }
    if (a.kind === "opp") {
      var o = scenario.opps.find(x => x.id === a.id);
      return o ? {
        label: o.title,
        onClick: () => onOpenOpp && onOpenOpp(o.id)
      } : null;
    }
    if (a.kind === "account") {
      var ac = scenario.accounts.find(x => x.id === a.id);
      return ac ? {
        label: ac.name,
        onClick: null
      } : null;
    }
    return null;
  }).filter(Boolean);
  return React.createElement("div", {
    className: `cn-docrow ${selected ? "is-selected" : ""}`
  }, React.createElement("label", {
    className: "cn-doc-check",
    title: "Select to send together"
  }, React.createElement("input", {
    type: "checkbox",
    checked: !!selected,
    onChange: onToggleSelect
  })), React.createElement("div", {
    className: "cn-docrow-main"
  }, React.createElement("div", {
    className: "cn-docrow-top"
  }, React.createElement("button", {
    className: "cn-docrow-title",
    onClick: onOpen,
    title: "Open"
  }, doc.title), window.CN_CROSS && window.CN_CROSS.isSharedDoc(doc) ? React.createElement("span", {
    className: "cn-docrow-flag is-both",
    title: "Shared with both CN and SSP"
  }, "both brands") : React.createElement("span", {
    className: "cn-docrow-flag is-brand",
    title: `${window.CN_CROSS ? window.CN_CROSS.companyLabel(window.CN_CROSS.docScope(doc)) : "This brand"} only`
  }, window.CN_CROSS ? window.CN_CROSS.companyShort(window.CN_CROSS.docScope(doc)) : "brand", " only"), !doc.cloudPath && !doc.sharedAt && React.createElement("span", {
    className: "cn-docrow-flag is-local",
    title: "Only in this browser until the next sync"
  }, "local")), doc.description && React.createElement("div", {
    className: "cn-docrow-desc"
  }, doc.description), links.length > 0 && React.createElement("div", {
    className: "cn-docrow-links"
  }, links.map((l, i) => React.createElement("button", {
    key: i,
    className: "cn-docrow-link",
    onClick: l.onClick,
    disabled: !l.onClick
  }, l.label)))), React.createElement("span", {
    className: `cn-docrow-ext cn-docrow-ext--${extClass}`
  }, ext), React.createElement("span", {
    className: "cn-docrow-num cn-docrow-size"
  }, doc.fileSize ? formatBytes(doc.fileSize) : "—"), React.createElement("span", {
    className: "cn-docrow-num cn-docrow-sent"
  }, stats ? React.createElement("span", {
    title: `Sent ${stats.count}× · last to ${stats.lastTo}`
  }, dateAgo(stats.lastAt), " ", React.createElement("span", {
    className: "cn-docrow-count"
  }, "\xD7", stats.count)) : React.createElement("span", {
    className: "cn-docrow-never"
  }, "never")), React.createElement("div", {
    className: "cn-docrow-actions"
  }, React.createElement("button", {
    className: "cn-docrow-send",
    onClick: onSend
  }, "Send \u2192"), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: () => downloadDoc(doc),
    title: "Download"
  }, "\u2913"), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onEdit,
    title: "Edit"
  }, "\u270E"), React.createElement("button", {
    className: "cn-icon-btn cn-icon-btn--danger",
    onClick: onDelete,
    title: "Delete"
  }, "\u2715")));
}
function DocumentEditor({
  doc,
  scenario,
  currentUser,
  onClose,
  onSave
}) {
  var isNew = !doc.id;
  var [draft, setDraft] = useState({
    id: doc.id || "ud-" + Math.random().toString(36).slice(2, 10),
    title: doc.title || "",
    description: doc.description || "",
    category: doc.category || "contracts",
    scope: doc.scope || (window.CN_CROSS ? window.CN_CROSS.defaultDocScope(doc.category || "contracts") : null),
    kind: doc.kind || (doc.url ? "url" : "file"),
    url: doc.url || "",
    data: doc.data || "",
    fileName: doc.fileName || "",
    fileType: doc.fileType || "",
    fileSize: doc.fileSize || 0,
    uploaderName: doc.uploaderName || currentUser?.name || "",
    uploadedAt: doc.uploadedAt || new Date().toISOString(),
    attachments: doc.attachments || []
  });
  var [err, setErr] = useState(null);
  var dropRef = useRef(null);
  var update = patch => setDraft(d => ({
    ...d,
    ...patch
  }));
  var handleFile = f => {
    if (!f) return;
    setErr(null);
    if (f.size > 8 * 1024 * 1024) {
      setErr("Files over 8MB can't be stored in-browser. Try compressing the PDF or use the external link option.");
      return;
    }
    var reader = new FileReader();
    reader.onload = () => {
      update({
        kind: "file",
        data: reader.result,
        fileName: f.name,
        fileType: f.type || "",
        fileSize: f.size,
        title: draft.title || f.name.replace(/\.[^.]+$/, "")
      });
    };
    reader.onerror = () => setErr("Couldn't read that file.");
    reader.readAsDataURL(f);
  };
  var onDrop = e => {
    e.preventDefault();
    dropRef.current?.classList.remove("is-over");
    var f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  };
  var save = () => {
    if (!draft.title.trim()) {
      setErr("Give it a title.");
      return;
    }
    if (draft.kind === "file" && !draft.data && isNew) {
      setErr("Upload a file or switch to external link.");
      return;
    }
    if (draft.kind === "url" && !draft.url.trim()) {
      setErr("Paste a URL or switch to file upload.");
      return;
    }
    onSave(draft);
  };
  var toggleAttachment = (kind, id) => {
    var exists = draft.attachments.find(a => a.kind === kind && a.id === id);
    if (exists) {
      update({
        attachments: draft.attachments.filter(a => !(a.kind === kind && a.id === id))
      });
    } else {
      update({
        attachments: [...draft.attachments, {
          kind,
          id
        }]
      });
    }
  };
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose,
    style: {
      zIndex: 160
    }
  }, React.createElement("div", {
    className: "cn-modal",
    style: {
      maxWidth: 720,
      maxHeight: "88vh",
      display: "flex",
      flexDirection: "column"
    },
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, isNew ? "Upload" : "Edit", " document"), React.createElement("h2", {
    className: "cn-modal-title"
  }, draft.title || "Untitled document")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body",
    style: {
      overflow: "auto"
    }
  }, React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 2
    }
  }, React.createElement("label", null, "Title"), React.createElement("input", {
    className: "cn-input",
    value: draft.title,
    onChange: e => update({
      title: e.target.value
    }),
    autoFocus: true
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Category"), React.createElement("select", {
    className: "cn-input",
    value: draft.category,
    onChange: e => update({
      category: e.target.value,
      scope: window.CN_CROSS ? window.CN_CROSS.defaultDocScope(e.target.value) : draft.scope
    })
  }, DOC_CATEGORIES.map(c => React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.label))))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Description ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 optional, helps the team find it")), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 70
    },
    value: draft.description,
    onChange: e => update({
      description: e.target.value
    }),
    placeholder: "What's in this doc? When should it be used?"
  })), window.CN_CROSS && React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Who can send it"), React.createElement("div", {
    className: "cn-scope-pick"
  }, React.createElement("button", {
    className: `cn-scope-opt ${draft.scope === window.CN_CROSS.SHARED ? "is-active" : ""}`,
    onClick: () => update({
      scope: window.CN_CROSS.SHARED
    })
  }, React.createElement("span", {
    className: "cn-scope-opt-t"
  }, "Both brands"), React.createElement("span", {
    className: "cn-scope-opt-d"
  }, "Customer paperwork and OEM packages \u2014 the same instrument either way.")), React.createElement("button", {
    className: `cn-scope-opt ${draft.scope !== window.CN_CROSS.SHARED ? "is-active" : ""}`,
    onClick: () => update({
      scope: window.CN_CROSS.myCompany()
    })
  }, React.createElement("span", {
    className: "cn-scope-opt-t"
  }, window.CN_CROSS.companyLabel(window.CN_CROSS.myCompany()), " only"), React.createElement("span", {
    className: "cn-scope-opt-d"
  }, "Brand collateral \u2014 one-pagers, case studies, anything with our name on it.")))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Source"), React.createElement("div", {
    className: "cn-doc-source-tabs"
  }, React.createElement("button", {
    className: `cn-doc-source-tab ${draft.kind === "file" ? "is-active" : ""}`,
    onClick: () => update({
      kind: "file"
    })
  }, "\u2934 Upload file"), React.createElement("button", {
    className: `cn-doc-source-tab ${draft.kind === "url" ? "is-active" : ""}`,
    onClick: () => update({
      kind: "url"
    })
  }, "\uD83D\uDD17 External link"))), draft.kind === "file" ? React.createElement("div", {
    ref: dropRef,
    className: "cn-doc-drop",
    onDragOver: e => {
      e.preventDefault();
      dropRef.current?.classList.add("is-over");
    },
    onDragLeave: () => dropRef.current?.classList.remove("is-over"),
    onDrop: onDrop,
    onClick: () => document.getElementById("cn-doc-file-input")?.click()
  }, draft.data || !isNew && draft.url ? React.createElement("div", {
    className: "cn-doc-drop-have"
  }, React.createElement("span", {
    className: "cn-doc-drop-icon"
  }, fileIcon(draft.fileType || draft.fileName)), React.createElement("div", null, React.createElement("div", {
    className: "cn-doc-drop-name"
  }, draft.fileName || "Existing file"), React.createElement("div", {
    className: "cn-doc-drop-meta"
  }, draft.fileType && React.createElement("span", null, draft.fileType), draft.fileSize ? React.createElement("span", null, " \xB7 ", formatBytes(draft.fileSize)) : null)), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 30,
      marginLeft: "auto"
    },
    onClick: e => {
      e.stopPropagation();
      document.getElementById("cn-doc-file-input")?.click();
    }
  }, "Replace")) : React.createElement("div", {
    className: "cn-doc-drop-empty"
  }, React.createElement("div", {
    className: "cn-doc-drop-icon-lg"
  }, "\u2934"), React.createElement("div", {
    className: "cn-doc-drop-title"
  }, "Drop a file here or click to upload"), React.createElement("div", {
    className: "cn-doc-drop-sub"
  }, "PDF, DOCX, XLSX, images, etc. Max ~8MB.")), React.createElement("input", {
    id: "cn-doc-file-input",
    type: "file",
    style: {
      display: "none"
    },
    onChange: e => handleFile(e.target.files?.[0])
  })) : React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "External URL"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: draft.url,
    onChange: e => update({
      url: e.target.value
    }),
    placeholder: "https://drive.google.com/..."
  }), React.createElement("div", {
    className: "cn-field-help"
  }, "Anyone with the link should be able to open it. Use this for big files, Google Docs, Notion pages, etc.")), React.createElement("div", {
    className: "cn-field",
    style: {
      marginTop: 18
    }
  }, React.createElement("label", null, "Attach to"), React.createElement(DocAttachmentPicker, {
    attachments: draft.attachments,
    onToggle: toggleAttachment,
    scenario: scenario
  })), err && React.createElement("div", {
    className: "cn-login-error",
    style: {
      marginTop: 12
    }
  }, err)), React.createElement("footer", {
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
    onClick: save
  }, isNew ? "Upload document" : "Save changes")))));
}
function DocAttachmentPicker({
  attachments,
  onToggle,
  scenario
}) {
  var [q, setQ] = useState("");
  var search = q.trim().toLowerCase();
  var matchedOpps = !search ? [] : scenario.opps.filter(o => (o.title || "").toLowerCase().includes(search)).slice(0, 5);
  var matchedContacts = !search ? [] : scenario.contacts.filter(c => (c.name || "").toLowerCase().includes(search) || (c.email || "").toLowerCase().includes(search)).slice(0, 5);
  var matchedAccounts = !search ? [] : scenario.accounts.filter(a => (a.name || "").toLowerCase().includes(search)).slice(0, 5);
  var isAttached = (kind, id) => !!attachments.find(a => a.kind === kind && a.id === id);
  return React.createElement("div", {
    className: "cn-doc-attach-picker"
  }, React.createElement("input", {
    className: "cn-input",
    placeholder: "Search deals, contacts, or accounts to attach\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  }), search && matchedOpps.length + matchedContacts.length + matchedAccounts.length === 0 && React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12.5,
      padding: "8px 4px"
    }
  }, "No matches."), matchedOpps.length > 0 && React.createElement("div", {
    className: "cn-doc-attach-group"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Deals"), matchedOpps.map(o => React.createElement("button", {
    key: o.id,
    className: `cn-doc-attach-row ${isAttached("opp", o.id) ? "is-on" : ""}`,
    onClick: () => onToggle("opp", o.id)
  }, React.createElement("span", null, "\u25A4 ", o.title), React.createElement("span", {
    className: "cn-doc-attach-tag"
  }, isAttached("opp", o.id) ? "✓ Attached" : "+ Attach")))), matchedContacts.length > 0 && React.createElement("div", {
    className: "cn-doc-attach-group"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Contacts"), matchedContacts.map(c => React.createElement("button", {
    key: c.id,
    className: `cn-doc-attach-row ${isAttached("contact", c.id) ? "is-on" : ""}`,
    onClick: () => onToggle("contact", c.id)
  }, React.createElement("span", null, "\u25C9 ", c.name, " ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 11.5
    }
  }, c.email || "")), React.createElement("span", {
    className: "cn-doc-attach-tag"
  }, isAttached("contact", c.id) ? "✓ Attached" : "+ Attach")))), matchedAccounts.length > 0 && React.createElement("div", {
    className: "cn-doc-attach-group"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Accounts"), matchedAccounts.map(a => React.createElement("button", {
    key: a.id,
    className: `cn-doc-attach-row ${isAttached("account", a.id) ? "is-on" : ""}`,
    onClick: () => onToggle("account", a.id)
  }, React.createElement("span", null, "\u25A2 ", a.name), React.createElement("span", {
    className: "cn-doc-attach-tag"
  }, isAttached("account", a.id) ? "✓ Attached" : "+ Attach")))), attachments.length > 0 && React.createElement("div", {
    className: "cn-doc-attach-current"
  }, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginBottom: 6
    }
  }, "Currently attached"), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, attachments.map((a, i) => {
    var label = "";
    if (a.kind === "contact") label = "◉ " + (scenario.contacts.find(x => x.id === a.id)?.name || "unknown");
    if (a.kind === "opp") label = "▤ " + (scenario.opps.find(x => x.id === a.id)?.title || "unknown");
    if (a.kind === "account") label = "▢ " + (scenario.accounts.find(x => x.id === a.id)?.name || "unknown");
    return React.createElement("span", {
      key: i,
      className: "cn-doc-attach-pill"
    }, label, React.createElement("button", {
      onClick: () => onToggle(a.kind, a.id),
      title: "Remove"
    }, "\u2715"));
  }))));
}
Object.assign(window, {
  DocumentsScreen,
  DocumentRow,
  DocumentEditor,
  DocumentViewer,
  DocAttachmentPicker,
  readDocs,
  saveDoc,
  deleteDoc
});