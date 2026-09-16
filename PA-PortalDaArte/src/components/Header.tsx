import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text,
  Modal
} from 'react-native';
import { Search, Bell, Settings, Sun, Moon } from 'lucide-react-native';
import { useTheme } from './context/ThemeContext';

export default function Header() {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  
  // Puxando o tema e a função de trocar tema do Contexto
  const { isLightMode, toggleTheme, theme } = useTheme();
  
  // Gerando os estilos baseados no tema atual
  const styles = getStyles(theme);

  return (
    <View style={styles.header}>
      
      {/* BARRA DE PESQUISA COM BORDA DINÂMICA */}
      <View style={styles.searchBar}>
        <Search size={18} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Busque por artista, estilo musical ou instrumentos..."
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      {/* ÍCONES DA DIREITA */}
      <View style={styles.rightIcons}>
        <TouchableOpacity style={styles.iconButton}>
          <Bell size={20} color={theme.textSecondary} />
        </TouchableOpacity>
        
        {/* Botão da Engrenagem (no topo) */}
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => setIsMenuVisible(!isMenuVisible)}
          activeOpacity={0.8}
        >
          <Settings key={isLightMode ? 'light-top' : 'dark-top'} size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>U</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL DE CONFIGURAÇÕES */}
      <Modal
        visible={isMenuVisible}
        transparent={true}
        animationType="none"
        onRequestClose={() => setIsMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsMenuVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.dropdownMenu}>
            
            {/* Opção de Configurações - Engrenagem do dropdown */}
            <TouchableOpacity 
              style={styles.dropdownItem} 
              onPress={() => {
                setIsMenuVisible(false);
              }}
            >
              <View style={styles.iconWrapper}>
                <Settings 
                  key={isLightMode ? 'light-gear' : 'dark-gear'} 
                  size={18} 
                  color={theme.textPrimary} 
                />
              </View>
              <Text style={styles.dropdownText}>Configurações</Text>
            </TouchableOpacity>
            
            <View style={styles.divider} />
            
            {/* Opção de Trocar Tema */}
            <TouchableOpacity 
              style={styles.dropdownItem} 
              onPress={() => {
                toggleTheme();
              }}
            >
              <View style={styles.iconWrapper}>
                {isLightMode ? (
                  <Moon size={18} color={theme.textPrimary} />
                ) : (
                  <Sun size={18} color={theme.textPrimary} />
                )}
              </View>
              <Text style={styles.dropdownText}>
                {isLightMode ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
              </Text>
            </TouchableOpacity>
            
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      
    </View>
  );
}

// Transformamos os estilos em uma função que recebe as cores do tema
const getStyles = (theme) => StyleSheet.create({
  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
    backgroundColor: theme.headerBg, 
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.searchBg,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 40,
    width: '50%',
    maxWidth: 450,
    // ADICIONADO: Borda que muda dinamicamente com o tema
    borderWidth: 1,
    borderColor: theme.borderColor, 
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: theme.textPrimary,
    fontSize: 13,
    outlineStyle: 'none', 
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  iconButton: {
    padding: 4,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 60,
    right: 75,
    backgroundColor: theme.cardBg,
    borderRadius: 8,
    width: 200,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 8,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownText: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: theme.borderColor,
    marginVertical: 4,
  }
});