import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { Music } from 'lucide-react-native';
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
  const styles = getStyles(theme);
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
        barStyle={isLightMode ? 'dark-content' : 'light-content'}
        backgroundColor={theme.headerBg}
      />

      <View style={styles.dashboardContainer}>
        <Sidebar />
        <View style={styles.mainContent}>
          <Header />
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentWrapper}>
              <View style={styles.pageHeader}>
                <Text style={styles.pageTitle} accessibilityRole="header">Contratações</Text>
                <Text style={styles.pageSubtitle}>Solicitações enviadas e recebidas pela sua conta.</Text>
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

const getStyles = (theme: any) => StyleSheet.create({
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
  contentWrapper: { flex: 1, paddingHorizontal: 32, paddingTop: 20, paddingBottom: 24 },
  pageHeader: { marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: '700', color: theme.textPrimary },
  pageSubtitle: { color: theme.textSecondary, fontSize: 13, marginTop: 6 },
  cardsContainer: { gap: 14, paddingBottom: 8 },
  stateBox: {
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  stateText: { color: theme.textSecondary, fontSize: 13, textAlign: 'center' },
  emptyTitle: { color: theme.textPrimary, fontSize: 16, fontWeight: '700' },
  errorText: { color: '#B42318', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
