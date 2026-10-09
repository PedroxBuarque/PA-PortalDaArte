import { router } from "expo-router";
import { useProfile } from "../../../components/context/ProfileContext";
import { Lock } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const DOC_TYPES = ["CPF", "CNPJ", "MEI"];

export default function RegisterScreen() {
  const { saveRegistration } = useProfile();

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
          "https://servicodados.ibge.gov.br/api/v1/localidades/estados",
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
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
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

  const handleRegister = () => {
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
    if (docType === "CPF" && rawDoc.length < 11)
      return setError("CPF inválido.");
    if ((docType === "CNPJ" || docType === "MEI") && rawDoc.length < 14)
      return setError(`${docType} inválido.`);

    setError("");

    saveRegistration({
      email,
      fullName,
      password,
      docType,
      docNumber,
      state,
      city,
    });

    router.replace("/pages/login/login");
  };

  const renderPickerModal = (
    type: "docType" | "state" | "city",
    data: string[],
    title: string,
    onSelect: (val: string) => void,
    isLoading?: boolean,
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
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{title}</Text>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#E15743" />
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
                  placeholderTextColor="#9D8E85"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
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
                  placeholderTextColor="#9D8E85"
                  autoCapitalize="words"
                  style={styles.input}
                />
              </View>
            </View>

            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordContainer}>
              <Lock size={16} color="#9D8E85" style={styles.lockIcon} />
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (error) setError("");
                }}
                placeholder="••••••••"
                placeholderTextColor="#9D8E85"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.passwordInput}
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={styles.halfInputBox}>
                <Text style={styles.label}>Tipo de documento</Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  activeOpacity={0.7}
                  onPress={() => setActivePicker("docType")}
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
                  placeholderTextColor="#9D8E85"
                  keyboardType="numeric"
                  editable={!!docType}
                  style={[
                    styles.input,
                    !docType && { backgroundColor: "#F9F1EC" },
                  ]}
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
                    !state && { backgroundColor: "#F9F1EC" },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (!state) {
                      setError("Selecione o estado primeiro.");
                    } else {
                      setActivePicker("city");
                    }
                  }}
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
            >
              <Text style={styles.registerButtonText}>Cadastrar</Text>
            </TouchableOpacity>

            <View style={styles.loginFooterContainer}>
              <Text style={styles.footerText}>Já tem conta?</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push("/pages/login/login" as any)}
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
          isLoadingCidades,
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF1E6" },
  container: {
    flex: 1,
    backgroundColor: "#FFF1E6",
    ...Platform.select({ web: { minHeight: "100vh", overflow: "hidden" } }),
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  circleTopLeft: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#FFE9D2",
    top: -100,
    left: -80,
  },
  circleTopRight: {
    position: "absolute",
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: "#F9DDD0",
    top: -40,
    right: -60,
  },
  circleBottomRight: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#F9DDD0",
    bottom: -100,
    right: -80,
  },
  registerCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingTop: 40,
    paddingBottom: 36,
    paddingHorizontal: 36,
    shadowColor: "#6D4D3E",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 8,
    zIndex: 10,
  },
  title: {
    color: "#3D261D",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    fontFamily: "serif",
    marginBottom: 10,
  },
  subtitle: {
    color: "#8C7A70",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 28,
  },
  rowInputs: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  halfInputBox: { flex: 1 },
  label: { color: "#3D261D", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#F0E3DA",
    borderRadius: 12,
    backgroundColor: "#FFFBF8",
    paddingHorizontal: 16,
    color: "#3D261D",
    fontSize: 14,
    marginBottom: 16,
    ...Platform.select({ web: { outlineStyle: "none" } }),
  },

  selectInput: {
    height: 50,
    borderWidth: 1,
    borderColor: "#F0E3DA",
    borderRadius: 12,
    backgroundColor: "#FFFBF8",
    paddingHorizontal: 16,
    justifyContent: "center",
    marginBottom: 16,
  },
  placeholderText: { color: "#9D8E85", fontSize: 14 },
  selectText: { color: "#3D261D", fontSize: 14 },

  passwordContainer: {
    height: 50,
    borderWidth: 1,
    borderColor: "#F0E3DA",
    borderRadius: 12,
    backgroundColor: "#FFFBF8",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  lockIcon: { marginRight: 10 },
  passwordInput: {
    flex: 1,
    height: 48,
    color: "#3D261D",
    fontSize: 14,
    paddingVertical: 0,
    paddingHorizontal: 0,
    ...Platform.select({ web: { outlineStyle: "none" } }),
  },
  errorText: {
    color: "#C53B2C",
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
    textAlign: "center",
  },
  registerButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#E15743",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
    shadowColor: "#E15743",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  loginFooterContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: { color: "#8C7A70", fontSize: 13 },
  footerLink: {
    color: "#E15743",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 350,
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3D261D",
    marginBottom: 16,
    textAlign: "center",
  },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0E3DA",
  },
  modalOptionText: { fontSize: 15, color: "#3D261D", textAlign: "center" },
  modalEmpty: { color: "#9D8E85", textAlign: "center", paddingVertical: 20 },
  loadingContainer: { alignItems: "center", paddingVertical: 30 },
  loadingText: { color: "#9D8E85", marginTop: 12, fontSize: 14 },
});
