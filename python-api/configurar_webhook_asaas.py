"""Cria ou atualiza o Webhook do carrinho no Asaas usando python-api/.env.

Este script e idempotente: se encontrar um Webhook com a mesma URL ou nome,
atualiza a configuracao em vez de criar duplicata.
"""
from pathlib import Path
import os
import sys
import httpx
from dotenv import load_dotenv

ENV_FILE = Path(__file__).with_name('.env')
load_dotenv(ENV_FILE, encoding='utf-8-sig', override=False)

environment = os.getenv('ASAAS_ENV', 'sandbox').strip().lower()
api_key = os.getenv('ASAAS_API_KEY', '').strip()
url = os.getenv('ASAAS_WEBHOOK_PUBLIC_URL', '').strip()
token = os.getenv('ASAAS_WEBHOOK_TOKEN', '').strip()
email = os.getenv('ASAAS_WEBHOOK_EMAIL', '').strip() or os.getenv('SMTP_USERNAME', '').strip()
user_agent = os.getenv('ASAAS_USER_AGENT', 'PortalDaArte/1.0').strip() or 'PortalDaArte/1.0'
name = os.getenv('ASAAS_WEBHOOK_NAME', 'Portal da Arte - Carrinho').strip() or 'Portal da Arte - Carrinho'

if environment not in {'sandbox', 'production'}:
    sys.exit('ERRO: ASAAS_ENV deve ser sandbox ou production.')
if not api_key:
    sys.exit('ERRO: preencha ASAAS_API_KEY no python-api/.env.')
if not url.startswith('https://'):
    sys.exit('ERRO: ASAAS_WEBHOOK_PUBLIC_URL precisa ser uma URL HTTPS publica.')
if len(token) < 32 or len(token) > 255 or any(ch.isspace() for ch in token):
    sys.exit('ERRO: ASAAS_WEBHOOK_TOKEN deve ter entre 32 e 255 caracteres e nao conter espacos.')
if '@' not in email or '.' not in email.rsplit('@', 1)[-1]:
    sys.exit('ERRO: defina ASAAS_WEBHOOK_EMAIL com um e-mail valido (ou SMTP_USERNAME com e-mail valido).')

base = 'https://api-sandbox.asaas.com/v3' if environment == 'sandbox' else 'https://api.asaas.com/v3'
headers = {
    'accept': 'application/json',
    'content-type': 'application/json',
    'access_token': api_key,
    'User-Agent': user_agent,
}
webhook_fields = {
    'name': name,
    'url': url,
    'enabled': True,
    'interrupted': False,
    'apiVersion': 3,
    'authToken': token,
    'sendType': 'SEQUENTIALLY',
    'events': ['CHECKOUT_CREATED', 'CHECKOUT_PAID', 'CHECKOUT_CANCELED', 'CHECKOUT_EXPIRED'],
}

def safe_json(response: httpx.Response):
    try:
        return response.json()
    except Exception:
        return {'raw': response.text[:2000]}

print(f'Ambiente: {environment}')
print(f'URL publica: {url}')
print(f'E-mail de alertas: {email}')
print('Consultando Webhooks existentes...')

with httpx.Client(timeout=20.0, follow_redirects=True) as client:
    listing = client.get(f'{base}/webhooks', headers=headers, params={'offset': 0, 'limit': 100})
    if not listing.is_success:
        print('ERRO AO LISTAR WEBHOOKS')
        print(safe_json(listing))
        raise SystemExit(1)

    data = safe_json(listing)
    existing = data.get('data', []) if isinstance(data, dict) else []
    target = next((item for item in existing if item.get('url') == url), None)
    if not target:
        target = next((item for item in existing if item.get('name') == name), None)

    if target and target.get('id'):
        webhook_id = target['id']
        print(f'Webhook existente encontrado: {webhook_id}. Atualizando...')
        response = client.put(f'{base}/webhooks/{webhook_id}', headers=headers, json=webhook_fields)
        action = 'atualizado'
    else:
        print('Nenhum Webhook correspondente encontrado. Criando...')
        create_payload = {**webhook_fields, 'email': email}
        response = client.post(f'{base}/webhooks', headers=headers, json=create_payload)
        action = 'criado'

result = safe_json(response)
if not response.is_success:
    print(f'ERRO: webhook nao foi {action}. HTTP {response.status_code}')
    print(result)
    raise SystemExit(1)

print(f'Webhook {action} com sucesso.')
print('ID:', result.get('id', target.get('id') if target else 'nao informado'))
print('Enabled:', result.get('enabled', True))
print('Interrupted:', result.get('interrupted', False))
print('Events:', result.get('events', webhook_fields['events']))
print('\nProximo passo: execute "py diagnosticar_asaas_checkout.py".')
