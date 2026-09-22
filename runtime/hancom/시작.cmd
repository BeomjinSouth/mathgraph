@echo off
chcp 65001 >nul
cd /d "%~dp0"
py -3 -c "import sys; sys.exit(sys.version_info < (3,10))" >nul 2>&1
if errorlevel 1 (
    echo Python 3.10 이상이 필요합니다. https://www.python.org/downloads/windows/ 에서 설치해 주세요.
    pause
    exit /b 1
)
if not exist ".venv\Scripts\python.exe" py -3 -m venv .venv
if not exist ".venv\Scripts\python.exe" (
    echo 연결 프로그램의 실행 환경을 만들지 못했습니다.
    pause
    exit /b 1
)
".venv\Scripts\python.exe" -c "import win32com.client" >nul 2>&1
if errorlevel 1 ".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
    echo 필요한 구성 요소를 설치하지 못했습니다. 인터넷 연결을 확인해 주세요.
    pause
    exit /b 1
)
".venv\Scripts\python.exe" -X utf8 bridge.py %*
pause
