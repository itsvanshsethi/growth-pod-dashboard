'use client';
import { useState, useRef, useEffect } from 'react';
import { Initiative, ChatMessage } from '@/lib/types';

interface ChatbotProps {
  initiatives: Initiative[];
}

const SUGGESTED = [
  "Which initiatives are at risk?",
  "What's blocking any in-progress initiatives?",
  "What went live recently?",
  "What are the upcoming go-lives?",
];

export function Chatbot({ initiatives }: ChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSugg, setShowSugg] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function send(text: string) {
    if (!text.trim() || isLoading) return;
    setShowSugg(false);
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, initiatives }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setMessages(prev => [...prev, { role: 'assistant', content: err.error || 'Something went wrong. Please try again.' }]);
        return;
      }

      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let assistantText = '';
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  assistantText += parsed.text;
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', content: assistantText };
                    return updated;
                  });
                }
              } catch { /* skip malformed lines */ }
            }
          }
        }
      } else {
        const json = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: json.text || 'No response.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  const now = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="border border-[#EAE7E2] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#EAE7E2]">
        <div>
          <div className="text-[13px] font-medium text-[#1B1B1B]">Ask the dashboard</div>
          <div className="text-[11px] text-[#8E8E8E]">Powered by Claude · live data from Google Sheet</div>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EAF3DE] text-[#27500A]">Live</span>
      </div>

      <div className="h-60 overflow-y-auto p-3 flex flex-col gap-2" id="chat-msgs-wrap">
        <div className="flex flex-col gap-0.5 max-w-[85%]">
          <div className="text-[13px] leading-relaxed px-3 py-2 rounded-lg bg-[#F7F5F2] text-[#1B1B1B]">
            Hi! I have live data from your Growth Pod initiatives. Ask me anything about status, blockers, or go-live timelines.
          </div>
        </div>

        {showSugg && (
          <div className="flex flex-col gap-1 mb-1">
            {SUGGESTED.map((q, i) => (
              <button
                key={i}
                onClick={() => send(q)}
                className="text-[12px] text-left text-[#5C5C5C] border border-[#EAE7E2] rounded-lg px-2.5 py-1.5 hover:bg-[#F7F5F2] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-0.5 max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start'}`}>
            <div
              className={`text-[13px] leading-relaxed px-3 py-2 rounded-lg whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#1B1B1B] text-white'
                  : 'bg-[#F7F5F2] text-[#1B1B1B]'
              }`}
            >
              {msg.content}
            </div>
            <span className="text-[10px] text-[#8E8E8E]">{now()}</span>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-1.5 px-3 py-2 bg-[#F7F5F2] rounded-lg w-fit">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#8E8E8E]"
                style={{ animation: `blink 1.2s ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2 px-3 py-2.5 border-t border-[#EAE7E2]">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          placeholder="Ask anything about Growth Pod…"
          className="flex-1 text-[13px] px-2.5 py-1.5 border border-[#D4D0CA] rounded-md bg-white text-[#1B1B1B] placeholder-[#8E8E8E] focus:outline-none focus:border-[#8E8E8E]"
          disabled={isLoading}
        />
        <button
          onClick={() => send(input)}
          disabled={isLoading || !input.trim()}
          className="text-[12px] px-3 py-1.5 rounded-md bg-[#1B1B1B] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#333] transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
