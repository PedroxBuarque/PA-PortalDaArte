
import React from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Music, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { PressMotion } from '../animations/Motion';

import { VLibrasText as Text } from '../accessibility/VLibrasText';
type IconType = typeof Music;

export type Contratacao = {
  id: string;
  name: string;
  category: string;
  title?: string;
  value?: string;
  rating?: string;
  date: string;
  location: string;
  status: string;
  icon: IconType;
  darkBgColor: string;
  lightBgColor: string;
  iconColor: string;
};

type Props = {
  item: Contratacao;
  onPress: () => void;
};

function getStatusColor(status: string) {
  switch (status) {
    case 'Pendente':
      return '#A15C00';
    case 'Confirmado':
      return '#176B87';
    case 'Concluido':
    case 'Concluído':
      return '#16794B';
    case 'Recusada':
    case 'Recusado':
    case 'Cancelado':
      return '#B42318';
    case 'Expirada':
      return '#5D6470';
    default:
      return '#BDBDBD';
  }
}

export default function CardContratacao({ item, onPress }: Props) {
  const { theme, isLightMode } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 620;
  const IconComponent = item.icon;

  const avatarBg = isLightMode
    ? item.lightBgColor
    : item.darkBgColor;

  const styles = StyleSheet.create({
    card: {
      backgroundColor: theme.cardBg,
      borderRadius: 20,
      paddingVertical: compact ? 16 : 18,
      paddingHorizontal: compact ? 16 : 20,
      borderLeftWidth: 4,
      borderLeftColor: theme.accent,
      flexDirection: compact ? 'column' : 'row',
      alignItems: compact ? 'stretch' : 'center',
      justifyContent: 'space-between',
      shadowColor: theme.shadowColor || '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 10,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    cardLeftGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
    },
    avatarContainer: {
      width: 58,
      height: 58,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    artistDetails: {
      justifyContent: 'center',
      flex: 1,
      minWidth: 0,
    },
    nameCategoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
      flexWrap: 'wrap',
    },
    artistName: {
      fontSize: 18,
      fontWeight: '900',
      fontFamily: 'serif',
      color: theme.textPrimary,
      marginRight: 8,
    },
    artistCategory: {
      fontSize: 10,
      color: theme.accent,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    titleText: { fontSize: compact ? 15 : 16, fontWeight: '800', color: theme.textPrimary,
      marginTop: 4, lineHeight: 22 },
    valueText: { color: theme.textPrimary, fontWeight: '900', fontSize: 17 },
    ratingText: { color: theme.textSecondary, fontSize: 12, marginTop: 4 },
    infoText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    cardRightGroup: {
      alignItems: 'flex-end',
      marginLeft: compact ? 0 : 12,
      marginTop: compact ? 14 : 0,
      paddingTop: compact ? 12 : 0,
      borderTopWidth: compact ? 1 : 0,
      borderTopColor: theme.borderColor,
      flexDirection: compact ? 'row' : 'column',
      width: compact ? '100%' : undefined,
      justifyContent: compact ? 'space-between' : 'center',
      gap: 10,
    },
    statusBadge: {
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 10,
      backgroundColor: getStatusColor(item.status),
    },
    statusText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.4,
    },
    chevronButton: {
      width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.surfaceMuted || theme.mainBg, borderWidth: 1, borderColor: theme.borderColor,
    },
  });

  return (
    <PressMotion
      onPress={onPress}
      pressScale={0.987}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalhes da contratação de ${item.name}`}
      style={styles.card}
    >
      <View style={styles.cardLeftGroup}>
        <View
          style={[
            styles.avatarContainer,
            { backgroundColor: avatarBg },
          ]}
        >
          <IconComponent size={24} color={item.iconColor} />
        </View>

        <View style={styles.artistDetails}>
          <View style={styles.nameCategoryRow}>
            <Text style={styles.artistName}>
              {item.name}
            </Text>

            <Text style={styles.artistCategory}>
              {item.category}
            </Text>
          </View>

          {item.title ? <Text style={styles.titleText} numberOfLines={2}>{item.title}</Text> : null}
          <Text style={styles.infoText}>
            {item.date}
          </Text>

          <Text style={styles.infoText}>
            {item.location}
          </Text>
          {item.rating ? <Text style={styles.ratingText}>{item.rating}</Text> : null}
        </View>
      </View>

      <View style={styles.cardRightGroup}>
        {item.value ? <Text style={styles.valueText}>{item.value}</Text> : null}
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {item.status}
          </Text>
        </View>

        <View style={styles.chevronButton} accessible={false}>
          <ChevronRight size={18} color={theme.textPrimary} accessible={false} />
        </View>
      </View>
    </PressMotion>
  );
}
