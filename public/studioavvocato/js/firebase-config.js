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
// Using studio-legale-taiti project (correct project for Carlotta Taiti website)
// IMPORTANT: Always use studio-legale-taiti config, ignore window.FIREBASE_CONFIG if it's for apheron-homepage
const firebaseConfig = (() => {
    // Check if window.FIREBASE_CONFIG exists and is for the correct project
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId === 'studio-legale-taiti') {
        console.log('Using window.FIREBASE_CONFIG for studio-legale-taiti');
        return window.FIREBASE_CONFIG;
    }
    
    // Always use the correct config for studio-legale-taiti
    console.log('Using hardcoded config for studio-legale-taiti (ignoring window.FIREBASE_CONFIG if present)');
    return {
        apiKey: "AIzaSyAKm5nPCkRKt7M89vom33TTjecvUw0EEUY",
        authDomain: "studio-legale-taiti.firebaseapp.com",
        projectId: "studio-legale-taiti",
        storageBucket: "studio-legale-taiti.firebasestorage.app",
        messagingSenderId: "899985228502",
        appId: "1:899985228502:web:410aa309a31d2d36bd7f77"
    };
})();

// Initialize Firebase (using compat version for broader browser support)
let firebaseApp;
let db;
let functions;

// Wait for Firebase to be available
function initializeFirebase() {
    try {
        // Check if Firebase is available
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not loaded. Please include Firebase scripts in your HTML.');
            return;
        }

        // Always initialize with a specific app name to avoid conflicts
        const appName = 'studio-legale-taiti-app';
        
        // Verify the config is correct before initializing
        if (firebaseConfig.projectId !== 'studio-legale-taiti') {
            console.error('❌ Config has wrong project ID! Expected studio-legale-taiti, got:', firebaseConfig.projectId);
            console.error('This should never happen - using hardcoded correct config');
            // Force correct config
            firebaseConfig.projectId = 'studio-legale-taiti';
            firebaseConfig.authDomain = 'studio-legale-taiti.firebaseapp.com';
            firebaseConfig.storageBucket = 'studio-legale-taiti.firebasestorage.app';
            firebaseConfig.apiKey = "AIzaSyAKm5nPCkRKt7M89vom33TTjecvUw0EEUY";
            firebaseConfig.messagingSenderId = "899985228502";
            firebaseConfig.appId = "1:899985228502:web:410aa309a31d2d36bd7f77";
        }
        
        // Check if our specific app is already initialized
        try {
            firebaseApp = firebase.app(appName);
            console.log('Using existing Firebase app:', appName, 'Project:', firebaseApp.options.projectId);
            
            // Verify the existing app is using the correct project
            if (firebaseApp.options.projectId !== 'studio-legale-taiti') {
                console.warn('⚠️ Existing app has wrong project, deleting and reinitializing...');
                firebaseApp.delete();
                firebaseApp = null;
            }
        } catch (error) {
            // App doesn't exist, that's fine
            firebaseApp = null;
        }
        
        // Initialize if not already done
        if (!firebaseApp) {
            console.log('Initializing Firebase with config for studio-legale-taiti:', firebaseConfig);
            firebaseApp = firebase.initializeApp(firebaseConfig, appName);
            console.log('✅ Firebase app initialized:', firebaseApp.name, 'Project:', firebaseApp.options.projectId);
        }
        
        // Final verification
        if (firebaseApp.options.projectId !== 'studio-legale-taiti') {
            console.error('❌ CRITICAL: App still has wrong project ID after initialization!');
            throw new Error('Failed to initialize Firebase with correct project ID');
        }
        
        // Initialize Firestore
        db = firebase.firestore(firebaseApp);
        console.log('✅ Firestore initialized for project:', firebaseApp.options.projectId);
        
        // Initialize Functions with europe-west3 region
        // In compat version, we need to use the region-specific URL
        // Store the region for later use
        if (firebase.functions) {
            // Create functions instance - we'll override the region in form-handler
            functions = firebase.functions(firebaseApp);
            // Store region info for later use
            functions._region = 'europe-west3';
            functions._projectId = firebaseApp.options.projectId;
            console.log('✅ Functions initialized for app:', firebaseApp.name, 'Project:', firebaseApp.options.projectId, 'Region: europe-west3');
        } else {
            console.error('Firebase Functions SDK not available');
        }
        
    } catch (error) {
        console.error('Error initializing Firebase:', error);
    }
}

// Initialize when DOM is ready and Firebase is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFirebase);
} else {
    // DOM already loaded, try to initialize
    if (typeof firebase !== 'undefined') {
        initializeFirebase();
    } else {
        // Wait for Firebase to load
        window.addEventListener('load', initializeFirebase);
    }
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
        console.error('Functions not initialized. Attempting to initialize...');
        // Try to initialize if Firebase is available
        if (typeof firebase !== 'undefined' && firebaseApp) {
            try {
                functions = firebase.functions(firebaseApp, 'europe-west3');
                console.log('Functions initialized on demand');
            } catch (error) {
                console.error('Failed to initialize Functions:', error);
            }
        }
    }
    return functions;
}

/**
 * Get Firebase App instance
 * @returns {firebase.app.App} Firebase App instance
 */
export function getFirebaseApp() {
    if (!firebaseApp) {
        console.warn('Firebase app not initialized, attempting to initialize...');
        initializeFirebase();
    }
    // Verify we're using the correct project
    if (firebaseApp && firebaseApp.options.projectId !== 'studio-legale-taiti') {
        console.error('❌ Wrong project ID in getFirebaseApp! Expected studio-legale-taiti, got:', firebaseApp.options.projectId);
    }
    return firebaseApp;
}

// Export for use in other modules
export { db, functions, firebaseApp };

