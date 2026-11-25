"""Testes da camada de IA: endpoints, saneamento e fallback determinístico."""
import os
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

import ia
import main


class IAEndpointTests(unittest.TestCase):
    def setUp(self):
        main.app.dependency_overrides[main.get_usuario_atual] = lambda: {"id": 4, "email": "demo.cantora@example.com"}
        self.client = TestClient(main.app)
        self.addCleanup(main.app.dependency_overrides.clear)

    def test_sugere_descricao_com_modelo(self):
        with patch.object(main, "sugerir_descricao_servico", return_value={
            "descricao": "Show acústico com repertório de MPB.", "origem": "modelo_local", "modelo": "qwen3.5:4b",
        }) as gerar:
            resposta = self.client.post("/api/ia/sugerir-descricao-servico", json={"titulo": "Show de MPB"})
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["origem"], "modelo_local")
        self.assertEqual(gerar.call_args.args[0]["titulo"], "Show de MPB")

    def test_exige_login(self):
        main.app.dependency_overrides.clear()
        resposta = self.client.post("/api/ia/sugerir-descricao-servico", json={"titulo": "Show de MPB"})
        self.assertEqual(resposta.status_code, 401)

    def test_titulo_muito_curto_e_rejeitado(self):
        resposta = self.client.post("/api/ia/sugerir-descricao-servico", json={"titulo": "A"})
        self.assertEqual(resposta.status_code, 422)

    def test_falha_do_provedor_vira_503_sem_vazar_erro(self):
        with patch.object(main, "sugerir_descricao_servico", side_effect=ia.IAError("segredo")):
            resposta = self.client.post("/api/ia/sugerir-descricao-servico", json={"titulo": "Show de MPB"})
        self.assertEqual(resposta.status_code, 503)
        self.assertNotIn("segredo", resposta.text)


class IAServicoTests(unittest.TestCase):
    def test_fallback_quando_modelo_indisponivel(self):
        with patch.object(ia, "gerar_texto", side_effect=ia.IAError("offline")):
            resultado = ia.sugerir_descricao_servico({
                "titulo": "Forró pé de serra", "categoria": "Bandas",
                "cidade": "Caruaru", "estado": "PE", "modalidade": "presencial",
            })
        self.assertEqual(resultado["origem"], "fallback")
        self.assertIn("Forró pé de serra", resultado["descricao"])
        self.assertIn("Caruaru/PE", resultado["descricao"])

    def test_prompt_nao_contem_dados_sensiveis(self):
        capturado = {}

        def falso_gerar(system, prompt, **kwargs):
            capturado["prompt"] = prompt
            return "Descrição gerada."

        with patch.object(ia, "gerar_texto", side_effect=falso_gerar):
            ia.sugerir_descricao_servico({
                "titulo": "Aula de violão",
                "publico": "contato joao@example.com ou 123.456.789-09",
            })
        self.assertNotIn("joao@example.com", capturado["prompt"])
        self.assertNotIn("123.456.789-09", capturado["prompt"])
        self.assertIn("[email]", capturado["prompt"])
        self.assertIn("[CPF]", capturado["prompt"])

    def test_saida_com_markdown_e_aspas_e_limpa(self):
        with patch.object(ia, "gerar_texto", return_value='  ```\n"Show acústico com MPB."  \n```  '):
            resultado = ia.sugerir_descricao_servico({"titulo": "Show acústico"})
        self.assertEqual(resultado["descricao"], "Show acústico com MPB.")

    def test_config_desativada_usa_fallback(self):
        with patch.dict(os.environ, {"AI_PROVIDER": "desativado"}):
            resultado = ia.sugerir_descricao_servico({"titulo": "Pintura em tela"})
        self.assertEqual(resultado["origem"], "fallback")
        self.assertIn("Pintura em tela", resultado["descricao"])

    def test_url_invalida_nao_gera_chamada(self):
        with patch.dict(os.environ, {"OLLAMA_URL": "ftp://invalido"}), patch.object(ia.httpx, "Client") as cliente:
            resultado = ia.sugerir_descricao_servico({"titulo": "Fotografia"})
        self.assertEqual(resultado["origem"], "fallback")
        cliente.assert_not_called()


class IASugestoesEndpointTests(unittest.TestCase):
    def setUp(self):
        main.app.dependency_overrides[main.get_usuario_atual] = lambda: {"id": 4, "email": "demo.cantora@example.com"}
        self.client = TestClient(main.app)
        self.addCleanup(main.app.dependency_overrides.clear)

    def _banco(self, mensagens):
        conexao = MagicMock()
        cursor = conexao.cursor.return_value
        cursor.fetchone.return_value = {"id": 5}
        cursor.fetchall.return_value = mensagens
        return conexao

    def test_sugere_respostas(self):
        with patch.object(main, "sugerir_respostas", return_value={"sugestoes": ["Ok", "Agora", "Depois"], "origem": "modelo_local"}):
            resposta = self.client.post("/api/ia/sugerir-respostas", json={"conversa_id": 5})
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(len(resposta.json()["sugestoes"]), 3)

    def test_conversa_de_outro_usuario_e_404(self):
        conexao = MagicMock()
        conexao.cursor.return_value.fetchone.return_value = None
        with patch.object(main, "get_db_connection", return_value=conexao):
            resposta = self.client.post("/api/ia/sugerir-respostas", json={"conversa_id": 5})
        self.assertEqual(resposta.status_code, 404)

    def test_historico_sanitizado_e_midia_resumida(self):
        capturado = {}

        def falso_gerar(system, prompt, **kwargs):
            capturado["prompt"] = prompt
            return '["Vamos agendar?", "Qual o valor?"]'

        mensagens = [
            {"remetente_id": 4, "conteudo": "meu e-mail eh joao@example.com"},
            {"remetente_id": 3, "conteudo": '__PA_MEDIA_V1__:{"type":"image","ref":"supabase://portfolios/4/x.jpg","caption":""}'},
        ]
        with patch.object(main, "get_db_connection", return_value=self._banco(mensagens)), patch.object(ia, "gerar_texto", side_effect=falso_gerar):
            resposta = self.client.post("/api/ia/sugerir-respostas", json={"conversa_id": 5})
        self.assertEqual(resposta.status_code, 200)
        self.assertNotIn("joao@example.com", capturado["prompt"])
        self.assertIn("Imagem", capturado["prompt"])


class IASugestoesServiceTests(unittest.TestCase):
    def test_interpreta_json_do_modelo(self):
        with patch.object(ia, "gerar_texto", return_value='["Vamos agendar?", "Qual o valor?", "Pode detalhar?"]'):
            resultado = ia.sugerir_respostas(["Outra pessoa: oi"])
        self.assertEqual(resultado["origem"], "modelo_local")
        self.assertEqual(len(resultado["sugestoes"]), 3)

    def test_json_invalido_usa_fallback(self):
        with patch.object(ia, "gerar_texto", return_value="não é json"):
            resultado = ia.sugerir_respostas(["Outra pessoa: oi"])
        self.assertEqual(resultado["origem"], "fallback")
        self.assertEqual(len(resultado["sugestoes"]), 3)

    def test_historico_vazio_usa_fallback(self):
        resultado = ia.sugerir_respostas([])
        self.assertEqual(resultado["origem"], "fallback")


class IABuscaTests(unittest.TestCase):
    def setUp(self):
        main._busca_ia_cache.clear()
        main._busca_ia_tentativas.clear()
        self.client = TestClient(main.app)

    def test_interpreta_e_retorna_filtros(self):
        with patch.object(main, "interpretar_busca", return_value={
            "termos": ["forró", "casamento"], "categoria": "Bandas",
            "modalidade": "presencial", "origem": "modelo_local",
        }):
            resposta = self.client.post("/api/ia/busca-artistas", json={"consulta": "quero forró para casamento"})
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["termos"], ["forró", "casamento"])

    def test_cache_evita_segunda_chamada_ao_modelo(self):
        with patch.object(main, "interpretar_busca", return_value={
            "termos": ["mpb"], "categoria": None, "modalidade": None, "origem": "modelo_local",
        }) as interpretar:
            for _ in range(2):
                resposta = self.client.post("/api/ia/busca-artistas", json={"consulta": "quero mpb"})
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(interpretar.call_count, 1)

    def test_limite_por_ip(self):
        with patch.object(main, "interpretar_busca", return_value={
            "termos": ["rock"], "categoria": None, "modalidade": None, "origem": "modelo_local",
        }):
            for numero in range(21):
                resposta = self.client.post("/api/ia/busca-artistas", json={"consulta": f"rock {numero}"})
        self.assertEqual(resposta.status_code, 429)

    def test_consulta_curta_rejeitada(self):
        resposta = self.client.post("/api/ia/busca-artistas", json={"consulta": "oi"})
        self.assertEqual(resposta.status_code, 422)

    def test_falha_de_banco_usa_fallback(self):
        with patch.object(main, "get_db_connection", side_effect=Exception("db fora")):
            resposta = self.client.post("/api/ia/busca-artistas", json={"consulta": "quero forró para casamento"})
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["origem"], "fallback")
        self.assertIn("forró", resposta.json()["termos"])


class IABuscaServicoTests(unittest.TestCase):
    def test_json_do_modelo_e_validado(self):
        with patch.object(ia, "gerar_texto", return_value='{"termos": ["forró", "casamento"], "categoria": "Bandas", "modalidade": "presencial"}'):
            resultado = ia.interpretar_busca("quero forró", ["Músicos", "Bandas"], ["presencial", "remoto"])
        self.assertEqual(resultado["categoria"], "Bandas")
        self.assertEqual(resultado["modalidade"], "presencial")
        self.assertEqual(resultado["origem"], "modelo_local")

    def test_categoria_fora_da_lista_e_descartada(self):
        with patch.object(ia, "gerar_texto", return_value='{"termos": ["violao"], "categoria": "Inexistente", "modalidade": "remoto"}'):
            resultado = ia.interpretar_busca("violão", ["Músicos"], ["presencial", "remoto"])
        self.assertIsNone(resultado["categoria"])

    def test_json_invalido_usa_termos_simples(self):
        with patch.object(ia, "gerar_texto", return_value="não é json"):
            resultado = ia.interpretar_busca("quero um show de forró para casamento", ["Bandas"])
        self.assertEqual(resultado["origem"], "fallback")
        self.assertNotIn("quero", resultado["termos"])
        self.assertIn("forró", resultado["termos"])


@unittest.skipUnless(os.getenv("IA_SMOKE") == "1", "Teste real com Ollama; rode com IA_SMOKE=1")
class IASmokeRealTests(unittest.TestCase):
    def test_modelo_local_responde(self):
        texto = ia.gerar_texto("Responda apenas com OK.", "Diga OK")
        self.assertEqual(texto.strip().lower(), "ok")


if __name__ == "__main__":
    unittest.main()
