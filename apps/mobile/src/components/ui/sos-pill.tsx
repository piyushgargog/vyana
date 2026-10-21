import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { T } from '@/constants/theme';
import { Text } from './text';

/**
 * The SOS button beside every tab's large title: one tap to the emergency screen.
 * One component for all five tabs (#241), so the label and the look are fixed in one place.
 */
export function SosPill() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open SOS emergency help"
      onPress={() => router.push('/sos')}
      style={styles.btn}
    >
      <Text variant="footnote" tone="danger" style={styles.text}>
        SOS 108
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: T.color.dangerSoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: T.radius.pill,
    minHeight: 44,
    justifyContent: 'center',
  },
  text: { fontWeight: '700' },
});
