import { Initiative } from './types';

export function buildArchieSystemPrompt(initiatives: Initiative[], docContext?: string): string {
  const ctx = JSON.stringify(
    initiatives.map(i => ({
      title: i.title,
      status: i.status,
      confidence: i.confidence,
      quarter: i.quarter,
      goLiveDate: i.goLiveDate,
      description: i.description,
      northStar: i.northStar,
      owners: i.owners,
      blockers: i.blockers,
      progress: i.progress,
      checklist: i.checklist,
      changelog: i.changelog,
      notes: i.notes,
      prdUrl: i.prdUrl,
    })),
    null,
    2
  );

  return `You are Archie, the Growth Pod's AI assistant at Razorpay. You know everything about what the Growth Pod is building.

You have live data from the Google Sheet tracking all product initiatives. Answer questions clearly and concisely. Reference specific initiative names and data points when relevant.

Current Growth Pod initiative data:
${ctx}${docContext ? `\n\n--- Additional PRD context ---\n${docContext}\n--- End PRD context ---` : ''}

Guidelines:
- Be direct and helpful
- Reference specific initiative names, owners, and dates when answering
- For blocker questions, reference the blockers and changelog fields
- For status questions, use the status and confidence fields
- If you don't have data to answer something, say so clearly — never hallucinate
- Format lists with dashes when listing multiple items
- Keep responses concise — aim for 3-5 sentences unless a detailed breakdown is needed`;
}

export function generateSuggestedQuestions(initiatives: Initiative[]): string[] {
  const suggestions: string[] = [];

  // Blocked initiatives
  const blocked = initiatives.find(i => i.blockers.length > 0 && i.status !== 'live' && i.status !== 'paused');
  if (blocked) suggestions.push(`What's blocking ${blocked.title}?`);

  // At risk / off track
  const atRisk = initiatives.find(i => i.confidence === 'at risk' || i.confidence === 'off track');
  if (atRisk) suggestions.push(`Why is ${atRisk.title} at risk?`);

  // Upcoming go-live (in progress or planned with a go-live date)
  const upcoming = initiatives.find(
    i => (i.status === 'in progress' || i.status === 'planned') && i.goLiveDate
  );
  if (upcoming) suggestions.push(`What's the go-live plan for ${upcoming.title}?`);

  // Initiative with PRD (may have experiments)
  const withPrd = initiatives.find(
    i => i.prdUrl && i.status === 'in progress'
  );
  if (withPrd && suggestions.length < 3) {
    suggestions.push(`What experiments are running on ${withPrd.title}?`);
  }

  // Always include a general question
  suggestions.push("What went live this sprint?");

  // Dedupe and cap at 4
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const s of suggestions) {
    if (!seen.has(s)) { seen.add(s); deduped.push(s); }
  }
  return deduped.slice(0, 4);
}
