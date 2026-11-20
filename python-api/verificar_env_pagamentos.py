"""Valida configuração local sem revelar credenciais."""
from pathlib import Path
import os
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / '.env', encoding='utf-8-sig', override=False)

required_core = [
    'DB_HOST', 'DB_USER', 'DB_NAME', 'SECRET_KEY',
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD',
    'SUPABASE_URL',
]
required_checkout = ['ASAAS_API_KEY', 'ASAAS_WEBHOOK_TOKEN']
optional_checkout = ['ASAAS_WEBHOOK_PUBLIC_URL']
optional_legacy = ['ASAAS_PIX_FEE_ESTIMATED', 'ASAAS_NF_BASE', 'ASAAS_NF_CONFIG_JSON']

missing_core = [k for k in required_core if not os.getenv(k, '').strip()]
if not (os.getenv('SUPABASE_SECRET_KEY', '').strip() or os.getenv('SUPABASE_SERVICE_ROLE_KEY', '').strip()):
    missing_core.append('SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY')
missing_checkout = [k for k in required_checkout if not os.getenv(k, '').strip()]
missing_optional_checkout = [k for k in optional_checkout if not os.getenv(k, '').strip()]
missing_legacy = [k for k in optional_legacy if not os.getenv(k, '').strip() or (k == 'ASAAS_NF_CONFIG_JSON' and os.getenv(k, '').strip() == '{}')]

print('Portal da Arte - verificação de ambiente')
print('----------------------------------------')
print('Configuração base:', 'OK' if not missing_core else 'INCOMPLETA')
if missing_core:
    print('  Faltando:', ', '.join(missing_core))
print('Checkout Asaas:', 'OK' if not missing_checkout else 'INCOMPLETO')
if missing_checkout:
    print('  Faltando:', ', '.join(missing_checkout))
if missing_optional_checkout:
    print('Webhook externo ainda não configurado:', ', '.join(missing_optional_checkout))
print('PIX/NFS-e Sandbox legado:', 'OK' if not missing_legacy else 'OPCIONAL / INCOMPLETO')
if missing_legacy:
    print('  Faltando para esse fluxo:', ', '.join(missing_legacy))

front_env = ROOT.parent / 'PA-PortalDaArte' / '.env'
front_api = ''
if front_env.exists():
    for line in front_env.read_text(encoding='utf-8-sig').splitlines():
        if line.startswith('EXPO_PUBLIC_API_URL='):
            front_api = line.split('=', 1)[1].strip()
            break
print('Frontend EXPO_PUBLIC_API_URL:', 'OK' if front_api else 'AUSENTE')

if missing_core or missing_checkout:
    raise SystemExit(1)
