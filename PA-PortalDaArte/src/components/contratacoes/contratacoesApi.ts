import AsyncStorage from '@react-native-async-storage/async-storage';

const URL_API = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export type ContratacaoAPI = {
  id: number;
  conversa_id: number;
  contratante_id: number;
  artista_id: number;
  descricao_escopo: string;
  local_ou_modalidade: string | null;
  prazo_estimado: string | null;
  valor_proposto: string;
  proposta_status: string;
  status_exibicao: string;
  criado_em: string;
  atualizado_em: string;
  artista_nome: string;
  contratante_nome: string;
  contrato_id: number | null;
  contrato_status: string | null;
  contrato_data_inicio: string | null;
  contrato_data_conclusao: string | null;
  papel: 'artista' | 'contratante';
};

async function requisicao(path: string): Promise<any> {
  const token = await AsyncStorage.getItem('access_token');
  if (!token) throw new Error('Entre na sua conta para visualizar suas contratações.');
  const response = await fetch(`${URL_API}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof payload.detail === 'string' ? payload.detail : `Erro HTTP ${response.status}`;
    throw new Error(response.status === 405 ? 'Rota incompatível: confirme que o FastAPI atualizado está em execução (GET /api/contratacoes).' : detail);
  }
  return payload;
}

export async function listarContratacoes(): Promise<ContratacaoAPI[]> {
  const payload = await requisicao('/api/contratacoes');
  return Array.isArray(payload.contratacoes) ? payload.contratacoes : [];
}

export async function obterContratacao(id: string | number): Promise<ContratacaoAPI> {
  const payload = await requisicao(`/api/contratacoes/${encodeURIComponent(String(id))}`);
  if (!payload.contratacao) throw new Error('Contratação não encontrada.');
  return payload.contratacao;
}

export function formatarDinheiro(value: string | number): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Valor indisponível';
}

export function formatarData(value?: string | null): string {
  if (!value) return 'Data não informada';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
