import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';

/**
 * Botão de tab compatível com o template Expo sem exigir expo-haptics.
 * O Portal da Arte não usa feedback háptico como requisito funcional.
 */
export function HapticTab(props: BottomTabBarButtonProps) {
  return <PlatformPressable {...props} />;
}
