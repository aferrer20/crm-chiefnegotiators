// Sales Hub — LOIs, Invoices, and Open POs (blanket purchase orders)
// All three are "customer-fillable + acceptable" docs that the rep sends out
// via a shareable link, the customer fills/accepts, and the result comes
// back to the rep through the same pending-queue mechanism quotes use.
//
// Storage: localStorage. Keyed per-document-type. Each doc carries its own
// share token that resolves through cn-saleshub-token-index.
// (useState/useEffect/useRef/Fragment come from shell.jsx's global destructuring.)

// ── Storage ────────────────────────────────────────────────────────────────
const SH_KEYS = {
  loi:     "cn-sh-lois",
  invoice: "cn-sh-invoices",
  po:      "cn-sh-pos",
};
const SH_TOKEN_INDEX = "cn-sh-token-index";

function shRead(kind) {
  try { return JSON.parse(localStorage.getItem(SH_KEYS[kind]) || "[]"); }
  catch { return []; }
}
function shWrite(kind, list) {
  localStorage.setItem(SH_KEYS[kind], JSON.stringify(list));
  // Rebuild token index for this kind
  try {
    const idx = JSON.parse(localStorage.getItem(SH_TOKEN_INDEX) || "{}");
    // strip any old entries for this kind, then re-add
    for (const k of Object.keys(idx)) if (idx[k].kind === kind) delete idx[k];
    list.forEach(d => { if (d.shareToken) idx[d.shareToken] = { kind, id: d.id }; });
    localStorage.setItem(SH_TOKEN_INDEX, JSON.stringify(idx));
  } catch {}
}
function shSave(kind, doc) {
  const list = shRead(kind);
  const i = list.findIndex(d => d.id === doc.id);
  const stamped = { ...doc, updatedAt: new Date().toISOString() };
  if (i >= 0) list[i] = stamped; else list.unshift(stamped);
  shWrite(kind, list);
  // Push to Supabase so the customer's browser can load the doc by share token.
  if (window.publishSharedDoc && stamped.shareToken) {
    window.publishSharedDoc({ kind, doc: stamped });
  }
  return stamped;
}
function shDelete(kind, id) {
  const doomed = shRead(kind).find(d => d.id === id);
  const next = shRead(kind).filter(d => d.id !== id);
  shWrite(kind, next);
  // Propagate the delete company-wide: tombstone the id + remove the shared row
  // so it can never sync back to this or any other rep's device.
  if (window.cnDeleteSharedDoc) window.cnDeleteSharedDoc({ kind, id, shareToken: doomed && doomed.shareToken });
  return next;
}
function shLookupByToken(token) {
  try {
    const idx = JSON.parse(localStorage.getItem(SH_TOKEN_INDEX) || "{}");
    const hit = idx[token];
    if (!hit) return null;
    const doc = shRead(hit.kind).find(d => d.id === hit.id);
    return doc ? { kind: hit.kind, doc } : null;
  } catch { return null; }
}

window.cnSalesHub = { shRead, shWrite, shSave, shDelete, shLookupByToken, SH_KEYS };

// ── Rich text renderer for description / notes / purpose fields ────────────
// Preserves the typed structure so customers can read pasted specs cleanly:
//   - blank line       → vertical spacing
//   - ALL CAPS line    → section header (eyebrow style)
//   - "- " or "• "     → bullet
//   - "Label — value"  → label/value row with the em dash kept
//   - everything else  → paragraph (with pre-wrap so inner newlines survive)
function ShRichText({ text }) {
  if (!text) return null;
  const raw = String(text).replace(/\r\n?/g, "\n");
  const lines = raw.split("\n");
  const blocks = [];
  let bulletGroup = null;
  const flush = () => { if (bulletGroup) { blocks.push({ kind: "bullets", items: bulletGroup }); bulletGroup = null; } };

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const trimmed = ln.trim();
    if (!trimmed) { flush(); blocks.push({ kind: "gap" }); continue; }
    // Header: line is all uppercase letters + spaces + a few punctuation chars,
    // contains at least one letter, and is short enough to be a title.
    const letters = trimmed.replace(/[^A-Za-z]/g, "");
    const isHeader = letters.length >= 3 && letters === letters.toUpperCase() && trimmed.length <= 80;
    if (isHeader) { flush(); blocks.push({ kind: "header", text: trimmed }); continue; }
    // Bullet: "- ", "• ", or "— Something" at the start
    const bulletMatch = trimmed.match(/^([-•])\s+(.*)$/);
    if (bulletMatch) {
      if (!bulletGroup) bulletGroup = [];
      bulletGroup.push(bulletMatch[2]);
      continue;
    }
    flush();
    // Key — Value row (em or en dash with a label up front)
    const kv = trimmed.match(/^(.+?)\s+[—–-]\s+(.+)$/);
    if (kv && kv[1].length <= 60) {
      blocks.push({ kind: "kv", label: kv[1], value: kv[2] });
      continue;
    }
    blocks.push({ kind: "para", text: trimmed });
  }
  flush();

  return (
    <div className="cn-rich">
      {blocks.map((b, i) => {
        if (b.kind === "gap")    return <div key={i} className="cn-rich-gap" aria-hidden="true" />;
        if (b.kind === "header") return <div key={i} className="cn-rich-header">{b.text}</div>;
        if (b.kind === "bullets") return (
          <ul key={i} className="cn-rich-bullets">
            {b.items.map((it, j) => <li key={j}>{it}</li>)}
          </ul>
        );
        if (b.kind === "kv") return (
          <div key={i} className="cn-rich-kv">
            <span className="cn-rich-kv-label">{b.label}</span>
            <span className="cn-rich-kv-dash">—</span>
            <span className="cn-rich-kv-value">{b.value}</span>
          </div>
        );
        return <p key={i} className="cn-rich-para">{b.text}</p>;
      })}
    </div>
  );
}
window.ShRichText = ShRichText;

// ── Helpers ────────────────────────────────────────────────────────────────
const shNewId = (p) => p + "-" + Math.random().toString(36).slice(2, 10);
const shToken = () => "sh-" + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 8);

function shNewLine() {
  return { id: shNewId("li"), partNumber: "", description: "", qty: 1, condition: "New", unitPrice: 0 };
}
function shLineTotal(li) {
  return (parseFloat(li.qty) || 0) * (parseFloat(li.unitPrice) || 0);
}
function shDocTotal(d) {
  return (d.lineItems || []).reduce((s, li) => s + shLineTotal(li), 0);
}
function shFmt(n) {
  return "$" + (Math.round((n || 0) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function shTimeAgo(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  return d + "d ago";
}
function shToday() { return new Date().toISOString().slice(0, 10); }
function shAddDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function shYearEnd(iso) {
  const d = new Date(iso || shToday());
  return `${d.getFullYear()}-12-31`;
}

// Map a legal role ("seller" | "buyer") to the doc field names that hold its
// party details. Lets the same UI render either side and lets us flip which
// side is "us" vs. the counterparty who fills + signs.
function shPartyFields(role) {
  return role === "seller"
    ? { name: "sellerName", address: "sellerAddress", taxId: "sellerTaxId", contactName: "sellerRep", contactEmail: "sellerEmail", contactPhone: "sellerPhone" }
    : { name: "buyerName", address: "buyerAddress", taxId: "buyerTaxId", contactName: "buyerContactName", contactEmail: "buyerContactEmail", contactPhone: "buyerContactPhone" };
}
const shOtherRole = (role) => (role === "seller" ? "buyer" : "seller");
const shRoleLabel = (role) => (role === "seller" ? "Seller" : "Buyer");

window.shHelpers = { shNewId, shToken, shNewLine, shLineTotal, shDocTotal, shFmt, shTimeAgo, shToday, shAddDays, shYearEnd, shPartyFields, shOtherRole, shRoleLabel };

// ── Shared party UI (used by LOI + PO builders) ─────────────────────────────
// Editable party card. `mine` = this is our side (pre-filled with our brand);
// otherwise it's the counterparty who will fill + sign via the share link.
function ShPartyCard({ role, doc, update, mine }) {
  const f = shPartyFields(role);
  return (
    <div className={`cn-sh-party-card ${mine ? "cn-sh-party-card--mine" : "cn-sh-party-card--fill"}`}>
      <div className="cn-card-eyebrow">
        {shRoleLabel(role)}{" "}
        <span className={`cn-sh-party-tag ${mine ? "cn-sh-party-tag--mine" : ""}`}>
          {mine ? "· that's us" : "· counterparty fills"}
        </span>
      </div>
      <div className="cn-field"><label>Company (legal name)</label><input className="cn-input" value={doc[f.name] || ""} onChange={e => update({ [f.name]: e.target.value })} placeholder={mine ? "" : "Counterparty's legal entity name"} /></div>
      <div className="cn-field"><label>Address</label><textarea className="cn-textarea" style={{ minHeight: 70 }} value={doc[f.address] || ""} onChange={e => update({ [f.address]: e.target.value })} placeholder={mine ? "" : "Street, city, state, ZIP, country"} /></div>
      <div className="cn-field-row">
        <div className="cn-field" style={{ flex: 1 }}><label>Tax ID / EIN</label><input className="cn-input cn-mono" style={{ fontSize: 12.5 }} value={doc[f.taxId] || ""} onChange={e => update({ [f.taxId]: e.target.value })} placeholder={mine ? "" : "(counterparty fills)"} /></div>
        <div className="cn-field" style={{ flex: 1 }}><label>{role === "seller" ? "Representative" : "Primary contact"}</label><input className="cn-input" value={doc[f.contactName] || ""} onChange={e => update({ [f.contactName]: e.target.value })} placeholder={mine ? "" : "Contact name"} /></div>
      </div>
      <div className="cn-field-row">
        <div className="cn-field" style={{ flex: 1 }}><label>Email</label><input className="cn-input cn-mono" style={{ fontSize: 12.5 }} value={doc[f.contactEmail] || ""} onChange={e => update({ [f.contactEmail]: e.target.value })} placeholder={mine ? "" : "contact@example.com"} /></div>
        <div className="cn-field" style={{ flex: 1 }}><label>Phone</label><input className="cn-input cn-mono" style={{ fontSize: 12.5 }} value={doc[f.contactPhone] || ""} onChange={e => update({ [f.contactPhone]: e.target.value })} placeholder={mine ? "" : "(counterparty fills)"} /></div>
      </div>
    </div>
  );
}
window.ShPartyCard = ShPartyCard;

// Swap the two parties' data so "us" always follows our chosen role.
function shSwapParties(doc) {
  return {
    sellerName: doc.buyerName, sellerAddress: doc.buyerAddress, sellerTaxId: doc.buyerTaxId,
    sellerRep: doc.buyerContactName, sellerEmail: doc.buyerContactEmail, sellerPhone: doc.buyerContactPhone,
    buyerName: doc.sellerName, buyerAddress: doc.sellerAddress, buyerTaxId: doc.sellerTaxId,
    buyerContactName: doc.sellerRep, buyerContactEmail: doc.sellerEmail, buyerContactPhone: doc.sellerPhone,
  };
}

// "Our position" segmented control. Flips ourRole and swaps party data so our
// brand details stay on our side.
function ShRoleToggle({ doc, update }) {
  const our = doc.ourRole || "seller";
  const setRole = (role) => {
    if (role === our) return;
    update({ ourRole: role, ...shSwapParties(doc) });
  };
  return (
    <div className="cn-sh-ctrl">
      <div className="cn-card-eyebrow">Our position</div>
      <div className="cn-segmented">
        <button className={our === "seller" ? "is-active" : ""} onClick={() => setRole("seller")}>We're the Seller</button>
        <button className={our === "buyer" ? "is-active" : ""} onClick={() => setRole("buyer")}>We're the Buyer</button>
      </div>
    </div>
  );
}
window.ShRoleToggle = ShRoleToggle;

// ── New blank docs ─────────────────────────────────────────────────────────
function shNewLOI(opp, account, contact, currentUser) {
  const today = shToday();
  const num = "LOI-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 9000) + 1000);
  return {
    id: shNewId("loi"),
    docNumber: num,
    issueDate: today,
    expiresDate: shAddDays(today, 30),
    // Seller (us) — preset
    sellerName: window.CN_BRAND ? window.CN_BRAND.legalName : "Chief Negotiators, LLC",
    sellerAddress: window.CN_BRAND ? window.CN_BRAND.address : "St. Petersburg, FL 33710\nUnited States",
    sellerRep: currentUser?.name || "",
    sellerEmail: currentUser?.email || "",
    sellerTaxId: window.CN_BRAND ? (window.CN_BRAND.ein || "") : "",
    sellerPhone: "",
    // Which side are WE on. "seller" → customer fills Buyer + signs.
    // "buyer"  → customer (the seller) fills Seller + signs.
    ourRole: "seller",
    // Buyer — fillable by customer
    buyerName: account?.name || "",
    buyerAddress: account?.hq || "",
    buyerSigner: "",          // person with signing authority (filled by customer)
    buyerTitle: "",           // their title
    buyerContactName: contact?.name || "",
    buyerContactEmail: contact?.email || "",
    buyerContactPhone: contact?.phone || "",
    buyerTaxId: "",           // EIN / VAT — filled by customer
    // Subject
    subject: opp?.title || "",
    purpose: "Purchase of hardware as itemized below for production deployment.",
    // Line items
    lineItems: [shNewLine()],
    // Shipping
    shipToSame: false,
    shipToName: "",
    shipToAddress: "",
    shipToAttention: "",
    incoterms: "FOB Origin",
    shipMethod: "Standard freight",
    targetDelivery: shAddDays(today, 60),
    // Commercial terms
    paymentTerms: "50% deposit on PO issuance; balance Net 30 from delivery.",
    depositPct: 50,
    currency: "USD",
    // Legal
    bindingNature: "non-binding",     // "binding" | "non-binding"
    exclusivity: true,                // 30-day exclusive negotiation
    exclusivityDays: 30,
    confidentiality: true,
    nonCircumvent: true,
    governingLaw: "State of Florida, USA",
    conditionsPrecedent: "Buyer due diligence on product condition, export-control clearance, and credit approval.",
    terminationClause: "Either party may terminate this LOI by written notice prior to execution of the definitive purchase agreement.",
    // Status / signing
    status: "draft",  // draft → sent → viewed → accepted → declined
    shareToken: shToken(),
    sentAt: null,
    viewedAt: null,
    viewCount: 0,
    // Customer fill-in tracking
    buyerSignedName: "",
    buyerSignedTitle: "",
    buyerSignedDate: "",
    buyerSignatureDataURL: "",
    declineReason: "",
    // Linked opp/contact (for context only)
    oppId: opp?.id || null,
    accountId: account?.id || null,
    contactId: contact?.id || null,
    createdBy: currentUser?.id || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function shNewInvoice(opp, account, contact, currentUser, fromQuote) {
  const today = shToday();
  const num = "INV-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 9000) + 1000);
  return {
    id: shNewId("inv"),
    docNumber: num,
    issueDate: today,
    dueDate: shAddDays(today, 30),
    poReference: fromQuote?.quoteNumber || "",
    // Seller
    sellerName: window.CN_BRAND ? window.CN_BRAND.legalName : "Chief Negotiators, LLC",
    sellerAddress: window.CN_BRAND ? window.CN_BRAND.address : "St. Petersburg, FL 33710\nUnited States",
    sellerEIN: window.CN_BRAND ? window.CN_BRAND.ein : "88-2914003",
    sellerRep: currentUser?.name || "",
    sellerEmail: currentUser?.email || "",
    // Bill to
    billToName: account?.name || "",
    billToAddress: account?.hq || "",
    billToAttention: contact?.name || "",
    billToEmail: contact?.email || "",
    // Ship to
    shipToSame: true,
    shipToName: account?.name || "",
    shipToAddress: account?.hq || "",
    shipToAttention: contact?.name || "",
    // Lines
    lineItems: fromQuote
      ? fromQuote.lineItems.map(li => ({ ...li, id: shNewId("li") }))
      : [shNewLine()],
    // Totals
    taxRate: 0,           // percent
    shippingFee: 0,
    discount: 0,
    notes: fromQuote?.notes || "",
    // Payment
    currency: "USD",
    paymentTerms: "Net 30",
    paymentMethods: ["Wire transfer (USD)", "ACH (USD)", "Check"],
    bankName: "JPMorgan Chase, N.A.",
    bankRouting: "021000021",
    bankAccount: "•••• 4827",
    bankSwift: "CHASUS33",
    // Status
    status: "draft",  // draft → sent → viewed → paid → overdue
    shareToken: shToken(),
    sentAt: null,
    viewedAt: null,
    viewCount: 0,
    paidAt: null,
    paymentMethodUsed: "",
    paymentReference: "",
    // Linked
    oppId: opp?.id || null,
    accountId: account?.id || null,
    contactId: contact?.id || null,
    fromQuoteId: fromQuote?.id || null,
    createdBy: currentUser?.id || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function shNewPO(opp, account, contact, currentUser) {
  const today = shToday();
  const num = "OPO-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 9000) + 1000);
  const effective = today;
  return {
    id: shNewId("po"),
    docNumber: num,
    issueDate: today,
    // PO flavour: "open" = blanket (locked SKU + release schedule within year);
    // "onetime" = single purchase order (line items, one delivery).
    poType: "open",
    // Which side are WE on. "buyer" → customer (the seller) fills + signs.
    ourRole: "seller",
    effectiveDate: effective,
    expirationDate: shYearEnd(today),
    // Seller
    sellerName: window.CN_BRAND ? window.CN_BRAND.legalName : "Chief Negotiators, LLC",
    sellerAddress: window.CN_BRAND ? window.CN_BRAND.address : "St. Petersburg, FL 33710\nUnited States",
    sellerRep: currentUser?.name || "",
    sellerEmail: currentUser?.email || "",
    sellerTaxId: window.CN_BRAND ? (window.CN_BRAND.ein || "") : "",
    sellerPhone: "",
    // Buyer
    buyerName: account?.name || "",
    buyerAddress: account?.hq || "",
    buyerSigner: "",
    buyerTitle: "",
    buyerContactName: contact?.name || "",
    buyerContactEmail: contact?.email || "",
    buyerContactPhone: contact?.phone || "",
    buyerTaxId: "",
    // Locked product — open POs lock a single SKU at a fixed price
    partNumber: "",
    description: "",
    condition: "New",
    contractQty: 100,
    unitPrice: 0,
    minReleaseQty: 1,
    // One-time PO — itemized lines + a single delivery date
    lineItems: [shNewLine()],
    deliveryDate: shAddDays(today, 45),
    // Shipping
    shipToSame: false,
    shipToName: "",
    shipToAddress: "",
    shipToAttention: "",
    incoterms: "FOB Origin",
    shipMethod: "Standard freight",
    // Schedule — array of { id, date, qty, note }
    schedule: [
      { id: shNewId("rel"), date: shAddDays(today, 30), qty: 25, note: "" },
      { id: shNewId("rel"), date: shAddDays(today, 60), qty: 25, note: "" },
      { id: shNewId("rel"), date: shAddDays(today, 90), qty: 25, note: "" },
      { id: shNewId("rel"), date: shAddDays(today, 120), qty: 25, note: "" },
    ],
    // Commercial
    paymentTerms: "Net 30 per release, invoiced upon shipment.",
    currency: "USD",
    // Legal
    cancellationPolicy: "Buyer may cancel any unshipped release with 30 days written notice. Pricing locked through expiration date; no price escalation without mutual written agreement.",
    priceLockClause: "Unit price fixed for the full contract quantity through expiration. Volume rebates apply at 250+ and 500+ units.",
    governingLaw: "State of Florida, USA",
    forceMajeure: true,
    // Customer-fill
    buyerSignedName: "",
    buyerSignedTitle: "",
    buyerSignedDate: "",
    buyerSignatureDataURL: "",
    declineReason: "",
    // Status
    status: "draft",
    shareToken: shToken(),
    sentAt: null,
    viewedAt: null,
    viewCount: 0,
    // Links
    oppId: opp?.id || null,
    accountId: account?.id || null,
    contactId: contact?.id || null,
    createdBy: currentUser?.id || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

window.shNewDocs = { shNewLOI, shNewInvoice, shNewPO };

// ── Status pill ────────────────────────────────────────────────────────────
function ShStatus({ doc, kind }) {
  const status = doc.status || "draft";
  const labels = kind === "invoice"
    ? {
        draft:    ["Draft",    "cn-q-draft"],
        sent:     ["Sent",     "cn-q-sent"],
        viewed:   ["Viewed",   "cn-q-viewed"],
        paid:     ["Paid",     "cn-q-accepted"],
        overdue:  ["Overdue",  "cn-q-declined"],
        void:     ["Void",     "cn-q-declined"],
      }
    : {
        draft:     ["Draft",      "cn-q-draft"],
        sent:      ["Sent",       "cn-q-sent"],
        viewed:    ["Viewed",     "cn-q-viewed"],
        accepted:  ["Accepted",   "cn-q-accepted"],
        declined:  ["Declined",   "cn-q-declined"],
      };
  const [label, cls] = labels[status] || labels.draft;
  return <span className={`cn-q-pill ${cls}`}>{label}</span>;
}
window.ShStatus = ShStatus;

// ── Main Sales Hub Screen ──────────────────────────────────────────────────
function SalesHubScreen({ scenario, currentUser, onOpenContact, onOpenOpp }) {
  const [tab, setTab] = useState("loi");
  const [lois, setLois] = useState(() => shRead("loi"));
  const [invoices, setInvoices] = useState(() => shRead("invoice"));
  const [pos, setPos] = useState(() => shRead("po"));
  const [editing, setEditing] = useState(null);  // { kind, doc }
  const [sharing, setSharing] = useState(null);  // { kind, doc }
  const [q, setQ] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState(null);  // { changed, at } | null

  const refreshAll = () => {
    setLois(shRead("loi"));
    setInvoices(shRead("invoice"));
    setPos(shRead("po"));
  };

  // Pull the full company-wide document set from the shared database and merge
  // it into this browser. Brings in (a) docs created by other reps and (b)
  // customer-signed copies — so the executed version shows up for everyone,
  // not just whoever's browser made the doc.
  const syncFromServer = async ({ quiet = false } = {}) => {
    if (!window.loadCompanyDocs || !window.mergeDocLists) return;
    if (!quiet) setSyncing(true);
    let totalChanged = 0, totalAdded = 0, failed = false;
    try {
      for (const kind of ["loi", "invoice", "po"]) {
        const server = await window.loadCompanyDocs(kind);
        if (server === null) { failed = true; continue; }  // DB unreachable — keep local
        const { merged, changed, added } = window.mergeDocLists(shRead(kind), server, kind);
        if (changed > 0) shWrite(kind, merged);
        totalChanged += changed;
        totalAdded += added;
      }
      refreshAll();
      setSyncNote(failed && totalChanged === 0
        ? { error: true, at: Date.now() }
        : { changed: totalChanged, added: totalAdded, at: Date.now() });
    } catch (e) {
      console.warn("Sales Hub sync failed:", e);
      if (!quiet) setSyncNote({ error: true, at: Date.now() });
    } finally {
      if (!quiet) setSyncing(false);
    }
  };

  // On mount: quietly pull the company set so the hub shows everyone's docs
  // and any signed copies, without the rep doing anything.
  useEffect(() => { syncFromServer({ quiet: true }); }, []);

  const lists = { loi: lois, invoice: invoices, po: pos };
  const titles = {
    loi:     { label: "Letters of Intent",       eyebrow: "LOI",     blurb: "Non-binding (or binding) intent to purchase. Customer fills buyer info, agrees to terms, signs back." },
    invoice: { label: "Invoices",                eyebrow: "Invoice", blurb: "Billable invoices. Send standalone or from a closed quote. Customer can mark paid once funds are received." },
    po:      { label: "Purchase Orders",          eyebrow: "PO",      blurb: "Cut a one-time PO (itemized, single delivery) or an open/blanket PO (locked SKU + release schedule). Either party can be buyer or seller — the counterparty fills their details and signs." },
  };

  const filtered = (() => {
    const list = lists[tab] || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(d =>
      (d.docNumber || "").toLowerCase().includes(needle) ||
      (d.buyerName || d.billToName || "").toLowerCase().includes(needle) ||
      (d.subject || d.poReference || d.partNumber || "").toLowerCase().includes(needle)
    );
  })();

  const createNew = (kind, fromQuote = null) => {
    const acct = null, cont = null, opp = null;
    let doc;
    if (kind === "loi") doc = shNewLOI(opp, acct, cont, currentUser);
    else if (kind === "invoice") doc = shNewInvoice(opp, acct, cont, currentUser, fromQuote);
    else if (kind === "po") doc = shNewPO(opp, acct, cont, currentUser);
    setEditing({ kind, doc });
  };

  const onSaveDoc = (kind, doc) => {
    const saved = shSave(kind, doc);
    refreshAll();
    setEditing({ kind, doc: saved });
  };

  const onDeleteDoc = (kind, id) => {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    shDelete(kind, id);
    refreshAll();
    if (editing?.doc?.id === id) setEditing(null);
  };

  const stats = (() => {
    const totals = {
      loi:      lois.reduce((s, d) => s + shDocTotal(d), 0),
      invoice:  invoices.reduce((s, d) => s + (shDocTotal(d) + (parseFloat(d.shippingFee) || 0) + (shDocTotal(d) * (parseFloat(d.taxRate) || 0) / 100) - (parseFloat(d.discount) || 0)), 0),
      po:       pos.reduce((s, d) => s + (d.poType === "onetime" ? shDocTotal(d) : (parseFloat(d.contractQty) || 0) * (parseFloat(d.unitPrice) || 0)), 0),
    };
    return {
      lois:       { count: lois.length,       open: lois.filter(d => d.status === "sent" || d.status === "viewed").length,    won: lois.filter(d => d.status === "accepted").length,    value: totals.loi },
      invoices:   { count: invoices.length,   open: invoices.filter(d => d.status === "sent" || d.status === "viewed").length, paid: invoices.filter(d => d.status === "paid").length,      value: totals.invoice },
      pos:        { count: pos.length,        open: pos.filter(d => d.status === "sent" || d.status === "viewed").length,     active: pos.filter(d => d.status === "accepted").length,   value: totals.po },
    };
  })();

  return (
    <div className="cn-page" style={{ padding: 0, gap: 20 }}>
      <header className="cn-docs-head">
        <div>
          <div className="cn-card-eyebrow">Sales Hub</div>
          <h2 className="cn-card-title" style={{ marginTop: 4 }}>Letters of Intent, Invoices &amp; Open POs</h2>
          <p style={{ color: "var(--cn-mute)", margin: "6px 0 0", maxWidth: 640, fontSize: 13.5 }}>
            Send legally-sound LOIs, billable invoices, and blanket purchase orders with shipping schedules. Customer fills, agrees, signs — comes straight back to you.
          </p>
        </div>
        <div className="cn-docs-head-actions">
          <input
            className="cn-input"
            placeholder={`Search ${titles[tab].label.toLowerCase()}…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 240 }}
          />
          <button
            className="cn-btn cn-btn--ghost"
            onClick={() => syncFromServer()}
            disabled={syncing}
            title="Sync with the team: pull in documents created by other reps and any customer-signed copies. Run this if a doc or signature isn't showing up."
          >
            {syncing ? "Syncing…" : "↻ Sync with team"}
          </button>
          <button className="cn-btn cn-btn--primary" onClick={() => createNew(tab)}>+ New {titles[tab].eyebrow}</button>
        </div>
      </header>

      {syncNote && (
        <div
          className="cn-sh-band"
          style={{
            background: syncNote.error ? "#FBE9E4" : (syncNote.changed > 0 ? "#E8F3EC" : "var(--cn-surface-2, #F0E9D8)"),
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13.5, color: "var(--cn-ink-2)" }}>
            {syncNote.error
              ? "Couldn't reach the server to sync. You're seeing this browser's copies only — check your connection and try again."
              : (syncNote.changed > 0 || syncNote.added > 0)
                ? `✓ Synced with the team. ${syncNote.added > 0 ? `Pulled in ${syncNote.added} doc${syncNote.added === 1 ? "" : "s"} from teammates / other devices. ` : ""}${(syncNote.changed - (syncNote.added || 0)) > 0 ? `${syncNote.changed - syncNote.added} signed/updated cop${(syncNote.changed - syncNote.added) === 1 ? "y" : "ies"} refreshed.` : ""}`.trim()
                : "Up to date with the team. No new signatures or documents. (If a customer says they signed, make sure they used the share link — clicked “Accept & sign” — not just replied to the email.)"}
          </div>
          <button className="cn-btn cn-btn--ghost" style={{ padding: "4px 10px" }} onClick={() => setSyncNote(null)}>Dismiss</button>
        </div>
      )}

      {/* KPI strip */}
      <div className="cn-kpi-row">
        <button className={`cn-sh-kpi ${tab === "loi" ? "is-active" : ""}`} onClick={() => setTab("loi")}>
          <div className="cn-kpi-eyebrow">Letters of Intent</div>
          <div className="cn-kpi-value">{stats.lois.count}</div>
          <div className="cn-kpi-foot">
            <span className="cn-kpi-foot-pri">{stats.lois.open}</span> awaiting
            <span className="cn-kpi-foot-sep">·</span>
            <span style={{ color: "var(--cn-pos)" }}>{stats.lois.won}</span> accepted
            <span className="cn-kpi-foot-sep">·</span>
            <span className="cn-mono">{shFmt(stats.lois.value)}</span>
          </div>
        </button>
        <button className={`cn-sh-kpi ${tab === "invoice" ? "is-active" : ""}`} onClick={() => setTab("invoice")}>
          <div className="cn-kpi-eyebrow">Invoices</div>
          <div className="cn-kpi-value">{stats.invoices.count}</div>
          <div className="cn-kpi-foot">
            <span className="cn-kpi-foot-pri">{stats.invoices.open}</span> outstanding
            <span className="cn-kpi-foot-sep">·</span>
            <span style={{ color: "var(--cn-pos)" }}>{stats.invoices.paid}</span> paid
            <span className="cn-kpi-foot-sep">·</span>
            <span className="cn-mono">{shFmt(stats.invoices.value)}</span>
          </div>
        </button>
        <button className={`cn-sh-kpi ${tab === "po" ? "is-active" : ""}`} onClick={() => setTab("po")}>
          <div className="cn-kpi-eyebrow">Purchase Orders</div>
          <div className="cn-kpi-value">{stats.pos.count}</div>
          <div className="cn-kpi-foot">
            <span className="cn-kpi-foot-pri">{stats.pos.open}</span> awaiting
            <span className="cn-kpi-foot-sep">·</span>
            <span style={{ color: "var(--cn-pos)" }}>{stats.pos.active}</span> active
            <span className="cn-kpi-foot-sep">·</span>
            <span className="cn-mono">{shFmt(stats.pos.value)}</span>
          </div>
        </button>
      </div>

      {/* Type description band */}
      <div className="cn-sh-band">
        <div>
          <div className="cn-card-eyebrow" style={{ color: "var(--cn-copper)" }}>{titles[tab].eyebrow}</div>
          <div style={{ fontSize: 13.5, color: "var(--cn-ink-2)", marginTop: 2 }}>{titles[tab].blurb}</div>
        </div>
        {tab === "invoice" && (
          <ShInvoiceFromQuote
            scenario={scenario}
            onPick={(opp, account, contact, quote) => {
              const doc = shNewInvoice(opp, account, contact, currentUser, quote);
              // Link account/opp/contact properly
              doc.oppId = opp.id;
              doc.accountId = account.id;
              doc.contactId = contact?.id || null;
              setEditing({ kind: "invoice", doc });
            }}
          />
        )}
      </div>

      {/* Doc list */}
      <div className="cn-sh-list">
        {filtered.length === 0 ? (
          <div className="cn-docs-empty">
            <div className="cn-docs-empty-title">
              {q ? "No matches." : `No ${titles[tab].label.toLowerCase()} yet.`}
            </div>
            <div className="cn-docs-empty-sub">Build one and send it for signature.</div>
            <button className="cn-btn cn-btn--primary" style={{ marginTop: 14 }} onClick={() => createNew(tab)}>+ New {titles[tab].eyebrow}</button>
          </div>
        ) : (
          filtered.map(d => (
            <ShDocRow
              key={d.id}
              doc={d}
              kind={tab}
              scenario={scenario}
              onEdit={() => setEditing({ kind: tab, doc: d })}
              onShare={() => setSharing({ kind: tab, doc: d })}
              onDelete={() => onDeleteDoc(tab, d.id)}
              onOpenContact={onOpenContact}
              onOpenOpp={onOpenOpp}
            />
          ))
        )}
      </div>

      {/* Editor modals */}
      {editing?.kind === "loi" && (
        <window.ShLOIBuilder
          doc={editing.doc}
          scenario={scenario}
          currentUser={currentUser}
          onChange={(patch) => onSaveDoc("loi", { ...editing.doc, ...patch })}
          onClose={() => { setEditing(null); refreshAll(); }}
          onShare={() => { setSharing({ kind: "loi", doc: editing.doc }); setEditing(null); }}
          onDelete={() => onDeleteDoc("loi", editing.doc.id)}
        />
      )}
      {editing?.kind === "invoice" && (
        <window.ShInvoiceBuilder
          doc={editing.doc}
          scenario={scenario}
          currentUser={currentUser}
          onChange={(patch) => onSaveDoc("invoice", { ...editing.doc, ...patch })}
          onClose={() => { setEditing(null); refreshAll(); }}
          onShare={() => { setSharing({ kind: "invoice", doc: editing.doc }); setEditing(null); }}
          onDelete={() => onDeleteDoc("invoice", editing.doc.id)}
        />
      )}
      {editing?.kind === "po" && (
        <window.ShPOBuilder
          doc={editing.doc}
          scenario={scenario}
          currentUser={currentUser}
          onChange={(patch) => onSaveDoc("po", { ...editing.doc, ...patch })}
          onClose={() => { setEditing(null); refreshAll(); }}
          onShare={() => { setSharing({ kind: "po", doc: editing.doc }); setEditing(null); }}
          onDelete={() => onDeleteDoc("po", editing.doc.id)}
        />
      )}

      {/* Share modal */}
      {sharing && (
        <ShShareModal
          kind={sharing.kind}
          doc={sharing.doc}
          scenario={scenario}
          currentUser={currentUser}
          onClose={() => { setSharing(null); refreshAll(); }}
          onUpdate={(patch) => {
            const next = shSave(sharing.kind, { ...sharing.doc, ...patch });
            setSharing({ ...sharing, doc: next });
            refreshAll();
          }}
        />
      )}
    </div>
  );
}

// ── Pick a quote to invoice from ────────────────────────────────────────────
function ShInvoiceFromQuote({ scenario, onPick }) {
  const [open, setOpen] = useState(false);
  // Find all quotes across all opps
  const allQuotes = useMemo(() => {
    if (!scenario?.opps) return [];
    const out = [];
    for (const opp of scenario.opps) {
      const list = window.cnQuotes?.readQuotes?.(opp.id) || [];
      for (const q of list) {
        const acct = scenario.accounts.find(a => a.id === opp.accountId);
        const cont = scenario.contacts.find(c => c.id === opp.contactId);
        out.push({ opp, account: acct, contact: cont, quote: q });
      }
    }
    // Prefer accepted quotes, then most recent
    out.sort((a, b) => {
      const pri = (x) => x.quote.status === "accepted" ? 0 : 1;
      const aP = pri(a), bP = pri(b);
      if (aP !== bP) return aP - bP;
      return new Date(b.quote.updatedAt || 0) - new Date(a.quote.updatedAt || 0);
    });
    return out;
  }, [scenario]);

  return (
    <div style={{ position: "relative" }}>
      <button className="cn-btn cn-btn--ghost" onClick={() => setOpen(!open)}>
        Invoice from a quote ↓
      </button>
      {open && (
        <div className="cn-sh-quote-pop" onMouseLeave={() => setOpen(false)}>
          <div className="cn-card-eyebrow" style={{ padding: "12px 14px 6px" }}>Pick a quote</div>
          {allQuotes.length === 0
            ? <div style={{ padding: "0 14px 14px", fontSize: 12.5, color: "var(--cn-mute)" }}>No quotes yet. Build one from a deal first.</div>
            : allQuotes.slice(0, 8).map((row, i) => (
              <button
                key={i}
                className="cn-sh-quote-row"
                onClick={() => { onPick(row.opp, row.account, row.contact, row.quote); setOpen(false); }}
              >
                <div>
                  <div className="cn-mono" style={{ fontSize: 12.5 }}>{row.quote.quoteNumber} · v{row.quote.version}</div>
                  <div style={{ fontSize: 11.5, color: "var(--cn-mute)" }}>{row.account?.name || "—"} · {row.opp.title}</div>
                </div>
                <div className="cn-mono" style={{ fontSize: 12.5 }}>{shFmt(shDocTotal(row.quote))}</div>
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ── Doc list row ───────────────────────────────────────────────────────────
function ShDocRow({ doc, kind, scenario, onEdit, onShare, onDelete, onOpenContact, onOpenOpp }) {
  const total = kind === "po"
    ? (doc.poType === "onetime" ? shDocTotal(doc) : (parseFloat(doc.contractQty) || 0) * (parseFloat(doc.unitPrice) || 0))
    : shDocTotal(doc) + (kind === "invoice" ? ((parseFloat(doc.shippingFee) || 0) + (shDocTotal(doc) * (parseFloat(doc.taxRate) || 0) / 100) - (parseFloat(doc.discount) || 0)) : 0);
  // Counterparty = whoever isn't us (the side that fills + signs).
  const counterName = (d) => {
    if (kind === "invoice") return d.billToName;
    return (d.ourRole === "buyer") ? d.sellerName : d.buyerName;
  };
  const counter = counterName(doc);
  const poTypeLabel = doc.poType === "onetime" ? "One-time" : "Open";
  const sub = kind === "po"
    ? (doc.poType === "onetime"
        ? `One-time · ${(doc.lineItems || []).length} line${(doc.lineItems || []).length === 1 ? "" : "s"} · deliver ${doc.deliveryDate || "—"}`
        : `Open · ${doc.partNumber || "—"} · qty ${doc.contractQty || 0} · through ${doc.expirationDate}`)
    : kind === "invoice"
      ? `Issued ${doc.issueDate} · due ${doc.dueDate}${doc.poReference ? " · ref " + doc.poReference : ""}`
      : `${doc.subject || "—"} · ${doc.bindingNature === "binding" ? "Binding" : "Non-binding"} · valid through ${doc.expiresDate}`;
  const linkedOpp = doc.oppId ? scenario?.opps?.find(o => o.id === doc.oppId) : null;

  return (
    <article className="cn-q-row" style={{ marginBottom: 8 }}>
      <div className="cn-q-row-left">
        <div className="cn-q-vtag cn-mono" style={{ minWidth: 44 }}>{kind === "loi" ? "LOI" : kind === "invoice" ? "INV" : (doc.poType === "onetime" ? "PO" : "OPO")}</div>
        <div className="cn-q-row-meta">
          <div className="cn-q-row-num">
            <span className="cn-mono">{doc.docNumber}</span>
            <ShStatus doc={doc} kind={kind} />
            {counter && <span style={{ color: "var(--cn-mute)", fontSize: 12.5 }}>· {counter}</span>}
          </div>
          <div className="cn-q-row-sub">
            {sub}
            {doc.sentAt && <Fragment> · Sent {shTimeAgo(doc.sentAt)}</Fragment>}
            {doc.viewedAt && <Fragment> · <span className="cn-q-viewed-inline">Viewed {shTimeAgo(doc.viewedAt)}{doc.viewCount > 1 ? ` (${doc.viewCount}×)` : ""}</span></Fragment>}
            {linkedOpp && (
              <Fragment>
                {" · "}
                <button className="cn-link-inline" onClick={() => onOpenOpp && onOpenOpp(linkedOpp.id)} style={{ fontSize: 12 }}>▤ {linkedOpp.title}</button>
              </Fragment>
            )}
          </div>
        </div>
      </div>
      <div className="cn-q-row-right">
        <div className="cn-q-row-total cn-mono">{shFmt(total)}</div>
        <div className="cn-q-row-actions">
          <button className="cn-link" onClick={onEdit}>Edit</button>
          <span className="cn-q-actsep">·</span>
          <button className="cn-link" onClick={onShare}>Send</button>
          <span className="cn-q-actsep">·</span>
          <button className="cn-link cn-link--neg" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </article>
  );
}

// ── Share modal (universal) ────────────────────────────────────────────────
function ShShareModal({ kind, doc, scenario, currentUser, onClose, onUpdate }) {
  const labels = { loi: "Letter of Intent", invoice: "Invoice", po: doc.poType === "onetime" ? "Purchase Order" : "Open Purchase Order" };
  const param = { loi: "loi", invoice: "invoice", po: "po" }[kind];
  const shareUrl = window.location.origin + window.location.pathname + "?" + param + "=" + doc.shareToken;
  const [copied, setCopied] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [, force] = useState(0);

  // Poll for updates
  useEffect(() => {
    const tick = () => {
      const fresh = shRead(kind).find(d => d.id === doc.id);
      if (fresh && (fresh.viewedAt !== doc.viewedAt || fresh.viewCount !== doc.viewCount || fresh.status !== doc.status)) {
        onUpdate({ viewedAt: fresh.viewedAt, viewCount: fresh.viewCount, status: fresh.status, buyerSignedName: fresh.buyerSignedName, buyerSignedDate: fresh.buyerSignedDate, paidAt: fresh.paidAt });
      }
      force(n => n + 1);
    };
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, [doc.id]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); }
    catch {
      const ta = document.createElement("textarea"); ta.value = shareUrl;
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const markSent = () => onUpdate({ sentAt: new Date().toISOString(), status: doc.status === "viewed" ? "viewed" : "sent", sendCount: (doc.sendCount || 0) + 1 });
  const handleEmailSend = () => { markSent(); setJustSent(true); };
  const alreadySent = !!doc.sentAt || justSent;
  const openPreview = () => window.open(shareUrl, "_blank", "noopener");
  const simulateView = () => onUpdate({ viewedAt: new Date().toISOString(), viewCount: (doc.viewCount || 0) + 1, status: "viewed" });

  // Build recipient email
  // Recipient = the counterparty who fills + signs (flips with our role).
  const counterIsSeller = doc.ourRole === "buyer";
  const buyerEmail = kind === "invoice"
    ? (doc.billToEmail || "")
    : (counterIsSeller ? (doc.sellerEmail || "") : (doc.buyerContactEmail || ""));
  const buyerName  = kind === "invoice"
    ? (doc.billToAttention || "")
    : (counterIsSeller ? (doc.sellerRep || "") : (doc.buyerContactName || ""));
  const firstName = (buyerName || "").split(" ")[0] || "there";

  const cnBrandName = (window.CN_BRAND && window.CN_BRAND.name) || "Chief Negotiators";
  const poNoun = doc.poType === "onetime" ? "Purchase Order" : "Open PO";
  const subjectMap = {
    loi:     `Letter of Intent ${doc.docNumber} from ${cnBrandName}`,
    invoice: `Invoice ${doc.docNumber} from ${cnBrandName} — due ${doc.dueDate}`,
    po:      `${poNoun} ${doc.docNumber} — ${cnBrandName}`,
  };
  const poBody = doc.poType === "onetime"
    ? `Hi ${firstName},

Please find Purchase Order ${doc.docNumber} at the link below — itemized, with a delivery date of ${doc.deliveryDate || "TBD"}. Review the lines, fill in your details, and accept directly from the link.

${shareUrl}

— ${currentUser?.name || cnBrandName}`
    : `Hi ${firstName},

Open PO ${doc.docNumber} locks in pricing on ${doc.partNumber || "the agreed SKU"} for the contract quantity of ${doc.contractQty} units through ${doc.expirationDate}. Review the shipping schedule, fill in your signing-authority details, and accept directly from the link.

${shareUrl}

— ${currentUser?.name || cnBrandName}`;
  const bodyMap = {
    loi: `Hi ${firstName},

Please find Letter of Intent ${doc.docNumber} at the link below. The LOI sets out the products, pricing, shipping destination, and commercial terms. You can fill in your company's signing-authority details and accept the terms directly from the link — it'll come straight back to me.

${shareUrl}

Happy to walk through any section before you sign.

— ${currentUser?.name || cnBrandName}`,
    invoice: `Hi ${firstName},

Invoice ${doc.docNumber} is ready for payment — due ${doc.dueDate}. Wire & ACH details are on the invoice itself; you can mark it paid from the link once funds are out the door.

${shareUrl}

Thanks,
${currentUser?.name || cnBrandName}`,
    po: poBody,
  };
  const emailHref = `mailto:${buyerEmail}?subject=${encodeURIComponent(subjectMap[kind])}&body=${encodeURIComponent(bodyMap[kind])}`;
  const encSubj = encodeURIComponent(subjectMap[kind]);
  const encBody = encodeURIComponent(bodyMap[kind]);
  const gmailHref  = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(buyerEmail)}&su=${encSubj}&body=${encBody}`;
  const outlookHref = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(buyerEmail)}&subject=${encSubj}&body=${encBody}`;

  return (
    <div className="cn-modal-scrim" onClick={onClose} style={{ zIndex: 200 }}>
      <div className="cn-modal" onClick={e => e.stopPropagation()} style={{ width: 580 }}>
        <header className="cn-modal-head">
          <div>
            <div className="cn-card-eyebrow">Send {labels[kind]}</div>
            <h2 className="cn-modal-title">{doc.docNumber}</h2>
          </div>
          <button className="cn-icon-btn" onClick={onClose}>✕</button>
        </header>

        <div className="cn-modal-body">
          <div className="cn-share-chooser">
            {alreadySent ? (
              <div className="cn-share-sent-banner" role="status" aria-live="polite">
                <span className="cn-share-sent-check">✓</span>
                <div>
                  <div className="cn-share-sent-title">
                    {labels[kind]} marked as sent{doc.sentAt ? <span className="cn-share-sent-ago"> · {shTimeAgo(doc.sentAt)}</span> : null}
                  </div>
                  <div className="cn-share-sent-sub">
                    A draft should have opened in the tab/app you picked — hit send there to actually deliver it. It's one shareable link, so re-sending never creates a duplicate {labels[kind].toLowerCase()}.
                  </div>
                </div>
              </div>
            ) : (
              <div className="cn-share-chooser-lead">
                How would you like to send <span className="cn-mono">{doc.docNumber}</span>?
              </div>
            )}
            <div className="cn-share-options">
              <div className={"cn-share-option cn-share-option--email" + (alreadySent ? " cn-share-option--done" : "")}>
                <div className="cn-share-option-glyph">{alreadySent ? "✓" : "✉"}</div>
                <div className="cn-share-option-text">
                  <div className="cn-share-option-title">{alreadySent ? "Email draft was opened" : "Open an email draft"}</div>
                  <div className="cn-share-option-sub">{alreadySent
                    ? <Fragment>Same link to the same {labels[kind].toLowerCase()} — re-sending won't create a duplicate.</Fragment>
                    : <Fragment>Opens a pre-filled draft to <span className="cn-mono">{buyerEmail || "buyer email"}</span>. Pick where you read email:</Fragment>}</div>
                  <div className="cn-share-mailrow">
                    <a className="cn-share-mailchip" href={gmailHref} target="_blank" rel="noopener" onClick={handleEmailSend}>Gmail ↗</a>
                    <a className="cn-share-mailchip" href={outlookHref} target="_blank" rel="noopener" onClick={handleEmailSend}>Outlook web ↗</a>
                    <a className="cn-share-mailchip" href={emailHref} onClick={handleEmailSend}>Desktop mail app ↗</a>
                  </div>
                </div>
              </div>
              <button className="cn-share-option" onClick={openPreview}>
                <div className="cn-share-option-glyph">⤓</div>
                <div className="cn-share-option-text">
                  <div className="cn-share-option-title">Preview / Save as PDF</div>
                  <div className="cn-share-option-sub">Opens the printable {labels[kind].toLowerCase()} in a new tab. Print → Save as PDF.</div>
                </div>
                <div className="cn-share-option-chev">↗</div>
              </button>
              <button className="cn-share-option" onClick={copy}>
                <div className="cn-share-option-glyph">⧉</div>
                <div className="cn-share-option-text">
                  <div className="cn-share-option-title">{copied ? "Link copied ✓" : "Copy shareable link"}</div>
                  <div className="cn-share-option-sub cn-mono cn-share-option-link">{shareUrl}</div>
                </div>
                <div className="cn-share-option-chev">{copied ? "✓" : "⧉"}</div>
              </button>
            </div>

            {(doc.sentAt || doc.viewedAt) && (
              <div className="cn-share-status" style={{ marginTop: 8 }}>
                <div>
                  <div className="cn-card-eyebrow">Delivery</div>
                  <div className="cn-share-status-line">
                    {doc.sentAt
                      ? <span><span className="cn-q-status-dot cn-q-status-dot--sent"></span> Sent {shTimeAgo(doc.sentAt)}</span>
                      : <span><span className="cn-q-status-dot cn-q-status-dot--draft"></span> Not yet sent</span>}
                  </div>
                </div>
                <div>
                  <div className="cn-card-eyebrow">View tracking</div>
                  <div className="cn-share-status-line">
                    {doc.viewedAt
                      ? <span><span className="cn-q-status-dot cn-q-status-dot--viewed"></span> Viewed {shTimeAgo(doc.viewedAt)}{doc.viewCount > 1 ? ` · ${doc.viewCount} opens` : ""}</span>
                      : doc.sentAt
                        ? <span><span className="cn-q-status-dot cn-q-status-dot--waiting"></span> Awaiting open…</span>
                        : <span><span className="cn-q-status-dot cn-q-status-dot--draft"></span> Pings here when the buyer opens the link</span>}
                  </div>
                </div>
              </div>
            )}

            {(doc.status === "accepted" || doc.status === "paid") && (
              <div className="cn-sh-accepted">
                <span>✓</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{doc.status === "paid" ? "Marked paid" : "Accepted & signed"}</div>
                  <div style={{ fontSize: 12, color: "var(--cn-mute)" }}>
                    {doc.buyerSignedName ? `By ${doc.buyerSignedName}${doc.buyerSignedTitle ? ", " + doc.buyerSignedTitle : ""}` : ""}
                    {doc.buyerSignedDate ? ` on ${doc.buyerSignedDate}` : ""}
                    {doc.paymentMethodUsed ? `via ${doc.paymentMethodUsed}` : ""}
                  </div>
                </div>
              </div>
            )}
          </div>

          <details className="cn-share-demo">
            <summary>Demo controls</summary>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button className="cn-btn cn-btn--ghost" onClick={simulateView}>Simulate recipient view</button>
              <button className="cn-btn cn-btn--ghost" onClick={() => onUpdate({ sentAt: null, viewedAt: null, viewCount: 0, status: "draft", buyerSignedName: "", buyerSignedDate: "", paidAt: null })}>Reset tracking</button>
            </div>
          </details>
        </div>

        <footer className="cn-modal-foot">
          <div style={{ marginLeft: "auto" }}>
            <button className="cn-btn cn-btn--primary" onClick={onClose}>Done</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ── Public share-view router — picks the right doc view by token ───────────
function ShShareRouter({ token, kind }) {
  const [hit, setHit] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Try localStorage first (rep's own browser — instant).
      let doc = shRead(kind).find(d => d.shareToken === token);

      // 2. Fall back to Supabase (customer's browser — fetches by token).
      if (!doc && window.loadSharedDoc) {
        const remote = await window.loadSharedDoc(token);
        if (remote && remote.kind === kind) doc = remote.doc;
        // Stash it locally so subsequent reads on this browser are instant.
        if (doc) {
          const list = shRead(kind);
          if (!list.some(d => d.id === doc.id)) shWrite(kind, [doc, ...list]);
        }
      }

      if (cancelled) return;
      if (!doc) { setNotFound(true); return; }
      // Register view
      const list = shRead(kind);
      const idx = list.findIndex(d => d.id === doc.id);
      const updated = { ...doc, viewedAt: new Date().toISOString(), viewCount: (doc.viewCount || 0) + 1, status: doc.status === "draft" ? "viewed" : (doc.status === "sent" ? "viewed" : doc.status) };
      if (idx >= 0) list[idx] = updated; else list.unshift(updated);
      shWrite(kind, list);
      if (window.publishSharedDoc) window.publishSharedDoc({ kind, doc: updated });
      setHit({ doc: updated });
    })();
    return () => { cancelled = true; };
  }, [token, kind]);

  if (notFound) return (
    <div className="cn-loading">
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--cn-serif)", fontSize: 32, marginBottom: 8 }}>Document not found</h2>
        <p style={{ color: "var(--cn-mute)" }}>This link may have expired or been deleted.</p>
      </div>
    </div>
  );
  if (!hit) return <div className="cn-loading"><div className="cn-loading-text">Loading…</div></div>;

  const update = (patch) => {
    const list = shRead(kind);
    const next = list.map(d => d.id === hit.doc.id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d);
    shWrite(kind, next);
    const merged = next.find(d => d.id === hit.doc.id);
    if (window.publishSharedDoc) window.publishSharedDoc({ kind, doc: merged });
    setHit({ doc: merged });
  };

  if (kind === "loi") return <window.ShLOIShareView doc={hit.doc} onUpdate={update} />;
  if (kind === "invoice") return <window.ShInvoiceShareView doc={hit.doc} onUpdate={update} />;
  if (kind === "po") return <window.ShPOShareView doc={hit.doc} onUpdate={update} />;
  return null;
}

Object.assign(window, { SalesHubScreen, ShShareRouter, ShShareModal, ShDocRow });
