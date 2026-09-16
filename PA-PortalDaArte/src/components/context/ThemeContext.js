// src/context/ThemeContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform, UIManager, LayoutAnimation } from 'react-native';

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
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Começa no modo claro (true) ou escuro (false)
  const [isLightMode, setIsLightMode] = useState(true); 

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

    setIsLightMode((prev) => !prev);
  };
  
  // Variável que guarda o pacote de cores atual
  const theme = isLightMode ? lightTheme : darkTheme;

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