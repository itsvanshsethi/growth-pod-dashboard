import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildArchieSystemPrompt } from '@/lib/archieContext';
import { fetchGoogleDocText } from '@/lib/googleAuth';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 503 });
  }

  let body: {
    messages: Anthropic.MessageParam[];
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

  // Optionally fetch linked PRD doc for focused initiative
  let docContext: string | undefined;
  if (focusInitiativeId) {
    const focused = initiatives?.find(i => i.id === focusInitiativeId);
    if (focused?.prdUrl && typeof focused.prdUrl === 'string') {
      const text = await fetchGoogleDocText(focused.prdUrl);
      if (text) docContext = text;
    }
  }

  const systemPrompt = buildArchieSystemPrompt(initiatives as never, docContext);

  try {
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : '',
      })),
    });

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (e) {
          controller.error(e);
        } finally {
          controller.close();
        }
      },
    });

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
