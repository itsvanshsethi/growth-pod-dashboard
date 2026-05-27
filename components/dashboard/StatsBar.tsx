'use client';
import { Initiative } from '@/lib/types';
import { STATUS_COLUMNS } from '@/lib/constants';

interface StatsBarProps {
  initiatives: Initiative[];
}

export function StatsBar({ initiatives }: StatsBarProps) {
  const counts: Record<string, number> = {};
  initiatives.forEach(i => {
    counts[i.status] = (counts[i.status] || 0) + 1;
  });

  return (
    <div className="grid grid-cols-5 gap-2 mb-5">
      {STATUS_COLUMNS.map(col => (
        <div key={col.id} className="bg-[#F7F5F2] rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-[#5C5C5C] uppercase tracking-wider mb-1">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: col.tc }}
            />
            {col.label}
          </div>
          <div className="text-[20px] font-medium text-[#1B1B1B]">{counts[col.id] || 0}</div>
        </div>
      ))}
    </div>
  );
}
