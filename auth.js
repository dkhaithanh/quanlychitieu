// --- LOGIC XÁC THỰC (ĐĂNG NHẬP/KÝ) ---

import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInWithPopup,
    signOut 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db, googleProvider } from './firebase.js';
import { showToast, showGlobalLoading, showView } from './ui.js';

/**
 * Gắn listener cho các form đăng nhập/đăng ký
 */
export function setupAuthListeners() {
    // Form đăng ký
    const registerForm = document.getElementById('register-form-main'); // SỬA: ID đúng
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const displayName = registerForm['register-name'].value;
            const email = registerForm['register-email'].value;
            const password = registerForm['register-password'].value;
            
            if (password.length < 6) {
                showToast("Mật khẩu phải có ít nhất 6 ký tự.", "error");
                return;
            }
            
            showGlobalLoading(true);
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // SỬA LỖI: Lưu thông tin user vào collection 'users'
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    displayName: displayName,
                    email: user.email,
                    dob: "", // SỬA LỖI: Thêm trường ngày sinh
                    createdAt: new Date()
                });
                
                showGlobalLoading(false);
                showToast("Đăng ký thành công!", "success");
                // onAuthStateChanged trong main.js sẽ tự động xử lý
            } catch (error) {
                showGlobalLoading(false);
                showToast(`Lỗi đăng ký: ${error.message}`, "error");
                console.error(error);
            }
        };
    } else {
        console.error("Không tìm thấy: #register-form-main");
    }


    // Form đăng nhập
    const loginForm = document.getElementById('login-form-main'); // SỬA: ID đúng
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = loginForm['login-email'].value;
            const password = loginForm['login-password'].value;
            
            showGlobalLoading(true);
            try {
                await signInWithEmailAndPassword(auth, email, password);
                showGlobalLoading(false);
                showToast("Đăng nhập thành công!", "success");
            } catch (error) {
                showGlobalLoading(false);
                // SỬA LỖI: Dịch lỗi cho dễ hiểu
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
                    showToast("Lỗi: Sai email hoặc mật khẩu.", "error");
                } else {
                    showToast(`Lỗi đăng nhập: ${error.message}`, "error");
                }
                console.error(error);
            }
        };
    } else {
        console.error("Không tìm thấy: #login-form-main");
    }

    
    // Nút đăng nhập Google
    const googleBtn = document.getElementById('google-signin-btn');
    if (googleBtn) {
        googleBtn.onclick = () => handleGoogleSignIn();
    }

    // Link chuyển đổi form
    const showRegisterBtn = document.getElementById('show-register-form-btn');
    if (showRegisterBtn) {
        showRegisterBtn.onclick = (e) => {
            e.preventDefault();
            showView('register-form', 'auth-container');
        };
    }
    
    const showLoginBtn = document.getElementById('show-login-form-btn');
    if (showLoginBtn) {
        showLoginBtn.onclick = (e) => {
            e.preventDefault();
            showView('login-form', 'auth-container');
        };
    }
}

/**
 * Xử lý đăng nhập bằng Google
 */
export async function handleGoogleSignIn() {
    showGlobalLoading(true);
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // SỬA LỖI: Lưu thông tin (hoặc cập nhật)
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            dob: "", // SỬA LỖI: Thêm trường ngày sinh (nếu chưa có)
            createdAt: new Date()
        }, { merge: true }); // Dùng merge để không ghi đè nếu user đã tồn tại
        
        showGlobalLoading(false);
        showToast("Đăng nhập Google thành công!", "success");
    } catch (error) {
        showGlobalLoading(false);
        showToast(`Lỗi Google: ${error.message}`, "error");
        console.error(error);
    }
}

/**
 * Đăng xuất
 */
export async function logout() {
    showGlobalLoading(true);
    try {
        await signOut(auth);
        showGlobalLoading(false);
        showToast("Đã đăng xuất.");
        // onAuthStateChanged sẽ tự động xử lý việc reset
    } catch (error) {
        showGlobalLoading(false);
        showToast(`Lỗi đăng xuất: ${error.message}`, "error");
    }
}

