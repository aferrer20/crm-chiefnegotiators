function Reports({
  scenario,
  currentUser,
  isFounder,
  permissions
}) {
  var opps = scenario.sharedOpps || scenario.opps;
  var restricted = !isFounder && permissions === "strict";
  var won = opps.filter(o => o.stage === "won");
  var visibleWon = restricted ? won.filter(o => o.ownerId === currentUser.id) : won;
  var totalRevenue = visibleWon.reduce((s, o) => s + o.value, 0);
  var totalCommission = visibleWon.reduce((s, o) => s + window.cnCommission(o), 0);
  var visibleReps = restricted ? window.REPS.filter(r => r.id === currentUser.id) : window.REPS;
  var byRep = visibleReps.map(rep => {
    var repWon = won.filter(o => o.ownerId === rep.id);
    var repOpen = opps.filter(o => o.ownerId === rep.id && o.stage !== "won" && o.stage !== "lost");
    var repCommission = repWon.reduce((s, o) => s + window.cnCommission(o), 0);
    var repProjected = repOpen.reduce((s, o) => s + window.cnCommission(o) * window.stageOf(o.stage).prob, 0);
    var repRevenue = repWon.reduce((s, o) => s + o.value, 0);
    return {
      rep,
      repWon,
      repOpen,
      repCommission,
      repProjected,
      repRevenue
    };
  });
  var byProduct = {};
  visibleWon.forEach(o => {
    var cat = o.product.split("—")[0].trim();
    if (!byProduct[cat]) byProduct[cat] = {
      revenue: 0,
      commission: 0,
      count: 0
    };
    byProduct[cat].revenue += o.value;
    byProduct[cat].commission += window.cnCommission(o);
    byProduct[cat].count += 1;
  });
  var productList = Object.entries(byProduct).map(([name, d]) => ({
    name,
    ...d
  }));
  var maxProductRev = Math.max(...productList.map(p => p.revenue), 1);
  var months = ["Jan", "Feb", "Mar", "Apr", "May"];
  var monthlyRev = [180_000, 720_000, 290_000, 540_000, 1_650_000];
  var maxMonth = Math.max(...monthlyRev);
  return React.createElement("div", {
    className: "cn-page"
  }, restricted && React.createElement("div", {
    className: "cn-perm-banner"
  }, React.createElement("span", {
    className: "cn-perm-icon"
  }, "\u26BF"), React.createElement("span", null, React.createElement("strong", null, "Permission scope \xB7 Strict."), " You can see your own commission only. Team-wide reports are restricted to Founder access.")), React.createElement("section", {
    className: "cn-kpi-row"
  }, React.createElement("div", {
    className: "cn-kpi cn-kpi--hero"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, restricted ? "Your" : "Team", " \xB7 Closed revenue \xB7 YTD"), React.createElement("div", {
    className: "cn-kpi-value"
  }, window.fmtUSD(totalRevenue, {
    compact: true
  })), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", {
    className: "cn-pos"
  }, "\u25B2 22.4%"), React.createElement("span", {
    className: "cn-kpi-foot-sep"
  }, "vs YTD 2025"))), React.createElement("div", {
    className: "cn-kpi"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, "Commission paid"), React.createElement("div", {
    className: "cn-kpi-value cn-kpi-value--copper"
  }, window.fmtUSD(totalCommission, {
    compact: true
  })), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", null, visibleWon.length, " deals settled"))), React.createElement("div", {
    className: "cn-kpi"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, "Avg deal size"), React.createElement("div", {
    className: "cn-kpi-value"
  }, window.fmtUSD(visibleWon.length ? totalRevenue / visibleWon.length : 0, {
    compact: true
  })), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", null, "Median ", window.fmtUSD(visibleWon.length ? visibleWon.sort((a, b) => a.value - b.value)[Math.floor(visibleWon.length / 2)].value : 0, {
    compact: true
  })))), React.createElement("div", {
    className: "cn-kpi"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, "Sales cycle"), React.createElement("div", {
    className: "cn-kpi-value"
  }, "62", React.createElement("span", {
    className: "cn-kpi-unit"
  }, "days")), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", null, "Created \u2192 Closed Won, median")))), React.createElement("div", {
    className: "cn-grid-2"
  }, React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Revenue curve"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Monthly closed revenue")), React.createElement("div", {
    className: "cn-legend"
  }, React.createElement("span", {
    className: "cn-legend-dot cn-legend-dot--ink"
  }), "2026", React.createElement("span", {
    className: "cn-legend-dot cn-legend-dot--copper",
    style: {
      marginLeft: 16
    }
  }), "2025")), React.createElement("div", {
    className: "cn-chart"
  }, React.createElement("div", {
    className: "cn-chart-bars"
  }, monthlyRev.map((v, i) => React.createElement("div", {
    key: i,
    className: "cn-chart-col"
  }, React.createElement("div", {
    className: "cn-chart-stack"
  }, React.createElement("div", {
    className: "cn-chart-bar cn-chart-bar--prior",
    style: {
      height: `${monthlyRev[i] * 0.7 / maxMonth * 100}%`
    }
  }), React.createElement("div", {
    className: "cn-chart-bar",
    style: {
      height: `${v / maxMonth * 100}%`
    }
  })), React.createElement("div", {
    className: "cn-chart-x"
  }, months[i]), React.createElement("div", {
    className: "cn-chart-val cn-mono"
  }, window.fmtUSD(v, {
    compact: true
  }))))))), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Revenue mix"), React.createElement("h2", {
    className: "cn-card-title"
  }, "By product line"))), React.createElement("div", {
    className: "cn-bars-vert"
  }, productList.map(p => React.createElement("div", {
    key: p.name,
    className: "cn-vbar"
  }, React.createElement("div", {
    className: "cn-vbar-head"
  }, React.createElement("span", {
    className: "cn-vbar-name"
  }, p.name), React.createElement("span", {
    className: "cn-vbar-vals"
  }, React.createElement("span", {
    className: "cn-mono"
  }, window.fmtUSD(p.revenue, {
    compact: true
  })), React.createElement("span", {
    className: "cn-vbar-comm cn-copper cn-mono"
  }, "+", window.fmtUSD(p.commission, {
    compact: true
  })))), React.createElement("div", {
    className: "cn-vbar-track"
  }, React.createElement("div", {
    className: "cn-vbar-fill",
    style: {
      width: `${p.revenue / maxProductRev * 100}%`
    }
  })), React.createElement("div", {
    className: "cn-vbar-meta"
  }, p.count, " deal", p.count > 1 ? "s" : "")))))), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Compensation"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Commission breakdown by rep")), React.createElement("div", {
    className: "cn-legend"
  }, React.createElement("span", {
    className: "cn-mono cn-cell-secondary"
  }, "Flat % of deal value \xB7 varies by deal"))), React.createElement("table", {
    className: "cn-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Rep"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Deals won"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Open deals"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Revenue \xB7 YTD"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Commission earned"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Projected (weighted)"))), React.createElement("tbody", null, byRep.map(({
    rep,
    repWon,
    repOpen,
    repRevenue,
    repCommission,
    repProjected
  }) => {
    var isMe = rep.id === currentUser.id;
    return React.createElement("tr", {
      key: rep.id,
      className: isMe ? "cn-tr-highlight" : ""
    }, React.createElement("td", null, React.createElement("div", {
      className: "cn-row-person"
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--copper"
    }, rep.initials), React.createElement("span", null, React.createElement("div", {
      className: "cn-cell-primary"
    }, rep.name, isMe && React.createElement("span", {
      className: "cn-you-tag"
    }, " \xB7 you")), React.createElement("div", {
      className: "cn-cell-secondary"
    }, rep.role)))), React.createElement("td", {
      className: "cn-mono",
      style: {
        textAlign: "right"
      }
    }, repWon.length), React.createElement("td", {
      className: "cn-mono",
      style: {
        textAlign: "right"
      }
    }, repOpen.length), React.createElement("td", {
      className: "cn-mono",
      style: {
        textAlign: "right"
      }
    }, window.fmtUSD(repRevenue, {
      compact: true
    })), React.createElement("td", {
      className: "cn-mono cn-copper",
      style: {
        textAlign: "right"
      }
    }, window.fmtUSD(repCommission, {
      compact: true
    })), React.createElement("td", {
      className: "cn-mono cn-cell-secondary",
      style: {
        textAlign: "right"
      }
    }, "+", window.fmtUSD(repProjected, {
      compact: true
    })));
  })))), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Settled payouts"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Recent commission events")), React.createElement("button", {
    className: "cn-link"
  }, "Export CSV \u2192")), React.createElement("table", {
    className: "cn-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Date"), React.createElement("th", null, "Deal"), React.createElement("th", null, "Account"), React.createElement("th", null, "Rep"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Deal value"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Rate"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Commission"), React.createElement("th", null, "Status"))), React.createElement("tbody", null, visibleWon.map(o => {
    var acct = window.accountOf(o.accountId, scenario);
    var rep = window.repOf(o.ownerId);
    return React.createElement("tr", {
      key: o.id
    }, React.createElement("td", {
      className: "cn-mono cn-cell-secondary"
    }, o.close), React.createElement("td", {
      className: "cn-cell-primary"
    }, o.title, window.cnOtherBadge && window.cnOtherBadge(o)), React.createElement("td", null, acct.name), React.createElement("td", null, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, rep.initials), " ", React.createElement("span", {
      style: {
        marginLeft: 6
      }
    }, rep.name)), React.createElement("td", {
      className: "cn-mono",
      style: {
        textAlign: "right"
      }
    }, window.fmtUSD(o.value, {
      compact: true
    })), React.createElement("td", {
      className: "cn-mono cn-cell-secondary",
      style: {
        textAlign: "right"
      }
    }, (window.cnEffectiveRate(o) * 100).toFixed(1), "%"), React.createElement("td", {
      className: "cn-mono cn-copper",
      style: {
        textAlign: "right"
      }
    }, window.fmtUSD(window.cnCommission(o), {
      compact: true
    })), React.createElement("td", null, React.createElement("span", {
      className: `cn-status cn-status--${o.commissionStatus || "earned"}`
    }, (window.CN_COMMISSION_STATUSES.find(s => s.id === (o.commissionStatus || "earned")) || {}).label || "Earned")));
  })))));
}
var ACCOUNTS_SORT_KEY = "cn-prefs-accounts-sort";
var ACCOUNTS_SORT_OPTS = [{
  id: "name-asc",
  label: "Name A → Z",
  get: a => (a.name || "").toLowerCase(),
  dir: 1
}, {
  id: "name-desc",
  label: "Name Z → A",
  get: a => (a.name || "").toLowerCase(),
  dir: -1
}, {
  id: "industry",
  label: "Industry",
  get: a => (a.industry || "zzz").toLowerCase(),
  dir: 1
}, {
  id: "hq",
  label: "HQ",
  get: a => (a.hq || "zzz").toLowerCase(),
  dir: 1
}, {
  id: "open-desc",
  label: "Open pipeline ↓",
  get: (a, s) => -(s.sharedOpps || s.opps).filter(o => o.accountId === a.id && o.stage !== "won" && o.stage !== "lost").reduce((t, o) => t + (o.value || 0), 0),
  dir: 1
}, {
  id: "closed-desc",
  label: "Closed-won ↓",
  get: (a, s) => -(s.sharedOpps || s.opps).filter(o => o.accountId === a.id && o.stage === "won").reduce((t, o) => t + (o.value || 0), 0),
  dir: 1
}];
function Accounts({
  scenario,
  currentUser,
  onOpenContact,
  onNewAccount,
  onEditAccount,
  onOpenAccount,
  onImport,
  onSaved,
  onMergeAccounts
}) {
  var [q, setQ] = useState("");
  var [sort, setSort] = useState(() => localStorage.getItem(ACCOUNTS_SORT_KEY) || "name-asc");
  useEffect(() => {
    localStorage.setItem(ACCOUNTS_SORT_KEY, sort);
  }, [sort]);
  var sortDef = ACCOUNTS_SORT_OPTS.find(o => o.id === sort) || ACCOUNTS_SORT_OPTS[0];
  var list = useMemo(() => {
    var filtered = scenario.accounts.filter(a => !q || (a.name || "").toLowerCase().includes(q.toLowerCase()) || (a.industry || "").toLowerCase().includes(q.toLowerCase()) || (a.hq || "").toLowerCase().includes(q.toLowerCase()));
    var arr = [...filtered];
    arr.sort((x, y) => {
      var vx = sortDef.get(x, scenario);
      var vy = sortDef.get(y, scenario);
      if (vx < vy) return -1 * sortDef.dir;
      if (vx > vy) return 1 * sortDef.dir;
      return (x.name || "").localeCompare(y.name || "");
    });
    return arr;
  }, [scenario.accounts, scenario.sharedOpps, scenario.opps, q, sort]);
  // Counted once for the strip rather than per row.
  var withPipeline = useMemo(() => {
    var src = scenario.sharedOpps || scenario.opps || [];
    var live = new Set(src.filter(o => o.stage !== "won" && o.stage !== "lost").map(o => o.accountId));
    return scenario.accounts.filter(a => live.has(a.id)).length;
  }, [scenario.accounts, scenario.sharedOpps, scenario.opps]);
  if (scenario.accounts.length === 0) {
    return React.createElement("div", {
      className: "cn-page"
    }, React.createElement("section", {
      className: "cn-card",
      style: {
        textAlign: "center",
        padding: 60
      }
    }, React.createElement("h3", {
      style: {
        fontFamily: "var(--cn-serif)",
        fontSize: 22,
        margin: "0 0 8px"
      }
    }, "No accounts yet"), React.createElement("p", {
      style: {
        color: "var(--cn-mute)",
        margin: "0 0 20px"
      }
    }, "Companies you sell to live here. Each contact and deal belongs to an account."), React.createElement("div", {
      style: {
        display: "flex",
        gap: 10,
        justifyContent: "center"
      }
    }, React.createElement("button", {
      className: "cn-btn cn-btn--primary",
      onClick: onNewAccount
    }, "+ Add your first account"), onImport && React.createElement("button", {
      className: "cn-btn cn-btn--ghost",
      onClick: onImport
    }, "\u2913 Import a spreadsheet"))));
  }
  return React.createElement("div", {
    className: "cn-page"
  }, React.createElement("div", {
    className: "cn-toolbar"
  }, React.createElement("input", {
    className: "cn-input cn-input--wide",
    placeholder: "Filter accounts\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  }), React.createElement("div", {
    className: "cn-toolbar-right"
  }, React.createElement("label", {
    className: "cn-sort-select"
  }, React.createElement("span", {
    className: "cn-sort-select-label"
  }, "Sort"), React.createElement("select", {
    className: "cn-input",
    value: sort,
    onChange: e => setSort(e.target.value)
  }, ACCOUNTS_SORT_OPTS.map(o => React.createElement("option", {
    key: o.id,
    value: o.id
  }, o.label)))), onMergeAccounts && React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => onMergeAccounts({}),
    title: "Merge two account records into one"
  }, "\u29C9 Merge"), onImport && React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onImport
  }, "\u2913 Import"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: onNewAccount
  }, "+ New account"))), window.AccountDupeBar && React.createElement(window.AccountDupeBar, {
    scenario: scenario,
    onMerge: onMergeAccounts
  }), window.ClaimQueue && React.createElement(window.ClaimQueue, {
    currentUser: currentUser,
    onChanged: onSaved
  }),
  // Four counts, equal weight — there is no hero figure on this screen.
  React.createElement("dl", {
    className: "cn-acct-strip"
  }, React.createElement("div", null, React.createElement("dt", null, "Accounts"), React.createElement("dd", null, scenario.accounts.length, q && React.createElement("small", null, list.length + " shown"))),
    React.createElement("div", null, React.createElement("dt", null, "Partners"), React.createElement("dd", null, scenario.accounts.filter(a => a.isPartner).length)),
    React.createElement("div", null, React.createElement("dt", null, "With pipeline"), React.createElement("dd", null, withPipeline)),
    React.createElement("div", null, React.createElement("dt", null, "Unassigned"), React.createElement("dd", null, scenario.accounts.filter(a => !a.ownerId).length))),
  React.createElement("section", {
    className: "cn-card cn-card--flush"
  },
  // Fixed geometry: percentage columns mean the table is always exactly as
  // wide as the card, so nothing can be clipped out of reach the way HQ and
  // pipeline were when eight auto-width columns overflowed to 1262px.
  // Its own scrollport: the page's scrolling ancestor (.cn-content) has
  // overflow:auto but no height constraint, so a sticky thead had zero travel
  // and scrolled away with the page. Bounding the table gives sticky something
  // to stick against, and stops 188 rows making the document 11,800px tall.
  React.createElement("div", {
    className: "cn-acct-scroll"
  }, React.createElement("table", {
    className: "cn-acct-list"
  }, React.createElement("colgroup", null,
    React.createElement("col", { style: { width: "36%" } }),
    React.createElement("col", { className: "c-owner", style: { width: "15%" } }),
    React.createElement("col", { style: { width: "21%" } }),
    React.createElement("col", { style: { width: "14%" } }),
    React.createElement("col", { className: "c-people", style: { width: "14%" } })),
  React.createElement("thead", null, React.createElement("tr", null,
    React.createElement("th", null, "Account"),
    React.createElement("th", { className: "c-owner" }, "Owner"),
    React.createElement("th", null, "Industry & location"),
    React.createElement("th", { className: "is-num" }, "Pipeline"),
    React.createElement("th", { className: "c-people is-num" }, "People"))),
  React.createElement("tbody", null, list.map(a => {
    var acctOpps = (scenario.sharedOpps || scenario.opps).filter(o => o.accountId === a.id);
    var open = acctOpps.filter(o => o.stage !== "won" && o.stage !== "lost").reduce((s, o) => s + o.value, 0);
    var closed = acctOpps.filter(o => o.stage === "won").reduce((s, o) => s + o.value, 0);
    var contacts = scenario.contacts.filter(c => c.accountId === a.id);
    var owner = a.ownerId && window.repOf(a.ownerId);
    var foreign = !!(window.CN_CROSS && window.CN_CROSS.accountIsForeign(a));
    return React.createElement("tr", {
      key: a.id,
      className: "cn-tr-link " + (foreign ? "is-foreign" : ""),
      onClick: () => onOpenAccount(a.id)
    }, React.createElement("td", null, React.createElement("div", {
      className: "cn-acct-c-name"
    }, React.createElement("span", null, a.name),
      window.cnPartnerBadge && window.cnPartnerBadge(a),
      foreign && window.BrandChip ? React.createElement(window.BrandChip, {
        company: a.company,
        title: window.CN_CROSS.companyLabel(a.company) + " owns this account"
      }) : null),
      a.website && React.createElement("div", { className: "cn-acct-c-url" }, a.website)),
    React.createElement("td", { className: "c-owner" }, owner ? React.createElement("div", {
      className: "cn-acct-owner-cell"
    }, React.createElement("span", { className: "cn-avatar cn-avatar--xs cn-avatar--copper" }, owner.initials),
      React.createElement("span", null, owner.name)) : React.createElement("span", { className: "cn-acct-c-none" }, "Unassigned")),
    React.createElement("td", null, React.createElement("div", {
      className: "cn-acct-c-industry"
    }, a.industry || "\u2014"),
      (a.hq || a.size) && React.createElement("div", { className: "cn-acct-c-where" },
        a.hq && React.createElement("span", { className: "cn-acct-hq" }, a.hq),
        a.hq && a.size && React.createElement("span", { className: "cn-acct-dot" }, "\u00B7"),
        a.size && React.createElement("span", { className: "cn-acct-size" }, a.size))),
    // 184 of 188 accounts have no live pipeline, so printing "$0" on almost
    // every row turned a whole column into noise. An em-dash reads as
    // "nothing here" at full contrast and lets real figures stand out.
    React.createElement("td", { className: "is-num" }, open > 0
      ? React.createElement("div", { className: "cn-acct-c-open" }, window.fmtUSD(open, { compact: true }))
      : React.createElement("div", { className: "cn-acct-c-nil" }, "\u2014"),
      closed > 0 && React.createElement("div", { className: "cn-acct-c-won" }, window.fmtUSD(closed, { compact: true }) + " won")),
    React.createElement("td", { className: "c-people is-num" }, contacts.length === 0
      ? React.createElement("span", { className: "cn-acct-c-none" }, "\u2014")
      : React.createElement("div", {
          className: "cn-acct-c-people",
          onClick: e => e.stopPropagation()
        }, contacts.slice(0, 3).map(c => React.createElement("span", {
          key: c.id,
          className: "cn-avatar cn-avatar--xs",
          onClick: () => onOpenContact(c.id),
          title: c.name
        }, c.name.split(" ").map(n => n[0]).join("").slice(0, 2))),
          contacts.length > 3 && React.createElement("span", {
            className: "cn-avatar cn-avatar--xs cn-avatar--more"
          }, "+", contacts.length - 3))));
  })))), React.createElement("div", {
    className: "cn-acct-count"
  }, list.length === scenario.accounts.length
    ? list.length + " account" + (list.length === 1 ? "" : "s")
    : list.length + " of " + scenario.accounts.length + " accounts")));
}
function AccountNoteComposer({
  contacts,
  currentUser,
  onSaved
}) {
  var [text, setText] = useState("");
  var [contactId, setContactId] = useState(contacts[0]?.id || "");
  var [saving, setSaving] = useState(false);
  var [error, setError] = useState(null);
  var save = async () => {
    if (!text.trim()) return;
    if (!contactId) {
      setError("Pick a contact to attach this note to.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await window.insertActivity({
        type: "note",
        owner_id: currentUser?.id || null,
        contact_id: contactId,
        summary: text.trim(),
        occurred_at: new Date().toISOString()
      });
      window.cnToast && window.cnToast({
        title: "Note added",
        sub: text.trim().slice(0, 70)
      });
      setText("");
      onSaved && onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return React.createElement("div", {
    style: {
      marginBottom: 18,
      paddingBottom: 18,
      borderBottom: "1px solid var(--cn-line-2)"
    }
  }, React.createElement("textarea", {
    className: "cn-textarea",
    rows: "3",
    placeholder: "Add an internal note about this account\u2026 (visible to the team, not the customer)",
    value: text,
    onChange: e => setText(e.target.value)
  }), error && React.createElement("div", {
    className: "cn-login-error",
    style: {
      marginTop: 8
    }
  }, error), React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 8,
      gap: 12
    }
  }, React.createElement("label", {
    className: "cn-sort-select",
    style: {
      minWidth: 0
    }
  }, React.createElement("span", {
    className: "cn-sort-select-label"
  }, "Attach to"), React.createElement("select", {
    className: "cn-input",
    value: contactId,
    onChange: e => setContactId(e.target.value),
    style: {
      minWidth: 180
    }
  }, contacts.length === 0 && React.createElement("option", {
    value: ""
  }, "\u2014 No contacts \u2014"), contacts.map(c => React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.name)))), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: save,
    disabled: saving || !text.trim() || contacts.length === 0
  }, saving ? "Saving…" : "Add note")));
}
function AccountDetail({
  scenario,
  accountId,
  currentUser,
  onBack,
  onOpenContact,
  onOpenOpp,
  onLogCall,
  onAddTask,
  onEditAccount,
  onNewContact,
  onNewOpp,
  onEditActivity,
  onSaved
}) {
  var account = scenario.accounts.find(a => a.id === accountId) || {
    id: accountId,
    name: "—",
    industry: "",
    hq: "",
    headcount: null
  };
  var [tab, setTab] = useState("timeline");
  var [dealFilter, setDealFilter] = useState("open");
  if (!account) {
    return React.createElement("div", {
      className: "cn-page"
    }, React.createElement("button", {
      className: "cn-back",
      onClick: onBack
    }, "\u2190 Back to accounts"), React.createElement("section", {
      className: "cn-card",
      style: {
        textAlign: "center",
        padding: 60
      }
    }, React.createElement("h3", {
      style: {
        fontFamily: "var(--cn-serif)",
        fontSize: 22,
        margin: 0
      }
    }, "Account not found")));
  }
  var accountContacts = scenario.contacts.filter(c => c.accountId === account.id);
  var contactIds = new Set(accountContacts.map(c => c.id));
  var accountOpps = (scenario.sharedOpps || scenario.opps).filter(o => o.accountId === account.id);
  var oppIds = new Set(accountOpps.map(o => o.id));
  var activities = scenario.activities.filter(a => a.contactId && contactIds.has(a.contactId) || a.oppId && oppIds.has(a.oppId)).slice().sort((x, y) => new Date(y.occurredAt || 0) - new Date(x.occurredAt || 0));
  var owner = account.ownerId && window.repOf(account.ownerId);
  var openOpps = accountOpps.filter(o => o.stage !== "won" && o.stage !== "lost");
  var wonOpps = accountOpps.filter(o => o.stage === "won");
  var totalOpen = openOpps.reduce((s, o) => s + o.value, 0);
  var totalWon = wonOpps.reduce((s, o) => s + o.value, 0);
  var countOf = type => activities.filter(a => a.type === type).length;
  var shownActivities = tab === "timeline" ? activities : activities.filter(a => a.type === tab.slice(0, -1));
  var contactName = id => scenario.contacts.find(c => c.id === id)?.name;
  var initials = account.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  var isForeign = !!(window.CN_CROSS && window.CN_CROSS.accountIsForeign(account));
  return React.createElement("div", {
    className: "cn-page cn-page--detail cn-acct"
  }, React.createElement("div", {
    className: "cn-acct-bar"
  }, React.createElement("button", {
    className: "cn-back",
    onClick: onBack
  }, "\u2190 Accounts"), isForeign ? React.createElement("span", {
    className: "cn-xb-readonly"
  }, "Read-only \xB7 ", window.CN_CROSS.companyShort(account.company), " account") : React.createElement("div", {
    className: "cn-acct-tools"
  }, React.createElement("button", {
    className: "cn-acct-tool",
    onClick: () => onLogCall && onLogCall(accountContacts[0]?.id),
    title: "Log a call"
  }, React.createElement("span", null, "\u260E"), "Call"), React.createElement("button", {
    className: "cn-acct-tool",
    onClick: () => setTab("notes"),
    title: "Add a note"
  }, React.createElement("span", null, "\u270E"), "Note"), React.createElement("button", {
    className: "cn-acct-tool",
    onClick: () => onAddTask && onAddTask(accountContacts[0]?.id),
    title: "Add a task"
  }, React.createElement("span", null, "\u25CB"), "Task"), React.createElement("button", {
    className: "cn-acct-tool",
    onClick: () => onNewContact && onNewContact(account.id),
    title: "Add a contact"
  }, React.createElement("span", null, "\uFF0B"), "Contact"), React.createElement("span", {
    className: "cn-acct-tool-sep"
  }), React.createElement("button", {
    className: "cn-acct-tool",
    onClick: () => onEditAccount && onEditAccount(account),
    title: "Edit account"
  }, React.createElement("span", null, "\u2699"), "Edit"), React.createElement("button", {
    className: "cn-btn cn-btn--primary cn-acct-cta",
    onClick: () => onNewOpp && onNewOpp(null)
  }, "+ New opportunity"))), isForeign && window.ForeignAccountBanner && React.createElement(window.ForeignAccountBanner, {
    account: account,
    currentUser: currentUser,
    onChanged: onSaved
  }), React.createElement("header", {
    className: "cn-acct-hero"
  }, React.createElement("div", {
    className: "cn-avatar cn-avatar--xl"
  }, initials || "?"), React.createElement("div", {
    className: "cn-acct-id"
  }, React.createElement("h1", {
    className: "cn-acct-name"
  }, account.name, window.cnPartnerBadge && window.cnPartnerBadge(account)), React.createElement("div", {
    className: "cn-acct-line"
  }, React.createElement("span", null, account.industry || "Account"), account.hq && React.createElement("span", null, account.hq), account.website && React.createElement("span", {
    className: "cn-mono"
  }, account.website)), React.createElement("div", {
    className: "cn-acct-owner"
  }, owner ? React.createElement(Fragment, null, React.createElement("span", {
    className: "cn-avatar cn-avatar--xs cn-avatar--copper"
  }, owner.initials), React.createElement("span", null, "Owned by ", React.createElement("strong", null, owner.name))) : React.createElement("span", {
    className: "cn-acct-unassigned"
  }, "Unassigned"))), React.createElement("dl", {
    className: "cn-acct-kpi"
  }, React.createElement("div", null, React.createElement("dt", null, "Open pipeline"), React.createElement("dd", null, window.fmtUSD(totalOpen, {
    compact: true
  }))), React.createElement("div", null, React.createElement("dt", null, "Closed-won"), React.createElement("dd", null, window.fmtUSD(totalWon, {
    compact: true
  }))), React.createElement("div", null, React.createElement("dt", null, "Deals"), React.createElement("dd", {
    className: "cn-mono"
  }, accountOpps.length)), React.createElement("div", null, React.createElement("dt", null, "People"), React.createElement("dd", {
    className: "cn-mono"
  }, accountContacts.length)), React.createElement("div", null, React.createElement("dt", null, "Touchpoints"), React.createElement("dd", {
    className: "cn-mono"
  }, activities.length)))), React.createElement("div", {
    className: "cn-acct-body"
  }, React.createElement("div", {
    className: "cn-acct-main"
  }, React.createElement("div", {
    className: "cn-tabs cn-tabs--underline"
  }, [{
    id: "timeline",
    label: `Timeline (${activities.length})`
  }, {
    id: "calls",
    label: `Calls (${countOf("call")})`
  }, {
    id: "emails",
    label: `Emails (${countOf("email")})`
  }, {
    id: "notes",
    label: `Notes (${countOf("note")})`
  }].map(tb => React.createElement("button", {
    key: tb.id,
    className: `cn-tab ${tab === tb.id ? "is-active" : ""}`,
    onClick: () => setTab(tb.id)
  }, tb.label))), tab === "notes" && React.createElement(AccountNoteComposer, {
    contacts: accountContacts,
    currentUser: currentUser,
    onSaved: onSaved
  }), React.createElement("div", {
    className: "cn-timeline"
  }, shownActivities.map((a, i) => {
    var who = contactName(a.contactId);
    var opp = a.oppId && accountOpps.find(o => o.id === a.oppId);
    return React.createElement("div", {
      key: a.id,
      className: "cn-tl-item cn-tl-item--clickable",
      onClick: () => onEditActivity && onEditActivity(a)
    }, React.createElement("div", {
      className: "cn-tl-spine"
    }, React.createElement("div", {
      className: `cn-tl-dot cn-tl-dot--${a.type}`
    }, a.type === "call" && "☎", a.type === "email" && "✉", a.type === "note" && "✎", a.type === "won" && "✓", a.type === "task" && "○"), i < shownActivities.length - 1 && React.createElement("div", {
      className: "cn-tl-line"
    })), React.createElement("div", {
      className: "cn-tl-content"
    }, React.createElement("div", {
      className: "cn-tl-head"
    }, React.createElement("span", {
      className: "cn-tl-title"
    }, a.type === "call" && "Call logged", a.type === "email" && a.subject, a.type === "note" && "Internal note", a.type === "won" && "Deal won", a.type === "task" && (a.summary ? "Task" : "Task scheduled")), React.createElement("span", {
      className: "cn-tl-when"
    }, a.when)), React.createElement("div", {
      className: "cn-tl-meta"
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, (window.repOf(a.ownerId) || {
      initials: "—"
    }).initials), React.createElement("span", null, (window.repOf(a.ownerId) || {
      name: "Unassigned"
    }).name), who && React.createElement("span", null, "\xB7 ", React.createElement("button", {
      className: "cn-link-inline",
      onClick: e => {
        e.stopPropagation();
        onOpenContact && onOpenContact(a.contactId);
      }
    }, who)), a.duration && React.createElement("span", null, "\xB7 ", a.duration, " min"), a.sentiment && React.createElement("span", {
      className: `cn-chip cn-chip--${a.sentiment}`
    }, a.sentiment)), a.summary && React.createElement("p", {
      className: "cn-tl-body"
    }, a.summary), a.snippet && React.createElement("p", {
      className: "cn-tl-body cn-tl-body--quote"
    }, a.snippet), opp && React.createElement("div", {
      className: "cn-tl-meta"
    }, React.createElement("button", {
      className: "cn-feed-link",
      onClick: e => {
        e.stopPropagation();
        onOpenOpp && onOpenOpp(opp.id);
      }
    }, opp.title))));
  }), shownActivities.length === 0 && React.createElement("div", {
    className: "cn-acct-blank"
  }, React.createElement("span", null, tab === "calls" ? "No calls logged yet." : tab === "emails" ? "No emails yet." : tab === "notes" ? "No notes yet." : "Nothing logged against this account yet."), tab !== "notes" && !isForeign && React.createElement("button", {
    className: "cn-link",
    onClick: () => tab === "calls" ? onLogCall && onLogCall(accountContacts[0]?.id) : setTab("notes")
  }, tab === "calls" ? "Log a call" : "Add the first note"))), window.CnAccountDocuments && React.createElement(window.CnAccountDocuments, {
    account: account,
    accountId: account.id,
    currentUser: currentUser,
    readOnly: isForeign
  })), React.createElement("aside", {
    className: "cn-acct-side"
  }, window.CnAgreementsPanel && React.createElement(window.CnAgreementsPanel, {
    entityType: "account",
    entityId: account.id,
    entityName: account.name,
    account: account,
    currentUser: currentUser
  }), React.createElement("section", {
    className: "cn-card cn-acct-card"
  }, React.createElement("div", {
    className: "cn-acct-cardhead"
  }, React.createElement("h3", null, "People ", React.createElement("span", {
    className: "cn-mono"
  }, accountContacts.length)), !isForeign && React.createElement("button", {
    className: "cn-link",
    onClick: () => onNewContact && onNewContact(account.id)
  }, "+ Add")), React.createElement("div", {
    className: "cn-side-list"
  }, accountContacts.map(c => {
    var cOwner = c.ownerId && window.repOf(c.ownerId);
    var tier = c.tier || "Influencer";
    return React.createElement("button", {
      key: c.id,
      className: "cn-side-person",
      onClick: () => onOpenContact && onOpenContact(c.id)
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, c.name.split(" ").map(n => n[0]).join("").slice(0, 2)), React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "cn-side-person-name"
    }, c.name), React.createElement("div", {
      className: "cn-side-person-title"
    }, c.title || "—", cOwner ? " · " + cOwner.name.split(" ")[0] : "")), React.createElement("span", {
      className: `cn-tier cn-tier--${tier.toLowerCase().replace(/ /g, "-")}`
    }, tier));
  }), accountContacts.length === 0 && React.createElement("button", {
    className: "cn-acct-add",
    onClick: () => onNewContact && onNewContact(account.id),
    disabled: isForeign
  }, React.createElement("span", null, "\uFF0B"), " Add the first contact"))), React.createElement("section", {
    className: "cn-card cn-acct-card"
  }, React.createElement("div", {
    className: "cn-acct-cardhead"
  }, React.createElement("h3", null, "Deals ", React.createElement("span", {
    className: "cn-mono"
  }, accountOpps.length)), React.createElement("div", {
    className: "cn-acct-seg"
  }, React.createElement("button", {
    className: dealFilter === "open" ? "is-active" : "",
    onClick: () => setDealFilter("open")
  }, "Open ", openOpps.length), React.createElement("button", {
    className: dealFilter === "won" ? "is-active" : "",
    onClick: () => setDealFilter("won")
  }, "Won ", wonOpps.length))), React.createElement("div", {
    className: "cn-side-list"
  }, (dealFilter === "open" ? openOpps : wonOpps).map(o => React.createElement("div", {
    key: o.id,
    className: "cn-side-deal",
    onClick: () => onOpenOpp && onOpenOpp(o.id)
  }, React.createElement("div", {
    className: "cn-side-deal-title"
  }, o.title, window.cnOtherBadge && window.cnOtherBadge(o)), React.createElement("div", {
    className: "cn-side-deal-meta"
  }, React.createElement(window.StagePill, {
    stage: o.stage
  }), React.createElement("span", {
    className: "cn-mono"
  }, window.fmtUSD(o.value, {
    compact: true
  }))))), (dealFilter === "open" ? openOpps : wonOpps).length === 0 && (dealFilter === "open" && !isForeign ? React.createElement("button", {
    className: "cn-acct-add",
    onClick: () => onNewOpp && onNewOpp(null)
  }, React.createElement("span", null, "\uFF0B"), " Start an opportunity") : React.createElement("div", {
    className: "cn-side-empty"
  }, dealFilter === "open" ? "No open deals." : "Nothing closed yet.")))), React.createElement("section", {
    className: "cn-card cn-acct-card"
  }, React.createElement("div", {
    className: "cn-acct-cardhead"
  }, React.createElement("h3", null, "Company")), React.createElement("div", {
    className: "cn-side-acct"
  }, React.createElement("div", {
    className: "cn-side-acct-row"
  }, React.createElement("span", null, "Industry"), React.createElement("span", null, account.industry || "—")), React.createElement("div", {
    className: "cn-side-acct-row"
  }, React.createElement("span", null, "HQ"), React.createElement("span", null, account.hq || "—")), React.createElement("div", {
    className: "cn-side-acct-row"
  }, React.createElement("span", null, "Headcount"), React.createElement("span", {
    className: "cn-mono"
  }, account.size || "—")), React.createElement("div", {
    className: "cn-side-acct-row"
  }, React.createElement("span", null, "Web"), React.createElement("span", {
    className: "cn-mono"
  }, account.website || "—")))))));
}
function ActivityScreen({
  scenario,
  onOpenContact,
  onOpenOpp,
  onLogCall,
  onEditActivity,
  onAddTask
}) {
  var [filter, setFilter] = useState("all");
  var [companyFilter, setCompanyFilter] = useState("all");
  var [who, setWho] = useState("all");
  var myCompany = scenario.myCompany || "Chief Negotiators";
  var actSource = scenario.allActivities || scenario.activities;
  var isSuper = !!(window.CN_CROSS && window.CN_CROSS.isSuperAdmin && window.CN_CROSS.isSuperAdmin());
  var people = Array.from(new Set(actSource.map(a => a.ownerId).filter(Boolean))).map(id => ({
    id: id,
    name: (window.repOf(id) || {}).name || "Unassigned"
  })).sort((a, b) => a.name.localeCompare(b.name));
  var allOppsList = scenario.allOpps || scenario.opps;
  var actCompanies = Array.from(new Set(actSource.map(a => a.company || myCompany)));
  var showCompanySelect = actCompanies.length > 1;
  var companyOpts = [{
    id: "all",
    label: "All companies"
  }].concat(actCompanies.map(c => ({
    id: c,
    label: window.cnCompanyLabel(c)
  })));
  var filtered = actSource.filter(a => {
    if (companyFilter !== "all" && (a.company || myCompany) !== companyFilter) return false;
    if (who !== "all" && a.ownerId !== who) return false;
    return filter === "all" || a.type === filter;
  });
  var TABS = [{
    id: "all",
    label: "Everything"
  }, {
    id: "call",
    label: "Calls"
  }, {
    id: "email",
    label: "Emails"
  }, {
    id: "note",
    label: "Notes"
  }, {
    id: "task",
    label: "Tasks"
  }];
  var inCompany = actSource.filter(a => (companyFilter === "all" || (a.company || myCompany) === companyFilter) && (who === "all" || a.ownerId === who));
  var countFor = id => id === "all" ? inCompany.length : inCompany.filter(a => a.type === id).length;
  var groups = window.cnGroupByDay(filtered);
  return React.createElement("div", {
    className: "cn-page"
  }, React.createElement("div", {
    className: "cn-toolbar"
  }, React.createElement("div", {
    className: "cn-tabs"
  }, TABS.map(t => React.createElement("button", {
    key: t.id,
    className: `cn-tab ${filter === t.id ? "is-active" : ""}`,
    onClick: () => setFilter(t.id)
  }, t.label, React.createElement("span", {
    className: "cn-tab-count"
  }, countFor(t.id))))), React.createElement("div", {
    className: "cn-toolbar-right"
  }, people.length > 1 && React.createElement("select", {
    className: "cn-input cn-act-who",
    value: who,
    onChange: e => setWho(e.target.value),
    title: "Show activity for one person"
  }, React.createElement("option", {
    value: "all"
  }, "Everyone"), people.map(p => React.createElement("option", {
    key: p.id,
    value: p.id
  }, p.name))), showCompanySelect && React.createElement("div", {
    className: "cn-segmented cn-segmented--co"
  }, companyOpts.map(c => React.createElement("button", {
    key: c.id,
    className: companyFilter === c.id ? "is-active" : "",
    onClick: () => setCompanyFilter(c.id)
  }, c.label))), React.createElement("button", {
    className: "cn-btn cn-btn--ghost"
  }, "Export"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: onAddTask
  }, "\u25CB Add task"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: onLogCall
  }, "\u260E Log call"))), React.createElement("section", {
    className: "cn-card"
  }, !filtered.length && React.createElement("p", {
    className: "cn-empty-line"
  }, "Nothing logged here yet."), groups.map(g => React.createElement("div", {
    key: g.label,
    className: "cn-feed-group"
  }, React.createElement("div", {
    className: "cn-feed-daybar"
  }, React.createElement("span", null, g.label), React.createElement("span", {
    className: "cn-feed-daycount"
  }, g.items.length)), React.createElement("ul", {
    className: "cn-feed cn-feed--dense"
  }, g.items.map(a => {
    var rawC = a.contactId ? (scenario.allContacts || scenario.contacts || []).find(x => x.id === a.contactId) || null : null;
    var c = rawC && (!a.isOther || isSuper) ? rawC : null;
    var opp = a.oppId && allOppsList.find(o => o.id === a.oppId);
    var acct = c && c.accountId ? window.accountOf(c.accountId, scenario) : opp ? {
      name: opp.accountName
    } : null;
    return React.createElement("li", {
      key: a.id,
      className: `cn-feed-item ${a.isOther && !isSuper ? "" : "cn-feed-item--clickable"}`,
      onClick: () => {
        if ((!a.isOther || isSuper) && onEditActivity) onEditActivity(a);
      }
    }, React.createElement("div", {
      className: `cn-feed-icon cn-feed-icon--${a.type}`
    }, a.type === "call" && "☎", a.type === "email" && "✉", a.type === "note" && "✎", a.type === "won" && "✓", a.type === "task" && "◯"), React.createElement("div", {
      className: "cn-feed-body"
    }, React.createElement("div", {
      className: "cn-feed-head"
    }, React.createElement("span", {
      className: "cn-feed-who"
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, (window.repOf(a.ownerId) || {
      initials: "—"
    }).initials), React.createElement("strong", null, (window.repOf(a.ownerId) || {
      name: "Unassigned"
    }).name.split(" ")[0]), React.createElement("span", {
      className: "cn-feed-verb"
    }, a.type === "call" && "called", a.type === "email" && "emailed", a.type === "note" && "noted", a.type === "task" && (a.completedAt ? "completed" : "scheduled"), a.type === "won" && "closed"), c ? React.createElement("button", {
      className: "cn-link-inline",
      onClick: () => onOpenContact(c.id)
    }, c.name) : a.isOther ? React.createElement("span", {
      className: "cn-muted"
    }, "Private \xB7 ", window.cnCompanyLabel(a.company)) : null), React.createElement("span", {
      className: "cn-feed-when"
    }, a.when)), a.summary && React.createElement(window.CNFeedText, {
      text: a.summary,
      lines: 3,
      className: a.type === "task" && a.completedAt ? "cn-feed-done" : undefined
    }), a.subject && React.createElement("div", {
      className: "cn-feed-email"
    }, React.createElement("div", {
      className: "cn-feed-email-subj"
    }, a.subject), a.snippet && React.createElement(window.CNFeedText, {
      text: a.snippet,
      lines: 2,
      className: "cn-feed-email-snip"
    })), React.createElement("div", {
      className: "cn-feed-foot"
    }, a.type === "task" && (a.completedAt ? React.createElement("span", {
      className: "cn-chip cn-chip--positive"
    }, "✓ Done ", new Date(a.completedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    })) : React.createElement("span", {
      className: "cn-chip cn-chip--quiet"
    }, "Open task")), a.duration && React.createElement("span", {
      className: "cn-chip"
    }, a.duration, " min"), a.sentiment && React.createElement("span", {
      className: `cn-chip cn-chip--${a.sentiment}`
    }, a.sentiment), opp && React.createElement("span", {
      className: "cn-feed-link",
      onClick: () => onOpenOpp && onOpenOpp(opp.id)
    }, opp.title), acct && acct.name && React.createElement("span", {
      className: "cn-feed-acct"
    }, "\xB7 ", acct.name), showCompanySelect && React.createElement(window.CompanyTag, {
      company: a.company || myCompany
    }))));
  }))))));
}
Object.assign(window, {
  Reports,
  Accounts,
  AccountDetail,
  ActivityScreen
});