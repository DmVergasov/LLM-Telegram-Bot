@echo off
echo Stopping bot...
for /f "tokens=2" %%a in ('wmic process where "commandline like '%%src/index.ts%%'" get processid /value 2^>nul ^| find "="') do taskkill /F /PID %%a >nul 2>&1
echo Bot stopped.
