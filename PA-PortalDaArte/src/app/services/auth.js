import AsyncStorage from "@react-native-async-storage/async-storage";

export const salvarLogin = async (data) => {
  await AsyncStorage.setItem(
    "access_token",
    String(data.access_token)
  );

  await AsyncStorage.setItem(
    "refresh_token",
    String(data.refresh_token)
  );

  await AsyncStorage.setItem(
    "usuarioLogado",
    JSON.stringify(data.usuario)
  );
};

export const obterAccessToken = async () => {
  return await AsyncStorage.getItem("access_token");
};

export const obterRefreshToken = async () => {
  return await AsyncStorage.getItem("refresh_token");
};

export const obterUsuario = async () => {
  const usuario = await AsyncStorage.getItem("usuarioLogado");

  if (!usuario) {
    return null;
  }

  return JSON.parse(usuario);
};

export const limparLogin = async () => {
  await AsyncStorage.removeItem("access_token");
  await AsyncStorage.removeItem("refresh_token");
  await AsyncStorage.removeItem("usuarioLogado");
};