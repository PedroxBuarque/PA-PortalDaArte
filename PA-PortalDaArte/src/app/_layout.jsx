// app/_layout.jsx
import { Slot } from 'expo-router';
import { ThemeProvider } from '../components/context/ThemeContext';
import { ProfileProvider } from '../components/context/ProfileContext';
import { AuthProvider, AuthGate } from '../components/context/AuthContext';
import { SearchProvider } from '../components/context/SearchContext';
import { FavoritesProvider } from '../components/context/FavoritesContext';
import AuthModal from '../components/AuthModal';

export default function RootLayout() {
  return (
    // O ThemeProvider abraça o "Slot" (que é onde o Expo injeta suas telas)
    <ThemeProvider>
      <ProfileProvider>
        <AuthProvider>
          <SearchProvider>
           <FavoritesProvider>
            {/* AuthGate bloqueia as rotas privadas (inclusive acesso direto por URL) */}
            <AuthGate>
              <Slot />
            </AuthGate>
            {/* Aviso global para visitantes (abre via requireAuth / openAuthModal) */}
            <AuthModal />
           </FavoritesProvider>
          </SearchProvider>
        </AuthProvider>
      </ProfileProvider>
    </ThemeProvider>
  );
}
