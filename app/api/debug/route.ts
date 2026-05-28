import { NextResponse } from 'next/server';
import { SHEET_ID } from '@/lib/constants';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

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
    throw new Error(`OAuth token error: ${JSON.stringify(json)}`);
  }

  if (apiKey) return `apikey:${apiKey}`;
  throw new Error('No credentials');
}

export async function GET() {
  try {
    const auth = await getAccessToken();
    const headers = auth.startsWith('Bearer ') ? { Authorization: auth } : {};
    const apiKey = auth.startsWith('apikey:') ? auth.replace('apikey:', '') : '';

    const metaUrl = auth.startsWith('Bearer ')
      ? `${SHEETS_BASE}/${SHEET_ID}?fields=sheets.properties`
      : `${SHEETS_BASE}/${SHEET_ID}?fields=sheets.properties&key=${apiKey}`;

    const metaRes = await fetch(metaUrl, { headers });
    const meta = await metaRes.json();
    const tabs = meta.sheets?.map((s: { properties: { title: string } }) => s.properties.title) || [];

    const samples: Record<string, unknown> = {};
    for (const tab of tabs.slice(0, 5)) {
      const rangeUrl = auth.startsWith('Bearer ')
        ? `${SHEETS_BASE}/${SHEET_ID}/values/${encodeURIComponent(tab + '!A1:E5')}`
        : `${SHEETS_BASE}/${SHEET_ID}/values/${encodeURIComponent(tab + '!A1:E5')}?key=${apiKey}`;
      const r = await fetch(rangeUrl, { headers });
      samples[tab] = await r.json();
    }

    return NextResponse.json({ sheetId: SHEET_ID, tabs, samples, authMethod: auth.startsWith('Bearer ') ? 'oauth2' : 'apikey' });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
