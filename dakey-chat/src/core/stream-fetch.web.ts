// Web (React Native Web): the browser's fetch already streams response bodies.
import type {StreamFetch} from './agui-client';

export const streamFetch: StreamFetch = (url, init) =>
  fetch(url, init) as unknown as ReturnType<StreamFetch>;
