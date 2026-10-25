// Definição central de quais rotas exigem autenticação.
//
// Regra: tudo que estiver em /pages/ é PRIVADO, exceto o que estiver na lista
// pública abaixo (negar por padrão). Assim, uma página nova nunca fica aberta
// por esquecimento. Hoje as rotas privadas são:
//   /pages/favoritos/favoritos
//   /pages/contratacoes/contratacoes
//   /pages/mensagens/mensagens
//   /pages/perfil/perfil
//   /pages/perfil_publico/perfil_publico   (perfil completo do artista)
//
// Este arquivo fica fora de src/app/ de propósito: tudo dentro de src/app/
// vira rota no Expo Router.

export const LOGIN_ROUTE = "/pages/login/login";
export const REGISTER_ROUTE = "/pages/cadastro/cadastro";
// "Descobrir": o caminho do arquivo foi preservado (explorar) para não quebrar links.
export const DISCOVER_ROUTE = "/pages/explorar/explorar";
export const ARTIST_PROFILE_ROUTE = "/pages/perfil_publico/perfil_publico";
export const FAVORITES_ROUTE = "/pages/favoritos/favoritos";

const PUBLIC_ROUTES = new Set<string>([
  "/",
  "/index",
  DISCOVER_ROUTE,
  LOGIN_ROUTE,
  REGISTER_ROUTE,
]);

/** Remove query/hash/.html/barra final e padroniza caixa, para comparar rotas com segurança. */
export function normalizePath(path: string): string {
  const withoutQuery = String(path ?? "").split(/[?#]/)[0];
  let normalized = withoutQuery.replace(/\.html$/i, "").replace(/\/+$/, "");
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  return normalized.toLowerCase();
}

export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.has(normalizePath(path));
}

/** Rota privada = qualquer tela de /pages/ que não esteja na lista pública. */
export function isPrivateRoute(path: string): boolean {
  const normalized = normalizePath(path);
  if (PUBLIC_ROUTES.has(normalized)) return false;
  return normalized === "/pages" || normalized.startsWith("/pages/");
}

const first = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

/**
 * Valida o destino guardado para retomar após o login.
 * Só aceita caminhos internos de /pages/ (evita redirecionamento para sites externos)
 * e recusa login/cadastro (evita laço de redirecionamento).
 * Retorna null quando o valor não é seguro.
 */
export function sanitizeRedirect(value: unknown): string | null {
  const raw = first(value);
  if (typeof raw !== "string") return null;
  const target = raw.trim();
  if (!target || target.length > 2000) return null;
  if (!target.startsWith("/") || target.startsWith("//")) return null;
  if (target.includes("\\") || /[\u0000-\u001f\u007f]/.test(target)) return null;

  const path = normalizePath(target);
  if (!path.startsWith("/pages/")) return null;
  if (path === normalizePath(LOGIN_ROUTE) || path === normalizePath(REGISTER_ROUTE)) return null;
  return target;
}

/** Monta "caminho?query" a partir do pathname atual e dos parâmetros da rota. */
export function buildFullPath(
  pathname: string,
  params?: Record<string, string | string[] | undefined>,
): string {
  const search = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined) return;
    (Array.isArray(value) ? value : [value]).forEach((item) => search.append(key, String(item)));
  });
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Destino para enviar o visitante ao login guardando para onde ele queria ir. */
export function buildLoginHref(destination?: unknown): any {
  const redirect = sanitizeRedirect(destination);
  return redirect
    ? { pathname: LOGIN_ROUTE, params: { redirect } }
    : { pathname: LOGIN_ROUTE };
}

/** Mesmo que buildLoginHref, mas para o cadastro (o destino atravessa cadastro → login). */
export function buildRegisterHref(destination?: unknown): any {
  const redirect = sanitizeRedirect(destination);
  return redirect
    ? { pathname: REGISTER_ROUTE, params: { redirect } }
    : { pathname: REGISTER_ROUTE };
}
