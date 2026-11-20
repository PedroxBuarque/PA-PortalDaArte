import React from 'react';
import { StyleSheet, View } from 'react-native';
import { VLibrasText as Text } from './accessibility/VLibrasText';
import { useTheme } from './context/ThemeContext';

type Props = {
  compact?: boolean;
  inverse?: boolean;
  showTagline?: boolean;
};

export default function BrandMark({ compact = false, inverse = false, showTagline = true }: Props) {
  const { theme } = useTheme();
  const styles = getStyles(theme, compact, inverse);

  return (
    <View style={styles.root} accessible={false}>
      <View style={styles.mark}>
        <View style={styles.markAccent} />
        <Text style={styles.markText}>P·A</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={1}>Portal da Arte</Text>
        {showTagline && !compact ? (
          <Text style={styles.tagline} numberOfLines={1}>arte que encontra oportunidade</Text>
        ) : null}
      </View>
    </View>
  );
}

const getStyles = (theme: any, compact: boolean, inverse: boolean) => StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: compact ? 9 : 11,
    minWidth: 0,
  },
  mark: {
    width: compact ? 34 : 42,
    height: compact ? 34 : 42,
    borderRadius: compact ? 17 : 21,
    backgroundColor: inverse ? theme.accent : (theme.brandMarkBg || theme.accent),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: inverse ? (theme.sidebarBorder || theme.borderColor) : theme.borderColor,
  },
  markAccent: {
    position: 'absolute',
    width: compact ? 17 : 22,
    height: compact ? 17 : 22,
    borderRadius: 999,
    backgroundColor: inverse ? (theme.sidebarSurface || theme.accentSoft) : (theme.accentSoft || theme.mainBg),
    right: compact ? -4 : -5,
    bottom: compact ? -4 : -5,
    opacity: 1,
  },
  markText: {
    color: theme.onAccent || '#FFFFFF',
    fontSize: compact ? 11 : 13,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  copy: { minWidth: 0 },
  name: {
    color: inverse ? (theme.sidebarText || '#FFFFFF') : theme.textPrimary,
    fontFamily: 'serif',
    fontSize: compact ? 16 : 20,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  tagline: {
    marginTop: 2,
    color: inverse ? (theme.sidebarMuted || 'rgba(255,255,255,0.65)') : theme.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.35,
  },
});
