import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type CartItem = {
  serviceId: number;
  artistId: number;
  artistName: string;
  serviceTitle: string;
  description?: string | null;
  price: number;
  modality?: string | null;
  imageUrl?: string | null;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  hydrated: boolean;
  addItem: (item: CartItem) => 'added' | 'exists';
  removeItem: (serviceId: number) => CartItem | null;
  restoreItem: (item: CartItem) => void;
  clearCart: () => void;
  hasService: (serviceId: number) => boolean;
};

const STORAGE_KEY = 'portal_da_arte_cart_v1';
const CartContext = createContext<CartContextValue | null>(null);

const normalizeStoredItem = (raw: any): CartItem | null => {
  const serviceId = Number(raw?.serviceId);
  const artistId = Number(raw?.artistId);
  const price = Number(raw?.price);
  if (!Number.isInteger(serviceId) || serviceId <= 0) return null;
  if (!Number.isInteger(artistId) || artistId <= 0) return null;
  if (!Number.isFinite(price) || price <= 0) return null;
  const serviceTitle = String(raw?.serviceTitle || '').trim();
  const artistName = String(raw?.artistName || '').trim();
  if (!serviceTitle || !artistName) return null;
  return {
    serviceId,
    artistId,
    price,
    serviceTitle,
    artistName,
    description: typeof raw?.description === 'string' ? raw.description : null,
    modality: typeof raw?.modality === 'string' ? raw.modality : null,
    imageUrl: typeof raw?.imageUrl === 'string' ? raw.imageUrl : null,
  };
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active || !raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const valid = parsed.map(normalizeStoredItem).filter(Boolean) as CartItem[];
        const unique = Array.from(new Map(valid.map((item) => [item.serviceId, item])).values());
        if (active) setItems(unique);
      } catch (error) {
        console.warn('[Carrinho] Não foi possível restaurar o carrinho:', error);
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch((error) => {
      console.warn('[Carrinho] Não foi possível salvar o carrinho:', error);
    });
  }, [items, hydrated]);

  const addItem = useCallback((item: CartItem): 'added' | 'exists' => {
    if (!Number.isFinite(item.price) || item.price <= 0) return 'exists';
    if (items.some((entry) => entry.serviceId === item.serviceId)) return 'exists';
    setItems((current) => current.some((entry) => entry.serviceId === item.serviceId) ? current : [...current, item]);
    return 'added';
  }, [items]);

  const removeItem = useCallback((serviceId: number): CartItem | null => {
    const removed = items.find((entry) => entry.serviceId === serviceId) || null;
    if (!removed) return null;
    setItems((current) => current.filter((entry) => entry.serviceId !== serviceId));
    return removed;
  }, [items]);

  const restoreItem = useCallback((item: CartItem) => {
    setItems((current) => current.some((entry) => entry.serviceId === item.serviceId) ? current : [...current, item]);
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const hasService = useCallback((serviceId: number) => items.some((entry) => entry.serviceId === serviceId), [items]);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price, 0), [items]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.length,
    total,
    hydrated,
    addItem,
    removeItem,
    restoreItem,
    clearCart,
    hasService,
  }), [items, total, hydrated, addItem, removeItem, restoreItem, clearCart, hasService]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart deve ser usado dentro de CartProvider.');
  return context;
}
