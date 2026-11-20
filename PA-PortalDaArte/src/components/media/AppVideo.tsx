import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer, type VideoContentFit } from 'expo-video';
import React, { useEffect, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

type AppVideoProps = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  nativeControls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  startAt?: number;
  contentFit?: VideoContentFit;
  accessibilityLabel?: string;
  onError?: () => void;
};

/**
 * Player de vídeo compartilhado do Portal da Arte.
 * Centraliza expo-video para Web/Android/iOS e evita dependência do expo-av.
 */
export function AppVideo({
  uri,
  style,
  nativeControls = true,
  autoPlay = false,
  muted = false,
  startAt = 0,
  contentFit = 'contain',
  accessibilityLabel = 'Vídeo',
  onError,
}: AppVideoProps) {
  const source = useMemo(() => ({ uri }), [uri]);
  const player = useVideoPlayer(source);

  useEffect(() => {
    player.muted = muted;
    if (startAt > 0) player.currentTime = startAt;
    if (autoPlay) player.play();
    else player.pause();
  }, [autoPlay, muted, player, startAt, uri]);

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'error' || error) onError?.();
  });

  return (
    <VideoView
      player={player}
      style={style}
      nativeControls={nativeControls}
      contentFit={contentFit}
      playsInline
      accessible
      accessibilityLabel={accessibilityLabel}
    />
  );
}
