// ==========================================
// FIREBASE CONFIGURATION
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyB6fo2x4KIsZB1dFnnHSKt18XbQmMIDCKU",
  authDomain: "expense-tracker-1e641.firebaseapp.com",
  projectId: "expense-tracker-1e641",
  storageBucket: "expense-tracker-1e641.firebasestorage.app",
  messagingSenderId: "247466410885",
  appId: "1:247466410885:web:8ddd2778830b3b20f6baec",
  measurementId: "G-814X7VJKV3"
};

// Initialize Firebase
let app, auth, db;
try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization error:", error);
}
