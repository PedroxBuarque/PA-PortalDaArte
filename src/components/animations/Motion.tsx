/**
 * Microinterações compartilhadas do Portal da Arte.
 * Apenas opacity/transform são animados; nenhum serviço, rota ou tema é alterado.
 * O driver nativo é usado no iOS/Android e o driver JS no react-native-web.
 */
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  TouchableOpacity,
  type TouchableOpacityProps,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const NATIVE_DRIVER = Platform.OS !== 'web';
const EASE_OUT = Easing.out(Easing.cubic);

// Uma assinatura para a aplicação inteira, sem um listener de acessibilidade por card.
const motionSubscribers = new Set<() => void>();
let reduceMotion = false;
let stopSystemListener: (() => void) | undefined;

function updateReducedMotion(next: boolean) {
  if (reduceMotion === next) return;
  reduceMotion = next;
  motionSubscribers.forEach((notify) => notify());
}

function startListening() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    updateReducedMotion(query.matches);
    const handler = (event: MediaQueryListEvent) => updateReducedMotion(event.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }
  let active = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((value) => { if (active) updateReducedMotion(value); })
    .catch(() => {});
  const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', updateReducedMotion);
  return () => { active = false; subscription.remove(); };
}

function subscribeMotion(notify: () => void) {
  motionSubscribers.add(notify);
  if (!stopSystemListener) stopSystemListener = startListening();
  return () => {
    motionSubscribers.delete(notify);
    if (motionSubscribers.size === 0) {
      stopSystemListener?.();
      stopSystemListener = undefined;
    }
  };
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, () => reduceMotion, () => true);
}

function entranceDelay(index: number) {
  // Só os primeiros cards entram escalonados; não cria cascatas longas em listas extensas.
  return Math.max(0, Math.min(index, 7)) * 34;
}

type FadeSlideProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  index?: number;
  replayKey?: string | number;
  enabled?: boolean;
  duration?: number;
  distance?: number;
};

/** Entrada suave e escalonada. `replayKey` só reinicia ao trocar os filtros. */
export function FadeSlide({
  children, style, index = 0, replayKey, enabled = true, duration = 240, distance = 10,
}: FadeSlideProps) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(enabled ? 0 : 1)).current;

  useEffect(() => {
    progress.stopAnimation();
    if (!enabled || reduced) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay: entranceDelay(index),
      easing: EASE_OUT,
      useNativeDriver: NATIVE_DRIVER,
      isInteraction: false, // FlatList/onEndReached continuam funcionando durante a animação.
    });
    animation.start();
    return () => animation.stop();
  }, [progress, enabled, reduced, index, replayKey, duration]);

  return (
    <Animated.View
      style={[style, {
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressMotionProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressScale?: number;
  children: React.ReactNode;
};

/** Mantém semântica, hitbox, foco e onPress originais do Pressable. */
export function PressMotion({
  style, pressScale = 0.98, onPressIn, onPressOut, disabled, children, ...props
}: PressMotionProps) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (value: number) => {
    if (reduced) return;
    Animated.timing(scale, {
      toValue: value,
      duration: value < 1 ? 110 : 190,
      easing: EASE_OUT,
      useNativeDriver: NATIVE_DRIVER,
      isInteraction: false,
    }).start();
  };
  useEffect(() => {
    if (reduced || disabled) { scale.stopAnimation(); scale.setValue(1); }
    return () => scale.stopAnimation();
  }, [reduced, disabled, scale]);

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(event) => { animate(pressScale); onPressIn?.(event); }}
      onPressOut={(event) => { animate(1); onPressOut?.(event); }}
    >
      {children}
    </AnimatedPressable>
  );
}

type PresenceProps = {
  visible: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  distance?: number;
};

/** Entrada e saída sem remover a hitbox de menus até o fim do fade-out. */
export function MotionPresence({ visible, children, style, duration = 190, distance = 6 }: PresenceProps) {
  const reduced = useReducedMotion();
  const [rendered, setRendered] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    progress.stopAnimation();
    if (reduced) {
      progress.setValue(visible ? 1 : 0);
      setRendered(visible);
      return;
    }
    if (visible) setRendered(true);
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration,
      easing: EASE_OUT,
      useNativeDriver: NATIVE_DRIVER,
      isInteraction: false,
    });
    animation.start(({ finished }) => { if (finished && !visible) setRendered(false); });
    return () => animation.stop();
  }, [visible, reduced, progress, duration]);

  if (!rendered) return null;
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[style, {
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
        ],
      }]}
    >
      {children}
    </Animated.View>
  );
}

/** Feedback pontual para favorito/chip/indicador, não usa loop. */
export function StatePulse({ active, children, style }: {
  active: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const initial = useRef(true);
  useEffect(() => {
    if (initial.current) { initial.current = false; return; }
    if (reduced) return;
    const animation = Animated.sequence([
      Animated.timing(scale, { toValue: active ? 1.14 : 0.92, duration: 95, easing: EASE_OUT, useNativeDriver: NATIVE_DRIVER, isInteraction: false }),
      Animated.timing(scale, { toValue: 1, duration: 160, easing: EASE_OUT, useNativeDriver: NATIVE_DRIVER, isInteraction: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [active, reduced, scale]);
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

/** Conteúdo ancorado de Modal: preserva estilos absolutos e o touch de fechar/abrir. */
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export function ModalMotionTouchable({
  visible, style, children, offsetX = 0, offsetY = 8, ...props
}: Omit<TouchableOpacityProps, 'style'> & {
  visible: boolean;
  style?: StyleProp<ViewStyle>;
  offsetX?: number;
  offsetY?: number;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    progress.stopAnimation();
    if (reduced || !visible) { progress.setValue(visible ? 1 : 0); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1, duration: 230, easing: EASE_OUT,
      useNativeDriver: NATIVE_DRIVER, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, reduced, progress]);
  return (
    <AnimatedTouchableOpacity
      {...props}
      style={[style, {
        opacity: progress,
        transform: [
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [offsetX, 0] }) },
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offsetY, 0] }) },
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
        ],
      }]}
    >
      {children}
    </AnimatedTouchableOpacity>
  );
}
