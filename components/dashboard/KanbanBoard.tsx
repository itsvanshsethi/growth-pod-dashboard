'use client';
import { Initiative } from '@/lib/types';
import { KanbanCard } from './KanbanCard';
import { STATUS_COLUMNS } from '@/lib/constants';

interface KanbanBoardProps {
  initiatives: Initiative[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function KanbanBoard({ initiatives, selectedId, onSelect }: KanbanBoardProps) {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 min-h-[200px]">
      {STATUS_COLUMNS.map(col => {
        const cards = initiatives.filter(i => i.status === col.id);
        return (
          <div key={col.id} className="w-[195px] flex-shrink-0 flex flex-col gap-2">
            <div
              className="flex items-center justify-between px-2.5 py-2 rounded-md mb-0.5"
              style={{ background: col.bg, color: col.tc }}
            >
              <span className="text-[12px] font-medium">{col.label}</span>
              <span className="text-[11px] opacity-70">{cards.length}</span>
            </div>
            {cards.length === 0 ? (
              <div className="text-[12px] text-[#8E8E8E] text-center py-4 px-2 border border-dashed border-[#EAE7E2] rounded-md">
                No initiatives
              </div>
            ) : (
              cards.map(ini => (
                <KanbanCard
                  key={ini.id}
                  initiative={ini}
                  selected={selectedId === ini.id}
                  onClick={() => onSelect(ini.id)}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
