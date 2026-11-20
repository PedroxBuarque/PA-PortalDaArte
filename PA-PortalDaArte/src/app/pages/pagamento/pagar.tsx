import React from 'react';
import { SafeAreaView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';
import PagamentoPixSandbox from '../../../components/PagamentoPixSandbox';
import { useTheme } from '../../../components/context/ThemeContext';

export default function PagamentoContrato() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ contrato_id?: string; contratoId?: string }>();
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.mainBg }}>
    <View style={{ flexDirection: 'row', flex: 1 }}>
      <Sidebar />
      <View style={{ flex: 1 }}>
        <Header />
        <PagamentoPixSandbox contratoInicial={String(params.contrato_id || params.contratoId || '')} />
      </View>
    </View>
  </SafeAreaView>;
}
