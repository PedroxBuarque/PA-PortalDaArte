@echo off
setlocal
cd /d "%~dp0"
py python-api\verificar_env_pagamentos.py
if errorlevel 1 (
  echo.
  echo Existem configuracoes obrigatorias pendentes. Veja os nomes acima.
  exit /b 1
)
echo.
echo Ambiente essencial configurado.
endlocal
