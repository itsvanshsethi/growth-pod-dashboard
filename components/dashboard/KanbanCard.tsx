'use client';
import { motion } from 'framer-motion';
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

  const spotlightStyle: React.CSSProperties = spotlight
    ? { borderLeft: `3px solid ${SPOTLIGHT_COLOR}`, borderRadius: '0 10px 10px 0' }
    : {};

  return (
    <motion.div
      onClick={onClick}
      style={spotlightStyle}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`bg-white rounded-xl p-3 cursor-pointer transition-shadow duration-200 ${
        selected
          ? 'shadow-card-selected border border-[#1B1B1B]'
          : 'shadow-card border border-[#F0EDE9] hover:shadow-card-hover hover:border-[#E0DCD7]'
      }`}
    >
      <div className="text-[13px] font-semibold text-[#1B1B1B] leading-snug mb-2">{title}</div>

      <div className="flex items-center gap-1 flex-wrap mb-2">
        <ConfidenceBadge confidence={confidence} small />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#A09A93] font-medium">{primaryOwner}</span>
        <span className="text-[10px] text-[#A09A93] border border-[#EAE7E2] rounded-md px-1.5 py-0.5 font-medium">
          {quarter}
        </span>
      </div>

      {goLiveDate && (
        <div className="flex items-center gap-1 mt-2 text-[11px] text-[#A09A93]">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M5 1v2M11 1v2M2 6h12M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="font-medium">{goLiveDate}</span>
        </div>
      )}

      {progress > 0 && (
        <div className="mt-2.5">
          <ProgressBar value={progress} />
        </div>
      )}
    </motion.div>
  );
}
