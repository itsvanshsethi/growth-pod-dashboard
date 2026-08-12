// Shared Google auth + sheet fetching — used by both the initiatives API route and the Slack bot

import { parseSheetRows } from './sheetParser';
import { SHEET_ID, COL } from './constants';
import { Initiative } from './types';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function b64url(buf: ArrayBuffer): string {
  return btoa(Array.from(new Uint8Array(buf), b => String.fromCharCode(b)).join(''))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getServiceAccountToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })));
  const signingInput = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${b64url(sig)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    cache: 'no-store',
  });
  const json = await res.json() as { access_token?: string };
  if (json.access_token) return `Bearer ${json.access_token}`;
  throw new Error(`Service account token error: ${JSON.stringify(json)}`);
}

export async function getGoogleAuth(): Promise<string> {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

  if (saJson) return getServiceAccountToken(saJson);

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
    const json = await res.json() as { access_token?: string };
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

// ── Google Sheets write helpers ────────────────────────────────────────────────

function toColLetter(zeroIndex: number): string {
  let n = zeroIndex + 1;
  let result = '';
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

async function sheetsWrite(
  path: string,
  method: 'POST' | 'PUT',
  body: Record<string, unknown>,
  auth: string
): Promise<void> {
  const res = await fetch(authUrl(path, auth), {
    method,
    headers: { ...authHeaders(auth), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets write ${res.status}: ${text.slice(0, 300)}`);
  }
}

export async function appendToSheet(tabName: string, values: string[]): Promise<void> {
  const auth = await getGoogleAuth();
  const range = encodeURIComponent(`${tabName}!A:A`);
  const url = `${SHEETS_BASE}/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  await sheetsWrite(url, 'POST', { values: [values] }, auth);
}

export async function updateSheetRow(tabName: string, rowIndex: number, values: string[]): Promise<void> {
  const auth = await getGoogleAuth();
  const lastCol = toColLetter(values.length - 1);
  const range = encodeURIComponent(`${tabName}!A${rowIndex}:${lastCol}${rowIndex}`);
  const url = `${SHEETS_BASE}/${SHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
  await sheetsWrite(url, 'PUT', { values: [values] }, auth);
}

export async function updateCellInSheet(tabName: string, rowIndex: number, colIndex: number, value: string): Promise<void> {
  const auth = await getGoogleAuth();
  const col = toColLetter(colIndex);
  const range = encodeURIComponent(`${tabName}!${col}${rowIndex}`);
  const url = `${SHEETS_BASE}/${SHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
  await sheetsWrite(url, 'PUT', { values: [[value]] }, auth);
}

export async function ensureSheetTab(tabName: string, headers: string[]): Promise<void> {
  const auth = await getGoogleAuth();
  const metaUrl = authUrl(`${SHEETS_BASE}/${SHEET_ID}?fields=sheets.properties.title`, auth);
  const metaRes = await fetch(metaUrl, { headers: authHeaders(auth), cache: 'no-store' });
  const meta = await metaRes.json() as { sheets?: Array<{ properties: { title: string } }> };
  const existing = (meta.sheets ?? []).map(s => s.properties.title);
  if (existing.includes(tabName)) return;

  const batchUrl = `${SHEETS_BASE}/${SHEET_ID}:batchUpdate`;
  try {
    await sheetsWrite(batchUrl, 'POST', { requests: [{ addSheet: { properties: { title: tabName } } }] }, auth);
  } catch (e) {
    if (!String(e).includes('already exists')) throw e;
  }
  await appendToSheet(tabName, headers);
}

export async function updateFeatureStatus(featureName: string, newStatus: string): Promise<boolean> {
  const auth = await getGoogleAuth();
  const firstSheet = await getFirstSheetName(auth);
  const rows = await fetchSheetRange(`${firstSheet}!A:AN`, auth);
  for (let i = 2; i < rows.length; i++) {
    const title = (rows[i][COL.FEATURE] ?? '').trim();
    if (title.toLowerCase() === featureName.toLowerCase()) {
      const sheetRow = i + 1;
      const range = encodeURIComponent(`${firstSheet}!AN${sheetRow}`);
      const url = `${SHEETS_BASE}/${SHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
      await sheetsWrite(url, 'PUT', { values: [[newStatus]] }, auth);
      return true;
    }
  }
  return false;
}

export async function getFeatureRow(featureName: string): Promise<{
  designOwner: string; beOwner: string; feOwner: string; qaOwner: string;
  prdUrl: string; featureStatus: string; row: string[]; sheetRowIndex: number;
} | null> {
  const auth = await getGoogleAuth();
  const firstSheet = await getFirstSheetName(auth);
  const rows = await fetchSheetRange(`${firstSheet}!A:AU`, auth);
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const title = (row[COL.FEATURE] ?? '').trim();
    if (title.toLowerCase() === featureName.toLowerCase()) {
      const clean = (idx: number) => (row[idx] ?? '').trim().replace(/^(NA|N\/A|-+)$/i, '');
      return {
        designOwner: clean(COL.DESIGN_OWNER),
        beOwner: clean(COL.BE_OWNER),
        feOwner: clean(COL.FE_OWNER),
        qaOwner: clean(COL.QA_OWNER),
        prdUrl: clean(COL.PRD_URL),
        featureStatus: clean(COL.FEATURE_STATUS),
        row,
        sheetRowIndex: i + 1,
      };
    }
  }
  return null;
}

export async function getFeaturesByStatus(statuses: string[]): Promise<string[]> {
  const auth = await getGoogleAuth();
  const firstSheet = await getFirstSheetName(auth);
  const rows = await fetchSheetRange(`${firstSheet}!A:AN`, auth);
  const lower = statuses.map(s => s.toLowerCase());
  const result: string[] = [];
  for (const row of rows.slice(2)) {
    const title = (row[COL.FEATURE] ?? '').trim();
    const status = (row[COL.FEATURE_STATUS] ?? '').trim().toLowerCase();
    if (title && lower.includes(status)) result.push(title);
  }
  return result;
}

// ── Google Drive / Docs ────────────────────────────────────────────────────────

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
