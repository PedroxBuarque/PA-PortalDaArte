import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Music,
  Headphones,
  Mic,
  Heart,
} from 'lucide-react-native';

// Importações dos Componentes e do Contexto
import Sidebar from '../../../components/Sidebar';
import Header from '../../../components/Header';
import { useTheme } from '../../../components/context/ThemeContext';

const FAVORITE_ARTISTS = [
  {
    id: '1',
    name: 'Lucas Andrade',
    category: 'Violão e Voz',
    rating: 4.8,
    reviews: 95,
    price: 'R$ 450',
    icon: Music,
    darkBgColor: '#3D2218',
    lightBgColor: '#FDE4D9',
    iconColor: '#E05A10',
  },
  {
    id: '2',
    name: 'Banda Vereda',
    category: 'Forró • 5 integrantes',
    rating: 4.9,
    reviews: 215,
    price: 'R$ 1.200',
    icon: Music,
    darkBgColor: '#412C1B',
    lightBgColor: '#FDE4D9',
    iconColor: '#E05A10',
  },
  {
    id: '3',
    name: 'DJ Marina',
    category: 'Eletrônica • DJ Set',
    rating: 4.7,
    reviews: 83,
    price: 'R$ 600',
    icon: Headphones,
    darkBgColor: '#2E2243',
    lightBgColor: '#EBE4FA',
    iconColor: '#8C52FF',
  },
  {
    id: '4',
    name: 'Juliana Diniz',
    category: 'MPB • Cantora',
    rating: 4.9,
    reviews: 128,
    price: 'R$ 800',
    icon: Mic,
    darkBgColor: '#1B3736',
    lightBgColor: '#E0F2F1',
    iconColor: '#20B2AA',
  },
];

export default function IndexScreen() {
  const { theme, isLightMode } = useTheme();
  const styles = getStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle={isLightMode ? "dark-content" : "light-content"} 
        backgroundColor={theme.headerBg} 
      />

      <View style={styles.dashboardContainer}>
        
        <Sidebar activeRoute="favoritos" />

        <View style={styles.mainContent}>
          <Header />

          {/* Envolvemos o conteúdo em um ScrollView inteligente para o futuro */}
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentWrapper}>
              <View style={styles.pageHeader}>
                <Text style={styles.pageTitle}>Favoritos</Text>
                <Text style={styles.pageSubtitle}>4 artistas salvos</Text>
              </View>

              <View style={styles.cardsContainer}>
                {FAVORITE_ARTISTS.map((item) => {
                  const IconComponent = item.icon;
                  const avatarBg = isLightMode ? item.lightBgColor : item.darkBgColor;

                  return (
                    <View key={item.id} style={styles.card}>
                      <View style={styles.cardLeftGroup}>
                        <View style={[styles.avatarContainer, { backgroundColor: avatarBg }]}>
                          <IconComponent size={24} color={item.iconColor} />
                        </View>
                        <View style={styles.artistDetails}>
                          <Text style={styles.artistName}>{item.name}</Text>
                          <Text style={styles.artistCategory}>{item.category}</Text>
                          <View style={styles.ratingRow}>
                            <Text style={styles.star}>★</Text>
                            <Text style={styles.ratingText}>
                              {item.rating} <Text style={styles.reviewsText}>({item.reviews} avaliações)</Text>
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.cardRightGroup}>
                        <Text style={styles.pricePrefix}>
                          A partir de <Text style={styles.priceValue}>{item.price}</Text>
                        </Text>
                        <View style={styles.actionButtonsRow}>
                          <TouchableOpacity style={styles.btnContract} activeOpacity={0.8}>
                            <Text style={styles.btnContractText}>Contratar</Text>
                          </TouchableOpacity>

                          <TouchableOpacity style={styles.btnFavoriteActive} activeOpacity={0.8}>
                            <Heart size={16} color={theme.accent} fill={theme.accent} />
                          </TouchableOpacity>
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

const getStyles = (theme) => StyleSheet.create({
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
        // Esconde completamente a barra de rolagem visualmente em navegadores baseados em WebKit/Blink (Opera, Chrome, Edge)
        scrollbarWidth: 'none', // Firefox
        msOverflowStyle: 'none', // Internet Explorer/Edge antigo
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
    justifyContent: 'space-between',
  },
  pageHeader: {
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  pageSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  cardsContainer: {
    gap: 14, // Define um espaçamento elegante e consistente entre os cards quando houver mais de 4
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
  artistName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  artistCategory: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    color: '#FFB800',
    fontSize: 14,
    marginRight: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  reviewsText: {
    color: theme.textSecondary,
    fontWeight: '400',
  },
  cardRightGroup: {
    alignItems: 'flex-end',
  },
  pricePrefix: {
    fontSize: 12,
    color: theme.accent,
    fontWeight: '600',
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnContract: {
    backgroundColor: theme.accent,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  btnContractText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  btnFavoriteActive: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    padding: 7,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
});