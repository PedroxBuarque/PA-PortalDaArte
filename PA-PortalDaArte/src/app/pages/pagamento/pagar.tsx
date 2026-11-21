import React from 'react';
import { SafeAreaView, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';
import PagamentoPixSandbox from '../../../components/PagamentoPixSandbox';
import { useTheme } from '../../../components/context/ThemeContext';
import { DESKTOP_BREAKPOINT } from '../../../constants/responsive';

export default function PagamentoContrato() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const showSidebar = width >= DESKTOP_BREAKPOINT;
  const params = useLocalSearchParams<{ contrato_id?: string; contratoId?: string }>();
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.mainBg }}>
    <View style={{ flexDirection: 'row', flex: 1 }}>
      {showSidebar ? <Sidebar /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Header />
        <PagamentoPixSandbox contratoInicial={String(params.contrato_id || params.contratoId || '')} />
      </View>
    </View>
  </SafeAreaView>;
}
