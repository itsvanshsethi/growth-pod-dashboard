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

  const total = initiatives.length;

  return (
    <div className="grid grid-cols-5 gap-2.5 mb-6">
      {STATUS_COLUMNS.map((col, idx) => {
        const count = counts[col.id] || 0;
        const pct = total ? Math.round((count / total) * 100) : 0;
        return (
          <div
            key={col.id}
            className="bg-white rounded-xl px-4 py-3.5 shadow-card border border-[#F0EDE9] group hover:shadow-card-hover transition-all duration-200"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: col.tc }}
              />
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[#A09A93]">
                {col.label}
              </span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-[26px] font-semibold text-[#1B1B1B] leading-none tabular-nums">
                {count}
              </span>
              {total > 0 && (
                <span className="text-[11px] text-[#B8B4AF] font-medium mb-0.5">
                  {pct}%
                </span>
              )}
            </div>
            {/* Mini progress strip */}
            <div className="mt-2.5 h-0.5 bg-[#F0EDE9] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: col.tc, opacity: 0.6 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
