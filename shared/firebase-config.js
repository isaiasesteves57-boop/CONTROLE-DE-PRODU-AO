// Reutiliza o mesmo projeto Firebase do Gestor 2026.
const GESTOR_FIREBASE_CONFIG = {
  apiKey: "SUA_API_KEY",
  authDomain: "gestor-de-banca-412d7.firebaseapp.com",
  projectId: "gestor-de-banca-412d7",
  storageBucket: "gestor-de-banca-412d7.firebasestorage.app",
  messagingSenderId: "SEU_ID",
  appId: "SEU_APP_ID"
};

if (!firebase.apps.length) {
  firebase.initializeApp(GESTOR_FIREBASE_CONFIG);
}
