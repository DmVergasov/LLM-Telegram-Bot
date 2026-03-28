@echo off
echo Stopping bot...
taskkill /F /IM bun.exe /FI "WINDOWTITLE eq bun*" >nul 2>&1
for /f "tokens=2" %%a in ('wmic process where "commandline like '%%src/index.ts%%'" get processid /value 2^>nul ^| find "="') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul
echo Starting bot...
cd /d "%~dp0"
start /b "" cmd /c "bun run start > data\bot.log 2>&1"
echo Bot restarted. Logs: data\bot.log
