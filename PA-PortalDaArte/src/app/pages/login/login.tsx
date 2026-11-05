import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams, useNavigationContainerRef } from "expo-router";
import Head from "expo-router/head";
import { ArrowLeft, Lock, Mail } from "lucide-react-native";
import { salvarLogin } from "../../services/auth";
import { refreshSession } from "../../../components/context/AuthContext";
import { buildRegisterHref, DISCOVER_ROUTE, sanitizeRedirect } from "../../../constants/auth-routes";

const URL_API = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Respostas de validação (422) podem trazer uma lista em detail, não um texto.
function apiMessage(data: unknown, field: "detail" | "mensagem", fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const value = (data as Record<string, unknown>)[field];
  return typeof value === "string" && value.trim() ? value : fallback;
}

// Mantém a validação compatível com o limite do bcrypt também em Android/iOS.
function utf8ByteLength(value: string): number {
  return Array.from(value).reduce((total, character) => {
    const point = character.codePointAt(0) ?? 0;
    return total + (point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4);
  }, 0);
}

const INVALID_RESET_LINK = "Este link é inválido, expirou ou já foi usado. Solicite um novo link.";

export default function LoginScreen() {
  // Destino que o visitante queria abrir antes de ser mandado ao login (validado: só rotas internas).
  const params = useLocalSearchParams<{
    redirect?: string | string[];
    token?: string | string[];
  }>();
  const navigationRef = useNavigationContainerRef();
  const redirect = sanitizeRedirect(params.redirect);
  const hasIncomingToken = params.token !== undefined;
  const incomingToken = typeof params.token === "string" ? params.token : "";
  const validIncomingToken = /^[A-Za-z0-9_-]{43}$/.test(incomingToken);
  const incomingTokenKey = JSON.stringify(params.token);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loginMessage, setLoginMessage] = useState("");

  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  // O primeiro render deve coincidir com o HTML estatico; o efeito captura o token.
  const [isResetting, setIsResetting] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmittingRecovery, setIsSubmittingRecovery] = useState(false);
  const activeRecoveryRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!hasIncomingToken) return;

    // Um novo link pode chegar enquanto esta mesma tela continua montada.
    activeRecoveryRequest.current?.abort();
    activeRecoveryRequest.current = null;
    setIsSubmittingRecovery(false);
    setIsResetting(true);
    setIsRecovering(false);
    setResetToken(validIncomingToken ? incomingToken : "");
    setNewPassword("");
    setConfirmPassword("");
    setRecoveryEmail("");
    setRecoveryMessage("");
    setLoginMessage("");
    setError(validIncomingToken ? "" : INVALID_RESET_LINK);

  }, [hasIncomingToken, incomingToken, validIncomingToken]);

  useEffect(() => {
    if (!hasIncomingToken) return;

    let active = true;
    let cleared = false;
    const clearTokenWhenReady = () => {
      if (!active || cleared || !navigationRef.isReady()) return;

      // Um evento antigo não deve apagar um novo link antes de sua captura.
      const routeParams = navigationRef.getCurrentRoute()?.params as
        { token?: string | string[] } | undefined;
      if (JSON.stringify(routeParams?.token) !== incomingTokenKey) return;

      // setParams também emite eventos de navegação: marque antes de chamá-lo.
      cleared = true;
      router.setParams({ token: undefined });
    };

    // Na primeira montagem (e no StrictMode), os efeitos da tela podem executar
    // antes de o navegador raiz ficar pronto. Escute antes de verificar o ref.
    const removeReadyListener = navigationRef.addListener("ready", clearTokenWhenReady);
    const removeStateListener = navigationRef.addListener("state", clearTokenWhenReady);
    clearTokenWhenReady();

    return () => {
      active = false;
      removeReadyListener();
      removeStateListener();
    };
  }, [navigationRef, hasIncomingToken, incomingTokenKey]);

  useEffect(() => () => {
    activeRecoveryRequest.current?.abort();
    activeRecoveryRequest.current = null;
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Informe seu e-mail e sua senha para continuar.");
      return;
    }

    try {
      setError("");

      const response = await fetch(`${URL_API}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usuario: email.trim(),
          senha: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "E-mail ou senha incorretos.");
        return;
      }

      await salvarLogin(data);
      // Atualiza o estado de sessão antes de navegar, para o guard já enxergar o usuário logado.
      await refreshSession();
      router.replace((redirect ?? DISCOVER_ROUTE) as any);
    } catch (err) {
      console.log("Erro de conexão no login:", err);
      setError("Não foi possível conectar ao servidor. Verifique sua conexão.");
    }
  };

  const clearRecoveryRequest = () => {
    activeRecoveryRequest.current?.abort();
    activeRecoveryRequest.current = null;
    setIsSubmittingRecovery(false);
  };

  const openRecovery = () => {
    clearRecoveryRequest();
    setIsRecovering(true);
    setIsResetting(false);
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setRecoveryEmail(email);
    setRecoveryMessage("");
    setLoginMessage("");
    setError("");
  };

  const closeRecovery = () => {
    clearRecoveryRequest();
    setIsRecovering(false);
    setIsResetting(false);
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setRecoveryEmail("");
    setRecoveryMessage("");
    setError("");
  };

  const handleRecovery = async () => {
    if (activeRecoveryRequest.current) return;
    const normalizedEmail = recoveryEmail.trim();
    if (!normalizedEmail) {
      setError("Informe o e-mail usado no cadastro.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Informe um endereço de e-mail válido.");
      return;
    }

    const controller = new AbortController();
    activeRecoveryRequest.current = controller;
    setIsSubmittingRecovery(true);
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      setError("");
      const response = await fetch(`${URL_API}/api/recuperar-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
        signal: controller.signal,
        ...(Platform.OS === "web" ? { referrerPolicy: "no-referrer" as const } : {}),
      });
      const data: unknown = await response.json();
      if (activeRecoveryRequest.current !== controller) return;

      if (!response.ok) {
        setError(apiMessage(data, "detail", response.status === 422
          ? "Informe um endereço de e-mail válido."
          : "Não foi possível processar a recuperação. Tente novamente."));
        return;
      }

      setRecoveryMessage(apiMessage(data, "mensagem",
        "Se o e-mail informado estiver cadastrado, você receberá um link com as instruções para redefinir sua senha."
      ));
    } catch {
      if (activeRecoveryRequest.current === controller) {
        setError(controller.signal.aborted
          ? "O servidor demorou para responder. Tente novamente em instantes."
          : "Não foi possível conectar ao servidor. Verifique sua conexão.");
      }
    } finally {
      clearTimeout(timeout);
      if (activeRecoveryRequest.current === controller) {
        activeRecoveryRequest.current = null;
        setIsSubmittingRecovery(false);
      }
    }
  };

  const handleResetPassword = async () => {
    if (activeRecoveryRequest.current || !resetToken) return;
    if (!newPassword.trim() || Array.from(newPassword).length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (utf8ByteLength(newPassword) > 72) {
      setError("A senha está muito longa. Reduza o tamanho, especialmente se usar acentos ou emojis.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A confirmação deve ser igual à nova senha.");
      return;
    }

    const controller = new AbortController();
    activeRecoveryRequest.current = controller;
    setIsSubmittingRecovery(true);
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      setError("");
      const response = await fetch(`${URL_API}/api/redefinir-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, nova_senha: newPassword }),
        signal: controller.signal,
        ...(Platform.OS === "web" ? { referrerPolicy: "no-referrer" as const } : {}),
      });
      const data: unknown = await response.json();
      if (activeRecoveryRequest.current !== controller) return;

      if (!response.ok) {
        setError(apiMessage(data, "detail", response.status === 400
          ? INVALID_RESET_LINK
          : "Não foi possível redefinir a senha. Confira os dados e tente novamente."));
        if (response.status === 400) {
          setResetToken("");
          setNewPassword("");
          setConfirmPassword("");
        }
        return;
      }

      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setPassword("");
      setRecoveryEmail("");
      setRecoveryMessage("");
      setIsResetting(false);
      setIsRecovering(false);
      setLoginMessage(apiMessage(data, "mensagem", "Senha redefinida com sucesso. Entre com sua nova senha."));
    } catch {
      if (activeRecoveryRequest.current === controller) {
        setError(controller.signal.aborted
          ? "O servidor demorou para responder. Tente novamente em instantes."
          : "Não foi possível conectar ao servidor. Verifique sua conexão.");
      }
    } finally {
      clearTimeout(timeout);
      if (activeRecoveryRequest.current === controller) {
        activeRecoveryRequest.current = null;
        setIsSubmittingRecovery(false);
      }
    }
  };

  if (isResetting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Head><meta name="referrer" content="no-referrer" /></Head>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.circleTopLeft} />
          <View style={styles.circleTopRight} />
          <View style={styles.circleBottomRight} />

          <View style={styles.loginCard}>
            <TouchableOpacity onPress={closeRecovery} disabled={isSubmittingRecovery} style={styles.backButton}>
              <ArrowLeft size={18} color="#E15743" />
              <Text style={styles.backText}>Voltar para o login</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Redefinir senha</Text>
            <Text style={styles.subtitle}>
              Crie uma nova senha com pelo menos 8 caracteres para acessar sua conta.
            </Text>

            {resetToken ? (
              <>
                <Text style={styles.label}>Nova senha</Text>
                <View style={styles.passwordContainer}>
                  <Lock size={16} color="#9D8E85" style={styles.lockIcon} />
                  <TextInput
                    value={newPassword}
                    onChangeText={(value) => { setNewPassword(value); if (error) setError(""); }}
                    placeholder="••••••••"
                    placeholderTextColor="#9D8E85"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    accessibilityLabel="Nova senha"
                    editable={!isSubmittingRecovery}
                    style={styles.passwordInput as TextInputProps["style"]}
                  />
                </View>

                <Text style={styles.label}>Confirmar nova senha</Text>
                <View style={styles.passwordContainer}>
                  <Lock size={16} color="#9D8E85" style={styles.lockIcon} />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={(value) => { setConfirmPassword(value); if (error) setError(""); }}
                    placeholder="••••••••"
                    placeholderTextColor="#9D8E85"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    accessibilityLabel="Confirmar nova senha"
                    editable={!isSubmittingRecovery}
                    style={styles.passwordInput as TextInputProps["style"]}
                  />
                </View>
              </>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {resetToken ? (
              <TouchableOpacity
                style={styles.loginButton}
                activeOpacity={0.85}
                onPress={handleResetPassword}
                disabled={isSubmittingRecovery}
                accessibilityState={{ disabled: isSubmittingRecovery, busy: isSubmittingRecovery }}
              >
                <Text style={styles.loginButtonText}>
                  {isSubmittingRecovery ? "Salvando..." : "Redefinir senha"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.secondaryButton} onPress={openRecovery}>
                <Text style={styles.secondaryButtonText}>Solicitar novo link</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (isRecovering) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Head><meta name="referrer" content="no-referrer" /></Head>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.circleTopLeft} />
          <View style={styles.circleTopRight} />
          <View style={styles.circleBottomRight} />

          <View style={styles.loginCard}>
            <TouchableOpacity onPress={closeRecovery} disabled={isSubmittingRecovery} style={styles.backButton}>
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
                editable={!isSubmittingRecovery}
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
                disabled={isSubmittingRecovery}
                accessibilityState={{ disabled: isSubmittingRecovery, busy: isSubmittingRecovery }}
              >
                <Text style={styles.loginButtonText}>
                  {isSubmittingRecovery ? "Enviando..." : "Enviar link de recuperação"}
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
      <Head><meta name="referrer" content="no-referrer" /></Head>
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
          {loginMessage ? <Text style={styles.successText}>{loginMessage}</Text> : null}

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
              onPress={() => router.push(buildRegisterHref(redirect))}
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