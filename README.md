# The Chief Negotiators — Compliance & Onboarding

Static site for **compliance.thechiefnegotiators.com**. Four self-contained pages:

| File | Purpose |
|---|---|
| `index.html` | Landing page — routes visitors to Supplier, Customer, or Compute Deal |
| `supplier.html` | Supplier vetting form (scored, with internal analyst report) |
| `customer.html` | Customer compliance questionnaire (T1 / T2 / T3) |
| `tenant.html` | Compute deal qualification form (off-taker / GPU capacity) |
| `support.js` | Runtime required by the pages (keep alongside) |
| `colors_and_type.css` | Brand design tokens |
| `assets/logo-light.png` | Logo |
| `CNAME` | GitHub Pages custom-domain config |

## Deploy with GitHub Pages

1. Create a repo and upload the **contents of this folder** to the repo root (so `index.html` is at the top level).
2. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Under **Custom domain**, it should pick up `compliance.thechiefnegotiators.com` from the `CNAME` file.
4. At your DNS provider, add a **CNAME record**: host `compliance` → value `<your-username>.github.io`.
5. Wait for DNS to propagate, then tick **Enforce HTTPS**.

## Form submissions

Submissions are sent via Web3Forms to the configured inbox, and a local backup of every submission is also retained in the browser. To change the destination, replace the `access_key` value in `supplier.html`, `customer.html`, and `tenant.html`.
