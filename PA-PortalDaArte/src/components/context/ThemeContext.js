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
  sidebarBg: '#FFFFFF',
  mainBg: '#FFF0E6', // Aquele fundo creme elegante
  headerBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  textPrimary: '#2D1B13', // Marrom escuro para o título
  textSecondary: '#8B7A73', // Cinza/Marrom claro
  accent: '#E05A10', // Laranja
  searchBg: '#F5EBE4',
  borderColor: '#E8DCD3',
  menuActiveBg: '#FFF0E6',
  sendBtnBg: '#b91010',
  backgroundColor: '#b91010',
};

// Aqui as cores do modo escuro que você já usava
export const darkTheme = {
  sidebarBg: '#0F172A',
  mainBg: '#131C2E',
  headerBg: '#0F172A',
  cardBg: '#0F172A',
  textPrimary: '#FFFFFF',
  textSecondary: '#8A99AD',
  accent: '#FF6500',
  searchBg: '#0B101D',
  borderColor: '#1A263D',
  menuActiveBg: '#1E1B2B',
  sendBtnBg: '#ce3d11',
  backgroundColor: '#ce3d11'
};

export const highContrastTheme = {
  sidebarBg: '#FFFFFF',
  mainBg: '#FFFFFF',
  headerBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#1F2937',
  accent: '#003B73',
  searchBg: '#FFFFFF',
  borderColor: '#000000',
  menuActiveBg: '#E6F0FF',
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
      `;
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ isLightMode, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook personalizado para facilitar o uso nas telas
export const useTheme = () => useContext(ThemeContext);