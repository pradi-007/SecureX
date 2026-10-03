@echo off
set PATH=C:\Users\Mallikarjun\AppData\Local\Programs\Git\cmd;%PATH%
echo ========================================================
echo   DVRX - Push to GitHub (pradi-007/SecureX)
echo ========================================================
echo.
echo Pushing branch 'main' to https://github.com/pradi-007/SecureX.git ...
echo.

git push -u origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Project successfully pushed to https://github.com/pradi-007/SecureX!
    goto done
)

echo.
echo [AUTH REQUIRED] GitHub requires authentication to push to your repository.
echo Launching 1-click browser login via GitHub CLI...
echo.

gh auth login -h github.com -p https -w
echo.
echo Re-trying push after authentication...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Project successfully pushed to https://github.com/pradi-007/SecureX!
) else (
    echo.
    echo [FAILED] Push did not complete. Please verify your repository permissions.
)

:done
echo.
pause
