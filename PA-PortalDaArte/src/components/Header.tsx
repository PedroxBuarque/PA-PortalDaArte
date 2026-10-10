import React, { useEffect, useState } from 'react';
import { 
  Image,
  StyleSheet, 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text,
  Modal
} from 'react-native';
import { Search, Bell, Settings, Sun, Moon, LogOut } from 'lucide-react-native';
import { useTheme } from './context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const URL_API = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Header() {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isAvatarMenuVisible, setIsAvatarMenuVisible] = useState(false);
  const [userName, setUserName] = useState('U');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const { isLightMode, toggleTheme, theme } = useTheme();
  
  const styles = getStyles(theme);

  // Busca isolada dos dados do usuário logado atual
  useEffect(() => {
    async function fetchHeaderUserData() {
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) return;

        const response = await fetch(`${URL_API}/api/perfis/me`, {
          method: 'GET',
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const result = await response.json();
        if (response.ok && result.dados) {
          const dados = result.dados;
          const nomeCompleto = dados.nome_completo || dados.email || 'U';
          setUserName(nomeCompleto.charAt(0).toUpperCase());
          setProfileImage(dados.foto_perfil || null);
        }
      } catch (error) {
        console.error('Erro ao buscar dados do header:', error);
      }
    }
    fetchHeaderUserData();
  }, []);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('access_token');
      setIsMenuVisible(false);
      setIsAvatarMenuVisible(false);
      router.replace('/pages/login/login');
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.searchBar}>
        <Search size={18} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Busque por artista, estilo musical ou instrumentos..."
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      <View style={styles.rightIcons}>
        <TouchableOpacity style={styles.iconButton}>
          <Bell size={20} color={theme.textSecondary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => setIsMenuVisible(!isMenuVisible)}
          activeOpacity={0.8}
        >
          <Settings size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        {/* Botão da Foto de Perfil com Abertura de Menu */}
        <TouchableOpacity 
          style={styles.userAvatar}
          onPress={() => setIsAvatarMenuVisible(!isAvatarMenuVisible)}
          activeOpacity={0.8}
        >
          {profileImage ? (
            <Image
              source={{ uri: profileImage }}
              style={styles.userAvatarImage}
            />
          ) : (
            <Text style={styles.userAvatarText}>{userName}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Menu da Engrenagem */}
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
            <TouchableOpacity 
              style={styles.dropdownItem} 
              onPress={() => setIsMenuVisible(false)}
            >
              <View style={styles.iconWrapper}>
                <Settings size={18} color={theme.textPrimary} />
              </View>
              <Text style={styles.dropdownText}>Configurações</Text>
            </TouchableOpacity>
            
            <View style={styles.divider} />
            
            <TouchableOpacity 
              style={styles.dropdownItem} 
              onPress={() => toggleTheme()}
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

      {/* Menu da Foto de Perfil (Deslogar) */}
      <Modal
        visible={isAvatarMenuVisible}
        transparent={true}
        animationType="none"
        onRequestClose={() => setIsAvatarMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsAvatarMenuVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.dropdownMenu, { right: 32 }]}>
            <TouchableOpacity 
              style={styles.dropdownItem} 
              onPress={handleLogout}
            >
              <View style={styles.iconWrapper}>
                <LogOut size={18} color="#E05A10" />
              </View>
              <Text style={[styles.dropdownText, { color: '#E05A10' }]}>
                Sair da conta
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
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
    borderWidth: 1,
    borderColor: theme.borderColor, 
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: theme.textPrimary,
    fontSize: 13,
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
    overflow: 'hidden',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
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