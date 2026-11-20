import json
import os
import unittest
from contextlib import nullcontext
from unittest.mock import Mock, patch
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pagamentos import asaas_portal as m
from pagamentos import operacoes as o

FISCAL={'ASAAS_API_KEY':'sandbox-test','ASAAS_NF_BASE':'comissao','ASAAS_NF_CONFIG_JSON':json.dumps({'municipalServiceCode':'TESTE','municipalServiceName':'Servico de homologacao','taxes':{'retainIss':False,'iss':0}})}
class Operacoes(unittest.TestCase):
    def setUp(self):
        ambiente = patch.dict(os.environ, {'ASAAS_PIX_FEE_ESTIMATED': '5.00'})
        ambiente.start()
        self.addCleanup(ambiente.stop)
        self.db=Mock();self.db.cursor.return_value.fetchone.return_value=(1,)
        app=FastAPI();app.include_router(m.criar_router(lambda:self.db,lambda:{'id':1}));self.client=TestClient(app)
        self.row={'id':8,'contrato_id':7,'contratante_id':1,'artista_id':2,'asaas_payment_id':'pay_test','pagamento_id':9,'chave_idempotencia':'portal-contrato-7-pix-1','valor_servico':200,'taxa_prevista':5,'comissao':20.5,'valor_total':225.5,'valor_artista':200}
        self.contrato={'id':7,'contratante_id':1,'artista_id':2,'status':'ativo','valor_total':200,'aceito_artista_em':'ok','aceito_contratante_em':'ok'}
    def test_config_fiscal_falha_antes_de_pix(self):
        with patch.dict(os.environ,{'ASAAS_NF_CONFIG_JSON':'{}'}),patch.object(m,'execute') as sql,patch.object(m,'asaas') as api:
            r=self.client.post('/api/financeiro/pix-com-nota',json={'contrato_id':7})
            self.assertEqual(r.status_code,503);sql.assert_not_called();api.assert_not_called()
    def test_nota_valor_vem_do_banco(self):
        with patch.dict(os.environ,FISCAL),patch.object(m,'fetchone',return_value=None),patch.object(m,'execute',return_value=11),patch.object(m,'asaas',return_value={'id':'inv_test','status':'SCHEDULED'}) as api:
            n=o.agendar_nota(self.db,self.row)
            self.assertEqual(n['status'],'SCHEDULED');payload=api.call_args.args[2]
            self.assertEqual(payload['payment'],'pay_test');self.assertEqual(payload['value'],20.5);self.assertFalse(payload['updatePayment'])
    def test_nota_existente_nao_emite_outra(self):
        with patch.dict(os.environ,FISCAL),patch.object(m,'fetchone',return_value={'id':11,'asaas_invoice_id':'inv_test'}),patch.object(m,'asaas') as api:
            o.agendar_nota(self.db,self.row);api.assert_not_called()
    def test_nota_timeout_fica_conciliavel(self):
        with patch.dict(os.environ,FISCAL),patch.object(m,'fetchone',return_value=None),patch.object(m,'execute',return_value=11) as sql,patch.object(m,'asaas',side_effect=HTTPException(503,'timeout')):
            with self.assertRaises(HTTPException):o.agendar_nota(self.db,self.row)
            self.assertIn('CONCILIAR',sql.call_args.args[1])
    def test_nota_pendente_so_get(self):
        with patch.dict(os.environ,FISCAL),patch.object(m,'fetchone',return_value={'id':11,'asaas_invoice_id':None}),patch.object(m,'asaas',return_value={'data':[]}) as api:
            with self.assertRaises(HTTPException):o.agendar_nota(self.db,self.row)
            self.assertEqual(api.call_args.args[0],'GET');self.assertEqual(api.call_count,1)
    def test_nota_autorizada_consulta_estado_atual(self):
        with patch.object(m,'fetchone',return_value={'id':11}),patch.object(m,'asaas',return_value={'status':'AUTHORIZED','pdfUrl':'https://sandbox.asaas.com/invoice.pdf'}) as api,patch.object(m,'execute') as sql:
            self.assertTrue(m.processar_evento(self.db,{'event':'INVOICE_AUTHORIZED','invoice':{'id':'inv_test'}}))
            self.assertEqual(sql.call_args.args[2][0],'AUTHORIZED')
    def test_evento_precoce_nao_e_marcado_processado(self):
        with patch.dict(os.environ,{'ASAAS_WEBHOOK_TOKEN':'test'}),patch.object(m,'fetchone',side_effect=[None,None]),patch.object(m,'execute') as sql:
            r=self.client.post('/api/financeiro/webhook/asaas',headers={'asaas-access-token':'test'},json={'id':'evt_early','event':'PAYMENT_RECEIVED','payment':{'id':'pay_test','value':225.5}})
            self.assertEqual(r.status_code,200)
            self.assertFalse(any('processado_em=NOW()' in c.args[1] for c in sql.call_args_list))
    def test_reenvio_evento_pendente_e_aplicado(self):
        with patch.dict(os.environ,{'ASAAS_WEBHOOK_TOKEN':'test'}),patch.object(m,'fetchone',side_effect=[{'evento_id':'evt_early','processado_em':None},{'id':8,'pagamento_id':9,'status_externo':'PENDING','valor_total':225.5}]),patch.object(m,'execute') as sql:
            r=self.client.post('/api/financeiro/webhook/asaas',headers={'asaas-access-token':'test'},json={'id':'evt_early','event':'PAYMENT_RECEIVED','payment':{'id':'pay_test','value':225.5}})
            self.assertEqual(r.status_code,200);self.assertTrue(any("status='pago'" in c.args[1] for c in sql.call_args_list))
    def test_webhook_valor_divergente_nao_baixa_pagamento(self):
        with patch.object(m, 'fetchone', return_value={**self.row, 'status_externo':'PENDING'}), patch.object(m, 'execute') as sql:
            aplicado = m.processar_evento(self.db, {'event':'PAYMENT_RECEIVED','payment':{'id':'pay_test','value':10}})
            self.assertFalse(aplicado)
            sql.assert_not_called()

    def test_webhook_sem_valor_usa_status_e_valor_consultados(self):
        with patch.object(m, 'fetchone', return_value={**self.row, 'status_externo':'PENDING'}), patch.object(m, 'execute') as sql, patch.object(m, 'asaas', return_value={'id':'pay_test','value':225.5,'status':'CONFIRMED'}):
            self.assertTrue(m.processar_evento(self.db, {'event':'PAYMENT_RECEIVED','payment':{'id':'pay_test'}}))
            self.assertTrue(any("status='processando'" in c.args[1] for c in sql.call_args_list))
            self.assertFalse(any("status='pago'" in c.args[1] for c in sql.call_args_list))

    def test_chave_ausente_nao_reserva_pagamento(self):
        with patch.dict(os.environ,{'ASAAS_API_KEY':''}),patch.object(m,'fetchone',return_value=self.contrato),patch.object(m,'execute') as sql:
            r=self.client.post('/api/financeiro/pix',json={'contrato_id':7});self.assertEqual(r.status_code,503);sql.assert_not_called()
    def test_cobranca_preserva_preco_original(self):
        with patch.dict(os.environ,{'ASAAS_API_KEY':'test','ASAAS_PIX_FEE_ESTIMATED':'10'}),patch.object(m,'fetchone',side_effect=[self.contrato,self.row]):
            r=self.client.post('/api/financeiro/pix',json={'contrato_id':7});self.assertEqual(r.status_code,200);self.assertEqual(r.json()['valores']['valor_total'],225.5)
    def test_conciliacao_verifica_valor(self):
        with patch.object(m,'fetchone',return_value=self.row),patch.object(m,'asaas',return_value={'id':'pay_test','value':1,'status':'RECEIVED'}),patch.object(m,'execute') as sql:
            with self.assertRaises(HTTPException):o.conciliar_cobranca(self.db,self.row)
            sql.assert_not_called()
    def test_confirmed_nao_e_pago(self):
        with patch.object(m,'fetchone',return_value=self.row),patch.object(m,'asaas',return_value={'id':'pay_test','value':225.5,'status':'CONFIRMED'}),patch.object(m,'execute') as sql:
            o.conciliar_cobranca(self.db,self.row)
            self.assertTrue(any(c.args[2][0]=='processando' for c in sql.call_args_list if 'UPDATE pagamentos' in c.args[1]))

    def test_conciliacao_rele_pagamento_apos_obter_trava(self):
        anterior = {**self.row, 'asaas_payment_id': None, 'pagamento_id': None}
        with patch.object(m, 'fetchone', return_value=self.row) as ler, patch.object(m, 'execute') as sql, \
                patch.object(m, 'asaas', return_value={'id':'pay_test','value':225.5,'status':'RECEIVED'}) as api:
            resultado = o.conciliar_cobranca(self.db, anterior)
            self.assertIn('FOR UPDATE', ler.call_args.args[1])
            api.assert_called_once_with('GET', '/payments/pay_test')
            self.assertEqual(resultado['pagamento_id'], 9)
            self.assertFalse(any('INSERT INTO pagamentos' in chamada.args[1] for chamada in sql.call_args_list))

    def test_config_separa_pix_de_nota(self):
        with patch.dict(os.environ, {**FISCAL,'ASAAS_NF_CONFIG_JSON':'{}'}):
            dados = self.client.get('/api/financeiro/config').json()
            self.assertTrue(dados['chave_asaas_configurada'])
            self.assertFalse(dados['nota_fiscal_configurada'])
        with patch.dict(os.environ, FISCAL):
            self.assertTrue(self.client.get('/api/financeiro/config').json()['nota_fiscal_configurada'])

    def test_nota_em_recuperacao_rejeita_outro_pagamento(self):
        reserva = {'id':11,'asaas_invoice_id':None,'valor':20.5}
        nota = {'id':'inv_test','externalReference':'portal-nota-8','payment':'outro','value':20.5}
        with patch.dict(os.environ,FISCAL), patch.object(m,'fetchone',return_value=reserva), \
                patch.object(m,'asaas',return_value={'data':[nota]}) as api, patch.object(m,'execute') as sql:
            with self.assertRaises(HTTPException) as erro:
                o.agendar_nota(self.db,self.row)
            self.assertEqual(erro.exception.status_code, 409)
            self.assertEqual(api.call_args.args[0], 'GET')
            sql.assert_not_called()
    def test_carteira_exige_autorizacao(self):
        with patch.object(m,'fetchone',return_value=None),patch.object(m,'asaas') as api:
            r=self.client.post('/api/financeiro/cobrancas/8/nota-fiscal');self.assertEqual(r.status_code,404);api.assert_not_called()
    def test_mutex_recusa_concorrencia(self):
        self.db.cursor.return_value.fetchone.return_value=(0,)
        with self.assertRaises(HTTPException):
            with m.trava(self.db,'test'):self.fail('Nao pode entrar')

    def test_timeout_cliente_nao_repete_post(self):
        dados={'nome_completo':'Cliente teste','cpf':'12345678901','cnpj':None,'email':'test@example.com'}
        with patch.dict(os.environ,{'ASAAS_API_KEY':'test'}),patch.object(m,'fetchone',side_effect=[self.contrato,None,{'wallet_id':'wallet'},None,dados,None]),patch.object(m,'execute') as sql,patch.object(m,'asaas',side_effect=[{'data':[]},HTTPException(503,'timeout')]) as api:
            r=self.client.post('/api/financeiro/pix',json={'contrato_id':7})
            self.assertEqual(r.status_code,503)
            self.assertEqual(sum(c.args[0]=='POST' for c in api.call_args_list),1)
            self.assertTrue(any('INSERT INTO asaas_clientes_pendentes' in c.args[1] for c in sql.call_args_list))
        with patch.dict(os.environ,{'ASAAS_API_KEY':'test'}),patch.object(m,'fetchone',side_effect=[self.contrato,None,{'wallet_id':'wallet'},None,dados,{'usuario_id':1}]),patch.object(m,'execute'),patch.object(m,'asaas',return_value={'data':[]}) as api:
            r=self.client.post('/api/financeiro/pix',json={'contrato_id':7})
            self.assertEqual(r.status_code,409);self.assertEqual(api.call_args.args[0],'GET')
