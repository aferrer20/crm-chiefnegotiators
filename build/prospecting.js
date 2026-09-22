var PL_KEY = "cn-prospect-lists";
function readLists() {
  try {
    return JSON.parse(localStorage.getItem(PL_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeLists(lists) {
  localStorage.setItem(PL_KEY, JSON.stringify(lists));
}
function saveProspectList(list) {
  var all = readLists();
  var idx = all.findIndex(l => l.id === list.id);
  var stamped = {
    ...list,
    updatedAt: new Date().toISOString()
  };
  if (idx >= 0) all[idx] = stamped;else all.unshift(stamped);
  writeLists(all);
  if (window.cnProspectSync) {
    window.cnProspectSync.upsertProspectListRemote(stamped, window.__cnCurrentRepId || null);
  }
  return all;
}
function deleteProspectList(id) {
  var all = readLists().filter(l => l.id !== id);
  writeLists(all);
  if (window.cnProspectSync) window.cnProspectSync.deleteProspectListRemote(id);
  return all;
}
async function pullProspectLists() {
  if (!window.cnProspectSync) return null;
  var remote = await window.cnProspectSync.loadProspectListsRemote();
  if (remote === null) return null;
  var local = readLists();
  var byId = new Map();
  local.forEach(l => {
    if (l && l.id) byId.set(l.id, l);
  });
  remote.forEach(r => {
    if (!r || !r.id) return;
    var cur = byId.get(r.id);
    var rT = r.updatedAt || "";
    var cT = cur?.updatedAt || "";
    if (!cur || rT >= cT) byId.set(r.id, r);
  });
  var merged = Array.from(byId.values()).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  writeLists(merged);
  return merged;
}
var _pNewId = p => p + "-" + Math.random().toString(36).slice(2, 10);
var JOB_FUNCTIONS = ["Procurement", "Engineering", "IT", "Executive", "Finance", "Operations", "Marketing", "Sales", "Other"];
var VERTICALS = ["Cloud / Compute", "Finance / Trading", "Healthcare", "Media / Entertainment", "Defense", "Telecom", "Education", "Research", "Other"];
function exportAllListsAsJson() {
  var lists = readLists();
  var payload = {
    kind: "cn-prospect-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    lists
  };
  var blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  var stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `prospect-lists-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return lists.length;
}
function importListsFromJson(text, {
  mode = "merge"
} = {}) {
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error("Not a valid backup file (couldn't parse JSON).");
  }
  var incoming = Array.isArray(parsed) ? parsed : parsed.lists;
  if (!Array.isArray(incoming)) throw new Error("Backup file has no lists array.");
  var cleaned = incoming.filter(l => l && typeof l === "object" && l.name).map(l => ({
    id: l.id || _pNewId("pl"),
    name: String(l.name),
    createdAt: l.createdAt || new Date().toISOString(),
    updatedAt: l.updatedAt || null,
    prospects: Array.isArray(l.prospects) ? l.prospects.map(p => ({
      id: p.id || _pNewId("p"),
      name: p.name || "",
      email: p.email || "",
      title: p.title || "",
      company: p.company || "",
      phone: p.phone || "",
      jobFunction: p.jobFunction || "",
      vertical: p.vertical || "",
      tags: Array.isArray(p.tags) ? p.tags : [],
      addedAt: p.addedAt || new Date().toISOString()
    })) : []
  }));
  if (mode === "replace") {
    writeLists(cleaned);
    if (window.cnProspectSync) cleaned.forEach(l => window.cnProspectSync.upsertProspectListRemote(l, window.__cnCurrentRepId || null));
    return {
      added: cleaned.length,
      replaced: 0,
      skipped: 0,
      total: cleaned.length
    };
  }
  var existing = readLists();
  var byId = new Map(existing.map(l => [l.id, l]));
  var added = 0,
    replaced = 0;
  cleaned.forEach(l => {
    if (byId.has(l.id)) {
      replaced++;
    } else {
      added++;
    }
    byId.set(l.id, l);
  });
  var merged = Array.from(byId.values());
  writeLists(merged);
  if (window.cnProspectSync) cleaned.forEach(l => window.cnProspectSync.upsertProspectListRemote(l, window.__cnCurrentRepId || null));
  return {
    added,
    replaced,
    skipped: incoming.length - cleaned.length,
    total: merged.length
  };
}
window.cnProspects = {
  readLists,
  writeLists,
  saveProspectList,
  deleteProspectList,
  exportAllListsAsJson,
  importListsFromJson,
  JOB_FUNCTIONS,
  VERTICALS
};
function ProspectingScreen({
  scenario,
  currentUser
}) {
  var [lists, setLists] = useState(() => readLists());
  var [activeListId, setActiveListId] = useState(() => readLists()[0]?.id || null);
  var [creatingNew, setCreatingNew] = useState(false);
  var [shared, setShared] = useState(false);
  var importFileRef = useRef(null);
  useEffect(() => {
    window.__cnCurrentRepId = currentUser?.id || null;
  }, [currentUser]);
  useEffect(() => {
    var cancelled = false;
    (async () => {
      var merged = await pullProspectLists();
      if (cancelled || merged === null) return;
      setShared(true);
      setLists(merged);
      setActiveListId(cur => cur || merged[0]?.id || null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  var onBackupAll = () => {
    if (lists.length === 0) {
      alert("Nothing to back up yet.");
      return;
    }
    var n = exportAllListsAsJson();
  };
  var onRestorePick = () => importFileRef.current?.click();
  var onRestoreFile = async e => {
    var file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    var text;
    try {
      text = await file.text();
    } catch {
      alert("Couldn't read that file.");
      return;
    }
    var mode = lists.length > 0 ? confirm("You already have lists in this browser.\n\n" + "OK = MERGE the backup with your current lists " + "(same-ID lists get overwritten by the backup).\n\n" + "Cancel = REPLACE all current lists with the backup " + "(your current lists in this browser will be discarded).") ? "merge" : "replace" : "merge";
    try {
      var summary = importListsFromJson(text, {
        mode
      });
      setLists(readLists());
      alert(`Restore complete.\n\n` + `• Added: ${summary.added}\n` + `• Replaced: ${summary.replaced}\n` + (summary.skipped ? `• Skipped (invalid): ${summary.skipped}\n` : "") + `• Total lists now: ${summary.total}`);
    } catch (err) {
      alert("Restore failed: " + err.message);
    }
  };
  var activeList = lists.find(l => l.id === activeListId);
  var createList = name => {
    var list = {
      id: _pNewId("pl"),
      name,
      createdAt: new Date().toISOString(),
      prospects: []
    };
    setLists(saveProspectList(list));
    setActiveListId(list.id);
  };
  var updateList = patch => {
    if (!activeList) return;
    setLists(saveProspectList({
      ...activeList,
      ...patch
    }));
  };
  var removeList = id => {
    if (!confirm("Delete this prospect list? This can't be undone.")) return;
    var next = deleteProspectList(id);
    setLists(next);
    if (activeListId === id) setActiveListId(next[0]?.id || null);
  };
  return React.createElement("div", {
    className: "cn-page",
    style: {
      padding: 0,
      gap: 20
    }
  }, React.createElement("header", {
    className: "cn-docs-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Prospecting"), React.createElement("h2", {
    className: "cn-card-title",
    style: {
      marginTop: 4
    }
  }, "People you're chasing"), React.createElement("p", {
    style: {
      color: "var(--cn-mute)",
      margin: "6px 0 0",
      maxWidth: 580,
      fontSize: 13.5
    }
  }, "Build lists of people you want to talk to but haven't yet. Organize by job function or vertical, download to Excel, or fire off an email campaign."))), React.createElement("div", {
    className: "cn-prospect-layout"
  }, React.createElement("aside", {
    className: "cn-prospect-rail"
  }, React.createElement("div", {
    className: "cn-prospect-rail-head"
  }, React.createElement("h3", {
    className: "cn-side-title",
    style: {
      margin: 0
    }
  }, "Lists"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      height: 28,
      padding: "4px 10px",
      fontSize: 12
    },
    onClick: () => setCreatingNew(true)
  }, "+ New")), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      padding: "0 4px 8px"
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 26,
      padding: "4px 8px",
      fontSize: 11.5,
      flex: 1
    },
    onClick: onBackupAll,
    title: "Download all lists as a JSON backup file"
  }, "\u2913 Backup"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 26,
      padding: "4px 8px",
      fontSize: 11.5,
      flex: 1
    },
    onClick: onRestorePick,
    title: "Restore lists from a backup JSON file"
  }, "\u2912 Restore"), React.createElement("input", {
    ref: importFileRef,
    type: "file",
    accept: "application/json,.json",
    style: {
      display: "none"
    },
    onChange: onRestoreFile
  })), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: "var(--cn-mute)",
      padding: "0 4px 10px",
      lineHeight: 1.45,
      fontFamily: "var(--cn-mono)"
    },
    title: shared ? "Lists are synced to your team's shared database — every rep sees the same set, on any device. A local copy is also kept for offline use." : "Lists are saved to this browser only (the shared database isn't enabled yet — run migrations/04_prospect_lists.sql). Back up regularly."
  }, shared ? "✓ Shared with your team · synced" : "Saved in this browser only. Back up regularly →"), lists.length === 0 && !creatingNew && React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12.5,
      padding: "12px 4px"
    }
  }, "No lists yet."), lists.map(l => React.createElement("button", {
    key: l.id,
    className: `cn-prospect-rail-item ${activeListId === l.id ? "is-active" : ""}`,
    onClick: () => setActiveListId(l.id)
  }, React.createElement("span", {
    className: "cn-prospect-rail-label"
  }, l.name), React.createElement("span", {
    className: "cn-prospect-rail-count"
  }, l.prospects?.length || 0))), creatingNew && React.createElement(NewListInput, {
    onCreate: name => {
      createList(name);
      setCreatingNew(false);
    },
    onCancel: () => setCreatingNew(false)
  })), React.createElement("section", {
    className: "cn-prospect-main"
  }, !activeList ? React.createElement("div", {
    className: "cn-docs-empty"
  }, React.createElement("div", {
    className: "cn-docs-empty-title"
  }, "No list selected"), React.createElement("div", {
    className: "cn-docs-empty-sub"
  }, "Create your first prospect list to start tracking people you're chasing."), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    style: {
      marginTop: 14
    },
    onClick: () => setCreatingNew(true)
  }, "+ New list")) : React.createElement(ProspectListView, {
    list: activeList,
    scenario: scenario,
    currentUser: currentUser,
    onUpdate: updateList,
    onDelete: () => removeList(activeList.id)
  }))));
}
function NewListInput({
  onCreate,
  onCancel
}) {
  var [name, setName] = useState("");
  return React.createElement("form", {
    className: "cn-prospect-rail-newform",
    onSubmit: e => {
      e.preventDefault();
      if (name.trim()) onCreate(name.trim());
    }
  }, React.createElement("input", {
    className: "cn-input",
    placeholder: "List name\u2026",
    value: name,
    onChange: e => setName(e.target.value),
    autoFocus: true,
    style: {
      height: 30,
      fontSize: 12.5
    }
  }), React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      marginTop: 4
    }
  }, React.createElement("button", {
    type: "submit",
    className: "cn-btn cn-btn--primary",
    style: {
      height: 26,
      fontSize: 11.5,
      flex: 1
    }
  }, "Create"), React.createElement("button", {
    type: "button",
    className: "cn-btn cn-btn--ghost",
    style: {
      height: 26,
      fontSize: 11.5
    },
    onClick: onCancel
  }, "Cancel")));
}
function ProspectListView({
  list,
  scenario,
  currentUser,
  onUpdate,
  onDelete
}) {
  var [selectedIds, setSelectedIds] = useState(new Set());
  var [groupBy, setGroupBy] = useState("none");
  var [search, setSearch] = useState("");
  var [addingProspect, setAddingProspect] = useState(false);
  var [bulkPasteOpen, setBulkPasteOpen] = useState(false);
  var [campaignOpen, setCampaignOpen] = useState(false);
  var [editingName, setEditingName] = useState(false);
  var [draftName, setDraftName] = useState(list.name);
  var prospects = list.prospects || [];
  var filtered = prospects.filter(p => {
    if (!search) return true;
    var s = search.toLowerCase();
    return (p.name || "").toLowerCase().includes(s) || (p.email || "").toLowerCase().includes(s) || (p.company || "").toLowerCase().includes(s) || (p.title || "").toLowerCase().includes(s);
  });
  var groups = (() => {
    if (groupBy === "none") return [{
      key: null,
      items: filtered
    }];
    var map = {};
    filtered.forEach(p => {
      var key = groupBy === "tags" ? p.tags?.[0] || "Untagged" : p[groupBy] || "Unspecified";
      (map[key] = map[key] || []).push(p);
    });
    return Object.entries(map).map(([key, items]) => ({
      key,
      items
    })).sort((a, b) => a.key.localeCompare(b.key));
  })();
  var allChecked = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));
  var toggleAll = () => {
    if (allChecked) setSelectedIds(new Set());else setSelectedIds(new Set(filtered.map(p => p.id)));
  };
  var toggle = id => {
    var next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);else next.add(id);
    setSelectedIds(next);
  };
  var addProspect = p => {
    var np = {
      id: _pNewId("p"),
      addedAt: new Date().toISOString(),
      ...p
    };
    onUpdate({
      prospects: [np, ...prospects]
    });
    setAddingProspect(false);
  };
  var updateProspect = (id, patch) => {
    onUpdate({
      prospects: prospects.map(p => p.id === id ? {
        ...p,
        ...patch
      } : p)
    });
  };
  var removeProspect = id => {
    if (!confirm("Remove this prospect from the list?")) return;
    onUpdate({
      prospects: prospects.filter(p => p.id !== id)
    });
    setSelectedIds(prev => {
      var n = new Set(prev);
      n.delete(id);
      return n;
    });
  };
  var removeSelected = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Remove ${selectedIds.size} prospect${selectedIds.size === 1 ? "" : "s"} from "${list.name}"? This does not affect anyone already emailed.`)) return;
    onUpdate({
      prospects: prospects.filter(p => !selectedIds.has(p.id))
    });
    setSelectedIds(new Set());
  };
  var addBulk = rows => {
    var newProspects = rows.map(r => ({
      ...r,
      id: _pNewId("p"),
      addedAt: new Date().toISOString()
    }));
    onUpdate({
      prospects: [...newProspects, ...prospects]
    });
    setBulkPasteOpen(false);
  };
  var downloadCsv = () => {
    var rows = selectedIds.size > 0 ? prospects.filter(p => selectedIds.has(p.id)) : prospects;
    if (rows.length === 0) return;
    var headers = ["Name", "Email", "Title", "Company", "Phone", "Job function", "Vertical", "Tags", "Added"];
    var esc = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    var lines = [headers.join(",")];
    rows.forEach(p => {
      lines.push([esc(p.name), esc(p.email), esc(p.title), esc(p.company), esc(p.phone), esc(p.jobFunction), esc(p.vertical), esc((p.tags || []).join("; ")), esc(p.addedAt ? new Date(p.addedAt).toLocaleDateString() : "")].join(","));
    });
    var csv = "\uFEFF" + lines.join("\n");
    var blob = new Blob([csv], {
      type: "text/csv;charset=utf-8"
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = `${list.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  var renameList = () => {
    var n = draftName.trim();
    if (!n) {
      setDraftName(list.name);
      setEditingName(false);
      return;
    }
    onUpdate({
      name: n
    });
    setEditingName(false);
  };
  var sendCampaign = () => {
    var rows = selectedIds.size > 0 ? prospects.filter(p => selectedIds.has(p.id) && p.email) : prospects.filter(p => p.email);
    if (rows.length === 0) {
      alert("None of the selected prospects have an email address.");
      return;
    }
    setCampaignOpen({
      recipients: rows
    });
  };
  var totalSel = selectedIds.size;
  var targetCount = totalSel > 0 ? totalSel : prospects.length;
  var targetVerb = totalSel > 0 ? "selected" : "all";
  return React.createElement("div", {
    className: "cn-prospect-listview"
  }, React.createElement("header", {
    className: "cn-prospect-listhead"
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, editingName ? React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      renameList();
    },
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center"
    }
  }, React.createElement("input", {
    className: "cn-input",
    value: draftName,
    onChange: e => setDraftName(e.target.value),
    autoFocus: true,
    onBlur: renameList,
    style: {
      maxWidth: 320,
      fontSize: 16,
      fontWeight: 500
    }
  })) : React.createElement("h2", {
    className: "cn-card-title",
    onClick: () => {
      setDraftName(list.name);
      setEditingName(true);
    },
    style: {
      cursor: "pointer",
      margin: 0
    },
    title: "Click to rename"
  }, list.name), React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12.5,
      marginTop: 4
    }
  }, prospects.length, " prospect", prospects.length === 1 ? "" : "s", totalSel > 0 && React.createElement("span", null, " \xB7 ", totalSel, " selected"))), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexShrink: 0
    }
  }, React.createElement("input", {
    className: "cn-input",
    placeholder: "Search\u2026",
    value: search,
    onChange: e => setSearch(e.target.value),
    style: {
      width: 180
    }
  }), React.createElement("select", {
    className: "cn-input",
    value: groupBy,
    onChange: e => setGroupBy(e.target.value),
    style: {
      width: 170
    }
  }, React.createElement("option", {
    value: "none"
  }, "No grouping"), React.createElement("option", {
    value: "jobFunction"
  }, "Group by function"), React.createElement("option", {
    value: "vertical"
  }, "Group by vertical"), React.createElement("option", {
    value: "tags"
  }, "Group by tag")), React.createElement("button", {
    className: "cn-btn cn-btn--danger",
    onClick: onDelete
  }, "Delete list"))), React.createElement("div", {
    className: "cn-prospect-toolbar"
  }, React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setAddingProspect(true)
  }, "+ Add prospect"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setBulkPasteOpen(true)
  }, "\u2197 Bulk paste")), React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 8
    }
  }, selectedIds.size > 0 && React.createElement("button", {
    className: "cn-btn cn-btn--danger",
    onClick: removeSelected
  }, "\u2715 Remove ", selectedIds.size, " selected"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: downloadCsv,
    disabled: prospects.length === 0
  }, "\u2913 Download ", targetCount, " as Excel/CSV"), React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: sendCampaign,
    disabled: prospects.length === 0
  }, "\u2709 Email ", targetCount, " ", targetVerb))), prospects.length === 0 ? React.createElement("div", {
    className: "cn-docs-empty"
  }, React.createElement("div", {
    className: "cn-docs-empty-title"
  }, "No prospects yet"), React.createElement("div", {
    className: "cn-docs-empty-sub"
  }, "Add one manually, or paste a list from a spreadsheet."), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "center",
      marginTop: 14
    }
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: () => setAddingProspect(true)
  }, "+ Add prospect"), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: () => setBulkPasteOpen(true)
  }, "\u2197 Bulk paste"))) : React.createElement("section", {
    className: "cn-card cn-card--flush"
  }, React.createElement("table", {
    className: "cn-table cn-prospect-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      width: 36
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: allChecked,
    onChange: toggleAll,
    "aria-label": "Select all"
  })), React.createElement("th", null, "Name"), React.createElement("th", null, "Email"), React.createElement("th", null, "Title"), React.createElement("th", null, "Company"), React.createElement("th", null, "Phone"), React.createElement("th", null, "Function"), React.createElement("th", null, "Vertical"), React.createElement("th", {
    style: {
      width: 36
    }
  }))), React.createElement("tbody", null, groups.map((group, gi) => React.createElement(Fragment, {
    key: group.key ?? "all-" + gi
  }, group.key && React.createElement("tr", {
    className: "cn-prospect-group-row"
  }, React.createElement("td", {
    colSpan: 9
  }, React.createElement("span", {
    className: "cn-prospect-group-label"
  }, group.key), React.createElement("span", {
    className: "cn-prospect-group-count"
  }, "\xB7 ", group.items.length))), group.items.map(p => React.createElement(ProspectRow, {
    key: p.id,
    p: p,
    selected: selectedIds.has(p.id),
    onToggle: () => toggle(p.id),
    onUpdate: patch => updateProspect(p.id, patch),
    onDelete: () => removeProspect(p.id)
  }))))))), addingProspect && React.createElement(ProspectFormModal, {
    onClose: () => setAddingProspect(false),
    onSave: addProspect
  }), bulkPasteOpen && React.createElement(BulkPasteModal, {
    onClose: () => setBulkPasteOpen(false),
    onAdd: addBulk
  }), campaignOpen && React.createElement(CampaignFromProspects, {
    prospects: campaignOpen.recipients,
    scenario: scenario,
    currentUser: currentUser,
    onClose: () => setCampaignOpen(false)
  }));
}
function ProspectRow({
  p,
  selected,
  onToggle,
  onDelete
}) {
  return React.createElement("tr", {
    className: selected ? "is-selected" : ""
  }, React.createElement("td", null, React.createElement("input", {
    type: "checkbox",
    checked: selected,
    onChange: onToggle
  })), React.createElement("td", null, React.createElement("div", {
    className: "cn-row-person"
  }, React.createElement("span", {
    className: "cn-avatar cn-avatar--xs"
  }, (p.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()), React.createElement("div", {
    className: "cn-cell-primary"
  }, p.name || "—"))), React.createElement("td", {
    className: "cn-mono cn-cell-secondary",
    style: {
      fontSize: 12
    }
  }, p.email ? window.isValidEmailAddress && window.isValidEmailAddress(p.email) ? p.email : React.createElement("span", {
    title: "This email looks malformed \u2014 Resend will reject it. Edit the prospect to fix.",
    style: {
      color: "#B0331E",
      display: "inline-flex",
      alignItems: "center",
      gap: 4
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11
    }
  }, "\u26A0"), React.createElement("span", {
    style: {
      textDecoration: "underline",
      textDecorationStyle: "dotted",
      textUnderlineOffset: 2
    }
  }, p.email)) : "—"), React.createElement("td", {
    className: "cn-cell-secondary"
  }, p.title || "—"), React.createElement("td", null, p.company || "—"), React.createElement("td", {
    className: "cn-mono cn-cell-secondary",
    style: {
      fontSize: 12
    }
  }, p.phone || "—"), React.createElement("td", {
    className: "cn-cell-secondary"
  }, p.jobFunction || "—"), React.createElement("td", {
    className: "cn-cell-secondary"
  }, p.vertical || "—"), React.createElement("td", {
    style: {
      textAlign: "right"
    }
  }, React.createElement("button", {
    className: "cn-icon-btn cn-icon-btn--danger",
    onClick: onDelete,
    title: "Remove"
  }, "\u2715")));
}
function ProspectFormModal({
  onClose,
  onSave,
  prospect
}) {
  var [draft, setDraft] = useState(prospect || {
    name: "",
    email: "",
    title: "",
    company: "",
    phone: "",
    jobFunction: "",
    vertical: "",
    tags: []
  });
  var [tagInput, setTagInput] = useState("");
  var [err, setErr] = useState(null);
  var update = patch => setDraft(d => ({
    ...d,
    ...patch
  }));
  var save = () => {
    if (!draft.name.trim()) {
      setErr("Give the prospect a name.");
      return;
    }
    onSave(draft);
  };
  var addTag = () => {
    var t = tagInput.trim();
    if (!t) return;
    update({
      tags: [...(draft.tags || []), t]
    });
    setTagInput("");
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
      maxWidth: 600
    },
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, prospect ? "Edit" : "New", " prospect"), React.createElement("h2", {
    className: "cn-modal-title"
  }, draft.name || "Untitled")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body"
  }, React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Name"), React.createElement("input", {
    className: "cn-input",
    value: draft.name,
    onChange: e => update({
      name: e.target.value
    }),
    autoFocus: true
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1.4
    }
  }, React.createElement("label", null, "Email"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: draft.email,
    onChange: e => update({
      email: e.target.value
    }),
    placeholder: "jane@company.com"
  }))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Title"), React.createElement("input", {
    className: "cn-input",
    value: draft.title,
    onChange: e => update({
      title: e.target.value
    }),
    placeholder: "VP Procurement"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Company"), React.createElement("input", {
    className: "cn-input",
    value: draft.company,
    onChange: e => update({
      company: e.target.value
    }),
    placeholder: "Acme Corp"
  }))), React.createElement("div", {
    className: "cn-field-row"
  }, React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Phone"), React.createElement("input", {
    className: "cn-input cn-mono",
    style: {
      fontSize: 12.5
    },
    value: draft.phone,
    onChange: e => update({
      phone: e.target.value
    }),
    placeholder: "+1 555 \u2026"
  })), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Job function"), React.createElement("select", {
    className: "cn-input",
    value: draft.jobFunction,
    onChange: e => update({
      jobFunction: e.target.value
    })
  }, React.createElement("option", {
    value: ""
  }, "\u2014"), JOB_FUNCTIONS.map(f => React.createElement("option", {
    key: f,
    value: f
  }, f)))), React.createElement("div", {
    className: "cn-field",
    style: {
      flex: 1
    }
  }, React.createElement("label", null, "Vertical"), React.createElement("select", {
    className: "cn-input",
    value: draft.vertical,
    onChange: e => update({
      vertical: e.target.value
    })
  }, React.createElement("option", {
    value: ""
  }, "\u2014"), VERTICALS.map(v => React.createElement("option", {
    key: v,
    value: v
  }, v))))), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Tags ", React.createElement("span", {
    style: {
      color: "var(--cn-mute)",
      textTransform: "none",
      letterSpacing: 0,
      fontSize: 11
    }
  }, "\xB7 custom, comma- or Enter-separated")), React.createElement("div", {
    className: "cn-prospect-taginput"
  }, (draft.tags || []).map((t, i) => React.createElement("span", {
    key: i,
    className: "cn-doc-attach-pill"
  }, t, React.createElement("button", {
    onClick: () => update({
      tags: draft.tags.filter((_, j) => j !== i)
    }),
    type: "button"
  }, "\u2715"))), React.createElement("input", {
    value: tagInput,
    onChange: e => setTagInput(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag();
      } else if (e.key === "Backspace" && !tagInput && (draft.tags?.length || 0) > 0) {
        update({
          tags: draft.tags.slice(0, -1)
        });
      }
    },
    placeholder: (draft.tags?.length || 0) === 0 ? "e.g. hot-lead, west-coast, AI startup" : ""
  }))), err && React.createElement("div", {
    className: "cn-login-error",
    style: {
      marginTop: 8
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
  }, "Save prospect")))));
}
function BulkPasteModal({
  onClose,
  onAdd
}) {
  var [text, setText] = useState("");
  var [preview, setPreview] = useState([]);
  var [err, setErr] = useState(null);
  var [loadingFile, setLoadingFile] = useState(false);
  var fileInputRef = useRef(null);
  var parse = raw => {
    var lines = raw.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return [];
    var firstLower = lines[0].toLowerCase();
    var hasHeader = firstLower.includes("name") || firstLower.includes("email") || firstLower.includes("title");
    var headers = hasHeader ? lines[0].split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(h => h.trim().toLowerCase().replace(/^"|"$/g, "")) : null;
    var dataLines = hasHeader ? lines.slice(1) : lines;
    var findIdx = (...names) => {
      if (!headers) return -1;
      var _loop = function (n) {
          var i = headers.findIndex(h => h.includes(n));
          if (i >= 0) return {
            v: i
          };
        },
        _ret;
      for (var n of names) {
        _ret = _loop(n);
        if (_ret) return _ret.v;
      }
      return -1;
    };
    var idx = headers ? {
      name: findIdx("name"),
      email: findIdx("email"),
      title: findIdx("title", "role"),
      company: findIdx("company", "organization", "employer"),
      phone: findIdx("phone", "mobile", "tel"),
      jobFunction: findIdx("function", "department"),
      vertical: findIdx("vertical", "industry"),
      tags: findIdx("tag")
    } : {
      name: 0,
      email: 1,
      title: 2,
      company: 3,
      phone: 4,
      jobFunction: 5,
      vertical: 6,
      tags: 7
    };
    return dataLines.map(line => {
      var parts = line.includes("\t") ? line.split("\t") : line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      var get = i => {
        if (i < 0 || i >= parts.length) return "";
        return parts[i].replace(/^"|"$/g, "").replace(/""/g, '"').trim();
      };
      return {
        name: get(idx.name),
        email: get(idx.email),
        title: get(idx.title),
        company: get(idx.company),
        phone: get(idx.phone),
        jobFunction: get(idx.jobFunction),
        vertical: get(idx.vertical),
        tags: get(idx.tags).split(/[;|]/).map(s => s.trim()).filter(Boolean)
      };
    }).filter(p => p.name || p.email);
  };
  var updateText = val => {
    setText(val);
    try {
      setPreview(parse(val));
      setErr(null);
    } catch (e) {
      setErr(e.message);
      setPreview([]);
    }
  };
  var loadSheetJS = () => {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (window.__sheetjsPromise) return window.__sheetjsPromise;
    window.__sheetjsPromise = new Promise((resolve, reject) => {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => reject(new Error("Couldn't load XLSX parser. Save your file as CSV and try again."));
      document.head.appendChild(s);
    });
    return window.__sheetjsPromise;
  };
  var handleFile = async f => {
    if (!f) return;
    setErr(null);
    setLoadingFile(true);
    try {
      var name = f.name.toLowerCase();
      var isExcel = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".xlsm");
      if (isExcel) {
        var XLSX = await loadSheetJS();
        var buf = await f.arrayBuffer();
        var wb = XLSX.read(buf, {
          type: "array"
        });
        var sheet = wb.Sheets[wb.SheetNames[0]];
        var csv = XLSX.utils.sheet_to_csv(sheet);
        updateText(csv);
      } else {
        var txt = await f.text();
        updateText(txt);
      }
    } catch (e) {
      setErr(e.message || "Couldn't read that file.");
    } finally {
      setLoadingFile(false);
    }
  };
  var onDrop = e => {
    e.preventDefault();
    e.currentTarget.classList.remove("is-over");
    var f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  };
  var submit = () => {
    if (preview.length === 0) {
      setErr("No rows detected. Use one prospect per line.");
      return;
    }
    onAdd(preview);
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
      maxWidth: 760,
      maxHeight: "90vh",
      display: "flex",
      flexDirection: "column"
    },
    onClick: e => e.stopPropagation()
  }, React.createElement("header", {
    className: "cn-modal-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "cn-card-eyebrow"
  }, "Bulk import"), React.createElement("h2", {
    className: "cn-modal-title"
  }, "Add prospects from a file or paste")), React.createElement("button", {
    className: "cn-icon-btn",
    onClick: onClose
  }, "\u2715")), React.createElement("div", {
    className: "cn-modal-body",
    style: {
      overflow: "auto"
    }
  }, React.createElement("div", {
    className: "cn-doc-drop",
    style: {
      marginBottom: 14
    },
    onDragOver: e => {
      e.preventDefault();
      e.currentTarget.classList.add("is-over");
    },
    onDragLeave: e => e.currentTarget.classList.remove("is-over"),
    onDrop: onDrop,
    onClick: () => fileInputRef.current?.click()
  }, React.createElement("div", {
    className: "cn-doc-drop-empty"
  }, React.createElement("div", {
    className: "cn-doc-drop-icon-lg"
  }, loadingFile ? "…" : "⤴"), React.createElement("div", {
    className: "cn-doc-drop-title"
  }, loadingFile ? "Reading file…" : "Drop a CSV or Excel file, or click to upload"), React.createElement("div", {
    className: "cn-doc-drop-sub"
  }, ".csv, .tsv, .xlsx, .xls \u2014 first row treated as headers if it contains \"Name\" or \"Email\"")), React.createElement("input", {
    ref: fileInputRef,
    type: "file",
    accept: ".csv,.tsv,.txt,.xls,.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel",
    style: {
      display: "none"
    },
    onChange: e => handleFile(e.target.files?.[0])
  })), React.createElement("div", {
    style: {
      color: "var(--cn-mute)",
      fontSize: 12.5,
      marginBottom: 8
    }
  }, "\u2026or paste directly. Columns (tab- or comma-separated):", React.createElement("span", {
    className: "cn-mono",
    style: {
      display: "block",
      marginTop: 4
    }
  }, "Name, Email, Title, Company, Phone, Job function, Vertical, Tags"), React.createElement("span", {
    style: {
      display: "block",
      marginTop: 4
    }
  }, "If your headers are named, we'll match them automatically. Tags can be separated by ", React.createElement("span", {
    className: "cn-mono"
  }, ";"), " or ", React.createElement("span", {
    className: "cn-mono"
  }, "|"), ".")), React.createElement("textarea", {
    className: "cn-textarea cn-mono",
    style: {
      minHeight: 140,
      fontSize: 12.5
    },
    value: text,
    onChange: e => updateText(e.target.value),
    placeholder: "Jane Doe, jane@acme.com, VP Procurement, Acme Corp, 555-1234, Procurement, Cloud / Compute, hot-lead\nJohn Smith\tjohn@globex.com\tCFO\tGlobex\t555-9999\tFinance\tFinance / Trading"
  }), preview.length > 0 && React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, React.createElement("div", {
    className: "cn-card-eyebrow",
    style: {
      marginBottom: 6
    }
  }, "Preview \xB7 ", preview.length, " row", preview.length === 1 ? "" : "s"), React.createElement("div", {
    style: {
      maxHeight: 240,
      overflow: "auto",
      border: "1px solid var(--cn-line)",
      borderRadius: "var(--cn-r)"
    }
  }, React.createElement("table", {
    className: "cn-table",
    style: {
      fontSize: 11.5
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Name"), React.createElement("th", null, "Email"), React.createElement("th", null, "Title"), React.createElement("th", null, "Company"), React.createElement("th", null, "Function"))), React.createElement("tbody", null, preview.slice(0, 12).map((p, i) => React.createElement("tr", {
    key: i
  }, React.createElement("td", null, p.name || "—"), React.createElement("td", {
    className: "cn-mono"
  }, p.email || "—"), React.createElement("td", null, p.title || "—"), React.createElement("td", null, p.company || "—"), React.createElement("td", null, p.jobFunction || "—"))))), preview.length > 12 && React.createElement("div", {
    style: {
      padding: 8,
      textAlign: "center",
      color: "var(--cn-mute)",
      fontSize: 11.5
    }
  }, "+ ", preview.length - 12, " more"))), err && React.createElement("div", {
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
    onClick: submit,
    disabled: preview.length === 0
  }, "Add ", preview.length, " prospect", preview.length === 1 ? "" : "s")))));
}
function CampaignFromProspects({
  prospects,
  scenario,
  currentUser,
  onClose
}) {
  var ids = React.useMemo(() => {
    return prospects.map(p => {
      var id = "prospect-" + Math.random().toString(36).slice(2, 9);
      scenario.contacts.push({
        id,
        name: p.name || p.email || "Unnamed prospect",
        email: p.email,
        title: p.title || "Prospect",
        accountId: null,
        tier: "Influencer"
      });
      return id;
    });
  }, []);
  if (!window.CampaignBuilder) {
    return React.createElement("div", {
      className: "cn-modal-scrim",
      onClick: onClose,
      style: {
        zIndex: 160
      }
    }, React.createElement("div", {
      className: "cn-modal",
      onClick: e => e.stopPropagation()
    }, React.createElement("div", {
      className: "cn-modal-body"
    }, "Couldn't open campaign builder.")));
  }
  return React.createElement(window.CampaignBuilder, {
    scenario: scenario,
    currentUser: currentUser,
    onClose: onClose,
    onSaved: () => onClose(),
    initialManualIds: ids
  });
}
Object.assign(window, {
  ProspectingScreen,
  ProspectListView,
  ProspectFormModal,
  BulkPasteModal,
  CampaignFromProspects
});