import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import type {Diagnostics} from '../core/chat-types';

// Shows what the AG-UI client actually received for the last turn.
export const DiagnosticsPanel = ({d}: {d: Diagnostics}) => (
  <ScrollView style={styles.panel} contentContainerStyle={{padding: 12}}>
    <Text style={styles.title}>AG-UI diagnostics (last turn)</Text>
    <Text style={styles.line}>First event: {d.firstEventMs ?? '–'} ms</Text>
    <Text style={styles.line}>First text: {d.firstTextMs ?? '–'} ms</Text>
    <Text style={styles.line}>Total: {d.totalMs ?? '–'} ms</Text>
    <Text style={styles.line}>UI updates (batched): {d.renders}</Text>
    <Text style={[styles.title, {marginTop: 8}]}>Valid events</Text>
    {Object.entries(d.eventsByType).map(([type, n]) => (
      <Text key={type} style={styles.line}>
        {type}: {n}
      </Text>
    ))}
    <Text style={[styles.title, {marginTop: 8}]}>
      Rejected lines ({d.invalid.length})
    </Text>
    {d.invalid.map((x, i) => (
      <View key={i}>
        <Text style={styles.bad}>{x.reason}</Text>
        <Text style={styles.raw}>{x.raw}</Text>
      </View>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  // Right-hand sidebar, full height of the chat area; scrolls on its own.
  panel: {width: 300, flexGrow: 0, backgroundColor: '#0F172A'},
  title: {color: '#E2E8F0', fontWeight: '700', fontSize: 12},
  line: {color: '#CBD5E1', fontSize: 12, fontFamily: 'monospace'},
  bad: {color: '#FCA5A5', fontSize: 12},
  raw: {color: '#94A3B8', fontSize: 11, fontFamily: 'monospace'},
});
