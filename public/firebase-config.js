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

