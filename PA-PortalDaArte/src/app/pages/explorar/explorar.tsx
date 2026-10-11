import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Header from "../../../components/Header";
import Sidebar from "../../../components/Sidebar";
import { useTheme } from "../../../components/context/ThemeContext";
import { useLocalSearchParams } from "expo-router";

const URL_API = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

const firstValue = (...values: any[]) => values.find((value) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0));

const toText = (value: any): string => {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(" ");
  if (value && typeof value === "object") return String(firstValue(value.nome, value.name, value.titulo, value.instrumento, value.estilo, value.descricao, value.description, ""));
  return "";
};

const normalizeArtist = (raw: any, index: number): Artist => {
  const profile = firstValue(raw.perfil, raw.profile, {});
  const categories = firstValue(raw.categorias, raw.categories, raw.categoria, raw.category, "");
  const services = firstValue(raw.servicos, raw.services, raw.instrumentos, raw.instruments, "");
  const categoryText = toText(categories);
  const serviceText = toText(services);
  const name = String(firstValue(raw.nome_artistico, raw.nome, raw.name, raw.nome_completo, raw.name_artistico, "Artista"));
  const style = String(firstValue(raw.estilo_musical, raw.estilo, raw.style, raw.instrumento, raw.instrument, serviceText, categoryText, "Artista independente"));
  const categorySource = categoryText.toLowerCase();
  const category = /banda/.test(categorySource) ? "Bandas"
    : /foto/.test(categorySource) ? "Fotógrafos"
    : /pint|artes visuais|ilustra|desenh/.test(categorySource) ? "Pintores"
    : /dan[cç]|core[oó]g/.test(categorySource) ? "Dançarinos"
    : /m[uú]sic|cant|instrument|forr[oó]|samba|mpb|rock|dj/.test((categoryText + " " + style).toLowerCase()) ? "Músicos"
    : "Todos os artistas";
  const searchableText = [name, categoryText, serviceText, style, raw.biografia, raw.bio, raw.instrumentos, raw.instruments, raw.descricao, raw.description]
    .map(toText).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const serviceRecords = Array.isArray(services) ? services : [];
  const servicePrice = serviceRecords
    .map((service: any) => firstValue(service.preco_min, service.preco, service.price, service.valor_hora))
    .find((value: any) => value !== undefined && value !== null && value !== "");
  const rawPrice = firstValue(raw.preco_min, raw.preco, raw.price, raw.valor_hora, raw.valor, servicePrice, 0);
  const price = Number(rawPrice) || 0;
  const rawRating = firstValue(raw.nota_media, raw.avaliacao_media, raw.rating, 0);
  const rating = Number(rawRating) || 0;
  return {
    id: Number(firstValue(raw.id, raw.usuario_id, raw.artista_id, index + 1)) || index + 1,
    name,
    category,
    style,
    emoji: category === "Bandas" ? "🎸" : category === "Fotógrafos" ? "📷" : category === "Pintores" ? "🎨" : category === "Dançarinos" ? "💃" : "🎵",
    avatarColor: "#8B7355",
    rating,
    reviews: Number(firstValue(raw.total_avaliacoes, raw.reviews, raw.avaliacoes, 0)) || 0,
    price,
    distanceKm: Number(firstValue(raw.distanceKm, raw.distancia_km, raw.distancia, 0)) || 0,
    favorite: false,
    avatarUrl: firstValue(raw.foto_perfil_url, raw.foto_url, raw.avatar_url, raw.profile_image, profile.foto_perfil_url, profile.foto_url, profile.avatar_url, null),
    searchableText,
  };
};

type Artist = {
  id: number;
  name: string;
  category: string;
  style: string;
  emoji: string;
  avatarColor: string;
  rating: number;
  reviews: number;
  price: number;
  distanceKm: number;
  favorite?: boolean;
  avatarUrl?: string | null;
  searchableText: string;
};

const SORT_OPTIONS = [
  { id: "rating", label: "Mais bem avaliados" },
  { id: "priceAsc", label: "Menor preço" },
  { id: "priceDesc", label: "Maior preço" },
  { id: "distance", label: "Mais próximos" },
];

const CATEGORY_OPTIONS = [
  "Todos os artistas",
  "Músicos",
  "Bandas",
  "Fotógrafos",
  "Pintores",
  "Dançarinos",
];
const RATING_OPTIONS = [5, 4, 3];
const DISTANCE_OPTIONS = [10, 25, 50, 100];

const MAX_SLIDER_VAL = 5000;
const TRACK_WIDTH = 225;

export default function ExplorarScreen() {
  const { theme, isLightMode } = useTheme();
  const styles = getStyles(theme) as any;
  const { width } = useWindowDimensions();
  const isMobile = width < 900; // Define se é tela de celular/tablet pequeno
  const params = useLocalSearchParams<{ search?: string }>();
  const searchQuery = (Array.isArray(params.search) ? params.search[0] : params.search || "").trim();

  const [artists, setArtists] = useState<Artist[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(true);
  const [artistsError, setArtistsError] = useState("");
  const [category, setCategory] = useState("Todos os artistas");
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("5000");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [distance, setDistance] = useState(100);
  const [location, setLocation] = useState("Caruaru, PE");
  const [sort, setSort] = useState("rating");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [favorites, setFavorites] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let active = true;
    const loadArtists = async () => {
      setLoadingArtists(true);
      setArtistsError("");
      try {
        // Endpoint público esperado: GET /api/artistas retorna os perfis ativos do banco.
        const response = await fetch(`${URL_API}/api/artistas`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.detail || "Não foi possível carregar os artistas.");
        }
        const rows = Array.isArray(payload)
          ? payload
          : firstValue(payload.artistas, payload.items, payload.results, payload.data, []);
        if (!Array.isArray(rows)) throw new Error("A API retornou uma lista de artistas inválida.");
        if (active) setArtists(rows.map(normalizeArtist));
      } catch (error: any) {
        if (active) {
          setArtists([]);
          setArtistsError(error?.message || "Falha ao conectar com a API de artistas.");
        }
      } finally {
        if (active) setLoadingArtists(false);
      }
    };
    loadArtists();
    return () => { active = false; };
  }, []);

  const numericMin = Math.max(0, Number(minPrice.replace(/\D/g, "")) || 0);
  const numericMax = Math.min(
    MAX_SLIDER_VAL,
    Math.max(numericMin, Number(maxPrice.replace(/\D/g, "")) || MAX_SLIDER_VAL),
  );

  const minPercent = Math.min(
    100,
    Math.max(0, (numericMin / MAX_SLIDER_VAL) * 100),
  );
  const maxPercent = Math.min(
    100,
    Math.max(0, (numericMax / MAX_SLIDER_VAL) * 100),
  );

  const minPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const currentPx = (minPercent / 100) * TRACK_WIDTH;
        const newPx = Math.min(
          (maxPercent / 100) * TRACK_WIDTH,
          Math.max(0, currentPx + gestureState.dx),
        );
        const newVal = Math.round((newPx / TRACK_WIDTH) * MAX_SLIDER_VAL);
        setMinPrice(String(newVal));
      },
    }),
  ).current;

  const maxPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const currentPx = (maxPercent / 100) * TRACK_WIDTH;
        const newPx = Math.min(
          TRACK_WIDTH,
          Math.max(
            (minPercent / 100) * TRACK_WIDTH,
            currentPx + gestureState.dx,
          ),
        );
        const newVal = Math.round((newPx / TRACK_WIDTH) * MAX_SLIDER_VAL);
        setMaxPrice(String(newVal));
      },
    }),
  ).current;

  // RECOMENDAÇÃO SIMULADA APLICADA AQUI
  const filteredArtists = useMemo(() => {
    const normalizedQuery = searchQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const result = artists.filter((artist) => {
      const matchesSearch = !normalizedQuery || artist.searchableText.includes(normalizedQuery);
      const matchesCategory =
        category === "Todos os artistas" || artist.category === category;
      const matchesPrice =
        artist.price >= numericMin && artist.price <= numericMax;
      const matchesRating = ratingFilter === 0 || artist.rating >= ratingFilter;
      const matchesDistance = artist.distanceKm <= distance;
      return (
        matchesSearch && matchesCategory && matchesPrice && matchesRating && matchesDistance
      );
    });

    return [...result].sort((a, b) => {
      if (sort === "priceAsc") return a.price - b.price;
      if (sort === "priceDesc") return b.price - a.price;
      if (sort === "distance") return a.distanceKm - b.distanceKm;
      
      // Ordena pelas avaliações reais retornadas pela API; perfis sem avaliação ficam no fim.
      return b.rating - a.rating;
    });
  }, [artists, searchQuery, category, numericMin, numericMax, ratingFilter, distance, sort]);

  useEffect(() => {
    setVisibleCount(6);
  }, [
    category,
    searchQuery,
    numericMin,
    numericMax,
    ratingFilter,
    distance,
    sort,
    location,
  ]);

  const visibleArtists = filteredArtists.slice(0, visibleCount);
  const hasMore = visibleCount < filteredArtists.length;

  const loadMore = () => {
    if (hasMore)
      setVisibleCount((current) =>
        Math.min(current + 6, filteredArtists.length),
      );
  };

  const toggleFavorite = (id: number) => {
    setFavorites((current) => ({ ...current, [id]: !current[id] }));
  };

  const clearFilters = () => {
    setCategory("Todos os artistas");
    setMinPrice("0");
    setMaxPrice("5000");
    setRatingFilter(0);
    setDistance(100);
    setLocation("Caruaru, PE");
    setSort("rating");
  };

  const formatPrice = (value: number) => `R$ ${value.toLocaleString("pt-BR")}`;

  const renderArtist = ({ item }: { item: Artist }) => {
    const isFavorite = favorites[item.id] ?? item.favorite ?? false;

    return (
      <View style={[styles.artistCard, isMobile && styles.artistCardMobile]}>
        <TouchableOpacity
          style={styles.cardHeart}
          onPress={() => toggleFavorite(item.id)}
        >
          <Text style={isFavorite ? styles.heartIconActive : styles.heartIcon}>
            {isFavorite ? "♥" : "♡"}
          </Text>
        </TouchableOpacity>
        <View style={styles.avatarWrapper}>
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: item.avatarColor },
            ]}
          >
            {item.avatarUrl ? (
              <Image source={{ uri: item.avatarUrl }} style={styles.artistAvatarImage} />
            ) : (
              <Text style={styles.avatarEmoji}>{item.emoji}</Text>
            )}
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{item.style}</Text>
          </View>
        </View>
        <Text style={styles.artistName}>{item.name}</Text>
        <Text style={styles.artistRating}>
          {item.rating > 0 ? <>⭐ <Text style={styles.ratingBold}>{item.rating.toFixed(1).replace(".", ",")}</Text> <Text style={styles.ratingCount}>({item.reviews})</Text></> : <Text style={styles.ratingCount}>Ainda sem avaliações</Text>}
        </Text>
        <Text style={styles.artistPrice}>{item.price > 0 ? `${formatPrice(item.price)}/hora` : "Preço a combinar"}</Text>
        {item.distanceKm > 0 ? <Text style={styles.artistDistance}>📍 {item.distanceKm} km</Text> : null}
        <TouchableOpacity style={styles.profileButton}>
          <Text style={styles.profileButtonText}>Ver perfil</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFilterContent = () => (
    <View style={styles.filterScroll}>
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>Filtros</Text>
        <TouchableOpacity onPress={clearFilters}>
          <Text style={styles.clearFilters}>Limpar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterBlock}>
        <View style={styles.filterBlockHeader}>
          <Text style={styles.filterSubTitle}>Categoria</Text>
          <Text style={styles.arrowIcon}>⌃</Text>
        </View>
        {CATEGORY_OPTIONS.map((option) => {
          const active = category === option;
          return (
            <TouchableOpacity
              key={option}
              style={styles.radioItem}
              onPress={() => setCategory(option)}
            >
              <Text style={active ? styles.radioActive : styles.radioInactive}>
                {active ? "◉" : "◯"}
              </Text>
              <Text
                style={active ? styles.filterLabelActive : styles.filterLabel}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.divider} />

      <View style={styles.filterBlock}>
        <View style={styles.filterBlockHeader}>
          <Text style={styles.filterSubTitle}>Preço por hora</Text>
          <Text style={styles.arrowIcon}>⌃</Text>
        </View>

        <View style={styles.sliderTrack}>
          <View
            style={[
              styles.sliderFill,
              { left: `${minPercent}%`, right: `${100 - maxPercent}%` },
            ]}
          />
          <View
            style={[styles.sliderThumbLeft, { left: `${minPercent}%` }]}
            {...minPanResponder.panHandlers}
          />
          <View
            style={[styles.sliderThumbRight, { left: `${maxPercent}%` }]}
            {...maxPanResponder.panHandlers}
          />
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceText}>R$ 0</Text>
          <Text style={styles.priceText}>R$ 5.000</Text>
        </View>
        <View style={styles.priceInputs}>
          <View style={styles.priceInputBox}>
            <Text style={styles.inputPrefix}>Mín:</Text>
            <TextInput
              value={minPrice}
              onChangeText={setMinPrice}
              keyboardType="numeric"
              style={styles.priceInput}
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
          <View style={styles.priceInputBox}>
            <Text style={styles.inputPrefix}>Máx:</Text>
            <TextInput
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
              style={styles.priceInput}
              placeholder="5000"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.filterBlock}>
        <View style={styles.filterBlockHeader}>
          <Text style={styles.filterSubTitle}>Avaliação mínima</Text>
          <Text style={styles.arrowIcon}>⌃</Text>
        </View>
        {RATING_OPTIONS.map((option) => {
          const active = ratingFilter === option;
          const stars = "⭐".repeat(option) + "☆".repeat(5 - option);
          return (
            <TouchableOpacity
              key={option}
              style={styles.checkItem}
              onPress={() => setRatingFilter(active ? 0 : option)}
            >
              <Text
                style={active ? styles.checkboxActive : styles.checkboxInactive}
              >
                {active ? "☑" : "☐"}
              </Text>
              <Text
                style={active ? styles.filterLabelActive : styles.filterLabel}
              >
                {stars} {option}+ estrelas
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.divider} />

      <View style={styles.filterBlock}>
        <View style={styles.filterBlockHeader}>
          <Text style={styles.filterSubTitle}>Localização</Text>
          <Text style={styles.arrowIcon}>⌃</Text>
        </View>
        <View style={styles.locationInputBox}>
          <Text style={styles.locIcon}>📍</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            style={styles.locInput}
            placeholder="Cidade, UF"
            placeholderTextColor={theme.textSecondary}
          />
        </View>
        <Text style={styles.distanceLabel}>Distância máxima</Text>
        <View style={styles.pillsRow}>
          {DISTANCE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.pill, distance === option && styles.pillActive]}
              onPress={() => setDistance(option)}
            >
              <Text
                style={
                  distance === option ? styles.pillTextActive : styles.pillText
                }
              >
                {option} km
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isMobile && (
        <TouchableOpacity
          style={styles.applyFilterButton}
          onPress={() => setFilterModalVisible(false)}
        >
          <Text style={styles.applyFilterButtonText}>Ver Resultados</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isLightMode ? "dark-content" : "light-content"}
        backgroundColor={theme.headerBg || theme.mainBg}
      />

      <View style={styles.dashboardContainer}>
        {!isMobile && <Sidebar />}

        <View style={styles.rightArea}>
          <Header />

          <View style={styles.mainContent}>
            <View
              style={[styles.centerArea, isMobile && styles.centerAreaMobile]}
            >
              <View style={styles.pageHeader}>
                <View style={styles.titleRow}>
                  <Text style={styles.pageTitle}>Explorar Artistas</Text>
                  {isMobile && (
                    <TouchableOpacity
                      style={styles.mobileFilterBtn}
                      onPress={() => setFilterModalVisible(true)}
                    >
                      <Text style={styles.mobileFilterBtnText}>⚙️ Filtrar</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.pageSubHeader}>
                  <Text style={styles.resultCount}>
                    {filteredArtists.length}{" "}
                    <Text style={styles.resultCountNormal}>
                      artistas encontrados
                    </Text>
                  </Text>

                  <View style={styles.sortWrapper}>
                    <TouchableOpacity
                      style={styles.sortDropdown}
                      onPress={() => setSortOpen((value) => !value)}
                    >
                      <Text style={styles.sortText}>
                        Ordenar:{" "}
                        <Text style={styles.sortStrong}>
                          {
                            SORT_OPTIONS.find((option) => option.id === sort)
                              ?.label
                          }
                        </Text>{" "}
                        ▼
                      </Text>
                    </TouchableOpacity>
                    {sortOpen && (
                      <View style={styles.sortMenu}>
                        {SORT_OPTIONS.map((option) => (
                          <TouchableOpacity
                            key={option.id}
                            style={[
                              styles.sortOption,
                              sort === option.id && styles.sortOptionActive,
                            ]}
                            onPress={() => {
                              setSort(option.id);
                              setSortOpen(false);
                            }}
                          >
                            <Text
                              style={
                                sort === option.id
                                  ? styles.sortOptionTextActive
                                  : styles.sortOptionText
                              }
                            >
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <FlatList
                data={visibleArtists}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderArtist}
                numColumns={isMobile ? 1 : 3}
                key={isMobile ? "one-col" : "three-col"}
                columnWrapperStyle={!isMobile ? styles.gridRow : undefined}
                contentContainerStyle={styles.gridContainer}
                style={styles.gridScroll}
                showsVerticalScrollIndicator={false}
                onEndReached={loadMore}
                onEndReachedThreshold={0.55}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>
                      {loadingArtists ? "Carregando artistas..." : artistsError ? "Não foi possível carregar os artistas" : "Nenhum artista encontrado"}
                    </Text>
                    <Text style={styles.emptyText}>
                      {loadingArtists ? "Buscando perfis cadastrados no banco de dados." : artistsError ? `${artistsError} Confira se a API está ligada e se o endpoint GET /api/artistas está disponível.` : "Tente outra busca ou limpe os filtros."}
                    </Text>
                  </View>
                }
                ListFooterComponent={
                  <View style={styles.listFooter}>
                    {hasMore ? (
                      <Text style={styles.loadingText}>
                        Role para carregar mais artistas...
                      </Text>
                    ) : (
                      <Text style={styles.loadingText}>
                        Você chegou ao fim dos resultados.
                      </Text>
                    )}
                  </View>
                }
              />
            </View>

            {/* FILTRO LATERAL APENAS PARA DESKTOP/TELA GRANDE */}
            {!isMobile && (
              <View style={styles.filterSidebarContainer}>
                <View style={styles.filterSidebar}>
                  {renderFilterContent()}
                </View>
              </View>
            )}

            {/* MODAL DE FILTRO PARA MOBILE */}
            {isMobile && (
              <Modal
                visible={filterModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setFilterModalVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {renderFilterContent()}
                    </ScrollView>
                  </View>
                </View>
              </Modal>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.mainBg },
    dashboardContainer: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: theme.mainBg,
    },
    rightArea: { flex: 1, flexDirection: "column", minWidth: 0 },
    mainContent: { flex: 1, flexDirection: "row", minHeight: 0, zIndex: 1 },
    centerArea: {
      flex: 1,
      padding: 32,
      minWidth: 0,
      minHeight: 0,
      overflow: "visible",
    },
    centerAreaMobile: { padding: 16 },
    pageHeader: { marginBottom: 20, zIndex: 9999, overflow: "visible" },
    titleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 15,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: "900",
      color: theme.textPrimary,
      fontFamily: "serif",
    },
    mobileFilterBtn: {
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
    },
    mobileFilterBtnText: {
      color: theme.textPrimary,
      fontWeight: "bold",
      fontSize: 13,
    },
    pageSubHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 16,
      zIndex: 9999,
      overflow: "visible",
    },
    resultCount: { fontSize: 15, fontWeight: "bold", color: theme.textPrimary },
    resultCountNormal: { fontWeight: "normal", color: theme.textSecondary },

    sortWrapper: { position: "relative", zIndex: 99999, elevation: 9999 },
    sortDropdown: {
      backgroundColor: theme.cardBg,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    sortText: { color: theme.textSecondary, fontSize: 13 },
    sortStrong: { fontWeight: "bold", color: theme.textPrimary },
    sortMenu: {
      position: "absolute",
      top: 42,
      right: 0,
      width: 180,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 12,
      paddingVertical: 6,
      zIndex: 999999,
      elevation: 50,
      ...Platform.select({
        web: { boxShadow: "0 10px 30px rgba(0,0,0,0.25)" },
      }),
    },
    sortOption: { paddingHorizontal: 14, paddingVertical: 10 },
    sortOptionActive: { backgroundColor: theme.menuActiveBg },
    sortOptionText: { color: theme.textSecondary, fontSize: 12 },
    sortOptionTextActive: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "700",
    },
    gridScroll: { flex: 1, zIndex: 1 },
    gridContainer: { paddingBottom: 20, zIndex: 1 },
    gridRow: { justifyContent: "space-between", gap: 18, marginBottom: 18 },
    artistCard: {
      flex: 1,
      maxWidth: "32%",
      backgroundColor: theme.cardBg,
      borderRadius: 16,
      padding: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.borderColor,
      minHeight: 330,
      zIndex: 1,
    },
    artistCardMobile: {
      maxWidth: "100%",
      width: "100%",
      marginBottom: 16,
    },
    cardHeart: {
      position: "absolute",
      top: 16,
      right: 16,
      zIndex: 10,
      padding: 4,
    },
    heartIcon: { fontSize: 22, color: theme.textSecondary },
    heartIconActive: { fontSize: 22, color: theme.accent },
    avatarWrapper: { alignItems: "center", marginBottom: 12 },
    artistAvatarImage: { width: "100%", height: "100%", borderRadius: 44 },
    avatarPlaceholder: {
      width: 88,
      height: 88,
      borderRadius: 44,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1,
    },
    avatarEmoji: { fontSize: 40 },
    tag: {
      backgroundColor: theme.accent,
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: 16,
      zIndex: 2,
      marginTop: -14,
      borderWidth: 2,
      borderColor: theme.cardBg,
    },
    tagText: { color: "#FFF", fontSize: 11, fontWeight: "bold" },
    artistName: {
      fontSize: 17,
      fontWeight: "bold",
      color: theme.textPrimary,
      marginBottom: 7,
      textAlign: "center",
    },
    artistRating: { fontSize: 13, color: theme.textSecondary, marginBottom: 5 },
    ratingBold: { color: theme.accent, fontWeight: "bold" },
    ratingCount: { color: theme.textSecondary },
    artistPrice: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 3,
    },
    artistDistance: {
      color: theme.textSecondary,
      fontSize: 12,
      marginBottom: 15,
    },
    profileButton: {
      backgroundColor: theme.accent,
      width: "100%",
      paddingVertical: 11,
      borderRadius: 30,
      alignItems: "center",
      marginTop: "auto",
    },
    profileButtonText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },
    listFooter: { alignItems: "center", paddingVertical: 16 },
    loadingText: { color: theme.textSecondary, fontSize: 13 },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 80,
      paddingHorizontal: 30,
    },
    emptyTitle: {
      color: theme.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      marginBottom: 8,
    },
    emptyText: {
      color: theme.textSecondary,
      fontSize: 14,
      textAlign: "center",
    },

    filterSidebarContainer: {
      width: 320,
      paddingVertical: 24,
      paddingRight: 24,
      backgroundColor: theme.mainBg,
      zIndex: 2,
    },
    filterSidebar: {
      flex: 1,
      backgroundColor: theme.cardBg,
      paddingHorizontal: 22,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.borderColor,
      overflow: "hidden",
      ...Platform.select({
        web: { boxShadow: "0 8px 24px rgba(0,0,0,0.08)" },
        default: { elevation: 4 },
      }),
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.cardBg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      maxHeight: "85%",
    },
    applyFilterButton: {
      backgroundColor: theme.accent,
      borderRadius: 25,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 20,
      marginBottom: 10,
    },
    applyFilterButtonText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
    filterScroll: { flex: 1 },
    filterHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
      paddingTop: 10,
    },
    filterTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.textPrimary,
      fontFamily: "serif",
    },
    clearFilters: { color: theme.accent, fontWeight: "600", fontSize: 14 },
    filterBlock: { marginBottom: 18 },
    filterBlockHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    filterSubTitle: {
      fontSize: 15,
      fontWeight: "bold",
      color: theme.textPrimary,
    },
    arrowIcon: { color: theme.textSecondary, fontSize: 15 },
    radioItem: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
    radioActive: { color: theme.accent, fontSize: 18, marginRight: 10 },
    radioInactive: { color: theme.borderColor, fontSize: 18, marginRight: 10 },
    checkItem: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
    checkboxActive: { color: theme.accent, fontSize: 18, marginRight: 10 },
    checkboxInactive: {
      color: theme.borderColor,
      fontSize: 18,
      marginRight: 10,
    },
    filterLabel: { color: theme.textSecondary, fontSize: 13 },
    filterLabelActive: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: "600",
    },
    divider: {
      height: 1,
      backgroundColor: theme.borderColor,
      marginVertical: 15,
    },
    sliderTrack: {
      height: 6,
      backgroundColor: theme.borderColor,
      borderRadius: 3,
      marginVertical: 14,
      position: "relative",
    },
    sliderFill: {
      position: "absolute",
      height: 6,
      backgroundColor: theme.accent,
      borderRadius: 3,
    },
    sliderThumbLeft: {
      position: "absolute",
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.accent,
      top: -8,
      marginLeft: -11,
      borderWidth: 3,
      borderColor: theme.cardBg,
      zIndex: 10,
    },
    sliderThumbRight: {
      position: "absolute",
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.accent,
      top: -8,
      marginLeft: -11,
      borderWidth: 3,
      borderColor: theme.cardBg,
      zIndex: 10,
    },
    priceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    priceText: { color: theme.textSecondary, fontSize: 12 },
    priceInputs: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
    },
    priceInputBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 8,
      paddingHorizontal: 8,
      height: 38,
    },
    inputPrefix: { color: theme.textSecondary, fontSize: 11 },
    priceInput: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 12,
      paddingVertical: 0,
      textAlign: "center",
      ...Platform.select({ web: { outlineStyle: "none" } }),
    },
    locationInputBox: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 10,
      paddingHorizontal: 10,
      height: 40,
      marginBottom: 12,
    },
    locIcon: { fontSize: 15, marginRight: 6 },
    locInput: {
      flex: 1,
      fontSize: 13,
      color: theme.textPrimary,
      ...Platform.select({ web: { outlineStyle: "none" } }),
    },
    distanceLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      marginBottom: 8,
    },
    pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    pill: {
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    pillActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    pillText: { color: theme.textSecondary, fontSize: 11, fontWeight: "600" },
    pillTextActive: { color: "#FFF", fontSize: 11, fontWeight: "bold" },
  });