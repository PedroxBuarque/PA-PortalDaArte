import { VLibrasText as Text } from './accessibility/VLibrasText';
import { AccessibleTextInput as TextInput } from './accessibility/AccessibleTextInput';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View, Linking, useWindowDimensions } from 'react-native';
import { useTheme } from './context/ThemeContext';
import { apiFetch } from '../app/services/api';

const PREFIX = '/api/financeiro';
const moeda = (n: any) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function obter(url: string, options?: any) {
  const resposta = await apiFetch(url, options || {});
  const data = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const detalhe = data?.detail;
    throw new Error(typeof detalhe === 'string' ? detalhe : `Erro HTTP ${resposta.status}`);
  }
  return data;
}

type Contrato = {
  id: number; status: string; valor_total: number; nome_artistico: string;
  contratante_id: number; artista_id: number; aceito_artista_em?: string;
  aceito_contratante_em?: string;
};

type Props = { contratoInicial?: string; modoTeste?: boolean };

export default function PagamentoPixSandbox({ contratoInicial = '', modoTeste = false }: Props) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 768;
  const [usuarioId, setUsuarioId] = useState<number | null>(null);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [contratoId, setContratoId] = useState(contratoInicial);
  const [config, setConfig] = useState<any>(null);
  const [previa, setPrevia] = useState<any>(null);
  const [cobranca, setCobranca] = useState<any>(null);
  const [nota, setNota] = useState<any>(null);
  const [qr, setQr] = useState<any>(null);
  const [statusCobranca, setStatusCobranca] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [simValor, setSimValor] = useState('200');
  const [simTaxa, setSimTaxa] = useState('5');

  const cor = theme.textPrimary;
  const secundario = theme.textSecondary;
  const borda = theme.borderColor;
  const card = theme.cardBg;
  const botao = (titulo: string, fn: () => void, disabled = false) => (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={titulo} onPress={fn} disabled={ocupado || disabled}
      style={[styles.botao, (ocupado || disabled) && { opacity: .46 }]}>
      <Text style={styles.botaoTexto}>{titulo}</Text>
    </TouchableOpacity>
  );
  const texto = (valor: string, destaque = false) => (
    <Text selectable style={{ color: destaque ? theme.accent : cor, marginTop: 7 }}>{valor}</Text>
  );
  const cartao = (children: React.ReactNode) => (
    <View style={[styles.card, { backgroundColor: card, borderColor: borda }]}>{children}</View>
  );
  const executar = async (fn: () => Promise<void>) => {
    setOcupado(true); setErro(''); setMensagem('');
    try { await fn(); } catch (e: any) { setErro(e?.message || 'Falha inesperada'); }
    finally { setOcupado(false); }
  };
  const carregar = useCallback(async () => {
    const [c, conf] = await Promise.all([obter(`${PREFIX}/contratos`), obter(`${PREFIX}/config`)]);
    setContratos(c.contratos || []); setUsuarioId(c.usuario_id); setConfig(conf);
  }, []);
  const escolher = useCallback((id: string) => {
    setContratoId(id);
    setPrevia(null);
    setCobranca(null);
    setNota(null);
    setQr(null);
    setStatusCobranca(null);
    setMensagem('');
    setErro('');
  }, []);
  const mostrarPrevia = useCallback((p: any) => {
    setPrevia(p);
    setCobranca(p.cobranca ? { cobranca: p.cobranca, valores: p.valores } : null);
  }, []);
  useEffect(() => {
    let atual = true;
    escolher(contratoInicial);
    setOcupado(true);
    const abrir = async () => {
      try {
        await carregar();
        if (atual && contratoInicial) {
          const p = await obter(`${PREFIX}/contratos/${contratoInicial}/previa`);
          if (atual) mostrarPrevia(p);
        }
      } catch (e) {
        if (atual) setErro(e instanceof Error ? e.message : 'Não foi possível abrir o pagamento.');
      } finally {
        if (atual) setOcupado(false);
      }
    };
    void abrir();
    return () => { atual = false; };
  }, [carregar, contratoInicial, escolher, mostrarPrevia]);
  const carregarPrevia = async () => {
    if (!contratoId) throw new Error('Selecione um contrato antes de continuar.');
    mostrarPrevia(await obter(`${PREFIX}/contratos/${contratoId}/previa`));
  };
  const prever = () => executar(carregarPrevia);
  const criar = (comNota: boolean) => executar(async () => {
    if (previa?.contrato_id !== Number(contratoId)) throw new Error('Consulte os valores do contrato.');
    let p;
    try {
      p = await obter(`${PREFIX}/${comNota ? 'pix-com-nota' : 'pix'}`, {
        method: 'POST', body: JSON.stringify({ contrato_id: Number(contratoId), total_previsto: previa.valores.valor_total })
      });
    } catch (error) {
      // A resposta pode ter se perdido depois de a API gravar a cobrança.
      // Consultar a reserva permite retomar pela conciliação sem reenviar o PIX.
      await carregarPrevia().catch(() => {});
      throw error;
    }
    setCobranca(p); setNota(p.nota_fiscal); setQr(null); setStatusCobranca(null);
    setMensagem(p.existente ? 'Cobrança existente recuperada sem gerar duplicidade.' : 'Cobrança criada no ASAAS Sandbox. Ainda não está paga.');
  });
  const consultar = () => executar(async () => {
    const id = cobranca?.cobranca?.id;
    if (!id) throw new Error('Crie ou recupere uma cobrança primeiro.');
    setStatusCobranca(await obter(`${PREFIX}/cobrancas/${id}`));
  });
  const buscarQr = () => executar(async () => {
    const id = cobranca?.cobranca?.id;
    if (!id) throw new Error('Crie ou recupere uma cobrança primeiro.');
    setQr(await obter(`${PREFIX}/cobrancas/${id}/pix`));
  });
  const simServico = Math.max(0, Number(simValor.replace(',', '.')) || 0);
  const simAsaas = Math.max(0, Number(simTaxa.replace(',', '.')) || 0);
  const simComissao = Math.round((simServico + simAsaas) * 10) / 100;
  const souContratante = previa?.sou_contratante === true;
  const podePagar = previa?.contrato_id === Number(contratoId) && previa?.status_contrato === 'ativo' &&
    souContratante && previa.ambos_aceitaram && previa.carteira_vinculada && config?.chave_asaas_configurada;

  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: compact ? 14 : 22, paddingTop: compact ? 18 : 22, paddingBottom: 65, width: '100%', maxWidth: 980, alignSelf: 'center' }}>
    <Text style={[styles.titulo, { color: cor }]}>{modoTeste ? 'Laboratório ASAAS Sandbox' : 'Pagamento da contratação'}</Text>
    <Text style={{ color: secundario, marginTop: 5 }}>
      PIX com split • Comissão de 10% sobre serviço + tarifa estimada • Ambiente de testes
    </Text>
    {modoTeste && cartao(<>
      <Text style={[styles.subtitulo, { color: cor }]}>1. Simulação local de valores</Text>
      <Text style={{ color: secundario }}>Não cria cobrança nem acessa o ASAAS.</Text>
      <Text style={[styles.rotulo, { color: cor }]}>Valor do serviço (R$)</Text>
      <TextInput value={simValor} onChangeText={setSimValor} keyboardType="decimal-pad"
        style={[styles.input, { color: cor, borderColor: borda }]} />
      <Text style={[styles.rotulo, { color: cor }]}>Taxa ASAAS estimada (R$)</Text>
      <TextInput value={simTaxa} onChangeText={setSimTaxa} keyboardType="decimal-pad"
        style={[styles.input, { color: cor, borderColor: borda }]} />
      {texto(`Artista: ${moeda(simServico)}`)}
      {texto(`Tarifa prevista: ${moeda(simAsaas)}`)}
      {texto(`Comissão Portal: ${moeda(simComissao)}`)}
      {texto(`Total contratante: ${moeda(simServico + simAsaas + simComissao)}`, true)}
    </>)}
    {cartao(<>
      <Text style={[styles.subtitulo, { color: cor }]}>Contratações no MySQL</Text>
      {texto(`Chave ASAAS Sandbox: ${config ? (config.chave_asaas_configurada ? 'configurada' : 'não configurada') : 'não verificada'}`)}
      {texto(`Webhook: ${config ? (config.webhook_configurado ? 'configurado' : 'não configurado') : 'não verificado'}`)}
      {texto(`Tarifa PIX prevista: ${config?.taxa_pix_estimada == null ? 'aguardando configuração' : moeda(config.taxa_pix_estimada)}`)}
      {botao('Atualizar contratos', () => executar(carregar))}
      {contratos.length === 0 && <Text style={{ color: secundario, marginTop: 14 }}>
        Seus contratos aparecerão aqui depois do aceite da proposta e da geração do contrato.
      </Text>}
      {contratos.map(c => <TouchableOpacity key={c.id} disabled={ocupado} accessibilityRole="button" onPress={() => escolher(String(c.id))}
        style={[styles.contrato, { borderColor: String(c.id) === contratoId ? theme.accent : borda }]}>
        <Text style={{ color: cor, fontWeight: '700' }}>Contrato #{c.id} • {c.nome_artistico}</Text>
        <Text style={{ color: secundario, marginTop: 3 }}>{moeda(c.valor_total)} • {c.status}</Text>
        <Text style={{ color: secundario, marginTop: 2 }}>
          {c.contratante_id === usuarioId ? 'Você é o contratante' : 'Você é o artista'}
        </Text>
      </TouchableOpacity>)}
      <Text style={[styles.rotulo, { color: cor }]}>ID do contrato</Text>
      <TextInput accessibilityLabel="ID do contrato" editable={!ocupado} value={contratoId} onChangeText={escolher} keyboardType="numeric"
        style={[styles.input, { color: cor, borderColor: borda }]} />
      {botao('Consultar valores oficiais no backend', prever, !contratoId)}
      {previa && <View style={{ marginTop: 12 }}>
        {texto(`Serviço artístico: ${moeda(previa.valores.valor_servico)}`)}
        {texto(`Tarifa prevista: ${moeda(previa.valores.taxa_prevista)}`)}
        {texto(`Comissão do Portal: ${moeda(previa.valores.comissao)}`)}
        {texto(`Total contratante: ${moeda(previa.valores.valor_total)}`, true)}
        {texto(`Carteira do artista verificada: ${previa.carteira_vinculada ? 'sim' : 'não'}`)}
        {texto(`Contrato: ${previa.status_contrato}`)}
      </View>}
    </>)}
    {cartao(<>
      <Text style={[styles.subtitulo, { color: cor }]}>Pagamento PIX Sandbox</Text>
      <Text style={{ color: secundario }}>
        A cobrança só é habilitada para contrato ativo, aceito por ambas as partes e com carteira ASAAS validada.
      </Text>
      {!cobranca && <>
        {config?.nota_fiscal_configurada && botao('Criar PIX e solicitar nota fiscal', () => criar(true), !podePagar)}
        {(modoTeste || !config?.nota_fiscal_configurada) && botao('Criar PIX de teste', () => criar(false), !podePagar)}
        {!previa && texto('Consulte os valores para conferir o total antes de criar o PIX.')}
        {!config?.nota_fiscal_configurada && texto('Para testar a NFS-e, configure o serviço municipal e os impostos no backend.')}
      </>}
      {!!cobranca && <>
        {texto(`Total registrado da cobrança: ${moeda(cobranca.valores?.valor_total)}`, true)}
        {texto(`ID local: ${cobranca.cobranca?.id}`)}
        {texto(`ID ASAAS: ${cobranca.cobranca?.asaas_payment_id || 'aguardando conciliação'}`)}
        {texto(`Situação registrada: ${statusCobranca?.status_local || cobranca.cobranca?.status_externo}`)}
        {souContratante && botao('Exibir QR Code PIX', buscarQr, !cobranca.cobranca?.asaas_payment_id)}
        {botao('Consultar status ASAAS', consultar)}
        {souContratante && botao('Validar pagamento no Asaas', () => executar(async () => {
          const r = await obter(`${PREFIX}/cobrancas/${cobranca.cobranca.id}/conciliar`, { method: 'POST' });
          const p = await obter(`${PREFIX}/contratos/${contratoId}/previa`);
          setCobranca({ cobranca: p.cobranca, valores: p.valores });
          setStatusCobranca(null);
          setMensagem(`Cobrança conciliada. Situação no Asaas: ${r.status}.`);
        }))}
        {botao('Consultar nota fiscal', () => executar(async()=>{setNota(await obter(`${PREFIX}/cobrancas/${cobranca.cobranca.id}/nota-fiscal`));}))}
        {souContratante && config?.nota_fiscal_configurada && botao('Solicitar ou recuperar nota fiscal', () => executar(async()=>{setNota(await obter(`${PREFIX}/cobrancas/${cobranca.cobranca.id}/nota-fiscal`,{method:'POST'}));}))}
        {!!nota && texto(`Nota fiscal: ${nota.status}${nota.erro ? ' • '+nota.erro : ''}`)}
        {nota?.status === 'AUTHORIZED' && !!nota.pdf_url && botao('Abrir PDF da nota', ()=>Linking.openURL(nota.pdf_url))}
        {nota?.status === 'AUTHORIZED' && !!nota.xml_url && botao('Abrir XML da nota', ()=>Linking.openURL(nota.xml_url))}
      </>}
      {!!qr?.encodedImage && <Image source={{ uri: `data:image/png;base64,${qr.encodedImage}` }}
        style={{ width: Math.min(230, Math.max(160, width - 110)), height: Math.min(230, Math.max(160, width - 110)), marginTop: 15 }} />}
      {!!qr?.payload && <Text selectable style={{ color: cor, marginTop: 9 }}>
        PIX copia e cola: {qr.payload}
      </Text>}
      {!!statusCobranca && texto(`Asaas: ${statusCobranca.status_asaas || 'aguardando conciliação'} • Repasse: ${statusCobranca.status_split}`)}
    </>)}
    {ocupado && <ActivityIndicator style={{ marginTop: 18 }} color={theme.accent} />}
    {!!erro && <Text selectable style={{ color: '#D54343', marginTop: 18, fontWeight: '700' }}>Erro: {erro}</Text>}
    {!!mensagem && <Text selectable style={{ color: theme.accent, marginTop: 16 }}>{mensagem}</Text>}
    <Text style={{ color: secundario, marginTop: 20 }}>
      Sandbox não movimenta dinheiro real. O recebimento é validado pelo backend via webhook autenticado ou conciliação com o Asaas. Uma cobrança criada ainda não está paga.
    </Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  titulo: { fontSize: 26, fontWeight: '800' },
  subtitulo: { fontSize: 19, fontWeight: '700', marginBottom: 6 },
  card: { borderWidth: 1, padding: 18, marginTop: 18, borderRadius: 13 },
  botao: { borderRadius: 9, padding: 13, marginTop: 13, backgroundColor: '#E05A10', alignItems: 'center' },
  botaoTexto: { color: '#FFF', fontWeight: '700', textAlign: 'center' },
  contrato: { borderWidth: 1, borderRadius: 9, padding: 11, marginTop: 10 },
  rotulo: { marginTop: 13, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 11 },
});
