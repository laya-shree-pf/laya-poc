import {useCallback, useEffect, useRef, useState} from 'react';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from 'react-native';
import type {LegendListRef} from '@legendapp/list/react-native';

// How far (px) from the bottom the user must be before the "scroll to bottom" button shows.
const AWAY_FROM_END_PX = 80;
// Each send appends two rows: the user's message and the assistant's reply.
const ROWS_PER_TURN = 2;

type ListState = ReturnType<LegendListRef['getState']>;

// Whether the last message ends below the visible area. Measured to the end of the
// last message rather than the list, so the footer spacer doesn't count as content.
const isAway = (state: ListState, offset: number, viewport: number) => {
  const last = state.data.length - 1;
  if (last < 0) return false;
  const messagesEnd = state.positionAtIndex(last) + state.sizeAtIndex(last);
  return messagesEnd - offset - viewport > AWAY_FROM_END_PX;
};

// Scroll behaviour for the chat list:
// - When the user sends, their message scrolls to the top of the list and the reply streams below it.
//   A footer spacer fills the rest of the view so there's always room to scroll that far.
// - The list never follows a streaming answer; the "scroll to bottom" button shows whenever
//   content extends below the visible area, and scrolls there when tapped.
export const useScrollToBottom = (messageCount: number) => {
  // Imperative list handle: needed to scroll and to read the list's measured sizes.
  const listRef = useRef<LegendListRef>(null);
  const [isAwayFromEnd, setIsAwayFromEnd] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  // Index of the just-sent user message, to scroll to the top once the new rows are measured.
  // A flag for the next size callback, not something to render, hence a ref.
  const pendingTopIndex = useRef<number | null>(null);

  const getScrollView = useCallback(
    () =>
      listRef.current?.getNativeScrollRef() as unknown as
        | ScrollView
        | undefined,
    [],
  );

  // Scroll the underlying ScrollView: LegendList's own scrollToEnd uses cached item sizes,
  // which lag behind a single message that keeps growing while it streams.
  const scrollToEnd = useCallback(() => {
    getScrollView()?.scrollToEnd({animated: true});
  }, [getScrollView]);

  // Spacer = whatever the last turn (user message + reply) doesn't fill of the visible area.
  const updateFooter = useCallback(() => {
    const state = listRef.current?.getState();
    if (!state || state.data.length < ROWS_PER_TURN) {
      setFooterHeight(0);
      return;
    }
    const last = state.data.length - 1;
    const lastTurnHeight =
      state.sizeAtIndex(last - 1) + state.sizeAtIndex(last);
    setFooterHeight(Math.max(0, state.scrollLength - lastTurnHeight));
  }, []);

  // The user scrolled.
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const state = listRef.current?.getState();
    const {contentOffset, layoutMeasurement} = e.nativeEvent;
    if (state) {
      setIsAwayFromEnd(
        isAway(state, contentOffset.y, layoutMeasurement.height),
      );
    }
  }, []);

  // A row was measured: the new turn we're waiting to show, or the reply grew while streaming.
  const onItemSizeChanged = useCallback(
    ({index}: {index: number}) => {
      const state = listRef.current?.getState();
      if (!state) return;
      const topIndex = pendingTopIndex.current;
      if (topIndex !== null && index >= state.data.length - 1) {
        pendingTopIndex.current = null;
        getScrollView()?.scrollTo({
          y: state.positionAtIndex(topIndex),
          animated: true,
        });
      } else {
        setIsAwayFromEnd(isAway(state, state.scroll, state.scrollLength));
      }
      updateFooter();
    },
    [getScrollView, updateFooter],
  );

  // On send, reserve a full view of space below the new rows so the user's message
  // can scroll to the top; onItemSizeChanged does the scroll and then shrinks the spacer.
  useEffect(() => {
    if (messageCount < ROWS_PER_TURN) return;
    pendingTopIndex.current = messageCount - ROWS_PER_TURN;
    setFooterHeight(listRef.current?.getState().scrollLength ?? 0);
  }, [messageCount]);

  return {
    listRef,
    isAwayFromEnd,
    footerHeight,
    onScroll,
    onItemSizeChanged,
    scrollToEnd,
  };
};
