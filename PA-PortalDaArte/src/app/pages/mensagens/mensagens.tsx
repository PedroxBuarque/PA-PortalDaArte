import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, SafeAreaView, StatusBar, ScrollView, Platform, Alert, Image, Modal, useWindowDimensions } from 'react-native';
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

// Importações dos Componentes e do Contexto
import Sidebar from '../../../components/Sidebar';
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
};

export default function MensagensScreen() {
  const router = useRouter();
  const { theme, isLightMode } = useTheme();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const compactShell = viewportWidth < 900;
  const compactChat = viewportWidth < 760;
  const styles = getStyles(theme, compactChat, viewportWidth, viewportHeight) as any;

  const params = useLocalSearchParams<{ destinatarioId?: string | string[]; destinatarioNome?: string | string[]; conversaId?: string | string[] }>();
  const destinatarioId = Array.isArray(params.destinatarioId) ? params.destinatarioId[0] : params.destinatarioId;
  const conversaIdParam = Array.isArray(params.conversaId) ? params.conversaId[0] : params.conversaId;
  const [conversations, setConversations] = useState<ConversaUI[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
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

  const selectedConversation = conversations.find((c) => c.id === selectedId);
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
      podeContratar: Number(item.outro_usuario_id) === Number(item.artista_id),
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

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    (async () => {
      setLoadingMessages(true);
      try {
        const token = await getToken();
        const response = await fetch(`${URL_API}/api/conversas/${selectedId}/mensagens`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || 'Não foi possível carregar as mensagens.');
        const rows = Array.isArray(payload) ? payload : (payload.mensagens || []);
        if (active) setMessagesData((prev) => ({
          ...prev,
          [selectedId]: rows.map((row: any) => ({
            id: String(row.id),
            fromMe: Boolean(row.fromMe),
            text: String(row.text ?? row.conteudo ?? ''),
            time: String(row.time || ''),
            criadoEm: row.criado_em || row.created_at || row.createdAt || null,
            mediaUri: row.media_url || null,
            mediaType: row.media_type === 'video' ? 'video' : row.media_type === 'image' ? 'image' : null,
          })),
        }));
        if (active) setConversations((prev) => prev.map((c) => c.id === selectedId ? { ...c, unread: 0 } : c));
      } catch (error: any) {
        if (active) setRequestError(error?.message || 'Erro ao carregar as mensagens.');
      } finally {
        if (active) setLoadingMessages(false);
      }
    })();
    return () => { active = false; };
  }, [selectedId]);

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
    if (!selectedId || (!content && !midiaAnexada)) return;
    try {
      const token = await getToken();
      let response: Response;
      if (midiaAnexada) {
        const formData = new FormData();
        formData.append('conteudo', content);
        if (Platform.OS === 'web' && midiaAnexada.file) {
          formData.append('arquivo', midiaAnexada.file as any, midiaAnexada.name);
        } else {
          formData.append('arquivo', {
            uri: midiaAnexada.uri,
            name: midiaAnexada.name,
            type: midiaAnexada.mimeType,
          } as any);
        }
        response = await fetch(`${URL_API}/api/conversas/${selectedId}/mensagens/arquivo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        response = await fetch(`${URL_API}/api/conversas/${selectedId}/mensagens`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ conteudo: content }),
        });
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || 'Não foi possível enviar a mensagem.');
      const row = payload.mensagem;
      const novaMensagem: Mensagem = {
        id: String(row.id),
        fromMe: true,
        text: String(row.text ?? row.conteudo ?? content),
        time: String(row.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
        criadoEm: row.criado_em || new Date().toISOString(),
        mediaUri: row.media_url || null,
        mediaType: row.media_type === 'video' ? 'video' : row.media_type === 'image' ? 'image' : null,
      };
      setMessagesData((prev) => ({ ...prev, [selectedId]: [...(prev[selectedId] || []), novaMensagem] }));
      setTimeout(() => messagesScrollRef.current?.scrollToEnd({ animated: true }), 100);
      const preview = content || (novaMensagem.mediaType === 'video' ? '📎 Vídeo' : '📎 Imagem');
      setConversations((prev) => prev.map((c) => c.id === selectedId ? { ...c, lastMessage: preview, time: novaMensagem.time } : c));
      setMessageText('');
      setMidiaAnexada(null);
      setRequestError('');
    } catch (error: any) {
      Alert.alert('Erro ao enviar', error?.message || 'Não foi possível enviar a mensagem.');
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
                      <View>
                        <Text style={styles.chatHeaderName}>{selectedConversation.name}</Text>
                        <View style={styles.statusRow}>
                          <View style={styles.statusDot} />
                          <Text style={styles.statusText}>{selectedConversation.status}</Text>
                        </View>
                      </View>
                    </View>

                    {selectedConversation.podeContratar ? (
                      <TouchableOpacity
                        style={styles.btnConfirm}
                        activeOpacity={0.85}
                        onPress={() => router.push({ pathname: '/pages/contratacoes/Contratar', params: { id: String(selectedConversation.artistaId) } } as any)}
                        accessibilityRole="button"
                        accessibilityLabel={`Contratar ${selectedConversation.name}`}
                      >
                        <Text style={styles.btnConfirmText}>Confirmar Contratação</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

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
                          <Text style={styles.bubbleTime}>{msg.time}</Text>
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
      ...Platform.select({ web: { height: '100vh' as any, overflow: 'hidden' } }),
    },
    dashboardContainer: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: theme.mainBg,
      ...Platform.select({ web: { height: '100vh' as any, overflow: 'hidden' } }),
    },
    mainContent: {
      flex: 1,
      backgroundColor: theme.mainBg,
      ...Platform.select({
        web: { height: '100vh' as any, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
      }),
    },
    messagesLayout: {
      flex: 1,
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
      paddingHorizontal: 24,
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
      width: 220,
      height: 150,
      borderRadius: 8,
      resizeMode: 'cover',
    },
    exactVideoSize: {
      width: 220,
      height: 150,
      borderRadius: 8,
    },
    modalExactVideoSize: {
      width: viewportWidth * 0.9,
      height: viewportHeight * 0.8,
    },
    videoThumbnailContainer: {
      width: 220,
      height: 150,
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
      width: 320,
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