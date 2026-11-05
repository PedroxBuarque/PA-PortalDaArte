"""Testes isolados da recuperação de senha (sem banco ou e-mail externos).

Execute nesta pasta: python -m unittest -v test_recuperacao_senha.py
Além das dependências normais da API, os testes HTTP precisam de httpx.
SQLite exercita persistência e rollback; NÃO substitui validação de concorrência
com os bloqueios FOR UPDATE do MySQL no ambiente de implantação.
"""

from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import hashlib
import os
from pathlib import Path
import re
import sqlite3
import ssl
import tempfile
import unittest
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlsplit

# A configuração local real nunca é usada por estes testes.
os.environ.setdefault("SECRET_KEY", "segredo-exclusivo-de-testes-" + "x" * 40)

import bcrypt
from fastapi import Depends
from fastapi.testclient import TestClient
import jwt
import main


TEST_EMAIL = "artista@example.test"
OLD_PASSWORD = "SenhaAntiga123!"
NEW_PASSWORD = "NovaSenhaSegura456!"
TEST_ENV = {
    "SMTP_HOST": "smtp.example.test",
    "SMTP_PORT": "587",
    "SMTP_USERNAME": "conta-de-teste",
    "SMTP_PASSWORD": "credencial-ficticia",
    "SMTP_FROM_EMAIL": "noreply@example.test",
    "SMTP_FROM_NAME": "Portal da Arte",
    "SMTP_SECURITY": "starttls",
    "SMTP_TIMEOUT_SECONDS": "5",
    "PASSWORD_RESET_URL": "https://portal.example.test/pages/login/login",
}


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)


sqlite3.register_adapter(datetime, lambda value: value.replace(tzinfo=None).isoformat(" "))
sqlite3.register_converter("DATETIME", lambda value: datetime.fromisoformat(value.decode()))


class LocalCursor:
    """Adaptador mínimo do dialeto, sem simular resultados de SELECT/UPDATE."""

    def __init__(self, connection, dictionary):
        self.connection = connection
        self.raw = connection.raw.cursor()
        self.dictionary = dictionary

    def execute(self, query, params=None):
        query = re.sub(r"\s+FOR\s+UPDATE\b", "", query, flags=re.I)
        query = query.replace("%s", "?")
        for unit in ("SECOND", "MINUTE", "HOUR", "DAY"):
            for function, sign in (("DATE_SUB", "-"), ("DATE_ADD", "+")):
                query = re.sub(
                    function + r"\(UTC_TIMESTAMP\(\),\s*INTERVAL\s+(\?|\d+)\s+" + unit + r"\)",
                    lambda match, sign=sign, unit=unit: "DATETIME(UTC_TIMESTAMP(), '" + sign
                    + "' || " + match[1] + " || ' " + unit.lower() + "s')",
                    query,
                    flags=re.I,
                )
            query = re.sub(
                r"UTC_TIMESTAMP\(\)\s*-\s*INTERVAL\s+(\?|\d+)\s+" + unit + r"\b",
                lambda match: "DATETIME(UTC_TIMESTAMP(), '-' || " + match[1]
                + " || ' " + unit.lower() + "s')",
                query,
                flags=re.I,
            )
        failure = self.connection.database.fail_once
        if failure and re.search(failure, query, flags=re.I | re.S):
            self.connection.database.fail_once = None
            raise RuntimeError("falha de persistência proposital do teste")
        self.raw.execute(query, tuple(params or ()))
        return self

    def fetchone(self):
        result = self.raw.fetchone()
        return dict(result) if result is not None and self.dictionary else result

    def fetchall(self):
        rows = self.raw.fetchall()
        return [dict(row) for row in rows] if self.dictionary else rows

    @property
    def rowcount(self):
        return self.raw.rowcount

    @property
    def lastrowid(self):
        return self.raw.lastrowid

    def close(self):
        self.raw.close()


class LocalConnection:
    def __init__(self, database):
        self.database = database
        self.raw = sqlite3.connect(
            database.path, detect_types=sqlite3.PARSE_DECLTYPES,
            check_same_thread=False,
        )
        self.raw.row_factory = sqlite3.Row
        self.raw.create_function("UTC_TIMESTAMP", 0, lambda: utc_now().isoformat(" "))
        self.raw.create_function("NOW", 0, lambda: utc_now().isoformat(" "))
        self.raw.execute("PRAGMA foreign_keys=ON")
        self.closed = False

    def cursor(self, dictionary=False, **kwargs):
        return LocalCursor(self, dictionary)

    def start_transaction(self, **kwargs):
        if not self.raw.in_transaction:
            self.raw.execute("BEGIN")

    def commit(self):
        self.raw.commit()

    def rollback(self):
        self.raw.rollback()

    def is_connected(self):
        return not self.closed

    def close(self):
        self.raw.close()
        self.closed = True


class LocalDatabase:
    def __init__(self, path):
        self.path = str(path)
        self.fail_once = None
        with sqlite3.connect(self.path) as connection:
            connection.executescript("""
                CREATE TABLE usuarios (
                    id INTEGER PRIMARY KEY,
                    email TEXT NOT NULL,
                    email_normalizado TEXT NOT NULL UNIQUE,
                    senha_hash TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'ativo',
                    ultimo_login_em DATETIME,
                    atualizado_em DATETIME
                );
                CREATE TABLE tokens_usuario (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
                    tipo TEXT NOT NULL,
                    hash_token TEXT NOT NULL,
                    expira_em DATETIME NOT NULL,
                    usado_em DATETIME,
                    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE sessoes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
                    revogado_em DATETIME
                );
            """)
            initial_hash = bcrypt.hashpw(OLD_PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode()
            connection.execute(
                "INSERT INTO usuarios(id,email,email_normalizado,senha_hash,status) VALUES(1,?,?,?,'ativo')",
                (TEST_EMAIL, TEST_EMAIL, initial_hash),
            )
            connection.execute("INSERT INTO sessoes(usuario_id) VALUES(1)")

    def connect(self):
        return LocalConnection(self)

    def execute(self, query, params=()):
        with sqlite3.connect(self.path, detect_types=sqlite3.PARSE_DECLTYPES) as connection:
            connection.row_factory = sqlite3.Row
            result = connection.execute(query, params).fetchall()
            return [dict(row) for row in result]


# Verifica a mesma dependência usada pelas rotas privadas, sem outras tabelas.
@main.app.get("/__teste_recuperacao_usuario", include_in_schema=False)
def _current_user_for_tests(user=Depends(main.get_usuario_atual)):
    return user


class PasswordRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        temp_dir = self.stack.enter_context(tempfile.TemporaryDirectory())
        self.database = LocalDatabase(Path(temp_dir) / "teste.sqlite")
        self.stack.enter_context(patch.dict(os.environ, TEST_ENV, clear=False))
        self.stack.enter_context(patch.object(main, "get_db_connection", self.database.connect))
        self.messages = []
        self.smtp_instance = MagicMock()
        self.smtp_instance.__enter__.return_value = self.smtp_instance
        self.smtp_instance.send_message.side_effect = self.messages.append
        self.smtp = self.stack.enter_context(patch.object(main.smtplib, "SMTP", return_value=self.smtp_instance))
        self.smtp_ssl = self.stack.enter_context(patch.object(main.smtplib, "SMTP_SSL", return_value=self.smtp_instance))
        self.client = self.stack.enter_context(TestClient(main.app))
        # O limitador local é isolado entre cenários; cada teste cobre uma sessão própria.
        for name in ("_recuperacao_por_ip",):
            value = getattr(main, name, None)
            if hasattr(value, "clear"):
                value.clear()

    def request_link(self, email=TEST_EMAIL):
        return self.client.post("/api/recuperar-senha", json={"email": email})

    def sent_token(self):
        self.assertTrue(self.messages, "A solicitação deveria enviar uma mensagem SMTP")
        message = self.messages[-1]
        self.assertIsInstance(message, EmailMessage)
        body = message.get_body(preferencelist=("plain",)).get_content()
        links = re.findall(r"https?://[^\s<>]+", body)
        tokens = [parse_qs(urlsplit(link).query).get("token", [None])[0] for link in links]
        return next(token for token in tokens if token)

    def change_password(self, token, password=NEW_PASSWORD):
        return self.client.post("/api/redefinir-senha", json={"token": token, "nova_senha": password})

    def login(self, password):
        return self.client.post("/api/login", json={"usuario": TEST_EMAIL, "senha": password})

    def test_fluxo_completo_email_nova_senha_login_e_reuso_rejeitado(self):
        response = self.request_link()
        self.assertEqual(response.status_code, 200, response.text)
        token = self.sent_token()
        self.assertEqual(self.change_password(token).status_code, 200)
        self.assertEqual(self.login(OLD_PASSWORD).status_code, 401)
        self.assertEqual(self.login(NEW_PASSWORD).status_code, 200)
        self.assertEqual(self.change_password(token, "OutraSenhaSegura789!").status_code, 400)
        self.assertEqual(self.login(NEW_PASSWORD).status_code, 200)

    def test_email_inexistente_recebe_a_mesma_resposta_publica(self):
        existing = self.request_link()
        missing = self.request_link("naoexiste@example.test")
        self.assertEqual(existing.status_code, missing.status_code)
        self.assertEqual(existing.json(), missing.json())
        self.assertEqual(len(self.messages), 1)

    def test_email_normalizado_e_token_armazenado_somente_como_hash(self):
        response = self.request_link("  ARTISTA@EXAMPLE.TEST  ")
        self.assertEqual(response.status_code, 200, response.text)
        token = self.sent_token()
        rows = self.database.execute("SELECT * FROM tokens_usuario")
        self.assertEqual(len(rows), 1)
        self.assertNotEqual(rows[0]["hash_token"], token)
        self.assertEqual(rows[0]["hash_token"], hashlib.sha256(token.encode()).hexdigest())
        self.assertEqual(rows[0]["tipo"], "redefinicao_senha")
        self.assertGreaterEqual(len(token), 43)
        delta = rows[0]["expira_em"] - utc_now()
        self.assertGreater(delta, timedelta(minutes=29))
        self.assertLessEqual(delta, timedelta(minutes=31))
        self.assertNotIn(token, response.text)

    def test_link_expirado_ou_desconhecido_nao_altera_a_senha(self):
        self.request_link()
        token = self.sent_token()
        self.database.execute("UPDATE tokens_usuario SET expira_em=?", (utc_now() - timedelta(seconds=1),))
        self.assertEqual(self.change_password(token).status_code, 400)
        self.assertEqual(self.change_password("A" * 43).status_code, 400)
        self.assertEqual(self.login(OLD_PASSWORD).status_code, 200)

    def test_senha_curta_ou_acima_limite_bcrypt_e_rejeitada(self):
        self.request_link()
        token = self.sent_token()
        for password in ("curta", "x" * 73, "á" * 37, " " * 8, "\t" * 8):
            with self.subTest(password_bytes=len(password.encode())):
                self.assertIn(self.change_password(token, password).status_code, (400, 422))
                self.assertEqual(self.login(OLD_PASSWORD).status_code, 200)
        self.assertEqual(self.change_password(token).status_code, 200)

    def test_espacos_significativos_da_nova_senha_sao_preservados(self):
        self.request_link()
        token = self.sent_token()
        password = "  senha com espaços  "
        self.assertEqual(self.change_password(token, password).status_code, 200)
        self.assertEqual(self.login(password).status_code, 200)
        self.assertEqual(self.login(password.strip()).status_code, 401)

    def test_tokens_de_outro_proposito_nao_redefinem_a_senha(self):
        self.request_link()
        token = self.sent_token()
        self.database.execute("UPDATE tokens_usuario SET tipo='verificacao_email'")
        self.assertEqual(self.change_password(token).status_code, 400)
        self.assertEqual(self.login(OLD_PASSWORD).status_code, 200)

    def test_solicitacao_repetida_preserva_o_primeiro_link_e_limita_envios(self):
        self.request_link()
        token = self.sent_token()
        response = self.request_link()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(self.messages), 1)
        self.assertEqual(self.change_password(token).status_code, 200)

    def test_redefinicao_invalida_todos_os_links_pendentes_do_usuario(self):
        self.request_link()
        first_token = self.sent_token()
        self.database.execute("UPDATE tokens_usuario SET criado_em=?", (utc_now() - timedelta(minutes=2),))
        self.request_link()
        second_token = self.sent_token()
        self.assertNotEqual(first_token, second_token)
        self.assertEqual(self.change_password(second_token).status_code, 200)
        self.assertEqual(self.change_password(first_token, "OutraSenha789!").status_code, 400)

    def test_falha_smtp_nao_expoe_credenciais_e_nao_deixa_token_utilizavel(self):
        self.smtp_instance.send_message.side_effect = RuntimeError("credencial-ficticia segredo SMTP")
        response = self.request_link()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn("credencial-ficticia", response.text)
        self.assertNotIn("segredo SMTP", response.text)
        valid = self.database.execute("SELECT * FROM tokens_usuario WHERE usado_em IS NULL")
        self.assertEqual(valid, [])

    def test_falha_na_transacao_reverte_senha_e_consumo_do_token(self):
        self.request_link()
        token = self.sent_token()
        self.database.fail_once = r"UPDATE\s+tokens_usuario\s+SET\s+usado_em"
        response = self.change_password(token)
        self.assertEqual(response.status_code, 500, response.text)
        self.assertNotIn("proposital", response.text)
        self.assertEqual(self.login(OLD_PASSWORD).status_code, 200)
        self.assertEqual(self.change_password(token).status_code, 200)

    def test_jwts_anteriores_sao_revogados_e_login_novo_funciona(self):
        original = self.login(OLD_PASSWORD)
        self.assertEqual(original.status_code, 200, original.text)
        tokens = original.json()
        access = tokens["access_token"]
        refresh = tokens["refresh_token"]
        before = self.client.get("/__teste_recuperacao_usuario", headers={"Authorization": "Bearer " + access})
        self.assertEqual(before.status_code, 200)
        self.request_link()
        self.assertEqual(self.change_password(self.sent_token()).status_code, 200)
        after = self.client.get("/__teste_recuperacao_usuario", headers={"Authorization": "Bearer " + access})
        self.assertEqual(after.status_code, 401, after.text)
        renewed = self.client.post("/api/refresh", json={"refresh_token": refresh})
        self.assertEqual(renewed.status_code, 401, renewed.text)
        current = self.login(NEW_PASSWORD).json()
        self.assertEqual(self.client.get("/__teste_recuperacao_usuario", headers={"Authorization": "Bearer " + current["access_token"]}).status_code, 200)
        self.assertEqual(self.client.post("/api/refresh", json={"refresh_token": current["refresh_token"]}).status_code, 200)

    def test_conta_bloqueada_nao_recebe_link_nem_e_reativada(self):
        self.database.execute("UPDATE usuarios SET status='bloqueado'")
        response = self.request_link()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.messages, [])
        self.assertEqual(self.database.execute("SELECT status FROM usuarios")[0]["status"], "bloqueado")

    def test_smtp_starttls_antes_autenticacao_com_certificado_validado(self):
        self.request_link()
        self.assertEqual(len(self.messages), 1)
        names = [call[0] for call in self.smtp_instance.mock_calls]
        self.assertLess(names.index("starttls"), names.index("login"))
        context = self.smtp_instance.starttls.call_args.kwargs["context"]
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(context.check_hostname)
        self.smtp_ssl.assert_not_called()

    def test_smtp_ssl_usa_canal_tls_desde_conexao(self):
        with patch.dict(os.environ, {"SMTP_SECURITY": "ssl", "SMTP_PORT": "465"}):
            response = self.request_link()
        self.assertEqual(response.status_code, 200, response.text)
        self.smtp_ssl.assert_called_once()
        self.smtp.assert_not_called()
        self.smtp_instance.starttls.assert_not_called()
        context = self.smtp_ssl.call_args.kwargs["context"]
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)

    def test_conta_bloqueada_depois_do_envio_nao_pode_usar_o_link(self):
        self.request_link()
        token = self.sent_token()
        original_hash = self.database.execute("SELECT senha_hash FROM usuarios")[0]["senha_hash"]
        self.database.execute("UPDATE usuarios SET status='suspenso'")
        self.assertEqual(self.change_password(token).status_code, 400)
        user = self.database.execute("SELECT status, senha_hash FROM usuarios")[0]
        self.assertEqual(user["status"], "suspenso")
        self.assertEqual(user["senha_hash"], original_hash)

    def test_jwts_legados_sem_vinculo_com_senha_exigem_novo_login(self):
        expiration = datetime.now(timezone.utc) + timedelta(minutes=10)
        for token_type in ("access", "refresh"):
            with self.subTest(token_type=token_type):
                old_token = jwt.encode(
                    {"sub": "1", "email": TEST_EMAIL, "type": token_type, "exp": expiration},
                    main.SECRET_KEY, algorithm=main.ALGORITHM,
                )
                if token_type == "access":
                    response = self.client.get("/__teste_recuperacao_usuario", headers={"Authorization": "Bearer " + old_token})
                else:
                    response = self.client.post("/api/refresh", json={"refresh_token": old_token})
                self.assertEqual(response.status_code, 401, response.text)

    def test_smtp_sem_tls_ou_link_publico_http_sao_recusados(self):
        for override in (
            {"SMTP_SECURITY": "none"},
            {"PASSWORD_RESET_URL": "http://portal.example.test/pages/login/login"},
            {"PASSWORD_RESET_URL": "https://usuario:senha@portal.example.test/pages/login/login"},
            {"PASSWORD_RESET_URL": "https://portal.example.test:abc/pages/login/login"},
            {"PASSWORD_RESET_URL": "https://portal.example.test:65536/pages/login/login"},
            {"PASSWORD_RESET_URL": "https://portal.example.test:0/pages/login/login"},
        ):
            with self.subTest(override=override), patch.dict(os.environ, override):
                self.assertEqual(self.request_link().status_code, 503)
        self.assertEqual(self.messages, [])

    def test_limite_por_ip_interrompe_rajada_sem_disparar_email(self):
        for _ in range(10):
            self.assertEqual(self.request_link("ausente@example.test").status_code, 200)
        self.assertEqual(self.request_link("ausente@example.test").status_code, 429)
        self.assertEqual(self.messages, [])

    def test_configuracao_ausente_falha_igualmente_para_qualquer_email(self):
        with patch.dict(os.environ, {"SMTP_HOST": ""}):
            existing = self.request_link()
            missing = self.request_link("naoexiste@example.test")
        self.assertEqual(existing.status_code, 503, existing.text)
        self.assertEqual(existing.json(), missing.json())
        self.assertEqual(self.messages, [])


if __name__ == "__main__":
    unittest.main()
