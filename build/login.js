function LoginScreen({
  onAuthed
}) {
  var [email, setEmail] = useState("");
  var [password, setPassword] = useState("");
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState(null);
  var submit = async e => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await window.signIn(email, password);
      onAuthed();
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };
  return React.createElement("div", {
    className: "cn-login"
  }, React.createElement("div", {
    className: "cn-login-card"
  }, React.createElement("div", {
    className: "cn-login-logo"
  }, React.createElement("img", {
    src: window.cnBrandLogoSrc && window.cnBrandLogoSrc() || window.__resources?.logoMark || "assets/logo-mark.png",
    alt: window.CN_BRAND?.name || "Chief Negotiators"
  })), React.createElement("div", {
    className: "cn-login-brand"
  }, React.createElement("div", {
    className: "cn-brand-name"
  }, window.CN_BRAND?.wordTop || "Chief"), React.createElement("div", {
    className: "cn-brand-sub"
  }, window.CN_BRAND?.wordBottom || "Negotiators")), React.createElement("h1", {
    className: "cn-login-title"
  }, "Sign in"), React.createElement("p", {
    className: "cn-login-sub"
  }, "Internal CRM \xB7 Team access only"), React.createElement("form", {
    className: "cn-login-form",
    onSubmit: submit
  }, React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Email"), React.createElement("input", {
    className: "cn-input",
    type: "email",
    required: true,
    autoFocus: true,
    value: email,
    onChange: e => setEmail(e.target.value)
  })), React.createElement("div", {
    className: "cn-field"
  }, React.createElement("label", null, "Password"), React.createElement("input", {
    className: "cn-input",
    type: "password",
    required: true,
    value: password,
    onChange: e => setPassword(e.target.value)
  })), error && React.createElement("div", {
    className: "cn-login-error"
  }, error), React.createElement("button", {
    className: "cn-btn cn-btn--primary cn-login-submit",
    type: "submit",
    disabled: loading
  }, loading ? "Signing in…" : "Sign in")), React.createElement("div", {
    className: "cn-login-foot"
  }, "Forgot password? Reset from Supabase email link or ask Amanda.")));
}
function LoadingScreen({
  message
}) {
  return React.createElement("div", {
    className: "cn-loading"
  }, React.createElement("img", {
    src: window.cnBrandLogoSrc && window.cnBrandLogoSrc() || window.__resources?.logoMark || "assets/logo-mark.png",
    alt: "",
    className: "cn-loading-logo"
  }), React.createElement("div", {
    className: "cn-loading-text"
  }, message || "Loading…"));
}
function EmptyState({
  onSkip,
  onSignOut
}) {
  return React.createElement("div", {
    className: "cn-empty"
  }, React.createElement("div", {
    className: "cn-empty-card"
  }, React.createElement("h1", {
    className: "cn-empty-title"
  }, "Welcome to your CRM"), React.createElement("p", {
    className: "cn-empty-sub"
  }, "Your database is connected and empty. Add your first account, contact, or referral to get started."), React.createElement("div", {
    className: "cn-empty-actions"
  }, React.createElement("button", {
    className: "cn-btn cn-btn--primary",
    onClick: onSkip
  }, "Enter CRM")), React.createElement("div", {
    className: "cn-empty-foot"
  }, React.createElement("button", {
    className: "cn-link",
    onClick: onSignOut
  }, "Sign out"))));
}
Object.assign(window, {
  LoginScreen,
  LoadingScreen,
  EmptyState
});