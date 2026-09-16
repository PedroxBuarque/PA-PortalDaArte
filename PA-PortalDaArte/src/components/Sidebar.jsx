import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import {
  Compass,
  Heart,
  Calendar,
  MessageSquare,
  User,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from './context/ThemeContext';

export const MENU_ITEMS = [
  { id: 'explorar', label: 'Explorar', icon: Compass, route: '/explorar' },
  { id: 'favoritos', label: 'Favoritos', icon: Heart, route: '/' }, 
  { id: 'contratacoes', label: 'Contratações', icon: Calendar, route: '/contratacoes' },
  { id: 'mensagens', label: 'Mensagens', icon: MessageSquare, route: '/mensagens' },
  { id: 'perfil', label: 'Perfil', icon: User, route: '/perfil' },
];

export default function Sidebar({ activeRoute }) {
  // Puxando o tema atual
  const { theme } = useTheme();
  
  // Gerando os estilos baseados no tema
  const styles = getStyles(theme);

  const handleNavigation = (item) => {
    if (item.route && activeRoute !== item.id) {
      router.push(item.route);
    }
  };

  return (
    <View style={styles.sidebar}>
      
      {/* TÍTULO CLICÁVEL COM ESPAÇAMENTO AJUSTADO */}
      <TouchableOpacity 
        onPress={() => router.push('/')} 
        activeOpacity={0.8}
        style={styles.brandContainer}
      >
        <Text style={styles.brandTitle}>Portal da Arte</Text>
      </TouchableOpacity>

      <View style={styles.menuList}>
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;

          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, isActive && styles.menuItemActive]}
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

// Estilos dinâmicos
const getStyles = (theme) => StyleSheet.create({
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
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  menuItemActive: {
    backgroundColor: theme.menuActiveBg,
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