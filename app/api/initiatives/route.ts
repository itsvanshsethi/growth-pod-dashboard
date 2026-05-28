import { NextResponse } from 'next/server';
import { parseSheetRows } from '@/lib/sheetParser';
import { SHEET_ID } from '@/lib/constants';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function fetchRange(sheetId: string, range: string, apiKey: string): Promise<string[][]> {
  const url = `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${text}`);
  }
  const json = await res.json();
  return (json.values as string[][]) || [];
}

async function getFirstSheetName(sheetId: string, apiKey: string): Promise<string> {
  const url = `${SHEETS_BASE}/${sheetId}?fields=sheets.properties.title&key=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return 'Sheet1';
  const json = await res.json();
  return json.sheets?.[0]?.properties?.title || 'Sheet1';
}

export async function GET() {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { initiatives: [], lastSynced: '', error: 'Google Sheets API key not configured' },
      { status: 503 }
    );
  }

  try {
    // Discover actual sheet tab names first
    const firstSheetName = await getFirstSheetName(SHEET_ID, apiKey);

    // Fetch main data — read enough columns to cover AX (col 49, so A:AY covers col 0..50)
    const [mainRows, changelogRows] = await Promise.allSettled([
      fetchRange(SHEET_ID, `${firstSheetName}!A:AY`, apiKey),
      fetchRange(SHEET_ID, 'Changelog!A:D', apiKey),
    ]);

    const rows = mainRows.status === 'fulfilled' ? mainRows.value : [];
    const clRows = changelogRows.status === 'fulfilled' ? changelogRows.value : [];

    if (!rows.length) {
      return NextResponse.json(
        { initiatives: [], lastSynced: new Date().toISOString(), error: 'Sheet returned no data' },
        { status: 200 }
      );
    }

    const initiatives = parseSheetRows(rows, clRows);
    return NextResponse.json({
      initiatives,
      lastSynced: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Initiatives fetch error:', message);
    return NextResponse.json(
      { initiatives: [], lastSynced: '', error: message },
      { status: 502 }
    );
  }
}
