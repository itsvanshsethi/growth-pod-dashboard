import { NextResponse } from 'next/server';
import { fetchInitiatives } from '@/lib/googleAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const hasCredentials =
    process.env.GOOGLE_SHEETS_API_KEY ||
    (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);

  if (!hasCredentials) {
    return NextResponse.json(
      { initiatives: [], lastSynced: '', error: 'Google Sheets API key not configured' },
      { status: 503 }
    );
  }

  const { initiatives, error } = await fetchInitiatives();

  if (error && !initiatives.length) {
    return NextResponse.json(
      { initiatives: [], lastSynced: new Date().toISOString(), error },
      { status: error.includes('No Google') ? 503 : 200 }
    );
  }

  return NextResponse.json(
    {
      initiatives,
      lastSynced: new Date().toISOString(),
      ...(error ? { error } : {}),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
