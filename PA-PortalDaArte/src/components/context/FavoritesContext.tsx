import React, { useEffect, useMemo, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { obterUsuario } from "../../app/services/auth";

// Lista global de artistas favoritados, compartilhada entre Descobrir e Favoritos.
//
// - Guarda um "retrato" do artista (nome, categoria, nota, preço...) para a tela de Favoritos
//   poder exibi-lo sem buscar de novo.
// - Persiste no AsyncStorage POR USUÁRIO (favoritos:<id>): quem entrar depois no mesmo aparelho
//   não vê os favoritos de outra pessoa. Ao sair da conta a lista some da memória (o que está
//   salvo continua no aparelho e volta quando o mesmo usuário entrar de novo).
// - Fica num store lido com useSyncExternalStore (como o AuthContext): ao favoritar e navegar na
//   sequência, a tela de Favoritos já lê a lista atualizada, sem piscar o estado vazio.

export type FavoriteArtist = {
  id: number | string;
  name: string;
  category: string;
  style: string;
  emoji?: string;
  avatarColor?: string;
  avatarUrl?: string | null;
  rating: number;
  reviews: number;
  price: number;
  city?: string;
  state?: string;
  savedAt: number;
};

export type FavoriteInput = Omit<FavoriteArtist, "savedAt">;

const STORAGE_PREFIX = "@portal_da_arte:favoritos:";

// A API entrega a foto como imagem em base64 (centenas de KB). Gravar isso na lista estoura o
// limite do AsyncStorage (cerca de 2 MB por item no Android, 5 MB no navegador), então só se
// guarda foto pequena ou link comum. A tela de Favoritos busca a foto atual na API ao abrir.
const MAX_STORED_AVATAR_LENGTH = 50_000;
const storableAvatar = (url?: string | null) =>
  url && url.length <= MAX_STORED_AVATAR_LENGTH ? url : null;

type Snapshot = {
  artists: FavoriteArtist[];
  hydrated: boolean; // a leitura do storage já terminou?
  userKey: string | null; // de quem é a lista carregada
};

const EMPTY: Snapshot = { artists: [], hydrated: false, userKey: null };
let snapshot: Snapshot = EMPTY;
const listeners = new Set<() => void>();

const setSnapshot = (next: Snapshot) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const sameId = (a: unknown, b: unknown) => String(a) === String(b);

const currentUserKey = async (): Promise<string | null> => {
  try {
    const usuario = await obterUsuario();
    const key = usuario?.id ?? usuario?.email;
    return key !== undefined && key !== null && key !== "" ? String(key) : null;
  } catch {
    return null;
  }
};

const parseStored = (raw: string | null): FavoriteArtist[] => {
  try {
    const data = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(data)) return [];
    return data.filter((item) => item && item.id !== undefined && typeof item.name === "string");
  } catch {
    return [];
  }
};

let resetCount = 0; // muda ao sair da conta: leituras antigas em andamento são descartadas
let inflight: Promise<void> | null = null;

const hydrate = async () => {
  const mine = resetCount;
  const userKey = await currentUserKey();
  if (!userKey) {
    if (mine === resetCount) setSnapshot({ artists: [], hydrated: true, userKey: null });
    return;
  }
  if (snapshot.userKey === userKey && snapshot.hydrated) return;
  const stored = parseStored(await AsyncStorage.getItem(STORAGE_PREFIX + userKey));
  if (mine !== resetCount) return;
  setSnapshot({ artists: stored, hydrated: true, userKey });
};

/** Resolve quando a lista do usuário atual já foi lida do aparelho. */
export async function whenFavoritesReady(): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!inflight) {
      inflight = hydrate().finally(() => {
        inflight = null;
      });
    }
    await inflight;
    const key = await currentUserKey();
    if (!key || (snapshot.userKey === key && snapshot.hydrated)) return;
  }
}

const persist = async () => {
  if (!snapshot.userKey) return;
  try {
    await AsyncStorage.setItem(STORAGE_PREFIX + snapshot.userKey, JSON.stringify(snapshot.artists));
  } catch (error) {
    console.log("Não foi possível salvar os favoritos:", error);
  }
};

/** Adiciona o artista (sem duplicar). O mais recente aparece primeiro. */
export async function addFavorite(artist: FavoriteInput): Promise<void> {
  await whenFavoritesReady();
  if (!snapshot.userKey) return; // sem usuário logado não há onde guardar
  if (snapshot.artists.some((item) => sameId(item.id, artist.id))) return;
  const saved: FavoriteArtist = {
    id: artist.id,
    name: artist.name,
    category: artist.category,
    style: artist.style,
    emoji: artist.emoji,
    avatarColor: artist.avatarColor,
    avatarUrl: storableAvatar(artist.avatarUrl),
    rating: artist.rating,
    reviews: artist.reviews,
    price: artist.price,
    city: artist.city,
    state: artist.state,
    savedAt: Date.now(),
  };
  setSnapshot({ ...snapshot, artists: [saved, ...snapshot.artists] });
  await persist();
}

export async function removeFavorite(artistId: number | string): Promise<void> {
  await whenFavoritesReady();
  if (!snapshot.artists.some((item) => sameId(item.id, artistId))) return;
  setSnapshot({ ...snapshot, artists: snapshot.artists.filter((item) => !sameId(item.id, artistId)) });
  await persist();
}

/** Lê direto do store (nunca fica desatualizada, mesmo dentro de callbacks assíncronos). */
export function isFavorite(artistId: number | string): boolean {
  return snapshot.artists.some((item) => sameId(item.id, artistId));
}

const clearFavoritesFromMemory = () => {
  resetCount++;
  if (snapshot !== EMPTY) setSnapshot(EMPTY);
};

export function useFavorites() {
  const current = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  const favoriteIds = useMemo(() => current.artists.map((item) => item.id), [current.artists]);
  return {
    favoriteArtists: current.artists,
    favoriteIds,
    isHydrated: current.hydrated,
    isFavorite,
    addFavorite,
    removeFavorite,
    whenReady: whenFavoritesReady,
  };
}

/** Carrega os favoritos do usuário ao entrar e limpa a memória ao sair. */
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  useEffect(() => {
    if (status === "authenticated") void whenFavoritesReady();
    else if (status === "unauthenticated") clearFavoritesFromMemory();
  }, [status]);
  return <>{children}</>;
}
