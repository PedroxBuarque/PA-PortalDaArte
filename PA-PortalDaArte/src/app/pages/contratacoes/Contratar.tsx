import React, { useEffect, useMemo, useState } from 'react';
import { View, TextInputProps, Switch, ScrollView, TouchableOpacity, StyleSheet, StyleProp, ViewStyle, useWindowDimensions, Platform, Alert } from 'react-native';
import { AccessibleTextInput as TextInput } from '../../../components/accessibility/AccessibleTextInput';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../components/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';
import { DESKTOP_BREAKPOINT } from '../../../constants/responsive';


import { VLibrasText as Text } from '../../../components/accessibility/VLibrasText';
interface Theme {
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  borderColor: string;
  sidebarBg: string;
  menuActiveBg: string;
  accent: string;
  onAccent?: string;
  heroBg?: string;
  heroText?: string;
  heroMuted?: string;
  artGold?: string;
  headerBg: string;
  mainBg: string;
  searchBg: string;
}

interface ThemeContextValue {
  theme: Theme;
  isLightMode: boolean;
  toggleTheme: () => void;
}

export interface Artista {
  id: number | string;
  nome: string;
  estilo: string;
  nota: number;
  avaliacoes: number;
  valorBase: number;
  aceitaNegociar: boolean; // false = valor fixo (a opção de negociar some)
  valorMinimo?: number; // opcional: menor proposta aceita pelo artista
}

export type StatusContratacao =
  | 'pendente'
  | 'aceita'
  | 'recusada'
  | 'aguardando_cliente'
  | 'cancelada';

export interface SolicitacaoContratacao {
  artistaId: Artista['id'];
  status: StatusContratacao; // sempre 'pendente' ao enviar
  valorBase: number;
  negociando: boolean;
  valorProposto: number | null;
  mensagemNegociacao: string | null;
  /** Se o artista recusar o valor proposto, o cliente aceita fechar pelo valor base. */
  aceitaValorBaseSeRecusar: boolean;
  /** Valor que o cliente espera pagar (proposta ou valor base). O valor final é decidido na resposta do artista. */
  total: number;
  cliente: {
    nome: string;
    documento: string; // sem máscara (CPF ou CNPJ alfanumérico)
    telefone: string; // só dígitos
    email: string;
  };
  datas: {
    inicio: string; // ISO yyyy-mm-dd
    prazo: string; // ISO yyyy-mm-dd
  };
  servico: {
    local: string;
    descricao: string;
  };
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type FormState = {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  inicio: string;
  prazo: string;
  negociar: boolean;
  valor: string;
  mensagem: string;
  aceitaValorBase: boolean;
  local: string;
  descricao: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

interface ContratarScreenProps {
  /** Permite injetar um envio alternativo em testes; no app normal usa a API do Portal da Arte. */
  onSubmit?: (payload: SolicitacaoContratacao) => Promise<void> | void;
}

// ======================================================================
// Constantes
// ======================================================================

const URL_API = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// Para onde voltar quando não há tela anterior no histórico
const ROTA_FALLBACK = '/'; // página inicial do app
const FORM_INICIAL: FormState = {
  nome: '',
  cpf: '',
  telefone: '',
  email: '',
  inicio: '',
  prazo: '',
  negociar: false,
  valor: '',
  mensagem: '',
  aceitaValorBase: true,
  local: '',
  descricao: '',
};

// ======================================================================
// Usuário logado (para impedir que alguém contrate a si mesmo)
// ======================================================================

function useMeuId(): string | null {
  const [meuId, setMeuId] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) return;
        const r = await fetch(`${URL_API}/api/perfis/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        const d = j?.dados;
        const id = d?.usuario_id ?? d?.id;
        if (ativo && id != null) setMeuId(String(id));
      } catch {
        // sem rede ou sem login: ninguém é considerado dono
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);
  return meuId;
}

// ======================================================================
// Avisos (Alert.alert não aparece no navegador; na web usa window.alert)
// ======================================================================

const notify = (titulo: string, mensagem: string): void => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${titulo}\n\n${mensagem}`);
  } else {
    Alert.alert(titulo, mensagem);
  }
};

// ======================================================================
// Máscaras
// ======================================================================

const soAlfaNum = (v: string): string => (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const soDigitos = (v: string): string => (v || '').replace(/\D/g, '');

/**
 * CPF (só números, 11 dígitos) ou CNPJ (14 caracteres).
 * CNPJ alfanumérico: 12 primeiros podem ter letras, 2 últimos são numéricos.
 */
const maskCpfCnpj = (v: string): string => {
  let c = soAlfaNum(v).slice(0, 14);
  const temLetra = /[A-Z]/.test(c);

  // CPF
  if (!temLetra && c.length <= 11) {
    return c
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  // CNPJ (dígitos verificadores sempre numéricos)
  c = c.slice(0, 12) + c.slice(12).replace(/\D/g, '');
  return c
    .replace(/^([A-Z0-9]{2})([A-Z0-9])/, '$1.$2')
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})([A-Z0-9])/, '$1.$2.$3')
    .replace(/\.([A-Z0-9]{3})([A-Z0-9])/, '.$1/$2')
    .replace(/([A-Z0-9]{4})(\d)/, '$1-$2');
};

const maskTelefone = (v: string): string => {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const maskData = (v: string): string => {
  const d = soDigitos(v).slice(0, 8);
  return d
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
};

const maskMoeda = (v: string): string => {
  const d = soDigitos(v);
  if (!d) return '';
  const n = Number(d) / 100;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseMoeda = (s: string): number =>
  Number((s || '0').replace(/\./g, '').replace(',', '.')) || 0;

const formatBRL = (n: number): string =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ======================================================================
// Validações
// ======================================================================

const validarCPF = (valor: string): boolean => {
  const c = soAlfaNum(valor);
  if (!/^\d{11}$/.test(c)) return false;
  if (/^(\d)\1{10}$/.test(c)) return false; // 111.111.111-11 etc.

  const dv = (len: number): number => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(c[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
};

/** Aceita CNPJ numérico (antigo) e alfanumérico (novo). Valor de cada caractere = ASCII - 48. */
const validarCNPJ = (valor: string): boolean => {
  const c = soAlfaNum(valor);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(c)) return false;
  if (/^(.)\1{13}$/.test(c)) return false;

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, ...pesos1];
  const dv = (pesos: number[]): number => {
    const soma = pesos.reduce((s, p, i) => s + (c.charCodeAt(i) - 48) * p, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(pesos1) === Number(c[12]) && dv(pesos2) === Number(c[13]);
};

const validarDocumento = (valor: string): boolean => {
  const c = soAlfaNum(valor);
  if (c.length === 11) return validarCPF(c);
  if (c.length === 14) return validarCNPJ(c);
  return false;
};

const validarEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

const validarTelefone = (v: string): boolean => {
  const d = soDigitos(v);
  if (d.length !== 10 && d.length !== 11) return false;
  if (Number(d.slice(0, 2)) < 11) return false; // DDD inválido
  if (d.length === 11 && d[2] !== '9') return false; // celular começa com 9
  return true;
};

/** dd/mm/aaaa -> Date (ou null se for inválida, ex.: 31/02/2026) */
const parseData = (s: string): Date | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (ano < 2000 || mes < 1 || mes > 12) return null;
  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d;
};

const dataParaISO = (d: Date): string => {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// ======================================================================
// Componentes pequenos
// ======================================================================

interface FieldProps extends TextInputProps {
  label: string;
  theme: Theme;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

const Field = ({ label, theme, error, containerStyle, style, ...props }: FieldProps) => (
  <View style={[{ marginBottom: 14 }, containerStyle]}>
    <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[
        styles.input,
        {
          backgroundColor: theme.cardBg,
          borderColor: error ? ERRO_COR : theme.borderColor,
          color: theme.textPrimary,
        },
        props.multiline && styles.textArea,
        style,
      ]}
      accessibilityLabel={String(label)}
    />
    {!!error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

const SectionTitle = ({ children, theme }: { children: React.ReactNode; theme: Theme }) => (
  <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{children}</Text>
);

const Divider = ({ theme }: { theme: Theme }) => (
  <View style={{ height: 1, backgroundColor: theme.borderColor, marginVertical: 16 }} />
);

// ======================================================================
// Tela
// ======================================================================

export default function ContratarScreen({ onSubmit }: ContratarScreenProps) {
  const { theme } = useTheme() as unknown as ThemeContextValue;
  const router = useRouter();
  const params = useLocalSearchParams();
  const meuId = useMeuId(); // id do usuário logado (null se não logado)

  // O artista chega pela URL (expo-router). Quando a URL traz só o id,
  // buscamos os dados na API pública para que acessos diretos também funcionem.
  const param = (key: string): string | undefined => {
    const value = (params as Record<string, string | string[] | undefined>)[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const artistIdParam = param('id') ?? param('artistaId') ?? param('artistId');

  const artistaPorParams: Artista | null = useMemo(() => {
    const id = (() => {
      const value = (params as Record<string, string | string[] | undefined>).id
        ?? (params as Record<string, string | string[] | undefined>).artistaId
        ?? (params as Record<string, string | string[] | undefined>).artistId;
      return Array.isArray(value) ? value[0] : value;
    })();
    const read = (key: string): string | undefined => {
      const value = (params as Record<string, string | string[] | undefined>)[key];
      return Array.isArray(value) ? value[0] : value;
    };
    const nome = read('nome') ?? read('name');
    if (!nome) return null;

    const minimo = Number(read('valorMinimo'));
    const negociar = read('aceitaNegociar');
    return {
      id: id ?? '',
      nome,
      estilo: read('estilo') ?? read('style') ?? '',
      nota: Number(read('nota') ?? read('rating')) || 0,
      avaliacoes: Number(read('avaliacoes') ?? read('reviewsCount')) || 0,
      valorBase: Number(read('valorBase') ?? read('priceFrom')) || 0,
      aceitaNegociar: negociar === 'true' || negociar === '1',
      valorMinimo: minimo > 0 ? minimo : undefined,
    };
  }, [params]);

  const [artistaRemoto, setArtistaRemoto] = useState<Artista | null>(null);
  const [carregandoArtista, setCarregandoArtista] = useState(false);

  useEffect(() => {
    if (artistaPorParams || !artistIdParam) {
      setArtistaRemoto(null);
      setCarregandoArtista(false);
      return;
    }

    let active = true;
    setCarregandoArtista(true);
    fetch(`${URL_API}/api/artistas`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        const raw = Array.isArray(data?.artistas)
          ? data.artistas.find((item: any) => String(item?.id ?? item?.artista_id) === String(artistIdParam))
          : null;
        if (!raw) {
          setArtistaRemoto(null);
          return;
        }
        const services = Array.isArray(raw.servicos) ? raw.servicos : [];
        const prices = services
          .map((service: any) => Number(service?.preco_min ?? service?.preco ?? 0))
          .filter((value: number) => Number.isFinite(value) && value > 0);
        const valorBase = prices.length ? Math.min(...prices) : 0;
        const categorias = Array.isArray(raw.categorias) ? raw.categorias.filter(Boolean) : [];
        setArtistaRemoto({
          id: raw.id ?? raw.artista_id ?? artistIdParam,
          nome: raw.nome_artistico || raw.nome || `Artista ${artistIdParam}`,
          estilo: categorias.join(' • ') || raw.categoria_atuacao || raw.estilo_musical || '',
          nota: Number(raw.avaliacao_media ?? raw.nota_media ?? 0) || 0,
          avaliacoes: Number(raw.total_avaliacoes ?? 0) || 0,
          valorBase,
          aceitaNegociar: Boolean(raw.aceita_negociar ?? raw.aceitaNegociar) || valorBase <= 0,
          valorMinimo: undefined,
        });
      })
      .catch((error) => {
        console.warn('[Contratação] Não foi possível carregar o artista:', error);
        if (active) setArtistaRemoto(null);
      })
      .finally(() => {
        if (active) setCarregandoArtista(false);
      });

    return () => {
      active = false;
    };
  }, [artistIdParam, artistaPorParams]);

  const artista = artistaPorParams ?? artistaRemoto;

  const valorBase = artista?.valorBase ?? 0;
  const valorMinimo = artista?.valorMinimo;
  const podeNegociar = artista?.aceitaNegociar === true || valorBase <= 0;

  const { width } = useWindowDimensions();
  const showSidebar = width >= DESKTOP_BREAKPOINT;
  const narrow = width < 620;
  const twoCols = width >= 900; // formulário em 2 colunas

  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const [enviando, setEnviando] = useState(false);

  // Ninguém pode contratar a si mesmo
  const ehProprioPerfil =
    meuId !== null && !!artista && String(artista.id) !== '' && String(artista.id) === meuId;

  const voltar = () => {
    if (router.canGoBack()) router.back();
    else router.replace(ROTA_FALLBACK as any);
  };

  const set =
    <K extends keyof FormState>(k: K) =>
    (v: FormState[K]) => {
      setForm((p) => ({ ...p, [k]: v }));
      setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
    };

  const valorNumero = parseMoeda(form.valor);
  // Sem preço-base, o valor proposto é obrigatório. Com preço-base, a negociação é opcional.
  const negociando = valorBase <= 0 || (podeNegociar && form.negociar);
  const total = negociando ? valorNumero : valorBase;

  const desconto = useMemo<number | null>(() => {
    if (!negociando || !valorNumero || valorNumero >= valorBase) return null;
    return Math.round(((valorBase - valorNumero) / valorBase) * 100);
  }, [negociando, valorNumero, valorBase]);

  // ---------- Validação do formulário ----------
  const validar = (): FormErrors => {
    const e: FormErrors = {};

    if (form.nome.trim().split(/\s+/).filter(Boolean).length < 2) {
      e.nome = 'Informe nome e sobrenome.';
    }

    if (!form.cpf) e.cpf = 'Informe o CPF ou CNPJ.';
    else if (!validarDocumento(form.cpf)) e.cpf = 'CPF ou CNPJ inválido.';

    if (!form.telefone) e.telefone = 'Informe o telefone.';
    else if (!validarTelefone(form.telefone)) e.telefone = 'Telefone inválido.';

    if (!form.email) e.email = 'Informe o e-mail.';
    else if (!validarEmail(form.email)) e.email = 'E-mail inválido.';

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicio = parseData(form.inicio);
    const prazo = parseData(form.prazo);

    if (!inicio) e.inicio = 'Data inválida (dd/mm/aaaa).';
    else if (inicio < hoje) e.inicio = 'A data não pode estar no passado.';

    if (!prazo) e.prazo = 'Data inválida (dd/mm/aaaa).';
    else if (inicio && prazo < inicio) e.prazo = 'O prazo deve ser igual ou depois do início.';

    if (negociando) {
      if (!valorNumero) {
        e.valor = 'Informe o valor proposto.';
      } else if (valorBase > 0 && valorNumero > valorBase) {
        e.valor = `A proposta não pode ser maior que ${formatBRL(valorBase)}.`;
      } else if (valorMinimo && valorNumero < valorMinimo) {
        e.valor = `O artista não aceita propostas abaixo de ${formatBRL(valorMinimo)}.`;
      }
    }

    if (form.local.trim().length < 5) e.local = 'Informe o local do evento.';
    if (form.descricao.trim().length < 10) e.descricao = 'Descreva o serviço (mín. 10 caracteres).';

    return e;
  };

  const enviar = async () => {
    if (enviando || !artista) return;

    if (ehProprioPerfil) {
      notify('Não permitido', 'Você não pode contratar a si mesmo.');
      return;
    }

    const e = validar();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      notify('Atenção', 'Corrija os campos destacados em vermelho.');
      return;
    }

    const inicio = parseData(form.inicio) as Date;
    const prazo = parseData(form.prazo) as Date;

    const payload: SolicitacaoContratacao = {
      artistaId: artista.id,
      status: 'pendente',
      valorBase,
      negociando,
      valorProposto: negociando ? valorNumero : null,
      mensagemNegociacao: negociando ? form.mensagem.trim() || null : null,
      // Valor fixo: o cliente já concorda com o valor base
      aceitaValorBaseSeRecusar: negociando ? form.aceitaValorBase : true,
      total,
      cliente: {
        nome: form.nome.trim(),
        documento: soAlfaNum(form.cpf),
        telefone: soDigitos(form.telefone),
        email: form.email.trim().toLowerCase(),
      },
      datas: {
        inicio: dataParaISO(inicio),
        prazo: dataParaISO(prazo),
      },
      servico: {
        local: form.local.trim(),
        descricao: form.descricao.trim(),
      },
    };

    try {
      setEnviando(true);
      let propostaId: number | null = null;
      if (onSubmit) {
        await onSubmit(payload);
      } else {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) throw new Error('Sua sessão expirou. Entre novamente para contratar.');
        const artistaId = Number(artista.id);
        if (!Number.isInteger(artistaId) || artistaId <= 0) throw new Error('Artista inválido. Abra o perfil novamente.');

        const conversaResponse = await fetch(`${URL_API}/api/conversas`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ artista_id: artistaId }),
        });
        const conversaData = await conversaResponse.json().catch(() => ({}));
        if (!conversaResponse.ok || !conversaData?.conversa_id) {
          throw new Error(conversaData?.detail || 'Não foi possível iniciar a conversa com o artista.');
        }

        const descricaoEscopo = [
          payload.servico.descricao,
          `Data de início: ${payload.datas.inicio}`,
          payload.mensagemNegociacao ? `Mensagem de negociação: ${payload.mensagemNegociacao}` : '',
        ].filter(Boolean).join('\n');

        const propostaResponse = await fetch(`${URL_API}/api/propostas`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversa_id: Number(conversaData.conversa_id),
            descricao_escopo: descricaoEscopo,
            local_ou_modalidade: payload.servico.local,
            prazo_estimado: payload.datas.prazo,
            valor_proposto: payload.total,
          }),
        });
        const propostaData = await propostaResponse.json().catch(() => ({}));
        if (!propostaResponse.ok || !propostaData?.proposta_id) {
          throw new Error(propostaData?.detail || 'Não foi possível registrar a proposta.');
        }
        propostaId = Number(propostaData.proposta_id);
      }
      notify(
        'Sucesso',
        'Solicitação enviada e registrada. O artista poderá aceitar ou recusar pela área de Contratações.'
      );
      if (propostaId) {
        router.replace({ pathname: '/pages/contratacoes/detalhes', params: { id: String(propostaId) } } as any);
      }
    } catch (err) {
      console.error('Erro ao enviar contratação:', err);
      notify('Erro', 'Não foi possível enviar a solicitação. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const colunaDados = (
    <View style={twoCols ? styles.col : undefined}>
      <SectionTitle theme={theme}>Seus dados</SectionTitle>
      <Field
        theme={theme}
        label="Nome completo"
        value={form.nome}
        onChangeText={set('nome')}
        autoCapitalize="words"
        error={errors.nome}
      />
      <View style={styles.rowTop}>
        <Field
          theme={theme}
          containerStyle={{ flex: 1, marginRight: 10 }}
          label="CPF ou CNPJ"
          placeholder="CPF ou CNPJ"
          keyboardType="default"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={18}
          value={form.cpf}
          onChangeText={(v) => set('cpf')(maskCpfCnpj(v))}
          error={errors.cpf}
        />
        <Field
          theme={theme}
          containerStyle={{ flex: 1 }}
          label="Telefone"
          placeholder="(dd) xxxxx-xxxx"
          keyboardType="phone-pad"
          value={form.telefone}
          onChangeText={(v) => set('telefone')(maskTelefone(v))}
          error={errors.telefone}
        />
      </View>
      <Field
        theme={theme}
        label="E-mail"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={form.email}
        onChangeText={set('email')}
        error={errors.email}
      />

      <Divider theme={theme} />

      <SectionTitle theme={theme}>Datas</SectionTitle>
      <View style={styles.rowTop}>
        <Field
          theme={theme}
          containerStyle={{ flex: 1, marginRight: 10 }}
          label="Início"
          placeholder="dd/mm/aaaa"
          keyboardType="numeric"
          value={form.inicio}
          onChangeText={(v) => set('inicio')(maskData(v))}
          error={errors.inicio}
        />
        <Field
          theme={theme}
          containerStyle={{ flex: 1 }}
          label="Prazo de entrega"
          placeholder="dd/mm/aaaa"
          keyboardType="numeric"
          value={form.prazo}
          onChangeText={(v) => set('prazo')(maskData(v))}
          error={errors.prazo}
        />
      </View>
    </View>
  );

  const colunaValor = (
    <View style={twoCols ? [styles.col, { marginLeft: 28 }] : { marginTop: 20 }}>
      <SectionTitle theme={theme}>Valor</SectionTitle>

      <View style={[styles.valorBase, { backgroundColor: theme.mainBg }]}>
        <Text style={[styles.valorBaseLabel, { color: theme.textPrimary }]}>
          {podeNegociar ? 'Valor a partir de' : 'Valor'}
        </Text>
        <Text style={[styles.valorBaseNumber, { color: theme.accent }]}>
          {formatBRL(valorBase)}
        </Text>
      </View>

      {podeNegociar ? (
        <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 14 }]}>
          <Text style={[styles.label, { color: theme.textPrimary, marginBottom: 0 }]}>
            Quero negociar o valor
          </Text>
          <Switch
            value={form.negociar}
            onValueChange={set('negociar')}
            trackColor={{ false: theme.borderColor, true: theme.accent }}
            thumbColor="#FFFFFF"
          />
        </View>
      ) : (
        <Text style={[styles.hint, { color: theme.textSecondary, marginBottom: 14 }]}>
          Valor fixo definido pelo artista. Ele poderá aceitar ou recusar o pedido.
        </Text>
      )}

      {negociando && (
        <>
          <View style={styles.rowTop}>
            <Field
              theme={theme}
              containerStyle={{ flex: 1, marginRight: 10 }}
              label="Valor proposto"
              keyboardType="numeric"
              value={form.valor ? `R$ ${form.valor}` : ''}
              onChangeText={(v) => set('valor')(maskMoeda(v))}
              error={errors.valor}
            />
            <Field
              theme={theme}
              containerStyle={{ flex: 1 }}
              label="Mensagem (opcional)"
              value={form.mensagem}
              onChangeText={set('mensagem')}
              maxLength={200}
            />
          </View>
          {desconto !== null && !errors.valor && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              {desconto}% abaixo do valor base
            </Text>
          )}

          <View style={[styles.row, { justifyContent: 'space-between', marginTop: 8 }]}>
            <Text
              style={[
                styles.hint,
                { color: theme.textSecondary, flex: 1, marginRight: 10, marginTop: 0, marginBottom: 0 },
              ]}
            >
              Se o artista recusar minha proposta, aceito contratar por {formatBRL(valorBase)}
            </Text>
            <Switch
              value={form.aceitaValorBase}
              onValueChange={set('aceitaValorBase')}
              trackColor={{ false: theme.borderColor, true: theme.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
          <Text style={[styles.hint, { color: theme.textSecondary, marginTop: 6 }]}>
            {form.aceitaValorBase
              ? 'Em caso de recusa, a contratação fecha automaticamente pelo valor base.'
              : 'Em caso de recusa, você será avisado para confirmar ou cancelar.'}
          </Text>
        </>
      )}

      <Divider theme={theme} />

      <SectionTitle theme={theme}>Serviço</SectionTitle>
      <Field
        theme={theme}
        label="Local do evento"
        placeholder="Nome do espaço, endereço e cidade"
        value={form.local}
        onChangeText={set('local')}
        error={errors.local}
      />
      <Field
        theme={theme}
        label="Descrição do serviço"
        placeholder="Ex.: apresentação acústica de 2 horas, 40 convidados"
        multiline
        textAlignVertical="top"
        value={form.descricao}
        onChangeText={set('descricao')}
        error={errors.descricao}
      />
    </View>
  );

  if (carregandoArtista) {
    return (
      <View style={[styles.root, { backgroundColor: theme.mainBg }]}>
        {showSidebar ? <Sidebar /> : null}
        <View style={{ flex: 1 }}>
          <Header />
          <View style={{ padding: 24, gap: 12 }}>
            <Text style={[styles.title, { color: theme.heroText || theme.textPrimary }]}>Carregando artista...</Text>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>Aguarde enquanto buscamos os dados da contratação.</Text>
          </View>
        </View>
      </View>
    );
  }

  // Nenhum artista identificado (acesso direto à tela, sem escolher alguém)
  if (!artista) {
    return (
      <View style={[styles.root, { backgroundColor: theme.mainBg }]}>
        {showSidebar ? <Sidebar /> : null}
        <View style={{ flex: 1 }}>
          <Header />
          <View style={{ padding: 24, gap: 12 }}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              Nenhum artista selecionado
            </Text>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Abra o perfil de um artista e toque em Contratar para iniciar a contratação.
            </Text>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.accent, alignSelf: 'flex-start' }]}
              onPress={voltar}
              accessibilityRole="button"
            >
              <Text style={[styles.btnText, { color: theme.onAccent || '#FFFFFF' }]}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Usuário tentando contratar o próprio perfil
  if (ehProprioPerfil) {
    return (
      <View style={[styles.root, { backgroundColor: theme.mainBg }]}>
        {showSidebar ? <Sidebar /> : null}
        <View style={{ flex: 1 }}>
          <Header />
          <View style={{ padding: 24, gap: 12 }}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              Você não pode contratar a si mesmo
            </Text>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Este é o seu próprio perfil. Escolha outro artista para iniciar uma contratação.
            </Text>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.accent, alignSelf: 'flex-start' }]}
              onPress={voltar}
              accessibilityRole="button"
            >
              <Text style={[styles.btnText, { color: theme.onAccent || '#FFFFFF' }]}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.mainBg }]}>
      {showSidebar ? <Sidebar /> : null}

      <View style={{ flex: 1 }}>
        <Header />

        <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: narrow ? 14 : 24 }]} keyboardShouldPersistTaps="handled">
          {/* Título */}
          <View style={[styles.row, styles.contractHero, { backgroundColor: theme.heroBg || theme.textPrimary }, { justifyContent: 'space-between', marginBottom: 18, alignItems: narrow ? 'flex-start' : 'center', flexDirection: narrow ? 'column' : 'row', gap: narrow ? 12 : 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.breadcrumb, { color: theme.heroMuted || theme.textSecondary }]}>
                Contratações ›{' '}
                <Text style={{ color: theme.artGold || theme.accent }}>Nova contratação</Text>
              </Text>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                Contratar {artista.nome}
              </Text>
            </View>

            <View style={styles.row}>
              <View
                style={[
                  styles.artistIcon,
                  { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.18)' },
                ]}
              >
                <Ionicons name="musical-notes" size={16} color={theme.accent} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.artistGenre, { color: theme.heroMuted || theme.textSecondary }]}>
                  {artista.estilo}
                </Text>
                <Text style={[styles.artistRating, { color: theme.heroMuted || theme.textSecondary }]}>
                  <Text style={{ color: theme.accent }}>★ </Text>
                  {String(artista.nota).replace('.', ',')} ({artista.avaliacoes} avaliações)
                </Text>
              </View>
            </View>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, borderLeftColor: theme.accent }, narrow && { padding: 16 }]}>
            <View style={twoCols ? styles.rowTop : undefined}>
              {colunaDados}
              {colunaValor}
            </View>

            <View style={[styles.footerLine, { backgroundColor: theme.borderColor }]} />

            <View style={[styles.footer, narrow && { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
              <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
                {negociando ? 'Sua proposta' : 'Total'}
              </Text>
              <Text style={[styles.totalValue, { color: theme.accent }]}>{formatBRL(total)}</Text>

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: theme.searchBg, marginLeft: narrow ? 0 : 16 }]}
                onPress={voltar}
                disabled={enviando}
                accessibilityRole="button"
              >
                <Text style={[styles.btnText, { color: theme.textPrimary }]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btn,
                  { backgroundColor: theme.accent, marginLeft: narrow ? 0 : 10, opacity: enviando ? 0.6 : 1 },
                ]}
                onPress={enviar}
                disabled={enviando}
                accessibilityRole="button"
              >
                <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
                  {enviando ? 'Enviando...' : negociando ? 'Enviar proposta' : 'Enviar solicitação'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

// ======================================================================
// Estilos
// ======================================================================

const ERRO_COR = '#D93025';
const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

const styles = StyleSheet.create({
  
  root: { flex: 1, minWidth: 0, flexDirection: 'row' },

  
  // Conteúdo
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 24, paddingBottom: 40 },
  contractHero: { borderRadius: 24, padding: 22, overflow: 'hidden' },
  breadcrumb: { fontSize: 10, marginBottom: 4 },
  title: { fontFamily: serif, fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -0.6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  // linhas de formulário: alinha no topo para a mensagem de erro não desalinhar os campos
  rowTop: { flexDirection: 'row', alignItems: 'flex-start' },
  col: { flex: 1 },

  artistIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artistGenre: { fontSize: 11 },
  artistRating: { fontSize: 10, marginTop: 2 },

  // Card
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 26,
    shadowColor: '#2D1B13',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: { fontFamily: serif, fontSize: 16, fontWeight: '800', marginBottom: 14 },
  label: { fontSize: 11, marginBottom: 6 },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    fontSize: 12,
  },
  textArea: { height: 80, paddingTop: 10 },
  errorText: { color: ERRO_COR, fontSize: 10, marginTop: 4 },

  valorBase: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 14,
  },
  valorBaseLabel: { fontSize: 11 },
  valorBaseNumber: { fontFamily: serif, fontSize: 18, fontWeight: '600' },
  hint: { fontSize: 10, marginTop: -4, marginBottom: 4 },

  // Rodapé
  footerLine: { height: 1, marginTop: 20, marginBottom: 16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  totalLabel: { fontSize: 11, marginRight: 8 },
  totalValue: { fontFamily: serif, fontSize: 18, fontWeight: '600' },
  btn: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 12, fontWeight: '700' },
  
});
