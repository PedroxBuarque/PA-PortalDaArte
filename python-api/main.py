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
        password=os.getenv("DB_PASSWORD", ""),
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
    tipo_documento: str
    cpf: Optional[str] = None
    cnpj: Optional[str] = None
    foto_perfil: Optional[str] = None  # Recebe a imagem codificada em Base64
    biografia: Optional[str] = None

class PerfilArtistaCreate(BaseModel):
    nome_artistico: str
    biografia: Optional[str] = None
    anos_experiencia: Optional[int] = None
    modalidade_atendimento: str = "ambos"
    cidade_atendimento: Optional[str] = None
    estado_atendimento: Optional[str] = None

class ServicoCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    preco_min: Optional[float] = None
    preco_max: Optional[float] = None
    prazo_estimado_dias: Optional[int] = None
    modalidade: str = "ambos"

class PropostaCreate(BaseModel):
    conversa_id: int
    servico_id: Optional[int] = None
    descricao_escopo: str
    local_ou_modalidade: Optional[str] = None
    prazo_estimado: Optional[str] = None
    valor_proposto: float

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
            SELECT nome_artistico, biografia, anos_experiencia, modalidade_atendimento, cidade_atendimento, estado_atendimento
            FROM perfis_artista 
            WHERE usuario_id = %s
        """, (usuario_id,))
        artista = cursor.fetchone()

        is_artista = False
        nome_artistico = None
        biografia = None
        estatisticas = {
            "avaliacao_media": "0.0",
            "total_contratacoes": 0,
            "total_favoritos": 0
        }

        if artista:
            is_artista = True
            nome_artistico = artista["nome_artistico"]
            biografia = artista["biografia"]

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
    """Atualiza os dados pessoais, foto de perfil (Base64) e biografia na tabela `perfis` do usuário logado."""
    usuario_id = current_user["id"]
    conexao = None
    cursor = None
    try:
        conexao = get_db_connection()
        cursor = conexao.cursor(dictionary=True)

        cursor.execute("SELECT usuario_id FROM perfis WHERE usuario_id = %s", (usuario_id,))
        db_perfil = cursor.fetchone()

        tipo_doc = perfil.tipo_documento if perfil.tipo_documento in ['cpf', 'cnpj'] else 'cpf'
        cpf_val = perfil.cpf.strip() if perfil.cpf and perfil.cpf.strip() else None
        cnpj_val = perfil.cnpj.strip() if perfil.cnpj and perfil.cnpj.strip() else None

        if tipo_doc == 'cpf' and not cpf_val:
            cpf_val = "00000000000"
        if tipo_doc == 'cnpj' and not cnpj_val:
            cnpj_val = "00000000000000"

        if not db_perfil:
            query_insert = """
                INSERT INTO perfis (usuario_id, nome_completo, telefone, cidade, estado, tipo_documento, cpf, cnpj, foto_perfil_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(query_insert, (
                usuario_id, perfil.nome_completo, perfil.telefone, perfil.cidade,
                perfil.estado, tipo_doc, cpf_val if tipo_doc == 'cpf' else None, cnpj_val if tipo_doc == 'cnpj' else None, perfil.foto_perfil
            ))
        else:
            query_update = """
                UPDATE perfis 
                SET nome_completo = %s, telefone = %s, cidade = %s, estado = %s, tipo_documento = %s, cpf = %s, cnpj = %s, foto_perfil_url = COALESCE(%s, foto_perfil_url)
                WHERE usuario_id = %s
            """
            cursor.execute(query_update, (
                perfil.nome_completo, perfil.telefone, perfil.cidade,
                perfil.estado, tipo_doc, cpf_val if tipo_doc == 'cpf' else None, cnpj_val if tipo_doc == 'cnpj' else None, perfil.foto_perfil, usuario_id
            ))

        # Atualiza também a biografia caso o usuário seja artista
        if perfil.biografia is not None:
            cursor.execute("UPDATE perfis_artista SET biografia = %s WHERE usuario_id = %s", (perfil.biografia, usuario_id))

        conexao.commit()
        return {"status": "sucesso", "mensagem": "Perfil atualizado com sucesso"}
    except Exception as err:
        if conexao:
            conexao.rollback()
        print("--- ERRO EM /api/perfis/me (PUT) ---")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro detalhado no servidor: {str(err)}"
        )
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

        query = """
            INSERT INTO perfis_artista (usuario_id, nome_artistico, biografia, anos_experiencia, modalidade_atendimento, cidade_atendimento, estado_atendimento)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            usuario_id, dados_artista.nome_artistico, dados_artista.biografia,
            dados_artista.anos_experiencia, dados_artista.modalidade_atendimento,
            dados_artista.cidade_atendimento, dados_artista.estado_atendimento
        ))
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