# Environment Variables and Configuration Guide for Apheron Homepage

## IMPORTANT: API Keys Security

This is a static website, so we use a different approach for API keys:

### Option 1: Use a separate config file (Recommended for static sites)

Create a file public/config.local.js (NOT committed to git) with:

\\\javascript
// config.local.js - DO NOT COMMIT THIS FILE
window.FIREBASE_CONFIG = {
  apiKey: 'your-actual-api-key',
  authDomain: 'your-project.firebaseapp.com',
  // ... other config
};

window.GOOGLE_MAPS_API_KEY = 'your-google-maps-api-key';
\\\

Include it in your HTML before other scripts:
\\\html
<script src="/config.local.js"></script>
\\\

### Option 2: Use Firebase Hosting environment variables

For Firebase Hosting, you can use rewrite rules to inject config at build time.

## Files that need configuration:

1. **Studio Legale Taiti**: \public/studioavvocato/js/firebase-config.js\
   - Firebase API Key: \YOUR_API_KEY_HERE\
   - Project: studio-legale-taiti

2. **Apheron Homepage**: \public/firebase-config.js\
   - Firebase API Key: \YOUR_API_KEY_HERE\
   - Project: apheron-homepage

3. **Studio Professionale Biancalani**: \public/studioprofessionalebiancalani/js/firebase-config.js\
   - Uses same config as Apheron Homepage

4. **Italian Lessons Dublin**: \public/italian-lessons-dublin/config.js\ and \index.html\
   - Google Maps API Key: \YOUR_GOOGLE_MAPS_API_KEY_HERE\

## Setup Instructions:

1. Copy this file to \.env.example\ (for documentation)
2. Create \public/config.local.js\ with your actual keys (NOT in git)
3. Add \config.local.js\ to \.gitignore\
4. Include \config.local.js\ in your HTML files before other scripts
