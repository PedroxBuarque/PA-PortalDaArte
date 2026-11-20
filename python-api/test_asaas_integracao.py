"""Testes HTTP isolados, sem MySQL e sem chamadas ao ASAAS."""
import os
import unittest
from unittest.mock import Mock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pagamentos import asaas_portal as m

class FluxoPagamento(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'ASAAS_API_KEY':'sandbox-fake-test'})
        self.env.start(); self.addCleanup(self.env.stop)
        self.db = Mock()
        self.db.cursor.return_value.fetchone.return_value = (1,)
        app = FastAPI()
        app.include_router(m.criar_router(lambda: self.db, lambda: {'id': 1}))
        self.client = TestClient(app)
        self.contrato = dict(id=7, contratante_id=1, artista_id=2, valor_total='200.00', status='ativo', aceito_artista_em='2026-11-05', aceito_contratante_em='2026-11-05')

    def pix(self):
        return self.client.post('/api/financeiro/pix', json={'contrato_id': 7})

    def test_somente_contratante_paga(self):
        with patch.object(m, 'fetchone', return_value={**self.contrato, 'contratante_id': 3}), patch.object(m, 'asaas') as remoto:
            self.assertEqual(self.pix().status_code, 403)
            remoto.assert_not_called()

    def test_sem_dois_aceites_nao_cobra(self):
        with patch.object(m, 'fetchone', return_value={**self.contrato, 'aceito_artista_em': None}), patch.object(m, 'asaas') as remoto:
            self.assertEqual(self.pix().status_code, 409)
            remoto.assert_not_called()

    def test_reutiliza_cobranca(self):
        existente = dict(id=8, asaas_payment_id='pay_teste', status_externo='PENDING',valor_servico=200,taxa_prevista=5,comissao=20.5,valor_total=225.5,valor_artista=200)
        with patch.object(m, 'fetchone', side_effect=[self.contrato, existente]), patch.object(m, 'asaas') as remoto:
            r = self.pix()
            self.assertEqual(r.status_code, 200)
            self.assertTrue(r.json()['existente'])
            remoto.assert_not_called()

    def test_timeout_anterior_exige_conciliacao(self):
        with patch.object(m, 'fetchone', side_effect=[self.contrato, dict(id=8, asaas_payment_id=None, status_externo='CONCILIAR')]), patch.object(m, 'asaas') as remoto:
            self.assertEqual(self.pix().status_code, 409)
            remoto.assert_not_called()

    def test_split_e_pagamento_pendente(self):
        with patch.dict(os.environ, {'ASAAS_PIX_FEE_ESTIMATED': '5.00'}), patch.object(m, 'fetchone', side_effect=[self.contrato, None, {'wallet_id': 'wallet_artista'}, {'asaas_customer_id': 'cus_teste'}]), patch.object(m, 'execute', side_effect=[8, 9, None]) as sql, patch.object(m, 'asaas', return_value={'id': 'pay_teste', 'status': 'PENDING'}) as remoto:
            r = self.pix()
            self.assertEqual(r.status_code, 200)
            payload = remoto.call_args.args[2]
            self.assertEqual(payload['value'], 225.50)
            self.assertEqual(payload['split'], [{'walletId': 'wallet_artista', 'fixedValue': 200.0}])
            self.assertIn("'pendente'", sql.call_args_list[1].args[1])

    def evento(self, payload, token='segredo_teste'):
        with patch.dict(os.environ, {'ASAAS_WEBHOOK_TOKEN': 'segredo_teste'}):
            return self.client.post('/api/financeiro/webhook/asaas', json=payload, headers={'asaas-access-token': token})

    def test_webhook_token_invalido(self):
        self.assertEqual(self.evento({'id': 'evt_1'}, 'errado').status_code, 401)
        self.db.cursor.assert_not_called()

    def test_webhook_array(self):
        self.assertEqual(self.evento([]).status_code, 400)

    def test_webhook_duplicado(self):
        with patch.object(m, 'fetchone', return_value={'evento_id': 'evt_1','processado_em':'2026-11-06'}), patch.object(m, 'execute') as sql:
            r = self.evento({'id': 'evt_1', 'event': 'PAYMENT_RECEIVED', 'payment': {'id': 'pay_teste'}})
            self.assertEqual(r.status_code, 200)
            self.assertTrue(r.json()['duplicado'])
            sql.assert_not_called()

    def test_estorno_nao_regride(self):
        for evento in ('PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'):
            with self.subTest(evento=evento), patch.object(m, 'fetchone', side_effect=[None, {'id': 8, 'pagamento_id': 9, 'status_externo': 'PAYMENT_REFUNDED'}]), patch.object(m, 'execute') as sql:
                self.assertEqual(self.evento({'id': 'evt_2', 'event': evento, 'payment': {'id': 'pay_teste'}}).status_code, 200)
                comandos = [c.args[1] for c in sql.call_args_list]
                self.assertFalse(any('UPDATE pagamentos' in cmd or 'UPDATE asaas_cobrancas' in cmd for cmd in comandos))
