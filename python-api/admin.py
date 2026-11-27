"""Dashboard administrativo do Portal da Arte.

Todas as rotas exigem o papel `admin` em usuario_papeis. Dados pessoais sao
mascarados e o conteudo privado de mensagens NAO e exposto. Cada acao sensivel
e registrada em admin_acoes ( LGPD: sem IP em claro, apenas hash ).
"""
import hashlib
import json
import os
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional


def mascarar_documento(valor):
    """Nunca devolve CPF/CNPJ completo ao painel."""
    if not valor:
        return None
    digitos = "".join(c for c in str(valor) if c.isdigit())
    if not digitos:
        return None
    if len(digitos) <= 4:
        return "***"
    return "*" * (len(digitos) - 4) + digitos[-4:]


class StatusUsuarioRequest(BaseModel):
    status: str = Field(..., pattern="^(ativo|bloqueado|suspenso)$")


class StatusOcorrenciaRequest(BaseModel):
    status: str = Field(..., pattern="^(aberta|em_analise|resolvida|indeferida|arquivada)$")


class VisitaRequest(BaseModel):
    rota: str = Field("/", max_length=160)


def criar_router(get_db, usuario_atual):
    router = APIRouter(prefix="/api/admin", tags=["Admin"])

    def exigir_admin(current=Depends(usuario_atual)):
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute(
                """SELECT 1 FROM usuario_papeis up
                   INNER JOIN papeis p ON p.id = up.papel_id
                   WHERE up.usuario_id = %s AND p.nome = 'admin' LIMIT 1""",
                (current["id"],),
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
            return current
        finally:
            cursor.close()
            conexao.close()

    def registrar_acao(admin_id, acao, entidade=None, entidade_id=None, detalhes=None, request=None):
        ip_hash = None
        if request and request.client:
            segredo = os.getenv("SECRET_KEY", "")
            ip_hash = hashlib.sha256(f"{segredo}:{request.client.host}".encode("utf-8")).hexdigest()
        conexao = None
        cursor = None
        try:
            conexao = get_db()
            cursor = conexao.cursor()
            cursor.execute(
                """INSERT INTO admin_acoes (admin_id, acao, entidade, entidade_id, detalhes, endereco_ip_hash)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (
                    admin_id, acao[:80], entidade, entidade_id,
                    json.dumps(detalhes or {}, ensure_ascii=False)[:4000], ip_hash,
                ),
            )
            conexao.commit()
        except Exception:
            # Auditoria nunca pode impedir a acao administrativa legítima.
            pass
        finally:
            if cursor:
                cursor.close()
            if conexao:
                conexao.close()

    @router.get("/verificar")
    def verificar(current=Depends(exigir_admin)):
        return {"admin": True, "usuario_id": current["id"]}

    @router.get("/resumo")
    def resumo(current=Depends(exigir_admin)):
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute(
                """
                SELECT
                  (SELECT COUNT(*) FROM usuarios WHERE status <> 'excluido') AS usuarios,
                  (SELECT COUNT(*) FROM usuarios WHERE status <> 'excluido'
                     AND criado_em >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS novos_usuarios_30d,
                  (SELECT COUNT(*) FROM perfis_artista) AS artistas,
                  (SELECT COUNT(*) FROM contratos WHERE status = 'ativo') AS contratos_ativos,
                  (SELECT COUNT(*) FROM contratos) AS contratos_total,
                  (SELECT COUNT(*) FROM propostas WHERE status = 'em_negociacao') AS propostas_abertas,
                  (SELECT COUNT(*) FROM pagamentos WHERE status = 'pago') AS pagamentos_pagos,
                  (SELECT COALESCE(SUM(valor), 0) FROM pagamentos WHERE status = 'pago') AS receita_paga,
                  (SELECT COUNT(*) FROM pagamentos WHERE status = 'pago'
                     AND metodo_pagamento = 'pix') AS pix_recebidos,
                  (SELECT COUNT(*) FROM asaas_cobrancas WHERE status_split = 'PAGO') AS repasses_pagos,
                  (SELECT COUNT(*) FROM conversas) AS conversas,
                  (SELECT COUNT(*) FROM mensagens) AS mensagens,
                  (SELECT COUNT(*) FROM ocorrencias
                     WHERE status IN ('aberta', 'em_analise')) AS ocorrencias_abertas,
                  (SELECT COUNT(*) FROM moderacao_avisos WHERE resolvido_em IS NULL) AS avisos_pendentes,
                  (SELECT COUNT(DISTINCT sessao_hash) FROM visitantes) AS visitantes,
                  (SELECT COALESCE(SUM(total_visualizacoes), 0) FROM visitantes) AS visualizacoes
                """
            )
            return cursor.fetchone() or {}
        finally:
            cursor.close()
            conexao.close()

    @router.get("/usuarios")
    def listar_usuarios(busca: str = "", status: str = "", pagina: int = 1, por_pagina: int = 20,
                        current=Depends(exigir_admin)):
        por_pagina = min(max(por_pagina, 1), 100)
        pagina = max(pagina, 1)
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute(
                """SELECT u.id, u.email, u.status, u.criado_em, u.ultimo_login_em,
                          p.nome_completo, p.cidade, p.estado, p.tipo_documento, p.cpf, p.cnpj,
                          EXISTS(SELECT 1 FROM perfis_artista pa WHERE pa.usuario_id = u.id) AS is_artista,
                          EXISTS(SELECT 1 FROM usuario_papeis up
                                 INNER JOIN papeis pp ON pp.id = up.papel_id
                                 WHERE up.usuario_id = u.id AND pp.nome = 'admin') AS is_admin
                   FROM usuarios u LEFT JOIN perfis p ON p.usuario_id = u.id
                   WHERE (%s = '' OR u.email LIKE %s OR p.nome_completo LIKE %s)
                     AND (%s = '' OR u.status = %s)
                   ORDER BY u.id DESC LIMIT %s OFFSET %s""",
                (busca, f"%{busca}%", f"%{busca}%", status, status, por_pagina, (pagina - 1) * por_pagina),
            )
            linhas = cursor.fetchall() or []
            for linha in linhas:
                linha["documento"] = mascarar_documento(linha.get("cpf") or linha.get("cnpj"))
                linha.pop("cpf", None)
                linha.pop("cnpj", None)
            return {"usuarios": linhas, "pagina": pagina, "por_pagina": por_pagina}
        finally:
            cursor.close()
            conexao.close()

    @router.get("/artistas")
    def listar_artistas(busca: str = "", current=Depends(exigir_admin)):
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute(
                """SELECT pa.usuario_id AS id, pa.nome_artistico, pa.categoria_atuacao,
                          pa.nota_media, pa.total_contratacoes, pa.status_verificacao,
                          pa.aceitando_novas_solicitacoes, pa.cidade_atendimento, pa.estado_atendimento,
                          u.status, u.criado_em,
                          (SELECT COUNT(*) FROM servicos s WHERE s.artista_id = pa.usuario_id
                            AND s.ativo = TRUE) AS total_servicos
                   FROM perfis_artista pa INNER JOIN usuarios u ON u.id = pa.usuario_id
                   WHERE %s = '' OR pa.nome_artistico LIKE %s OR pa.categoria_atuacao LIKE %s
                   ORDER BY pa.usuario_id DESC LIMIT 200""",
                (busca, f"%{busca}%", f"%{busca}%"),
            )
            return {"artistas": cursor.fetchall() or []}
        finally:
            cursor.close()
            conexao.close()

    @router.get("/contratos")
    def listar_contratos(status: str = "", current=Depends(exigir_admin)):
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute(
                """SELECT c.id, c.valor_total, c.status, c.criado_em, c.data_conclusao,
                          pa.nome_artistico, contratante.email AS contratante_email,
                          p.nome_completo AS contratante_nome, pr.descricao_escopo
                   FROM contratos c
                   INNER JOIN perfis_artista pa ON pa.usuario_id = c.artista_id
                   INNER JOIN usuarios contratante ON contratante.id = c.contratante_id
                   LEFT JOIN perfis p ON p.usuario_id = c.contratante_id
                   LEFT JOIN propostas pr ON pr.id = c.proposta_id
                   WHERE %s = '' OR c.status = %s
                   ORDER BY c.id DESC LIMIT 200""",
                (status, status),
            )
            return {"contratos": cursor.fetchall() or []}
        finally:
            cursor.close()
            conexao.close()

    @router.get("/pagamentos")
    def listar_pagamentos(status: str = "", metodo: str = "", current=Depends(exigir_admin)):
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute(
                """SELECT pg.id, pg.valor, pg.metodo_pagamento, pg.status, pg.criado_em, pg.pago_em,
                          pg.contrato_id, u.email AS contratante_email, pa.nome_artistico
                   FROM pagamentos pg
                   INNER JOIN contratos c ON c.id = pg.contrato_id
                   INNER JOIN usuarios u ON u.id = c.contratante_id
                   INNER JOIN perfis_artista pa ON pa.usuario_id = c.artista_id
                   WHERE (%s = '' OR pg.status = %s) AND (%s = '' OR pg.metodo_pagamento = %s)
                   ORDER BY pg.id DESC LIMIT 200""",
                (status, status, metodo, metodo),
            )
            recebidos = cursor.fetchall() or []
            cursor.execute(
                """SELECT ac.id, ac.contrato_id, ac.valor_total, ac.valor_artista, ac.comissao,
                          ac.status_externo, ac.status_split, ac.criado_em, pa.nome_artistico
                   FROM asaas_cobrancas ac
                   INNER JOIN perfis_artista pa ON pa.usuario_id = ac.artista_id
                   ORDER BY ac.id DESC LIMIT 200"""
            )
            repasses = cursor.fetchall() or []
            return {"recebidos": recebidos, "repasses": repasses}
        finally:
            cursor.close()
            conexao.close()

    @router.get("/conversas")
    def listar_conversas(busca: str = "", current=Depends(exigir_admin)):
        """METADADOS apenas: conteudo privado nao e exibido no painel (LGPD)."""
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute(
                """SELECT c.id, c.criado_em, c.servico_id,
                          COALESCE(pa.nome_artistico, p.nome_completo, ua.email) AS artista_nome,
                          COALESCE(pc.nome_completo, uc.email) AS contratante_nome,
                          (SELECT COUNT(*) FROM mensagens m WHERE m.conversa_id = c.id) AS total_mensagens,
                          (SELECT MAX(m2.criado_em) FROM mensagens m2 WHERE m2.conversa_id = c.id) AS ultima_mensagem_em
                   FROM conversas c
                   INNER JOIN usuarios ua ON ua.id = c.artista_id
                   INNER JOIN usuarios uc ON uc.id = c.contratante_id
                   LEFT JOIN perfis_artista pa ON pa.usuario_id = c.artista_id
                   LEFT JOIN perfis p ON p.usuario_id = c.artista_id
                   LEFT JOIN perfis pc ON pc.usuario_id = c.contratante_id
                   WHERE %s = '' OR pa.nome_artistico LIKE %s OR pc.nome_completo LIKE %s
                   ORDER BY c.id DESC LIMIT 200""",
                (busca, f"%{busca}%", f"%{busca}%"),
            )
            return {"conversas": cursor.fetchall() or [], "aviso": "Conteudo das mensagens nao e exibido por privacidade."}
        finally:
            cursor.close()
            conexao.close()

    @router.get("/moderacao")
    def listar_moderacao(resolvido: Optional[int] = None, current=Depends(exigir_admin)):
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            sql = """SELECT ma.id, ma.usuario_id, u.email, ma.contexto, ma.texto_resumo,
                            ma.categorias_json, ma.aviso, ma.criado_em, ma.resolvido_em
                     FROM moderacao_avisos ma INNER JOIN usuarios u ON u.id = ma.usuario_id"""
            parametros = ()
            if resolvido is not None:
                sql += " WHERE (ma.resolvido_em IS NOT NULL) = %s"
                parametros = (int(resolvido),)
            sql += " ORDER BY ma.id DESC LIMIT 200"
            cursor.execute(sql, parametros)
            return {"avisos": cursor.fetchall() or []}
        finally:
            cursor.close()
            conexao.close()

    @router.post("/moderacao/{aviso_id}/resolver")
    def resolver_moderacao(aviso_id: int, request: Request, current=Depends(exigir_admin)):
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute(
                "UPDATE moderacao_avisos SET resolvido_em = NOW() WHERE id = %s AND resolvido_em IS NULL",
                (aviso_id,),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Aviso nao encontrado ou ja resolvido.")
            conexao.commit()
        finally:
            cursor.close()
            conexao.close()
        registrar_acao(current["id"], "resolver_moderacao", "moderacao_avisos", aviso_id, request=request)
        return {"status": "sucesso"}

    @router.get("/ocorrencias")
    def listar_ocorrencias(status: str = "", current=Depends(exigir_admin)):
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute(
                """SELECT o.id, o.tipo, o.assunto, o.descricao, o.status, o.criado_em,
                          u.email AS aberto_por_email
                   FROM ocorrencias o INNER JOIN usuarios u ON u.id = o.aberto_por_id
                   WHERE %s = '' OR o.status = %s ORDER BY o.id DESC LIMIT 200""",
                (status, status),
            )
            return {"ocorrencias": cursor.fetchall() or []}
        finally:
            cursor.close()
            conexao.close()

    @router.patch("/ocorrencias/{ocorrencia_id}/status")
    def atualizar_ocorrencia(ocorrencia_id: int, dados: StatusOcorrenciaRequest,
                             request: Request, current=Depends(exigir_admin)):
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute("UPDATE ocorrencias SET status = %s WHERE id = %s", (dados.status, ocorrencia_id))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Ocorrencia nao encontrada.")
            conexao.commit()
        finally:
            cursor.close()
            conexao.close()
        registrar_acao(current["id"], "alterar_status_ocorrencia", "ocorrencias", ocorrencia_id,
                       {"status": dados.status}, request)
        return {"status": "sucesso"}

    @router.post("/usuarios/{usuario_id}/status")
    def alterar_status_usuario(usuario_id: int, dados: StatusUsuarioRequest,
                               request: Request, current=Depends(exigir_admin)):
        if usuario_id == current["id"]:
            raise HTTPException(status_code=400, detail="Voce nao pode alterar seu proprio status.")
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute("UPDATE usuarios SET status = %s WHERE id = %s", (dados.status, usuario_id))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Usuario nao encontrado.")
            conexao.commit()
        finally:
            cursor.close()
            conexao.close()
        registrar_acao(current["id"], "alterar_status_usuario", "usuarios", usuario_id,
                       {"status": dados.status}, request)
        return {"status": "sucesso"}

    @router.get("/auditoria")
    def listar_auditoria(limite: int = 100, current=Depends(exigir_admin)):
        limite = min(max(limite, 1), 300)
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute(
                """SELECT a.id, a.acao, a.entidade, a.entidade_id, a.detalhes, a.criado_em, u.email
                   FROM admin_acoes a INNER JOIN usuarios u ON u.id = a.admin_id
                   ORDER BY a.id DESC LIMIT %s""", (limite,),
            )
            return {"acoes": cursor.fetchall() or []}
        finally:
            cursor.close()
            conexao.close()

    @router.get("/metricas")
    def listar_metricas(dias: int = 30, current=Depends(exigir_admin)):
        dias = min(max(dias, 1), 90)
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute(
                """SELECT data, total_usuarios, total_artistas, total_contratacoes,
                          total_pagamentos, total_cancelamentos
                   FROM metricas_plataforma_diarias
                   WHERE data >= DATE_SUB(CURDATE(), INTERVAL %s DAY) ORDER BY data DESC""",
                (dias,),
            )
            plataforma = cursor.fetchall() or []
            cursor.execute(
                """SELECT DATE(criado_em) AS data, COUNT(*) AS visitas,
                          COUNT(DISTINCT sessao_hash) AS visitantes_unicos
                   FROM visitas_site
                   WHERE criado_em >= DATE_SUB(NOW(), INTERVAL %s DAY)
                   GROUP BY DATE(criado_em) ORDER BY data DESC""",
                (dias,),
            )
            visitas = cursor.fetchall() or []
            return {"plataforma": plataforma, "visitas": visitas}
        finally:
            cursor.close()
            conexao.close()

    @router.get("/visitantes/rotas")
    def rotas_mais_visitadas(dias: int = 30, current=Depends(exigir_admin)):
        dias = min(max(dias, 1), 90)
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute(
                """SELECT rota, COUNT(*) AS visualizacoes,
                          COUNT(DISTINCT sessao_hash) AS visitantes_unicos
                   FROM visitas_site
                   WHERE criado_em >= DATE_SUB(NOW(), INTERVAL %s DAY)
                   GROUP BY rota ORDER BY visualizacoes DESC LIMIT 20""",
                (dias,),
            )
            return {"rotas": cursor.fetchall() or []}
        finally:
            cursor.close()
            conexao.close()

    @router.get("/visitantes")
    def listar_visitantes(limite: int = 50, uf: str = "", dias: int = 0, current=Depends(exigir_admin)):
        limite = min(max(limite, 1), 200)
        conexao = get_db()
        cursor = conexao.cursor(dictionary=True)
        try:
            sql = """SELECT sessao_hash, primeira_visita, ultima_visita, total_visualizacoes, uf
                     FROM visitantes WHERE 1 = 1"""
            parametros = []
            if uf:
                sql += " AND uf = %s"
                parametros.append(uf[:2].upper())
            if dias > 0:
                sql += " AND ultima_visita >= DATE_SUB(NOW(), INTERVAL %s DAY)"
                parametros.append(min(dias, 90))
            sql += " ORDER BY ultima_visita DESC LIMIT %s"
            parametros.append(limite)
            cursor.execute(sql, tuple(parametros))
            return {"visitantes": cursor.fetchall() or []}
        finally:
            cursor.close()
            conexao.close()

    return router


def criar_router_visitas(get_db):
    """Registro anonimo de visitas: sem IP em claro e sem identificacao pessoal."""
    router = APIRouter(prefix="/api/visitas", tags=["Visitantes"])

    @router.post("")
    def registrar_visita(dados: VisitaRequest, request: Request):
        base = ""
        if request.client:
            base = request.client.host
        agente = request.headers.get("user-agent", "")
        segredo = os.getenv("SECRET_KEY", "")
        sessao = hashlib.sha256(f"{segredo}:{base}:{agente}:{date.today().isoformat()}".encode("utf-8")).hexdigest()
        rota = dados.rota[:160]
        conexao = get_db()
        cursor = conexao.cursor()
        try:
            cursor.execute(
                "INSERT INTO visitas_site (sessao_hash, rota) VALUES (%s, %s)", (sessao, rota)
            )
            cursor.execute(
                """INSERT INTO visitantes (sessao_hash, primeira_visita, ultima_visita, total_visualizacoes)
                   VALUES (%s, NOW(), NOW(), 1)
                   ON DUPLICATE KEY UPDATE
                     ultima_visita = NOW(), total_visualizacoes = total_visualizacoes + 1""",
                (sessao,),
            )
            conexao.commit()
        finally:
            cursor.close()
            conexao.close()
        return {"status": "sucesso"}

    return router
