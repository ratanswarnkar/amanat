import { initializeApp, getApps, getApp } from "firebase/app";
const firebaseConfig = {
  apiKey: "AIzaSyBYG6VtZ5h4n4A5EPH6IEGb2xZV4U90alk",
  authDomain: "amanatapp-1c9c4.firebaseapp.com",
  projectId: "amanatapp-1c9c4",
  storageBucket: "amanatapp-1c9c4.firebasestorage.app",
  messagingSenderId: "567844993586",
  appId: "1:567844993586:web:9c06e40847b6d003325a2b",
  measurementId: "G-3SV7TJD9RV"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export { app };