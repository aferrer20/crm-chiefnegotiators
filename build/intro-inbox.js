var IIN_KEY = "cn-intro-inbox-v1";
var IIN_MIDS = "cn-intro-inbox-mids-v1";
var IIN_CFG = "cn-intro-outlook-cfg-v1";
var IIN_WIPE = "cn-intro-inbox-reset-v2";
(function iinWipeLegacy() {
  try {
    if (localStorage.getItem(IIN_WIPE)) return;
    ["cn-referrals-v1", "cn-ref-seeded-v1", "cn-ref-triage-ack-v1", "cn-ref-processed-mids-v1", "cn-outbox-v1", "cn-outlook-cfg-v1", "cn-emaillog-ids-v1"].forEach(k => localStorage.removeItem(k));
    localStorage.setItem(IIN_WIPE, new Date().toISOString());
  } catch {}
})();
var iinToday = () => window.cnDay();
function iinAgo(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  if (isNaN(d)) return "";
  var m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  var h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  var dd = Math.floor(h / 24);
  return dd + "d ago";
}
function iinWhen(iso) {
  if (!iso) return "—";
  var d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  }) + " · " + d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}
function iinOrg(email) {
  var m = /@([^.]+)\./.exec(email || "");
  if (!m) return "";
  var generic = ["gmail", "outlook", "hotmail", "yahoo", "icloud", "proton", "live", "aol", "me"];
  return generic.includes(m[1].toLowerCase()) ? "" : m[1].charAt(0).toUpperCase() + m[1].slice(1);
}
var iinInitials = n => (n || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
function iinRead() {
  try {
    return JSON.parse(localStorage.getItem(IIN_KEY) || "[]");
  } catch {
    return [];
  }
}
function iinWrite(list) {
  try {
    localStorage.setItem(IIN_KEY, JSON.stringify(list));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("cn-intro-inbox-changed"));
  } catch {}
}
function iinUpsert(rec) {
  var list = iinRead();
  var i = list.findIndex(c => c.id === rec.id);
  if (i >= 0) list[i] = rec;else list.unshift(rec);
  list.sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || ""));
  iinWrite(list);
  return rec;
}
function iinReadMids() {
  try {
    return new Set(JSON.parse(localStorage.getItem(IIN_MIDS) || "[]"));
  } catch {
    return new Set();
  }
}
function iinAddMids(ids) {
  var s = iinReadMids();
  (Array.isArray(ids) ? ids : [ids]).forEach(i => {
    if (i) s.add(i);
  });
  try {
    localStorage.setItem(IIN_MIDS, JSON.stringify([...s].slice(-4000)));
  } catch {}
}
var iinPending = () => iinRead().filter(c => c.status === "pending");
function iinReadCfg() {
  try {
    var c = JSON.parse(localStorage.getItem(IIN_CFG) || "{}");
    return {
      lookbackDays: c.lookbackDays || 3,
      lastScanAt: c.lastScanAt || null,
      lastTrackAt: c.lastTrackAt || null
    };
  } catch {
    return {
      lookbackDays: 3,
      lastScanAt: null,
      lastTrackAt: null
    };
  }
}
function iinWriteCfg(c) {
  try {
    localStorage.setItem(IIN_CFG, JSON.stringify(c));
  } catch {}
}
var IIN_SUBJ_RE = /\bintro(s|duction|ductions|duce|duced|ducing)?\b/i;
var IIN_BODY_RULES = [["connecting you", /\bconnect(ing)?\s+you\b/i], ["looping in", /\bloop(ing|ed)?\s+(you|him|her|them|in)\b/i], ["in touch", /\bput(ting)?\s+you\s+(both\s+)?in\s+touch\b/i], ["meet", /\b(please\s+meet|say\s+hello\s+to|meet)\s+[A-Z][a-z]+/]];
function iinMatch(subject, body) {
  if (IIN_SUBJ_RE.test(subject || "")) return {
    on: "subject",
    term: "intro"
  };
  for (var [label, re] of IIN_BODY_RULES) if (re.test(body || "")) return {
    on: "body",
    term: label
  };
  return null;
}
window.cnIntroMatch = iinMatch;
var IIN_CLIENT_ID = "add7572c-ae7a-4668-bd9d-2f15d27f935e";
var IIN_AUTHORITY = "https://login.microsoftonline.com/common";
var IIN_SCOPES = ["Mail.Read", "User.Read"];
var IIN_SKIP_FOLDERS = ["junk email", "deleted items", "drafts", "conversation history", "outbox"];
var _iinPca = null;
function iinClearStaleInteraction() {
  try {
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && k.indexOf("msal.") === 0 && k.indexOf("interaction.status") !== -1) localStorage.removeItem(k);
    }
    localStorage.removeItem("msal.interaction.status");
  } catch {}
}
async function iinMsal() {
  if (!window.msal) return null;
  if (!_iinPca) {
    _iinPca = new window.msal.PublicClientApplication({
      auth: {
        clientId: IIN_CLIENT_ID,
        authority: IIN_AUTHORITY,
        redirectUri: window.location.origin
      },
      cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false
      }
    });
    await _iinPca.initialize();
    try {
      await _iinPca.handleRedirectPromise();
    } catch {}
    iinClearStaleInteraction();
  }
  return _iinPca;
}
async function iinRetry(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e && (e.errorCode === "interaction_in_progress" || /interaction_in_progress/i.test(e.message || ""))) {
      iinClearStaleInteraction();
      return await fn();
    }
    throw e;
  }
}
function iinAccount() {
  try {
    return _iinPca ? _iinPca.getAllAccounts()[0] || null : null;
  } catch {
    return null;
  }
}
async function iinConnect() {
  var pca = await iinMsal();
  if (!pca) throw new Error("Microsoft sign-in didn't load. Reload with a live connection.");
  var res = await iinRetry(() => pca.loginPopup({
    scopes: IIN_SCOPES,
    prompt: "select_account"
  }));
  return res.account;
}
async function iinToken() {
  var pca = await iinMsal();
  if (!pca) throw new Error("Microsoft sign-in didn't load.");
  var account = iinAccount();
  if (!account) account = await iinConnect();
  try {
    var r = await pca.acquireTokenSilent({
      scopes: IIN_SCOPES,
      account
    });
    return r.accessToken;
  } catch {
    var _r = await iinRetry(() => pca.acquireTokenPopup({
      scopes: IIN_SCOPES
    }));
    return _r.accessToken;
  }
}
async function iinDisconnect() {
  var pca = await iinMsal();
  var account = iinAccount();
  if (pca && account) {
    try {
      await pca.clearCache({
        account
      });
    } catch {}
  }
  _iinPca = null;
}
async function iinResume() {
  try {
    await iinMsal();
  } catch {}
  return iinAccount();
}
async function iinGraph(token, path) {
  var res = await fetch("https://graph.microsoft.com/v1.0" + path, {
    headers: {
      Authorization: "Bearer " + token,
      Prefer: 'outlook.body-content-type="text"'
    }
  });
  if (!res.ok) throw new Error("Outlook request failed (" + res.status + "). Confirm Mail.Read is granted.");
  return res.json();
}
async function iinFolderMap(token) {
  try {
    var d = await iinGraph(token, "/me/mailFolders?$top=100&$select=id,displayName");
    var m = {};
    (d.value || []).forEach(f => {
      m[f.id] = (f.displayName || "").toLowerCase();
    });
    return m;
  } catch {
    return {};
  }
}
function iinMeEmails() {
  var set = new Set();
  var a = iinAccount();
  if (a && a.username) set.add(a.username.toLowerCase());
  try {
    (window.cnCurrentUserEmails || []).forEach(e => e && set.add(String(e).toLowerCase()));
  } catch {}
  return set;
}
function iinParties(m, me) {
  var seen = new Set(),
    out = [];
  var push = ea => {
    var addr = (ea && ea.address || "").toLowerCase();
    if (!addr || seen.has(addr) || me.has(addr)) return;
    seen.add(addr);
    out.push({
      name: (ea.name || addr.split("@")[0]).trim(),
      email: ea.address,
      org: iinOrg(ea.address),
      role: ""
    });
  };
  push(m.from && m.from.emailAddress);
  (m.toRecipients || []).forEach(r => push(r.emailAddress));
  (m.ccRecipients || []).forEach(r => push(r.emailAddress));
  return out.slice(0, 6);
}
async function iinScan(currentUser) {
  var cfg = iinReadCfg();
  await iinPullServer();
  var token = await iinToken();
  if (currentUser && currentUser.email) {
    window.cnCurrentUserEmails = [...new Set([...(window.cnCurrentUserEmails || []), currentUser.email])];
  }
  var me = iinMeEmails();
  var folders = await iinFolderMap(token);
  var since = new Date(Date.now() - cfg.lookbackDays * 86400000).toISOString();
  var data = await iinGraph(token, "/me/messages?$top=200&$orderby=receivedDateTime desc" + "&$select=id,conversationId,internetMessageId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,parentFolderId" + "&$filter=receivedDateTime ge " + since);
  var msgs = data.value || [];
  var mids = iinReadMids();
  var cands = iinRead();
  var knownThreads = new Set([...cands.map(c => c.threadId).filter(Boolean), ...(window.cnIntros ? window.cnIntros.read() : []).map(x => x.threadId).filter(Boolean)]);
  var knownMids = new Set([...mids, ...cands.map(c => c.messageId).filter(Boolean)]);
  var matched = 0,
    added = 0,
    skipped = 0;
  var fresh = [];
  for (var m of msgs) {
    var folder = folders[m.parentFolderId] || "";
    if (IIN_SKIP_FOLDERS.includes(folder)) {
      skipped++;
      continue;
    }
    var hit = iinMatch(m.subject || "", m.bodyPreview || "");
    if (!hit) continue;
    matched++;
    var mid = m.internetMessageId || m.id;
    if (knownMids.has(mid)) continue;
    if (m.conversationId && knownThreads.has(m.conversationId)) {
      knownMids.add(mid);
      iinAddMids(mid);
      continue;
    }
    var parties = iinParties(m, me);
    if (parties.length < 2) continue;
    var now = new Date().toISOString();
    fresh.push({
      id: "cand-" + Math.random().toString(36).slice(2, 9),
      subject: m.subject || "(no subject)",
      snippet: (m.bodyPreview || "").slice(0, 400),
      receivedAt: m.receivedDateTime || now,
      messageId: mid,
      threadId: m.conversationId || null,
      folder: folder || "mailbox",
      fromName: m.from && m.from.emailAddress && m.from.emailAddress.name || "",
      fromEmail: m.from && m.from.emailAddress && m.from.emailAddress.address || "",
      outbound: me.has((m.from && m.from.emailAddress && m.from.emailAddress.address || "").toLowerCase()),
      parties,
      matchedOn: hit.on,
      matchTerm: hit.term,
      status: "pending",
      introId: null,
      source: "outlook",
      createdAt: now,
      updatedAt: now
    });
    knownMids.add(mid);
    if (m.conversationId) knownThreads.add(m.conversationId);
    added++;
  }
  if (fresh.length) {
    iinAddMids(fresh.map(c => c.messageId));
    iinWrite([...fresh, ...cands].sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || "")));
  }
  iinWriteCfg({
    ...cfg,
    lastScanAt: new Date().toISOString()
  });
  return {
    scanned: msgs.length,
    matched,
    added,
    skipped
  };
}
async function iinTrackThreads() {
  if (!window.cnIntros || !iinAccount()) return {
    checked: 0,
    changed: 0
  };
  var token = await iinToken();
  var me = iinMeEmails();
  var live = window.cnIntros.read().filter(x => x.threadId && x.status !== "won" && x.status !== "dead");
  var checked = 0,
    changed = 0;
  var _loop = async function (intro) {
      var msgs = [];
      try {
        var q = "/me/messages?$top=25&$select=id,from,receivedDateTime,subject" + "&$filter=conversationId eq '" + encodeURIComponent(String(intro.threadId).replace(/'/g, "''")) + "'";
        var d = await iinGraph(token, q);
        msgs = (d.value || []).slice().sort((a, b) => (a.receivedDateTime || "").localeCompare(b.receivedDateTime || ""));
      } catch {
        return 0;
      }
      checked++;
      if (!msgs.length) return 0;
      var partyEmails = new Set([intro.clientEmail, intro.partnerEmail].filter(Boolean).map(s => s.toLowerCase()));
      var senderOf = m => (m.from && m.from.emailAddress && m.from.emailAddress.address || "").toLowerCase();
      var last = msgs[msgs.length - 1];
      var lastAt = last.receivedDateTime || null;
      var patch = {
        threadCount: msgs.length,
        lastThreadAt: lastAt
      };
      var next = intro.status;
      if (intro.status === "queued") {
        var sent = msgs.find(m => me.has(senderOf(m)) && (!intro.createdAt || (m.receivedDateTime || "") >= intro.createdAt.slice(0, 10)));
        if (sent) {
          next = "introduced";
          patch.introSentAt = sent.receivedDateTime;
          patch.nextFollowUpAt = window.cnIntros.addDays(4, (sent.receivedDateTime || "").slice(0, 10));
        }
      }
      var sinceSent = patch.introSentAt || intro.introSentAt;
      if (next === "introduced" && sinceSent) {
        var reply = msgs.find(m => partyEmails.has(senderOf(m)) && (m.receivedDateTime || "") > sinceSent);
        if (reply) {
          next = "connected";
          patch.connectedAt = reply.receivedDateTime;
          patch.nextFollowUpAt = window.cnIntros.addDays(7, (reply.receivedDateTime || "").slice(0, 10));
        }
      }
      if ((next === "introduced" || next === "connected") && intro.nextFollowUpAt) {
        var due = new Date(intro.nextFollowUpAt + "T00:00:00");
        var quietSince = lastAt ? new Date(lastAt) : null;
        if (!isNaN(due) && Date.now() > due.getTime() && quietSince && quietSince.getTime() < due.getTime()) {
          next = "stalled";
          patch.stalledAt = new Date().toISOString();
        }
      }
      if (next !== intro.status || intro.threadCount !== msgs.length || intro.lastThreadAt !== lastAt) {
        window.cnIntros.upsert({
          ...intro,
          ...patch,
          status: next,
          updatedAt: new Date().toISOString()
        });
        if (next !== intro.status) changed++;
      }
    },
    _ret;
  for (var intro of live.slice(0, 12)) {
    _ret = await _loop(intro);
    if (_ret === 0) continue;
  }
  iinWriteCfg({
    ...iinReadCfg(),
    lastTrackAt: new Date().toISOString()
  });
  return {
    checked,
    changed
  };
}
async function iinPullServer() {
  if (!window.sb) return {
    pulled: 0
  };
  var rows = [];
  try {
    var {
      data,
      error
    } = await window.sb.from("intro_candidates").select("*").eq("status", "pending");
    if (error) throw error;
    rows = data || [];
  } catch {
    return {
      pulled: 0
    };
  }
  if (!rows.length) return {
    pulled: 0
  };
  var local = iinRead();
  var mids = iinReadMids();
  var haveMid = new Set([...mids, ...local.map(c => c.messageId).filter(Boolean)]);
  var haveThread = new Set([...local.map(c => c.threadId).filter(Boolean), ...(window.cnIntros ? window.cnIntros.read() : []).map(x => x.threadId).filter(Boolean)]);
  var fresh = [];
  rows.forEach(r => {
    var rec = r.data || {};
    var mid = rec.messageId || r.message_id;
    if (!mid || haveMid.has(mid)) return;
    if (rec.threadId && haveThread.has(rec.threadId)) return;
    haveMid.add(mid);
    fresh.push({
      ...rec,
      id: rec.id || r.id,
      serverId: r.id,
      source: rec.source || "outlook-worker",
      status: "pending"
    });
  });
  if (fresh.length) {
    iinAddMids(fresh.map(c => c.messageId));
    iinWrite([...fresh, ...local].sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || "")));
  }
  return {
    pulled: fresh.length
  };
}
function iinMarkServer(cand, status) {
  var key = cand.serverId || cand.id;
  if (!window.sb || !key) return;
  try {
    window.sb.from("intro_candidates").update({
      status,
      updated_at: new Date().toISOString()
    }).eq("id", key).then(() => {}, () => {});
  } catch {}
}
function iinAccept(cand) {
  var client = (cand.parties || []).find(p => p.role === "client");
  var partner = (cand.parties || []).find(p => p.role === "partner");
  if (!client || !partner) return {
    ok: false,
    msg: "Tag one client and one partner first"
  };
  if (!window.cnIntros || !window.cnIntros.createFromInbox) return {
    ok: false,
    msg: "Introductions module unavailable"
  };
  var intro = window.cnIntros.createFromInbox({
    clientName: client.name,
    clientEmail: client.email,
    clientOrg: client.org,
    partnerName: partner.name,
    partnerEmail: partner.email,
    partnerOrg: partner.org,
    context: cand.subject,
    notes: cand.snippet,
    threadId: cand.threadId,
    sourceMessageId: cand.messageId,
    receivedAt: cand.receivedAt,
    source: cand.source || "outlook",
    status: cand.outbound ? "introduced" : "queued",
    introSentAt: cand.outbound ? cand.receivedAt : null
  });
  iinUpsert({
    ...cand,
    status: "accepted",
    introId: intro.id,
    updatedAt: new Date().toISOString()
  });
  iinMarkServer(cand, "accepted");
  return {
    ok: true,
    intro
  };
}
function iinDismiss(cand) {
  iinAddMids(cand.messageId);
  iinMarkServer(cand, "dismissed");
  iinWrite(iinRead().filter(c => c.id !== cand.id));
}
function iinSetRole(candId, email, role) {
  var list = iinRead();
  var c = list.find(x => x.id === candId);
  if (!c) return;
  c.parties = c.parties.map(p => {
    if (p.email === email) return {
      ...p,
      role: p.role === role ? "" : role
    };
    if (p.role === role) return {
      ...p,
      role: ""
    };
    return p;
  });
  c.updatedAt = new Date().toISOString();
  iinWrite(list);
}
function iinFromPaste(raw) {
  var text = String(raw || "");
  var subj = (/^\s*subject\s*:\s*(.+)$/im.exec(text) || [])[1] || "";
  var body = text.replace(/^\s*(from|to|cc|sent|subject|date)\s*:.*$/gim, "").trim();
  var hit = iinMatch(subj, body) || iinMatch(subj, text);
  var emails = [...new Set((text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).map(e => e.replace(/[.,;>]$/, "")))];
  var named = {};
  (text.match(/([A-Z][\w'.-]+(?:\s+[A-Z][\w'.-]+){0,2})\s*<([\w.+-]+@[\w-]+\.[\w.]+)>/g) || []).forEach(chunk => {
    var m = /([A-Z][\w'.-]+(?:\s+[A-Z][\w'.-]+){0,2})\s*<([\w.+-]+@[\w-]+\.[\w.]+)>/.exec(chunk);
    if (m) named[m[2].toLowerCase()] = m[1].trim();
  });
  var me = iinMeEmails();
  var parties = emails.filter(e => !me.has(e.toLowerCase())).slice(0, 6).map(e => ({
    name: named[e.toLowerCase()] || e.split("@")[0],
    email: e,
    org: iinOrg(e),
    role: ""
  }));
  if (parties.length < 2) return {
    ok: false,
    msg: "Need two email addresses to make an intro"
  };
  var now = new Date().toISOString();
  var cand = iinUpsert({
    id: "cand-" + Math.random().toString(36).slice(2, 9),
    subject: subj || "Pasted introduction",
    snippet: body.slice(0, 400),
    receivedAt: now,
    messageId: "paste-" + now,
    threadId: null,
    folder: "pasted",
    fromName: "",
    fromEmail: "",
    outbound: false,
    parties,
    matchedOn: hit ? hit.on : "manual",
    matchTerm: hit ? hit.term : "pasted",
    status: "pending",
    introId: null,
    source: "paste",
    createdAt: now,
    updatedAt: now
  });
  return {
    ok: true,
    cand
  };
}
window.IntroInbox = {
  read: iinRead,
  pending: iinPending,
  pendingCount: () => iinPending().length,
  scan: iinScan,
  track: iinTrackThreads,
  accept: iinAccept,
  dismiss: iinDismiss,
  pullServer: iinPullServer,
  setRole: iinSetRole,
  fromPaste: iinFromPaste,
  cfg: iinReadCfg,
  connect: iinConnect,
  disconnect: iinDisconnect,
  account: iinAccount,
  resume: iinResume,
  available: () => !!window.msal
};
function IinOutlookBar({
  currentUser,
  onScanned
}) {
  var [acct, setAcct] = useState(() => iinAccount());
  var [busy, setBusy] = useState("");
  var [cfg, setCfg] = useState(() => iinReadCfg());
  var [err, setErr] = useState(null);
  var [rule, setRule] = useState(false);
  useEffect(() => {
    var on = true;
    iinResume().then(a => {
      if (on && a) setAcct(a);
    });
    return () => {
      on = false;
    };
  }, []);
  if (!window.msal) return React.createElement("div", {
    className: "cn-ref-outlook cn-ref-outlook--off"
  }, React.createElement("span", {
    className: "cn-ref-ol-ico"
  }, "\u2709"), React.createElement("span", {
    className: "cn-ref-ol-txt"
  }, "Outlook is unavailable in the offline build \u2014 reload with a live connection to scan mail. You can still paste an intro email below."));
  var connect = async () => {
    setBusy("connect");
    try {
      var a = await iinConnect();
      setAcct(a);
      setErr(null);
      window.cnToast && window.cnToast({
        title: "Outlook connected",
        sub: a?.username || ""
      });
      await scan(true);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy("");
    }
  };
  var scan = async quiet => {
    setBusy("scan");
    try {
      var r = await iinScan(currentUser);
      setCfg(iinReadCfg());
      setAcct(iinAccount());
      setErr(null);
      onScanned && onScanned(r);
      if (!quiet) window.cnToast && window.cnToast({
        title: r.added ? `${r.added} intro${r.added === 1 ? "" : "s"} staged` : "No new intros",
        sub: `${r.scanned} message${r.scanned === 1 ? "" : "s"} read · ${r.matched} matched the intro rule`
      });
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy("");
    }
  };
  var track = async () => {
    setBusy("track");
    try {
      var r = await iinTrackThreads();
      setCfg(iinReadCfg());
      window.cnToast && window.cnToast({
        title: r.changed ? `${r.changed} introduction${r.changed === 1 ? "" : "s"} moved` : "Threads up to date",
        sub: `${r.checked} thread${r.checked === 1 ? "" : "s"} checked`
      });
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy("");
    }
  };
  var disconnect = async () => {
    await iinDisconnect();
    setAcct(null);
    window.cnToast && window.cnToast({
      title: "Outlook disconnected"
    });
  };
  return React.createElement("div", {
    className: "cn-ref-outlook"
  }, err && React.createElement("div", {
    className: "cn-ref-ol-err",
    role: "alert"
  }, React.createElement("span", {
    className: "cn-ref-ol-err-ico"
  }, "!"), React.createElement("div", {
    className: "cn-ref-ol-err-txt"
  }, React.createElement("strong", null, "Outlook"), React.createElement("span", null, err)), React.createElement("button", {
    className: "cn-ref-ol-err-x",
    onClick: () => setErr(null),
    "aria-label": "Dismiss"
  }, "\xD7")), React.createElement("div", {
    className: "cn-ref-ol-main"
  }, React.createElement("span", {
    className: `cn-ref-ol-dot ${acct ? "is-on" : ""}`
  }), React.createElement("div", {
    className: "cn-ref-ol-info"
  }, React.createElement("div", {
    className: "cn-ref-ol-title"
  }, acct ? "Outlook connected" : "Connect Outlook", acct && acct.username && React.createElement("span", {
    className: "cn-ref-ol-email"
  }, acct.username)), React.createElement("div", {
    className: "cn-ref-ol-sub"
  }, acct ? React.createElement(React.Fragment, null, "All folders, last ", cfg.lookbackDays, " days \xB7 intro mail only", cfg.lastScanAt ? ` · scanned ${iinAgo(cfg.lastScanAt)}` : "") : React.createElement(React.Fragment, null, "Reads all folders for the last ", cfg.lookbackDays, " days and keeps only introduction emails. Nothing else is imported.")))), React.createElement("div", {
    className: "cn-ref-ol-acts"
  }, React.createElement("button", {
    className: "cn-ref-ol-kw",
    onClick: () => setRule(v => !v)
  }, "What gets scraped"), acct ? React.createElement(React.Fragment, null, React.createElement("button", {
    className: "cn-btn cn-btn--primary cn-btn--sm",
    onClick: () => scan(false),
    disabled: !!busy
  }, busy === "scan" ? "Scanning…" : "Scan now"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost cn-btn--sm",
    onClick: track,
    disabled: !!busy
  }, busy === "track" ? "Checking…" : "Sync threads"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost cn-btn--sm",
    onClick: disconnect,
    disabled: !!busy
  }, "Disconnect")) : React.createElement("button", {
    className: "cn-btn cn-btn--primary cn-btn--sm",
    onClick: connect,
    disabled: !!busy
  }, busy === "connect" ? "Connecting…" : "Connect Outlook")), rule && React.createElement("div", {
    className: "cn-iin-rule"
  }, React.createElement("div", {
    className: "cn-iin-rule-h"
  }, "A message is staged only if"), React.createElement("ul", null, React.createElement("li", null, React.createElement("strong", null, "Subject"), " contains ", React.createElement("code", null, "intro"), " \u2014 intro, introduction, introduce, introducing"), React.createElement("li", null, "or the ", React.createElement("strong", null, "body"), " uses connector phrasing \u2014 ", React.createElement("code", null, "connecting you"), ", ", React.createElement("code", null, "looping in"), ", ", React.createElement("code", null, "putting you in touch"), ", ", React.createElement("code", null, "meet ", "<Name>"))), React.createElement("div", {
    className: "cn-iin-rule-f"
  }, "Junk, Deleted and Drafts are skipped. Everything that doesn't match is ignored \u2014 no leads, no activity logging, no keyword list.")));
}
function IinPasteBox({
  onDone
}) {
  var [open, setOpen] = useState(false);
  var [raw, setRaw] = useState("");
  var go = () => {
    var r = iinFromPaste(raw);
    if (!r.ok) {
      window.cnToast && window.cnToast({
        kind: "error",
        title: "Couldn't read that",
        sub: r.msg
      });
      return;
    }
    setRaw("");
    setOpen(false);
    onDone && onDone();
    window.cnToast && window.cnToast({
      title: "Staged from paste",
      sub: "Tag the client and partner, then create it."
    });
  };
  if (!open) return React.createElement("button", {
    className: "cn-iin-paste-toggle",
    onClick: () => setOpen(true)
  }, "\u2398 Paste an intro email instead");
  return React.createElement("div", {
    className: "cn-iin-paste"
  }, React.createElement("label", null, "Paste the whole email \u2014 sender, recipients and subject are pulled out"), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 120
    },
    value: raw,
    onChange: e => setRaw(e.target.value),
    autoFocus: true,
    placeholder: "From: sender@company.com\nTo: other@partner.com\nSubject: Intro: …\n\nPaste the body here."
  }), React.createElement("div", {
    className: "cn-iin-paste-acts"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost cn-btn--sm",
    onClick: () => {
      setOpen(false);
      setRaw("");
    }
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary cn-btn--sm",
    onClick: go
  }, "Stage it \u2192")));
}
function IinCard({
  cand,
  onChanged
}) {
  var [open, setOpen] = useState(false);
  var client = cand.parties.find(p => p.role === "client");
  var partner = cand.parties.find(p => p.role === "partner");
  var ready = !!client && !!partner;
  var create = () => {
    var r = iinAccept(cand);
    if (!r.ok) {
      window.cnToast && window.cnToast({
        kind: "error",
        title: r.msg
      });
      return;
    }
    onChanged && onChanged();
    window.cnToast && window.cnToast({
      title: "Introduction created",
      sub: `${r.intro.clientName} ‹› ${r.intro.partnerName} · tracking this thread`
    });
  };
  return React.createElement("div", {
    className: `cn-iin-card ${ready ? "is-ready" : ""}`
  }, React.createElement("div", {
    className: "cn-iin-card-top"
  }, React.createElement("div", {
    className: "cn-iin-subj"
  }, React.createElement("span", {
    className: "cn-iin-subj-txt"
  }, cand.subject), React.createElement("span", {
    className: "cn-iin-meta"
  }, iinWhen(cand.receivedAt), React.createElement("span", {
    className: "cn-iin-dot"
  }, "\xB7"), cand.outbound ? "you sent it" : cand.fromName || cand.fromEmail || cand.folder, React.createElement("span", {
    className: "cn-iin-dot"
  }, "\xB7"), React.createElement("span", {
    className: "cn-iin-why"
  }, "matched ", cand.matchedOn === "subject" ? "subject “intro”" : `“${cand.matchTerm}”`))), React.createElement("button", {
    className: "cn-iin-x",
    onClick: () => {
      iinDismiss(cand);
      onChanged && onChanged();
    },
    title: "Not an introduction \u2014 dismiss"
  }, "\u2715")), React.createElement("div", {
    className: "cn-iin-parties"
  }, cand.parties.map(p => React.createElement("div", {
    key: p.email,
    className: `cn-iin-party ${p.role ? "is-" + p.role : ""}`
  }, React.createElement("span", {
    className: "cn-iin-av"
  }, iinInitials(p.name)), React.createElement("span", {
    className: "cn-iin-who"
  }, React.createElement("strong", null, p.name), React.createElement("span", null, p.org || p.email)), React.createElement("span", {
    className: "cn-iin-roles"
  }, React.createElement("button", {
    className: p.role === "client" ? "is-on" : "",
    onClick: () => {
      iinSetRole(cand.id, p.email, "client");
      onChanged && onChanged();
    }
  }, "Client"), React.createElement("button", {
    className: p.role === "partner" ? "is-on" : "",
    onClick: () => {
      iinSetRole(cand.id, p.email, "partner");
      onChanged && onChanged();
    }
  }, "Partner"))))), React.createElement("div", {
    className: "cn-iin-card-foot"
  }, React.createElement("button", {
    className: "cn-iin-link",
    onClick: () => setOpen(v => !v)
  }, open ? "Hide email" : "Read email"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "cn-iin-hint"
  }, ready ? cand.outbound ? "Starts as Introduced — you already sent it" : "Starts in To introduce" : "Tag a client and a partner"), React.createElement("button", {
    className: "cn-btn cn-btn--primary cn-btn--sm",
    onClick: create,
    disabled: !ready
  }, "Create introduction")), open && React.createElement("div", {
    className: "cn-iin-body"
  }, cand.snippet || "No preview."));
}
function IntroInboxPanel({
  currentUser
}) {
  var [cands, setCands] = useState(() => iinPending());
  var reload = () => setCands(iinPending());
  useEffect(() => {
    var h = () => reload();
    window.addEventListener("cn-intro-inbox-changed", h);
    return () => window.removeEventListener("cn-intro-inbox-changed", h);
  }, []);
  useEffect(() => {
    var on = true;
    (async () => {
      try {
        var r = await iinPullServer();
        if (on && r.pulled) reload();
      } catch {}
      var a = await iinResume();
      if (!on || !a) return;
      var cfg = iinReadCfg();
      var stale = !cfg.lastScanAt || Date.now() - new Date(cfg.lastScanAt).getTime() > 5 * 60000;
      if (stale) {
        try {
          await iinScan(currentUser);
          reload();
        } catch {}
      }
      var tStale = !cfg.lastTrackAt || Date.now() - new Date(cfg.lastTrackAt).getTime() > 10 * 60000;
      if (tStale) {
        try {
          await iinTrackThreads();
        } catch {}
      }
    })();
    return () => {
      on = false;
    };
  }, []);
  return React.createElement("div", {
    className: "cn-iin"
  }, React.createElement(IinOutlookBar, {
    currentUser: currentUser,
    onScanned: reload
  }), cands.length === 0 ? React.createElement("div", {
    className: "cn-empty cn-ref-empty"
  }, React.createElement("div", {
    className: "cn-empty-ico"
  }, "\u2709"), React.createElement("div", {
    className: "cn-empty-title"
  }, "Nothing waiting"), React.createElement("div", {
    className: "cn-empty-sub"
  }, "Intro emails from your mailbox land here to be confirmed. Only mail that reads as an introduction is picked up."), React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, React.createElement(IinPasteBox, {
    onDone: reload
  }))) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "cn-iin-lead"
  }, cands.length, " intro email", cands.length === 1 ? "" : "s", " staged \u2014 tag each side, then create the record."), React.createElement("div", {
    className: "cn-iin-list"
  }, cands.map(c => React.createElement(IinCard, {
    key: c.id,
    cand: c,
    onChanged: reload
  }))), React.createElement(IinPasteBox, {
    onDone: reload
  })));
}
window.IntroInboxPanel = IntroInboxPanel;
(function iinCss() {
  if (document.getElementById("cn-iin-css")) return;
  var s = document.createElement("style");
  s.id = "cn-iin-css";
  s.textContent = `
.cn-iin{display:flex;flex-direction:column;gap:14px}
.cn-iin-lead{font-size:13px;color:var(--cn-mute)}
.cn-iin-list{display:flex;flex-direction:column;gap:10px}
.cn-iin-card{border:1px solid var(--cn-line);border-radius:var(--cn-r-lg,10px);background:var(--cn-card);padding:14px 16px;box-shadow:var(--cn-shadow);display:flex;flex-direction:column;gap:12px}
.cn-iin-card.is-ready{border-color:var(--cn-copper)}
.cn-iin-card-top{display:flex;align-items:flex-start;gap:12px}
.cn-iin-subj{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
.cn-iin-subj-txt{font-size:15px;font-weight:600;line-height:1.35;text-wrap:pretty}
.cn-iin-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px;color:var(--cn-mute)}
.cn-iin-dot{opacity:.5}
.cn-iin-why{font-variant-numeric:tabular-nums}
.cn-iin-x{background:none;border:0;color:var(--cn-mute);font-size:14px;cursor:pointer;padding:2px 6px;border-radius:6px;line-height:1}
.cn-iin-x:hover{background:var(--cn-paper-2);color:var(--cn-ink)}
.cn-iin-parties{display:grid;gap:8px}
.cn-iin-party{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--cn-line-2,var(--cn-line));border-radius:var(--cn-r,6px);background:var(--cn-paper-2)}
.cn-iin-party.is-client{border-color:var(--cn-copper);background:var(--cn-copper-wash)}
.cn-iin-party.is-partner{border-color:var(--cn-pos);background:color-mix(in oklch,var(--cn-pos) 12%,var(--cn-paper-2))}
.cn-iin-av{width:28px;height:28px;flex:0 0 28px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:var(--cn-line);color:var(--cn-ink)}
.cn-iin-who{display:flex;flex-direction:column;min-width:0;flex:1}
.cn-iin-who strong{color:var(--cn-ink);font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cn-iin-who span{font-size:11.5px;color:var(--cn-mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cn-iin-roles{display:flex;gap:6px;flex:0 0 auto}
.cn-iin-roles button{font:inherit;font-size:11.5px;padding:5px 10px;border-radius:999px;border:1px solid var(--cn-line);background:transparent;color:var(--cn-mute);cursor:pointer}
.cn-iin-roles button:hover{color:var(--cn-ink);border-color:var(--cn-mute)}
.cn-iin-roles button.is-on{background:var(--cn-copper);border-color:var(--cn-copper);color:var(--cn-card)}
.cn-iin-card-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cn-iin-hint{font-size:11.5px;color:var(--cn-mute)}
.cn-iin-link{background:none;border:0;padding:0;font:inherit;font-size:12px;color:var(--cn-mute);text-decoration:underline;cursor:pointer}
.cn-iin-link:hover{color:var(--cn-copper-deep,var(--cn-ink))}
.cn-iin-body{font-size:12.5px;line-height:1.55;color:var(--cn-ink);white-space:pre-wrap;background:var(--cn-paper-2);border:1px solid var(--cn-line-2,var(--cn-line));border-radius:var(--cn-r,6px);padding:10px 12px;max-height:220px;overflow:auto}
.cn-iin-rule{grid-column:1/-1;border-top:1px solid var(--cn-line);margin-top:10px;padding-top:10px;font-size:12.5px;color:var(--cn-mute);line-height:1.6}
.cn-iin-rule-h{font-weight:600;color:var(--cn-ink);margin-bottom:4px}
.cn-iin-rule ul{margin:0;padding-left:18px}
.cn-iin-rule code{font-size:11.5px;background:var(--cn-paper-2);border:1px solid var(--cn-line);padding:1px 5px;border-radius:4px}
.cn-iin-rule-f{margin-top:6px;font-size:11.5px;opacity:.85}
.cn-iin-paste-toggle{align-self:flex-start;background:var(--cn-card);border:1px dashed var(--cn-line);border-radius:8px;padding:8px 12px;font:inherit;font-size:12.5px;color:var(--cn-mute);cursor:pointer}
.cn-iin-paste-toggle:hover{color:var(--cn-ink);border-color:var(--cn-copper)}
.cn-iin-paste{display:flex;flex-direction:column;gap:8px;border:1px solid var(--cn-line);border-radius:var(--cn-r-lg,10px);background:var(--cn-card);padding:12px}
.cn-iin-paste label{font-size:12px;color:var(--cn-mute)}
.cn-iin-paste-acts{display:flex;justify-content:flex-end;gap:8px}
@media(min-width:760px){.cn-iin-parties{grid-template-columns:1fr 1fr}}
`;
  document.head.appendChild(s);
})();