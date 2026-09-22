var {
  useState: useStateDash,
  useMemo: useMemoDash
} = React;
// Trailing-zero trim. The old inline /\.0+$/ only fired when EVERY decimal was
// zero, so "1.20" kept its zero and $1.2B printed as "$1.20B". Guarded on the
// decimal point so "1000" is never trimmed to "1".
function trimZeros(s) {
  return s.indexOf(".") < 0 ? s : s.replace(/0+$/, "").replace(/\.$/, "");
}
function fmtUSD(n, {
  compact = false
} = {}) {
  if (compact) {
    // Billions tier first, or anything past $1B prints as four-digit millions
    // ("$1122M"). Cross-brand aggregates cross that line routinely, and this
    // feeds the dashboard hero, the deal cards and the bell alike.
    if (n >= 1_000_000_000) return "$" + trimZeros((n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 1 : 2)) + "B";
    if (n >= 1_000_000) return "$" + trimZeros((n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)) + "M";
    if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
    return "$" + n.toLocaleString();
  }
  return "$" + n.toLocaleString();
}
function stageOf(id) {
  var norm = window.cnNormalizeStage ? window.cnNormalizeStage(id) : id;
  return window.STAGES.find(s => s.id === norm) || window.STAGES.find(s => s.id === "ncnda") || window.STAGES[0];
}
function repOf(id) {
  return window.REPS.find(r => r.id === id) || {
    id: null,
    name: "Unassigned",
    initials: "—",
    role: ""
  };
}
function accountOf(id, scenario) {
  return (scenario && scenario.accounts || []).find(a => a.id === id) || {
    id: null,
    name: "—",
    industry: "",
    hq: ""
  };
}
function contactOf(id, scenario) {
  return (scenario && scenario.contacts || []).find(c => c.id === id) || {
    id: null,
    name: "—",
    title: "",
    email: "",
    accountId: null
  };
}
function taskDoneLabel(iso) {
  if (!iso) return "Completed";
  var d = new Date(iso);
  if (isNaN(d)) return "Completed";
  return "Done " + d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}
function taskDueLabel(iso) {
  if (!iso) return {
    label: "No date",
    overdue: false
  };
  var d = window.cnParseDay(iso);
  var startOfDay = x => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  var days = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
  if (days < 0) return {
    label: days === -1 ? "Yesterday" : `${-days} days overdue`,
    overdue: true
  };
  if (days === 0) return {
    label: "Due today",
    overdue: false
  };
  if (days === 1) return {
    label: "Due tomorrow",
    overdue: false
  };
  if (days < 7) return {
    label: "Due " + d.toLocaleDateString("en-US", {
      weekday: "long"
    }),
    overdue: false
  };
  return {
    label: "Due " + d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    }),
    overdue: false
  };
}
function Dashboard({
  scenario,
  currentUser,
  isFounder,
  onLogCall,
  onOpenContact,
  onOpenOpp,
  onEditActivity,
  onAddTask,
  onCompleteTask
}) {
  var [showDone, setShowDone] = useState(false);
  var allOpps = scenario.sharedOpps || scenario.opps;
  var opps = isFounder ? allOpps : allOpps.filter(o => o.ownerId === currentUser.id);
  var open = opps.filter(o => o.stage !== "won" && o.stage !== "lost");
  var won = opps.filter(o => o.stage === "won");
  var lost = opps.filter(o => o.stage === "lost");
  var pipelineValue = open.reduce((s, o) => s + o.value, 0);
  var weightedValue = open.reduce((s, o) => s + o.value * stageOf(o.stage).prob, 0);
  var closedRevenue = won.reduce((s, o) => s + o.value, 0);
  var commissionEarned = won.reduce((s, o) => s + window.cnCommission(o), 0);
  var commissionProjected = open.reduce((s, o) => s + window.cnCommission(o) * stageOf(o.stage).prob, 0);
  var winRate = won.length + lost.length > 0 ? won.length / (won.length + lost.length) : 0;
  var _now = new Date();
  var _mEnd = new Date(_now.getFullYear(), _now.getMonth() + 1, 0, 23, 59, 59);
  var _qEnd = new Date(_now.getFullYear(), Math.floor(_now.getMonth() / 3) * 3 + 3, 0, 23, 59, 59);
  var _fc = end => open.reduce((s, o) => {
    if (!o.closeRaw) return s;
    var d = new Date(o.closeRaw);
    if (isNaN(d) || d > end) return s;
    return s + o.value * stageOf(o.stage).prob;
  }, 0);
  var forecastMonth = _fc(_mEnd);
  var forecastQuarter = _fc(_qEnd);
  var scopeLabel = isFounder ? "Team" : "Mine";
  var byStage = window.STAGES.filter(s => s.id !== "lost").map(s => {
    var stageOpps = opps.filter(o => o.stage === s.id);
    return {
      ...s,
      count: stageOpps.length,
      value: stageOpps.reduce((sum, o) => sum + o.value, 0)
    };
  });
  var maxStageVal = Math.max(...byStage.map(s => s.value), 1);
  var upcomingTasks = scenario.activities.filter(a => a.type === "task" && !a.completedAt && (isFounder || a.ownerId === currentUser.id)).sort((a, b) => new Date(a.occurredAt || 0) - new Date(b.occurredAt || 0));
  var recentActivity = scenario.activities.filter(a => a.type !== "task").slice(0, 6);
  var doneTasks = scenario.activities.filter(a => a.type === "task" && a.completedAt && (isFounder || a.ownerId === currentUser.id)).sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
  return React.createElement("div", {
    className: "cn-page"
  }, React.createElement("section", {
    className: "cn-kpi-row"
  }, React.createElement("div", {
    className: "cn-kpi cn-kpi--hero"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, scopeLabel, " \xB7 Open pipeline"), React.createElement("div", {
    className: "cn-kpi-value"
  }, fmtUSD(pipelineValue, {
    compact: true
  })), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", {
    className: "cn-kpi-foot-pri"
  }, open.length, " live deals"), React.createElement("span", {
    className: "cn-kpi-foot-sep"
  }, "\xB7"), React.createElement("span", null, "Weighted ", fmtUSD(weightedValue, {
    compact: true
  })))), React.createElement("div", {
    className: "cn-kpi"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, scopeLabel, " \xB7 Forecast"), React.createElement("div", {
    className: "cn-kpi-value"
  }, fmtUSD(forecastMonth, {
    compact: true
  })), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", {
    className: "cn-kpi-foot-pri"
  }, "likely to close this month"), React.createElement("span", {
    className: "cn-kpi-foot-sep"
  }, "\xB7"), React.createElement("span", null, "Qtr ", fmtUSD(forecastQuarter, {
    compact: true
  })))), React.createElement("div", {
    className: "cn-kpi"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, scopeLabel, " \xB7 Closed \xB7 QTD"), React.createElement("div", {
    className: "cn-kpi-value"
  }, fmtUSD(closedRevenue, {
    compact: true
  })), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", {
    className: "cn-kpi-foot-pri"
  }, won.length, " won"), React.createElement("span", {
    className: "cn-kpi-foot-sep"
  }, "\xB7"), React.createElement("span", null, "Win rate ", (winRate * 100).toFixed(0), "%"))), React.createElement("div", {
    className: "cn-kpi"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, isFounder ? "Team commission" : "Your commission"), React.createElement("div", {
    className: "cn-kpi-value cn-kpi-value--copper"
  }, fmtUSD(commissionEarned, {
    compact: true
  })), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", null, "Projected +", fmtUSD(commissionProjected, {
    compact: true
  })))), React.createElement("div", {
    className: "cn-kpi"
  }, React.createElement("div", {
    className: "cn-kpi-eyebrow"
  }, scopeLabel, " \xB7 Win rate"), React.createElement("div", {
    className: "cn-kpi-value"
  }, (winRate * 100).toFixed(0), React.createElement("span", {
    className: "cn-kpi-unit"
  }, "%")), React.createElement("div", {
    className: "cn-kpi-foot"
  }, React.createElement("span", null, won.length, " won \xB7 ", lost.length, " lost \xB7 ", scenario.period.replace("Quarter to date · ", ""))))), window.MandatesSection && React.createElement(window.MandatesSection, {
    scenario: scenario
  }), window.CnScoreboard && React.createElement(window.CnScoreboard, {
    scenario: scenario,
    currentUser: currentUser,
    isFounder: isFounder
  }), React.createElement("div", {
    className: "cn-grid-2"
  }, React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Pipeline composition"), React.createElement("h2", {
    className: "cn-card-title"
  }, "By stage")), React.createElement("button", {
    className: "cn-link"
  }, "Open pipeline \u2192")), React.createElement("div", {
    className: "cn-stagebars"
  }, byStage.map(s => React.createElement("div", {
    key: s.id,
    className: "cn-stagebar"
  }, React.createElement("div", {
    className: "cn-stagebar-label"
  }, React.createElement("span", {
    className: "cn-stagebar-name"
  }, s.label), React.createElement("span", {
    className: "cn-stagebar-meta"
  }, React.createElement("span", {
    className: "cn-mono"
  }, s.count), " \xB7 ", React.createElement("span", {
    className: "cn-mono"
  }, fmtUSD(s.value, {
    compact: true
  })))), React.createElement("div", {
    className: "cn-stagebar-track"
  }, React.createElement("div", {
    className: `cn-stagebar-fill ${s.id === "won" ? "is-won" : ""}`,
    style: {
      width: `${s.value / maxStageVal * 100}%`
    }
  })))))), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Follow-ups"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Your week")), React.createElement("div", {
    className: "cn-card-head-actions"
  }, React.createElement("button", {
    className: `cn-link ${showDone ? "is-active" : ""}`,
    "aria-pressed": showDone,
    onClick: () => setShowDone(v => !v),
    title: showDone ? "Back to open follow-ups" : "Show completed follow-ups"
  }, showDone ? `Open (${upcomingTasks.length})` : `Done (${doneTasks.length})`), React.createElement("button", {
    className: "cn-link",
    onClick: onAddTask
  }, "+ Add task"))), showDone ? doneTasks.length === 0 ? React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 13,
      padding: "22px 0",
      textAlign: "center"
    }
  }, "Nothing completed yet.") : React.createElement("ul", {
    className: "cn-tasks"
  }, doneTasks.map(t => {
    var opp = opps.find(o => o.id === t.oppId);
    var acct = opp && accountOf(opp.accountId, scenario);
    var owner = repOf(t.ownerId);
    return React.createElement("li", {
      key: t.id,
      className: "cn-task cn-task--done"
    }, React.createElement("input", {
      type: "checkbox",
      className: "cn-checkbox",
      checked: true,
      readOnly: true,
      title: "Completed"
    }), React.createElement("div", {
      className: "cn-task-body"
    }, React.createElement("div", {
      className: "cn-task-title",
      style: {
        textDecoration: "line-through",
        color: "var(--cn-mute)"
      }
    }, t.summary), React.createElement("div", {
      className: "cn-task-meta"
    }, React.createElement("span", {
      className: "cn-task-when"
    }, taskDoneLabel(t.completedAt)), acct && React.createElement("span", null, "\xB7 ", acct.name), owner && React.createElement("span", null, "\xB7"), owner && React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, owner.initials))));
  })) : upcomingTasks.length === 0 ? React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 13,
      padding: "22px 0",
      textAlign: "center"
    }
  }, "Nothing scheduled. ", React.createElement("button", {
    className: "cn-link",
    onClick: onAddTask,
    style: {
      padding: 0
    }
  }, "Add a follow-up \u2192")) : React.createElement("ul", {
    className: "cn-tasks"
  }, upcomingTasks.map(t => {
    var opp = opps.find(o => o.id === t.oppId);
    var acct = opp && accountOf(opp.accountId, scenario);
    var owner = repOf(t.ownerId);
    var {
      label: dueText,
      overdue
    } = taskDueLabel(t.occurredAt);
    return React.createElement("li", {
      key: t.id,
      className: "cn-task"
    }, React.createElement("input", {
      type: "checkbox",
      className: "cn-checkbox",
      checked: false,
      onChange: () => onCompleteTask && onCompleteTask(t),
      title: "Mark complete"
    }), React.createElement("div", {
      className: "cn-task-body"
    }, React.createElement("div", {
      className: "cn-task-title"
    }, t.summary), React.createElement("div", {
      className: "cn-task-meta"
    }, React.createElement("span", {
      className: "cn-task-when",
      style: overdue ? {
        color: "var(--cn-neg)"
      } : null
    }, dueText), acct && React.createElement("span", null, "\xB7 ", acct.name), owner && React.createElement("span", null, "\xB7"), owner && React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, owner.initials))));
  })))), window.CnComplianceGaps && React.createElement(window.CnComplianceGaps, {
    scenario: scenario,
    onOpenAccount: id => { window.location.hash = `#account-${id}`; },
    onOpenContact: id => { window.location.hash = `#contact-${id}`; }
  }), React.createElement("div", {
    className: "cn-grid-2"
  }, React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Live feed"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Recent activity")), React.createElement("button", {
    className: "cn-link",
    onClick: onLogCall
  }, "Log call \u2192")), React.createElement("ul", {
    className: "cn-feed"
  }, recentActivity.map(a => {
    var c = contactOf(a.contactId, scenario);
    var acct = c && accountOf(c.accountId, scenario);
    var opp = opps.find(o => o.id === a.oppId);
    return React.createElement("li", {
      key: a.id,
      className: "cn-feed-item cn-feed-item--clickable",
      onClick: () => onEditActivity && onEditActivity(a)
    }, React.createElement("div", {
      className: `cn-feed-icon cn-feed-icon--${a.type}`
    }, a.type === "call" && "☎", a.type === "email" && "✉", a.type === "note" && "✎", a.type === "won" && "✓"), React.createElement("div", {
      className: "cn-feed-body"
    }, React.createElement("div", {
      className: "cn-feed-head"
    }, React.createElement("span", {
      className: "cn-feed-who"
    }, React.createElement("span", {
      className: "cn-avatar cn-avatar--xs"
    }, repOf(a.ownerId).initials), React.createElement("strong", null, repOf(a.ownerId).name.split(" ")[0]), React.createElement("span", {
      className: "cn-feed-verb"
    }, a.type === "call" && "logged a call with", a.type === "email" && "emailed", a.type === "note" && "added a note on", a.type === "won" && "won"), React.createElement("button", {
      className: "cn-link-inline",
      onClick: () => c && onOpenContact(c.id)
    }, c ? c.name : opp?.title)), React.createElement("span", {
      className: "cn-feed-when"
    }, a.when)), a.summary && React.createElement(window.CNFeedText, {
      text: a.summary,
      lines: 2
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
    }, a.duration && React.createElement("span", {
      className: "cn-chip"
    }, a.duration, " min"), a.sentiment && React.createElement("span", {
      className: `cn-chip cn-chip--${a.sentiment}`
    }, a.sentiment), opp && React.createElement("span", {
      className: "cn-feed-link",
      onClick: () => onOpenOpp && onOpenOpp(opp.id)
    }, opp.title), acct && React.createElement("span", {
      className: "cn-feed-acct"
    }, "\xB7 ", acct.name))));
  }))), React.createElement("section", {
    className: "cn-card"
  }, React.createElement("div", {
    className: "cn-card-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Largest open deals"), React.createElement("h2", {
    className: "cn-card-title"
  }, "Worth your time")), React.createElement("button", {
    className: "cn-link"
  }, "Pipeline \u2192")), React.createElement("table", {
    className: "cn-table cn-table--quiet"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Deal"), React.createElement("th", null, "Stage"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Value"), React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Comm."))), React.createElement("tbody", null, open.sort((a, b) => b.value - a.value).slice(0, 6).map(o => {
    var acct = accountOf(o.accountId, scenario);
    return React.createElement("tr", {
      key: o.id,
      className: "cn-tr-link",
      onClick: () => onOpenOpp && onOpenOpp(o.id)
    }, React.createElement("td", null, React.createElement("div", {
      className: "cn-cell-primary"
    }, o.title, window.cnOtherBadge && window.cnOtherBadge(o)), React.createElement("div", {
      className: "cn-cell-secondary"
    }, acct.name)), React.createElement("td", null, React.createElement(StagePill, {
      stage: o.stage
    })), React.createElement("td", {
      className: "cn-mono",
      style: {
        textAlign: "right"
      }
    }, fmtUSD(o.value, {
      compact: true
    })), React.createElement("td", {
      className: "cn-mono cn-copper",
      style: {
        textAlign: "right"
      }
    }, fmtUSD(window.cnCommission(o), {
      compact: true
    })));
  }))))));
}
function StagePill({
  stage
}) {
  var s = stageOf(stage);
  return React.createElement("span", {
    className: `cn-stage cn-stage--${stage}`
  }, s.label);
}
Object.assign(window, {
  Dashboard,
  StagePill,
  fmtUSD,
  stageOf,
  repOf,
  accountOf,
  contactOf
});