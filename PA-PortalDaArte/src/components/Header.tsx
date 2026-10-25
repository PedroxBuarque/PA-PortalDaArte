import React, { useEffect, useState } from 'react';
import { 
  Image,
  DeviceEventEmitter,
  StyleSheet, 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text,
  Modal
} from 'react-native';
import { Search, Bell, Settings, Sun, Moon, LogOut, LogIn } from 'lucide-react-native';
import { useTheme } from './context/ThemeContext';
import { useWindowDimensions } from 'react-native';
import { useAuth } from './context/AuthContext';
import { useSearch } from './context/SearchContext';
import { buildLoginHref, DISCOVER_ROUTE, normalizePath } from '../constants/auth-routes';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';

export default function Header() {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isAvatarMenuVisible, setIsAvatarMenuVisible] = useState(false);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState<any[]>([]);
  const [userName, setUserName] = useState('U');
  
  // O texto da pesquisa é compartilhado via contexto: digitar não navega nem remonta o campo,
  // e o campo continua mostrando o mesmo texto que filtra a lista de Descobrir.
  const { query: searchText, setQuery: setSearchText } = useSearch();
  const { status, signOut } = useAuth();
  // Visitante confirmado (durante o carregamento inicial da sessão o botão da conta não troca de forma).
  const isGuest = status === 'unauthenticated';
  // Sem sessão não há Sidebar (onde fica a marca), então o Header mostra a logo à esquerda.
  const showBrand = status !== 'authenticated';
  const compact = useWindowDimensions().width < 900;
  const [profileImage, setProfileImage] = useState(null);
  const pathname = usePathname();
  const URL_API = process.env.EXPO_PUBLIC_API_URL || "http://10.0.0.142:8000";

  const { isLightMode, toggleTheme, theme } = useTheme();
  
  const styles = getStyles(theme);

  const formatNotificationDate = (rawDate: any) => {
    if (!rawDate) return 'Data indisponível';
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return 'Data indisponível';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const daysAgo = Math.round((today.getTime() - messageDay.getTime()) / 86400000);
    if (daysAgo === 0) return `Hoje, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    if (daysAgo === 1) return `Ontem, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    if (daysAgo > 1 && daysAgo < 7) return `${date.toLocaleDateString('pt-BR', { weekday: 'short' })}, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    return `${date.toLocaleDateString('pt-BR')} · ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Busca os dados do usuário ao abrir o header/trocar de tela e escuta alterações salvas no perfil.
  useEffect(() => {
    async function fetchHeaderUserData() {
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) return;

        const response = await fetch(`${URL_API}/api/perfis/me`, {
          method: 'GET',
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const result = await response.json();
        if (response.ok && result.dados) {
          const dados = result.dados;
          const nomeCompleto = dados.nome_completo || dados.email || 'U';
          setUserName(nomeCompleto.charAt(0).toUpperCase());
          setProfileImage(dados.foto_perfil || null);
        }
      } catch (error) {
        console.error('Erro ao buscar dados do header:', error);
      }
    }
    fetchHeaderUserData();

    const profileUpdatedSubscription = DeviceEventEmitter.addListener(
      'profileUpdated',
      (dados: { foto_perfil?: string | null; nome_completo?: string | null }) => {
        if (typeof dados.foto_perfil !== 'undefined') {
          setProfileImage(dados.foto_perfil || null);
        }
        if (dados.nome_completo) {
          setUserName(dados.nome_completo.charAt(0).toUpperCase());
        }
      }
    );

    return () => profileUpdatedSubscription.remove();
  }, [pathname]);

  // Busca conversas com mensagens não lidas para alimentar o marcador e o dropdown.
  useEffect(() => {
    let active = true;

    const fetchUnreadNotifications = async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) {
          if (active) setUnreadNotifications([]);
          return;
        }

        const response = await fetch(`${URL_API}/api/conversas`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) return;
        const result = await response.json();
        const conversations = Array.isArray(result.conversas) ? result.conversas : [];
        const unread = conversations
          .filter((conversation: any) => Number(conversation.nao_lidas) > 0)
          .map((conversation: any) => ({
            id: String(conversation.id),
            nome: conversation.nome || 'Nova mensagem',
            quantidade: Number(conversation.nao_lidas),
            dataMensagem: conversation.ultima_mensagem_em || conversation.data_ultima_mensagem || conversation.last_message_at || conversation.updated_at || conversation.criado_em || conversation.created_at || null,
          }));
        if (active) setUnreadNotifications(unread);
      } catch (error) {
        console.error('Erro ao buscar notificações:', error);
      }
    };

    fetchUnreadNotifications();
    const interval = setInterval(fetchUnreadNotifications, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [pathname]);

  // A lista de Descobrir filtra em tempo real a partir do contexto; aqui não há navegação por tecla.
  const isDiscoverScreen = normalizePath(pathname) === DISCOVER_ROUTE;

  const handleSearchChange = (text: string) => {
    setSearchText(text);
  };

  const handleSearch = () => {
    // Enter fora de Descobrir leva para lá com o termo pesquisado (dentro dela a lista já está filtrada).
    if (!isDiscoverScreen) {
      router.push({
        pathname: DISCOVER_ROUTE,
        params: { search: searchText.trim() },
      } as any);
    }
  };

  const handleLogout = async () => {
    try {
      // Limpa access_token, refresh_token e usuário (antes só o access_token era removido).
      await signOut();
      setIsMenuVisible(false);
      setIsAvatarMenuVisible(false);
      router.replace('/pages/login/login');
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  return (
    <View style={styles.header}>
      {showBrand && (
        <View style={[styles.brandSlot, compact && styles.brandSlotCompact]}>
          <TouchableOpacity
            onPress={() => router.navigate(DISCOVER_ROUTE as any)}
            activeOpacity={0.8}
            accessibilityRole="link"
            accessibilityLabel="Portal da Arte, ir para Descobrir"
          >
            <Text style={[styles.brandTitle, compact && styles.brandTitleCompact]} numberOfLines={1}>
              Portal da Arte
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.searchBar, showBrand && compact && styles.searchBarCompact]}>
        <Search size={18} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Busque por artista, estilo musical, instrumento ou serviço..."
          placeholderTextColor={theme.textSecondary}
          value={searchText}
          onChangeText={handleSearchChange}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          accessibilityLabel="Buscar artistas por nome, estilo musical, instrumento ou serviço"
        />
      </View>

      <View style={[styles.rightIcons, showBrand && !compact && styles.rightIconsWithBrand]}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setIsNotificationsVisible(!isNotificationsVisible)}
          activeOpacity={0.8}
          accessibilityLabel={unreadNotifications.length ? 'Notificações, há mensagens não lidas' : 'Notificações'}
        >
          <Bell size={20} color={theme.textSecondary} />
          {unreadNotifications.length > 0 && <View style={styles.notificationDot} />}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => setIsMenuVisible(!isMenuVisible)}
          activeOpacity={0.8}
        >
          <Settings size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        {isGuest ? (
          // Visitante: botão "Entrar" leva direto à tela de login.
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push(buildLoginHref())}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Entrar"
            testID="header-login-button"
          >
            <LogIn size={16} color="#FFFFFF" />
            {!compact && <Text style={styles.loginButtonText}>Entrar</Text>}
          </TouchableOpacity>
        ) : (
          /* Botão da Foto de Perfil com Abertura de Menu */
          <TouchableOpacity 
            style={styles.userAvatar}
            onPress={() => setIsAvatarMenuVisible(!isAvatarMenuVisible)}
            activeOpacity={0.8}
          >
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.userAvatarImage}
              />
            ) : (
              <Text style={styles.userAvatarText}>{userName}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Dropdown de notificações */}
      <Modal
        visible={isNotificationsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsNotificationsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsNotificationsVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.dropdownMenu, styles.notificationsMenu]}>
            <View style={styles.notificationsHeader}>
              <Text style={[styles.dropdownText, { fontWeight: '700' }]}>Notificações</Text>
              {unreadNotifications.length > 0 && (
                <View style={styles.notificationCount}>
                  <Text style={styles.notificationCountText}>{unreadNotifications.length}</Text>
                </View>
              )}
            </View>
            {unreadNotifications.length > 0 ? unreadNotifications.slice(0, 6).map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={styles.notificationItem}
                onPress={() => {
                  setIsNotificationsVisible(false);
                  router.push('/pages/mensagens/mensagens' as any);
                }}
              >
                <View style={styles.notificationBullet} />
                <View style={styles.notificationCopy}>
                  <View style={styles.notificationTitleRow}>
                    <Text style={styles.notificationTitle} numberOfLines={1}>Você tem mensagens não lidas</Text>
                    <Text style={styles.notificationDate}>{formatNotificationDate(notification.dataMensagem)}</Text>
                  </View>
                  <Text style={styles.notificationSubtitle} numberOfLines={1}>
                    {notification.nome}{notification.quantidade > 1 ? ` · ${notification.quantidade} mensagens` : ' enviou uma mensagem'}
                  </Text>
                </View>
              </TouchableOpacity>
            )) : (
              <View style={styles.emptyNotifications}>
                <Text style={styles.notificationSubtitle}>Você não tem notificações novas.</Text>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Menu da Engrenagem */}
      <Modal
        visible={isMenuVisible}
        transparent={true}
        animationType="none"
        onRequestClose={() => setIsMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsMenuVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.dropdownMenu}>
            <TouchableOpacity 
              style={styles.dropdownItem} 
              onPress={() => setIsMenuVisible(false)}
            >
              <View style={styles.iconWrapper}>
                <Settings size={18} color={theme.textPrimary} />
              </View>
              <Text style={styles.dropdownText}>Configurações</Text>
            </TouchableOpacity>
            
            <View style={styles.divider} />
            
            <TouchableOpacity 
              style={styles.dropdownItem} 
              onPress={() => toggleTheme()}
            >
              <View style={styles.iconWrapper}>
                {isLightMode ? (
                  <Moon size={18} color={theme.textPrimary} />
                ) : (
                  <Sun size={18} color={theme.textPrimary} />
                )}
              </View>
              <Text style={styles.dropdownText}>
                {isLightMode ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Menu da Foto de Perfil (Deslogar) */}
      <Modal
        visible={isAvatarMenuVisible}
        transparent={true}
        animationType="none"
        onRequestClose={() => setIsAvatarMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsAvatarMenuVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.dropdownMenu, { right: 32 }]}>
            <TouchableOpacity 
              style={styles.dropdownItem} 
              onPress={handleLogout}
            >
              <View style={styles.iconWrapper}>
                <LogOut size={18} color="#E05A10" />
              </View>
              <Text style={[styles.dropdownText, { color: '#E05A10' }]}>
                Sair da conta
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
    backgroundColor: theme.headerBg, 
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.searchBg,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 40,
    width: '50%',
    maxWidth: 450,
    borderWidth: 1,
    borderColor: theme.borderColor, 
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: theme.textPrimary,
    fontSize: 13,
  },
  brandSlot: {
    flex: 1,
    alignItems: 'flex-start',
  },
  brandSlotCompact: {
    flex: 0,
    marginRight: 12,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.textPrimary,
    fontFamily: "'Fraunces', serif",
  },
  brandTitleCompact: {
    fontSize: 18,
  },
  searchBarCompact: {
    flex: 1,
    width: undefined,
    marginRight: 12,
  },
  rightIconsWithBrand: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  iconButton: {
    padding: 4,
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E05A10',
    borderWidth: 1.5,
    borderColor: theme.headerBg,
  },
  notificationsMenu: {
    width: 300,
    maxWidth: 340,
    right: 92,
    paddingVertical: 4,
  },
  notificationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  notificationCount: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E05A10',
  },
  notificationCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  notificationBullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E05A10',
  },
  notificationCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  notificationDate: {
    color: theme.textSecondary,
    fontSize: 10,
    flexShrink: 0,
  },
  notificationTitle: {
    color: theme.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  notificationSubtitle: {
    color: theme.textSecondary,
    fontSize: 11,
  },
  emptyNotifications: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    overflow: 'hidden',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.accent,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginLeft: 4,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 60,
    right: 75,
    backgroundColor: theme.cardBg,
    borderRadius: 8,
    width: 200,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 8,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownText: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: theme.borderColor,
    marginVertical: 4,
  }
});