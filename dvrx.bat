@echo off
if exist "%~dp0.venv\Scripts\dvrx.exe" (
    "%~dp0.venv\Scripts\dvrx.exe" %*
) else (
    py -3.13 -m dvrx %*
)
