import AsyncStorage from '@react-native-async-storage/async-storage';

const URL_API = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export type PropostaStatus = 'em_negociacao' | 'aceita' | 'recusada' | 'expirada';
export type ContratoStatus = 'aguardando_aceite' | 'ativo' | 'concluido' | 'cancelado' | 'em_disputa' | null;

export type PropostaApi = {
  id: number;
  conversa_id: number;
  contratante_id: number;
  artista_id: number;
  servico_id: number | null;
  descricao_escopo: string;
  local_ou_modalidade: string | null;
  prazo_estimado: string | null;
  valor_proposto: number;
  status: PropostaStatus;
  criado_em: string | null;
  atualizado_em: string | null;
  artista_nome: string;
  contratante_nome: string;
  servico_titulo: string;
  categoria_atuacao?: string | null;
  contrato_id: number | null;
  contrato_status: ContratoStatus;
  papel_atual: 'contratante' | 'artista';
};

async function token() {
  const value = await AsyncStorage.getItem('access_token');
  if (!value) throw new Error('Sua sessão expirou. Entre novamente.');
  return value;
}

async function request(path: string, init: RequestInit = {}) {
  const accessToken = await token();
  const response = await fetch(`${URL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.mensagem || 'Não foi possível concluir a operação.');
  }
  return payload;
}

export async function listarPropostas(): Promise<PropostaApi[]> {
  const payload = await request('/api/propostas');
  return Array.isArray(payload?.propostas) ? payload.propostas : [];
}

export async function obterProposta(id: string | number): Promise<PropostaApi> {
  const payload = await request(`/api/propostas/${encodeURIComponent(String(id))}`);
  if (!payload?.proposta) throw new Error('Contratação não encontrada.');
  return payload.proposta as PropostaApi;
}

export async function responderProposta(id: string | number, acao: 'aceitar' | 'recusar') {
  return request(`/api/propostas/${encodeURIComponent(String(id))}/responder`, {
    method: 'POST',
    body: JSON.stringify({ acao }),
  });
}

export function statusPropostaLabel(item: PropostaApi): string {
  if (item.contrato_status === 'concluido') return 'Concluido';
  if (item.contrato_status === 'ativo' || item.status === 'aceita') return 'Confirmado';
  if (item.status === 'recusada') return 'Recusada';
  if (item.status === 'expirada') return 'Expirada';
  return 'Pendente';
}

export function formatarDataProposta(value: string | null): string {
  if (!value) return 'Prazo a combinar';
  const iso = value.length === 10 ? `${value}T12:00:00` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
}

export function formatarMoeda(value: number): string {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
