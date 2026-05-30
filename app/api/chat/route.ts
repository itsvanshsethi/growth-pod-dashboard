import { NextRequest, NextResponse } from 'next/server';
import { buildArchieSystemPrompt } from '@/lib/archieContext';
import { fetchGoogleDocText } from '@/lib/googleAuth';
import { streamAI } from '@/lib/aiClient';

export async function POST(req: NextRequest) {
  const hasAI = process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY;
  if (!hasAI) {
    return NextResponse.json({ error: 'No AI credentials configured' }, { status: 503 });
  }

  let body: {
    messages: { role: 'user' | 'assistant'; content: string }[];
    initiatives: Record<string, unknown>[];
    focusInitiativeId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { messages, initiatives, focusInitiativeId } = body;
  if (!messages?.length) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
  }

  // Fetch linked PRD — use focusInitiativeId if provided, otherwise auto-detect from message
  let docContext: string | undefined;
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';

  const findMentioned = () => {
    const q = lastUserMessage.toLowerCase();
    return initiatives?.find(i => typeof i.title === 'string' && q.includes((i.title as string).toLowerCase()));
  };

  const targetInitiative = focusInitiativeId
    ? initiatives?.find(i => i.id === focusInitiativeId)
    : findMentioned();

  if (targetInitiative?.prdUrl && typeof targetInitiative.prdUrl === 'string') {
    const text = await fetchGoogleDocText(targetInitiative.prdUrl as string);
    if (text) docContext = text;
  }

  const systemPrompt = buildArchieSystemPrompt(initiatives as never, docContext);

  try {
    const readable = await streamAI(systemPrompt, messages);
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
