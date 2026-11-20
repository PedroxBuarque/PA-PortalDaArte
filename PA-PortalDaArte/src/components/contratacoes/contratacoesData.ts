
import { Music, Headphones, Mic } from 'lucide-react-native';
import type { Contratacao } from './CardContratacao';

export const CONTRATACOES_LIST: Contratacao[] = [
  {
    id: '1',
    name: 'Lucas Andrade',
    category: 'Violão e Voz',
    date: '24/11/2026 - 20:00',
    location: 'Recife, PE',
    status: 'Pendente',
    icon: Music,
    darkBgColor: '#3D2218',
    lightBgColor: '#FDE4D9',
    iconColor: '#E05A10',
  },
  {
    id: '2',
    name: 'Banda Vereda',
    category: 'Forró • 5 integrantes',
    date: '24/11/2026 - 20:00',
    location: 'São Paulo, SP',
    status: 'Confirmado',
    icon: Music,
    darkBgColor: '#412C1B',
    lightBgColor: '#FDE4D9',
    iconColor: '#E05A10',
  },
  {
    id: '3',
    name: 'DJ Marina',
    category: 'Eletrônica • DJ Set',
    date: '24/11/2026 - 20:00',
    location: 'Recife, PE',
    status: 'Concluido',
    icon: Headphones,
    darkBgColor: '#2E2243',
    lightBgColor: '#EBE4FA',
    iconColor: '#8C52FF',
  },
  {
    id: '4',
    name: 'Juliana Diniz',
    category: 'MPB • Cantora',
    date: '24/11/2026 - 20:00',
    location: 'Recife, PE',
    status: 'Concluido',
    icon: Mic,
    darkBgColor: '#1B3736',
    lightBgColor: '#E0F2F1',
    iconColor: '#20B2AA',
  },
];
