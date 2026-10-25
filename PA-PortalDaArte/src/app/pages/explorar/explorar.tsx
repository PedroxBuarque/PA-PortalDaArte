import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../components/context/AuthContext";
import { useSearch } from "../../../components/context/SearchContext";
import { useFavorites } from "../../../components/context/FavoritesContext";
import { ARTIST_PROFILE_ROUTE, DISCOVER_ROUTE, FAVORITES_ROUTE } from "../../../constants/auth-routes";

const URL_API = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Geocodificação de cidades para calcular distância em linha reta.
const geocodeCache = new Map<string, { lat: number; lon: number } | null>();
const normalizePlace = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const normalizeLocationPart = (value: string) => normalizePlace(value).replace(/[^a-z0-9]/g, "").trim();
const STATE_ALIASES: Record<string, string> = {
  AC: "acre", AL: "alagoas", AP: "amapa", AM: "amazonas", BA: "bahia", CE: "ceara",
  DF: "distritofederal", ES: "espiritosanto", GO: "goias", MA: "maranhao", MT: "matogrosso",
  MS: "matogrossodosul", MG: "minasgerais", PA: "para", PB: "paraiba", PR: "parana",
  PE: "pernambuco", PI: "piaui", RJ: "riodejaneiro", RN: "riograndedonorte", RS: "riograndedosul",
  RO: "rondonia", RR: "roraima", SC: "santacatarina", SP: "saopaulo", SE: "sergipe", TO: "tocantins",
};
const normalizedState = (value: string) => STATE_ALIASES[normalizeLocationPart(value).toUpperCase()] || normalizeLocationPart(value);
const sameCityAndState = (selectedLocation: string, city: string, state: string) => {
  const selected = selectedLocation.split(",").map((part) => part.trim());
  return selected.length >= 2 && !!city.trim() && !!state.trim()
    && normalizeLocationPart(selected[0]) === normalizeLocationPart(city)
    && normalizedState(selected[1]) === normalizedState(state);
};
const geocodeCity = async (place: string): Promise<{ lat: number; lon: number } | null> => {
  const query = place.trim();
  if (!query) return null;
  const key = normalizePlace(query);
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;

  // Coordenadas de referência para cidades do teste no Ceará. Evita depender
  // exclusivamente de um serviço público de geocodificação.
  const knownCities: Record<string, { lat: number; lon: number }> = {
    "alcantaras ce": { lat: -3.5857, lon: -40.5479 },
    "alcantaras, ce": { lat: -3.5857, lon: -40.5479 },
    "alcantaras ceara": { lat: -3.5857, lon: -40.5479 },
    "sobral ce": { lat: -3.6890, lon: -40.3490 },
    "sobral, ce": { lat: -3.6890, lon: -40.3490 },
    "sobral ceara": { lat: -3.6890, lon: -40.3490 },
  };
  const normalizedQuery = normalizeLocationPart(query.replace(/,\s*Brasil$/i, ""));
  const known = Object.entries(knownCities).find(([name]) => normalizeLocationPart(name) === normalizedQuery)?.[1];
  if (known) { geocodeCache.set(key, known); return known; }

  // Reconhece cidade/UF mesmo quando a API retorna "Cidade, Ceará, Brasil"
  // ou "Cidade, CE"; não depende da pontuação do cadastro.
  const normalizedFullQuery = normalizeLocationPart(query.replace(/,\s*Brasil$/i, ""));
  if (normalizedFullQuery.includes("alcantaras") && normalizedFullQuery.includes("ceara")) {
    const coords = knownCities["alcantaras ce"];
    geocodeCache.set(key, coords); return coords;
  }
  if (normalizedFullQuery.includes("sobral") && (normalizedFullQuery.includes("ceara") || normalizedFullQuery.endsWith("ce"))) {
    const coords = knownCities["sobral ce"];
    geocodeCache.set(key, coords); return coords;
  }

  // Tenta variações: alguns cadastros usam sigla (CE), outros o nome completo (Ceará).
  const withoutCountry = query.replace(/,\s*Brasil$/i, "").trim();
  const parts = withoutCountry.split(",").map((part) => part.trim()).filter(Boolean);
  const stateAliases: Record<string, string> = {
    AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
    DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
    MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
    PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
    RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
  };
  if (parts.length > 1) parts[1] = stateAliases[parts[1].toUpperCase()] || parts[1];
  const queries = [...new Set([query, `${withoutCountry}, Brasil`, `${parts.join(", ")}, Brasil`, parts[0]])];
  let found: { lat: number; lon: number } | null = null;
  try {
    for (const search of queries) {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&country=Brazil&q=${encodeURIComponent(search)}`);
      if (!response.ok) continue;
      const results = await response.json();
      if (Array.isArray(results) && results.length) {
        const lat = Number(results[0].lat);
        const lon = Number(results[0].lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) { found = { lat, lon }; break; }
      }
    }
  } catch {
    found = null;
  }
  // Fallback independente do Nominatim, que pode limitar ou bloquear consultas.
  if (!found && parts.length) {
    try {
      const city = parts[0];
      const state = parts[1] || "";
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=pt&format=json`);
      if (response.ok) {
        const data = await response.json();
        const candidates = Array.isArray(data.results) ? data.results : [];
        const stateNames: Record<string, string> = { CE: "Ceará", PE: "Pernambuco" };
        const wantedState = stateNames[state.toUpperCase()] || state;
        const match = candidates.find((item: any) => item.country_code === "BR" && (!wantedState || normalizePlace(item.admin1 || "") === normalizePlace(wantedState)));
        const item = match || candidates.find((candidate: any) => candidate.country_code === "BR");
        if (item && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))) {
          found = { lat: Number(item.latitude), lon: Number(item.longitude) };
        }
      }
    } catch { /* mantém null se os serviços estiverem indisponíveis */ }
  }
  geocodeCache.set(key, found);
  return found;
};
const haversineKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const firstValue = (...values: any[]) => values.find((value) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0));

// Texto do primeiro valor existente, ou "" quando o campo não existe (evita exibir "undefined").
const textOrEmpty = (...values: any[]): string => {
  const value = firstValue(...values);
  return value === undefined ? "" : String(value);
};

// Remove acentos e caixa para comparar textos na pesquisa.
const foldText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

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
  // Só usa dados que existem no banco; sem categoria/estilo, o card simplesmente não mostra a etiqueta.
  const style = textOrEmpty(raw.estilo_musical, raw.estilo, raw.style, raw.instrumento, raw.instrument, serviceText, categoryText);
  const categorySource = categoryText.toLowerCase();
  const category = /banda/.test(categorySource) ? "Bandas"
    : /foto/.test(categorySource) ? "Fotógrafos"
    : /pint|artes visuais|ilustra|desenh/.test(categorySource) ? "Pintores"
    : /dan[cç]|core[oó]g/.test(categorySource) ? "Dançarinos"
    : /m[uú]sic|cant|instrument|forr[oó]|samba|mpb|rock|dj/.test((categoryText + " " + style).toLowerCase()) ? "Músicos"
    : "Todos os artistas";
  const serviceRecords = Array.isArray(services) ? services : [];
  const serviceDetails = serviceRecords.map((service: any) => [service?.titulo, service?.nome, service?.descricao].map(toText).join(" "));
  const searchableText = foldText([name, categoryText, serviceText, ...serviceDetails, style, raw.biografia, raw.bio, raw.instrumentos, raw.instruments, raw.descricao, raw.description]
    .map(toText).join(" "));
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
    distanceKm: Number(firstValue(raw.distanceKm, raw.distancia_km, raw.distancia, NaN)),
    city: textOrEmpty(raw.cidade_atendimento, raw.cidade, raw.city, raw.municipio, raw.nome_municipio, raw.localidade),
    state: textOrEmpty(raw.estado_atendimento, raw.estado, raw.state, raw.uf, raw.sigla_estado, raw.estado_sigla),
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
  city: string;
  state: string;
  favorite?: boolean;
  avatarUrl?: string | null;
  searchableText: string;
};

// Erros que já têm mensagem própria para o usuário (os demais viram a mensagem genérica de conexão).
const apiError = (message: string) => Object.assign(new Error(message), { fromApi: true });
const CONNECTION_ERROR = "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";

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
const ALL_LOCATIONS = "Todas as localidades";

const MAX_SLIDER_VAL = 5000;
const TRACK_WIDTH = 225;

export default function ExplorarScreen() {
  const { theme, isLightMode } = useTheme();
  const styles = getStyles(theme) as any;
  const { width } = useWindowDimensions();
  const isMobile = width < 900; // Define se é tela de celular/tablet pequeno
  const params = useLocalSearchParams<{ search?: string }>();
  const router = useRouter();
  const { requireAuth, status } = useAuth();
  // Visitante vê o layout público (sem Sidebar); a Sidebar só entra com a sessão autenticada.
  const showSidebar = !isMobile && status === "authenticated";
  // O texto vem da barra de pesquisa do Header (contexto compartilhado). useDeferredValue mantém
  // a digitação fluida: o campo atualiza na hora e a lista acompanha logo em seguida.
  const { query, setQuery } = useSearch();
  const searchQuery = useDeferredValue(query).trim();
  const paramSearch = Array.isArray(params.search) ? params.search[0] : params.search;

  // Compatível com links antigos (?search=termo): aplica o termo da URL na barra de pesquisa.
  useEffect(() => {
    if (typeof paramSearch === "string") setQuery(paramSearch);
  }, [paramSearch, setQuery]);

  const [artists, setArtists] = useState<Artist[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const latestRequest = useRef(0);
  const hasLoadedOnce = useRef(false);
  const [artistsError, setArtistsError] = useState("");
  const [category, setCategory] = useState("Todos os artistas");
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("5000");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [distance, setDistance] = useState(100);
  const [location, setLocation] = useState(ALL_LOCATIONS);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationStep, setLocationStep] = useState<"state" | "city">("state");
  const [ibgeStates, setIbgeStates] = useState<any[]>([]);
  const [ibgeCities, setIbgeCities] = useState<any[]>([]);
  const [selectedState, setSelectedState] = useState<any>(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({ category: true, price: true, rating: true, location: true });
  const [sort, setSort] = useState("rating");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const { favoriteIds, isFavorite, addFavorite, removeFavorite, whenReady } = useFavorites();

  useEffect(() => {
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome")
      .then((response) => response.json())
      .then((data) => setIbgeStates(Array.isArray(data) ? data : []))
      .catch(() => setIbgeStates([]));
  }, []);

  useEffect(() => {
    if (!selectedState?.id) { setIbgeCities([]); return; }
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedState.id}/municipios?orderBy=nome`)
      .then((response) => response.json())
      .then((data) => setIbgeCities(Array.isArray(data) ? data : []))
      .catch(() => setIbgeCities([]));
  }, [selectedState]);

  // Carrega os artistas cadastrados no banco (GET /api/artistas, público).
  // `silent` = atualização em segundo plano: mantém a lista atual na tela e não mostra "carregando".
  const loadArtists = useCallback(async (silent = false) => {
    const request = ++latestRequest.current;
    if (!silent) {
      setLoadingArtists(true);
      setArtistsError("");
    }
    try {
      const response = await fetch(`${URL_API}/api/artistas`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw apiError(payload?.detail || "Não foi possível carregar os artistas.");
      }
      // Atenção: firstValue() ignora arrays vazios, então aqui se procura o primeiro ARRAY (mesmo vazio):
      // um banco sem artistas ({"artistas": []}) é uma lista vazia válida, não um erro.
      const rows = Array.isArray(payload)
        ? payload
        : [payload?.artistas, payload?.items, payload?.results, payload?.data].find(Array.isArray);
      if (!Array.isArray(rows)) throw apiError("A API retornou uma lista de artistas inválida.");
      if (request !== latestRequest.current) return;
      const loaded = rows.map(normalizeArtist);
      // Mantém as distâncias já calculadas quando a lista é atualizada em segundo plano.
      setArtists((current) => {
        const known = new Map(current.map((artist) => [artist.id, artist.distanceKm]));
        return loaded.map((artist) => known.has(artist.id) ? { ...artist, distanceKm: known.get(artist.id) as number } : artist);
      });
      setArtistsError("");
      hasLoadedOnce.current = true;
    } catch (error: any) {
      if (request !== latestRequest.current) return;
      // Numa atualização em segundo plano, quem já está vendo a lista continua vendo.
      if (silent && hasLoadedOnce.current) return;
      setArtists([]);
      setArtistsError(error?.fromApi ? error.message : CONNECTION_ERROR);
    } finally {
      if (request === latestRequest.current) {
        setLoadingArtists(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Carrega ao abrir a tela e recarrega ao voltar para ela, para artistas recém-cadastrados aparecerem.
  useFocusEffect(
    useCallback(() => {
      void loadArtists(hasLoadedOnce.current);
      return () => { latestRequest.current += 1; };
    }, [loadArtists]),
  );

  const refreshArtists = () => {
    setRefreshing(true);
    void loadArtists(true);
  };

  // Calcula distâncias em linha reta e atualiza os artistas progressivamente.
  // Assim, o filtro não fica esperando a geocodificação de todas as cidades.
  useEffect(() => {
    let active = true;
    const calculateDistances = async () => {
      if (location === ALL_LOCATIONS) {
        setArtists((current) => current.map((artist) => ({ ...artist, distanceKm: NaN })));
        return;
      }

      const exactMatches = new Set(
        artists.filter((artist) => sameCityAndState(location, artist.city, artist.state)).map((artist) => artist.id),
      );
      // Correspondências da própria cidade são imediatas e não dependem da internet.
      setArtists((current) => current.map((artist) => ({
        ...artist,
        distanceKm: exactMatches.has(artist.id) ? 0 : NaN,
      })));

      const origin = await geocodeCity(location);
      if (!active || !origin) return;

      const uniquePlaces = new Map<string, { city: string; state: string; ids: number[] }>();
      for (const artist of artists) {
        if (exactMatches.has(artist.id)) continue;
        const city = artist.city.trim();
        const state = artist.state.trim();
        if (!city || !state) continue;
        const place = `${city}, ${state}, Brasil`;
        const key = normalizePlace(place);
        const entry = uniquePlaces.get(key) || { city, state, ids: [] };
        entry.ids.push(artist.id);
        uniquePlaces.set(key, entry);
      }

      let firstRequest = true;
      for (const [key, placeData] of uniquePlaces) {
        if (!active) return;
        // Evita exceder o limite do serviço público Nominatim.
        if (!firstRequest) await new Promise((resolve) => setTimeout(resolve, 1100));
        firstRequest = false;
        const point = await geocodeCity(`${placeData.city}, ${placeData.state}, Brasil`);
        if (!active) return;
        if (!point) continue;
        const km = Math.round(haversineKm(origin, point) * 10) / 10;
        const ids = new Set(placeData.ids);
        setArtists((current) => current.map((artist) => ids.has(artist.id) ? { ...artist, distanceKm: km } : artist));
      }
    };
    const timer = setTimeout(() => { void calculateDistances(); }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [location, artists.length]);

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
    // Cada palavra digitada precisa aparecer em nome, estilo, instrumento ou serviços (ex.: "violão forró").
    const searchTerms = foldText(searchQuery).split(/\s+/).filter(Boolean);
    const result = artists.filter((artist) => {
      const matchesSearch = searchTerms.every((term) => artist.searchableText.includes(term));
      const matchesCategory =
        category === "Todos os artistas" || artist.category === category;
      const matchesPrice =
        artist.price >= numericMin && artist.price <= numericMax;
      const matchesRating = ratingFilter === 0 || artist.rating >= ratingFilter;
      const matchesDistance = location === ALL_LOCATIONS || (Number.isFinite(artist.distanceKm) && artist.distanceKm <= distance);
      return (
        matchesSearch && matchesCategory && matchesPrice && matchesRating && matchesDistance
      );
    });

    return [...result].sort((a, b) => {
      if (sort === "priceAsc") return a.price - b.price;
      if (sort === "priceDesc") return b.price - a.price;
      if (sort === "distance") {
        const aDistance = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.POSITIVE_INFINITY;
        const bDistance = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.POSITIVE_INFINITY;
        return aDistance - bDistance;
      }
      
      // Ordena pelas avaliações reais retornadas pela API; perfis sem avaliação ficam no fim.
      return b.rating - a.rating;
    });
  }, [artists, searchQuery, category, numericMin, numericMax, ratingFilter, distance, sort, location]);

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

  // Favoritar e abrir o perfil completo exigem conta. Visitante é levado à tela de login, que guarda a
  // intenção (?redirect=) para retomar de onde parou depois de entrar.
  // Coração: visitante vai ao login. Logado, ♡ adiciona o artista aos favoritos e leva para a tela de
  // Favoritos; ♥ (já favoritado) remove e permanece em Descobrir.
  const toggleFavorite = (artist: Artist) =>
    requireAuth(async () => {
      await whenReady();
      if (isFavorite(artist.id)) {
        await removeFavorite(artist.id);
        return;
      }
      await addFavorite(artist);
      router.push(FAVORITES_ROUTE as any);
    }, DISCOVER_ROUTE, "login");

  const openArtistProfile = (artist: Artist) => {
    const id = String(artist.id);
    return requireAuth(
      () => router.push({ pathname: ARTIST_PROFILE_ROUTE, params: { id } } as any),
      `${ARTIST_PROFILE_ROUTE}?id=${encodeURIComponent(id)}`,
      "login",
    );
  };

  const clearFilters = () => {
    setCategory("Todos os artistas");
    setMinPrice("0");
    setMaxPrice("5000");
    setRatingFilter(0);
    setDistance(100);
    setLocation(ALL_LOCATIONS);
    setSort("rating");
  };

  const formatPrice = (value: number) => `R$ ${value.toLocaleString("pt-BR")}`;

  const renderArtist = ({ item }: { item: Artist }) => {
    const isFav = favoriteIds.some((id) => String(id) === String(item.id));

    return (
      <View style={[styles.artistCard, isMobile && styles.artistCardMobile]}>
        <TouchableOpacity
          style={styles.cardHeart}
          onPress={() => toggleFavorite(item)}
        >
          <Text style={isFav ? styles.heartIconActive : styles.heartIcon}>
            {isFav ? "♥" : "♡"}
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
          {item.style ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.style}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.artistName}>{item.name}</Text>
        <Text style={styles.artistRating}>
          {item.rating > 0 ? <>⭐ <Text style={styles.ratingBold}>{item.rating.toFixed(1).replace(".", ",")}</Text> <Text style={styles.ratingCount}>({item.reviews})</Text></> : <Text style={styles.ratingCount}>Ainda sem avaliações</Text>}
        </Text>
        <Text style={styles.artistPrice}>{item.price > 0 ? `${formatPrice(item.price)}/hora` : "Preço a combinar"}</Text>
        {Number.isFinite(item.distanceKm) ? <Text style={styles.artistDistance}>{item.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km de distância</Text> : null}
        <TouchableOpacity
          style={styles.profileButton}
          activeOpacity={0.85}
          onPress={() => openArtistProfile(item)}
        >
          <Text style={styles.profileButtonText}>Ver perfil</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFilterContent = () => (
    <ScrollView style={styles.filterScroll} showsVerticalScrollIndicator={false} persistentScrollbar={false} nestedScrollEnabled>
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>Filtros</Text>
        <TouchableOpacity onPress={clearFilters}>
          <Text style={styles.clearFilters}>Limpar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterBlock}>
        <TouchableOpacity style={styles.filterBlockHeader} onPress={() => setExpandedFilters((prev) => ({ ...prev, category: !prev.category }))} activeOpacity={0.75}>
          <Text style={styles.filterSubTitle}>Categoria</Text>
          <View style={styles.expandButton}><Text style={styles.arrowIcon}>{expandedFilters.category ? "−" : "+"}</Text></View>
        </TouchableOpacity>
        {expandedFilters.category && <>
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
        </>}
      </View>

      <View style={styles.divider} />

      <View style={styles.filterBlock}>
        <TouchableOpacity style={styles.filterBlockHeader} onPress={() => setExpandedFilters((prev) => ({ ...prev, price: !prev.price }))} activeOpacity={0.75}>
          <Text style={styles.filterSubTitle}>Preço por hora</Text>
          <View style={styles.expandButton}><Text style={styles.arrowIcon}>{expandedFilters.price ? "−" : "+"}</Text></View>
        </TouchableOpacity>
        {expandedFilters.price && <>
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
        </>}
      </View>

      <View style={styles.divider} />

      <View style={styles.filterBlock}>
        <TouchableOpacity style={styles.filterBlockHeader} onPress={() => setExpandedFilters((prev) => ({ ...prev, rating: !prev.rating }))} activeOpacity={0.75}>
          <Text style={styles.filterSubTitle}>Avaliação mínima</Text>
          <View style={styles.expandButton}><Text style={styles.arrowIcon}>{expandedFilters.rating ? "−" : "+"}</Text></View>
        </TouchableOpacity>
        {expandedFilters.rating && <>
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
        </>}
      </View>

      <View style={styles.divider} />

      <View style={styles.filterBlock}>
        <TouchableOpacity style={styles.filterBlockHeader} onPress={() => setExpandedFilters((prev) => ({ ...prev, location: !prev.location }))} activeOpacity={0.75}>
          <Text style={styles.filterSubTitle}>Localização</Text>
          <View style={styles.expandButton}><Text style={styles.arrowIcon}>{expandedFilters.location ? "−" : "+"}</Text></View>
        </TouchableOpacity>
        {expandedFilters.location && <>
          <TouchableOpacity style={styles.locationInputBox} onPress={() => { setLocationSearch(""); setLocationStep("state"); setLocationModalVisible(true); }} activeOpacity={0.8}>
            <Text style={styles.locIcon}></Text>
            <Text style={styles.locInput}>{location || "Selecionar cidade e estado"}</Text>
            <Text style={styles.arrowIcon}>⌄</Text>
          </TouchableOpacity>
          <Text style={styles.distanceLabel}>Distância máxima</Text>
          <View style={styles.pillsRow}>
            {DISTANCE_OPTIONS.map((option) => (
              <TouchableOpacity key={option} style={[styles.pill, distance === option && styles.pillActive]} onPress={() => setDistance(option)}>
                <Text style={distance === option ? styles.pillTextActive : styles.pillText}>{option} km</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>}
      </View>

      {isMobile && (
        <TouchableOpacity
          style={styles.applyFilterButton}
          onPress={() => setFilterModalVisible(false)}
        >
          <Text style={styles.applyFilterButtonText}>Ver Resultados</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isLightMode ? "dark-content" : "light-content"}
        backgroundColor={theme.headerBg || theme.mainBg}
      />

      <View style={styles.dashboardContainer}>
        {showSidebar && <Sidebar />}

        <View style={styles.rightArea}>
          <Header />

          <View style={styles.mainContent}>
            <View
              style={[styles.centerArea, isMobile && styles.centerAreaMobile]}
            >
              <View style={styles.pageHeader}>
                <View style={styles.titleRow}>
                  <Text style={styles.pageTitle}>Descobrir Artistas</Text>
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
                refreshing={refreshing}
                onRefresh={refreshArtists}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>
                      {loadingArtists
                        ? "Carregando artistas..."
                        : artistsError
                          ? "Não foi possível carregar os artistas"
                          : artists.length === 0
                            ? "Ainda não há artistas cadastrados"
                            : "Nenhum artista encontrado"}
                    </Text>
                    <Text style={styles.emptyText}>
                      {loadingArtists
                        ? "Buscando os artistas cadastrados."
                        : artistsError
                          ? artistsError
                          : artists.length === 0
                            ? "Quando novos artistas se cadastrarem, eles aparecerão aqui."
                            : "Tente outra busca ou limpe os filtros."}
                    </Text>
                    {!loadingArtists && (artistsError || artists.length === 0) ? (
                      <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={() => loadArtists(false)}>
                        <Text style={styles.profileButtonText}>{artistsError ? "Tentar novamente" : "Atualizar"}</Text>
                      </TouchableOpacity>
                    ) : null}
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
                    {renderFilterContent()}
                  </View>
                </View>
              </Modal>
            )}

            <Modal visible={locationModalVisible} transparent animationType="fade" onRequestClose={() => setLocationModalVisible(false)}>
              <View style={[styles.modalOverlay, styles.locationModalOverlay]}>
                <View style={styles.locationModalCard}>
                  <View style={styles.filterHeader}>
                    <View>
                      <Text style={styles.filterTitle}>{locationStep === "state" ? "Selecionar estado" : "Selecionar cidade"}</Text>
                      <Text style={styles.locationModalSubtitle}>{locationStep === "state" ? "Escolha o estado desejado" : `Estado: ${selectedState?.nome || ""}`}</Text>
                    </View>
                    <TouchableOpacity style={styles.modalClosePill} onPress={() => setLocationModalVisible(false)}><Text style={styles.clearFilters}>Fechar</Text></TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.locationListItem, location === ALL_LOCATIONS && styles.sortOptionActive]}
                    onPress={() => {
                      setLocation(ALL_LOCATIONS);
                      setLocationModalVisible(false);
                      setLocationSearch("");
                      setSelectedState(null);
                      setLocationStep("state");
                    }}
                  >
                    <Text style={[styles.locationListItemText, location === ALL_LOCATIONS && { color: theme.accent, fontWeight: "700" }]}>Todas as localidades</Text>
                  </TouchableOpacity>
                  <TextInput value={locationSearch} onChangeText={setLocationSearch} style={styles.locationSearchInput} placeholder={locationStep === "state" ? "Buscar estado..." : "Buscar cidade..."} placeholderTextColor={theme.textSecondary} />
                  {locationStep === "city" && <TouchableOpacity style={styles.backToStates} onPress={() => { setLocationStep("state"); setLocationSearch(""); }}><Text style={styles.clearFilters}>← Escolher outro estado</Text></TouchableOpacity>}
                  <ScrollView style={styles.locationList} keyboardShouldPersistTaps="handled">
                    {(locationStep === "state" ? ibgeStates.filter((item) => `${item.nome} ${item.sigla}`.toLowerCase().includes(locationSearch.toLowerCase())) : ibgeCities.filter((item) => item.nome.toLowerCase().includes(locationSearch.toLowerCase()))).map((item: any) => (
                      <TouchableOpacity key={item.id} style={styles.locationListItem} onPress={() => {
                        if (locationStep === "state") { setSelectedState(item); setLocationStep("city"); setLocationSearch(""); }
                        else { setLocation(`${item.nome}, ${selectedState?.sigla || ""}`); setLocationModalVisible(false); setLocationSearch(""); }
                      }}>
                        <Text style={styles.locationListItemText}>{locationStep === "state" ? `${item.nome} (${item.sigla})` : item.nome}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>
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
    gridRow: { justifyContent: "flex-start", gap: 18, marginBottom: 18 },
    artistCard: {
      flex: 1,
      width: "32%",
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
    retryButton: {
      backgroundColor: theme.accent,
      paddingVertical: 11,
      paddingHorizontal: 26,
      borderRadius: 30,
      alignItems: "center",
      marginTop: 18,
    },
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
    arrowIcon: { color: theme.textSecondary, fontSize: 18, fontWeight: "700" },
    expandButton: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.mainBg, borderWidth: 1, borderColor: theme.borderColor },
    locationModalOverlay: { justifyContent: "center", alignItems: "center", paddingHorizontal: 16, paddingVertical: 24 },
    locationModalCard: { width: "100%", maxWidth: 520, height: "76%", maxHeight: 620, alignSelf: "center", backgroundColor: theme.cardBg, borderRadius: 18, padding: 20, overflow: "hidden" },
    modalClosePill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: theme.mainBg },
    locationModalSubtitle: { color: theme.textSecondary, fontSize: 12, marginTop: 3 },
    locationSearchInput: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: theme.textPrimary, marginBottom: 10 },
    locationList: { flex: 1, minHeight: 0 },
    locationListItem: { paddingVertical: 13, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.borderColor },
    locationListItemText: { color: theme.textPrimary, fontSize: 14 },
    backToStates: { paddingVertical: 8 },
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
      marginHorizontal: 11,
      position: "relative",
      overflow: "visible",
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