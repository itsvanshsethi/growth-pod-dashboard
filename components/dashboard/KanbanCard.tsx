'use client';
import { Initiative } from '@/lib/types';
import { ConfidenceBadge } from './shared/Badge';
import { ProgressBar } from './shared/ProgressBar';
import { ownerFirstName } from '@/lib/utils';
import { SPOTLIGHT_COLOR } from '@/lib/constants';

interface KanbanCardProps {
  initiative: Initiative;
  selected: boolean;
  onClick: () => void;
}

export function KanbanCard({ initiative, selected, onClick }: KanbanCardProps) {
  const { title, confidence, quarter, goLiveDate, progress, spotlight, owners } = initiative;
  const primaryOwner = ownerFirstName(owners);

  const borderStyle: React.CSSProperties = spotlight
    ? { borderLeft: `3px solid ${SPOTLIGHT_COLOR}`, borderRadius: '0 6px 6px 0' }
    : {};

  return (
    <div
      onClick={onClick}
      style={borderStyle}
      className={`bg-white rounded-md p-2.5 cursor-pointer transition-all group ${
        selected
          ? 'border border-[#1B1B1B]'
          : 'border border-[#EAE7E2] hover:border-[#D4D0CA]'
      }`}
    >
      <div className="text-[13px] font-medium text-[#1B1B1B] leading-snug mb-1.5">{title}</div>
      <div className="flex items-center gap-1 flex-wrap mb-1.5">
        <ConfidenceBadge confidence={confidence} small />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-[#8E8E8E]">{primaryOwner}</span>
        <span className="text-[10px] text-[#8E8E8E] border border-[#EAE7E2] rounded px-1 py-0.5">
          {quarter}
        </span>
      </div>
      {goLiveDate && (
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-[#8E8E8E]">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M5 1v2M11 1v2M2 6h12M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {goLiveDate}
        </div>
      )}
      {progress > 0 && (
        <div className="mt-2">
          <ProgressBar value={progress} />
        </div>
      )}
    </div>
  );
}
