import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { AccessibleTextInput as TextInput } from '../../../components/accessibility/AccessibleTextInput';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';

import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';
import { useTheme } from '../../../components/context/ThemeContext';
import { VLibrasText as Text } from '../../../components/accessibility/VLibrasText';
import { portfolioNotice } from '../../../services/portfolio';

const URL_API = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const ABAS = [
  { id: 'resumo', label: 'Resumo', endpoint: '/api/admin/resumo', chave: '' },
  { id: 'usuarios', label: 'Usuários', endpoint: '/api/admin/usuarios', chave: 'usuarios' },
  { id: 'artistas', label: 'Artistas', endpoint: '/api/admin/artistas', chave: 'artistas' },
  { id: 'contratos', label: 'Contratos', endpoint: '/api/admin/contratos', chave: 'contratos' },
  { id: 'pagamentos', label: 'Pagamentos', endpoint: '/api/admin/pagamentos', chave: 'recebidos' },
  { id: 'conversas', label: 'Conversas', endpoint: '/api/admin/conversas', chave: 'conversas' },
  { id: 'moderacao', label: 'Moderação', endpoint: '/api/admin/moderacao', chave: 'avisos' },
  { id: 'ocorrencias', label: 'Ocorrências', endpoint: '/api/admin/ocorrencias', chave: 'ocorrencias' },
  { id: 'auditoria', label: 'Auditoria', endpoint: '/api/admin/auditoria', chave: 'acoes' },
  { id: 'metricas', label: 'Métricas', endpoint: '/api/admin/metricas', chave: 'plataforma' },
  { id: 'visitantes', label: 'Visitantes', endpoint: '/api/admin/visitantes', chave: 'visitantes' },
];

const KPI_LABELS: Record<string, string> = {
  usuarios: 'Usuários', novos_usuarios_30d: 'Novos (30d)', artistas: 'Artistas',
  contratos_ativos: 'Contratos ativos', contratos_total: 'Contratos', propostas_abertas: 'Propostas abertas',
  pagamentos_pagos: 'Pagamentos pagos', receita_paga: 'Receita paga', pix_recebidos: 'PIX recebidos',
  repasses_pagos: 'Repasses', conversas: 'Conversas', mensagens: 'Mensagens',
  ocorrencias_abertas: 'Ocorrências abertas', avisos_pendentes: 'Avisos pendentes',
  visitantes: 'Visitantes únicos', visualizacoes: 'Visualizações',
};

const ocultar = (chave: string) => ['cpf', 'cnpj', 'senha_hash', 'hash_token', 'access_token', 'refresh_token'].includes(chave);

export default function AdminScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const styles = getStyles(theme);
  const [autorizado, setAutorizado] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [aba, setAba] = useState('resumo');
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [ufFiltro, setUfFiltro] = useState('');
  const [diasFiltro, setDiasFiltro] = useState(30);
  const [rotas, setRotas] = useState<any[]>([]);

  const carregar = useCallback(async (id: string) => {
    const alvo = ABAS.find((item) => item.id === id) || ABAS[0];
    setCarregando(true);
    setErro('');
    try {
      const token = await AsyncStorage.getItem('access_token');
      let endpoint = alvo.endpoint;
      if (id === 'visitantes') {
        endpoint += `?uf=${encodeURIComponent(ufFiltro.trim().slice(0, 2))}&dias=${diasFiltro}`;
      } else if (id === 'metricas') {
        endpoint += `?dias=${diasFiltro}`;
      }
      const resposta = await fetch(`${URL_API}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resposta.ok) {
        const payload = await resposta.json().catch(() => ({}));
        throw new Error(payload.detail || 'Não foi possível carregar os dados.');
      }
      const json = await resposta.json();
      setDados(json);
      if (id === 'visitantes') {
        const ranking = await fetch(`${URL_API}/api/admin/visitantes/rotas?dias=${diasFiltro}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (ranking.ok) setRotas((await ranking.json()).rotas || []);
      }
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível carregar os dados.');
    } finally {
      setCarregando(false);
    }
  }, [ufFiltro, diasFiltro]);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) {
          router.replace('/pages/login/login');
          return;
        }
        const resposta = await fetch(`${URL_API}/api/admin/verificar`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resposta.ok) {
          portfolioNotice('Acesso negado', 'Esta área é restrita a administradores.');
          router.replace('/pages/explorar/explorar');
          return;
        }
        setAutorizado(true);
        await carregar('resumo');
      } catch {
        portfolioNotice('Admin', 'Não foi possível validar seu acesso.');
        router.replace('/pages/explorar/explorar');
      } finally {
        setVerificando(false);
      }
    })();
  }, [carregar, router]);

  const acao = async (caminho: string, metodo: string, corpo?: any) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const resposta = await fetch(`${URL_API}${caminho}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      if (!resposta.ok) {
        const payload = await resposta.json().catch(() => ({}));
        throw new Error(payload.detail || 'Ação não concluída.');
      }
      portfolioNotice('Sucesso', 'Ação registrada com auditoria.');
      await carregar(aba);
    } catch (e: any) {
      portfolioNotice('Erro', e?.message || 'Ação não concluída.');
    }
  };

  const linhas = aba === 'resumo'
    ? []
    : (() => {
        const alvo = ABAS.find((item) => item.id === aba)!;
        const valor = dados?.[alvo.chave];
        return Array.isArray(valor) ? valor : [];
      })();

  const colunas = linhas.length > 0
    ? Object.keys(linhas[0]).filter((chave) => !ocultar(chave)).slice(0, 9)
    : [];

  const formatarValor = (valor: any) => {
    if (valor === null || valor === undefined) return '—';
    if (typeof valor === 'object') return JSON.stringify(valor).slice(0, 120);
    if (typeof valor === 'boolean') return valor ? 'sim' : 'não';
    return String(valor).slice(0, 160);
  };

  if (verificando) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.mainBg }]}>
        <View style={styles.centro}>
          <ActivityIndicator color={theme.accent} />
          <Text style={{ color: theme.textSecondary, marginTop: 12 }}>Validando acesso administrativo...</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!autorizado) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.mainBg }]}>
      {width >= 900 ? <Sidebar /> : null}
      <ScrollView style={{ flex: 1 }}>
        <Header />
        <View style={styles.conteudo}>
          <View style={styles.tituloLinha}>
            <ShieldCheck size={24} color={theme.accent} />
            <View>
              <Text style={styles.titulo}>Painel Administrativo</Text>
              <Text style={styles.subtitulo}>Supervisão geral · dados sensíveis mascarados e acesso auditado</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.abas}>
            {ABAS.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => { setAba(item.id); carregar(item.id); }}
                style={[styles.aba, aba === item.id && styles.abaAtiva]}
                accessibilityRole="button"
              >
                <Text style={[styles.abaTexto, aba === item.id && styles.abaTextoAtiva]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {carregando ? (
            <View style={styles.centro}><ActivityIndicator color={theme.accent} /></View>
          ) : erro ? (
            <Text style={{ color: theme.danger || theme.textPrimary }}>{erro}</Text>
          ) : aba === 'resumo' ? (
            <View style={styles.kpiGrid}>
              {dados && Object.entries(dados).map(([chave, valor]) => (
                <View key={chave} style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>{KPI_LABELS[chave] || chave}</Text>
                  <Text style={styles.kpiValor}>{formatarValor(valor)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              {aba === 'conversas' ? (
                <Text style={styles.aviso}>Conversas: apenas metadados. O conteúdo privado não é exibido por privacidade.</Text>
              ) : null}
              {aba === 'visitantes' ? (
                <View style={styles.filtros}>
                  <TextInput
                    value={ufFiltro}
                    onChangeText={(valor) => setUfFiltro(valor.slice(0, 2).toUpperCase())}
                    placeholder="UF"
                    placeholderTextColor={theme.textSecondary}
                    style={styles.campoFiltro}
                    accessibilityLabel="Filtrar visitantes por UF"
                  />
                  {[7, 30, 90].map((quantidade) => (
                    <TouchableOpacity
                      key={quantidade}
                      onPress={() => setDiasFiltro(quantidade)}
                      style={[styles.botaoPeriodo, diasFiltro === quantidade && styles.botaoPeriodoAtivo]}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.textoPeriodo, diasFiltro === quantidade && styles.textoPeriodoAtivo]}>
                        {quantidade}d
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={() => carregar('visitantes')} style={styles.botacoa} accessibilityRole="button">
                    <Text style={styles.botaoTexto}>Filtrar</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {aba === 'visitantes' && rotas.length > 0 ? (
                <View style={styles.rotasBloco}>
                  <Text style={styles.rotasTitulo}>Rotas mais visitadas ({diasFiltro}d)</Text>
                  {rotas.map((rota: any) => (
                    <Text key={rota.rota} style={styles.rotasLinha}>
                      {rota.rota} — {rota.visualizacoes} views / {rota.visitantes_unicos} visitantes
                    </Text>
                  ))}
                </View>
              ) : null}
              {linhas.length === 0 ? (
                <Text style={{ color: theme.textSecondary }}>Nenhum registro nesta seção.</Text>
              ) : (
                <ScrollView horizontal>
                  <View>
                    <View style={styles.linhaCabecalho}>
                      {colunas.map((coluna) => (
                        <Text key={coluna} style={[styles.celula, styles.celulaCabecalho]}>{coluna}</Text>
                      ))}
                      {aba === 'moderacao' || aba === 'usuarios' || aba === 'ocorrencias' ? (
                        <Text style={[styles.celula, styles.celulaCabecalho]}>Ações</Text>
                      ) : null}
                    </View>
                    {linhas.map((linha: any, indice: number) => (
                      <View key={indice} style={styles.linha}>
                        {colunas.map((coluna) => (
                          <Text key={coluna} style={styles.celula}>{formatarValor(linha[coluna])}</Text>
                        ))}
                        {aba === 'moderacao' ? (
                          <TouchableOpacity style={styles.botacoa} onPress={() => acao(`/api/admin/moderacao/${linha.id}/resolver`, 'POST')} accessibilityRole="button">
                            <Text style={styles.botaoTexto}>Resolver</Text>
                          </TouchableOpacity>
                        ) : null}
                        {aba === 'usuarios' ? (
                          <TouchableOpacity style={styles.botacoa} onPress={() => acao(`/api/admin/usuarios/${linha.id}/status`, 'POST', { status: linha.status === 'ativo' ? 'bloqueado' : 'ativo' })} accessibilityRole="button">
                            <Text style={styles.botaoTexto}>{linha.status === 'ativo' ? 'Bloquear' : 'Ativar'}</Text>
                          </TouchableOpacity>
                        ) : null}
                        {aba === 'ocorrencias' ? (
                          <TouchableOpacity style={styles.botacoa} onPress={() => acao(`/api/admin/ocorrencias/${linha.id}/status`, 'PATCH', { status: 'resolvida' })} accessibilityRole="button">
                            <Text style={styles.botaoTexto}>Resolver</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          )}
          <Text style={styles.rodape}>
            Ações administrativas são registradas em admin_acoes. Nenhum conteúdo de mensagem privada é exibido.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  conteudo: { flex: 1, padding: 24 },
  tituloLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  titulo: { color: theme.textPrimary, fontSize: 26, fontWeight: '900' },
  subtitulo: { color: theme.textSecondary, fontSize: 12, marginTop: 2 },
  abas: { flexGrow: 0, marginBottom: 6 },
  aba: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: theme.cardBg },
  abaAtiva: { backgroundColor: theme.accent, borderColor: theme.accent },
  abaTexto: { color: theme.textPrimary, fontSize: 12, fontWeight: '700' },
  abaTextoAtiva: { color: theme.onAccent || '#FFFFFF' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  kpiCard: { minWidth: 160, flexGrow: 1, backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 14, padding: 16 },
  kpiLabel: { color: theme.textSecondary, fontSize: 11 },
  kpiValor: { color: theme.accent, fontSize: 24, fontWeight: '900', marginTop: 6 },
  aviso: { color: theme.warning || theme.textSecondary, fontSize: 12, marginBottom: 10 },
  linhaCabecalho: { flexDirection: 'row', backgroundColor: theme.cardBg, borderBottomWidth: 1, borderColor: theme.borderColor },
  linha: { flexDirection: 'row', borderBottomWidth: 1, borderColor: theme.borderColor },
  celula: { minWidth: 130, maxWidth: 180, padding: 10, color: theme.textPrimary, fontSize: 11 },
  celulaCabecalho: { fontWeight: '800', color: theme.accent },
  botacoa: { backgroundColor: theme.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, margin: 6 },
  botaoTexto: { color: theme.onAccent || '#FFFFFF', fontSize: 11, fontWeight: '700' },
  filtros: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  campoFiltro: { borderWidth: 1, borderColor: theme.borderColor, backgroundColor: theme.cardBg, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, color: theme.textPrimary, minWidth: 70, fontSize: 12 },
  botaoPeriodo: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  botaoPeriodoAtivo: { backgroundColor: theme.accent, borderColor: theme.accent },
  textoPeriodo: { color: theme.textPrimary, fontSize: 11, fontWeight: '700' },
  textoPeriodoAtivo: { color: theme.onAccent || '#FFFFFF' },
  rotasBloco: { backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 12, padding: 14, marginBottom: 16 },
  rotasTitulo: { color: theme.accent, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  rotasLinha: { color: theme.textPrimary, fontSize: 11, marginBottom: 4 },
  rodape: { color: theme.textSecondary, fontSize: 10, marginTop: 24 },
});
