import { router } from "expo-router";
import { ArrowLeft, Lock, Mail } from "lucide-react-native";
import React, { useState } from "react";
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
import { useProfile } from "../../../components/context/ProfileContext";

export default function LoginScreen() {
  const { email: registeredEmail, password: registeredPassword } = useProfile();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      setError("Informe seu e-mail e sua senha para continuar.");
      return;
    }

    if (
      registeredEmail &&
      email.trim().toLowerCase() !== registeredEmail.toLowerCase()
    ) {
      setError("E-mail não encontrado. Verifique os dados ou cadastre-se.");
      return;
    }

    if (registeredPassword && password !== registeredPassword) {
      setError("Senha incorreta. Se precisar, use “Esqueceu a senha?”.");
      return;
    }

    setError("");
    router.replace("/pages/explorar/explorar");
  };

  const openRecovery = () => {
    setIsRecovering(true);
    setRecoveryEmail(email);
    setRecoveryMessage("");
    setError("");
  };

  const closeRecovery = () => {
    setIsRecovering(false);
    setRecoveryEmail("");
    setRecoveryMessage("");
    setError("");
  };

  const handleRecovery = () => {
    if (!recoveryEmail.trim()) {
      setError("Informe o e-mail usado no cadastro.");
      return;
    }

    setError("");
    setRecoveryMessage(
      "Se o e-mail informado estiver cadastrado, você receberá um link com as instruções para redefinir sua senha.",
    );
  };

  if (isRecovering) {
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
            <TouchableOpacity onPress={closeRecovery} style={styles.backButton}>
              <ArrowLeft size={18} color="#E15743" />
              <Text style={styles.backText}>Voltar para o login</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Recuperar senha</Text>
            <Text style={styles.subtitle}>
              Informe o e-mail cadastrado e enviaremos um link para você acessar
              sua conta novamente.
            </Text>

            <Text style={styles.label}>E-mail</Text>
            <View style={styles.iconInputContainer}>
              <Mail size={16} color="#9D8E85" style={styles.inputIcon} />
              <TextInput
                value={recoveryEmail}
                onChangeText={(value) => {
                  setRecoveryEmail(value);
                  if (error) setError("");
                  if (recoveryMessage) setRecoveryMessage("");
                }}
                placeholder="nome@email.com"
                placeholderTextColor="#9D8E85"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.iconInput}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {recoveryMessage ? (
              <Text style={styles.successText}>{recoveryMessage}</Text>
            ) : null}

            {!recoveryMessage && (
              <TouchableOpacity
                style={styles.loginButton}
                activeOpacity={0.85}
                onPress={handleRecovery}
              >
                <Text style={styles.loginButtonText}>
                  Enviar link de recuperação
                </Text>
              </TouchableOpacity>
            )}

            {recoveryMessage ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={closeRecovery}
              >
                <Text style={styles.secondaryButtonText}>
                  Voltar para entrar
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.title}>Entrar no Portal da Arte</Text>
          <Text style={styles.subtitle}>
            Acesse sua conta para gerenciar contratações, mensagens e{"\n"}
            seu perfil.
          </Text>

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

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.forgotButton}
            activeOpacity={0.7}
            onPress={openRecovery}
          >
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
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/pages/cadastro/cadastro" as any)}
            >
              <Text style={styles.registerLink}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF1E6" },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF1E6",
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
  loginCard: {
    width: "100%",
    maxWidth: 440,
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
    marginBottom: 20,
    ...Platform.select({ web: { outlineStyle: "none" } }),
  },
  iconInputContainer: {
    height: 50,
    borderWidth: 1,
    borderColor: "#F0E3DA",
    borderRadius: 12,
    backgroundColor: "#FFFBF8",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  inputIcon: { marginRight: 10 },
  iconInput: {
    flex: 1,
    height: 48,
    color: "#3D261D",
    fontSize: 14,
    paddingVertical: 0,
    ...Platform.select({ web: { outlineStyle: "none" } }),
  },
  passwordContainer: {
    height: 50,
    borderWidth: 1,
    borderColor: "#F0E3DA",
    borderRadius: 12,
    backgroundColor: "#FFFBF8",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 20,
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
    marginTop: -4,
    marginBottom: 12,
  },
  successText: {
    color: "#3E8E5B",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
    textAlign: "center",
  },
  forgotButton: { alignSelf: "flex-end", marginTop: 0, marginBottom: 24 },
  forgotText: { color: "#E15743", fontSize: 13, fontWeight: "600" },
  loginButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#E15743",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#E15743",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E15743",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  secondaryButtonText: { color: "#E15743", fontSize: 16, fontWeight: "700" },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    alignSelf: "flex-start",
  },
  backText: {
    color: "#E15743",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  registerText: { color: "#8C7A70", fontSize: 13 },
  registerLink: {
    color: "#E15743",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
  },
});
