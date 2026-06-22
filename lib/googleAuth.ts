// Shared Google auth + sheet fetching — used by both the initiatives API route and the Slack bot

import { parseSheetRows } from './sheetParser';
import { SHEET_ID } from './constants';
import { Initiative } from './types';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export async function getGoogleAuth(): Promise<string> {
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
      cache: 'no-store',
    });
    const json = await res.json();
    if (json.access_token) return `Bearer ${json.access_token}`;
    throw new Error(`OAuth2 token error: ${JSON.stringify(json)}`);
  }

  if (apiKey) return `apikey:${apiKey}`;
  throw new Error('No Google credentials configured');
}

export function authHeaders(auth: string): Record<string, string> {
  return auth.startsWith('Bearer ') ? { Authorization: auth } : {};
}

export function authUrl(base: string, auth: string): string {
  if (auth.startsWith('Bearer ')) return base;
  return `${base}${base.includes('?') ? '&' : '?'}key=${auth.replace('apikey:', '')}`;
}

export async function fetchSheetRange(range: string, auth: string): Promise<string[][]> {
  const base = `${SHEETS_BASE}/${SHEET_ID}/values/${encodeURIComponent(range)}`;
  const res = await fetch(authUrl(base, auth), { headers: authHeaders(auth), cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API ${res.status}: ${text}`);
  }
  const json = await res.json();
  return (json.values as string[][]) || [];
}

export async function getFirstSheetName(auth: string): Promise<string> {
  const base = `${SHEETS_BASE}/${SHEET_ID}?fields=sheets.properties.title`;
  const res = await fetch(authUrl(base, auth), { headers: authHeaders(auth), cache: 'no-store' });
  if (!res.ok) return 'Sheet1';
  const json = await res.json();
  return json.sheets?.[0]?.properties?.title || 'Sheet1';
}

export async function fetchInitiatives(): Promise<{ initiatives: Initiative[]; error?: string }> {
  try {
    const auth = await getGoogleAuth();
    const firstSheet = await getFirstSheetName(auth);

    const [mainRows, clRows] = await Promise.allSettled([
      fetchSheetRange(`${firstSheet}!A:AY`, auth),
      fetchSheetRange('Changelog!A:D', auth),
    ]);

    const rows = mainRows.status === 'fulfilled' ? mainRows.value : [];
    const changelog = clRows.status === 'fulfilled' ? clRows.value : [];

    if (!rows.length) return { initiatives: [], error: 'Sheet returned no data' };

    return { initiatives: parseSheetRows(rows, changelog) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { initiatives: [], error: message };
  }
}

export async function fetchGoogleDocText(docUrl: string): Promise<string | null> {
  try {
    const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
    const match = docUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) return null;
    const docId = match[1];

    let url: string;
    let headers: Record<string, string> = {};

    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
      const auth = await getGoogleAuth();
      url = `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/plain`;
      headers = { Authorization: auth };
    } else if (driveKey) {
      url = `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/plain&key=${driveKey}`;
    } else {
      return null;
    }

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 8000 ? text.slice(0, 8000) + '\n[...truncated]' : text;
  } catch {
    return null;
  }
}
