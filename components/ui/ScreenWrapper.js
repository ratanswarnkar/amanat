import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

export default function ScreenWrapper({
  children,
  backgroundColor = colors.background,
  statusBarStyle = 'light',
  edges = ['top', 'left', 'right', 'bottom'],
  contentStyle = undefined,
  topOffset = 0,
}) {
  const insets = useSafeAreaInsets();
  const resolvedPaddingTop = topOffset + (edges.includes('top') ? 0 : insets.top);

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <StatusBar style={statusBarStyle} backgroundColor={backgroundColor} translucent={false} />
      <SafeAreaView edges={edges} style={[styles.safeArea, { backgroundColor }]}>
        <View style={[styles.content, { paddingTop: resolvedPaddingTop }, contentStyle]}>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
