import React, {useCallback, useState} from 'react';
import {
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';

interface Props {
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

// The input stays editable while an answer streams; only sending is locked.
export const Composer = ({isStreaming, onSend, onStop}: Props) => {
  const [text, setText] = useState('');
  const canSend = !isStreaming && text.trim().length > 0;

  const submit = useCallback(() => {
    if (!canSend) return;
    onSend(text);
    setText('');
  }, [canSend, onSend, text]);

  const onKeyPress = useCallback(
    (
      e: NativeSyntheticEvent<
        TextInputKeyPressEventData & {shiftKey?: boolean}
      >,
    ) => {
      if (
        Platform.OS === 'web' &&
        e.nativeEvent.key === 'Enter' &&
        !e.nativeEvent.shiftKey
      ) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  return (
    <View style={styles.bar}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        onKeyPress={onKeyPress}
        placeholder={
          isStreaming
            ? 'Dakey is answering… you can keep typing'
            : 'Ask Dakey anything'
        }
        multiline
      />
      {isStreaming ? (
        <Pressable
          style={[styles.button, styles.stop]}
          onPress={onStop}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Stop</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.button, !canSend && styles.disabled]}
          onPress={submit}
          disabled={!canSend}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Send</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#E3E6EC',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    fontSize: 15,
  },
  button: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#1F4FD8',
    justifyContent: 'center',
  },
  stop: {backgroundColor: '#B42318'},
  disabled: {opacity: 0.4},
  buttonText: {color: '#fff', fontWeight: '600'},
});
