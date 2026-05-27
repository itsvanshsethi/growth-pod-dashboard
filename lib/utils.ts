import type { CSSProperties } from 'react';
import { Status, Confidence } from './types';
import { STATUS_BADGE, CONFIDENCE_BADGE, STATUS_LABEL, CONFIDENCE_LABEL } from './constants';

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function statusStyle(status: Status): CSSProperties {
  const c = STATUS_BADGE[status] || STATUS_BADGE.planned;
  return { backgroundColor: c.bg, color: c.text };
}

export function confidenceStyle(confidence: Confidence): CSSProperties {
  const c = CONFIDENCE_BADGE[confidence] || CONFIDENCE_BADGE['on track'];
  return { backgroundColor: c.bg, color: c.text };
}

export function statusLabel(status: Status): string {
  return STATUS_LABEL[status] || cap(status);
}

export function confidenceLabel(confidence: Confidence): string {
  return CONFIDENCE_LABEL[confidence] || cap(confidence);
}

export function formatNow(): string {
  const d = new Date();
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function ownerShortList(owners: Record<string, string | undefined>): string {
  const list = Object.entries(owners)
    .filter(([, v]) => !!v)
    .map(([k, v]) => `${cap(k)}: ${v}`);
  return list.join(' · ') || 'No owners';
}

export function ownerFirstName(owners: Record<string, string | undefined>): string {
  const first = Object.values(owners).find(Boolean);
  return first ? first.split(' ')[0] : '—';
}

export function extractDocId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export function formatWeekOf(date: Date = new Date()): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
