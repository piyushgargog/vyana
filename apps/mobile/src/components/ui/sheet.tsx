import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { T } from '@/constants/theme';
import { Symbol } from './symbol';
import { Text } from './text';

/**
 * A sheet for actions and short forms: the native iOS page sheet (Liquid Glass on iOS 26), a slide-up panel on
 * Android. Closes with the close button, a swipe down (iOS) or the back button (Android).
 */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'} transparent={Platform.OS !== 'ios'}>
      <View style={Platform.OS === 'ios' ? styles.iosRoot : styles.androidRoot}>
        {Platform.OS !== 'ios' && (
          <Pressable
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.backdrop}
            onPress={onClose}
          />
        )}
        <View style={styles.panel}>
          <View style={styles.grabber} accessibilityElementsHidden importantForAccessibility="no" />
          <View style={styles.header}>
            <Text variant="title3" accessibilityRole="header">
              {title}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12} style={styles.close}>
              <Symbol ios="xmark" android="close" size={14} color={T.color.label2} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  iosRoot: { flex: 1, backgroundColor: T.color.canvas },
  androidRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  panel: {
    flexShrink: 1,
    maxHeight: Platform.OS === 'ios' ? undefined : '88%',
    flex: Platform.OS === 'ios' ? 1 : undefined,
    backgroundColor: T.color.canvas,
    borderTopLeftRadius: T.radius.feature,
    borderTopRightRadius: T.radius.feature,
  },
  backdrop: { flex: 1 },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: T.color.fillStrong,
    marginTop: T.space.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: T.space.lg },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.color.fill, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: T.space.lg, paddingBottom: T.space.xxl, gap: T.space.lg },
});
