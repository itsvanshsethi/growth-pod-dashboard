import { Initiative, Status, Confidence, ChangelogEntry, ChecklistItem, Resource } from './types';
import { COL } from './constants';

function getCell(row: string[], index: number): string {
  return (row[index] || '').trim();
}

function normalizeStatus(raw: string): Status {
  const s = raw.toLowerCase().trim();
  if (s === 'scoping') return 'scoping';
  if (s === 'planned') return 'planned';
  if (s === 'in progress' || s === 'in-progress') return 'in progress';
  if (s === 'live' || s === 'launched' || s === 'complete' || s === 'completed') return 'live';
  if (s === 'paused' || s === 'on hold') return 'paused';
  return 'planned';
}

function normalizeConfidence(raw: string): Confidence {
  const s = raw.toLowerCase().trim();
  if (s.includes('on track')) return 'on track';
  if (s.includes('at risk')) return 'at risk';
  if (s.includes('off track')) return 'off track';
  return 'on track';
}

function isTrackDone(status: string): boolean {
  const s = status.toLowerCase().trim();
  return ['done', 'completed', 'complete', 'live', 'launched', 'yes'].includes(s);
}

function deriveProgress(row: string[], status: Status): number {
  if (status === 'live') return 100;
  if (status === 'scoping') return 0;

  const trackStatuses = [
    getCell(row, COL.DESIGN_STATUS),
    getCell(row, COL.BE_STATUS),
    getCell(row, COL.FE_STATUS),
    getCell(row, COL.QA_STATUS),
  ].filter(Boolean);

  if (!trackStatuses.length) {
    if (status === 'planned') return 5;
    if (status === 'in progress') return 30;
    return 0;
  }

  const score = trackStatuses.reduce((sum, s) => {
    const norm = s.toLowerCase().trim();
    if (isTrackDone(norm)) return sum + 1;
    if (norm.includes('progress') || norm.includes('review')) return sum + 0.5;
    return sum;
  }, 0);

  return Math.round((score / trackStatuses.length) * 100);
}

function deriveChecklist(row: string[], status: Status): ChecklistItem[] {
  const tracks = [
    { label: 'Design', owner: getCell(row, COL.DESIGN_OWNER), statusVal: getCell(row, COL.DESIGN_STATUS) },
    { label: 'Backend (BE)', owner: getCell(row, COL.BE_OWNER), statusVal: getCell(row, COL.BE_STATUS) },
    { label: 'Frontend (FE)', owner: getCell(row, COL.FE_OWNER), statusVal: getCell(row, COL.FE_STATUS) },
    { label: 'QA', owner: getCell(row, COL.QA_OWNER), statusVal: getCell(row, COL.QA_STATUS) },
  ];

  const items: ChecklistItem[] = tracks
    .filter(t => t.owner || t.statusVal)
    .map(t => ({
      text: t.label + (t.owner ? ` — ${t.owner}` : ''),
      done: isTrackDone(t.statusVal),
    }));

  items.push({ text: 'Feature go-live', done: status === 'live' });
  return items;
}

function deriveChangelog(row: string[], featureName: string, status: Status, goLiveDate: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];

  if (status === 'live' && goLiveDate) {
    entries.push({
      date: goLiveDate,
      text: `Feature went live`,
      milestone: true,
      source: 'auto',
    });
  }

  const tracks = [
    { name: 'Design', delayDays: getCell(row, COL.DESIGN_DELAY_DAYS), delayReason: getCell(row, COL.DESIGN_DELAY_REASON) },
    { name: 'BE', delayDays: getCell(row, COL.BE_DELAY_DAYS), delayReason: getCell(row, COL.BE_DELAY_REASON) },
    { name: 'FE', delayDays: getCell(row, COL.FE_DELAY_DAYS), delayReason: getCell(row, COL.FE_DELAY_REASON) },
    { name: 'QA', delayDays: getCell(row, COL.QA_DELAY_DAYS), delayReason: getCell(row, COL.QA_DELAY_REASON) },
  ];

  tracks.forEach(track => {
    const days = parseInt(track.delayDays || '0');
    if (days > 0) {
      entries.push({
        date: goLiveDate || new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
        text: `${track.name} delayed ${days} day${days !== 1 ? 's' : ''}${track.delayReason ? ' — ' + track.delayReason : ''}`,
        milestone: false,
        source: 'auto',
      });
    }
  });

  return entries;
}

function deriveBlockers(row: string[]): string[] {
  return [
    getCell(row, COL.DESIGN_BLOCKER),
    getCell(row, COL.BE_BLOCKER),
    getCell(row, COL.FE_BLOCKER),
    getCell(row, COL.QA_BLOCKER),
  ].filter(Boolean);
}

function deriveResources(row: string[], title: string): Resource[] {
  const resources: Resource[] = [];
  const prdUrl = getCell(row, COL.PRD_URL);
  const figmaUrl = getCell(row, COL.FIGMA_URL);
  const otherUrl = getCell(row, COL.OTHER_URL);

  if (prdUrl) {
    resources.push({ type: 'prd', label: `PRD — ${title}`, description: 'Google Doc · PRD', url: prdUrl });
  }
  if (figmaUrl) {
    resources.push({ type: 'figma', label: `Figma — ${title}`, description: 'Figma · UI designs', url: figmaUrl });
  }
  if (otherUrl) {
    resources.push({ type: 'link', label: 'Additional resources', description: 'External link', url: otherUrl });
  }

  return resources;
}

export function parseSheetRows(
  rows: string[][],
  changelogRows?: string[][]
): Initiative[] {
  if (!rows || rows.length < 2) return [];

  // Skip header row
  const dataRows = rows.slice(1);

  // Map of feature name → manual changelog entries
  const manualChangelog: Record<string, ChangelogEntry[]> = {};
  if (changelogRows && changelogRows.length > 1) {
    changelogRows.slice(1).forEach(clRow => {
      const featureName = (clRow[0] || '').trim();
      const date = (clRow[1] || '').trim();
      const note = (clRow[2] || '').trim();
      const isMilestone = (clRow[3] || '').toLowerCase().trim() === 'y';
      if (featureName && note) {
        if (!manualChangelog[featureName]) manualChangelog[featureName] = [];
        manualChangelog[featureName].push({
          date,
          text: note,
          milestone: isMilestone,
          source: 'manual',
        });
      }
    });
  }

  const initiatives: Initiative[] = [];

  dataRows.forEach((row, idx) => {
    const title = getCell(row, COL.FEATURE);
    if (!title) return; // skip empty rows

    const statusRaw = getCell(row, COL.FEATURE_STATUS);
    const confidenceRaw = getCell(row, COL.CONFIDENCE);
    const status = normalizeStatus(statusRaw);
    const confidence = normalizeConfidence(confidenceRaw);
    const goLiveDate = getCell(row, COL.GO_LIVE_DATE);
    const quarter = getCell(row, COL.SPRINT);

    const progress = deriveProgress(row, status);
    const checklist = deriveChecklist(row, status);
    const autoChangelog = deriveChangelog(row, title, status, goLiveDate);
    const manualEntries = manualChangelog[title] || [];
    const changelog = [...autoChangelog, ...manualEntries].sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    const blockers = deriveBlockers(row);
    const resources = deriveResources(row, title);

    const owners: Initiative['owners'] = {};
    const designOwner = getCell(row, COL.DESIGN_OWNER);
    const beOwner = getCell(row, COL.BE_OWNER);
    const feOwner = getCell(row, COL.FE_OWNER);
    const qaOwner = getCell(row, COL.QA_OWNER);
    if (designOwner) owners.design = designOwner;
    if (beOwner) owners.be = beOwner;
    if (feOwner) owners.fe = feOwner;
    if (qaOwner) owners.qa = qaOwner;

    const northStar = getCell(row, COL.NORTH_STAR);
    const successMetrics = getCell(row, COL.SUCCESS_METRICS);
    const metrics = successMetrics
      ? successMetrics.split(/[,\n;]/).map(m => m.trim()).filter(Boolean).map((m, i) => ({
          text: m,
          kind: (m === northStar ? 'north_star' : i === 0 ? 'north_star' : 'leading') as 'north_star' | 'leading',
        }))
      : [];
    if (northStar && !metrics.find(m => m.text === northStar)) {
      metrics.unshift({ text: northStar, kind: 'north_star' });
    }

    initiatives.push({
      id: String(idx + 1),
      title,
      status,
      quarter,
      goLiveDate,
      confidence,
      progress,
      spotlight: status === 'live',
      owners,
      description: getCell(row, COL.DESCRIPTION),
      northStar,
      successMetrics,
      notes: getCell(row, COL.NOTES),
      metrics,
      checklist,
      blockers,
      changelog,
      resources,
      prdUrl: getCell(row, COL.PRD_URL) || undefined,
      figmaUrl: getCell(row, COL.FIGMA_URL) || undefined,
    });
  });

  return initiatives;
}
