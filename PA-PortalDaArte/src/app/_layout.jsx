import 'react-native-gesture-handler';
// app/_layout.jsx
import { useEffect } from 'react';
import { Slot, usePathname } from 'expo-router';


const URL_API = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';

function VisitanteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    // Visita anonima: sem IP em claro e sem identificacao pessoal (LGPD).
    fetch(`${URL_API}/api/visitas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rota: String(pathname || '/') }),
    }).catch(() => {});
  }, [pathname]);
  return null;
}

import VLibrasRoot from '../components/accessibility/VLibrasRoot';
import { ThemeProvider } from '../components/context/ThemeContext';
import { ProfileProvider } from '../components/context/ProfileContext';
import { AuthProvider, AuthGate } from '../components/context/AuthContext';
import { SearchProvider } from '../components/context/SearchContext';
import { FavoritesProvider } from '../components/context/FavoritesContext';
import { CartProvider } from '../components/context/CartContext';
import AuthModal from '../components/AuthModal';


import { AccessibilityProvider } from '../components/accessibility/AccessibilityContext';
export default function RootLayout() {
  return (
    // O ThemeProvider abraça o "Slot" (que é onde o Expo injeta suas telas)
    <VLibrasRoot>
      <AccessibilityProvider>
      <ThemeProvider>
        <ProfileProvider>
          <AuthProvider>
            <SearchProvider>
             <FavoritesProvider>
              <CartProvider>
              <VisitanteTracker />
              {/* AuthGate bloqueia as rotas privadas (inclusive acesso direto por URL) */}
              <AuthGate>
                <Slot />
              </AuthGate>
              {/* Aviso global para visitantes (abre via requireAuth / openAuthModal) */}
              <AuthModal />
              </CartProvider>
             </FavoritesProvider>
            </SearchProvider>
          </AuthProvider>
        </ProfileProvider>
      </ThemeProvider>
      </AccessibilityProvider>
    </VLibrasRoot>
  );
}
