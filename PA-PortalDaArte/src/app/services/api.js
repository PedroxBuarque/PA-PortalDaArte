import AsyncStorage from "@react-native-async-storage/async-storage";

// ============================================================
// CONFIGURAÇÃO VIA .ENV
// ============================================================

const URL_API = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ============================================================
// RENOVAR ACCESS TOKEN
// ============================================================

export const renovarAccessToken = async () => {
  try {
    const refreshToken = await AsyncStorage.getItem("refresh_token");

    if (!refreshToken) {
      throw new Error("Refresh token não encontrado.");
    }

    console.log("Tentando renovar access token...");

    const resposta = await fetch(
      `${URL_API}/api/refresh`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      }
    );

    const data = await resposta.json();

    // ========================================================
    // REFRESH TOKEN INVÁLIDO OU EXPIRADO
    // ========================================================

    if (!resposta.ok) {
      console.log("Refresh token inválido ou expirado.");

      await AsyncStorage.removeItem("access_token");
      await AsyncStorage.removeItem("refresh_token");
      await AsyncStorage.removeItem("usuarioLogado");

      throw new Error(
        data.detail || "Sessão expirada."
      );
    }

    if (!data.access_token) {
      throw new Error("A API não retornou um novo access token.");
    }

    // ========================================================
    // SALVAR NOVO ACCESS TOKEN
    // ========================================================

    await AsyncStorage.setItem(
      "access_token",
      String(data.access_token)
    );

    console.log("Novo access token salvo.");

    return data.access_token;

  } catch (error) {
    console.log("Erro ao renovar access token:", error);
    throw error;
  }
};

// ============================================================
// FAZER REQUISIÇÃO AUTENTICADA
// ============================================================

export const apiFetch = async (
  endpoint,
  options = {}
) => {
  let accessToken = await AsyncStorage.getItem("access_token");

  if (!accessToken) {
    throw new Error("Usuário não autenticado.");
  }

  const url = endpoint.startsWith("http") ? endpoint : `${URL_API}${endpoint}`;

  // ==========================================================
  // PRIMEIRA TENTATIVA
  // ==========================================================

  let resposta = await fetch(
    url,
    {
      ...options,
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  // ==========================================================
  // ACCESS TOKEN EXPIROU (401)
  // ==========================================================

  if (resposta.status === 401) {
    console.log("Access token expirado. Tentando renovar...");

    try {
      accessToken = await renovarAccessToken();

      // ========================================================
      // TENTAR NOVAMENTE COM O NOVO TOKEN
      // ========================================================

      resposta = await fetch(
        url,
        {
          ...options,
          headers: {
            ...options.headers,
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
    } catch (refreshError) {
      throw refreshError;
    }
  }

  return resposta;
};

// ============================================================
// LOGOUT
// ============================================================

export const logout = async () => {
  await AsyncStorage.removeItem("access_token");
  await AsyncStorage.removeItem("refresh_token");
  await AsyncStorage.removeItem("usuarioLogado");

  console.log("Usuário deslogado.");
};