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
    return `token_error:${JSON.stringify(json)}`;
  }

  if (apiKey) return `apikey:${apiKey}`;
  return 'no_credentials';
}

export async function GET() {
  try {
    const auth = await getAccessToken();
    const authMethod = auth.startsWith('Bearer ') ? 'oauth2' : auth.startsWith('apikey:') ? 'apikey' : auth;

    const headers: Record<string, string> = auth.startsWith('Bearer ') ? { Authorization: auth } : {};
    const apiKey = auth.startsWith('apikey:') ? auth.replace('apikey:', '') : '';

    const metaUrl = auth.startsWith('Bearer ')
      ? `${SHEETS_BASE}/${SHEET_ID}?fields=sheets.properties`
      : `${SHEETS_BASE}/${SHEET_ID}?fields=sheets.properties&key=${apiKey}`;

    const metaRes = await fetch(metaUrl, { headers });
    const meta = await metaRes.json();

    // Fetch first 6 rows of columns C (feature name) and AN (status)
    const sheetTitle = meta.sheets?.[0]?.properties?.title || 'Sheet1';
    const rangeUrl = auth.startsWith('Bearer ')
      ? `${SHEETS_BASE}/${SHEET_ID}/values/${encodeURIComponent(`${sheetTitle}!A1:AN6`)}`
      : `${SHEETS_BASE}/${SHEET_ID}/values/${encodeURIComponent(`${sheetTitle}!A1:AN6`)}?key=${apiKey}`;
    const rangeRes = await fetch(rangeUrl, { headers });
    const rangeData = await rangeRes.json();
    const rows: string[][] = rangeData.values || [];

    // Show col C (index 2 = feature name) and col AN (index 39 = status) for each row
    const sample = rows.map((row, i) => ({
      rowNum: i + 1,
      colC: row[2] || '(empty)',
      colAN: row[39] || '(empty)',
    }));

    return NextResponse.json({
      authMethod,
      sheetId: SHEET_ID,
      tabs: meta.sheets?.map((s: { properties: { title: string } }) => s.properties.title) || [],
      sample,
      envVarsPresent: {
        GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
        GOOGLE_REFRESH_TOKEN: !!process.env.GOOGLE_REFRESH_TOKEN,
        GOOGLE_SHEETS_API_KEY: !!process.env.GOOGLE_SHEETS_API_KEY,
      }
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
