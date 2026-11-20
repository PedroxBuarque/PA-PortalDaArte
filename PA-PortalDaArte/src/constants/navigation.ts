import {
  Calendar,
  Compass,
  Heart,
  MessageSquare,
  ShoppingBag,
  Settings,
  User,
  type LucideIcon,
} from 'lucide-react-native';

export type NavigationItem = {
  id: string;
  label: string;
  route: string;
  icon: LucideIcon;
  private?: boolean;
};

export const PRIMARY_NAV_ITEMS: NavigationItem[] = [
  { id: 'explorar', label: 'Descobrir', icon: Compass, route: '/pages/explorar/explorar' },
  { id: 'carrinho', label: 'Carrinho', icon: ShoppingBag, route: '/pages/carrinho/carrinho' },
  { id: 'favoritos', label: 'Favoritos', icon: Heart, route: '/pages/favoritos/favoritos', private: true },
  { id: 'contratacoes', label: 'Contratações', icon: Calendar, route: '/pages/contratacoes/contratacoes', private: true },
  { id: 'mensagens', label: 'Mensagens', icon: MessageSquare, route: '/pages/mensagens/mensagens', private: true },
  { id: 'perfil', label: 'Perfil', icon: User, route: '/pages/perfil/perfil', private: true },
];

export const SETTINGS_NAV_ITEM: NavigationItem = {
  id: 'configuracoes',
  label: 'Configurações',
  icon: Settings,
  route: '/pages/configuracoes/configuracoes',
};
