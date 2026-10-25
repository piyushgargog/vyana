import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { T } from '@/constants/theme';

/**
 * The one text input for every screen (#558): surface background, hairline
 * border, row radius, body text and a 46pt minimum height, so a field looks
 * the same wherever it appears. A screen passes only its genuine extras
 * (flex, centre alignment, multiline padding) through `style`.
 */
export function TextField({ style, placeholderTextColor, ...rest }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={placeholderTextColor ?? T.color.label3}
      style={[styles.input, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: T.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.lg,
    minHeight: 46,
    ...T.text.body,
    color: T.color.label,
  },
});
