"""Contratacao persistente, NFS-e vinculada e conciliacao Sandbox.
Credenciais e parametros fiscais sao exclusivamente do servidor.
"""
import json
import os
from datetime import date
from fastapi import HTTPException
from . import asaas_portal as m

def fiscal_config():
    try:
        config = json.loads(os.getenv('ASAAS_NF_CONFIG_JSON','{}'))
    except ValueError:
        raise HTTPException(503, 'ASAAS_NF_CONFIG_JSON invalido')
    if not isinstance(config,dict) or not (config.get('municipalServiceId') or config.get('municipalServiceCode')) or not config.get('municipalServiceName') or not isinstance(config.get('taxes'),dict):
        raise HTTPException(503, 'Configure servico municipal e impostos da NFS-e no servidor')
    base = os.getenv('ASAAS_NF_BASE','')
    if base not in ('comissao','valor_servico','valor_total'):
        raise HTTPException(503, 'Defina ASAAS_NF_BASE conforme o servico prestado pelo emissor da conta')
    # Campos fiscais documentados; valores financeiros nunca sao sobrescritos pelo env.
    return {k:config[k] for k in ('municipalServiceId','municipalServiceCode','municipalServiceName','taxes') if k in config}, base


def agendar_nota(db, row):
    if not row.get('asaas_payment_id'): raise HTTPException(409, 'Concilie a cobranca antes da nota')
    with m.trava(db, f"portal-nota-{row['id']}"):
        nota = m.fetchone(db, 'SELECT * FROM asaas_notas_fiscais WHERE cobranca_id=%s FOR UPDATE', (row['id'],))
        if nota and nota.get('asaas_invoice_id'): return m.serializar([nota])[0]
        reference = f"portal-nota-{row['id']}"
        if nota:
            data = m.asaas('GET','/invoices',query={'externalReference':reference,'payment':row['asaas_payment_id'],'limit':100}).get('data',[])
            if len(data)!=1:
                raise HTTPException(409,'Nota inconclusiva. A conciliacao consulta a referencia sem emitir outra nota.')
            remoto=data[0]
            if (not remoto.get('id') or remoto.get('externalReference') != reference
                    or remoto.get('payment') != row['asaas_payment_id']
                    or m.dinheiro(remoto.get('value')) != m.dinheiro(nota['valor'])):
                raise HTTPException(409, 'A nota encontrada diverge da solicitação registrada.')
        else:
            config, base = fiscal_config()
            payload = {**config,'payment':row['asaas_payment_id'], 'externalReference':reference,
                       'serviceDescription':f"Portal da Arte - contrato {row['contrato_id']} - {base}",
                       'observations':'Homologacao Sandbox', 'effectiveDate':str(date.today()),
                       'value':float(m.dinheiro(row[base])), 'deductions':0, 'updatePayment':False}
            nid = m.execute(db, '''INSERT INTO asaas_notas_fiscais(cobranca_id,referencia,status,valor,payload_json)
                VALUES(%s,%s,'CRIANDO',%s,%s)''', (row['id'],reference,payload['value'],json.dumps(payload)))
            db.commit() # persistir antes da rede; timeout nunca dispara outro POST
            nota={'id':nid}
            try:
                remoto=m.asaas('POST','/invoices',payload)
                if not remoto.get('id'): raise HTTPException(502,'Asaas nao retornou invoiceId')
            except Exception:
                m.execute(db,"UPDATE asaas_notas_fiscais SET status='CONCILIAR' WHERE id=%s",(nid,))
                db.commit(); raise
        m.execute(db,'''UPDATE asaas_notas_fiscais SET asaas_invoice_id=%s,status=%s,pdf_url=%s,xml_url=%s WHERE id=%s''',
                  (remoto['id'],remoto.get('status','SCHEDULED'),remoto.get('pdfUrl'),remoto.get('xmlUrl'),nota['id']))
        db.commit()
        return {'id':nota['id'],'asaas_invoice_id':remoto['id'],'status':remoto.get('status','SCHEDULED')}


def conciliar_cobranca(db,row):
    """Somente GET no provedor; jamais repetir POST de resultado incerto."""
    with m.trava(db,f"portal-pagador-{row['contratante_id']}"):
        row = m.fetchone(db, 'SELECT * FROM asaas_cobrancas WHERE id=%s FOR UPDATE', (row['id'],))
        if not row:
            raise HTTPException(404, 'Cobrança não encontrada.')
        if row.get('asaas_payment_id'):
            remoto=m.asaas('GET','/payments/'+row['asaas_payment_id'])
        else:
            data=m.asaas('GET','/payments',query={'externalReference':row['chave_idempotencia'],'limit':100}).get('data',[])
            if len(data)!=1: raise HTTPException(409,'Cobranca ainda nao localizada de forma unica. Nao recriada.')
            remoto=data[0]
            if not remoto.get('id') or remoto.get('externalReference') != row['chave_idempotencia']:
                raise HTTPException(409, 'Referência da cobrança divergente na conciliação.')
        if m.dinheiro(remoto.get('value'))!=m.dinheiro(row['valor_total']):
            raise HTTPException(409,'Valor remoto diverge do registro local')
        pid=row.get('pagamento_id')
        if not pid:
            pid=m.execute(db,"""INSERT INTO pagamentos(contrato_id,etapa_id,valor,metodo_pagamento,status,codigo_referencia)
                VALUES(%s,NULL,%s,'pix','pendente',%s)""",(row['contrato_id'],row['valor_total'],remoto['id']))
        m.execute(db,'UPDATE asaas_cobrancas SET asaas_payment_id=%s,pagamento_id=%s WHERE id=%s',(remoto['id'],pid,row['id']))
        status=remoto.get('status','PENDING')
        local={'RECEIVED':'pago','CONFIRMED':'processando','REFUNDED':'estornado'}.get(status)
        if local:
            m.execute(db,'UPDATE pagamentos SET status=%s,pago_em=CASE WHEN %s=\'pago\' THEN COALESCE(pago_em,NOW()) ELSE pago_em END WHERE id=%s',(local,local,pid))
        m.execute(db,'UPDATE asaas_cobrancas SET status_externo=%s WHERE id=%s',(status,row['id']))
        db.commit()
        return {'status':status,'pagamento_id':pid}


def registrar_operacoes(router, get_db, usuario, pix):
    @router.post('/pix-com-nota')
    def pagar(body:m.CriarPix,current_user=usuario):
        fiscal_config() # falha de configuracao fiscal nao cria cobranca
        r=pix(body,current_user)
        db=get_db()
        try:
            row=m.fetchone(db,'SELECT * FROM asaas_cobrancas WHERE id=%s AND contratante_id=%s',(r['cobranca']['id'],current_user['id']))
            try:r['nota_fiscal']=agendar_nota(db,row)
            except HTTPException as exc:
                # Cobranca existente preservada: erro fiscal nunca cria outro PIX.
                r['nota_fiscal']={'status':'PENDENTE','erro':exc.detail}
            return r
        finally:db.close()

    @router.post('/cobrancas/{cobranca_id}/conciliar')
    def conciliar(cobranca_id:int,current_user=usuario):
        db=get_db()
        try:
            row=m.fetchone(db,'SELECT * FROM asaas_cobrancas WHERE id=%s AND contratante_id=%s',(cobranca_id,current_user['id']))
            if not row:raise HTTPException(404,'Cobranca nao encontrada')
            return conciliar_cobranca(db,row)
        finally:db.close()

    @router.post('/cobrancas/{cobranca_id}/nota-fiscal')
    def nota(cobranca_id:int,current_user=usuario):
        db=get_db()
        try:
            row=m.fetchone(db,'SELECT * FROM asaas_cobrancas WHERE id=%s AND contratante_id=%s',(cobranca_id,current_user['id']))
            if not row:raise HTTPException(404,'Cobranca nao encontrada')
            return agendar_nota(db,row)
        finally:db.close()

    @router.get('/cobrancas/{cobranca_id}/nota-fiscal')
    def consultar_nota(cobranca_id:int,current_user=usuario):
        db=get_db()
        try:
            row=m.fetchone(db,'''SELECT n.* FROM asaas_notas_fiscais n JOIN asaas_cobrancas c ON c.id=n.cobranca_id
                WHERE c.id=%s AND (c.contratante_id=%s OR c.artista_id=%s)''',(cobranca_id,current_user['id'],current_user['id']))
            if not row:raise HTTPException(404,'Nota nao encontrada')
            return m.serializar([row])[0] | {'payload_json':None}
        finally:db.close()
