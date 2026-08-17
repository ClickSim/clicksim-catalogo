@echo off
title Instalando Atendente WhatsApp
cd /d "%~dp0"
echo Instalando dependencias, aguarde...
call npm install
echo.
echo Instalacao concluida! Agora use o arquivo "iniciar.vbs" para abrir o atendente.
pause
