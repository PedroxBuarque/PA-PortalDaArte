import React, { useEffect, useSyncExternalStore } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router as appRouter, useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { useTheme } from "./ThemeContext";
// Reaproveita o mecanismo de autenticação que já existe (tokens no AsyncStorage + /api/refresh).
import { limparLogin, obterAccessToken, obterRefreshToken } from "../../app/services/auth";
import { renovarAccessToken } from "../../app/services/api";
import { buildFullPath, buildLoginHref, isPrivateRoute, sanitizeRedirect } from "../../constants/auth-routes";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

// ---------------------------------------------------------------------------
// Estado da sessão
//
// Fica num store simples (lido com useSyncExternalStore) em vez de useState.
// Motivo: logo após o login o app faz router.replace(destino). Se o guard lesse
// um estado React ainda "atrasado", ele veria "visitante" por um instante e
// devolveria o usuário ao login. Com o store, todo render lê o valor mais novo.
// ---------------------------------------------------------------------------

let currentStatus: AuthStatus = "loading";
const listeners = new Set<() => void>();

const setStatus = (next: AuthStatus) => {
  if (next === currentStatus) return;
  currentStatus = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => currentStatus;
// No servidor (exportação estática) a sessão nunca é conhecida: nada privado é renderizado.
const getServerSnapshot = (): AuthStatus => "loading";

// ---------------------------------------------------------------------------
// Validação da sessão guardada
// ---------------------------------------------------------------------------

const EXPIRY_SKEW_MS = 30_000;

// Lê só a data de expiração do JWT para decidir se vale a pena renovar.
// Não é validação de segurança (isso é do backend): se não der para ler, assume válido.
const readExpiry = (token: string | null): number | null => {
  try {
    const payload = token?.split(".")[1];
    if (!payload || typeof atob !== "function") return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const exp = JSON.parse(atob(padded))?.exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
};

const isExpired = (token: string | null) => {
  const expiry = readExpiry(token);
  return expiry !== null && expiry <= Date.now() + EXPIRY_SKEW_MS;
};

let renewing: Promise<unknown> | null = null;
const renewOnce = () => {
  if (!renewing) {
    renewing = Promise.resolve(renovarAccessToken()).finally(() => {
      renewing = null;
    });
  }
  return renewing;
};

const resolveSession = async (): Promise<boolean> => {
  const [access, refresh] = await Promise.all([obterAccessToken(), obterRefreshToken()]);

  // Sem access_token = deslogado (é assim que o app já tratava o logout).
  // Se sobrou refresh_token de um logout antigo, descarta para não "religar" a sessão sozinho.
  if (!access) {
    if (refresh) await limparLogin();
    return false;
  }
  if (!isExpired(access)) return true;

  // Access token vencido: tenta renovar com o refresh token pelo mecanismo existente.
  if (refresh && !isExpired(refresh)) {
    try {
      await renewOnce();
      return true;
    } catch {
      // Se o servidor recusou, api.js já limpou o login. Se foi falha de rede,
      // as credenciais continuam guardadas e a próxima tentativa pode funcionar.
      return false;
    }
  }

  await limparLogin();
  return false;
};

let checkSequence = 0;

/**
 * Relê a sessão guardada e atualiza o estado global. Retorna se há sessão válida.
 * Só a chamada mais recente atualiza o estado, para uma checagem antiga e lenta
 * nunca sobrescrever um login que acabou de acontecer.
 */
export async function refreshSession(): Promise<boolean> {
  const mine = ++checkSequence;
  let valid = false;
  try {
    valid = await resolveSession();
  } catch (error) {
    console.log("Erro ao verificar a sessão:", error);
  }
  if (mine === checkSequence) setStatus(valid ? "authenticated" : "unauthenticated");
  return valid;
}

/** Encerra a sessão limpando TODAS as credenciais (access, refresh e usuário). */
export async function signOut(): Promise<void> {
  checkSequence++;
  await limparLogin();
  setStatus("unauthenticated");
}

// ---------------------------------------------------------------------------
// AuthModal: aviso para visitantes que tentam usar uma função de usuário logado
// ---------------------------------------------------------------------------

type AuthModalState = { visible: boolean; redirect: string | null };
const CLOSED_MODAL: AuthModalState = { visible: false, redirect: null };
let modalState: AuthModalState = CLOSED_MODAL;

const emit = () => listeners.forEach((listener) => listener());
const getModalSnapshot = () => modalState;
const getModalServerSnapshot = () => CLOSED_MODAL;

/** Abre o AuthModal guardando para onde o visitante queria ir (retomado após login/cadastro). */
export function openAuthModal(redirect?: string | null) {
  modalState = { visible: true, redirect: sanitizeRedirect(redirect) };
  emit();
}

export function closeAuthModal() {
  if (!modalState.visible) return;
  modalState = { ...modalState, visible: false };
  emit();
}

export function useAuthModal() {
  return useSyncExternalStore(subscribe, getModalSnapshot, getModalServerSnapshot);
}

/**
 * Protege uma ação pontual. Com sessão válida executa `callback`. Sem sessão guarda `redirect`
 * (a rota que o visitante queria abrir) e, conforme `mode`:
 *   - "modal": abre o AuthModal (padrão);
 *   - "login": leva direto à tela de login (usado nos cards de Descobrir).
 * Retorna se a ação foi executada.
 *
 *   requireAuth(() => router.push(perfil), "/pages/perfil_publico/perfil_publico?id=3", "login");
 */
export async function requireAuth(
  callback?: () => void | Promise<void>,
  redirect?: string | null,
  mode: "modal" | "login" = "modal",
): Promise<boolean> {
  // Toques repetidos enquanto a primeira checagem roda não podem empilhar telas de login.
  if (authActionInFlight) return false;
  authActionInFlight = true;
  try {
    if (await refreshSession()) {
      await callback?.();
      return true;
    }
    if (mode === "login") appRouter.push(buildLoginHref(redirect));
    else openAuthModal(redirect);
    return false;
  } finally {
    authActionInFlight = false;
  }
}

let authActionInFlight = false;

export function useAuth() {
  const status = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    status,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    refreshSession,
    requireAuth,
    openAuthModal,
    closeAuthModal,
    signOut,
  };
}

/** Descobre a sessão ao abrir o app. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void refreshSession();
  }, []);
  return <>{children}</>;
}

function AuthLoading() {
  const { theme } = useTheme();
  return (
    <View style={[styles.loading, { backgroundColor: theme.mainBg }]}>
      <ActivityIndicator size="large" color={theme.accent} />
    </View>
  );
}

/**
 * Proteção de rotas. Fica acima do <Slot /> e olha a URL atual, então vale para
 * qualquer entrada (menu, link, digitar a URL, botão voltar), não só para o menu.
 *
 * - rota pública (Descobrir, login, cadastro): renderiza sempre, sem esperar nada;
 * - rota privada e sessão ainda sendo verificada: tela de carregamento (nada privado aparece);
 * - rota privada sem sessão: vai ao login guardando o destino em ?redirect=.
 *   O login é público, então não existe laço de redirecionamento.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<Record<string, string | string[]>>();
  const privateRoute = isPrivateRoute(pathname);
  const mustLogin = privateRoute && status === "unauthenticated";
  // Destino que o visitante tentou abrir (caminho + query), guardado em ?redirect= no login.
  const destination = buildFullPath(pathname, params);

  // Revalida a cada navegação (é só uma leitura do storage). Pega, por exemplo,
  // uma sessão que expirou ou foi encerrada em outra aba.
  useEffect(() => {
    void refreshSession();
  }, [pathname]);

  useEffect(() => {
    if (mustLogin) router.replace(buildLoginHref(destination));
  }, [mustLogin, destination]);

  if (!privateRoute) return <>{children}</>;
  // Enquanto a sessão é verificada (ou o redirecionamento acontece) nada privado é renderizado.
  if (status !== "authenticated") return <AuthLoading />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
