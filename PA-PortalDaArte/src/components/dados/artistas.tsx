import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
const URL_API = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000'; 

export function useMeuId(): string | null {
  const [meuId, setMeuId] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) return;
        const r = await fetch(`${URL_API}/api/perfis/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        const d = j?.dados;
        const id = d?.usuario_id ?? d?.id;
        if (ativo && id != null) setMeuId(String(id));
      } catch {
      }
    })();
    return () => { ativo = false; };
  }, []);
  return meuId;
}



export type Review = {
  id: string;
  authorId: string;
  authorTipo: 'cliente' | 'artista';
  author: string;
  date: string;
  rating: number;
  text: string;
};

export type PortfolioItem = {
  id: string;
  type: 'foto' | 'video' | 'audio';
  title: string;
  uri?: string; // imagem / miniatura
  url?: string; // link do vídeo ou áudio
};

export type Artist = {
  id: string;
  name: string;
  style: string; // ex: "MPB • Cantora"
  city: string;
  rating: number;
  reviewsCount: number;
  priceFrom: number;
  negotiable: boolean; // false = valor fixo (some a opção de negociar no formulário)
  minPrice?: number; // menor proposta aceita pelo artista
  photoUrl?: string;
  icon: 'music' | 'headphones' | 'mic';
  iconColor: string;
  iconBg: string; // fundo do avatar no modo claro
  iconBgDark: string; // fundo do avatar no modo escuro
  about: string;
  tags: string[];
  stats: { shows: number; years: number; favorites: number };
  portfolio: PortfolioItem[];
  reviews: Review[];
};
export const formatBRL = (v: number): string =>
  'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0 });

/** Parâmetros que o formulário Contratar.tsx lê da URL (tudo precisa ser texto). */
export const contratarParams = (a: Artist) => ({
  artistId: a.id,
  nome: a.name,
  estilo: a.style,
  nota: String(a.rating),
  avaliacoes: String(a.reviewsCount),
  valorBase: String(a.priceFrom),
  aceitaNegociar: a.negotiable ? '1' : '0',
  valorMinimo: a.minPrice ? String(a.minPrice) : '',
});
