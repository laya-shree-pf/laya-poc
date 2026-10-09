import {useMemo} from 'react';
import {useWindowDimensions, View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {DakeyChat} from './src';

export default function App() {
  // Expo web's #root only has min-height: 100%, so give the chat a fixed height
  // or it grows with the answer and pushes the composer off-screen.
  const {height} = useWindowDimensions();
  const containerStyle = useMemo(() => ({height, width: '100%' as const}), [height]);

  return (
    <View style={containerStyle}>
      <DakeyChat />
      <StatusBar style="auto" />
    </View>
  );
}
