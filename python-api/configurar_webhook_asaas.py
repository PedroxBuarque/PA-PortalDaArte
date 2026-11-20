"""Cadastra o Webhook do carrinho no Asaas usando as variáveis do .env."""
from pathlib import Path
import os
import sys
import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name('.env'), encoding='utf-8-sig', override=False)

environment = os.getenv('ASAAS_ENV', 'sandbox').strip().lower()
api_key = os.getenv('ASAAS_API_KEY', '').strip()
url = os.getenv('ASAAS_WEBHOOK_PUBLIC_URL', '').strip()
token = os.getenv('ASAAS_WEBHOOK_TOKEN', '').strip()
user_agent = os.getenv('ASAAS_USER_AGENT', 'PortalDaArte/1.0').strip() or 'PortalDaArte/1.0'

if environment not in {'sandbox', 'production'}:
    sys.exit('ERRO: ASAAS_ENV deve ser sandbox ou production.')
if not api_key:
    sys.exit('ERRO: preencha ASAAS_API_KEY no python-api/.env.')
if not url.startswith('https://'):
    sys.exit('ERRO: ASAAS_WEBHOOK_PUBLIC_URL precisa ser uma URL HTTPS pública.')
if len(token) < 32:
    sys.exit('ERRO: ASAAS_WEBHOOK_TOKEN precisa ter pelo menos 32 caracteres.')

base = 'https://api-sandbox.asaas.com/v3' if environment == 'sandbox' else 'https://api.asaas.com/v3'
payload = {
    'name': 'Portal da Arte - Carrinho',
    'url': url,
    'enabled': True,
    'interrupted': False,
    'apiVersion': 3,
    'authToken': token,
    'sendType': 'SEQUENTIALLY',
    'events': ['CHECKOUT_CREATED', 'CHECKOUT_PAID', 'CHECKOUT_CANCELED', 'CHECKOUT_EXPIRED'],
}
headers = {
    'accept': 'application/json',
    'content-type': 'application/json',
    'access_token': api_key,
    'User-Agent': user_agent,
}
with httpx.Client(timeout=20.0) as client:
    response = client.post(f'{base}/webhooks', headers=headers, json=payload)
try:
    data = response.json()
except Exception:
    data = {'raw': response.text}
if not response.is_success:
    print('ERRO AO CADASTRAR WEBHOOK')
    print(data)
    raise SystemExit(1)
print('Webhook cadastrado com sucesso.')
print(data)
