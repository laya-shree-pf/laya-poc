// Incremental SSE parser. Network chunks can end anywhere (even mid-line), so
// incomplete text is buffered until the next push. Each SSE event is one or more
// `data:` lines terminated by a blank line; comment lines (": ping") are ignored.

export interface SseParser {
  /** Feed decoded text; returns the data payloads of every completed event. */
  push: (text: string) => string[];
  /** Flush a final event that was not followed by a blank line. */
  flush: () => string[];
}

export const createSseParser = (): SseParser => {
  let buffer = '';
  let dataLines: string[] = [];

  const consumeLine = (line: string, out: string[]) => {
    if (line === '') {
      if (dataLines.length) out.push(dataLines.join('\n'));
      dataLines = [];
      return;
    }
    if (line.startsWith(':')) return; // comment / keep-alive
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    // Other SSE fields (event:, id:, retry:) are not used by AG-UI.
  };

  return {
    push: (text) => {
      buffer += text;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      const out: string[] = [];
      lines.forEach((line) => consumeLine(line, out));
      return out;
    },
    flush: () => {
      const out: string[] = [];
      if (buffer) consumeLine(buffer, out);
      buffer = '';
      consumeLine('', out);
      return out;
    },
  };
};
