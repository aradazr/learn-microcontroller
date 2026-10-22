@echo off
rem Starts the site on this computer and opens it in the browser
cd /d "%~dp0"
start "" http://localhost:8090/fa/
where py >NUL 2>NUL
if %errorlevel%==0 (py -m http.server 8090 -d site) else (python -m http.server 8090 -d site)
pause
