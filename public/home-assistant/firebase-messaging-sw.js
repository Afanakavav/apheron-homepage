// Service Worker for Firebase Cloud Messaging
// This file is a template. Environment variables are injected during build.
// DO NOT commit this file with real API keys!

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// Environment variables are injected during build by vite-plugin-sw-env
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'Home Assistant';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/home-assistant/icon-192x192.png',
    badge: '/home-assistant/icon-192x192.png',
    tag: payload.data?.tag || 'default',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

