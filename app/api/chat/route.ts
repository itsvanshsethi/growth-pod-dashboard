import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { extractDocId } from '@/lib/utils';

const client = new Anthropic();

async function fetchGoogleDocContent(docUrl: string, driveApiKey: string): Promise<string | null> {
  try {
    const docId = extractDocId(docUrl);
    if (!docId) return null;
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/plain&key=${driveApiKey}`;
    const res = await fetch(exportUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const text = await res.text();
    // Truncate to ~8000 chars to stay within context limits
    return text.length > 8000 ? text.slice(0, 8000) + '\n[...truncated]' : text;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const driveApiKey = process.env.GOOGLE_DRIVE_API_KEY;

  if (!anthropicKey) {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 503 });
  }

  let body: {
    messages: Anthropic.MessageParam[];
    initiatives: unknown[];
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

  // Build context from initiatives
  const initiativeContext = JSON.stringify(
    (initiatives as Record<string, unknown>[])?.map(i => ({
      title: i.title,
      status: i.status,
      confidence: i.confidence,
      quarter: i.quarter,
      goLiveDate: i.goLiveDate,
      description: i.description,
      northStar: i.northStar,
      successMetrics: i.successMetrics,
      owners: i.owners,
      blockers: i.blockers,
      progress: i.progress,
      checklist: i.checklist,
      changelog: i.changelog,
      notes: i.notes,
    })) ?? [],
    null,
    2
  );

  let additionalContext = '';

  // If focused on a specific initiative, try to fetch its PRD
  if (focusInitiativeId && driveApiKey) {
    const focusIni = (initiatives as Record<string, unknown>[])?.find(
      i => i.id === focusInitiativeId
    );
    if (focusIni?.prdUrl && typeof focusIni.prdUrl === 'string') {
      const docContent = await fetchGoogleDocContent(focusIni.prdUrl, driveApiKey);
      if (docContent) {
        additionalContext = `\n\n--- Full PRD for "${focusIni.title}" ---\n${docContent}\n--- End PRD ---`;
      }
    }
  }

  const systemPrompt = `You are a helpful AI assistant embedded in the Razorpay Growth Pod initiative dashboard. You have live data from the Google Sheet tracking all product initiatives. Answer questions clearly and concisely. When asked about specific initiatives, reference the data provided.

Current Growth Pod initiative data:
${initiativeContext}${additionalContext}

Guidelines:
- Be direct and concise
- Reference specific initiative names and data points when relevant
- For questions about blockers or delays, refer to the changelog and blockers fields
- For status questions, use the status and confidence fields
- Format lists with dashes when listing multiple items`;

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
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
              );
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
    console.error('Chat error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
