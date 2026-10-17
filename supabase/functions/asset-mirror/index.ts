// asset-mirror — copies email artwork committed to this (public) repo into the
// public email-assets bucket, so campaigns load images from the CRM's own
// storage rather than GitHub. Only files under this repo are accepted.
// POST { files: [{ src: "assets/email/...", dest: "events/x/hero.jpg" }], ref?: "branch" }
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAW = "https://raw.githubusercontent.com/aferrer20/crm-chiefnegotiators/";
const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", pdf: "application/pdf" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "body must be JSON" }, 400); }
  const ref = String(body.ref || "main").replace(/[^\w./-]/g, "");
  const out: any[] = [];
  for (const f of body.files || []) {
    const src = String(f.src || ""), dest = String(f.dest || "");
    if (!/^assets\/email\/[\w./-]+$/.test(src) || src.includes("..") || !/^[\w./-]+$/.test(dest) || dest.includes("..")) { out.push({ src, error: "rejected path" }); continue; }
    const ext = (dest.split(".").pop() || "").toLowerCase();
    if (!TYPES[ext]) { out.push({ src, error: "unsupported type" }); continue; }
    const r = await fetch(RAW + ref + "/" + src);
    if (!r.ok) { out.push({ src, error: "fetch " + r.status }); continue; }
    const bytes = new Uint8Array(await r.arrayBuffer());
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/email-assets/${dest}`, {
      method: "POST",
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": TYPES[ext], "x-upsert": "true", "cache-control": "max-age=31536000" },
      body: bytes,
    });
    out.push(up.ok ? { src, bytes: bytes.length, url: `${SUPABASE_URL}/storage/v1/object/public/email-assets/${dest}` } : { src, error: "upload " + up.status + " " + (await up.text()).slice(0, 120) });
  }
  return json({ ok: out.every((x) => !x.error), files: out });
});
