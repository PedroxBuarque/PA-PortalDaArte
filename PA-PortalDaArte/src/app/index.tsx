import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';


import Tela_Inicial from './pages/explorar/explorar';


const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <Tela_Inicial/>
  );
}