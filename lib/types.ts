export type Status = 'scoping' | 'planned' | 'in progress' | 'live' | 'paused';
export type Confidence = 'on track' | 'at risk' | 'off track';
export type MetricKind = 'leading' | 'north_star' | 'lagging';
export type ExperimentStatus = 'running' | 'winner' | 'planned';
export type DependencyType = 'blocker' | 'dependency' | 'resolved';
export type ResourceType = 'prd' | 'figma' | 'link';
export type ChangelogSource = 'auto' | 'manual';

export interface Metric {
  text: string;
  kind: MetricKind;
}

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface Experiment {
  name: string;
  hypothesis: string;
  status: ExperimentStatus;
}

export interface Dependency {
  type: DependencyType;
  text: string;
}

export interface ChangelogEntry {
  date: string;
  text: string;
  milestone: boolean;
  source: ChangelogSource;
}

export interface Resource {
  type: ResourceType;
  label: string;
  description: string;
  url: string;
}

export interface Initiative {
  id: string;
  title: string;
  status: Status;
  quarter: string;
  goLiveDate: string;
  confidence: Confidence;
  progress: number;
  spotlight: boolean;
  owners: {
    design?: string;
    be?: string;
    fe?: string;
    qa?: string;
  };
  description: string;
  northStar: string;
  successMetrics: string;
  notes: string;
  metrics: Metric[];
  checklist: ChecklistItem[];
  blockers: string[];
  changelog: ChangelogEntry[];
  resources: Resource[];
  prdUrl?: string;
  figmaUrl?: string;
}

export interface DashboardData {
  initiatives: Initiative[];
  lastSynced: string;
  error?: string;
}

export type ViewMode = 'kanban' | 'founder';
export type ToolPanel = 'chat' | 'feedback' | 'digest' | null;

export type SidePanelTab =
  | 'overview'
  | 'checklist'
  | 'experiments'
  | 'deps'
  | 'resources'
  | 'changelog';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
