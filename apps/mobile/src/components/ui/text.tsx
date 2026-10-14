import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { T } from '@/constants/theme';

export type TextVariant = keyof typeof T.text;
type Tone = 'label' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'ok' | 'warn' | 'white';

const TONES: Record<Tone, string> = {
  label: T.color.label,
  secondary: T.color.label2,
  tertiary: T.color.label3,
  accent: T.color.accentStrong,
  danger: T.color.dangerText,
  ok: T.color.ok,
  warn: T.color.warn,
  white: T.color.white,
};

/** Text in the iOS type scale: `variant` sets size and weight, `tone` the colour. */
export function Text({ variant = 'body', tone = 'label', style, ...rest }: TextProps & { variant?: TextVariant; tone?: Tone }) {
  return <RNText style={[T.text[variant] as TextStyle, { color: TONES[tone] }, style]} {...rest} />;
}
