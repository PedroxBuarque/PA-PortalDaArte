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
import AsyncStorage from "@react-native-async-storage/async-storage";

import Header from "../../../components/Header";
import Sidebar from "../../../components/Sidebar";
import { useProfile } from "../../../components/context/ProfileContext";
import { useTheme } from "../../../components/context/ThemeContext";

type PortfolioItem = {
  id: string;
  name: string;
  description: string;
  file: any;
  cover?: any;
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
  const { profileImage, updateProfile } = useProfile();
  const styles = getStyles(theme);

  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Estados principais do perfil
  const [profileName, setProfileName] = useState("Usuário");
  const [editedProfileName, setEditedProfileName] = useState("Usuário");
  const [location, setLocation] = useState("Brasil");
  const [editedLocation, setEditedLocation] = useState("Brasil");
  const [profileCategory, setProfileCategory] = useState("Outros • Artista Independente");
  const [editedProfileCategory, setEditedProfileCategory] = useState("Outros • Artista Independente");
  const [bio, setBio] = useState("Criador gerenciando sua carreira pelo Portal da Arte.");
  const [editedBio, setEditedBio] = useState("Criador gerenciando sua carreira pelo Portal da Arte.");

  // Controle de Artista e Estatísticas (Corrigido para iniciar zerado caso não haja dados)
  const [isArtist, setIsArtist] = useState(false);
  const [stats, setStats] = useState({
    avaliacaoMedia: "0.0",
    contratacoes: 0,
    favoritos: 0,
  });

  // Modais
  const [isArtistModalVisible, setIsArtistModalVisible] = useState(false);
  const [artistName, setArtistName] = useState("");
  const [artistBio, setArtistBio] = useState("");
  const [artistExperience, setArtistExperience] = useState("");
  const [artistModalidade, setArtistModalidade] = useState("ambos");

  /* ===================================================== */
  /* CARREGAR DADOS DO BANCO DE DADOS VIA API (/api/perfis/me) */
  /* ===================================================== */
  useEffect(() => {
    async function loadUserDataFromDatabase() {
      try {
        setIsLoadingUser(true);
        const token = await AsyncStorage.getItem("access_token");
        if (!token) {
          setIsLoadingUser(false);
          return;
        }

        const response = await fetch("http://127.0.0.1:8000/api/perfis/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const result = await response.json();
        if (response.ok && result.dados) {
          const dados = result.dados;

          const nomeFinal = dados.nome_completo || (dados.email ? dados.email.split("@")[0] : "Usuário");
          const nomeFormatado = nomeFinal.charAt(0).toUpperCase() + nomeFinal.slice(1);
          setProfileName(nomeFormatado);
          setEditedProfileName(nomeFormatado);

          if (dados.cidade && dados.estado) {
            const loc = `${dados.cidade}, ${dados.estado}`;
            setLocation(loc);
            setEditedLocation(loc);
          } else if (dados.cidade) {
            setLocation(dados.cidade);
            setEditedLocation(dados.cidade);
          }

          if (dados.biografia) {
            setBio(dados.biografia);
            setEditedBio(dados.biografia);
          }

          if (dados.nome_artistico) {
            setProfileCategory(dados.nome_artistico);
            setEditedProfileCategory(dados.nome_artistico);
          }

          if (dados.is_artista) {
            setIsArtist(true);
          } else {
            setIsArtist(false);
          }

          if (dados.estatisticas) {
            setStats({
              avaliacaoMedia: dados.estatisticas.avaliacao_media ? String(dados.estatisticas.avaliacao_media) : "0.0",
              contratacoes: dados.estatisticas.total_contratacoes || 0,
              favoritos: dados.estatisticas.total_favoritos || 0,
            });
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados do perfil do banco:", err);
      } finally {
        setIsLoadingUser(false);
      }
    }
    loadUserDataFromDatabase();
  }, []);

  /* ===================================================== */
  /* ESTADOS DO VISUALIZADOR DE MÍDIA (FULLSCREEN) */
  /* ===================================================== */
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [viewerMediaUri, setViewerMediaUri] = useState<string | null>(null);
  const [viewerMediaType, setViewerMediaType] = useState<"image" | "video" | null>(null);

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

  /* ===================================================== */
  /* EDITAR PERFIL E UPLOADS DE PORTFÓLIO E VÍDEOS */
  /* ===================================================== */
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfileImage, setEditedProfileImage] = useState<string | null>(null);

  const [isCityModalVisible, setIsCityModalVisible] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [citiesList, setCitiesList] = useState<string[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  // Portfólio State com suporte a arquivo e capa
  const [portfolioModalVisible, setPortfolioModalVisible] = useState(false);
  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [portfolioFile, setPortfolioFile] = useState<any>(null);
  const [portfolioCover, setPortfolioCover] = useState<any>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);

  // Vídeos State com suporte a arquivo e capa opcional
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoSubtitle, setVideoSubtitle] = useState("");
  const [videoFile, setVideoFile] = useState<any>(null);
  const [videoCover, setVideoCover] = useState<any>(null);
  const [videoItems, setVideoItems] = useState<VideoItem[]>([]);

  useEffect(() => {
    async function fetchAllIbgeCities() {
      try {
        setIsLoadingCities(true);
        const response = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios");
        const data = await response.json();
        const formattedCities = data.map((item: any) => `${item.nome}, ${item.microrregiao?.mesorregiao?.UF?.sigla || "BR"}`);
        formattedCities.sort((a: string, b: string) => a.localeCompare(b));
        setCitiesList(formattedCities);
      } catch (error) {
        console.error("Erro ao carregar municípios:", error);
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
    setIsEditingProfile(true);
  };

  const handleCancelEditingProfile = () => setIsEditingProfile(false);

  const handleSaveProfile = async () => {
    if (!editedProfileName.trim() || !editedLocation.trim()) {
      Alert.alert("Atenção", "O campo nome e a localidade não podem estar vazios.");
      return;
    }
    try {
      const token = await AsyncStorage.getItem("access_token");
      const [cidadePart, estadoPart] = editedLocation.split(",").map((s) => s.trim());

      const response = await fetch("http://127.0.0.1:8000/api/perfis/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome_completo: editedProfileName,
          cidade: cidadePart || editedLocation,
          estado: estadoPart || "",
          tipo_documento: "cpf",
        }),
      });

      if (!response.ok) throw new Error("Erro ao atualizar perfil.");

      const nextProfile = {
        profileImage: editedProfileImage,
        profileName: editedProfileName.trim(),
        location: editedLocation.trim(),
        profileCategory: editedProfileCategory.trim(),
        bio: editedBio.trim(),
      };

      updateProfile(nextProfile);
      setProfileName(editedProfileName);
      setLocation(editedLocation);
      setProfileCategory(editedProfileCategory);
      setBio(editedBio);
      setIsEditingProfile(false);
      Alert.alert("Sucesso", "Perfil atualizado com sucesso!");
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível salvar as alterações.");
    }
  };

  const handleRegisterAsArtist = async () => {
    if (!artistName.trim()) {
      Alert.alert("Atenção", "O campo nome artístico não pode estar vazio.");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("access_token");
      const response = await fetch("http://127.0.0.1:8000/api/artistas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome_artistico: artistName.trim(),
          biografia: artistBio.trim(),
          anos_experiencia: artistExperience ? parseInt(artistExperience) : null,
          modalidade_atendimento: artistModalidade,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Erro ao cadastrar perfil de artista.");

      Alert.alert("Sucesso", "Parabéns! Agora você é um artista cadastrado.");
      setIsArtistModalVisible(false);
      setIsArtist(true);
      setProfileCategory(artistName.trim());
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Falha ao registrar.");
    }
  };

  const handlePickProfileImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setEditedProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Erro ao selecionar imagem:", error);
    }
  };

  const handlePickPortfolioFile = async () => {
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

  const handlePickPortfolioCover = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets?.length > 0)
        setPortfolioCover(result.assets[0]);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddPortfolio = async () => {
    if (!portfolioName.trim()) {
      Alert.alert("Atenção", "O campo título não pode estar vazio.");
      return;
    }
    if (!portfolioDescription.trim()) {
      Alert.alert("Atenção", "O campo descrição não pode estar vazio.");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("access_token");
      const response = await fetch("http://127.0.0.1:8000/api/artistas/servicos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          titulo: portfolioName.trim(),
          descricao: portfolioDescription.trim(),
          modalidade: "ambos",
        }),
      });

      if (!response.ok) throw new Error("Erro ao salvar serviço.");

      const newItem: PortfolioItem = {
        id: Date.now().toString(),
        name: portfolioName.trim(),
        description: portfolioDescription.trim(),
        file: portfolioFile,
        cover: portfolioCover,
        isFeatured: false,
      };

      setPortfolioItems((current) => [...current, newItem]);
      setPortfolioModalVisible(false);
      setPortfolioName("");
      setPortfolioDescription("");
      setPortfolioFile(null);
      setPortfolioCover(null);
      Alert.alert("Sucesso", "Portfólio adicionado!");
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    }
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
    if (!videoTitle.trim()) {
      Alert.alert("Atenção", "O campo título do vídeo não pode estar vazio.");
      return;
    }
    if (!videoSubtitle.trim()) {
      Alert.alert("Atenção", "O campo subtítulo do vídeo não pode estar vazio.");
      return;
    }
    if (!videoFile) {
      Alert.alert("Atenção", "Você deve selecionar um arquivo de vídeo.");
      return;
    }

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
    setVideoModalVisible(false);
    setVideoTitle("");
    setVideoSubtitle("");
    setVideoFile(null);
    setVideoCover(null);
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} backgroundColor={theme.headerBg || theme.mainBg} />

      <View style={styles.dashboardContainer}>
        <Sidebar activeRoute="perfil" />

        <View style={styles.mainContent}>
          <Header />

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={false}>
            {isLoadingUser ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 80 }}>
                <ActivityIndicator size="large" color={theme.accent} />
                <Text style={{ color: theme.textSecondary, marginTop: 10 }}>Carregando dados...</Text>
              </View>
            ) : (
              <View style={styles.contentWrapper}>
                {/* PERFIL */}
                <View style={[styles.profileHeader, isEditingProfile && styles.profileHeaderEditing]}>
                  <View style={styles.profileHeaderLeft}>
                    <TouchableOpacity
                      onPress={() => isEditingProfile ? handlePickProfileImage() : profileImage && openViewer(profileImage, "image")}
                      style={[styles.profileAvatar, isEditingProfile && styles.profileAvatarEditingMode]}
                    >
                      {profileImage || editedProfileImage ? (
                        <Image source={{ uri: editedProfileImage || profileImage! }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.profileAvatarText}>{profileName.charAt(0)}</Text>
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
                          <Text style={styles.profileCategory}>{profileCategory}</Text>
                        </>
                      ) : (
                        <View style={styles.editFormColumn}>
                          <TextInput value={editedProfileName} onChangeText={setEditedProfileName} style={styles.profileNameInputStyled} placeholder="Nome" placeholderTextColor={theme.textSecondary} />
                          <TouchableOpacity onPress={() => setIsCityModalVisible(true)} style={styles.editInputBox}>
                            <Text style={styles.locationText}>{editedLocation}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>

                  {!isEditingProfile && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity style={styles.editButton} onPress={handleStartEditingProfile}>
                        <Text style={styles.editButtonText}>Editar perfil</Text>
                      </TouchableOpacity>
                      {!isArtist && (
                        <TouchableOpacity style={[styles.editButton, { backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.accent }]} onPress={() => setIsArtistModalVisible(true)}>
                          <Text style={[styles.editButtonText, { color: theme.accent }]}>Tornar-se Artista</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>

                {isEditingProfile && (
                  <View style={styles.profileEditActions}>
                    <TouchableOpacity style={styles.cancelProfileButton} onPress={handleCancelEditingProfile}>
                      <Text style={styles.cancelBioText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBioButton} onPress={handleSaveProfile}>
                      <Check size={15} color="#FFFFFF" />
                      <Text style={styles.saveBioText}>Salvar</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* SOBRE MIM */}
                <View style={styles.bioCard}>
                  <Text style={styles.sectionTitle}>Sobre mim</Text>
                  <Text style={styles.bioText}>{bio}</Text>
                </View>

                {/* CONTEÚDO EXCLUSIVO DE ARTISTA */}
                {isArtist ? (
                  <>
                    <View style={styles.statsRow}>
                      <StatCard theme={theme} number={stats.avaliacaoMedia} label="Avaliação média" icon={<Text style={styles.starIcon}>★</Text>} />
                      <StatCard theme={theme} number={stats.contratacoes} label="Contratações" icon={<Music size={18} color={theme.accent} />} />
                      <StatCard theme={theme} number={stats.favoritos} label="Favoritos" icon={<Heart size={18} color="#E05A10" />} />
                    </View>

                    <View style={styles.sectionHeader}>
                      <View>
                        <Text style={styles.sectionTitle}>Portfólio</Text>
                        <Text style={styles.sectionSubtitle}>Mostre seus trabalhos e apresentações</Text>
                      </View>
                      <View style={styles.portfolioActions}>
                        <TouchableOpacity style={styles.addPortfolioButton} activeOpacity={0.8} onPress={() => setPortfolioModalVisible(true)}>
                          <Text style={styles.addIcon}>+</Text>
                          <Text style={styles.addPortfolioText}>Adicionar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.addVideoButton} activeOpacity={0.8} onPress={() => setVideoModalVisible(true)}>
                          <Text style={styles.addVideoIcon}>+</Text>
                          <Text style={styles.addVideoText}>Adicionar vídeo</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {portfolioItems.map((item, index) => {
                      const displayImageUri = item.cover?.uri || (item.file?.mimeType?.startsWith("image/") ? item.file.uri : null);
                      const isVideo = item.file?.mimeType?.startsWith("video/");

                      return (
                        <View key={item.id} style={[styles.portfolioCard, item.isFeatured && styles.portfolioCardFeatured]}>
                          {item.isFeatured && (
                            <View style={styles.featuredBadge}>
                              <Star size={10} color="#FFFFFF" fill="#FFFFFF" style={{ marginRight: 3 }} />
                              <Text style={styles.featuredBadgeText}>Destaque</Text>
                            </View>
                          )}

                          <View style={styles.portfolioPreview}>
                            {displayImageUri || isVideo ? (
                              <TouchableOpacity
                                style={{ flex: 1, width: "100%", position: "relative" }}
                                activeOpacity={0.85}
                                onPress={() => openViewer(displayImageUri || item.file.uri, isVideo ? "video" : "image")}
                              >
                                {displayImageUri ? (
                                  <Image source={{ uri: displayImageUri }} style={styles.fullCoverImage} />
                                ) : (
                                  <View style={[styles.fullCoverImage, { backgroundColor: "#33231D", justifyContent: "center", alignItems: "center" }]}>
                                    <Text style={{ fontSize: 24, color: "#fff" }}>▶</Text>
                                  </View>
                                )}
                              </TouchableOpacity>
                            ) : (
                              <>
                                <Music size={38} color={theme.accent} />
                                <Text style={styles.portfolioPreviewTitle}>Portfólio</Text>
                                <Text style={styles.portfolioPreviewText}>Trabalho</Text>
                              </>
                            )}
                          </View>

                          <View style={styles.portfolioInfo}>
                            <Text style={styles.portfolioTitle}>{item.name}</Text>
                            <Text style={styles.portfolioDescription}>{item.description}</Text>
                          </View>

                          <View style={styles.portfolioCardActions}>
                            <TouchableOpacity
                              style={[styles.cardActionBtn, item.isFeatured && styles.cardActionBtnActive]}
                              onPress={() => handleToggleFeaturePortfolio(item.id)}
                            >
                              <Star size={14} color={item.isFeatured ? "#FFFFFF" : theme.textSecondary} fill={item.isFeatured ? "#FFFFFF" : "none"} />
                            </TouchableOpacity>

                            {index > 0 && (
                              <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleMovePortfolioItem(index, "up")}>
                                <ArrowUp size={14} color={theme.textSecondary} />
                              </TouchableOpacity>
                            )}

                            {index < portfolioItems.length - 1 && (
                              <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleMovePortfolioItem(index, "down")}>
                                <ArrowDown size={14} color={theme.textSecondary} />
                              </TouchableOpacity>
                            )}

                            <TouchableOpacity style={[styles.cardActionBtn, styles.cardActionDelete]} onPress={() => handleDeletePortfolioItem(item.id)}>
                              <Trash2 size={14} color="#E05A10" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}

                    <View style={styles.videoGrid}>
                      {videoItems.map((video, index) => {
                        const videoCoverUri = video.cover?.uri || video.file?.uri;

                        return (
                          <View key={video.id} style={[styles.videoCard, video.isFeatured && styles.videoCardFeatured]}>
                            {video.isFeatured && (
                              <View style={styles.featuredBadgeVideo}>
                                <Star size={9} color="#FFFFFF" fill="#FFFFFF" style={{ marginRight: 2 }} />
                                <Text style={styles.featuredBadgeText}>Destaque</Text>
                              </View>
                            )}

                            <View style={styles.videoCardActions}>
                              <TouchableOpacity
                                style={[styles.cardActionBtn, video.isFeatured && styles.cardActionBtnActive]}
                                onPress={() => handleToggleFeatureVideo(video.id)}
                              >
                                <Star size={13} color={video.isFeatured ? "#FFFFFF" : theme.textSecondary} fill={video.isFeatured ? "#FFFFFF" : "none"} />
                              </TouchableOpacity>

                              {index > 0 && (
                                <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleMoveVideoItem(index, "up")}>
                                  <ArrowUp size={13} color={theme.textSecondary} />
                                </TouchableOpacity>
                              )}

                              {index < videoItems.length - 1 && (
                                <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleMoveVideoItem(index, "down")}>
                                  <ArrowDown size={13} color={theme.textSecondary} />
                                </TouchableOpacity>
                              )}

                              <TouchableOpacity style={[styles.cardActionBtn, styles.cardActionDelete]} onPress={() => handleDeleteVideoItem(video.id)}>
                                <Trash2 size={13} color="#E05A10" />
                              </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                              style={styles.videoThumbnail}
                              activeOpacity={0.85}
                              onPress={() => video.file?.uri && openViewer(video.file.uri, "video")}
                            >
                              {videoCoverUri ? (
                                <Image source={{ uri: videoCoverUri }} style={styles.fullCoverImage} />
                              ) : (
                                <View style={styles.videoIconCircle}>
                                  <Music size={25} color="#FFFFFF" />
                                </View>
                              )}
                              <View style={styles.playButton}>
                                <Text style={styles.playText}>▶</Text>
                              </View>
                            </TouchableOpacity>

                            <View style={styles.videoInfo}>
                              <Text style={styles.videoTitle}>{video.title}</Text>
                              <Text style={styles.videoSubtitle}>{video.subtitle}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <View style={[styles.bioCard, { alignItems: "center", paddingVertical: 24 }]}>
                    <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: "center" }}>
                      Você ainda não possui um perfil de artista ativo. Clique em "Tornar-se Artista" para liberar seu portfólio completo.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* MODAL DE ARTISTA */}
      <Modal visible={isArtistModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tornar-se Artista</Text>
              <TouchableOpacity onPress={() => setIsArtistModalVisible(false)}><X size={19} color={theme.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <TextInput value={artistName} onChangeText={setArtistName} placeholder="Nome Artístico / Banda" placeholderTextColor={theme.textSecondary} style={styles.formInput} />
              <TextInput value={artistBio} onChangeText={setArtistBio} placeholder="Biografia" placeholderTextColor={theme.textSecondary} multiline style={[styles.formInput, styles.descriptionInput]} />
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setIsArtistModalVisible(false)}><Text>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalAddButton} onPress={handleRegisterAsArtist}><Text style={{ color: "#fff" }}>Salvar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE PORTFÓLIO */}
      <Modal visible={portfolioModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar ao portfólio</Text>
              <TouchableOpacity onPress={() => setPortfolioModalVisible(false)}><X size={19} color={theme.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <TextInput value={portfolioName} onChangeText={setPortfolioName} placeholder="Título" placeholderTextColor={theme.textSecondary} style={styles.formInput} />
              <TextInput value={portfolioDescription} onChangeText={setPortfolioDescription} placeholder="Descrição" placeholderTextColor={theme.textSecondary} multiline style={[styles.formInput, styles.descriptionInput]} />
              
              <Text style={styles.inputLabel}>Capa do Trabalho (Opcional)</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickPortfolioCover}>
                <ImageIcon size={18} color={theme.accent} />
                <Text style={{ color: theme.textPrimary, marginLeft: 8 }}>{portfolioCover ? portfolioCover.name : "Subir imagem de capa"}</Text>
              </TouchableOpacity>

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>Arquivo Principal ou Mídia</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickPortfolioFile}>
                <Upload size={18} color={theme.accent} />
                <Text style={{ color: theme.textPrimary, marginLeft: 8 }}>{portfolioFile ? portfolioFile.name : "Subir arquivo ou mídia"}</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setPortfolioModalVisible(false)}><Text>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalAddButton} onPress={handleAddPortfolio}><Text style={{ color: "#fff" }}>Adicionar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE VÍDEO */}
      <Modal visible={videoModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar vídeo</Text>
              <TouchableOpacity onPress={() => setVideoModalVisible(false)}><X size={19} color={theme.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <TextInput value={videoTitle} onChangeText={setVideoTitle} placeholder="Título" placeholderTextColor={theme.textSecondary} style={styles.formInput} />
              <TextInput value={videoSubtitle} onChangeText={setVideoSubtitle} placeholder="Subtítulo" placeholderTextColor={theme.textSecondary} style={styles.formInput} />
              
              <Text style={styles.inputLabel}>Capa do Vídeo (Opcional)</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickVideoCover}>
                <ImageIcon size={18} color={theme.accent} />
                <Text style={{ color: theme.textPrimary, marginLeft: 8 }}>{videoCover ? videoCover.name : "Subir imagem de capa (Opcional)"}</Text>
              </TouchableOpacity>

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>Arquivo de Vídeo</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickVideo}>
                <Upload size={18} color={theme.accent} />
                <Text style={{ color: theme.textPrimary, marginLeft: 8 }}>{videoFile ? videoFile.name : "Selecionar arquivo de vídeo"}</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setVideoModalVisible(false)}><Text>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalAddButton} onPress={handleAddVideo}><Text style={{ color: "#fff" }}>Adicionar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE VISUALIZAÇÃO EM TELA CHEIA (SEM ZOOM) */}
      <Modal visible={isViewerVisible} transparent animationType="fade" onRequestClose={closeViewer}>
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerCloseButton} onPress={closeViewer} activeOpacity={0.7}>
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
              resizeMode="contain"
            />
          ) : null}
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
    container: { flex: 1, backgroundColor: theme.mainBg },
    dashboardContainer: { flex: 1, flexDirection: "row", backgroundColor: theme.mainBg },
    mainContent: { flex: 1, backgroundColor: theme.mainBg },
    scrollView: { flex: 1 },
    scrollContentContainer: { flexGrow: 1 },
    contentWrapper: { paddingHorizontal: 32, paddingTop: 20, paddingBottom: 40 },
    profileHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
    profileHeaderEditing: { borderWidth: 1, borderColor: theme.accent, borderRadius: 12, padding: 16, backgroundColor: theme.cardBg },
    profileHeaderLeft: { flexDirection: "row", alignItems: "flex-start", flex: 1 },
    profileData: { flex: 1 },
    profileAvatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: "#D9B59F", justifyContent: "center", alignItems: "center", marginRight: 14, overflow: "hidden", position: "relative" },
    profileAvatarEditingMode: { borderWidth: 2, borderColor: theme.accent, borderStyle: "dashed" },
    avatarImage: { width: "100%", height: "100%", borderRadius: 33, resizeMode: "cover" },
    avatarEditOverlay: { position: "absolute", backgroundColor: "rgba(0, 0, 0, 0.4)", width: "100%", height: "100%", borderRadius: 33, justifyContent: "center", alignItems: "center" },
    profileAvatarText: { color: "#FFFFFF", fontSize: 27, fontWeight: "700" },
    profileName: { color: theme.textPrimary, fontSize: 24, fontWeight: "700" },
    editFormColumn: { width: "100%", gap: 10 },
    editInputBox: { backgroundColor: theme.mainBg, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    profileNameInputStyled: { color: theme.textPrimary, fontSize: 14, fontWeight: "700" },
    locationRow: { flexDirection: "row", alignItems: "center", marginTop: 5 },
    locationIcon: { color: theme.textSecondary, fontSize: 15, marginRight: 4 },
    locationText: { color: theme.textSecondary, fontSize: 12 },
    profileCategory: { color: theme.textSecondary, fontSize: 12, marginTop: 4 },
    editButton: { flexDirection: "row", alignItems: "center", backgroundColor: theme.accent, paddingVertical: 10, paddingHorizontal: 17, borderRadius: 7 },
    editButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
    bioCard: { backgroundColor: theme.cardBg, borderRadius: 12, borderWidth: 1, borderColor: theme.borderColor, padding: 18, marginBottom: 14 },
    sectionTitle: { color: theme.textPrimary, fontSize: 17, fontWeight: "700" },
    sectionSubtitle: { color: theme.textSecondary, fontSize: 11, marginTop: 3 },
    bioText: { color: theme.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 10 },
    profileEditActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginBottom: 22 },
    cancelProfileButton: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 6, marginRight: 7 },
    cancelBioText: { color: theme.textSecondary, fontSize: 10, fontWeight: "600" },
    saveBioButton: { flexDirection: "row", alignItems: "center", backgroundColor: theme.accent, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 6 },
    saveBioText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", marginLeft: 5 },
    statsRow: { flexDirection: "row", marginBottom: 22 },
    statCard: { flex: 1, minHeight: 70, backgroundColor: theme.cardBg, borderRadius: 10, borderWidth: 1, borderColor: theme.borderColor, padding: 13, flexDirection: "row", alignItems: "center", marginRight: 12 },
    statIcon: { width: 35, height: 35, borderRadius: 8, backgroundColor: theme.mainBg, justifyContent: "center", alignItems: "center", marginRight: 10 },
    starIcon: { color: "#FFB800", fontSize: 19 },
    statNumber: { color: theme.textPrimary, fontSize: 18, fontWeight: "700" },
    statLabel: { color: theme.textSecondary, fontSize: 10, marginTop: 2 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 5 },
    portfolioActions: { flexDirection: "row", alignItems: "center" },
    addPortfolioButton: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: theme.borderColor, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 10, marginRight: 8 },
    addIcon: { color: theme.accent, fontSize: 18, marginRight: 5, lineHeight: 16 },
    addPortfolioText: { color: theme.accent, fontSize: 10, fontWeight: "700" },
    addVideoButton: { flexDirection: "row", alignItems: "center", backgroundColor: theme.accent, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 11 },
    addVideoIcon: { color: "#FFFFFF", fontSize: 17, marginRight: 5, lineHeight: 15 },
    addVideoText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
    portfolioCard: { backgroundColor: theme.cardBg, borderRadius: 12, borderWidth: 1, borderColor: theme.borderColor, overflow: "hidden", flexDirection: "row", marginBottom: 22, position: "relative" },
    portfolioCardFeatured: { borderColor: theme.accent, borderWidth: 1.5 },
    featuredBadge: { position: "absolute", top: 8, left: 8, zIndex: 5, backgroundColor: theme.accent, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    featuredBadgeVideo: { position: "absolute", top: 8, left: 8, zIndex: 5, backgroundColor: theme.accent, flexDirection: "row", alignItems: "center", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
    featuredBadgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "700" },
    portfolioCardActions: { position: "absolute", top: 10, right: 10, zIndex: 5, flexDirection: "row", gap: 4 },
    cardActionBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: theme.mainBg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: theme.borderColor },
    cardActionBtnActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    cardActionDelete: { backgroundColor: theme.mainBg },
    portfolioPreview: { width: 190, height: 130, backgroundColor: "#FDE4D9", justifyContent: "center", alignItems: "center" },
    fullCoverImage: { width: "100%", height: "100%", resizeMode: "cover" },
    portfolioPreviewTitle: { color: "#493027", fontSize: 14, fontWeight: "700", marginTop: 8 },
    portfolioPreviewText: { color: "#8A6D5D", fontSize: 10, marginTop: 3 },
    portfolioInfo: { flex: 1, padding: 18, paddingTop: 26 },
    portfolioTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: "700" },
    portfolioDescription: { color: theme.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 7 },
    videoGrid: { flexDirection: "row", marginBottom: 22, flexWrap: "wrap", gap: 12 },
    videoCard: { flex: 1, minWidth: 200, backgroundColor: theme.cardBg, borderRadius: 10, borderWidth: 1, borderColor: theme.borderColor, overflow: "hidden", position: "relative" },
    videoCardFeatured: { borderColor: theme.accent, borderWidth: 1.5 },
    videoCardActions: { position: "absolute", top: 8, right: 8, zIndex: 5, flexDirection: "row", gap: 3 },
    videoThumbnail: { height: 130, backgroundColor: "#33231D", justifyContent: "center", alignItems: "center", position: "relative" },
    videoIconCircle: { width: 55, height: 55, borderRadius: 28, backgroundColor: "#5A392B", justifyContent: "center", alignItems: "center" },
    playButton: { position: "absolute", right: 10, bottom: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: theme.accent, justifyContent: "center", alignItems: "center" },
    playText: { color: "#FFFFFF", fontSize: 12, marginLeft: 2 },
    videoInfo: { padding: 11 },
    videoTitle: { color: theme.textPrimary, fontSize: 11, fontWeight: "700" },
    videoSubtitle: { color: theme.textSecondary, fontSize: 9, marginTop: 3 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.55)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
    modalContainer: { width: "100%", maxWidth: 520, backgroundColor: theme.cardBg, borderRadius: 14, borderWidth: 1, borderColor: theme.borderColor, overflow: "hidden" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: theme.borderColor },
    modalTitle: { color: theme.textPrimary, fontSize: 17, fontWeight: "700" },
    modalContent: { padding: 20 },
    inputLabel: { color: theme.textPrimary, fontSize: 11, fontWeight: "700", marginBottom: 6 },
    formInput: { width: "100%", height: 42, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 7, backgroundColor: theme.mainBg, color: theme.textPrimary, fontSize: 11, paddingHorizontal: 12, marginBottom: 12 },
    descriptionInput: { height: 95, paddingTop: 10 },
    uploadButton: { flexDirection: "row", alignItems: "center", width: "100%", height: 48, borderWidth: 1, borderStyle: "dashed", borderColor: theme.borderColor, borderRadius: 8, backgroundColor: theme.mainBg, paddingHorizontal: 12, marginBottom: 12 },
    modalFooter: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", borderTopWidth: 1, borderTopColor: theme.borderColor, padding: 14 },
    modalCancelButton: { padding: 10 },
    modalAddButton: { backgroundColor: theme.accent, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 6 },
    viewerOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.95)", justifyContent: "center", alignItems: "center" },
    viewerCloseButton: { position: "absolute", top: 40, right: 30, zIndex: 10, padding: 10, backgroundColor: "rgba(255, 255, 255, 0.15)", borderRadius: 25 },
    viewerImage: { width: "90%", height: "85%", resizeMode: "contain" },
  });