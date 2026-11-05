"""Testes isolados do portfólio: HTTP multipart, autorização e persistência.

Execute na pasta python-api: python -m unittest -v test_portfolio_storage.py
Usa as dependências de requirements.txt. Nenhuma credencial real, conexão
MySQL ou conta Supabase é utilizada. O HTTP do Storage é interceptado com
httpx.MockTransport; o SQL é executado em SQLite com adaptação mínima.
SQLite NÃO comprova os bloqueios concorrentes FOR UPDATE do MySQL.
"""

from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
import base64
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit

import httpx
import jwt
import mysql.connector
from fastapi.testclient import TestClient

# Evita abrir o .env de quem executa os testes, inclusive no primeiro import.
with patch("dotenv.load_dotenv", return_value=False):
    import main
    import portfolio_storage as storage


TEST_SECRET = "segredo-isolado-portfolio-" + "x" * 40
TEST_STORAGE_KEY = "sb_secret_" + "credencial-ficticia-" * 3
TEST_ENV = {
    "SUPABASE_URL": "https://portfolio-test.supabase.co",
    "SUPABASE_SECRET_KEY": TEST_STORAGE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY": "",
    "SUPABASE_PORTFOLIO_BUCKET": "portfolios",
    "PORTFOLIO_MAX_FILE_MB": "50",
    "SUPABASE_STORAGE_TIMEOUT_SECONDS": "10",
}
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAAkAAAAASUVORK5CYII="
)
GIF = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"
JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
WEBP = b"RIFF\x16\x00\x00\x00WEBPVP8L\x09\x00\x00\x00\x2f\x00\x00\x00\x00\x07\x10\x11\xfd\x00"
MP4 = b"\x00\x00\x00\x18ftypisom\x00\x00\x00\x00isommp42"
MOV = b"\x00\x00\x00\x14ftypqt  \x00\x00\x00\x00qt  "
WEBM = b"\x1a\x45\xdf\xa3\x8b\x42\x86\x81\x01\x42\x82\x84webm\x18\x53\x80\x67\xff"


class LocalCursor:
    def __init__(self, connection, dictionary):
        self.connection = connection
        self.raw = connection.raw.cursor()
        self.dictionary = dictionary

    def execute(self, query, params=None):
        self.connection.database.queries.append((query, tuple(params or ())))
        query = re.sub(r"\s+FOR\s+UPDATE\b", "", query, flags=re.I)
        query = query.replace("%s", "?")
        failure = self.connection.database.fail_once
        if failure and re.search(failure, query, flags=re.I | re.S):
            self.connection.database.fail_once = None
            raise mysql.connector.Error("Falha de SQL proposital do teste", errno=1105)
        try:
            self.raw.execute(query, tuple(params or ()))
        except sqlite3.OperationalError as error:
            # Permite testar o tratamento da migração ausente com erro MySQL.
            if "no such column" in str(error):
                raise mysql.connector.ProgrammingError("Coluna ausente no teste", errno=1054) from None
            raise
        return self

    def fetchone(self):
        row = self.raw.fetchone()
        return dict(row) if row is not None and self.dictionary else row

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
        self.raw = sqlite3.connect(database.path, check_same_thread=False)
        self.raw.row_factory = sqlite3.Row
        self.raw.execute("PRAGMA foreign_keys=ON")

    def cursor(self, dictionary=False, **kwargs):
        return LocalCursor(self, dictionary)

    def start_transaction(self, **kwargs):
        if not self.raw.in_transaction:
            self.raw.execute("BEGIN")

    def commit(self):
        self.raw.commit()
        if self.database.fail_commit_after_persist:
            self.database.fail_commit_after_persist = False
            raise mysql.connector.OperationalError("Confirmação de COMMIT perdida no teste", errno=2013)

    def rollback(self):
        self.raw.rollback()

    def close(self):
        self.raw.close()


class LocalDatabase:
    def __init__(self, path):
        self.path = str(path)
        self.fail_once = None
        self.fail_commit_after_persist = False
        self.queries = []
        with sqlite3.connect(self.path) as connection:
            connection.executescript("""
                PRAGMA foreign_keys=ON;
                CREATE TABLE usuarios (
                    id INTEGER PRIMARY KEY, email TEXT NOT NULL,
                    senha_hash TEXT NOT NULL, status TEXT NOT NULL
                );
                CREATE TABLE perfis_artista (
                    usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id)
                );
                CREATE TABLE portfolios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    artista_id INTEGER NOT NULL REFERENCES perfis_artista(usuario_id),
                    titulo TEXT NOT NULL, descricao TEXT, tipo TEXT NOT NULL,
                    ordem INTEGER NOT NULL DEFAULT 0,
                    publicado INTEGER NOT NULL DEFAULT 0,
                    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE itens_portfolio (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
                    tipo_midia TEXT NOT NULL, midia_url TEXT NOT NULL,
                    titulo TEXT, descricao TEXT, ordem INTEGER NOT NULL DEFAULT 0,
                    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    arquivo_nome TEXT, arquivo_mime TEXT, arquivo_tamanho INTEGER,
                    secao TEXT NOT NULL DEFAULT 'portfolio', capa_url TEXT
                );
            """)
            for user_id in (42, 420, 99):
                connection.execute(
                    "INSERT INTO usuarios VALUES (?, ?, ?, 'ativo')",
                    (user_id, f"usuario-{user_id}@example.test", "hash-ficticio-para-pwdv"),
                )
            connection.executemany("INSERT INTO perfis_artista VALUES (?)", [(42,), (420,)])

    def connect(self):
        return LocalConnection(self)

    def execute(self, sql, params=()):
        with sqlite3.connect(self.path) as connection:
            connection.execute("PRAGMA foreign_keys=ON")
            connection.row_factory = sqlite3.Row
            return [dict(row) for row in connection.execute(sql, params).fetchall()]


class FakeStorageHTTP:
    """Contrato REST do Supabase sem rede; registra bytes, cabeçalhos e ações."""

    def __init__(self):
        self.requests = []
        self.objects = {}
        self.fail_upload = False
        self.fail_upload_at = None
        self.upload_attempts = 0
        self.persist_then_timeout_at = None
        self.fail_delete = False
        self.fail_sign = False
        self.bucket_public = False
        self.bucket_status = 200
        self.sign_count = 0
        self.sign_override = None

    def __call__(self, request):
        body = request.read()
        self.requests.append((request, body))
        path = request.url.path
        if request.url.host != "portfolio-test.supabase.co":
            raise AssertionError("O teste não permite hosts externos")
        if request.method == "GET" and path == "/storage/v1/bucket/portfolios":
            if self.bucket_status != 200:
                return httpx.Response(self.bucket_status, json={"message": "Bucket not found"})
            return httpx.Response(200, json={"id": "portfolios", "public": self.bucket_public})
        if request.method == "POST" and path.startswith("/storage/v1/object/sign/portfolios/"):
            if self.fail_sign:
                return httpx.Response(503, json={"message": TEST_STORAGE_KEY})
            self.sign_count += 1
            object_path = path.split("/portfolios/", 1)[1]
            if object_path not in self.objects:
                return httpx.Response(404, json={"message": "Object not found"})
            return httpx.Response(200, json={
                "signedURL": self.sign_override or (
                    f"/object/sign/portfolios/{object_path}?token=ficticio-{self.sign_count}"
                )
            })
        if request.method == "POST" and path.startswith("/storage/v1/object/portfolios/"):
            self.upload_attempts += 1
            if self.fail_upload or self.upload_attempts == self.fail_upload_at:
                return httpx.Response(503, json={"message": TEST_STORAGE_KEY})
            object_path = path.split("/portfolios/", 1)[1]
            if object_path in self.objects:
                return httpx.Response(409, json={"message": "Duplicate"})
            self.objects[object_path] = body
            if self.upload_attempts == self.persist_then_timeout_at:
                raise httpx.ReadTimeout("Resposta perdida após gravar objeto", request=request)
            return httpx.Response(200, json={"Key": "portfolios/" + object_path})
        if request.method == "DELETE" and path == "/storage/v1/object/portfolios":
            if self.fail_delete:
                return httpx.Response(503, json={"message": TEST_STORAGE_KEY})
            paths = json.loads(body)["prefixes"]
            deleted = []
            for object_path in paths:
                if object_path in self.objects:
                    del self.objects[object_path]
                    deleted.append({"name": object_path})
            return httpx.Response(200, json=deleted)
        raise AssertionError(f"Requisição REST não esperada: {request.method} {path}")


class PortfolioStorageTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        temp_dir = self.stack.enter_context(tempfile.TemporaryDirectory())
        self.database = LocalDatabase(Path(temp_dir) / "portfolio.sqlite")
        self.stack.enter_context(patch.dict(os.environ, TEST_ENV, clear=False))
        self.stack.enter_context(patch.object(main, "SECRET_KEY", TEST_SECRET))
        self.stack.enter_context(patch.object(main, "get_db_connection", self.database.connect))
        self.cloud = FakeStorageHTTP()
        transport = httpx.MockTransport(self.cloud)
        self.stack.enter_context(patch.object(
            main, "SupabasePortfolioStorage",
            side_effect=lambda *args, **kwargs: storage.SupabasePortfolioStorage(*args, transport=transport, **kwargs),
        ))
        self.client = self.stack.enter_context(TestClient(main.app, follow_redirects=False))

    def token(self, user_id=42, **overrides):
        payload = {
            "sub": str(user_id), "type": "access",
            "pwdv": main.versao_senha("hash-ficticio-para-pwdv"),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        }
        payload.update(overrides)
        return jwt.encode(payload, TEST_SECRET, algorithm="HS256")

    def headers(self, user_id=42):
        return {"Authorization": "Bearer " + self.token(user_id)}

    def upload(self, name="obra.png", content=PNG, mime="image/png", user_id=42, cover=None, **fields):
        data = {"titulo": "Minha obra", "descricao": "Descrição da obra", **fields}
        headers = self.headers(user_id) if user_id is not None else {}
        files = {"arquivo": (name, content, mime)}
        if cover is not None:
            files["capa"] = cover
        return self.client.post(
            "/api/artistas/portfolio/arquivo", headers=headers, data=data,
            files=files,
        )

    def assert_success(self, response):
        self.assertIn(response.status_code, (200, 201), response.text)
        return response.json()

    def media_row(self):
        return self.database.execute("SELECT * FROM itens_portfolio ORDER BY id DESC LIMIT 1")[0]

    def test_upload_multipart_persiste_bytes_metadados_e_pasta_do_jwt(self):
        result = self.assert_success(self.upload(
            name="foto da exposição.png", usuario_id="420", artista_id="420", pasta="420",
        ))
        rows = self.database.execute("SELECT * FROM portfolios")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["artista_id"], 42)
        item = self.media_row()
        self.assertEqual(item["arquivo_nome"], "foto da exposição.png")
        self.assertEqual(item["arquivo_mime"], "image/png")
        self.assertEqual(item["arquivo_tamanho"], len(PNG))
        self.assertEqual(item["tipo_midia"], "imagem")
        self.assertRegex(item["midia_url"], r"^supabase://portfolios/42/[0-9a-f]{32}\.png$")
        self.assertEqual(list(self.cloud.objects.values()), [PNG])
        self.assertEqual(result["midia_url"], f"/api/portfolio/arquivos/{item['id']}")
        self.assertEqual(result["portfolio_id"], rows[0]["id"])
        self.assertEqual(result["item_id"], item["id"])
        self.assertNotIn("sb_secret", response_text := json.dumps(result))
        self.assertNotIn("supabase://", response_text)

    def test_formatos_permitidos_e_mime_canonico(self):
        for filename, body, mime, media_type in (
            ("arte.jpg", JPEG, "image/jpeg", "imagem"),
            ("arte.jpeg", JPEG, "image/jpeg", "imagem"),
            ("arte.png", PNG, "image/png", "imagem"),
            ("arte.gif", GIF, "image/gif", "imagem"),
            ("arte.webp", WEBP, "image/webp", "imagem"),
            ("show.mp4", MP4, "video/mp4", "video"),
            ("show.mov", MOV, "video/quicktime", "video"),
            ("show.webm", WEBM, "video/webm", "video"),
            ("catalogo.pdf", PDF, "application/pdf", "pdf"),
        ):
            with self.subTest(filename=filename):
                payload = self.assert_success(self.upload(filename, body, mime))
                self.assertEqual(payload["tipo"], media_type)
                self.assertEqual(payload["arquivo_mime"], mime)

    def test_sem_login_ou_token_invalido_nao_envia_arquivo(self):
        self.assertEqual(self.upload(user_id=None).status_code, 401)
        for token in ("token-invalido", self.token(type="refresh"), self.token(exp=0), self.token(pwdv="incorreta")):
            with self.subTest(token_type=token[:12]):
                response = self.client.post(
                    "/api/artistas/portfolio/arquivo", headers={"Authorization": "Bearer " + token},
                    data={"titulo": "Obra", "descricao": "Descrição"},
                    files={"arquivo": ("obra.png", PNG, "image/png")},
                )
                self.assertEqual(response.status_code, 401, response.text)
        self.assertFalse(self.cloud.requests)
        self.assertFalse(self.database.execute("SELECT * FROM portfolios"))

    def test_cliente_sem_perfil_artista_nao_envia_arquivo(self):
        response = self.upload(user_id=99)
        self.assertEqual(response.status_code, 403, response.text)
        self.assertFalse(self.cloud.requests)

    def test_conta_bloqueada_nao_envia_arquivo(self):
        self.database.execute("UPDATE usuarios SET status='suspenso' WHERE id=42")
        self.assertEqual(self.upload().status_code, 401)
        self.assertFalse(self.cloud.requests)

    def test_extensao_mime_e_assinatura_falsificados_sao_rejeitados(self):
        for filename, body, mime in (
            ("ataque.svg", b"<svg><script>alert(1)</script></svg>", "image/svg+xml"),
            ("ataque.html", b"<html>conteudo</html>", "text/html"),
            ("foto.png", b"<script>alert(1)</script>", "image/png"),
            ("arquivo.pdf", PNG, "application/pdf"),
            ("foto.png", PNG, "application/pdf"),
            ("video.mp4", b"arquivo sem video", "video/mp4"),
            ("foto.png.exe", PNG, "image/png"),
        ):
            with self.subTest(filename=filename, mime=mime):
                response = self.upload(filename, body, mime)
                self.assertIn(response.status_code, (400, 415, 422), response.text)
        self.assertFalse(self.cloud.objects)
        self.assertFalse(self.database.execute("SELECT * FROM portfolios"))

    def test_arquivo_vazio_e_arquivo_acima_do_limite_nao_sao_enviados(self):
        self.assertIn(self.upload(content=b"").status_code, (400, 415, 422))
        with patch.dict(os.environ, {"PORTFOLIO_MAX_FILE_MB": "1"}):
            response = self.upload(content=PNG + b"x" * (1024 * 1024))
        self.assertEqual(response.status_code, 413, response.text)
        self.assertFalse(self.cloud.objects)
        self.assertFalse(self.database.execute("SELECT * FROM portfolios"))

    def test_corpo_chunked_acima_do_limite_e_rejeitado_antes_do_storage(self):
        boundary = "portfolio-test-boundary"
        prefix = (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"titulo\"\r\n\r\nObra\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"arquivo\"; filename=\"obra.png\"\r\n"
            "Content-Type: image/png\r\n\r\n"
        ).encode()

        def chunks():
            yield prefix + PNG
            for _ in range(36):
                yield b"x" * (64 * 1024)
            yield f"\r\n--{boundary}--\r\n".encode()

        with patch.dict(os.environ, {"PORTFOLIO_MAX_FILE_MB": "1"}):
            response = self.client.post(
                "/api/artistas/portfolio/arquivo", content=chunks(),
                headers={**self.headers(), "Content-Type": f"multipart/form-data; boundary={boundary}"},
            )
        self.assertNotIn("content-length", response.request.headers)
        self.assertEqual(response.status_code, 413, response.text)
        self.assertFalse(self.cloud.requests)
        self.assertFalse(self.database.execute("SELECT * FROM portfolios"))

    def test_titulo_invalido_e_falta_arquivo_nao_criam_item(self):
        for title in ("   ", "x" * 151):
            with self.subTest(title_length=len(title)):
                response = self.upload(titulo=title)
                self.assertIn(response.status_code, (400, 422), response.text)
        response = self.client.post(
            "/api/artistas/portfolio/arquivo", headers=self.headers(),
            data={"titulo": "Obra", "descricao": "Sem arquivo"},
        )
        self.assertEqual(response.status_code, 422, response.text)
        self.assertFalse(self.cloud.objects)

    def test_configuracao_ausente_invalida_ou_publica_retornam_503_sem_segredos(self):
        for changed in (
            {"SUPABASE_URL": ""},
            {"SUPABASE_SECRET_KEY": ""},
            {"SUPABASE_SECRET_KEY": "sb_publishable_" + "x" * 32},
            {"SUPABASE_URL": "http://portfolio-test.supabase.co"},
            {"SUPABASE_URL": "https://portfolio-test.supabase.co/?key=" + TEST_STORAGE_KEY},
            {"PORTFOLIO_MAX_FILE_MB": "inválido"},
        ):
            with self.subTest(keys=list(changed)), patch.dict(os.environ, changed):
                response = self.upload()
                self.assertEqual(response.status_code, 503, response.text)
                self.assertNotIn(TEST_STORAGE_KEY, response.text)
        self.cloud.bucket_public = True
        response = self.upload()
        self.assertEqual(response.status_code, 503, response.text)
        self.assertFalse(self.cloud.objects)

    def test_bucket_inexistente_e_falha_storage_nao_criam_registro(self):
        self.cloud.bucket_status = 404
        missing = self.upload()
        self.assertIn(missing.status_code, (502, 503), missing.text)
        self.assertFalse(self.cloud.objects)
        self.cloud.bucket_status = 200
        self.cloud.fail_upload = True
        response = self.upload()
        self.assertIn(response.status_code, (502, 503), response.text)
        self.assertNotIn(TEST_STORAGE_KEY, response.text)
        self.assertFalse(self.database.execute("SELECT * FROM portfolios"))
        self.assertFalse(self.database.execute("SELECT * FROM itens_portfolio"))

    def test_migracao_ausente_bloqueia_upload_antes_de_criar_objeto(self):
        self.database.execute("ALTER TABLE itens_portfolio DROP COLUMN arquivo_mime")
        response = self.upload()
        self.assertEqual(response.status_code, 503, response.text)
        self.assertFalse(self.cloud.objects)
        self.assertFalse(self.database.execute("SELECT * FROM portfolios"))

    def test_falha_no_mysql_apos_upload_remove_objeto_e_reverte_portfolio(self):
        self.database.fail_once = r"INSERT\s+INTO\s+itens_portfolio"
        response = self.upload()
        self.assertEqual(response.status_code, 500, response.text)
        self.assertFalse(self.database.execute("SELECT * FROM portfolios"))
        self.assertFalse(self.database.execute("SELECT * FROM itens_portfolio"))
        self.assertFalse(self.cloud.objects)
        self.assertTrue(any(req.method == "DELETE" for req, _ in self.cloud.requests))

    def test_video_e_capa_persistem_na_mesma_pasta_e_sao_abertos_e_excluidos(self):
        result = self.assert_success(self.upload(
            "apresentacao.mp4", MP4, "video/mp4", secao="video",
            cover=("capa.png", PNG, "image/png"),
        ))
        self.assertEqual(result["secao"], "video")
        self.assertEqual(result["tipo"], "video")
        self.assertEqual(result["capa_url"], result["midia_url"] + "/capa")
        self.assertEqual(sorted(self.cloud.objects.values()), sorted([PNG, MP4]))
        for path in self.cloud.objects:
            self.assertRegex(path, r"^42/[0-9a-f]{32}\.(png|mp4)$")
        row = self.media_row()
        self.assertEqual(row["secao"], "video")
        self.assertRegex(row["capa_url"], r"^supabase://portfolios/42/[0-9a-f]{32}\.png$")
        public = self.client.get("/api/artistas/42/portfolio").json()["portfolio"][0]
        self.assertEqual(public["secao"], "video")
        self.assertEqual(public["capa_url"], result["capa_url"])
        self.assertNotIn("supabase://", json.dumps(public))
        opened = self.client.get(result["capa_url"])
        self.assertEqual(opened.status_code, 307, opened.text)
        self.assertIn("no-store", opened.headers["cache-control"])
        self.assertIn(".png?token=", opened.headers["location"])
        deleted = self.client.delete(
            f"/api/artistas/portfolio/{result['portfolio_id']}", headers=self.headers(),
        )
        self.assertEqual(deleted.status_code, 200, deleted.text)
        self.assertFalse(self.cloud.objects)
        self.assertFalse(self.database.execute("SELECT * FROM portfolios"))

    def test_video_sem_capa_e_valido_mas_secao_video_exige_video(self):
        result = self.assert_success(self.upload("show.mp4", MP4, "video/mp4", secao="video"))
        self.assertEqual(result["secao"], "video")
        self.assertFalse(result["capa_url"])
        count = self.cloud.upload_attempts
        for fields in ({"secao": "video"}, {"secao": "desconhecida"}, {"cover": ("capa.png", PNG, "image/png")}):
            with self.subTest(fields=list(fields)):
                invalid = self.upload(**fields)
                self.assertIn(invalid.status_code, (400, 415, 422), invalid.text)
        self.assertEqual(self.cloud.upload_attempts, count)

    def test_capa_invalida_e_capa_grande_sao_rejeitadas_antes_dos_uploads(self):
        for cover in (
            ("capa.pdf", PDF, "application/pdf"),
            ("capa.png", b"<script>invalid</script>", "image/png"),
            ("capa.png", PNG + b"x" * (10 * 1024 * 1024), "image/png"),
        ):
            with self.subTest(cover_name=cover[0], size=len(cover[1])):
                result = self.upload("show.mp4", MP4, "video/mp4", secao="video", cover=cover)
                self.assertIn(result.status_code, (400, 413, 415, 422), result.text)
        self.assertEqual(self.cloud.upload_attempts, 0)
        self.assertFalse(self.database.execute("SELECT * FROM portfolios"))

    def test_falha_no_segundo_upload_remove_video_e_nao_cria_registro(self):
        self.cloud.fail_upload_at = 2
        result = self.upload(
            "show.mp4", MP4, "video/mp4", secao="video",
            cover=("capa.png", PNG, "image/png"),
        )
        self.assertIn(result.status_code, (502, 503), result.text)
        self.assertEqual(self.cloud.upload_attempts, 2)
        self.assertFalse(self.cloud.objects)
        self.assertFalse(self.database.execute("SELECT * FROM portfolios"))

    def test_timeout_apos_storage_gravar_video_ou_capa_limpa_destinos(self):
        for upload_index in (1, 2):
            with self.subTest(upload_index=upload_index):
                self.cloud.upload_attempts = 0
                self.cloud.persist_then_timeout_at = upload_index
                result = self.upload(
                    "show.mp4", MP4, "video/mp4", secao="video",
                    cover=("capa.png", PNG, "image/png"),
                )
                self.assertEqual(result.status_code, 503, result.text)
                self.assertFalse(self.cloud.objects)
                self.assertFalse(self.database.execute("SELECT * FROM portfolios"))

    def test_conflito_de_destino_nao_apaga_objeto_preexistente(self):
        existing_path = "42/" + "a" * 32 + ".png"
        original = b"arquivo-que-ja-existia"
        self.cloud.objects[existing_path] = original
        with patch.object(main, "criar_caminho", return_value=existing_path):
            result = self.upload()
        self.assertEqual(result.status_code, 409, result.text)
        self.assertEqual(self.cloud.objects, {existing_path: original})
        self.assertFalse(any(req.method == "DELETE" for req, _ in self.cloud.requests))
        self.assertFalse(self.database.execute("SELECT * FROM portfolios"))

    def test_commit_persistido_sem_confirmacao_preserva_midia_e_pede_atualizacao(self):
        self.database.fail_commit_after_persist = True
        result = self.upload()
        self.assertEqual(result.status_code, 503, result.text)
        self.assertIn("Atualize", result.json()["detail"])
        self.assertEqual(len(self.database.execute("SELECT * FROM portfolios")), 1)
        self.assertEqual(len(self.cloud.objects), 1)
        own = self.client.get("/api/me/portfolio", headers=self.headers())
        self.assertEqual(own.status_code, 200, own.text)
        self.assertEqual(len(own.json()["portfolio"]), 1)
        self.assertEqual(self.client.get(own.json()["portfolio"][0]["midia_url"]).status_code, 307)

    def test_falha_mysql_apos_video_e_capa_remove_ambos_e_reverte_registro(self):
        self.database.fail_once = r"INSERT\s+INTO\s+itens_portfolio"
        result = self.upload(
            "show.mp4", MP4, "video/mp4", secao="video",
            cover=("capa.png", PNG, "image/png"),
        )
        self.assertEqual(result.status_code, 500, result.text)
        self.assertEqual(self.cloud.upload_attempts, 2)
        self.assertFalse(self.cloud.objects)
        self.assertFalse(self.database.execute("SELECT * FROM portfolios"))
        self.assertFalse(self.database.execute("SELECT * FROM itens_portfolio"))

    def test_capa_respeita_publicacao_e_pasta_do_proprietario(self):
        result = self.assert_success(self.upload(
            "show.mp4", MP4, "video/mp4", secao="video",
            cover=("capa.png", PNG, "image/png"),
        ))
        self.database.execute("UPDATE portfolios SET publicado=0")
        self.cloud.requests.clear()
        self.assertEqual(self.client.get(result["capa_url"]).status_code, 404)
        self.assertFalse(self.cloud.requests)
        self.database.execute("UPDATE portfolios SET publicado=1")
        original = self.media_row()["capa_url"]
        self.database.execute("UPDATE itens_portfolio SET capa_url=?", (original.replace("/42/", "/420/"),))
        self.cloud.requests.clear()
        opened = self.client.get(result["capa_url"])
        deleted = self.client.delete(
            f"/api/artistas/portfolio/{result['portfolio_id']}", headers=self.headers(),
        )
        self.assertGreaterEqual(opened.status_code, 400, opened.text)
        self.assertGreaterEqual(deleted.status_code, 400, deleted.text)
        self.assertFalse(any(
            req.method == "DELETE" or "/object/sign/" in req.url.path for req, _ in self.cloud.requests
        ))
        self.assertEqual(len(self.cloud.objects), 2)

    def test_nomes_repetidos_nao_sobrescrevem_objetos(self):
        first = self.assert_success(self.upload())
        second = self.assert_success(self.upload())
        self.assertNotEqual(first["portfolio_id"], second["portfolio_id"])
        self.assertEqual(len(self.cloud.objects), 2)
        for req, _ in self.cloud.requests:
            if req.method == "POST" and "/object/portfolios/" in req.url.path:
                self.assertEqual(req.headers.get("x-upsert"), "false")
                self.assertEqual(req.headers["content-type"], "image/png")

    def test_listagens_restauram_metadados_com_url_estavel_sem_chave(self):
        uploaded = self.assert_success(self.upload("catálogo.pdf", PDF, "application/pdf"))
        for path, headers in (
            ("/api/me/portfolio", self.headers()),
            ("/api/artistas/42/portfolio", {}),
        ):
            with self.subTest(path=path):
                response = self.client.get(path, headers=headers)
                self.assertEqual(response.status_code, 200, response.text)
                item = response.json()["portfolio"][0]
                self.assertEqual(item["midia_url"], uploaded["midia_url"])
                self.assertEqual(item["arquivo_nome"], "catálogo.pdf")
                self.assertEqual(item["arquivo_mime"], "application/pdf")
                self.assertEqual(item["arquivo_tamanho"], len(PDF))
                self.assertNotIn("supabase://", response.text)
                self.assertNotIn(TEST_STORAGE_KEY, response.text)

    def test_url_estavel_gera_novo_link_assinado_sem_cache(self):
        result = self.assert_success(self.upload())
        first = self.client.get(result["midia_url"])
        second = self.client.get(result["midia_url"])
        for response in (first, second):
            self.assertEqual(response.status_code, 307, response.text)
            self.assertIn("no-store", response.headers["cache-control"])
            location = urlsplit(response.headers["location"])
            self.assertEqual(location.scheme, "https")
            self.assertEqual(location.netloc, "portfolio-test.supabase.co")
            self.assertTrue(location.path.startswith("/storage/v1/object/sign/portfolios/42/"))
            self.assertNotIn(TEST_STORAGE_KEY, response.headers["location"])
        self.assertNotEqual(first.headers["location"], second.headers["location"])
        signed_requests = [json.loads(body) for req, body in self.cloud.requests if "/object/sign/" in req.url.path]
        self.assertTrue(signed_requests)
        self.assertTrue(all(0 < body["expiresIn"] <= 3600 for body in signed_requests))

    def test_midia_nao_publicada_nao_pode_ser_aberta_por_id(self):
        result = self.assert_success(self.upload())
        self.database.execute("UPDATE portfolios SET publicado=0 WHERE id=?", (result["portfolio_id"],))
        self.cloud.requests.clear()
        response = self.client.get(result["midia_url"])
        self.assertEqual(response.status_code, 404, response.text)
        self.assertFalse(self.cloud.requests)
        self.assertEqual(self.client.get("/api/artistas/42/portfolio").json()["portfolio"], [])

    def test_delete_exige_login_e_nao_exclui_item_de_outro_usuario(self):
        result = self.assert_success(self.upload())
        self.cloud.requests.clear()
        path = f"/api/artistas/portfolio/{result['portfolio_id']}"
        self.assertEqual(self.client.delete(path).status_code, 401)
        self.assertEqual(self.client.delete(path, headers=self.headers(420)).status_code, 404)
        self.assertEqual(len(self.database.execute("SELECT * FROM portfolios")), 1)
        self.assertEqual(len(self.cloud.objects), 1)
        self.assertFalse(self.cloud.requests)

    def test_delete_proprio_remove_objeto_e_registros(self):
        result = self.assert_success(self.upload())
        response = self.client.delete(
            f"/api/artistas/portfolio/{result['portfolio_id']}", headers=self.headers(),
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(self.cloud.objects)
        self.assertFalse(self.database.execute("SELECT * FROM portfolios"))
        self.assertFalse(self.database.execute("SELECT * FROM itens_portfolio"))

    def test_falha_ao_excluir_storage_mantem_registro_para_nova_tentativa(self):
        result = self.assert_success(self.upload())
        path = f"/api/artistas/portfolio/{result['portfolio_id']}"
        self.cloud.fail_delete = True
        failed = self.client.delete(path, headers=self.headers())
        self.assertIn(failed.status_code, (502, 503), failed.text)
        self.assertNotIn(TEST_STORAGE_KEY, failed.text)
        self.assertEqual(len(self.database.execute("SELECT * FROM portfolios")), 1)
        self.assertEqual(len(self.cloud.objects), 1)
        self.cloud.fail_delete = False
        self.assertEqual(self.client.delete(path, headers=self.headers()).status_code, 200)
        self.assertFalse(self.cloud.objects)

    def test_caminho_corrompido_nao_assina_nem_exclui_pasta_alheia(self):
        result = self.assert_success(self.upload())
        original = self.media_row()["midia_url"]
        for unsafe in (
            original.replace("/42/", "/420/"),
            original.replace("/42/", "/42x/"),
            "supabase://portfolios/42/../420/" + "a" * 32 + ".png",
            "supabase://portfolios/42/%2e%2e/420/" + "a" * 32 + ".png",
        ):
            with self.subTest(unsafe=unsafe):
                self.database.execute("UPDATE itens_portfolio SET midia_url=?", (unsafe,))
                self.cloud.requests.clear()
                opened = self.client.get(result["midia_url"])
                deleted = self.client.delete(
                    f"/api/artistas/portfolio/{result['portfolio_id']}", headers=self.headers(),
                )
                self.assertGreaterEqual(opened.status_code, 400, opened.text)
                self.assertGreaterEqual(deleted.status_code, 400, deleted.text)
                self.assertFalse(any(
                    req.method == "DELETE" or "/object/sign/" in req.url.path
                    for req, _ in self.cloud.requests
                ))
                self.assertEqual(len(self.database.execute("SELECT * FROM portfolios")), 1)

    def test_picker_sem_mime_detecta_tipo_e_nome_nao_altera_pasta(self):
        result = self.assert_success(self.upload(
            "../../420/imagem.PNG", PNG, "application/octet-stream",
        ))
        self.assertEqual(result["arquivo_mime"], "image/png")
        self.assertNotIn("/", result["arquivo_nome"])
        self.assertRegex(next(iter(self.cloud.objects)), r"^42/[0-9a-f]{32}\.png$")

    def test_texto_existente_funciona_sem_configuracao_supabase(self):
        with patch.dict(os.environ, {"SUPABASE_URL": "", "SUPABASE_SECRET_KEY": ""}):
            result = self.assert_success(self.client.post(
                "/api/artistas/portfolio", headers=self.headers(),
                json={"titulo": "Trabalho sem mídia", "descricao": "Descrição existente"},
            ))
            listed = self.client.get("/api/me/portfolio", headers=self.headers())
            self.assertEqual(listed.status_code, 200, listed.text)
            self.assertEqual(listed.json()["portfolio"][0]["tipo"], "texto")
            deleted = self.client.delete(
                f"/api/artistas/portfolio/{result['id']}", headers=self.headers(),
            )
            self.assertEqual(deleted.status_code, 200, deleted.text)
        self.assertFalse(self.cloud.requests)

    def test_chave_nova_apenas_em_apikey_e_legacy_em_authorization(self):
        self.assert_success(self.upload())
        for request, _ in self.cloud.requests:
            self.assertEqual(request.headers.get("apikey"), TEST_STORAGE_KEY)
            self.assertNotIn("authorization", request.headers)
        self.cloud.requests.clear()
        legacy = jwt.encode({"role": "service_role"}, "legado-ficticio-" + "x" * 32, algorithm="HS256")
        with patch.dict(os.environ, {"SUPABASE_SECRET_KEY": "", "SUPABASE_SERVICE_ROLE_KEY": legacy}):
            self.assert_success(self.upload())
        for request, _ in self.cloud.requests:
            self.assertEqual(request.headers.get("authorization"), "Bearer " + legacy)
            self.assertEqual(request.headers.get("apikey"), legacy)

    def test_falha_assinatura_e_url_externa_nao_vazam_segredo(self):
        result = self.assert_success(self.upload())
        self.cloud.fail_sign = True
        failed = self.client.get(result["midia_url"])
        self.assertIn(failed.status_code, (502, 503), failed.text)
        self.assertNotIn(TEST_STORAGE_KEY, failed.text)
        self.cloud.fail_sign = False
        self.cloud.sign_override = "https://outro-host.example.test/arquivo?token=indevido"
        external = self.client.get(result["midia_url"])
        self.assertGreaterEqual(external.status_code, 400, external.text)
        self.assertNotIn("location", external.headers)


if __name__ == "__main__":
    unittest.main()
