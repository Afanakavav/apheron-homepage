/**
 * Firebase Configuration for Studio Legale Taiti
 * 
 * This file initializes Firebase services (Firestore, Functions)
 * Replace the placeholder values with your actual Firebase project configuration
 */

// Firebase configuration object
// IMPORTANT: This file should use environment variables or be generated from a template
// For production, replace these values with actual Firebase config from environment
// NEVER commit real API keys to the repository!

// Load config from window object (set by build process or config file)
const firebaseConfig = window.FIREBASE_CONFIG || {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "studio-legale-taiti.firebaseapp.com",
    projectId: "studio-legale-taiti",
    storageBucket: "studio-legale-taiti.firebasestorage.app",
    messagingSenderId: "899985228502",
    appId: "1:899985228502:web:410aa309a31d2d36bd7f77"
};

// Initialize Firebase (using compat version for broader browser support)
let firebaseApp;
let db;
let functions;

try {
    // Check if Firebase is already initialized
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebaseApp = firebase.app();
        db = firebase.firestore();
        functions = firebase.functions();
    } else if (typeof firebase !== 'undefined') {
        // Initialize Firebase
        firebaseApp = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        functions = firebase.functions();
        
        // Enable offline persistence (optional)
        // db.enablePersistence().catch((err) => {
        //     if (err.code === 'failed-precondition') {
        //         console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        //     } else if (err.code === 'unimplemented') {
        //         console.warn('The current browser does not support all of the features required for persistence.');
        //     }
        // });
    } else {
        console.error('Firebase SDK not loaded. Please include Firebase scripts in your HTML.');
    }
} catch (error) {
    console.error('Error initializing Firebase:', error);
}

/**
 * Get Firestore database instance
 * @returns {firebase.firestore.Firestore} Firestore instance
 */
export function getFirestore() {
    if (!db) {
        console.error('Firestore not initialized. Check Firebase configuration.');
    }
    return db;
}

/**
 * Get Firebase Functions instance
 * @returns {firebase.functions.Functions} Functions instance
 */
export function getFunctions() {
    if (!functions) {
        console.error('Functions not initialized. Check Firebase configuration.');
    }
    return functions;
}

/**
 * Get Firebase App instance
 * @returns {firebase.app.App} Firebase App instance
 */
export function getFirebaseApp() {
    return firebaseApp;
}

// Export for use in other modules
export { db, functions, firebaseApp };

