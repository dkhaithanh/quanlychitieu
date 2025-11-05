Trình Quản Lý Chi Tiêu AI (quanlychitieu)Đây là một ứng dụng web Quản lý Chi tiêu Cá nhân và Nhóm được xây dựng bằng HTML, Tailwind CSS, và JavaScript thuần. Ứng dụng sử dụng Firebase cho backend (Authentication, Firestore, Hosting) và tích hợp Google Gemini API để phân tích và thêm giao dịch bằng ngôn ngữ tự nhiên.Các Tính Năng ChínhXác thực người dùng: Đăng nhập / Đăng ký bằng Email & Google.Quản lý Giao dịch: Thêm, Sửa, Xóa các khoản Thu/Chi.Phân tích AI (Gemini): Gõ "ăn sáng 30k hôm qua" và AI sẽ tự động điền vào biểu mẫu.Ví Nhóm: Tạo ví chung, mời thành viên qua email.Hệ thống Lời mời: Người được mời phải "Chấp nhận" hoặc "Từ chối" trước khi tham gia.Quản lý Thành viên: Trưởng nhóm (Owner) có thể Xóa thành viên hoặc Chuyển quyền Trưởng nhóm.Rời nhóm: Thành viên (Editor) có thể tự rời khỏi ví nhóm.Báo cáo: Xem biểu đồ Thu/Chi và Cơ cấu Chi tiêu.Log Hoạt Động: Ghi lại lịch sử các thay đổi quan trọng trong ví.Công nghệ sử dụngFrontend: HTML5, Tailwind CSS, JavaScript (ES6 Modules)Backend (BaaS): FirebaseAuthentication: Xác thực người dùng.Firestore: Cơ sở dữ liệu NoSQL.Hosting: Deploy ứng dụng web.APIs:Google Gemini API: Xử lý ngôn ngữ tự nhiên (NLP).Google Identity Toolkit API: Hỗ trợ xác thực.Yêu Cầu (Cần chuẩn bị)Để chạy dự án này, bạn sẽ cần lấy 2 thông tin xác thực (API Keys) và thêm vào code của mình.Firebase Config Object: Lấy từ Cài đặt Dự án Firebase của bạn.Nơi thêm: Dán vào file firebase.js.Hướng dẫn lấy: Xem Bước 2, Mục 2 dưới đây.Gemini API Key: Lấy từ Google Cloud Console.Nơi thêm: Dán vào file api.js.Hướng dẫn lấy: Xem Bước 3, Mục 1 dưới đây.Hướng Dẫn Cài Đặt và Deploy (Từng bước một)Đây là hướng dẫn đầy đủ để cài đặt dự án này từ đầu.Bước 1: Chuẩn bị Code và Bảo mậtTrước khi bắt đầu, bạn cần xử lý các API Key để tránh làm lộ chúng trên GitHub.Clone Repository:git clone [https://github.com/dkhaithanh/quanlychitieu.git](https://github.com/dkhaithanh/quanlychitieu.git)
cd quanlychitieu
Tạo file .gitignore:Tạo một file mới tên là .gitignore (có dấu chấm ở đầu) trong thư mục quanlychitieu và dán nội dung sau vào. File này sẽ ngăn Git upload các file chứa key thật của bạn.# Ẩn các file chứa API key thật
api.js
firebase.js
Tạo File Mẫu (Template):Đổi tên 2 file chứa key của bạn để tạo "bản mẫu" an toàn:mv api.js api.js.template
mv firebase.js firebase.js.template
Chỉnh sửa File Mẫu:Mở api.js.template và firebase.js.template, xóa key thật và thay bằng hướng dẫn:Trong api.js.template:const GEMINI_API_KEY = "DÁN_KEY_GEMINI_CỦA_BẠN_VÀO_ĐÂY";Trong firebase.js.template:const firebaseConfig = { apiKey: "DÁN_KEY_FIREBASE_CỦA_BẠN_VÀO_ĐÂY", ... };Tạo lại File Key thật (Dùng local):Bây giờ, tạo lại các file thật (sẽ bị .gitignore bỏ qua):cp api.js.template api.js
cp firebase.js.template firebase.js
Mở api.js và firebase.js (file thật) và chuẩn bị dán API Key của bạn vào ở các bước tiếp theo.Bước 2: Cài đặt Dự án FirebaseTạo Dự án:Truy cập Bảng điều khiển Firebase.Tạo một dự án mới (ví dụ: quan-ly-chi-tieu-cua-toi).Lấy firebaseConfig:Trong "Project Overview", nhấp vào biểu tượng Web </>.Đăng ký một ứng dụng web mới.Firebase sẽ cung cấp cho bạn một đối tượng firebaseConfig.Hành động: Sao chép toàn bộ đối tượng firebaseConfig = { ... } này. Mở file firebase.js (file thật bạn đã tạo ở Bước 1) và dán đè lên nội dung mẫu.Bật Phương thức Đăng nhập (Authentication):Vào "Build" -> "Authentication" -> "Sign-in method".Bật (Enable) phương thức "Email/Password".Bật (Enable) phương thức "Google" (chọn email hỗ trợ nếu được hỏi).Tạo Cơ sở dữ liệu (Firestore):Vào "Build" -> "Firestore Database".Nhấn "Create database".Chọn "Start in production mode" (Chế độ sản xuất).Chọn vị trí máy chủ (thường là asia-southeast1 hoặc gần bạn).Cập nhật Quy tắc Bảo mật (Security Rules):Vào "Firestore Database" -> tab "Rules".Xóa toàn bộ nội dung cũ.Sao chép và dán toàn bộ nội dung code rules dưới đây vào và nhấn "Publish".<details><summary>Nhấn để xem Toàn bộ Code firestore.rules</summary>rules_version = '2';

service cloud.firestore {
match /databases/{database}/documents {

  // Collection users
  match /users/{userId} {
    allow create: if request.auth != null && request.auth.uid == userId;
    allow read: if request.auth != null;
    allow update: if request.auth != null && request.auth.uid == userId;
  }

  // Collection wallets
  match /wallets/{walletId} {
    allow read, create: if request.auth != null;

    function isOwner() {
      return get(/databases/$(database)/documents/walletMembers/$(walletId)).data.members[request.auth.uid].role == 'owner';
    }
    allow update, delete: if request.auth != null && isOwner();
  }

  // Collection walletMembers (QUAN TRỌNG)
  match /walletMembers/{walletId} {

    allow read: if request.auth != null
                  && resource.data.members[request.auth.uid] != null;

    // --- HÀM HELPER (Hỗ trợ) ---
    function isOwner() {
      return resource.data.members[request.auth.uid].role == 'owner';
    }
    function isLeaving() {
      let uid = request.auth.uid;
      // Phải là thành viên, và đang xóa chính mình
      return (uid in resource.data.members)
             && !(uid in request.resource.data.members)
             && resource.data.members[uid].role != 'owner'; // Owner không thể rời nhóm
    }
    function isAcceptingInvite() {
      let uid = request.auth.uid;
      // Không có trong data cũ, nhưng có trong data mới
      return !(uid in resource.data.members)
             && (uid in request.resource.data.members);
    }
    // ----------------------------

    allow create: if request.auth != null 
                    && request.resource.data.members[request.auth.uid].role == 'owner';

    // CẬP NHẬT (QUAN TRỌNG):
    allow update: if request.auth != null && (
                    isOwner() || isLeaving() || isAcceptingInvite()
                  );

    allow delete: if false;
    allow list: if request.auth != null;
  }

  // Collection transactions
  match /wallets/{walletId}/transactions/{transactionId} {

    function getWalletRole(userId) {
      return get(/databases/$(database)/documents/walletMembers/$(walletId)).data.members[userId].role;
    }
    function isWalletMember() {
      return request.auth.uid in get(/databases/$(database)/documents/walletMembers/$(walletId)).data.members;
    }

    allow read, list: if request.auth != null && isWalletMember();
    allow create: if request.auth != null && (getWalletRole(request.auth.uid) == 'owner' || getWalletRole(request.auth.uid) == 'editor');
    allow update, delete: if request.auth != null && (getWalletRole(request.auth.uid) == 'owner' || getWalletRole(request.auth.uid) == 'editor');
  }

  // Collection logs
  match /wallets/{walletId}/logs/{logId} {

    function isWalletMember() {
      return request.auth.uid in get(/databases/$(database)/documents/walletMembers/$(walletId)).data.members;
    }

    allow read, list: if request.auth != null && isWalletMember();
    allow create: if request.auth != null && isWalletMember();
    allow update, delete: if false;
  }

  // Collection invitations
  match /invitations/{inviteId} {
    function isInviter() {
      return request.auth.uid == resource.data.inviterId;
    }
    function isInvited() {
      return request.auth.token.email == resource.data.invitedEmail;
    }

    allow read: if request.auth != null && (isInviter() || isInvited());
    allow list: if request.auth != null; 
    allow create: if request.auth != null;
    allow update, delete: if request.auth != null && (isInviter() || isInvited());
  }

}
}
</details>Tạo Chỉ mục (Indexes):Vào "Firestore Database" -> tab "Indexes".Nhấn "Add composite index" (Tạo chỉ mục tổng hợp).Collection ID: invitationsFields to index:Field 1: invitedEmail, chọn Ascending (Tăng dần).Field 2: status, chọn Ascending (Tăng dần).Field 3: createdAt, chọn Descending (Giảm dần).Nhấn "Create". (Quá trình này mất vài phút để "Building").Bước 3: Cài đặt Google Cloud (API Keys & Bảo mật)Truy cập Google Cloud Console và đảm bảo bạn đang chọn đúng dự án Firebase của mình.Lấy API Key cho Gemini:Vào "APIs & Services" -> "Library".Tìm và Bật (Enable) Generative Language API.Vào "APIs & Services" -> "Credentials" (Thông tin xác thực).Nhấn "Create Credentials" -> "API key".Hành động: Sao chép API Key này. Mở file api.js (file thật bạn đã tạo ở Bước 1) và dán vào biến GEMINI_API_KEY, thay thế cho "DÁN_KEY_GEMINI_CỦA_BẠN_VÀO_ĐÂY".Bật API cho Firebase Auth:Vào "APIs & Services" -> "Library".Tìm và Bật (Enable) Identity Toolkit API.Hạn chế (Restrict) CẢ HAI API Key (Rất quan trọng):Bạn sẽ thấy 2 key trong "Credentials":Browser key (auto created by Firebase)API key 1 (Key Gemini bạn vừa tạo)Bạn phải lặp lại các bước sau cho CẢ HAI key:Nhấn vào tên của key.Chọn "Application restrictions" -> "Websites".Nhấn "ADD".Thêm 2 dòng (thay [YOUR_PROJECT_ID] bằng ID dự án của bạn):http://localhost:8000/* (Để chạy thử local)https://[YOUR_PROJECT_ID].web.app/* (Để chạy production)Nhấn "Save".Cấu hình OAuth (Cho Đăng nhập Google):Trong "Credentials", tìm "OAuth 2.0 Client IDs".Nhấn vào "Web client (auto created by Firebase)".Trong "Authorized JavaScript origins" (Nguồn gốc JavaScript được ủy quyền), nhấn "ADD URI" và thêm 2 dòng:http://localhost:8000https://[YOUR_PROJECT_ID].web.appTrong "Authorized redirect URIs" (URI chuyển hướng được ủy quyền), đảm bảo đã có dòng (thường Firebase tự thêm):https://[YOUR_PROJECT_ID].firebaseapp.com/__/auth/handlerNhấn "Save".Bước 4: Chạy Local và DeployChạy Local:Mở Terminal trong thư mục quanlychitieu.Chạy một máy chủ local. (Nếu bạn có Python: python -m http.server 8000).Mở trình duyệt và truy cập http://localhost:8000.Deploy lên Firebase Hosting:Cài đặt công cụ Firebase (nếu chưa có): npm install -g firebase-toolsĐăng nhập: firebase loginKhởi tạo (nếu chưa có firebase.json): firebase initChọn Hosting.Chọn "Use an existing project" và chọn dự án của bạn.What do you want to use as your public directory? Gõ . (dấu chấm, nghĩa là thư mục hiện tại).Configure as a single-page app? Gõ Y (Yes).Triển khai:firebase deploy --only hosting
Sau khi hoàn tất, Terminal sẽ trả về Hosting URL của bạn.Bảo mật (Nhắc lại)Không bao giờ đẩy (push) các file api.js hoặc firebase.js (chứa key thật) lên GitHub public. Luôn sử dụng .gitignore.Luôn luôn sử dụng "Website restrictions" (Hạn chế HTTP) trên Google Cloud cho TẤT CẢ API Key của bạn để bảo vệ key khỏi bị sử dụng từ server lạ (lỗ hổng nghiêm trọng nhất).
