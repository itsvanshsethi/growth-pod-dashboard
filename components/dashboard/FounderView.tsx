'use client';
import { Initiative } from '@/lib/types';
import { StatusBadge, ConfidenceBadge } from './shared/Badge';

interface FounderViewProps {
  initiatives: Initiative[];
  onSelect: (id: string) => void;
}

export function FounderView({ initiatives, onSelect }: FounderViewProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {['Initiative', 'Status', 'Confidence', 'Go-live', 'North star metric'].map(h => (
              <th
                key={h}
                className="text-left text-[11px] font-medium uppercase tracking-wider text-[#8E8E8E] px-3 py-2 border-b border-[#EAE7E2]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {initiatives.map(i => (
            <tr
              key={i.id}
              onClick={() => onSelect(i.id)}
              className="cursor-pointer hover:bg-[#F7F5F2] transition-colors"
              style={i.spotlight ? { borderLeft: '3px solid #1D9E75' } : {}}
            >
              <td className="px-3 py-2.5 border-b border-[#EAE7E2] text-[13px] font-medium text-[#1B1B1B]">
                {i.title}
              </td>
              <td className="px-3 py-2.5 border-b border-[#EAE7E2]">
                <StatusBadge status={i.status} small />
              </td>
              <td className="px-3 py-2.5 border-b border-[#EAE7E2]">
                <ConfidenceBadge confidence={i.confidence} small />
              </td>
              <td className="px-3 py-2.5 border-b border-[#EAE7E2] text-[12px] text-[#8E8E8E]">
                {i.goLiveDate || '—'}
              </td>
              <td className="px-3 py-2.5 border-b border-[#EAE7E2] text-[12px] text-[#5C5C5C] max-w-[280px]">
                {i.northStar || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
