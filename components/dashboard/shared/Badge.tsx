'use client';
import React from 'react';
import { Status, Confidence } from '@/lib/types';
import { statusStyle, confidenceStyle, statusLabel, confidenceLabel } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  small?: boolean;
}

export function Badge({ children, style, small }: BadgeProps) {
  return (
    <span
      style={style}
      className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${
        small ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'
      }`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, small }: { status: Status; small?: boolean }) {
  return (
    <Badge style={statusStyle(status)} small={small}>
      {statusLabel(status)}
    </Badge>
  );
}

export function ConfidenceBadge({ confidence, small }: { confidence: Confidence; small?: boolean }) {
  return (
    <Badge style={confidenceStyle(confidence)} small={small}>
      {confidenceLabel(confidence)}
    </Badge>
  );
}
