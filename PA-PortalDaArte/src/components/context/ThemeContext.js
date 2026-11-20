// src/context/ThemeContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, UIManager, LayoutAnimation } from 'react-native';
import { useAccessibility } from '../accessibility/AccessibilityContext';

// Ativa o LayoutAnimation no Android (necessário para versões antigas)
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Aqui definimos as cores da imagem que você mandou!
export const lightTheme = {
  statusBarStyle: 'dark-content',
  sidebarBg: '#FFFFFF',
  sidebarText: '#2D1B13',
  sidebarMuted: '#6F625C',
  sidebarSurface: '#F7EEE8',
  sidebarActiveBg: '#FFF0E6',
  sidebarActiveText: '#2D1B13',
  sidebarBorder: '#E6D8CF',
  brandMarkBg: '#B94A0A',
  mainBg: '#FAF5F1',
  headerBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  surfaceMuted: '#F7EEE8',
  surfaceRaised: '#FFFFFF',
  textPrimary: '#2D1B13',
  textSecondary: '#6F625C',
  accent: '#B94A0A',
  accentHover: '#8F3907',
  accentSoft: '#FBE8DC',
  onAccent: '#FFFFFF',
  artGold: '#B94A0A',
  artRose: '#6F625C',
  artPlum: '#2D1B13',
  heroBg: '#FFF0E6',
  heroText: '#2D1B13',
  heroMuted: '#6F625C',
  searchBg: '#F8F1EC',
  borderColor: '#E6D8CF',
  menuActiveBg: '#FFF0E6',
  focusRing: '#8F3907',
  success: '#16794B',
  warning: '#A15C00',
  danger: '#B42318',
  overlay: 'rgba(31, 20, 15, 0.42)',
  shadowColor: 'rgba(45, 27, 19, 0.08)',
  shadowStrong: 'rgba(45, 27, 19, 0.14)',
  sendBtnBg: '#B94A0A',
  backgroundColor: '#B94A0A',
};

export const darkTheme = {
  statusBarStyle: 'light-content',
  sidebarBg: '#0E1728',
  sidebarText: '#F8FAFC',
  sidebarMuted: '#B6C1D0',
  sidebarSurface: '#1B283D',
  sidebarActiveBg: '#2A201E',
  sidebarActiveText: '#F8FAFC',
  sidebarBorder: '#2B3950',
  brandMarkBg: '#C65316',
  mainBg: '#111A2B',
  headerBg: '#0E1728',
  cardBg: '#151F32',
  surfaceMuted: '#1B283D',
  surfaceRaised: '#182438',
  textPrimary: '#F8FAFC',
  textSecondary: '#B6C1D0',
  accent: '#C65316',
  accentHover: '#FFB184',
  accentSoft: '#3B241C',
  onAccent: '#FFFFFF',
  artGold: '#C65316',
  artRose: '#B6C1D0',
  artPlum: '#2B3950',
  heroBg: '#0E1728',
  heroText: '#F8FAFC',
  heroMuted: '#B6C1D0',
  searchBg: '#0B1322',
  borderColor: '#2B3950',
  menuActiveBg: '#2A201E',
  focusRing: '#FFB184',
  success: '#5FD09A',
  warning: '#F5B95F',
  danger: '#FF8D85',
  overlay: 'rgba(0, 0, 0, 0.60)',
  shadowColor: 'rgba(0, 0, 0, 0.24)',
  shadowStrong: 'rgba(0, 0, 0, 0.34)',
  sendBtnBg: '#C65316',
  backgroundColor: '#C65316',
};

export const highContrastTheme = {
  statusBarStyle: 'dark-content',
  sidebarBg: '#FFFFFF',
  sidebarText: '#000000',
  sidebarMuted: '#111111',
  sidebarSurface: '#F2F2F2',
  sidebarActiveBg: '#E6F0FF',
  sidebarActiveText: '#000000',
  sidebarBorder: '#000000',
  brandMarkBg: '#003B73',
  mainBg: '#FFFFFF',
  headerBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  surfaceMuted: '#F2F2F2',
  surfaceRaised: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#111111',
  accent: '#003B73',
  accentHover: '#003B73',
  accentSoft: '#DCEBFF',
  onAccent: '#FFFFFF',
  artGold: '#003B73',
  artRose: '#111111',
  artPlum: '#000000',
  heroBg: '#000000',
  heroText: '#FFFFFF',
  heroMuted: '#FFFFFF',
  searchBg: '#FFFFFF',
  borderColor: '#000000',
  menuActiveBg: '#E6F0FF',
  focusRing: '#000000',
  success: '#005A2B',
  warning: '#6B3E00',
  danger: '#8B0000',
  overlay: 'rgba(0, 0, 0, 0.65)',
  shadowColor: 'rgba(0, 0, 0, 0)',
  shadowStrong: 'rgba(0, 0, 0, 0)',
  sendBtnBg: '#003B73',
  backgroundColor: '#003B73',
};

const ThemeContext = createContext();
const THEME_STORAGE_KEY = '@portal_da_arte:theme_mode_v1';

export const ThemeProvider = ({ children }) => {
  const { highContrast } = useAccessibility();
  // Começa no modo claro e restaura a preferência salva quando houver.
  const [isLightMode, setIsLightMode] = useState(true);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (!active) return;
        if (saved === 'light') setIsLightMode(true);
        if (saved === 'dark') setIsLightMode(false);
      })
      .catch((error) => console.warn('[Tema] Não foi possível carregar a preferência:', error));
    return () => { active = false; };
  }, []);

  const toggleTheme = () => {
    // Configura a animação fluida para dispositivos móveis (Android/iOS)
    LayoutAnimation.configureNext({
      duration: 400, // Duração de 400ms
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });

    setIsLightMode((prev) => {
      const next = !prev;
      void AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'light' : 'dark').catch((error) =>
        console.warn('[Tema] Não foi possível salvar a preferência:', error)
      );
      return next;
    });
  };
  
  // Variável que guarda o pacote de cores atual
  const theme = highContrast ? highContrastTheme : (isLightMode ? lightTheme : darkTheme);

  // Injeta uma transição CSS global na Web para que a troca de cores seja suave no navegador
  useEffect(() => {
    if (Platform.OS === 'web') {
      const styleId = 'global-theme-transition';
      let styleElement = document.getElementById(styleId);

      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }

      styleElement.innerHTML = `
        *, *:before, *:after {
          transition: background-color 0.4s ease, color 0.4s ease, border-color 0.4s ease, fill 0.4s ease, stroke 0.4s ease !important;
        }

        *:focus-visible {
          outline: 3px solid ${theme.focusRing} !important;
          outline-offset: 3px !important;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *:before, *:after {
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `;
    }
  }, [theme.focusRing]);

  return (
    <ThemeContext.Provider value={{ isLightMode, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook personalizado para facilitar o uso nas telas
export const useTheme = () => useContext(ThemeContext);