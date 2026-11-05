// import React from 'react';
// import {
//   StyleSheet,
//   Text,
//   View,
//   SafeAreaView,
//   StatusBar,
//   ScrollView,
//   Platform,
// } from 'react-native';
// import {
//   Music,
//   Headphones,
//   Mic,
// } from 'lucide-react-native';

// import CardContratacao, {
//   type Contratacao,
// } from '../../../components/contratacoes/CardContratacao';

// // Importações dos Componentes e do Contexto
// import Sidebar from '../../../components/Sidebar';
// import Header from '../../../components/Header';
// import { useTheme } from '../../../components/context/ThemeContext';

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
import { useRouter } from 'expo-router';

import CardContratacao from '../../../components/contratacoes/CardContratacao';
import { CONTRATACOES_LIST } from '../../../components/contratacoes/contratacoesData';

import Sidebar from '../../../components/Sidebar';
import Header from '../../../components/Header';
import { useTheme } from '../../../components/context/ThemeContext';


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
  const router = useRouter();
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
                {CONTRATACOES_LIST.map((item) => (
                  <CardContratacao
                    key={item.id}
                    item={item}
                    onPress={() =>
                      router.push({
                        pathname: '/pages/contratacoes/detalhes',
                        params: { id: item.id },
                      })
                    }
                  />
                ))}
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