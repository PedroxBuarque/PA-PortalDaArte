import React, { useEffect, useState } from 'react';
import {
  DeviceEventEmitter,
  Image,
  Modal,
  Platform,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Bell,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  ShoppingBag,
  Sun,
  X,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';

import { AccessibleTextInput as TextInput } from './accessibility/AccessibleTextInput';
import { VLibrasText as Text } from './accessibility/VLibrasText';
import { useAuth } from './context/AuthContext';
import { useSearch } from './context/SearchContext';
import { useTheme } from './context/ThemeContext';
import { useCart } from './context/CartContext';
import { buildLoginHref, CART_ROUTE, DISCOVER_ROUTE, normalizePath, SETTINGS_ROUTE } from '../constants/auth-routes';
import { PRIMARY_NAV_ITEMS, SETTINGS_NAV_ITEM } from '../constants/navigation';
import BrandMark from './BrandMark';
import { DESKTOP_BREAKPOINT, SMALL_PHONE_BREAKPOINT } from '../constants/responsive';

export default function Header() {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isAvatarMenuVisible, setIsAvatarMenuVisible] = useState(false);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const [isNavigationVisible, setIsNavigationVisible] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState<any[]>([]);
  const [userName, setUserName] = useState('U');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const { width } = useWindowDimensions();
  const compact = width < DESKTOP_BREAKPOINT;
  const smallPhone = width < SMALL_PHONE_BREAKPOINT;
  const { query: searchText, setQuery: setSearchText } = useSearch();
  const { status, signOut } = useAuth();
  const { count: cartCount } = useCart();
  const isGuest = status === 'unauthenticated';
  const isAuthenticated = status === 'authenticated';
  const showBrand = !isAuthenticated || compact;
  const pathname = usePathname();
  const URL_API = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const { isLightMode, toggleTheme, theme } = useTheme();
  const styles = getStyles(theme, compact, smallPhone);

  const isActive = (item: { id: string; route: string }) =>
    pathname === item.route || pathname.includes(item.id);

  useEffect(() => {
    setIsNavigationVisible(false);
    setIsMenuVisible(false);
    setIsAvatarMenuVisible(false);
    setIsNotificationsVisible(false);
  }, [pathname]);

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
    if (daysAgo > 1 && daysAgo < 7) {
      return `${date.toLocaleDateString('pt-BR', { weekday: 'short' })}, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `${date.toLocaleDateString('pt-BR')} · ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  useEffect(() => {
    async function fetchHeaderUserData() {
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) return;
        const response = await fetch(`${URL_API}/api/perfis/me`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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

    void fetchHeaderUserData();
    const profileUpdatedSubscription = DeviceEventEmitter.addListener(
      'profileUpdated',
      (dados: { foto_perfil?: string | null; nome_completo?: string | null }) => {
        if (typeof dados.foto_perfil !== 'undefined') setProfileImage(dados.foto_perfil || null);
        if (dados.nome_completo) setUserName(dados.nome_completo.charAt(0).toUpperCase());
      }
    );
    return () => profileUpdatedSubscription.remove();
  }, [pathname, URL_API]);

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
            dataMensagem:
              conversation.ultima_mensagem_em || conversation.data_ultima_mensagem ||
              conversation.last_message_at || conversation.updated_at ||
              conversation.criado_em || conversation.created_at || null,
          }));
        if (active) setUnreadNotifications(unread);
      } catch (error) {
        console.error('Erro ao buscar notificações:', error);
      }
    };

    if (isAuthenticated) {
      void fetchUnreadNotifications();
      const interval = setInterval(fetchUnreadNotifications, 30000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }
    setUnreadNotifications([]);
    return () => { active = false; };
  }, [pathname, isAuthenticated, URL_API]);

  const isDiscoverScreen = normalizePath(pathname) === DISCOVER_ROUTE;
  const handleSearch = () => {
    if (!isDiscoverScreen) {
      router.push({ pathname: DISCOVER_ROUTE, params: { search: searchText.trim() } } as any);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setIsAvatarMenuVisible(false);
      router.replace('/pages/login/login');
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  const renderSearch = () => (
    <View style={[styles.searchBar, compact && styles.searchBarCompact]}>
      <Search size={18} color={theme.textSecondary} accessible={false} />
      <TextInput
        style={styles.searchInput}
        placeholder="Busque por artista, estilo, instrumento ou serviço..."
        placeholderTextColor={theme.textSecondary}
        value={searchText}
        onChangeText={setSearchText}
        onSubmitEditing={handleSearch}
        returnKeyType="search"
        accessibilityLabel="Buscar artistas por nome, estilo musical, instrumento ou serviço"
      />
    </View>
  );

  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      <View style={styles.topRow}>
        {showBrand ? (
          <TouchableOpacity
            onPress={() => router.navigate(DISCOVER_ROUTE as any)}
            activeOpacity={0.82}
            style={styles.brandSlot}
            accessibilityRole="link"
            accessibilityLabel="Portal da Arte, ir para Descobrir"
          >
            <BrandMark compact={compact} showTagline={!compact} />
          </TouchableOpacity>
        ) : null}

        {!compact ? renderSearch() : null}

        <View style={styles.rightIcons}>
          {compact && isAuthenticated ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setIsNavigationVisible(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Abrir navegação"
              accessibilityState={{ expanded: isNavigationVisible }}
            >
              <Menu size={20} color={theme.textPrimary} accessible={false} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push(CART_ROUTE as any)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={cartCount ? `Carrinho, ${cartCount} ${cartCount === 1 ? 'serviço' : 'serviços'}` : 'Carrinho vazio'}
            accessibilityHint="Abre os serviços selecionados para compra"
          >
            <ShoppingBag size={20} color={theme.textPrimary} accessible={false} />
            {cartCount > 0 ? (
              <View style={styles.cartBadge} accessible={false}>
                <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          {isAuthenticated ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setIsNotificationsVisible(true)}
              activeOpacity={0.8}
              accessibilityLabel={unreadNotifications.length ? 'Notificações, há mensagens não lidas' : 'Notificações'}
              accessibilityRole="button"
              accessibilityHint="Abre a lista de notificações"
              accessibilityState={{ expanded: isNotificationsVisible }}
            >
              <Bell size={20} color={theme.textSecondary} accessible={false} />
              {unreadNotifications.length > 0 ? <View style={styles.notificationDot} accessible={false} /> : null}
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setIsMenuVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Configurações"
            accessibilityHint="Abre o menu de configurações"
            accessibilityState={{ expanded: isMenuVisible }}
          >
            <Settings size={20} color={theme.textSecondary} accessible={false} />
          </TouchableOpacity>

          {isGuest ? (
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.push(buildLoginHref())}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Entrar"
              testID="header-login-button"
            >
              <LogIn size={16} color={theme.onAccent || '#FFFFFF'} accessible={false} />
              {!compact ? <Text style={styles.loginButtonText}>Entrar</Text> : null}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.userAvatar}
              onPress={() => setIsAvatarMenuVisible(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Menu da conta"
              accessibilityHint="Abre as opções da conta"
              accessibilityState={{ expanded: isAvatarMenuVisible }}
            >
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.userAvatarImage} accessible={false} />
              ) : (
                <Text style={styles.userAvatarText}>{userName}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {compact ? renderSearch() : null}

      <Modal visible={isNavigationVisible} transparent animationType="fade" onRequestClose={() => setIsNavigationVisible(false)}>
        <TouchableOpacity
          style={styles.drawerOverlay}
          activeOpacity={1}
          onPress={() => setIsNavigationVisible(false)}
          accessibilityRole="button"
          accessibilityLabel="Fechar navegação"
        >
          <TouchableOpacity style={styles.drawer} activeOpacity={1} onPress={() => undefined} accessible={false} accessibilityRole="none">
            <View style={styles.drawerHeader}>
              <View style={{ flex: 1 }}>
                <BrandMark inverse showTagline />
              </View>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setIsNavigationVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Fechar menu"
              >
                <X size={20} color={theme.sidebarText || theme.textPrimary} accessible={false} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.drawerList}>
              {PRIMARY_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.drawerItem, active && styles.drawerItemActive]}
                    onPress={() => {
                      setIsNavigationVisible(false);
                      router.navigate(item.route as any);
                    }}
                    accessibilityRole="link"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={[styles.drawerItemIcon, active && styles.drawerItemIconActive]} accessible={false}>
                      <Icon size={19} color={active ? (theme.sidebarActiveText || theme.textPrimary) : (theme.sidebarMuted || theme.textSecondary)} accessible={false} />
                    </View>
                    <Text style={[styles.drawerItemText, active && styles.drawerItemTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.drawerDivider} />
            <TouchableOpacity
              style={[styles.drawerItem, isActive(SETTINGS_NAV_ITEM) && styles.drawerItemActive]}
              onPress={() => {
                setIsNavigationVisible(false);
                router.navigate(SETTINGS_NAV_ITEM.route as any);
              }}
              accessibilityRole="link"
            >
              <View style={styles.drawerItemIcon} accessible={false}>
                <Settings size={19} color={theme.sidebarMuted || theme.textSecondary} accessible={false} />
              </View>
              <Text style={styles.drawerItemText}>Configurações</Text>
            </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isNotificationsVisible} transparent animationType="fade" onRequestClose={() => setIsNotificationsVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsNotificationsVisible(false)} accessibilityRole="button" accessibilityLabel="Fechar notificações">
          <TouchableOpacity activeOpacity={1} style={[styles.dropdownMenu, styles.notificationsMenu]} onPress={() => undefined} accessible={false} accessibilityRole="none">
            <View style={styles.notificationsHeader}>
              <View>
                <Text style={styles.dropdownTitle}>Notificações</Text>
                <Text style={styles.dropdownCaption}>{unreadNotifications.length ? 'Mensagens que precisam da sua atenção' : 'Tudo em dia por aqui'}</Text>
              </View>
              {unreadNotifications.length > 0 ? (
                <View style={styles.notificationCount}>
                  <Text style={styles.notificationCountText}>{unreadNotifications.length}</Text>
                </View>
              ) : null}
            </View>
            {unreadNotifications.length > 0 ? unreadNotifications.slice(0, 6).map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={styles.notificationItem}
                onPress={() => {
                  setIsNotificationsVisible(false);
                  router.push('/pages/mensagens/mensagens' as any);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${notification.nome}, ${notification.quantidade} mensagem${notification.quantidade > 1 ? 's' : ''} não lida${notification.quantidade > 1 ? 's' : ''}`}
              >
                <View style={styles.notificationBullet} accessible={false} />
                <View style={styles.notificationCopy}>
                  <View style={styles.notificationTitleRow}>
                    <Text style={styles.notificationTitle} numberOfLines={1}>{notification.nome}</Text>
                    <Text style={styles.notificationDate}>{formatNotificationDate(notification.dataMensagem)}</Text>
                  </View>
                  <Text style={styles.notificationSubtitle} numberOfLines={1}>
                    {notification.quantidade > 1 ? `${notification.quantidade} mensagens não lidas` : 'Uma mensagem não lida'}
                  </Text>
                </View>
              </TouchableOpacity>
            )) : (
              <View style={styles.emptyNotifications}>
                <Bell size={24} color={theme.textSecondary} accessible={false} />
                <Text style={styles.notificationSubtitle}>Você não tem notificações novas.</Text>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isMenuVisible} transparent animationType="fade" onRequestClose={() => setIsMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsMenuVisible(false)} accessibilityRole="button" accessibilityLabel="Fechar configurações">
          <TouchableOpacity activeOpacity={1} style={styles.dropdownMenu} onPress={() => undefined} accessible={false} accessibilityRole="none">
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setIsMenuVisible(false);
                router.push(SETTINGS_ROUTE as any);
              }}
              accessibilityRole="button"
              accessibilityLabel="Abrir configurações"
            >
              <View style={styles.iconWrapper} accessible={false}>
                <Settings size={18} color={theme.textPrimary} accessible={false} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownText}>Configurações</Text>
                <Text style={styles.dropdownCaption}>Acessibilidade e preferências</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => toggleTheme()}
              accessibilityRole="switch"
              accessibilityLabel={isLightMode ? 'Ativar modo escuro' : 'Ativar modo claro'}
              accessibilityState={{ checked: !isLightMode }}
            >
              <View style={styles.iconWrapper} accessible={false}>
                {isLightMode ? <Moon size={18} color={theme.textPrimary} accessible={false} /> : <Sun size={18} color={theme.textPrimary} accessible={false} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownText}>{isLightMode ? 'Modo escuro' : 'Modo claro'}</Text>
                <Text style={styles.dropdownCaption}>Alternar aparência do sistema</Text>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isAvatarMenuVisible} transparent animationType="fade" onRequestClose={() => setIsAvatarMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsAvatarMenuVisible(false)} accessibilityRole="button" accessibilityLabel="Fechar menu da conta">
          <TouchableOpacity activeOpacity={1} style={styles.accountMenu} onPress={() => undefined} accessible={false} accessibilityRole="none">
            <TouchableOpacity style={styles.dropdownItem} onPress={handleLogout} accessibilityRole="button" accessibilityLabel="Sair da conta">
              <View style={styles.iconWrapper} accessible={false}>
                <LogOut size={18} color={theme.danger || '#B42318'} accessible={false} />
              </View>
              <Text style={[styles.dropdownText, { color: theme.danger || '#B42318' }]}>Sair da conta</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any, compact: boolean, smallPhone: boolean) => StyleSheet.create({
  header: {
    minHeight: 72,
    backgroundColor: theme.headerBg,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
    justifyContent: 'center',
    zIndex: 50,
  },
  headerCompact: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 9 },
  topRow: {
    flexDirection: 'row',
    flexWrap: smallPhone ? 'wrap' : 'nowrap',
    alignItems: 'center',
    width: '100%',
    gap: 15,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  brandSlot: { flexShrink: 1, minWidth: 0, maxWidth: '100%', marginRight: compact ? 'auto' : 8 },
  searchBar: {
    flex: 1,
    maxWidth: 640,
    minWidth: compact ? 0 : 240,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceMuted || theme.searchBg,
    borderRadius: 14,
    paddingHorizontal: 15,
    height: 44,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  searchBarCompact: { width: '100%', maxWidth: '100%', minWidth: 0, height: 46, marginTop: 1 },
  searchInput: { flex: 1, marginLeft: 9, color: theme.textPrimary, fontSize: 13, minWidth: 0 },
  rightIcons: { flexDirection: 'row', alignItems: 'center', justifyContent: smallPhone ? 'space-between' : 'flex-end', width: smallPhone ? '100%' : undefined, gap: 7, marginLeft: smallPhone ? 0 : 'auto', minWidth: 0 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: theme.surfaceMuted || theme.cardBg,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  notificationDot: {
    position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: 4,
    backgroundColor: theme.accent, borderWidth: 1.5, borderColor: theme.headerBg,
  },
  cartBadge: {
    position: 'absolute', top: -4, right: -4, minWidth: 19, height: 19, borderRadius: 10,
    paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.accent, borderWidth: 2, borderColor: theme.cardBg,
  },
  cartBadgeText: { color: theme.onAccent || '#FFFFFF', fontSize: 9, lineHeight: 11, fontWeight: '900' },
  loginButton: {
    minHeight: 40,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: theme.accent, borderRadius: 13, paddingHorizontal: compact ? 12 : 16,
    ...Platform.select({ web: { boxShadow: `0 7px 18px ${theme.accentSoft || theme.shadowColor}` } }),
  },
  loginButtonText: { color: theme.onAccent || '#FFFFFF', fontWeight: '800', fontSize: 13 },
  userAvatar: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: theme.accent,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 2, borderColor: theme.cardBg,
  },
  userAvatarText: { color: theme.onAccent || '#FFFFFF', fontWeight: '800', fontSize: 14 },
  userAvatarImage: { width: '100%', height: '100%' },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlay || 'rgba(0,0,0,0.35)',
  },
  dropdownMenu: {
    position: 'absolute',
    top: smallPhone ? 180 : compact ? 118 : 66,
    right: compact ? 14 : 72,
    width: compact ? undefined : 240,
    left: compact ? 14 : undefined,
    backgroundColor: theme.cardBg,
    borderRadius: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: theme.borderColor,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: `0 16px 38px ${theme.shadowColor || 'rgba(0,0,0,0.16)'}` },
      default: { elevation: 12 },
    }),
  },
  notificationsMenu: { width: compact ? undefined : 340, maxWidth: compact ? undefined : 360, right: compact ? 14 : 118 },
  accountMenu: {
    position: 'absolute', top: smallPhone ? 180 : compact ? 118 : 66, right: compact ? 14 : 26,
    width: compact ? 210 : 220, backgroundColor: theme.cardBg, borderRadius: 14,
    paddingVertical: 7, borderWidth: 1, borderColor: theme.borderColor,
    ...Platform.select({ web: { boxShadow: `0 16px 38px ${theme.shadowColor || 'rgba(0,0,0,0.16)'}` }, default: { elevation: 12 } }),
  },
  notificationsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.borderColor,
  },
  dropdownTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: '800' },
  dropdownCaption: { color: theme.textSecondary, fontSize: 10, marginTop: 2, lineHeight: 14 },
  notificationCount: {
    minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent,
  },
  notificationCountText: { color: theme.onAccent || '#FFFFFF', fontSize: 11, fontWeight: '800' },
  notificationItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.borderColor,
  },
  notificationBullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent },
  notificationCopy: { flex: 1, gap: 3, minWidth: 0 },
  notificationTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  notificationDate: { color: theme.textSecondary, fontSize: 9, flexShrink: 0 },
  notificationTitle: { color: theme.textPrimary, fontSize: 12, fontWeight: '700', flex: 1 },
  notificationSubtitle: { color: theme.textSecondary, fontSize: 11, lineHeight: 16 },
  emptyNotifications: { paddingHorizontal: 18, paddingVertical: 24, alignItems: 'center', gap: 8 },
  dropdownItem: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, gap: 11 },
  iconWrapper: {
    width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.surfaceMuted || theme.mainBg,
  },
  dropdownText: { color: theme.textPrimary, fontSize: 13, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.borderColor, marginHorizontal: 12 },
  drawerOverlay: { flex: 1, backgroundColor: theme.overlay || 'rgba(0,0,0,0.42)', justifyContent: 'flex-start', alignItems: 'flex-start' },
  drawer: {
    width: '84%', maxWidth: 330, height: '100%', backgroundColor: theme.sidebarBg,
    paddingHorizontal: 16, paddingTop: 22, paddingBottom: 24,
    borderRightWidth: 1, borderRightColor: theme.borderColor,
    ...Platform.select({ web: { boxShadow: `10px 0 32px ${theme.shadowColor || 'rgba(0,0,0,0.18)'}` }, default: { elevation: 16 } }),
  },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 5, marginBottom: 24 },
  drawerTitle: { color: theme.sidebarText || theme.textPrimary, fontSize: 22, fontWeight: '900', fontFamily: 'serif' },
  drawerSubtitle: { color: theme.sidebarMuted || theme.textSecondary, fontSize: 11, marginTop: 2 },
  drawerScroll: { flex: 1, minHeight: 0 },
  drawerScrollContent: { flexGrow: 1, paddingBottom: 16 },
  drawerList: { gap: 6 },
  drawerItem: {
    minHeight: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9,
    borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
  },
  drawerItemActive: { backgroundColor: theme.sidebarActiveBg || theme.menuActiveBg, borderColor: theme.sidebarActiveBg || theme.borderColor },
  drawerItemIcon: {
    width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.sidebarSurface || theme.surfaceMuted, marginRight: 11,
  },
  drawerItemIconActive: { backgroundColor: theme.accentSoft || theme.mainBg },
  drawerItemText: { color: theme.sidebarMuted || theme.textSecondary, fontSize: 14, fontWeight: '600' },
  drawerItemTextActive: { color: theme.sidebarActiveText || theme.textPrimary, fontWeight: '800' },
  drawerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.sidebarBorder || theme.borderColor, marginVertical: 14 },
});
