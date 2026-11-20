"""Worker Sandbox: python conciliar_asaas.py --once, ou executar continuamente."""
import argparse
import json
import logging
import time
from main import get_db_connection
from pagamentos import asaas_portal as m
from pagamentos.operacoes import conciliar_cobranca, agendar_nota
log=logging.getLogger(__name__)

def rodada():
    db=get_db_connection()
    try:
        ids=m.fetchall(db,'SELECT evento_id FROM asaas_eventos WHERE processado_em IS NULL ORDER BY recebido_em LIMIT 100')
        for item in ids:
            try:
                row=m.fetchone(db,'SELECT * FROM asaas_eventos WHERE evento_id=%s FOR UPDATE',(item['evento_id'],))
                if row and row['processado_em'] is None:
                    p=row['payload_json'];p=json.loads(p) if isinstance(p,str) else p
                    if m.processar_evento(db,p):m.execute(db,'UPDATE asaas_eventos SET processado_em=NOW() WHERE evento_id=%s',(row['evento_id'],))
                db.commit()
            except Exception:db.rollback();log.warning('Evento pendente para nova conciliacao')
        for row in m.fetchall(db,"SELECT * FROM asaas_cobrancas WHERE status_externo IN ('CRIANDO','CONCILIAR','PENDING','CONFIRMED') ORDER BY id LIMIT 100"):
            try:conciliar_cobranca(db,row)
            except Exception:db.rollback();log.warning('Cobranca pendente para conciliacao')
        for row in m.fetchall(db,"""SELECT c.* FROM asaas_cobrancas c JOIN asaas_notas_fiscais n ON n.cobranca_id=c.id
            WHERE n.status IN ('CRIANDO','CONCILIAR') ORDER BY c.id LIMIT 100"""):
            try:agendar_nota(db,row)
            except Exception:db.rollback();log.warning('Nota pendente para conciliacao')
    finally:db.close()

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--once',action='store_true');args=p.parse_args()
    logging.basicConfig(level=logging.INFO)
    while True:
        try:rodada()
        except Exception:log.exception('Falha da rodada de conciliacao')
        if args.once:break
        time.sleep(15)
