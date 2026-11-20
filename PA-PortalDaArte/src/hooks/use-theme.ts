/**
 * Retorna a paleta do sistema para componentes auxiliares do template Expo.
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme() ?? 'light';
  return Colors[scheme];
}
