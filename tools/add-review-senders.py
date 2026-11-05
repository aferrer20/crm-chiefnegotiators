#!/usr/bin/env python3
"""Add the Review senders screen to a CRM bundle.

    python3 tools/add-review-senders.py index.html

Idempotent: re-running replaces the module with the current
build/review-senders.js and leaves the nav and view wiring alone.

What it changes inside the bundle:
  1. Adds build/review-senders.js as its own module (gzip, like the others),
     loaded just before the app's root module.
  2. Sidebar (Relationships group): a "Review senders" item after Contacts,
     with a pending-count badge.
  3. App view switch: renders window.CnReviewSenders for view "review-senders".

Run this BEFORE tools/build-ssp.py so the SSP build gets the screen too.
"""
import base64, gzip, json, re, sys, uuid

MAN_RE = re.compile(r'(<script type="__bundler/manifest">)(.*?)(</script>)', re.S)
TPL_RE = re.compile(r'(<script type="__bundler/template">)(.*?)(</script>)', re.S)
MODULE_ID = "7e5e17c0-5e4d-4e1a-9b77-2eb1e5e0a5d1"   # fixed so re-runs replace, not duplicate
SRC = "build/review-senders.js"

NAV_ANCHOR = '''{
      id: "contacts",
      label: "Contacts",
      icon: "◉"
    }, {'''
NAV_ITEM = '''{
      id: "contacts",
      label: "Contacts",
      icon: "◉"
    }, {
      id: "review-senders",
      label: "Review senders",
      icon: "✓"
    }, {'''
BADGE_ANCHOR = 'it.id === "today" && window.CnTodayBadge && React.createElement(window.CnTodayBadge, null),'
BADGE_ADD = BADGE_ANCHOR + ' it.id === "review-senders" && window.CnReviewSendersBadge && React.createElement(window.CnReviewSendersBadge, null),'
VIEW_ANCHOR = '}), view === "today" && React.createElement(window.CnToday || window.TodayScreen, {'
VIEW_ADD = ('}), view === "review-senders" && window.CnReviewSenders && React.createElement(window.CnReviewSenders, {\n'
            '    scenario: scenario,\n    currentUser: currentUser\n  ' + VIEW_ANCHOR)


def gz_b64(b):
    return base64.b64encode(gzip.compress(b, mtime=0)).decode()


def unpack(entry):
    b = base64.b64decode(entry["data"])
    return gzip.decompress(b) if entry.get("compressed") else b


def patch_module(man, tpl_order, marker, fn, label):
    """Find the one module containing `marker`, apply fn to its text."""
    hits = [u for u in tpl_order if marker in unpack(man[u]).decode("utf-8")]
    if len(hits) != 1:
        sys.exit(f"add-review-senders: expected 1 module with the {label} anchor, found {len(hits)}. The bundle changed shape; update this script.")
    u = hits[0]
    text = unpack(man[u]).decode("utf-8")
    new = fn(text)
    man[u] = {**man[u], "compressed": True, "data": gz_b64(new.encode("utf-8"))}


def main(path):
    s = open(path, encoding="utf-8").read()
    man = json.loads(MAN_RE.search(s).group(2))
    tpl = json.loads(TPL_RE.search(s).group(2))
    order = re.findall(r'<script src="([0-9a-f-]{36})"', tpl)

    # 1. module
    man[MODULE_ID] = {"mime": "application/javascript", "compressed": True,
                      "data": gz_b64(open(SRC, "rb").read())}
    if MODULE_ID not in order:
        root = order[-1]   # ErrorBoundary + App mount
        tag = f'<script src="{root}"'
        if tpl.count(tag) != 1:
            sys.exit("add-review-senders: couldn't find the root module tag.")
        tpl = tpl.replace(tag, f'<script src="{MODULE_ID}"></script>\n{tag}', 1)

    # 2. sidebar
    def nav(t):
        if '"review-senders"' in t:
            return t
        if t.count(NAV_ANCHOR) != 1 or t.count(BADGE_ANCHOR) != 1:
            sys.exit("add-review-senders: sidebar anchors moved; update this script.")
        return t.replace(NAV_ANCHOR, NAV_ITEM, 1).replace(BADGE_ANCHOR, BADGE_ADD, 1)
    patch_module(man, order, BADGE_ANCHOR, nav, "sidebar")

    # 3. view switch
    def view(t):
        if 'view === "review-senders"' in t:
            return t
        if t.count(VIEW_ANCHOR) != 1:
            sys.exit("add-review-senders: view-switch anchor moved; update this script.")
        return t.replace(VIEW_ANCHOR, VIEW_ADD, 1)
    patch_module(man, order, VIEW_ANCHOR, view, "view switch")

    s = MAN_RE.sub(lambda m: m.group(1) + json.dumps(man, separators=(",", ":")).replace("</", "<\\/") + m.group(3), s, count=1)
    s = TPL_RE.sub(lambda m: m.group(1) + " " + json.dumps(tpl).replace("</", "<\\/") + "\n  " + m.group(3), s, count=1)
    open(path, "w", encoding="utf-8").write(s)
    print(f"add-review-senders: patched {path} ({len(s):,} bytes)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
