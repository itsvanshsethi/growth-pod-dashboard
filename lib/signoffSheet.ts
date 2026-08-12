import { appendToSheet, updateSheetRow, ensureSheetTab, fetchSheetRange, getGoogleAuth } from './googleAuth';

export const SIGNOFFS_TAB = 'Signoffs';
export const ESCALATION_TAB = 'Escalation Matrix';

const SIGNOFFS_HEADERS = [
  'Feature Name', 'Track', 'Owner Name', 'Owner Slack ID', 'Sign-off Status',
  'Man Days', 'Committed Date', 'Sign-off Date', 'Concerns', 'Round',
  'Channel ID', 'Parent Thread TS', 'Owner Thread TS', 'PM Slack ID',
  'PM DM Channel', 'PM DM Thread TS', 'Initiated At', 'Last Reminded At',
  'Reminder Count', 'Awaiting Input', 'Metadata',
];

const ESCALATION_HEADERS = ['Owner Name', 'Manager Slack Handle'];

export const SCOL = {
  FEATURE_NAME:     0,
  TRACK:            1,
  OWNER_NAME:       2,
  OWNER_SLACK_ID:   3,
  STATUS:           4,
  MAN_DAYS:         5,
  COMMITTED_DATE:   6,
  SIGNOFF_DATE:     7,
  CONCERNS:         8,
  ROUND:            9,
  CHANNEL_ID:       10,
  PARENT_THREAD_TS: 11,
  OWNER_THREAD_TS:  12,
  PM_SLACK_ID:      13,
  PM_DM_CHANNEL:    14,
  PM_DM_THREAD_TS:  15,
  INITIATED_AT:     16,
  LAST_REMINDED_AT: 17,
  REMINDER_COUNT:   18,
  AWAITING_INPUT:   19,
  METADATA:         20,
} as const;

export interface SignoffEntry {
  featureName: string;
  track: string;
  ownerName: string;
  ownerSlackId: string;
  status: string;
  manDays: string;
  committedDate: string;
  signoffDate: string;
  concerns: string;
  round: string;
  channelId: string;
  parentThreadTs: string;
  ownerThreadTs: string;
  pmSlackId: string;
  pmDmChannel: string;
  pmDmThreadTs: string;
  initiatedAt: string;
  lastRemindedAt: string;
  reminderCount: string;
  awaitingInput: string;
  metadata: string;
  rowIndex: number; // 1-based sheet row, 0 means not yet persisted
}

export function entryToRow(e: SignoffEntry): string[] {
  return [
    e.featureName, e.track, e.ownerName, e.ownerSlackId, e.status,
    e.manDays, e.committedDate, e.signoffDate, e.concerns, e.round,
    e.channelId, e.parentThreadTs, e.ownerThreadTs, e.pmSlackId,
    e.pmDmChannel, e.pmDmThreadTs, e.initiatedAt, e.lastRemindedAt,
    e.reminderCount, e.awaitingInput, e.metadata,
  ];
}

export function rowToEntry(row: string[], rowIndex: number): SignoffEntry {
  const g = (i: number) => (row[i] ?? '').trim();
  return {
    featureName:     g(SCOL.FEATURE_NAME),
    track:           g(SCOL.TRACK),
    ownerName:       g(SCOL.OWNER_NAME),
    ownerSlackId:    g(SCOL.OWNER_SLACK_ID),
    status:          g(SCOL.STATUS),
    manDays:         g(SCOL.MAN_DAYS),
    committedDate:   g(SCOL.COMMITTED_DATE),
    signoffDate:     g(SCOL.SIGNOFF_DATE),
    concerns:        g(SCOL.CONCERNS),
    round:           g(SCOL.ROUND) || '1',
    channelId:       g(SCOL.CHANNEL_ID),
    parentThreadTs:  g(SCOL.PARENT_THREAD_TS),
    ownerThreadTs:   g(SCOL.OWNER_THREAD_TS),
    pmSlackId:       g(SCOL.PM_SLACK_ID),
    pmDmChannel:     g(SCOL.PM_DM_CHANNEL),
    pmDmThreadTs:    g(SCOL.PM_DM_THREAD_TS),
    initiatedAt:     g(SCOL.INITIATED_AT),
    lastRemindedAt:  g(SCOL.LAST_REMINDED_AT),
    reminderCount:   g(SCOL.REMINDER_COUNT) || '0',
    awaitingInput:   g(SCOL.AWAITING_INPUT),
    metadata:        g(SCOL.METADATA),
    rowIndex,
  };
}

export async function initSignoffTabs(): Promise<void> {
  await ensureSheetTab(SIGNOFFS_TAB, SIGNOFFS_HEADERS);
  await ensureSheetTab(ESCALATION_TAB, ESCALATION_HEADERS);
}

export async function getAllSignoffEntries(): Promise<SignoffEntry[]> {
  try {
    const auth = await getGoogleAuth();
    const rows = await fetchSheetRange(`${SIGNOFFS_TAB}!A:U`, auth);
    // rows[0] = header, data starts at rows[1] = sheet row 2
    return rows.slice(1).map((row, i) => rowToEntry(row, i + 2));
  } catch {
    return [];
  }
}

export async function addSignoffEntry(entry: SignoffEntry): Promise<void> {
  await appendToSheet(SIGNOFFS_TAB, entryToRow(entry));
}

export async function saveSignoffEntry(entry: SignoffEntry): Promise<void> {
  if (entry.rowIndex < 2) {
    await addSignoffEntry(entry);
  } else {
    await updateSheetRow(SIGNOFFS_TAB, entry.rowIndex, entryToRow(entry));
  }
}

export async function getEntriesForFeature(featureName: string, round?: string): Promise<SignoffEntry[]> {
  const all = await getAllSignoffEntries();
  return all.filter(e =>
    e.featureName.toLowerCase() === featureName.toLowerCase() &&
    (round == null || e.round === round)
  );
}

export async function findByPMThread(pmDmChannel: string, pmDmThreadTs: string): Promise<SignoffEntry | null> {
  const all = await getAllSignoffEntries();
  return all.find(e =>
    e.track === 'COORDINATOR' &&
    e.pmDmChannel === pmDmChannel &&
    e.pmDmThreadTs === pmDmThreadTs
  ) ?? null;
}

export async function findOwnerEntry(featureName: string, ownerSlackId: string, round: string): Promise<SignoffEntry | null> {
  const all = await getAllSignoffEntries();
  return all.find(e =>
    e.featureName.toLowerCase() === featureName.toLowerCase() &&
    e.ownerSlackId === ownerSlackId &&
    e.round === round &&
    e.track !== 'COORDINATOR'
  ) ?? null;
}

export async function getManagerHandle(ownerName: string): Promise<string | null> {
  try {
    const auth = await getGoogleAuth();
    const rows = await fetchSheetRange(`${ESCALATION_TAB}!A:B`, auth);
    const found = rows.slice(1).find(row => (row[0] ?? '').toLowerCase() === ownerName.toLowerCase());
    return found?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

export async function getCurrentRound(featureName: string): Promise<number> {
  const entries = await getEntriesForFeature(featureName);
  const coordinator = entries.find(e => e.track === 'COORDINATOR');
  return parseInt(coordinator?.round ?? '1', 10);
}

export async function hasActiveSignoff(featureName: string): Promise<boolean> {
  const all = await getAllSignoffEntries();
  return all.some(e =>
    e.featureName.toLowerCase() === featureName.toLowerCase() &&
    e.track === 'COORDINATOR' &&
    !['', 'Cancelled'].includes(e.status)
  );
}

// Reads the Escalation Matrix tab for manager lookups
// Tab must exist and follow the schema: Owner Name | Manager Slack Handle
export async function readEscalationMatrix(): Promise<Record<string, string>> {
  try {
    const auth = await getGoogleAuth();
    const rows = await fetchSheetRange(`${ESCALATION_TAB}!A:B`, auth);
    const result: Record<string, string> = {};
    for (const row of rows.slice(1)) {
      const owner = (row[0] ?? '').trim();
      const manager = (row[1] ?? '').trim();
      if (owner && manager) result[owner.toLowerCase()] = manager;
    }
    return result;
  } catch {
    return {};
  }
}
