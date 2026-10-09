import React, {useCallback, useMemo, useState} from 'react';
import {Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';
import {LegendList} from '@legendapp/list/react-native';
import {useChatStore} from '../core/chat-store';
import type {ChatMessage} from '../core/chat-types';
import {MessageItem} from './MessageItem';
import {Composer} from './Composer';
import {DiagnosticsPanel} from './DiagnosticsPanel';
import {ScrollToBottomButton} from './ScrollToBottomButton';
import {useScrollToBottom} from './scroll-to-bottom.hook';

const SUGGESTIONS = [
  'How did my leads change?',
  'Show leads as a chart',
  'Trigger an error',
  'Hit the usage limit',
  'Send malformed events',
  'Burst of 2000 tokens',
  'Very long answer (~4 min)',
];

const keyExtractor = (m: ChatMessage) => m.id;
const renderItem = ({item}: {item: ChatMessage}) => (
  <MessageItem message={item} />
);

export const ChatScreen = () => {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const diagnostics = useChatStore((s) => s.diagnostics);
  const send = useChatStore((s) => s.send);
  const stop = useChatStore((s) => s.stop);
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const {
    listRef,
    isAwayFromEnd,
    footerHeight,
    onScroll,
    onItemSizeChanged,
    scrollToEnd,
  } = useScrollToBottom(messages.length);

  // Space under the last turn so the latest user message can sit at the top of the list.
  const footer = useMemo(
    () => <View style={{height: footerHeight}} />,
    [footerHeight],
  );

  const onSend = useCallback((text: string) => void send(text), [send]);
  const toggleDiagnostics = useCallback(
    () => setShowDiagnostics((v) => !v),
    [],
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>Dakey · AG-UI PoC</Text>
        <Pressable onPress={toggleDiagnostics}>
          <Text style={styles.link}>
            {showDiagnostics ? 'Hide' : 'Show'} diagnostics
          </Text>
        </Pressable>
      </View>

      {/* Chat column on the left, diagnostics sidebar on the right. */}
      <View style={styles.main}>
        <View style={styles.chat}>
          {/* Only this area scrolls; header and composer stay fixed. */}
          <View style={styles.body}>
            {messages.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Ask Dakey anything</Text>
                <View style={styles.chips}>
                  {SUGGESTIONS.map((s) => (
                    <Pressable
                      key={s}
                      style={styles.chip}
                      onPress={() => onSend(s)}
                    >
                      <Text style={styles.chipText}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <LegendList
                ref={listRef}
                style={styles.list}
                data={messages}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                estimatedItemSize={80}
                recycleItems={false}
                onScroll={onScroll}
                onItemSizeChanged={onItemSizeChanged}
                ListFooterComponent={footer}
                scrollEventThrottle={50}
              />
            )}
            {messages.length > 0 && isAwayFromEnd && (
              <ScrollToBottomButton onPress={scrollToEnd} />
            )}
          </View>

          <Composer isStreaming={isStreaming} onSend={onSend} onStop={stop} />
        </View>
        {showDiagnostics && <DiagnosticsPanel d={diagnostics} />}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Fill the host container and never grow past it, so the composer stays pinned to the bottom.
  screen: {
    flex: 1,
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#F6F7F9',
  },
  main: {flex: 1, minHeight: 0, flexDirection: 'row'},
  chat: {flex: 1, minWidth: 0, minHeight: 0},
  body: {flex: 1, minHeight: 0},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#E3E6EC',
    backgroundColor: '#fff',
  },
  brand: {fontWeight: '700', fontSize: 16},
  link: {color: '#1F4FD8'},
  list: {flex: 1},
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {fontSize: 20, fontWeight: '600', marginBottom: 16},
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    maxWidth: 640,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#fff',
  },
  chipText: {fontSize: 13},
});
