@echo off
setlocal
cd /d "%~dp0python-api"
py configurar_webhook_asaas.py
if errorlevel 1 (
  echo.
  echo Nao foi possivel configurar o Webhook. Leia a resposta do Asaas acima.
) else (
  echo.
  echo Webhook configurado. Agora execute DIAGNOSTICAR-ASAAS.bat.
)
pause
