import { Status, Confidence } from './types';

export const SHEET_ID = '1XM11UOTSxc3E8l73ANISCmcxUFlzeXJtlFSYxSqwcg4';

// Column indices (0-based)
export const COL = {
  SPRINT: 0,         // A
  FEATURE: 2,        // C
  DESCRIPTION: 5,    // F
  DESIGN_OWNER: 6,   // G
  DESIGN_DELAY_DAYS: 9,   // J
  DESIGN_STATUS: 10,      // K
  DESIGN_DELAY_REASON: 11, // L
  DESIGN_BLOCKER: 12,      // M
  BE_OWNER: 14,       // O
  BE_DELAY_DAYS: 17,  // R
  BE_STATUS: 18,      // S
  BE_DELAY_REASON: 19, // T
  BE_BLOCKER: 20,     // U
  FE_OWNER: 22,       // W
  FE_DELAY_DAYS: 25,  // Z
  FE_STATUS: 26,      // AA
  FE_DELAY_REASON: 27, // AB
  FE_BLOCKER: 28,     // AC
  QA_OWNER: 30,       // AE
  QA_DELAY_DAYS: 33,  // AH
  QA_STATUS: 34,      // AI
  QA_DELAY_REASON: 35, // AJ
  QA_BLOCKER: 36,     // AK
  GO_LIVE_DATE: 38,   // AM
  FEATURE_STATUS: 39, // AN
  CONFIDENCE: 40,     // AO
  SUCCESS_METRICS: 44, // AS
  PRD_URL: 45,         // AT
  FIGMA_URL: 46,       // AU
  OTHER_URL: 47,       // AV
  NORTH_STAR: 48,      // AW
  NOTES: 49,           // AX
} as const;

export const STATUS_COLUMNS = [
  { id: 'scoping', label: 'Scoping', bg: '#EEEDFE', tc: '#534AB7' },
  { id: 'planned', label: 'Planned', bg: '#FAEEDA', tc: '#633806' },
  { id: 'in progress', label: 'In Progress', bg: '#E6F1FB', tc: '#0C447C' },
  { id: 'live', label: 'Live', bg: '#EAF3DE', tc: '#27500A' },
  { id: 'paused', label: 'Paused', bg: '#F1EFE8', tc: '#444441' },
] as const;

export const STATUS_BADGE: Record<Status, { bg: string; text: string }> = {
  scoping: { bg: '#EEEDFE', text: '#534AB7' },
  planned: { bg: '#FAEEDA', text: '#633806' },
  'in progress': { bg: '#E6F1FB', text: '#0C447C' },
  live: { bg: '#EAF3DE', text: '#27500A' },
  paused: { bg: '#F1EFE8', text: '#444441' },
};

export const CONFIDENCE_BADGE: Record<Confidence, { bg: string; text: string }> = {
  'on track': { bg: '#EAF3DE', text: '#27500A' },
  'at risk': { bg: '#FAEEDA', text: '#633806' },
  'off track': { bg: '#FCEBEB', text: '#791F1F' },
};

export const SPOTLIGHT_COLOR = '#1D9E75';

export const STATUS_LABEL: Record<Status, string> = {
  scoping: 'Scoping',
  planned: 'Planned',
  'in progress': 'In Progress',
  live: 'Live',
  paused: 'Paused',
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  'on track': 'On track',
  'at risk': 'At risk',
  'off track': 'Off track',
};
