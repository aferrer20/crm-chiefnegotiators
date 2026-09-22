var VOICE_KEY = "cn-voice-profile-v1";
var DEFAULT_VOICE = `Introducing you to Lloyd. Lloyd is one of my key partners, and we'll be working together on several significant opportunities in the coming weeks. I've been telling Lloyd that your solution is a critical enabler for helping us achieve RFS faster, which, in the current market, is worth its weight in gold. I'll let the two of you take it from here. Cheers!\n\nSo great speaking with you! Really looking forward to growing this partnership. See attached for NDA with my signature. Also tagging my sales director, Dan. He will be managing day-to-day communications in the states while I am on my business trip. Thank you!`;
function readVoiceProfile() {
  try {
    return localStorage.getItem(VOICE_KEY) || "";
  } catch {
    return "";
  }
}
function writeVoiceProfile(t) {
  try {
    localStorage.setItem(VOICE_KEY, t);
  } catch {}
}
try {
  if (!readVoiceProfile()) writeVoiceProfile(DEFAULT_VOICE);
} catch {}
window.cnVoiceProfile = readVoiceProfile;
window.cnWriteVoiceProfile = writeVoiceProfile;
var todayStr = () => window.cnDay();
function tdMoney(v) {
  var n = parseFloat(String(v || "").replace(/[^\d.]/g, ""));
  if (isNaN(n)) return 0;
  return /m/i.test(v) ? n * 1e6 : /k/i.test(v) ? n * 1e3 : n;
}
async function aiDraft({
  to,
  subject,
  quote,
  opp
}) {
  if (!(window.claude && window.claude.complete)) throw new Error("AI drafting runs in the hosted CRM.");
  var voice = readVoiceProfile();
  var ctx = `This is a post-quote nudge. Quote ${quote && quote.quoteNumber || ""} for "${opp && opp.title || ""}"${opp && opp.value ? ` (~$${Math.round(opp.value).toLocaleString()})` : ""} was sent to ${to} and has gone quiet. Gently re-open the conversation and offer to help.`;
  var prompt = `You are drafting a short outbound sales email in MY personal voice. Study these samples of my past emails and mirror the tone, warmth, brevity and sign-off:\n\n<my_past_emails>\n${voice}\n</my_past_emails>\n\nWrite ONLY the email body (no "Subject:" line), 60–110 words, plain text with natural line breaks, ready to send. The subject will be "${subject}". Context:\n${ctx}\n\nSign off as me.`;
  var out = await window.claude.complete(prompt);
  return (out || "").trim();
}
var POST_QUOTE_DAYS = 7;
function postQuoteCandidates(scenario) {
  if (!window.cnQuotes) return [];
  var contactsById = {};
  (scenario && scenario.contacts || []).forEach(c => contactsById[c.id] = c);
  var out = [];
  (scenario && (scenario.sharedOpps || scenario.opps) || []).forEach(o => {
    var stage = (o.stage || "").toLowerCase();
    if (stage === "won" || stage === "lost") return;
    var qs = [];
    try {
      qs = window.cnQuotes.readQuotes(o.id) || [];
    } catch {}
    if (qs.some(q => q.status === "accepted")) return;
    qs.forEach(q => {
      if (q.status !== "sent" && q.status !== "viewed") return;
      if (!q.sentAt) return;
      var days = Math.floor((Date.now() - new Date(q.sentAt).getTime()) / 86400000);
      if (days < POST_QUOTE_DAYS) return;
      if (q.followUpAt && (Date.now() - new Date(q.followUpAt).getTime()) / 86400000 < 7) return;
      out.push({
        opp: o,
        quote: q,
        contact: contactsById[o.contactId || o.contact_id],
        days
      });
    });
  });
  return out;
}
function PostQuoteModal({
  ctx,
  currentUser,
  onClose,
  onSent
}) {
  var {
    opp,
    quote,
    contact
  } = ctx;
  var val = window.fmtUSD ? window.fmtUSD(opp.value, {
    compact: true
  }) : "";
  var who = (contact?.name || "there").split(/\s+/)[0];
  var me = currentUser?.fullName || currentUser?.name || "";
  var [to, setTo] = useState(contact?.email || "");
  var [subject, setSubject] = useState(`Following up on ${quote.quoteNumber}`);
  var [body, setBody] = useState(`Hi ${who},\n\nJust circling back on ${quote.quoteNumber}${val ? ` (${val})` : ""} — wanted to make sure it landed and see if any questions came up on pricing, config, or lead time.\n\nHappy to hop on a quick call or turn a revised version around fast if that's easier. What works on your end?\n\nBest,\n${me}`);
  var [busy, setBusy] = useState(false);
  var validEmail = e => window.isValidEmailAddress ? window.isValidEmailAddress(e) : /.+@.+\..+/.test(e);
  var send = async () => {
    if (busy) return;
    if (!validEmail(to)) {
      window.cnToast && window.cnToast({
        kind: "error",
        title: "Add a valid recipient"
      });
      return;
    }
    setBusy(true);
    try {
      var s = window.getSession ? await window.getSession() : null;
      if (!s || !s.user) throw new Error("Sign in to send.");
      if (!window.sb || !window.sb.functions) throw new Error("Sending needs the hosted CRM.");
      var {
        data,
        error
      } = await window.sb.functions.invoke("send-followup", {
        body: {
          uid: s.user.id,
          referral: {
            id: null,
            nudges: 0
          },
          type: "post_quote",
          to,
          subject,
          bodyHtml: (body || "").replace(/\n/g, "<br>"),
          docIds: []
        }
      });
      if (error) throw new Error(error.message || "send failed");
      if (data && data.error) throw new Error(data.message || data.error);
      try {
        var list = window.cnQuotes.readQuotes(opp.id).map(q => q.id === quote.id ? {
          ...q,
          followUpAt: new Date().toISOString()
        } : q);
        window.cnQuotes.writeQuotes(opp.id, list);
      } catch {}
      window.cnToast && window.cnToast({
        title: "Follow-up sent",
        sub: `${quote.quoteNumber} → ${to}`
      });
      onSent && onSent();
      onClose && onClose();
    } catch (e) {
      window.cnToast && window.cnToast({
        kind: "error",
        title: "Couldn't send",
        sub: String(e.message || e)
      });
    } finally {
      setBusy(false);
    }
  };
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onMouseDown: e => {
      if (e.target === e.currentTarget) onClose();
    }
  }, React.createElement("div", {
    className: "cn-modal cn-ref-modal",
    role: "dialog",
    "aria-modal": "true"
  }, React.createElement("div", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("span", {
    className: "cn-card-eyebrow"
  }, "Post-quote follow-up"), React.createElement("h2", {
    className: "cn-modal-title"
  }, opp.title || quote.quoteNumber)), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose,
    "aria-label": "Close"
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "To"), React.createElement("input", {
    className: "cn-input",
    value: to,
    onChange: e => setTo(e.target.value),
    placeholder: "buyer@company.com"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Subject"), React.createElement("input", {
    className: "cn-input",
    value: subject,
    onChange: e => setSubject(e.target.value)
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      marginBottom: 0
    }
  }, React.createElement("div", {
    className: "cn-ref-msg-head"
  }, React.createElement("label", null, "Message ", React.createElement("span", {
    className: "cn-field-help"
  }, "\xB7 in your voice \u2014 edit freely")), React.createElement("button", {
    type: "button",
    className: "cn-ref-ai",
    disabled: busy,
    onClick: async () => {
      setBusy(true);
      try {
        var t = await aiDraft({
          to,
          subject,
          quote,
          opp
        });
        if (t) setBody(t);
        window.cnToast && window.cnToast({
          title: "Drafted in your voice"
        });
      } catch (e) {
        window.cnToast && window.cnToast({
          kind: "error",
          title: "AI draft unavailable",
          sub: String(e.message || e)
        });
      } finally {
        setBusy(false);
      }
    }
  }, "\u2728 Draft in my voice")), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 170
    },
    value: body,
    onChange: e => setBody(e.target.value)
  }))), React.createElement("div", {
    className: "cn-modal-foot"
  }, React.createElement("span", {
    className: "cn-ref-lm-foot"
  }, "Sends from your Outlook \xB7 you approve every send"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: send,
    disabled: busy
  }, busy ? "Sending…" : "Send follow-up"))));
}
function TodayScreen({
  scenario,
  currentUser,
  onOpenOpp,
  onOpenContact,
  onGotoIntros,
  onGotoReferrals
}) {
  var goIntros = onGotoIntros || onGotoReferrals || (tab => window.cnGoto && window.cnGoto("introductions", tab));
  var [tick, setTick] = useState(0);
  var [pq, setPq] = useState(null);
  useEffect(() => {
    var h = () => setTick(t => t + 1);
    window.addEventListener("cn-intros-changed", h);
    window.addEventListener("cn-intro-inbox-changed", h);
    return () => {
      window.removeEventListener("cn-intros-changed", h);
      window.removeEventListener("cn-intro-inbox-changed", h);
    };
  }, []);
  var opps = scenario && (scenario.sharedOpps || scenario.opps) || [];
  var acts = scenario && scenario.activities || [];
  var contactsById = {};
  (scenario && scenario.contacts || []).forEach(c => contactsById[c.id] = c);
  var meId = currentUser && currentUser.id;
  var mine = ownerId => !!ownerId && ownerId === meId;
  var items = useMemo(() => {
    var out = [];
    var staged = window.IntroInbox ? window.IntroInbox.pending() : [];
    if (staged.length) {
      out.push({
        key: "iin-pending",
        kind: "inbox",
        gold: false,
        priority: 950,
        title: `${staged.length} intro email${staged.length === 1 ? "" : "s"} waiting`,
        sub: staged.slice(0, 2).map(c => c.subject).join(" · ").slice(0, 90) || "Confirm who's the client and who's the partner",
        tag: "confirm",
        onOpen: () => goIntros("inbox"),
        action: {
          label: "Review",
          fn: () => goIntros("inbox")
        }
      });
    }
    if (window.cnIntros && window.cnIntros.todayItems) {
      try {
        window.cnIntros.todayItems(tab => goIntros(tab || "pipeline")).forEach(it => out.push(it));
      } catch {}
    }
    var lastAct = {};
    acts.forEach(a => {
      var oid = a.opportunity_id || a.opportunityId;
      var d = a.occurred_at || a.occurredAt;
      if (oid && d) {
        if (!lastAct[oid] || d > lastAct[oid]) lastAct[oid] = d;
      }
    });
    opps.forEach(o => {
      var stage = (o.stage || "").toLowerCase();
      if (stage === "won" || stage === "lost") return;
      if (!mine(o.ownerId)) return;
      var last = lastAct[o.id];
      var created = o.created_at || o.createdAt;
      var days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : created ? Math.floor((Date.now() - new Date(created).getTime()) / 86400000) : 40;
      if (days >= 35) {
        out.push({
          key: "opp-" + o.id,
          kind: "deal",
          gold: false,
          priority: 120 + Math.min(days, 60) + (o.value || 0) / 1e5,
          title: o.title || "Opportunity",
          sub: (window.fmtUSD ? window.fmtUSD(o.value, {
            compact: true
          }) : "") + " · no activity " + days + "d",
          tag: "stale deal",
          onOpen: () => onOpenOpp && onOpenOpp(o.id),
          action: {
            label: "Open deal",
            fn: () => onOpenOpp && onOpenOpp(o.id)
          }
        });
      }
    });
    acts.forEach(a => {
      if (a.type !== "task") return;
      if (a.completed_at || a.completedAt) return;
      if (!mine(a.owner_id || a.ownerId)) return;
      var due = a.due_at || a.dueAt || a.occurred_at || a.occurredAt;
      var dd = due ? Math.floor((new Date(due.slice(0, 10) + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 86400000) : 0;
      if (dd <= 0) {
        var c = contactsById[a.contact_id || a.contactId];
        out.push({
          key: "task-" + a.id,
          kind: "task",
          gold: false,
          priority: 260 + Math.abs(Math.min(dd, 0)) * 5,
          title: a.summary || a.subject || "Task",
          sub: c ? c.name : "",
          tag: dd < 0 ? Math.abs(dd) + "d overdue" : "due today",
          onOpen: () => c && onOpenContact && onOpenContact(c.id),
          action: {
            label: "Done",
            fn: async () => {
              try {
                await window.updateActivity(a.id, {
                  completed_at: new Date().toISOString()
                });
                window.cnToast && window.cnToast({
                  title: "Task completed"
                });
                window.cnReloadCRM && window.cnReloadCRM();
              } catch (e) {
                alert(e.message);
              }
            }
          }
        });
      }
    });
    postQuoteCandidates(scenario).forEach(({
      opp,
      quote,
      contact,
      days
    }) => {
      if (!mine(opp.ownerId)) return;
      out.push({
        key: "pq-" + quote.id,
        kind: "quote",
        gold: false,
        priority: 180 + Math.min(days, 30) + (opp.value || 0) / 1e5,
        title: (contact ? contact.name + " · " : "") + (opp.title || "Quote"),
        sub: quote.quoteNumber + " · " + (quote.viewedAt ? "viewed" : "sent") + " " + days + "d ago",
        tag: "quote follow-up",
        onOpen: () => setPq({
          opp,
          quote,
          contact
        }),
        action: {
          label: "Follow up",
          fn: () => setPq({
            opp,
            quote,
            contact
          })
        }
      });
    });
    if (window.cnQuotes && window.cnQuoteIsExpired) {
      opps.forEach(o => {
        var st = (o.stage || "").toLowerCase();
        if (st === "won" || st === "lost") return;
        if (!mine(o.ownerId)) return;
        var qs = [];
        try {
          qs = window.cnQuotes.readQuotes(o.id) || [];
        } catch {}
        if (qs.some(q => q.status === "accepted")) return;
        qs.forEach(q => {
          var expd = window.cnQuoteIsExpired(q);
          var soon = window.cnQuoteIsExpiringSoon && window.cnQuoteIsExpiringSoon(q, 14);
          if (!expd && !soon) return;
          var du = window.cnDaysUntilDate ? window.cnDaysUntilDate(q.expiresDate) : 0;
          var amt = window.quoteTotal ? window.quoteTotal(q) : 0;
          out.push({
            key: "exp-" + q.id,
            kind: "expiry",
            gold: false,
            priority: (expd ? 240 : 170) + (o.value || 0) / 1e5 + (expd ? Math.abs(du) : Math.max(0, 14 - du)),
            title: o.title || "Quote",
            sub: q.quoteNumber + (amt ? " · " + (window.fmtUSD ? window.fmtUSD(amt, {
              compact: true
            }) : "") : "") + " · exp. " + q.expiresDate,
            tag: expd ? "expired" : "expires in " + du + "d",
            onOpen: () => onOpenOpp && onOpenOpp(o.id),
            action: {
              label: expd ? "Re-open" : "Review",
              fn: () => onOpenOpp && onOpenOpp(o.id)
            }
          });
        });
      });
    }
    if (window.cnPendingCalls) {
      try {
        window.cnPendingCalls(scenario).slice(0, 8).forEach(a => {
          if (!mine(a.ownerId)) return;
          var c = contactsById[a.contactId] || contactsById[a.contact_id];
          out.push({
            key: "call-" + a.id,
            kind: "call",
            gold: false,
            priority: 200,
            title: (c ? c.name : "Unknown caller") + " · " + (a.subject || "Call logged"),
            sub: (a.when || "") + (a.duration ? " · " + a.duration + " min" : "") + " · no deal attached",
            tag: "link to a deal",
            onOpen: () => window.cnGoto && window.cnGoto("calls"),
            action: {
              label: "Link",
              fn: () => window.cnGoto && window.cnGoto("calls")
            }
          });
        });
      } catch {}
    }
    return out.sort((a, b) => b.priority - a.priority);
  }, [opps, acts, meId, tick]);
  var kindMeta = {
    inbox: {
      icon: "✉",
      label: "Inbox"
    },
    intro: {
      icon: "‹›",
      label: "Intro"
    },
    followup: {
      icon: "↩",
      label: "Follow-up"
    },
    deal: {
      icon: "▤",
      label: "Deal"
    },
    task: {
      icon: "◯",
      label: "Task"
    },
    quote: {
      icon: "$",
      label: "Quote"
    },
    expiry: {
      icon: "⧖",
      label: "Expiry"
    },
    call: {
      icon: "☎",
      label: "Call"
    }
  };
  var counts = items.reduce((m, it) => {
    m[it.kind] = (m[it.kind] || 0) + 1;
    return m;
  }, {});
  var staged = window.IntroInbox ? window.IntroInbox.pendingCount() : 0;
  return React.createElement("div", {
    className: "cn-page cn-today"
  }, React.createElement("div", {
    className: "cn-ref-stats"
  }, [["inbox", "Intro emails", staged], ["intro", "Introductions", counts.intro || 0], ["expiry", "Expiring quotes", counts.expiry || 0], ["deal", "Stale deals", counts.deal || 0], ["task", "Tasks due", counts.task || 0]].map(([k, label, n]) => React.createElement("div", {
    key: k,
    className: "cn-ref-stat"
  }, React.createElement("div", {
    className: "cn-ref-stat-label"
  }, label), React.createElement("div", {
    className: "cn-ref-stat-num"
  }, n), React.createElement("div", {
    className: "cn-ref-stat-sub"
  }, kindMeta[k].label)))), items.length === 0 ? React.createElement("div", {
    className: "cn-empty cn-ref-empty"
  }, React.createElement("div", {
    className: "cn-empty-ico"
  }, "\u2713"), React.createElement("div", {
    className: "cn-empty-title"
  }, "Inbox zero for the day"), React.createElement("div", {
    className: "cn-empty-sub"
  }, "Nothing due for you \u2014 no intros to confirm, follow-ups, stale deals, quotes or tasks. Nice.")) : React.createElement("div", {
    className: "cn-today-list"
  }, items.map(it => React.createElement("div", {
    key: it.key,
    className: `cn-today-item cn-today-item--${it.kind} ${it.gold ? "is-gold" : ""}`
  }, React.createElement("span", {
    className: "cn-today-ico"
  }, (kindMeta[it.kind] || kindMeta.task).icon), React.createElement("div", {
    className: "cn-today-body",
    onClick: it.onOpen
  }, React.createElement("div", {
    className: "cn-today-top"
  }, it.gold && React.createElement("span", {
    className: "cn-ref-star"
  }, "\u2605"), React.createElement("span", {
    className: "cn-today-title"
  }, it.title), React.createElement("span", {
    className: `cn-today-tag cn-today-tag--${it.kind}`
  }, it.tag)), React.createElement("div", {
    className: "cn-today-sub"
  }, it.sub)), React.createElement("button", {
    className: "cn-btn cn-btn--primary cn-btn--sm",
    onClick: it.action.fn
  }, it.action.label)))), pq && React.createElement(PostQuoteModal, {
    ctx: pq,
    currentUser: currentUser,
    onClose: () => setPq(null),
    onSent: () => setTick(t => t + 1)
  }));
}
window.TodayScreen = TodayScreen;