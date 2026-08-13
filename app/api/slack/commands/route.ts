import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { verifySlackRequest, postEphemeral } from '@/lib/slackClient';
import { startSignoff, handleRescope, handleResolve } from '@/lib/signoffFlow';

export const dynamic = 'force-dynamic';

const HELP_TEXT = `Available commands:
• \`/archie signoff [Feature Name]\` — start eng sign-off flow
• \`/archie qa-signoff [Feature Name]\` — start QA-only sign-off
• \`/archie rescope [Feature Name] reason: [reason]\` — restart all owners
• \`/archie rescope [Feature Name] tracks: BE,FE reason: [reason]\` — restart specific tracks only
• \`/archie resolve [Feature Name] owner: @mention\` — re-open sign-off after concern resolved`;

async function safeRun(fn: () => Promise<void>, channelId: string, userId: string) {
  try {
    await fn();
  } catch (err) {
    console.error('[Archie command error]', err);
    await postEphemeral(channelId, userId, `Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? '';
  const signature = req.headers.get('x-slack-signature') ?? '';

  if (!verifySlackRequest(body, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const params = new URLSearchParams(body);
  const text = (params.get('text') ?? '').trim();
  const userId = params.get('user_id') ?? '';
  const channelId = params.get('channel_id') ?? '';

  const parts = text.split(/\s+/);
  const subcommand = parts[0]?.toLowerCase() ?? '';
  const rest = parts.slice(1).join(' ').trim();

  const ack = NextResponse.json({ response_type: 'ephemeral', text: '_Processing…_' });

  if (subcommand === 'signoff') {
    if (!rest) return NextResponse.json({ response_type: 'ephemeral', text: 'Usage: `/archie signoff [Feature Name]`' });
    waitUntil(safeRun(() => startSignoff(rest, userId), channelId, userId));
    return ack;
  }

  if (subcommand === 'qa-signoff') {
    if (!rest) return NextResponse.json({ response_type: 'ephemeral', text: 'Usage: `/archie qa-signoff [Feature Name]`' });
    waitUntil(safeRun(() => startSignoff(rest, userId, true), channelId, userId));
    return ack;
  }

  if (subcommand === 'rescope') {
    // Format: /archie rescope Feature Name [tracks: BE,FE] reason: reason text
    const reasonMatch = rest.match(/^(.+?)\s+reason:\s*(.+)$/i);
    if (!reasonMatch) {
      return NextResponse.json({ response_type: 'ephemeral', text: 'Usage: `/archie rescope [Feature Name] reason: [reason]`' });
    }
    let featureName = reasonMatch[1].trim();
    const reason = reasonMatch[2].trim();

    // Optional tracks: filter
    let tracksFilter: string[] | undefined;
    const tracksMatch = featureName.match(/^(.+?)\s+tracks:\s*([A-Za-z,\s]+)$/i);
    if (tracksMatch) {
      featureName = tracksMatch[1].trim();
      tracksFilter = tracksMatch[2].split(',').map(t => t.trim()).filter(Boolean);
    }

    waitUntil(safeRun(() => handleRescope(featureName, reason, tracksFilter), channelId, userId));
    return ack;
  }

  if (subcommand === 'resolve') {
    const ownerMatch = rest.match(/^(.*?)\s+owner:\s*(.+)$/i);
    if (!ownerMatch) {
      return NextResponse.json({ response_type: 'ephemeral', text: 'Usage: `/archie resolve [Feature Name] owner: @mention`' });
    }
    const featureName = ownerMatch[1].trim();
    const ownerName = ownerMatch[2].trim();
    waitUntil(safeRun(() => handleResolve(featureName, ownerName), channelId, userId));
    return ack;
  }

  // Unknown subcommand — show help
  waitUntil(postEphemeral(channelId, userId, HELP_TEXT));
  return NextResponse.json({});
}
