'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A09A93] mb-2 flex items-center gap-1.5">
        {label}
        {tag === 'sheet' && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#E6F1FB] text-[#0C447C]">Sheet</span>
        )}
        {tag === 'static' && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#F1EFE8] text-[#444441]">PRD</span>
        )}
      </p>
      {children}
    </div>
  );
}

function OverviewTab({ ini }: { ini: Initiative }) {
  return (
    <div className="flex flex-col gap-4">
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
          <ul className="space-y-1.5">
            {ini.metrics.map((m, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#5C5C5C] leading-snug">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-[#A09A93] flex-shrink-0" />
                {m.text}
                {m.kind === 'north_star' && (
                  <span className="text-[9px] font-semibold px-1 py-0.5 rounded-md bg-[#EAF3DE] text-[#27500A] ml-1 whitespace-nowrap">North star</span>
                )}
                {m.kind === 'leading' && (
                  <span className="text-[9px] font-semibold px-1 py-0.5 rounded-md bg-[#E6F1FB] text-[#0C447C] ml-1 whitespace-nowrap">Leading</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {ini.blockers.length > 0 && (
        <Section label="Blockers" tag="sheet">
          <ul className="space-y-1.5">
            {ini.blockers.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#5C5C5C] leading-snug">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-[#E05252] flex-shrink-0" />
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
                <span key={role} className="text-[11px] px-2 py-1 rounded-lg bg-[#F7F5F2] text-[#5C5C5C] border border-[#EAE7E2] font-medium">
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
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A09A93] mb-2 flex items-center gap-1.5">
        Checklist
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#E6F1FB] text-[#0C447C]">Sheet</span>
        <span className="ml-1 font-normal normal-case tracking-normal text-[#B8B4AF]">{done}/{total}</span>
      </p>
      <div className="mb-4">
        <ProgressBar value={total ? Math.round((done / total) * 100) : 0} />
      </div>
      <ul className="space-y-2">
        {ini.checklist.map((item, i) => (
          <li key={i} className={`flex items-center gap-2.5 text-[12px] ${item.done ? 'text-[#A09A93]' : 'text-[#5C5C5C]'}`}>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
              item.done ? 'bg-[#1B1B1B] border-[#1B1B1B]' : 'border-[#D4D0CA] bg-white'
            }`}>
              {item.done && (
                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                  <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className={item.done ? 'line-through' : ''}>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExperimentsTab() {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A09A93] mb-2 flex items-center gap-1.5">
        Experiments <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#F1EFE8] text-[#444441]">PRD</span>
      </p>
      <p className="text-[12px] text-[#A09A93]">Experiment data is sourced from the PRD. View the PRD in the Resources tab.</p>
    </div>
  );
}

function DepsTab({ ini }: { ini: Initiative }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A09A93] mb-2 flex items-center gap-1.5">
        Dependencies <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#E6F1FB] text-[#0C447C]">Sheet</span>
      </p>
      {ini.blockers.length === 0 ? (
        <p className="text-[12px] text-[#A09A93]">No blockers or dependencies.</p>
      ) : (
        <ul className="space-y-2">
          {ini.blockers.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-[#5C5C5C]">
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#FCEBEB] text-[#791F1F] whitespace-nowrap mt-0.5 flex-shrink-0">Blocker</span>
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
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A09A93] mb-2 flex items-center gap-1.5">
          Resources <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#E6F1FB] text-[#0C447C]">Sheet</span>
        </p>
        <div className="text-[12px] text-[#A09A93] text-center py-6 border border-dashed border-[#E8E4DF] rounded-xl">
          No resources yet — add URLs to PRD, Figma and Other Resources columns in the Sheet.
        </div>
      </div>
    );
  }

  const icons = {
    prd: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    figma: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5.5A3.5 3.5 0 018.5 2H12v7H8.5A3.5 3.5 0 015 5.5z"/><path d="M12 2h3.5a3.5 3.5 0 110 7H12V2z"/><path d="M12 12.5a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"/><path d="M5 12.5A3.5 3.5 0 008.5 16H12v-7H8.5A3.5 3.5 0 005 12.5z"/><path d="M5 19.5A3.5 3.5 0 008.5 23H12v-7H8.5A3.5 3.5 0 005 19.5z"/></svg>,
    link: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  };

  const iconBg = { prd: 'bg-[#E6F1FB] text-[#0C447C]', figma: 'bg-[#EEEDFE] text-[#534AB7]', link: 'bg-[#FAEEDA] text-[#633806]' };

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A09A93] mb-2 flex items-center gap-1.5">
        Resources <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#E6F1FB] text-[#0C447C]">Sheet</span>
      </p>
      <div className="space-y-2">
        {ini.resources.map((r, i) => (
          <a
            key={i}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 border border-[#EAE7E2] rounded-xl hover:border-[#D4D0CA] hover:bg-[#F7F5F2] hover:shadow-sm transition-all duration-150 no-underline group"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg[r.type]}`}>
              {icons[r.type]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-[#1B1B1B] truncate">{r.label}</div>
              <div className="text-[11px] text-[#A09A93]">{r.description}</div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B8B4AF" strokeWidth="2" className="group-hover:stroke-[#8C8880] transition-colors">
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
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A09A93] mb-3 flex gap-1.5 items-center flex-wrap">
        Changelog
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#E6F1FB] text-[#0C447C]">Auto</span>
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#F1EFE8] text-[#444441]">Manual</span>
      </p>
      {ini.changelog.length === 0 ? (
        <p className="text-[12px] text-[#A09A93]">No changelog entries yet.</p>
      ) : (
        <ul className="space-y-0">
          {ini.changelog.map((entry, i) => (
            <li key={i} className="flex gap-3 pb-4 relative">
              {i < ini.changelog.length - 1 && (
                <div className="absolute left-[5px] top-4 bottom-0 w-px bg-[#EAE7E2]" />
              )}
              <div className={`w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ring-2 ring-[#F7F5F2] ${
                entry.milestone ? 'bg-[#1B1B1B]' : 'bg-[#D4D0CA]'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] text-[#A09A93] font-medium">{entry.date}</span>
                  <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-md ${
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
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="w-[340px] flex-shrink-0 bg-white rounded-2xl shadow-panel border border-[#EAE7E2] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[#F0EDE9]">
        <div className="flex items-start gap-2 mb-2.5">
          <h3 className="text-[14px] font-semibold text-[#1B1B1B] flex-1 leading-snug">{initiative.title}</h3>
          <div className="flex gap-1 flex-shrink-0 mt-0.5">
            <button
              onClick={onExpand}
              className="p-1.5 rounded-lg text-[#A09A93] hover:bg-[#F7F5F2] hover:text-[#1B1B1B] transition-all"
              title="Expand"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#A09A93] hover:bg-[#F7F5F2] hover:text-[#1B1B1B] transition-all"
              title="Close"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={initiative.status} small />
          <ConfidenceBadge confidence={initiative.confidence} small />
          {initiative.goLiveDate && (
            <span className="text-[11px] text-[#A09A93] border border-[#EAE7E2] rounded-lg px-2 py-0.5 flex items-center gap-1 font-medium">
              <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                <path d="M5 1v2M11 1v2M2 6h12M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {initiative.goLiveDate}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#F0EDE9] overflow-x-auto px-1 pt-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`relative text-[11px] font-medium px-2.5 py-2 whitespace-nowrap transition-all duration-150 ${
              activeTab === t.id
                ? 'text-[#1B1B1B]'
                : 'text-[#A09A93] hover:text-[#5C5C5C]'
            }`}
          >
            {t.label(initiative)}
            {activeTab === t.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B1B1B] rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Body with animated tab transitions */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="p-4"
          >
            {tabContent[activeTab]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#F0EDE9] flex gap-2 bg-[#FAFAF9]">
        <button
          onClick={onAsk}
          className="flex-1 text-[12px] font-medium py-2 px-3 border border-[#E8E4DF] rounded-xl bg-white text-[#5C5C5C] hover:bg-[#F7F5F2] hover:border-[#D4D0CA] transition-all flex items-center justify-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          Ask Archie
        </button>
        <button
          onClick={onFeedback}
          className="flex-1 text-[12px] font-medium py-2 px-3 border border-[#E8E4DF] rounded-xl bg-white text-[#5C5C5C] hover:bg-[#F7F5F2] hover:border-[#D4D0CA] transition-all flex items-center justify-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Send feedback
        </button>
      </div>
    </motion.div>
  );
}
