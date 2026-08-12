import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { verifySlackRequest } from '@/lib/slackClient';
import { handleButtonAction, handleModalSubmit } from '@/lib/signoffFlow';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? '';
  const signature = req.headers.get('x-slack-signature') ?? '';

  if (!verifySlackRequest(body, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const params = new URLSearchParams(body);
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(params.get('payload') ?? '{}') as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const payloadType = payload.type as string;

  if (payloadType === 'block_actions') {
    const triggerId = (payload.trigger_id as string) ?? '';
    const actions = (payload.actions as Array<Record<string, string>>) ?? [];
    const action = actions[0];
    if (!action) return NextResponse.json({});

    const actionId = action.action_id ?? '';
    const value = action.value ?? '';

    // trigger_id expires in 3 seconds — openModal is called inside handleButtonAction immediately
    waitUntil(handleButtonAction(actionId, value, triggerId));
    return NextResponse.json({});
  }

  if (payloadType === 'view_submission') {
    const view = (payload.view as Record<string, unknown>) ?? {};
    const callbackId = (view.callback_id as string) ?? '';
    const privateMeta = (view.private_metadata as string) ?? '{}';
    const viewValues = (view.state as { values: Record<string, Record<string, { value?: string; selected_date?: string }>> })?.values ?? {};

    waitUntil(handleModalSubmit(callbackId, viewValues, privateMeta));
    // response_action: 'clear' closes the modal immediately
    return NextResponse.json({ response_action: 'clear' });
  }

  return NextResponse.json({});
}
