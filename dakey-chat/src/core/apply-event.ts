// Applies one AG-UI event to the assistant message being streamed.
// Pure (returns a new message), so it can be unit-tested with fixture streams.
import {EventType, type BaseEvent} from '@ag-ui/core';
import type {ChatMessage, DataBlock} from './chat-types';

export const DAKEY_DATA = 'dakey.data';

export function applyEvent(
  message: ChatMessage,
  event: BaseEvent,
): ChatMessage {
  const e = event as BaseEvent & Record<string, unknown>;
  switch (event.type) {
    case EventType.STEP_STARTED:
      return {
        ...message,
        steps: [...message.steps, {name: String(e.stepName), done: false}],
      };
    case EventType.STEP_FINISHED:
      return {
        ...message,
        steps: message.steps.map((s) =>
          s.name === e.stepName ? {...s, done: true} : s,
        ),
      };
    case EventType.TEXT_MESSAGE_CONTENT:
      return {...message, text: message.text + String(e.delta)};
    case EventType.CUSTOM:
      return e.name === DAKEY_DATA
        ? {...message, data: e.value as DataBlock}
        : message; // unknown custom blocks ignored
    case EventType.RUN_FINISHED:
      return {...message, status: 'done'};
    case EventType.RUN_ERROR:
      return {
        ...message,
        status: 'error',
        error: String(e.message ?? 'Something went wrong'),
      };
    default:
      // RUN_STARTED, TEXT_MESSAGE_START/END and any event Dakey does not use yet.
      return message;
  }
}
