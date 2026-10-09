// In-memory chat state for display only (the backend owns persistence).
// Stream events are applied immediately to a draft; the UI is updated at most
// every BATCH_MS so fast token bursts don't overload rendering.
import {create} from 'zustand';
import type {BaseEvent, Message, RunAgentInput} from '@ag-ui/core';
import {HttpError, runAgent} from './agui-client';
import {applyEvent} from './apply-event';
import {streamFetch} from './stream-fetch';
import type {ChatMessage, Diagnostics} from './chat-types';

export const AGENT_URL =
  process.env.EXPO_PUBLIC_AGENT_URL ?? 'http://localhost:8787/agent';
const BATCH_MS = 50;

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const emptyDiagnostics = (): Diagnostics => ({
  eventsByType: {},
  invalid: [],
  renders: 0,
});

interface ChatState {
  threadId: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  diagnostics: Diagnostics;
  send: (text: string) => Promise<void>;
  stop: () => void;
}

let controller: AbortController | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  threadId: uid(),
  messages: [],
  isStreaming: false,
  diagnostics: emptyDiagnostics(),

  stop: () => controller?.abort(),

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().isStreaming) return; // one turn at a time

    const user: ChatMessage = {
      id: uid(),
      role: 'user',
      text: trimmed,
      status: 'done',
      steps: [],
    };
    let draft: ChatMessage = {
      id: uid(),
      role: 'assistant',
      text: '',
      status: 'streaming',
      steps: [],
    };
    const diagnostics = emptyDiagnostics();
    const startedAt = Date.now();

    set((s) => ({
      messages: [...s.messages, user, draft],
      isStreaming: true,
      diagnostics,
    }));

    // Batched UI updates: events mutate `draft`; a timer publishes it.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const publish = () => {
      timer = null;
      diagnostics.renders += 1;
      set((s) => ({
        messages: s.messages.map((m) => (m.id === draft.id ? draft : m)),
        diagnostics: {...diagnostics},
      }));
    };
    const schedule = () => {
      if (!timer) timer = setTimeout(publish, BATCH_MS);
    };

    const history: Message[] = get()
      .messages.filter((m) => m.id !== draft.id && m.text)
      .map((m) => ({id: m.id, role: m.role, content: m.text} as Message));
    const input: RunAgentInput = {
      threadId: get().threadId,
      runId: uid(),
      messages: history,
      tools: [],
      context: [],
      state: {},
    };

    controller = new AbortController();
    try {
      await runAgent({
        url: AGENT_URL,
        input,
        fetchImpl: streamFetch,
        signal: controller.signal,
        onEvent: (event: BaseEvent) => {
          const ms = Date.now() - startedAt;
          diagnostics.firstEventMs ??= ms;
          if (event.type === 'TEXT_MESSAGE_CONTENT')
            diagnostics.firstTextMs ??= ms;
          diagnostics.eventsByType[event.type] =
            (diagnostics.eventsByType[event.type] ?? 0) + 1;
          draft = applyEvent(draft, event);
          schedule();
        },
        onInvalid: (raw, reason) => {
          diagnostics.invalid.push({raw: raw.slice(0, 120), reason});
          schedule();
        },
      });
      if (draft.status === 'streaming') draft = {...draft, status: 'done'}; // stream closed without RUN_FINISHED
    } catch (err) {
      if (controller.signal.aborted) {
        draft = {...draft, status: 'stopped'};
      } else if (err instanceof HttpError && err.status === 429) {
        draft = {
          ...draft,
          status: 'error',
          error: `You've reached your usage limit. ${err.body}`,
        };
      } else {
        draft = {
          ...draft,
          status: 'error',
          error: 'Something went wrong. Please try again.',
        };
      }
    } finally {
      if (timer) clearTimeout(timer);
      diagnostics.totalMs = Date.now() - startedAt;
      publish();
      controller = null;
      set({isStreaming: false});
    }
  },
}));
