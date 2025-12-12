// Firebase Configuration
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
// IMPORTANT: This file should use environment variables or be generated from a template
// For production, replace these values with actual Firebase config from environment
// NEVER commit real API keys to the repository!

// Load config from window object (set by build process or config file)
const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "apheron-homepage.firebaseapp.com",
  projectId: "apheron-homepage",
  storageBucket: "apheron-homepage.firebasestorage.app",
  messagingSenderId: "42831155917",
  appId: "1:42831155917:web:be2c00df5d5af72dd78f84"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase App Check for API key protection
// App Check protects your backend resources from abuse
// Even if someone has your API key, they cannot access resources without a valid App Check token
if (typeof window !== 'undefined') {
  try {
    // Get reCAPTCHA site key from window object (set by config.local.js or default)
    const recaptchaSiteKey = window.RECAPTCHA_SITE_KEY || '6LffriksAAAAAKvSqVFkxt6ggpicybwvV_yVF3Jq';
    
    // Import App Check dynamically
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js').then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
      // Initialize App Check with reCAPTCHA v3
      const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true
      });
      
      console.log('✅ Firebase App Check initialized');
    }).catch((error) => {
      console.warn('⚠️ Firebase App Check initialization failed:', error);
      console.warn('   App will work without App Check, but API key protection is reduced');
    });
  } catch (error) {
    console.warn('⚠️ Firebase App Check initialization failed:', error);
  }
}

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Export Firebase functions for use in other files
export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  setDoc
};

console.log('Firebase initialized successfully');

