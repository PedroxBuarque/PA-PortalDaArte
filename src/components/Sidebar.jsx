import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { PRIMARY_NAV_ITEMS, SETTINGS_NAV_ITEM } from '../constants/navigation';
import { useTheme } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';
import { VLibrasText as Text } from './accessibility/VLibrasText';
import BrandMark from './BrandMark';
import { PressMotion, StatePulse } from './animations/Motion';

export const MENU_ITEMS = PRIMARY_NAV_ITEMS;

export default function Sidebar() {
  const { theme } = useTheme();
  const { status, requireAuth } = useAuth();
  const pathname = usePathname();
  const styles = getStyles(theme);

  const isActive = (item) => pathname === item.route || pathname.includes(item.id);

  const handleNavigation = (item) => {
    if (!item?.route) return;
    if (item.private && status !== 'authenticated') {
      requireAuth(() => router.navigate(item.route), item.route);
      return;
    }
    router.navigate(item.route);
  };

  const renderItem = (item) => {
    const Icon = item.icon;
    const active = isActive(item);
    return (
      <PressMotion
        key={item.id}
        style={[styles.menuItem, active && styles.menuItemActive]}
        onPress={() => handleNavigation(item)}
        accessibilityRole="link"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
      >
        <StatePulse active={active} style={[styles.iconContainer, active && styles.iconContainerActive]}>
          <Icon
            size={18}
            color={active ? (theme.sidebarActiveText || theme.textPrimary) : (theme.sidebarMuted || theme.textSecondary)}
            accessible={false}
          />
        </StatePulse>
        <Text style={[styles.menuText, active && styles.menuTextActive]}>{item.label}</Text>
        {active ? <View style={styles.activeDot} accessible={false} /> : null}
      </PressMotion>
    );
  };

  return (
    <View style={styles.sidebar} accessibilityLabel="Navegação principal">
      <PressMotion
        onPress={() => router.navigate('/pages/explorar/explorar')}
        style={styles.brandContainer}
        accessibilityRole="link"
        accessibilityLabel="Portal da Arte, ir para Descobrir"
      >
        <BrandMark inverse />
      </PressMotion>

      <Text style={styles.sectionLabel}>EXPLORAR</Text>
      <View style={styles.menuList}>{PRIMARY_NAV_ITEMS.map(renderItem)}</View>

      <View style={styles.spacer} />

      <View style={styles.studioCard} accessible={false}>
        <View style={styles.studioIcon}>
          <Sparkles size={15} color={theme.artGold || '#B94A0A'} accessible={false} />
        </View>
        <Text style={styles.studioEyebrow}>FEITO NO BRASIL</Text>
        <Text style={styles.studioTitle}>Arte encontra oportunidade.</Text>
        <Text style={styles.studioCopy}>Um espaço para descobrir, contratar e valorizar trabalho artístico.</Text>
      </View>

      <View style={styles.footerDivider} />
      <View style={styles.footerMenu}>{renderItem(SETTINGS_NAV_ITEM)}</View>
    </View>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    sidebar: {
      width: 236,
      backgroundColor: theme.sidebarBg,
      paddingTop: 22,
      paddingBottom: 16,
      paddingHorizontal: 14,
      borderRightWidth: 1,
      borderRightColor: theme.sidebarBorder || theme.borderColor,
      ...Platform.select({ web: { boxShadow: `5px 0 20px ${theme.shadowColor}` } }),
    },
    brandContainer: {
      paddingHorizontal: 7,
      paddingVertical: 6,
      marginBottom: 24,
      alignItems: 'flex-start',
    },
    sectionLabel: {
      paddingHorizontal: 12,
      marginBottom: 9,
      color: theme.sidebarMuted || theme.textSecondary,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.6,
      opacity: 0.9,
    },
    menuList: { gap: 4 },
    menuItem: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'transparent',
      position: 'relative',
    },
    menuItemActive: {
      backgroundColor: theme.sidebarActiveBg || theme.menuActiveBg,
      borderColor: theme.borderColor,
      borderLeftWidth: 3,
      borderLeftColor: theme.accent,
    },
    iconContainer: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.sidebarSurface || theme.surfaceMuted,
      marginRight: 10,
    },
    iconContainerActive: { backgroundColor: theme.accentSoft || theme.menuActiveBg },
    menuText: {
      flex: 1,
      fontSize: 13.5,
      color: theme.sidebarMuted || theme.textSecondary,
      fontWeight: '600',
    },
    menuTextActive: {
      color: theme.sidebarActiveText || theme.textPrimary,
      fontWeight: '800',
    },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.accent,
      marginRight: 5,
    },
    spacer: { flex: 1 },
    studioCard: {
      marginTop: 16,
      padding: 13,
      borderRadius: 14,
      backgroundColor: theme.sidebarSurface || '#F7EEE8',
      borderWidth: 1,
      borderColor: theme.sidebarBorder || theme.borderColor,
    },
    studioIcon: {
      width: 29,
      height: 29,
      borderRadius: 10,
      backgroundColor: theme.accentSoft || theme.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    studioEyebrow: {
      color: theme.artGold || '#B94A0A',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.3,
      marginBottom: 5,
    },
    studioTitle: {
      color: theme.sidebarText || '#FFFFFF',
      fontFamily: 'serif',
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '900',
    },
    studioCopy: {
      color: theme.sidebarMuted || '#6F625C',
      fontSize: 10,
      lineHeight: 15,
      marginTop: 6,
    },
    footerDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.sidebarBorder || theme.borderColor,
      marginVertical: 13,
    },
    footerMenu: { gap: 6 },
  });
