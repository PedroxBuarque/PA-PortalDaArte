"""Arquivos de portfólio no Supabase Storage, acessados somente pela API.

O login continua sendo o do Portal da Arte. A chave privilegiada do Supabase
nunca é enviada ao aplicativo; por isso a autorização de cada objeto é feita
no backend com o ID do usuário autenticado.
"""

from dataclasses import dataclass, field
import base64
import json
import logging
import os
from pathlib import PurePosixPath
import re
from typing import BinaryIO, Iterable
from urllib.parse import parse_qsl, quote, urlsplit, urlunsplit
import uuid

import httpx
from fastapi import UploadFile
from starlette.formparsers import MultiPartException
from starlette.responses import JSONResponse


SIGNED_URL_TTL_SECONDS = 600
CHUNK_SIZE = 64 * 1024
logger = logging.getLogger(__name__)
FORMATOS = {
    ".jpg": ("image/jpeg", "imagem"),
    ".jpeg": ("image/jpeg", "imagem"),
    ".png": ("image/png", "imagem"),
    ".gif": ("image/gif", "imagem"),
    ".webp": ("image/webp", "imagem"),
    ".mp4": ("video/mp4", "video"),
    ".mov": ("video/quicktime", "video"),
    ".webm": ("video/webm", "video"),
    ".pdf": ("application/pdf", "pdf"),
}


class PortfolioStorageError(Exception):
    """Erro seguro para retornar ao cliente, sem respostas/chaves do provedor."""

    def __init__(self, status_code: int, detail: str, upload_incerto: bool = False):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.upload_incerto = upload_incerto


@dataclass(frozen=True)
class StorageConfig:
    url: str
    key: str = field(repr=False)
    bucket: str = "portfolios"
    max_bytes: int = 50 * 1024 * 1024
    timeout_seconds: int = 60


@dataclass(frozen=True)
class ArquivoValidado:
    nome: str
    mime: str
    tamanho: int
    tipo: str
    extensao: str


def limite_arquivo_bytes() -> int:
    try:
        valor = int(os.getenv("PORTFOLIO_MAX_FILE_MB", "50"))
        if not 1 <= valor <= 50:
            raise ValueError
    except ValueError:
        raise PortfolioStorageError(
            503, "PORTFOLIO_MAX_FILE_MB deve ser um número inteiro entre 1 e 50."
        ) from None
    return valor * 1024 * 1024


def carregar_config_storage() -> StorageConfig:
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    try:
        parsed = urlsplit(url)
        valido = (
            parsed.scheme == "https" and bool(parsed.hostname)
            and not parsed.username and not parsed.password
            and not parsed.path and not parsed.query and not parsed.fragment
            and parsed.port in (None, 443)
            and not any(c.isspace() or ord(c) < 32 for c in url)
        )
    except ValueError:
        valido = False
    if not valido:
        raise PortfolioStorageError(
            503, "Configure SUPABASE_URL no .env da API com a URL HTTPS do projeto."
        )

    key = os.getenv("SUPABASE_SECRET_KEY", "").strip()
    if key:
        if not re.fullmatch(r"sb_secret_[A-Za-z0-9_-]{20,}", key):
            raise PortfolioStorageError(
                503, "SUPABASE_SECRET_KEY inválida. Use a chave secreta do projeto somente no .env da API."
            )
    else:
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        try:
            partes = key.split(".")
            if len(partes) != 3 or not all(re.fullmatch(r"[A-Za-z0-9_-]+", p) for p in partes):
                raise ValueError
            # Valida apenas o tipo da configuração; a assinatura é verificada pelo Supabase.
            payload = json.loads(base64.urlsafe_b64decode(partes[1] + "=" * (-len(partes[1]) % 4)))
            if not isinstance(payload, dict) or payload.get("role") != "service_role":
                raise ValueError
        except (ValueError, TypeError, UnicodeError):
            raise PortfolioStorageError(
                503, "Configure SUPABASE_SECRET_KEY no .env da API (ou a chave legada SUPABASE_SERVICE_ROLE_KEY)."
            ) from None

    bucket = os.getenv("SUPABASE_PORTFOLIO_BUCKET", "portfolios").strip()
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,62}", bucket):
        raise PortfolioStorageError(503, "SUPABASE_PORTFOLIO_BUCKET inválido.")
    try:
        timeout = int(os.getenv("SUPABASE_STORAGE_TIMEOUT_SECONDS", "60"))
        if not 5 <= timeout <= 120:
            raise ValueError
    except ValueError:
        raise PortfolioStorageError(
            503, "SUPABASE_STORAGE_TIMEOUT_SECONDS deve estar entre 5 e 120."
        ) from None
    return StorageConfig(url, key, bucket, limite_arquivo_bytes(), timeout)


def _assinatura_compativel(extensao: str, header: bytes) -> bool:
    if extensao in (".jpg", ".jpeg"):
        return header.startswith(b"\xff\xd8\xff")
    if extensao == ".png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if extensao == ".gif":
        return header[:6] in (b"GIF87a", b"GIF89a")
    if extensao == ".webp":
        return header[:4] == b"RIFF" and header[8:12] == b"WEBP"
    if extensao == ".pdf":
        return bool(re.match(br"%PDF-[12]\.\d", header))
    if extensao == ".webm":
        return header.startswith(b"\x1aE\xdf\xa3") and b"webm" in header[:4096].lower()
    if extensao in (".mp4", ".mov"):
        # MP4/MOV usam um contêiner ISO-BMFF; rejeita HEIC/AVIF e outros ftyp.
        if len(header) < 16 or header[4:8] != b"ftyp":
            return False
        tamanho_box = int.from_bytes(header[:4], "big")
        if tamanho_box < 16 or tamanho_box > len(header):
            return False
        marcas = {header[8:12]}
        marcas.update(header[i:i + 4] for i in range(16, tamanho_box, 4))
        if extensao == ".mov":
            return b"qt  " in marcas
        marcas_video = {b"isom", b"iso2", b"iso3", b"iso4", b"iso5", b"iso6", b"mp41", b"mp42", b"avc1", b"M4V ", b"dash"}
        marcas_imagem = {b"avif", b"avis", b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1"}
        return bool(marcas & marcas_video) and not bool(marcas & marcas_imagem)
    return False


def validar_arquivo_portfolio(arquivo: UploadFile, limite_bytes: int) -> ArquivoValidado:
    nome = (arquivo.filename or "").replace("\\", "/").split("/")[-1].strip()
    nome = "".join(c for c in nome if ord(c) >= 32 and ord(c) != 127)
    extensao = PurePosixPath(nome).suffix.lower()
    if not nome or len(nome) > 255 or extensao not in FORMATOS:
        raise PortfolioStorageError(
            415, "Envie uma imagem JPG, PNG, GIF ou WebP, um vídeo MP4, MOV ou WebM, ou um PDF."
        )
    mime, tipo = FORMATOS[extensao]
    informado = (arquivo.content_type or "").split(";", 1)[0].strip().lower()
    aliases = {"image/jpg": "image/jpeg", "application/x-pdf": "application/pdf"}
    informado = aliases.get(informado, informado)
    if informado not in ("", "application/octet-stream", mime):
        raise PortfolioStorageError(415, "O tipo informado não corresponde à extensão do arquivo.")

    tamanho = 0
    header = bytearray()
    arquivo.file.seek(0)
    try:
        while bloco := arquivo.file.read(CHUNK_SIZE):
            tamanho += len(bloco)
            if tamanho > limite_bytes:
                raise PortfolioStorageError(
                    413, f"O arquivo excede o limite de {limite_bytes // (1024 * 1024)} MB."
                )
            if len(header) < CHUNK_SIZE:
                header.extend(bloco[:CHUNK_SIZE - len(header)])
    finally:
        arquivo.file.seek(0)
    if tamanho == 0:
        raise PortfolioStorageError(400, "O arquivo selecionado está vazio.")
    if not _assinatura_compativel(extensao, bytes(header)):
        raise PortfolioStorageError(415, "O conteúdo não corresponde ao formato informado ou o arquivo está danificado.")
    return ArquivoValidado(nome, mime, tamanho, tipo, ".jpg" if extensao == ".jpeg" else extensao)


def criar_caminho(usuario_id: int, extensao: str) -> str:
    if usuario_id <= 0 or extensao not in FORMATOS:
        raise PortfolioStorageError(400, "Destino de arquivo inválido.")
    return f"{usuario_id}/{uuid.uuid4().hex}{extensao}"


def referencia_storage(bucket: str, caminho: str) -> str:
    return f"supabase://{bucket}/{caminho}"


def ler_referencia(referencia: str, usuario_id: int) -> tuple[str, str] | None:
    if not referencia.startswith("supabase://"):
        return None
    match = re.fullmatch(
        r"supabase://([a-z0-9][a-z0-9_-]{0,62})/([1-9][0-9]*)/([0-9a-f]{32})(\.[a-z0-9]+)",
        referencia,
    )
    if not match or int(match[2]) != int(usuario_id) or match[4] not in FORMATOS:
        raise PortfolioStorageError(503, "A referência do arquivo de portfólio é inválida.")
    return match[1], f"{match[2]}/{match[3]}{match[4]}"


def _blocos(arquivo: BinaryIO):
    while bloco := arquivo.read(CHUNK_SIZE):
        yield bloco


class SupabasePortfolioStorage:
    def __init__(self, config: StorageConfig | None = None, transport: httpx.BaseTransport | None = None):
        self.config = config or carregar_config_storage()
        self.transport = transport

    def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        headers = {"apikey": self.config.key}
        # As chaves novas não são JWTs e só devem ser enviadas em apikey.
        if not self.config.key.startswith("sb_secret_"):
            headers["Authorization"] = f"Bearer {self.config.key}"
        headers.update(kwargs.pop("headers", {}))
        try:
            with httpx.Client(
                timeout=httpx.Timeout(self.config.timeout_seconds, connect=10),
                follow_redirects=False, transport=self.transport,
            ) as client:
                response = client.request(
                    method, f"{self.config.url}/storage/v1{path}", headers=headers, **kwargs
                )
        except (httpx.RequestError, httpx.InvalidURL):
            raise PortfolioStorageError(503, "Não foi possível conectar ao Supabase. Tente novamente.", upload_incerto=True) from None
        if response.is_success:
            return response
        # Nunca repassa response.text nem a exceção HTTP (podem conter dados internos).
        try:
            body = response.json()
            code = body.get("code") or body.get("error") if isinstance(body, dict) else None
        except ValueError:
            code = None
        if code == "NoSuchBucket" or (response.status_code == 404 and path.startswith("/bucket/")):
            raise PortfolioStorageError(503, "Crie o bucket privado de portfólios no Supabase e confira SUPABASE_PORTFOLIO_BUCKET.")
        if code == "NoSuchKey" or (response.status_code == 404 and path.startswith("/object/sign/")):
            if method == "DELETE":
                return response
            raise PortfolioStorageError(404, "Arquivo não encontrado no armazenamento.")
        if response.status_code in (401, 403):
            raise PortfolioStorageError(503, "O Supabase recusou a credencial da API. Confira a chave secreta no .env.")
        if response.status_code == 413:
            raise PortfolioStorageError(413, "O arquivo excede o limite permitido no bucket do Supabase.")
        if response.status_code == 429:
            raise PortfolioStorageError(503, "O armazenamento está temporariamente ocupado. Tente novamente.")
        if response.status_code == 409:
            raise PortfolioStorageError(409, "O destino deste arquivo já existe. Tente enviar novamente.")
        raise PortfolioStorageError(
            502, "O Supabase não concluiu a operação. Confira o bucket e tente novamente.",
            upload_incerto=response.status_code >= 500,
        )

    def verificar_bucket_privado(self) -> dict:
        response = self._request("GET", f"/bucket/{quote(self.config.bucket, safe='')}")
        try:
            bucket = response.json()
            valido = isinstance(bucket, dict) and bucket.get("id") == self.config.bucket and bucket.get("public") is False
        except ValueError:
            valido = False
        if not valido:
            raise PortfolioStorageError(503, "O bucket de portfólios precisa existir e estar marcado como privado no Supabase.")
        return bucket

    def upload(self, caminho: str, arquivo: UploadFile, metadata: ArquivoValidado) -> None:
        arquivo.file.seek(0)
        try:
            self._request(
                "POST", f"/object/{quote(self.config.bucket, safe='')}/{quote(caminho, safe='/')}",
                content=_blocos(arquivo.file),
                headers={
                    "Content-Type": metadata.mime,
                    "Content-Length": str(metadata.tamanho),
                    "x-upsert": "false",
                    "cache-control": "max-age=60",
                },
            )
        except PortfolioStorageError as error:
            if error.upload_incerto:
                # Um timeout pode acontecer depois de o provedor ter gravado o objeto.
                # Não se aplica a conflitos 409: nunca apagar um arquivo preexistente.
                try:
                    self.delete([caminho])
                except PortfolioStorageError:
                    logger.error("Limpeza pendente de upload interrompido: bucket=%s caminho=%s", self.config.bucket, caminho)
            raise

    def delete(self, caminhos: Iterable[str]) -> None:
        caminhos = list(dict.fromkeys(caminhos))
        if caminhos:
            self._request(
                "DELETE", f"/object/{quote(self.config.bucket, safe='')}", json={"prefixes": caminhos}
            )

    def signed_url(self, caminho: str) -> str:
        suffix = f"/object/sign/{quote(self.config.bucket, safe='')}/{quote(caminho, safe='/')}"
        response = self._request("POST", suffix, json={"expiresIn": SIGNED_URL_TTL_SECONDS})
        try:
            body = response.json()
            value = body.get("signedURL") if isinstance(body, dict) else None
            if not isinstance(value, str):
                raise ValueError
            parsed = urlsplit(value)
            base = urlsplit(self.config.url)
            if parsed.fragment or parsed.username or parsed.password:
                raise ValueError
            if parsed.netloc and (parsed.scheme, parsed.netloc) != (base.scheme, base.netloc):
                raise ValueError
            if parsed.scheme and not parsed.netloc:
                raise ValueError
            path = parsed.path
            if path == suffix:
                path = "/storage/v1" + path
            if path != "/storage/v1" + suffix:
                raise ValueError
            params = parse_qsl(parsed.query, keep_blank_values=True)
            if len(params) != 1 or params[0][0] != "token" or not params[0][1]:
                raise ValueError
            return urlunsplit((base.scheme, base.netloc, path, parsed.query, ""))
        except (ValueError, TypeError):
            raise PortfolioStorageError(502, "O Supabase retornou um link de arquivo inválido.") from None


class LimiteUploadPortfolioMiddleware:
    """Limita o corpo multipart enquanto chega, inclusive sem Content-Length."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if (scope["type"] != "http" or scope.get("method") != "POST"
                or scope.get("path", "").rstrip("/") != "/api/artistas/portfolio/arquivo"):
            await self.app(scope, receive, send)
            return
        try:
            limite = limite_arquivo_bytes()
        except PortfolioStorageError as error:
            await JSONResponse({"detail": error.detail}, status_code=error.status_code)(scope, receive, send)
            return
        # Espaço para os campos de texto e cabeçalhos do multipart, além do arquivo.
        limite_corpo = limite + min(10 * 1024 * 1024, limite) + CHUNK_SIZE
        detail = f"O arquivo excede o limite de {limite // (1024 * 1024)} MB."
        headers = dict(scope.get("headers", []))
        try:
            content_length = int(headers.get(b"content-length", b"0"))
        except ValueError:
            content_length = 0
        if content_length > limite_corpo:
            await JSONResponse({"detail": detail}, status_code=413)(scope, receive, send)
            return
        recebido = 0
        excedido = False
        respondido = False

        async def receber_limitado():
            nonlocal recebido, excedido
            message = await receive()
            if message["type"] == "http.request":
                recebido += len(message.get("body", b""))
                if recebido > limite_corpo:
                    excedido = True
                    # MultiPartException faz o parser fechar os temporários já abertos.
                    raise MultiPartException(detail)
            return message

        async def enviar_limitado(message):
            nonlocal respondido
            if excedido:
                # Starlette converte MultiPartException em 400; este limite é 413.
                if not respondido:
                    respondido = True
                    await JSONResponse({"detail": detail}, status_code=413)(scope, receive, send)
                return
            await send(message)

        await self.app(scope, receber_limitado, enviar_limitado)
