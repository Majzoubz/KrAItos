import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

/**
 * Renders "KrAItos" with "AI" highlighted in lime green and the rest
 * inheriting the surrounding text style (which is theme-aware).
 *
 * Works both standalone (provide a `style` prop) and inline inside
 * another <Text>, since React Native nests Text styles by default.
 */
export default function BrandName({ style, accentColor }) {
  const { C } = useTheme();
  return (
    <Text style={style}>
      Kr<Text style={{ color: accentColor || C.green }}>AI</Text>tos
    </Text>
  );
}
