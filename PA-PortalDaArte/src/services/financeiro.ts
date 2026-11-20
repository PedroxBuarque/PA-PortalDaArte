import { apiFetch } from '../app/services/api';

export async function financeiro(path: string, options: any = {}) {
  const response = await apiFetch(`/api/financeiro${path}`, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message = typeof detail === 'string' ? detail
      : Array.isArray(detail) ? detail.map((d: any) => d.msg).join('; ')
      : response.status === 404 ? 'Atualize e reinicie a API para habilitar o fluxo de contratação.'
      : 'Não foi possível concluir a contratação. Tente novamente.';
    throw new Error(message);
  }
  if (!data) throw new Error('A API retornou uma resposta inválida. Verifique se o backend está iniciado.');
  return data;
}
