# dakey-chat (PoC)

Dakey chat UI in **React Native + React Native Web** (Expo SDK 53), streaming answers over the [AG-UI](https://docs.ag-ui.com) protocol (POST + Server-Sent Events). A mock AG-UI agent is included, so it runs without a backend.

## Run

Requires Node 20+.

```sh
npm install
npm run mock     # terminal 1: mock AG-UI agent on http://localhost:8787/agent
npm run web      # terminal 2: chat on http://localhost:8090
npm run verify   # optional: AG-UI checks (needs the mock running)
npm run typecheck
```

Point the chat at another agent with `EXPO_PUBLIC_AGENT_URL=https://…/agent npm run web`.

## How it works

```
Composer → chat store send()
  → POST /agent   body: AG-UI RunAgentInput {threadId, runId, messages, tools, context, state}
  ← text/event-stream of AG-UI events
  → SSE parser → JSON.parse → validated with @ag-ui/core schemas (invalid lines are dropped)
  → applyEvent() updates the assistant message → UI updates batched every 50ms
```

| AG-UI event | On screen |
|---|---|
| `RUN_STARTED` | Assistant bubble appears |
| `STEP_STARTED` / `STEP_FINISHED` | Progress lines ("… Looking up your leads" → "✓") |
| `TEXT_MESSAGE_START` / `CONTENT` / `END` | Markdown answer streams in |
| `CUSTOM` `dakey.data` | Data block (title, columns, rows, `suggestedView`) shown as a table |
| `RUN_FINISHED` / `RUN_ERROR` | Turn ends; an error keeps the partial text |

## Layout

| Path | What |
|---|---|
| `src/core/sse-parser.ts` | Turns stream chunks into SSE events (split lines, multi-line `data:`, `: ping` keep-alives) |
| `src/core/agui-client.ts` | `runAgent()`: POST, read the stream, validate each event, `HttpError` on non-200, abort via `AbortSignal` |
| `src/core/stream-fetch.ts` / `.web.ts` | Streaming fetch per platform (`expo/fetch` on native, browser `fetch` on web) |
| `src/core/apply-event.ts` | Pure reducer: AG-UI event → assistant message |
| `src/core/chat-store.ts` | Zustand store: display state only, one turn at a time, batching, Stop, 429 handling, diagnostics |
| `src/ui/ChatScreen.tsx` | Header, message list, composer, diagnostics sidebar |
| `src/ui/scroll-to-bottom.hook.ts` | Sent message scrolls to the top; no auto-follow while streaming; ↓ button when content is below the view |
| `src/ui/MessageItem.tsx` | Bubbles, markdown (custom table renderer), `dakey.data` table, stopped/error states |
| `src/ui/Composer.tsx` | Typing allowed while streaming; Send locked until the turn ends; Enter sends, Shift+Enter adds a newline |
| `src/ui/DiagnosticsPanel.tsx` | Dev sidebar: time to first event / first text, total, UI updates, events by type, rejected lines |
| `mock-server/server.ts` | Mock AG-UI agent (writes events with the official `@ag-ui/encoder`) |
| `scripts/verify-agui.ts` | Parser, client and spec-compliance checks (uses the official `@ag-ui/client`) |

## Mock scenarios

Keywords in the message pick the scenario (the suggestion chips cover each one):

| Keyword | Behaviour |
|---|---|
| *(anything else)* | Two steps, then a streamed markdown answer with a table |
| `chart` | Adds a `CUSTOM dakey.data` block (6 rows, `suggestedView: line`) |
| `error` | `RUN_ERROR` partway through the answer |
| `limit` | HTTP 429 `{code: 'rate_limited', limit, resetAt}` |
| `malformed` | 3 invalid lines mixed into the stream |
| `burst` | 2,000 tokens with no delay |
| `long` | ~4 minute answer (for Stop and scrolling) |

## Connecting a real agent

The backend needs to accept `RunAgentInput` and respond with `text/event-stream`, writing each AG-UI event as `data: <json>\n\n`. Set `EXPO_PUBLIC_AGENT_URL` to its URL. Auth headers can be passed via the `headers` option of `runAgent()` in `src/core/chat-store.ts`.
