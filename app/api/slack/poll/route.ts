import { NextRequest, NextResponse } from 'next/server';
import { checkAndSendReminders, checkNewSignoffs } from '@/lib/signoffFlow';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '');
    if (authHeader !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const results = await Promise.allSettled([
    checkNewSignoffs(),
    checkAndSendReminders(),
  ]);

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => String(r.reason));

  if (errors.length > 0) {
    console.error('[Poll] Errors:', errors);
  }

  return NextResponse.json({
    ok: errors.length === 0,
    ts: new Date().toISOString(),
    errors: errors.length > 0 ? errors : undefined,
  });
}
