import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';

export const ScrollToBottomButton = ({onPress}: {onPress: () => void}) => (
  <Pressable
    style={styles.button}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel="Scroll to latest message"
  >
    <Text style={styles.arrow}>↓</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
    elevation: 3,
  },
  arrow: {fontSize: 18, color: '#1F2937', lineHeight: 20},
});
