// Configurazione Firebase
// SOSTITUISCI CON I TUOI VALORI DI CONFIGURAZIONE FIREBASE

const firebaseConfig = {
    apiKey: "AIzaSyAKsALzEd6iDVgfxb4nylcfYaFQmCkzxN4",
    authDomain: "apheron-homepage.firebaseapp.com",
    projectId: "apheron-homepage",
    storageBucket: "apheron-homepage.appspot.com",
    messagingSenderId: "42831155917",
    appId: "1:42831155917:web:be2c00df5d5af72dd78f84"
};

// Inizializza Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
}

