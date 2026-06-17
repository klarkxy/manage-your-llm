import type { ProviderHttpRequest } from "../providers/types.js";

export interface StreamSendOptions {
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface RawStreamEvent {
  event: string | null;
  data: string;
}

export interface StreamStartOk {
  kind: "ok";
  status: number;
  headers: Record<string, string>;
  events: AsyncIterable<RawStreamEvent>;
}

export interface StreamStartErrorBody {
  kind: "error-body";
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  bodyJson: unknown;
}

export interface StreamStartTransport {
  kind: "transport";
  error: { name: string; message: string; code?: string };
}

export type StreamStart = StreamStartOk | StreamStartErrorBody | StreamStartTransport;

// Open an upstream HTTP request and return a description of how it began.
// On a 2xx response we return an async iterable of SSE event frames
// (event: name + data: payload). On a non-2xx response we read the body in
// full and return it so the caller can classify the error like a non-stream
// failure. On a transport error we return the error directly. The caller is
// expected to abort by either aborting the optional `signal` or by breaking
// out of the event iteration (cancels the underlying response stream).
export async function startUpstreamStream(
  req: ProviderHttpRequest,
  options: StreamSendOptions,
): Promise<StreamStart> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, options.timeoutMs));
  const onParentAbort = (): void => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", onParentAbort);
  }
  try {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      signal: controller.signal,
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    if (res.status >= 200 && res.status < 300) {
      return {
        kind: "ok",
        status: res.status,
        headers,
        events: parseSseStream(res.body, controller),
      };
    }
    // Non-2xx: read the whole body and present it like a non-stream response.
    const bodyText = await res.text();
    const bodyJson = tryParseJson(bodyText);
    // Cancel the body stream in case it was partially read.
    try { await res.body?.cancel(); } catch { /* ignore */ }
    return { kind: "error-body", status: res.status, headers, bodyText, bodyJson };
  } catch (err) {
    const e = err as { name?: string; message?: string; cause?: { code?: string } };
    const name = e.name === "AbortError" ? "timeout" : (e.name ?? "error");
    const code = e.cause?.code ?? (e.name === "AbortError" ? "ETIMEDOUT" : undefined);
    return {
      kind: "transport",
      error: {
        name,
        message: e.message ?? String(err),
        ...(code !== undefined ? { code } : {}),
      },
    };
  } finally {
    clearTimeout(timer);
    if (options.signal) options.signal.removeEventListener("abort", onParentAbort);
  }
}

function tryParseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Parse an SSE stream (ReadableStream<Uint8Array>) into RawStreamEvent values.
// The stream is split on blank lines (`\n\n` or `\r\n\r\n`); each block is
// broken into `event:` and `data:` lines. `data:` lines are concatenated
// (multi-line data is rare in practice but the spec allows it). Lines that
// start with `:` are SSE comments and are ignored. Unknown line prefixes
// are ignored so we tolerate minor interop differences.
//
// Aborting the controller cancels the underlying fetch response and ends the
// iterator cleanly. The caller is responsible for actually aborting.
async function* parseSseStream(
  body: ReadableStream<Uint8Array> | null,
  controller: AbortController,
): AsyncIterable<RawStreamEvent> {
  if (!body) return;
  const decoder = new TextDecoder("utf-8");
  const reader = body.getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Split on blank line boundaries. SSE uses \n\n or \r\n\r\n.
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseSseBlock(raw);
        if (event) yield event;
        boundary = buffer.indexOf("\n\n");
      }
      // Also handle CRLF boundaries that may straddle chunks.
      boundary = buffer.indexOf("\r\n\r\n");
      if (boundary >= 0) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 4);
        const event = parseSseBlock(raw);
        if (event) yield event;
      }
    }
    // Flush any trailing event without a blank-line terminator.
    const tail = buffer.trim();
    if (tail.length > 0) {
      const event = parseSseBlock(tail);
      if (event) yield event;
    }
  } catch (err) {
    // Aborting the fetch surfaces as an AbortError on the reader; treat any
    // reader error as the end of the stream and let the caller decide what
    // to do with the half-streamed state.
    if ((err as { name?: string }).name === "AbortError") return;
    // Re-throw unexpected errors so the gateway can record them.
    throw err;
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
    // Ensure the controller sees the close even on success; harmless if
    // it was already aborted.
    if (!controller.signal.aborted) controller.abort();
  }
}

function parseSseBlock(block: string): RawStreamEvent | null {
  let event: string | null = null;
  const dataParts: string[] = [];
  for (const rawLine of block.split(/\r?\n/)) {
    if (rawLine.length === 0) continue;
    if (rawLine.startsWith(":")) continue; // comment
    const colon = rawLine.indexOf(":");
    if (colon < 0) continue;
    const field = rawLine.slice(0, colon);
    let value = rawLine.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") {
      event = value;
    } else if (field === "data") {
      dataParts.push(value);
    }
  }
  if (dataParts.length === 0) return null;
  return { event, data: dataParts.join("\n") };
}
