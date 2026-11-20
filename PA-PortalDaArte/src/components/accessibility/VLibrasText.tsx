import React, { useMemo, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  Text as RNText,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { useVLibrasTouchableWrapper } from 'react-native-vlibras';
import { useAccessibility } from './AccessibilityContext';

function textFromNode(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join('');
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return textFromNode(props.children);
  }
  return '';
}

function accessibilityTextStyle(style: TextProps['style'], fontScale: number, readingSpacing: boolean): TextStyle | undefined {
  if (fontScale === 1 && !readingSpacing) return undefined;

  const flat = StyleSheet.flatten(style) || {};
  const baseFontSize = typeof flat.fontSize === 'number' ? flat.fontSize : 14;
  const scaledFontSize = baseFontSize * fontScale;
  const baseLineHeight = typeof flat.lineHeight === 'number' ? flat.lineHeight : baseFontSize * 1.25;
  const scaledLineHeight = baseLineHeight * fontScale;

  const result: TextStyle & { wordSpacing?: number } = {
    ...(fontScale !== 1 ? { fontSize: scaledFontSize } : null),
    lineHeight: readingSpacing ? Math.max(scaledLineHeight, scaledFontSize * 1.6) : scaledLineHeight,
    ...(readingSpacing
      ? { letterSpacing: Math.max(typeof flat.letterSpacing === 'number' ? flat.letterSpacing : 0, scaledFontSize * 0.04) }
      : null),
  };

  if (readingSpacing && Platform.OS === 'web') {
    result.wordSpacing = scaledFontSize * 0.08;
  }

  return result;
}

/**
 * Text do Portal da Arte no runtime nativo.
 * Mantém VLibras, respeita a escala tipográfica e o espaçamento de leitura ampliado.
 */
export function VLibrasText({ children, onPress, style, ...props }: TextProps) {
  const text = useMemo(() => textFromNode(children).trim(), [children]);
  const ref = useRef<any>(null);
  const { fontScale, readingSpacing } = useAccessibility();

  const wrapped = useVLibrasTouchableWrapper({ ref, text, onPress });
  const scaledStyle = useMemo(
    () => accessibilityTextStyle(style, fontScale, readingSpacing),
    [fontScale, readingSpacing, style]
  );

  return (
    <RNText
      {...props}
      style={[style, scaledStyle]}
      ref={wrapped.ref as any}
      onPress={text ? wrapped.onPress : onPress}
    >
      {children}
    </RNText>
  );
}
