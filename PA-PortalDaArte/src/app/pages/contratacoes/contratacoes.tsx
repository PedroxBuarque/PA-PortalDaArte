import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Music,
  Headphones,
  Mic,
} from 'lucide-react-native';

// Importações dos Componentes e do Contexto
import Sidebar from '../../../components/Sidebar';
import Header from '../../../components/Header';
import { useTheme } from '../../../components/context/ThemeContext';

const CONTRATACOES_LIST = [
  {
    id: '1',
    name: 'Lucas Andrade',
    category: 'Violão e Voz',
    date: '24/11/2026 - 20:00',
    location: 'Recife, PE',
    status: 'Pendente',
    icon: Music,
    darkBgColor: '#3D2218',
    lightBgColor: '#FDE4D9',
    iconColor: '#E05A10',
  },
  {
    id: '2',
    name: 'Banda Vereda',
    category: 'Forró • 5 integrantes',
    date: '24/11/2026 - 20:00',
    location: 'São Paulo, SP',
    status: 'Confirmado',
    icon: Music,
    darkBgColor: '#412C1B',
    lightBgColor: '#FDE4D9',
    iconColor: '#E05A10',
  },
  {
    id: '3',
    name: 'DJ Marina',
    category: 'Eletrônica • DJ Set',
    date: '24/11/2026 - 20:00',
    location: 'Recife, PE',
    status: 'Concluido',
    icon: Headphones,
    darkBgColor: '#2E2243',
    lightBgColor: '#EBE4FA',
    iconColor: '#8C52FF',
  },
  {
    id: '4',
    name: 'Juliana Diniz',
    category: 'MPB • Cantora',
    date: '24/11/2026 - 20:00',
    location: 'Recife, PE',
    status: 'Concluido',
    icon: Mic,
    darkBgColor: '#1B3736',
    lightBgColor: '#E0F2F1',
    iconColor: '#20B2AA',
  },
];

// Função auxiliar para definir as cores da etiqueta de status
const getStatusStyles = (status: string) => {
  switch (status) {
    case 'Pendente':
      return { backgroundColor: '#F2994A' }; // Laranja
    case 'Confirmado':
      return { backgroundColor: '#56CCF2' }; // Azul claro
    case 'Concluido':
      return { backgroundColor: '#27AE60' }; // Verde
    default:
      return { backgroundColor: '#BDBDBD' }; // Cinza padrão
  }
};

export default function ContratacoesScreen() {
  const { theme, isLightMode } = useTheme();
  const styles = getStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle={isLightMode ? "dark-content" : "light-content"} 
        backgroundColor={theme.headerBg} 
      />

      <View style={styles.dashboardContainer}>
        
        {/* Passamos 'contratacoes' para marcar o menu ativo correto na Sidebar */}
        <Sidebar activeRoute="contratacoes" />

        <View style={styles.mainContent}>
          <Header />

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentWrapper}>
              <View style={styles.pageHeader}>
                <Text style={styles.pageTitle}>Contratações</Text>
              </View>

              <View style={styles.cardsContainer}>
                {CONTRATACOES_LIST.map((item) => {
                  const IconComponent = item.icon;
                  const avatarBg = isLightMode ? item.lightBgColor : item.darkBgColor;

                  return (
                    <View key={item.id} style={styles.card}>
                      <View style={styles.cardLeftGroup}>
                        <View style={[styles.avatarContainer, { backgroundColor: avatarBg }]}>
                          <IconComponent size={24} color={item.iconColor} />
                        </View>
                        <View style={styles.artistDetails}>
                          <View style={styles.nameCategoryRow}>
                            <Text style={styles.artistName}>{item.name}</Text>
                            <Text style={styles.artistCategory}>{item.category}</Text>
                          </View>
                          <Text style={styles.infoText}>{item.date}</Text>
                          <Text style={styles.infoText}>{item.location}</Text>
                        </View>
                      </View>

                      <View style={styles.cardRightGroup}>
                        <View style={[styles.statusBadge, getStatusStyles(item.status)]}>
                          <Text style={styles.statusText}>{item.status}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
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
    ...Platform.select({
      web: {
        height: '100vh',
        overflow: 'hidden',
      },
    }),
  },
  dashboardContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.mainBg,
    ...Platform.select({
      web: {
        height: '100vh',
        overflow: 'hidden',
      },
    }),
  },
  mainContent: {
    flex: 1,
    backgroundColor: theme.mainBg,
    ...Platform.select({
      web: {
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      },
    }),
  },
  scrollView: {
    flex: 1,
    ...Platform.select({
      web: {
        scrollbarWidth: 'none', 
        msOverflowStyle: 'none', 
      },
    }),
  },
  scrollContentContainer: {
    flexGrow: 1,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 3,
    paddingBottom: 24,
  },
  pageHeader: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  cardsContainer: {
    gap: 14,
    paddingBottom: 8,
  },
  card: {
    backgroundColor: theme.cardBg,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  cardLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  artistDetails: {
    justifyContent: 'center',
  },
  nameCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  artistName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginRight: 8,
  },
  artistCategory: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  infoText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  cardRightGroup: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  }
});