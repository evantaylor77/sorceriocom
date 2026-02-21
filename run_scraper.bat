@echo off
cd /d "%~dp0"

echo [%date% %time%] Starting 60Saniye scraper...

cd scraper
python api_scraper.py
if %errorlevel% neq 0 (
    echo [%date% %time%] Scraper failed with exit code %errorlevel%
    exit /b %errorlevel%
)

cd ..

echo [%date% %time%] Checking for changes...
git add data/tweets.json
git diff --staged --quiet
if %errorlevel% equ 0 (
    echo [%date% %time%] No new data to push
) else (
    git commit -m "Update tweets [automated]"
    git push origin main
    echo [%date% %time%] Changes pushed to GitHub
)

echo [%date% %time%] Done!
