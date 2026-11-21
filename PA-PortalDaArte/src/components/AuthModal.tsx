import React, { useEffect } from "react";
import { Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useTheme } from "./context/ThemeContext";
import { closeAuthModal, useAuthModal } from "./context/AuthContext";
import { buildLoginHref, buildRegisterHref } from "../constants/auth-routes";
import BrandMark from "./BrandMark";

import { VLibrasText as Text } from './accessibility/VLibrasText';
export const AUTH_MODAL_MESSAGE =
  "Crie uma conta ou faça login no Portal da Arte para visualizar perfis completos, enviar mensagens e contratar artistas.";

/**
 * Modal global exibido quando um visitante tenta usar algo que exige conta (ver perfil completo,
 * favoritar, mensagens...). Montado uma única vez no _layout. Abra com requireAuth()/openAuthModal().
 * "Entrar" e "Criar conta" levam junto o destino pretendido (?redirect=) para retomar depois.
 */
export default function AuthModal() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  const { visible, redirect } = useAuthModal();
  const styles = getStyles(theme, width < 420);

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
        accessibilityRole="button"
        accessibilityLabel="Fechar aviso"
        accessibilityHint="Fecha este aviso sem entrar ou criar uma conta"
      >
        {/* O toque dentro do cartão não fecha o modal */}
        <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity activeOpacity={1} style={styles.card} testID="auth-modal-card" accessibilityViewIsModal>
          <View style={styles.brandWrap} accessible={false}><BrandMark showTagline={false} /></View>
          <Text style={styles.eyebrow}>CONTINUE SUA EXPERIÊNCIA</Text>
          <Text style={styles.title} accessibilityRole="header">Sua próxima conexão começa aqui.</Text>
          <Text style={styles.message}>{AUTH_MODAL_MESSAGE}</Text>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            testID="auth-modal-login"
            onPress={() => go(buildLoginHref(redirect))}
            accessibilityRole="button"
            accessibilityLabel="Entrar na conta"
          >
            <Text style={styles.primaryText}>Entrar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.85}
            testID="auth-modal-register"
            onPress={() => go(buildRegisterHref(redirect))}
            accessibilityRole="button"
            accessibilityLabel="Criar uma conta"
          >
            <Text style={styles.secondaryText}>Criar conta</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismiss} onPress={closeAuthModal} testID="auth-modal-close" accessibilityRole="button" accessibilityLabel="Agora não">
            <Text style={styles.dismissText}>Agora não</Text>
          </TouchableOpacity>
        </TouchableOpacity>
        </ScrollView>
      </TouchableOpacity>
    </Modal>
  );
}

const getStyles = (theme: any, smallPhone: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.overlay || "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modalScroll: { width: "100%", maxHeight: "92%" },
    modalScrollContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: 12 },
    card: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: theme.cardBg,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.borderColor,
      padding: smallPhone ? 18 : 30,
      borderTopWidth: 4,
      borderTopColor: theme.accent,
      ...Platform.select({ web: { boxShadow: `0 24px 60px ${theme.shadowStrong || theme.shadowColor}` } }),
    },
    brandWrap: { alignItems: "center", marginBottom: 18 },
    eyebrow: { color: theme.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1.5, textAlign: "center", marginBottom: 6 },
    title: {
      color: theme.textPrimary,
      fontSize: smallPhone ? 21 : 25,
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
      borderRadius: 16,
      paddingVertical: 13,
      alignItems: "center",
      marginBottom: 10,
    },
    primaryText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 15 },
    secondaryButton: {
      borderWidth: 1.5,
      borderColor: theme.accent,
      borderRadius: 16,
      paddingVertical: 12,
      alignItems: "center",
    },
    secondaryText: { color: theme.accent, fontWeight: "bold", fontSize: 15 },
    dismiss: { alignItems: "center", paddingTop: 16 },
    dismissText: { color: theme.textSecondary, fontSize: 13 },
  });
