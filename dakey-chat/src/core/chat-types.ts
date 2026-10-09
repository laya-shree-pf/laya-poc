export type MessageStatus = 'streaming' | 'done' | 'error' | 'stopped';

export interface DataBlock {
  title: string;
  columns: {key: string; label: string; valueType: string}[];
  rows: Record<string, string | number>[];
  suggestedView?: {type: string; x?: string; y?: string[]};
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status: MessageStatus;
  steps: {name: string; done: boolean}[];
  data?: DataBlock;
  error?: string;
}

export interface Diagnostics {
  eventsByType: Record<string, number>;
  invalid: {raw: string; reason: string}[];
  firstEventMs?: number;
  firstTextMs?: number;
  totalMs?: number;
  renders: number;
}
