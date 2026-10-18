// scheduled-dispatch — sends campaigns queued in scheduled_sends once they are
// due. Runs every minute from pg_cron.
//
// Each due row is claimed atomically (claim_due_scheduled_sends moves it to
// 'sending'), then its stored payload goes through send-campaign exactly as the
// browser would have sent it, in the same 400-recipient chunks. The send itself
// is send-campaign's: opt-outs, personalization, tracking, BCC and the
// unsubscribe header all behave identically to an immediate send.
//
// A row left in 'sending' (the function died mid-run) is never retried
// automatically: part of the list may already have it. It is marked failed so a
// person checks the campaign's analytics before resending.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHUNK = 400;
const PER_RUN = 3;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function sendChunk(auth: string, campaign: any, recipients: any[]) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-campaign`, {
    method: "POST",
    headers: { Authorization: auth, "x-cn-internal": SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ campaign, recipients }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok && !(body && (body.ok === true || body.sent > 0))) {
    throw new Error(String((body && (body.error || body.message)) || `send-campaign returned ${res.status}`));
  }
  return body || {};
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  // The gateway already verified this caller's JWT; reuse it to reach
  // send-campaign, and prove server origin with the service key.
  const auth = req.headers.get("Authorization") || "";
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const stale = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  await sb.from("scheduled_sends")
    .update({ status: "failed", error: "Interrupted while sending. Check this campaign's analytics before sending again." })
    .eq("status", "sending").lt("updated_at", stale);

  const { data: due, error } = await sb.rpc("claim_due_scheduled_sends", { p_limit: PER_RUN });
  if (error) return json({ error: error.message }, 500);

  const done: any[] = [];
  for (const row of due || []) {
    const campaign = row.payload?.campaign;
    const recipients: any[] = Array.isArray(row.payload?.recipients) ? row.payload.recipients : [];
    const agg = { sent: 0, failed: 0, skipped: [] as any[], failures: [] as any[], chunks: 0 };
    let fatal: string | null = null;

    if (!campaign || !recipients.length) {
      fatal = "Nothing to send: the scheduled payload has no campaign or recipients.";
    } else {
      const total = recipients.length;
      for (let i = 0; i < total; i += CHUNK) {
        const slice = recipients.slice(i, i + CHUNK);
        const isLast = i + CHUNK >= total;
        const c = total > CHUNK ? { ...campaign, recipientTotal: total, final: isLast } : campaign;
        try {
          const part = await sendChunk(auth, c, slice);
          agg.sent += Number(part.sent) || 0;
          agg.failed += Number(part.failed) || 0;
          if (Array.isArray(part.failures)) agg.failures.push(...part.failures.slice(0, 20));
          if (Array.isArray(part.skipped)) agg.skipped.push(...part.skipped);
        } catch (e) {
          agg.failed += slice.length;
          agg.failures.push({ chunk: agg.chunks + 1, count: slice.length, error: (e as Error).message });
        }
        agg.chunks++;
      }
    }

    const status = fatal || agg.sent === 0 ? "failed" : agg.failed ? "partial" : "sent";
    await sb.from("scheduled_sends").update({
      status,
      sent_at: agg.sent ? new Date().toISOString() : null,
      result: { sent: agg.sent, failed: agg.failed, skipped: agg.skipped.length, failures: agg.failures.slice(0, 20), skippedList: agg.skipped.slice(0, 50) },
      error: fatal || (agg.sent === 0 ? String(agg.failures[0]?.error || "Nothing was delivered.") : null),
    }).eq("id", row.id);

    // Count it on the scoreboard for the rep who scheduled it.
    if (agg.sent && row.owner_rep_id && campaign?.id) {
      await sb.from("campaigns").update({ owner_id: row.owner_rep_id }).eq("id", String(campaign.id)).is("owner_id", null);
    }
    done.push({ id: row.id, campaign_id: row.campaign_id, status, sent: agg.sent, failed: agg.failed });
  }

  return json({ ok: true, processed: done.length, done });
});
