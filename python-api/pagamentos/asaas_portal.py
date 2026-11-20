"""Cobranças PIX com split e webhook do Asaas Sandbox."""
from __future__ import annotations

import hmac
import json
import logging
import os
import re
from contextlib import contextmanager
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, Header, HTTPException, Body
from fastapi.routing import APIRoute
from mysql.connector import Error as MySQLError
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
CENTAVO = Decimal('0.01')
BASE_URL = 'https://api-sandbox.asaas.com/v3'


class RotaFinanceira(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()

        async def handler(request):
            try:
                return await original(request)
            except MySQLError as exc:
                logger.error('Falha de banco no fluxo financeiro (codigo %s)', exc.errno)
                if exc.errno in (1146, 1054):
                    raise HTTPException(503, 'Confira o esquema do Portal e aplique BancoDeDados/pagamentos_sandbox.sql no banco configurado.')
                raise HTTPException(503, 'Nao foi possivel acessar o banco da contratacao. Verifique a configuracao da API.')

        return handler


def dinheiro(valor):
    try:
        x = Decimal(str(valor))
        if not x.is_finite():
            raise ValueError('Valor nao finito')
        return x.quantize(CENTAVO, rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(400, 'Valor monetario invalido')


def cotacao(valor_servico):
    servico = dinheiro(valor_servico)
    estimativa = os.getenv('ASAAS_PIX_FEE_ESTIMATED', '').strip()
    if not estimativa:
        raise HTTPException(503, 'Configure ASAAS_PIX_FEE_ESTIMATED com a tarifa do seu Sandbox.')
    taxa = dinheiro(estimativa)
    if servico <= 0 or taxa < 0:
        raise HTTPException(400, 'Valores de servico ou taxa invalidos')
    comissao = dinheiro((servico + taxa) * Decimal('0.10'))
    return {
        'valor_servico': float(servico), 'taxa_prevista': float(taxa),
        'comissao': float(comissao), 'valor_total': float(servico + taxa + comissao),
        'valor_artista': float(servico), 'percentual_comissao': 10,
        'observacao': 'Tarifa estimada: o saldo real depende da tarifa efetivamente aplicada pelo ASAAS.'
    }


def asaas(metodo, rota, payload=None, query=None):
    chave = os.getenv('ASAAS_API_KEY', '').strip()
    if not chave:
        raise HTTPException(503, 'Configure ASAAS_API_KEY no python-api/.env')
    url = BASE_URL + rota
    if query:
        url += '?' + urlencode(query)
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    req = Request(url, data=data, method=metodo,
                  headers={'access_token': chave, 'Content-Type': 'application/json',
                           'User-Agent': 'PortalDaArte-Sandbox/1.0'})
    try:
        with urlopen(req, timeout=25) as resposta:
            return json.loads(resposta.read().decode('utf-8'))
    except HTTPError as exc:
        logger.warning('Falha ASAAS: HTTP %s, rota %s', exc.code, rota)
        # Nao expor respostas externas, documentos e dados financeiros.
        if 400 <= exc.code < 500:
            raise HTTPException(422, 'ASAAS rejeitou os dados. Verifique o cadastro e a carteira Sandbox.')
        raise HTTPException(502, 'Falha temporaria do ASAAS Sandbox')
    except (URLError, TimeoutError, OSError):
        raise HTTPException(503, 'Falha de conexao com ASAAS. Requer conciliacao antes de tentar novamente.')


def fetchone(conexao, query, params=()):
    cursor = conexao.cursor(dictionary=True)
    try:
        cursor.execute(query, params)
        return cursor.fetchone()
    finally:
        cursor.close()


def fetchall(conexao, query, params=()):
    cursor = conexao.cursor(dictionary=True)
    try:
        cursor.execute(query, params)
        return cursor.fetchall()
    finally:
        cursor.close()


def execute(conexao, query, params=()):
    cursor = conexao.cursor()
    try:
        cursor.execute(query, params)
        return cursor.lastrowid
    finally:
        cursor.close()


def serializar(rows):
    def s(v):
        if isinstance(v, Decimal): return float(v)
        if hasattr(v, 'isoformat'): return v.isoformat()
        return v
    return [{k: s(v) for k, v in r.items()} for r in rows]


@contextmanager
def trava(db, nome):
    cursor = db.cursor()
    adquirida = False
    try:
        cursor.execute('SELECT GET_LOCK(%s, 0)', (nome,))
        if cursor.fetchone()[0] != 1:
            raise HTTPException(409, 'Operacao em andamento. Atualize em instantes.')
        adquirida = True
        yield
    finally:
        try:
            if adquirida:
                cursor.execute('SELECT RELEASE_LOCK(%s)', (nome,))
                # SELECT tambem retorna linhas na liberacao: consumir antes de
                # fechar o cursor, senao o connector gera "Unread result found"
                # depois do commit e uma operacao salva termina em erro HTTP.
                cursor.fetchone()
        finally:
            cursor.close()


def valores_salvos(row):
    return {k: float(row[k]) for k in
            ('valor_servico','taxa_prevista','comissao','valor_total','valor_artista')}


class CriarPix(BaseModel):
    contrato_id: int = Field(gt=0)
    total_previsto: Decimal | None = Field(default=None, gt=0, decimal_places=2)



def processar_evento(db, payload):
    evento, payment = payload.get('event'), payload.get('payment') or {}
    payment_id = payment.get('id') if isinstance(payment, dict) else None
    if str(evento).startswith('INVOICE_'):
        invoice = payload.get('invoice') or {}
        row = fetchone(db, 'SELECT id FROM asaas_notas_fiscais WHERE asaas_invoice_id=%s', (invoice.get('id'),))
        if not row: return False
        # Consultar estado atual evita regressao por eventos fora de ordem.
        remoto = asaas('GET', '/invoices/' + invoice['id'])
        execute(db, 'UPDATE asaas_notas_fiscais SET status=%s,pdf_url=%s,xml_url=%s WHERE id=%s',
                (remoto.get('status','SCHEDULED'), remoto.get('pdfUrl'), remoto.get('xmlUrl'), row['id']))
        return True
    row = fetchone(db, 'SELECT id,pagamento_id,status_externo,valor_total FROM asaas_cobrancas WHERE asaas_payment_id=%s FOR UPDATE',
                   (payment_id,)) if payment_id else None
    if row:
        estornado = row['status_externo'] in ('PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED', 'REFUNDED')
        if evento in ('PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED') and not estornado:
            valor = payment.get('value')
            if valor is None:
                remoto = asaas('GET', '/payments/' + payment_id)
                if remoto.get('status') not in ('CONFIRMED', 'RECEIVED'):
                    return False
                evento = 'PAYMENT_' + remoto['status']
                valor = remoto.get('value')
            if valor is None or dinheiro(valor) != dinheiro(row['valor_total']):
                logger.warning('Valor divergente na notificação da cobrança local %s', row['id'])
                return False
        if evento == 'PAYMENT_RECEIVED' and row['status_externo'] not in ('PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED', 'REFUNDED'):
            execute(db, "UPDATE asaas_cobrancas SET status_externo='RECEIVED' WHERE id=%s", (row['id'],))
            execute(db, "UPDATE pagamentos SET status='pago',pago_em=COALESCE(pago_em,NOW()) WHERE id=%s AND status NOT IN ('estornado')", (row['pagamento_id'],))
        elif evento == 'PAYMENT_CONFIRMED' and row['status_externo'] not in ('RECEIVED','REFUNDED','PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED'):
            execute(db, "UPDATE asaas_cobrancas SET status_externo='CONFIRMED' WHERE id=%s", (row['id'],))
            execute(db, "UPDATE pagamentos SET status='processando' WHERE id=%s AND status='pendente'", (row['pagamento_id'],))
        elif evento in ('PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED'):
            execute(db, 'UPDATE asaas_cobrancas SET status_externo=%s WHERE id=%s', (evento,row['id']))
            if evento == 'PAYMENT_REFUNDED':
                execute(db, "UPDATE pagamentos SET status='estornado' WHERE id=%s", (row['pagamento_id'],))
        elif evento in ('PAYMENT_OVERDUE','PAYMENT_DELETED','PAYMENT_RESTORED','PAYMENT_REFUND_IN_PROGRESS'):
            if row['status_externo'] not in ('RECEIVED','REFUNDED','PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED'):
                execute(db, 'UPDATE asaas_cobrancas SET status_externo=%s WHERE id=%s', (evento, row['id']))
        elif evento in ('PAYMENT_SPLIT_DIVERGENCE_BLOCK','PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED'):
            execute(db, 'UPDATE asaas_cobrancas SET status_split=%s WHERE id=%s', (evento, row['id']))
        elif evento == 'PAYMENT_SPLIT_DONE':
            execute(db, "UPDATE asaas_cobrancas SET status_split='LIQUIDADO' WHERE id=%s", (row['id'],))
        elif evento == 'PAYMENT_SPLIT_CANCELLED':
            execute(db, "UPDATE asaas_cobrancas SET status_split='CANCELADO' WHERE id=%s", (row['id'],))
    if not row: return False
    return True


def criar_router(get_db_connection, get_usuario_atual):
    router = APIRouter(prefix='/api/financeiro', tags=['Contratos e ASAAS Sandbox'], route_class=RotaFinanceira)
    usuario = Depends(get_usuario_atual)

    def buscar_contrato(db, contrato_id, usuario_id):
        item = fetchone(db, '''SELECT c.id, c.proposta_id, c.modelo_id, c.contratante_id,
            c.artista_id, c.valor_total, c.status, c.aceito_contratante_em,
            c.aceito_artista_em, pa.nome_artistico
            FROM contratos c JOIN perfis_artista pa ON pa.usuario_id=c.artista_id
            WHERE c.id=%s AND (c.contratante_id=%s OR c.artista_id=%s)''',
            (contrato_id, usuario_id, usuario_id))
        if not item: raise HTTPException(404, 'Contrato nao encontrado para seu usuario')
        return item

    @router.get('/config')
    def configuracao(current_user=usuario):
        from .operacoes import fiscal_config
        try:
            fiscal_config()
            nota_configurada = True
        except HTTPException:
            nota_configurada = False
        taxa = os.getenv('ASAAS_PIX_FEE_ESTIMATED', '').strip()
        return {'ambiente': 'sandbox', 'chave_asaas_configurada': bool(os.getenv('ASAAS_API_KEY')),
                'webhook_configurado': bool(os.getenv('ASAAS_WEBHOOK_TOKEN')),
                'taxa_pix_estimada': float(dinheiro(taxa)) if taxa else None,
                'comissao_percentual': 10, 'nota_fiscal_configurada': nota_configurada}

    @router.get('/contratos')
    def contratos(current_user=usuario):
        db = get_db_connection()
        try:
            rows = fetchall(db, '''SELECT c.id,c.proposta_id,c.contratante_id,c.artista_id,
                c.valor_total,c.status,c.aceito_contratante_em,c.aceito_artista_em,
                pa.nome_artistico, m.nome AS modelo_nome
                FROM contratos c JOIN perfis_artista pa ON pa.usuario_id=c.artista_id
                JOIN modelos_contrato m ON m.id=c.modelo_id
                WHERE c.contratante_id=%s OR c.artista_id=%s ORDER BY c.id DESC LIMIT 100''',
                (current_user['id'], current_user['id']))
            return {'contratos': serializar(rows), 'usuario_id': current_user['id']}
        finally: db.close()

    @router.get('/contratos/{contrato_id}/previa')
    def previa(contrato_id: int, current_user=usuario):
        db = get_db_connection()
        try:
            contrato = buscar_contrato(db, contrato_id, current_user['id'])
            carteira = fetchone(db, '''SELECT wallet_id,verificada_em FROM asaas_carteiras_artistas
                WHERE artista_id=%s''', (contrato['artista_id'],))
            customer = fetchone(db, 'SELECT asaas_customer_id FROM asaas_clientes WHERE usuario_id=%s',
                               (contrato['contratante_id'],))
            cobranca = fetchone(db, 'SELECT * FROM asaas_cobrancas WHERE contrato_id=%s ORDER BY id DESC LIMIT 1', (contrato_id,))
            return {'contrato_id': contrato_id, 'status_contrato': contrato['status'],
                'sou_contratante': current_user['id'] == contrato['contratante_id'],
                'ambos_aceitaram': bool(contrato['aceito_contratante_em'] and contrato['aceito_artista_em']),
                'valores': valores_salvos(cobranca) if cobranca else cotacao(contrato['valor_total']),
                'cobranca': ({k: cobranca[k] for k in ('id', 'asaas_payment_id', 'status_externo', 'status_split')}
                             if cobranca else None),
                'carteira_vinculada': bool(carteira and carteira.get('verificada_em')),
                'cliente_vinculado': bool(customer)}
        finally: db.close()

    @router.get('/carteira/me')
    def minha_carteira(current_user=usuario):
        db = get_db_connection()
        try:
            row = fetchone(db, '''SELECT wallet_id, verificada_em FROM asaas_carteiras_artistas
                WHERE artista_id=%s''', (current_user['id'],))
            return {'vinculada': bool(row), 'verificada': bool(row and row['verificada_em']),
                    'wallet_id_final': row['wallet_id'][-5:] if row else None}
        finally: db.close()

    @router.get('/cobrancas')
    def cobrancas(current_user=usuario):
        db = get_db_connection()
        try:
            return {'cobrancas': serializar(fetchall(db, '''SELECT id, contrato_id,
                asaas_payment_id,valor_total,valor_artista,comissao,status_externo,status_split,
                criado_em FROM asaas_cobrancas WHERE contratante_id=%s OR artista_id=%s
                ORDER BY id DESC LIMIT 80''', (current_user['id'], current_user['id'])))}
        finally: db.close()

    @router.post('/pix')
    def pix(body: CriarPix, current_user=usuario):
        db = get_db_connection()
        try:
            with trava(db, f"portal-pagador-{current_user['id']}"):
                item = buscar_contrato(db, body.contrato_id, current_user['id'])
                if item['contratante_id'] != current_user['id']:
                    raise HTTPException(403, 'Somente o contratante pode efetuar pagamento')
                if item['status'] != 'ativo' or not item['aceito_contratante_em'] or not item['aceito_artista_em']:
                    raise HTTPException(409, 'Contrato precisa estar ativo e aceito pelas duas partes')
                if not os.getenv('ASAAS_API_KEY', '').strip():
                    raise HTTPException(503, 'Configure ASAAS_API_KEY antes de criar cobrancas')
                chave = f'portal-contrato-{item["id"]}-pix-1'
                # A reserva unica local evita criacao duplicada em cliques simultaneos.
                existente = fetchone(db, '''SELECT *
                    FROM asaas_cobrancas WHERE chave_idempotencia=%s''', (chave,))
                if existente:
                    if existente['asaas_payment_id']:
                        return {'cobranca': existente, 'valores': valores_salvos(existente), 'existente': True}
                    raise HTTPException(409, 'Criacao pendente ou inconclusiva. Conciliar manualmente no ASAAS antes de repetir.')
                valores = cotacao(item['valor_total'])
                if body.total_previsto is not None and dinheiro(valores['valor_total']) != body.total_previsto:
                    raise HTTPException(409, 'O total mudou. Consulte os valores novamente antes de confirmar.')
                wallet = fetchone(db, '''SELECT wallet_id FROM asaas_carteiras_artistas
                    WHERE artista_id=%s AND verificada_em IS NOT NULL''', (item['artista_id'],))
                if not wallet: raise HTTPException(409, 'Artista sem walletId ASAAS Sandbox verificado')
                customer = fetchone(db, 'SELECT asaas_customer_id FROM asaas_clientes WHERE usuario_id=%s',
                                    (current_user['id'],))
                if not customer:
                    dados = fetchone(db, '''SELECT p.nome_completo,p.cpf,p.cnpj,u.email
                        FROM perfis p JOIN usuarios u ON u.id=p.usuario_id WHERE p.usuario_id=%s''',
                        (current_user['id'],))
                    if not dados or not (dados['cpf'] or dados['cnpj']):
                        raise HTTPException(409, 'Perfil do contratante sem CPF ou CNPJ para cadastro ASAAS')
                    intent = fetchone(db, 'SELECT usuario_id FROM asaas_clientes_pendentes WHERE usuario_id=%s', (current_user['id'],))
                    reference = f'portal-usuario-{current_user["id"]}'
                    remotos = asaas('GET', '/customers', query={'externalReference': reference, 'limit': 100}).get('data', [])
                    if len(remotos) > 1:
                        raise HTTPException(409, 'Mais de um cliente remoto encontrado; revisar cadastro')
                    if intent and not remotos:
                        raise HTTPException(409, 'Cadastro anterior inconclusivo; aguarde conciliacao sem repetir POST')
                    if not intent:
                        execute(db, 'INSERT INTO asaas_clientes_pendentes(usuario_id) VALUES(%s)', (current_user['id'],))
                        db.commit()
                    # Intencao persistida antes do POST; em timeout so consultar.

                    criado = remotos[0] if remotos else asaas('POST', '/customers', {
                        'name': dados['nome_completo'], 'cpfCnpj': dados['cpf'] or dados['cnpj'],
                        'email': dados['email'], 'externalReference': f'portal-usuario-{current_user["id"]}',
                        'notificationDisabled': True
                    })
                    customer_id = criado.get('id')
                    if not customer_id: raise HTTPException(502, 'ASAAS nao retornou customerId')
                    execute(db, 'INSERT INTO asaas_clientes(usuario_id,asaas_customer_id) VALUES(%s,%s)',
                            (current_user['id'], customer_id))
                    execute(db, 'DELETE FROM asaas_clientes_pendentes WHERE usuario_id=%s', (current_user['id'],))
                    db.commit()
                    customer = {'asaas_customer_id': customer_id}
                # Verifica valor de split com base na tarifa prevista (nao na tarifa efetiva).
                if dinheiro(valores['valor_total']) - dinheiro(valores['taxa_prevista']) < dinheiro(valores['valor_artista']):
                    raise HTTPException(409, 'Valor liquido estimado insuficiente para split')
                cobranca_id = execute(db, '''INSERT INTO asaas_cobrancas
                    (contrato_id,contratante_id,artista_id,chave_idempotencia,valor_servico,
                    taxa_prevista,comissao,valor_total,valor_artista)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
                    (item['id'], item['contratante_id'], item['artista_id'], chave,
                     valores['valor_servico'], valores['taxa_prevista'], valores['comissao'],
                     valores['valor_total'], valores['valor_artista']))
                db.commit()  # reserva a chave ANTES da chamada de rede
                payload = {'customer': customer['asaas_customer_id'], 'billingType': 'PIX',
                    'value': valores['valor_total'], 'dueDate': str(date.today() + timedelta(days=3)),
                    'description': f'Portal da Arte - Contrato {item["id"]}',
                    'externalReference': chave,
                    'split': [{'walletId': wallet['wallet_id'], 'fixedValue': valores['valor_artista']}]}
                try:
                    remoto = asaas('POST', '/payments', payload)
                    pay_id = remoto.get('id')
                    if not pay_id: raise HTTPException(502, 'ASAAS nao retornou paymentId')
                    pagamento_id = execute(db, '''INSERT INTO pagamentos
                        (contrato_id,etapa_id,valor,metodo_pagamento,status,codigo_referencia)
                        VALUES (%s,NULL,%s,'pix','pendente',%s)''',
                        (item['id'], valores['valor_total'], pay_id))
                    execute(db, '''UPDATE asaas_cobrancas SET asaas_payment_id=%s,
                        status_externo=%s,pagamento_id=%s WHERE id=%s''',
                        (pay_id, remoto.get('status','PENDING'), pagamento_id, cobranca_id))
                    db.commit()
                    return {'cobranca': {'id': cobranca_id, 'asaas_payment_id': pay_id,
                        'status_externo': remoto.get('status','PENDING')},
                        'valores': valores, 'existente': False}
                except HTTPException as exc:
                    db.rollback()
                    # 422: validacao recusada, 503: resposta inconclusiva. Nunca retry automatico.
                    execute(db, '''UPDATE asaas_cobrancas SET status_externo=%s,motivo_falha=%s WHERE id=%s''',
                            ('CONCILIAR' if exc.status_code in (502,503) else 'REJEITADO',
                             'Verifique o dashboard ASAAS antes de nova tentativa', cobranca_id))
                    db.commit()
                    raise
        finally: db.close()

    @router.get('/cobrancas/{cobranca_id}')
    def consultar(cobranca_id: int, current_user=usuario):
        db = get_db_connection()
        try:
            row = fetchone(db, '''SELECT id,asaas_payment_id,status_externo,status_split
                FROM asaas_cobrancas WHERE id=%s AND (contratante_id=%s OR artista_id=%s)''',
                (cobranca_id,current_user['id'],current_user['id']))
            if not row: raise HTTPException(404, 'Cobranca nao encontrada')
            if not row['asaas_payment_id']:
                return {'cobranca_id': row['id'], 'status_local': row['status_externo'],
                        'status_split': row['status_split']}
            remoto = asaas('GET', '/payments/' + row['asaas_payment_id'])
            return {'cobranca_id': row['id'], 'status_local': row['status_externo'],
                    'status_asaas': remoto.get('status'), 'status_split': row['status_split']}
        finally: db.close()

    @router.get('/cobrancas/{cobranca_id}/pix')
    def qrcode(cobranca_id: int, current_user=usuario):
        db = get_db_connection()
        try:
            row = fetchone(db, '''SELECT asaas_payment_id FROM asaas_cobrancas
                WHERE id=%s AND contratante_id=%s''', (cobranca_id,current_user['id']))
            if not row or not row['asaas_payment_id']:
                raise HTTPException(404, 'PIX nao encontrado para contratante')
            qr = asaas('GET', '/payments/' + row['asaas_payment_id'] + '/pixQrCode')
            return {'encodedImage': qr.get('encodedImage'), 'payload': qr.get('payload'),
                    'expirationDate': qr.get('expirationDate')}
        finally: db.close()

    @router.post('/webhook/asaas', include_in_schema=True)
    def webhook_asaas(payload: object = Body(...), asaas_access_token: str | None = Header(default=None)):
        segredo = os.getenv('ASAAS_WEBHOOK_TOKEN', '').strip()
        if not segredo or not asaas_access_token or not hmac.compare_digest(segredo, asaas_access_token):
            raise HTTPException(401, 'Webhook nao autorizado')
        if not isinstance(payload, dict):
            raise HTTPException(400, 'Evento invalido')
        evento_id, evento = payload.get('id'), payload.get('event')
        payment = payload.get('payment') or {}
        if not isinstance(evento_id,str) or not isinstance(evento,str) or len(evento_id)>140:
            raise HTTPException(400, 'Evento invalido')
        payment_id = payment.get('id') if isinstance(payment,dict) else None
        db = get_db_connection()
        try:
            existente = fetchone(db, 'SELECT evento_id,processado_em FROM asaas_eventos WHERE evento_id=%s FOR UPDATE', (evento_id,))
            if existente and existente.get('processado_em'):
                db.commit()
                return {'recebido': True, 'duplicado': True}
            execute(db, """INSERT IGNORE INTO asaas_eventos (evento_id,tipo,asaas_payment_id,payload_json)
                VALUES(%s,%s,%s,%s)""",
                (evento_id,evento,payment_id,json.dumps(payload,ensure_ascii=False)))
            aplicado = processar_evento(db, payload)
            if aplicado:
                execute(db, 'UPDATE asaas_eventos SET processado_em=NOW() WHERE evento_id=%s', (evento_id,))
            db.commit()
            return {'recebido': True, 'duplicado': False}
        except Exception:
            db.rollback()
            logger.exception('Erro ao registrar webhook ASAAS')
            raise HTTPException(500, 'Erro ao registrar evento; ASAAS deve reenviar')
        finally: db.close()

    from .operacoes import registrar_operacoes
    registrar_operacoes(router, get_db_connection, usuario, pix)
    return router
