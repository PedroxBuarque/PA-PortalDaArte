import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Modal, PanResponder, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { AccessibleTextInput as TextInput } from '../../../components/accessibility/AccessibleTextInput';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from "../../../components/Header";
import Sidebar from "../../../components/Sidebar";
import { DESKTOP_BREAKPOINT, MOBILE_BREAKPOINT } from "../../../constants/responsive";
import { useTheme } from "../../../components/context/ThemeContext";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../components/context/AuthContext";
import { useSearch } from "../../../components/context/SearchContext";
import { useFavorites } from "../../../components/context/FavoritesContext";
import { useCart } from "../../../components/context/CartContext";
import { ARTIST_PROFILE_ROUTE, DISCOVER_ROUTE, FAVORITES_ROUTE } from "../../../constants/auth-routes";
import { buildCategoryOptions, categoryKey } from "../../../constants/artist-categories";
import { ArrowUpRight, ShoppingBag, SlidersHorizontal, Sparkles } from "lucide-react-native";

import { VLibrasText as Text } from '../../../components/accessibility/VLibrasText';
import { portfolioNotice } from '../../../services/portfolio';
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

// Remove vazios e repetidos (sem diferenciar acentos/maiúsculas), mantendo a primeira grafia.
const uniqueNames = (names: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  names.forEach((name) => {
    const label = String(name ?? "").replace(/\s+/g, " ").trim();
    const key = categoryKey(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(label);
  });
  return result;
};

const normalizeArtist = (raw: any, index: number): Artist => {
  const profile = firstValue(raw.perfil, raw.profile, {});
  // Categorias REAIS do Perfil do artista: a principal (categoria_atuacao) + as "Categorias e estilos"
  // (artista_categorias, inclusive personalizadas). É a mesma informação que o Perfil edita.
  const rawCategories = firstValue(raw.categorias, raw.categories, raw.categoria, raw.category, "");
  const categoryNames = uniqueNames([raw.categoria_atuacao, ...(Array.isArray(rawCategories) ? rawCategories : [rawCategories])].map(toText));
  const primaryCategory = categoryNames[0] ?? "";
  const services = firstValue(raw.servicos, raw.services, raw.instrumentos, raw.instruments, "");
  const categoryText = categoryNames.join(" ");
  const serviceText = toText(services);
  const name = String(firstValue(raw.nome_artistico, raw.nome, raw.name, raw.nome_completo, raw.name_artistico, "Artista"));
  // Só usa dados que existem no banco; sem categoria/estilo, o card simplesmente não mostra a etiqueta.
  const style = textOrEmpty(primaryCategory, raw.estilo_musical, raw.estilo, raw.style, raw.instrumento, raw.instrument, serviceText);
  // `category` serve apenas para escolher o emoji/ícone do avatar. O FILTRO usa categoryKeys (nomes reais).
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
  const serviceTitles = uniqueNames(serviceRecords.map((service: any) => toText(service?.titulo ?? service?.nome)));
  const serviceSummaries = serviceRecords.map((service: any) => {
    const low = Number(firstValue(service?.preco_min, service?.preco, service?.price, 0)) || 0;
    const rawHigh = firstValue(service?.preco_max, null);
    const high = rawHigh == null ? low : Number(rawHigh) || 0;
    return {
      id: Number(service?.id) || 0,
      title: toText(service?.titulo ?? service?.nome) || 'Serviço artístico',
      description: toText(service?.descricao ?? service?.description) || '',
      priceMin: low,
      priceMax: high,
      fixedPrice: low > 0 && high > 0 && Math.abs(low - high) < 0.005 ? low : null,
      modality: String(service?.modalidade || raw.modalidade_atendimento || 'ambos'),
    };
  }).filter((service: any) => service.id > 0);
  // Modalidades atendidas: a do artista + a de cada serviço ("ambos" = presencial e remoto).
  const modalities = new Set<string>();
  [raw.modalidade_atendimento, raw.modalidade, ...serviceRecords.map((service: any) => service?.modalidade)].forEach((value) => {
    const mode = foldText(String(value ?? ""));
    if (mode === "ambos") { modalities.add("presencial"); modalities.add("remoto"); }
    else if (mode === "presencial" || mode === "remoto") modalities.add(mode);
  });
  // Preço: faixa entre o menor e o maior valor entre os serviços ativos ("a partir de" = o menor).
  const lows: number[] = [];
  const highs: number[] = [];
  serviceRecords.forEach((service: any) => {
    const low = Number(firstValue(service?.preco_min, service?.preco, service?.price, service?.valor_hora));
    const high = Number(firstValue(service?.preco_max, service?.preco_min, service?.preco, service?.price, service?.valor_hora));
    if (Number.isFinite(low) && low > 0) lows.push(low);
    if (Number.isFinite(high) && high > 0) highs.push(high);
  });
  const rawPrice = firstValue(raw.preco_min, raw.preco, raw.price, raw.valor_hora, raw.valor, lows.length ? Math.min(...lows) : undefined, 0);
  const price = Number(rawPrice) || 0;
  const priceMax = Math.max(price, ...highs);
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
    priceMax,
    categories: categoryNames,
    categoryKeys: categoryNames.map(categoryKey),
    modalities: Array.from(modalities),
    serviceTitles,
    services: serviceSummaries,
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
  price: number; // menor valor entre os serviços ("a partir de")
  priceMax: number;
  categories: string[]; // nomes reais (categoria principal + categorias e estilos do Perfil)
  categoryKeys: string[];
  modalities: string[]; // "presencial" e/ou "remoto"
  serviceTitles: string[];
  services: Array<{ id: number; title: string; description: string; priceMin: number; priceMax: number; fixedPrice: number | null; modality: string }>;
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

// As opções de categoria NÃO são fixas: vêm do Perfil (src/constants/artist-categories.ts) somadas às
// categorias personalizadas que existem nos dados dos artistas. Aqui só o rótulo "todas".
const ALL_CATEGORIES = "Todos os artistas";
const ALL_SERVICES = "Todos os serviços";
const MODALITY_OPTIONS = [
  { id: "todas", label: "Todas" },
  { id: "presencial", label: "Presencial" },
  { id: "remoto", label: "Remoto" },
];
const RATING_OPTIONS = [5, 4, 3];
const DISTANCE_OPTIONS = [10, 25, 50, 100];
const ALL_LOCATIONS = "Todas as localidades";

const TRACK_WIDTH = 225;

// Teto do slider de preço: acompanha o maior valor cadastrado pelos artistas (mínimo R$ 1.000).
const computeSliderMax = (artists: Artist[]) => {
  const highest = artists.reduce((max, artist) => Math.max(max, artist.priceMax || 0), 0);
  return Math.max(1000, Math.ceil(highest / 500) * 500);
};

// Serviços cadastrados pelos artistas (sem repetir), do mais comum para o menos comum.
const buildServiceOptions = (artists: Artist[]): string[] => {
  const found = new Map<string, { label: string; count: number }>();
  artists.forEach((artist) => artist.serviceTitles.forEach((title) => {
    const key = categoryKey(title);
    const entry = found.get(key);
    if (entry) entry.count += 1; else found.set(key, { label: title, count: 1 });
  }));
  return Array.from(found.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }))
    .map((entry) => entry.label);
};

export default function ExplorarScreen() {
  const { theme, isLightMode } = useTheme();
  const styles = getStyles(theme) as any;
  const { width, height } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const isCompactViewport = !isMobile && height <= 820;
  // Em telas realmente largas o filtro pode ocupar uma coluna lateral.
  // Em notebooks e telas menores ele abre como painel/modal para nunca espremer os cards.
  const canUseFilterSidebar = width >= 1480;
  const params = useLocalSearchParams<{ search?: string }>();
  const router = useRouter();
  const { requireAuth, status } = useAuth();
  // Visitante vê o layout público (sem Sidebar); a Sidebar só entra com a sessão autenticada.
  const showSidebar = width >= DESKTOP_BREAKPOINT && status === "authenticated";
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
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [modality, setModality] = useState("todas");
  const [serviceFilter, setServiceFilter] = useState(ALL_SERVICES);
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState(""); // vazio = sem teto (vai até o maior preço cadastrado)
  const [ratingFilter, setRatingFilter] = useState(0);
  const [distance, setDistance] = useState(100);
  const [location, setLocation] = useState(ALL_LOCATIONS);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationStep, setLocationStep] = useState<"state" | "city">("state");
  const [ibgeStates, setIbgeStates] = useState<any[]>([]);
  const [ibgeCities, setIbgeCities] = useState<any[]>([]);
  const [selectedState, setSelectedState] = useState<any>(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({ category: true, modality: true, service: true, price: true, rating: true, location: true });
  const [sort, setSort] = useState("rating");
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const { favoriteIds, isFavorite, addFavorite, removeFavorite, whenReady } = useFavorites();
  const { addItem, hasService } = useCart();
  const [cartNotice, setCartNotice] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSearch, setAiSearch] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState("");
  const [recIds, setRecIds] = useState<number[] | null>(null);
  const [recomendando, setRecomendando] = useState(false);
  const [recNotice, setRecNotice] = useState("");

  const showFilterSidebar = canUseFilterSidebar && filtersVisible;
  // O grid considera a largura REAL disponível depois da navegação e do painel de filtros.
  // Esconder filtros devolve imediatamente a largura ao catálogo.
  const estimatedContentWidth = width
    - (showSidebar ? 236 : 0)
    - (showFilterSidebar ? 330 : 0)
    - (isMobile ? 28 : 48);
  const gridColumns = estimatedContentWidth >= 1120 ? 3 : estimatedContentWidth >= 660 ? 2 : 1;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (category !== ALL_CATEGORIES) count += 1;
    if (modality !== "todas") count += 1;
    if (serviceFilter !== ALL_SERVICES) count += 1;
    if (Number(minPrice || 0) > 0 || maxPrice.trim()) count += 1;
    if (ratingFilter > 0) count += 1;
    if (distance !== 100) count += 1;
    if (location !== ALL_LOCATIONS) count += 1;
    return count;
  }, [category, modality, serviceFilter, minPrice, maxPrice, ratingFilter, distance, location]);

  const toggleFilters = () => {
    if (canUseFilterSidebar) {
      setFiltersVisible((current) => !current);
      return;
    }
    setFilterModalVisible(true);
  };

  useEffect(() => {
    // Se a janela for reduzida enquanto o painel lateral estiver aberto, fecha a coluna
    // e deixa o filtro disponível pelo botão/modal.
    if (!canUseFilterSidebar && filtersVisible) setFiltersVisible(false);
  }, [canUseFilterSidebar, filtersVisible]);

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

  // Opções de filtro derivadas dos dados reais dos artistas (nada fixo): novas categorias, serviços
  // e preços cadastrados no Perfil aparecem aqui sozinhos quando a lista é carregada.
  const categoryOptions = useMemo(
    () => [ALL_CATEGORIES, ...buildCategoryOptions(artists.map((artist) => artist.categories))],
    [artists],
  );
  const serviceOptions = useMemo(() => buildServiceOptions(artists), [artists]);
  const sliderMax = useMemo(() => computeSliderMax(artists), [artists]);
  // Se a opção escolhida deixou de existir (ex.: o artista removeu a categoria), volta para "todas".
  const activeCategory = category === ALL_CATEGORIES || categoryOptions.some((option) => categoryKey(option) === categoryKey(category))
    ? category : ALL_CATEGORIES;
  const activeService = serviceFilter === ALL_SERVICES || serviceOptions.some((option) => categoryKey(option) === categoryKey(serviceFilter))
    ? serviceFilter : ALL_SERVICES;

  const numericMin = Math.max(0, Number(minPrice.replace(/\D/g, "")) || 0);
  const numericMax = Math.min(
    sliderMax,
    Math.max(numericMin, Number(maxPrice.replace(/\D/g, "")) || sliderMax),
  );

  const minPercent = Math.min(100, Math.max(0, (numericMin / sliderMax) * 100));
  const maxPercent = Math.min(100, Math.max(0, (numericMax / sliderMax) * 100));

  // Os arrastos leem valores atuais por ref: o PanResponder é criado uma vez só e, sem isso,
  // continuaria usando o teto e as posições do primeiro render.
  const sliderMaxRef = useRef(sliderMax);
  sliderMaxRef.current = sliderMax;
  const percentRef = useRef({ min: minPercent, max: maxPercent });
  percentRef.current = { min: minPercent, max: maxPercent };
  const dragStartPx = useRef(0);

  const minPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { dragStartPx.current = (percentRef.current.min / 100) * TRACK_WIDTH; },
      onPanResponderMove: (_, gestureState) => {
        const newPx = Math.min(
          (percentRef.current.max / 100) * TRACK_WIDTH,
          Math.max(0, dragStartPx.current + gestureState.dx),
        );
        setMinPrice(String(Math.round((newPx / TRACK_WIDTH) * sliderMaxRef.current)));
      },
    }),
  ).current;

  const maxPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { dragStartPx.current = (percentRef.current.max / 100) * TRACK_WIDTH; },
      onPanResponderMove: (_, gestureState) => {
        const newPx = Math.min(
          TRACK_WIDTH,
          Math.max((percentRef.current.min / 100) * TRACK_WIDTH, dragStartPx.current + gestureState.dx),
        );
        setMaxPrice(String(Math.round((newPx / TRACK_WIDTH) * sliderMaxRef.current)));
      },
    }),
  ).current;

  // RECOMENDAÇÃO SIMULADA APLICADA AQUI
  const filteredArtists = useMemo(() => {
    // Cada palavra digitada precisa aparecer em nome, estilo, instrumento ou serviços (ex.: "violão forró").
    const searchTerms = foldText(searchQuery).split(/\s+/).filter(Boolean);
    const result = artists.filter((artist) => {
      // Busca com IA: qualquer termo interpretado já é suficiente; na busca comum, todos devem aparecer.
      const matchesSearch = searchTerms.length === 0 || (aiSearch
        ? searchTerms.some((term) => artist.searchableText.includes(term))
        : searchTerms.every((term) => artist.searchableText.includes(term)));
      // Categoria = nome real cadastrado no Perfil (principal ou "categorias e estilos").
      const matchesCategory =
        activeCategory === ALL_CATEGORIES || artist.categoryKeys.includes(categoryKey(activeCategory));
      const matchesModality = modality === "todas" || artist.modalities.includes(modality);
      const matchesService =
        activeService === ALL_SERVICES || artist.serviceTitles.some((title) => categoryKey(title) === categoryKey(activeService));
      // Faixa de preço do artista (menor a maior serviço) cruzando com a faixa escolhida.
      // Sem preço cadastrado ("a combinar"), só entra enquanto o mínimo do filtro for zero.
      const matchesPrice = artist.price > 0
        ? artist.priceMax >= numericMin && artist.price <= numericMax
        : numericMin === 0;
      const matchesRating = ratingFilter === 0 || artist.rating >= ratingFilter;
      const matchesDistance = location === ALL_LOCATIONS || (Number.isFinite(artist.distanceKm) && artist.distanceKm <= distance);
      return (
        matchesSearch && matchesCategory && matchesModality && matchesService && matchesPrice && matchesRating && matchesDistance
      );
    });

    const ordenados = [...result].sort((a, b) => {
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
    if (recIds && recIds.length > 0) {
      const rank = new Map(recIds.map((id, indice) => [id, indice]));
      return [...ordenados].sort((a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    }
    return ordenados;
  }, [artists, searchQuery, aiSearch, recIds, activeCategory, modality, activeService, numericMin, numericMax, ratingFilter, distance, sort, location]);

  useEffect(() => {
    setVisibleCount(6);
  }, [
    activeCategory,
    modality,
    activeService,
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
    router.push({ pathname: ARTIST_PROFILE_ROUTE, params: { id } } as any);
  };

  const clearFilters = () => {
    setCategory(ALL_CATEGORIES);
    setModality("todas");
    setServiceFilter(ALL_SERVICES);
    setQuery(""); // "Limpar" restaura a listagem completa, inclusive a pesquisa digitada
    setMinPrice("0");
    setMaxPrice("");
    setRatingFilter(0);
    setDistance(100);
    setLocation(ALL_LOCATIONS);
    setSort("rating");
    setAiSearch(false);
    setAiNotice("");
    setRecIds(null);
    setRecNotice("");
  };

  const handleBuscarComIA = async () => {
    const consulta = aiPrompt.trim();
    if (consulta.length < 3) {
      setAiNotice("Descreva o que procura com pelo menos 3 caracteres.");
      return;
    }
    setAiBusy(true);
    setAiNotice("");
    try {
      const resposta = await fetch(`${URL_API}/api/ia/busca-artistas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consulta }),
      });
      if (!resposta.ok) {
        const erro = await resposta.json().catch(() => ({}));
        throw new Error(erro.detail || "Não foi possível interpretar a busca.");
      }
      const dados = await resposta.json();
      const termos: string[] = (dados.termos || []).slice(0, 6);
      if (termos.length === 0) throw new Error("Não consegui extrair termos da sua busca.");
      setQuery(termos.join(" "));
      if (dados.categoria) setCategory(dados.categoria);
      if (dados.modalidade && dados.modalidade !== "ambos") setModality(dados.modalidade);
      setAiSearch(true);
      setAiNotice(`Busca interpretada: ${termos.join(", ")}.`);
    } catch (erro: any) {
      portfolioNotice("Busca com IA", erro?.message || "Não foi possível interpretar a busca.");
    } finally {
      setAiBusy(false);
    }
  };

  const handleRecomendar = async () => {
    if (recomendando) return;
    if (recIds) {
      setRecIds(null);
      setRecNotice("");
      return;
    }
    if (filteredArtists.length < 2) {
      setRecNotice("Precisa de pelo menos 2 artistas na busca para recomendar.");
      return;
    }
    setRecomendando(true);
    setRecNotice("");
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        requireAuth(() => handleRecomendar(), DISCOVER_ROUTE, "modal");
        return;
      }
      const resposta = await fetch(`${URL_API}/api/ia/recomendacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          artistas: filteredArtists.slice(0, 30).map((artist) => ({
            id: artist.id,
            nome: artist.name.slice(0, 100),
            categorias: artist.categories.slice(0, 6),
            servicos: artist.serviceTitles.slice(0, 6),
            nota: artist.rating,
            cidade: artist.city.slice(0, 100),
          })),
          favoritos_ids: favoriteIds.slice(0, 30).map(Number),
          limite: Math.min(filteredArtists.length, 30),
        }),
      });
      if (!resposta.ok) {
        const erro = await resposta.json().catch(() => ({}));
        throw new Error(erro.detail || "Não foi possível gerar recomendações.");
      }
      const dados = await resposta.json();
      if (!Array.isArray(dados.ids) || dados.ids.length < 2) {
        throw new Error("Não foi possível ordenar os artistas.");
      }
      setRecIds(dados.ids.map(Number));
      setRecNotice("Ordenado por afinidade com seus favoritos.");
    } catch (erro: any) {
      portfolioNotice("Recomendações", erro?.message || "Não foi possível gerar recomendações.");
    } finally {
      setRecomendando(false);
    }
  };

  const formatPrice = (value: number) => `R$ ${value.toLocaleString("pt-BR")}`;

  const renderArtist = ({ item }: { item: Artist }) => {
    const isFav = favoriteIds.some((id) => String(id) === String(item.id));
    const firstFixedService = item.services.find((service) => service.fixedPrice);
    const servicePreview = item.services.slice(0, 2);

    const addQuickService = () => {
      if (!firstFixedService?.fixedPrice) {
        openArtistProfile(item);
        return;
      }
      const result = addItem({
        serviceId: firstFixedService.id,
        artistId: item.id,
        artistName: item.name,
        serviceTitle: firstFixedService.title,
        description: firstFixedService.description || null,
        price: firstFixedService.fixedPrice,
        modality: firstFixedService.modality,
        imageUrl: item.avatarUrl || null,
      });
      setCartNotice(result === 'exists'
        ? `${firstFixedService.title} já está no carrinho.`
        : `${firstFixedService.title} foi adicionado ao carrinho.`);
    };

    return (
      <View style={[styles.artistCard, gridColumns === 3 && styles.artistCardThreeCols, gridColumns === 2 && styles.artistCardTwoCols, gridColumns === 1 && styles.artistCardMobile]}>
        <View style={styles.artFrame}>
          <View style={[styles.avatarPlaceholder, { backgroundColor: item.avatarColor }]}>
            {item.avatarUrl ? (
              <Image source={{ uri: item.avatarUrl }} style={styles.artistAvatarImage} resizeMode="cover" accessible={false} />
            ) : (
              <Text style={styles.avatarEmoji}>{item.emoji}</Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.cardHeart}
            onPress={() => toggleFavorite(item)}
            accessibilityRole="button"
            accessibilityLabel={isFav ? `Remover ${item.name} dos favoritos` : `Adicionar ${item.name} aos favoritos`}
            accessibilityState={{ checked: isFav }}
          >
            <Text style={isFav ? styles.heartIconActive : styles.heartIcon}>{isFav ? "♥" : "♡"}</Text>
          </TouchableOpacity>

          <View style={styles.imageScrim} accessible={false} />
          <View style={styles.artistImageCaption}>
            <Text style={styles.artistImageEyebrow}>{item.style || item.category}</Text>
            {item.city ? <Text style={styles.artistImageLocation}>{item.city}{item.state ? ` · ${item.state}` : ''}</Text> : null}
          </View>
        </View>

        <View style={styles.artistCardBody}>
          <View style={styles.artistOverlineRow}>
            <Text style={styles.artistOverline}>ARTISTA INDEPENDENTE</Text>
            <Text style={styles.artistRatingCompact}>
              {item.rating > 0 ? `★ ${item.rating.toFixed(1).replace(".", ",")}` : "Novo por aqui"}
            </Text>
          </View>

          <Text style={styles.artistName} numberOfLines={2}>{item.name}</Text>

          {servicePreview.length ? (
            <View style={styles.servicePreviewList}>
              {servicePreview.map((service) => (
                <View key={service.id} style={styles.servicePreviewPill}>
                  <Text style={styles.servicePreviewText} numberOfLines={1}>{service.title}</Text>
                </View>
              ))}
              {item.services.length > 2 ? <Text style={styles.moreServices}>+{item.services.length - 2}</Text> : null}
            </View>
          ) : (
            <Text style={styles.noServicesText}>Perfil disponível para orçamento</Text>
          )}

          <View style={styles.artistMetaRow}>
            <Text style={styles.ratingCount}>
              {item.rating > 0 ? `${item.reviews} avaliação${item.reviews === 1 ? "" : "ões"}` : "Ainda sem avaliações"}
            </Text>
            {Number.isFinite(item.distanceKm) ? (
              <Text style={styles.artistDistance}>{item.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km</Text>
            ) : null}
          </View>

          <View style={styles.artistCardFooter}>
            <View style={styles.priceBlock}>
              <Text style={styles.priceEyebrow}>{item.price > 0 ? "A PARTIR DE" : "VALOR"}</Text>
              <Text style={styles.artistPrice}>{item.price > 0 ? formatPrice(item.price) : "A combinar"}</Text>
            </View>
            <View style={styles.cardActions}>
              {firstFixedService?.fixedPrice ? (
                <TouchableOpacity
                  style={[styles.quickCartButton, hasService(firstFixedService.id) && styles.quickCartButtonActive]}
                  activeOpacity={0.82}
                  onPress={addQuickService}
                  accessibilityRole="button"
                  accessibilityLabel={hasService(firstFixedService.id) ? `${firstFixedService.title} já está no carrinho` : `Adicionar ${firstFixedService.title} ao carrinho`}
                >
                  <ShoppingBag size={16} color={hasService(firstFixedService.id) ? theme.onAccent || '#FFFFFF' : theme.accent} accessible={false} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.profileButton}
                activeOpacity={0.85}
                onPress={() => openArtistProfile(item)}
                accessibilityRole="button"
                accessibilityLabel={`Ver perfil e serviços de ${item.name}`}
              >
                <Text style={styles.profileButtonText}>Ver serviços</Text>
                <ArrowUpRight size={16} color={theme.onAccent || "#FFFFFF"} accessible={false} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderFilterContent = () => (
    <ScrollView style={styles.filterScroll} showsVerticalScrollIndicator={false} persistentScrollbar={false} nestedScrollEnabled>
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>Filtros</Text>
        <View style={styles.filterHeaderActions}>
          <TouchableOpacity onPress={clearFilters} accessibilityRole="button">
            <Text style={styles.clearFilters}>Limpar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (showFilterSidebar) setFiltersVisible(false);
              else setFilterModalVisible(false);
            }}
            accessibilityRole="button"
            accessibilityLabel={showFilterSidebar ? "Ocultar filtros" : "Fechar filtros"}
            style={styles.hideFiltersButton}
          >
            <Text style={styles.hideFiltersButtonText}>{showFilterSidebar ? "Ocultar" : "Fechar"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterBlock}>
        <TouchableOpacity style={styles.filterBlockHeader} onPress={() => setExpandedFilters((prev) => ({ ...prev, category: !prev.category }))} activeOpacity={0.75}
          accessibilityRole="button">
          <Text style={styles.filterSubTitle}>Categoria</Text>
          <View style={styles.expandButton}><Text style={styles.arrowIcon}>{expandedFilters.category ? "−" : "+"}</Text></View>
        </TouchableOpacity>
        {expandedFilters.category && (
        <ScrollView style={styles.filterOptionsScroll} nestedScrollEnabled showsVerticalScrollIndicator>
        {categoryOptions.map((option) => {
          const active = activeCategory === option;
          return (
            <TouchableOpacity
              key={option}
              style={styles.radioItem}
              onPress={() => setCategory(option)}
              accessibilityRole="button"
            >
              <Text style={active ? styles.radioActive : styles.radioInactive}>
                {active ? "◉" : "◯"}
              </Text>
              <Text
                style={[active ? styles.filterLabelActive : styles.filterLabel, { flexShrink: 1 }]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
        </ScrollView>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.filterBlock}>
        <TouchableOpacity style={styles.filterBlockHeader} onPress={() => setExpandedFilters((prev) => ({ ...prev, modality: !prev.modality }))} activeOpacity={0.75}
          accessibilityRole="button">
          <Text style={styles.filterSubTitle}>Modalidade de atendimento</Text>
          <View style={styles.expandButton}><Text style={styles.arrowIcon}>{expandedFilters.modality ? "−" : "+"}</Text></View>
        </TouchableOpacity>
        {expandedFilters.modality && MODALITY_OPTIONS.map((option) => {
          const active = modality === option.id;
          return (
            <TouchableOpacity key={option.id} style={styles.radioItem} onPress={() => setModality(option.id)}
              accessibilityRole="button">
              <Text style={active ? styles.radioActive : styles.radioInactive}>{active ? "◉" : "◯"}</Text>
              <Text style={active ? styles.filterLabelActive : styles.filterLabel}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {serviceOptions.length > 0 && (
        <>
          <View style={styles.divider} />

          <View style={styles.filterBlock}>
            <TouchableOpacity style={styles.filterBlockHeader} onPress={() => setExpandedFilters((prev) => ({ ...prev, service: !prev.service }))} activeOpacity={0.75}
              accessibilityRole="button">
              <Text style={styles.filterSubTitle}>Serviços</Text>
              <View style={styles.expandButton}><Text style={styles.arrowIcon}>{expandedFilters.service ? "−" : "+"}</Text></View>
            </TouchableOpacity>
            {expandedFilters.service && (
              <ScrollView style={styles.filterOptionsScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                {[ALL_SERVICES, ...serviceOptions].map((option) => {
                  const active = activeService === option;
                  return (
                    <TouchableOpacity key={option} style={styles.radioItem} onPress={() => setServiceFilter(option)}
                      accessibilityRole="button">
                      <Text style={active ? styles.radioActive : styles.radioInactive}>{active ? "◉" : "◯"}</Text>
                      <Text style={[active ? styles.filterLabelActive : styles.filterLabel, { flexShrink: 1 }]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </>
      )}

      <View style={styles.divider} />

      <View style={styles.filterBlock}>
        <TouchableOpacity style={styles.filterBlockHeader} onPress={() => setExpandedFilters((prev) => ({ ...prev, price: !prev.price }))} activeOpacity={0.75}
          accessibilityRole="button">
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
          <Text style={styles.priceText}>{formatPrice(sliderMax)}</Text>
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
              accessibilityLabel={"Mín:"}
            />
          </View>
          <View style={styles.priceInputBox}>
            <Text style={styles.inputPrefix}>Máx:</Text>
            <TextInput
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
              style={styles.priceInput}
              placeholder={String(sliderMax)}
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={"Máx:"}
            />
          </View>
        </View>
        </>}
      </View>

      <View style={styles.divider} />

      <View style={styles.filterBlock}>
        <TouchableOpacity style={styles.filterBlockHeader} onPress={() => setExpandedFilters((prev) => ({ ...prev, rating: !prev.rating }))} activeOpacity={0.75}
          accessibilityRole="button">
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
              accessibilityRole="button"
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
        <TouchableOpacity style={styles.filterBlockHeader} onPress={() => setExpandedFilters((prev) => ({ ...prev, location: !prev.location }))} activeOpacity={0.75}
          accessibilityRole="button">
          <Text style={styles.filterSubTitle}>Localização</Text>
          <View style={styles.expandButton}><Text style={styles.arrowIcon}>{expandedFilters.location ? "−" : "+"}</Text></View>
        </TouchableOpacity>
        {expandedFilters.location && <>
          <TouchableOpacity style={styles.locationInputBox} onPress={() => { setLocationSearch(""); setLocationStep("state"); setLocationModalVisible(true); }} activeOpacity={0.8}
            accessibilityRole="button">
            <Text style={styles.locIcon}></Text>
            <Text style={styles.locInput}>{location || "Selecionar cidade e estado"}</Text>
            <Text style={styles.arrowIcon}>⌄</Text>
          </TouchableOpacity>
          <Text style={styles.distanceLabel}>Distância máxima</Text>
          <View style={styles.pillsRow}>
            {DISTANCE_OPTIONS.map((option) => (
              <TouchableOpacity key={option} style={[styles.pill, distance === option && styles.pillActive]} onPress={() => setDistance(option)}
                accessibilityRole="button">
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
          accessibilityRole="button"
        >
          <Text style={styles.applyFilterButtonText}>Ver Resultados</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={theme.statusBarStyle || (isLightMode ? "dark-content" : "light-content")}
        backgroundColor={theme.headerBg || theme.mainBg}
      />

      <View style={styles.dashboardContainer}>
        {showSidebar && <Sidebar />}

        <View style={styles.rightArea}>
          <Header />

          <View style={styles.mainContent}>
            <View
              style={[styles.centerArea, isMobile && styles.centerAreaMobile, isCompactViewport && styles.centerAreaCompact]}
            >
              <FlatList
                ListHeaderComponent={
                  <>
                    <View style={[styles.heroPanel, isMobile && styles.heroPanelMobile, isCompactViewport && styles.heroPanelCompact]}>
                    <View style={styles.heroOrbOne} accessible={false} />
                    <View style={styles.heroOrbTwo} accessible={false} />
                    <View style={styles.heroContent}>
                    <View style={styles.heroEyebrowRow}>
                    <Sparkles size={15} color={theme.artGold || "#B94A0A"} accessible={false} />
                    <Text style={styles.heroEyebrow}>CURADORIA ABERTA</Text>
                    </View>
                    <Text style={[styles.heroTitle, isMobile && styles.heroTitleMobile, isCompactViewport && styles.heroTitleCompact]}>Encontre o talento que dá forma à sua ideia.</Text>
                    <Text style={styles.heroDescription}>
                    Descubra artistas independentes, compare estilos e encontre a pessoa certa para transformar seu projeto em experiência.
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, zIndex: 3 }}>
                      <TextInput
                        value={aiPrompt}
                        onChangeText={setAiPrompt}
                        placeholder="Descreva o que procura, ex.: banda de forró para casamento"
                        placeholderTextColor={theme.heroMuted || "#E6D8CF"}
                        style={{ flex: 1, minWidth: 0, backgroundColor: theme.cardBg, borderRadius: 12, borderWidth: 1, borderColor: theme.borderColor, paddingHorizontal: 12, paddingVertical: 10, color: theme.textPrimary, fontSize: 13 }}
                        accessibilityLabel="Descreva com IA o artista que você procura"
                        onSubmitEditing={handleBuscarComIA}
                      />
                      <TouchableOpacity
                        onPress={handleBuscarComIA}
                        disabled={aiBusy}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.accent, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, opacity: aiBusy ? 0.6 : 1 }}
                        accessibilityRole="button"
                        accessibilityLabel="Buscar artistas com inteligência artificial"
                      >
                        <Sparkles size={15} color={theme.onAccent || "#FFFFFF"} accessible={false} />
                        <Text style={{ color: theme.onAccent || "#FFFFFF", fontWeight: '700', fontSize: 12 }}>
                          {aiBusy ? 'Buscando...' : 'Buscar com IA'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {aiNotice ? <Text accessibilityLiveRegion="polite" style={{ color: theme.heroMuted || "#E6D8CF", fontSize: 11, marginTop: 8 }}>{aiNotice}</Text> : null}
                    </View>
                    <View style={styles.heroStat}>
                    <Text style={styles.heroStatNumber}>{filteredArtists.length}</Text>
                    <Text style={styles.heroStatLabel}>talentos nesta busca</Text>
                    </View>
                    </View>

                    <View style={styles.pageHeader}>
                    <View style={styles.titleRow}>
                    <View>
                    <Text style={styles.sectionEyebrow}>CATÁLOGO</Text>
                    <Text style={styles.pageTitle}>Artistas para descobrir</Text>
                    </View>
                    <TouchableOpacity
                    style={[styles.mobileFilterBtn, showFilterSidebar && styles.filterToggleActive]}
                    onPress={toggleFilters}
                    accessibilityRole="button"
                    accessibilityLabel={showFilterSidebar ? "Ocultar filtros" : "Mostrar filtros"}
                    accessibilityState={{ expanded: showFilterSidebar || filterModalVisible }}
                    >
                    <SlidersHorizontal size={16} color={showFilterSidebar ? (theme.onAccent || "#FFFFFF") : theme.textPrimary} accessible={false} />
                    <Text style={[styles.mobileFilterBtnText, showFilterSidebar && styles.filterToggleActiveText]}>
                      {showFilterSidebar ? "Ocultar filtros" : activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : "Filtros"}
                    </Text>
                    </TouchableOpacity>
                    </View>

                    <View style={[styles.pageSubHeader, isMobile && styles.pageSubHeaderMobile]}>
                    <Text style={styles.resultCount}>
                    {filteredArtists.length}{" "}
                    <Text style={styles.resultCountNormal}>
                    resultado{filteredArtists.length === 1 ? "" : "s"} encontrado{filteredArtists.length === 1 ? "" : "s"}
                    </Text>
                    </Text>

                    <TouchableOpacity
                    onPress={handleRecomendar}
                    disabled={recomendando}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: recIds ? theme.accent : theme.borderColor, backgroundColor: recIds ? theme.accentSoft || theme.cardBg : 'transparent', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, opacity: recomendando ? 0.6 : 1, marginRight: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={recIds ? "Desativar recomendação por IA" : "Ordenar artistas por afinidade com meus favoritos"}
                    >
                    <Sparkles size={14} color={theme.accent} accessible={false} />
                    <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '700' }}>
                    {recIds ? 'IA: ativa' : recomendando ? 'Ordenando...' : 'Para você'}
                    </Text>
                    </TouchableOpacity>

                    <View style={styles.sortWrapper}>
                    <TouchableOpacity
                    style={styles.sortDropdown}
                    onPress={() => setSortOpen((value) => !value)}
                    accessibilityRole="button"
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
                    accessibilityRole="button"
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

                    {cartNotice ? (
                    <View style={styles.cartNotice} accessibilityLiveRegion="polite">
                    <ShoppingBag size={16} color={theme.accent} accessible={false} />
                    <Text style={styles.cartNoticeText}>{cartNotice}</Text>
                    <TouchableOpacity onPress={() => router.push('/pages/carrinho/carrinho' as any)} accessibilityRole="button"><Text style={styles.cartNoticeAction}>Ver carrinho</Text></TouchableOpacity>
                    </View>
                    ) : null}
                  </>
                }
                data={visibleArtists}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderArtist}
                numColumns={gridColumns}
                key={`artist-grid-${gridColumns}`}
                columnWrapperStyle={gridColumns > 1 ? styles.gridRow : undefined}
                contentContainerStyle={styles.gridContainer}
                style={styles.gridScroll}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={false}
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
                      <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={() => loadArtists(false)}
                        accessibilityRole="button">
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
            {showFilterSidebar && (
              <View style={styles.filterSidebarContainer}>
                <View style={styles.filterSidebar}>
                  {renderFilterContent()}
                </View>
              </View>
            )}

            {/* MODAL DE FILTRO PARA MOBILE */}
            {!canUseFilterSidebar && (
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
                    <TouchableOpacity style={styles.modalClosePill} onPress={() => setLocationModalVisible(false)}
                      accessibilityRole="button"><Text style={styles.clearFilters}>Fechar</Text></TouchableOpacity>
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
                    accessibilityRole="button"
                  >
                    <Text style={[styles.locationListItemText, location === ALL_LOCATIONS && { color: theme.accent, fontWeight: "700" }]}>Todas as localidades</Text>
                  </TouchableOpacity>
                  <TextInput value={locationSearch} onChangeText={setLocationSearch} style={styles.locationSearchInput} placeholder={locationStep === "state" ? "Buscar estado..." : "Buscar cidade..."} placeholderTextColor={theme.textSecondary}
                    accessibilityLabel={locationStep === "state" ? "Buscar estado" : "Buscar cidade"} />
                  {locationStep === "city" && <TouchableOpacity style={styles.backToStates} onPress={() => { setLocationStep("state"); setLocationSearch(""); }}
                    accessibilityRole="button"><Text style={styles.clearFilters}>← Escolher outro estado</Text></TouchableOpacity>}
                  <ScrollView style={styles.locationList} keyboardShouldPersistTaps="handled">
                    {(locationStep === "state" ? ibgeStates.filter((item) => `${item.nome} ${item.sigla}`.toLowerCase().includes(locationSearch.toLowerCase())) : ibgeCities.filter((item) => item.nome.toLowerCase().includes(locationSearch.toLowerCase()))).map((item: any) => (
                      <TouchableOpacity key={item.id} style={styles.locationListItem} onPress={() => {
                        if (locationStep === "state") { setSelectedState(item); setLocationStep("city"); setLocationSearch(""); }
                        else { setLocation(`${item.nome}, ${selectedState?.sigla || ""}`); setLocationModalVisible(false); setLocationSearch(""); }
                      }}
                        accessibilityRole="button">
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
      padding: 24,
      minWidth: 0,
      minHeight: 0,
      overflow: "visible",
    },
    centerAreaMobile: { padding: 14 },
    centerAreaCompact: { paddingTop: 16, paddingBottom: 16 },
    heroPanel: {
      minHeight: 188,
      backgroundColor: theme.heroBg || theme.textPrimary,
      borderRadius: 24,
      padding: 26,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.borderColor,
      overflow: "hidden",
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 20,
      position: "relative",
      ...Platform.select({ web: { boxShadow: `0 10px 28px ${theme.shadowColor}` } }),
    },
    heroPanelMobile: { minHeight: 0, padding: 20, borderRadius: 22, flexDirection: "column", alignItems: "flex-start" },
    heroPanelCompact: { minHeight: 142, paddingVertical: 20, marginBottom: 16 },
    heroOrbOne: {
      position: "absolute",
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: theme.accent,
      opacity: 0.16,
      right: -46,
      top: -92,
    },
    heroOrbTwo: {
      position: "absolute",
      width: 130,
      height: 130,
      borderRadius: 65,
      backgroundColor: theme.artGold || "#B94A0A",
      opacity: 0.15,
      right: 155,
      bottom: -78,
    },
    heroContent: { flex: 1, maxWidth: 670, zIndex: 2 },
    heroEyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 13 },
    heroEyebrow: { color: theme.artGold || "#B94A0A", fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
    heroTitle: {
      color: theme.heroText || "#FFFFFF",
      fontFamily: "serif",
      fontSize: 34,
      lineHeight: 40,
      fontWeight: "900",
      letterSpacing: -0.8,
      maxWidth: 620,
    },
    heroTitleMobile: { fontSize: 28, lineHeight: 33 },
    heroTitleCompact: { fontSize: 29, lineHeight: 34, maxWidth: 560 },
    heroDescription: { color: theme.heroMuted || "#E6D8CF", fontSize: 13, lineHeight: 20, marginTop: 12, maxWidth: 590 },
    heroStat: {
      minWidth: 132,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 20,
      paddingHorizontal: 18,
      paddingVertical: 16,
      zIndex: 2,
    },
    heroStatNumber: { color: theme.heroText || "#FFFFFF", fontSize: 28, fontWeight: "900", fontFamily: "serif" },
    heroStatLabel: { color: theme.heroMuted || "#E6D8CF", fontSize: 10, lineHeight: 14, marginTop: 2, maxWidth: 90 },
    pageHeader: { marginBottom: 20 },
    titleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginBottom: 15,
      gap: 12,
      flexWrap: "wrap",
    },
    sectionEyebrow: { color: theme.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1.6, marginBottom: 4 },
    pageTitle: {
      fontSize: 28,
      fontWeight: "900",
      color: theme.textPrimary,
      fontFamily: "serif",
      letterSpacing: -0.5,
    },
    mobileFilterBtn: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
    },
    mobileFilterBtnText: { color: theme.textPrimary, fontWeight: "800", fontSize: 13 },
    filterToggleActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    filterToggleActiveText: { color: theme.onAccent || "#FFFFFF" },
    pageSubHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 16,
      zIndex: 2,
    },
    pageSubHeaderMobile: { alignItems: "stretch", flexDirection: "column", gap: 10 },
    resultCount: { fontSize: 13, fontWeight: "800", color: theme.textPrimary },
    resultCountNormal: { fontWeight: "500", color: theme.textSecondary },

    sortWrapper: { position: "relative", zIndex: 20, elevation: 20 },
    sortDropdown: {
      minHeight: 42,
      justifyContent: "center",
      backgroundColor: theme.cardBg,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    sortText: { color: theme.textSecondary, fontSize: 12 },
    sortStrong: { fontWeight: "800", color: theme.textPrimary },
    sortMenu: {
      position: "absolute",
      top: 46,
      right: 0,
      width: 190,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 16,
      paddingVertical: 7,
      zIndex: 40,
      elevation: 40,
      ...Platform.select({ web: { boxShadow: `0 18px 38px ${theme.shadowStrong || theme.shadowColor}` } }),
    },
    sortOption: { paddingHorizontal: 14, paddingVertical: 11 },
    sortOptionActive: { backgroundColor: theme.accentSoft || theme.menuActiveBg },
    sortOptionText: { color: theme.textSecondary, fontSize: 12 },
    sortOptionTextActive: { color: theme.accent, fontSize: 12, fontWeight: "800" },
    gridScroll: { flex: 1, zIndex: 1 },
    gridContainer: { paddingBottom: 36, paddingHorizontal: 1, zIndex: 1 },
    gridRow: { justifyContent: "space-between", marginBottom: 18, width: "100%" },
    artistCard: {
      flexGrow: 0,
      flexShrink: 0,
      width: "100%",
      maxWidth: "100%",
      backgroundColor: theme.cardBg,
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.borderColor,
      minHeight: 414,
      zIndex: 1,
      ...Platform.select({ web: { boxShadow: `0 12px 32px ${theme.shadowColor || "rgba(0,0,0,0.08)"}` } }),
    },
    artistCardThreeCols: { maxWidth: "32%", width: "32%" },
    artistCardTwoCols: { maxWidth: "49%", width: "49%" },
    artistCardMobile: { maxWidth: "100%", width: "100%", marginBottom: 14 },
    artFrame: { height: 218, minHeight: 218, flexShrink: 0, margin: 0, position: "relative", overflow: "hidden" },
    avatarPlaceholder: {
      width: "100%",
      height: "100%",
      borderRadius: 0,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    artistAvatarImage: { width: "100%", height: "100%" },
    avatarEmoji: { fontSize: 54 },
    cardHeart: {
      position: "absolute",
      top: 10,
      right: 10,
      zIndex: 10,
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      ...Platform.select({ web: { boxShadow: `0 8px 18px ${theme.shadowColor}` } }),
    },
    heartIcon: { fontSize: 20, color: theme.textSecondary },
    heartIconActive: { fontSize: 20, color: theme.accent },
    imageScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "48%", backgroundColor: "rgba(20,12,8,0.36)" },
    artistImageCaption: { position: "absolute", left: 13, right: 13, bottom: 12 },
    artistImageEyebrow: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
    artistImageLocation: { color: "rgba(255,255,255,0.82)", fontSize: 9.5, marginTop: 3 },
    tag: {
      position: "absolute",
      left: 10,
      bottom: 10,
      backgroundColor: theme.heroBg || theme.textPrimary,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      maxWidth: "78%",
    },
    tagText: { color: theme.heroText || "#FFFFFF", fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
    artistCardBody: { paddingHorizontal: 17, paddingTop: 15, paddingBottom: 16, flex: 1 },
    artistOverlineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    artistOverline: { color: theme.accent, fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
    artistRatingCompact: { color: theme.textSecondary, fontSize: 10, fontWeight: "700" },
    artistName: {
      fontSize: 19,
      lineHeight: 23,
      fontWeight: "900",
      color: theme.textPrimary,
      marginTop: 7,
      marginBottom: 6,
      fontFamily: "serif",
      letterSpacing: -0.35,
    },
    servicePreviewList: { minHeight: 29, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, marginBottom: 10, overflow: "hidden" },
    servicePreviewPill: { maxWidth: "44%", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: theme.surfaceMuted || theme.mainBg, borderWidth: 1, borderColor: theme.borderColor },
    servicePreviewText: { color: theme.textPrimary, fontSize: 9.5, fontWeight: "700" },
    moreServices: { color: theme.textSecondary, fontSize: 10, fontWeight: "800" },
    noServicesText: { color: theme.textSecondary, fontSize: 10.5, marginTop: 4, marginBottom: 11 },
    artistMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 15 },
    ratingCount: { color: theme.textSecondary, fontSize: 10.5 },
    artistDistance: { color: theme.textSecondary, fontSize: 10.5, fontWeight: "700" },
    artistCardFooter: {
      marginTop: "auto",
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.borderColor,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    priceBlock: { flex: 1, minWidth: 0 },
    cardActions: { flexDirection: "row", alignItems: "center", gap: 7 },
    quickCartButton: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.accentSoft || theme.mainBg, borderWidth: 1, borderColor: theme.borderColor },
    quickCartButtonActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    priceEyebrow: { color: theme.textSecondary, fontSize: 7.5, fontWeight: "900", letterSpacing: 1.1, marginBottom: 2 },
    artistPrice: { color: theme.textPrimary, fontSize: 13, fontWeight: "900" },
    profileButton: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: theme.accent,
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 13,
    },
    profileButtonText: { color: theme.onAccent || "#FFFFFF", fontWeight: "800", fontSize: 12 },
    cartNotice: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 9, marginBottom: 14 },
    cartNoticeText: { flex: 1, color: theme.textPrimary, fontSize: 11, lineHeight: 16 },
    cartNoticeAction: { color: theme.accent, fontSize: 11, fontWeight: "900" },
    retryButton: {
      backgroundColor: theme.accent,
      paddingVertical: 11,
      paddingHorizontal: 26,
      borderRadius: 12,
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
      width: 306,
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
      backgroundColor: theme.overlay || "rgba(0,0,0,0.5)",
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
      gap: 12,
      marginBottom: 20,
      paddingTop: 10,
    },
    filterHeaderActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
    hideFiltersButton: {
      minHeight: 34,
      justifyContent: "center",
      paddingHorizontal: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.borderColor,
      backgroundColor: theme.mainBg,
    },
    hideFiltersButtonText: { color: theme.textPrimary, fontSize: 12, fontWeight: "800" },
    filterTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.textPrimary,
      fontFamily: "serif",
    },
    clearFilters: { color: theme.accent, fontWeight: "600", fontSize: 14 },
    filterOptionsScroll: { maxHeight: 240 },
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
      ...Platform.select({ web: { outlineStyle: "none" as any } }),
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
      ...Platform.select({ web: { outlineStyle: "none" as any } }),
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