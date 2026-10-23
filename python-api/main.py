from datetime import datetime, timedelta, timezone
import os
import traceback

import jwt
import mysql.connector
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from typing import Optional, List
import bcrypt

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

app = FastAPI(
    title="Portal da Arte API",
    description="API FastAPI integrada diretamente com o banco de dados MySQL.",
    version="1.0.0"
)

# ============================================================
# CONFIGURAÇÃO DE CORS (Essencial para React Native/Web)
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# CONFIGURAÇÕES SEGURAS (VIA VARIÁVEIS DE AMBIENTE)
# ============================================================

SECRET_KEY = os.getenv("SECRET_KEY", "chave_padrao_insegura_caso_falhe")
ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 30

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/login"
)

# ============================================================
# CONFIGURAÇÃO DE HASH DE SENHA (DIRETO COM BCRYPT)
# ============================================================

def hash_senha(senha: str) -> str:
    senha_bytes = senha.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(senha_bytes, salt).decode('utf-8')

def verificar_senha(senha_plana: str, senha_hash: str) -> bool:
    senha_bytes = senha_plana.encode('utf-8')[:72]
    hash_bytes = senha_hash.encode('utf-8')
    try:
        return bcrypt.checkpw(senha_bytes, hash_bytes)
    except Exception:
        return False


# ============================================================
# CONEXÃO COM MYSQL (COM CREDENCIAIS SEGURAS DO .ENV)
# ============================================================

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", "root"),
        database=os.getenv("DB_NAME", "portal_da_arte")
    )


# ============================================================
# MODELOS (PYDANTIC)
# ============================================================

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class LoginRequest(BaseModel):
    usuario: str  # email
    senha: str

class CadastroRequest(BaseModel):
    email: str
    nome_completo: str
    senha: str
    tipo_documento: str  # 'cpf' ou 'cnpj'
    cpf: str | None = None
    cnpj: str | None = None
    estado: str | None = None
    cidade: str | None = None

class PerfilUpdate(BaseModel):
    nome_completo: str
    telefone: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = Field(None, max_length=2)
    tipo_documento: Optional[str] = None
    cpf: Optional[str] = None
    cnpj: Optional[str] = None
    foto_perfil: Optional[str] = None  # Recebe a imagem codificada em Base64
    biografia: Optional[str] = None
    categoria_atuacao: Optional[str] = Field(None, max_length=100)

class PerfilArtistaCreate(BaseModel):
    nome_artistico: str
    biografia: Optional[str] = None
    anos_experiencia: Optional[int] = None
    modalidade_atendimento: str = "ambos"
    cidade_atendimento: Optional[str] = None
    estado_atendimento: Optional[str] = None
    categoria_atuacao: Optional[str] = Field(None, max_length=100)
    preco_min: Optional[float] = Field(None, ge=0)
    preco_max: Optional[float] = Field(None, ge=0)

class PortfolioCreate(BaseModel):
    titulo: str = Field(..., min_length=1, max_length=150)
    descricao: Optional[str] = None

class ServicoCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    preco_min: Optional[float] = None
    preco_max: Optional[float] = None
    prazo_estimado_dias: Optional[int] = None
    modalidade: str = "ambos"

class ServicoPerfilItem(BaseModel):
    id: Optional[int] = None
    titulo: str = Field(..., min_length=1, max_length=150)
    descricao: Optional[str] = None
    preco_min: Optional[float] = Field(None, ge=0)
    preco_max: Optional[float] = Field(None, ge=0)
    modalidade: str = "ambos"

class DetalhesArtistaUpdate(BaseModel):
    nome_artistico: Optional[str] = Field(None, max_length=80)
    categorias: List[str] = []
    servicos: List[ServicoPerfilItem] = []
    modalidade_atendimento: str = "ambos"

class PropostaCreate(BaseModel):
    conversa_id: int
    servico_id: Optional[int] = None
    descricao_escopo: str
    local_ou_modalidade: Optional[str] = None
    prazo_estimado: Optional[str] = None
    valor_proposto: float


class ConversaCreate(BaseModel):
    artista_id: int
    servico_id: Optional[int] = None

class MensagemCreate(BaseModel):
    conteudo: str = Field(..., min_length=1, max_length=500)

class PagamentoCreate(BaseModel):
    contrato_id: int
    etapa_id: Optional[int] = None
    valor: float
    metodo_pagamento: str

class AvaliacaoCreate(BaseModel):
    contrato_id: int
    avaliado_id: int
    nota: int = Field(..., ge=1, le=5)
    comentario: Optional[str] = None

class RecuperarSenhaRequest(BaseModel):
    email: str


# ============================================================
# JWT (TOKENS)
# ============================================================

def criar_access_token(
    usuario_id: int,
    email: str,
    status_usuario: str
):
    expiracao = (
        datetime.now(timezone.utc)
        + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload = {
        "sub": str(usuario_id),
        "email": email,
        "status": status_usuario,
        "type": "access",
        "exp": expiracao
    }

    token = jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return token


def criar_refresh_token(
    usuario_id: int
):
    expiracao = (
        datetime.now(timezone.utc)
        + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )

    payload = {
        "sub": str(usuario_id),
        "type": "refresh",
        "exp": expiracao
    }

    token = jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return token


def get_usuario_atual(
    token: str = Depends(oauth2_scheme)
):
    credenciais_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={
            "WWW-Authenticate": "Bearer"
        }
    )

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        usuario_id = payload.get("sub")
        email = payload.get("email")
        tipo = payload.get("type")

        if usuario_id is None or tipo != "access":
            raise credenciais_exception

        return {
            "id": int(usuario_id),
            "email": email
        }

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token expirado"
        )
    except jwt.InvalidTokenError:
        raise credenciais_exception


# ============================================================
# STATUS DA API
# ============================================================

@app.get("/", tags=["Status"])
def read_root():
    return {"message": "API do Portal da Arte conectada ao banco de dados", "status": "online"}


# ============================================================
# CADASTRO DE NOVO USUÁRIO (COM HASH DE SENHA)
# ============================================================

@app.post("/api/cadastro")
def cadastrar_usuario(request: CadastroRequest):
    conexao = None
    cursor = None

    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)

        query_check = "SELECT id FROM usuarios WHERE email_normalizado = LOWER(%s)"
        cursor.execute(query_check, (request.email.strip(),))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este e-mail já está cadastrado."
            )

        senha_criptografada = hash_senha(request.senha)

        query_usuario = """
            INSERT INTO usuarios (id_publico, email, email_normalizado, senha_hash, status)
            VALUES (UUID(), %s, LOWER(%s), %s, 'ativo')
        """
        cursor.execute(query_usuario, (request.email, request.email, senha_criptografada))
        usuario_id = cursor.lastrowid

        query_perfil = """
            INSERT INTO perfis (usuario_id, nome_completo, cidade, estado, tipo_documento, cpf, cnpj)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(
            query_perfil,
            (
                usuario_id,
                request.nome_completo,
                request.cidade,
                request.estado,
                request.tipo_documento,
                request.cpf,
                request.cnpj,
            )
        )

        conexao.commit()

        return {
            "status": "sucesso",
            "mensagem": "Usuário cadastrado com sucesso!"
        }

    except Exception as err:
        if conexao:
            conexao.rollback()
        print("--- ERRO NO CADASTRO ---")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro detalhado no servidor: {str(err)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conexao:
            conexao.close()


# ============================================================
# LOGIN E RECUPERAÇÃO DE SENHA
# ============================================================

@app.post("/api/login")
def login(request: LoginRequest):
    conexao = None
    cursor = None

    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)

        query = """
            SELECT
                id,
                email,
                senha_hash,
                status
            FROM usuarios
            WHERE email_normalizado = LOWER(%s)
        """

        cursor.execute(query, (request.usuario.strip(),))
        usuario_encontrado = cursor.fetchone()

        if not usuario_encontrado:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="E-mail ou senha incorretos"
            )

        if usuario_encontrado["status"] == 'bloqueado' or usuario_encontrado["status"] == 'suspenso':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Esta conta está bloqueada ou suspensa."
            )

        if not verificar_senha(request.senha, usuario_encontrado["senha_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="E-mail ou senha incorretos"
            )

        update_query = "UPDATE usuarios SET ultimo_login_em = NOW() WHERE id = %s"
        cursor.execute(update_query, (usuario_encontrado["id"],))
        conexao.commit()

        access_token = criar_access_token(
            usuario_encontrado["id"],
            usuario_encontrado["email"],
            usuario_encontrado["status"]
        )

        refresh_token = criar_refresh_token(
            usuario_encontrado["id"]
        )

        return {
            "status": "sucesso",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "usuario": {
                "id": usuario_encontrado["id"],
                "email": usuario_encontrado["email"],
                "status": usuario_encontrado["status"]
            }
        }

    except HTTPException as he:
        raise he
    except Exception as err:
        print("--- ERRO NO LOGIN ---")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro detalhado no servidor: {str(err)}"
        )

    finally:
        if cursor:
            cursor.close()
        if conexao:
            conexao.close()


@app.post("/api/recuperar-senha", tags=["Auth"])
def recuperar_senha(request: RecuperarSenhaRequest):
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)

        query = "SELECT id, email FROM usuarios WHERE email_normalizado = LOWER(%s)"
        cursor.execute(query, (request.email.strip(),))
        usuario = cursor.fetchone()

        if usuario:
            print(f"[RECUPERAÇÃO DE SENHA] E-mail encontrado para o ID: {usuario['id']}.")

        return {
            "status": "sucesso",
            "mensagem": "Se o e-mail informado estiver cadastrado, você receberá um link com as instruções para redefinir sua senha."
        }
    except Exception as err:
        print("--- ERRO NA RECUPERAÇÃO DE SENHA ---")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro interno no servidor: {str(err)}"
        )
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


# ============================================================
# REFRESH TOKEN
# ============================================================

@app.post("/api/refresh")
def refresh_token(request: RefreshTokenRequest):
    credenciais_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token inválido ou expirado"
    )

    try:
        payload = jwt.decode(
            request.refresh_token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        usuario_id = payload.get("sub")
        tipo = payload.get("type")

        if usuario_id is None or tipo != "refresh":
            raise credenciais_exception

        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)

        query = """
            SELECT
                id,
                email,
                status
            FROM usuarios
            WHERE id = %s
            AND status = 'ativo'
        """

        cursor.execute(query, (int(usuario_id),))
        usuario = cursor.fetchone()

        cursor.close()
        conexao.close()

        if not usuario:
            raise credenciais_exception

        novo_access_token = criar_access_token(
            usuario["id"],
            usuario["email"],
            usuario["status"]
        )

        return {
            "access_token": novo_access_token,
            "token_type": "bearer"
        }

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Refresh token expirado"
        )
    except jwt.InvalidTokenError:
        raise credenciais_exception
    except Exception as err:
        print("--- ERRO NO REFRESH TOKEN ---")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro detalhado no servidor: {str(err)}"
        )


# ============================================================
# PERFIS E DADOS DO USUÁRIO LOGADO
# ============================================================

@app.get("/api/perfis/me", tags=["Perfil"])
def obter_perfil_logado(current_user: dict = Depends(get_usuario_atual)):
    """Retorna os dados cadastrados, foto de perfil, verificação de artista e estatísticas reais do usuário logado."""
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)

        usuario_id = current_user["id"]

        query = """
            SELECT 
                u.id, 
                u.email, 
                u.status,
                p.nome_completo, 
                p.telefone, 
                p.cidade, 
                p.estado, 
                p.tipo_documento, 
                p.cpf, 
                p.cnpj,
                p.foto_perfil_url
            FROM usuarios u
            LEFT JOIN perfis p ON u.id = p.usuario_id
            WHERE u.id = %s
        """
        cursor.execute(query, (usuario_id,))
        usuario = cursor.fetchone()

        if not usuario:
            raise HTTPException(status_code=404, detail="Usuário não encontrado.")

        cursor.execute("""
            SELECT nome_artistico, biografia, anos_experiencia, modalidade_atendimento, cidade_atendimento, estado_atendimento, categoria_atuacao
            FROM perfis_artista 
            WHERE usuario_id = %s
        """, (usuario_id,))
        artista = cursor.fetchone()
        cursor.execute("""
            SELECT preco_min, preco_max
            FROM servicos WHERE artista_id = %s ORDER BY id ASC LIMIT 1
        """, (usuario_id,))
        precos_artista = cursor.fetchone() or {"preco_min": None, "preco_max": None}

        is_artista = False
        nome_artistico = None
        biografia = None
        categoria_atuacao = None
        estatisticas = {
            "avaliacao_media": "0.0",
            "total_contratacoes": 0,
            "total_favoritos": 0
        }

        if artista:
            is_artista = True
            nome_artistico = artista["nome_artistico"]
            biografia = artista["biografia"]
            categoria_atuacao = artista.get("categoria_atuacao")

            try:
                cursor.execute("SELECT COUNT(*) as total FROM contratos WHERE artista_id = %s", (usuario_id,))
                res_contratacoes = cursor.fetchone()
                if res_contratacoes:
                    estatisticas["total_contratacoes"] = res_contratacoes["total"]
            except Exception:
                pass

            try:
                cursor.execute("SELECT AVG(nota) as media, COUNT(*) as favs FROM avaliacoes WHERE avaliado_id = %s", (usuario_id,))
                res_fav = cursor.fetchone()
                if res_fav and res_fav["media"] is not None:
                    estatisticas["avaliacao_media"] = f"{float(res_fav['media']):.1f}"
                else:
                    estatisticas["avaliacao_media"] = "0.0"
            except Exception:
                estatisticas["avaliacao_media"] = "0.0"

        dados_resposta = {
            "id": usuario["id"],
            "email": usuario["email"],
            "nome_completo": usuario["nome_completo"],
            "cidade": usuario["cidade"],
            "estado": usuario["estado"],
            "foto_perfil": usuario["foto_perfil_url"],
            "is_artista": is_artista,  # Retorna True apenas se o usuário tiver perfil de artista
            "nome_artistico": nome_artistico,
            "biografia": biografia,
            "categoria_atuacao": categoria_atuacao,
            "preco_min": float(precos_artista["preco_min"]) if precos_artista.get("preco_min") is not None else None,
            "preco_max": float(precos_artista["preco_max"]) if precos_artista.get("preco_max") is not None else None,
            "estatisticas": estatisticas
        }

        return {
            "status": "sucesso",
            "dados": dados_resposta
        }

    except HTTPException as he:
        raise he
    except Exception as err:
        print("--- ERRO EM /api/perfis/me (GET) ---")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro detalhado no servidor: {str(err)}"
        )
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@app.put("/api/perfis/me", tags=["Perfil"])
def atualizar_perfil_logado(perfil: PerfilUpdate, current_user: dict = Depends(get_usuario_atual)):
    """Atualiza o perfil sem inventar documento e preserva o documento obrigatório do cadastro."""
    usuario_id = current_user["id"]
    conexao = None
    cursor = None

    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)

        cursor.execute(
            "SELECT usuario_id, tipo_documento, cpf, cnpj FROM perfis WHERE usuario_id = %s",
            (usuario_id,)
        )
        db_perfil = cursor.fetchone()

        # O documento é obrigatório no cadastro. Na tela de edição, porém, o usuário
        # pode alterar apenas nome/localização/biografia: nesse caso, preserve o documento
        # que já está no banco, sem gerar CPF/CNPJ fictício nem trocar seu tipo.
        cpf_enviado = ''.join(ch for ch in (perfil.cpf or '') if ch.isdigit()) or None
        cnpj_enviado = ''.join(ch for ch in (perfil.cnpj or '') if ch.isdigit()) or None

        if cpf_enviado and cnpj_enviado:
            raise HTTPException(status_code=422, detail="Informe apenas CPF ou CNPJ, não ambos.")

        documento_enviado = bool(cpf_enviado or cnpj_enviado)

        if documento_enviado:
            if cpf_enviado:
                if len(cpf_enviado) != 11:
                    raise HTTPException(status_code=422, detail="O CPF deve conter 11 dígitos.")
                tipo_doc = "cpf"
                cpf_val, cnpj_val = cpf_enviado, None
            else:
                if len(cnpj_enviado) != 14:
                    raise HTTPException(status_code=422, detail="O CNPJ deve conter 14 dígitos.")
                tipo_doc = "cnpj"
                cpf_val, cnpj_val = None, cnpj_enviado
        else:
            if not db_perfil:
                raise HTTPException(
                    status_code=422,
                    detail="O perfil ainda não possui documento cadastrado. Informe o CPF ou CNPJ usado no cadastro."
                )
            tipo_doc = db_perfil.get("tipo_documento")
            cpf_val = db_perfil.get("cpf")
            cnpj_val = db_perfil.get("cnpj")
            if tipo_doc == "cpf" and not cpf_val:
                raise HTTPException(status_code=422, detail="O CPF do cadastro não foi encontrado. Informe o CPF para continuar.")
            if tipo_doc == "cnpj" and not cnpj_val:
                raise HTTPException(status_code=422, detail="O CNPJ do cadastro não foi encontrado. Informe o CNPJ para continuar.")
            if tipo_doc not in ("cpf", "cnpj"):
                raise HTTPException(status_code=422, detail="O tipo de documento cadastrado é inválido. Informe CPF ou CNPJ.")

        if not db_perfil:
            query_insert = """
                INSERT INTO perfis
                    (usuario_id, nome_completo, telefone, cidade, estado,
                     tipo_documento, cpf, cnpj, foto_perfil_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(query_insert, (
                usuario_id, perfil.nome_completo, perfil.telefone, perfil.cidade,
                perfil.estado, tipo_doc, cpf_val, cnpj_val, perfil.foto_perfil
            ))
        else:
            query_update = """
                UPDATE perfis
                SET nome_completo = %s,
                    telefone = %s,
                    cidade = %s,
                    estado = %s,
                    tipo_documento = %s,
                    cpf = %s,
                    cnpj = %s,
                    foto_perfil_url = COALESCE(%s, foto_perfil_url)
                WHERE usuario_id = %s
            """
            cursor.execute(query_update, (
                perfil.nome_completo, perfil.telefone, perfil.cidade,
                perfil.estado, tipo_doc, cpf_val, cnpj_val,
                perfil.foto_perfil, usuario_id
            ))

        if perfil.biografia is not None:
            cursor.execute(
                "UPDATE perfis_artista SET biografia = %s WHERE usuario_id = %s",
                (perfil.biografia, usuario_id)
            )
        if perfil.categoria_atuacao is not None:
            cursor.execute(
                "UPDATE perfis_artista SET categoria_atuacao = %s WHERE usuario_id = %s",
                (perfil.categoria_atuacao.strip() or None, usuario_id)
            )

        conexao.commit()
        return {"status": "sucesso", "mensagem": "Perfil atualizado com sucesso"}

    except mysql.connector.IntegrityError as err:
        if conexao:
            conexao.rollback()
        print("--- ERRO DE INTEGRIDADE EM /api/perfis/me (PUT) ---")
        traceback.print_exc()
        if getattr(err, "errno", None) == 1062:
            raise HTTPException(
                status_code=409,
                detail="Este CPF ou CNPJ já está cadastrado em outra conta. Confira o documento informado."
            )
        raise HTTPException(
            status_code=400,
            detail="Os dados informados não atendem às regras do cadastro."
        )
    except HTTPException:
        if conexao:
            conexao.rollback()
        raise
    except Exception:
        if conexao:
            conexao.rollback()
        print("--- ERRO EM /api/perfis/me (PUT) ---")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Não foi possível atualizar o perfil. Tente novamente."
        )
    finally:
        if cursor:
            cursor.close()
        if conexao:
            conexao.close()




# ============================================================
# MENSAGENS E CONVERSAS REAIS
# ============================================================

@app.get("/api/conversas", tags=["Mensagens"])
def listar_conversas(current_user: dict = Depends(get_usuario_atual)):
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)
        usuario_id = current_user["id"]
        cursor.execute("""
            SELECT
                c.id,
                c.contratante_id,
                c.artista_id,
                c.servico_id,
                CASE WHEN c.contratante_id = %s THEN c.artista_id ELSE c.contratante_id END AS outro_usuario_id,
                COALESCE(pa.nome_artistico, p.nome_completo, u.email, 'Usuário') AS nome,
                p.foto_perfil_url AS foto_perfil,
                COALESCE((
                    SELECT m.conteudo FROM mensagens m
                    WHERE m.conversa_id = c.id
                    ORDER BY m.criado_em DESC, m.id DESC LIMIT 1
                ), '') AS ultima_mensagem,
                (
                    SELECT m.criado_em FROM mensagens m
                    WHERE m.conversa_id = c.id
                    ORDER BY m.criado_em DESC, m.id DESC LIMIT 1
                ) AS ultima_mensagem_em,
                (
                    SELECT COUNT(*) FROM mensagens m
                    WHERE m.conversa_id = c.id
                      AND m.remetente_id <> %s
                      AND m.lida = 0
                ) AS nao_lidas
            FROM conversas c
            INNER JOIN usuarios u ON u.id = CASE
                WHEN c.contratante_id = %s THEN c.artista_id ELSE c.contratante_id END
            LEFT JOIN perfis p ON p.usuario_id = u.id
            LEFT JOIN perfis_artista pa ON pa.usuario_id = u.id
            WHERE c.contratante_id = %s OR c.artista_id = %s
            ORDER BY COALESCE(
                (SELECT m2.criado_em FROM mensagens m2
                 WHERE m2.conversa_id = c.id
                 ORDER BY m2.criado_em DESC, m2.id DESC LIMIT 1),
                c.criado_em
            ) DESC
        """, (usuario_id, usuario_id, usuario_id, usuario_id, usuario_id))
        rows = cursor.fetchall()
        for row in rows:
            if row.get("ultima_mensagem_em"):
                row["ultima_mensagem_em"] = row["ultima_mensagem_em"].isoformat()
            row["nao_lidas"] = int(row.get("nao_lidas") or 0)
        return {"conversas": rows}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Não foi possível carregar as conversas.")
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@app.post("/api/conversas", tags=["Mensagens"])
def criar_ou_obter_conversa(dados: ConversaCreate, current_user: dict = Depends(get_usuario_atual)):
    conexao = None
    cursor = None
    try:
        usuario_id = current_user["id"]
        if usuario_id == dados.artista_id:
            raise HTTPException(status_code=400, detail="Você não pode iniciar uma conversa consigo mesmo.")
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)
        cursor.execute("SELECT usuario_id FROM perfis_artista WHERE usuario_id = %s", (dados.artista_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Perfil de artista não encontrado.")
        cursor.execute("""
            SELECT id FROM conversas
            WHERE (contratante_id = %s AND artista_id = %s)
               OR (contratante_id = %s AND artista_id = %s)
            ORDER BY id DESC LIMIT 1
        """, (usuario_id, dados.artista_id, dados.artista_id, usuario_id))
        row = cursor.fetchone()
        if row:
            conversa_id = int(row["id"])
        else:
            cursor.execute("""
                INSERT INTO conversas (contratante_id, artista_id, servico_id)
                VALUES (%s, %s, %s)
            """, (usuario_id, dados.artista_id, dados.servico_id))
            conexao.commit()
            conversa_id = int(cursor.lastrowid)
        return {"status": "sucesso", "conversa_id": conversa_id}
    except HTTPException:
        if conexao: conexao.rollback()
        raise
    except Exception:
        if conexao: conexao.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Não foi possível iniciar a conversa.")
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@app.get("/api/conversas/{conversa_id}/mensagens", tags=["Mensagens"])
def listar_mensagens(conversa_id: int, current_user: dict = Depends(get_usuario_atual)):
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)
        usuario_id = current_user["id"]
        cursor.execute("""
            SELECT id FROM conversas
            WHERE id = %s AND (contratante_id = %s OR artista_id = %s)
        """, (conversa_id, usuario_id, usuario_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Conversa não encontrada.")
        cursor.execute("""
            UPDATE mensagens SET lida = 1
            WHERE conversa_id = %s AND remetente_id <> %s AND lida = 0
        """, (conversa_id, usuario_id))
        conexao.commit()
        cursor.execute("""
            SELECT id, conversa_id, remetente_id, conteudo, criado_em, lida
            FROM mensagens WHERE conversa_id = %s
            ORDER BY criado_em ASC, id ASC
        """, (conversa_id,))
        rows = cursor.fetchall()
        for row in rows:
            row["id"] = str(row["id"])
            row["fromMe"] = int(row["remetente_id"]) == usuario_id
            row["text"] = row["conteudo"]
            row["time"] = row["criado_em"].strftime("%H:%M") if row.get("criado_em") else ""
            row["criado_em"] = row["criado_em"].isoformat() if row.get("criado_em") else None
        return {"mensagens": rows}
    except HTTPException:
        raise
    except Exception:
        if conexao: conexao.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Não foi possível carregar as mensagens.")
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@app.post("/api/conversas/{conversa_id}/mensagens", tags=["Mensagens"])
def enviar_mensagem(conversa_id: int, dados: MensagemCreate, current_user: dict = Depends(get_usuario_atual)):
    conexao = None
    cursor = None
    try:
        conteudo = dados.conteudo.strip()
        if not conteudo:
            raise HTTPException(status_code=400, detail="Digite uma mensagem antes de enviar.")
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)
        usuario_id = current_user["id"]
        cursor.execute("""
            SELECT id FROM conversas
            WHERE id = %s AND (contratante_id = %s OR artista_id = %s)
        """, (conversa_id, usuario_id, usuario_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Conversa não encontrada.")
        cursor.execute("""
            INSERT INTO mensagens (conversa_id, remetente_id, conteudo)
            VALUES (%s, %s, %s)
        """, (conversa_id, usuario_id, conteudo))
        conexao.commit()
        message_id = cursor.lastrowid
        cursor.execute("""
            SELECT id, conversa_id, remetente_id, conteudo, criado_em, lida
            FROM mensagens WHERE id = %s
        """, (message_id,))
        row = cursor.fetchone()
        row["id"] = str(row["id"])
        row["fromMe"] = True
        row["text"] = row["conteudo"]
        row["time"] = row["criado_em"].strftime("%H:%M") if row.get("criado_em") else ""
        row["criado_em"] = row["criado_em"].isoformat() if row.get("criado_em") else None
        return {"status": "sucesso", "mensagem": row}
    except HTTPException:
        if conexao: conexao.rollback()
        raise
    except Exception:
        if conexao: conexao.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Não foi possível enviar a mensagem.")
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


# ============================================================
# ARTISTA, MARKETPLACE, FINANCEIRO, AVALIAÇÕES E SUPORTE
# ============================================================

@app.get("/api/artistas", tags=["Artista"])
def listar_artistas():
    """Lista pública de artistas ativos para o Explorar e a pesquisa global."""
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                pa.usuario_id AS id,
                pa.usuario_id AS artista_id,
                pa.nome_artistico,
                pa.biografia,
                pa.anos_experiencia,
                pa.modalidade_atendimento,
                pa.cidade_atendimento,
                pa.estado_atendimento,
                pa.nota_media,
                pa.total_contratacoes,
                p.foto_perfil_url,
                p.cidade,
                p.estado,
                (SELECT COUNT(*) FROM avaliacoes av
                 WHERE av.avaliado_id = pa.usuario_id) AS total_avaliacoes,
                (SELECT COALESCE(AVG(av.nota), 0) FROM avaliacoes av
                 WHERE av.avaliado_id = pa.usuario_id) AS avaliacao_media
            FROM perfis_artista pa
            INNER JOIN usuarios u ON u.id = pa.usuario_id
            LEFT JOIN perfis p ON p.usuario_id = pa.usuario_id
            WHERE u.status = 'ativo'
              AND pa.aceitando_novas_solicitacoes = TRUE
            ORDER BY pa.nota_media DESC, pa.criado_em DESC
        """)
        artistas = cursor.fetchall()

        if not artistas:
            return {"artistas": []}

        ids = [artista["id"] for artista in artistas]
        placeholders = ",".join(["%s"] * len(ids))

        cursor.execute(f"""
            SELECT ac.artista_id, c.nome
            FROM artista_categorias ac
            INNER JOIN categorias c ON c.id = ac.categoria_id
            WHERE ac.artista_id IN ({placeholders}) AND c.ativo = TRUE
            ORDER BY c.nome
        """, tuple(ids))
        categorias_por_artista = {}
        for row in cursor.fetchall():
            categorias_por_artista.setdefault(row["artista_id"], []).append(row["nome"])

        cursor.execute(f"""
            SELECT id, artista_id, titulo, descricao, preco_min, preco_max,
                   prazo_estimado_dias, modalidade
            FROM servicos
            WHERE artista_id IN ({placeholders}) AND ativo = TRUE
            ORDER BY criado_em DESC
        """, tuple(ids))
        servicos_por_artista = {}
        for row in cursor.fetchall():
            servicos_por_artista.setdefault(row["artista_id"], []).append({
                "id": row["id"],
                "titulo": row["titulo"],
                "descricao": row["descricao"],
                "preco_min": float(row["preco_min"]) if row["preco_min"] is not None else None,
                "preco_max": float(row["preco_max"]) if row["preco_max"] is not None else None,
                "prazo_estimado_dias": row["prazo_estimado_dias"],
                "modalidade": row["modalidade"],
            })

        for artista in artistas:
            artista_id = artista["id"]
            artista["categorias"] = categorias_por_artista.get(artista_id, [])
            artista["servicos"] = servicos_por_artista.get(artista_id, [])
            artista["instrumentos"] = " ".join(
                item["titulo"] + " " + (item["descricao"] or "")
                for item in artista["servicos"]
            )
            artista["estilo_musical"] = " ".join(artista["categorias"])
            artista["nota_media"] = float(artista["nota_media"] or 0)
            artista["avaliacao_media"] = float(artista["avaliacao_media"] or 0)
            artista["total_avaliacoes"] = int(artista["total_avaliacoes"] or 0)
            artista["total_contratacoes"] = int(artista["total_contratacoes"] or 0)

        return {"artistas": artistas}

    except Exception as err:
        print("--- ERRO EM /api/artistas (GET) ---")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Não foi possível carregar os artistas neste momento."
        )
    finally:
        if cursor:
            cursor.close()
        if conexao:
            conexao.close()



@app.post("/api/artistas", tags=["Artista"])
def tornar_se_artista(dados_artista: PerfilArtistaCreate, current_user: dict = Depends(get_usuario_atual)):
    usuario_id = current_user["id"]
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)

        cursor.execute("SELECT usuario_id FROM perfis_artista WHERE usuario_id = %s", (usuario_id,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Este usuário já possui um perfil de artista.")

        if dados_artista.preco_min is not None and dados_artista.preco_max is not None and dados_artista.preco_max < dados_artista.preco_min:
            raise HTTPException(status_code=400, detail="O preço máximo não pode ser menor que o preço mínimo.")

        query = """
            INSERT INTO perfis_artista (usuario_id, nome_artistico, biografia, anos_experiencia, modalidade_atendimento, cidade_atendimento, estado_atendimento, categoria_atuacao)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            usuario_id, dados_artista.nome_artistico, dados_artista.biografia,
            dados_artista.anos_experiencia, dados_artista.modalidade_atendimento,
            dados_artista.cidade_atendimento, dados_artista.estado_atendimento,
            dados_artista.categoria_atuacao.strip() if dados_artista.categoria_atuacao else None
        ))
        if dados_artista.preco_min is not None or dados_artista.preco_max is not None:
            preco_min = dados_artista.preco_min if dados_artista.preco_min is not None else dados_artista.preco_max
            preco_max = dados_artista.preco_max if dados_artista.preco_max is not None else dados_artista.preco_min
            cursor.execute("""
                INSERT INTO servicos (artista_id, titulo, descricao, preco_min, preco_max, prazo_estimado_dias, modalidade)
                VALUES (%s, %s, %s, %s, %s, NULL, %s)
            """, (usuario_id, "Apresentação artística", "Valor inicial informado no cadastro do perfil artístico.", preco_min, preco_max, dados_artista.modalidade_atendimento))
        conexao.commit()
        return {"status": "sucesso", "mensagem": "Perfil de artista criado com sucesso"}
    except HTTPException as he:
        raise he
    except Exception as err:
        if conexao: conexao.rollback()
        print("--- ERRO DETALHADO EM /api/artistas (POST) ---")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro detalhado no banco de dados: {str(err)}"
        )
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


class PrecoArtistaUpdate(BaseModel):
    preco_min: Optional[float] = Field(None, ge=0)
    preco_max: Optional[float] = Field(None, ge=0)


@app.put("/api/artistas/me/preco", tags=["Artista"])
def atualizar_preco_artista(dados: PrecoArtistaUpdate, current_user: dict = Depends(get_usuario_atual)):
    """Atualiza a faixa de preço pública do artista no serviço de referência."""
    usuario_id = current_user["id"]
    if dados.preco_min is not None and dados.preco_max is not None and dados.preco_max < dados.preco_min:
        raise HTTPException(status_code=422, detail="O preço máximo não pode ser menor que o preço mínimo.")
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)
        cursor.execute("SELECT usuario_id FROM perfis_artista WHERE usuario_id = %s", (usuario_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="É necessário ter um perfil de artista.")

        # O cadastro de artista cria um serviço de referência. Se ainda não existir,
        # cria-o; caso exista, atualiza somente o primeiro serviço para manter o valor editável.
        cursor.execute("SELECT id FROM servicos WHERE artista_id = %s AND ativo = TRUE ORDER BY id ASC LIMIT 1", (usuario_id,))
        servico = cursor.fetchone()
        preco_min = dados.preco_min
        preco_max = dados.preco_max
        if preco_min is None and preco_max is not None:
            preco_min = preco_max
        if preco_max is None and preco_min is not None:
            preco_max = preco_min
        if servico:
            cursor.execute("UPDATE servicos SET preco_min = %s, preco_max = %s WHERE id = %s AND artista_id = %s",
                           (preco_min, preco_max, servico["id"], usuario_id))
        elif preco_min is not None or preco_max is not None:
            cursor.execute("""INSERT INTO servicos (artista_id, titulo, descricao, preco_min, preco_max, modalidade)
                              VALUES (%s, %s, %s, %s, %s, %s)""",
                           (usuario_id, "Apresentação artística", "Valor de referência dos serviços artísticos.", preco_min, preco_max, "ambos"))
        conexao.commit()
        return {"status": "sucesso", "mensagem": "Preço atualizado com sucesso."}
    except HTTPException:
        if conexao: conexao.rollback()
        raise
    except Exception as err:
        if conexao: conexao.rollback()
        print("--- ERRO EM /api/artistas/me/preco (PUT) ---")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Não foi possível atualizar o preço do artista.")
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@app.post("/api/artistas/servicos", tags=["Artista"])
def criar_servico_artista(servico: ServicoCreate, current_user: dict = Depends(get_usuario_atual)):
    usuario_id = current_user["id"]
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)

        cursor.execute("SELECT usuario_id FROM perfis_artista WHERE usuario_id = %s", (usuario_id,))
        artista = cursor.fetchone()
        if not artista:
            raise HTTPException(status_code=403, detail="Usuário não possui perfil de artista cadastrado.")

        query = """
            INSERT INTO servicos (artista_id, titulo, descricao, preco_min, preco_max, prazo_estimado_dias, modalidade)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            usuario_id, servico.titulo, servico.descricao,
            servico.preco_min, servico.preco_max,
            servico.prazo_estimado_dias, servico.modalidade
        ))
        conexao.commit()
        return {"status": "sucesso", "mensagem": "Serviço cadastrado com sucesso"}
    except HTTPException as he:
        raise he
    except Exception as err:
        if conexao: conexao.rollback()
        print("--- ERRO EM /api/artistas/servicos (POST) ---")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro detalhado no servidor: {str(err)}"
        )
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@app.get("/api/artistas/me/detalhes", tags=["Artista"])
def obter_detalhes_artista(current_user: dict = Depends(get_usuario_atual)):
    """Lista as categorias/estilos e serviços editáveis do artista autenticado."""
    usuario_id = current_user["id"]
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)
        cursor.execute("SELECT usuario_id, nome_artistico, modalidade_atendimento FROM perfis_artista WHERE usuario_id = %s", (usuario_id,))
        perfil_artista = cursor.fetchone()
        if not perfil_artista:
            raise HTTPException(status_code=403, detail="É necessário ter um perfil de artista.")
        cursor.execute("""SELECT c.nome FROM artista_categorias ac
                          INNER JOIN categorias c ON c.id = ac.categoria_id
                          WHERE ac.artista_id = %s AND c.ativo = TRUE ORDER BY c.nome""", (usuario_id,))
        categorias = [row["nome"] for row in cursor.fetchall()]
        cursor.execute("""SELECT id, titulo, descricao, preco_min, preco_max, modalidade FROM servicos
                          WHERE artista_id = %s AND ativo = TRUE ORDER BY id ASC""", (usuario_id,))
        servicos = cursor.fetchall()
        return {"categorias": categorias, "servicos": servicos, "modalidade_atendimento": perfil_artista.get("modalidade_atendimento") or "ambos", "nome_artistico": perfil_artista.get("nome_artistico") or ""}
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Não foi possível carregar os serviços e categorias.")
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@app.put("/api/artistas/me/detalhes", tags=["Artista"])
def atualizar_detalhes_artista(dados: DetalhesArtistaUpdate, current_user: dict = Depends(get_usuario_atual)):
    """Atualiza categorias/estilos e lista de serviços mostrados no perfil público."""
    usuario_id = current_user["id"]
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)
        cursor.execute("SELECT usuario_id FROM perfis_artista WHERE usuario_id = %s", (usuario_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="É necessário ter um perfil de artista.")

        modalidade_artista = dados.modalidade_atendimento if dados.modalidade_atendimento in ("presencial", "remoto", "ambos") else "ambos"
        nome_artistico = (dados.nome_artistico or "").strip()[:80]
        cursor.execute("UPDATE perfis_artista SET modalidade_atendimento = %s, nome_artistico = %s WHERE usuario_id = %s", (modalidade_artista, nome_artistico or None, usuario_id))

        # Normaliza categorias e evita duplicatas sem diferenciar maiúsculas/minúsculas.
        categorias = []
        seen = set()
        for nome in dados.categorias:
            nome = (nome or "").strip()[:100]
            if nome and nome.casefold() not in seen:
                categorias.append(nome)
                seen.add(nome.casefold())
        cursor.execute("DELETE FROM artista_categorias WHERE artista_id = %s", (usuario_id,))
        for nome in categorias:
            cursor.execute("SELECT id FROM categorias WHERE LOWER(nome) = LOWER(%s) LIMIT 1", (nome,))
            categoria = cursor.fetchone()
            if not categoria:
                cursor.execute("INSERT INTO categorias (nome, descricao, ativo) VALUES (%s, %s, TRUE)", (nome, "Categoria/estilo informado pelo artista"))
                categoria_id = cursor.lastrowid
            else:
                categoria_id = categoria["id"]
            cursor.execute("INSERT IGNORE INTO artista_categorias (artista_id, categoria_id) VALUES (%s, %s)", (usuario_id, categoria_id))

        # Atualiza serviços enviados, cria os novos e desativa os removidos para preservar históricos/contratos.
        enviados = set()
        for item in dados.servicos:
            titulo = item.titulo.strip()
            if not titulo:
                continue
            descricao = (item.descricao or "").strip() or None
            modalidade = item.modalidade if item.modalidade in ("presencial", "remoto", "ambos") else "ambos"
            if item.id:
                cursor.execute("SELECT id FROM servicos WHERE id = %s AND artista_id = %s", (item.id, usuario_id))
                existente = cursor.fetchone()
            else:
                existente = None
            if existente:
                if item.preco_min is not None and item.preco_max is not None and item.preco_max < item.preco_min:
                    raise HTTPException(status_code=400, detail=f"O valor máximo do serviço '{titulo}' não pode ser menor que o mínimo.")
                cursor.execute("UPDATE servicos SET titulo = %s, descricao = %s, preco_min = %s, preco_max = %s, modalidade = %s, ativo = TRUE WHERE id = %s AND artista_id = %s",
                               (titulo, descricao, item.preco_min, item.preco_max, modalidade, item.id, usuario_id))
                enviados.add(item.id)
            else:
                if item.preco_min is not None and item.preco_max is not None and item.preco_max < item.preco_min:
                    raise HTTPException(status_code=400, detail=f"O valor máximo do serviço '{titulo}' não pode ser menor que o mínimo.")
                cursor.execute("INSERT INTO servicos (artista_id, titulo, descricao, preco_min, preco_max, modalidade, ativo) VALUES (%s, %s, %s, %s, %s, %s, TRUE)",
                               (usuario_id, titulo, descricao, item.preco_min, item.preco_max, modalidade))
                enviados.add(cursor.lastrowid)
        cursor.execute("SELECT id FROM servicos WHERE artista_id = %s AND ativo = TRUE", (usuario_id,))
        ids_ativos = [row["id"] for row in cursor.fetchall()]
        removidos = [item_id for item_id in ids_ativos if item_id not in enviados]
        if removidos:
            placeholders = ",".join(["%s"] * len(removidos))
            cursor.execute(f"UPDATE servicos SET ativo = FALSE WHERE artista_id = %s AND id IN ({placeholders})", tuple([usuario_id] + removidos))

        conexao.commit()
        cursor.execute("""SELECT c.nome FROM artista_categorias ac INNER JOIN categorias c ON c.id = ac.categoria_id
                          WHERE ac.artista_id = %s AND c.ativo = TRUE ORDER BY c.nome""", (usuario_id,))
        categorias_salvas = [row["nome"] for row in cursor.fetchall()]
        cursor.execute("SELECT id, titulo, descricao, preco_min, preco_max, modalidade FROM servicos WHERE artista_id = %s AND ativo = TRUE ORDER BY id ASC", (usuario_id,))
        return {"status": "sucesso", "categorias": categorias_salvas, "servicos": cursor.fetchall()}
    except HTTPException:
        if conexao: conexao.rollback()
        raise
    except Exception:
        if conexao: conexao.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Não foi possível salvar os serviços e categorias.")
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@app.get("/api/artistas/{artista_id}/portfolio", tags=["Artista"])
def listar_portfolio_publico(artista_id: int):
    """Retorna os itens publicados do portfólio de um artista."""
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)
        cursor.execute("""
            SELECT p.id, p.titulo, p.descricao, p.tipo, p.ordem,
                   i.id AS item_id, i.tipo_midia, i.midia_url, i.titulo AS item_titulo,
                   i.descricao AS item_descricao
            FROM portfolios p
            LEFT JOIN itens_portfolio i ON i.portfolio_id = p.id
            WHERE p.artista_id = %s AND p.publicado = TRUE
            ORDER BY p.ordem ASC, p.criado_em DESC, i.ordem ASC, i.criado_em ASC
        """, (artista_id,))
        rows = cursor.fetchall()
        items = []
        for row in rows:
            items.append({
                "id": row["item_id"] or row["id"],
                "portfolio_id": row["id"],
                "titulo": row["item_titulo"] or row["titulo"],
                "descricao": row["item_descricao"] or row["descricao"] or "",
                "tipo": row["tipo_midia"] or row["tipo"],
                "midia_url": row["midia_url"] or "",
            })
        return {"portfolio": items}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Não foi possível carregar o portfólio.")
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@app.get("/api/me/portfolio", tags=["Artista"])
def listar_meu_portfolio(current_user: dict = Depends(get_usuario_atual)):
    return listar_portfolio_publico(int(current_user["id"]))


@app.post("/api/artistas/portfolio", tags=["Artista"])
def criar_item_portfolio(item: PortfolioCreate, current_user: dict = Depends(get_usuario_atual)):
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)
        artista_id = int(current_user["id"])
        cursor.execute("SELECT usuario_id FROM perfis_artista WHERE usuario_id = %s", (artista_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="É necessário ter um perfil de artista.")
        cursor.execute("""
            INSERT INTO portfolios (artista_id, titulo, descricao, tipo, ordem, publicado)
            VALUES (%s, %s, %s, 'projeto', 0, TRUE)
        """, (artista_id, item.titulo.strip(), item.descricao))
        portfolio_id = cursor.lastrowid
        cursor.execute("""
            INSERT INTO itens_portfolio (portfolio_id, tipo_midia, midia_url, titulo, descricao, ordem)
            VALUES (%s, 'texto', 'texto://', %s, %s, 0)
        """, (portfolio_id, item.titulo.strip(), item.descricao))
        conexao.commit()
        return {"status": "sucesso", "id": portfolio_id, "titulo": item.titulo.strip(), "descricao": item.descricao or "", "tipo": "texto", "midia_url": "texto://"}
    except HTTPException:
        if conexao: conexao.rollback()
        raise
    except Exception:
        if conexao: conexao.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Não foi possível salvar o item do portfólio.")
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@app.delete("/api/artistas/portfolio/{portfolio_id}", tags=["Artista"])
def excluir_item_portfolio(portfolio_id: int, current_user: dict = Depends(get_usuario_atual)):
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)
        cursor.execute("DELETE FROM portfolios WHERE id = %s AND artista_id = %s", (portfolio_id, int(current_user["id"])))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Item não encontrado.")
        conexao.commit()
        return {"status": "sucesso"}
    except HTTPException:
        if conexao: conexao.rollback()
        raise
    except Exception:
        if conexao: conexao.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Não foi possível excluir o item do portfólio.")
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@app.post("/api/propostas", tags=["Marketplace"])
def enviar_proposta(proposta: PropostaCreate, current_user: dict = Depends(get_usuario_atual)):
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor()

        query = """
            INSERT INTO propostas (conversa_id, servico_id, descricao_escopo, local_ou_modalidade, prazo_estimado, valor_proposto)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            proposta.conversa_id, proposta.servico_id, proposta.descricao_escopo,
            proposta.local_ou_modalidade, proposta.prazo_estimado, proposta.valor_proposto
        ))
        conexao.commit()
        return {"status": "sucesso", "mensagem": "Proposta enviada com sucesso"}
    except Exception as err:
        if conexao: conexao.rollback()
        print("--- ERRO EM /api/propostas (POST) ---")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro detalhado no servidor: {str(err)}"
        )
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@app.post("/api/pagamentos", tags=["Financeiro"])
def processar_pagamento(pagamento: PagamentoCreate, current_user: dict = Depends(get_usuario_atual)):
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor()

        query = """
            INSERT INTO pagamentos (contrato_id, etapa_id, valor, metodo_pagamento, status)
            VALUES (%s, %s, %s, %s, 'pendente')
        """
        cursor.execute(query, (
            pagamento.contrato_id, pagamento.etapa_id,
            pagamento.valor, pagamento.metodo_pagamento
        ))
        conexao.commit()
        return {"status": "sucesso", "mensagem": "Pagamento registrado com sucesso"}
    except Exception as err:
        if conexao: conexao.rollback()
        print("--- ERRO EM /api/pagamentos (POST) ---")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro detalhado no servidor: {str(err)}"
        )
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@app.post("/api/avaliacoes", tags=["Avaliações"])
def criar_avaliacao(avaliacao: AvaliacaoCreate, current_user: dict = Depends(get_usuario_atual)):
    avaliador_id = current_user["id"]
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor()

        query = """
            INSERT INTO avaliacoes (contrato_id, avaliador_id, avaliado_id, nota, comentario)
            VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            avaliacao.contrato_id, avaliador_id,
            avaliacao.avaliado_id, avaliacao.nota, avaliacao.comentario
        ))
        conexao.commit()
        return {"status": "sucesso", "mensagem": "Avaliação registrada com sucesso"}
    except Exception as err:
        if conexao: conexao.rollback()
        print("--- ERRO EM /api/avaliacoes (POST) ---")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro detalhado no servidor: {str(err)}"
        )
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@app.post("/api/ocorrencias", tags=["Suporte e Segurança"])
def abrir_ocorrencia(tipo: str, assunto: str, descricao: str, current_user: dict = Depends(get_usuario_atual)):
    aberto_por_id = current_user["id"]
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor()

        query = """
            INSERT INTO ocorrencias (aberto_por_id, tipo, assunto, descricao, status)
            VALUES (%s, %s, %s, %s, 'aberta')
        """
        cursor.execute(query, (aberto_por_id, tipo, assunto, descricao))
        conexao.commit()
        return {"status": "sucesso", "mensagem": "Ocorrência aberta com sucesso"}
    except Exception as err:
        if conexao: conexao.rollback()
        print("--- ERRO EM /api/ocorrencias (POST) ---")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro detalhado no servidor: {str(err)}"
        )
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()