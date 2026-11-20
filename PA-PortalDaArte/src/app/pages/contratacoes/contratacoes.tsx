import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import { useTheme } from '../../../components/context/ThemeContext';
import { VLibrasText as Text } from '../../../components/accessibility/VLibrasText';
import {
  formatarDataProposta,
  listarPropostas,
  statusPropostaLabel,
  type PropostaApi,
} from '../../../services/contratacoes';

function toCard(item: PropostaApi): Contratacao {
  const nome = item.papel_atual === 'contratante' ? item.artista_nome : item.contratante_nome;
  const papel = item.papel_atual === 'contratante' ? item.servico_titulo : `Solicitação de ${item.contratante_nome}`;
  return {
    id: String(item.id),
    name: nome,
    category: papel,
    date: `Prazo: ${formatarDataProposta(item.prazo_estimado)}`,
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
  const compact = width < 900;
  const styles = getStyles(theme, compact);
  const [items, setItems] = useState<PropostaApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await listarPropostas());
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as contratações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

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
              ) : items.length === 0 ? (
                <View style={styles.stateBox}>
                  <Text style={styles.emptyTitle}>Nenhuma contratação ainda</Text>
                  <Text style={styles.stateText}>Abra o perfil de um artista e toque em Contratar para iniciar.</Text>
                </View>
              ) : (
                <View style={styles.cardsContainer}>
                  {items.map((item) => {
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

const getStyles = (theme: any, compact: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.mainBg,
    ...Platform.select({ web: { height: '100vh' as any, overflow: 'hidden' } }),
  },
  dashboardContainer: { flex: 1, flexDirection: 'row', backgroundColor: theme.mainBg },
  mainContent: {
    flex: 1,
    backgroundColor: theme.mainBg,
    ...Platform.select({ web: { height: '100vh' as any, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }),
  },
  scrollView: { flex: 1 },
  scrollContentContainer: { flexGrow: 1 },
  contentWrapper: { flex: 1, width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: compact ? 18 : 32, paddingTop: compact ? 20 : 28, paddingBottom: 32 },
  pageHeader: {
    marginBottom: 22, backgroundColor: theme.heroBg || theme.textPrimary, borderRadius: 24,
    padding: compact ? 18 : 24, flexDirection: 'row', alignItems: 'center', gap: 16, overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: `0 16px 38px ${theme.shadowStrong || theme.shadowColor}` } }),
  },
  headerIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent, transform: [{ rotate: '-4deg' }] },
  pageEyebrow: { color: theme.artGold || theme.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
  pageTitle: { fontSize: compact ? 24 : 29, lineHeight: compact ? 29 : 34, fontWeight: '900' as any, color: theme.heroText || '#FFFFFF', fontFamily: 'serif', letterSpacing: -0.5 },
  pageSubtitle: { color: theme.heroMuted || '#E6D8CF', fontSize: 12.5, lineHeight: 18, marginTop: 6 },
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
