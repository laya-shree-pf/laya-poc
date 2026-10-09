// Mock AG-UI agent server for the Dakey chat PoC.
//
// Streams real AG-UI events (encoded with the official @ag-ui/encoder) over SSE,
// so the client is exercised against spec-compliant output. Scenarios are picked
// from the last user message:
//   "error"     -> RUN_ERROR mid-stream
//   "limit"     -> HTTP 429 before the stream starts
//   "long"      -> ~4 minute stream (slow word-by-word text)
//   "burst"     -> 2,000 tiny deltas as fast as possible
//   "malformed" -> an invalid event and an unknown event type mixed into the stream
//   "chart"     -> a CUSTOM dakey.data block (typed dataset + suggested view)
//   anything else -> steps + a streamed markdown answer (with a table)
import {createServer, IncomingMessage, ServerResponse} from 'node:http';
import {randomUUID} from 'node:crypto';
import {EventEncoder} from '@ag-ui/encoder';
import {EventType, type BaseEvent, type RunAgentInput} from '@ag-ui/core';

const PORT = Number(process.env.PORT ?? 8787);
const KEEP_ALIVE_MS = 15_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

const lastUserText = (input: RunAgentInput): string => {
  const last = [...input.messages].reverse().find((m) => m.role === 'user');
  const content = last && 'content' in last ? last.content : '';
  return typeof content === 'string' ? content : '';
};

const markdownAnswer = (question: string) =>
  `Here's what I found for **"${question}"**.\n\n` +
  `Rent leads grew **51%** over the last six months, while sale leads grew **38%**.\n\n` +
  `| Month | Rent | Sale |\n|---|---|---|\n| May | 120 | 80 |\n| Jun | 135 | 78 |\n| Jul | 150 | 90 |\n| Aug | 142 | 95 |\n| Sep | 168 | 101 |\n| Oct | 181 | 110 |\n\n` +
  `- Most of the growth came from **2-bed** units in Dubai Marina.\n` +
  `- Response time is up to *4h*, which may slow conversions.\n`;

const chartBlock = {
  title: 'Leads per month',
  columns: [
    {key: 'month', label: 'Month', valueType: 'month'},
    {key: 'rent', label: 'Rent', valueType: 'count'},
    {key: 'sale', label: 'Sale', valueType: 'count'},
  ],
  rows: [
    {month: '2026-05', rent: 120, sale: 80},
    {month: '2026-06', rent: 135, sale: 78},
    {month: '2026-07', rent: 150, sale: 90},
    {month: '2026-08', rent: 142, sale: 95},
    {month: '2026-09', rent: 168, sale: 101},
    {month: '2026-10', rent: 181, sale: 110},
  ],
  suggestedView: {type: 'line', x: 'month', y: ['rent', 'sale']},
};

async function handleAgent(req: IncomingMessage, res: ServerResponse) {
  const input = JSON.parse(await readBody(req)) as RunAgentInput;
  const question = lastUserText(input);
  const lower = question.toLowerCase();

  if (lower.includes('limit')) {
    res.writeHead(429, {'Content-Type': 'application/json'});
    res.end(
      JSON.stringify({
        code: 'rate_limited',
        limit: 50,
        resetAt: '2026-10-10T00:00:00Z',
      }),
    );
    return;
  }

  const encoder = new EventEncoder({accept: req.headers.accept});
  res.writeHead(200, {
    'Content-Type': encoder.getContentType(),
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let closed = false;
  res.on('close', () => (closed = true));
  const ping = setInterval(
    () => !closed && res.write(': ping\n\n'),
    KEEP_ALIVE_MS,
  );

  const send = (event: BaseEvent) => {
    if (!closed) res.write(encoder.encodeSSE(event));
  };
  const threadId = input.threadId;
  const runId = input.runId;
  const messageId = randomUUID();

  try {
    send({type: EventType.RUN_STARTED, threadId, runId} as BaseEvent);

    send({
      type: EventType.STEP_STARTED,
      stepName: 'Understanding your question',
    } as BaseEvent);
    await sleep(600);
    send({
      type: EventType.STEP_FINISHED,
      stepName: 'Understanding your question',
    } as BaseEvent);
    send({
      type: EventType.STEP_STARTED,
      stepName: 'Looking up your leads',
    } as BaseEvent);
    await sleep(900);
    send({
      type: EventType.STEP_FINISHED,
      stepName: 'Looking up your leads',
    } as BaseEvent);

    if (lower.includes('malformed')) {
      // Not valid AG-UI: TEXT_MESSAGE_CONTENT without delta, plus an unknown type.
      res.write(
        `data: ${JSON.stringify({
          type: 'TEXT_MESSAGE_CONTENT',
          messageId,
        })}\n\n`,
      );
      res.write(`data: ${JSON.stringify({type: 'SOMETHING_NEW', foo: 1})}\n\n`);
      res.write('data: {not json\n\n');
    }

    send({
      type: EventType.TEXT_MESSAGE_START,
      messageId,
      role: 'assistant',
    } as BaseEvent);

    if (lower.includes('burst')) {
      for (let i = 0; i < 2000 && !closed; i++) {
        send({
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId,
          delta: `${i} `,
        } as BaseEvent);
      }
    } else {
      const text = lower.includes('long')
        ? Array.from({length: 2400}, (_, i) => `word${i}`).join(' ')
        : markdownAnswer(question);
      const delay = lower.includes('long') ? 100 : 35;
      const tokens = text.match(/\S+\s*/g) ?? [];
      for (const token of tokens) {
        if (closed) break;
        if (lower.includes('error') && token.startsWith('six')) {
          send({type: EventType.TEXT_MESSAGE_END, messageId} as BaseEvent);
          send({
            type: EventType.RUN_ERROR,
            message: 'Mock failure while generating the answer',
            code: 'internal_error',
          } as BaseEvent);
          return;
        }
        send({
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId,
          delta: token,
        } as BaseEvent);
        await sleep(delay);
      }
    }

    send({type: EventType.TEXT_MESSAGE_END, messageId} as BaseEvent);

    if (lower.includes('chart')) {
      send({
        type: EventType.CUSTOM,
        name: 'dakey.data',
        value: chartBlock,
      } as BaseEvent);
    }

    send({type: EventType.RUN_FINISHED, threadId, runId} as BaseEvent);
  } finally {
    clearInterval(ping);
    if (!closed) res.end();
  }
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept',
  );
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  if (req.method === 'POST' && req.url === '/agent') {
    try {
      await handleAgent(req, res);
    } catch (err) {
      if (!res.headersSent)
        res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: String(err)}));
    }
    return;
  }
  res.writeHead(404).end();
});

server.listen(PORT, () =>
  console.log(`Mock AG-UI agent on http://localhost:${PORT}/agent`),
);
