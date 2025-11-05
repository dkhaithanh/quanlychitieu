import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CẤU HÌNH CỦA BẠN ---
// ...
const firebaseConfig = {
  apiKey: "DÁN_KEY_FIREBASE_CỦA_BẠN_VÀO_ĐÂY",
  // ...
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider(); 

setLogLevel('debug');

export { app, auth, db, googleProvider };

