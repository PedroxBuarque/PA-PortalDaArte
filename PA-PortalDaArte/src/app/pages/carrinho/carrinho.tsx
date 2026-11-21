import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { CheckCircle2, ChevronLeft, LockKeyhole, ShoppingBag, Trash2, Undo2 } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';
import { DESKTOP_BREAKPOINT, SMALL_PHONE_BREAKPOINT } from '../../../constants/responsive';
import { VLibrasText as Text } from '../../../components/accessibility/VLibrasText';
import { useCart, type CartItem } from '../../../components/context/CartContext';
import { useAuth } from '../../../components/context/AuthContext';
import { useTheme } from '../../../components/context/ThemeContext';
import { buildLoginHref, CART_ROUTE, DISCOVER_ROUTE } from '../../../constants/auth-routes';

const URL_API = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const money = (value: number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function confirmAction(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.confirm(`${title}\n\n${message}`);
  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export default function CarrinhoScreen() {
  const { theme, isLightMode } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < DESKTOP_BREAKPOINT;
  const narrowPhone = width < SMALL_PHONE_BREAKPOINT;
  const { status } = useAuth();
  const authenticated = status === 'authenticated';
  const { items, total, count, removeItem, restoreItem, clearCart, hydrated } = useCart();
  const params = useLocalSearchParams<{ checkout?: string | string[]; pedido?: string | string[] }>();
  const [lastRemoved, setLastRemoved] = useState<CartItem | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [orderState, setOrderState] = useState<string>('');
  const autoCheckoutStarted = useRef(false);
  const styles = getStyles(theme, compact, narrowPhone);

  const checkoutParam = Array.isArray(params.checkout) ? params.checkout[0] : params.checkout;
  const orderParam = Array.isArray(params.pedido) ? params.pedido[0] : params.pedido;

  const groupedArtists = useMemo(() => new Set(items.map((item) => item.artistId)).size, [items]);

  useEffect(() => {
    if (!authenticated || !orderParam) return;
    let active = true;
    let attempts = 0;
    const load = async () => {
      attempts += 1;
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) return;
        const response = await fetch(`${URL_API}/api/carrinho/pedidos/${encodeURIComponent(orderParam)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!active || !response.ok) return;
        const state = String(payload?.pedido?.status || '');
        setOrderState(state);
        if (state === 'pago') {
          clearCart();
          setStatusMessage('Pagamento confirmado. Seus serviços já aparecem em Contratações.');
        } else if (state === 'cancelado') {
          setStatusMessage('O checkout foi cancelado. Seu carrinho continua salvo.');
        } else if (state === 'expirado') {
          setStatusMessage('O checkout expirou. Você pode iniciar um novo pagamento sem perder o carrinho.');
        } else if (checkoutParam === 'success') {
          setStatusMessage('Pagamento enviado. Estamos aguardando a confirmação financeira do Asaas.');
        }
      } catch {
        // A tela continua utilizável mesmo que a confirmação esteja temporariamente indisponível.
      }
    };
    void load();
    const interval = setInterval(() => {
      if (!active || attempts >= 10 || orderState === 'pago') return;
      void load();
    }, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [authenticated, orderParam, checkoutParam, orderState, clearCart]);

  const remove = (serviceId: number) => {
    const removed = removeItem(serviceId);
    if (removed) {
      setLastRemoved(removed);
      setStatusMessage(`${removed.serviceTitle} foi removido do carrinho.`);
    }
  };

  const undoRemove = () => {
    if (!lastRemoved) return;
    restoreItem(lastRemoved);
    setStatusMessage(`${lastRemoved.serviceTitle} voltou para o carrinho.`);
    setLastRemoved(null);
  };

  const emptyCart = async () => {
    if (!items.length) return;
    if (!(await confirmAction('Limpar carrinho?', 'Todos os serviços selecionados serão removidos.'))) return;
    clearCart();
    setLastRemoved(null);
    setStatusMessage('Carrinho limpo.');
  };

  const startCheckout = async () => {
    if (!items.length || checkoutLoading) return;
    if (!authenticated) {
      router.push(buildLoginHref(`${CART_ROUTE}?checkout=1`));
      return;
    }

    setCheckoutLoading(true);
    setStatusMessage('Preparando um checkout seguro com todos os serviços...');
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        router.push(buildLoginHref(`${CART_ROUTE}?checkout=1`));
        return;
      }
      const response = await fetch(`${URL_API}/api/carrinho/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ servico_ids: items.map((item) => item.serviceId) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.detail || 'Não foi possível iniciar o pagamento.');
      const checkoutUrl = String(payload?.checkout_url || '');
      if (!checkoutUrl) throw new Error('O provedor de pagamento não retornou um endereço de checkout.');
      setStatusMessage('Checkout criado. Você será direcionado para o pagamento seguro do Asaas.');
      if (payload?.pedido_id) {
        router.setParams({ pedido: String(payload.pedido_id), checkout: undefined } as any);
      }
      await Linking.openURL(checkoutUrl);
    } catch (error: any) {
      setStatusMessage(error?.message || 'Não foi possível iniciar o pagamento. Tente novamente.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  useEffect(() => {
    if (!authenticated || !hydrated || !items.length || checkoutParam !== '1' || autoCheckoutStarted.current) return;
    autoCheckoutStarted.current = true;
    void startCheckout();
  }, [authenticated, hydrated, items.length, checkoutParam]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme.statusBarStyle || (isLightMode ? 'dark-content' : 'light-content')} backgroundColor={theme.headerBg} />
      <View style={styles.dashboard}>
        {!compact && authenticated ? <Sidebar /> : null}
        <View style={styles.rightArea}>
          <Header />
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.pageShell}>
              <TouchableOpacity style={styles.backLink} onPress={() => router.push(DISCOVER_ROUTE as any)} accessibilityRole="link">
                <ChevronLeft size={17} color={theme.accent} accessible={false} />
                <Text style={styles.backLinkText}>Continuar explorando</Text>
              </TouchableOpacity>

              <View style={styles.hero}>
                <View style={styles.heroIcon}><ShoppingBag size={24} color={theme.onAccent || '#FFFFFF'} accessible={false} /></View>
                <View style={styles.heroCopy}>
                  <Text style={styles.eyebrow}>SELEÇÃO DE SERVIÇOS</Text>
                  <Text style={styles.title}>Seu carrinho, sem pressa.</Text>
                  <Text style={styles.subtitle}>Adicione serviços mesmo sem conta. Você só precisa entrar quando decidir pagar.</Text>
                </View>
                <View style={styles.heroMetric}>
                  <Text style={styles.heroMetricNumber}>{count}</Text>
                  <Text style={styles.heroMetricLabel}>{count === 1 ? 'serviço' : 'serviços'}</Text>
                </View>
              </View>

              {statusMessage ? (
                <View style={[styles.feedback, orderState === 'pago' && styles.feedbackSuccess]} accessibilityLiveRegion="polite">
                  {orderState === 'pago' ? <CheckCircle2 size={18} color={theme.success || '#16794B'} accessible={false} /> : null}
                  <Text style={styles.feedbackText}>{statusMessage}</Text>
                  {lastRemoved ? (
                    <TouchableOpacity style={styles.undoButton} onPress={undoRemove} accessibilityRole="button">
                      <Undo2 size={15} color={theme.accent} accessible={false} />
                      <Text style={styles.undoText}>Desfazer</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              {!hydrated ? (
                <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Carregando seu carrinho...</Text></View>
              ) : items.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}><ShoppingBag size={26} color={theme.accent} accessible={false} /></View>
                  <Text style={styles.emptyTitle}>Seu carrinho está vazio</Text>
                  <Text style={styles.emptyText}>Explore artistas, abra um serviço de preço fixo e adicione-o aqui para pagar tudo de uma vez.</Text>
                  <TouchableOpacity style={styles.primaryButton} onPress={() => router.push(DISCOVER_ROUTE as any)} accessibilityRole="button">
                    <Text style={styles.primaryButtonText}>Descobrir artistas</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.contentGrid, compact && styles.contentGridCompact]}>
                  <View style={styles.itemsColumn}>
                    <View style={styles.sectionHeader}>
                      <View>
                        <Text style={styles.sectionTitle}>Serviços escolhidos</Text>
                        <Text style={styles.sectionSubtitle}>{groupedArtists} {groupedArtists === 1 ? 'artista' : 'artistas'} no pedido</Text>
                      </View>
                      <TouchableOpacity onPress={emptyCart} accessibilityRole="button" style={styles.clearButton}>
                        <Text style={styles.clearButtonText}>Limpar carrinho</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.itemsList}>
                      {items.map((item) => (
                        <View key={item.serviceId} style={styles.itemCard}>
                          <View style={styles.serviceAvatar}>
                            <Text style={styles.serviceAvatarText}>{item.artistName.slice(0, 1).toUpperCase()}</Text>
                          </View>
                          <View style={styles.itemCopy}>
                            <Text style={styles.itemArtist}>{item.artistName}</Text>
                            <Text style={styles.itemTitle}>{item.serviceTitle}</Text>
                            {item.description ? <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text> : null}
                            {item.modality ? <Text style={styles.itemMeta}>{item.modality === 'ambos' ? 'Presencial ou remoto' : item.modality === 'remoto' ? 'Remoto' : 'Presencial'}</Text> : null}
                          </View>
                          <View style={styles.itemRight}>
                            <Text style={styles.itemPrice}>{money(item.price)}</Text>
                            <TouchableOpacity style={styles.removeButton} onPress={() => remove(item.serviceId)} accessibilityRole="button" accessibilityLabel={`Remover ${item.serviceTitle} do carrinho`}>
                              <Trash2 size={17} color={theme.danger || '#B42318'} accessible={false} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryEyebrow}>RESUMO</Text>
                    <Text style={styles.summaryTitle}>Pagamento único</Text>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Serviços</Text><Text style={styles.summaryValue}>{count}</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Taxas extras</Text><Text style={styles.summaryValue}>R$ 0,00</Text></View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.totalRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{money(total)}</Text></View>
                    <Text style={styles.summaryHelp}>O valor é recalculado no servidor antes do checkout para impedir preços alterados no dispositivo.</Text>

                    <TouchableOpacity
                      style={[styles.checkoutButton, checkoutLoading && styles.checkoutButtonDisabled]}
                      onPress={startCheckout}
                      disabled={checkoutLoading}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: checkoutLoading, busy: checkoutLoading }}
                    >
                      {authenticated ? <ShoppingBag size={18} color={theme.onAccent || '#FFFFFF'} accessible={false} /> : <LockKeyhole size={18} color={theme.onAccent || '#FFFFFF'} accessible={false} />}
                      <Text style={styles.checkoutButtonText}>{checkoutLoading ? 'Preparando...' : authenticated ? 'Pagar tudo de uma vez' : 'Entrar para pagar'}</Text>
                    </TouchableOpacity>
                    {!authenticated ? <Text style={styles.loginHint}>Seu carrinho fica salvo. O login só é solicitado no pagamento.</Text> : <Text style={styles.loginHint}>Pagamento processado em página segura do Asaas.</Text>}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: any, compact: boolean, narrowPhone: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.mainBg },
  dashboard: { flex: 1, flexDirection: 'row', backgroundColor: theme.mainBg },
  rightArea: { flex: 1, minWidth: 0 },
  scrollContent: { flexGrow: 1, paddingBottom: 54 },
  pageShell: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: compact ? 14 : 28, paddingTop: compact ? 18 : 26 },
  backLink: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, marginBottom: 10 },
  backLinkText: { color: theme.accent, fontSize: 13, fontWeight: '800' },
  hero: {
    minHeight: compact ? 0 : 178, borderRadius: compact ? 22 : 30, backgroundColor: theme.heroBg || theme.textPrimary,
    padding: compact ? 20 : 28, flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'flex-start' : 'center', gap: compact ? 16 : 20,
    overflow: 'hidden', ...Platform.select({ web: { boxShadow: `0 18px 46px ${theme.shadowStrong || theme.shadowColor}` } }),
  },
  heroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flexGrow: 1, flexShrink: 1, minWidth: 0, maxWidth: 680 },
  eyebrow: { color: theme.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.7, marginBottom: 7 },
  title: { color: theme.heroText || '#FFFFFF', fontSize: compact ? 27 : 34, lineHeight: compact ? 32 : 39, fontFamily: 'serif', fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: theme.heroMuted || '#E6D8CF', fontSize: 13, lineHeight: 20, marginTop: 8, maxWidth: 610 },
  heroMetric: { minWidth: 100, alignItems: compact ? 'flex-start' : 'center', padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  heroMetricNumber: { color: theme.heroText || '#FFFFFF', fontSize: 28, fontFamily: 'serif', fontWeight: '900' },
  heroMetricLabel: { color: theme.heroMuted || '#E6D8CF', fontSize: 10, marginTop: 2 },
  feedback: { marginTop: 16, minHeight: 48, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 15, backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.borderColor, flexDirection: 'row', alignItems: 'center', gap: 9 },
  feedbackSuccess: { borderColor: theme.success || '#16794B' },
  feedbackText: { color: theme.textPrimary, flex: 1, fontSize: 12, lineHeight: 18 },
  undoButton: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, paddingHorizontal: 9 },
  undoText: { color: theme.accent, fontWeight: '800', fontSize: 12 },
  contentGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 24, marginTop: 24 },
  contentGridCompact: { flexDirection: 'column', gap: 18 },
  itemsColumn: { flex: 1, minWidth: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 13 },
  sectionTitle: { color: theme.textPrimary, fontSize: 21, fontFamily: 'serif', fontWeight: '900' },
  sectionSubtitle: { color: theme.textSecondary, fontSize: 11, marginTop: 3 },
  clearButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 11 },
  clearButtonText: { color: theme.danger || '#B42318', fontSize: 11, fontWeight: '800' },
  itemsList: { gap: 11 },
  itemCard: { backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 20, padding: compact ? 14 : 17, flexDirection: narrowPhone ? 'column' : 'row', alignItems: narrowPhone ? 'stretch' : 'center', gap: 13, ...Platform.select({ web: { boxShadow: `0 8px 24px ${theme.shadowColor}` } }) },
  serviceAvatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSoft || theme.menuActiveBg, borderWidth: 1, borderColor: theme.borderColor },
  serviceAvatarText: { color: theme.accent, fontSize: 19, fontFamily: 'serif', fontWeight: '900' },
  itemCopy: { flex: 1, minWidth: 0 },
  itemArtist: { color: theme.textSecondary, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  itemTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 3 },
  itemDescription: { color: theme.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 4 },
  itemMeta: { color: theme.accent, fontSize: 10, fontWeight: '700', marginTop: 5 },
  itemRight: { alignItems: 'flex-end', width: narrowPhone ? '100%' : undefined, flexDirection: narrowPhone ? 'row' : 'column', justifyContent: narrowPhone ? 'space-between' : 'center', gap: 9 },
  itemPrice: { color: theme.textPrimary, fontSize: compact ? 13 : 15, fontWeight: '900' },
  removeButton: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted || theme.mainBg },
  summaryCard: { width: compact ? '100%' : 330, flexShrink: 0, backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 24, padding: 20, ...Platform.select({ web: { boxShadow: `0 14px 34px ${theme.shadowColor}` } }) },
  summaryEyebrow: { color: theme.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  summaryTitle: { color: theme.textPrimary, fontSize: 20, fontFamily: 'serif', fontWeight: '900', marginTop: 5, marginBottom: 18 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel: { color: theme.textSecondary, fontSize: 12 },
  summaryValue: { color: theme.textPrimary, fontSize: 12, fontWeight: '800' },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.borderColor, marginVertical: 8 },
  totalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'baseline', marginTop: 5 },
  totalLabel: { color: theme.textPrimary, fontSize: 14, fontWeight: '800' },
  totalValue: { color: theme.accent, fontSize: 23, fontFamily: 'serif', fontWeight: '900' },
  summaryHelp: { color: theme.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 10, marginBottom: 16 },
  checkoutButton: { minHeight: 52, borderRadius: 16, backgroundColor: theme.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  checkoutButtonDisabled: { opacity: 0.58 },
  checkoutButtonText: { color: theme.onAccent || '#FFFFFF', fontSize: 13, fontWeight: '900' },
  loginHint: { color: theme.textSecondary, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 10 },
  emptyCard: { marginTop: 24, minHeight: 300, borderRadius: 26, borderWidth: 1, borderColor: theme.borderColor, backgroundColor: theme.cardBg, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyIcon: { width: 58, height: 58, borderRadius: 19, backgroundColor: theme.accentSoft || theme.menuActiveBg, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  emptyTitle: { color: theme.textPrimary, fontFamily: 'serif', fontSize: 21, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: theme.textSecondary, fontSize: 12, lineHeight: 19, textAlign: 'center', maxWidth: 460, marginTop: 8, marginBottom: 18 },
  primaryButton: { minHeight: 46, borderRadius: 14, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryButtonText: { color: theme.onAccent || '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
