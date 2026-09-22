(function injectImportStyles() {
  if (document.getElementById("cn-import-styles")) return;
  var s = document.createElement("style");
  s.id = "cn-import-styles";
  s.textContent = `
.cn-imp-drop{border:1.5px dashed var(--cn-line);border-radius:var(--cn-r-lg);background:var(--cn-paper-2);padding:34px 26px;text-align:center;transition:border-color .15s,background .15s}
.cn-imp-drop.is-over{border-color:var(--cn-copper);background:var(--cn-copper-wash)}
.cn-imp-drop-icon{font-size:26px;color:var(--cn-copper);line-height:1}
.cn-imp-drop-title{font-family:var(--cn-serif);font-size:19px;margin:10px 0 4px}
.cn-imp-drop-sub{color:var(--cn-mute);font-size:13px;margin:0 auto;max-width:400px;text-wrap:pretty}
.cn-imp-tpl{display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap}
.cn-imp-how{display:grid;gap:8px;margin-top:20px}
.cn-imp-how-row{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:start;font-size:12.8px;color:var(--cn-mute);text-wrap:pretty}
.cn-imp-how-n{width:20px;height:20px;border-radius:50%;background:var(--cn-copper-wash);color:var(--cn-copper-deep);font-size:11px;font-weight:600;display:grid;place-items:center;font-family:var(--cn-mono)}
.cn-imp-cols{margin-top:18px;border-top:1px solid var(--cn-line-2);padding-top:14px}
.cn-imp-cols-grid{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.cn-imp-col{font-family:var(--cn-mono);font-size:11px;padding:3px 7px;border-radius:4px;background:var(--cn-paper-2);border:1px solid var(--cn-line-2);color:var(--cn-mute)}
.cn-imp-col--req{background:var(--cn-copper-wash);border-color:var(--cn-copper-soft);color:var(--cn-copper-deep);font-weight:500}
.cn-imp-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--cn-line-2);border:1px solid var(--cn-line);border-radius:var(--cn-r);overflow:hidden;margin-bottom:14px}
.cn-imp-stat{background:var(--cn-card);padding:10px 12px}
.cn-imp-stat-label{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--cn-mute-2)}
.cn-imp-stat-val{font-family:var(--cn-mono);font-size:20px;margin-top:2px}
.cn-imp-group{border:1px solid var(--cn-line);border-radius:var(--cn-r);margin-bottom:10px;overflow:hidden;background:var(--cn-card)}
.cn-imp-group.is-off{opacity:.5}
.cn-imp-ghead{display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:center;padding:10px 12px;background:var(--cn-paper-2);border-bottom:1px solid var(--cn-line-2)}
.cn-imp-gname{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cn-imp-gname input{font-size:13.5px;font-weight:600;padding:4px 8px;min-width:200px}
.cn-imp-gdomain{font-family:var(--cn-mono);font-size:11.5px;color:var(--cn-mute)}
.cn-imp-pill{font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:99px;border:1px solid;white-space:nowrap}
.cn-imp-pill--new{color:var(--cn-pos);border-color:color-mix(in oklab,var(--cn-pos) 40%,transparent);background:color-mix(in oklab,var(--cn-pos) 8%,transparent)}
.cn-imp-pill--exist{color:var(--cn-copper-deep);border-color:var(--cn-copper-soft);background:var(--cn-copper-wash)}
.cn-imp-pill--dupe{color:var(--cn-warn);border-color:color-mix(in oklab,var(--cn-warn) 45%,transparent);background:color-mix(in oklab,var(--cn-warn) 9%,transparent)}
.cn-imp-crow{display:grid;grid-template-columns:22px 1.3fr 1.6fr 1.1fr 1fr auto;gap:10px;align-items:center;padding:7px 12px;border-top:1px solid var(--cn-line-2);font-size:12.8px}
.cn-imp-crow:first-of-type{border-top:0}
.cn-imp-cname{font-weight:500}
.cn-imp-cmeta{font-family:var(--cn-mono);font-size:11.5px;color:var(--cn-mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cn-imp-cmute{color:var(--cn-mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cn-imp-warn{border:1px solid color-mix(in oklab,var(--cn-warn) 40%,transparent);background:color-mix(in oklab,var(--cn-warn) 7%,transparent);border-radius:var(--cn-r);padding:10px 12px;font-size:12.8px;margin-bottom:12px;text-wrap:pretty}
.cn-imp-warn-list{margin:6px 0 0;padding-left:18px;color:var(--cn-mute);font-size:12px}
.cn-imp-bar{height:5px;border-radius:99px;background:var(--cn-line-2);overflow:hidden;margin-top:12px}
.cn-imp-bar-fill{height:100%;background:var(--cn-copper);transition:width .2s}
.cn-imp-done{text-align:center;padding:26px 20px}
.cn-imp-done-num{font-family:var(--cn-serif);font-size:40px;line-height:1.05}
.cn-imp-sec-title{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--cn-mute-2);margin:16px 0 8px}
.cn-imp-sec-title:first-child{margin-top:0}
`;
  document.head.appendChild(s);
})();
var IMP_NORM = s => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");
var IMP_FIELDS = {
  email: ["email", "emailaddress", "workemail", "e mail", "contactemail", "primaryemail"],
  firstName: ["firstname", "first", "givenname", "fname"],
  lastName: ["lastname", "last", "surname", "familyname", "lname"],
  fullName: ["name", "fullname", "contactname", "contact"],
  title: ["title", "jobtitle", "role", "position"],
  phone: ["phone", "phonenumber", "mobile", "cell", "directphone", "telephone", "tel"],
  tier: ["tier", "type", "contacttype", "influence", "persona"],
  company: ["company", "companyname", "account", "accountname", "organization", "organisation", "org", "employer"],
  website: ["website", "domain", "url", "web", "companywebsite", "site"],
  industry: ["industry", "sector", "vertical"],
  hq: ["hq", "headquarters", "location", "city", "citystate", "address", "region"],
  size: ["size", "headcount", "employees", "employeecount", "companysize"],
  notes: ["notes", "note", "comments", "comment"]
};
var IMP_TIERS = ["Champion", "Decision Maker", "Influencer", "Gatekeeper"];
var IMP_FREE_DOMAINS = new Set(["gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "hotmail.com", "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com", "mac.com", "protonmail.com", "proton.me", "gmx.com", "zoho.com", "mail.com", "comcast.net", "verizon.net", "att.net", "sbcglobal.net", "bellsouth.net", "cox.net", "charter.net", "qq.com", "163.com", "126.com", "yandex.com", "hey.com", "fastmail.com"]);
function impFieldFor(header) {
  var n = IMP_NORM(header);
  if (!n) return null;
  for (var [field, aliases] of Object.entries(IMP_FIELDS)) {
    if (aliases.some(a => IMP_NORM(a) === n)) return field;
  }
  var best = null,
    bestLen = 0;
  for (var [_field, _aliases] of Object.entries(IMP_FIELDS)) {
    for (var a of _aliases) {
      var an = IMP_NORM(a);
      if (an.length > 3 && n.includes(an) && an.length > bestLen) {
        best = _field;
        bestLen = an.length;
      }
    }
  }
  return best;
}
function impParseDelimited(text) {
  var clean = text.replace(/^\uFEFF/, "");
  var head = clean.split(/\r?\n/)[0] || "";
  var counts = {
    ",": (head.match(/,/g) || []).length,
    ";": (head.match(/;/g) || []).length,
    "\t": (head.match(/\t/g) || []).length
  };
  var delim = Object.keys(counts).reduce((a, b) => counts[b] > counts[a] ? b : a, ",");
  var rows = [];
  var row = [];
  var cell = "";
  var quoted = false;
  for (var i = 0; i < clean.length; i++) {
    var ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === delim) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => String(c).trim() !== ""));
}
var _impXlsxPromise = null;
function impLoadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (_impXlsxPromise) return _impXlsxPromise;
  _impXlsxPromise = new Promise((resolve, reject) => {
    var s = document.createElement("script");
    s.src = "https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error("Couldn't load the Excel reader (no connection). Save the sheet as CSV and try again."));
    document.head.appendChild(s);
  });
  return _impXlsxPromise;
}
async function impReadFile(file) {
  var name = (file.name || "").toLowerCase();
  if (/\.(xlsx|xlsm|xls)$/.test(name)) {
    var XLSX = await impLoadXlsx();
    var buf = await file.arrayBuffer();
    var wb = XLSX.read(buf, {
      type: "array"
    });
    var sheet = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: ""
    });
    return rows.filter(r => (r || []).some(c => String(c).trim() !== ""));
  }
  var text = await file.text();
  return impParseDelimited(text);
}
function impDomainOf(str) {
  var s = String(str || "").trim().toLowerCase();
  if (!s) return "";
  var raw = s.includes("@") ? s.split("@").pop() : s.replace(/^https?:\/\//, "").split("/")[0];
  return raw.replace(/^www\./, "").replace(/[^a-z0-9.\-]/g, "");
}
var IMP_TLD_TAIL = /\.(com|net|org|io|ai|co|inc|llc|us|uk|ca|de|fr|eu|dev|app|cloud|tech|bio|capital|ventures|group|systems|solutions|digital|energy|global|partners|works|xyz|gov|edu|mil)(\.[a-z]{2})?$/;
function impNameFromDomain(domain) {
  var base = String(domain || "").replace(IMP_TLD_TAIL, "").split(".").filter(Boolean).pop() || domain || "";
  return base.split(/[-_]/).filter(Boolean).map(w => w.length <= 3 && w === w.toLowerCase() && /^[a-z]+$/.test(w) && w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "Untitled company";
}
function impBuildPlan(rows, scenario) {
  if (!rows.length) return {
    groups: [],
    problems: [],
    mapped: {},
    unmapped: [],
    totalRows: 0
  };
  var headers = rows[0].map(h => String(h || "").trim());
  var map = headers.map(impFieldFor);
  var mapped = {};
  var unmapped = [];
  headers.forEach((h, i) => {
    if (map[i]) {
      if (!(map[i] in mapped)) mapped[map[i]] = h;
    } else if (h) unmapped.push(h);
  });
  var records = rows.slice(1).map((r, idx) => {
    var rec = {
      _row: idx + 2
    };
    map.forEach((f, i) => {
      if (f && !rec[f]) rec[f] = String(r[i] == null ? "" : r[i]).trim();
    });
    return rec;
  });
  var accounts = scenario && scenario.accounts || [];
  var contacts = scenario && scenario.contacts || [];
  var byDomain = {};
  var byName = {};
  accounts.forEach(a => {
    var d = impDomainOf(a.website);
    if (d) byDomain[d] = a;
    byName[IMP_NORM(a.name)] = a;
  });
  contacts.forEach(c => {
    var d = impDomainOf(c.email);
    if (!d || IMP_FREE_DOMAINS.has(d) || byDomain[d]) return;
    var acct = accounts.find(a => a.id === c.accountId);
    if (acct) byDomain[d] = acct;
  });
  var existingEmails = {};
  contacts.forEach(c => {
    var e = (c.email || "").trim().toLowerCase();
    if (e) existingEmails[e] = c;
  });
  var groups = [];
  var gIndex = {};
  var problems = [];
  var seenEmails = new Set();
  records.forEach(rec => {
    var email = (rec.email || "").trim().toLowerCase();
    var name = (rec.fullName || [rec.firstName, rec.lastName].filter(Boolean).join(" ")).trim();
    var companyCol = (rec.company || "").trim();
    if (!email && !companyCol) {
      problems.push({
        row: rec._row,
        why: "No email and no company — nothing to attach.",
        who: name || "—"
      });
      return;
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      problems.push({
        row: rec._row,
        why: `"${rec.email}" isn't a valid email.`,
        who: name || "—"
      });
      return;
    }
    var emailDomain = email ? impDomainOf(email) : "";
    var isFree = emailDomain && IMP_FREE_DOMAINS.has(emailDomain);
    var siteDomain = impDomainOf(rec.website);
    var domain = !isFree && emailDomain || siteDomain || "";
    if (!domain && !companyCol) {
      problems.push({
        row: rec._row,
        why: `${emailDomain || "That address"} is a personal mailbox — add a Company or Website value.`,
        who: name || email
      });
      return;
    }
    var existing = domain && byDomain[domain] || companyCol && byName[IMP_NORM(companyCol)] || null;
    var key = existing ? "acct:" + existing.id : domain ? "dom:" + domain : "name:" + IMP_NORM(companyCol);
    if (!gIndex[key]) {
      var _g = {
        key,
        accountId: existing ? existing.id : null,
        isNew: !existing,
        name: existing ? existing.name : companyCol || impNameFromDomain(domain),
        domain: domain || "",
        website: existing ? existing.website || "" : siteDomain || domain || "",
        industry: existing ? "" : rec.industry || "",
        hq: existing ? "" : rec.hq || "",
        size: existing ? "" : rec.size || "",
        include: true,
        contacts: []
      };
      gIndex[key] = _g;
      groups.push(_g);
    }
    var g = gIndex[key];
    if (g.isNew) {
      if (!g.industry && rec.industry) g.industry = rec.industry;
      if (!g.hq && rec.hq) g.hq = rec.hq;
      if (!g.size && rec.size) g.size = rec.size;
      if (!g.website && siteDomain) g.website = siteDomain;
      if (companyCol && g.name !== companyCol && impNameFromDomain(g.domain) === g.name) g.name = companyCol;
    }
    if (!email) {
      problems.push({
        row: rec._row,
        why: "No email — contact skipped, the account will still be created.",
        who: name || companyCol
      });
      return;
    }
    var status = "new";
    if (existingEmails[email]) status = "dupe";else if (seenEmails.has(email)) status = "repeat";
    seenEmails.add(email);
    var tierRaw = (rec.tier || "").trim();
    var tier = IMP_TIERS.find(t => IMP_NORM(t) === IMP_NORM(tierRaw)) || (tierRaw ? tierRaw : "");
    g.contacts.push({
      row: rec._row,
      name: name || impNameFromDomain(email.split("@")[0].replace(/[._]/g, "-")),
      email,
      title: rec.title || "",
      phone: rec.phone || "",
      tier,
      status,
      include: status === "new",
      existingName: status === "dupe" ? existingEmails[email].name : ""
    });
  });
  return {
    groups,
    problems,
    mapped,
    unmapped,
    totalRows: records.length
  };
}
var IMP_TEMPLATE_HEADERS = ["First name", "Last name", "Email", "Title", "Phone", "Tier", "Company", "Website", "Industry", "HQ", "Headcount"];
var IMP_TEMPLATE_ROWS = [["First name", "Last name", "name@company.com", "Job title", "+1 000 000 0000", "Champion", "Company", "company.com", "Industry", "City, ST", "0"]];
function impCsvEscape(v) {
  var s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function impDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function impDownloadCsvTemplate() {
  var lines = [IMP_TEMPLATE_HEADERS, ...IMP_TEMPLATE_ROWS].map(r => r.map(impCsvEscape).join(","));
  impDownload(new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8"
  }), "CRM import template.csv");
}
async function impDownloadXlsxTemplate() {
  var XLSX = await impLoadXlsx();
  var ws = XLSX.utils.aoa_to_sheet([IMP_TEMPLATE_HEADERS, ...IMP_TEMPLATE_ROWS]);
  ws["!cols"] = IMP_TEMPLATE_HEADERS.map(h => ({
    wch: Math.max(12, h.length + 6)
  }));
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contacts");
  var out = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array"
  });
  impDownload(new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }), "CRM import template.xlsx");
}
function ImportModal({
  open,
  onClose,
  scenario,
  currentUser,
  onSaved
}) {
  var [step, setStep] = useState("drop");
  var [fileName, setFileName] = useState("");
  var [plan, setPlan] = useState(null);
  var [error, setError] = useState(null);
  var [over, setOver] = useState(false);
  var [busy, setBusy] = useState(false);
  var [progress, setProgress] = useState({
    done: 0,
    total: 0
  });
  var [result, setResult] = useState(null);
  var fileRef = useRef(null);
  useEffect(() => {
    if (open) {
      setStep("drop");
      setPlan(null);
      setError(null);
      setFileName("");
      setResult(null);
      setProgress({
        done: 0,
        total: 0
      });
    }
  }, [open]);
  var counts = useMemo(() => {
    if (!plan) return {
      newAcc: 0,
      existAcc: 0,
      newC: 0,
      dupes: 0
    };
    var newAcc = 0,
      existAcc = 0,
      newC = 0,
      dupes = 0;
    plan.groups.forEach(g => {
      var picked = g.contacts.filter(c => c.include).length;
      if (!g.include) return;
      if (g.isNew) newAcc++;else if (picked) existAcc++;
      newC += picked;
      dupes += g.contacts.filter(c => c.status !== "new").length;
    });
    return {
      newAcc,
      existAcc,
      newC,
      dupes
    };
  }, [plan]);
  if (!open) return null;
  var takeFile = async file => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      var rows = await impReadFile(file);
      if (rows.length < 2) throw new Error("That file has a header row but no data rows.");
      var p = impBuildPlan(rows, scenario);
      if (!p.mapped.email && !p.mapped.company) {
        throw new Error("Couldn't find an Email or Company column. Download the template to see the expected headers.");
      }
      if (!p.groups.length) throw new Error("No importable rows found — every row was missing an email and a company.");
      setFileName(file.name);
      setPlan(p);
      setStep("preview");
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  var patchGroup = (key, patch) => setPlan(p => ({
    ...p,
    groups: p.groups.map(g => g.key === key ? {
      ...g,
      ...patch
    } : g)
  }));
  var patchContact = (key, row, patch) => setPlan(p => ({
    ...p,
    groups: p.groups.map(g => g.key === key ? {
      ...g,
      contacts: g.contacts.map(c => c.row === row ? {
        ...c,
        ...patch
      } : c)
    } : g)
  }));
  var runImport = async () => {
    var groups = plan.groups.filter(g => g.include);
    var total = groups.length + groups.reduce((s, g) => s + g.contacts.filter(c => c.include).length, 0);
    setStep("running");
    setProgress({
      done: 0,
      total
    });
    var accountsMade = 0,
      contactsMade = 0,
      failed = 0;
    var done = 0;
    var owner = currentUser && currentUser.id || null;
    for (var g of groups) {
      var accountId = g.accountId;
      try {
        if (!accountId) {
          var created = await window.insertAccount({
            name: (g.name || "").trim() || impNameFromDomain(g.domain),
            industry: g.industry || "",
            hq: g.hq || "",
            size: g.size || "",
            website: g.website || g.domain || "",
            owner_id: owner
          });
          accountId = created && created.id;
          accountsMade++;
        }
      } catch (e) {
        failed++;
      }
      done++;
      setProgress({
        done,
        total
      });
      for (var c of g.contacts.filter(x => x.include)) {
        try {
          await window.insertContact({
            account_id: accountId || null,
            name: c.name,
            title: c.title || "",
            email: c.email,
            phone: c.phone || "",
            tier: c.tier || "",
            owner_id: owner
          });
          contactsMade++;
        } catch (e) {
          failed++;
        }
        done++;
        setProgress({
          done,
          total
        });
      }
    }
    setResult({
      accountsMade,
      contactsMade,
      failed
    });
    setStep("done");
    window.cnToast && window.cnToast({
      title: `Imported ${contactsMade} contact${contactsMade === 1 ? "" : "s"}`,
      sub: `${accountsMade} new account${accountsMade === 1 ? "" : "s"} created`
    });
    onSaved && onSaved();
  };
  var skippedContacts = plan ? plan.groups.reduce((s, g) => s + g.contacts.filter(c => !c.include).length, 0) : 0;
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: e => {
      if (e.target === e.currentTarget && step !== "running") onClose();
    }
  }, React.createElement("div", {
    className: "cn-modal",
    onClick: e => e.stopPropagation(),
    style: {
      width: step === "drop" ? 620 : 900,
      maxWidth: "94vw"
    }
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Import"), React.createElement("h2", {
    className: "cn-modal-title"
  }, step === "drop" ? "Accounts & contacts from a spreadsheet" : step === "preview" ? "Review before importing" : step === "running" ? "Importing…" : "Import complete")), step !== "running" && React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, error && React.createElement("div", {
    className: "cn-login-error",
    style: {
      marginBottom: 12
    }
  }, error), step === "drop" && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-imp-drop" + (over ? " is-over" : ""),
    onDragOver: e => {
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: e => {
      e.preventDefault();
      setOver(false);
      takeFile(e.dataTransfer.files && e.dataTransfer.files[0]);
    }
  }, React.createElement("div", {
    className: "cn-imp-drop-icon"
  }, "\u2913"), React.createElement("div", {
    className: "cn-imp-drop-title"
  }, busy ? "Reading your file…" : "Drop a CSV or Excel file"), React.createElement("p", {
    className: "cn-imp-drop-sub"
  }, "One row per contact. We read the email domain to group people into accounts \u2014 create both in one pass, then fill in the blanks in the CRM."), React.createElement("div", {
    className: "cn-imp-tpl"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => fileRef.current && fileRef.current.click(),
    disabled: busy
  }, "Choose file"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: impDownloadCsvTemplate
  }, "\u2193 CSV template"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => impDownloadXlsxTemplate().catch(e => setError(e.message))
  }, "\u2193 Excel template")), React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: ".csv,.tsv,.txt,.xlsx,.xls,.xlsm",
    style: {
      display: "none"
    },
    onChange: e => {
      takeFile(e.target.files && e.target.files[0]);
      e.target.value = "";
    }
  })), React.createElement("div", {
    className: "cn-imp-how"
  }, React.createElement("div", {
    className: "cn-imp-how-row"
  }, React.createElement("span", {
    className: "cn-imp-how-n"
  }, "1"), React.createElement("span", null, React.createElement("strong", null, "Email is the only column that matters."), " Everything else is optional \u2014 leave it blank and fill it in later.")), React.createElement("div", {
    className: "cn-imp-how-row"
  }, React.createElement("span", {
    className: "cn-imp-how-n"
  }, "2"), React.createElement("span", null, React.createElement("strong", null, "Accounts come from the domain."), " Two people at ", React.createElement("span", {
    className: "cn-mono"
  }, "@acme.com"), " land on one Acme account. Already have Acme? They're added to it, not duplicated.")), React.createElement("div", {
    className: "cn-imp-how-row"
  }, React.createElement("span", {
    className: "cn-imp-how-n"
  }, "3"), React.createElement("span", null, React.createElement("strong", null, "Gmail-style addresses need a Company."), " Personal mailboxes can't name a company, so add one in the Company column for those rows.")), React.createElement("div", {
    className: "cn-imp-how-row"
  }, React.createElement("span", {
    className: "cn-imp-how-n"
  }, "4"), React.createElement("span", null, React.createElement("strong", null, "You review everything"), " \u2014 account names, which contacts to skip \u2014 before a single record is written."))), React.createElement("div", {
    className: "cn-imp-cols"
  }, React.createElement("div", {
    className: "cn-imp-sec-title"
  }, "Columns we recognise \xB7 header names are flexible"), React.createElement("div", {
    className: "cn-imp-cols-grid"
  }, React.createElement("span", {
    className: "cn-imp-col cn-imp-col--req"
  }, "Email"), ["First name", "Last name", "Title", "Phone", "Tier", "Company", "Website", "Industry", "HQ", "Headcount"].map(c => React.createElement("span", {
    key: c,
    className: "cn-imp-col"
  }, c))))), step === "preview" && plan && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-imp-strip"
  }, React.createElement("div", {
    className: "cn-imp-stat"
  }, React.createElement("div", {
    className: "cn-imp-stat-label"
  }, "New accounts"), React.createElement("div", {
    className: "cn-imp-stat-val"
  }, counts.newAcc)), React.createElement("div", {
    className: "cn-imp-stat"
  }, React.createElement("div", {
    className: "cn-imp-stat-label"
  }, "Existing matched"), React.createElement("div", {
    className: "cn-imp-stat-val"
  }, counts.existAcc)), React.createElement("div", {
    className: "cn-imp-stat"
  }, React.createElement("div", {
    className: "cn-imp-stat-label"
  }, "Contacts in"), React.createElement("div", {
    className: "cn-imp-stat-val"
  }, counts.newC)), React.createElement("div", {
    className: "cn-imp-stat"
  }, React.createElement("div", {
    className: "cn-imp-stat-label"
  }, "Skipped"), React.createElement("div", {
    className: "cn-imp-stat-val",
    style: {
      color: skippedContacts ? "var(--cn-warn)" : "var(--cn-mute-2)"
    }
  }, skippedContacts + plan.problems.length))), React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--cn-mute)",
      marginBottom: 12
    }
  }, React.createElement("span", {
    className: "cn-mono"
  }, fileName), " \xB7 ", plan.totalRows, " row", plan.totalRows === 1 ? "" : "s", plan.unmapped.length > 0 && React.createElement(React.Fragment, null, " \xB7 ignored columns: ", plan.unmapped.map(u => React.createElement("span", {
    key: u,
    className: "cn-mono",
    style: {
      marginRight: 6
    }
  }, u)))), plan.problems.length > 0 && React.createElement("div", {
    className: "cn-imp-warn"
  }, React.createElement("strong", null, plan.problems.length, " row", plan.problems.length === 1 ? "" : "s", " can't be imported"), " \u2014 fix them in the sheet and re-import, or add them by hand.", React.createElement("ul", {
    className: "cn-imp-warn-list"
  }, plan.problems.slice(0, 6).map((p, i) => React.createElement("li", {
    key: i
  }, "Row ", p.row, " \xB7 ", p.who, " \u2014 ", p.why)), plan.problems.length > 6 && React.createElement("li", null, "\u2026and ", plan.problems.length - 6, " more"))), plan.groups.map(g => React.createElement("div", {
    key: g.key,
    className: "cn-imp-group" + (g.include ? "" : " is-off")
  }, React.createElement("div", {
    className: "cn-imp-ghead"
  }, React.createElement("input", {
    type: "checkbox",
    checked: g.include,
    onChange: e => patchGroup(g.key, {
      include: e.target.checked
    })
  }), React.createElement("div", {
    className: "cn-imp-gname"
  }, g.isNew ? React.createElement("input", {
    className: "cn-input",
    value: g.name,
    onChange: e => patchGroup(g.key, {
      name: e.target.value
    }),
    placeholder: "Company name"
  }) : React.createElement("span", {
    style: {
      fontWeight: 600,
      fontSize: 13.5
    }
  }, g.name), g.domain && React.createElement("span", {
    className: "cn-imp-gdomain"
  }, g.domain)), React.createElement("span", {
    className: "cn-imp-pill " + (g.isNew ? "cn-imp-pill--new" : "cn-imp-pill--exist")
  }, g.isNew ? "New account" : "Existing account")), g.contacts.length === 0 && React.createElement("div", {
    className: "cn-imp-crow",
    style: {
      gridTemplateColumns: "1fr",
      color: "var(--cn-mute)"
    }
  }, "Account only \u2014 no contacts on this row."), g.contacts.map(c => React.createElement("div", {
    className: "cn-imp-crow",
    key: c.row
  }, React.createElement("input", {
    type: "checkbox",
    checked: c.include,
    onChange: e => patchContact(g.key, c.row, {
      include: e.target.checked
    })
  }), React.createElement("div", {
    className: "cn-imp-cname"
  }, c.name), React.createElement("div", {
    className: "cn-imp-cmeta"
  }, c.email), React.createElement("div", {
    className: "cn-imp-cmute"
  }, c.title || React.createElement("span", {
    style: {
      color: "var(--cn-mute-2)"
    }
  }, "no title")), React.createElement("div", {
    className: "cn-imp-cmute cn-mono"
  }, c.phone || ""), c.status === "dupe" ? React.createElement("span", {
    className: "cn-imp-pill cn-imp-pill--dupe"
  }, "Already in CRM") : c.status === "repeat" ? React.createElement("span", {
    className: "cn-imp-pill cn-imp-pill--dupe"
  }, "Dup in file") : React.createElement("span", {
    className: "cn-imp-pill cn-imp-pill--new"
  }, "New")))))), step === "running" && React.createElement("div", {
    style: {
      padding: "24px 4px"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13.5
    }
  }, "Writing ", progress.total, " record", progress.total === 1 ? "" : "s", "\u2026 ", React.createElement("span", {
    className: "cn-mono"
  }, progress.done, "/", progress.total)), React.createElement("div", {
    className: "cn-imp-bar"
  }, React.createElement("div", {
    className: "cn-imp-bar-fill",
    style: {
      width: (progress.total ? progress.done / progress.total * 100 : 0) + "%"
    }
  }))), step === "done" && result && React.createElement("div", {
    className: "cn-imp-done"
  }, React.createElement("div", {
    className: "cn-imp-done-num"
  }, result.contactsMade), React.createElement("div", {
    style: {
      fontSize: 14,
      marginTop: 2
    }
  }, "contact", result.contactsMade === 1 ? "" : "s", " imported across ", result.accountsMade, " new account", result.accountsMade === 1 ? "" : "s"), React.createElement("p", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 13,
      maxWidth: 420,
      margin: "12px auto 0",
      textWrap: "pretty"
    }
  }, "Blank fields are yours to fill in \u2014 open any account or contact and edit inline.", result.failed > 0 && React.createElement(React.Fragment, null, " ", result.failed, " record", result.failed === 1 ? "" : "s", " failed to write and were skipped.")))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, step === "preview" && React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => {
      setStep("drop");
      setPlan(null);
    }
  }, "\u2190 Choose another file"), React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 10
    }
  }, step !== "running" && step !== "done" && React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Cancel"), step === "preview" && React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: runImport,
    disabled: counts.newAcc + counts.existAcc === 0
  }, "Import ", counts.newC, " contact", counts.newC === 1 ? "" : "s", " \xB7 ", counts.newAcc, " new account", counts.newAcc === 1 ? "" : "s"), step === "done" && React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: onClose
  }, "Done")))));
}
Object.assign(window, {
  ImportModal,
  impBuildPlan,
  impParseDelimited,
  impDomainOf,
  impNameFromDomain,
  impDownloadCsvTemplate,
  impDownloadXlsxTemplate
});