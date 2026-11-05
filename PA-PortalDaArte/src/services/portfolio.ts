import { Alert, Linking, Platform } from "react-native";
import type { DocumentPickerAsset } from "expo-document-picker";

const URL_API = (process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

// Validação de conveniência no dispositivo; a API valida novamente os bytes.
export const PORTFOLIO_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const PORTFOLIO_MAX_COVER_BYTES = 10 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  pdf: "application/pdf",
};
export const PORTFOLIO_PICKER_TYPES = [...new Set(Object.values(MIME_BY_EXTENSION))];
export const PORTFOLIO_VIDEO_TYPES = PORTFOLIO_PICKER_TYPES.filter((mime) => mime.startsWith("video/"));
export const PORTFOLIO_COVER_TYPES = PORTFOLIO_PICKER_TYPES.filter((mime) => mime.startsWith("image/"));

export type PortfolioApiItem = {
  id: number | string;
  portfolio_id?: number | string;
  item_id?: number | string;
  titulo?: string;
  descricao?: string;
  tipo?: string;
  midia_url?: string;
  arquivo_nome?: string | null;
  arquivo_mime?: string | null;
  arquivo_tamanho?: number | null;
  secao?: "portfolio" | "video";
  capa_url?: string | null;
};

export type PortfolioFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

export function portfolioNotice(title: string, message: string) {
  // Alert.alert não exibe avisos no React Native Web.
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export function portfolioApiError(payload: { detail?: unknown } | null, fallback: string): string {
  return typeof payload?.detail === "string" ? payload.detail : fallback;
}

function validateSize(size: number | undefined, maximumBytes = PORTFOLIO_MAX_FILE_BYTES) {
  if (size === 0) throw new Error("O arquivo selecionado está vazio.");
  if (typeof size === "number" && size > maximumBytes) {
    throw new Error(`Selecione um arquivo de até ${maximumBytes / (1024 * 1024)} MB.`);
  }
}

export function validatePortfolioAsset(asset: DocumentPickerAsset): string {
  const extension = asset.name.split(".").pop()?.toLowerCase() || "";
  const expectedMime = MIME_BY_EXTENSION[extension];
  if (!expectedMime) {
    throw new Error("Selecione uma imagem JPG, PNG, GIF ou WEBP, um vídeo MP4, MOV ou WEBM, ou um PDF.");
  }
  const declaredMime = (asset.mimeType || asset.file?.type || "").toLowerCase().split(";")[0].trim();
  const normalizedMime = declaredMime === "image/jpg" ? "image/jpeg" : declaredMime;
  if (normalizedMime && normalizedMime !== "application/octet-stream" && normalizedMime !== expectedMime) {
    throw new Error("O tipo do arquivo não corresponde à extensão do nome. Selecione o arquivo original.");
  }
  validateSize(asset.file?.size ?? asset.size);
  return expectedMime;
}

export function validatePortfolioVideo(asset: DocumentPickerAsset): string {
  const mimeType = validatePortfolioAsset(asset);
  if (!mimeType.startsWith("video/")) throw new Error("Selecione um vídeo MP4, MOV ou WEBM.");
  return mimeType;
}

export function validatePortfolioCover(asset: DocumentPickerAsset): string {
  const mimeType = validatePortfolioAsset(asset);
  if (!mimeType.startsWith("image/")) throw new Error("A capa deve ser uma imagem JPG, PNG, GIF ou WEBP.");
  validateSize(asset.file?.size ?? asset.size, PORTFOLIO_MAX_COVER_BYTES);
  return mimeType;
}

async function appendAsset(data: FormData, field: string, asset: DocumentPickerAsset, mimeType: string) {
  if (Platform.OS === "web") {
    let blob: Blob;
    if (asset.file) {
      blob = asset.file;
    } else {
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error("Não foi possível ler o arquivo selecionado. Selecione-o novamente.");
      blob = await response.blob();
    }
    validateSize(blob.size, field === "capa" ? PORTFOLIO_MAX_COVER_BYTES : PORTFOLIO_MAX_FILE_BYTES);
    data.append(field, blob.type === mimeType ? blob : new Blob([blob], { type: mimeType }), asset.name);
  } else {
    // React Native envia o arquivo do cache por URI, sem convertê-lo em Base64.
    data.append(field, { uri: asset.uri, name: asset.name, type: mimeType } as any);
  }
}

export async function portfolioFormData(
  titulo: string,
  descricao: string,
  asset: DocumentPickerAsset,
  options: { secao?: "portfolio" | "video"; capa?: DocumentPickerAsset | null } = {},
): Promise<FormData> {
  const mimeType = options.secao === "video" ? validatePortfolioVideo(asset) : validatePortfolioAsset(asset);
  const coverMime = options.capa ? validatePortfolioCover(options.capa) : null;
  const data = new FormData();
  data.append("titulo", titulo.trim());
  data.append("descricao", descricao.trim());
  data.append("secao", options.secao || "portfolio");
  await appendAsset(data, "arquivo", asset, mimeType);
  if (options.capa && coverMime) await appendAsset(data, "capa", options.capa, coverMime);
  // O fetch deve definir Content-Type e o boundary do multipart automaticamente.
  return data;
}

export function releasePortfolioAsset(asset: DocumentPickerAsset | null) {
  if (Platform.OS === "web" && asset?.uri.startsWith("blob:") && typeof URL !== "undefined") {
    URL.revokeObjectURL(asset.uri);
  }
}

function portfolioMediaUrl(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  // A API retorna uma rota estável. A assinatura temporária é renovada ao abrir.
  return value.startsWith("/api/portfolio/arquivos/")
    ? `${URL_API}${value}`
    : /^https?:\/\//i.test(value) ? value : "";
}

export function portfolioFileFromApi(item: PortfolioApiItem): PortfolioFile | null {
  const uri = portfolioMediaUrl(item.midia_url);
  if (!uri) return null;
  const fallbackMime: Record<string, string> = {
    imagem: "image/jpeg",
    video: "video/mp4",
    pdf: "application/pdf",
  };
  return {
    uri,
    name: item.arquivo_nome || item.titulo || "Arquivo do portfólio",
    mimeType: item.arquivo_mime || fallbackMime[item.tipo || ""] || "application/octet-stream",
    size: item.arquivo_tamanho ?? undefined,
  };
}

export function portfolioCoverFromApi(item: PortfolioApiItem): PortfolioFile | null {
  const uri = portfolioMediaUrl(item.capa_url);
  return uri ? { uri, name: "Capa do vídeo", mimeType: "image/jpeg" } : null;
}

export function openPortfolioFile(uri: string) {
  if (!/^https?:\/\//i.test(uri)) return;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    // Abrir dentro do gesto de clique evita bloqueio de pop-up por awaits prévios.
    window.open(uri, "_blank", "noopener,noreferrer");
    return;
  }
  Linking.openURL(uri).catch(() => {
    portfolioNotice("Não foi possível abrir", "Tente novamente ou use um aplicativo que abra este tipo de arquivo.");
  });
}
