(function injectCallSyncStyles() {
  if (document.getElementById("cn-callsync-styles")) return;
  var s = document.createElement("style");
  s.id = "cn-callsync-styles";
  s.textContent = `
.cn-cs-tabs{display:flex;gap:2px;background:var(--cn-paper-2);border:1px solid var(--cn-line);border-radius:var(--cn-r);padding:3px;width:fit-content;margin-bottom:16px}
.cn-cs-tab{border:0;background:transparent;font:inherit;font-size:12.8px;padding:6px 14px;border-radius:4px;cursor:pointer;color:var(--cn-mute)}
.cn-cs-tab.is-active{background:var(--cn-card);color:var(--cn-ink);box-shadow:0 1px 2px rgba(26,22,18,.06);font-weight:500}
.cn-cs-tab-n{font-family:var(--cn-mono);font-size:10.5px;margin-left:6px;padding:1px 5px;border-radius:99px;background:var(--cn-copper-wash);color:var(--cn-copper-deep)}
.cn-cs-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--cn-line-2);border:1px solid var(--cn-line);border-radius:var(--cn-r);overflow:hidden;margin-bottom:18px}
.cn-cs-stat{background:var(--cn-card);padding:12px 14px}
.cn-cs-stat-label{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--cn-mute-2)}
.cn-cs-stat-val{font-family:var(--cn-mono);font-size:22px;margin-top:2px}
.cn-cs-stat-sub{font-size:11.5px;color:var(--cn-mute);margin-top:1px}
.cn-cs-row{display:grid;grid-template-columns:1.4fr 1fr auto;gap:14px;align-items:start;padding:13px 15px;border-top:1px solid var(--cn-line-2)}
.cn-cs-row:first-of-type{border-top:0}
.cn-cs-who{font-weight:600;font-size:13.5px}
.cn-cs-meta{font-size:11.5px;color:var(--cn-mute);margin-top:2px;font-family:var(--cn-mono)}
.cn-cs-summary{font-size:12.8px;color:var(--cn-ink-2);margin-top:6px;line-height:1.5;text-wrap:pretty;max-height:4.6em;overflow:hidden}
.cn-cs-summary.is-open{max-height:none}
.cn-cs-more{border:0;background:none;font:inherit;font-size:11.5px;color:var(--cn-copper-deep);cursor:pointer;padding:2px 0;text-decoration:underline}
.cn-cs-actions{display:flex;flex-direction:column;gap:6px;align-items:stretch;min-width:150px}
.cn-cs-empty{text-align:center;padding:44px 24px;color:var(--cn-mute)}
.cn-cs-empty-title{font-family:var(--cn-serif);font-size:20px;color:var(--cn-ink);margin:0 0 6px}
.cn-cs-paste{width:100%;min-height:200px;font-family:var(--cn-mono);font-size:12px;line-height:1.6;padding:12px;border:1px solid var(--cn-line);border-radius:var(--cn-r);background:var(--cn-paper-2);color:var(--cn-ink);resize:vertical}
.cn-cs-paste:focus{outline:none;border-color:var(--cn-copper);background:var(--cn-card)}
.cn-cs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.cn-cs-code{font-family:var(--cn-mono);font-size:11.5px;background:var(--cn-side);color:var(--cn-side-ink);padding:12px 14px;border-radius:var(--cn-r);overflow-x:auto;white-space:pre;line-height:1.65;margin:0}
.cn-cs-url{display:flex;gap:8px;align-items:center}
.cn-cs-url input{font-family:var(--cn-mono);font-size:12px}
.cn-cs-step{display:grid;grid-template-columns:24px 1fr;gap:12px;align-items:start;padding:11px 0;border-top:1px solid var(--cn-line-2)}
.cn-cs-step:first-of-type{border-top:0}
.cn-cs-step-n{width:22px;height:22px;border-radius:50%;background:var(--cn-copper-wash);color:var(--cn-copper-deep);font-family:var(--cn-mono);font-size:11px;font-weight:600;display:grid;place-items:center}
.cn-cs-step-b{font-size:13px;line-height:1.55;text-wrap:pretty}
.cn-cs-step-b strong{font-weight:600}
.cn-cs-note{font-size:12.5px;color:var(--cn-mute);text-wrap:pretty;line-height:1.55}
.cn-cs-pill{font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:99px;border:1px solid;white-space:nowrap}
.cn-cs-pill--in{color:var(--cn-pos);border-color:color-mix(in oklab,var(--cn-pos) 40%,transparent);background:color-mix(in oklab,var(--cn-pos) 8%,transparent)}
.cn-cs-pill--out{color:var(--cn-copper-deep);border-color:var(--cn-copper-soft);background:var(--cn-copper-wash)}
.cn-cs-pill--warn{color:var(--cn-warn);border-color:color-mix(in oklab,var(--cn-warn) 45%,transparent);background:color-mix(in oklab,var(--cn-warn) 9%,transparent)}
.cn-cs-live{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--cn-mute)}
.cn-cs-dot{width:7px;height:7px;border-radius:50%;background:var(--cn-mute-2)}
.cn-cs-dot.is-live{background:var(--cn-pos)}
`;
  document.head.appendChild(s);
})();
var CS_DISMISS_KEY = "cn-callsync-dismissed";
var CS_CFG_KEY = "cn-callsync-config";
function csRead(key, fallback) {
  try {
    var v = JSON.parse(localStorage.getItem(key) || "null");
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}
function csWrite(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}
function csDismissed() {
  return csRead(CS_DISMISS_KEY, []);
}
function csDismiss(id) {
  var l = csDismissed();
  if (l.indexOf(id) < 0) {
    l.push(id);
    csWrite(CS_DISMISS_KEY, l);
  }
}
function csConfig() {
  return csRead(CS_CFG_KEY, {
    projectRef: "",
    secret: ""
  });
}
function csSaveConfig(cfg) {
  csWrite(CS_CFG_KEY, cfg);
}
function csNormalizeRef(raw) {
  return String(raw || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/\.(functions\.)?supabase\.co$/i, "").replace(/[^a-z0-9]/gi, "");
}
function csAppRef() {
  var url = window.sb && window.sb.supabaseUrl || (typeof SUPABASE_URL !== "undefined" ? SUPABASE_URL : "") || window.CN_SUPABASE_URL || "";
  return csNormalizeRef(url);
}
function csProjectRef() {
  var typed = csNormalizeRef(csConfig().projectRef);
  return csAppRef() || typed;
}
function csRefIsValid(ref) {
  return /^[a-z0-9]{16,}$/i.test(ref || "");
}
function csWebhookUrl() {
  var ref = csProjectRef();
  return csRefIsValid(ref) ? `https://${ref}.functions.supabase.co/call-sync` : "https://<your-project-ref>.functions.supabase.co/call-sync";
}
function csIsSynced(a) {
  return a && (a.source === "call-sync" || a.source === "recorder" || /^(call|meeting)$/.test(a.type || "") === true && a.source);
}
function csPendingCalls(scenario) {
  var dismissed = csDismissed();
  var acts = scenario && (scenario.allActivities || scenario.activities) || [];
  return acts.filter(a => (a.type === "call" || a.type === "meeting") && (a.source === "call-sync" || a.source === "recorder") && !a.oppId && dismissed.indexOf(a.id) < 0);
}
window.cnPendingCalls = csPendingCalls;
function csStubContacts(scenario) {
  var contacts = scenario && scenario.contacts || [];
  return contacts.filter(c => !c.email && /^[\d\s+()\-.]{7,}$/.test(String(c.name || "").trim()));
}
var CS_MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
function csParsePaste(text, scenario) {
  var raw = String(text || "");
  var out = {
    name: "",
    email: "",
    phone: "",
    when: "",
    duration: "",
    summary: "",
    title: "",
    contactId: "",
    direction: "outbound"
  };
  if (!raw.trim()) return out;
  var contacts = scenario && scenario.contacts || [];
  var lower = raw.toLowerCase();
  var emails = [...new Set((raw.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g) || []).map(e => e.toLowerCase()))];
  var _loop = function (e) {
    var hit = contacts.find(c => (c.email || "").toLowerCase() === e);
    if (hit) {
      out.contactId = hit.id;
      out.email = e;
      out.name = hit.name;
      return 1;
    }
  };
  for (var e of emails) {
    if (_loop(e)) break;
  }
  if (!out.email && emails.length) out.email = emails[0];
  var phones = (raw.match(/\+?\d[\d ().\-]{6,20}\d/g) || []).map(s => s.trim()).filter(s => {
    var d = s.replace(/\D/g, "");
    if (d.length < 7 || d.length > 15) return false;
    if (/^20\d{2}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) return false;
    return true;
  });
  if (phones.length) out.phone = phones[0];
  if (!out.contactId && out.phone) {
    var digits = out.phone.replace(/\D/g, "").slice(-10);
    var hit = contacts.find(c => (c.phone || "").replace(/\D/g, "").slice(-10) === digits && digits.length >= 7);
    if (hit) {
      out.contactId = hit.id;
      out.name = hit.name;
    }
  }
  var CS_CONNECTORS = /\s+(?:on|at|re|about|from|for|today|yesterday|tomorrow|last|this|next|via|and|to)$/i;
  var withName = raw.match(/\b(?:[Cc]all|[Mm]eeting|[Cc]hat|[Ss]ync|[Ss]poke|[Ss]peaking|[Tt]alked|[Cc]onversation)[ \t]+with[ \t]+([A-Z][\w.'’-]+(?:[ \t]+[A-Z][\w.'’-]+){0,2})/);
  if (withName) {
    var n = withName[1].trim();
    while (CS_CONNECTORS.test(n)) n = n.replace(CS_CONNECTORS, "");
    var _hit = contacts.find(c => (c.name || "").toLowerCase() === n.toLowerCase());
    if (_hit) {
      out.contactId = _hit.id;
      out.name = _hit.name;
    } else if (n) out.name = n;
  }
  var repNames = new Set((scenario && scenario.reps || []).flatMap(r => [r.name, r.fullName].filter(Boolean).map(s => s.toLowerCase())));
  var isUs = n => {
    var l = String(n || "").toLowerCase();
    return repNames.has(l) || [...repNames].some(r => r.length > 3 && l === r);
  };
  var who = raw.match(/(?:attendees?|participants?|caller|called|with)\s*[:\-–]\s*([^\n]+)/i);
  if (who && !out.contactId) {
    var names = who[1].split(/[,;/&]| and /i).map(s => s.replace(/<[^>]*>/g, "").replace(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, "").trim()).filter(n => n && !isUs(n));
    var _loop2 = function (_n) {
      var hit = contacts.find(c => (c.name || "").toLowerCase() === _n.toLowerCase());
      if (hit) {
        out.contactId = hit.id;
        out.name = hit.name;
        return 1;
      }
      if (!out.name && /^[A-Z][a-z]+(\s+[A-Z][a-z.'-]+)+$/.test(_n)) out.name = _n;
    };
    for (var _n of names) {
      if (_loop2(_n)) break;
    }
    if (!out.name && names.length) out.name = names[0];
  }
  if (!out.contactId) {
    var _hit2 = contacts.find(c => c.name && c.name.length > 5 && !isUs(c.name) && lower.includes(c.name.toLowerCase()));
    if (_hit2) {
      out.contactId = _hit2.id;
      out.name = _hit2.name;
    }
  }
  var dm = raw.match(/(\d+)\s*(?:hours?|hrs?|h)\s*(\d+)?\s*(?:minutes?|mins?|m)?/i);
  var clock = raw.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/);
  var mins = raw.match(/(\d{1,3})\s*(?:minutes?|mins?|min)\b/i);
  if (clock) out.duration = String(parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10));else if (dm && /h/i.test(dm[0])) out.duration = String(parseInt(dm[1], 10) * 60 + parseInt(dm[2] || "0", 10));else if (mins) out.duration = mins[1];
  var iso = raw.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  var us = raw.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2}|\d{2})\b/);
  var wordy = new RegExp(`\\b(${CS_MONTHS})[a-z]*\\.?\\s+(\\d{1,2})(?:,)?\\s*(20\\d{2})?`, "i");
  var wm = raw.match(wordy);
  var toISO = d => isNaN(d) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  if (iso) out.when = toISO(new Date(`${iso[1]}-${iso[2]}-${iso[3]}T09:00`));else if (us) out.when = toISO(new Date(`${us[3].length === 2 ? "20" + us[3] : us[3]}-${String(us[1]).padStart(2, "0")}-${String(us[2]).padStart(2, "0")}T09:00`));else if (wm) out.when = toISO(new Date(`${wm[1]} ${wm[2]}, ${wm[3] || new Date().getFullYear()} 09:00`));
  if (!out.when) out.when = toISO(new Date());
  if (/\b(inbound|incoming|they called|called (me|us)|received)\b/i.test(raw)) out.direction = "inbound";
  var secMatch = raw.match(/(?:^|\n)\s*(?:ai\s+)?(?:summary|overview|recap|key\s+takeaways|meeting\s+summary)\s*[:\-–]?\s*\n?([\s\S]*?)(?=\n\s*(?:action items?|next steps?|transcript|attendees?|participants?|topics?|questions?)\s*[:\-–]|$)/i);
  out.summary = (secMatch ? secMatch[1] : raw).trim();
  var firstLine = raw.split(/\n/).map(l => l.trim()).find(l => l.length > 3 && l.length < 90 && !/^[\w.+-]+@/.test(l));
  out.title = firstLine || "Call";
  var act = raw.match(/(?:action items?|next steps?)\s*[:\-–]?\s*\n?([\s\S]{0,300}?)(?=\n\s*\n|$)/i);
  out.nextStep = act ? act[1].split(/\n/).map(l => l.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean)[0] || "" : "";
  return out;
}
window.csParsePaste = csParsePaste;
function CallSync({
  scenario,
  currentUser,
  onOpenContact,
  onOpenOpp,
  onSaved
}) {
  var pending = csPendingCalls(scenario);
  var stubs = csStubContacts(scenario);
  var [tab, setTab] = useState(pending.length ? "inbox" : "log");
  var synced = (scenario && (scenario.allActivities || scenario.activities) || []).filter(a => a.source === "call-sync" || a.source === "recorder");
  var weekAgo = Date.now() - 7 * 86400000;
  var thisWeek = synced.filter(a => a.occurredAt && new Date(a.occurredAt).getTime() > weekAgo).length;
  var live = synced.some(a => a.source === "call-sync");
  return React.createElement("div", {
    className: "cn-page"
  }, React.createElement("div", {
    className: "cn-cs-strip"
  }, React.createElement("div", {
    className: "cn-cs-stat"
  }, React.createElement("div", {
    className: "cn-cs-stat-label"
  }, "Synced this week"), React.createElement("div", {
    className: "cn-cs-stat-val"
  }, thisWeek), React.createElement("div", {
    className: "cn-cs-stat-sub"
  }, React.createElement("span", {
    className: "cn-cs-live"
  }, React.createElement("span", {
    className: "cn-cs-dot" + (live ? " is-live" : "")
  }), live ? "endpoint receiving" : "no webhook traffic yet"))), React.createElement("div", {
    className: "cn-cs-stat"
  }, React.createElement("div", {
    className: "cn-cs-stat-label"
  }, "Needs a deal"), React.createElement("div", {
    className: "cn-cs-stat-val",
    style: {
      color: pending.length ? "var(--cn-warn)" : "var(--cn-mute-2)"
    }
  }, pending.length), React.createElement("div", {
    className: "cn-cs-stat-sub"
  }, "calls not tied to an opportunity")), React.createElement("div", {
    className: "cn-cs-stat"
  }, React.createElement("div", {
    className: "cn-cs-stat-label"
  }, "Contacts to name"), React.createElement("div", {
    className: "cn-cs-stat-val",
    style: {
      color: stubs.length ? "var(--cn-warn)" : "var(--cn-mute-2)"
    }
  }, stubs.length), React.createElement("div", {
    className: "cn-cs-stat-sub"
  }, "created from a bare number")), React.createElement("div", {
    className: "cn-cs-stat"
  }, React.createElement("div", {
    className: "cn-cs-stat-label"
  }, "Total on file"), React.createElement("div", {
    className: "cn-cs-stat-val"
  }, synced.length), React.createElement("div", {
    className: "cn-cs-stat-sub"
  }, "calls + meetings synced"))), React.createElement("div", {
    className: "cn-cs-tabs"
  }, React.createElement("button", {
    className: "cn-cs-tab" + (tab === "inbox" ? " is-active" : ""),
    onClick: () => setTab("inbox")
  }, "Inbox", pending.length > 0 && React.createElement("span", {
    className: "cn-cs-tab-n"
  }, pending.length)), React.createElement("button", {
    className: "cn-cs-tab" + (tab === "log" ? " is-active" : ""),
    onClick: () => setTab("log")
  }, "Log from recorder"), React.createElement("button", {
    className: "cn-cs-tab" + (tab === "import" ? " is-active" : ""),
    onClick: () => setTab("import")
  }, "Import notes"), React.createElement("button", {
    className: "cn-cs-tab" + (tab === "setup" ? " is-active" : ""),
    onClick: () => setTab("setup")
  }, "Connect a source")), tab === "inbox" && React.createElement(CsInbox, {
    scenario: scenario,
    pending: pending,
    stubs: stubs,
    onOpenContact: onOpenContact,
    onSaved: onSaved
  }), tab === "log" && React.createElement(CsLogFromRecorder, {
    scenario: scenario,
    currentUser: currentUser,
    onSaved: onSaved
  }), tab === "import" && window.CnCallImport && React.createElement(window.CnCallImport, {
    scenario: scenario,
    currentUser: currentUser,
    onSaved: onSaved
  }), tab === "setup" && React.createElement(CsSetup, null));
}
function CsInbox({
  scenario,
  pending,
  stubs,
  onOpenContact,
  onSaved
}) {
  var [open, setOpen] = useState({});
  var [busy, setBusy] = useState(null);
  var [, force] = useState(0);
  var link = async (act, oppId) => {
    if (!oppId) return;
    setBusy(act.id);
    try {
      await window.updateActivity(act.id, {
        opportunity_id: oppId
      });
      window.cnToast && window.cnToast({
        title: "Call linked to deal"
      });
      onSaved && onSaved();
    } catch (e) {
      window.cnToast && window.cnToast({
        title: "Couldn't link",
        sub: e.message,
        kind: "error"
      });
    }
    setBusy(null);
  };
  if (!pending.length && !stubs.length) {
    return React.createElement("section", {
      className: "cn-card"
    }, React.createElement("div", {
      className: "cn-cs-empty"
    }, React.createElement("h3", {
      className: "cn-cs-empty-title"
    }, "Nothing waiting on you"), React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 13
      }
    }, "Synced calls that aren't attached to a deal show up here, along with contacts created from an unrecognised number.")));
  }
  return React.createElement(React.Fragment, null, pending.length > 0 && React.createElement("section", {
    className: "cn-card cn-card--flush",
    style: {
      marginBottom: 16
    }
  }, React.createElement("div", {
    style: {
      padding: "13px 15px",
      borderBottom: "1px solid var(--cn-line-2)"
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Needs a deal"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      margin: "2px 0 0"
    }
  }, pending.length, " call", pending.length === 1 ? "" : "s", " landed without an opportunity"), React.createElement("p", {
    className: "cn-cs-note",
    style: {
      margin: "4px 0 0"
    }
  }, "Attach each one so it shows on the deal timeline and counts toward pipeline activity.")), pending.map(a => {
    var c = (scenario.contacts || []).find(x => x.id === a.contactId);
    var acct = c && window.accountOf && window.accountOf(c.accountId, scenario);
    var openDeals = (scenario.sharedOpps || scenario.opps || []).filter(o => o.stage !== "won" && o.stage !== "lost" && (o.contactId === a.contactId || c && o.accountId === c.accountId));
    var isOpen = !!open[a.id];
    var long = (a.summary || "").length > 260;
    return React.createElement("div", {
      className: "cn-cs-row",
      key: a.id
    }, React.createElement("div", null, React.createElement("div", {
      className: "cn-cs-who"
    }, c ? c.name : "Unknown caller", acct && React.createElement("span", {
      style: {
        fontWeight: 400,
        color: "var(--cn-mute)"
      }
    }, " \xB7 ", acct.name)), React.createElement("div", {
      className: "cn-cs-meta"
    }, a.when, a.duration ? ` · ${a.duration} min` : "", a.source === "recorder" ? " · recorder" : " · webhook"), a.summary && React.createElement(React.Fragment, null, React.createElement("div", {
      className: "cn-cs-summary" + (isOpen ? " is-open" : "")
    }, a.summary), long && React.createElement("button", {
      className: "cn-cs-more",
      onClick: () => setOpen(o => ({
        ...o,
        [a.id]: !isOpen
      }))
    }, isOpen ? "Show less" : "Show full summary"))), React.createElement("div", null, a.subject && React.createElement("div", {
      style: {
        fontSize: 12.8,
        fontWeight: 500
      }
    }, a.subject), React.createElement("span", {
      className: "cn-cs-pill " + (a.type === "meeting" ? "cn-cs-pill--out" : "cn-cs-pill--in"),
      style: {
        marginTop: 6,
        display: "inline-block"
      }
    }, a.type === "meeting" ? "Meeting" : "Call")), React.createElement("div", {
      className: "cn-cs-actions"
    }, openDeals.length > 0 ? React.createElement("select", {
      className: "cn-input",
      defaultValue: "",
      disabled: busy === a.id,
      onChange: e => link(a, e.target.value)
    }, React.createElement("option", {
      value: ""
    }, "Link to a deal\u2026"), openDeals.map(o => React.createElement("option", {
      key: o.id,
      value: o.id
    }, o.title))) : React.createElement("div", {
      className: "cn-cs-note",
      style: {
        fontSize: 11.5
      }
    }, "No open deal on this account."), React.createElement("button", {
      className: "cn-btn cn-btn--ghost",
      onClick: () => {
        csDismiss(a.id);
        force(n => n + 1);
        onSaved && onSaved();
      }
    }, "Not deal-related")));
  })), stubs.length > 0 && React.createElement("section", {
    className: "cn-card cn-card--flush"
  }, React.createElement("div", {
    style: {
      padding: "13px 15px",
      borderBottom: "1px solid var(--cn-line-2)"
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Contacts to complete"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      margin: "2px 0 0"
    }
  }, stubs.length, " contact", stubs.length === 1 ? "" : "s", " created from a number"), React.createElement("p", {
    className: "cn-cs-note",
    style: {
      margin: "4px 0 0"
    }
  }, "The sync logged a call from an unrecognised number and made a placeholder. Give it a name and an account.")), stubs.map(c => React.createElement(CsStubRow, {
    key: c.id,
    contact: c,
    scenario: scenario,
    onSaved: onSaved,
    onOpenContact: onOpenContact
  }))));
}
function CsStubRow({
  contact,
  scenario,
  onSaved,
  onOpenContact
}) {
  var [name, setName] = useState("");
  var [accountId, setAccountId] = useState("");
  var [saving, setSaving] = useState(false);
  var save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await window.updateContact(contact.id, {
        name: name.trim(),
        phone: contact.phone || contact.name,
        account_id: accountId || null
      });
      window.cnToast && window.cnToast({
        title: `Saved ${name.trim()}`
      });
      onSaved && onSaved();
    } catch (e) {
      window.cnToast && window.cnToast({
        title: "Couldn't save",
        sub: e.message,
        kind: "error"
      });
    }
    setSaving(false);
  };
  return React.createElement("div", {
    className: "cn-cs-row"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-cs-who cn-mono"
  }, contact.name), React.createElement("div", {
    className: "cn-cs-meta"
  }, "placeholder contact")), React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, React.createElement("input", {
    className: "cn-input",
    placeholder: "Their name",
    value: name,
    onChange: e => setName(e.target.value)
  }), React.createElement("select", {
    className: "cn-input",
    value: accountId,
    onChange: e => setAccountId(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "\u2014 No account \u2014"), (scenario.accounts || []).map(a => React.createElement("option", {
    key: a.id,
    value: a.id
  }, a.name)))), React.createElement("div", {
    className: "cn-cs-actions"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: save,
    disabled: saving || !name.trim()
  }, saving ? "Saving…" : "Save"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => onOpenContact && onOpenContact(contact.id)
  }, "Open contact")));
}
function CsLogFromRecorder({
  scenario,
  currentUser,
  onSaved
}) {
  var [text, setText] = useState("");
  var [f, setF] = useState(null);
  var [saving, setSaving] = useState(false);
  var set = patch => setF(prev => ({
    ...prev,
    ...patch
  }));
  var parse = () => {
    var p = csParsePaste(text, scenario);
    setF({
      contactId: p.contactId || "",
      newName: p.contactId ? "" : p.name || "",
      newPhone: p.phone || "",
      newEmail: p.email || "",
      type: /zoom|teams|meet|meeting/i.test(text) ? "meeting" : "call",
      direction: p.direction,
      when: p.when,
      duration: p.duration || "",
      subject: p.title || "",
      summary: p.summary || "",
      oppId: "",
      nextStep: p.nextStep || ""
    });
  };
  var post = async () => {
    setSaving(true);
    try {
      var contactId = f.contactId;
      if (!contactId && (f.newName || f.newPhone)) {
        var made = await window.insertContact({
          name: (f.newName || f.newPhone || "Unknown caller").trim(),
          email: f.newEmail || "",
          phone: f.newPhone || "",
          account_id: null,
          owner_id: currentUser && currentUser.id || null
        });
        contactId = made && made.id;
      }
      await window.insertActivity({
        type: f.type,
        contact_id: contactId || null,
        opportunity_id: f.oppId || null,
        owner_id: currentUser && currentUser.id || null,
        occurred_at: f.when ? new Date(f.when).toISOString() : new Date().toISOString(),
        duration_min: f.duration ? parseInt(f.duration, 10) : null,
        subject: f.subject || (f.type === "meeting" ? "Meeting" : "Call"),
        summary: f.summary || "",
        source: "recorder"
      });
      if (f.oppId && f.nextStep && window.cnSetDealMeta) {
        try {
          window.cnSetDealMeta(f.oppId, {
            nextStep: f.nextStep
          });
        } catch {}
      }
      window.cnToast && window.cnToast({
        title: "Call logged",
        sub: "Added to the timeline"
      });
      setText("");
      setF(null);
      onSaved && onSaved();
    } catch (e) {
      window.cnToast && window.cnToast({
        title: "Couldn't log the call",
        sub: e.message,
        kind: "error"
      });
    }
    setSaving(false);
  };
  var contact = f && (scenario.contacts || []).find(c => c.id === f.contactId);
  var dealOptions = f ? (scenario.sharedOpps || scenario.opps || []).filter(o => o.stage !== "won" && o.stage !== "lost" && (!contact || o.contactId === f.contactId || o.accountId === contact.accountId)) : [];
  return React.createElement(React.Fragment, null, React.createElement("section", {
    className: "cn-card",
    style: {
      marginBottom: 16
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Paste in"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      margin: "2px 0 6px"
    }
  }, "Drop the recorder's summary or transcript"), React.createElement("p", {
    className: "cn-cs-note",
    style: {
      margin: "0 0 12px"
    }
  }, "Copy whatever your recorder app produces \u2014 summary, transcript, or both \u2014 and paste it below. We pull out who was on the call, when, how long, and the AI summary, then post it to that contact's timeline as-is. You confirm everything first."), React.createElement("textarea", {
    className: "cn-cs-paste",
    value: text,
    onChange: e => setText(e.target.value),
    placeholder: "e.g.\n\nCall with Anya Reinhardt — Aug 26, 2026\nDuration: 34 minutes\n\nSummary:\nAnya confirmed budget approval for the 256-node H200 cluster…\n\nAction items:\n- Send revised quote with Q4 delivery window"
  }), React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 12
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: parse,
    disabled: !text.trim()
  }, "Read it \u2192"), text && React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => {
      setText("");
      setF(null);
    }
  }, "Clear"))), f && React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Confirm"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      margin: "2px 0 14px"
    }
  }, "What we found"), React.createElement("div", {
    className: "cn-cs-grid",
    style: {
      marginBottom: 12
    }
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Contact"), React.createElement("select", {
    className: "cn-input",
    value: f.contactId,
    onChange: e => set({
      contactId: e.target.value
    })
  }, React.createElement("option", {
    value: ""
  }, "\uFF0B Create a new contact"), (scenario.contacts || []).map(c => React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.name)))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Type"), React.createElement("select", {
    className: "cn-input",
    value: f.type,
    onChange: e => set({
      type: e.target.value
    })
  }, React.createElement("option", {
    value: "call"
  }, "Call"), React.createElement("option", {
    value: "meeting"
  }, "Meeting"))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "When"), React.createElement("input", {
    className: "cn-input",
    type: "datetime-local",
    value: f.when,
    onChange: e => set({
      when: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Duration (min)"), React.createElement("input", {
    className: "cn-input",
    value: f.duration,
    onChange: e => set({
      duration: e.target.value.replace(/\D/g, "")
    }),
    placeholder: "optional"
  }))), !f.contactId && React.createElement("div", {
    className: "cn-cs-grid",
    style: {
      marginBottom: 12
    }
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Name"), React.createElement("input", {
    className: "cn-input",
    value: f.newName,
    onChange: e => set({
      newName: e.target.value
    }),
    placeholder: "Their name"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Email"), React.createElement("input", {
    className: "cn-input",
    value: f.newEmail,
    onChange: e => set({
      newEmail: e.target.value
    }),
    placeholder: "optional"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Phone"), React.createElement("input", {
    className: "cn-input",
    value: f.newPhone,
    onChange: e => set({
      newPhone: e.target.value
    }),
    placeholder: "optional"
  }))), React.createElement("div", {
    className: "cn-field",
    style: {
      marginBottom: 12
    }
  }, React.createElement("label", null, "Subject"), React.createElement("input", {
    className: "cn-input",
    value: f.subject,
    onChange: e => set({
      subject: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      marginBottom: 12
    }
  }, React.createElement("label", null, "Summary \u2014 posted to the timeline exactly as written"), React.createElement("textarea", {
    className: "cn-cs-paste",
    style: {
      minHeight: 150,
      fontFamily: "var(--cn-sans)",
      fontSize: 13
    },
    value: f.summary,
    onChange: e => set({
      summary: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-cs-grid",
    style: {
      marginBottom: 4
    }
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Attach to a deal"), React.createElement("select", {
    className: "cn-input",
    value: f.oppId,
    onChange: e => set({
      oppId: e.target.value
    })
  }, React.createElement("option", {
    value: ""
  }, "\u2014 Decide later (shows in Inbox) \u2014"), dealOptions.map(o => React.createElement("option", {
    key: o.id,
    value: o.id
  }, o.title)))), f.oppId && React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Set the deal's next step"), React.createElement("input", {
    className: "cn-input",
    value: f.nextStep,
    onChange: e => set({
      nextStep: e.target.value
    }),
    placeholder: "pulled from action items"
  }))), React.createElement("footer", {
    className: "cn-modal-foot",
    style: {
      marginTop: 16,
      paddingLeft: 0,
      paddingRight: 0
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setF(null)
  }, "Back"), React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: post,
    disabled: saving || !f.contactId && !f.newName && !f.newPhone
  }, saving ? "Logging…" : "Log this call")))));
}
function CsSetup() {
  var [cfg, setCfg] = useState(csConfig());
  var [test, setTest] = useState(null);
  var [testing, setTesting] = useState(false);
  var save = patch => {
    var next = {
      ...cfg,
      ...patch
    };
    setCfg(next);
    csSaveConfig(next);
  };
  var url = csWebhookUrl();
  var secret = cfg.secret || "<your-CALL_SYNC_SECRET>";
  var appRef = csAppRef();
  var typedRef = csNormalizeRef(cfg.projectRef);
  var sendTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      var res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Call-Sync-Secret": cfg.secret
        },
        body: JSON.stringify({
          type: "call",
          direction: "inbound",
          occurred_at: new Date().toISOString(),
          duration_min: 34,
          subject: "Test call from webhook",
          summary: "If you can read this in the CRM, the endpoint works. Delete this activity when you're done.",
          contact: {
            name: "Webhook Test",
            phone: "+1 555 000 0000"
          }
        })
      });
      var body = null;
      try {
        body = await res.json();
      } catch {}
      if (res.ok && body && body.ok) {
        setTest({
          ok: true,
          msg: body.duplicate ? "Already received — the endpoint is live and de-duplicating." : "It worked. Refresh and look in the Inbox tab."
        });
        window.cnReloadCRM && window.cnReloadCRM();
      } else if (res.status === 401) {
        setTest({
          ok: false,
          msg: "401 — the secret in the field above doesn't match CALL_SYNC_SECRET on the function. Fix one of the two so they're identical."
        });
      } else if (res.status === 404) {
        setTest({
          ok: false,
          msg: "404 — the function isn't deployed yet, or it's named something other than call-sync."
        });
      } else if (res.status === 500) {
        setTest({
          ok: false,
          msg: "500 — " + (body && body.error || "the function ran but errored. Most likely CALL_SYNC_SECRET isn't set in Edge Functions → Secrets.")
        });
      } else {
        setTest({
          ok: false,
          msg: `HTTP ${res.status} — ${body && body.error || "unexpected response."}`
        });
      }
    } catch (e) {
      setTest({
        ok: false,
        msg: "Couldn't reach the endpoint at all. Check the project ref above, and that the function was deployed with JWT verification turned OFF."
      });
    }
    setTesting(false);
  };
  var curl = `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -H "X-Call-Sync-Secret: ${secret}" \\
  -d '{
    "type": "call",
    "direction": "inbound",
    "occurred_at": "2026-08-27T15:04:00Z",
    "duration_min": 34,
    "subject": "Intro call — H200 cluster",
    "summary": "Anya confirmed budget approval...",
    "contact": {
      "name": "Anya Reinhardt",
      "email": "anya@lumencompute.ai",
      "phone": "+1 415 555 0117"
    },
    "rep_email": "dan@…"
  }'`;
  return React.createElement(React.Fragment, null, React.createElement("section", {
    className: "cn-card",
    style: {
      marginBottom: 16
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Endpoint"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      margin: "2px 0 6px"
    }
  }, "One URL, any source"), React.createElement("p", {
    className: "cn-cs-note",
    style: {
      margin: "0 0 14px"
    }
  }, "Anything that can POST JSON can feed this CRM \u2014 Read.ai when you reactivate it, a Zapier or Make automation, a cloud phone system, or a script. The endpoint matches the contact by email, then phone, then name; if nothing matches it creates a placeholder contact from the number and drops the call in your Inbox."), React.createElement("div", {
    className: "cn-field",
    style: {
      marginBottom: 12
    }
  }, React.createElement("label", null, "Your webhook URL"), React.createElement("div", {
    className: "cn-cs-url"
  }, React.createElement("input", {
    className: "cn-input",
    readOnly: true,
    value: url,
    onFocus: e => e.target.select()
  }), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => window.cnCopy(url, "Webhook URL")
  }, "Copy"))), React.createElement("div", {
    className: "cn-cs-grid"
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Supabase project"), React.createElement("input", {
    className: "cn-input",
    readOnly: true,
    value: appRef || "not connected",
    onFocus: e => e.target.select()
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Shared secret (for the URL above)"), React.createElement("input", {
    className: "cn-input",
    value: cfg.secret,
    onChange: e => save({
      secret: e.target.value.trim()
    }),
    placeholder: "a long random string"
  }))), typedRef && typedRef !== appRef && React.createElement("div", {
    className: "cn-imp-warn",
    style: {
      marginTop: 12,
      marginBottom: 0
    }
  }, React.createElement("strong", null, "Ignoring a saved project ref that doesn't match"), React.createElement("div", {
    style: {
      marginTop: 4,
      color: "var(--cn-mute)"
    }
  }, "You'd previously entered ", React.createElement("span", {
    className: "cn-mono"
  }, typedRef), ", but this CRM is connected to ", React.createElement("span", {
    className: "cn-mono"
  }, appRef), ". Calls sent to the other project would never appear in your Inbox, so the URL above uses the connected one.", " ", React.createElement("button", {
    className: "cn-cs-more",
    onClick: () => save({
      projectRef: ""
    })
  }, "Clear it"))), React.createElement("p", {
    className: "cn-cs-note",
    style: {
      margin: "8px 0 0",
      fontSize: 11.5
    }
  }, "The project is read from this app's own connection, so it's always the right one. The secret is stored in this browser only \u2014 it's here so the snippets below come out ready to run.")), React.createElement("section", {
    className: "cn-card",
    style: {
      marginBottom: 16
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Deploy \xB7 one time"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      margin: "2px 0 10px"
    }
  }, "Turning the endpoint on"), React.createElement("div", {
    className: "cn-cs-step"
  }, React.createElement("span", {
    className: "cn-cs-step-n"
  }, "1"), React.createElement("div", {
    className: "cn-cs-step-b"
  }, "Run ", React.createElement("strong", null, "supabase/migrations/14_call_sync.sql"), " in the Supabase SQL editor. It adds a ", React.createElement("span", {
    className: "cn-mono"
  }, "source"), " and ", React.createElement("span", {
    className: "cn-mono"
  }, "raw"), " column to ", React.createElement("span", {
    className: "cn-mono"
  }, "activities"), " and a small log table.")), React.createElement("div", {
    className: "cn-cs-step"
  }, React.createElement("span", {
    className: "cn-cs-step-n"
  }, "2"), React.createElement("div", {
    className: "cn-cs-step-b"
  }, "Set the secret: ", React.createElement("span", {
    className: "cn-mono"
  }, "supabase secrets set CALL_SYNC_SECRET=\u2026"), " \u2014 use the same value you typed above.")), React.createElement("div", {
    className: "cn-cs-step"
  }, React.createElement("span", {
    className: "cn-cs-step-n"
  }, "3"), React.createElement("div", {
    className: "cn-cs-step-b"
  }, "Deploy: ", React.createElement("span", {
    className: "cn-mono"
  }, "supabase functions deploy call-sync --no-verify-jwt"), ". The ", React.createElement("span", {
    className: "cn-mono"
  }, "--no-verify-jwt"), " flag matters \u2014 external services can't carry a user token, so the shared secret is the gate.")), React.createElement("div", {
    className: "cn-cs-step"
  }, React.createElement("span", {
    className: "cn-cs-step-n"
  }, "4"), React.createElement("div", {
    className: "cn-cs-step-b"
  }, "Fire the test call below. It should appear in your Inbox within a second."))), React.createElement("section", {
    className: "cn-card",
    style: {
      marginBottom: 16
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Test it"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      margin: "2px 0 6px"
    }
  }, "Is it live?"), React.createElement("p", {
    className: "cn-cs-note",
    style: {
      margin: "0 0 14px"
    }
  }, "One click sends a real call to your endpoint and tells you exactly what came back. No terminal needed \u2014 fill in the secret above first."), React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: sendTest,
    disabled: testing || !cfg.secret
  }, testing ? "Sending…" : "Send a test call"), !cfg.secret && React.createElement("span", {
    className: "cn-cs-note"
  }, "Enter your shared secret above to enable this.")), test && React.createElement("div", {
    className: test.ok ? "cn-imp-warn" : "cn-imp-warn",
    style: {
      marginTop: 14,
      marginBottom: 0,
      borderColor: test.ok ? "color-mix(in oklab, var(--cn-pos) 40%, transparent)" : undefined,
      background: test.ok ? "color-mix(in oklab, var(--cn-pos) 7%, transparent)" : undefined
    }
  }, React.createElement("strong", null, test.ok ? "Endpoint is live" : "Not working yet"), React.createElement("div", {
    style: {
      marginTop: 4,
      color: "var(--cn-mute)"
    }
  }, test.msg)), React.createElement("details", {
    style: {
      marginTop: 16
    }
  }, React.createElement("summary", {
    className: "cn-cs-note",
    style: {
      cursor: "pointer"
    }
  }, "Or send it from a terminal"), React.createElement("pre", {
    className: "cn-cs-code",
    style: {
      marginTop: 10
    }
  }, curl), React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => window.cnCopy(curl, "Test request")
  }, "Copy request")))), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Sources"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      margin: "2px 0 10px"
    }
  }, "What can feed it"), React.createElement("div", {
    className: "cn-cs-step"
  }, React.createElement("span", {
    className: "cn-cs-step-n"
  }, "\u2713"), React.createElement("div", {
    className: "cn-cs-step-b"
  }, React.createElement("strong", null, "Read.ai"), " \u2014 paste the URL into Integrations \u2192 Webhooks on a paid plan. It covers Teams, Meet and Zoom automatically, and its payload is understood natively. This is the single best feed for your team; worth reactivating.")), React.createElement("div", {
    className: "cn-cs-step"
  }, React.createElement("span", {
    className: "cn-cs-step-n"
  }, "\u2713"), React.createElement("div", {
    className: "cn-cs-step-b"
  }, React.createElement("strong", null, "Zapier / Make"), " \u2014 if your recorder emails you a summary, a two-step Zap (new email \u2192 POST webhook) gets you automatic sync without any paid API. Cheapest real automation available to you today.")), React.createElement("div", {
    className: "cn-cs-step"
  }, React.createElement("span", {
    className: "cn-cs-step-n"
  }, "\u2713"), React.createElement("div", {
    className: "cn-cs-step-b"
  }, React.createElement("strong", null, "A cloud phone number"), " (OpenPhone, Dialpad, Aircall) \u2014 the only way cell calls sync automatically. Reps dial from its app on the same phone; every call, inbound and out, posts here.")), React.createElement("div", {
    className: "cn-cs-step"
  }, React.createElement("span", {
    className: "cn-cs-step-n"
  }, "\u2715"), React.createElement("div", {
    className: "cn-cs-step-b"
  }, React.createElement("strong", null, "Raw cell call logs"), " \u2014 not possible from any web app. Apple and Google expose no interface to a device's call history. Use the Log-from-recorder tab, or route calls through a cloud number."))));
}
Object.assign(window, {
  CallSync,
  CsInbox,
  CsSetup,
  CsLogFromRecorder,
  CsStubRow,
  csPendingCalls,
  csConfig,
  csWebhookUrl,
  csProjectRef,
  csAppRef,
  csNormalizeRef
});