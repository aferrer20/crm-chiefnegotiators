var T_KEY = "cn-templates";
var C_KEY = "cn-campaigns";
var WL_KEY = "cn-warm-leads";
var SIG_KEY = "cn-signature";
function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}
function writeJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ── campaign library seeds ────────────────────────────────────────────────
// The nine campaign layouts registered by email-campaigns.js become real
// template rows, each with its three-touch follow-ups where the campaign is a
// cold approach. Built from the registry so adding a layout there is enough.
var CAMPAIGN_CATEGORY = {
  "cnp-buyer-intro": "Prospecting",
  "cnp-operator-intro": "Supply side",
  "cnp-capacity-drop": "Campaigns",
  "cnp-benchmark": "Lead magnets",
  "cnp-checklist": "Lead magnets",
  "cnp-roundtable": "Events",
  "cnp-event-followup": "Events",
  "cnp-market-intel": "Announcements",
  "cnp-site-tour": "Campaigns",
};
function campaignSeeds() {
  var E = window.cnEmail;
  var layouts = window.cnCampaignLayouts || [];
  if (!E || !E.designFromPreset || !layouts.length) return [];
  var rows = [];
  layouts.forEach(function (l) {
    var design = E.designFromPreset(l.id);
    rows.push({
      id: "t-" + l.id,
      name: l.name,
      category: CAMPAIGN_CATEGORY[l.id] || l.category || "Campaigns",
      subject: (design && design.subject) || l.subject || "",
      body: (design && E.renderText) ? E.renderText(design, null) : "",
      design: design,
    });
    var touches = (window.cnCampaignTouches || {})[l.id] || [];
    touches.forEach(function (t, i) {
      rows.push({
        id: "t-" + l.id + "-f" + (i + 1),
        name: l.name + " \u00b7 follow-up " + (i + 1),
        category: CAMPAIGN_CATEGORY[l.id] || l.category || "Campaigns",
        subject: t.subject,
        body: t.body,
        design: null,
      });
    });
  });
  return rows;
}
function readTemplates() {
  var stored = readJSON(T_KEY, null);
  var seedVersion = localStorage.getItem("cn-templates-seed-v");
  var seeded = [{
    id: "t-intro-procurement",
    name: "Cold intro · procurement lead",
    category: "Prospecting",
    subject: "{{first_name}} — worth a quick call?",
    body: "Hi {{first_name}},\n\nWe sit on the buyer's side of procurement deals — negotiating the pricing and terms for teams like {{company}} so you're not up against the vendor's sales side alone. It costs you nothing.\n\nWorth 10 minutes this week to see if it's a fit?\n\n— {{sender_name}}\nThe Chief Negotiators"
  }, {
    id: "t-intro-engineer",
    name: "Cold intro · technical buyer",
    category: "Prospecting",
    subject: "Faster sourcing on what you actually need",
    body: "Hi {{first_name}},\n\nRan across {{company}} and thought we might be useful. We help buyers source the components they need when the usual channels are quoting months out.\n\nGot a stuck part or a hot BOM? Send it over and I'll see what we can do — no obligation.\n\n— {{sender_name}}"
  }, {
    id: "t-quote-fu-2",
    name: "Quote follow-up · day 2",
    category: "Quotes",
    subject: "Re: Quote {{quote_number}} — anything I can sharpen?",
    body: "Hi {{first_name}},\n\nChecking in on quote {{quote_number}} ({{quote_total}}). Most folks come back with one of three things:\n\n  • Pricing on a line or two\n  • Adjusted lead time or condition\n  • A different qty break\n\nHappy to revise on any of those. Just hit reply and let me know.\n\n— {{sender_name}}"
  }, {
    id: "t-quote-fu-week",
    name: "Quote follow-up · week 1",
    category: "Quotes",
    subject: "Closing out quote {{quote_number}} — still active?",
    body: "Hi {{first_name}},\n\nQuick check on quote {{quote_number}}. If it's still in play, I'd like to keep the pricing locked in — supplier costs have shifted on a few lines and I'd rather sharpen the quote than let it expire.\n\nIs this still a live project for {{company}}?\n\n— {{sender_name}}"
  }, {
    id: "t-reactivate",
    name: "Warm reactivation · past customer",
    category: "Reactivation",
    subject: "Been a minute — what's on your sourcing list for this quarter?",
    body: "Hi {{first_name}},\n\nHope you've been well — it's been a while since we worked with {{company}}.\n\nAnything on your sourcing list right now? If something's stuck, send it my way and I'll take a look.\n\nWorth a quick call to compare notes?\n\n— {{sender_name}}"
  }, {
    id: "t-reactivate-cold",
    name: "Reactivation · went dark",
    category: "Reactivation",
    subject: "Quick favor, {{first_name}}",
    body: "Hi {{first_name}},\n\nNo pitch — just wanted to ask: are you still the right person to talk to about procurement at {{company}}, or has it moved to someone else?\n\nEither way, appreciate the heads up.\n\n— {{sender_name}}"
  }, {
    id: "t-referral",
    name: "Referral request · post-win",
    category: "Customer success",
    subject: "Quick one — anyone in your network with the same headache?",
    body: "Hi {{first_name}},\n\nGlad the {{company}} order landed cleanly. Quick ask while it's fresh:\n\nIs there anyone in your network — a peer at another company, someone you used to work with — who's also dealing with sourcing pain? An intro doesn't cost you anything and I'll take care of the relationship from there.\n\nNo worries if not. Just figured worth asking.\n\n— {{sender_name}}"
  }, {
    id: "t-thanks",
    name: "Post-close thank you",
    category: "Customer success",
    subject: "Thanks for the order — {{company}}",
    body: "Hi {{first_name}},\n\nGreat working with you on this one.\n\nIf anything else lands on your desk in the next few weeks, send it my way — the most useful thing I can be is your first call when something's stuck.\n\n— {{sender_name}}"
  }, {
    id: "t-event-followup",
    name: "Event / trade show follow-up",
    category: "Prospecting",
    subject: "Following up from the booth — quick recap",
    body: "Hi {{first_name}},\n\nGreat connecting briefly the other day. You mentioned you're working on a refresh — wanted to put a face to the email and keep the conversation moving.\n\nLet me know if a 15-min call works this week or next; I'll come prepared with a few pricing scenarios on the parts we discussed.\n\n— {{sender_name}}"
  }, {
    id: "t-gpu-cold-call-first",
    name: "1A · GPU cold email — call-first",
    category: "GPU buyer sequence",
    subject: "[B300 / H200 / GB300] allocation, buyer side",
    body: "Hi {{first_name}},\n\nIf you're sourcing [GPUs / B300s / H200s] right now, you've seen how much of the market is brokers forwarding quotes for supply they don't actually hold. You chase it, the allocation's gone, and the price has moved.\n\nWe work the other way. We connect buyers directly with real, authorized suppliers holding actual allocation, the kind that isn't sitting on the open market. And we're on your side of the deal, negotiating your pricing and terms. It costs you nothing, since we're paid through the supplier network, not by you.\n\nYou can see what's live through our portal: portal.thechiefnegotiators.com\n\nWorth a quick call to walk through what you need and what we can place?\n\n{{sender_name}}\nThe Chief Negotiators\n[phone]  |  [email]"
  }, {
    id: "t-gpu-cold-portal-first",
    name: "1B · GPU cold email — portal-first",
    category: "GPU buyer sequence",
    subject: "access to live [B300 / H200 / GB300] allocation",
    body: "Hi {{first_name}},\n\nIf you're sourcing [GPUs / B300s / H200s], you already know most of what's quoted is brokers passing along supply they don't hold. By the time you act, the allocation's gone and the price has moved.\n\nWe connect buyers directly with authorized suppliers holding real allocation, the kind that isn't on the open market. We're on the buyer's side of the deal, and it costs you nothing.\n\nI can give you access to our portal to see what's live right now: portal.thechiefnegotiators.com\n\nWant me to send you in?\n\n{{sender_name}}\nThe Chief Negotiators\n[phone]  |  [email]"
  }, {
    id: "t-gpu-li-call-first",
    name: "1C · GPU LinkedIn note — call-first",
    category: "GPU buyer sequence",
    subject: "",
    body: "Hi {{first_name}}, saw {{company}} is scaling [compute / GPU capacity]. We connect buyers directly with authorized suppliers holding real allocation, on the buyer's side of the deal, not the supplier's. Happy to share what's live. Worth connecting?"
  }, {
    id: "t-gpu-li-portal-first",
    name: "1D · GPU LinkedIn note — portal-first",
    category: "GPU buyer sequence",
    subject: "",
    body: "Hi {{first_name}}, saw {{company}} is scaling [compute / GPU capacity]. We connect buyers directly with authorized suppliers holding real allocation, buyer's side of the deal. I can give you portal access to see what's live. Worth connecting?"
  }, {
    id: "t-gpu-access-grant",
    name: "1E · GPU access-grant reply — portal + discovery",
    category: "GPU buyer sequence",
    subject: "Re: portal access — sending you in",
    body: "Hi {{first_name}},\n\nDone, sending your portal access now: portal.thechiefnegotiators.com\n\nSo I point you at the right allocation instead of making you dig: what are you sizing for? Rough quantity, which [GPUs / B300s / H200s], and the timeline you're working against. With that I can flag what's the best fit for you the moment it's live.\n\n{{sender_name}}\nThe Chief Negotiators\n[phone]  |  [email]"
  }, {
    id: "t-buyer-cold",
    name: "2A · Buyer-side cold email",
    category: "Buyer-side outreach",
    subject: "quick question on your [GPU / capacity / networking] buildout",
    body: "Hi {{first_name}},\n\nSaw [trigger: the raise, the new infra roles you're hiring, your plans to scale compute]. When a team moves that fast, procurement is usually the part that gets squeezed. The vendor sets the price and the terms, and the buyer ends up negotiating alone against a team that does this all day.\n\nThat's the side we work. We represent the buyer, negotiate the pricing and the fine print, and it costs you nothing. We're paid through our partner network, not by you.\n\nWorth 15 minutes to see if it fits what you're building?\n\n{{sender_name}}\nThe Chief Negotiators\n[phone]  |  [email]"
  }, {
    id: "t-buyer-li-connect",
    name: "2B · Buyer-side LinkedIn — connection note",
    category: "Buyer-side outreach",
    subject: "",
    body: "Hi {{first_name}}, been following {{company}}'s work on [trigger]. We represent buyers negotiating AI infrastructure and data center deals, sitting on their side of the table against vendor sales teams. Would like to connect."
  }, {
    id: "t-buyer-li-followup",
    name: "2C · Buyer-side LinkedIn — follow-up after accept",
    category: "Buyer-side outreach",
    subject: "",
    body: "Thanks for connecting. The reason I reached out: when a team scales compute as fast as you are, the buying side usually gets outgunned by the vendor's sales team. We sit on the buyer's side and negotiate the deal for you, pricing and terms, and it costs you nothing on your end. Open to a short call to see if it's useful for your buildout?"
  }, {
    id: "t-buyer-tradeshow",
    name: "2D · Buyer-side tradeshow follow-up",
    category: "Buyer-side outreach",
    subject: "following up from [Event]",
    body: "Hi {{first_name}},\n\nGood talking at [Event]. You mentioned [their need or what they're building], so I wanted to follow up while it's fresh.\n\nQuick version of what we do: we represent the buyer in AI infrastructure and data center deals, compute, colocation, networking, connectivity, negotiating the pricing and terms so you're not doing it alone against the vendor's sales team. It costs you nothing. We're paid through the partner network.\n\nIf [their need] is still live, I can map where we'd add the most leverage. Does [day] or [day] work for a short call?\n\n{{sender_name}}\nThe Chief Negotiators\n[phone]  |  [email]"
  }, {
    id: "t-apac-capacity-brief",
    name: "Capacity Brief",
    category: "Market brief",
    subject: window.cnEmail && window.cnEmail.briefSubject ? window.cnEmail.briefSubject({ region: "APAC" }) : "Capacity Brief \u2014 live capacity and demand",
    body: "Hi {{firstName}},\n\nHere is our latest Capacity Brief \u2014 a snapshot of live capacity, current demand and what we're hearing across the market.\n\nIf something here aligns with your plans, reply to this email and we can discuss further.\n\nRegards,\n{{fromName}}",
    design: window.cnEmail && window.cnEmail.designFromPreset ? window.cnEmail.designFromPreset("capacitybrief") : null
  }].concat(campaignSeeds());
  if (stored) {
    var have = {};
    stored.forEach(function (t) { if (t && t.id) have[t.id] = true; });
    var missing = seeded.filter(function (t) { return !have[t.id]; });
    // The brief covers every region now, so the row that shipped as "APAC
    // Capacity Brief" is renamed in place. Only the untouched original is
    // migrated — an edited copy is left as the team left it.
    var renamed = false;
    stored.forEach(function (t) {
      if (t && t.id === "t-apac-capacity-brief" && t.name === "APAC Capacity Brief") {
        t.name = "Capacity Brief";
        if (t.subject === "APAC Capacity Brief \u2014 live capacity and demand") {
          t.subject = window.cnEmail && window.cnEmail.briefSubject
            ? window.cnEmail.briefSubject({ region: "APAC" })
            : "Capacity Brief \u2014 live capacity and demand";
        }
        renamed = true;
      }
    });
    localStorage.setItem("cn-templates-seed-v", "9");
    if (!missing.length) {
      if (renamed) writeJSON(T_KEY, stored);
      return stored;
    }
    var merged = stored.concat(missing);
    writeJSON(T_KEY, merged);
    return merged;
  }
  writeJSON(T_KEY, seeded);
  localStorage.setItem("cn-templates-seed-v", "9");
  return seeded;
}
function saveTemplate(t) {
  var list = readTemplates();
  var idx = list.findIndex(x => x.id === t.id);
  if (idx >= 0) list[idx] = t;else list.unshift(t);
  writeJSON(T_KEY, list);
  // Mirrored to the database: the scheduled sequence runner sends template
  // bodies and cannot read this browser. Fire-and-forget so a network blink
  // never costs the rep their edit.
  if (window.cnSequenceSync) { try { window.cnSequenceSync.pushTemplate(t); } catch (e) {} }
  return list;
}
function deleteTemplate(id) {
  var list = readTemplates().filter(t => t.id !== id);
  writeJSON(T_KEY, list);
  return list;
}
function readCampaigns() {
  return readJSON(C_KEY, []);
}
function saveCampaign(c) {
  var list = readCampaigns();
  var idx = list.findIndex(x => x.id === c.id);
  if (idx >= 0) list[idx] = c;else list.unshift(c);
  writeJSON(C_KEY, list);
  return list;
}
window.cnTemplateStore = { read: readTemplates, save: saveTemplate };
window.cnCampaignStore = { read: readCampaigns, save: saveCampaign };
function deleteCampaign(id) {
  var list = readCampaigns().filter(c => c.id !== id);
  writeJSON(C_KEY, list);
  return list;
}
function readWarmLeads() {
  return new Set(readJSON(WL_KEY, []));
}
function toggleWarmLead(contactId) {
  var set = readWarmLeads();
  if (set.has(contactId)) set.delete(contactId);else set.add(contactId);
  writeJSON(WL_KEY, [...set]);
  return set;
}
function readSignature() {
  return localStorage.getItem(SIG_KEY) || "";
}
function writeSignature(s) {
  localStorage.setItem(SIG_KEY, s || "");
}
window.cnOutreach = {
  readTemplates,
  saveTemplate,
  deleteTemplate,
  readCampaigns,
  saveCampaign,
  deleteCampaign,
  readWarmLeads,
  toggleWarmLead,
  readSignature,
  writeSignature,
  simulateSend
};
var newId = p => p + "-" + Math.random().toString(36).slice(2, 10);
function timeAgoSimple(iso) {
  if (!iso) return "";
  var ms = Date.now() - new Date(iso).getTime();
  var m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  var h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  var d = Math.floor(h / 24);
  return d + "d ago";
}
function fixSalutation(text) {
  var t = String(text || "");
  t = t.replace(/^[ \t]*(?:hi|hello|hey|dear)?[ \t]*(?:there)?[ \t]*[,:][ \t]*\r?\n+/i, "");
  t = t.replace(/(^|\n)[ \t]*(?:hi|hello|hey|dear)[ \t]*(?:there)?[ \t]*,[ \t]*(?=\S)/gi, "$1");
  t = t.replace(/^([a-z])/, m => m.toUpperCase());
  return t;
}
function mergeFields(text, ctx) {
  var out = (text || "").replace(/\{\{(\w+)\}\}/g, (_, key) => ctx[key] != null ? ctx[key] : `{{${key}}}`);
  return fixSalutation(out);
}
function simulateSend(campaign) {
  var recipients = campaign.recipients || [];
  var now = Date.now();
  var events = [];
  recipients.forEach(r => {
    if (Math.random() < 0.02) {
      events.push({
        contactId: r.contactId,
        type: "bounced",
        at: new Date(now + 1000 * 60 * (Math.random() * 2 + 0.5)).toISOString()
      });
      return;
    }
    if (Math.random() < 0.38) {
      var openDelayMin = Math.pow(Math.random(), 2) * 60 * 24;
      var openAt = new Date(now + openDelayMin * 60_000).toISOString();
      events.push({
        contactId: r.contactId,
        type: "opened",
        at: openAt
      });
      var extraOpens = 0;
      while (extraOpens < 4 && Math.random() < 0.45) {
        extraOpens++;
        var reopenAt = new Date(new Date(openAt).getTime() + Math.random() * 72 * 3_600_000).toISOString();
        events.push({
          contactId: r.contactId,
          type: "opened",
          at: reopenAt
        });
      }
      if (Math.random() < 0.30) {
        events.push({
          contactId: r.contactId,
          type: "clicked",
          at: new Date(new Date(openAt).getTime() + Math.random() * 30 * 60_000).toISOString()
        });
      }
      if (Math.random() < 0.06) {
        events.push({
          contactId: r.contactId,
          type: "replied",
          at: new Date(new Date(openAt).getTime() + Math.random() * 4 * 60 * 60_000).toISOString()
        });
      }
      if (Math.random() < 0.01) {
        events.push({
          contactId: r.contactId,
          type: "unsubscribed",
          at: new Date(new Date(openAt).getTime() + Math.random() * 60_000).toISOString()
        });
      }
    }
  });
  return events;
}
function campaignStats(c) {
  var events = c.events || [];
  var sent = (c.recipients || []).length || c.recipient_count || 0;
  var now = Date.now();
  var past = ev => new Date(ev.at).getTime() <= now;
  var delivered_events = events.filter(e => e.type === "delivered" && past(e));
  var opens = events.filter(e => e.type === "opened" && past(e));
  var clicks = events.filter(e => e.type === "clicked" && past(e));
  var bounced = events.filter(e => e.type === "bounced" && past(e));
  var replied = events.filter(e => e.type === "replied" && past(e));
  var unsubbed = events.filter(e => e.type === "unsubscribed" && past(e));
  var uniqueOpens = new Set(opens.map(e => e.contactId)).size;
  var uniqueClicks = new Set(clicks.map(e => e.contactId)).size;
  var delivered = delivered_events.length > 0 ? new Set(delivered_events.map(e => e.contactId)).size : Math.max(sent - bounced.length, 0);
  return {
    sent,
    delivered,
    bounced: bounced.length,
    opens: opens.length,
    uniqueOpens,
    clicks: clicks.length,
    uniqueClicks,
    replied: replied.length,
    unsubbed: Math.min(new Set(unsubbed.map(e => e.contactId).filter(Boolean)).size, sent || Infinity),
    openRate: delivered ? uniqueOpens / delivered : 0,
    clickRate: delivered ? uniqueClicks / delivered : 0,
    replyRate: delivered ? replied.length / delivered : 0
  };
}
function applyAudience(filter, scenario) {
  var all = scenario.contacts;
  var warmSet = readWarmLeads();
  return all.filter(c => {
    if (window.isEmailOptedOut && window.isEmailOptedOut(c)) return false;
    if (filter.warmOnly && !warmSet.has(c.id)) return false;
    if (filter.tiers && filter.tiers.length && !filter.tiers.includes(c.tier || "Influencer")) return false;
    if (filter.industries && filter.industries.length) {
      var acct = window.accountOf(c.accountId, scenario);
      if (!acct || !filter.industries.includes(acct.industry)) return false;
    }
    if (filter.hasEmail !== false && !c.email) return false;
    return true;
  });
}
function Outreach({
  scenario,
  currentUser
}) {
  var [tab, setTab] = useState("campaigns");
  return React.createElement("div", {
    className: "cn-page"
  }, React.createElement("div", {
    className: "cn-tabs cn-tabs--underline",
    style: {
      marginBottom: 16
    }
  }, [{
    id: "campaigns",
    label: "Campaigns"
  }, {
    id: "templates",
    label: "Templates"
  }, {
    id: "sequences",
    label: "Sequences"
  }, {
    id: "warm",
    label: "Warm leads"
  }, {
    id: "prospects",
    label: "Prospects"
  }, {
    id: "reports",
    label: "Reports"
  }].map(t => React.createElement("button", {
    key: t.id,
    className: `cn-tab ${tab === t.id ? "is-active" : ""}`,
    onClick: () => setTab(t.id)
  }, t.label))), tab === "campaigns" && React.createElement(CampaignsScreen, {
    scenario: scenario,
    currentUser: currentUser
  }), tab === "templates" && React.createElement(TemplatesScreen, {
    scenario: scenario,
    currentUser: currentUser
  }), tab === "sequences" && window.CnSequencesScreen && React.createElement(window.CnSequencesScreen, {
    scenario: scenario,
    currentUser: currentUser,
    campaigns: readCampaigns()
  }), tab === "warm" && React.createElement(WarmLeadsScreen, {
    scenario: scenario,
    currentUser: currentUser
  }), tab === "prospects" && (window.CnProspectsScreen ? React.createElement(window.CnProspectsScreen, {
    scenario: scenario
  }) : React.createElement("div", {
    className: "cn-rep-err"
  }, "Prospects isn't available in this build.")), tab === "reports" && (window.CnCampaignReport ? React.createElement(window.CnCampaignReport, null) : React.createElement("div", {
    className: "cn-rep-err"
  }, "Campaign analytics isn't available in this build.")));
}
function TemplatesScreen({
  scenario,
  currentUser
}) {
  var [list, setList] = useState(() => readTemplates());
  var [editingId, setEditingId] = useState(null);
  var editing = editingId ? list.find(t => t.id === editingId) : null;
  var createNew = () => {
    var t = {
      id: newId("t"),
      name: "Untitled template",
      category: "General",
      subject: "",
      body: "",
      design: null
    };
    var next = saveTemplate(t);
    setList(next);
    setEditingId(t.id);
  };
  var update = patch => {
    var next = saveTemplate({
      ...editing,
      ...patch
    });
    setList(next);
  };
  var remove = id => {
    if (!confirm("Delete this template?")) return;
    setList(deleteTemplate(id));
    if (editingId === id) setEditingId(null);
  };
  var saveAsCopy = payload => {
    var copy = { ...editing, ...payload, id: newId("t") };
    setList(saveTemplate(copy));
    setEditingId(copy.id);
  };
  // A monthly brief is edited as next month's draft, not overwritten.
  var duplicateForNextMonth = t => {
    var E = window.cnEmail;
    var design = t.design ? JSON.parse(JSON.stringify(t.design)) : null;
    var stamp = "next month";
    if (design && Array.isArray(design.blocks)) {
      design.blocks.forEach(function (b) {
        if (b && b.type === "capacitybrief") {
          b.props = Object.assign({}, b.props, { monthOffset: 1, issue: "" });
          if (E && E.briefIssue) stamp = E.briefIssue(b.props).month;
          if (E && E.briefSubject) design.subject = E.briefSubject(b.props);
          if (E && E.briefPreheader) design.preheader = E.briefPreheader(b.props);
          design.subjectAuto = true;
        }
      });
    }
    var copy = {
      ...t,
      id: newId("t"),
      name: t.name.replace(/\s*\u00b7\s*[A-Z][a-z]+ draft$/, "") + " \u00b7 " + stamp + " draft",
      subject: design && design.subject || t.subject,
      design: design
    };
    setList(saveTemplate(copy));
    setEditingId(copy.id);
  };
  var isBrief = t => !!(t && t.design && Array.isArray(t.design.blocks) && t.design.blocks.some(function (b) { return b && b.type === "capacitybrief"; }));
  var [sendingTemplate, setSendingTemplate] = useState(null);
  var [outlookContacts, setOutlookContacts] = useState(false);
  var byCat = {};
  list.forEach(t => {
    (byCat[t.category || "General"] = byCat[t.category || "General"] || []).push(t);
  });
  var Designer = window.EmailDesigner;
  if (editing && Designer) {
    return React.createElement(Fragment, null, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 0 10px"
      }
    }, React.createElement("button", {
      className: "cn-link",
      onClick: () => setEditingId(null)
    }, "\u2190 All templates"), React.createElement("span", {
      className: "cn-card-eyebrow"
    }, editing.category || "General"), isBrief(editing) && React.createElement("button", {
      className: "cn-btn",
      style: { marginLeft: "auto", height: 30, padding: "5px 11px", fontSize: 12 },
      onClick: () => duplicateForNextMonth(editing),
      title: "Clone this brief as next month's draft \u2014 issue number and subject move forward, this one stays on file"
    }, "\u29c9 Duplicate for next month")), React.createElement(Designer, {
      template: editing,
      onChange: update,
      onDelete: () => remove(editing.id),
      onSendAsEmail: () => setSendingTemplate(editing),
      onSaveAs: saveAsCopy,
      scenario: scenario,
      currentUser: currentUser
    }), sendingTemplate && React.createElement(QuickSendModal, {
      template: sendingTemplate,
      scenario: scenario,
      currentUser: currentUser,
      onClose: () => setSendingTemplate(null)
    }));
  }
  return React.createElement(Fragment, null, React.createElement("div", {
    className: "cn-out-split"
  }, React.createElement("aside", {
    className: "cn-out-list"
  }, React.createElement("div", {
    className: "cn-out-list-head"
  }, React.createElement("h3", {
    className: "cn-side-title",
    style: {
      margin: 0
    }
  }, "Templates"), window.cnEmailOutlook && window.cnEmailOutlook.available() && React.createElement("button", {
    className: "cn-btn",
    style: {
      height: 32,
      padding: "6px 10px",
      fontSize: 12
    },
    onClick: () => setOutlookContacts(true),
    title: "Import your Outlook contacts into the CRM"
  }, "\u21e9 Outlook"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      height: 32,
      padding: "6px 12px",
      fontSize: 12.5
    },
    onClick: createNew
  }, "+ New")), Object.entries(byCat).map(([cat, ts]) => React.createElement("div", {
    key: cat,
    className: "cn-out-cat"
  }, React.createElement("div", {
    className: "cn-out-cat-name"
  }, cat), ts.map(t => React.createElement("button", {
    key: t.id,
    className: `cn-out-row ${editingId === t.id ? "is-active" : ""}`,
    onClick: () => setEditingId(t.id)
  }, React.createElement("div", {
    className: "cn-out-row-title"
  }, t.name), React.createElement("div", {
    className: "cn-out-row-sub"
  }, t.subject || "—"), React.createElement("span", {
    role: "button",
    tabIndex: 0,
    className: "cn-out-row-send",
    onClick: e => {
      e.stopPropagation();
      setSendingTemplate(t);
    },
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        setSendingTemplate(t);
      }
    },
    title: "Send as email"
  }, "\u2709 Send")))))), React.createElement("section", {
    className: "cn-out-edit"
  }, !editing ? React.createElement("div", {
    className: "cn-out-empty"
  }, React.createElement("div", {
    className: "cn-out-empty-title"
  }, "No template selected"), React.createElement("div", {
    className: "cn-out-empty-sub"
  }, "Pick a template on the left, or create a new one."), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      marginTop: 14
    },
    onClick: createNew
  }, "+ New template")) : React.createElement(Fragment, null, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
      gap: 12
    }
  }, React.createElement("input", {
    className: "cn-input",
    style: {
      maxWidth: 360,
      fontSize: 16,
      fontWeight: 500
    },
    value: editing.name,
    onChange: e => update({
      name: e.target.value
    })
  }), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, React.createElement("select", {
    className: "cn-input",
    style: {
      width: "auto",
      maxWidth: 180
    },
    value: editing.category,
    onChange: e => update({
      category: e.target.value
    })
  }, ["GPU buyer sequence", "Buyer-side outreach", "Prospecting", "Market brief", "Quotes", "Reactivation", "Customer success", "General"].map(c => React.createElement("option", {
    key: c,
    value: c
  }, c))), isBrief(editing) && React.createElement("button", {
    className: "cn-btn",
    onClick: () => duplicateForNextMonth(editing),
    title: "Clone this brief as next month's draft"
  }, "\u29c9 Next month"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setSendingTemplate(editing),
    disabled: !editing.subject || !editing.body
  }, "\u2709 Send as email"), React.createElement("button", {
    className: "cn-btn cn-btn--danger",
    onClick: () => remove(editing.id)
  }, "Delete"))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Subject line"), React.createElement("input", {
    className: "cn-input",
    value: editing.subject,
    onChange: e => update({
      subject: e.target.value
    }),
    placeholder: "Subject\u2026"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Body"), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 280
    },
    value: editing.body,
    onChange: e => update({
      body: e.target.value
    })
  })), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Hero image URL ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 optional")), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12
    },
    value: editing.imageUrl || "",
    onChange: e => update({
      imageUrl: e.target.value
    }),
    placeholder: "https://..."
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "CTA text ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 optional")), React.createElement("input", {
    className: "cn-input",
    value: editing.ctaText || "",
    onChange: e => update({
      ctaText: e.target.value
    }),
    placeholder: "Book a 15-min call"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.5
    }
  }, React.createElement("label", null, "CTA URL"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12
    },
    value: editing.ctaUrl || "",
    onChange: e => update({
      ctaUrl: e.target.value
    }),
    placeholder: "https://..."
  }))), React.createElement("div", {
    className: "cn-merge-help"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Merge fields"), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 6
    }
  }, ["first_name", "last_name", "company", "title", "sender_name", "quote_number", "quote_total"].map(f => React.createElement("button", {
    key: f,
    className: "cn-chip-btn",
    onClick: () => update({
      body: (editing.body || "") + ` {{${f}}}`
    })
  }, `{{${f}}}`))))))), outlookContacts && window.EdContactsModal && React.createElement(window.EdContactsModal, {
    scenario: scenario,
    currentUser: currentUser,
    onClose: () => setOutlookContacts(false)
  }), sendingTemplate && React.createElement(QuickSendModal, {
    template: sendingTemplate,
    scenario: scenario,
    currentUser: currentUser,
    onClose: () => setSendingTemplate(null)
  }));
}
function WarmLeadsScreen({
  scenario,
  currentUser
}) {
  var [warmSet, setWarmSet] = useState(() => readWarmLeads());
  var sixtyDaysAgo = Date.now() - 60 * 86400000;
  var isQuiet = c => {
    if (!c.lastTouchIso) return true;
    return new Date(c.lastTouchIso).getTime() < sixtyDaysAgo;
  };
  var suggested = scenario.contacts.filter(c => {
    if (warmSet.has(c.id)) return false;
    var oppHistory = (scenario.sharedOpps || scenario.opps).filter(o => o.contactId === c.id);
    var hasWon = oppHistory.some(o => o.stage === "won");
    var allLost = oppHistory.length > 0 && oppHistory.every(o => o.stage === "lost");
    var openDeal = oppHistory.some(o => o.stage !== "won" && o.stage !== "lost");
    if (openDeal) return false;
    return (hasWon || allLost) && isQuiet(c);
  });
  var flagged = scenario.contacts.filter(c => warmSet.has(c.id));
  var toggle = id => {
    toggleWarmLead(id);
    setWarmSet(readWarmLeads());
  };
  return React.createElement("div", {
    className: "cn-page",
    style: {
      padding: 0,
      gap: 22
    }
  }, React.createElement("div", {
    className: "cn-warm-intro"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Warm leads workspace"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      marginTop: 4
    }
  }, "Bring old customers back to life"), React.createElement("p", {
    style: {
      color: "var(--cn-mute)",
      margin: "6px 0 0",
      maxWidth: 580
    }
  }, "Past customers and dormant prospects worth a fresh outreach. Promote a contact here when you spot an opening \u2014 they'll show up in campaign audiences and on your dashboard.")), React.createElement("div", {
    className: "cn-warm-stats"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-strip-label"
  }, "Flagged warm"), React.createElement("div", {
    className: "cn-strip-value"
  }, flagged.length)), React.createElement("div", null, React.createElement("div", {
    className: "cn-strip-label"
  }, "Suggested"), React.createElement("div", {
    className: "cn-strip-value"
  }, suggested.length)))), React.createElement("section", {
    className: "cn-card cn-card--flush"
  }, React.createElement("div", {
    style: {
      padding: "14px 22px",
      borderBottom: "1px solid var(--cn-line)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, React.createElement("h3", {
    className: "cn-side-title",
    style: {
      margin: 0
    }
  }, React.createElement("span", {
    style: {
      color: "var(--cn-copper)",
      marginRight: 8
    }
  }, "\u2605"), "Your warm leads ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      fontWeight: 400,
      fontFamily: "var(--cn-sans)",
      fontSize: 13
    }
  }, "\xB7 ", flagged.length))), flagged.length === 0 ? React.createElement("div", {
    style: {
      padding: "30px 22px",
      textAlign: "center",
      color: "var(--cn-mute)"
    }
  }, "No flagged warm leads yet. Promote a suggested contact below to start.") : React.createElement("table", {
    className: "cn-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Contact"), React.createElement("th", null, "Account"), React.createElement("th", null, "History"), React.createElement("th", null, "Last touch"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }))), React.createElement("tbody", null, flagged.map(c => React.createElement(WarmRow, {
    key: c.id,
    c: c,
    scenario: scenario,
    onUnflag: () => toggle(c.id),
    flagged: true
  }))))), React.createElement("section", {
    className: "cn-card cn-card--flush"
  }, React.createElement("div", {
    style: {
      padding: "14px 22px",
      borderBottom: "1px solid var(--cn-line)"
    }
  }, React.createElement("h3", {
    className: "cn-side-title",
    style: {
      margin: 0
    }
  }, "Suggested to reactivate ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      fontWeight: 400,
      fontFamily: "var(--cn-sans)",
      fontSize: 13
    }
  }, "\xB7 ", suggested.length)), React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12.5,
      marginTop: 4
    }
  }, "Contacts at past customers or closed-lost accounts with no touch in 60+ days.")), suggested.length === 0 ? React.createElement("div", {
    style: {
      padding: "30px 22px",
      textAlign: "center",
      color: "var(--cn-mute)"
    }
  }, "Nothing dormant \u2014 keep it up.") : React.createElement("table", {
    className: "cn-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Contact"), React.createElement("th", null, "Account"), React.createElement("th", null, "History"), React.createElement("th", null, "Last touch"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }))), React.createElement("tbody", null, suggested.slice(0, 30).map(c => React.createElement(WarmRow, {
    key: c.id,
    c: c,
    scenario: scenario,
    onFlag: () => toggle(c.id)
  }))))));
}
function WarmRow({
  c,
  scenario,
  onFlag,
  onUnflag,
  flagged
}) {
  var acct = window.accountOf(c.accountId, scenario);
  var history = (scenario.sharedOpps || scenario.opps).filter(o => o.contactId === c.id);
  var won = history.filter(o => o.stage === "won").length;
  var lost = history.filter(o => o.stage === "lost").length;
  return React.createElement("tr", null, React.createElement("td", null, React.createElement("div", {
    className: "cn-row-person"
  }, React.createElement("span", {
    className: "cn-avatar"
  }, c.name.split(" ").map(n => n[0]).join("").slice(0, 2)), React.createElement("div", null, React.createElement("div", {
    className: "cn-cell-primary"
  }, c.name), React.createElement("div", {
    className: "cn-cell-secondary"
  }, c.title)))), React.createElement("td", null, acct?.name || "—"), React.createElement("td", {
    className: "cn-cell-secondary"
  }, won > 0 && React.createElement("span", {
    style: {
      color: "var(--cn-pos)"
    }
  }, won, " won"), won > 0 && lost > 0 && " · ", lost > 0 && React.createElement("span", {
    style: {
      color: "var(--cn-neg)"
    }
  }, lost, " lost"), won === 0 && lost === 0 && "—"), React.createElement("td", {
    className: "cn-cell-secondary"
  }, c.lastTouch || "—"), React.createElement("td", {
    style: {
      textAlign: "right"
    }
  }, flagged ? React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 30,
      fontSize: 12
    },
    onClick: onUnflag
  }, "Remove") : React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      height: 30,
      fontSize: 12
    },
    onClick: onFlag
  }, "\u2605 Flag as warm")));
}
function CampaignsScreen({
  scenario,
  currentUser
}) {
  var [list, setList] = useState(() => readCampaigns());
  var [builderOpen, setBuilderOpen] = useState(false);
  // Bulk edit stages a contact selection and routes here. Pick it up on mount,
  // open the builder with those recipients, then clear the key.
  var [stagedIds, setStagedIds] = useState(null);
  useEffect(() => {
    if (!window.cnPlus) return;
    var ids = window.cnPlus.get("campaign-staged", null);
    if (ids && ids.length) {
      setStagedIds(ids);
      setBuilderOpen(true);
      window.cnPlus.set("campaign-staged", []);
      window.cnCampaignStaged = null;
    }
  }, []);
  var [detailId, setDetailId] = useState(null);
  var [toast, setToast] = useState(null);
  var refresh = () => setList(readCampaigns());
  useEffect(() => {
    var id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!toast) return;
    var id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  var detail = detailId ? list.find(c => c.id === detailId) : null;
  return React.createElement(Fragment, null, window.SEND_VIA_RESEND ? React.createElement("div", {
    className: "cn-out-banner",
    style: {
      background: "#DCE9DE",
      borderColor: "#B6D2BB",
      borderLeftColor: "var(--cn-pos)",
      color: "var(--cn-pos)"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 16,
      marginRight: 6
    }
  }, "\u2713"), React.createElement("div", null, React.createElement("strong", null, "Live sending enabled."), " Campaigns send through Resend from your verified domain. Open and click analytics arrive via webhook within seconds of recipient engagement.")) : React.createElement("div", {
    className: "cn-out-banner"
  }, React.createElement("span", {
    style: {
      fontSize: 16,
      marginRight: 6
    }
  }, "\u24D8"), React.createElement("div", null, React.createElement("strong", null, "Email sending is currently simulated."), " The builder generates realistic-shape analytics (opens, clicks, replies) so you can see the full flow. To go live, wire ", React.createElement("span", {
    className: "cn-mono"
  }, "simulateSend()"), " in ", React.createElement("span", {
    className: "cn-mono"
  }, "outreach.jsx"), " to your provider (Postmark, Resend, SendGrid).")), window.CnApprovalQueue && React.createElement(window.CnApprovalQueue, {
    currentUser: currentUser
  }), list.length > 1 && window.CnEmailTrends && React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, React.createElement(window.CnEmailTrends, {
    campaigns: list
  })), list.length > 0 && window.CnDeliverability && React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, React.createElement(window.CnDeliverability, {
    scenario: scenario
  })), React.createElement("div", {
    className: "cn-toolbar",
    style: {
      marginBottom: 16
    }
  }, React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 13
    }
  }, list.length, " campaign", list.length === 1 ? "" : "s"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setBuilderOpen(true)
  }, "+ New campaign")), list.length === 0 ? React.createElement("section", {
    className: "cn-card",
    style: {
      textAlign: "center",
      padding: 60
    }
  }, React.createElement("div", {
    style: {
      fontSize: 32,
      marginBottom: 8
    }
  }, "\u2709"), React.createElement("h3", {
    style: {
      fontFamily: "var(--cn-serif)",
      fontSize: 22,
      margin: "0 0 8px"
    }
  }, "No campaigns yet"), React.createElement("p", {
    style: {
      color: "var(--cn-mute)",
      margin: "0 0 20px"
    }
  }, "Build a multi-recipient email with images, CTAs, and track who opens and clicks."), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setBuilderOpen(true)
  }, "+ Build your first campaign")) : React.createElement("section", {
    className: "cn-card cn-card--flush"
  }, React.createElement("table", {
    className: "cn-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Campaign"), React.createElement("th", null, "Status"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Sent"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Open rate"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Click rate"), React.createElement("th", null, "Sent at"))), React.createElement("tbody", null, list.map(c => {
    var s = campaignStats(c);
    return React.createElement("tr", {
      key: c.id,
      className: "cn-tr-link",
      onClick: () => setDetailId(c.id)
    }, React.createElement("td", null, React.createElement("div", {
      className: "cn-cell-primary"
    }, c.name), React.createElement("div", {
      className: "cn-cell-secondary"
    }, c.subject || "—")), React.createElement("td", null, React.createElement("span", {
      className: `cn-q-pill cn-camp-status--${c.status}`
    }, c.status)), React.createElement("td", {
      className: "cn-mono",
      style: {
        textAlign: "right"
      }
    }, s.sent.toLocaleString()), React.createElement("td", {
      className: "cn-mono",
      style: {
        textAlign: "right"
      }
    }, (s.openRate * 100).toFixed(1), "%"), React.createElement("td", {
      className: "cn-mono",
      style: {
        textAlign: "right"
      }
    }, (s.clickRate * 100).toFixed(1), "%"), React.createElement("td", {
      className: "cn-cell-secondary"
    }, c.sentAt ? timeAgoSimple(c.sentAt) : "—"));
  })))), builderOpen && React.createElement(CampaignBuilder, {
    scenario: scenario,
    currentUser: currentUser,
    initialManualIds: stagedIds || undefined,
    onClose: () => {
      setBuilderOpen(false);
      setStagedIds(null);
    },
    onSaved: c => {
      refresh();
      setBuilderOpen(false);
      setStagedIds(null);
      setDetailId(c.id);
      setToast({
        title: `Sent “${c.name}”`,
        sub: `${(c.recipients || []).length} recipient${(c.recipients || []).length === 1 ? "" : "s"} · ${c.viaResend ? "tracking opens & clicks now" : "using simulated send"}`
      });
    }
  }), detail && React.createElement(CampaignDetail, {
    campaign: detail,
    scenario: scenario,
    onClose: () => setDetailId(null),
    onDelete: () => {
      setList(deleteCampaign(detail.id));
      setDetailId(null);
    }
  }), toast && React.createElement("div", {
    className: "cn-toast cn-toast--success",
    role: "status",
    "aria-live": "polite"
  }, React.createElement("span", {
    className: "cn-toast-tick"
  }, "\u2713"), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    className: "cn-toast-title"
  }, toast.title), React.createElement("div", {
    className: "cn-toast-sub"
  }, toast.sub)), React.createElement("button", {
    className: "cn-toast-x",
    onClick: () => setToast(null),
    "aria-label": "Dismiss"
  }, "\u2715")));
}
var OUT_ATTACH_MAX = 18 * 1024 * 1024;
function oFmtBytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}
function oFileToBase64(file) {
  return new Promise((resolve, reject) => {
    var r = new FileReader();
    r.onload = () => resolve(String(r.result || "").split(",")[1] || "");
    r.onerror = () => reject(r.error || new Error("Couldn't read file"));
    r.readAsDataURL(file);
  });
}
var _docsCache = null;
function CampaignAttachments({
  attachments,
  onChange,
  currentUser
}) {
  var [docs, setDocs] = useState(() => _docsCache || []);
  var [loading, setLoading] = useState(!_docsCache);
  var [error, setError] = useState(null);
  var [uploading, setUploading] = useState(false);
  var [reading, setReading] = useState(false);
  var fileRef = useRef(null);
  var localRef = useRef(null);
  var all = attachments || [];
  var localFiles = all.filter(a => a.local);
  var selectedPaths = new Set(all.filter(a => a.path).map(a => a.path));
  var addLocalFiles = async fileList => {
    var files = Array.from(fileList || []);
    if (files.length === 0) return;
    var tooBig = files.find(fl => fl.size > OUT_ATTACH_MAX);
    if (tooBig) {
      alert(`"${tooBig.name}" is over 18 MB. Attach a smaller file, or link to it in the body.`);
      return;
    }
    setReading(true);
    try {
      var added = [];
      for (var f of files) {
        var content = await oFileToBase64(f);
        added.push({
          local: true,
          filename: f.name,
          size: f.size,
          type: f.type || "application/octet-stream",
          content
        });
      }
      onChange([...all, ...added]);
    } catch (e) {
      alert("Couldn't read that file:\n\n" + (e.message || e));
    } finally {
      setReading(false);
    }
  };
  var removeLocal = file => onChange(all.filter(a => a !== file));
  var refresh = async () => {
    if (!window.cnDocs) {
      setLoading(false);
      setError("notready");
      return;
    }
    try {
      var list = await window.cnDocs.list();
      _docsCache = list;
      setDocs(list);
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
  }, []);
  var toggle = doc => {
    if (selectedPaths.has(doc.path)) {
      onChange((attachments || []).filter(a => a.path !== doc.path));
    } else {
      onChange([...(attachments || []), {
        docId: doc.id,
        path: doc.path,
        filename: doc.name,
        size: doc.size,
        type: doc.type
      }]);
    }
  };
  var upload = async fileList => {
    var files = Array.from(fileList || []);
    if (files.length === 0) return;
    var tooBig = files.find(fl => fl.size > OUT_ATTACH_MAX);
    if (tooBig) {
      alert(`"${tooBig.name}" is over 18 MB. Attach a smaller file, or link to it in the body.`);
      return;
    }
    if (!window.cnDocs) {
      alert("The document library isn't set up yet. Run supabase/migrations/08_email_documents.sql to enable company-wide documents.");
      return;
    }
    setUploading(true);
    try {
      var added = [];
      for (var f of files) added.push(await window.cnDocs.upload(f, currentUser?.fullName || currentUser?.name || ""));
      _docsCache = [...added, ...(docs || [])];
      setDocs(_docsCache);
      onChange([...(attachments || []), ...added.map(d => ({
        docId: d.id,
        path: d.path,
        filename: d.name,
        size: d.size,
        type: d.type
      }))]);
      setError(null);
    } catch (e) {
      alert("Upload failed:\n\n" + (e.message || e) + "\n\nIf this mentions a missing bucket or table, run supabase/migrations/08_email_documents.sql.");
    } finally {
      setUploading(false);
    }
  };
  var removeDoc = async doc => {
    if (!confirm(`Remove “${doc.name}” from the company document library?\n\nThis deletes it for everyone and detaches it from this campaign.`)) return;
    try {
      await window.cnDocs.remove(doc.id, doc.path);
      _docsCache = (docs || []).filter(d => d.id !== doc.id);
      setDocs(_docsCache);
      onChange((attachments || []).filter(a => a.path !== doc.path));
    } catch (e) {
      alert("Couldn't remove the document:\n\n" + (e.message || e));
    }
  };
  return React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Attachments ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 Files ride on every email in this send.")), React.createElement("div", {
    className: "cn-doclib",
    style: {
      marginBottom: 12
    }
  }, React.createElement("div", {
    className: "cn-doclib-head"
  }, React.createElement("span", {
    className: "cn-doclib-count"
  }, localFiles.length ? `${localFiles.length} attached to this email` : "Attach a file to this email"), React.createElement("button", {
    type: "button",
    className: "cn-btn cn-btn--ghost cn-btn--sm",
    onClick: () => localRef.current?.click(),
    disabled: reading
  }, reading ? React.createElement("span", null, React.createElement("span", {
    className: "cn-spinner"
  }), " Reading\u2026") : "+ Attach a file"), React.createElement("input", {
    ref: localRef,
    type: "file",
    multiple: true,
    style: {
      display: "none"
    },
    onChange: e => {
      addLocalFiles(e.target.files);
      e.target.value = "";
    }
  })), localFiles.length === 0 ? React.createElement("div", {
    className: "cn-doclib-empty",
    onClick: () => localRef.current?.click(),
    onDragOver: e => {
      e.preventDefault();
      e.currentTarget.classList.add("is-over");
    },
    onDragLeave: e => e.currentTarget.classList.remove("is-over"),
    onDrop: e => {
      e.preventDefault();
      e.currentTarget.classList.remove("is-over");
      addLocalFiles(e.dataTransfer.files);
    }
  }, "Drop a file here, or ", React.createElement("span", {
    className: "cn-rfq-drop-link"
  }, "browse"), " \u2014 attaches to this email only.") : React.createElement("div", {
    className: "cn-doclib-list"
  }, localFiles.map((f, i) => React.createElement("div", {
    key: i,
    className: "cn-doclib-item is-on"
  }, React.createElement("span", {
    className: "cn-doclib-ico",
    style: {
      marginLeft: 10
    }
  }, "\uD83D\uDCCE"), React.createElement("span", {
    className: "cn-doclib-name",
    style: {
      flex: 1
    }
  }, f.filename), React.createElement("span", {
    className: "cn-doclib-size"
  }, oFmtBytes(f.size)), React.createElement("button", {
    type: "button",
    className: "cn-doclib-x",
    onClick: () => removeLocal(f),
    title: "Remove from this email",
    "aria-label": "Remove"
  }, "\u2715"))))), React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      margin: "0 0 6px",
      color: "var(--cn-mute)"
    }
  }, "Or reuse from the company library"), React.createElement("div", {
    className: "cn-doclib"
  }, React.createElement("div", {
    className: "cn-doclib-head"
  }, React.createElement("span", {
    className: "cn-doclib-count"
  }, selectedPaths.size, " selected", docs.length ? ` of ${docs.length}` : ""), React.createElement("button", {
    type: "button",
    className: "cn-btn cn-btn--ghost cn-btn--sm",
    onClick: () => fileRef.current?.click(),
    disabled: uploading
  }, uploading ? React.createElement("span", null, React.createElement("span", {
    className: "cn-spinner"
  }), " Uploading\u2026") : "+ Upload document"), React.createElement("input", {
    ref: fileRef,
    type: "file",
    multiple: true,
    style: {
      display: "none"
    },
    onChange: e => {
      upload(e.target.files);
      e.target.value = "";
    }
  })), loading ? React.createElement("div", {
    className: "cn-doclib-empty"
  }, "Loading library\u2026") : error === "notready" ? React.createElement("div", {
    className: "cn-doclib-empty"
  }, "Document library not available.") : error ? React.createElement("div", {
    className: "cn-doclib-empty"
  }, "Couldn't load the library. Run migration 08 to enable it.", React.createElement("br", null), React.createElement("span", {
    style: {
      fontSize: 11
    }
  }, error)) : docs.length === 0 ? React.createElement("div", {
    className: "cn-doclib-empty",
    onClick: () => fileRef.current?.click(),
    onDragOver: e => {
      e.preventDefault();
      e.currentTarget.classList.add("is-over");
    },
    onDragLeave: e => e.currentTarget.classList.remove("is-over"),
    onDrop: e => {
      e.preventDefault();
      e.currentTarget.classList.remove("is-over");
      upload(e.dataTransfer.files);
    }
  }, "No documents yet. ", React.createElement("span", {
    className: "cn-rfq-drop-link"
  }, "Upload one"), " to share it with the team.") : React.createElement("div", {
    className: "cn-doclib-list"
  }, docs.map(doc => React.createElement("div", {
    key: doc.id,
    className: `cn-doclib-item ${selectedPaths.has(doc.path) ? "is-on" : ""}`
  }, React.createElement("label", {
    className: "cn-doclib-pick"
  }, React.createElement("input", {
    type: "checkbox",
    checked: selectedPaths.has(doc.path),
    onChange: () => toggle(doc)
  }), React.createElement("span", {
    className: "cn-doclib-ico"
  }, "\uD83D\uDCCE"), React.createElement("span", {
    className: "cn-doclib-name"
  }, doc.name)), React.createElement("span", {
    className: "cn-doclib-size"
  }, oFmtBytes(doc.size)), doc.uploadedBy && React.createElement("span", {
    className: "cn-doclib-by"
  }, doc.uploadedBy), React.createElement("button", {
    type: "button",
    className: "cn-doclib-x",
    onClick: () => removeDoc(doc),
    title: "Remove company-wide",
    "aria-label": "Remove"
  }, "\u2715"))))));
}
function CampaignBuilder({
  scenario,
  currentUser,
  onClose,
  onSaved,
  initialManualIds
}) {
  var [step, setStep] = useState(0);
  var [sending, setSending] = useState(false);
  var [sentResult, setSentResult] = useState(null);
  var [c, setC] = useState({
    id: newId("c"),
    name: "Untitled campaign",
    audienceMode: initialManualIds && initialManualIds.length > 0 ? "manual" : "manual",
    manualIds: initialManualIds || [],
    accountIds: [],
    listIds: [],
    sendAs: {
      mode: "me",
      repId: ""
    },
    audience: {
      warmOnly: false,
      tiers: [],
      industries: [],
      hasEmail: true
    },
    subject: "",
    fromName: (window.cnSafeSenderName ? window.cnSafeSenderName(currentUser) : (currentUser?.fullName || currentUser?.name || "")),
    replyTo: currentUser?.email || "",
    preheader: "",
    body: "Hi {{first_name}},\n\n",
    imageUrl: "",
    attachments: [],
    ctaText: "",
    ctaUrl: "",
    status: "draft",
    sentAt: null,
    events: [],
    createdAt: new Date().toISOString()
  });
  var update = patch => setC(cc => ({
    ...cc,
    ...patch
  }));
  var updateAudience = patch => setC(cc => ({
    ...cc,
    audience: {
      ...cc.audience,
      ...patch
    }
  }));
  var [coRows, setCoRows] = useState([]);
  var companyMatches = coRows.map(r => ({
    id: r.contact_id,
    name: r.full_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
    email: r.email,
    title: r.title || "",
    accountId: r.account_id,
    companyName: r.company || r.account_name || "",
    _first: r.first_name || "",
    _last: r.last_name || ""
  }));
  var matches = c.audienceMode === "companies" ? companyMatches : c.audienceMode === "manual" ? scenario.contacts.filter(x => c.manualIds.includes(x.id) && (c.audience.hasEmail === false || x.email) && !(window.isEmailOptedOut && window.isEmailOptedOut(x))) : applyAudience(c.audience, scenario);
  var industries = [...new Set(scenario.accounts.map(a => a.industry).filter(Boolean))].sort();
  var [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  var applyTemplate = t => {
    if (!t) return;
    update({
      subject: t.subject || c.subject,
      body: t.body || c.body,
      design: t.design || null,
      templateId: t.id,
      html: t.design && window.cnEmail ? window.cnEmail.renderHtml(t.design, {
        forExport: true,
        keepTokens: true
      }) : t.html || null
    });
    setTemplatePickerOpen(false);
  };
  // Pre-send checks, at the moment of sending. The panel was always available
  // and therefore always skippable; on a 250-recipient send the cost of
  // skipping is 250 copies of the same mistake. Failures are named and must be
  // acknowledged explicitly — never silently blocked, because a rep with a
  // deadline will always have a reason we did not anticipate.
  var preSendBlockers = () => {
    try {
      if (!window.cnEmail || !window.EdPreSendIssues) return [];
      var tpl = (window.cnTemplateStore.read() || []).find(t => t.id === c.templateId);
      var design = tpl && tpl.design ? tpl.design : null;
      if (!design) return [];
      return window.EdPreSendIssues(Object.assign({}, design, {
        subject: c.subject || design.subject, preheader: c.preheader || design.preheader,
      }), tpl) || [];
    } catch (e) { return []; }
  };
  var send = async () => {
    if (sending) return;
    var _issues = preSendBlockers();
    if (_issues.length) {
      var _lines = _issues.slice(0, 8).map(i => "• " + i.t + (i.d ? "\n    " + i.d : "")).join("\n");
      var _more = _issues.length > 8 ? "\n…and " + (_issues.length - 8) + " more." : "";
      var _n = matches.length || 0;
      if (!confirm(
        _issues.length + " issue" + (_issues.length === 1 ? "" : "s") + " found in this email:\n\n"
        + _lines + _more
        + "\n\nThis goes to " + _n + " recipient" + (_n === 1 ? "" : "s")
        + ", so each one is " + _n + " copies of the same problem.\n\nSend anyway?"
      )) return;
    }
    if (c.templateId && window.cnApproval) {
      var _gate = window.cnApproval.gate(c.templateId);
      if (_gate && !confirm(_gate + "\n\nSend anyway?")) return;
    }
    var cleanedMatches = [];
    var droppedMatches = [];
    matches.forEach(ct => {
      var raw = (ct.email == null ? "" : String(ct.email)).trim();
      if (window.isValidEmailAddress && window.isValidEmailAddress(raw)) {
        cleanedMatches.push({
          ...ct,
          email: raw
        });
      } else {
        droppedMatches.push({
          name: ct.name || "(no name)",
          email: raw || "(blank)"
        });
      }
    });
    if (cleanedMatches.length === 0) {
      var examples = droppedMatches.slice(0, 5).map(d => `• ${d.name} — ${d.email}`).join("\n");
      alert("Can't send: none of the recipients have a valid email address.\n\n" + "Resend needs each address to look like name@domain.com (no spaces, " + "no multiple emails in one field, must contain @ and a dot).\n\n" + (droppedMatches.length ? `First few dropped:\n${examples}` : ""));
      return;
    }
    if (droppedMatches.length > 0) {
      var _examples = droppedMatches.slice(0, 8).map(d => `• ${d.name} — ${d.email}`).join("\n");
      var moreNote = droppedMatches.length > 8 ? `\n…and ${droppedMatches.length - 8} more.` : "";
      var proceed = confirm(`${droppedMatches.length} recipient${droppedMatches.length === 1 ? "" : "s"} ` + `have invalid email addresses and will be SKIPPED:\n\n` + _examples + moreNote + `\n\nSend to the remaining ${cleanedMatches.length} valid recipient${cleanedMatches.length === 1 ? "" : "s"}?\n\n` + `(Fix the invalid ones in the prospect list / contacts, then re-send.)`);
      if (!proceed) return;
    }
    setSending(true);
    var recipients = cleanedMatches.map(ct => ({
      contactId: ct.id,
      email: ct.email,
      accountId: ct.accountId || null,
      ctx: {
        first_name: ct._first || (ct.name || "").split(" ")[0],
        last_name: ct._last != null && ct._last !== "" ? ct._last : (ct.name || "").split(" ").slice(1).join(" "),
        company: ct.companyName || window.accountOf(ct.accountId, scenario)?.name || "",
        title: ct.title || "",
        sender_name: currentUser?.fullName || currentUser?.name || "",
        contact_id: ct.id,
        email: ct.email,
        campaign_id: c.id
      }
    }));
    var finalC = {
      ...c,
      replyTo: c.replyTo || currentUser?.email || undefined,
      recipients,
      senderEmail: currentUser?.email || null,
      status: "sent",
      sentAt: new Date().toISOString()
    };
    if (c.design && window.cnEmail?.renderForSend) {
      try {
        var _rs = await window.cnEmail.renderForSend(c.design, { keepTokens: true });
        finalC.html = _rs.html;
        if (_rs.changed) { finalC.design = _rs.design; update({ design: _rs.design }); }
      } catch (err) { console.error("Image hosting failed before send:", err); }
    }
    var attachmentRefs = Array.isArray(c.attachments) ? c.attachments : [];
    var resolvedAttachments = [];
    if (attachmentRefs.length > 0) {
      try {
        resolvedAttachments = await Promise.all(attachmentRefs.map(async a => {
          if (a.local && a.content) return {
            filename: a.filename,
            content: a.content
          };
          if (window.cnDocs) return await window.cnDocs.fetchBase64(a.path, a.filename);
          throw new Error(`Can't attach "${a.filename}" — the document library isn't available.`);
        }));
      } catch (err) {
        alert("Couldn't prepare attachments:\n\n" + (err.message || err) + "\n\nRe-check your attachments and try again.");
        setSending(false);
        return;
      }
    }
    var sig = (c.signature != null ? c.signature : readSignature()).trim();
    if (sig && !finalC.body.includes(sig)) {
      finalC.body = (finalC.body || "").replace(/\s+$/, "") + "\n\n" + sig;
    }
    if (window.cnSendAs) {
      var sendRep = window.cnSendAs.apply(finalC, recipients, c.sendAs, scenario, currentUser);
      if (sendRep.missingEmail.length) {
        if (!confirm("No email address on file for: " + sendRep.missingEmail.slice(0, 5).join(", ") + ".\n\nThe campaign will still be sent in their name, but replies will come to the sales inbox instead of them.\n\nSend anyway?")) {
          setSending(false);
          return;
        }
      }
      if (sendRep.mode === "owner" && sendRep.fellBack > 0) {
        if (!confirm(sendRep.fellBack + " recipient" + (sendRep.fellBack === 1 ? "" : "s") + " belong to accounts with no owner, so they'll come from you instead.\n\nSend anyway?")) {
          setSending(false);
          return;
        }
      }
    }
    var viaResend = false;
    if (window.SEND_VIA_RESEND) {
      try {
        var result = await window.sendCampaignViaResend({
          ...finalC,
          attachments: resolvedAttachments
        }, recipients);
        finalC.events = [];
        finalC.viaResend = true;
        viaResend = true;
        console.log("Resend send result:", result);
        var failed = result && result.failed || 0;
        var skippedList = result && result.skipped || [];
        if (failed || skippedList.length) {
          var list = [].concat((result.failures || []).map(f => `• ${f.email} — rejected by Resend`)).concat(skippedList.map(s => `• ${s.email} — ${s.reason}`)).slice(0, 10).join("\n");
          alert(`Sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"}.\n\n${failed + skippedList.length} did NOT receive it:\n\n${list}` + (failed + skippedList.length > 10 ? "\n…and more (see the function logs)." : ""));
        }
      } catch (err) {
        var msg = err.message || "";
        try {
          if (err.context && typeof err.context.json === "function") {
            var body = await err.context.json();
            msg = body.error + (body.details ? " — " + JSON.stringify(body.details) : "");
          }
        } catch {}
        if (!msg) msg = "Unknown error. Open browser console + Supabase Edge Functions logs.";
        console.error("Resend send failed:", err, msg);
        alert("NOTHING WAS SENT.\n\nResend rejected the send:\n\n" + msg + "\n\nThe campaign has been kept as a draft so you can fix the problem and send again.\n\nCheck Supabase Dashboard → Edge Functions → send-campaign → Logs for details.");
        setSending(false);
        return;
      }
    } else {
      finalC.events = simulateSend(finalC);
    }
    finalC.attachments = attachmentRefs.map(a => a.local ? {
      local: true,
      filename: a.filename,
      size: a.size,
      type: a.type
    } : {
      docId: a.docId,
      path: a.path,
      filename: a.filename,
      size: a.size,
      type: a.type
    });
    saveCampaign(finalC);
    setSending(false);
    setSentResult({
      count: recipients.length,
      viaResend,
      campaign: finalC
    });
  };
  var finish = () => {
    if (sentResult) onSaved(sentResult.campaign);
  };
  var stepNames = ["Audience", "Content", "Review"];
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose,
    style: {
      zIndex: 160
    }
  }, React.createElement("div", {
    className: "cn-modal cn-camp-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "New email campaign \xB7 step ", step + 1, " of 3"), React.createElement("input", {
    className: "cn-input cn-quote-num",
    value: c.name,
    onChange: e => update({
      name: e.target.value
    })
  })), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-camp-steps"
  }, stepNames.map((s, i) => React.createElement("div", {
    key: s,
    className: `cn-camp-step ${i === step ? "is-current" : i < step ? "is-done" : ""}`,
    onClick: () => i < step && setStep(i)
  }, React.createElement("span", {
    className: "cn-camp-step-num"
  }, i < step ? "✓" : i + 1), React.createElement("span", null, s)))), React.createElement("div", {
    className: "cn-modal-body cn-camp-body"
  }, step === 0 && React.createElement(Fragment, null, React.createElement("div", {
    className: "cn-camp-mode"
  }, React.createElement("button", {
    className: `cn-camp-mode-tab ${c.audienceMode === "manual" ? "is-active" : ""}`,
    onClick: () => update({
      audienceMode: "manual"
    })
  }, React.createElement("div", {
    className: "cn-camp-mode-name"
  }, "Pick recipients"), React.createElement("div", {
    className: "cn-camp-mode-sub"
  }, "Hand-select specific contacts or paste in prospects")), React.createElement("button", {
    className: `cn-camp-mode-tab ${c.audienceMode === "companies" ? "is-active" : ""}`,
    onClick: () => update({
      audienceMode: "companies"
    })
  }, React.createElement("div", {
    className: "cn-camp-mode-name"
  }, "Lists & companies"), React.createElement("div", {
    className: "cn-camp-mode-sub"
  }, "Prospecting lists and whole companies, de-duped")), React.createElement("button", {
    className: `cn-camp-mode-tab ${c.audienceMode === "filter" ? "is-active" : ""}`,
    onClick: () => update({
      audienceMode: "filter"
    })
  }, React.createElement("div", {
    className: "cn-camp-mode-name"
  }, "Filter contacts"), React.createElement("div", {
    className: "cn-camp-mode-sub"
  }, "Send to everyone matching a set of rules"))), c.audienceMode === "companies" && (window.CnRecipientSources ? React.createElement(window.CnRecipientSources, {
    accountIds: c.accountIds || [],
    listIds: c.listIds || [],
    onChange: (sel, rows) => {
      update({ accountIds: sel.accountIds, listIds: sel.listIds });
      setCoRows(rows || []);
    }
  }) : React.createElement("div", {
    className: "cn-camp-co-err"
  }, "List and company sending isn't available in this build.")), c.audienceMode === "manual" && React.createElement(ManualRecipientPicker, {
    scenario: scenario,
    manualIds: c.manualIds,
    onChange: ids => update({
      manualIds: ids
    }),
    onAddProspect: prospect => {
      var pid = "prospect-" + Math.random().toString(36).slice(2, 9);
      scenario.contacts.push({
        id: pid,
        name: prospect.name,
        email: prospect.email,
        title: prospect.note || "Prospect",
        accountId: null,
        tier: "Influencer"
      });
      update({
        manualIds: [...c.manualIds, pid]
      });
    }
  }), c.audienceMode === "filter" && React.createElement(Fragment, null, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Audience filter"), React.createElement("div", {
    className: "cn-camp-audience"
  }, React.createElement("label", {
    className: "cn-camp-check"
  }, React.createElement("input", {
    type: "checkbox",
    checked: c.audience.warmOnly,
    onChange: e => updateAudience({
      warmOnly: e.target.checked
    })
  }), React.createElement("span", null, "Warm leads only ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)"
    }
  }, "(", readWarmLeads().size, " flagged)"))), React.createElement("label", {
    className: "cn-camp-check"
  }, React.createElement("input", {
    type: "checkbox",
    checked: c.audience.hasEmail !== false,
    onChange: e => updateAudience({
      hasEmail: e.target.checked
    })
  }), React.createElement("span", null, "Has email address")))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Contact tier"), React.createElement("div", {
    className: "cn-chip-row"
  }, ["Champion", "Decision Maker", "Influencer", "Gatekeeper"].map(t => React.createElement("button", {
    key: t,
    className: `cn-chip-btn ${c.audience.tiers.includes(t) ? "is-active" : ""}`,
    onClick: () => updateAudience({
      tiers: c.audience.tiers.includes(t) ? c.audience.tiers.filter(x => x !== t) : [...c.audience.tiers, t]
    })
  }, t)))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Industry"), React.createElement("div", {
    className: "cn-chip-row"
  }, industries.map(i => React.createElement("button", {
    key: i,
    className: `cn-chip-btn ${c.audience.industries.includes(i) ? "is-active" : ""}`,
    onClick: () => updateAudience({
      industries: c.audience.industries.includes(i) ? c.audience.industries.filter(x => x !== i) : [...c.audience.industries, i]
    })
  }, i))))), React.createElement("div", {
    className: "cn-camp-match"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Recipients"), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 14,
      marginTop: 6
    }
  }, React.createElement("div", {
    style: {
      fontFamily: "var(--cn-serif)",
      fontSize: 44,
      lineHeight: 1,
      color: "var(--cn-copper)"
    }
  }, matches.length), React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 13
    }
  }, c.audienceMode === "manual" ? "hand-picked" : c.audienceMode === "companies" ? `from ${((c.accountIds || []).length ? 1 : 0) + ((c.listIds || []).length ? 1 : 0)} source${((c.accountIds || []).length ? 1 : 0) + ((c.listIds || []).length ? 1 : 0) === 1 ? "" : "s"}, de-duped` : `of ${scenario.contacts.length} contacts`)), matches.length > 0 && React.createElement("div", {
    className: "cn-stack-avatars",
    style: {
      marginTop: 12
    }
  }, matches.slice(0, 8).map(m => React.createElement("span", {
    key: m.id,
    className: "cn-avatar cn-avatar--xs"
  }, m.name.split(" ").map(n => n[0]).join("").slice(0, 2))), matches.length > 8 && React.createElement("span", {
    className: "cn-avatar cn-avatar--xs cn-avatar--more"
  }, "+", matches.length - 8)))), step === 1 && React.createElement(Fragment, null, React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      marginBottom: 18,
      alignItems: "center"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setTemplatePickerOpen(true)
  }, "\u21BA Start from template"), React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12.5
    }
  }, "Or write from scratch below.")), window.CnSendAsPicker && React.createElement(window.CnSendAsPicker, {
    value: c.sendAs,
    currentUser: currentUser,
    onChange: sa => {
      var rep = sa.mode === "rep" && window.cnSendAs ? window.cnSendAs.repById(sa.repId) : null;
      update({
        sendAs: sa,
        fromName: rep ? rep.name : sa.mode === "owner" ? "" : ((window.cnSafeSenderName ? window.cnSafeSenderName(currentUser) : (currentUser?.fullName || currentUser?.name || "")) || c.fromName)
      });
    }
  }), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "From name", c.sendAs?.mode === "owner" ? React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\u00B7 set per recipient from the account owner") : null), React.createElement("input", {
    className: "cn-input",
    value: c.fromName,
    disabled: c.sendAs?.mode === "owner",
    onChange: e => update({
      fromName: e.target.value
    }),
    placeholder: "Your name"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 2
    }
  }, React.createElement("label", null, "Subject line"), React.createElement("input", {
    className: "cn-input",
    value: c.subject,
    onChange: e => update({
      subject: e.target.value
    }),
    placeholder: "Quick question about sourcing \u2014 {{company}}"
  }))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Preheader ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 The preview text shown in inbox")), React.createElement("input", {
    className: "cn-input",
    value: c.preheader,
    onChange: e => update({
      preheader: e.target.value
    }),
    placeholder: "A line that nudges people to open\u2026"
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Hero image URL ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 Optional. Paste a URL or upload to your CDN.")), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12
    },
    value: c.imageUrl,
    onChange: e => update({
      imageUrl: e.target.value
    }),
    placeholder: "https://..."
  })), React.createElement(CampaignAttachments, {
    attachments: c.attachments,
    onChange: a => update({
      attachments: a
    }),
    currentUser: currentUser
  }), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Body"), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 220
    },
    value: c.body,
    onChange: e => update({
      body: e.target.value
    })
  })), React.createElement(SignatureField, {
    value: c.signature != null ? c.signature : readSignature(),
    onChange: (sig, saveAsDefault) => {
      update({
        signature: sig
      });
      if (saveAsDefault) writeSignature(sig);
    }
  }), React.createElement("div", {
    className: "cn-merge-help"
  }, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Merge fields"), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 6
    }
  }, ["first_name", "last_name", "company", "title", "sender_name"].map(f => React.createElement("button", {
    key: f,
    className: "cn-chip-btn",
    onClick: () => update({
      body: c.body + ` {{${f}}}`
    })
  }, `{{${f}}}`)))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "CTA button text"), React.createElement("input", {
    className: "cn-input",
    value: c.ctaText,
    onChange: e => update({
      ctaText: e.target.value
    }),
    placeholder: "Book a 15-minute call"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 2
    }
  }, React.createElement("label", null, "CTA URL"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12
    },
    value: c.ctaUrl,
    onChange: e => update({
      ctaUrl: e.target.value
    }),
    placeholder: "https://..."
  })))), step === 2 && React.createElement(Fragment, null, React.createElement("div", {
    className: "cn-camp-review-strip"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-strip-label"
  }, "Recipients"), React.createElement("div", {
    className: "cn-strip-value"
  }, matches.length)), React.createElement("div", null, React.createElement("div", {
    className: "cn-strip-label"
  }, "From"), React.createElement("div", {
    className: "cn-strip-value",
    style: {
      fontSize: 14
    }
  }, c.fromName || "—")), React.createElement("div", null, React.createElement("div", {
    className: "cn-strip-label"
  }, "Subject"), React.createElement("div", {
    className: "cn-strip-value",
    style: {
      fontSize: 13
    }
  }, c.subject || "—"))), React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginTop: 18,
      marginBottom: 8
    }
  }, "Email preview"), React.createElement(EmailPreview, {
    campaign: c,
    sampleContact: matches[0],
    scenario: scenario,
    currentUser: currentUser
  }), (c.attachments || []).length > 0 && React.createElement("div", {
    className: "cn-camp-review-attach"
  }, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginBottom: 8
    }
  }, "Attachments \xB7 ", c.attachments.length), React.createElement("div", {
    className: "cn-rfq-files"
  }, c.attachments.map((a, i) => React.createElement("div", {
    key: i,
    className: "cn-rfq-file"
  }, React.createElement("span", {
    className: "cn-rfq-file-ico"
  }, "\uD83D\uDCCE"), React.createElement("span", {
    className: "cn-rfq-file-name"
  }, a.filename), React.createElement("span", {
    className: "cn-rfq-file-size"
  }, oFmtBytes(a.size)))))))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, sentResult ? React.createElement(Fragment, null, React.createElement("div", {
    style: {
      flex: 1,
      color: "var(--cn-pos)",
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, React.createElement("span", {
    className: "cn-success-tick"
  }, "\u2713"), "Sent to ", sentResult.count, " ", sentResult.count === 1 ? "recipient" : "recipients", ". ", sentResult.viaResend ? "Tracking opens & clicks now." : ""), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: finish
  }, "View analytics \u2192")) : React.createElement(Fragment, null, step > 0 ? React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setStep(step - 1),
    disabled: sending
  }, "\u2190 Back") : React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose,
    disabled: sending
  }, "Cancel"), React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 8
    }
  }, step < 2 && React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setStep(step + 1),
    disabled: step === 0 && matches.length === 0
  }, "Next: ", stepNames[step + 1], " \u2192"), step === 2 && React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: send,
    disabled: sending || matches.length === 0 || !c.subject
  }, sending ? React.createElement(Fragment, null, React.createElement("span", {
    className: "cn-spinner"
  }), "Sending\u2026") : React.createElement(Fragment, null, "Send to ", matches.length, " ", matches.length === 1 ? "recipient" : "recipients", " \u2192")))))), templatePickerOpen && React.createElement(TemplatePicker, {
    onClose: () => setTemplatePickerOpen(false),
    onPick: applyTemplate
  }));
}
function EmailPreview({
  campaign,
  sampleContact,
  scenario,
  currentUser
}) {
  var ctx = sampleContact ? {
    first_name: (sampleContact.name || "").split(" ")[0],
    last_name: (sampleContact.name || "").split(" ").slice(1).join(" "),
    company: window.accountOf(sampleContact.accountId, scenario)?.name || "",
    title: sampleContact.title || "",
    sender_name: (window.cnSafeSenderName ? window.cnSafeSenderName(currentUser) : (currentUser?.fullName || currentUser?.name || "")) || campaign.fromName || "",
    contact_id: sampleContact.id,
    email: sampleContact.email,
    campaign_id: campaign.id
  } : {
    first_name: "Friend",
    company: "Acme Corp",
    sender_name: campaign.fromName || "You"
  };
  var subject = mergeFields(campaign.subject, ctx);
  var body = mergeFields(campaign.body, ctx);
  return React.createElement("div", {
    className: "cn-email-preview"
  }, React.createElement("div", {
    className: "cn-email-header"
  }, React.createElement("div", null, React.createElement("span", {
    className: "cn-email-from"
  }, campaign.fromName || "Sender name"), " ", React.createElement("span", {
    className: "cn-email-to"
  }, "to ", sampleContact?.email || "recipient@example.com")), React.createElement("div", {
    className: "cn-email-subject"
  }, subject || "(no subject)"), campaign.preheader && React.createElement("div", {
    className: "cn-email-preheader"
  }, campaign.preheader)), React.createElement("div", {
    className: "cn-email-body"
  }, campaign.imageUrl && React.createElement("div", {
    className: "cn-email-image"
  }, React.createElement("img", {
    src: campaign.imageUrl,
    alt: "",
    onError: e => {
      e.target.style.display = "none";
      e.target.nextSibling.style.display = "block";
    }
  }), React.createElement("div", {
    className: "cn-email-image-fallback"
  }, "\u229E Hero image (couldn't load preview \u2014 will still send)")), React.createElement("div", {
    className: "cn-email-text"
  }, body || "(empty body)"), campaign.ctaText && React.createElement("div", {
    style: {
      textAlign: "center",
      margin: "24px 0 8px"
    }
  }, React.createElement("a", {
    href: campaign.ctaUrl || "#",
    className: "cn-email-cta",
    onClick: e => e.preventDefault()
  }, campaign.ctaText)), React.createElement("div", {
    className: "cn-email-foot"
  }, "Chief Negotiators \xB7 ", React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault()
  }, "Unsubscribe"))));
}
function CampaignDetail({
  campaign: campaignProp,
  scenario,
  onClose,
  onDelete
}) {
  var [campaign, setCampaign] = useState(campaignProp);
  var [pollError, setPollError] = useState(null);
  var [heatOpen, setHeatOpen] = useState(false);
  useEffect(() => {
    var mounted = true;
    var pull = async () => {
      if (!window.loadCampaignEvents) return;
      try {
        var _events = await window.loadCampaignEvents(campaignProp.id);
        if (!mounted) return;
        var merged = {
          ...campaignProp,
          events: _events,
          viaResend: true
        };
        setCampaign(merged);
        saveCampaign(merged);
        setPollError(null);
      } catch (e) {
        if (!mounted) return;
        console.error("loadCampaignEvents failed:", e);
        setPollError(e.message || String(e));
      }
    };
    pull();
    var id = setInterval(pull, 6000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [campaignProp.id]);
  var s = campaignStats(campaign);
  var events = (campaign.events || []).filter(e => new Date(e.at).getTime() <= Date.now()).sort((a, b) => new Date(b.at) - new Date(a.at));
  var byContact = {};
  (campaign.recipients || []).forEach(r => {
    byContact[r.contactId] = {
      contactId: r.contactId,
      opened: false,
      openedAt: null,
      firstOpenAt: null,
      lastOpenAt: null,
      opens: 0,
      clicked: false,
      clickedAt: null,
      clicks: 0,
      replied: false,
      bounced: false
    };
  });
  events.forEach(e => {
    var b = byContact[e.contactId];
    if (!b) return;
    if (e.type === "opened") {
      var t = new Date(e.at).getTime();
      b.opens++;
      b.opened = true;
      if (!b.firstOpenAt || t < new Date(b.firstOpenAt).getTime()) b.firstOpenAt = e.at;
      if (!b.lastOpenAt || t > new Date(b.lastOpenAt).getTime()) b.lastOpenAt = e.at;
      b.openedAt = b.firstOpenAt;
    }
    if (e.type === "clicked") {
      b.clicks++;
      b.clicked = true;
      b.clickedAt = e.at;
    }
    if (e.type === "replied") b.replied = true;
    if (e.type === "bounced") b.bounced = true;
  });
  var engaged = Object.values(byContact).filter(b => b.opened || b.clicked).sort((a, b) => {
    var rank = b => (b.clicked ? 2 : 0) + (b.opened ? 1 : 0);
    return rank(b) - rank(a);
  });
  var buckets = new Array(24).fill(0);
  var sentTime = new Date(campaign.sentAt || Date.now()).getTime();
  events.filter(e => e.type === "opened").forEach(e => {
    var hoursSinceSend = Math.floor((new Date(e.at).getTime() - sentTime) / 3_600_000);
    if (hoursSinceSend >= 0 && hoursSinceSend < 24) buckets[hoursSinceSend]++;
  });
  var maxBucket = Math.max(...buckets, 1);
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose,
    style: {
      zIndex: 160
    }
  }, React.createElement("div", {
    className: "cn-modal cn-camp-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Campaign analytics"), React.createElement("h2", {
    className: "cn-modal-title"
  }, campaign.name), React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12.5,
      marginTop: 4
    }
  }, campaign.subject, " \xB7 sent ", timeAgoSimple(campaign.sentAt))), campaign.design && window.EdHeatmapModal && React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: { marginLeft: "auto", marginRight: 10 },
    title: "Where this email was clicked, drawn on the email itself",
    onClick: () => setHeatOpen(true)
  }, "Click heatmap"), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), heatOpen && window.EdHeatmapModal && React.createElement(window.EdHeatmapModal, {
    design: campaign.design,
    campaigns: [campaign],
    onClose: () => setHeatOpen(false)
  }), React.createElement("div", {
    className: "cn-modal-body"
  }, pollError && React.createElement("div", {
    className: "cn-login-error",
    style: {
      marginBottom: 18
    }
  }, React.createElement("strong", null, "Couldn't load events from Supabase:"), " ", pollError, React.createElement("div", {
    style: {
      marginTop: 4,
      fontSize: 11.5,
      opacity: 0.8
    }
  }, "This usually means a row-level security policy is blocking reads. Run the SQL in ", React.createElement("span", {
    className: "cn-mono"
  }, "supabase/migrations/01_campaigns.sql"), " if you haven't.")), React.createElement("section", {
    className: "cn-kpi-row",
    style: {
      marginBottom: 22
    }
  }, React.createElement("div", {
    className: "cn-kpi cn-kpi--hero"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, "Open rate"), React.createElement("div", {
    className: "cn-kpi-value"
  }, (s.openRate * 100).toFixed(1), React.createElement("span", {
    className: "cn-kpi-unit"
  }, "%")), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", null, s.uniqueOpens, " of ", s.delivered, " delivered", s.opens > s.uniqueOpens ? ` · ${s.opens} total opens` : ""))), React.createElement("div", {
    className: "cn-kpi"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, "Click rate"), React.createElement("div", {
    className: "cn-kpi-value cn-kpi-value--copper"
  }, (s.clickRate * 100).toFixed(1), React.createElement("span", {
    className: "cn-kpi-unit"
  }, "%")), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", null, s.uniqueClicks, " unique clicks"))), React.createElement("div", {
    className: "cn-kpi"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, "Deliverability"), React.createElement("div", {
    className: "cn-kpi-value"
  }, s.delivered, React.createElement("span", {
    className: "cn-kpi-unit"
  }, "/", s.sent)), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", null, s.bounced, " bounced \xB7 ", s.unsubbed, " unsub")))), React.createElement("div", {
    className: "cn-grid-2"
  }, React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Opens \xB7 first 24 hours"), React.createElement("h2", {
    className: "cn-card-title"
  }, "When opens happen"))), React.createElement("div", {
    className: "cn-camp-chart"
  }, buckets.map((b, i) => React.createElement("div", {
    key: i,
    className: "cn-camp-chart-col"
  }, React.createElement("div", {
    className: "cn-camp-chart-bar",
    style: {
      height: `${b / maxBucket * 100}%`
    },
    title: `${b} opens at hour ${i}`
  })))), React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      color: "var(--cn-mute)",
      fontSize: 11,
      marginTop: 8
    }
  }, React.createElement("span", null, "0h"), React.createElement("span", null, "6h"), React.createElement("span", null, "12h"), React.createElement("span", null, "18h"), React.createElement("span", null, "24h"))), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Most engaged"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Top responders"))), engaged.length === 0 ? React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 13,
      padding: "8px 0"
    }
  }, "No engagement yet \u2014 give it a few minutes.") : React.createElement("ul", {
    className: "cn-tasks"
  }, engaged.slice(0, 6).map(b => {
    var c = scenario.contacts.find(x => x.id === b.contactId);
    if (!c) return null;
    return React.createElement("li", {
      key: b.contactId,
      className: "cn-task",
      style: {
        alignItems: "center"
      }
    }, React.createElement("span", {
      className: "cn-avatar"
    }, c.name.split(" ").map(n => n[0]).join("").slice(0, 2)), React.createElement("div", {
      style: {
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        fontWeight: 500,
        fontSize: 13
      }
    }, c.name), React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: "var(--cn-mute)"
      }
    }, c.title, " \xB7 ", window.accountOf(c.accountId, scenario)?.name)), React.createElement("div", {
      style: {
        display: "flex",
        gap: 4,
        alignItems: "center"
      }
    }, b.opens > 1 && React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        color: "var(--cn-copper)"
      },
      title: "Times opened"
    }, b.opens, "\xD7 opens"), b.clicked && React.createElement("span", {
      className: "cn-q-pill cn-q-viewed"
    }, "Clicked"), b.opened && !b.clicked && React.createElement("span", {
      className: "cn-q-pill cn-q-sent"
    }, "Opened")));
  })))), React.createElement("section", {
    className: "cn-card",
    style: {
      marginTop: 22
    }
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "All recipients"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Engagement log"))), React.createElement("table", {
    className: "cn-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Contact"), React.createElement("th", null, "Account"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Opens"), React.createElement("th", null, "Last open"), React.createElement("th", null, "Clicked"), React.createElement("th", null, "Status"))), React.createElement("tbody", null, Object.values(byContact).slice(0, 25).map(b => {
    var c = scenario.contacts.find(x => x.id === b.contactId);
    if (!c) return null;
    return React.createElement("tr", {
      key: b.contactId
    }, React.createElement("td", null, React.createElement("div", {
      className: "cn-row-person"
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, c.name.split(" ").map(n => n[0]).join("").slice(0, 2)), React.createElement("span", {
      style: {
        fontSize: 12.5
      }
    }, c.name))), React.createElement("td", {
      className: "cn-cell-secondary"
    }, window.accountOf(c.accountId, scenario)?.name), React.createElement("td", {
      className: "cn-mono",
      style: {
        textAlign: "right",
        fontWeight: b.opens > 1 ? 600 : 400,
        color: b.opens > 1 ? "var(--cn-copper)" : "inherit"
      },
      title: b.firstOpenAt ? `First opened ${timeAgoSimple(b.firstOpenAt)}` : ""
    }, b.opens > 0 ? `${b.opens}×` : "—"), React.createElement("td", {
      className: "cn-cell-secondary"
    }, b.lastOpenAt ? timeAgoSimple(b.lastOpenAt) : "—"), React.createElement("td", {
      className: "cn-cell-secondary"
    }, b.clickedAt ? timeAgoSimple(b.clickedAt) : "—"), React.createElement("td", null, b.bounced ? React.createElement("span", {
      className: "cn-q-pill cn-q-declined"
    }, "Bounced") : b.clicked ? React.createElement("span", {
      className: "cn-q-pill cn-q-viewed"
    }, "Clicked") : b.opened ? React.createElement("span", {
      className: "cn-q-pill cn-q-sent"
    }, "Opened") : React.createElement("span", {
      className: "cn-q-pill cn-q-draft"
    }, "Delivered")));
  }))), Object.keys(byContact).length > 25 && React.createElement("div", {
    style: {
      padding: 14,
      textAlign: "center",
      color: "var(--cn-mute)",
      fontSize: 12
    }
  }, "+ ", Object.keys(byContact).length - 25, " more recipients"))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--danger",
    onClick: () => {
      if (confirm("Delete this campaign and its analytics?")) onDelete();
    }
  }, "Delete"), React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: onClose
  }, "Done")))));
}
Object.assign(window, {
  Outreach,
  CampaignBuilder,
  CampaignDetail,
  TemplatesScreen,
  WarmLeadsScreen,
  CampaignsScreen,
  applyAudience,
  mergeFields,
  fixSalutation
});
function SignatureField({
  value,
  onChange
}) {
  var [saveAsDefault, setSaveAsDefault] = useState(false);
  return React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Signature ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 appended to every send")), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 90
    },
    value: value || "",
    onChange: e => onChange(e.target.value, saveAsDefault),
    placeholder: "— Your name\nChief Negotiators · (555) 123-4567\nyou@chiefnegotiators.com"
  }), React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginTop: 6,
      fontSize: 12.5,
      color: "var(--cn-mute)"
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: saveAsDefault,
    onChange: e => {
      setSaveAsDefault(e.target.checked);
      onChange(value || "", e.target.checked);
    }
  }), "Save as my default signature"));
}
function BannerImagePicker({
  value,
  onChange,
  label = "Banner image"
}) {
  var onFile = e => {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 1_500_000) {
      if (!confirm("This image is larger than 1.5MB and may be stripped by some email clients. Use it anyway?")) return;
    }
    var reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(f);
    e.target.value = "";
  };
  return React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, label, " ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 optional, upload or paste a URL")), React.createElement("div", {
    className: "cn-img-picker"
  }, React.createElement("div", {
    className: "cn-img-picker-thumb"
  }, value ? React.createElement("img", {
    src: value,
    alt: "banner"
  }) : React.createElement("span", null, "no image")), React.createElement("div", {
    className: "cn-img-picker-controls"
  }, React.createElement("div", {
    className: "cn-img-picker-row"
  }, React.createElement("label", {
    className: "cn-img-picker-upload"
  }, "\u2934 Upload image", React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: onFile
  })), value && React.createElement("button", {
    type: "button",
    className: "cn-img-picker-clear",
    onClick: () => onChange("")
  }, "Remove")), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12
    },
    value: value && value.startsWith("data:") ? "" : value || "",
    onChange: e => onChange(e.target.value),
    placeholder: value && value.startsWith("data:") ? "(uploaded file — replace by pasting a URL)" : "https://..."
  }))));
}
function TemplatePicker({
  onClose,
  onPick
}) {
  var list = readTemplates();
  var [q, setQ] = useState("");
  var search = q.trim().toLowerCase();
  var filtered = search ? list.filter(t => ((t.name || "") + " " + (t.subject || "") + " " + (t.body || "") + " " + (t.category || "")).toLowerCase().includes(search)) : list;
  var byCat = {};
  filtered.forEach(t => {
    (byCat[t.category || "General"] = byCat[t.category || "General"] || []).push(t);
  });
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose,
    style: {
      zIndex: 180
    }
  }, React.createElement("div", {
    className: "cn-modal",
    style: {
      maxWidth: 720,
      maxHeight: "82vh",
      display: "flex",
      flexDirection: "column"
    },
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Pick a template"), React.createElement("h2", {
    className: "cn-modal-title"
  }, "Start from template")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      overflow: "auto"
    }
  }, React.createElement("input", {
    className: "cn-input",
    placeholder: "Search by name, subject, or body\u2026",
    value: q,
    onChange: e => setQ(e.target.value),
    autoFocus: true
  }), filtered.length === 0 && React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      textAlign: "center",
      padding: 24
    }
  }, "No templates match."), Object.entries(byCat).map(([cat, ts]) => React.createElement("div", {
    key: cat
  }, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      margin: "10px 0 6px"
    }
  }, cat), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, ts.map(t => React.createElement("button", {
    key: t.id,
    className: "cn-tp-card",
    onClick: () => onPick(t)
  }, React.createElement("div", {
    className: "cn-tp-name"
  }, t.name), React.createElement("div", {
    className: "cn-tp-subject"
  }, t.subject || "—"), React.createElement("div", {
    className: "cn-tp-body"
  }, (t.body || "").slice(0, 180), (t.body || "").length > 180 ? "…" : ""), React.createElement("span", {
    className: "cn-tp-use"
  }, "Use \u2192")))))))));
}
function QuickSendModal({
  template,
  scenario,
  currentUser,
  onClose
}) {
  var [recipient, setRecipient] = useState(null);
  var [subject, setSubject] = useState(template.subject || "");
  var [body, setBody] = useState(template.body || "");
  var [imageUrl, setImageUrl] = useState(template.imageUrl || "");
  var [ctaText, setCtaText] = useState(template.ctaText || "");
  var [ctaUrl, setCtaUrl] = useState(template.ctaUrl || "");
  var [signature, setSignature] = useState(() => readSignature());
  var [saveSig, setSaveSig] = useState(false);
  var [sending, setSending] = useState(false);
  var [sent, setSent] = useState(null);
  var [sendVia, setSendVia] = useState("resend");
  var [olAcct, setOlAcct] = useState(null);
  useEffect(() => {
    var OL = window.cnEmailOutlook;
    if (!OL || !OL.available()) return;
    var on = true;
    OL.resume().then(a => {
      if (on && a) {
        setOlAcct(a);
        setSendVia("outlook");
      }
    });
    return () => {
      on = false;
    };
  }, []);
  var pickContact = c => setRecipient({
    contact: c,
    isProspect: false
  });
  var addProspect = ({
    name,
    email,
    note
  }) => {
    var pid = "prospect-" + Math.random().toString(36).slice(2, 9);
    var c = {
      id: pid,
      name,
      email,
      title: note || "Prospect",
      accountId: null,
      tier: "Influencer"
    };
    scenario.contacts.push(c);
    setRecipient({
      contact: c,
      isProspect: true
    });
  };
  var ctx = recipient ? {
    first_name: (recipient.contact.name || "").split(" ")[0],
    last_name: (recipient.contact.name || "").split(" ").slice(1).join(" "),
    company: window.accountOf(recipient.contact.accountId, scenario)?.name || "",
    title: recipient.contact.title || "",
    sender_name: currentUser?.fullName || currentUser?.name || "",
    contact_id: recipient.contact.id,
    email: recipient.contact.email
  } : {
    first_name: "Friend",
    company: "Acme Corp",
    sender_name: currentUser?.fullName || currentUser?.name || ""
  };
  var previewSubject = mergeFields(subject, ctx);
  var sigForPreview = signature.trim() ? "\n\n" + mergeFields(signature, ctx) : "";
  var previewBody = mergeFields(body, ctx) + sigForPreview;
  var send = async () => {
    if (!recipient || sending) return;
    if (saveSig) writeSignature(signature);
    setSending(true);
    var finalC = {
      id: newId("c"),
      name: template.name + " → " + recipient.contact.name,
      audienceMode: "manual",
      manualIds: [recipient.contact.id],
      audience: {
        hasEmail: true
      },
      subject,
      fromName: (window.cnSafeSenderName ? window.cnSafeSenderName(currentUser) : (currentUser?.fullName || currentUser?.name || "")),
      replyTo: currentUser?.email || undefined,
      preheader: "",
      body: body + (signature.trim() ? "\n\n" + signature : ""),
      design: template.design || null,
      templateId: template.id,
      html: template.design && window.cnEmail ? window.cnEmail.renderHtml(template.design, {
        forExport: true,
        keepTokens: true
      }) : template.html || undefined,
      imageUrl,
      ctaText,
      ctaUrl,
      signature,
      kind: "single",
      status: "sent",
      sentAt: new Date().toISOString(),
      events: [],
      createdAt: new Date().toISOString(),
      senderEmail: currentUser?.email || null,
      recipients: [{
        contactId: recipient.contact.id,
        email: recipient.contact.email,
        ctx
      }]
    };
    if (finalC.design && window.cnEmail?.renderForSend) {
      try {
        var _rs1 = await window.cnEmail.renderForSend(finalC.design, { keepTokens: true });
        finalC.html = _rs1.html;
        if (_rs1.changed) finalC.design = _rs1.design;
      } catch (err) { console.error("Image hosting failed before send:", err); }
    }
    var viaResend = false;
    var viaOutlook = false;
    if (sendVia === "outlook" && window.cnEmailOutlook) {
      try {
        const personalHtml = finalC.design && window.cnEmail ? window.cnEmail.renderHtml(finalC.design, {
          forExport: true,
          ctx
        }) : finalC.html ? mergeFields(finalC.html, ctx) : (mergeFields(finalC.body, ctx) || "").replace(/\n/g, "<br />");
        await window.cnEmailOutlook.sendMail({
          subject: mergeFields(subject, ctx),
          html: personalHtml,
          to: recipient.contact.email
        });
        finalC.viaOutlook = true;
        finalC.senderEmail = window.cnEmailOutlook.account()?.username || finalC.senderEmail;
        viaOutlook = true;
      } catch (err) {
        console.error("Outlook send failed:", err);
        alert("Outlook send failed: " + (err?.message || err));
        setSending(false);
        return;
      }
    } else if (window.SEND_VIA_RESEND) {
      try {
        await window.sendCampaignViaResend(finalC, finalC.recipients);
        finalC.viaResend = true;
        viaResend = true;
      } catch (err) {
        console.error("Resend send failed:", err);
        alert("Live send failed — falling back to simulation. Check the console for details.");
        finalC.events = simulateSend(finalC);
      }
    } else {
      finalC.events = simulateSend(finalC);
    }
    saveCampaign(finalC);
    setSending(false);
    setSent({
      viaResend,
      viaOutlook,
      to: recipient.contact
    });
  };
  return React.createElement("div", {
    className: "cn-modal-scrim",
    onClick: onClose,
    style: {
      zIndex: 180
    }
  }, React.createElement("div", {
    className: "cn-modal cn-camp-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Send email \xB7 from template"), React.createElement("h2", {
    className: "cn-modal-title"
  }, template.name)), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body cn-camp-body"
  }, !sent ? React.createElement(Fragment, null, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "To"), recipient ? React.createElement("div", {
    className: "cn-qs-to"
  }, React.createElement("span", {
    className: "cn-avatar cn-avatar--xs"
  }, recipient.contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 500
    }
  }, recipient.contact.name), React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12
    }
  }, recipient.contact.email || "no email")), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 30,
      fontSize: 12
    },
    onClick: () => setRecipient(null)
  }, "Change")) : React.createElement(QuickRecipientPicker, {
    scenario: scenario,
    onPick: pickContact,
    onAddProspect: addProspect
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Subject"), React.createElement("input", {
    className: "cn-input",
    value: subject,
    onChange: e => setSubject(e.target.value)
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Body"), React.createElement("textarea", {
    className: "cn-textarea",
    style: {
      minHeight: 200
    },
    value: body,
    onChange: e => setBody(e.target.value)
  })), React.createElement(BannerImagePicker, {
    value: imageUrl,
    onChange: setImageUrl
  }), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "CTA button text"), React.createElement("input", {
    className: "cn-input",
    value: ctaText,
    onChange: e => setCtaText(e.target.value),
    placeholder: "Book a 15-min call"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 2
    }
  }, React.createElement("label", null, "CTA URL"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12
    },
    value: ctaUrl,
    onChange: e => setCtaUrl(e.target.value),
    placeholder: "https://..."
  }))), React.createElement(SignatureField, {
    value: signature,
    onChange: (s, save) => {
      setSignature(s);
      setSaveSig(save);
    }
  }), React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginTop: 18,
      marginBottom: 8
    }
  }, "Preview"), React.createElement("div", {
    className: "cn-email-preview"
  }, React.createElement("div", {
    className: "cn-email-header"
  }, React.createElement("div", null, React.createElement("span", {
    className: "cn-email-from"
  }, currentUser?.fullName || currentUser?.name || "Sender name"), React.createElement("span", {
    className: "cn-email-to"
  }, " to ", recipient?.contact?.email || "—")), React.createElement("div", {
    className: "cn-email-subject"
  }, previewSubject || "(no subject)")), React.createElement("div", {
    className: "cn-email-body"
  }, imageUrl && React.createElement("div", {
    className: "cn-email-image"
  }, React.createElement("img", {
    src: imageUrl,
    alt: "",
    onError: e => {
      e.target.style.display = "none";
      e.target.nextSibling.style.display = "block";
    }
  }), React.createElement("div", {
    className: "cn-email-image-fallback"
  }, "\u229E Banner image (preview failed \u2014 will still send)")), React.createElement("div", {
    className: "cn-email-text"
  }, previewBody || "(empty body)"), ctaText && React.createElement("div", {
    style: {
      textAlign: "center",
      margin: "24px 0 8px"
    }
  }, React.createElement("a", {
    href: ctaUrl || "#",
    className: "cn-email-cta",
    onClick: e => e.preventDefault()
  }, ctaText))))) : React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 10px"
    }
  }, React.createElement("div", {
    className: "cn-success-tick",
    style: {
      display: "inline-flex",
      marginBottom: 14,
      width: 48,
      height: 48,
      fontSize: 22
    }
  }, "\u2713"), React.createElement("h3", {
    style: {
      fontFamily: "var(--cn-serif)",
      fontSize: 24,
      margin: "0 0 8px"
    }
  }, "Email sent to ", sent.to.name), React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 13
    }
  }, sent.viaOutlook ? "Sent from your Outlook mailbox — a copy is in your Sent Items and replies come straight to you." : sent.viaResend ? "Delivered live via Resend — tracking opens and clicks." : "Simulated send — analytics will appear in Campaigns."))), React.createElement("footer", {
    className: "cn-modal-foot"
  }, !sent ? React.createElement(Fragment, null, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onClose,
    disabled: sending
  }, "Cancel"), olAcct && React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginLeft: 14
    }
  }, React.createElement("span", {
    className: "cn-card-eyebrow"
  }, "Send from"), React.createElement("select", {
    className: "cn-input",
    style: {
      width: "auto",
      maxWidth: 230,
      height: 32,
      fontSize: 12.5
    },
    value: sendVia,
    onChange: e => setSendVia(e.target.value),
    title: "A 1:1 email from your own mailbox threads properly and replies come back to you. The sending domain adds open and click tracking."
  }, React.createElement("option", {
    value: "outlook"
  }, olAcct.username || "My Outlook mailbox"), React.createElement("option", {
    value: "resend"
  }, "Marketing domain \u00b7 tracked"))), React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: send,
    disabled: sending || !recipient || !subject || !body,
    title: !recipient ? "Pick a recipient first" : ""
  }, sending ? React.createElement(Fragment, null, React.createElement("span", {
    className: "cn-spinner"
  }), "Sending\u2026") : "Send email →"))) : React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      marginLeft: "auto"
    },
    onClick: onClose
  }, "Done"))));
}
function QuickRecipientPicker({
  scenario,
  onPick,
  onAddProspect
}) {
  var [q, setQ] = useState("");
  var [showProspect, setShowProspect] = useState(false);
  var [pn, setPn] = useState("");
  var [pe, setPe] = useState("");
  var search = q.trim().toLowerCase();
  var matches = search ? scenario.contacts.filter(c => (c.name || "").toLowerCase().includes(search) || (c.email || "").toLowerCase().includes(search) || (window.accountOf(c.accountId, scenario)?.name || "").toLowerCase().includes(search)).slice(0, 8) : [];
  if (showProspect) {
    return React.createElement("form", {
      onSubmit: e => {
        e.preventDefault();
        if (!pn.trim() || !pe.trim()) return;
        if (!/.+@.+\..+/.test(pe)) {
          alert("Enter a valid email");
          return;
        }
        onAddProspect({
          name: pn.trim(),
          email: pe.trim()
        });
        setShowProspect(false);
      },
      className: "cn-rp-prospect-form"
    }, React.createElement("div", {
      className: "cn-card-eyebrow",
      style: {
        marginBottom: 8
      }
    }, "One-off prospect"), React.createElement("div", {
      className: "cn-field-row"
    }, React.createElement("div", {
      className: "cn-field",
      style: {
        flex: 1
      }
    }, React.createElement("label", null, "Name"), React.createElement("input", {
      className: "cn-input",
      value: pn,
      onChange: e => setPn(e.target.value),
      autoFocus: true
    })), React.createElement("div", {
      className: "cn-field",
      style: {
        flex: 1.5
      }
    }, React.createElement("label", null, "Email"), React.createElement("input", {
      className: "cn-input cn-mono",
      style: {
        fontSize: 12.5
      },
      value: pe,
      onChange: e => setPe(e.target.value),
      placeholder: "jane@company.com"
    }))), React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        justifyContent: "flex-end"
      }
    }, React.createElement("button", {
      type: "button",
      className: "cn-btn cn-btn--ghost",
      onClick: () => setShowProspect(false)
    }, "Cancel"), React.createElement("button", {
      type: "submit",
      className: "cn-btn cn-btn--primary"
    }, "Use prospect")));
  }
  return React.createElement("div", {
    className: "cn-rp-search-wrap"
  }, React.createElement("input", {
    className: "cn-input",
    placeholder: "Search a contact by name, email, or company\u2026",
    value: q,
    onChange: e => setQ(e.target.value),
    autoFocus: true
  }), matches.length > 0 && React.createElement("div", {
    className: "cn-rp-suggest"
  }, matches.map(c => {
    var acct = window.accountOf(c.accountId, scenario);
    return React.createElement("button", {
      key: c.id,
      className: "cn-rp-sug-item",
      onClick: () => onPick(c)
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, c.name.split(" ").map(n => n[0]).join("").slice(0, 2)), React.createElement("span", {
      className: "cn-rp-sug-text"
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 500
      }
    }, c.name), React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: "var(--cn-mute)"
      }
    }, c.email || "no email", acct ? " · " + acct.name : "")), React.createElement("span", {
      className: "cn-sr-kind"
    }, "Pick"));
  })), search && matches.length === 0 && React.createElement("div", {
    className: "cn-rp-empty"
  }, "No matches.", " ", React.createElement("button", {
    className: "cn-link",
    onClick: () => {
      setShowProspect(true);
      setPn(q);
    }
  }, "+ Send to \"", q, "\" as a new prospect")), React.createElement("button", {
    className: "cn-rp-add-prospect",
    onClick: () => setShowProspect(true),
    type: "button"
  }, "+ Send to a prospect not in CRM"));
}
Object.assign(window, {
  SignatureField,
  BannerImagePicker,
  TemplatePicker,
  QuickSendModal,
  QuickRecipientPicker
});
function ManualRecipientPicker({
  scenario,
  manualIds,
  onChange,
  onAddProspect
}) {
  var [q, setQ] = useState("");
  var [prospectName, setProspectName] = useState("");
  var [prospectEmail, setProspectEmail] = useState("");
  var [prospectNote, setProspectNote] = useState("");
  var [showProspect, setShowProspect] = useState(false);
  var picked = scenario.contacts.filter(c => manualIds.includes(c.id));
  var search = q.trim().toLowerCase();
  var available = search ? scenario.contacts.filter(c => !manualIds.includes(c.id) && !(window.isEmailOptedOut && window.isEmailOptedOut(c)) && ((c.name || "").toLowerCase().includes(search) || (c.email || "").toLowerCase().includes(search) || (c.title || "").toLowerCase().includes(search) || (window.accountOf(c.accountId, scenario)?.name || "").toLowerCase().includes(search))).slice(0, 8) : [];
  var add = id => onChange([...manualIds, id]);
  var remove = id => onChange(manualIds.filter(x => x !== id));
  var submitProspect = e => {
    e?.preventDefault();
    if (!prospectName.trim() || !prospectEmail.trim()) return;
    if (!/.+@.+\..+/.test(prospectEmail.trim())) {
      alert("Please enter a valid email address.");
      return;
    }
    onAddProspect({
      name: prospectName.trim(),
      email: prospectEmail.trim(),
      note: prospectNote.trim()
    });
    setProspectName("");
    setProspectEmail("");
    setProspectNote("");
    setShowProspect(false);
  };
  return React.createElement("div", {
    className: "cn-rp"
  }, React.createElement("div", {
    className: "cn-rp-search-wrap"
  }, React.createElement("input", {
    className: "cn-input",
    placeholder: "Search contacts by name, email, company\u2026",
    value: q,
    onChange: e => setQ(e.target.value),
    autoFocus: true
  }), available.length > 0 && React.createElement("div", {
    className: "cn-rp-suggest"
  }, available.map(c => {
    var acct = window.accountOf(c.accountId, scenario);
    return React.createElement("button", {
      key: c.id,
      className: "cn-rp-sug-item",
      onClick: () => {
        add(c.id);
        setQ("");
      }
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, c.name.split(" ").map(n => n[0]).join("").slice(0, 2)), React.createElement("span", {
      className: "cn-rp-sug-text"
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 500
      }
    }, c.name), React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: "var(--cn-mute)"
      }
    }, c.email || "no email", acct ? " · " + acct.name : "")), React.createElement("span", {
      className: "cn-sr-kind"
    }, "+ Add"));
  })), search && available.length === 0 && React.createElement("div", {
    className: "cn-rp-empty"
  }, "No matches. ", React.createElement("button", {
    className: "cn-link",
    onClick: () => {
      setShowProspect(true);
      setProspectName(q);
      setQ("");
    }
  }, "+ Add \"", q, "\" as a new prospect"))), !showProspect ? React.createElement("button", {
    className: "cn-rp-add-prospect",
    onClick: () => setShowProspect(true)
  }, "+ Add a prospect not in the CRM") : React.createElement("form", {
    className: "cn-rp-prospect-form",
    onSubmit: submitProspect
  }, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginBottom: 8
    }
  }, "Add a one-off prospect"), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Name"), React.createElement("input", {
    className: "cn-input",
    value: prospectName,
    onChange: e => setProspectName(e.target.value),
    placeholder: "Jane Doe",
    autoFocus: true
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.5
    }
  }, React.createElement("label", null, "Email"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: prospectEmail,
    onChange: e => setProspectEmail(e.target.value),
    placeholder: "jane@company.com"
  }))), React.createElement("div", {
    className: "cn-field",
    style: {
      marginBottom: 10
    }
  }, React.createElement("label", null, "Note ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 optional")), React.createElement("input", {
    className: "cn-input",
    value: prospectNote,
    onChange: e => setProspectNote(e.target.value),
    placeholder: "VP Procurement at Acme \u2014 met at trade show"
  })), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "flex-end"
    }
  }, React.createElement("button", {
    type: "button",
    className: "cn-btn cn-btn--ghost",
    onClick: () => setShowProspect(false)
  }, "Cancel"), React.createElement("button", {
    type: "submit",
    className: "cn-btn cn-btn--primary"
  }, "+ Add prospect"))), React.createElement("div", {
    className: "cn-rp-picked"
  }, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginBottom: 8
    }
  }, "Recipients ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11.5,
      marginLeft: 6
    }
  }, "\xB7 ", picked.length)), picked.length === 0 ? React.createElement("div", {
    className: "cn-rp-empty-state"
  }, "No recipients yet. Search above to add contacts, or add a one-off prospect.") : React.createElement("div", {
    className: "cn-rp-chips"
  }, picked.map(c => React.createElement("span", {
    key: c.id,
    className: "cn-rp-chip"
  }, React.createElement("span", {
    className: "cn-avatar cn-avatar--xs"
  }, c.name.split(" ").map(n => n[0]).join("").slice(0, 2)), React.createElement("span", {
    className: "cn-rp-chip-text"
  }, React.createElement("span", {
    className: "cn-rp-chip-name"
  }, c.name), React.createElement("span", {
    className: "cn-rp-chip-email"
  }, c.email || "no email")), React.createElement("button", {
    className: "cn-rp-chip-x",
    onClick: () => remove(c.id),
    title: "Remove"
  }, "\u2715"))))));
}
window.ManualRecipientPicker = ManualRecipientPicker;