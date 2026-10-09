import React, {memo, type ReactNode} from 'react';
import {StyleSheet, Text, View, type ViewStyle} from 'react-native';
import {Renderer, useMarkdown} from 'react-native-marked';
import type {ChatMessage, DataBlock} from '../core/chat-types';

// The default table gives each column 43% of the window width and scrolls sideways,
// which hides columns inside a chat bubble. Render equal-width columns instead.
class ChatRenderer extends Renderer {
  table(
    header: ReactNode[][],
    rows: ReactNode[][][],
    _t?: ViewStyle,
    rowStyle?: ViewStyle,
    cellStyle?: ViewStyle,
  ) {
    const renderRow = (cells: ReactNode[][], key: string, head = false) => (
      <View
        key={key}
        style={[styles.mdRow, rowStyle, head && styles.mdHeadRow]}
      >
        {cells.map((cell, i) => (
          <View key={i} style={[styles.mdCell, cellStyle]}>
            {cell}
          </View>
        ))}
      </View>
    );
    return (
      <View key={this.getKey()} style={styles.mdTable}>
        {renderRow(header, 'h', true)}
        {rows.map((r, i) => renderRow(r, String(i)))}
      </View>
    );
  }
}

const markdownOptions = {
  colorScheme: 'light' as const,
  renderer: new ChatRenderer(),
};

const MarkdownText = ({value}: {value: string}) => {
  const elements = useMarkdown(value, markdownOptions);
  return (
    <View>
      {elements.map((el, i) => (
        <React.Fragment key={i}>{el}</React.Fragment>
      ))}
    </View>
  );
};

const Steps = ({steps}: {steps: ChatMessage['steps']}) => (
  <View style={styles.steps}>
    {steps.map((s) => (
      <Text key={s.name} style={styles.step}>
        {s.done ? '✓' : '…'} {s.name}
      </Text>
    ))}
  </View>
);

// Minimal rendering of a dakey.data block, to prove the CUSTOM event arrives intact.
const DataTable = ({data}: {data: DataBlock}) => (
  <View style={styles.data}>
    <Text style={styles.dataTitle}>
      {data.title}{' '}
      <Text style={styles.dataHint}>
        (dakey.data · suggested: {data.suggestedView?.type})
      </Text>
    </Text>
    <View style={styles.row}>
      {data.columns.map((c) => (
        <Text key={c.key} style={[styles.cell, styles.head]}>
          {c.label}
        </Text>
      ))}
    </View>
    {data.rows.map((r, i) => (
      <View key={i} style={styles.row}>
        {data.columns.map((c) => (
          <Text key={c.key} style={styles.cell}>
            {String(r[c.key])}
          </Text>
        ))}
      </View>
    ))}
  </View>
);

export const MessageItem = memo(({message}: {message: ChatMessage}) => {
  if (message.role === 'user') {
    return (
      <View style={[styles.bubble, styles.user]}>
        <Text style={styles.userText}>{message.text}</Text>
      </View>
    );
  }
  const waiting = message.status === 'streaming' && !message.text;
  return (
    <View style={[styles.bubble, styles.assistant]}>
      {message.steps.length > 0 && <Steps steps={message.steps} />}
      {waiting && message.steps.length === 0 && (
        <Text style={styles.step}>Thinking…</Text>
      )}
      {!!message.text && <MarkdownText value={message.text} />}
      {message.data && <DataTable data={message.data} />}
      {message.status === 'stopped' && <Text style={styles.meta}>Stopped</Text>}
      {message.status === 'error' && (
        <Text style={styles.error}>{message.error}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  bubble: {
    marginVertical: 6,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    maxWidth: 760,
  },
  user: {alignSelf: 'flex-end', backgroundColor: '#1F4FD8'},
  userText: {color: '#fff', fontSize: 15},
  assistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E3E6EC',
    width: '100%',
  },
  steps: {marginBottom: 8},
  step: {color: '#6B7280', fontSize: 13},
  meta: {color: '#6B7280', fontSize: 12, marginTop: 6},
  error: {color: '#B42318', fontSize: 13, marginTop: 6},
  data: {
    marginTop: 10,
    borderTopWidth: 1,
    borderColor: '#E3E6EC',
    paddingTop: 8,
  },
  dataTitle: {fontWeight: '600', marginBottom: 6},
  dataHint: {fontWeight: '400', color: '#6B7280', fontSize: 12},
  row: {flexDirection: 'row'},
  cell: {flex: 1, paddingVertical: 4, fontSize: 13},
  head: {fontWeight: '600'},
  mdTable: {
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E3E6EC',
    borderRadius: 6,
  },
  mdRow: {flexDirection: 'row', borderTopWidth: 1, borderColor: '#E3E6EC'},
  mdHeadRow: {borderTopWidth: 0, backgroundColor: '#F6F7F9'},
  mdCell: {flex: 1, paddingHorizontal: 8, paddingVertical: 4},
});
