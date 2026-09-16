// app/_layout.jsx
import { Slot } from 'expo-router';
import { ThemeProvider } from '../components/context/ThemeContext'; // Ajuste o caminho se precisar

export default function RootLayout() {
  return (
    // O ThemeProvider abraça o "Slot" (que é onde o Expo injeta suas telas)
    <ThemeProvider>
      <Slot /> 
    </ThemeProvider>
  );
}