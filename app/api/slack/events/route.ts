import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import crypto from 'crypto';
import { fetchInitiatives, fetchGoogleDocText } from '@/lib/googleAuth';
import { buildArchieSystemPrompt } from '@/lib/archieContext';
import { askAI } from '@/lib/aiClient';
import { Initiative } from '@/lib/types';

const ALLOWED_CHANNEL_NAMES = ['growth-pod', 'growth-internal', 'growth-product', 'archie-testing'];

// ── Slack signature verification ──────────────────────────────────────────────

function verifySlackSignature(body: string, timestamp: string, signature: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  // Reject requests older than 5 minutes (replay attack protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', signingSecret);
  hmac.update(baseString);
  const computed = `v0=${hmac.digest('hex')}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ── Slack API helpers ──────────────────────────────────────────────────────────

async function slackPost(endpoint: string, payload: Record<string, unknown>) {
  const token = process.env.SLACK_BOT_TOKEN;
  const res = await fetch(`https://slack.com/api/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function getChannelName(channelId: string): Promise<string | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  const res = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json.channel?.name ?? null;
}

async function postMessage(channel: string, text: string, threadTs?: string) {
  const payload: Record<string, unknown> = { channel, text, unfurl_links: false };
  if (threadTs) payload.thread_ts = threadTs;
  return slackPost('chat.postMessage', payload);
}

// ── Core event processing ─────────────────────────────────────────────────────

async function processEvent(event: Record<string, unknown>) {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const hasAI = process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY;

  if (!botToken || !hasAI) {
    console.error('Archie: missing SLACK_BOT_TOKEN or AI key (ANTHROPIC_API_KEY / GEMINI_API_KEY)');
    return;
  }

  const channelId = event.channel as string;
  const channelType = event.channel_type as string; // 'im' for DMs
  const isDM = channelType === 'im';
  const threadTs = (event.thread_ts || event.ts) as string;
  const eventTs = event.ts as string;

  // Strip bot mention from text (e.g. "<@U123456> what's blocking X?" → "what's blocking X?")
  const rawText = (event.text as string) || '';
  const question = rawText.replace(/<@[A-Z0-9]+>/g, '').trim();

  if (!question) return;

  // Channel restriction check (skip for DMs)
  if (!isDM) {
    const channelName = await getChannelName(channelId);
    // If we can't read the channel name (missing scope, private channel), allow through
    if (channelName && !ALLOWED_CHANNEL_NAMES.includes(channelName)) {
      await postMessage(
        channelId,
        `I'm only available in #growth-pod, #growth-internal, #growth-product, and #archie-testing. Ask me there!`,
        eventTs
      );
      return;
    }
  }

  // Fetch live sheet data
  const { initiatives, error: sheetError } = await fetchInitiatives();

  if (sheetError && !initiatives.length) {
    await postMessage(
      channelId,
      `Sorry, I couldn't load the Growth Pod sheet right now (${sheetError}). Try again in a moment.`,
      isDM ? undefined : threadTs
    );
    return;
  }

  // Check if question is about a specific initiative and fetch its PRD
  let docContext: string | undefined;
  const matchedIni = findMentionedInitiative(question, initiatives);
  if (matchedIni?.prdUrl) {
    const text = await fetchGoogleDocText(matchedIni.prdUrl);
    if (text) docContext = text;
  }

  const systemPrompt = buildArchieSystemPrompt(initiatives, docContext);

  let reply = '';
  try {
    reply = await askAI(systemPrompt, question, 800);
    if (!reply) reply = 'I could not generate a response.';
  } catch (err) {
    console.error('Archie: AI error', err);
    reply = 'Something went wrong calling the AI. Please try again.';
  }

  // Post reply
  await postMessage(channelId, reply, isDM ? undefined : threadTs);
}

// Find if the question mentions a specific initiative name
function findMentionedInitiative(question: string, initiatives: Initiative[]): Initiative | null {
  const q = question.toLowerCase();
  return initiatives.find(i => q.includes(i.title.toLowerCase())) ?? null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.text();
  const timestamp = req.headers.get('x-slack-request-timestamp') || '';
  const signature = req.headers.get('x-slack-signature') || '';

  // Verify signature
  if (!verifySlackSignature(body, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle Slack URL verification challenge (one-time setup)
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  const event = payload.event as Record<string, unknown> | undefined;
  if (!event) return new Response('', { status: 200 });

  const eventType = event.type as string;
  const subtype = event.subtype as string | undefined;

  // Only handle app_mention (channel) and direct messages (im)
  const isAppMention = eventType === 'app_mention';
  const isDM = eventType === 'message' && event.channel_type === 'im' && !subtype; // ignore bot messages, edits etc

  if (!isAppMention && !isDM) {
    return new Response('', { status: 200 });
  }

  // Ignore messages from bots (prevent loops)
  if (event.bot_id) return new Response('', { status: 200 });

  // Process asynchronously — return 200 to Slack immediately
  waitUntil(processEvent(event));

  return new Response('', { status: 200 });
}
