
import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarDays, MapPin, UserRound } from 'lucide-react-native';

import Sidebar from '../../../components/Sidebar';
import Header from '../../../components/Header';
import { useTheme } from '../../../components/context/ThemeContext';
import { CONTRATACOES_LIST } from '../../../components/contratacoes/contratacoesData';

export default function DetalhesContratacaoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, isLightMode } = useTheme();

  const contratacao = CONTRATACOES_LIST.find(
    (item) => item.id === id
  );

  const styles = getStyles(theme);

  if (!contratacao) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFound}>
          <Text style={styles.title}>
            Contratação não encontrada
          </Text>

          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft size={18} color={theme.textPrimary} />
            <Text style={styles.backButtonText}>
              Voltar
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const IconComponent = contratacao.icon;

  const statusColor =
    contratacao.status === 'Pendente'
      ? '#F2994A'
      : contratacao.status === 'Confirmado'
        ? '#56CCF2'
        : contratacao.status === 'Concluido'
          ? '#27AE60'
          : '#BDBDBD';

  const avatarBg = isLightMode
    ? contratacao.lightBgColor
    : contratacao.darkBgColor;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isLightMode ? 'dark-content' : 'light-content'}
        backgroundColor={theme.headerBg}
      />

      <View style={styles.dashboardContainer}>
        <Sidebar activeRoute="contratacoes" />

        <View style={styles.mainContent}>
          <Header />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentWrapper}>
              <Pressable
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <ArrowLeft size={20} color={theme.textPrimary} />
                <Text style={styles.backButtonText}>
                  Voltar para Contratações
                </Text>
              </Pressable>

              <Text style={styles.title}>
                Detalhes da contratação
              </Text>

              <View style={styles.detailsCard}>
                <View style={styles.artistHeader}>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: avatarBg },
                    ]}
                  >
                    <IconComponent
                      size={30}
                      color={contratacao.iconColor}
                    />
                  </View>

                  <View style={styles.artistInfo}>
                    <Text style={styles.artistName}>
                      {contratacao.name}
                    </Text>
                    <Text style={styles.category}>
                      {contratacao.category}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusColor },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {contratacao.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.separator} />

                <Text style={styles.sectionTitle}>
                  Informações do serviço
                </Text>

                <View style={styles.infoRow}>
                  <CalendarDays
                    size={20}
                    color={theme.textSecondary}
                  />
                  <View style={styles.infoContent}>
                    <Text style={styles.label}>
                      Data e horário
                    </Text>
                    <Text style={styles.value}>
                      {contratacao.date}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <MapPin
                    size={20}
                    color={theme.textSecondary}
                  />
                  <View style={styles.infoContent}>
                    <Text style={styles.label}>
                      Local do serviço
                    </Text>
                    <Text style={styles.value}>
                      {contratacao.location}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <UserRound
                    size={20}
                    color={theme.textSecondary}
                  />
                  <View style={styles.infoContent}>
                    <Text style={styles.label}>
                      Contratado
                    </Text>
                    <Text style={styles.value}>
                      {contratacao.name}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
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
    },
    scrollContent: {
      flexGrow: 1,
    },
    contentWrapper: {
      paddingHorizontal: 32,
      paddingTop: 20,
      paddingBottom: 32,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 8,
      marginBottom: 24,
      paddingVertical: 8,
    },
    backButtonText: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 24,
    },
    detailsCard: {
      backgroundColor: theme.cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.borderColor,
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 5,
      elevation: 2,
    },
    artistHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 12,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    artistInfo: {
      flex: 1,
      minWidth: 120,
    },
    artistName: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 4,
    },
    category: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    statusBadge: {
      borderRadius: 20,
      paddingVertical: 7,
      paddingHorizontal: 14,
    },
    statusText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    separator: {
      height: 1,
      backgroundColor: theme.borderColor,
      marginVertical: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 20,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      marginBottom: 22,
    },
    infoContent: {
      flex: 1,
    },
    label: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 5,
    },
    value: {
      fontSize: 15,
      color: theme.textPrimary,
      fontWeight: '500',
    },
    notFound: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      gap: 16,
    },
  });
