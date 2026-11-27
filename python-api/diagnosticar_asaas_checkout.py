"""Diagnostico do Checkout/Webhook Asaas sem exibir API Key ou authToken."""
from pathlib import Path
import os
import sys
import httpx
from dotenv import load_dotenv

ENV_FILE = Path(__file__).with_name('.env')
load_dotenv(ENV_FILE, encoding='utf-8-sig', override=False)

env = os.getenv('ASAAS_ENV', 'sandbox').strip().lower()
api_key = os.getenv('ASAAS_API_KEY', '').strip()
webhook_url = os.getenv('ASAAS_WEBHOOK_PUBLIC_URL', '').strip()
webhook_token = os.getenv('ASAAS_WEBHOOK_TOKEN', '').strip()
email = os.getenv('ASAAS_WEBHOOK_EMAIL', '').strip() or os.getenv('SMTP_USERNAME', '').strip()
user_agent = os.getenv('ASAAS_USER_AGENT', 'PortalDaArte/1.0').strip() or 'PortalDaArte/1.0'
base = 'https://api-sandbox.asaas.com/v3' if env == 'sandbox' else 'https://api.asaas.com/v3'
headers = {'accept':'application/json','access_token':api_key,'User-Agent':user_agent}

print('Portal da Arte - Diagnostico Asaas Checkout/Webhook')
print('==================================================')
print('ASAAS_ENV:', env)
print('ASAAS_API_KEY:', 'OK' if api_key else 'AUSENTE')
print('ASAAS_WEBHOOK_TOKEN:', 'OK' if len(webhook_token) >= 32 else 'AUSENTE/INVALIDO')
print('ASAAS_WEBHOOK_PUBLIC_URL:', webhook_url or 'AUSENTE')
print('ASAAS_WEBHOOK_EMAIL:', 'OK' if '@' in email else 'AUSENTE/INVALIDO')

if env not in {'sandbox','production'} or not api_key:
    raise SystemExit(1)

errors = 0
with httpx.Client(timeout=20.0, follow_redirects=True) as client:
    print('\n[1/3] Consultando Webhooks no Asaas...')
    try:
        response = client.get(f'{base}/webhooks', headers=headers, params={'offset':0,'limit':100})
        print('HTTP:', response.status_code)
        if not response.is_success:
            print('Falha ao consultar Webhooks:', response.text[:1000])
            errors += 1
        else:
            data = response.json()
            hooks = data.get('data', []) if isinstance(data, dict) else []
            print('Webhooks cadastrados:', len(hooks))
            matches = [h for h in hooks if h.get('url') == webhook_url]
            if not matches:
                print('ERRO: nenhum Webhook cadastrado com ASAAS_WEBHOOK_PUBLIC_URL.')
                print('Execute: py configurar_webhook_asaas.py')
                errors += 1
            else:
                for hook in matches:
                    print('ID:', hook.get('id'))
                    print('Nome:', hook.get('name'))
                    print('Enabled:', hook.get('enabled'))
                    print('Interrupted:', hook.get('interrupted'))
                    print('Events:', ', '.join(hook.get('events') or []))
                    required={'CHECKOUT_CREATED','CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED'}
                    configured=set(hook.get('events') or [])
                    if not hook.get('enabled') or hook.get('interrupted') or not required.issubset(configured):
                        print('ERRO: Webhook existe, mas a configuracao nao esta completa/ativa.')
                        errors += 1
    except Exception as exc:
        print('Falha de rede/API ao consultar Asaas:', type(exc).__name__, str(exc))
        errors += 1

    print('\n[2/3] Testando endpoint publico do ngrok (health)...')
    if webhook_url:
        health_url = webhook_url.rstrip('/') + '/health'
        try:
            response = client.get(health_url, headers={'User-Agent': user_agent})
            print('GET', health_url)
            print('HTTP:', response.status_code)
            if response.is_success:
                try:
                    print('Resposta:', response.json())
                except Exception:
                    print('Resposta recebida, mas nao JSON.')
            else:
                print('ERRO: endpoint publico nao respondeu HTTP 2xx.')
                print('Confira se uvicorn e ngrok estao ativos e apontando para a mesma porta.')
                errors += 1
        except Exception as exc:
            print('ERRO ao acessar URL publica:', type(exc).__name__, str(exc))
            errors += 1
    else:
        print('Ignorado: ASAAS_WEBHOOK_PUBLIC_URL ausente.')
        errors += 1

    print('\n[3/3] Configuracao de checkout...')
    print('Success URL:', os.getenv('ASAAS_CHECKOUT_SUCCESS_URL','') or 'AUSENTE')
    print('Cancel URL:', os.getenv('ASAAS_CHECKOUT_CANCEL_URL','') or 'AUSENTE')
    print('Expired URL:', os.getenv('ASAAS_CHECKOUT_EXPIRED_URL','') or 'AUSENTE')

print('\nRESULTADO:', 'OK' if errors == 0 else f'{errors} problema(s) encontrado(s)')
sys.exit(0 if errors == 0 else 2)
