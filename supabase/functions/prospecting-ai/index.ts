// Prospecting Engine → Claude, with the firm's key kept server-side.
//
// prospectingengine.html used to carry an Anthropic key in its source, which
// on a public site means anyone could read it and spend against it. The page
// now posts its Messages request here instead. This function:
//   • only answers a signed-in CRM user (their Supabase session token, not the
//     public anon key), so the endpoint is useless to anyone outside the team
//   • adds the key from the ANTHROPIC_API_KEY secret (the same one follow-ups
//     uses) and forwards the request to the Messages API
//   • clamps model, tokens and request size so one bad call can't run up a bill
//
// The page runs its own tool loop, so this is a single pass-through per turn.
// Deploy:  supabase functions deploy prospecting-ai

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
// Optional: comma-separated email domains allowed to use the firm's AI budget.
// Empty means any signed-in CRM user.
const ALLOWED_DOMAINS = (Deno.env.get("PROSPECTING_AI_DOMAINS") || "")
  .split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);

const DEFAULT_MODEL = "claude-opus-5-5";
const MODELS = new Set([
  "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-1",
  "claude-sonnet-4-5", "claude-opus-4-5", "claude-haiku-4-5",
]);
const MAX_TOKENS = 4000;
const MAX_BODY_BYTES = 400_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// The anon key is a valid JWT too, so a token's presence proves nothing. Ask
// Auth who it belongs to; only a real user session gets through.
async function signedInUser(req: Request): Promise<{ id: string; email: string } | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || token === ANON_KEY) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && u.id ? { id: u.id, email: String(u.email || "").toLowerCase() } : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: { message: "POST only" } });
  if (!ANTHROPIC_KEY) return json(503, { error: { message: "ANTHROPIC_API_KEY is not set on the Supabase project." } });

  const user = await signedInUser(req);
  if (!user) return json(401, { error: { message: "Sign in to the CRM first, then reload the Prospecting Engine." } });
  if (ALLOWED_DOMAINS.length && !ALLOWED_DOMAINS.includes(user.email.split("@")[1] || "")) {
    return json(403, { error: { message: "This account isn't allowed to use the firm's AI." } });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: { message: "Request too large." } });
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return json(400, { error: { message: "Body must be JSON." } }); }
  if (!Array.isArray(body.messages) || !body.messages.length) return json(400, { error: { message: "messages is required." } });

  // Forward only the fields the page uses, with limits applied.
  const model = typeof body.model === "string" && MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
  const req2: Record<string, unknown> = {
    model,
    max_tokens: Math.min(Math.max(Number(body.max_tokens) || 1500, 1), MAX_TOKENS),
    messages: body.messages,
  };
  if (body.system) req2.system = body.system;
  if (Array.isArray(body.tools) && body.tools.length) req2.tools = body.tools;

  let r: Response;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(req2),
    });
  } catch (e) {
    return json(502, { error: { message: "Couldn't reach Anthropic: " + ((e as Error).message || e) } });
  }
  const text = await r.text();
  console.log(JSON.stringify({ fn: "prospecting-ai", user: user.email, model, status: r.status }));
  return new Response(text, { status: r.status, headers: { ...CORS, "Content-Type": "application/json" } });
});
