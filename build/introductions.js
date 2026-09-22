var INTRO_KEY = "cn-introductions-v1";
var inToday = () => window.cnDay();
function inAddDays(n, from) {
  return window.cnDayPlus(n, from);
}
function inDaysUntil(dstr) {
  if (!dstr) return null;
  var d = new Date(dstr.length <= 10 ? dstr + "T00:00:00" : dstr);
  if (isNaN(d)) return null;
  return Math.round((d - new Date(inToday() + "T00:00:00")) / 86400000);
}
function inFmtDate(dstr) {
  if (!dstr) return "—";
  var d = new Date(dstr + (dstr.length <= 10 ? "T00:00:00" : ""));
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}
var inInitials = name => (name || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
var inMoney = v => {
  var n = parseFloat(String(v || "").replace(/[^\d.]/g, ""));
  if (isNaN(n)) return 0;
  return /m/i.test(v) ? n * 1e6 : /k/i.test(v) ? n * 1e3 : n;
};
function readIntros() {
  try {
    return JSON.parse(localStorage.getItem(INTRO_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeIntros(list) {
  try {
    localStorage.setItem(INTRO_KEY, JSON.stringify(list));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("cn-intros-changed"));
  } catch {}
}
function upsertIntro(rec) {
  var list = readIntros();
  var i = list.findIndex(x => x.id === rec.id);
  if (i >= 0) list[i] = rec;else list.unshift(rec);
  writeIntros(list);
  return rec;
}
function deleteIntro(id) {
  writeIntros(readIntros().filter(x => x.id !== id));
}
function newIntro(owner) {
  var now = new Date().toISOString();
  return {
    id: "intro-" + Math.random().toString(36).slice(2, 9),
    clientName: "",
    clientEmail: "",
    clientOrg: "",
    partnerName: "",
    partnerEmail: "",
    partnerOrg: "",
    context: "",
    value: "",
    status: "queued",
    introSentAt: null,
    connectedAt: null,
    nextFollowUpAt: null,
    notes: "",
    owner: owner || "",
    createdAt: now,
    updatedAt: now,
    source: "manual",
    threadId: null,
    sourceMessageId: null,
    lastThreadAt: null,
    threadCount: 0,
    stalledAt: null
  };
}
function introFromInbox(seed) {
  var now = new Date().toISOString();
  var base = newIntro(seed.owner || "");
  var rec = {
    ...base,
    ...seed,
    status: seed.status || "queued",
    nextFollowUpAt: seed.status === "introduced" ? inAddDays(4) : null,
    createdAt: now,
    updatedAt: now
  };
  upsertIntro(rec);
  return rec;
}
var IN_STATUSES = [{
  id: "queued",
  label: "To introduce",
  tone: "warn"
}, {
  id: "introduced",
  label: "Introduced",
  tone: "info"
}, {
  id: "connected",
  label: "Connected",
  tone: "good"
}, {
  id: "won",
  label: "Won",
  tone: "good"
}, {
  id: "stalled",
  label: "Stalled",
  tone: "warn"
}, {
  id: "dead",
  label: "Closed",
  tone: "mute"
}];
var inStatusMeta = id => IN_STATUSES.find(s => s.id === id) || IN_STATUSES[0];
window.cnIntrosOpenCount = () => readIntros().filter(x => {
  if (x.status === "queued" || x.status === "stalled") return true;
  if (x.status === "introduced" || x.status === "connected") {
    var d = inDaysUntil(x.nextFollowUpAt);
    return d !== null && d <= 0;
  }
  return false;
}).length;
window.cnIntros = {
  read: readIntros,
  upsert: upsertIntro,
  remove: deleteIntro,
  addDays: inAddDays,
  createFromInbox: introFromInbox,
  todayItems(onGoto) {
    var out = [];
    readIntros().forEach(x => {
      if (x.status === "won" || x.status === "dead") return;
      var pair = `${x.clientName || "Client"} ‹›  ${x.partnerName || "Partner"}`;
      if (x.status === "queued") {
        out.push({
          key: "intro-" + x.id,
          kind: "intro",
          gold: inMoney(x.value) >= 1e6,
          priority: 900 + inMoney(x.value) / 1e5,
          title: pair,
          sub: (x.context || "Send the introduction").slice(0, 90),
          tag: "send intro",
          onOpen: () => onGoto && onGoto(),
          action: {
            label: "Send intro",
            fn: () => onGoto && onGoto()
          }
        });
        return;
      }
      var du = inDaysUntil(x.nextFollowUpAt);
      if (x.status === "stalled" || du !== null && du <= 0) {
        var over = du !== null && du < 0;
        out.push({
          key: "intro-" + x.id,
          kind: "intro",
          gold: inMoney(x.value) >= 1e6,
          priority: 400 + (over ? Math.abs(du) * 5 : 100) + inMoney(x.value) / 1e5,
          title: pair,
          sub: inStatusMeta(x.status).label + (x.introSentAt ? " · introduced " + inFmtDate(x.introSentAt.slice(0, 10)) : ""),
          tag: x.status === "stalled" ? "stalled" : over ? Math.abs(du) + "d overdue" : "check in",
          onOpen: () => onGoto && onGoto(),
          action: {
            label: "Check in",
            fn: () => onGoto && onGoto()
          }
        });
      }
    });
    return out;
  }
};
async function aiIntroDraft(intro) {
  if (!(window.claude && window.claude.complete)) throw new Error("AI drafting runs in the hosted CRM.");
  var voice = window.cnVoiceProfile && window.cnVoiceProfile() || "";
  var prompt = `You are drafting a warm double opt-in introduction email in MY personal voice. I am connecting two people so they can work together. Study these samples of my past emails and mirror the tone, warmth, brevity and sign-off:\n\n<my_past_emails>\n${voice}\n</my_past_emails>\n\nWrite ONLY the email body (no "Subject:" line), 60–110 words, plain text with natural line breaks. I am introducing ${intro.clientName || "my client"}${intro.clientOrg ? ` (${intro.clientOrg})` : ""} to ${intro.partnerName || "my partner"}${intro.partnerOrg ? ` (${intro.partnerOrg})` : ""}. Reason for the intro: ${intro.context || "they should connect — strong mutual fit."} Warmly frame why each is valuable to the other, then hand off ("I'll let the two of you take it from here"). Sign off as me.`;
  var out = await window.claude.complete(prompt);
  return (out || "").trim();
}
function InBadge({
  status
}) {
  var m = inStatusMeta(status);
  return React.createElement("span", {
    className: `cn-in-badge cn-in-badge--${m.tone}`
  }, m.label);
}
function InAvatars({
  intro
}) {
  return React.createElement("div", {
    className: "cn-in-avatars"
  }, React.createElement("span", {
    className: "cn-in-av cn-in-av--client",
    title: intro.clientName
  }, inInitials(intro.clientName)), React.createElement("span", {
    className: "cn-in-link"
  }, "\u2039\u203A"), React.createElement("span", {
    className: "cn-in-av cn-in-av--partner",
    title: intro.partnerName
  }, inInitials(intro.partnerName)));
}
function IntroModal({
  intro,
  scenario,
  currentUser,
  onClose,
  onSaved
}) {
  var editing = !!intro;
  var [f, setF] = useState(() => intro ? {
    ...intro
  } : newIntro(currentUser?.name));
  var set = patch => setF(prev => ({
    ...prev,
    ...patch
  }));
  var contacts = scenario && scenario.contacts || [];
  var accounts = scenario && scenario.accounts || [];
  var pickContact = (name, side) => {
    var c = contacts.find(x => x.name === name);
    if (!c) return;
    var org = (accounts.find(a => a.id === (c.accountId || c.account_id)) || {}).name || c.company || "";
    if (side === "client") set({
      clientName: c.name,
      clientEmail: c.email || "",
      clientOrg: org
    });else set({
      partnerName: c.name,
      partnerEmail: c.email || "",
      partnerOrg: org
    });
  };
  var save = () => {
    if (!f.clientName.trim() || !f.partnerName.trim()) {
      window.cnToast && window.cnToast({
        kind: "error",
        title: "Add both a client and a partner"
      });
      return;
    }
    var rec = {
      ...f,
      updatedAt: new Date().toISOString()
    };
    upsertIntro(rec);
    onSaved && onSaved(rec);
    onClose && onClose();
    window.cnToast && window.cnToast({
      title: editing ? "Introduction updated" : "Introduction added",
      sub: `${rec.clientName} ‹› ${rec.partnerName}`
    });
  };
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose
  }, React.createElement("div", {
    className: "cn-modal cn-in-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "cn-modal-head"
  }, React.createElement("h3", null, editing ? "Edit introduction" : "New introduction"), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body cn-in-form"
  }, React.createElement("datalist", {
    id: "cn-in-contacts"
  }, contacts.map(c => React.createElement("option", {
    key: c.id,
    value: c.name
  }))), React.createElement("div", {
    className: "cn-in-pair"
  }, React.createElement("div", {
    className: "cn-in-col"
  }, React.createElement("div", {
    className: "cn-in-col-h cn-in-col-h--client"
  }, "Client"), React.createElement("label", null, "Name"), React.createElement("input", {
    className: "cn-input",
    list: "cn-in-contacts",
    value: f.clientName,
    onChange: e => {
      set({
        clientName: e.target.value
      });
      pickContact(e.target.value, "client");
    },
    placeholder: "Who you're connecting"
  }), React.createElement("label", null, "Email"), React.createElement("input", {
    className: "cn-input",
    value: f.clientEmail,
    onChange: e => set({
      clientEmail: e.target.value
    }),
    placeholder: "name@company.com"
  }), React.createElement("label", null, "Company"), React.createElement("input", {
    className: "cn-input",
    value: f.clientOrg,
    onChange: e => set({
      clientOrg: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-in-col"
  }, React.createElement("div", {
    className: "cn-in-col-h cn-in-col-h--partner"
  }, "Partner"), React.createElement("label", null, "Name"), React.createElement("input", {
    className: "cn-input",
    list: "cn-in-contacts",
    value: f.partnerName,
    onChange: e => {
      set({
        partnerName: e.target.value
      });
      pickContact(e.target.value, "partner");
    },
    placeholder: "Who they should meet"
  }), React.createElement("label", null, "Email"), React.createElement("input", {
    className: "cn-input",
    value: f.partnerEmail,
    onChange: e => set({
      partnerEmail: e.target.value
    }),
    placeholder: "name@partner.com"
  }), React.createElement("label", null, "Company"), React.createElement("input", {
    className: "cn-input",
    value: f.partnerOrg,
    onChange: e => set({
      partnerOrg: e.target.value
    })
  }))), React.createElement("label", null, "Why connect them?"), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 70
    },
    value: f.context,
    onChange: e => set({
      context: e.target.value
    }),
    placeholder: "What the client needs and why this partner fits \u2014 this primes the AI draft."
  }), React.createElement("div", {
    className: "cn-in-row2"
  }, React.createElement("div", null, React.createElement("label", null, "Potential value"), React.createElement("input", {
    className: "cn-input",
    value: f.value,
    onChange: e => set({
      value: e.target.value
    }),
    placeholder: "$500k"
  })), React.createElement("div", null, React.createElement("label", null, "Status"), React.createElement("select", {
    className: "cn-input",
    value: f.status,
    onChange: e => set({
      status: e.target.value
    })
  }, IN_STATUSES.map(s => React.createElement("option", {
    key: s.id,
    value: s.id
  }, s.label))))), React.createElement("label", null, "Notes"), React.createElement("textarea", {
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
      if (confirm("Delete this introduction?")) {
        deleteIntro(intro.id);
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
  }, editing ? "Save" : "Add introduction"))));
}
function IntroComposer({
  intro,
  onClose,
  onSent
}) {
  var subject = `Intro: ${intro.clientName} ‹› ${intro.partnerName}`;
  var [body, setBody] = useState("");
  var [busy, setBusy] = useState(false);
  var to = [intro.clientEmail, intro.partnerEmail].filter(Boolean).join(", ");
  var draft = async () => {
    setBusy(true);
    try {
      setBody(await aiIntroDraft(intro));
    } catch (e) {
      window.cnToast && window.cnToast({
        kind: "error",
        title: "Couldn't draft",
        sub: e.message || String(e)
      });
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (window.claude && window.claude.complete) draft();
  }, []);
  var copyAll = () => {
    try {
      navigator.clipboard.writeText(`To: ${to}\nSubject: ${subject}\n\n${body}`);
      window.cnToast && window.cnToast({
        title: "Copied — paste into Outlook"
      });
    } catch {}
  };
  var markSent = () => {
    var now = new Date().toISOString();
    upsertIntro({
      ...intro,
      status: "introduced",
      introSentAt: now,
      nextFollowUpAt: inAddDays(4),
      updatedAt: now
    });
    window.cnToast && window.cnToast({
      title: "Marked as introduced",
      sub: "Follow-up set for 4 days out"
    });
    onSent && onSent();
    onClose && onClose();
  };
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose
  }, React.createElement("div", {
    className: "cn-modal cn-in-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "cn-modal-head"
  }, React.createElement("h3", null, "Introduce ", intro.clientName, " \u2039\u203A ", intro.partnerName), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body cn-in-form"
  }, React.createElement("label", null, "To"), React.createElement("input", {
    className: "cn-input",
    value: to,
    readOnly: true
  }), React.createElement("label", null, "Subject"), React.createElement("input", {
    className: "cn-input",
    value: subject,
    readOnly: true
  }), React.createElement("div", {
    className: "cn-ref-msg-head"
  }, React.createElement("label", null, "Message ", React.createElement("span", {
    className: "cn-field-help"
  }, "\xB7 in your voice \u2014 edit freely")), React.createElement("button", {
    type: "button",
    className: "cn-ref-ai",
    disabled: busy,
    onClick: draft
  }, busy ? "Drafting…" : "↻ Redraft")), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 170
    },
    value: body,
    onChange: e => setBody(e.target.value),
    placeholder: window.claude ? "Drafting…" : "Write your intro, or open the hosted CRM for AI drafting."
  }), React.createElement("div", {
    className: "cn-in-note"
  }, "Nothing sends automatically. Copy this into Outlook, send it, then mark it introduced.")), React.createElement("div", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: copyAll
  }, "Copy email"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: markSent
  }, "Mark as introduced"))));
}
function IntroRow({
  intro,
  onEdit,
  onCompose,
  onQuick
}) {
  var du = inDaysUntil(intro.nextFollowUpAt);
  var over = du !== null && du < 0;
  var gold = inMoney(intro.value) >= 1e6;
  return React.createElement("div", {
    className: `cn-in-row ${gold ? "is-gold" : ""}`
  }, React.createElement(InAvatars, {
    intro: intro
  }), React.createElement("div", {
    className: "cn-in-main",
    onClick: () => onEdit(intro)
  }, React.createElement("div", {
    className: "cn-in-top"
  }, React.createElement("span", {
    className: "cn-in-names"
  }, intro.clientName, " ", React.createElement("span", {
    className: "cn-in-arrow"
  }, "\u2039\u203A"), " ", intro.partnerName), React.createElement(InBadge, {
    status: intro.status
  }), gold && React.createElement("span", {
    className: "cn-ref-star",
    title: "High value"
  }, "\u2605")), React.createElement("div", {
    className: "cn-in-sub"
  }, [intro.clientOrg, intro.partnerOrg].filter(Boolean).join(" · ") || (intro.context || "").slice(0, 80) || "—", intro.threadId ? React.createElement("span", {
    className: "cn-in-thread",
    title: `Outlook thread · ${intro.threadCount || 1} message${(intro.threadCount || 1) === 1 ? "" : "s"}${intro.lastThreadAt ? " · last " + inFmtDate(intro.lastThreadAt.slice(0, 10)) : ""}`
  }, " \xB7 \u2709 thread live") : null, intro.value ? React.createElement("span", {
    className: "cn-in-val"
  }, " \xB7 ", intro.value) : null, intro.status !== "won" && intro.status !== "dead" && intro.nextFollowUpAt ? React.createElement("span", {
    className: `cn-in-due ${over ? "is-over" : ""}`
  }, " \xB7 ", over ? Math.abs(du) + "d overdue" : du === 0 ? "check in today" : "follow up " + inFmtDate(intro.nextFollowUpAt)) : null)), React.createElement("div", {
    className: "cn-in-acts"
  }, intro.status === "queued" && React.createElement("button", {
    className: "cn-btn cn-btn--primary cn-btn--sm",
    onClick: () => onCompose(intro)
  }, "Send intro"), intro.status === "introduced" && React.createElement("button", {
    className: "cn-btn cn-btn--primary cn-btn--sm",
    onClick: () => onQuick(intro, "connected")
  }, "Mark connected"), intro.status === "connected" && React.createElement("button", {
    className: "cn-btn cn-btn--primary cn-btn--sm",
    onClick: () => onQuick(intro, "won")
  }, "Mark won"), intro.status === "stalled" && React.createElement("button", {
    className: "cn-btn cn-btn--primary cn-btn--sm",
    onClick: () => onCompose(intro)
  }, "Nudge"), intro.status !== "won" && intro.status !== "dead" && React.createElement("button", {
    className: "cn-in-mini",
    onClick: () => onQuick(intro, "logtouch")
  }, "Log touch")));
}
var IN_ACK_KEY = "cn-intro-digest-ack-v1";
function IntroDigest({
  intros,
  inboxCount,
  onGoto
}) {
  var [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(IN_ACK_KEY) === inToday();
    } catch {
      return false;
    }
  });
  var b = useMemo(() => {
    var send = [],
      due = [],
      stalled = [];
    intros.forEach(x => {
      if (x.status === "won" || x.status === "dead") return;
      if (x.status === "queued") {
        send.push(x);
        return;
      }
      if (x.status === "stalled") {
        stalled.push(x);
        return;
      }
      var d = inDaysUntil(x.nextFollowUpAt);
      if (d !== null && d <= 0) due.push(x);
    });
    return {
      send,
      due,
      stalled
    };
  }, [intros]);
  var total = b.send.length + b.due.length + b.stalled.length + inboxCount;
  if (dismissed || total === 0) return null;
  var dismiss = () => {
    try {
      localStorage.setItem(IN_ACK_KEY, inToday());
    } catch {}
    setDismissed(true);
  };
  var hour = new Date().getHours();
  var greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "This evening";
  var chip = (n, label, go) => n > 0 ? React.createElement("button", {
    className: "cn-ref-mt-chip",
    onClick: () => onGoto(go)
  }, React.createElement("strong", null, n), " ", label) : null;
  return React.createElement("div", {
    className: "cn-ref-mt"
  }, React.createElement("div", {
    className: "cn-ref-mt-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-ref-mt-eyebrow"
  }, "Introductions \xB7 ", inFmtDate(inToday())), React.createElement("div", {
    className: "cn-ref-mt-title"
  }, greeting, " \u2014 ", total, " to look at")), React.createElement("button", {
    className: "cn-ref-mt-x",
    onClick: dismiss,
    "aria-label": "Dismiss for today"
  }, "\u2715")), React.createElement("div", {
    className: "cn-ref-mt-chips"
  }, chip(inboxCount, "waiting in inbox", "inbox"), chip(b.send.length, "to introduce", "pipeline"), chip(b.due.length, "follow-ups due", "followups"), chip(b.stalled.length, "gone quiet", "followups")));
}
var inPairKey = x => {
  var a = (x.clientEmail || x.clientName || "").trim().toLowerCase();
  var b = (x.partnerEmail || x.partnerName || "").trim().toLowerCase();
  return a && b ? [a, b].sort().join("|") : null;
};
function inDupeGroups(intros) {
  var map = {};
  intros.filter(x => x.status !== "dead" && x.status !== "won").forEach(x => {
    var k = inPairKey(x);
    if (!k) return;
    (map[k] = map[k] || []).push(x);
  });
  return Object.values(map).filter(g => g.length > 1);
}
function inMergeGroup(group) {
  var sorted = [...group].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  var rank = {
    won: 5,
    connected: 4,
    introduced: 3,
    stalled: 2,
    queued: 1,
    dead: 0
  };
  var primary = {
    ...sorted[0]
  };
  group.forEach(x => {
    ["clientEmail", "clientOrg", "partnerEmail", "partnerOrg", "value", "context", "threadId", "sourceMessageId", "introSentAt", "connectedAt"].forEach(k => {
      primary[k] = primary[k] || x[k];
    });
    if ((rank[x.status] || 0) > (rank[primary.status] || 0)) primary.status = x.status;
    if (x.lastThreadAt && (!primary.lastThreadAt || x.lastThreadAt > primary.lastThreadAt)) primary.lastThreadAt = x.lastThreadAt;
    primary.threadCount = Math.max(primary.threadCount || 0, x.threadCount || 0);
  });
  primary.notes = [...new Set(group.map(x => (x.notes || "").trim()).filter(Boolean))].join("\n\n— — —\n\n");
  primary.updatedAt = new Date().toISOString();
  var drop = group.filter(x => x.id !== primary.id).map(x => x.id);
  writeIntros(readIntros().filter(x => !drop.includes(x.id)).map(x => x.id === primary.id ? primary : x));
  return primary;
}
function IntroDupes({
  intros
}) {
  var [hidden, setHidden] = useState(false);
  var groups = useMemo(() => inDupeGroups(intros), [intros]);
  if (hidden || groups.length === 0) return null;
  return React.createElement("div", {
    className: "cn-ref-dupe"
  }, React.createElement("div", {
    className: "cn-ref-dupe-head"
  }, React.createElement("span", {
    className: "cn-ref-dupe-ico"
  }, "\u29C9"), React.createElement("div", {
    className: "cn-ref-dupe-lead"
  }, React.createElement("strong", null, groups.length, " possible duplicate", groups.length === 1 ? "" : "s"), React.createElement("span", null, "The same two people are logged more than once \u2014 merge to keep one record and one thread.")), React.createElement("button", {
    className: "cn-btn cn-btn--ghost cn-btn--sm",
    onClick: () => {
      groups.forEach(inMergeGroup);
      window.cnToast && window.cnToast({
        title: "Duplicates merged"
      });
    }
  }, "Merge all"), React.createElement("button", {
    className: "cn-ref-mt-x",
    style: {
      color: "var(--cn-mute)"
    },
    onClick: () => setHidden(true),
    "aria-label": "Dismiss"
  }, "\u2715")), React.createElement("div", {
    className: "cn-ref-dupe-groups"
  }, groups.slice(0, 4).map((g, i) => React.createElement("div", {
    key: i,
    className: "cn-ref-dupe-group"
  }, React.createElement("div", {
    className: "cn-ref-dupe-info"
  }, React.createElement("span", {
    className: "cn-ref-dupe-name"
  }, g[0].clientName, " \u2039\u203A ", g[0].partnerName), React.createElement("span", {
    className: "cn-ref-dupe-what"
  }, g.length, " copies")), React.createElement("button", {
    className: "cn-btn cn-btn--primary cn-btn--sm",
    onClick: () => {
      inMergeGroup(g);
      window.cnToast && window.cnToast({
        title: "Merged"
      });
    }
  }, "Merge ", g.length)))));
}
function VoiceModal({
  onClose
}) {
  var [txt, setTxt] = useState(() => window.cnVoiceProfile && window.cnVoiceProfile() || "");
  var save = () => {
    window.cnWriteVoiceProfile && window.cnWriteVoiceProfile(txt);
    window.cnToast && window.cnToast({
      title: "Voice profile saved"
    });
    onClose();
  };
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose
  }, React.createElement("div", {
    className: "cn-modal cn-in-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "cn-modal-head"
  }, React.createElement("h3", null, "Your reply voice"), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body cn-in-form"
  }, React.createElement("label", null, "Paste a few of your own past intro emails \u2014 every AI draft mirrors this tone."), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 220
    },
    value: txt,
    onChange: e => setTxt(e.target.value)
  })), React.createElement("div", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: save
  }, "Save"))));
}
function inNeedsTouch(x) {
  if (x.status === "won" || x.status === "dead") return false;
  if (x.status === "stalled") return true;
  var d = inDaysUntil(x.nextFollowUpAt);
  return d !== null && d <= 0;
}
function FollowUps({
  intros,
  onCompose,
  onEdit
}) {
  var list = useMemo(() => intros.filter(inNeedsTouch).sort((a, b) => inMoney(b.value) - inMoney(a.value) || (a.nextFollowUpAt || "").localeCompare(b.nextFollowUpAt || "")), [intros]);
  var logTouch = x => {
    var now = new Date().toISOString();
    upsertIntro({
      ...x,
      status: x.status === "stalled" ? "connected" : x.status,
      nextFollowUpAt: inAddDays(5),
      lastTouchAt: now,
      updatedAt: now
    });
    window.cnToast && window.cnToast({
      title: "Touch logged",
      sub: "Next check-in in 5 days"
    });
  };
  var snooze = x => {
    upsertIntro({
      ...x,
      nextFollowUpAt: inAddDays(3),
      updatedAt: new Date().toISOString()
    });
    window.cnToast && window.cnToast({
      title: "Snoozed 3 days"
    });
  };
  if (list.length === 0) return React.createElement("div", {
    className: "cn-empty cn-ref-empty"
  }, React.createElement("div", {
    className: "cn-empty-ico"
  }, "\u2713"), React.createElement("div", {
    className: "cn-empty-title"
  }, "Nothing to chase"), React.createElement("div", {
    className: "cn-empty-sub"
  }, "Every live introduction is inside its follow-up window. Threads that go quiet past their date show up here on their own."));
  return React.createElement("div", {
    className: "cn-in-list"
  }, list.map(x => {
    var du = inDaysUntil(x.nextFollowUpAt);
    var over = du !== null && du < 0;
    return React.createElement("div", {
      key: x.id,
      className: "cn-in-row"
    }, React.createElement(InAvatars, {
      intro: x
    }), React.createElement("div", {
      className: "cn-in-main",
      onClick: () => onEdit(x)
    }, React.createElement("div", {
      className: "cn-in-top"
    }, React.createElement("span", {
      className: "cn-in-names"
    }, x.clientName, " ", React.createElement("span", {
      className: "cn-in-arrow"
    }, "\u2039\u203A"), " ", x.partnerName), React.createElement(InBadge, {
      status: x.status
    })), React.createElement("div", {
      className: "cn-in-sub"
    }, x.status === "stalled" ? React.createElement(React.Fragment, null, "Quiet since ", x.lastThreadAt ? inFmtDate(x.lastThreadAt.slice(0, 10)) : "the intro went out") : over ? React.createElement(React.Fragment, null, Math.abs(du), "d overdue") : React.createElement(React.Fragment, null, "Check in today"), x.value ? React.createElement("span", {
      className: "cn-in-val"
    }, " \xB7 ", x.value) : null, x.threadId ? React.createElement("span", {
      className: "cn-in-thread"
    }, " \xB7 \u2709 thread live") : null)), React.createElement("div", {
      className: "cn-in-acts"
    }, React.createElement("button", {
      className: "cn-btn cn-btn--primary cn-btn--sm",
      onClick: () => onCompose(x)
    }, "Nudge"), React.createElement("button", {
      className: "cn-btn cn-btn--ghost cn-btn--sm",
      onClick: () => logTouch(x)
    }, "Log touch"), React.createElement("button", {
      className: "cn-btn cn-btn--ghost cn-btn--sm",
      onClick: () => snooze(x)
    }, "Snooze 3d")));
  }));
}
function IntroductionsScreen({
  scenario,
  currentUser,
  initialTab
}) {
  var mapTab = t => t === "inbox" || t === "approvals" ? "inbox" : t === "followups" ? "followups" : t === "pipeline" ? "pipeline" : "triage";
  var [tab, setTab] = useState(() => mapTab(initialTab));
  useEffect(() => {
    if (initialTab) setTab(mapTab(initialTab));
  }, [initialTab]);
  var [intros, setIntros] = useState(() => readIntros());
  // The record the triage drawer shows. Held by id so it re-reads after each
  // save rather than rendering a stale copy.
  var [triageId, setTriageId] = useState(null);
  var [inboxCount, setInboxCount] = useState(() => window.IntroInbox ? window.IntroInbox.pendingCount() : 0);
  var [modal, setModal] = useState(null);
  var [compose, setCompose] = useState(null);
  var [voice, setVoice] = useState(false);
  var [showDone, setShowDone] = useState(false);
  useEffect(() => {
    var h = () => setIntros(readIntros());
    var g = () => setInboxCount(window.IntroInbox ? window.IntroInbox.pendingCount() : 0);
    window.addEventListener("cn-intros-changed", h);
    window.addEventListener("cn-intro-inbox-changed", g);
    g();
    return () => {
      window.removeEventListener("cn-intros-changed", h);
      window.removeEventListener("cn-intro-inbox-changed", g);
    };
  }, []);
  // intro-triage.js writes back through this, so exactly one place knows how
  // an introduction is persisted.
  useEffect(() => {
    if (window.cnIntroTriage) window.cnIntroTriage.saveIntro = rec => upsertIntro(rec);
    return () => { if (window.cnIntroTriage) window.cnIntroTriage.saveIntro = null; };
  }, []);
  var quick = (intro, action) => {
    var now = new Date().toISOString();
    if (action === "connected") {
      upsertIntro({
        ...intro,
        status: "connected",
        connectedAt: now,
        nextFollowUpAt: inAddDays(7),
        updatedAt: now
      });
      window.cnToast && window.cnToast({
        title: "Connected",
        sub: intro.clientName + " ‹› " + intro.partnerName
      });
      return;
    }
    if (action === "won") {
      upsertIntro({
        ...intro,
        status: "won",
        nextFollowUpAt: null,
        updatedAt: now
      });
      window.cnToast && window.cnToast({
        title: "Won",
        sub: intro.value || ""
      });
      return;
    }
  };
  var groups = useMemo(() => {
    var needsAction = [],
      inFlight = [],
      done = [];
    intros.forEach(x => {
      if (x.status === "won" || x.status === "dead") {
        done.push(x);
        return;
      }
      if (x.status === "queued" || inNeedsTouch(x)) needsAction.push(x);else inFlight.push(x);
    });
    var rank = {
      queued: 3,
      stalled: 2
    };
    needsAction.sort((a, b) => inMoney(b.value) - inMoney(a.value) || (rank[b.status] || 0) - (rank[a.status] || 0));
    return {
      needsAction,
      inFlight,
      done
    };
  }, [intros]);
  var fuCount = groups.needsAction.filter(inNeedsTouch).length;
  var stats = [["In inbox", inboxCount], ["To introduce", intros.filter(x => x.status === "queued").length], ["Awaiting reply", intros.filter(x => x.status === "introduced").length], ["Connected", intros.filter(x => x.status === "connected").length], ["Won this month", intros.filter(x => x.status === "won" && x.updatedAt && x.updatedAt.slice(0, 7) === inToday().slice(0, 7)).length]];
  return React.createElement("div", {
    className: "cn-page cn-intros"
  }, React.createElement(IntroDigest, {
    intros: intros,
    inboxCount: inboxCount,
    onGoto: t => setTab(t)
  }), React.createElement("div", {
    className: "cn-in-head"
  }, React.createElement("div", {
    className: "cn-in-lead"
  }, "Every client \u2039\u203A partner introduction, from the email it started in to the deal it becomes."), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setVoice(true)
  }, "Reply voice"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setModal("new")
  }, "+ New introduction")), React.createElement("div", {
    className: "cn-ref-stats"
  }, stats.map(([label, n]) => React.createElement("div", {
    key: label,
    className: "cn-ref-stat"
  }, React.createElement("div", {
    className: "cn-ref-stat-label"
  }, label), React.createElement("div", {
    className: "cn-ref-stat-num"
  }, n)))), React.createElement("div", {
    className: "cn-ref-tabs"
  }, React.createElement("button", {
    className: "cn-ref-tab " + (tab === "triage" ? "is-active" : ""),
    onClick: () => setTab("triage")
  }, "Triage"), React.createElement("button", {
    className: "cn-ref-tab " + (tab === "pipeline" ? "is-active" : ""),
    onClick: () => setTab("pipeline")
  }, "List"), React.createElement("button", {
    className: "cn-ref-tab " + (tab === "inbox" ? "is-active" : ""),
    onClick: () => setTab("inbox")
  }, "Inbox ", inboxCount > 0 && React.createElement("span", {
    className: "cn-ref-tab-badge"
  }, inboxCount)), React.createElement("button", {
    className: "cn-ref-tab " + (tab === "followups" ? "is-active" : ""),
    onClick: () => setTab("followups")
  }, "Follow-ups ", fuCount > 0 && React.createElement("span", {
    className: "cn-ref-tab-badge"
  }, fuCount))), tab === "inbox" && (window.IntroInboxPanel ? React.createElement(window.IntroInboxPanel, {
    currentUser: currentUser
  }) : React.createElement("div", {
    className: "cn-in-clear"
  }, "Intro inbox module didn't load.")), tab === "followups" && React.createElement(FollowUps, {
    intros: intros,
    onCompose: setCompose,
    onEdit: setModal
  }), tab === "triage" && (window.IntroTriageBoard ? (intros.length === 0 ? React.createElement("div", {
    className: "cn-empty cn-ref-empty"
  }, React.createElement("div", { className: "cn-empty-ico" }, "\u2039\u203A"),
    React.createElement("div", { className: "cn-empty-title" }, "Nothing to triage yet"),
    React.createElement("div", { className: "cn-empty-sub" }, "Confirm an email in the Inbox tab, or log an introduction by hand \u2014 then everything after that happens here."),
    React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 14 } },
      React.createElement("button", { className: "cn-btn cn-btn--primary", onClick: () => setTab("inbox") }, "Open inbox"),
      React.createElement("button", { className: "cn-btn cn-btn--ghost", onClick: () => setModal("new") }, "+ New introduction"))
  ) : React.createElement(window.IntroTriageBoard, {
    intros: intros,
    onOpen: x => setTriageId(x.id)
  })) : React.createElement("div", {
    className: "cn-in-clear"
  }, "Triage module didn't load.")), triageId && window.IntroTriageDrawer && (() => {
    var rec = intros.find(x => x.id === triageId);
    if (!rec) return null;
    return React.createElement(window.IntroTriageDrawer, {
      intro: rec,
      onClose: () => setTriageId(null),
      onSave: next => upsertIntro(next)
    });
  })(), tab === "pipeline" && React.createElement(React.Fragment, null, React.createElement(IntroDupes, {
    intros: intros
  }), intros.length === 0 ? React.createElement("div", {
    className: "cn-empty cn-ref-empty"
  }, React.createElement("div", {
    className: "cn-empty-ico"
  }, "\u2039\u203A"), React.createElement("div", {
    className: "cn-empty-title"
  }, "No introductions yet"), React.createElement("div", {
    className: "cn-empty-sub"
  }, "Connect Outlook in the Inbox tab and intro emails will stage themselves for confirmation \u2014 or log the first one by hand."), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 14
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setTab("inbox")
  }, "Open inbox"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setModal("new")
  }, "+ New introduction"))) : React.createElement(React.Fragment, null, React.createElement("section", {
    className: "cn-in-sec"
  }, React.createElement("div", {
    className: "cn-in-sec-h"
  }, React.createElement("span", {
    className: "cn-in-sec-dot cn-in-sec-dot--act"
  }), " Needs your action ", React.createElement("span", {
    className: "cn-in-sec-n"
  }, groups.needsAction.length)), groups.needsAction.length === 0 ? React.createElement("div", {
    className: "cn-in-clear"
  }, "Nothing needs you right now \u2014 every intro is in motion.") : React.createElement("div", {
    className: "cn-in-list"
  }, groups.needsAction.map(x => React.createElement(IntroRow, {
    key: x.id,
    intro: x,
    onEdit: setModal,
    onCompose: setCompose,
    onQuick: quick
  })))), groups.inFlight.length > 0 && React.createElement("section", {
    className: "cn-in-sec"
  }, React.createElement("div", {
    className: "cn-in-sec-h"
  }, React.createElement("span", {
    className: "cn-in-sec-dot cn-in-sec-dot--flight"
  }), " In flight ", React.createElement("span", {
    className: "cn-in-sec-n"
  }, groups.inFlight.length)), React.createElement("div", {
    className: "cn-in-list"
  }, groups.inFlight.map(x => React.createElement(IntroRow, {
    key: x.id,
    intro: x,
    onEdit: setModal,
    onCompose: setCompose,
    onQuick: quick
  })))), groups.done.length > 0 && React.createElement("section", {
    className: "cn-in-sec"
  }, React.createElement("button", {
    className: "cn-in-sec-h cn-in-sec-h--toggle",
    onClick: () => setShowDone(v => !v)
  }, React.createElement("span", {
    className: "cn-in-sec-dot cn-in-sec-dot--done"
  }), " Done ", React.createElement("span", {
    className: "cn-in-sec-n"
  }, groups.done.length), React.createElement("span", {
    className: "cn-in-caret"
  }, showDone ? "▾" : "▸")), showDone && React.createElement("div", {
    className: "cn-in-list cn-in-list--done"
  }, groups.done.map(x => React.createElement(IntroRow, {
    key: x.id,
    intro: x,
    onEdit: setModal,
    onCompose: setCompose,
    onQuick: quick
  })))))), modal && React.createElement(IntroModal, {
    intro: modal === "new" ? null : modal,
    scenario: scenario,
    currentUser: currentUser,
    onClose: () => setModal(null),
    onSaved: () => setIntros(readIntros())
  }), compose && React.createElement(IntroComposer, {
    intro: compose,
    onClose: () => setCompose(null),
    onSent: () => setIntros(readIntros())
  }), voice && React.createElement(VoiceModal, {
    onClose: () => setVoice(false)
  }));
}
window.IntroductionsScreen = IntroductionsScreen;
(function inCss() {
  if (document.getElementById("cn-in-thread-css")) return;
  var s = document.createElement("style");
  s.id = "cn-in-thread-css";
  s.textContent = ".cn-in-thread{color:var(--cn-mute);font-size:11.5px}" + ".cn-in-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cn-in-head .cn-in-lead{flex:1;min-width:220px}" + ".cn-ref-mt-head{align-items:flex-start}.cn-ref-mt-title{height:auto;line-height:1.2;white-space:normal;text-wrap:pretty}" + ".cn-intros .cn-ref-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}";
  document.head.appendChild(s);
})();