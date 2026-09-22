class ErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = {
      error: null
    };
  }
  static getDerivedStateFromError(error) {
    return {
      error
    };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary:", error, info);
  }
  render() {
    if (this.state.error) {
      return React.createElement("div", {
        className: "cn-loading"
      }, React.createElement("div", {
        style: {
          maxWidth: 600,
          padding: 20
        }
      }, React.createElement("h2", {
        style: {
          fontFamily: "var(--cn-serif)"
        }
      }, "Something went wrong"), React.createElement("pre", {
        style: {
          whiteSpace: "pre-wrap",
          color: "var(--cn-neg)",
          fontSize: 12
        }
      }, this.state.error.message, "\n\n", this.state.error.stack), React.createElement("button", {
        className: "cn-btn cn-btn--primary",
        onClick: () => location.reload()
      }, "Reload")));
    }
    return this.props.children;
  }
}
var TWEAK_DEFAULTS = {
  "currentUserId": null,
  "permissions": "strict"
};
function _cnSelfFromEmail(email) {
  if (!email) return null;
  var local = String(email).split("@")[0] || "there";
  var name = local.replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return {
    id: "self:" + email,
    name,
    fullName: name,
    initials: name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase(),
    role: "",
    email
  };
}
function App() {
  var qs = new URLSearchParams(window.location.search);
  var quoteTok = qs.get("quote");
  var loiTok = qs.get("loi");
  var invTok = qs.get("invoice");
  var poTok = qs.get("po");
  var commissionTok = qs.get("commission");
  var isPreview = qs.get("preview") === "1";
  if (commissionTok && window.CnCommissionShareView) return React.createElement(window.CnCommissionShareView, {
    token: commissionTok
  });
  if (quoteTok) return React.createElement(window.QuoteShareView, {
    token: quoteTok
  });
  if (loiTok) return React.createElement(window.ShShareRouter, {
    token: loiTok,
    kind: "loi",
    preview: isPreview
  });
  if (invTok) return React.createElement(window.ShShareRouter, {
    token: invTok,
    kind: "invoice",
    preview: isPreview
  });
  if (poTok) return React.createElement(window.ShShareRouter, {
    token: poTok,
    kind: "po",
    preview: isPreview
  });
  return React.createElement(CrmApp, null);
}

// The CRM proper. Every hook lives here, above any conditional return, so the
// hook count is identical on every render.
function CrmApp() {
  var [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  var [authState, setAuthState] = useState("checking");
  var [authEmail, setAuthEmail] = useState(null);
  var [data, setData] = useState(null);
  var [dataState, setDataState] = useState("idle");
  var [dataError, setDataError] = useState(null);
  var [skipEmpty, setSkipEmpty] = useState(false);
  var nav = window.useCnNav("dashboard");
  var view = nav.view;
  var setView = nav.go;
  useEffect(() => {
    window.cnGoto = (v, tab) => {
      if (v === "introductions" && tab) setIntroTab(tab);
      setView(v);
    };
  }, []);
  var [contactId, setContactId] = useState(null);
  var [accountDetailId, setAccountDetailId] = useState(null);
  var [oppId, setOppId] = useState(null);
  var [rfqTab, setRfqTab] = useState("new");
  var [rfqFocus, setRfqFocus] = useState(null);
  var [logCallOpen, setLogCallOpen] = useState(false);
  var [newOppOpen, setNewOppOpen] = useState(false);
  var [newOppPrefillContact, setNewOppPrefillContact] = useState(null);
  var [newContactOpen, setNewContactOpen] = useState(false);
  var [newContactAccount, setNewContactAccount] = useState(null);
  var [newAccountOpen, setNewAccountOpen] = useState(false);
  var [editAccount, setEditAccount] = useState(null);
  var [editActivity, setEditActivity] = useState(null);
  var [addTaskOpen, setAddTaskOpen] = useState(false);
  var [logCallPrefill, setLogCallPrefill] = useState(null);
  var [addTaskPrefill, setAddTaskPrefill] = useState(null);
  var [mergeAccounts, setMergeAccounts] = useState(null);
  useEffect(() => {
    var mounted = true;
    (async () => {
      var session = await window.getSession();
      if (!mounted) return;
      setAuthEmail(session?.user?.email || null);
      setAuthState(session ? "signed-in" : "signed-out");
    })();
    var {
      data: sub
    } = window.sb.auth.onAuthStateChange((_event, session) => {
      setAuthEmail(session?.user?.email || null);
      setAuthState(session ? "signed-in" : "signed-out");
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);
  var reload = async () => {
    setDataState("loading");
    setDataError(null);
    try {
      var d = await window.loadCRMData();
      setData(d);
      if (d.opps.length === 0 && d.accounts.length === 0 && !skipEmpty) {
        setDataState("empty");
      } else {
        setDataState("ready");
        var session = await window.getSession();
        if (session && d.reps.length > 0) {
          var me = d.reps.find(r => r.auth_user_id === session.user.id);
          if (me) {
            me.email = session.user.email;
            if (t.currentUserId !== me.id) setTweak("currentUserId", me.id);
          } else if (t.currentUserId) {
            setTweak("currentUserId", null);
          }
        }
      }
    } catch (e) {
      setDataError(e.message);
      setDataState("error");
    }
  };
  useEffect(() => {
    if (authState === "signed-in") reload();
  }, [authState]);
  window.cnReloadCRM = reload;
  var [importOpen, setImportOpen] = useState(false);
  var [introTab, setIntroTab] = useState(null);
  useEffect(() => {
    if (view !== "introductions" && introTab) setIntroTab(null);
  }, [view]);
  useEffect(() => {
    var qs = new URLSearchParams(window.location.search);
    var o = qs.get("outlook");
    if (!o) return;
    if (o === "connected") {
      setIntroTab("inbox");
      setView("introductions");
      window.cnToast && window.cnToast({
        title: "Outlook connected for daily sync",
        sub: qs.get("email") || ""
      });
    } else if (o === "error") window.cnToast && window.cnToast({
      kind: "error",
      title: "Couldn't connect Outlook",
      sub: qs.get("reason") || "Please try again."
    });
    qs.delete("outlook");
    qs.delete("email");
    qs.delete("reason");
    var clean = window.location.pathname + (qs.toString() ? "?" + qs.toString() : "");
    try {
      window.history.replaceState({}, "", clean);
    } catch {}
  }, []);
  if (authState === "checking") return React.createElement(LoadingScreen, {
    message: "Checking session\u2026"
  });
  if (authState === "signed-out") return React.createElement(LoginScreen, {
    onAuthed: () => setAuthState("signed-in")
  });
  if (dataState === "loading" || dataState === "idle") return React.createElement(LoadingScreen, {
    message: "Loading your CRM\u2026"
  });
  if (dataState === "error") return React.createElement("div", {
    className: "cn-loading"
  }, React.createElement("div", {
    className: "cn-loading-text",
    style: {
      color: "var(--cn-neg)"
    }
  }, "Error: ", dataError), React.createElement("button", {
    className: "cn-btn cn-btn--ghost",
    onClick: reload,
    style: {
      marginTop: 16
    }
  }, "Retry"), React.createElement("button", {
    className: "cn-link",
    onClick: () => window.signOut(),
    style: {
      marginTop: 8
    }
  }, "Sign out"));
  if (dataState === "empty") return React.createElement(EmptyState, {
    onSkip: () => {
      setSkipEmpty(true);
      setDataState("ready");
    },
    onSignOut: () => window.signOut()
  });
  var scenario = data;
  window.REPS = data.reps;
  var ownerEmails = data.ownerEmails || window.cnCrmOwners || [];
  var isOwner = !!authEmail && (ownerEmails.some(e => String(e || "").trim().toLowerCase() === String(authEmail).trim().toLowerCase()) || !!(window.CN_CROSS && window.CN_CROSS.isOwnerEmail && window.CN_CROSS.isOwnerEmail(authEmail)));
  var myRep = data.reps.find(r => r.id === t.currentUserId);
  var selfUser = _cnSelfFromEmail(authEmail);
  var currentUser = myRep || (selfUser ? {
    ...selfUser,
    role: isOwner ? "Owner" : selfUser.role
  } : null) || data.reps[0];
  var isFounder = isOwner || !!(currentUser && (currentUser.role || "").toLowerCase().includes("founder"));
  // Brand follows the login: on a shared deployment an SSP rep gets SSP even
  // though the build is pinned to CN. Reloads once if the derived brand differs;
  // a deliberate switch via the brand toggle always wins.
  if (window.cnApplyLoginBrand) {
    var myRepRow = data.reps.find(r => r.id === (currentUser && currentUser.id));
    window.cnApplyLoginBrand(authEmail, myRepRow || currentUser);
  }
  if (window.CN_CROSS && window.CN_CROSS.setIdentity) window.CN_CROSS.setIdentity(currentUser, authEmail);
  var canFinance = window.cnCanViewFinance ? window.cnCanViewFinance(authEmail) : false;
  // Bulk edit reassigns owners and archives records, so it is restricted to the
  // workspace owners (crm_owners / KNOWN_OWNERS) — NOT to anyone whose role
  // happens to read "founder".
  var canBulk = isOwner;
  var canStudio = isOwner || !!(window.CnBrandSpec && window.CnBrandSpec.canUse(currentUser));
  var openContact = id => {
    setContactId(id);
    setView("contact-detail");
  };
  var openAccount = id => {
    setAccountDetailId(id);
    setView("account-detail");
  };
  var openOpp = id => {
    setOppId(id);
  };
  // Satellite modules (crm-plus.js: bell, calendar, bulk edit) run outside the
  // React tree and need the same data and openers the screens use.
  window.cnScenario = scenario;
  window.cnOpenContact = openContact;
  window.cnOpenAccount = openAccount;
  window.cnOpenOpp = openOpp;
  window.cnCanAssign = () => isOwner;
  window.cnAuthEmail = authEmail;
  var openLogCall = cid => {
    setLogCallPrefill(typeof cid === "string" ? cid : null);
    setLogCallOpen(true);
  };
  var openAddTask = cid => {
    setAddTaskPrefill(typeof cid === "string" ? cid : null);
    setAddTaskOpen(true);
  };
  var completeTask = async task => {
    try {
      await window.updateActivity(task.id, {
        completed_at: new Date().toISOString()
      });
      window.cnToast && window.cnToast({
        title: "Task completed",
        sub: task.summary
      });
      reload();
    } catch (e) {
      alert("Couldn't complete the task:\n\n" + e.message + "\n\nIf this mentions a missing \"completed_at\" column, run supabase/migrations/06_task_completion.sql in the Supabase SQL Editor.");
    }
  };
  var switchUser = () => {};
  var firstName = (currentUser?.name || "there").split(" ")[0];
  var titleMap = {
    "dashboard": {
      title: `Good morning, ${firstName}`,
      bc: ["Workspace", "Dashboard"]
    },
    "today": {
      title: "Today",
      bc: ["Workspace", "Today"]
    },
    "pipeline": {
      title: "Pipeline",
      bc: ["Workspace", "Pipeline"]
    },
    "mandates": {
      title: "Mandates",
      bc: ["Workspace", "Mandates"]
    },
    "introductions": {
      title: "Introductions",
      bc: ["Workspace", "Introductions"]
    },
    "partners": {
      title: "Partners",
      bc: ["Relationships", "Partners"]
    },
    "contacts": {
      title: "Contacts",
      bc: ["Workspace", "Contacts"]
    },
    "accounts": {
      title: "Accounts",
      bc: ["Workspace", "Accounts"]
    },
    "calls": {
      title: "Call sync",
      bc: ["Workspace", "Calls"]
    },
    "activity": {
      title: "Activity",
      bc: ["Workspace", "Activity"]
    },
    "reports": {
      title: "Reports & Commission",
      bc: ["Workspace", "Reports"]
    },
    "outreach": {
      title: "Outreach",
      bc: ["Workspace", "Outreach"]
    },
    "prospecting": {
      title: "Prospecting",
      bc: ["Workspace", "Prospecting"]
    },
    "quotes": {
      title: "Quotes",
      bc: ["Workspace", "Quotes"]
    },
    "rfq": {
      title: "Request for Pricing",
      bc: ["Workspace", "RFQ"]
    },
    "documents": {
      title: "Sales documents",
      bc: ["Workspace", "Documents"]
    },
    "finance": {
      title: "Finance",
      bc: ["Workspace", "Finance"]
    },
    "sales-hub": {
      title: "Sales Hub",
      bc: ["Workspace", "Sales Hub"]
    },
    "calendar": {
      title: "Calendar",
      bc: ["Workspace", "Calendar"]
    },
    "bulk": {
      title: "Bulk edit",
      bc: ["Relationships", "Bulk edit"]
    },
    "contact-detail": {
      title: "Contact",
      bc: ["Contacts", scenario.contacts.find(c => c.id === contactId)?.name || "Contact"]
    },
    "account-detail": {
      title: "Account",
      bc: ["Accounts", scenario.accounts.find(a => a.id === accountDetailId)?.name || "Account"]
    }
  };
  var t2 = titleMap[view] || titleMap["dashboard"];
  return React.createElement("div", {
    className: "cn-app",
    "data-screen-label": `${window.CN_BRAND && window.CN_BRAND.name || "Chief Negotiators"} CRM`
  }, React.createElement(Sidebar, {
    view: view === "account-detail" ? "accounts" : view === "contact-detail" ? "contacts" : view,
    setView: setView,
    scenario: scenario,
    currentUser: currentUser,
    showFinance: canFinance,
    showBulk: canBulk,
    showStudio: canStudio,
    onUserSwitch: switchUser,
    onSignOut: () => window.signOut()
  }), React.createElement("main", {
    className: "cn-main"
  }, window.NavStrip && React.createElement(window.NavStrip, {
    nav: nav,
    currentUser: currentUser
  }), view !== "contact-detail" && view !== "account-detail" && React.createElement(Topbar, {
    title: t2.title,
    breadcrumb: t2.bc,
    onLogCall: () => setLogCallOpen(true),
    onAddOpp: () => setNewOppOpen(true),
    onAddTask: () => setAddTaskOpen(true),
    scenario: scenario,
    onOpenContact: openContact,
    onOpenOpp: openOpp,
    onOpenAccount: openAccount,
    onSetView: setView
  }), React.createElement("div", {
    className: "cn-content",
    "data-screen-label": `${t2.title} screen`
  }, (view === "dashboard" || (view === "brand-studio" && !canStudio)) && React.createElement(Dashboard, {
    scenario: scenario,
    currentUser: currentUser,
    isFounder: isFounder,
    onLogCall: () => setLogCallOpen(true),
    onOpenContact: openContact,
    onOpenOpp: openOpp,
    onEditActivity: setEditActivity,
    onAddTask: () => setAddTaskOpen(true),
    onCompleteTask: completeTask
  }), view === "pipeline" && React.createElement(Pipeline, {
    scenario: scenario,
    currentUser: currentUser,
    isFounder: isFounder,
    onOpenOpp: openOpp,
    onAddOpp: () => setNewOppOpen(true)
  }), view === "contacts" && React.createElement(Contacts, {
    scenario: scenario,
    currentUser: currentUser,
    onOpenContact: openContact,
    onNewContact: () => setNewContactOpen(true),
    onImport: () => setImportOpen(true),
    onSaved: reload,
    onLogCall: c => openLogCall(c && c.id)
  }), view === "accounts" && React.createElement(Accounts, {
    scenario: scenario,
    currentUser: currentUser,
    onSaved: reload,
    onOpenContact: openContact,
    onOpenAccount: openAccount,
    onNewAccount: () => setNewAccountOpen(true),
    onEditAccount: a => setEditAccount(a),
    onMergeAccounts: seed => setMergeAccounts(seed || {}),
    onImport: () => setImportOpen(true)
  }), view === "calls" && React.createElement(CallSync, {
    scenario: scenario,
    currentUser: currentUser,
    onOpenContact: openContact,
    onOpenOpp: openOpp,
    onSaved: reload
  }), view === "activity" && React.createElement(ActivityScreen, {
    scenario: scenario,
    currentUser: currentUser,
    onOpenContact: openContact,
    onOpenOpp: openOpp,
    onLogCall: () => setLogCallOpen(true),
    onEditActivity: setEditActivity,
    onAddTask: () => setAddTaskOpen(true)
  }), view === "reports" && React.createElement(Reports, {
    scenario: scenario,
    currentUser: currentUser,
    isFounder: isFounder,
    permissions: t.permissions
  }), view === "outreach" && React.createElement(Outreach, {
    scenario: scenario,
    currentUser: currentUser
  }), view === "prospecting" && React.createElement(window.ProspectingScreen, {
    scenario: scenario,
    currentUser: currentUser
  }), view === "quotes" && React.createElement(window.QuotesScreen, {
    scenario: scenario,
    currentUser: currentUser,
    onOpenOpp: openOpp
  }), view === "rfq" && React.createElement(window.RFQScreen, {
    scenario: scenario,
    currentUser: currentUser,
    initialTab: rfqTab,
    focusId: rfqFocus
  }), view === "introductions" && React.createElement(window.IntroductionsScreen, {
    scenario: scenario,
    currentUser: currentUser,
    initialTab: introTab
  }), view === "mandates" && window.MandatesScreen && React.createElement(window.MandatesScreen, {
    scenario: scenario,
    currentUser: currentUser
  }), view === "partners" && React.createElement(window.PartnersScreen, {
    scenario: scenario,
    currentUser: currentUser,
    authEmail: authEmail
  }), view === "today" && React.createElement(window.TodayScreen, {
    scenario: scenario,
    currentUser: currentUser,
    onOpenOpp: openOpp,
    onOpenContact: openContact,
    onGotoIntros: tab => {
      setIntroTab(tab || null);
      setView("introductions");
    }
  }), view === "documents" && React.createElement(window.DocumentsScreen, {
    scenario: scenario,
    currentUser: currentUser,
    onOpenContact: openContact,
    onOpenOpp: openOpp
  }), view === "brand-studio" && canStudio && window.CnBrandStudio && React.createElement(window.CnBrandStudio, {
    currentUser: currentUser
  }), view === "finance" && canFinance && React.createElement(window.FinanceScreen, {
    scenario: scenario,
    currentUser: currentUser,
    onOpenOpp: openOpp
  }), view === "sales-hub" && React.createElement(window.SalesHubScreen, {
    scenario: scenario,
    currentUser: currentUser,
    onOpenContact: openContact,
    onOpenOpp: openOpp
  }), view === "calendar" && window.CnCalendarScreen && React.createElement(window.CnCalendarScreen), view === "bulk" && window.CnBulkScreen && React.createElement(window.CnBulkScreen), view === "contact-detail" && contactId && React.createElement(ContactDetail, {
    scenario: scenario,
    currentUser: currentUser,
    contactId: contactId,
    onBack: () => setView("contacts"),
    onOpenOpp: openOpp,
    onLogCall: () => openLogCall(contactId),
    onAddTask: openAddTask,
    onSaved: reload,
    onEditActivity: setEditActivity,
    onNewOpp: cid => {
      setNewOppPrefillContact(cid);
      setNewOppOpen(true);
    }
  }), view === "account-detail" && accountDetailId && React.createElement(window.AccountDetail, {
    scenario: scenario,
    currentUser: currentUser,
    accountId: accountDetailId,
    onBack: () => setView("accounts"),
    onOpenContact: openContact,
    onOpenOpp: openOpp,
    onLogCall: openLogCall,
    onAddTask: openAddTask,
    onEditAccount: a => setEditAccount(a),
    onNewContact: aid => {
      setNewContactAccount(aid || accountDetailId);
      setNewContactOpen(true);
    },
    onNewOpp: () => setNewOppOpen(true),
    onEditActivity: setEditActivity,
    onSaved: reload
  }))), React.createElement(LogCallDrawer, {
    open: logCallOpen,
    onClose: () => {
      setLogCallOpen(false);
      setLogCallPrefill(null);
    },
    scenario: scenario,
    currentUser: currentUser,
    onSaved: reload,
    prefillContactId: logCallPrefill
  }), React.createElement(NewOppModal, {
    open: newOppOpen,
    onClose: () => {
      setNewOppOpen(false);
      setNewOppPrefillContact(null);
    },
    scenario: scenario,
    currentUser: currentUser,
    onSaved: reload,
    prefillContactId: newOppPrefillContact
  }), React.createElement(NewContactModal, {
    open: newContactOpen,
    onClose: () => {
      setNewContactOpen(false);
      setNewContactAccount(null);
    },
    scenario: scenario,
    currentUser: currentUser,
    onSaved: reload,
    prefillAccountId: newContactAccount
  }), React.createElement(ImportModal, {
    open: importOpen,
    onClose: () => setImportOpen(false),
    scenario: scenario,
    currentUser: currentUser,
    onSaved: reload
  }), React.createElement(NewAccountModal, {
    open: newAccountOpen,
    onClose: () => setNewAccountOpen(false),
    currentUser: currentUser,
    scenario: scenario,
    onOpenAccount: openAccount,
    onMerge: seed => {
      setNewAccountOpen(false);
      setMergeAccounts(seed || {});
    },
    onSaved: reload
  }), React.createElement(NewAccountModal, {
    open: !!editAccount,
    onClose: () => setEditAccount(null),
    account: editAccount,
    currentUser: currentUser,
    scenario: scenario,
    onOpenAccount: openAccount,
    onMerge: seed => {
      setEditAccount(null);
      setMergeAccounts(seed || {});
    },
    onSaved: reload
  }), window.MergeAccountsModal && React.createElement(window.MergeAccountsModal, {
    open: !!mergeAccounts,
    onClose: () => setMergeAccounts(null),
    scenario: scenario,
    initial: mergeAccounts,
    onSaved: reload
  }), React.createElement(EditActivityModal, {
    open: !!editActivity,
    onClose: () => setEditActivity(null),
    activity: editActivity,
    scenario: scenario,
    onSaved: reload
  }), React.createElement(AddTaskModal, {
    open: addTaskOpen,
    onClose: () => {
      setAddTaskOpen(false);
      setAddTaskPrefill(null);
    },
    scenario: scenario,
    currentUser: currentUser,
    onSaved: reload,
    prefillContactId: addTaskPrefill
  }), React.createElement(OppDetailDrawer, {
    open: !!oppId,
    onClose: () => setOppId(null),
    oppId: oppId,
    scenario: scenario,
    onOpenContact: openContact,
    onSaved: reload
  }), window.ShortcutHost && React.createElement(window.ShortcutHost, null), window.ToastHost && React.createElement(window.ToastHost, null), window.RFQPingHost && React.createElement(window.RFQPingHost, {
    currentUser: currentUser,
    onView: id => {
      setRfqFocus(id);
      setRfqTab("inbox");
      setView("rfq");
    }
  }), window.SaleBannerHost && React.createElement(window.SaleBannerHost, {
    scenario: scenario,
    currentUser: currentUser,
    onReload: reload
  }), window.ShDocBannerHost && React.createElement(window.ShDocBannerHost, null), React.createElement(TweaksPanel, {
    title: "Tweaks"
  }, React.createElement(TweakSection, {
    label: "Employee perms"
  }), React.createElement(TweakRadio, {
    label: "Employee perms",
    value: t.permissions,
    options: [{
      value: "strict",
      label: "Strict"
    }, {
      value: "open",
      label: "Open"
    }],
    onChange: v => setTweak("permissions", v)
  }), React.createElement(TweakSection, {
    label: "Data"
  }), React.createElement(TweakButton, {
    label: "Reload from database",
    onClick: reload
  }), React.createElement(TweakButton, {
    label: "Wipe sample data",
    onClick: async () => {
      if (!confirm("Delete ALL accounts, contacts, deals and activities?")) return;
      await window.wipeSampleData();
      reload();
    }
  })));
}
var root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(ErrorBoundary, null, React.createElement(App, null)));