"""Testes da camada de IA: endpoints, saneamento e fallback determinístico."""
import json
import os
import unittest
from unittest.mock import MagicMock, patch

import httpx
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
    def setUp(self):
        ambiente = patch.dict(os.environ, {
            "AI_PROVIDER": "ollama", "AI_API_KEY": "", "AI_MODEL": "",
            "OLLAMA_MODEL": "qwen3.5:4b",
        })
        ambiente.start()
        self.addCleanup(ambiente.stop)

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
        self.assertTrue(resultado["descricao"].startswith("Show acústico com MPB."))
        self.assertNotIn("```", resultado["descricao"])
        self.assertNotIn('"', resultado["descricao"])

    def test_config_desativada_usa_fallback(self):
        with patch.dict(os.environ, {"AI_PROVIDER": "desativado"}):
            resultado = ia.sugerir_descricao_servico({"titulo": "Pintura em tela"})
        self.assertEqual(resultado["origem"], "fallback")
        self.assertIn("Pintura em tela", resultado["descricao"])

    def test_descricao_curta_e_complementada(self):
        with patch.object(ia, "gerar_texto", return_value="Show com voz e violão."):
            resultado = ia.sugerir_descricao_servico({
                "titulo": "Show acústico", "categoria": "Músicos",
                "publico": "casamentos", "modalidade": "presencial",
            })
        self.assertGreaterEqual(len(resultado["descricao"].split()), 50)
        self.assertIn("personalizada", resultado["descricao"])

    def test_descricao_pede_texto_mais_longo(self):
        capturado = {}

        def falso_gerar(system, prompt, **kwargs):
            capturado.update(kwargs)
            return "Descrição detalhada."

        with patch.object(ia, "gerar_texto", side_effect=falso_gerar):
            ia.sugerir_descricao_servico({"titulo": "Show acústico"})
        self.assertEqual(capturado.get("max_tokens"), 110)

    def test_descricao_em_nuvem_pede_mais_tokens(self):
        capturado = {}

        def falso_gerar(system, prompt, **kwargs):
            capturado.update(kwargs)
            return " ".join(["Descrição detalhada"] * 60)

        ambiente = {"AI_PROVIDER": "gemini", "AI_API_KEY": "chave-teste"}
        with patch.dict(os.environ, ambiente), patch.object(ia, "gerar_texto", side_effect=falso_gerar):
            ia.sugerir_descricao_servico({"titulo": "Show acústico"})
        self.assertEqual(capturado.get("max_tokens"), 220)

    def test_corte_respeita_palavras_inteiras(self):
        resultado = ia._limpar_saida("palavra " * 100, 50)
        self.assertTrue(resultado.endswith("palavra"))
        self.assertLessEqual(len(resultado), 50)

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


class IAProviderTests(unittest.TestCase):
    def _cliente_falso(self, manipulador):
        cliente_real = httpx.Client
        return patch.object(
            ia.httpx, "Client",
            side_effect=lambda **kwargs: cliente_real(transport=httpx.MockTransport(manipulador)),
        )

    def test_gemini_envia_chave_e_le_resposta(self):
        visto = {}

        def manipulador(request):
            visto["url"] = str(request.url)
            visto["corpo"] = json.loads(request.content)
            return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "Olá"}]}}]})

        ambiente = {"AI_PROVIDER": "gemini", "AI_API_KEY": "chave-teste", "AI_MODEL": "gemini-2.0-flash"}
        with patch.dict(os.environ, ambiente), self._cliente_falso(manipulador):
            texto = ia.gerar_texto("sistema", "prompt")
        self.assertEqual(texto, "Olá")
        self.assertIn("key=chave-teste", visto["url"])
        self.assertNotIn("chave-teste", json.dumps(visto["corpo"]))

    def test_groq_envia_bearer_e_le_resposta(self):
        visto = {}

        def manipulador(request):
            visto["autorizacao"] = request.headers.get("authorization")
            return httpx.Response(200, json={"choices": [{"message": {"content": "Oi"}}]})

        ambiente = {"AI_PROVIDER": "groq", "AI_API_KEY": "chave-teste"}
        with patch.dict(os.environ, ambiente), self._cliente_falso(manipulador):
            texto = ia.gerar_texto("sistema", "prompt")
        self.assertEqual(texto, "Oi")
        self.assertEqual(visto["autorizacao"], "Bearer chave-teste")

    def test_chave_ausente_em_nuvem_e_rejeitada(self):
        with patch.dict(os.environ, {"AI_PROVIDER": "gemini", "AI_API_KEY": ""}):
            with self.assertRaises(ia.IAError):
                ia.gerar_texto("sistema", "prompt")

    def test_fallback_de_descricao_e_mais_longo(self):
        texto = ia.descricao_fallback({
            "titulo": "Show de MPB", "categoria": "Músicos",
            "publico": "casamentos", "cidade": "Caruaru", "estado": "PE",
        })
        self.assertGreaterEqual(len(texto.split()), 50)


class IAResumoTests(unittest.TestCase):
    def setUp(self):
        main.app.dependency_overrides[main.get_usuario_atual] = lambda: {"id": 4, "email": "demo.cantora@example.com"}
        self.client = TestClient(main.app)
        main._resumo_cache.clear()
        self.addCleanup(main.app.dependency_overrides.clear)

    def _banco(self, mensagens):
        conexao = MagicMock()
        cursor = conexao.cursor.return_value
        cursor.fetchone.return_value = {"id": 5}
        cursor.fetchall.return_value = mensagens
        return conexao

    def test_resumo_da_conversa(self):
        with patch.object(main, "resumir_conversa", return_value={"resumo": "Resumo.", "origem": "modelo_local"}):
            resposta = self.client.get("/api/conversas/5/resumo")
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["resumo"], "Resumo.")

    def test_conversa_de_outro_usuario_e_404(self):
        conexao = MagicMock()
        conexao.cursor.return_value.fetchone.return_value = None
        with patch.object(main, "get_db_connection", return_value=conexao):
            resposta = self.client.get("/api/conversas/5/resumo")
        self.assertEqual(resposta.status_code, 404)

    def test_cache_evita_segundo_resumo(self):
        mensagens = [{"id": 9, "remetente_id": 3, "conteudo": "oi"}]
        with patch.object(main, "get_db_connection", return_value=self._banco(mensagens)), patch.object(main, "resumir_conversa", return_value={"resumo": "r", "origem": "modelo_local"}) as resumir:
            for _ in range(2):
                resposta = self.client.get("/api/conversas/5/resumo")
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resumir.call_count, 1)

    def test_historico_enviado_ao_modelo_sem_email(self):
        capturado = {}
        mensagens = [{"id": 9, "remetente_id": 3, "conteudo": "fale com joao@example.com"}]

        def falso_gerar(system, prompt, **kwargs):
            capturado["prompt"] = prompt
            return "Resumo sem dados pessoais."

        with patch.object(main, "get_db_connection", return_value=self._banco(mensagens)), patch.object(ia, "gerar_texto", side_effect=falso_gerar):
            resposta = self.client.get("/api/conversas/5/resumo")
        self.assertEqual(resposta.status_code, 200)
        self.assertNotIn("joao@example.com", capturado["prompt"])


class IAResumoServicoTests(unittest.TestCase):
    def setUp(self):
        ambiente = patch.dict(os.environ, {"AI_PROVIDER": "ollama", "AI_API_KEY": "", "AI_MODEL": ""})
        ambiente.start()
        self.addCleanup(ambiente.stop)

    def test_resumo_com_modelo(self):
        with patch.object(ia, "gerar_texto", return_value="- Acordo sobre o show\n- Valor combinado"):
            resultado = ia.resumir_conversa(["oi", "vamos fechar"])
        self.assertEqual(resultado["origem"], "modelo_local")

    def test_fallback_quando_modelo_falha(self):
        with patch.object(ia, "gerar_texto", side_effect=ia.IAError("offline")):
            resultado = ia.resumir_conversa(["user: oi", "artista: ola"])
        self.assertEqual(resultado["origem"], "fallback")
        self.assertIn("Últimas mensagens", resultado["resumo"])

    def test_sem_mensagens(self):
        resultado = ia.resumir_conversa([])
        self.assertEqual(resultado["origem"], "fallback")


class IAPropostaEndpointTests(unittest.TestCase):
    def setUp(self):
        main.app.dependency_overrides[main.get_usuario_atual] = lambda: {"id": 10, "email": "cliente.test@example.com"}
        self.client = TestClient(main.app)
        self.addCleanup(main.app.dependency_overrides.clear)

    def _banco(self, artista, servico):
        conexao = MagicMock()
        cursor = conexao.cursor.return_value
        cursor.fetchone.side_effect = [artista, servico, servico]
        return conexao

    def test_sugere_valor_e_escopo(self):
        conexao = self._banco(
            {"nome_artistico": "Lia Monteiro", "categoria_atuacao": "Músicos"},
            {"titulo": "Show de MPB", "preco_min": 250, "preco_max": 500, "modalidade": "ambos"},
        )
        retorno = {"valor_sugerido": 450.0, "escopo": "Show acústico", "justificativa": "Dentro da faixa.", "origem": "modelo_local"}
        with patch.object(main, "get_db_connection", return_value=conexao), patch.object(main, "sugerir_proposta", return_value=retorno):
            resposta = self.client.post("/api/ia/sugerir-proposta", json={
                "artista_id": 4, "servico_id": 2,
                "descricao_escopo": "Show acústico para casamento com 80 convidados",
                "local_ou_modalidade": "Caruaru/PE",
            })
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["valor_sugerido"], 450.0)

    def test_artista_inexistente(self):
        conexao = MagicMock()
        conexao.cursor.return_value.fetchone.return_value = None
        with patch.object(main, "get_db_connection", return_value=conexao):
            resposta = self.client.post("/api/ia/sugerir-proposta", json={
                "artista_id": 999, "descricao_escopo": "Show para casamento",
            })
        self.assertEqual(resposta.status_code, 404)

    def test_descricao_curta_rejeitada(self):
        resposta = self.client.post("/api/ia/sugerir-proposta", json={
            "artista_id": 4, "descricao_escopo": "oi",
        })
        self.assertEqual(resposta.status_code, 422)


class IAPropostaServicoTests(unittest.TestCase):
    def setUp(self):
        ambiente = patch.dict(os.environ, {"AI_PROVIDER": "ollama", "AI_API_KEY": "", "AI_MODEL": ""})
        ambiente.start()
        self.addCleanup(ambiente.stop)

    def test_valor_fora_da_faixa_e_limitado(self):
        with patch.object(ia, "gerar_texto", return_value='{"valor_sugerido": 99999, "escopo": "Show", "justificativa": "ok"}'):
            resultado = ia.sugerir_proposta({
                "titulo": "Show", "descricao_escopo": "Casamento",
                "preco_min": 250, "preco_max": 500,
            })
        self.assertEqual(resultado["valor_sugerido"], 500.0)

    def test_fallback_usa_ponto_medio(self):
        with patch.object(ia, "gerar_texto", side_effect=ia.IAError("offline")):
            resultado = ia.sugerir_proposta({
                "titulo": "Show", "descricao_escopo": "Casamento",
                "preco_min": 200, "preco_max": 600,
            })
        self.assertEqual(resultado["origem"], "fallback")
        self.assertEqual(resultado["valor_sugerido"], 400.0)

    def test_prompt_sem_dados_pessoais(self):
        capturado = {}

        def falso_gerar(system, prompt, **kwargs):
            capturado["prompt"] = prompt
            return '{"valor_sugerido": 300, "escopo": "ok", "justificativa": "ok"}'

        with patch.object(ia, "gerar_texto", side_effect=falso_gerar):
            ia.sugerir_proposta({
                "titulo": "Show", "descricao_escopo": "contato joao@example.com ou 11999999999",
            })
        self.assertNotIn("joao@example.com", capturado["prompt"])
        self.assertNotIn("11999999999", capturado["prompt"])


class IARecomendacoesTests(unittest.TestCase):
    def setUp(self):
        main.app.dependency_overrides[main.get_usuario_atual] = lambda: {"id": 10, "email": "cliente.test@example.com"}
        self.client = TestClient(main.app)
        self.addCleanup(main.app.dependency_overrides.clear)

    def test_endpoint_recomenda(self):
        with patch.object(main, "recomendar_artistas", return_value={"ids": [4, 7], "origem": "modelo_local"}):
            resposta = self.client.post("/api/ia/recomendacoes", json={
                "artistas": [{"id": 4, "nome": "Lia"}, {"id": 7, "nome": "Ateliê"}],
                "favoritos_ids": [4],
            })
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["ids"], [4, 7])

    def test_lista_vazia_rejeitada(self):
        resposta = self.client.post("/api/ia/recomendacoes", json={"artistas": []})
        self.assertEqual(resposta.status_code, 422)


class IARecomendacoesServicoTests(unittest.TestCase):
    def setUp(self):
        ambiente = patch.dict(os.environ, {"AI_PROVIDER": "ollama", "AI_API_KEY": "", "AI_MODEL": ""})
        ambiente.start()
        self.addCleanup(ambiente.stop)

    def test_favorito_vem_primeiro_no_fallback(self):
        artistas = [
            {"id": 4, "nome": "Lia", "categorias": ["Músicos"], "nota": 4.9},
            {"id": 7, "nome": "Ateliê", "categorias": ["Pintores"], "nota": 4.8},
        ]
        with patch.object(ia, "gerar_texto", side_effect=ia.IAError("offline")):
            resultado = ia.recomendar_artistas(artistas, [7], 2)
        self.assertEqual(resultado["ids"][0], 7)

    def test_ids_inventados_sao_descartados(self):
        artistas = [{"id": 4, "nome": "Lia"}, {"id": 7, "nome": "Ateliê"}]
        with patch.object(ia, "gerar_texto", return_value="[4, 999, 7]"):
            resultado = ia.recomendar_artistas(artistas, [], 2)
        self.assertEqual(sorted(resultado["ids"]), [4, 7])

    def test_prompt_sem_email(self):
        capturado = {}

        def falso_gerar(system, prompt, **kwargs):
            capturado["prompt"] = prompt
            return "[4, 7]"

        artistas = [{"id": 4, "nome": "joao@example.com"}, {"id": 7, "nome": "Ateliê"}]
        with patch.object(ia, "gerar_texto", side_effect=falso_gerar):
            ia.recomendar_artistas(artistas, [], 2)
        self.assertNotIn("joao@example.com", capturado["prompt"])


class IAModeracaoTests(unittest.TestCase):
    def setUp(self):
        main.app.dependency_overrides[main.get_usuario_atual] = lambda: {"id": 10, "email": "cliente.test@example.com"}
        self.client = TestClient(main.app)
        self.addCleanup(main.app.dependency_overrides.clear)

    def test_texto_limpo_nao_gera_aviso(self):
        with patch.object(ia, "gerar_texto") as gerar:
            resultado = ia.moderar_texto("Olá, gostaria de contratar um show.")
        self.assertFalse(resultado["suspeito"])
        gerar.assert_not_called()

    def test_texto_ofensivo_gera_aviso_sem_bloquear(self):
        with patch.object(ia, "gerar_texto", side_effect=ia.IAError("offline")):
            resultado = ia.moderar_texto("Você é um idiota, seu burro")
        self.assertTrue(resultado["suspeito"])
        self.assertIn("linguagem ofensiva", resultado["categorias"])
        self.assertEqual(resultado["origem"], "regras")

    def test_endpoint_usa_aviso_da_regra_e_registra(self):
        conexao = MagicMock()
        with patch.object(main, "get_db_connection", return_value=conexao):
            resposta = self.client.post("/api/ia/moderar-texto", json={
                "texto": "me chame no whatsapp", "contexto": "mensagem",
            })
        self.assertEqual(resposta.status_code, 200)
        self.assertTrue(resposta.json()["suspeito"])
        conexao.cursor.return_value.execute.assert_called_once()
        conexao.commit.assert_called_once()

    def test_endpoint_limpo_nao_registra(self):
        conexao = MagicMock()
        with patch.object(main, "get_db_connection", return_value=conexao) as banco:
            resposta = self.client.post("/api/ia/moderar-texto", json={"texto": "Bom dia!"})
        self.assertEqual(resposta.status_code, 200)
        self.assertFalse(resposta.json()["suspeito"])
        banco.assert_not_called()


@unittest.skipUnless(os.getenv("IA_SMOKE") == "1", "Teste real com Ollama; rode com IA_SMOKE=1")
class IASmokeRealTests(unittest.TestCase):
    def test_modelo_local_responde(self):
        texto = ia.gerar_texto("Responda apenas com OK.", "Diga OK")
        self.assertEqual(texto.strip().lower(), "ok")


if __name__ == "__main__":
    unittest.main()
