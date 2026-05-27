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
    <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
      <div>
        <p className="text-[11px] font-medium tracking-widest uppercase text-[#8E8E8E] mb-1">
          Razorpay · Growth Pod
        </p>
        <h1 className="text-[22px] font-medium text-[#1B1B1B]">What we&apos;re building</h1>
        <p className="text-[13px] text-[#5C5C5C] mt-1">
          Product initiatives — planned, in progress, and live
        </p>
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-[#8E8E8E] bg-[#F7F5F2] border border-[#EAE7E2] rounded-full px-3 py-1">
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              isFetching ? 'bg-amber-500 animate-pulse' : 'bg-[#3B6D11]'
            }`}
          />
          {syncLabel}
        </div>
        <div className="flex border border-[#D4D0CA] rounded-md overflow-hidden">
          {(['kanban', 'founder'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`text-[12px] px-3 py-1.5 transition-all ${
                view === v
                  ? 'bg-[#1B1B1B] text-white'
                  : 'bg-white text-[#5C5C5C] hover:bg-[#F7F5F2]'
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
