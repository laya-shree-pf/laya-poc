// Minimal AG-UI client: POSTs a RunAgentInput, reads the SSE response as it
// arrives, and hands every *valid* AG-UI event to `onEvent`. Validation uses the
// official @ag-ui/core schemas. Invalid lines and unknown event types are
// reported separately and never break the run.
//
// The fetch implementation is injected so the same code runs on web (browser
// fetch), native (expo/fetch) and Node (for verification scripts).
import {EventSchemas} from '@ag-ui/core/schemas';
import type {BaseEvent, RunAgentInput} from '@ag-ui/core';
import {createSseParser} from './sse-parser';

export type StreamFetch = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  body: {
    getReader: () => {read: () => Promise<{done: boolean; value?: Uint8Array}>};
  } | null;
}>;

export class HttpError extends Error {
  constructor(public status: number, public body: string) {
    super(`HTTP ${status}`);
  }
}

export interface RunCallbacks {
  onEvent: (event: BaseEvent) => void;
  /** A data line that is not valid JSON or fails the AG-UI schema. */
  onInvalid?: (raw: string, reason: string) => void;
}

export interface RunOptions extends RunCallbacks {
  url: string;
  input: RunAgentInput;
  fetchImpl: StreamFetch;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function runAgent({
  url,
  input,
  fetchImpl,
  headers,
  signal,
  onEvent,
  onInvalid,
}: RunOptions) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...headers,
    },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok)
    throw new HttpError(res.status, await res.text().catch(() => ''));
  if (!res.body) throw new Error('Response has no readable stream');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();

  const handle = (payloads: string[]) => {
    for (const raw of payloads) {
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        onInvalid?.(raw, 'not JSON');
        continue;
      }
      const parsed = EventSchemas.safeParse(json);
      if (parsed.success) {
        onEvent(parsed.data as BaseEvent);
      } else {
        onInvalid?.(raw, parsed.error.issues[0]?.message ?? 'schema mismatch');
      }
    }
  };

  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    handle(parser.push(decoder.decode(value, {stream: true})));
  }
  handle(parser.flush());
}
