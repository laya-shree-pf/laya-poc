// End-to-end checks for the AG-UI approach (run with the mock server up):
//   npm run mock   (in another terminal)
//   npm run verify
//
// 1. Unit: SSE parser survives arbitrary chunk splits; applyEvent builds the answer.
// 2. Our client vs the mock, per scenario: event order, validation, errors, abort.
// 3. Spec compliance: the official @ag-ui/client (HttpAgent) consumes the same stream.
import assert from 'node:assert/strict';
import {EventType, type BaseEvent, type RunAgentInput} from '@ag-ui/core';
import {EventEncoder} from '@ag-ui/encoder';
import {HttpAgent} from '@ag-ui/client';
import {createSseParser} from '../src/core/sse-parser';
import {HttpError, runAgent, type StreamFetch} from '../src/core/agui-client';
import {applyEvent} from '../src/core/apply-event';
import type {ChatMessage} from '../src/core/chat-types';

const URL = process.env.AGENT_URL ?? 'http://localhost:8787/agent';
const nodeFetch = fetch as unknown as StreamFetch;
let failures = 0;

const check = async (name: string, fn: () => Promise<void> | void) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.log(`  ✗ ${name}\n    ${(err as Error).message}`);
  }
};

const input = (text: string): RunAgentInput => ({
  threadId: 't1',
  runId: `r${Math.random().toString(36).slice(2)}`,
  messages: [{id: 'u1', role: 'user', content: text}],
  tools: [],
  context: [],
  state: {},
});

const run = async (text: string, signal?: AbortSignal) => {
  const events: BaseEvent[] = [];
  const invalid: string[] = [];
  await runAgent({
    url: URL,
    input: input(text),
    fetchImpl: nodeFetch,
    signal,
    onEvent: (e) => events.push(e),
    onInvalid: (_r, reason) => invalid.push(reason),
  });
  return {events, invalid};
};

const assertWellFormed = (events: BaseEvent[]) => {
  assert.equal(
    events[0]?.type,
    EventType.RUN_STARTED,
    'first event is RUN_STARTED',
  );
  const last = events.at(-1)?.type;
  assert.ok(
    last === EventType.RUN_FINISHED || last === EventType.RUN_ERROR,
    `last event is RUN_FINISHED/RUN_ERROR (got ${last})`,
  );
  const startIdx = events.findIndex(
    (e) => e.type === EventType.TEXT_MESSAGE_START,
  );
  const firstContent = events.findIndex(
    (e) => e.type === EventType.TEXT_MESSAGE_CONTENT,
  );
  if (firstContent >= 0)
    assert.ok(
      startIdx >= 0 && startIdx < firstContent,
      'TEXT_MESSAGE_START precedes content',
    );
};

const buildAnswer = (events: BaseEvent[]) =>
  events.reduce<ChatMessage>((m, e) => applyEvent(m, e), {
    id: 'a',
    role: 'assistant',
    text: '',
    status: 'streaming',
    steps: [],
  });

async function main() {
  console.log('\n1. Unit checks');
  await check('SSE parser reassembles events split at every byte', () => {
    const enc = new EventEncoder();
    const wire =
      ': ping\n\n' +
      enc.encodeSSE({
        type: EventType.RUN_STARTED,
        threadId: 't',
        runId: 'r',
      } as BaseEvent) +
      enc.encodeSSE({
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: 'm',
        delta: 'héllo 👋',
      } as BaseEvent);
    const parser = createSseParser();
    const out: string[] = [];
    for (const ch of wire) out.push(...parser.push(ch));
    out.push(...parser.flush());
    assert.equal(out.length, 2);
    assert.equal(JSON.parse(out[1]).delta, 'héllo 👋');
  });
  await check(
    'applyEvent builds steps, text, data block and final status',
    () => {
      const m = buildAnswer([
        {type: EventType.STEP_STARTED, stepName: 'x'},
        {type: EventType.STEP_FINISHED, stepName: 'x'},
        {type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm', delta: 'Hello '},
        {type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm', delta: 'world'},
        {
          type: EventType.CUSTOM,
          name: 'dakey.data',
          value: {title: 'T', columns: [], rows: []},
        },
        {type: EventType.CUSTOM, name: 'dakey.unknown', value: {}},
        {type: EventType.RUN_FINISHED, threadId: 't', runId: 'r'},
      ] as BaseEvent[]);
      assert.deepEqual(m.steps, [{name: 'x', done: true}]);
      assert.equal(m.text, 'Hello world');
      assert.equal(m.data?.title, 'T');
      assert.equal(m.status, 'done');
    },
  );

  console.log('\n2. Our client against the mock server');
  await check(
    'normal answer: well-formed stream, markdown text arrives',
    async () => {
      const {events, invalid} = await run('How did my leads change?');
      assertWellFormed(events);
      assert.equal(invalid.length, 0);
      assert.match(buildAnswer(events).text, /\| Month \| Rent \| Sale \|/);
    },
  );
  await check('chart: CUSTOM dakey.data block received intact', async () => {
    const {events} = await run('Show leads as a chart');
    const m = buildAnswer(events);
    assert.equal(m.data?.rows.length, 6);
    assert.equal(m.data?.suggestedView?.type, 'line');
  });
  await check('error: RUN_ERROR ends the run with status error', async () => {
    const {events} = await run('Trigger an error');
    assertWellFormed(events);
    assert.equal(buildAnswer(events).status, 'error');
  });
  await check('rate limit: HTTP 429 surfaces as HttpError', async () => {
    await assert.rejects(
      run('Hit the usage limit'),
      (e: unknown) => e instanceof HttpError && e.status === 429,
    );
  });
  await check(
    'malformed: bad lines rejected, run still completes',
    async () => {
      const {events, invalid} = await run('Send malformed events');
      assertWellFormed(events);
      assert.equal(
        invalid.length,
        3,
        `expected 3 rejected lines, got ${invalid.length}`,
      );
      assert.equal(buildAnswer(events).status, 'done');
    },
  );
  await check('burst: all 2,000 deltas received in order', async () => {
    const {events} = await run('Burst of 2000 tokens');
    const deltas = events.filter(
      (e) => e.type === EventType.TEXT_MESSAGE_CONTENT,
    );
    assert.equal(deltas.length, 2000);
    assert.equal((deltas[1999] as BaseEvent & {delta: string}).delta, '1999 ');
  });
  await check('abort: Stop cancels the stream mid-answer', async () => {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 2000);
    const t0 = Date.now();
    await assert.rejects(run('Very long answer (~4 min)', ctrl.signal));
    assert.ok(Date.now() - t0 < 4000, 'aborted promptly');
  });

  console.log('\n3. Spec compliance with the official @ag-ui/client');
  await check(
    'HttpAgent consumes the mock stream and assembles the answer',
    async () => {
      const agent = new HttpAgent({url: URL, threadId: 't-official'});
      agent.addMessage({
        id: 'u1',
        role: 'user',
        content: 'How did my leads change?',
      });
      const types: string[] = [];
      const result = await agent.runAgent(
        {},
        {onEvent: ({event}) => void types.push(event.type)},
      );
      assert.equal(types[0], EventType.RUN_STARTED);
      assert.equal(types.at(-1), EventType.RUN_FINISHED);
      const answer = result.newMessages.find((m) => m.role === 'assistant');
      assert.match(
        String(answer && 'content' in answer ? answer.content : ''),
        /Rent leads grew/,
      );
    },
  );

  console.log(
    failures ? `\n${failures} check(s) failed` : '\nAll checks passed',
  );
  process.exit(failures ? 1 : 0);
}

main();
