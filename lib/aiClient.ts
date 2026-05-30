// Unified AI client — uses Anthropic if ANTHROPIC_API_KEY is set, otherwise Gemini.

import { GoogleGenerativeAI } from '@google/generative-ai';

export async function askAI(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 800
): Promise<string> {
  // ── Anthropic ──────────────────────────────────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    return (response.content[0] as { text: string }).text || '';
  }

  // ── Gemini (free tier) ─────────────────────────────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(userMessage);
    return result.response.text() || '';
  }

  throw new Error('No AI credentials configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY.');
}

// Streaming version — for the dashboard chatbot (Anthropic only streams; Gemini falls back to non-streaming)
export async function streamAI(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens = 1000
): Promise<ReadableStream> {
  // ── Anthropic streaming ────────────────────────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic();
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    });

    return new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (e) { controller.error(e); }
        finally { controller.close(); }
      },
    });
  }

  // ── Gemini (simulated streaming — sends full response as one chunk) ────────
  if (process.env.GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
    });

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));
    const lastMessage = messages[messages.length - 1].content;

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage);

    return new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (e) { controller.error(e); }
        finally { controller.close(); }
      },
    });
  }

  throw new Error('No AI credentials configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY.');
}
