import crypto from 'crypto';

const SLACK_API = 'https://slack.com/api';

async function rawSlackPost(method: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = process.env.SLACK_BOT_TOKEN;
  try {
    const res = await fetch(`${SLACK_API}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const json = await res.json() as Record<string, unknown>;
    if (!json.ok) console.error(`[Slack] ${method} error:`, json.error, JSON.stringify(payload).slice(0, 200));
    return json;
  } catch (err) {
    console.error(`[Slack] ${method} fetch failed:`, err);
    return { ok: false, error: String(err) };
  }
}

export const slackPost = rawSlackPost;

export async function postMessage(
  channel: string,
  text: string,
  opts: { blocks?: Record<string, unknown>[]; threadTs?: string } = {}
): Promise<string | null> {
  const payload: Record<string, unknown> = { channel, text, unfurl_links: false };
  if (opts.blocks?.length) payload.blocks = opts.blocks;
  if (opts.threadTs) payload.thread_ts = opts.threadTs;
  const res = await rawSlackPost('chat.postMessage', payload);
  return (res.ts as string) ?? null;
}

export async function updateMessage(
  channel: string,
  ts: string,
  text: string,
  blocks?: Record<string, unknown>[]
): Promise<void> {
  const payload: Record<string, unknown> = { channel, ts, text, unfurl_links: false };
  if (blocks?.length) payload.blocks = blocks;
  await rawSlackPost('chat.update', payload);
}

export async function postEphemeral(
  channel: string,
  userId: string,
  text: string
): Promise<void> {
  await rawSlackPost('chat.postEphemeral', { channel, user: userId, text });
}

export async function openModal(
  triggerId: string,
  view: Record<string, unknown>
): Promise<void> {
  await rawSlackPost('views.open', { trigger_id: triggerId, view });
}

export async function getDMChannel(userId: string): Promise<string | null> {
  const res = await rawSlackPost('conversations.open', { users: userId });
  return (res.channel as { id: string } | undefined)?.id ?? null;
}

export async function resolveUserIdByName(name: string): Promise<string | null> {
  if (!name || name === 'NA' || name === 'N/A') return null;
  const res = await rawSlackPost('users.list', { limit: 500 });
  const members = (res.members as Array<{
    id: string; name: string; real_name: string; deleted: boolean; is_bot: boolean;
    profile: { display_name: string; real_name: string };
  }>) ?? [];
  const lower = name.toLowerCase().trim();
  const found = members.find(m => {
    if (m.deleted || m.is_bot) return false;
    const dn = (m.profile?.display_name ?? '').toLowerCase().trim();
    const rn = (m.real_name ?? '').toLowerCase().trim();
    const un = (m.name ?? '').toLowerCase().trim();
    return dn === lower || rn === lower || un === lower || rn.split(' ')[0] === lower || lower.split(' ')[0] === rn.split(' ')[0];
  });
  return found?.id ?? null;
}

export function verifySlackRequest(body: string, timestamp: string, signature: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;
  const base = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', signingSecret);
  hmac.update(base);
  const computed = `v0=${hmac.digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}
