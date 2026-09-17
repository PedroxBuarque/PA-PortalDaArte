import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import {
  Compass,
  Heart,
  Calendar,
  MessageSquare,
  User,
} from 'lucide-react-native';
import { router, usePathname } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from './context/ThemeContext';

export const MENU_ITEMS = [
  { id: 'explorar', label: 'Explorar', icon: Compass, route: '/pages/explorar/explorar' },
  { id: 'favoritos', label: 'Favoritos', icon: Heart, route: '/pages/favoritos/favoritos' },
  { id: 'contratacoes', label: 'Contratações', icon: Calendar, route: '/pages/contratacoes/contratacoes' },
  { id: 'mensagens', label: 'Mensagens', icon: MessageSquare, route: '/pages/mensagens/mensagens' },
  { id: 'perfil', label: 'Perfil', icon: User, route: '/pages/perfil/perfil' },
];

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 160,
  mass: 0.8,
};

export default function Sidebar() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const pathname = usePathname();

  const [layouts, setLayouts] = useState({});
  const isFirstRender = useRef(true);

  // Pega a rota ativa atual
  const activeIndex = MENU_ITEMS.findIndex(
    (item) => pathname === item.route || pathname.includes(item.id)
  );

  // Valores compartilhados mantendo a posição exata
  const translateY = useSharedValue(0);
  const activeHeight = useSharedValue(0);
  const activeOpacity = useSharedValue(0);

  const handleLayout = (id, event) => {
    const { y, height } = event.nativeEvent.layout;
    setLayouts((prev) => ({
      ...prev,
      [id]: { y, height },
    }));
  };

  useEffect(() => {
    if (activeIndex !== -1) {
      const activeItem = MENU_ITEMS[activeIndex];
      const layout = layouts[activeItem.id];

      if (layout) {
        if (isFirstRender.current) {
          // Na primeira renderização posiciona sem animação para evitar salto
          translateY.value = layout.y;
          activeHeight.value = layout.height;
          activeOpacity.value = 1;
          isFirstRender.current = false;
        } else {
          // Nas navegações seguintes faz a transição contínua e fluida
          translateY.value = withSpring(layout.y, SPRING_CONFIG);
          activeHeight.value = withSpring(layout.height, SPRING_CONFIG);
          activeOpacity.value = withTiming(1, { duration: 150 });
        }
      }
    }
  }, [pathname, layouts, activeIndex]);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    height: activeHeight.value,
    opacity: activeOpacity.value,
  }));

  const handleNavigation = (item) => {
    if (item.route) {
      router.navigate(item.route);
    }
  };

  return (
    <View style={styles.sidebar}>
      <TouchableOpacity
        onPress={() => router.navigate('/')}
        activeOpacity={0.8}
        style={styles.brandContainer}
      >
        <Text style={styles.brandTitle}>Portal da Arte</Text>
      </TouchableOpacity>

      <View style={styles.menuList}>
        {/* Pílula Laranja Deslizante */}
        <Animated.View
          style={[styles.animatedBackground, animatedIndicatorStyle]}
        />

        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.route || pathname.includes(item.id);

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onLayout={(e) => handleLayout(item.id, e)}
              onPress={() => handleNavigation(item)}
              activeOpacity={0.7}
            >
              <Icon
                size={18}
                color={isActive ? theme.accent : theme.textSecondary}
                style={styles.menuIcon}
              />
              <Text style={[styles.menuText, isActive && styles.menuTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    sidebar: {
      width: 220,
      backgroundColor: theme.sidebarBg,
      paddingVertical: 28,
      paddingHorizontal: 20,
      borderRightWidth: 1,
      borderRightColor: theme.borderColor,
    },
    brandContainer: {
      marginBottom: 20,
      alignItems: 'flex-start',
    },
    brandTitle: {
      fontSize: 30,
      fontWeight: '900',
      color: theme.textPrimary,
      fontFamily: "'Fraunces', serif",
      fontVariationSettings: "'opsz' 9, 'wght' 900",
      textAlign: 'left',
    },
    menuList: {
      gap: 8,
      position: 'relative',
    },
    animatedBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.menuActiveBg,
      borderRadius: 8,
      zIndex: 0,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      zIndex: 1,
    },
    menuIcon: {
      marginRight: 12,
    },
    menuText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    menuTextActive: {
      color: theme.accent,
      fontWeight: '600',
    },
  });