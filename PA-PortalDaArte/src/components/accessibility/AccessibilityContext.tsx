import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { AccessibilityInfo } from 'react-native';

export const FONT_SCALE_OPTIONS = [1, 1.25, 1.5, 1.75, 2] as const;
export type FontScale = (typeof FONT_SCALE_OPTIONS)[number];

type AccessibilitySettings = {
  fontScale: FontScale;
  highContrast: boolean;
  readingSpacing: boolean;
};

type AccessibilityContextValue = AccessibilitySettings & {
  loaded: boolean;
  screenReaderEnabled: boolean;
  setFontScale: (scale: FontScale) => void;
  setHighContrast: (enabled: boolean) => void;
  setReadingSpacing: (enabled: boolean) => void;
  announce: (message: string) => void;
  resetAccessibility: () => void;
};

// Mantemos a mesma chave para preservar preferências salvas pelas versões anteriores.
const STORAGE_KEY = '@portal_da_arte:accessibility_settings_v1';
const DEFAULT_SETTINGS: AccessibilitySettings = {
  fontScale: 1,
  highContrast: false,
  readingSpacing: false,
};

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

function isFontScale(value: unknown): value is FontScale {
  return FONT_SCALE_OPTIONS.includes(value as FontScale);
}

function sanitizeSettings(value: unknown): AccessibilitySettings {
  const parsed = value && typeof value === 'object'
    ? (value as Partial<AccessibilitySettings>)
    : {};

  return {
    fontScale: isFontScale(parsed.fontScale) ? parsed.fontScale : DEFAULT_SETTINGS.fontScale,
    highContrast: typeof parsed.highContrast === 'boolean' ? parsed.highContrast : DEFAULT_SETTINGS.highContrast,
    readingSpacing: typeof parsed.readingSpacing === 'boolean' ? parsed.readingSpacing : DEFAULT_SETTINGS.readingSpacing,
  };
}

export function AccessibilityProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULT_SETTINGS);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active) return;
        setSettings(raw ? sanitizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS);
      } catch (error) {
        console.warn('[Acessibilidade] Não foi possível carregar as preferências:', error);
        if (active) setSettings(DEFAULT_SETTINGS);
      } finally {
        if (active) setLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (active) setScreenReaderEnabled(Boolean(enabled));
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (enabled) => setScreenReaderEnabled(Boolean(enabled))
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const persist = useCallback(async (next: AccessibilitySettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('[Acessibilidade] Não foi possível salvar as preferências:', error);
    }
  }, []);

  const updateSettings = useCallback(
    (updater: (current: AccessibilitySettings) => AccessibilitySettings) => {
      setSettings((current) => {
        const next = sanitizeSettings(updater(current));
        void persist(next);
        return next;
      });
    },
    [persist]
  );

  const announce = useCallback((message: string) => {
    const normalized = message.trim();
    if (!normalized) return;
    try {
      AccessibilityInfo.announceForAccessibility(normalized);
    } catch {
      // Alguns runtimes web não implementam anúncio programático; nesse caso,
      // accessibilityLiveRegion continua informando as mudanças de interface.
    }
  }, []);

  const setFontScale = useCallback(
    (fontScale: FontScale) => {
      updateSettings((current) => ({ ...current, fontScale }));
      if (screenReaderEnabled) {
        announce(`Tamanho da fonte alterado para ${Math.round(fontScale * 100)} por cento.`);
      }
    },
    [announce, screenReaderEnabled, updateSettings]
  );

  const setHighContrast = useCallback(
    (highContrast: boolean) => {
      updateSettings((current) => ({ ...current, highContrast }));
      if (screenReaderEnabled) announce(`Alto contraste ${highContrast ? 'ativado' : 'desativado'}.`);
    },
    [announce, screenReaderEnabled, updateSettings]
  );

  const setReadingSpacing = useCallback(
    (readingSpacing: boolean) => {
      updateSettings((current) => ({ ...current, readingSpacing }));
      if (screenReaderEnabled) {
        announce(`Espaçamento de leitura ampliado ${readingSpacing ? 'ativado' : 'desativado'}.`);
      }
    },
    [announce, screenReaderEnabled, updateSettings]
  );

  const resetAccessibility = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    void persist(DEFAULT_SETTINGS);
    if (screenReaderEnabled) announce('Configurações de acessibilidade restauradas para o padrão.');
  }, [announce, persist, screenReaderEnabled]);

  const value = useMemo<AccessibilityContextValue>(
    () => ({
      ...settings,
      loaded,
      screenReaderEnabled,
      setFontScale,
      setHighContrast,
      setReadingSpacing,
      announce,
      resetAccessibility,
    }),
    [
      settings,
      loaded,
      screenReaderEnabled,
      setFontScale,
      setHighContrast,
      setReadingSpacing,
      announce,
      resetAccessibility,
    ]
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility deve ser usado dentro de AccessibilityProvider.');
  }
  return context;
}
