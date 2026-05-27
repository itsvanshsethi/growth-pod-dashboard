'use client';
import { Initiative } from '@/lib/types';
import { StatusBadge, ConfidenceBadge } from '../shared/Badge';
import { formatWeekOf } from '@/lib/utils';

interface WeeklyDigestProps {
  initiatives: Initiative[];
}

export function WeeklyDigest({ initiatives }: WeeklyDigestProps) {
  const needsAttention = initiatives.filter(
    i => i.confidence === 'at risk' || i.confidence === 'off track' || i.blockers.length > 0
  );

  const upcoming = initiatives.filter(
    i => i.status !== 'live' && i.status !== 'paused'
  );

  return (
    <div className="border border-[#EAE7E2] rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-[#F7F5F2] border-b border-[#EAE7E2]">
        <div className="text-[11px] text-[#8E8E8E] mb-0.5">Growth Pod · Week of {formatWeekOf()}</div>
        <div className="text-[14px] font-medium text-[#1B1B1B]">Weekly initiative digest</div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-5">
        {/* Status snapshot */}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[#8E8E8E] mb-2">Status snapshot</div>
          {initiatives.length === 0 ? (
            <p className="text-[13px] text-[#8E8E8E]">No initiatives loaded.</p>
          ) : (
            <div className="space-y-0">
              {initiatives.map(i => (
                <div key={i.id} className="flex items-center justify-between text-[12px] text-[#5C5C5C] py-1.5 border-b border-[#EAE7E2] last:border-b-0">
                  <span className="font-medium text-[#1B1B1B]">{i.title}</span>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={i.status} small />
                    <ConfidenceBadge confidence={i.confidence} small />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Needs attention */}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[#8E8E8E] mb-2">Needs attention</div>
          {needsAttention.length === 0 ? (
            <p className="text-[13px] text-[#8E8E8E]">No blockers this week.</p>
          ) : (
            <div className="space-y-0">
              {needsAttention.map(i => (
                <div key={i.id} className="flex items-center justify-between text-[12px] py-1.5 border-b border-[#EAE7E2] last:border-b-0">
                  <span className="font-medium text-[#1B1B1B]">{i.title}</span>
                  <span className="text-[#5C5C5C] max-w-[200px] text-right">
                    {i.blockers[0] || (i.confidence === 'at risk' ? 'At risk' : 'Off track')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming go-lives */}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[#8E8E8E] mb-2">Upcoming go-lives</div>
          {upcoming.length === 0 ? (
            <p className="text-[13px] text-[#8E8E8E]">No upcoming go-lives.</p>
          ) : (
            <div className="space-y-0">
              {upcoming.map(i => (
                <div key={i.id} className="flex items-center justify-between text-[12px] py-1.5 border-b border-[#EAE7E2] last:border-b-0">
                  <span className="font-medium text-[#1B1B1B]">{i.title}</span>
                  <span className="text-[#5C5C5C]">{i.goLiveDate || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-[#EAE7E2] bg-[#F7F5F2]">
        <div className="text-[11px] text-[#8E8E8E]">Auto-generated · synced from Google Sheet</div>
      </div>

      <div className="px-4 py-3 flex items-center gap-2 border-t border-[#EAE7E2] text-[11px] text-[#5C5C5C]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Auto-send to stakeholders — connect Gmail MCP to activate
      </div>
    </div>
  );
}
