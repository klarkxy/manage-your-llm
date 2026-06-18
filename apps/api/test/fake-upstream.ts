import type { AddressInfo } from 'node:net';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';

export interface FakeAnthropicResponse {
  status?: number;
  headers?: Record<string, string>;
  body: unknown; // Anthropic Messages response body, or Anthropic error body
}

export interface FakeOpenAIResponse {
  status?: number;
  headers?: Record<string, string>;
  body: unknown; // OpenAI Chat Completions response body, or OpenAI error body
}

// One Anthropic SSE event. `event` is the `event:` line; if omitted, the
// fake writes only a `data:` line.
export interface AnthropicStreamEvent {
  event?: string;
  data: string;
}

// One OpenAI SSE chunk (one `data:` line). The terminal `[DONE]` line
// is just `{ data: "[DONE]" }`.
export interface OpenAIStreamChunk {
  data: string;
}

export interface CozeStreamEvent {
  event?: string;
  data: string;
}

export interface CodexStreamEvent {
  event?: string;
  data: string;
}

export interface FakeCodexResponse {
  status?: number;
  headers?: Record<string, string>;
  body: unknown;
}

// Streaming response spec. `closeAfter` is the number of events after
// which the connection is destroyed (for mid-stream failure tests). If
// undefined, the stream ends naturally after all events.
export interface FakeStreamSpec<T> {
  events: T[];
  closeAfter?: number;
  // Optional delay (in ms) inserted between events. Helps tests observe
  // partial streams in flight.
  delayMs?: number;
}

export interface FakeUpstreamRig {
  baseUrl: string;
  apiKey: string;
  // Set the response the next request should return. The test sets this before
  // each call to keep responses predictable. Last value persists if not changed.
  // If a per-call queue has been set up via `enqueueAnthropicResponse`, the
  // queue is consumed first; after that, the value set by this method is
  // used as the steady-state response.
  setAnthropicResponse(resp: FakeAnthropicResponse): void;
  setOpenAIResponse(resp: FakeOpenAIResponse): void;
  // Queue a one-shot response for the next N requests. After the queue is
  // exhausted, the most recent set*Response value is used.
  enqueueAnthropicResponse(resp: FakeAnthropicResponse): void;
  enqueueOpenAIResponse(resp: FakeOpenAIResponse): void;
  // Configure the next stream response. Each call replaces the current
  // stream spec. The fake will stream events one at a time, optionally
  // destroying the socket after `closeAfter` events.
  setAnthropicStream(spec: FakeStreamSpec<AnthropicStreamEvent>): void;
  setOpenAIStream(spec: FakeStreamSpec<OpenAIStreamChunk>): void;
  // Queue a one-shot stream spec; the next request consumes it and falls
  // back to the most recent set*Stream value after that.
  enqueueAnthropicStream(spec: FakeStreamSpec<AnthropicStreamEvent>): void;
  enqueueOpenAIStream(spec: FakeStreamSpec<OpenAIStreamChunk>): void;
  // Coze /v3/chat helpers.
  setCozeStream(spec: FakeStreamSpec<CozeStreamEvent>): void;
  enqueueCozeStream(spec: FakeStreamSpec<CozeStreamEvent>): void;
  // Codex /v1/responses helpers.
  setCodexResponse(resp: FakeCodexResponse): void;
  enqueueCodexResponse(resp: FakeCodexResponse): void;
  setCodexStream(spec: FakeStreamSpec<CodexStreamEvent>): void;
  enqueueCodexStream(spec: FakeStreamSpec<CodexStreamEvent>): void;
  // Recorded incoming requests (body + headers) for inspection.
  anthropicRequests: Array<{ body: unknown; headers: Record<string, string> }>;
  openaiRequests: Array<{ body: unknown; headers: Record<string, string> }>;
  cozeRequests: Array<{ body: unknown; headers: Record<string, string> }>;
  codexRequests: Array<{ body: unknown; headers: Record<string, string> }>;
  close(): Promise<void>;
}

export async function startFakeUpstream(): Promise<FakeUpstreamRig> {
  const app = Fastify({ logger: false });

  let anthropicResp: FakeAnthropicResponse = {
    status: 200,
    body: {
      id: 'msg_default',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'ok' }],
      model: 'fake',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  };
  let openaiResp: FakeOpenAIResponse = {
    status: 200,
    body: {
      id: 'cmpl_default',
      object: 'chat.completion',
      created: 0,
      model: 'fake',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    },
  };
  let codexResp: FakeCodexResponse = {
    status: 200,
    body: {
      id: 'resp_default',
      object: 'response',
      created_at: 0,
      model: 'fake',
      status: 'completed',
      error: null,
      incomplete_details: null,
      instructions: null,
      max_output_tokens: null,
      output: [
        {
          type: 'message',
          id: 'resp_default_msg',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'ok', annotations: [] }],
        },
      ],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    },
  };
  const anthropicQueue: FakeAnthropicResponse[] = [];
  const openaiQueue: FakeOpenAIResponse[] = [];
  const codexQueue: FakeCodexResponse[] = [];
  let anthropicStream: FakeStreamSpec<AnthropicStreamEvent> | null = null;
  let openaiStream: FakeStreamSpec<OpenAIStreamChunk> | null = null;
  let cozeStream: FakeStreamSpec<CozeStreamEvent> | null = null;
  let codexStream: FakeStreamSpec<CodexStreamEvent> | null = null;
  const anthropicStreamQueue: FakeStreamSpec<AnthropicStreamEvent>[] = [];
  const openaiStreamQueue: FakeStreamSpec<OpenAIStreamChunk>[] = [];
  const cozeStreamQueue: FakeStreamSpec<CozeStreamEvent>[] = [];
  const codexStreamQueue: FakeStreamSpec<CodexStreamEvent>[] = [];

  const anthropicRequests: Array<{ body: unknown; headers: Record<string, string> }> = [];
  const openaiRequests: Array<{ body: unknown; headers: Record<string, string> }> = [];
  const cozeRequests: Array<{ body: unknown; headers: Record<string, string> }> = [];
  const codexRequests: Array<{ body: unknown; headers: Record<string, string> }> = [];

  app.post('/v1/messages', async (req: FastifyRequest, reply: FastifyReply) => {
    anthropicRequests.push({
      body: req.body,
      headers: { ...(req.headers as Record<string, string>) },
    });
    const streamSpec =
      anthropicStreamQueue.length > 0 ? anthropicStreamQueue.shift()! : anthropicStream;
    if (streamSpec) {
      reply.raw.statusCode = 200;
      reply.raw.setHeader('content-type', 'text/event-stream; charset=utf-8');
      reply.raw.setHeader('cache-control', 'no-cache');
      for (let i = 0; i < streamSpec.events.length; i++) {
        if (streamSpec.closeAfter !== undefined && i >= streamSpec.closeAfter) {
          // Wait one tick so the already-queued `write` actually reaches
          // the socket buffer, then destroy at the socket level. This
          // gives the gateway a partial body to react to.
          setImmediate(() => {
            try {
              (reply.raw.socket ?? reply.raw.connection)?.destroy();
            } catch {
              /* ignore */
            }
          });
          return;
        }
        const e = streamSpec.events[i]!;
        let frame = '';
        if (e.event) frame += `event: ${e.event}\n`;
        for (const line of e.data.split('\n')) {
          frame += `data: ${line}\n`;
        }
        frame += '\n';
        reply.raw.write(frame);
        if (streamSpec.delayMs && streamSpec.delayMs > 0) {
          await new Promise<void>((r) => setTimeout(r, streamSpec.delayMs));
        }
      }
      reply.raw.end();
      return;
    }
    const resp = anthropicQueue.length > 0 ? anthropicQueue.shift()! : anthropicResp;
    reply.status(resp.status ?? 200);
    if (resp.headers) reply.headers(resp.headers);
    return resp.body;
  });

  app.post('/v1/chat/completions', async (req: FastifyRequest, reply: FastifyReply) => {
    openaiRequests.push({
      body: req.body,
      headers: { ...(req.headers as Record<string, string>) },
    });
    const streamSpec = openaiStreamQueue.length > 0 ? openaiStreamQueue.shift()! : openaiStream;
    if (streamSpec) {
      reply.raw.statusCode = 200;
      reply.raw.setHeader('content-type', 'text/event-stream; charset=utf-8');
      reply.raw.setHeader('cache-control', 'no-cache');
      for (let i = 0; i < streamSpec.events.length; i++) {
        if (streamSpec.closeAfter !== undefined && i >= streamSpec.closeAfter) {
          // Wait one tick so the already-queued `write` actually reaches
          // the socket buffer, then destroy at the socket level. This
          // gives the gateway a partial body to react to.
          setImmediate(() => {
            try {
              (reply.raw.socket ?? reply.raw.connection)?.destroy();
            } catch {
              /* ignore */
            }
          });
          return;
        }
        const e = streamSpec.events[i]!;
        let frame = '';
        for (const line of e.data.split('\n')) {
          frame += `data: ${line}\n`;
        }
        frame += '\n';
        reply.raw.write(frame);
        if (streamSpec.delayMs && streamSpec.delayMs > 0) {
          await new Promise<void>((r) => setTimeout(r, streamSpec.delayMs));
        }
      }
      reply.raw.end();
      return;
    }
    const resp = openaiQueue.length > 0 ? openaiQueue.shift()! : openaiResp;
    reply.status(resp.status ?? 200);
    if (resp.headers) reply.headers(resp.headers);
    return resp.body;
  });

  app.post('/v3/chat', async (req: FastifyRequest, reply: FastifyReply) => {
    cozeRequests.push({ body: req.body, headers: { ...(req.headers as Record<string, string>) } });
    const streamSpec = cozeStreamQueue.length > 0 ? cozeStreamQueue.shift()! : cozeStream;
    if (streamSpec) {
      reply.raw.statusCode = 200;
      reply.raw.setHeader('content-type', 'text/event-stream; charset=utf-8');
      reply.raw.setHeader('cache-control', 'no-cache');
      for (let i = 0; i < streamSpec.events.length; i++) {
        if (streamSpec.closeAfter !== undefined && i >= streamSpec.closeAfter) {
          setImmediate(() => {
            try {
              (reply.raw.socket ?? reply.raw.connection)?.destroy();
            } catch {
              /* ignore */
            }
          });
          return;
        }
        const e = streamSpec.events[i]!;
        let frame = '';
        if (e.event) frame += `event: ${e.event}\n`;
        for (const line of e.data.split('\n')) {
          frame += `data: ${line}\n`;
        }
        frame += '\n';
        reply.raw.write(frame);
        if (streamSpec.delayMs && streamSpec.delayMs > 0) {
          await new Promise<void>((r) => setTimeout(r, streamSpec.delayMs));
        }
      }
      reply.raw.end();
      return;
    }
    // Non-streaming fallback for Coze tests: return the accumulated SSE body as JSON.
    reply.status(200);
    return {
      id: 'chat_default',
      conversation_id: 'conv_default',
      bot_id: 'fake',
      status: 'completed',
    };
  });

  app.post('/v1/responses', async (req: FastifyRequest, reply: FastifyReply) => {
    codexRequests.push({ body: req.body, headers: { ...(req.headers as Record<string, string>) } });
    const streamSpec = codexStreamQueue.length > 0 ? codexStreamQueue.shift()! : codexStream;
    if (streamSpec) {
      reply.raw.statusCode = 200;
      reply.raw.setHeader('content-type', 'text/event-stream; charset=utf-8');
      reply.raw.setHeader('cache-control', 'no-cache');
      for (let i = 0; i < streamSpec.events.length; i++) {
        if (streamSpec.closeAfter !== undefined && i >= streamSpec.closeAfter) {
          setImmediate(() => {
            try {
              (reply.raw.socket ?? reply.raw.connection)?.destroy();
            } catch {
              /* ignore */
            }
          });
          return;
        }
        const e = streamSpec.events[i]!;
        let frame = '';
        if (e.event) frame += `event: ${e.event}\n`;
        for (const line of e.data.split('\n')) {
          frame += `data: ${line}\n`;
        }
        frame += '\n';
        reply.raw.write(frame);
        if (streamSpec.delayMs && streamSpec.delayMs > 0) {
          await new Promise<void>((r) => setTimeout(r, streamSpec.delayMs));
        }
      }
      reply.raw.end();
      return;
    }
    const resp = codexQueue.length > 0 ? codexQueue.shift()! : codexResp;
    reply.status(resp.status ?? 200);
    if (resp.headers) reply.headers(resp.headers);
    return resp.body;
  });

  await app.listen({ host: '127.0.0.1', port: 0 });
  const addr = app.server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  const apiKey = 'test-fake-key';

  return {
    baseUrl,
    apiKey,
    setAnthropicResponse: (r) => {
      anthropicResp = r;
    },
    setOpenAIResponse: (r) => {
      openaiResp = r;
    },
    enqueueAnthropicResponse: (r) => {
      anthropicQueue.push(r);
    },
    enqueueOpenAIResponse: (r) => {
      openaiQueue.push(r);
    },
    setAnthropicStream: (s) => {
      anthropicStream = s;
    },
    setOpenAIStream: (s) => {
      openaiStream = s;
    },
    enqueueAnthropicStream: (s) => {
      anthropicStreamQueue.push(s);
    },
    enqueueOpenAIStream: (s) => {
      openaiStreamQueue.push(s);
    },
    setCozeStream: (s) => {
      cozeStream = s;
    },
    enqueueCozeStream: (s) => {
      cozeStreamQueue.push(s);
    },
    setCodexResponse: (r) => {
      codexResp = r;
    },
    enqueueCodexResponse: (r) => {
      codexQueue.push(r);
    },
    setCodexStream: (s) => {
      codexStream = s;
    },
    enqueueCodexStream: (s) => {
      codexStreamQueue.push(s);
    },
    anthropicRequests,
    openaiRequests,
    cozeRequests,
    codexRequests,
    close: async () => {
      await app.close();
    },
  };
}
