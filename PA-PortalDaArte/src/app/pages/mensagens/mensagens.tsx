import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, SafeAreaView, StatusBar, ScrollView, Platform, Alert, Image, Modal, KeyboardAvoidingView, useWindowDimensions } from 'react-native';
import { AccessibleTextInput as TextInput } from '../../../components/accessibility/AccessibleTextInput';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Music,
  Headphones,
  Mic,
  Camera,
  Send,
  X,
  Play,
  MoreHorizontal,
  Info,
  Trash2,
  ArrowLeft,
  MessageSquare,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppVideo } from '../../../components/media/AppVideo';
import { formatarMoeda, responderProposta as responderPropostaApi, statusPropostaLabel, type PropostaApi } from '../../../services/contratacoes';

// Importações dos Componentes e do Contexto
import Sidebar from '../../../components/Sidebar';
import { DESKTOP_BREAKPOINT, MOBILE_BREAKPOINT } from '../../../constants/responsive';
import Header from '../../../components/Header';
import { useTheme } from '../../../components/context/ThemeContext';

import { VLibrasText as Text } from '../../../components/accessibility/VLibrasText';
const URL_API = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// ---------------------------------------------------------------------------
// 1) DADOS FIXOS
// ---------------------------------------------------------------------------

type ConversaUI = {
  id: string;
  name: string;
  category: string;
  lastMessage: string;
  time: string;
  unread: number;
  icon: any;
  darkBgColor: string;
  lightBgColor: string;
  iconColor: string;
  status: string;
  outroUsuarioId: number;
  artistaId: number;
  contratanteId: number;
  podeContratar: boolean;
  fotoPerfil?: string | null;
};

type AnexoMensagem = {
  uri: string;
  type: 'image' | 'video';
  name: string;
  mimeType: string;
  file?: File | Blob;
};

type Mensagem = {
  id: string;
  fromMe: boolean;
  text: string;
  time: string;
  criadoEm?: string | null;
  mediaUri?: string | null;
  mediaType?: 'image' | 'video' | null;
  enviando?: boolean;
};

function normalizarMensagem(row: any): Mensagem {
  return {
    id: String(row.id),
    fromMe: Boolean(row.fromMe),
    text: String(row.text ?? row.conteudo ?? ''),
    time: String(row.time || ''),
    criadoEm: row.criado_em || row.created_at || row.createdAt || null,
    mediaUri: row.media_url || null,
    mediaType: row.media_type === 'video' ? 'video' : row.media_type === 'image' ? 'image' : null,
  };
}

function mensagensIguais(a: Mensagem[], b: Mensagem[]): boolean {
  return a.length === b.length && a.every((msg, i) =>
    msg.id === b[i].id && msg.text === b[i].text && msg.enviando === b[i].enviando &&
    msg.mediaType === b[i].mediaType && msg.mediaUri === b[i].mediaUri);
}

export default function MensagensScreen() {
  const router = useRouter();
  const { theme, isLightMode } = useTheme();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const compactShell = viewportWidth < DESKTOP_BREAKPOINT;
  const compactChat = viewportWidth < MOBILE_BREAKPOINT;
  const styles = getStyles(theme, compactChat, viewportWidth, viewportHeight) as any;

  const params = useLocalSearchParams<{ destinatarioId?: string | string[]; destinatarioNome?: string | string[]; conversaId?: string | string[]; contratar?: string | string[] }>();
  const destinatarioId = Array.isArray(params.destinatarioId) ? params.destinatarioId[0] : params.destinatarioId;
  const conversaIdParam = Array.isArray(params.conversaId) ? params.conversaId[0] : params.conversaId;
  const [conversations, setConversations] = useState<ConversaUI[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const sendingMessageRef = useRef(false);
  const messageSequenceRef = useRef(0);
  const selectedIdRef = useRef('');
  const autoOpenProposalRef = useRef(false);
  const [proposalVisible, setProposalVisible] = useState(false);
  const [proposalDescription, setProposalDescription] = useState('');
  const [proposalValue, setProposalValue] = useState('');
  const [proposalPlace, setProposalPlace] = useState('');
  const [sendingProposal, setSendingProposal] = useState(false);
  const sendingProposalRef = useRef(false);
  const [proposals, setProposals] = useState<PropostaApi[]>([]);
  const [proposalError, setProposalError] = useState('');
  const [respondendoPropostaId, setRespondendoPropostaId] = useState<number | null>(null);
  const [requestError, setRequestError] = useState('');
  const openedTargetRef = useRef<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messagesData, setMessagesData] = useState<Record<string, Mensagem[]>>({});
  const messagesScrollRef = useRef<ScrollView | null>(null);
  const [midiaAnexada, setMidiaAnexada] = useState<AnexoMensagem | null>(null);
  
  // Estados de visualização e menus de mensagens
  const [midiaVisualizacao, setMidiaVisualizacao] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [modalDadosMensagem, setModalDadosMensagem] = useState<Mensagem | null>(null);

  const LIMITE_CARACTERES = 500;

  selectedIdRef.current = selectedId;
  const selectedConversation = conversations.find((c) => c.id === selectedId);
  const podeSolicitarContratacao = Boolean(selectedConversation?.podeContratar);
  const SelectedIcon = selectedConversation?.icon;
  const messages = messagesData[selectedId] || [];

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  const getToken = async () => {
    const token = await AsyncStorage.getItem('access_token');
    if (!token) throw new Error('Sua sessão expirou. Entre novamente para acessar as mensagens.');
    return token;
  };

  const mapConversa = (item: any): ConversaUI => {
    const name = String(item.nome || item.name || 'Usuário');
    const isBand = /banda/i.test(name);
    const isDj = /dj/i.test(name);
    const IconComponent = isDj ? Headphones : isBand ? Music : Mic;
    return {
      id: String(item.id),
      name,
      category: item.foto_perfil ? 'Conversa' : 'Perfil',
      lastMessage: item.ultima_mensagem || 'Inicie a conversa',
      time: item.ultima_mensagem_em ? new Date(item.ultima_mensagem_em).toLocaleDateString() === new Date().toLocaleDateString()
        ? new Date(item.ultima_mensagem_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date(item.ultima_mensagem_em).toLocaleDateString('pt-BR') : '',
      unread: Number(item.nao_lidas || 0),
      icon: IconComponent,
      darkBgColor: '#1B3736',
      lightBgColor: '#E0F2F1',
      iconColor: '#20B2AA',
      status: 'Conversa',
      outroUsuarioId: Number(item.outro_usuario_id),
      artistaId: Number(item.artista_id),
      contratanteId: Number(item.contratante_id),
      podeContratar: typeof item.pode_solicitar === 'boolean' ? item.pode_solicitar : Number(item.outro_usuario_id) === Number(item.artista_id),
      fotoPerfil: item.foto_perfil || null,
    };
  };

  const carregarConversas = async (selectId?: string) => {
    const token = await getToken();
    const response = await fetch(`${URL_API}/api/conversas`, { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || 'Não foi possível carregar suas conversas.');
    const rows = Array.isArray(payload) ? payload : (payload.conversas || []);
    const mapped = rows.map(mapConversa);
    setConversations(mapped);
    const wanted = selectId || conversaIdParam;
    if (wanted && mapped.some((c: ConversaUI) => c.id === String(wanted))) setSelectedId(String(wanted));
    else if (!selectedId && mapped.length) setSelectedId(mapped[0].id);
    return mapped;
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingConversations(true);
      setRequestError('');
      try {
        if (destinatarioId && openedTargetRef.current !== String(destinatarioId)) {
          openedTargetRef.current = String(destinatarioId);
          const token = await getToken();
          const response = await fetch(`${URL_API}/api/conversas`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ artista_id: Number(destinatarioId) }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.detail || 'Não foi possível iniciar a conversa.');
          const mapped = await carregarConversas(String(payload.conversa_id));
          if (active && !mapped.some((c: ConversaUI) => c.id === String(payload.conversa_id))) {
            setSelectedId(String(payload.conversa_id));
          }
        } else {
          await carregarConversas(conversaIdParam);
        }
      } catch (error: any) {
        if (active) setRequestError(error?.message || 'Erro ao carregar mensagens.');
      } finally {
        if (active) setLoadingConversations(false);
      }
    })();
    return () => { active = false; };
  }, [destinatarioId, conversaIdParam]);

  // A conversa permanece a mesma do backend; o polling apenas sincroniza
  // alterações remotas, sem apagar mensagens otimistas ainda em trânsito.
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    let inFlight = false;
    const conversationId = selectedId;
    const carregarMensagens = async (initial = false) => {
      if (!active || inFlight) return;
      inFlight = true;
      if (initial) setLoadingMessages(true);
      try {
        const token = await getToken();
        const response = await fetch(`${URL_API}/api/conversas/${conversationId}/mensagens`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || 'Não foi possível carregar as mensagens.');
        const oficiais: Mensagem[] = (Array.isArray(payload) ? payload : (payload.mensagens || []))
          .map(normalizarMensagem);
        if (!active) return;
        setMessagesData((prev) => {
          const anteriores = prev[conversationId] || [];
          const oficiaisComMidia = oficiais.map((m) => {
            const anterior = anteriores.find((p) => p.id === m.id);
            // Não refaz o carregamento de vídeo a cada URL assinada renovada.
            return anterior?.mediaUri ? { ...m, mediaUri: anterior.mediaUri } : m;
          });
          const pendentes = anteriores.filter((m) => m.id.startsWith('temp-') && !oficiaisComMidia.some((oficial) => {
            const dataPendente = new Date(m.criadoEm || '').getTime();
            const dataOficial = new Date(oficial.criadoEm || '').getTime();
            const recente = Number.isFinite(dataPendente) && Number.isFinite(dataOficial) &&
              Math.abs(dataPendente - dataOficial) < 120000;
            return oficial.fromMe && oficial.text === m.text && oficial.mediaType === m.mediaType && recente;
          }));
          const atualizadas = [...oficiaisComMidia, ...pendentes];
          return mensagensIguais(anteriores, atualizadas) ? prev : { ...prev, [conversationId]: atualizadas };
        });
        setConversations((prev) => prev.map((c) => c.id === conversationId && c.unread !== 0 ? { ...c, unread: 0 } : c));
        setRequestError('');
      } catch (error: any) {
        if (active && initial) setRequestError(error?.message || 'Erro ao carregar as mensagens.');
      } finally {
        inFlight = false;
        if (active && initial) setLoadingMessages(false);
      }
    };
    void carregarMensagens(true);
    const timer = setInterval(() => void carregarMensagens(), 3000);
    return () => { active = false; clearInterval(timer); };
  }, [selectedId]);

  // Atualiza lista, prévias e mensagens não lidas sem reiniciar a página.
  useEffect(() => {
    let active = true;
    let inFlight = false;
    const refreshConversations = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const token = await getToken();
        const response = await fetch(`${URL_API}/api/conversas`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (!active) return;
        const dados = (Array.isArray(payload) ? payload : (payload.conversas || [])).map(mapConversa);
        setConversations(dados.map((c: ConversaUI) => c.id === selectedId ? { ...c, unread: 0 } : c));
      } catch { /* O último histórico válido continua visível durante falhas transitórias. */ }
      finally { inFlight = false; }
    };
    const timer = setInterval(() => void refreshConversations(), 12000);
    return () => { active = false; clearInterval(timer); };
  }, [selectedId]);

  const carregarPropostas = async (conversationId: string) => {
    const token = await getToken();
    const response = await fetch(`${URL_API}/api/conversas/${conversationId}/propostas`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.detail || 'Não foi possível carregar as solicitações.');
    if (selectedIdRef.current === conversationId) {
      setProposals(Array.isArray(payload.propostas) ? payload.propostas : []);
      setProposalError('');
    }
  };

  useEffect(() => {
    if (!selectedId) { setProposals([]); setProposalError(''); return; }
    let active = true;
    let inFlight = false;
    const conversationId = selectedId;
    const atualizar = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const token = await getToken();
        const response = await fetch(`${URL_API}/api/conversas/${conversationId}/propostas`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.detail || 'Erro ao consultar solicitações.');
        if (active) {
          setProposals(Array.isArray(payload.propostas) ? payload.propostas : []);
          setProposalError('');
        }
      } catch (error: any) {
        if (active) setProposalError(error?.message || 'Erro ao carregar solicitações.');
      } finally { inFlight = false; }
    };
    setProposals([]);
    void atualizar();
    const timer = setInterval(() => void atualizar(), 3000);
    return () => { active = false; clearInterval(timer); };
  }, [selectedId]);

  // Compatibilidade com links criados na versão anterior do perfil público.
  useEffect(() => {
    if (params.contratar === '1' && selectedId && podeSolicitarContratacao && !autoOpenProposalRef.current) {
      autoOpenProposalRef.current = true;
      setProposalVisible(true);
    }
  }, [params.contratar, selectedId, podeSolicitarContratacao]);

  const enviarSolicitacao = async () => {
    if (sendingProposalRef.current || !selectedId || !podeSolicitarContratacao) return;
    const descricao = proposalDescription.trim();
    const valor = Number(proposalValue.trim().replace(/\.(?=\d{3}(?:[,.]|$))/g, '').replace(',', '.'));
    if (descricao.length < 10 || !Number.isFinite(valor) || valor <= 0 || valor >= 100000000) {
      Alert.alert('Dados incompletos', 'Descreva o serviço (mínimo de 10 caracteres) e informe um valor válido.');
      return;
    }
    sendingProposalRef.current = true;
    setSendingProposal(true);
    const conversationId = selectedId;
    try {
      const token = await getToken();
      const response = await fetch(`${URL_API}/api/propostas`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversa_id: Number(conversationId),
          descricao_escopo: descricao,
          local_ou_modalidade: proposalPlace.trim() || null,
          valor_proposto: valor,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || 'Não foi possível enviar a solicitação.');
      setProposalVisible(false);
      setProposalDescription('');
      setProposalValue('');
      setProposalPlace('');
      await carregarPropostas(conversationId);
      // A solicitação também aparece na tela de Contratações via GET /api/propostas.
    } catch (error: any) {
      Alert.alert('Erro ao solicitar', error?.message || 'Não foi possível registrar a contratação.');
    } finally {
      sendingProposalRef.current = false;
      setSendingProposal(false);
    }
  };

  const responderSolicitacao = async (proposal: PropostaApi, acao: 'aceitar' | 'recusar') => {
    if (respondendoPropostaId !== null || proposal.papel_atual !== 'artista' || proposal.status !== 'em_negociacao') return;
    const conversationId = selectedId;
    setRespondendoPropostaId(proposal.id);
    try {
      await responderPropostaApi(proposal.id, acao);
      await carregarPropostas(conversationId);
      // O endpoint do Vinicius cria o contrato ao aceitar; não criar outro aqui.
    } catch (error: any) {
      Alert.alert('Não foi possível responder', error?.message || 'Tente novamente.');
    } finally { setRespondendoPropostaId(null); }
  };

  const handleSelecionarMidia = async () => {
    try {
      const libraryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (libraryPerm.status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos e vídeos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets?.length) {
        const arquivo: any = result.assets[0];
        const tipoMidia: 'image' | 'video' = arquivo.type === 'video' ? 'video' : 'image';
        const fallbackExt = tipoMidia === 'video' ? 'mp4' : 'jpg';
        const name = arquivo.fileName || `mensagem-${Date.now()}.${fallbackExt}`;
        const mimeType = arquivo.mimeType || (tipoMidia === 'video' ? 'video/mp4' : 'image/jpeg');
        setMidiaAnexada({ uri: arquivo.uri, type: tipoMidia, name, mimeType, file: arquivo.file });
      }
    } catch (error) {
      console.error('Erro ao selecionar mídia:', error);
      Alert.alert('Erro', 'Não foi possível carregar o arquivo.');
    }
  };

  const handleSendMessage = async () => {
    const content = messageText.trim();
    if (!selectedId || sendingMessageRef.current || (!content && !midiaAnexada)) return;
    sendingMessageRef.current = true;
    const conversationId = selectedId;
    const anexo = midiaAnexada;
    const tempId = `temp-${Date.now()}-${++messageSequenceRef.current}`;
    const otimista: Mensagem = {
      id: tempId, fromMe: true, text: content, enviando: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      criadoEm: new Date().toISOString(), mediaUri: anexo?.uri || null,
      mediaType: anexo?.type || null,
    };
    setMessageText('');
    setMidiaAnexada(null);
    setMessagesData((prev) => ({ ...prev, [conversationId]: [...(prev[conversationId] || []), otimista] }));
    setConversations((prev) => prev.map((c) => c.id === conversationId ? {
      ...c, lastMessage: content || (anexo?.type === 'video' ? '📎 Vídeo' : '📎 Imagem'), time: otimista.time,
    } : c));
    try {
      const token = await getToken();
      let response: Response;
      if (anexo) {
        const formData = new FormData();
        formData.append('conteudo', content);
        if (Platform.OS === 'web' && anexo.file) {
          formData.append('arquivo', anexo.file as any, anexo.name);
        } else {
          formData.append('arquivo', {
            uri: anexo.uri, name: anexo.name, type: anexo.mimeType,
          } as any);
        }
        response = await fetch(`${URL_API}/api/conversas/${conversationId}/mensagens/arquivo`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
        });
      } else {
        response = await fetch(`${URL_API}/api/conversas/${conversationId}/mensagens`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ conteudo: content }),
        });
      }
      const payload = await response.json();
      if (!response.ok || !payload?.mensagem?.id) throw new Error(payload?.detail || 'Não foi possível enviar a mensagem.');
      const confirmada = normalizarMensagem(payload.mensagem);
      setMessagesData((prev) => {
        const existentes = (prev[conversationId] || []).filter((m) => m.id !== tempId && m.id !== confirmada.id);
        return { ...prev, [conversationId]: [...existentes, confirmada] };
      });
      setConversations((prev) => prev.map((c) => c.id === conversationId ? {
        ...c, lastMessage: content || (confirmada.mediaType === 'video' ? '📎 Vídeo' : '📎 Imagem'),
        time: confirmada.time,
      } : c));
      setRequestError('');
      setTimeout(() => messagesScrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error: any) {
      setMessagesData((prev) => ({ ...prev,
        [conversationId]: (prev[conversationId] || []).filter((m) => m.id !== tempId),
      }));
      setMessageText((atual) => atual || content);
      if (anexo) setMidiaAnexada((atual) => atual || anexo);
      Alert.alert('Erro ao enviar', error?.message || 'Não foi possível enviar a mensagem.');
    } finally {
      sendingMessageRef.current = false;
    }
  };

  const handleKeyPress = (e: any) => {
    if (Platform.OS === 'web') {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    }
  };

  const handleDeleteMessage = async (msgId: string, fromMe: boolean) => {
    if (!fromMe) {
      Alert.alert('Ação não permitida', 'Você só pode deletar as suas próprias mensagens.');
      return;
    }
    try {
      const token = await getToken();
      const response = await fetch(`${URL_API}/api/conversas/${selectedId}/mensagens/${msgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Não foi possível excluir a mensagem.');
      setMessagesData((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] || []).filter((m) => m.id !== msgId),
      }));
      setActiveMenuMessageId(null);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Não foi possível excluir a mensagem.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={theme.statusBarStyle || (isLightMode ? 'dark-content' : 'light-content')}
        backgroundColor={theme.headerBg}
      />
      <Modal visible={proposalVisible && podeSolicitarContratacao} transparent animationType="fade"
        onRequestClose={() => setProposalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.overlay || '#0009', padding: 12 }}>
          <ScrollView style={{ width: '100%', maxHeight: Math.max(260, viewportHeight * 0.9) }}
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}
            keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ width: '100%', maxWidth: 470, backgroundColor: theme.cardBg, borderRadius: 22,
            borderColor: theme.borderColor, borderWidth: 1, padding: compactChat ? 16 : 22, gap: 12 }}>
            <Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '900' }}>Solicitar contratação</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              A solicitação será registrada em Contratações e vinculada a esta conversa.
            </Text>
            <TextInput multiline value={proposalDescription} onChangeText={setProposalDescription}
              placeholder="Descreva o serviço desejado (mínimo de 10 caracteres)" placeholderTextColor={theme.textSecondary}
              maxLength={5000} textAlignVertical="top" accessibilityLabel="Descrição do serviço"
              style={{ minHeight: 100, borderWidth: 1, borderRadius: 12, borderColor: theme.borderColor,
                backgroundColor: theme.mainBg, padding: 12, color: theme.textPrimary }} />
            <TextInput value={proposalValue} onChangeText={setProposalValue} keyboardType="decimal-pad"
              placeholder="Valor proposto (R$)" placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Valor da proposta em reais"
              style={{ borderWidth: 1, borderRadius: 12, borderColor: theme.borderColor,
                backgroundColor: theme.mainBg, padding: 12, color: theme.textPrimary }} />
            <TextInput value={proposalPlace} onChangeText={setProposalPlace}
              placeholder="Cidade/UF ou modalidade (opcional)" placeholderTextColor={theme.textSecondary}
              maxLength={255} accessibilityLabel="Local ou modalidade do evento"
              style={{ borderWidth: 1, borderRadius: 12, borderColor: theme.borderColor,
                backgroundColor: theme.mainBg, padding: 12, color: theme.textPrimary }} />
            <TouchableOpacity onPress={() => void enviarSolicitacao()} disabled={sendingProposal}
              style={{ backgroundColor: theme.accent, paddingVertical: 14, borderRadius: 12, opacity: sendingProposal ? .65 : 1 }}
              accessibilityRole="button" accessibilityLabel="Enviar solicitação de contratação">
              <Text style={{ color: theme.onAccent || '#fff', fontWeight: '800', textAlign: 'center' }}>
                {sendingProposal ? 'Enviando...' : 'Enviar solicitação'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setProposalVisible(false)} disabled={sendingProposal}
              style={{ padding: 8 }} accessibilityRole="button">
              <Text style={{ color: theme.textSecondary, fontWeight: '700', textAlign: 'center' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>
      <View style={styles.dashboardContainer}>
        {!compactShell ? <Sidebar /> : null}

        <View style={styles.mainContent}>
          <Header />

          <View style={styles.messagesLayout}>
            {/* ---------------------- COLUNA DA ESQUERDA ---------------------- */}
            {(!compactChat || !selectedConversation) ? (
            <View style={[styles.conversationsPanel, compactChat && styles.conversationsPanelCompact]}>
              <View style={styles.pageHeader}>
                <Text style={styles.pageTitle}>Mensagens</Text>
                <Text style={styles.pageSubtitle}> 
                  Você tem {totalUnread} mensagens não lidas
                </Text>
              </View>

              <ScrollView
                style={styles.conversationsScroll}
                showsVerticalScrollIndicator={true}
              >
                {requestError ? <Text style={styles.errorText}>{requestError}</Text> : null}
                {!loadingConversations && conversations.length === 0 ? (
                  <View style={styles.emptyConversations}>
                    <Text style={styles.pageSubtitle}>Você ainda não tem conversas.</Text>
                    <Text style={styles.pageSubtitle}>Acesse Descobrir e toque em “Ver perfil” para iniciar uma mensagem.</Text>
                  </View>
                ) : null}
                {conversations.map((item) => {
                  const IconComponent = item.icon;
                  const avatarBg = isLightMode ? item.lightBgColor : item.darkBgColor;
                  const isActive = item.id === selectedId;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.conversationItem,
                        isActive && styles.conversationItemActive,
                      ]}
                      activeOpacity={0.8}
                      onPress={() => setSelectedId(item.id)}
                      accessibilityRole="button"
                    >
                      <View style={[styles.avatarContainer, { backgroundColor: avatarBg }]}>
                        {item.fotoPerfil ? <Image source={{ uri: item.fotoPerfil }} style={styles.avatarImage}
                          accessible={false} /> : <IconComponent size={20} color={item.iconColor} />}
                      </View>

                      <View style={styles.conversationDetails}>
                        <View style={styles.conversationTopRow}>
                          <Text style={styles.conversationName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.conversationTime}>{item.time}</Text>
                        </View>
                        <Text style={styles.conversationCategory} numberOfLines={1}>
                          {item.category}
                        </Text>
                        <View style={styles.conversationBottomRow}>
                          <Text style={styles.conversationLastMessage} numberOfLines={1}>
                            {item.lastMessage}
                          </Text>
                          {item.unread > 0 && (
                            <View style={styles.unreadBadge}>
                              <Text style={styles.unreadBadgeText}>{item.unread}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            ) : null}

            {/* ------------------------- PAINEL DO CHAT ------------------------ */}
            {(!compactChat || !!selectedConversation) ? (
            <View style={styles.chatPanel}>
              {selectedConversation && SelectedIcon && (
                <>
                  <View style={styles.chatHeader}>
                    <View style={styles.chatHeaderLeft}>
                      {compactChat ? (
                        <TouchableOpacity
                          style={styles.chatBackButton}
                          onPress={() => setSelectedId('')}
                          accessibilityRole="button"
                          accessibilityLabel="Voltar para conversas"
                        >
                          <ArrowLeft size={20} color={theme.textPrimary} accessible={false} />
                        </TouchableOpacity>
                      ) : null}
                      <View
                        style={[
                          styles.chatAvatar,
                          {
                            backgroundColor: isLightMode
                              ? selectedConversation.lightBgColor
                              : selectedConversation.darkBgColor,
                          },
                        ]}
                      >
                        {selectedConversation.fotoPerfil ? <Image source={{ uri: selectedConversation.fotoPerfil }} style={styles.chatAvatarImage}
                          accessible={false} /> : <SelectedIcon size={18} color={selectedConversation.iconColor} />}
                      </View>
                      <View style={{ flexShrink: 1, minWidth: 0 }}>
                        <Text style={styles.chatHeaderName} numberOfLines={1}>{selectedConversation.name}</Text>
                        <View style={styles.statusRow}>
                          <View style={styles.statusDot} />
                          <Text style={styles.statusText}>{selectedConversation.status}</Text>
                        </View>
                      </View>
                    </View>

                    {podeSolicitarContratacao ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, flexWrap: 'wrap' }}>
                        <TouchableOpacity style={styles.btnConfirm} activeOpacity={0.85}
                          onPress={() => setProposalVisible(true)} accessibilityRole="button"
                          accessibilityLabel={`Solicitar contratação de ${selectedConversation.name}`}>
                          <Text style={styles.btnConfirmText}>Solicitar contratação</Text>
                        </TouchableOpacity>
                        {viewportWidth >= 1320 ? (
                          <TouchableOpacity onPress={() => router.push({ pathname: '/pages/contratacoes/Contratar',
                              params: { id: String(selectedConversation.artistaId) } } as any)}
                            accessibilityRole="button" accessibilityLabel="Abrir formulário completo de contratação"
                            style={{ paddingVertical: 10, paddingHorizontal: 8 }}>
                            <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 12 }}>Formulário completo</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  {(proposals.length > 0 || proposalError) ? (
                    <ScrollView style={{ flexGrow: 0, maxHeight: Math.min(225, Math.max(110, viewportHeight * 0.25)), borderBottomWidth: 1, borderBottomColor: theme.borderColor }}
                      contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}
                      nestedScrollEnabled>
                      {proposalError ? <Text style={{ color: theme.danger || '#B42318', fontSize: 12 }}>{proposalError}</Text> : null}
                      {proposals.map((proposta) => {
                        const pendente = proposta.status === 'em_negociacao';
                        return (
                          <View key={proposta.id} style={{ backgroundColor: theme.cardBg,
                            borderWidth: 1, borderColor: theme.borderColor, borderLeftWidth: 4,
                            borderLeftColor: theme.accent, borderRadius: 14, padding: 12, gap: 5 }}>
                            <Text style={{ color: theme.textPrimary, fontWeight: '900', fontSize: 13 }}>
                              Solicitação de contratação #{proposta.id}
                            </Text>
                            <Text style={{ color: theme.textPrimary, fontSize: 12 }} numberOfLines={2}>
                              {proposta.descricao_escopo}
                            </Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                              {formatarMoeda(proposta.valor_proposto)} · {statusPropostaLabel(proposta)}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                              <TouchableOpacity onPress={() => router.push({ pathname: '/pages/contratacoes/detalhes',
                                  params: { id: String(proposta.id) } })} accessibilityRole="button"
                                style={{ paddingVertical: 4 }}>
                                <Text style={{ color: theme.accent, fontWeight: '800', fontSize: 12 }}>Ver em Contratações</Text>
                              </TouchableOpacity>
                              {pendente && proposta.papel_atual === 'artista' && proposta.pode_responder ? (
                                <>
                                  <TouchableOpacity disabled={respondendoPropostaId !== null}
                                    onPress={() => void responderSolicitacao(proposta, 'aceitar')} accessibilityRole="button">
                                    <Text style={{ color: theme.success || '#16794B', fontWeight: '800', fontSize: 12 }}>
                                      {respondendoPropostaId === proposta.id ? 'Salvando...' : 'Aceitar'}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity disabled={respondendoPropostaId !== null}
                                    onPress={() => void responderSolicitacao(proposta, 'recusar')} accessibilityRole="button">
                                    <Text style={{ color: theme.danger || '#B42318', fontWeight: '800', fontSize: 12 }}>Recusar</Text>
                                  </TouchableOpacity>
                                </>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                  <ScrollView
                    ref={messagesScrollRef}
                    style={styles.messagesScroll}
                    contentContainerStyle={styles.messagesScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {loadingMessages && messages.length === 0 ? <Text style={styles.pageSubtitle}>Carregando mensagens...</Text> : null}
                    {!loadingMessages && messages.length === 0 ? <Text style={styles.pageSubtitle}>Ainda não há mensagens. Envie a primeira!</Text> : null}
                    {messages.map((msg, index) => {
                      const isHovered = hoveredMessageId === msg.id;
                      const isMenuOpen = activeMenuMessageId === msg.id;
                      const msgDate = msg.criadoEm ? new Date(msg.criadoEm) : null;
                      const previousDate = index > 0 && messages[index - 1].criadoEm
                        ? new Date(messages[index - 1].criadoEm as string) : null;
                      const dayKey = msgDate && !Number.isNaN(msgDate.getTime())
                        ? `${msgDate.getFullYear()}-${msgDate.getMonth()}-${msgDate.getDate()}` : null;
                      const previousDayKey = previousDate && !Number.isNaN(previousDate.getTime())
                        ? `${previousDate.getFullYear()}-${previousDate.getMonth()}-${previousDate.getDate()}` : null;
                      const showDateDivider = !!dayKey && dayKey !== previousDayKey;
                      const today = new Date();
                      const yesterday = new Date();
                      yesterday.setDate(today.getDate() - 1);
                      const labelDate = msgDate && dayKey
                        ? dayKey === `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
                          ? 'Hoje'
                          : dayKey === `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`
                            ? 'Ontem'
                            : msgDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                        : '';

                      return (
                        <React.Fragment key={msg.id}>
                          {showDateDivider && (
                            <View style={styles.messageDateDivider}>
                              <Text style={styles.messageDateDividerText}>{labelDate}</Text>
                            </View>
                          )}
                          <View
                          style={[
                            styles.bubbleRow,
                            msg.fromMe ? styles.bubbleRowRight : styles.bubbleRowLeft,
                          ]}
                          {...(Platform.OS === 'web' ? {
                            onMouseEnter: () => setHoveredMessageId(msg.id),
                            onMouseLeave: () => {
                              if (!isMenuOpen) setHoveredMessageId(null);
                            },
                          } : {})}
                        >
                          <View
                            style={[
                              styles.bubble,
                              msg.fromMe ? styles.bubbleMine : styles.bubbleTheirs,
                            ]}
                          >
                            {/* Três pontinhos estilo WhatsApp */}
                            {(isHovered || isMenuOpen) && (
                              <TouchableOpacity
                                style={styles.whatsappOptionsButton}
                                onPress={() => setActiveMenuMessageId(isMenuOpen ? null : msg.id)}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={"Mais opções da mensagem"}
                              >
                                <MoreHorizontal size={16} color={msg.fromMe ? '#FFFFFF' : theme.textSecondary} />
                              </TouchableOpacity>
                            )}

                            {/* Menu Dropdown elegante */}
                            {isMenuOpen && (
                              <View 
                                style={[
                                  styles.messageDropdownMenu,
                                  msg.fromMe ? styles.dropdownMenuRight : styles.dropdownMenuLeft,
                                ]}
                              >
                                <TouchableOpacity 
                                  style={styles.menuDropdownItem}
                                  onPress={() => {
                                    setModalDadosMensagem(msg);
                                    setActiveMenuMessageId(null);
                                  }}
                                  accessibilityRole="button"
                                >
                                  <Info size={14} color={theme.textPrimary} />
                                  <Text style={styles.menuDropdownText}>Dados da mensagem</Text>
                                </TouchableOpacity>

                                {msg.fromMe && (
                                  <TouchableOpacity 
                                    style={styles.menuDropdownItem}
                                    onPress={() => handleDeleteMessage(msg.id, msg.fromMe)}
                                    accessibilityRole="button"
                                  >
                                    <Trash2 size={14} color="#E05A10" />
                                    <Text style={[styles.menuDropdownText, { color: '#E05A10' }]}>Deletar mensagem</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            )}

                            {msg.mediaUri && (
                              <TouchableOpacity 
                                activeOpacity={0.9} 
                                onPress={() => setMidiaVisualizacao({ uri: msg.mediaUri!, type: msg.mediaType || 'image' })}
                                style={styles.mediaPreviewWrapper}
                                accessibilityRole="button"
                                accessibilityLabel={msg.mediaType === 'video' ? 'Abrir vídeo da mensagem' : 'Abrir imagem da mensagem'}
                              >
                                {msg.mediaType === 'video' ? (
                                  <View style={styles.videoThumbnailContainer}>
                                    <AppVideo
                                      uri={msg.mediaUri}
                                      style={styles.chatImageMessage}
                                      contentFit="contain"
                                      nativeControls={false}
                                      muted
                                      startAt={1}
                                      accessibilityLabel="Prévia do vídeo enviado na conversa"
                                    />
                                    <View style={styles.playButtonOverlay}>
                                      <Play size={24} color="#FFF" />
                                    </View>
                                  </View>
                                ) : (
                                  <Image source={{ uri: msg.mediaUri }} style={styles.chatImageMessage}
                                    accessible={false} />
                                )}
                              </TouchableOpacity>
                            )}

                            {msg.text ? (
                              <Text
                                style={[
                                  msg.fromMe ? styles.bubbleTextMine : styles.bubbleTextTheirs,
                                  msg.mediaUri ? { marginTop: 6 } : {}
                                ]}
                              >
                                {msg.text}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={styles.bubbleTime}>{msg.enviando ? 'Enviando...' : msg.time}</Text>
                        </View>
                        </React.Fragment>
                      );
                    })}
                  </ScrollView>

                  {midiaAnexada && (
                    <View style={styles.anexoAviso}>
                      <View style={styles.previewAnexoContainer}>
                        {midiaAnexada.type === 'video' ? (
                          <View style={styles.miniVideoBox}><Play size={16} color="#FFF" /></View>
                        ) : (
                          <Image source={{ uri: midiaAnexada.uri }} style={styles.miniImagePreview}
                            accessible={false} />
                        )}
                        <Text style={styles.anexoAvisoTexto} numberOfLines={1}>Mídia pronta para envio</Text>
                      </View>
                      <TouchableOpacity onPress={() => setMidiaAnexada(null)}
                        accessibilityRole="button"
                        accessibilityLabel={"Remover mídia anexada"}>
                        <X size={18} color="#E05A10" />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Escreva sua mensagem... (Enter envia / Shift+Enter quebra linha)"
                      placeholderTextColor={theme.textSecondary}
                      value={messageText}
                      onChangeText={setMessageText}
                      multiline={true}
                      numberOfLines={3}
                      maxLength={LIMITE_CARACTERES}
                      textAlignVertical="top"
                      onKeyPress={handleKeyPress}
                      accessibilityLabel="Campo de mensagem"
                    />

                    <TouchableOpacity 
                      style={styles.cameraButton} 
                      activeOpacity={0.8}
                      onPress={handleSelecionarMidia}
                      accessibilityRole="button"
                      accessibilityLabel={"Anexar imagem ou vídeo"}
                    >
                      <Camera size={18} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.sendButton} 
                      activeOpacity={0.85}
                      onPress={handleSendMessage}
                      accessibilityRole="button"
                      accessibilityLabel={"Enviar mensagem"}
                    >
                      <Send size={16} color="#f6f6f7" />
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {!selectedConversation && (
                <View style={styles.chatEmptyState}>
                  <View style={styles.chatEmptyIcon} accessible={false}>
                    <MessageSquare size={28} color={theme.accent} accessible={false} />
                  </View>
                  <Text style={styles.chatEmptyTitle}>Suas conversas</Text>
                  <Text style={styles.chatEmptyText}>Selecione uma conversa ao lado para ler e enviar mensagens.</Text>
                </View>
              )}
            </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Modal para Visualizar e Reproduzir Imagem ou Vídeo em Tela Cheia */}
      <Modal visible={!!midiaVisualizacao} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalCloseButton} 
            onPress={() => setMidiaVisualizacao(null)}
            accessibilityRole="button"
            accessibilityLabel={"Fechar"}
          >
            <X size={28} color="#FFF" />
          </TouchableOpacity>

          {midiaVisualizacao?.type === 'video' ? (
            <AppVideo
              uri={midiaVisualizacao.uri}
              style={styles.modalVideoFull}
              contentFit="contain"
              nativeControls
              autoPlay
              accessibilityLabel="Vídeo da conversa em tela cheia"
            />
          ) : (
            midiaVisualizacao && (
              <Image 
                source={{ uri: midiaVisualizacao.uri }} 
                style={styles.modalImageFull} 
                resizeMode="contain"
                accessibilityLabel={"Imagem da mensagem em tela cheia"} 
              />
            )
          )}
        </View>
      </Modal>

      {/* Modal de Dados da Mensagem */}
      <Modal visible={!!modalDadosMensagem} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.dadosModalContent}>
            <View style={styles.dadosModalHeader}>
              <Text style={styles.dadosModalTitle}>Dados da Mensagem</Text>
              <TouchableOpacity onPress={() => setModalDadosMensagem(null)}
                accessibilityRole="button"
                accessibilityLabel={"Fechar"}>
                <X size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.dadosModalBody}>
              <Text style={styles.dadosLabel}>Enviado por: <Text style={styles.dadosValue}>{modalDadosMensagem?.fromMe ? 'Você' : selectedConversation?.name}</Text></Text>
              <Text style={styles.dadosLabel}>Horário: <Text style={styles.dadosValue}>{modalDadosMensagem?.time}</Text></Text>
              <Text style={styles.dadosLabel}>Tipo de Conteúdo: <Text style={styles.dadosValue}>{modalDadosMensagem?.mediaType ? `Mídia (${modalDadosMensagem.mediaType})` : 'Apenas Texto'}</Text></Text>
              <Text style={styles.dadosLabel}>ID da Mensagem: <Text style={styles.dadosValue}>{modalDadosMensagem?.id}</Text></Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// 3) ESTILOS
// ---------------------------------------------------------------------------
const getStyles = (theme: any, compactChat: boolean, viewportWidth: number, viewportHeight: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.mainBg,
      ...Platform.select({ web: { height: viewportWidth < DESKTOP_BREAKPOINT ? '100dvh' as any : '100vh' as any, overflow: 'hidden' } }),
    },
    dashboardContainer: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: theme.mainBg,
      ...Platform.select({ web: { height: viewportWidth < DESKTOP_BREAKPOINT ? '100dvh' as any : '100vh' as any, overflow: 'hidden' } }),
    },
    mainContent: {
      flex: 1,
      backgroundColor: theme.mainBg,
      ...Platform.select({
        web: { height: viewportWidth < DESKTOP_BREAKPOINT ? '100dvh' as any : '100vh' as any, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
      }),
    },
    messagesLayout: {
      flex: 1,
      minHeight: 0,
      flexDirection: 'row',
      overflow: 'hidden',
    },
    conversationsPanel: {
      width: 320,
      borderRightWidth: 1,
      borderRightColor: theme.borderColor,
      paddingHorizontal: 18,
      paddingTop: 18,
      backgroundColor: theme.mainBg,
    },
    conversationsPanelCompact: {
      width: '100%',
      borderRightWidth: 0,
      paddingHorizontal: 16,
      paddingTop: 18,
      backgroundColor: theme.mainBg,
    },
    pageHeader: {
      marginBottom: 14,
      padding: 16,
      borderRadius: 18,
      backgroundColor: theme.heroBg || theme.textPrimary,
      overflow: 'hidden',
    },
    pageTitle: {
      fontSize: compactChat ? 24 : 26,
      fontWeight: '850' as any,
      color: theme.heroText || '#FFFFFF',
      fontFamily: 'serif',
      letterSpacing: -0.3,
    },
    pageSubtitle: {
      fontSize: 12,
      color: theme.heroMuted || '#E6D8CF',
      marginTop: 4,
    },
    conversationsScroll: {
      flex: 1,
    },
    conversationItem: {
      flexDirection: 'row',
      padding: 11,
      minHeight: 66,
      borderRadius: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.borderColor,
      backgroundColor: theme.cardBg,
    },
    conversationItemActive: {
      backgroundColor: theme.accentSoft || theme.cardBg,
      borderColor: theme.accent,
      ...Platform.select({ web: { boxShadow: `0 6px 18px ${theme.shadowColor || 'rgba(0,0,0,0.05)'}` } }),
    },
    avatarImage: { width: 42, height: 42, borderRadius: 14 },
    chatAvatarImage: { width: 36, height: 36, borderRadius: 18 },
    errorText: { color: '#E05A10', fontSize: 12, marginVertical: 8 },
    emptyConversations: { paddingVertical: 20, gap: 8 },
    avatarContainer: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    conversationDetails: {
      flex: 1,
      justifyContent: 'center',
    },
    conversationTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    conversationName: {
      fontSize: 14,
      fontWeight: '850' as any,
      color: theme.textPrimary,
      flexShrink: 1,
    },
    conversationTime: {
      fontSize: 10,
      color: theme.textSecondary,
      marginLeft: 6,
    },
    conversationCategory: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 1,
    },
    conversationBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    conversationLastMessage: {
      fontSize: 11,
      color: theme.textSecondary,
      flex: 1,
    },
    unreadBadge: {
      backgroundColor: theme.accent,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
      marginLeft: 6,
    },
    unreadBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
    },
    chatPanel: {
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      flexDirection: 'column',
    },
    chatEmptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    chatEmptyIcon: {
      width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.accentSoft || theme.menuActiveBg, marginBottom: 14,
    },
    chatEmptyTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 6 },
    chatEmptyText: { color: theme.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 360 },
    chatHeader: {
      flexDirection: compactChat ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: compactChat ? 'stretch' : 'center',
      gap: compactChat ? 12 : 0,
      paddingHorizontal: compactChat ? 14 : 24,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: theme.borderColor,
      backgroundColor: theme.cardBg,
      borderRadius: 20,
      marginHorizontal: compactChat ? 10 : 16,
      marginTop: 10,
      ...Platform.select({ web: { boxShadow: `0 10px 26px ${theme.shadowColor}` } }),
    },
    chatHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
    },
    chatBackButton: {
      width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: theme.borderColor, backgroundColor: theme.surfaceMuted || theme.mainBg, marginRight: 10,
    },
    chatAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    chatHeaderName: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#2ECC71',
      marginRight: 4,
    },
    statusText: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    btnConfirm: {
      backgroundColor: theme.accent,
      minHeight: 40,
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: compactChat ? 'stretch' : 'auto',
    },
    btnConfirmText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    messagesScroll: {
      flex: 1,
      minHeight: 0,
      paddingHorizontal: compactChat ? 12 : 24,
    },
    messagesScrollContent: {
      paddingVertical: 16,
    },
    messageDateDivider: {
      alignSelf: 'center',
      paddingHorizontal: 14,
      paddingVertical: 6,
      marginTop: 8,
      marginBottom: 18,
      borderRadius: 12,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    messageDateDividerText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    bubbleRow: {
      marginBottom: 14,
      maxWidth: '75%',
    },
    bubbleRowLeft: {
      alignSelf: 'flex-start',
      alignItems: 'flex-start',
    },
    bubbleRowRight: {
      alignSelf: 'flex-end',
      alignItems: 'flex-end',
    },
    bubble: {
      borderRadius: 18,
      paddingVertical: 10,
      paddingHorizontal: 12,
      paddingRight: 28,
      position: 'relative',
      ...Platform.select({
        web: {
          display: 'inline-flex',
          maxWidth: '100%',
          width: 'fit-content',
        },
      }),
    },
    bubbleTheirs: {
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderTopLeftRadius: 5,
    },
    bubbleMine: {
      backgroundColor: theme.backgroundColor,
      borderTopRightRadius: 5,
    },
    whatsappOptionsButton: {
      position: 'absolute',
      top: 6,
      right: 6,
      padding: 2,
      zIndex: 5,
    },
    messageDropdownMenu: {
      position: 'absolute',
      top: 26,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 8,
      paddingVertical: 4,
      width: 160,
      zIndex: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 5,
    },
    dropdownMenuLeft: {
      left: 4,
    },
    dropdownMenuRight: {
      right: 4,
    },
    menuDropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    menuDropdownText: {
      fontSize: 12,
      color: theme.textPrimary,
      marginLeft: 8,
    },
    bubbleTextTheirs: {
      color: theme.textPrimary,
      fontSize: 13,
      lineHeight: 18,
      flexWrap: 'wrap',
      ...Platform.select({ web: { wordBreak: 'break-word' } }),
    },
    bubbleTextMine: {
      color: '#ffffffe7',
      fontSize: 13,
      lineHeight: 18,
      flexWrap: 'wrap',
      ...Platform.select({ web: { wordBreak: 'break-word' } }),
    },
    bubbleTime: {
      fontSize: 10,
      color: theme.textSecondary,
      marginTop: 4,
    },
    mediaPreviewWrapper: {
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 2,
    },
    chatImageMessage: {
      width: Math.min(220, Math.max(130, viewportWidth - 110)),
      height: Math.min(150, Math.max(90, (viewportWidth - 110) * 0.68)),
      borderRadius: 8,
      resizeMode: 'cover',
    },
    exactVideoSize: {
      width: Math.min(220, Math.max(130, viewportWidth - 110)),
      height: Math.min(150, Math.max(90, (viewportWidth - 110) * 0.68)),
      borderRadius: 8,
    },
    modalExactVideoSize: {
      width: viewportWidth * 0.9,
      height: viewportHeight * 0.8,
    },
    videoThumbnailContainer: {
      width: Math.min(220, Math.max(130, viewportWidth - 110)),
      height: Math.min(150, Math.max(90, (viewportWidth - 110) * 0.68)),
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
    },
    playButtonOverlay: {
      position: 'absolute',
      backgroundColor: 'rgba(0,0,0,0.4)',
      borderRadius: 20,
      padding: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    anexoAviso: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 8,
      backgroundColor: theme.cardBg,
      borderTopWidth: 1,
      borderTopColor: theme.borderColor,
    },
    previewAnexoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    miniImagePreview: {
      width: 32,
      height: 32,
      borderRadius: 4,
      marginRight: 8,
    },
    miniVideoBox: {
      width: 32,
      height: 32,
      borderRadius: 4,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    anexoAvisoTexto: {
      fontSize: 12,
      color: theme.textPrimary,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: compactChat ? 12 : 20,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: theme.borderColor,
      backgroundColor: theme.surfaceRaised || theme.cardBg,
    },
    cameraButton: {
      padding: 8,
      marginLeft: 8,
    },
    textInput: {
      flex: 1,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'web' ? 10 : 8,
      color: theme.textPrimary,
      fontSize: 13,
      maxHeight: 100,
    },
    sendButton: {
      backgroundColor: theme.sendBtnBg,
      width: 42,
      height: 42,
      borderRadius: 14,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.95)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCloseButton: {
      position: 'absolute',
      top: 40,
      right: 30,
      zIndex: 10,
      padding: 10,
    },
    modalImageFull: {
      width: viewportWidth * 0.9,
      height: viewportHeight * 0.8,
    },
    modalVideoFull: {
      width: viewportWidth * 0.9,
      height: viewportHeight * 0.8,
    },
    dadosModalContent: {
      width: Math.min(320, Math.max(240, viewportWidth - 32)),
      maxWidth: '100%',
      backgroundColor: theme.cardBg,
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    dadosModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    dadosModalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    dadosModalBody: {
      gap: 8,
    },
    dadosLabel: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    dadosValue: {
      fontWeight: '600',
      color: theme.textPrimary,
    },
  } as any);