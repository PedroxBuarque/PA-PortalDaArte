import React from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Accessibility, AlignLeft, Eye, RotateCcw, Type } from 'lucide-react-native';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';
import { VLibrasText as Text } from '../../../components/accessibility/VLibrasText';
import {
  FONT_SCALE_OPTIONS,
  useAccessibility,
  type FontScale,
} from '../../../components/accessibility/AccessibilityContext';
import { useAuth } from '../../../components/context/AuthContext';
import { useTheme } from '../../../components/context/ThemeContext';

const FONT_LABELS: Record<FontScale, string> = {
  1: '100%',
  1.25: '125%',
  1.5: '150%',
  1.75: '175%',
  2: '200%',
};

export default function ConfiguracoesScreen() {
  const { width } = useWindowDimensions();
  const { status } = useAuth();
  const { theme, isLightMode } = useTheme();
  const {
    fontScale,
    highContrast,
    readingSpacing,
    screenReaderEnabled,
    setFontScale,
    setHighContrast,
    setReadingSpacing,
    resetAccessibility,
  } = useAccessibility();

  const showSidebar = status === 'authenticated' && width >= 900;
  const styles = getStyles(theme, width < 720);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={highContrast || isLightMode ? 'dark-content' : 'light-content'}
        backgroundColor={theme.headerBg}
      />

      <View style={styles.dashboardContainer}>
        {showSidebar ? <Sidebar /> : null}

        <View style={styles.mainContent}>
          <Header />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentWrapper}>
              <Text style={styles.pageTitle} accessibilityRole="header">Configurações</Text>
              <Text style={styles.pageSubtitle}>
                Personalize o Portal da Arte de acordo com suas necessidades.
              </Text>

              <View style={styles.tabs} accessibilityRole="tablist">
                <View style={styles.activeTab} accessibilityRole="tab" accessibilityState={{ selected: true }}>
                  <Eye size={18} color={theme.accent} accessible={false} />
                  <Text style={styles.activeTabText}>Acessibilidade</Text>
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon} accessible={false}>
                    <Type size={20} color={theme.accent} accessible={false} />
                  </View>
                  <View style={styles.sectionCopy}>
                    <Text style={styles.sectionTitle} accessibilityRole="header">Tamanho da fonte</Text>
                    <Text style={styles.sectionDescription}>
                      Aumente o texto para facilitar a leitura. A alteração é aplicada ao sistema inteiro.
                    </Text>
                  </View>
                </View>

                <View style={styles.fontOptions} accessibilityRole="radiogroup">
                  {FONT_SCALE_OPTIONS.map((scale) => {
                    const selected = fontScale === scale;
                    return (
                      <TouchableOpacity
                        key={scale}
                        style={[styles.fontOption, selected && styles.fontOptionSelected]}
                        onPress={() => setFontScale(scale)}
                        activeOpacity={0.8}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={`Tamanho da fonte ${FONT_LABELS[scale]}`}
                        accessibilityHint="Toque duas vezes para aplicar este tamanho de fonte"
                      >
                        <Text style={[styles.fontOptionText, selected && styles.fontOptionTextSelected]}>
                          {FONT_LABELS[scale]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.helperText}>
                  100% é o tamanho original. O ajuste pode chegar a 200% para apoiar pessoas com baixa visão.
                </Text>
              </View>

              <View style={styles.card}>
                <View style={styles.settingRow}>
                  <View style={styles.sectionHeaderInline}>
                    <View style={styles.sectionIcon} accessible={false}>
                      <Eye size={20} color={theme.accent} accessible={false} />
                    </View>
                    <View style={styles.sectionCopy}>
                      <Text style={styles.sectionTitle} accessibilityRole="header">Alto contraste</Text>
                      <Text style={styles.sectionDescription}>
                        Usa fundo branco, textos escuros, bordas fortes e cores de ação com contraste elevado.
                      </Text>
                    </View>
                  </View>

                  <Switch
                    value={highContrast}
                    onValueChange={setHighContrast}
                    trackColor={{ false: theme.borderColor, true: theme.accent }}
                    thumbColor={highContrast ? '#FFFFFF' : '#F4F4F4'}
                    ios_backgroundColor={theme.borderColor}
                    accessibilityRole="switch"
                    accessibilityLabel="Alto contraste"
                    accessibilityHint="Ativa uma paleta com contraste visual reforçado"
                    accessibilityState={{ checked: highContrast }}
                  />
                </View>

                {highContrast ? (
                  <Text style={styles.helperText}>
                    Enquanto o alto contraste estiver ativo, ele substitui temporariamente as cores dos modos claro e escuro.
                  </Text>
                ) : null}
              </View>

              <View style={styles.card}>
                <View style={styles.settingRow}>
                  <View style={styles.sectionHeaderInline}>
                    <View style={styles.sectionIcon} accessible={false}>
                      <AlignLeft size={20} color={theme.accent} accessible={false} />
                    </View>
                    <View style={styles.sectionCopy}>
                      <Text style={styles.sectionTitle} accessibilityRole="header">Espaçamento de leitura ampliado</Text>
                      <Text style={styles.sectionDescription}>
                        Aumenta a entrelinha e o espaçamento entre caracteres para deixar blocos de texto mais fáceis de acompanhar.
                      </Text>
                    </View>
                  </View>

                  <Switch
                    value={readingSpacing}
                    onValueChange={setReadingSpacing}
                    trackColor={{ false: theme.borderColor, true: theme.accent }}
                    thumbColor={readingSpacing ? '#FFFFFF' : '#F4F4F4'}
                    ios_backgroundColor={theme.borderColor}
                    accessibilityRole="switch"
                    accessibilityLabel="Espaçamento de leitura ampliado"
                    accessibilityHint="Aumenta a entrelinha e o espaçamento entre caracteres"
                    accessibilityState={{ checked: readingSpacing }}
                  />
                </View>
                <Text style={styles.helperText}>
                  A opção é aplicada aos textos do sistema e também aos campos de texto compatíveis, sem alterar o conteúdo.
                </Text>
              </View>

              <View style={styles.card} accessible={false}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon} accessible={false}>
                    <Accessibility size={20} color={theme.accent} accessible={false} />
                  </View>
                  <View style={styles.sectionCopy}>
                    <Text style={styles.sectionTitle} accessibilityRole="header">Leitores de tela</Text>
                    <Text style={styles.sectionDescription}>
                      O Portal da Arte usa rótulos, funções e estados de acessibilidade nos controles globais para melhorar a navegação com TalkBack e VoiceOver.
                    </Text>
                    <Text
                      style={styles.screenReaderStatus}
                      accessibilityLiveRegion="polite"
                      accessibilityLabel={`Leitor de tela ${screenReaderEnabled ? 'detectado' : 'não detectado'}`}
                    >
                      {screenReaderEnabled ? 'Leitor de tela detectado neste dispositivo.' : 'Leitor de tela não detectado no momento.'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Pré-visualização</Text>
                <Text style={styles.previewTitle}>Portal da Arte</Text>
                <Text style={styles.previewText}>
                  Este texto mostra como a leitura ficará com as preferências selecionadas. Uma leitura confortável deve continuar clara mesmo quando a fonte e os espaçamentos forem ampliados.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.resetButton}
                onPress={resetAccessibility}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Restaurar configurações de acessibilidade para o padrão"
                accessibilityHint="Restaura fonte para 100 por cento e desativa alto contraste e espaçamento ampliado"
              >
                <RotateCcw size={17} color={theme.textPrimary} accessible={false} />
                <Text style={styles.resetButtonText}>Restaurar padrão</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: any, compact: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.mainBg,
      ...Platform.select({ web: { height: '100vh' as any, overflow: 'hidden' } }),
    },
    dashboardContainer: { flex: 1, flexDirection: 'row', backgroundColor: theme.mainBg },
    mainContent: { flex: 1, minWidth: 0, backgroundColor: theme.mainBg },
    scrollView: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingBottom: 36 },
    contentWrapper: {
      width: '100%', maxWidth: 900, alignSelf: 'center',
      paddingHorizontal: compact ? 18 : 32, paddingTop: compact ? 22 : 32,
    },
    pageTitle: { color: theme.textPrimary, fontSize: 28, fontWeight: '800' },
    pageSubtitle: { color: theme.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 24 },
    tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.borderColor, marginBottom: 20 },
    activeTab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: theme.accent },
    activeTabText: { color: theme.accent, fontSize: 14, fontWeight: '700' },
    card: { backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 14, padding: compact ? 18 : 22, marginBottom: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
    sectionHeaderInline: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingRight: 16 },
    sectionIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.menuActiveBg, borderWidth: 1, borderColor: theme.borderColor },
    sectionCopy: { flex: 1, minWidth: 0 },
    sectionTitle: { color: theme.textPrimary, fontSize: 16, fontWeight: '700' },
    sectionDescription: { color: theme.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
    settingRow: { flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'flex-start' : 'center', justifyContent: 'space-between', gap: compact ? 14 : 18 },
    fontOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    fontOption: { minWidth: 74, height: 42, borderRadius: 10, borderWidth: 1, borderColor: theme.borderColor, backgroundColor: theme.cardBg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    fontOptionSelected: { borderColor: theme.accent, backgroundColor: theme.menuActiveBg, borderWidth: 2 },
    fontOptionText: { color: theme.textPrimary, fontSize: 13, fontWeight: '600' },
    fontOptionTextSelected: { color: theme.accent, fontWeight: '800' },
    helperText: { color: theme.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 14 },
    screenReaderStatus: { color: theme.textPrimary, fontSize: 12, fontWeight: '700', marginTop: 10 },
    previewCard: { backgroundColor: theme.cardBg, borderWidth: 2, borderColor: theme.borderColor, borderRadius: 14, padding: 22, marginBottom: 16 },
    previewLabel: { color: theme.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
    previewTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 6 },
    previewText: { color: theme.textSecondary, fontSize: 13, lineHeight: 20 },
    resetButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: theme.cardBg },
    resetButtonText: { color: theme.textPrimary, fontSize: 12, fontWeight: '700' },
  });
