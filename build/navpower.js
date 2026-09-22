window.CN_VIEWS = [{
  id: "dashboard",
  label: "Dashboard",
  icon: "◐",
  section: "Overview",
  key: "d"
}, {
  id: "pipeline",
  label: "Pipeline",
  icon: "▤",
  section: "Pipeline",
  key: "p"
}, {
  id: "mandates",
  label: "Mandates",
  icon: "◎",
  section: "Pipeline",
  key: "m"
}, {
  id: "introductions",
  label: "Introductions",
  icon: "‹›",
  section: "Pipeline"
}, {
  id: "quotes",
  label: "Quotes",
  icon: "$",
  section: "Pipeline",
  key: "q"
}, {
  id: "rfq",
  label: "RFQ",
  icon: "⊞",
  section: "Pipeline",
  key: "r"
}, {
  id: "sales-hub",
  label: "Sales Hub",
  icon: "✍",
  section: "Pipeline",
  key: "h"
}, {
  id: "partners",
  label: "Partners",
  icon: "▦",
  section: "Relationships"
}, {
  id: "contacts",
  label: "Contacts",
  icon: "◉",
  section: "Relationships",
  key: "c"
}, {
  id: "accounts",
  label: "Accounts",
  icon: "▢",
  section: "Relationships",
  key: "a"
}, {
  id: "calls",
  label: "Calls",
  icon: "☎",
  section: "Relationships"
}, {
  id: "activity",
  label: "Activity",
  icon: "≡",
  section: "Relationships"
}, {
  id: "outreach",
  label: "Outreach",
  icon: "✉",
  section: "Growth",
  key: "o"
}, {
  id: "prospecting",
  label: "Prospecting",
  icon: "◎",
  section: "Growth"
}, {
  id: "documents",
  label: "Documents",
  icon: "▤",
  section: "Library",
  key: "l"
}, {
  id: "finance",
  label: "Finance",
  icon: "▦",
  section: "Finance",
  gated: true,
  key: "f"
}, {
  id: "reports",
  label: "Reports",
  icon: "△",
  section: "Finance"
}];
var CN_VIEW_MAP = Object.fromEntries(window.CN_VIEWS.map(v => [v.id, v]));
CN_VIEW_MAP["contact-detail"] = {
  id: "contact-detail",
  label: "Contact",
  icon: "◉",
  section: "Relationships"
};
CN_VIEW_MAP["account-detail"] = {
  id: "account-detail",
  label: "Account",
  icon: "▢",
  section: "Relationships"
};
window.cnViewMeta = id => CN_VIEW_MAP[id] || {
  id,
  label: id,
  icon: "•"
};
var CN_MRU_MAX = 7;
var inField = el => !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
var CN_RAIL_KEY = "cn-rail";
try {
  if (localStorage.getItem(CN_RAIL_KEY) === "1") document.body.classList.add("cn-rail");
} catch (e) {}
window.cnToggleRail = () => {
  var on = document.body.classList.toggle("cn-rail");
  try {
    localStorage.setItem(CN_RAIL_KEY, on ? "1" : "0");
  } catch (e) {}
  window.dispatchEvent(new Event("cn-rail-change"));
  return on;
};
function useCnNav(initial) {
  var [st, setSt] = React.useState({
    stack: [initial],
    i: 0,
    mru: [initial]
  });
  var view = st.stack[st.i];
  var prevRef = React.useRef(null);
  var lastViewRef = React.useRef(view);
  React.useEffect(() => {
    if (lastViewRef.current !== view) {
      prevRef.current = lastViewRef.current;
      lastViewRef.current = view;
    }
  }, [view]);
  var go = React.useCallback(v => {
    setSt(s => {
      var cur = s.stack[s.i];
      var next = typeof v === "function" ? v(cur) : v;
      if (!next || next === cur) return s;
      var stack = s.stack.slice(Math.max(0, s.i - 40), s.i + 1).concat([next]);
      var mru = s.mru.includes(next) ? s.mru : s.mru.concat([next]);
      var _loop = function () {
        var drop = mru.find(m => m !== next && m !== cur);
        if (!drop) return 1;
        mru = mru.filter(m => m !== drop);
      };
      while (mru.length > CN_MRU_MAX) {
        if (_loop()) break;
      }
      return {
        stack,
        i: stack.length - 1,
        mru
      };
    });
  }, []);
  var back = React.useCallback(() => setSt(s => s.i > 0 ? {
    ...s,
    i: s.i - 1
  } : s), []);
  var fwd = React.useCallback(() => setSt(s => s.i < s.stack.length - 1 ? {
    ...s,
    i: s.i + 1
  } : s), []);
  var closeTab = React.useCallback(id => setSt(s => s.mru.length < 2 ? s : {
    ...s,
    mru: s.mru.filter(m => m !== id)
  }), []);
  var nav = {
    view,
    go,
    back,
    fwd,
    closeTab,
    canBack: st.i > 0,
    canFwd: st.i < st.stack.length - 1,
    tabs: st.mru,
    prev: prevRef.current
  };
  var navRef = React.useRef(nav);
  navRef.current = nav;
  React.useEffect(() => {
    var onKey = e => {
      var n = navRef.current;
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          return n.back();
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          return n.fwd();
        }
        if (/^[1-9]$/.test(e.key)) {
          var t = n.tabs[Number(e.key) - 1];
          if (t) {
            e.preventDefault();
            n.go(t);
          }
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        return window.cnToggleRail();
      }
      if (inField(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "`") {
        e.preventDefault();
        if (n.prev) n.go(n.prev);
        return;
      }
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        var once = ev => {
          window.removeEventListener("keydown", once, true);
          var hit = window.CN_VIEWS.find(v => v.key && v.key === String(ev.key || "").toLowerCase());
          if (hit) {
            ev.preventDefault();
            navRef.current.go(hit.id);
          }
        };
        window.addEventListener("keydown", once, true);
        setTimeout(() => window.removeEventListener("keydown", once, true), 1400);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return nav;
}
function NavStrip({
  nav,
  currentUser
}) {
  var [, force] = React.useState(0);
  var tabsRef = React.useRef(null);
  React.useEffect(() => {
    var h = () => force(x => x + 1);
    window.addEventListener("cn-rail-change", h);
    return () => window.removeEventListener("cn-rail-change", h);
  }, []);
  React.useEffect(() => {
    var box = tabsRef.current;
    if (!box) return;
    var el = box.querySelector(".cn-tab.is-active");
    if (!el) return;
    var max = box.scrollWidth - box.clientWidth;
    if (max <= 0) return;
    var centered = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
    box.scrollLeft = Math.max(0, Math.min(centered, max));
  }, [nav.view, nav.tabs.length]);
  var railed = document.body.classList.contains("cn-rail");
  var cross = window.CN_CROSS;
  var isAdmin = cross && currentUser && cross.isCrossBrandAdmin(currentUser);
  var prevMeta = nav.prev ? window.cnViewMeta(nav.prev) : null;
  return React.createElement("div", {
    className: "cn-strip"
  }, React.createElement("button", {
    className: "cn-strip-icon",
    title: railed ? "Expand sidebar  ⌘\\" : "Collapse sidebar  ⌘\\",
    onClick: () => window.cnToggleRail()
  }, railed ? "»" : "«"), React.createElement("span", {
    className: "cn-strip-sep"
  }), React.createElement("button", {
    className: "cn-strip-icon",
    disabled: !nav.canBack,
    title: "Back  \u2325\u2190",
    onClick: nav.back
  }, "\u2039"), React.createElement("button", {
    className: "cn-strip-icon",
    disabled: !nav.canFwd,
    title: "Forward  \u2325\u2192",
    onClick: nav.fwd
  }, "\u203A"), React.createElement("span", {
    className: "cn-strip-sep"
  }), React.createElement("div", {
    className: "cn-strip-tabs",
    ref: tabsRef
  }, nav.tabs.map((id, i) => {
    var m = window.cnViewMeta(id);
    var active = id === nav.view;
    return React.createElement("span", {
      key: id,
      className: `cn-tab ${active ? "is-active" : ""}`
    }, React.createElement("button", {
      className: "cn-tab-main",
      onClick: () => nav.go(id),
      title: `${m.label}  ⌥${i + 1}`
    }, React.createElement("span", {
      className: "cn-tab-icon"
    }, m.icon), React.createElement("span", {
      className: "cn-tab-label"
    }, m.label)), nav.tabs.length > 1 && React.createElement("button", {
      className: "cn-tab-x",
      title: "Close tab",
      onClick: e => {
        e.stopPropagation();
        nav.closeTab(id);
      }
    }, "\u2715"));
  })), prevMeta && prevMeta.id !== nav.view && React.createElement("button", {
    className: "cn-strip-flip",
    title: "Jump back and forth  `",
    onClick: () => nav.go(nav.prev)
  }, React.createElement("span", {
    className: "cn-strip-flip-i"
  }, "\u21C4"), prevMeta.label, React.createElement("kbd", null, "`")), isAdmin && React.createElement("div", {
    className: "cn-strip-brand",
    title: "Switch brand workspace"
  }, [{
    k: "chief",
    t: "CN"
  }, {
    k: "ssp",
    t: "SSP"
  }].map(b => React.createElement("button", {
    key: b.k,
    className: `cn-strip-brand-opt ${cross.brandKey() === b.k ? "is-active" : ""}`,
    onClick: () => {
      if (cross.brandKey() !== b.k) window.cnSwitchBrand(b.k);
    }
  }, b.t))), React.createElement("button", {
    className: "cn-strip-help",
    title: "Keyboard shortcuts",
    onClick: () => window.cnShortcutsOpen && window.cnShortcutsOpen()
  }, "\u2318K", React.createElement("span", null, "\xB7"), "?"));
}
function ShortcutHost() {
  var [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    window.cnShortcutsOpen = () => setOpen(true);
    var onKey = e => {
      if (e.key === "?" && !inField(document.activeElement)) {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!open) return null;
  var rows = [["⌘K", "Search & jump to any screen"], ["`", "Flip between the last two screens"], ["⌥←  ⌥→", "History back / forward"], ["⌥1 – ⌥9", "Jump to open tab by position"], ["g then d p q r c a l f", "Go to Dashboard, Pipeline, Quotes, RFQ, Contacts, Accounts, Library, Finance"], ["⌘\\", "Collapse / expand the sidebar"], ["?", "This panel"]];
  return React.createElement("div", {
    className: "cn-keys-scrim",
    onMouseDown: e => {
      if (e.target.classList.contains("cn-keys-scrim")) setOpen(false);
    }
  }, React.createElement("div", {
    className: "cn-keys"
  }, React.createElement("div", {
    className: "cn-keys-head"
  }, React.createElement("span", null, "Keyboard"), React.createElement("button", {
    onClick: () => setOpen(false)
  }, "\u2715")), React.createElement("div", {
    className: "cn-keys-body"
  }, rows.map(([k, d]) => React.createElement("div", {
    className: "cn-keys-row",
    key: k
  }, React.createElement("kbd", null, k), React.createElement("span", null, d))))));
}
Object.assign(window, {
  useCnNav,
  NavStrip,
  ShortcutHost
});