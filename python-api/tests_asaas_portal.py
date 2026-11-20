"""Testes sem banco e sem chamadas externas (python -m unittest tests_asaas_portal)."""
import os
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from pagamentos.asaas_portal import cotacao, criar_router, dinheiro

class TesteValoresAsaas(unittest.TestCase):
    def test_cotacao_comissao(self):
        with patch.dict(os.environ, {'ASAAS_PIX_FEE_ESTIMATED': '5.00'}):
            total = cotacao('200.00')
        self.assertEqual(total['valor_servico'], 200.0)
        self.assertEqual(total['comissao'], 20.50)
        self.assertEqual(total['valor_total'], 225.50)
        self.assertEqual(total['valor_artista'], 200.0)

    def test_rejeita_valor_negativo(self):
        with patch.dict(os.environ, {'ASAAS_PIX_FEE_ESTIMATED': '0'}):
            with self.assertRaises(HTTPException): cotacao('-5')

    def test_arredondamento(self):
        self.assertEqual(str(dinheiro('11.125')), '11.13')

    def test_rotas_registradas(self):
        router = criar_router(lambda: None, lambda: {'id': 1})
        paths = {r.path for r in router.routes}
        self.assertIn('/api/financeiro/contratos', paths)
        self.assertIn('/api/financeiro/pix', paths)
        self.assertIn('/api/financeiro/webhook/asaas', paths)

if __name__ == '__main__': unittest.main()
