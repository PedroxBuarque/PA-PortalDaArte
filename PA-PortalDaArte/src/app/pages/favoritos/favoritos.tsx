import {
 Camera,
 Heart,
 Mic,
 Music,
 Palette,
 Sparkles } from "lucide-react-native";
import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
 Platform,
 SafeAreaView,
 ScrollView,
 StatusBar,
 StyleSheet,
 TouchableOpacity,
 useWindowDimensions,
 View,
} from "react-native";

// Importações dos Componentes e do Contexto
import Header from "../../../components/Header";
import Sidebar from "../../../components/Sidebar";
import { useTheme } from "../../../components/context/ThemeContext";
import { useFavorites } from "../../../components/context/FavoritesContext";
import { DISCOVER_ROUTE } from "../../../constants/auth-routes";

import { VLibrasText as Text } from '../../../components/accessibility/VLibrasText';
// Ícone e cores do avatar por categoria (a mesma paleta que a tela já usava).
const CATEGORY_VISUALS: Record<string, { icon: any; lightBg: string; darkBg: string; color: string }> = {
  "Músicos": { icon: Mic, lightBg: "#FDE4D9", darkBg: "#3D2218", color: "#E05A10" },
  "Bandas": { icon: Music, lightBg: "#FDE4D9", darkBg: "#412C1B", color: "#E05A10" },
  "Fotógrafos": { icon: Camera, lightBg: "#E3EEFB", darkBg: "#1E2A3D", color: "#3B82F6" },
  "Pintores": { icon: Palette, lightBg: "#EBE4FA", darkBg: "#2E2243", color: "#8C52FF" },
  "Dançarinos": { icon: Sparkles, lightBg: "#E0F2F1", darkBg: "#1B3736", color: "#20B2AA" },
};
const DEFAULT_VISUAL = CATEGORY_VISUALS["Bandas"];

const URL_API = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Foto do artista em círculo; sem foto (ou se ela falhar ao carregar) mostra o ícone da categoria.
function FavoriteAvatar({ uri, id, background, icon: Icon, color, styles }: any) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [uri]);
  return (
    <View style={[styles.avatarContainer, { backgroundColor: background }]}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={styles.avatarImage}
          onError={() => setFailed(true)}
          testID={`favorite-avatar-${id}`}
          accessible={false}
        />
      ) : (
        <Icon size={24} color={color} />
      )}
    </View>
  );
}
const formatPrice = (value: number) => `R$ ${Number(value).toLocaleString("pt-BR")}`;

export default function IndexScreen() {
  const { theme, isLightMode } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const styles = getStyles(theme, compact);
  const router = useRouter();
  const { favoriteArtists, isHydrated, removeFavorite } = useFavorites();

  // Fotos atuais vindas da API (por id). Têm prioridade sobre a foto guardada no aparelho.
  const [photos, setPhotos] = React.useState<Record<string, string>>({});
  const photosRequested = React.useRef(false);
  React.useEffect(() => {
    if (!isHydrated || favoriteArtists.length === 0 || photosRequested.current) return;
    photosRequested.current = true;
    let active = true;
    (async () => {
      try {
        const response = await fetch(`${URL_API}/api/artistas`);
        const payload = await response.json();
        const rows = Array.isArray(payload) ? payload : payload?.artistas;
        if (!active || !response.ok || !Array.isArray(rows)) return;
        const found: Record<string, string> = {};
        rows.forEach((row: any) => {
          const url = row?.foto_perfil_url ?? row?.foto_url ?? row?.avatar_url ?? row?.profile_image;
          if (row?.id !== undefined && typeof url === "string" && url) found[String(row.id)] = url;
        });
        setPhotos(found);
      } catch {
        // Sem rede: continua com a foto guardada ou o ícone da categoria.
      }
    })();
    return () => {
      active = false;
    };
  }, [isHydrated, favoriteArtists.length]);

  const total = favoriteArtists.length;
  const counterText = `${total} ${total === 1 ? "artista salvo" : "artistas salvos"}`;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={theme.statusBarStyle || (isLightMode ? "dark-content" : "light-content")}
        backgroundColor={theme.headerBg}
      />

      <View style={styles.dashboardContainer}>
        {!compact ? <Sidebar /> : null}

        <View style={styles.mainContent}>
          <Header />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentWrapper}>
              <View style={styles.collectionHero}>
                <View style={styles.collectionHeroIcon} accessible={false}>
                  <Heart size={18} color={theme.onAccent || '#FFFFFF'} fill={theme.onAccent || '#FFFFFF'} accessible={false} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.collectionEyebrow}>SUA CURADORIA PESSOAL</Text>
                  <Text style={styles.pageTitle}>Artistas que chamaram sua atenção.</Text>
                  {isHydrated && <Text style={styles.pageSubtitle}>{counterText} para reencontrar quando quiser.</Text>}
                </View>
              </View>

              {!isHydrated ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Carregando seus favoritos...</Text>
                </View>
              ) : total === 0 ? (
                <View style={styles.emptyState}>
                  <Heart size={40} color={theme.accent} />
                  <Text style={styles.emptyTitle}>Nenhum artista favoritado ainda</Text>
                  <Text style={styles.emptyText}>
                    Toque no coração dos artistas que você mais gostar para encontrá-los facilmente por aqui.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    activeOpacity={0.85}
                    onPress={() => router.navigate(DISCOVER_ROUTE as any)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.btnContractText}>Descobrir artistas</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.cardsContainer}>
                  {favoriteArtists.map((item) => {
                    const visual = CATEGORY_VISUALS[item.category] ?? DEFAULT_VISUAL;
                    const IconComponent = visual.icon;
                    const avatarBg = isLightMode ? visual.lightBg : visual.darkBg;
                    const subtitle =
                      item.style && item.style !== item.category
                        ? `${item.category} • ${item.style}`
                        : item.category;

                    return (
                      <View key={String(item.id)} style={styles.card}>
                        <View style={styles.cardLeftGroup}>
                          <FavoriteAvatar
                            id={item.id}
                            uri={photos[String(item.id)] ?? item.avatarUrl}
                            background={avatarBg}
                            icon={IconComponent}
                            color={visual.color}
                            styles={styles}
                          />
                          <View style={styles.artistDetails}>
                            <Text style={styles.artistName}>{item.name}</Text>
                            <Text style={styles.artistCategory}>{subtitle}</Text>
                            <View style={styles.ratingRow}>
                              <Text style={styles.star}>★</Text>
                              <Text style={styles.ratingText}>
                                {item.reviews > 0 ? (
                                  <>
                                    {item.rating.toFixed(1)}{" "}
                                    <Text style={styles.reviewsText}>({item.reviews} avaliações)</Text>
                                  </>
                                ) : (
                                  <Text style={styles.reviewsText}>Ainda sem avaliações</Text>
                                )}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.cardRightGroup}>
                          <Text style={styles.pricePrefix}>
                            {item.price > 0 ? (
                              <>
                                A partir de <Text style={styles.priceValue}>{formatPrice(item.price)}</Text>
                              </>
                            ) : (
                              "Preço a combinar"
                            )}
                          </Text>
                          <View style={styles.actionButtonsRow}>
                           <TouchableOpacity
                           style={styles.btnContract}
  activeOpacity={0.8}
  onPress={() =>
    router.push({
      pathname: "/pages/contratacoes/Contratar",
      params: { id: String(item.id) },
    } as any)
  }
  accessibilityLabel={`Contratar ${item.name}`}
  testID={`contract-${item.id}`}
                             accessibilityRole="button"
>
  <Text style={styles.btnContractText}>Contratar</Text>
</TouchableOpacity>

                            <TouchableOpacity
                              style={styles.btnFavoriteActive}
                              activeOpacity={0.8}
                              onPress={() => removeFavorite(item.id)}
                              accessibilityLabel={`Remover ${item.name} dos favoritos`}
                              testID={`remove-favorite-${item.id}`}
                              accessibilityRole="button"
                            >
                              <Heart size={16} color={theme.accent} fill={theme.accent} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: any, compact: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.mainBg,
      ...(Platform.select({
        web: {
          height: "100vh" as any,
          overflow: "hidden",
        },
      }) as any),
    },
    dashboardContainer: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: theme.mainBg,
      ...(Platform.select({
        web: {
          height: "100vh" as any,
          overflow: "hidden",
        },
      }) as any),
    },
    mainContent: {
      flex: 1,
      backgroundColor: theme.mainBg,
      ...(Platform.select({
        web: {
          height: "100vh" as any,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }) as any),
    },
    scrollView: {
      flex: 1,
      ...(Platform.select({
        web: {
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        },
      }) as any),
    },
    scrollContentContainer: {
      flexGrow: 1,
    },
    contentWrapper: {
      flex: 1,
      paddingHorizontal: compact ? 18 : 32,
      paddingTop: compact ? 20 : 24,
      paddingBottom: 24,
    },
    collectionHero: {
      backgroundColor: theme.heroBg || theme.textPrimary,
      borderRadius: 24,
      padding: compact ? 18 : 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 22,
      overflow: 'hidden',
      ...Platform.select({ web: { boxShadow: `0 16px 38px ${theme.shadowStrong || theme.shadowColor}` } }),
    },
    collectionHeroIcon: {
      width: compact ? 44 : 50, height: compact ? 44 : 50, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent,
      transform: [{ rotate: '-5deg' }],
    },
    collectionEyebrow: { color: theme.artGold || theme.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginBottom: 5 },
    pageTitle: {
      fontSize: compact ? 24 : 29,
      lineHeight: compact ? 29 : 34,
      fontWeight: '900',
      color: theme.heroText || '#FFFFFF',
      fontFamily: 'serif',
      letterSpacing: -0.5,
      maxWidth: 690,
    },
    pageSubtitle: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.heroMuted || '#E6D8CF',
      marginTop: 7,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 64,
      paddingHorizontal: 24,
      gap: 10,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.textPrimary,
      fontFamily: "'Fraunces', serif",
      textAlign: "center",
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
      maxWidth: 420,
      lineHeight: 21,
    },
    emptyButton: {
      backgroundColor: theme.accent,
      paddingVertical: 11,
      paddingHorizontal: 26,
      borderRadius: 30,
      marginTop: 10,
    },
    cardsContainer: {
      gap: 14,
      marginTop: 20,
      paddingBottom: 8,
    },
    card: {
      backgroundColor: theme.cardBg,
      borderRadius: 20,
      borderLeftWidth: 4,
      borderLeftColor: theme.accent,
      paddingVertical: compact ? 18 : 16,
      paddingHorizontal: compact ? 16 : 20,
      flexDirection: compact ? "column" : "row",
      alignItems: compact ? "stretch" : "center",
      justifyContent: "space-between",
      gap: compact ? 16 : 0,
      shadowColor: theme.shadowColor || "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: compact ? 0.04 : 0.07,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.borderColor,
      ...Platform.select({ web: { boxShadow: `0 10px 28px ${theme.shadowColor}` } }),
    },
    cardLeftGroup: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      minWidth: 0,
    },
    avatarContainer: {
      width: 58,
      height: 58,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 16,
      overflow: "hidden",
    },
    avatarImage: {
      width: "100%",
      height: "100%",
    },
    artistDetails: {
      justifyContent: "center",
      flex: 1,
      minWidth: 0,
    },
    artistName: {
      fontSize: 18,
      fontWeight: "900",
      fontFamily: 'serif',
      color: theme.textPrimary,
      marginBottom: 2,
    },
    artistCategory: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 6,
    },
    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    star: {
      color: "#FFB800",
      fontSize: 14,
      marginRight: 4,
    },
    ratingText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.textPrimary,
    },
    reviewsText: {
      color: theme.textSecondary,
      fontWeight: "400",
    },
    cardRightGroup: {
      alignItems: compact ? "stretch" : "flex-end",
      ...(compact ? { borderTopWidth: 1, borderTopColor: theme.borderColor, paddingTop: 14 } : {}),
    },
    pricePrefix: {
      fontSize: 12,
      color: theme.accent,
      fontWeight: "600",
      marginBottom: 8,
    },
    priceValue: {
      fontSize: 13,
      fontWeight: "700",
    },
    actionButtonsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: compact ? "space-between" : "flex-end",
      gap: 8,
    },
    btnContract: {
      backgroundColor: theme.accent,
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderRadius: 13,
      minHeight: 40,
      justifyContent: 'center',
    },
    btnContractText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
    },
    btnFavoriteActive: {
      borderWidth: 1,
      borderColor: theme.borderColor,
      padding: 7,
      borderRadius: 10,
      minWidth: 40,
      minHeight: 40,
      justifyContent: "center",
      alignItems: "center",
    },
  });
