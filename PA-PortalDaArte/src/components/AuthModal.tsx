import React, { useEffect } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useTheme } from "./context/ThemeContext";
import { closeAuthModal, useAuthModal } from "./context/AuthContext";
import { buildLoginHref, buildRegisterHref } from "../constants/auth-routes";

export const AUTH_MODAL_MESSAGE =
  "Crie uma conta ou faça login no Portal da Arte para visualizar perfis completos, enviar mensagens e contratar artistas.";

/**
 * Modal global exibido quando um visitante tenta usar algo que exige conta (ver perfil completo,
 * favoritar, mensagens...). Montado uma única vez no _layout. Abra com requireAuth()/openAuthModal().
 * "Entrar" e "Criar conta" levam junto o destino pretendido (?redirect=) para retomar depois.
 */
export default function AuthModal() {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { visible, redirect } = useAuthModal();
  const styles = getStyles(theme);

  // Qualquer navegação fecha o modal (voltar, trocar de tela...).
  useEffect(() => {
    closeAuthModal();
  }, [pathname]);

  const go = (href: any) => {
    closeAuthModal();
    router.push(href);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeAuthModal}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={closeAuthModal}
        accessibilityLabel="Fechar aviso"
      >
        {/* O toque dentro do cartão não fecha o modal */}
        <TouchableOpacity activeOpacity={1} style={styles.card} testID="auth-modal-card" accessibilityViewIsModal>
          <Text style={styles.title}>Entre no Portal da Arte</Text>
          <Text style={styles.message}>{AUTH_MODAL_MESSAGE}</Text>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            testID="auth-modal-login"
            onPress={() => go(buildLoginHref(redirect))}
          >
            <Text style={styles.primaryText}>Entrar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.85}
            testID="auth-modal-register"
            onPress={() => go(buildRegisterHref(redirect))}
          >
            <Text style={styles.secondaryText}>Criar conta</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismiss} onPress={closeAuthModal} testID="auth-modal-close">
            <Text style={styles.dismissText}>Agora não</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: theme.cardBg,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.borderColor,
      padding: 28,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 22,
      fontWeight: "900",
      fontFamily: "serif",
      textAlign: "center",
      marginBottom: 10,
    },
    message: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
      marginBottom: 24,
    },
    primaryButton: {
      backgroundColor: theme.accent,
      borderRadius: 30,
      paddingVertical: 13,
      alignItems: "center",
      marginBottom: 10,
    },
    primaryText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 15 },
    secondaryButton: {
      borderWidth: 1.5,
      borderColor: theme.accent,
      borderRadius: 30,
      paddingVertical: 12,
      alignItems: "center",
    },
    secondaryText: { color: theme.accent, fontWeight: "bold", fontSize: 15 },
    dismiss: { alignItems: "center", paddingTop: 16 },
    dismissText: { color: theme.textSecondary, fontSize: 13 },
  });
