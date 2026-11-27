@echo off
setlocal
cd /d "%~dp0python-api"
py diagnosticar_asaas_checkout.py
if errorlevel 1 (
  echo.
  echo O diagnostico encontrou problemas. Leia as mensagens acima.
) else (
  echo.
  echo Diagnostico concluido sem problemas de configuracao detectados.
)
pause
