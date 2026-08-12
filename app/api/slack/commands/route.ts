import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { verifySlackRequest, postEphemeral } from '@/lib/slackClient';
import { startSignoff, handleRescope, handleResolve } from '@/lib/signoffFlow';

export const dynamic = 'force-dynamic';

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


  // Parse subcommand: first word after /archie
  const parts = text.split(/\s+/);
  const subcommand = parts[0]?.toLowerCase() ?? '';
  const rest = parts.slice(1).join(' ').trim();

  // Acknowledge immediately (3-second window)
  const ack = NextResponse.json({ response_type: 'ephemeral', text: '_Processing…_' });

  if (subcommand === 'signoff') {
    if (!rest) {
      return NextResponse.json({ response_type: 'ephemeral', text: 'Usage: `/archie signoff [Feature Name]`' });
    }
    waitUntil(startSignoff(rest, userId));
    return ack;
  }

  if (subcommand === 'qa-signoff') {
    if (!rest) {
      return NextResponse.json({ response_type: 'ephemeral', text: 'Usage: `/archie qa-signoff [Feature Name]`' });
    }
    waitUntil(startSignoff(rest, userId, true));
    return ack;
  }

  if (subcommand === 'rescope') {
    // Format: /archie rescope Feature Name reason: reason text
    const reasonMatch = rest.match(/^(.+?)\s+reason:\s*(.+)$/i);
    if (!reasonMatch) {
      return NextResponse.json({ response_type: 'ephemeral', text: 'Usage: `/archie rescope [Feature Name] reason: [reason text]`' });
    }
    const [, featureName, reason] = reasonMatch;
    waitUntil(handleRescope(featureName.trim(), reason.trim()));
    return ack;
  }

  if (subcommand === 'resolve') {
    // Format: /archie resolve Feature Name owner: Owner Name
    const ownerMatch = rest.match(/^(.*?)\s+owner:\s*(.+)$/i);
    if (!ownerMatch) {
      return NextResponse.json({ response_type: 'ephemeral', text: 'Usage: `/archie resolve [Feature Name] owner: [Owner Name]`' });
    }
    const featureName = ownerMatch[1].trim();
    const ownerName = ownerMatch[2].trim();
    waitUntil(handleResolve(featureName, ownerName));
    return ack;
  }

  // Unknown subcommand
  waitUntil(postEphemeral(channelId, userId,
    'Available commands:\n• `/archie signoff [Feature Name]`\n• `/archie qa-signoff [Feature Name]`\n• `/archie rescope [Feature Name] reason: [reason]`\n• `/archie resolve [Feature Name] owner: [Owner Name]`'
  ));
  return NextResponse.json({});
}
