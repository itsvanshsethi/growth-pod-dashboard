'use client';
import { useState } from 'react';
import { Initiative } from '@/lib/types';

type FeedbackType = 'discrepancy' | 'question' | 'suggestion';

interface FeedbackFormProps {
  initiatives: Initiative[];
  prefillInitiative?: string;
}

export function FeedbackForm({ initiatives, prefillInitiative }: FeedbackFormProps) {
  const [type, setType] = useState<FeedbackType>('discrepancy');
  const [initiative, setInitiative] = useState(prefillInitiative || '');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedInfo, setSubmittedInfo] = useState('');

  function submit() {
    if (!message.trim()) return;
    const info = `Your ${type}${initiative ? ' about ' + initiative : ''} has been queued for delivery to the PM${name ? ' (from ' + name + ')' : ''}.`;
    setSubmittedInfo(info);
    setSubmitted(true);
  }

  function reset() {
    setSubmitted(false);
    setMessage('');
    setName('');
    setInitiative(prefillInitiative || '');
  }

  if (submitted) {
    return (
      <div className="border border-[#EAE7E2] rounded-xl p-8 text-center">
        <div className="text-3xl mb-3">✓</div>
        <div className="text-[15px] font-medium text-[#1B1B1B] mb-1">Feedback sent</div>
        <div className="text-[13px] text-[#5C5C5C] mb-4">{submittedInfo}</div>
        <button
          onClick={reset}
          className="text-[12px] px-3 py-1.5 border border-[#D4D0CA] rounded-md text-[#5C5C5C] hover:bg-[#F7F5F2] transition-colors"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="border border-[#EAE7E2] rounded-xl p-5">
      <div className="space-y-3">
        <div>
          <label className="block text-[12px] text-[#5C5C5C] mb-1">Type</label>
          <div className="flex gap-1.5">
            {([
              { id: 'discrepancy', label: 'Data discrepancy' },
              { id: 'question', label: 'Question for PM' },
              { id: 'suggestion', label: 'Suggestion' },
            ] as { id: FeedbackType; label: string }[]).map(t => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`flex-1 text-[12px] py-1.5 px-2 border rounded-md transition-all ${
                  type === t.id
                    ? 'border-[#1B1B1B] text-[#1B1B1B] bg-[#F7F5F2]'
                    : 'border-[#D4D0CA] text-[#5C5C5C] hover:bg-[#F7F5F2]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[12px] text-[#5C5C5C] mb-1">Initiative</label>
          <select
            value={initiative}
            onChange={e => setInitiative(e.target.value)}
            className="w-full text-[13px] px-2.5 py-1.5 border border-[#D4D0CA] rounded-md bg-white text-[#1B1B1B] focus:outline-none focus:border-[#8E8E8E]"
          >
            <option value="">All / General</option>
            {initiatives.map(i => (
              <option key={i.id} value={i.title}>{i.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[12px] text-[#5C5C5C] mb-1">Your name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Riya"
            className="w-full text-[13px] px-2.5 py-1.5 border border-[#D4D0CA] rounded-md bg-white text-[#1B1B1B] placeholder-[#8E8E8E] focus:outline-none focus:border-[#8E8E8E]"
          />
        </div>

        <div>
          <label className="block text-[12px] text-[#5C5C5C] mb-1">Message</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Describe the discrepancy, question, or suggestion…"
            rows={3}
            className="w-full text-[13px] px-2.5 py-1.5 border border-[#D4D0CA] rounded-md bg-white text-[#1B1B1B] placeholder-[#8E8E8E] focus:outline-none focus:border-[#8E8E8E] resize-y"
          />
        </div>

        <button
          onClick={submit}
          disabled={!message.trim()}
          className="text-[13px] font-medium px-5 py-2 rounded-md bg-[#1B1B1B] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#333] transition-colors"
        >
          Send to PM
        </button>

        <div className="flex items-center gap-1.5 text-[11px] text-[#8E8E8E] mt-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Delivers to PM inbox via Gmail — connect Gmail MCP to activate
        </div>
      </div>
    </div>
  );
}
