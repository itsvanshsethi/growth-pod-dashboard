import { NextResponse } from 'next/server';
import { SHEET_ID } from '@/lib/constants';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export async function GET() {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'No API key' });

  try {
    // Get sheet metadata
    const metaRes = await fetch(`${SHEETS_BASE}/${SHEET_ID}?fields=sheets.properties&key=${apiKey}`);
    const meta = await metaRes.json();

    // Get first 5 rows of every tab
    const tabs = meta.sheets?.map((s: { properties: { title: string } }) => s.properties.title) || [];
    const samples: Record<string, unknown> = {};

    for (const tab of tabs.slice(0, 5)) {
      const r = await fetch(`${SHEETS_BASE}/${SHEET_ID}/values/${encodeURIComponent(tab + '!A1:E5')}?key=${apiKey}`);
      const j = await r.json();
      samples[tab] = j;
    }

    return NextResponse.json({ sheetId: SHEET_ID, tabs, samples });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
