#!/usr/bin/env python3
"""Build the SSP deployment from the CN bundle.

    python3 tools/build-ssp.py index.html ../crmssp/index.html

Both sites run the same app. The SSP build differs only in what the browser
sees before the app boots: the pinned brand (CN_BRAND_KEY), the page title,
the home-screen name and the navy loading colours. Every module, fix and
screen comes from the CN bundle, so SSP can never fall behind again. Run this
on every release and commit the result to the crmssp repo.
"""
import json, re, sys

MAN_RE = re.compile(r'(<script type="__bundler/manifest">)(.*?)(</script>)', re.S)
TPL_RE = re.compile(r'(<script type="__bundler/template">)(.*?)(</script>)', re.S)

CN_TITLE, SSP_TITLE = "Chief Negotiators · CRM", "Strategic Supply Partners · CRM"
CN_PAPER, SSP_NAVY = "#F4EEE3", "#0B1629"


def must_replace(s, old, new, count=1, where=""):
    n = s.count(old)
    if n != count:
        sys.exit(f"build-ssp: expected {count}x {old!r} in {where}, found {n}. The CN bundle changed shape; update this script.")
    return s.replace(old, new)


def build(src, dst):
    s = open(src, encoding="utf-8").read()
    tpl = json.loads(TPL_RE.search(s).group(2))

    # Inside the app: brand pin, title, mobile chrome.
    tpl = must_replace(tpl, 'window.CN_BRAND_KEY = "chief";', 'window.CN_BRAND_KEY = "ssp";', where="template")
    tpl = must_replace(tpl, f"<title>{CN_TITLE}</title>", f"<title>{SSP_TITLE}</title>", where="template")
    tpl = must_replace(tpl, '<meta name="theme-color" content="#1A1612">', f'<meta name="theme-color" content="{SSP_NAVY}">', where="template")
    tpl = must_replace(tpl, '<meta name="apple-mobile-web-app-title" content="CN CRM">', '<meta name="apple-mobile-web-app-title" content="SSP CRM">', where="template")
    # The home-screen icon is the CN shield; SSP uses the browser default.
    tpl = re.sub(r'<link rel="apple-touch-icon" href="[0-9a-f-]{36}">\n?', "", tpl, count=1)

    # Outside the app: the unpacking splash.
    s = TPL_RE.sub(lambda m: m.group(1) + " " + json.dumps(tpl).replace("</", "<\\/") + "\n  " + m.group(3), s, count=1)
    s = must_replace(s, f"<title>{CN_TITLE}</title>", f"<title>{SSP_TITLE}</title>", where="loader")
    s = must_replace(s, f"background: {CN_PAPER};", f"background: {SSP_NAVY};", count=2, where="loader")
    s = must_replace(s, f'fill="{CN_PAPER}"', f'fill="{SSP_NAVY}"', where="loader")

    open(dst, "w", encoding="utf-8").write(s)
    print(f"build-ssp: wrote {dst} ({len(s):,} bytes)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    build(sys.argv[1], sys.argv[2])
