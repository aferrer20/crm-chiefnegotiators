# CN + SSP CRM — deployment

Two builds from one source. Same repo, two hosting projects.

## Layout

    deploy/index.html        -> cncrm.thechiefnegotiators.com   (Chief Negotiators)
    deploy-ssp/index.html    -> ssp.thechiefnegotiators.com     (SSP)

Both files are named index.html on purpose — that's the default document each
host serves. The FOLDER is what selects the brand, so don't rename them.

## Hosting setup (Vercel / Netlify / Cloudflare Pages)

Create two projects from this one repo. The only difference between them:

    Project 1   Root directory: deploy
    Project 2   Root directory: deploy-ssp

No build command, no install step — these are self-contained static files.

## Why two subdomains and not two paths

localStorage is scoped to the host. On separate subdomains each brand gets its
own isolated storage. Served as paths on ONE host (app.example.com/cn and
/ssp) they would share every storage key: the brand override, the per-brand
document namespaces, the cluster-claim cache. Keep them on separate hosts.

Consequence: Supabase keeps its auth session in localStorage too, so a founder
working in both brands signs in on each subdomain separately.

## These are build artifacts

Each index.html is compiled from the project sources (brand.js, app.jsx,
partners*.jsx, documents*.jsx, supabase-client.js, and the two entry HTML
files) with every document asset inlined. Commit the sources and
supabase/migrations/ alongside them, or nobody can rebuild.

## Database

Migrations applied: 01-18. Run any new ones in the Supabase SQL editor
before deploying a build that depends on them.
