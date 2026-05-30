'use client';
import { ViewMode } from '@/lib/types';

interface HeaderProps {
  lastSynced: string;
  isFetching: boolean;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}

export function Header({ lastSynced, isFetching, view, onViewChange }: HeaderProps) {
  const syncLabel = isFetching
    ? 'Syncing…'
    : lastSynced
    ? `Synced · ${new Date(lastSynced).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    : 'Not synced';

  return (
    <div className="flex items-center justify-between flex-wrap gap-4 mb-6 pb-5 border-b border-[#E8E4DF]">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#A09A93]">
            Razorpay
          </span>
          <span className="w-1 h-1 rounded-full bg-[#D4D0CA]" />
          <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#A09A93]">
            Growth Pod
          </span>
        </div>
        <h1 className="text-[24px] font-semibold text-[#1B1B1B] tracking-tight leading-none">
          What we&apos;re building
        </h1>
        <p className="text-[13px] text-[#8C8880] mt-1.5 leading-none">
          Product initiatives — planned, in progress, and live
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Sync status */}
        <div className={`flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-all ${
          isFetching
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-white border-[#E8E4DF] text-[#8C8880]'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            isFetching ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
          }`} />
          {syncLabel}
        </div>

        {/* View toggle */}
        <div className="flex bg-white border border-[#E8E4DF] rounded-lg p-0.5 shadow-sm">
          {(['kanban', 'founder'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-md transition-all duration-200 ${
                view === v
                  ? 'bg-[#1B1B1B] text-white shadow-sm'
                  : 'text-[#8C8880] hover:text-[#1B1B1B] hover:bg-[#F7F5F2]'
              }`}
            >
              {v === 'kanban' ? 'Kanban' : 'Founder view'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
