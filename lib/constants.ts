import { Status, Confidence } from './types';

export const SHEET_ID = '1XM11UOTSxc3E8l73ANISCmcxUFlzeXJtlFSYxSqwcg4';

// Column indices (0-based) — reflects sheet as of Aug 2026 (BE/FE/QA Man Days + ETA columns added)
export const COL = {
  SPRINT: 0,              // A
  FEATURE: 2,             // C
  DESCRIPTION: 5,         // F
  DESIGN_OWNER: 6,        // G
  DESIGN_ETA: 7,          // H
  DESIGN_ACTUAL: 8,       // I
  DESIGN_DELAY_DAYS: 9,   // J
  DESIGN_STATUS: 10,      // K
  DESIGN_DELAY_REASON: 11, // L
  DESIGN_BLOCKER: 12,     // M
  DESIGN_DEPENDENCY: 13,  // N
  BE_OWNER: 14,           // O
  BE_MAN_DAYS: 15,        // P
  BE_ETA: 16,             // Q
  BE_ACTUAL: 17,          // R
  BE_DELAY: 18,           // S
  BE_STATUS: 19,          // T
  BE_DELAY_REASON: 20,    // U
  BE_BLOCKER: 21,         // V
  BE_DEPENDENCY: 22,      // W
  FE_OWNER: 23,           // X
  FE_MAN_DAYS: 24,        // Y
  FE_ETA: 25,             // Z
  FE_ACTUAL: 26,          // AA
  FE_DELAY: 27,           // AB
  FE_STATUS: 28,          // AC
  FE_DELAY_REASON: 29,    // AD
  FE_BLOCKER: 30,         // AE
  FE_DEPENDENCY: 31,      // AF
  QA_OWNER: 32,           // AG
  QA_MAN_DAYS: 33,        // AH
  QA_ETA: 34,             // AI
  QA_ACTUAL: 35,          // AJ
  QA_DELAY: 36,           // AK
  QA_STATUS: 37,          // AL
  QA_DELAY_REASON: 38,    // AM
  QA_BLOCKER: 39,         // AN
  QA_DEPENDENCY: 40,      // AO
  FEATURE_DELIVERY: 41,   // AP
  FEATURE_STATUS: 42,     // AQ
  CONFIDENCE: 43,         // AR
  FEATURE_LIVE_ETA: 44,   // AS
  FEATURE_LIVE_ACTUAL: 45, // AT
  FEATURE_DELAY: 46,      // AU
  SUCCESS_METRICS: 47,    // AV
  PRD_URL: 48,            // AW
  FIGMA_URL: 49,          // AX
  OTHER_URL: 50,          // AY
  NORTH_STAR: 51,         // AZ
  NOTES: 52,              // BA
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
