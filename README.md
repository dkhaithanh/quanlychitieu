# 💰 Trình Quản Lý Chi Tiêu AI (quanlychitieu)

Ứng dụng web **Quản lý Chi tiêu Cá nhân và Nhóm** được xây dựng bằng **HTML**, **Tailwind CSS**, và **JavaScript thuần**.  
Sử dụng **Firebase** cho backend (Authentication, Firestore, Hosting) và **Google Gemini API** để phân tích ngôn ngữ tự nhiên.

---

## ⚙️ Các Tính Năng Chính

- 🔐 **Xác thực người dùng**: Đăng nhập / Đăng ký bằng Email & Google  
- 💸 **Quản lý Giao dịch**: Thêm, sửa, xóa các khoản thu/chi  
- 🤖 **Phân tích AI (Gemini)**: Gõ “ăn sáng 30k hôm qua” và AI tự động hiểu, điền thông tin  
- 👨‍👩‍👧‍👦 **Ví Nhóm**: Tạo ví chung, mời thành viên qua email  
- ✉️ **Hệ thống Lời mời**: Thành viên được mời có thể chấp nhận hoặc từ chối  
- 🧑‍💼 **Quản lý Thành viên**: Trưởng nhóm (Owner) có thể xóa hoặc chuyển quyền  
- 🚪 **Rời Nhóm**: Thành viên có thể tự rời khỏi ví nhóm  
- 📊 **Báo cáo**: Xem biểu đồ thu/chi, cơ cấu chi tiêu  
- 🕓 **Log Hoạt Động**: Ghi lại lịch sử thay đổi trong ví  

---

## 🧱 Công Nghệ Sử Dụng

**Frontend:**
- HTML5  
- Tailwind CSS  
- JavaScript (ES6 Modules)

**Backend (BaaS):**
- Firebase (Authentication, Firestore, Hosting)

**APIs:**
- Google Gemini API — Xử lý ngôn ngữ tự nhiên (NLP)  
- Google Identity Toolkit API — Xác thực người dùng  

---

## 🔑 Yêu Cầu Chuẩn Bị

Bạn cần có **2 API Keys**:

1. **Firebase Config Object**
   - Lấy từ trang Cài đặt Dự án Firebase  
   - Thêm vào file `firebase.js`

2. **Gemini API Key**
   - Lấy từ [Google Cloud Console](https://console.cloud.google.com/)  
   - Thêm vào file `api.js`

---

## 🧭 Hướng Dẫn Cài Đặt & Deploy

### 🪜 Bước 1: Chuẩn Bị Code & Bảo Mật

```bash
git clone https://github.com/dkhaithanh/quanlychitieu.git
cd quanlychitieu

Tạo file .gitignore

# Ẩn các file chứa API key thật
api.js
firebase.js

Tạo file mẫu an toàn

mv api.js api.js.template
mv firebase.js firebase.js.template

Trong api.js.template:

const GEMINI_API_KEY = "DÁN_KEY_GEMINI_CỦA_BẠN_VÀO_ĐÂY";

Trong firebase.js.template:

const firebaseConfig = {
  apiKey: "DÁN_KEY_FIREBASE_CỦA_BẠN_VÀO_ĐÂY",
  ...
};

Sau đó:

cp api.js.template api.js
cp firebase.js.template firebase.js


⸻

🪜 Bước 2: Cấu Hình Firebase
	1.	Tạo Dự Án Firebase
	•	Truy cập Firebase Console￼
	•	Tạo dự án mới → Thêm ứng dụng Web → Sao chép firebaseConfig
	2.	Bật Xác Thực (Authentication)
	•	Build → Authentication → Sign-in method
	•	Bật Email/Password và Google
	3.	Tạo Firestore
	•	Build → Firestore Database → Create Database
	•	Chọn production mode
	4.	Cập nhật Quy tắc bảo mật (Rules)
Sao chép nội dung đầy đủ trong firestore.rules (đính kèm trong repo)
	5.	Tạo Chỉ mục (Indexes)
	•	Collection ID: invitations
	•	Trường:

Field	Order
invitedEmail	Ascending
status	Ascending
createdAt	Descending



⸻

🪜 Bước 3: Cài Đặt Google Cloud API
	1.	Kích hoạt Gemini API
	•	Vào APIs & Services → Library → Bật Generative Language API
	•	Tạo API Key mới
	•	Dán vào biến GEMINI_API_KEY trong api.js
	2.	Bật Identity Toolkit API
	•	Dành cho đăng nhập Firebase
	3.	Hạn chế truy cập API Key (Rất quan trọng)
Trong Google Cloud Console → Credentials → Chọn key →
	•	Application restrictions → Websites
	•	Thêm:

http://localhost:8000/*
https://[YOUR_PROJECT_ID].web.app/*


	4.	Cấu hình OAuth 2.0 (Đăng nhập Google)
	•	Authorized origins:

http://localhost:8000
https://[YOUR_PROJECT_ID].web.app


	•	Redirect URI (thường được tự thêm):

https://[YOUR_PROJECT_ID].firebaseapp.com/__/auth/handler



⸻

🪜 Bước 4: Chạy Local & Deploy

Chạy Local:

python -m http.server 8000

→ Truy cập http://localhost:8000￼

Deploy lên Firebase Hosting:

npm install -g firebase-tools
firebase login
firebase init
firebase deploy --only hosting

Sau khi hoàn tất, bạn sẽ nhận được Hosting URL.

⸻

🔒 Bảo Mật (Quan Trọng)
	•	❌ Không bao giờ push api.js hoặc firebase.js chứa key thật lên GitHub public
	•	✅ Luôn sử dụng .gitignore
	•	🔐 Hạn chế domain truy cập cho tất cả API Key trên Google Cloud

⸻

📄 Giấy Phép

© 2025 — Developed by Khai Thanh (dkhaithanh)
Sử dụng cho mục đích học tập và phi thương mại.
