@echo off
echo 🇮🇹 Setup Italian Lessons Dublin Project
echo ========================================

echo.
echo 📁 Checking project structure...
if not exist "index.html" (
    echo ❌ Error: index.html not found!
    pause
    exit /b 1
)
if not exist "styles.css" (
    echo ❌ Error: styles.css not found!
    pause
    exit /b 1
)
if not exist "script.js" (
    echo ❌ Error: script.js not found!
    pause
    exit /b 1
)
echo ✅ All main files found!

echo.
echo 🔧 Initializing Git repository...
git init
if %errorlevel% neq 0 (
    echo ❌ Error: Git not found! Please install Git first.
    pause
    exit /b 1
)
echo ✅ Git repository initialized!

echo.
echo 📦 Adding files to Git...
git add .
echo ✅ Files added to Git!

echo.
echo 💾 Creating initial commit...
git commit -m "Initial commit: Italian lessons landing page"
echo ✅ Initial commit created!

echo.
echo 🚀 Setup completed successfully!
echo.
echo Next steps:
echo 1. Create repository on GitHub
echo 2. Run: git remote add origin [YOUR_GITHUB_URL]
echo 3. Run: git push -u origin main
echo 4. Enable GitHub Pages in repository settings
echo.
echo 📖 See GITHUB-DEPLOY.md for detailed instructions
echo.
pause
