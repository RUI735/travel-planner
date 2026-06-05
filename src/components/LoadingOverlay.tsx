import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors, Radius, FontSize } from '../../src/theme';

interface Props {
  visible: boolean;
}

export default function LoadingOverlay({ visible }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.overlay}>
      <View style={styles.box}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.text}>正在规划行程，预计需要 10-20 秒...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  box: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  text: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
