import React from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../../../components/Header";
import Sidebar from "../../../components/Sidebar";
import { useTheme } from "../../../components/context/ThemeContext";

export default function ExplorarScreen() {
  const { theme, isLightMode } = useTheme();

  // O estilo agora recebe o theme e o isLightMode diretamente, mantendo o padrão
  const styles = getStyles(theme, isLightMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isLightMode ? "dark-content" : "light-content"}
        backgroundColor={theme.headerBg || theme.mainBg}
      />

      <View style={styles.dashboardContainer}>
        <Sidebar activeRoute="explorar" />

        {/* ================= ÁREA DIREITA (CABEÇALHO + CONTEÚDO) ================= */}
        <View style={styles.rightArea}>
          <Header />

          {/* CONTEÚDO PRINCIPAL (GRID + FILTROS) */}
          <View style={styles.mainContent}>
            {/* ÁREA CENTRAL: Artistas e Paginação */}
            <View style={styles.centerArea}>
              <View style={styles.pageHeader}>
                <Text style={styles.pageTitle}>Explorar Artistas</Text>
                <View style={styles.pageSubHeader}>
                  <Text style={styles.resultCount}>
                    247{" "}
                    <Text
                      style={{
                        fontWeight: "normal",
                        color: theme.textSecondary,
                      }}
                    >
                      artistas encontrados
                    </Text>
                  </Text>
                  <View style={styles.sortDropdown}>
                    <Text style={styles.sortText}>
                      Ordenar por:{" "}
                      <Text style={{ fontWeight: "bold" }}>
                        Mais bem avaliados
                      </Text>{" "}
                      <Text style={{ fontSize: 10 }}>▼</Text>
                    </Text>
                  </View>
                </View>
              </View>

              <ScrollView
                style={styles.gridScroll}
                contentContainerStyle={styles.gridContainer}
                showsVerticalScrollIndicator={false}
              >
                {/* Card 1 */}
                <View style={styles.artistCard}>
                  <TouchableOpacity style={styles.cardHeart}>
                    <Text style={styles.heartIcon}>♡</Text>
                  </TouchableOpacity>
                  <View style={styles.avatarWrapper}>
                    <View
                      style={[
                        styles.avatarPlaceholder,
                        { backgroundColor: "#D1B48C" },
                      ]}
                    >
                      <Text style={styles.avatarEmoji}>🎸</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Violão e Voz</Text>
                    </View>
                  </View>
                  <Text style={styles.artistName}>Lucas Andrade</Text>
                  <Text style={styles.artistRating}>
                    ⭐ <Text style={styles.ratingBold}>4,8</Text>{" "}
                    <Text style={styles.ratingCount}>(96)</Text>
                  </Text>
                  <TouchableOpacity style={styles.profileButton}>
                    <Text style={styles.profileButtonText}>Ver perfil</Text>
                  </TouchableOpacity>
                </View>

                {/* Card 2 */}
                <View style={styles.artistCard}>
                  <TouchableOpacity style={styles.cardHeart}>
                    <Text style={styles.heartIconActive}>♥</Text>
                  </TouchableOpacity>
                  <View style={styles.avatarWrapper}>
                    <View
                      style={[
                        styles.avatarPlaceholder,
                        { backgroundColor: "#8B5A2B" },
                      ]}
                    >
                      <Text style={styles.avatarEmoji}>🪗</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Forró</Text>
                    </View>
                  </View>
                  <Text style={styles.artistName}>Banda Vereda</Text>
                  <Text style={styles.artistRating}>
                    ⭐ <Text style={styles.ratingBold}>4,9</Text>{" "}
                    <Text style={styles.ratingCount}>(210)</Text>
                  </Text>
                  <TouchableOpacity style={styles.profileButton}>
                    <Text style={styles.profileButtonText}>Ver perfil</Text>
                  </TouchableOpacity>
                </View>

                {/* Card 3 */}
                <View style={styles.artistCard}>
                  <TouchableOpacity style={styles.cardHeart}>
                    <Text style={styles.heartIcon}>♡</Text>
                  </TouchableOpacity>
                  <View style={styles.avatarWrapper}>
                    <View
                      style={[
                        styles.avatarPlaceholder,
                        { backgroundColor: "#4A3C31" },
                      ]}
                    >
                      <Text style={styles.avatarEmoji}>🎧</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Eletrônica</Text>
                    </View>
                  </View>
                  <Text style={styles.artistName}>DJ Marina</Text>
                  <Text style={styles.artistRating}>
                    ⭐ <Text style={styles.ratingBold}>4,7</Text>{" "}
                    <Text style={styles.ratingCount}>(63)</Text>
                  </Text>
                  <TouchableOpacity style={styles.profileButton}>
                    <Text style={styles.profileButtonText}>Ver perfil</Text>
                  </TouchableOpacity>
                </View>

                {/* Card 4 */}
                <View style={styles.artistCard}>
                  <TouchableOpacity style={styles.cardHeart}>
                    <Text style={styles.heartIcon}>♡</Text>
                  </TouchableOpacity>
                  <View style={styles.avatarWrapper}>
                    <View
                      style={[
                        styles.avatarPlaceholder,
                        { backgroundColor: "#A0522D" },
                      ]}
                    >
                      <Text style={styles.avatarEmoji}>🥁</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Forró Pé de Serra</Text>
                    </View>
                  </View>
                  <Text style={styles.artistName}>Trio Nordestino</Text>
                  <Text style={styles.artistRating}>
                    ⭐ <Text style={styles.ratingBold}>4,8</Text>{" "}
                    <Text style={styles.ratingCount}>(88)</Text>
                  </Text>
                  <TouchableOpacity style={styles.profileButton}>
                    <Text style={styles.profileButtonText}>Ver perfil</Text>
                  </TouchableOpacity>
                </View>

                {/* Card 5 */}
                <View style={styles.artistCard}>
                  <TouchableOpacity style={styles.cardHeart}>
                    <Text style={styles.heartIcon}>♡</Text>
                  </TouchableOpacity>
                  <View style={styles.avatarWrapper}>
                    <View
                      style={[
                        styles.avatarPlaceholder,
                        { backgroundColor: "#CD853F" },
                      ]}
                    >
                      <Text style={styles.avatarEmoji}>🎤</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>MPB</Text>
                    </View>
                  </View>
                  <Text style={styles.artistName}>Juliana Diniz</Text>
                  <Text style={styles.artistRating}>
                    ⭐ <Text style={styles.ratingBold}>4,9</Text>{" "}
                    <Text style={styles.ratingCount}>(88)</Text>
                  </Text>
                  <TouchableOpacity style={styles.profileButton}>
                    <Text style={styles.profileButtonText}>Ver perfil</Text>
                  </TouchableOpacity>
                </View>

                {/* Card 6 */}
                <View style={styles.artistCard}>
                  <TouchableOpacity style={styles.cardHeart}>
                    <Text style={styles.heartIcon}>♡</Text>
                  </TouchableOpacity>
                  <View style={styles.avatarWrapper}>
                    <View
                      style={[
                        styles.avatarPlaceholder,
                        { backgroundColor: "#556B2F" },
                      ]}
                    >
                      <Text style={styles.avatarEmoji}>🪘</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Samba</Text>
                    </View>
                  </View>
                  <Text style={styles.artistName}>Samba do Morro</Text>
                  <Text style={styles.artistRating}>
                    ⭐ <Text style={styles.ratingBold}>4,6</Text>{" "}
                    <Text style={styles.ratingCount}>(44)</Text>
                  </Text>
                  <TouchableOpacity style={styles.profileButton}>
                    <Text style={styles.profileButtonText}>Ver perfil</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              {/* Paginação */}
              <View style={styles.pagination}>
                <TouchableOpacity style={styles.pageButton}>
                  <Text style={styles.pageText}>&lt;</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pageButton, styles.pageActive]}
                >
                  <Text style={styles.pageTextActive}>1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pageButton}>
                  <Text style={styles.pageText}>2</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pageButton}>
                  <Text style={styles.pageText}>3</Text>
                </TouchableOpacity>
                <Text style={styles.pageDots}>...</Text>
                <TouchableOpacity style={styles.pageButton}>
                  <Text style={styles.pageText}>28</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pageButton}>
                  <Text style={styles.pageText}>&gt;</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ================= BARRA DE FILTROS DIREITA ================= */}
            <View style={styles.filterSidebar}>
              <ScrollView
                style={styles.filterScroll}
                contentContainerStyle={styles.filterScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.filterHeader}>
                  <Text style={styles.filterTitle}>Filtros</Text>
                  <TouchableOpacity>
                    <Text style={styles.clearFilters}>Limpar</Text>
                  </TouchableOpacity>
                </View>

                {/* Bloco 1: Categoria */}
                <View style={styles.filterBlock}>
                  <View style={styles.filterBlockHeader}>
                    <Text style={styles.filterSubTitle}>Categoria</Text>
                    <Text style={styles.arrowIcon}>^</Text>
                  </View>
                  <View style={styles.radioItem}>
                    <Text style={styles.radioActive}>◉</Text>
                    <Text style={styles.filterLabelActive}>
                      Todos os artistas
                    </Text>
                  </View>
                  <View style={styles.radioItem}>
                    <Text style={styles.radioInactive}>◯</Text>
                    <Text style={styles.filterLabel}>Músicos</Text>
                  </View>
                  <View style={styles.radioItem}>
                    <Text style={styles.radioInactive}>◯</Text>
                    <Text style={styles.filterLabel}>Bandas</Text>
                  </View>
                  <View style={styles.radioItem}>
                    <Text style={styles.radioInactive}>◯</Text>
                    <Text style={styles.filterLabel}>Fotógrafos</Text>
                  </View>
                  <View style={styles.radioItem}>
                    <Text style={styles.radioInactive}>◯</Text>
                    <Text style={styles.filterLabel}>Pintores</Text>
                  </View>
                  <View style={styles.radioItem}>
                    <Text style={styles.radioInactive}>◯</Text>
                    <Text style={styles.filterLabel}>Dançarinos</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Bloco 2: Preço por hora */}
                <View style={styles.filterBlock}>
                  <View style={styles.filterBlockHeader}>
                    <Text style={styles.filterSubTitle}>Preço por hora</Text>
                    <Text style={styles.arrowIcon}>^</Text>
                  </View>
                  <View style={styles.sliderTrack}>
                    <View style={styles.sliderFill} />
                    <View style={styles.sliderThumbLeft} />
                    <View style={styles.sliderThumbRight} />
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceText}>R$ 0</Text>
                    <Text style={styles.priceText}>R$ 5.000</Text>
                  </View>
                  <View style={styles.priceInputs}>
                    <View style={styles.priceInputBox}>
                      <Text style={styles.priceInputText}>Mín: R$ 100</Text>
                    </View>
                    <View style={styles.priceInputBox}>
                      <Text style={styles.priceInputText}>Máx: R$ 2.500</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Bloco 3: Avaliação */}
                <View style={styles.filterBlock}>
                  <View style={styles.filterBlockHeader}>
                    <Text style={styles.filterSubTitle}>Avaliação</Text>
                    <Text style={styles.arrowIcon}>^</Text>
                  </View>
                  <View style={styles.checkItem}>
                    <Text style={styles.checkboxActive}>☑</Text>
                    <Text style={styles.filterLabel}>
                      ⭐⭐⭐⭐⭐ 5 estrelas
                    </Text>
                  </View>
                  <View style={styles.checkItem}>
                    <Text style={styles.checkboxActive}>☑</Text>
                    <Text style={styles.filterLabel}>
                      ⭐⭐⭐⭐☆ 4+ estrelas
                    </Text>
                  </View>
                  <View style={styles.checkItem}>
                    <Text style={styles.checkboxInactive}>☐</Text>
                    <Text style={styles.filterLabel}>⭐⭐⭐☆☆ 3+ estrelas</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Bloco 4: Localização */}
                <View style={styles.filterBlock}>
                  <View style={styles.filterBlockHeader}>
                    <Text style={styles.filterSubTitle}>Localização</Text>
                    <Text style={styles.arrowIcon}>^</Text>
                  </View>
                  <View style={styles.locationInputBox}>
                    <Text style={styles.locIcon}>📍</Text>
                    <TextInput
                      value="Caruaru, PE"
                      style={styles.locInput}
                      editable={false}
                    />
                  </View>
                  <View style={styles.pillsRow}>
                    <View style={[styles.pill, styles.pillActive]}>
                      <Text style={styles.pillTextActive}>10 km</Text>
                    </View>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>25 km</Text>
                    </View>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>50 km</Text>
                    </View>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>100 km</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme, isLightMode) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.mainBg },
    dashboardContainer: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: theme.mainBg,
      ...Platform.select({
        web: { height: "100vh", overflow: "hidden" },
      }),
    },

    // AREA DIREITA E CABEÇALHO
    rightArea: { flex: 1, flexDirection: "column", minWidth: 0 },
    header: {
      height: 80,
      backgroundColor: theme.cardBg,
      borderBottomWidth: 1,
      borderColor: theme.borderColor,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 30,
      paddingHorizontal: 20,
      height: 48,
      width: "60%",
      maxWidth: 600,
    },
    searchIcon: { marginRight: 12, color: theme.textSecondary, fontSize: 18 },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: theme.textPrimary,
      ...Platform.select({ web: { outlineStyle: "none" } }),
    },
    headerIcons: {
      flexDirection: "row",
      alignItems: "center",
      position: "absolute",
      right: 40,
    },
    iconBtn: { fontSize: 24, marginLeft: 25, color: theme.textPrimary },
    userAvatar: {
      backgroundColor: theme.accent,
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 25,
    },
    userAvatarText: { color: "#FFF", fontWeight: "bold", fontSize: 18 },

    // CONTEÚDO PRINCIPAL
    mainContent: { flex: 1, flexDirection: "row" },

    // ÁREA CENTRAL (GRID)
    centerArea: { flex: 1, padding: 40, minHeight: 0 },
    pageHeader: { marginBottom: 25 },
    pageTitle: {
      fontSize: 32,
      fontWeight: "900",
      color: theme.textPrimary,
      fontFamily: "serif",
      marginBottom: 15,
    },
    pageSubHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    resultCount: { fontSize: 16, fontWeight: "bold", color: theme.textPrimary },
    sortDropdown: {
      backgroundColor: theme.cardBg,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 25,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    sortText: { color: theme.textPrimary, fontSize: 14 },

    gridScroll: { flex: 1 },
    gridContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      paddingBottom: 20,
    },

    artistCard: {
      backgroundColor: theme.cardBg,
      width: "31%",
      minWidth: 260,
      borderRadius: 16,
      padding: 25,
      alignItems: "center",
      marginBottom: 30,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    cardHeart: { position: "absolute", top: 20, right: 20, zIndex: 10 },
    heartIcon: { fontSize: 22, color: theme.textSecondary },
    heartIconActive: { fontSize: 22, color: theme.accent },

    // Sobreposição Perfeita (Avatar + Tag)
    avatarWrapper: { alignItems: "center", marginBottom: 15 },
    avatarPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1,
    },
    avatarEmoji: { fontSize: 45 },
    tag: {
      backgroundColor: theme.accent,
      paddingVertical: 6,
      paddingHorizontal: 16,
      borderRadius: 16,
      zIndex: 2,
      marginTop: -15,
      borderWidth: 2,
      borderColor: theme.cardBg,
    },
    tagText: { color: "#FFF", fontSize: 12, fontWeight: "bold" },

    artistName: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.textPrimary,
      marginBottom: 8,
    },
    artistRating: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 20,
    },
    ratingBold: { color: theme.accent, fontWeight: "bold" },
    ratingCount: { color: theme.textSecondary },
    profileButton: {
      backgroundColor: theme.accent,
      width: "100%",
      paddingVertical: 14,
      borderRadius: 30,
      alignItems: "center",
    },
    profileButtonText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },

    // PAGINAÇÃO
    pagination: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 10,
    },
    pageButton: {
      backgroundColor: theme.cardBg,
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginHorizontal: 6,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    pageActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    pageText: { color: theme.textSecondary, fontWeight: "bold", fontSize: 15 },
    pageTextActive: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
    pageDots: {
      marginHorizontal: 10,
      color: theme.textSecondary,
      fontWeight: "bold",
    },

    // FILTROS (BARRA DIREITA)
    filterSidebar: {
      width: 320,
      backgroundColor: theme.cardBg,
      paddingHorizontal: 30,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.borderColor,
      marginVertical: 24,
      marginRight: 24,
      minHeight: 0,
      ...Platform.select({
        web: {
          overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
        },
        default: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 6,
        },
      }),
    },
    filterScroll: { flex: 1 },
    filterScrollContent: { paddingVertical: 30 },
    filterHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 35,
    },
    filterTitle: {
      fontSize: 22,
      fontWeight: "900",
      color: theme.textPrimary,
      fontFamily: "serif",
    },
    clearFilters: { color: theme.accent, fontWeight: "600", fontSize: 15 },

    filterBlock: { marginBottom: 30 },
    filterBlockHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    filterSubTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.textPrimary,
    },
    arrowIcon: {
      color: theme.textSecondary,
      transform: [{ rotate: "180deg" }],
      fontSize: 16,
    },

    radioItem: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
    radioActive: { color: theme.accent, fontSize: 20, marginRight: 12 },
    radioInactive: { color: theme.borderColor, fontSize: 20, marginRight: 12 },

    checkItem: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
    checkboxActive: { color: theme.accent, fontSize: 22, marginRight: 12 },

    // ==========================================
    // ESTILOS QUE ESTAVAM CORTADOS FORAM CONCLUÍDOS ABAIXO
    // ==========================================
    checkboxInactive: {
      color: theme.borderColor,
      fontSize: 22,
      marginRight: 12,
    },
    filterLabel: { fontSize: 15, color: theme.textSecondary },
    filterLabelActive: {
      fontSize: 15,
      color: theme.textPrimary,
      fontWeight: "bold",
    },

    divider: {
      height: 1,
      backgroundColor: theme.borderColor,
      marginVertical: 25,
    },

    // Slider (Preços)
    sliderTrack: {
      height: 6,
      backgroundColor: theme.borderColor,
      borderRadius: 3,
      marginBottom: 15,
      marginTop: 10,
      position: "relative",
    },
    sliderFill: {
      position: "absolute",
      height: 6,
      backgroundColor: theme.accent,
      borderRadius: 3,
      left: "20%",
      right: "30%",
    },
    sliderThumbLeft: {
      position: "absolute",
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.accent,
      top: -7,
      left: "20%",
      borderWidth: 3,
      borderColor: theme.cardBg,
    },
    sliderThumbRight: {
      position: "absolute",
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.accent,
      top: -7,
      right: "30%",
      borderWidth: 3,
      borderColor: theme.cardBg,
    },

    priceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 15,
    },
    priceText: { color: theme.textSecondary, fontSize: 14, fontWeight: "600" },

    priceInputs: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
    },
    priceInputBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    priceInputText: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },

    // Localização
    locationInputBox: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 12,
      paddingHorizontal: 15,
      height: 48,
      marginBottom: 20,
    },
    locIcon: { fontSize: 18, marginRight: 10 },
    locInput: {
      flex: 1,
      fontSize: 15,
      color: theme.textPrimary,
      ...Platform.select({ web: { outlineStyle: "none" } }),
    },

    // Pills (Botões de KM)
    pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    pill: {
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    pillActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    pillText: { color: theme.textSecondary, fontSize: 14, fontWeight: "bold" },
    pillTextActive: { color: "#FFF", fontSize: 14, fontWeight: "bold" },
  });
