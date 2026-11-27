"""Testes do dashboard administrativo e do registro anonimo de visitas."""
import unittest
from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

import admin


def usuario_falso():
    return {"id": 1, "email": "admin@portaldaarte.local"}


def banco_mock(eh_admin=True, linhas=None, primeira_linha=None):
    conexao = MagicMock()
    cursor = conexao.cursor.return_value
    cursor.fetchone.return_value = ({"id": 1} if eh_admin else None) if primeira_linha is None else primeira_linha
    cursor.fetchall.return_value = linhas or []
    cursor.rowcount = 1
    return conexao


class AdminTests(unittest.TestCase):
    def setUp(self):
        self.conexao = banco_mock()
        self.app = FastAPI()
        self.app.include_router(admin.criar_router(lambda: self.conexao, usuario_falso))
        self.app.dependency_overrides[usuario_falso] = usuario_falso
        self.client = TestClient(self.app)

    def test_verificar_admin(self):
        resposta = self.client.get("/api/admin/verificar")
        self.assertEqual(resposta.status_code, 200)
        self.assertTrue(resposta.json()["admin"])

    def test_acesso_negado_sem_papel_admin(self):
        conexao = banco_mock(eh_admin=False)
        app = FastAPI()
        app.include_router(admin.criar_router(lambda: conexao, usuario_falso))
        app.dependency_overrides[usuario_falso] = usuario_falso
        resposta = TestClient(app).get("/api/admin/verificar")
        self.assertEqual(resposta.status_code, 403)

    def test_resumo_tem_kpis(self):
        self.conexao.cursor.return_value.fetchone.return_value = {
            "id": 1, "usuarios": 7, "contratos_ativos": 1, "pix_recebidos": 2,
        }
        resposta = self.client.get("/api/admin/resumo")
        self.assertEqual(resposta.status_code, 200)
        self.assertIn("pix_recebidos", resposta.json())

    def test_usuarios_devolve_documento_mascarado(self):
        self.conexao.cursor.return_value.fetchall.return_value = [{
            "id": 10, "email": "cliente.test@example.com", "status": "ativo",
            "cpf": "12345678909", "cnpj": None,
        }]
        resposta = self.client.get("/api/admin/usuarios")
        self.assertEqual(resposta.status_code, 200)
        usuario = resposta.json()["usuarios"][0]
        self.assertNotIn("cpf", usuario)
        self.assertTrue(usuario["documento"].endswith("8909"))
        self.assertFalse(usuario["documento"].startswith("123"))

    def test_conversas_nao_expoem_conteudo_privado(self):
        self.conexao.cursor.return_value.fetchall.return_value = [{
            "id": 5, "total_mensagens": 3,
        }]
        resposta = self.client.get("/api/admin/conversas")
        self.assertEqual(resposta.status_code, 200)
        self.assertIn("privacidade", resposta.json()["aviso"])
        self.assertNotIn("conteudo", resposta.json()["conversas"][0])

    def test_nao_pode_alterar_proprio_status(self):
        resposta = self.client.post("/api/admin/usuarios/1/status", json={"status": "bloqueado"})
        self.assertEqual(resposta.status_code, 400)

    def test_filtro_de_uf_e_periodo_em_visitantes(self):
        resposta = self.client.get("/api/admin/visitantes?uf=PE&dias=7")
        self.assertEqual(resposta.status_code, 200)
        chamadas = self.conexao.cursor.return_value.execute.call_args_list
        self.assertGreaterEqual(len(chamadas), 2)
        sql = chamadas[1].args[0]
        self.assertIn("uf = %s", sql)
        self.assertIn("ultima_visita", sql)

    def test_ranking_de_rotas(self):
        self.conexao.cursor.return_value.fetchall.return_value = [{"rota": "/", "visualizacoes": 5}]
        resposta = self.client.get("/api/admin/visitantes/rotas?dias=7")
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["rotas"][0]["rota"], "/")

    def test_status_invalido_e_rejeitado(self):
        resposta = self.client.post("/api/admin/usuarios/10/status", json={"status": "excluido"})
        self.assertEqual(resposta.status_code, 422)


class MascaraTests(unittest.TestCase):
    def test_cpf_mascarado(self):
        self.assertEqual(admin.mascarar_documento("123.456.789-09"), "*******8909")

    def test_sem_documento(self):
        self.assertIsNone(admin.mascarar_documento(None))


class VisitasTests(unittest.TestCase):
    def test_visita_anonima_sem_ip_em_claro(self):
        conexao = banco_mock()
        app = FastAPI()
        app.include_router(admin.criar_router_visitas(lambda: conexao))
        cliente = TestClient(app)
        resposta = cliente.post("/api/visitas", json={"rota": "/pages/explorar/explorar"})
        self.assertEqual(resposta.status_code, 200)
        chamadas = conexao.cursor.return_value.execute.call_args_list
        self.assertGreaterEqual(len(chamadas), 2)
        parametros = chamadas[0].args[1]
        self.assertEqual(len(parametros[0]), 64)  # hash da sessao, nunca IP
        self.assertEqual(parametros[1], "/pages/explorar/explorar")
        self.assertNotIn("testclient", str(parametros))


if __name__ == "__main__":
    unittest.main()
