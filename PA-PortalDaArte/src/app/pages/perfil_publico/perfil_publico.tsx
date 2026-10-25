import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ArrowLeft, MapPin, MessageCircle, Music, Star, X } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Header from "../../../components/Header";
import Sidebar from "../../../components/Sidebar";
import { useTheme } from "../../../components/context/ThemeContext";

const URL_API = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

const firstValue = (...values: any[]) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const asText = (value: any): string => {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    return String(firstValue(value.nome, value.name, value.titulo, value.descricao, ""));
  }
  return "";
};

export default function PerfilPublicoScreen() {
  const { theme, isLightMode } = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const artistId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [artist, setArtist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [isServiceModalVisible, setIsServiceModalVisible] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(`${URL_API}/api/artistas`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Não foi possível carregar o perfil.");
        const rows = Array.isArray(payload) ? payload : (payload.artistas || payload.items || payload.data || []);
        const found = rows.find((item: any) =>
          String(firstValue(item.id, item.usuario_id, item.artista_id, "")) === String(artistId)
        );
        if (!found) throw new Error("Este perfil não foi encontrado ou não está mais disponível.");
        if (active) setArtist(found);
        try {
          const portfolioResponse = await fetch(`${URL_API}/api/artistas/${encodeURIComponent(String(artistId))}/portfolio`);
          const portfolioPayload = await portfolioResponse.json();
          if (portfolioResponse.ok && active) setPortfolio(Array.isArray(portfolioPayload.portfolio) ? portfolioPayload.portfolio : []);
        } catch (portfolioError) {
          console.warn("Não foi possível carregar o portfólio público", portfolioError);
        }
      } catch (e: any) {
        if (active) setError(e?.message || "Falha ao carregar o perfil.");
      } finally {
        if (active) setLoading(false);
      }
    };
    if (artistId) load();
    else {
      setError("Identificador de perfil inválido.");
      setLoading(false);
    }
    return () => { active = false; };
  }, [artistId]);

  const handleSendMessage = async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        Alert.alert("Entre na sua conta", "Faça login para enviar mensagens a este perfil.");
        return;
      }
      router.push({
        pathname: "/pages/mensagens/mensagens",
        params: {
          destinatarioId: String(artist.id || artist.usuario_id || artist.artista_id),
          destinatarioNome: String(firstValue(artist.nome_artistico, artist.nome, artist.name, "Artista")),
        },
      } as any);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir as mensagens.");
    }
  };

  const name = String(firstValue(artist?.nome_artistico, artist?.nome, artist?.name, "Artista"));
  const photo = firstValue(artist?.foto_perfil_url, artist?.foto_url, artist?.avatar_url, artist?.profile_image, null);
  const bio = String(firstValue(artist?.biografia, artist?.bio, artist?.descricao, "Este artista ainda não adicionou uma biografia."));
  const city = [artist?.cidade_atendimento || artist?.cidade, artist?.estado_atendimento || artist?.estado].filter(Boolean).join(", ");
  const categories = firstValue(artist?.categorias, artist?.categories, artist?.categoria, []);
  const services = firstValue(artist?.servicos, artist?.services, artist?.instrumentos, []);
  const rating = Number(firstValue(artist?.nota_media, artist?.avaliacao_media, artist?.rating, 0)) || 0;
  const reviews = Number(firstValue(artist?.total_avaliacoes, artist?.reviews, 0)) || 0;
  const years = firstValue(artist?.anos_experiencia, artist?.experience, null);
  const mode = String(firstValue(artist?.modalidade_atendimento, artist?.modalidade, ""));
  const serviceList = Array.isArray(services) ? services : (services ? [services] : []);
  const categoryList = Array.isArray(categories) ? categories : (categories ? [categories] : []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} backgroundColor={theme.headerBg || theme.mainBg} />
      <View style={styles.dashboardContainer}>
        <Sidebar />
        <View style={styles.rightArea}>
          <Header />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
              <ArrowLeft size={17} color={theme.textPrimary} />
              <Text style={styles.backText}>Voltar para Descobrir</Text>
            </TouchableOpacity>

            {loading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color={theme.accent} size="large" />
                <Text style={styles.stateText}>Carregando perfil...</Text>
              </View>
            ) : error ? (
              <View style={styles.stateBox}>
                <Text style={styles.errorTitle}>Não foi possível abrir o perfil</Text>
                <Text style={styles.stateText}>{error}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
                  <Text style={styles.secondaryButtonText}>Voltar</Text>
                </TouchableOpacity>
              </View>
            ) : artist ? (
              <>
                <View style={styles.heroCard}>
                  <View style={styles.heroTop}>
                    {photo ? (
                      <Image source={{ uri: String(photo) }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarFallback}><Music size={38} color={theme.accent} /></View>
                    )}
                    <View style={styles.heroDetails}>
                      <Text style={styles.name}>{name}</Text>
                      <Text style={styles.subtitle}>
                        {asText(firstValue(artist.categorias, artist.categories, artist.estilo_musical, artist.estilo, "Artista independente"))}
                      </Text>
                      {city ? (
                        <View style={styles.locationRow}>
                          <MapPin size={15} color={theme.textSecondary} />
                          <Text style={styles.locationText}>{city}</Text>
                        </View>
                      ) : null}
                      <View style={styles.ratingRow}>
                        <Star size={15} color="#E6A23C" fill="#E6A23C" />
                        <Text style={styles.ratingText}>{rating > 0 ? rating.toFixed(1).replace(".", ",") : "Sem avaliações"}</Text>
                        {rating > 0 ? <Text style={styles.reviewText}>({reviews} avaliações)</Text> : null}
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.messageButton} onPress={handleSendMessage} activeOpacity={0.85}>
                    <MessageCircle size={18} color="#FFFFFF" />
                    <Text style={styles.messageButtonText}>Enviar mensagem</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Sobre</Text>
                  <Text style={styles.bodyText}>{bio}</Text>
                  <View style={styles.infoGrid}>
                    {years !== null && years !== undefined && years !== "" ? (
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Experiência</Text>
                        <Text style={styles.infoValue}>{String(years)} {Number(years) === 1 ? "ano" : "anos"}</Text>
                      </View>
                    ) : null}
                    {mode ? (
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Atendimento</Text>
                        <Text style={styles.infoValue}>{mode === "ambos" ? "Presencial e remoto" : mode === "presencial" ? "Presencial" : mode === "remoto" ? "Remoto" : mode}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {categoryList.length > 0 ? (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Categorias e estilos</Text>
                    <View style={styles.chips}>
                      {categoryList.map((item: any, index: number) => (
                        <View key={`${asText(item)}-${index}`} style={styles.chip}>
                          <Text style={styles.chipText}>{asText(item)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Serviços</Text>
                  {serviceList.length ? serviceList.map((service: any, index: number) => {
                    const title = asText(firstValue(service?.titulo, service?.title, service?.nome, service, "Serviço"));
                    const description = asText(firstValue(service?.descricao, service?.description, ""));
                    const price = firstValue(service?.preco_min, service?.preco, service?.price, null);
                    const maxPrice = firstValue(service?.preco_max, null);
                    return (
                      <TouchableOpacity
                        key={`${title}-${index}`}
                        style={styles.serviceItem}
                        activeOpacity={0.78}
                        onPress={() => { setSelectedService(service); setIsServiceModalVisible(true); }}
                      >
                        <View style={styles.serviceIcon}><Music size={17} color={theme.accent} /></View>
                        <View style={styles.serviceTextWrap}>
                          <Text style={styles.serviceTitle} numberOfLines={2}>{title}</Text>
                          {price !== null ? <Text style={styles.servicePrice}>A partir de R$ {Number(price).toLocaleString("pt-BR")}{maxPrice !== null ? ` até R$ ${Number(maxPrice).toLocaleString("pt-BR")}` : ""}</Text> : null}
                          {description ? <Text style={styles.serviceDescription} numberOfLines={2}>{description}</Text> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  }) : <Text style={styles.bodyText}>Nenhum serviço cadastrado.</Text>}
                </View>

                <Modal visible={isServiceModalVisible} transparent animationType="fade" onRequestClose={() => setIsServiceModalVisible(false)}>
                  <View style={styles.modalOverlay}>
                    <View style={styles.serviceModal}>
                      <View style={styles.modalHeader}>
                        <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                          <Text style={styles.modalTitle} numberOfLines={2}>{asText(firstValue(selectedService?.titulo, selectedService?.title, selectedService?.nome, "Detalhes do serviço"))}</Text>
                          <Text style={styles.modalSubtitle}>Informações do serviço</Text>
                        </View>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsServiceModalVisible(false)} accessibilityLabel="Fechar detalhes">
                          <X size={19} color={theme.textSecondary} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator>
                        {(selectedService?.preco_min != null || selectedService?.preco_max != null || selectedService?.preco != null || selectedService?.price != null) ? (
                          <View style={styles.modalInfoBox}>
                            <Text style={styles.modalInfoLabel}>Valor do serviço</Text>
                            <Text style={styles.modalPrice}>{selectedService?.preco_min != null && selectedService?.preco_max != null && Number(selectedService.preco_min) !== Number(selectedService.preco_max)
                              ? `${Number(selectedService.preco_min).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} – ${Number(selectedService.preco_max).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                              : Number(firstValue(selectedService?.preco_min, selectedService?.preco_max, selectedService?.preco, selectedService?.price)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Text>
                          </View>
                        ) : null}
                        <View style={styles.modalInfoBox}>
                          <Text style={styles.modalInfoTitle}>Descrição</Text>
                          <Text style={styles.modalDescription}>{asText(firstValue(selectedService?.descricao, selectedService?.description, "Nenhuma descrição informada."))}</Text>
                        </View>
                      </ScrollView>
                      <View style={styles.modalFooter}>
                        <TouchableOpacity onPress={() => setIsServiceModalVisible(false)} style={styles.modalCloseAction}>
                          <Text style={styles.modalCloseActionText}>Fechar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Modal>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Portfólio</Text>
                  {portfolio.length ? portfolio.map((item: any, index: number) => (
                    <View key={`${item.portfolio_id || item.id}-${index}`} style={styles.portfolioItem}>
                      <View style={styles.portfolioIcon}><Music size={18} color={theme.accent} /></View>
                      <View style={{ flex: 1, gap: 5 }}>
                        <Text style={styles.serviceTitle}>{asText(firstValue(item.titulo, item.name, "Trabalho artístico"))}</Text>
                        {item.descricao ? <Text style={styles.serviceDescription}>{asText(item.descricao)}</Text> : null}
                        {item.midia_url && !String(item.midia_url).startsWith("texto://") ? <Text style={styles.portfolioMediaText}>Mídia: {asText(item.midia_url)}</Text> : null}
                      </View>
                    </View>
                  )) : <Text style={styles.bodyText}>Este artista ainda não publicou trabalhos no portfólio.</Text>}
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.mainBg },
  dashboardContainer: { flex: 1, flexDirection: "row", backgroundColor: theme.mainBg },
  rightArea: { flex: 1, minWidth: 0 },
  content: { padding: 28, paddingBottom: 50, maxWidth: 1100, width: "100%", alignSelf: "center", gap: 18 },
  backButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  backText: { color: theme.textPrimary, fontSize: 13, fontWeight: "600" },
  heroCard: { backgroundColor: theme.cardBg, borderColor: theme.borderColor, borderWidth: 1, borderRadius: 18, padding: 24, gap: 22 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 20 },
  avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: theme.mainBg },
  avatarFallback: { width: 112, height: 112, borderRadius: 56, backgroundColor: theme.mainBg, alignItems: "center", justifyContent: "center" },
  heroDetails: { flex: 1, gap: 7 },
  name: { color: theme.textPrimary, fontSize: 27, fontWeight: "800", fontFamily: Platform.OS === "web" ? "serif" : undefined },
  subtitle: { color: theme.accent, fontSize: 14, fontWeight: "700" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationText: { color: theme.textSecondary, fontSize: 13 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingText: { color: theme.textPrimary, fontSize: 13, fontWeight: "700" },
  reviewText: { color: theme.textSecondary, fontSize: 12 },
  messageButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: theme.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  messageButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  sectionCard: { backgroundColor: theme.cardBg, borderColor: theme.borderColor, borderWidth: 1, borderRadius: 16, padding: 22, gap: 14 },
  sectionTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: "800" },
  bodyText: { color: theme.textSecondary, fontSize: 14, lineHeight: 22 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 28, marginTop: 8 },
  infoItem: { gap: 4 },
  infoLabel: { color: theme.textSecondary, fontSize: 12 },
  infoValue: { color: theme.textPrimary, fontSize: 14, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: theme.mainBg, borderColor: theme.borderColor, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: theme.textPrimary, fontSize: 12, fontWeight: "600" },
  serviceItem: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.borderColor },
  portfolioItem: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.borderColor },
  portfolioIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: theme.mainBg },
  portfolioMediaText: { color: theme.textSecondary, fontSize: 12 },
  serviceIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: theme.mainBg, alignItems: "center", justifyContent: "center" },
  serviceTextWrap: { flex: 1, gap: 5 },
  serviceTitle: { color: theme.textPrimary, fontSize: 14, fontWeight: "700" },
  serviceDescription: { color: theme.textSecondary, fontSize: 12, lineHeight: 18 },
  servicePrice: { color: theme.accent, fontSize: 12, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 18 },
  serviceModal: { width: "100%", maxWidth: 560, maxHeight: "82%", backgroundColor: theme.cardBg, borderColor: theme.borderColor, borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: theme.borderColor },
  modalTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: "800" },
  modalSubtitle: { color: theme.textSecondary, fontSize: 12, marginTop: 4 },
  modalCloseButton: { padding: 7, borderRadius: 8 },
  modalScroll: { paddingHorizontal: 18, paddingTop: 16 },
  modalInfoBox: { padding: 14, borderRadius: 10, backgroundColor: theme.mainBg, borderWidth: 1, borderColor: theme.borderColor, marginBottom: 14 },
  modalInfoLabel: { color: theme.textSecondary, fontSize: 11, marginBottom: 5 },
  modalPrice: { color: theme.accent, fontSize: 18, fontWeight: "800" },
  modalInfoTitle: { color: theme.textPrimary, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  modalDescription: { color: theme.textSecondary, fontSize: 13, lineHeight: 21 },
  modalFooter: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: theme.borderColor },
  modalCloseAction: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: theme.borderColor },
  modalCloseActionText: { color: theme.textPrimary, fontWeight: "600", fontSize: 12 },
  stateBox: { alignItems: "center", justifyContent: "center", minHeight: 280, gap: 12 },
  stateText: { color: theme.textSecondary, fontSize: 14, textAlign: "center" },
  errorTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: "800" },
  secondaryButton: { backgroundColor: theme.accent, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  secondaryButtonText: { color: "#FFFFFF", fontWeight: "700" },
});
