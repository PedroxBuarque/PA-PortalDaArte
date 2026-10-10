import React, { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
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
import { useProfile } from "../../../components/context/ProfileContext";
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
  const { profileImage, saveProfileImage } = useProfile();
  const styles = getStyles(theme);

  const [loadingBackend, setLoadingBackend] = useState(true);
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
  const [editedProfileImage, setEditedProfileImage] = useState<string | null>(null);

  const [profileName, setProfileName] = useState("Artista");
  const [editedProfileName, setEditedProfileName] = useState("");

  const [location, setLocation] = useState("Caruaru, PE");
  const [editedLocation, setEditedLocation] = useState("Caruaru, PE");

  const [isCityModalVisible, setIsCityModalVisible] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [citiesList, setCitiesList] = useState<string[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  const [profileCategory, setProfileCategory] = useState(FIXED_CATEGORIES[0]);
  const [editedProfileCategory, setEditedProfileCategory] = useState(FIXED_CATEGORIES[0]);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);

  const [bio, setBio] = useState("Conte um pouco sobre sua trajetória artística...");
  const [editedBio, setEditedBio] = useState("");

  const [customLinks, setCustomLinks] = useState<CustomLink[]>([
    { id: "1", label: "Spotify", url: "https://spotify.com" },
    { id: "2", label: "Instagram", url: "https://instagram.com" },
  ]);
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
          const nomeCompleto = dados.nome_completo || dados.email || "Artista";
          const cidadeEstado = dados.cidade && dados.estado ? `${dados.cidade}, ${dados.estado}` : "Caruaru, PE";
          const biografiaApi = dados.biografia || "Conte um pouco sobre sua trajetória artística e musical...";
          const catApi = dados.nome_artistico ? `Artista • ${dados.nome_artistico}` : FIXED_CATEGORIES[0];

          setProfileName(nomeCompleto);
          setLocation(cidadeEstado);
          setBio(biografiaApi);
          setProfileCategory(catApi);

          if (dados.foto_perfil) {
            saveProfileImage(dados.foto_perfil);
          }

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

  const handleStartEditingProfile = () => {
    setEditedProfileImage(profileImage);
    setEditedProfileName(profileName);
    setEditedLocation(location);
    setEditedProfileCategory(profileCategory);
    setEditedBio(bio);
    setEditedCustomLinks(JSON.parse(JSON.stringify(customLinks)));
    setIsEditingProfile(true);
  };

  const handleCancelEditingProfile = () => {
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    if (
      !editedProfileName.trim() ||
      !editedLocation.trim() ||
      !editedProfileCategory.trim() ||
      !editedBio.trim()
    ) {
      return;
    }

    try {
      const token = await AsyncStorage.getItem("access_token");

      const partesCidade = editedLocation.split(",");
      const cidadeNome = partesCidade[0]?.trim() || editedLocation;
      const estadoSigla = partesCidade[1]?.trim() || "PE";

      if (token) {
        await fetch(`${URL_API}/api/perfis/me`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nome_completo: editedProfileName.trim(),
            cidade: cidadeNome,
            estado: estadoSigla,
            biografia: editedBio.trim(),
            foto_perfil: editedProfileImage, // Envia a foto em Base64 para salvar no banco
            tipo_documento: "cpf",
          }),
        });
      }

      setProfileName(editedProfileName.trim());
      setLocation(editedLocation.trim());
      setProfileCategory(editedProfileCategory.trim());
      setBio(editedBio.trim());
      if (editedProfileImage) {
        saveProfileImage(editedProfileImage);
      }
      setCustomLinks([...editedCustomLinks]);
      setIsEditingProfile(false);
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

  // Seletor robusto com expo-image-picker que converte e exibe a imagem instantaneamente
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

  const handleAddPortfolio = () => {
    if (!portfolioName.trim() || !portfolioDescription.trim()) return;
    const newPortfolio: PortfolioItem = {
      id: Date.now().toString(),
      name: portfolioName.trim(),
      description: portfolioDescription.trim(),
      file: portfolioFile,
      isFeatured: false,
    };
    setPortfolioItems((current) => [...current, newPortfolio]);
    closePortfolioModal();
  };

  const handleDeletePortfolioItem = (id: string) => {
    setPortfolioItems((current) => current.filter((item) => item.id !== id));
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
                                Nome do Artista
                              </Text>
                              <TextInput
                                value={editedProfileName}
                                onChangeText={setEditedProfileName}
                                style={styles.profileNameInputStyled}
                                placeholder="Seu nome"
                                placeholderTextColor={theme.textSecondary}
                              />
                            </View>

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

                  <View style={styles.statsRow}>
                    <StatCard
                      theme={theme}
                      number={estatisticas.avaliacao_media}
                      label="Avaliação média"
                      icon={<Text style={styles.starIcon}>★</Text>}
                    />
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

                  {portfolioItems.map((item, index) => {
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
                  })}

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
              )}
            </View>
          </ScrollView>
        </View>
      </View>

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