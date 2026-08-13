import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { verifySlackRequest, postMessage, updateMessage } from '@/lib/slackClient';
import { fetchInitiatives, fetchGoogleDocText } from '@/lib/googleAuth';
import { buildArchieSystemPrompt } from '@/lib/archieContext';
import { askAI } from '@/lib/aiClient';
import { Initiative } from '@/lib/types';

const ALLOWED_CHANNEL_NAMES = ['growth-pod', 'growth-internal', 'growth-product', 'archie-testing'];

async function getChannelName(channelId: string): Promise<string | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  const res = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const json = await res.json() as { channel?: { name: string } };
  return json.channel?.name ?? null;
}

async function processEvent(event: Record<string, unknown>) {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const hasAI = process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY;
  if (!botToken || !hasAI) {
    console.error('Archie: missing SLACK_BOT_TOKEN or AI key');
    return;
  }

  const channelId = event.channel as string;
  const channelType = event.channel_type as string;
  const isDM = channelType === 'im';
  const threadTs = (event.thread_ts || event.ts) as string;
  const eventTs = event.ts as string;

  const rawText = (event.text as string) || '';
  const question = rawText.replace(/<@[A-Z0-9]+>/g, '').trim();
  if (!question) return;

  if (!isDM) {
    const channelName = await getChannelName(channelId);
    if (channelName && !ALLOWED_CHANNEL_NAMES.includes(channelName)) {
      await postMessage(
        channelId,
        `I'm only available in #growth-pod, #growth-internal, #growth-product, and #archie-testing. Ask me there!`,
        { threadTs: eventTs },
      );
      return;
    }
  }

  const thinkingTs = await postMessage(channelId, '_Archie is thinking…_', isDM ? {} : { threadTs });

  const { initiatives, error: sheetError } = await fetchInitiatives();
  if (sheetError && !initiatives.length) {
    const errMsg = `Sorry, I couldn't load the Growth Pod sheet right now (${sheetError}). Try again in a moment.`;
    if (thinkingTs) await updateMessage(channelId, thinkingTs, errMsg);
    else await postMessage(channelId, errMsg, isDM ? {} : { threadTs });
    return;
  }

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

  if (thinkingTs) await updateMessage(channelId, thinkingTs, reply);
  else await postMessage(channelId, reply, isDM ? {} : { threadTs });
}

function findMentionedInitiative(question: string, initiatives: Initiative[]): Initiative | null {
  const q = question.toLowerCase();
  return initiatives.find(i => q.includes(i.title.toLowerCase())) ?? null;
}


export async function POST(req: NextRequest) {
  const body = await req.text();
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? '';
  const signature = req.headers.get('x-slack-signature') ?? '';

  if (!verifySlackRequest(body, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  const event = payload.event as Record<string, unknown> | undefined;
  if (!event) return new Response('', { status: 200 });

  const eventType = event.type as string;
  const subtype = event.subtype as string | undefined;

  const isAppMention = eventType === 'app_mention';
  const isDM = eventType === 'message' && event.channel_type === 'im' && !subtype;

  if (!isAppMention && !isDM) return new Response('', { status: 200 });
  if (event.bot_id) return new Response('', { status: 200 });

  waitUntil(processEvent(event));
  return new Response('', { status: 200 });
}
