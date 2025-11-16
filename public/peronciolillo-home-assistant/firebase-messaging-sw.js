// Service Worker for Firebase Cloud Messaging
// This file must be in the public folder

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// Note: You'll need to configure this with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB5VI0cWCHsLEju4UfxvSolbMgUEQ0CEso",
  authDomain: "peronciolillo-home-assistant.firebaseapp.com",
  projectId: "peronciolillo-home-assistant",
  storageBucket: "peronciolillo-home-assistant.firebasestorage.app",
  messagingSenderId: "505439281340",
  appId: "1:505439281340:web:e39a71d8fa10fc9a1530b9"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'Peronciolillo Home Assistant';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: payload.data?.tag || 'default',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

