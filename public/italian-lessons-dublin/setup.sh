#!/bin/bash

echo "🇮🇹 Setup Italian Lessons Dublin Project"
echo "========================================"

echo ""
echo "📁 Checking project structure..."
if [ ! -f "index.html" ]; then
    echo "❌ Error: index.html not found!"
    exit 1
fi
if [ ! -f "styles.css" ]; then
    echo "❌ Error: styles.css not found!"
    exit 1
fi
if [ ! -f "script.js" ]; then
    echo "❌ Error: script.js not found!"
    exit 1
fi
echo "✅ All main files found!"

echo ""
echo "🔧 Initializing Git repository..."
git init
if [ $? -ne 0 ]; then
    echo "❌ Error: Git not found! Please install Git first."
    exit 1
fi
echo "✅ Git repository initialized!"

echo ""
echo "📦 Adding files to Git..."
git add .
echo "✅ Files added to Git!"

echo ""
echo "💾 Creating initial commit..."
git commit -m "Initial commit: Italian lessons landing page"
echo "✅ Initial commit created!"

echo ""
echo "🚀 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Create repository on GitHub"
echo "2. Run: git remote add origin [YOUR_GITHUB_URL]"
echo "3. Run: git push -u origin main"
echo "4. Enable GitHub Pages in repository settings"
echo ""
echo "📖 See GITHUB-DEPLOY.md for detailed instructions"
echo ""
