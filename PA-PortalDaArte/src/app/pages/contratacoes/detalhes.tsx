import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { ArrowLeft, CalendarDays, MapPin, MessageCircle, Music, UserRound, Wallet } from 'lucide-react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import Sidebar from '../../../components/Sidebar';
import Header from '../../../components/Header';
import { useTheme } from '../../../components/context/ThemeContext';
import { VLibrasText as Text } from '../../../components/accessibility/VLibrasText';
import {
  formatarDataProposta,
  formatarMoeda,
  obterProposta,
  responderProposta,
  statusPropostaLabel,
  type PropostaApi,
} from '../../../services/contratacoes';

export default function DetalhesContratacaoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { theme, isLightMode } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const narrow = width < 620;
  const styles = getStyles(theme, compact, narrow);
  const [item, setItem] = useState<PropostaApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [respondendo, setRespondendo] = useState(false);
  const [error, setError] = useState('');

  const carregar = useCallback(async (initial = false) => {
    if (!id) {
      setError('Contratação não encontrada.');
      setLoading(false);
      return;
    }
    if (initial) { setLoading(true); setError(''); }
    try {
      setItem(await obterProposta(id));
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar a contratação.');
    } finally {
      if (initial) setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void carregar(true);
    const timer = setInterval(() => { if (active) void carregar(); }, 4000);
    return () => { active = false; clearInterval(timer); };
  }, [carregar]));

  const responder = async (acao: 'aceitar' | 'recusar') => {
    if (!item || respondendo) return;
    setRespondendo(true);
    try {
      await responderProposta(item.id, acao);
      await carregar();
      Alert.alert(
        acao === 'aceitar' ? 'Contratação confirmada' : 'Proposta recusada',
        acao === 'aceitar'
          ? 'A proposta foi aceita e o contrato foi criado.'
          : 'A proposta foi recusada e o contratante será informado na conversa.'
      );
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível responder à proposta.');
    } finally {
      setRespondendo(false);
    }
  };

  const status = item ? statusPropostaLabel(item) : '';
  const statusColor = status === 'Pendente' ? '#F2994A'
    : status === 'Confirmado' ? '#14804A'
      : status === 'Concluído' ? '#27AE60'
        : status === 'Recusada' ? '#C0392B' : '#6B7280';
  const nome = item
    ? (item.papel_atual === 'contratante' ? item.artista_nome : item.contratante_nome)
    : '';

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
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <View style={styles.contentWrapper}>
              <Pressable onPress={() => router.push('/pages/contratacoes/contratacoes')} style={styles.backButton} accessibilityRole="button">
                <ArrowLeft size={20} color={theme.textPrimary} accessible={false} />
                <Text style={styles.backButtonText}>Voltar para Contratações</Text>
              </Pressable>

              <View style={styles.titleHero}>
                <Text style={styles.titleEyebrow}>ACOMPANHAMENTO DO PROJETO</Text>
                <Text style={styles.title} accessibilityRole="header">Detalhes da contratação</Text>
                <Text style={styles.titleSubtitle}>Veja escopo, prazo, valor e andamento da proposta.</Text>
              </View>

              {loading ? (
                <View style={styles.stateBox} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={theme.accent} />
                  <Text style={styles.stateText}>Carregando...</Text>
                </View>
              ) : error || !item ? (
                <View style={styles.stateBox}>
                  <Text style={styles.errorText}>{error || 'Contratação não encontrada.'}</Text>
                  <TouchableOpacity onPress={() => void carregar()} accessibilityRole="button">
                    <Text style={styles.retryText}>Tentar novamente</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.detailsCard}>
                  <View style={styles.artistHeader}>
                    <View style={styles.avatar}><Music size={30} color={theme.accent} accessible={false} /></View>
                    <View style={styles.artistInfo}>
                      <Text style={styles.artistName}>{nome}</Text>
                      <Text style={styles.category}>{item.servico_titulo}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                      <Text style={styles.statusText}>{status}</Text>
                    </View>
                  </View>

                  <View style={styles.separator} />
                  <Text style={styles.sectionTitle}>Informações do serviço</Text>

                  <View style={styles.infoRow}>
                    <CalendarDays size={20} color={theme.textSecondary} accessible={false} />
                    <View style={styles.infoContent}>
                      <Text style={styles.label}>Prazo estimado</Text>
                      <Text style={styles.value}>{formatarDataProposta(item.prazo_estimado)}</Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <MapPin size={20} color={theme.textSecondary} accessible={false} />
                    <View style={styles.infoContent}>
                      <Text style={styles.label}>Local ou modalidade</Text>
                      <Text style={styles.value}>{item.local_ou_modalidade || 'A combinar'}</Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Wallet size={20} color={theme.textSecondary} accessible={false} />
                    <View style={styles.infoContent}>
                      <Text style={styles.label}>Valor proposto</Text>
                      <Text style={styles.value}>{formatarMoeda(item.valor_proposto)}</Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <UserRound size={20} color={theme.textSecondary} accessible={false} />
                    <View style={styles.infoContent}>
                      <Text style={styles.label}>Artista</Text>
                      <Text style={styles.value}>{item.artista_nome}</Text>
                    </View>
                  </View>

                  <View style={styles.scopeBox}>
                    <Text style={styles.label}>Escopo enviado</Text>
                    <Text style={styles.scopeText}>{item.descricao_escopo}</Text>
                  </View>

                  {item.contrato_id ? (
                    <Text style={styles.contractText}>Contrato #{item.contrato_id} • {item.contrato_status || 'ativo'}</Text>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/pages/mensagens/mensagens',
                      params: { conversaId: String(item.conversa_id) } })}
                    accessibilityRole="button" accessibilityLabel="Abrir conversa desta contratação"
                    style={styles.chatButton}>
                    <MessageCircle size={17} color={theme.onAccent || '#FFFFFF'} accessible={false} />
                    <Text style={styles.chatButtonText}>Abrir conversa com {item.papel_atual === 'artista' ? 'o contratante' : 'o artista'}</Text>
                  </TouchableOpacity>


                  {item.papel_atual === 'artista' && item.status === 'em_negociacao' ? (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => void responder('recusar')}
                        disabled={respondendo}
                        accessibilityRole="button"
                      >
                        <Text style={styles.rejectText}>Recusar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.acceptButton, respondendo && { opacity: 0.6 }]}
                        onPress={() => void responder('aceitar')}
                        disabled={respondendo}
                        accessibilityRole="button"
                      >
                        <Text style={styles.acceptText}>{respondendo ? 'Salvando...' : 'Aceitar contratação'}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
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
  container: { flex: 1, backgroundColor: theme.mainBg, ...Platform.select({ web: { height: '100vh' as any, overflow: 'hidden' } }) },
  dashboardContainer: { flex: 1, flexDirection: 'row', backgroundColor: theme.mainBg },
  mainContent: { flex: 1, backgroundColor: theme.mainBg, ...Platform.select({ web: { height: '100vh' as any, overflow: 'hidden' } }) },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  contentWrapper: { width: '100%', maxWidth: 980, alignSelf: 'center', paddingHorizontal: compact ? 18 : 32, paddingTop: compact ? 18 : 26, paddingBottom: 36 },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, marginBottom: 24, paddingVertical: 8 },
  backButtonText: { color: theme.textPrimary, fontSize: 14, fontWeight: '600' },
  titleHero: { backgroundColor: theme.heroBg || theme.textPrimary, borderRadius: 24, padding: compact ? 18 : 24, marginBottom: 22, overflow: 'hidden', ...Platform.select({ web: { boxShadow: `0 16px 38px ${theme.shadowStrong || theme.shadowColor}` } }) },
  titleEyebrow: { color: theme.artGold || theme.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 5 },
  title: { fontSize: compact ? 25 : 31, lineHeight: compact ? 30 : 36, fontWeight: '900' as any, color: theme.heroText || '#FFFFFF', fontFamily: 'serif', letterSpacing: -0.5 },
  titleSubtitle: { color: theme.heroMuted || '#E6D8CF', fontSize: 12.5, lineHeight: 18, marginTop: 7 },
  stateBox: { backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 16, padding: 30, alignItems: 'center', gap: 10 },
  stateText: { color: theme.textSecondary },
  errorText: { color: '#B42318', fontWeight: '600', textAlign: 'center' },
  retryText: { color: theme.accent, fontWeight: '700' },
  detailsCard: { backgroundColor: theme.cardBg, borderRadius: 24, borderWidth: 1, borderColor: theme.borderColor, borderLeftWidth: 4, borderLeftColor: theme.accent, padding: narrow ? 18 : 26, ...Platform.select({ web: { boxShadow: `0 10px 30px ${theme.shadowColor || 'rgba(0,0,0,0.06)'}` } }) },
  artistHeader: { flexDirection: narrow ? 'column' : 'row', alignItems: narrow ? 'flex-start' : 'center', gap: narrow ? 12 : 0 },
  avatar: { width: 62, height: 62, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.menuActiveBg, marginRight: 16 },
  artistInfo: { flex: 1, minWidth: 0 },
  artistName: { fontSize: 21, fontWeight: '900', color: theme.textPrimary, fontFamily: 'serif' },
  category: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, marginLeft: narrow ? 0 : 12 },
  statusText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  separator: { height: 1, backgroundColor: theme.borderColor, marginVertical: 22 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: theme.textPrimary, fontFamily: 'serif', marginBottom: 18 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  infoContent: { flex: 1 },
  label: { color: theme.textSecondary, fontSize: 12, fontWeight: '600' },
  value: { color: theme.textPrimary, fontSize: 14, fontWeight: '600', marginTop: 3 },
  scopeBox: { backgroundColor: theme.surfaceMuted || theme.mainBg, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 18, padding: 16, marginTop: 4 },
  scopeText: { color: theme.textPrimary, fontSize: 13, lineHeight: 20, marginTop: 6 },
  contractText: { color: theme.accent, fontSize: 12, fontWeight: '700', marginTop: 16 },
  chatButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: theme.accent, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, marginTop: 14 },
  chatButtonText: { color: theme.onAccent || '#FFFFFF', fontWeight: '800', fontSize: 12 },
  actions: { flexDirection: narrow ? 'column-reverse' : 'row', justifyContent: 'flex-end', gap: 10, marginTop: 24 },
  actionButton: { borderRadius: 12, minHeight: 46, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rejectButton: { backgroundColor: theme.cardBg, borderColor: '#C0392B' },
  acceptButton: { backgroundColor: theme.accent, borderColor: theme.accent },
  rejectText: { color: '#C0392B', fontWeight: '700' },
  acceptText: { color: '#FFFFFF', fontWeight: '700' },
});
