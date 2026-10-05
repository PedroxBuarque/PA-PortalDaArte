import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen() {
  const [isArtist, setIsArtist] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const passwordStrength = useMemo(() => {
    if (!password) return { level: 0, text: "" };

    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[a-záàâãéêíóôõúüç]/u.test(password)) score++;
    if (/[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]/u.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-ZÀ-ÿ0-9]/u.test(password)) score++;

    if (score <= 2) return { level: 1, text: "Fraca" };
    if (score <= 4) return { level: 2, text: "Média" };
    return { level: 3, text: "Forte" };
  }, [password]);

  const handleArtistToggle = () => {
    setIsArtist(true);
    setIsClient(false);
  };

  const handleClientToggle = () => {
    setIsClient(true);
    setIsArtist(false);
  };

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      setError("Preencha seu e-mail e sua senha para continuar.");
      return;
    }

    setError("");

    // A autenticação real será conectada ao backend depois.
    // Por enquanto, o login leva o usuário para a área principal do Portal.
    router.replace("/pages/explorar/explorar");
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

        <View style={styles.loginCard}>
          <View style={styles.logoBox}>
            <Text style={styles.logoSymbol}>●</Text>
          </View>

          <Text style={styles.title}>Entrar no Portal da Arte</Text>

          <Text style={styles.subtitle}>
            Acesse sua conta para gerenciar contratações, mensagens e{"\n"}
            seu perfil
          </Text>

          <Text style={styles.question}>Quem você é?</Text>

          <View style={styles.userTypes}>
            <TouchableOpacity
              style={styles.userType}
              activeOpacity={0.8}
              onPress={handleArtistToggle}
            >
              <View style={styles.userTypeTextContainer}>
                <Text style={styles.userTypeTitle}>Artista</Text>
                <Text style={styles.userTypeDescription}>
                  Agenda, propostas e
                </Text>
                <Text style={styles.userTypeDescription}>contratações</Text>
              </View>

              <View style={[styles.toggle, isArtist && styles.toggleActive]}>
                <View
                  style={[
                    styles.toggleCircle,
                    isArtist && styles.toggleCircleActive,
                  ]}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.userType}
              activeOpacity={0.8}
              onPress={handleClientToggle}
            >
              <View style={styles.userTypeTextContainer}>
                <Text style={styles.userTypeTitle}>Cliente</Text>
                <Text style={styles.userTypeDescription}>
                  Busca, favoritos e
                </Text>
                <Text style={styles.userTypeDescription}>contratações</Text>
              </View>

              <View style={[styles.toggle, isClient && styles.toggleActive]}>
                <View
                  style={[
                    styles.toggleCircle,
                    isClient && styles.toggleCircleActive,
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>

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

          <View style={styles.passwordLabelRow}>
            <Text style={styles.label}>Senha</Text>
          </View>

          <View style={styles.passwordContainer}>
            <Text style={styles.lockSymbol}>♧</Text>

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

          {password.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBars}>
                <View
                  style={[
                    styles.strengthBar,
                    passwordStrength.level >= 1 && styles.strengthBarActive,
                  ]}
                />
                <View
                  style={[
                    styles.strengthBar,
                    passwordStrength.level >= 2 && styles.strengthBarActive,
                  ]}
                />
                <View
                  style={[
                    styles.strengthBar,
                    passwordStrength.level >= 3 && styles.strengthBarActive,
                  ]}
                />
              </View>

              <Text style={styles.strengthText}>{passwordStrength.text}</Text>
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.forgotButton} activeOpacity={0.7}>
            <Text style={styles.forgotText}>Esqueceu a senha?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            activeOpacity={0.85}
            onPress={handleLogin}
          >
            <Text style={styles.loginButtonText}>Entrar</Text>
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Não tem conta?</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.registerLink}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF1E6",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF1E6",
    padding: 20,
    ...Platform.select({
      web: {
        minHeight: "100vh",
        overflow: "hidden",
      },
    }),
  },
  circleTopLeft: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#FFE9D2",
    top: -80,
    left: -70,
  },
  circleTopRight: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#F9DDD0",
    top: 20,
    right: -50,
  },
  circleBottomRight: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#F9DDD0",
    bottom: -80,
    right: -70,
  },
  loginCard: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingTop: 28,
    paddingBottom: 26,
    paddingHorizontal: 24,
    shadowColor: "#6D4D3E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#FFF6EF",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  logoSymbol: {
    fontSize: 14,
    color: "#E15743",
  },
  title: {
    color: "#493027",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    color: "#95857B",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    marginBottom: 18,
  },
  question: {
    color: "#493027",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  userTypes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  userType: {
    flex: 1,
    minHeight: 60,
    borderWidth: 1,
    borderColor: "#F0E3DA",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF9F5",
  },
  userTypeTextContainer: {
    flex: 1,
  },
  userTypeTitle: {
    color: "#493027",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  userTypeDescription: {
    color: "#9A8980",
    fontSize: 10,
    lineHeight: 13,
  },
  toggle: {
    width: 34,
    height: 18,
    borderRadius: 10,
    backgroundColor: "#E6DDD7",
    justifyContent: "center",
    paddingHorizontal: 2,
    marginLeft: 6,
  },
  toggleActive: {
    backgroundColor: "#E15743",
  },
  toggleCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
  },
  toggleCircleActive: {
    alignSelf: "flex-end",
  },
  label: {
    color: "#493027",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#F0E3DA",
    borderRadius: 10,
    backgroundColor: "#FFF9F5",
    paddingHorizontal: 12,
    color: "#493027",
    fontSize: 13,
    marginBottom: 14,
    ...Platform.select({ web: { outlineStyle: "none" } }),
  },
  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  passwordContainer: {
    height: 44,
    borderWidth: 1,
    borderColor: "#F0E3DA",
    borderRadius: 10,
    backgroundColor: "#FFF9F5",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
  },
  lockSymbol: {
    color: "#88766D",
    fontSize: 14,
    marginRight: 8,
  },
  passwordInput: {
    flex: 1,
    height: 42,
    color: "#493027",
    fontSize: 13,
    paddingVertical: 0,
    paddingHorizontal: 0,
    ...Platform.select({ web: { outlineStyle: "none" } }),
  },
  strengthContainer: {
    height: 18,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  strengthBars: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
    marginRight: 8,
  },
  strengthBar: {
    height: 4,
    flex: 1,
    borderRadius: 2,
    backgroundColor: "#EDE4DE",
  },
  strengthBarActive: {
    backgroundColor: "#E15743",
  },
  strengthText: {
    color: "#9A8980",
    fontSize: 10,
    width: 35,
  },
  errorText: {
    color: "#C53B2C",
    fontSize: 11,
    marginTop: 4,
    marginBottom: 4,
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginTop: 6,
    marginBottom: 16,
  },
  forgotText: {
    color: "#E15743",
    fontSize: 12,
    fontWeight: "600",
  },
  loginButton: {
    height: 46,
    borderRadius: 10,
    backgroundColor: "#E15743",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  registerText: {
    color: "#A2938B",
    fontSize: 12,
  },
  registerLink: {
    color: "#E15743",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
  },
});
