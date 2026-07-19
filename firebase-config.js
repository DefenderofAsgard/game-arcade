const firebaseConfig = {
  apiKey: "AIzaSyA_Di4dypEz5kyIOW3Y-4SGrZf9GMkB6LI",
  authDomain: "game-arcade-platform.firebaseapp.com",
  projectId: "game-arcade-platform",
  storageBucket: "game-arcade-platform.firebasestorage.app",
  messagingSenderId: "994254905205",
  appId: "1:994254905205:web:7b137d1e64537aa0233d3c",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
