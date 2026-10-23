import React, { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  Linking,
  Modal,
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

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Headphones,
  Heart,
  Image as ImageIcon,
  Link as LinkIcon,
  Mic,
  Music,
  Pencil,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react-native";

import { ResizeMode, Video } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Header from "../../../components/Header";
import Sidebar from "../../../components/Sidebar";
import { useTheme } from "../../../components/context/ThemeContext";

const URL_API = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

type PortfolioItem = {
  id: string;
  name: string;
  description: string;
  file: any;
  isFeatured?: boolean;
};

type VideoItem = {
  id: string;
  title: string;
  subtitle: string;
  file: any;
  cover: any;
  type: "music" | "headphones" | "mic";
  isFeatured?: boolean;
};

type CustomLink = {
  id: string;
  label: string;
  url: string;
};

const FIXED_CATEGORIES = [
  "Música • Violão e Voz",
  "Música • Banda Completa",
  "Música • DJ & Produção",
  "Música • Acústico / MPB",
  "Performance • Eventos e Casamentos",
  "Outros • Artista Independente",
];

export default function IndexScreen() {
  const { theme, isLightMode } = useTheme();
  const styles = getStyles(theme);

  const [loadingBackend, setLoadingBackend] = useState(true);
  const [isArtista, setIsArtista] = useState(false);
  const [isBecomingArtistModalVisible, setIsBecomingArtistModalVisible] = useState(false);
  const [artistNameInput, setArtistNameInput] = useState("");
  const [artistBioInput, setArtistBioInput] = useState("");
  const [artistYearsInput, setArtistYearsInput] = useState("1");
  const [artistPriceMinInput, setArtistPriceMinInput] = useState("");
  const [artistPriceMaxInput, setArtistPriceMaxInput] = useState("");
  const [artistModeInput, setArtistModeInput] = useState("ambos");
  const [selectedArtistCategory, setSelectedArtistCategory] = useState(FIXED_CATEGORIES[0]);
  const [isArtistCategoryModalVisible, setIsArtistCategoryModalVisible] = useState(false);
  const [isSubmittingArtist, setIsSubmittingArtist] = useState(false);

  const [estatisticas, setEstatisticas] = useState({
    avaliacao_media: "0.0",
    total_contratacoes: 0,
    total_favoritos: 0,
  });

  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [viewerMediaUri, setViewerMediaUri] = useState<string | null>(null);
  const [viewerMediaType, setViewerMediaType] = useState<
    "image" | "video" | null
  >(null);

  const openViewer = (uri: string, type: "image" | "video" = "image") => {
    setViewerMediaUri(uri);
    setViewerMediaType(type);
    setIsViewerVisible(true);
  };

  const closeViewer = () => {
    setIsViewerVisible(false);
    setViewerMediaUri(null);
    setViewerMediaType(null);
  };

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [editedProfileImage, setEditedProfileImage] = useState<string | null>(null);

  const [profileName, setProfileName] = useState("Usuário");
  const [editedProfileName, setEditedProfileName] = useState("");
  const [artistDisplayName, setArtistDisplayName] = useState("");
  const [editedArtistDisplayName, setEditedArtistDisplayName] = useState("");

  const [location, setLocation] = useState("Caruaru, PE");
  const [editedLocation, setEditedLocation] = useState("Caruaru, PE");

  const [isCityModalVisible, setIsCityModalVisible] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [citiesList, setCitiesList] = useState<string[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  const [profileCategory, setProfileCategory] = useState("Conta Cliente / Contratante");
  const [editedProfileCategory, setEditedProfileCategory] = useState(FIXED_CATEGORIES[0]);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);

  const [bio, setBio] = useState("Bem-vindo ao Portal da Arte.");
  const [editedBio, setEditedBio] = useState("");
  const [artistPriceMin, setArtistPriceMin] = useState<number | null>(null);
  const [artistPriceMax, setArtistPriceMax] = useState<number | null>(null);
  const [editedArtistPriceMin, setEditedArtistPriceMin] = useState("");
  const [editedArtistPriceMax, setEditedArtistPriceMax] = useState("");
  const [artistCategories, setArtistCategories] = useState<string[]>([]);
  const [editedArtistCategories, setEditedArtistCategories] = useState<string[]>([]);
  const [newArtistCategory, setNewArtistCategory] = useState("");
  const [artistServices, setArtistServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [isServiceModalVisible, setIsServiceModalVisible] = useState(false);
  const [editedArtistServices, setEditedArtistServices] = useState<any[]>([]);
  const [newServiceTitle, setNewServiceTitle] = useState("");
  const [newServiceDescription, setNewServiceDescription] = useState("");
  const [newServicePriceMin, setNewServicePriceMin] = useState("");
  const [newServicePriceMax, setNewServicePriceMax] = useState("");

  const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
  const [editedCustomLinks, setEditedCustomLinks] = useState<CustomLink[]>([]);

  const [isLinkModalVisible, setIsLinkModalVisible] = useState(false);
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [urlError, setUrlError] = useState("");

  const [portfolioModalVisible, setPortfolioModalVisible] = useState(false);
  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [portfolioFile, setPortfolioFile] = useState<any>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);

  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoSubtitle, setVideoSubtitle] = useState("");
  const [videoFile, setVideoFile] = useState<any>(null);
  const [videoCover, setVideoCover] = useState<any>(null);
  const [videoItems, setVideoItems] = useState<VideoItem[]>([]);

  // Busca isolada e estrita do perfil da conta logada
  useEffect(() => {
    async function fetchPerfilLogado() {
      try {
        setLoadingBackend(true);
        const token = await AsyncStorage.getItem("access_token");

        if (!token) {
          setLoadingBackend(false);
          return;
        }

        const response = await fetch(`${URL_API}/api/perfis/me`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const result = await response.json();
        if (response.ok && result.dados) {
          const dados = result.dados;
          const nomeCompleto = dados.nome_completo || dados.email || "Usuário";
          const cidadeEstado = dados.cidade && dados.estado ? `${dados.cidade}, ${dados.estado}` : "Caruaru, PE";
          
          setIsArtista(!!dados.is_artista);

          if (dados.is_artista) {
            setProfileCategory(dados.categoria_atuacao || FIXED_CATEGORIES[0]);
            setBio(dados.biografia || "Conte um pouco sobre sua trajetória artística...");
          setArtistPriceMin(dados.preco_min !== null && dados.preco_min !== undefined ? Number(dados.preco_min) : null);
          setArtistPriceMax(dados.preco_max !== null && dados.preco_max !== undefined ? Number(dados.preco_max) : null);
          } else {
            setProfileCategory("Conta Cliente / Contratante");
            setBio(dados.biografia || "Explorando o Portal da Arte para contratar talentos e curtir apresentações.");
          }

          setProfileName(nomeCompleto);
          setLocation(cidadeEstado);
          setProfileImage(dados.foto_perfil || null);

          if (dados.estatisticas) {
            setEstatisticas({
              avaliacao_media: dados.estatisticas.avaliacao_media || "0.0",
              total_contratacoes: dados.estatisticas.total_contratacoes || 0,
              total_favoritos: dados.estatisticas.total_favoritos || 0,
            });
          }
        }
      } catch (error) {
        console.error("Erro ao buscar perfil logado:", error);
      } finally {
        setLoadingBackend(false);
      }
    }

    fetchPerfilLogado();
  }, []);

  useEffect(() => {
    async function fetchAllIbgeCities() {
      try {
        setIsLoadingCities(true);
        const response = await fetch(
          "https://servicodados.ibge.gov.br/api/v1/localidades/municipios",
        );
        const data = await response.json();

        const formattedCities = data.map((item: any) => {
          const cityName = item.nome;
          const ufSigla = item.microrregiao?.mesorregiao?.UF?.sigla || "BR";
          return `${cityName}, ${ufSigla}`;
        });

        formattedCities.sort((a: string, b: string) => a.localeCompare(b));
        setCitiesList(formattedCities);
      } catch (error) {
        console.error("Erro ao carregar municípios do IBGE:", error);
        setCitiesList([
          "Caruaru, PE",
          "Recife, PE",
          "São Paulo, SP",
          "Rio de Janeiro, RJ",
        ]);
      } finally {
        setIsLoadingCities(false);
      }
    }

    fetchAllIbgeCities();
  }, []);

  useEffect(() => {
    if (!isArtista) return;
    let active = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem("access_token");
        if (!token) return;
        const response = await fetch(`${URL_API}/api/me/portfolio`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok) return;
        const rows = Array.isArray(payload.portfolio) ? payload.portfolio : [];
        if (active) {
          setPortfolioItems(rows.map((item: any) => ({
            id: String(item.portfolio_id || item.id),
            name: item.titulo || "Trabalho artístico",
            description: item.descricao || "",
            file: null,
            isFeatured: false,
          })));
        }
      } catch (error) {
        console.warn("Não foi possível carregar o portfólio", error);
      }
    })();
    return () => { active = false; };
  }, [isArtista]);

  useEffect(() => {
    if (!isArtista) return;
    let active = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem("access_token");
        if (!token) return;
        const response = await fetch(`${URL_API}/api/artistas/me/detalhes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || !active) return;
        const categorias = Array.isArray(payload.categorias) ? payload.categorias : [];
        const servicos = Array.isArray(payload.servicos) ? payload.servicos : [];
        setArtistModeInput(["presencial", "remoto", "ambos"].includes(payload.modalidade_atendimento) ? payload.modalidade_atendimento : "ambos");
        setArtistDisplayName(payload.nome_artistico || "");
        setEditedArtistDisplayName(payload.nome_artistico || "");
        setArtistCategories(categorias);
        setEditedArtistCategories(categorias);
        setArtistServices(servicos);
        setEditedArtistServices(servicos.map((item: any) => ({ ...item })));
      } catch (error) {
        console.warn("Não foi possível carregar serviços e categorias do artista", error);
      }
    })();
    return () => { active = false; };
  }, [isArtista]);

  const handleConfirmBecomeArtist = async () => {
    if (!artistNameInput.trim()) {
      Alert.alert("Atenção", "Por favor, digite o nome do artista ou da banda.");
      return;
    }
    const parsePrice = (value: string) => value.trim() ? Number(value.replace(/\./g, "").replace(",", ".")) : null;
    const precoMin = parsePrice(artistPriceMinInput);
    const precoMax = parsePrice(artistPriceMaxInput);
    if ((precoMin !== null && (!Number.isFinite(precoMin) || precoMin < 0)) || (precoMax !== null && (!Number.isFinite(precoMax) || precoMax < 0))) {
      Alert.alert("Preço inválido", "Informe valores válidos e positivos para os preços.");
      return;
    }
    if (precoMin !== null && precoMax !== null && precoMax < precoMin) {
      Alert.alert("Preço inválido", "O preço máximo não pode ser menor que o mínimo.");
      return;
    }

    try {
      setIsSubmittingArtist(true);
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;

      const partesCidade = location.split(",");
      const cidadeNome = partesCidade[0]?.trim() || "Caruaru";
      const estadoSigla = partesCidade[1]?.trim() || "PE";

      const nomeArtistaLimpo = artistNameInput.trim();

      const response = await fetch(`${URL_API}/api/artistas`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome_artistico: nomeArtistaLimpo,
          categoria_atuacao: selectedArtistCategory,
          biografia: artistBioInput.trim() || null,
          anos_experiencia: Math.max(0, Number.parseInt(artistYearsInput || "0", 10) || 0),
          modalidade_atendimento: artistModeInput,
          cidade_atendimento: cidadeNome,
          estado_atendimento: estadoSigla,
          preco_min: precoMin,
          preco_max: precoMax,
        }),
      });

      const result = await response.json();
      if (response.ok) {
        setIsArtista(true);
        setArtistPriceMin(precoMin);
        setArtistPriceMax(precoMax);
        setProfileCategory(selectedArtistCategory);
        setProfileName(nomeArtistaLimpo);
        setBio(artistBioInput.trim() || "Conte um pouco sobre sua trajetória artística...");
        setIsBecomingArtistModalVisible(false);
        setArtistNameInput("");
        Alert.alert("Sucesso", "Parabéns! Agora sua conta é de Artista e os recursos de portfólio foram liberados.");
      } else {
        Alert.alert("Erro", result.detail || "Não foi possível cadastrar como artista.");
      }
    } catch (error) {
      console.error("Erro ao se tornar artista:", error);
      Alert.alert("Erro", "Falha de comunicação com o servidor.");
    } finally {
      setIsSubmittingArtist(false);
    }
  };

  const handleStartEditingProfile = () => {
    setEditedProfileImage(profileImage);
    setEditedProfileName(profileName);
    setEditedArtistDisplayName(artistDisplayName);
    setEditedLocation(location);
    setEditedProfileCategory(isArtista ? profileCategory : FIXED_CATEGORIES[0]);
    setEditedBio(bio);
    setEditedArtistPriceMin(artistPriceMin !== null ? String(artistPriceMin).replace(".", ",") : "");
    setEditedArtistPriceMax(artistPriceMax !== null ? String(artistPriceMax).replace(".", ",") : "");
    setEditedArtistCategories([...artistCategories]);
    setEditedArtistServices(artistServices.map((item: any) => ({ ...item })));
    setNewArtistCategory("");
    setNewServiceTitle("");
    setNewServiceDescription("");
    setEditedCustomLinks(JSON.parse(JSON.stringify(customLinks)));
    setIsEditingProfile(true);
  };

  const handleCancelEditingProfile = () => {
    setEditedArtistPriceMin(artistPriceMin !== null ? String(artistPriceMin).replace(".", ",") : "");
    setEditedArtistPriceMax(artistPriceMax !== null ? String(artistPriceMax).replace(".", ",") : "");
    setEditedArtistCategories([...artistCategories]);
    setEditedArtistServices(artistServices.map((item: any) => ({ ...item })));
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    if (
      !editedProfileName.trim() ||
      !editedLocation.trim() ||
      !editedBio.trim()
    ) {
      Alert.alert("Atenção", "Preencha nome, localização e biografia.");
      return;
    }

    const parseEditedPrice = (value: string) => {
      if (!value.trim()) return null;
      const raw = value.trim().replace(/\s/g, "");
      const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : NaN;
    };
    const precoMinEditado = parseEditedPrice(editedArtistPriceMin);
    const precoMaxEditado = parseEditedPrice(editedArtistPriceMax);
    if (isArtista && ((precoMinEditado !== null && (!Number.isFinite(precoMinEditado) || precoMinEditado < 0)) || (precoMaxEditado !== null && (!Number.isFinite(precoMaxEditado) || precoMaxEditado < 0)))) {
      Alert.alert("Preço inválido", "Informe valores válidos e positivos para os preços.");
      return;
    }
    if (isArtista && precoMinEditado !== null && precoMaxEditado !== null && precoMaxEditado < precoMinEditado) {
      Alert.alert("Preço inválido", "O preço máximo não pode ser menor que o mínimo.");
      return;
    }

    // Inclui também a categoria que ainda estiver digitada no campo, mesmo que
    // o artista não tenha pressionado o botão + antes de salvar o perfil.
    const categoriaDigitada = newArtistCategory.trim();
    const categoriasParaSalvar = [...editedArtistCategories];
    if (categoriaDigitada && !categoriasParaSalvar.some((item) => item.toLowerCase() === categoriaDigitada.toLowerCase())) {
      categoriasParaSalvar.push(categoriaDigitada.slice(0, 100));
    }

    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        Alert.alert("Sessão expirada", "Entre novamente para salvar seu perfil.");
        return;
      }

      const partesCidade = editedLocation.split(",");
      const cidadeNome = partesCidade[0]?.trim() || editedLocation;
      const estadoSigla = partesCidade[1]?.trim() || "PE";

      const response = await fetch(`${URL_API}/api/perfis/me`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome_completo: editedProfileName.trim(),
          cidade: cidadeNome,
          estado: estadoSigla,
          biografia: editedBio.trim(),
          categoria_atuacao: isArtista ? editedProfileCategory.trim() : null,
          foto_perfil: editedProfileImage,
          // O documento obrigatório já foi informado no cadastro; a API o preserva.
        }),
      });

      let result: any = {};
      try {
        result = await response.json();
      } catch {
        // A API pode responder sem corpo JSON em caso de erro.
      }

      if (!response.ok) {
        Alert.alert(
          "Erro ao salvar",
          result.detail || "Não foi possível atualizar o perfil no servidor."
        );
        return;
      }

      if (isArtista) {
        const priceResponse = await fetch(`${URL_API}/api/artistas/me/preco`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ preco_min: precoMinEditado, preco_max: precoMaxEditado }),
        });
        let priceResult: any = {};
        try { priceResult = await priceResponse.json(); } catch {}
        if (!priceResponse.ok) {
          Alert.alert("Perfil parcialmente salvo", priceResult.detail || "Os dados do perfil foram salvos, mas não foi possível atualizar o preço.");
          return;
        }
        setArtistPriceMin(precoMinEditado);
        setArtistPriceMax(precoMaxEditado);
      }

      if (isArtista) {
        const detalhesResponse = await fetch(`${URL_API}/api/artistas/me/detalhes`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            modalidade_atendimento: artistModeInput,
            nome_artistico: editedArtistDisplayName.trim(),
            categorias: categoriasParaSalvar,
            servicos: editedArtistServices.map((item: any) => ({
              id: item.id ?? null,
              titulo: String(item.titulo || "").trim(),
              descricao: String(item.descricao || "").trim(),
              preco_min: item.preco_min === "" || item.preco_min == null ? null : Number(String(item.preco_min).replace(",", ".")),
              preco_max: item.preco_max === "" || item.preco_max == null ? null : Number(String(item.preco_max).replace(",", ".")),
              modalidade: item.modalidade || "ambos",
            })).filter((item: any) => item.titulo),
          }),
        });
        const detalhesResult = await detalhesResponse.json().catch(() => ({}));
        if (!detalhesResponse.ok) {
          Alert.alert("Perfil parcialmente salvo", detalhesResult.detail || "Os dados básicos foram salvos, mas não foi possível atualizar serviços e categorias.");
          return;
        }
        setArtistCategories(Array.isArray(detalhesResult.categorias) ? detalhesResult.categorias : categoriasParaSalvar);
        setEditedArtistCategories(Array.isArray(detalhesResult.categorias) ? detalhesResult.categorias : categoriasParaSalvar);
        setNewArtistCategory("");
        setArtistServices(Array.isArray(detalhesResult.servicos) ? detalhesResult.servicos : editedArtistServices);
        setEditedArtistServices(Array.isArray(detalhesResult.servicos) ? detalhesResult.servicos : editedArtistServices);
      }

      setProfileName(editedProfileName.trim());
      if (isArtista) {
        setArtistDisplayName(editedArtistDisplayName.trim());
      }
      setLocation(editedLocation.trim());
      if (isArtista) {
        setProfileCategory(editedProfileCategory.trim());
      }
      setBio(editedBio.trim());
      setProfileImage(editedProfileImage);

      // Atualiza o avatar do Header imediatamente, sem precisar trocar de tela.
      DeviceEventEmitter.emit("profileUpdated", {
        foto_perfil: editedProfileImage,
        nome_completo: editedProfileName.trim(),
      });

      setCustomLinks([...editedCustomLinks]);
      setIsEditingProfile(false);
      Alert.alert("Sucesso", "Perfil atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      Alert.alert("Erro", "Não foi possível atualizar o perfil no servidor.");
    }
  };

  const isValidSecureUrl = (urlString: string): boolean => {
    try {
      const trimmed = urlString.trim();
      if (!trimmed.toLowerCase().startsWith("https://")) {
        return false;
      }
      const parsedUrl = new URL(trimmed);
      return (
        parsedUrl.protocol === "https:" && parsedUrl.hostname.includes(".")
      );
    } catch {
      return false;
    }
  };

  const handleUrlChange = (text: string) => {
    setNewLinkUrl(text);
    if (text.trim().length > 0 && !isValidSecureUrl(text)) {
      setUrlError(
        "Link inválido. Deve começar com https:// e conter um domínio válido.",
      );
    } else {
      setUrlError("");
    }
  };

  const handleAddCustomLinkFromModal = () => {
    const name = newLinkName.trim();
    const url = newLinkUrl.trim();

    if (!name || !url) return;

    if (!isValidSecureUrl(url)) {
      setUrlError(
        "Link inválido. Deve começar com https:// e conter um domínio válido.",
      );
      return;
    }

    const newItem: CustomLink = {
      id: Date.now().toString(),
      label: name,
      url: url,
    };

    setEditedCustomLinks([...editedCustomLinks, newItem]);
    setNewLinkName("");
    setNewLinkUrl("");
    setUrlError("");
    setIsLinkModalVisible(false);
  };

  const handleRemoveEditedCustomLink = (id: string) => {
    setEditedCustomLinks(editedCustomLinks.filter((item) => item.id !== id));
  };

  const handlePickProfileImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permissão negada", "Precisamos de acesso à galeria para definir a foto de perfil.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64Uri = asset.uri;

        if (asset.base64) {
          base64Uri = `data:image/jpeg;base64,${asset.base64}`;
        }

        setEditedProfileImage(base64Uri);
      }
    } catch (error) {
      console.error("Erro ao selecionar imagem de perfil:", error);
    }
  };

  const openLink = (url: string) => {
    if (!url) return;
    if (isValidSecureUrl(url)) {
      Linking.openURL(url).catch((err) =>
        console.error("Erro ao abrir link:", err),
      );
    } else {
      Alert.alert(
        "Aviso de Segurança",
        "Este link não passou nas validações de segurança.",
      );
    }
  };

  const openPortfolioModal = () => {
    setPortfolioName("");
    setPortfolioDescription("");
    setPortfolioFile(null);
    setPortfolioModalVisible(true);
  };

  const closePortfolioModal = () => setPortfolioModalVisible(false);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets?.length > 0)
        setPortfolioFile(result.assets[0]);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddPortfolio = async () => {
    if (!portfolioName.trim() || !portfolioDescription.trim()) {
      Alert.alert("Campos obrigatórios", "Informe o título e a descrição do trabalho.");
      return;
    }
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) throw new Error("Faça login novamente para salvar seu portfólio.");
      const response = await fetch(`${URL_API}/api/artistas/portfolio`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: portfolioName.trim(), descricao: portfolioDescription.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Não foi possível salvar o item.");
      setPortfolioItems((current) => [...current, { id: String(result.id), name: result.titulo, description: result.descricao, file: null, isFeatured: false }]);
      if (portfolioFile) Alert.alert("Item salvo", "Título e descrição foram publicados. O arquivo selecionado ainda não é enviado ao servidor.");
      closePortfolioModal();
    } catch (error: any) {
      Alert.alert("Erro ao salvar", error?.message || "Não foi possível salvar o item do portfólio.");
    }
  };

  const handleDeletePortfolioItem = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) throw new Error("Faça login novamente.");
      const response = await fetch(`${URL_API}/api/artistas/portfolio/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Não foi possível excluir o item.");
      setPortfolioItems((current) => current.filter((item) => item.id !== id));
    } catch (error: any) {
      Alert.alert("Erro", error?.message || "Não foi possível excluir o item.");
    }
  };

  const handleToggleFeaturePortfolio = (id: string) => {
    setPortfolioItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, isFeatured: !item.isFeatured } : item,
      ),
    );
  };

  const handleMovePortfolioItem = (index: number, direction: "up" | "down") => {
    const newItems = [...portfolioItems];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setPortfolioItems(newItems);
  };

  const openVideoModal = () => {
    setVideoTitle("");
    setVideoSubtitle("");
    setVideoFile(null);
    setVideoCover(null);
    setVideoModalVisible(true);
  };

  const closeVideoModal = () => setVideoModalVisible(false);

  const handlePickVideo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "video/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets?.length > 0)
        setVideoFile(result.assets[0]);
    } catch (error) {
      console.error(error);
    }
  };

  const handlePickVideoCover = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets?.length > 0)
        setVideoCover(result.assets[0]);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddVideo = () => {
    if (!videoTitle.trim() || !videoSubtitle.trim() || !videoFile) return;
    const newVideo: VideoItem = {
      id: Date.now().toString(),
      title: videoTitle.trim(),
      subtitle: videoSubtitle.trim(),
      file: videoFile,
      cover: videoCover,
      type: "music",
      isFeatured: false,
    };
    setVideoItems((current) => [...current, newVideo]);
    closeVideoModal();
  };

  const handleDeleteVideoItem = (id: string) => {
    setVideoItems((current) => current.filter((item) => item.id !== id));
  };

  const handleToggleFeatureVideo = (id: string) => {
    setVideoItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, isFeatured: !item.isFeatured } : item,
      ),
    );
  };

  const handleMoveVideoItem = (index: number, direction: "up" | "down") => {
    const newItems = [...videoItems];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setVideoItems(newItems);
  };

  const filteredCities = citiesList.filter((city) =>
    city
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .includes(
        citySearchQuery
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase(),
      ),
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isLightMode ? "dark-content" : "light-content"}
        backgroundColor={theme.headerBg || theme.mainBg}
      />

      <View style={styles.dashboardContainer}>
        <Sidebar activeRoute="perfil" />

        <View style={styles.mainContent}>
          <Header />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentWrapper}>
              {loadingBackend ? (
                <View style={{ paddingVertical: 50, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={theme.accent} />
                  <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 10 }}>
                    Carregando dados do perfil...
                  </Text>
                </View>
              ) : (
                <>
                  <View
                    style={[
                      styles.profileHeader,
                      isEditingProfile && styles.profileHeaderEditing,
                    ]}
                  >
                    <View style={styles.profileHeaderLeft}>
                      <TouchableOpacity
                        onPress={() => {
                          if (isEditingProfile) handlePickProfileImage();
                          else if (profileImage) openViewer(profileImage, "image");
                        }}
                        style={[
                          styles.profileAvatar,
                          isEditingProfile && styles.profileAvatarEditingMode,
                        ]}
                        activeOpacity={0.8}
                      >
                        {(isEditingProfile ? editedProfileImage : profileImage) ? (
                          <Image
                            source={{
                              uri: isEditingProfile
                                ? editedProfileImage!
                                : profileImage!,
                            }}
                            style={styles.avatarImage}
                          />
                        ) : (
                          <Text style={styles.profileAvatarText}>
                            {profileName ? profileName.charAt(0).toUpperCase() : "C"}
                          </Text>
                        )}
                        {isEditingProfile && (
                          <View style={styles.avatarEditOverlay}>
                            <ImageIcon size={20} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>

                      <View style={styles.profileData}>
                        {!isEditingProfile ? (
                          <>
                            <Text style={styles.profileName}>{profileName}</Text>
                            <View style={styles.locationRow}>
                              <Text style={styles.locationIcon}>⌖</Text>
                              <Text style={styles.locationText}>{location}</Text>
                            </View>
                            <Text style={styles.profileCategory}>
                              {profileCategory}
                            </Text>
                          </>
                        ) : (
                          <View style={styles.editFormColumn}>
                            <View style={styles.editInputBox}>
                              <Text style={styles.editFieldLabel}>
                                {isArtista ? "Nome do Artista" : "Nome Completo"}
                              </Text>
                              <TextInput
                                value={editedProfileName}
                                onChangeText={setEditedProfileName}
                                style={styles.profileNameInputStyled}
                                placeholder="Seu nome"
                                placeholderTextColor={theme.textSecondary}
                              />
                            </View>

                            {isArtista && (
                              <View style={styles.editInputBox}>
                                <Text style={styles.editFieldLabel}>Nome artístico</Text>
                                <TextInput
                                  value={editedArtistDisplayName}
                                  onChangeText={setEditedArtistDisplayName}
                                  style={styles.profileNameInputStyled}
                                  placeholder="Como deseja aparecer no perfil público"
                                  placeholderTextColor={theme.textSecondary}
                                  maxLength={80}
                                />
                                <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}>Até 80 caracteres</Text>
                              </View>
                            )}

                            <TouchableOpacity
                              style={styles.editInputBox}
                              onPress={() => {
                                setCitySearchQuery("");
                                setIsCityModalVisible(true);
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.editFieldLabel}>Localidade</Text>
                              <View style={styles.selectBoxRow}>
                                <Text style={styles.locationIcon}>⌖</Text>
                                <Text
                                  style={[
                                    styles.profileCategorySelectText,
                                    { flex: 1 },
                                  ]}
                                >
                                  {editedLocation || "Selecione a cidade..."}
                                </Text>
                                <ChevronDown
                                  size={16}
                                  color={theme.textSecondary}
                                />
                              </View>
                            </TouchableOpacity>

                            {isArtista && (
                              <TouchableOpacity
                                style={styles.editInputBox}
                                onPress={() => setIsCategoryModalVisible(true)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.editFieldLabel}>
                                  Categoria de Atuação
                                </Text>
                                <View style={styles.selectBoxRow}>
                                  <Music
                                    size={14}
                                    color={theme.accent}
                                    style={{ marginRight: 6 }}
                                  />
                                  <Text
                                    style={[
                                      styles.profileCategorySelectText,
                                      { flex: 1 },
                                    ]}
                                  >
                                    {editedProfileCategory}
                                  </Text>
                                  <ChevronDown
                                    size={16}
                                    color={theme.textSecondary}
                                  />
                                </View>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    </View>

                    {!isEditingProfile && (
                      <TouchableOpacity
                        style={styles.editButton}
                        activeOpacity={0.8}
                        onPress={handleStartEditingProfile}
                      >
                        <Text style={styles.editIcon}>✎</Text>
                        <Text style={styles.editButtonText}>Editar perfil</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View
                    style={[
                      styles.bioCard,
                      isEditingProfile && styles.bioCardEditing,
                    ]}
                  >
                    <View style={styles.bioHeader}>
                      <Text style={styles.sectionTitle}>Sobre mim</Text>
                      {isEditingProfile && (
                        <View style={styles.editingIndicator}>
                          <View style={styles.editingDot} />
                          <Text style={styles.editingIndicatorText}>
                            Editando informações
                          </Text>
                        </View>
                      )}
                    </View>



                    {!isEditingProfile ? (
                      <>
                        <Text style={styles.bioText}>{bio}</Text>
                        {isArtista && artistCategories.length > 0 && (
                          <View style={{ marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: theme.borderColor }}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                              <View>
                                <Text style={[styles.sectionTitle, { fontSize: 15 }]}>Categorias e estilos</Text>
                                <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>O que define o seu trabalho</Text>
                              </View>
                            </View>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
                              {artistCategories.map((category, index) => (
                                <View key={`${category}-${index}`} style={{ borderWidth: 1, borderColor: theme.borderColor, backgroundColor: theme.mainBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}>
                                  <Text style={{ color: theme.textPrimary, fontSize: 12, fontWeight: "600" }}>{category}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                        {isArtista && artistServices.length > 0 && (
                          <View style={{ marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: theme.borderColor }}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                              <View>
                                <Text style={[styles.sectionTitle, { fontSize: 15 }]}>Serviços</Text>
                                <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>Conheça o que você oferece</Text>
                              </View>
                            </View>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                              {artistServices.map((service: any, index: number) => (
                                <TouchableOpacity key={String(service.id || index)} activeOpacity={0.78} onPress={() => { setSelectedService(service); setIsServiceModalVisible(true); }} style={{ flexGrow: 1, flexBasis: 260, maxWidth: 520, minWidth: 0, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: theme.borderColor, backgroundColor: theme.mainBg }}>
                                  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                                    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.borderColor, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                                      <Text style={{ color: theme.accent, fontSize: 15, fontWeight: "800" }}>✦</Text>
                                    </View>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                      <Text numberOfLines={2} ellipsizeMode="tail" style={{ color: theme.textPrimary, fontWeight: "700", fontSize: 13, lineHeight: 19 }}>{service.titulo}</Text>
                                      {!!service.descricao && <Text numberOfLines={3} ellipsizeMode="tail" style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5 }}>{service.descricao}</Text>}
                                      {(service.preco_min != null || service.preco_max != null) && <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "800", marginTop: 9 }}>{service.preco_min != null && service.preco_max != null && Number(service.preco_min) !== Number(service.preco_max) ? `${Number(service.preco_min).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} – ${Number(service.preco_max).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : Number(service.preco_min ?? service.preco_max).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Text>}
                                      <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "700", marginTop: 10 }}>Ver detalhes →</Text>
                                    </View>
                                  </View>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        )}

                        {customLinks.length > 0 && (
                          <View style={styles.socialRow}>
                            {customLinks.map((link) => (
                              <TouchableOpacity
                                key={link.id}
                                style={styles.socialButton}
                                onPress={() => openLink(link.url)}
                              >
                                <LinkIcon
                                  size={12}
                                  color={theme.textSecondary}
                                  style={{ marginRight: 5 }}
                                />
                                <Text style={styles.socialText}>{link.label}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={styles.bioEditingContainer}>
                        <View style={styles.editInputBox}>
                          <Text style={styles.editFieldLabel}>
                            Biografia / Descrição
                          </Text>
                          <TextInput
                            value={editedBio}
                            onChangeText={setEditedBio}
                            multiline
                            textAlignVertical="top"
                            placeholder="Conte um pouco sobre você..."
                            placeholderTextColor={theme.textSecondary}
                            style={styles.bioInputStyled}
                            maxLength={500}
                          />
                          <View style={styles.bioFooter}>
                            <Text style={styles.characterCount}>
                              {editedBio.length}/500
                            </Text>
                          </View>
                        </View>

                        {isArtista && (
                          <View style={[styles.editInputBox, { marginTop: 14 }]}>
                            <Text style={styles.editFieldLabel}>Modalidade de atendimento</Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 11, marginBottom: 9 }}>Informe se você atende presencialmente, remotamente ou das duas formas.</Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                              {[{ label: "Presencial", value: "presencial" }, { label: "Remoto", value: "remoto" }, { label: "Ambos", value: "ambos" }].map((option) => (
                                <TouchableOpacity key={option.value} onPress={() => setArtistModeInput(option.value)} style={{ borderWidth: 1, borderColor: artistModeInput === option.value ? theme.accent : theme.borderColor, backgroundColor: artistModeInput === option.value ? theme.accent + "22" : "transparent", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
                                  <Text style={{ color: theme.textPrimary, fontWeight: artistModeInput === option.value ? "700" : "500" }}>{option.label}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        )}

                        {isArtista && (
                          <View style={[styles.editInputBox, { marginTop: 14 }]}>
                            <Text style={styles.editFieldLabel}>Categorias e estilos</Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 11, marginBottom: 8 }}>Adicione gêneros, estilos musicais ou categorias que descrevam sua atuação.</Text>
                            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                              <TextInput value={newArtistCategory} onChangeText={setNewArtistCategory} placeholder="Ex.: MPB, Forró, Rock" placeholderTextColor={theme.textSecondary} style={[styles.formInput, { flex: 1 }]} onSubmitEditing={() => { const value = newArtistCategory.trim(); if (value && !editedArtistCategories.some((item) => item.toLowerCase() === value.toLowerCase())) setEditedArtistCategories((current) => [...current, value]); setNewArtistCategory(""); }} />
                              <TouchableOpacity onPress={() => { const value = newArtistCategory.trim(); if (value && !editedArtistCategories.some((item) => item.toLowerCase() === value.toLowerCase())) setEditedArtistCategories((current) => [...current, value]); setNewArtistCategory(""); }} style={{ backgroundColor: theme.accent, borderRadius: 9, padding: 12 }}><Plus size={16} color="#FFFFFF" /></TouchableOpacity>
                            </View>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 }}>
                              {editedArtistCategories.map((category, index) => (
                                <View key={`${category}-${index}`} style={{ flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: theme.accent, backgroundColor: theme.mainBg, borderRadius: 16, paddingLeft: 10, paddingRight: 6, paddingVertical: 5 }}>
                                  <Text style={{ color: theme.textPrimary, fontSize: 12 }}>{category}</Text>
                                  <TouchableOpacity onPress={() => setEditedArtistCategories((current) => current.filter((_, i) => i !== index))}><X size={13} color={theme.textSecondary} /></TouchableOpacity>
                                </View>
                              ))}
                            </View>
                            <View style={{ height: 1, backgroundColor: theme.borderColor, marginVertical: 16 }} />
                            <Text style={styles.editFieldLabel}>Serviços</Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 11, marginBottom: 8 }}>Informe os serviços que serão exibidos no seu perfil público.</Text>
                            {editedArtistServices.map((service: any, index: number) => (
                              <View key={String(service.id || `novo-${index}`)} style={{ borderWidth: 1, borderColor: theme.borderColor, borderRadius: 10, padding: 10, marginBottom: 9 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                  <TextInput value={service.titulo || ""} onChangeText={(value) => setEditedArtistServices((current) => current.map((item, i) => i === index ? { ...item, titulo: value } : item))} placeholder="Nome do serviço" placeholderTextColor={theme.textSecondary} maxLength={60} style={[styles.formInput, { flex: 1, minWidth: 0, marginBottom: 8 }]} />
                                  <TouchableOpacity onPress={() => setEditedArtistServices((current) => current.filter((_, i) => i !== index))} style={{ padding: 7, marginBottom: 8 }}><Trash2 size={16} color="#E05A10" /></TouchableOpacity>
                                </View>
                                <TextInput value={service.descricao || ""} onChangeText={(value) => setEditedArtistServices((current) => current.map((item, i) => i === index ? { ...item, descricao: value } : item))} placeholder="Descrição (opcional)" placeholderTextColor={theme.textSecondary} multiline maxLength={500} style={[styles.formInput, { minHeight: 64, textAlignVertical: "top" }]} />
                                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                                  <View style={{ flex: 1 }}><Text style={{ color: theme.textSecondary, fontSize: 11, marginBottom: 5 }}>Valor mínimo (R$)</Text><TextInput value={service.preco_min == null ? "" : String(service.preco_min)} onChangeText={(value) => setEditedArtistServices((current) => current.map((item, i) => i === index ? { ...item, preco_min: value } : item))} placeholder="Ex.: 150" keyboardType="decimal-pad" placeholderTextColor={theme.textSecondary} style={styles.formInput} /></View>
                                  <View style={{ flex: 1 }}><Text style={{ color: theme.textSecondary, fontSize: 11, marginBottom: 5 }}>Valor máximo (R$)</Text><TextInput value={service.preco_max == null ? "" : String(service.preco_max)} onChangeText={(value) => setEditedArtistServices((current) => current.map((item, i) => i === index ? { ...item, preco_max: value } : item))} placeholder="Ex.: 500" keyboardType="decimal-pad" placeholderTextColor={theme.textSecondary} style={styles.formInput} /></View>
                                </View>
                              </View>
                            ))}
                            <TextInput value={newServiceTitle} onChangeText={setNewServiceTitle} placeholder="Novo serviço (ex.: Show ao vivo)" placeholderTextColor={theme.textSecondary} maxLength={60} style={[styles.formInput, { marginBottom: 4 }]} />
                            <Text style={{ color: theme.textSecondary, fontSize: 10, textAlign: "right", marginBottom: 8 }}>{newServiceTitle.length}/60 caracteres</Text>
                            <TextInput value={newServiceDescription} onChangeText={setNewServiceDescription} placeholder="Descrição do serviço (opcional)" placeholderTextColor={theme.textSecondary} multiline maxLength={500} style={[styles.formInput, { minHeight: 64, textAlignVertical: "top", marginBottom: 4 }]} />
                            <Text style={{ color: theme.textSecondary, fontSize: 10, textAlign: "right", marginBottom: 8 }}>{newServiceDescription.length}/500 caracteres</Text>
                            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                              <View style={{ flex: 1 }}><Text style={{ color: theme.textSecondary, fontSize: 11, marginBottom: 5 }}>Valor mínimo (R$)</Text><TextInput value={newServicePriceMin} onChangeText={setNewServicePriceMin} placeholder="Ex.: 150" keyboardType="decimal-pad" placeholderTextColor={theme.textSecondary} style={styles.formInput} /></View>
                              <View style={{ flex: 1 }}><Text style={{ color: theme.textSecondary, fontSize: 11, marginBottom: 5 }}>Valor máximo (R$)</Text><TextInput value={newServicePriceMax} onChangeText={setNewServicePriceMax} placeholder="Ex.: 500" keyboardType="decimal-pad" placeholderTextColor={theme.textSecondary} style={styles.formInput} /></View>
                            </View>
                            <TouchableOpacity onPress={() => { const title = newServiceTitle.trim(); if (!title) { Alert.alert("Serviço", "Informe o nome do serviço."); return; } const min = newServicePriceMin.trim() ? Number(newServicePriceMin.replace(",", ".")) : null; const max = newServicePriceMax.trim() ? Number(newServicePriceMax.replace(",", ".")) : null; if ((min != null && (!Number.isFinite(min) || min < 0)) || (max != null && (!Number.isFinite(max) || max < 0)) || (min != null && max != null && max < min)) { Alert.alert("Valores inválidos", "Confira os valores mínimo e máximo do serviço."); return; } setEditedArtistServices((current) => [...current, { titulo: title, descricao: newServiceDescription.trim(), preco_min: min, preco_max: max, modalidade: "ambos" }]); setNewServiceTitle(""); setNewServiceDescription(""); setNewServicePriceMin(""); setNewServicePriceMax(""); }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: theme.accent, borderRadius: 9, padding: 10 }}><Plus size={15} color={theme.accent} /><Text style={{ color: theme.accent, fontWeight: "700", fontSize: 12 }}>Adicionar serviço</Text></TouchableOpacity>
                          </View>
                        )}

                        <View style={styles.customLinksHeaderRow}>
                          <Text style={styles.linkEditTitle}>Meus Links</Text>
                          <TouchableOpacity
                            style={styles.addCustomLinkBtn}
                            onPress={() => {
                              setNewLinkName("");
                              setNewLinkUrl("");
                              setUrlError("");
                              setIsLinkModalVisible(true);
                            }}
                            activeOpacity={0.8}
                          >
                            <Plus size={14} color="#FFFFFF" />
                            <Text style={styles.addCustomLinkText}>
                              Adicionar link
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.linkEditGroup}>
                          {editedCustomLinks.length === 0 ? (
                            <Text style={styles.noLinksText}>
                              Nenhum link adicionado ainda.
                            </Text>
                          ) : (
                            editedCustomLinks.map((item) => (
                              <View key={item.id} style={styles.customLinkRowItem}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.linkItemLabel}>
                                    {item.label}
                                  </Text>
                                  <Text
                                    style={styles.linkItemUrl}
                                    numberOfLines={1}
                                  >
                                    {item.url}
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  onPress={() =>
                                    handleRemoveEditedCustomLink(item.id)
                                  }
                                  style={styles.removeCustomBtn}
                                >
                                  <Trash2 size={16} color="#E05A10" />
                                </TouchableOpacity>
                              </View>
                            ))
                          )}
                        </View>
                      </View>
                    )}
                  </View>

                  {isEditingProfile && (
                    <View style={styles.profileEditActions}>
                      <TouchableOpacity
                        style={styles.cancelProfileButton}
                        onPress={handleCancelEditingProfile}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.cancelBioText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.saveBioButton}
                        onPress={handleSaveProfile}
                        activeOpacity={0.8}
                      >
                        <Check size={15} color="#FFFFFF" />
                        <Text style={styles.saveBioText}>Salvar</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Renderização condicional: Estatísticas e Portfólio APARECEM APENAS PARA ARTISTAS */}
                  {isArtista ? (
                    <>
                      <View style={styles.statsRow}>
                        <StatCard
                          theme={theme}
                          number={estatisticas.avaliacao_media}
                          label="Avaliação média"
                          icon={<Text style={styles.starIcon}>★</Text>}
                        />
                        <View
                        style={[
                          styles.statCard,
                          {
                            marginBottom: 0,
                            marginRight: 12,
                            minWidth: 0,
                            alignItems: isEditingProfile ? "stretch" : "center",
                            flexDirection: isEditingProfile ? "column" : "row",
                          },
                        ]}
                      >
                        <View style={[styles.statIcon, isEditingProfile && { alignSelf: "flex-start", marginBottom: 10 }]}>
                          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "800" }}>R$</Text>
                        </View>
                        {!isEditingProfile ? (
                          <View style={{ flex: 1 }}>
                            <Text style={styles.statNumber}>
                              {artistPriceMin !== null
                                ? `R$ ${artistPriceMin.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "Não informado"}
                              {artistPriceMax !== null && artistPriceMax !== artistPriceMin
                                ? ` – R$ ${artistPriceMax.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : ""}
                            </Text>
                            <Text style={styles.statLabel}>Meu valor</Text>
                          </View>
                        ) : (
                          <View style={{ width: "100%" }}>
                            <Text style={[styles.statLabel, { fontSize: 12, fontWeight: "700", marginBottom: 10 }]}>Meu valor · Editar preços (R$)</Text>
                            <Text style={styles.editFieldLabel}>Preço inicial</Text>
                            <TextInput value={editedArtistPriceMin} onChangeText={setEditedArtistPriceMin} keyboardType="decimal-pad" placeholder="Ex.: 300,00" placeholderTextColor={theme.textSecondary} style={[styles.formInput, { marginBottom: 10 }]} />
                            <Text style={styles.editFieldLabel}>Preço máximo (opcional)</Text>
                            <TextInput value={editedArtistPriceMax} onChangeText={setEditedArtistPriceMax} keyboardType="decimal-pad" placeholder="Ex.: 900,00" placeholderTextColor={theme.textSecondary} style={styles.formInput} />
                            <Text style={{ color: theme.textSecondary, fontSize: 10, marginTop: 6 }}>Deixe os campos vazios para remover a faixa de preço.</Text>
                          </View>
                        )}
                      </View>
                      </View>
                      <View style={styles.statsRow}>
                        <StatCard
                          theme={theme}
                          number={estatisticas.total_contratacoes}
                          label="Contratações"
                          icon={<Music size={18} color={theme.accent} />}
                        />
                        <StatCard
                          theme={theme}
                          number={estatisticas.total_favoritos}
                          label="Favoritos"
                          icon={<Heart size={18} color="#E05A10" />}
                        />
                      </View>

                      <View style={styles.sectionHeader}>
                        <View>
                          <Text style={styles.sectionTitle}>Portfólio</Text>
                          <Text style={styles.sectionSubtitle}>
                            Mostre seus trabalhos e apresentações
                          </Text>
                        </View>
                        <View style={styles.portfolioActions}>
                          <TouchableOpacity
                            style={styles.addPortfolioButton}
                            activeOpacity={0.8}
                            onPress={openPortfolioModal}
                          >
                            <Text style={styles.addIcon}>+</Text>
                            <Text style={styles.addPortfolioText}>Adicionar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.addVideoButton}
                            activeOpacity={0.8}
                            onPress={openVideoModal}
                          >
                            <Text style={styles.addVideoIcon}>+</Text>
                            <Text style={styles.addVideoText}>Adicionar vídeo</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {portfolioItems.length === 0 ? (
                        <View style={styles.emptyPortfolioCard}>
                          <Music size={24} color={theme.textSecondary} style={{ marginBottom: 6 }} />
                          <Text style={styles.emptyPortfolioText}>Ainda não há nada no portfólio.</Text>
                          <Text style={styles.emptyPortfolioSubText}>Adicione trabalhos ou mídias para exibi-los aqui.</Text>
                        </View>
                      ) : (
                        portfolioItems.map((item, index) => {
                          const isImage = item.file?.mimeType?.startsWith("image/");
                          const isVideo = item.file?.mimeType?.startsWith("video/");
                          return (
                            <View
                              key={item.id}
                              style={[
                                styles.portfolioCard,
                                item.isFeatured && styles.portfolioCardFeatured,
                              ]}
                            >
                              {item.isFeatured && (
                                <View style={styles.featuredBadge}>
                                  <Star
                                    size={10}
                                    color="#FFFFFF"
                                    fill="#FFFFFF"
                                    style={{ marginRight: 3 }}
                                  />
                                  <Text style={styles.featuredBadgeText}>Destaque</Text>
                                </View>
                              )}

                              <View style={styles.portfolioPreview}>
                                {isImage || isVideo ? (
                                  <TouchableOpacity
                                    style={{
                                      flex: 1,
                                      width: "100%",
                                      position: "relative",
                                    }}
                                    activeOpacity={0.85}
                                    onPress={() =>
                                      openViewer(
                                        item.file.uri,
                                        isVideo ? "video" : "image",
                                      )
                                    }
                                  >
                                    {isImage ? (
                                      <Image
                                        source={{ uri: item.file.uri }}
                                        style={styles.fullCoverImage}
                                      />
                                    ) : (
                                      <View
                                        style={[
                                          styles.fullCoverImage,
                                          {
                                            backgroundColor: "#33231D",
                                            justifyContent: "center",
                                            alignItems: "center",
                                          },
                                        ]}
                                      >
                                        <Text style={{ fontSize: 24, color: "#fff" }}>
                                          ▶
                                        </Text>
                                      </View>
                                    )}
                                  </TouchableOpacity>
                                ) : (
                                  <>
                                    <Music size={38} color={theme.accent} />
                                    <Text style={styles.portfolioPreviewTitle}>
                                      Portfólio
                                    </Text>
                                    <Text style={styles.portfolioPreviewText}>
                                      Trabalho
                                    </Text>
                                  </>
                                )}
                              </View>

                              <View style={styles.portfolioInfo}>
                                <Text style={styles.portfolioTitle}>{item.name}</Text>
                                <Text style={styles.portfolioDescription}>
                                  {item.description}
                                </Text>
                                {item.file?.name && !isImage && !isVideo && (
                                  <Text style={styles.portfolioFileName}>
                                    📎 {item.file.name}
                                  </Text>
                                )}
                              </View>

                              <View style={styles.portfolioCardActions}>
                                <TouchableOpacity
                                  style={[
                                    styles.cardActionBtn,
                                    item.isFeatured && styles.cardActionBtnActive,
                                  ]}
                                  onPress={() => handleToggleFeaturePortfolio(item.id)}
                                >
                                  <Star
                                    size={14}
                                    color={
                                      item.isFeatured ? "#FFFFFF" : theme.textSecondary
                                    }
                                    fill={item.isFeatured ? "#FFFFFF" : "none"}
                                  />
                                </TouchableOpacity>

                                {index > 0 && (
                                  <TouchableOpacity
                                    style={styles.cardActionBtn}
                                    onPress={() => handleMovePortfolioItem(index, "up")}
                                  >
                                    <ArrowUp size={14} color={theme.textSecondary} />
                                  </TouchableOpacity>
                                )}

                                {index < portfolioItems.length - 1 && (
                                  <TouchableOpacity
                                    style={styles.cardActionBtn}
                                    onPress={() => handleMovePortfolioItem(index, "down")}
                                  >
                                    <ArrowDown size={14} color={theme.textSecondary} />
                                  </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                  style={[styles.cardActionBtn, styles.cardActionDelete]}
                                  onPress={() => handleDeletePortfolioItem(item.id)}
                                >
                                  <Trash2 size={14} color="#E05A10" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })
                      )}

                      <View style={styles.videoGrid}>
                        {videoItems.map((video, index) => {
                          let IconComponent = Music;
                          if (video.type === "headphones") IconComponent = Headphones;
                          if (video.type === "mic") IconComponent = Mic;

                          return (
                            <View
                              key={video.id}
                              style={[
                                styles.videoCard,
                                video.isFeatured && styles.videoCardFeatured,
                              ]}
                            >
                              {video.isFeatured && (
                                <View style={styles.featuredBadgeVideo}>
                                  <Star
                                    size={9}
                                    color="#FFFFFF"
                                    fill="#FFFFFF"
                                    style={{ marginRight: 2 }}
                                  />
                                  <Text style={styles.featuredBadgeText}>Destaque</Text>
                                </View>
                              )}

                              <View style={styles.videoCardActions}>
                                <TouchableOpacity
                                  style={[
                                    styles.cardActionBtn,
                                    video.isFeatured && styles.cardActionBtnActive,
                                  ]}
                                  onPress={() => handleToggleFeatureVideo(video.id)}
                                >
                                  <Star
                                    size={13}
                                    color={
                                      video.isFeatured ? "#FFFFFF" : theme.textSecondary
                                    }
                                    fill={video.isFeatured ? "#FFFFFF" : "none"}
                                  />
                                </TouchableOpacity>

                                {index > 0 && (
                                  <TouchableOpacity
                                    style={styles.cardActionBtn}
                                    onPress={() => handleMoveVideoItem(index, "up")}
                                  >
                                    <ArrowUp size={13} color={theme.textSecondary} />
                                  </TouchableOpacity>
                                )}

                                {index < videoItems.length - 1 && (
                                  <TouchableOpacity
                                    style={styles.cardActionBtn}
                                    onPress={() => handleMoveVideoItem(index, "down")}
                                  >
                                    <ArrowDown size={13} color={theme.textSecondary} />
                                  </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                  style={[
                                    styles.cardActionBtn,
                                    styles.cardActionDelete,
                                  ]}
                                  onPress={() => handleDeleteVideoItem(video.id)}
                                >
                                  <Trash2 size={13} color="#E05A10" />
                                </TouchableOpacity>
                              </View>

                              <TouchableOpacity
                                style={styles.videoThumbnail}
                                activeOpacity={0.85}
                                onPress={() => {
                                  if (video.file?.uri)
                                    openViewer(video.file.uri, "video");
                                }}
                              >
                                {video.cover?.uri ? (
                                  <Image
                                    source={{ uri: video.cover.uri }}
                                    style={styles.fullCoverImage}
                                  />
                                ) : (
                                  <View style={styles.videoIconCircle}>
                                    <IconComponent size={25} color="#FFFFFF" />
                                  </View>
                                )}
                                <View style={styles.playButton}>
                                  <Text style={styles.playText}>▶</Text>
                                </View>
                              </TouchableOpacity>

                              <View style={styles.videoInfo}>
                                <Text style={styles.videoTitle}>{video.title}</Text>
                                <Text style={styles.videoSubtitle}>
                                  {video.subtitle}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </>
                  ) : (
                    <View style={styles.notArtistCard}>
                      <Music size={28} color={theme.accent} style={{ marginBottom: 8 }} />
                      <Text style={styles.notArtistTitle}>Área exclusiva para Artistas</Text>
                      <Text style={styles.notArtistSubtitle}>
                        Você está logado com uma conta de contratante/cliente. Para exibir seu portfólio, avaliações e contratações aqui, torne-se um artista cadastrando seu perfil profissional.
                      </Text>
                      <TouchableOpacity
                        style={styles.becomeArtistButton}
                        onPress={() => {
                          setArtistNameInput("");
                          setArtistBioInput(bio && !bio.startsWith("Explorando") ? bio : "");
                          setArtistYearsInput("1");
                          setArtistPriceMinInput("");
                          setArtistPriceMaxInput("");
                          setArtistModeInput("ambos");
                          setSelectedArtistCategory(FIXED_CATEGORIES[0]);
                          setIsBecomingArtistModalVisible(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.becomeArtistButtonText}>Quero ser um Artista</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Modal de detalhes do serviço: descrição independente e rolável */}
      <Modal visible={isServiceModalVisible} transparent animationType="fade" onRequestClose={() => setIsServiceModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: "82%", width: "92%", maxWidth: 560 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                <Text style={styles.modalTitle} numberOfLines={2}>{selectedService?.titulo || "Detalhes do serviço"}</Text>
                <Text style={styles.modalSubtitle}>Informações do serviço</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsServiceModalVisible(false)}>
                <X size={19} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
              {(selectedService?.preco_min != null || selectedService?.preco_max != null) && <View style={{ marginBottom: 18, padding: 13, borderRadius: 10, backgroundColor: theme.mainBg, borderWidth: 1, borderColor: theme.borderColor }}>
                <Text style={{ color: theme.textSecondary, fontSize: 11, marginBottom: 4 }}>Valor do serviço</Text>
                <Text style={{ color: theme.accent, fontSize: 18, fontWeight: "800" }}>{selectedService?.preco_min != null && selectedService?.preco_max != null && Number(selectedService.preco_min) !== Number(selectedService.preco_max) ? `${Number(selectedService.preco_min).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} – ${Number(selectedService.preco_max).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : Number(selectedService?.preco_min ?? selectedService?.preco_max).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Text>
              </View>}
              <View style={{ padding: 13, borderRadius: 10, backgroundColor: theme.mainBg, borderWidth: 1, borderColor: theme.borderColor }}>
                <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: "700", marginBottom: 8 }}>Descrição</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 21 }}>{selectedService?.descricao?.trim() || "Nenhuma descrição informada."}</Text>
              </View>
            </ScrollView>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: theme.borderColor, gap: 10 }}>
              <TouchableOpacity onPress={() => setIsServiceModalVisible(false)} style={{ paddingHorizontal: 15, paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: theme.borderColor }}><Text style={{ color: theme.textPrimary, fontWeight: "600", fontSize: 12 }}>Fechar</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setIsServiceModalVisible(false); setIsEditingProfile(true); setEditedArtistServices(artistServices.map((item: any) => ({ ...item }))); }} style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 8, backgroundColor: theme.accent }}><Pencil size={14} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 12 }}>Editar serviços</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmação para se tornar Artista com o mesmo padrão do Editar Perfil */}
      <Modal
        visible={isBecomingArtistModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsBecomingArtistModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Tornar-se Artista</Text>
                <Text style={styles.modalSubtitle}>
                  Essas informações ajudam clientes a conhecer seu trabalho e contratar seus serviços
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsBecomingArtistModalVisible(false)}
              >
                <X size={19} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Nome do Artista / Banda</Text>
                <TextInput
                  value={artistNameInput}
                  onChangeText={setArtistNameInput}
                  placeholder="Ex: João Cantor / Banda Sol"
                  placeholderTextColor={theme.textSecondary}
                  style={styles.formInput}
                  autoFocus
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Sobre você / sua banda</Text>
                <TextInput
                  value={artistBioInput}
                  onChangeText={setArtistBioInput}
                  placeholder="Experiência, repertório, estilos e tipos de evento..."
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.formInput, { minHeight: 82, textAlignVertical: "top", paddingTop: 12 }]}
                  multiline
                  maxLength={1000}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Anos de experiência</Text>
                <TextInput value={artistYearsInput} onChangeText={setArtistYearsInput} keyboardType="number-pad" placeholder="Ex.: 5" placeholderTextColor={theme.textSecondary} style={styles.formInput} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Preço inicial (R$)</Text>
                <TextInput value={artistPriceMinInput} onChangeText={setArtistPriceMinInput} keyboardType="decimal-pad" placeholder="Ex.: 500,00" placeholderTextColor={theme.textSecondary} style={styles.formInput} />
                <Text style={[styles.inputLabel, { marginTop: 8 }]}>Preço máximo (opcional)</Text>
                <TextInput value={artistPriceMaxInput} onChangeText={setArtistPriceMaxInput} keyboardType="decimal-pad" placeholder="Ex.: 1500,00" placeholderTextColor={theme.textSecondary} style={styles.formInput} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Modalidade de atendimento</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {[{label:"Presencial", value:"presencial"}, {label:"Remoto", value:"remoto"}, {label:"Ambos", value:"ambos"}].map((option) => (
                    <TouchableOpacity key={option.value} onPress={() => setArtistModeInput(option.value)} style={{ borderWidth: 1, borderColor: artistModeInput === option.value ? theme.accent : theme.borderColor, backgroundColor: artistModeInput === option.value ? theme.accent + "22" : "transparent", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
                      <Text style={{ color: theme.textPrimary, fontWeight: artistModeInput === option.value ? "700" : "500" }}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Categoria de Atuação</Text>
                <TouchableOpacity
                  style={[styles.formInput, { justifyContent: "center" }]}
                  onPress={() => setIsArtistCategoryModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <View style={styles.selectBoxRow}>
                    <Music size={14} color={theme.accent} style={{ marginRight: 6 }} />
                    <Text style={[styles.profileCategorySelectText, { flex: 1 }]}>
                      {selectedArtistCategory}
                    </Text>
                    <ChevronDown size={16} color={theme.textSecondary} />
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsBecomingArtistModalVisible(false)}
                disabled={isSubmittingArtist}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAddButton, isSubmittingArtist && styles.modalAddButtonDisabled]}
                onPress={handleConfirmBecomeArtist}
                disabled={isSubmittingArtist}
              >
                {isSubmittingArtist ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalAddText}>Confirmar Cadastro</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Submodal para Selecionar a Categoria no Cadastro de Artista */}
      <Modal
        visible={isArtistCategoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsArtistCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Selecionar Categoria</Text>
                <Text style={styles.modalSubtitle}>
                  Escolha uma das opções predefinidas
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsArtistCategoryModalVisible(false)}
              >
                <X size={19} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                {FIXED_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.cityListItem,
                      selectedArtistCategory === cat && {
                        backgroundColor: theme.mainBg,
                        borderColor: theme.accent,
                        borderWidth: 1,
                        borderRadius: 6,
                      },
                    ]}
                    onPress={() => {
                      setSelectedArtistCategory(cat);
                      setIsArtistCategoryModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.cityItemText,
                        selectedArtistCategory === cat && {
                          fontWeight: "700",
                          color: theme.accent,
                        },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsArtistCategoryModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Demais Modais (Categoria do perfil, Cidade, Links, Visualizador, Portfólio, Vídeo) */}
      <Modal
        visible={isCategoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Selecionar Categoria</Text>
                <Text style={styles.modalSubtitle}>
                  Escolha uma das opções predefinidas
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsCategoryModalVisible(false)}
              >
                <X size={19} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <ScrollView
                style={{ maxHeight: 250 }}
                showsVerticalScrollIndicator={false}
              >
                {FIXED_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.cityListItem,
                      editedProfileCategory === cat && {
                        backgroundColor: theme.mainBg,
                        borderColor: theme.accent,
                        borderWidth: 1,
                        borderRadius: 6,
                      },
                    ]}
                    onPress={() => {
                      setEditedProfileCategory(cat);
                      setIsCategoryModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.cityItemText,
                        editedProfileCategory === cat && {
                          fontWeight: "700",
                          color: theme.accent,
                        },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsCategoryModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isCityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Buscar Cidade ou Interior</Text>
                <Text style={styles.modalSubtitle}>
                  Digite qualquer município do Brasil (Ex: Caruaru)
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsCityModalVisible(false)}
              >
                <X size={19} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.formGroup}>
                <TextInput
                  value={citySearchQuery}
                  onChangeText={setCitySearchQuery}
                  placeholder="Ex: Caruaru, Campina Grande..."
                  placeholderTextColor={theme.textSecondary}
                  style={styles.formInput}
                  autoFocus
                />
              </View>

              {isLoadingCities ? (
                <View style={{ paddingVertical: 30, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={theme.accent} />
                  <Text
                    style={{
                      color: theme.textSecondary,
                      fontSize: 11,
                      marginTop: 8,
                    }}
                  >
                    Carregando municípios do Brasil...
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={{ maxHeight: 220 }}
                  showsVerticalScrollIndicator={false}
                >
                  {filteredCities.length === 0 ? (
                    <Text style={styles.noLinksText}>
                      Nenhuma cidade encontrada.
                    </Text>
                  ) : (
                    filteredCities.map((cityName) => (
                      <TouchableOpacity
                        key={cityName}
                        style={styles.cityListItem}
                        onPress={() => {
                          setEditedLocation(cityName);
                          setIsCityModalVisible(false);
                        }}
                      >
                        <Text style={styles.cityItemText}>{cityName}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsCityModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isLinkModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLinkModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Adicionar Link Seguro</Text>
                <Text style={styles.modalSubtitle}>
                  Informe o nome e a URL começando com https://
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsLinkModalVisible(false)}
              >
                <X size={19} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Nome do Link</Text>
                <TextInput
                  value={newLinkName}
                  onChangeText={setNewLinkName}
                  placeholder="Ex.: Instagram, Spotify"
                  placeholderTextColor={theme.textSecondary}
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  URL / Link (Obrigatório https://)
                </Text>
                <TextInput
                  value={newLinkUrl}
                  onChangeText={handleUrlChange}
                  placeholder="Ex.: https://instagram.com/seuperfil"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.formInput,
                    urlError ? { borderColor: "#E05A10" } : null,
                  ]}
                  autoCapitalize="none"
                />
                {urlError ? (
                  <Text style={styles.errorText}>{urlError}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsLinkModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalAddButton,
                  (!newLinkName.trim() || !newLinkUrl.trim() || !!urlError) &&
                    styles.modalAddButtonDisabled,
                ]}
                onPress={handleAddCustomLinkFromModal}
                disabled={
                  !newLinkName.trim() || !newLinkUrl.trim() || !!urlError
                }
              >
                <Text style={styles.modalAddText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={closeViewer}
      >
        <View style={styles.viewerOverlay}>
          <TouchableOpacity
            style={styles.viewerCloseButton}
            onPress={closeViewer}
            activeOpacity={0.7}
          >
            <X size={26} color="#FFFFFF" />
          </TouchableOpacity>
          {viewerMediaUri && viewerMediaType === "video" ? (
            <Video
              source={{ uri: viewerMediaUri }}
              style={styles.viewerImage}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
          ) : viewerMediaUri ? (
            <Image
              source={{ uri: viewerMediaUri }}
              style={styles.viewerImage}
            />
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={portfolioModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePortfolioModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Adicionar ao portfólio</Text>
                <Text style={styles.modalSubtitle}>
                  Mostre um novo trabalho ou apresentação
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closePortfolioModal}
              >
                <X size={19} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Nome</Text>
                <TextInput
                  value={portfolioName}
                  onChangeText={setPortfolioName}
                  placeholder="Ex.: Apresentação acústica"
                  placeholderTextColor={theme.textSecondary}
                  style={styles.formInput}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Descrição</Text>
                <TextInput
                  value={portfolioDescription}
                  onChangeText={setPortfolioDescription}
                  placeholder="Descreva seu trabalho..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  textAlignVertical="top"
                  style={[styles.formInput, styles.descriptionInput]}
                  maxLength={300}
                />
                <Text style={styles.descriptionCounter}>
                  {portfolioDescription.length}/300
                </Text>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  Arquivo (Imagens e Vídeos)
                </Text>
                <TouchableOpacity
                  style={[
                    styles.uploadButton,
                    portfolioFile && styles.uploadButtonSelected,
                  ]}
                  onPress={handlePickFile}
                >
                  <View style={styles.uploadIconContainer}>
                    <Upload size={18} color={theme.accent} />
                  </View>
                  <View style={styles.uploadTextContainer}>
                    <Text style={styles.uploadTitle}>
                      {portfolioFile
                        ? "Arquivo selecionado"
                        : "Subir arquivo ou mídia"}
                    </Text>
                    <Text style={styles.uploadSubtitle}>
                      {portfolioFile
                        ? portfolioFile.name
                        : "Clique para selecionar um arquivo"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closePortfolioModal}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalAddButton,
                  (!portfolioName.trim() || !portfolioDescription.trim()) &&
                    styles.modalAddButtonDisabled,
                ]}
                onPress={handleAddPortfolio}
                disabled={!portfolioName.trim() || !portfolioDescription.trim()}
              >
                <Text style={styles.modalAddText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={videoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeVideoModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Adicionar vídeo</Text>
                <Text style={styles.modalSubtitle}>
                  Compartilhe uma nova apresentação
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeVideoModal}
              >
                <X size={19} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: 500 }}
              contentContainerStyle={styles.modalContent}
            >
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Nome</Text>
                <TextInput
                  value={videoTitle}
                  onChangeText={setVideoTitle}
                  placeholder="Ex.: Apresentação acústica"
                  placeholderTextColor={theme.textSecondary}
                  style={styles.formInput}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Descrição</Text>
                <TextInput
                  value={videoSubtitle}
                  onChangeText={setVideoSubtitle}
                  placeholder="Ex.: Violão e voz"
                  placeholderTextColor={theme.textSecondary}
                  style={styles.formInput}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Capa do Vídeo (Opcional)</Text>
                <TouchableOpacity
                  style={[
                    styles.uploadButton,
                    videoCover && styles.uploadButtonSelected,
                  ]}
                  onPress={handlePickVideoCover}
                >
                  <View style={styles.uploadIconContainer}>
                    <ImageIcon size={18} color={theme.accent} />
                  </View>
                  <View style={styles.uploadTextContainer}>
                    <Text style={styles.uploadTitle}>
                      {videoCover ? "Capa selecionada" : "Subir imagem de capa"}
                    </Text>
                    <Text style={styles.uploadSubtitle}>
                      {videoCover
                        ? videoCover.name
                        : "Escolha uma miniatura para o vídeo"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Arquivo de Vídeo</Text>
                <TouchableOpacity
                  style={[
                    styles.uploadButton,
                    videoFile && styles.uploadButtonSelected,
                  ]}
                  onPress={handlePickVideo}
                >
                  <View style={styles.uploadIconContainer}>
                    <Upload size={18} color={theme.accent} />
                  </View>
                  <View style={styles.uploadTextContainer}>
                    <Text style={styles.uploadTitle}>
                      {videoFile ? "Vídeo selecionado" : "Subir vídeo"}
                    </Text>
                    <Text style={styles.uploadSubtitle}>
                      {videoFile
                        ? videoFile.name
                        : "Clique para selecionar o vídeo"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeVideoModal}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalAddButton,
                  (!videoTitle.trim() || !videoSubtitle.trim() || !videoFile) &&
                    styles.modalAddButtonDisabled,
                ]}
                onPress={handleAddVideo}
                disabled={
                  !videoTitle.trim() || !videoSubtitle.trim() || !videoFile
                }
              >
                <Text style={styles.modalAddText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ theme, number, label, icon }: any) {
  const styles = getStyles(theme);
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>{icon}</View>
      <View>
        <Text style={styles.statNumber}>{number}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.mainBg,
      ...Platform.select({
        web: { height: "100vh", overflow: "hidden" },
        default: {},
      }),
    },
    dashboardContainer: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: theme.mainBg,
      ...Platform.select({
        web: { height: "100vh", overflow: "hidden" },
        default: {},
      }),
    },
    mainContent: {
      flex: 1,
      backgroundColor: theme.mainBg,
      ...Platform.select({
        web: {
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
        default: {},
      }),
    },
    scrollView: {
      flex: 1,
      ...Platform.select({
        web: { scrollbarWidth: "none", msOverflowStyle: "none" },
        default: {},
      }),
    },
    scrollContentContainer: { flexGrow: 1 },
    contentWrapper: {
      paddingHorizontal: 32,
      paddingTop: 20,
      paddingBottom: 40,
    },
    profileHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },
    profileHeaderEditing: {
      borderWidth: 1,
      borderColor: theme.accent,
      borderRadius: 12,
      padding: 16,
      marginTop: -13,
      marginBottom: 5,
      backgroundColor: theme.cardBg,
    },
    profileHeaderLeft: {
      flexDirection: "row",
      alignItems: "flex-start",
      flex: 1,
    },
    profileData: { flex: 1 },
    profileAvatar: {
      width: 66,
      height: 66,
      borderRadius: 33,
      backgroundColor: "#D9B59F",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
      overflow: "hidden",
      position: "relative",
    },
    profileAvatarEditingMode: {
      borderWidth: 2,
      borderColor: theme.accent,
      borderStyle: "dashed",
    },
    avatarImage: {
      width: "100%",
      height: "100%",
      borderRadius: 33,
      resizeMode: "cover",
    },
    avatarEditOverlay: {
      position: "absolute",
      backgroundColor: "rgba(0, 0, 0, 0.4)",
      width: "100%",
      height: "100%",
      borderRadius: 33,
      justifyContent: "center",
      alignItems: "center",
    },
    profileAvatarText: { color: "#FFFFFF", fontSize: 27, fontWeight: "700" },
    profileName: { color: theme.textPrimary, fontSize: 24, fontWeight: "700" },
    editFormColumn: { width: "100%", gap: 10 },
    editInputBox: {
      backgroundColor: theme.mainBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    editFieldLabel: {
      color: theme.textSecondary,
      fontSize: 9,
      fontWeight: "700",
      marginBottom: 3,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    profileNameInputStyled: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: "700",
      padding: 0,
      margin: 0,
      ...Platform.select({ web: { outlineStyle: "none" }, default: {} }),
    },
    bioInputStyled: {
      minHeight: 90,
      color: theme.textPrimary,
      fontSize: 12,
      lineHeight: 18,
      padding: 0,
      margin: 0,
      ...Platform.select({ web: { outlineStyle: "none" }, default: {} }),
    },
    selectBoxRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 2,
    },
    profileCategorySelectText: {
      color: theme.textPrimary,
      fontSize: 12,
      fontWeight: "600",
    },
    locationRow: { flexDirection: "row", alignItems: "center", marginTop: 5 },
    locationIcon: { color: theme.textSecondary, fontSize: 15, marginRight: 4 },
    locationText: { color: theme.textSecondary, fontSize: 12 },
    profileCategory: { color: theme.textSecondary, fontSize: 12, marginTop: 4 },
    editButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.accent,
      paddingVertical: 10,
      paddingHorizontal: 17,
      borderRadius: 7,
    },
    editIcon: { color: "#FFFFFF", fontSize: 16, marginRight: 7 },
    editButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
    bioCard: {
      backgroundColor: theme.cardBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderColor,
      padding: 18,
      marginBottom: 14,
    },
    bioCardEditing: {
      borderColor: theme.accent,
      backgroundColor: theme.cardBg,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    bioHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: { color: theme.textPrimary, fontSize: 17, fontWeight: "700" },
    sectionSubtitle: { color: theme.textSecondary, fontSize: 11, marginTop: 3 },
    bioText: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 19,
      marginTop: 10,
      maxWidth: 800,
    },
    bioEditingContainer: { marginTop: 12 },
    editingIndicator: { flexDirection: "row", alignItems: "center" },
    editingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.accent,
      marginRight: 6,
    },
    editingIndicatorText: {
      color: theme.accent,
      fontSize: 10,
      fontWeight: "600",
    },
    bioFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      marginTop: 4,
    },
    characterCount: { color: theme.textSecondary, fontSize: 9 },
    linkEditTitle: {
      color: theme.textPrimary,
      fontSize: 12,
      fontWeight: "700",
    },
    linkEditGroup: { gap: 6, marginTop: 6 },
    noLinksText: {
      color: theme.textSecondary,
      fontSize: 11,
      fontStyle: "italic",
      marginTop: 4,
    },
    customLinksHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 14,
      marginBottom: 4,
    },
    addCustomLinkBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.accent,
      paddingVertical: 5,
      paddingHorizontal: 9,
      borderRadius: 6,
    },
    addCustomLinkText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "700",
      marginLeft: 4,
    },
    customLinkRowItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.mainBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    linkItemLabel: {
      color: theme.textPrimary,
      fontSize: 12,
      fontWeight: "700",
    },
    linkItemUrl: { color: theme.textSecondary, fontSize: 10, marginTop: 2 },
    removeCustomBtn: { padding: 4 },
    errorText: {
      color: "#E05A10",
      fontSize: 10,
      marginTop: 4,
      fontWeight: "600",
    },
    cityListItem: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    cityItemText: { color: theme.textPrimary, fontSize: 12 },
    profileEditActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      marginBottom: 22,
    },
    cancelProfileButton: {
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderRadius: 6,
      marginRight: 7,
    },
    cancelBioText: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: "600",
    },
    saveBioButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.accent,
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 6,
    },
    saveBioText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "700",
      marginLeft: 5,
    },
    socialRow: {
      flexDirection: "row",
      marginTop: 15,
      flexWrap: "wrap",
      gap: 10,
    },
    socialButton: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 6,
      paddingVertical: 6,
      paddingHorizontal: 9,
    },
    socialText: { color: theme.textSecondary, fontSize: 10 },
    statsRow: { flexDirection: "row", marginBottom: 22 },
    statCard: {
      flex: 1,
      minHeight: 70,
      backgroundColor: theme.cardBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.borderColor,
      padding: 13,
      flexDirection: "row",
      alignItems: "center",
      marginRight: 12,
    },
    statIcon: {
      width: 35,
      height: 35,
      borderRadius: 8,
      backgroundColor: theme.mainBg,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    starIcon: { color: "#FFB800", fontSize: 19 },
    statNumber: { color: theme.textPrimary, fontSize: 18, fontWeight: "700" },
    statLabel: { color: theme.textSecondary, fontSize: 10, marginTop: 2 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
      marginTop: 5,
    },
    portfolioActions: { flexDirection: "row", alignItems: "center" },
    addPortfolioButton: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 6,
      paddingVertical: 7,
      paddingHorizontal: 10,
      marginRight: 8,
    },
    addIcon: {
      color: theme.accent,
      fontSize: 18,
      marginRight: 5,
      lineHeight: 16,
    },
    addPortfolioText: { color: theme.accent, fontSize: 10, fontWeight: "700" },
    addVideoButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.accent,
      borderRadius: 6,
      paddingVertical: 8,
      paddingHorizontal: 11,
    },
    addVideoIcon: {
      color: "#FFFFFF",
      fontSize: 17,
      marginRight: 5,
      lineHeight: 15,
    },
    addVideoText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
    emptyPortfolioCard: {
      backgroundColor: theme.cardBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderColor,
      padding: 24,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 22,
    },
    emptyPortfolioText: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 4,
    },
    emptyPortfolioSubText: {
      color: theme.textSecondary,
      fontSize: 11,
      marginTop: 2,
    },
    portfolioCard: {
      backgroundColor: theme.cardBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderColor,
      overflow: "hidden",
      flexDirection: "row",
      marginBottom: 22,
      position: "relative",
    },
    portfolioCardFeatured: { borderColor: theme.accent, borderWidth: 1.5 },
    featuredBadge: {
      position: "absolute",
      top: 8,
      left: 8,
      zIndex: 5,
      backgroundColor: theme.accent,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    featuredBadgeVideo: {
      position: "absolute",
      top: 8,
      left: 8,
      zIndex: 5,
      backgroundColor: theme.accent,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
    },
    featuredBadgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "700" },
    portfolioCardActions: {
      position: "absolute",
      top: 10,
      right: 10,
      zIndex: 5,
      flexDirection: "row",
      gap: 4,
    },
    cardActionBtn: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: theme.mainBg,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    cardActionBtnActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    cardActionDelete: { backgroundColor: theme.mainBg },
    portfolioPreview: {
      width: 190,
      height: 130,
      backgroundColor: "#FDE4D9",
      justifyContent: "center",
      alignItems: "center",
    },
    fullCoverImage: { width: "100%", height: "100%", resizeMode: "cover" },
    portfolioPreviewTitle: {
      color: "#493027",
      fontSize: 14,
      fontWeight: "700",
      marginTop: 8,
    },
    portfolioPreviewText: { color: "#8A6D5D", fontSize: 10, marginTop: 3 },
    portfolioInfo: { flex: 1, padding: 18, paddingTop: 26 },
    portfolioTitle: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    portfolioDescription: {
      color: theme.textSecondary,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 7,
      maxWidth: 480,
    },
    portfolioFileName: { color: theme.accent, fontSize: 9, marginTop: 8 },
    videoGrid: {
      flexDirection: "row",
      marginBottom: 22,
      flexWrap: "wrap",
      gap: 12,
    },
    videoCard: {
      flex: 1,
      minWidth: 200,
      backgroundColor: theme.cardBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.borderColor,
      overflow: "hidden",
      position: "relative",
    },
    videoCardFeatured: { borderColor: theme.accent, borderWidth: 1.5 },
    videoCardActions: {
      position: "absolute",
      top: 8,
      right: 8,
      zIndex: 5,
      flexDirection: "row",
      gap: 3,
    },
    videoThumbnail: {
      height: 130,
      backgroundColor: "#33231D",
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    videoIconCircle: {
      width: 55,
      height: 55,
      borderRadius: 28,
      backgroundColor: "#5A392B",
      justifyContent: "center",
      alignItems: "center",
    },
    playButton: {
      position: "absolute",
      right: 10,
      bottom: 10,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    playText: { color: "#FFFFFF", fontSize: 12, marginLeft: 2 },
    videoInfo: { padding: 11 },
    videoTitle: { color: theme.textPrimary, fontSize: 11, fontWeight: "700" },
    videoSubtitle: { color: theme.textSecondary, fontSize: 9, marginTop: 3 },
    notArtistCard: {
      backgroundColor: theme.cardBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderColor,
      padding: 30,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 10,
    },
    notArtistTitle: { color: theme.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 6 },
    notArtistSubtitle: { color: theme.textSecondary, fontSize: 12, textAlign: "center", maxWidth: 450, lineHeight: 18, marginBottom: 20 },
    becomeArtistButton: { backgroundColor: theme.accent, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    becomeArtistButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.55)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    modalContainer: {
      width: "100%",
      maxWidth: 520,
      maxHeight: "90%",
      backgroundColor: theme.cardBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.borderColor,
      overflow: "hidden",
      ...Platform.select({ web: { maxHeight: "90vh" }, default: {} }),
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    modalTitle: { color: theme.textPrimary, fontSize: 17, fontWeight: "700" },
    modalSubtitle: { color: theme.textSecondary, fontSize: 10, marginTop: 4 },
    modalCloseButton: {
      width: 30,
      height: 30,
      borderRadius: 7,
      backgroundColor: theme.mainBg,
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: { padding: 20 },
    formGroup: { marginBottom: 16 },
    inputLabel: {
      color: theme.textPrimary,
      fontSize: 11,
      fontWeight: "700",
      marginBottom: 7,
    },
    formInput: {
      width: "100%",
      height: 42,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 7,
      backgroundColor: theme.mainBg,
      color: theme.textPrimary,
      fontSize: 11,
      paddingHorizontal: 12,
      ...Platform.select({ web: { outlineStyle: "none" }, default: {} }),
    },
    descriptionInput: { height: 95, paddingTop: 10, paddingBottom: 10 },
    descriptionCounter: {
      color: theme.textSecondary,
      fontSize: 8,
      textAlign: "right",
      marginTop: 4,
    },
    uploadButton: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      minHeight: 64,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.borderColor,
      borderRadius: 8,
      backgroundColor: theme.mainBg,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    uploadButtonSelected: { borderColor: theme.accent },
    uploadIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: theme.cardBg,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    uploadTextContainer: { flex: 1 },
    uploadTitle: { color: theme.textPrimary, fontSize: 11, fontWeight: "700" },
    uploadSubtitle: { color: theme.textSecondary, fontSize: 9, marginTop: 3 },
    modalFooter: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: theme.borderColor,
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    modalCancelButton: {
      paddingVertical: 9,
      paddingHorizontal: 13,
      borderRadius: 6,
      marginRight: 8,
    },
    modalCancelText: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: "600",
    },
    modalAddButton: {
      backgroundColor: theme.accent,
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: 6,
    },
    modalAddButtonDisabled: { opacity: 0.45 },
    modalAddText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
    viewerOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.95)",
      justifyContent: "center",
      alignItems: "center",
    },
    viewerCloseButton: {
      position: "absolute",
      top: 40,
      right: 30,
      zIndex: 10,
      padding: 10,
      backgroundColor: "rgba(255, 255, 255, 0.15)",
      borderRadius: 25,
    },
    viewerImage: { width: "90%", height: "85%", resizeMode: "contain" },
  });