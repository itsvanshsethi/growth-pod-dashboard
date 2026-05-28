'use client';
import { useState } from 'react';
import { Initiative, SidePanelTab } from '@/lib/types';
import { StatusBadge, ConfidenceBadge } from './shared/Badge';
import { ProgressBar } from './shared/ProgressBar';

interface SidePanelProps {
  initiative: Initiative;
  onClose: () => void;
  onExpand: () => void;
  onAsk: () => void;
  onFeedback: () => void;
}

const TABS: { id: SidePanelTab; label: (ini: Initiative) => string }[] = [
  { id: 'overview', label: () => 'Overview' },
  { id: 'checklist', label: i => `Checklist ${i.checklist.filter(c => c.done).length}/${i.checklist.length}` },
  { id: 'experiments', label: () => 'Experiments' },
  { id: 'deps', label: () => 'Dependencies' },
  { id: 'resources', label: () => 'Resources' },
  { id: 'changelog', label: () => 'Changelog' },
];

function Section({ label, tag, children }: { label: string; tag?: 'sheet' | 'static'; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[#8E8E8E] mb-1.5 flex items-center gap-1">
        {label}
        {tag === 'sheet' && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#E6F1FB] text-[#0C447C]">Sheet</span>
        )}
        {tag === 'static' && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#F1EFE8] text-[#444441]">PRD</span>
        )}
      </p>
      {children}
    </div>
  );
}

function OverviewTab({ ini }: { ini: Initiative }) {
  return (
    <div className="flex flex-col gap-3">
      {ini.description && (
        <Section label="Description">
          <p className="text-[12px] text-[#5C5C5C] leading-relaxed">{ini.description}</p>
        </Section>
      )}
      {ini.northStar && (
        <Section label="North star metric" tag="sheet">
          <p className="text-[12px] text-[#5C5C5C] leading-relaxed">{ini.northStar}</p>
        </Section>
      )}
      {ini.metrics.length > 0 && (
        <Section label="Success metrics" tag="sheet">
          <ul className="space-y-1">
            {ini.metrics.map((m, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#5C5C5C] leading-snug">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-[#8E8E8E] flex-shrink-0" />
                {m.text}
                {m.kind === 'north_star' && (
                  <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-[#EAF3DE] text-[#27500A] ml-1 whitespace-nowrap">North star</span>
                )}
                {m.kind === 'leading' && (
                  <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-[#E6F1FB] text-[#0C447C] ml-1 whitespace-nowrap">Leading</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {ini.blockers.length > 0 && (
        <Section label="Blockers" tag="sheet">
          <ul className="space-y-1">
            {ini.blockers.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#5C5C5C] leading-snug">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-[#C0392B] flex-shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {ini.notes && (
        <Section label="Notes" tag="sheet">
          <p className="text-[12px] text-[#5C5C5C] leading-relaxed">{ini.notes}</p>
        </Section>
      )}
      {ini.progress > 0 && (
        <ProgressBar value={ini.progress} showLabel label="Progress" />
      )}
      {ini.owners && Object.keys(ini.owners).length > 0 && (
        <Section label="Owners" tag="sheet">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ini.owners).map(([role, name]) =>
              name ? (
                <span key={role} className="text-[11px] px-2 py-1 rounded-md bg-[#F7F5F2] text-[#5C5C5C] border border-[#EAE7E2]">
                  {role.toUpperCase()}: {name}
                </span>
              ) : null
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function ChecklistTab({ ini }: { ini: Initiative }) {
  const done = ini.checklist.filter(c => c.done).length;
  const total = ini.checklist.length;
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[#8E8E8E] mb-2 flex items-center gap-1">
        Checklist <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#E6F1FB] text-[#0C447C]">Sheet</span>
        &nbsp;— {done}/{total}
      </p>
      <div className="mb-3">
        <ProgressBar value={total ? Math.round((done / total) * 100) : 0} />
      </div>
      <ul className="space-y-1.5">
        {ini.checklist.map((item, i) => (
          <li key={i} className={`flex items-center gap-2 text-[12px] ${item.done ? 'text-[#8E8E8E] line-through' : 'text-[#5C5C5C]'}`}>
            <div className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center ${
              item.done ? 'bg-[#1B1B1B] border-[#1B1B1B]' : 'border-[#D4D0CA]'
            }`}>
              {item.done && (
                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                  <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExperimentsTab() {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[#8E8E8E] mb-2 flex items-center gap-1">
        Experiments <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#F1EFE8] text-[#444441]">PRD</span>
      </p>
      <p className="text-[12px] text-[#8E8E8E]">Experiment data is sourced from the PRD. View the PRD in the Resources tab.</p>
    </div>
  );
}

function DepsTab({ ini }: { ini: Initiative }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[#8E8E8E] mb-2 flex items-center gap-1">
        Dependencies <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#E6F1FB] text-[#0C447C]">Sheet</span>
      </p>
      {ini.blockers.length === 0 ? (
        <p className="text-[12px] text-[#8E8E8E]">No blockers or dependencies.</p>
      ) : (
        <ul className="space-y-2">
          {ini.blockers.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-[#5C5C5C]">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#FCEBEB] text-[#791F1F] whitespace-nowrap mt-0.5">Blocker</span>
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResourcesTab({ ini }: { ini: Initiative }) {
  if (!ini.resources.length) {
    return (
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#8E8E8E] mb-2 flex items-center gap-1">
          Resources <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#E6F1FB] text-[#0C447C]">Sheet</span>
        </p>
        <div className="text-[12px] text-[#8E8E8E] text-center py-5 border border-dashed border-[#EAE7E2] rounded-md">
          No resources yet — add URLs to PRD, Figma and Other Resources columns in the Sheet.
        </div>
      </div>
    );
  }

  const icons = {
    prd: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    figma: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M5 5.5A3.5 3.5 0 018.5 2H12v7H8.5A3.5 3.5 0 015 5.5z"/><path d="M12 2h3.5a3.5 3.5 0 110 7H12V2z"/><path d="M12 12.5a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"/><path d="M5 12.5A3.5 3.5 0 008.5 16H12v-7H8.5A3.5 3.5 0 005 12.5z"/><path d="M5 19.5A3.5 3.5 0 008.5 23H12v-7H8.5A3.5 3.5 0 005 19.5z"/>
      </svg>
    ),
    link: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
      </svg>
    ),
  };

  const iconBg = { prd: 'bg-[#E6F1FB] text-[#0C447C]', figma: 'bg-[#EEEDFE] text-[#534AB7]', link: 'bg-[#FAEEDA] text-[#633806]' };

  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[#8E8E8E] mb-2 flex items-center gap-1">
        Resources <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#E6F1FB] text-[#0C447C]">Sheet</span>
      </p>
      <div className="space-y-2">
        {ini.resources.map((r, i) => (
          <a
            key={i}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2.5 border border-[#EAE7E2] rounded-md hover:border-[#D4D0CA] hover:bg-[#F7F5F2] transition-all no-underline"
          >
            <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${iconBg[r.type]}`}>
              {icons[r.type]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-[#1B1B1B] truncate">{r.label}</div>
              <div className="text-[11px] text-[#8E8E8E]">{r.description}</div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8E8E8E" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}

function ChangelogTab({ ini }: { ini: Initiative }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[#8E8E8E] mb-2 flex gap-1 items-center flex-wrap">
        Changelog
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#E6F1FB] text-[#0C447C]">Auto</span>
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#F1EFE8] text-[#444441]">Manual</span>
      </p>
      {ini.changelog.length === 0 ? (
        <p className="text-[12px] text-[#8E8E8E]">No changelog entries yet.</p>
      ) : (
        <ul className="space-y-0">
          {ini.changelog.map((entry, i) => (
            <li key={i} className="flex gap-2.5 pb-3 relative">
              {i < ini.changelog.length - 1 && (
                <div className="absolute left-1 top-4 bottom-0 w-px bg-[#EAE7E2]" />
              )}
              <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${entry.milestone ? 'bg-[#1B1B1B]' : 'border border-[#D4D0CA] bg-white'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] text-[#8E8E8E]">{entry.date}</span>
                  <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${
                    entry.source === 'auto' ? 'bg-[#E6F1FB] text-[#0C447C]' : 'bg-[#F1EFE8] text-[#444441]'
                  }`}>
                    {entry.source === 'auto' ? 'Auto' : 'Manual'}
                  </span>
                </div>
                <p className="text-[12px] text-[#5C5C5C] leading-snug">{entry.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SidePanel({ initiative, onClose, onExpand, onAsk, onFeedback }: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<SidePanelTab>('overview');

  const tabContent: Record<SidePanelTab, React.ReactNode> = {
    overview: <OverviewTab ini={initiative} />,
    checklist: <ChecklistTab ini={initiative} />,
    experiments: <ExperimentsTab />,
    deps: <DepsTab ini={initiative} />,
    resources: <ResourcesTab ini={initiative} />,
    changelog: <ChangelogTab ini={initiative} />,
  };

  return (
    <div className="w-[340px] flex-shrink-0 border border-[#EAE7E2] rounded-xl overflow-hidden flex flex-col bg-white">
      {/* Header */}
      <div className="px-3.5 py-3 border-b border-[#EAE7E2]">
        <div className="flex items-start gap-2 mb-2">
          <h3 className="text-[14px] font-medium text-[#1B1B1B] flex-1 leading-snug">{initiative.title}</h3>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={onExpand}
              className="p-1.5 border border-[#D4D0CA] rounded-md text-[#5C5C5C] hover:bg-[#F7F5F2] transition-colors"
              title="Expand"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 border border-[#D4D0CA] rounded-md text-[#5C5C5C] hover:bg-[#F7F5F2] transition-colors"
              title="Close"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={initiative.status} small />
          <ConfidenceBadge confidence={initiative.confidence} small />
          {initiative.goLiveDate && (
            <span className="text-[11px] text-[#8E8E8E] border border-[#EAE7E2] rounded px-1.5 py-0.5 flex items-center gap-1">
              <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                <path d="M5 1v2M11 1v2M2 6h12M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {initiative.goLiveDate}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#EAE7E2] overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`text-[11px] px-2.5 py-2 whitespace-nowrap transition-all border-b-2 -mb-px ${
              activeTab === t.id
                ? 'text-[#1B1B1B] border-[#1B1B1B] font-medium'
                : 'text-[#5C5C5C] border-transparent hover:text-[#1B1B1B]'
            }`}
          >
            {t.label(initiative)}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3.5">
        {tabContent[activeTab]}
      </div>

      {/* Footer */}
      <div className="px-3.5 py-2.5 border-t border-[#EAE7E2] flex gap-2">
        <button
          onClick={onAsk}
          className="flex-1 text-[12px] py-1.5 px-2 border border-[#D4D0CA] rounded-md bg-white text-[#5C5C5C] hover:bg-[#F7F5F2] transition-colors flex items-center justify-center gap-1"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          Ask Archie
        </button>
        <button
          onClick={onFeedback}
          className="flex-1 text-[12px] py-1.5 px-2 border border-[#D4D0CA] rounded-md bg-white text-[#5C5C5C] hover:bg-[#F7F5F2] transition-colors flex items-center justify-center gap-1"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Send feedback
        </button>
      </div>
    </div>
  );
}
