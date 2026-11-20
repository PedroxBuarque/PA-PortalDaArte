import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { AccessibleTextInput as TextInput } from '../../../components/accessibility/AccessibleTextInput';
import { router, useLocalSearchParams } from "expo-router";
import { Lock } from "lucide-react-native";
import { buildLoginHref, sanitizeRedirect } from "../../../constants/auth-routes";
import BrandMark from "../../../components/BrandMark";

import { VLibrasText as Text } from '../../../components/accessibility/VLibrasText';
import { useAccessibility } from '../../../components/accessibility/AccessibilityContext';
import { useTheme } from '../../../components/context/ThemeContext';
const DOC_TYPES = ["CPF", "CNPJ", "MEI"];
const URL_API = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function RegisterScreen() {
  const { theme } = useTheme();
  const { highContrast } = useAccessibility();
  const { width } = useWindowDimensions();
  const compact = width < 620;
  const styles = getStyles(theme, highContrast, compact);

  // O cadastro não faz login automático: o destino pretendido segue junto até o login.
  const params = useLocalSearchParams<{ redirect?: string | string[] }>();
  const redirect = sanitizeRedirect(params.redirect);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  const [docType, setDocType] = useState("");
  const [docNumber, setDocNumber] = useState("");

  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const [error, setError] = useState("");

  const [estadosList, setEstadosList] = useState<string[]>([]);
  const [cidadesList, setCidadesList] = useState<string[]>([]);
  const [isLoadingCidades, setIsLoadingCidades] = useState(false);

  const [activePicker, setActivePicker] = useState<
    "docType" | "state" | "city" | null
  >(null);

  useEffect(() => {
    async function fetchEstados() {
      try {
        const response = await fetch(
          "https://servicodados.ibge.gov.br/api/v1/localidades/estados"
        );
        const data = await response.json();
        const ufs = data
          .map((uf: any) => uf.sigla)
          .sort((a: string, b: string) => a.localeCompare(b));
        setEstadosList(ufs);
      } catch (err) {
        console.error("Erro ao buscar estados:", err);
      }
    }
    fetchEstados();
  }, []);

  const fetchCidadesPorEstado = async (uf: string) => {
    setIsLoadingCidades(true);
    try {
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
      );
      const data = await response.json();
      const cidades = data
        .map((cidade: any) => cidade.nome)
        .sort((a: string, b: string) => a.localeCompare(b));
      setCidadesList(cidades);
    } catch (err) {
      console.error("Erro ao buscar cidades:", err);
    } finally {
      setIsLoadingCidades(false);
    }
  };

  const handleDocNumberChange = (text: string) => {
    let value = text.replace(/\D/g, "");

    if (docType === "CPF") {
      if (value.length > 11) value = value.slice(0, 11);
      value = value
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else if (docType === "CNPJ" || docType === "MEI") {
      if (value.length > 14) value = value.slice(0, 14);
      value = value
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }

    setDocNumber(value);
    if (error) setError("");
  };

  const handleRegister = async () => {
    if (
      !email.trim() ||
      !fullName.trim() ||
      !password.trim() ||
      !docType ||
      !docNumber ||
      !state ||
      !city
    ) {
      setError("Preencha todos os campos obrigatórios para continuar.");
      return;
    }

    const rawDoc = docNumber.replace(/\D/g, "");
    if (docType === "CPF" && rawDoc.length < 11) {
      setError("CPF inválido.");
      return;
    }
    if ((docType === "CNPJ" || docType === "MEI") && rawDoc.length < 14) {
      setError(`${docType} inválido.`);
      return;
    }

    try {
      setError("");

      const response = await fetch(`${URL_API}/api/cadastro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          nome_completo: fullName.trim(),
          senha: password,
          tipo_documento: docType === "CPF" ? "cpf" : "cnpj",
          cpf: docType === "CPF" ? rawDoc : null,
          cnpj: docType !== "CPF" ? rawDoc : null,
          estado: state,
          cidade: city,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Não foi possível realizar o cadastro.");
        return;
      }

      router.replace(buildLoginHref(redirect));
    } catch (err) {
      console.log("Erro de conexão no cadastro:", err);
      setError("Não foi possível conectar ao servidor. Verifique sua conexão.");
    }
  };

  const renderPickerModal = (
    type: "docType" | "state" | "city",
    data: string[],
    title: string,
    onSelect: (val: string) => void,
    isLoading?: boolean
  ) => {
    return (
      <Modal
        visible={activePicker === type}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActivePicker(null)}
          accessibilityRole="button"
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{title}</Text>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={highContrast ? theme.accent : "#E15743"} />
                <Text style={styles.loadingText}>Carregando cidades...</Text>
              </View>
            ) : data.length === 0 ? (
              <Text style={styles.modalEmpty}>Nenhum item encontrado.</Text>
            ) : (
              <FlatList
                data={data}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => {
                      onSelect(item);
                      setActivePicker(null);
                      if (error) setError("");
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalOptionText}>{item}</Text>
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 400 }}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.circleTopLeft} />
        <View style={styles.circleTopRight} />
        <View style={styles.circleBottomRight} />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.registerCard}>
            <View style={styles.authBrand}><BrandMark showTagline={false} /></View>
            <Text style={styles.title}>Cadastre-se abaixo</Text>
            <Text style={styles.subtitle}>
              Preencha seus dados para criar sua conta e começar a{"\n"}
              gerenciar contratações, mensagens e seu perfil.
            </Text>

            <View style={styles.rowInputs}>
              <View style={styles.halfInputBox}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (error) setError("");
                  }}
                  placeholder="nome@email.com"
                  placeholderTextColor={highContrast ? theme.textSecondary : "#9D8E85"}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  accessibilityLabel={"E-mail"}
                />
              </View>

              <View style={styles.halfInputBox}>
                <Text style={styles.label}>Nome completo</Text>
                <TextInput
                  value={fullName}
                  onChangeText={(value) => {
                    setFullName(value);
                    if (error) setError("");
                  }}
                  placeholder="Digite seu nome completo"
                  placeholderTextColor={highContrast ? theme.textSecondary : "#9D8E85"}
                  autoCapitalize="words"
                  style={styles.input}
                  accessibilityLabel={"Nome completo"}
                />
              </View>
            </View>

            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordContainer}>
              <Lock size={16} color={highContrast ? theme.textSecondary : "#9D8E85"} style={styles.lockIcon} />
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (error) setError("");
                }}
                placeholder="••••••••"
                placeholderTextColor={highContrast ? theme.textSecondary : "#9D8E85"}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.passwordInput}
                accessibilityLabel={"Senha"}
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={styles.halfInputBox}>
                <Text style={styles.label}>Tipo de documento</Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  activeOpacity={0.7}
                  onPress={() => setActivePicker("docType")}
                  accessibilityRole="button"
                >
                  <Text
                    style={docType ? styles.selectText : styles.placeholderText}
                  >
                    {docType || "Selecione o tipo"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.halfInputBox}>
                <Text style={styles.label}>
                  {docType === "CPF"
                    ? "CPF"
                    : docType === "MEI" || docType === "CNPJ"
                    ? "CNPJ"
                    : "CPF ou CNPJ"}
                </Text>
                <TextInput
                  value={docNumber}
                  onChangeText={handleDocNumberChange}
                  placeholder={
                    docType === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"
                  }
                  placeholderTextColor={highContrast ? theme.textSecondary : "#9D8E85"}
                  keyboardType="numeric"
                  editable={!!docType}
                  style={[
                    styles.input,
                    !docType && { backgroundColor: highContrast ? theme.searchBg : "#F9F1EC" },
                  ]}
                  accessibilityLabel={String(docType === "CPF"
                    ? "CPF"
                    : docType === "MEI" || docType === "CNPJ"
                    ? "CNPJ"
                    : "CPF ou CNPJ")}
                />
              </View>
            </View>

            <View style={styles.rowInputs}>
              <View style={styles.halfInputBox}>
                <Text style={styles.label}>Estado (UF)</Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  activeOpacity={0.7}
                  onPress={() => setActivePicker("state")}
                  accessibilityRole="button"
                >
                  <Text
                    style={state ? styles.selectText : styles.placeholderText}
                  >
                    {state || "Selecione"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.halfInputBox}>
                <Text style={styles.label}>Cidade</Text>
                <TouchableOpacity
                  style={[
                    styles.selectInput,
                    !state && { backgroundColor: highContrast ? theme.searchBg : "#F9F1EC" },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (!state) {
                      setError("Selecione o estado primeiro.");
                    } else {
                      setActivePicker("city");
                    }
                  }}
                  accessibilityRole="button"
                >
                  <Text
                    style={city ? styles.selectText : styles.placeholderText}
                    numberOfLines={1}
                  >
                    {city || "Selecione"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.registerButton}
              activeOpacity={0.85}
              onPress={handleRegister}
              accessibilityRole="button"
            >
              <Text style={styles.registerButtonText}>Cadastrar</Text>
            </TouchableOpacity>

            <View style={styles.loginFooterContainer}>
              <Text style={styles.footerText}>Já tem conta?</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push(buildLoginHref(redirect))}
                accessibilityRole="button"
              >
                <Text style={styles.footerLink}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {renderPickerModal("docType", DOC_TYPES, "Tipo de Documento", (val) => {
          setDocType(val);
          setDocNumber("");
        })}

        {renderPickerModal("state", estadosList, "Estado (UF)", (val) => {
          setState(val);
          setCity("");
          fetchCidadesPorEstado(val);
        })}

        {renderPickerModal(
          "city",
          cidadesList,
          "Cidade",
          setCity,
          isLoadingCidades
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme: any, highContrast: boolean, compact: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.mainBg },
  container: { flex: 1, backgroundColor: theme.mainBg, overflow: "hidden", ...Platform.select({ web: { minHeight: "100vh" as any } }) },
  scrollContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: compact ? 14 : 20 },
  circleTopLeft: { position: "absolute", width: 320, height: 320, borderRadius: 160, backgroundColor: highContrast ? "transparent" : (theme.accentSoft || theme.surfaceMuted), top: -100, left: -80, opacity: highContrast ? 0 : 0.9 },
  circleTopRight: { position: "absolute", width: 380, height: 380, borderRadius: 190, backgroundColor: highContrast ? "transparent" : (theme.surfaceMuted || theme.accentSoft), top: -60, right: -90, opacity: highContrast ? 0 : 0.78 },
  circleBottomRight: { position: "absolute", width: 320, height: 320, borderRadius: 160, backgroundColor: highContrast ? "transparent" : (theme.accentSoft || theme.surfaceMuted), bottom: -110, right: -80, opacity: highContrast ? 0 : 0.72 },
  registerCard: { width: "100%", maxWidth: 560, backgroundColor: theme.cardBg, borderWidth: highContrast ? 2 : 1, borderColor: theme.borderColor, borderRadius: 30, borderTopWidth: 4, borderTopColor: theme.accent, paddingVertical: compact ? 28 : 38, paddingHorizontal: compact ? 20 : 36, shadowColor: theme.shadowColor || "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: highContrast ? 0 : 0.12, shadowRadius: 25, elevation: highContrast ? 0 : 8, zIndex: 10 },
  authBrand: { alignItems: "center", marginBottom: 22 },
  title: { color: theme.textPrimary, fontSize: compact ? 25 : 29, fontWeight: "900", textAlign: "center", fontFamily: "serif", marginBottom: 10 },
  subtitle: { color: theme.textSecondary, fontSize: 13, lineHeight: 20, textAlign: "center", marginBottom: 28 },
  rowInputs: { flexDirection: compact ? "column" : "row", justifyContent: "space-between", gap: compact ? 0 : 16 },
  halfInputBox: { flex: 1, minWidth: 0 },
  label: { color: theme.textPrimary, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  input: { height: 50, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 15, backgroundColor: theme.searchBg, paddingHorizontal: 16, color: theme.textPrimary, fontSize: 14, marginBottom: 16, ...Platform.select({ web: { outlineStyle: "none" as any } }) },
  selectInput: { height: 50, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 15, backgroundColor: theme.searchBg, paddingHorizontal: 16, justifyContent: "center", marginBottom: 16 },
  placeholderText: { color: theme.textSecondary, fontSize: 14 },
  selectText: { color: theme.textPrimary, fontSize: 14 },
  passwordContainer: { height: 50, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 15, backgroundColor: theme.searchBg, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 16 },
  lockIcon: { marginRight: 10 },
  passwordInput: { flex: 1, height: 48, color: theme.textPrimary, fontSize: 14, paddingVertical: 0, paddingHorizontal: 0, ...Platform.select({ web: { outlineStyle: "none" as any } }) },
  errorText: { color: theme.danger || "#B42318", fontSize: 12, marginTop: 2, marginBottom: 12, textAlign: "center" },
  registerButton: { height: 54, borderRadius: 16, backgroundColor: theme.accent, justifyContent: "center", alignItems: "center", marginTop: 10, marginBottom: 20, shadowColor: theme.shadowColor || theme.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: highContrast ? 0 : 0.18, shadowRadius: 8, elevation: highContrast ? 0 : 4 },
  registerButtonText: { color: theme.onAccent || "#FFFFFF", fontSize: 16, fontWeight: "800" },
  loginFooterContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap" },
  footerText: { color: theme.textSecondary, fontSize: 13 },
  footerLink: { color: theme.accent, fontSize: 13, fontWeight: "700", marginLeft: 6 },
  modalOverlay: { flex: 1, backgroundColor: theme.overlay || "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { width: "100%", maxWidth: 380, backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 26, padding: 24, shadowColor: theme.shadowColor || "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: highContrast ? 0 : 0.15, shadowRadius: 10, elevation: highContrast ? 0 : 10 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: theme.textPrimary, marginBottom: 16, textAlign: "center" },
  modalOption: { minHeight: 46, justifyContent: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.borderColor },
  modalOptionText: { fontSize: 15, color: theme.textPrimary, textAlign: "center" },
  modalEmpty: { color: theme.textSecondary, textAlign: "center", paddingVertical: 20 },
  loadingContainer: { alignItems: "center", paddingVertical: 30 },
  loadingText: { color: theme.textSecondary, marginTop: 12, fontSize: 14 },
});
