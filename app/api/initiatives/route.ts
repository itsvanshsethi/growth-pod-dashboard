import { NextResponse } from 'next/server';
import { parseSheetRows } from '@/lib/sheetParser';
import { SHEET_ID } from '@/lib/constants';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

  // Prefer OAuth2 if available
  if (clientId && clientSecret && refreshToken) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const json = await res.json();
    if (json.access_token) return `Bearer ${json.access_token}`;
    throw new Error(`OAuth2 token error: ${JSON.stringify(json)}`);
  }

  // Fall back to API key
  if (apiKey) return `apikey:${apiKey}`;

  throw new Error('No Google credentials configured');
}

async function fetchRange(sheetId: string, range: string, auth: string): Promise<string[][]> {
  let url: string;
  let headers: Record<string, string> = {};

  if (auth.startsWith('Bearer ')) {
    url = `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}`;
    headers = { Authorization: auth };
  } else {
    const apiKey = auth.replace('apikey:', '');
    url = `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
  }

  const res = await fetch(url, { headers, next: { revalidate: 0 } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${text}`);
  }
  const json = await res.json();
  return (json.values as string[][]) || [];
}

async function getFirstSheetName(sheetId: string, auth: string): Promise<string> {
  let url: string;
  let headers: Record<string, string> = {};

  if (auth.startsWith('Bearer ')) {
    url = `${SHEETS_BASE}/${sheetId}?fields=sheets.properties.title`;
    headers = { Authorization: auth };
  } else {
    const apiKey = auth.replace('apikey:', '');
    url = `${SHEETS_BASE}/${sheetId}?fields=sheets.properties.title&key=${apiKey}`;
  }

  const res = await fetch(url, { headers, next: { revalidate: 0 } });
  if (!res.ok) return 'Sheet1';
  const json = await res.json();
  return json.sheets?.[0]?.properties?.title || 'Sheet1';
}

export async function GET() {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const hasOAuth = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN;

  if (!apiKey && !hasOAuth) {
    return NextResponse.json(
      { initiatives: [], lastSynced: '', error: 'Google Sheets API key not configured' },
      { status: 503 }
    );
  }

  try {
    const auth = await getAccessToken();
    const firstSheetName = await getFirstSheetName(SHEET_ID, auth);

    const [mainRows, changelogRows] = await Promise.allSettled([
      fetchRange(SHEET_ID, `${firstSheetName}!A:AY`, auth),
      fetchRange(SHEET_ID, 'Changelog!A:D', auth),
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
