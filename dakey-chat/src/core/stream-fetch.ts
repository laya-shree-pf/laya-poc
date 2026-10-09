// Native: React Native's built-in fetch buffers the whole response, so streaming
// uses expo/fetch, which exposes a readable body stream.
import {fetch as expoFetch} from 'expo/fetch';
import type {StreamFetch} from './agui-client';

export const streamFetch: StreamFetch = (url, init) =>
  expoFetch(url, init) as unknown as ReturnType<StreamFetch>;
