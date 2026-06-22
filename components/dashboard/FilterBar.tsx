'use client';
import { motion } from 'framer-motion';
import { Status } from '@/lib/types';
import { STATUS_COLUMNS } from '@/lib/constants';

export interface FilterState {
  sprints: string[];   // empty = all
  statuses: Status[];  // empty = all
}

interface FilterBarProps {
  allSprints: string[];
  filters: FilterState;
  onChange: (f: FilterState) => void;
  totalCount: number;
  filteredCount: number;
}

export function FilterBar({ allSprints, filters, onChange, totalCount, filteredCount }: FilterBarProps) {
  const isFiltered = filters.sprints.length > 0 || filters.statuses.length > 0;

  function toggleSprint(sprint: string) {
    const next = filters.sprints.includes(sprint)
      ? filters.sprints.filter(s => s !== sprint)
      : [...filters.sprints, sprint];
    onChange({ ...filters, sprints: next });
  }

  function toggleStatus(status: Status) {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onChange({ ...filters, statuses: next });
  }

  function clearAll() {
    onChange({ sprints: [], statuses: [] });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-5 py-3 px-4 bg-white rounded-xl border border-[#F0EDE9] shadow-card">
      {/* Sprint filter */}
      {allSprints.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A09A93] whitespace-nowrap">
            Sprint
          </span>
          <div className="flex flex-wrap gap-1.5">
            {allSprints.map(sprint => {
              const active = filters.sprints.includes(sprint);
              return (
                <motion.button
                  key={sprint}
                  onClick={() => toggleSprint(sprint)}
                  whileTap={{ scale: 0.95 }}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all duration-150 ${
                    active
                      ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]'
                      : 'bg-white text-[#5C5C5C] border-[#E8E4DF] hover:border-[#C8C4BF] hover:bg-[#F7F5F2]'
                  }`}
                >
                  {sprint}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Divider */}
      {allSprints.length > 0 && (
        <div className="w-px h-5 bg-[#E8E4DF] self-center" />
      )}

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A09A93] whitespace-nowrap">
          Status
        </span>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_COLUMNS.map(col => {
            const active = filters.statuses.includes(col.id as Status);
            return (
              <motion.button
                key={col.id}
                onClick={() => toggleStatus(col.id as Status)}
                whileTap={{ scale: 0.95 }}
                className="text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all duration-150"
                style={active
                  ? { background: col.tc, color: '#fff', borderColor: col.tc }
                  : { background: col.bg, color: col.tc, borderColor: 'transparent' }
                }
              >
                {col.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Result count + clear */}
      <div className="ml-auto flex items-center gap-3">
        {isFiltered && (
          <>
            <span className="text-[11px] text-[#A09A93]">
              {filteredCount} of {totalCount}
            </span>
            <button
              onClick={clearAll}
              className="text-[11px] font-medium text-[#5C5C5C] hover:text-[#1B1B1B] flex items-center gap-1 transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}
