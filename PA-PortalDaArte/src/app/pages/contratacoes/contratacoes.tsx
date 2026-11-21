import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { CalendarDays, Music } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import CardContratacao, { type Contratacao } from '../../../components/contratacoes/CardContratacao';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';
import { DESKTOP_BREAKPOINT, SMALL_PHONE_BREAKPOINT } from '../../../constants/responsive';
import { useTheme } from '../../../components/context/ThemeContext';
import { VLibrasText as Text } from '../../../components/accessibility/VLibrasText';
import {
  formatarDataProposta,
  formatarMoeda,
  listarPropostas,
  statusPropostaLabel,
  type PropostaApi,
} from '../../../services/contratacoes';

type Filtro = 'Todas' | 'Pendente' | 'Confirmado' | 'Concluído' | 'Recusada' | 'Expirada';
const FILTROS: Filtro[] = ['Todas', 'Pendente', 'Confirmado', 'Concluído', 'Recusada', 'Expirada'];

function toCard(item: PropostaApi): Contratacao {
  const nome = item.artista_nome;
  const category = item.papel_atual === 'artista'
    ? `Solicitado por ${item.contratante_nome}` : 'Artista';
  const rating = (item.avaliacoes_total || 0) > 0 && Number.isFinite(Number(item.avaliacao_media))
    ? `★ ${Number(item.avaliacao_media).toFixed(1).replace('.', ',')} / 5 (${item.avaliacoes_total} avaliações)`
    : 'Sem avaliações registradas';
  return {
    id: String(item.id),
    name: nome,
    category,
    title: item.servico_titulo || item.descricao_escopo,
    value: formatarMoeda(item.valor_proposto),
    rating,
    date: item.prazo_estimado
      ? `Prazo previsto: ${formatarDataProposta(item.prazo_estimado)}`
      : `Solicitado em: ${formatarDataProposta(item.criado_em)}`,
    location: item.local_ou_modalidade || 'Local a combinar',
    status: statusPropostaLabel(item),
    icon: Music,
    darkBgColor: '#3D2218',
    lightBgColor: '#FDE4D9',
    iconColor: '#E05A10',
  };
}

export default function ContratacoesScreen() {
  const router = useRouter();
  const { theme, isLightMode } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < DESKTOP_BREAKPOINT;
  const narrow = width < SMALL_PHONE_BREAKPOINT;
  const styles = getStyles(theme, compact, narrow);
  const [items, setItems] = useState<PropostaApi[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('Todas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const carregar = useCallback(async (initial = false) => {
    if (initial) { setLoading(true); setError(''); }
    try {
      setItems(await listarPropostas());
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as contratações.');
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  // Ao regressar do chat os dados são recarregados; com a tela aberta,
  // o status acompanha o backend automaticamente sem animação de loading.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void carregar(true);
      const timer = setInterval(() => { if (active) void carregar(); }, 4000);
      return () => { active = false; clearInterval(timer); };
    }, [carregar])
  );
  const exibidos = items.filter((item) => filtro === 'Todas' || statusPropostaLabel(item) === filtro);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={theme.statusBarStyle || (isLightMode ? 'dark-content' : 'light-content')}
        backgroundColor={theme.headerBg}
      />

      <View style={styles.dashboardContainer}>
        {!compact ? <Sidebar /> : null}
        <View style={styles.mainContent}>
          <Header />
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentWrapper}>
              <View style={styles.pageHeader}>
                <View style={styles.headerIcon} accessible={false}>
                  <CalendarDays size={20} color={theme.onAccent || '#FFFFFF'} accessible={false} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pageEyebrow}>AGENDA DE PROJETOS</Text>
                  <Text style={styles.pageTitle} accessibilityRole="header">Contratações em movimento.</Text>
                  <Text style={styles.pageSubtitle}>Acompanhe propostas, prazos e próximos passos em um só lugar.</Text>
                </View>
              </View>

              <View style={styles.filters} accessibilityLabel="Filtros de contratações">
                {FILTROS.map((f) => (
                  <Pressable key={f} accessibilityRole="button" accessibilityState={{ selected: filtro === f }}
                    onPress={() => setFiltro(f)}
                    style={[styles.filter, { backgroundColor: filtro === f ? theme.accent : theme.cardBg,
                      borderColor: filtro === f ? theme.accent : theme.borderColor }]}>
                    <Text style={{ color: filtro === f ? (theme.onAccent || '#FFFFFF') : theme.textPrimary, fontWeight: '800', fontSize: 12 }}>
                      {f}
                    </Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => void carregar(true)} accessibilityRole="button" style={styles.refresh}>
                  <Text style={{ color: theme.accent, fontWeight: '800', fontSize: 12 }}>Atualizar</Text>
                </Pressable>
              </View>
              {loading ? (
                <View style={styles.stateBox} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={theme.accent} />
                  <Text style={styles.stateText}>Carregando contratações...</Text>
                </View>
              ) : error ? (
                <View style={styles.stateBox} accessibilityLiveRegion="polite">
                  <Text style={styles.errorText}>{error}</Text>
                  <Text style={styles.stateText} onPress={() => void carregar()} accessibilityRole="button">
                    Tentar novamente
                  </Text>
                </View>
              ) : exibidos.length === 0 ? (
                <View style={styles.stateBox}>
                  <Text style={styles.emptyTitle}>Nenhuma contratação neste filtro</Text>
                  <Text style={styles.stateText}>Consulte outro status ou solicite um serviço pelo perfil de um artista.</Text>
                </View>
              ) : (
                <View style={styles.cardsContainer}>
                  {exibidos.map((item) => {
                    const card = toCard(item);
                    return (
                      <CardContratacao
                        key={card.id}
                        item={card}
                        onPress={() =>
                          router.push({
                            pathname: '/pages/contratacoes/detalhes',
                            params: { id: card.id },
                          })
                        }
                      />
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: any, compact: boolean, narrow: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.mainBg,
    ...Platform.select({ web: compact ? { minHeight: '100dvh' as any } : { height: '100vh' as any, overflow: 'hidden' } }),
  },
  dashboardContainer: { flex: 1, flexDirection: 'row', backgroundColor: theme.mainBg },
  mainContent: {
    flex: 1,
    backgroundColor: theme.mainBg,
    minWidth: 0,
    ...Platform.select({ web: compact ? { minHeight: 0 } : { height: '100vh' as any, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }),
  },
  scrollView: { flex: 1 },
  scrollContentContainer: { flexGrow: 1 },
  contentWrapper: { flex: 1, width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: narrow ? 14 : compact ? 18 : 32, paddingTop: compact ? 20 : 28, paddingBottom: 32 },
  pageHeader: {
    marginBottom: 22, backgroundColor: theme.heroBg || theme.textPrimary, borderRadius: 24,
    padding: compact ? 18 : 24, flexDirection: narrow ? 'column' : 'row', alignItems: narrow ? 'flex-start' : 'center', gap: 16, overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: `0 16px 38px ${theme.shadowStrong || theme.shadowColor}` } }),
  },
  headerIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent, transform: [{ rotate: '-4deg' }] },
  pageEyebrow: { color: theme.artGold || theme.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
  pageTitle: { fontSize: compact ? 24 : 29, lineHeight: compact ? 29 : 34, fontWeight: '900' as any, color: theme.heroText || '#FFFFFF', fontFamily: 'serif', letterSpacing: -0.5 },
  pageSubtitle: { color: theme.heroMuted || '#E6D8CF', fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 20 },
  filter: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 18, borderWidth: 1 },
  refresh: { paddingHorizontal: 12, paddingVertical: 9 },
  cardsContainer: { gap: 14, paddingBottom: 8 },
  stateBox: {
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 22,
    padding: compact ? 24 : 32,
    alignItems: 'center',
    gap: 10,
  },
  stateText: { color: theme.textSecondary, fontSize: 13, textAlign: 'center' },
  emptyTitle: { color: theme.textPrimary, fontSize: 16, fontWeight: '700' },
  errorText: { color: '#B42318', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
