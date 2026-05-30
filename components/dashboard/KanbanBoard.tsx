'use client';
import { motion } from 'framer-motion';
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
    <div className="flex gap-3 overflow-x-auto pb-2 min-h-[200px]">
      {STATUS_COLUMNS.map((col, colIdx) => {
        const cards = initiatives.filter(i => i.status === col.id);
        return (
          <motion.div
            key={col.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: colIdx * 0.06, duration: 0.3, ease: 'easeOut' }}
            className="w-[210px] flex-shrink-0 flex flex-col gap-2"
          >
            {/* Column header */}
            <div
              className="flex items-center justify-between px-3 py-2 rounded-xl mb-0.5"
              style={{ background: col.bg }}
            >
              <span className="text-[12px] font-semibold" style={{ color: col.tc }}>{col.label}</span>
              <span
                className="text-[11px] font-semibold w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: col.tc + '22', color: col.tc }}
              >
                {cards.length}
              </span>
            </div>

            {/* Cards */}
            {cards.length === 0 ? (
              <div className="text-[12px] text-[#B8B4AF] text-center py-6 px-2 border border-dashed border-[#E8E4DF] rounded-xl bg-white/50">
                No initiatives
              </div>
            ) : (
              cards.map((ini, cardIdx) => (
                <motion.div
                  key={ini.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: colIdx * 0.06 + cardIdx * 0.04, duration: 0.25, ease: 'easeOut' }}
                >
                  <KanbanCard
                    initiative={ini}
                    selected={selectedId === ini.id}
                    onClick={() => onSelect(ini.id)}
                  />
                </motion.div>
              ))
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
