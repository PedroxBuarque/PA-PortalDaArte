import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import {
  Music,
  Headphones,
  Mic,
  Home,
  Send,
} from 'lucide-react-native';

// Importações dos Componentes e do Contexto
// (mesmos caminhos usados na tela de Favoritos — ajuste se sua pasta tiver outro nível)
import Sidebar from '../../../components/Sidebar';
import Header from '../../../components/Header';
import { useTheme } from '../../../components/context/ThemeContext';

// ---------------------------------------------------------------------------
// 1) DADOS FIXOS (no futuro isso viria de uma API/back-end)
// ---------------------------------------------------------------------------

// Lista de conversas que aparece na coluna da esquerda
const CONVERSATIONS = [
  {
    id: '1',
    name: 'Juliana Diniz',
    category: 'Cantora • MPB',
    lastMessage: 'Sobre a contratação',
    time: '19:30',
    unread: 2,
    icon: Mic,
    darkBgColor: '#1B3736',
    lightBgColor: '#E0F2F1',
    iconColor: '#20B2AA',
    status: 'Online agora',
  },
  {
    id: '2',
    name: 'Banda Vereda',
    category: 'Forró • 5 integrantes',
    lastMessage: 'Envio de proposta',
    time: 'Ontem',
    unread: 0,
    icon: Music,
    darkBgColor: '#412C1B',
    lightBgColor: '#FDE4D9',
    iconColor: '#E05A10',
    status: 'Offline',
  },
  {
    id: '3',
    name: 'Lucas Andrade',
    category: 'Violão e Voz',
    lastMessage: 'Disponibilidade',
    time: '12/08',
    unread: 0,
    icon: Music,
    darkBgColor: '#3D2218',
    lightBgColor: '#FDE4D9',
    iconColor: '#E05A10',
    status: 'Offline',
  },
  {
    id: '4',
    name: 'DJ Marina',
    category: 'Eletrônica • DJ Set',
    lastMessage: 'Obrigado!',
    time: '10/08',
    unread: 0,
    icon: Headphones,
    darkBgColor: '#2E2243',
    lightBgColor: '#EBE4FA',
    iconColor: '#8C52FF',
    status: 'Offline',
  },
];

// Formato de cada mensagem individual dentro de uma conversa
type Mensagem = {
  id: string;
  fromMe: boolean;
  text: string;
  time: string;
};

// Mensagens de cada conversa, organizadas por id da conversa.
// O tipo "Record<string, Mensagem[]>" diz ao TypeScript: "a chave é um texto
// qualquer, e o valor é sempre uma lista de Mensagem" — isso evita o erro
// "Element implicitly has an 'any' type" ao acessar MESSAGES_BY_CONVERSATION[selectedId].
const MESSAGES_BY_CONVERSATION: Record<string, Mensagem[]> = { 
  
  '1': [ 
    { id: 'm1', fromMe: true, text: 'Olá Juliana, podemos confirmar sua contratação para um casamento?', time: '18:13' },
    { id: 'm2', fromMe: false, text: 'Olá Clara! está tudo pronto pra o show, pode fechar sim.', time: '18:15' },
    { id: 'm3', fromMe: true, text: 'Perfeito! Já reservei a data de 24/08 aqui na minha agenda de apresentações.', time: '19:32' },
    { id: 'm4', fromMe: false, text: 'Apenas uma dúvida: o local já conta com equipamento de som ou eu devo incluir no orçamento?', time: '19:34' },
  ],
  '2': [
    { id: 'm1', fromMe: false, text: 'Enviei a proposta atualizada, dá uma olhada quando puder!', time: 'Ontem' },
  ],
  '3': [
    { id: 'm1', fromMe: false, text: 'Tenho disponibilidade sim, qual seria a data do evento?', time: '12/08' },
  ],
  '4': [
    { id: 'm1', fromMe: false, text: 'Obrigado pela contratação, foi um prazer tocar no seu evento!', time: '10/08' },
  ],
};

export default function MensagensScreen() {
  const { theme, isLightMode } = useTheme();
  // Mesmo ajuste feito no favoritos/index.tsx: o projeto usa react-native-web
  // (via Expo Router), que define "cursor" de forma incompatível com o React
  // Native puro nos estilos que usam Platform.select({ web: {...} }).
  const styles = getStyles(theme) as any;

  // -------------------------------------------------------------------------
  // 2) ESTADO DA TELA (o que pode mudar enquanto o usuário usa o app)
  // -------------------------------------------------------------------------

  // Qual conversa está selecionada agora (por padrão, a primeira da lista)
  const [selectedId, setSelectedId] = useState(CONVERSATIONS[0].id);
  // O que o usuário está digitando na caixa de texto
  const [messageText, setMessageText] = useState('');
   

  // Busca o objeto completo da conversa selecionada
  const selectedConversation = CONVERSATIONS.find((c) => c.id === selectedId);
  // Guardamos o ícone numa variável ANTES do JSX — isso evita o erro de TypeScript
  // "Object is possibly undefined" que acontece quando se usa `selectedConversation.icon`
  // direto como tag (ex: <selectedConversation.icon />) dentro da renderização.
  const SelectedIcon = selectedConversation?.icon;
  // Busca as mensagens dessa conversa (ou lista vazia, se não houver nenhuma)
  const messages = MESSAGES_BY_CONVERSATION[selectedId] || [];

  const totalUnread = CONVERSATIONS.reduce((sum, c) => sum + c.unread, 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isLightMode ? 'dark-content' : 'light-content'}
        backgroundColor={theme.headerBg}
      />
      <View style={[styles.caixaTexto, { backgroundColor: theme.chatBubbleMine }]}>
      </View>
      <View style={styles.dashboardContainer}>
        <Sidebar activeRoute="mensagens" />

        <View style={styles.mainContent}>
          <Header />

          <View style={styles.messagesLayout}>
            {/* ---------------------- COLUNA DA ESQUERDA ---------------------- */}
           
            <View style={styles.conversationsPanel}>
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
                {CONVERSATIONS.map((item) => {
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
                    >
                      <View style={[styles.avatarContainer, { backgroundColor: avatarBg }]}>
                        <IconComponent size={20} color={item.iconColor} />
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

            {/* ------------------------- PAINEL DO CHAT ------------------------ */}
            <View style={styles.chatPanel}>
              {selectedConversation && SelectedIcon && (
                <>
                  <View style={styles.chatHeader}>
                    <View style={styles.chatHeaderLeft}>
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
                        <SelectedIcon
                          size={18}
                          color={selectedConversation.iconColor}
                        />
                      </View>
                      <View>
                        <Text style={styles.chatHeaderName}>{selectedConversation.name}</Text>
                        <View style={styles.statusRow}>
                          <View style={styles.statusDot} />
                          <Text style={styles.statusText}>{selectedConversation.status}</Text>
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity style={styles.btnConfirm} activeOpacity={0.85}>
                      <Text style={styles.btnConfirmText}>Confirmar Contratação</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    style={styles.messagesScroll}
                    contentContainerStyle={styles.messagesScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {messages.map((msg) => (
                      <View
                        key={msg.id}
                        style={[
                          styles.bubbleRow,
                          msg.fromMe ? styles.bubbleRowRight : styles.bubbleRowLeft,
                        ]}
                      >
                        <View
                          style={[
                            styles.bubble,
                            msg.fromMe ? styles.bubbleMine : styles.bubbleTheirs,
                          ]}
                        >
                          <Text
                            style={
                              msg.fromMe ? styles.bubbleTextMine : styles.bubbleTextTheirs
                            }
                          >
                            {msg.text}
                          </Text>
                        </View>
                        <Text style={styles.bubbleTime}>{msg.time}</Text>
                      </View>
                    ))}
                  </ScrollView>

                  <View style={styles.inputRow}>
                    <TouchableOpacity style={styles.homeButton} activeOpacity={0.8}>
                      <Home size={18} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <TextInput
                      style={styles.textInput}
                      placeholder="Escreva sua mensagem sobre a contratação..."
                      placeholderTextColor={theme.textSecondary}
                      value={messageText}
                      onChangeText={setMessageText}
                    />

                    <TouchableOpacity style={styles.sendButton} activeOpacity={0.85}>
                      <Send size={16} color="#f6f6f7" />
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {!selectedConversation && (
                <View style={styles.chatEmptyState}>
                  <Text style={styles.pageSubtitle}>Selecione uma conversa</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// 3) ESTILOS — recebem "theme" e retornam cores diferentes no claro/escuro
// ---------------------------------------------------------------------------
// O "as any" no fechamento do StyleSheet.create abaixo existe pelo mesmo motivo
// do comentário lá em cima: valores como height: '100vh' só existem no mundo Web
// (react-native-web), e o TypeScript do React Native puro não reconhece isso como
// um tamanho válido.
const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.mainBg,
      ...Platform.select({ web: { height: '100vh', overflow: 'hidden' } }),
    },
    dashboardContainer: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: theme.mainBg,
      ...Platform.select({ web: { height: '100vh', overflow: 'hidden' } }),
    },
    mainContent: {
      flex: 1,
      backgroundColor: theme.mainBg,
      ...Platform.select({
        web: { height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
      }),
    },

    // Linha que junta a lista de conversas + o painel do chat
    messagesLayout: {
      flex: 1,
      flexDirection: 'row',
      overflow: 'hidden',
    },

    // ---------- Coluna esquerda (lista de conversas) ----------
    idm1:{
      backgroundColor: theme.accent,
    },
    conversationsPanel: {
      width: 300,
      borderRightWidth: 1,
      borderRightColor: theme.borderColor,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    pageHeader: {
      marginBottom: 12,
    },
    pageTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    pageSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    conversationsScroll: {
      flex: 1,
    },
    conversationItem: {
      flexDirection: 'row',
      padding: 10,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    conversationItemActive: {
      backgroundColor: theme.cardBg,
      borderColor: theme.accent,
    },
    avatarContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
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
      fontWeight: '700',
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

    // ---------- Painel do chat (direita) ----------
    chatPanel: {
      flex: 1,
      flexDirection: 'column',
    },
    chatEmptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    chatHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
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
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 6,
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
    bubbleRow: {
      marginBottom: 14,
      maxWidth: '70%',
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
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    bubbleTheirs: {
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderTopLeftRadius: 2,
    },
    bubbleMine: {
      backgroundColor: theme.backgroundColor, // <-- Troque este código Hexadecimal pela cor que você quer
      borderTopRightRadius: 2,
    },
    bubbleTextTheirs: {
      color: theme.textPrimary,
      fontSize: 13,
      lineHeight: 18,
    },
    bubbleTextMine: {
      color: '#ffffffe7',
      fontSize: 13,
      lineHeight: 18,
    },
    bubbleTime: {
      fontSize: 10,
      color: theme.textSecondary,
      marginTop: 4,
    },

    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: theme.borderColor,
    },
    homeButton: {
      padding: 8,
      marginRight: 8,
    },
    textInput: {
      flex: 1,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'web' ? 10 : 8,
      color: theme.textPrimary,
      fontSize: 13,
    },
    sendButton: {
      backgroundColor: theme.sendBtnBg,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
  } as any);