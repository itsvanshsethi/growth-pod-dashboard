'use client';
import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Initiative, ViewMode, ToolPanel } from '@/lib/types';
import { DashboardData } from '@/lib/types';
import { Header } from './Header';
import { StatsBar } from './StatsBar';
import { FilterBar, FilterState } from './FilterBar';
import { KanbanBoard } from './KanbanBoard';
import { FounderView } from './FounderView';
import { SidePanel } from './SidePanel';
import { FullDetailView } from './FullDetailView';
import { Chatbot } from './tools/Chatbot';
import { FeedbackForm } from './tools/FeedbackForm';
import { WeeklyDigest } from './tools/WeeklyDigest';

async function fetchInitiatives(): Promise<DashboardData> {
  const res = await fetch('/api/initiatives', { cache: 'no-store' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function Dashboard() {
  const [view, setView] = useState<ViewMode>('kanban');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolPanel>(null);
  const [feedbackPrefill, setFeedbackPrefill] = useState<string>('');
  const [chatPrefill, setChatPrefill] = useState<string>('');
  const [filters, setFilters] = useState<FilterState>({ sprints: [], statuses: [] });

  const { data, error, isFetching } = useQuery<DashboardData>({
    queryKey: ['initiatives'],
    queryFn: fetchInitiatives,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const initiatives: Initiative[] = useMemo(() => data?.initiatives ?? [], [data]);
  const lastSynced = data?.lastSynced ?? '';
  const apiError = error ? (error as Error).message : data?.error ?? null;

  const allSprints = useMemo(
    () => Array.from(new Set(initiatives.map(i => i.quarter).filter(Boolean))).sort(),
    [initiatives]
  );

  const filteredInitiatives = useMemo(
    () => initiatives.filter(i =>
      (filters.sprints.length === 0 || filters.sprints.includes(i.quarter)) &&
      (filters.statuses.length === 0 || filters.statuses.includes(i.status))
    ),
    [initiatives, filters]
  );

  const selectedIni = initiatives.find(i => i.id === selectedId) ?? null;
  const expandedIni = initiatives.find(i => i.id === expandedId) ?? null;

  function selectCard(id: string) {
    if (selectedId === id) {
      setSelectedId(null);
    } else {
      setSelectedId(id);
      setExpandedId(null);
    }
  }

  function expandIni(id: string) {
    setExpandedId(id);
    setSelectedId(null);
  }

  function closeExpanded() {
    setExpandedId(null);
  }

  function openTool(tool: ToolPanel) {
    setActiveTool(prev => (prev === tool ? null : tool));
  }

  const handleAskFromPanel = useCallback(() => {
    if (selectedIni) setChatPrefill(selectedIni.title + ': ');
    openTool('chat');
    setTimeout(() => {
      document.getElementById('tools-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [selectedIni]);

  const handleFeedbackFromPanel = useCallback(() => {
    if (selectedIni) setFeedbackPrefill(selectedIni.title);
    openTool('feedback');
    setTimeout(() => {
      document.getElementById('tools-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [selectedIni]);

  const handleAskFromExpanded = useCallback(() => {
    if (expandedIni) setChatPrefill(expandedIni.title + ': ');
    setExpandedId(null);
    setTimeout(() => {
      openTool('chat');
      document.getElementById('tools-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, [expandedIni]);

  const handleFeedbackFromExpanded = useCallback(() => {
    if (expandedIni) setFeedbackPrefill(expandedIni.title);
    setExpandedId(null);
    setTimeout(() => {
      openTool('feedback');
      document.getElementById('tools-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, [expandedIni]);

  // Full detail view
  if (expandedId && expandedIni) {
    return (
      <div className="min-h-screen bg-[#F7F5F2] px-6 max-w-5xl mx-auto">
        <FullDetailView
          initiative={expandedIni}
          onBack={closeExpanded}
          onAsk={handleAskFromExpanded}
          onFeedback={handleFeedbackFromExpanded}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <div className="px-6 py-6 max-w-[1600px] mx-auto">
        <Header
          lastSynced={lastSynced}
          isFetching={isFetching}
          view={view}
          onViewChange={v => { setView(v); setSelectedId(null); }}
        />

        <AnimatePresence>
          {apiError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-800 flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {initiatives.length > 0
                ? `Data may be stale — ${apiError}`
                : `Could not load data — ${apiError}`}
            </motion.div>
          )}
        </AnimatePresence>

        {!apiError && initiatives.length === 0 && !isFetching && (
          <div className="mb-4 px-4 py-3 bg-white border border-[#EAE7E2] rounded-xl text-[12px] text-[#8C8880]">
            No initiative data found. Check that your Google Sheet has data in the expected columns and the API key is configured.
          </div>
        )}

        <StatsBar initiatives={initiatives} />

        <FilterBar
          allSprints={allSprints}
          filters={filters}
          onChange={f => { setFilters(f); setSelectedId(null); }}
          totalCount={initiatives.length}
          filteredCount={filteredInitiatives.length}
        />

        <div className="flex gap-3 overflow-hidden">
          <div className="flex-1 overflow-x-auto min-w-0">
            {view === 'kanban' ? (
              <KanbanBoard
                initiatives={filteredInitiatives}
                selectedId={selectedId}
                onSelect={selectCard}
              />
            ) : (
              <FounderView
                initiatives={filteredInitiatives}
                onSelect={id => expandIni(id)}
              />
            )}
          </div>

          <AnimatePresence>
            {selectedIni && view === 'kanban' && (
              <SidePanel
                key={selectedIni.id}
                initiative={selectedIni}
                onClose={() => setSelectedId(null)}
                onExpand={() => expandIni(selectedIni.id)}
                onAsk={handleAskFromPanel}
                onFeedback={handleFeedbackFromPanel}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Tools section */}
        <div className="mt-10 pt-6 border-t border-[#E8E4DF]" id="tools-section">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#A09A93] mb-3">Tools</p>
          <div className="flex gap-2 flex-wrap mb-4">
            {[
              { id: 'chat' as ToolPanel, icon: 'chat', label: 'Ask Archie' },
              { id: 'feedback' as ToolPanel, icon: 'send', label: 'Send feedback to PM' },
              { id: 'digest' as ToolPanel, icon: 'mail', label: 'Preview weekly digest' },
            ].map(tool => (
              <button
                key={tool.id}
                onClick={() => openTool(tool.id)}
                className={`flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-xl border transition-all duration-150 ${
                  activeTool === tool.id
                    ? 'bg-[#1B1B1B] text-white border-[#1B1B1B] shadow-sm'
                    : 'bg-white text-[#5C5C5C] border-[#E8E4DF] hover:bg-[#F7F5F2] hover:border-[#D4D0CA] shadow-sm'
                }`}
              >
                <ToolIcon name={tool.icon} active={activeTool === tool.id} />
                {tool.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTool && (
              <motion.div
                key={activeTool}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {activeTool === 'chat' && (
                  <Chatbot initiatives={initiatives} key={chatPrefill} />
                )}
                {activeTool === 'feedback' && (
                  <FeedbackForm
                    initiatives={initiatives}
                    prefillInitiative={feedbackPrefill}
                    key={feedbackPrefill}
                  />
                )}
                {activeTool === 'digest' && (
                  <WeeklyDigest initiatives={initiatives} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ToolIcon({ name, active }: { name: string; active: boolean }) {
  const stroke = active ? 'white' : 'currentColor';
  if (name === 'chat') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  );
  if (name === 'send') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}
